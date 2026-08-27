import { describe, expect, it } from 'vitest';
import { isDocumentedDeathYear } from '../../scripts/lib/quoteRights.mjs';

describe('Zitat-Rechtejahre', () => {
  it('akzeptiert ausschließlich tatsächlich gelieferte ganzzahlige JSON-Zahlen', () => {
    expect(isDocumentedDeathYear(1890)).toBe(true);
    for (const invalid of [null, '', '1890', 0, 1890.5, undefined]) {
      expect(isDocumentedDeathYear(invalid)).toBe(false);
    }
  });
});
