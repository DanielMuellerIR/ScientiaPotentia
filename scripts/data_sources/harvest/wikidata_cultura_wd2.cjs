/**
 * wikidata_cultura_wd2.cjs
 *
 * Welle 2: Neue Cultura-Konzepte aus Wikidata SPARQL.
 * Kategorien: composer, artwork, architecture, sculpture, literature.
 *
 * Notabilitätsfilter: verschachtelte Sitelink-Count-Subquery (≥10 Sitelinks),
 * vermeidet alphabetische Verzerrung und obskure/fehlkategorisierte Objekte.
 *
 * Ausgabe: scripts/data_sources/harvest/cultura_wd2.json (nicht wd1 überschreiben)
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_cultura_wd2.cjs
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// --- Konfiguration ----------------------------------------------------------

const UA              = 'ScientiaQuizWDQS/1.0 (educational quiz; nfetzen@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS    = 2000;   // Mindestpause zwischen Anfragen (WDQS-Limit)
const MAX_RETRIES     = 3;

const OUT_PATH = path.join(__dirname, 'cultura_wd2.json');
const RAW_PATH = path.join(__dirname, '..', 'cultura_raw.json');

// --- Hilfsfunktionen --------------------------------------------------------

/** Normalisiert einen Namen für Dedup-Vergleich. */
function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, '')       // Klammerzusätze entfernen
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Erstellt einen kebab-slug aus dem deutschen Namen (URL-sicher). */
function toSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** HTTPS GET → Promise<string> mit Retry bei 429/503. */
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
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(50000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/** SPARQL-Query gegen WDQS → Array von Binding-Objekten. */
async function sparql(query) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const raw = await httpsGet(url, {
    'User-Agent': UA,
    'Accept': 'application/sparql-results+json',
  });
  const json = JSON.parse(raw);
  return json.results.bindings;
}

/** Wert aus einem SPARQL-Binding. */
function val(binding, key) { return binding[key]?.value; }

/** Mindestpause. */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Jahres-Putz: nur positive 3-4-stellige Ganzzahlen (ISO-Datum-String oder Zahl).
 * Negative Jahre, Bereiche, sonstige Strings → null.
 */
function cleanYear(v) {
  if (typeof v === 'number') return (Number.isInteger(v) && v >= 100 && v <= 2100) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^\d{3,4}$/.test(t)) return Number(t);
    const m = t.match(/^(\d{4})-\d{2}-\d{2}/);
    if (m) { const y = Number(m[1]); return (y >= 100 && y <= 2100) ? y : null; }
  }
  return null;
}

// --- Dedup-Liste ------------------------------------------------------------

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds       = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

function isDuplicate(name, slug) {
  if (existingIds.has(slug))                       return true;
  if (existingNamesNorm.has(normalizeName(name)))  return true;
  return false;
}

// --- Neue Konzepte sammeln --------------------------------------------------

const newConcepts = [];
const newSlugs    = new Set();

function addConcept(concept) {
  if (isDuplicate(concept.name, concept.id)) return false;
  if (newSlugs.has(concept.id))              return false;
  newConcepts.push(concept);
  newSlugs.add(concept.id);
  existingIds.add(concept.id);
  existingNamesNorm.add(normalizeName(concept.name));
  return true;
}

// ============================================================================
// QUERY 1 — Komponisten (composer), Sitelink-Filter ≥ 10
// Attribute: birthYear, deathYear, nationality, era, notableWork
// Nationalitäts-Mapping: Wikidata-QID → deutsche Bezeichnung wie im Bestand.
// Epochen-Mapping: wird in der Verarbeitung auf bekannte Strings gemappt.
// ============================================================================

