/**
 * Generator für die Astra-Domain (Astronomie).
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
 * Wählt bis zu 3 Distraktoren aus einem Pool möglicher Werte.
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

// --- Selbstverräter-Schutz ----------------------------------------------
// Verwirft Fragen, deren Antwort schon im Hinweis steckt (Antwort = Wort aus
// dem Konzeptnamen). Hier seltener als bei Homo, aber als gleiche Qualitäts-
// schranke. Generische Stamm-Wörter (z.B. „Galaxie" in „Spiralgalaxie")
// schlagen bewusst NICHT an (Token-Mindestlänge + kein Hinweis->Antwort-Match).
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

// Konzepte nach Kategorie gruppieren (für kategorie-interne Distraktoren)
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
    prompt: c => `Wie viele Monde hat ${c.name} (nach gängiger Zählung)?`,
    format: v => `${deNum(v)}`, numeric: true
  },
  {
    category: 'planet', attr: 'type', type: 'astra-planet-type', difficulty: 2,
    prompt: c => `Zu welchem Planetentyp gehört ${c.name}?`,
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
    prompt: c => `Welchen ungefähren Durchmesser hat ${c.name}?`,
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
    prompt: c => `Um welchen Himmelskörper kreist der Mond ${c.name}?`,
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
    prompt: c => `Wie weit ist ${c.name} ungefähr von der Erde entfernt?`,
    format: v => `${deNum(v)} Lichtjahre`, numeric: true,
    skip: c => Number(c.attributes.distanceLy) < 0.1 // Sonne ausschliessen
  },
  // ---- Galaxien -------------------------------------------------------
  {
    category: 'galaxy', attr: 'type', type: 'astra-galaxy-type', difficulty: 3,
    prompt: c => `Welcher Galaxientyp ist ${c.name}?`,
    format: v => v,
    extraDistractors: ['Elliptische Galaxie', 'Irreguläre Galaxie']
  },
  {
    category: 'galaxy', attr: 'distanceLy', type: 'astra-galaxy-distance', difficulty: 4,
    prompt: c => `Wie weit ist ${c.name} ungefähr von der Erde entfernt?`,
    format: v => `${deNum(v)} Lichtjahre`, numeric: true,
    skip: c => Number(c.attributes.distanceLy) < 1 // Milchstraße (0) ausschliessen
  },
  // ---- Konstanten -----------------------------------------------------
  // Umgekehrte Frage: vom Wert auf den Namen schliessen. Distraktoren sind
  // andere Konstanten-Namen (gleiche Kategorie) -> sauber und eindeutig.
  {
    category: 'constant', attr: '__name__', type: 'astra-constant-value', difficulty: 3,
    subject: c => `${c.attributes.value} ${c.attributes.unit}`, // Hinweis ist der Wert
    prompt: c => `Welche astronomische Größe hat ungefähr den Wert von ${c.attributes.value} ${c.attributes.unit}?`,
    format: (_v, c) => c.name,
    nameAnswer: true
  },

  // ==== Erweiterte Fragetypen (Stand 2026-06-04, Richtung 5000) ============
  // Nutzen ausschliesslich bereits verifizierte Attribute -> keine neuen Fakten,
  // nur zusätzliche, echte Lernwinkel je Konzept.

  // ---- Planeten: Tag/Jahr + Reverse-Position --------------------------
  {
    category: 'planet', attr: 'orderFromSun', type: 'astra-planet-order-rev', difficulty: 2,
    subject: c => `${c.attributes.orderFromSun}.`, // Hinweis ist die Position, nicht der Name
    prompt: c => `Welcher Planet ist der ${c.attributes.orderFromSun}. von der Sonne?`,
    format: (_v, c) => c.name, nameAnswer: true
  },
  {
    category: 'planet', attr: 'dayLengthHours', type: 'astra-planet-day', difficulty: 3,
    prompt: c => `Wie lang dauert ein Tag (Rotation) auf ${c.name} ungefähr?`,
    format: v => `${deNum(v)} Stunden`, numeric: true
  },
  {
    category: 'planet', attr: 'yearLengthEarthDays', type: 'astra-planet-year', difficulty: 3,
    prompt: c => `Wie lang dauert ein Jahr (Sonnenumlauf) auf ${c.name} in Erdtagen?`,
    format: v => `${deNum(v)} Erdtage`, numeric: true
  },
  // ---- Zwergplaneten: Durchmesser + Umlaufzeit ------------------------
  {
    category: 'dwarf_planet', attr: 'diameterKm', type: 'astra-dwarf-diameter', difficulty: 4,
    prompt: c => `Welchen ungefähren Durchmesser hat der Zwergplanet ${c.name}?`,
    format: v => `${deNum(v)} km`, numeric: true
  },
  {
    category: 'dwarf_planet', attr: 'yearLengthEarthYears', type: 'astra-dwarf-year-len', difficulty: 4,
    prompt: c => `Wie lange braucht ${c.name} für einen Sonnenumlauf?`,
    format: v => `${deNum(v)} Erdjahre`, numeric: true
  },
  // ---- Monde: Durchmesser ---------------------------------------------
  {
    category: 'moon', attr: 'diameterKm', type: 'astra-moon-diameter', difficulty: 3,
    prompt: c => `Welchen ungefähren Durchmesser hat der Mond ${c.name}?`,
    format: v => `${deNum(v)} km`, numeric: true
  },
  // ---- Sterne: scheinbare Helligkeit ----------------------------------
  {
    category: 'star', attr: 'apparentMagnitude', type: 'astra-star-magnitude', difficulty: 4,
    prompt: c => `Welche scheinbare Helligkeit (Magnitude) hat ${c.name} ungefähr?`,
    format: v => `${deNum(v)} mag`, numeric: true,
    skip: c => c.attributes.apparentMagnitude === undefined
  },
  // ---- Konstanten: Name -> Wert (Gegenrichtung zur bestehenden Frage) -
  {
    category: 'constant', attr: 'value', type: 'astra-constant-name', difficulty: 2,
    prompt: c => `Welchen Wert hat ${c.name} ungefähr?`,
    format: (_v, c) => `${c.attributes.value} ${c.attributes.unit}`
  },

  // ==== Phase-5-Erweiterung (Stand 2026-06-05, Richtung 5000/Domain) =======
  // Nutzen ausschliesslich bereits verifizierte Attribute -> keine neuen Fakten.
  // (a) Zwergplaneten-Mondzahl als eigener Vorwärts-Typ (Spiegel zu astra-planet-moons),
  // (b)+(c) Reverse-Recall von vorhandenen numerischen Planeten-Attributen auf den Namen.

  // ---- Zwergplaneten: Mondzahl ----------------------------------------
  {
    category: 'dwarf_planet', attr: 'numMoons', type: 'astra-dwarf-moons', difficulty: 3,
    prompt: c => `Wie viele Monde hat der Zwergplanet ${c.name} (nach gängiger Zählung)?`,
    format: v => `${deNum(v)}`, numeric: true
  },
  // ---- Planeten: Durchmesser -> Name (Gegenrichtung) ------------------
  {
    category: 'planet', attr: 'diameterKm', type: 'astra-planet-diameter-rev', difficulty: 4, nameAnswer: true,
    subject: c => `${deNum(c.attributes.diameterKm)} km`, // Hinweis ist der Durchmesser, nicht der Name
    format: (_v, c) => c.name,
    prompt: c => `Welcher Planet hat einen ungefähren Durchmesser von ${deNum(c.attributes.diameterKm)} km?`
  },
  // ---- Planeten: Jahreslänge -> Name (Gegenrichtung) -----------------
  {
    category: 'planet', attr: 'yearLengthEarthDays', type: 'astra-planet-year-rev', difficulty: 4, nameAnswer: true,
    subject: c => `${deNum(c.attributes.yearLengthEarthDays)} Erdtage`, // Hinweis ist die Jahreslänge, nicht der Name
    format: (_v, c) => c.name,
    prompt: c => `Welcher Planet umrundet die Sonne in etwa ${deNum(c.attributes.yearLengthEarthDays)} Erdtagen?`
  }
];

// --- Fragen generieren ---------------------------------------------------

const questions = [];

for (const tpl of templates) {
  const conceptsInCat = byCategory[tpl.category] || [];

  // Wertepool für Distraktoren: alle formatierten Werte dieses Attributs in
  // der Kategorie (bzw. alle Namen, bei der Konstanten-Frage).
  const valuePool = conceptsInCat
    .filter(c => !(tpl.skip && tpl.skip(c)))
    .map(c => (tpl.nameAnswer ? c.name : tpl.format(c.attributes[tpl.attr], c)))
    // Dünn besetzte Attribute (z.B. dwarf_planet.numMoons nur bei einigen
    // Zwergplaneten) würden sonst „undefined" als Distraktor liefern. Leere raus.
    .filter(v => v !== undefined && v !== null && v !== '');

  for (const c of conceptsInCat) {
    if (tpl.skip && tpl.skip(c)) continue;
    const rawValue = tpl.nameAnswer ? c.name : c.attributes[tpl.attr];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    const correct = tpl.nameAnswer ? c.name : tpl.format(rawValue, c);

    // Selbstverräter: steckt die Antwort schon im Hinweis, Frage verwerfen.
    const subject = tpl.subject ? tpl.subject(c) : c.name;
    if (revealsAnswer(subject, correct)) continue;

    // Distraktoren aus dem Kategorie-Pool ziehen, optional feste Extras ergänzen
    let pool = valuePool.slice();
    if (tpl.extraDistractors) pool = pool.concat(tpl.extraDistractors);
    const distractors = pickDistractors(correct, pool, tpl.numeric);

    // Faire Frage braucht mind. 1 Distraktor; wir streben 3 an. Weniger als 2
    // Optionen wären keine echte Wahl -> überspringen.
    if (distractors.length < 1) continue;

    const options = [correct, ...distractors];

    questions.push({
      // type im id -> eindeutig, auch wenn zwei Templates dasselbe Attribut nutzen
      // (z.B. Position vorwärts/rückwärts).
      id: `q_${DOMAIN}_${c.id}_${tpl.type}`,
      entityId: `${DOMAIN}:${c.id}`,
      entityType: c.category,
      type: tpl.type,
      difficulty: tpl.difficulty,
      prompt: tpl.prompt(c),
      correctAnswer: correct,
      options, // Quiz mischt die Reihenfolge zur Laufzeit
      // Selbstverräter-Guard im Visual: das Frontend muss wissen, welches
      // Attribut die Antwort prüft. Bei Reverse-Templates (Antwort = Konzeptname,
      // nameAnswer) gibt es kein geprüftes Attribut -> null. Bei Vorwärts-
      // Templates ist es tpl.attr (z.B. 'orderFromSun', 'value').
      testedAttribute: tpl.nameAnswer ? null : tpl.attr,
      // answerIsName: true, wenn die korrekte Antwort der Konzeptname ist (Reverse).
      answerIsName: Boolean(tpl.nameAnswer),
      silhouetteSvgPath: null,
      mapTargetId: null
    });
  }
}

// --- schreiben -----------------------------------------------------------

writeFileSync(CONCEPTS_OUT, JSON.stringify(concepts, null, 2), 'utf8');
writeFileSync(QUESTIONS_OUT, JSON.stringify(questions, null, 2), 'utf8');

// kleine Statistik für die Konsole
const byType = {};
for (const q of questions) byType[q.type] = (byType[q.type] || 0) + 1;
const byDiff = {};
for (const q of questions) byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;

console.log(`Konzepte: ${Object.keys(concepts).length}`);
console.log(`Fragen:   ${questions.length}`);
console.log('Nach Typ:', byType);
console.log('Nach Schwierigkeit:', byDiff);
