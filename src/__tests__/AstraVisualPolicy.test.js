import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_STAR_COLOR,
  SATURN_RING_CREDIT,
  SATURN_RING_TEXTURE,
  getAstraDisclosurePolicy,
  hasAtmosphereEvidence,
  hasTransitEvidence,
  isAstraAttrLeakedBeforeAnswer,
  spectralColorFromAttributes
} from '../components/AstraVisual';
import { TEXTURE_CREDIT } from '../components/astraBodies';

const concept = (overrides = {}) => ({
  id: 'astra:test',
  name: 'Testobjekt',
  category: 'planet',
  attributes: {},
  source: { name: 'Fachkatalog' },
  ...overrides
});

describe('Astra-Sternevidenz', () => {
  it.each([
    ['O5V', 0x9bb0ff],
    ['B2', 0xaabfff],
    ['A0 V', 0xcad7ff],
    ['F8', 0xf8f7ff],
    ['G2V', 0xfff4ea],
    ['K1 III', 0xffd2a1],
    ['M4', 0xffb56c]
  ])('ordnet die explizite Spektralklasse %s zu', (spectralClass, expected) => {
    expect(spectralColorFromAttributes({ spectralClass })).toBe(expected);
  });

  it('bleibt ohne explizite Spektralklasse neutral warm', () => {
    expect(spectralColorFromAttributes({})).toBe(NEUTRAL_STAR_COLOR);
    expect(spectralColorFromAttributes({ color: 'blau' })).toBe(NEUTRAL_STAR_COLOR);
    expect(spectralColorFromAttributes({ spectralClass: 'unbekannt' })).toBe(NEUTRAL_STAR_COLOR);
    expect(spectralColorFromAttributes({ spectralClass: 'orange' })).toBe(NEUTRAL_STAR_COLOR);
    expect(spectralColorFromAttributes({ spectralClass: 'Mysterious' })).toBe(NEUTRAL_STAR_COLOR);
  });

  it('neutralisiert die Farbe bei Identitäts- und Spektralfragen', () => {
    const star = concept({
      category: 'star',
      attributes: { spectralClass: 'M2' }
    });
    expect(getAstraDisclosurePolicy({
      concept: star,
      answerIsName: true
    }).neutralizeStar).toBe(true);
    expect(getAstraDisclosurePolicy({
      concept: star,
      testedAttribute: 'spectralClass'
    }).neutralizeStar).toBe(true);
  });
});

