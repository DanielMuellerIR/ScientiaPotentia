import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchesNameTokenPrefix } from '../utils/tokenSearch';

const geodb = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../data/geodb.json'), 'utf8')
);
const alleEntitaeten = Object.values(geodb.entities);

/** Sucht wie der Atlas: ueber deutschen und englischen Namen. */
function findetNamen(suche) {
  return alleEntitaeten
    .filter(e => matchesNameTokenPrefix(e.name, suche)
      || matchesNameTokenPrefix(e.englishName, suche))
    .map(e => e.name);
}

describe('matchesNameTokenPrefix', () => {
  it('findet nur Wortanfänge statt beliebiger Teilstrings', () => {
    expect(matchesNameTokenPrefix('Eule', 'eule')).toBe(true);
    expect(matchesNameTokenPrefix('Beulenkrokodil', 'eule')).toBe(false);
    expect(matchesNameTokenPrefix('Eule', '---')).toBe(false);
  });

  it('normalisiert Umlaute, ß und mehrere Suchbegriffe', () => {
    expect(matchesNameTokenPrefix('Ägyptische Wüstenspringmaus', 'agypt wusten'))
      .toBe(true);
    expect(matchesNameTokenPrefix('Große Straße', 'grosse strasse')).toBe(true);
  });
});

// Bis zum 2026-09-10 pruefte diese Datei nur erfundene Namen. `.normalize('NFD')`
// trennt aber ausschliesslich Akzente ab, die als eigenes Zeichen kodiert sind —
// „ł", „đ", „ð", „æ", „ø" und „ı" ueberlebten und machten die Stadt
// unauffindbar, waehrend „Gronland" sein Grönland fand und den Eindruck
// erweckte, die Normalisierung sei vollstaendig.
describe('Ortsnamen aus der Geodatenbank', () => {
  it.each([
    ['Lodz', 'Łódź'],
    ['Bialystok', 'Białystok'],
    ['Diyarbakir', 'Diyarbakır'],
    ['Sanliurfa', 'Şanlıurfa'],
    ['Da Nang', 'Đà Nẵng'],
    ['Gardabaer', 'Garðabær'],
    ['Sumqayit', 'Sumqayıt'],
    ['Gronland', 'Grönland'],
  ])('findet mit der Eingabe "%s" den Eintrag "%s"', (suche, name) => {
    expect(findetNamen(suche)).toContain(name);
  });

  it('bleibt bei Wortanfaengen: „burg" findet kein Hamburg', () => {
    expect(findetNamen('burg')).not.toContain('Hamburg');
  });
});
