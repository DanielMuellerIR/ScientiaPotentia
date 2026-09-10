import React from 'react';
import {
  cleanup, fireEvent, render, screen, waitFor
} from '@testing-library/react';
import {
  afterAll, afterEach, beforeEach, describe, expect, it, vi
} from 'vitest';
import GalleryExplorer from '../components/GalleryExplorer';
import MuseumExplorer from '../components/MuseumExplorer';
import { DEFAULT_DEPOT_PAGE_SIZE } from '../components/ExhibitGalleryShared';
import { clearImageMirror, mockImageMirror } from './helpers/imageMirror';

const originalClientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientWidth'
);
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
const originalScrollBy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollBy');
let scrollBySpy;

function makeConcept(domainId, index, category, prefix) {
  const serial = String(index).padStart(4, '0');
  const name = `${prefix} ${serial}`;
  return {
    id: `${domainId}:${category}-${serial}`,
    name,
    category,
    attributes: { Nummer: index, geprüft: true },
    funFact: `FunFact zu ${name}`,
    source: {
      name: `Fachquelle ${name}`,
      url: `https://example.test/${domainId}/${category}/${serial}`,
    },
    image: {
      url: `https://commons.wikimedia.org/wiki/File%3A${domainId}_${category}_${serial}.jpg`,
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: `Urheber ${name}`,
      changes: 'für die Anzeige technisch skaliert',
    },
  };
}

function makeConceptMap(domainId, count, category, prefix) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const concept = makeConcept(domainId, index, category, prefix);
    return [concept.id, concept];
  }));
}

// Reale Größenordnung: exakt 5.041 Bilder, darunter 1.584 Natura-Tiere.
const museumFixture = {
  historia: makeConceptMap('historia', 1095, 'milestone', 'Historia'),
  natura: {
    ...makeConceptMap('natura', 1584, 'animal', 'Natura Tier'),
    ...makeConceptMap('natura', 2, 'plant', 'Natura Pflanze'),
  },
  astra: makeConceptMap('astra', 480, 'planet', 'Astra'),
  cultura: makeConceptMap('cultura', 1000, 'artwork', 'Cultura'),
  homo: makeConceptMap('homo', 300, 'organ', 'Homo'),
  machina: makeConceptMap('machina', 400, 'hardware', 'Machina'),
  lingua: makeConceptMap('lingua', 180, 'language', 'Lingua'),
  terra: {},
};

/** Jedes Exponat der Vorlage braucht eine eigene Kopie im Bildmanifest. */
function mirrorFixtureImages() {
  mockImageMirror(
    Object.values(museumFixture)
      .flatMap((domain) => Object.values(domain))
      .map((concept) => concept.image?.url),
  );
}

beforeEach(() => {
  mirrorFixtureImages();
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 900,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value(options = {}) {
      this.scrollLeft = options.left || 0;
    },
  });
  scrollBySpy = vi.fn(function scrollBy(options = {}) {
    this.scrollLeft += options.left || 0;
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
    configurable: true,
    value: scrollBySpy,
  });
  vi.stubGlobal('ResizeObserver', class ResizeObserverMock {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {
      this.callback();
    }

    disconnect() {}
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
    callback();
    return 1;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  clearImageMirror();
  vi.unstubAllGlobals();
});

afterAll(() => {
  if (originalClientWidth) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
  } else {
    delete HTMLElement.prototype.clientWidth;
  }
  if (originalScrollTo) {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
  } else {
    delete HTMLElement.prototype.scrollTo;
  }
  if (originalScrollBy) {
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', originalScrollBy);
  } else {
    delete HTMLElement.prototype.scrollBy;
  }
});

