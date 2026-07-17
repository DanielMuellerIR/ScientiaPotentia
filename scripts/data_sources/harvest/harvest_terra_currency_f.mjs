#!/usr/bin/env node

/**
 * Erzeugt ausschließlich das isolierte Kandidatenartefakt für die stillgelegten
 * Terra-Währungsfragen. Der kuratierte Name-zu-Code-Abgleich ist absichtlich
 * explizit: Ein Währungssymbol ist nicht eindeutig und darf nie den ISO-Code
 * bestimmen.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPT_DIR, '../../..');
export const GEODB_PATH = resolve(REPO_ROOT, 'src/data/geodb.json');
export const CANDIDATE_PATH = resolve(SCRIPT_DIR, 'cand_terra_currency_f.json');

export const SOURCE_ACCESSED = '2026-07-17';
export const EU_VERSION = '20260105-0';
export const EU_SPARQL_URL = 'https://publications.europa.eu/webapi/rdf/sparql';
export const EU_RESOURCE_BASE = 'https://publications.europa.eu/resource/authority/currency/';
export const EU_PROJECTION_SHA256 =
  '1d8d81db8affb74f0d55642a2a5c46801e331ba341bc94aeb809c1be6ad01a68';

export const EU_QUERY = `PREFIX auth: <http://publications.europa.eu/ontology/authority/>
PREFIX euvoc: <http://publications.europa.eu/ontology/euvoc#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?uri ?code ?en ?de ?deprecated ?start ?end ?version
WHERE {
  ?uri auth:authority-code ?code ;
       skos:prefLabel ?en, ?de ;
       owl:versionInfo ?version .
  FILTER(
    STRSTARTS(STR(?uri), "http://publications.europa.eu/resource/authority/currency/") &&
    lang(?en) = "en" &&
    lang(?de) = "de"
  )
  OPTIONAL { ?uri owl:deprecated ?deprecated }
  OPTIONAL { ?uri euvoc:startDate ?start }
  OPTIONAL { ?uri euvoc:endDate ?end }
}
ORDER BY ?code`;

export const SOURCES = Object.freeze([
  {
    sourceName: 'EU Publications Office – Currency authority list',
    role: 'Primärquelle für ISO-Code, deutsches skos:prefLabel, Status und Nutzungsdaten',
    sourceUrl:
      'https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http%3A%2F%2Fpublications.europa.eu%2Fresource%2Fdataset%2Fcurrency',
    machineReadableUrl: EU_SPARQL_URL,
    directResourcePattern: `${EU_RESOURCE_BASE}<CODE>`,
    sourceVersion: EU_VERSION,
    sourceAccessed: SOURCE_ACCESSED,
  },
  {
    sourceName: 'Deutsche Bundesbank – ISO-Währungscodes',
    role: 'Deutsche Gegenquelle für aktuelle Singularnamen und Gebietszuordnung',
    sourceUrl:
      'https://www.bundesbank.de/de/statistiken/statistische-fachreihen/-/iso-waehrungscodes-808950',
    sourceVersion: '2026-07-15',
    sourceAccessed: SOURCE_ACCESSED,
  },
  {
    sourceName: 'SIX – ISO 4217 Maintenance Agency',
    role: 'Gegenquelle für Code- und Statuspflege; nicht für deutsche Labels',
    sourceUrl:
      'https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html',
    sourceVersion: 'abgerufen 2026-07-17',
    sourceAccessed: SOURCE_ACCESSED,
  },
]);

/**
 * Kuratierte Zuordnung des im bestehenden Terra-Feld verwendeten englischen
 * Namens zum ISO-4217-Code. Die Zuordnung wurde gegen die EU Authority List und
 * die Deutsche Bundesbank geprüft. Sie ist keine automatische Übersetzung.
 */
