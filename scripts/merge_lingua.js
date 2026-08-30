/**
 * Merge-Helfer für die Lingua-Domain (Sprachen).
 *
 * Liest die vier Ernte-Dateien aus scripts/data_sources/harvest/lingua_*.json,
 * vereinheitlicht sie und schreibt die verifizierte Faktenbasis nach
 * scripts/data_sources/lingua_raw.json (Eingabe für generate_lingua.js).
 *
 * Warum nötig: Die Sammelrunde lief in vier Blöcken mit unterschiedlichen
 * Schreibweisen für dieselben Attribute (z.B. etymology: "ursprung" im Block
 * b_w1 vs. "bedeutung" im Block b_w1b — beides die Ursprungsbedeutung).
 * Ohne Angleichung zerfielen die kategorie-internen Distraktor-Pools des
 * Generators (zwei Schreibweisen derselben Sache nebeneinander -> unfaire
 * oder gar keine MCQ-Optionen).
 *
 * Dieser Schritt macht (deterministisch, kein LLM):
 *   1. Attribut-KEYS -> kanonisch englisches camelCase je Kategorie.
 *      ACHTUNG: "entlehnungsweg" (Pfad: Arabisch -> Latein -> Deutsch) und
 *      "entlehnung"/"epoche" (Epoche: "17. Jahrhundert") sind VERSCHIEDENE
 *      Inhalte und werden bewusst NICHT zusammengeführt (loanPath vs. loanEra).
 *      Ebenso bleiben speakersMillionsNative / speakersMillionsTotal /
 *      speakersMillions / usersMillions getrennt — je Kategorie eigene Bedeutung.
 *   2. ASCII-Umlaut-Putz NUR über eine exakte Wortliste mit Wortgrenzen-Regex
 *      (\b). Kurze Tokens wie "uber"/"fur" ohne \b würden Fremdwörter und
 *      URLs zerstören.
 *   3. Wenige gezielte Tippfehler-Korrekturen in Anzeigetexten (dokumentiert
 *      unten, keine Faktenänderung).
 *   4. MANUAL_DROP für eine inhaltliche Dublette; Quasi-Dubletten über
 *      Kategorien hinweg bleiben absichtlich drin und werden nur gelistet.
 *   5. Dedup je Kategorie (id-Kollision + normalisierter Name).
 *   6. Bild- + Quellenfelder ERHALTEN (Museum/Provenance brauchen sie),
 *      inklusive _imgProblem-Marker aus der Bild-Recherche.
 *
 * Werte werden vollständig erhalten (keine Klammer-Kürzung im Raw — das macht
 * der Generator bei Bedarf). Typ-Inkonsistenzen (Zahl vs. String "15") werden
 * hier bewusst NICHT repariert; der Generator filtert sie per cleanNum.
 *
 * Parallel-Betrieb: Ein anderer Agent aktualisiert zeitgleich die Bildfelder
 * der harvest/*.json. Schlägt JSON.parse fehl (halb geschriebene Datei),
 * wartet das Skript 30 Sekunden und liest erneut. Das Skript baut das Raw
 * ohnehin jedes Mal komplett neu auf und ist damit idempotent — es kann nach
 * dem Bilder-Refresh gefahrlos erneut laufen.
 *
 * Aufruf: node scripts/merge_lingua.js          (Dry-Run, zeigt nur Befund)
 *         node scripts/merge_lingua.js --write   (schreibt lingua_raw.json)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assertPreservesExistingConceptIds } from './lib/merge_safety.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARVEST = join(__dirname, 'data_sources', 'harvest');
const OUT_PATH = join(__dirname, 'data_sources', 'lingua_raw.json');
const WRITE = process.argv.includes('--write');

const FILES = ['lingua_a_w1.json', 'lingua_a_w1b.json', 'lingua_b_w1.json', 'lingua_b_w1b.json'];

// --- 0. Manuelle Drops ---------------------------------------------------
// language-curio-bibel-uebersetzungen ist eine inhaltliche Dublette von
// "meistuebersetzes-buch" (language_fact, gleicher Kerninhalt: Bibel =
// meistübersetztes Buch). Eine Fassung reicht; die language_fact-Fassung
// hat die reicheren Attribute.
const MANUAL_DROP = new Set(['language-curio-bibel-uebersetzungen']);
const CANONICAL_LANGUAGE_BY_QID = new Map([
  ['Q33454', { id: 'fulfulde', name: 'Fulfulde', aliases: ['Fula'] }],
  ['Q9091', { id: 'belarussisch', name: 'Belarussisch', aliases: ['Weißrussisch'] }],
  ['Q7930', { id: 'madagassisch', name: 'Madagassisch', aliases: ['Malagasy'] }],
  ['Q36213', { id: 'maduresisch', name: 'Maduresisch', aliases: ['Madura'] }],
]);

// Quasi-Dubletten ÜBER Kategoriegrenzen hinweg: dasselbe Thema einmal als
// Grundkonzept und einmal als Rekord-/Fakt-Eintrag. Sie bleiben BEWUSST
// erhalten (verschiedene Blickwinkel, Distraktor-Pools sind kategorie-intern,
// also kein Konflikt) und werden im Report nur transparent gelistet.
const CROSS_CATEGORY_NEAR_DUPES = [
  'writing_system/hangul <-> language_fact/hangul-juengste-grosse-schrift',
  'writing_system/lateinisches-alphabet <-> language_fact/lateinisch-weiteste-schrift',
  'writing_system/griechisches-alphabet <-> language_fact/griechisch-erstes-vokalphabet',
  'language/mandarin <-> language_fact/mandarin-meiste-muttersprachler',
  'language/englisch <-> language_fact/englisch-meistgesprochen',
  'language_family/niger-kongo <-> language_fact/niger-kongo-sprachenreich',
  'language_family/austronesisch <-> language_fact/austronesisch-groesste-ausdehnung',
  'language_curio/language-curio-esperanto <-> language_curio/language-curio-plansprachen (beide Esperanto-zentriert)'
];

// --- 1. Attribut-Key-Aliase je Kategorie -> kanonisch englisches camelCase --
// Kategorien "language" und "language_family" sind bereits durchgehend
// konsistent benannt und brauchen keine Aliase.
const KEY_ALIASES = {
  writing_system: {
    // "inventedCentury" (Kana, "9. Jh. n. Chr.") meint dasselbe wie das schon
    // vorhandene "originCentury" (Jahrhundert der Entstehung als Text).
    // "inventedYear" (echte Jahreszahl) bleibt davon getrennt!
    inventedCentury: 'originCentury'
  },
  etymology: {
    herkunftssprache: 'sourceLanguage',
    // Ursprungsbedeutung des Wortes: Block b_w1 nannte sie "ursprung",
    // Block b_w1b "bedeutung" (bei Muskel "bedeutung_lateinisch").
    ursprung: 'originalMeaning',
    bedeutung: 'originalMeaning',
    bedeutung_lateinisch: 'originalMeaning',
    // VERSCHIEDENE Inhalte, NICHT zusammenführen:
    //   entlehnungsweg = Pfad ("Nahuatl -> Spanisch -> Deutsch")
    //   entlehnung/epoche = Epoche ("17. Jahrhundert")
    entlehnungsweg: 'loanPath',
    entlehnung: 'loanEra',
    epoche: 'loanEra',
    entlehnung_englisch: 'loanEraEnglish',     // Zombie: Übernahme INS Englische
    erstbeleg_jahr: 'firstAttestedYear',
    erstbeleg_deutsch: 'firstAttestedYearGerman', // Shampoo: Erstbeleg speziell im Deutschen
    quelle_erstbeleg: 'firstAttestedSource',
    ersteVerwendung: 'firstUse',
    // Wortprägung durch eine benannte Person (Fröbel, Herder).
    erfinder: 'coinedBy',
    praegende_person: 'coinedBy',
    gruendungsjahr: 'coinedYear',
    lateinisch: 'sourceWord'                   // Muskel: das Quellwort "musculus"
  },
  loanword: {
    beispiele: 'examples',
    bekannteBeispiele: 'examples',
    bekannte_beispiele: 'examples',
    verbreitungsmedium: 'spreadMedium',
    anzahlSprachen: 'languageCount',
    verbreitung: 'distribution',
    linguistischeErklaerung: 'linguisticExplanation',
    bezug: 'reference',
    anzahlImDeutschen: 'countInGerman',
    besonderheit: 'specialFeature',
    herkunftssprache: 'sourceLanguage',
    ursprung: 'originalMeaning',
    bedeutung: 'originalMeaning',
    entlehnungsweg: 'loanPath',
    ursprung_lehnwort: 'loanPath',             // "Deutsch -> Englisch" ist ein Pfad
    anzahl_woerter: 'wordCount',
    anteil_wortschatz_prozent: 'vocabularySharePercent',
    praefixbeispiel: 'prefixExample',
    steigerung_zeitraum: 'increasePeriod',
    bekannte_scheinanglizismen: 'pseudoAnglicisms',
    sprachen_uebernommen: 'adoptedByLanguages'
  },
  language_fact: {
    entstehung: 'origin',
    ort: 'location',
    sprache: 'language',
    verwendungsdauer: 'usageDuration',
    alphabetisierungsrate: 'literacyRate',
    besonderheit: 'specialFeature',
    kasusAnzahl: 'caseCount',
    vergleich: 'comparison',
    grammatikTyp: 'grammarType',
    anzahlWeltweit: 'countWorldwide',
    beispiele: 'examples',
    anerkenntnis: 'recognition',
    sprecher: 'speakers',
    sprachen: 'languages',
    vollstaendigeUebersetzungen: 'completeTranslations',
    organisationWycliffe: 'organization',
    auflageJaehrlich: 'annualCopies',
    ersteDruckversion: 'firstPrintedVersion'
  },
  grammar_fact: {
    sprache: 'language',
    anzahlKlicklauttypen: 'clickTypeCount',
    anzahlVarianten: 'variantCount',
    anteilImWortschatz: 'vocabularyShare',
    sprecher: 'speakers',
    anzahlKlassen: 'classCount',
    vergleich: 'comparison',
    vergleich_deutsch: 'comparison',
    kongruenz: 'agreement',
    beispielsprache: 'exampleLanguage',
    wort: 'word',
    buchstabenanzahl: 'letterCount',
    bundesland: 'federalState',
    zeitraum: 'period',
    bedeutung: 'meaning',
    beispiele: 'examples',
    strategie: 'strategy',
    beispielLatein: 'exampleLatin',
    beispielWalisisch: 'exampleWelsh',
    sprachenMitGenus: 'languagesWithGender',
    sprachenOhneGenus: 'languagesWithoutGender',
    deutschGenus: 'germanGenderCount',
    maximaleKlassen: 'maxClassCount',
    anzahl_kasus: 'caseCount',
    prinzip: 'principle',
    beispiel_plural: 'examplePlural',
    max_morpheme_pro_wort: 'maxMorphemesPerWord'
  },
  phonetics: {
    sprache: 'language',
    anzahlToene: 'toneCount',
    toene: 'tones',
    zusatz: 'note',
    typ: 'type',
    konsonanten: 'consonants',
    ausgestorben: 'extinctYear',
    letzterSprecher: 'lastSpeaker',
    gegruendet: 'foundedYear',
    anzahlSymbole: 'symbolCount',
    vokaleImDeutschen: 'germanVowelCount',
    zweck: 'purpose',
    meisteLaute: 'mostSounds',
    wenigsteLaute: 'fewestSounds',
    durchschnittKonsonanten: 'averageConsonantCount',
    hawaiischPhoneme: 'hawaiianPhonemeCount',
    beispiele: 'examples',
    besonderheit: 'specialFeature',
    anteilWeltsprachen: 'worldLanguageShare',
    ipa_symbol: 'ipaSymbol',
    vorkommt_in: 'occursIn',
    prinzip: 'principle',
    deutsches_beispiel: 'exampleGerman',
    funktion: 'function'
  },
  language_curio: {
    gruender: 'founder',
    gruendungsjahr: 'foundedYear',
    muttersprachler: 'nativeSpeakers',
    aktiveSprecher: 'activeSpeakers',
    grammatik: 'grammar',
    'laengstes-einwort-palindrom-deutsch': 'longestGermanSingleWordPalindrome',
    ursprung: 'origin',
    bekanntestesEnglisch: 'bestKnownEnglish',
    deutschesBeispiel: 'exampleGerman',
    verwendung: 'usage',
    herkunftssprache: 'sourceLanguage',
    ersteVerwendung: 'firstUse',
    verbreitung: 'distribution',
    typ: 'type',
    ort: 'location',
    aktive_nutzer: 'activeUsers',
    unesco_seit: 'unescoSince',
    gesamtzahl_sprachen_weltweit: 'totalLanguagesWorldwide',
    bedrohungsanteil_prozent: 'endangeredSharePercent',
    dominante_20_sprachen_bevoelkerungsanteil: 'top20LanguagesPopulationShare',
    anzahl_plansprachen_dokumentiert: 'documentedConlangCount',
    bekannteste: 'bestKnown',
    esperanto_muttersprachler: 'esperantoNativeSpeakers',
    fachbegriff: 'technicalTerm',
    typen: 'types',
    beispiel: 'example'
  }
};

// --- 2. ASCII-Umlaut-Putz (exakte Wortliste, NUR mit \b-Wortgrenzen) --------
// Befunde aus lingua_b_w1.json: funFact von etymologie-alkohol enthält
// "uber"/"fur"/"Einfarben" ohne Umlaut; alle 24 verifyNotes schreiben
// "bestatigt"; eine verifyNote "Erklarung". VORSICHT: kurze Tokens wie
// "uber"/"fur" OHNE \b würden Fremdwörter/URLs zerstören — deshalb je Wort
// ein eigener Eintrag mit exakter Groß-/Kleinschreibung (kein i-Flag).
const UMLAUT_FIXES = [
  ['uber', 'über'],
  ['fur', 'für'],
  ['bestatigt', 'bestätigt'],
  ['Erklarung', 'Erklärung'],
  ['Einfarben', 'Einfärben']
];

// --- 3. Gezielte Tippfehler-Korrekturen (Anzeigetexte, keine Faktenänderung) -
//   - "Sinitsisch" (sinotibetisch): der deutsche Fachbegriff lautet "Sinitisch".
//   - "Konturtönsprachen"/"Registertönsprachen" (tonsprachen-weltweit): über-
//     korrigierte Umlaute, richtig ist "Konturtonsprachen"/"Registertonsprachen".
//   - "gemeinsame Ursache" (turksprachen-funFact): gemeint ist die gemeinsame
//     "Ursprache" (Proto-Sprache), nicht eine Ursache.
const TYPO_FIXES = [
  ['Sinitsisch', 'Sinitisch'],
  ['Konturtönsprachen', 'Konturtonsprachen'],
  ['Registertönsprachen', 'Registertonsprachen'],
  ['gemeinsame Ursache', 'gemeinsame Ursprache']
];

/** Wendet Umlaut- + Tippfehler-Fixes wortgrenzen-genau auf einen String an. */
function fixText(s) {
  let out = String(s ?? '');
  for (const [wrong, right] of [...UMLAUT_FIXES, ...TYPO_FIXES]) {
    out = out.replace(new RegExp('\\b' + wrong + '\\b', 'g'), right);
  }
  return out;
}

