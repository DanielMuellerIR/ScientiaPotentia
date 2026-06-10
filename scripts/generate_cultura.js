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
 *   Copyright-Hinweis: Es werden ausschließlich nackte Fakten (Jahr, Urheber,
 *   Gattung, Material, Maße) abgefragt — keine Zitate oder Textpassagen
 *   geschützter Werke und keine lebenden Personen.
 *
 * Aufruf: node scripts/generate_cultura.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'cultura_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_cultura.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_cultura.json');

const DOMAIN = 'cultura';

// --- kleine Helfer -------------------------------------------------------

/** Deutsche Zahlformatierung: Punkt als Tausender-, Komma als Dezimaltrenner. */
function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

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

// Normalisierung für Guards (Umlaute weg, nur Kleinbuchstaben/Ziffern).
function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Enthalten sich zwei Werte gegenseitig (normalisiert, ohne Leerzeichen)? */
function containsEitherWay(a, b) {
  const A = norm(a).replace(/ /g, ''), B = norm(b).replace(/ /g, '');
  if (!A || !B) return false;
  return A.includes(B) || B.includes(A);
}

// --- Selbstverräter-Schutz ------------------------------------------------
// Basis wie Astra/Homo/Natura: verwirft Fragen, deren Antwort schon im finalen
// Fragetext steckt. Cultura verschärft zusätzlich:
//   a) Fragetext-Token in der Antwort ("Brandenburgische KONZERTE" verrät
//      "Instrumentalkonzert" — das Token steckt mitten im Antwortwort).
//   b) gemeinsamer Wortanfang >= 4 Zeichen ("CHINesische Mauer" verrät "CHINa",
//      "AMERican Gothic" verrät "AMERikanischer Regionalismus").
function revealsAnswer(subject, answer) {
  const S = norm(subject), A = norm(answer);
  const sNo = S.replace(/ /g, ''), aNo = A.replace(/ /g, '');
  if (!sNo || !aNo) return false;
  if (aNo.length >= 3 && sNo.includes(aNo)) return true;
  if (sNo.length >= 3 && aNo.includes(sNo)) return true;
  const sTokens = S.split(' ').filter(t => t.length >= 4);
  const aTokens = A.split(' ').filter(t => t.length >= 4);
  // Antwort-Token im Fragetext (Natura-Basis, volle Antwort inkl. Klammern).
  for (const t of aTokens) if (sNo.includes(t)) return true;
  // Für die verschärften Checks (a, b) zählt nur der Antwort-Kern OHNE
  // Klammerzusätze: "Homer (zugeschrieben)" darf nicht am Frageverb "schrieb"
  // scheitern — die Klammer ist Quellen-Notiz, kein abgefragter Inhalt.
  const ACore = norm(String(answer).replace(/\([^)]*\)/g, ' '));
  const aCoreNo = ACore.replace(/ /g, '');
  const aCoreTokens = ACore.split(' ').filter(t => t.length >= 4);
  // a) Fragetext-Token in der Antwort. Mindestlänge 5, sonst schlägt das
  //    Frage-Wort "Land" auf "DeutschLAND"/"GriechenLAND" an (kein Verrat).
  for (const t of sTokens) if (t.length >= 5 && aCoreNo.includes(t)) return true;
  // b) gemeinsamer Wortanfang (Stamm-Heuristik gegen Übersetzungs-/Ableitungs-Leaks).
  for (const st of sTokens) for (const at of aCoreTokens) {
    if (st.slice(0, 4) === at.slice(0, 4)) return true;
  }
  return false;
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
function pickCategorical(correct, pool, k = 3) {
  return [...new Set(pool.map(String))]
    .filter(v => v !== String(correct))
    .filter(v => !containsEitherWay(v, correct))
    .slice(0, k);
}

/**
 * k numerische Distraktoren: die dem korrekten Wert NÄCHSTLIEGENDEN Zahlen aus
 * dem Pool (am verwechselbarsten), danach mit dem Template formatiert.
 */
