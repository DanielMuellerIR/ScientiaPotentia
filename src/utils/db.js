/**
 * IndexedDB Wrapper for local persistence of quiz logs, SRS progress, and app settings.
 */

const DB_NAME = 'GeoAtlasDB';
const DB_VERSION = 1;

/**
 * Initializes the IndexedDB instance.
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database failed to open:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store for SRS Progress of geographic entities
      // Key: entityId (e.g. 'DE' for Germany country, 'Q64' for Berlin city)
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'entityId' });
        progressStore.createIndex('nextDueDate', 'nextDueDate', { unique: false });
        progressStore.createIndex('type', 'type', { unique: false }); // country, city, river, etc.
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
 * @returns {Promise<void>}
 */
export async function saveProgress(entityId, srsData, type) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['progress'], 'readwrite');
    const store = transaction.objectStore('progress');
    
    const record = {
      entityId,
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
      timestamp: Date.now()
    };

    const request = store.add(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
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
