import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SolarSystemExplorer, {
  MIN_HIT_RADIUS, cameraAnimationDuration, declutterLabels,
  interpolateCamera, normalizeParentBodyName, resolveBodyHit, shouldShowInnerInset
} from '../components/SolarSystemExplorer';

const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

const concepts = {
  sun: { id: 'astra:sun', name: 'Sonne', category: 'star', attributes: {} },
  mercury: { id: 'astra:mercury', name: 'Merkur', category: 'planet', attributes: { orderFromSun: 1, distanceFromSunAU: 0.39, diameterKm: 4879 } },
  venus: { id: 'astra:venus', name: 'Venus', category: 'planet', attributes: { orderFromSun: 2, distanceFromSunAU: 0.72, diameterKm: 12104 } },
  earth: { id: 'astra:earth', name: 'Erde', category: 'planet', attributes: { orderFromSun: 3, distanceFromSunAU: 1, diameterKm: 12742 } },
  mars: { id: 'astra:mars', name: 'Mars', category: 'planet', attributes: { orderFromSun: 4, distanceFromSunAU: 1.52, diameterKm: 6779 } },
  neptune: { id: 'astra:neptune', name: 'Neptun', category: 'planet', attributes: { orderFromSun: 8, distanceFromSunAU: 30.1, diameterKm: 49244 } }
};

let reducedMotion = false;

beforeEach(() => {
  reducedMotion = false;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 760 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 480 });
  vi.stubGlobal('ResizeObserver', class ResizeObserverMock {
    constructor(callback) { this.callback = callback; }
    observe() { this.callback(); }
    disconnect() {}
  });
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: reducedMotion,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn()
  })));
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

afterAll(() => {
  if (originalWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalWidth);
  else delete HTMLElement.prototype.clientWidth;
  if (originalHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalHeight);
  else delete HTMLElement.prototype.clientHeight;
});

