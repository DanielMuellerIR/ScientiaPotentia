/**
 * wikidata_cultura.cjs
 *
 * Erntet neue Cultura-Konzepte (composer, artwork, architecture, sculpture)
 * aus Wikidata SPARQL. Nur Objekte mit deutschem Wikipedia-Artikel.
 * Nur deterministisch belegte Attribute — exakt die Schlüssel, die
 * generate_cultura.js zu Fragen verarbeitet.
 *
 * Ausgabe: scripts/data_sources/harvest/cultura_wd1.json (NICHT mergen!)
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_cultura.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Konfiguration -------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (educational quiz; nfetzen@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS = 1500;  // Mindestpause zwischen WDQS-Anfragen
const MAX_RETRIES = 3;

const OUT_PATH = path.join(__dirname, 'cultura_wd1.json');
const RAW_PATH = path.join(__dirname, '..', 'cultura_raw.json');

// --- Hilfsfunktionen -----------------------------------------------------

/** Normalisiert einen Namen für Dedup-Vergleich. */
function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, '')  // Klammerzusätze ("David (Michelangelo)") entfernen
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Erstellt einen kebab-slug aus dem deutschen Namen. */
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
        const wait = 3000 * (retries + 1);
        console.warn(`  HTTP ${statusCode}, warte ${wait} ms, Versuch ${retries + 2}/${MAX_RETRIES + 1}...`);
        res.resume();
        setTimeout(() => {
          httpsGet(url, headers, retries + 1).then(resolve).catch(reject);
        }, wait);
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

/** SPARQL-Query gegen WDQS → Array von Binding-Objekten. */
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

/** Wert aus einem SPARQL-Binding lesen. */
function val(binding, key) {
  return binding[key]?.value;
}

/** Pausiert mind. ms Millisekunden. */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Jahres-Putz: nur positive 3–4-stellige Ganzzahlen (wie cleanYear im Generator).
 * Negative Jahre, Bereiche und andere Strings → null.
 */
function cleanYear(v) {
  if (typeof v === 'number') return (Number.isInteger(v) && v >= 100 && v <= 2100) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    // Nur reine 3-4-stellige Zahlen ohne Vorzeichen oder Sonderzeichen
    if (/^\d{3,4}$/.test(t)) return Number(t);
    // ISO-Datum aus WDQS ("1756-01-27T00:00:00Z") → Jahr extrahieren
    const m = t.match(/^(\d{4})-\d{2}-\d{2}/);
    if (m) {
      const y = Number(m[1]);
      return (y >= 100 && y <= 2100) ? y : null;
    }
  }
  return null;
}

// --- Dedup-Liste aufbauen ------------------------------------------------

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

function isDuplicate(name, slug) {
  if (existingIds.has(slug)) return true;
  if (existingNamesNorm.has(normalizeName(name))) return true;
  return false;
}

// --- Neue Konzepte sammeln -----------------------------------------------

const newConcepts = [];
const newSlugs = new Set();

function addConcept(concept) {
  if (isDuplicate(concept.name, concept.id)) return false;
  if (newSlugs.has(concept.id)) return false;
  newConcepts.push(concept);
  newSlugs.add(concept.id);
  existingIds.add(concept.id);
  existingNamesNorm.add(normalizeName(concept.name));
  return true;
}

// =========================================================================
// QUERY 1 — Komponisten (composer)
// Kriterien: P106 = Komponist (Q36834), dewiki-Artikel, P569/P570 vorhanden.
// Attribute (exakt wie Generator): birthYear, deathYear, nationality, era, notableWork
// =========================================================================

