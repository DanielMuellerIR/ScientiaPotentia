/**
 * wikidata_astra_w4.cjs — Astra-Ernte Welle 4
 *
 * Erntet sequentiell neue Konzepte für:
 *   1. star       — benannte Sterne mit dewiki-Sitelink, Helligkeit, Typ, Distanz
 *   2. moon       — weitere benannte Monde (natürliche Satelliten) mit Elternplanet + Durchmesser
 *   3. galaxy     — Galaxien, Sitelink-Schwelle ≥ 8 (nächste Notabilitätsstufe nach Welle 3)
 *   4. nebula     — Nebel, Sitelink-Schwelle ≥ 6
 *
 * Kategorien ohne aktive Generator-Templates (star_cluster, comet, constellation, object)
 * werden NICHT geerntet — der Generator baut für diese keine Fragen (zu wenige Konzepte
 * für fairen Distraktor-Pool; vgl. Kommentar in generate_astra.js Z. 309).
 *
 * Dedup: ID-Slug UND normierter Name gegen astra_raw.json + bereits gesammelte Konzepte.
 * Ausgabe: /tmp/astra_w4.json
 * Aufruf:  node scripts/data_sources/harvest/wikidata_astra_w4.cjs
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const UA              = 'ScientiaQuizWDQS_W4/1.0 (educational quiz; nfetzen@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS    = 2000;  // Freundlich zu WDQS — parallel laufen ggf. andere Agents
const MAX_RETRIES     = 4;

// Sitelink-Schwellen
const STAR_MIN_SITELINKS    = 8;   // Sterne: dewiki-Sitelink obligatorisch + gesamt ≥ 8
const MOON_MIN_SITELINKS    = 20;  // Monde: SL ≥ 20 — nur bekannte Monde
const GALAXY_MIN_SITELINKS  = 10;  // Galaxien: gleiche Stufe wie Welle 3, andere Subtypen
const NEBULA_MIN_SITELINKS  = 6;   // Nebel: nächste Stufe unter Welle 3 (hatte ≥ 8)

// Ziel-Mengen (soft — wird bei Erreichen abgebrochen)
const STAR_TARGET   = 40;
const MOON_TARGET   = 25;
const GALAXY_TARGET = 20;
const NEBULA_TARGET = 20;

// Wikidata-Einheiten-QIDs für Distanzumrechnung
const UNIT_LY  = 'Q531';       // Lichtjahr
const UNIT_PC  = 'Q12129';     // Parsec
const UNIT_KPC = 'Q11929860';  // Kiloparsec
const UNIT_MPC = 'Q3773454';   // Megaparsec
// Einheiten für Mondradius/-durchmesser
const UNIT_KM  = 'Q828224';    // Kilometer

const OUT_PATH = '/tmp/astra_w4.json';
const RAW_PATH = path.join(__dirname, '..', 'astra_raw.json');

// ---------------------------------------------------------------------------
// Hilfsfunktionen
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

/** Rechnet Wikidata-Distanz in Lichtjahre um. */
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

/** Rechnet Wikidata-Länge in Kilometer um (für Monddurchmesser). */
function toKm(amount, unitUrl) {
  const v = parseFloat(amount);
  if (!isFinite(v) || v <= 0) return null;
  const unitQid = String(unitUrl).split('/').pop();
  if (unitQid === UNIT_KM) return Math.round(v);
  if (unitQid === 'Q11573') return Math.round(v / 1000); // Meter → km
  return null;
}

