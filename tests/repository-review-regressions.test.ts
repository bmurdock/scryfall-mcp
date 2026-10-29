import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildScryfallQueryTool } from '../src/tools/build-scryfall-query.js';
import { ScryfallClient } from '../src/services/scryfall-client.js';
import { RateLimiter } from '../src/services/rate-limiter.js';
import { CacheService } from '../src/services/cache-service.js';
import { withRequestSignal } from '../src/services/request-context.js';
import { GetCardPricesTool } from '../src/tools/get-card-prices.js';
import { SearchSetsTool } from '../src/tools/search-sets.js';
import { RateLimitError, ScryfallAPIError } from '../src/types/mcp-types.js';
import { formatCardDetails } from '../src/utils/formatters.js';
import { expectLog } from './helpers/expected-logs.js';

async function buildQuery(natural_query: string) {
  const tool = new BuildScryfallQueryTool({} as never);
  const response = await tool.execute({ natural_query, test_query: false, include_alternatives: false });
  expect(response.isError).toBeUndefined();
  return { query: response.content[0].text.split('\n')[1], text: response.content[0].text };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('F01: preserve requested color intent', () => {
  it.each(['creatures with triggered abilities', 'blueprint creatures'])('does not infer colors within words: %s', async (input) => {
    expect((await buildQuery(input)).query).not.toMatch(/\bc[:=<>]/);
  });

  it('keeps multicolored distinct from red', async () => {
    const { query } = await buildQuery('multicolored creatures');
    expect(query).toContain('c:m');
    expect(query).not.toMatch(/c[:=<>]+r/);
  });

  it('preserves a negated color alongside a positive color', async () => {
    const { query, text } = await buildQuery('blue non-red creatures');
    expect(query).toContain('-c:r');
    expect(query).toContain('c:u');
    expect(query).not.toMatch(/(?<!-)\bc:r/);
    expect(text).toContain('not red');
  });

  it.each(['only red creatures', 'mono-red creatures'])('retains exact-color intent: %s', async (input) => {
    expect((await buildQuery(input)).query).toContain('c=r');
  });

  it.each([
    ['not mono-red creatures', 'r'],
    ['without mono-blue creatures', 'u'],
    ['not mono-white creatures', 'w'],
    ['not mono-black creatures', 'b'],
    ['not mono-green creatures', 'g'],
    ['not mono red creatures', 'r'],
    ['without mono blue creatures', 'u'],
  ])('negates the whole mono-color phrase: %s', async (input, color) => {
    const { query } = await buildQuery(input);
    expect(query.match(/-?c[=:][wubrg]+/g)).toEqual([`-c=${color}`]);
  });

  it('does not interpret for as an inclusive color indicator', async () => {
    expect((await buildQuery('blue creatures for modern')).query).toContain('c:u');
    expect((await buildQuery('blue creatures for modern')).query).not.toContain('>=');
  });

  it('retains explicit inclusive and alternative colors', async () => {
    expect((await buildQuery('creatures including red')).query).toContain('c>=r');
    expect((await buildQuery('red or blue creatures')).query).toContain('(c:r OR c:u)');
  });

  it('keeps a multicolor restriction alongside a named color', async () => {
    const { query } = await buildQuery('red multicolored creatures');
    expect(query).toContain('c:m');
    expect(query).toContain('c:r');
  });

  it.each(['without red or blue creatures', 'not red or blue creatures'])('retains negated color alternatives: %s', async (input) => {
    const { query } = await buildQuery(input);
    expect(query).toContain('-c:r');
    expect(query).toContain('-c:u');
    expect(query).not.toContain('(c:r OR c:u)');
  });

  it('preserves alternatives between special color categories', async () => {
    expect((await buildQuery('multicolor or colorless cards')).query).toContain('(c:m OR c:c)');
  });

  it('binds exclusive modifiers to the color phrase', async () => {
    expect((await buildQuery('non-red creatures with only flying')).query).toContain('-c:r');
    expect((await buildQuery('only creatures with red abilities')).query).toContain('c:r');
    expect((await buildQuery('only red and blue creatures')).query).toContain('c=ru');
  });
});

describe('F02: preserve upstream throttling instructions', () => {
  it('keeps status/header handling when discarding a throttle body fails', async () => {
    const limiter = new RateLimiter(100), cache = new CacheService();
    const client = new ScryfallClient(limiter, cache);
    const body = new ReadableStream({ cancel() { throw new Error('stream cleanup failed'); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 429, headers: { 'retry-after': '120' } })));
    expectLog('warn', 'Rate limit exceeded', { operation: 'scryfall_request' });
    try {
      await expect(client.getRandomCard()).rejects.toMatchObject({ code: 'RATE_LIMIT_ERROR', retryAfter: 120 });
      expect(limiter.getStatus().nextAllowedRequestTime).toBeGreaterThan(Date.now() + 119_000);
    } finally { client.destroy(); limiter.reset(); cache.destroy(); }
  });

  it.each(['seconds', 'date', 'text'] as const)('honors Retry-After with %s responses', async (kind) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    const limiter = new RateLimiter(100);
    const cache = new CacheService();
    const client = new ScryfallClient(limiter, cache);
    const retryAfter = kind === 'date' ? new Date(Date.now() + 120_000).toUTCString() : '120';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      kind === 'text' ? 'Too Many Requests' : JSON.stringify({ details: 'throttled' }),
      { status: 429, headers: { 'retry-after': retryAfter } }
    )));
    expectLog('warn', 'Rate limit exceeded', { operation: 'scryfall_request' });
    try {
      await expect(client.getRandomCard()).rejects.toMatchObject({ code: 'RATE_LIMIT_ERROR', retryAfter: 120 });
      expect(limiter.getStatus().nextAllowedRequestTime).toBe(Date.now() + 120_000);
    } finally {
      client.destroy(); limiter.reset(); cache.destroy();
    }
  });
});

