import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import maplibregl from 'maplibre-gl';
import Atlas from '../components/Atlas';
import Map from '../components/Map';
import { useGeoData } from '../utils/useGeoData';

const stylePath = resolve(process.cwd(), 'public/map_styles/scientia_parchment.json');
const parchmentStyle = JSON.parse(readFileSync(stylePath, 'utf8'));
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
