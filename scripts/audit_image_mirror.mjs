#!/usr/bin/env node
/**
 * Prüft vor jedem Release, dass zu jedem Konzeptbild eine eigene Kopie vorliegt.
 *
 * Ohne diese Prüfung könnte ein Release mit lückenhaftem Bildbestand
 * herausgehen: Die App weicht bei fehlender Kopie bewusst NICHT auf
 * commons.wikimedia.org aus — sie zeigt dann gar kein Bild. Ein solcher
 * Ausfall soll im Build auffallen und nicht erst beim Besucher.
 *
 * Zusätzlich meldet der Audit einen Hotlink im Quelltext: Käme irgendwo wieder
 * eine `Special:FilePath`-Adresse als Bildquelle zurück, ginge die IP-Adresse
 * des Besuchers erneut an einen Dritten.
 *
 * Der Ausstieg 0 bedeutet: vollständig. Ausstieg 1 nennt die Lücken.
 *
 * Ein Klon ohne geerntete Bilder kann mit SCIENTIA_ALLOW_MISSING_IMAGES=1
 * trotzdem bauen — das Ergebnis ist dann ausdrücklich kein Release.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { verifyMirror } from './lib/image_mirror_manifest.mjs';
import { rightsProblems } from './lib/image_mirror_rights.mjs';

const ALLOW_MISSING = process.env.SCIENTIA_ALLOW_MISSING_IMAGES === '1';

/** Dateien, in denen eine direkte Commons-Bildadresse einen Rückfall bedeuten würde. */
const SOURCE_DIRS = ['src'];
const HOTLINK_RX = /Special:FilePath|upload\.wikimedia\.org/;
const RIGHTS_PATH = join('.cache', 'image_mirror_rights_report.json');

async function* sourceFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      yield* sourceFiles(path);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      yield path;
    }
  }
}

const problems = [];

const result = await verifyMirror();
if (result.fatal) {
  problems.push(`${result.fatal} — erst \`npm run mirror:images\` ausführen.`);
} else {
  if (result.withoutEntry.length) {
    problems.push(
      `${result.withoutEntry.length} von ${result.total} Konzeptbildern haben keine eigene Kopie `
      + `(z.B. ${result.withoutEntry.slice(0, 3).join(', ')})`,
    );
  }
  if (result.withoutFile.length) {
    problems.push(
      `${result.withoutFile.length} Manifest-Einträge zeigen auf eine fehlende Datei `
      + `(z.B. ${result.withoutFile.slice(0, 3).join(', ')})`,
    );
  }
}

let rightsReport = null;
try {
  rightsReport = JSON.parse(await readFile(RIGHTS_PATH, 'utf8'));
} catch {
  // Ein fehlender oder beschädigter Bericht ist keine Freigabe. `mirror:images`
  // erzeugt ihn vor den Kopien aus frisch gelesenen Commons-Metadaten.
}
for (const problem of rightsProblems(rightsReport)) {
  problems.push(`Rechteabgleich: ${problem}`);
}
if (result.foreign?.length) {
  problems.push(
    `${result.foreign.length} Konzeptbilder liegen außerhalb von Wikimedia Commons und `
    + 'lassen sich mit diesem Skript nicht kopieren — die App zeigt sie deshalb nicht '
    + `(z.B. ${result.foreign.slice(0, 3).map((item) => item.concept).join(', ')})`,
  );
}

for (const dir of SOURCE_DIRS) {
  for await (const file of sourceFiles(dir)) {
    const text = await readFile(file, 'utf8');
    // Kommentarzeilen ausnehmen: `commonsImage.js` erklärt die frühere
    // Hotlink-Adresse ausdrücklich, und diese Erklärung soll bleiben.
    const code = text
      .split('\n')
      .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
      .join('\n');
    if (HOTLINK_RX.test(code)) {
      problems.push(`${file}: direkte Wikimedia-Bildadresse im Quelltext (Hotlink)`);
    }
  }
}

if (!problems.length) {
  process.stdout.write(`[image-mirror] ${result.mirrored} Konzeptbilder liegen als eigene Kopie vor.\n`);
  process.exit(0);
}

process.stderr.write(`[image-mirror] ${problems.length} Befund(e):\n`);
for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
if (ALLOW_MISSING) {
  process.stderr.write('[image-mirror] SCIENTIA_ALLOW_MISSING_IMAGES=1 — Bau läuft weiter, '
    + 'das Ergebnis ist kein Release.\n');
  process.exit(0);
}
// Verwaiste Dateien sind kein Grund abzubrechen: Sie kosten Platz, aber kein
// Besucher fordert sie an. `mirror_concept_images.mjs prune` räumt sie weg.
process.exit(1);
