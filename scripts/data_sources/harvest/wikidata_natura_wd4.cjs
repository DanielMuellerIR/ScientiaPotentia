/**
 * wikidata_natura_wd4.cjs
 *
 * Welle 4 (v2): Erntet Natura-Tierkonzepte (category: "animal") aus Wikidata SPARQL.
 * Notabilitätsfilter: wikibase:sitelinks >= 12 (bekannte Arten haben Artikel in vielen Sprachen).
 * Sortierung: absteigend nach Sitelinks (bekannteste Tiere zuerst).
 *
 * Ordnungen: Singvögel, Papageien, Eulen, Tauben, Greifvögel, Spechte, Entenvögel,
 *   Froschlurche, Nagetiere, Fledertiere, Hasenartige, Beuteltiere, Primaten,
 *   Lachsartige, Heuschrecken.
 *
 * QIDs verifiziert 2026-06-17 via Wikidata Entity Search API + WDQS-Zählabfragen.
 * Filter: dewiki + P18 (Commons-Bild) + P141 (IUCN-Status) + sitelinks >= 12.
 * Ausgabe: /tmp/natura_wd4.json (wird separat in natura_raw.json gemergt).
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_natura_wd4.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('./json_io.cjs');

// --- Konfiguration ----------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (public educational project)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS = 2000;
const MAX_RETRIES = 4; // 4 statt 3: Heuschrecken-Query hatte beim ersten Lauf HTTP 502, beim Retry OK

const OUT_PATH = '/tmp/natura_wd4.json';
const RAW_PATH = path.join(__dirname, '..', 'natura_raw.json');

// Whitelist erlaubter Klassen-Strings (exakt, dt. Common-Namen aus Wikidata)
// Erweitert gegenüber wd3 um: Amphibien bereits drin, keine Erweiterung nötig
const CLASS_WHITELIST = new Set([
  'Säugetiere', 'Vögel', 'Reptilien', 'Amphibien', 'Fische',
  'Knochenfische', 'Knorpelfische', 'Insekten', 'Spinnentiere',
  'Krebstiere', 'Höhere Krebse', 'Kopffüßer', 'Stachelhäuter',
  'Nesseltiere', 'Bärtierchen'
]);

// IUCN-Status-Mapping (QID → kanonischer dt. String)
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
 * Taxonomische Gruppen — Welle 4 v2, mit Sitelink-Filter (>= 12).
 * QIDs verifiziert 2026-06-17 via Wikidata Entity Search API + WDQS-Zählabfragen.
 *
 * Felder:
 *  qid   — Wikidata-QID der Ordnung
 *  class — Klassen-String aus der Whitelist
 *  order — dt. Common-Name der Ordnung (für attributes.order)
 *  limit — Maximale Trefferzahl (nach SL≥12-Filter)
 *
 * Mit SL≥12 kommen deutlich weniger Kandidaten durch — daher großzügige Limits.
 * Neue Ordnungen (Greifvögel, Spechte, Entenvögel, Beuteltiere, Primaten) ergänzt
 * um bekannte, gut dokumentierte Tiergruppen sicherzustellen.
 */
