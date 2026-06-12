/**
 * wikidata_astra.cjs
 *
 * Erntet neue Astra-Konzepte (moon, star, asteroid, dwarf_planet) aus Wikidata SPARQL.
 *
 * Regeln:
 *  - Nur Objekte mit deutschem Wikipedia-Artikel (Notabilitäts-Proxy).
 *  - Nur verifizierbare Attribute: P397 (Elternobjekt), P2386 (Durchmesser),
 *    P575 (Entdeckungsdatum), P59 (Sternbild), P1215 (scheinbare Helligkeit),
 *    P2583 (Distanz in Parsec).
 *  - Dedup gegen bestehende astra_raw.json (nach ID und normalisiertem Namen).
 *  - Sequenzielle Queries, mind. 1 s Pause, beschreibender User-Agent.
 *  - Ergebnis nach harvest/astra_wd1.json (NICHT in astra_raw.json mergen).
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_astra.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Konfiguration -------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (educational quiz; nfetzen@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
// Mindestpause zwischen WDQS-Anfragen in ms
const MIN_DELAY_MS = 1200;
// Maximale Retry-Versuche bei 429/503
const MAX_RETRIES = 3;

// Ausgabe-Datei
const OUT_PATH = path.join(__dirname, 'astra_wd1.json');
// Bestandsdaten für Dedup
const RAW_PATH = path.join(__dirname, '..', 'astra_raw.json');

// --- Hilfsfunktionen -----------------------------------------------------

/** Normalisiert einen Namen für Dedup-Vergleich. */
function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    // Umlaute vereinheitlichen für Vergleich
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    // Klammerzusätze entfernen ("Erdmond (Luna)" -> "erdmond ")
    .replace(/\(.*?\)/g, '')
    // Nur alphanumerisch
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
      // Rate-Limit oder temporärer Fehler: backoff + retry
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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
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

/** Wert aus einem SPARQL-Binding lesen (gibt undefined wenn fehlt). */
function val(binding, key) {
  return binding[key]?.value;
}

/** Pausiert mind. MIN_DELAY_MS ms. */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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

// --- Neue Konzepte sammeln (in-memory) -----------------------------------

/** Array neuer Konzepte — wird am Ende als JSON geschrieben. */
const newConcepts = [];
/** Slugs der neu gesammelten Konzepte (verhindert Binnendedup). */
const newSlugs = new Set();

function addConcept(concept) {
  if (isDuplicate(concept.name, concept.id)) return false;
  if (newSlugs.has(concept.id)) return false;
  newConcepts.push(concept);
  newSlugs.add(concept.id);
  // Sofort auch in Dedup-Sätze aufnehmen
  existingIds.add(concept.id);
  existingNamesNorm.add(normalizeName(concept.name));
  return true;
}

// =========================================================================
// QUERY 1 — Monde (moon)
// Kriterien: Unterklasse/Instanz von "natürlicher Satellit" (Q2537),
// P397 (Mutterkörper), P2386 (Durchmesser), P575 (Entdeckung),
// dewiki-Artikel als Notabilitäts-Proxy.
// Bewusst enge Filter: P397 gesetzt, P2386 gesetzt, dt. Label vorhanden.
// =========================================================================

