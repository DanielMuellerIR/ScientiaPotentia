/**
 * Generator für die Cultura-Domain (Kunst & Kultur).
 *
 * Liest die verifizierte, vereinheitlichte Faktenbasis aus
 * scripts/data_sources/cultura_raw.json (erzeugt von merge_cultura.js) und schreibt:
 *   - public/data/concepts_cultura.json  : Konzeptspeicher (Map key -> Konzept)
 *   - public/data/questions_cultura.json : generierte Multiple-Choice-Fragen
 *
 * Leitidee (wie Natura): Die Recherche/Verifikation ist die eigentliche Arbeit;
 * das Templating hier leitet nur mechanisch ab. Distraktoren stammen IMMER aus
 * derselben Kategorie und demselben Attribut -> plausibel, nicht trivial ausschließbar.
 *
 * Cultura-Besonderheiten gegenüber generate_natura.js:
 *   1. Werktitel-Selbstverräter: Viele Namen tragen den Urheber in Klammern
 *      ("David (Michelangelo)", "9. Sinfonie (Beethoven)"). Für creator-/
 *      composer-Fragen wird das Frage-Subjekt per beforeParen auf den reinen
 *      Titel gekürzt — und der Selbstverräter-Guard prüft IMMER den finalen
 *      Fragetext (nach der Kürzung). Steckt die Antwort trotzdem im Titel
 *      ("Beethoven – 5. Sinfonie"), wird die Frage verworfen.
 *   2. Slash-Werte ("Barock / Holländisches Goldenes Zeitalter") sind als
 *      korrekte Antwort gesperrt (mehrdeutig), als Distraktor aber erlaubt
 *      (gleiches Muster wie der STATUS_CANON-Skip in generate_natura.js).
 *   3. Jahres-Fragen nutzen einen eigenen Zahlen-Putz (cleanYear): nur positive
 *      3-4-stellige Ganzzahlen. Negative Jahre (v. Chr.) und Bereichs-Strings
 *      ("1503–1519") fallen damit automatisch heraus — deNum(-1340) wäre Unsinn.
 *      Jahre werden außerdem OHNE Tausenderpunkt formatiert ("1685", nicht "1.685").
 *   4. Fairness-Filter: Ein Distraktor, der die korrekte Antwort enthält oder in
 *      ihr enthalten ist ("Frankreich" vs. "Frankreich / Deutschland", "Gotik"
 *      vs. "Jugendstil / Neogotik"), wird aussortiert — sonst gäbe es zwei
 *      vertretbare Antworten.
 *   5. Generische Werktitel ("9. Sinfonie") sind für Komponist-Fragen gesperrt
 *      (viele Komponisten haben eine 9. Sinfonie -> mehrdeutig); als Titel-
 *      Antwort des EIGENEN Komponisten (forward) bleiben sie erlaubt, tauchen
 *      aber nicht als Distraktor auf.
 *   6. Reverse-Korrektheit: Bei Namens-Antworten ("Welches dieser Werke schuf X?")
 *      müssen alle Distraktor-Konzepte beim getesteten Attribut einen ANDEREN
 *      Wert haben — sonst wären mehrere Optionen richtig.
 *   Zitate durchlaufen zusätzlich scripts/audit_quote_rights.mjs. Der Generator
 *   setzt diese Rechteprüfung voraus und leitet daraus nur Quizfragen ab.
 *
 * Aufruf: node scripts/generate_cultura.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seededShuffle, pickBalanced, pickNumeric, numericDistractors } from './lib/quizrandom.js';
import { norm, deNum, optionKey, distinctOptionValues, revealsAnswerStrict as revealsAnswer } from './lib/generator_text.js';
import { isSpecificQuoteWork, artworkEraConflict } from './lib/answer_overlap.js';
import { buildImageMetadata } from '../src/utils/imageCredits.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'cultura_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_cultura.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_cultura.json');

const DOMAIN = 'cultura';

// --- kleine Helfer -------------------------------------------------------

/**
 * Wandelt einen Attributwert in eine saubere POSITIVE Zahl ODER null.
 * Akzeptiert echte Zahlen und rein numerische Strings (Punkt-Dezimal).
 * Negative Werte, Bereiche und Text -> null (werden übersprungen).
 */
function cleanNum(v) {
  if (typeof v === 'number') return (isFinite(v) && v > 0) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^[0-9]+([.,][0-9]+)?$/.test(t)) return Number(t.replace(',', '.'));
  }
  return null;
}

/**
 * Jahres-Putz: nur positive 3-4-stellige Ganzzahlen sind gültige Jahre für
 * numerische Fragen. Negative Jahre (v. Chr.), Bereiche ("1503–1519") und
 * "ca."-Angaben fallen heraus — nichts verfälschen, lieber keine Frage.
 */
function cleanYear(v) {
  if (typeof v === 'number') return (Number.isInteger(v) && v >= 100 && v <= 2100) ? v : null;
  if (typeof v === 'string' && /^\d{3,4}$/.test(v.trim())) return Number(v.trim());
  return null;
}

/** Jahre OHNE Tausenderpunkt formatieren ("1685", nicht "1.685"). */
const yearFmt = v => String(v);

// Alles ab der ersten Klammer abschneiden ("David (Michelangelo)" -> "David").
const beforeParen = s => String(s || '').split(' (')[0].trim();

/** Enthalten sich zwei Werte gegenseitig (normalisiert, ohne Leerzeichen)? */
function containsEitherWay(a, b) {
  const A = norm(a).replace(/ /g, ''), B = norm(b).replace(/ /g, '');
  if (!A || !B) return false;
  return A.includes(B) || B.includes(A);
}

