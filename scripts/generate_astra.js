/**
 * Generator fuer die Astra-Domain (Astronomie).
 *
 * Liest die verifizierte Faktenbasis aus scripts/data_sources/astra_raw.json und
 * erzeugt daraus zwei Artefakte (analog zu Terra):
 *   - public/data/concepts_astra.json  : Konzeptspeicher (Map id -> Konzept),
 *                                         domainspezifisches Analogon zu geodb.entities
 *   - public/data/questions_astra.json : generierte Multiple-Choice-Fragen
 *
 * Leitidee laut Plan: Die Recherche/Verifikation der Fakten ist die eigentliche
 * Arbeit (passiert vorgelagert), das Templating hier ist nur die mechanische
 * Ableitung. Distraktoren stammen IMMER aus derselben Kategorie und demselben
 * Attribut -> plausibel und nicht trivial ausschliessbar.
 *
 * Aufruf: node scripts/generate_astra.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_PATH = join(__dirname, 'data_sources', 'astra_raw.json');
const CONCEPTS_OUT = join(ROOT, 'public', 'data', 'concepts_astra.json');
const QUESTIONS_OUT = join(ROOT, 'public', 'data', 'questions_astra.json');

const DOMAIN = 'astra';

// --- kleine Helfer -------------------------------------------------------

/** Deutsche Zahlformatierung: Punkt als Tausender-, Komma als Dezimaltrenner. */
function deNum(value) {
  if (typeof value !== 'number') value = Number(value);
  if (!isFinite(value)) return String(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 4 });
}

/**
 * Waehlt bis zu 3 Distraktoren aus einem Pool moeglicher Werte.
 * - numeric=true: die dem korrekten Wert NAECHSTLIEGENDEN Werte (am verwechselbarsten)
 * - numeric=false: die ersten abweichenden Werte in Pool-Reihenfolge
 * Der korrekte Wert wird stets ausgeschlossen, Duplikate werden entfernt.
 */
function pickDistractors(correct, pool, numeric) {
  const unique = [...new Set(pool.map(v => String(v)))].filter(v => v !== String(correct));
  if (numeric) {
    const cNum = Number(correct);
    unique.sort((a, b) => Math.abs(Number(a) - cNum) - Math.abs(Number(b) - cNum));
  }
  return unique.slice(0, 3);
}

// --- Faktenbasis laden ---------------------------------------------------

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Konzepte nach Kategorie gruppieren (fuer kategorie-interne Distraktoren)
const byCategory = {};
for (const c of raw) {
  (byCategory[c.category] ||= []).push(c);
}

// --- Konzeptspeicher bauen ----------------------------------------------
// Key-Schema laut Plan 4.1: "<domain>:<conceptId>" (z.B. astra:mars).
const concepts = {};
for (const c of raw) {
  const key = `${DOMAIN}:${c.id}`;
  concepts[key] = {
    id: key,
    name: c.name,
    type: c.category, // dient zugleich als SRS-/Dashboard-Typ
    category: c.category,
    attributes: c.attributes,
    funFact: c.funFact || '',
    source: { name: c.sourceName, url: c.sourceUrl || '' }
  };
}

// --- Frage-Templates -----------------------------------------------------
// Jedes Template beschreibt: auf welche Kategorie es zielt, welches Attribut
// abgefragt wird, wie Prompt und korrekte Antwort formatiert werden, und mit
// welcher Schwierigkeit. Distraktoren zieht die Engine generisch aus derselben
// Kategorie/demselben Attribut.