export const ISO_CODE_BY_ENGLISH_NAME = Object.freeze({
  'Afghan afghani': 'AFN',
  'Albanian lek': 'ALL',
  'Algerian dinar': 'DZD',
  'Angolan kwanza': 'AOA',
  'Argentine peso': 'ARS',
  'Armenian dram': 'AMD',
  'Australian dollar': 'AUD',
  'Azerbaijani manat': 'AZN',
  'Bahamian dollar': 'BSD',
  'Bangladeshi taka': 'BDT',
  'Belarusian ruble': 'BYN',
  'Belize dollar': 'BZD',
  'Bhutanese ngultrum': 'BTN',
  'Bolivian boliviano': 'BOB',
  'Bosnia and Herzegovina convertible mark': 'BAM',
  'Botswana pula': 'BWP',
  'Brazilian real': 'BRL',
  'British pound': 'GBP',
  'Brunei dollar': 'BND',
  'Bulgarian lev': 'BGN',
  'Burmese kyat': 'MMK',
  'Burundian franc': 'BIF',
  'Cambodian riel': 'KHR',
  'Canadian dollar': 'CAD',
  'Central African CFA franc': 'XAF',
  'CFP franc': 'XPF',
  'Chilean peso': 'CLP',
  'Chinese yuan': 'CNY',
  'Colombian peso': 'COP',
  'Congolese franc': 'CDF',
  'Costa Rican colón': 'CRC',
  'Cuban convertible peso': 'CUC',
  'Czech koruna': 'CZK',
  dalasi: 'GMD',
  'Danish krone': 'DKK',
  denar: 'MKD',
  'Djiboutian franc': 'DJF',
  'Dominican peso': 'DOP',
  'Egyptian pound': 'EGP',
  'Eritrean nakfa': 'ERN',
  'Ethiopian birr': 'ETB',
  euro: 'EUR',
  'Falkland Islands pound': 'FKP',
  'Fijian dollar': 'FJD',
  'Ghanaian cedi': 'GHS',
  'Guatemalan quetzal': 'GTQ',
  'Guinean franc': 'GNF',
  'Guyanese dollar': 'GYD',
  'Haitian gourde': 'HTG',
  'Honduran lempira': 'HNL',
  'Hungarian forint': 'HUF',
  'Icelandic króna': 'ISK',
  'Indian rupee': 'INR',
  'Indonesian rupiah': 'IDR',
  'Iranian rial': 'IRR',
  'Iraqi dinar': 'IQD',
  'Israeli new shekel': 'ILS',
  'Jamaican dollar': 'JMD',
  'Japanese yen': 'JPY',
  'Jordanian dinar': 'JOD',
  'Kazakhstani tenge': 'KZT',
  'Kenyan shilling': 'KES',
  krone: 'DKK',
  'Kuwaiti dinar': 'KWD',
  'Kyrgyzstani som': 'KGS',
  'Lao kip': 'LAK',
  lari: 'GEL',
  'Lebanese pound': 'LBP',
  Leone: 'SLE',
  'Lesotho loti': 'LSL',
  'Liberian dollar': 'LRD',
  'Libyan dinar': 'LYD',
  'Malagasy ariary': 'MGA',
  'Malawian kwacha': 'MWK',
  'Malaysian ringgit': 'MYR',
  'Mauritanian ouguiya': 'MRU',
  'Mexican peso': 'MXN',
  'Moldovan leu': 'MDL',
  'Mongolian tögrög': 'MNT',
  'Moroccan dirham': 'MAD',
  'Mozambican metical': 'MZN',
  'Namibian dollar': 'NAD',
  'Nepalese rupee': 'NPR',
  'New Taiwan dollar': 'TWD',
  'New Zealand dollar': 'NZD',
  'Nicaraguan córdoba': 'NIO',
  'Nigerian naira': 'NGN',
  'North Korean won': 'KPW',
  'Norwegian krone': 'NOK',
  'Omani rial': 'OMR',
  'Pakistani rupee': 'PKR',
  'Panamanian balboa': 'PAB',
  'Papua New Guinean kina': 'PGK',
  'Paraguayan guaraní': 'PYG',
  'Peruvian sol': 'PEN',
  'Philippine peso': 'PHP',
  'Polish złoty': 'PLN',
  'Qatari riyal': 'QAR',
  'Romanian leu': 'RON',
  'Russian ruble': 'RUB',
  'Rwandan franc': 'RWF',
  'Saudi riyal': 'SAR',
  'Serbian dinar': 'RSD',
  'Solomon Islands dollar': 'SBD',
  'Somali shilling': 'SOS',
  'South African rand': 'ZAR',
  'South Korean won': 'KRW',
  'South Sudanese pound': 'SSP',
  'Sri Lankan rupee': 'LKR',
  'Sudanese pound': 'SDG',
  'Surinamese dollar': 'SRD',
  'Swazi lilangeni': 'SZL',
  'Swedish krona': 'SEK',
  'Swiss franc': 'CHF',
  'Syrian pound': 'SYP',
  'Tajikistani somoni': 'TJS',
  'Tanzanian shilling': 'TZS',
  'Thai baht': 'THB',
  'Trinidad and Tobago dollar': 'TTD',
  'Tunisian dinar': 'TND',
  'Turkish lira': 'TRY',
  'Turkmenistan manat': 'TMT',
  'Ugandan shilling': 'UGX',
  'Ukrainian hryvnia': 'UAH',
  'United Arab Emirates dirham': 'AED',
  'United States dollar': 'USD',
  'Uruguayan peso': 'UYU',
  'Uzbekistani soʻm': 'UZS',
  'Vanuatu vatu': 'VUV',
  'Venezuelan bolívar soberano': 'VES',
  'Vietnamese đồng': 'VND',
  'West African CFA franc': 'XOF',
  'Yemeni rial': 'YER',
  'Zambian kwacha': 'ZMW',
  'Zimbabwean dollar': 'ZWL',
});

