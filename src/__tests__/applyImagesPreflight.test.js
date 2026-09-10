// Der Preflight der Bildernte muss dieselbe Urheberprüfung anlegen wie der
// Release-Audit. Lief beides auseinander, nahm `apply_images --write` einen
// Eintrag an, den `npm run build` später für die ganze Domain ablehnte — real
// eingetreten am 2026-09-03 mit dem Urheber „Own work." aus dem Homo-Lauf.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { hasPublishableAttribution } from '../utils/imageCredits';

const require = createRequire(import.meta.url);
const { validateMapping } = require('../../scripts/data_sources/harvest/apply_images.cjs');

/** Ein Mapping-Eintrag, wie ihn die Auflöser erzeugen. */
function entry(overrides = {}) {
  return {
    id: 'test-konzept',
    imageFile: 'https://commons.wikimedia.org/wiki/File%3ATest.jpg',
    imageLicense: 'CC BY 4.0',
    imageLicenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    imageAttribution: 'ESA/Hubble',
    ...overrides,
  };
}

describe('Urheberprüfung im Preflight der Bildernte', () => {
  it('nimmt einen konkreten Rechteinhaber an', () => {
    expect(() => validateMapping([entry()])).not.toThrow();
  });

  it('weist den generischen Fundort „Wikimedia Commons" ab', () => {
    expect(() => validateMapping([entry({ imageAttribution: 'Wikimedia Commons' })]))
      .toThrow(/keinen konkreten Rechteinhaber/);
  });

  it('weist „Own work." ab — der Fall, der bis zum Build durchrutschte', () => {
    expect(() => validateMapping([entry({ imageAttribution: 'Own work.' })]))
      .toThrow(/keinen konkreten Rechteinhaber/);
  });

  it('lässt ein gemeinfreies Werk ohne Namensnennung zu', () => {
    expect(() => validateMapping([entry({
      imageLicense: 'Public domain',
      imageLicenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Public_domain',
      imageAttribution: 'Unbekannt',
    })])).not.toThrow();
  });

  it('weist auch bei gemeinfreien Werken den Fundort als Urheber ab', () => {
    expect(() => validateMapping([entry({
      imageLicense: 'Public domain',
      imageAttribution: 'Wikimedia Commons',
    })])).toThrow(/keinen konkreten Rechteinhaber/);
  });

  it('prüft mit derselben Funktion wie der Release-Audit', () => {
    // Sind beide Wege verschieden, ist der Befund hier ein anderer als im Build.
    const faelle = [
      ['CC BY 4.0', 'ESA/Hubble', true],
      ['CC BY 4.0', 'Own work.', false],
      ['Public domain', 'Wikimedia Commons', false],
      ['CC0', 'Unknown author', true],
    ];
    for (const [license, attribution, erwartet] of faelle) {
      expect(hasPublishableAttribution(license, attribution)).toBe(erwartet);
      const wirft = (() => {
        try {
          validateMapping([entry({ imageLicense: license, imageAttribution: attribution })]);
          return false;
        } catch {
          return true;
        }
      })();
      expect(wirft, `${license} / ${attribution}`).toBe(!erwartet);
    }
  });
});
