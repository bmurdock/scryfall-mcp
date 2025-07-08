import { ScryfallClient } from '../services/scryfall-client.js';
import { ValidationError, ScryfallAPIError, BatchCardAnalysisParams } from '../types/mcp-types.js';

/**
 * MCP Tool for analyzing multiple cards simultaneously for various metrics
 */
export class BatchCardAnalysisTool {
  readonly name = 'batch_card_analysis';
  readonly description = 'Analyze multiple cards for legality, prices, synergies, or deck composition';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      card_list: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of card names to analyze',
        minItems: 1,
        maxItems: 100
      },
      analysis_type: {
        type: 'string',
        enum: ['legality', 'prices', 'synergy', 'composition', 'comprehensive'],
        description: 'Type of analysis to perform'
      },
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'],
        description: 'Format for legality analysis'
      },
      currency: {
        type: 'string',
        enum: ['usd', 'eur', 'tix'],
        default: 'usd',
        description: 'Currency for price analysis'
      },
      include_suggestions: {
        type: 'boolean',
        default: false,
        description: 'Include improvement suggestions'
      },
      group_by: {
        type: 'string',
        enum: ['type', 'cmc', 'color', 'rarity', 'price_range'],
        description: 'How to group analysis results'
      }
    },
    required: ['card_list', 'analysis_type']
  };

  constructor(private readonly scryfallClient: ScryfallClient) {}

  /**
   * Validate parameters
   */
  private validateParams(args: unknown): {
    card_list: string[];
    analysis_type: string;
    format?: string;
    currency: string;
    include_suggestions: boolean;
    group_by?: string;
  } {
    if (!args || typeof args !== 'object') {
      throw new ValidationError('Invalid parameters');
    }

    const params = args as BatchCardAnalysisParams;

    if (!Array.isArray(params.card_list) || params.card_list.length === 0) {
      throw new ValidationError('Card list is required and must be a non-empty array');
    }

    if (params.card_list.length > 100) {
      throw new ValidationError('Card list cannot exceed 100 cards');
    }

    if (!params.card_list.every((card: string) => typeof card === 'string' && card.trim().length > 0)) {
      throw new ValidationError('All cards in the list must be non-empty strings');
    }

    if (!params.analysis_type || typeof params.analysis_type !== 'string') {
      throw new ValidationError('Analysis type is required and must be a string');
    }

    const validAnalysisTypes = ['legality', 'prices', 'synergy', 'composition', 'comprehensive'];
    if (!validAnalysisTypes.includes(params.analysis_type)) {
      throw new ValidationError(`Analysis type must be one of: ${validAnalysisTypes.join(', ')}`);
    }

    if (params.format) {
      const validFormats = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'];
      if (!validFormats.includes(params.format)) {
        throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`);
      }
    }

    const currency = params.currency || 'usd';
    const validCurrencies = ['usd', 'eur', 'tix'];
    if (!validCurrencies.includes(currency)) {
      throw new ValidationError(`Currency must be one of: ${validCurrencies.join(', ')}`);
    }

    const includeSuggestions = params.include_suggestions ?? false;
    if (typeof includeSuggestions !== 'boolean') {
      throw new ValidationError('Include suggestions must be a boolean');
    }

    if (params.group_by) {
      const validGroupBy = ['type', 'cmc', 'color', 'rarity', 'price_range'];
      if (!validGroupBy.includes(params.group_by)) {
        throw new ValidationError(`Group by must be one of: ${validGroupBy.join(', ')}`);
      }
    }

    return {
      card_list: params.card_list.map((card: string) => card.trim()),
      analysis_type: params.analysis_type,
      format: params.format,
      currency,
      include_suggestions: includeSuggestions,
      group_by: params.group_by
    };
  }

  async execute(args: unknown) {
    try {
      // Validate parameters
      const params = this.validateParams(args);

      // Fetch all cards
      const cards = await this.fetchCards(params.card_list);

      // Perform analysis based on type
      let analysisResult: string;
      switch (params.analysis_type) {
        case 'legality':
          analysisResult = this.analyzeLegality(cards, params.format);
          break;
        case 'prices':
          analysisResult = this.analyzePrices(cards, params.currency);
          break;
        case 'synergy':
          analysisResult = this.analyzeSynergy(cards);
          break;
        case 'composition':
          analysisResult = this.analyzeComposition(cards);
          break;
        case 'comprehensive':
          analysisResult = this.analyzeComprehensive(cards, params);
          break;
        default:
          throw new ValidationError(`Unknown analysis type: ${params.analysis_type}`);
      }

      // Add suggestions if requested
      if (params.include_suggestions) {
        analysisResult += this.generateSuggestions(cards, params);
      }

      return {
        content: [
          {
            type: 'text',
            text: analysisResult
          }
        ]
      };

    } catch (error) {
      // Handle validation errors
      if (error instanceof ValidationError) {
        return {
          content: [
            {
              type: 'text',
              text: `Validation error: ${error.message}`
            }
          ],
          isError: true
        };
      }

      // Generic error handling
      return {
        content: [
          {
            type: 'text',
            text: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Fetch all cards from the card list
   */
  private async fetchCards(cardList: string[]): Promise<any[]> {
    const cards: any[] = [];
    const notFound: string[] = [];

    // Use batch processing for efficiency
    for (const cardName of cardList) {
      try {
        const card = await this.scryfallClient.getCard({ identifier: cardName });
        cards.push(card);
      } catch (error) {
        if (error instanceof ScryfallAPIError && error.status === 404) {
          notFound.push(cardName);
        } else {
          throw error;
        }
      }
    }

    if (notFound.length > 0) {
      throw new ValidationError(`Cards not found: ${notFound.join(', ')}`);
    }

    return cards;
  }

  /**
   * Analyze format legality
   */
  private analyzeLegality(cards: any[], format?: string): string {
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
        banned.forEach(card => result += `- ${card.name}\n`);
        result += '\n';
      }

      if (restricted.length > 0) {
        result += `**Restricted Cards:**\n`;
        restricted.forEach(card => result += `- ${card.name}\n`);
        result += '\n';
      }
    } else {
      // Show legality across all formats
      const formats = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'];
      result += `**Format Legality Summary:**\n`;
      
      for (const fmt of formats) {
        const legal = cards.filter(card => card.legalities[fmt] === 'legal').length;
        result += `- ${fmt.charAt(0).toUpperCase() + fmt.slice(1)}: ${legal}/${cards.length} legal\n`;
      }
    }

    return result;
  }

  /**
   * Analyze prices
   */
  private analyzePrices(cards: any[], currency: string): string {
    let result = `# Price Analysis (${currency.toUpperCase()})\n\n`;
    
    const cardsWithPrices = cards.filter(card => (card.prices as any)[currency]);
    const prices = cardsWithPrices.map(card => parseFloat((card.prices as any)[currency]));
    
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

    // Price breakdown
    const expensive = cardsWithPrices.filter(card => parseFloat((card.prices as any)[currency]) >= 10);
    const moderate = cardsWithPrices.filter(card => {
      const price = parseFloat((card.prices as any)[currency]);
      return price >= 1 && price < 10;
    });
    const budget = cardsWithPrices.filter(card => parseFloat((card.prices as any)[currency]) < 1);

    result += `**Price Categories:**\n`;
    result += `- Expensive (≥$10): ${expensive.length} cards\n`;
    result += `- Moderate ($1-$10): ${moderate.length} cards\n`;
    result += `- Budget (<$1): ${budget.length} cards\n\n`;

    if (expensive.length > 0) {
      result += `**Most Expensive Cards:**\n`;
      expensive
        .sort((a, b) => parseFloat((b.prices as any)[currency]) - parseFloat((a.prices as any)[currency]))
        .slice(0, 5)
        .forEach(card => {
          result += `- ${card.name}: ${currency.toUpperCase()} ${(card.prices as any)[currency]}\n`;
        });
    }

    return result;
  }

  /**
   * Analyze synergy patterns
   */
  private analyzeSynergy(cards: any[]): string {
    let result = `# Synergy Analysis\n\n`;
    
    // Analyze types
    const types = new Map<string, number>();
    const keywords = new Map<string, number>();
    const mechanics = new Map<string, number>();

    cards.forEach(card => {
      // Extract types
      const cardTypes = card.type_line.toLowerCase().split(/[\s—]+/);
      cardTypes.forEach((type: string) => {
        if (type && type !== '—') {
          types.set(type, (types.get(type) || 0) + 1);
        }
      });

      // Extract keywords and mechanics from oracle text
      if (card.oracle_text) {
        const text = card.oracle_text.toLowerCase();
        
        // Common keywords
        const keywordList = ['flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 'first strike', 'double strike'];
        keywordList.forEach(keyword => {
          if (text.includes(keyword)) {
            keywords.set(keyword, (keywords.get(keyword) || 0) + 1);
          }
        });

        // Common mechanics
        const mechanicList = ['proliferate', 'scry', 'surveil', 'explore', 'convoke', 'delve'];
        mechanicList.forEach(mechanic => {
          if (text.includes(mechanic)) {
            mechanics.set(mechanic, (mechanics.get(mechanic) || 0) + 1);
          }
        });
      }
    });

    // Report common types
    result += `**Common Types:**\n`;
    Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([type, count]) => {
        result += `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${count} cards\n`;
      });

    // Report common keywords
    if (keywords.size > 0) {
      result += `\n**Common Keywords:**\n`;
      Array.from(keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([keyword, count]) => {
          result += `- ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}: ${count} cards\n`;
        });
    }

    // Report common mechanics
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

  /**
   * Analyze deck composition
   */
  private analyzeComposition(cards: any[]): string {
    let result = `# Composition Analysis\n\n`;
    result += `**Total Cards:** ${cards.length}\n\n`;

    // Mana curve analysis
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

    // Color distribution
    const colors = new Map<string, number>();
    const colorIdentity = new Map<string, number>();
    
    cards.forEach(card => {
      // Count individual colors in mana cost
      if (card.mana_cost) {
        const colorMatches = card.mana_cost.match(/[WUBRG]/g) || [];
        colorMatches.forEach((color: string) => {
          colors.set(color, (colors.get(color) || 0) + 1);
        });
      }

      // Count color identity
      if (card.color_identity && card.color_identity.length > 0) {
        const identity = card.color_identity.sort().join('');
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

  /**
   * Comprehensive analysis combining all types
   */
  private analyzeComprehensive(cards: any[], params: any): string {
    let result = `# Comprehensive Analysis\n\n`;
    
    result += this.analyzeLegality(cards, params.format);
    result += '\n---\n\n';
    result += this.analyzePrices(cards, params.currency);
    result += '\n---\n\n';
    result += this.analyzeComposition(cards);
    result += '\n---\n\n';
    result += this.analyzeSynergy(cards);

    return result;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(cards: any[], params: any): string {
    let suggestions = `\n\n# Suggestions\n\n`;

    // Format-specific suggestions
    if (params.format) {
      const illegal = cards.filter(card => card.legalities[params.format] !== 'legal');
      if (illegal.length > 0) {
        suggestions += `**Format Compliance:**\n`;
        suggestions += `- Consider replacing ${illegal.length} cards that are not legal in ${params.format}\n`;
      }
    }

    // Price suggestions
    const expensiveCards = cards.filter(card => {
      const price = parseFloat((card.prices as any)[params.currency] || '0');
      return price >= 20;
    });
    
    if (expensiveCards.length > 0) {
      suggestions += `**Budget Optimization:**\n`;
      suggestions += `- Consider finding alternatives for ${expensiveCards.length} expensive cards (≥$20)\n`;
    }

    // Mana curve suggestions
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
}
