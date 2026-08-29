#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  isAllowedImageLicense,
  isConcreteImageAttribution,
  licenseUrlFor,
  sanitizeImageAttribution,
} from '../src/utils/imageCredits.js';

const DOMAINS = ['astra', 'cultura', 'historia', 'homo', 'lingua', 'machina', 'natura'];
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const COMMONS_REUSE_URL = 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia';
const errors = [];
let checked = 0;

function validate(domain, id, image, layer) {
  checked += 1;
  const prefix = `${layer} ${domain}:${id}`;
  const attribution = sanitizeImageAttribution(image.attribution ?? image.imageAttribution);
  const license = String(image.license ?? image.imageLicense ?? '');
  const sourceUrl = String(image.sourceUrl ?? image.url ?? image.imageFile ?? '');
  const licenseUrl = String(image.licenseUrl ?? image.imageLicenseUrl ?? licenseUrlFor(license));
  const changes = String(image.changes ?? image.imageChanges ?? 'für die Anzeige technisch skaliert');

  if (!sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File')) {
    errors.push(`${prefix}: keine Commons-Dateiseite als Quelle`);
  }
  if (!attribution) errors.push(`${prefix}: Urheberangabe fehlt`);
  const attributionRequired = !/^(?:Public domain|PD\b|CC0\b)/i.test(license);
  const genericCommonsCredit = /^(?:Wikimedia Commons|Commons)$/i.test(attribution);
  if (!isConcreteImageAttribution(attribution)
      && (attributionRequired || genericCommonsCredit)) {
    errors.push(`${prefix}: freie Lizenz verlangt einen konkreten Rechteinhaber`);
  }
  if (EMAIL.test(String(image.attribution ?? image.imageAttribution ?? ''))) {
    errors.push(`${prefix}: Kontaktadresse im Credit`);
  }
  if (!license) errors.push(`${prefix}: Lizenzbezeichnung fehlt`);
  else if (!isAllowedImageLicense(license)) {
    errors.push(`${prefix}: unbekannte oder nicht kompatible Lizenz ${license}`);
  }
  if (!/^https:\/\//.test(licenseUrl) || licenseUrl === COMMONS_REUSE_URL) {
    errors.push(`${prefix}: konkreter Lizenzlink fehlt`);
  }
  if (!changes) errors.push(`${prefix}: Änderungshinweis fehlt`);
}

for (const domain of DOMAINS) {
  const raw = JSON.parse(await readFile(join('scripts', 'data_sources', `${domain}_raw.json`), 'utf8'));
  for (const concept of raw) {
    if (!concept.imageFile) continue;
    validate(domain, concept.id, {
      url: concept.imageFile,
      sourceUrl: concept.imageFile,
      license: concept.imageLicense,
      licenseUrl: concept.imageLicenseUrl,
      attribution: concept.imageAttribution,
      changes: concept.imageChanges,
    }, 'Rohdaten');
  }

  const concepts = JSON.parse(await readFile(join('public', 'data', `concepts_${domain}.json`), 'utf8'));
  for (const concept of Object.values(concepts)) {
    if (!concept.image?.url) continue;
    validate(domain, concept.id, concept.image, 'Generator');
  }
}

if (errors.length) {
  errors.slice(0, 100).forEach((error) => console.error(`✗ ${error}`));
  console.error(`${errors.length} Bildnachweisfehler bei ${checked} Prüfungen.`);
  process.exit(1);
}

console.log(`✓ ${checked} Bildnachweise enthalten Quelle, Urheber, freie Lizenz, Lizenzlink und Änderungshinweis.`);
