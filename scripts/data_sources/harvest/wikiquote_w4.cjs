// wikiquote_w4.cjs — Welle 4 des Wikiquote-Direktharvesters für ScientiaPotentia.
//
// Unterschied zu wikiquote_harvest.cjs (Welle 1-3):
//   - Erweiterte PD-Autorenliste (†≤1955, verifiziert) mit Autoren, die in früheren
//     Wellen noch nicht oder kaum vertreten waren.
//   - Ausgabe nach /tmp/cultura_quote_w4.json (volle Ernte) und
//     /tmp/cultura_quote_w4_top.json (kuratierte Top-Auswahl, max. 10 pro Autor).
//   - Dedup gegen cultura_raw.json UND gegen alle bisherigen /tmp-Erntedateien
//     (v3_full, cand_full), damit keine bereits gesammelten Zitate doppelt landen.
//   - 3.-Person-Abschnitte ausgeschlossen (isMetaSection schließt "Über X" aus).
//
// Copyright-Gate (HART): §64 UrhG → 70-Jahre-Frist. Nur Autoren †≤1955.
// Nur deutschsprachige Originale.
//
// Aufruf: node wikiquote_w4.cjs
// Ausgabe: /tmp/cultura_quote_w4.json (alle Kandidaten)
//          /tmp/cultura_quote_w4_top.json (kuratierte Auswahl, max. 10/Autor)

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { writeJsonAtomic } = require('./json_io.cjs');
const {
  stripQuotationMarks, normalizeQuoteText, quoteTokens,
} = require('./wikiquote_cleaning.cjs');

// ──────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen (übernommen aus wikiquote_harvest.cjs, unveraendert)
// ──────────────────────────────────────────────────────────────────────────────

