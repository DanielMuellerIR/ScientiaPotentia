#!/usr/bin/env node

/**
 * Offline-Gate für das isolierte Currency-Kandidatenartefakt.
 *
 * Mit --online werden zusätzlich alle im Artefakt verwendeten Codes, Labels,
 * Versions-, Status- und Nutzungsfelder erneut über den gepinnten EU-SPARQL-
 * Query geprüft. Ohne Flag wird keinerlei Netzwerkzugriff benötigt.
 */

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import {
  BLOCKED_ISSUES,
  CANDIDATE_PATH,
  EU_PROJECTION_SHA256,
  EU_QUERY,
  EU_RESOURCE_BASE,
  EU_VERSION,
  GEODB_PATH,
  ISO_CODE_BY_ENGLISH_NAME,
  REPO_ROOT,
  SOURCES,
  SOURCE_ACCESSED,
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
  if (!condition) {
    throw new Error(message);
  }
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

async function collectFiles(path) {
  const directoryEntries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const directoryEntry of directoryEntries) {
    const childPath = resolve(path, directoryEntry.name);
    if (directoryEntry.isDirectory()) {
      files.push(...(await collectFiles(childPath)));
    } else {
      files.push(childPath);
    }
  }
  return files;
}

const candidatePath = process.env.TERRA_CURRENCY_F_CANDIDATE
  ? resolve(process.env.TERRA_CURRENCY_F_CANDIDATE)
  : CANDIDATE_PATH;
const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
const geodbBytes = await readFile(GEODB_PATH);
const geodb = JSON.parse(geodbBytes);
const countries = Object.values(geodb.entities)
  .filter((entity) => entity.type === 'country')
  .sort((left, right) => left.id.localeCompare(right.id));
const currencyCountries = countries.filter((entity) => entity.metadata?.currency !== 'N/A');
const entries = candidate.entries;

equal(candidate.metadata.artifact, 'terra-currency-f', 'Artefaktkennung');
equal(candidate.metadata.schemaVersion, 1, 'Schema-Version');
equal(candidate.metadata.candidateOnly, true, 'candidateOnly');
equal(candidate.metadata.rawMergeApproved, false, 'rawMergeApproved');
equal(
  candidate.metadata.questionReactivationApproved,
  false,
  'questionReactivationApproved',
);
equal(candidate.metadata.inputPath, 'src/data/geodb.json', 'Inputpfad');
equal(candidate.metadata.inputSha256, sha256(geodbBytes), 'SHA-256 des geodb-Inputs');
equal(candidate.metadata.generatedOn, SOURCE_ACCESSED, 'generatedOn');
equal(candidate.metadata.sourceDatasetVersion, EU_VERSION, 'EU-Dataset-Version');
assert(candidate.metadata.sourceQuery === EU_QUERY, 'Gepinnter EU-Query weicht vom Code ab');
equal(candidate.metadata.sourceQuerySha256, sha256(EU_QUERY), 'SHA-256 des EU-Query');
equal(
  candidate.metadata.sourceProjectionSha256,
  EU_PROJECTION_SHA256,
  'Metadata-Hash der EU-Projektion',
);
assert(
  JSON.stringify(candidate.sources) === JSON.stringify(SOURCES),
  'Vollständiger Quellenblock weicht vom Code ab',
);
equal(candidate.sources.length, 3, 'Anzahl Quellen');
for (const source of candidate.sources) {
  assert(source.sourceUrl.startsWith('https://'), `Nicht-HTTPS-Quellen-URL: ${source.sourceUrl}`);
  if (source.machineReadableUrl) {
    assert(
      source.machineReadableUrl.startsWith('https://'),
      `Nicht-HTTPS-Maschinenquelle: ${source.machineReadableUrl}`,
    );
  }
}

equal(countries.length, 175, 'Anzahl Country-Entities');
equal(currencyCountries.length, 174, 'Anzahl Country-Entities mit Currency');
equal(countries.find((entity) => entity.id === 'AQ')?.metadata?.currency, 'N/A', 'AQ Currency');
assert(!entries.some((entry) => entry.entityId === 'AQ'), 'AQ darf keinen Kandidateneintrag haben');
equal(entries.length, 174, 'Anzahl Kandidateneinträge');

