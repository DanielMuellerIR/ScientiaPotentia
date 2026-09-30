import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { needsAttributionRepair, repairedAttribution } from '../../scripts/data_sources/harvest/repair_truncated_attribution.mjs';
const require = createRequire(import.meta.url);
const { wikipediaSource, wikidataId, sourceForConcept, resolveSourceImages } = require('../../scripts/data_sources/harvest/wikipedia_image_sources.cjs');
const { createCommonsLookup } = require('../../scripts/data_sources/harvest/commons_image_candidates.cjs');
const upload = file => `https://upload.wikimedia.org/wikipedia/commons/a/ab/${file}`;
const claim = (file, rank = 'normal') => ({ rank, mainsnak: { datavalue: { value: file } } });

function fixture(responses) {
  const calls = [];
  return { calls, get: async value => {
    const url = new URL(value); calls.push(url);
    const response = responses.shift();
    if (!response) throw new Error('Unerwartete Abfrage: ' + url);
    return response;
  } };
}

describe('Belegte Wikipedia-Quellen', () => {
  it('liest Sprache, Umlaute und Titel ohne Fragment oder Query', () => {
    expect(wikipediaSource('https://fr.wikipedia.org/wiki/%C3%89criture?oldid=1#Histoire'))
      .toEqual({ language: 'fr', title: 'Écriture' });
    expect(wikipediaSource('https://en.wikipedia.org.evil.test/wiki/Foo')).toBeNull();
    expect(wikidataId('https://evil.test/wiki/Q42')).toBeNull();
    expect(wikidataId('https://www.wikidata.org/wiki/Q42#x')).toBe('Q42');
  });
  it('bewahrt die fremdsprachige Quelle und rät Astra-Lemmata nicht', () => {
    expect(sourceForConcept({ id: 'x', name: 'Geratener Name', sourceUrl: 'https://en.wikipedia.org/wiki/Crescent_Nebula' }, 'astra'))
      .toEqual({ language: 'en', title: 'Crescent Nebula' });
    expect(sourceForConcept({ id: 'io', name: 'Io' }, 'astra')).toEqual({ language: 'de', title: 'Io (Mond)' });
    expect(sourceForConcept({ id: 'unknown', name: 'WISE' }, 'astra')).toBeNull();
  });
  it('verknüpft englische Quellen über wikibase_item mit bevorzugtem P18', async () => {
    const f = fixture([
      { query: { normalized: [{ from: 'Old title', to: 'Old Title' }], redirects: [{ from: 'Old Title', to: 'Article' }], pages: { 1: { title: 'Article', pageprops: { wikibase_item: 'Q42' }, original: { source: upload('Article.jpg') } } } } },
      { entities: { Q42: { claims: { P18: [claim('Other.jpg'), claim('Preferred.jpg', 'preferred')] } } } },
    ]);
    expect([...await resolveSourceImages([{ id: 'x', sourceUrl: 'https://en.wikipedia.org/wiki/Old_title' }], 'lingua', f.get)])
      .toEqual([['x', 'Preferred.jpg']]);
    expect(f.calls[0].hostname).toBe('en.wikipedia.org');
    expect(f.calls[1].searchParams.get('ids')).toBe('Q42');
  });
  it('nutzt belegte de-langlinks statt übersetztem Namen', async () => {
    const f = fixture([
      { query: { pages: { 1: { title: 'Article', langlinks: [{ lang: 'de', '*': 'Belegtes Lemma' }] } } } },
      { query: { pages: { 2: { title: 'Belegtes Lemma', original: { source: upload('Linked.jpg') } } } } },
    ]);
    expect([...await resolveSourceImages([{ id: 'x', name: 'Falsch', sourceUrl: 'https://fr.wikipedia.org/wiki/Article' }], 'lingua', f.get)])
      .toEqual([['x', 'Linked.jpg']]);
    expect(f.calls[1].searchParams.get('titles')).toBe('Belegtes Lemma');
  });
  it('verwendet lokale Wikipedia-Uploads nicht als Commons-Dateititel', async () => {
    const f = fixture([{ query: { pages: { 1: { title: 'Article', original: { source: 'https://upload.wikimedia.org/wikipedia/en/a/ab/Local.jpg' } } } } }]);
    expect([...await resolveSourceImages([{ id: 'x', sourceUrl: 'https://en.wikipedia.org/wiki/Article' }], 'astra', f.get)]).toEqual([]);
  });
  it('verwirft Begriffsklärungen trotz Artikelbild und Wikidata-ID', async () => {
    const f = fixture([{ query: { pages: { 1: { title: 'Mercury', pageprops: { disambiguation: '', wikibase_item: 'Q42' }, original: { source: upload('Wrong.jpg') } } } } }]);
    expect([...await resolveSourceImages([{ id: 'x', sourceUrl: 'https://en.wikipedia.org/wiki/Mercury' }], 'astra', f.get)]).toEqual([]);
    expect(f.calls).toHaveLength(1);
  });
  it('prüft Commons vor der Auswahl und fällt von unfreiem P18 auf das belegte Artikelbild zurück', async () => {
    const metadata = license => ({ LicenseShortName: { value: license }, Artist: { value: 'Jane Doe' } });
    const f = fixture([
      { query: { pages: { 1: { title: 'Article', pageprops: { wikibase_item: 'Q42' }, original: { source: upload('Article.jpg') } } } } },
      { entities: { Q42: { claims: { P18: [claim('Blocked.jpg')] } } } },
      { query: { pages: {
        1: { title: 'File:Blocked.jpg', imageinfo: [{ mime: 'image/jpeg', extmetadata: metadata('CC BY-NC 4.0') }] },
        2: { title: 'File:Article.jpg', imageinfo: [{ mime: 'image/jpeg', extmetadata: metadata('CC BY 4.0') }] },
      } } },
    ]);
    const commons = createCommonsLookup(f.get);
    const images = await resolveSourceImages([{ id: 'x', sourceUrl: 'https://en.wikipedia.org/wiki/Article' }], 'astra', f.get, commons.acceptFiles);
    expect([...images]).toEqual([['x', 'Article.jpg']]);
    expect(commons.get('Article.jpg')).toMatchObject({ imageLicense: 'CC BY 4.0', imageAttribution: 'Jane Doe' });
    expect(commons.get('Blocked.jpg')).toBeNull();
    await commons.acceptFiles(['Article.jpg']);
    expect(f.calls).toHaveLength(3);
  });
  it('verwirft Commons-Dateien ohne MIME, ohne Nachweis oder ohne freie Lizenz', async () => {
    const f = fixture([{ query: { pages: {
      1: { title: 'File:Missing.jpg', missing: '' },
      2: { title: 'File:Unknown.jpg', imageinfo: [{ mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'Unknown author' } } }] },
      3: { title: 'File:Document.pdf', imageinfo: [{ mime: 'application/pdf', extmetadata: { LicenseShortName: { value: 'Public domain' } } }] },
    } } }]);
    expect([...await createCommonsLookup(f.get).acceptFiles(['Missing.jpg', 'Unknown.jpg', 'Document.pdf'])]).toEqual([]);
  });
  it('verwirft sprachübergreifende QID-Kollisionen', async () => {
    const f = fixture([
      { query: { pages: { 1: { title: 'Article', pageprops: { wikibase_item: 'Q42' } } } } },
      { query: { pages: { 1: { title: 'Artikel', pageprops: { wikibase_item: 'Q42' } } } } },
      { entities: { Q42: { claims: { P18: [claim('Shared.jpg')] } } } },
    ]);
    expect([...await resolveSourceImages([
      { id: 'a', sourceUrl: 'https://en.wikipedia.org/wiki/Article' },
      { id: 'b', sourceUrl: 'https://de.wikipedia.org/wiki/Artikel' },
    ], 'lingua', f.get)]).toEqual([]);
  });
});

