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
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'public', 'data');

// Reihenfolge wie in der Domain-Registry (ohne den Mischbereich "scientia" selbst).
// hasMap markiert Terra, dessen "Bildmaterial" die Weltkarte ist (keine Einzelbilder).
//
// Diese Liste ist bewusst eine eigene: src/domains/index.js ist ein React-Modul
// (JSX-Komponenten, lucide-react) und laesst sich hier nicht ohne Bundler laden.
// Damit sie nicht auseinanderlaufen, vergleicht assertRegistryIsCovered() unten
// beide Reihenfolgen — sonst koennte ein neuer Bereich im Hub als Karte
// erscheinen, im Manifest und in den Summen aber fehlen.
const DOMAINS = [
  { id: 'terra', source: 'geodb', hasMap: true },
  { id: 'astra', source: 'concepts' },
  { id: 'homo', source: 'concepts' },
  { id: 'natura', source: 'concepts' },
  { id: 'lingua', source: 'concepts' },
  { id: 'cultura', source: 'concepts' },
  { id: 'machina', source: 'concepts' },
  { id: 'historia', source: 'concepts' }
];

/** Liest eine JSON-Datei; wirft mit sprechendem Pfad, falls sie fehlt. */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Konnte ${path} nicht lesen: ${err.message}`);
  }
}

/** Zählt Fragen (Array) eines Bereichs aus questions_<id>.json. */
function countQuestions(id) {
  const questions = readJson(join(dataDir, `questions_${id}.json`));
  return Array.isArray(questions) ? questions.length : 0;
}

/**
 * Zählt Konzepte und bebilderte Konzepte eines Bereichs.
 * - Terra: Orte aus der gebündelten geodb.json (kein image-Feld -> 0 Bilder).
 * - sonst: concepts_<id>.json (Map). Bild = truthy, nicht-leeres image-Feld.
 */
function countConcepts(domain) {
  if (domain.source === 'geodb') {
    const geodb = readJson(join(root, 'src', 'data', 'geodb.json'));
    const entities = geodb.entities || {};
    return { concepts: Object.keys(entities).length, images: 0 };
  }
  const map = readJson(join(dataDir, `concepts_${domain.id}.json`));
  const values = Object.values(map);
  const images = values.filter(concept => {
    const image = concept && concept.image;
    return typeof image === 'string' ? image.trim().length > 0 : Boolean(image);
  }).length;
  return { concepts: values.length, images };
}

/**
 * Vergleicht die Bereichsliste oben mit der echten Registry.
 *
 * Gelesen wird der Quelltext von src/domains/index.js, nicht das Modul selbst —
 * ein Import wuerde JSX und lucide-react mitziehen. Es genuegt, die IDs in ihrer
 * Reihenfolge herauszuziehen; der Mischbereich "scientia" hat keine eigenen
 * Daten und bleibt aussen vor.
 */
function assertRegistryIsCovered() {
  const source = readFileSync(join(root, 'src', 'domains', 'index.js'), 'utf8');
  const registryIds = [...source.matchAll(/\bid:\s*'([a-z]+)'/g)]
    .map(match => match[1])
    .filter(id => id !== 'scientia');
  const generatorIds = DOMAINS.map(domain => domain.id);

  if (registryIds.join(',') !== generatorIds.join(',')) {
    throw new Error(
      'Die Bereichsliste in scripts/generate_domain_stats.js weicht von der Registry ab.\n' +
      `  Registry:  ${registryIds.join(', ')}\n` +
      `  Generator: ${generatorIds.join(', ')}\n` +
      'Bitte die Liste oben angleichen (gleiche IDs, gleiche Reihenfolge).'
    );
  }
}

assertRegistryIsCovered();

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
