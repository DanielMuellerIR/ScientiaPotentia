/**
 * Generator für die Natura-Domain (Natur & Umwelt).
 *
 * Liest die verifizierte, vereinheitlichte Faktenbasis aus
 * scripts/data_sources/natura_raw.json (erzeugt von merge_natura.js) und schreibt:
 *   - public/data/concepts_natura.json  : Konzeptspeicher (Map key -> Konzept)
 *   - public/data/questions_natura.json : generierte Multiple-Choice-Fragen
 *
 * Leitidee (wie Astra/Homo): Die Recherche/Verifikation ist die eigentliche Arbeit;
 * das Templating hier leitet nur mechanisch ab. Distraktoren stammen IMMER aus
 * derselben Kategorie und demselben Attribut -> plausibel, nicht trivial ausschließbar.
 *
 * Unterschied zu generate_astra.js: numerische Distraktoren werden aus den ROHEN
 * Zahlen nach Nähe gewählt (echte „am verwechselbarsten"), nicht aus formatierten
 * Strings. Außerdem überspringt die Status-Frage mehrdeutige Schutzstatus.
 *
 * Aufruf: node scripts/generate_natura.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickBalanced, pickNumeric, numericDistractors } from './lib/quizrandom.js';
import { norm, deNum, optionKey, distinctOptionValues, revealsAnswerStrict as revealsAnswer } from './lib/generator_text.js';
import { buildImageMetadata } from '../src/utils/imageCredits.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'natura_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_natura.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_natura.json');

const DOMAIN = 'natura';

// Kanonische IUCN-Schutzstatus (deckungsgleich mit merge_natura.js). Nur diese
// gelten als eindeutig; mehrdeutige Status liefern KEINE Status-Frage.
const STATUS_CANON_SET = new Set([
  'Nicht gefährdet (LC)', 'Potenziell gefährdet (NT)', 'Gefährdet (VU)',
  'Stark gefährdet (EN)', 'Vom Aussterben bedroht (CR)',
  'Ungenügende Datenlage (DD)', 'Nicht bewertet (NE)'
]);

// --- kleine Helfer -------------------------------------------------------

/**
 * Wandelt einen Attributwert in eine saubere Zahl ODER null.
 * Akzeptiert echte Zahlen und rein numerische Strings (auch mit dt. Komma).
 * Bereiche/Text ("3–5,2", "≥150", "bis 6000") -> null (werden übersprungen).
 */
function cleanNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^[0-9]+([.,][0-9]+)?$/.test(t)) return Number(t.replace(',', '.'));
  }
  return null;
}

/** k kategorische Distraktoren: seeded-zufällig aus dem Pool (kein Längen-Bias;
 *  `.slice` nahm sonst feste erste-k Einträge → richtige Antwort fast immer
 *  längste/kürzeste Option). Deckt auch die Reverse-Namens-Distraktoren ab, die
 *  über reverseSafeDistractors → pickCategorical laufen. */
function pickCategorical(correct, pool, k = 3, seed = String(correct)) {
  // `seed` ist die Konzept-ID der Frage; warum das noetig ist, steht bei
  // pickBalanced in ./lib/quizrandom.js.
  return pickBalanced(correct, distinctOptionValues(pool)
    .filter(value => optionKey(value) !== optionKey(correct)), k, seed);
}

/**
 * Reverse-Korrektheits-Filter (kritisch für name-Kind-Fragen).
 *
 * Bei Reverse-Fragen ist die Antwort ein Konzeptname und der Hinweis ein
 * Attributwert, z.B. „Welches dieser Tiere gehört zur Klasse Säugetiere?".
 * Distraktoren sind ANDERE Tiernamen — aber nur korrekt, wenn KEIN Distraktor
 * denselben abgefragten Wert trägt. Sonst wären mehrere Optionen richtig.
 *
 * Diese Funktion liefert die zulässigen Distraktor-Namen: alle Konzepte der
 * Kategorie, deren Wert beim Vergleichs-Attribut (compareAttr) sich vom
 * abgefragten Wert (askedValue) unterscheidet — und nie das Subjekt selbst.
 *
 * compareValue normalisiert den Wert für den Vergleich:
 *   - 'cat' (kategorisch): roher String-Vergleich (class/order/status …).
 *   - 'num' (numerisch):   über cleanNum, damit „650" und 650 gleich zählen
 *                          (verhindert ambige Zahlen-Reverse wie 2000 kg / 650 kg,
 *                          die es bei den bestehenden -rev-Templates sonst gäbe).
 *
 * Concepts ohne sauber vergleichbaren Wert (z.B. Bereich „3–5") werden vom
 * Distraktor-Pool ausgeschlossen, weil ihre Korrektheit nicht entscheidbar ist.
 */
