import { ScryfallClient } from '../../services/scryfall-client.js';
import { mcpLogger } from '../../services/logger.js';
import { BuildOptions, QueryOptimization } from '../types.js';

export interface TestedQuery {
  query: string;
  optimizations: QueryOptimization[];
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

  const priceRegex = /(?:usd|eur|tix):/;
  if (!priceRegex.test(query)) {
    optimized += ' usd<=50';
  }

  return optimized;
}

function optimizeForRecall(query: string): string {
  let optimized = query;

  optimized = optimized.replace(/pow:>=(\d+)/, (match, value) => {
    const newValue = Math.max(1, parseInt(value, 10) - 1);
    return `pow:>=${newValue}`;
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
  const budgetPriceRegex = /(?:usd|eur|tix):/;
  if (!budgetPriceRegex.test(query)) {
    optimized += ' usd<=5';
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
    const testResult = await scryfallClient.searchCards({
      query,
      limit: 1
    });

    const optimizations: QueryOptimization[] = [];
    let adjustedQuery = query;
    const totalCards = testResult.total_cards ?? 0;

    if (totalCards === 0) {
      adjustedQuery = broadenQuery(query);
      optimizations.push({
        type: 'broadening',
        reason: 'Original query returned no results',
        change: `${query} → ${adjustedQuery}`
      });
    } else if (totalCards > (options.max_results || 20) * 10) {
      adjustedQuery = narrowQuery(query);
      optimizations.push({
        type: 'narrowing',
        reason: `Original query returned ${totalCards} results`,
        change: `${query} → ${adjustedQuery}`
      });
    }

    return { query: adjustedQuery, optimizations };
  } catch (error) {
    mcpLogger.warn(
      { operation: 'query_test', error: error instanceof Error ? error.message : String(error) },
      'Query testing failed'
    );
    return { query, optimizations: [] };
  }
}

function broadenQuery(query: string): string {
  let broadened = query;

  broadened = broadened.replace(/cmc:=(\d+)/, 'cmc<=$1');
  broadened = broadened.replace(/pow:>=(\d+)/, (match, value) => {
    const newValue = Math.max(1, parseInt(value, 10) - 1);
    return `pow:>=${newValue}`;
  });
  broadened = broadened.replace(/usd:<=(\d+)/, (match, value) => {
    const newValue = parseInt(value, 10) * 2;
    return `usd:<=${newValue}`;
  });

  return broadened;
}

function narrowQuery(query: string): string {
  let narrowed = query;

  if (!query.includes('f:')) {
    narrowed += ' f:modern';
  }

  const narrowPriceRegex = /(?:usd|eur|tix):/;
  if (!narrowPriceRegex.test(query)) {
    narrowed += ' usd<=20';
  }

  return narrowed;
}
