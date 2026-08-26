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
 *   - extraDistractors: Template-Feld für statisch feste Zusatz-Distraktoren,
 *     wenn der dynamische Pool zu klein ist (z.B. Schreibrichtung: nur 2
 *     kanonische Werte). Wert wird nur übernommen wenn er von der richtigen
 *     Antwort abweicht.
 *
 * Aufruf: node scripts/generate_lingua.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickBalanced, pickNumeric, shouldMagnitudeSpread, magnitudeSpreadDistractors } from './lib/quizrandom.js';
import { norm, deNum, optionKey, distinctOptionValues, revealsAnswerStrict as revealsAnswer } from './lib/generator_text.js';
import { buildImageMetadata } from '../src/utils/imageCredits.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'lingua_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_lingua.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_lingua.json');

const DOMAIN = 'lingua';

// Kanonische Schreibrichtungen für die Richtungs-Frage.
// Werte wie „links nach rechts (traditionell: oben nach unten)" oder
// „rechts nach links oder links nach rechts (je nach Ausrichtung)" sind
// nicht kanonisch und werden per skip übersprungen.
const DIRECTION_CANON_SET = new Set([
  'links nach rechts',
  'rechts nach links'
]);

// --- kleine Helfer -------------------------------------------------------

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
  // Bei kleinen Sprachgemeinschaften ist „0,017 Millionen“ korrekt, aber
  // unnötig schwer lesbar. Die Rohdaten bleiben in Millionen einheitlich.
  if (v < 1) return `${deNum(v * 1000)} Tausend`;
  return `${deNum(v)} Millionen`;
}

/** Länder-Formatierer für die Amtssprachen-Frage (Nominativ/Akkusativ). */
function fmtCountries(v) {
  return v === 1 ? '1 Land' : `${deNum(v)} Länder`;
}

/**
 * Länder-Formatierer im Dativ (nach Präpositionen wie „in", „aus").
 * „1 Land" → „1 Land" (Dativ Singular = Nominativ); „3 Länder" → „3 Ländern".
 */
function fmtCountriesDat(v) {
  return v === 1 ? '1 Land' : `${deNum(v)} Ländern`;
}

/**
 * Dekliniert den Namen einer Sprachfamilie in den Genitiv/Dativ.
 * „Indogermanische Sprachfamilie" → „Indogermanischen Sprachfamilie"
 * Namen wie „Turksprachen" bleiben unverändert (kein Adjektiv vor Sprachfamilie).
 */
function familyInflected(name) {
  return name.replace(/^(.+)e Sprachfamilie$/, '$1en Sprachfamilie');
}

/**
 * Extrahiert das eigentliche Wort aus einem Etymologie-Konzeptnamen.
 * „Alkohol (Etymologie)" → „Alkohol"; kein Klammer-Suffix → ganzer Name.
 */
