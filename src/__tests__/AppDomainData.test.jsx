import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

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

const MIX_IDS = ['astra', 'homo', 'natura', 'lingua', 'cultura', 'machina', 'historia'];

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
function respondDomain(id) {
  respond(`data/concepts_${id}.json`, {});
  respond(`data/questions_${id}.json`, []);
}

beforeEach(() => {
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

    await screen.findByText(/Scientia wird geladen/);
    // Solange die Kataloge fehlen, gibt es keinen Startknopf fuer eine Runde.
    expect(screen.queryByRole('button', { name: 'Quiz starten' })).toBeNull();

    // Genau die sieben Sachbereiche des Mischpools, Konzepte und Fragen — Terra
    // gehoert nicht dazu und darf auch nicht mitgeladen werden.
    MIX_IDS.forEach(id => {
      expect(requestedUrls).toContain(`data/concepts_${id}.json`);
      expect(requestedUrls).toContain(`data/questions_${id}.json`);
    });
    expect(requestedUrls).not.toContain('data/questions_terra.json');
    expect(requestedUrls).toHaveLength(1 + MIX_IDS.length * 2);

    MIX_IDS.forEach(respondDomain);
    await screen.findByRole('button', { name: 'Quiz starten' });
  });

  it('gibt das Quiz nach einem Bereichswechsel erst mit den Daten des neuen Bereichs frei', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Querbeet/i });
    respond('data/domain_stats.json', STATS);
    await screen.findByText('49.776');

    // Erster Bereich: Natura vollstaendig laden.
    fireEvent.click(screen.getByRole('button', { name: /^Natura:/ }));
    await screen.findByText(/Natura wird geladen/);
    respondDomain('natura');
    await waitFor(() => expect(screen.queryByText(/Natura wird geladen/)).toBeNull());

    // Bereichswechsel: Lingua ist angefragt, aber noch nicht da.
    fireEvent.click(screen.getByRole('button', { name: /^Wissensbereich wechseln/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Lingua/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
    await screen.findByText(/Lingua wird geladen/);
    // Hier lag der Fehler: der Startknopf haette noch mit Naturas Fragen gearbeitet
    // und den Fortschritt unter "lingua" gespeichert.
    expect(screen.queryByRole('button', { name: 'Quiz starten' })).toBeNull();

    // Ein einzelner Katalog reicht nicht — Konzepte UND Fragen muessen vorliegen.
    respond('data/concepts_lingua.json', {});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: 'Quiz starten' })).toBeNull();

    respond('data/questions_lingua.json', []);
    await screen.findByRole('button', { name: 'Quiz starten' });
  });

  it('meldet einen fehlgeschlagenen Ladeversuch, statt endlos zu laden', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Querbeet/i });
    respond('data/domain_stats.json', STATS);
    await screen.findByText('49.776');

    fireEvent.click(screen.getByRole('button', { name: /^Natura:/ }));
    await screen.findByText(/Natura wird geladen/);

    // Serverfehler auf einem der beiden Kataloge.
    openRequests.get('data/concepts_natura.json').resolve({ ok: false, status: 500 });

    await screen.findByText(/Natura konnte nicht geladen werden/);
  });
});
