import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertPreservesExistingConceptIds } from '../../scripts/lib/merge_safety.js';

describe('Merge-Schutz', () => {
  it('blockiert den Verlust alter IDs auch bei gleich großer oder größerer Ausgabe', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'scientia-merge-')), 'raw.json');
    writeFileSync(file, JSON.stringify([{ id: 'alt-a' }, { id: 'alt-b' }]));

    expect(() => assertPreservesExistingConceptIds(file, [
      { id: 'alt-a' }, { id: 'neu-a' }, { id: 'neu-b' },
    ])).toThrow(/alt-b/);
  });

  it('erlaubt Ergänzungen, solange jede bestehende ID erhalten bleibt', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'scientia-merge-')), 'raw.json');
    writeFileSync(file, JSON.stringify([{ id: 'alt-a' }, { id: 'alt-b' }]));

    expect(() => assertPreservesExistingConceptIds(file, [
      { id: 'alt-b' }, { id: 'alt-a' }, { id: 'neu' },
    ])).not.toThrow();
  });
});
