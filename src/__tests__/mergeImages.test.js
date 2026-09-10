// Auffrischen der Bildfelder beim wiederholten Merge-Lauf.
//
// Die Merge-Skripte sind ausdruecklich mehrfach lauffaehig: erst mit den
// Konzepten, spaeter erneut mit den aufgeloesten Bildern. Beim zweiten Lauf
// steht im Bestand der nachbereinigte Nachweis, in der Ernte der rohe. Ein
// bedingungsloses Auffrischen macht daraus wieder den rohen Text — bei CC-BY
// ist das eine falsche Namensnennung.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { refreshImageFields } from '../../scripts/lib/merge_images.js';

describe('refreshImageFields', () => {
  it('traegt ein fehlendes Bild samt Lizenz und Urheber nach', () => {
    const bestand = { id: 'a' };
    refreshImageFields(bestand, {
      imageFile: 'Foo.jpg', imageLicense: 'CC BY 4.0', imageAttribution: 'Jane Doe',
    });
    expect(bestand).toMatchObject({
      imageFile: 'Foo.jpg', imageLicense: 'CC BY 4.0', imageAttribution: 'Jane Doe',
    });
  });

  it('nimmt bei einem anderen Bild Lizenz und Urheber zwingend mit', () => {
    // Sonst stuende die Namensnennung des alten Bildes unter dem neuen.
    const bestand = {
      imageFile: 'Alt.jpg', imageLicense: 'CC BY-SA 4.0', imageAttribution: 'Alte Urheberin',
    };
    refreshImageFields(bestand, {
      imageFile: 'Neu.jpg', imageLicense: 'CC0', imageAttribution: 'Neuer Urheber',
    });
    expect(bestand).toEqual({
      imageFile: 'Neu.jpg', imageLicense: 'CC0', imageAttribution: 'Neuer Urheber',
    });
  });

  it('laesst den bereinigten Nachweis derselben Datei unangetastet', () => {
    const bestand = {
      imageFile: 'Foo.jpg',
      imageLicense: 'CC BY 4.0',
      imageAttribution: 'NASA/CXC/Rutgers/J.Warren & J.Hughes et al.',
    };
    const geaendert = refreshImageFields(bestand, {
      imageFile: 'Foo.jpg',
      imageLicense: 'CC BY 4.0',
      imageAttribution: 'NASA/CXC/Rutgers/J.Warren &amp; J.Hughes et al.',
    });
    expect(bestand.imageAttribution).toBe('NASA/CXC/Rutgers/J.Warren & J.Hughes et al.');
    expect(geaendert).toEqual([]);
  });

  it('ergaenzt bei derselben Datei, was im Bestand ganz fehlt', () => {
    const bestand = { imageFile: 'Foo.jpg' };
    refreshImageFields(bestand, {
      imageFile: 'Foo.jpg', imageLicense: 'CC BY 4.0', imageAttribution: 'Jane Doe',
    });
    expect(bestand.imageLicense).toBe('CC BY 4.0');
    expect(bestand.imageAttribution).toBe('Jane Doe');
  });

  it('loescht ein vorhandenes Bild nicht, wenn die Ernte keines liefert', () => {
    const bestand = { imageFile: 'Foo.jpg', imageLicense: 'CC0', imageAttribution: 'Jane Doe' };
    refreshImageFields(bestand, { imageFile: '', imageLicense: '', imageAttribution: '' });
    expect(bestand).toEqual({ imageFile: 'Foo.jpg', imageLicense: 'CC0', imageAttribution: 'Jane Doe' });
  });

  it('reicht _imgProblem durch, auch wenn es zurueckgesetzt wird', () => {
    const bestand = { imageFile: 'Foo.jpg', _imgProblem: 'kein freies Bild' };
    refreshImageFields(bestand, { imageFile: 'Foo.jpg', _imgProblem: null });
    expect(bestand._imgProblem).toBeNull();
  });
});

describe('Astra-Bestand gegen die Erntedateien', () => {
  const root = resolve(import.meta.dirname, '../..');
  const bestand = JSON.parse(
    readFileSync(resolve(root, 'scripts/data_sources/astra_raw.json'), 'utf8')
  );
  const byId = new Map(bestand.map(c => [c.id, c]));

  it.each(['astra_w1.json', 'astra_w1b.json'])(
    'verschlechtert beim erneuten Lauf mit %s keinen Nachweis',
    (datei) => {
      const ernte = JSON.parse(
        readFileSync(resolve(root, 'scripts/data_sources/harvest', datei), 'utf8')
      );
      const verschlechtert = [];
      for (const konzept of Array.isArray(ernte) ? ernte : (ernte.concepts || [])) {
        const vorher = byId.get(konzept.id);
        if (!vorher) continue;
        // Auf einer Kopie rechnen: refreshImageFields aendert sein erstes
        // Argument, und byId teilen sich beide Durchlaeufe dieses it.each.
        const probe = { ...vorher };
        refreshImageFields(probe, konzept);
        for (const feld of ['imageFile', 'imageLicense', 'imageAttribution']) {
          if (vorher[feld] && probe[feld] !== vorher[feld]) {
            verschlechtert.push(`${konzept.id}.${feld}`);
          }
        }
      }
      expect(verschlechtert).toEqual([]);
    }
  );
});
