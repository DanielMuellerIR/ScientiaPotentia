/**
 * wikidata_lingua.cjs
 *
 * Erntet neue Lingua-Sprachkonzepte (category: "language") aus Wikidata SPARQL (WDQS).
 *
 * Strategie:
 *   - Zwei Haupt-Queries: einmal über dewiki-Sitelinks (bekannte Sprachen),
 *     einmal über WDQS-Sprachfamilien-QIDs für gezielte Zweige.
 *   - Ziel: 20–40 neue, distinkte Sprachen, die noch NICHT in lingua_raw.json sind.
 *   - Nur Sprachen mit dewiki-Sitelink (Bekanntheit-Filter).
 *   - Attribute aus Wikidata-Properties: P1098 (Sprecherzahl), P282 (Schrift),
 *     P106-nahe Sprachfamilie (P1394 / P171), P37 (Amtssprache-Länder via COUNT).
 *   - Format-Angleichung: family im Format "Hauptfamilie (Zweig)", script als
 *     deutsches Wikidata-Label. Nur wenn sauber matchbar; sonst weglassen.
 *   - Ergebnis nach lingua_wd1.json — NICHT in lingua_raw.json mergen.
 *
 * Aufruf: node scripts/data_sources/harvest/wikidata_lingua.cjs
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Konfiguration ----------------------------------------------------------

const UA = 'ScientiaQuizWDQS/1.0 (educational quiz; nfetzen@gmail.com)';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MIN_DELAY_MS = 1500; // >= 1 s zwischen Queries
const MAX_RETRIES = 3;

const OUT_PATH = path.join(__dirname, 'lingua_wd1.json');
const RAW_PATH = path.join(__dirname, '..', 'lingua_raw.json');

// --- Hilfsfunktionen -------------------------------------------------------

/** Wartet mindestens ms Millisekunden. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * SPARQL-Query an WDQS senden; Backoff bei 429/503.
 * Gibt geparste JSON-Antwort zurück.
 */
