import { describe, expect, it } from 'vitest';

import {
  deParse,
  magnitudeSpreadDistractors,
  pickBalanced,
  pickNumeric,
  seededShuffle,
  shouldMagnitudeSpread,
} from '../../scripts/lib/quizrandom.js';
import {
  distinctOptionValues,
  revealsAnswer,
  revealsAnswerStrict,
} from '../../scripts/lib/generator_text.js';

describe('deterministische Generator-Zufallsauswahl', () => {
  it('mischt denselben Pool mit derselben Fragen-ID bytegleich', () => {
    const values = ['A', 'B', 'C', 'D', 'E'];

    expect(seededShuffle(values, 'q_DE_capital')).toEqual(
      seededShuffle(values, 'q_DE_capital'),
    );
    expect(values).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('kann gleiche richtige Antworten über die Fragen-ID verschieden verteilen', () => {
    const candidates = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'];

    expect(pickBalanced('ZZZ', candidates, 3, 'q1')).toEqual(['CCC', 'DDD', 'BBB']);
    expect(pickBalanced('ZZZ', candidates, 3, 'q2')).toEqual(['FFF', 'BBB', 'AAA']);
  });

  it('liest deutsch formatierte Zahlen samt Vorzeichen und Einheit', () => {
    expect(deParse('2.500.000 Lichtjahre')).toBe(2_500_000);
    expect(deParse('-26,74 mag')).toBe(-26.74);
    expect(deParse('unbekannt')).toBeNaN();
  });

  it('entfernt nicht-endliche und sichtbar gleiche numerische Distraktoren', () => {
    const format = value => Math.round(value).toLocaleString('de-DE');

    expect(pickNumeric(10, [NaN, Infinity, 10.1, 10.4, 11.1, 12.2, 13.3], format))
      .toEqual(['11', '12', '13']);
  });

  it('verwirft bei kontinuierlichen Messwerten praktisch gleiche Werte', () => {
    expect(pickNumeric(0.63, [0.631, 0.64, 0.7, 0.8], value => `${value} m`))
      .toEqual(['0.64 m', '0.7 m', '0.8 m']);
  });

  it('verwendet Größenordnungswerte nur für geeignete, breite Messreihen', () => {
    const values = [1, 10, 100, 1_000, 10_000, 100_000];
    expect(shouldMagnitudeSpread(1_000, values, 'distanceKm')).toBe(true);
    expect(shouldMagnitudeSpread(1_000, values, 'defaultPort')).toBe(false);

    const distractors = magnitudeSpreadDistractors(
      1_000,
      values,
      value => `${value} km`,
      { seed: 'distance-question' },
    );
    expect(distractors).toHaveLength(3);
    expect(new Set(distractors).size).toBe(3);
    expect(distractors).not.toContain('1000 km');
  });
});

describe('gemeinsame Generator-Textregeln', () => {
  it('dedupliziert Ortsangaben unabhängig von Reihenfolge und Umlautschreibweise', () => {
    expect(distinctOptionValues([
      'Rom, Galleria Borghese',
      'Galleria Borghese, Rom',
      'München',
      'Munchen',
    ])).toEqual(['Rom, Galleria Borghese', 'München']);
  });

  it('unterscheidet Basis- und Stammprüfung bei Antwort-Leaks', () => {
    expect(revealsAnswer('Werk aus der Romantik', 'romantisch')).toBe(false);
    expect(revealsAnswerStrict('Werk aus der Romantik', 'romantisch')).toBe(true);
  });
});