function reverseSafeDistractors(subjectConcept, askedValue, conceptsInCat, compareAttr, compareKind) {
  // Den abgefragten Wert in dieselbe Vergleichsform bringen wie die Pool-Werte.
  const askedCmp = compareKind === 'num' ? cleanNum(askedValue) : String(askedValue);
  const names = [];
  for (const c of conceptsInCat) {
    if (c === subjectConcept) continue;                  // nie das Subjekt selbst
    const rawVal = c.attributes[compareAttr];
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;
    const cmp = compareKind === 'num' ? cleanNum(rawVal) : String(rawVal);
    if (cmp === null) continue;                          // unvergleichbar -> ausschließen
    if (cmp === askedCmp) continue;                      // gleicher Wert -> wäre auch richtig
    names.push(c.name);
  }
  return [...new Set(names)];
}

/**
 * k numerische Distraktoren: die dem korrekten Wert NÄCHSTLIEGENDEN Zahlen aus
 * dem Pool (am verwechselbarsten), danach mit dem Template formatiert.
 */
// pickNumeric: jetzt zentral in ./lib/quizrandom.js (mit Proximity-Guard fuer Messgroessen).

// --- Kontinent aus dem Verbreitungsgebiet ---------------------------------
// Das Attribut 'range' ist ein belegter Freitext ("Afrika südlich der Sahara",
// "Kolumbien"). Als Antwortoption taugt er nicht: die Texte sind 3 bis 115
// Zeichen lang, die richtige Lösung wäre über ihre Länge erratbar, und viele
// Tiere teilen sich denselben Wortlaut. Stattdessen wird daraus mechanisch ein
// Kontinent abgeleitet — kein neuer Fakt, nur eine Vergröberung der bereits
// geprüften Angabe. Die Ableitung ist bewusst streng: Sie greift nur, wenn
// genau eine Kontinentfamilie anschlägt und der Text keine erdteilübergreifende
// Angabe enthält. Alles andere bleibt ohne Wert und erzeugt keine Frage.
const CONTINENT_PATTERNS = [
  ['Afrika', /afrika|sahara|sahel|madagask|kongo|serengeti|namib|kalahari|äthiop|kenia|tansania|sambia|simbabwe|botswana|angola|kamerun|nigeria|senegal|marokko|ägypten|gambia|ghana|mali\b|sudan|somalia|uganda|ruanda|mosambik|malawi|tschad|tunesien|algerien|libyen|kapprovinz|sansibar|komoren|seychellen|niger(delta|\b)|elfenbeinküste|benin|togo|gabun|eritrea|dschibuti|lesotho|swasiland|okavango/],
  ['Europa', /europa|europä|skandinav|alpen|iberisch|balkan|britisch|karpaten|pyrenäen|deutschland|frankreich|spanien|italien|griechenland|polen|schweden|norwegen|finnland|dänemark|niederlande|schweiz|österreich|ungarn|rumänien|bulgarien|portugal|irland|schottland/],
  ['Asien', /asien|asiat|indien|indisch|china|chines|japan|himalaja|himalaya|sibirien|borneo|sumatra|\bjava\b|sulawesi|philippin|indonesi|malaysia|thailand|vietnam|korea|mongolei|iran\b|arab|kaukasus|nepal|bhutan|myanmar|\bburma|sri lanka|taiwan|kasachstan|afghanistan|pakistan|bangladesch|laos|kambodscha|tibet|jemen|oman|israel|türkei|anatolien|naher osten|levante|syrien|irak|bali\b|lombok|sundainseln|molukken|kamtschatka|kurilen/],
  // Mittelamerika und die Karibik sind keine eigenen Erdteile, sondern Teil
  // Nordamerikas (Sieben-Kontinente-Modell). Sie stehen darum in derselben
  // Familie: Die Frage lautet „Auf welchem Erdteil …?", und „Mittelamerika" war
  // als Antwort darauf sachlich falsch — beim kubanischen Bienenkolibri ebenso
  // wie bei den mittelamerikanischen Schildkröten.
  ['Nordamerika', /nordamerika|kanada|alaska|\busa\b|vereinigte staaten|mexiko|mexik|kalifornien|florida|texas|rocky mountains|great plains|appalach|mississippi|arizona|nevada|oregon|alberta|ontario|québec|quebec|yukon|labrador|neuengland|großen seen|mittelamerika|zentralamerika|costa rica|panama|guatemala|honduras|nicaragua|belize|karibik|karibisch|kuba\b|jamaika|hispaniola|puerto rico|antillen|bahamas|trinidad|dominikanische/],
  ['Südamerika', /südamerika|amazon|anden|brasilien|argentin|\bperu\b|chile|kolumbien|venezuela|ecuador|bolivien|patagonien|galapagos|galápagos|guyana|guayana|paraguay|uruguay|surinam|feuerland|orinoko|pantanal|cerrado/],
  ['Australien und Ozeanien', /australi|neuseeland|neuguinea|tasmani|ozeanien|melanesien|polynesien|fidschi|hawaii|papua|salomonen|vanuatu|samoa|queensland|new south wales|victoria\b/],
  ['Antarktis', /antarkti|südpolar/]
];
// Angaben, die mehrere Erdteile umfassen oder gar keinen nennen (Meere, Tropen,
// "Eurasien", Spannweiten mit "bis", Aufzählungen wie "Nord- und Mittelamerikas").
const CONTINENT_BLOCKERS = /eurasi|weltweit|kosmopolit|zirkumpolar|erdteil|kontinent|\bozean|weltmeer|alle meere|tiefsee|arktis|holarkt|paläarkt|nearkt|neotrop|tropen|subtropen|nordhalbkugel|südhalbkugel|\bbis\b|sowie|außer |mittelmeer|atlantik|pazifik|indischer|- und /;
function continentFromRange(rangeText) {
  const text = String(rangeText || '').toLowerCase();
  if (!text || CONTINENT_BLOCKERS.test(text)) return null;
  const hits = CONTINENT_PATTERNS.filter(([, pattern]) => pattern.test(text));
  return hits.length === 1 ? hits[0][0] : null;
}

