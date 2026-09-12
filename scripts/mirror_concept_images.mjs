#!/usr/bin/env node
/**
 * Legt von jedem veröffentlichten Konzeptbild eine eigene Kopie an.
 *
 * Warum: Bis zum 2026-09-10 setzten `AnswerRevealImage` und die Galerien als
 * Bildadresse eine `Special:FilePath`-Adresse von commons.wikimedia.org. Damit
 * ging bei jeder aufgedeckten Antwort die IP-Adresse des Besuchers an die
 * Wikimedia Foundation. Die Projektregel verlangt Selbsthosting für alles, was
 * sich selbst hosten lässt.
 *
 * Rechtlich ist das Kopieren gedeckt: Der Bestand enthält ausschließlich
 * Public Domain, CC0, CC BY, CC BY-SA, GFDL, FAL, „Attribution" und
 * „Copyrighted free use" — alle erlauben die Vervielfältigung und
 * Weiterverbreitung. Die Pflichtangaben (Urheber, Lizenz, Quelllink,
 * Änderungshinweis) zeigt die App unverändert an; dieses Skript prüft die im
 * Katalog gespeicherte Lizenz zusätzlich gegen den aktuellen Stand auf Commons.
 *
 * Ablage: Die Bilddateien selbst liegen NICHT im Git — 5000 Dateien würden das
 * öffentliche Repository dauerhaft um mehrere hundert Megabyte aufblähen.
 * Versioniert ist nur dieses Skript und das Manifest `public/data/image_mirror.json`;
 * die Dateien entstehen lokal per `npm run mirror:images` und gehen von dort in
 * das Release.
 *
 * Aufrufe:
 *   node scripts/mirror_concept_images.mjs meta      Rechte- und Größendaten holen
 *   node scripts/mirror_concept_images.mjs fetch     Dateien laden und erzeugen
 *   node scripts/mirror_concept_images.mjs manifest  Manifest für die App schreiben
 *   node scripts/mirror_concept_images.mjs verify    Katalog, Manifest und Dateien abgleichen
 *   node scripts/mirror_concept_images.mjs all       alle vier nacheinander
 *
 * Optionen: --limit N (nur N Dateien), --force (auch vorhandene neu erzeugen),
 *           --quiet, --json (Bericht als JSON auf stdout)
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
  buildRightsReport, invalidMirrorNames, metadataRefreshBatch, rightsProblems,
} from './lib/image_mirror_rights.mjs';
import {
  DATA_DIR, MANIFEST_PATH, MIRROR_DIR, PUBLIC_PREFIX,
  collectCatalogImages, mirrorPathFor, readJson, verifyMirror,
} from './lib/image_mirror_manifest.mjs';

export { collectCatalogImages, mirrorPathFor, verifyMirror };

const require = createRequire(import.meta.url);
const { fetchImageMetadata, fetchWithRetry, sleep } = require('./lib/commons_api.cjs');
const { isBlacklistedFile } = require('./data_sources/harvest/image_resolution_policy.cjs');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.cache');
const META_PATH = join(CACHE_DIR, 'commons_image_meta.json');
const STATE_PATH = join(CACHE_DIR, 'image_mirror_state.json');
const RIGHTS_PATH = join(CACHE_DIR, 'image_mirror_rights_report.json');

// ── Entscheidungsschwellen ───────────────────────────────────────────────────
// Eine verkleinerte Fassung kostet rund 110 KB (960 px) plus 20 KB (320 px).
// Ist das Original nicht größer als diese Summe, lohnt das Verkleinern nicht:
// Dann wandert die Originaldatei unverändert in die Kopie — das ist zugleich
// die bessere Qualität und der rechtlich einfachere Fall (keine Bearbeitung).
const SMALL_ORIGINAL_BYTES = 150 * 1024;
/** Auch ein sparsames Original wird verkleinert, wenn es sehr breit ist:
 *  Dekodieren kostet den Browser Speicher unabhängig von der Dateigröße. */
const MAX_ORIGINAL_WIDTH = 1920;
/** Animierte GIF-Dateien bleiben bis hierher im Original — ein Standbild-Thumb
 *  von Commons würde die Animation verlieren. */
const MAX_GIF_BYTES = 1536 * 1024;
/** Ein SVG bleibt im Original, solange es klein ist: Es skaliert verlustfrei. */
const MAX_SVG_BYTES = 400 * 1024;

const LARGE_WIDTH = 960;
const THUMB_WIDTH = 320;
/** Unter dieser Größe lohnt kein zusätzliches Vorschaubild. */
const THUMB_MIN_BASE_BYTES = 40 * 1024;

const WEBP_QUALITY_BASE = 76;
const WEBP_QUALITY_THUMB = 78;