const UA = { 'User-Agent': 'ScientiaQuizWikiquoteHarvest/1.0 (public educational project)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// `norm`/`toks` liegen seit CodeQA 2026-09-03 zentral in wikiquote_cleaning.cjs.
// Die frueheren Kopien waren auseinandergedriftet: Diese hier kannte nur die
// geraden Anfuehrungszeichen, der Verifizierer auch die typografischen.
const norm = normalizeQuoteText;
const toks = quoteTokens;

function overlapRatio(a, b) {
  const ta = new Set(toks(a));
  const tb = toks(b);
  if (!tb.length) return 0;
  return tb.filter(w => ta.has(w)).length / tb.length;
}

// ──────────────────────────────────────────────────────────────────────────────
// MediaWiki-API
// ──────────────────────────────────────────────────────────────────────────────

function fetchWikitext(lemma, tries = 0) {
  return new Promise((resolve, reject) => {
    const url = 'https://de.wikiquote.org/w/api.php'
      + '?action=query&prop=revisions&rvprop=content&rvslots=main'
      + '&format=json&titles=' + encodeURIComponent(lemma);

    let retryStarted = false;
    const retry = error => {
      if (retryStarted) return;
      retryStarted = true;
      if (tries >= 3) {
        reject(error);
        return;
      }
      setTimeout(
        () => fetchWikitext(lemma, tries + 1).then(resolve, reject),
        800 * (tries + 1),
      );
    };

    const req = https.get(url, { headers: UA }, res => {
      if (res.statusCode === 429 || res.statusCode >= 500) {
        res.resume();
        retry(new Error(`Wikiquote HTTP ${res.statusCode} für ${lemma}`));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Wikiquote HTTP ${res.statusCode} für ${lemma}`));
        return;
      }
      let raw = '';
      res.on('error', retry);
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const pages = JSON.parse(raw).query.pages;
          const page  = Object.values(pages)[0];
          if (page.missing !== undefined) { resolve(''); return; }
          resolve(page.revisions[0].slots.main['*'] || '');
        } catch (e) {
          retry(new Error(`Wikiquote-Antwort für ${lemma} nicht parsebar: ${e.message}`));
        }
      });
    });
    req.on('error', retry);
    req.setTimeout(30000, () => req.destroy(new Error('Wikiquote-Timeout')));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Wikitext-Parser
// ──────────────────────────────────────────────────────────────────────────────

function isVerseFragment(text) {
  if (text.includes(' // ')) return true;
  if (/\/\//.test(text)) return true;
  return false;
}

// Meta-Abschnitte ausschließen: "Über X" → 3.-Person-Zitate, kein Originalzitat.
const META_SECTIONS = new Set([
  'quellen', 'quellenangaben', 'einzelnachweise', 'weblinks', 'literatur',
  'über', 'see also', 'anmerkungen', 'bemerkungen', 'siehe auch', 'trivia',
  'zitate über', 'zitate von', 'posthum', 'briefe', 'quelle', 'nachweise',
  'anekdoten', 'filme', 'fernsehen', 'interviews', 'bekannte zitate',
  'zugeschrieben', 'zugeschriebene', 'zuschreibungen',
  'zugeschriebene zitate', 'falsch zugeschriebene zitate', 'apokryphe',
  'zweifelhaft', 'umstrittene zitate', 'nicht belegt', 'fälschungen',
  'vermutlich falsch', 'unsicher',
]);

function isMetaSection(heading) {
  const h = heading.toLowerCase().trim();
  if (META_SECTIONS.has(h)) return true;
  // Schließt alle "Über <Name>"-Abschnitte aus (3.-Person-Zitate).
  if (h.startsWith('über ') || h.startsWith('zitate über ')) return true;
  return false;
}

function parseWikitext(wikitext) {
  const results = [];
  let currentWork = null;
  let metaSectionLevel = null;
  const lines = wikitext.split('\n');

  for (const line of lines) {
    const headingMatch = line.match(/^(={2,4})\s*(.+?)\s*\1\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();
      if (isMetaSection(heading)) {
        currentWork = null;
        // Ein tieferer Unterabschnitt darf den übergeordneten Meta-Bereich
        // nicht verkürzen. Erst eine Überschrift auf derselben oder einer
        // höheren Ebene beendet die Sperre.
        metaSectionLevel = metaSectionLevel === null
          ? level
          : Math.min(metaSectionLevel, level);
      } else if (metaSectionLevel !== null && level > metaSectionLevel) {
        currentWork = null;
      } else {
        metaSectionLevel = null;
        currentWork = heading;
      }
      continue;
    }

    if (/^\*[^*]/.test(line)) {
      if (metaSectionLevel !== null) continue;
      let text = line
        .replace(/^\*\s*/, '')
        .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
        .replace(/\{\{[^}]*\}\}/g, '')
        .replace(/''+/g, '')
        .replace(/<ref[^>]*>.*?<\/ref>/gs, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      text = stripQuotationMarks(text);

      if (isVerseFragment(text)) continue;
      if (/https?:\/\//.test(text)) continue;
      if (text.length < 20) continue;
      if (text.length > 350) continue;
      if (/^\d+(\s*[–—-]\s*\d+)?$/.test(text)) continue;
      if (text.startsWith('→') || text.startsWith('↑')) continue;
      if (/^[Ss]\.\s*\d+/.test(text)) continue;
      if (/^\[\.{3}\]/.test(text)) continue;

      results.push({ text, workHint: currentWork });
    }
  }

  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// PD-Autorenliste Welle 4 — Fokus auf neue Autoren (†≤1955, verifiziert)
// ──────────────────────────────────────────────────────────────────────────────
//
// Sterbejahre verifiziert via Wikipedia/Wikidata.
// Einige Autoren der Wellen 1-3 ergänzt, falls dort noch Potenzial ist.
// NICHT enthalten: Bertolt Brecht †1956 (zu spät), Thomas Mann †1955 (grenzwertig,
// de.wikiquote hat kaum Aphorismen), Robert Musil †1942 (Prosa, wenig Aphorismen).
//
// Welle-4-Schwerpunkte:
//   - Österreichische Klassiker (Grillparzer, Ebner-Eschenbach, Nestroy, Raimund)
//   - Romantik (Brentano, Eichendorff, Chamisso, Tieck, Arnim, Wackenroder)
//   - Aufklärung/Klassik (Wieland, Klopstock, Herder, Hamann)
//   - Naturalismus/Jugendstil (Dehmel, Holz, Schnitzler, Hofmannsthal, Werfel)
//   - Expressionismus/Avantgarde (Heym, Trakl, Stadler, Toller, Lasker-Schüler)
//   - Wiener Moderne (Altenberg, Beer-Hofmann, Kraus schon in v1)
//   - Sozialdemokratie/Essayisten (Mehring, Toller, Luxemburg, Landauer)
//   - Sonstige (Rosa Luxemburg †1919, August Bebel †1913, Franz Mehring †1919)

const PD_AUTHORS_W4 = [
  // ── Österreichische Dramatiker und Erzähler ──
  { lemma: 'Johann Nestroy',              author: 'Johann Nestroy',              deathYear: 1862 },
  { lemma: 'Ferdinand Raimund',           author: 'Ferdinand Raimund',           deathYear: 1836 },
  { lemma: 'Arthur Schnitzler',           author: 'Arthur Schnitzler',           deathYear: 1931 },
  { lemma: 'Hugo von Hofmannsthal',       author: 'Hugo von Hofmannsthal',       deathYear: 1929 },
  { lemma: 'Peter Altenberg',             author: 'Peter Altenberg',             deathYear: 1919 },
  { lemma: 'Stefan Zweig',               author: 'Stefan Zweig',                deathYear: 1942 },
  { lemma: 'Joseph Roth',                author: 'Joseph Roth',                 deathYear: 1939 },
  { lemma: 'Robert Musil',               author: 'Robert Musil',                deathYear: 1942 },
  { lemma: 'Franz Werfel',               author: 'Franz Werfel',                deathYear: 1945 },
  { lemma: 'Ödön von Horváth',           author: 'Ödön von Horváth',            deathYear: 1938 },

  // ── Romantik (noch nicht in v1-3) ──
  { lemma: 'Clemens Brentano',           author: 'Clemens Brentano',            deathYear: 1842 },
  { lemma: 'Achim von Arnim',            author: 'Achim von Arnim',             deathYear: 1831 },
  { lemma: 'Ludwig Tieck',               author: 'Ludwig Tieck',                deathYear: 1853 },
  { lemma: 'Adelbert von Chamisso',      author: 'Adelbert von Chamisso',       deathYear: 1838 },
  { lemma: 'Ernst Theodor Amadeus Hoffmann', author: 'E. T. A. Hoffmann',       deathYear: 1822 },
  { lemma: 'Joseph von Eichendorff',     author: 'Joseph von Eichendorff',      deathYear: 1857 },
  { lemma: 'Friedrich de la Motte Fouqué', author: 'Friedrich de la Motte Fouqué', deathYear: 1843 },

  // ── Aufklärung und Klassik (Ergänzungen) ──
  { lemma: 'Christoph Martin Wieland',   author: 'Christoph Martin Wieland',    deathYear: 1813 },
  { lemma: 'Friedrich Gottlieb Klopstock', author: 'Friedrich Gottlieb Klopstock', deathYear: 1803 },
  { lemma: 'Johann Gottfried Herder',    author: 'Johann Gottfried Herder',     deathYear: 1803 },
  { lemma: 'Moses Mendelssohn',          author: 'Moses Mendelssohn',           deathYear: 1786 },
  { lemma: 'Friedrich Schlegel',         author: 'Friedrich Schlegel',          deathYear: 1829 },
  { lemma: 'August Wilhelm Schlegel',    author: 'August Wilhelm Schlegel',     deathYear: 1845 },

  // ── Realismus und Bürgerliche Epoche ──
  { lemma: 'Gottfried Keller',           author: 'Gottfried Keller',            deathYear: 1890 },
  { lemma: 'Conrad Ferdinand Meyer',     author: 'Conrad Ferdinand Meyer',      deathYear: 1898 },
  { lemma: 'Wilhelm Raabe',              author: 'Wilhelm Raabe',               deathYear: 1910 },
  { lemma: 'Annette von Droste-Hülshoff', author: 'Annette von Droste-Hülshoff', deathYear: 1848 },
  { lemma: 'Friedrich Rückert',          author: 'Friedrich Rückert',           deathYear: 1866 },
  { lemma: 'August von Platen-Hallermünde', author: 'August von Platen',        deathYear: 1835 },
  { lemma: 'Nikolaus Lenau',             author: 'Nikolaus Lenau',              deathYear: 1850 },
  { lemma: 'Eduard Mörike',              author: 'Eduard Mörike',               deathYear: 1875 },

  // ── Naturalismus und Jahrhundertwende ──
  { lemma: 'Gerhart Hauptmann',          author: 'Gerhart Hauptmann',           deathYear: 1946 },
  { lemma: 'Frank Wedekind',             author: 'Frank Wedekind',              deathYear: 1918 },
  { lemma: 'Richard Dehmel',             author: 'Richard Dehmel',              deathYear: 1920 },
  { lemma: 'Detlev von Liliencron',      author: 'Detlev von Liliencron',       deathYear: 1909 },

  // ── Expressionismus (Lyrik und Prosa) ──
  { lemma: 'Georg Heym',                 author: 'Georg Heym',                  deathYear: 1912 },
  { lemma: 'Georg Trakl',                author: 'Georg Trakl',                 deathYear: 1914 },
  { lemma: 'Ernst Toller',               author: 'Ernst Toller',                deathYear: 1939 },
  { lemma: 'Else Lasker-Schüler',        author: 'Else Lasker-Schüler',         deathYear: 1945 },
  { lemma: 'Ernst Stadler',              author: 'Ernst Stadler',               deathYear: 1914 },
  { lemma: 'Alfred Döblin',              author: 'Alfred Döblin',               deathYear: 1957 }, // †1957 → AUSGESCHLOSSEN, wird im Code gefiltert
  { lemma: 'Gottfried Benn',             author: 'Gottfried Benn',              deathYear: 1956 }, // †1956 → AUSGESCHLOSSEN

  // ── Politische Denker und Essayisten ──
  { lemma: 'Rosa Luxemburg',             author: 'Rosa Luxemburg',              deathYear: 1919 },
  { lemma: 'August Bebel',               author: 'August Bebel',                deathYear: 1913 },
  { lemma: 'Franz Mehring',              author: 'Franz Mehring',               deathYear: 1919 },
  { lemma: 'Gustav Landauer',            author: 'Gustav Landauer',             deathYear: 1919 },
  { lemma: 'Walther Rathenau',           author: 'Walther Rathenau',            deathYear: 1922 },
  { lemma: 'Georg Simmel',               author: 'Georg Simmel',                deathYear: 1918 },
  { lemma: 'Max Weber',                  author: 'Max Weber',                   deathYear: 1920 },
  { lemma: 'Wilhelm Dilthey',            author: 'Wilhelm Dilthey',             deathYear: 1911 },
  { lemma: 'Ludwig Feuerbach',           author: 'Ludwig Feuerbach',            deathYear: 1872 },

  // ── Schweizer Literatur ──
  { lemma: 'Carl Spitteler',             author: 'Carl Spitteler',              deathYear: 1924 },
  { lemma: 'Robert Walser',              author: 'Robert Walser',               deathYear: 1956 }, // †1956 → AUSGESCHLOSSEN

  // ── Sonstige deutschsprachige Klassiker ──
  { lemma: 'Matthias Claudius',          author: 'Matthias Claudius',           deathYear: 1815 },
  { lemma: 'Johann Peter Hebel',         author: 'Johann Peter Hebel',          deathYear: 1826 },
  { lemma: 'Christian Fürchtegott Gellert', author: 'Christian Fürchtegott Gellert', deathYear: 1769 },
  { lemma: 'Wilhelm Hauff',              author: 'Wilhelm Hauff',               deathYear: 1827 },
  { lemma: 'Ricarda Huch',               author: 'Ricarda Huch',               deathYear: 1947 },
  { lemma: 'Sigmund Freud',              author: 'Sigmund Freud',               deathYear: 1939 },
  { lemma: 'Ernst Mach',                 author: 'Ernst Mach',                  deathYear: 1916 },

  // ── Bestehende Autoren aus v1 (für Restpotenzial — Dedup filtert Bekanntes) ──
  { lemma: 'Johann Wolfgang von Goethe', author: 'Johann Wolfgang von Goethe',  deathYear: 1832 },
  { lemma: 'Friedrich Schiller',         author: 'Friedrich Schiller',          deathYear: 1805 },
  { lemma: 'Friedrich Nietzsche',        author: 'Friedrich Nietzsche',          deathYear: 1900 },
  { lemma: 'Immanuel Kant',              author: 'Immanuel Kant',               deathYear: 1804 },
  { lemma: 'Arthur Schopenhauer',        author: 'Arthur Schopenhauer',         deathYear: 1860 },
  { lemma: 'Heinrich Heine',             author: 'Heinrich Heine',              deathYear: 1856 },
  { lemma: 'Franz Kafka',                author: 'Franz Kafka',                 deathYear: 1924 },
  { lemma: 'Georg Christoph Lichtenberg', author: 'Georg Christoph Lichtenberg', deathYear: 1799 },
  { lemma: 'Gotthold Ephraim Lessing',   author: 'Gotthold Ephraim Lessing',   deathYear: 1781 },
  { lemma: 'Kurt Tucholsky',             author: 'Kurt Tucholsky',              deathYear: 1935 },
  { lemma: 'Rainer Maria Rilke',         author: 'Rainer Maria Rilke',          deathYear: 1926 },
  { lemma: 'Karl Kraus',                 author: 'Karl Kraus',                  deathYear: 1936 },
  { lemma: 'Marie von Ebner-Eschenbach', author: 'Marie von Ebner-Eschenbach', deathYear: 1916 },
  { lemma: 'Jean Paul',                  author: 'Jean Paul',                   deathYear: 1825 },
  { lemma: 'Friedrich Hebbel',           author: 'Friedrich Hebbel',            deathYear: 1863 },
  { lemma: 'Theodor Storm',              author: 'Theodor Storm',               deathYear: 1888 },
  { lemma: 'Georg Wilhelm Friedrich Hegel', author: 'Georg Wilhelm Friedrich Hegel', deathYear: 1831 },
  { lemma: 'Otto von Bismarck',          author: 'Otto von Bismarck',           deathYear: 1898 },
  { lemma: 'Wilhelm Busch',              author: 'Wilhelm Busch',               deathYear: 1908 },
];

// Copyright-Gate: Autoren †>1955 ausfiltern (absoluter Sicherheits-Check).
const PD_GATE_YEAR = 1955;
const FILTERED_AUTHORS = PD_AUTHORS_W4.filter(a => {
  if (a.deathYear > PD_GATE_YEAR) {
    console.log(`  [PD-Gate] AUSGESCHLOSSEN: ${a.author} †${a.deathYear} (>1955)`);
    return false;
  }
  return true;
});

// Lemma-Duplikate entfernen.
const UNIQUE_AUTHORS = (() => {
  const seen = new Set();
  return FILTERED_AUTHORS.filter(a => {
    if (seen.has(a.lemma)) return false;
    seen.add(a.lemma);
    return true;
  });
})();

// ──────────────────────────────────────────────────────────────────────────────
// Bestand-Loader: cultura_raw.json + alle bisherigen Erntedateien für Dedup
// ──────────────────────────────────────────────────────────────────────────────

function loadAllExistingTexts() {
  const texts = []; // Alle bekannten Zitat-Texte (norm'd für Dedup)
  const ids   = new Set();

  // 1. cultura_raw.json (Bestand)
  const rawPath = path.join(__dirname, '..', 'cultura_raw.json');
  try {
    const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    for (const c of data) {
      if (c.category === 'quote') {
        texts.push(c.name);
        ids.add(c.id);
      }
    }
    console.log(`Bestand cultura_raw.json: ${texts.length} Quotes`);
  } catch (e) {
    console.warn('  Warnung: cultura_raw.json nicht lesbar →', e.message);
  }

  // 2. Frühere Erntedateien (falls vorhanden) — flüchtig, als Dedup-Quelle.
  const prevFiles = [
    '/tmp/cultura_quote_cand_full.json',
    '/tmp/cultura_quote_v2_full.json',
    '/tmp/cultura_quote_v3_full.json',
    '/tmp/cultura_quote_v3.json',
  ];
  let prevCount = 0;
  for (const f of prevFiles) {
    try {
      const prev = JSON.parse(fs.readFileSync(f, 'utf8'));
      for (const c of prev) {
        if (c.name) { texts.push(c.name); prevCount++; }
        if (c.id)   ids.add(c.id);
      }
    } catch (_) {
      // Datei fehlt oder ungültig → still überspringen
    }
  }
  console.log(`Aus früheren Erntedateien geladen: ${prevCount} zusätzliche Texte (für Dedup)`);

  return { texts, ids };
}

// ──────────────────────────────────────────────────────────────────────────────
// ID-Generator
// ──────────────────────────────────────────────────────────────────────────────

function makeId(author, text, usedIds) {
  const authorPart = slug(author.split(' ').pop());
  const FILL = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'der', 'die',
    'das', 'ein', 'eine', 'und', 'oder', 'ist', 'war', 'hat', 'den', 'dem',
    'des', 'ist', 'nicht', 'mit', 'von', 'als', 'auf', 'an', 'zu', 'in']);
  const words = text.replace(/[^a-z\s]/gi, '').toLowerCase()
    .split(/\s+/).filter(w => w.length >= 3 && !FILL.has(w));
  const kwPart = words.slice(0, 2).map(w => w.slice(0, 8)).join('-');
  let id = authorPart + '-' + (kwPart || slug(text.slice(0, 20)));
  let attempt = id;
  let counter = 2;
  while (usedIds.has(attempt)) {
    attempt = id + '-' + counter++;
  }
  return attempt;
}

// ──────────────────────────────────────────────────────────────────────────────
// Struktur-Labels für work-Attribut-Filter
// ──────────────────────────────────────────────────────────────────────────────

const STRUCTURE_LABELS = new Set([
  'andere', 'andere werke', 'andere gedichte', 'andere gedichte und balladen',
  'zitate mit quellenangabe', 'quellenangaben',
  'stücke', 'aphorismen', 'letzte worte', 'fragmente', 'nachgelassenes',
  'briefe', 'briefe und fabeln', 'tagebücher', 'gesammelte werke', 'stufen',
  'überprüft', 'zugeschrieben', 'andere quellen',
]);

function cleanWork(workHint) {
  if (!workHint) return undefined;
  let w = workHint
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/''+/g, '')
    .replace(/^=+\s*|\s*=+$/g, '')
    .trim();
  const hasCommaList = (w.match(/,/g) || []).length >= 3;
  const isBezug = /zitate mit bezug/i.test(w);
  if (STRUCTURE_LABELS.has(w.toLowerCase()) || hasCommaList || isBezug) return undefined;
  if (w.length <= 1 || w.length >= 80) return undefined;
  return w;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hauptfunktion
// ──────────────────────────────────────────────────────────────────────────────

async function harvest() {
  console.log('=== Wikiquote-Welle-4-Harvest ===');
  console.log(`PD-Autoren nach Gate (†≤1955): ${UNIQUE_AUTHORS.length}`);

  const { texts: existingTexts, ids: existingIds } = loadAllExistingTexts();
  const usedIds = new Set(existingIds);

  let totalRaw    = 0;
  let droppedDedup  = 0;
  let droppedFilter = 0;
  let noPage        = 0;

  const authorStats = [];
  const candidates  = []; // Alle neuen Kandidaten (ungefilterter Volllauf)

  for (const { lemma, author, deathYear } of UNIQUE_AUTHORS) {
    process.stdout.write(`→ ${author} (†${deathYear})… `);
    const wikitext = await fetchWikitext(lemma);

    if (!wikitext) {
      console.log('keine Seite');
      authorStats.push({ author, deathYear, lemmaOk: false, raw: 0, new: 0 });
      noPage++;
      await sleep(300);
      continue;
    }

    const parsed = parseWikitext(wikitext);
    totalRaw += parsed.length;
    process.stdout.write(`${parsed.length} roh → `);

    let authorNew = 0;

    for (const { text, workHint } of parsed) {
      // Längenfilter
      if (text.length < 20 || text.length > 350) { droppedFilter++; continue; }
      // Abschnitte mit ausdrücklich unsicherer Zuschreibung nicht ernten.
      if (/(?:fälschlich|zweifelhaft|zugeschrieben|unbelegt)/i.test(workHint || '')) {
        droppedFilter++;
        continue;
      }

      // Dedup gegen Bestand + frühere Ernte
      const isDup = existingTexts.some(ex => overlapRatio(ex, text) >= 0.7);
      if (isDup) { droppedDedup++; continue; }

      // Dedup innerhalb dieses Laufs
      const isDupInRun = candidates.some(c => overlapRatio(c.name, text) >= 0.7);
      if (isDupInRun) { droppedDedup++; continue; }

      const id = makeId(author, text, usedIds);
      usedIds.add(id);

      const concept = {
        id,
        name: text,
        category: 'quote',
        quoteRights: { basis: 'de-original', originalLanguage: 'de' },
        attributes: {
          author,
          authorDeathYear: deathYear,
          ...(cleanWork(workHint) ? { work: cleanWork(workHint) } : {}),
        },
        sourceName: `Wikiquote – ${author}`,
        sourceUrl:  `https://de.wikiquote.org/wiki/${encodeURIComponent(lemma)}`,
        verifyNote: `Wortlaut aus de.wikiquote; deutsches Original; Todesjahr ${deathYear}.`,
      };

      candidates.push(concept);
      authorNew++;
    }

    console.log(`${authorNew} neu`);
    authorStats.push({ author, deathYear, lemmaOk: true, raw: parsed.length, new: authorNew });
    await sleep(400);
  }

  // ── Vollständige Ernte speichern ──
  const fullPath = '/tmp/cultura_quote_w4.json';
  writeJsonAtomic(fullPath, candidates);

  // ── Kuratierte Top-Auswahl: max. 10 pro Autor, Qualitätsfilter ──
  const qualFiltered = candidates.filter(c => {
    const t = c.name;
    if (t.length < 25 || t.length > 200) return false;     // Kompakte Aphorismen
    if (!/[.!?""„»«]$/.test(t)) return false;              // Abgeschlossener Satz
    if (/[\[\]]/.test(t)) return false;                    // Keine Auslassungszeichen
    if (/^[a-zäöüß]/.test(t)) return false;               // Kein Kleinbuchstaben-Start
    if (/\{\{/.test(t) || /\}\}/.test(t)) return false;   // Keine Template-Reste
    return true;
  });

  // Pro Autor nach Länge sortieren, max. 10 nehmen.
  const byAuthor = {};
  for (const c of qualFiltered) {
    const au = c.attributes.author;
    if (!byAuthor[au]) byAuthor[au] = [];
    byAuthor[au].push(c);
  }
  for (const au of Object.keys(byAuthor)) {
    byAuthor[au].sort((a, b) => a.name.length - b.name.length);
    byAuthor[au] = byAuthor[au].slice(0, 10);
  }

  // Round-Robin für Diversität.
  const MAX_TOP = 200;
  const selected = [];
  const queues = Object.values(byAuthor).filter(q => q.length > 0);
  let round = 0;
  while (selected.length < MAX_TOP) {
    let added = false;
    for (const q of queues) {
      if (round < q.length && selected.length < MAX_TOP) {
        selected.push(q[round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }

  const topPath = '/tmp/cultura_quote_w4_top.json';
  writeJsonAtomic(topPath, selected);

  // ── Report ──
  console.log('\n════════════════════════════════════════════════');
  console.log('Harvest-Report Welle 4');
  console.log('════════════════════════════════════════════════');
  console.log(`Autoren versucht:     ${UNIQUE_AUTHORS.length}`);
  console.log(`  Seite gefunden:     ${authorStats.filter(a => a.lemmaOk).length}`);
  console.log(`  Keine Seite/404:    ${noPage}`);
  console.log(`Rohzitate gesamt:     ${totalRaw}`);
  console.log(`  Dropped (Filter):   ${droppedFilter}`);
  console.log(`  Dropped (Dedup):    ${droppedDedup}`);
  console.log(`Kandidaten (voll):    ${candidates.length}`);
  console.log(`Kandidaten (Top):     ${selected.length}`);
  console.log(`\n=> Voll:  ${fullPath}`);
  console.log(`=> Top:   ${topPath}`);

  console.log('\nPro-Autor (neue Zitate):');
  for (const s of authorStats.filter(a => a.new > 0)) {
    console.log(`  ✓ ${s.author} †${s.deathYear}: roh=${s.raw}, neu=${s.new}`);
  }
  if (authorStats.some(a => !a.lemmaOk)) {
    console.log('\nKeine Seite gefunden:');
    for (const s of authorStats.filter(a => !a.lemmaOk)) {
      console.log(`  ✗ ${s.author} †${s.deathYear}`);
    }
  }

  console.log('\nStichproben (erste 8 der Top-Auswahl):');
  selected.slice(0, 8).forEach((c, i) => {
    console.log(`  ${i+1}. „${c.name.slice(0,70)}${c.name.length>70?'…':''}" — ${c.attributes.author}`);
  });
}

if (require.main === module) {
  harvest().catch(e => {
    console.error('FEHLER:', e.message, e.stack);
    process.exit(1);
  });
}

module.exports = { isMetaSection, parseWikitext };
