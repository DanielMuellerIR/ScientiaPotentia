import { describe, expect, it } from 'vitest';
import {
  buildImageMetadata,
  isAllowedImageLicense,
  isConcreteImageAttribution,
  licenseUrlFor,
  normaliseImageCredit,
  sanitizeImageAttribution,
} from '../utils/imageCredits';
import { commonsToDirectUrl, isWikimediaCommonsUrl } from '../utils/commonsImage';
import imageLicensePolicy from '../../scripts/lib/image_license_policy.cjs';

const {
  isAllowedCommonsLicenseMetadata,
  licenseNameFromCommonsMetadata,
} = imageLicensePolicy;

const commonsMetadata = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [key, { value }]),
);

describe('Bildnachweise', () => {
  it('ordnet Creative-Commons-Varianten ihrer kanonischen Lizenzadresse zu', () => {
    expect(licenseUrlFor('CC BY-SA 3.0 de'))
      .toBe('https://creativecommons.org/licenses/by-sa/3.0/de/');
    expect(licenseUrlFor('CC0 1.0'))
      .toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(licenseUrlFor('Public domain')).toContain('Commons:Public_domain');
    expect(licenseUrlFor('CC BY-SA')).toBe('');
    expect(licenseUrlFor('Proprietary')).toBe('');
  });

  it('entfernt HTML und Kontaktadressen, behält aber den Urhebernamen', () => {
    expect(sanitizeImageAttribution('<a href="mailto:test@example.org">Ada Beispiel</a> / Own work'))
      .toBe('Ada Beispiel / Own work');
    expect(sanitizeImageAttribution('Ada Beispiel (test@example.org)'))
      .toBe('Ada Beispiel');
    expect(sanitizeImageAttribution('Rolf M&uuml;ller on April 17, 2005.'))
      .toBe('Rolf Müller on April 17, 2005.');
    expect(sanitizeImageAttribution('Ada Beispiel / Wikimedia Commons'))
      .toBe('Ada Beispiel');
  });

  it('unterscheidet konkrete Urheber von bereinigten Hinweisresten', () => {
    expect(isConcreteImageAttribution('Ada Beispiel')).toBe(true);
    expect(isConcreteImageAttribution('Please report references to .')).toBe(false);
    expect(isConcreteImageAttribution('Unknown author')).toBe(false);
  });

  it('akzeptiert nur dokumentierte freie Lizenzbezeichnungen', () => {
    expect(isAllowedImageLicense('CC BY-SA 2.5')).toBe(true);
    expect(isAllowedImageLicense('Attribution')).toBe(true);
    expect(isAllowedImageLicense('FAL')).toBe(true);
    expect(isAllowedImageLicense('GFDL 1.2')).toBe(true);
    expect(isAllowedImageLicense('CC BY-SA')).toBe(false);
    expect(isAllowedImageLicense('CC BY 99.0')).toBe(false);
    expect(isAllowedImageLicense('Proprietary')).toBe(false);
  });

  it('wendet dieselbe Positivliste auf Commons-Metadaten an', () => {
    expect(isAllowedCommonsLicenseMetadata(commonsMetadata({
      LicenseShortName: 'CC BY-SA 4.0',
    }))).toBe(true);
    expect(isAllowedCommonsLicenseMetadata(commonsMetadata({
      LicenseShortName: 'GFDL 1.2',
    }))).toBe(true);
    expect(isAllowedCommonsLicenseMetadata(commonsMetadata({
      LicenseShortName: 'CC BY-NC 4.0',
    }))).toBe(false);
    expect(isAllowedCommonsLicenseMetadata(commonsMetadata({
      LicenseShortName: 'irgendeine Lizenz',
    }))).toBe(false);
    expect(isAllowedCommonsLicenseMetadata(commonsMetadata({
      LicenseShortName: 'Public domain',
      UsageTerms: 'All rights reserved',
    }))).toBe(false);
  });

  it('vereinheitlicht Commons-Lizenzvorlagen für die Veröffentlichung', () => {
    expect(licenseNameFromCommonsMetadata(commonsMetadata({
      LicenseShortName: 'PD-old',
      Copyrighted: 'False',
    }))).toBe('Public domain');
    expect(licenseNameFromCommonsMetadata(commonsMetadata({
      LicenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/de/',
    }))).toBe('CC BY-SA 3.0 de');
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

  it('nennt nur echte Commons-Hosts Wikimedia Commons', () => {
    const commons = normaliseImageCredit({
      url: 'https://commons.wikimedia.org/wiki/File%3ATest.jpg'
    });
    const external = normaliseImageCredit({
      url: 'https://images.nasa.gov/details/test.jpg'
    });

    expect(commons.sourceLabel).toBe('Wikimedia Commons');
    expect(external.sourceLabel).toBe('Bildquelle');
    expect(isWikimediaCommonsUrl(commons.sourceUrl)).toBe(true);
    expect(isWikimediaCommonsUrl('https://notcommons.wikimedia.org/wiki/File:Test.jpg')).toBe(false);
  });

  it('gibt Wikimedia Commons nicht als vermeintlichen Urheber aus', () => {
    expect(normaliseImageCredit({
      url: 'https://commons.wikimedia.org/wiki/File%3ATest.jpg',
      attribution: 'Wikimedia Commons'
    }).attribution).toBe('Urheberangabe auf der Dateiseite');
  });

  it('wandelt nur echte Commons-Dateiseiten in skalierte Bildadressen um', () => {
    const commons = 'https://commons.wikimedia.org/wiki/File%3ATest%20image.jpg';
    const lookalike = 'https://notcommons.wikimedia.org/wiki/File:Test.jpg';

    expect(commonsToDirectUrl(commons, 639.6))
      .toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Test%20image.jpg?width=640');
    expect(commonsToDirectUrl(lookalike, 640)).toBe(lookalike);
    expect(commonsToDirectUrl('keine URL', 640)).toBe('keine URL');
  });
});
