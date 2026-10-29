import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryRulesTool } from '../src/tools/query-rules.js';
import { withRequestSignal } from '../src/services/request-context.js';
import { ScryfallClient } from '../src/services/scryfall-client.js';
import { CacheService } from '../src/services/cache-service.js';
import { sanitizeCardIdentifier, sanitizeQuery } from '../src/utils/query-sanitizer.js';
import { BuildScryfallQueryTool } from '../src/tools/build-scryfall-query.js';
import { NaturalLanguageParser } from '../src/natural-language/parser.js';
import { testAndAdjustQuery } from '../src/natural-language/query-builder/query-optimization.js';
import { expectLog } from './helpers/expected-logs.js';
import { AnalyzeDeckCompositionTool } from '../src/tools/analyze-deck-composition.js';
import { analyzeComposition } from '../src/tools/batch-card-analysis/analyzers.js';
import type { ScryfallCard } from '../src/types/scryfall-api.js';
import { SetDatabaseResource } from '../src/resources/set-database.js';

describe('F01: bounded, cancellable rules searches', () => {
  it.each([
    'x'.repeat(2001),
    Array.from({ length: 33 }, (_, index) => `word${index}`).join(' '),
  ])('rejects excessive query work', async query => {
    const result = await new QueryRulesTool().execute({ query });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Validation error');
  });

  it('yields during a scan so cancellation can interrupt it', async () => {
    const controller = new AbortController();
    const pending = withRequestSignal(controller.signal, () =>
      new QueryRulesTool().execute({ query: 'nonexistentword' }));
    const interrupt = setImmediate(() => controller.abort(new Error('Review cancellation')));
    try {
      const result = await pending;
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Review cancellation');
    } finally {
      clearImmediate(interrupt);
    }
  });

  it('preserves all-word, case-insensitive matching with repeated literal terms', async () => {
    const tool = new QueryRulesTool();
    const once = await tool.execute({ query: 'modal spell', section: '700' });
    const repeated = await tool.execute({ query: 'MODAL spell modal', section: '700' });
    expect(once.isError).toBeUndefined();
    expect(once.content[0].text).toContain('Section 700');
    expect(repeated.content[0].text.split('\n').slice(1))
      .toEqual(once.content[0].text.split('\n').slice(1));
  });
});

