#!/usr/bin/env node

/**
 * Offline-Gate für die integrierten Terra-Währungsdaten und -fragen.
 *
 * Mit --online werden zusätzlich alle verwendeten Codes, Labels, Versions-,
 * Status- und Nutzungsfelder erneut über den gepinnten EU-SPARQL-Query geprüft.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  COUNTRY_NAME_LEAK_IDS,
  CURRENCY_DATA_PATH,
  EU_PROJECTION_SHA256,
  EU_QUERY,
  EU_RESOURCE_BASE,
  EU_VERSION,
  GEODB_PATH,
  ISO_CODE_BY_ENGLISH_NAME,
  REPO_ROOT,
  SOURCES,
  SOURCE_ACCESSED,
  SOURCE_DECISIONS,
  buildCandidateProjection,
  buildEuProjection,
  fetchEuCurrencyRecords,
  hashEuProjection,
  parseRawCurrency,
} from './harvest_terra_currency_f.mjs';

const ONLINE = process.argv.slice(2).includes('--online');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--online');
if (unknownArguments.length > 0) {
  throw new Error(`Unbekannte Argumente: ${unknownArguments.join(', ')}`);
}

let checks = 0;

function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}

function equal(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: erwartet ${JSON.stringify(expected)}, erhalten ${JSON.stringify(actual)}`,
  );
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sha256(bufferOrString) {
  return createHash('sha256').update(bufferOrString).digest('hex');
}

function expectedReviewSample(entityIds) {
  const ranked = entityIds
    .map((entityId) => ({
      entityId,
      score: sha256(`terra-currency-f-v1:${entityId}`),
    }))
    .sort((left, right) => left.score.localeCompare(right.score))
    .slice(0, 12)
    .map(({ entityId }) => entityId);
  const mandatory = ['BG', 'CU', 'EH', 'PS', 'ZW', 'GL', 'BF', 'CF', 'KP', 'KR', 'SZ'];
  return sorted(new Set([...ranked, ...mandatory]));
}

const currencyPath = process.env.TERRA_CURRENCY_F_CANDIDATE
  ? resolve(process.env.TERRA_CURRENCY_F_CANDIDATE)
  : CURRENCY_DATA_PATH;
const currencyData = JSON.parse(await readFile(currencyPath, 'utf8'));
const geodbBytes = await readFile(GEODB_PATH);
const geodb = JSON.parse(geodbBytes);
const countries = Object.values(geodb.entities)
  .filter((entity) => entity.type === 'country')
  .sort((left, right) => left.id.localeCompare(right.id));
const currencyCountries = countries.filter((entity) => entity.metadata?.currency !== 'N/A');
const entries = currencyData.entries;
const countryNameLeakIds = new Set(COUNTRY_NAME_LEAK_IDS);

equal(currencyData.metadata.artifact, 'terra-currency', 'Artefaktkennung');
equal(currencyData.metadata.schemaVersion, 2, 'Schema-Version');
equal(currencyData.metadata.candidateOnly, false, 'candidateOnly');
equal(currencyData.metadata.rawMergeApproved, true, 'rawMergeApproved');
equal(currencyData.metadata.questionReactivationApproved, true, 'questionReactivationApproved');
equal(currencyData.metadata.approvedOn, SOURCE_ACCESSED, 'approvedOn');
equal(currencyData.metadata.inputPath, 'src/data/geodb.json', 'Inputpfad');
equal(currencyData.metadata.inputSha256, sha256(geodbBytes), 'SHA-256 des geodb-Inputs');
equal(currencyData.metadata.generatedOn, SOURCE_ACCESSED, 'generatedOn');
equal(currencyData.metadata.sourceDatasetVersion, EU_VERSION, 'EU-Dataset-Version');
equal(currencyData.metadata.sourceQuery, EU_QUERY, 'Gepinnter EU-Query');
equal(currencyData.metadata.sourceQuerySha256, sha256(EU_QUERY), 'SHA-256 des EU-Query');
equal(
  currencyData.metadata.sourceProjectionSha256,
  EU_PROJECTION_SHA256,
  'Metadata-Hash der EU-Projektion',
);
equal(JSON.stringify(currencyData.sources), JSON.stringify(SOURCES), 'Vollständiger Quellenblock');
for (const source of currencyData.sources) {
  assert(source.sourceUrl.startsWith('https://'), `Nicht-HTTPS-Quellen-URL: ${source.sourceUrl}`);
  if (source.machineReadableUrl) {
    assert(
      source.machineReadableUrl.startsWith('https://'),
      `Nicht-HTTPS-Maschinenquelle: ${source.machineReadableUrl}`,
    );
  }
}

equal(countries.length, 175, 'Anzahl Country-Entities');
equal(currencyCountries.length, 172, 'Anzahl Country-Entities mit eindeutiger Currency');
equal(
  JSON.stringify(
    countries
      .filter((entity) => entity.metadata?.currency === 'N/A')
      .map((entity) => entity.id)
      .sort(),
  ),
  JSON.stringify(['AQ', 'EH', 'PS']),
  'Bewusst ausgeschlossene Country-Entities',
);
equal(entries.length, currencyCountries.length, 'Anzahl Currency-Einträge');

const entryIds = entries.map((entry) => entry.entityId);
equal(new Set(entryIds).size, entries.length, 'Eindeutige Entity-IDs');
equal(new Set(entries.map((entry) => entry.id)).size, entries.length, 'Eindeutige Currency-IDs');
equal(JSON.stringify(entryIds), JSON.stringify(sorted(entryIds)), 'Sortierung der Entity-IDs');
equal(
  JSON.stringify(entryIds),
  JSON.stringify(currencyCountries.map((entity) => entity.id)),
  'Vollständige Entity-Coverage',
);

const expectedEnglishNames = new Set();
const expectedRawCurrencies = new Set();
const countryById = new Map(currencyCountries.map((entity) => [entity.id, entity]));
const answers = new Set();

for (const entry of entries) {
  const country = countryById.get(entry.entityId);
  assert(country, `Unbekannte Entity-ID ${entry.entityId}`);
  equal(entry.id, `terra-currency-${entry.entityId}`, `Stabile ID ${entry.entityId}`);
  equal(entry.countryName, country.name, `Ländername ${entry.entityId}`);
  equal(entry.rawCurrency, country.metadata.currency, `Raw-Currency ${entry.entityId}`);

  const parsed = parseRawCurrency(entry.rawCurrency);
  equal(entry.englishName, parsed.englishName, `Englischer Name ${entry.entityId}`);
  equal(entry.symbol, parsed.symbol, `Symbol ${entry.entityId}`);
  equal(
    `${entry.englishName} (${entry.symbol})`,
    entry.rawCurrency,
    `Bytegenaue Parser-Rückbildung ${entry.entityId}`,
  );
  expectedEnglishNames.add(parsed.englishName);
  expectedRawCurrencies.add(entry.rawCurrency);

  const expectedCode = ISO_CODE_BY_ENGLISH_NAME[entry.englishName];
  assert(expectedCode, `Kein kuratiertes Mapping für ${entry.englishName}`);
  equal(entry.isoCode, expectedCode, `ISO-Code ${entry.entityId}`);
  assert(/^[A-Z]{3}$/.test(entry.isoCode), `Ungültiges Codeformat ${entry.isoCode}`);
  assert(entry.germanName.trim().length > 0, `Leeres deutsches Label ${entry.entityId}`);
  assert(!entry.euDeprecated, `Veraltete Währung wurde integriert: ${entry.entityId}`);
  equal(entry.status, 'verified-source', `Status ${entry.entityId}`);
  equal(
    entry.questionStatus,
    countryNameLeakIds.has(entry.entityId) ? 'skip-country-name-leak' : 'eligible',
    `Question Status ${entry.entityId}`,
  );
  equal(
    entry.questionSkipReason,
    countryNameLeakIds.has(entry.entityId)
      ? 'Die amtliche deutsche Währungsbezeichnung verrät das gefragte Land.'
      : null,
    `Question Skip Reason ${entry.entityId}`,
  );
  equal(
    entry.sourceName,
    'EU Publications Office – Currency authority list',
    `Source Name ${entry.entityId}`,
  );
  equal(entry.sourceUrl, `${EU_RESOURCE_BASE}${entry.isoCode}`, `Direktquelle ${entry.entityId}`);
  equal(entry.sourceVersion, EU_VERSION, `Source Version ${entry.entityId}`);
  equal(entry.sourceAccessed, SOURCE_ACCESSED, `Source Accessed ${entry.entityId}`);
  assert(entry.note.trim().length > 0, `Fehlende Prüfnotiz ${entry.entityId}`);
  answers.add(`${entry.germanName} (${entry.isoCode})`);
}

equal(
  Object.keys(ISO_CODE_BY_ENGLISH_NAME).length,
  expectedEnglishNames.size,
  'Größe des kuratierten Mappings',
);
equal(
  JSON.stringify(sorted(expectedEnglishNames)),
  JSON.stringify(sorted(Object.keys(ISO_CODE_BY_ENGLISH_NAME))),
  'Mapping ohne fehlende oder zusätzliche Namen',
);
equal(
  hashEuProjection(buildCandidateProjection(entries)),
  EU_PROJECTION_SHA256,
  'Offline-Hash der Currency-Projektion',
);

const sourceDecisionIds = Object.keys(SOURCE_DECISIONS).sort();
equal(JSON.stringify(sourceDecisionIds), JSON.stringify(['BG', 'CU', 'EH', 'PS', 'ZW']), 'Entscheidungs-IDs');
equal(
  JSON.stringify(currencyData.sourceDecisions),
  JSON.stringify(
    Object.entries(SOURCE_DECISIONS)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entityId, decision]) => ({ entityId, ...decision })),
  ),
  'Dokumentierte Source-Entscheidungen',
);

const criticalExpected = {
  BG: ['EUR', 'Euro', 'eligible'],
  CU: ['CUP', 'Kubanischer Peso', 'skip-country-name-leak'],
  ZW: ['ZWG', 'Simbabwe-Gold', 'skip-country-name-leak'],
};
for (const [entityId, expected] of Object.entries(criticalExpected)) {
  const entry = entries.find((item) => item.entityId === entityId);
  equal(
    JSON.stringify([entry.isoCode, entry.germanName, entry.questionStatus]),
    JSON.stringify(expected),
    `Kritischer Datensatz ${entityId}`,
  );
}
assert(!entries.some((entry) => entry.entityId === 'EH'), 'EH muss ausgeschlossen bleiben');
assert(!entries.some((entry) => entry.entityId === 'PS'), 'PS muss ausgeschlossen bleiben');

const eligibleEntries = entries.filter((entry) => entry.questionStatus === 'eligible');
const skippedLeakEntries = entries.filter(
  (entry) => entry.questionStatus === 'skip-country-name-leak',
);
equal(currencyData.summary.countryEntities, countries.length, 'Summary countryEntities');
equal(currencyData.summary.entries, entries.length, 'Summary entries');
equal(currencyData.summary.rawCurrencyStrings, expectedRawCurrencies.size, 'Summary rawCurrencyStrings');
equal(currencyData.summary.uniqueEnglishNames, expectedEnglishNames.size, 'Summary uniqueEnglishNames');
equal(
  currencyData.summary.uniqueIsoCodes,
  new Set(entries.map((entry) => entry.isoCode)).size,
  'Summary uniqueIsoCodes',
);
equal(currencyData.summary.verifiedSources, entries.length, 'Summary verifiedSources');
equal(currencyData.summary.questionEligible, eligibleEntries.length, 'Summary questionEligible');
equal(
  currencyData.summary.skippedCountryNameLeaks,
  skippedLeakEntries.length,
  'Summary skippedCountryNameLeaks',
);
equal(
  JSON.stringify(currencyData.summary.skippedCountryNameLeakIds),
  JSON.stringify(skippedLeakEntries.map((entry) => entry.entityId)),
  'Summary skippedCountryNameLeakIds',
);
equal(
  JSON.stringify(currencyData.summary.excludedEntityIds),
  JSON.stringify(['AQ', 'EH', 'PS']),
  'Summary excludedEntityIds',
);
equal(
  JSON.stringify(currencyData.metadata.reviewSampleEntityIds),
  JSON.stringify(expectedReviewSample(entryIds)),
  'Deterministische Review-Stichprobe',
);

const generatorSource = await readFile(resolve(REPO_ROOT, 'scripts/generate_questions.js'), 'utf8');
assert(generatorSource.includes('terra_currency_raw.json'), 'Currency-Rawdaten fehlen im Generator');
assert(!generatorSource.includes('CURRENCY_TRANSLATIONS'), 'Veralteter Übersetzungsfallback ist noch vorhanden');
assert(!generatorSource.includes('Math.random'), 'Terra-Generator ist nicht vollständig deterministisch');
assert(
  !/DISABLED_TYPES\s*=\s*new Set\(\s*\[\s*['"]currency['"]\s*\]\s*\)/u.test(generatorSource),
  'currency ist weiterhin stillgelegt',
);

const questions = JSON.parse(
  await readFile(resolve(REPO_ROOT, 'public/data/questions_terra.json'), 'utf8'),
);
const currencyQuestions = questions.filter((question) => question.type === 'currency');
equal(currencyQuestions.length, eligibleEntries.length, 'Aktive Currency-Fragen');
equal(new Set(currencyQuestions.map((question) => question.entityId)).size, eligibleEntries.length, 'Currency-Entity-Coverage');

const eligibleById = new Map(eligibleEntries.map((entry) => [entry.entityId, entry]));
for (const question of currencyQuestions) {
  const entry = eligibleById.get(question.entityId);
  assert(entry, `Nicht freigegebene Currency-Frage ${question.id}`);
  equal(question.correctAnswer, `${entry.germanName} (${entry.isoCode})`, `Antwort ${question.id}`);
  equal(question.options.length, 4, `Optionslänge ${question.id}`);
  equal(new Set(question.options).size, 4, `Options-Dubletten ${question.id}`);
  for (const option of question.options) {
    assert(answers.has(option), `Unbelegte Currency-Option ${question.id}: ${option}`);
    assert(/^.+ \([A-Z]{3}\)$/u.test(option), `Uneinheitliches Currency-Format ${question.id}: ${option}`);
  }
}

if (ONLINE) {
  const euRecords = await fetchEuCurrencyRecords();
  equal(
    hashEuProjection(buildEuProjection(euRecords)),
    EU_PROJECTION_SHA256,
    'Online-Hash der EU-Projektion',
  );
  for (const code of sorted(new Set(entries.map((entry) => entry.isoCode)))) {
    const eu = euRecords.get(code);
    assert(eu, `EU-SPARQL enthält ${code} nicht`);
    equal(eu.version, EU_VERSION, `Online-EU-Version ${code}`);
    const entry = entries.find((item) => item.isoCode === code);
    equal(entry.germanName, eu.germanLabel, `Online-de-prefLabel ${code}`);
    equal(entry.euEnglishName, eu.englishLabel, `Online-en-prefLabel ${code}`);
    equal(entry.euDeprecated, eu.deprecated, `Online-Deprecated ${code}`);
    equal(entry.useStart, eu.useStart, `Online-Start ${code}`);
    equal(entry.useEnd, eu.useEnd, `Online-End ${code}`);
  }
}

console.log(
  `OK ${ONLINE ? 'online' : 'offline'}: ${checks} Prüfungen; ` +
    `${entries.length} Quellen / ${eligibleEntries.length} Fragen / ` +
    `${skippedLeakEntries.length} Ländername-Leaks übersprungen.`,
);