function httpsGet(url, headers, retries = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const { statusCode } = res;
      if ((statusCode === 429 || statusCode === 503) && retries < MAX_RETRIES) {
        const wait = 4000 * Math.pow(2, retries);
        console.warn(`  HTTP ${statusCode} → Backoff ${wait} ms (Versuch ${retries + 2}/${MAX_RETRIES + 1})…`);
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
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
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

function val(b, key) { return b[key]?.value; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Dedup-Mechanismus (global für alle Kategorien)
// ---------------------------------------------------------------------------

const rawData           = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds       = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

const newConcepts = [];
const newSlugs    = new Set();
const newNamesNorm = new Set();

function isDuplicate(name, slug) {
  return existingIds.has(slug)
    || existingNamesNorm.has(normalizeName(name))
    || newSlugs.has(slug)
    || newNamesNorm.has(normalizeName(name));
}

function addConcept(concept) {
  if (isDuplicate(concept.name, concept.id)) return false;
  newConcepts.push(concept);
  newSlugs.add(concept.id);
  newNamesNorm.add(normalizeName(concept.name));
  return true;
}

// ---------------------------------------------------------------------------
// Batch-Hilfsfunktionen (wiederverwendet aus wikidata_galneb_w3.cjs)
// ---------------------------------------------------------------------------

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
          // Lichtjahre bevorzugen (direkte Einheit, kein Umrechnungsfehler)
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
// Sterntyp-Mapping
// Wikidata-Label (DE) → normierter Typ für astra_raw.json
// Reihenfolge: spezifischste Matches zuerst.
// ---------------------------------------------------------------------------

const STAR_TYPE_MAP = [
  ['Blauweißer Überriese',        'Blauweißer Überriese'],
  ['Blauweißer Unterriese',       'Blauweißer Unterriese'],
  ['Blauer Überriese',            'Blauer Überriese'],
  ['Blauer Riese',                'Blauer Riese'],
  ['Blauer Hauptreihenstern',     'Blauer Hauptreihenstern'],
  ['Blauer Zwergstern',           'Blauer Hauptreihenstern'],
  ['Roter Überriese',             'Roter Überriese'],
  ['Roter Riese',                 'Roter Riese'],
  ['Roter Zwerg',                 'Roter Zwerg'],
  ['Gelber Überriese',            'Gelber Überriese'],
  ['Gelber Riese',                'Gelber Riese'],
  ['Gelber Zwerg',                'Gelber Zwerg'],
  ['Oranger Riese',               'Oranger Riese'],
  ['Oranger Zwerg',               'Oranger Riese'],
  ['Weißer Zwerg',                'Weißer Zwerg'],
  ['Weißer Hauptreihen',          'Weißer Hauptreihenstern'],
  ['Weißer Riese',                'Heller Riese'],
  ['Heller Riese',                'Heller Riese'],
  ['Unterriese',                  'Blauweißer Unterriese'],
  ['Hauptreihenstern',            'Gelber Zwerg'],          // Fallback Hauptreihe → Gelber Zwerg
  ['Bedeckungsveränderlicher',    'Bedeckungsveränderlicher'],
  ['Stern',                       null],                    // zu generisch → verwerfen
];

function mapStarType(typeCandidates) {
  for (const [key, mapped] of STAR_TYPE_MAP) {
    for (const t of typeCandidates) {
      if (t.includes(key)) return mapped;
    }
  }
  return null;
}

/**
 * Leitet den Sterntyp aus der Spektralklasse (P215) ab.
 * Kurzform: O,B=Blau; A=Weiß; F,G=Gelb; K=Orange; M=Rot.
 * Luminositätsklasse: I/Ia/Ib=Überriese, II/III=Riese, IV=Unterriese/HR, V=Hauptreihe/Zwerg
 */
function classifySpectralClass(sc) {
  if (!sc) return null;
  // Hauptsequenz-Stern (V) oder keine Luminositätsklasse → Zwerg
  // Überriese (I, Ia, Ib) hat höchste Priorität
  const isSuperGiant = /[I]a?\b|Ib\b|Ic\b/.test(sc) && !/^.*(?:II|III|IV|V)/.test(sc);
  const isGiant      = /\bII\b|\bIII\b|\bII-III\b/.test(sc);
  const isSubgiant   = /\bIV\b/.test(sc);

  const firstLetter = sc.trim()[0]?.toUpperCase();
  if (!firstLetter) return null;

  if (/^[OB]/.test(sc.trim())) {
    if (isSuperGiant) return 'Blauer Überriese';
    if (isGiant)      return 'Blauer Riese';
    return 'Blauer Hauptreihenstern';
  }
  if (/^A/.test(sc.trim())) {
    if (isSuperGiant) return 'Blauer Überriese';
    if (isGiant)      return 'Heller Riese';
    return 'Weißer Hauptreihenstern';
  }
  if (/^[FG]/.test(sc.trim())) {
    if (isSuperGiant) return 'Gelber Überriese';
    if (isGiant)      return 'Gelber Riese';
    return 'Gelber Zwerg';
  }
  if (/^K/.test(sc.trim())) {
    if (isSuperGiant) return 'Oranger Riese';
    if (isGiant)      return 'Oranger Riese';
    return 'Oranger Riese';
  }
  if (/^M/.test(sc.trim())) {
    if (isSuperGiant) return 'Roter Überriese';
    if (isGiant)      return 'Roter Riese';
    return 'Roter Zwerg';
  }
  return null;
}


// ---------------------------------------------------------------------------
// QUERY 1 — Sterne
// ---------------------------------------------------------------------------

async function queryStars() {
  console.log('\n=== Query 1: Sterne (direkte QID-Liste, per Wikidata-API verifiziert) ===');

  // Strategie: Direkte QID-Liste statt URL-Matching oder P279*-Scan.
  // Alle QIDs per Wikidata-API verifiziert (2026-06-17).
  // Schema: constellation, type (aus P31 oder P215 Spektralklasse), distanceLy,
  //         apparentMagnitude — passend zu bestehenden star-Konzepten.
  const CURATED_STAR_QIDS = [
    'Q14046',   // Gemma (= Alphekka/Alphecca), Corona Borealis
    'Q15694',   // Gienah, Corvus
    'Q76868858',// Cor Caroli, Canes Venatici
    'Q13200',   // Naos (Zeta Puppis), Puppis
    'Q14036',   // Nunki (Sigma Sagittarii), Sagittarius
    'Q13327',   // Sadr (Gamma Cygni), Cygnus
    'Q78603928',// Shaula (Lambda Scorpii), Scorpius
    'Q13170',   // Diphda (Beta Ceti), Cetus
    'Q15709',   // Phact (Alpha Columbae), Columba
    'Q13039',   // Alpheratz (Alpha Andromedae), Andromeda
    'Q1321897', // Rastaban (Beta Draconis), Draco
    'Q693059',  // Arneb (Alpha Leporis), Lepus
    'Q13337',   // Kornephoros (Beta Herculis), Hercules
    'Q13206',   // Tarazed — ÜBERSPRUNGEN (schon im Bestand)
  ];

  // Batch-Query: Label, Sternbild (P59), Helligkeit (P1215), Spektralklasse (P215)
  const valClause = CURATED_STAR_QIDS.map(q => `wd:${q}`).join(' ');
  const query = `
SELECT DISTINCT ?item ?label ?constLabel ?magnitude ?spectralClass ?sitelinks WHERE {
  VALUES ?item { ${valClause} }
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  OPTIONAL {
    ?item wdt:P59 ?const .
    ?const rdfs:label ?constLabel FILTER(LANG(?constLabel) = "de")
  }
  OPTIONAL { ?item wdt:P1215 ?magnitude . }
  OPTIONAL { ?item wdt:P215 ?spectralClass . }
  OPTIONAL { ?item wikibase:sitelinks ?sitelinks . }
}
`;

  let bindings = [];
  try {
    bindings = await sparql(query);
    console.log(`  Treffer: ${bindings.length}`);
  } catch (err) {
    console.error(`  SPARQL-Fehler: ${err.message}`);
    return;
  }

  // P31-Typen per separatem Batch
  await sleep(MIN_DELAY_MS);
  const typeMap = new Map();
  const batchQ = `
SELECT DISTINCT ?item ?typeLabel WHERE {
  VALUES ?item { ${valClause} }
  ?item wdt:P31 ?typeItem .
  ?typeItem rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "de")
}
`;
  try {
    const tb = await sparql(batchQ);
    for (const b of tb) {
      const qid = String(val(b, 'item') || '').split('/').pop();
      const tl  = val(b, 'typeLabel');
      if (!qid || !tl) continue;
      if (!typeMap.has(qid)) typeMap.set(qid, new Set());
      typeMap.get(qid).add(tl);
    }
  } catch (err) {
    console.warn(`  Typ-Batch-Fehler: ${err.message}`);
  }

  // Nach QID gruppieren
  // Nach QID gruppieren (bindings aus dem Hauptquery oben)
  const byQid = new Map();
  for (const b of bindings) {
    const qid = String(val(b, 'item') || '').split('/').pop();
    if (!qid) continue;
    if (!byQid.has(qid)) {
      byQid.set(qid, {
        label:          val(b, 'label'),
        qid,
        constLabel:     val(b, 'constLabel'),
        apparentMag:    val(b, 'magnitude') ? parseFloat(val(b, 'magnitude')) : null,
        spectralClass:  val(b, 'spectralClass') || null,
        typeCandidates: typeMap.get(qid) || new Set()
      });
    } else {
      const entry = byQid.get(qid);
      if (!entry.constLabel && val(b, 'constLabel')) entry.constLabel = val(b, 'constLabel');
      const mag = val(b, 'magnitude') ? parseFloat(val(b, 'magnitude')) : null;
      if (mag !== null && (entry.apparentMag === null || mag < entry.apparentMag)) {
        entry.apparentMag = mag;
      }
      if (!entry.spectralClass && val(b, 'spectralClass')) {
        entry.spectralClass = val(b, 'spectralClass');
      }
    }
  }

  const allQidsForDist = [...byQid.keys()];
  await sleep(MIN_DELAY_MS);
  const distMap = await fetchDistancesForQids(allQidsForDist, 'Star');

  const sorted = [...byQid.values()];
  console.log(`  Einzigartige QIDs: ${sorted.length}`);

  let added = 0, skipped = 0, noType = 0, noDist = 0;

  for (const entry of sorted) {
    if (added >= STAR_TARGET) {
      console.log(`  Ziel (${STAR_TARGET}) erreicht.`);
      break;
    }

    const name = entry.label;
    if (!name) { skipped++; continue; }

    // Sterntyp ermitteln: zuerst P31-Labels, dann Spektralklasse als Fallback
    let mappedType = mapStarType(entry.typeCandidates);
    if (!mappedType && entry.spectralClass) {
      mappedType = classifySpectralClass(entry.spectralClass);
    }
    if (!mappedType) {
      console.log(`  - ${name} (${entry.qid}): kein Typ (P31: ${[...entry.typeCandidates].join('|') || '?'}, P215: ${entry.spectralClass || '?'}) → übersprungen`);
      noType++;
      skipped++;
      continue;
    }

    // Distanz: Sterne müssen eine messbare Distanz haben (außer Sonne)
    const distanceLy = distMap.get(entry.qid) || null;
    if (!distanceLy) { noDist++; skipped++; continue; }

    // Scheinbare Helligkeit (P1215) — nicht zwingend, aber gewünscht
    const apparentMagnitude = (entry.apparentMag !== null && isFinite(entry.apparentMag))
      ? Math.round(entry.apparentMag * 100) / 100
      : null;

    // Mindestens 2 brauchbare Attribute: constellation + type oder type + distanceLy
    const hasConstellation = !!entry.constLabel;
    const hasType          = !!mappedType;
    const hasDist          = !!distanceLy;
    const usefulAttrs      = [hasConstellation, hasType, hasDist, apparentMagnitude !== null]
      .filter(Boolean).length;
    if (usefulAttrs < 2) { skipped++; continue; }

    const attributes = {
      constellation:     entry.constLabel || '',
      type:              mappedType,
      distanceLy,
    };
    if (apparentMagnitude !== null) attributes.apparentMagnitude = apparentMagnitude;

    const propList = [
      `P31 ${mappedType}`,
      `P2583 ${distanceLy.toLocaleString('de-DE')} Lj`,
    ];
    if (entry.constLabel)          propList.push(`P59 ${entry.constLabel}`);
    if (apparentMagnitude !== null) propList.push(`P1215 mag ${apparentMagnitude}`);

    const conceptSlug = toSlug(name);

    const concept = {
      id:              conceptSlug,
      name,
      category:        'star',
      attributes,
      funFact:         '',
      sourceName:      'Wikidata',
      sourceUrl:       `https://www.wikidata.org/wiki/${entry.qid}`,
      verifyNote:      propList.join(', '),
      imageSearchTerm: `${name} star`
    };

    if (addConcept(concept)) {
      added++;
      const magStr  = apparentMagnitude !== null ? ` mag ${apparentMagnitude}` : '';
      const constStr = entry.constLabel ? ` (${entry.constLabel})` : '';
      console.log(`  + ${name}${constStr} — ${mappedType}, ${distanceLy} Lj${magStr}, ${entry.qid}`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped} (${noType} kein Typ, ${noDist} keine Distanz)`);
}

// ---------------------------------------------------------------------------
// QUERY 2 — Monde
// ---------------------------------------------------------------------------

// Bekannte Planeten-QIDs (für Elternplanet-Lookup via P397)
// Ermittelt durch direkte SPARQL-Tests: Jupiter=Q319, Saturn=Q193, Uranus=Q324,
// Neptun=Q332, Mars=Q111, Erde=Q2
const PLANET_QIDS = {
  'Q2':    'Erde',
  'Q111':  'Mars',
  'Q319':  'Jupiter',
  'Q193':  'Saturn',
  'Q324':  'Uranus',
  'Q332':  'Neptun',
};

// Bekannte Nicht-Mond QIDs ausschließen (Raumstationen, Teleskope etc.)
const EXCLUDED_MOON_QIDS = new Set([
  'Q25271',  // Internationale Raumstation
  'Q2513',   // Hubble-Weltraumteleskop
  'Q48604',  // Mir
  'Q23926758', // S/2015 (136472) 1 — Makemake-Mond, aber kein klassischer Planet-Mond
]);

async function queryMoons() {
  console.log('\n=== Query 2: Monde (P397-basiert, SL ≥ ' + MOON_MIN_SITELINKS + ') ===');

  // Monde via P397 (Elternobjekt) statt P31-Typ — zuverlässiger.
  // Bekannte Planeten-QIDs als VALUES-Filter sichern die Qualität.
  // Durchmesser via P2386.
  const planetQids = Object.keys(PLANET_QIDS).map(q => `wd:${q}`).join(' ');
  const query = `
SELECT DISTINCT ?item ?qid ?label ?parent ?diamAmount ?diamUnit ?sitelinks WHERE {
  VALUES ?parent { ${planetQids} }
  ?item wdt:P397 ?parent .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MOON_MIN_SITELINKS})

  # Durchmesser (P2386)
  OPTIONAL {
    ?item p:P2386 ?diamStmt .
    ?diamStmt psv:P2386 ?diamVal .
    ?diamVal wikibase:quantityAmount ?diamAmount .
    ?diamVal wikibase:quantityUnit ?diamUnit .
  }

  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 200
`;

  let bindings = [];
  try {
    bindings = await sparql(query);
    console.log(`  Treffer: ${bindings.length}`);
  } catch (err) {
    console.error(`  SPARQL-Fehler: ${err.message}`);
    return;
  }

  // Gruppiere nach QID
  const byQid = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!byQid.has(qid)) {
      const parentUrl = val(b, 'parent');
      const parentQid = parentUrl ? String(parentUrl).split('/').pop() : null;
      byQid.set(qid, {
        label:       val(b, 'label'),
        qid,
        parentQid,
        parentLabel: parentQid ? (PLANET_QIDS[parentQid] || null) : null,
        diamAmount:  val(b, 'diamAmount'),
        diamUnit:    val(b, 'diamUnit'),
        sitelinks:   parseInt(val(b, 'sitelinks') || '0'),
      });
    } else {
      const entry = byQid.get(qid);
      // Durchmesser: ersten gültigen Wert nehmen
      if (!entry.diamAmount && val(b, 'diamAmount')) {
        entry.diamAmount = val(b, 'diamAmount');
        entry.diamUnit   = val(b, 'diamUnit');
      }
    }
  }

  const sorted = [...byQid.values()].sort((a, b) => b.sitelinks - a.sitelinks);
  console.log(`  Einzigartige QIDs: ${sorted.length}`);

  let added = 0, skipped = 0, noParent = 0, noDiam = 0;

  for (const entry of sorted) {
    if (added >= MOON_TARGET) {
      console.log(`  Ziel (${MOON_TARGET}) erreicht.`);
      break;
    }

    const name = entry.label;
    if (!name) { skipped++; continue; }

    // Bekannte Nicht-Monde ausschließen (Raumstationen etc.)
    if (EXCLUDED_MOON_QIDS.has(entry.qid)) { skipped++; continue; }

    // Elternplanet aus direktem QID-Mapping
    const parentPlanet = entry.parentLabel || (entry.parentQid ? PLANET_QIDS[entry.parentQid] : null);
    if (!parentPlanet) { noParent++; skipped++; continue; }

    // Durchmesser
    let diameterKm = null;
    if (entry.diamAmount && entry.diamUnit) {
      diameterKm = toKm(entry.diamAmount, entry.diamUnit);
    }

    // Mond braucht Durchmesser UND Mindestgröße ≥ 20 km (obskure Mini-Monde ausschließen)
    if (!diameterKm) { noDiam++; skipped++; continue; }
    if (diameterKm < 20) {
      console.log(`  - ${name} (${parentPlanet}): ⌀ ${diameterKm} km < 20 km → übersprungen`);
      skipped++;
      continue;
    }

    const attributes = {
      parentPlanet,
      diameterKm,
    };

    const propList = [
      `P397 ${parentPlanet}`,
      `P2386 ${diameterKm} km`,
      `sitelinks ${entry.sitelinks}`
    ];

    const conceptSlug = toSlug(name);

    const concept = {
      id:              conceptSlug,
      name,
      category:        'moon',
      attributes,
      funFact:         '',
      sourceName:      'Wikidata',
      sourceUrl:       `https://www.wikidata.org/wiki/${entry.qid}`,
      verifyNote:      propList.join(', '),
      imageSearchTerm: `${name} moon`
    };

    if (addConcept(concept)) {
      added++;
      console.log(`  + ${name} (${parentPlanet}, ⌀ ${diameterKm} km, SL ${entry.sitelinks}, ${entry.qid})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped} (${noParent} kein Planet, ${noDiam} kein Durchmesser)`);
}

// ---------------------------------------------------------------------------
// Galaxientyp-Mapping (aus wikidata_galneb_w3.cjs übernommen)
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
// QUERY 3 — Galaxien (Welle 4, SL ≥ 8)
// ---------------------------------------------------------------------------

async function queryGalaxies() {
  console.log('\n=== Query 3: Galaxien (Welle 4, SL ≥ ' + GALAXY_MIN_SITELINKS + ') ===');

  // Drei Sub-Queries für verschiedene Galaxientypen
  const queries = [
    // A: Spiral- und Balkenspiralgalaxien
    `SELECT DISTINCT ?item ?qid ?label ?sitelinks WHERE {
  VALUES ?gc { wd:Q2488 wd:Q2490 }
  ?item wdt:P31 ?gc .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${GALAXY_MIN_SITELINKS})
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 150`,
    // B: Elliptische + Linsenförmige + Irreguläre
    `SELECT DISTINCT ?item ?qid ?label ?sitelinks WHERE {
  VALUES ?gc { wd:Q596913 wd:Q190438 wd:Q752374 wd:Q2495738 wd:Q320534 }
  ?item wdt:P31 ?gc .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${GALAXY_MIN_SITELINKS})
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 100`,
  ];

  const allBindings = [];
  for (const [idx, q] of queries.entries()) {
    try {
      const b = await sparql(q);
      console.log(`  Sub-Query ${String.fromCharCode(65 + idx)}: ${b.length} Treffer`);
      allBindings.push(...b);
    } catch (err) {
      console.warn(`  Sub-Query-Fehler: ${err.message}`);
    }
    if (idx < queries.length - 1) await sleep(MIN_DELAY_MS);
  }

  // Einzigartige QIDs
  const byQid = new Map();
  for (const b of allBindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!byQid.has(qid)) {
      byQid.set(qid, {
        label:          val(b, 'label'),
        qid,
        sitelinks:      parseInt(val(b, 'sitelinks') || '0'),
        typeCandidates: new Set()
      });
    }
  }

  const sorted = [...byQid.values()].sort((a, b) => b.sitelinks - a.sitelinks);
  console.log(`  Einzigartige QIDs: ${sorted.length}`);

  const topQids = sorted.slice(0, 100).map(e => e.qid);

  // Typen abrufen
  await sleep(MIN_DELAY_MS);
  const batchSize = 30;
  for (let i = 0; i < topQids.length; i += batchSize) {
    const batch = topQids.slice(i, i + batchSize);
    const valClause = batch.map(q => `wd:${q}`).join(' ');
    const typeQuery = `
SELECT DISTINCT ?item ?typeLabel WHERE {
  VALUES ?item { ${valClause} }
  ?item wdt:P31 ?typeItem .
  ?typeItem rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "de")
}
`;
    try {
      const typeBindings = await sparql(typeQuery);
      for (const b of typeBindings) {
        const itemUrl   = val(b, 'item');
        const typeLabel = val(b, 'typeLabel');
        if (!itemUrl || !typeLabel) continue;
        const qid = String(itemUrl).split('/').pop();
        if (byQid.has(qid)) byQid.get(qid).typeCandidates.add(typeLabel);
      }
      if (i + batchSize < topQids.length) await sleep(MIN_DELAY_MS);
    } catch (err) {
      console.warn(`  Typ-Batch-Fehler: ${err.message}`);
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

    // Galaxientyp ermitteln
    let mappedType = null;
    for (const [key, mapped] of GALAXY_TYPE_MAP) {
      for (const typeLabel of entry.typeCandidates) {
        if (typeLabel.includes(key)) { mappedType = mapped; break; }
      }
      if (mappedType) break;
    }

    if (!mappedType) { noType++; skipped++; continue; }

    const distanceLy = distMap.get(entry.qid) || 0;
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
      console.log(`  + ${name} (${mappedType}, ${distanceLy.toLocaleString('de-DE')} Lj, SL ${entry.sitelinks}, ${entry.qid})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped} (${noType} kein Typ, ${noDist} keine Distanz)`);
}

// ---------------------------------------------------------------------------
// QUERY 4 — Nebel (Welle 4, SL ≥ 6)
// ---------------------------------------------------------------------------

// Kuratierte bekannte Nebel mit Sitelinks knapp unter allg. Cutoff.
// QIDs per direktem SPARQL-Test verifiziert (2026-06-17):
// Q50042 = Carinanebel (SL 52), Q108041 = Rosettennebel (SL 40),
// Q338392 = NGC 2261 (SL 39), Q14273 = Kohlensack (SL 38),
// Q934700 = Supernova 1006 (SL 34), Q850101 = Merope-Nebel (SL 33)
// Pelicannebel (Q527158, SL 29), Cave Nebula (Q859146, SL 25),
// S Andromedae (Q546708, SL 25 — Supernova in M31, Sonderfall)
const CURATED_NEBULA_QIDS_W4 = [
  'Q50042',   // Carinanebel
  'Q108041',  // Rosettennebel
  'Q338392',  // NGC 2261 (Hubble's Variable Nebula)
  'Q14273',   // Kohlensack (Dunkelwolke)
  'Q934700',  // Supernova 1006
  'Q850101',  // Merope-Nebel
  'Q527158',  // Pelicannebel
  'Q859146',  // Cave Nebula (Höhlennebel IC 1805-Region)
  'Q224145',  // 30 Doradus / Tarantelnebel — große SL, aber schon in Bestand?
];

async function queryNebulae() {
  console.log('\n=== Query 4: Nebel (Welle 4, SL ≥ ' + NEBULA_MIN_SITELINKS + ') ===');

  const nebelQuery = `
SELECT DISTINCT ?item ?qid ?label ?typeLabel ?constLabel ?sitelinks WHERE {
  VALUES ?nc {
    wd:Q11282 wd:Q13632 wd:Q207436 wd:Q202265
    wd:Q204194 wd:Q203958 wd:Q854857
  }
  # Q101998 (Biom) absichtlich weggelassen — würde Ökosystemtypen einmischen
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
LIMIT 150
`;

  let bindings = [];
  try {
    bindings = await sparql(nebelQuery);
    console.log(`  Allg. Query: ${bindings.length} Treffer`);
  } catch (err) {
    console.error(`  SPARQL-Fehler: ${err.message}`);
  }

  await sleep(MIN_DELAY_MS);

  // Kuratierte QIDs
  const curatedQuery = `
SELECT DISTINCT ?item ?qid ?label ?typeLabel ?constLabel ?sitelinks WHERE {
  VALUES ?item { ${CURATED_NEBULA_QIDS_W4.map(q => `wd:${q}`).join(' ')} }
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
  }

  const allBindings = [...bindings, ...curatedBindings];
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
      console.log(`  + ${name}${mStr}${cStr} — ${distanceLy.toLocaleString('de-DE')} Lj, SL ${entry.sitelinks}, ${entry.qid}`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped} (${noDist} ohne Distanz)`);
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Wikidata-Ernte Welle 4: star + moon + galaxy + nebula ===');
  console.log(`Bestand astra_raw.json: ${rawData.length} Konzepte`);

  const counts = {};
  for (const c of rawData) counts[c.category] = (counts[c.category] || 0) + 1;
  console.log('Bestand nach Kategorie:', JSON.stringify(counts));
  console.log(`Ziele: star ≤ ${STAR_TARGET} neu, moon ≤ ${MOON_TARGET} neu, galaxy ≤ ${GALAXY_TARGET} neu, nebula ≤ ${NEBULA_TARGET} neu`);
  console.log(`MIN_DELAY_MS: ${MIN_DELAY_MS}`);

  try {
    await queryStars();
    await sleep(MIN_DELAY_MS);

    await queryMoons();
    await sleep(MIN_DELAY_MS);

    await queryGalaxies();
    await sleep(MIN_DELAY_MS);

    await queryNebulae();
  } catch (err) {
    console.error('\nFEHLER (unbehandelt):', err.message, err.stack);
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