export const BLOCKED_ISSUES = Object.freeze({
  BG: {
    issueType: 'deprecated-source-currency',
    replacementCode: 'EUR',
    note:
      'Das Raw-Feld bezeichnet den Bulgarischen Lew (BGN). BGN endete laut EU Authority List am 2026-01-01 und wurde durch EUR ersetzt; deshalb keine Reaktivierung aus diesem Kandidaten.',
  },
  CU: {
    issueType: 'deprecated-source-currency',
    replacementCode: 'CUP',
    note:
      'Das Raw-Feld bezeichnet den Konvertiblen Peso (CUC). CUC endete laut EU Authority List am 2021-06-30; fachlicher Nachfolger ist CUP. Die EU-Liste enthält dafür keine dcterms:isReplacedBy-Kante, daher bleibt der Datensatz blockiert.',
  },
  EH: {
    issueType: 'territory-assignment-mismatch',
    replacementCode: 'MAD',
    note:
      'Das Raw-Feld bezeichnet DZD und wird als DZD übersetzt. Die aktuelle Gebietszuordnung der Gegenquelle nennt jedoch MAD; diese Abweichung muss vor einem Merge fachlich entschieden werden.',
  },
  PS: {
    issueType: 'territory-assignment-mismatch',
    replacementCode: null,
    note:
      'Das Raw-Feld bezeichnet EGP und wird als EGP übersetzt. Für Palästina gibt es keine eindeutige eigene ISO-4217-Währung; mehrere Währungen sind im Umlauf. Das Raw-Feld darf daher nicht ungeprüft reaktiviert werden.',
  },
  ZW: {
    issueType: 'deprecated-source-currency',
    replacementCode: 'ZWG',
    note:
      'Das Raw-Feld bezeichnet den Simbabwe-Dollar (ZWL). ZWL endete laut EU Authority List am 2024-08-31 und wurde durch ZWG ersetzt; deshalb keine Reaktivierung aus diesem Kandidaten.',
  },
});

const ENTRY_NOTES = Object.freeze({
  GL: 'Das unspezifische Raw-Wort „krone“ bezeichnet für Grönland DKK (Dänische Krone).',
  SZ: 'Der Terra-Ländername „Swasiland“ ist veraltet; die bezeichnete Währung SZL (Lilangeni) bleibt fachlich zuordenbar.',
});

export function parseRawCurrency(rawCurrency) {
  const match = /^(.*) \(([^()]*)\)$/u.exec(rawCurrency);
  if (!match) {
    throw new Error(`Währungsfeld hat nicht das erwartete Format: ${JSON.stringify(rawCurrency)}`);
  }

  return { englishName: match[1], symbol: match[2] };
}

function valueOf(binding, key) {
  return binding[key]?.value ?? null;
}

