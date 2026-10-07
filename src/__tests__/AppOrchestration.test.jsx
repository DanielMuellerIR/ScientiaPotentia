import React from 'react';
import {
  cleanup, fireEvent, render, screen, waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getSetting, saveSetting, saveSettings, getAllProgress } from '../utils/db';
import { loadDomainConcepts } from '../domains';

const mapReadiness = vi.hoisted(() => ({ delayed: false }));

vi.mock('../domains', () => {
  const domain = {
    id: 'scientia',
    latinName: 'Scientia',
    label: 'Testbereich',
    description: 'Orchestrierungstest',
    accent: '#123456',
    hasMap: true,
    deferDataUntilQuiz: false,
    Icon: () => null,
  };
  const museumDomains = [
    { ...domain, id: 'natura', latinName: 'Natura', hasMap: false },
    { ...domain, id: 'cultura', latinName: 'Cultura', hasMap: false },
  ];
  const concepts = {
    target: { id: 'target', type: 'country', name: 'Ziel' },
    city_LU_luxemburg: { id: 'city_LU_luxemburg', type: 'city', name: 'Luxemburg' },
    city_DJ_dschibuti: { id: 'city_DJ_dschibuti', type: 'city', name: 'Dschibuti' },
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
    DOMAINS: [domain, ...museumDomains],
    getDomainById: id => [domain, ...museumDomains].find(item => item.id === id) || domain,
    loadDomainData: () => Promise.resolve([concepts, questions]),
    loadDomainConcepts: vi.fn(() => Promise.resolve(concepts)),
  };
});

vi.mock('../components/DomainSwitcher', () => ({
  default: () => <div>Bereichsschalter</div>,
}));
vi.mock('../components/ScientiaHub', () => ({
  default: () => <div>Test-Hub</div>,
}));
vi.mock('../components/VisualPanel', () => ({
  default: ({ mapProps }) => {
    React.useEffect(() => {
      if (!mapReadiness.delayed) mapProps.onAvailabilityChange(true);
    }, [mapProps.onAvailabilityChange]);
    return <>
      <button type="button" onClick={() => mapProps.onSelectEntity('target')}>Ziel wählen</button>
      <button type="button" onClick={() => mapProps.onAvailabilityChange(false)}>Ohne WebGL fortsetzen</button>
    </>;
  },
}));
vi.mock('../components/Atlas', () => ({
  default: ({ onStartQuickQuiz }) => (
    <div>
      <button type="button" onClick={() => onStartQuickQuiz('target')}>Schnelltest starten</button>
      <button type="button" onClick={() => onStartQuickQuiz('city_LU_luxemburg')}>Luxemburg testen</button>
      <button type="button" onClick={() => onStartQuickQuiz('city_DJ_dschibuti')}>Dschibuti testen</button>
    </div>
  ),
}));
vi.mock('../components/QuizLauncher', () => ({
  default: ({ onStart }) => (
    <button
      type="button"
      onClick={() => onStart('all', { kind: 'fixed', length: 10 }, [])}
    >
      Quiz starten
    </button>
  ),
}));
vi.mock('../components/Quiz', () => ({
  default: ({ dueEntities, entityFilterId, onAddScore, onQuizFinished, onQuizRestart,
    onTrackProgressWrite, roundConfig, isPaused }) => (
    <div>
      <div data-testid="round-config">{JSON.stringify(roundConfig)}</div>
      <div data-testid="due-ids">{dueEntities.map(entity => entity.id).join(',')}</div>
      <div data-testid="entity-filter">{entityFilterId || ''}</div>
      <button type="button" disabled={isPaused} onClick={() => onAddScore(10)}>10 Punkte</button>
      <button type="button" onClick={onQuizRestart}>Erneut</button>
      <button type="button" onClick={() => {
        onTrackProgressWrite(Promise.reject(new Error('Antwort-Commit fehlgeschlagen')));
        onQuizFinished();
      }}>Fehlerhaft speichern und abschließen</button>
      <button type="button" onClick={onQuizFinished}>Runde abschließen</button>
    </div>
  ),
}));
vi.mock('../components/Dashboard', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('../components/MuseumExplorer', () => ({
  default: ({ allDomainData, loadFailed, loading }) => (
    <div data-testid="museum-state">
      {loading ? 'lädt' : 'bereit'}|{loadFailed ? 'Fehler' : 'ok'}|
      {Object.keys(allDomainData).sort().join(',')}
    </div>
  ),
}));

function configureSettings(overrides = {}) {
  getSetting.mockImplementation((key, fallback) => Promise.resolve(
    Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback
  ));
  saveSetting.mockResolvedValue(undefined);
}

async function openQuiz() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Quiz starten' }));
  await screen.findByTestId('round-config');
}

