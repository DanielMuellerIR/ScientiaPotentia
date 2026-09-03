// Aufrufvertrag der Struktur- und Provenance-Pruefung (scripts/verify_facts.js).
//
// CodeQA 2026-09-03: `npm run verify:facts -- terra` endete mit einem rohen
// ENOENT-Stacktrace, weil Terra seine Konzepte nicht aus
// public/data/concepts_terra.json bezieht, sondern aus der gebuendelten
// src/data/geodb.json. Ein getippter Bereichsname lief in denselben Absturz.
// Beides ist jetzt ein sauberer Pfad — diese Tests halten das fest.

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'scripts', 'verify_facts.js');

function runVerify(domain) {
  return spawnSync(process.execPath, [SCRIPT, domain], { cwd: ROOT, encoding: 'utf8' });
}

describe('verify_facts', () => {
  it('prueft Terra gegen die gebuendelte Geodb statt gegen eine Konzeptdatei', () => {
    const result = runVerify('terra');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Kartenobjekte:');
    // Die Geodb traegt ihre Herkunft zentral, nicht je Eintrag. Ohne diese
    // Ausnahme meldete die Quellenpflicht 1.852 Scheinfehler.
    expect(result.stdout).toContain('Quellenpflicht je Eintrag entfaellt');
    expect(result.stdout).toContain('Fehler: 0');
  });

  it('meldet Terras Kartenfragen nicht als Strukturfehler', () => {
    // 427 click-map-Fragen haben legitim `options: []`; der Spieler klickt das
    // Ziel auf der Karte an. Dieselbe Regel nutzt das Fragen-Audit.
    const result = runVerify('terra');
    expect(result.stdout).not.toContain('weniger als 2 Optionen');
  });

  it('bleibt fuer einen Bereich mit eigener Konzeptdatei unveraendert', () => {
    const result = runVerify('astra');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Konzepte:');
    expect(result.stdout).toContain('Struktur- und Provenance-Pruefung bestanden.');
  });

  it('nennt bei unbekanntem Bereich die moeglichen Namen statt abzustuerzen', () => {
    const result = runVerify('quatschbereich');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Unbekannter Bereich: quatschbereich');
    expect(result.stderr).toContain('terra');
    expect(result.stderr).not.toContain('ENOENT');
  });
});
