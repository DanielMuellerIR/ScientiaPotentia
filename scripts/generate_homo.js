/**
 * Generator fuer die Homo-Domain (Mensch & Körper / Anatomie & Physiologie).
 *
 * Liest scripts/data_sources/homo_raw.json (verifizierte Faktenbasis) und erzeugt:
 *   - public/data/concepts_homo.json  : Konzeptspeicher (Map id -> Konzept)
 *   - public/data/questions_homo.json : generierte Multiple-Choice-Fragen
 *
 * Aufbau analog zu generate_astra.js. Distraktoren stammen aus derselben
 * Kategorie/demselben Attribut -> plausibel und nicht trivial ausschliessbar.
 *
 * Aufruf: node scripts/generate_homo.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'homo_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_homo.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_homo.json');

const DOMAIN = 'homo';

/** Deutsche Zahlformatierung: Punkt als Tausender-, Komma als Dezimaltrenner. */
function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

/** Bis zu 3 Distraktoren (numerisch: naechstliegende Werte; sonst Reihenfolge). */
function pickDistractors(correct, pool, numeric) {
  const unique = [...new Set(pool.map(v => String(v)))].filter(v => v !== String(correct));
  if (numeric) {
    const cNum = Number(correct);
    unique.sort((a, b) => Math.abs(parseFloat(a) - cNum) - Math.abs(parseFloat(b) - cNum));
  }
  return unique.slice(0, 3);
}

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

const byCategory = {};
for (const c of raw) (byCategory[c.category] ||= []).push(c);

// --- Konzeptspeicher ------------------------------------------------------
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
    source: { name: c.sourceName, url: c.sourceUrl || '' }
  };
}

// --- Frage-Templates ------------------------------------------------------
const templates = [
  // ---- Knochen --------------------------------------------------------
  {
    category: 'bone', attr: 'region', type: 'homo-bone-region', difficulty: 1,
    prompt: c => `In welcher Körperregion liegt der Knochen „${c.name}"?`,
    format: v => v
  },
  {
    category: 'bone', attr: 'latinName', type: 'homo-bone-latin', difficulty: 3,
    prompt: c => `Wie lautet der lateinische (anatomische) Name des Knochens „${c.name}"?`,
    format: v => v
  },
  // ---- Muskeln --------------------------------------------------------
  {
    category: 'muscle', attr: 'location', type: 'homo-muscle-location', difficulty: 2,
    prompt: c => `In welcher Körperregion liegt der Muskel „${c.name}"?`,
    format: v => v
  },
  // ---- Organe ---------------------------------------------------------
  {
    category: 'organ', attr: 'system', type: 'homo-organ-system', difficulty: 2,
    prompt: c => `Zu welchem Organsystem gehört „${c.name}" hauptsächlich?`,
    format: v => v
  },
  {
    category: 'organ', attr: 'approxWeightGrams', type: 'homo-organ-weight', difficulty: 3,
    prompt: c => `Welches ungefähre Gewicht hat „${c.name}" beim Erwachsenen?`,
    format: v => `${deNum(v)} g`, numeric: true
  },
  // ---- Physiologische Eckwerte (nur numerische Werte -> saubere MCQ) ---
  {
    category: 'body_fact', attr: '__valueUnit__', type: 'homo-bodyfact-value', difficulty: 2,
    prompt: c => `Welche Angabe gehört zu: „${c.name}"?`,
    format: (_v, c) => `${c.attributes.value}${c.attributes.unit ? ' ' + c.attributes.unit : ''}`,
    valueUnit: true,
    skip: c => !/\d/.test(String(c.attributes.value)) // name-wertige Fakten (z.B. "Haut") überspringen
  },
  // ---- Hominine Arten -------------------------------------------------
  {
    category: 'species', attr: 'epoch', type: 'homo-species-epoch', difficulty: 3,
    prompt: c => `In welchen Zeitraum fällt „${c.name}"?`,
    format: v => v
  },

  // ==== Erweiterte Fragetypen (Stand 2026-06-04, Richtung 5000) ============
  // Nutzen nur bereits verifizierte Attribute -> keine neuen Fakten, nur echte
  // zusaetzliche Lernwinkel.

  // ---- Knochen: lateinischer Name -> deutscher Name (Gegenrichtung) ---
  {
    category: 'bone', attr: 'latinName', type: 'homo-bone-latin-rev', difficulty: 3, nameAnswer: true,
    prompt: c => `Welcher Knochen trägt den lateinischen Namen „${c.attributes.latinName}"?`
  },
  // ---- Menschenarten: Ursprungsregion ---------------------------------
  {
    category: 'species', attr: 'region', type: 'homo-species-region', difficulty: 2,
    prompt: c => `In welcher Region liegt der Ursprung von „${c.name}"?`,
    format: v => v
  },
  // ---- Körperwerte: Wert -> Bezeichnung (Gegenrichtung) ---------------
  {
    category: 'body_fact', attr: 'value', type: 'homo-bodyfact-name', difficulty: 3, nameAnswer: true,
    prompt: c => `Welche Körperangabe beträgt ungefähr ${c.attributes.value}${c.attributes.unit ? ' ' + c.attributes.unit : ''}?`,
    skip: c => !/\d/.test(String(c.attributes.value)) // nur numerische Werte
  }
];

// --- Fragen generieren ----------------------------------------------------
const questions = [];

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];
  // nameAnswer: korrekte Antwort ist der Konzeptname (Reverse-Fragen), Distraktoren
  // sind andere Namen derselben Kategorie. Das im Prompt genannte Attribut muss da sein.
  const valuePool = conceptsInCat
    .filter(c => !(tpl.skip && tpl.skip(c)))
    .map(c => (tpl.nameAnswer ? c.name : tpl.valueUnit ? tpl.format(null, c) : tpl.format(c.attributes[tpl.attr], c)));

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    const rawValue = tpl.nameAnswer
      ? c.attributes[tpl.attr]
      : (tpl.valueUnit ? c.attributes.value : c.attributes[tpl.attr]);
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    const correct = tpl.nameAnswer ? c.name : (tpl.valueUnit ? tpl.format(null, c) : tpl.format(rawValue, c));

    let pool = valuePool.slice();
    if (tpl.extraDistractors) pool = pool.concat(tpl.extraDistractors);
    const distractors = pickDistractors(correct, pool, tpl.numeric);
    if (distractors.length < 1) continue;

    questions.push({
      id: `q_${DOMAIN}_${c.id}_${tpl.type}`,
      entityId: `${DOMAIN}:${c.id}`,
      entityType: c.category,
      type: tpl.type,
      difficulty: tpl.difficulty,
      prompt: tpl.prompt(c),
      correctAnswer: correct,
      options: [correct, ...distractors],
      silhouetteSvgPath: null,
      mapTargetId: null
    });
  }
}

writeFileSync(CONCEPTS_OUT, JSON.stringify(concepts, null, 2), 'utf8');
writeFileSync(QUESTIONS_OUT, JSON.stringify(questions, null, 2), 'utf8');

const byType = {};
for (const q of questions) byType[q.type] = (byType[q.type] || 0) + 1;
const byDiff = {};
for (const q of questions) byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
console.log(`Konzepte: ${Object.keys(concepts).length}`);
console.log(`Fragen:   ${questions.length}`);
console.log('Nach Typ:', byType);
console.log('Nach Schwierigkeit:', byDiff);
