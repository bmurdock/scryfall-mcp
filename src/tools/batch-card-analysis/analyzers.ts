import { Prices, ScryfallCard } from '../../types/scryfall-api.js';
import { ValidatedBatchCardAnalysisParams } from './types.js';

export const getPriceForCurrency = (prices: Prices, currency: string): string | undefined =>
  prices[currency as keyof Prices];

export function analyzeLegality(cards: ScryfallCard[], format?: ValidatedBatchCardAnalysisParams['format']): string {
  let result = `# Legality Analysis\n\n`;
  result += `**Total Cards:** ${cards.length}\n\n`;

  if (format) {
    const legal = cards.filter(card => card.legalities[format] === 'legal');
    const banned = cards.filter(card => card.legalities[format] === 'banned');
    const restricted = cards.filter(card => card.legalities[format] === 'restricted');
    const notLegal = cards.filter(card => !['legal', 'banned', 'restricted'].includes(card.legalities[format]));

    result += `**${format.toUpperCase()} Legality:**\n`;
    result += `- Legal: ${legal.length} cards\n`;
    result += `- Banned: ${banned.length} cards\n`;
    result += `- Restricted: ${restricted.length} cards\n`;
    result += `- Not Legal: ${notLegal.length} cards\n\n`;

    if (banned.length > 0) {
      result += `**Banned Cards:**\n`;
      banned.forEach(card => { result += `- ${card.name}\n`; });
      result += '\n';
    }

    if (restricted.length > 0) {
      result += `**Restricted Cards:**\n`;
      restricted.forEach(card => { result += `- ${card.name}\n`; });
      result += '\n';
    }
  } else {
    const formats: NonNullable<ValidatedBatchCardAnalysisParams['format']>[] = [
      'standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'
    ];
    result += `**Format Legality Summary:**\n`;

    for (const fmt of formats) {
      const legal = cards.filter(card => card.legalities[fmt] === 'legal').length;
      result += `- ${fmt.charAt(0).toUpperCase() + fmt.slice(1)}: ${legal}/${cards.length} legal\n`;
    }
  }

  return result;
}

export function analyzePrices(cards: ScryfallCard[], currency: string): string {
  let result = `# Price Analysis (${currency.toUpperCase()})\n\n`;

  const cardsWithPrices = cards.filter(card => getPriceForCurrency(card.prices, currency));
  const prices = cardsWithPrices.map(card => parseFloat(getPriceForCurrency(card.prices, currency) || '0'));

  if (prices.length === 0) {
    return result + 'No price data available for the specified currency.\n';
  }

  const totalValue = prices.reduce((sum, price) => sum + price, 0);
  const averagePrice = totalValue / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  result += `**Summary:**\n`;
  result += `- Total Value: ${currency.toUpperCase()} ${totalValue.toFixed(2)}\n`;
  result += `- Average Price: ${currency.toUpperCase()} ${averagePrice.toFixed(2)}\n`;
  result += `- Price Range: ${currency.toUpperCase()} ${minPrice.toFixed(2)} - ${currency.toUpperCase()} ${maxPrice.toFixed(2)}\n`;
  result += `- Cards with Prices: ${cardsWithPrices.length}/${cards.length}\n\n`;

  const expensive = cardsWithPrices.filter(card => parseFloat(getPriceForCurrency(card.prices, currency) || '0') >= 10);
  const moderate = cardsWithPrices.filter(card => {
    const price = parseFloat(getPriceForCurrency(card.prices, currency) || '0');
    return price >= 1 && price < 10;
  });
  const budget = cardsWithPrices.filter(card => parseFloat(getPriceForCurrency(card.prices, currency) || '0') < 1);

  result += `**Price Categories:**\n`;
  result += `- Expensive (≥$10): ${expensive.length} cards\n`;
  result += `- Moderate ($1-$10): ${moderate.length} cards\n`;
  result += `- Budget (<$1): ${budget.length} cards\n\n`;

  if (expensive.length > 0) {
    result += `**Most Expensive Cards:**\n`;
    expensive
      .sort((a, b) => parseFloat(getPriceForCurrency(b.prices, currency) || '0') - parseFloat(getPriceForCurrency(a.prices, currency) || '0'))
      .slice(0, 5)
      .forEach(card => {
        result += `- ${card.name}: ${currency.toUpperCase()} ${getPriceForCurrency(card.prices, currency) || 'N/A'}\n`;
      });
  }

  return result;
}

