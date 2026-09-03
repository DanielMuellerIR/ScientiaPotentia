/**
 * Inhaltshashes der Katalogdateien unter `public/data/`.
 *
 * Gemeinsame Wahrheit für das Vite-Plugin (baut die Zuordnung in die
 * `index.html` und benennt die Dateien in `dist/` um) und für die Tests.
 * Warum überhaupt gehasht wird, steht in `src/utils/dataUrl.js`.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Länge des Hex-Hashes im Dateinamen. Acht Zeichen genügen für diesen Bestand. */
export const HASH_LENGTH = 8;

/** Nur Katalogdateien werden gehasht; alles andere in `public/` bleibt unberührt. */
const HASHED_EXTENSIONS = ['.json', '.geojson'];

/** Erkennt einen bereits gehashten Namen, damit ein zweiter Lauf nicht doppelt hasht. */
const ALREADY_HASHED = new RegExp(`\\.[0-9a-f]{${HASH_LENGTH}}\\.(json|geojson)$`);

/** Fügt den Hash vor der Endung ein: "a.json" + "1234abcd" -> "a.1234abcd.json". */
export function hashedName(fileName, hash) {
  const dot = fileName.lastIndexOf('.');
  return `${fileName.slice(0, dot)}.${hash}${fileName.slice(dot)}`;
}

/**
 * Baut die Zuordnung Klarname -> gehashter Name für ein Datenverzeichnis.
 *
 * @param {string} dataDir  Verzeichnis mit den Katalogdateien.
 * @returns {Record<string, string>} leer, wenn das Verzeichnis fehlt.
 */
export function buildDataAssetMap(dataDir) {
  let entries;
  try {
    entries = readdirSync(dataDir, { withFileTypes: true });
  } catch {
    return {};
  }
  const map = {};
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!HASHED_EXTENSIONS.some(extension => name.endsWith(extension))) continue;
    if (ALREADY_HASHED.test(name)) continue;
    const hash = createHash('sha256')
      .update(readFileSync(join(dataDir, name)))
      .digest('hex')
      .slice(0, HASH_LENGTH);
    map[name] = hashedName(name, hash);
  }
  return map;
}