describe('client-backed review regressions', () => {
  let cache: CacheService;
  let client: ScryfallClient;
  const fetchMock = vi.fn();

  beforeEach(() => {
    cache = new CacheService();
    client = new ScryfallClient({
      execute: (operation: () => Promise<unknown>) => operation(),
      isCircuitOpen: () => false, recordSuccess: vi.fn(), recordError: vi.fn(),
      handleRateLimitResponse: vi.fn(),
    } as never, cache);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    client.destroy();
    cache.destroy();
    vi.unstubAllGlobals();
  });

  it.each(['t:creature OR t:artifact', '(t:creature OR (t:artifact c:u))'])(
    'F02: applies both price bounds to all branches of %s', async query => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ object: 'list', total_cards: 0, data: [] })));
      await client.searchCards({ query, price_range: { min: 1, max: 5, currency: 'eur' } });
      expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('q'))
        .toBe(`(${query}) eur>=1 eur<=5`);
    }
  );

  it('F05: broadens an actual client 404 no-match response', async () => {
    expectLog('error', 'Scryfall API error');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'not_found', details: 'No matches' }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ object: 'list', total_cards: 1, has_more: false, data: [{ name: 'Match' }] })));
    const result = await testAndAdjustQuery(client, 't:creature cmc=4', { optimize_for: 'precision' });
    expect(result.query).toBe('t:creature cmc<=4');
    expect(result.testSummary).toEqual({ total_cards: 1, has_more: false });
    expect(result.optimizations[0]?.type).toBe('broadening');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('F05: reports zero when the adjusted query also has no matches', async () => {
    expectLog('error', 'Scryfall API error');
    expectLog('error', 'Scryfall API error');
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ code: 'not_found' }), { status: 404 }));
    const result = await testAndAdjustQuery(client, 't:creature cmc=4', { optimize_for: 'precision' });
    expect(result.testSummary).toEqual({ total_cards: 0, has_more: false });
  });

  it('F05: preserves an explicit price budget when no-match broadening runs', async () => {
    expectLog('error', 'Scryfall API error');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'not_found' }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ object: 'list', total_cards: 1, data: [{}] })));
    const result = await testAndAdjustQuery(client, 't:creature cmc=4 usd<=7', {
      optimize_for: 'precision', price_budget: { max: 7, currency: 'usd' },
    });
    expect(result.query).toBe('t:creature cmc<=4 usd<=7');
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('q')).toBe(result.query);
  });

  it('F05: does not claim an adjustment when an empty query cannot be broadened', async () => {
    expectLog('error', 'Scryfall API error');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'not_found' }), { status: 404 }));
    const result = await testAndAdjustQuery(client, 't:creature', { optimize_for: 'recall' });
    expect(result).toEqual({ query: 't:creature', optimizations: [], testSummary: { total_cards: 0, has_more: false } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([422, 500])('F05: does not treat HTTP %s as an empty result', async status => {
    expectLog('error', 'Scryfall API error');
    expectLog('warn', 'Query testing failed');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'other_error' }), { status }));
    const result = await testAndAdjustQuery(client, 't:creature cmc=4', { optimize_for: 'precision' });
    expect(result.query).toBe('t:creature cmc=4');
    expect(result.testSummary).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('F07: force refresh fetches through a warm client cache and replaces filtered views', async () => {
    const oldSet = { id: 'old', code: 'old', name: 'Old Set' };
    const newSet = { id: 'new', code: 'new', name: 'New Set' };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [oldSet] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [newSet] })));
    const resource = new SetDatabaseResource(client, cache);
    await resource.getData();
    expect(await client.getSets({ query: 'Old' })).toEqual([oldSet]);
    await resource.forceRefresh();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await resource.getData()).data).toEqual([newSet]);
    expect(await client.getSets({ query: 'Old' })).toEqual([]);
  });

  it('F07: failed forced fetch preserves the warm raw model and serialized snapshot', async () => {
    const oldSet = { id: 'old', code: 'old', name: 'Old Set' };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [oldSet] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'server_error', details: 'Refresh unavailable' }), { status: 500 }));
    const resource = new SetDatabaseResource(client, cache);
    const original = await resource.getData();
    expectLog('error', 'Scryfall API error');
    await expect(resource.forceRefresh()).rejects.toThrow('Refresh unavailable');
    expect(await resource.getData()).toBe(original);
    expect(await client.getSets()).toEqual([oldSet]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('F03: supported Scryfall input', () => {
  it.each(['mana:{U}', 'm:{2/G}', 'name:"Fire // Ice"', 'name:"Lim-Dûl"'])(
    'preserves %s', query => expect(sanitizeQuery(query)).toBe(query)
  );
  it.each(['Lim-Dûl the Necromancer', 'Æther Adept', 'Lím-Du\u0302l'])(
    'preserves Unicode identifier %s', identifier => expect(sanitizeCardIdentifier(identifier)).toBe(identifier)
  );
  it('retains query length and nesting limits', () => {
    expect(() => sanitizeQuery('a'.repeat(2001))).toThrow('too long');
    expect(() => sanitizeQuery('('.repeat(11) + 't:land' + ')'.repeat(11))).toThrow('nested');
    expect(() => sanitizeCardIdentifier('a'.repeat(201))).toThrow('too long');
  });
});

describe('F04: monetary context in natural language', () => {
  it.each(['cheap 3 mana creatures', 'budget 3/3 creatures', 'cheap 3-mana creatures', 'budget 3-power creatures', 'affordable 3-toughness creatures'])(
    'does not consume a stat or mana amount as the %s price', text => {
      expect(new NaturalLanguageParser().parse(text).priceConstraints)
        .toEqual([expect.objectContaining({ currency: 'usd', max: 10 })]);
    }
  );

  it.each([
    ['inexpensive creatures under 20 eur', 'eur', undefined, 20],
    ['budget creatures under 20 tix', 'tix', undefined, 20],
    ['cards between 10 and 20 tix', 'tix', 10, 20],
  ])('keeps the currency attached to the amount in %s', (text, currency, min, max) => {
    const prices = new NaturalLanguageParser().parse(text).priceConstraints;
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ currency, max });
    expect(prices[0].min).toBe(min);
  });

  it.each(['inexpensive', 'budget', 'cheap', 'affordable'])(
    'lets an explicit price override the %s default without inverting its condition', adjective => {
      const parsed = new NaturalLanguageParser().parse(`${adjective} creatures under $20`);
      expect(parsed.priceConstraints).toEqual([expect.objectContaining({ max: 20, condition: 'budget' })]);
    }
  );

  it('interprets inexpensive as a budget, not a premium minimum', async () => {
    const result = await new BuildScryfallQueryTool({} as never).execute({
      natural_query: 'inexpensive creatures', optimize_for: 'recall',
    });
    const query = result.content[0].text.match(/\*\*Generated Scryfall Query:\*\*\n`([^`]+)`/)?.[1];
    expect(query).toContain('usd<=10');
    expect(query).not.toContain('usd>=50');
  });

  it.each(['creatures with power less than 3', 'mana cost below 4', 'toughness between 2 and 5'])(
    'does not invent a price from %s', text => {
      expect(new NaturalLanguageParser().parse(text).priceConstraints).toEqual([]);
    }
  );

  it('recognizes an explicit price after an unrelated numeric comparison', () => {
    const parsed = new NaturalLanguageParser().parse('creatures with power less than 3 and price less than $5');
    expect(parsed.priceConstraints).toEqual([expect.objectContaining({ max: 5, currency: 'usd' })]);
  });

  it.each([
    ['creatures under $5', 'usd', 5],
    ['creatures under 10 tix', 'tix', 10],
    ['creatures with price below 8', 'usd', 8],
  ])('retains monetary constraints in %s', (text, currency, max) => {
    expect(new NaturalLanguageParser().parse(text).priceConstraints)
      .toEqual([expect.objectContaining({ currency, max })]);
  });
});

describe('F06: composition metrics', () => {
  const card = (name: string, cmc: number, type_line: string): ScryfallCard => ({
    name, cmc, type_line, color_identity: [], prices: {}, rarity: 'common',
  } as ScryfallCard);

  it('uses the nonland curve for strategy recommendations', async () => {
    const tool = new AnalyzeDeckCompositionTool({
      getCard: async ({ identifier }: { identifier: string }) => identifier === 'Plains'
        ? card(identifier, 0, 'Basic Land — Plains') : card(identifier, 4, 'Instant'),
    } as never);
    const result = await tool.execute({ deck_list: '24 Plains\n36 Spell', strategy: 'control', format: 'modern' });
    expect(result.content[0].text).toContain('Average Nonland CMC: 4.00');
    expect(result.content[0].text).not.toContain('Mana curve too low');
  });

  it('includes a spell with a land back face in the nonland average', async () => {
    const tool = new AnalyzeDeckCompositionTool({
      getCard: async () => card('Spell // Land', 3, 'Sorcery // Land'),
    } as never);
    const result = await tool.execute({ deck_list: '1 Spell // Land' });
    expect(result.content[0].text).toContain('Average Nonland CMC: 3.00');
  });

  it('keeps every card in the batch curve, including fractional and high mana values', () => {
    const result = analyzeComposition([0.5, 7, 8, 15].map(cmc => card(`Card ${cmc}`, cmc, 'Creature')));
    expect(result).toContain('- 0.5: 1 cards');
    expect(result).toContain('- 7+: 3 cards');
    expect(result).not.toContain('- 8+');
    const displayedCount = [...result.matchAll(/^- [\d.+]+: (\d+) cards$/gm)]
      .reduce((total, match) => total + Number(match[1]), 0);
    expect(displayedCount).toBe(4);
  });
});