beforeEach(() => {
  mapReadiness.delayed = false;
  vi.clearAllMocks();
  configureSettings();
  getAllProgress.mockResolvedValue([]);
  loadDomainConcepts.mockImplementation(domain => Promise.resolve({
    [`${domain.id}:concept`]: { id: `${domain.id}:concept`, type: 'test' },
  }));
});

afterEach(cleanup);

describe('App-Orchestrierung', () => {
  it('gibt das Quiz erst nach geklärter Kartenfähigkeit frei', async () => {
    mapReadiness.delayed = true;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
    await screen.findByText('Kartenfähigkeit wird geprüft …');
    expect(screen.queryByRole('button', { name: 'Quiz starten' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ohne WebGL fortsetzen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quiz starten' }));
    expect(await screen.findByRole('button', { name: '10 Punkte' })).toBeEnabled();
  });
  it('sperrt das Quiz vor dem Fortschritts-Reload beim Verlassen', async () => {
    await openQuiz();
    let releaseRead;
    getAllProgress.mockImplementationOnce(() => new Promise(resolve => { releaseRead = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Übersicht' }));
    await waitFor(() => expect(releaseRead).toBeDefined());
    const answer = screen.getByRole('button', { name: '10 Punkte' });
    expect(answer).toBeDisabled();
    fireEvent.click(answer);
    expect(saveSetting).not.toHaveBeenCalledWith('highScore', 10);
    releaseRead([{ entityId: 'target', repetitions: 1, nextDueDate: 0 }]);
    await screen.findByText('Test-Hub');
    fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quiz starten' }));
    expect(await screen.findByTestId('due-ids')).toHaveTextContent('target');
  });
  it('holt frühe Bestmarken und Serienabschlüsse nach dem Lesen nach', async () => {
    let resolveStreak;
    let resolveHighScore;
    let initialStreak = true;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    getSetting.mockImplementation((key, fallback) => {
      if (key === 'streakCount') {
        if (initialStreak) {
          initialStreak = false;
          return new Promise(resolve => { resolveStreak = resolve; });
        }
        return Promise.resolve(27);
      }
      if (key === 'highScore') return new Promise(resolve => { resolveHighScore = resolve; });
      if (key === 'lastReviewDate') return Promise.resolve(yesterday.toDateString());
      return Promise.resolve(fallback);
    });
    await openQuiz();
    fireEvent.click(screen.getByRole('button', { name: '10 Punkte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Erneut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Runde abschließen' }));
    expect(saveSetting).not.toHaveBeenCalledWith('lastReviewDate', expect.anything());
    expect(saveSetting).not.toHaveBeenCalledWith('streakCount', expect.anything());
    expect(saveSettings).not.toHaveBeenCalled();
    expect(saveSetting).not.toHaveBeenCalledWith('highScore', expect.anything());
    resolveStreak(27);
    resolveHighScore(5);
    await screen.findByText('Test-Hub');
    await waitFor(() => expect(saveSetting).toHaveBeenCalledWith('highScore', 10));
    expect(screen.getByLabelText('Bestmarke: 10')).toBeInTheDocument();
    expect(saveSettings).toHaveBeenCalledWith({ streakCount: 28, lastReviewDate: expect.any(String) });
  });

  it('führt den Rundenpunktestand synchron und persistiert nur die Bestmarke', async () => {
    await openQuiz();

    fireEvent.click(screen.getByRole('button', { name: '10 Punkte' }));
    fireEvent.click(screen.getByRole('button', { name: '10 Punkte' }));

    await waitFor(() => expect(screen.getByLabelText('Bestmarke: 20')).toBeInTheDocument());
    expect(getSetting).not.toHaveBeenCalledWith('activeScore', expect.anything());
    expect(saveSetting).not.toHaveBeenCalledWith('activeScore', expect.anything());
    expect(saveSetting).toHaveBeenCalledWith('highScore', 20);

    fireEvent.click(screen.getByRole('button', { name: 'Erneut' }));
    fireEvent.click(screen.getByRole('button', { name: '10 Punkte' }));
    expect(screen.getByLabelText('Bestmarke: 20')).toBeInTheDocument();
    expect(saveSetting).not.toHaveBeenCalledWith('highScore', 30);
  });

  it('beschränkt den Atlas-Schnelltest auf das gewählte Konzept und eine Frage', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Weltatlas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ziel wählen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schnelltest starten' }));

    expect(await screen.findByTestId('round-config')).toHaveTextContent(
      JSON.stringify({ kind: 'fixed', length: 1 })
    );
    expect(screen.getByTestId('due-ids')).toHaveTextContent('target');
    expect(screen.getByTestId('entity-filter')).toHaveTextContent('target');
  });

  it.each([
    ['Luxemburg testen', 'Luxemburg'],
    ['Dschibuti testen', 'Dschibuti'],
  ])('startet für verwaiste Terra-Städte keine fremde Frage: %s', async (button, city) => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Weltatlas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ziel wählen' }));
    fireEvent.click(screen.getByRole('button', { name: button }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      `Für ${city} ist noch keine Quizfrage verfügbar.`);
    expect(screen.queryByTestId('round-config')).not.toBeInTheDocument();
  });

  it('zeigt einen späten Antwort-Commitfehler auch nach dem Aushängen des Quiz', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openQuiz();
    fireEvent.click(screen.getByRole('button', { name: 'Fehlerhaft speichern und abschließen' }));

    expect(await screen.findByText('Test-Hub')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Mindestens eine Antwort konnte nicht im Lernfortschritt gespeichert werden.');
    consoleErrorSpy.mockRestore();
  });

  it('kehrt auch bei einem Streak-Speicherfehler aus der Ergebnisansicht zurück', async () => {
    let lastReviewReads = 0;
    getSetting.mockImplementation((key, fallback) => {
      if (key !== 'lastReviewDate') return Promise.resolve(fallback);
      lastReviewReads += 1;
      return lastReviewReads === 1
        ? Promise.resolve(null)
        : Promise.reject(new Error('IndexedDB nicht verfügbar'));
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openQuiz();

    fireEvent.click(screen.getByRole('button', { name: 'Runde abschließen' }));

    expect(await screen.findByText('Test-Hub')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error finishing quiz:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('speichert das Abschlussdatum als lokales ISO-8601-Datum', async () => {
    await openQuiz();
    fireEvent.click(screen.getByRole('button', { name: 'Runde abschließen' }));

    await screen.findByText('Test-Hub');
    const dateWrite = saveSettings.mock.calls.at(-1)?.[0].lastReviewDate;
    expect(dateWrite).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('liest das bisherige Date.toDateString-Format für den Streak weiter', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    configureSettings({
      streakCount: 4,
      lastReviewDate: yesterday.toDateString(),
    });

    render(<App />);

    expect(await screen.findByLabelText('Streak: 4 Tage')).toBeInTheDocument();
    expect(saveSetting).not.toHaveBeenCalledWith('streakCount', 0);
  });

  it('behält Museum-Teildaten und lädt eine fehlgeschlagene Domain später nach', async () => {
    loadDomainConcepts.mockImplementation(domain => (
      domain.id === 'cultura'
        ? Promise.reject(new Error('vorübergehend nicht erreichbar'))
        : Promise.resolve({ 'natura:concept': { id: 'natura:concept', type: 'test' } })
    ));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Museum' }));

    await waitFor(() => expect(screen.getByTestId('museum-state')).toHaveTextContent(
      'bereit|ok|natura'
    ));
    expect(screen.getByTestId('museum-state')).not.toHaveTextContent('cultura');

    fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
    loadDomainConcepts.mockImplementation(domain => Promise.resolve({
      [`${domain.id}:concept`]: { id: `${domain.id}:concept`, type: 'test' },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Museum' }));

    await waitFor(() => expect(screen.getByTestId('museum-state')).toHaveTextContent(
      'bereit|ok|cultura,natura'
    ));
    expect(loadDomainConcepts.mock.calls.filter(([domain]) => domain.id === 'cultura'))
      .toHaveLength(2);
  });
});