/** Fixes rekursiv auf Strings/Arrays/Objekte anwenden (für attributes). */
function fixTextDeep(v) {
  if (typeof v === 'string') return fixText(v);
  if (Array.isArray(v)) return v.map(fixTextDeep);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = fixTextDeep(v[k]); return o; }
  return v;
}

// Normalisierung für Dedup-Vergleiche (Umlaute/Sonderzeichen entfernen).
const norm = s => String(s ?? '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
  .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, '').trim();

/** Wendet Key-Aliase + Textfixes auf ein Konzept an. */
function normalizeConcept(c) {
  const alias = KEY_ALIASES[c.category] || {};
  const attrsIn = c.attributes || {};
  const attrs = {};

  // Keys umbenennen (kanonisch englisches camelCase), Werte unverändert
  // übernehmen. Kollisions-Warnung, falls zwei Quell-Keys auf denselben
  // Ziel-Key zeigen UND beide im selben Konzept vorkommen (sollte nie passieren).
  for (const [k, v] of Object.entries(attrsIn)) {
    const key = alias[k] || k;
    if (key in attrs) {
      console.warn(`  ! ${c.id}: Key-Kollision ${k} -> ${key} (überschreibt Wert)`);
    }
    attrs[key] = v;
  }

  // Auf die vom Generator erwarteten Felder reduzieren + Bild/Quelle erhalten.
  // Textfixes nur auf deutschsprachige Anzeigefelder + Attributwerte anwenden —
  // NICHT auf id, URLs oder (englische) Bild-Attributionen.
  const qid = String(c.sourceUrl || '').match(/\/wiki\/(Q\d+)/)?.[1];
  const canonical = c.category === 'language' ? CANONICAL_LANGUAGE_BY_QID.get(qid) : null;
  const out = {
    id: canonical?.id || c.id,
    name: canonical?.name || fixText(c.name),
    category: c.category,
    attributes: fixTextDeep(attrs),
    funFact: fixText(c.funFact || ''),
    sourceName: fixText(c.sourceName || ''),
    sourceUrl: c.sourceUrl || '',
    verifyNote: fixText(c.verifyNote || ''),
    // Bildfelder für Provenance + späteres Museum mitnehmen, wie vorgefunden.
    imageFile: c.imageFile || '',
    imageLicense: c.imageLicense || '',
    imageAttribution: c.imageAttribution || ''
  };
  if (canonical?.aliases?.length) out.aliases = canonical.aliases;
  // Marker der Bild-Recherche ("kein freies Bild gefunden") mitführen,
  // damit ein späterer Bilder-Refresh weiß, wo noch Lücken sind.
  if (c._imgProblem) out._imgProblem = c._imgProblem;
  return out;
}