function displayWord(c) {
  const match = c.name.match(/^(.+?)\s*\(/);
  return match ? match[1].trim() : c.name;
}

/**
 * Prüft, ob das displayWord ein einzelnes Wort ist (kein Leerzeichen).
 * Mehrwortige Konzepte wie „Mama und Papa als Universalwörter" werden für
 * Etymologie-Prompts übersprungen, da der Fragetext sonst grammatisch schief wäre.
 */
function isSingleWord(c) {
  return !displayWord(c).includes(' ');
}

// Kanonische, als MCQ-Antwort saubere Epochen-Bezeichnungen (ohne Jahrhundert-Form).
const CLEAN_EPOCHS = new Set([
  'Mittelalter', 'Spätmittelalter', 'Frühmittelalter',
  'Antike', 'Neuzeit', 'Frühneuzeit',
  'Althochdeutsch', 'Mittelhochdeutsch'
]);
/**
 * Prüft, ob loanEra ein sauberer, vergleichbarer Epochen-Wert ist. Das Attribut ist
 * historisch inkonsistent (konkrete Jahre "1859", Kombis "16./18. Jahrhundert",
 * Etymologien "erbwörtlich (althochdeutsch fogal)"). Die Epochen-Frage ("In welcher
 * Epoche kam das Wort ins Deutsche?") darf NUR auf Konzepten mit einer reinen
 * Jahrhundert-Angabe ("16. Jahrhundert") oder einer kanonischen Epoche feuern — sonst
 * mischen sich Jahre und Epochen als Optionen (QA-Fund 2026-07-01), und Erbwörter
 * "kamen" gar nicht ins Deutsche.
 */
function isCleanEpoch(v) {
  if (typeof v !== 'string') return false;
  return /^\d{1,2}\. Jahrhundert$/.test(v) || CLEAN_EPOCHS.has(v);
}

/**
 * k kategorische Distraktoren: erste abweichende Werte in Pool-Reihenfolge.
 * Optional schließt conflictFn Kandidaten aus, die der korrekten Antwort zu
 * ähnlich sind (mehrdeutige Optionen).
 */
function pickCategorical(correct, pool, k = 3, conflictFn = null) {
  // längen-balanciert statt Pool-Reihenfolge: `.slice(0,k)` nahm sonst feste
  // erste-k Einträge → Längen-Bias (richtige Antwort fast immer längste/kürzeste).
  return pickBalanced(correct, distinctOptionValues(pool)
    .filter(v => optionKey(v) !== optionKey(correct))
    .filter(v => !conflictFn || !conflictFn(v, String(correct))), k);
}

/**
 * k numerische Distraktoren: die dem korrekten Wert NÄCHSTLIEGENDEN Zahlen aus
 * dem Pool (am verwechselbarsten), danach mit dem Template formatiert.
 */
// pickNumeric: jetzt zentral in ./lib/quizrandom.js (mit Proximity-Guard fuer Messgroessen).

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
    image: buildImageMetadata(c)
  };
}

