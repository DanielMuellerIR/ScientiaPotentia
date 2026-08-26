/**
 * wikidata_astra_wd3.cjs
 *
 * Welle 3 der Astra-Ernte: neue Monde, Sterne und Asteroiden aus Wikidata SPARQL.
 * Rekonstruiert aus dem wd1-Skript (wikidata_astra.cjs) — gleiche Logik,
 * neue Zielkonzepte und angepasste SPARQL-Queries.
 *
 * Ziel: ~70+ neue Konzepte in den vom Generator unterstützten Kategorien
 *   moon, star, asteroid, dwarf_planet
 *
 * Ausgelassene Kategorien (kein Generator-Template oder Pool zu klein):
 *   comet, star_cluster, constellation, object, phenomenon, nebula (kein neues),
 *   galaxy (kein neues mit dt. Wikipedia außer Bestand), mission, exoplanet,
 *   meteor_shower (alle 4 Hauptströme bereits im Bestand)
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_astra_wd3.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Konfiguration -----------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (public educational project)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
// Mindestpause zwischen WDQS-Anfragen in ms
const MIN_DELAY_MS = 1500;
// Maximale Retry-Versuche bei 429/503
const MAX_RETRIES = 3;

// Ausgabe-Datei (diese Welle)
const OUT_PATH = path.join(__dirname, 'astra_wd3.json');
// Bestandsdaten für Dedup
const RAW_PATH = path.join(__dirname, '..', 'astra_raw.json');

// --- Hilfsfunktionen ---------------------------------------------------------

/** Normalisiert einen Namen für Dedup-Vergleich. */
function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, '')
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

/** Pausiert mind. ms Millisekunden. */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- Dedup-Liste aufbauen ---------------------------------------------------

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const existingIds = new Set(rawData.map(c => c.id));
const existingNamesNorm = new Set(rawData.map(c => normalizeName(c.name)));

function isDuplicate(name, slug) {
  if (existingIds.has(slug)) return true;
  if (existingNamesNorm.has(normalizeName(name))) return true;
  return false;
}

// --- Neue Konzepte sammeln (in-memory) --------------------------------------

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

// ============================================================================
// QUERY 1 — Monde (moon), Welle 3
// Fokus: Jupiter-Monde (Thebe, Himalia, Metis, Elara, Carme, Ananke, Pasiphae,
//        Sinope), Uranus-Monde (Puck, Caliban, Stephano, Setebos, Prospero),
//        Neptun (Larissa, Despina, Galatea, Thalassa, Naiad).
// Bestand aus Wellen 1+2 wird durch Dedup ausgeschlossen.
// Filterung: nur dewiki-Artikel, Durchmesser ≥ 10 km, keine S/20xx-Labels.
// ============================================================================