const entryIds = entries.map((entry) => entry.entityId);
equal(new Set(entryIds).size, 174, 'Eindeutige Entity-IDs');
equal(new Set(entries.map((entry) => entry.id)).size, 174, 'Eindeutige Kandidaten-IDs');
equal(JSON.stringify(entryIds), JSON.stringify(sorted(entryIds)), 'Sortierung der Entity-IDs');
equal(
  JSON.stringify(entryIds),
  JSON.stringify(currencyCountries.map((entity) => entity.id)),
  'Vollständige Entity-Coverage',
);

const expectedEnglishNames = new Set();
const expectedRawCurrencies = new Set();
const countryById = new Map(currencyCountries.map((entity) => [entity.id, entity]));

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
  equal(
    entry.sourceName,
    'EU Publications Office – Currency authority list',
    `Source Name ${entry.entityId}`,
  );
  equal(entry.sourceUrl, `${EU_RESOURCE_BASE}${entry.isoCode}`, `Direktquelle ${entry.entityId}`);
  assert(entry.sourceUrl.startsWith('https://'), `Nicht-HTTPS-Quelle ${entry.entityId}`);
  equal(entry.sourceVersion, EU_VERSION, `Source Version ${entry.entityId}`);
  equal(entry.sourceAccessed, SOURCE_ACCESSED, `Source Accessed ${entry.entityId}`);

  const issue = BLOCKED_ISSUES[entry.entityId] ?? null;
  equal(
    entry.status,
    issue ? 'blocked-source-data' : 'verified-candidate',
    `Status ${entry.entityId}`,
  );
  equal(entry.issueType, issue?.issueType ?? null, `Issue Type ${entry.entityId}`);
  equal(entry.replacementCode, issue?.replacementCode ?? null, `Replacement ${entry.entityId}`);
  assert(entry.note.trim().length > 0, `Fehlende Prüfnotiz ${entry.entityId}`);
}

equal(expectedRawCurrencies.size, 137, 'Eindeutige Raw-Currency-Strings');
equal(expectedEnglishNames.size, 135, 'Eindeutige englische Namen');
equal(Object.keys(ISO_CODE_BY_ENGLISH_NAME).length, 135, 'Größe des kuratierten Mappings');
equal(
  JSON.stringify(sorted(expectedEnglishNames)),
  JSON.stringify(sorted(Object.keys(ISO_CODE_BY_ENGLISH_NAME))),
  'Mapping ohne fehlende oder zusätzliche Namen',
);
equal(new Set(Object.values(ISO_CODE_BY_ENGLISH_NAME)).size, 134, 'Eindeutige ISO-Codes');
const candidateProjectionHash = hashEuProjection(buildCandidateProjection(entries));
equal(candidateProjectionHash, EU_PROJECTION_SHA256, 'Offline-Hash der Kandidatenprojektion');

const blockedIds = entries
  .filter((entry) => entry.status === 'blocked-source-data')
  .map((entry) => entry.entityId);
equal(JSON.stringify(blockedIds), JSON.stringify(['BG', 'CU', 'EH', 'PS', 'ZW']), 'Blockierte IDs');
equal(candidate.issues.length, 5, 'Anzahl dokumentierter Issues');
equal(
  JSON.stringify(candidate.issues.map((issue) => issue.entityId)),
  JSON.stringify(['BG', 'CU', 'EH', 'PS', 'ZW']),
  'Issue-Reihenfolge',
);

const criticalExpected = {
  BG: ['BGN', 'Lew', true, '2026-01-01', 'EUR'],
  CU: ['CUC', 'Konvertibler Peso', true, '2021-06-30', 'CUP'],
  EH: ['DZD', 'Algerischer Dinar', false, null, 'MAD'],
  PS: ['EGP', 'Ägyptisches Pfund', false, null, null],
  ZW: ['ZWL', 'Simbabwe-Dollar', true, '2024-08-31', 'ZWG'],
};
for (const [entityId, expected] of Object.entries(criticalExpected)) {
  const entry = entries.find((item) => item.entityId === entityId);
  equal(
    JSON.stringify([
      entry.isoCode,
      entry.germanName,
      entry.euDeprecated,
      entry.useEnd,
      entry.replacementCode,
    ]),
    JSON.stringify(expected),
    `Kritischer Datensatz ${entityId}`,
  );
}