describe('Gezielte Reparatur bestehender Nachweise', () => {
  const concept = { id: 'test', imageFile: 'https://commons.wikimedia.org/wiki/File:Example.jpg', imageLicense: 'CC BY 4.0', imageAttribution: 'x'.repeat(200) };
  const page = artist => ({ imageinfo: [{ mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: artist } } }] });
  it('bewahrt sämtliche Urheber auch oberhalb der früheren Grenze', () => {
    const artist = 'Erster Urheber / '.repeat(25) + 'Letzter Urheber';
    expect(needsAttributionRepair(concept)).toBe(true);
    expect(repairedAttribution(concept, page(artist))).toBe(artist);
    expect(needsAttributionRepair({ ...concept, imageAttribution: 'Guter Nachweis' })).toBe(false);
    expect(needsAttributionRepair({ ...concept, imageAttribution: 'x'.repeat(199) + '…' })).toBe(false);
  });
  it('stoppt bei fehlenden Dateien, Lizenzwechsel und generischem Urheber', () => {
    expect(() => repairedAttribution(concept, { missing: '' })).toThrow();
    const changed = page('Jane'); changed.imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY-SA 4.0';
    expect(() => repairedAttribution(concept, changed)).toThrow('Lizenzwechsel');
    expect(() => repairedAttribution(concept, page('Unknown author'))).toThrow('belastbarer Nachweis');
    const blocked = page('Jane'); blocked.imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY-NC 4.0';
    expect(() => repairedAttribution(concept, blocked)).toThrow('nicht frei');
  });
});