/**
 * Liest eine Harvest-Datei als JSON. Ein anderer Agent aktualisiert die
 * Bildfelder dieser Dateien PARALLEL — eine halb geschriebene Datei führt zu
 * einem Parse-Fehler. Dann: 30 Sekunden warten und genau einmal neu lesen.
 */
async function readHarvestJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.warn(`  ! ${path}: JSON.parse fehlgeschlagen (${err.message}) — warte 30 s und lese neu …`);
    await new Promise(resolve => setTimeout(resolve, 30000));
    return JSON.parse(readFileSync(path, 'utf8')); // zweiter Fehlschlag bricht ab (gewollt)
  }
}

// --- Zusammenführen + Dedup --------------------------------------------------
const merged = [];
const idsByCat = {};       // Kategorie -> Set(id)
const namesByCat = {};     // Kategorie -> Set(normalisierter Name)
const dropped = [];
const fileStats = {};

for (const file of FILES) {
  const arr = await readHarvestJson(join(HARVEST, file));
  let kept = 0;
  for (const c0 of arr) {
    // Manuelle Drops VOR der Normalisierung (deren Keys brauchen keine Aliase).
    if (MANUAL_DROP.has(c0.id)) {
      dropped.push({ name: c0.name, category: c0.category, reason: 'MANUAL_DROP (inhaltliche Dublette von meistuebersetzes-buch)' });
      continue;
    }
    const c = normalizeConcept(c0);
    (idsByCat[c.category] ||= new Set());
    (namesByCat[c.category] ||= new Set());
    const nn = norm(c.name);
    let reason = null;
    if (idsByCat[c.category].has(c.id)) reason = `id-Kollision (${c.id})`;
    else if (namesByCat[c.category].has(nn)) reason = `Name vorhanden (${c.name})`;
    if (reason) { dropped.push({ name: c.name, category: c.category, reason }); continue; }
    idsByCat[c.category].add(c.id);
    namesByCat[c.category].add(nn);
    merged.push(c);
    kept++;
  }
  fileStats[file] = { in: arr.length, kept };
}

// --- Bericht -----------------------------------------------------------------
const byCat = {};
for (const c of merged) byCat[c.category] = (byCat[c.category] || 0) + 1;

console.log('=== MERGE LINGUA ===');
for (const f of FILES) console.log(`  ${f.padEnd(22)} ${fileStats[f].kept}/${fileStats[f].in} behalten`);
console.log(`\nKonzepte gesamt: ${merged.length}  (verworfen ${dropped.length})`);
console.log('Nach Kategorie:', byCat);
if (dropped.length) {
  console.log('\n--- Verworfen ---');
  dropped.forEach(d => console.log(`  - ${d.category}/${d.name} [${d.reason}]`));
}
console.log('\n--- Quasi-Dubletten über Kategoriegrenzen (BEHALTEN, nur zur Info) ---');
CROSS_CATEGORY_NEAR_DUPES.forEach(d => console.log('  ~ ' + d));

if (WRITE) {
  assertPreservesExistingConceptIds(OUT_PATH, merged);
  writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${OUT_PATH} (${merged.length} Konzepte)`);
} else {
  console.log('\nDry-Run. Mit --write schreiben.');
}
