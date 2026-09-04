// Undeklarierte Sammler in den Merge-Skripten.
//
// Die Merge-Skripte sammeln Hinweise und Verwuerfe in Arrays (`warnings`,
// `dropped`, …) und schieben sie mit `.push(...)` hinein. In merge_lingua.js und
// merge_natura.js gab es den Hinweiszweig „Name unterscheidet sich nur im
// Klammerzusatz", ohne dass `warnings` dort je deklariert war (Stand 2026-09-04).
// Der Fehler war unsichtbar, weil die aktuelle Ernte den Zweig nicht erreicht —
// die erste Klammer-Kollision haette den Merge mit einem ReferenceError beendet,
// bevor die Rohdaten geschrieben werden.
//
// `node --check` findet das nicht: Ein unbekannter Name ist erst zur Laufzeit ein
// Fehler. Dieser Test prueft deshalb statisch, dass jeder Sammler, in den ein
// Skript hineinschiebt, in derselben Datei auch angelegt wird.

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptsDir = resolve(import.meta.dirname, '../../scripts');
const mergeScripts = readdirSync(scriptsDir)
  .filter(name => /^merge_.*\.js$/.test(name));

/** Alle `x.push(` — nur der einfache Name, kein `a.b.push(`. */
function collectorsPushedInto(quelle) {
  return [...quelle.matchAll(/(?<![\w.$])([A-Za-z_$][\w$]*)\.push\(/g)]
    .map(treffer => treffer[1]);
}

/** Wird der Name als Variable oder als Funktionsparameter angelegt? */
function isDeclared(quelle, name) {
  const alsVariable = new RegExp(String.raw`\b(?:const|let|var)\s[^;\n]*\b${name}\b`);
  const alsParameter = new RegExp(String.raw`\bfunction\b[^(]*\([^)]*\b${name}\b`);
  return alsVariable.test(quelle) || alsParameter.test(quelle);
}

describe('Merge-Skripte', () => {
  it('findet ueberhaupt Merge-Skripte', () => {
    expect(mergeScripts.length).toBeGreaterThanOrEqual(5);
  });

  it.each(mergeScripts)('%s legt jeden Sammler an, in den es schiebt', (name) => {
    const quelle = readFileSync(resolve(scriptsDir, name), 'utf8');
    const fehlend = [...new Set(collectorsPushedInto(quelle))]
      .filter(sammler => !isDeclared(quelle, sammler));
    expect(fehlend, `undeklariert in ${name}`).toEqual([]);
  });
});
