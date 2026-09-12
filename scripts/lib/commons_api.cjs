// Gemeinsame Bausteine für den Umgang mit der Wikimedia-Commons-API.
//
// Das Modul kapselt genau die Regeln, die Wikimedia von automatisierten Clients
// verlangt: ein sprechender User-Agent mit Kontaktadresse, ein begrenztes
// Anfragetempo und ein Rückzug (Backoff), wenn der Server abweist. Alle
// Skripte, die Bilddateien oder ihre Rechteangaben holen, gehen über diese
// Datei — damit gilt die Etikette an einer Stelle und nicht in jedem Skript neu.

const pkg = require('../../package.json');

/**
 * User-Agent nach Wikimedia-Richtlinie: Werkzeugname, Version, Kontakt.
 * Ohne Kontaktadresse sperrt Wikimedia automatisierte Zugriffe.
 */
const USER_AGENT =
  `ScientiaImageHarvest/${pkg.version || '0'} ` +
  '(https://github.com/DanielMuellerIR/ScientiaPotentia; nfetzen@gmail.com) Node.js';

const API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

/** Wartet die angegebene Zeit ab. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ein HTTP-Zugriff mit Wiederholung bei vorübergehenden Fehlern.
 *
 * Wiederholt wird nur, was sich von selbst erledigen kann: Zeitüberschreitung,
 * Netzabbruch, 429 (zu viele Anfragen) und 5xx. Ein 404 ist ein Ergebnis, kein
 * Fehler — die Datei gibt es nicht mehr, und das soll der Aufrufer erfahren.
 *
 * @returns {Promise<Response>} Antwort, auch bei 404 oder 403.
 */
async function fetchWithRetry(url, {
  attempts = 4, timeoutMs = 60000, headers = {}, baseDelayMs = 1000,
} = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, ...headers },
        signal: controller.signal,
        redirect: 'follow'
      });
      clearTimeout(timer);
      if (response.status === 429 || response.status >= 500) {
        // Wikimedia nennt bei 429 oft eine Wartezeit; sonst exponentiell zurückziehen.
        const retryAfter = Number(response.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(60000, retryAfter * 1000)
          : Math.min(30000, baseDelayMs * 2 ** attempt);
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt < attempts) {
          await sleep(waitMs);
          continue;
        }
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts) await sleep(Math.min(30000, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError || new Error('Anfrage fehlgeschlagen');
}

/**
 * Fragt Metadaten mehrerer Commons-Dateien in einem Zug ab.
 *
 * Die API nimmt bis zu 50 Titel je Anfrage. Zurück kommen Originalmaße, Bytes,
 * MIME-Typ und die Rechteangaben aus `extmetadata` — damit lässt sich die im
 * Katalog gespeicherte Lizenz vor dem Kopieren erneut gegenprüfen.
 *
 * @param {string[]} fileNames Dateinamen ohne Namensraum, z.B. "Foo bar.jpg".
 * @returns {Promise<Map<string, object>>} Dateiname -> Metadaten (oder {missing:true}).
 */
async function fetchImageMetadata(fileNames) {
  const result = new Map();
  if (!fileNames.length) return result;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata|sha1',
    iiextmetadatafilter: [
      'LicenseShortName', 'License', 'LicenseUrl', 'Artist', 'Credit',
      'UsageTerms', 'AttributionRequired', 'Attribution', 'Restrictions',
      'DateTime', 'ObjectName', 'Categories'
    ].join('|'),
    iiextmetadatalanguage: 'de',
    titles: fileNames.map((name) => `File:${name}`).join('|')
  });

  const response = await fetchWithRetry(`${API_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error(`Commons-API antwortete mit HTTP ${response.status}`);
  const payload = await response.json();
  const pages = payload?.query?.pages || [];

  // `normalized` bildet den angefragten auf den kanonischen Titel ab (etwa
  // Unterstrich zu Leerzeichen). Ohne diese Rückabbildung fänden wir die
  // Antwort zu einem Namen mit Unterstrich nicht wieder.
  const backToRequested = new Map();
  for (const entry of payload?.query?.normalized || []) {
    backToRequested.set(entry.to, entry.from);
  }

  for (const page of pages) {
    const canonicalTitle = page.title || '';
    const requestedTitle = backToRequested.get(canonicalTitle) || canonicalTitle;
    const key = requestedTitle.replace(/^File:/i, '');
    if (page.missing) {
      result.set(key, { missing: true, title: canonicalTitle });
      continue;
    }
    const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
    if (!info) {
      result.set(key, { missing: true, title: canonicalTitle });
      continue;
    }
    result.set(key, {
      title: canonicalTitle,
      url: info.url,
      descriptionUrl: info.descriptionurl,
      width: info.width,
      height: info.height,
      size: info.size,
      mime: info.mime,
      sha1: info.sha1,
      extmetadata: info.extmetadata || {}
    });
  }
  return result;
}

module.exports = {
  API_ENDPOINT,
  USER_AGENT,
  fetchWithRetry,
  fetchImageMetadata,
  sleep
};
