/**
 * Generator für die Lingua-Domain (Sprachen).
 *
 * Liest die verifizierte, vereinheitlichte Faktenbasis aus
 * scripts/data_sources/lingua_raw.json (erzeugt von merge_lingua.js) und schreibt:
 *   - public/data/concepts_lingua.json  : Konzeptspeicher (Map key -> Konzept)
 *   - public/data/questions_lingua.json : generierte Multiple-Choice-Fragen
 *
 * Leitidee (wie Natura): Die Recherche/Verifikation ist die eigentliche Arbeit;
 * das Templating hier leitet nur mechanisch ab. Distraktoren stammen IMMER aus
 * derselben Kategorie und demselben Attribut -> plausibel, nicht trivial
 * ausschließbar. Fragen werden NUR gebaut, wo mindestens 4 vergleichbare Werte
 * existieren (korrekte Antwort + 3 Distraktoren). Kategorien ohne solche
 * Vergleichswerte (language_fact, loanword, grammar_fact, phonetics,
 * language_curio) bleiben bewusst fragenlos — ihre Konzepte sind trotzdem im
 * Konzeptspeicher (Museums-Bestand), das ist gewollt.
 *
 * Besonderheiten gegenüber generate_natura.js:
 *   - Ähnlichkeits-Guard für kategorische Distraktoren: Optionen, deren
 *     Kern-Label ineinandersteckt ("Lateinisches Alphabet" vs. "Lateinisches
 *     Alphabet (seit 1928)"), wären mehrdeutig und werden als Distraktor
 *     ausgeschlossen. Bewusste AUSNAHME: die family-Frage — dort sind die
 *     vollen Werte inkl. Klammer-Zweig ("Indogermanisch (Germanisch)" vs.
 *     "Indogermanisch (Romanisch)") gerade die fairen, feinen Distraktoren.
 *   - Reverse-Korrektheit: Bei Namensfragen ("Welches Wort stammt aus …?")
 *     müssen alle Distraktor-Konzepte beim getesteten Attribut einen ANDEREN,
 *     nicht überlappenden Wert haben (sonst wären zwei Optionen richtig,
 *     z.B. Shampoo [Hindi] und Pyjama [Hindi / Persisch]).
 *
 * Aufruf: node scripts/generate_lingua.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'lingua_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_lingua.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_lingua.json');

const DOMAIN = 'lingua';

// --- kleine Helfer -------------------------------------------------------

/** Deutsche Zahlformatierung: Punkt als Tausender-, Komma als Dezimaltrenner. */
function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

/**
 * Wandelt einen Attributwert in eine saubere Zahl ODER null.
 * Akzeptiert echte Zahlen und rein numerische Strings (auch mit dt. Komma).
 * Bereiche/Text ("ca. 1.000", "über 160 Zeichen") -> null (übersprungen).
 */
function cleanNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^[0-9]+([.,][0-9]+)?$/.test(t)) return Number(t.replace(',', '.'));
  }
  return null;
}

/** Alles ab der ersten " (" abschneiden ("Abjad (nur Konsonanten…)" -> "Abjad"). */
const beforeParen = s => String(s || '').split(' (')[0].trim();

/**
 * Millionen-Formatierer für Sprecher-/Nutzerzahlen. Die Rohwerte sind
 * "Millionen"; ab 1000 lesbarer als Milliarden ("3.400 Millionen" -> "3,4
 * Milliarden"). Distraktoren laufen durch dieselbe Funktion -> konsistent.
 */
function fmtMillions(v) {
  if (v >= 1000) return `${deNum(v / 1000)} Milliarden`;
  return `${deNum(v)} Millionen`;
}

/** Länder-Formatierer für die Amtssprachen-Frage (Singular/Plural). */
function fmtCountries(v) {
  return v === 1 ? '1 Land' : `${deNum(v)} Länder`;
}

/**
 * k kategorische Distraktoren: erste abweichende Werte in Pool-Reihenfolge.
 * Optional schließt conflictFn Kandidaten aus, die der korrekten Antwort zu
 * ähnlich sind (mehrdeutige Optionen).
 */