async function queryComposers() {
  console.log('\n=== Query 1: Komponisten (Sitelink ≥10) ===');

  // Wikidata-QID → deutscher Epochenname (Werte MÜSSEN exakt im Bestand vorkommen
  // oder einer neuen, konsistenten Schreibweise entsprechen).
  const ERA_MAP = {
    Q8361:    'Barock',
    Q81881:   'Wiener Klassik',
    Q14915627:'Wiener Klassik',
    Q12017736:'Romantik',
    Q39614:   'Romantik',
    Q131816:  'Spätromantik',
    Q28692761:'Romantik',
    Q2287068: 'Moderne',
    Q571525:  'Moderne',
    Q838948:  'Moderne',
    Q188473:  'Barock',
    Q1306494: 'Renaissance',
    Q46870:   'Renaissance',
    Q208505:  'Impressionismus',
    Q181639:  'Romantik',
    Q82753:   'Romantik',
  };

  // Nationalitäts-Mapping — Werte wie im Bestand
  const NAT_MAP = {
    Q183: 'Deutsch',        Q40:  'Österreichisch',  Q36:  'Polnisch',
    Q159: 'Russisch',       Q142: 'Französisch',     Q38:  'Italienisch',
    Q29:  'Spanisch',       Q145: 'Britisch',        Q34:  'Schwedisch',
    Q55:  'Niederländisch', Q35:  'Dänisch',         Q28:  'Ungarisch',
    Q31:  'Belgisch',       Q39:  'Schweizerisch',   Q20:  'Norwegisch',
    Q33:  'Finnisch',       Q45:  'Portugiesisch',   Q30:  'Amerikanisch',
    Q213: 'Tschechisch',    Q214: 'Slowakisch',      Q224: 'Kroatisch',
    Q215: 'Slowenisch',     Q403: 'Serbisch',
  };

  // Verschachtelte Sitelink-Subquery: zählt Sitelinks pro Item, filtert ≥10.
  // Outer Join holt dann dewiki-Artikel, Labels, Attribute.
  // birthDate/deathDate Pflichtfelder — stellt numerische Fragen sicher.
  const query = `
SELECT DISTINCT ?item ?qid ?label ?birthYear ?deathYear ?natQid ?eraQid ?notableWork WHERE {
  { SELECT ?item (COUNT(?sl) AS ?sitelinks) WHERE {
      ?item wdt:P106 wd:Q36834 .
      ?sl schema:about ?item .
    } GROUP BY ?item HAVING(?sitelinks >= 10) }
  # Deutsches Wikipedia-Artikel (Pflicht)
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Geburts- und Sterbedatum (Pflicht)
  ?item wdt:P569 ?birthDate .
  BIND(YEAR(?birthDate) AS ?birthYear)
  ?item wdt:P570 ?deathDate .
  BIND(YEAR(?deathDate) AS ?deathYear)
  FILTER(?birthYear < 1940)
  # Nationalität (optional)
  OPTIONAL { ?item wdt:P27 ?natItem . BIND(SUBSTR(STR(?natItem), 32) AS ?natQid) }
  # Musikrichtung/Epoche (optional)
  OPTIONAL { ?item wdt:P136 ?eraItem . BIND(SUBSTR(STR(?eraItem), 32) AS ?eraQid) }
  # Hauptwerk (optional, deutsches Label)
  OPTIONAL {
    ?item wdt:P800 ?workItem .
    ?workItem rdfs:label ?notableWork FILTER(LANG(?notableWork) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
LIMIT 120
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  // Einen Eintrag pro QID zusammenführen (erster Wert je Attribut)
  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:        val(b, 'label'),
        birthYear:   cleanYear(val(b, 'birthYear')),
        deathYear:   cleanYear(val(b, 'deathYear')),
        natQid:      val(b, 'natQid'),
        eraQid:      val(b, 'eraQid'),
        notableWork: val(b, 'notableWork'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.eraQid      && val(b, 'eraQid'))      e.eraQid      = val(b, 'eraQid');
      if (!e.notableWork && val(b, 'notableWork'))  e.notableWork = val(b, 'notableWork');
    }
  }

  let added = 0, skipped = 0;

  for (const [qid, info] of seen) {
    const { name, birthYear, deathYear, natQid, eraQid, notableWork } = info;
    if (!name || !birthYear || !deathYear) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    const attributes = { birthYear, deathYear };

    if (natQid && NAT_MAP[natQid]) attributes.nationality = NAT_MAP[natQid];
    if (eraQid && ERA_MAP[eraQid]) attributes.era = ERA_MAP[eraQid];
    if (notableWork)                attributes.notableWork = notableWork;

    // Mindest-Qualität: nationality oder notableWork muss vorhanden sein
    if (!attributes.nationality && !attributes.notableWork) { skipped++; continue; }

    const ok = addConcept({
      id:       slug,
      name,
      category: 'composer',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P569→birthYear:${birthYear}, P570→deathYear:${deathYear}${natQid ? `, P27→${natQid}` : ''}${eraQid ? `, P136→${eraQid}` : ''}${notableWork ? ', P800→notableWork' : ''}`,
      imageSearchTerm: `${name} composer portrait`,
    });

    if (ok) { added++; console.log(`  + [composer] ${name} (${birthYear}–${deathYear}) [${qid}]`); }
    else    { skipped++; }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 2 — Gemälde (artwork), Sitelink-Filter ≥ 15
