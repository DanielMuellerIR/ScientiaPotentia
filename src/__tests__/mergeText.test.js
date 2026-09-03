// Gemeinsame Textregeln der Merge-Skripte (scripts/lib/merge_text.js).
//
// CodeQA 2026-09-03: Drei Merges liessen ihre deutsche Wortliste ueber das
// komplette Konzeptobjekt laufen. Folge waren 38 Konzept-IDs mit Umlauten und
// ein toter Urheberlink. Ausserdem stand der Vergleichsschluessel fuer die
// Dublettenerkennung fuenfmal byte-identisch in den Skripten.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { applyTextFix, normalizeForDedup } from '../../scripts/lib/merge_text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Beispielhafte Wortliste, wie sie die Merge-Skripte fuehren — samt der
 * Grossschreibung des ersten Buchstabens, die dort ebenfalls erhalten bleibt.
 */
const PAARE = [['weisser', 'weißer'], ['grosser', 'großer'], ['gemaelde', 'gemälde']];
const fix = (text) => {
  let out = String(text ?? '');
  for (const [ascii, deutsch] of PAARE) {
    out = out.replace(new RegExp(ascii, 'gi'), match =>
      (match[0] === match[0].toUpperCase() ? deutsch[0].toUpperCase() + deutsch.slice(1) : deutsch));
  }
  return out;
};

describe('applyTextFix', () => {
  const concept = {
    id: 'weisser-hai',
    name: 'Weisser Hai',
    category: 'animal',
    attributes: { lebensraum: 'grosser Ozean', tiefe: 1200, tags: ['grosser Fisch'] },
    funFact: 'Ein grosser Jäger.',
    sourceUrl: 'https://example.org/pressebild_gemaelde.htm',
    imageFile: 'https://commons.wikimedia.org/wiki/File:Gemaelde.jpg',
    imageAttribution: 'A / https://example.org/gemaelde.htm',
  };

  it('korrigiert Anzeigefelder und Attributwerte', () => {
    const out = applyTextFix(concept, fix);
    expect(out.name).toBe('Weißer Hai');
    expect(out.funFact).toBe('Ein großer Jäger.');
    expect(out.attributes.lebensraum).toBe('großer Ozean');
    expect(out.attributes.tags).toEqual(['großer Fisch']);
    expect(out.attributes.tiefe).toBe(1200);
  });

  it('laesst id, URLs und Bildfelder unangetastet', () => {
    const out = applyTextFix(concept, fix);
    // Die id ist zugleich der Schluessel des Lernfortschritts in IndexedDB.
    expect(out.id).toBe('weisser-hai');
    expect(out.sourceUrl).toBe(concept.sourceUrl);
    expect(out.imageFile).toBe(concept.imageFile);
    // Ein Urheberlink ist die Lizenzangabe; ein zerschriebener Link ist tot.
    expect(out.imageAttribution).toBe('A / https://example.org/gemaelde.htm');
  });

  it('veraendert die Eingabe nicht', () => {
    const before = JSON.stringify(concept);
    applyTextFix(concept, fix);
    expect(JSON.stringify(concept)).toBe(before);
  });
});

describe('normalizeForDedup', () => {
  it('loest Umlaute auf und entfernt Klammerinhalte', () => {
    expect(normalizeForDedup('Weißer Hai')).toBe('weisserhai');
    expect(normalizeForDedup('David (Michelangelo)')).toBe('david');
    expect(normalizeForDedup(null)).toBe('');
  });

  it('wird von fuenf Merge-Skripten genutzt statt kopiert', () => {
    for (const script of ['merge_natura', 'merge_lingua', 'merge_astra',
      'merge_cultura', 'merge_phase5']) {
      const source = readFileSync(join(ROOT, 'scripts', `${script}.js`), 'utf8');
      expect(source, script).toContain('const norm = normalizeForDedup;');
    }
  });

  it('laesst merge_machina_historia bewusst eine eigene Fassung', () => {
    // Dort bleiben `+` und `#` erhalten, sonst fielen „C", „C++" und „C#"
    // auf denselben Schluessel.
    const source = readFileSync(join(ROOT, 'scripts', 'merge_machina_historia.js'), 'utf8');
    expect(source).toContain('function norm(s)');
    expect(normalizeForDedup('C++')).toBe('c');
  });
});
