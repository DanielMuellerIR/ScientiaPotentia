/**
 * wikidata_lingua_wd3.cjs
 *
 * Dritte WDQS-Ernte für Lingua-Sprachkonzepte (category: "language").
 * Neue Familien/Zweige (alle QIDs per WDQS-Zählabfrage verifiziert 2026-06-14):
 *
 *   - Slawisch:
 *       Ostslawisch (Q144713, 23 dewiki), Südslawisch (Q146665, 30 dewiki),
 *       Westslawisch (Q145852, 18 dewiki)
 *   - Westgermanisch (Q26721, 174 dewiki — mit Sprecherfilter genutzt)
 *   - Nordgermanisch via East Scandinavian (Q3090263, 12 dewiki)
 *   - Romanisch: Balkanromanisch (Q147576, 9) + Galician-Portuguese (Q9080204, 8)
 *   - Dravidisch (Q33311, 16) — Tamil/Telugu/Kannada/Malayalam schon in raw; andere ernten
 *   - Semitisch (Q34049, 138) — Arabisch/Hebräisch schon in raw
 *   - Mon-Khmer (Q337657, 21) — Vietnamesisch schon in raw
 *   - Southwestern Tai (Q10889250, 19)
 *   - Indoarisch: Bengali-Assamese (Q4179137, 11), Lechisch/polnische Gr. (Q742782, 18)
 *   - Einzelsprachen: gezielt ernten für Familien ohne genug P279*-Treffer
 *
 * Verworfene/nicht nutzbare QIDs:
 *   - Q7215 (Germanische Sprachen) → 0 Treffer mit P279* (WD modelliert anders)
 *   - Q8027 (Romanische Sprachen) → 0 Treffer (Überklasse, keine P279*-Kette)
 *   - Q33466 (Indoarische Spr.) → 0 Treffer (P31=Q34770 ohne P279* auch leer)
 *   - Q35772 (scheinbar Ibero-Roman.) → ist tatsächlich Manding-Sprachen, abgelehnt
 *   - Q36450 (Tai-Kadai gesamt) → 0 Treffer; Unter-Zweig Q10889250 funktioniert
 *   - Q46370 (Austroasiatisch) → 0 Treffer; Unter-Zweig Q337657 (Mon-Khmer) funktioniert
 *   - Q34296 (Sinotibetisch) → 0 Treffer; wd2 deckt bereits Q34064 (Tibeto-Burm.) ab
 *
 * Ausgabe: scripts/data_sources/harvest/lingua_wd3.json
 * KEIN Überschreiben von lingua_raw.json, lingua_wd1.json, lingua_wd2.json.
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_lingua_wd3.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Konfiguration ----------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (educational quiz; nfetzen@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS = 2000;
const MAX_RETRIES = 3;

const OUT_PATH = path.join(__dirname, 'lingua_wd3.json');
const RAW_PATH = path.join(__dirname, '..', 'lingua_raw.json');
const WD1_PATH = path.join(__dirname, 'lingua_wd1.json');
const WD2_PATH = path.join(__dirname, 'lingua_wd2.json');

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
  const REJECT = [
    'lateinisches schriftsystem',
    'lateinisches schrift',
    'lateinisch schriftsystem',
  ];
  if (REJECT.includes(s.toLowerCase())) return 'Lateinisches Alphabet';
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
    'gujarati-schrift':               'Gujarati-Schrift',
    'gurmukhi-schrift':               'Gurmukhi-Schrift',
    'gurmukhi':                       'Gurmukhi-Schrift',
    'thai-schrift':                   'Thailändische Schrift',
    'armenische schrift':             'Armenisches Alphabet',
    'tamilische schrift':             'Tamilische Schrift',
    'telugu-schrift':                 'Telugu-Schrift',
    'kannada-schrift':                'Kannada-Schrift',
    'odia-schrift':                   'Odia-Schrift',
    'khmer-schrift':                  'Khmer-Schrift',
    'lao-schrift':                    'Lao-Schrift',
    'singhalesisch':                  'Singhalesische Schrift',
    'bengalisches alphabet':          'Bengalisches Alphabet',
    'bengali-schrift':                'Bengalisches Alphabet',
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
    'Austroasiatisch':  'Austroasiatisch (Mon-Khmer)',
    'Isolat':           null,
  };
  if (topLabel in TOP_DIRECT) {
    return TOP_DIRECT[topLabel];
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

  // Afroasiatisch mit Zweig
  if (topLabel === 'Afroasiatisch') {
    if (branchLabel === 'Semitisch') return 'Afroasiatisch (Semitisch)';
    return 'Afroasiatisch';
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
// Alle familyQid-Werte per WDQS-Zählabfrage verifiziert (2026-06-14).

const LANG_GROUPS = [
  // Slawisch – Ostslawisch (Q144713: 23 dewiki-Sprachen)
  { topLabel: 'Indogermanisch', branchLabel: 'Slawisch', familyQid: 'Q144713', limit: 40 },
  // Slawisch – Südslawisch (Q146665: 30 dewiki-Sprachen)
  { topLabel: 'Indogermanisch', branchLabel: 'Slawisch', familyQid: 'Q146665', limit: 40 },
  // Slawisch – Westslawisch (Q145852: 18 dewiki-Sprachen)
  { topLabel: 'Indogermanisch', branchLabel: 'Slawisch', familyQid: 'Q145852', limit: 30 },
  // Westgermanisch (Q26721: 174 dewiki — enthält Dialekte;
  //   Sprecherschwelle im Post-Filter hält nur echte Sprachen)
  { topLabel: 'Indogermanisch', branchLabel: 'Germanisch', familyQid: 'Q26721', limit: 50 },
  // Nordgermanisch via East Scandinavian (Q3090263: 12 dewiki)
  { topLabel: 'Indogermanisch', branchLabel: 'Germanisch', familyQid: 'Q3090263', limit: 20 },
  // Romanisch – Balkanromanisch / Ostroromanisch (Q147576: 9 dewiki)
  { topLabel: 'Indogermanisch', branchLabel: 'Romanisch', familyQid: 'Q147576', limit: 15 },
  // Romanisch – Galicisch-Portugiesisch (Q9080204: 8 dewiki)
  { topLabel: 'Indogermanisch', branchLabel: 'Romanisch', familyQid: 'Q9080204', limit: 15 },
  // Indoarisch – Bengali-Assamese-Gruppe (Q4179137: 11 dewiki)
  { topLabel: 'Indogermanisch', branchLabel: 'Indo-Iranisch', familyQid: 'Q4179137', limit: 20 },
  // Indoarisch – Lechisch/polnische Gruppe (Q742782: 18 dewiki)
  { topLabel: 'Indogermanisch', branchLabel: 'Slawisch', familyQid: 'Q742782', limit: 20 },
  // Dravidisch (Q33311: 16 dewiki — Tamil/Telugu/Kannada/Malayalam schon in raw)
  { topLabel: 'Dravidisch', branchLabel: null, familyQid: 'Q33311', limit: 25 },
  // Afroasiatisch – Semitisch (Q34049: Arabisch/Hebräisch schon in raw; neue ernten)
  { topLabel: 'Afroasiatisch', branchLabel: 'Semitisch', familyQid: 'Q34049', limit: 40 },
  // Mon-Khmer (Q337657: 21 dewiki — Vietnamesisch schon in raw)
  { topLabel: 'Austroasiatisch', branchLabel: null, familyQid: 'Q337657', limit: 25 },
  // Southwestern Tai (Q10889250: 19 dewiki)
  { topLabel: 'Tai-Kadai', branchLabel: null, familyQid: 'Q10889250', limit: 25 },
];

// Einzel-Items: Sprachen, die über Gruppen-Queries evtl. nicht gefunden werden.
// Alle QIDs per WDQS-Sitelink-Suche verifiziert (2026-06-14).
const SINGLE_ITEMS = [
  // Germanisch
  { qid: 'Q14196', nameDE: 'Afrikaans',       family: 'Indogermanisch (Germanisch)' },
  { qid: 'Q9035',  nameDE: 'Dänisch',          family: 'Indogermanisch (Germanisch)' },
  { qid: 'Q9043',  nameDE: 'Norwegisch',        family: 'Indogermanisch (Germanisch)' },
  // Romanisch
  { qid: 'Q14185', nameDE: 'Okzitanisch',       family: 'Indogermanisch (Romanisch)' },
  { qid: 'Q33976', nameDE: 'Sardisch',          family: 'Indogermanisch (Romanisch)' },
  // Slawisch
  { qid: 'Q9056',  nameDE: 'Tschechisch',       family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q9058',  nameDE: 'Slowakisch',        family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q9063',  nameDE: 'Slowenisch',        family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q7918',  nameDE: 'Bulgarisch',        family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q9091',  nameDE: 'Belarussisch',      family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q9299',  nameDE: 'Serbisch',          family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q6654',  nameDE: 'Kroatisch',         family: 'Indogermanisch (Slawisch)' },
  // Dravidisch
  { qid: 'Q34251', nameDE: 'Tulu',              family: 'Dravidisch' },
  // Semitisch / Afroasiatisch
  { qid: 'Q9166',  nameDE: 'Maltesisch',        family: 'Afroasiatisch (Semitisch)' },
  // Mon-Khmer
  { qid: 'Q9205',  nameDE: 'Khmer',             family: 'Austroasiatisch (Mon-Khmer)' },
  // Tai-Kadai
  { qid: 'Q9211',  nameDE: 'Laotisch',          family: 'Tai-Kadai' },
  // Iranisch
  { qid: 'Q178440', nameDE: 'Dari',             family: 'Indogermanisch (Indo-Iranisch)' },
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
let wd2Data = [];
if (fs.existsSync(WD2_PATH)) {
  try { wd2Data = JSON.parse(fs.readFileSync(WD2_PATH, 'utf8')); }
  catch (e) { console.warn('wd2 nicht lesbar:', e.message); }
}

const existingIds   = new Set([
  ...rawData.filter(c => c.category === 'language').map(c => c.id),
  ...wd1Data.filter(c => c.category === 'language').map(c => c.id),
  ...wd2Data.filter(c => c.category === 'language').map(c => c.id),
]);
const existingNames = new Set([
  ...rawData.filter(c => c.category === 'language').map(c => normName(c.name)),
  ...wd1Data.filter(c => c.category === 'language').map(c => normName(c.name)),
  ...wd2Data.filter(c => c.category === 'language').map(c => normName(c.name)),
]);

console.log(`Dedup-Pool: ${existingIds.size} IDs, ${existingNames.size} Namen (raw + wd1 + wd2)`);

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
      // Wikidata gibt QID zurück wenn kein deutsches Label → überspringen
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
  console.log(`Übersprungen (kein Sprecher + kein Familie): ${skipped}`);
  console.log(`Ausgabe: ${OUT_PATH}`);
  console.log('\nErstausgabe (erste 20):');
  for (const lang of output.slice(0, 20)) {
    const a = lang.attributes;
    console.log(`  ${lang.name} (${lang.sourceUrl.split('/').pop()}) — family=${a.family || '-'}, script=${a.script || '-'}, speakers=${a.speakersMillionsNative ?? '-'} Mio., officialIn=${a.officialIn ?? '-'}`);
  }
}

main().catch(err => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
