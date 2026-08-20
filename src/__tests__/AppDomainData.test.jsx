import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { resetDomainDataCache, SCIENTIA_MIX_IDS } from '../domains';

/**
 * App-Integrationstest fuer das Laden der Bereichsdaten.
 *
 * Die Blattkomponententests (ScientiaHub, DomainSwitcher, …) rendern jeweils nur
 * ihre eigene Komponente mit fertigen Daten. Genau dazwischen lagen zwei Fehler,
 * die dieser Test festhaelt:
 *
 *  1. Der Startbildschirm ("Hub") zog sofort die Kataloge aller sieben
 *     Sachbereiche (rund 32 MiB JSON), obwohl er nur das kleine
 *     Statistik-Manifest anzeigt.
 *  2. Nach einem Bereichswechsel blieben Fragen und Konzepte des ALTEN Bereichs
 *     bedienbar, bis die neuen Daten ankamen — eine in dieser Luecke gestartete
 *     Runde haette ihren Fortschritt unter der neuen Domain gespeichert.
 *
 * Damit die Ladeluecke ueberhaupt pruefbar ist, ersetzt der Test das global
 * gemockte fetch durch eine Gegenstelle, die jede Anfrage offen laesst, bis der
 * Test sie ausdruecklich beantwortet.
 */

// Gekuerztes Manifest im Format von public/data/domain_stats.json.
const STATS = {
  totals: { questions: 49776, concepts: 13047, images: 5041, domains: 8 },
  domains: {
    terra: { questions: 5116, concepts: 1852, images: 0, hasMap: true },
    astra: { questions: 5055, concepts: 1560, images: 478, hasMap: false },
    homo: { questions: 1600, concepts: 599, images: 306, hasMap: false },
    natura: { questions: 13215, concepts: 2402, images: 1878, hasMap: false },
    lingua: { questions: 4877, concepts: 1207, images: 184, hasMap: false },
    cultura: { questions: 7440, concepts: 2018, images: 1048, hasMap: false },
    machina: { questions: 6141, concepts: 2165, images: 124, hasMap: false },
    historia: { questions: 6332, concepts: 1244, images: 1023, hasMap: false }
  }
};

let requestedUrls;
let openRequests;
let originalFetch;

/** Beantwortet eine offene Anfrage; wirft, wenn sie nie gestellt wurde. */
function respond(url, body) {
  const request = openRequests.get(url);
  if (!request) throw new Error(`Keine offene Anfrage fuer ${url}`);
  openRequests.delete(url);
  request.resolve({ ok: true, json: () => Promise.resolve(body) });
}

/** Beide Kataloge eines Bereichs beantworten (leer reicht fuer den Ladezustand). */
function respondDomain(id, concepts = {}, questions = []) {
  respond(`data/concepts_${id}.json`, concepts);
  respond(`data/questions_${id}.json`, questions);
}