function sparqlQuery(query, retries = MAX_RETRIES) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/sparql-results+json' } }, res => {
      // Backoff bei Ratenlimit oder Serverüberlast
      if ((res.statusCode === 429 || res.statusCode === 503) && retries > 0) {
        const wait = 5000 + Math.random() * 3000;
        console.warn(`HTTP ${res.statusCode} — warte ${Math.round(wait / 1000)} s, noch ${retries - 1} Versuche`);
        res.resume();
        setTimeout(() => sparqlQuery(query, retries - 1).then(resolve).catch(reject), wait);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} für Query`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON-Parse-Fehler: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Normiert einen String für Dedup-Vergleiche:
 * Kleinbuchstaben, Umlaute erhalten, Leerzeichen normiert, Klammern entfernt.
 */
function normName(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[()]/g, '').trim();
}

/**
 * Wandelt einen Wikidata-Sprachfamiliennamen (de-Label) in das Bestand-Format
 * "Hauptfamilie (Zweig)". Gibt null zurück wenn keine saubere Ableitung möglich.
 *
 * Bekannte Mappings aus dem Bestand:
 *   Indogermanisch (Germanisch) | Indogermanisch (Romanisch) | Indogermanisch (Slawisch) |
 *   Indogermanisch (Indo-Iranisch) | Sinotibetisch | Afroasiatisch (Semitisch) |
 *   Niger-Kongo (Bantu) | Austroasiatisch (Mon-Khmer) | Turksprachen |
 *   Japanisch (isoliert/Japonisch) | Koreanisch (isoliert/Koreanic)
 */
function mapFamily(topFamilyLabel, branchLabel) {
  const top = (topFamilyLabel || '').trim();
  const branch = (branchLabel || '').trim();
  if (!top) return null;

  // Normierungstabelle: Wikidata-DE-Label → Bestand-Hauptfamilien-Schlüssel
  const TOP_MAP = {
    'indogermanische sprachen': 'Indogermanisch',
    'indogermanisch': 'Indogermanisch',
    'indoeuropäische sprachen': 'Indogermanisch',
    'sinotibetische sprachen': 'Sinotibetisch',
    'sinotibetisch': 'Sinotibetisch',
    'afroasiatische sprachen': 'Afroasiatisch',
    'afroasiatisch': 'Afroasiatisch',
    'niger-kongo-sprachen': 'Niger-Kongo',
    'niger-kongo': 'Niger-Kongo',
    'austronesische sprachen': 'Austronesisch',
    'austronesisch': 'Austronesisch',
    'austroasiatische sprachen': 'Austroasiatisch',
    'austroasiatisch': 'Austroasiatisch',
    'turksprachen': 'Turksprachen',
    'turkische sprachen': 'Turksprachen',
    'dravidische sprachen': 'Dravidisch',
    'dravidisch': 'Dravidisch',
    'tai-kadai-sprachen': 'Tai-Kadai',
    'tai-kadai': 'Tai-Kadai',
    'kartvelische sprachen': 'Kartvelisch',
    'nilo-saharanische sprachen': 'Nilo-Saharanisch',
    'khoisan-sprachen': 'Khoisan',
    'uralische sprachen': 'Uralisch',
    'uralisch': 'Uralisch',
  };

  // Zweig-Normierungstabelle → Bestand-Zweig-String
  const BRANCH_MAP = {
    'germanische sprachen': 'Germanisch',
    'germanisch': 'Germanisch',
    'westgermanische sprachen': 'Germanisch',
    'romanische sprachen': 'Romanisch',
    'romanisch': 'Romanisch',
    'slawische sprachen': 'Slawisch',
    'slawisch': 'Slawisch',
    'indo-iranische sprachen': 'Indo-Iranisch',
    'indo-iranisch': 'Indo-Iranisch',
    'iranische sprachen': 'Indo-Iranisch',
    'indoarische sprachen': 'Indo-Iranisch',
    'keltische sprachen': 'Keltisch',
    'keltisch': 'Keltisch',
    'baltische sprachen': 'Baltisch',
    'baltoslawische sprachen': 'Baltoslawisch',
    'semitische sprachen': 'Semitisch',
    'semitisch': 'Semitisch',
    'bantusprachen': 'Bantu',
    'bantu': 'Bantu',
    'mon-khmer-sprachen': 'Mon-Khmer',
    'mon-khmer': 'Mon-Khmer',
    'malayo-polynesische sprachen': 'Malayo-Polynesisch',
    'malayo-polynesisch': 'Malayo-Polynesisch',
    'sinitische sprachen': 'Sinitisch',
    'sinitisch': 'Sinitisch',
    'finno-ugrische sprachen': 'Finno-Ugrisch',
    'finno-ugrisch': 'Finno-Ugrisch',
    'tai-sprachen': 'Tai',
  };

  const topNorm = top.toLowerCase().replace(/[()]/g, '').trim();
  const topKey = TOP_MAP[topNorm];
  if (!topKey) return null;

  const branchNorm = branch.toLowerCase().replace(/[()]/g, '').trim();
  const branchKey = branch ? BRANCH_MAP[branchNorm] : null;

  // Turksprachen und Dravidisch etc. haben keinen separaten "Zweig" im Bestand
  if (topKey === 'Turksprachen' || topKey === 'Dravidisch' || topKey === 'Tai-Kadai' ||
      topKey === 'Kartvelisch' || topKey === 'Nilo-Saharanisch' || topKey === 'Khoisan' ||
      topKey === 'Uralisch') {
    return topKey;
  }

  if (branchKey) return `${topKey} (${branchKey})`;
  // Kein Zweig bekannt, aber Hauptfamilie ist klar: nur Hauptfamilie ausgeben
  // (z.B. Sinotibetisch ohne Zweig — kommt im Bestand vor)
  return topKey;
}

/**
 * Wandelt ein Wikidata-Schrift-DE-Label in das Bestand-Format.
 * Bekannte Werte aus dem Bestand:
 *   "Lateinisches Alphabet" | "Kyrillisches Alphabet" | "Devanagari" |
 *   "Hangul" | "Arabisches Alphabet (Abjad)" | etc.
 * Gibt das Label unverändert zurück wenn es sinnvoll aussieht,
 * null wenn es leer oder offensichtlich falsch ist.
 */
function normalizeScript(label) {
  if (!label || label.trim().length < 3) return null;
  return label.trim();
}

// --- Bestehende IDs und Namen laden für Dedup -------------------------------

const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));

// Nur category="language" für Dedup relevant
const existingIds = new Set(rawData.filter(c => c.category === 'language').map(c => c.id));
const existingNames = new Set(rawData.filter(c => c.category === 'language').map(c => normName(c.name)));

console.log(`Bestehende Sprachen zum Dedup: ${existingIds.size} IDs, ${existingNames.size} Namen`);
console.log('IDs:', [...existingIds].join(', '));

// --- Sprachfamilien-QIDs (verifiziert via WDQS, 2026-06-12) ----------------
// Alle QIDs durch P279*-Traversierung realer Sprachbeispiele ermittelt.
// Wikidata benutzt P279 (Unterklasse von) für Sprachfamilien-Hierarchien —
// NICHT P171 (das existiert als Eigenschaft kaum an Sprachen-Items).
//
// QID-Referenz (ermittelt):
//   Q19860 = Indo-European  |  Q19814 = Romance  |  Q21200 = Germanic
//   Q23526 = Slavic         |  Q33514 = Indo-Iranian
//   Q25268 = Afroasiatic    |  Q34049 = Semitic
//   Q34090 = Turkic         |  Q33311 = Dravidian
//   Q49228 = Austronesian   |  Q143158 = Malayo-Polynesian
//   Q33838 = Niger-Congo    |  Q34113 = Uralic
//   Q45961 = Sino-Tibetan   |  Q33857 = Sinitic
//   Q34171 = Kra-Dai (Tai-Kadai)
const LANG_GROUPS = [
  // Indogermanisch – Romanisch (Italienisch, Rumänisch, Katalanisch, Okzitanisch...)
  { topLabel: 'Indogermanisch', branchLabel: 'Romanisch', familyQid: 'Q19814', limit: 40 },
  // Indogermanisch – Slawisch (Polnisch, Tschechisch, Slowakisch, Bulgarisch, Ukrainisch...)
  { topLabel: 'Indogermanisch', branchLabel: 'Slawisch', familyQid: 'Q23526', limit: 40 },
  // Indogermanisch – Germanisch (Niederländisch, Schwedisch, Dänisch, Norwegisch, Isländisch...)
  { topLabel: 'Indogermanisch', branchLabel: 'Germanisch', familyQid: 'Q21200', limit: 40 },
  // Indogermanisch – Indo-Iranisch (Persisch, Urdu, Marathi, Gujarati, Paschtu, Nepali...)
  { topLabel: 'Indogermanisch', branchLabel: 'Indo-Iranisch', familyQid: 'Q33514', limit: 40 },
  // Afroasiatisch – Semitisch (Amharisch, Hebräisch, Maltesisch, Tigrinya...)
  { topLabel: 'Afroasiatisch', branchLabel: 'Semitisch', familyQid: 'Q34049', limit: 30 },
  // Turksprachen (Aserbaidschanisch, Usbekisch, Kasachisch, Uigurisch, Kirgisisch...)
  { topLabel: 'Turksprachen', branchLabel: null, familyQid: 'Q34090', limit: 30 },
  // Dravidische Sprachen (Tamil, Telugu, Kannada, Malayalam...)
  { topLabel: 'Dravidisch', branchLabel: null, familyQid: 'Q33311', limit: 25 },
  // Austronesisch – Malayo-Polynesisch (Indonesisch, Malay, Tagalog, Malagasy...)
  { topLabel: 'Austronesisch', branchLabel: 'Malayo-Polynesisch', familyQid: 'Q143158', limit: 25 },
  // Tai-Kadai (Kra-Dai) — Thailändisch, Laotisch, Zhuang...
  { topLabel: 'Tai-Kadai', branchLabel: null, familyQid: 'Q34171', limit: 15 },
  // Sino-Tibetisch – Sinitisch (Kantonesisch, Wu, Min, Hakka...)
  { topLabel: 'Sinotibetisch', branchLabel: 'Sinitisch', familyQid: 'Q33857', limit: 15 },
  // Niger-Kongo (Yoruba, Igbo, Hausa, Zulu, Xhosa, Lingala...)
  { topLabel: 'Niger-Kongo', branchLabel: null, familyQid: 'Q33838', limit: 25 },
  // Uralisch (Finnisch, Ungarisch, Estnisch, Samisch...)
  { topLabel: 'Uralisch', branchLabel: null, familyQid: 'Q34113', limit: 15 },
];

// --- SPARQL-Query-Template --------------------------------------------------

/**
 * Baut die SPARQL-Query für eine Sprachgruppe.
 * Holt: QID, dt. Name, Muttersprachler (P1098), Schrift DE-Label (P282).
 * Benutzt P279* (Unterklasse-Transitivpfad) für Familien-Filter —
 * das ist Wikidata-konform; P171 existiert nicht als direkte Eigenschaft.
 * officialIn (P37-COUNT) in separater Query.
 */
function buildLangQuery(group) {
  return `
