import { describe, expect, it, vi } from 'vitest';
import { NaturalLanguageParser } from '../src/natural-language/parser.js';
import { ConceptExtractor } from '../src/natural-language/concept-extractor.js';
import { QueryBuilderEngine } from '../src/natural-language/query-builder.js';
import { buildBaseQuery, applyFormat } from '../src/natural-language/query-builder/query-assembly.js';
import {
  applyOptimization,
  testAndAdjustQuery,
} from '../src/natural-language/query-builder/query-optimization.js';
import {
  generateAlternatives,
  generateExplanation,
} from '../src/natural-language/query-builder/query-explanations.js';
import { ConceptMapping, ParsedQuery } from '../src/natural-language/types.js';

function createEmptyParsedQuery(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    colors: [],
    types: [],
    subtypes: [],
    keywords: [],
    abilities: [],
    mechanics: [],
    manaCost: [],
    powerToughness: [],
    priceConstraints: [],
    formats: [],
    legality: [],
    archetypes: [],
    deckRoles: [],
    strategies: [],
    sets: [],
    rarity: [],
    timeConstraints: [],
    namePatterns: [],
    flavorText: [],
    artist: [],
    confidence: 0.8,
    ambiguities: [],
    context: {},
    ...overrides,
  };
}

describe('Natural-Language Query Builder', () => {
  describe('query assembly helpers', () => {
    it('groups repeated operators into usable Scryfall clauses', () => {
      const mappings: ConceptMapping[] = [
        { operator: 'c', value: 'u', confidence: 0.9, comparison: '=' },
        { operator: 't', value: 'instant', confidence: 0.9 },
        { operator: 't', value: 'sorcery', confidence: 0.8 },
        { operator: 'usd', value: '5', confidence: 0.95, comparison: '<=' },
        { operator: 'pow', value: '2', confidence: 0.8, comparison: '>=' },
      ];

      const query = buildBaseQuery(mappings);

      expect(query).toContain('c:=u');
      expect(query).toContain('(t:instant OR t:sorcery)');
      expect(query).toContain('usd:<=5');
      expect(query).toContain('pow:>=2');
    });

    it('adds format restrictions without disturbing the existing query', () => {
      expect(applyFormat('t:artifact usd:<=5', 'commander')).toBe('t:artifact usd:<=5 f:commander');
      expect(applyFormat('', 'modern')).toBe('f:modern');
    });
  });

  describe('query optimization helpers', () => {
    it('applies strategy-specific optimization rules', () => {
      expect(applyOptimization('t:creature pow:>=3', 'precision'))
        .toContain('(f:standard OR f:modern OR f:commander)');
      expect(applyOptimization('t:creature pow:>=3', 'precision'))
        .toContain('usd<=50');
      expect(applyOptimization('t:instant pow:>=3', 'recall'))
        .toContain('(t:instant OR t:sorcery)');
      expect(applyOptimization('t:artifact', 'budget')).toContain('usd<=5');
      expect(applyOptimization('t:legendary', 'discovery')).toContain('(is:unique OR is:reserved OR is:promo)');
    });

    it('broadens queries that return no results and narrows queries that are too broad', async () => {
      const mockClient = {
        searchCards: vi
          .fn()
          .mockResolvedValueOnce({ total_cards: 0, data: [] })
          .mockResolvedValueOnce({ total_cards: 500, data: [] }),
      };

      const broadened = await testAndAdjustQuery(
        mockClient as never,
        't:artifact cmc:=4 usd:<=5',
        { optimize_for: 'precision', max_results: 20 }
      );
      const narrowed = await testAndAdjustQuery(
        mockClient as never,
        't:artifact',
        { optimize_for: 'precision', max_results: 20 }
      );

      expect(broadened.query).toContain('cmc<=4');
      expect(broadened.query).toContain('usd:<=10');
      expect(broadened.optimizations[0]?.type).toBe('broadening');

      expect(narrowed.query).toContain('f:modern');
      expect(narrowed.query).toContain('usd<=20');
      expect(narrowed.optimizations[0]?.type).toBe('narrowing');
    });
  });

  describe('query explanation helpers', () => {
    it('describes mapped constraints and generates alternative strategies when format is fixed', () => {
      const mappings: ConceptMapping[] = [
        { operator: 'c', value: 'u', confidence: 0.95 },
        { operator: 't', value: 'instant', confidence: 0.9 },
        { operator: 'usd', value: '5', comparison: '<=', confidence: 0.85 },
        { operator: 'o', value: 'counter target spell', confidence: 0.8 },
      ];

      const explanation = generateExplanation(mappings, {
        optimize_for: 'precision',
        format: 'modern',
        max_results: 20,
      });
      const alternatives = generateAlternatives(
        createEmptyParsedQuery(),
        mappings,
        { optimize_for: 'precision', format: 'modern', max_results: 20 },
        buildBaseQuery
      );

      expect(explanation).toContain('Cards that are blue');
      expect(explanation).toContain('instant cards');
      expect(explanation).toContain('with counter target spell effects');
      expect(explanation).toContain('priced <=$5');
      expect(explanation).toContain('legal in modern format');

      expect(alternatives).toHaveLength(3);
      expect(alternatives.every((alternative) => alternative.type === 'optimization')).toBe(true);
      expect(alternatives.some((alternative) => alternative.description.includes('budget'))).toBe(true);
    });
  });

  describe('realistic prompt evaluation', () => {
    it('broadens a budget counterspell query while preserving the main intent', async () => {
      const parser = new NaturalLanguageParser();
      const mockClient = {
        searchCards: vi.fn(async ({ query }: { query: string }) => ({
          total_cards: query.includes('usd:<=10') ? 12 : 0,
          data: [],
        })),
      };
      const builder = new QueryBuilderEngine(new ConceptExtractor(), mockClient as never);

      const parsed = parser.parse('blue counterspells under $5 for modern', {
        targetFormat: 'modern',
        optimizationStrategy: 'precision',
        maxResults: 20,
      });
      const result = await builder.build(parsed, {
        optimize_for: 'precision',
        format: 'modern',
        max_results: 20,
      });

      expect(result.query).toContain('f:modern');
      expect(result.query).toContain('usd:<=10');
      expect(result.query).toContain('c:>=u');
      expect(result.query).toContain('instant OR sorcery');
      expect(result.optimizations.some((optimization) => optimization.type === 'broadening')).toBe(true);
      expect(result.explanation).toContain('priced <=$5');
    });

    it('narrows an overly broad budget artifact search for commander', async () => {
      const parser = new NaturalLanguageParser();
      const mockClient = {
        searchCards: vi.fn(async () => ({
          total_cards: 350,
          data: [],
        })),
      };
      const builder = new QueryBuilderEngine(new ConceptExtractor(), mockClient as never);

      const parsed = parser.parse('budget artifact cards for commander', {
        targetFormat: 'commander',
        optimizationStrategy: 'precision',
        maxResults: 20,
      });
      const result = await builder.build(parsed, {
        optimize_for: 'precision',
        format: 'commander',
        max_results: 20,
      });

      expect(result.query).toContain('t:artifact');
      expect(result.query).toContain('f:commander');
      expect(result.query).toContain('usd:<=10');
      expect(result.optimizations.some((optimization) => optimization.type === 'narrowing')).toBe(true);
      expect(result.explanation).toContain('artifact cards');
    });
  });
});