export async function fetchEuCurrencyRecords() {
  const url = new URL(EU_SPARQL_URL);
  url.searchParams.set('query', EU_QUERY);
  const response = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`EU-SPARQL antwortete mit HTTP ${response.status}`);
  }

  const payload = await response.json();
  const records = new Map();

  for (const binding of payload.results?.bindings ?? []) {
    const code = valueOf(binding, 'code');
    if (!code || records.has(code)) {
      throw new Error(`EU-SPARQL lieferte einen fehlenden oder doppelten Code: ${code}`);
    }

    records.set(code, {
      code,
      englishLabel: valueOf(binding, 'en'),
      germanLabel: valueOf(binding, 'de'),
      deprecated: ['1', 'true'].includes(valueOf(binding, 'deprecated')),
      useStart: valueOf(binding, 'start'),
      useEnd: valueOf(binding, 'end'),
      version: valueOf(binding, 'version'),
    });
  }

  return records;
}

export function sha256(bufferOrString) {
  return createHash('sha256').update(bufferOrString).digest('hex');
}

function projectedRecord(code, record) {
  if (!record) {
    throw new Error(`EU-Projektion enthält den erwarteten Code ${code} nicht`);
  }

  return {
    code,
    englishLabel: record.englishLabel,
    germanLabel: record.germanLabel,
    deprecated: record.deprecated,
    useStart: record.useStart,
    useEnd: record.useEnd,
  };
}

export function usedIsoCodes() {
  return [...new Set(Object.values(ISO_CODE_BY_ENGLISH_NAME))].sort();
}

export function buildEuProjection(euRecords) {
  return usedIsoCodes().map((code) => projectedRecord(code, euRecords.get(code)));
}

export function buildCandidateProjection(entries) {
  const records = new Map();
  for (const entry of entries) {
    const record = {
      englishLabel: entry.euEnglishName,
      germanLabel: entry.germanName,
      deprecated: entry.euDeprecated,
      useStart: entry.useStart,
      useEnd: entry.useEnd,
    };
    const previous = records.get(entry.isoCode);
    if (previous && JSON.stringify(previous) !== JSON.stringify(record)) {
      throw new Error(`Konflikt in doppelten Kandidatenzeilen für ${entry.isoCode}`);
    }
    records.set(entry.isoCode, record);
  }

  const expectedCodes = usedIsoCodes();
  const actualCodes = [...records.keys()].sort();
  if (JSON.stringify(actualCodes) !== JSON.stringify(expectedCodes)) {
    throw new Error('Kandidatenprojektion enthält fehlende oder zusätzliche ISO-Codes');
  }

  return expectedCodes.map((code) => projectedRecord(code, records.get(code)));
}

export function hashEuProjection(projection) {
  return sha256(JSON.stringify(projection));
}

function createReviewSample(entityIds) {
  const ranked = entityIds
    .map((entityId) => ({
      entityId,
      score: sha256(`terra-currency-f-v1:${entityId}`),
    }))
    .sort((left, right) => left.score.localeCompare(right.score))
    .slice(0, 12)
    .map(({ entityId }) => entityId);

  const mandatory = ['BG', 'CU', 'EH', 'PS', 'ZW', 'GL', 'BF', 'CF', 'KP', 'KR', 'SZ'];
  return [...new Set([...ranked, ...mandatory])].sort();
}

