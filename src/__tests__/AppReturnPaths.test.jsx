// Rueckwege der App-Shell: Wo landet man nach einer Quizrunde, und was passiert
// mit gespeicherten Werten, die beim Start nicht gelesen werden konnten?
//
// Drei Funde der CodeQA-Kampagne vom 2026-09-10:
//
// 1. `handleQuizFinished` setzte fest auf 'dashboard'. Sieben der neun Bereiche
//    haben einen Explorer, und dort blendet die Kopfzeile den Uebersicht-Knopf
//    aus — nach dem Quiz stand man also auf einem Tab, den das Menue nicht
//    anbietet und der nach dem Verlassen nicht wieder erreichbar ist.
// 2. Schlug `getSetting` beim Start fehl, blieben Bestmarke und Serie auf ihrem
//    Anfangswert 0 — der erste Punktegewinn schrieb diese 0 als neue Wahrheit
//    zurueck und loeschte damit den echten Wert.
// 3. Der Schnelltest-Hinweis („noch keine Quizfrage verfuegbar") ueberlebte den
//    Tabwechsel und verdeckte in der naechsten Ansicht die dauerhafte Warnung
//    ueber nicht gespeicherte Antworten.
//
// Eigener Mock statt Erweiterung von AppOrchestration.test.jsx: Dieser Test
// braucht einen Bereich MIT Explorer, und eine zusaetzliche Domain wuerde dort
// die Erwartungen des Museums-Tests verschieben.

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getSetting, saveSetting } from '../utils/db';

vi.mock('../domains', () => {
  // Alles Gemeinsame steht in der Factory: vi.mock wird an den Dateianfang
  // gezogen, eine Variable von aussen waere dort noch nicht angelegt.
  const basis = {
    latinName: 'Test',
    label: 'Testbereich',
    description: 'Rueckwege',
    accent: '#123456',
    deferDataUntilQuiz: false,
    Icon: () => null,
  };
  // hasMap: Der Hub-Bereich zeigt den Weltatlas, ueber den der Schnelltest laeuft.
  const hub = { ...basis, id: 'scientia', hasMap: true };
  // Ein Bereich mit Explorer — wie astra, homo, natura, lingua, cultura,
  // machina und historia im echten Bestand.
  const mitExplorer = {
    ...basis,
    id: 'astra',
    hasMap: false,
    Explorer: () => <div>Explorer-Ansicht</div>,
  };
  const concepts = {
    target: { id: 'target', type: 'country', name: 'Ziel' },
    // Ohne eigene Frage — loest im Atlas den Schnelltest-Hinweis aus.
    ohne_frage: { id: 'ohne_frage', type: 'city', name: 'Luxemburg' },
  };
  const questions = [{
    id: 'target-question',
    entityId: 'target',
    entityType: 'country',
    type: 'name',
    prompt: 'Testfrage',
    correctAnswer: 'Ziel',
    options: ['Ziel', 'Anders'],
  }];
  return {
    DOMAINS: [hub, mitExplorer],
    getDomainById: id => [hub, mitExplorer].find(item => item.id === id) || hub,
    loadDomainData: () => Promise.resolve([concepts, questions]),
    loadDomainConcepts: vi.fn(() => Promise.resolve(concepts)),
  };
});

vi.mock('../components/DomainSwitcher', () => ({
  default: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect('astra')}>Zu Astra</button>
  ),
}));
vi.mock('../components/ScientiaHub', () => ({ default: () => <div>Test-Hub</div> }));
vi.mock('../components/Dashboard', () => ({ default: () => <div>Dashboard-Ansicht</div> }));
vi.mock('../components/VisualPanel', () => ({ default: ({ mapProps }) => {
  React.useEffect(() => { mapProps.onAvailabilityChange(true); }, [mapProps.onAvailabilityChange]);
  return <div>Visual</div>;
} }));
vi.mock('../components/Atlas', () => ({
  default: ({ onStartQuickQuiz }) => (
    <button type="button" onClick={() => onStartQuickQuiz('ohne_frage')}>Luxemburg testen</button>
  ),
}));
vi.mock('../components/MuseumExplorer', () => ({ default: () => <div>Museum</div> }));
vi.mock('../components/QuizLauncher', () => ({
  default: ({ onStart }) => (
    <button type="button" onClick={() => onStart('all', { kind: 'fixed', length: 10 }, [])}>
      Quiz starten
    </button>
  ),
}));
vi.mock('../components/Quiz', () => ({
  default: ({ onAddScore, onQuizFinished }) => (
    <div>
      <div data-testid="quiz-laeuft" />
      <button type="button" onClick={() => onAddScore(10)}>10 Punkte</button>
      <button type="button" onClick={onQuizFinished}>Runde abschließen</button>
    </div>
  ),
}));

