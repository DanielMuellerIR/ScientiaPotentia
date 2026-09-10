import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { chooseMode, mirrorPathFor, verifyMirror } from '../../scripts/mirror_concept_images.mjs';

/** Metadaten, wie sie die Commons-API liefert. */
function meta(overrides = {}) {
  return {
    mime: 'image/jpeg', size: 900 * 1024, width: 3000, height: 2000, ...overrides,
  };
}

const temporaryDirs = [];
async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'scientia-mirror-'));
  temporaryDirs.push(dir);
  return dir;
}
afterEach(async () => {
  while (temporaryDirs.length) await rm(temporaryDirs.pop(), { recursive: true, force: true });
});

describe('Entscheidung Original oder verkleinert', () => {
  it('übernimmt sparsame Originale unverändert', () => {
    expect(chooseMode(meta({ size: 90 * 1024, width: 1200 }))).toBe('original');
  });

  it('verkleinert große Dateien', () => {
    expect(chooseMode(meta({ size: 900 * 1024, width: 3000 }))).toBe('resized');
  });

  it('verkleinert auch sparsame, aber sehr breite Bilder', () => {
    // Wenig Bytes, viele Pixel: Das Dekodieren kostet den Browser trotzdem Speicher.
    expect(chooseMode(meta({ size: 60 * 1024, width: 6000 }))).toBe('resized');
  });

  it('behält kleine SVG-Dateien, weil sie verlustfrei skalieren', () => {
    expect(chooseMode(meta({ mime: 'image/svg+xml', size: 30 * 1024, width: 512 })))
      .toBe('original');
    expect(chooseMode(meta({ mime: 'image/svg+xml', size: 900 * 1024, width: 512 })))
      .toBe('resized');
  });

  it('behält GIF-Dateien im Original, damit eine Animation nicht verlorengeht', () => {
    expect(chooseMode(meta({ mime: 'image/gif', size: 800 * 1024, width: 400 })))
      .toBe('original');
  });

  it('verkleinert Formate, die kein Browser anzeigt', () => {
    // TIFF und DjVu liefert Commons als gerendertes JPEG aus.
    expect(chooseMode(meta({ mime: 'image/tiff', size: 10 * 1024, width: 400 })))
      .toBe('resized');
    expect(chooseMode(meta({ mime: 'image/vnd.djvu', size: 10 * 1024, width: 400 })))
      .toBe('resized');
  });
});

describe('Abgleich von Katalog, Manifest und Dateien', () => {
  /** Baut ein Miniprojekt aus Katalog, Manifest und Bildverzeichnis. */
  async function fixture({ manifestFiles, presentFiles = [], conceptImage }) {
    const root = await scratch();
    const dataDir = join(root, 'data');
    const mirrorDir = join(root, 'images');
    await mkdir(dataDir, { recursive: true });
    await mkdir(mirrorDir, { recursive: true });
    await writeFile(join(dataDir, 'concepts_test.json'), JSON.stringify({
      'test:eins': { id: 'test:eins', image: conceptImage },
    }));
    const manifestPath = join(dataDir, 'image_mirror.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1, dir: 'images/concepts', files: manifestFiles,
    }));
    for (const file of presentFiles) {
      await mkdir(join(mirrorDir, file.slice(0, 2)), { recursive: true });
      await writeFile(join(mirrorDir, mirrorPathFor(file)), 'x');
    }
    return { dataDir, mirrorDir, manifestPath };
  }

  const commonsImage = { url: 'https://commons.wikimedia.org/wiki/File%3ATest.jpg' };

  it('meldet ein Konzeptbild ohne Manifest-Eintrag', async () => {
    const paths = await fixture({ manifestFiles: {}, conceptImage: commonsImage });
    const result = await verifyMirror(paths);
    expect(result.withoutEntry).toEqual(['Test.jpg']);
    expect(result.mirrored).toBe(0);
  });

  it('meldet einen Eintrag, dessen Datei fehlt', async () => {
    const paths = await fixture({
      manifestFiles: { 'Test.jpg': ['ab00112233445566.webp', 960, 720, 0, 'r'] },
      conceptImage: commonsImage,
    });
    const result = await verifyMirror(paths);
    expect(result.withoutFile).toEqual(['Test.jpg -> ab00112233445566.webp']);
  });

  it('meldet Dateien, die kein Eintrag mehr nennt', async () => {
    const paths = await fixture({
      manifestFiles: { 'Test.jpg': ['ab00112233445566.webp', 960, 720, 0, 'r'] },
      presentFiles: ['ab00112233445566.webp', 'cc99887766554433.webp'],
      conceptImage: commonsImage,
    });
    const result = await verifyMirror(paths);
    expect(result.withoutFile).toEqual([]);
    expect(result.orphanFiles).toEqual(['cc/cc99887766554433.webp']);
  });

  it('meldet ein Bild außerhalb von Wikimedia Commons, statt es zu übergehen', async () => {
    const paths = await fixture({
      manifestFiles: {},
      conceptImage: { url: 'https://images.nasa.gov/details/test.jpg' },
    });
    const result = await verifyMirror(paths);
    expect(result.foreign).toEqual([
      { concept: 'test:eins', url: 'https://images.nasa.gov/details/test.jpg' },
    ]);
    // Ein fremdes Bild taucht nicht zusätzlich als fehlende Kopie auf.
    expect(result.withoutEntry).toEqual([]);
  });

  it('nennt ein fehlendes Manifest beim Namen', async () => {
    const paths = await fixture({ manifestFiles: {}, conceptImage: commonsImage });
    const result = await verifyMirror({ ...paths, manifestPath: join(paths.dataDir, 'weg.json') });
    expect(result.fatal).toMatch(/Manifest fehlt/);
  });
});
