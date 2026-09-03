// Gemeinsame Regeln der Bild-Auflöser (harvest/image_resolution_policy.cjs).
//
// Die Datei entscheidet, welche Commons-Datei ein Konzept bekommt und welche
// gesperrt ist — sie hatte bis zur CodeQA-Kampagne 2026-09-03 keinen Test,
// obwohl alle fünf Auflöser, der Purge-Lauf, die Merge-Skripte und der
// Bildrechte-Audit sie benutzen.

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  fileNameFromUploadUrl,
  isBlacklistedConcept,
  isBlacklistedFile,
  normalizeCommonsFileTitle,
  selectP18File,
} = require('../../scripts/data_sources/harvest/image_resolution_policy.cjs');

describe('fileNameFromUploadUrl', () => {
  it('liest den Dateititel aus einer direkten Upload-Adresse', () => {
    expect(fileNameFromUploadUrl(
      'https://upload.wikimedia.org/wikipedia/commons/8/8f/Sumerian_cuneiform.svg'))
      .toBe('Sumerian_cuneiform.svg');
  });

  it('liest bei einer Thumbnail-Adresse das vorletzte Segment', () => {
    // CodeQA 2026-09-03: Vorher kam „1200px-Sumerian_cuneiform.svg.png" zurück.
    // Der anschließende File:-Lookup lief ins Leere, und das Konzept blieb
    // still ohne Bild — kein Fehler, kein Exit-Code, nur eine Lücke.
    expect(fileNameFromUploadUrl(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/'
      + 'Sumerian_cuneiform.svg/1200px-Sumerian_cuneiform.svg.png'))
      .toBe('Sumerian_cuneiform.svg');
    expect(fileNameFromUploadUrl(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Mona_Lisa.jpg/800px-Mona_Lisa.jpg'))
      .toBe('Mona_Lisa.jpg');
  });

  it('gibt bei einer unbrauchbaren Adresse null zurueck', () => {
    expect(fileNameFromUploadUrl('kein-url')).toBe(null);
  });
});

describe('Sperrliste', () => {
  it('erkennt die gesperrte Datei in allen gebraeuchlichen Schreibweisen', () => {
    for (const variante of [
      "Pablo Picasso's Guernica.jpg",
      "Pablo_Picasso's_Guernica.jpg",
      "File:Pablo Picasso's Guernica.jpg",
      "Datei:Pablo Picasso's Guernica.jpg",
      "https://commons.wikimedia.org/wiki/File:Pablo_Picasso%27s_Guernica.jpg",
      "https://commons.wikimedia.org/wiki/File%3APablo_Picasso%27s_Guernica.jpg",
    ]) {
      expect(isBlacklistedFile(variante), variante).toBe(true);
    }
  });

  it('laesst eine freie Datei durch', () => {
    expect(isBlacklistedFile('https://commons.wikimedia.org/wiki/File:Mona_Lisa.jpg')).toBe(false);
  });

  it('erkennt das gesperrte Konzept ueber seine id', () => {
    expect(isBlacklistedConcept('guernica')).toBe(true);
    expect(isBlacklistedConcept('mona-lisa')).toBe(false);
  });

  it('vereinheitlicht Commons-Titel unabhaengig von Praefix und Kodierung', () => {
    expect(normalizeCommonsFileTitle('File:Mona_Lisa.jpg')).toBe('Mona Lisa.jpg');
    expect(normalizeCommonsFileTitle('Datei:Mona_Lisa.jpg')).toBe('Mona Lisa.jpg');
  });
});

describe('selectP18File', () => {
  const statement = (value, rank = 'normal') => ({ rank, mainsnak: { datavalue: { value } } });

  it('nimmt genau ein bevorzugtes Bild', () => {
    expect(selectP18File([statement('A.jpg'), statement('B.jpg', 'preferred')])).toBe('B.jpg');
  });

  it('verwirft Mehrdeutigkeit statt zu raten', () => {
    expect(selectP18File([statement('A.jpg'), statement('B.jpg')])).toBe(null);
    expect(selectP18File([statement('A.jpg', 'preferred'), statement('B.jpg', 'preferred')]))
      .toBe(null);
  });

  it('ignoriert veraltete Angaben', () => {
    expect(selectP18File([statement('A.jpg'), statement('B.jpg', 'deprecated')])).toBe('A.jpg');
  });
});
