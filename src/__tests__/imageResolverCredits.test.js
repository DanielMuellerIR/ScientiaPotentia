// Gemeinsame Urheber- und Dateinamensregel der Bild-Aufloeser.
//
// Die drei Aufloeser unter scripts/data_sources/harvest/resolve_images*.cjs
// fragen dieselbe Commons-Schnittstelle ab und muessen dieselben Antworten
// gleich auswerten. Zwei Abweichungen fielen am 2026-09-04 auf, beide ohne
// Fehlermeldung: resolve_images_batched.cjs las nur das Feld `Artist` (eine
// freie Datei mit Nachweis allein in `Credit` verschwand still aus dem Mapping),
// und resolve_images_p18_v2.cjs leitete den Commons-Dateititel selbst aus dem
// letzten URL-Segment ab (bei einer Thumbnail-Adresse also "1200px-Foo.jpg").

import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const harvestDir = resolve(import.meta.dirname, '../../scripts/data_sources/harvest');
const { commonsAttribution } =
  require('../../scripts/data_sources/harvest/credit_text.cjs');

/** Reguläre Bild-Auflöser plus der besondere Autorenporträt-Auflöser. */
const bildAufloeser = readdirSync(harvestDir)
  .filter(name => /^resolve_images.*\.cjs$/.test(name));
const attributionAufloeser = [...bildAufloeser, 'resolve_author_portraits.cjs'];

const feld = (value) => ({ value });

afterEach(() => vi.unstubAllGlobals());

describe('commonsAttribution', () => {
  it('findet ueberhaupt Bild-Aufloeser', () => {
    expect(bildAufloeser.length).toBeGreaterThanOrEqual(3);
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

  it('bewahrt auch lange Nachweise samt allen Urhebern vollständig', () => {
    const lang = commonsAttribution({ Artist: feld('Wort '.repeat(80)) });
    expect(lang).toBe('Wort '.repeat(80).trim());
  });
});

describe('Mehrere Urheber in einem Feld', () => {
  // Commons trennt mehrere Personen in `Artist` haeufig mit <br />. Fiel das Tag
  // ersatzlos weg, entstand ein Name, den es nicht gibt — im Bestand steht bei
  // astra:leo-i-zwerggalaxie "Scott AnttilaAnttler" statt "Scott Anttila /
  // Anttler". Bei CC-BY ist ein verklebter Nichtname keine Namensnennung.
  it.each([
    ['Scott Anttila<br />Anttler', 'Scott Anttila / Anttler'],
    ['A<br>B<br/>C', 'A / B / C'],
    ['Nur einer<br />', 'Nur einer'],
    ['<a href="/wiki/User:X">Jane Doe</a>', 'Jane Doe'],
  ])('macht aus %j den Text %j', (roh, erwartet) => {
    expect(commonsAttribution({ Artist: feld(roh) })).toBe(erwartet);
  });

  it('trennt Artist und Credit weiterhin mit demselben Zeichen', () => {
    expect(commonsAttribution({ Artist: feld('Jane'), Credit: feld('ESO') }))
      .toBe('Jane / ESO');
  });
});

describe('Alle Bild-Aufloeser nutzen die gemeinsamen Regeln', () => {
  it.each(attributionAufloeser)('%s liest den Urheber ueber commonsAttribution', (name) => {
    const quelle = readFileSync(resolve(harvestDir, name), 'utf8');
    if (!quelle.includes('extmetadata')) return;   // Aufloeser ohne Lizenzabfrage
    expect(quelle, `${name} greift direkt auf Artist zu`).not.toMatch(/Artist\?\.value/);
    expect(quelle).toContain('commonsAttribution(');
  });

  it('übernimmt beim Autorenporträt Artist, Credit und br-Trenner gemeinsam', () => {
    const { portraitLicenseEntry } = require(
      '../../scripts/data_sources/harvest/resolve_author_portraits.cjs'
    );
    const result = portraitLicenseEntry({
      mime: 'image/jpeg',
      extmetadata: {
        LicenseShortName: feld('CC BY 4.0'),
        Artist: feld('Scott Anttila<br />Anttler'),
        Credit: feld('ESO'),
      },
    });
    expect(result).toEqual({ ok: true, lic: 'CC BY 4.0', art: 'Scott Anttila / Anttler / ESO' });
  });

  it('wiederholt im Autorenporträt-Auflöser einen vorübergehenden Serverfehler', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('vorübergehend', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { getRaw } = require(
      '../../scripts/data_sources/harvest/resolve_author_portraits.cjs'
    );

    const result = await getRaw('https://example.invalid/test', { baseDelayMs: 0 });

    expect(result).toMatchObject({ status: 200, body: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(bildAufloeser)('%s bricht bei einem Nulllauf ab, statt leer zu schreiben', (name) => {
    // Ein Netzausfall sieht aus wie "kein freies Bild gefunden": jede Anfrage
    // liefert null, und ohne Waechter stuende danach ein leeres Mapping ueber
    // einem brauchbaren aus einem frueheren Lauf — mit Exit 0.
    const quelle = readFileSync(resolve(harvestDir, name), 'utf8');
    // Die drei Aufloeser zaehlen unterschiedlich (results, out, G.resolved),
    // gemeinsam ist die Bedingung "nichts gefunden" neben einem Exit-Code.
    expect(quelle, `${name} hat keinen Waechter gegen den Nulllauf`)
      .toMatch(/(?:\w+(?:\.\w+)*)\.?(?:length)? === 0[\s\S]{0,400}?process\.exitCode = 1/);
  });

  it.each(bildAufloeser)('%s schuetzt seinen Namensrueckfall gegen Homonyme', (name) => {
    // Faellt ein Aufloeser auf den blossen Konzeptnamen als de.wikipedia-Lemma
    // zurueck, braucht er die Sperrliste AMBIGUOUS_NAMES: „Charon" fuehrt sonst
    // zum Faehrmann der Unterwelt statt zum Pluto-Mond. Der Bildrechte-Audit
    // faengt das nicht — er prueft Lizenz und Urheber, nicht das Motiv.
    const quelle = readFileSync(resolve(harvestDir, name), 'utf8');
    if (!/dewikiPageimage\(\s*c(?:oncept)?\.name/.test(quelle)) return;
    expect(quelle, `${name} faellt ungeschuetzt auf den Konzeptnamen zurueck`)
      .toContain('AMBIGUOUS_NAMES');
  });

  it.each(bildAufloeser)('%s leitet keinen Dateititel selbst aus der URL ab', (name) => {
    // Nur image_resolution_policy.cjs darf das: dort steht der Thumbnail-Fall.
    const quelle = readFileSync(resolve(harvestDir, name), 'utf8');
    expect(quelle, `${name} zerlegt eine Upload-URL selbst`).not.toMatch(/pathname\s*\.?\s*\.split/);
  });
});
