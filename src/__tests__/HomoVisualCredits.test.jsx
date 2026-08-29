import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import HomoVisual from '../components/HomoVisual';
import homoQuestions from '../../public/data/questions_homo.json';

afterEach(cleanup);

describe('Homo-Fragentypografie', () => {
  it('schließt deutsche Anführungszeichen nicht mit einem geraden Zollzeichen', () => {
    expect(homoQuestions.filter(question => /„[^“\n]*"/u.test(question.prompt)))
      .toEqual([]);
  });
});

describe('HomoVisual', () => {
  it.each([
    ['bone', 'assets/homo/skeleton.svg', 'Mikael Häggström', 'Human_skeleton_front_-_no_labels.svg', 'unverändert gebündelt'],
    ['muscle', 'assets/homo/muscles.png', 'historische Bouglé-Figur', 'Bougle_whole2_retouched.png', 'unverändert gebündelt'],
    ['organ', 'assets/homo/organs.svg', 'Mikael Häggström', 'Man_shadow_anatomy.svg', 'Beschriftungen und Linien entfernt'],
    ['body_fact', 'assets/homo/body.svg', 'Mikael Häggström', 'Adult_male_diagram_template.svg', 'Platzhalter und Linien entfernt'],
    ['species', 'assets/homo/skeleton.svg', 'Mikael Häggström', 'Human_skeleton_front_-_no_labels.svg', 'unverändert gebündelt'],
    ['nerve', 'assets/homo/body.svg', 'Mikael Häggström', 'Adult_male_diagram_template.svg', 'Platzhalter und Linien entfernt']
  ])(
    'zeigt für %s das richtige Asset mit vollständigem Nachweis',
    (category, imagePath, author, sourceFile, changes) => {
      render(
        <HomoVisual
          domain={{ accent: '#123456' }}
          activeConcept={{
            id: 'homo:herz',
            name: 'Herz',
            category,
            attributes: {}
          }}
        />
      );

      expect(screen.getByRole('img')).toHaveAttribute('src', imagePath);
      expect(screen.getByText(new RegExp(author))).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Wikimedia Commons' }))
        .toHaveAttribute('href', expect.stringContaining(sourceFile));
      expect(screen.getByRole('link', { name: 'Public Domain' }))
        .toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/Commons:Public_domain');
      expect(screen.getByText(new RegExp(changes))).toBeInTheDocument();
    }
  );

  it('verwendet die gemeinsamen deutschen Kennwertnamen', () => {
    render(
      <HomoVisual
        domain={{ accent: '#123456' }}
        activeConcept={{
          id: 'homo:nerv-test',
          name: 'Testnerv',
          category: 'nerve',
          attributes: {
            function: 'Testfunktion',
            type: 'Peripherer Nerv',
            innervates: 'Testmuskel',
            latinName: 'Nervus testis'
          }
        }}
      />
    );

    expect(screen.getByText('Typ:')).toBeInTheDocument();
    expect(screen.getByText('Innerviert:')).toBeInTheDocument();
    expect(screen.queryByText('type:')).not.toBeInTheDocument();
    expect(screen.queryByText('innervates:')).not.toBeInTheDocument();
  });

  it.each([
    {
      category: 'joint',
      testedAttribute: 'jointType',
      attributes: { jointType: 'Kugelgelenk', bonesInvolved: 'Testknochen', movement: 'dreiachsig' },
      leakedValue: 'dreiachsig'
    },
    {
      category: 'reflex',
      testedAttribute: 'reflexType',
      attributes: { reflexType: 'Eigenreflex', stimulus: 'Dehnung', response: 'Kontraktion' },
      leakedValue: 'Dehnung'
    },
    {
      category: 'blood_group',
      testedAttribute: 'antibody',
      attributes: { antibody: 'Anti-B', antigen: 'A' },
      leakedValue: 'A'
    }
  ])(
    'verbirgt bei $category das verratende Geschwister von $testedAttribute bis zur Antwort',
    ({ category, testedAttribute, attributes, leakedValue }) => {
      const concept = {
        id: `homo:${category}-test`,
        name: 'Testkonzept',
        category,
        attributes
      };
      const { rerender } = render(
        <HomoVisual
          domain={{ accent: '#123456' }}
          activeConcept={concept}
          testedAttribute={testedAttribute}
        />
      );

      expect(screen.queryByText(leakedValue)).not.toBeInTheDocument();

      rerender(
        <HomoVisual
          domain={{ accent: '#123456' }}
          activeConcept={concept}
          testedAttribute={testedAttribute}
          isQuestionAnswered
        />
      );
      expect(screen.getByText(leakedValue)).toBeInTheDocument();
    }
  );

  it('schützt bei einer Reverse-Frage Name, Kennwerte und Ortsmarker bis zur Antwort', () => {
    const femur = {
      id: 'homo:femur',
      name: 'Oberschenkelknochen',
      category: 'bone',
      attributes: { region: 'Bein', latinName: 'Femur' }
    };
    const { container, rerender } = render(
      <HomoVisual
        domain={{ accent: '#123456' }}
        activeConcept={femur}
        testedAttribute="region"
        hideConceptIdentity
      />
    );

    expect(screen.getByRole('heading', { name: '?' })).toBeInTheDocument();
    expect(screen.queryByText('Bein')).not.toBeInTheDocument();
    expect(container.querySelector('.homo-pulse-ring')).not.toBeInTheDocument();

    rerender(
      <HomoVisual
        domain={{ accent: '#123456' }}
        activeConcept={femur}
        testedAttribute="region"
        hideConceptIdentity
        isQuestionAnswered
      />
    );
    expect(screen.getByRole('heading', { name: 'Oberschenkelknochen' })).toBeInTheDocument();
    expect(screen.getByText('Bein')).toBeInTheDocument();
    expect(container.querySelector('.homo-pulse-ring')).toBeInTheDocument();
  });
});
