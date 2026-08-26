/**
 * wikidata_galneb.cjs
 *
 * Erntet neue Astra-Konzepte der Kategorien `galaxy` und `nebula` aus Wikidata SPARQL.
 * Notabilitäts-Proxy: wikibase:sitelinks (Schwelle konfigurierbar).
 * Nur Objekte mit deutschen Labels (impliziert Wikipedia-Notabilität bei ≥ 15 SL).
 *
 * Felder je Konzept (schema-konform zu astra_raw.json):
 *   galaxy:  { type, distanceLy }
 *   nebula:  { distanceLy, messierNumber?, diameterLy?, constellation?, type? }
 *
 * Dedup: gegen bestehende astra_raw.json (id + normierter Name).
 * Ausgabe: /tmp/astra_galneb.json  (NICHT astra_raw.json schreiben)
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_galneb.cjs
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const UA              = 'ScientiaQuizWDQS/1.0 (public educational project)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS    = 1500;   // Mindestpause zwischen WDQS-Anfragen (ms)
const MAX_RETRIES     = 4;      // Maximale Retry-Versuche bei 429/503/Timeout

// Notabilitäts-Schwellen (sitelinks)
const GALAXY_MIN_SITELINKS = 15;
const NEBULA_MIN_SITELINKS = 10;

// Ziel-Mengen (soft)
const GALAXY_TARGET = 28;
const NEBULA_TARGET = 18;

// Pfade
const OUT_PATH = '/tmp/astra_galneb.json';
const RAW_PATH = path.join(__dirname, '..', 'astra_raw.json');

// Wikidata-Einheiten-QIDs für Distanzumrechnung
// (ermittelt durch Analyse realer Wikidata-Einträge 2026-06-17)
const UNIT_LY  = 'Q531';       // Lichtjahr
const UNIT_PC  = 'Q12129';     // Parsec
const UNIT_KPC = 'Q11929860';  // Kiloparsec
const UNIT_MPC = 'Q3773454';   // Megaparsec

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Normalisiert Name für Dedup-Vergleich (gleiche Logik wie wd1/wd3). */
function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, '')       // Klammerzusätze entfernen
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** kebab-slug aus deutschem Namen. */
function toSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Distanzwert (amount) + Wikidata-Einheits-URL → Lichtjahre (gerundete ganze Zahl).
 * Wikidata-Einheiten für Nebel/Galaxien: Lj, pc, kpc, Mpc.
 */
function toDistanceLy(amount, unitUrl) {
  const v = parseFloat(amount);
  if (!isFinite(v) || v <= 0) return null;
  const unitQid = String(unitUrl).split('/').pop();
  if (unitQid === UNIT_LY)  return Math.round(v);
  if (unitQid === UNIT_PC)  return Math.round(v * 3.26156);
  if (unitQid === UNIT_KPC) return Math.round(v * 3261.56);
  if (unitQid === UNIT_MPC) return Math.round(v * 3261560);
  return null; // Unbekannte Einheit (m, km, AU etc.) ignorieren
}

