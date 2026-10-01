import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

import {
  isAllowedCommonsLicenseMetadata,
  licenseNameFromCommonsMetadata,
} from './image_license_policy.js';

const require = createRequire(import.meta.url);
const { isBlacklistedFile } = require('../data_sources/harvest/image_resolution_policy.cjs');

/** Vergleichsform einer Lizenzbezeichnung: Groß-/Kleinschreibung und „1.0" bei CC0 egal. */
function normaliseLicense(label) {
  return String(label).trim().toLowerCase().replace(/^cc0 1\.0$/, 'cc0');
}

/** Rechtefreigaben gelten sieben Tage und nur für genau diesen Katalog. */
export const RIGHTS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export function catalogFingerprint(images) {
  const rows = [...images].map(([name, entry]) => [name, entry.url, entry.license || '',
    [...(entry.assignments || [])].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])
    .sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
export function rightsBindingProblems(report, images, now = Date.now()) {
  const problems = [];
  if (report?.catalogFingerprint !== catalogFingerprint(images)) {
    problems.push('Rechtebericht passt nicht zum aktuellen Bildkatalog');
  }
  const checked = Date.parse(report?.checkedAt);
  if (!Number.isFinite(checked) || checked > now || now - checked > RIGHTS_MAX_AGE_MS) {
    problems.push('Rechtebericht ist nicht aktuell (höchstens sieben Tage)');
  }
  if (report?.complete !== true) problems.push('Rechteabgleich ist nicht vollständig');
  return problems;
}

/**
 * Baut den Rechtebericht aus Katalog und frisch gelesenen Commons-Metadaten.
 * Die Funktion bleibt ohne Dateizugriff, damit jeder Fehlerfall klein testbar ist.
 */
export function buildRightsReport(images, entries, { checkedAt, complete = true } = {}) {
  const report = {
    checkedAt: checkedAt || new Date().toISOString(),
    catalogFingerprint: catalogFingerprint(images),
    complete,
    missing: [],
    licenseMismatch: [],
    notFree: [],
    blacklisted: [],
  };
  for (const [name, entry] of images) {
    const meta = entries[name];
    if (!meta || meta.missing) {
      report.missing.push(name);
      continue;
    }
    if (isBlacklistedFile(entry.url)) report.blacklisted.push(name);
    if (!isAllowedCommonsLicenseMetadata(meta.extmetadata)) {
      report.notFree.push({ name, commons: licenseNameFromCommonsMetadata(meta.extmetadata) });
      continue;
    }
    const commonsLicense = licenseNameFromCommonsMetadata(meta.extmetadata);
    const licenses = new Set([entry.license, ...(entry.assignments || []).map(row => row[3])]);
    for (const license of licenses) {
      if (license && commonsLicense && commonsLicense !== '?'
          && normaliseLicense(commonsLicense) !== normaliseLicense(license)) {
        report.licenseMismatch.push({ name, katalog: license, commons: commonsLicense });
      }
    }
  }
  return report;
}

/** Nennt jede Datei, deren vorhandene Kopie nicht mehr veröffentlicht werden darf. */
export function invalidMirrorNames(report) {
  const names = new Set();
  for (const name of report?.missing || []) names.add(name);
  for (const item of report?.licenseMismatch || []) names.add(item.name);
  for (const item of report?.notFree || []) names.add(item.name);
  for (const name of report?.blacklisted || []) names.add(name);
  return names;
}

/** Formuliert die Rechteprobleme für CLI und Release-Audit. */
export function rightsProblems(report, images) {
  if (!report || typeof report !== 'object') {
    return ['Rechtebericht fehlt'];
  }
  const problems = images ? rightsBindingProblems(report, images) : [];
  if (!images && report.complete !== true) problems.push('Rechteabgleich ist nicht vollständig');
  if (report.missing?.length) problems.push(`${report.missing.length} Commons-Dateien fehlen`);
  if (report.notFree?.length) problems.push(`${report.notFree.length} Dateien sind nicht frei`);
  if (report.licenseMismatch?.length) {
    problems.push(`${report.licenseMismatch.length} Lizenzbezeichnungen weichen vom Katalog ab`);
  }
  if (report.blacklisted?.length) {
    problems.push(`${report.blacklisted.length} Dateien stehen auf der Sperrliste`);
  }
  return problems;
}

/** Wählt Metadaten immer aus dem ganzen Katalog; der Cache ist keine Rechtefreigabe. */
export function metadataRefreshBatch(names, limit = 0) {
  return limit ? names.slice(0, limit) : [...names];
}