/** MIME-Typen, die jeder Zielbrowser ohne Umwandlung darstellt. */
const BROWSER_SAFE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp',
]);

const EXTENSION_FOR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

/** So viele Fehlschläge in Folge gelten als Störung der Gegenstelle. */
const MAX_CONSECUTIVE_FAILURES = 25;
/** Gleichzeitige Downloads. Wikimedia bittet um Zurückhaltung. */
const CONCURRENCY = 4;
/** Mindestabstand zwischen zwei Anfragen desselben Arbeiters. */
const REQUEST_SPACING_MS = 120;

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Kurzer, inhaltsabhängiger Dateiname — unveränderlich und damit cachefest. */
function contentName(buffer, extension) {
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  return `${hash}.${extension}`;
}


/**
 * Schreibt JSON atomar: erst in eine Nebendatei, dann umbenennen.
 *
 * Der Erntestand ist der Wiederaufnahmepunkt eines anderthalbstündigen Laufs.
 * Bricht das Schreiben mittendrin ab — Strom weg, Abbruch per Tastatur —, wäre
 * eine halb geschriebene Datei unlesbar und der ganze Lauf verloren.
 */
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
}

// ── Schritt 1: Rechte- und Größendaten ───────────────────────────────────────

async function commandMeta(options) {
  const { images } = await collectCatalogImages();
  const names = [...images.keys()];
  const cached = await readJson(META_PATH, { entries: {} });
  const entries = cached.entries || {};

  // Rechte können sich nach dem ersten Spiegeln ändern. Darum ist ein normaler
  // Metadatenlauf immer ein vollständiger aktueller Abgleich und kein Cache-Hit.
  const limited = metadataRefreshBatch(names, options.limit);
  log(options, `Metadaten: ${names.length} Dateien im Katalog, ${limited.length} abzufragen.`);

  // Bricht der Prozess oder die Gegenstelle während des Laufs ab, darf der alte
  // grüne Bericht nicht weiter als Release-Freigabe herumliegen.
  await writeJson(RIGHTS_PATH, {
    checkedAt: new Date().toISOString(), complete: false,
    missing: [], licenseMismatch: [], notFree: [], blacklisted: [],
  });

  let consecutiveFailures = 0;
  for (let index = 0; index < limited.length; index += 50) {
    const batch = limited.slice(index, index + 50);
    try {
      const result = await fetchImageMetadata(batch);
      if (result.size === 0) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 3) {
          throw new Error('Die Commons-API liefert seit drei Bündeln nichts mehr — Lauf abgebrochen.');
        }
      } else {
        consecutiveFailures = 0;
      }
      for (const name of batch) {
        entries[name] = result.get(name) || { missing: true };
      }
    } catch (error) {
      throw new Error(`Metadaten-Bündel ab ${index} fehlgeschlagen: ${error.message}`);
    }
    if (index % 500 === 0 || index + 50 >= limited.length) {
      await writeJson(META_PATH, { fetchedAt: new Date().toISOString().slice(0, 10), entries });
      log(options, `  ${Math.min(index + 50, limited.length)}/${limited.length}`);
    }
    await sleep(REQUEST_SPACING_MS);
  }
  await writeJson(META_PATH, { fetchedAt: new Date().toISOString().slice(0, 10), entries });

  const report = buildRightsReport(images, entries, {
    checkedAt: new Date().toISOString(),
    complete: limited.length === names.length,
  });
  await writeJson(RIGHTS_PATH, report);
  log(options, `Rechteabgleich: ${report.missing.length} auf Commons verschwunden, `
    + `${report.notFree.length} nicht mehr frei, ${report.licenseMismatch.length} mit anderer Lizenzbezeichnung.`);
  return report;
}

// ── Schritt 2: Dateien holen ─────────────────────────────────────────────────

/** Entscheidet je Datei, ob das Original genügt oder verkleinert wird. */
export function chooseMode(meta) {
  const mime = String(meta?.mime || '');
  const bytes = Number(meta?.size) || 0;
  const width = Number(meta?.width) || 0;
  if (!BROWSER_SAFE_MIME.has(mime)) return 'resized';
  if (mime === 'image/svg+xml') return bytes <= MAX_SVG_BYTES ? 'original' : 'resized';
  if (mime === 'image/gif') return bytes <= MAX_GIF_BYTES ? 'original' : 'resized';
  if (bytes <= SMALL_ORIGINAL_BYTES && width && width <= MAX_ORIGINAL_WIDTH) return 'original';
  return 'resized';
}

/** Adresse der von Commons serverseitig verkleinerten Fassung. */
function scaledUrl(fileName, width) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}

