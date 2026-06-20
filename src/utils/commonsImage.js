// Commons-URL-Helfer: wandelt eine Wikimedia-Commons-„wiki/File"-Seite in einen
// direkten, serverseitig skalierten Bild-Link um. Geteilt von MuseumExplorer
// (globale Galerie) und GalleryExplorer (per-Bereich-Übersicht).
//
// Alle geernteten Bilder nutzen das Format:
//   https://commons.wikimedia.org/wiki/File%3A<Dateiname>  bzw.  .../wiki/File:<Dateiname>
// Daraus bauen wir eine FilePath-URL, die ein cachefähiges, auf `width` skaliertes
// Bild liefert. Nicht-Commons-URLs (Met, NASA, direkte CDN-Links) gehen unverändert durch.

// Matcht beide Varianten: File:Name  und  File%3AName (%3A = URL-kodierter Doppelpunkt).
// WICHTIG: [:%3A]+ wäre KEIN korrekter Regex für %3A — daher explizite Alternation.
const COMMONS_WIKI_RX = /commons\.wikimedia\.org\/wiki\/File(?:%3A|:)(.+)/i;

/**
 * @param {string} rawUrl  - URL aus dem Konzeptdatensatz (concept.image.url)
 * @param {number} width   - gewünschte Breite in Pixeln (Commons skaliert serverseitig)
 * @returns {string}       - direkt verwendbare <img src>-URL
 */
export function commonsToDirectUrl(rawUrl, width = 400) {
  const m = COMMONS_WIKI_RX.exec(rawUrl || '');
  if (!m) {
    // Nicht-Commons-URLs unverändert zurückgeben.
    return rawUrl;
  }
  // Dateiname ist oft doppelt URL-kodiert (File%3A -> File:, dann Dateiname nochmal).
  // decodeURIComponent schlägt bei ungültigen %xx-Sequenzen fehl → try/catch.
  let fileName = m[1];
  try {
    fileName = decodeURIComponent(m[1]);
  } catch (_) {
    // Fallback: nur die häufigsten Escape-Sequenzen manuell ersetzen.
    fileName = m[1]
      .replace(/%3A/gi, ':')
      .replace(/%20/gi, ' ')
      .replace(/%27/gi, "'")
      .replace(/%26/gi, '&')
      .replace(/%2B/gi, '+');
  }
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}
