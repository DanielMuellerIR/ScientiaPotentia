import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Layers } from 'lucide-react';
import ConceptVisual from '../components/ConceptVisual';
import DomainVisual from '../components/DomainVisual';

afterEach(cleanup);

describe('DomainVisual', () => {
  it('zählt in der Lernübersicht nur tatsächlich abfragbare Konzepte', () => {
    render(<DomainVisual domain={{ latinName: 'Test', Icon: Layers }}
      concepts={{ a: { category: 'animal' }, b: { category: 'animal' } }}
      questionPool={[{ entityId: 'a' }]} srsProgress={{ a: { repetitions: 1 } }} />);
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByTestId('domain-progress-ring')).toHaveAttribute('aria-label', '100 % entdeckt');
  });
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

describe('ConceptVisual', () => {
  it('zeigt Kennwerte mit deutschen Labels und schaltet die getestete Antwort erst danach frei', () => {
    const domain = {
      latinName: 'Cultura',
      label: 'Kultur',
      accent: '#8C3D2E',
      Icon: Layers,
    };
    const concept = {
      name: 'Faust I',
      category: 'literature',
      attributes: {
        authorDeathYear: 1832,
        work: 'Faust I',
      },
    };
    const { rerender } = render(
      <ConceptVisual
        domain={domain}
        concept={concept}
        testedAttribute="authorDeathYear"
      />
    );

    expect(screen.queryByText('Todesjahr des Urhebers')).not.toBeInTheDocument();
    expect(screen.queryByText('1832')).not.toBeInTheDocument();
    expect(screen.getByText('Werk')).toBeInTheDocument();

    rerender(
      <ConceptVisual
        domain={domain}
        concept={concept}
        testedAttribute="authorDeathYear"
        isQuestionAnswered
      />
    );

    expect(screen.getByText('Todesjahr des Urhebers')).toBeInTheDocument();
    expect(screen.getByText('1832')).toBeInTheDocument();
  });
});
