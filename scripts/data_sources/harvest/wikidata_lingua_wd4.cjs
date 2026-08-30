/**
 * wikidata_lingua_wd4.cjs
 *
 * Vierte WDQS-Ernte für Lingua-Sprachkonzepte (category: "language").
 * Ziel: ~25-40 weitere bekannte/notable Sprachen, die in wd1–wd3 und raw fehlen.
 *
 * Strategie:
 *   - Familien mit <5 Einträgen aufstocken (Turksprachen: 4, Uralisch: 4, etc.)
 *   - Bekannte Weltsprachen die durchs Netz gefallen sind (Marathi, Odia, Sindhi,
 *     Amoy/Hokkien, Wu, Quechua, Aymara, etc.) via Einzel-Items gezielt nachholen
 *   - Neue Sprachfamilien: Austroasiatisch breiter (nicht nur Mon-Khmer), Quechuan,
 *     Otomanguean, Na-Dené
 *
 * Dedup: gegen lingua_raw.json + lingua_wd1.json + lingua_wd2.json + lingua_wd3.json
 * Ausgabe: scripts/data_sources/harvest/lingua_wd4.json
 * KEIN Überschreiben von lingua_raw.json oder vorherigen wd*.json Dateien.
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_lingua_wd4.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('./json_io.cjs');
const {
  assertExpectedEntity,
  buildSingleLanguageQuery,
  selectLanguageFacts,
} = require('./lingua_harvest_helpers.cjs');

// --- Konfiguration ----------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (public educational project)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS = 2000;
const MAX_RETRIES = 3;

const OUT_PATH = path.join(__dirname, 'lingua_wd4.json');
const RAW_PATH = path.join(__dirname, '..', 'lingua_raw.json');
const WD1_PATH = path.join(__dirname, 'lingua_wd1.json');
const WD2_PATH = path.join(__dirname, 'lingua_wd2.json');
const WD3_PATH = path.join(__dirname, 'lingua_wd3.json');

// --- Hilfsfunktionen -------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sparqlQuery(query, retries = MAX_RETRIES) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': UA, 'Accept': 'application/sparql-results+json' } },
      res => {
        if ((res.statusCode === 429 || res.statusCode === 503) && retries > 0) {
          const wait = 8000 + Math.random() * 4000;
          console.warn(`  HTTP ${res.statusCode} — warte ${Math.round(wait / 1000)} s`);
          res.resume();
          setTimeout(() => sparqlQuery(query, retries - 1).then(resolve).catch(reject), wait);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`JSON-Parse: ${e.message} | ${body.slice(0, 150)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Timeout (45 s)')); });
  });
}

function normName(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[()]/g, '').trim();
}

function toSlug(name) {
  return name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeScript(label) {
  if (!label || label.trim().length < 3) return null;
  const s = label.trim();
  const MAP = {
    'lateinisches alphabet':          'Lateinisches Alphabet',
    'kyrillisches alphabet':          'Kyrillisches Alphabet',
    'arabisches alphabet':            'Arabisches Alphabet (Abjad)',
    'arabische schrift':              'Arabisches Alphabet (Abjad)',
    'hebräische schrift':             'Hebräische Schrift',
    'griechisches alphabet':          'Griechisches Alphabet',
    'georgisches alphabet':           'Georgisches Alphabet',
    'armenisches alphabet':           'Armenisches Alphabet',
    'devanagari':                     'Devanagari',
    'hangul':                         'Hangul',
    'äthiopische schrift':            'Äthiopische Schrift (Ge\'ez)',
    'ge\'ez-schrift':                 'Äthiopische Schrift (Ge\'ez)',
    'singhalesische schrift':         'Singhalesische Schrift',
    'tibetische schrift':             'Tibetische Schrift',
    'birmanische schrift':            'Birmanische Schrift',
    'myanmar-schrift':                'Birmanische Schrift',
    'gujarati-schrift':               'Gujarati-Schrift',
    'gurmukhi-schrift':               'Gurmukhi-Schrift',
    'gurmukhi':                       'Gurmukhi-Schrift',
    'thai-schrift':                   'Thailändische Schrift',
    'tamilische schrift':             'Tamilische Schrift',
    'telugu-schrift':                 'Telugu-Schrift',
    'kannada-schrift':                'Kannada-Schrift',
    'odia-schrift':                   'Odia-Schrift',
    'khmer-schrift':                  'Khmer-Schrift',
    'lao-schrift':                    'Lao-Schrift',
    'bengalisches alphabet':          'Bengalisches Alphabet',
    'bengali-schrift':                'Bengalisches Alphabet',
    'tifinagh':                       'Tifinagh',
    'n\'ko-alphabet':                 'N\'Ko-Alphabet',
    'mongolisches alphabet':          'Mongolisches Alphabet',
    'syrische schrift':               'Syrische Schrift',
    'khojki-schrift':                 'Arabisches Alphabet (Abjad)',
    'nko-alphabet':                   'N\'Ko-Alphabet',
    'lateinisches schriftsystem':     'Lateinisches Alphabet',
  };
  const key = s.toLowerCase().replace(/\s+/g, ' ');
  return MAP[key] || s;
}

// --- Sprachfamilien-Mapping → Bestand-Strings -----------------------------

function mapFamily(topLabel, branchLabel) {
  const TOP_DIRECT = {
    'Turksprachen':      'Turksprachen',
    'Dravidisch':        'Dravidisch',
    'Tai-Kadai':         'Tai-Kadai',
    'Kartvelisch':       'Kartvelisch',
    'Nilo-Saharanisch':  'Nilo-Saharanisch',
    'Khoisan':           'Khoisan',
    'Uralisch':          'Uralisch',
    'Niger-Kongo':       'Niger-Kongo',
    'Afroasiatisch':     'Afroasiatisch',
    'Austronesisch':     'Austronesisch',
    'Sinotibetisch':     'Sinotibetisch',
    'Austroasiatisch':   'Austroasiatisch (Mon-Khmer)',
    'Quechuan':          'Quechuan',
    'Tupí-Guaraní':      'Tupí-Guaraní',
    'Isolat':            null,
  };
  if (topLabel in TOP_DIRECT) {
    return TOP_DIRECT[topLabel];
  }

  if (topLabel === 'Indogermanisch') {
    const BRANCH = {
      'Germanisch':    'Germanisch',
      'Romanisch':     'Romanisch',
      'Slawisch':      'Slawisch',
      'Indo-Iranisch': 'Indo-Iranisch',
      'Keltisch':      'Keltisch',
      'Baltisch':      'Baltisch',
    };
    const b = branchLabel ? BRANCH[branchLabel] : null;
    if (b) return `Indogermanisch (${b})`;
    return 'Indogermanisch';
  }

  if (topLabel === 'Afroasiatisch') {
    if (branchLabel === 'Semitisch') return 'Afroasiatisch (Semitisch)';
    return 'Afroasiatisch';
  }

  if (topLabel === 'Austronesisch') {
    if (branchLabel === 'Malayo-Polynesisch') return 'Austronesisch (Malayo-Polynesisch)';
    return 'Austronesisch';
  }

  if (topLabel === 'Sinotibetisch') {
    if (branchLabel === 'Sinitisch') return 'Sinotibetisch (Sinitisch)';
    return 'Sinotibetisch';
  }

  return null;
}

// --- Gruppen-Queries für Familien mit Lücken --------------------------------

const LANG_GROUPS = [
  // Türkisch-Familie: noch fehlen Kirgisisch, Turkmenisch, Baschkirisch, Tatarisch...
  { topLabel: 'Turksprachen', branchLabel: null, familyQid: 'Q34090', limit: 40 },
  // Uralisch: Finnisch+Ungarisch+Estnisch+Mari schon da — fehlen: Erzya, Moksha, Komi, Nenzen...
  { topLabel: 'Uralisch', branchLabel: null, familyQid: 'Q34113', limit: 30 },
  // Indo-Iranisch: Marathi, Odia, Sindhi, Rajasthani noch nicht erfasst
  { topLabel: 'Indogermanisch', branchLabel: 'Indo-Iranisch', familyQid: 'Q33514', limit: 50 },
  // Sinotibetisch: Hokkien (Min Nan), Wu, Hakka noch nicht
  { topLabel: 'Sinotibetisch', branchLabel: 'Sinitisch', familyQid: 'Q33857', limit: 20 },
  // Quechua-Makrosprache und -Familie (Q5218) — Quechua, Kichwa etc.
  { topLabel: 'Quechuan', branchLabel: null, familyQid: 'Q5218', limit: 15 },
];

// --- Einzel-Items: bekannte Weltsprachen, die noch fehlen -------------------
// Alle QIDs per Wikidata-Suche verifiziert.
const SINGLE_ITEMS = [
  // Indogermanisch – Indo-Iranisch
  { qid: 'Q1571',   nameDE: 'Marathi',       family: 'Indogermanisch (Indo-Iranisch)' },
  { qid: 'Q33810',  nameDE: 'Odia',          family: 'Indogermanisch (Indo-Iranisch)' },
  { qid: 'Q33997',  nameDE: 'Sindhi',        family: 'Indogermanisch (Indo-Iranisch)' },
  { qid: 'Q36109',  nameDE: 'Maithili',      family: 'Indogermanisch (Indo-Iranisch)' },
  // Turksprachen
  { qid: 'Q9255',   nameDE: 'Kirgisisch',    family: 'Turksprachen' },
  { qid: 'Q9267',   nameDE: 'Turkmenisch',   family: 'Turksprachen' },
  { qid: 'Q13389',  nameDE: 'Baschkirisch',  family: 'Turksprachen' },
  { qid: 'Q25285',  nameDE: 'Tatarisch',     family: 'Turksprachen' },
  { qid: 'Q13263',  nameDE: 'Uigurisch',     family: 'Turksprachen' },
  // Sinotibetisch – Sinitische Varianten
  { qid: 'Q1624231', nameDE: 'Hokkien',       family: 'Sinotibetisch (Sinitisch)' },
  { qid: 'Q34290',  nameDE: 'Wu',            family: 'Sinotibetisch (Sinitisch)' },
  { qid: 'Q33375',  nameDE: 'Hakka',         family: 'Sinotibetisch (Sinitisch)' },
  // Uralisch
  { qid: 'Q13238',  nameDE: 'Udmurtisch',    family: 'Uralisch' },
  { qid: 'Q36126',  nameDE: 'Komi',          family: 'Uralisch' },
  { qid: 'Q29952',  nameDE: 'Ersjanisch',    family: 'Uralisch' },
  // Austronesisch – weitere Philippinen-Sprachen
  { qid: 'Q34279',  nameDE: 'Waray-Waray',   family: 'Austronesisch' },
  { qid: 'Q36121',  nameDE: 'Kapampangan',   family: 'Austronesisch' },
  // Quechuan
  { qid: 'Q5218',   nameDE: 'Quechua',       family: 'Quechuan' },
  // Niger-Kongo – wichtige Sprachen
  { qid: 'Q36217',  nameDE: 'Lingala',       family: 'Niger-Kongo (Bantu)' },
  { qid: 'Q33573',  nameDE: 'Kinyarwanda',   family: 'Niger-Kongo (Bantu)' },
  { qid: 'Q33578',  nameDE: 'Igbo',          family: 'Niger-Kongo' },
  // Mongolisch (Sprachfamilie Mongolic)
  { qid: 'Q9246',   nameDE: 'Mongolisch',    family: 'Mongolisch' },
  // Weitere indo-iranische Sprachen
  { qid: 'Q33049',  nameDE: 'Balochi',       family: 'Indogermanisch (Indo-Iranisch)' },
  // Sonstige bekannte Sprachen
  { qid: 'Q8785',   nameDE: 'Armenisch',     family: 'Indogermanisch' },
  { qid: 'Q29401',  nameDE: 'Assamesisch',   family: 'Indogermanisch (Indo-Iranisch)' },
];

// --- SPARQL-Query-Builder ---------------------------------------------------

function buildGroupQuery(group) {
  return [
    'SELECT DISTINCT ?lang ?langLabel ?speakers ?scriptLabel',
    'WHERE {',
    '  ?lang wdt:P31/wdt:P279* wd:Q34770 .',
    '  ?lang wdt:P279* wd:' + group.familyQid + ' .',
    '  ?dw schema:about ?lang ;',
    '      schema:isPartOf <https://de.wikipedia.org/> .',
    '  OPTIONAL { ?lang wdt:P1098 ?speakers . }',
    '  OPTIONAL {',
    '    ?lang wdt:P282 ?script .',
    '    ?script rdfs:label ?scriptLabel .',
    '    FILTER(LANG(?scriptLabel) = "de")',
    '  }',
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en" . }',
    '}',
    'ORDER BY DESC(?speakers)',
    'LIMIT ' + group.limit,
  ].join('\n');
}

function buildOfficialCountryQuery(qid) {
  return [
    'SELECT (COUNT(DISTINCT ?country) AS ?cnt)',
    'WHERE {',
    '  ?country wdt:P31/wdt:P279* wd:Q3624078 .',
    '  ?country wdt:P37 wd:' + qid + ' .',
    '}',
  ].join('\n');
}

// --- Bestand laden ---------------------------------------------------------

function loadJsonIfExists(p) {
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { throw new Error(`${p} nicht lesbar: ${e.message}`); }
}

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const wd1Data = loadJsonIfExists(WD1_PATH);
const wd2Data = loadJsonIfExists(WD2_PATH);
const wd3Data = loadJsonIfExists(WD3_PATH);

const allLangs = [
  ...rawData.filter(c => c.category === 'language'),
  ...wd1Data.filter(c => c.category === 'language'),
  ...wd2Data.filter(c => c.category === 'language'),
  ...wd3Data.filter(c => c.category === 'language'),
];

const existingIds   = new Set(allLangs.map(c => c.id));
const existingNames = new Set(allLangs.map(c => normName(c.name)));

console.log(`Dedup-Pool: ${existingIds.size} IDs, ${existingNames.size} Namen (raw + wd1 + wd2 + wd3)`);

// --- Hauptlogik -------------------------------------------------------------

async function main() {
  const results = new Map(); // QID → Datensatz

  // 1) Gruppen-Queries
  for (const group of LANG_GROUPS) {
    const query = buildGroupQuery(group);
    const label = `${group.topLabel}${group.branchLabel ? ' / ' + group.branchLabel : ''} [${group.familyQid}]`;
    console.log(`\nQuery: ${label} (LIMIT ${group.limit})`);

    let data;
    try {
      data = await sparqlQuery(query);
    } catch (e) {
      throw new Error(`${label}: ${e.message}`);
    }

    const bindings = data.results?.bindings || [];
    console.log(`  ${bindings.length} Treffer`);
    let added = 0, deduped = 0;

    for (const row of bindings) {
      const qid    = row.lang?.value?.replace('http://www.wikidata.org/entity/', '');
      const nameDE = row.langLabel?.value;
      if (!qid || !nameDE) continue;
      // Kein deutsches Label → QID-Fallback, überspringen
      if (/^Q\d+$/.test(nameDE)) continue;
      if (results.has(qid)) continue;

      const slug = toSlug(nameDE);
      if (existingIds.has(slug) || existingNames.has(normName(nameDE))) {
        deduped++;
        continue;
      }

      const speakersRaw = row.speakers?.value ? Number(row.speakers.value) : null;
      const speakersM = (speakersRaw && isFinite(speakersRaw) && speakersRaw > 0)
        ? Math.round(speakersRaw / 1e5) / 10
        : null;

      const script = normalizeScript(row.scriptLabel?.value);
      const family = mapFamily(group.topLabel, group.branchLabel);

      results.set(qid, { qid, nameDE, slug, speakersM, script, family, officialIn: null });
      added++;
    }

    console.log(`  Neu: ${added}, Dedup: ${deduped}`);
    await sleep(MIN_DELAY_MS);
  }

  // 2) Einzel-Items
  console.log('\n--- Einzel-Items ---');
  for (const item of SINGLE_ITEMS) {
    const slug = toSlug(item.nameDE);
    if (existingIds.has(slug) || existingNames.has(normName(item.nameDE)) || results.has(item.qid)) {
      console.log(`  Dedup: ${item.nameDE} (${item.qid})`);
      continue;
    }

    console.log(`  Abfrage: ${item.nameDE} (${item.qid})`);
    try {
      const data = await sparqlQuery(buildSingleLanguageQuery(item.qid));
      const bindings = assertExpectedEntity(item, data.results?.bindings || []);
      const { speakersRaw, script } = selectLanguageFacts(bindings, normalizeScript);
      const speakersM = (speakersRaw && isFinite(speakersRaw) && speakersRaw > 0)
        ? Math.round(speakersRaw / 1e5) / 10
        : null;

      if (!speakersM && !item.family) {
        console.log('    Übersprungen (kein Sprecher+Familie)');
        await sleep(MIN_DELAY_MS);
        continue;
      }

      results.set(item.qid, {
        qid: item.qid, nameDE: item.nameDE, slug,
        speakersM, script, family: item.family, officialIn: null,
      });
      console.log(`    OK — ${speakersM ?? '?'} Mio., ${script || '?'}`);
    } catch (e) {
      throw new Error(`Einzel-Item ${item.nameDE}: ${e.message}`);
    }
    await sleep(MIN_DELAY_MS);
  }

  console.log(`\n--- Vor officialIn: ${results.size} Kandidaten ---`);

  // 3) officialIn für Sprachen >= 1 Mio. Sprecher
  const candidates = [...results.values()].filter(r => (r.speakersM ?? 0) >= 1);
  console.log(`officialIn-Queries für ${candidates.length} Sprachen`);

  for (const lang of candidates) {
    try {
      const data = await sparqlQuery(buildOfficialCountryQuery(lang.qid));
      const cnt = parseInt(data.results?.bindings?.[0]?.cnt?.value || '0', 10);
      if (cnt > 0) lang.officialIn = cnt;
      if (cnt > 0) console.log(`  ${lang.nameDE}: officialIn=${cnt}`);
    } catch (e) {
      throw new Error(`officialIn ${lang.nameDE}: ${e.message}`);
    }
    await sleep(MIN_DELAY_MS);
  }

  // --- Ausgabe aufbauen ---------------------------------------------------

  const output = [];
  let skipped = 0;

  for (const lang of results.values()) {
    // Minimale Qualitätsschwelle: Sprecherzahl ODER Familie muss vorhanden sein
    if (!lang.speakersM && !lang.family) { skipped++; continue; }

    const attributes = {};
    if (lang.speakersM && lang.speakersM > 0) attributes.speakersMillionsNative = lang.speakersM;
    if (lang.family)                           attributes.family    = lang.family;
    if (lang.script)                           attributes.script    = lang.script;
    if (lang.officialIn)                       attributes.officialIn = lang.officialIn;

    output.push({
      id:         lang.slug,
      name:       lang.nameDE,
      category:   'language',
      attributes,
      funFact:    '',
      sourceName: 'Wikidata',
      sourceUrl:  `https://www.wikidata.org/wiki/${lang.qid}`,
      verifyNote: `P1098=${lang.speakersM != null ? lang.speakersM + ' Mio.' : 'n/a'}, P282=${lang.script || 'n/a'}, Familie=${lang.family || 'n/a'}, officialIn=${lang.officialIn ?? 'n/a'}`,
      imageSearchTerm: `${lang.nameDE} language`,
    });
  }

  // Sortierung: Sprecher absteigend, dann Name
  output.sort((a, b) => {
    const sa = a.attributes.speakersMillionsNative ?? 0;
    const sb = b.attributes.speakersMillionsNative ?? 0;
    if (sb !== sa) return sb - sa;
    return a.name.localeCompare(b.name, 'de');
  });

  writeJsonAtomic(OUT_PATH, output);

  console.log(`\n=== Ergebnis ===`);
  console.log(`Neue Sprachen gespeichert: ${output.length}`);
  console.log(`Übersprungen (kein Sprecher + keine Familie): ${skipped}`);
  console.log(`Ausgabe: ${OUT_PATH}`);
  console.log('\nErstausgabe (alle):');
  for (const lang of output) {
    const a = lang.attributes;
    console.log(`  ${lang.name} (${lang.sourceUrl.split('/').pop()}) — family=${a.family || '-'}, script=${a.script || '-'}, speakers=${a.speakersMillionsNative ?? '-'} Mio., officialIn=${a.officialIn ?? '-'}`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fataler Fehler:', err);
    process.exit(1);
  });
}