// --- Frage-Templates -----------------------------------------------------
// kind: 'cat' (kategorisch), 'num' (numerisch, nutzt rohe Zahl), 'name'
// (Reverse: Antwort = Konzeptname). attr = abgefragtes Attribut.
// transform      = optionale Wert-Kürzung fürs Quiz (z.B. beforeParen).
// similarGuard   = Ähnlichkeits-Guard für Distraktoren aktivieren.
// skip           = optionaler Konzept-Filter.
// nameDisplay    = Anzeige-Name bei Reverse-Fragen (Etymologie: ohne Suffix).
// extraDistractors = statische Zusatz-Distraktoren wenn dynamischer Pool klein.
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
  // Nur für Sprachen mit mindestens 2 Amtssprachen-Ländern fair (QA-Sweep 2026-07-16):
  // Bei genau 1 Land sitzt die richtige Antwort am Boden der Skala. Ein Distraktor
  // darunter ist unmöglich ("in 0 Ländern Amtssprache" widerspricht der Frage), also
  // war "1 Land" zwangsläufig immer die kleinste Zahl UND die einzige Singularform —
  // zwei perfekte Tells, die 89 der 128 Fragen ohne jedes Sprachwissen lösbar machten.
  // Umformatieren hätte nur den Grammatik-Tell beseitigt, nicht den Zahlen-Tell.
  // `skipAsk` statt `skip`, damit "1 Land" als Distraktor erhalten bleibt — sonst
  // würde die 2 zum neuen Boden und der Defekt entstünde eine Stufe höher neu.
  {
    category: 'language', attr: 'officialIn', kind: 'num', type: 'lingua-language-official-countries', difficulty: 4,
    // Explizit auf null prüfen: `cleanNum` liefert bei fehlendem Wert null, und
    // `null < 2` wäre in JS true — wertlose Konzepte sollen aber wie bisher über
    // den noValue-Zweig laufen, nicht hier als "unfair" gezählt werden.
    skipAsk: c => { const n = cleanNum(c.attributes.officialIn); return n !== null && n < 2; },
    prompt: c => `In wie vielen Ländern ist ${c.name} Amtssprache?`,
    format: fmtCountries
  },

  // Gesamtsprecher (Mutter- + Zweitsprachler) — numerisch, Schwierigkeit 3.
  // Ergänzt die Muttersprachler-Frage um die Perspektive der Gesamtsprecher.
  {
    category: 'language', attr: 'speakersMillionsTotal', kind: 'num', type: 'lingua-language-total-speakers', difficulty: 3,
    prompt: c => `Wie viele Menschen sprechen ${c.name} insgesamt (Mutter- und Zweitsprachler)?`,
    format: fmtMillions
  },

  // Reverse: Gesamtsprecher → Sprachname, Schwierigkeit 4.
  // Zahlen im Prompt über fmtMillions: konsistent mit der Vorwärts-Frage.
  {
    category: 'language', attr: 'speakersMillionsTotal', kind: 'name', type: 'lingua-language-total-speakers-rev', difficulty: 4,
    subject: c => fmtMillions(cleanNum(c.attributes.speakersMillionsTotal)),
    prompt: c => `Welche dieser Sprachen hat insgesamt rund ${fmtMillions(cleanNum(c.attributes.speakersMillionsTotal))} Sprecher?`
  },

  // Reverse: Amtssprachen-Anzahl → Sprachname, Schwierigkeit 4.
  // Prompt benötigt Dativ nach „in": „in 3 Ländern" (fmtCountriesDat).
  // subject für revealsAnswer nutzt dieselbe Formulierung.
  {
    category: 'language', attr: 'officialIn', kind: 'name', type: 'lingua-language-official-countries-rev', difficulty: 4,
    subject: c => fmtCountriesDat(cleanNum(c.attributes.officialIn)),
    prompt: c => `Welche dieser Sprachen ist in ${fmtCountriesDat(cleanNum(c.attributes.officialIn))} Amtssprache?`
  },

  // ==== Schriftsysteme (writing_system) — 14 Konzepte ======================
  {
    category: 'writing_system', attr: 'scriptType', kind: 'cat', type: 'lingua-script-type', difficulty: 3,
    // Anführungszeichen um den Namen: korrekter Kasus statt Nominativ-Adjektiv
    // frei stehend. „Zu welchem Schrifttyp zählt „Arabisches Alphabet"?"
    prompt: c => `Zu welchem Schrifttyp zählt „${c.name}"?`,
    // Werte fürs Quiz aufs Kern-Label kürzen: "Abjad (nur Konsonanten
    // obligatorisch)" -> "Abjad". Selbstverräter wie "Lateinisches Alphabet"
    // -> Antwort "Alphabet" verwirft revealsAnswer korrekt.
    transform: beforeParen,
    similarGuard: true // "Alphabet" vs. "Featural Alphabet" nicht mischen
  },
  {
    category: 'writing_system', attr: 'charCount', kind: 'num', type: 'lingua-script-charcount', difficulty: 3,
    // Anführungszeichen: „Wie viele Zeichen umfasst „Lateinisches Alphabet"?"
    prompt: c => `Wie viele Zeichen umfasst „${c.name}"?`,
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
    // Anführungszeichen: „Wie viele Menschen nutzen die Schrift „Arabisches Alphabet"?"
    prompt: c => `Wie viele Menschen nutzen die Schrift „${c.name}"?`,
    format: fmtMillions,
    // Hieroglyphen haben 0 Nutzer (ausgestorben) — als Frage und als
    // Distraktor unbrauchbar.
    skip: c => cleanNum(c.attributes.usersMillions) === 0
  },

  // Schreibrichtung — nur kanonische Werte 'links nach rechts' /
  // 'rechts nach links'. Mehrdeutige wie „links nach rechts oder oben nach
  // unten" werden per skip übersprungen.
  // extraDistractors: 'oben nach unten' als dritter Distraktor, damit die
  // Frage nicht 50:50 ist (traditionelles Mongolisch schreibt tatsächlich
  // von oben nach unten → fachlich fair).
  {
    category: 'writing_system', attr: 'direction', kind: 'cat', type: 'lingua-script-direction', difficulty: 2,
    prompt: c => `In welche Richtung wird „${c.name}" hauptsächlich geschrieben?`,
    skip: c => !DIRECTION_CANON_SET.has(c.attributes.direction),
    // Pool enthält nur 2 kanonische Werte → 2 statische Zusatz-Distraktoren,
    // damit die Frage nicht 50:50 oder nur 3-Option ist:
    //   • „oben nach unten" — traditionelles Mongolisch, fachlich real
    //   • „wechselnd (boustrophedon)" — antike griechische Inschriften, real
    extraDistractors: ['oben nach unten', 'wechselnd (boustrophedon)']
  },

  // Reverse: Zeichenanzahl → Schriftname, Schwierigkeit 4.
  {
    category: 'writing_system', attr: 'charCount', kind: 'name', type: 'lingua-script-charcount-rev', difficulty: 4,
    subject: c => `${deNum(cleanNum(c.attributes.charCount))} Zeichen`,
    prompt: c => `Welches dieser Schriftsysteme umfasst ${deNum(cleanNum(c.attributes.charCount))} Zeichen?`
  },

  // ==== Sprachfamilien (language_family) — 10 Konzepte ====================
  // Anmerkung zu Attribut-Benennung: In lingua_raw.json heißt das Sprecher-
  // Attribut der Familien „speakersMillions" (nicht speakersMillionsNative wie
  // bei Einzelsprachen). Der funFact-Text bestätigt: „3,4 Mrd. Muttersprachler"
  // → semantisch Muttersprachler, also Prompt mit „Muttersprachler".
  {
    category: 'language_family', attr: 'speakersMillions', kind: 'num', type: 'lingua-family-speakers', difficulty: 3,
    // Nominativ nach „hat die" → c.name direkt (kein familyInflected).
    // familyInflected erzeugt Genitiv/Dativ; „hat die Indogermanischen" wäre falsch.
    prompt: c => `Wie viele Muttersprachler hat die ${c.name}?`,
    format: fmtMillions
  },
  {
    category: 'language_family', attr: 'languageCount', kind: 'num', type: 'lingua-family-languagecount', difficulty: 4,
    // Ein Zweig umfasst begrifflich mindestens eine Sprache. Bei genau einer
    // Sprache wäre die kleinste Option ohne Fachwissen die sichere Antwort;
    // `skipAsk` lässt die 1 trotzdem als fairen Distraktor im Pool.
    skipAsk: c => { const n = cleanNum(c.attributes.languageCount); return n !== null && n < 2; },
    prompt: c => `Wie viele Einzelsprachen gehören zu „${c.name}"?`,
    // Reine Zahl als Option (Einheit steht im Prompt). Mit Suffix "… Sprachen"
    // würde revealsAnswer bei "TurkSPRACHEN"/"BantuSPRACHEN" fälschlich anschlagen.
    format: v => deNum(v)
  },

  // Weltbevölkerungs-Anteil — numerisch, Schwierigkeit 4.
  {
    category: 'language_family', attr: 'shareWorldPopulationPercent', kind: 'num', type: 'lingua-family-world-share', difficulty: 4,
    prompt: c => `Welchen Anteil der Weltbevölkerung stellen Muttersprachler der ${familyInflected(c.name)}?`,
    format: v => `${deNum(v)} %`
  },

  // Verbreitung — kategorisch, Schwierigkeit 3.
  // Nominativ nach „die" → c.name direkt.
  {
    category: 'language_family', attr: 'distribution', kind: 'cat', type: 'lingua-family-distribution', difficulty: 3,
    prompt: c => `Wo ist die ${c.name} hauptsächlich verbreitet?`
  },

  // Hauptzweige — kategorisch, Schwierigkeit 3.
  // revealsAnswer-Guard filtert automatisch Fälle, bei denen die Antwort
  // (z.B. „Germanisch, Romanisch, Slawisch…") den Familiennamen enthält.
  {
    category: 'language_family', attr: 'mainBranches', kind: 'cat', type: 'lingua-family-main-branches', difficulty: 3,
    prompt: c => `Welche Hauptzweige gehören zur ${familyInflected(c.name)}?`
  },

  // ==== Etymologie (etymology) — 17 Konzepte ==============================
  {
    category: 'etymology', attr: 'sourceLanguage', kind: 'cat', type: 'lingua-etymology-source', difficulty: 3,
    // Konzeptnamen tragen das Suffix " (Etymologie)" -> fürs Prompt kürzen.
    prompt: c => `Aus welcher Sprache stammt das Wort „${displayWord(c)}"?`,
    // Guard nötig: "Hindi", "Hindi / Persisch" und "Hindi/Gujarati" dürfen
    // nicht gemeinsam als Optionen auftauchen (Hindi-Anteil mehrdeutig).
    similarGuard: true,
    subject: c => `das Wort „${displayWord(c)}"`,
    skip: c => !isSingleWord(c)
  },
  // Reverse: von der Herkunftssprache auf das Wort (Distraktoren = Wörter mit
  // nachweislich ANDERER, nicht überlappender Herkunftssprache).
  {
    category: 'etymology', attr: 'sourceLanguage', kind: 'name', type: 'lingua-etymology-source-rev', difficulty: 4,
    subject: c => String(c.attributes.sourceLanguage),
    prompt: c => `Welches dieser Wörter hat seinen Ursprung in der Sprache „${c.attributes.sourceLanguage}"?`,
    nameDisplay: c => displayWord(c)  // "Alkohol (Etymologie)" -> "Alkohol"
  },

  // Entlehnungsweg — kategorisch, Schwierigkeit 3.
  // Attribut loanPath (kanonisiert in merge_lingua.js aus „entlehnungsweg").
  // Nur Einzelwörter, damit der Prompt grammatisch korrekt ist.
  {
    category: 'etymology', attr: 'loanPath', kind: 'cat', type: 'lingua-etymology-borrowing-path', difficulty: 3,
    prompt: c => `Auf welchem Weg gelangte das Wort „${displayWord(c)}" ins Deutsche?`,
    subject: c => `das Wort „${displayWord(c)}"`,
    skip: c => !isSingleWord(c)
  },

  // Epoche — kategorisch, Schwierigkeit 4.
  // Attribut loanEra (kanonisiert in merge_lingua.js aus „entlehnung"/„epoche").
  // Nur Einzelwörter (isSingleWord-Guard wie beim Entlehnungsweg).
  {
    category: 'etymology', attr: 'loanEra', kind: 'cat', type: 'lingua-etymology-era', difficulty: 4,
    prompt: c => `In welcher Epoche kam das Wort „${displayWord(c)}" ins Deutsche?`,
    subject: c => `das Wort „${displayWord(c)}"`,
    // Nur Einzelwörter UND saubere Epochen-Werte (sonst Jahr/Epoche-Mix, s. isCleanEpoch).
    skip: c => !isSingleWord(c) || !isCleanEpoch(c.attributes.loanEra)
  },

  // ==== Neue Templates: bisher ungenutzte Attribute ========================

  // ---- language.scriptType (Vorwärts) — kategorisch, Schwierigkeit 2 ------
  // Welchen Schrifttyp nutzt Sprache X?
  // 7 distinkte Werte im Pool (Alphabet, Abugida, Abjad, Logografie usw.),
  // alle 16 Sprachkonzepte haben das Attribut → keine skip-Bedingung nötig.
  // similarGuard aktiv: "Alphabet" und "Featural Alphabet (Silbensegmente)"
  // teilen den Kern-Token "alphabet" → optionsTooSimilar sondert sie als
  // gemeinsame Distraktor-Kombination aus. Das ist korrekt: sie wären in
  // derselben Frage schwer auseinanderzuhalten.
  // testedAttribute: 'scriptType' → ConceptVisual braucht ein ATTR_LABEL dafür,
  // sofern noch keins existiert (prüfen nach Generatorlauf).
  {
    category: 'language', attr: 'scriptType', kind: 'cat',
    type: 'lingua-language-script-type', difficulty: 2,
    testedAttribute: 'scriptType',
    prompt: c => `Welchen Schrifttyp nutzt die Sprache ${c.name}?`,
    similarGuard: true  // "Alphabet" vs. "Featural Alphabet" trennen
  },

  // ---- language.speakersMillionsNative (Reverse) — Schwierigkeit 4 --------
  // Welche Sprache hat X Millionen Muttersprachler?
  // Ergänzt lingua-language-native-speakers (Vorwärts) um die Reverse-Richtung.
  // Alle 16 Werte distinkt (Französisch 80 = Türkisch 80 ist der einzige
  // Duplikats-Kandidat, aber valuesShareToken('80', '80') filtert ihn korrekt
  // als Distraktor heraus → jeweils bleiben noch ≥3 andere übrig).
  {
    category: 'language', attr: 'speakersMillionsNative', kind: 'name',
    type: 'lingua-language-native-speakers-rev', difficulty: 4,
    subject: c => fmtMillions(cleanNum(c.attributes.speakersMillionsNative)),
    prompt: c => `Welche dieser Sprachen hat rund ${fmtMillions(cleanNum(c.attributes.speakersMillionsNative))} Muttersprachler?`
    // nameDisplay nicht gesetzt → c.name wird direkt verwendet (Sprachname).
  },

  // ---- language_family.speakersMillions (Reverse) — Schwierigkeit 4 -------
  // Welche Sprachfamilie hat rund X Sprecher?
  // Ergänzt lingua-family-speakers (Vorwärts) um die Reverse-Richtung.
  // Alle 10 Familiensprecherzahlen sind numerisch distinkt; einziger Token-
  // Konflikt: Dravidisch (250) ~ Uralisch (25) → „25" steckt in „250" →
  // valuesShareToken filtert ihn aus. Genug andere Distraktoren bleiben.
  {
    category: 'language_family', attr: 'speakersMillions', kind: 'name',
    type: 'lingua-family-speakers-rev', difficulty: 4,
    subject: c => fmtMillions(cleanNum(c.attributes.speakersMillions)),
    prompt: c => `Welche dieser Sprachfamilien hat rund ${fmtMillions(cleanNum(c.attributes.speakersMillions))} Muttersprachler?`
  },

  // ---- language_family.languageCount (Reverse) — Schwierigkeit 4 ----------
  // Welche Sprachfamilie umfasst rund X Einzelsprachen?
  // Ergänzt lingua-family-languagecount (Vorwärts) um die Reverse-Richtung.
  // Zahlenwerte wie 1540 vs. 1257 vs. 500 vs. 446 vs. 400 × 2 vs. 80/38/35/5
  // lösen vielfältige valuesShareToken-Konflikte aus (z. B. steckt '5' in '1540'
  // und '35' etc.) — der Guard filtert das korrekt aus; alle 10 Konzepte haben
  // trotzdem ≥3 unbedenkliche Distraktoren.
  {
    category: 'language_family', attr: 'languageCount', kind: 'name',
    type: 'lingua-family-languagecount-rev', difficulty: 4,
    subject: c => `${deNum(cleanNum(c.attributes.languageCount))} Sprachen`,
    prompt: c => `Welche dieser Sprachfamilien umfasst rund ${deNum(cleanNum(c.attributes.languageCount))} Einzelsprachen?`
  },

  // ---- writing_system.usersMillions (Reverse) — Schwierigkeit 4 -----------
  // Welches Schriftsystem nutzen X Millionen Menschen?
  // Ergänzt lingua-script-users (Vorwärts) um die Reverse-Richtung.
  // Hieroglyphen (0 Nutzer) werden per skip übersprungen — identisch wie beim
  // Vorwärts-Template. Alle verbleibenden 13 Werte sind distinkt.
  {
    category: 'writing_system', attr: 'usersMillions', kind: 'name',
    type: 'lingua-script-users-rev', difficulty: 4,
    subject: c => fmtMillions(cleanNum(c.attributes.usersMillions)),
    prompt: c => `Welches dieser Schriftsysteme nutzen rund ${fmtMillions(cleanNum(c.attributes.usersMillions))} Menschen?`,
    // Hieroglyphen ausschließen (0 Nutzer, nicht vergleichbar).
    skip: c => cleanNum(c.attributes.usersMillions) === 0
  },

  // ---- writing_system.inventedYear (Reverse) — Schwierigkeit 4 -----------
  // Welches dieser Schriftsysteme wurde im Jahr X erfunden?
  // Ergänzt lingua-script-invented-year (Vorwärts) um die Reverse-Richtung.
  // Nur 4 Konzepte haben inventedYear (Hangul 1443, Thai 1283, Armenisch 405,
  // Braille 1824) → Pool exakt 4, genau die Mindestgrenze. Alle Werte distinkt;
  // valuesShareToken zeigt hier keine Konflikte.
  {
    category: 'writing_system', attr: 'inventedYear', kind: 'name',
    type: 'lingua-script-invented-year-rev', difficulty: 4,
    subject: c => `Jahr ${c.attributes.inventedYear}`,
    prompt: c => `Welches dieser Schriftsysteme wurde im Jahr ${c.attributes.inventedYear} erfunden?`,
    // Nur Konzepte mit echtem inventedYear-Wert (Zahl) ins Reverse einbeziehen.
    skip: c => c.attributes.inventedYear == null
  },

  // ---- etymology.originalMeaning (Vorwärts) — Schwierigkeit 3 -------------
  // Was bedeutete das Wort „X" ursprünglich?
  // 52 Etymologie-Konzepte haben originalMeaning; nach Selbstverräter-Guard
  // (revealsAnswer filtert ~9) bleiben rund 43 faire Fragen.
  // Werte enthalten oft „Quellwort — deutsche Bedeutung"; fürs Quiz wird
  // nur der Teil nach dem Gedankenstrich verwendet (extractMeaning), damit
  // die Optionen prägnant und vergleichbar sind.
  // Distraktoren: andere deutsche Bedeutungsextrakte aus demselben Etymologie-Pool.
  // similarGuard deaktiviert: Bedeutungen teilen zufällig Tokens, aber
  // optionsTooSimilar prüft Kern-Labels; kurze Werte wie „Schwitzbad" und
  // „Fronarbeit, Zwangsarbeit" sind klar unterscheidbar.
  {
    category: 'etymology', attr: 'originalMeaning', kind: 'cat',
    type: 'lingua-etymology-original-meaning', difficulty: 3,
    // Bedeutung nach dem Gedankenstrich (falls vorhanden), sonst vollen Wert nehmen.
    transform: v => { const i = v.indexOf('—'); return i !== -1 ? v.substring(i + 1).trim() : v; },
    prompt: c => `Was bedeutete das Wort „${displayWord(c)}" ursprünglich?`,
    subject: c => `das Wort „${displayWord(c)}"`,
    // Nur Einzelwörter: bei Mehrwort-Konzepten wäre der Prompt grammatisch schief.
    skip: c => !isSingleWord(c)
  },

  // ---- etymology.originalMeaning (Reverse) — Schwierigkeit 4 --------------
  // Welches dieser Wörter bedeutete ursprünglich „…"?
  // Prompt-Hinweis = extrahierte deutsche Bedeutung; Antwort = Wortname.
  // Distraktoren = andere Wörter, deren Bedeutung NICHT denselben Token teilt
  // (valuesShareToken-Guard verhindert mehrdeutige Optionen, z.B. zwei Wörter
  // die beide „Trank" in der Bedeutung haben).
  // Nach Selbstverräter-Guard (z.B. „Zucker: Zucker …", „Fenster: Oeffnung,
  // Fenster") bleiben rund 46 faire Fragen.
  {
    category: 'etymology', attr: 'originalMeaning', kind: 'name',
    type: 'lingua-etymology-original-meaning-rev', difficulty: 4,
    // subject für revealsAnswer: die extrahierte Bedeutung (ohne Quellwort).
    subject: c => {
      const v = String(c.attributes.originalMeaning);
      const i = v.indexOf('—');
      return i !== -1 ? v.substring(i + 1).trim() : v;
    },
    prompt: c => {
      const v = String(c.attributes.originalMeaning);
      const i = v.indexOf('—');
      const meaning = i !== -1 ? v.substring(i + 1).trim() : v;
      return `Welches dieser Wörter bedeutete ursprünglich „${meaning}"?`;
    },
    nameDisplay: c => displayWord(c)  // „Alkohol (Etymologie)" → „Alkohol"
  },

  // ---- writing_system.languagesUsing (Reverse) — Schwierigkeit 3 ----------
  // Welches Schriftsystem wird u.a. für Arabisch, Persisch und Urdu verwendet?
  // 37 writing_system-Konzepte haben languagesUsing; nach Selbstverräter-Guard
  // (schriftname-Token in der Sprach-Liste, z.B. „Griechisches Alphabet" ↔
  // „Griechisch") bleiben rund 21 faire Fragen.
  // subject = voller languagesUsing-Freitext (revealsAnswer prüft alle Token).
  // valuesShareToken als Distraktor-Guard: Schriftsysteme mit überlappenden
  // Sprachenlisten (z.B. Koreanisch in Hangul UND Chinesischen Schriftzeichen)
  // wären als Distraktor-Paar irreführend → werden ausgesondert.
  {
    category: 'writing_system', attr: 'languagesUsing', kind: 'name',
    type: 'lingua-script-languages-rev', difficulty: 3,
    subject: c => String(c.attributes.languagesUsing),
    prompt: c => `Für welches dieser Schriftsysteme wird u. a. folgende Sprach-Gruppe verwendet: „${c.attributes.languagesUsing}"?`
  }
];

