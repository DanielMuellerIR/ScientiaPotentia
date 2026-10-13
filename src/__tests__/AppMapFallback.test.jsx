import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import maplibregl from 'maplibre-gl';
import App from '../App';
import questions from '../../public/data/questions_terra.json';
import { saveProgressAndLog } from '../utils/db';

vi.mock('../domains', async importOriginal => {
  const original = await importOriginal();
  const { default: catalog } = await import('../../public/data/questions_terra.json');
  const { default: geodb } = await import('../data/geodb.json');
  const region = catalog.find(question => question.id === 'q_AU-WA_statematch');
  return {
    ...original,
    loadDomainData: () => Promise.resolve([geodb.entities, [region]]),
  };
});

afterEach(cleanup);

it('bietet eine echte Regionsfrage nach einem Geometriefehler nicht mehr an', async () => {
  vi.clearAllMocks();
  const createMap = maplibregl.Map.getMockImplementation();
  maplibregl.Map.mockImplementationOnce(function (options) {
    const map = new createMap(options);
    map.isSourceLoaded = vi.fn(id => id !== 'subdivisions');
    return map;
  });
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Quiz', exact: true }));
  await screen.findByText('Kartenfähigkeit wird geprüft …');
  await waitFor(() => expect(maplibregl.Map).toHaveBeenCalled());
  const map = maplibregl.Map.mock.results.at(-1).value;
  const onError = map.on.mock.calls.find(([event]) => event === 'error')[1];
  act(() => onError({ sourceId: 'subdivisions', error: new Error('Geometrie fehlt') }));
  const start = screen.queryByRole('button', { name: 'Quiz starten' });
  if (start && !start.disabled) fireEvent.click(start);
  const region = questions.find(question => question.id === 'q_AU-WA_statematch');
  expect(screen.queryByText(region.prompt)).not.toBeInTheDocument();
  expect(saveProgressAndLog).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Quiz starten' })).not.toBeInTheDocument();
});
