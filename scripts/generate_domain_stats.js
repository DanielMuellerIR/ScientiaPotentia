/**
 * Generator für das Domain-Statistik-Manifest (public/data/domain_stats.json).
 *
 * Warum ein eigenes Manifest?
 * Der Scientia-Startbildschirm (ScientiaHub) nennt je Wissensbereich dynamisch
 * die Anzahl Fragen, Konzepte und freier Bilder — damit sofort sichtbar ist, wie
 * umfangreich das Quiz ist. Diese Zahlen alle zur Laufzeit zu berechnen hieße, die
 * kompletten Fragenkataloge (~34 MB JSON) beim ersten Rendern zu laden. Deshalb
 * zählt dieses Skript einmalig beim Build und legt ein winziges Manifest ab, das
 * die Landing-Page mit einem einzigen kleinen Fetch liest.
 *
 * Quellwahrheit bleiben die generierten Datendateien:
 *   - Fragen:   public/data/questions_<id>.json   (Array -> length)
 *   - Konzepte: public/data/concepts_<id>.json     (Map id -> Konzept)
 *   - Bilder:   Konzepte mit gesetztem, nicht-leerem "image"-Feld
 *
 * Terra ist der Sonderfall: seine Konzepte stammen aus der gebündelten
 * src/data/geodb.json (Orte statt Karteikarten mit Bild) und werden nicht über
 * Einzelbilder, sondern über die interaktive Weltkarte dargestellt. Darum hat
 * Terra images: 0 und hasMap: true.
 *
 * Deterministische Ausgabe (feste Reihenfolge, kein Zeitstempel), damit ein
 * erneuter Lauf ohne Datenänderung einen bytegleichen Diff erzeugt.
 *
 * Aufruf: node scripts/generate_domain_stats.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { DOMAIN_CONFIGS } from '../src/domains/metadata.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'public', 'data');

// Das JSX-freie Metadatenmodul ist dieselbe Quelle, aus der die React-Registry
// Reihenfolge, IDs und Kartenflag bezieht. Der Mischbereich besitzt keine eigenen
// Dateien und wird deshalb aus dem Statistiklauf gefiltert.
const DOMAINS = DOMAIN_CONFIGS.filter(domain => domain.hasOwnContent);

/** Liest eine JSON-Datei; wirft mit sprechendem Pfad, falls sie fehlt. */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Konnte ${path} nicht lesen: ${err.message}`);
  }
}

/** Zählt Fragen (Array) eines Bereichs aus questions_<id>.json. */
export function countQuestionEntries(questions, sourceName = 'Fragenkatalog') {
  if (!Array.isArray(questions)) {
    throw new TypeError(`${sourceName} muss ein JSON-Array sein.`);
  }
  return questions.length;
}

function countQuestions(id) {
  const path = join(dataDir, `questions_${id}.json`);
  return countQuestionEntries(readJson(path), path);
}

/** Zählt Einträge nur in einer echten JSON-Map, nicht in Arrays oder null. */
export function countRecordEntries(records, sourceName = 'Konzeptkatalog') {
  if (records === null || typeof records !== 'object' || Array.isArray(records)) {
    throw new TypeError(`${sourceName} muss ein JSON-Objekt sein.`);
  }
  return Object.entries(records);
}

/**
 * Zählt Konzepte und bebilderte Konzepte eines Bereichs.
 * - Terra: Orte aus der gebündelten geodb.json (kein image-Feld -> 0 Bilder).
 * - sonst: concepts_<id>.json (Map). Bild = truthy, nicht-leeres image-Feld.
 */
function countConcepts(domain) {
  if (domain.usesGeodb) {
    const path = join(root, 'src', 'data', 'geodb.json');
    const geodb = readJson(path);
    const entries = countRecordEntries(geodb?.entities, `${path}: entities`);
    return { concepts: entries.length, images: 0 };
  }
  const path = join(dataDir, `concepts_${domain.id}.json`);
  const entries = countRecordEntries(readJson(path), path);
  const values = entries.map(([, concept]) => concept);
  const images = values.filter(concept => {
    const image = concept && concept.image;
    return typeof image === 'string' ? image.trim().length > 0 : Boolean(image);
  }).length;
  return { concepts: values.length, images };
}

export function generateDomainStats() {
  const domains = {};
  const totals = { questions: 0, concepts: 0, images: 0, domains: DOMAINS.length };

  for (const domain of DOMAINS) {
    const questions = countQuestions(domain.id);
    const { concepts, images } = countConcepts(domain);
    domains[domain.id] = { questions, concepts, images, hasMap: Boolean(domain.hasMap) };
    totals.questions += questions;
    totals.concepts += concepts;
    totals.images += images;
  }

  const manifest = { totals, domains };
  const outPath = join(dataDir, 'domain_stats.json');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // Kurze, maschinenlesbare Zusammenfassung auf stdout (nützlich in der Pipeline).
  console.log(
    `domain_stats.json geschrieben: ${totals.questions.toLocaleString('de-DE')} Fragen, ` +
    `${totals.concepts.toLocaleString('de-DE')} Konzepte, ${totals.images.toLocaleString('de-DE')} Bilder ` +
    `über ${totals.domains} Bereiche.`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  generateDomainStats();
}