/** HTTPS GET → Promise<string> mit exponenziellem Backoff bei 429/503. */
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
    req.setTimeout(40000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/** SPARQL-Query gegen WDQS ausführen → Array von Binding-Objekten. */
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

/** Wert sicher aus einem SPARQL-Binding lesen. */
function val(b, key) {
  return b[key]?.value;
}

/** Pausiert ms Millisekunden. */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Dedup-Mechanismus
// ---------------------------------------------------------------------------

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds       = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

// Während des Laufs gesammelte neue Konzepte
const newConcepts = [];
const newSlugs    = new Set();

function isDuplicate(name, slug) {
  return existingIds.has(slug) || existingNamesNorm.has(normalizeName(name));
}

function addConcept(concept) {
  if (isDuplicate(concept.name, concept.id)) return false;
  if (newSlugs.has(concept.id)) return false;
  newConcepts.push(concept);
  newSlugs.add(concept.id);
  // Sofort in Dedup-Sets aufnehmen — verhindert Doppler in Folge-Queries
  existingIds.add(concept.id);
  existingNamesNorm.add(normalizeName(concept.name));
  return true;
}

// ---------------------------------------------------------------------------
// Galaxientypen-Mapping
// ---------------------------------------------------------------------------
// Wikidata P31-Label → einheitlicher Typ-String für das Quiz.
// Reihenfolge: spezifischer Typ zuerst (Balken > Spiral > Galaxie).
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

/** Gibt den normalisierten Typ oder null zurück. */
function mapGalaxyType(label) {
  if (!label) return null;
  for (const [key, mapped] of GALAXY_TYPE_MAP) {
    if (label.includes(key)) return mapped;
  }
  return null;
}

// ---------------------------------------------------------------------------
// QUERY 1 — Galaxien (2 Sub-Queries, je eine Klassen-Gruppe)
// ---------------------------------------------------------------------------
// Strategie: flache VALUES-Liste für P31-Direktklassen (KEIN P279* → kein Timeout).
// Korrekte QIDs (verifiziert 2026-06-17):
//   Q318  = Galaxie (allgemein)
//   Q2488 = Spiralgalaxie
//   Q2490 = Balkenspiralgalaxie
//   Q190438 = Zwerggalaxie
//
// Kein dewiki-Filter in der SPARQL-Query (Timeout-Ursache bei Kombination mit
// sitelinks + VALUES). Stattdessen: sitelinks ≥ 15 + deutsches Label als Filter.
// Bei ≥ 15 sitelinks ist praktisch immer ein dewiki-Artikel vorhanden.
//
// Distanz (P2583) wird separat in einem zweiten Durchgang per QID geholt,
// um die Haupt-Query nicht zu verkomplizieren.
// ---------------------------------------------------------------------------

async function queryGalaxies() {
  console.log('\n=== Query 1: Galaxien ===');

  // Sub-Query A: Spiral- + Balkenspiralgalaxien (Q2488, Q2490) — ohne OPTIONAL-Join
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
LIMIT 100
`;

  // Sub-Query B: Zwerggalaxien und Ringgalaxien
  const queryB = `
SELECT DISTINCT ?item ?qid ?label ?sitelinks WHERE {
  VALUES ?gc { wd:Q190438 wd:Q752374 }
  ?item wdt:P31 ?gc .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${GALAXY_MIN_SITELINKS})
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 60
`;

  let bindingsA = [], bindingsB = [];
  try {
    bindingsA = await sparql(queryA);
    console.log(`  Sub-Query A (Spiral/Balken): ${bindingsA.length} Treffer`);
    await sleep(MIN_DELAY_MS);
    bindingsB = await sparql(queryB);
    console.log(`  Sub-Query B (Zwerg/Ring): ${bindingsB.length} Treffer`);
  } catch (err) {
    console.error(`  SPARQL-Fehler: ${err.message}`);
    if (bindingsA.length === 0) return;
    console.log('  Fahre mit Sub-Query-A-Ergebnissen fort…');
  }

  const allBindings = [...bindingsA, ...bindingsB];

  // Gruppiere nach QID
  const byQid = new Map();
  for (const b of allBindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!byQid.has(qid)) {
      byQid.set(qid, {
        label:     val(b, 'label'),
        qid,
        sitelinks: parseInt(val(b, 'sitelinks') || '0'),
        // Typ-Kandidaten werden in fetchTypesForQids() nachgefüllt
        typeCandidates: new Set()
      });
    }
  }

  // Galaxien nach sitelinks sortieren
  const sorted = [...byQid.values()].sort((a, b) => b.sitelinks - a.sitelinks);

  // Top-80-QIDs — Typen + Distanzen in separaten Batch-Queries holen
  const topQids = sorted.slice(0, 80).map(e => e.qid);
  await sleep(MIN_DELAY_MS);

  const typeMap = await fetchTypesForQids(topQids);
  for (const [qid, types] of typeMap) {
    if (byQid.has(qid)) {
      for (const t of types) byQid.get(qid).typeCandidates.add(t);
    }
  }

  await sleep(MIN_DELAY_MS);
  const distMap = await fetchDistancesForQids(topQids, 'Galaxy');

  let added = 0, skipped = 0, noType = 0;

  for (const entry of sorted) {
    const name = entry.label;
    if (!name) { skipped++; continue; }

    // Galaxientyp ermitteln (spezifischsten Treffer wählen)
    let mappedType = null;
    for (const [key, mapped] of GALAXY_TYPE_MAP) {
      for (const typeLabel of entry.typeCandidates) {
        if (typeLabel.includes(key)) {
          mappedType = mapped;
          break;
        }
      }
      if (mappedType) break;
    }

    if (!mappedType) {
      noType++;
      skipped++;
      continue;
    }

    // Distanz in Lichtjahren
    const distanceLy = distMap.get(entry.qid) || 0;

    const slug = toSlug(name);

    const concept = {
      id:       slug,
      name,
      category: 'galaxy',
      attributes: { type: mappedType, distanceLy },
      funFact:    '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${entry.qid}`,
      verifyNote: [
        `P31 ${mappedType}`,
        distanceLy ? `P2583 ${distanceLy.toLocaleString('de-DE')} Lj` : 'P2583 fehlt',
        `sitelinks ${entry.sitelinks}`
      ].join(', '),
      imageSearchTerm: `${name} galaxy`
    };

    if (addConcept(concept)) {
      added++;
      const distStr = distanceLy ? distanceLy.toLocaleString('de-DE') + ' Lj' : 'Distanz fehlt';
      console.log(`  + ${name} (${mappedType}, ${distStr}, ${entry.sitelinks} SL, ${entry.qid})`);
    } else {
      skipped++;
    }

    if (added >= GALAXY_TARGET) {
      console.log(`  Ziel (${GALAXY_TARGET}) erreicht.`);
      break;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped} (davon ${noType} ohne Typ-Mapping)`);
}

// ---------------------------------------------------------------------------
// P31-Typen-Batch-Fetch (für Liste von QIDs)
// ---------------------------------------------------------------------------

async function fetchTypesForQids(qids) {
  const typeMap = new Map(); // qid → Set<typeLabel>
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
        const itemUrl = val(b, 'item');
        const typeLabel = val(b, 'typeLabel');
        if (!itemUrl || !typeLabel) continue;
        const qid = String(itemUrl).split('/').pop();
        if (!typeMap.has(qid)) typeMap.set(qid, new Set());
        typeMap.get(qid).add(typeLabel);
      }
      if (i + batchSize < qids.length) await sleep(MIN_DELAY_MS);
    } catch (err) {
      console.warn(`  Typ-Batch-Fehler: ${err.message}`);
    }
  }
  return typeMap;
}

// ---------------------------------------------------------------------------
// Distanz-Batch-Fetch (für Liste von QIDs)
// ---------------------------------------------------------------------------
// Holt P2583-Distanzen für bis zu 30 QIDs pro Anfrage.
// Rückgabe: Map<qid, distanceLy>.
// ---------------------------------------------------------------------------

async function fetchDistancesForQids(qids, label) {
  const distMap = new Map();
  if (qids.length === 0) return distMap;

  // In Batches zu 30 QIDs aufteilen
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
        const qid = String(itemUrl).split('/').pop();
        const amount  = val(b, 'distAmount');
        const unitUrl = val(b, 'distUnit');
        if (!amount || !unitUrl) continue;
        const ly = toDistanceLy(amount, unitUrl);
        if (!ly || ly <= 0) continue;
        // Bei mehreren Distanzen: größeren (besser belegten) Wert bevorzugen,
        // AUSSER wenn einer von ihnen plausibel für den Objekttyp ist.
        // Für Nebel: ly < 50000 erwartet; für Galaxien: ly > 100000 erwartet.
        const existing = distMap.get(qid);
        if (!existing) {
          distMap.set(qid, ly);
        } else {
          // Wenn beide plausibel: den Lj-Wert bevorzugen (direkt angegeben)
          const unitQid = String(unitUrl).split('/').pop();
          if (unitQid === UNIT_LY) distMap.set(qid, ly);
        }
      }
      if (i + batchSize < qids.length) await sleep(MIN_DELAY_MS);
    } catch (err) {
      console.warn(`  Distanz-Batch-Fehler (${label}): ${err.message}`);
    }
  }
  return distMap;
}

// ---------------------------------------------------------------------------
// QUERY 2 — Nebel
// ---------------------------------------------------------------------------
// Korrekte P31-QIDs für Nebeltypen (verifiziert 2026-06-17):
//   Q11282  = H-II-Gebiet (Emissionsnebel)
//   Q13632  = Planetarischer Nebel
//   Q207436 = Supernovaüberrest
//   Q202265 = Emissionsnebel
//   Q204194 = Dunkelwolke
//   Q203958 = Reflexionsnebel
//   Q854857 = Diffuser Nebel
//
// Wichtig: Objekte, die sowohl Nebel- als auch Galaxien-Klassen haben
// (z.B. Messier 87 = H-II-Gebiet IN einer Galaxie), werden ausgefiltert,
// indem wir prüfen, ob das Objekt AUCH eine Galaxien-Klasse hat.
// ---------------------------------------------------------------------------

// Galaxien-QIDs für Anti-Join-Filter
const GALAXY_CLASS_QIDS = ['Q318', 'Q2488', 'Q2490', 'Q190438', 'Q752374'];

async function queryNebulae() {
  console.log('\n=== Query 2: Nebel ===');

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

  # P31-Typ für Nebeltyp-Label
  OPTIONAL {
    ?item wdt:P31 ?typeItem .
    ?typeItem rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "de")
  }

  # Sternbild (P59)
  OPTIONAL {
    ?item wdt:P59 ?const .
    ?const rdfs:label ?constLabel FILTER(LANG(?constLabel) = "de")
  }

  # Ausschließen: Objekte die gleichzeitig eine Galaxien-Klasse haben
  FILTER NOT EXISTS {
    VALUES ?gc { wd:Q318 wd:Q2488 wd:Q2490 wd:Q190438 }
    ?item wdt:P31 ?gc .
  }

  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 80
`;

  let bindings;
  try {
    bindings = await sparql(nebelQuery);
    console.log(`  Rohergebnis: ${bindings.length} Treffer`);
  } catch (err) {
    console.error(`  SPARQL-Fehler: ${err.message}`);
    return;
  }

  // Messier-Nummern über P528 separat holen (Batch-Query)
  // Wikidata speichert P528 als String "M 42", "M42", "Messier 42"
  const nebelQids = [...new Set(bindings.map(b => val(b, 'qid')).filter(Boolean))];

  // Messier-Nummern für alle Nebel holen
  const messierMap = await fetchMessierNumbers(nebelQids);

  // Gruppiere nach QID
  const byQid = new Map();
  for (const b of bindings) {
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

  // Distanzen holen
  const distMap = await fetchDistancesForQids(nebelQids.slice(0, 60), 'Nebula');

  let added = 0, skipped = 0;

  const sorted = [...byQid.values()].sort((a, b) => b.sitelinks - a.sitelinks);

  for (const entry of sorted) {
    const name = entry.label;
    if (!name) { skipped++; continue; }

    const distanceLy = distMap.get(entry.qid) || null;

    // Kernattribut: Distanz muss vorhanden sein
    if (!distanceLy) {
      console.log(`  - ${name} (${entry.qid}): keine Distanz — übersprungen`);
      skipped++;
      continue;
    }

    // Besten Nebeltyp ermitteln
    let typeLabel = null;
    let best = 0;
    const IGNORE_TYPES = new Set(['astronomisches Objekt', 'Nebel', 'Radioquelle', 'Röntgenquelle',
      'Röntgenquelle', 'Infrarotquelle', 'Gammastrahlenquelle', 'Ultraviolettquelle']);
    for (const t of entry.typeCandidates) {
      if (IGNORE_TYPES.has(t) || t.length < 5) continue;
      if (t.length > best) { typeLabel = t; best = t.length; }
    }

    // Messier-Nummer
    const messierNumber = messierMap.get(entry.qid) || null;

    const attributes = { distanceLy };
    if (messierNumber !== null) attributes.messierNumber  = messierNumber;
    if (entry.constLabel)       attributes.constellation  = entry.constLabel;
    if (typeLabel)              attributes.type           = typeLabel;

    const propList = [
      `P2583 ${distanceLy.toLocaleString('de-DE')} Lj`,
      `sitelinks ${entry.sitelinks}`
    ];
    if (messierNumber !== null) propList.push(`M${messierNumber}`);
    if (entry.constLabel)       propList.push(`P59 ${entry.constLabel}`);
    if (typeLabel)              propList.push(`P31 ${typeLabel}`);

    const slug = toSlug(name);

    const concept = {
      id:       slug,
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
      const distStr = distanceLy.toLocaleString('de-DE');
      const mStr    = messierNumber !== null ? ` M${messierNumber}` : '';
      const cStr    = entry.constLabel ? ` (${entry.constLabel})` : '';
      console.log(`  + ${name}${mStr}${cStr} — ${distStr} Lj, ${entry.sitelinks} SL, ${entry.qid}`);
    } else {
      skipped++;
    }

    if (added >= NEBULA_TARGET) {
      console.log(`  Ziel (${NEBULA_TARGET}) erreicht.`);
      break;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// ---------------------------------------------------------------------------
// Messier-Nummern-Batch-Fetch
// ---------------------------------------------------------------------------

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
        const qid = String(itemUrl).split('/').pop();
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
// Hauptprogramm
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Wikidata-Ernte: galaxy + nebula ===');
  console.log(`Bestandsgröße astra_raw.json: ${rawData.length} Konzepte`);
  const existGalaxies = rawData.filter(c => c.category === 'galaxy').length;
  const existNebulae  = rawData.filter(c => c.category === 'nebula').length;
  console.log(`Bestehende Galaxien: ${existGalaxies}`);
  console.log(`Bestehende Nebel:    ${existNebulae}`);
  console.log(`Sitelink-Schwelle:   galaxy ≥ ${GALAXY_MIN_SITELINKS}, nebula ≥ ${NEBULA_MIN_SITELINKS}`);

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

  fs.writeFileSync(OUT_PATH, JSON.stringify(newConcepts, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${OUT_PATH}`);
}

main();
