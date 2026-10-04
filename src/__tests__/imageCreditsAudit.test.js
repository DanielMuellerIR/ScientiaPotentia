// Aufrufvertrag des Bildnachweis-Audits (scripts/audit_image_credits.mjs).
//
// Der Audit haengt seit 2026-09-03 in `npm run build` und ist damit das harte
// Release-Gate fuer Bildrechte — hatte aber keinen einzigen Test. Diese Faelle
// decken die beiden Zustaende ab, die ein Release blockieren muessen:
// ein gesperrtes Bild im Bestand und ein leerer Bestand.
//
// Das Skript liest seine Pfade relativ zum Arbeitsverzeichnis, deshalb baut
// jeder Test einen winzigen Katalogbaum in einem Temp-Verzeichnis und startet
// den Prozess dort.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'scripts', 'audit_image_credits.mjs');
const DOMAINS = ['astra', 'cultura', 'historia', 'homo', 'lingua', 'machina', 'natura'];

let workdir;

/** Legt fuer alle sieben Bereiche leere Roh- und Generatorkataloge an. */
function makeEmptyTree() {
  mkdirSync(join(workdir, 'scripts', 'data_sources'), { recursive: true });
  mkdirSync(join(workdir, 'public', 'data'), { recursive: true });
  for (const domain of DOMAINS) {
    writeFileSync(join(workdir, 'scripts', 'data_sources', `${domain}_raw.json`), '[]');
    writeFileSync(join(workdir, 'public', 'data', `concepts_${domain}.json`), '{}');
  }
}

function runAudit() {
  return spawnSync(process.execPath, [SCRIPT], { cwd: workdir, encoding: 'utf8' });
}

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'scientia-image-credits-'));
  makeEmptyTree();
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('audit_image_credits', () => {
  it.each(['raw', 'generated'])('blockiert ein fachlich falsches Motiv im %s-Katalog', layer => {
    const source = 'https://commons.wikimedia.org/wiki/File%3AJames_Webb_Space_Telescope_Mirror37.jpg';
    if (layer === 'raw') {
      writeFileSync(join(workdir, 'scripts', 'data_sources', 'astra_raw.json'), JSON.stringify([{
        id: 'mission-hubble', imageFile: source, imageLicense: 'Public domain', imageAttribution: 'NASA',
      }]));
    } else {
      writeFileSync(join(workdir, 'public', 'data', 'concepts_astra.json'), JSON.stringify({
        'astra:mission-hubble': { id: 'astra:mission-hubble', image: {
          url: source, license: 'Public domain', attribution: 'NASA',
        } },
      }));
    }
    const result = runAudit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('fachlich falsches Bildmotiv');
  });

  it('blockiert einen Bestand ohne eine einzige Pruefung', () => {
    // Ein abgebrochener Generatorlauf lieferte frueher "✓ 0 Bildnachweise ..."
    // und Exit 0 — der Build haette einen bildlosen Stand ausgeliefert.
    const result = runAudit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Kein einziger Bildnachweis geprüft');
  });

  it('blockiert eine gesperrte Bilddatei in den Rohdaten', () => {
    // Picassos „Guernica" ist bis 2043 geschuetzt und steht in
    // scripts/data_sources/harvest/IMAGE_BLACKLIST.json.
    writeFileSync(join(workdir, 'scripts', 'data_sources', 'cultura_raw.json'), JSON.stringify([{
      id: 'irgendein-werk',
      name: 'Irgendein Werk',
      imageFile: "https://commons.wikimedia.org/wiki/File:Pablo Picasso's Guernica.jpg",
      imageLicense: 'Public domain',
      imageAttribution: 'Testurheber',
      imageLicenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    }]));

    const result = runAudit();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('gesperrte Bilddatei');
  });

  it('laesst einen vollstaendigen Bildnachweis durch', () => {
    writeFileSync(join(workdir, 'scripts', 'data_sources', 'cultura_raw.json'), JSON.stringify([{
      id: 'mona-lisa',
      name: 'Mona Lisa',
      imageFile: 'https://commons.wikimedia.org/wiki/File:Mona_Lisa.jpg',
      imageLicense: 'Public domain',
      imageAttribution: 'Leonardo da Vinci',
      imageLicenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    }]));

    const result = runAudit();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 Bildnachweise');
  });
});
