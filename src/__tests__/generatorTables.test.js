// Handgepflegte Tabellen, die auf den Datenbestand verweisen.
//
// Solche Tabellen ordnen einer Kennung oder einem Namen aus den Rohdaten etwas
// zu — und niemand merkt es, wenn der Bestand sich darunter weiterbewegt. Die
// CodeQA-Kampagne vom 2026-09-10 fand zwei Auspraegungen:
//
// - `LANGUAGE_FACT_TARGETS` in scripts/generate_lingua.js nennt die richtige
//   Antwort einer Frage. Trifft sie ins Leere, entsteht eine unbeantwortbare
//   Frage. Der Generator bricht dafuer ab; geprueft in linguaFactTargets.test.js.
// - `CITY_TO_RIVER` in scripts/generate_questions.js entscheidet, ob es zu einer
//   Stadt eine Flussfrage gibt. Trifft ein Eintrag ins Leere, faellt die Frage
//   still aus. Zwei der damals 24 Eintraege (Dresden, Basel) nannten Staedte, die
//   es in geodb.json gar nicht gibt.
//
// Ein Generatorlauf wuerde das nicht melden, und niemand zaehlt die erzeugten
// Fragen von Hand nach. Deshalb dieser Test.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const quelle = readFileSync(resolve(root, 'scripts/generate_questions.js'), 'utf8');
const geodb = JSON.parse(readFileSync(resolve(root, 'src/data/geodb.json'), 'utf8'));

/** Objektliteral einer Konstante aus dem Generator lesen (er laeuft beim Import sofort los). */
function leseTabelle(name) {
  const block = quelle.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`));
  expect(block, `${name} steht nicht mehr im erwarteten Format`).not.toBeNull();
  // eslint-disable-next-line no-new-func
  return new Function(`return (${block[1]});`)();
}

const cityToRiver = leseTabelle('CITY_TO_RIVER');
const entities = geodb.entities;
const flussnamen = new Set(
  Object.values(entities).filter(e => e.type === 'river').map(e => e.name)
);

describe('CITY_TO_RIVER', () => {
  it('ordnet ueberhaupt Staedte zu', () => {
    expect(Object.keys(cityToRiver).length).toBeGreaterThan(0);
  });

  it.each(Object.keys(cityToRiver))('%s gibt es im Bestand', (id) => {
    expect(Object.prototype.hasOwnProperty.call(entities, id)).toBe(true);
  });

  it.each(Object.entries(cityToRiver))(
    '%s nennt mit "%s" einen Fluss aus demselben Bestand',
    (id, fluss) => {
      // Die Distraktoren der Frage sind Namen von Entitaeten mit type "river".
      // Steht die richtige Antwort nicht in derselben Menge, stammt sie aus einem
      // anderen Namensraum als die falschen Optionen.
      expect(flussnamen).toContain(fluss);
    }
  );
});
