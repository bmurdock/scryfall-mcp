import { describe, expect, it, vi } from 'vitest';
import { SearchCardsTool } from '../src/tools/search-cards.js';
import { RandomCardTool } from '../src/tools/random-card.js';
import { QueryRulesTool } from '../src/tools/query-rules.js';
import { NaturalLanguageParser } from '../src/natural-language/parser.js';
import { BuildScryfallQueryTool } from '../src/tools/build-scryfall-query.js';

const searchResults = {
  object: 'list' as const,
  total_cards: 1,
  has_more: false,
  data: [{
    id: 'card-id',
    name: 'Test Card',
    mana_cost: '{R}',
    type_line: 'Creature',
    oracle_text: '',
    set_name: 'Test Set',
    set: 'tst',
    collector_number: '1',
    rarity: 'common',
    prices: { usd: '1.00' },
    legalities: {},
  }],
};

describe('query contract remediation', () => {
  it.each(['game:arena t:creature OR t:artifact', '(game:arena t:creature OR t:artifact)'])('keeps arena_only outside every branch of %s', async query => {
    const client = { searchCards: vi.fn().mockResolvedValue(searchResults) };
    const tool = new SearchCardsTool(client as never);

    await tool.execute({ query, arena_only: true });

    expect(client.searchCards).toHaveBeenCalledWith(expect.objectContaining({
      query: `(${query}) game:arena`,
    }));
  });

  it('does not mistake quoted game:arena text for an Arena filter', async () => {
    const client = { searchCards: vi.fn().mockResolvedValue(searchResults) };
    const tool = new SearchCardsTool(client as never);

    await tool.execute({ query: '"game:arena" OR t:artifact', arena_only: true });

    expect(client.searchCards).toHaveBeenCalledWith(expect.objectContaining({
      query: '("game:arena" OR t:artifact) game:arena',
    }));
  });

  it('groups random-card constraints around OR-bearing compound filters', async () => {
    const client = {
      getRandomCard: vi.fn().mockResolvedValue({
        id: 'card-id',
        name: 'Test Card',
        type_line: 'Creature',
        prices: {},
      }),
    };
    const tool = new RandomCardTool(client as never);

    await tool.execute({
      query: 't:creature',
      format: 'modern',
      archetype: 'aggro',
      price_range: { min: 5, currency: 'usd' },
    });

    expect(client.getRandomCard).toHaveBeenCalledWith(
      '((t:creature) AND (legal:modern) AND ((t:creature pow>=2) OR (o:"haste" OR o:"first strike")) AND (usd>=5))'
    );
  });

  it('treats a chapter filter as containing its numbered sections', async () => {
    const tool = new QueryRulesTool();
    const result = await tool.execute({ query: 'modal', section: '7' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Section 700');
  });

  it('keeps a specific numbered section limited to that section hierarchy', async () => {
    const tool = new QueryRulesTool();
    const result = await tool.execute({ query: 'modal', section: '700' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Section 700');
    expect(result.content[0].text).not.toContain('Section 702');
  });

  it.each([
    ['flying', 'keywords'],
    ['enters the battlefield', 'abilities'],
    ['storm', 'mechanics'],
    ['mana cost 3', 'manaCost'],
    ['power 3', 'powerToughness'],
    ['dragon', 'subtypes'],
  ])('includes %s in parser confidence', (query, concept) => {
    const parsed = new NaturalLanguageParser().parse(query);

    expect((parsed[concept as keyof typeof parsed] as unknown[]).length).toBeGreaterThan(0);
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it.each([
    ['flying', 'o:flying'],
    ['enters the battlefield', 'o:"enters the battlefield"'],
    ['mana cost 3', 'cmc=3'],
  ])('builds a usable tool result for the standalone concept %s', async (natural_query, expectedQuery) => {
    const tool = new BuildScryfallQueryTool({ searchCards: vi.fn() } as never);
    const result = await tool.execute({ natural_query, test_query: false });
    expect(result.isError).not.toBe(true);
    const generated = result.content[0].text.match(/\*\*Generated Scryfall Query:\*\*\n`([^`]+)`/)?.[1];
    expect(generated).toContain(expectedQuery);
    expect(result.content[0].text).not.toContain('Low Confidence Parsing');
  });
});
