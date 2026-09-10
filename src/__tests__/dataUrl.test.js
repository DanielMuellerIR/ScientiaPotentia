// Auflösung der Katalogpfade: Ohne Meta-Tag gilt der Klarname, mit Tag der
// gehashte Name. Beides muss stimmen — der Entwicklungsserver liefert die
// Dateien unter dem Klarnamen aus, der Produktionsbau nur unter dem gehashten.
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dataUrl, resetDataUrlCache, DATA_MAP_META_NAME } from '../utils/dataUrl';
import { buildDataAssetMap, hashedName } from '../../scripts/lib/data_asset_hashes.mjs';
import {
  GEO_FILE_COUNT, collectRequestedDataFiles, sourceFiles,
} from '../../scripts/lib/required_data_files.mjs';
import viteConfig from '../../vite.config.js';

const srcDir = resolve(import.meta.dirname, '..');

function setMeta(content) {
  const meta = document.createElement('meta');
  meta.setAttribute('name', DATA_MAP_META_NAME);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

describe('dataUrl', () => {
  beforeEach(() => resetDataUrlCache());
  afterEach(() => {
    document.head.querySelectorAll(`meta[name="${DATA_MAP_META_NAME}"]`)
      .forEach(node => node.remove());
    resetDataUrlCache();
  });

  it('nutzt den Klarnamen, solange kein Meta-Tag da ist', () => {
    expect(dataUrl('questions_lingua.json')).toBe('data/questions_lingua.json');
  });

  it('löst den Klarnamen auf den gehashten Namen auf', () => {
    setMeta(JSON.stringify({ 'questions_lingua.json': 'questions_lingua.7f3a91c2.json' }));
    expect(dataUrl('questions_lingua.json')).toBe('data/questions_lingua.7f3a91c2.json');
  });

  it('lässt unbekannte Dateien beim Klarnamen', () => {
    setMeta(JSON.stringify({ 'questions_lingua.json': 'questions_lingua.7f3a91c2.json' }));
    expect(dataUrl('countries.json')).toBe('data/countries.json');
  });

  it('fällt bei unlesbarem Meta-Tag auf die Klarnamen zurück', () => {
    setMeta('{kein gültiges JSON');
    expect(dataUrl('countries.json')).toBe('data/countries.json');
  });

  it('übernimmt aus dem Tag nur Zeichenketten', () => {
    setMeta(JSON.stringify({ 'a.json': { boese: true }, 'b.json': 'b.12345678.json' }));
    expect(dataUrl('a.json')).toBe('data/a.json');
    expect(dataUrl('b.json')).toBe('data/b.12345678.json');
  });
});

describe('Hashes der Katalogdateien', () => {
  const publicData = resolve(import.meta.dirname, '../../public/data');

  it('vergibt jedem Katalog einen Namen mit seinem Inhaltshash', () => {
    const map = buildDataAssetMap(publicData);
    expect(Object.keys(map).length).toBeGreaterThan(0);
    for (const [plain, hashed] of Object.entries(map)) {
      expect(hashed).toMatch(/\.[0-9a-f]{8}\.(json|geojson)$/);
      expect(hashed.startsWith(plain.replace(/\.(json|geojson)$/, '.'))).toBe(true);
    }
  });

  it('ändert den Namen, sobald sich der Inhalt ändert', () => {
    const map = buildDataAssetMap(publicData);
    const [plain, hashed] = Object.entries(map)[0];
    const hash = hashed.match(/\.([0-9a-f]{8})\./)[1];
    // Derselbe Inhalt ergibt denselben Namen, ein anderer einen anderen.
    expect(hashedName(plain, hash)).toBe(hashed);
    expect(hashedName(plain, '00000000')).not.toBe(hashed);
  });

  it('liefert für ein fehlendes Verzeichnis eine leere Zuordnung', () => {
    expect(buildDataAssetMap(resolve(publicData, 'gibt-es-nicht'))).toEqual({});
  });

  // Die Erkennung selbst liegt in scripts/lib/required_data_files.mjs, damit
  // Test und Build-Audit (scripts/audit_data_assets.mjs) dieselbe Wahrheit
  // lesen. Vorher stand sie nur hier — und lief damit nur unter `npm test`.
  it('deckt alle Katalogdateien ab, die die App anfordert', () => {
    const map = buildDataAssetMap(publicData);
    const { files, geoFiles } = collectRequestedDataFiles(srcDir);

    expect(geoFiles.length).toBe(GEO_FILE_COUNT);
    expect(files.length).toBeGreaterThan(18);
    for (const name of files) {
      expect(Object.keys(map), `${name} fehlt in public/data`).toContain(name);
    }
  });
});

describe('Meta-Tag zwischen Build und Laufzeit', () => {
  // Der Build schreibt das Tag, dataUrl() liest es. Stimmen die beiden Namen
  // nicht ueberein, findet readMap() nichts, jede der 19 Katalogdateien wird
  // unter ihrem Klarnamen angefordert — und den gibt es im Release nicht mehr.
  // Alle acht Wissensbereiche liefen dann ins Leere, ohne dass ein Test oder der
  // Build es meldet. Genau daran verlor 2.0.2 die Weltkarte.
  it('nutzt in der Vite-Konfiguration denselben Namen wie dataUrl()', () => {
    const plugin = viteConfig.plugins
      .flat(Infinity)
      .find(eintrag => eintrag && eintrag.name === 'scientia-hashed-data-assets');
    expect(plugin, 'Plugin scientia-hashed-data-assets fehlt').toBeDefined();
    const [tag] = plugin.transformIndexHtml();
    expect(tag.tag).toBe('meta');
    expect(tag.attrs.name).toBe(DATA_MAP_META_NAME);
  });
});

describe('Keine fest verdrahteten Katalogpfade', () => {
  it('baut keine Adresse unter data/ als Zeichenkette zusammen', () => {
    // Ein Literal wie 'data/countries.json' zeigt im Produktionsbau ins Leere:
    // dort heisst die Datei 'data/countries.<hash>.json'. Der Fehler faellt beim
    // Bauen nicht auf, weil Vite den String nicht als Verweis erkennt — genau so
    // blieben die drei MapLibre-Quellen in Map.jsx bis 2026-09-04 unbemerkt kaputt.
    const treffer = [];
    for (const file of sourceFiles(srcDir)) {
      if (file.endsWith('utils/dataUrl.js')) continue;   // definiert das Praefix selbst
      for (const zeile of readFileSync(file, 'utf8').split('\n')) {
        // `${` gehoert in die Zeichenklasse: Ein Template-Literal wie
        // `data/questions_${id}.json` ist bei acht symmetrischen
        // Registry-Eintraegen die naheliegendste Umbauform und rutschte hier
        // bis zum 2026-09-10 durch.
        if (/['"`]data\/[\w.${}-]+\.(?:json|geojson)/.test(zeile)) {
          treffer.push(`${file}: ${zeile.trim()}`);
        }
      }
    }
    expect(treffer, 'stattdessen dataUrl(<Klarname>) verwenden').toEqual([]);
  });
});
