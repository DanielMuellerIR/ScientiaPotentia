import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HARVEST_DIR = path.resolve('scripts/data_sources/harvest');
const CULTURA_SCRIPTS = [
  'wikidata_cultura.cjs',
  'wikidata_cultura_wd2.cjs',
  'wikidata_cultura_wd3.cjs',
  'wikidata_cultura_w4.cjs',
];

function readHarvestScript(fileName) {
  return fs.readFileSync(path.join(HARVEST_DIR, fileName), 'utf8');
}

describe('Cultura-Harvestquellen', () => {
  it('verwendet keine bekannten fachfremden Wikidata-IDs mehr', () => {
    const source = CULTURA_SCRIPTS.map(readHarvestScript).join('\n');
    const obsoleteQids = [
      'Q77', 'Q136', 'Q220', 'Q232', 'Q237', 'Q736',
      'Q1344', 'Q8253', 'Q11584', 'Q12560', 'Q131647', 'Q152095',
      'Q165980', 'Q16748867', 'Q174193', 'Q177303', 'Q186451',
      'Q7725310', 'Q42332', 'Q47209', 'Q7251', 'Q9268', 'Q8054',
      'Q25287', 'Q12282', 'Q891180', 'Q4233720', 'Q74930', 'Q189729',
    ];

    for (const qid of obsoleteQids) {
      expect(source, qid).not.toMatch(new RegExp(`\\b${qid}\\b`));
    }
  });

  it('filtert Gemälde in jeder Welle nach abgelaufener EU-Schutzfrist', () => {
    for (const fileName of CULTURA_SCRIPTS) {
      const source = readHarvestScript(fileName);
      expect(source, fileName).toContain('?creator wdt:P570 ?creatorDeathDate');
      expect(source, fileName).toContain('FILTER(?creatorDeathYear < 1956)');
    }
  });
});
