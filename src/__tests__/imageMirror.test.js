import { describe, expect, it, afterEach } from 'vitest';
import {
  mirrorEntry, mirrorPathFor, mirroredImageSrc, resetImageMirrorCache, THUMB_MAX_WIDTH,
} from '../utils/imageMirror';
import { changeNoteFor, normaliseImageCredit } from '../utils/imageCredits';
import { clearImageMirror } from './helpers/imageMirror';

const COMMONS = 'https://commons.wikimedia.org/wiki/File%3ABlue_Marble.jpg';

const mirror = {
  dir: 'images/concepts',
  files: {
    'Blue Marble.jpg': ['ab12cd34ef567890.webp', 960, 720, 'cd99ef0011223344.webp', 'r'],
    'Ohne Vorschau.png': ['9f0011223344aabb.png', 500, 400, 0, 'o'],
  },
};

afterEach(clearImageMirror);

describe('Bildmanifest', () => {
  it('legt Kopien in Unterordner nach den ersten beiden Zeichen', () => {
    expect(mirrorPathFor('ab12cd34ef567890.webp')).toBe('ab/ab12cd34ef567890.webp');
  });

  it('liefert für kleine Anzeigebreiten das Vorschaubild, sonst das Basisbild', () => {
    expect(mirroredImageSrc(mirror, COMMONS, THUMB_MAX_WIDTH))
      .toBe('images/concepts/cd/cd99ef0011223344.webp');
    expect(mirroredImageSrc(mirror, COMMONS, THUMB_MAX_WIDTH + 1))
      .toBe('images/concepts/ab/ab12cd34ef567890.webp');
    // Ohne Vorschaubild bleibt es bei der Basisdatei, auch im Depot.
    expect(mirroredImageSrc(mirror, 'https://commons.wikimedia.org/wiki/File:Ohne_Vorschau.png', 300))
      .toBe('images/concepts/9f/9f0011223344aabb.png');
  });

  it('weicht ohne Eintrag nicht auf Wikimedia aus, sondern liefert nichts', () => {
    expect(mirroredImageSrc(mirror, 'https://commons.wikimedia.org/wiki/File:Fehlt.jpg', 640))
      .toBe('');
    expect(mirroredImageSrc(mirror, 'https://images.nasa.gov/details/test.jpg', 640)).toBe('');
  });

  it('liefert nichts, solange das Manifest noch nicht geladen ist', () => {
    // `null` heißt „noch unbekannt" — die Komponenten warten dann, statt das
    // Bild vorschnell als fehlend zu behandeln.
    expect(mirroredImageSrc(null, COMMONS, 640)).toBe('');
    expect(mirrorEntry(null, COMMONS)).toBeNull();
  });

  it('übersteht ein beschädigtes Manifest ohne Ausnahme', () => {
    const broken = { dir: 'images/concepts', files: { 'Blue Marble.jpg': ['', 0, 0, 0, 'r'] } };
    expect(mirrorEntry(broken, COMMONS)).toBeNull();
    expect(mirrorEntry({ dir: 'x', files: { 'Blue Marble.jpg': 'kein Feld' } }, COMMONS)).toBeNull();
  });

  it('meldet den Modus der Kopie', () => {
    expect(mirrorEntry(mirror, COMMONS).mode).toBe('resized');
    expect(mirrorEntry(mirror, 'https://commons.wikimedia.org/wiki/File:Ohne_Vorschau.png').mode)
      .toBe('original');
  });

  it('nimmt ein vorgeladenes Manifest ohne Netzzugriff an', () => {
    resetImageMirrorCache(mirror);
    expect(mirroredImageSrc(mirror, COMMONS, 640)).toContain('images/concepts/');
  });
});

describe('Änderungshinweis im Bildnachweis', () => {
  it('nennt ein unverändert übernommenes Original nicht skaliert', () => {
    expect(changeNoteFor('original')).toBe('unverändert übernommen');
    expect(changeNoteFor('resized')).toBe('für die Anzeige technisch skaliert');
    expect(changeNoteFor()).toBe('für die Anzeige technisch skaliert');
  });

  it('sticht mit dem Modus der Kopie den im Katalog gespeicherten Hinweis', () => {
    const image = {
      url: COMMONS,
      license: 'CC BY 4.0',
      attribution: 'Testautor',
      changes: 'für die Anzeige technisch skaliert',
    };
    expect(normaliseImageCredit(image, 'original').changes).toBe('unverändert übernommen');
    expect(normaliseImageCredit(image).changes).toBe('für die Anzeige technisch skaliert');
  });
});
