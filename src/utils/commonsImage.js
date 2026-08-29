// Commons-URL-Helfer: wandelt eine Wikimedia-Commons-„wiki/File"-Seite in einen
// direkten, serverseitig skalierten Bild-Link um. Geteilt von MuseumExplorer
// (globale Galerie) und GalleryExplorer (per-Bereich-Übersicht).
//
// Alle geernteten Bilder nutzen das Format:
//   https://commons.wikimedia.org/wiki/File%3A<Dateiname>  bzw.  .../wiki/File:<Dateiname>
// Daraus bauen wir eine FilePath-URL, die ein cachefähiges, auf `width` skaliertes
// Bild liefert. Nicht-Commons-URLs (Met, NASA, direkte CDN-Links) gehen unverändert durch.

// Matcht beide Pfadvarianten: File:Name und File%3AName (%3A = URL-kodierter
// Doppelpunkt). Der Host wird separat über URL.hostname geprüft, damit Adressen
// wie notcommons.wikimedia.org nicht irrtümlich als Commons gelten.
const COMMONS_FILE_PATH_RX = /^\/wiki\/File(?:%3A|:)(.+)$/i;

/** Erkennt Wikimedia Commons über den vollständigen Hostnamen. */
export function isWikimediaCommonsUrl(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase() === 'commons.wikimedia.org';
  } catch (_) {
    return false;
  }
}

/**
 * @param {string} rawUrl  - URL aus dem Konzeptdatensatz (concept.image.url)
 * @param {number} width   - gewünschte Breite in Pixeln (Commons skaliert serverseitig)
 * @returns {string}       - direkt verwendbare <img src>-URL
 */
export function commonsToDirectUrl(rawUrl, width = 400) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    return rawUrl;
  }
  const match = isWikimediaCommonsUrl(rawUrl)
    ? COMMONS_FILE_PATH_RX.exec(parsed.pathname)
    : null;
  if (!match) {
    // Nicht-Commons-URLs unverändert zurückgeben.
    return rawUrl;
  }
  // Dateiname ist oft doppelt URL-kodiert (File%3A -> File:, dann Dateiname nochmal).
  // decodeURIComponent schlägt bei ungültigen %xx-Sequenzen fehl → try/catch.
  let fileName = match[1];
  try {
    fileName = decodeURIComponent(match[1]);
  } catch (_) {
    // Fallback: nur die häufigsten Escape-Sequenzen manuell ersetzen.
    fileName = match[1]
      .replace(/%3A/gi, ':')
      .replace(/%20/gi, ' ')
      .replace(/%27/gi, "'")
      .replace(/%26/gi, '&')
      .replace(/%2B/gi, '+');
  }
  const requestedWidth = Number(width);
  const safeWidth = Number.isFinite(requestedWidth)
    ? Math.min(4096, Math.max(1, Math.round(requestedWidth)))
    : 400;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${safeWidth}`;
}
