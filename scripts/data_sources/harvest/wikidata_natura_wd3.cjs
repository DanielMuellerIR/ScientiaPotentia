/**
 * wikidata_natura_wd3.cjs
 *
 * Welle 3: Erntet weitere Natura-Tierkonzepte (category: "animal") aus Wikidata SPARQL.
 * Neue Gruppen: Barschartige (Perciformes), Karpfenartige (Cypriniformes),
 *   Welsartige (Siluriformes), Störartige (Acipenseriformes), Dorsche (Gadiformes),
 *   Falkenartige (Falconiformes), Hühnervögel (Galliformes), Seglervögel (Apodiformes),
 *   Kranichvögel (Gruiformes), Gürteltiere (Cingulata), Libellen (Odonata).
 *
 * QIDs verifiziert 2026-06-14 via Wikidata Entity Search API + WDQS-Zählabfragen.
 * Filter: dewiki-Sitelink + P18 (Commons-Bild) + P141 (IUCN-Status).
 * Ausgabe: natura_wd3.json (wird separat in natura_raw.json gemergt).
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_natura_wd3.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('./json_io.cjs');

// --- Konfiguration ----------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (public educational project)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS = 1200;
const MAX_RETRIES = 3;

const OUT_PATH = path.join(__dirname, 'natura_wd3.json');
const RAW_PATH = path.join(__dirname, '..', 'natura_raw.json');

// Whitelist erlaubter Klassen-Strings (exakt, dt. Common-Namen aus Wikidata)
const CLASS_WHITELIST = new Set([
  'Säugetiere', 'Vögel', 'Reptilien', 'Amphibien', 'Fische',
  'Knochenfische', 'Knorpelfische', 'Insekten', 'Spinnentiere',
  'Krebstiere', 'Höhere Krebse', 'Kopffüßer', 'Stachelhäuter',
  'Nesseltiere', 'Bärtierchen'
]);

// IUCN-Status-Mapping (QID → kanonischer dt. String, deckungsgleich mit generate_natura.js)
const IUCN_MAP = {
  'Q211005':  'Nicht gefährdet (LC)',
  'Q719675':  'Potenziell gefährdet (NT)',
  'Q278113':  'Gefährdet (VU)',
  'Q11394':   'Stark gefährdet (EN)',
  'Q219127':  'Vom Aussterben bedroht (CR)',
  'Q3245245': 'Ungenügende Datenlage (DD)',
  'Q3300751': 'Nicht bewertet (NE)'
};

// Einheiten-Umrechnung
const MASS_UNIT_TO_KG = {
  'Q11570': 1,       // Kilogramm
  'Q25517': 0.001,   // Gramm
  'Q100995': 1000,   // Tonne (metrisch)
  'Q488578': 1000,   // Metric ton (Alias)
};
const LENGTH_UNIT_TO_CM = {
  'Q11573':  100,    // Meter
  'Q174728': 1,      // Zentimeter
  'Q174789': 0.1,    // Millimeter
  'Q828224': 100000, // Kilometer
};

/**
 * Taxonomische Gruppen — Welle 3, neue Ordnungen.
 * QIDs verifiziert 2026-06-14 via Wikidata Entity Search API + WDQS-Zählabfragen.
 *
 * Felder:
 *  qid   — Wikidata-QID der Ordnung
 *  class — Klassen-String aus der Whitelist
 *  order — dt. Common-Name der Ordnung (für attributes.order)
 *  limit — Maximale Trefferzahl dieser Query (angepasst um Timeout zu vermeiden)
 *
 * Gezählte Kandidaten (dewiki + P18 + P141) vor Limit-Setzung:
 *  Perciformes   Q127595: 353 → limit 50
 *  Cypriniformes Q177879: 248 → limit 45
 *  Siluriformes  Q59576:   92 → limit 40
 *  Acipenseriformes Q192422: 40 → limit 35
 *  Gadiformes    Q216241:   24 → limit 24
 *  Falconiformes Q25370:    74 → limit 60
 *  Galliformes   Q21659:   286 → limit 60
 *  Apodiformes   Q25950:   497 → limit 50 (sehr viele Kolibris)
 *  Gruiformes    Q25557:   134 → limit 60
 *  Cingulata     Q1242326:  26 → limit 25
 *  Odonata       Q25375:   313 → limit 60
 *
 * Verworfen (0 Treffer): Opiliones (Weberknechte, Q19116).
 */
