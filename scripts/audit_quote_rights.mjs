#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { isDocumentedDeathYear } from './lib/quoteRights.mjs';

const CURRENT_YEAR = new Date().getUTCFullYear();
const PUBLIC_DOMAIN_DEATH_YEAR = CURRENT_YEAR - 71;
const raw = JSON.parse(await readFile('scripts/data_sources/cultura_raw.json', 'utf8'));
const quotes = raw.filter((concept) => concept.category === 'quote');
const errors = [];

for (const quote of quotes) {
  const prefix = `cultura:${quote.id}`;
  const authorDeathYear = quote.attributes?.authorDeathYear;
  const rights = quote.quoteRights || {};

  if (!isDocumentedDeathYear(authorDeathYear) || authorDeathYear > PUBLIC_DOMAIN_DEATH_YEAR) {
    errors.push(`${prefix}: Urheber ist in Deutschland nicht nachweislich gemeinfrei`);
  }
  if (!/^https:\/\//.test(String(quote.sourceUrl || ''))) {
    errors.push(`${prefix}: überprüfbare Fundstelle fehlt`);
  }
  if (/(?:fälschlich|zweifelhaft|zugeschrieben|unbelegt)/i.test(String(quote.attributes?.work || ''))) {
    errors.push(`${prefix}: Quelle kennzeichnet die Zuschreibung als unsicher`);
  }

  if (rights.basis === 'de-original') {
    if (rights.originalLanguage !== 'de') {
      errors.push(`${prefix}: deutsche Originalsprache ist nicht dokumentiert`);
    }
    continue;
  }

  if (rights.basis === 'public-domain-translation') {
    const translatorDeathYear = rights.translatorDeathYear;
    if (!rights.translator || !isDocumentedDeathYear(translatorDeathYear)
        || translatorDeathYear > PUBLIC_DOMAIN_DEATH_YEAR) {
      errors.push(`${prefix}: Übersetzer und Gemeinfreiheit sind nicht belegt`);
    }
    continue;
  }

  if (rights.basis === 'licensed-translation') {
    if (!rights.translator || !/^https:\/\//.test(String(rights.licenseUrl || ''))) {
      errors.push(`${prefix}: Übersetzer oder Lizenzlink fehlt`);
    }
    continue;
  }

  errors.push(`${prefix}: Rechtsgrundlage für den deutschen Wortlaut fehlt`);
}

if (errors.length) {
  errors.forEach((error) => console.error(`✗ ${error}`));
  console.error(`${errors.length} Rechtefehler bei ${quotes.length} Zitaten.`);
  process.exit(1);
}

console.log(`✓ ${quotes.length} Zitate: Autor, Fundstelle und Rechte am deutschen Wortlaut sind dokumentiert.`);
