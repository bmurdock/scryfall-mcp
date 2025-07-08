import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchCardsTool } from '../src/tools/search-cards.js';
import { GetCardTool } from '../src/tools/get-card.js';
import { QueryRulesTool } from '../src/tools/query-rules.js';
import { SearchFormatStaplesTool } from '../src/tools/search-format-staples.js';
import { SearchAlternativesTool } from '../src/tools/search-alternatives.js';
import { FindSynergisticCardsTool } from '../src/tools/find-synergistic-cards.js';
import { BatchCardAnalysisTool } from '../src/tools/batch-card-analysis.js';
import { ScryfallAPIError } from '../src/types/mcp-types.js';
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
        order: undefined,
        unique: 'cards',
        direction: 'auto',
        include_multilingual: false,
        include_variations: false,
        price_range: undefined
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

    it('should handle enhanced search parameters', async () => {
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

      const result = await tool.execute({
        query: 'lightning bolt',
        unique: 'prints',
        direction: 'desc',
        include_multilingual: true,
        include_variations: true,
        price_range: { min: 0.5, max: 2.0, currency: 'usd' }
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Lightning Bolt');
      expect(mockScryfallClient.searchCards).toHaveBeenCalledWith({
        query: 'lightning bolt',
        limit: 20,
        page: 1,
        include_extras: false,
        order: undefined,
        unique: 'prints',
        direction: 'desc',
        include_multilingual: true,
        include_variations: true,
        price_range: { min: 0.5, max: 2.0, currency: 'usd' }
      });
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

  describe('QueryRulesTool', () => {
    let tool: QueryRulesTool;

    beforeEach(() => {
      tool = new QueryRulesTool();
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('query_rules');
      expect(tool.description).toContain('Search Magic: The Gathering comprehensive rules');
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

    it('should validate context_lines parameter range', async () => {
      const result = await tool.execute({ query: 'test', context_lines: 15 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Validation error');
    });

    it('should handle missing rules file gracefully', async () => {
      // This test assumes the rules file might not be available in test environment
      const result = await tool.execute({ query: 'priority' });

      // Should either find results or indicate file is not available
      expect(result.content[0].text).toBeDefined();

      if (result.isError) {
        expect(result.content[0].text).toContain('MTG rules file is not available');
      } else {
        // If rules file is available, should return search results
        expect(result.content[0].text).toMatch(/Found \d+ rule|No rules found/);
      }
    });
  });

  describe('SearchFormatStaplesTool', () => {
    let tool: SearchFormatStaplesTool;

    beforeEach(() => {
      tool = new SearchFormatStaplesTool(mockScryfallClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('search_format_staples');
      expect(tool.description).toContain('Find format staples');
    });

    it('should validate required format parameter', async () => {
      const result = await tool.execute({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Format is required');
    });

    it('should validate format parameter values', async () => {
      const result = await tool.execute({ format: 'invalid' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Format must be one of');
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

      const result = await tool.execute({ format: 'modern', role: 'removal' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Lightning Bolt');
    });
  });

  describe('SearchAlternativesTool', () => {
    let tool: SearchAlternativesTool;

    beforeEach(() => {
      tool = new SearchAlternativesTool(mockScryfallClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('search_alternatives');
      expect(tool.description).toContain('Find budget alternatives');
    });

    it('should validate required parameters', async () => {
      const result = await tool.execute({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Target card is required');
    });

    it('should validate direction parameter', async () => {
      const result = await tool.execute({ target_card: 'Lightning Bolt', direction: 'invalid' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Direction must be one of');
    });

    it('should handle target card not found', async () => {
      const error = new ScryfallAPIError('Not found', 404);
      mockScryfallClient.getCard.mockRejectedValue(error);

      const result = await tool.execute({ target_card: 'Nonexistent Card', direction: 'cheaper' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Target card not found');
    });

    it('should handle successful alternatives search', async () => {
      const targetCard = {
        id: 'target-id',
        name: 'Lightning Bolt',
        cmc: 1,
        type_line: 'Instant',
        prices: { usd: '1.00' }
      };

      const alternativeCard = {
        id: 'alt-id',
        name: 'Shock',
        mana_cost: '{R}',
        type_line: 'Instant',
        oracle_text: 'Shock deals 2 damage to any target.',
        set_name: 'Alpha',
        rarity: 'common',
        prices: { usd: '0.50' },
        legalities: { modern: 'legal' }
      };

      mockScryfallClient.getCard.mockResolvedValue(targetCard);
      mockScryfallClient.searchCards.mockResolvedValue({
        total_cards: 1,
        has_more: false,
        data: [alternativeCard]
      });

      const result = await tool.execute({ target_card: 'Lightning Bolt', direction: 'cheaper' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Alternatives for Lightning Bolt');
      expect(result.content[0].text).toContain('Shock');
    });
  });

  describe('FindSynergisticCardsTool', () => {
    let tool: FindSynergisticCardsTool;

    beforeEach(() => {
      tool = new FindSynergisticCardsTool(mockScryfallClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('find_synergistic_cards');
      expect(tool.description).toContain('Find cards that synergize');
    });

    it('should validate required focus_card parameter', async () => {
      const result = await tool.execute({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Focus card is required');
    });

    it('should validate synergy_type parameter', async () => {
      const result = await tool.execute({ focus_card: 'Lightning Bolt', synergy_type: 'invalid' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Synergy type must be one of');
    });

    it('should handle successful synergy search with existing card', async () => {
      const focusCard = {
        id: 'focus-id',
        name: 'Serra Angel',
        type_line: 'Creature — Angel',
        oracle_text: 'Flying, vigilance'
      };

      const synergyCard = {
        id: 'synergy-id',
        name: 'Sephara, Sky\'s Blade',
        mana_cost: '{4}{W}{W}{W}',
        type_line: 'Legendary Creature — Angel',
        oracle_text: 'Flying, lifelink. Other creatures you control with flying get +1/+1.',
        set_name: 'Core Set 2020',
        rarity: 'mythic',
        prices: { usd: '2.50' },
        legalities: { modern: 'legal' }
      };

      mockScryfallClient.getCard.mockResolvedValue(focusCard);
      // Mock multiple search calls that the synergy tool makes
      mockScryfallClient.searchCards
        .mockResolvedValueOnce({
          total_cards: 1,
          has_more: false,
          data: [synergyCard]
        })
        .mockResolvedValue({
          total_cards: 0,
          has_more: false,
          data: []
        });

      const result = await tool.execute({ focus_card: 'Serra Angel', synergy_type: 'keyword' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Synergistic cards for "Serra Angel"');
      expect(result.content[0].text).toContain('Sephara');
    });

    it('should handle theme-based synergy search when card not found', async () => {
      const synergyCard = {
        id: 'synergy-id',
        name: 'Goblin Guide',
        mana_cost: '{R}',
        type_line: 'Creature — Goblin Berserker',
        oracle_text: 'Haste',
        set_name: 'Zendikar',
        rarity: 'rare',
        prices: { usd: '5.00' },
        legalities: { modern: 'legal' }
      };

      mockScryfallClient.getCard.mockRejectedValue(new ScryfallAPIError('Not found', 404));
      mockScryfallClient.searchCards.mockResolvedValue({
        total_cards: 1,
        has_more: false,
        data: [synergyCard]
      });

      const result = await tool.execute({ focus_card: 'goblin tribal', synergy_type: 'tribal' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Synergistic cards for "goblin tribal"');
    });
  });

  describe('BatchCardAnalysisTool', () => {
    let tool: BatchCardAnalysisTool;

    beforeEach(() => {
      tool = new BatchCardAnalysisTool(mockScryfallClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('batch_card_analysis');
      expect(tool.description).toContain('Analyze multiple cards');
    });

    it('should validate required parameters', async () => {
      const result = await tool.execute({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Card list is required');
    });

    it('should validate analysis_type parameter', async () => {
      const result = await tool.execute({
        card_list: ['Lightning Bolt'],
        analysis_type: 'invalid'
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Analysis type must be one of');
    });

    it('should validate card list size', async () => {
      const largeList = Array(101).fill('Lightning Bolt');
      const result = await tool.execute({
        card_list: largeList,
        analysis_type: 'legality'
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('cannot exceed 100 cards');
    });

    it('should handle successful legality analysis', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Lightning Bolt',
        mana_cost: '{R}',
        type_line: 'Instant',
        oracle_text: 'Lightning Bolt deals 3 damage to any target.',
        cmc: 1,
        legalities: {
          modern: 'legal',
          standard: 'not_legal',
          legacy: 'legal'
        },
        prices: { usd: '1.00' },
        color_identity: ['R']
      };

      mockScryfallClient.getCard.mockResolvedValue(mockCard);

      const result = await tool.execute({
        card_list: ['Lightning Bolt'],
        analysis_type: 'legality',
        format: 'modern'
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Legality Analysis');
      expect(result.content[0].text).toContain('MODERN Legality');
      expect(result.content[0].text).toContain('Legal: 1 cards');
    });

    it('should handle successful price analysis', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Lightning Bolt',
        mana_cost: '{R}',
        type_line: 'Instant',
        cmc: 1,
        legalities: { modern: 'legal' },
        prices: { usd: '1.50', eur: '1.20' },
        color_identity: ['R']
      };

      mockScryfallClient.getCard.mockResolvedValue(mockCard);

      const result = await tool.execute({
        card_list: ['Lightning Bolt'],
        analysis_type: 'prices',
        currency: 'usd'
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Price Analysis');
      expect(result.content[0].text).toContain('Total Value: USD 1.50');
    });

    it('should handle card not found error', async () => {
      mockScryfallClient.getCard.mockRejectedValue(new ScryfallAPIError('Not found', 404));

      const result = await tool.execute({
        card_list: ['Nonexistent Card'],
        analysis_type: 'legality'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Cards not found: Nonexistent Card');
    });
  });
});
