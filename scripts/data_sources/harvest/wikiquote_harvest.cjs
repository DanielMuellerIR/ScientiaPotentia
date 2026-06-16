// Wikiquote-Direktparser: erntet gemeinfreie deutsche Zitate VERBATIM von de.wikiquote.org.
//
// Warum so: LLM-generierte Zitate haben Fehlzuschreibungs- und Wortlaut-Risiko (z.B. hat
// wikiquote_verify.cjs Kants „Aufklärung…" → fälschlich Tucholsky abgefangen). Verbatim-
// by-construction = kein einziges Zeichen aus dem Modell-Gedächtnis. Die MediaWiki-API
// liefert den rohen Wikitext, daraus werden die `* "Zitat"`-Listenpunkte geparsed.
//
// Copyright-Gate (HART): §64 UrhG → 70-Jahre-Frist. Nur Autoren †≤1955.
// Übersetzungen ausgeschlossen (eigenes Copyright des Übersetzers).
// Aggregator-Lizenz (Wikiquote CC-BY-SA) ist für die Zitat-Texte selbst irrelevant,
// weil die Texte gemeinfrei sind (PD-old).
//
// Aufruf: node wikiquote_harvest.cjs
// Ausgabe: /tmp/cultura_quote_cand.json — bereit zum Review+Append (NICHT auto-mergen).

'use strict';

const https = require('https');
const fs    = require('fs');

// ──────────────────────────────────────────────────────────────────────────────
// Konfiguration & Hilfsfunktionen
// ──────────────────────────────────────────────────────────────────────────────

// E-Mail-Adresse für den MediaWiki-User-Agent (Pflicht-Feld laut API-Etiquette).
const UA = { 'User-Agent': 'ScientiaQuizWikiquoteHarvest/1.0 (educational; nfetzen@gmail.com)' };