async function queryMoons() {
  console.log('\n=== Query 1: Monde ===');

  // Strategie: konkrete Elternobjekte einschränken — nur bekannte Planeten.
  // Mindestdurchmesser 10 km filtert obskure S/200x-Mikromonde heraus.
  // FILTER(!REGEX...) schließt provisorische Bezeichnungen (S/20xx ...) aus.
  // Planeten: Jupiter Q319, Saturn Q193, Uranus Q324, Neptun Q332, Mars Q111, Erde Q2
  const query = `
SELECT DISTINCT ?item ?qid ?label ?parentLabel ?diameterKm ?discoveredYear WHERE {
  VALUES ?parent { wd:Q319 wd:Q193 wd:Q324 wd:Q332 wd:Q111 wd:Q2 }
  ?item wdt:P397 ?parent .
  ?parent rdfs:label ?parentLabel FILTER(LANG(?parentLabel) = "de")
  # Muss deutschen Wikipedia-Artikel haben
  ?article schema:about ?item ; schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  # Deutsches Label
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # Keine provisorischen Bezeichnungen (S/20xx ...)
  FILTER(!REGEX(?label, "^S/"))
  # P2386: Durchmesser in km (Einheit: Q828224 = km)
  ?item p:P2386 ?diamStmt .
  ?diamStmt psv:P2386 ?diamVal .
  ?diamVal wikibase:quantityAmount ?diameterKm .
  ?diamVal wikibase:quantityUnit ?diamUnit .
  FILTER(?diamUnit = wd:Q828224)  # km
  FILTER(?diameterKm >= 10)   # ≥ 10 km: nur nennenswerte Monde
  # P575: Entdeckungsdatum (Jahr extrahieren)
  OPTIONAL {
    ?item wdt:P575 ?discovered .
    BIND(YEAR(?discovered) AS ?discoveredYear)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?parentLabel ?label
LIMIT 150
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  for (const b of bindings) {
    const name = val(b, 'label');
    if (!name) { skipped++; continue; }

    const slug = toSlug(name);
    const qid = val(b, 'qid');
    const parentLabel = val(b, 'parentLabel');
    const diamRaw = parseFloat(val(b, 'diameterKm'));
    const discoveredYear = val(b, 'discoveredYear') ? parseInt(val(b, 'discoveredYear')) : undefined;

    // Durchmesser muss plausibel sein (> 1 km, < 6000 km für Monde)
    if (!isFinite(diamRaw) || diamRaw < 1 || diamRaw > 6000) { skipped++; continue; }
    if (!parentLabel) { skipped++; continue; }

    const diameterKm = Math.round(diamRaw);

    const attributes = {
      parentPlanet: parentLabel,
      diameterKm
    };
    if (discoveredYear) attributes.discoveredYear = discoveredYear;

    // verifyNote: listet verwendete Properties auf
    const propList = [`P397 ${parentLabel}`, `P2386 Durchmesser ${diameterKm} km`];
    if (discoveredYear) propList.push(`P575 Entdeckung ${discoveredYear}`);

    const concept = {
      id: slug,
      name,
      category: 'moon',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: propList.join(', '),
      imageSearchTerm: `${name} moon ${parentLabel}`
    };

    if (addConcept(concept)) {
      added++;
      console.log(`  + ${name} (Mond von ${parentLabel}, ${diameterKm} km)`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// =========================================================================
// QUERY 2 — Sterne (star)
// Kriterien: Instanz von "Stern" (Q523) oder "Doppelstern" etc.,
// P59 (Sternbild), P1215 (scheinbare Helligkeit), P2583 (Distanz Parsec),
// dewiki-Artikel.
// =========================================================================

async function queryStars() {
  console.log('\n=== Query 2: Sterne ===');

  // Strategie: dewiki-Sitelinks bekannter heller Sterne → kein Timeout.
  // Nur Sterne mit dt. Wikipedia-Artikel + P59 (Sternbild) + P1215 (Magnitude).
  // Sterne aus dem Bestand werden durch Dedup-Filter später entfernt.
  // Die Artikel-URLs wurden manuell verifiziert (real existierende dewiki-Seiten).
  const starArticles = [
    // Gürtelsterne Orions
    'https://de.wikipedia.org/wiki/Alnilam',
    'https://de.wikipedia.org/wiki/Alnitak',
    'https://de.wikipedia.org/wiki/Mintaka',
    // Weitere Orion-Sterne
    'https://de.wikipedia.org/wiki/Saiph',
    // Kreuz des Südens
    'https://de.wikipedia.org/wiki/Acrux',
    'https://de.wikipedia.org/wiki/Gacrux',
    'https://de.wikipedia.org/wiki/Mimosa_(Stern)',
    // Kassiopeia
    'https://de.wikipedia.org/wiki/Schedar',
    // Kiel des Schiffs
    'https://de.wikipedia.org/wiki/Kanopus',
    'https://de.wikipedia.org/wiki/Miaplacidus',
    'https://de.wikipedia.org/wiki/Avior',
    // Schütze
    'https://de.wikipedia.org/wiki/Kaus_Australis',
    'https://de.wikipedia.org/wiki/Nunki',
    // Zentaur / Südlicher Dreieck
    'https://de.wikipedia.org/wiki/Alpha_Centauri_B',
    'https://de.wikipedia.org/wiki/Hadar_(Stern)',
    // Wasserschlange
    'https://de.wikipedia.org/wiki/Alphard',
    // Widder
    'https://de.wikipedia.org/wiki/Hamal',
    // Drache
    'https://de.wikipedia.org/wiki/Eltanin',
    // Skorpion (weitere)
    'https://de.wikipedia.org/wiki/Shaula',
    'https://de.wikipedia.org/wiki/Sargas',
    'https://de.wikipedia.org/wiki/Dschubba',
    // Stier (weitere)
    'https://de.wikipedia.org/wiki/Alnath',
    // Löwe (weitere)
    'https://de.wikipedia.org/wiki/Algieba',
    'https://de.wikipedia.org/wiki/Denebola',
    // Pegasus
    'https://de.wikipedia.org/wiki/Markab_(Stern)',
    'https://de.wikipedia.org/wiki/Scheat',
    // Jungfrau (weitere)
    'https://de.wikipedia.org/wiki/Porrima',
    // Kleiner Bär
    'https://de.wikipedia.org/wiki/Kochab',
    // Perseus
    'https://de.wikipedia.org/wiki/Mirfak',
    // Schwan (weitere)
    'https://de.wikipedia.org/wiki/Albireo',
  ];

  const articleValues = starArticles.map(a => `<${a}>`).join('\n    ');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?constLabel ?magnitude ?distancePc WHERE {
  VALUES ?article {
    ${articleValues}
  }
  ?article schema:about ?item .
  # Deutsches Label
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  # P59: Sternbild (dt. Label) — Pflicht (zeigt echte Sterne)
  ?item wdt:P59 ?const .
  ?const rdfs:label ?constLabel FILTER(LANG(?constLabel) = "de")
  # P1215: scheinbare Helligkeit
  ?item wdt:P1215 ?magnitude .
  # P2583: Distanz in Parsec
  OPTIONAL {
    ?item p:P2583 ?distStmt .
    ?distStmt psv:P2583 ?distVal .
    ?distVal wikibase:quantityAmount ?distancePc .
    ?distVal wikibase:quantityUnit ?distUnit .
    FILTER(?distUnit = wd:Q214)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?magnitude
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;

  for (const b of bindings) {
    const name = val(b, 'label');
    if (!name) { skipped++; continue; }

    const slug = toSlug(name);
    const qid = val(b, 'qid');
    const constLabel = val(b, 'constLabel');
    const magRaw = parseFloat(val(b, 'magnitude'));
    const distPcRaw = val(b, 'distancePc') ? parseFloat(val(b, 'distancePc')) : undefined;
    const descDe = val(b, 'descDe');

    // Magnitude muss plausibel sein (sichtbare bis sehr helle Sterne: -2 bis 7)
    if (!isFinite(magRaw) || magRaw > 7) { skipped++; continue; }

    const attributes = {
      constellation: constLabel,
      apparentMagnitude: Math.round(magRaw * 100) / 100
    };

    const propList = [`P59 ${constLabel}`, `P1215 Magnitude ${attributes.apparentMagnitude}`];

    if (distPcRaw && isFinite(distPcRaw) && distPcRaw > 0) {
      // Parsec → Lichtjahre: 1 pc = 3.26156 ly
      const distLy = Math.round(distPcRaw * 3.26156);
      attributes.distanceLy = distLy;
      propList.push(`P2583 Distanz ${distLy} Lj (${Math.round(distPcRaw)} pc)`);
    }

    if (descDe && descDe.length < 80) {
      attributes.notableFor = descDe;
    }

    const concept = {
      id: slug,
      name,
      category: 'star',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: propList.join(', '),
      imageSearchTerm: `${name} star`
    };

    if (addConcept(concept)) {
      added++;
      console.log(`  + ${name} (${constLabel}, mag ${attributes.apparentMagnitude})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// =========================================================================
// QUERY 3 — Asteroiden (asteroid)
// Kriterien: wdt:P31=Q3863, dewiki-Artikel, P2386 (Durchmesser), P575 (Entdeckung).
// Wikidata-Labels für Asteroiden sind oft "(N) Name" — die Klammernummer wird
// JS-seitig entfernt, um einen sauberen deutschen Namen zu erhalten.
// Nur Asteroiden mit Eigennamen (kein reines Katalognummern-Label).
// =========================================================================

async function queryAsteroids() {
  console.log('\n=== Query 3: Asteroiden ===');

  // Strategie: Breite P31=Q3863-Query mit dewiki-Filter und Durchmesser > 50 km.
  // Label-Bereinigung (Klammernummer raus) erfolgt in JavaScript.
  // Notabilitäts-Proxy: dewiki-Artikel vorhanden.
  const query = `
SELECT DISTINCT ?item ?qid ?label ?diameterKm ?discoveredYear WHERE {
  ?item wdt:P31 wd:Q3863 .
  ?article schema:about ?item ; schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  OPTIONAL { ?item wdt:P2386 ?diameterKm . FILTER(?diameterKm > 50) }
  OPTIONAL {
    ?item wdt:P575 ?discovered .
    BIND(YEAR(?discovered) AS ?discoveredYear)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?diameterKm)
LIMIT 80
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;
  // Dedup nach bereinigtem Namen innerhalb dieser Query
  const seenQids = new Set();

  for (const b of bindings) {
    const rawLabel = val(b, 'label');
    if (!rawLabel) { skipped++; continue; }

    const qid = val(b, 'qid');
    // Jeden QID nur einmal verarbeiten (SPARQL kann mehrere Durchmesser-Zeilen liefern)
    if (seenQids.has(qid)) { continue; }
    seenQids.add(qid);

    // Label bereinigen: "(10) Hygiea" → "Hygiea", "Lutetia" bleibt "Lutetia"
    // Entfernt "(Zahl) " am Anfang; "(Name)" am Ende bleibt (z.B. "Gaspra (Asteroid)")
    const cleanLabel = rawLabel.replace(/^\(\d+\)\s+/, '').trim();

    // Nur Objekte mit echtem Eigennamen (kein reines Katalognummern-Label wie "2004 XR₁₉₀")
    // Heuristik: Label enthält mindestens einen Buchstaben und kein Ziffernmuster wie "YYYY XX₂₃"
    if (/^\d{4}\s+[A-Z]{2}/.test(cleanLabel)) { skipped++; continue; }
    // Muss mind. 3 Buchstaben haben
    if (cleanLabel.replace(/[^a-zA-ZäöüÄÖÜß]/g, '').length < 3) { skipped++; continue; }

    const diamRaw = val(b, 'diameterKm') ? parseFloat(val(b, 'diameterKm')) : undefined;
    const discoveredYear = val(b, 'discoveredYear') ? parseInt(val(b, 'discoveredYear')) : undefined;

    // Mindestens ein Attribut muss vorhanden sein
    if (!diamRaw && !discoveredYear) { skipped++; continue; }

    const attributes = {};
    const propList = [];

    if (diamRaw && isFinite(diamRaw) && diamRaw > 0.05 && diamRaw < 1500) {
      attributes.diameterKm = Math.round(diamRaw * 10) / 10;
      propList.push(`P2386 Durchmesser ${attributes.diameterKm} km`);
    }
    if (discoveredYear) {
      attributes.discoveredYear = discoveredYear;
      propList.push(`P575 Entdeckung ${discoveredYear}`);
    }

    const slug = toSlug(cleanLabel);

    const concept = {
      id: slug,
      name: cleanLabel,
      category: 'asteroid',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: propList.join(', '),
      imageSearchTerm: `${cleanLabel} asteroid`
    };

    if (addConcept(concept)) {
      added++;
      console.log(`  + ${cleanLabel} (${attributes.diameterKm ?? '?'} km, Entdeckung ${discoveredYear ?? '?'})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// =========================================================================
// QUERY 4 — Zwergplaneten (dwarf_planet)
// Kriterien: Instanz von "Zwergplanet" (Q2273554) oder direkter Instanz,
// P2386 (Durchmesser), P575 (Entdeckung), dewiki-Artikel.
// =========================================================================

async function queryDwarfPlanets() {
  console.log('\n=== Query 4: Zwergplaneten ===');

  // Strategie: wdt:P31=Q2273554 (Zwergplanet), dewiki-Artikel, wdt:P2386 direkt.
  // Labels wie "(134340) Pluto" werden JS-seitig bereinigt.
  // Korrekter Wikidata-QID für Zwergplanet: Q2199 (nicht Q2273554).
  // Alle 9 offiziellen IAU-Zwergplaneten haben P31=Q2199.
  // Salacia (Q136964) ist neu und hat dewiki-Artikel.
  const query = `
SELECT DISTINCT ?item ?qid ?label ?diameterKm ?discoveredYear WHERE {
  VALUES ?dpClass { wd:Q2199 wd:Q2273554 wd:Q1153792 }
  ?item wdt:P31 ?dpClass .
  ?article schema:about ?item ; schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  OPTIONAL { ?item wdt:P2386 ?diameterKm }
  OPTIONAL {
    ?item wdt:P575 ?discovered .
    BIND(YEAR(?discovered) AS ?discoveredYear)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?label
LIMIT 50
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;
  const seenQids = new Set();

  for (const b of bindings) {
    const rawLabel = val(b, 'label');
    if (!rawLabel) { skipped++; continue; }

    const qid = val(b, 'qid');
    if (seenQids.has(qid)) continue;
    seenQids.add(qid);

    // Label bereinigen: "(134340) Pluto" → "Pluto"
    const name = rawLabel.replace(/^\(\d+\)\s+/, '').trim();
    const slug = toSlug(name);

    const diamRaw = val(b, 'diameterKm') ? parseFloat(val(b, 'diameterKm')) : undefined;
    const discoveredYear = val(b, 'discoveredYear') ? parseInt(val(b, 'discoveredYear')) : undefined;

    // Mindestattribute: entweder Durchmesser oder Entdeckungsjahr
    if (!diamRaw && !discoveredYear) { skipped++; continue; }

    const attributes = {};
    const propList = [];

    if (diamRaw && isFinite(diamRaw) && diamRaw > 50 && diamRaw < 4000) {
      attributes.diameterKm = Math.round(diamRaw);
      propList.push(`P2386 Durchmesser ${attributes.diameterKm} km`);
    }
    if (discoveredYear) {
      attributes.discoveredYear = discoveredYear;
      propList.push(`P575 Entdeckung ${discoveredYear}`);
    }

    if (Object.keys(attributes).length === 0) { skipped++; continue; }

    const concept = {
      id: slug,
      name,
      category: 'dwarf_planet',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      verifyNote: propList.join(', '),
      imageSearchTerm: `${name} dwarf planet`
    };

    if (addConcept(concept)) {
      added++;
      console.log(`  + ${name} (${attributes.diameterKm ?? '?'} km, Entdeckung ${discoveredYear ?? '?'})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// =========================================================================
// Hauptprogramm
// =========================================================================

async function main() {
  console.log('Starte Wikidata-Ernte für Astra-Domain...');
  console.log(`Bestandsgröße astra_raw.json: ${rawData.length} Konzepte`);

  try {
    await queryMoons();
    await sleep(MIN_DELAY_MS);

    await queryStars();
    await sleep(MIN_DELAY_MS);

    await queryAsteroids();
    await sleep(MIN_DELAY_MS);

    await queryDwarfPlanets();

  } catch (err) {
    console.error('FEHLER:', err.message);
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

  // Ausgabe schreiben
  fs.writeFileSync(OUT_PATH, JSON.stringify(newConcepts, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${OUT_PATH}`);
}

main();
