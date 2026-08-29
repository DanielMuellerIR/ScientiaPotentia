import { afterEach, describe, expect, it, vi } from 'vitest';

// setupTests.js ersetzt das DB-Modul für Komponenten-Tests. Diese Datei prüft
// bewusst die echte Persistenzgrenze mit einer kleinen kontrollierten
// IndexedDB-Attrappe.
vi.unmock('../utils/db');

function createIndexedDbHarness() {
  const openRequest = {};
  const deleteRequest = {};
  const writeRequest = {};
  const store = {
    put: vi.fn(() => writeRequest),
    add: vi.fn(() => writeRequest),
  };
  const transaction = {
    error: null,
    abort: vi.fn(),
    objectStore: vi.fn(() => store),
  };
  const database = {
    close: vi.fn(),
    transaction: vi.fn(() => transaction),
  };
  const indexedDb = {
    open: vi.fn(() => openRequest),
    deleteDatabase: vi.fn(() => deleteRequest),
  };
  return {
    database,
    deleteRequest,
    indexedDb,
    openRequest,
    store,
    transaction,
    writeRequest,
  };
}

async function loadOpenedDb(harness) {
  vi.resetModules();
  vi.doUnmock('../utils/db');
  vi.stubGlobal('indexedDB', harness.indexedDb);
  const db = await import('../utils/db');
  const opening = db.initDB();
  harness.openRequest.onsuccess({ target: { result: harness.database } });
  await opening;
  return db;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IndexedDB-Schreibverträge', () => {
  it('meldet einen Setting-Write erst nach dem Transaktions-Commit als erfolgreich', async () => {
    const harness = createIndexedDbHarness();
    const db = await loadOpenedDb(harness);
    const writing = db.saveSetting('activeScore', 12);
    await Promise.resolve();

    // Ein erfolgreicher Store-Request ist noch kein Commit. Der anschließende
    // Transaktionsabbruch muss beim Aufrufer ankommen.
    harness.writeRequest.onsuccess?.();
    const abortError = new Error('Transaktion nach Request-Erfolg abgebrochen');
    harness.transaction.error = abortError;
    harness.transaction.onabort?.({ target: { error: abortError } });

    await expect(writing).rejects.toBe(abortError);
  });

  it('schließt die gecachte Verbindung, bevor die Datenbank gelöscht wird', async () => {
    const harness = createIndexedDbHarness();
    const db = await loadOpenedDb(harness);
    const clearing = db.clearAllData();
    await Promise.resolve();

    expect(harness.database.close).toHaveBeenCalledOnce();
    expect(harness.indexedDb.deleteDatabase).toHaveBeenCalledWith('GeoAtlasDB');

    harness.deleteRequest.onsuccess();
    await expect(clearing).resolves.toBeUndefined();
  });
});
