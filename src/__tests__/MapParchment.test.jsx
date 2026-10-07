import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import maplibregl from 'maplibre-gl';
import { expression } from '@maplibre/maplibre-gl-style-spec';
import Atlas from '../components/Atlas';
import Map, { getBoundingBox, boundedMapPadding } from '../components/Map';
import { useGeoData } from '../utils/useGeoData';
import { DATA_MAP_META_NAME, resetDataUrlCache } from '../utils/dataUrl';

const stylePath = resolve(process.cwd(), 'public/map_styles/scientia_parchment.json');
const parchmentStyle = JSON.parse(readFileSync(stylePath, 'utf8'));
const geodbPath = resolve(process.cwd(), 'src/data/geodb.json');
const geodb = JSON.parse(readFileSync(geodbPath, 'utf8'));
const germanName = ['coalesce', ['get', 'name:de'], ['get', 'name']];

function lastPaintValue(map, layer, property) {
  return map.setPaintProperty.mock.calls
    .filter(([candidateLayer, candidateProperty]) => (
      candidateLayer === layer && candidateProperty === property
    ))
    .at(-1)?.[2];
}

function GeoProbe({ keys }) {
  const data = useGeoData(keys);
  return <output>{JSON.stringify(data)}</output>;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lokaler Terra-Pergamentstil', () => {
  it('ist eine dokumentierte MapLibre-v8-Fork mit weiter remote geladenen Kartendaten', () => {
    expect(parchmentStyle.version).toBe(8);
    expect(parchmentStyle.layers.length).toBeGreaterThanOrEqual(55);
    expect(parchmentStyle.metadata['scientia:source']).toContain('OpenFreeMap');
    expect(parchmentStyle.metadata['scientia:source']).toContain('BSD 3-Clause');
    expect(parchmentStyle.metadata['scientia:source']).toContain('CC BY 4.0');
    expect(parchmentStyle.metadata['scientia:remote-dependencies']).toContain('tiles.openfreemap.org');

    // Die lokale JSON-Datei bestimmt nur die Darstellung. Große Kartendaten bleiben
    // beim ursprünglichen Anbieter, damit keine unvollständige Offline-Kopie entsteht.
    expect(parchmentStyle.sources.openmaptiles.url).toBe('https://tiles.openfreemap.org/planet');
    expect(parchmentStyle.sources.openmaptiles.attribution).toContain('OpenStreetMap contributors');
    expect(parchmentStyle.sources.openmaptiles.attribution).toContain('OpenMapTiles');
    expect(parchmentStyle.sources.ne2_shaded.attribution).toContain('Natural Earth');
    expect(parchmentStyle.sources.ne2_shaded.tiles[0]).toContain('tiles.openfreemap.org');
    expect(parchmentStyle.glyphs).toContain('tiles.openfreemap.org');
    expect(parchmentStyle.sprite).toContain('tiles.openfreemap.org');
  });

  it('bevorzugt deutsche Namen, ohne Straßenschilder in Namen umzuwandeln', () => {
    const textLayers = parchmentStyle.layers.filter(
      (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
    );
    const roadShields = textLayers.filter((layer) => layer.id.includes('shield'));
    const languageLabels = textLayers.filter((layer) => !layer.id.includes('shield'));

    expect(languageLabels).not.toHaveLength(0);
    languageLabels.forEach((layer) => {
      expect(layer.layout['text-field']).toEqual(germanName);
    });
    roadShields.forEach((layer) => {
      expect(layer.layout['text-field']).toEqual(['to-string', ['get', 'ref']]);
    });
  });

  it('enthält die Pergamentpalette, kursiv gesetzte Wasserlabels und lesbare Länderlabels', () => {
    const layer = (id) => parchmentStyle.layers.find((candidate) => candidate.id === id);

    expect(layer('background').paint['background-color']).toBe('#E3DFD5');
    expect(layer('water').paint['fill-color']).toBe('#A9BBB5');
    expect(layer('boundary_2').paint['line-color']).toBe('#8B6F3B');
    expect(layer('label_country_1').paint['text-color']).toBe('#1B305B');

    ['waterway_line_label', 'water_name_point_label', 'water_name_line_label'].forEach((id) => {
      expect(layer(id).layout['text-font']).toEqual(['Noto Sans Italic']);
      expect(layer(id).paint['text-halo-width']).toBeGreaterThanOrEqual(1.5);
    });
    ['label_country_1', 'label_country_2', 'label_country_3'].forEach((id) => {
      expect(layer(id).layout['text-font']).toEqual(['Noto Sans Bold']);
      expect(layer(id).paint['text-halo-width']).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('Terra-Kartenwerkzeuge', () => {
  it('hält die Oberfläche ohne WebGL nutzbar und meldet fehlende Kartenfähigkeit', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const availability = vi.fn();
    maplibregl.Map.mockImplementationOnce(function () { throw new Error('WebGL 2 unavailable'); });
    render(<Map onAvailabilityChange={availability} />);
    expect(screen.getByRole('status')).toHaveTextContent('Karte nicht verfügbar');
    expect(availability).toHaveBeenCalledWith(false);
    warn.mockRestore();
  });
  it('lässt im niedrigen Mobilpanel trotz hoher Wunschpolsterung eine sichtbare Karte', () => {
    const padding = boundedMapPadding({ clientWidth: 350, clientHeight: 180 }, 180);
    expect(180 - 2 * padding).toBeGreaterThan(100);
    expect(boundedMapPadding({ clientWidth: 1000, clientHeight: 900 }, 80)).toBe(80);
  });
  it('ergänzt oberhalb der Flusslinie eine lesbare Beschriftung aus dem geprüften Namen', async () => {
    render(<Map mode="atlas" onSelectEntity={vi.fn()} />);

    const map = maplibregl.Map.mock.instances[0];
    await waitFor(() => {
      const labelCall = map.addLayer.mock.calls.find(([layer]) => layer.id === 'rivers-label');
      expect(labelCall).toBeDefined();
      expect(labelCall).toHaveLength(1);

      const [riverLabel] = labelCall;
      expect(riverLabel).toMatchObject({
        id: 'rivers-label',
        type: 'symbol',
        source: 'rivers',
        minzoom: 2,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-offset': [0, -0.8],
          'text-keep-upright': true,
          'text-max-angle': 180
        },
        paint: {
          'text-color': '#1B305B',
          'text-halo-color': '#E3DFD5',
          'text-halo-width': 1.5
        }
      });
    });
  });

  it('holt die Geometriequellen unter dem gehashten Namen des Produktionsbaus', async () => {
    // Der Produktionsbau benennt jede Datei in dist/data mit ihrem Inhaltshash um;
    // "data/countries.json" existiert dort nicht mehr. Stand 2026-09-04 standen die
    // drei MapLibre-Quellen noch auf dem Klarnamen — die Karte forderte im Release
    // drei nicht vorhandene Adressen an und blieb ohne Laender, Regionen und Fluesse.
    const meta = document.createElement('meta');
    meta.setAttribute('name', DATA_MAP_META_NAME);
    meta.setAttribute('content', JSON.stringify({
      'countries.json': 'countries.609e0f8b.json',
      'subdivisions.json': 'subdivisions.77ea4a54.json',
      'rivers.json': 'rivers.fbc7c119.json'
    }));
    document.head.appendChild(meta);
    resetDataUrlCache();

    try {
      render(<Map mode="atlas" onSelectEntity={vi.fn()} />);
      const map = maplibregl.Map.mock.instances[0];

      await waitFor(() => {
        expect(map.addSource).toHaveBeenCalledWith('countries', expect.objectContaining({
          data: 'data/countries.609e0f8b.json'
        }));
      });
      expect(map.addSource).toHaveBeenCalledWith('subdivisions', expect.objectContaining({
        data: 'data/subdivisions.77ea4a54.json'
      }));
      expect(map.addSource).toHaveBeenCalledWith('rivers', expect.objectContaining({
        data: 'data/rivers.fbc7c119.json'
      }));
      // Auch der Hook fuer die Bounding-Boxen muss den gehashten Namen anfordern.
      expect(global.fetch).toHaveBeenCalledWith('data/countries.609e0f8b.json');
    } finally {
      meta.remove();
      resetDataUrlCache();
    }
  });

  it('lädt den lokalen Stil und schaltet Navigation und Maßstab gemeinsam', async () => {
    render(<Map mode="atlas" onSelectEntity={vi.fn()} />);

    expect(maplibregl.Map).toHaveBeenCalledWith(expect.objectContaining({
      style: expect.stringMatching(/map_styles\/scientia_parchment\.json$/),
      attributionControl: true
    }));
    expect(maplibregl.NavigationControl).toHaveBeenCalledWith({ showCompass: true, showZoom: false });
    expect(maplibregl.ScaleControl).toHaveBeenCalledWith({ maxWidth: 76, unit: 'metric' });

    const map = maplibregl.Map.mock.instances[0];
    expect(map.addControl).toHaveBeenCalledWith(expect.anything(), 'top-right');
    expect(map.addControl).toHaveBeenCalledWith(expect.anything(), 'bottom-right');

    const toggle = await screen.findByRole('button', { name: 'Kartenwerkzeuge ausblenden' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('title', 'Kartenwerkzeuge ausblenden');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kartenwerkzeuge einblenden' }))
        .toHaveAttribute('aria-pressed', 'false');
    });
    expect(screen.getByRole('button', { name: 'Kartenwerkzeuge einblenden' }))
      .toHaveAttribute('title', 'Kartenwerkzeuge einblenden');
    expect(document.querySelector('.terra-map')).toHaveClass('terra-map-controls-hidden');
  });

  it('aktualisiert Provinzgrenzen beim Zoomen und setzt sie nach einer Provinzfrage zurück', async () => {
    const { rerender } = render(<Map mode="atlas" onSelectEntity={vi.fn()} />);
    const map = maplibregl.Map.mock.instances[0];
    await waitFor(() => expect(map.setPaintProperty).toHaveBeenCalled());

    const zoomEnd = map.on.mock.calls.find(([event]) => event === 'zoomend')?.[1];
    expect(zoomEnd).toBeTypeOf('function');
    map.getZoom.mockReturnValue(4);
    act(() => zoomEnd());

    await waitFor(() => {
      expect(lastPaintValue(map, 'subdivisions-borders', 'line-opacity')).toBe(0.6);
      expect(lastPaintValue(map, 'subdivisions-fill', 'fill-opacity')).toBe(0.35);
    });

    rerender(<Map mode="quiz" showSubdivisions onSelectEntity={vi.fn()} />);
    await waitFor(() => {
      expect(lastPaintValue(map, 'subdivisions-borders', 'line-opacity')).toBe(0.8);
      expect(lastPaintValue(map, 'subdivisions-fill', 'fill-opacity')).toBe(0.8);
    });

    rerender(<Map mode="quiz" showSubdivisions={false} onSelectEntity={vi.fn()} />);
    await waitFor(() => {
      expect(lastPaintValue(map, 'subdivisions-borders', 'line-opacity')).toBe(0);
      expect(lastPaintValue(map, 'subdivisions-fill', 'fill-opacity')).toBe(0);
    });
  });

  it('behält gültige Flächenfarben nach wiederholten Fehlklicks und überlappenden Hinweisen', async () => {
    render(<Map mode="quiz" correctIds={['FR', 'FR']} wrongIds={['DE', 'DE', 'FR']}
      highlightedIds={['DE', 'FR', 'IT', 'IT']} onSelectEntity={vi.fn()} />);
    const map = maplibregl.Map.mock.instances[0];
    await waitFor(() => {
      expect(lastPaintValue(map, 'countries-fill', 'fill-color')).toEqual([
        'match', ['get', 'id'], 'FR', '#2C5E43', 'DE', '#842029', 'IT', '#B58900', '#E3DFD5',
      ]);
    });
    const compiled = expression.createExpression(
      lastPaintValue(map, 'countries-fill', 'fill-color'), 'layers[0].paint.fill-color');
    expect(compiled.result).toBe('success');
    expect(compiled.value.evaluate({}, { properties: { id: 'FR' } })).toBe('#2C5E43');
    expect(compiled.value.evaluate({}, { properties: { id: 'DE' } })).toBe('#842029');
  });

  it('färbt einen richtig beantworteten Fluss passend zur Legende grün', async () => {
    render(
      <Map
        mode="quiz"
        correctIds={['river_seine']}
        zoomToEntityId="river_seine"
        onSelectEntity={vi.fn()}
      />
    );
    const map = maplibregl.Map.mock.instances[0];

    await waitFor(() => {
      expect(lastPaintValue(map, 'rivers-line', 'line-color')).toEqual([
        'case',
        ['==', ['get', 'id'], 'river_seine'],
        '#2C5E43',
        'transparent'
      ]);
    });
  });
});

describe('Atlas-Suche', () => {
  it('setzt einen Länder-Untertab beim Wechsel zu einer Stadt zurück', () => {
    const selected = geodb.entities.DE;
    const next = Object.values(geodb.entities).find(entity => entity.type === 'city');
    const props = { geodb, onSelectEntity: vi.fn() };
    const { rerender } = render(<Atlas {...props} selectedEntity={selected} />);
    fireEvent.click(screen.getByRole('button', { name: 'Städte', exact: true }));
    expect(screen.getByRole('button', { name: 'Städte', exact: true })).toHaveAttribute('aria-pressed', 'true');
    rerender(<Atlas {...props} selectedEntity={next} />);
    expect(screen.getByRole('button', { name: 'Übersicht', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
  it('hält Gegenwarts- und Tagespolitik aus Datenbestand und Detailansicht heraus', () => {
    Object.values(geodb.entities).forEach((entity) => {
      expect(entity.metadata).not.toHaveProperty('headOfState');
      expect(entity.metadata).not.toHaveProperty('headOfGov');
      expect(entity.facts || []).not.toEqual(expect.arrayContaining([
        expect.stringMatching(/Staatsoberhaupt|Regierungsgeschäfte/),
      ]));
    });

    render(
      <Atlas
        geodb={{
          entities: {
            DE: {
              id: 'DE',
              type: 'country',
              name: 'Deutschland',
              metadata: { capital: 'Berlin', headOfState: 'Darf nicht erscheinen' },
            },
          },
        }}
        onSelectEntity={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Atlas durchsuchen' }), {
      target: { value: 'Deutschland' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Deutschland.*Staat/ }));
    expect(screen.queryByText('Staatsoberhaupt:')).not.toBeInTheDocument();
    expect(screen.queryByText('Regierungschef:')).not.toBeInTheDocument();
    expect(screen.queryByText('Darf nicht erscheinen')).not.toBeInTheDocument();
  });

  it('findet Umlaute ohne Sondertastatur und bietet ein echtes Tastaturziel an', () => {
    const onSelectEntity = vi.fn();
    render(
      <Atlas
        geodb={{
          entities: {
            EG: { id: 'EG', type: 'country', name: 'Ägypten', metadata: { flag: '🇪🇬' } },
            DE: { id: 'DE', type: 'country', name: 'Deutschland' },
          },
        }}
        onSelectEntity={onSelectEntity}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Atlas durchsuchen' }), {
      target: { value: 'agypt' },
    });
    const result = screen.getByRole('button', { name: /Ägypten.*Staat/ });
    result.focus();
    expect(result).toHaveFocus();
    fireEvent.keyDown(result, { key: 'Enter' });
    fireEvent.click(result);
    expect(onSelectEntity).toHaveBeenCalledWith('EG');
  });
});

describe('Reihenfolge der Suchvorschlaege', () => {
  it('zeigt Namenstreffer vor Eintraegen, die nur ueber ihre Kennung passen', () => {
    // Die Kennungen tragen ihre Gattung im Praefix. Eine Eingabe wie „city"
    // passte damit auf jede Stadt und verdraengte die wenigen Eintraege, die das
    // Wort wirklich im Namen fuehren, aus den fuenf Vorschlaegen.
    const entities = {};
    for (let nummer = 0; nummer < 8; nummer += 1) {
      entities[`city_XX_ort${nummer}`] = {
        id: `city_XX_ort${nummer}`, type: 'city', name: `Ort ${nummer}`,
      };
    }
    entities.city_MX_city_juarez = {
      id: 'city_MX_city_juarez', type: 'city', name: 'City Juárez',
    };

    render(<Atlas geodb={{ entities }} onSelectEntity={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Atlas durchsuchen' }), {
      target: { value: 'city' },
    });

    expect(screen.getByRole('button', { name: /City Juárez/ })).toBeInTheDocument();
  });
});

describe('Umschliessendes Rechteck', () => {
  // Das einzige Unterteilungs-Feature, das die Datumsgrenze ueberspannt, ist der
  // Autonome Kreis der Tschuktschen. Fuer Laender gab es handverdrahtete
  // Sonderfaelle (US, FJ, RU), fuer Unterteilungen und Fluesse keine — die Box
  // war 360 Grad breit, und fitBounds zoomte auf die ganze Weltkarte statt auf
  // die Region, auch mitten in einer Quizfrage.
  const ueberDieGrenze = {
    type: 'Polygon',
    coordinates: [[[170, 62], [179, 62], [-175, 66], [-170, 70], [170, 62]]],
  };

  it('haelt eine Geometrie ueber der Datumsgrenze schmal', () => {
    const [[minLng], [maxLng]] = getBoundingBox(ueberDieGrenze);
    expect(maxLng - minLng).toBeLessThan(45);
    // Laengen ueber 180 sind Absicht: MapLibre zeichnet den Ausschnitt damit
    // ueber die Grenze hinweg, statt aussen herum.
    expect(maxLng).toBeGreaterThan(180);
  });

  it('laesst eine gewoehnliche Geometrie unveraendert', () => {
    const deutschlandAehnlich = {
      type: 'Polygon',
      coordinates: [[[6, 47], [15, 47], [15, 55], [6, 55], [6, 47]]],
    };
    expect(getBoundingBox(deutschlandAehnlich)).toEqual([[6, 47], [15, 55]]);
  });

  it('behandelt kein Unterteilungs-Feature mehr als weltumspannend', () => {
    const subdivisions = JSON.parse(
      readFileSync(resolve(process.cwd(), 'public/data/subdivisions.json'), 'utf8')
    );
    const zuBreit = (subdivisions.features || subdivisions)
      .filter(feature => feature.geometry)
      .filter((feature) => {
        const [[minLng], [maxLng]] = getBoundingBox(feature.geometry);
        return maxLng - minLng > 180;
      });
    expect(zuBreit).toEqual([]);
  });
});

describe('GeoJSON-Lader', () => {
  it('führt für eine leere Anforderung keinen Fetch aus', async () => {
    render(<GeoProbe keys={[]} />);
    await screen.findByText('{}');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('verwirft eine HTTP-Fehlerantwort auch dann, wenn sie gültiges JSON enthält', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ features: [] }),
    });

    render(<GeoProbe keys={['countries']} />);

    await screen.findByText('{"countries":null}');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load countries geometry:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
