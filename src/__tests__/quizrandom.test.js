import { describe, expect, it } from 'vitest';

import { pickBalanced, seededShuffle } from '../../scripts/lib/quizrandom.js';

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
});