const TAXON_GROUPS = [
  // === Knochenfische ===
  // Barschartige: Perciformes (Q127595) — 353 Kandidaten, limit 50
  { qid: 'Q127595',  class: 'Knochenfische', order: 'Barschartige',   limit: 50  },
  // Karpfenartige: Cypriniformes (Q177879) — 248 Kandidaten, limit 45
  { qid: 'Q177879',  class: 'Knochenfische', order: 'Karpfenartige',  limit: 45  },
  // Welsartige: Siluriformes (Q59576) — 92 Kandidaten, limit 40
  { qid: 'Q59576',   class: 'Knochenfische', order: 'Welsartige',     limit: 40  },
  // Störartige: Acipenseriformes (Q192422) — 40 Kandidaten, limit 35
  { qid: 'Q192422',  class: 'Knochenfische', order: 'Störartige',     limit: 35  },
  // Dorsche: Gadiformes (Q216241) — 24 Kandidaten, alle holen
  { qid: 'Q216241',  class: 'Knochenfische', order: 'Dorsche',        limit: 24  },

  // === Vögel (neue Ordnungen) ===
  // Falkenartige: Falconiformes (Q25370) — 74 Kandidaten, limit 60
  { qid: 'Q25370',   class: 'Vögel', order: 'Falkenartige',           limit: 60  },
  // Hühnervögel: Galliformes (Q21659) — 286 Kandidaten, limit 60
  { qid: 'Q21659',   class: 'Vögel', order: 'Hühnervögel',            limit: 60  },
  // Seglervögel: Apodiformes (Q25950) — 497 Kandidaten (inkl. viele Kolibris), limit 50
  { qid: 'Q25950',   class: 'Vögel', order: 'Seglervögel',            limit: 50  },
  // Kranichvögel: Gruiformes (Q25557) — 134 Kandidaten, limit 60
  { qid: 'Q25557',   class: 'Vögel', order: 'Kranichvögel',           limit: 60  },

  // === Säugetiere ===
  // Gürteltiere: Cingulata (Q1242326) — 26 Kandidaten, alle holen
  { qid: 'Q1242326', class: 'Säugetiere', order: 'Gürteltiere',       limit: 25  },

  // === Insekten ===
  // Libellen: Odonata (Q25375) — 313 Kandidaten, limit 60
  { qid: 'Q25375',   class: 'Insekten', order: 'Libellen',             limit: 60  },
];

// --- Hilfsfunktionen --------------------------------------------------------

function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Erkennt rein lateinische Binomial-Namen (Gattung Artepitheton).
 * Diese sollen nicht in die Ausgabe — nur echte dt. Common-Namen.
 *
 * Trifft auf:
 *  "Panthera leo"         (2 Tokens: Groß + klein, nur ASCII-Buchstaben)
 *  "Homo sapiens sapiens" (3 rein-latein-Tokens)
 * Einzelwörter werden nicht verworfen: Bei „Tiger“ oder „Giraffe“ lässt sich
 * aus der Schreibweise nicht zwischen deutschem Namen und Taxon unterscheiden.
 *
 * Trifft NICHT auf:
 *  "Rauchschwalbe", "Braunbär", "Nördlicher See-Elefant" etc.
 */
function isBinomial(name) {
  if (!name) return false;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 2 && /^[A-Z][a-z]+$/.test(parts[0]) && /^[a-z]+$/.test(parts[1])) return true;
  if (parts.length === 3 && /^[A-Z][a-z]+$/.test(parts[0])
      && parts.slice(1).every(part => /^[a-z]+$/.test(part))) return true;
  return false;
}