const templates = [
  // ---- Planeten -------------------------------------------------------
  {
    category: 'planet', attr: 'orderFromSun', type: 'astra-planet-order', difficulty: 1,
    prompt: c => `Die wievielte Position von der Sonne nimmt ${c.name} ein?`,
    format: v => `${v}.`
  },
  {
    category: 'planet', attr: 'numMoons', type: 'astra-planet-moons', difficulty: 2,
    prompt: c => `Wie viele Monde hat ${c.name} (nach gaengiger Zaehlung)?`,
    format: v => `${deNum(v)}`, numeric: true
  },
  {
    category: 'planet', attr: 'type', type: 'astra-planet-type', difficulty: 2,
    prompt: c => `Zu welchem Planetentyp gehoert ${c.name}?`,
    format: v => v,
    extraDistractors: ['Zwergplanet']
  },
  {
    category: 'planet', attr: 'distanceFromSunAU', type: 'astra-planet-au', difficulty: 3,
    prompt: c => `In welcher mittleren Entfernung umkreist ${c.name} die Sonne?`,
    format: v => `${deNum(v)} AE`, numeric: true
  },
  {
    category: 'planet', attr: 'diameterKm', type: 'astra-planet-diameter', difficulty: 3,
    prompt: c => `Welchen ungefaehren Durchmesser hat ${c.name}?`,
    format: v => `${deNum(v)} km`, numeric: true
  },
  // ---- Zwergplaneten --------------------------------------------------
  {
    category: 'dwarf_planet', attr: 'location', type: 'astra-dwarf-location', difficulty: 3,
    prompt: c => `In welcher Region des Sonnensystems befindet sich der Zwergplanet ${c.name}?`,
    format: v => v,
    extraDistractors: ['Oortsche Wolke', 'Streuscheibe']
  },
  {
    category: 'dwarf_planet', attr: 'discoveredYear', type: 'astra-dwarf-year', difficulty: 4,
    prompt: c => `In welchem Jahr wurde der Zwergplanet ${c.name} entdeckt?`,
    format: v => `${v}`, numeric: true
  },
  // ---- Monde ----------------------------------------------------------
  {
    category: 'moon', attr: 'parentPlanet', type: 'astra-moon-parent', difficulty: 2,
    prompt: c => `Um welchen Himmelskoerper kreist der Mond ${c.name}?`,
    format: v => v
  },
  // ---- Sterne ---------------------------------------------------------
  {
    category: 'star', attr: 'constellation', type: 'astra-star-constellation', difficulty: 3,
    prompt: c => `In welchem Sternbild liegt ${c.name}?`,
    format: v => v,
    skip: c => !c.attributes.constellation // Sonne hat kein Sternbild
  },
  {
    category: 'star', attr: 'type', type: 'astra-star-type', difficulty: 3,
    prompt: c => `Welcher Sterntyp ist ${c.name}?`,
    format: v => v
  },
  {
    category: 'star', attr: 'distanceLy', type: 'astra-star-distance', difficulty: 4,
    prompt: c => `Wie weit ist ${c.name} ungefaehr von der Erde entfernt?`,
    format: v => `${deNum(v)} Lichtjahre`, numeric: true,
    skip: c => Number(c.attributes.distanceLy) < 0.1 // Sonne ausschliessen
  },
  // ---- Galaxien -------------------------------------------------------
  {
    category: 'galaxy', attr: 'type', type: 'astra-galaxy-type', difficulty: 3,
    prompt: c => `Welcher Galaxientyp ist ${c.name}?`,
    format: v => v,
    extraDistractors: ['Elliptische Galaxie', 'Irregulaere Galaxie']
  },
  {
    category: 'galaxy', attr: 'distanceLy', type: 'astra-galaxy-distance', difficulty: 4,
    prompt: c => `Wie weit ist ${c.name} ungefaehr von der Erde entfernt?`,
    format: v => `${deNum(v)} Lichtjahre`, numeric: true,
    skip: c => Number(c.attributes.distanceLy) < 1 // Milchstrasse (0) ausschliessen
  },
  // ---- Konstanten -----------------------------------------------------
  // Umgekehrte Frage: vom Wert auf den Namen schliessen. Distraktoren sind
  // andere Konstanten-Namen (gleiche Kategorie) -> sauber und eindeutig.
  {
    category: 'constant', attr: '__name__', type: 'astra-constant-value', difficulty: 3,
    prompt: c => `Welche astronomische Groesse hat ungefaehr den Wert von ${c.attributes.value} ${c.attributes.unit}?`,
    format: (_v, c) => c.name,
    nameAnswer: true
  }
];

// --- Fragen generieren ---------------------------------------------------

const questions = [];

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];

  // Wertepool fuer Distraktoren: alle formatierten Werte dieses Attributs in
  // der Kategorie (bzw. alle Namen, bei der Konstanten-Frage).
  const valuePool = conceptsInCat
    .filter(c => !(tpl.skip && tpl.skip(c)))
    .map(c => (tpl.nameAnswer ? c.name : tpl.format(c.attributes[tpl.attr], c)));

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    const rawValue = tpl.nameAnswer ? c.name : c.attributes[tpl.attr];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    const correct = tpl.nameAnswer ? c.name : tpl.format(rawValue, c);

    // Distraktoren aus dem Kategorie-Pool ziehen, optional feste Extras ergaenzen
    let pool = valuePool.slice();
    if (tpl.extraDistractors) pool = pool.concat(tpl.extraDistractors);
    const distractors = pickDistractors(correct, pool, tpl.numeric);

    // Faire Frage braucht mind. 1 Distraktor; wir streben 3 an. Weniger als 2
    // Optionen waeren keine echte Wahl -> ueberspringen.
    if (distractors.length < 1) continue;

    const options = [correct, ...distractors];

    questions.push({
      id: `q_${DOMAIN}_${c.id}_${tpl.attr.replace(/__/g, '')}`,
      entityId: `${DOMAIN}:${c.id}`,
      entityType: c.category,
      type: tpl.type,
      difficulty: tpl.difficulty,
      prompt: tpl.prompt(c),
      correctAnswer: correct,
      options, // Quiz mischt die Reihenfolge zur Laufzeit
      silhouetteSvgPath: null,
      mapTargetId: null
    });
  }
}

// --- schreiben -----------------------------------------------------------

writeFileSync(CONCEPTS_OUT, JSON.stringify(concepts, null, 2), 'utf8');
writeFileSync(QUESTIONS_OUT, JSON.stringify(questions, null, 2), 'utf8');

// kleine Statistik fuer die Konsole
const byType = {};
for (const q of questions) byType[q.type] = (byType[q.type] || 0) + 1;
const byDiff = {};
for (const q of questions) byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;

console.log(`Konzepte: ${Object.keys(concepts).length}`);
console.log(`Fragen:   ${questions.length}`);
console.log('Nach Typ:', byType);
console.log('Nach Schwierigkeit:', byDiff);
