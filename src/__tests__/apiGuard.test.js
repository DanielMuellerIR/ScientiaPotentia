// Der Wächter gegen den stillen Nulllauf: Ein Auflöser soll abbrechen, wenn die
// API ihn dauerhaft abweist, statt stundenlang „kein freies Bild" zu schreiben.
// Real eingetreten am 2026-09-03: resolve_images_p18.cjs lief zehn Minuten
// durch 60 Konzepte ohne einen einzigen Treffer und ohne Warnung.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  createApiGuard, DEFAULT_LIMIT,
} = require('../../scripts/data_sources/harvest/api_guard.cjs');

describe('Abbruch bei dauerhafter Abweisung', () => {
  it('bricht ab, sobald die Schwelle erreicht ist', () => {
    const guard = createApiGuard({ limit: 3, label: 'Testgegenstelle' });
    guard.rejected('erste');
    guard.rejected('zweite');
    expect(() => guard.rejected('dritte')).toThrow(/3 Anfragen in Folge abgewiesen/);
  });

  it('nennt die Gegenstelle und den letzten Grund', () => {
    const guard = createApiGuard({ limit: 1, label: 'Die Commons-API' });
    expect(() => guard.rejected('HTTP 503')).toThrow(/Die Commons-API.*HTTP 503/s);
  });

  it('setzt die Zählung nach einer beantworteten Anfrage zurück', () => {
    const guard = createApiGuard({ limit: 3 });
    guard.rejected();
    guard.rejected();
    guard.ok();
    expect(guard.consecutive).toBe(0);
    // Nach dem Rücksetzen reichen zwei Abweisungen nicht mehr für den Abbruch.
    expect(() => { guard.rejected(); guard.rejected(); }).not.toThrow();
  });

  it('zählt Abweisungen insgesamt weiter, auch über ein Rücksetzen hinweg', () => {
    const guard = createApiGuard({ limit: 10 });
    guard.rejected();
    guard.ok();
    guard.rejected();
    expect(guard.total).toBe(2);
    expect(guard.consecutive).toBe(1);
  });

  it('hält eine Schwelle bereit, die einen echten Lauf nicht stört', () => {
    // 20 Abweisungen in Folge sind keine Datenlage mehr, sondern eine Störung.
    expect(DEFAULT_LIMIT).toBeGreaterThanOrEqual(10);
    const guard = createApiGuard();
    for (let i = 0; i < DEFAULT_LIMIT - 1; i += 1) guard.rejected();
    expect(() => guard.rejected()).toThrow();
  });
});

describe('Auflöser hängen den Wächter ein', () => {
  const dateien = [
    'resolve_images.cjs',
    'resolve_images_p18_v2.cjs',
    'resolve_images_batched.cjs',
    'resolve_author_portraits.cjs',
  ];

  it.each(dateien)('%s zählt abgewiesene Anfragen', async (datei) => {
    const { readFile } = await import('node:fs/promises');
    const quelle = await readFile(`scripts/data_sources/harvest/${datei}`, 'utf8');
    expect(quelle).toContain('createApiGuard');
    if (quelle.includes('fetchWikiJson')) {
      expect(quelle).toMatch(/fetchWikiJson\(url, \{ apiGuard \}\)/);
    } else {
      expect(quelle).toMatch(/apiGuard\.rejected\(/);
      expect(quelle).toMatch(/apiGuard\.ok\(\)/);
    }
  });
});