describe('F03: retain currency symbols before extracting prices', () => {
  it.each(['creatures under €5', 'creatures priced under €5', 'creatures under 5 euros', 'creatures under 5€', 'creatures under 5 €'])('%s retains the EUR cap', async (input) => {
    const { query } = await buildQuery(input);
    expect(query).toContain('eur<=5');
    expect(query).not.toMatch(/usd<=5\b/);
  });
});

const pricedCard = { name: 'Test Creature', type_line: 'Creature', cmc: 2,
  prices: { usd: '5.00', eur: '4.00', tix: '1.00' }, legalities: {} };

describe('F04: distinguish missing comparisons from empty searches', () => {
  it('propagates cancellation without starting another comparison', async () => {
    const controller = new AbortController();
    const searchCards = vi.fn().mockImplementation(async () => {
      controller.abort();
      controller.signal.throwIfAborted();
    });
    const tool = new GetCardPricesTool({ getCard: async () => pricedCard, searchCards } as never);
    await expect(withRequestSignal(controller.signal, () => tool.execute({ card_identifier: 'Test Creature', include_alternatives: true })))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(searchCards).toHaveBeenCalledTimes(1);
  });

  it('returns base prices and retry guidance when comparisons are throttled', async () => {
    const searchCards = vi.fn().mockRejectedValue(new RateLimitError('Rate limit exceeded', 120));
    const tool = new GetCardPricesTool({ getCard: async () => pricedCard, searchCards } as never);
    const result = await tool.execute({ card_identifier: 'Test Creature', include_alternatives: true });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('$5.00');
    expect(result.content[0].text).toContain('Lower-priced comparisons unavailable');
    expect(result.content[0].text).toContain('Higher-priced comparisons unavailable');
    expect(result.content[0].text).toContain('120s');
    expect(searchCards).toHaveBeenCalledTimes(1);
  });

  it('preserves successful comparisons when the other category fails', async () => {
    const searchCards = vi.fn().mockRejectedValueOnce(new ScryfallAPIError('Unavailable', 503))
      .mockResolvedValueOnce({ data: [{ name: 'Higher Priced', prices: { usd: '8.00' } }] });
    const tool = new GetCardPricesTool({ getCard: async () => pricedCard, searchCards } as never);
    const result = await tool.execute({ card_identifier: 'Test Creature', include_alternatives: true });
    expect(result.content[0].text).toContain('Lower-priced comparisons unavailable');
    expect(result.content[0].text).toContain('Higher Priced: USD 8.00');
  });

  it.each([false, true])('reports a failed higher-priced search (both failed: %s)', async (both) => {
    const searchCards = vi.fn().mockRejectedValue(new ScryfallAPIError('Unavailable', 503));
    if (!both) searchCards.mockResolvedValueOnce({ data: [{ name: 'Lower Priced', prices: { usd: '2.00' } }] });
    const tool = new GetCardPricesTool({ getCard: async () => pricedCard, searchCards } as never);
    const result = await tool.execute({ card_identifier: 'Test Creature', include_alternatives: true });
    expect(result.content[0].text).toContain('Higher-priced comparisons unavailable');
    expect(result.content[0].text).toContain(both ? 'Lower-priced comparisons unavailable' : 'Lower Priced: USD 2.00');
  });

  it('treats a no-match 404 as an empty category, not a failed lookup', async () => {
    const tool = new GetCardPricesTool({ getCard: async () => pricedCard,
      searchCards: async () => { throw new ScryfallAPIError('No cards', 404); } } as never);
    const result = await tool.execute({ card_identifier: 'Test Creature', include_alternatives: true });
    expect(result.content[0].text).not.toContain('unavailable');
  });
});

