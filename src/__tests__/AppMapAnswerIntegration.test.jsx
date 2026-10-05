// App, Quiz und QuizLauncher laufen echt; nur Karte, Daten und Persistenz sind Testdoppel.
import React from 'react';
import {
  cleanup, fireEvent, render, screen, waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { getSetting, saveSetting, getAllProgress, saveProgressAndLog } from '../utils/db';

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
    type: 'click-map',
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
      mapProps.onAvailabilityChange(true);
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
vi.mock('../components/Dashboard', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('../components/MuseumExplorer', () => ({
  default: ({ allDomainData, loadFailed, loading }) => (
    <div data-testid="museum-state">
      {loading ? 'lädt' : 'bereit'}|{loadFailed ? 'Fehler' : 'ok'}|
      {Object.keys(allDomainData).sort().join(',')}
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getSetting.mockImplementation((key, fallback) => Promise.resolve(fallback));
  getAllProgress.mockResolvedValue([]);
});
afterEach(cleanup);

it('wertet Kartenklicks erst nach dem Start der echten Quizrunde aus', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
  const start = await screen.findByRole('button', { name: 'Quiz starten' });
  fireEvent.click(screen.getByRole('button', { name: 'Ziel wählen' }));
  fireEvent.click(start);
  await screen.findByText('Testfrage');
  // Alle Effekte der gestarteten Runde abwarten: ein alter Klick dürfte sonst
  // bereits Fortschritt und Bestmarke buchen, bevor eine Antwort erfolgt.
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Quiz starten' })).not.toBeInTheDocument());
  expect(saveProgressAndLog).not.toHaveBeenCalled();
  expect(saveSetting.mock.calls.filter(([key]) => key === 'highScore')).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Ziel wählen' }));
  await waitFor(() => expect(saveProgressAndLog).toHaveBeenCalledTimes(1));
  expect(saveProgressAndLog.mock.calls[0][3]).toMatchObject({ correct: true, attempts: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
  await screen.findByRole('button', { name: 'Quiz starten' });
  fireEvent.click(screen.getByRole('button', { name: 'Ziel wählen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Quiz starten' }));
  await screen.findByText('Testfrage');
  expect(saveProgressAndLog).toHaveBeenCalledTimes(1);
});
