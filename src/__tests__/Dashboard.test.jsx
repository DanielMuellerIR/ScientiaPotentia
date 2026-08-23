import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Dashboard from '../components/Dashboard';

describe('Dashboard', () => {
  it('zählt bei Terra nur Entitäten mit einer erreichbaren Frage', () => {
    render(
      <Dashboard
        domain={{ id: 'terra', latinName: 'Terra', label: 'Geografie' }}
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

    expect(screen.getByText('1 Orte')).toBeInTheDocument();
    expect(screen.getByText('1 / 1 entdeckt')).toBeInTheDocument();
    expect(screen.getByTitle('Angespielt: 100%')).toBeInTheDocument();
    expect(screen.getByTitle('Gemeistert: 0%')).toBeInTheDocument();
    expect(screen.queryByText('2 Orte')).not.toBeInTheDocument();
  });
});
