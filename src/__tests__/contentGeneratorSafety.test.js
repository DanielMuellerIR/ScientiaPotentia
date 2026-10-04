import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBodyFactValue, bodyFactOptions } from '../../scripts/lib/body_fact_values.js';
import { isSpecificQuoteWork, artworkEraConflict, calendarDateConflict, agencyConflict } from '../../scripts/lib/answer_overlap.js';
import { refreshImageFields } from '../../scripts/lib/merge_images.js';
import { isSpecificAnswer } from '../../scripts/lib/audit_rules.cjs';
const catalog = domain => JSON.parse(readFileSync(`public/data/questions_${domain}.json`, 'utf8'));

describe('Numerische Körperwerte', () => {
  it('behält die Dickdarmlänge mit deutscher Dezimalschreibweise im Quiz', () => {
    const question = catalog('homo').find(q => q.entityId === 'homo:dickdarm_laenge' && q.type === 'homo-bodyfact-value');
    expect(question).toBeDefined();
    expect(question.correctAnswer).toBe('ca. 1,5 m');
  });
  it.each([
    ['0,8–1,5', 0.8, 1.5], ['1.500–1.700', 1500, 1700],
    ['500.000.000', 500000000, 500000000], ['37 Billionen', 37, 37],
    ['20 bis 20000', 20, 20000], ['ca. 1,5', 1.5, 1.5], [1.8, 1.8, 1.8],
  ])('liest den ganzen Wert %s', (raw, lower, upper) => {
    expect(parseBodyFactValue(raw)).toMatchObject({ lower, upper });
    const options = bodyFactOptions(raw, 'Messwert', 'test');
    expect(options.distractors).toHaveLength(3);
    if (String(raw).includes('Billionen')) expect([options.correct, ...options.distractors].every(value => value.endsWith('Billionen Messwert'))).toBe(true);
  });
  it.each(['unter 80', '1.700–1.500', '12.34', '20 bis', 'Infinity'])('verwirft %s', raw => expect(parseBodyFactValue(raw)).toBeNull());
  it('mischt kleinere und größere Alternativen und hält Bereiche auseinander', () => {
    for (const raw of ['80', '0,8–1,5', '1.500–1.700']) {
      const original = parseBodyFactValue(raw);
      const values = bodyFactOptions(raw, '', raw).distractors.map(parseBodyFactValue);
      expect(values.some(value => value.upper < original.lower)).toBe(true);
      expect(values.some(value => value.lower > original.upper)).toBe(true);
      expect(values.every(value => value.upper < original.lower || value.lower > original.upper)).toBe(true);
    }
  });
  it('zeigt zählbare Körperteile in allen Optionen als ganze Zahlen', () => {
    const options = bodyFactOptions('3', 'Knochen', 'wert-gehoerknoechelchen-je-ohr');
    expect(options.distractors).toHaveLength(3);
    expect([options.correct, ...options.distractors].every(option => /^\d+ Knochen$/.test(option))).toBe(true);
  });
  it('verwirft gebrochene Anzahlen, behält dezimale Zelldichten', () => {
    expect(bodyFactOptions('3,5', 'Knochen', 'count')).toBeNull();
    expect(bodyFactOptions('4,5–5,5', 'Millionen pro Mikroliter', 'density')).not.toBeNull();
  });
  it.each(['60', 'ca. 55', '41–46', '0', '100', '0–5', '95–100'])('begrenzt Prozentoptionen %s', raw => {
    const options = bodyFactOptions(raw, '%', 'körperwasser_60');
    expect(options).not.toBeNull();
    expect(options.distractors).toHaveLength(3);
    for (const option of [options.correct, ...options.distractors]) {
      const value = parseBodyFactValue(option.slice(0, -2));
      expect(value.lower).toBeGreaterThanOrEqual(0);
      expect(value.upper).toBeLessThanOrEqual(100);
    }
  });
  it('lässt einen Prozentbereich ohne drei disjunkte Alternativen aus', () => {
    expect(bodyFactOptions('0–100', '%', 'entire')).toBeNull();
    expect(bodyFactOptions('101', '%', 'invalid')).toBeNull();
  });
  it('bewahrt angegebene Dezimalpräzision in allen Bereichsendpunkten', () => {
    const options = bodyFactOptions('0,8–2', 'Liter', 'wert-urinproduktion');
    expect([options.correct, ...options.distractors].every(option => /\d+,\d–\d+,\d Liter$/.test(option))).toBe(true);
  });
  it('prüft jede erzeugte Körperfrage gegen Einheit, Präzision und Wertebereich', () => {
    const raw = JSON.parse(readFileSync('scripts/data_sources/homo_raw.json', 'utf8'));
    const byId = new Map(raw.map(c => [`homo:${c.id}`, c]));
    const countUnits = new Set(['Knochen', 'Zähne', 'Chromosomen', 'Rippenpaare', 'Muskeln', 'Neuronen', 'Geschmacksknospen', 'Haare', 'Drüsen', 'Alveolen', 'Gelenke', 'Nierenkörperchen', 'Sehzellen', 'Stück', 'Stück/Tag', 'Zellen', 'proteincodierende Gene', 'Paare', 'Rezeptortypen', 'Lappen']);
    const questions = catalog('homo').filter(q => q.type === 'homo-bodyfact-value');
    expect(questions).toHaveLength(87);
    for (const question of questions) {
      const concept = byId.get(question.entityId);
      const unit = (concept.attributes.unit || '').replace(/\s*\([^)]*\)/g, '').trim();
      const parsed = question.options.map(option => {
        expect(option.endsWith(` ${unit}`)).toBe(true);
        return parseBodyFactValue(option.slice(0, -(unit.length + 1)));
      });
      const precision = option => [...option.matchAll(/\d(?:,([0-9]+))?/g)].map(match => (match[1] || '').length).filter(n => n > 0);
      const optionPrecisions = question.options.map(option => precision(option.slice(0, -(unit.length + 1))));
      expect(new Set(optionPrecisions.map(digits => JSON.stringify(digits))).size).toBe(1);
      for (const value of parsed) {
        expect(value).not.toBeNull();
        expect(value.lower).toBeGreaterThanOrEqual(0);
        if (unit === '%') expect(value.upper).toBeLessThanOrEqual(100);
        if (countUnits.has(unit)) {
          expect(Number.isInteger(value.lower)).toBe(true);
          expect(Number.isInteger(value.upper)).toBe(true);
        }
      }
      for (let i = 0; i < parsed.length; i++) for (let j = i + 1; j < parsed.length; j++) {
        expect(parsed[i].upper < parsed[j].lower || parsed[j].upper < parsed[i].lower).toBe(true);
      }
    }
  });
  it('erzeugt keine Zahlenfrage für Ungleichungen im Katalog', () => {
    const raw = JSON.parse(readFileSync('scripts/data_sources/homo_raw.json', 'utf8'));
    const invalid = new Set(raw.filter(c => c.category === 'body_fact' && !parseBodyFactValue(c.attributes.value)).map(c => `homo:${c.id}`));
    expect(catalog('homo').filter(q => q.type === 'homo-bodyfact-value' && invalid.has(q.entityId))).toEqual([]);
  });
});
describe('Konkrete und überschneidungsfreie Antworten', () => {
  it.each(['Weitere', 'Weitere Werke'])('sperrt Restkategorie %s', value => expect(isSpecificAnswer(value)).toBe(false));
  it.each(['Dramen', 'Briefe und Gespräche', 'Briefe, Gedichte, Sonstige', 'Carl Spitteler (1845-1924)'])('sperrt Sammelwerk %s', work => expect(isSpecificQuoteWork({ attributes: { work, author: 'Carl Spitteler' } })).toBe(false));
  it('behält konkrete Briefsammlungen und Gedichtbände', () => {
    expect(isSpecificQuoteWork({ attributes: { work: 'Briefe an Felice Bauer', author: 'Franz Kafka' } })).toBe(true);
    expect(isSpecificQuoteWork({ attributes: { work: 'Gedichte', author: 'Konkreter Autor' } })).toBe(true);
  });
  it('erkennt eng begrenzte Epochenüberlappungen', () => {
    expect(artworkEraConflict('Barock (Goldenes Zeitalter der Niederlande)', 'Barock')).toBe(true);
    expect(artworkEraConflict('Barock', 'Barock / Holländisches Goldenes Zeitalter')).toBe(true);
    expect(artworkEraConflict('Expressionismus', 'Abstrakter Expressionismus')).toBe(false);
    for (const q of catalog('cultura').filter(q => q.type === 'cultura-artwork-era')) {
      expect(q.options.filter(v => v !== q.correctAnswer).some(v => artworkEraConflict(v, q.correctAnswer))).toBe(false);
    }
  });
  it('erkennt überlappende Tagesintervalle', () => {
    expect(calendarDateConflict('22./23. April', '23. April')).toBe(true);
    expect(calendarDateConflict('22./23. April', '24. April')).toBe(false);
    expect(calendarDateConflict('22./23. April', '23. Mai')).toBe(false);
  });
  it('erkennt Agenturanteile ohne Werte umzuschreiben', () => {
    expect(agencyConflict('NASA', 'NASA/JPL')).toBe(true);
    expect(agencyConflict('ESA/NASA', 'NASA')).toBe(true);
    expect(agencyConflict('ESA', 'NASA/JPL')).toBe(false);
    expect(agencyConflict('NASA', 'Jet Propulsion Laboratory')).toBe(true);
    expect(agencyConflict('ESA', 'Europäische Weltraumorganisation')).toBe(true);
    expect(agencyConflict('CNSA', 'China National Space Administration')).toBe(true);
    expect(agencyConflict('NASA', 'National Aeronautics and Space Administration')).toBe(true);
  });
  it('verhindert Sammelwerksfragen und unbekannte Fertigstellungsjahre im Katalog', () => {
    const raw = JSON.parse(readFileSync('scripts/data_sources/cultura_raw.json', 'utf8'));
    const invalid = new Set(raw.filter(c => c.category === 'quote' && !isSpecificQuoteWork(c)).map(c => `cultura:${c.id}`));
    expect(catalog('cultura').filter(q => ['cultura-quote-work', 'cultura-quote-text'].includes(q.type) && invalid.has(q.entityId))).toEqual([]);
    const unclassifiedYears = new Set(raw.filter(c => c.category === 'architecture' && !['start', 'completion'].includes(c.attributes.yearKind)).map(c => `cultura:${c.id}`));
    expect(catalog('cultura').filter(q => q.type === 'cultura-architecture-year' && unclassifiedYears.has(q.entityId))).toEqual([]);
  });
  it('hält Meteorstrom-Datumsoptionen und Agenturantworten auseinander', () => {
    for (const q of catalog('astra')) {
      const conflict = q.type === 'astra-shower-peak' ? calendarDateConflict : q.type === 'astra-mission-operator' ? agencyConflict : null;
      if (conflict) expect(q.options.filter(v => v !== q.correctAnswer).some(v => conflict(v, q.correctAnswer))).toBe(false);
    }
  });
});
describe('Atomarer Bildwechsel', () => {
  it('bewahrt den Bestand bei fehlendem neuen Credit', () => {
    const existing = { imageFile: 'A', imageLicense: 'CC BY 4.0', imageAttribution: 'Autor A' };
    expect(refreshImageFields(existing, { imageFile: 'B', imageLicense: 'CC BY 4.0' })).toEqual([]);
    expect(existing.imageFile).toBe('A');
    expect(existing.imageAttribution).toBe('Autor A');
  });
  it('ersetzt zusammengehörige Credits und entfernt alte Zusatzangaben', () => {
    const existing = { imageFile: 'A', imageAttribution: 'Autor A', imageLicenseUrl: 'alte Lizenz', imageChanges: 'alte Änderung' };
    refreshImageFields(existing, { imageFile: 'B', imageLicense: 'CC BY 4.0', imageAttribution: 'Autor B' });
    expect(existing).toMatchObject({ imageFile: 'B', imageAttribution: 'Autor B', imageLicenseUrl: '', imageChanges: '' });
  });
});
