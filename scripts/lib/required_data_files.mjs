/**
 * Welche Katalogdateien fordert die App zur Laufzeit an?
 *
 * Die Antwort steht im Quelltext: `dataUrl('name.json')` an den festen Stellen
 * und die Tabelle in `src/utils/useGeoData.js`, die ihre Geometriedateien über
 * eine Variable auflöst. Beide Formen werden hier gelesen.
 *
 * Warum überhaupt: `buildDataAssetMap` baut die Zuordnung aus dem, was in
 * `public/data/` liegt. Fehlt eine Datei, fehlt sie eben in der Zuordnung — der
 * Build lief bis zum 2026-09-10 mit Ausstieg 0 durch, und im Release fehlte
 * still ein Katalog. Genau so verlor 2.0.2 die Weltkarte. Der einzige Wächter
 * war ein Test, der nur unter `npm test` läuft.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** So viele Geometriedateien löst `useGeoData` über eine Variable auf. */
export const GEO_FILE_COUNT = 3;

/** Alle .js/.jsx unter einem Verzeichnis, ohne die Tests selbst. */
export function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.jsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * Liest die angeforderten Klarnamen aus dem Quelltext.
 *
 * @param {string} srcDir Wurzel des Anwendungsquelltexts, üblicherweise `src/`.
 * @returns {{files: string[], geoFiles: string[]}} `files` enthält beide Formen.
 */
export function collectRequestedDataFiles(srcDir) {
  const quelle = sourceFiles(srcDir).map((file) => readFileSync(file, 'utf8')).join('\n');
  // Literale Aufrufe (Kataloge, Statistik, Bildmanifest) — in einfachen wie
  // doppelten Anführungszeichen.
  const files = [...quelle.matchAll(/dataUrl\(\s*['"]([^'"]+)['"]\s*\)/g)]
    .map((treffer) => treffer[1]);
  // … und die Geometriedateien aus der Tabelle in `useGeoData`.
  const geoFiles = [...quelle.matchAll(/^\s+\w+: '([\w.]+\.(?:json|geojson))'/gm)]
    .map((treffer) => treffer[1]);
  files.push(...geoFiles);
  return { files: [...new Set(files)], geoFiles };
}
