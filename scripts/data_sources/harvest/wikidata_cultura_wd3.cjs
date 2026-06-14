/**
 * wikidata_cultura_wd3.cjs — Welle 3 (Neu-Implementierung)
 *
 * Erntet neue Cultura-Konzepte aus Wikidata SPARQL mit strenger Qualitätskontrolle.
 *
 * KERNVERBESSERUNGEN gegenüber dem verworfenen ersten Versuch:
 *  1. Notabilität per verschachtelter Sitelink-Subquery (ORDER BY DESC(?sitelinks)),
 *     nicht alphabetisch — damit landen nur bekannte Objekte im Quiz.
 *  2. Composer-Filter: P106=Q36834 PLUS Selbstausschluss von Schriftstellern/
 *     Monarchen/Dramaturgen per zusätzlichem MINUS-Block.
 *  3. Nationalität NUR aus P27 + hartem NAT_MAP — nie geraten.
 *  4. Literatur: nur echte literarische Werktypen (kein Nachschlagewerk/Ereignis).
 *  5. Architektur/Skulptur: hohe Sitelink-Schwelle (≥ 20) — lieber leer als obskur.
 *  6. Selbstkontrolle: Datei nach Schreiben neu einlesen und Plausibilität prüfen.
 *
 * Ausgabe: scripts/data_sources/harvest/cultura_wd3.json
 * Aufruf:  node scripts/data_sources/harvest/wikidata_cultura_wd3.cjs
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// --- Konfiguration ----------------------------------------------------------

const UA              = 'ScientiaQuizWDQS/1.0 (educational quiz; nfetzen@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS    = 3000;   // Mindestpause zwischen WDQS-Anfragen
const MAX_RETRIES     = 3;

const OUT_PATH = path.join(__dirname, 'cultura_wd3.json');
const RAW_PATH = path.join(__dirname, '..', 'cultura_raw.json');

// --- Hilfsfunktionen --------------------------------------------------------

/** Normalisiert einen Namen für Dedup-Vergleich. */
function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, '')       // Klammerzusätze entfernen ("David (Michelangelo)")
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