describe('MuseumExplorer bei realer Bildmenge', () => {
  it('öffnet die aktive Domain, begrenzt das Wand-DOM und verschiebt das Fenster beim Scrollen', async () => {
    render(
      <MuseumExplorer allDomainData={museumFixture} activeDomainId="natura" />
    );

    expect(screen.getByLabelText('Museumsbereich wählen')).toHaveValue('natura');
    fireEvent.change(screen.getByLabelText('Kategorie filtern'), {
      target: { value: 'animal' },
    });
    expect(screen.getByText('1584 Exponate')).toBeInTheDocument();

    const initialExhibits = screen.getAllByTestId('hall-exhibit');
    expect(initialExhibits.length).toBeLessThanOrEqual(8);
    expect(initialExhibits[0]).toHaveAttribute('data-exhibit-index', '0');

    const wall = screen.getByTestId('virtual-wall');
    fireEvent.keyDown(wall, { key: 'ArrowRight' });
    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });
    wall.scrollLeft = 9000;
    fireEvent.scroll(wall);

    await waitFor(() => {
      const shifted = screen.getAllByTestId('hall-exhibit');
      expect(shifted.length).toBeLessThanOrEqual(8);
      expect(shifted.some((node) => Number(node.dataset.exhibitIndex) >= 28)).toBe(true);
      expect(shifted.some((node) => node.dataset.exhibitIndex === '0')).toBe(false);
    });
  });

  it('fällt bei einer bildlosen aktiven Domain auf den ersten Saal zurück', async () => {
    render(
      <MuseumExplorer allDomainData={museumFixture} activeDomainId="terra" />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Museumsbereich wählen')).toHaveValue('astra');
    });
    expect(screen.getByText('480 Exponate')).toBeInTheDocument();
  });

  it('folgt einem globalen Bereichswechsel und verwirft alte Museumfilter', async () => {
    const { rerender } = render(
      <MuseumExplorer allDomainData={museumFixture} activeDomainId="astra" />
    );
    fireEvent.change(screen.getByLabelText('Museum durchsuchen'), {
      target: { value: 'Astra 0001' },
    });
    expect(screen.getByLabelText('Museum durchsuchen')).toHaveValue('Astra 0001');

    rerender(
      <MuseumExplorer allDomainData={museumFixture} activeDomainId="natura" />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Museumsbereich wählen')).toHaveValue('natura');
    });
    expect(screen.getByLabelText('Museum durchsuchen')).toHaveValue('');
    expect(screen.getByLabelText('Kategorie filtern')).toHaveValue('all');
    expect(screen.getByTestId('virtual-wall')).toBeInTheDocument();
  });

  it('paginiert das globale Depot strikt und setzt die Seite bei Filtern und Suche zurück', async () => {
    render(
      <MuseumExplorer allDomainData={museumFixture} activeDomainId="natura" />
    );

    fireEvent.change(screen.getByLabelText('Museumsbereich wählen'), {
      target: { value: 'all' },
    });
    expect(screen.getByText('5041 Exponate')).toBeInTheDocument();
    expect(screen.getAllByTestId('depot-card')).toHaveLength(DEFAULT_DEPOT_PAGE_SIZE);
    expect(screen.getByText('Seite 1 von 85')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nächste Depotseite' }));
    expect(screen.getByText('Seite 2 von 85')).toBeInTheDocument();
    expect(screen.getAllByTestId('depot-card')).toHaveLength(DEFAULT_DEPOT_PAGE_SIZE);

    fireEvent.change(screen.getByLabelText('Kategorie filtern'), {
      target: { value: 'animal' },
    });
    await waitFor(() => expect(screen.getByText('Seite 1 von 27')).toBeInTheDocument());
    expect(screen.getByText('1584 Exponate')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Museumsbereich wählen'), {
      target: { value: 'natura' },
    });
    fireEvent.change(screen.getByLabelText('Museum durchsuchen'), {
      target: { value: 'NATURA TIER 0123' },
    });
    expect(screen.getByText('1 Exponat')).toBeInTheDocument();
    const museumTourButton = screen.getByRole('button', { name: /Rundgang/ });
    expect(museumTourButton).toHaveAttribute('aria-pressed', 'true');
    expect(museumTourButton).toHaveAttribute('title', 'Zurück in den Rundgang');
    expect(screen.getAllByTestId('depot-card')).toHaveLength(1);
    expect(screen.getByTitle('Natura Tier 0123')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Rundgang/ }));
    expect(screen.getByLabelText('Museum durchsuchen')).toHaveValue('');
    expect(screen.getByTestId('virtual-wall')).toBeInTheDocument();
    const museumDepotButton = screen.getByRole('button', { name: /Depot/ });
    expect(museumDepotButton).toHaveAttribute('aria-pressed', 'false');
    expect(museumDepotButton)
      .toHaveAttribute('title', 'Depot: gefilterte Exponate als Raster');
  });

  it('navigiert per Tastatur über die Depotseite hinaus, zeigt Quellen und gibt Fokus zurück', async () => {
    render(
      <MuseumExplorer allDomainData={museumFixture} activeDomainId="astra" />
    );

    fireEvent.click(screen.getByRole('button', { name: /Depot/ }));
    const cards = screen.getAllByTestId('depot-card');
    expect(cards).toHaveLength(DEFAULT_DEPOT_PAGE_SIZE);
    const lastCardOnPage = cards[DEFAULT_DEPOT_PAGE_SIZE - 1];
    expect(lastCardOnPage).toHaveAttribute('title', 'Astra 0059');
    lastCardOnPage.focus();
    fireEvent.keyDown(lastCardOnPage, { key: 'Enter' });

    expect(screen.getByRole('dialog', { name: 'Exponat: Astra 0059' })).toBeInTheDocument();
    expect(screen.getByText('60 / 480')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quelle: Fachquelle Astra 0059/ }))
      .toHaveAttribute('href', 'https://example.test/astra/planet/0059');

    const arrowEvent = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(arrowEvent);
    expect(arrowEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Exponat: Astra 0060' }))
        .toBeInTheDocument();
    });
    expect(screen.getByText('61 / 480')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quelle: Fachquelle Astra 0060/ }))
      .toBeInTheDocument();

    fireEvent.error(screen.getByAltText('Astra 0060'));
    expect(screen.getByRole('img', { name: 'Bild für Astra 0060 nicht verfügbar' }))
      .toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(lastCardOnPage).toHaveFocus();
  });

  it('zeigt Museumskennwerte mit Fachlabels und bindet die Einheit an den Wert', () => {
    const rose = makeConcept('natura', 0, 'plant', 'Rose');
    rose.name = 'Testrose';
    rose.attributes = {
      family: 'Rosaceae',
      hasRings: true,
      value: 206,
      unit: 'Knochen',
    };
    render(
      <MuseumExplorer
        allDomainData={{ natura: { [rose.id]: rose } }}
        activeDomainId="natura"
      />
    );

    fireEvent.click(screen.getByTestId('hall-exhibit'));
    expect(screen.getByText('Pflanzenfamilie:')).toBeInTheDocument();
    expect(screen.getByText('Ringe:')).toBeInTheDocument();
    expect(screen.getByText('ja')).toBeInTheDocument();
    expect(screen.getByText('206 Knochen')).toBeInTheDocument();
    expect(screen.queryByText('family:')).not.toBeInTheDocument();
    expect(screen.queryByText('unit:')).not.toBeInTheDocument();
  });
});

