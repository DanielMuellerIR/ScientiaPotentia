/**
 * wikidata_galneb_w3.cjs — Galaxien + Nebel, Welle 3
 *
 * Wie wikidata_galneb.cjs, aber mit niedrigeren Sitelink-Schwellen
 * (galaxy ≥ 10, nebula ≥ 8), um die nächste Notabilitätsstufe abzudecken.
 * Enthält auch gezielt kuratierte bekannte Objekte (Rosettennebel, Carinanebel,
 * Flammennebel, Kohlensacknebel, Zirrusnebel-Teile), die Wikidata-seitig
 * weniger Sitelinks haben, aber populärwissenschaftlich sehr bekannt sind.
 *
 * Bestand-Ausschluss (Stand 2026-06-17, 39 Galaxien + 23 Nebel bereits in
 * astra_raw.json) wird deterministisch gegen IDs + normierte Namen geprüft.
 *
 * Ausgabe: /tmp/astra_galneb_w3.json  (KEIN Schreiben in astra_raw.json)
 * Aufruf:  node scripts/data_sources/harvest/wikidata_galneb_w3.cjs
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { writeJsonAtomic } = require('./json_io.cjs');

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const UA              = 'ScientiaQuizWDQS_W3/1.0 (public educational project)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS    = 1800;  // Etwas länger als Welle 2, um WDQS-Rate zu schonen
const MAX_RETRIES     = 4;

// Niedrigere Schwellen als Welle 2 (die hatte galaxy≥15, nebula≥10)
const GALAXY_MIN_SITELINKS = 10;
const NEBULA_MIN_SITELINKS  = 8;

// Ziel-Mengen (soft — wird bei erreicht sofort abgebrochen)
const GALAXY_TARGET = 30;
const NEBULA_TARGET = 25;

// Wikidata-Einheiten-QIDs
const UNIT_LY  = 'Q531';       // Lichtjahr
const UNIT_PC  = 'Q12129';     // Parsec
const UNIT_KPC = 'Q11929860';  // Kiloparsec
const UNIT_MPC = 'Q3773454';   // Megaparsec

const OUT_PATH = '/tmp/astra_galneb_w3.json';
const RAW_PATH = path.join(__dirname, '..', 'astra_raw.json');

// ---------------------------------------------------------------------------
// Hilfsfunktionen (identisch zu wikidata_galneb.cjs)
// ---------------------------------------------------------------------------

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

function toDistanceLy(amount, unitUrl) {
  const v = parseFloat(amount);
  if (!isFinite(v) || v <= 0) return null;
  const unitQid = String(unitUrl).split('/').pop();
  if (unitQid === UNIT_LY)  return Math.round(v);
  if (unitQid === UNIT_PC)  return Math.round(v * 3.26156);
  if (unitQid === UNIT_KPC) return Math.round(v * 3261.56);
  if (unitQid === UNIT_MPC) return Math.round(v * 3261560);
  return null;
}

function httpsGet(url, headers, retries = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const { statusCode } = res;
      if ((statusCode === 429 || statusCode === 503) && retries < MAX_RETRIES) {
        const wait = 4000 * Math.pow(2, retries);
        console.warn(`  HTTP ${statusCode}, warte ${wait} ms (Versuch ${retries + 2}/${MAX_RETRIES + 1})…`);
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
  const json = JSON.parse(raw);
  return json.results.bindings;
}

function val(b, key) { return b[key]?.value; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Dedup-Mechanismus
// ---------------------------------------------------------------------------

const rawData           = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds       = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

const newConcepts = [];
const newSlugs    = new Set();

function isDuplicate(name, slug) {
  return existingIds.has(slug)
    || existingNamesNorm.has(normalizeName(name))
    || newSlugs.has(slug);
}

function addConcept(concept) {
  if (isDuplicate(concept.name, concept.id)) return false;
  newConcepts.push(concept);
  newSlugs.add(concept.id);
  existingIds.add(concept.id);
  existingNamesNorm.add(normalizeName(concept.name));
  return true;
}

// ---------------------------------------------------------------------------
// Galaxientypen-Mapping (identisch zu wikidata_galneb.cjs)
// ---------------------------------------------------------------------------

const GALAXY_TYPE_MAP = [
  ['Balkenspiralgalaxie',     'Balkenspiralgalaxie'],
  ['Starburst-Galaxie',       'Starburst-Galaxie'],
  ['Seyfert-Galaxie',         'Seyfert-Galaxie'],
  ['Ringgalaxie',             'Ringgalaxie'],
  ['Linsenförmige Galaxie',   'Linsenförmige Galaxie'],
  ['Elliptische Galaxie',     'Elliptische Galaxie'],
  ['Zwergspirale',            'Zwerggalaxie'],
  ['Zwergelliptische',        'Zwerggalaxie'],
  ['Zwerg-Sphäroid',          'Zwerggalaxie'],
  ['Zwerggalaxie',            'Zwerggalaxie'],
  ['Irreguläre Galaxie',      'Irreguläre Galaxie'],
  ['Spiralgalaxie',           'Spiralgalaxie'],
  ['Galaxie',                 'Galaxie'],
];

// ---------------------------------------------------------------------------
// Batch-Hilfsfunktionen (aus wikidata_galneb.cjs übernommen)
// ---------------------------------------------------------------------------

async function fetchTypesForQids(qids) {
  const typeMap = new Map();
  if (qids.length === 0) return typeMap;
  const batchSize = 30;
  for (let i = 0; i < qids.length; i += batchSize) {
    const batch = qids.slice(i, i + batchSize);
    const valClause = batch.map(q => `wd:${q}`).join(' ');
    const query = `
SELECT DISTINCT ?item ?typeLabel WHERE {
  VALUES ?item { ${valClause} }
  ?item wdt:P31 ?typeItem .
  ?typeItem rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "de")
}
`;
    try {
      const bindings = await sparql(query);
      for (const b of bindings) {
        const itemUrl  = val(b, 'item');
        const typeLabel = val(b, 'typeLabel');
        if (!itemUrl || !typeLabel) continue;
        const qid = String(itemUrl).split('/').pop();
        if (!typeMap.has(qid)) typeMap.set(qid, new Set());
        typeMap.get(qid).add(typeLabel);
      }
      if (i + batchSize < qids.length) await sleep(MIN_DELAY_MS);
    } catch (err) {
      console.warn(`  Typ-Batch-Fehler: ${err.message}`);
      throw err;
    }
  }
  return typeMap;
}

async function fetchDistancesForQids(qids, label) {
  const distMap = new Map();
  if (qids.length === 0) return distMap;
  const batchSize = 30;
  for (let i = 0; i < qids.length; i += batchSize) {
    const batch = qids.slice(i, i + batchSize);
    const valClause = batch.map(q => `wd:${q}`).join(' ');
    const query = `
SELECT DISTINCT ?item ?distAmount ?distUnit WHERE {
  VALUES ?item { ${valClause} }
  OPTIONAL {
    ?item p:P2583 ?distStmt .
    ?distStmt psv:P2583 ?distVal .
    ?distVal wikibase:quantityAmount ?distAmount .
    ?distVal wikibase:quantityUnit ?distUnit .
    ?distStmt wikibase:rank ?distRank .
    FILTER(?distRank != wikibase:DeprecatedRank)
  }
}
`;
    try {
      const bindings = await sparql(query);
      for (const b of bindings) {
        const itemUrl = val(b, 'item');
        if (!itemUrl) continue;
        const qid     = String(itemUrl).split('/').pop();
        const amount  = val(b, 'distAmount');
        const unitUrl = val(b, 'distUnit');
        if (!amount || !unitUrl) continue;
        const ly = toDistanceLy(amount, unitUrl);
        if (!ly || ly <= 0) continue;
        const existing = distMap.get(qid);
        if (!existing) {
          distMap.set(qid, ly);
        } else {
          const unitQid = String(unitUrl).split('/').pop();
          if (unitQid === UNIT_LY) distMap.set(qid, ly);
        }
      }
      if (i + batchSize < qids.length) await sleep(MIN_DELAY_MS);
    } catch (err) {
      console.warn(`  Distanz-Batch-Fehler (${label}): ${err.message}`);
      throw err;
    }
  }
  return distMap;
}

async function fetchMessierNumbers(qids) {
  const messierMap = new Map();
  if (qids.length === 0) return messierMap;
  const batchSize = 30;
  for (let i = 0; i < qids.length; i += batchSize) {
    const batch = qids.slice(i, i + batchSize);
    const valClause = batch.map(q => `wd:${q}`).join(' ');
    const query = `
SELECT DISTINCT ?item ?catalog WHERE {
  VALUES ?item { ${valClause} }
  OPTIONAL {
    ?item wdt:P528 ?catalog .
    FILTER(REGEX(STR(?catalog), "^M\\\\s*\\\\d+$", "i"))
  }
}
`;
    try {
      const bindings = await sparql(query);
      for (const b of bindings) {
        const itemUrl = val(b, 'item');
        const catalog = val(b, 'catalog');
        if (!itemUrl || !catalog) continue;
        const qid   = String(itemUrl).split('/').pop();
        const match = String(catalog).match(/(\d+)/);
        if (match) messierMap.set(qid, parseInt(match[1]));
      }
      if (i + batchSize < qids.length) await sleep(MIN_DELAY_MS);
    } catch (err) {
      console.warn(`  Messier-Batch-Fehler: ${err.message}`);
    }
  }
  return messierMap;
}

// ---------------------------------------------------------------------------
// QUERY 1 — Galaxien (niedrigerer Sitelink-Cutoff als Welle 2)
// ---------------------------------------------------------------------------

async function queryGalaxies() {
  console.log('\n=== Query 1: Galaxien (Welle 3, SL ≥ ' + GALAXY_MIN_SITELINKS + ') ===');

  // Sub-Query A: Spiral- + Balkenspiralgalaxien
  const queryA = `
SELECT DISTINCT ?item ?qid ?label ?sitelinks WHERE {
  VALUES ?gc { wd:Q2488 wd:Q2490 }
  ?item wdt:P31 ?gc .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${GALAXY_MIN_SITELINKS})
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 200
`;

  // Sub-Query B: Elliptische + Linsenförmige + Irreguläre Galaxien
  const queryB = `
SELECT DISTINCT ?item ?qid ?label ?sitelinks WHERE {
  VALUES ?gc { wd:Q596913 wd:Q190438 wd:Q752374 wd:Q2495738 wd:Q320534 }
  ?item wdt:P31 ?gc .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${GALAXY_MIN_SITELINKS})
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 150
`;
  // Q596913 = Elliptische Galaxie, Q2495738 = Linsenförmige Galaxie,
  // Q320534 = Irreguläre Galaxie

  let bindingsA = [], bindingsB = [];
  try {
    bindingsA = await sparql(queryA);
    console.log(`  Sub-Query A (Spiral/Balken): ${bindingsA.length} Treffer`);
    await sleep(MIN_DELAY_MS);
    bindingsB = await sparql(queryB);
    console.log(`  Sub-Query B (Ellip/Linse/Irr/Zwerg/Ring): ${bindingsB.length} Treffer`);
  } catch (err) {
    console.error(`  SPARQL-Fehler: ${err.message}`);
    throw err;
  }

  const allBindings = [...bindingsA, ...bindingsB];

  // Nach QID gruppieren
  const byQid = new Map();
  for (const b of allBindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!byQid.has(qid)) {
      byQid.set(qid, {
        label:     val(b, 'label'),
        qid,
        sitelinks: parseInt(val(b, 'sitelinks') || '0'),
        typeCandidates: new Set()
      });
    }
  }

  const sorted = [...byQid.values()].sort((a, b) => b.sitelinks - a.sitelinks);
  console.log(`  Einzigartige QIDs: ${sorted.length}`);

  // Top-120 für Typ + Distanz-Abfragen
  const topQids = sorted.slice(0, 120).map(e => e.qid);
  await sleep(MIN_DELAY_MS);

  const typeMap = await fetchTypesForQids(topQids);
  for (const [qid, types] of typeMap) {
    if (byQid.has(qid)) {
      for (const t of types) byQid.get(qid).typeCandidates.add(t);
    }
  }

  await sleep(MIN_DELAY_MS);
  const distMap = await fetchDistancesForQids(topQids, 'Galaxy');

  let added = 0, skipped = 0, noType = 0, noDist = 0;

  for (const entry of sorted) {
    if (added >= GALAXY_TARGET) {
      console.log(`  Ziel (${GALAXY_TARGET}) erreicht.`);
      break;
    }

    const name = entry.label;
    if (!name) { skipped++; continue; }

    // Galaxientyp ermitteln (spezifischsten Treffer)
    let mappedType = null;
    for (const [key, mapped] of GALAXY_TYPE_MAP) {
      for (const typeLabel of entry.typeCandidates) {
        if (typeLabel.includes(key)) { mappedType = mapped; break; }
      }
      if (mappedType) break;
    }

    if (!mappedType) { noType++; skipped++; continue; }

    const distanceLy = distMap.get(entry.qid) || 0;

    // Galaxien ohne Distanzangabe behalten wir (distanceLy=0 ist erlaubt für Milchstraße),
    // aber externe Galaxien OHNE Distanz überspringen (kein sinnvoller Frage-Distraktor).
    if (distanceLy === 0) { noDist++; skipped++; continue; }

    const conceptSlug = toSlug(name);
    const concept = {
      id:       conceptSlug,
      name,
      category: 'galaxy',
      attributes: { type: mappedType, distanceLy },
      funFact:    '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${entry.qid}`,
      verifyNote: [
        `P31 ${mappedType}`,
        `P2583 ${distanceLy.toLocaleString('de-DE')} Lj`,
        `sitelinks ${entry.sitelinks}`
      ].join(', '),
      imageSearchTerm: `${name} galaxy`
    };

    if (addConcept(concept)) {
      added++;
      console.log(`  + ${name} (${mappedType}, ${distanceLy.toLocaleString('de-DE')} Lj, ${entry.sitelinks} SL, ${entry.qid})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped} (davon ${noType} ohne Typ, ${noDist} ohne Distanz)`);
}

// ---------------------------------------------------------------------------
// QUERY 2 — Nebel (niedrigerer Sitelink-Cutoff; gezielte bekannte Nebel)
// ---------------------------------------------------------------------------

// Bekannte Nebel als Fallback per direkter QID (falls Sitelinks knapp):
// Rosettennebel (Q165879), Carinanebel (Q44365), Flammennebel (Q193559),
// Kohlensacknebel (Q214766), Tarantelnebel (Q176171),
// Schmetterlingscluster/Nebel (Q30078), Stundenglasnebel (Q905613),
// NGC 604 (H-II-Gebiet in M33) (Q745777), Bubble-Nebel (Q622490),
// Rosettennebel-Komplex (alternativ), Gürtelnebel NGC 7293 — Helix bereits da.
// Diese werden als QID-Kuratierung direkt abgerufen, falls der allgemeine
// SPARQL sie nicht erfasst.

const CURATED_NEBULA_QIDS = [
  'Q165879',  // Rosettennebel
  'Q44365',   // Carinanebel (NGC 3372)
  'Q193559',  // Flammennebel (NGC 2024)
  'Q214766',  // Kohlensacknebel
  'Q176171',  // Tarantelnebel (30 Doradus — aber schon als "30 Doradus" drin? Check)
  'Q30078',   // Stundenglas-Nebel (MyCn18) — sehr fotogen
  'Q622490',  // Bubble-Nebel (NGC 7635)
  'Q745777',  // NGC 604
  'Q194918',  // Pillars of Creation (Säulen der Schöpfung — separat von Adlernebel?)
  'Q913693',  // Kokon-Nebel (IC 5146)
  'Q739327',  // Crabnebula NGC 1952 — Krebsnebel schon im Bestand (Check)
  'Q1349671', // Schmetterlingstnebel (NGC 6302)
  'Q186787',  // Lagunen-Nebel M8 — schon im Bestand
  'Q204779',  // Pelikan-Nebel (IC 5067)
  'Q746234',  // Rosettennebel alternativ: NGC 2244
  'Q180237',  // Herznnebel (IC 1805)
  'Q177239',  // Seelennebel IC 1848 — schon im Bestand? Check
  'Q2143083', // Pfau-Nebel?
  'Q275639',  // Kleiner Ringnebel (NGC 1514) — nicht Ringnebel M57
  'Q5765'     // Orionnebel — schon im Bestand
];

async function queryNebulae() {
  console.log('\n=== Query 2: Nebel (Welle 3, SL ≥ ' + NEBULA_MIN_SITELINKS + ') ===');

  // A) Allgemeine SPARQL-Query mit niedrigerer Schwelle
  const nebelQuery = `
SELECT DISTINCT ?item ?qid ?label ?typeLabel ?constLabel ?sitelinks WHERE {
  VALUES ?nc {
    wd:Q11282 wd:Q13632 wd:Q207436 wd:Q202265
    wd:Q204194 wd:Q203958 wd:Q854857
  }
  ?item wdt:P31 ?nc .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${NEBULA_MIN_SITELINKS})

  OPTIONAL {
    ?item wdt:P31 ?typeItem .
    ?typeItem rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "de")
  }
  OPTIONAL {
    ?item wdt:P59 ?const .
    ?const rdfs:label ?constLabel FILTER(LANG(?constLabel) = "de")
  }

  FILTER NOT EXISTS {
    VALUES ?gc { wd:Q318 wd:Q2488 wd:Q2490 wd:Q190438 }
    ?item wdt:P31 ?gc .
  }

  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 120
`;

  let bindings = [];
  try {
    bindings = await sparql(nebelQuery);
    console.log(`  Allg. Query: ${bindings.length} Treffer`);
  } catch (err) {
    console.error(`  SPARQL-Fehler: ${err.message}`);
    throw err;
  }

  // B) Kuratierte QIDs direkt abfragen (bekannte Nebel mit ggf. niedrigeren SL)
  await sleep(MIN_DELAY_MS);
  const curatedQuery = `
SELECT DISTINCT ?item ?qid ?label ?typeLabel ?constLabel ?sitelinks WHERE {
  VALUES ?item { ${CURATED_NEBULA_QIDS.map(q => `wd:${q}`).join(' ')} }
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wikibase:sitelinks ?sitelinks .

  OPTIONAL {
    ?item wdt:P31 ?typeItem .
    ?typeItem rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "de")
  }
  OPTIONAL {
    ?item wdt:P59 ?const .
    ?const rdfs:label ?constLabel FILTER(LANG(?constLabel) = "de")
  }

  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
`;
  let curatedBindings = [];
  try {
    curatedBindings = await sparql(curatedQuery);
    console.log(`  Kuratierte QIDs: ${curatedBindings.length} Treffer`);
  } catch (err) {
    console.warn(`  Kuratierte-Query-Fehler: ${err.message}`);
    throw err;
  }

  const allBindings = [...bindings, ...curatedBindings];

  // Alle QIDs für Messier + Distanz
  const nebelQids = [...new Set(allBindings.map(b => val(b, 'qid')).filter(Boolean))];

  await sleep(MIN_DELAY_MS);
  const messierMap = await fetchMessierNumbers(nebelQids);

  await sleep(MIN_DELAY_MS);
  const distMap = await fetchDistancesForQids(nebelQids, 'Nebula');

  // Gruppiere nach QID
  const byQid = new Map();
  for (const b of allBindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!byQid.has(qid)) {
      byQid.set(qid, {
        label:          val(b, 'label'),
        qid,
        constLabel:     val(b, 'constLabel'),
        sitelinks:      parseInt(val(b, 'sitelinks') || '0'),
        typeCandidates: new Set()
      });
    }
    const entry = byQid.get(qid);
    const typeLabel = val(b, 'typeLabel');
    if (typeLabel) entry.typeCandidates.add(typeLabel);
    if (!entry.constLabel && val(b, 'constLabel')) entry.constLabel = val(b, 'constLabel');
  }

  const sorted = [...byQid.values()].sort((a, b) => b.sitelinks - a.sitelinks);
  console.log(`  Einzigartige QIDs: ${sorted.length}`);

  const IGNORE_TYPES = new Set([
    'astronomisches Objekt', 'Nebel', 'Radioquelle', 'Röntgenquelle',
    'Infrarotquelle', 'Gammastrahlenquelle', 'Ultraviolettquelle'
  ]);

  let added = 0, skipped = 0, noDist = 0;

  for (const entry of sorted) {
    if (added >= NEBULA_TARGET) {
      console.log(`  Ziel (${NEBULA_TARGET}) erreicht.`);
      break;
    }

    const name = entry.label;
    if (!name) { skipped++; continue; }

    const distanceLy = distMap.get(entry.qid) || null;
    if (!distanceLy) {
      console.log(`  - ${name} (${entry.qid}): keine Distanz → übersprungen`);
      noDist++;
      skipped++;
      continue;
    }

    // Besten Nebeltyp
    let typeLabel = null;
    let best = 0;
    for (const t of entry.typeCandidates) {
      if (IGNORE_TYPES.has(t) || t.length < 5) continue;
      if (t.length > best) { typeLabel = t; best = t.length; }
    }

    const messierNumber = messierMap.get(entry.qid) || null;

    const attributes = { distanceLy };
    if (messierNumber !== null) attributes.messierNumber = messierNumber;
    if (entry.constLabel)       attributes.constellation = entry.constLabel;
    if (typeLabel)              attributes.type          = typeLabel;

    const propList = [
      `P2583 ${distanceLy.toLocaleString('de-DE')} Lj`,
      `sitelinks ${entry.sitelinks}`
    ];
    if (messierNumber !== null) propList.push(`M${messierNumber}`);
    if (entry.constLabel)       propList.push(`P59 ${entry.constLabel}`);
    if (typeLabel)              propList.push(`P31 ${typeLabel}`);

    const conceptSlug = toSlug(name);

    const concept = {
      id:       conceptSlug,
      name,
      category: 'nebula',
      attributes,
      funFact:    '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${entry.qid}`,
      verifyNote: propList.join(', '),
      imageSearchTerm: `${name} nebula`
    };

    if (addConcept(concept)) {
      added++;
      const mStr = messierNumber !== null ? ` M${messierNumber}` : '';
      const cStr = entry.constLabel ? ` (${entry.constLabel})` : '';
      console.log(`  + ${name}${mStr}${cStr} — ${distanceLy.toLocaleString('de-DE')} Lj, ${entry.sitelinks} SL, ${entry.qid}`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped} (davon ${noDist} ohne Distanz)`);
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Wikidata-Ernte Welle 3: galaxy + nebula ===');
  console.log(`Bestand astra_raw.json: ${rawData.length} Konzepte`);
  const existGalaxies = rawData.filter(c => c.category === 'galaxy').length;
  const existNebulae  = rawData.filter(c => c.category === 'nebula').length;
  console.log(`Bestehende Galaxien: ${existGalaxies}, Nebel: ${existNebulae}`);
  console.log(`Sitelink-Schwellen: galaxy ≥ ${GALAXY_MIN_SITELINKS}, nebula ≥ ${NEBULA_MIN_SITELINKS}`);

  try {
    await queryGalaxies();
    await sleep(MIN_DELAY_MS);
    await queryNebulae();
  } catch (err) {
    console.error('\nFEHLER (unbehandelt):', err.message);
    process.exit(1);
  }

  // Statistik
  const byCat = {};
  for (const c of newConcepts) byCat[c.category] = (byCat[c.category] || 0) + 1;

  console.log('\n=== Ergebnis ===');
  console.log(`Neue Konzepte gesamt: ${newConcepts.length}`);
  for (const [cat, count] of Object.entries(byCat)) {
    console.log(`  ${cat}: ${count}`);
  }

  if (newConcepts.length === 0) {
    console.log('Keine neuen Konzepte — Ausgabedatei wird NICHT geschrieben.');
    return;
  }

  writeJsonAtomic(OUT_PATH, newConcepts);
  console.log(`\nGeschrieben: ${OUT_PATH}`);
}

if (require.main === module) main();
