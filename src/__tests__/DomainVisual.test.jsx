import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Layers } from 'lucide-react';
import DomainVisual from '../components/DomainVisual';

afterEach(cleanup);

describe('DomainVisual', () => {
  it('fasst den Fortschritt in einem Ring zusammen und lokalisiert die Themen', () => {
    render(
      <DomainVisual
        domain={{
          latinName: 'Scientia',
          label: 'Alle Bereiche außer Geografie',
          description: 'Gemischtes Wissen.',
          accent: '#B0863C',
          Icon: Layers,
        }}
        concepts={{
          a: { category: 'animal' },
          b: { category: 'animal' },
          c: { category: 'language_family' },
          d: { category: 'language_family' },
        }}
        srsProgress={{
          a: { repetitions: 2 },
          c: { repetitions: 1 },
        }}
      />
    );

    expect(screen.getByTestId('domain-progress-ring')).toHaveAttribute('aria-label', '50 % entdeckt');
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getByText('Tier')).toBeInTheDocument();
    expect(screen.getByText('Sprachfamilie')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Fortschritt nach Themen' })).toHaveClass('domain-overview-categories');
  });

  it('zeigt bei einem leeren Katalog einen definierten Nullstand', () => {
    const { container } = render(
      <DomainVisual
        domain={{ latinName: 'Leer', label: 'Test', description: '', accent: '#123456', Icon: Layers }}
      />
    );

    expect(screen.getByTestId('domain-progress-ring')).toHaveAttribute('aria-label', '0 % entdeckt');
    expect(container.querySelector('.domain-progress-ring-value')).not.toBeInTheDocument();
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
    expect(screen.getByText('0 Themen')).toBeInTheDocument();
  });
});
