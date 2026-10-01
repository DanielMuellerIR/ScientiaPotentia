/**
 * Das Bildmanifest lesen und gegen Katalog und Dateien abgleichen.
 *
 * Bewusst getrennt von `scripts/mirror_concept_images.mjs`: Der Release-Audit
 * braucht nur diese Prüfungen, nicht die Bildverarbeitung. Läge alles in einer
 * Datei, zöge jeder `npm run build` die Bildbibliothek `sharp` mit, die nur zum
 * Ernten gebraucht wird.
 */

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mit Dateiendung importieren: Vite ergänzt ein fehlendes `.js` still, Node nicht.
import { fileNameFromCommonsUrl } from '../../src/utils/commonsImage.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const DATA_DIR = join(ROOT, 'public', 'data');
export const MIRROR_DIR = join(ROOT, 'public', 'images', 'concepts');
export const MANIFEST_PATH = join(DATA_DIR, 'image_mirror.json');
/** Öffentlicher Pfad der Kopien, relativ zum Dokument. */
export const PUBLIC_PREFIX = 'images/concepts';

/**
 * Pfad einer Kopie innerhalb des Bildverzeichnisses.
 *
 * Die rund 9000 Dateien liegen nicht flach in einem Ordner, sondern in 256
 * Unterordnern nach den ersten beiden Zeichen des Hashes. Ein einzelnes
 * Verzeichnis dieser Größe bremst sowohl das FTP-Listing beim Deploy als auch
 * die Dateiverwaltung mancher Hoster. Die App bildet denselben Pfad in
 * `src/utils/imageMirror.js`.
 */
export function mirrorPathFor(fileName) {
  return `${fileName.slice(0, 2)}/${fileName}`;
}

/** Liest eine JSON-Datei; unlesbar oder fehlend ergibt den Ersatzwert. */
export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Liest alle veröffentlichten Konzeptbilder aus den Katalogdateien.
 *
 * @returns {Promise<{images: Map<string, object>, foreign: {concept:string, url:string}[]}>}
 *   `images` bildet den Commons-Dateinamen auf Lizenz, Domains und Konzepte ab.
 *   `foreign` sammelt Bildadressen außerhalb von Wikimedia Commons: Das
 *   Ernteskript kann sie nicht kopieren, und weil die App ausschließlich eigene
 *   Kopien anzeigt, wäre ein solcher Eintrag ein unsichtbar bleibendes Bild. Der
 *   Audit meldet sie deshalb, statt sie zu übergehen.
 */
export async function collectCatalogImages(dataDir = DATA_DIR) {
  const files = (await readdir(dataDir)).filter((name) => /^concepts_.+\.json$/.test(name));
  const images = new Map();
  const foreign = [];
  for (const file of files.sort()) {
    const domain = file.replace(/^concepts_|\.json$/g, '');
    const concepts = await readJson(join(dataDir, file), {});
    for (const concept of Object.values(concepts)) {
      const url = concept?.image?.url;
      if (!url) continue;
      const name = fileNameFromCommonsUrl(url);
      if (!name) {
        foreign.push({ concept: concept.id || '?', url });
        continue;
      }
      let entry = images.get(name);
      if (!entry) {
        entry = { url, license: concept.image.license || '', domains: new Set(), concepts: [], assignments: [] };
        images.set(name, entry);
      }
      entry.assignments.push([domain, concept.id || '?', url, concept.image.license || '']);
      entry.domains.add(domain);
      entry.concepts.push(concept.id || '?');
    }
  }
  return { images, foreign };
}

/**
 * Gleicht Katalog, Manifest und abgelegte Dateien gegeneinander ab.
 *
 * @returns {Promise<object>} `withoutEntry` (Bild ohne Manifesteintrag),
 *   `withoutFile` (Eintrag ohne Datei), `orphanFiles` (Datei ohne Eintrag),
 *   `foreign` (Bildquelle außerhalb von Commons) und die Zählungen.
 */
export async function verifyMirror({
  dataDir = DATA_DIR,
  mirrorDir = MIRROR_DIR,
  manifestPath = MANIFEST_PATH,
} = {}) {
  const { images, foreign } = await collectCatalogImages(dataDir);
  const problems = {
    withoutEntry: [],
    withoutFile: [],
    orphanFiles: [],
    // Adressen außerhalb von Commons kann das Ernteskript nicht kopieren.
    foreign,
  };
  const manifest = await readJson(manifestPath, null);
  if (!manifest || !manifest.files) {
    return { ...problems, fatal: 'Manifest fehlt oder ist unlesbar.', total: images.size };
  }

  const referenced = new Set();
  for (const name of images.keys()) {
    const entry = manifest.files[name];
    if (!entry) {
      problems.withoutEntry.push(name);
      continue;
    }
    const [baseFile, , , thumbFile] = entry;
    for (const file of [baseFile, thumbFile].filter(Boolean)) {
      referenced.add(file);
      if (!existsSync(join(mirrorDir, mirrorPathFor(file)))) {
        problems.withoutFile.push(`${name} -> ${file}`);
      }
    }
  }

  if (existsSync(mirrorDir)) {
    for (const shard of await readdir(mirrorDir, { withFileTypes: true })) {
      if (!shard.isDirectory()) {
        problems.orphanFiles.push(shard.name);
        continue;
      }
      for (const file of await readdir(join(mirrorDir, shard.name))) {
        if (!referenced.has(file)) problems.orphanFiles.push(`${shard.name}/${file}`);
      }
    }
  }
  return { ...problems, total: images.size, mirrored: images.size - problems.withoutEntry.length };
}