SELECT DISTINCT ?lang ?langLabel ?speakers ?scriptLabel
WHERE {
  # Typ: natürliche Sprache (Q34770) oder Unterklasse davon
  ?lang wdt:P31/wdt:P279* wd:Q34770 .
  # Nur Mitglieder der Sprachfamilie (transitiv über P279*)
  ?lang wdt:P279* wd:${group.familyQid} .
  # dewiki-Sitelink (Bekanntheits-Filter)
  ?dewikiLink schema:about ?lang ;
              schema:isPartOf <https://de.wikipedia.org/> .
  # Sprecherzahl (P1098) — optional, nehme maximalen Wert
  OPTIONAL { ?lang wdt:P1098 ?speakers . }
  # Schrift (P282) — optional, erstes Ergebnis (de-Label)
  OPTIONAL {
    ?lang wdt:P282 ?script .
    ?script rdfs:label ?scriptLabel .
    FILTER(LANG(?scriptLabel) = "de")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en" . }
}
ORDER BY DESC(?speakers)
LIMIT ${group.limit}
`.trim();
}

/**
 * Query für officialIn: Zählt Länder, in denen ?lang als Amtssprache (P37) gilt.
 */
function buildOfficialCountryQuery(qid) {
  return `
SELECT (COUNT(DISTINCT ?country) AS ?cnt)
WHERE {
  ?country wdt:P31/wdt:P279* wd:Q3624078 .
  ?country wdt:P37 wd:${qid} .
}
`.trim();
}

// --- Hauptlogik: Queries ausführen und Ergebnisse sammeln ------------------

async function main() {
  const results = new Map(); // QID → Datensatz (Dedup über QID)

  for (const group of LANG_GROUPS) {
    const query = buildLangQuery(group);
    const groupName = `${group.topLabel}${group.branchLabel ? ' / ' + group.branchLabel : ''} [${group.familyQid}]`;
    console.log(`\nQuery: ${groupName} (LIMIT ${group.limit})`);

    let data;
    try {
      data = await sparqlQuery(query);
    } catch (e) {
      console.warn(`  FEHLER: ${e.message} — überspringe Gruppe`);
      await sleep(MIN_DELAY_MS);
      continue;
    }

    const bindings = data.results?.bindings || [];
    console.log(`  ${bindings.length} Treffer`);

    for (const row of bindings) {
      const qid = row.lang?.value?.replace('http://www.wikidata.org/entity/', '');
      const nameDE = row.langLabel?.value;

      if (!qid || !nameDE) continue;

      // Deutsches Label muss vorhanden und kein QID-Fallback sein
      if (/^Q\d+$/.test(nameDE)) continue;

      // Bereits erfasst (andere Gruppe) — behalte ersten Eintrag (höhere Sprecher)
      if (results.has(qid)) continue;

      // Dedup gegen Bestand (normierte ID + normierter Name)
      const idSlug = nameDE.toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      if (existingIds.has(idSlug) || existingNames.has(normName(nameDE))) {
        console.log(`  Dedup: ${nameDE} (${qid})`);
        continue;
      }

      // Sprecherzahl: P1098-Wert, in Millionen gerundet auf 0,1
      const speakersRaw = row.speakers?.value ? Number(row.speakers.value) : null;
      const speakersMillionsNative = speakersRaw && isFinite(speakersRaw) && speakersRaw > 0
        ? Math.round(speakersRaw / 1e5) / 10  // → Millionen, 1 Nachkommastelle
        : null;

      // Schrift: Wikidata P282 DE-Label
      const script = normalizeScript(row.scriptLabel?.value);

      // Sprachfamilie: aus Gruppen-Metadaten ableiten (deterministisch)
      const family = mapFamily(group.topLabel, group.branchLabel);

      results.set(qid, {
        qid,
        nameDE,
        idSlug,
        speakersMillionsNative,
        script,
        family,
        officialIn: null, // wird separat abgerufen
      });
    }

    await sleep(MIN_DELAY_MS);
  }

  console.log(`\nVor officialIn-Queries: ${results.size} Kandidaten`);

  // officialIn nur für Sprachen mit nennenswerter Sprecherzahl (>= 1 Mio.)
  // und dewiki-Sitelink — schützt vor Timeouts bei obscuren Sprachen
  const candidates = [...results.values()].filter(r => r.speakersMillionsNative >= 1);
  console.log(`officialIn-Queries für ${candidates.length} Sprachen (>= 1 Mio. Sprecher)`);

  for (const lang of candidates) {
    const query = buildOfficialCountryQuery(lang.qid);
    try {
      const data = await sparqlQuery(query);
      const cnt = parseInt(data.results?.bindings?.[0]?.cnt?.value || '0', 10);
      if (cnt > 0) lang.officialIn = cnt;
    } catch (e) {
      console.warn(`  officialIn FEHLER für ${lang.nameDE}: ${e.message}`);
    }
    await sleep(MIN_DELAY_MS);
  }

  // --- Ausgabe-Format aufbauen -----------------------------------------------

  const output = [];
  let skippedNoFamily = 0;
  let skippedNoSpeakers = 0;

  for (const lang of results.values()) {
    // Minimale Qualitätsschwelle: Sprecherzahl ODER family muss vorhanden sein
    if (!lang.speakersMillionsNative && !lang.family) {
      skippedNoSpeakers++;
      continue;
    }

    // Attribute zusammenstellen — nur sauber belegte Felder
    const attributes = {};
    if (lang.speakersMillionsNative !== null && lang.speakersMillionsNative > 0) {
      attributes.speakersMillionsNative = lang.speakersMillionsNative;
    }
    if (lang.family) attributes.family = lang.family;
    if (lang.script) attributes.script = lang.script;
    if (lang.officialIn) attributes.officialIn = lang.officialIn;

    output.push({
      id: lang.idSlug,
      name: lang.nameDE,
      category: 'language',
      attributes,
      funFact: '',
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${lang.qid}`,
      verifyNote: `P1098=${lang.speakersMillionsNative ? lang.speakersMillionsNative + ' Mio.' : 'n/a'}, P282=${lang.script || 'n/a'}, P171-Familie=${lang.family || 'n/a'}, officialIn=${lang.officialIn ?? 'n/a'}`,
      imageSearchTerm: `${lang.nameDE} language`,
    });
  }

  // Sortieren: Sprecher absteigend, dann Name
  output.sort((a, b) => {
    const sa = a.attributes.speakersMillionsNative ?? 0;
    const sb = b.attributes.speakersMillionsNative ?? 0;
    if (sb !== sa) return sb - sa;
    return a.name.localeCompare(b.name, 'de');
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n=== Ergebnis ===`);
  console.log(`Neue Sprachen gespeichert: ${output.length}`);
  console.log(`Übersprungen (kein Sprecher+Familie): ${skippedNoSpeakers}`);
  console.log(`Ausgabe: ${OUT_PATH}`);

  // Stichproben-Ausgabe (erste 6)
  console.log('\nErstausgabe (erste 6):');
  for (const lang of output.slice(0, 6)) {
    console.log(`  ${lang.name} (${lang.sourceUrl.split('/').pop()}) — family=${lang.attributes.family || '-'}, script=${lang.attributes.script || '-'}, speakers=${lang.attributes.speakersMillionsNative || '-'} Mio., officialIn=${lang.attributes.officialIn || '-'}`);
  }
}

main().catch(err => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
