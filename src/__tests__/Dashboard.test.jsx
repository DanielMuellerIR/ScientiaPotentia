import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../components/Dashboard';

afterEach(cleanup);

describe('Dashboard', () => {
  it.each(['terra', 'astra', 'homo', 'natura', 'cultura', 'lingua', 'machina', 'historia', 'scientia'])('zählt in %s nur erreichbare Konzepte', id => {
    render(
      <Dashboard
        domain={{ id, latinName: 'Test', label: 'Testbereich' }}
        geodb={{
          entities: {
            reachable: { id: 'reachable', type: 'city', name: 'Erreichbar' },
            retired: { id: 'retired', type: 'city', name: 'Nicht abfragbar' },
          },
        }}
        questionPool={[{ entityId: 'reachable' }]}
        srsProgress={{
          reachable: { repetitions: 1, interval: 1 },
          retired: { repetitions: 4, interval: 30 },
        }}
        onStartDailyReview={() => {}}
      />
    );

    expect(screen.getByText(id === 'terra' ? '1 Orte' : '1 Konzepte')).toBeInTheDocument();
    expect(screen.getByText('1 / 1 entdeckt')).toBeInTheDocument();
    expect(screen.getByTitle('Angespielt: 100%')).toBeInTheDocument();
    expect(screen.getByTitle('Gemeistert: 0%')).toBeInTheDocument();
    expect(screen.queryByText('2 Orte')).not.toBeInTheDocument();
  });

  it('wechselt beim Übergang zu Mehrspieler sofort von Überleben auf eine feste Runde', () => {
    const onStart = vi.fn();
    render(
      <Dashboard
        domain={{ id: 'natura', latinName: 'Natura', label: 'Natur & Umwelt' }}
        geodb={{ entities: {} }}
        onStartDailyReview={onStart}
      />
    );

    const survival = screen.getByRole('radio', { name: 'Überleben (3 Leben)' });
    fireEvent.click(survival);
    expect(survival).toBeChecked();
    expect(survival.getAttribute('name')).toMatch(/-round$/);
    expect(screen.getByRole('radiogroup', { name: 'Spiellänge' })).toContainElement(survival);

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.queryByRole('radio', { name: 'Überleben (3 Leben)' })).toBeNull();
    expect(screen.getByRole('radio', { name: '25 Fragen' })).toBeChecked();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Quiz starten' }));
    expect(onStart).toHaveBeenCalledWith(
      'all',
      { kind: 'fixed', length: 25 },
      ['Spieler 1', 'Spieler 2']
    );
  });

  it('weist einen Rundungsrest nicht fälschlich den neuen Konzepten zu', () => {
    render(
      <Dashboard
        domain={{ id: 'astra', latinName: 'Astra', label: 'Astronomie' }}
        geodb={{
          entities: {
            mastered: { id: 'mastered', type: 'planet' },
            familiar: { id: 'familiar', type: 'moon' },
            learning: { id: 'learning', type: 'star' },
          },
        }}
        questionPool={['mastered', 'familiar', 'learning'].map(entityId => ({ entityId }))}
        srsProgress={{
          mastered: { repetitions: 3, interval: 30 },
          familiar: { repetitions: 2, interval: 7 },
          learning: { repetitions: 1, interval: 1 },
        }}
        onStartDailyReview={() => {}}
      />
    );

    expect(screen.getByTitle('Neu: 0%')).toBeInTheDocument();
    expect(screen.getByText('0 (0%)')).toBeInTheDocument();
  });
});