// Generische nummerierte Werktitel ("9. Sinfonie"): als Frage-Subjekt oder
// Distraktor mehrdeutig (viele Komponisten haben eine), daher dort gesperrt.
const GENERIC_TITLE = /^\d+\.\s/;

// --- Distraktor-Auswahl ----------------------------------------------------

/**
 * k kategorische Distraktoren: erste abweichende Werte in Pool-Reihenfolge.
 * Fairness-Filter: Werte, die die korrekte Antwort enthalten (oder von ihr
 * enthalten werden), fliegen raus — sonst zwei vertretbare Antworten.
 */
function pickCategorical(correct, pool, k = 3, seed = String(correct)) {
  // `seed` ist die Konzept-ID der Frage; warum das noetig ist, steht bei
  // pickBalanced in ./lib/quizrandom.js.
  // längen-balanciert statt Pool-Reihenfolge: `.slice(0,k)` nahm sonst feste
  // erste-k Einträge → Längen-Bias (richtige Antwort fast immer längste/kürzeste).
  return pickBalanced(correct, distinctOptionValues(pool)
    .filter(v => optionKey(v) !== optionKey(correct))
    .filter(v => !containsEitherWay(v, correct)), k, seed);
}

/**
 * k numerische Distraktoren: die dem korrekten Wert NÄCHSTLIEGENDEN Zahlen aus
 * dem Pool (am verwechselbarsten), danach mit dem Template formatiert.
 */
// pickNumeric: jetzt zentral in ./lib/quizrandom.js (mit Proximity-Guard fuer Messgroessen).


/**
 * k Namens-Distraktoren für Reverse-Fragen. Reverse-Korrektheit: Es kommen nur
 * Konzepte in Frage, deren Wert beim getesteten Attribut sich vom Wert des
 * Frage-Konzepts unterscheidet (sonst wären mehrere Optionen richtig).
 * Namen mit Klammerzusatz ("Pietà (Michelangelo)") werden nachrangig gewählt,
 * weil die Klammer dem Rater Eliminations-Hinweise liefert.
 */
function pickNames(correctName, subjectValue, pool, k = 3, overlapValues = false) {
  const subjNorm = norm(subjectValue);
  const candidates = pool
    .filter(p => p.name !== correctName)
    .filter(p => norm(p.value) !== subjNorm)
    // Bei Urhebern sind „Michelangelo", „Michelangelo Buonarroti" und
    // „Michelangelo (zugeschrieben)" dieselbe bzw. eine überlappende Antwort.
    // Bei Werkstiteln wäre ein Teilstring dagegen kein Gleichheitsbeweis.
    .filter(p => !overlapValues || !containsEitherWay(p.value, subjectValue))
    .filter(p => !containsEitherWay(p.name, correctName));
  // Klammerfreie Namen zuerst, dann längen-balanciert (gegen „kürzeste raten"),
  // Gleichstände seeded gemischt (Variation + stabile Diffs).
  const cl = String(correctName).length;
  const shuffled = seededShuffle(candidates, correctName);
  shuffled.sort((a, b) => {
    const pa = a.name.includes('(') ? 1 : 0, pb = b.name.includes('(') ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return Math.abs(a.name.length - cl) - Math.abs(b.name.length - cl);
  });
  return [...new Set(shuffled.map(p => p.name))].slice(0, k);
}

// --- Faktenbasis laden ----------------------------------------------------
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Konzepte nach Kategorie gruppieren (für kategorie-interne Distraktoren).
const byCategory = {};
for (const c of raw) (byCategory[c.category] ||= []).push(c);

// --- Konzeptspeicher bauen --------------------------------------------------
// Key-Schema: "<domain>:<conceptId>" (z.B. cultura:mona-lisa).
const concepts = {};
for (const c of raw) {
  const key = `${DOMAIN}:${c.id}`;
  concepts[key] = {
    id: key,
    name: c.name,
    type: c.category,
    category: c.category,
    attributes: c.attributes,
    funFact: c.funFact || '',
    source: { name: c.sourceName, url: c.sourceUrl || '' },
    // Bild fürs spätere Museum + (optionale) Konzept-Illustration mitführen.
    image: buildImageMetadata(c)
  };
}