async function queryComposers() {
  console.log('\n=== Query 1: Komponisten ===');

  // Epochen-Mapping: Wikidata-QIDs auf deutsche Bezeichnungen wie im Bestand.
  // Nur weit verbreitete, eindeutige Epochen — sonst weglassen.
  const ERA_MAP = {
    Q8361: 'Barock',
    Q81881: 'Klassik',     // Wiener Klassik
    Q14915627: 'Klassik',
    Q12017736: 'Romantik',
    Q39614: 'Romantik',
    Q131816: 'Romantik',   // Spätromantik
    Q28692761: 'Romantik',
    Q2287068: 'Moderne',
    Q571525: 'Moderne',
    Q838948: 'Zeitgenössisch',
    Q188473: 'Barock',     // Frühbarock
    Q1306494: 'Renaissance',
    Q46870: 'Renaissance',
  };

  // Nationalitäts-Mapping: P27-QID → deutsches Landesnamen-Label (wie im Bestand).
  const NAT_MAP = {
    Q183: 'Deutsch', Q40: 'Österreichisch', Q36: 'Polnisch', Q159: 'Russisch',
    Q142: 'Französisch', Q38: 'Italienisch', Q29: 'Spanisch', Q145: 'Britisch',
    Q34: 'Schwedisch', Q55: 'Niederländisch', Q35: 'Dänisch', Q28: 'Ungarisch',
    Q191: 'Estnisch', Q37: 'Litauisch', Q218: 'Rumänisch', Q211: 'Lettisch',
    Q31: 'Belgisch', Q32: 'Luxemburgisch', Q39: 'Schweizerisch', Q20: 'Norwegisch',
    Q33: 'Finnisch', Q45: 'Portugiesisch', Q77: 'Argentinisch', Q16: 'Kanadisch',
    Q30: 'Amerikanisch', Q736: 'Brasilianisch', Q155: 'Brasilianisch',
    Q228: 'Andorranisch', Q184: 'Weißrussisch', Q233: 'Maltesisch',
    Q229: 'Zypriotisch', Q214: 'Slowakisch', Q213: 'Tschechisch',
    Q224: 'Kroatisch', Q215: 'Slowenisch', Q219: 'Bulgarisch',
    Q220: 'Nordmazedonisch', Q222: 'Albanisch', Q225: 'Bosnisch',
    Q403: 'Serbisch', Q458: 'Europäisch',
  };

  // Zuerst bekannte, qualitativ hochwertige Klassik-Komponisten abfragen.
  // P1412 = Sprache (schränkt sprachräumlich ein: DE/AT/CH-Raum + westeuropäisch).
  // P18 = Bild vorhanden (bekannter Komponist-Proxy).
  // LIMIT 80 — eng, um WDQS-Timeout zu vermeiden.
  const query = `
SELECT DISTINCT ?item ?qid ?label ?birthYear ?deathYear ?natQid ?notableWork WHERE {
  # Muss Komponist sein
  ?item wdt:P106 wd:Q36834 .
  # Deutsches Wikipedia-Artikel vorhanden (Bekanntheit)
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  # Deutsches Label
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Geburtsdatum vorhanden
  ?item wdt:P569 ?birthDate .
  BIND(YEAR(?birthDate) AS ?birthYear)
  # Sterbedatum vorhanden (nur verstorbene Personen = kein Lebende-Personen-Problem)
  ?item wdt:P570 ?deathDate .
  BIND(YEAR(?deathDate) AS ?deathYear)
  # Nur historische Komponisten (Geburts- vor 1940)
  FILTER(?birthYear < 1940)
  # Bild vorhanden (zusätzlicher Qualitäts-Proxy)
  ?item wdt:P18 ?img .
  # Nationalität (optional)
  OPTIONAL { ?item wdt:P27 ?natItem . BIND(SUBSTR(STR(?natItem), 32) AS ?natQid) }
  # Notable work (optional, erstes verfügbares)
  OPTIONAL {
    ?item wdt:P800 ?workItem .
    ?workItem rdfs:label ?notableWork FILTER(LANG(?notableWork) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?label
LIMIT 80
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  // Gruppieren: ein Eintrag pro Komponist (erster notableWork)
  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name: val(b, 'label'),
        birthYear: cleanYear(val(b, 'birthYear')),
        deathYear: cleanYear(val(b, 'deathYear')),
        natQid: val(b, 'natQid'),
        notableWork: val(b, 'notableWork'),
        qid,
      });
    } else if (!seen.get(qid).notableWork && val(b, 'notableWork')) {
      // erstes Notable Work nachfüllen
      seen.get(qid).notableWork = val(b, 'notableWork');
    }
  }

  for (const [qid, info] of seen) {
    const { name, birthYear, deathYear, natQid, notableWork } = info;
    if (!name) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    // Mindest-Attribut: birthYear + deathYear müssen sauber sein
    if (!birthYear || !deathYear) { skipped++; continue; }

    // Attribute aufbauen — nur Keys, die der Generator nutzt
    const attributes = {
      birthYear,
      deathYear,
    };

    // Nationalität aus Mapping
    if (natQid && NAT_MAP[natQid]) {
      attributes.nationality = NAT_MAP[natQid];
    }

    // Notable Work (erster sauberer Wert)
    if (notableWork) {
      attributes.notableWork = notableWork;
    }

    // Mindest-Qualität: nationality oder notableWork muss vorhanden sein,
    // damit mindestens einer der Fragetypen über birthYear/deathYear hinaus
    // bedient werden kann.
    if (!attributes.nationality && !attributes.notableWork) { skipped++; continue; }

    const ok = addConcept({
      id: slug,
      name,
      category: 'composer',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P569→birthYear:${birthYear}, P570→deathYear:${deathYear}${natQid ? `, P27→${natQid}` : ''}${notableWork ? `, P800→notableWork` : ''}`,
      imageSearchTerm: `${name} composer portrait`,
    });

    if (ok) {
      added++;
      console.log(`  + [composer] ${name} (${birthYear}–${deathYear}) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// =========================================================================
// QUERY 1b — Bekannte Komponisten (gezielt per Label)
// Ergänzt Query 1 um weltbekannte Komponisten, die alphabetisch nicht in
// den ersten 80 Ergebnissen erscheinen.
// =========================================================================

async function queryComposersKnown() {
  console.log('\n=== Query 1b: Bekannte Komponisten (gezielt) ===');

  const NAT_MAP = {
    Q183: 'Deutsch', Q40: 'Österreichisch', Q36: 'Polnisch', Q159: 'Russisch',
    Q142: 'Französisch', Q38: 'Italienisch', Q29: 'Spanisch', Q145: 'Britisch',
    Q34: 'Schwedisch', Q55: 'Niederländisch', Q35: 'Dänisch', Q28: 'Ungarisch',
    Q191: 'Estnisch', Q37: 'Litauisch', Q218: 'Rumänisch', Q211: 'Lettisch',
    Q31: 'Belgisch', Q32: 'Luxemburgisch', Q39: 'Schweizerisch', Q20: 'Norwegisch',
    Q33: 'Finnisch', Q45: 'Portugiesisch', Q77: 'Argentinisch', Q16: 'Kanadisch',
    Q30: 'Amerikanisch', Q736: 'Brasilianisch', Q155: 'Brasilianisch',
    Q213: 'Tschechisch', Q214: 'Slowakisch', Q224: 'Kroatisch',
    Q215: 'Slowenisch', Q403: 'Serbisch', Q131964: 'Tschechisch',
    Q3932079: 'Italienisch', Q12548: 'Deutsch', Q4948: 'Italienisch',
    Q699964: 'Tschechisch', Q174306: 'Italienisch', Q209857: 'Italienisch',
    Q153015: 'Deutsch', Q3399982: 'Italienisch', Q170174: 'Italienisch',
    Q533534: 'Österreichisch',
  };

  // Gezielte bekannte Komponisten per deutschem Label
  const known = [
    'Felix Mendelssohn Bartholdy', 'Niccolò Paganini', 'Gaetano Donizetti',
    'Christoph Willibald Gluck', 'Arcangelo Corelli', 'Claudio Monteverdi',
    'Tomaso Albinoni', 'Clara Schumann', 'Edward Elgar', 'Luigi Boccherini',
    'Georg Philipp Telemann', 'Domenico Scarlatti', 'Jean-Philippe Rameau',
    'François Couperin', 'Vincenzo Bellini', 'Gioachino Rossini',
    'Jacques Offenbach', 'Leoš Janáček', 'Béla Bartók', 'Anton Bruckner',
    'Jules Massenet', 'Mily Balakirew', 'Erik Satie', 'Charles Gounod',
    'Leonard Bernstein', 'Giovanni Pierluigi da Palestrina', 'Heinrich Schütz',
    'Antonio Salieri', 'Carl Maria von Weber', 'Robert Volkmann',
  ];

  const labelFilter = known.map(n => `STR(?label) = "${n}"`).join(' || ');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?birthYear ?deathYear ?natQid ?notableWork WHERE {
  ?item wdt:P106 wd:Q36834 .
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  FILTER(${labelFilter})
  ?item wdt:P569 ?birthDate .
  BIND(YEAR(?birthDate) AS ?birthYear)
  ?item wdt:P570 ?deathDate .
  BIND(YEAR(?deathDate) AS ?deathYear)
  OPTIONAL { ?item wdt:P27 ?natItem . BIND(SUBSTR(STR(?natItem), 32) AS ?natQid) }
  OPTIONAL {
    ?item wdt:P800 ?workItem .
    ?workItem rdfs:label ?notableWork FILTER(LANG(?notableWork) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
LIMIT 80
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  // Gruppieren: ein Eintrag pro Komponist
  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name: val(b, 'label'),
        birthYear: cleanYear(val(b, 'birthYear')),
        deathYear: cleanYear(val(b, 'deathYear')),
        natQid: val(b, 'natQid'),
        notableWork: val(b, 'notableWork'),
        qid,
      });
    } else if (!seen.get(qid).notableWork && val(b, 'notableWork')) {
      seen.get(qid).notableWork = val(b, 'notableWork');
    }
  }

  for (const [qid, info] of seen) {
    const { name, birthYear, deathYear, natQid, notableWork } = info;
    if (!name || !birthYear || !deathYear) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    const attributes = { birthYear, deathYear };
    if (natQid && NAT_MAP[natQid]) {
      attributes.nationality = NAT_MAP[natQid];
    }
    if (notableWork) {
      attributes.notableWork = notableWork;
    }

    // Nur hinzufügen wenn nationality oder notableWork vorhanden
    if (!attributes.nationality && !attributes.notableWork) { skipped++; continue; }

    const ok = addConcept({
      id: slug,
      name,
      category: 'composer',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P569→birthYear:${birthYear}, P570→deathYear:${deathYear}${natQid ? `, P27→${natQid}` : ''}${notableWork ? `, P800→notableWork` : ''}`,
      imageSearchTerm: `${name} composer portrait`,
    });

    if (ok) {
      added++;
      console.log(`  + [composer] ${name} (${birthYear}–${deathYear}) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// =========================================================================
// QUERY 2 — Gemälde (artwork)
// Kriterien: P31 = Gemälde (Q3305213), dewiki, P170 (Urheber), P571 (Jahr).
// Attribute: creator, year, medium, location, country, era
// =========================================================================

async function queryArtworks() {
  console.log('\n=== Query 2: Gemälde ===');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?creatorLabel ?year ?mediumLabel ?locationLabel WHERE {
  # Muss Gemälde sein
  ?item wdt:P31 wd:Q3305213 .
  # Deutsches Wikipedia
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  # Deutsches Label
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Bild vorhanden (bekannte Werke haben P18)
  ?item wdt:P18 ?img .
  # Urheber
  ?item wdt:P170 ?creator .
  ?creator rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel) = "de")
  # Entstehungsjahr
  ?item wdt:P571 ?created .
  BIND(YEAR(?created) AS ?year)
  FILTER(?year > 0 && ?year < 2024)
  # Medium/Technik (optional)
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
ORDER BY ?label
LIMIT 80
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  // Gruppieren nach QID: erster Medium- und Location-Wert je Werk
  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name: val(b, 'label'),
        creator: val(b, 'creatorLabel'),
        year: cleanYear(val(b, 'year')),
        medium: val(b, 'mediumLabel'),
        location: val(b, 'locationLabel'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.medium && val(b, 'mediumLabel')) e.medium = val(b, 'mediumLabel');
      if (!e.location && val(b, 'locationLabel')) e.location = val(b, 'locationLabel');
    }
  }

  for (const [qid, info] of seen) {
    const { name, creator, year, medium, location } = info;
    if (!name || !creator || !year) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    const attributes = { creator, year };
    if (medium) attributes.medium = medium;
    if (location) attributes.location = location;

    const ok = addConcept({
      id: slug,
      name,
      category: 'artwork',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P31=Q3305213, P170→creator:${creator}, P571→year:${year}${medium ? `, P186→medium` : ''}${location ? `, P276→location` : ''}`,
      imageSearchTerm: `${name} painting ${creator}`,
    });

    if (ok) {
      added++;
      console.log(`  + [artwork] ${name} (${creator}, ${year}) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// =========================================================================
// QUERY 3 — Bauwerke (architecture)
// Kriterien: P31 ∈ {Gebäude Q41176, Denkmal Q4989906 usw.}, dewiki,
// P571/P1619 (Jahr), P17 (Land). Nur weltbekannte (dewiki + P18).
// Attribute: year, country, location, architect, material, heightM, era
// =========================================================================

async function queryArchitecture() {
  console.log('\n=== Query 3: Bauwerke ===');

  // Enger Filter: nur direkte P31-Instanzen bekannter Bauwerkstypen (kein P279*).
  // Zwei Queries: erst Kathedralen/Schlösser, dann Türme/Brücken.
  // Ohne heightM-Statement-Lookup (zu teuer) — nur einfache P2048-Wert-Abfrage.
  // Strategie: Zwei getrennte, sehr enge Queries — erst Länder+Jahre, dann Architekten.
  // Keine optionalen Joins zu weiteren Items (kein P131, kein P84) — diese verursachen Timeouts.
  // Strategie: nur weltbekannte Kathedralen und Schlösser, die P18 UND P571 haben.
  // P18 (Bild) als Pflichtfilter — schließt obskure Bauwerke zuverlässig aus.
  // Nur zwei Typen (Kathedrale + Schloss) für schnelle Ausführung.
  const query = `
SELECT DISTINCT ?item ?qid ?label ?year ?countryLabel WHERE {
  VALUES ?type { wd:Q2977 wd:Q23413 }
  ?item wdt:P31 ?type .
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wdt:P18 ?img .
  ?item wdt:P571 ?builtDate .
  BIND(YEAR(?builtDate) AS ?year)
  FILTER(?year > 0)
  ?item wdt:P17 ?countryItem .
  ?countryItem rdfs:label ?countryLabel FILTER(LANG(?countryLabel) = "de")
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?label
LIMIT 60
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name: val(b, 'label'),
        year: cleanYear(val(b, 'year')),
        country: val(b, 'countryLabel'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.year) e.year = cleanYear(val(b, 'year'));
      if (!e.country && val(b, 'countryLabel')) e.country = val(b, 'countryLabel');
    }
  }

  for (const [qid, info] of seen) {
    const { name, year, country } = info;
    if (!name) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    // Mindest-Attribut: Land muss vorhanden sein (wichtigstes Attribut für Fragen)
    if (!country) { skipped++; continue; }

    const attributes = {};
    if (year) attributes.year = year;
    if (country) attributes.country = country;

    const verifyParts = [`P31=Bauwerk`];
    if (year) verifyParts.push(`P571→year:${year}`);
    if (country) verifyParts.push(`P17→country:${country}`);

    const ok = addConcept({
      id: slug,
      name,
      category: 'architecture',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: verifyParts.join(', '),
      imageSearchTerm: `${name} building architecture`,
    });

    if (ok) {
      added++;
      console.log(`  + [architecture] ${name}${year ? ` (${year})` : ''}${country ? ` [${country}]` : ''} [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// =========================================================================
// QUERY 4 — Skulpturen (sculpture)
// Kriterien: P31 = Skulptur (Q860861), dewiki, P170 (Urheber), P186 (Material).
// Attribute: creator, year, material, location, country, heightM
// =========================================================================

async function querySculptures() {
  console.log('\n=== Query 4: Skulpturen ===');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?creatorLabel ?year ?materialLabel ?locationLabel ?heightM WHERE {
  # Skulptur
  ?item wdt:P31 wd:Q860861 .
  # Deutsches Wikipedia
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Bild vorhanden
  ?item wdt:P18 ?img .
  # Urheber (optional — manche antiken Skulpturen sind anonym)
  OPTIONAL {
    ?item wdt:P170 ?creator .
    ?creator rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel) = "de")
  }
  # Entstehungsjahr
  OPTIONAL {
    ?item wdt:P571 ?created .
    BIND(YEAR(?created) AS ?year)
  }
  # Material
  OPTIONAL {
    ?item wdt:P186 ?materialItem .
    ?materialItem rdfs:label ?materialLabel FILTER(LANG(?materialLabel) = "de")
  }
  # Aufbewahrungsort
  OPTIONAL {
    ?item wdt:P276 ?locationItem .
    ?locationItem rdfs:label ?locationLabel FILTER(LANG(?locationLabel) = "de")
  }
  # Höhe
  OPTIONAL {
    ?item p:P2048 ?hStmt .
    ?hStmt psv:P2048 ?hVal .
    ?hVal wikibase:quantityAmount ?heightM .
    ?hVal wikibase:quantityUnit ?hUnit .
    FILTER(?hUnit = wd:Q11573)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?label
LIMIT 80
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name: val(b, 'label'),
        creator: val(b, 'creatorLabel'),
        year: cleanYear(val(b, 'year')),
        material: val(b, 'materialLabel'),
        location: val(b, 'locationLabel'),
        heightM: val(b, 'heightM') ? parseFloat(val(b, 'heightM')) : undefined,
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.creator && val(b, 'creatorLabel')) e.creator = val(b, 'creatorLabel');
      if (!e.year) e.year = cleanYear(val(b, 'year'));
      if (!e.material && val(b, 'materialLabel')) e.material = val(b, 'materialLabel');
      if (!e.location && val(b, 'locationLabel')) e.location = val(b, 'locationLabel');
      if (!e.heightM && val(b, 'heightM')) e.heightM = parseFloat(val(b, 'heightM'));
    }
  }

  for (const [qid, info] of seen) {
    const { name, creator, year, material, location, heightM } = info;
    if (!name) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    // Mindest-Attribut: Creator oder Material muss vorhanden sein
    if (!creator && !material) { skipped++; continue; }

    const attributes = {};
    if (creator) attributes.creator = creator;
    if (year) attributes.year = year;
    if (material) attributes.material = material;
    if (location) attributes.location = location;
    if (heightM && isFinite(heightM) && heightM > 0) {
      attributes.heightM = Math.round(heightM * 10) / 10;
    }

    const verifyParts = [`P31=Q860861`];
    if (creator) verifyParts.push(`P170→creator:${creator}`);
    if (year) verifyParts.push(`P571→year:${year}`);
    if (material) verifyParts.push(`P186→material:${material}`);

    const ok = addConcept({
      id: slug,
      name,
      category: 'sculpture',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: verifyParts.join(', '),
      imageSearchTerm: `${name} sculpture`,
    });

    if (ok) {
      added++;
      console.log(`  + [sculpture] ${name}${creator ? ` (${creator})` : ''}${year ? `, ${year}` : ''} [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// =========================================================================
// QUERY 5 — Literatur (literature)
// Kriterien: bekannte Romane/Dramen/Epen mit dewiki, P50 (Autor), P577 (Erscheinjahr).
// Attribute: author, year, genre, language, era
// =========================================================================

async function queryLiterature() {
  console.log('\n=== Query 5: Literatur ===');

  // Direkte P31-Instanzen bekannter Literaturtypen (kein P279* = kein Timeout).
  // P18 als Pflichtfilter für Bekanntheit. Sprache und Genre als Pflichtattribute
  // (keine Optionals im Join — zu teuer).
  const query = `
SELECT DISTINCT ?item ?qid ?label ?authorLabel ?year ?langLabel WHERE {
  VALUES ?type { wd:Q7725310 wd:Q8261 }
  ?item wdt:P31 ?type .
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wdt:P18 ?img .
  ?item wdt:P50 ?author .
  ?author rdfs:label ?authorLabel FILTER(LANG(?authorLabel) = "de")
  ?item wdt:P577 ?pubDate .
  BIND(YEAR(?pubDate) AS ?year)
  FILTER(?year > 0 && ?year < 2024)
  ?item wdt:P407 ?langItem .
  ?langItem rdfs:label ?langLabel FILTER(LANG(?langLabel) = "de")
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?label
LIMIT 60
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name: val(b, 'label'),
        author: val(b, 'authorLabel'),
        year: cleanYear(val(b, 'year')),
        language: val(b, 'langLabel'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.language && val(b, 'langLabel')) e.language = val(b, 'langLabel');
    }
  }

  for (const [qid, info] of seen) {
    const { name, author, year, language } = info;
    if (!name || !author || !year) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    const attributes = { author, year };
    if (language) attributes.language = language;

    const verifyParts = [`P50→author:${author}`, `P577→year:${year}`];
    if (language) verifyParts.push(`P407→language:${language}`);

    const ok = addConcept({
      id: slug,
      name,
      category: 'literature',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: verifyParts.join(', '),
      imageSearchTerm: `${name} book cover`,
    });

    if (ok) {
      added++;
      console.log(`  + [literature] ${name} (${author}, ${year}) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// =========================================================================
// Hauptprogramm
// =========================================================================

async function main() {
  console.log('=== Cultura Wikidata Harvest ===');
  console.log(`Bestand: ${rawData.length} Konzepte (Dedup-Basis)`);

  try {
    await queryComposers();
    await sleep(MIN_DELAY_MS);

    await queryComposersKnown();
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
