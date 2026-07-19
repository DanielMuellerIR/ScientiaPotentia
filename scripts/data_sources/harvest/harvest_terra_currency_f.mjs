#!/usr/bin/env node

/**
 * Erzeugt den verifizierten Terra-Währungskatalog für die reaktivierten Fragen.
 * Der kuratierte Name-zu-Code-Abgleich ist absichtlich explizit: Ein
 * Währungssymbol ist nicht eindeutig und darf nie den ISO-Code bestimmen.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPT_DIR, '../../..');
export const GEODB_PATH = resolve(REPO_ROOT, 'src/data/geodb.json');
export const CURRENCY_DATA_PATH = resolve(REPO_ROOT, 'scripts/data_sources/terra_currency_raw.json');
// Kompatibler Exportname für den bestehenden Verifier; die Datei ist seit
// v1.92.0 kein Kandidat mehr, sondern freigegebene Terra-Quellwahrheit.
export const CANDIDATE_PATH = CURRENCY_DATA_PATH;

export const SOURCE_ACCESSED = '2026-07-19';
export const EU_VERSION = '20260105-0';
export const EU_SPARQL_URL = 'https://publications.europa.eu/webapi/rdf/sparql';
export const EU_RESOURCE_BASE = 'https://publications.europa.eu/resource/authority/currency/';
export const EU_PROJECTION_SHA256 =
  'a4d252351b7cff9de5527464479b00fc5a6b68366f7cbf9f3e1f9505ce73c21a';

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
    sourceVersion: 'abgerufen 2026-07-19',
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
  'Cuban peso': 'CUP',
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
  'Zimbabwe Gold': 'ZWG',
});

export const SOURCE_DECISIONS = Object.freeze({
  BG: {
    decision: 'updated-current-currency',
    replacementCode: 'EUR',
    note:
      'Der veraltete Lew-Eintrag wurde nach Bulgariens Euro-Einführung am 2026-01-01 auf EUR aktualisiert.',
  },
  CU: {
    decision: 'updated-current-currency',
    replacementCode: 'CUP',
    note:
      'Der 2021 ausgelaufene Konvertible Peso (CUC) wurde auf den aktuellen Kubanischen Peso (CUP) aktualisiert.',
  },
  EH: {
    decision: 'excluded-ambiguous-assignment',
    replacementCode: 'MAD',
    note:
      'Keine Currency-Frage: Die Bundesbank ordnet MAD zu, „offizielle Währung“ wäre für das umstrittene Gebiet aber fachlich und politisch mehrdeutig.',
  },
  PS: {
    decision: 'excluded-no-unique-iso-currency',
    replacementCode: null,
    note:
      'Keine Currency-Frage: Es gibt keine eindeutige einzelne ISO-4217-Währung; mehrere Währungen sind im Umlauf.',
  },
  ZW: {
    decision: 'updated-current-currency',
    replacementCode: 'ZWG',
    note:
      'Der 2024 ausgelaufene Simbabwe-Dollar (ZWL) wurde auf Simbabwe-Gold (ZWG) aktualisiert.',
  },
});

/**
 * Bei diesen Ländern verrät die amtliche deutsche Währungsbezeichnung die
 * Antwort bereits durch Ländername, Abkürzung oder unmittelbar erkennbares
 * Adjektiv („Kanada“ → „Kanadischer Dollar“). Die korrekte Bezeichnung bleibt
 * als belegter Distraktor nutzbar, erzeugt aber keine eigene Frage.
 */
export const COUNTRY_NAME_LEAK_IDS = Object.freeze([
  'AE', 'AF', 'AR', 'AU', 'AZ', 'BI', 'BN', 'BO', 'BS', 'BY', 'BZ', 'CA',
  'CD', 'CH', 'CL', 'CO', 'CR', 'CU', 'CZ', 'DJ', 'DK', 'DO', 'DZ', 'EG',
  'FJ', 'FK', 'GH', 'GN', 'GY', 'IN', 'IQ', 'IR', 'IS', 'JM', 'JO', 'KE',
  'KP', 'KR', 'KW', 'LB', 'LK', 'LR', 'LY', 'MA', 'MD', 'MW', 'MX', 'NA',
  'NO', 'NP', 'NZ', 'OM', 'PH', 'PK', 'QA', 'RO', 'RS', 'RU', 'RW', 'SA',
  'SB', 'SD', 'SE', 'SO', 'SR', 'SS', 'SY', 'TM', 'TN', 'TR', 'TT', 'TW',
  'TZ', 'UG', 'US', 'UY', 'YE', 'ZM', 'ZW',
]);

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

    const decision = SOURCE_DECISIONS[entity.id] ?? null;
    const hasCountryNameLeak = COUNTRY_NAME_LEAK_IDS.includes(entity.id);
    const note =
      decision?.note ??
      ENTRY_NOTES[entity.id] ??
      'EU-Label für die im Terra-Rohfeld bezeichnete, freigegebene Terra-Währung.';

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
      sourceName: 'EU Publications Office – Currency authority list',
      sourceUrl: `${EU_RESOURCE_BASE}${isoCode}`,
      sourceVersion: EU_VERSION,
      sourceAccessed: SOURCE_ACCESSED,
      status: 'verified-source',
      questionStatus: hasCountryNameLeak ? 'skip-country-name-leak' : 'eligible',
      questionSkipReason: hasCountryNameLeak
        ? 'Die amtliche deutsche Währungsbezeichnung verrät das gefragte Land.'
        : null,
      note,
    };
  });

  const englishNames = new Set(entries.map((entry) => entry.englishName));
  const rawCurrencies = new Set(entries.map((entry) => entry.rawCurrency));
  const isoCodes = new Set(entries.map((entry) => entry.isoCode));
  const eligibleEntries = entries.filter((entry) => entry.questionStatus === 'eligible');
  const skippedLeakEntries = entries.filter(
    (entry) => entry.questionStatus === 'skip-country-name-leak',
  );

  return {
    metadata: {
      artifact: 'terra-currency',
      schemaVersion: 2,
      candidateOnly: false,
      rawMergeApproved: true,
      questionReactivationApproved: true,
      approvedOn: SOURCE_ACCESSED,
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
      verifiedSources: entries.length,
      questionEligible: eligibleEntries.length,
      skippedCountryNameLeaks: skippedLeakEntries.length,
      skippedCountryNameLeakIds: skippedLeakEntries.map((entry) => entry.entityId),
    },
    sourceDecisions: Object.entries(SOURCE_DECISIONS)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entityId, decision]) => ({ entityId, ...decision })),
    entries,
  };
}

async function main() {
  const candidate = await buildCandidate();
  const json = `${JSON.stringify(candidate, null, 2)}\n`;
  await writeFile(CANDIDATE_PATH, json, 'utf8');
  console.log(
    `Currency-Rawdaten geschrieben: ${candidate.summary.entries} Einträge, ` +
      `${candidate.summary.uniqueEnglishNames} Namen, ` +
      `${candidate.summary.rawCurrencyStrings} Rawstrings, ` +
      `${candidate.summary.questionEligible} Fragen freigegeben, ` +
      `${candidate.summary.skippedCountryNameLeaks} Ländername-Leaks übersprungen.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
