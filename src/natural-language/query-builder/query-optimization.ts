import { ScryfallClient } from '../../services/scryfall-client.js';
import { mcpLogger } from '../../services/logger.js';
import { BuildOptions, QueryOptimization, QueryTestSummary } from '../types.js';
import { formatQueryToken } from './query-assembly.js';
import { ScryfallAPIError } from '../../types/mcp-types.js';

export interface TestedQuery {
  query: string;
  optimizations: QueryOptimization[];
  testSummary?: QueryTestSummary;
}

export function applyOptimization(query: string, strategy: string): string {
  switch (strategy) {
    case 'precision':
      return optimizeForPrecision(query);
    case 'recall':
      return optimizeForRecall(query);
    case 'discovery':
      return optimizeForDiscovery(query);
    case 'budget':
      return optimizeForBudget(query);
    default:
      return query;
  }
}

function optimizeForPrecision(query: string): string {
  let optimized = query;

  if (!query.includes('f:')) {
    optimized += ' (f:standard OR f:modern OR f:commander)';
  }

  const priceRegex = /\b(?:usd|eur|tix)(?::|[<>]=?|=)/;
  if (!priceRegex.test(query)) {
    optimized += ` ${formatQueryToken('usd', '50', '<=')}`;
  }

  return optimized;
}

function optimizeForRecall(query: string): string {
  let optimized = query;

  optimized = optimized.replace(/\bpow(?::)?>=(\d+)/, (match, value) => {
    const newValue = Math.max(1, parseInt(value, 10) - 1);
    return formatQueryToken('pow', String(newValue), '>=');
  });

  optimized = optimized.replace(/t:(\w+)(?!\w)/, (match, type) => {
    const relatedTypes = getRelatedTypes(type);
    if (relatedTypes.length > 0) {
      return `(t:${type} OR t:${relatedTypes.join(' OR t:')})`;
    }
    return match;
  });

  return optimized;
}

function optimizeForDiscovery(query: string): string {
  let optimized = query;
  if (!query.includes('is:')) {
    optimized += ' (is:unique OR is:reserved OR is:promo)';
  }
  return optimized;
}

function optimizeForBudget(query: string): string {
  let optimized = query;
  const budgetPriceRegex = /\b(?:usd|eur|tix)(?::|[<>]=?|=)/;
  if (!budgetPriceRegex.test(query)) {
    optimized += ` ${formatQueryToken('usd', '5', '<=')}`;
  }
  return optimized;
}

function getRelatedTypes(type: string): string[] {
  const relatedMap = new Map([
    ['creature', ['planeswalker']],
    ['instant', ['sorcery']],
    ['sorcery', ['instant']],
    ['artifact', ['enchantment']],
    ['enchantment', ['artifact']]
  ]);

  return relatedMap.get(type) || [];
}

export async function testAndAdjustQuery(
  scryfallClient: ScryfallClient,
  query: string,
  options: BuildOptions
): Promise<TestedQuery> {
  try {
    const optimizations: QueryOptimization[] = [];
    let adjustedQuery = query;
    let testSummary = await testQuery(scryfallClient, query);
    const totalCards = testSummary.total_cards;

    if (totalCards === 0) {
      adjustedQuery = broadenQuery(query, options.price_budget);
      if (adjustedQuery !== query) {
        optimizations.push({
          type: 'broadening',
          reason: 'Original query returned no results',
          change: `${query} → ${adjustedQuery}`
        });
      }
    } else if (totalCards > (options.max_results || 20) * 10) {
      adjustedQuery = narrowQuery(query);
      optimizations.push({
        type: 'narrowing',
        reason: `Original query returned ${totalCards} results`,
        change: `${query} → ${adjustedQuery}`
      });
    }

    if (adjustedQuery !== query) {
      try {
        testSummary = await testQuery(scryfallClient, adjustedQuery);
      } catch (error) {
        mcpLogger.warn(
          { operation: 'adjusted_query_test', error: error instanceof Error ? error.message : String(error) },
          'Adjusted query testing failed'
        );
        return { query: adjustedQuery, optimizations };
      }
    }

    return { query: adjustedQuery, optimizations, testSummary };
  } catch (error) {
    mcpLogger.warn(
      { operation: 'query_test', error: error instanceof Error ? error.message : String(error) },
      'Query testing failed'
    );
    return { query, optimizations: [] };
  }
}

async function testQuery(client: ScryfallClient, query: string): Promise<QueryTestSummary> {
  try {
    const result = await client.searchCards({ query, limit: 1 });
    return { total_cards: result.total_cards ?? 0, has_more: result.has_more ?? false };
  } catch (error) {
    // Scryfall represents a valid search with no matches as HTTP 404.
    if (error instanceof ScryfallAPIError && error.status === 404 && error.apiCode === 'not_found') {
      return { total_cards: 0, has_more: false };
    }
    throw error;
  }
}

function broadenQuery(query: string, priceBudget?: BuildOptions['price_budget']): string {
  let broadened = query;

  broadened = broadened.replace(/\bcmc(?::)?=?(\d+)/, (_match, value) => {
    return formatQueryToken('cmc', value, '<=');
  });
  broadened = broadened.replace(/\bpow(?::)?>=(\d+)/, (match, value) => {
    const newValue = Math.max(1, parseInt(value, 10) - 1);
    return formatQueryToken('pow', String(newValue), '>=');
  });
  if (priceBudget?.currency !== 'usd') {
    broadened = broadened.replace(/\busd(?::)?<=(\d+)/, (match, value) => {
      const newValue = parseInt(value, 10) * 2;
      return formatQueryToken('usd', String(newValue), '<=');
    });
  }

  return broadened;
}

function narrowQuery(query: string): string {
  let narrowed = query;

  if (!query.includes('f:')) {
    narrowed += ' f:modern';
  }

  const narrowPriceRegex = /\b(?:usd|eur|tix)(?::|[<>]=?|=)/;
  if (!narrowPriceRegex.test(query)) {
    narrowed += ` ${formatQueryToken('usd', '20', '<=')}`;
  }

  return narrowed;
}
