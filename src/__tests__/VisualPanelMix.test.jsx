import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VisualPanel from '../components/VisualPanel';
import { getDomainById } from '../domains';

const lifecycle = vi.hoisted(() => ({ mounts: 0 }));
vi.mock('../components/Map', () => ({ default: () => {
  React.useEffect(() => { lifecycle.mounts++; }, []);
  return <div data-testid="map">Weltkarte</div>;
} }));
vi.mock('../components/AstraVisual', () => ({ default: ({ domain }) => <div>Astra-Visual {domain.id}</div> }));
vi.mock('../components/HomoVisual', () => ({ default: ({ domain }) => <div>Homo-Visual {domain.id}</div> }));
afterEach(cleanup);

const concepts = {
  FR: { id: 'FR', name: 'Frankreich', type: 'country' },
  'astra:mars': { id: 'astra:mars', name: 'Mars' },
  'homo:femur': { id: 'homo:femur', name: 'Femur' },
};
const props = { domain: getDomainById('scientia'), concepts, mapAvailable: true };

describe('Visuals im Bereichsmix', () => {
  it('wechselt Herkunftsvisuals und behält dieselbe geprüfte Karte', async () => {
    lifecycle.mounts = 0;
    const view = render(<VisualPanel {...props} activeConceptKey="astra:mars" />);
    await screen.findByText('Astra-Visual astra');
    await screen.findByTestId('map');
    view.rerender(<VisualPanel {...props} activeConceptKey="FR" />);
    expect(screen.getByTestId('map').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false');
    view.rerender(<VisualPanel {...props} activeConceptKey="homo:femur" />);
    await screen.findByText('Homo-Visual homo');
    expect(screen.getByTestId('map').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true');
    expect(lifecycle.mounts).toBe(1);
  });
  it('verbirgt im Terra-Fallback die Identität bis zur Antwort', async () => {
    const view = render(<VisualPanel {...props} mapAvailable={false} activeConceptKey="FR" />);
    expect(screen.queryByText('Frankreich')).toBeNull();
    view.rerender(<VisualPanel {...props} mapAvailable={false} activeConceptKey="FR" isQuestionAnswered />);
    expect(screen.getByText('Frankreich')).toBeVisible();
  });
});
