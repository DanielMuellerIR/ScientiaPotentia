/**
 * Baut eine kompakte Dedup-Namensliste je Kategorie aus <domain>_raw.json, damit
 * Finder-Agenten keine bereits vorhandenen Konzepte erneut „entdecken". Schreibt
 * harvest/dedup_<domain>.json = { byCategory: { <cat>: [Name, …] }, total }.
 *
 * Aufruf: node build_dedup.cjs <domain>
 */
const path = require('node:path');
const {
  assertSafeDomain, readJsonArray, writeJsonAtomic
} = require('./json_io.cjs');
const ROOT = path.join(__dirname, '..', '..', '..');

function main() {
  const [domainArgument, ...extra] = process.argv.slice(2);
  if (!domainArgument || extra.length) {
    console.error('Aufruf: build_dedup.cjs <domain>');
    return 1;
  }
  try {
    const domain = assertSafeDomain(domainArgument);
    const raw = readJsonArray(
      path.join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`),
      `${domain}_raw.json`,
    );
    const byCategory = {};
    raw.forEach((concept, index) => {
      if (!concept || typeof concept.category !== 'string' || !concept.category.trim()
          || typeof concept.name !== 'string' || !concept.name.trim()) {
        throw new Error(`Konzept ${index + 1}: category und name als Text erforderlich`);
      }
      (byCategory[concept.category] ||= []).push(concept.name);
    });
    for (const category of Object.keys(byCategory)) {
      byCategory[category].sort((a, b) => a.localeCompare(b, 'de'));
    }
    const output = { domain, total: raw.length, byCategory };
    const outputPath = path.join(__dirname, `dedup_${domain}.json`);
    writeJsonAtomic(outputPath, output);
    console.log(`${domain}: ${raw.length} Konzepte, ${Object.keys(byCategory).length} Kategorien -> ${outputPath}`);
    for (const [category, names] of Object.entries(byCategory)) {
      console.log(`  ${category}: ${names.length}`);
    }
    return 0;
  } catch (error) {
    console.error(`FEHLER: ${error.message}`);
    return 1;
  }
}

process.exitCode = main();
