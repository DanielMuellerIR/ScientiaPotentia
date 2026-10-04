import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Quiz from '../components/Quiz';
import { getProgress, saveProgressAndLog } from '../utils/db';

const pool = Array.from({ length: 60 }, (_, i) => ({
  id: `q${i}`, entityId: `entity${i}`, entityType: ['city', 'country', 'river'][i % 3],
  type: 'name', prompt: `Frage ${i}`, correctAnswer: `Antwort ${i}`, options: [`Antwort ${i}`, `Falsch ${i}`],
}));
const db = { entities: Object.fromEntries(pool.map(q => [q.entityId, { id: q.entityId, name: q.correctAnswer, type: q.entityType }])) };
const onMap = vi.fn();
afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => {
  getProgress.mockResolvedValue(null);
  saveProgressAndLog.mockResolvedValue(undefined);
});
function props(extra = {}) { return { geodb: db, questionPool: pool, onSetQuizState: onMap, ...extra }; }
function answerCurrent(wrong = false) {
  const prompt = screen.getByRole('heading', { level: 3 }).textContent;
  const i = Number(prompt.split(' ')[1]);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${wrong ? 'Falsch' : 'Antwort'} ${i}$`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
}

describe('Rundenvertrag', () => {
  it('wartet beim Rundenwechsel auf Schreibvorgänge und verhindert doppelte Aktionen', async () => {
    let releaseFlush;
    const flush = vi.fn(() => new Promise(resolve => { releaseFlush = resolve; }));
    const finish = vi.fn();
    render(<Quiz {...props({ questionPool: pool.slice(0, 1), onFlushProgressWrites: flush, onQuizFinished: finish })} />);
    answerCurrent();
    fireEvent.click(screen.getByRole('button', { name: 'Fortfahren' }));
    expect(screen.getByRole('button', { name: 'Fortfahren' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Erneut' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fortfahren' }));
    expect(flush).toHaveBeenCalledTimes(1);
    expect(finish).not.toHaveBeenCalled();
    releaseFlush();
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
  });
  it.each([1, 12])('füllt SLF auch mit nur einer vorhandenen Kategorie (%i Fragen)', size => {
    const countries = pool.slice(0, size).map(q => ({ ...q, entityType: 'country' }));
    render(<Quiz {...props({ questionPool: countries, quizMode: 'stadt-land-fluss' })} />);
    expect(screen.getByText(`FRAGE 1 VON ${Math.min(10, size)}`)).toBeInTheDocument();
    for (let i = 0; i < Math.min(10, size); i++) answerCurrent();
    expect(screen.getByText('Runde beendet!')).toBeInTheDocument();
  });
  it.each(['all', 'stadt-land-fluss'])('verteilt einen kleinen Pool im Modus %s fair', quizMode => {
    render(<Quiz {...props({ questionPool: pool.slice(0, 4), quizMode, players: ['A','B','C'] })} />);
    expect(screen.getByText('FRAGE 1 VON 3')).toBeInTheDocument();
    for (let i = 0; i < 3; i++) answerCurrent();
    expect(screen.getAllByText('1 richtig')).toHaveLength(3);
  });
  it('sperrt Antworten während eines Ansichtswechsels', () => {
    render(<Quiz {...props({ isPaused: true })} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.every(button => button.disabled)).toBe(true);
    fireEvent.click(buttons[0]);
    expect(screen.queryByRole('button', { name: 'Weiter' })).not.toBeInTheDocument();
    expect(saveProgressAndLog).not.toHaveBeenCalled();
  });
  it('berechnet wiederholte Konzepte erst nach dem vorherigen Schreibabschluss', async () => {
    let state = null;
    let releaseWrite;
    getProgress.mockImplementation(async () => state);
    saveProgressAndLog.mockImplementationOnce(async (_id, next) => {
      await new Promise(resolve => { releaseWrite = resolve; });
      state = next;
    });
    const repeated = pool.slice(0, 2).map(q => ({ ...q, entityId: 'entity0' }));
    render(<Quiz {...props({ questionPool: repeated })} />);
    answerCurrent();
    await waitFor(() => expect(saveProgressAndLog).toHaveBeenCalledTimes(1));
    answerCurrent();
    expect(getProgress).toHaveBeenCalledTimes(1);
    releaseWrite();
    await waitFor(() => expect(saveProgressAndLog).toHaveBeenCalledTimes(2));
    expect(saveProgressAndLog.mock.calls[1][1]).toMatchObject({ repetitions: 2, interval: 6 });
  });
  it.each([10, 25, 50])('spielt im Stadt–Land–Fluss-Modus %i Fragen', length => {
    render(<Quiz {...props({ quizMode: 'stadt-land-fluss', roundConfig: { kind: 'fixed', length } })} />);
    expect(screen.getByText(`FRAGE 1 VON ${length}`)).toBeInTheDocument();
    for (let i = 0; i < length; i++) answerCurrent();
    expect(screen.getByText('Runde beendet!')).toBeInTheDocument();
  });
  it('verteilt Stadt–Land–Fluss gleichmäßig auf vier Spieler', () => {
    render(<Quiz {...props({ quizMode: 'stadt-land-fluss', roundConfig: { kind: 'fixed', length: 10 }, players: ['A','B','C','D'] })} />);
    expect(screen.getByText('FRAGE 1 VON 12')).toBeInTheDocument();
    for (let i = 0; i < 12; i++) answerCurrent();
    expect(screen.getAllByText('3 richtig')).toHaveLength(4);
  });
  it('beendet Überleben erst nach verbrauchten Leben', () => {
    render(<Quiz {...props({ quizMode: 'stadt-land-fluss', roundConfig: { kind: 'survival', lives: 3 } })} />);
    for (let i = 0; i < 7; i++) answerCurrent();
    expect(screen.getByText('FRAGE 8')).toBeInTheDocument();
    for (let i = 0; i < 3; i++) answerCurrent(true);
    expect(screen.getByText('Aus!')).toBeInTheDocument();
  });
  it('behält eine laufende Runde bei später eintreffendem Fortschritt', () => {
    const base = props({ roundConfig: { kind: 'fixed', length: 10 }, dueEntities: [], newEntities: [] });
    const { rerender } = render(<Quiz {...base} />);
    answerCurrent();
    rerender(<Quiz {...base} dueEntities={[db.entities.entity0]} newEntities={[db.entities.entity1]} />);
    expect(screen.getByText('FRAGE 2 VON 10')).toBeInTheDocument();
    expect(screen.getByText('Punkte: 10')).toBeInTheDocument();
  });
  it('verwirft Kartenklicks nach einer beantworteten Frage', () => {
    const mapPool = pool.slice(0, 2).map(q => ({ ...q, entityType: 'country', type: 'click-map', options: [] }));
    function Harness() {
      const [clicked, setClicked] = useState(null);
      return <><button onClick={() => setClicked(mapPool[0].entityId)}>Karte 0</button><button onClick={() => setClicked(mapPool[1].entityId)}>Karte 1</button>
        <Quiz {...props({ questionPool: mapPool })} clickedMapId={clicked} resetClickedMapId={() => setClicked(null)} /></>;
    }
    render(<Harness />);
    const current = Number(screen.getByRole('heading', { level: 3 }).textContent.split(' ')[1]);
    fireEvent.click(screen.getByRole('button', { name: `Karte ${current}` }));
    fireEvent.click(screen.getByRole('button', { name: `Karte ${1-current}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.queryByRole('button', { name: 'Weiter' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Versuch:/)).not.toBeInTheDocument();
    expect(screen.getByText('Punkte: 10')).toBeInTheDocument();
  });
  it('übt gezielt nur die verfehlten Fragen und startet ohne alte Leben/Punkte', async () => {
    render(<Quiz {...props({ questionPool: pool.slice(0, 3), roundConfig: { kind: 'survival', lives: 3 } })} />);
    answerCurrent();
    const missedPrompt = screen.getByRole('heading', { level: 3 }).textContent;
    answerCurrent(true);
    answerCurrent();
    expect(screen.getByText('Runde beendet!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fehler üben (1)' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(missedPrompt));
    expect(screen.getByText('WIEDERHOLUNG · FRAGE 1 VON 1')).toBeInTheDocument();
    expect(screen.getByText('Punkte: 0')).toBeInTheDocument();
    expect(screen.queryByLabelText(/von 3 Leben/)).not.toBeInTheDocument();
    answerCurrent();
    expect(screen.getByText('Wiederholung beendet!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fehler üben/ })).not.toBeInTheDocument();
  });

});
