import { describe, expect, it } from 'vitest';
import { hasEnglishLeak } from '../../scripts/lib/english_leak';

describe('hasEnglishLeak', () => {
  it('erkennt englische Wörter nur an Unicode-Wortgrenzen', () => {
    expect(hasEnglishLeak('lingua', '„én = in + theós = Gott“')).toBe(false);
    expect(hasEnglishLeak('lingua', 'von theōrein = anschauen')).toBe(false);
    expect(hasEnglishLeak('lingua', 'What is the meaning of this word?')).toBe(true);
  });
});
