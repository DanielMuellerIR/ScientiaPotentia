// Commons-Adressen lesen: Aus der Adresse einer Wikimedia-Commons-Dateiseite
// den Dateinamen gewinnen und Commons als Quelle erkennen.
//
// Bis zum 2026-09-10 baute diese Datei aus jeder Dateiseite eine direkte
// `Special:FilePath`-Bildadresse, die die Komponenten als `src` setzten. Damit
// holte jeder Besucher das Bild bei der Wikimedia Foundation, und seine
// IP-Adresse ging dorthin mit. Seither liefert das Projekt eigene Kopien aus
// (siehe `imageMirror.js` und `scripts/mirror_concept_images.mjs`); von der
// Commons-Adresse bleibt nur der Dateiname als Schlüssel des Manifests und der
// Quelllink im Bildnachweis.

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
 * Dateiname einer Commons-Dateiseite — zugleich der Schlüssel im Bildmanifest.
 *
 * Commons behandelt Unterstrich und Leerzeichen im Titel als dasselbe Zeichen;
 * beide Schreibweisen kommen im Bestand vor. Der Schlüssel benutzt deshalb
 * durchgehend das Leerzeichen, damit `File:Blue_Marble.jpg` und
 * `File:Blue Marble.jpg` denselben Eintrag treffen.
 *
 * @param {string} rawUrl Adresse einer Commons-Dateiseite.
 * @returns {string} Dateiname ohne Namensraum, oder '' bei fremder Adresse.
 */
export function fileNameFromCommonsUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    return '';
  }
  if (!isWikimediaCommonsUrl(rawUrl)) return '';
  const match = COMMONS_FILE_PATH_RX.exec(parsed.pathname);
  if (!match) return '';
  // Der Dateiname ist oft doppelt kodiert (File%3A -> File:, Name nochmal).
  // decodeURIComponent scheitert an ungültigen %xx-Folgen → try/catch.
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
  return fileName.replace(/_/g, ' ').trim();
}
