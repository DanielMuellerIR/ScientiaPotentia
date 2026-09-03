// Konsistenz der veröffentlichten Bestandszahlen und Metadaten.
//
// Nacht-Review 2026-09-02: `docs/content_ceiling.md` nannte 5.552 Astra-, 3.179
// Homo- und 7.740 Cultura-Fragen, während das beim Build erzeugte
// `public/data/domain_stats.json` 5.677, 3.242 und 7.767 auswies; das Changelog
// wiederholte den veralteten Homo-Wert. Parallel stand im Lockfile noch die
// Vorgängerversion. Beides sind Zahlen, die niemand von Hand nachzieht — darum
// prüfen sie diese Tests gegen die jeweilige Quellwahrheit.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeDomainStats } from '../../scripts/generate_domain_stats.js';

const root = resolve(import.meta.dirname, '../..');
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));

// Sollzahlen aus den tatsächlich veröffentlichten Katalogen, nicht aus dem
// abgelegten Manifest: Das Manifest entsteht erst im Build, also nach diesem
// Test. Verglichen wird es hier gegen die Kataloge, die Doku gegen dieselbe
// Rechnung (Nacht-Review 2026-09-03 — eine zusätzliche Astra-Frage ohne
// Manifest-Lauf ließ zuvor alle Tests dieser Datei grün).
const stats = computeDomainStats();
const manifest = readJson('public/data/domain_stats.json');
const packageJson = readJson('package.json');
const lockfile = readJson('package-lock.json');

/** Deutsche Tausenderpunkte, wie sie in der Ceiling-Tabelle stehen. */
const de = (value) => value.toLocaleString('de-DE');

describe('Projektversion', () => {
  it('steht im Lockfile identisch zu package.json', () => {
    expect(lockfile.version).toBe(packageJson.version);
    expect(lockfile.packages[''].version).toBe(packageJson.version);
  });
});

describe('Bestandsmanifest', () => {
  it('entspricht den generierten Katalogen', () => {
    expect(manifest).toEqual(stats);
  });

  it('summiert die Bereichszahlen korrekt auf', () => {
    const sum = (key) => Object.values(stats.domains)
      .reduce((total, domain) => total + domain[key], 0);
    expect(stats.totals.questions).toBe(sum('questions'));
    expect(stats.totals.concepts).toBe(sum('concepts'));
    expect(stats.totals.images).toBe(sum('images'));
    expect(stats.totals.domains).toBe(Object.keys(stats.domains).length);
  });
});

describe('Bestandszahlen der Ceiling-Doku', () => {
  const ceiling = readFileSync(resolve(root, 'docs/content_ceiling.md'), 'utf8');
  const label = {
    terra: 'Terra', astra: 'Astra', homo: 'Homo', natura: 'Natura',
    lingua: 'Lingua', cultura: 'Cultura', machina: 'Machina', historia: 'Historia',
  };

  for (const [domain, name] of Object.entries(label)) {
    it(`nennen für ${name} den Stand aus domain_stats.json`, () => {
      const row = ceiling.split('\n').find(line => line.startsWith(`| ${name} |`));
      expect(row, `Zeile für ${name} fehlt in docs/content_ceiling.md`).toBeDefined();
      // split('|') liefert vor dem ersten Trenner eine leere Zelle, danach den Namen.
      const [, , fragen, konzepte, bilder] = row.split('|').map(cell => cell.trim());
      expect(fragen).toBe(de(stats.domains[domain].questions));
      // Terra beschreibt Konzepte und Bilder bewusst in Worten
      // („1.852 Kartenobjekte", „Karte"), weil es die Karte statt Konzeptbilder nutzt.
      if (domain === 'terra') {
        expect(konzepte).toContain(de(stats.domains[domain].concepts));
        return;
      }
      expect(konzepte).toBe(de(stats.domains[domain].concepts));
      expect(bilder).toBe(de(stats.domains[domain].images));
    });
  }
});

describe('Erdteilfrage in Natura', () => {
  // Der abgeleitete Kontinent führte „Mittelamerika" als Antwort auf die Frage
  // „Auf welchem Erdteil …?" — für Kuba und die Antillen sogar sachlich falsch.
  const ERDTEILE = new Set([
    'Afrika', 'Antarktis', 'Asien', 'Australien und Ozeanien',
    'Europa', 'Nordamerika', 'Südamerika',
  ]);

  it('nennt als Antwort und als Distraktor nur echte Erdteile', () => {
    const questions = readJson('public/data/questions_natura.json')
      .filter(question => question.type === 'natura-animal-continent');
    expect(questions.length).toBeGreaterThan(100);
    const fremd = new Set();
    for (const question of questions) {
      for (const option of question.options) if (!ERDTEILE.has(option)) fremd.add(option);
    }
    expect([...fremd]).toEqual([]);
  });
});
