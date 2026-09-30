import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { fetchWikiJson } = require('../../scripts/lib/commons_api.cjs');
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
