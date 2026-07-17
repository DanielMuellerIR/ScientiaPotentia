import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AnswerRevealImage from '../components/AnswerRevealImage';
import { DeepSkyOcular } from '../components/AstraVisual';

const image = {
  url: 'https://commons.wikimedia.org/wiki/File%3ADeep_Sky_Test.jpg',
  attribution: 'Testobservatorium',
  license: 'CC BY 4.0'
};

afterEach(cleanup);

describe('AnswerRevealImage', () => {
  it('verbirgt Bild, Alternativtext und Credit bis nach der Antwort', () => {
    const { rerender } = render(
      <AnswerRevealImage image={image} name="Geheimes Objekt" revealed={false} />
    );

    const coveredImage = screen.getByAltText('Verhülltes Exponat');
    expect(coveredImage).not.toHaveClass('exhibit-img--revealed');
    expect(coveredImage).toHaveAttribute('src', expect.stringContaining('Special:FilePath'));
    expect(screen.queryByText(/Testobservatorium/)).not.toBeInTheDocument();
    expect(screen.queryByAltText('Geheimes Objekt')).not.toBeInTheDocument();

    rerender(<AnswerRevealImage image={image} name="Geheimes Objekt" revealed />);

    expect(screen.getByAltText('Geheimes Objekt')).toHaveClass('exhibit-img--revealed');
    expect(screen.getByText(/Testobservatorium/)).toHaveTextContent(
      'Bild: Testobservatorium · CC BY 4.0 · Wikimedia Commons'
    );
  });

  it('fällt bei einem Bildfehler auf das übergebene Visual zurück', () => {
    render(
      <AnswerRevealImage
        image={image}
        name="Defektes Bild"
        fallback={<span>Neutrales Fallback</span>}
      />
    );

    fireEvent.error(screen.getByAltText('Verhülltes Exponat'));
    expect(screen.getByText('Neutrales Fallback')).toBeInTheDocument();
  });

  it('zeigt bei fehlender Urheberangabe weiterhin Lizenz und Fundort ehrlich an', () => {
    render(
      <AnswerRevealImage
        image={{ url: image.url, license: 'Public domain' }}
        name="Gemeinfreies Bild"
        revealed
      />
    );

    expect(screen.getByText(/Public domain/)).toHaveTextContent(
      'Bild: Public domain · Wikimedia Commons'
    );
  });
});

describe('DeepSkyOcular', () => {
  it('nutzt für Galaxien die gemeinsame kreisförmige Reveal-Fassung', () => {
    const concept = { category: 'galaxy', name: 'M 31', image };
    const { container, rerender } = render(
      <DeepSkyOcular concept={concept} revealed={false} />
    );

    expect(container.querySelector('.exhibit-frame--ocular')).toBeInTheDocument();
    expect(container.querySelector('.ocular-reticle')).toBeInTheDocument();
    expect(screen.getByAltText('Verhülltes Exponat')).not.toHaveClass('exhibit-img--revealed');

    rerender(<DeepSkyOcular concept={concept} revealed />);
    expect(screen.getByAltText('M 31')).toHaveClass('exhibit-img--revealed');
  });

  it.each(['nebula', 'star_cluster'])(
    'zeigt für %s ohne Bild ein neutrales Okular statt einer Kugel',
    category => {
      render(<DeepSkyOcular concept={{ category, name: 'Ohne Bild' }} revealed />);
      expect(screen.getByRole('img', {
        name: 'Neutrale schematische Deep-Sky-Ansicht'
      })).toBeInTheDocument();
      expect(screen.getByText('Schematische Ansicht')).toBeInTheDocument();
    }
  );

  it('fällt auch nach einem Deep-Sky-Bildfehler auf das neutrale Okular zurück', () => {
    render(
      <DeepSkyOcular
        concept={{ category: 'star_cluster', name: 'Defekter Haufen', image }}
        revealed
      />
    );
    fireEvent.error(screen.getByAltText('Defekter Haufen'));
    expect(screen.getByRole('img', {
      name: 'Neutrale schematische Deep-Sky-Ansicht'
    })).toBeInTheDocument();
  });

  it('rendert für Nicht-Deep-Sky-Kategorien kein Okular', () => {
    const { container } = render(
      <DeepSkyOcular concept={{ category: 'planet', name: 'Erde', image }} revealed />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
