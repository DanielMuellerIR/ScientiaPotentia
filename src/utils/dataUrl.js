/**
 * Adresse einer Datendatei unter `public/data/`.
 *
 * Hintergrund: Die Vite-Bundles tragen ihren Inhaltshash im Dateinamen und sind
 * damit unveränderlich — ein Browser, der noch die alte `index.html` hat, lädt
 * weiterhin genau die Bundles, die zu ihr gehören. Für die Katalogdateien unter
 * `data/` galt das bis zum 2026-09-03 nicht: Sie lagen unter festen Namen, ein
 * Deploy überschrieb sie, und in dem Moment sah alter Code neue Daten. Ändert
 * sich dabei ein Feldname, bricht die laufende Sitzung.
 *
 * Seither bekommen auch die Katalogdateien ihren Inhaltshash in den Namen. Die
 * Zuordnung Klarname -> gehashter Name steht als JSON in einem Meta-Tag der
 * `index.html`; sie wird also zusammen mit dem Einstieg atomar umgeschaltet.
 *
 * Ohne Meta-Tag (Entwicklungsserver, Tests) bleibt es beim Klarnamen — dort
 * liefert Vite die Dateien direkt aus `public/`.
 */

/** Name des Meta-Tags, das die Zuordnung trägt. */
export const DATA_MAP_META_NAME = 'scientia-data-map';

let cachedMap = null;

/** Liest die Zuordnung einmalig aus dem Dokument; unbrauchbarer Inhalt gilt als leer. */
function readMap() {
  if (cachedMap) return cachedMap;
  cachedMap = {};
  if (typeof document === 'undefined') return cachedMap;
  const meta = document.querySelector(`meta[name="${DATA_MAP_META_NAME}"]`);
  const content = meta?.getAttribute('content');
  if (!content) return cachedMap;
  try {
    const parsed = JSON.parse(content);
    // Nur flache Zeichenketten-Paare übernehmen: Ein beschädigtes Tag darf keine
    // Objekte oder Zahlen in die Pfadbildung tragen.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value) cachedMap[key] = value;
      }
    }
  } catch {
    // Ein unlesbares Tag ist kein Grund, die App zu stoppen — dann gelten die
    // Klarnamen, und ein fehlender Katalog fällt an der gewohnten Stelle auf.
  }
  return cachedMap;
}

/**
 * Liefert die Adresse einer Datendatei, relativ zum Dokument.
 *
 * @param {string} fileName  Klarname, z.B. "questions_astra.json".
 * @returns {string} z.B. "data/questions_astra.7f3a91c2.json"
 */
export function dataUrl(fileName) {
  return `data/${readMap()[fileName] || fileName}`;
}

/** Nur für Tests: erzwingt ein erneutes Lesen des Meta-Tags. */
export function resetDataUrlCache() {
  cachedMap = null;
}