function pickCategorical(correct, pool, k = 3, conflictFn = null) {
  return [...new Set(pool.map(String))]
    .filter(v => v !== String(correct))
    .filter(v => !conflictFn || !conflictFn(v, String(correct)))
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

// --- Selbstverräter-Schutz (identisch zu Astra/Homo/Natura) ---------------
// Verwirft Fragen, deren Antwort schon im Hinweis steckt ("Lateinisches
// Alphabet" -> Schrifttyp "Alphabet"). Generische Stamm-Wörter schlagen
// bewusst NICHT an (Token-Mindestlänge, kein Hinweis->Antwort-Match).
function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function revealsAnswer(subject, answer) {
  const S = norm(subject), A = norm(answer);
  const sNo = S.replace(/ /g, ''), aNo = A.replace(/ /g, '');
  if (!sNo || !aNo) return false;
  if (aNo.length >= 3 && sNo.includes(aNo)) return true;
  if (sNo.length >= 3 && aNo.includes(sNo)) return true;
  for (const t of A.split(' ').filter(t => t.length >= 4)) if (sNo.includes(t)) return true;
  return false;
}

// --- Ähnlichkeits-Guards für faire Optionen --------------------------------

/** Kern-Label vor erster Klammer, normalisiert, ohne Leerzeichen. */
const coreNorm = s => norm(beforeParen(s)).replace(/ /g, '');

/**
 * Zwei OPTIONEN sind zu ähnlich, wenn das Kern-Label der einen im Kern-Label
 * der anderen steckt: "Lateinisches Alphabet" in "Lateinisches Alphabet mit
 * Diakritika" -> beide gemeinsam in einer Frage wären mehrdeutig.
 */
function optionsTooSimilar(a, b) {
  const A = coreNorm(a), B = coreNorm(b);
  return !!A && !!B && (A.includes(B) || B.includes(A));
}

/**
 * Zwei attributWERTE überlappen semantisch, wenn sie ein längeres Wort-Token
 * teilen ("Hindi / Persisch" und "Hindi" teilen "hindi") oder ineinander-
 * stecken. Für Reverse-Fragen: solche Konzepte taugen NICHT als Distraktor.
 */
function valuesShareToken(a, b) {
  const ta = norm(a).split(' ').filter(t => t.length >= 4);
  const tb = new Set(norm(b).split(' ').filter(t => t.length >= 4));
  if (ta.some(t => tb.has(t))) return true;
  const A = norm(a).replace(/ /g, ''), B = norm(b).replace(/ /g, '');
  return !!A && !!B && (A.includes(B) || B.includes(A));
}

// --- Faktenbasis laden ---------------------------------------------------
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Konzepte nach Kategorie gruppieren (für kategorie-interne Distraktoren).
const byCategory = {};
for (const c of raw) (byCategory[c.category] ||= []).push(c);

// --- Konzeptspeicher bauen ----------------------------------------------
// Key-Schema: "<domain>:<conceptId>" (z.B. lingua:mandarin).
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

// --- Frage-Templates -----------------------------------------------------
// kind: 'cat' (kategorisch), 'num' (numerisch, nutzt rohe Zahl), 'name'
// (Reverse: Antwort = Konzeptname). attr = abgefragtes Attribut.
// transform   = optionale Wert-Kürzung fürs Quiz (z.B. beforeParen).
// similarGuard= Ähnlichkeits-Guard für Distraktoren aktivieren.
// skip        = optionaler Konzept-Filter.
// nameDisplay = Anzeige-Name bei Reverse-Fragen (Etymologie: ohne Suffix).
//
// Bewusst OHNE Templates: language_fact, loanword, grammar_fact, phonetics,
// language_curio — dort existieren keine 4 vergleichbaren Werte je Dimension
// (z.B. loanword: nur 2 Konzepte mit sourceLanguage). Diese Konzepte bleiben
// reiner Museums-Bestand.
const templates = [
  // ==== Sprachen (language) — 16 Konzepte, durchgehend gleiche Attribute ===
  {
    category: 'language', attr: 'family', kind: 'cat', type: 'lingua-language-family', difficulty: 3,
    prompt: c => `Zu welcher Sprachfamilie gehört ${c.name}?`
    // KEIN similarGuard: volle Werte inkl. Klammer-Zweig ("Indogermanisch
    // (Germanisch)" vs. "Indogermanisch (Romanisch)") sind hier gerade die
    // gewollten, fairen Fein-Distraktoren.
  },
  {
    category: 'language', attr: 'script', kind: 'cat', type: 'lingua-language-script', difficulty: 2,
    prompt: c => `Mit welcher Schrift wird ${c.name} geschrieben?`,
    // Guard nötig: "Lateinisches Alphabet" vs. "Lateinisches Alphabet (seit
    // 1928)" gemeinsam in einer Frage wäre mehrdeutig.
    similarGuard: true
  },
  {
    category: 'language', attr: 'speakersMillionsNative', kind: 'num', type: 'lingua-language-native-speakers', difficulty: 3,
    prompt: c => `Wie viele Muttersprachler hat ${c.name}?`,
    format: fmtMillions
  },
  {
    category: 'language', attr: 'officialIn', kind: 'num', type: 'lingua-language-official-countries', difficulty: 4,
    prompt: c => `In wie vielen Ländern ist ${c.name} Amtssprache?`,
    format: fmtCountries
  },

  // ==== Schriftsysteme (writing_system) — 14 Konzepte ======================
  {
    category: 'writing_system', attr: 'scriptType', kind: 'cat', type: 'lingua-script-type', difficulty: 3,
    prompt: c => `Zu welchem Schrifttyp zählt ${c.name}?`,
    // Werte fürs Quiz aufs Kern-Label kürzen: "Abjad (nur Konsonanten
    // obligatorisch)" -> "Abjad". Selbstverräter wie "Lateinisches Alphabet"
    // -> Antwort "Alphabet" verwirft revealsAnswer korrekt.
    transform: beforeParen,
    similarGuard: true // "Alphabet" vs. "Featural Alphabet" nicht mischen
  },
  {
    category: 'writing_system', attr: 'charCount', kind: 'num', type: 'lingua-script-charcount', difficulty: 3,
    prompt: c => `Wie viele Zeichen umfasst ${c.name}?`,
    // Reine Zahl als Option (Einheit steht im Prompt). Mit Suffix "… Zeichen"
    // würde revealsAnswer bei "Chinesische SchriftZEICHEN" fälschlich anschlagen.
    format: v => deNum(v)
  },
  {
    category: 'writing_system', attr: 'inventedYear', kind: 'num', type: 'lingua-script-invented-year', difficulty: 4,
    prompt: c => `In welchem Jahr wurde ${c.name} erfunden?`,
    // Jahreszahlen OHNE Tausenderpunkt (1443, nicht "1.443"); nur die vier
    // dokumentierten Schrift-Erfindungen haben echte number-Werte.
    format: v => String(v)
  },
  {
    category: 'writing_system', attr: 'usersMillions', kind: 'num', type: 'lingua-script-users', difficulty: 3,
    prompt: c => `Wie viele Menschen schreiben mit ${c.name}?`,
    format: fmtMillions,
    // Hieroglyphen haben 0 Nutzer (ausgestorben) — als Frage und als
    // Distraktor unbrauchbar.
    skip: c => cleanNum(c.attributes.usersMillions) === 0
  },
  // direction bewusst NICHT: nur 2 Werte (links/rechts) -> kein fairer Pool.

  // ==== Sprachfamilien (language_family) — 10 Konzepte ====================
  // Prompts mit Anführungszeichen, weil die Namen grammatisch gemischt sind
  // ("Turksprachen" = Plural, "Indogermanische Sprachfamilie" = Singular).
  {
    category: 'language_family', attr: 'speakersMillions', kind: 'num', type: 'lingua-family-speakers', difficulty: 3,
    prompt: c => `Wie viele Sprecher entfallen weltweit auf „${c.name}“?`,
    format: fmtMillions
  },
  {
    category: 'language_family', attr: 'languageCount', kind: 'num', type: 'lingua-family-languagecount', difficulty: 4,
    prompt: c => `Wie viele Einzelsprachen gehören zu „${c.name}“?`,
    // Reine Zahl als Option (Einheit steht im Prompt). Mit Suffix "… Sprachen"
    // würde revealsAnswer bei "TurkSPRACHEN"/"BantuSPRACHEN" fälschlich anschlagen.
    format: v => deNum(v)
  },

  // ==== Etymologie (etymology) — 17 Konzepte ==============================
  {
    category: 'etymology', attr: 'sourceLanguage', kind: 'cat', type: 'lingua-etymology-source', difficulty: 3,
    // Konzeptnamen tragen das Suffix " (Etymologie)" -> fürs Prompt kürzen.
    prompt: c => `Aus welcher Sprache stammt das Wort „${beforeParen(c.name)}“?`,
    // Guard nötig: "Hindi", "Hindi / Persisch" und "Hindi/Gujarati" dürfen
    // nicht gemeinsam als Optionen auftauchen (Hindi-Anteil mehrdeutig).
    similarGuard: true
  },
  // Reverse: von der Herkunftssprache auf das Wort (Distraktoren = Wörter mit
  // nachweislich ANDERER, nicht überlappender Herkunftssprache).
  {
    category: 'etymology', attr: 'sourceLanguage', kind: 'name', type: 'lingua-etymology-source-rev', difficulty: 4,
    subject: c => String(c.attributes.sourceLanguage),
    prompt: c => `Welches dieser Wörter hat seinen Ursprung in der Sprache „${c.attributes.sourceLanguage}“?`,
    nameDisplay: c => beforeParen(c.name) // "Alkohol (Etymologie)" -> "Alkohol"
  }
];

// --- Fragen generieren ---------------------------------------------------
const questions = [];
// Skip-Zähler für den ehrlichen Abschlussbericht.
const skipStats = { revealed: 0, fewDistractors: 0, noValue: 0 };

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];
  const transform = tpl.transform || (v => v);
  const displayName = c => (tpl.nameDisplay ? tpl.nameDisplay(c) : c.name);

  // Distraktor-Pools je Template einmal aufbauen.
  let catPool = [];   // 'cat': transformierte Werte; 'name': { name, value }
  let numPool = [];   // rohe Zahlen für kind='num'
  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    const vRaw = c.attributes[tpl.attr];
    if (tpl.kind === 'name') {
      if (vRaw != null && vRaw !== '') catPool.push({ name: displayName(c), value: String(vRaw) });
    } else if (tpl.kind === 'num') {
      const n = cleanNum(vRaw);
      if (n !== null) numPool.push(n);
    } else { // 'cat'
      if (vRaw !== undefined && vRaw !== null && vRaw !== '') catPool.push(String(transform(vRaw)));
    }
  }

  // Mindestpool-Wächter: unter 4 vergleichbaren Werten ist keine faire
  // 4-Optionen-Frage möglich -> ganzes Template überspringen (und sagen).
  const uniqueSize = tpl.kind === 'num'
    ? new Set(numPool).size
    : new Set(tpl.kind === 'name' ? catPool.map(e => e.name) : catPool).size;
  if (uniqueSize < 4) {
    console.log(`Template ${tpl.type} übersprungen: nur ${uniqueSize} vergleichbare Werte.`);
    continue;
  }

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    const vRaw = c.attributes[tpl.attr];

    // Korrekte Antwort + Distraktoren bestimmen.
    let correct, distractors;
    if (tpl.kind === 'name') {
      if (vRaw == null || vRaw === '') { skipStats.noValue++; continue; }
      correct = displayName(c);
      // Reverse-Korrektheit: Distraktor-Konzepte müssen beim getesteten
      // Attribut einen ANDEREN, nicht überlappenden Wert haben — sonst
      // wären mehrere Optionen richtig.
      distractors = [...new Set(catPool
        .filter(e => e.name !== correct)
        .filter(e => !valuesShareToken(e.value, String(vRaw)))
        .map(e => e.name))].slice(0, 3);
    } else if (tpl.kind === 'num') {
      const n = cleanNum(vRaw);
      if (n === null) { skipStats.noValue++; continue; } // "ca. 1.000"-Strings usw.
      correct = tpl.format(n);
      distractors = pickNumeric(n, numPool, tpl.format);
    } else { // 'cat'
      if (vRaw === undefined || vRaw === null || vRaw === '') { skipStats.noValue++; continue; }
      correct = String(transform(vRaw));
      distractors = pickCategorical(correct, catPool, 3, tpl.similarGuard ? optionsTooSimilar : null);
    }

    // Selbstverräter: steckt die Antwort schon im Hinweis, Frage verwerfen.
    const subject = tpl.subject ? tpl.subject(c) : c.name;
    if (revealsAnswer(subject, correct)) { skipStats.revealed++; continue; }

    // Faire Frage braucht volle 3 Distraktoren (Pools geben das her).
    if (distractors.length < 3) { skipStats.fewDistractors++; continue; }

    const options = [correct, ...distractors];

    questions.push({
      id: `q_${DOMAIN}_${c.id}_${tpl.type}`,
      entityId: `${DOMAIN}:${c.id}`,
      entityType: c.category,
      type: tpl.type,
      difficulty: tpl.difficulty,
      prompt: tpl.prompt(c),
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

// Statistik für die Konsole — inkl. der ehrlich fragenlosen Kategorien.
const byType = {}, byDiff = {}, qByCat = {}, cByCat = {};
for (const c of raw) cByCat[c.category] = (cByCat[c.category] || 0) + 1;
for (const q of questions) {
  byType[q.type] = (byType[q.type] || 0) + 1;
  byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
  qByCat[q.entityType] = (qByCat[q.entityType] || 0) + 1;
}
console.log(`Konzepte: ${Object.keys(concepts).length}`);
console.log(`Fragen:   ${questions.length}`);
console.log('Fragen je Kategorie (0 = bewusst nur Museums-Bestand):');
for (const cat of Object.keys(cByCat)) {
  const q = qByCat[cat] || 0;
  console.log(`  ${cat.padEnd(16)} ${q} Fragen / ${cByCat[cat]} Konzepte (${(q / cByCat[cat]).toFixed(2)} F/Konzept)`);
}
console.log('Nach Typ:', byType);
console.log('Nach Schwierigkeit:', byDiff);
console.log('Übersprungen:', skipStats,
  '(revealed = Selbstverräter, fewDistractors = Pool nach Guards zu klein, noValue = kein sauberer Wert)');