const specialCodes = {
  GL: ['DKK', 'Dänische Krone'],
  BF: ['XOF', 'CFA-Franc (BCEAO)'],
  CF: ['XAF', 'CFA-Franc (BEAC)'],
  KP: ['KPW', 'Nordkoreanischer Won'],
  KR: ['KRW', 'Südkoreanischer Won'],
  SZ: ['SZL', 'Lilangeni'],
};
for (const [entityId, [code, germanName]] of Object.entries(specialCodes)) {
  const entry = entries.find((item) => item.entityId === entityId);
  equal(
    JSON.stringify([entry.isoCode, entry.germanName]),
    JSON.stringify([code, germanName]),
    `Sonderzuordnung ${entityId}`,
  );
}

equal(candidate.summary.countryEntities, 175, 'Summary countryEntities');
equal(candidate.summary.entries, 174, 'Summary entries');
equal(candidate.summary.rawCurrencyStrings, 137, 'Summary rawCurrencyStrings');
equal(candidate.summary.uniqueEnglishNames, 135, 'Summary uniqueEnglishNames');
equal(candidate.summary.uniqueIsoCodes, 134, 'Summary uniqueIsoCodes');
equal(candidate.summary.verifiedCandidates, 169, 'Summary verifiedCandidates');
equal(candidate.summary.blockedSourceData, 5, 'Summary blockedSourceData');
equal(JSON.stringify(candidate.summary.excludedEntityIds), JSON.stringify(['AQ']), 'Summary AQ');
equal(
  JSON.stringify(candidate.summary.blockedEntityIds),
  JSON.stringify(['BG', 'CU', 'EH', 'PS', 'ZW']),
  'Summary blockedEntityIds',
);
equal(
  JSON.stringify(candidate.metadata.reviewSampleEntityIds),
  JSON.stringify(expectedReviewSample(entryIds)),
  'Deterministische Review-Stichprobe',
);

const generatorSource = await readFile(resolve(REPO_ROOT, 'scripts/generate_questions.js'), 'utf8');
assert(
  /DISABLED_TYPES\s*=\s*new Set\(\s*\[\s*['"]currency['"]\s*\]\s*\)/u.test(generatorSource),
  'currency ist im Generator nicht mehr eindeutig stillgelegt',
);
assert(
  !generatorSource.includes('cand_terra_currency_f'),
  'Kandidatenartefakt ist im Produktgenerator integriert',
);

const questions = JSON.parse(
  await readFile(resolve(REPO_ROOT, 'public/data/questions_terra.json'), 'utf8'),
);
equal(
  questions.filter((question) => question.type === 'currency').length,
  0,
  'Aktive Currency-Fragen',
);

const integrationRoots = [resolve(REPO_ROOT, 'src'), resolve(REPO_ROOT, 'public')];
for (const integrationRoot of integrationRoots) {
  const files = await collectFiles(integrationRoot);
  for (const file of files.filter((path) =>
    ['.js', '.jsx', '.mjs', '.cjs', '.json'].includes(extname(path)),
  )) {
    const content = await readFile(file, 'utf8');
    assert(
      !content.includes('cand_terra_currency_f'),
      `Unerlaubte Produktintegration in ${file.slice(REPO_ROOT.length + 1)}`,
    );
  }
}

if (ONLINE) {
  const euRecords = await fetchEuCurrencyRecords();
  equal(
    hashEuProjection(buildEuProjection(euRecords)),
    EU_PROJECTION_SHA256,
    'Online-Hash der EU-Projektion',
  );
  const usedCodes = sorted(new Set(entries.map((entry) => entry.isoCode)));

  for (const code of usedCodes) {
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

  for (const replacementCode of ['EUR', 'CUP', 'MAD', 'ZWG']) {
    const replacement = euRecords.get(replacementCode);
    assert(replacement, `EU-SPARQL enthält Replacement-Code ${replacementCode} nicht`);
    equal(replacement.version, EU_VERSION, `Replacement-Version ${replacementCode}`);
  }
}

console.log(
  `OK ${ONLINE ? 'online' : 'offline'}: ${checks} Prüfungen; ` +
    '174 Einträge / 135 Namen / 137 Rawstrings / 5 blockiert; keine Produktintegration.',
);
