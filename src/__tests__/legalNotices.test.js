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

// Impressum und Datenschutz muessen im GERENDERTEN UI stehen, nicht nur in einer
// sonst leeren index.html — bei einer Single-Page-App also im DOM. Geprueft wurde
// das bisher nirgends: check_layout_contract.cjs liest fuer den Footer nur
// src/index.css, und kein Test fasste das Markup an. Wer den footer-Block aus
// App.jsx entfernt, haette gruenes npm test, gruenes check:layout und gruenen
// Build gehabt — und eine ausgelieferte App ohne Pflichtangaben.
describe('Pflichtangaben im gerenderten UI', () => {
  const appQuelle = readFileSync(resolve(root, 'src/App.jsx'), 'utf8');

  it('rendert die Fusszeile, auf die der Layoutvertrag sich bezieht', () => {
    expect(appQuelle).toMatch(/<footer[^>]*className="app-footer"/);
  });

  it.each([
    ['Impressum', 'https://dm0.de/impressum.html'],
    ['Datenschutz', 'https://dm0.de/datenschutz.html'],
    ['Bild- & Datenquellen', './credits.html'],
  ])('verlinkt %s', (beschriftung, ziel) => {
    expect(appQuelle).toContain(`href="${ziel}"`);
    // Die Beschriftung steht im Markup teils mit Entity (&amp;).
    const sichtbar = beschriftung.replace('&', '&amp;');
    expect(appQuelle).toContain(sichtbar);
  });

  it('oeffnet die externen Rechtsseiten abgesichert gegen Tab-Nabbing', () => {
    for (const treffer of appQuelle.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) {
      expect(treffer[0]).toContain('rel="noopener noreferrer"');
    }
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