// Attribute: creator, year, medium, location (alle exakt wie Bestand)
// Höherer Sitelink-Schwellwert (15): artwork-Pool hat 34 Einträge —
// nur sehr bekannte Gemälde sollen hinzukommen.
// ============================================================================

async function queryArtworks() {
  console.log('\n=== Query 2: Gemälde (Sitelink ≥15) ===');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?creatorLabel ?year ?mediumLabel ?locationLabel WHERE {
  { SELECT ?item (COUNT(?sl) AS ?sitelinks) WHERE {
      ?item wdt:P31 wd:Q3305213 .
      ?sl schema:about ?item .
    } GROUP BY ?item HAVING(?sitelinks >= 15) }
  # Deutsches Wikipedia (Pflicht)
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Urheber (Pflicht)
  ?item wdt:P170 ?creator .
  ?creator rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel) = "de")
  # Entstehungsjahr (Pflicht)
  ?item wdt:P571 ?created .
  BIND(YEAR(?created) AS ?year)
  FILTER(?year > 0 && ?year < 2024)
  # Medium (optional)
  OPTIONAL {
    ?item wdt:P186 ?mediumItem .
    ?mediumItem rdfs:label ?mediumLabel FILTER(LANG(?mediumLabel) = "de")
  }
  # Aufbewahrungsort (optional)
  OPTIONAL {
    ?item wdt:P276 ?locationItem .
    ?locationItem rdfs:label ?locationLabel FILTER(LANG(?locationLabel) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
LIMIT 100
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:     val(b, 'label'),
        creator:  val(b, 'creatorLabel'),
        year:     cleanYear(val(b, 'year')),
        medium:   val(b, 'mediumLabel'),
        location: val(b, 'locationLabel'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.medium   && val(b, 'mediumLabel'))   e.medium   = val(b, 'mediumLabel');
      if (!e.location && val(b, 'locationLabel')) e.location = val(b, 'locationLabel');
    }
  }

  let added = 0, skipped = 0;

  for (const [qid, info] of seen) {
    const { name, creator, year, medium, location } = info;
    if (!name || !creator || !year) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    const attributes = { creator, year };
    if (medium)   attributes.medium   = medium;
    if (location) attributes.location = location;

    const ok = addConcept({
      id:       slug,
      name,
      category: 'artwork',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P31=Q3305213, P170→creator:${creator}, P571→year:${year}${medium ? `, P186→medium` : ''}${location ? `, P276→location` : ''}`,
      imageSearchTerm: `${name} painting ${creator}`,
    });

    if (ok) { added++; console.log(`  + [artwork] ${name} (${creator}, ${year}) [${qid}]`); }
    else    { skipped++; }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 3 — Bauwerke (architecture), Sitelink-Filter ≥ 20
// Zwei Batches (getrennte Sitelink-Subqueries, je ein Bauwerkstyp) um Timeout
// zu vermeiden. Nur wenige optionale Joins nach dem Sitelink-Filter.
// Attribute: country, year (wenn sauber)
// ============================================================================

async function queryArchitectureBatch(label, typeQid) {
  // Strategie: dewiki-Artikel als Notabilitäts-Proxy (kein Sitelink-COUNT —
  // kombinierte Sitelink-Subquery + dewiki-Join timeoutet zuverlässig).
  // P18 (Bild vorhanden) als zusätzlicher Bekanntheits-Filter.
  // Nur Land + Jahr (keine weiteren optionalen Joins).
  const query = `
SELECT DISTINCT ?item ?qid ?label ?year ?countryLabel WHERE {
  ?item wdt:P31 wd:${typeQid} .
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wdt:P18 ?img .
  ?item wdt:P17 ?countryItem .
  ?countryItem rdfs:label ?countryLabel FILTER(LANG(?countryLabel) = "de")
  OPTIONAL {
    ?item wdt:P571 ?builtDate .
    BIND(YEAR(?builtDate) AS ?year)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?label
LIMIT 50
`;
  return sparql(query);
}

async function queryArchitecture() {
  console.log('\n=== Query 3: Bauwerke (Sitelink ≥20) ===');

  // Batches: Kathedralen (Q2977), Schlösser (Q23413), Paläste (Q16748867)
  let allBindings = [];
  const batches = [
    { label: 'Kathedralen',  typeQid: 'Q2977'     },
    { label: 'Schlösser',    typeQid: 'Q23413'    },
    { label: 'Paläste',      typeQid: 'Q16748867' },
  ];
  for (const b of batches) {
    console.log(`  Batch: ${b.label}...`);
    const result = await queryArchitectureBatch(b.label, b.typeQid);
    console.log(`    ${result.length} Treffer`);
    allBindings = allBindings.concat(result);
    await sleep(1500);
  }
  const bindings = allBindings;
  console.log(`  Rohergebnis gesamt: ${bindings.length} Treffer`);

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:    val(b, 'label'),
        year:    cleanYear(val(b, 'year')),
        country: val(b, 'countryLabel'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.year    && val(b, 'year'))         e.year    = cleanYear(val(b, 'year'));
      if (!e.country && val(b, 'countryLabel')) e.country = val(b, 'countryLabel');
    }
  }

  let added = 0, skipped = 0;

  for (const [qid, info] of seen) {
    const { name, year, country } = info;
    if (!name || !country) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    const attributes = { country };
    if (year) attributes.year = year;

    const ok = addConcept({
      id:       slug,
      name,
      category: 'architecture',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P31=Bauwerk, P17→country:${country}${year ? `, P571→year:${year}` : ''}`,
      imageSearchTerm: `${name} architecture`,
    });

    if (ok) { added++; console.log(`  + [architecture] ${name} [${country}${year ? `, ${year}` : ''}] [${qid}]`); }
    else    { skipped++; }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 4 — Skulpturen (sculpture), Sitelink-Filter ≥ 10
// Attribute: creator, year, material, location, heightM
// ============================================================================

async function querySculptures() {
  console.log('\n=== Query 4: Skulpturen (Sitelink ≥10) ===');

  // Keine verschachtelte Sitelink-Subquery (timeoutet bei optionalen Joins).
  // Stattdessen: dewiki-Artikel + P18 (Bild) als Notabilitäts-Proxy.
  // Nur zwei Pflicht-Attribute (creator, material) um Join-Last zu reduzieren.
  const query = `
SELECT DISTINCT ?item ?qid ?label ?creatorLabel ?year ?materialLabel ?locationLabel WHERE {
  ?item wdt:P31 wd:Q860861 .
  # Deutsches Wikipedia (Pflicht, Bekanntheit)
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Bild vorhanden (weiterer Bekanntheits-Filter)
  ?item wdt:P18 ?img .
  # Urheber (optional)
  OPTIONAL {
    ?item wdt:P170 ?creator .
    ?creator rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel) = "de")
  }
  # Entstehungsjahr (optional)
  OPTIONAL {
    ?item wdt:P571 ?created .
    BIND(YEAR(?created) AS ?year)
  }
  # Material (optional)
  OPTIONAL {
    ?item wdt:P186 ?materialItem .
    ?materialItem rdfs:label ?materialLabel FILTER(LANG(?materialLabel) = "de")
  }
  # Aufbewahrungsort (optional)
  OPTIONAL {
    ?item wdt:P276 ?locationItem .
    ?locationItem rdfs:label ?locationLabel FILTER(LANG(?locationLabel) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?label
LIMIT 80
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:     val(b, 'label'),
        creator:  val(b, 'creatorLabel'),
        year:     cleanYear(val(b, 'year')),
        material: val(b, 'materialLabel'),
        location: val(b, 'locationLabel'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.creator  && val(b, 'creatorLabel'))  e.creator  = val(b, 'creatorLabel');
      if (!e.year)                                 e.year     = cleanYear(val(b, 'year'));
      if (!e.material && val(b, 'materialLabel')) e.material = val(b, 'materialLabel');
      if (!e.location && val(b, 'locationLabel')) e.location = val(b, 'locationLabel');
    }
  }

  let added = 0, skipped = 0;

  for (const [qid, info] of seen) {
    const { name, creator, year, material, location } = info;
    if (!name) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    // Mindest-Qualität: creator oder material muss vorhanden sein
    if (!creator && !material) { skipped++; continue; }

    const attributes = {};
    if (creator)  attributes.creator  = creator;
    if (year)     attributes.year     = year;
    if (material) attributes.material = material;
    if (location) attributes.location = location;

    const ok = addConcept({
      id:       slug,
      name,
      category: 'sculpture',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P31=Q860861${creator ? `, P170→creator:${creator}` : ''}${year ? `, P571→year:${year}` : ''}${material ? `, P186→material:${material}` : ''}`,
      imageSearchTerm: `${name} sculpture`,
    });

    if (ok) { added++; console.log(`  + [sculpture] ${name}${creator ? ` (${creator})` : ''}${year ? `, ${year}` : ''} [${qid}]`); }
    else    { skipped++; }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 5 — Literatur (literature), Sitelink-Filter ≥ 15
// Typen: Roman (Q7725310), Epos (Q8261), Drama (Q25379), Novelle (Q149537).
// Attribute: author, year, language, genre (alle wie Bestand-Schreibweise)
// ============================================================================

async function queryLiterature() {
  console.log('\n=== Query 5: Literatur (Sitelink ≥15) ===');

  // Sprach-Mapping: Wikidata-Sprachitem-Label → deutsche Schreibweise wie im Bestand
  // Die meisten Labels sind sowieso deutsch, da wir de-Labels abfragen.
  // Nur Sonderfälle explizit mappen, damit einheitliche Werte entstehen.
  const LANG_MAP = {
    'Englisch':          'Englisch',
    'Deutsch':           'Deutsch',
    'Französisch':       'Französisch',
    'Russisch':          'Russisch',
    'Spanisch':          'Spanisch',
    'Italienisch':       'Italienisch',
    'Japanisch':         'Japanisch',
    'Chinesisch':        'Chinesisch',
    'Altgriechisch':     'Altgriechisch',
    'Latein':            'Latein',
    'Arabisch':          'Arabisch',
    'Portugiesisch':     'Portugiesisch',
    'Niederländisch':    'Niederländisch',
    'Polnisch':          'Polnisch',
    'Tschechisch':       'Tschechisch',
    'Norwegisch':        'Norwegisch',
    'Schwedisch':        'Schwedisch',
    'Dänisch':           'Dänisch',
  };

  // Gattungs-Mapping: Wikidata-Gattungslabel → Bestand-Schreibweise
  // Wichtig: Labels aus Wikidata sind oft nicht normenidentisch mit dem Bestand.
  const GENRE_MAP = {
    'Roman':              'Roman',
    'Epos':               'Epos',
    'Episches Gedicht':   'Episches Gedicht',
    'Drama':              'Drama',
    'Theaterstück':       'Drama',
    'Novelle':            'Erzählung',
    'Kurzgeschichte':     'Erzählung',
    'Tragödie':           'Tragödie',
    'Komödie':            'Komödie',
    'Gedicht':            'Gedicht',
    'Lyrik':              'Gedicht',
  };

  // Keine Sitelink-Subquery: dewiki-Artikel ist Notabilitäts-Proxy.
  // VALUES-Liste auf zwei Typen begrenzt (mehr = Timeout-Risiko).
  // Sprache und Gattung bleiben optional (erhöhen Ergebnis-Qualität ohne Timeout).
  const query = `
SELECT DISTINCT ?item ?qid ?label ?authorLabel ?year ?langLabel ?genreLabel WHERE {
  VALUES ?type { wd:Q7725310 wd:Q8261 }
  ?item wdt:P31 ?type .
  # Deutsches Wikipedia (Pflicht)
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Autor (Pflicht)
  ?item wdt:P50 ?author .
  ?author rdfs:label ?authorLabel FILTER(LANG(?authorLabel) = "de")
  # Erscheinungsjahr (Pflicht)
  ?item wdt:P577 ?pubDate .
  BIND(YEAR(?pubDate) AS ?year)
  FILTER(?year > 0 && ?year < 2024)
  # Sprache (optional)
  OPTIONAL {
    ?item wdt:P407 ?langItem .
    ?langItem rdfs:label ?langLabel FILTER(LANG(?langLabel) = "de")
  }
  # Gattung (optional)
  OPTIONAL {
    ?item wdt:P136 ?genreItem .
    ?genreItem rdfs:label ?genreLabel FILTER(LANG(?genreLabel) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?label
LIMIT 80
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:     val(b, 'label'),
        author:   val(b, 'authorLabel'),
        year:     cleanYear(val(b, 'year')),
        language: val(b, 'langLabel'),
        genre:    val(b, 'genreLabel'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.language && val(b, 'langLabel'))  e.language = val(b, 'langLabel');
      if (!e.genre    && val(b, 'genreLabel')) e.genre    = val(b, 'genreLabel');
    }
  }

  let added = 0, skipped = 0;

  for (const [qid, info] of seen) {
    const { name, author, year, language, genre } = info;
    if (!name || !author || !year) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    // Sprache normalisieren (nur bekannte Werte übernehmen)
    const langNorm  = language ? (LANG_MAP[language] || language)  : undefined;
    const genreNorm = genre    ? (GENRE_MAP[genre]   || genre)     : undefined;

    const attributes = { author, year };
    if (langNorm)  attributes.language = langNorm;
    if (genreNorm) attributes.genre    = genreNorm;

    // Mindest-Qualität: Sprache oder Genre muss vorhanden sein
    if (!langNorm && !genreNorm) { skipped++; continue; }

    const ok = addConcept({
      id:       slug,
      name,
      category: 'literature',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P50→author:${author}, P577→year:${year}${langNorm ? `, P407→language:${langNorm}` : ''}${genreNorm ? `, P136→genre:${genreNorm}` : ''}`,
      imageSearchTerm: `${name} book cover`,
    });

    if (ok) { added++; console.log(`  + [literature] ${name} (${author}, ${year}) [${qid}]`); }
    else    { skipped++; }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// Hauptprogramm
// ============================================================================

async function main() {
  console.log('=== Cultura Wikidata Harvest — Welle 2 ===');
  console.log(`Bestand: ${rawData.length} Konzepte (Dedup-Basis)`);

  try {
    await queryComposers();
    await sleep(MIN_DELAY_MS);

    await queryArtworks();
    await sleep(MIN_DELAY_MS);

    await queryArchitecture();
    await sleep(MIN_DELAY_MS);

    await querySculptures();
    await sleep(MIN_DELAY_MS);

    await queryLiterature();
  } catch (err) {
    console.error('\nFEHLER:', err.message);
    process.exit(1);
  }

  // Ergebnis schreiben
  fs.writeFileSync(OUT_PATH, JSON.stringify(newConcepts, null, 2), 'utf8');

  console.log('\n=== Zusammenfassung ===');
  const cats = {};
  for (const c of newConcepts) cats[c.category] = (cats[c.category] || 0) + 1;
  for (const [k, v] of Object.entries(cats)) console.log(`  ${k}: ${v}`);
  console.log(`  GESAMT: ${newConcepts.length} neue Konzepte`);
  console.log(`\nGeschrieben: ${OUT_PATH}`);
}

main();
