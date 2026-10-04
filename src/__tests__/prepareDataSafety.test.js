import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(root, 'scripts', 'prepare_data.js');
const countries = ['DE', 'FR', 'CH'];

/** Führt die echte Pipeline mit rein virtuellen Dateien und HTTP-Antworten aus. */
async function prepare(cityCache, allowStatic = false, rawCache = null, options = {}) {
  const writes = new Map();
  if (options.failWrite) writes.set('geodb.json', 'vorherige Daten');
  const requests = [];
  const messages = [];
  const files = {
    'countries.json': { features: countries.map(iso => ({ properties: { iso_a2: iso, name: iso } })) },
    'subdivisions.json': { features: countries.map(iso => ({ properties: { id: `${iso}-state`, country_id: iso } })) },
    'rivers.json': { features: [{}] },
  };
  const fs = {
    existsSync: p => !(options.missingFiles || []).includes(basename(p))
      && (basename(p) !== 'wikidata_cities_raw.json' || cityCache !== undefined),
    readFileSync: p => {
      if (basename(p) === 'wikidata_cities_raw.json') return rawCache ?? JSON.stringify(cityCache);
      if (!(basename(p) in files)) throw new Error(`Unerwartete Datei: ${p}`);
      return JSON.stringify(files[basename(p)]);
    },
    writeFileSync: (p, content) => {
      if (options.failWrite && basename(p).startsWith('geodb.json')) {
        writes.set(basename(p), 'abgebrochene Teilkopie');
        throw new Error('Speicher voll');
      }
      writes.set(basename(p), content);
    },
    mkdirSync: () => { throw new Error('Unerwartetes mkdir'); },
    renameSync: (source, target) => {
      const name = basename(source);
      if (!writes.has(name)) throw new Error('Unerwartetes rename');
      writes.set(basename(target), writes.get(name));
      writes.delete(name);
    },
    rmSync: p => writes.delete(basename(p)),
  };
  const http = {
    get: (url, _options, callback) => {
      requests.push(url);
      const request = new EventEmitter();
      request.destroy = () => {};
      queueMicrotask(() => {
        const response = new EventEmitter();
        response.statusCode = 200;
        callback(response);
        const payload = url.includes('raw.githubusercontent')
          ? options.geodataResponse ?? files['countries.json']
          : url.includes('restcountries')
          ? options.restResponse ?? countries.map(iso => ({ cca2: iso, capital: ['Hauptstadt'], population: 100, area: 10,
            translations: { deu: { common: iso } } }))
          : options.wikiResponse ?? { results: { bindings: countries.map(iso => ({ iso2: { value: iso }, highestPointLabel: { value: 'Berg' } })) } };
        response.emit('data', JSON.stringify(payload));
        response.emit('end');
      });
      return request;
    },
  };
  // Import und Dateischreiben bleiben abgefangen; nur die Skriptlogik läuft.
  const source = readFileSync(script, 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(script).href))
    .replace(/\nrun\(\);\s*$/, '\nawait run();');
  const context = vm.createContext({
    fs, http, path, fileURLToPath, randomUUID,
    console: Object.fromEntries(['log', 'warn', 'error'].map(level => [level, (...args) => messages.push(args.join(' '))])),
    process: { env: allowStatic ? { SCIENTIA_ALLOW_STATIC_CITIES: '1' } : {}, exit: code => { throw new Error(`Exit ${code}`); } },
  });
  let error = null;
  try { await vm.runInContext(`(async () => {${source}})()`, context); } catch (caught) { error = caught; }
  return { error, writes, requests, messages };
}

describe('Stadtcache vor der Datenvorbereitung', () => {
  it.each([
    {}, [], null, { DE: [] }, { DE: {} }, { DE: 'Berlin' },
    { DE: [{}] }, { DE: [{ name: '' }] }, { DE: [{ name: 'Stadt', population: -1 }] },
    { DE: [{ name: 'Stadt', coordinates: 'Point(1 2)' }] },
  ].map(cache => ({ cache })))('bricht bei leerer oder falscher Struktur vor allen Ausgaben ab: %j', async ({ cache }) => {
    const result = await prepare(cache);
    expect(result.error).not.toBeNull();
    expect(result.writes.size).toBe(0);
    expect(result.requests).toEqual([]);
  });

  it('akzeptiert gültige optionale Stadtfelder und ersetzt kleine Listen nicht still', async () => {
    const result = await prepare({ DE: [{ name: 'Prüfstadt' }], FR: [] });
    expect(result.error).toBeNull();
    const cities = Object.values(JSON.parse(result.writes.get('geodb.json')).entities).filter(entity => entity.type === 'city');
    expect(cities.some(city => city.name === 'Prüfstadt')).toBe(true);
    expect(cities.some(city => city.name === 'Berlin')).toBe(false);
    expect(cities).toHaveLength(4);
  });

  it('bewahrt vollständige geerntete Felder und erlaubt unbekannte optionale Angaben', async () => {
    const result = await prepare({ DE: [
      { name: 'Prüfstadt', population: 1234, coordinates: [13.4, 52.5] },
      { name: 'Unbekannt', population: null, coordinates: null },
    ] });
    expect(result.error).toBeNull();
    const cities = Object.values(JSON.parse(result.writes.get('geodb.json')).entities).filter(entity => entity.type === 'city');
    expect(cities.find(city => city.name === 'Prüfstadt')).toMatchObject({ population: 1234, coordinates: [13.4, 52.5] });
    expect(cities.find(city => city.name === 'Unbekannt')).toMatchObject({ population: 0, coordinates: [0, 0] });
  });

  it('bricht auch bei unlesbarem JSON vor allen Ausgaben ab', async () => {
    const result = await prepare({}, false, '{');
    expect(result.error).not.toBeNull();
    expect(result.writes.size).toBe(0);
    expect(result.requests).toEqual([]);
  });

  it('verweigert einen fehlenden Cache vor Netzabrufen und Ausgaben', async () => {
    const result = await prepare(undefined);
    expect(result.error).not.toBeNull();
    expect(result.requests).toEqual([]);
    expect(result.writes.size).toBe(0);
  });

  it('erlaubt den statischen Ersatz ausdrücklich und verweigert weiter defekte Caches', async () => {
    const result = await prepare(undefined, true);
    expect(result.error).toBeNull();
    expect(result.writes.has('geodb.json')).toBe(true);
    const invalid = await prepare({}, true);
    expect(invalid.error).not.toBeNull();
    expect(invalid.writes.size).toBe(0);
  });
});