function pickNumeric(correctNum, poolNums, format, k = 3) {
  const unique = [...new Set(poolNums)].filter(n => n !== correctNum);
  unique.sort((a, b) => Math.abs(a - correctNum) - Math.abs(b - correctNum));
  return unique.slice(0, k).map(format);
}

/**
 * k Namens-Distraktoren für Reverse-Fragen. Reverse-Korrektheit: Es kommen nur
 * Konzepte in Frage, deren Wert beim getesteten Attribut sich vom Wert des
 * Frage-Konzepts unterscheidet (sonst wären mehrere Optionen richtig).
 * Namen mit Klammerzusatz ("Pietà (Michelangelo)") werden nachrangig gewählt,
 * weil die Klammer dem Rater Eliminations-Hinweise liefert.
 */
function pickNames(correctName, subjectValue, pool, k = 3) {
  const subjNorm = norm(subjectValue);
  const candidates = pool
    .filter(p => p.name !== correctName && norm(p.value) !== subjNorm)
    .filter(p => !containsEitherWay(p.name, correctName));
  // Klammerfreie Namen zuerst (stabile Sortierung erhält die Pool-Reihenfolge).
  candidates.sort((a, b) => (a.name.includes('(') ? 1 : 0) - (b.name.includes('(') ? 1 : 0));
  return [...new Set(candidates.map(p => p.name))].slice(0, k);
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
    image: c.imageFile
      ? { url: c.imageFile, license: c.imageLicense || '', attribution: c.imageAttribution || '' }
      : null
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
  // Reverse: vom Künstler aufs Werk (Distraktoren = Werke ANDERER Künstler).
  {
    category: 'artwork', attr: 'creator', kind: 'name', type: 'cultura-artwork-creator-rev', difficulty: 3,
    prompt: c => `Welches dieser Gemälde schuf ${beforeParen(String(c.attributes.creator))}?`
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
    skip: c => /unbekannt/i.test(String(c.attributes.creator || ''))
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
  {
    category: 'literary_movement', attr: 'originCountry', kind: 'cat', type: 'cultura-litmovement-country', difficulty: 3,
    prompt: c => `In welchem Land entstand die Literaturepoche ${beforeParen(c.name)}?`,
    skip: c => /,/.test(String(c.attributes.originCountry || ''))
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
  // Reverse: vom Hauptwerk auf den Komponisten (laut Plan, diff 3). Generische
  // Titel überspringen — "Von wem stammt die 9. Sinfonie?" wäre mehrdeutig.
  {
    category: 'composer', attr: 'notableWork', kind: 'name', type: 'cultura-composer-work-rev', difficulty: 3,
    prompt: c => `Von welchem Komponisten stammt das Werk „${c.attributes.notableWork}“?`,
    skip: c => GENERIC_TITLE.test(String(c.attributes.notableWork || ''))
  },

  // ==== Kompositionen (composition) ========================================
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
  // Reverse: vom Autor aufs Werk (Distraktoren = Werke ANDERER Autoren; bei
  // Autoren mit mehreren Werken im Pool stellt pickNames die Korrektheit sicher).
  {
    category: 'literature', attr: 'author', kind: 'name', type: 'cultura-literature-author-rev', difficulty: 3,
    prompt: c => `Welches dieser Werke schrieb ${beforeParen(String(c.attributes.author))}?`
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
      distractors = pickNames(correct, String(rawValue), namePool);
    } else if (tpl.kind === 'num') {
      const n = clean(rawValue);
      if (n === null) { countSkip(tpl, 'kein sauberer Zahlenwert (Bereich/v. Chr./Text)'); continue; }
      correct = tpl.format(n);
      distractors = pickNumeric(n, numPool, tpl.format);
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
      distractors = pickCategorical(correct, catPool);
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