function configureSettings(overrides = {}) {
  getSetting.mockImplementation((key, fallback) => Promise.resolve(
    Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback
  ));
  saveSetting.mockResolvedValue(undefined);
}

/** In den Bereich mit Explorer wechseln und dort eine Quizrunde starten. */
async function quizInExplorerBereich() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Zu Astra' }));
  expect(await screen.findByText('Explorer-Ansicht')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Quiz starten' }));
  await screen.findByTestId('quiz-laeuft');
}

beforeEach(() => {
  vi.clearAllMocks();
  configureSettings();
});
afterEach(cleanup);

describe('Rueckweg nach der Quizrunde', () => {
  it('landet in einem Bereich mit Explorer wieder im Explorer', async () => {
    await quizInExplorerBereich();
    fireEvent.click(screen.getByRole('button', { name: 'Runde abschließen' }));

    // Der Erkundungs-Knopf ist als aktuelle Seite markiert. Vorher stand
    // activeTab auf 'dashboard' — einer Ansicht, deren Knopf die Kopfzeile in
    // diesem Bereich gar nicht rendert. (Das Dashboard selbst bleibt sichtbar:
    // In der Erkundungsansicht steht es rechts neben dem Explorer.)
    expect(await screen.findByText('Explorer-Ansicht')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erkundung' }))
      .toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Übersicht' })).not.toBeInTheDocument();
  });

  it('erreicht jede Ansicht, in der man nach der Runde stehen kann, ueber die Kopfzeile', async () => {
    await quizInExplorerBereich();
    fireEvent.click(screen.getByRole('button', { name: 'Runde abschließen' }));
    await screen.findByText('Explorer-Ansicht');

    const aktiv = screen.getAllByRole('button')
      .filter(knopf => knopf.getAttribute('aria-current') === 'page');
    expect(aktiv.length, 'kein Knopf der Kopfzeile ist als aktiv markiert').toBe(1);
  });
});

describe('Hinweis des Schnelltests', () => {
  it('verschwindet beim Wechsel in eine andere Ansicht', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Weltatlas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Luxemburg testen' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Für Luxemburg ist noch keine Quizfrage verfügbar.');

    fireEvent.click(screen.getByRole('button', { name: 'Übersicht' }));

    // Der Hinweis gehoert zum Schnelltest-Versuch. Blieb er stehen, verdeckte er
    // in der naechsten Ansicht die dauerhafte Warnung ueber nicht gespeicherte
    // Antworten — beide teilen sich dieselbe Meldezeile.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Nicht lesbare Einstellungen', () => {
  it('ueberschreibt eine unlesbare Bestmarke nicht mit dem Sitzungswert', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSetting.mockImplementation((key, fallback) => (
      key === 'highScore'
        ? Promise.reject(new Error('IndexedDB nicht verfügbar'))
        : Promise.resolve(fallback)
    ));
    saveSetting.mockResolvedValue(undefined);

    await quizInExplorerBereich();
    fireEvent.click(screen.getByRole('button', { name: '10 Punkte' }));

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(saveSetting.mock.calls.filter(([key]) => key === 'highScore')).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  it('speichert die Bestmarke wie gewohnt, wenn sie gelesen werden konnte', async () => {
    configureSettings({ highScore: 5 });

    await quizInExplorerBereich();
    fireEvent.click(screen.getByRole('button', { name: '10 Punkte' }));

    await waitFor(() => expect(
      saveSetting.mock.calls.filter(([key]) => key === 'highScore')
    ).toEqual([['highScore', 10]]));
  });

  it('ueberschreibt eine unlesbare Serie nicht mit einer Eins', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSetting.mockImplementation((key, fallback) => (
      key === 'streakCount'
        ? Promise.reject(new Error('IndexedDB nicht verfügbar'))
        : Promise.resolve(fallback)
    ));
    saveSetting.mockResolvedValue(undefined);

    await quizInExplorerBereich();
    fireEvent.click(screen.getByRole('button', { name: 'Runde abschließen' }));
    await screen.findByText('Explorer-Ansicht');

    expect(saveSetting.mock.calls.filter(([key]) => key === 'streakCount')).toEqual([]);
    consoleErrorSpy.mockRestore();
  });
});
