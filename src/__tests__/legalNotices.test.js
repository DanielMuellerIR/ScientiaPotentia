import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

describe('veröffentlichte Drittanbieterhinweise', () => {
  it('entsprechen vollständig der kanonischen Repository-Datei', () => {
    const canonical = readFileSync(resolve(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
    const published = readFileSync(resolve(root, 'public/THIRD_PARTY_NOTICES.md'), 'utf8');
    expect(published).toBe(canonical);
  });

  it('sind von der ausgelieferten Credits-Seite direkt verlinkt', () => {
    const credits = readFileSync(resolve(root, 'public/credits.html'), 'utf8');
    expect(credits).toContain('href="./THIRD_PARTY_NOTICES.md"');
  });
});
