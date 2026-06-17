/**
 * wikidata_cultura_w4.cjs — Cultura Wikidata Welle 4
 *
 * Erntet neue Cultura-Konzepte aus Wikidata SPARQL.
 * Schwerpunkt: composition (Musikwerke) + literature (literarische Werke).
 * Beide Kategorien haben noch Wachstumspotenzial gegenüber dem aktuellen Bestand
 * (composition: 177, literature: 48) und liefern bei SL ≥ 20 saubere, bekannte Werke.
 *
 * QUALITÄTSREGELN (gelernte Lektionen aus früheren Wellen):
 *  - Notabilität per wikibase:sitelinks (keine alphabetische Ernte)
 *  - Deutsches Wikipedia-Sitelink als Pflicht-Proxy für Bekanntheit im DE-Raum
 *  - Strenge P31-Typen-Whitelist gegen Fehlklassifikation
 *  - Dedup gegen cultura_raw.json: id UND normalisierter Name
 *  - 429-Backoff (8 s × Versuch), MIN_DELAY_MS = 2000 (parallele WDQS-Agents)
 *  - Ausgabe nach /tmp/cultura_w4.json
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_cultura_w4.cjs
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// --- Konfiguration ----------------------------------------------------------

const UA              = 'ScientiaQuizWDQS/1.0 (educational quiz; nfetzen@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS    = 2000;  // Mindestpause — parallele WDQS-Agents laufen
const MAX_RETRIES     = 3;

// Kandidaten-Ausgabe nach /tmp (NICHT in _raw.json schreiben — das macht der Gate-Pass)
const OUT_PATH = '/tmp/cultura_w4.json';
const RAW_PATH = path.join(__dirname, '..', 'cultura_raw.json');

// --- Hilfsfunktionen --------------------------------------------------------

/** Normalisiert einen Namen für Dedup-Vergleich (id UND normalisierter Name). */
function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, '')      // Klammerzusätze entfernen
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Kebab-Slug aus deutschem Namen. */
function toSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** HTTPS GET → Promise<string> mit Retry bei 429/502/503. */
function httpsGet(url, headers, retries = 0, timeoutMs = 55000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const { statusCode } = res;
      if ((statusCode === 429 || statusCode === 502 || statusCode === 503) && retries < MAX_RETRIES) {
        const wait = 12000 * (retries + 1);  // 12s, 24s, 36s
        console.warn(`  HTTP ${statusCode} — warte ${wait} ms (Versuch ${retries + 2}/${MAX_RETRIES + 1})...`);
        res.resume();
        setTimeout(() => httpsGet(url, headers, retries + 1, timeoutMs).then(resolve).catch(reject), wait);
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
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout (${timeoutMs}ms)`)); });
  });
}

/** SPARQL-Query gegen WDQS → Array von Binding-Objekten. */
async function sparql(query, timeoutMs = 55000) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const raw = await httpsGet(url, {
    'User-Agent': UA,
    'Accept': 'application/sparql-results+json',
  }, 0, timeoutMs);
  const json = JSON.parse(raw);
  return json.results.bindings;
}

/** Wert aus einem SPARQL-Binding. */
function val(binding, key) { return binding[key]?.value; }

/** Mindestpause. */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Jahr-Putz: ISO-Datum-String oder vierstellige Zahl → positive Ganzzahl.
 * Negative Jahre (v. Chr.) → null.
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

// --- Dedup gegen bestehende cultura_raw.json --------------------------------

const rawData           = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds       = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

function isDuplicate(name, slug) {
  if (existingIds.has(slug))                      return true;
  if (existingNamesNorm.has(normalizeName(name))) return true;
  return false;
}

// Auch gegen neu gesammelte Konzepte in dieser Session deduppen
const newConcepts = [];
const newSlugs    = new Set();
const newNorms    = new Set();

function addConcept(concept) {
  if (isDuplicate(concept.name, concept.id))  return false;
  if (newSlugs.has(concept.id))               return false;
  if (newNorms.has(normalizeName(concept.name))) return false;
  newConcepts.push(concept);
  newSlugs.add(concept.id);
  newNorms.add(normalizeName(concept.name));
  // Auch in die globalen Sets eintragen, damit spätere Queries deduppieren
  existingIds.add(concept.id);
  existingNamesNorm.add(normalizeName(concept.name));
  return true;
}

// ============================================================================
// QUERY 1 — Musikwerke / Kompositionen (composition)
//
// QUALITÄTSREGELN:
//  - P31-Typ NUR in strenger Whitelist (Sinfonie, Oper, Sonate, Konzert, Messe,
//    Kantate, Oratorium, Streichquartett, Klavier-/Violinkonzert, Symphonisches Gedicht …)
//    → KEINE Lieder-Sammlungen, Soundtracks, Pop-Alben
//  - Wikidata P86 (Komponist) Pflicht
//  - Erscheinungsjahr P571/P577 Pflicht
//  - Sitelink-COUNT ≥ 20 (nur weltbekannte Werke)
//  - Deutsches Wikipedia Pflicht (sichert DE-Relevanz)
//
// Bekannte Komposition-Werke, die noch fehlen, stammen aus:
//  - Debussy, Ravel, Bartók, Schostakowitsch, Prokofjew (Werke), Hindemith,
//    Schönberg, Berg, Weill, Elgar, Vaughan Williams, Saint-Saëns (weitere),
//    Händel (weitere), Gluck, Weber, Scarlatti, Corelli, Telemann
//
// Strategie: Zwei Batches
//  Batch A: bekannte Typen ohne Opern (sitelinks ≥ 20)
//  Batch B: Opern und Bühnenwerke (sitelinks ≥ 20)
// ============================================================================

// Kompositionstypen-Strategie:
// Wikidata nutzt P31=Q105543609 (musikalisches Werk) für fast alle Kompositionen.
// Genre-Whitelist über P136 schlägt fehl, weil QIDs mehrdeutig sind (Q211756=Dance-Pop!).
//
// Korrekte Methode:
//  1. P86 = Komponist (klassische Komponisten) Pflicht
//  2. Jahr < 1960 — filtert Pop/Rock/Electronic zuverlässig aus
//  3. Komponist muss P106=Q36834 (Komponist) haben — schließt Popmusiker aus
//  4. Genre aus Wikidata als optionales Attribut (nicht als Filter)
//  5. MINUS: bestimmte Nationalhymnen-Typen und Filmmusik ausschließen

async function queryCompositions() {
  console.log('\n=== Query 1a: Kompositionen — Klassische Werke (SL ≥ 20, Komponist P106=Q36834) ===');

  // Strategie: P86-Komponist muss P106=Q36834 (klassischer Komponist) haben.
  // Entstehungsjahr < 1960 filtert modernen Pop zusätzlich aus.
  // Kein Nationalhymnen-Typ (Q23691).
  // Zwei Batches, je LIMIT 80, damit kein Timeout.
  const queryA = `
SELECT DISTINCT ?item ?qid ?label ?composerLabel ?year ?genreLabel ?sitelinks
WHERE {
  VALUES ?type { wd:Q105543609 wd:Q58483083 }
  ?item wdt:P31 ?type .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 20)
  # Komponist mit P106=Q36834 (klassischer Komponist) Pflicht
  ?item wdt:P86 ?composer .
  ?composer wdt:P106 wd:Q36834 .
  ?composer rdfs:label ?composerLabel FILTER(LANG(?composerLabel) = "de")
  # Entstehungsjahr Pflicht; < 1960 schließt Pop/Rock aus
  OPTIONAL { ?item wdt:P571 ?created . }
  OPTIONAL { ?item wdt:P577 ?published . }
  BIND(COALESCE(?created, ?published) AS ?dateRaw)
  BIND(YEAR(?dateRaw) AS ?year)
  FILTER(BOUND(?year) && ?year >= 1600 && ?year < 1960)
  # Kein Nationalhymnen-Typ
  MINUS { ?item wdt:P31 wd:Q23691 . }
  # Deutsches Wikipedia Pflicht
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Genre (optional — häufig leer bei klassischen Werken)
  OPTIONAL {
    ?item wdt:P136 ?genreItem .
    ?genreItem rdfs:label ?genreLabel FILTER(LANG(?genreLabel) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 100
`;

  const bindingsA = await sparql(queryA);
  console.log(`  Batch A Rohergebnis: ${bindingsA.length} Treffer`);
  await sleep(MIN_DELAY_MS);

  console.log('\n=== Query 1b: Kompositionen — Frühe Moderne (1900-1960, SL ≥ 15) ===');

  // Batch B: Werke des frühen 20. Jh. mit etwas niedrigerer SL-Schwelle,
  // da diese Periode im Bestand noch dünner ist.
  const queryB = `
SELECT DISTINCT ?item ?qid ?label ?composerLabel ?year ?genreLabel ?sitelinks
WHERE {
  VALUES ?type { wd:Q105543609 wd:Q58483083 }
  ?item wdt:P31 ?type .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 15)
  ?item wdt:P86 ?composer .
  ?composer wdt:P106 wd:Q36834 .
  ?composer rdfs:label ?composerLabel FILTER(LANG(?composerLabel) = "de")
  OPTIONAL { ?item wdt:P571 ?created . }
  OPTIONAL { ?item wdt:P577 ?published . }
  BIND(COALESCE(?created, ?published) AS ?dateRaw)
  BIND(YEAR(?dateRaw) AS ?year)
  FILTER(BOUND(?year) && ?year >= 1900 && ?year < 1960)
  MINUS { ?item wdt:P31 wd:Q23691 . }
  ?article schema:about ?item ;
           schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  OPTIONAL {
    ?item wdt:P136 ?genreItem .
    ?genreItem rdfs:label ?genreLabel FILTER(LANG(?genreLabel) = "de")
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 80
`;

  const bindingsB = await sparql(queryB);
  console.log(`  Batch B Rohergebnis: ${bindingsB.length} Treffer`);

  const allBindings = [...bindingsA, ...bindingsB];
  console.log(`  Rohergebnis gesamt: ${allBindings.length} Treffer`);

  // --- Werke zusammenführen (ein Eintrag pro QID, bestes Genre merken) -----
  const seen = new Map();
  for (const b of allBindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:      val(b, 'label'),
        composer:  val(b, 'composerLabel'),
        year:      cleanYear(val(b, 'year')),
        genre:     val(b, 'genreLabel'),
        sitelinks: Number(val(b, 'sitelinks') ?? 0),
        qid,
      });
    } else {
      const e = seen.get(qid);
      // Kürzeres/spezifischeres Genre bevorzugen
      if (!e.genre && val(b, 'genreLabel')) e.genre = val(b, 'genreLabel');
      // Sitelinks aktualisieren (sollte identisch sein)
      const sl = Number(val(b, 'sitelinks') ?? 0);
      if (sl > e.sitelinks) e.sitelinks = sl;
    }
  }

  // --- Blacklist bekannter Nicht-Musikwerke oder bereits vorhander Konzepte -
  // Diese QIDs sind in Wikidata als Komposition klassifiziert, gehören aber nicht
  // in ein Musik-Quiz oder sind problematisch:
  const BLACKLIST = new Set([
    'Q189729', // Shostakovich: nicht im System, aber Dopplung-Check via Name ausreichend
  ]);

  // --- Genre-Normalisierung: Wikidata-Genre → lesbare deutsche Gattungsbezeichnung --
  // Viele klassische Werke haben kein P136-Genre in Wikidata. Dann Gattung aus dem
  // Werktitel ableiten — z.B. „5. Sinfonie" → „Sinfonie".
  function inferGenre(genre, name) {
    if (genre && genre.length <= 40) return genre;
    // Gattung aus Titel ableiten
    const lcName = name.toLowerCase();
    if (/sinfonie|symphonie|symphony/.test(lcName)) return 'Sinfonie';
    if (/konzert/.test(lcName)) return 'Konzert';
    if (/sonate/.test(lcName)) return 'Sonate';
    if (/oper|opera/.test(lcName)) return 'Oper';
    if (/ouvertür|ouverture/.test(lcName)) return 'Ouvertüre';
    if (/kantate/.test(lcName)) return 'Kantate';
    if (/oratorium/.test(lcName)) return 'Oratorium';
    if (/messe\b|mass\b/.test(lcName)) return 'Messe';
    if (/streichquartett/.test(lcName)) return 'Streichquartett';
    if (/ballett/.test(lcName)) return 'Ballett';
    if (/suite\b/.test(lcName)) return 'Suite';
    if (/requiem/.test(lcName)) return 'Requiem';
    if (/nocturne|nocturno/.test(lcName)) return 'Nocturne';
    if (/etüde|etude/.test(lcName)) return 'Etüde';
    if (/präludium|prelude/.test(lcName)) return 'Präludium';
    if (/fantasie|fantasia/.test(lcName)) return 'Fantasie';
    if (/rhapsodie|rhapsody/.test(lcName)) return 'Rhapsodie';
    if (/variationen|variations/.test(lcName)) return 'Variationen';
    if (/scherzo/.test(lcName)) return 'Scherzo';
    if (/sinfonische|symphon/.test(lcName)) return 'Symphonisches Werk';
    // Kein Genre ableitbar — akzeptieren als „Musikwerk"
    return 'Musikwerk';
  }

  // Nicht-klassische Genres, die rausgefiltert werden sollen.
  // Streng: auch Volksmusik, Chanson, Schlager, Kinderlied, Weihnachtsmusik.
  // (Populäre Musik und „Musikwerk" ohne klassischen Kontext werden via
  // Namens-Blacklist zusätzlich gefiltert — Genre allein reicht nicht.)
  const NON_CLASSICAL_GENRES = new Set([
    'Popsong', 'Popmusik', 'Dance-Pop', 'Rock', 'Rock \'n\' Roll', 'Rockabilly',
    'Jazz', 'Blues', 'R&B', 'Country', 'Reggae', 'Hip-Hop',
    'Elektronische Musik', 'Disco', 'Filmmusik',
    'Schlager', 'Folk', 'Volksmusik', 'Lied', 'Song', 'Anthem',
    'Nationalhymne', 'Volkslied', 'Revolutionslied', 'Patriotisches Lied',
    'Weihnachtslied', 'Weihnachtsmusik', 'Marsch',
    'Kinderlied', 'Chanson', 'Neapolitanische Volksmusik',
    'Jüdische Musik', 'Russische Romanze',
    'populäre Musik',
  ]);

  // Bekannte Nicht-Klassik-Werke mit vagen Wikidata-Genres (Blacklist nach QID).
  // Werke, die trotz P106=Q36834-Komponist nicht ins Cultura-Klassik-Quiz passen.
  const COMPOSITION_BLACKLIST = new Set([
    'Q167545',  // Happy Birthday to You (Kinderlied)
    'Q406845',  // Jingle Bells (Weihnachtslied)
    'Q752873',  // Waltzing Matilda (australisches Volkslied)
    'Q1131761', // White Christmas (Weihnachtspop)
    'Q728692',  // You'll Never Walk Alone (Musical/Schlager)
    'Q11986',   // La vie en rose (Chanson)
    'Q386138',  // Refrain (Chanson/Eurovision)
    'Q1364648', // Oklahoma! (Musical — bereits durch Genre erfasst, doppelte Sicherheit)
    'Q1152776', // Smile (Charlie Chaplin — Chanson/populäre Musik)
    'Q1089150', // Let It Snow! (Weihnachtspop)
    'Q1353423', // Jailhouse Rock (Rock 'n' Roll)
    'Q949416',  // Unchained Melody (populär)
    'Q765709',  // Strange Fruit (Jazz/Blues-Lied)
    'Q1426427', // Love Me Tender (Rockabilly/Elvis)
    'Q62272',   // Moskauer Nächte (Sowjet-Chanson)
    'Q12135395',// Oh, roter Schneeball (ukrainisches Volkslied)
    'Q141005',  // La Espero (Esperanto-Hymne)
    'Q18288',   // Katjuscha (Russisches Volkslied)
    'Q131718',  // Hava Nagila (jüdisches Volkslied)
    'Q891180',  // Bésame mucho (lateinamerikanisches Lied)
    'Q391180',  // Bésame mucho (korrekte QID)
    'Q205891',  // 'O sole mio (neapolitanisches Volkslied)
    'Q844046',  // Summertime (Jazz/Gershwin Musical)
    'Q714119',  // Der heilige Krieg (sowjetisches Lied)
    'Q1890794', // The Entertainer (Ragtime)
    'Q596389',  // Poljuschko Pole (Sowjet-Folklore)
    'Q918029',  // El cóndor pasa (peruanische Volksmusik)
    'Q4233720', // La Marseillaise (Nationalhymne)
    'Q74930',   // Oh! Susanna (Minstrel-Song)
    'Q182268',  // Land of Hope and Glory (Marsch/patriotisch)
    'Q1049431', // When I Think of You
    'Q57',      // Never Gonna Give You Up (falls doch drin)
    'Q212776',  // Ouvertüre 1812 — Duplikat von "1812-Ouvertüre op. 49" im Bestand
    'Q747869',  // Gloomy Sunday — ungarisches Volkslied/Chanson, kein klassisches Werk
    'Q1822437', // Leyli va Madschnun — aserbaidschanische Volksoper (sehr nischenspezifisch)
  ]);

  let added = 0, skipped = 0, dupSkipped = 0;

  for (const [qid, info] of seen) {
    if (BLACKLIST.has(qid)) { skipped++; continue; }
    if (COMPOSITION_BLACKLIST.has(qid)) {
      console.log(`  - SKIP (QID-Blacklist Volksmusik/Pop): ${info.name} [${qid}]`);
      skipped++;
      continue;
    }

    const { name, composer, year, genre, sitelinks } = info;
    if (!name || !composer || !year) { skipped++; continue; }

    // Nicht-klassische Genres ausschließen
    if (genre && NON_CLASSICAL_GENRES.has(genre)) {
      console.log(`  - SKIP (Pop/Folk-Genre: ${genre}): ${name}`);
      skipped++;
      continue;
    }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { dupSkipped++; continue; }

    // Genre ableiten — nie null (erforderlich für composition-Templates)
    const finalGenre = inferGenre(genre, name);

    const attributes = {
      composer,
      year,
      genre: finalGenre,
    };

    const ok = addConcept({
      id:       slug,
      name,
      category: 'composition',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `Musikwerk, sitelinks=${sitelinks}, P86→${composer}, P571/577→${year}${genre ? `, P136(raw)→${genre}` : ''}, genre→${finalGenre}`,
      imageSearchTerm: `${name} ${composer} Musik`,
    });

    if (ok) {
      added++;
      console.log(`  + [composition] ${name} (${composer}, ${year}, ${sitelinks} SL) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${dupSkipped} Duplikate, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 2 — Literarische Werke (literature)
//
// QUALITÄTSREGELN:
//  - P31-Typ NUR in Whitelist: Roman (Q8261), lit. Werk (Q7725634),
//    Drama (Q25379), Theaterstück (Q186451), Tragödie (Q1344), Komödie (Q40831),
//    Novelle (Q149537), Epos (Q8253) — KEINE Nachschlagewerke/Sachbücher
//  - Autor P50 Pflicht
//  - Erscheinungsjahr P577 Pflicht + < 1970 (Qualitätsschwelle)
//  - Sitelinks ≥ 25
//  - Deutsches Wikipedia Pflicht
//  - Titelfilter gegen Nachschlagewerke (Wörterbuch, Lexikon, Encyclopedia …)
//
// Strategie: Zwei Batches
//  Batch A: Romane und allgemeine literarische Werke
//  Batch B: Dramen, Tragödien, Komödien, Epen, Novellen
// ============================================================================

async function queryLiterature() {
  console.log('\n=== Query 2a: Literatur — Romane/lit. Werke (SL ≥ 25) ===');

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
  FILTER(?year > 0 && ?year < 1970)
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
LIMIT 80
`;

  const bindingsA = await sparql(queryA);
  console.log(`  Batch A Rohergebnis: ${bindingsA.length} Treffer`);
  await sleep(MIN_DELAY_MS);

  console.log('\n=== Query 2b: Literatur — Dramen/Epen/Novellen (SL ≥ 25) ===');

  // Batch B: Dramen, Tragödien, Komödien, Novellen, Epen
  // Q116476516 = dramatisches Werk (Wikidata-Typ für Shakespeare-Stücke etc.)
  // Q25379 = Drama (abstrakte Klasse — oft nicht direkt als P31 verwendet)
  // Q149537 = Novelle, Q8253 = Epos, Q1344 = Tragödie (Gattung)
  // Q116780 = Theaterstück, Q7725635 = dramatisches Werk (Alternativ-QID)
  const queryB = `
SELECT DISTINCT ?item ?qid ?label ?authorLabel ?year ?langLabel ?genreLabel ?sitelinks
WHERE {
  VALUES ?type { wd:Q116476516 wd:Q25379 wd:Q149537 wd:Q186451 wd:Q8253 wd:Q1344 wd:Q40831 }
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
  FILTER(?year > 0 && ?year < 1970)
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
LIMIT 80
`;

  const bindingsB = await sparql(queryB);
  console.log(`  Batch B Rohergebnis: ${bindingsB.length} Treffer`);

  const allBindings = [...bindingsA, ...bindingsB];
  console.log(`  Rohergebnis gesamt: ${allBindings.length} Treffer`);

  // --- Werke zusammenführen -----------------------------------------------
  const seen = new Map();
  for (const b of allBindings) {
    const qid = val(b, 'qid');
    if (!qid) continue;
    if (!seen.has(qid)) {
      seen.set(qid, {
        name:      val(b, 'label'),
        author:    val(b, 'authorLabel'),
        year:      cleanYear(val(b, 'year')),
        language:  val(b, 'langLabel'),
        genre:     val(b, 'genreLabel'),
        sitelinks: Number(val(b, 'sitelinks') ?? 0),
        qid,
      });
    } else {
      const e = seen.get(qid);
      if (!e.language && val(b, 'langLabel'))  e.language = val(b, 'langLabel');
      if (!e.genre    && val(b, 'genreLabel')) e.genre    = val(b, 'genreLabel');
      const sl = Number(val(b, 'sitelinks') ?? 0);
      if (sl > e.sitelinks) e.sitelinks = sl;
    }
  }

  // --- Bekannte Nicht-Belletristik / Nicht-Literatur-Werke (Blacklist) ------
  const BLACKLISTED_ITEMS = new Set([
    'Q11584',  // The World Factbook (Nachschlagewerk)
    'Q165980', // Dictionary of National Biography
    'Q152095', // Boxeraufstand (historisches Ereignis)
    'Q47209',  // Communist Manifesto (politisches Pamphlet)
    'Q7251',   // Wikipedia
    'Q48244',  // Mein Kampf (inhaltlich ungeeignet für Quizkontext)
    'Q123397', // Politeia / Der Staat (Platon — Philosophietraktat, keine Belletristik)
    'Q131719', // Der Fürst (Machiavelli — politische Abhandlung, keine Belletristik)
    'Q9268',   // Koran
    'Q8054',   // Bibel
    'Q25287',  // Philosophie-Werke (allg.)
  ]);

  let added = 0, skipped = 0, dupSkipped = 0;

  for (const [qid, info] of seen) {
    if (BLACKLISTED_ITEMS.has(qid)) {
      console.log(`  - BLACKLIST: ${info.name} [${qid}]`);
      skipped++;
      continue;
    }

    const { name, author, year, language, genre, sitelinks } = info;
    if (!name || !author || !year) { skipped++; continue; }

    // Titelfilter gegen Nachschlagewerke und politische/philosophische Abhandlungen
    const lcName = name.toLowerCase();
    if (/\bwörterbuch\b|\blexikon\b|\benzyklopädie\b|\benzyklopä/.test(lcName) ||
        /\bdictionary\b|\bencyclopedia\b|\batlas\b|\bfactbook\b/.test(lcName) ||
        /\bmanifest\b|\bkapital\b|\btraktat\b/.test(lcName)) {
      console.log(`  - SKIP (Nicht-Belletristik-Verdacht Titel): ${name}`);
      skipped++;
      continue;
    }
    // Genre-Filter: Nur Belletristik, keine Philosophie/Politik/Sachbuch
    // Wikidata-P136 liefert oft korrekte Genres — bei eindeutig falschen ablehnen
    if (genre && /philosophie|sachbuch|autobio|autobiografie|biografie|pamphlet/i.test(genre)) {
      console.log(`  - SKIP (Nicht-Belletristik-Genre: ${genre}): ${name}`);
      skipped++;
      continue;
    }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { dupSkipped++; continue; }

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
      imageSearchTerm: `${name} ${author} Buch`,
    });

    if (ok) {
      added++;
      console.log(`  + [literature] ${name} (${author}, ${year}, ${sitelinks} SL) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${dupSkipped} Duplikate, ${skipped} verworfen`);
}

// ============================================================================
// QUERY 3 — Gemälde (artwork) — Ergänzung bekannter Fehlender
//
// QUALITÄTSREGELN:
//  - P31=Q3305213 (Gemälde) Pflicht
//  - Sitelinks ≥ 20
//  - Entstehungsjahr P571 < 1923 (Public Domain)
//  - Urheber P170 Pflicht
//  - Bekannte Blacklist (Guernica etc.)
//
// Strategie: Höhere SL-Schwelle (≥ 25) für frische, weniger bekannte Treffer,
// da die 76 vorhandenen artwork-Einträge die Top-SL-Werke abdecken.
// ============================================================================

async function queryArtworks() {
  console.log('\n=== Query 3: Gemälde (SL ≥ 25, PD < 1923) ===');

  // Bekannte Probleme als QID-Blacklist:
  // Q185372 = Mädchen mit Perlenohrgehänge — Duplikat von bestehendem "Perlenohrring"-Eintrag
  // Q910199 = Les Demoiselles d'Avignon (Picasso 1907 — geschützt bis 2044!)
  // Q42332  = Guernica (bereits in SPARQL gefiltert)
  const ARTWORK_BLACKLIST = new Set([
    'Q185372',  // Perlenohrgehänge = Duplikat von Perlenohrring (anderes DE-Label, selbes Bild)
    'Q910199',  // Les Demoiselles d'Avignon — Picasso geschützt bis 2044
    'Q12282',   // weitere Picasso-Werke falls vorhanden
  ]);

  // Artwork-Query: Sitelinks ≥ 25, P571 < 1923 (Public Domain).
  // Kein schema:isPartOf-Join hier (Timeout-Risiko bei großem Artwork-Bestand) —
  // stattdessen wikibase:sitelinks direkt + DE-Label-Filter.
  // Optional-Properties einzeln, kein JOIN-Explosion.
  const query = `
SELECT DISTINCT ?item ?qid ?label ?creatorLabel ?year ?locationLabel ?sitelinks
WHERE {
  ?item wdt:P31 wd:Q3305213 .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 25)
  # Guernica direkt ausschließen; weitere Picasso-Werke via QID-Blacklist
  FILTER(?item != wd:Q42332)
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  ?item wdt:P170 ?creator .
  ?creator rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel) = "de")
  ?item wdt:P571 ?created .
  BIND(YEAR(?created) AS ?year)
  FILTER(?year > 0 && ?year < 1920)
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?sitelinks)
LIMIT 60
`;

  // Artwork-Query mit 90s-Timeout (diese Query ist träger als die anderen)
  const bindings = await sparql(query, 90000);
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
        location:  undefined,  // nicht in dieser Query (entfernt wegen Timeout-Risiko)
        sitelinks: Number(val(b, 'sitelinks') ?? 0),
        qid,
      });
    }
  }

  let added = 0, skipped = 0, dupSkipped = 0;

  for (const [qid, info] of seen) {
    if (ARTWORK_BLACKLIST.has(qid)) {
      console.log(`  - SKIP (Artwork-Blacklist): ${info.name} [${qid}]`);
      skipped++;
      continue;
    }

    const { name, creator, year, location, sitelinks } = info;
    if (!name || !creator || !year) { skipped++; continue; }

    const slug = toSlug(name);
    if (isDuplicate(name, slug)) { dupSkipped++; continue; }

    const attributes = { creator, year: String(year) };
    if (location) attributes.location = location;

    const ok = addConcept({
      id:       slug,
      name,
      category: 'artwork',
      attributes,
      funFact:  '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: `P31=Q3305213, sitelinks=${sitelinks}, P170→${creator}, P571→${year}${location ? ', P276→location' : ''}`,
      imageSearchTerm: `${name} Gemälde ${creator}`,
    });

    if (ok) {
      added++;
      console.log(`  + [artwork] ${name} (${creator}, ${year}, ${sitelinks} SL) [${qid}]`);
    } else {
      skipped++;
    }
  }

  console.log(`  → ${added} hinzugefügt, ${dupSkipped} Duplikate, ${skipped} verworfen`);
}

// ============================================================================
// Hauptprogramm
// ============================================================================

async function main() {
  console.log('=== Cultura Wikidata Welle 4 ===');
  console.log(`Bestand: ${rawData.length} Konzepte (Dedup-Basis)\n`);

  // Statistik vor dem Lauf
  const beforeCounts = {};
  for (const c of rawData) beforeCounts[c.category] = (beforeCounts[c.category] || 0) + 1;
  console.log('Bestand nach Kategorie:', JSON.stringify(beforeCounts));

  // Jede Query einzeln mit Fehlerbehandlung — bei Timeout/502 werden bereits
  // gesammelte Konzepte trotzdem geschrieben (kein Datenverlust).
  try {
    await queryCompositions();
  } catch (err) {
    console.error('\nFEHLER (composition):', err.message, '— fahre fort...');
  }
  await sleep(MIN_DELAY_MS);

  try {
    await queryLiterature();
  } catch (err) {
    console.error('\nFEHLER (literature):', err.message, '— fahre fort...');
  }
  await sleep(MIN_DELAY_MS);

  try {
    await queryArtworks();
  } catch (err) {
    console.error('\nFEHLER (artwork):', err.message, '— fahre fort (ggf. Artwork-Lücke)...');
  }

  // --- Ergebnis schreiben --------------------------------------------------
  fs.writeFileSync(OUT_PATH, JSON.stringify(newConcepts, null, 2), 'utf8');

  console.log('\n=== Zusammenfassung ===');
  const cats = {};
  for (const c of newConcepts) cats[c.category] = (cats[c.category] || 0) + 1;
  for (const [k, v] of Object.entries(cats)) console.log(`  ${k}: ${v}`);
  console.log(`  GESAMT: ${newConcepts.length} neue Konzepte`);
  console.log(`\nGeschrieben: ${OUT_PATH}`);

  // --- Plausibilitäts-Selbstkontrolle -------------------------------------
  console.log('\n=== Selbstkontrolle ===');
  const reread = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));

  // 1. Stichprobe: Haben alle Konzepte Pflichtfelder?
  let malformed = 0;
  for (const c of reread) {
    if (!c.id || !c.name || !c.category || !c.attributes) {
      console.warn(`  WARNUNG: Unvollständiges Konzept: ${JSON.stringify(c).slice(0, 100)}`);
      malformed++;
    }
    // composition: composer + year + genre Pflicht
    if (c.category === 'composition') {
      if (!c.attributes.composer || !c.attributes.year || !c.attributes.genre) {
        console.warn(`  WARNUNG composition: fehlende Pflichtattribute bei "${c.name}"`);
        malformed++;
      }
    }
    // literature: author + year + (language|genre) Pflicht
    if (c.category === 'literature') {
      if (!c.attributes.author || !c.attributes.year || (!c.attributes.language && !c.attributes.genre)) {
        console.warn(`  WARNUNG literature: fehlende Pflichtattribute bei "${c.name}"`);
        malformed++;
      }
    }
    // artwork: creator + year Pflicht
    if (c.category === 'artwork') {
      if (!c.attributes.creator || !c.attributes.year) {
        console.warn(`  WARNUNG artwork: fehlende Pflichtattribute bei "${c.name}"`);
        malformed++;
      }
    }
  }

  // 2. Echte Umlaute prüfen (keine ASCII-Ersetzung)
  const asciiUmlautPattern = /\b(?:ae|oe|ue|ss)\b/i;
  let umlautSuspect = 0;
  for (const c of reread) {
    const nameLower = c.name.toLowerCase();
    // Nur echte Umlaut-Verdächtige zählen (z.B. "Muelle" ok, "Strasse" nicht)
    if (/strasse|muesse|gruesse|grosser|kleines|weisser|heisser/.test(nameLower)) {
      console.warn(`  WARNUNG Umlaut: "${c.name}" — möglicherweise ASCII-Ersatz statt Umlaut`);
      umlautSuspect++;
    }
  }

  // 3. Innere Duplikate prüfen
  const ids = reread.map(c => c.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size < ids.length) {
    console.warn(`  WARNUNG: ${ids.length - uniqueIds.size} doppelte IDs im Ergebnis!`);
  }

  if (malformed === 0 && umlautSuspect === 0 && uniqueIds.size === ids.length) {
    console.log('  ✓ Alle Plausibilitätsprüfungen bestanden.');
  }
  console.log(`  Ausgabedatei: ${OUT_PATH} (${reread.length} Konzepte)`);
}

main();
