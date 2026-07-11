import { describe, it, expect } from 'vitest';
import { shuffle } from '../utils/shuffle';

// Tests fuer den Fisher-Yates-Helfer (ersetzt den verzerrten
// sort(() => 0.5 - Math.random())-Shuffle im Quiz).

describe('shuffle', () => {
  it('verändert das Eingabe-Array nicht (non-mutating)', () => {
    const input = [1, 2, 3, 4, 5];
    const before = [...input];
    shuffle(input);
    expect(input).toEqual(before);
  });

  it('liefert eine Permutation: gleiche Elemente, gleiche Länge', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it('kommt mit Leer- und Ein-Element-Arrays klar', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([42])).toEqual([42]);
  });

  it('mischt gleichverteilt: jedes Element landet etwa gleich oft vorn', () => {
    // Statistischer Grobtest: bei 6000 Läufen über [0,1,2] muss jedes Element
    // ~2000× an Position 0 stehen. Toleranz großzügig (±15 %), damit der Test
    // nie flaked — der alte verzerrte Shuffle läge weit außerhalb.
    const counts = [0, 0, 0];
    for (let i = 0; i < 6000; i++) {
      counts[shuffle([0, 1, 2])[0]]++;
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(1700);
      expect(c).toBeLessThan(2300);
    }
  });
});
