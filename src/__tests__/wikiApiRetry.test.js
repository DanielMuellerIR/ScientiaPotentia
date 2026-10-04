import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { fetchWikiJson, fetchWithRetry } = require('../../scripts/lib/commons_api.cjs');
const { createApiGuard } = require('../../scripts/data_sources/harvest/api_guard.cjs');
afterEach(() => vi.unstubAllGlobals());
const lag = () => new Response(JSON.stringify({ error: { code: 'maxlag', info: 'Replica lagged' } }));
it('wiederholt HTTP-200-maxlag und setzt den Wächter erst nach einer gültigen Antwort zurück', async () => {
  const guard = createApiGuard();
  const fetch = vi.fn().mockResolvedValueOnce(lag()).mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: {} } })));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchWikiJson('https://example.invalid', { apiGuard: guard, maxlagDelayMs: 0 })).toEqual({ query: { pages: {} } });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(guard.total).toBe(1);
  expect(guard.consecutive).toBe(0);
});
it('begrenzt fortgesetzten Replikationsverzug und meldet ihn statt eines leeren Ergebnisses', async () => {
  const guard = createApiGuard();
  const fetch = vi.fn().mockImplementation(async () => lag());
  vi.stubGlobal('fetch', fetch);
  await expect(fetchWikiJson('https://example.invalid', { apiGuard: guard, maxlagAttempts: 3, maxlagDelayMs: 0 })).rejects.toThrow('maxlag');
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(guard.consecutive).toBe(3);
});

it('begrenzt auch einen hängenden JSON-Body und wiederholt die ganze Anfrage', async () => {
  let signal;
  const fetch = vi.fn().mockImplementationOnce(async (_url, options) => {
    signal = options.signal;
    return { ok: true, status: 200, headers: new Headers(), json: () => new Promise(() => {}) };
  }).mockResolvedValueOnce(new Response('{"query":{}}'));
  vi.stubGlobal('fetch', fetch);
  const result = fetchWikiJson('https://example.invalid', { requestOptions: { timeoutMs: 10, attempts: 2, baseDelayMs: 0 } });
  expect(await Promise.race([result, new Promise((_, reject) => setTimeout(() => reject(new Error('Body blieb hängen')), 250))])).toEqual({ query: {} });
  expect(signal.aborted).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('begrenzt einen hängenden Binärbody und bricht nach der Versuchsgrenze ab', async () => {
  const signals = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, { signal }) => {
    signals.push(signal);
    return { ok: true, status: 200, headers: new Headers(), arrayBuffer: () => new Promise(() => {}) };
  }));
  await expect(fetchWithRetry('https://example.invalid', {
    consume: response => response.arrayBuffer(), timeoutMs: 10, attempts: 2, baseDelayMs: 0,
  })).rejects.toThrow(/Zeitüberschreitung/);
  expect(signals).toHaveLength(2);
  expect(signals.every(signal => signal.aborted)).toBe(true);
});
it('zählt einen HTTP-Fehler weiter als API-Abweisung statt dessen Body zu dekodieren', async () => {
  const guard = createApiGuard();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('kein JSON', { status: 403 })));
  await expect(fetchWikiJson('https://example.invalid', { apiGuard: guard })).rejects.toThrow('HTTP 403');
  expect(guard.total).toBe(1);
});