export async function buildCandidate() {
  const geodbBytes = await readFile(GEODB_PATH);
  const geodb = JSON.parse(geodbBytes);
  const countries = Object.values(geodb.entities)
    .filter((entity) => entity.type === 'country')
    .sort((left, right) => left.id.localeCompare(right.id));
  const currencyCountries = countries.filter((entity) => entity.metadata?.currency !== 'N/A');
  const euRecords = await fetchEuCurrencyRecords();
  const sourceProjectionSha256 = hashEuProjection(buildEuProjection(euRecords));
  if (sourceProjectionSha256 !== EU_PROJECTION_SHA256) {
    throw new Error(
      `EU-Projektion hat sich trotz gepinnter Authority-Version geändert: ` +
        `erwartet ${EU_PROJECTION_SHA256}, erhalten ${sourceProjectionSha256}. ` +
        'Quelle nicht still regenerieren, sondern explizit fachlich prüfen und neu pinnen.',
    );
  }

  const entries = currencyCountries.map((entity) => {
    const rawCurrency = entity.metadata.currency;
    const { englishName, symbol } = parseRawCurrency(rawCurrency);
    const isoCode = ISO_CODE_BY_ENGLISH_NAME[englishName];
    if (!isoCode) {
      throw new Error(`Kein kuratierter ISO-Code für ${JSON.stringify(englishName)} (${entity.id})`);
    }

    const eu = euRecords.get(isoCode);
    if (!eu) {
      throw new Error(`EU Authority List enthält den kuratierten Code ${isoCode} nicht`);
    }
    if (eu.version !== EU_VERSION) {
      throw new Error(`EU-Version für ${isoCode}: erwartet ${EU_VERSION}, erhalten ${eu.version}`);
    }

    const issue = BLOCKED_ISSUES[entity.id] ?? null;
    const status = issue ? 'blocked-source-data' : 'verified-candidate';
    const note =
      issue?.note ??
      ENTRY_NOTES[entity.id] ??
      'EU-Label für die im Terra-Rohfeld bezeichnete Währung; isolierter Kandidat ohne Merge- oder Reaktivierungsfreigabe.';

    return {
      id: `terra-currency-${entity.id}`,
      entityId: entity.id,
      countryName: entity.name,
      rawCurrency,
      englishName,
      symbol,
      isoCode,
      germanName: eu.germanLabel,
      euEnglishName: eu.englishLabel,
      euDeprecated: eu.deprecated,
      useStart: eu.useStart,
      useEnd: eu.useEnd,
      replacementCode: issue?.replacementCode ?? null,
      sourceName: 'EU Publications Office – Currency authority list',
      sourceUrl: `${EU_RESOURCE_BASE}${isoCode}`,
      sourceVersion: EU_VERSION,
      sourceAccessed: SOURCE_ACCESSED,
      status,
      issueType: issue?.issueType ?? null,
      note,
    };
  });

  const englishNames = new Set(entries.map((entry) => entry.englishName));
  const rawCurrencies = new Set(entries.map((entry) => entry.rawCurrency));
  const isoCodes = new Set(entries.map((entry) => entry.isoCode));
  const blockedEntries = entries.filter((entry) => entry.status === 'blocked-source-data');

  return {
    metadata: {
      artifact: 'terra-currency-f',
      schemaVersion: 1,
      candidateOnly: true,
      rawMergeApproved: false,
      questionReactivationApproved: false,
      generatedOn: SOURCE_ACCESSED,
      inputPath: 'src/data/geodb.json',
      inputSha256: sha256(geodbBytes),
      sourceDatasetVersion: EU_VERSION,
      sourceQuerySha256: sha256(EU_QUERY),
      sourceProjectionSha256,
      sourceQuery: EU_QUERY,
      reviewSampleMethod:
        'SHA-256("terra-currency-f-v1:" + entityId), lexikografisch kleinste 12; anschließend dokumentierte Sonderfälle als Pflichtmenge.',
      reviewSampleEntityIds: createReviewSample(entries.map((entry) => entry.entityId)),
    },
    sources: SOURCES,
    summary: {
      countryEntities: countries.length,
      excludedEntityIds: countries
        .filter((entity) => entity.metadata?.currency === 'N/A')
        .map((entity) => entity.id),
      entries: entries.length,
      rawCurrencyStrings: rawCurrencies.size,
      uniqueEnglishNames: englishNames.size,
      uniqueIsoCodes: isoCodes.size,
      verifiedCandidates: entries.length - blockedEntries.length,
      blockedSourceData: blockedEntries.length,
      blockedEntityIds: blockedEntries.map((entry) => entry.entityId),
    },
    issues: Object.entries(BLOCKED_ISSUES)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entityId, issue]) => ({ entityId, ...issue })),
    entries,
  };
}

async function main() {
  const candidate = await buildCandidate();
  const json = `${JSON.stringify(candidate, null, 2)}\n`;
  await writeFile(CANDIDATE_PATH, json, 'utf8');
  console.log(
    `Kandidat geschrieben: ${candidate.summary.entries} Einträge, ` +
      `${candidate.summary.uniqueEnglishNames} Namen, ` +
      `${candidate.summary.rawCurrencyStrings} Rawstrings, ` +
      `${candidate.summary.blockedSourceData} blockiert.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