describe('Sonnensystem-Explorer: lesbare Außenansicht', () => {
  it('ordnet kollidierende Labels deterministisch nach Priorität und weicht mit Leader-Line aus', () => {
    const labels = [
      { id: 'mars', text: 'Mars', sx: 100, sy: 100, r: 4, x: 104, y: 103, anchor: 'start', fontSize: 12, priority: 10 },
      { id: 'jupiter', text: 'Jupiter', sx: 100, sy: 100, r: 7, x: 104, y: 103, anchor: 'start', fontSize: 12, priority: 90 }
    ];

    const firstPass = declutterLabels(labels);
    expect(declutterLabels(labels)).toEqual(firstPass);
    expect(firstPass.map((label) => label.id)).toEqual(['jupiter', 'mars']);
    expect(firstPass[0].leaderFrom).toBeNull();
    expect(firstPass[1]).toMatchObject({ x: 100, y: 86, anchor: 'middle', leaderFrom: { x: 100, y: 100 } });

    const overlayBlocked = declutterLabels([labels[0]], {
      blockedAreas: [{ left: 100, top: 90, right: 170, bottom: 115 }],
      viewport: { left: 0, top: 0, right: 220, bottom: 180 }
    });
    expect(overlayBlocked[0]).toMatchObject({ x: 100, y: 86, anchor: 'middle', leaderFrom: { x: 100, y: 100 } });
  });

  it('zeigt das eigene Innen-Inset nur solange nahe Planeten zu dicht beieinander liegen', async () => {
    expect(shouldShowInnerInset([{ x: 0, y: 0 }, { x: 10, y: 0 }], 1)).toBe(true);
    expect(shouldShowInnerInset([{ x: 0, y: 0 }, { x: 10, y: 0 }], 5)).toBe(false);

    reducedMotion = true;
    render(<SolarSystemExplorer domain={{ accent: '#5B4B8A' }} concepts={concepts} />);
    expect(screen.getByTestId('solar-inner-inset')).toHaveTextContent('Inneres System');
    expect(screen.getByTestId('solar-inner-inset')).toHaveTextContent('Maßstab');

    fireEvent.click(screen.getByTestId('solar-hit-earth'));
    await waitFor(() => {
      expect(screen.queryByTestId('solar-inner-inset')).not.toBeInTheDocument();
    });
  });

  it('entzerrt Merkur und Venus im Inset über getrennte Label-Anker', () => {
    render(<SolarSystemExplorer domain={{ accent: '#5B4B8A' }} concepts={concepts} />);
    const inset = screen.getByTestId('solar-inner-inset');
    const mercury = within(inset).getByText('Merkur');
    const venus = within(inset).getByText('Venus');

    expect(mercury).toHaveAttribute('text-anchor', 'end');
    expect(venus).toHaveAttribute('text-anchor', 'middle');
    expect(Number(mercury.getAttribute('y'))).toBeGreaterThan(Number(venus.getAttribute('y')));
  });

  it('rückt das Inset neben eine geöffnete Mondliste statt sie zu überdecken', async () => {
    const manyMoons = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [
      `moon-${index}`,
      { id: `astra:moon-${index}`, name: `Mond ${index + 1}`, category: 'moon', attributes: { parentPlanet: 'Jupiter', diameterKm: 1000 - index } }
    ]));
    const conceptsWithJupiter = {
      ...concepts,
      jupiter: { id: 'astra:jupiter', name: 'Jupiter', category: 'planet', attributes: { orderFromSun: 5, distanceFromSunAU: 5.2, diameterKm: 139820 } },
      ...manyMoons
    };

    render(<SolarSystemExplorer domain={{ accent: '#5B4B8A' }} concepts={conceptsWithJupiter} />);
    fireEvent.click(screen.getByTestId('solar-hit-jupiter'));

    await waitFor(() => {
      expect(screen.getByText('Monde (9)')).toBeInTheDocument();
      expect(screen.getByTestId('solar-inner-inset')).toHaveStyle({ right: '210px' });
    });
  });

  it('ordnet Monde auch bei einem erklärenden Zwergplanet-Zusatz ihrem Körper zu', async () => {
    reducedMotion = true;
    const dwarfSystem = {
      sun: concepts.sun,
      eris: {
        id: 'astra:eris',
        name: 'Eris',
        category: 'dwarf_planet',
        attributes: { diameterKm: 2326, numMoons: 1 }
      },
      dysnomia: {
        id: 'astra:dysnomia',
        name: 'Dysnomia',
        category: 'moon',
        attributes: { parentPlanet: 'Eris (Zwergplanet)', diameterKm: 700 }
      }
    };

    expect(normalizeParentBodyName(' Eris (Zwergplanet) ')).toBe('eris');
    render(<SolarSystemExplorer domain={{ accent: '#5B4B8A' }} concepts={dwarfSystem} />);
    fireEvent.click(screen.getByTestId('solar-hit-eris'));

    await waitFor(() => {
      expect(screen.getByText('Dysnomia')).toBeInTheDocument();
      expect(screen.getByText('1 Monde')).toBeInTheDocument();
    });
  });

  it('hält die interne Zoomnavigation auf schmalen Ansichten eindeutig bedienbar', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 375 });
    reducedMotion = true;
    render(<SolarSystemExplorer domain={{ accent: '#5B4B8A' }} concepts={concepts} />);
    fireEvent.click(screen.getByTestId('solar-hit-earth'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vorheriger: Venus' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zurück' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Nächster: Mars' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ganzes System zeigen' })).toBeInTheDocument();
    });
  });

  it('bietet mindestens 12 px Trefferadius auch für winzige Körper', () => {
    render(<SolarSystemExplorer domain={{ accent: '#5B4B8A' }} concepts={concepts} />);
    expect(MIN_HIT_RADIUS).toBeGreaterThanOrEqual(12);
    expect(Number(screen.getByTestId('solar-hit-earth').getAttribute('r'))).toBeGreaterThanOrEqual(12);
    expect(Number(screen.getByTestId('solar-hit-sun').getAttribute('r'))).toBeGreaterThanOrEqual(12);
  });

  it('löst überlappende Touch-Ziele nach dem nächsten Körper statt der Zeichenreihenfolge auf', async () => {
    expect(resolveBodyHit([
      { id: 'earth', sx: 100, sy: 100, r: 1 },
      { id: 'mars', sx: 108, sy: 100, r: 1 }
    ], 100, 100)).toBe('earth');

    reducedMotion = true;
    render(<SolarSystemExplorer domain={{ accent: '#5B4B8A' }} concepts={concepts} />);
    const earthHit = screen.getByTestId('solar-hit-earth');
    fireEvent.click(screen.getByTestId('solar-hit-mars'), {
      clientX: Number(earthHit.getAttribute('cx')),
      clientY: Number(earthHit.getAttribute('cy'))
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Erde' })).toBeInTheDocument();
    });
  });
});

describe('Sonnensystem-Explorer: Kamerabewegung', () => {
  it('interpoliert Klick-Ziele weich und überspringt sie bei reduzierter Bewegung', () => {
    const from = { cx: 0, cy: 0, scale: 1 };
    const target = { cx: 10, cy: -8, scale: 5 };

    expect(interpolateCamera(from, target, 0.5)).toEqual({ cx: 5, cy: -4, scale: 3 });
    expect(interpolateCamera(from, target, 0.25).cx).toBeCloseTo(0.625);
    expect(cameraAnimationDuration(false)).toBe(560);
    expect(cameraAnimationDuration(true)).toBe(0);
  });

  it('startet bei prefers-reduced-motion für einen Klickzoom keinen Animationsframe', async () => {
    reducedMotion = true;
    render(<SolarSystemExplorer domain={{ accent: '#5B4B8A' }} concepts={concepts} />);

    fireEvent.click(screen.getByTestId('solar-hit-earth'));
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Erde' })).toBeInTheDocument();
    });
  });
});