const TAXON_GROUPS = [
  // === Vögel ===
  // Singvögel: Passeriformes (Q25341) — viele, SL≥12 filtert stark
  { qid: 'Q25341',    class: 'Vögel', order: 'Singvögel',       limit: 80 },
  // Papageien: Psittaciformes (Q31431)
  { qid: 'Q31431',    class: 'Vögel', order: 'Papageien',       limit: 80 },
  // Eulen: Strigiformes (Q25222)
  { qid: 'Q25222',    class: 'Vögel', order: 'Eulen',           limit: 80 },
  // Tauben: Columbiformes (Q28078)
  { qid: 'Q28078',    class: 'Vögel', order: 'Tauben',          limit: 80 },
  // Greifvögel: Accipitriformes (Q21736) — Adler, Falken, Habichte; sehr bekannt
  // Q21736 korrekt (Q295434 = falsche QID, liefert 0 Treffer, korrigiert 2026-06-17)
  { qid: 'Q21736',    class: 'Vögel', order: 'Greifvögel',      limit: 80 },
  // Spechte: Piciformes (Q25934) — Q25347 = falsche QID (0 Treffer), korrigiert 2026-06-17
  { qid: 'Q25934',    class: 'Vögel', order: 'Spechte',         limit: 80 },
  // Entenvögel: Anseriformes (Q25241) — Enten, Gänse, Schwäne; sehr bekannt
  { qid: 'Q25241',    class: 'Vögel', order: 'Entenvögel',      limit: 80 },

  // === Amphibien ===
  // Froschlurche: Anura (Q53636)
  { qid: 'Q53636',    class: 'Amphibien', order: 'Froschlurche', limit: 80 },

  // === Säugetiere ===
  // Nagetiere: Rodentia (Q10850) — SL≥12 filtert obskure Mäuse/Pfeifhasen heraus
  { qid: 'Q10850',    class: 'Säugetiere', order: 'Nagetiere',  limit: 80 },
  // Fledertiere: Chiroptera (Q28425) — SL≥12 filtert obskure Flughunde heraus
  { qid: 'Q28425',    class: 'Säugetiere', order: 'Fledertiere', limit: 80 },
  // Hasenartige: Lagomorpha (Q25401) — Hasen, Kaninchen; überschaubare Gruppe
  { qid: 'Q25401',    class: 'Säugetiere', order: 'Hasenartige', limit: 80 },
  // Beuteltiere: Diprotodontia (Q26332) — Kängurus, Koalas, Wombats; sehr bekannt
  // Q26332 korrekt (Q44626 = falsche QID, liefert 0 Treffer, korrigiert 2026-06-17)
  { qid: 'Q26332',    class: 'Säugetiere', order: 'Beuteltiere', limit: 80 },
  // Primaten: Primates (Q7380) — Affen, Menschenaffen; sehr bekannt
  { qid: 'Q7380',     class: 'Säugetiere', order: 'Primaten',   limit: 80 },

  // === Knochenfische ===
  // Lachsartige: Salmoniformes (Q9394365)
  { qid: 'Q9394365',  class: 'Knochenfische', order: 'Lachsartige', limit: 80 },

  // === Insekten ===
  // Heuschrecken: Orthoptera (Q167810) — SL≥12 filtert regionale Arten heraus
  { qid: 'Q167810',   class: 'Insekten', order: 'Heuschrecken', limit: 80 },
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

  // Sitelinks — Notabilitäts-Wert (nur zur Verifikation, nicht als Attribut gespeichert)
  const sitelinks = val(b, 'sitelinks') ? parseInt(val(b, 'sitelinks'), 10) : null;
  if (sitelinks !== null) {
    propList.push(`sitelinks: ${sitelinks}`);
  }

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

  // Notabilitätsfilter: wikibase:sitelinks >= 12 trennt bekannte von obskuren Arten.
  // Sortierung DESC(?sitelinks): bekannteste Tiere füllen das LIMIT zuerst.
  // P141 (IUCN-Status) + P18 (Commons-Bild) bleiben Pflicht.
  // FILTER(?iucnItem NOT IN ...) entfernt ausgestorbene Taxa (EX=Q237350, EW=Q278170).
  const query = `
SELECT DISTINCT ?item ?qid ?label ?iucnQid ?sitelinks ?massKg ?massUnit ?lenCm ?lenUnit WHERE {
  ?item wdt:P105 wd:Q7432 .
  ?item wdt:P171+ wd:${group.qid} .
  ?dewiki schema:about ?item ; schema:inLanguage "de" ; schema:isPartOf <https://de.wikipedia.org/> .
  ?item wdt:P18 [] .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wdt:P141 ?iucnItem .
  FILTER(?iucnItem NOT IN (wd:Q237350, wd:Q278170))
  BIND(SUBSTR(STR(?iucnItem), 32) AS ?iucnQid)
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 12)
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
ORDER BY DESC(?sitelinks)
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
  let slMin = Infinity, slMax = 0;

  for (const b of bindings) {
    const name = val(b, 'label');
    if (!name) { skipped++; continue; }

    const qid = val(b, 'qid');
    // Globaler QID-Dedup: verhindert Duplikate wenn ein Tier in mehreren Ordnungen auftaucht
    if (seenQids.has(qid)) { skipped++; continue; }
    seenQids.add(qid);

    const concept = buildConcept(name, qid, b, group);
    if (!concept) { skipped++; continue; }

    // Sitelinks für Statistik tracken (aus verifyNote extrahieren)
    const slMatch = concept.verifyNote.match(/sitelinks: (\d+)/);
    const sl = slMatch ? parseInt(slMatch[1], 10) : null;

    if (addConcept(concept)) {
      added++;
      if (sl !== null) { slMin = Math.min(slMin, sl); slMax = Math.max(slMax, sl); }
      const wt = concept.attributes.maxWeightKg ? `${concept.attributes.maxWeightKg} kg` : '-';
      const cs = concept.attributes.conservationStatus;
      const slStr = sl !== null ? `, SL ${sl}` : '';
      console.log(`  + ${name} (${cs}, Masse: ${wt}${slStr})`);
    } else {
      skipped++;
    }
  }

  const slRange = slMin <= slMax ? `SL ${slMin}–${slMax}` : 'SL n/a';
  console.log(`  Neu: ${added}, Übersprungen: ${skipped}, ${slRange}`);
}

// ============================================================================
// Hauptprogramm
// ============================================================================

async function main() {
  console.log('Starte Wikidata-Ernte Welle 4 für Natura-Domain (Tiere)...');
  console.log(`Bestand: ${rawData.filter(c => c.category === 'animal').length} Tiere in natura_raw.json`);
  console.log(`Dedup: ${existingIds.size} IDs, ${existingNamesNorm.size} normalisierte Namen`);
  console.log(`Taxonomische Gruppen: ${TAXON_GROUPS.length}`);

  // Globaler QID-Tracker über alle Queries
  const seenQids = new Set();

  for (let i = 0; i < TAXON_GROUPS.length; i++) {
    const group = TAXON_GROUPS[i];
    await queryGroup(group, seenQids);
    // Pause zwischen Queries (WDQS-Etikette — 2 Sekunden Mindestabstand)
    if (i < TAXON_GROUPS.length - 1) {
      await sleep(MIN_DELAY_MS);
    }
  }

  // --- Statistik ---
  const byClass = {};
  const byOrder = {};
  // Sitelink-Spannen je Ordnung (aus verifyNote)
  const slByOrder = {};
  for (const c of newConcepts) {
    const kl = c.attributes.class ?? '(keine)';
    byClass[kl] = (byClass[kl] || 0) + 1;
    const or = c.attributes.order ?? '(keine)';
    byOrder[or] = (byOrder[or] || 0) + 1;
    const slMatch = c.verifyNote.match(/sitelinks: (\d+)/);
    if (slMatch) {
      const sl = parseInt(slMatch[1], 10);
      if (!slByOrder[or]) slByOrder[or] = { min: sl, max: sl };
      else { slByOrder[or].min = Math.min(slByOrder[or].min, sl); slByOrder[or].max = Math.max(slByOrder[or].max, sl); }
    }
  }
  const withMass = newConcepts.filter(c => c.attributes.maxWeightKg).length;
  const withLength = newConcepts.filter(c => c.attributes.maxLengthCm).length;
  // Globale Sitelink-Spanne
  const allSl = newConcepts.map(c => { const m = c.verifyNote.match(/sitelinks: (\d+)/); return m ? parseInt(m[1], 10) : null; }).filter(n => n !== null);
  const globalSlMin = allSl.length ? Math.min(...allSl) : null;
  const globalSlMax = allSl.length ? Math.max(...allSl) : null;

  console.log('\n=== Ergebnis ===');
  console.log(`Neue Tierkonzepte: ${newConcepts.length}`);
  if (globalSlMin !== null) console.log(`Sitelink-Spanne gesamt: ${globalSlMin}–${globalSlMax}`);
  console.log('Nach Klasse:');
  for (const [kl, n] of Object.entries(byClass).sort()) console.log(`  ${kl}: ${n}`);
  console.log('Nach Ordnung (Anzahl, SL min–max):');
  for (const [or, n] of Object.entries(byOrder).sort()) {
    const sl = slByOrder[or] ? ` SL ${slByOrder[or].min}–${slByOrder[or].max}` : '';
    console.log(`  ${or}: ${n}${sl}`);
  }
  console.log(`Mit Massedaten (P2067): ${withMass}`);
  console.log(`Mit Längendaten (P2043): ${withLength}`);
  console.log(`Verworfen: Binomial=${totalSkippedBinomial}, Dedup=${totalSkippedDedup}, ` +
              `Status unbekannt=${totalSkippedNoStatus}`);
  // Top-10 nach Sitelinks als Beleg der Bekanntheit
  const top10 = newConcepts
    .map(c => { const m = c.verifyNote.match(/sitelinks: (\d+)/); return { name: c.name, sl: m ? parseInt(m[1], 10) : 0 }; })
    .sort((a, b) => b.sl - a.sl)
    .slice(0, 10);
  console.log('Top-10 nach Sitelinks:');
  for (const t of top10) console.log(`  ${t.name} (SL ${t.sl})`);

  // Ausgabe nach /tmp/natura_wd4.json (NICHT in natura_raw.json)
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