beforeEach(() => {
  resetDomainDataCache();
  requestedUrls = [];
  openRequests = new Map();
  originalFetch = global.fetch;
  global.fetch = vi.fn((url) => new Promise((resolve, reject) => {
    const key = String(url);
    requestedUrls.push(key);
    openRequests.set(key, { resolve, reject });
  }));
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

describe('App — Laden der Bereichsdaten', () => {
  it('laedt auf dem Startbildschirm nur das Statistik-Manifest', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Querbeet/i });

    expect(requestedUrls).toEqual(['data/domain_stats.json']);

    respond('data/domain_stats.json', STATS);
    await screen.findByText('49.776');

    // Auch nach dem Manifest bleibt es bei dieser einen Anfrage: die grossen
    // Kataloge werden auf dem Hub bewusst nicht angefasst.
    expect(requestedUrls).toEqual(['data/domain_stats.json']);
  });

  it('holt den Mischpool erst beim Querbeet-Start und zeigt solange einen Ladehinweis', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Querbeet/i });
    respond('data/domain_stats.json', STATS);
    await screen.findByText('49.776');

    fireEvent.click(screen.getByRole('button', { name: /Querbeet/i }));

    await screen.findAllByText(/Scientia wird geladen/);
    // Solange die Kataloge fehlen, gibt es keinen Startknopf fuer eine Runde.
    expect(screen.queryByRole('button', { name: 'Quiz starten' })).toBeNull();

    // Genau die sieben Sachbereiche des Mischpools, Konzepte und Fragen — Terra
    // gehoert nicht dazu und darf auch nicht mitgeladen werden.
    SCIENTIA_MIX_IDS.forEach(id => {
      expect(requestedUrls).toContain(`data/concepts_${id}.json`);
      expect(requestedUrls).toContain(`data/questions_${id}.json`);
    });
    expect(requestedUrls).not.toContain('data/questions_terra.json');
    expect(requestedUrls).toHaveLength(1 + SCIENTIA_MIX_IDS.length * 2);

    SCIENTIA_MIX_IDS.forEach(id => respondDomain(id));
    await screen.findByRole('button', { name: 'Quiz starten' });
  });

  it('verwendet einen laufenden Querbeet-Download nach einem Tabwechsel weiter', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Querbeet/i });
    respond('data/domain_stats.json', STATS);
    await screen.findByText('49.776');

    fireEvent.click(screen.getByRole('button', { name: /Querbeet/i }));
    await screen.findAllByText(/Scientia wird geladen/);

    // Der Hub darf während des Downloads wieder geöffnet werden. Die Antworten
    // treffen danach im Hintergrund ein und müssen beim zweiten Start im Cache liegen.
    fireEvent.click(screen.getByRole('button', { name: 'Übersicht' }));
    await screen.findByRole('button', { name: /Querbeet/i });
    SCIENTIA_MIX_IDS.forEach(id => respondDomain(id));

    fireEvent.click(screen.getByRole('button', { name: /Querbeet/i }));
    await screen.findByRole('button', { name: 'Quiz starten' });

    SCIENTIA_MIX_IDS.forEach(id => {
      expect(requestedUrls.filter(url => url === `data/concepts_${id}.json`)).toHaveLength(1);
      expect(requestedUrls.filter(url => url === `data/questions_${id}.json`)).toHaveLength(1);
    });
  });

  it('gibt das Quiz nach einem Bereichswechsel erst mit den Daten des neuen Bereichs frei', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Querbeet/i });
    respond('data/domain_stats.json', STATS);
    await screen.findByText('49.776');

    // Erster Bereich: Natura vollstaendig laden.
    fireEvent.click(screen.getByRole('button', { name: /^Natura:/ }));
    await screen.findAllByText(/Natura wird geladen/);
    respondDomain('natura');
    await waitFor(() => expect(screen.queryByText(/Natura wird geladen/)).toBeNull());

    // Bereichswechsel: Lingua ist angefragt, aber noch nicht da.
    fireEvent.click(screen.getByRole('button', { name: /^Wissensbereich wechseln/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Lingua/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
    await screen.findAllByText(/Lingua wird geladen/);
    // Hier lag der Fehler: der Startknopf haette noch mit Naturas Fragen gearbeitet
    // und den Fortschritt unter "lingua" gespeichert.
    expect(screen.queryByRole('button', { name: 'Quiz starten' })).toBeNull();

    // Der gemeinsame Ladevorgang wird erst nach beiden Antworten freigegeben.
    respond('data/concepts_lingua.json', {});
    respond('data/questions_lingua.json', []);
    await screen.findByRole('button', { name: 'Quiz starten' });
  });

  it('meldet einen fehlgeschlagenen Ladeversuch, statt endlos zu laden', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Querbeet/i });
    respond('data/domain_stats.json', STATS);
    await screen.findByText('49.776');

    fireEvent.click(screen.getByRole('button', { name: /^Natura:/ }));
    await screen.findAllByText(/Natura wird geladen/);

    // Serverfehler auf einem der beiden Kataloge.
    openRequests.get('data/concepts_natura.json').resolve({ ok: false, status: 500 });

    await screen.findAllByText(/Natura konnte nicht geladen werden/);
  });

  it('zeigt beim Wechsel keine alten Kennzahlen und erholt sich aus dem Domaincache', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Querbeet/i });
    respond('data/domain_stats.json', STATS);
    await screen.findByText('49.776');

    fireEvent.click(screen.getByRole('button', { name: /^Natura:/ }));
    await screen.findAllByText(/Natura wird geladen/);
    respondDomain(
      'natura',
      { 'natura:wolf': { id: 'natura:wolf', type: 'animal', name: 'Wolf' } },
      [{ id: 'natura-question' }]
    );
    await screen.findByText('1 Fragen');

    fireEvent.click(screen.getByRole('button', { name: /^Wissensbereich wechseln/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Lingua/ }));
    await screen.findAllByText(/Lingua wird geladen/);
    expect(screen.queryByText('1 Fragen')).toBeNull();

    openRequests.get('data/concepts_lingua.json').resolve({ ok: false, status: 500 });
    await screen.findAllByText(/Lingua konnte nicht geladen werden/);

    // Ein weiterer Wechsel darf das alte Lingua-Fehlerflag nicht Cultura zuordnen.
    fireEvent.click(screen.getByRole('button', { name: /^Wissensbereich wechseln/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Cultura/ }));
    await screen.findAllByText(/Cultura wird geladen/);
    expect(screen.queryByText(/Cultura konnte nicht geladen werden/)).toBeNull();

    // Natura ist bereits vollständig gecacht und wird ohne zweiten Fetch restauriert.
    fireEvent.click(screen.getByRole('button', { name: /^Wissensbereich wechseln/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Natura/ }));
    await screen.findByText('1 Fragen');
    expect(requestedUrls.filter(url => url === 'data/concepts_natura.json')).toHaveLength(1);
    expect(requestedUrls.filter(url => url === 'data/questions_natura.json')).toHaveLength(1);
  });
});
