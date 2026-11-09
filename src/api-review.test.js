import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

vi.unmock('./utils/db');

let database;
afterEach(() => {
  database?.close();
  database = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('IndexedDB-Wiederverbindung', () => {
  it.each(['synchron', 'asynchron'])('versucht nach einem Öffnungsfehler (%s) erneut zu speichern', async failureMode => {
    vi.resetModules();
    const indexedDb = new IDBFactory();
    vi.stubGlobal('indexedDB', indexedDb);
    const open = vi.spyOn(indexedDb, 'open');
    const error = new DOMException('Speicher vorübergehend gesperrt', 'SecurityError');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    open.mockImplementationOnce(() => {
      if (failureMode === 'synchron') throw error;
      const request = {};
      queueMicrotask(() => request.onerror({ target: { error } }));
      return request;
    });
    const db = await import('./utils/db');

    await expect(db.saveSetting('audioEnabled', false)).rejects.toBe(error);
    await db.saveSetting('audioEnabled', true);
    database = await db.initDB();
    expect(await db.getSetting('audioEnabled')).toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
