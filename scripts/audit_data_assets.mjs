#!/usr/bin/env node
/**
 * Prüft vor jedem Release, dass jede angeforderte Katalogdatei auch vorliegt.
 *
 * `buildDataAssetMap` baut die Zuordnung Klarname -> gehashter Name aus dem,
 * was in `public/data/` liegt. Eine fehlende Datei fällt dort einfach heraus:
 * Der Build lief mit Ausstieg 0 durch, die App forderte die Datei unter ihrem
 * Klarnamen an, und im Release gab es sie nicht. So verlor Fassung 2.0.2 die
 * Weltkarte. Der einzige Wächter war ein Test, der nur unter `npm test` läuft —
 * ein CI-Verzeichnis gibt es nicht.
 *
 * Geprüft wird zusätzlich, dass die Zuordnung wirklich jede angeforderte Datei
 * enthält: Eine Datei, die zwar existiert, aber keinen Hash bekommt, wäre im
 * Release ebenso unerreichbar.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDataAssetMap } from './lib/data_asset_hashes.mjs';
import { GEO_FILE_COUNT, collectRequestedDataFiles } from './lib/required_data_files.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'src');
const DATA_DIR = join(ROOT, 'public', 'data');

const problems = [];
const { files, geoFiles } = collectRequestedDataFiles(SRC_DIR);
const assetMap = buildDataAssetMap(DATA_DIR);

// Findet die Erkennung plötzlich nichts mehr, prüft dieser Audit ins Leere und
// meldete bisher trotzdem Erfolg. Beide Zahlen sind deshalb Teil der Prüfung.
if (files.length < 19) {
  problems.push(`nur ${files.length} angeforderte Katalogdateien im Quelltext gefunden — `
    + 'die Erkennung in scripts/lib/required_data_files.mjs greift nicht mehr');
}
if (geoFiles.length !== GEO_FILE_COUNT) {
  problems.push(`${geoFiles.length} statt ${GEO_FILE_COUNT} Geometriedateien in useGeoData erkannt`);
}

for (const name of files) {
  if (!existsSync(join(DATA_DIR, name))) {
    problems.push(`${name}: von der App angefordert, fehlt aber in public/data`);
  } else if (!assetMap[name]) {
    problems.push(`${name}: liegt vor, bekommt aber keinen Inhaltshash — im Release unerreichbar`);
  }
}

if (!problems.length) {
  process.stdout.write(
    `[data-assets] ${files.length} angeforderte Katalogdateien liegen vor und werden gehasht.\n`,
  );
  process.exit(0);
}

process.stderr.write(`[data-assets] ${problems.length} Befund(e):\n`);
for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
process.exit(1);