async function download(url) {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Erzeugt Basisbild und Vorschaubild einer Datei und legt sie ab. */
async function mirrorOne(fileName, meta) {
  const mode = chooseMode(meta);
  let baseBuffer;
  let baseExtension;

  if (mode === 'original') {
    baseBuffer = await download(meta.url);
    baseExtension = EXTENSION_FOR_MIME[meta.mime] || 'bin';
  } else {
    const source = await download(scaledUrl(fileName, LARGE_WIDTH));
    baseBuffer = await sharp(source, { animated: false })
      .webp({ quality: WEBP_QUALITY_BASE, effort: 4 })
      .toBuffer();
    baseExtension = 'webp';
  }

  const baseInfo = await describe(baseBuffer, meta);
  const baseFile = contentName(baseBuffer, baseExtension);
  await writeIfAbsent(join(MIRROR_DIR, mirrorPathFor(baseFile)), baseBuffer);

  let thumb = null;
  if (baseBuffer.length > THUMB_MIN_BASE_BYTES) {
    const thumbBuffer = await sharp(baseBuffer, { animated: false })
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY_THUMB, effort: 4 })
      .toBuffer();
    // Nur behalten, wenn das Vorschaubild wirklich spart.
    if (thumbBuffer.length < baseBuffer.length * 0.8) {
      const thumbFile = contentName(thumbBuffer, 'webp');
      await writeIfAbsent(join(MIRROR_DIR, mirrorPathFor(thumbFile)), thumbBuffer);
      const thumbInfo = await sharp(thumbBuffer).metadata();
      thumb = {
        file: thumbFile,
        width: thumbInfo.width,
        height: thumbInfo.height,
        bytes: thumbBuffer.length,
      };
    }
  }

  return {
    mode,
    sourceSha1: meta.sha1,
    sourceBytes: meta.size,
    base: {
      file: baseFile,
      width: baseInfo.width,
      height: baseInfo.height,
      bytes: baseBuffer.length,
    },
    thumb,
  };
}

/** Maße eines Puffers; bei SVG fallen die Commons-Angaben zurück. */
async function describe(buffer, meta) {
  try {
    const info = await sharp(buffer).metadata();
    if (info.width && info.height) return { width: info.width, height: info.height };
  } catch {
    // SVG ohne feste Maße oder exotisches Format: Commons-Angabe genügt.
  }
  return { width: Number(meta?.width) || 0, height: Number(meta?.height) || 0 };
}

async function writeIfAbsent(path, buffer) {
  if (existsSync(path)) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
}