describe('Astra-Ringe und Atmosphäre', () => {
  it('dokumentiert Quellen, Lizenzen und technische Änderungen der Texturen', () => {
    expect(TEXTURE_CREDIT.sourceUrl).toMatch(/^https:\/\//);
    expect(TEXTURE_CREDIT.licenseUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(TEXTURE_CREDIT.changes).toMatch(/3D-Darstellung/);
    expect(SATURN_RING_CREDIT.sourceUrl).toMatch(/PIA06175/);
    expect(SATURN_RING_CREDIT.licenseUrl).toMatch(/nasa\.gov/);
    expect(SATURN_RING_CREDIT.changes).toMatch(/1600 Pixel/);
  });

  it('zeigt Ringe ausschließlich bei hasRings === true und mit Guards', () => {
    const saturn = concept({ id: 'astra:saturn', attributes: { hasRings: true } });
    expect(getAstraDisclosurePolicy({ concept: saturn }).showRings).toBe(true);
    expect(getAstraDisclosurePolicy({
      concept: saturn,
      testedAttribute: 'hasRings'
    }).showRings).toBe(false);
    expect(getAstraDisclosurePolicy({
      concept: saturn,
      answerIsName: true
    }).showRings).toBe(false);
    expect(getAstraDisclosurePolicy({
      concept: concept({ attributes: { hasRings: 'ja' } })
    }).showRings).toBe(false);
    expect(SATURN_RING_TEXTURE).toMatch(/saturn_rings_pia06175\.jpg$/);
  });

  it('nimmt eine Atmosphäre nie aus dem Fun-Fact an', () => {
    const funFactOnly = concept({
      funFact: 'Dieses Objekt besitzt eine dichte Atmosphäre.',
      attributes: {}
    });
    expect(hasAtmosphereEvidence(funFactOnly.attributes)).toBe(false);
    expect(getAstraDisclosurePolicy({ concept: funFactOnly }).showAtmosphere).toBe(false);
  });

  it('akzeptiert nur explizite strukturierte Atmosphärenevidenz und schützt sie', () => {
    expect(hasAtmosphereEvidence({ hasAtmosphere: true })).toBe(true);
    expect(hasAtmosphereEvidence({ atmosphere: 'Stickstoff und Methan' })).toBe(true);
    expect(hasAtmosphereEvidence({ atmosphere: ['Stickstoff'] })).toBe(true);
    expect(hasAtmosphereEvidence({ atmosphere: 'keine' })).toBe(false);
    expect(hasAtmosphereEvidence({ atmosphere: [false] })).toBe(false);
    expect(hasAtmosphereEvidence({ atmosphere: { present: false } })).toBe(false);
    expect(hasAtmosphereEvidence({
      hasAtmosphere: true,
      atmosphere: { present: false }
    })).toBe(false);
    expect(hasAtmosphereEvidence({ atmosphere: { state: 'unknown' } })).toBe(false);
    expect(hasAtmosphereEvidence({ atmosphere: { composition: ['Stickstoff'] } })).toBe(true);

    const withAtmosphere = concept({ attributes: { hasAtmosphere: true } });
    expect(getAstraDisclosurePolicy({
      concept: withAtmosphere,
      testedAttribute: 'hasAtmosphere'
    }).showAtmosphere).toBe(false);
  });
});

describe('Astra Deep Sky, Transit und Leakschutz', () => {
  it('enthüllt Deep-Sky-Bilder konservativ erst nach jeder beantworteten Frage', () => {
    const galaxy = concept({
      category: 'galaxy',
      image: { url: 'https://example.test/m31.jpg' },
      attributes: { distanceLy: 2500000 }
    });
    const before = getAstraDisclosurePolicy({ concept: galaxy, testedAttribute: 'diameterLy' });
    const after = getAstraDisclosurePolicy({
      concept: galaxy,
      testedAttribute: 'diameterLy',
      isQuestionAnswered: true
    });
    expect(before.showDeepSkyImage).toBe(true);
    expect(before.isDeepSky).toBe(true);
    expect(before.revealDeepSkyImage).toBe(false);
    expect(after.revealDeepSkyImage).toBe(true);
  });

  it.each(['galaxy', 'nebula', 'star_cluster'])(
    'markiert %s auch ohne Bild als neutrales Deep-Sky-Visual',
    category => {
      const policy = getAstraDisclosurePolicy({ concept: concept({ category }) });
      expect(policy.isDeepSky).toBe(true);
      expect(policy.showDeepSkyImage).toBe(false);
    }
  );

  it('zeigt das Transit-Schema nur mit passender Methode und nach der Antwort', () => {
    const transit = concept({
      category: 'exoplanet',
      attributes: { discoveryMethod: 'Transit photometry' }
    });
    expect(hasTransitEvidence(transit)).toBe(true);
    expect(getAstraDisclosurePolicy({ concept: transit }).showTransitDiagram).toBe(false);
    expect(getAstraDisclosurePolicy({
      concept: transit,
      testedAttribute: 'discoveryMethod'
    }).showTransitDiagram).toBe(false);
    expect(getAstraDisclosurePolicy({
      concept: transit,
      isQuestionAnswered: true
    }).showTransitDiagram).toBe(true);
    expect(hasTransitEvidence(concept({
      category: 'exoplanet',
      attributes: { discoveryMethod: 'Radialgeschwindigkeit' }
    }))).toBe(false);
  });

  it('schützt Distanz, Zentralplanet, Szene und verräterische Quellen', () => {
    const moon = concept({
      category: 'moon',
      attributes: { parentPlanet: 'Saturn', distanceLy: 12 },
      source: { name: 'Saturn-Mondkatalog' }
    });
    expect(getAstraDisclosurePolicy({
      concept: moon,
      testedAttribute: 'parentPlanet'
    }).showContextMap).toBe(false);
    expect(getAstraDisclosurePolicy({
      concept: moon,
      testedAttribute: 'distanceLy'
    }).showContextMap).toBe(false);
    expect(getAstraDisclosurePolicy({
      concept: moon,
      testedAttribute: 'parentPlanet'
    }).showSource).toBe(false);
    expect(getAstraDisclosurePolicy({
      concept: moon,
      answerIsName: true
    }).neutralizeSceneIdentity).toBe(true);
    expect(isAstraAttrLeakedBeforeAnswer('notableStars', 'brightestStar')).toBe(true);
  });

  it('neutralisiert bei Planetentypfragen Textur, Ringe und Kontext', () => {
    const saturn = concept({
      id: 'astra:saturn',
      category: 'planet',
      attributes: { type: 'Gasriese', hasRings: true, orderFromSun: 6 }
    });
    const before = getAstraDisclosurePolicy({ concept: saturn, testedAttribute: 'type' });
    const after = getAstraDisclosurePolicy({
      concept: saturn,
      testedAttribute: 'type',
      isQuestionAnswered: true
    });

    expect(before.neutralizeSceneIdentity).toBe(true);
    expect(before.showRings).toBe(false);
    expect(before.showContextMap).toBe(false);
    expect(after.neutralizeSceneIdentity).toBe(false);
    expect(after.showRings).toBe(true);
    expect(after.showContextMap).toBe(true);
  });
});
