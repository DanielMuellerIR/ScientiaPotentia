import { describe, expect, it } from 'vitest';
import {
  buildImageMetadata,
  licenseUrlFor,
  sanitizeImageAttribution,
} from '../utils/imageCredits';

describe('Bildnachweise', () => {
  it('ordnet Creative-Commons-Varianten ihrer kanonischen Lizenzadresse zu', () => {
    expect(licenseUrlFor('CC BY-SA 3.0 de'))
      .toBe('https://creativecommons.org/licenses/by-sa/3.0/de/');
    expect(licenseUrlFor('CC0 1.0'))
      .toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(licenseUrlFor('Public domain')).toContain('Commons:Public_domain');
  });

  it('entfernt HTML und Kontaktadressen, behält aber den Urhebernamen', () => {
    expect(sanitizeImageAttribution('<a href="mailto:test@example.org">Ada Beispiel</a> / Own work'))
      .toBe('Ada Beispiel / Own work');
    expect(sanitizeImageAttribution('Ada Beispiel (test@example.org)'))
      .toBe('Ada Beispiel');
  });

  it('erzeugt Quelle, Lizenzlink und Änderungshinweis aus einem Rohdatensatz', () => {
    const metadata = buildImageMetadata({
      imageFile: 'https://commons.wikimedia.org/wiki/File%3ATest.jpg',
      imageLicense: 'CC BY 4.0',
      imageAttribution: 'Ada Beispiel',
    });
    expect(metadata).toEqual(expect.objectContaining({
      sourceUrl: 'https://commons.wikimedia.org/wiki/File%3ATest.jpg',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'Ada Beispiel',
      changes: 'für die Anzeige technisch skaliert',
    }));
  });
});