async function commandFetch(options) {
  const { images } = await collectCatalogImages();
  const meta = (await readJson(META_PATH, { entries: {} })).entries || {};
  if (!Object.keys(meta).length) {
    throw new Error('Keine Metadaten im Zwischenspeicher — zuerst `meta` ausführen.');
  }
  const state = await readJson(STATE_PATH, { entries: {} });
  state.entries = state.entries || {};
  const rights = await readJson(RIGHTS_PATH, null);
  if (rights?.complete !== true) {
    throw new Error('Kein vollständiger Rechteabgleich — zuerst `meta` ohne --limit ausführen.');
  }
  // Ein alter erfolgreicher Mirror-Eintrag darf nach Lizenzentzug, Verschwinden
  // oder Sperrung nicht bis zum Manifest-Schritt überleben.
  const invalid = invalidMirrorNames(rights);
  for (const name of invalid) delete state.entries[name];
  await mkdir(MIRROR_DIR, { recursive: true });

  const todo = [];
  for (const name of images.keys()) {
    const info = meta[name];
    if (invalid.has(name)) continue;
    const known = state.entries[name];
    const complete = known && known.sourceSha1 === info.sha1
      && existsSync(join(MIRROR_DIR, mirrorPathFor(known.base.file)))
      && (!known.thumb || existsSync(join(MIRROR_DIR, mirrorPathFor(known.thumb.file))));
    if (complete && !options.force) continue;
    todo.push(name);
  }
  const limited = options.limit ? todo.slice(0, options.limit) : todo;
  log(options, `Kopien: ${images.size} Bilder im Katalog, ${limited.length} zu erzeugen.`);

  let done = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let aborted = null;
  const failures = [];

  const queue = [...limited];
  const worker = async () => {
    while (queue.length && !aborted) {
      const name = queue.shift();
      try {
        const entry = await mirrorOne(name, meta[name]);
        state.entries[name] = entry;
        consecutiveFailures = 0;
        done += 1;
      } catch (error) {
        failed += 1;
        consecutiveFailures += 1;
        failures.push({ name, error: error.message });
        // Ein dauerhaft abweisender Server soll den Lauf beenden, nicht
        // stundenlang leere Ergebnisse produzieren.
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          aborted = `${MAX_CONSECUTIVE_FAILURES} Fehlschläge in Folge — Lauf abgebrochen.`;
        }
      }
      if ((done + failed) % 100 === 0) {
        await writeJson(STATE_PATH, state);
        log(options, `  ${done + failed}/${limited.length} (${failed} Fehler)`);
      }
      await sleep(REQUEST_SPACING_MS);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await writeJson(STATE_PATH, state);
  await writeJson(join(CACHE_DIR, 'image_mirror_failures.json'), failures);
  log(options, `Kopien fertig: ${done} erzeugt, ${failed} fehlgeschlagen.`);
  if (aborted) throw new Error(aborted);
  return { done, failed, failures };
}

// ── Schritt 3: Manifest für die App ──────────────────────────────────────────

async function commandManifest(options) {
  const { images } = await collectCatalogImages();
  const state = await readJson(STATE_PATH, { entries: {} });
  const rights = await readJson(RIGHTS_PATH, null);
  if (rights?.complete !== true) {
    throw new Error('Kein vollständiger Rechteabgleich — zuerst `meta` ohne --limit ausführen.');
  }
  const invalid = invalidMirrorNames(rights);
  const files = {};
  let mirrored = 0;
  const missing = [];

  for (const name of [...images.keys()].sort()) {
    if (invalid.has(name)) {
      missing.push(name);
      continue;
    }
    const entry = state.entries?.[name];
    if (!entry) {
      missing.push(name);
      continue;
    }
    // Kompakte Form: [Basisdatei, Breite, Höhe, Vorschaudatei|0, Modus]
    files[name] = [
      entry.base.file,
      entry.base.width,
      entry.base.height,
      entry.thumb ? entry.thumb.file : 0,
      entry.mode === 'original' ? 'o' : 'r',
    ];
    mirrored += 1;
  }

  await writeJson(MANIFEST_PATH, { version: 1, dir: PUBLIC_PREFIX, files });
  log(options, `Manifest: ${mirrored} Kopien eingetragen, ${missing.length} ohne Kopie.`);
  if (missing.length) log(options, `  ohne Kopie: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`);
  return { mirrored, missing };
}

// ── Schritt 4: Abgleich ──────────────────────────────────────────────────────

async function commandVerify(options) {
  const result = await verifyMirror();
  log(options, `Abgleich: ${result.mirrored}/${result.total} Bilder haben eine Kopie.`);
  if (result.withoutEntry.length) {
    log(options, `  ${result.withoutEntry.length} ohne Manifest-Eintrag`);
  }
  if (result.withoutFile.length) {
    log(options, `  ${result.withoutFile.length} Einträge ohne Datei`);
  }
  if (result.orphanFiles.length) {
    log(options, `  ${result.orphanFiles.length} Dateien ohne Eintrag (Altbestand)`);
  }
  return result;
}

/** Löscht Dateien, die kein Manifest-Eintrag mehr nennt. */
async function commandPrune(options) {
  const result = await verifyMirror();
  // `orphanFiles` trägt bereits den Pfad samt Unterordner.
  for (const file of result.orphanFiles) {
    await rm(join(MIRROR_DIR, file), { force: true });
  }
  log(options, `Aufgeräumt: ${result.orphanFiles.length} verwaiste Dateien gelöscht.`);
  return result;
}

// ── Einstieg ─────────────────────────────────────────────────────────────────

function log(options, message) {
  if (!options.quiet) process.stderr.write(`${message}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv.find((value) => !value.startsWith('-')) || 'all';
  const options = {
    force: argv.includes('--force'),
    quiet: argv.includes('--quiet') || argv.includes('--json'),
    json: argv.includes('--json'),
    limit: Number(argv.find((v) => v.startsWith('--limit='))?.split('=')[1]) || 0,
  };

  const commands = {
    meta: commandMeta,
    fetch: commandFetch,
    manifest: commandManifest,
    verify: commandVerify,
    prune: commandPrune,
  };

  let result;
  if (command === 'all') {
    const rights = await commandMeta(options);
    const fetched = await commandFetch(options);
    const manifested = await commandManifest(options);
    result = await commandVerify(options);
    const problems = [
      ...rightsProblems(rights),
      ...(fetched.failed ? [`${fetched.failed} Bildkopien konnten nicht erzeugt werden`] : []),
      ...(manifested.missing.length
        ? [`${manifested.missing.length} Katalogbilder fehlen im Manifest`] : []),
      ...(result.withoutFile.length
        ? [`${result.withoutFile.length} Manifestdateien fehlen lokal`] : []),
    ];
    if (problems.length) {
      throw new Error(`Bildspiegelung fehlgeschlagen: ${problems.join('; ')}`);
    }
  } else if (commands[command]) {
    result = await commands[command](options);
  } else {
    process.stderr.write(`Unbekannter Befehl: ${command}\n`);
    process.exit(2);
  }
  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