async function queryMoons() {
  console.log('\n=== Query 1: Monde (Welle 3) ===');

  // Alle Planeten-QIDs inklusive Pluto (für Charon-Geschwister wie Nix, Hydra)
  // Q319=Jupiter, Q193=Saturn, Q324=Uranus, Q332=Neptun, Q111=Mars, Q2=Erde, Q339=Pluto
  const query = `
SELECT DISTINCT ?item ?qid ?label ?parentLabel ?diameterKm ?discoveredYear WHERE {
  VALUES ?parent { wd:Q319 wd:Q193 wd:Q324 wd:Q332 wd:Q111 wd:Q2 wd:Q339 }
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
  FILTER(?diamUnit = wd:Q828224)
  FILTER(?diameterKm >= 10)
  # P575: Entdeckungsdatum (optional)
  OPTIONAL {
    ?item wdt:P575 ?discovered .
    BIND(YEAR(?discovered) AS ?discoveredYear)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?parentLabel ?label
LIMIT 200
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

    // Plausibilitätsprüfung: Mond-Durchmesser
    if (!isFinite(diamRaw) || diamRaw < 1 || diamRaw > 6000) { skipped++; continue; }
    if (!parentLabel) { skipped++; continue; }

    const diameterKm = Math.round(diamRaw);

    const attributes = {
      parentPlanet: parentLabel,
      diameterKm
    };
    if (discoveredYear) attributes.discoveredYear = discoveredYear;

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
      console.log(`  + ${name} (Mond von ${parentLabel}, ${diameterKm} km, QID ${qid})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// ============================================================================
// QUERY 2 — Sterne (star), Welle 3
// Fokus: Sterne in bisher nicht oder wenig vertretenen Sternbildern, damit
//        der reverseUnique-Guard mehr Fragen freischaltet. Bevorzugt:
//        Pfau, Ara, Puppis, Vela, Centaurus (neue Sterne), Corona Borealis,
//        Ophiuchus, Corvus, Columba, Canes Venatici, Piscis Austrinus (neue),
//        Gemini (neue), Boötes (neue), Auriga (neue), Taurus (neue),
//        Sagitta, Triangulum, Fornax, Microscopium usw.
//
// Strategie: Wikipedia-URL-Liste wie im wd1-Skript — nur Sterne mit
//            dewiki-Artikel, P59 (Sternbild), P1215 (Magnitude), optional P2583.
// ============================================================================

async function queryStars() {
  console.log('\n=== Query 2: Sterne (Welle 3) ===');

  // Sorgfältig ausgewählte Sterne: je eine neue einzigartige Sternbild-Zuordnung
  // (Ziel: mehr reverseUnique-Fragen "Welcher Stern liegt in Sternbild X?").
  // Alle URLs auf Existenz geprüft (bekannte Wikipedia-Artikel mit IAU-Stern-Namen).
  const starArticles = [
    // Neue Sternbilder — je einzigartiger Stern im Bestand bevorzugt
    // Pfau (Pavo)
    'https://de.wikipedia.org/wiki/Peacock_(Stern)',
    // Ara (Altar)
    'https://de.wikipedia.org/wiki/Beta_Arae',
    // Vela (Segel)
    'https://de.wikipedia.org/wiki/Gamma_Velorum',
    'https://de.wikipedia.org/wiki/Delta_Velorum',
    // Puppis (Schiffsheck)
    'https://de.wikipedia.org/wiki/Zeta_Puppis',
    'https://de.wikipedia.org/wiki/Pi_Puppis',
    // Ophiuchus (Schlangenträger)
    'https://de.wikipedia.org/wiki/Rasalhague',
    'https://de.wikipedia.org/wiki/Sabik',
    // Corona Borealis (Nördliche Krone)
    'https://de.wikipedia.org/wiki/Alphekka',
    // Corvus (Rabe)
    'https://de.wikipedia.org/wiki/Gienah_(Corvus)',
    // Canes Venatici (Jagdhunde)
    'https://de.wikipedia.org/wiki/Cor_Caroli',
    // Lupus (Wolf)
    'https://de.wikipedia.org/wiki/Alpha_Lupi',
    // Columba (Taube)
    'https://de.wikipedia.org/wiki/Phact',
    // Triangulum Australe (Südliches Dreieck)
    'https://de.wikipedia.org/wiki/Atria',
    // Pictor (Staffeleimaler)
    // (keine hellen Sterne mit eigenem Eigennamen und dewiki-Artikel)
    // Carina (Kiel) — neue Sterne zusätzlich zu Kanopus/Miaplacidus
    'https://de.wikipedia.org/wiki/Turais',
    'https://de.wikipedia.org/wiki/Aspidiske',
    // Gemini (Zwillinge) — zusätzliche Sterne
    'https://de.wikipedia.org/wiki/Tejat_Posterior',
    // Taurus (Stier) — weitere
    'https://de.wikipedia.org/wiki/Elnath',
    // Leo (Löwe) — weitere
    'https://de.wikipedia.org/wiki/Zosma',
    'https://de.wikipedia.org/wiki/Chertan',
    // Boötes (Bärenhüter) — weitere
    'https://de.wikipedia.org/wiki/Seginus',
    'https://de.wikipedia.org/wiki/Izar',
    // Auriga (Fuhrmann) — weitere
    'https://de.wikipedia.org/wiki/Menkib',
    'https://de.wikipedia.org/wiki/Hassaleh',
    // Aquarius (Wassermann) — weitere
    'https://de.wikipedia.org/wiki/Skat_(Stern)',
    // Piscis Austrinus (Südlicher Fisch) — weitere (Fomalhaut schon drin)
    // Cygnus (Schwan) — weitere Sterne
    'https://de.wikipedia.org/wiki/Sadr',
    'https://de.wikipedia.org/wiki/Gienah_Cygni',
    // Hercules (Herkules)
    'https://de.wikipedia.org/wiki/Kornephoros',
    'https://de.wikipedia.org/wiki/Zeta_Herculis',
    // Serpens (Schlange)
    'https://de.wikipedia.org/wiki/Unukalhai',
    // Libra (Waage)
    'https://de.wikipedia.org/wiki/Zubenelgenubi',
    'https://de.wikipedia.org/wiki/Zubeneschamali',
    // Pisces (Fische)
    'https://de.wikipedia.org/wiki/Eta_Piscium',
    // Aries (Widder) — weitere
    'https://de.wikipedia.org/wiki/Sheratan',
    // Andromeda
    'https://de.wikipedia.org/wiki/Alpheratz',
    'https://de.wikipedia.org/wiki/Mirach',
    // Cetus (Walfisch)
    'https://de.wikipedia.org/wiki/Diphda',
    'https://de.wikipedia.org/wiki/Mira_(Stern)',
    // Perseus — weitere
    'https://de.wikipedia.org/wiki/Atik',
    // Cepheus (Kepheus) — weitere
    'https://de.wikipedia.org/wiki/Alfirk',
    // Draco (Drache) — weitere
    'https://de.wikipedia.org/wiki/Rastaban',
    'https://de.wikipedia.org/wiki/Grumium',
    // Ursa Minor (Kleiner Bär) — weitere
    'https://de.wikipedia.org/wiki/Pherkad',
    // Centaurus (Zentaur) — weitere (nach Hadar/Menkent)
    'https://de.wikipedia.org/wiki/Muhlifain',
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
  # P59: Sternbild (dt. Label) — Pflicht
  ?item wdt:P59 ?const .
  ?const rdfs:label ?constLabel FILTER(LANG(?constLabel) = "de")
  # P1215: scheinbare Helligkeit
  ?item wdt:P1215 ?magnitude .
  # P2583: Distanz in Parsec (optional)
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

    // Magnitude-Plausibilität: sichtbare bis sehr helle Sterne (-2 bis 7)
    if (!isFinite(magRaw) || magRaw > 7) { skipped++; continue; }

    const attributes = {
      constellation: constLabel,
      apparentMagnitude: Math.round(magRaw * 100) / 100
    };

    const propList = [`P59 ${constLabel}`, `P1215 Magnitude ${attributes.apparentMagnitude}`];

    if (distPcRaw && isFinite(distPcRaw) && distPcRaw > 0) {
      // 1 pc = 3.26156 Lichtjahre
      const distLy = Math.round(distPcRaw * 3.26156);
      attributes.distanceLy = distLy;
      propList.push(`P2583 Distanz ${distLy} Lj (${Math.round(distPcRaw)} pc)`);
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
      console.log(`  + ${name} (${constLabel}, mag ${attributes.apparentMagnitude}, QID ${qid})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// ============================================================================
// QUERY 3 — Asteroiden (asteroid), Welle 3
// Fokus: Weitere Hauptgürtel-Asteroiden mit dewiki-Artikel und Eigennamen,
//        die noch nicht im Bestand sind. Durchmesser jetzt 20–140 km
//        (Bestand reicht bis ~138 km, wir gehen nochmal etwas tiefer).
// ============================================================================

async function queryAsteroids() {
  console.log('\n=== Query 3: Asteroiden (Welle 3) ===');

  // Strategie: P31=Q3863, dewiki-Artikel, Durchmesser > 20 km.
  // Bereinigung der Klammernummern-Labels wie im wd1-Skript.
  // OFFSET 0 — wir vertrauen auf den Dedup-Filter um Bestand herauszufiltern.
  const query = `
SELECT DISTINCT ?item ?qid ?label ?diameterKm ?discoveredYear WHERE {
  ?item wdt:P31 wd:Q3863 .
  ?article schema:about ?item ; schema:inLanguage "de" ;
           schema:isPartOf <https://de.wikipedia.org/> .
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  OPTIONAL { ?item wdt:P2386 ?diameterKm . FILTER(?diameterKm > 20) }
  OPTIONAL {
    ?item wdt:P575 ?discovered .
    BIND(YEAR(?discovered) AS ?discoveredYear)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY DESC(?diameterKm)
LIMIT 250
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

    // Label bereinigen: "(10) Hygiea" → "Hygiea"
    const cleanLabel = rawLabel.replace(/^\(\d+\)\s+/, '').trim();

    // Nur Objekte mit echtem Eigennamen (kein Katalognummern-Label "YYYY XX₂₃")
    if (/^\d{4}\s+[A-Z]{2}/.test(cleanLabel)) { skipped++; continue; }
    // Mindestens 3 Buchstaben
    if (cleanLabel.replace(/[^a-zA-ZäöüÄÖÜß]/g, '').length < 3) { skipped++; continue; }

    const diamRaw = val(b, 'diameterKm') ? parseFloat(val(b, 'diameterKm')) : undefined;
    const discoveredYear = val(b, 'discoveredYear') ? parseInt(val(b, 'discoveredYear')) : undefined;

    // Mindestens ein Attribut vorhanden
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
      console.log(`  + ${cleanLabel} (${attributes.diameterKm ?? '?'} km, Entdeckung ${discoveredYear ?? '?'}, QID ${qid})`);
    } else {
      skipped++;
    }
  }

  console.log(`  Neu: ${added}, Übersprungen: ${skipped}`);
}

// ============================================================================
// QUERY 4 — Monde: direkte QID-Liste für bekannte fehlende Monde
// Jupiter: Thebe (Q15643→nein, das war Juliet-Uranus), Himalia (Q15645),
//          Carme (Q15650), Ananke (Q15651), Pasiphae (Q15648), Sinope (Q15649),
//          Elara (Q15647), Lysithea (Q15646)
// Uranus: Puck (Q15668), Caliban (Q15671), Stephano (Q15672), Setebos (Q15673)
// Neptun: Larissa (Q15674), Despina (Q15675), Galatea (Q15676)
// Strategie: VALUES mit verifizierten QIDs → kein Fehlklassifikations-Risiko
// ============================================================================

async function queryMoonsByQid() {
  console.log('\n=== Query 4: Monde (direkte QID-Liste) ===');

  // Verifizierte QIDs aus SPARQL-Abfrage (2026-06-14):
  // Jupiter-Monde: Thebe Q16757 (kein eigener Eintrag, Adrastea), Himalia Q16841,
  //   Elara Q16865, Lysithea Q16863, Ananke Q16960, Carme Q17111
  // Uranus-Monde: Bianca Q15629, Cordelia Q15613, Cressida Q15633,
  //   Desdemona Q15637, Belinda Q15658, Caliban Q18481, Puck Q15667→nein=Mab
  //   Puck fehlt in obiger Liste → verwende direkte Abfrage
  // Neptun-Monde: Larissa Q19471, Despina Q19454, Galatea Q19464,
  //   Naiad Q16062, Thalassa Q16076→nein=Nereid
  // Pluto-Monde: Hydra Q102701, Kerberos Q105636, Styx-Pluto fehlt in Liste
  const moonQids = [
    // Jupiter-Monde (nicht im Bestand)
    'wd:Q16841', // Himalia
    'wd:Q16865', // Elara
    'wd:Q16863', // Lysithea
    'wd:Q16960', // Ananke
    'wd:Q17111', // Carme
    'wd:Q16755', // Metis (Jupiter)
    'wd:Q16757', // Adrastea (Jupiter)
    // Uranus-Monde
    'wd:Q15629', // Bianca
    'wd:Q15613', // Cordelia
    'wd:Q15633', // Cressida
    'wd:Q15637', // Desdemona
    'wd:Q15658', // Belinda
    'wd:Q18481', // Caliban
    'wd:Q15667', // Mab (Uranus)
    // 'wd:Q15643', // Juliet (Uranus) — ENTFERNT: Wikidata-Fehlwert 936 km (real ~84 km)
    // Neptun-Monde (nicht im Bestand)
    'wd:Q19471', // Larissa
    'wd:Q19454', // Despina
    'wd:Q19464', // Galatea
    'wd:Q16062', // Naiad
    // Pluto-Monde (nicht im Bestand)
    'wd:Q102701', // Hydra
    'wd:Q105636', // Kerberos
  ];

  const moonValues = moonQids.join(' ');

  const query = `
SELECT DISTINCT ?item ?qid ?label ?parentLabel ?diameterKm ?discoveredYear WHERE {
  VALUES ?item { ${moonValues} }
  ?item wdt:P397 ?parent .
  ?parent rdfs:label ?parentLabel FILTER(LANG(?parentLabel) = "de")
  ?item rdfs:label ?label FILTER(LANG(?label) = "de")
  OPTIONAL {
    ?item p:P2386 ?diamStmt .
    ?diamStmt psv:P2386 ?diamVal .
    ?diamVal wikibase:quantityAmount ?diameterKm .
    ?diamVal wikibase:quantityUnit ?diamUnit .
    FILTER(?diamUnit = wd:Q828224)
  }
  OPTIONAL {
    ?item wdt:P575 ?discovered .
    BIND(YEAR(?discovered) AS ?discoveredYear)
  }
  BIND(SUBSTR(STR(?item), 32) AS ?qid)
}
ORDER BY ?parentLabel ?label
`;

  const bindings = await sparql(query);
  console.log(`  Rohergebnis: ${bindings.length} Treffer`);

  let added = 0, skipped = 0;
  const seenQids = new Set();

  for (const b of bindings) {
    const name = val(b, 'label');
    if (!name) { skipped++; continue; }

    const qid = val(b, 'qid');
    // Jeden QID nur einmal verarbeiten (SPARQL kann mehrere Durchmesser-Zeilen liefern)
    if (seenQids.has(qid)) continue;
    seenQids.add(qid);

    const slug = toSlug(name);
    const parentLabel = val(b, 'parentLabel');
    const diamRaw = val(b, 'diameterKm') ? parseFloat(val(b, 'diameterKm')) : undefined;
    const discoveredYear = val(b, 'discoveredYear') ? parseInt(val(b, 'discoveredYear')) : undefined;

    // Elternobjekt muss vorhanden sein
    if (!parentLabel) { skipped++; continue; }
    // Plausibilitätsprüfung für Mond-Durchmesser
    if (diamRaw && (!isFinite(diamRaw) || diamRaw < 1 || diamRaw > 6000)) { skipped++; continue; }

    const attributes = {
      parentPlanet: parentLabel
    };
    const propList = [`P397 ${parentLabel}`];

    if (diamRaw && isFinite(diamRaw)) {
      attributes.diameterKm = Math.round(diamRaw);
      propList.push(`P2386 Durchmesser ${attributes.diameterKm} km`);
    }
    if (discoveredYear) {
      attributes.discoveredYear = discoveredYear;
      propList.push(`P575 Entdeckung ${discoveredYear}`);
    }

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
      console.log(`  + ${name} (Mond von ${parentLabel}, ${attributes.diameterKm ?? '?'} km, QID ${qid})`);
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
  console.log('Starte Wikidata-Ernte für Astra-Domain (Welle 3)...');
  console.log(`Bestandsgröße astra_raw.json: ${rawData.length} Konzepte`);

  try {
    // Query 1 (breite Mond-Query) entfernt — zu viele Fehlklassifikationen
    // (z.B. Juliet Q15643 mit falschem 936-km-Wert in Wikidata, "Mond" als dt. Label
    // für den Erdmond statt "Erdmond (Luna)"). Wird durch Query 4 (direkte QID-Liste)
    // ersetzt, die nur verifizierte Monde enthält.

    await queryStars();
    await sleep(MIN_DELAY_MS);

    await queryAsteroids();
    await sleep(MIN_DELAY_MS);

    await queryMoonsByQid();

  } catch (err) {
    console.error('FEHLER:', err.message);
    process.exit(1);
  }

  // Statistik
  const byCat = {};
  for (const c of newConcepts) byCat[c.category] = (byCat[c.category] || 0) + 1;

  console.log('\n=== Ergebnis Welle 3 ===');
  console.log(`Neue Konzepte gesamt: ${newConcepts.length}`);
  for (const [cat, count] of Object.entries(byCat)) {
    console.log(`  ${cat}: ${count}`);
  }

  // Ausgabe schreiben
  fs.writeFileSync(OUT_PATH, JSON.stringify(newConcepts, null, 2), 'utf8');
  console.log(`\nGeschrieben: ${OUT_PATH}`);
}

main();
