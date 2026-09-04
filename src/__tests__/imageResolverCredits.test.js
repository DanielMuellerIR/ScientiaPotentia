// Gemeinsame Urheber- und Dateinamensregel der Bild-Aufloeser.
//
// Die vier Aufloeser unter scripts/data_sources/harvest/resolve_images*.cjs
// fragen dieselbe Commons-Schnittstelle ab und muessen dieselben Antworten
// gleich auswerten. Zwei Abweichungen fielen am 2026-09-04 auf, beide ohne
// Fehlermeldung: resolve_images_batched.cjs las nur das Feld `Artist` (eine
// freie Datei mit Nachweis allein in `Credit` verschwand still aus dem Mapping),
// und resolve_images_p18_v2.cjs leitete den Commons-Dateititel selbst aus dem
// letzten URL-Segment ab (bei einer Thumbnail-Adresse also "1200px-Foo.jpg").

import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const harvestDir = resolve(import.meta.dirname, '../../scripts/data_sources/harvest');
const { commonsAttribution, MAX_CREDIT_LENGTH } =
  require('../../scripts/data_sources/harvest/credit_text.cjs');

/** Alle Bild-Aufloeser; resolve_author_portraits.cjs hat bewusst eine eigene Regel. */
const bildAufloeser = readdirSync(harvestDir)
  .filter(name => /^resolve_images.*\.cjs$/.test(name));

const feld = (value) => ({ value });

describe('commonsAttribution', () => {
  it('findet ueberhaupt Bild-Aufloeser', () => {
    expect(bildAufloeser.length).toBeGreaterThanOrEqual(4);
  });

  it('nimmt den Nachweis auch dann, wenn er nur in Credit steht', () => {
    // Genau dieser Fall ging im gebuendelten Lauf verloren: Lizenz akzeptiert
    // ("Public domain"), Urhebertext leer, Eintrag danach still verworfen.
    expect(commonsAttribution({
      LicenseShortName: feld('Public domain'),
      Credit: feld('Rijksmuseum Amsterdam'),
    })).toBe('Rijksmuseum Amsterdam');
  });

  it('nennt Urheber und Quelle, wenn Commons beide fuehrt', () => {
    expect(commonsAttribution({
      Artist: feld('<a href="/wiki/User:Foo">Foo</a>'),
      Credit: feld('Eigenes Werk'),
    })).toBe('Foo / Eigenes Werk');
  });

  it('kommt mit nur einem Feld und mit gar keinem zurecht', () => {
    expect(commonsAttribution({ Artist: feld('Jan Vermeer') })).toBe('Jan Vermeer');
    expect(commonsAttribution({})).toBe('');
    expect(commonsAttribution(undefined)).toBe('');
  });

  it('entfernt HTML und mehrzeiligen Whitespace', () => {
    expect(commonsAttribution({
      Artist: feld('<span class="x">NASA</span>\n  /  JPL'),
    })).toBe('NASA / JPL');
  });

  it('kuerzt einen ueberlangen Nachweis an der Wortgrenze', () => {
    const lang = commonsAttribution({ Artist: feld('Wort '.repeat(80)) });
    expect(lang.length).toBeLessThanOrEqual(MAX_CREDIT_LENGTH);
    expect(lang.endsWith(' …')).toBe(true);
  });
});

describe('Alle Bild-Aufloeser nutzen die gemeinsamen Regeln', () => {
  it.each(bildAufloeser)('%s liest den Urheber ueber commonsAttribution', (name) => {
    const quelle = readFileSync(resolve(harvestDir, name), 'utf8');
    if (!quelle.includes('extmetadata')) return;   // Aufloeser ohne Lizenzabfrage
    expect(quelle, `${name} greift direkt auf Artist zu`).not.toMatch(/Artist\?\.value/);
    expect(quelle).toContain('commonsAttribution(');
  });

  it.each(bildAufloeser)('%s leitet keinen Dateititel selbst aus der URL ab', (name) => {
    // Nur image_resolution_policy.cjs darf das: dort steht der Thumbnail-Fall.
    const quelle = readFileSync(resolve(harvestDir, name), 'utf8');
    expect(quelle, `${name} zerlegt eine Upload-URL selbst`).not.toMatch(/pathname\s*\.?\s*\.split/);
  });
});
