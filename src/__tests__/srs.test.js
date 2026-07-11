import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateSRS, mapBinaryToQuality, QUALITY } from '../utils/srs';

// Unit-Tests fuer die SM-2-Kernlogik (Spaced Repetition). Die Lern-Mathematik
// war bisher komplett ungetestet — diese Tests fixieren die Intervall-
// Progression, die Easiness-Formel samt 1.3-Untergrenze, den Reset bei
// falschen Antworten und das Faelligkeits-Datum (Mitternacht des Zieltags).

// Fester Zeitpunkt, damit nextDueDate deterministisch pruefbar ist.
const FIXED_NOW = new Date('2026-07-11T15:30:00');

// Erwarteter Timestamp: Mitternacht (lokal) "days" Tage nach FIXED_NOW.
function midnightInDays(days) {
  const d = new Date(FIXED_NOW);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateSRS — Intervall-Progression bei korrekten Antworten', () => {
  it('neues Konzept (null-State): erste korrekte Antwort -> 1 Tag, repetitions 1', () => {
    const result = calculateSRS(null, QUALITY.CORRECT_EASY);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.nextDueDate).toBe(midnightInDays(1));
  });

  it('zweite korrekte Antwort -> fest 6 Tage', () => {
    const first = calculateSRS(null, QUALITY.CORRECT_EASY);
    const second = calculateSRS(first, QUALITY.CORRECT_EASY);
    expect(second.repetitions).toBe(2);
    expect(second.interval).toBe(6);
    expect(second.nextDueDate).toBe(midnightInDays(6));
  });

  it('ab der dritten Antwort waechst das Intervall mit dem Easiness-Faktor', () => {
    // Nach zwei perfekten Antworten: EF = 2.5 + 0.1 + 0.1 = 2.7, Intervall 6.
    const state = { repetitions: 2, interval: 6, easiness: 2.7 };
    const result = calculateSRS(state, QUALITY.CORRECT_EASY);
    // round(6 * 2.7) = 16 — WICHTIG: SM-2 nutzt den EF VOR der Anpassung.
    expect(result.interval).toBe(16);
    expect(result.repetitions).toBe(3);
    expect(result.nextDueDate).toBe(midnightInDays(16));
  });

  it('CORRECT_HARD (q=3) zaehlt als Erfolg, senkt aber den Easiness-Faktor', () => {
    const state = { repetitions: 2, interval: 6, easiness: 2.5 };
    const result = calculateSRS(state, QUALITY.CORRECT_HARD);
    expect(result.repetitions).toBe(3);
    // EF' = 2.5 + (0.1 - 2 * (0.08 + 2*0.02)) = 2.5 - 0.14 = 2.36
    expect(result.easiness).toBeCloseTo(2.36, 10);
  });
});

describe('calculateSRS — Reset bei falschen Antworten (q < 3)', () => {
  it.each([QUALITY.BLACKOUT, QUALITY.INCORRECT_EASY, QUALITY.INCORRECT_HARD])(
    'quality %i setzt repetitions auf 0 und das Intervall auf 1 Tag',
    (quality) => {
      const state = { repetitions: 5, interval: 40, easiness: 2.5 };
      const result = calculateSRS(state, quality);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
      expect(result.nextDueDate).toBe(midnightInDays(1));
    }
  );

  it('falsche Antwort senkt trotzdem den Easiness-Faktor', () => {
    const state = { repetitions: 5, interval: 40, easiness: 2.5 };
    const result = calculateSRS(state, QUALITY.BLACKOUT);
    // EF' = 2.5 + (0.1 - 5 * (0.08 + 5*0.02)) = 2.5 - 0.8 = 1.7
    expect(result.easiness).toBeCloseTo(1.7, 10);
  });
});

describe('calculateSRS — Easiness-Faktor', () => {
  it('perfekte Antwort (q=5) erhoeht den EF um 0.1', () => {
    const result = calculateSRS({ repetitions: 1, interval: 1, easiness: 2.5 }, 5);
    expect(result.easiness).toBeCloseTo(2.6, 10);
  });

  it('q=4 laesst den EF unveraendert', () => {
    // EF' = EF + (0.1 - 1 * (0.08 + 0.02)) = EF + 0
    const result = calculateSRS({ repetitions: 1, interval: 1, easiness: 2.5 }, 4);
    expect(result.easiness).toBeCloseTo(2.5, 10);
  });

  it('EF faellt nie unter die 1.3-Untergrenze', () => {
    let state = { repetitions: 0, interval: 1, easiness: 1.3 };
    // Wiederholte Blackouts duerfen den Floor nicht unterschreiten.
    for (let i = 0; i < 5; i++) {
      state = calculateSRS(state, QUALITY.BLACKOUT);
      expect(state.easiness).toBe(1.3);
    }
  });
});

describe('calculateSRS — Eingabe-Robustheit', () => {
  it('klemmt quality auf den Bereich 0..5 und rundet ab', () => {
    const high = calculateSRS(null, 99);   // wie q=5
    expect(high.easiness).toBeCloseTo(2.6, 10);
    const low = calculateSRS(null, -3);    // wie q=0
    expect(low.repetitions).toBe(0);
    const frac = calculateSRS(null, 4.9);  // floor -> q=4, EF bleibt 2.5
    expect(frac.easiness).toBeCloseTo(2.5, 10);
  });

  it('nextDueDate liegt immer auf Mitternacht (lokal)', () => {
    const result = calculateSRS(null, QUALITY.CORRECT_EASY);
    const due = new Date(result.nextDueDate);
    expect(due.getHours()).toBe(0);
    expect(due.getMinutes()).toBe(0);
    expect(due.getSeconds()).toBe(0);
  });
});

describe('mapBinaryToQuality — Klick-Antworten auf SM-2-Qualitaet abbilden', () => {
  it('korrekt: 1./2./3. Versuch -> EASY/MEDIUM/HARD', () => {
    expect(mapBinaryToQuality(true, 1)).toBe(QUALITY.CORRECT_EASY);
    expect(mapBinaryToQuality(true, 2)).toBe(QUALITY.CORRECT_MEDIUM);
    expect(mapBinaryToQuality(true, 3)).toBe(QUALITY.CORRECT_HARD);
    expect(mapBinaryToQuality(true, 7)).toBe(QUALITY.CORRECT_HARD);
  });

  it('falsch: unter 3 Versuchen INCORRECT_HARD, ab 3 BLACKOUT', () => {
    expect(mapBinaryToQuality(false, 1)).toBe(QUALITY.INCORRECT_HARD);
    expect(mapBinaryToQuality(false, 2)).toBe(QUALITY.INCORRECT_HARD);
    expect(mapBinaryToQuality(false, 3)).toBe(QUALITY.BLACKOUT);
  });

  it('Default-Versuchszahl ist 1 (perfekte Antwort)', () => {
    expect(mapBinaryToQuality(true)).toBe(QUALITY.CORRECT_EASY);
  });

  it('jede Abbildung landet konsistent im calculateSRS-Erfolgs-/Fehlerpfad', () => {
    // Korrekte Antworten (jede Versuchszahl) muessen als Erfolg zaehlen,
    // falsche als Reset — sonst wuerde die Quiz-Anbindung das SRS verfaelschen.
    for (let attempts = 1; attempts <= 4; attempts++) {
      const ok = calculateSRS(null, mapBinaryToQuality(true, attempts));
      expect(ok.repetitions).toBe(1);
      const fail = calculateSRS({ repetitions: 3, interval: 15, easiness: 2.5 },
        mapBinaryToQuality(false, attempts));
      expect(fail.repetitions).toBe(0);
    }
  });
});