function httpsGet(url, headers, retries = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const { statusCode } = res;
      if ((statusCode === 429 || statusCode === 503) && retries < MAX_RETRIES) {
        const wait = 4000 * (retries + 1);
        console.warn(`  HTTP ${statusCode}, warte ${wait} ms, Versuch ${retries + 2}/${MAX_RETRIES + 1}...`);
        res.resume();
        setTimeout(() => httpsGet(url, headers, retries + 1).then(resolve).catch(reject), wait);
        return;
      }
      if (statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${statusCode} für ${url.slice(0, 120)}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function sparql(query) {
  const encoded = encodeURIComponent(query);
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encoded}`;
  const raw = await httpsGet(url, {
    'User-Agent': UA,
    'Accept': 'application/sparql-results+json'
  });
  return JSON.parse(raw).results.bindings;
}

function val(binding, key) {
  return binding[key]?.value;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function convertUnit(amount, unitQid, target) {
  if (!isFinite(amount) || amount <= 0) return null;
  const map = target === 'kg' ? MASS_UNIT_TO_KG : LENGTH_UNIT_TO_CM;
  const factor = map[unitQid];
  if (factor === undefined) return null;
  return amount * factor;
}

// --- Dedup ------------------------------------------------------------------

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

function isDuplicate(name, slug) {
  return existingIds.has(slug) || existingNamesNorm.has(normalizeName(name));
}

const newConcepts = [];
const newSlugs = new Set();
let totalSkippedBinomial = 0;
let totalSkippedDedup = 0;
let totalSkippedNoStatus = 0;

function addConcept(concept) {
  if (isDuplicate(concept.name, concept.id)) { totalSkippedDedup++; return false; }
  if (newSlugs.has(concept.id)) { totalSkippedDedup++; return false; }
  newConcepts.push(concept);
  newSlugs.add(concept.id);
  existingIds.add(concept.id);
  existingNamesNorm.add(normalizeName(concept.name));
  return true;
}

// ============================================================================
// buildConcept — aus SPARQL-Binding ein Konzept-Objekt bauen
// ============================================================================

function buildConcept(name, qid, b, group) {
  if (!name) return null;
  if (isBinomial(name)) { totalSkippedBinomial++; return null; }

  const attributes = {};
  const propList = [];

  // Klasse und Ordnung deterministisch aus der Ordnungs-Gruppe
  attributes.class = group.class;
  attributes.order = group.order;
  propList.push(`class: ${group.class}`, `order: ${group.order} (via ${group.qid})`);

  // IUCN-Status aus P141
  const iucnQid = val(b, 'iucnQid');
  if (iucnQid && IUCN_MAP[iucnQid]) {
    attributes.conservationStatus = IUCN_MAP[iucnQid];
    propList.push(`P141 ${iucnQid} → ${IUCN_MAP[iucnQid]}`);
  } else {
    // Status ist Pflicht (SPARQL filtert schon auf P141 vorhanden, aber QID könnte unbekannt sein)
    totalSkippedNoStatus++;
    return null;
  }

  // Masse (P2067) → maxWeightKg
  const massRaw = val(b, 'massKg') ? parseFloat(val(b, 'massKg')) : null;
  const massUnit = val(b, 'massUnit');
  if (massRaw !== null && massUnit) {
    const kg = convertUnit(massRaw, massUnit, 'kg');
    // Plausibilitäts-Filter: 0.0001 kg (kleinstes Tier) bis 200.000 kg (Blauwal)
    if (kg !== null && kg >= 0.0001 && kg <= 200000) {
      attributes.maxWeightKg = kg >= 1 ? Math.round(kg * 10) / 10 : Math.round(kg * 10000) / 10000;
      propList.push(`P2067 ${massRaw} ${massUnit} → ${attributes.maxWeightKg} kg`);
    }
  }

  // Länge (P2043) → maxLengthCm
  const lenRaw = val(b, 'lenCm') ? parseFloat(val(b, 'lenCm')) : null;
  const lenUnit = val(b, 'lenUnit');
  if (lenRaw !== null && lenUnit) {
    const cm = convertUnit(lenRaw, lenUnit, 'cm');
    // Plausibilitäts-Filter: 0.01 cm bis 4000 cm
    if (cm !== null && cm >= 0.01 && cm <= 4000) {
      attributes.maxLengthCm = cm >= 1 ? Math.round(cm * 10) / 10 : Math.round(cm * 1000) / 1000;
      propList.push(`P2043 ${lenRaw} ${lenUnit} → ${attributes.maxLengthCm} cm`);
    }
  }

  return {
    id: toSlug(name),
    name,
    category: 'animal',
    attributes,
    funFact: '',
    sourceName: 'Wikidata',
    sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    verifyNote: propList.join(', '),
    imageSearchTerm: name
  };
}

// ============================================================================
// Haupt-Query-Funktion: Eine Query pro taxonomische Gruppe
//
// Die Query nutzt wdt:P171+ (transitiver Elterntaxon-Pfad) um alle Arten
// zu finden, die taxonomisch in der gegebenen Ordnung liegen.
// Filter: Art-Rang (P105=Q7432) + dewiki + P18 (Bild) + P141 (IUCN, Pflicht).
// ============================================================================

async function queryGroup(group, seenQids) {
  const groupLabel = `${group.class} / ${group.order} (${group.qid})`;
  console.log(`\n--- ${groupLabel} ---`);

  // Hinweis: P141 (IUCN-Status) ist hier Pflicht, d.h. nur Tiere mit bekanntem Status.
  // P18 (Commons-Bild) filtert obskure Katalog-Taxa heraus.
  // FILTER(?iucnItem NOT IN ...) entfernt ausgestorbene Taxa (EX=Q237350, EW=Q278170).
  const query = `
SELECT DISTINCT ?item ?qid ?label ?iucnQid ?massKg ?massUnit ?lenCm ?lenUnit WHERE {
  ?item wdt:P105 wd:Q7432 .
  ?item wdt:P171+ wd:${group.qid} .
  ?dewiki schema:about ?item ; schema:inLanguage "de" ; schema:isPartOf <https://de.wikipedia.org/> .
  ?item wdt:P18 [] .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wdt:P141 ?iucnItem .
  FILTER(?iucnItem NOT IN (wd:Q237350, wd:Q278170))
  BIND(SUBSTR(STR(?iucnItem), 32) AS ?iucnQid)
  OPTIONAL {
    ?item p:P2067 ?massStmt .
    ?massStmt psv:P2067 ?massVal .
    ?massVal wikibase:quantityAmount ?massKg .
    ?massVal wikibase:quantityUnit ?massUnitItem .
    BIND(SUBSTR(STR(?massUnitItem), 32) AS ?massUnit)
  }
  OPTIONAL {
    ?item p:P2043 ?lenStmt .
    ?lenStmt psv:P2043 ?lenVal .
    ?lenVal wikibase:quantityAmount ?lenCm .
    ?lenVal wikibase:quantityUnit ?lenUnitItem .
    BIND(SUBSTR(STR(?lenUnitItem), 32) AS ?lenUnit)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
LIMIT ${group.limit}
`;

  let bindings;
  try {
    bindings = await sparql(query);
  } catch (err) {
    console.error(`  Query fehlgeschlagen: ${err.message}`);
    throw err;
  }

  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  for (const b of bindings) {
    const name = val(b, 'label');
    if (!name) { skipped++; continue; }

    const qid = val(b, 'qid');
    // Globaler QID-Dedup: verhindert Duplikate wenn ein Tier in mehreren Ordnungen auftaucht
    if (seenQids.has(qid)) { skipped++; continue; }
    seenQids.add(qid);

    const concept = buildConcept(name, qid, b, group);
    if (!concept) { skipped++; continue; }

    if (addConcept(concept)) {
      added++;
      const wt = concept.attributes.maxWeightKg ? `${concept.attributes.maxWeightKg} kg` : '-';
      const cs = concept.attributes.conservationStatus;
      console.log(`  + ${name} (${cs}, Masse: ${wt})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// ============================================================================
// Hauptprogramm
// ============================================================================

async function main() {
  console.log('Starte Wikidata-Ernte Welle 3 für Natura-Domain (Tiere)...');
  console.log(`Bestand: ${rawData.filter(c => c.category === 'animal').length} Tiere in natura_raw.json`);
  console.log(`Dedup: ${existingIds.size} IDs, ${existingNamesNorm.size} normalisierte Namen`);
  console.log(`Taxonomische Gruppen: ${TAXON_GROUPS.length}`);

  // Globaler QID-Tracker über alle Queries
  const seenQids = new Set();

  for (let i = 0; i < TAXON_GROUPS.length; i++) {
    const group = TAXON_GROUPS[i];
    await queryGroup(group, seenQids);
    // Pause zwischen Queries (WDQS-Etikette)
    if (i < TAXON_GROUPS.length - 1) {
      await sleep(MIN_DELAY_MS);
    }
  }

  // --- Statistik ---
  const byClass = {};
  for (const c of newConcepts) {
    const kl = c.attributes.class ?? '(keine)';
    byClass[kl] = (byClass[kl] || 0) + 1;
  }
  const withMass = newConcepts.filter(c => c.attributes.maxWeightKg).length;
  const withLength = newConcepts.filter(c => c.attributes.maxLengthCm).length;

  console.log('\n=== Ergebnis ===');
  console.log(`Neue Tierkonzepte: ${newConcepts.length}`);
  for (const [kl, n] of Object.entries(byClass).sort()) console.log(`  ${kl}: ${n}`);
  console.log(`Mit Massedaten (P2067): ${withMass}`);
  console.log(`Mit Längendaten (P2043): ${withLength}`);
  console.log(`Verworfen: Binomial=${totalSkippedBinomial}, Dedup=${totalSkippedDedup}, ` +
              `Status unbekannt=${totalSkippedNoStatus}`);

  // Ausgabe
  writeJsonAtomic(OUT_PATH, newConcepts);
  console.log(`\nGeschrieben: ${OUT_PATH}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('FEHLER:', err.message);
    process.exit(1);
  });
}

module.exports = { convertUnit, isBinomial, normalizeName, toSlug };
