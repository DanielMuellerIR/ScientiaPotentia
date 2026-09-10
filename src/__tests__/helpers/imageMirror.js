// Testhilfe: setzt das Bildmanifest, ohne es über `fetch` zu laden.
//
// Die App holt Konzeptbilder ausschließlich aus eigenen Kopien; welche Datei zu
// welcher Commons-Dateiseite gehört, steht im Manifest. Tests, die ein Bild
// rendern, brauchen deshalb einen passenden Eintrag — sonst zeigt die
// Komponente zu Recht kein Bild.

import { fileNameFromCommonsUrl } from '../../utils/commonsImage';
import { resetImageMirrorCache } from '../../utils/imageMirror';

/**
 * Baut ein Manifest, das jede genannte Commons-Adresse abdeckt.
 *
 * @param {string[]} urls   Commons-Dateiseiten aus dem Test.
 * @param {object}   options `withThumb: false` lässt das Vorschaubild weg.
 * @returns {{dir:string, files:object}} dasselbe Manifest, das gesetzt wurde.
 */
export function mockImageMirror(urls, { withThumb = true } = {}) {
  const files = {};
  urls.filter(Boolean).forEach((url, index) => {
    const name = fileNameFromCommonsUrl(url);
    if (!name) return;
    // Zweistellige Hashpräfixe wie im echten Manifest, damit die Tests auch
    // den Unterordner im Pfad sehen.
    const stem = `ab${String(index).padStart(2, '0')}cdef0123456`;
    files[name] = [
      `${stem}.webp`,
      960,
      720,
      withThumb ? `cd${String(index).padStart(2, '0')}ef01234567a.webp` : 0,
      'r',
    ];
  });
  const mirror = { dir: 'images/concepts', files };
  resetImageMirrorCache(mirror);
  return mirror;
}

/** Setzt ein Manifest, das gar keine Kopie kennt. */
export function mockEmptyImageMirror() {
  const mirror = { dir: 'images/concepts', files: {} };
  resetImageMirrorCache(mirror);
  return mirror;
}

/** Stellt den Ausgangszustand her: Manifest ungeladen. */
export function clearImageMirror() {
  resetImageMirrorCache(null);
}
