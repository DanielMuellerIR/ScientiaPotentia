// Regressionstests für die Prüfregeln des Fragen-Audits.
//
// Hintergrund: Der QA-Sweep 2026-07-16 fand 433 Fehlalarme, die den Audit
// praktisch unbrauchbar machten — echte Strukturfehler wären darin untergegangen.
// Diese Tests nageln beide Ursachen fest, damit sie nicht zurückkehren.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { expectsOptions, answerInStem, isUsableOptionValue } from '../../scripts/lib/audit_rules.cjs';
import { dominanceVerdict } from '../../scripts/lib/dominance_policy.cjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const AUDIT = join(ROOT, 'scripts', 'audit_questions.cjs');

function runAudit(...args) {
  return spawnSync(process.execPath, [AUDIT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

describe('expectsOptions', () => {
  // Fehlalarm 1: Alle 427 Terra-click-map-Fragen wurden als "zu wenige
  // Optionen" gemeldet, obwohl der Spieler dort die Karte anklickt.
  it('nimmt click-map von der Optionsprüfung aus', () => {
    expect(expectsOptions('click-map')).toBe(false);
  });

  it('verlangt Optionen bei normalen Multiple-Choice-Typen', () => {
    expect(expectsOptions('capital')).toBe(true);
    expect(expectsOptions('lingua-language-official-countries')).toBe(true);
  });

  it('verlangt Optionen bei unbekanntem oder fehlendem Typ', () => {
    // Konservativ: Ein neuer Typ soll geprüft werden, nicht stillschweigend
    // durchrutschen.
    expect(expectsOptions('irgendein-neuer-typ')).toBe(true);
    expect(expectsOptions(undefined)).toBe(true);
  });
});

describe('answerInStem', () => {
  // Fehlalarm 2: Der Substring-Vergleich fand "Elch" im Fragewort "w-elch-es".
  // Alle 6 Natura-Treffer waren derselbe Artefakt.
  it('meldet kein "Elch" im Fragewort "welches"', () => {
    expect(answerInStem('Welches dieser Tiere wiegt bis zu 800 kg?', 'Elch')).toBe(false);
    expect(answerInStem('Welches dieser Tiere gehört zur Ordnung „Paarhufer“?', 'Elch')).toBe(false);
  });

  it('meldet die Antwort, wenn sie als eigenständiges Wort im Stamm steht', () => {
    expect(answerInStem('Was ist die Hauptstadt von Luxemburg?', 'Luxemburg')).toBe(true);
    expect(answerInStem('In welchem Land liegt die Stadt Santiago de Chile?', 'Chile')).toBe(true);
  });

  it('ignoriert Sub-Wort-Nennungen wie Südafrika → Afrika', () => {
    // Bewusst kein Treffer: akzeptierter Trivialname, ohnehin nicht reparierbar.
    expect(answerInStem('Auf welchem Kontinent liegt Südafrika?', 'Afrika')).toBe(false);
  });

  it('greift trotz Umlauten im Antwortwort', () => {
    // `\b` wäre hier falsch abgebogen, weil es ASCII-basiert ist.
    expect(answerInStem('Welcher Fluss ist die Donau?', 'Donau')).toBe(true);
    expect(answerInStem('Wie viele Länder hat Europa?', 'Länder')).toBe(true);
  });

  it('ignoriert kurze Antworten unter 4 Zeichen', () => {
    // Zu viele Zufallstreffer; Ländercodes wie "FJ" sind ohnehin unkritisch.
    expect(answerInStem('Finde und klicke auf das Land: Fidschi', 'FJ')).toBe(false);
  });

  it('behandelt Anführungszeichen und Groß-/Kleinschreibung gleich', () => {
    expect(answerInStem('Gehört der Vesuv zum Typ „Schichtvulkan“?', 'schichtvulkan')).toBe(true);
  });

  it('verschluckt sich nicht an Regex-Sonderzeichen in der Antwort', () => {
    // Antworten wie "Abjad (nur Konsonanten)" enthalten Klammern.
    expect(answerInStem('Ist das ein Abjad (nur Konsonanten)?', 'Abjad (nur Konsonanten)')).toBe(true);
    expect(answerInStem('Ein ganz anderer Fragetext.', 'Abjad (nur Konsonanten)')).toBe(false);
  });
});

describe('isUsableOptionValue', () => {
  // Nacht-Review 2026-09-02: 99 veröffentlichte Fragen zeigten „undefined" oder
  // „NaN km" als Option, weil der Generator einen fehlenden Rohwert formatiert
  // hatte. Der Audit prüfte damals nur Struktur und meldete null Fehler.
  it('weist formatierte Fehlwerte zurück', () => {
    expect(isUsableOptionValue('undefined')).toBe(false);
    expect(isUsableOptionValue('NaN km')).toBe(false);
    expect(isUsableOptionValue('NaN cm')).toBe(false);
    expect(isUsableOptionValue('Infinity Jahre')).toBe(false);
    expect(isUsableOptionValue(undefined)).toBe(false);
    expect(isUsableOptionValue('   ')).toBe(false);
  });

  it('lässt echte Werte und deutsches „null" durch', () => {
    expect(isUsableOptionValue('1995')).toBe(true);
    expect(isUsableOptionValue('3,5 cm')).toBe(true);
    // Fachtext, in dem „null" ein normales Wort ist — kein Sentinel.
    expect(isUsableOptionValue('Freigabe bei null Verweisen')).toBe(true);
    // Zeichenfolge nur zufällig enthalten.
    expect(isUsableOptionValue('NaNo-Beschichtung')).toBe(true);
    expect(isUsableOptionValue('undefinedX')).toBe(true);
  });
});

describe('dominanceVerdict', () => {
  // Der Audit meldete dominante Fragetypen bisher nur; sie konnten trotzdem
  // veröffentlicht werden. Jetzt braucht jede Dominanz eine Freigabe.
  it('blockiert einen nicht freigegebenen Fragetyp', () => {
    expect(dominanceVerdict('ein-neuer-typ', 55).accepted).toBe(false);
  });

  it('blockiert einen freigegebenen Typ oberhalb seiner Obergrenze', () => {
    const verdict = dominanceVerdict('natura-animal-status', 95);
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain('Obergrenze');
  });

  it('lässt den freigegebenen Typ unterhalb seiner Obergrenze durch', () => {
    const verdict = dominanceVerdict('natura-animal-status', 67.2);
    expect(verdict.accepted).toBe(true);
    expect(verdict.reason).toContain('IUCN');
  });
});

describe('Fragen-Audit als Kommandozeilen-Gate', () => {
  it('prüft bei übergebener Domain nur deren Katalog', () => {
    const result = runAudit('machina');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('=== MACHINA');
    expect(result.stdout).not.toContain('=== ASTRA');
  });

  it('liefert bei harten Fragenfehlern einen Fehler-Exit-Code', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'scientia-question-audit-'));
    try {
      writeFileSync(join(dataDir, 'questions_machina.json'), JSON.stringify([{
        id: 'absichtlich-fehlerhaft',
        type: 'machina-test',
        prompt: 'Welche Antwort ist Alpha?',
        correctAnswer: 'Alpha',
        options: ['Alpha', 'Alpha'],
      }]));

      const result = runAudit('machina', `--data-dir=${dataDir}`);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('Strukturfehler: 1');
      expect(result.stderr).toContain('blockierende Fragenfehler');
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('blockiert Sentinel-Optionen aus einem fehlenden Rohwert', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'scientia-question-audit-sentinel-'));
    try {
      writeFileSync(join(dataDir, 'questions_machina.json'), JSON.stringify([{
        id: 'sentinel-option',
        type: 'machina-test',
        prompt: 'Wie groß ist das Bauteil?',
        correctAnswer: '3 cm',
        options: ['3 cm', 'NaN cm', 'undefined', '5 cm'],
      }]));

      const result = runAudit('machina', `--data-dir=${dataDir}`);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('Sentinel-Optionen: 1');
      expect(result.stderr).toContain('blockierende Fragenfehler');
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('blockiert einen nicht freigegebenen Fragetyp mit dominanter Lösung', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'scientia-question-audit-dominanz-'));
    try {
      // Acht Fragen desselben Typs, sechsmal dieselbe Lösung (75 %).
      const questions = Array.from({ length: 8 }, (_, index) => ({
        id: `dominant-${index}`,
        type: 'machina-dominanz-test',
        prompt: `Frage ${index}?`,
        correctAnswer: index < 6 ? 'Alpha' : `Beta ${index}`,
        options: [index < 6 ? 'Alpha' : `Beta ${index}`, 'Gamma', 'Delta', 'Epsilon'],
      }));
      writeFileSync(join(dataDir, 'questions_machina.json'), JSON.stringify(questions));

      const result = runAudit('machina', `--data-dir=${dataDir}`);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('Strukturfehler: 0');
      expect(result.stderr).toContain('Nicht freigegebene Dominanz');
      expect(result.stderr).toContain('machina-dominanz-test');
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('meldet einen fehlenden angeforderten Katalog als Fehler', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'scientia-question-audit-empty-'));
    try {
      const result = runAudit('machina', `--data-dir=${dataDir}`);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Fragenkatalog fehlt');
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