describe('Veröffentlichung erst nach brauchbaren Metadaten', () => {
  it('bewahrt den Bestand bei einer formal gültigen Länder-Teilantwort', async () => {
    const result = await prepare({ DE: [{ name: 'Berlin' }] }, false, null, {
      restResponse: [{ cca2: 'DE', capital: ['Berlin'], population: 100, area: 10, name: { common: 'Deutschland' } }],
    });
    expect(result.error).not.toBeNull();
    expect(result.messages.join('\n')).toContain('FR, CH');
    expect(result.writes.size).toBe(0);
  });
  it.each([
    {}, { results: {} }, { results: { bindings: [] } },
    { results: { bindings: [{ iso2: { value: 'DE' } }] } },
    { results: { bindings: [{ iso2: { value: 'DE' }, highestPointLabel: { value: 'Berg' }, highestPointElevation: { value: 'keine Zahl' } }] } },
  ].map(wikiResponse => ({ wikiResponse })))('bewahrt alle Ausgaben bei unbrauchbarer Wikidata-Antwort: %j', async ({ wikiResponse }) => {
    const result = await prepare({ DE: [{ name: 'Berlin' }] }, false, null, { wikiResponse, missingFiles: ['countries.json'] });
    expect(result.error).not.toBeNull();
    expect(result.writes.size).toBe(0);
  });

  it.each([[], [{ cca2: 'DE', translations: { deu: { common: 'Deutschland' } } }]].map(restResponse => ({ restResponse })))('verweigert einen leeren oder unvollständigen Länderbestand: %j', async ({ restResponse }) => {
    const result = await prepare({ DE: [{ name: 'Berlin' }] }, false, null, { restResponse });
    expect(result.error).not.toBeNull();
    expect(result.writes.size).toBe(0);
  });

  it('veröffentlicht keine leeren Ländergrenzen aus einer erfolgreichen HTTP-Antwort', async () => {
    const result = await prepare({ DE: [{ name: 'Berlin' }] }, false, null, {
      missingFiles: ['countries.json'], geodataResponse: { features: [] },
    });
    expect(result.error).not.toBeNull();
    expect(result.writes.size).toBe(0);
  });

  it('veröffentlicht keine leeren Flussquellen aus erfolgreichen HTTP-Antworten', async () => {
    const result = await prepare({ DE: [{ name: 'Berlin' }] }, false, null, {
      missingFiles: ['rivers.json', 'ne_10m_rivers_global_raw.json', 'ne_10m_rivers_europe_raw.json'],
      geodataResponse: { features: [] },
    });
    expect(result.error).not.toBeNull();
    expect(result.writes.size).toBe(0);
  });

  it('lässt optionale Berghöhen und Länder ohne Bergangabe weiter zu', async () => {
    const wikiResponse = { results: { bindings: [
      { iso2: { value: 'DE' }, highestPointLabel: { value: 'Zugspitze' } },
      { iso2: { value: 'FR' } },
    ] } };
    const result = await prepare({ DE: [{ name: 'Berlin' }] }, false, null, { wikiResponse });
    expect(result.error).toBeNull();
    const entities = JSON.parse(result.writes.get('geodb.json')).entities;
    expect(entities.DE.metadata.highestPoint).toBe('Zugspitze');
    expect(entities.FR.metadata.highestPoint).toBe('N/A');
  });

  it('bewahrt die vorige geodb bei einem abgebrochenen Schreibvorgang', async () => {
    const result = await prepare({ DE: [{ name: 'Berlin' }] }, false, null, { failWrite: true });
    expect(result.error).not.toBeNull();
    expect(result.writes.get('geodb.json')).toBe('vorherige Daten');
    expect([...result.writes.keys()]).toEqual(['geodb.json']);
  });
});
