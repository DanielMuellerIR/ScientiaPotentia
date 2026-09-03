import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const require = createRequire(import.meta.url);
const {
  assertExpectedEntity,
  buildSingleLanguageQuery,
} = require('../../scripts/data_sources/harvest/lingua_harvest_helpers.cjs');
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

  it('behält einen Gedankenstrich innerhalb des Zitats bei', () => {
    const parsed = parseWikitext(
      '* „Denken heißt unterscheiden — und dennoch wieder verbinden.“',
    );

    expect(parsed[0].text).toBe(
      'Denken heißt unterscheiden — und dennoch wieder verbinden.',
    );
  });

  it('entfernt eine Quellenangabe erst hinter dem schließenden Anführungszeichen', () => {
    const parsed = parseWikitext(
      '* „Ein vollständiger Satz mit einem belegten Wortlaut.“ – Werk, Seite 12',
    );

    expect(parsed[0].text).toBe('Ein vollständiger Satz mit einem belegten Wortlaut.');
  });
});

describe('Lingua-Wikidata-Einzelabfragen', () => {
  it('fragt das deutsche Label und deutsche Aliase der QID mit ab', () => {
    const query = buildSingleLanguageQuery('Q9309');

    expect(query).toContain('wd:Q9309 rdfs:label ?itemLabel');
    expect(query).toContain('wd:Q9309 skos:altLabel ?itemAltLabel');
  });

  it('akzeptiert typografische Varianten und einen erklärenden Klammerzusatz', () => {
    expect(() => assertExpectedEntity(
      { nameDE: 'Waray-Waray', qid: 'Q34279' },
      [{ itemLabel: { value: 'Wáray-Wáray (Sprache)' } }],
    )).not.toThrow();
  });

  it('verwirft eine QID, deren Label und Aliase eine andere Sprache nennen', () => {
    expect(() => assertExpectedEntity(
      { nameDE: 'Walisisch', qid: 'Q9058' },
      [{
        itemLabel: { value: 'Slowakisch' },
        itemAltLabel: { value: 'slowakische Sprache' },
      }],
    )).toThrow('Q9058 bezeichnet laut Wikidata');
  });
});

describe('Zitat-Normalisierung (wikiquote_cleaning)', () => {
  const { normalizeQuoteText, quoteTokens } = require(
    '../../scripts/data_sources/harvest/wikiquote_cleaning.cjs');

  it('entfernt auch typografische Anfuehrungszeichen', () => {
    // CodeQA 2026-09-03: wikiquote_harvest und wikiquote_w4 trugen eine Kopie
    // dieser Funktion, die nur die geraden Anfuehrungszeichen kannte. Aus
    // „Die Freiheit" wurde dort das Dedup-Token `freiheit"` statt `freiheit`,
    // sodass die Overlap-Dublettenpruefung schlechter griff als im Verifizierer.
    expect(normalizeQuoteText('Er sagte: „Die Freiheit“ ist das Wichtigste.'))
      .toBe('er sagte die freiheit ist das wichtigste');
    expect(quoteTokens('„Freiheit“ ist ‚wichtig‘')).toEqual(['freiheit', 'ist', 'wichtig']);
  });

  it('behaelt Umlaute und loest ß auf', () => {
    expect(normalizeQuoteText('Größe und Übermut')).toBe('grösse und übermut');
  });

  it('wird von allen drei Wikiquote-Werkzeugen genutzt statt kopiert', () => {
    for (const tool of ['wikiquote_verify', 'wikiquote_harvest', 'wikiquote_w4']) {
      const source = readFileSync(
        resolve(ROOT, 'scripts/data_sources/harvest', `${tool}.cjs`), 'utf8');
      expect(source, tool).toContain('const norm = normalizeQuoteText;');
      expect(source, tool).not.toContain('function norm(s) {');
    }
  });
});
