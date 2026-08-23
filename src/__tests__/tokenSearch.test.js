import { describe, expect, it } from 'vitest';
import { matchesNameTokenPrefix } from '../utils/tokenSearch';

describe('matchesNameTokenPrefix', () => {
  it('findet nur Wortanfänge statt beliebiger Teilstrings', () => {
    expect(matchesNameTokenPrefix('Eule', 'eule')).toBe(true);
    expect(matchesNameTokenPrefix('Beulenkrokodil', 'eule')).toBe(false);
    expect(matchesNameTokenPrefix('Eule', '---')).toBe(false);
  });

  it('normalisiert Umlaute, ß und mehrere Suchbegriffe', () => {
    expect(matchesNameTokenPrefix('Ägyptische Wüstenspringmaus', 'agypt wusten'))
      .toBe(true);
    expect(matchesNameTokenPrefix('Große Straße', 'grosse strasse')).toBe(true);
  });
});
