import { describe, expect, it } from 'vitest';
import { probeTerraSource } from '../../scripts/probe_terra_source.mjs';

describe('Unabhängige Terra-Importprobe', () => {
  it('meldet fehlende Populationen und Länder statt Ersatzwerte zu erfinden', () => {
    const report = probeTerraSource([{ cca2: 'DE', name: { common: 'Germany' }, area: 357000 }], new Set(['DE', 'FR']));
    expect(report.missingCodes).toEqual(['FR']);
    expect(report.coverage.population).toBe(0);
    expect(report.coverage.area).toBe(1);
    expect(report.directReplacement).toBe(false);
  });
  it('verwirft doppelte Länderkennungen', () => {
    expect(() => probeTerraSource([{ cca2: 'DE' }, { cca2: 'DE' }], new Set())).toThrow();
  });
});
