import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchCardsTool } from '../src/tools/search-cards.js';
import { GetCardTool } from '../src/tools/get-card.js';
import { ScryfallClient } from '../src/services/scryfall-client.js';

// Mock the ScryfallClient
vi.mock('../src/services/scryfall-client.js');

describe('MCP Tools', () => {
  let mockScryfallClient: any;

  beforeEach(() => {
    mockScryfallClient = {
      searchCards: vi.fn(),
      getCard: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SearchCardsTool', () => {
    let tool: SearchCardsTool;

    beforeEach(() => {
      tool = new SearchCardsTool(mockScryfallClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('search_cards');
      expect(tool.description).toContain('Search for Magic: The Gathering cards');
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties.query).toBeDefined();
      expect(tool.inputSchema.required).toContain('query');
    });

    it('should validate required query parameter', async () => {
      const result = await tool.execute({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Validation error');
    });

    it('should validate query parameter type', async () => {
      const result = await tool.execute({ query: 123 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Validation error');
    });

    it('should validate limit parameter range', async () => {
      const result = await tool.execute({ query: 'test', limit: 200 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Validation error');
    });

    it('should handle successful search', async () => {
      const mockResponse = {
        total_cards: 1,
        has_more: false,
        data: [{
          id: 'test-id',
          name: 'Lightning Bolt',
          mana_cost: '{R}',
          type_line: 'Instant',
          oracle_text: 'Lightning Bolt deals 3 damage to any target.',
          set_name: 'Alpha',
          rarity: 'common',
          prices: { usd: '1.00' },
          legalities: { modern: 'legal' }
        }]
      };

      mockScryfallClient.searchCards.mockResolvedValue(mockResponse);

      const result = await tool.execute({ query: 'lightning bolt' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Lightning Bolt');
      expect(mockScryfallClient.searchCards).toHaveBeenCalledWith({
        query: 'lightning bolt',
        limit: 20,
        page: 1,
        include_extras: false,
        order: undefined
      });
    });

    it('should handle no results', async () => {
      const mockResponse = {
        total_cards: 0,
        has_more: false,
        data: []
      };

      mockScryfallClient.searchCards.mockResolvedValue(mockResponse);

      const result = await tool.execute({ query: 'nonexistent card' });
      expect(result.content[0].text).toContain('No cards found');
    });
  });

  describe('GetCardTool', () => {
    let tool: GetCardTool;

    beforeEach(() => {
      tool = new GetCardTool(mockScryfallClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('get_card');
      expect(tool.description).toContain('Get detailed information');
    });

    it('should validate required identifier parameter', async () => {
      const result = await tool.execute({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Validation error');
    });

    it('should handle successful card retrieval', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Lightning Bolt',
        mana_cost: '{R}',
        type_line: 'Instant',
        oracle_text: 'Lightning Bolt deals 3 damage to any target.',
        set_name: 'Alpha',
        rarity: 'common',
        prices: { usd: '1.00' },
        legalities: { modern: 'legal' }
      };

      mockScryfallClient.getCard.mockResolvedValue(mockCard);

      const result = await tool.execute({ identifier: 'Lightning Bolt' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Lightning Bolt');
      expect(result.content[0].text).toContain('Instant');
    });
  });
});
