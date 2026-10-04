// Eigene Kopien der Konzeptbilder: Manifest laden und Bildadresse bilden.
//
// Die Bilddateien liegen unter `public/images/concepts/` und tragen ihren
// Inhaltshash als Namen. Welche Datei zu welchem Commons-Bild gehört, steht im
// Manifest `public/data/image_mirror.json`, das `scripts/mirror_concept_images.mjs`
// schreibt. Das Manifest wird einmal je Sitzung geladen und danach aus dem
// Speicher bedient.
//
// Bewusste Entscheidung: Fehlt eine Kopie, zeigt die App KEIN Bild statt auf
// commons.wikimedia.org auszuweichen. Ein solcher Rückfall wäre wieder eine
// Anfrage an einen Dritten mit der IP des Besuchers. Dass keine Kopie fehlt,
// sichert `npm run audit:image-mirror` vor jedem Release ab.

import { isMirrorEntry } from './imageMirrorEntry.js';
import { useEffect, useState } from 'react';
import { dataUrl } from './dataUrl';
import { fileNameFromCommonsUrl } from './commonsImage';

/** Bis zu dieser Anzeigebreite genügt das kleine Vorschaubild (320 px). */
export const THUMB_MAX_WIDTH = 320;

const EMPTY_MIRROR = { dir: 'images/concepts', files: {} };

let mirrorPromise = null;
let loadedMirror = null;

/** Bringt ein gelesenes Manifest in eine Form, auf die sich der Rest verlassen kann. */
function normaliseMirror(raw) {
  if (!raw || typeof raw !== 'object') return EMPTY_MIRROR;
  const files = raw.files && typeof raw.files === 'object' && !Array.isArray(raw.files)
    ? raw.files
    : {};
  const dir = typeof raw.dir === 'string' && raw.dir ? raw.dir : EMPTY_MIRROR.dir;
  return { dir, files };
}

/**
 * Lädt das Manifest einmalig. Weitere Aufrufe bekommen dasselbe Versprechen.
 * Ein Ladefehler endet in einem leeren Manifest — dann bleiben die Bildplätze
 * leer, aber die App läuft weiter.
 */
export function loadImageMirror() {
  if (!mirrorPromise) {
    mirrorPromise = fetch(dataUrl('image_mirror.json'))
      .then((response) => (response.ok ? response.json() : null))
      .then((raw) => {
        loadedMirror = normaliseMirror(raw);
        return loadedMirror;
      })
      .catch(() => {
        loadedMirror = EMPTY_MIRROR;
        return loadedMirror;
      });
  }
  return mirrorPromise;
}

/** Nur für Tests: setzt den Zwischenspeicher zurück. */
export function resetImageMirrorCache(value = null) {
  mirrorPromise = value ? Promise.resolve(normaliseMirror(value)) : null;
  loadedMirror = value ? normaliseMirror(value) : null;
}

/**
 * React-Hook für den Manifestzustand.
 *
 * @returns {{dir:string, files:object}|null} `null`, solange noch geladen wird.
 */
export function useImageMirror() {
  const [mirror, setMirror] = useState(loadedMirror);
  useEffect(() => {
    if (mirror) return undefined;
    let active = true;
    loadImageMirror().then((value) => {
      if (active) setMirror(value);
    });
    return () => { active = false; };
  }, [mirror]);
  return mirror;
}

/**
 * Adresse der lokalen Kopie eines Konzeptbildes.
 *
 * @param {{dir:string, files:object}|null} mirror  Manifest aus `useImageMirror`.
 * @param {string} rawUrl  Commons-Dateiseite aus dem Konzeptdatensatz.
 * @param {number} width   Anzeigebreite in Pixeln.
 * @returns {string} Pfad relativ zum Dokument, oder '' wenn keine Kopie vorliegt.
 */
export function mirroredImageSrc(mirror, rawUrl, width) {
  if (!mirror) return '';
  const entry = mirrorEntry(mirror, rawUrl);
  if (!entry) return '';
  const requested = Number(width);
  const useThumb = entry.thumb
    && Number.isFinite(requested) && requested > 0 && requested <= THUMB_MAX_WIDTH;
  return `${mirror.dir}/${mirrorPathFor(useThumb ? entry.thumb : entry.file)}`;
}

/**
 * Pfad einer Kopie innerhalb des Bildverzeichnisses.
 *
 * Die Dateien liegen in 256 Unterordnern nach den ersten beiden Zeichen ihres
 * Hashes; ein einzelner Ordner mit rund 9000 Dateien bremst FTP-Listing und
 * Dateiverwaltung. `scripts/mirror_concept_images.mjs` legt sie genauso ab.
 */
export function mirrorPathFor(fileName) {
  return `${fileName.slice(0, 2)}/${fileName}`;
}

/**
 * Manifest-Eintrag zu einer Commons-Adresse.
 *
 * Das Manifest speichert je Datei ein knappes Feld
 * `[Basisdatei, Breite, Höhe, Vorschaudatei|0, Modus]`; der Modus ist `'o'` für
 * das unverändert übernommene Original und `'r'` für die verkleinerte Fassung.
 */
export function mirrorEntry(mirror, rawUrl) {
  if (!mirror) return null;
  const name = fileNameFromCommonsUrl(rawUrl);
  if (!name) return null;
  const raw = mirror.files?.[name];
  if (!isMirrorEntry(raw)) return null;
  return {
    file: raw[0],
    width: Number(raw[1]) || 0,
    height: Number(raw[2]) || 0,
    thumb: typeof raw[3] === 'string' && raw[3] ? raw[3] : '',
    mode: raw[4] === 'o' ? 'original' : 'resized',
  };
}
