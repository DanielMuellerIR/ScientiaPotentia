import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';

vi.unmock('../utils/db');

const alias81 = 'astra:galaxy-ngc-3031-h3';
const alias101 = 'astra:galaxy-ngc-5457-h3';
const canonical81 = 'astra:bode_m81';
const canonical101 = 'astra:feuerrad_m101';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(() => vi.unstubAllGlobals());

it.each([3, 4])('übernimmt NGC-Lernstände und Historie aus Datenbankversion %s', async version => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  const opening = indexedDB.open('GeoAtlasDB', version);
  opening.onupgradeneeded = () => {
    const db = opening.result;
    const progress = db.createObjectStore('progress', { keyPath: 'entityId' });
    progress.createIndex('domain', 'domain');
    progress.put({ entityId: alias81, repetitions: 4, interval: 12, lastUpdated: 100 });
    progress.put({ entityId: canonical81, repetitions: 2, interval: 3, lastUpdated: 200 });
    progress.put({ entityId: alias101, repetitions: 3, interval: 8, lastUpdated: 150 });
    progress.put({ entityId: 'FR', domain: 'terra', repetitions: 1 });
    const history = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
    history.createIndex('timestamp', 'timestamp');
    history.createIndex('entityId', 'entityId');
    history.add({ entityId: alias81, timestamp: 100, correct: true });
    history.add({ entityId: alias101, timestamp: 150, correct: false });
    db.createObjectStore('settings', { keyPath: 'key' }).put({ key: 'highScore', value: 42 });
  };
  (await requestResult(opening)).close();

  const db = await import('../utils/db');
  const connection = await db.initDB();
  try {
    expect(await db.getProgress(canonical81)).toMatchObject({
      entityId: canonical81, domain: 'astra', repetitions: 4, interval: 12, lastUpdated: 200,
    });
    expect(await db.getProgress(alias81)).toEqual(await db.getProgress(canonical81));
    expect(await db.getProgress(canonical101)).toMatchObject({ repetitions: 3, interval: 8 });
    expect((await db.getAllProgress()).map(row => row.entityId).sort())
      .toEqual(['FR', canonical81, canonical101].sort());
    const history = await requestResult(connection.transaction('history').objectStore('history').getAll());
    expect(history).toEqual([
      { id: 1, entityId: canonical81, domain: 'astra', timestamp: 100, correct: true },
      { id: 2, entityId: canonical101, domain: 'astra', timestamp: 150, correct: false },
    ]);
    expect(await db.getSetting('highScore')).toBe(42);
  } finally {
    connection.close();
  }
});
