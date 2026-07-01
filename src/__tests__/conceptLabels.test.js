import { describe, it, expect } from 'vitest';
import {
  isAttrLeakedBeforeAnswer,
  sourceRevealsValue,
  LEAKY_SIBLINGS
} from '../components/conceptLabels';

// Regressionstest fuer den Selbstverraeter-Guard (Panel-Leaks, QA-Fund 2026-07-01).
// Deckt die Geschwister-Ausblendung (isAttrLeakedBeforeAnswer) und den diakritika-
// robusten, tokenweisen Quellen-Guard (sourceRevealsValue) ab.

describe('isAttrLeakedBeforeAnswer — Geschwister-Ausblendung', () => {
  // Jedes Paar: [gefragtes Attribut, Geschwister, das die Antwort verraten wuerde].
  const leakingPairs = [
    ['birthYear', 'lifespan'],        // Lebenszeit "1653–1706" nennt Geburtsjahr
    ['deathYear', 'lifespan'],        // dieselbe Lebenszeit nennt auch das Todesjahr
    ['startYear', 'period'],          // Perioden-String "1905–1913" nennt Startjahr
    ['startYear', 'mainRepresentatives'],
    ['period', 'mainRepresentatives'],// Hauptvertreter datieren die Kunstrichtung
    ['sourceLanguage', 'loanPath'],   // Entlehnungsweg nennt die Herkunftssprache
    ['originalMeaning', 'loanPath'],
    ['loanPath', 'sourceLanguage'],
    ['country', 'location'],          // "Galleria Borghese, Rom" verraet Italien
    ['country', 'inventor'],          // US-Erfindername verraet das Land
    ['domain', 'fullName'],           // "Frames per Second" verraet den Bereich
    ['mediaType', 'fullName'],        // "Drawing Exchange Format" verraet die Datenart
    ['purpose', 'fullName'],          // Langform verraet den Zweck
    ['purpose', 'avgComplexity'],     // "O(n) (Stromchiffre)" verraet den Zweck
    // Homo Welle 5 (Gelenke/Reflexe/Blutgruppen).
    ['jointType', 'movement'],        // "dreiachsig" verraet den Gelenktyp (Kugelgelenk)
    ['reflexType', 'stimulus'],       // Reiz legt Eigen-/Fremdreflex nahe
    ['reflexType', 'response'],       // Reaktion legt die Reflexart nahe
    ['antibody', 'antigen'],          // Blutgruppen-Antigen/-Antikoerper sind komplementaer
    ['antigen', 'antibody']
  ];

  it.each(leakingPairs)('blendet %s-Frage das Geschwister %s aus', (tested, sibling) => {
    expect(isAttrLeakedBeforeAnswer(sibling, tested)).toBe(true);
  });

  it('blendet das getestete Attribut selbst aus', () => {
    expect(isAttrLeakedBeforeAnswer('birthYear', 'birthYear')).toBe(true);
  });

  it('erhaelt die alte korrelierte Ausblendung (order<->class)', () => {
    expect(isAttrLeakedBeforeAnswer('class', 'order')).toBe(true);
    expect(isAttrLeakedBeforeAnswer('order', 'class')).toBe(true);
  });

  it('blendet Freitext-Details (POST_ANSWER) unabhaengig vom gefragten Attribut aus', () => {
    expect(isAttrLeakedBeforeAnswer('purpose', 'category')).toBe(true);
    expect(isAttrLeakedBeforeAnswer('definition', 'anything')).toBe(true);
  });

  it('laesst legitime, nicht-verraterische Attribute sichtbar', () => {
    // deathYear verraet birthYear NICHT (andere Jahreszahl) -> bleibt sichtbar.
    expect(isAttrLeakedBeforeAnswer('deathYear', 'birthYear')).toBe(false);
    expect(isAttrLeakedBeforeAnswer('nationality', 'birthYear')).toBe(false);
    expect(isAttrLeakedBeforeAnswer('founder', 'startYear')).toBe(false);
    expect(isAttrLeakedBeforeAnswer('material', 'country')).toBe(false);
    expect(isAttrLeakedBeforeAnswer('year', 'country')).toBe(false);
  });

  it('ist bei fehlendem testedAttribute unschaedlich (kein Ausblenden ausser POST_ANSWER)', () => {
    expect(isAttrLeakedBeforeAnswer('lifespan', null)).toBe(false);
    expect(isAttrLeakedBeforeAnswer('period', undefined)).toBe(false);
  });
});

describe('sourceRevealsValue — diakritika-robuster, tokenweiser Quellen-Guard', () => {
  it('verbirgt die Quelle bei Diakritika-Abweichung (Dvořák vs. keyed Antonin Dvorak)', () => {
    expect(sourceRevealsValue('Wikipedia DE – Violinkonzert (Dvořák)', 'Antonin Dvorak')).toBe(true);
  });

  it('verbirgt die Quelle, wenn der keyed-Wert laenger ist als das Quellfragment', () => {
    expect(sourceRevealsValue('Wikipedia DE – Reinhold Messner', 'Reinhold Messner und Peter Habeler')).toBe(true);
  });

  it('behaelt die alte Substring-Erkennung inkl. Umlaut (Vögel)', () => {
    expect(sourceRevealsValue('Grzimeks Tierleben – Vögel', 'Vögel')).toBe(true);
  });

  it('verbirgt NICHT, wenn die Quelle den Wert nicht enthaelt', () => {
    expect(sourceRevealsValue('Grzimeks Tierleben – Insekten', '20 cm')).toBe(false);
    expect(sourceRevealsValue('Wikipedia DE – Doppler-Effekt', 'Physik')).toBe(false);
  });

  it('ist bei null/leerem Wert unschaedlich', () => {
    expect(sourceRevealsValue('Wikipedia DE – X', null)).toBe(false);
    expect(sourceRevealsValue('Wikipedia DE – X', '')).toBe(false);
  });
});

describe('LEAKY_SIBLINGS Tabelle', () => {
  it('deckt alle im QA-Report gefundenen Panel-Leak-Attribute ab', () => {
    for (const key of ['birthYear', 'startYear', 'period', 'sourceLanguage',
      'loanPath', 'country', 'domain', 'mediaType', 'purpose']) {
      expect(Array.isArray(LEAKY_SIBLINGS[key])).toBe(true);
      expect(LEAKY_SIBLINGS[key].length).toBeGreaterThan(0);
    }
  });
});