describe('F05: coalesce canonical set fetches', () => {
  it('coalesces forced refreshes and invalidates previously filtered views', async () => {
    const limiter = new RateLimiter(0), cache = new CacheService();
    const client = new ScryfallClient(limiter, cache);
    const oldSet = { name: 'Test Old', code: 'old' }, newSet = { name: 'Test New', code: 'new' };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [oldSet] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [newSet] })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect(await client.getSets({ query: 'Test' })).toEqual([oldSet]);
      const refreshes = await Promise.all([client.getSets(undefined, { forceRefresh: true }), client.getSets({ query: 'Test' }, { forceRefresh: true })]);
      expect(refreshes).toEqual([[newSet], [newSet]]);
      expect(await client.getSets({ query: 'Test' })).toEqual([newSet]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { client.destroy(); limiter.reset(); cache.destroy(); }
  });

  it('shares a cold fetch across filters, while retaining per-caller results', async () => {
    const limiter = new RateLimiter(0), cache = new CacheService();
    const client = new ScryfallClient(limiter, cache);
    const sets = [{ name: 'First Set', code: 'one' }, { name: 'Second Set', code: 'two' }];
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: sets })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const [all, first, second] = await Promise.all([client.getSets(), client.getSets({ query: 'First' }), client.getSets({ query: 'Second' })]);
      expect(all).toHaveLength(2);
      expect(first.map(set => set.code)).toEqual(['one']);
      expect(second.map(set => set.code)).toEqual(['two']);
      await client.getSets();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { client.destroy(); limiter.reset(); cache.destroy(); }
  });

  it('lets one caller cancel without cancelling another caller sharing the fetch', async () => {
    const limiter = new RateLimiter(0), cache = new CacheService();
    const client = new ScryfallClient(limiter, cache);
    let release!: (value: Response) => void;
    let upstreamSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url, options) => {
      upstreamSignal = options.signal;
      return new Promise<Response>(resolve => { release = resolve; });
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    try {
      const cancelled = withRequestSignal(controller.signal, () => client.getSets());
      const cancellation = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
      const remaining = client.getSets();
      await vi.waitFor(() => expect(release).toBeTypeOf('function'));
      controller.abort();
      await cancellation;
      expect(upstreamSignal?.aborted).toBe(false);
      release(new Response(JSON.stringify({ data: [] })));
      await expect(remaining).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { client.destroy(); limiter.reset(); cache.destroy(); }
  });
});

describe('F06: reject impossible release dates', () => {
  it.each(['2026-02-30', '2026-04-31', '2025-02-29'])('rejects %s before a lookup', async (released_after) => {
    const getSets = vi.fn().mockResolvedValue([]);
    const result = await new SearchSetsTool({ getSets } as never).execute({ released_after });
    expect(result.isError).toBe(true);
    expect(getSets).not.toHaveBeenCalled();
  });

  it('accepts a real leap day', async () => {
    const getSets = vi.fn().mockResolvedValue([]);
    const result = await new SearchSetsTool({ getSets } as never).execute({ released_after: '2024-02-29' });
    expect(result.isError).toBeUndefined();
    expect(getSets).toHaveBeenCalledOnce();
  });
});

describe('F07: retain price units in display text', () => {
  it('labels card-detail currencies accurately', () => {
    const text = formatCardDetails(pricedCard as never);
    expect(text).toContain('USD: $5.00');
    expect(text).toContain('EUR: €4.00');
    expect(text).toContain('TIX: 1.00 tix');
  });

  it.each([['euros', '€5'], ['tix', '5 tix']])('explains prices in %s', async (currency, amount) => {
    expect((await buildQuery(`creatures under 5 ${currency}`)).text).toContain(`priced <=${amount}`);
  });
});