// --- Faktenbasis laden ---------------------------------------------------
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Abgeleiteten Kontinent ergaenzen, bevor Konzeptspeicher und Templates lesen.
for (const c of raw) {
  if (c.category !== 'animal') continue;
  const continent = continentFromRange(c.attributes && c.attributes.range);
  if (continent) c.attributes.continent = continent;
}

// Konzepte nach Kategorie gruppieren (für kategorie-interne Distraktoren).
const byCategory = {};
for (const c of raw) (byCategory[c.category] ||= []).push(c);

// --- Konzeptspeicher bauen ----------------------------------------------
// Key-Schema: "<domain>:<conceptId>" (z.B. natura:blauwal).
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
// kind: 'cat' (kategorisch), 'num' (numerisch, nutzt rohe Zahl), 'name' (Reverse:
// Antwort = Konzeptname). attr = abgefragtes Attribut. skip = optionaler Filter.
const templates = [
  // ==== Tiere (animal) — die große, gut besetzte Kategorie ===============
  {
    category: 'animal', attr: 'class', kind: 'cat', type: 'natura-animal-class', difficulty: 2,
    prompt: c => `Zu welcher Tierklasse gehört ${c.name}?`
  },
  {
    category: 'animal', attr: 'conservationStatus', kind: 'cat', type: 'natura-animal-status', difficulty: 3,
    prompt: c => `Welchen Gefährdungsstatus (IUCN) hat ${c.name}?`,
    // Nur eindeutige (kanonisierte) Status fragen.
    skip: c => !STATUS_CANON_SET.has(c.attributes.conservationStatus),
    poolFilter: v => STATUS_CANON_SET.has(v)
  },
  {
    category: 'animal', attr: 'order', kind: 'cat', type: 'natura-animal-order', difficulty: 4,
    prompt: c => `Zu welcher Ordnung gehört ${c.name}?`
  },
  {
    // 'continent' wird aus dem belegten Verbreitungsgebiet abgeleitet (siehe
    // continentFromRange). Tiere ohne eindeutigen Erdteil tragen das Feld nicht
    // und erzeugen darum keine Frage.
    category: 'animal', attr: 'continent', kind: 'cat', type: 'natura-animal-continent', difficulty: 2,
    prompt: c => `Auf welchem Erdteil ist ${c.name} heimisch?`
  },
  {
    category: 'animal', attr: 'maxWeightKg', kind: 'num', type: 'natura-animal-weight', difficulty: 3,
    prompt: c => `Wie viel wiegt ${c.name} höchstens?`,
    format: v => `${deNum(v)} kg`
  },
  {
    category: 'animal', attr: 'maxLengthCm', kind: 'num', type: 'natura-animal-length', difficulty: 3,
    prompt: c => `Welche maximale Körperlänge erreicht ${c.name}?`,
    format: v => `${deNum(v)} cm`
  },
  {
    category: 'animal', attr: 'lifespanYears', kind: 'num', type: 'natura-animal-lifespan', difficulty: 3,
    prompt: c => `Wie alt kann ${c.name} höchstens werden?`,
    format: v => `${deNum(v)} Jahre`
  },
  {
    category: 'animal', attr: 'topSpeedKmh', kind: 'num', type: 'natura-animal-speed', difficulty: 4,
    prompt: c => `Welche Höchstgeschwindigkeit erreicht ${c.name}?`,
    format: v => `${deNum(v)} km/h`
  },
  {
    category: 'animal', attr: 'maxWingspanCm', kind: 'num', type: 'natura-animal-wingspan', difficulty: 4,
    prompt: c => `Welche maximale Flügelspannweite hat ${c.name}?`,
    format: v => `${deNum(v)} cm`
  },
  // Reverse: vom Wert auf den Namen (Distraktoren = andere Tiernamen).
  // WICHTIG (Reverse-Korrektheit): Jedes name-Template bekommt compareKind, damit
  // der Distraktor-Filter Konzepte mit gleichem Wert ausschließt (sonst mehrdeutig).
  {
    category: 'animal', attr: 'maxWeightKg', kind: 'name', type: 'natura-animal-weight-rev', difficulty: 4,
    compareKind: 'num',
    subject: c => `${deNum(cleanNum(c.attributes.maxWeightKg))} kg`,
    prompt: c => `Welches dieser Tiere wiegt bis zu ${deNum(cleanNum(c.attributes.maxWeightKg))} kg?`
  },
  {
    category: 'animal', attr: 'lifespanYears', kind: 'name', type: 'natura-animal-lifespan-rev', difficulty: 4,
    compareKind: 'num',
    subject: c => `${deNum(cleanNum(c.attributes.lifespanYears))} Jahre`,
    // „kann bis zu“ wäre auch für ein Tier mit einem höheren Höchstalter wahr.
    // Das Höchstalter hält die numerische Reverse-Frage eindeutig.
    prompt: c => `Welches dieser Tiere erreicht ein Höchstalter von ${deNum(cleanNum(c.attributes.lifespanYears))} Jahren?`
  },
  // Weitere numerische Reverse-Fragen (Wert -> Tiername). Distraktoren-Pool und
  // korrekte Eindeutigkeit übernimmt der Reverse-Korrektheits-Filter über compareKind.
  {
    category: 'animal', attr: 'maxLengthCm', kind: 'name', type: 'natura-animal-length-rev', difficulty: 4,
    compareKind: 'num',
    subject: c => `${deNum(cleanNum(c.attributes.maxLengthCm))} cm`,
    prompt: c => `Welches dieser Tiere erreicht eine maximale Körperlänge von ${deNum(cleanNum(c.attributes.maxLengthCm))} cm?`
  },
  {
    category: 'animal', attr: 'topSpeedKmh', kind: 'name', type: 'natura-animal-speed-rev', difficulty: 4,
    compareKind: 'num',
    subject: c => `${deNum(cleanNum(c.attributes.topSpeedKmh))} km/h`,
    prompt: c => `Welches dieser Tiere erreicht eine Höchstgeschwindigkeit von ${deNum(cleanNum(c.attributes.topSpeedKmh))} km/h?`
  },
  {
    category: 'animal', attr: 'maxWingspanCm', kind: 'name', type: 'natura-animal-wingspan-rev', difficulty: 4,
    compareKind: 'num',
    subject: c => `${deNum(cleanNum(c.attributes.maxWingspanCm))} cm`,
    prompt: c => `Welches dieser Tiere hat eine maximale Flügelspannweite von ${deNum(cleanNum(c.attributes.maxWingspanCm))} cm?`
  },
  // Kategorische Reverse-Fragen (Wert -> Tiername). Hier ist der Reverse-Korrektheits-
  // Filter zwingend: bei class/order/status teilen sich oft viele Tiere denselben Wert.
  {
    category: 'animal', attr: 'class', kind: 'name', type: 'natura-animal-class-rev', difficulty: 2,
    compareKind: 'cat',
    subject: c => c.attributes.class,
    prompt: c => `Welches dieser Tiere gehört zur Tierklasse „${c.attributes.class}“?`
  },
  {
    category: 'animal', attr: 'order', kind: 'name', type: 'natura-animal-order-rev', difficulty: 4,
    compareKind: 'cat',
    // Unspezifische Sammelangabe „diverse Ordnungen" überspringen (kein echter Wert).
    skip: c => !c.attributes.order || c.attributes.order === 'diverse Ordnungen',
    subject: c => c.attributes.order,
    prompt: c => `Welches dieser Tiere gehört zur Ordnung „${c.attributes.order}“?`
  },
  {
    category: 'animal', attr: 'conservationStatus', kind: 'name', type: 'natura-animal-status-rev', difficulty: 3,
    compareKind: 'cat',
    // Nur eindeutige (kanonisierte) Status als korrekte Antwort zulassen.
    skip: c => !STATUS_CANON_SET.has(c.attributes.conservationStatus),
    subject: c => c.attributes.conservationStatus,
    prompt: c => `Welches dieser Tiere hat den IUCN-Gefährdungsstatus „${c.attributes.conservationStatus}“?`
  },

  // ==== Pflanzen (plant) =================================================
  {
    category: 'plant', attr: 'scientificName', kind: 'cat', type: 'natura-plant-sciname', difficulty: 4,
    prompt: c => `Wie lautet der wissenschaftliche (lateinische) Name der Pflanze ${c.name}?`
  },
  {
    // Vorwärts: Ursprungsregion der Pflanze. Werte sind einzelne Freitexte,
    // aber als Herkunftsangaben gut unterscheidbar (10 besetzt -> Pool >= 4).
    category: 'plant', attr: 'origin', kind: 'cat', type: 'natura-plant-origin', difficulty: 3,
    prompt: c => `Woher stammt ${c.name} ursprünglich?`
  },
  // Keine Herkunfts-Umkehrfrage: Freie Angaben wie „Europa“ und „Europa und
  // Westasien“ überlappen fachlich. Ein byteweicher Vergleich könnte deshalb
  // mehrere richtige Pflanzennamen als Optionen zulassen.
  {
    // Reverse: wissenschaftlicher Name -> Pflanzenname. Der Reverse-Korrektheits-
    // Filter sorgt dafür, dass kein Distraktor denselben wiss. Namen trägt (hier
    // ohnehin alle eindeutig), und schützt zusätzlich gegen den Selbstverräter.
    category: 'plant', attr: 'scientificName', kind: 'name', type: 'natura-plant-sciname-rev', difficulty: 4,
    compareKind: 'cat',
    subject: c => c.attributes.scientificName,
    prompt: c => `Welche Pflanze trägt den wissenschaftlichen Namen „${c.attributes.scientificName}“?`
  },
  {
    category: 'plant', attr: 'maxHeightM', kind: 'num', type: 'natura-plant-height', difficulty: 3,
    prompt: c => `Welche maximale Höhe erreicht ${c.name}?`,
    format: v => `${deNum(v)} m`
  },
  {
    // Gleiche Höhe bleibt als Antwortkonflikt ausgeschlossen. Dadurch besitzt
    // jede erzeugte Vierergruppe genau eine passende Pflanzenart.
    category: 'plant', attr: 'maxHeightM', kind: 'name', type: 'natura-plant-height-rev', difficulty: 4,
    compareKind: 'num',
    subject: c => `${deNum(cleanNum(c.attributes.maxHeightM))} m`,
    prompt: c => `Welche dieser Pflanzen erreicht eine maximale Höhe von ${deNum(cleanNum(c.attributes.maxHeightM))} m?`
  },
  {
    category: 'plant', attr: 'maxAgeYears', kind: 'num', type: 'natura-plant-age', difficulty: 4,
    prompt: c => `Welches Alter kann ${c.name} höchstens erreichen?`,
    format: v => `${deNum(v)} Jahre`
  },

  // ==== Pilze (fungus) ===================================================
  {
    category: 'fungus', attr: 'scientificName', kind: 'cat', type: 'natura-fungus-sciname', difficulty: 4,
    prompt: c => `Wie lautet der wissenschaftliche (lateinische) Name von ${c.name}?`
  },

  // ==== Minerale (mineral) ===============================================
  {
    category: 'mineral', attr: 'mohsHardness', kind: 'num', type: 'natura-mineral-mohs', difficulty: 3,
    // Die Mohs-Skala beginnt bei 1. Diese Antwort wäre stets die kleinste
    // Option; sie bleibt als Distraktor erhalten, wird aber nicht abgefragt.
    skipAsk: c => { const n = cleanNum(c.attributes.mohsHardness); return n !== null && n < 1.5; },
    prompt: c => `Welche Mohshärte hat ${c.name}?`,
    format: v => `${deNum(v)}`
  },
  {
    category: 'mineral', attr: 'kristallsystem', kind: 'cat', type: 'natura-mineral-crystal', difficulty: 4,
    prompt: c => `In welchem Kristallsystem kristallisiert ${c.name}?`
  },

  // ==== Geologie (geology) ===============================================
  {
    category: 'geology', attr: 'lage', kind: 'cat', type: 'natura-geology-location', difficulty: 3,
    prompt: c => `Wo befindet sich ${c.name}?`
  },
  {
    category: 'geology', attr: 'vulkantyp', kind: 'cat', type: 'natura-geology-volcanotype', difficulty: 4,
    prompt: c => `Zu welchem Vulkantyp zählt ${c.name}?`
  },
  // Geologischer Typ (Canyon, Vulkan, Wasserfall …)
  {
    category: 'geology', attr: 'typ', kind: 'cat', type: 'natura-geology-typ', difficulty: 3,
    prompt: c => `Was für eine geologische Formation ist ${c.name}?`
  },
  // Höhe in Metern (Gipfelhöhe, Meeresspiegel etc.) – numerisch
  {
    category: 'geology', attr: 'heightM', kind: 'num', type: 'natura-geology-height', difficulty: 3,
    prompt: c => `Auf welcher Höhe (in Metern über NN) befindet sich ${c.name}?`,
    format: v => `${deNum(v)} m`
  },
  // Reverse: Höhe -> Name
  {
    category: 'geology', attr: 'heightM', kind: 'name', type: 'natura-geology-height-rev', difficulty: 4,
    compareKind: 'num',
    subject: c => `${deNum(cleanNum(c.attributes.heightM))} m`,
    prompt: c => `Welche dieser geologischen Formationen liegt auf einer Höhe von ${deNum(cleanNum(c.attributes.heightM))} m?`
  },

  // ==== Minerale (mineral) — neue Attribute ==============================
  // Chemische Formel
  {
    category: 'mineral', attr: 'chemischeFormel', kind: 'cat', type: 'natura-mineral-formula', difficulty: 4,
    prompt: c => `Welche chemische Formel hat das Mineral ${c.name}?`
  },
  // Reverse: Formel -> Mineralname
  {
    category: 'mineral', attr: 'chemischeFormel', kind: 'name', type: 'natura-mineral-formula-rev', difficulty: 5,
    compareKind: 'cat',
    subject: c => c.attributes.chemischeFormel,
    prompt: c => `Welches Mineral hat die chemische Formel „${c.attributes.chemischeFormel}"?`
  },
  // Dichte in g/cm³ (numerisch, alle Werte sind saubere Dezimalzahlen)
  {
    category: 'mineral', attr: 'dichte', kind: 'num', type: 'natura-mineral-density', difficulty: 4,
    prompt: c => `Welche Dichte hat das Mineral ${c.name}?`,
    format: v => `${deNum(v)} g/cm³`
  },
  // Reverse: Dichte -> Mineralname
  {
    category: 'mineral', attr: 'dichte', kind: 'name', type: 'natura-mineral-density-rev', difficulty: 5,
    compareKind: 'num',
    subject: c => `${deNum(cleanNum(c.attributes.dichte))} g/cm³`,
    prompt: c => `Welches Mineral hat eine Dichte von ${deNum(cleanNum(c.attributes.dichte))} g/cm³?`
  },
  // ==== Pflanzen (plant) — neue Attribute ================================
  // Pflanzenfamilie
  {
    category: 'plant', attr: 'family', kind: 'cat', type: 'natura-plant-family', difficulty: 4,
    prompt: c => `Zu welcher Pflanzenfamilie gehört ${c.name}?`
  },
  // Reverse: Familie -> Pflanzenname
  {
    category: 'plant', attr: 'family', kind: 'name', type: 'natura-plant-family-rev', difficulty: 4,
    compareKind: 'cat',
    subject: c => c.attributes.family,
    prompt: c => `Welche dieser Pflanzen gehört zur Familie der ${c.attributes.family}?`
  },
  // Verwendung (Gewürz / Heilpflanze / Nahrungsmittel / Nutzpflanze)
  {
    category: 'plant', attr: 'usedAs', kind: 'cat', type: 'natura-plant-usedas', difficulty: 2,
    prompt: c => `Wie wird ${c.name} hauptsächlich genutzt?`
  },
  // Reverse: Verwendung -> Pflanzenname
  {
    category: 'plant', attr: 'usedAs', kind: 'name', type: 'natura-plant-usedas-rev', difficulty: 3,
    compareKind: 'cat',
    subject: c => c.attributes.usedAs,
    prompt: c => `Welche dieser Pflanzen wird hauptsächlich als ${c.attributes.usedAs} genutzt?`
  },

  // ==== Pilze (fungus) — neue Attribute ==================================
  // Essbarkeit (essbar / giftig / tödlich giftig / bedingt essbar / ungenießbar)
  {
    category: 'fungus', attr: 'essbarkeit', kind: 'cat', type: 'natura-fungus-essbarkeit', difficulty: 2,
    prompt: c => `Wie ist ${c.name} einzustufen?`
  },
  // Reverse: Essbarkeit -> Pilzname
  {
    category: 'fungus', attr: 'essbarkeit', kind: 'name', type: 'natura-fungus-essbarkeit-rev', difficulty: 3,
    compareKind: 'cat',
    subject: c => c.attributes.essbarkeit,
    prompt: c => `Welcher dieser Pilze gilt als „${c.attributes.essbarkeit}"?`
  },
  // Gattung – Selbstverräter-Guard fängt Überschneidungen wie „Morchel"/„Morcheln".
  {
    category: 'fungus', attr: 'gattung', kind: 'cat', type: 'natura-fungus-gattung', difficulty: 4,
    prompt: c => `Zu welcher Gattung gehört ${c.name}?`
  },
  // Reverse: Gattung -> Pilzname
  {
    category: 'fungus', attr: 'gattung', kind: 'name', type: 'natura-fungus-gattung-rev', difficulty: 4,
    compareKind: 'cat',
    subject: c => c.attributes.gattung,
    prompt: c => `Welcher dieser Pilze gehört zur Gattung ${c.attributes.gattung}?`
  }
];

