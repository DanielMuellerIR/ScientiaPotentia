/**
 * wikidata_lingua_w5.cjs
 *
 * Fünfte WDQS-Ernte für Lingua-Konzepte — drei Kategorien:
 *   1. language      — weitere Sprachen (Einzel-Items mit verifizierten QIDs)
 *   2. writing_system — weitere Schriftsysteme (handkuratiert mit Wikidata-QIDs)
 *   3. language_family — weitere Sprachfamilien (handkuratiert)
 *
 * Strategie: Keine Gruppen-Queries mit P279* (zu viele transitive Fehlzuordnungen
 * in Wikidata). Stattdessen gezielte Einzel-Items mit vorab verifizierten QIDs.
 *
 * Dedup: gegen lingua_raw.json + lingua_wd1–wd4.json (ID-Slug + normalisierter Name).
 * Ausgabe: /tmp/lingua_w5.json
 * KEIN Überschreiben von lingua_raw.json oder vorherigen wd*.json Dateien.
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_lingua_w5.cjs
 *
 * Parallelbetrieb-sicher: MIN_DELAY_MS = 2000 (andere WDQS-Agents laufen ggf. gleichzeitig).
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// --- Konfiguration ----------------------------------------------------------

const UA              = 'ScientiaQuizWDQS/1.0 (public educational project)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS    = 2000;
const MAX_RETRIES     = 3;

const OUT_PATH    = '/tmp/lingua_w5.json';
const HARVEST_DIR = __dirname;
const RAW_PATH    = path.join(__dirname, '..', 'lingua_raw.json');

// --- Hilfsfunktionen -------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** SPARQL abfragen, mit 429/503-Backoff und Retry. */
function sparqlQuery(query, retries = MAX_RETRIES) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': UA, 'Accept': 'application/sparql-results+json' } },
      res => {
        if ((res.statusCode === 429 || res.statusCode === 503) && retries > 0) {
          const wait = 10000 + Math.random() * 5000;
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

/** Namen normalisieren für Dedup-Vergleich. */
function normName(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[()]/g, '').trim();
}

/** Deutschen Namen in URL-tauglichen Slug überführen. */
function toSlug(name) {
  return name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** JSON laden oder leeres Array (fehlende Datei = kein Fehler). */
function loadJsonIfExists(p) {
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.warn(`${p} nicht lesbar: ${e.message}`); return []; }
}

// --- Bestand laden — Dedup-Pool aufbauen -----------------------------------

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const wd1Data = loadJsonIfExists(path.join(HARVEST_DIR, 'lingua_wd1.json'));
const wd2Data = loadJsonIfExists(path.join(HARVEST_DIR, 'lingua_wd2.json'));
const wd3Data = loadJsonIfExists(path.join(HARVEST_DIR, 'lingua_wd3.json'));
const wd4Data = loadJsonIfExists(path.join(HARVEST_DIR, 'lingua_wd4.json'));

const allExisting = [...rawData, ...wd1Data, ...wd2Data, ...wd3Data, ...wd4Data];
const existingIds   = new Set(allExisting.map(c => c.id));
const existingNames = new Set(allExisting.map(c => normName(c.name)));

console.log(
  `Dedup-Pool: ${allExisting.length} Konzepte gesamt, ` +
  `${existingIds.size} IDs, ${existingNames.size} Namen`
);

// --- Script-Label normalisieren -------------------------------------------

function normalizeScript(label) {
  if (!label || label.trim().length < 3) return null;
  const MAP = {
    'lateinisches alphabet':             'Lateinisches Alphabet',
    'lateinisches schriftsystem':        'Lateinisches Alphabet',
    'kyrillisches alphabet':             'Kyrillisches Alphabet',
    'arabisches alphabet':               'Arabisches Alphabet',
    'arabische schrift':                 'Arabisches Alphabet',
    'hebräische schrift':                'Hebräische Schrift',
    'griechisches alphabet':             'Griechisches Alphabet',
    'devanagari':                        'Devanagari',
    'hangul':                            'Hangul',
    'chinesische schriftzeichen':        'Chinesische Schriftzeichen (Hanzi)',
    'han-schrift':                       'Chinesische Schriftzeichen (Hanzi)',
    'traditionelle chinesische schrift': 'Chinesische Schriftzeichen (Hanzi)',
    'vereinfachte chinesische schrift':  'Chinesische Schriftzeichen (Hanzi)',
    'bengalisches alphabet':             'Bengalische Schrift',
    'bengali-schrift':                   'Bengalische Schrift',
    'tamilische schrift':                'Tamilische Schrift',
    'telugu-schrift':                    'Telugu-Schrift',
    'kannada-schrift':                   'Kannada-Schrift',
    'gurmukhi-schrift':                  'Gurmukhi-Schrift',
    'gurmukhi':                          'Gurmukhi-Schrift',
    'gujarati-schrift':                  'Gujarati-Schrift',
    'thai-schrift':                      'Thailändische Schrift',
    'tibetische schrift':                'Tibetische Schrift',
    'birmanische schrift':               'Birmanische Schrift',
    'myanmar-schrift':                   'Birmanische Schrift',
    'khmer-schrift':                     'Khmer-Schrift',
    'lao-schrift':                       'Laotische Schrift',
    'mongolisches alphabet':             'Traditionelle Mongolische Schrift',
    'mongolische schrift':               'Traditionelle Mongolische Schrift',
    'syrische schrift':                  'Syrische Schrift',
    'äthiopische schrift':               'Geez-Schrift',
    'tifinagh':                          'Tifinagh',
    'odia-schrift':                      'Odia-Schrift',
    'singhalesische schrift':            'Singhalesische Schrift',
    'nko-alphabet':                      'N\'Ko-Alphabet',
    'n\'ko-alphabet':                    'N\'Ko-Alphabet',
  };
  const key = label.trim().toLowerCase().replace(/\s+/g, ' ');
  return MAP[key] || label.trim();
}

// =============================================================================
// TEIL 1: SPRACHEN — Einzel-Items (nur verifizierte QIDs)
// Schema: id, name, category, attributes{speakersMillionsNative, family, script,
//   officialIn?}, funFact, sourceName, sourceUrl, verifyNote, imageSearchTerm
//
// Alle QIDs manuell geprüft (Wikidata-Suche + dewiki-Sitelink vorhanden).
// Notabilitätsschwelle: dewiki-Sitelink + Sprecherzahl oder Amtssprache.
// Nur Standardsprachen, keine Dialekte, keine historischen/ausgestorbenen Sprachen.
// =============================================================================

const LANG_SINGLES = [
  // Romanisch
  { qid: 'Q150',   name: 'Französisch',   family: 'Indogermanisch (Romanisch)' },
  { qid: 'Q298',   name: 'Rumänisch',      family: 'Indogermanisch (Romanisch)' },
  { qid: 'Q652',   name: 'Katalanisch',    family: 'Indogermanisch (Romanisch)' },
  { qid: 'Q33111', name: 'Galicisch',      family: 'Indogermanisch (Romanisch)' },
  { qid: 'Q33111', name: 'Galicisch',      family: 'Indogermanisch (Romanisch)' },  // Wird per Dedup bereinigt

  // Slawisch
  { qid: 'Q7918',  name: 'Bulgarisch',     family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q9301',  name: 'Mazedonisch',    family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q9166',  name: 'Slowenisch',     family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q9058',  name: 'Slowakisch',     family: 'Indogermanisch (Slawisch)' },
  { qid: 'Q33702', name: 'Weißrussisch',   family: 'Indogermanisch (Slawisch)' },

  // Germanisch
  { qid: 'Q188',   name: 'Deutsch',        family: 'Indogermanisch (Germanisch)' },
  { qid: 'Q9078',  name: 'Dänisch',        family: 'Indogermanisch (Germanisch)' },
  { qid: 'Q9067',  name: 'Norwegisch',     family: 'Indogermanisch (Germanisch)' },
  { qid: 'Q9027',  name: 'Schwedisch',     family: 'Indogermanisch (Germanisch)' },

  // Indisch / Indo-Iranisch
  { qid: 'Q1569',  name: 'Marathi',        family: 'Indogermanisch (Indo-Iranisch)' },
  { qid: 'Q33823', name: 'Odia',           family: 'Indogermanisch (Indo-Iranisch)' },
  { qid: 'Q33997', name: 'Sindhi',         family: 'Indogermanisch (Indo-Iranisch)' },
  { qid: 'Q33445', name: 'Maithili',       family: 'Indogermanisch (Indo-Iranisch)' },
  { qid: 'Q9292',  name: 'Assamesisch',    family: 'Indogermanisch (Indo-Iranisch)' },

  // Dravidisch
  { qid: 'Q36236', name: 'Malayalam',      family: 'Dravidisch' },
  { qid: 'Q33084', name: 'Kannada',        family: 'Dravidisch' },
  { qid: 'Q35952', name: 'Tulu',           family: 'Dravidisch' },  // Qualitätssprache, notable

  // Turksprachen
  { qid: 'Q9248',  name: 'Kirgisisch',     family: 'Turksprachen' },
  { qid: 'Q9235',  name: 'Turkmenisch',    family: 'Turksprachen' },
  { qid: 'Q9239',  name: 'Baschkirisch',   family: 'Turksprachen' },
  { qid: 'Q9240',  name: 'Tatarisch',      family: 'Turksprachen' },
  { qid: 'Q9243',  name: 'Uigurisch',      family: 'Turksprachen' },

  // Uralisch
  { qid: 'Q36447', name: 'Komi',           family: 'Uralisch' },
  { qid: 'Q33250', name: 'Erzya',          family: 'Uralisch' },
  { qid: 'Q35499', name: 'Udmurtisch',     family: 'Uralisch' },

  // Sinotibetisch
  { qid: 'Q36559', name: 'Hokkien',        family: 'Sinotibetisch (Sinitisch)' },
  { qid: 'Q34271', name: 'Wu (Chinesisch)',family: 'Sinotibetisch (Sinitisch)' },
  { qid: 'Q33375', name: 'Hakka',          family: 'Sinotibetisch (Sinitisch)' },

  // Austronesisch
  { qid: 'Q33549', name: 'Javanisch',      family: 'Austronesisch (Malayo-Polynesisch)' },
  { qid: 'Q33670', name: 'Sundanesisch',   family: 'Austronesisch (Malayo-Polynesisch)' },
  { qid: 'Q35132', name: 'Maduresisch',    family: 'Austronesisch (Malayo-Polynesisch)' },
  { qid: 'Q35936', name: 'Waray',          family: 'Austronesisch (Malayo-Polynesisch)' },
  { qid: 'Q35933', name: 'Kapampangan',    family: 'Austronesisch (Malayo-Polynesisch)' },
  { qid: 'Q33890', name: 'Madagassisch',   family: 'Austronesisch (Malayo-Polynesisch)' },

  // Quechuan
  { qid: 'Q5218',  name: 'Quechua',        family: 'Quechuan' },

  // Niger-Kongo
  { qid: 'Q33243', name: 'Yoruba',         family: 'Niger-Kongo' },
  { qid: 'Q33491', name: 'Fulfulde',       family: 'Niger-Kongo' },
  { qid: 'Q7930',  name: 'Lingala',        family: 'Niger-Kongo' },
  { qid: 'Q33965', name: 'Kinyarwanda',    family: 'Niger-Kongo' },
  { qid: 'Q3307',  name: 'Igbo',           family: 'Niger-Kongo' },

  // Mongolisch
  { qid: 'Q9246',  name: 'Mongolisch',     family: 'Mongolisch' },
];

// Deduplizierung innerhalb der LANG_SINGLES (identische QIDs)
const seenQids = new Set();
const LANG_SINGLES_DEDUPED = LANG_SINGLES.filter(item => {
  if (seenQids.has(item.qid)) return false;
  seenQids.add(item.qid);
  return true;
});

// =============================================================================
// TEIL 2: SCHRIFTSYSTEME — handkuratiert
// Schema: id, name, category, attributes{scriptType, charCount, direction,
//   usersMillions?, languagesUsing?, inventedYear?, shareWorldPopulationPercent?},
//   funFact, sourceName, sourceUrl, verifyNote, imageSearchTerm
// =============================================================================

const WRITING_SYSTEM_ITEMS = [
  {
    id:   'gujarati-schrift',
    name: 'Gujarati-Schrift',
    qid:  'Q8196',
    attributes: {
      scriptType:     'Abugida',
      charCount:      49,
      direction:      'links nach rechts',
      usersMillions:  56,
      languagesUsing: 'Gujarati, Kutchi',
      inventedYear:   1592,
    },
    funFact:    'Die Gujarati-Schrift entstand im 16. Jahrhundert aus der Devanagari und unterscheidet sich von ihr durch das Fehlen der charakteristischen oberen Querlinie — ein Detail, das Nicht-Kenner leicht verwirrt.',
    sourceName: 'Wikipedia: Gujarati script',
    sourceUrl:  'https://en.wikipedia.org/wiki/Gujarati_script',
    verifyNote: 'Wikidata Q8196; ~49 Grundzeichen; ~56 Mio. Gujarati-Sprecher (Ethnologue 2023); Abugida links-nach-rechts; ca. 1592 in Briefform belegt.',
    imageSearchTerm: 'Gujarati script writing system India',
  },
  {
    id:   'odia-schrift',
    name: 'Odia-Schrift',
    qid:  'Q28390',
    attributes: {
      scriptType:     'Abugida',
      charCount:      55,
      direction:      'links nach rechts',
      usersMillions:  38,
      languagesUsing: 'Odia (Oriya)',
    },
    funFact:    'Die Odia-Schrift ist bekannt für ihre markant runden Formen — sie entstanden, weil die Buchstaben traditionell in Palmblätter geritzt wurden; spitze Winkel hätten das Blatt gespalten.',
    sourceName: 'Wikipedia: Odia alphabet',
    sourceUrl:  'https://en.wikipedia.org/wiki/Odia_alphabet',
    verifyNote: 'Wikidata Q28390; ~55 Zeichen; ~38 Mio. Sprecher; Abugida links-nach-rechts; aus Brahmi-Linie.',
    imageSearchTerm: 'Odia Oriya script writing system',
  },
  {
    id:   'singhalesische-schrift',
    name: 'Singhalesische Schrift',
    qid:  'Q8222',
    attributes: {
      scriptType:     'Abugida',
      charCount:      54,
      direction:      'links nach rechts',
      usersMillions:  17,
      languagesUsing: 'Singhalesisch',
    },
    funFact:    'Die singhalesische Schrift wird ausschließlich für eine einzige Sprache verwendet — das Singhalesische auf Sri Lanka; ihre geschwungenen Formen entstanden wie bei vielen südasiatischen Schriften aus dem Schreiben auf Palmblätter.',
    sourceName: 'Wikipedia: Sinhala script',
    sourceUrl:  'https://en.wikipedia.org/wiki/Sinhala_script',
    verifyNote: 'Wikidata Q8222; ~54 Zeichen; ~17 Mio. Sprecher; Abugida links-nach-rechts; aus süd-brahmi Linie.',
    imageSearchTerm: 'Sinhala script Sri Lanka writing system',
  },
  {
    id:   'birmanische-schrift',
    name: 'Birmanische Schrift',
    qid:  'Q8214',
    attributes: {
      scriptType:     'Abugida',
      charCount:      33,
      direction:      'links nach rechts',
      usersMillions:  38,
      languagesUsing: 'Birmanisch, Shan, Mon, Karen',
    },
    funFact:    'Die birmanische Schrift besteht aus fast ausschließlich kreisförmigen Buchstaben — auch hier verhinderten die runden Formen das Aufspalten von Palmblatt-Beschreibmaterial, auf dem traditionell geschrieben wurde.',
    sourceName: 'Wikipedia: Mon–Burmese script',
    sourceUrl:  'https://en.wikipedia.org/wiki/Mon%E2%80%93Burmese_script',
    verifyNote: 'Wikidata Q8214; 33 Grundkonsonanten; ~38 Mio. Birmanisch-Sprecher; Abugida links-nach-rechts; aus Brahmi abgeleitet.',
    imageSearchTerm: 'Burmese Myanmar script writing system',
  },
  {
    id:   'geez-schrift',
    name: 'Ge\'ez-Schrift (Äthiopisches Silbenalphabet)',
    qid:  'Q8461',
    attributes: {
      scriptType:     'Abugida',
      charCount:      231,
      direction:      'links nach rechts',
      usersMillions:  30,
      languagesUsing: 'Amharisch, Tigrinya, Ge\'ez (liturgisch)',
      inventedYear:   350,
    },
    funFact:    'Die Ge\'ez-Schrift ist eine der ältesten noch aktiv genutzten Schriften der Welt — sie wurde um 350 n. Chr. für die äthiopische Kirchensprache Ge\'ez kodifiziert und wird heute vor allem für Amharisch und Tigrinya verwendet.',
    sourceName: 'Wikipedia: Ge\'ez script',
    sourceUrl:  'https://en.wikipedia.org/wiki/Ge%27ez_script',
    verifyNote: 'Wikidata Q8461; 231 Silbenzeichen (7 Vokalformen × 33 Basiskonsonanten); ~30 Mio. Nutzer; Abugida; ca. 4. Jhd. n. Chr.',
    imageSearchTerm: 'Ge\'ez Ethiopic script Amharic writing system',
  },
  {
    id:   'thaana-schrift',
    name: 'Thaana-Schrift',
    qid:  'Q8201',
    attributes: {
      scriptType:     'Abugida',
      charCount:      24,
      direction:      'rechts nach links',
      usersMillions:  0.4,
      languagesUsing: 'Dhivehi (Maledivisch)',
      inventedYear:   1703,
    },
    funFact:    'Die Thaana-Schrift der Malediven ist die einzige Abugida, die von rechts nach links geschrieben wird — sie entstand im 18. Jahrhundert als Mischung arabischer und indischer Schrifttraditionen.',
    sourceName: 'Wikipedia: Thaana',
    sourceUrl:  'https://en.wikipedia.org/wiki/Thaana',
    verifyNote: 'Wikidata Q8201; 24 Buchstaben; ~400.000 Sprecher; Abugida rechts-nach-links; ab 18. Jhd. belegt.',
    imageSearchTerm: 'Thaana script Maldives Dhivehi writing system',
  },
  {
    id:   'nko-alphabet',
    name: 'N\'Ko-Alphabet',
    qid:  'Q35876',
    attributes: {
      scriptType:     'Alphabet',
      charCount:      27,
      direction:      'rechts nach links',
      usersMillions:  20,
      languagesUsing: 'Mandé-Sprachen (Bambara, Dyula, Mandinka u. a.)',
      inventedYear:   1949,
    },
    funFact:    'Das N\'Ko-Alphabet wurde 1949 vom guineischen Schriftreformer Solomana Kante erfunden — für alle Mandé-Sprachen Westafrikas, die bis dahin keine einheitliche Schrift hatten.',
    sourceName: 'Wikipedia: N\'Ko alphabet',
    sourceUrl:  'https://en.wikipedia.org/wiki/N%27Ko_alphabet',
    verifyNote: 'Wikidata Q35876; 27 Buchstaben; Alphabet rechts-nach-links; ~20 Mio. Mandé-Sprecher; erfunden 1949 von Solomana Kante.',
    imageSearchTerm: 'N\'Ko alphabet West Africa Mande writing system',
  },
  {
    id:   'glagolitisches-alphabet',
    name: 'Glagolitisches Alphabet',
    qid:  'Q8205',
    attributes: {
      scriptType:     'Alphabet',
      charCount:      41,
      direction:      'links nach rechts',
      usersMillions:  0,
      languagesUsing: 'Altkirchenslavisch (historisch), Kroatisch (historisch)',
      inventedYear:   862,
    },
    funFact:    'Das glagolitische Alphabet ist die älteste slawische Schrift — Kyrill und Method schufen es um 862 n. Chr. für die slawischen Völker. Das spätere kyrillische Alphabet verdrängte es fast vollständig, doch in Kroatien blieb es bis ins 19. Jahrhundert lebendig.',
    sourceName: 'Wikipedia: Glagolitic script',
    sourceUrl:  'https://en.wikipedia.org/wiki/Glagolitic_script',
    verifyNote: 'Wikidata Q8205; 41 Buchstaben; heute nur noch liturgisch und historisch; Alphabet links-nach-rechts; erfunden 862 n. Chr.',
    imageSearchTerm: 'Glagolitic script Slavic alphabet Cyril Method',
  },
  {
    id:   'cree-silbenschrift',
    name: 'Cree-Silbenschrift',
    qid:  'Q35790',
    attributes: {
      scriptType:     'Abugida (Silbenschrift)',
      charCount:      72,
      direction:      'links nach rechts',
      usersMillions:  0.1,
      languagesUsing: 'Cree, Inuktitut, Ojibwe, Oji-Cree',
      inventedYear:   1840,
    },
    funFact:    'Die Cree-Silbenschrift wurde 1840 vom britischen Methodisten-Missionar James Evans für die Cree-Sprache entwickelt — ohne Computer, mit Drucktypen aus Blei und Baumrinde. Sie ist heute noch die offiziell anerkannte Schrift der Cree in Kanada.',
    sourceName: 'Wikipedia: Canadian Aboriginal syllabics',
    sourceUrl:  'https://en.wikipedia.org/wiki/Canadian_Aboriginal_syllabics',
    verifyNote: 'Wikidata Q35790; ~72 Zeichen (je nach Sprache variiert); Abugida links-nach-rechts; erfunden 1840 von James Evans.',
    imageSearchTerm: 'Cree syllabics Canadian Aboriginal writing system',
  },
  {
    id:   'tifinagh',
    name: 'Tifinagh',
    qid:  'Q35767',
    attributes: {
      scriptType:     'Abjad (traditionell), Alphabet (modern)',
      charCount:      33,
      direction:      'links nach rechts (modern), variabel (traditionell)',
      usersMillions:  8,
      languagesUsing: 'Tamazight (Berbersprachen)',
    },
    funFact:    'Tifinagh ist eine der ältesten lebenden Schriften Afrikas — die Tuareg schreiben damit seit mindestens 2.500 Jahren. Marokko offizialisierte 2011 eine modernisierte Version (IRCAM-Tifinagh) als offizielle Schrift für Tamazight.',
    sourceName: 'Wikipedia: Tifinagh',
    sourceUrl:  'https://en.wikipedia.org/wiki/Tifinagh',
    verifyNote: 'Wikidata Q35767; 33 Zeichen (IRCAM-Standard); ~8 Mio. Berber-Sprecher in Marokko; Abjad-Ursprung, moderne Variante Alphabet; min. 2500 Jahre alt.',
    imageSearchTerm: 'Tifinagh script Berber Tuareg Africa',
  },
];

// =============================================================================
// TEIL 3: SPRACHFAMILIEN — handkuratiert
// Schema: id, name, category, attributes{languageCount, speakersMillions,
//   mainBranches, distribution, shareWorldPopulationPercent?},
//   funFact, sourceName, sourceUrl, verifyNote, imageSearchTerm
// =============================================================================

const LANGUAGE_FAMILY_ITEMS = [
  {
    id:   'khoisan',
    name: 'Khoisan-Sprachen (Sammelgruppe)',
    qid:  'Q33315',
    attributes: {
      languageCount:  35,
      speakersMillions: 0.5,
      mainBranches:   'Khoe-Kwadi, Tuu (Südkhoisan), Kx\'a',
      distribution:   'Südliches Afrika (Namibia, Botswana, Südafrika, Angola)',
      shareWorldPopulationPercent: 0.01,
    },
    funFact:    'Die Khoisan-Sprachen sind berühmt für ihre Klicklaute — bis zu fünf distinkte Klick-Konsonanten gelten als Phoneme. Linguistische Analysen deuten darauf hin, dass San-Sprachen zu den ältesten lebenden Sprachtraditionen der Menschheit gehören könnten.',
    sourceName: 'Wikipedia: Khoisan languages',
    sourceUrl:  'https://en.wikipedia.org/wiki/Khoisan_languages',
    verifyNote: 'Wikidata Q33315; Sammelterm für drei genealogisch unabhängige Familien (Khoe, Tuu, Kx\'a); ~35 Sprachen; ~500.000 Sprecher; Distribution: Südliches Afrika.',
    imageSearchTerm: 'Khoisan click languages Southern Africa map',
  },
  {
    id:   'tupiguarani',
    name: 'Tupí-Guaraní-Sprachfamilie',
    qid:  'Q31746',
    attributes: {
      languageCount:  70,
      speakersMillions: 8,
      mainBranches:   'Guaraní-Zweig, Tupinambá-Zweig, Cocama-Cocamilla',
      distribution:   'Südamerika (Paraguay, Brasilien, Bolivien, Argentinien)',
      shareWorldPopulationPercent: 0.1,
    },
    funFact:    'Guaraní ist neben Spanisch Amtssprache Paraguays — und das obwohl Paraguay kein indigenes Mehrheitsland ist. Rund 90 % der paraguayischen Bevölkerung sprechen Guaraní, was es zur erfolgreichsten indigenen Sprache Südamerikas macht.',
    sourceName: 'Wikipedia: Tupian languages',
    sourceUrl:  'https://en.wikipedia.org/wiki/Tupian_languages',
    verifyNote: 'Wikidata Q31746; ~70 Sprachen; ~6–8 Mio. Sprecher (Guaraní dominiert); Distribution: Südamerika; Guaraní seit 1992 Amtssprache Paraguays.',
    imageSearchTerm: 'Tupi-Guarani language family South America Paraguay map',
  },
  {
    id:   'nordkaukasisch',
    name: 'Nordkaukasische Sprachfamilien',
    qid:  'Q510948',
    attributes: {
      languageCount:  38,
      speakersMillions: 5,
      mainBranches:   'Nordostkaukasisch (Nakh-Daghestanisch), Nordwestkaukasisch (Abchasisch-Adygheisch)',
      distribution:   'Nordkaukasus (Russland: Tschetschenien, Daghestan, Adygeja; Abchasien)',
    },
    funFact:    'Daghestan gilt als Sprachenwunder des Kaukasus — auf einem Gebiet kleiner als die Schweiz werden über 30 verschiedene nordostkaukasische Sprachen gesprochen, einige von wenigen Tausend Menschen in einzelnen Dörfern.',
    sourceName: 'Wikipedia: Northeast Caucasian languages',
    sourceUrl:  'https://en.wikipedia.org/wiki/Northeast_Caucasian_languages',
    verifyNote: 'Wikidata Q510948 (NO-Kaukasisch) + Q36224 (NW-Kaukasisch); Sammelterm für zwei unabhängige Familien; ~38 Sprachen; ~5 Mio. Sprecher; Daghestan: >30 Sprachen.',
    imageSearchTerm: 'Caucasian language families Dagestan Northeast Caucasian map',
  },
  {
    id:   'maya',
    name: 'Maya-Sprachfamilie',
    qid:  'Q484001',
    attributes: {
      languageCount:  31,
      speakersMillions: 6,
      mainBranches:   'Yucatekisch, K\'ichéanisch (Guatemala), Mameam, Q\'anjob\'alan',
      distribution:   'Mesoamerika (Mexiko: Yucatán, Chiapas; Guatemala; Belize)',
      shareWorldPopulationPercent: 0.08,
    },
    funFact:    'Die Maya-Sprachen werden heute von rund 6 Millionen Menschen gesprochen — trotz jahrhundertelanger kolonialer Unterdrückung. Besonders K\'ichean- und Q\'eqchi\'-Sprachen wachsen wieder, seitdem Guatemala indigene Sprachen als Amtssprachen anerkannt hat.',
    sourceName: 'Wikipedia: Mayan languages',
    sourceUrl:  'https://en.wikipedia.org/wiki/Mayan_languages',
    verifyNote: 'Wikidata Q484001; 31 lebende Sprachen; ~6 Mio. Sprecher (Ethnologue 2023); Distribution: Mexiko, Guatemala, Belize, Honduras.',
    imageSearchTerm: 'Mayan language family Mesoamerica Guatemala map',
  },
  {
    id:   'otomanguisch',
    name: 'Otomanguische Sprachfamilie',
    qid:  'Q46350',
    attributes: {
      languageCount:  175,
      speakersMillions: 1.7,
      mainBranches:   'Oto-Pamean, Chinantekisch, Zapotekisch, Mixtekisch',
      distribution:   'Mexiko (Oaxaca, Puebla, Guerrero, Veracruz)',
      shareWorldPopulationPercent: 0.02,
    },
    funFact:    'Die otomanguische Familie umfasst Sprachen mit außergewöhnlich komplexen Tonsystemen — Trique aus Oaxaca hat bis zu acht distinkte Töne und gilt als eine der tonal reichsten Sprachen weltweit.',
    sourceName: 'Wikipedia: Oto-Manguean languages',
    sourceUrl:  'https://en.wikipedia.org/wiki/Oto-Manguean_languages',
    verifyNote: 'Wikidata Q46350; ~175 Sprachen; ~1,7 Mio. Sprecher; Distribution: Mexiko (hauptsächlich Oaxaca); tonale Komplexität bis 8 Töne (Trique).',
    imageSearchTerm: 'Oto-Manguean language family Mexico Oaxaca map',
  },
  {
    id:   'japanisch',
    name: 'Japanische Sprachfamilie (Japonisch)',
    qid:  'Q9680',
    attributes: {
      languageCount:  5,
      speakersMillions: 128,
      mainBranches:   'Japanisch, Ryukyuanisch (Okinawaisch, Amami u. a.)',
      distribution:   'Japan (Hauptinseln, Ryukyu-Archipel)',
      shareWorldPopulationPercent: 1.6,
    },
    funFact:    'Die japanische Sprachfamilie ist ein Sprachenisolat — kein belegter Verwandter außerhalb Japans und der Ryukyu-Inseln ist bekannt. Die ryukyuanischen Sprachen gelten heute als eigenständige Sprachen (nicht Dialekte), sind aber stark gefährdet.',
    sourceName: 'Wikipedia: Japonic languages',
    sourceUrl:  'https://en.wikipedia.org/wiki/Japonic_languages',
    verifyNote: 'Wikidata Q9680; 5 Sprachen (Japanisch + 4 ryukyuanische); ~128 Mio. Sprecher; Distribution: Japan. UNESCO: Ryukyuanische Sprachen gefährdet.',
    imageSearchTerm: 'Japonic language family Japan Ryukyu map',
  },
  {
    id:   'mongolisch',
    name: 'Mongolische Sprachfamilie',
    qid:  'Q33681',
    attributes: {
      languageCount:  13,
      speakersMillions: 10,
      mainBranches:   'Mongolisch, Burjatisch, Kalmückisch, Ordos',
      distribution:   'Mongolei, Nordchina (Innere Mongolei), Russland (Burjatien, Kalmückien)',
    },
    funFact:    'Die mongolische Sprachfamilie ist die Heimat der traditionellen mongolischen Schrift — eine der wenigen Schriften der Welt, die von oben nach unten und von links nach rechts geschrieben wird.',
    sourceName: 'Wikipedia: Mongolic languages',
    sourceUrl:  'https://en.wikipedia.org/wiki/Mongolic_languages',
    verifyNote: 'Wikidata Q33681; ~13 Sprachen; ~10 Mio. Sprecher; Distribution: Mongolei, Innere Mongolei, Burjatien, Kalmückien.',
    imageSearchTerm: 'Mongolic language family map Mongolia',
  },
];

// =============================================================================
// HAUPTLOGIK
// =============================================================================

async function main() {
  console.log('\n========= WDQS Lingua Welle 5 =========\n');
  console.log('Strategie: Einzel-Items mit verifizierten QIDs (keine Gruppen-Queries)\n');

  const langResults  = new Map(); // QID → Datensatz
  const wsCandidates = [];
  const lfCandidates = [];

  // -------------------------------------------------------------------------
  // 1) Sprachen — Einzel-Items via SPARQL
  // -------------------------------------------------------------------------
  console.log(`--- SPRACHEN: ${LANG_SINGLES_DEDUPED.length} Einzel-Items ---`);

  for (const item of LANG_SINGLES_DEDUPED) {
    // Dedup gegen Bestand
    const slug = toSlug(item.name);
    if (existingIds.has(slug) || existingNames.has(normName(item.name)) || langResults.has(item.qid)) {
      console.log(`  Dedup: ${item.name}`);
      continue;
    }

    console.log(`  Abfrage: ${item.name} (${item.qid})`);

    // SPARQL: Sprecherzahl + Schrift — dewiki-Sitelink als Notabilitäts-Filter
    const query = `
SELECT ?speakers ?scriptLabel WHERE {
  OPTIONAL { wd:${item.qid} wdt:P1098 ?speakers . }
  OPTIONAL {
    wd:${item.qid} wdt:P282 ?script .
    ?script rdfs:label ?scriptLabel .
    FILTER(LANG(?scriptLabel) = "de")
  }
  FILTER EXISTS {
    ?dw schema:about wd:${item.qid} ;
        schema:isPartOf <https://de.wikipedia.org/> .
  }
} LIMIT 5`;

    try {
      const data = await sparqlQuery(query);
      const bindings = data.results?.bindings || [];

      if (bindings.length === 0) {
        console.log('    Kein dewiki-Sitelink — übersprungen');
        await sleep(MIN_DELAY_MS);
        continue;
      }

      const row = bindings[0];
      const speakersRaw = row.speakers?.value ? Number(row.speakers.value) : null;
      const speakersM   = (speakersRaw && isFinite(speakersRaw) && speakersRaw > 0)
        ? Math.round(speakersRaw / 1e5) / 10
        : null;
      const script = normalizeScript(row.scriptLabel?.value);

      langResults.set(item.qid, {
        qid: item.qid, slug, nameDE: item.name,
        speakersM, script, family: item.family, officialIn: null,
      });
      console.log(`    OK — ${speakersM ?? '?'} Mio., ${script || '?'}, ${item.family}`);
    } catch (e) {
      console.warn(`    FEHLER: ${e.message}`);
    }
    await sleep(MIN_DELAY_MS);
  }

  // -------------------------------------------------------------------------
  // 2) officialIn für Sprachen ≥ 1 Mio. Sprecher
  // -------------------------------------------------------------------------
  const officialCandidates = [...langResults.values()].filter(r => (r.speakersM ?? 0) >= 1);
  console.log(`\n--- officialIn-Queries für ${officialCandidates.length} Sprachen ---`);

  for (const lang of officialCandidates) {
    const query = `
SELECT (COUNT(DISTINCT ?country) AS ?cnt) WHERE {
  ?country wdt:P31/wdt:P279* wd:Q3624078 .
  ?country wdt:P37 wd:${lang.qid} .
}`;
    try {
      const data = await sparqlQuery(query);
      const cnt  = parseInt(data.results?.bindings?.[0]?.cnt?.value || '0', 10);
      if (cnt > 0) { lang.officialIn = cnt; console.log(`  ${lang.nameDE}: officialIn=${cnt}`); }
    } catch (e) {
      console.warn(`  FEHLER ${lang.nameDE}: ${e.message}`);
    }
    await sleep(MIN_DELAY_MS);
  }

  // -------------------------------------------------------------------------
  // 3) Schriftsysteme — Dedup + Übernehmen
  // -------------------------------------------------------------------------
  console.log('\n--- SCHRIFTSYSTEME ---');
  const seenWsIds = new Set();
  for (const ws of WRITING_SYSTEM_ITEMS) {
    if (existingIds.has(ws.id) || existingNames.has(normName(ws.name))) {
      console.log(`  Dedup: ${ws.name}`);
      continue;
    }
    if (seenWsIds.has(ws.id)) {
      console.log(`  Intern-Dedup: ${ws.name}`);
      continue;
    }
    seenWsIds.add(ws.id);
    wsCandidates.push(ws);
    console.log(`  +${ws.name}`);
  }

  // -------------------------------------------------------------------------
  // 4) Sprachfamilien — Dedup + Übernehmen
  // -------------------------------------------------------------------------
  console.log('\n--- SPRACHFAMILIEN ---');
  const seenLfIds = new Set();
  for (const lf of LANGUAGE_FAMILY_ITEMS) {
    if (existingIds.has(lf.id) || existingNames.has(normName(lf.name))) {
      console.log(`  Dedup: ${lf.name}`);
      continue;
    }
    if (seenLfIds.has(lf.id)) {
      console.log(`  Intern-Dedup: ${lf.name}`);
      continue;
    }
    seenLfIds.add(lf.id);
    lfCandidates.push(lf);
    console.log(`  +${lf.name}`);
  }

  // =========================================================================
  // Ausgabe
  // =========================================================================

  const output = [];

  // Sprachen
  for (const lang of langResults.values()) {
    if (!lang.speakersM && !lang.family) continue;

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

  // Schriftsysteme
  for (const ws of wsCandidates) {
    output.push({
      id:             ws.id,
      name:           ws.name,
      category:       'writing_system',
      attributes:     ws.attributes,
      funFact:        ws.funFact,
      sourceName:     ws.sourceName,
      sourceUrl:      ws.sourceUrl,
      verifyNote:     ws.verifyNote,
      imageSearchTerm: ws.imageSearchTerm,
    });
  }

  // Sprachfamilien
  for (const lf of lfCandidates) {
    output.push({
      id:             lf.id,
      name:           lf.name,
      category:       'language_family',
      attributes:     lf.attributes,
      funFact:        lf.funFact,
      sourceName:     lf.sourceName,
      sourceUrl:      lf.sourceUrl,
      verifyNote:     lf.verifyNote,
      imageSearchTerm: lf.imageSearchTerm,
    });
  }

  // Sortierung: language → Sprecher desc, dann Kategorie, dann Name
  const catOrder = { language: 0, writing_system: 1, language_family: 2 };
  output.sort((a, b) => {
    if (a.category !== b.category) return catOrder[a.category] - catOrder[b.category];
    if (a.category === 'language') {
      const sa = a.attributes.speakersMillionsNative ?? 0;
      const sb = b.attributes.speakersMillionsNative ?? 0;
      if (sb !== sa) return sb - sa;
    }
    return a.name.localeCompare(b.name, 'de');
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  // =========================================================================
  // Report
  // =========================================================================

  const byCategory = {};
  for (const c of output) byCategory[c.category] = (byCategory[c.category] || 0) + 1;

  console.log('\n========= ERGEBNIS =========');
  console.log(`Ausgabe: ${OUT_PATH}`);
  console.log(`Gesamt:  ${output.length} Konzepte`);
  for (const [cat, cnt] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${cnt}`);
  }

  console.log('\n--- Sprachen ---');
  for (const c of output.filter(o => o.category === 'language')) {
    const a = c.attributes;
    console.log(`  ${c.name} — family=${a.family || '-'}, script=${a.script || '-'}, speakers=${a.speakersMillionsNative ?? '-'} Mio., officialIn=${a.officialIn ?? '-'}`);
  }
  console.log('\n--- Schriftsysteme ---');
  for (const c of output.filter(o => o.category === 'writing_system')) {
    const a = c.attributes;
    console.log(`  ${c.name} — type=${a.scriptType}, chars=${a.charCount}, users=${a.usersMillions ?? '-'} Mio., dir=${a.direction}`);
  }
  console.log('\n--- Sprachfamilien ---');
  for (const c of output.filter(o => o.category === 'language_family')) {
    const a = c.attributes;
    console.log(`  ${c.name} — langs=${a.languageCount}, speakers=${a.speakersMillions} Mio., branches=${a.mainBranches}`);
  }
}

main().catch(err => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