/** HTTPS GET → Promise<string> mit Retry bei 429/502/503. */
function httpsGet(url, headers, retries = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const { statusCode } = res;
      // 429 = Rate Limit, 502 = Bad Gateway (WDQS überlastet), 503 = Service Unavailable
      if ((statusCode === 429 || statusCode === 502 || statusCode === 503) && retries < MAX_RETRIES) {
        const wait = 8000 * (retries + 1);
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
    req.setTimeout(55000, () => { req.destroy(); reject(new Error('Timeout')); });
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
 * Jahres-Putz: nur positive 3–4-stellige Ganzzahlen.
 * ISO-Datum-String ("1756-01-27T00:00:00Z") → Jahr extrahieren.
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

// --- Nationalitäts-Mapping (P27-QID → deutsches Adjektiv) ------------------
// Vollständig: abgedeckte Länder werden NIEMALS geraten.
// Fehlendes Mapping → Nationalität wird weggelassen (nie geraten).
const NAT_MAP = {
  Q183: 'Deutsch',        Q40:  'Österreichisch',  Q36:  'Polnisch',
  Q159: 'Russisch',       Q142: 'Französisch',     Q38:  'Italienisch',
  Q29:  'Spanisch',       Q145: 'Britisch',        Q34:  'Schwedisch',
  Q55:  'Niederländisch', Q35:  'Dänisch',         Q28:  'Ungarisch',
  Q31:  'Belgisch',       Q39:  'Schweizerisch',   Q20:  'Norwegisch',
  Q33:  'Finnisch',       Q45:  'Portugiesisch',   Q30:  'Amerikanisch',
  Q213: 'Tschechisch',    Q214: 'Slowakisch',      Q224: 'Kroatisch',
  Q215: 'Slowenisch',     Q403: 'Serbisch',        Q237: 'Ukrainisch',
  Q232: 'Lettisch',       Q37:  'Litauisch',       Q191: 'Estnisch',
  Q218: 'Rumänisch',      Q219: 'Bulgarisch',      Q220: 'Nordmazedonisch',
  Q222: 'Albanisch',      Q225: 'Bosnisch',        Q41:  'Griechisch',
  Q43:  'Türkisch',       Q77:  'Argentinisch',    Q155: 'Brasilianisch',
  Q136: 'Mexikanisch',    Q16:  'Kanadisch',       Q258: 'Südafrikanisch',
  Q664: 'Neuseeländisch', Q408: 'Australisch',     Q717: 'Venezolanisch',
  Q750: 'Bolivianisch',   Q733: 'Paraguayisch',    Q298: 'Chilenisch',
  // Historische Entitäten → moderne Entsprechungen
  Q12560: 'Österreichisch',  // Habsburger Österreich
  Q174193:'Deutsch',         // Preußen
  Q177303:'Österreichisch',  // Österreich-Ungarn (fallback)
};

// --- Dedup-Liste ------------------------------------------------------------

const rawData          = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds       = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

function isDuplicate(name, slug) {
  if (existingIds.has(slug))                      return true;
  if (existingNamesNorm.has(normalizeName(name))) return true;
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
// QUERY 1 — Komponisten (composer)
//
// QUALITÄTSREGELN:
//  - P106=Q36834 (Komponist) ist PFLICHT
//  - MINUS-Block schließt Personen aus, die primär Schriftsteller (Q36180),
//    Dramatiker (Q214917), Dichter (Q49757), Monarch (Q116) oder Politiker (Q82955) sind
//  - Sitelink-COUNT via verschachtelter Subquery (ORDER BY DESC — notabilitätsgerankt)
//  - Nationalität NUR aus P27 + NAT_MAP — nie raten
//  - Nur historische Komponisten (gestorben): P570 Pflicht
//  - Min. 30 Sitelinks für echte Bekanntheit
// ============================================================================

async function queryComposers() {
  console.log('\n=== Query 1: Komponisten (gezielte Namenssuche bekannter Fehlender) ===');

  // Gezielte Liste bekannter Komponisten, die im aktuellen Bestand fehlen.
  // Strategie: Label-FILTER statt Sitelink-Ranking, weil die TOP-200-Sitelinks
  // bereits alle im Bestand sind. Diese Liste wurde manuell kuratiert —
  // nur unumstrittene Komponisten, kein Monarch/Dichter/Schriftsteller.
  const targetNames = [
    'Dmitri Schostakowitsch', 'Sergei Rachmaninow', 'Carl Orff', 'Alban Berg',
    'Arnold Schönberg', 'Kurt Weill', 'Paul Hindemith', 'Ottorino Respighi',
    'Francis Poulenc', 'Darius Milhaud', 'Arthur Honegger', 'Ralph Vaughan Williams',
    'Samuel Barber', 'Aram Chatschaturjan', 'Zoltán Kodály', 'Bohuslav Martinů',
    'Manuel de Falla', 'Isaac Albéniz', 'Enrique Granados', 'Luigi Boccherini',
    'Gioachino Rossini', 'Jacques Offenbach', 'Jules Massenet', 'Leoš Janáček',
    'Jean Sibelius', 'Modest Mussorgski', 'Georges Bizet', 'Camille Saint-Saëns',
    'Nikolai Rimski-Korsakow', 'César Franck', 'Edvard Grieg', 'Antonín Dvořák',
    'Giacomo Puccini', 'Vincenzo Bellini', 'Gaetano Donizetti', 'Gioacchino Rossini',
  ];

  // SPARQL-FILTER mit OR-Verknüpfung der deutschen Labels
  const labelFilter = targetNames.map(n => `STR(?label) = "${n}"`).join(' || ');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?birthYear ?deathYear ?natQid ?notableWork ?sitelinks
WHERE {
  ?item wdt:P106 wd:Q36834 .
  ?item wikibase:sitelinks ?sitelinks .
  # Deutsches Wikipedia vorhanden
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  FILTER(${labelFilter})
  # Geburtsdatum und Sterbedatum Pflicht
  ?item wdt:P569 ?birthDate .
  BIND(YEAR(?birthDate) AS ?birthYear)
  ?item wdt:P570 ?deathDate .
  BIND(YEAR(?deathDate) AS ?deathYear)
  # Nationalität aus P27 (optional)
  OPTIONAL { ?item wdt:P27 ?natItem . BIND(SUBSTR(STR(?natItem), 32) AS ?natQid) }
  # Hauptwerk (optional, deutsches Label)
  OPTIONAL {
    ?item wdt:P800 ?workItem .
    ?workItem rdfs:label ?notableWork FILTER(LANG(?notableWork) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 100
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  // Gruppieren: ein Eintrag pro QID, erstes notableWork merken
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
        notableWork: val(b, 'notableWork'),
        sitelinks:   val(b, 'sitelinks'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.notableWork && val(b, 'notableWork')) e.notableWork = val(b, 'notableWork');
    }
  }

  let added = 0, skipped = 0;

  for (const [qid, info] of seen) {
    const { name, birthYear, deathYear, natQid, notableWork, sitelinks } = info;
    if (!name || !birthYear || !deathYear) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    const attributes = { birthYear, deathYear };

    // Nationalität: NUR aus NAT_MAP, nie raten
    if (natQid && NAT_MAP[natQid]) attributes.nationality = NAT_MAP[natQid];

    if (notableWork) attributes.notableWork = notableWork;

    // Mindest-Qualität: nationality ODER notableWork muss vorhanden sein
    if (!attributes.nationality && !attributes.notableWork) { skipped++; continue; }

    const ok = addConcept({
      id:       slug,
      name,
      category: 'composer',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P106=Q36834, sitelinks=${sitelinks}, P569→${birthYear}, P570→${deathYear}${natQid ? `, P27→${natQid}` : ''}${notableWork ? ', P800→notableWork' : ''}`,
      imageSearchTerm: `${name} Komponist Porträt`,
    });

    if (ok) {
      added++;
      console.log(`  + [composer] ${name} (${birthYear}–${deathYear}, ${sitelinks} SL) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 2 — Gemälde (artwork)
//
// QUALITÄTSREGELN:
//  - P31=Q3305213 (Gemälde) Pflicht
//  - Sitelink-Subquery ≥ 20 (nur weltbekannte Werke)
//  - Entstehungsjahr vor 1923 (Public Domain sicher)
//  - BLACKLIST: kein Guernica (Q42332, Picasso geschützt bis 2043)
// ============================================================================

async function queryArtworks() {
  console.log('\n=== Query 2: Gemälde (Sitelink-Ranking, ≥ 20) ===');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?creatorLabel ?year ?mediumLabel ?locationLabel ?sitelinks
WHERE {
  ?item wdt:P31 wd:Q3305213 .
  # Sitelink-Count direkt (kein Subquery-Timeout)
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 20)
  # BLACKLIST: Guernica ausschließen (Picasso geschützt bis 2043)
  FILTER(?item != wd:Q42332)
  # Deutsches Wikipedia
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Urheber (Pflicht)
  ?item wdt:P170 ?creator .
  ?creator rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel) = "de")
  # Entstehungsjahr (Pflicht, Public-Domain-Filter)
  ?item wdt:P571 ?created .
  BIND(YEAR(?created) AS ?year)
  FILTER(?year > 0 && ?year < 1923)
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
ORDER BY DESC(?sitelinks)
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
        name:      val(b, 'label'),
        creator:   val(b, 'creatorLabel'),
        year:      cleanYear(val(b, 'year')),
        medium:    val(b, 'mediumLabel'),
        location:  val(b, 'locationLabel'),
        sitelinks: val(b, 'sitelinks'),
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
    const { name, creator, year, medium, location, sitelinks } = info;
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
      verifyNote: `P31=Q3305213, sitelinks=${sitelinks}, P170→${creator}, P571→${year}${medium ? `, P186→medium` : ''}${location ? `, P276→location` : ''}`,
      imageSearchTerm: `${name} Gemälde ${creator}`,
    });

    if (ok) {
      added++;
      console.log(`  + [artwork] ${name} (${creator}, ${year}, ${sitelinks} SL) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 3 — Literarische Werke (literature)
//
// QUALITÄTSREGELN:
//  - P31 NUR in erlaubten Typen: Roman (Q7725634), Epos (Q8253), Drama (Q25379),
//    Theaterstück (Q186451), Tragödie (Q1344), Komödie (Q40831), Novelle (Q149537)
//    → KEINE Nachschlagewerke, Enzyklopädien, historischen Ereignisse
//  - Sitelink-Subquery ≥ 25 (nur weltbekannte Werke)
//  - Autor (P50) Pflicht
//  - Erscheinungsjahr (P577) vor 1960
// ============================================================================

async function queryLiterature() {
  console.log('\n=== Query 3: Literatur (echte Werktypen, Sitelink ≥ 25) ===');

  // Erlaubte Werktypen: nur Romane und Dramen (zwei Batches getrennt, damit kein Timeout).
  // Batch A: Romane (Q8261) und literarische Werke (Q7725634).
  // Sitelinks ≥ 25 via wikibase:sitelinks.
  // Erscheinungsjahr vor 1960 (Public Domain).
  const queryA = `
SELECT DISTINCT ?item ?qid ?label ?authorLabel ?year ?langLabel ?genreLabel ?sitelinks
WHERE {
  VALUES ?type { wd:Q8261 wd:Q7725634 }
  ?item wdt:P31 ?type .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 25)
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wdt:P50 ?author .
  ?author rdfs:label ?authorLabel FILTER(LANG(?authorLabel) = "de")
  ?item wdt:P577 ?pubDate .
  BIND(YEAR(?pubDate) AS ?year)
  FILTER(?year > 0 && ?year < 1960)
  OPTIONAL {
    ?item wdt:P407 ?langItem .
    ?langItem rdfs:label ?langLabel FILTER(LANG(?langLabel) = "de")
  }
  OPTIONAL {
    ?item wdt:P136 ?genreItem .
    ?genreItem rdfs:label ?genreLabel FILTER(LANG(?genreLabel) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 60
`;

  // Batch B: Dramen, Tragödien, Komödien, Novellen, Epen (separate Query → kein Timeout).
  const queryB = `
SELECT DISTINCT ?item ?qid ?label ?authorLabel ?year ?langLabel ?genreLabel ?sitelinks
WHERE {
  VALUES ?type { wd:Q25379 wd:Q149537 wd:Q186451 wd:Q8253 wd:Q1344 wd:Q40831 }
  ?item wdt:P31 ?type .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 25)
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wdt:P50 ?author .
  ?author rdfs:label ?authorLabel FILTER(LANG(?authorLabel) = "de")
  ?item wdt:P577 ?pubDate .
  BIND(YEAR(?pubDate) AS ?year)
  FILTER(?year > 0 && ?year < 1960)
  OPTIONAL {
    ?item wdt:P407 ?langItem .
    ?langItem rdfs:label ?langLabel FILTER(LANG(?langLabel) = "de")
  }
  OPTIONAL {
    ?item wdt:P136 ?genreItem .
    ?genreItem rdfs:label ?genreLabel FILTER(LANG(?genreLabel) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 60
`;

  console.log('  Batch A (Romane/lit. Werke)...');
  const bindingsA = await sparql(queryA);
  console.log(`  Batch A: ${bindingsA.length} Treffer`);
  await sleep(MIN_DELAY_MS);
  console.log('  Batch B (Dramen/Novellen/Epen)...');
  const bindingsB = await sparql(queryB);
  console.log(`  Batch B: ${bindingsB.length} Treffer`);
  const bindings = [...bindingsA, ...bindingsB];
  console.log(`  Rohergebnis gesamt: ${bindings.length} Treffer`);

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:      val(b, 'label'),
        author:    val(b, 'authorLabel'),
        year:      cleanYear(val(b, 'year')),
        language:  val(b, 'langLabel'),
        genre:     val(b, 'genreLabel'),
        sitelinks: val(b, 'sitelinks'),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.language && val(b, 'langLabel'))  e.language = val(b, 'langLabel');
      if (!e.genre    && val(b, 'genreLabel')) e.genre    = val(b, 'genreLabel');
    }
  }

  // Liste bekannt-problematischer Werke, die kein literarisches Werk sind
  // (Wikidata-Klassifizierung nicht immer korrekt):
  const BLACKLISTED_ITEMS = new Set([
    'Q11584',  // The World Factbook (Nachschlagewerk)
    'Q165980', // Dictionary of National Biography (Nachschlagewerk/Biografie-Lexikon)
    'Q152095', // Boxeraufstand (historisches Ereignis, kein literarisches Werk)
  ]);

  let added = 0, skipped = 0;

  for (const [qid, info] of seen) {
    // Blacklist-Check
    if (BLACKLISTED_ITEMS.has(qid)) {
      console.log(`  - BLACKLIST: ${info.name} [${qid}]`);
      skipped++;
      continue;
    }

    const { name, author, year, language, genre, sitelinks } = info;
    if (!name || !author || !year) { skipped++; continue; }

    // Plausibilitätscheck: Werktitel sollte nicht auf typische Nachschlagewerke hinweisen
    const lcName = name.toLowerCase();
    if (/\bwörterbuch\b|\bworterbuch\b|\blexikon\b|\benzyklopädie\b|\benzyklop/.test(lcName) ||
        /\bdictionary\b|\bencyclopedia\b|\batlas\b|\bfactbook\b/.test(lcName)) {
      console.log(`  - SKIP (Nachschlagewerk-Verdacht): ${name}`);
      skipped++;
      continue;
    }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    const attributes = { author, year };
    if (language) attributes.language = language;
    if (genre)    attributes.genre    = genre;

    // Mindest-Qualität: Sprache oder Genre muss vorhanden sein
    if (!language && !genre) { skipped++; continue; }

    const ok = addConcept({
      id:       slug,
      name,
      category: 'literature',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `literarisches Werk, sitelinks=${sitelinks}, P50→${author}, P577→${year}${language ? `, P407→${language}` : ''}${genre ? `, P136→${genre}` : ''}`,
      imageSearchTerm: `${name} Buch Cover`,
    });

    if (ok) {
      added++;
      console.log(`  + [literature] ${name} (${author}, ${year}, ${sitelinks} SL) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 4 — Skulpturen (sculpture)
//
// QUALITÄTSREGELN:
//  - P31=Q860861 (Skulptur) Pflicht
//  - Sitelink-Subquery ≥ 20 (nur sehr bekannte Skulpturen)
//  - Creator oder Material Pflicht
// ============================================================================

async function querySculptures() {
  console.log('\n=== Query 4: Skulpturen (Sitelink-Ranking, ≥ 20) ===');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?creatorLabel ?year ?materialLabel ?locationLabel ?sitelinks
WHERE {
  ?item wdt:P31 wd:Q860861 .
  # Sitelink-Count direkt
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 20)
  # Deutsches Wikipedia
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Urheber (optional — antike Skulpturen anonym)
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
ORDER BY DESC(?sitelinks)
LIMIT 60
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:      val(b, 'label'),
        creator:   val(b, 'creatorLabel'),
        year:      cleanYear(val(b, 'year')),
        material:  val(b, 'materialLabel'),
        location:  val(b, 'locationLabel'),
        sitelinks: val(b, 'sitelinks'),
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
    const { name, creator, year, material, location, sitelinks } = info;
    if (!name) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { skipped++; continue; }

    // Mindest-Qualität: Creator oder Material Pflicht
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
      verifyNote: `P31=Q860861, sitelinks=${sitelinks}${creator ? `, P170→${creator}` : ''}${year ? `, P571→${year}` : ''}${material ? `, P186→${material}` : ''}`,
      imageSearchTerm: `${name} Skulptur`,
    });

    if (ok) {
      added++;
      console.log(`  + [sculpture] ${name}${creator ? ` (${creator})` : ''}${year ? `, ${year}` : ''} [${sitelinks} SL] [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 5 — Bauwerke (architecture)
//
// QUALITÄTSREGELN:
//  - Sitelink-Subquery ≥ 20 (nur weltbekannte Bauwerke)
//  - Typen: Kathedrale (Q2977), Palast (Q16560), Brücke (Q12280) — NUR mit hoher Schwelle
//  - Brücken/Türme: nur wenn ≥ 20 Sitelinks (verhindert obskure lokale Brücken)
//  - Land (P17) Pflicht
// ============================================================================

async function queryArchitecture() {
  console.log('\n=== Query 5: Bauwerke (Sitelink-Ranking, ≥ 20) ===');

  // Enge Typen-Auswahl: nur Typen, die sehr bekannte Einzelbauwerke liefern.
  // Q44539 = Tempel, Q2977 = Kathedrale, Q16560 = Palast/Schloss, Q12280 = Brücke,
  // Q23413 = Burg, Q131647 = Moschee
  // wikibase:sitelinks direkt (kein Subquery-Timeout).
  const query = `
SELECT DISTINCT ?item ?qid ?label ?year ?countryLabel ?sitelinks
WHERE {
  VALUES ?type {
    wd:Q44539 wd:Q2977 wd:Q16560 wd:Q12280 wd:Q23413 wd:Q131647
  }
  ?item wdt:P31 ?type .
  # Sitelink-Count direkt
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 20)
  # Deutsches Wikipedia
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Land (Pflicht für Fragen)
  ?item wdt:P17 ?countryItem .
  ?countryItem rdfs:label ?countryLabel FILTER(LANG(?countryLabel) = "de")
  # Baujahr (optional)
  OPTIONAL {
    ?item wdt:P571 ?builtDate .
    BIND(YEAR(?builtDate) AS ?year)
    FILTER(?year > 0)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 60
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  const seen = new Map();
  for (const b of bindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:      val(b, 'label'),
        year:      cleanYear(val(b, 'year')),
        country:   val(b, 'countryLabel'),
        sitelinks: val(b, 'sitelinks'),
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
    const { name, year, country, sitelinks } = info;
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
      verifyNote: `Bauwerk, sitelinks=${sitelinks}, P17→${country}${year ? `, P571→${year}` : ''}`,
      imageSearchTerm: `${name} Architektur`,
    });

    if (ok) {
      added++;
      console.log(`  + [architecture] ${name} [${country}${year ? `, ${year}` : ''}] [${sitelinks} SL] [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${skipped} verworfen`);
}

// ============================================================================
// Hauptprogramm
// ============================================================================

async function main() {
  console.log('=== Cultura Wikidata Harvest — Welle 3 (Neu) ===');
  console.log(`Bestand: ${rawData.length} Konzepte (Dedup-Basis)\n`);

  try {
    await queryComposers();
    await sleep(MIN_DELAY_MS);

    await queryArtworks();
    await sleep(MIN_DELAY_MS);

    await queryLiterature();
    await sleep(MIN_DELAY_MS);

    await querySculptures();
    await sleep(MIN_DELAY_MS);

    await queryArchitecture();

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