export function analyzeSynergy(cards: ScryfallCard[]): string {
  let result = `# Synergy Analysis\n\n`;

  const types = new Map<string, number>();
  const keywords = new Map<string, number>();
  const mechanics = new Map<string, number>();

  cards.forEach(card => {
    const cardTypes = card.type_line.toLowerCase().split(/[\s—]+/);
    cardTypes.forEach(type => {
      if (type && type !== '—') {
        types.set(type, (types.get(type) || 0) + 1);
      }
    });

    if (card.oracle_text) {
      const text = card.oracle_text.toLowerCase();
      const keywordList = ['flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 'first strike', 'double strike'];
      keywordList.forEach(keyword => {
        if (text.includes(keyword)) {
          keywords.set(keyword, (keywords.get(keyword) || 0) + 1);
        }
      });

      const mechanicList = ['proliferate', 'scry', 'surveil', 'explore', 'convoke', 'delve'];
      mechanicList.forEach(mechanic => {
        if (text.includes(mechanic)) {
          mechanics.set(mechanic, (mechanics.get(mechanic) || 0) + 1);
        }
      });
    }
  });

  result += `**Common Types:**\n`;
  Array.from(types.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([type, count]) => {
      result += `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${count} cards\n`;
    });

  if (keywords.size > 0) {
    result += `\n**Common Keywords:**\n`;
    Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([keyword, count]) => {
        result += `- ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}: ${count} cards\n`;
      });
  }

  if (mechanics.size > 0) {
    result += `\n**Common Mechanics:**\n`;
    Array.from(mechanics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([mechanic, count]) => {
        result += `- ${mechanic.charAt(0).toUpperCase() + mechanic.slice(1)}: ${count} cards\n`;
      });
  }

  return result;
}

export function analyzeComposition(cards: ScryfallCard[]): string {
  let result = `# Composition Analysis\n\n`;
  result += `**Total Cards:** ${cards.length}\n\n`;

  const manaCurve = new Map<number, number>();
  cards.forEach(card => {
    const cmc = card.cmc || 0;
    manaCurve.set(cmc, (manaCurve.get(cmc) || 0) + 1);
  });

  result += `**Mana Curve:**\n`;
  for (let i = 0; i <= 10; i++) {
    const count = manaCurve.get(i) || 0;
    if (count > 0 || i <= 7) {
      result += `- ${i}${i >= 7 ? '+' : ''}: ${count} cards\n`;
    }
  }

  const colors = new Map<string, number>();
  const colorIdentity = new Map<string, number>();

  cards.forEach(card => {
    if (card.mana_cost) {
      const colorMatches = card.mana_cost.match(/[WUBRG]/g) || [];
      colorMatches.forEach(color => {
        colors.set(color, (colors.get(color) || 0) + 1);
      });
    }

    if (card.color_identity && card.color_identity.length > 0) {
      const identity = [...card.color_identity].sort().join('');
      colorIdentity.set(identity, (colorIdentity.get(identity) || 0) + 1);
    } else {
      colorIdentity.set('Colorless', (colorIdentity.get('Colorless') || 0) + 1);
    }
  });

  result += `\n**Color Distribution:**\n`;
  const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
  Object.entries(colorNames).forEach(([symbol, name]) => {
    const count = colors.get(symbol) || 0;
    result += `- ${name}: ${count} symbols\n`;
  });

  result += `\n**Color Identity:**\n`;
  Array.from(colorIdentity.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([identity, count]) => {
      result += `- ${identity || 'Colorless'}: ${count} cards\n`;
    });

  return result;
}

export function analyzeComprehensive(
  cards: ScryfallCard[],
  params: ValidatedBatchCardAnalysisParams
): string {
  let result = `# Comprehensive Analysis\n\n`;
  result += analyzeLegality(cards, params.format);
  result += '\n---\n\n';
  result += analyzePrices(cards, params.currency);
  result += '\n---\n\n';
  result += analyzeComposition(cards);
  result += '\n---\n\n';
  result += analyzeSynergy(cards);
  return result;
}

export function generateSuggestions(
  cards: ScryfallCard[],
  params: ValidatedBatchCardAnalysisParams
): string {
  let suggestions = `\n\n# Suggestions\n\n`;

  if (params.format) {
    const illegal = cards.filter(card => card.legalities[params.format!] !== 'legal');
    if (illegal.length > 0) {
      suggestions += `**Format Compliance:**\n`;
      suggestions += `- Consider replacing ${illegal.length} cards that are not legal in ${params.format}\n`;
    }
  }

  const expensiveCards = cards.filter(card => {
    const price = parseFloat(getPriceForCurrency(card.prices, params.currency || 'usd') || '0');
    return price >= 20;
  });

  if (expensiveCards.length > 0) {
    suggestions += `**Budget Optimization:**\n`;
    suggestions += `- Consider finding alternatives for ${expensiveCards.length} expensive cards (≥$20)\n`;
  }

  const highCmc = cards.filter(card => (card.cmc || 0) >= 6).length;
  const lowCmc = cards.filter(card => (card.cmc || 0) <= 2).length;

  if (highCmc > cards.length * 0.2) {
    suggestions += `**Mana Curve:**\n`;
    suggestions += `- Consider reducing high-cost cards (${highCmc} cards with CMC ≥6)\n`;
  }

  if (lowCmc < cards.length * 0.3) {
    suggestions += `**Early Game:**\n`;
    suggestions += `- Consider adding more low-cost cards for early game presence\n`;
  }

  return suggestions;
}
