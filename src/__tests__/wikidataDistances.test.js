import { describe, expect, it, vi } from 'vitest';
import { fetchDistancesForQids, toDistanceLy } from '../../scripts/data_sources/harvest/wikidata_distances.cjs';

const unit = qid => `http://www.wikidata.org/entity/${qid}`;
const binding = (qid, amount, unitQid) => ({
  item: { value: unit(qid) }, distAmount: { value: String(amount) }, distUnit: { value: unit(unitQid) },
});

describe('Wikidata-Distanzbatches', () => {
  it.each([
    ['2.4', 'Q531', 2], ['2', 'Q12129', 7], ['2', 'Q11929860', 6523],
    ['2', 'Q3773454', 6523120], ['-1', 'Q531', null], ['0', 'Q531', null],
    ['NaN', 'Q531', null], ['Infinity', 'Q531', null], ['12', 'Q828224', null],
  ])('rechnet %s mit Einheit %s zu %s Lichtjahren um', (amount, unitQid, expected) => {
    expect(toDistanceLy(amount, unit(unitQid))).toBe(expected);
  });

  it('verarbeitet mehrere vollständige Batches und bevorzugt direkte Lichtjahre', async () => {
    const qids = Array.from({ length: 61 }, (_, i) => `Q${i + 1}`);
    const batches = [];
    const sparql = vi.fn(async query => {
      const batch = [...query.matchAll(/wd:(Q\d+)/g)].map(match => match[1]);
      batches.push(batch);
      return batch.flatMap(qid => [
        binding(qid, 2, 'Q12129'), binding(qid, 12, 'Q531'), binding(qid, 3, 'Q3773454'),
      ]);
    });
    const sleep = vi.fn();
    const result = await fetchDistancesForQids(qids, 'Galaxy', { sparql, sleep, delayMs: 1500 });
    expect(batches.map(batch => batch.length)).toEqual([30, 30, 1]);
    expect(batches.flat()).toEqual(qids);
    expect([...result]).toEqual(qids.map(qid => [qid, 12]));
    expect(sleep.mock.calls).toEqual([[1500], [1500]]);
  });

  it('überspringt leere und ungültige Distanzangaben', async () => {
    const sparql = vi.fn().mockResolvedValue([
      {}, { item: { value: unit('Q1') } }, binding('Q2', -2, 'Q531'),
      binding('Q3', 12, 'Q828224'), binding('Q4', 0.1, 'Q531'), binding('Q5', 8, 'Q531'),
    ]);
    const sleep = vi.fn();
    expect(await fetchDistancesForQids([], 'Galaxy', { sparql, sleep, delayMs: 1500 })).toEqual(new Map());
    expect(sparql).not.toHaveBeenCalled();
    expect(await fetchDistancesForQids(['Q1', 'Q2', 'Q3', 'Q4', 'Q5'], 'Galaxy', { sparql, sleep, delayMs: 1500 }))
      .toEqual(new Map([['Q5', 8]]));
    expect(sleep).not.toHaveBeenCalled();
  });

  it('verwirft Teilergebnisse, wenn ein späterer Pflichtbatch scheitert', async () => {
    const failure = new Error('HTTP 503');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sparql = vi.fn().mockResolvedValueOnce([binding('Q1', 12, 'Q531')]).mockRejectedValueOnce(failure);
    try {
      await expect(fetchDistancesForQids(Array.from({ length: 61 }, (_, i) => `Q${i + 1}`),
        'Galaxy', { sparql, sleep: vi.fn(), delayMs: 1500 })).rejects.toBe(failure);
      expect(sparql).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith('  Distanz-Batch-Fehler (Galaxy): HTTP 503');
    } finally {
      warn.mockRestore();
    }
  });
});
