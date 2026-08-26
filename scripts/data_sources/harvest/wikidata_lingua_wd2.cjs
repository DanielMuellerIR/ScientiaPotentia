/**
 * wikidata_lingua_wd2.cjs
 *
 * Zweite WDQS-Ernte für Lingua-Sprachkonzepte (category: "language").
 * Abgedeckte Familien (alle QIDs per Sitelink-Lookup verifiziert 2026-06-12):
 *   - Indogermanisch: Keltisch (Q25293), Baltisch (Q33136), Albanisch (Q8748)
 *   - Niger-Kongo: Mande (Q33681), Gur (Q33536), Kwa (Q33430)
 *   - Afroasiatisch: Kuschitisch (Q33248), Berber (Q25448)
 *   - Nilo-Saharanisch (Q33705)
 *   - Kartvelisch (Q34030)
 *   - Sinotibetisch: Tibeto-Burmanisch (Q34064)
 *   - Austronesisch / Malayo-Polynesisch (Q143158) — breiter, fängt weitere MP-Sprachen
 *   - Uralisch (Q34113)
 *   - Isolate: Baskisch (Q8752), Burushaski (weitere Sprachen-Isolate)
 *
 * Ausgabe: scripts/data_sources/harvest/lingua_wd2.json
 * KEIN Überschreiben von lingua_raw.json oder lingua_wd1.json.
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_lingua_wd2.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Konfiguration ----------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (public educational project)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS = 2000;
const MAX_RETRIES = 3;

const OUT_PATH = path.join(__dirname, 'lingua_wd2.json');
const RAW_PATH = path.join(__dirname, '..', 'lingua_raw.json');
const WD1_PATH = path.join(__dirname, 'lingua_wd1.json');

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
  // Offensichtlich falsche/zu generische Script-Labels verwerfen
  const REJECT = [
    'lateinisches schriftsystem',    // zu generisch, kein echter Bestand-String
    'lateinisches schrift',
    'lateinisch schriftsystem',
  ];
  if (REJECT.includes(s.toLowerCase())) return 'Lateinisches Alphabet';
  // Bestand-konforme Normierungen
  const MAP = {
    'lateinisches alphabet':          'Lateinisches Alphabet',
    'kyrillisches alphabet':          'Kyrillisches Alphabet',
    'arabisches alphabet':            'Arabisches Alphabet (Abjad)',
    'arabische schrift':              'Arabisches Alphabet (Abjad)',
    'hebräische schrift':             'Hebräische Schrift',
    'griechisches alphabet':          'Griechisches Alphabet',
    'georgisches alphabet':           'Georgisches Alphabet',
    'armenisches alphabet':           'Armenisches Alphabet',
    'tifinagh':                       'Tifinagh',
    'tifinaghschrift':                'Tifinagh',
    'devanagari':                     'Devanagari',
    'hangul':                         'Hangul',
    'äthiopische schrift':            'Äthiopische Schrift (Ge\'ez)',
    'äthiopische schrift (ge\'ez)':   'Äthiopische Schrift (Ge\'ez)',
    'ge\'ez-schrift':                 'Äthiopische Schrift (Ge\'ez)',
    'geez':                           'Äthiopische Schrift (Ge\'ez)',
    'lateinisches alphabet (nko-alphabet gemischt)': 'Lateinisches Alphabet',
    'n\'ko-alphabet':                 'N\'Ko-Alphabet',
    'singhalesische schrift':         'Singhalesische Schrift',
    'tibetische schrift':             'Tibetische Schrift',
    'birmanische schrift':            'Birmanische Schrift',
    'burmesische schrift':            'Birmanische Schrift',
    'myanmar-schrift':                'Birmanische Schrift',
  };
  const key = s.toLowerCase().replace(/\s+/g, ' ');
  return MAP[key] || s;
}

// --- Sprachfamilien-Mapping → Bestand-Strings -----------------------------
// Alle Werte müssen exakt den Strings in lingua_raw.json entsprechen.

function mapFamily(topLabel, branchLabel) {
  // Familien ohne Zweig-Differenzierung im Bestand
  const TOP_DIRECT = {
    'Turksprachen':     'Turksprachen',
    'Dravidisch':       'Dravidisch',
    'Tai-Kadai':        'Tai-Kadai',
    'Kartvelisch':      'Kartvelisch',
    'Nilo-Saharanisch': 'Nilo-Saharanisch',
    'Khoisan':          'Khoisan',
    'Uralisch':         'Uralisch',
    'Niger-Kongo':      'Niger-Kongo',
    'Afroasiatisch':    'Afroasiatisch',
    'Austronesisch':    'Austronesisch',
    'Sinotibetisch':    'Sinotibetisch',
    'Isolat':           null,    // kein Bestand-String für Isolate → weglassen
  };
  if (topLabel in TOP_DIRECT) {
    const v = TOP_DIRECT[topLabel];
    return v;  // kann null sein
  }

  // Indogermanisch mit Zweig
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

  // Austronesisch mit Zweig
  if (topLabel === 'Austronesisch') {
    if (branchLabel === 'Malayo-Polynesisch') return 'Austronesisch (Malayo-Polynesisch)';
    return 'Austronesisch';
  }

  // Sinotibetisch mit Zweig
  if (topLabel === 'Sinotibetisch') {
    if (branchLabel === 'Sinitisch') return 'Sinotibetisch (Sinitisch)';
    return 'Sinotibetisch';
  }

  return null;
}

// --- Gruppen-Definitionen ---------------------------------------------------
// Alle familyQid-Werte per enwiki-Sitelink verifiziert (2026-06-12).

const LANG_GROUPS = [
  // Indogermanisch – Keltisch
  { topLabel: 'Indogermanisch', branchLabel: 'Keltisch',   familyQid: 'Q25293', limit: 20 },
  // Indogermanisch – Baltisch
  { topLabel: 'Indogermanisch', branchLabel: 'Baltisch',   familyQid: 'Q33136', limit: 15 },
  // Niger-Kongo – Mande
  { topLabel: 'Niger-Kongo',    branchLabel: null,          familyQid: 'Q33681', limit: 20 },
  // Niger-Kongo – Gur
  { topLabel: 'Niger-Kongo',    branchLabel: null,          familyQid: 'Q33536', limit: 20 },
  // Niger-Kongo – Kwa
  { topLabel: 'Niger-Kongo',    branchLabel: null,          familyQid: 'Q33430', limit: 20 },
  // Afroasiatisch – Kuschitisch
  { topLabel: 'Afroasiatisch',  branchLabel: null,          familyQid: 'Q33248', limit: 20 },
  // Afroasiatisch – Berber/Tamazight
  { topLabel: 'Afroasiatisch',  branchLabel: null,          familyQid: 'Q25448', limit: 15 },
  // Nilo-Saharanisch
  { topLabel: 'Nilo-Saharanisch', branchLabel: null,        familyQid: 'Q33705', limit: 20 },
  // Kartvelisch
  { topLabel: 'Kartvelisch',    branchLabel: null,          familyQid: 'Q34030', limit: 10 },
  // Sinotibetisch – Tibeto-Burmanisch (ohne Sinitisch)
  { topLabel: 'Sinotibetisch',  branchLabel: null,          familyQid: 'Q34064', limit: 20 },
  // Austronesisch – Malayo-Polynesisch (breit — fängt auch nicht-MP)
  { topLabel: 'Austronesisch',  branchLabel: 'Malayo-Polynesisch', familyQid: 'Q143158', limit: 25 },
  // Uralisch
  { topLabel: 'Uralisch',       branchLabel: null,          familyQid: 'Q34113', limit: 25 },
];

// Einzelsprachen mit bekannten QIDs (Isolate und schwer via P279* erreichbare)
// family=null bedeutet: kein family-Attribut im Output
const SINGLE_ITEMS = [
  // Isolate
  { qid: 'Q8752',  nameDE: 'Baskisch',    family: null },
  { qid: 'Q8108',  nameDE: 'Georgisch',   family: 'Kartvelisch' }, // sauberer Einzel-Eintrag
  // Einzelne bekannte Sprachen die P279*-Query evtl. verpasst
  { qid: 'Q8748',  nameDE: 'Albanisch',   family: 'Indogermanisch' },
  { qid: 'Q33454', nameDE: 'Fula',        family: 'Niger-Kongo' },
  { qid: 'Q34257', nameDE: 'Wolof',       family: 'Niger-Kongo' },
  { qid: 'Q56475', nameDE: 'Hausa',       family: 'Afroasiatisch' },  // ggf. schon im raw
  { qid: 'Q13275', nameDE: 'Somali',      family: 'Afroasiatisch' },  // ggf. schon im raw
  { qid: 'Q33864', nameDE: 'Oromo',       family: 'Afroasiatisch' },
  { qid: 'Q34124', nameDE: 'Tigrinya',    family: 'Afroasiatisch (Semitisch)' },
  { qid: 'Q34302', nameDE: 'Tibetisch',   family: 'Sinotibetisch' },
  { qid: 'Q13199', nameDE: 'Birmanisch',  family: 'Sinotibetisch' },
  { qid: 'Q35891', nameDE: 'Dzongkha',    family: 'Sinotibetisch' },
  { qid: 'Q35500', nameDE: 'Lettisch',    family: 'Indogermanisch (Baltisch)' },
  { qid: 'Q9078',  nameDE: 'Litauisch',   family: 'Indogermanisch (Baltisch)' },
  { qid: 'Q9068',  nameDE: 'Irisch',      family: 'Indogermanisch (Keltisch)' },
  { qid: 'Q9058',  nameDE: 'Walisisch',   family: 'Indogermanisch (Keltisch)' },
  { qid: 'Q9072',  nameDE: 'Estnisch',    family: 'Uralisch' },
  { qid: 'Q34004', nameDE: 'Shona',       family: 'Niger-Kongo (Bantu)' },
  { qid: 'Q35876', nameDE: 'Guaraní',     family: 'Tupí-Guaraní' },   // eigene Familie
  { qid: 'Q33578', nameDE: 'Kongolesisch', family: 'Niger-Kongo (Bantu)' },
  { qid: 'Q35284', nameDE: 'Twi',         family: 'Niger-Kongo' },
  { qid: 'Q34138', nameDE: 'Bambara',     family: 'Niger-Kongo' },
];

// --- SPARQL-Query aufbauen --------------------------------------------------

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

function buildSingleQuery(qid) {
  return [
    'SELECT ?speakers ?scriptLabel',
    'WHERE {',
    '  OPTIONAL { wd:' + qid + ' wdt:P1098 ?speakers . }',
    '  OPTIONAL {',
    '    wd:' + qid + ' wdt:P282 ?script .',
    '    ?script rdfs:label ?scriptLabel .',
    '    FILTER(LANG(?scriptLabel) = "de")',
    '  }',
    '  FILTER EXISTS {',
    '    ?dw schema:about wd:' + qid + ' ;',
    '        schema:isPartOf <https://de.wikipedia.org/> .',
    '  }',
    '}',
    'LIMIT 5',
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

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
let wd1Data = [];
if (fs.existsSync(WD1_PATH)) {
  try { wd1Data = JSON.parse(fs.readFileSync(WD1_PATH, 'utf8')); }
  catch (e) { console.warn('wd1 nicht lesbar:', e.message); }
}

const existingIds   = new Set([
  ...rawData.filter(c => c.category === 'language').map(c => c.id),
  ...wd1Data.filter(c => c.category === 'language').map(c => c.id),
]);
const existingNames = new Set([
  ...rawData.filter(c => c.category === 'language').map(c => normName(c.name)),
  ...wd1Data.filter(c => c.category === 'language').map(c => normName(c.name)),
]);

console.log(`Dedup-Pool: ${existingIds.size} IDs, ${existingNames.size} Namen (raw + wd1)`);
console.log('Bekannte IDs:', [...existingIds].sort().join(', '));

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
      console.warn(`  FEHLER: ${e.message} — überspringe`);
      await sleep(MIN_DELAY_MS);
      continue;
    }

    const bindings = data.results?.bindings || [];
    console.log(`  ${bindings.length} Treffer`);
    let added = 0, deduped = 0;

    for (const row of bindings) {
      const qid    = row.lang?.value?.replace('http://www.wikidata.org/entity/', '');
      const nameDE = row.langLabel?.value;
      if (!qid || !nameDE) continue;
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
      const data = await sparqlQuery(buildSingleQuery(item.qid));
      const bindings = data.results?.bindings || [];
      if (bindings.length === 0) {
        console.log('    Kein dewiki-Sitelink oder keine Daten');
        await sleep(MIN_DELAY_MS);
        continue;
      }
      const row = bindings[0];
      const speakersRaw = row.speakers?.value ? Number(row.speakers.value) : null;
      const speakersM = (speakersRaw && isFinite(speakersRaw) && speakersRaw > 0)
        ? Math.round(speakersRaw / 1e5) / 10
        : null;
      const script = normalizeScript(row.scriptLabel?.value);

      // Nur aufnehmen wenn Familie oder Sprecher vorhanden
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
      console.warn(`    FEHLER: ${e.message}`);
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
      console.warn(`  officialIn FEHLER ${lang.nameDE}: ${e.message}`);
    }
    await sleep(MIN_DELAY_MS);
  }

  // --- Ausgabe aufbauen ---------------------------------------------------

  const output = [];
  let skipped = 0;

  for (const lang of results.values()) {
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

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n=== Ergebnis ===`);
  console.log(`Neue Sprachen gespeichert: ${output.length}`);
  console.log(`Übersprungen: ${skipped}`);
  console.log(`Ausgabe: ${OUT_PATH}`);
  console.log('\nErstausgabe (erste 15):');
  for (const lang of output.slice(0, 15)) {
    const a = lang.attributes;
    console.log(`  ${lang.name} (${lang.sourceUrl.split('/').pop()}) — family=${a.family || '-'}, script=${a.script || '-'}, speakers=${a.speakersMillionsNative ?? '-'} Mio., officialIn=${a.officialIn ?? '-'}`);
  }
}

main().catch(err => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
