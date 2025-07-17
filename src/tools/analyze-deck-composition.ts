import { ScryfallClient } from '../services/scryfall-client.js';
import { ValidationError } from '../types/mcp-types.js';

/**
 * MCP Tool for analyzing deck composition, mana curve, and balance
 */
export class AnalyzeDeckCompositionTool {
  readonly name = 'analyze_deck_composition';
  readonly description = 'Analyze deck composition, mana curve, card types, and provide balance recommendations';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      deck_list: {
        type: 'string',
        description: 'List of card names in the deck, one per line or comma-separated'
      },
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'standardbrawl'],
        description: 'Format to analyze for (affects recommendations)'
      },
      strategy: {
        type: 'string',
        enum: ['aggro', 'midrange', 'control', 'combo', 'ramp', 'tribal', 'unknown'],
        default: 'unknown',
        description: 'Deck strategy archetype'
      },
      commander: {
        type: 'string',
        description: 'Commander card name (for Commander/Brawl formats)'
      }
    },
    required: ['deck_list']
  };

  constructor(private readonly scryfallClient: ScryfallClient) {}

  /**
   * Validate parameters
   */
  private validateParams(args: unknown): {
    deck_list: string;
    format?: string;
    strategy: string;
    commander?: string;
  } {
    if (!args || typeof args !== 'object') {
      throw new ValidationError('Invalid parameters');
    }

    const params = args as any;

    if (!params.deck_list || typeof params.deck_list !== 'string') {
      throw new ValidationError('Deck list is required and must be a string');
    }

    if (params.format) {
      const validFormats = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'standardbrawl'];
      if (!validFormats.includes(params.format)) {
        throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`);
      }
    }

    const strategy = params.strategy || 'unknown';
    const validStrategies = ['aggro', 'midrange', 'control', 'combo', 'ramp', 'tribal', 'unknown'];
    if (!validStrategies.includes(strategy)) {
      throw new ValidationError(`Strategy must be one of: ${validStrategies.join(', ')}`);
    }

    return {
      deck_list: params.deck_list.trim(),
      format: params.format,
      strategy,
      commander: params.commander
    };
  }

  async execute(args: unknown) {
    try {
      const params = this.validateParams(args);
      
      // Parse deck list
      const cardNames = this.parseDeckList(params.deck_list);
      
      if (cardNames.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No valid card names found in deck list. Please provide a list of card names separated by commas or newlines.'
          }],
          isError: true
        };
      }

      // Fetch card data
      const cardData = await this.fetchCardData(cardNames);
      
      if (cardData.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'Unable to fetch data for any cards in the deck list. Please check card names and try again.'
          }],
          isError: true
        };
      }

      // Analyze composition
      const analysis = this.analyzeComposition(cardData);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(analysis, params);
      
      // Format response
      const responseText = this.formatAnalysisResponse(analysis, recommendations, params);
      
      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          content: [{
            type: 'text',
            text: `Validation error: ${error.message}`
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Parse deck list into individual card names
   */
  private parseDeckList(deckList: string): string[] {
    const lines = deckList.split(/[\n,]/).map(line => line.trim());
    const cardNames: string[] = [];
    
    for (const line of lines) {
      if (!line) continue;
      
      // Handle various formats: "4 Lightning Bolt", "Lightning Bolt", "4x Lightning Bolt"
      const match = line.match(/^(?:\d+x?\s+)?(.+)$/);
      if (match) {
        const cardName = match[1].trim();
        if (cardName) {
          cardNames.push(cardName);
        }
      }
    }
    
    return [...new Set(cardNames)]; // Remove duplicates
  }

  /**
   * Fetch card data for all cards in the deck
   */
  private async fetchCardData(cardNames: string[]): Promise<any[]> {
    const cardData: any[] = [];
    
    for (const cardName of cardNames) {
      try {
        const card = await this.scryfallClient.getCard({ identifier: cardName });
        cardData.push(card);
      } catch (error) {
        // Skip cards that can't be found
        continue;
      }
    }
    
    return cardData;
  }

  /**
   * Analyze deck composition
   */
  private analyzeComposition(cardData: any[]) {
    const analysis: any = {
      totalCards: cardData.length,
      manaCurve: {},
      typeBreakdown: {},
      colorBreakdown: {},
      rarityBreakdown: {},
      averageCMC: 0,
      expensiveCards: [],
      keyCards: [],
      problems: []
    };

    let totalCMC = 0;
    
    // Analyze each card
    for (const card of cardData) {
      const cmc = card.cmc || 0;
      const types = card.type_line?.toLowerCase() || '';
      const colors = card.color_identity || [];
      const rarity = card.rarity || 'common';
      const price = parseFloat(card.prices?.usd || '0');
      
      // Mana curve
      analysis.manaCurve[cmc] = (analysis.manaCurve[cmc] || 0) + 1;
      totalCMC += cmc;
      
      // Type breakdown
      if (types.includes('creature')) {
        analysis.typeBreakdown.creatures = (analysis.typeBreakdown.creatures || 0) + 1;
      } else if (types.includes('instant')) {
        analysis.typeBreakdown.instants = (analysis.typeBreakdown.instants || 0) + 1;
      } else if (types.includes('sorcery')) {
        analysis.typeBreakdown.sorceries = (analysis.typeBreakdown.sorceries || 0) + 1;
      } else if (types.includes('artifact')) {
        analysis.typeBreakdown.artifacts = (analysis.typeBreakdown.artifacts || 0) + 1;
      } else if (types.includes('enchantment')) {
        analysis.typeBreakdown.enchantments = (analysis.typeBreakdown.enchantments || 0) + 1;
      } else if (types.includes('planeswalker')) {
        analysis.typeBreakdown.planeswalkers = (analysis.typeBreakdown.planeswalkers || 0) + 1;
      } else if (types.includes('land')) {
        analysis.typeBreakdown.lands = (analysis.typeBreakdown.lands || 0) + 1;
      }
      
      // Color breakdown
      for (const color of colors) {
        analysis.colorBreakdown[color] = (analysis.colorBreakdown[color] || 0) + 1;
      }
      
      // Rarity breakdown
      analysis.rarityBreakdown[rarity] = (analysis.rarityBreakdown[rarity] || 0) + 1;
      
      // Expensive cards (>$5)
      if (price > 5) {
        analysis.expensiveCards.push({ name: card.name, price });
      }
      
      // Key cards (mythic/rare with relevant abilities)
      if ((rarity === 'mythic' || rarity === 'rare') && card.oracle_text) {
        analysis.keyCards.push(card.name);
      }
    }
    
    analysis.averageCMC = totalCMC / cardData.length;
    
    // Sort expensive cards by price
    analysis.expensiveCards.sort((a: any, b: any) => b.price - a.price);
    
    return analysis;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(analysis: any, params: any): string[] {
    const recommendations: string[] = [];
    const { strategy, format } = params;
    
    // Mana curve recommendations
    if (analysis.averageCMC > 4 && strategy === 'aggro') {
      recommendations.push('⚡ Mana curve too high for aggro - consider more 1-2 mana cards');
    } else if (analysis.averageCMC < 2.5 && strategy === 'control') {
      recommendations.push('🏰 Mana curve too low for control - consider more high-impact cards');
    }
    
    // Land count recommendations
    const landCount = analysis.typeBreakdown.lands || 0;
    const expectedLands = format === 'commander' ? 37 : format === 'brawl' ? 24 : 24;
    
    if (landCount < expectedLands - 2) {
      recommendations.push(`🌍 Consider adding ${expectedLands - landCount} more lands`);
    } else if (landCount > expectedLands + 2) {
      recommendations.push(`🌍 Consider reducing lands by ${landCount - expectedLands}`);
    }
    
    // Creature count recommendations
    const creatureCount = analysis.typeBreakdown.creatures || 0;
    const totalNonLands = analysis.totalCards - landCount;
    
    if (strategy === 'aggro' && creatureCount < totalNonLands * 0.6) {
      recommendations.push('⚔️ Aggro decks typically want 60%+ creatures');
    } else if (strategy === 'control' && creatureCount > totalNonLands * 0.3) {
      recommendations.push('🛡️ Control decks typically want fewer creatures');
    }
    
    // Color balance recommendations
    const colorCount = Object.keys(analysis.colorBreakdown).length;
    if (colorCount > 3) {
      recommendations.push('🎨 Consider focusing on fewer colors for better consistency');
    }
    
    // Expensive cards warning
    if (analysis.expensiveCards.length > 5) {
      const totalCost = analysis.expensiveCards.reduce((sum: number, card: any) => sum + card.price, 0);
      recommendations.push(`💰 Deck contains ${analysis.expensiveCards.length} expensive cards (total: $${totalCost.toFixed(2)})`);
    }
    
    return recommendations;
  }

  /**
   * Format analysis response
   */
  private formatAnalysisResponse(analysis: any, recommendations: string[], params: any): string {
    let response = `**Deck Composition Analysis**\n\n`;
    
    // Basic stats
    response += `📊 **Overview:**\n`;
    response += `• Total Cards: ${analysis.totalCards}\n`;
    response += `• Average CMC: ${analysis.averageCMC.toFixed(2)}\n`;
    if (params.strategy !== 'unknown') {
      response += `• Strategy: ${params.strategy}\n`;
    }
    if (params.format) {
      response += `• Format: ${params.format}\n`;
    }
    response += '\n';
    
    // Mana curve
    response += `⚡ **Mana Curve:**\n`;
    for (let i = 0; i <= 7; i++) {
      const count = analysis.manaCurve[i] || 0;
      if (count > 0) {
        const bar = '█'.repeat(Math.max(1, Math.floor(count / 2)));
        response += `• ${i}${i === 7 ? '+' : ''} CMC: ${count} ${bar}\n`;
      }
    }
    response += '\n';
    
    // Type breakdown
    response += `🃏 **Card Types:**\n`;
    for (const [type, count] of Object.entries(analysis.typeBreakdown)) {
      response += `• ${type}: ${count}\n`;
    }
    response += '\n';
    
    // Color breakdown
    if (Object.keys(analysis.colorBreakdown).length > 0) {
      response += `🎨 **Color Identity:**\n`;
      const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
      for (const [color, count] of Object.entries(analysis.colorBreakdown)) {
        const colorName = colorNames[color as keyof typeof colorNames] || color;
        response += `• ${colorName}: ${count}\n`;
      }
      response += '\n';
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      response += `💡 **Recommendations:**\n`;
      for (const rec of recommendations) {
        response += `${rec}\n`;
      }
      response += '\n';
    }
    
    // Expensive cards
    if (analysis.expensiveCards.length > 0) {
      response += `💰 **Most Expensive Cards:**\n`;
      for (const card of analysis.expensiveCards.slice(0, 5)) {
        response += `• ${card.name}: $${card.price.toFixed(2)}\n`;
      }
      response += '\n';
    }
    
    // Key cards
    if (analysis.keyCards.length > 0) {
      response += `⭐ **Key Cards:**\n`;
      for (const cardName of analysis.keyCards.slice(0, 8)) {
        response += `• ${cardName}\n`;
      }
    }
    
    return response;
  }
}