// Warte ms Millisekunden (für Rate-Limiting: nie zwei Requests gleichzeitig gegen
// einen Host schicken — MediaWiki-API ist tolerant, aber sequenziell ist sicher).
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Slug-Hilfsfunktion: Name → URL-/ID-taugliche Zeichenkette (analog nasa_exoplanets.cjs).
function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Normalisierungsfunktion (aus wikiquote_verify.cjs übernommen, für Dedup).
// Achtung: ß→ss, Anführungszeichen/Satzzeichen/Whitespace vereinheitlicht.
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[„"""»«‚''']/g, ' ')
    .replace(/[–—-]/g, ' ')
    .replace(/[…]/g, ' ')
    .replace(/[.,;:!?()\[\]]/g, ' ')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

// Token-Liste für Overlap-Dedup (Wörter ≥3 Zeichen).
const toks = s => norm(s).split(' ').filter(w => w.length >= 3);

// Overlap-Anteil zweier Texte (0.0–1.0). Wird für Dedup gegen Bestand genutzt:
// Wenn ein Kandidat zu ≥0.7 Overlap mit einem bestehenden Zitat hat, wird er
// als Duplikat verworfen (etwas großzügiger als Verify-Schwelle 0.8, um auch
// Paraphrasen zu erwischen).
function overlapRatio(a, b) {
  const ta = new Set(toks(a));
  const tb = toks(b);
  if (!tb.length) return 0;
  return tb.filter(w => ta.has(w)).length / tb.length;
}

// ──────────────────────────────────────────────────────────────────────────────
// MediaWiki-API: Wikitext einer de.wikiquote-Seite holen
// ──────────────────────────────────────────────────────────────────────────────

// Holt den rohen Wikitext der de.wikiquote-Seite mit dem gegebenen Lemma (Titel).
// Gibt leeren String zurück bei 404/Fehler (Seite fehlt oder API-Fehler).
// Wiederholung bei Netzfehler (bis zu 3 Versuche, 800 ms Backoff).
function fetchWikitext(lemma, tries = 0) {
  return new Promise(resolve => {
    // MediaWiki-API: action=query, prop=revisions, rvslots=main liefert Wikitext.
    const url = 'https://de.wikiquote.org/w/api.php'
      + '?action=query&prop=revisions&rvprop=content&rvslots=main'
      + '&format=json&titles=' + encodeURIComponent(lemma);

    https.get(url, { headers: UA }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const pages = JSON.parse(raw).query.pages;
          const page  = Object.values(pages)[0];
          // `missing` ist ein Marker-Property von MediaWiki bei nicht-existenten Seiten.
          if (page.missing !== undefined) { resolve(''); return; }
          // Wikitext steckt im Slot „main" unter dem Schlüssel „*".
          resolve(page.revisions[0].slots.main['*'] || '');
        } catch (e) {
          resolve('');
        }
      });
    }).on('error', async () => {
      if (tries < 3) {
        await sleep(800);
        resolve(await fetchWikitext(lemma, tries + 1));
      } else {
        resolve('');
      }
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Wikitext-Parser: Zitat-Listenpunkte extrahieren
// ──────────────────────────────────────────────────────────────────────────────

// Typisches Wikiquote-Format (de.wikiquote.org):
//
//   == Abschnitt (optional: Werktitel) ==
//   * „Zitat-Text hier."
//   ** Quellenangabe / Kommentar (ignorieren)
//   * „Zweites Zitat."
//
// Ziel: nur die `* „..."` Haupteinträge, ohne `**`-Unterzeilen.
// Die Abschnittsüberschrift `== Werk ==` verwenden wir als Hinweis auf `work`,
// wenn sie wie ein Werktitel aussieht (keine Meta-Abschnitte wie „Über ...",
// „Quellen", „Weblinks", „Bemerkungen").

// Normalisiert das geerntete Zitat:
// 1. Typografische Anführungszeichen am Rand entfernen.
// 2. Quellenangaben am Ende abschneiden (Wikiquote-Praxis: Zitat" – Quellenangabe).
//    Muster: <Zitat>[„"] – Quellenanmerkung ODER Zitat." - Quellenanmerkung
//    Der saubere Zitat-Text endet mit dem schließenden Anführungszeichen.
function stripQuotationMarks(s) {
  // Schritt 1: Quellenanhänge nach dem schließenden Anführungszeichen abschneiden.
  // Typisch: „Text." – Quellenanmerkung mit Gedankenstrich nach dem Schluß-"
  // Variante A: endet mit " – oder " - (Gedankenstrich/Bindestrich nach Anf.zeichen)
  s = s.replace(/["""]\s*[–—-].+$/, '');
  // Variante B: URL im Text → alles ab http entfernen
  s = s.replace(/\s+https?:\/\/\S+/g, '');

  // Schritt 2: Äußere Anführungszeichen entfernen.
  s = s
    .replace(/^[„"»«"]\s*/, '')   // Anfang: öffnendes Anführungszeichen
    .replace(/\s*["""«»]\s*$/, '') // Ende: schließendes Anführungszeichen
    .trim();

  // Schritt 3: Nochmal Quellenanhang prüfen (manchmal ohne Anführungszeichen am Ende).
  // Muster: Text." - Quellenanmerkung
  s = s.replace(/[.!?]\s*[–—-]\s+.{5,}$/, m => m[0]); // Behält nur das Satzzeichen
  // Muster: Text." – oder Text." —
  s = s.replace(/\s*[–—]\s*.{0,120}$/, '').trim();

  return s.trim();
}

// Prüft, ob ein Text wie eine Gedichtstrophe aussieht (für Quiz ungeeignet:
// mehrzeilig, hat `//`-Umbrüche, kein geschlossener Gedanke in einer Zeile).
function isVerseFragment(text) {
  // `//` ist der Wikiquote-Konvention für Zeilenumbrüche in Versen.
  if (text.includes(' // ')) return true;
  // Doppelschrägstrich am Zeilenende/anfang.
  if (/\/\//.test(text)) return true;
  return false;
}

// Meta-Abschnitte, die keine Werk-Titel sind, sondern Wikiquote-Struktur-Overhead.
const META_SECTIONS = new Set([
  'quellen', 'quellenangaben', 'einzelnachweise', 'weblinks', 'literatur',
  'über', 'see also', 'anmerkungen', 'bemerkungen', 'siehe auch', 'trivia',
  'zitate über', 'zitate von', 'posthum', 'briefe', 'quelle', 'nachweise',
  'anekdoten', 'filme', 'fernsehen', 'interviews', 'bekannte zitate',
  'zugeschriebene zitate', 'falsch zugeschriebene zitate', 'apokryphe',
  'zweifelhaft', 'umstrittene zitate', 'nicht belegt', 'fälschungen',
  'vermutlich falsch', 'unsicher',
]);

// Liefert true, wenn die Abschnittsüberschrift wie ein Meta-Abschnitt klingt.
function isMetaSection(heading) {
  const h = heading.toLowerCase().trim();
  // Prüf zunächst die Deny-Liste, dann: enthält „über" → meta (z.B. „Über Goethe").
  if (META_SECTIONS.has(h)) return true;
  if (h.startsWith('über ') || h.startsWith('zitate über ')) return true;
  return false;
}

// Verarbeitet den Wikitext einer Autorenseite und gibt saubere Zitat-Strings zurück
// (jeweils mit optionalem work-Hinweis aus der Abschnittsüberschrift).
function parseWikitext(wikitext) {
  const results = []; // Array von { text, workHint }

  let currentWork = null; // Aktuell aktiver Werk-Abschnitt (oder null)
  const lines = wikitext.split('\n');

  for (const line of lines) {
    // Abschnittsüberschriften erkennen: == Titel == (level 2) oder === Titel === (level 3).
    const headingMatch = line.match(/^={2,4}\s*(.+?)\s*={2,4}\s*$/);
    if (headingMatch) {
      const heading = headingMatch[1].trim();
      // Meta-Abschnitte signalisieren: work-Hinweis zurücksetzen (kein Werk).
      if (isMetaSection(heading)) {
        currentWork = null;
      } else {
        // Alles andere könnte ein Werktitel sein.
        currentWork = heading;
      }
      continue;
    }

    // Hauptlistenpunkt erkennen: beginnt mit genau einem `*` (kein `**`).
    // `**`-Zeilen sind Quellenangaben/Kommentare und werden übersprungen.
    if (/^\*[^*]/.test(line)) {
      // Wikitext-Formatierung entfernen: [[Links]], {{Templates}}, ''Kursiv''.
      let text = line
        .replace(/^\*\s*/, '')              // Führendes `*` + Leerzeichen
        .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')  // [[Link|Text]] → Text
        .replace(/\{\{[^}]*\}\}/g, '')      // {{Template}} → entfernen
        .replace(/''+/g, '')                // ''kursiv'', '''fett''' → entfernen
        .replace(/<ref[^>]*>.*?<\/ref>/gs, '') // <ref>-Tags → entfernen
        .replace(/<[^>]+>/g, '')            // restliche HTML-Tags → entfernen
        .replace(/&nbsp;/g, ' ')            // HTML-Entities → normaler Space
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      // Äußere Anführungszeichen und Quellenanhänge entfernen.
      text = stripQuotationMarks(text);

      // Gedichtstrophen herausfiltern: kein // im Text (Wikiquote-Vers-Umbruch).
      if (isVerseFragment(text)) continue;

      // URLs im Text (Quellenlinks die nicht sauber entfernt wurden) → überspringen.
      if (/https?:\/\//.test(text)) continue;

      // Leer oder zu kurz → überspringen.
      if (text.length < 20) continue;

      // Zu lang → für ein Quiz-Aphorismus ungeeignet (Absatz-Länge), überspringen.
      // Grenzwert 280 Zeichen: Aphorismen/Sentenzen sind typisch kürzer.
      if (text.length > 280) continue;

      // Reine Titelzeilen oder Jahreszahlen filtern (kein echter Zitat-Text).
      // Heuristik: besteht hauptsächlich aus Ziffern → skip.
      if (/^\d+(\s*[–—-]\s*\d+)?$/.test(text)) continue;

      // Wikiquote enthält manchmal Zeilen wie „→ Hauptartikel:" als Pseudo-Listenpunkt.
      if (text.startsWith('→') || text.startsWith('↑')) continue;

      // Unvollständige Quellenangaben-Fragmente filtern (Wikitext-Überreste).
      // Z.B. reine Jahreszahlangaben, ISBN-Zeilen, Seitenzahlen.
      if (/^[Ss]\.\s*\d+/.test(text)) continue;          // „S. 123"
      if (/^\[\.{3}\]/.test(text)) continue;              // „[...] dem Mann …"

      results.push({ text, workHint: currentWork });
    }
  }

  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Kuratierte PD-Autoren-Liste (†≤1955, nur Originale auf Deutsch)
// ──────────────────────────────────────────────────────────────────────────────
//
// Format: { lemma, author, deathYear }
//   lemma     = de.wikiquote-Seitenname (exakt wie im URL nach /wiki/)
//   author    = Anzeigename (wie in cultura_raw.json)
//   deathYear = bestätigtes Todesjahr (Quelle: Wikipedia/Wikidata)
//
// NICHT enthalten (Grenzfälle / zu spät gestorben):
//   Bertolt Brecht †1956 → AUSGESCHLOSSEN (1 Jahr zu jung für 70-J-Frist 2026)
//   Stefan Zweig †1942 → wäre ok, aber überwiegend Prosa ohne klassische Aphorismen
//   Hugo von Hofmannsthal †1929 → wenige bekannte Einzelzitate auf de.wikiquote
//
// Bereits bestehende Autoren in cultura_raw.json (69 Zitate) sind hier mit aufgeführt,
// damit der Dedup-Schritt unten neue Zitate derselben Autoren ernten kann.

const PD_AUTHORS = [
  // ── Schon in Cultura vorhanden (Dedup prüft Einzelzitate, nicht Autoren) ──
  { lemma: 'Johann Wolfgang von Goethe',   author: 'Johann Wolfgang von Goethe',   deathYear: 1832 },
  { lemma: 'Friedrich Schiller',           author: 'Friedrich Schiller',           deathYear: 1805 },
  { lemma: 'Friedrich Nietzsche',          author: 'Friedrich Nietzsche',           deathYear: 1900 },
  { lemma: 'Immanuel Kant',                author: 'Immanuel Kant',                 deathYear: 1804 },
  { lemma: 'Arthur Schopenhauer',          author: 'Arthur Schopenhauer',           deathYear: 1860 },
  { lemma: 'Heinrich Heine',               author: 'Heinrich Heine',               deathYear: 1856 },
  { lemma: 'Franz Kafka',                  author: 'Franz Kafka',                   deathYear: 1924 },
  { lemma: 'Georg Christoph Lichtenberg',  author: 'Georg Christoph Lichtenberg',  deathYear: 1799 },
  { lemma: 'Gotthold Ephraim Lessing',     author: 'Gotthold Ephraim Lessing',     deathYear: 1781 },
  { lemma: 'Kurt Tucholsky',               author: 'Kurt Tucholsky',               deathYear: 1935 },
  { lemma: 'Rainer Maria Rilke',           author: 'Rainer Maria Rilke',           deathYear: 1926 },
  { lemma: 'Friedrich Hölderlin',          author: 'Friedrich Hölderlin',          deathYear: 1843 },
  { lemma: 'Novalis',                      author: 'Novalis',                       deathYear: 1801 },
  { lemma: 'Joseph von Eichendorff',       author: 'Joseph von Eichendorff',       deathYear: 1857 },
  { lemma: 'Heinrich von Kleist',          author: 'Heinrich von Kleist',          deathYear: 1811 },
  { lemma: 'Wilhelm Busch',                author: 'Wilhelm Busch',                deathYear: 1908 },
  { lemma: 'Christian Morgenstern',        author: 'Christian Morgenstern',        deathYear: 1914 },
  { lemma: 'Franz Grillparzer',            author: 'Franz Grillparzer',            deathYear: 1872 },
  { lemma: 'Georg Büchner',                author: 'Georg Büchner',                deathYear: 1837 },
  { lemma: 'Theodor Fontane',              author: 'Theodor Fontane',              deathYear: 1898 },

  // ── Neue PD-Autoren (†≤1955, noch nicht in Cultura) ──
  { lemma: 'Karl Kraus',                   author: 'Karl Kraus',                   deathYear: 1936 },
  { lemma: 'Marie von Ebner-Eschenbach',   author: 'Marie von Ebner-Eschenbach',   deathYear: 1916 },
  { lemma: 'Jean Paul',                    author: 'Jean Paul',                    deathYear: 1825 },
  { lemma: 'Friedrich Hebbel',             author: 'Friedrich Hebbel',             deathYear: 1863 },
  { lemma: 'Theodor Storm',                author: 'Theodor Storm',                deathYear: 1888 },
  { lemma: 'Adalbert Stifter',             author: 'Adalbert Stifter',             deathYear: 1868 },
  { lemma: 'Georg Wilhelm Friedrich Hegel', author: 'Georg Wilhelm Friedrich Hegel', deathYear: 1831 },
  { lemma: 'Friedrich Hölderlin',          author: 'Friedrich Hölderlin',          deathYear: 1843 }, // Duplikat-Guard im Code
  { lemma: 'Gottfried Wilhelm Leibniz',    author: 'Gottfried Wilhelm Leibniz',    deathYear: 1716 },
  { lemma: 'Martin Luther',                author: 'Martin Luther',                deathYear: 1546 },
  { lemma: 'Friedrich von Schelling',      author: 'Friedrich von Schelling',      deathYear: 1854 },
  { lemma: 'Jakob Grimm',                  author: 'Jakob Grimm',                  deathYear: 1863 },
  { lemma: 'Theodor Fontane',              author: 'Theodor Fontane',              deathYear: 1898 }, // Duplikat-Guard
  { lemma: 'Gerhart Hauptmann',            author: 'Gerhart Hauptmann',            deathYear: 1946 },
  { lemma: 'Hugo Ball',                    author: 'Hugo Ball',                    deathYear: 1927 },
  { lemma: 'Else Lasker-Schüler',          author: 'Else Lasker-Schüler',          deathYear: 1945 },
  { lemma: 'Karl May',                     author: 'Karl May',                     deathYear: 1912 },
  { lemma: 'Otto von Bismarck',            author: 'Otto von Bismarck',            deathYear: 1898 },
  { lemma: 'Ludwig van Beethoven',         author: 'Ludwig van Beethoven',         deathYear: 1827 },
  { lemma: 'Wolfgang Amadeus Mozart',      author: 'Wolfgang Amadeus Mozart',      deathYear: 1791 },
];

// Lemma-Duplikate in der Liste entfernen (gleicher Lemma-Wert → nur einmal holen).
const UNIQUE_AUTHORS = (() => {
  const seen = new Set();
  return PD_AUTHORS.filter(a => {
    if (seen.has(a.lemma)) return false;
    seen.add(a.lemma);
    return true;
  });
})();

// ──────────────────────────────────────────────────────────────────────────────
// Bestehende Zitate für Dedup laden
// ──────────────────────────────────────────────────────────────────────────────

// Gibt Texte aller bestehenden `quote`-Einträge aus cultura_raw.json zurück.
function loadExistingQuotes() {
  const rawPath = require('path').join(__dirname, '..', 'cultura_raw.json');
  try {
    const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    return data
      .filter(c => c.category === 'quote')
      .map(c => ({ text: c.name, id: c.id }));
  } catch (e) {
    console.warn('  Warnung: cultura_raw.json nicht lesbar →', e.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ID-Generator (Muster aus bestehenden Quotes: "autor-stichwort")
// ──────────────────────────────────────────────────────────────────────────────

// Erzeugt eine kollisionsfreie ID im Stil "autor-keyword".
// usedIds = Set der bereits vergebenen IDs (aus Bestand + bereits in diesem Lauf).
function makeId(author, text, usedIds) {
  // Ersten nicht-trivialen Wörter aus Autorname (Nachname).
  const authorPart = slug(author.split(' ').pop());

  // Erstes inhaltliches Wort aus dem Zitat (Füllwörter überspringen).
  const FILL = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'der', 'die',
    'das', 'ein', 'eine', 'und', 'oder', 'ist', 'war', 'hat', 'den', 'dem',
    'des', 'ist', 'nicht', 'mit', 'von', 'als', 'auf', 'an', 'zu', 'in']);
  const words = text.replace(/[^a-z\s]/gi, '').toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !FILL.has(w));
  const kwPart = words.slice(0, 2).map(w => w.slice(0, 8)).join('-');
  let id = authorPart + '-' + (kwPart || slug(text.slice(0, 20)));

  // Kollision auflösen durch fortlaufende Nummern-Suffix.
  let attempt = id;
  let counter = 2;
  while (usedIds.has(attempt)) {
    attempt = id + '-' + counter++;
  }
  return attempt;
}

// ──────────────────────────────────────────────────────────────────────────────
// Haupt-Harvest-Funktion
// ──────────────────────────────────────────────────────────────────────────────

async function harvest() {
  console.log('=== Wikiquote-Direktharvest ===');
  console.log(`PD-Autoren (kuratiert, †≤1955): ${UNIQUE_AUTHORS.length}`);

  // Bestehende Zitate für Dedup laden.
  const existing = loadExistingQuotes();
  const usedIds  = new Set(existing.map(q => q.id));
  console.log(`Bestehende Zitate (cultura_raw.json): ${existing.length}`);

  // Statistik-Zähler.
  let totalRaw = 0;
  let droppedTooShort = 0;
  let droppedTooLong  = 0;
  let droppedDedup    = 0;
  let droppedEmpty    = 0;

  const authorStats = []; // Pro-Autor-Report für den finalen Report
  const candidates  = []; // Finale Kandidaten-Liste

  for (const { lemma, author, deathYear } of UNIQUE_AUTHORS) {
    console.log(`\n→ ${author} (†${deathYear}): hol Wikiquote-Seite "${lemma}"…`);

    // MediaWiki-Wikitext holen.
    const wikitext = await fetchWikitext(lemma);

    if (!wikitext) {
      console.log(`  ! Seite "${lemma}" nicht gefunden oder leer → überspringe`);
      authorStats.push({ author, deathYear, lemmaOk: false, rawCount: 0, newCount: 0 });
      await sleep(300); // Rate-Limit: kurze Pause auch bei leerem Ergebnis
      continue;
    }

    // Wikitext parsen → rohe Zitat-Einträge.
    const parsed = parseWikitext(wikitext);
    console.log(`  Rohzitate geparsed: ${parsed.length}`);
    totalRaw += parsed.length;
    droppedEmpty += (parsed.length === 0 ? 1 : 0);

    let authorNew = 0;

    for (const { text, workHint } of parsed) {
      // Längenfilter: minimal 20, maximal 350 Zeichen (Parser setzt schon 350, hier redundant aber explizit).
      if (text.length < 20) { droppedTooShort++; continue; }
      if (text.length > 350) { droppedTooLong++;  continue; }

      // Dedup gegen Bestand (normierter Token-Overlap ≥0.7 → Duplikat).
      const isDup = existing.some(ex => {
        const ratio = overlapRatio(ex.text, text);
        return ratio >= 0.7;
      });
      // Auch gegen bereits in diesem Lauf gesammelte Kandidaten dedup-en.
      const isDupInRun = candidates.some(c => overlapRatio(c.name, text) >= 0.7);

      if (isDup || isDupInRun) {
        droppedDedup++;
        continue;
      }

      // ID erzeugen.
      const id = makeId(author, text, usedIds);
      usedIds.add(id);

      // work-Hinweis: nur übernehmen, wenn die Abschnittsüberschrift wie ein echter
      // Werktitel aussieht — keine Wikiquote-Struktur-Labels wie „Zitate mit
      // Quellenangabe", „Andere", „Stücke", „Aphorismen", „Letzte Worte" etc.
      // Wir erfinden keinen work-Wert — lieber weglassen als raten.
      const STRUCTURE_LABELS = new Set([
        'andere', 'andere werke', 'andere gedichte', 'andere gedichte und balladen',
        'zitate mit quellenangabe', 'quellenangaben',
        'stücke', 'aphorismen', 'letzte worte', 'fragmente', 'nachgelassenes',
        'briefe', 'briefe und fabeln', 'tagebücher', 'gesammelte werke', 'stufen',
        'überprüft', 'zugeschrieben', 'andere quellen',
        // Sehr lange Abschnittstitel sind auch Struktur-Labels (komma-getrennte Listen)
      ]);
      // Wikitext-Formatierungs-Reste aus Überschriften entfernen:
      // - ''kursiv''-Zeichen
      // - Wikilinks [[w:Text|Anzeige]] → Anzeige
      // - Führende ==-Zeichen
      // - "Zitate mit Bezug auf X"-Muster
      let workCleaned = workHint
        ? workHint
            .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')  // [[link|text]] → text
            .replace(/''+/g, '')                                 // ''kursiv''
            .replace(/^=+\s*|\s*=+$/g, '')                      // führende/endende ==
            .trim()
        : null;
      // Lange komma-getrennte Aufzählungen (Wikiquote-Sammelabschnitte) ausschließen.
      const hasCommaList = workCleaned && (workCleaned.match(/,/g) || []).length >= 3;
      // "Zitate mit Bezug auf X" → kein Werkname.
      const isBezug = workCleaned && /zitate mit bezug/i.test(workCleaned);
      const workIsStructure = workCleaned && (
        STRUCTURE_LABELS.has(workCleaned.toLowerCase()) || hasCommaList || isBezug
      );
      const workAttr = (workCleaned && workCleaned.length > 1 && workCleaned.length < 80 && !workIsStructure)
        ? workCleaned
        : undefined;

      // Cultura-quote-Schema exakt abbilden.
      const concept = {
        id,
        name: text,          // Das Zitat selbst (verbatim aus Wikiquote)
        category: 'quote',
        attributes: {
          author,
          authorDeathYear: deathYear,
          // work: nur wenn aus Abschnittsüberschrift sicher ableitbar
          ...(workAttr ? { work: workAttr } : {}),
        },
        // funFact wird NICHT befüllt (kein LLM-Einsatz) — kann später manuell ergänzt werden.
        // Das Feld fehlt lieber, als dass ein generierter Text reinkommt.
        sourceName: `Wikiquote – ${author}`,
        sourceUrl:  `https://de.wikiquote.org/wiki/${encodeURIComponent(lemma)}`,
        verifyNote: `Verbatim aus de.wikiquote, Wikitext-Listenpunkt; Todesjahr ${deathYear} (PD-Gate †≤1955 ok).`,
      };

      candidates.push(concept);
      authorNew++;
    }

    authorStats.push({
      author,
      deathYear,
      lemmaOk: true,
      rawCount: parsed.length,
      newCount: authorNew,
    });

    console.log(`  Neu (nach Dedup): ${authorNew}`);

    // Rate-Limit: 400 ms Pause zwischen Autoren-Abrufen.
    await sleep(400);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Vollständigen Harvest speichern (alle gefilterten Kandidaten)
  // ──────────────────────────────────────────────────────────────────────────

  const fullPath = '/tmp/cultura_quote_cand_full.json';
  fs.writeFileSync(fullPath, JSON.stringify(candidates, null, 2));
  console.log(`\nVolle Ernte gespeichert: ${candidates.length} Zitate → ${fullPath}`);

  // ──────────────────────────────────────────────────────────────────────────
  // Kuratierte Top-Auswahl (~80 Zitate, bereit für Append)
  // ──────────────────────────────────────────────────────────────────────────
  //
  // Auswahlkriterien (rein maschinell, kein LLM):
  //   1. Länge 25-180 Zeichen (kurze, knappe Aphorismen bevorzugt).
  //   2. Endet mit Satzzeichen (.!?""„) — abgeschlossener Satz.
  //   3. Keine eckigen Klammern (Auslassungszeichen → Fragmente).
  //   4. Pro Autor maximal 5 Zitate (Diversität sichern).
  //   5. Innerhalb des Autors: kürzere bevorzugt (Score = Länge, niedrig = gut).
  //   6. Gesamtziel: ~80 Einträge.

  // Schritt A: Basis-Qualitätsfilter.
  const TARGET = 80;
  const MAX_PER_AUTHOR = 5;

  const qualFiltered = candidates.filter(c => {
    const t = c.name;
    // Längenfilter: kurze Aphorismen bevorzugt.
    if (t.length < 25 || t.length > 180) return false;
    // Abgeschlossener Satz: endet mit Satzzeichen oder Anführungszeichen.
    if (!/[.!?""„»«]$/.test(t)) return false;
    // Keine eckigen Klammern (Auslassungszeichen → Fragment, oder Wikilink-Reste).
    if (/[\[\]]/.test(t)) return false;
    // Kein Text der mit Kleinbuchstaben anfängt (Parsing-Fehler durch abgeschnittenen
    // Wikilink-Buchstaben, z.B. „as also war des Pudels Kern" statt „Das also war …").
    if (/^[a-zäöüß]/.test(t)) return false;
    // Keine Anführungszeichen inmitten des Texts die nach Wikitext-Resten aussehen.
    if (/\{\{/.test(t) || /\}\}/.test(t)) return false;
    return true;
  });

  // Schritt B: Pro Autor sortieren (kürzere zuerst) und auf MAX_PER_AUTHOR begrenzen.
  const byAuthor = {};
  for (const c of qualFiltered) {
    const au = c.attributes.author;
    if (!byAuthor[au]) byAuthor[au] = [];
    byAuthor[au].push(c);
  }
  for (const au of Object.keys(byAuthor)) {
    // Sortierung: nach Länge aufsteigend (kurze Aphorismen zuerst).
    byAuthor[au].sort((a, b) => a.name.length - b.name.length);
    byAuthor[au] = byAuthor[au].slice(0, MAX_PER_AUTHOR);
  }

  // Schritt C: Zusammenführen und auf TARGET begrenzen.
  // Round-Robin über Autoren, um Diversität zu erhalten.
  const selected = [];
  const authorQueues = Object.values(byAuthor).filter(q => q.length > 0);
  // Zunächst je 1 Zitat pro Autor (breite Abdeckung), dann auffüllen.
  let round = 0;
  while (selected.length < TARGET) {
    let added = false;
    for (const queue of authorQueues) {
      if (round < queue.length && selected.length < TARGET) {
        selected.push(queue[round]);
        added = true;
      }
    }
    if (!added) break; // Alle Queues erschöpft
    round++;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Kuratierte Auswahl speichern
  // ──────────────────────────────────────────────────────────────────────────

  const outPath = '/tmp/cultura_quote_cand.json';
  fs.writeFileSync(outPath, JSON.stringify(selected, null, 2));

  // ──────────────────────────────────────────────────────────────────────────
  // Konsolen-Report
  // ──────────────────────────────────────────────────────────────────────────

  console.log('\n════════════════════════════════════════════════');
  console.log('Harvest-Report');
  console.log('════════════════════════════════════════════════');
  console.log(`Autoren versucht:         ${UNIQUE_AUTHORS.length}`);
  console.log(`  davon Seite gefunden:   ${authorStats.filter(a => a.lemmaOk).length}`);
  console.log(`  davon Seite leer/404:   ${authorStats.filter(a => !a.lemmaOk).length}`);
  console.log(`Rohzitate (alle parsed):  ${totalRaw}`);
  console.log(`  Dropped zu kurz/lang:   ${droppedTooShort + droppedTooLong}`);
  console.log(`  Dropped Dedup:          ${droppedDedup}`);
  console.log(`Kandidaten (voll):        ${candidates.length}`);
  console.log(`Kandidaten (Auswahl):     ${selected.length}`);
  console.log(`\n=> Voll:    ${fullPath}`);
  console.log(`=> Auswahl: ${outPath}`);

  console.log('\nPro-Autor-Übersicht:');
  for (const s of authorStats) {
    const marker = s.lemmaOk ? '✓' : '✗ (keine Seite)';
    console.log(`  ${marker} ${s.author} †${s.deathYear}: roh=${s.rawCount}, neu=${s.newCount}`);
  }

  console.log('\nStichproben Auswahl (erste 5):');
  selected.slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. „${c.name.slice(0, 70)}${c.name.length > 70 ? '…' : ''}" — ${c.attributes.author}`);
  });

  return { candidates, selected, authorStats, totalRaw, droppedDedup, droppedTooShort, droppedTooLong };
}

// ──────────────────────────────────────────────────────────────────────────────
// Einstiegspunkt
// ──────────────────────────────────────────────────────────────────────────────

harvest().catch(e => {
  console.error('FEHLER:', e.message);
  process.exit(1);
});
