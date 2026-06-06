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

/** Deutsche Zahlformatierung: Punkt als Tausender-, Komma als Dezimaltrenner. */
function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

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

/** k kategorische Distraktoren: erste abweichende Werte in Pool-Reihenfolge. */
function pickCategorical(correct, pool, k = 3) {
  return [...new Set(pool.map(String))].filter(v => v !== String(correct)).slice(0, k);
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

// --- Selbstverräter-Schutz (identisch zu Astra/Homo) ---------------------
// Verwirft Fragen, deren Antwort schon im Hinweis steckt. Generische Stamm-
// Wörter schlagen bewusst NICHT an (Token-Mindestlänge, kein Hinweis->Antwort-Match).
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

// --- Faktenbasis laden ---------------------------------------------------
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

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
    image: c.imageFile
      ? { url: c.imageFile, license: c.imageLicense || '', attribution: c.imageAttribution || '' }
      : null
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
  {
    category: 'animal', attr: 'maxWeightKg', kind: 'name', type: 'natura-animal-weight-rev', difficulty: 4,
    subject: c => `${deNum(cleanNum(c.attributes.maxWeightKg))} kg`,
    prompt: c => `Welches dieser Tiere wiegt bis zu ${deNum(cleanNum(c.attributes.maxWeightKg))} kg?`
  },
  {
    category: 'animal', attr: 'lifespanYears', kind: 'name', type: 'natura-animal-lifespan-rev', difficulty: 4,
    subject: c => `${deNum(cleanNum(c.attributes.lifespanYears))} Jahre`,
    prompt: c => `Welches dieser Tiere kann bis zu ${deNum(cleanNum(c.attributes.lifespanYears))} Jahre alt werden?`
  },

  // ==== Pflanzen (plant) =================================================
  {
    category: 'plant', attr: 'scientificName', kind: 'cat', type: 'natura-plant-sciname', difficulty: 4,
    prompt: c => `Wie lautet der wissenschaftliche (lateinische) Name der Pflanze ${c.name}?`
  },
  {
    category: 'plant', attr: 'maxHeightM', kind: 'num', type: 'natura-plant-height', difficulty: 3,
    prompt: c => `Welche maximale Höhe erreicht ${c.name}?`,
    format: v => `${deNum(v)} m`
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
  }
];

// --- Fragen generieren ---------------------------------------------------
const questions = [];

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];

  // Distraktor-Pools je Template einmal aufbauen.
  let catPool = [];   // kategorische Werte (oder Namen bei kind='name')
  let numPool = [];   // rohe Zahlen für kind='num'
  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    if (tpl.kind === 'name') {
      catPool.push(c.name);
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

    // Korrekte Antwort bestimmen.
    let correct, distractors;
    if (tpl.kind === 'name') {
      const n = cleanNum(c.attributes[tpl.attr]);
      if (n === null) continue;            // ohne saubere Zahl keine Reverse-Frage
      correct = c.name;
      distractors = pickCategorical(correct, catPool);
    } else if (tpl.kind === 'num') {
      const n = cleanNum(c.attributes[tpl.attr]);
      if (n === null) continue;
      correct = tpl.format(n);
      distractors = pickNumeric(n, numPool, tpl.format);
    } else { // 'cat'
      const v = c.attributes[tpl.attr];
      if (v === undefined || v === null || v === '') continue;
      if (tpl.poolFilter && !tpl.poolFilter(v)) continue;
      correct = String(v);
      distractors = pickCategorical(correct, catPool);
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
