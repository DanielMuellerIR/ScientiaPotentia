import React from 'react';
import {
  cleanup, fireEvent, render, screen, within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScientiaHub from '../components/ScientiaHub';
import { DOMAINS, SCIENTIA_MIX_IDS } from '../domains';

afterEach(cleanup);

// Kleines Manifest-Fixture (Struktur wie public/data/domain_stats.json).
const STATS = {
  totals: { questions: 49776, concepts: 13047, images: 5041, domains: 8 },
  domains: {
    terra: { questions: 5116, concepts: 1852, images: 0, hasMap: true },
    astra: { questions: 5055, concepts: 1560, images: 478, hasMap: false },
    homo: { questions: 1600, concepts: 599, images: 306, hasMap: false },
    natura: { questions: 13215, concepts: 2402, images: 1878, hasMap: false },
    lingua: { questions: 4877, concepts: 1207, images: 184, hasMap: false },
    cultura: { questions: 7440, concepts: 2018, images: 1048, hasMap: false },
    machina: { questions: 6141, concepts: 2165, images: 124, hasMap: false },
    historia: { questions: 6332, concepts: 1244, images: 1023, hasMap: false }
  }
};

describe('ScientiaHub', () => {
  it('zeigt Gesamtzahlen, eine Karte je Fachbereich (ohne scientia) und Terra als Weltkarte', () => {
    render(
      <ScientiaHub
        domains={DOMAINS}
        stats={STATS}
        onSelectDomain={vi.fn()}
        onStartMixedQuiz={vi.fn()}
      />
    );

    // Gesamtzahl deutsch gruppiert im Hero.
    expect(screen.getByText('49.776')).toBeInTheDocument();

    // Genau eine Karte je Fachbereich: alle Domains außer dem Mischbereich selbst.
    const areaCount = DOMAINS.filter(d => d.id !== 'scientia').length;
    const cards = screen.getAllByRole('button', { name: /^(Terra|Astra|Homo|Natura|Lingua|Cultura|Machina|Historia):/ });
    expect(cards).toHaveLength(areaCount);

    // Terra (hasMap) nennt die Weltkarte statt einer Bildzahl.
    const terra = screen.getByRole('button', { name: /^Terra:/ });
    expect(within(terra).getByText('Weltkarte')).toBeInTheDocument();
    expect(terra.getAttribute('aria-label')).toContain('mit Weltkarte');

    // Natura nennt die (dynamische) Fragen- und Bildzahl.
    const natura = screen.getByRole('button', { name: /^Natura:/ });
    expect(natura.getAttribute('aria-label')).toContain('13.215 Fragen');
    expect(natura.getAttribute('aria-label')).toContain('1.878 freie Bilder');
  });

  it('meldet Bereichswechsel und Querbeet-Start an die Callbacks', () => {
    const onSelectDomain = vi.fn();
    const onStartMixedQuiz = vi.fn();
    render(
      <ScientiaHub
        domains={DOMAINS}
        stats={STATS}
        onSelectDomain={onSelectDomain}
        onStartMixedQuiz={onStartMixedQuiz}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Astra:/ }));
    expect(onSelectDomain).toHaveBeenCalledWith('astra');

    fireEvent.click(screen.getByRole('button', { name: /Querbeet/i }));
    expect(onStartMixedQuiz).toHaveBeenCalledTimes(1);
  });

  it('benennt im Querbeet-Angebot die Bereiche, die der Mischpool nicht enthält', () => {
    // Terra fehlt im Mischpool (SCIENTIA_MIX_IDS), weil seine Kartenfragen die
    // Weltkarte brauchen. Dann darf das primäre Angebot nicht pauschal "alle
    // Bereiche" zusagen, sondern muss den fehlenden Bereich beim Namen nennen.
    // Kommt Terra später in den Mischpool, ist diese Liste leer und die
    // Prüfung fordert von selbst nichts mehr.
    const excluded = DOMAINS.filter(d => d.id !== 'scientia' && !SCIENTIA_MIX_IDS.includes(d.id));
    render(
      <ScientiaHub
        domains={DOMAINS}
        stats={STATS}
        onSelectDomain={vi.fn()}
        onStartMixedQuiz={vi.fn()}
      />
    );

    const cta = screen.getByRole('button', { name: /Querbeet/i });
    const title = cta.querySelector('.scientia-hub-cta-title');
    expect(title).not.toBeNull();
    excluded.forEach(domain => {
      expect(title.textContent).toContain(`außer ${domain.label}`);
    });
  });

  it('ordnet in der Definitionsliste erst den Begriff und dann seinen Wert an', () => {
    const { container } = render(
      <ScientiaHub
        domains={DOMAINS}
        stats={STATS}
        onSelectDomain={vi.fn()}
        onStartMixedQuiz={vi.fn()}
      />
    );

    const total = container.querySelector('.scientia-hub-total');
    expect(total.children[0].tagName).toBe('DT');
    expect(total.children[1].tagName).toBe('DD');
  });

  it('zeigt Platzhalter statt Zahlen, solange das Manifest fehlt', () => {
    render(
      <ScientiaHub
        domains={DOMAINS}
        stats={null}
        onSelectDomain={vi.fn()}
        onStartMixedQuiz={vi.fn()}
      />
    );
    // Ohne Stats erscheinen dezente Platzhalter; die Karten bleiben klickbar.
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Terra:/ })).toBeInTheDocument();
  });
});
