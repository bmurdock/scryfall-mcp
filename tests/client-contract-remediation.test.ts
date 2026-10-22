import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScryfallClient } from '../src/services/scryfall-client.js';
import { CacheService } from '../src/services/cache-service.js';
import { GetCardPricesTool } from '../src/tools/get-card-prices.js';

describe('card freshness and localization contracts', () => {
  let cache: CacheService;
  let client: ScryfallClient;
  const card = { id: 'card-id', name: 'Test Card', set: 'tst', collector_number: '54',
    lang: 'en', prices: { usd: '1.00' }, legalities: {}, purchase_uris: {} };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CacheService();
    client = new ScryfallClient({
      execute: (operation: () => Promise<unknown>) => operation(),
      isCircuitOpen: () => false, recordSuccess: vi.fn(), recordError: vi.fn(),
    } as never, cache);
    fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify(card)));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { client.destroy(); cache.destroy(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('refreshes prices after six hours even when ordinary card details are still cached', async () => {
    await client.getCard({ identifier: 'Test Card' });
    const tool = new GetCardPricesTool(client);
    const initial = await tool.execute({ card_identifier: 'Test Card' });
    expect(initial.isError).not.toBe(true);
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000 + 1);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ...card, prices: { usd: '9.00' } })));
    const result = await tool.execute({ card_identifier: 'Test Card' });
    expect(result.content[0].text).toContain('9.00');
    const fetchCount = fetchMock.mock.calls.length;
    await tool.execute({ card_identifier: 'Test Card' });
    expect(fetchMock).toHaveBeenCalledTimes(fetchCount);
  });

  it('uses a language path segment for a localized collector lookup', async () => {
    await client.getCard({ identifier: 'tst/54', lang: 'ja' });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/cards/tst/54/ja');
    expect(url.searchParams.has('lang')).toBe(false);
  });

  it.each(['Test Card', '11111111-1111-1111-1111-111111111111'])('resolves %s before selecting its localized printing', async identifier => {
    fetchMock.mockImplementation(async (url: string) => new Response(JSON.stringify(
      new URL(url).pathname.endsWith('/ja') ? { ...card, lang: 'ja', id: 'localized-id' } : card
    )));
    const localized = await client.getCard({ identifier, lang: 'ja' });
    expect(localized.lang).toBe('ja');
    expect(new URL(fetchMock.mock.calls[1][0]).pathname).toBe('/cards/tst/54/ja');
    await client.getCard({ identifier, lang: 'ja' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports an unavailable localized printing instead of falling back to English', async () => {
    fetchMock.mockImplementation(async (url: string) => new Response(JSON.stringify(
      new URL(url).pathname.endsWith('/ja') ? { object: 'error', code: 'not_found', details: 'No Japanese printing' } : card
    ), { status: new URL(url).pathname.endsWith('/ja') ? 404 : 200 }));
    await expect(client.getCard({ identifier: 'Test Card', lang: 'ja' })).rejects.toMatchObject({ status: 404 });
  });
});