// --- Fragen generieren ---------------------------------------------------
const questions = [];

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];

  // Distraktor-Pools je Template einmal aufbauen.
  // Hinweis: Für kind='name' (Reverse) bauen wir hier KEINEN globalen Namens-Pool
  // mehr auf. Die Distraktoren werden pro Frage über reverseSafeDistractors()
  // bestimmt, weil nur Konzepte mit ABWEICHENDEM Wert zulässig sind (Reverse-
  // Korrektheit). Numerische und kategorische Vorwärts-Pools bleiben wie gehabt.
  let catPool = [];   // kategorische Werte (Vorwärts-Templates, kind='cat')
  let numPool = [];   // rohe Zahlen für kind='num'
  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    if (tpl.kind === 'name') {
      // kein globaler Pool nötig (siehe oben) – pro Frage gefiltert.
    } else if (tpl.kind === 'num') {
      const n = cleanNum(c.attributes[tpl.attr]);
      if (n !== null) numPool.push(n);
    } else { // 'cat'
      const v = c.attributes[tpl.attr];
      if (v !== undefined && v !== null && v !== '' && (!tpl.poolFilter || tpl.poolFilter(v))) {
        catPool.push(v);
      }
    }
  }

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    // `skipAsk` lässt einen Wert im Distraktorpool, stellt aber keine Frage
    // dazu. So verschiebt sich der Skalenboden nicht zur nächstgrößeren Zahl.
    if (tpl.skipAsk && tpl.skipAsk(c)) continue;

    // Korrekte Antwort bestimmen.
    let correct, distractors;
    if (tpl.kind === 'name') {
      // Reverse: abgefragter Attributwert -> Konzeptname als Antwort.
      // compareKind steuert, wie der Wert für die Korrektheits-Prüfung verglichen
      // wird (numerisch vs. kategorisch). Default 'num' erhält das bisherige
      // Verhalten der bestehenden Zahlen-Reverse-Templates.
      const compareKind = tpl.compareKind || 'num';
      const askedRaw = c.attributes[tpl.attr];
      if (compareKind === 'num') {
        // Ohne saubere Zahl keine numerische Reverse-Frage (z.B. Bereich „3–5").
        if (cleanNum(askedRaw) === null) continue;
      } else {
        // Kategorisch: leeren/fehlenden Wert überspringen.
        if (askedRaw === undefined || askedRaw === null || askedRaw === '') continue;
      }
      correct = c.name;
      // Reverse-Korrektheit: nur Konzepte mit ABWEICHENDEM Wert sind faire Distraktoren.
      const safeNames = reverseSafeDistractors(c, askedRaw, conceptsInCat, tpl.attr, compareKind);
      // Bei <3 zulässigen Distraktoren ist keine 4-Optionen-Frage möglich -> überspringen.
      if (safeNames.length < 3) continue;
      distractors = pickCategorical(correct, safeNames, 3, c.id);
    } else if (tpl.kind === 'num') {
      const n = cleanNum(c.attributes[tpl.attr]);
      if (n === null) continue;
      correct = tpl.format(n);
      // Größenordnungs-Distraktoren, wo das Maß über ≥2 Größenordnungen streut
      // (Tier-Länge/-Gewicht/-Tempo, Pflanzenhöhe/-alter); sonst Nachbarwert.
      distractors = numericDistractors(n, numPool, tpl.format,
        { attribute: tpl.attr, seed: c.id });
    } else { // 'cat'
      const v = c.attributes[tpl.attr];
      if (v === undefined || v === null || v === '') continue;
      if (tpl.poolFilter && !tpl.poolFilter(v)) continue;
      correct = String(v);
      distractors = pickCategorical(correct, catPool, 3, c.id);
    }

    // Selbstverräter: steckt die Antwort schon im Hinweis, Frage verwerfen.
    const subject = tpl.subject ? tpl.subject(c) : c.name;
    if (revealsAnswer(subject, correct)) continue;

    // Faire Frage braucht mind. 1 Distraktor.
    if (distractors.length < 1) continue;

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
