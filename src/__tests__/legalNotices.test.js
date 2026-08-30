import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config.js';
import {
  countQuestionEntries,
  countRecordEntries
} from '../../scripts/generate_domain_stats.js';

const root = resolve(import.meta.dirname, '../..');

describe('veröffentlichte Drittanbieterhinweise', () => {
  it('entsprechen vollständig der kanonischen Repository-Datei', () => {
    const canonical = readFileSync(resolve(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
    const published = readFileSync(resolve(root, 'public/THIRD_PARTY_NOTICES.md'), 'utf8');
    expect(published).toBe(canonical);
    expect(canonical).toContain('entities — BSD 2-Clause');
    expect(canonical).toContain('Copyright (c) Felix Böhm');
  });

  it('sind von der ausgelieferten Credits-Seite direkt verlinkt', () => {
    const credits = readFileSync(resolve(root, 'public/credits.html'), 'utf8');
    expect(credits).toContain('href="./THIRD_PARTY_NOTICES.md"');
  });
});

describe('Build-Verträge', () => {
  it('öffnet beim Start des Entwicklungsservers kein GUI-Fenster', () => {
    expect(viteConfig.server.open).toBe(false);
  });

  it('weist strukturell falsche Statistikquellen zurück', () => {
    expect(countQuestionEntries([{ id: 'q1' }], 'Fragen')).toBe(1);
    expect(countRecordEntries({ c1: {} }, 'Konzepte')).toEqual([['c1', {}]]);
    expect(() => countQuestionEntries({}, 'Fragen')).toThrow(
      'Fragen muss ein JSON-Array sein.'
    );
    expect(() => countRecordEntries([], 'Konzepte')).toThrow(
      'Konzepte muss ein JSON-Objekt sein.'
    );
    expect(() => countRecordEntries(undefined, 'Orte')).toThrow(
      'Orte muss ein JSON-Objekt sein.'
    );
  });
});
