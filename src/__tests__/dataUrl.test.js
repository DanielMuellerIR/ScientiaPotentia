// Auflösung der Katalogpfade: Ohne Meta-Tag gilt der Klarname, mit Tag der
// gehashte Name. Beides muss stimmen — der Entwicklungsserver liefert die
// Dateien unter dem Klarnamen aus, der Produktionsbau nur unter dem gehashten.
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dataUrl, resetDataUrlCache, DATA_MAP_META_NAME } from '../utils/dataUrl';
import { buildDataAssetMap, hashedName } from '../../scripts/lib/data_asset_hashes.mjs';

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

  it('deckt alle Katalogdateien ab, die die App anfordert', () => {
    const map = buildDataAssetMap(publicData);
    const quelle = readFileSync(resolve(import.meta.dirname, '../domains/index.js'), 'utf8')
      + readFileSync(resolve(import.meta.dirname, '../App.jsx'), 'utf8')
      + readFileSync(resolve(import.meta.dirname, '../utils/useGeoData.js'), 'utf8');
    // Literale Aufrufe (Kataloge, Statistik) …
    const angefordert = [...quelle.matchAll(/dataUrl\('([^']+)'\)/g)].map(treffer => treffer[1]);
    // … und die Geometriedateien, die useGeoData über eine Variable auflöst.
    const geo = [...quelle.matchAll(/^\s+\w+: '([\w.]+\.(?:json|geojson))'/gm)].map(treffer => treffer[1]);
    angefordert.push(...geo);
    expect(geo.length).toBe(3);
    expect(angefordert.length).toBeGreaterThan(18);
    for (const name of angefordert) {
      expect(Object.keys(map), `${name} fehlt in public/data`).toContain(name);
    }
  });
});

describe('Keine fest verdrahteten Katalogpfade', () => {
  const srcDir = resolve(import.meta.dirname, '..');

  /** Alle .js/.jsx unter src/, ohne die Tests selbst. */
  function sourceFiles(dir) {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__') continue;
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) found.push(...sourceFiles(full));
      else if (/\.jsx?$/.test(entry.name)) found.push(full);
    }
    return found;
  }

  it('baut keine Adresse unter data/ als Zeichenkette zusammen', () => {
    // Ein Literal wie 'data/countries.json' zeigt im Produktionsbau ins Leere:
    // dort heisst die Datei 'data/countries.<hash>.json'. Der Fehler faellt beim
    // Bauen nicht auf, weil Vite den String nicht als Verweis erkennt — genau so
    // blieben die drei MapLibre-Quellen in Map.jsx bis 2026-09-04 unbemerkt kaputt.
    const treffer = [];
    for (const file of sourceFiles(srcDir)) {
      if (file.endsWith('utils/dataUrl.js')) continue;   // definiert das Praefix selbst
      for (const zeile of readFileSync(file, 'utf8').split('\n')) {
        if (/['"`]data\/[\w.-]+\.(?:json|geojson)/.test(zeile)) {
          treffer.push(`${file}: ${zeile.trim()}`);
        }
      }
    }
    expect(treffer, 'stattdessen dataUrl(<Klarname>) verwenden').toEqual([]);
  });
});
