/**
 * Baut eine kompakte Dedup-Namensliste je Kategorie aus <domain>_raw.json, damit
 * Finder-Agenten keine bereits vorhandenen Konzepte erneut „entdecken". Schreibt
 * harvest/dedup_<domain>.json = { byCategory: { <cat>: [Name, …] }, total }.
 *
 * Aufruf: node build_dedup.cjs <domain>
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..', '..');
const domain = process.argv[2];
if (!domain) { console.error('Aufruf: build_dedup.cjs <domain>'); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'data_sources', `${domain}_raw.json`), 'utf8'));
const byCategory = {};
for (const c of raw) (byCategory[c.category] ||= []).push(c.name);
for (const k of Object.keys(byCategory)) byCategory[k].sort((a, b) => a.localeCompare(b, 'de'));
const out = { domain, total: raw.length, byCategory };
const outPath = path.join(__dirname, `dedup_${domain}.json`);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`${domain}: ${raw.length} Konzepte, ${Object.keys(byCategory).length} Kategorien -> ${outPath}`);
for (const [k, v] of Object.entries(byCategory)) console.log(`  ${k}: ${v.length}`);
