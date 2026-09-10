// Zuordnung der `language_fact`-Konzepte zu ihrem Antwort-Konzept.
//
// Die elf Fragen vom Typ `lingua-fact-subject-rev` fragen nicht nach dem
// Fakt-Konzept selbst, sondern nach dem Ding, ueber das es etwas aussagt:
// „Auf welche Schrift trifft diese Beschreibung zu: juengste grosse Schrift?"
// -> Hangul. Welcher Name die richtige Antwort ist, steht handgepflegt in
// LANGUAGE_FACT_TARGETS in scripts/generate_lingua.js; die Distraktoren zieht
// der Generator aus der dort genannten Kategorie.
//
// Beides muss zusammenpassen. Benennt eine Harvest-Welle „Hangul" in „Hangeul"
// um, waere die als richtig markierte Antwort ein Name, den es nicht mehr gibt,
// und der umbenannte Originaleintrag stuende als Distraktor daneben: zwei
// richtige Optionen, die Frage unbeantwortbar. Der Generator bricht dafuer seit
// dem 2026-09-10 ab; dieser Test meldet es schon vorher in `npm test`, ohne
// dass jemand den Generator starten muss.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const quelle = readFileSync(resolve(root, 'scripts/generate_lingua.js'), 'utf8');
const konzepte = JSON.parse(
  readFileSync(resolve(root, 'scripts/data_sources/lingua_raw.json'), 'utf8')
);

/** Das Objektliteral aus dem Generator lesen — der Generator selbst laeuft beim Import sofort los. */
function leseZuordnung() {
  const block = quelle.match(/const LANGUAGE_FACT_TARGETS = (\{[\s\S]*?\n\});/);
  expect(block, 'LANGUAGE_FACT_TARGETS steht nicht mehr im erwarteten Format').not.toBeNull();
  // eslint-disable-next-line no-new-func
  return new Function(`return (${block[1]});`)();
}

const zuordnung = leseZuordnung();
const namenJeKategorie = {};
for (const konzept of konzepte) {
  (namenJeKategorie[konzept.category] ||= []).push(konzept.name);
}

describe('LANGUAGE_FACT_TARGETS', () => {
  it('ordnet ueberhaupt Konzepte zu', () => {
    expect(Object.keys(zuordnung).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(zuordnung))(
    '%s trifft genau ein Konzept der genannten Kategorie',
    (id, ziel) => {
      expect(konzepte.some(k => k.id === id), `Konzept ${id} fehlt im Bestand`).toBe(true);
      const namen = namenJeKategorie[ziel.pool];
      expect(namen, `Kategorie "${ziel.pool}" gibt es nicht`).toBeDefined();
      const treffer = namen.filter(name => name === ziel.answer).length;
      expect(treffer, `"${ziel.answer}" in "${ziel.pool}"`).toBe(1);
    }
  );

  it('nennt fuer jede Zuordnung Pool, Antwort und Gattungswort', () => {
    for (const [id, ziel] of Object.entries(zuordnung)) {
      expect(typeof ziel.pool, id).toBe('string');
      expect(typeof ziel.answer, id).toBe('string');
      expect(typeof ziel.word, id).toBe('string');
    }
  });
});