// --- Fragen generieren ---------------------------------------------------
const questions = [];
// Skip-Zähler für den ehrlichen Abschlussbericht.
// `unfair`: per skipAsk bewusst nicht gefragt, weil die Frage für dieses Konzept
// nicht fair stellbar wäre (Wert am Skalenboden). Wert bleibt Distraktor.
const skipStats = { revealed: 0, fewDistractors: 0, noValue: 0, unfair: 0 };

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
  // extraDistractors werden mitgezählt, weil sie statisch immer verfügbar sind.
  const extraCount = tpl.extraDistractors ? tpl.extraDistractors.length : 0;
  const uniqueSize = tpl.kind === 'num'
    ? new Set(numPool).size
    : new Set(tpl.kind === 'name' ? catPool.map(e => e.name) : catPool).size + extraCount;
  if (uniqueSize < 4) {
    console.log(`Template ${tpl.type} übersprungen: nur ${uniqueSize} vergleichbare Werte.`);
    continue;
  }

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    // `skipAsk` (im Gegensatz zu `skip`): Über dieses Konzept wird KEINE Frage
    // gestellt, sein Wert bleibt aber oben im Distraktorpool. Nötig, wenn die
    // Frage nur für einen Teil der Konzepte fair ist, die übrigen Werte aber als
    // Distraktoren gebraucht werden — siehe officialIn-Template.
    if (tpl.skipAsk && tpl.skipAsk(c)) { skipStats.unfair++; continue; }
    const vRaw = c.attributes[tpl.attr];

    // Korrekte Antwort + Distraktoren bestimmen.
    let correct, distractors;
    if (tpl.kind === 'name') {
      if (vRaw == null || vRaw === '') { skipStats.noValue++; continue; }
      correct = displayName(c);
      // Reverse-Korrektheit: Distraktor-Konzepte müssen beim getesteten
      // Attribut einen ANDEREN, nicht überlappenden Wert haben — sonst
      // wären mehrere Optionen richtig.
      distractors = pickBalanced(correct, [...new Set(catPool
        .filter(e => e.name !== correct)
        .filter(e => !valuesShareToken(e.value, String(vRaw)))
        .map(e => e.name))], 3);
    } else if (tpl.kind === 'num') {
      const n = cleanNum(vRaw);
      if (n === null) { skipStats.noValue++; continue; } // "ca. 1.000"-Strings usw.
      correct = tpl.format(n);
      // Größenordnungs-Distraktoren bei über ≥2 Größenordnungen streuenden Maßen
      // (Sprecherzahlen, Zeichenzahl, Sprachenzahl); inventedYear bleibt Nachbarwert.
      distractors = (shouldMagnitudeSpread(n, numPool, tpl.attr)
        && magnitudeSpreadDistractors(n, numPool, tpl.format, { seed: c.id }))
        || pickNumeric(n, numPool, tpl.format);
    } else { // 'cat'
      if (vRaw === undefined || vRaw === null || vRaw === '') { skipStats.noValue++; continue; }
      correct = String(transform(vRaw));
      distractors = pickCategorical(correct, catPool, 3, tpl.similarGuard ? optionsTooSimilar : null);
    }

    // Optionale statische Zusatz-Distraktoren anhängen (z.B. für
    // Richtungsfrage: Pool hat nur 2 kanonische Werte → 'oben nach unten'
    // als fachlich fairer dritter Distraktor ergänzen).
    if (tpl.extraDistractors) {
      for (const extra of tpl.extraDistractors) {
        if (extra !== correct && !distractors.includes(extra)) {
          distractors.push(extra);
        }
      }
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
