#!/usr/bin/env node
// Repariert ausschließlich alte harte 200-Zeichen-Schnitte an bestehenden Dateien.
// Ohne --write bleibt die Rohdatenbasis unverändert; Fehler verhindern alle Writes.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import credits from './credit_text.cjs';
import policy from './image_resolution_policy.cjs';
import { isAllowedCommonsLicenseMetadata, licenseNameFromCommonsMetadata } from '../../lib/image_license_policy.js';
import api from '../../lib/commons_api.cjs';
import guardModule from './api_guard.cjs';
import jsonIo from './json_io.cjs';
import { isWikimediaCommonsUrl } from '../../../src/utils/commonsImage.js';
import { hasPublishableAttribution, sanitizeImageAttribution } from '../../../src/utils/imageCredits.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp']);
const DOMAINS = ['astra', 'cultura', 'historia', 'homo', 'lingua', 'machina', 'natura'];
export function needsAttributionRepair(concept) {
  return Boolean(concept.imageFile) && String(concept.imageAttribution || '').length === 200
    && !concept.imageAttribution.endsWith('…');
}

export function repairedAttribution(concept, page) {
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata;
  if (!page || 'missing' in page || !metadata
      || !isWikimediaCommonsUrl(concept.imageFile)
      || policy.isBlacklistedConcept(concept.id)
      || !ALLOWED_MIME.has(info.mime)
      || policy.isBlacklistedFile(concept.imageFile)
      || !isAllowedCommonsLicenseMetadata(metadata)) throw new Error(`${concept.id}: Datei fehlt oder ist nicht frei`);
  const license = licenseNameFromCommonsMetadata(metadata);
  // Ein Lizenzwechsel braucht den vollständigen Rechteabgleich der Bildernte;
  // dieser gezielte Lauf darf ihn nicht durch einen neuen Credit verdecken.
  if (license !== concept.imageLicense) throw new Error(`${concept.id}: Lizenzwechsel (${concept.imageLicense} → ${license})`);
  const attribution = sanitizeImageAttribution(credits.commonsAttribution(metadata));
  if (!attribution || !hasPublishableAttribution(license, attribution)) throw new Error(`${concept.id}: kein belastbarer Nachweis`);
  return attribution;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--write')) throw new Error('Aufruf: repair_truncated_attribution.mjs [--write]');
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const data = new Map();
  const targets = [];
  for (const domain of DOMAINS) {
    const file = join(dataDir, `${domain}_raw.json`);
    const records = JSON.parse(await readFile(file, 'utf8'));
    data.set(domain, { file, records });
    for (const concept of records.filter(needsAttributionRepair)) targets.push({ domain, concept });
  }
  const titles = [...new Set(targets.map(({ concept }) => 'File:' + policy.normalizeCommonsFileTitle(concept.imageFile)))];
  const pages = new Map();
  const guard = guardModule.createApiGuard({ label: 'Commons-Nachweise' });
  for (let i = 0; i < titles.length; i += 50) {
    const group = titles.slice(i, i + 50);
    const params = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo',
      iiprop: 'extmetadata|mime', iiextmetadatalanguage: 'de', titles: group.join('|'), maxlag: '5' });
    const payload = await api.fetchWikiJson(`${api.API_ENDPOINT}?${params}`, { apiGuard: guard });
    const aliases = new Map((payload.query?.normalized || []).map(row => [row.from, row.to]));
    const byTitle = new Map(Object.values(payload.query?.pages || {}).map(page => [page.title, page]));
    for (const title of group) pages.set(title, byTitle.get(aliases.get(title) || title));
    await api.sleep(250);
  }
  const changedDomains = new Set();
  for (const { domain, concept } of targets) {
    const title = 'File:' + policy.normalizeCommonsFileTitle(concept.imageFile);
    const attribution = repairedAttribution(concept, pages.get(title));
    console.log(`${domain}:${concept.id}: ${concept.imageAttribution.length} → ${attribution.length} Zeichen`);
    concept.imageAttribution = attribution;
    changedDomains.add(domain);
  }
  if (args.includes('--write')) {
    for (const domain of changedDomains) {
      const { file, records } = data.get(domain);
      jsonIo.writeJsonAtomic(file, records);
    }
  }
  console.log(`${targets.length} Nachweise, ${titles.length} Commons-Dateien; ${args.includes('--write') ? 'geschrieben' : 'Dry-Run'}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
