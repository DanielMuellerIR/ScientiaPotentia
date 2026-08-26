import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomoVisual from '../components/HomoVisual';

describe('HomoVisual-Bildnachweis', () => {
  it('zeigt Dateiseite, Lizenz, Urheber und Änderungshinweis', () => {
    render(
      <HomoVisual
        domain={{ accent: '#123456' }}
        activeConcept={{
          id: 'homo:herz',
          name: 'Herz',
          category: 'organ',
          attributes: {}
        }}
      />
    );

    expect(screen.getByText(/Mikael Häggström/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wikimedia Commons' }))
      .toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Man_shadow_anatomy.svg');
    expect(screen.getByRole('link', { name: 'Public Domain' }))
      .toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/Commons:Public_domain');
    expect(screen.getByText(/Beschriftungen und Linien entfernt/)).toBeInTheDocument();
  });
});
