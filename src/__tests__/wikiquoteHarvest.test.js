import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const parsers = [
  ['Wikiquote-Hauptlauf', require('../../scripts/data_sources/harvest/wikiquote_harvest.cjs')],
  ['Wikiquote-Welle 4', require('../../scripts/data_sources/harvest/wikiquote_w4.cjs')],
];

describe.each(parsers)('%s', (_name, { isMetaSection, parseWikitext }) => {
  it('erkennt auch kurze Zuschreibungsüberschriften als Meta-Abschnitt', () => {
    expect(isMetaSection('Zugeschrieben')).toBe(true);
  });

  it('verwirft einen Meta-Abschnitt samt tieferen Unterüberschriften', () => {
    const parsed = parseWikitext([
      '== Werk A ==',
      '* Dies ist ein belegtes Originalzitat mit ausreichender Länge.',
      '== Zitate über die Person ==',
      '* Dies ist ein Fremdzitat und darf nicht übernommen werden.',
      '=== Biografische Notizen ===',
      '* Entstanden 1807 und erstmals 1835 aus dem Nachlass gedruckt.',
      '== Werk B ==',
      '* Dies ist ein zweites belegtes Originalzitat mit ausreichender Länge.',
    ].join('\n'));

    expect(parsed).toEqual([
      {
        text: 'Dies ist ein belegtes Originalzitat mit ausreichender Länge.',
        workHint: 'Werk A',
      },
      {
        text: 'Dies ist ein zweites belegtes Originalzitat mit ausreichender Länge.',
        workHint: 'Werk B',
      },
    ]);
  });
});