describe('GalleryExplorer-Parität', () => {
  it('setzt Saal, Suche und Ansicht bei einem Bereichswechsel zurück', async () => {
    const naturaConcepts = {
      ...makeConceptMap('natura', 2, 'animal', 'Natura Tier'),
      ...makeConceptMap('natura', 2, 'plant', 'Natura Pflanze'),
    };
    const homoConcepts = {
      ...makeConceptMap('homo', 2, 'nerve', 'Homo Nerv'),
      ...makeConceptMap('homo', 2, 'organ', 'Homo Organ'),
    };
    const { rerender } = render(
      <GalleryExplorer
        domain={{ id: 'natura', label: 'Natur & Umwelt', latinName: 'Natura', accent: '#3E7D5A' }}
        concepts={naturaConcepts}
      />
    );
    fireEvent.change(screen.getByLabelText('Saal wählen'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Exponate durchsuchen'), {
      target: { value: 'Natura Pflanze' },
    });

    rerender(
      <GalleryExplorer
        domain={{ id: 'homo', label: 'Mensch & Körper', latinName: 'Homo', accent: '#A14D5A' }}
        concepts={homoConcepts}
      />
    );

    await waitFor(() => expect(screen.getByLabelText('Exponate durchsuchen')).toHaveValue(''));
    expect(screen.getByLabelText('Saal wählen')).toHaveValue('0');
    expect(screen.getByTestId('virtual-wall')).toBeInTheDocument();
  });

  it('verwendet die gemeinsame Wortanfangssuche im Depot', () => {
    const galleryConcepts = Object.fromEntries([
      ['eule', { ...makeConcept('natura', 0, 'animal', 'Galerie'), name: 'Eule' }],
      ['krokodil', { ...makeConcept('natura', 1, 'animal', 'Galerie'), name: 'Beulenkrokodil' }],
    ]);
    render(
      <GalleryExplorer
        domain={{ id: 'natura', label: 'Natur & Umwelt', latinName: 'Natura', accent: '#3E7D5A' }}
        concepts={galleryConcepts}
      />
    );

    fireEvent.change(screen.getByLabelText('Exponate durchsuchen'), {
      target: { value: 'eule' },
    });

    expect(screen.getByTitle('Eule')).toBeInTheDocument();
    expect(screen.queryByTitle('Beulenkrokodil')).not.toBeInTheDocument();
  });

  it('nutzt dieselbe Virtualisierung, Pagination, Suche und Lightbox-Basis', async () => {
    const galleryConcepts = makeConceptMap('natura', 1584, 'animal', 'Galerie Tier');
    render(
      <GalleryExplorer
        domain={{ id: 'natura', label: 'Natur & Umwelt', latinName: 'Natura', accent: '#3E7D5A' }}
        concepts={galleryConcepts}
      />
    );

    expect(screen.getByText('1584 Exponate')).toBeInTheDocument();
    expect(screen.getAllByTestId('hall-exhibit').length).toBeLessThanOrEqual(8);

    const wall = screen.getByTestId('virtual-wall');
    wall.scrollLeft = 6000;
    fireEvent.scroll(wall);
    await waitFor(() => {
      expect(screen.getAllByTestId('hall-exhibit')
        .some((node) => Number(node.dataset.exhibitIndex) >= 18)).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: /Depot/ }));
    expect(screen.getAllByTestId('depot-card')).toHaveLength(DEFAULT_DEPOT_PAGE_SIZE);
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Depotseite' }));
    expect(screen.getByText('Seite 2 von 27')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Exponate durchsuchen'), {
      target: { value: 'GALERIE TIER 1400' },
    });
    expect(screen.getByText('1 Exponat')).toBeInTheDocument();
    const galleryTourButton = screen.getByRole('button', { name: /Rundgang/ });
    expect(galleryTourButton).toHaveAttribute('aria-pressed', 'true');
    expect(galleryTourButton).toHaveAttribute('title', 'Zurück in den Rundgang');

    fireEvent.click(screen.getByRole('button', { name: /Rundgang/ }));
    expect(screen.getByLabelText('Exponate durchsuchen')).toHaveValue('');
    expect(screen.getByTestId('virtual-wall')).toBeInTheDocument();
    const galleryDepotButton = screen.getByRole('button', { name: /Depot/ });
    expect(galleryDepotButton).toHaveAttribute('aria-pressed', 'false');
    expect(galleryDepotButton)
      .toHaveAttribute('title', 'Depot: alle Exponate als Raster');

    fireEvent.change(screen.getByLabelText('Exponate durchsuchen'), {
      target: { value: 'GALERIE TIER 1400' },
    });
    const result = screen.getByTestId('depot-card');
    result.focus();
    fireEvent.keyDown(result, { key: ' ' });

    expect(screen.getByRole('dialog', { name: 'Exponat: Galerie Tier 1400' }))
      .toBeInTheDocument();
    expect(screen.getByText(/Urheber Galerie Tier 1400/))
      .toHaveTextContent('Bild: Urheber Galerie Tier 1400 · Wikimedia Commons · CC BY 4.0 · für die Anzeige technisch skaliert');
    expect(screen.getByRole('link', { name: 'Wikimedia Commons' }))
      .toHaveAttribute('href', expect.stringContaining('File%3Anatura_animal_1400.jpg'));
  });

  it('scrollt die Wand bei reduzierter Bewegung ohne Smooth-Animation', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    render(
      <GalleryExplorer
        domain={{ id: 'natura', label: 'Natur & Umwelt', latinName: 'Natura', accent: '#3E7D5A' }}
        concepts={makeConceptMap('natura', 20, 'animal', 'Ruhige Galerie')}
      />
    );

    fireEvent.keyDown(screen.getByTestId('virtual-wall'), { key: 'ArrowRight' });
    expect(globalThis.matchMedia)
      .toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 300, behavior: 'auto' });
  });
});