// --- Frage-Templates ---------------------------------------------------------
// kind: 'cat' (kategorisch), 'num' (numerisch, nutzt rohe Zahl), 'name' (Reverse:
// Antwort = Konzeptname; attr = Gruppierungs-Attribut für die Korrektheit).
// skip = optionaler Konzept-Filter; clean = Zahlen-Putz (Default cleanNum);
// poolFilter = Filter für Distraktor-Werte.
const templates = [
  // ==== Gemälde (artwork) ==================================================
  {
    category: 'artwork', attr: 'creator', kind: 'cat', type: 'cultura-artwork-creator', difficulty: 3,
    // beforeParen: falls ein Titel den Künstler in Klammern trägt, darf die
    // Frage ihn nicht mitliefern (Selbstverräter).
    prompt: c => `Wer schuf das Gemälde „${beforeParen(c.name)}“?`
  },
  {
    category: 'artwork', attr: 'location', kind: 'cat', type: 'cultura-artwork-location', difficulty: 3,
    // Bewusst "Wo befindet sich ... heute?" statt "In welchem Museum ...":
    // viele Antworten enthalten das Wort "Museum" — das würde der Guard sonst
    // fälschlich als Selbstverräter werten (und der Ort ist nicht immer ein Museum).
    prompt: c => `Wo befindet sich „${c.name}“ heute?`
  },
  {
    category: 'artwork', attr: 'era', kind: 'cat', type: 'cultura-artwork-era', difficulty: 3,
    prompt: c => `Welcher Epoche wird „${c.name}“ zugeordnet?`
  },
  {
    category: 'artwork', attr: 'medium', kind: 'cat', type: 'cultura-artwork-medium', difficulty: 2,
    prompt: c => `In welcher Technik wurde „${c.name}“ geschaffen?`
  },
  {
    category: 'artwork', attr: 'heightM', kind: 'num', type: 'cultura-artwork-height', difficulty: 3,
    prompt: c => `Wie hoch ist das Gemälde „${c.name}“?`,
    format: v => `${deNum(v)} m`
  },
  // Entstehungsjahr des Gemäldes: 22 von 25 Gemälden haben ein sauberes Jahr
  // (einteilige vierstellige Ganzzahl). Bereiche ("1503–1519") und "ca."-Angaben
  // werden durch cleanYear herausgefiltert.
  {
    category: 'artwork', attr: 'year', kind: 'num', type: 'cultura-artwork-year', difficulty: 3,
    prompt: c => `Aus welchem Jahr stammt das Gemälde „${c.name}"?`,
    clean: cleanYear, format: yearFmt
  },
  // Entstehungsland des Gemäldes: skip für Klammer-Werte wie
  // "Frankreich (Entstehung: Italien)" — mehrdeutig und nicht fair vergleichbar.
  // poolFilter sperrt dieselben Werte auch als Distraktoren, damit nicht
  // "Frankreich (Entstehung: Italien)" als Ausweichoption erscheint.
  {
    category: 'artwork', attr: 'country', kind: 'cat', type: 'cultura-artwork-country', difficulty: 2,
    prompt: c => `Aus welchem Land stammt das Gemälde „${c.name}"?`,
    skip: c => /\(/.test(String(c.attributes.country || '')),
    poolFilter: v => !/\(/.test(String(v))
  },
  // Reverse: vom Künstler aufs Werk (Distraktoren = Werke ANDERER Künstler).
  {
    category: 'artwork', attr: 'creator', kind: 'name', type: 'cultura-artwork-creator-rev', difficulty: 3,
    prompt: c => `Welches dieser Gemälde schuf ${beforeParen(String(c.attributes.creator))}?`,
    overlapValues: true
  },

  // ==== Skulpturen (sculpture) =============================================
  {
    category: 'sculpture', attr: 'creator', kind: 'cat', type: 'cultura-sculpture-creator', difficulty: 3,
    prompt: c => `Wer schuf die Skulptur „${beforeParen(c.name)}“?`,
    // Anonyme Schöpfer ("Unbekannte Hofhandwerker") ergeben keine sinnvolle
    // Urheber-Frage -> überspringen.
    skip: c => /unbekannt/i.test(String(c.attributes.creator || ''))
  },
  {
    category: 'sculpture', attr: 'location', kind: 'cat', type: 'cultura-sculpture-location', difficulty: 3,
    prompt: c => `Wo befindet sich „${c.name}“ heute?`
  },
  {
    category: 'sculpture', attr: 'era', kind: 'cat', type: 'cultura-sculpture-era', difficulty: 3,
    prompt: c => `Welcher Epoche wird „${c.name}“ zugeordnet?`
  },
  {
    category: 'sculpture', attr: 'material', kind: 'cat', type: 'cultura-sculpture-material', difficulty: 2,
    prompt: c => `Aus welchem Material besteht „${c.name}“?`
  },
  {
    category: 'sculpture', attr: 'heightM', kind: 'num', type: 'cultura-sculpture-height', difficulty: 3,
    prompt: c => `Wie hoch ist die Skulptur „${c.name}“?`,
    format: v => `${deNum(v)} m`
  },
  {
    category: 'sculpture', attr: 'creator', kind: 'name', type: 'cultura-sculpture-creator-rev', difficulty: 3,
    prompt: c => `Welche dieser Skulpturen schuf ${beforeParen(String(c.attributes.creator))}?`,
    skip: c => /unbekannt/i.test(String(c.attributes.creator || '')),
    overlapValues: true
  },
  // Entstehungsland der Skulptur: Slash-Werte ("Italien / Vatikan",
  // "Griechenland / Rom") sind mehrdeutig -> skip. Klammer-Werte ("Griechenland
  // (gefunden auf Milos)") ebenfalls -> skip; 16 von 19 Skulpturen bleiben.
  // poolFilter entfernt dieselben Ambiguitäten auch aus dem Distraktor-Pool.
  {
    category: 'sculpture', attr: 'country', kind: 'cat', type: 'cultura-sculpture-country', difficulty: 2,
    prompt: c => `Aus welchem Land stammt die Skulptur „${beforeParen(c.name)}"?`,
    skip: c => /\//.test(String(c.attributes.country || '')) || /\(/.test(String(c.attributes.country || '')),
    poolFilter: v => !/\//.test(String(v)) && !/\(/.test(String(v))
  },
  // Entstehungsjahr der Skulptur: 11 von 19 Skulpturen haben ein sauberes
  // Jahr (antike Datierungen v. Chr. und Bereichs-Strings fallen heraus).
  {
    category: 'sculpture', attr: 'year', kind: 'num', type: 'cultura-sculpture-year', difficulty: 4,
    prompt: c => `In welchem Jahr entstand die Skulptur „${beforeParen(c.name)}"?`,
    clean: cleanYear, format: yearFmt
  },

  // ==== Bauwerke (architecture) ============================================
  {
    category: 'architecture', attr: 'era', kind: 'cat', type: 'cultura-architecture-era', difficulty: 3,
    prompt: c => `Welcher Epoche wird das Bauwerk „${c.name}“ zugerechnet?`
  },
  {
    category: 'architecture', attr: 'country', kind: 'cat', type: 'cultura-architecture-country', difficulty: 2,
    prompt: c => `In welchem Land steht das Bauwerk „${c.name}“?`
  },
  {
    category: 'architecture', attr: 'style', kind: 'cat', type: 'cultura-architecture-style', difficulty: 4,
    prompt: c => `Welchem Baustil wird „${c.name}“ zugerechnet?`
  },
  {
    category: 'architecture', attr: 'material', kind: 'cat', type: 'cultura-architecture-material', difficulty: 3,
    prompt: c => `Aus welchem Material wurde „${c.name}“ hauptsächlich errichtet?`
  },
  {
    category: 'architecture', attr: 'architect', kind: 'cat', type: 'cultura-architecture-architect', difficulty: 4,
    prompt: c => `Wer entwarf das Bauwerk „${c.name}“?`,
    // Nur eine Teilmenge hat einen echten Architekten: antike/anonyme Bauten
    // (kein Wert), Bauherren-Dynastien (Slash-Wert -> globaler Skip) und reine
    // Initiatoren (Maurice de Sully war Bischof, nicht Architekt) überspringen.
    skip: c => /\(initiator\)/i.test(String(c.attributes.architect || ''))
  },

  // Standort des Bauwerks: 23 von 25 Bauwerken haben einen eindeutigen Ort;
  // die Einträge sind je Bauwerk einzigartig (kein Duplikat), daher braucht der
  // Distraktor-Pool mindestens 3 ANDERE eindeutige Orte. Slash-Werte überspringen.
  {
    category: 'architecture', attr: 'location', kind: 'cat', type: 'cultura-architecture-location', difficulty: 2,
    prompt: c => `Wo steht das Bauwerk „${c.name}"?`,
    skip: c => /\//.test(String(c.attributes.location || ''))
  },
  // Baujahre nur mit dokumentierter Bedeutung abfragen: Ein einzelnes Jahr
  // kann sowohl Baubeginn als auch Fertigstellung bedeuten.
  {
    category: 'architecture', attr: 'year', kind: 'num', type: 'cultura-architecture-year', difficulty: 4,
    skip: c => !['start', 'completion'].includes(c.attributes.yearKind),
    prompt: c => c.attributes.yearKind === 'start'
      ? `In welchem Jahr begann der Bau von „${c.name}"?`
      : `In welchem Jahr wurde „${c.name}" fertiggestellt?`,
    clean: cleanYear, format: yearFmt
  },
  // Höhe des Bauwerks: 14 von 25 Bauwerken haben einen heightM-Wert; alle sind
  // saubere positive Zahlen (cleanNum). Format: "330 m".
  {
    category: 'architecture', attr: 'heightM', kind: 'num', type: 'cultura-architecture-height', difficulty: 3,
    prompt: c => `Wie hoch ist das Bauwerk „${c.name}"?`,
    format: v => `${deNum(v)} m`
  },

  // ==== Kunstrichtungen (art_movement) =====================================
  {
    category: 'art_movement', attr: 'originCountry', kind: 'cat', type: 'cultura-artmovement-country', difficulty: 3,
    prompt: c => `In welchem Land entstand die Kunstrichtung ${beforeParen(c.name)}?`,
    // Mehrländer-Aufzählungen ("England, Frankreich, Deutschland") sind als
    // korrekte Antwort mehrdeutig -> nur Einzelländer fragen.
    skip: c => /,/.test(String(c.attributes.originCountry || ''))
  },
  {
    category: 'art_movement', attr: 'startYear', kind: 'num', type: 'cultura-artmovement-year', difficulty: 4,
    prompt: c => `In welchem Jahr wurde die Kunstrichtung ${beforeParen(c.name)} begründet?`,
    clean: cleanYear, format: yearFmt
  },

  // ==== Literaturepochen (literary_movement) ===============================
  // Merkmale und Hauptvertreter der Epochen: bewusst nur als Gegenrichtung.
  // Die Freitexte sind 18 bis 184 Zeichen lang; als Antwortoption wäre die
  // richtige Lösung über ihre Länge erratbar. Als Hinweis im Fragetext ist das
  // unschädlich, die Antwort ist dann der Epochenname.
  {
    category: 'art_movement', attr: 'characteristics', kind: 'name', type: 'cultura-artmovement-characteristics-rev', difficulty: 3,
    prompt: c => `Welche Kunstrichtung ist durch folgende Merkmale gekennzeichnet?\n„${c.attributes.characteristics}“`
  },
  {
    category: 'art_movement', attr: 'mainRepresentatives', kind: 'name', type: 'cultura-artmovement-representatives-rev', difficulty: 3,
    prompt: c => `Welcher Kunstrichtung werden diese Namen zugerechnet?\n„${c.attributes.mainRepresentatives}“`
  },
  {
    category: 'literary_movement', attr: 'originCountry', kind: 'cat', type: 'cultura-litmovement-country', difficulty: 3,
    prompt: c => `In welchem Land entstand die Literaturepoche ${beforeParen(c.name)}?`,
    skip: c => /,/.test(String(c.attributes.originCountry || ''))
  },
  {
    category: 'literary_movement', attr: 'characteristics', kind: 'name', type: 'cultura-litmovement-characteristics-rev', difficulty: 3,
    prompt: c => `Welche Literaturepoche ist durch folgende Merkmale gekennzeichnet?\n„${c.attributes.characteristics}“`
  },
  {
    category: 'literary_movement', attr: 'mainRepresentatives', kind: 'name', type: 'cultura-litmovement-representatives-rev', difficulty: 3,
    prompt: c => `Welcher Literaturepoche werden diese Autoren zugerechnet?\n„${c.attributes.mainRepresentatives}“`
  },
  {
    category: 'literary_movement', attr: 'startYear', kind: 'num', type: 'cultura-litmovement-year', difficulty: 4,
    // "Um welches Jahr": Epochenanfänge sind naturgemäß ungefähre Angaben.
    prompt: c => `Um welches Jahr begann die Literaturepoche ${beforeParen(c.name)}?`,
    clean: cleanYear, format: yearFmt
  },

  // ==== Komponisten (composer) =============================================
  {
    category: 'composer', attr: 'nationality', kind: 'cat', type: 'cultura-composer-nationality', difficulty: 2,
    prompt: c => `Welche Nationalität hatte ${c.name}?`
  },
  {
    category: 'composer', attr: 'era', kind: 'cat', type: 'cultura-composer-era', difficulty: 3,
    prompt: c => `Welcher Musikepoche wird ${c.name} zugeordnet?`
  },
  {
    category: 'composer', attr: 'notableWork', kind: 'cat', type: 'cultura-composer-work', difficulty: 3,
    prompt: c => `Welches dieser Werke ist ein Hauptwerk von ${c.name}?`,
    // Generische Titel ("9. Sinfonie") nicht als Distraktor anbieten: andere
    // Komponisten haben ebenfalls eine 9. Sinfonie -> Distraktor wäre strittig.
    // Als korrekte Antwort des EIGENEN Komponisten bleibt der Titel eindeutig.
    poolFilter: v => !GENERIC_TITLE.test(String(v))
  },
  {
    category: 'composer', attr: 'birthYear', kind: 'num', type: 'cultura-composer-birthyear', difficulty: 4,
    prompt: c => `In welchem Jahr wurde ${c.name} geboren?`,
    clean: cleanYear, format: yearFmt
  },
  // Sterbejahr des Komponisten: alle 32 Komponisten haben einen deathYear-Wert.
  // Ergänzt birthYear und gibt zwei verschiedene Jahreszahl-Fragen pro Komponist.
  // Fairness: birthYear und deathYear eines Komponisten unterscheiden sich
  // deutlich genug, dass kein Selbstverräter-Problem entsteht.
  {
    category: 'composer', attr: 'deathYear', kind: 'num', type: 'cultura-composer-deathyear', difficulty: 4,
    prompt: c => `In welchem Jahr starb ${c.name}?`,
    clean: cleanYear, format: yearFmt
  },
  // Reverse: vom Hauptwerk auf den Komponisten (laut Plan, diff 3). Generische
  // Titel überspringen — “Von wem stammt die 9. Sinfonie?” wäre mehrdeutig.
  {
    category: 'composer', attr: 'notableWork', kind: 'name', type: 'cultura-composer-work-rev', difficulty: 3,
    prompt: c => `Von welchem Komponisten stammt das Werk „${c.attributes.notableWork}”?`,
    skip: c => GENERIC_TITLE.test(String(c.attributes.notableWork || ''))
  },

  // ==== Kompositionen (composition) ========================================
  // Reverse: Von welchem Komponisten stammt diese Komposition? (kind=name)
  // Distraktoren = Kompositionen ANDERER Komponisten (pickNames-Korrektheit).
  // Beethoven und Mozart haben je 2 Werke im Pool — das ist kein Problem, da
  // pickNames nur Werke mit ANDEREM composer-Wert als Distraktoren zulässt.
  // Generische Titel ("9. Sinfonie") überspringen: zu mehrdeutig als Frage-Subjekt.
  {
    category: 'composition', attr: 'composer', kind: 'name', type: 'cultura-composition-composer-rev', difficulty: 3,
    prompt: c => `Welche dieser Kompositionen stammt von ${String(c.attributes.composer)}?`,
    skip: c => GENERIC_TITLE.test(beforeParen(c.name)),
    overlapValues: true
  },
  {
    category: 'composition', attr: 'composer', kind: 'cat', type: 'cultura-composition-composer', difficulty: 2,
    prompt: c => `Wer komponierte das Werk „${beforeParen(c.name)}“?`,
    // Nach der Klammer-Kürzung bliebe von "9. Sinfonie (Beethoven)" nur der
    // generische Titel "9. Sinfonie" übrig — als Komponist-Frage mehrdeutig
    // (Mozart, Haydn, Dvořák ... haben ebenfalls eine 9. Sinfonie) -> skip.
    skip: c => GENERIC_TITLE.test(beforeParen(c.name))
  },
  {
    category: 'composition', attr: 'genre', kind: 'cat', type: 'cultura-composition-genre', difficulty: 2,
    prompt: c => `Welcher Gattung gehört „${c.name}“ an?`
  },
  // Musikepoche: zehn kurze, gleichförmige Werte — die klassische Einordnungsfrage.
  // Lebensdaten der Komponisten: alle Werte tragen dasselbe Format „1685–1750",
  // die Optionen sind daher gleich lang. Geburts- und Todesjahr werden im Panel
  // ausgeblendet, solange danach gefragt wird (LEAKY_SIBLINGS).
  {
    category: 'composer', attr: 'lifespan', kind: 'cat', type: 'cultura-composer-lifespan', difficulty: 4,
    prompt: c => `In welchen Jahren lebte ${c.name}?`
  },
  {
    category: 'composition', attr: 'era', kind: 'cat', type: 'cultura-composition-era', difficulty: 2,
    prompt: c => `Welcher Musikepoche wird „${beforeParen(c.name)}“ zugerechnet?`,
    skip: c => GENERIC_TITLE.test(beforeParen(c.name))
  },
  {
    category: 'composition', attr: 'year', kind: 'num', type: 'cultura-composition-year', difficulty: 3,
    // Neutral "stammt aus": die Quell-Jahre mischen Uraufführung/Erscheinen/
    // Widmung — ein präziseres Verb würde Genauigkeit nur vortäuschen.
    // Voller Name inkl. Klammer ist hier erwünscht: "(Beethoven)" verrät kein
    // Jahr, macht den Titel aber eindeutig.
    prompt: c => `Aus welchem Jahr stammt das Werk „${c.name}“?`,
    clean: cleanYear, format: yearFmt
  },

  // ==== Literatur (literature) =============================================
  {
    category: 'literature', attr: 'author', kind: 'cat', type: 'cultura-literature-author', difficulty: 2,
    prompt: c => `Wer schrieb „${beforeParen(c.name)}“?`
  },
  {
    category: 'literature', attr: 'language', kind: 'cat', type: 'cultura-literature-language', difficulty: 2,
    prompt: c => `In welcher Sprache wurde „${c.name}“ ursprünglich verfasst?`
  },
  {
    category: 'literature', attr: 'genre', kind: 'cat', type: 'cultura-literature-genre', difficulty: 3,
    prompt: c => `Welcher Gattung gehört „${c.name}“ an?`
  },
  {
    category: 'literature', attr: 'year', kind: 'num', type: 'cultura-literature-year', difficulty: 3,
    prompt: c => `Aus welchem Jahr stammt „${c.name}“?`,
    clean: cleanYear, format: yearFmt
  },
  // Literaturepoche: 18 von 26 Werken haben einen eindeutigen (kein Slash)
  // era-Wert; 11 unique Epochen geben genug Distraktoren für fair 4-Option-Fragen.
  // poolFilter sperrt Slash-Werte auch als Distraktoren — "Renaissance /
  // Elisabethanisches Zeitalter" wäre kein fairer Ausweich-Distraktor.
  {
    category: 'literature', attr: 'era', kind: 'cat', type: 'cultura-literature-era', difficulty: 3,
    prompt: c => `Welcher literarischen Epoche gehört „${c.name}" an?`,
    // Slash-Werte ("Renaissance / Elisabethanisches Zeitalter") sind mehrdeutig.
    skip: c => /\//.test(String(c.attributes.era || '')),
    poolFilter: v => !/\//.test(String(v))
  },
  // Reverse: vom Autor aufs Werk (Distraktoren = Werke ANDERER Autoren; bei
  // Autoren mit mehreren Werken im Pool stellt pickNames die Korrektheit sicher).
  {
    category: 'literature', attr: 'author', kind: 'name', type: 'cultura-literature-author-rev', difficulty: 3,
    prompt: c => `Welches dieser Werke schrieb ${beforeParen(String(c.attributes.author))}?`,
    overlapValues: true
  },

  // ==== Genre-Literatur (genre_fiction) — Populärliteratur =================
  // SF/Fantasy/Horror/Krimi als EIGENE Kategorie statt in literature: so bleiben
  // die Distraktor-Pools genre-intern (die Autor-Frage zu „Der Wüstenplanet"
  // bekommt SF-Autoren als Distraktoren, nicht Goethe/Molière). Datenmodell wie
  // literature: author, year, genre (festes 5er-Vokabular), language; optional
  // series (Reihe/Zyklus — fehlende Attribute überspringt die Template-Schleife
  // automatisch). Mehrbuch-Reihen als EIN Konzept („Scheibenwelt", „Perry
  // Rhodan") tragen startYear statt year und bekommen eigene Formulierungen —
  // „Wer schrieb ‚Foundation-Zyklus'?" wäre schief, ein Zyklus „erscheint"
  // auch nicht in einem Jahr.
  {
    category: 'genre_fiction', attr: 'author', kind: 'cat', type: 'cultura-genrefic-author', difficulty: 2,
    prompt: c => `Wer schrieb „${beforeParen(c.name)}“?`,
    skip: c => c.attributes.startYear !== undefined
  },
  {
    category: 'genre_fiction', attr: 'author', kind: 'cat', type: 'cultura-genrefic-series-author', difficulty: 2,
    prompt: c => `Von wem stammt die Reihe „${beforeParen(c.name)}“?`,
    skip: c => c.attributes.startYear === undefined
  },
  {
    category: 'genre_fiction', attr: 'startYear', kind: 'num', type: 'cultura-genrefic-startyear', difficulty: 3,
    prompt: c => `In welchem Jahr startete die Reihe „${c.name}“?`,
    clean: cleanYear, format: yearFmt
  },
  {
    category: 'genre_fiction', attr: 'language', kind: 'cat', type: 'cultura-genrefic-language', difficulty: 2,
    prompt: c => `In welcher Sprache wurde „${c.name}“ ursprünglich verfasst?`
  },
  {
    category: 'genre_fiction', attr: 'genre', kind: 'cat', type: 'cultura-genrefic-genre', difficulty: 2,
    prompt: c => `Welchem Genre ist „${c.name}“ zuzuordnen?`
  },
  {
    category: 'genre_fiction', attr: 'year', kind: 'num', type: 'cultura-genrefic-year', difficulty: 3,
    // "erschien im Original": bei übersetzten Werken ist das Original-Jahr
    // gemeint, nicht die deutsche Ausgabe (so auch geerntet).
    prompt: c => `In welchem Jahr erschien „${c.name}“ im Original?`,
    clean: cleanYear, format: yearFmt
  },
  {
    category: 'genre_fiction', attr: 'series', kind: 'cat', type: 'cultura-genrefic-series', difficulty: 3,
    prompt: c => `Zu welcher Reihe gehört „${c.name}“?`
  },
  // Reverse: vom Autor aufs Werk (wie cultura-literature-author-rev).
  {
    category: 'genre_fiction', attr: 'author', kind: 'name', type: 'cultura-genrefic-author-rev', difficulty: 3,
    prompt: c => `Welches dieser Werke schrieb ${beforeParen(String(c.attributes.author))}?`,
    overlapValues: true
  },
  // ==== Zitate (quote) — ausschließlich gemeinfreie deutschsprachige Klassiker.
  // Datenmodell: name = der Zitattext selbst (ohne äußere Anführungszeichen);
  // die typografische Anführung setzt jeweils der Prompt. Attribute: author, work,
  // year (+ optional completionStem/completionAnswer für die Vervollständigung).
  // Das PD-Gate (Autor †≤1955) wird HARVEST-seitig erzwungen, nicht hier.
  {
    // (1) Zitat -> Autor. Distraktoren = andere Klassiker-Autoren aus dem Pool.
    category: 'quote', attr: 'author', kind: 'cat', type: 'cultura-quote-author', difficulty: 3,
    prompt: c => `Von welchem Autor stammt das Zitat: „${c.name}“?`
  },
  {
    // (2) Zitat -> Werk. Nur Zitate mit eindeutigem Werk (sonst Skip).
    category: 'quote', attr: 'work', kind: 'cat', type: 'cultura-quote-work', difficulty: 4,
    // Sammelbezeichnungen wie „Sonstige" oder „Anderes" sind Restekategorien
    // des Datenmodells, kein Werktitel. Als Lösung machen sie die Frage
    // unbeantwortbar; zehn veröffentlichte Fragen waren so (CodeQA 2026-09-03).
    skip: c => !isSpecificQuoteWork(c),
    prompt: c => `Aus welchem Werk stammt das Zitat: „${c.name}“?`
  },
  {
    // (3) Reverse: Werk(+Autor) -> welches Zitat? correct = Zitattext (c.name).
    // pickNames stellt über attr=work sicher, dass Distraktor-Zitate aus ANDEREN
    // Werken stammen (sonst mehrere richtige Optionen).
    category: 'quote', attr: 'work', kind: 'name', type: 'cultura-quote-text', difficulty: 4,
    skip: c => !isSpecificQuoteWork(c),
    prompt: c => `Welches Zitat stammt aus „${c.attributes.work}“${c.attributes.author ? ` von ${beforeParen(String(c.attributes.author))}` : ''}?`
  },
  {
    // (4) Zitat vervollständigen. Nur Zitate mit Stamm+Fortsetzung (sonst Skip).
    // Distraktoren = Fortsetzungen anderer Zitate.
    category: 'quote', attr: 'completionAnswer', kind: 'cat', type: 'cultura-quote-complete', difficulty: 2,
    skip: c => !c.attributes.completionStem || !c.attributes.completionAnswer,
    prompt: c => `Vervollständige das Zitat: „${c.attributes.completionStem} …”`
  },

  // ==== Gemälde (artwork) — Breite =========================================
  // Ergänzt das bestehende heightM-Template. Alle 25 Gemälde haben einen widthM-
  // Wert; die Werte liegen zwischen 0,31 m und 8,8 m — breit genug gestreut,
  // um nahegelegene Distraktoren als plausibel (aber abgrenzbar) zu wählen.
  {
    category: 'artwork', attr: 'widthM', kind: 'num', type: 'cultura-artwork-width', difficulty: 3,
    prompt: c => `Wie breit ist das Gemälde „${c.name}”?`,
    format: v => `${deNum(v)} m`
  },

  // ==== Literaturepochen (literary_movement) — Endjahr =====================
  // Spiegelt das bestehende litmovement-year-Template (Anfangsjahr). 24 von 29
  // Literaturbewegungen haben ein sauberes endYear (Number). Der Pool liefert
  // 24 verschiedene Jahreszahlen — ausreichend Distraktoren.
  {
    category: 'literary_movement', attr: 'endYear', kind: 'num', type: 'cultura-litmovement-endyear', difficulty: 4,
    prompt: c => `Um welches Jahr endete die Literaturepoche ${beforeParen(c.name)}?`,
    clean: cleanYear, format: yearFmt
  },

  // ==== Kunstrichtungen (art_movement) — Zeitraum ==========================
  // period ist ein Bereichs-String (“ca. 1300–1600”) und daher NICHT als
  // numerischer Wert abfragbar. Als kategorisches Attribut eignet er sich gut:
  // jede Epoche hat einen eindeutigen Zeitraum, 26 verschiedene Werte bilden
  // einen plausiblen Distraktor-Pool (Rater muss Zeiträume zuordnen können).
  // Slash-Werte und Bereiche werden NICHT durch cleanYear gefiltert, da der
  // Wert hier als ganzer String verglichen wird (kind='cat').
  {
    category: 'art_movement', attr: 'period', kind: 'cat', type: 'cultura-artmovement-period', difficulty: 3,
    prompt: c => `In welchem Zeitraum existierte die Kunstrichtung ${beforeParen(c.name)}?`
  },

  // ==== Literaturepochen (literary_movement) — Zeitraum ====================
  // Analoges Template zu art_movement/period für Literaturbewegungen.
  // 26 Epochen (Mischung aus art_movement + literary_movement teilen den Wert),
  // hier nur literary_movement-Konzepte befragt; Distraktoren = andere
  // Epochen-Zeiträume derselben Kategorie.
  {
    category: 'literary_movement', attr: 'period', kind: 'cat', type: 'cultura-litmovement-period', difficulty: 3,
    prompt: c => `In welchem Zeitraum existierte die Literaturepoche ${beforeParen(c.name)}?`
  }
];

// --- Fragen generieren ---------------------------------------------------
const questions = [];
const skipped = {};   // Skip-Statistik je Grund (für den Abschluss-Bericht)
function countSkip(tpl, reason) {
  (skipped[tpl.type] ||= {});
  skipped[tpl.type][reason] = (skipped[tpl.type][reason] || 0) + 1;
}

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];
  const clean = tpl.clean || cleanNum;

  // Distraktor-Pools je Template einmal aufbauen.
  let catPool = [];    // kategorische Werte (kind='cat')
  let numPool = [];    // rohe Zahlen (kind='num')
  let namePool = [];   // { name, value } für Reverse-Fragen (kind='name')
  for (const c of conceptsInCat) {
    if (['cultura-quote-work', 'cultura-quote-text', 'cultura-architecture-year'].includes(tpl.type)
      && tpl.skip && tpl.skip(c)) continue;
    const v = c.attributes[tpl.attr];
    if (v === undefined || v === null || v === '') continue;
    if (tpl.kind === 'name') {
      namePool.push({ name: c.name, value: String(v) });
    } else if (tpl.kind === 'num') {
      const n = clean(v);
      if (n !== null) numPool.push(n);
    } else { // 'cat'
      if (!tpl.poolFilter || tpl.poolFilter(v)) catPool.push(v);
    }
  }

  // Faire Fragen brauchen einen Mindest-Pool: unter 3 Einträgen gäbe es
  // höchstens 1 Distraktor -> ganzes Template überspringen und melden.
  const poolSize = tpl.kind === 'name' ? namePool.length
    : tpl.kind === 'num' ? numPool.length : catPool.length;
  if (poolSize < 3) {
    countSkip(tpl, `Pool zu klein (${poolSize})`);
    continue;
  }

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) { countSkip(tpl, 'Template-Skip (mehrdeutig/anonym/generisch)'); continue; }

    const rawValue = c.attributes[tpl.attr];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    // Korrekte Antwort + Distraktoren bestimmen.
    let correct, distractors;
    if (tpl.kind === 'name') {
      correct = c.name;
      distractors = pickNames(correct, String(rawValue), namePool, 3, tpl.overlapValues);
    } else if (tpl.kind === 'num') {
      const n = clean(rawValue);
      if (n === null) { countSkip(tpl, 'kein sauberer Zahlenwert (Bereich/v. Chr./Text)'); continue; }
      correct = tpl.format(n);
      // Größenordnungs-Distraktoren bei über ≥2 Größenordnungen streuenden Maßen
      // (z.B. Skulpturhöhe 0,1–180 m); Jahre/enge Maße bleiben auf Nachbarwert.
      distractors = numericDistractors(n, numPool, tpl.format,
        { attribute: tpl.attr, seed: c.id });
    } else { // 'cat'
      // Slash-Werte ("Barock / Holländisches Goldenes Zeitalter") und
      // Sammel-Angaben ("verschiedene Dynastien") sind als korrekte Antwort
      // mehrdeutig -> Frage überspringen. Als Distraktor bleiben sie erlaubt.
      if (/\//.test(String(rawValue)) || /verschiedene/i.test(String(rawValue))) {
        countSkip(tpl, 'mehrdeutiger Wert (Slash/Sammelangabe)');
        continue;
      }
      if (tpl.poolFilter && !tpl.poolFilter(rawValue)) { countSkip(tpl, 'poolFilter'); continue; }
      correct = String(rawValue);
      const pool = tpl.type === 'cultura-artwork-era'
        ? catPool.filter(value => !artworkEraConflict(correct, value)) : catPool;
      distractors = pickCategorical(correct, pool, 3, c.id);
    }

    // Selbstverräter: Guard prüft den FINALEN Fragetext (nach beforeParen-
    // Kürzung) gegen die Antwort. Steckt die Antwort im Text -> verwerfen.
    const promptText = tpl.prompt(c);
    if (revealsAnswer(promptText, correct)) { countSkip(tpl, 'Selbstverräter (Antwort im Fragetext)'); continue; }

    // Faire Frage braucht mindestens 2 Distraktoren (3 Optionen).
    if (distractors.length < 2) { countSkip(tpl, `zu wenige Distraktoren (${distractors.length})`); continue; }

    const options = [correct, ...distractors];

    questions.push({
      id: `q_${DOMAIN}_${c.id}_${tpl.type}`,
      entityId: `${DOMAIN}:${c.id}`,
      entityType: c.category,
      type: tpl.type,
      difficulty: tpl.difficulty,
      prompt: promptText,
      correctAnswer: correct,
      options, // Quiz mischt die Reihenfolge zur Laufzeit
      // Selbstverräter-Guard im Visual: getestetes Attribut bzw. Reverse-Namensfrage.
      testedAttribute: tpl.kind === 'name' ? null : tpl.attr,
      answerIsName: tpl.kind === 'name',
      silhouetteSvgPath: null,
      mapTargetId: null
    });
  }
}

// --- schreiben -----------------------------------------------------------
writeFileSync(CONCEPTS_OUT, JSON.stringify(concepts, null, 2), 'utf8');
writeFileSync(QUESTIONS_OUT, JSON.stringify(questions, null, 2), 'utf8');

// Statistik für die Konsole.
const byType = {}, byDiff = {}, qByCat = {};
for (const q of questions) {
  byType[q.type] = (byType[q.type] || 0) + 1;
  byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
  qByCat[q.entityType] = (qByCat[q.entityType] || 0) + 1;
}
console.log(`Konzepte: ${Object.keys(concepts).length}`);
console.log(`Fragen:   ${questions.length}`);
console.log('Nach Kategorie:', qByCat);
console.log('Nach Typ:', byType);
console.log('Nach Schwierigkeit:', byDiff);
console.log('\nSkips nach Typ und Grund:');
for (const [type, reasons] of Object.entries(skipped)) {
  for (const [reason, n] of Object.entries(reasons)) console.log(`  ${type}: ${reason} -> ${n}`);
}
