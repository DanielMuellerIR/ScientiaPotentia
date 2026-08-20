/**
 * IndexedDB Wrapper for local persistence of quiz logs, SRS progress, and app settings.
 */

// Domain-Ableitung aus dem Konzept-Key: zentrale Implementierung in
// conceptKeys.js (war hier zuvor als Kopie dupliziert). Der lokale Alias
// haelt die bestehenden Aufrufstellen unveraendert.
import { getDomainIdFromConceptKey as getDomainFromEntityId } from './conceptKeys';

const DB_NAME = 'GeoAtlasDB';
const DB_VERSION = 2;

// Gecachte Verbindung: Bisher oeffnete jede getProgress/saveProgress/… einen
// EIGENEN IndexedDB-Handle (pro Quiz-Antwort gleich mehrere) und schloss keinen
// — die offenen Verbindungen sammelten sich an. Wir oeffnen die DB jetzt genau
// einmal und teilen das Promise. Bei Fehler/unerwartetem Schliessen wird der
// Cache geleert, damit der naechste Zugriff sauber neu verbindet.
let dbPromise = null;

/**
 * Liefert die (einmalig geoeffnete, danach gecachte) IndexedDB-Instanz.
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      dbPromise = null; // erlaubt erneuten Verbindungsversuch nach Fehler
      console.error('Database failed to open:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      // Schliesst sich die Verbindung unerwartet, aus dem Cache nehmen
      // -> naechster Zugriff oeffnet neu.
      db.onclose = () => { dbPromise = null; };
      // Oeffnet ein anderer Tab die DB in hoeherer Version, feuert hier
      // 'versionchange'. Wir MUESSEN die Verbindung dann aktiv schliessen
      // (sonst blockiert sie das Upgrade im anderen Tab dauerhaft) und den
      // Cache leeren, damit der naechste Zugriff die neue Version oeffnet.
      // 'onclose' alleine reicht dafuer nicht, da es bei 'versionchange'
      // nicht automatisch feuert.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store for SRS progress of concepts.
      // Key: entityId. Old Terra keys stay unprefixed; new domains are prefixed.
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'entityId' });
        progressStore.createIndex('nextDueDate', 'nextDueDate', { unique: false });
        progressStore.createIndex('type', 'type', { unique: false }); // country, city, river, etc.
        progressStore.createIndex('domain', 'domain', { unique: false });
      } else if (event.oldVersion < 2) {
        const progressStore = event.target.transaction.objectStore('progress');
        if (!progressStore.indexNames.contains('domain')) {
          progressStore.createIndex('domain', 'domain', { unique: false });
        }
      }

      // Store for detailed history logs
      // Key: auto-incrementing integer
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        historyStore.createIndex('entityId', 'entityId', { unique: false });
      }

      // Store for app settings
      // Key: setting key (e.g., 'theme', 'audioEnabled')
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });

  // WICHTIG: das gerade erzeugte Promise zurueckgeben. Ohne dieses return lieferte
  // der ERSTE initDB()-Aufruf (dbPromise war noch null) undefined zurueck -> der
  // Aufrufer bekam `await undefined` und lief beim Cold Start in
  // „Cannot read properties of undefined (reading 'transaction')". Erst ab dem
  // zweiten Aufruf griff `if (dbPromise) return dbPromise`.
  return dbPromise;
}

/**
 * Retrieves the SRS progress for a single entity.
 * @param {string} entityId 
 * @returns {Promise<Object|null>}
 */
export async function getProgress(entityId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['progress'], 'readonly');
    const store = transaction.objectStore('progress');
    const request = store.get(entityId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves all progress objects.
 * @returns {Promise<Array<Object>>}
 */
export async function getAllProgress() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['progress'], 'readonly');
    const store = transaction.objectStore('progress');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Updates the SRS progress for an entity.
 * @param {string} entityId 
 * @param {Object} srsData - { repetitions, interval, easiness, nextDueDate }
 * @param {string} type - type of entity (e.g. 'country', 'city', 'river', 'mountain', 'landmark')
 * @param {string} domain - knowledge domain, derived from entityId if omitted
 * @returns {Promise<void>}
 */
export async function saveProgress(entityId, srsData, type, domain = getDomainFromEntityId(entityId)) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['progress'], 'readwrite');
    const store = transaction.objectStore('progress');
    
    const record = {
      entityId,
      domain,
      type,
      ...srsData,
      lastUpdated: Date.now()
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Adds a log entry to the history store.
 * @param {Object} logEntry - { entityId, type, correct, attempts, responseTime }
 * @returns {Promise<void>}
 */
export async function addHistoryLog(logEntry) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    
    const record = {
      ...logEntry,
      domain: logEntry.domain || getDomainFromEntityId(logEntry.entityId),
      timestamp: Date.now()
    };

    const request = store.add(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Schreibt SRS-Fortschritt UND History-Eintrag in EINER gemeinsamen
 * readwrite-Transaktion über beide Stores. Vorher liefen `saveProgress` und
 * `addHistoryLog` als zwei getrennte Transaktionen — bei Reload/Absturz im
 * Fenster dazwischen blieb der SRS-Stand ohne den zugehörigen History-Eintrag
 * übrig (Code-Review F6). Eine Transaktion macht beide Writes atomar: entweder
 * beide committen oder (bei Fehler/Abbruch) keiner.
 *
 * Die Progress-Domain wird aus dem entityId-Präfix abgeleitet (unpräfixt = terra).
 * Der Aufrufer liefert dieselbe Herkunft für den History-Eintrag; fehlt sie,
 * greift derselbe Präfix-Fallback.
 *
 * @param {string} entityId
 * @param {Object} srsData - { repetitions, interval, easiness, nextDueDate }
 * @param {string} type - Typ des Konzepts (country, city, river, …)
 * @param {Object} logEntry - History-Felder { domain?, correct, attempts, qualityScore, … }
 * @returns {Promise<void>}
 */
export async function saveProgressAndLog(entityId, srsData, type, logEntry) {
  const db = await initDB();
  const progressDomain = getDomainFromEntityId(entityId);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['progress', 'history'], 'readwrite');
    // Auf Transaktions-Ebene (nicht je Request) auflösen: erst wenn BEIDE Writes
    // committed sind, gilt die Antwort als dauerhaft gespeichert.
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    transaction.objectStore('progress').put({
      entityId,
      domain: progressDomain,
      type,
      ...srsData,
      lastUpdated: Date.now()
    });
    transaction.objectStore('history').add({
      ...logEntry,
      entityId,
      domain: logEntry.domain || progressDomain,
      timestamp: Date.now()
    });
  });
}

/**
 * Retrieves all log entries.
 * @returns {Promise<Array<Object>>}
 */
export async function getHistoryLogs() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readonly');
    const store = transaction.objectStore('history');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a setting.
 * @param {string} key 
 * @param {any} value 
 * @returns {Promise<void>}
 */
export async function saveSetting(key, value) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves a setting.
 * @param {string} key 
 * @param {any} defaultValue 
 * @returns {Promise<any>}
 */
export async function getSetting(key, defaultValue = null) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result ? request.result.value : defaultValue);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Resets the entire database.
 * @returns {Promise<void>}
 */
export function clearAllData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
