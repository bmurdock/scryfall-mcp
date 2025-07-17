import { ScryfallClient } from '../services/scryfall-client.js';
import { ValidationError } from '../types/mcp-types.js';

/**
 * MCP Tool for suggesting mana base composition and land recommendations
 */
export class SuggestManaBaseTool {
  readonly name = 'suggest_mana_base';
  readonly description = 'Suggest optimal mana base composition and land recommendations for a deck';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      color_requirements: {
        type: 'string',
        description: 'Color requirements (e.g., "WU", "RBG", "WUBRG")'
      },
      deck_size: {
        type: 'number',
        default: 60,
        minimum: 40,
        maximum: 250,
        description: 'Total deck size'
      },
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'standardbrawl'],
        description: 'Format to suggest lands for'
      },
      strategy: {
        type: 'string',
        enum: ['aggro', 'midrange', 'control', 'combo', 'ramp'],
        default: 'midrange',
        description: 'Deck strategy archetype'
      },
      average_cmc: {
        type: 'number',
        minimum: 0,
        maximum: 10,
        description: 'Average converted mana cost of non-land cards'
      },
      budget: {
        type: 'string',
        enum: ['budget', 'moderate', 'expensive', 'no_limit'],
        default: 'moderate',
        description: 'Budget constraint for land recommendations'
      },
      color_intensity: {
        type: 'object',
        properties: {
          W: { type: 'number', minimum: 0, maximum: 10 },
          U: { type: 'number', minimum: 0, maximum: 10 },
          B: { type: 'number', minimum: 0, maximum: 10 },
          R: { type: 'number', minimum: 0, maximum: 10 },
          G: { type: 'number', minimum: 0, maximum: 10 }
        },
        description: 'Color intensity requirements (1-10 scale)'
      },
      special_requirements: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['enters_untapped', 'basic_types', 'nonbasic_hate_protection', 'utility_lands', 'combo_lands']
        },
        description: 'Special mana base requirements'
      }
    },
    required: ['color_requirements']
  };

  constructor(private readonly scryfallClient: ScryfallClient) {}

  private validateParams(args: unknown): {
    color_requirements: string;
    deck_size: number;
    format?: string;
    strategy: string;
    average_cmc?: number;
    budget: string;
    color_intensity?: Record<string, number>;
    special_requirements: string[];
  } {
    if (!args || typeof args !== 'object') {
      throw new ValidationError('Invalid parameters');
    }

    const params = args as any;

    if (!params.color_requirements || typeof params.color_requirements !== 'string') {
      throw new ValidationError('Color requirements are required');
    }

    // Validate color requirements format
    const validColors = new Set(['W', 'U', 'B', 'R', 'G']);
    const colors = params.color_requirements.toUpperCase();
    for (const color of colors) {
      if (!validColors.has(color)) {
        throw new ValidationError(`Invalid color: ${color}. Use W, U, B, R, G`);
      }
    }

    const deck_size = params.deck_size || 60;
    if (typeof deck_size !== 'number' || deck_size < 40 || deck_size > 250) {
      throw new ValidationError('Deck size must be between 40 and 250');
    }

    const strategy = params.strategy || 'midrange';
    const validStrategies = ['aggro', 'midrange', 'control', 'combo', 'ramp'];
    if (!validStrategies.includes(strategy)) {
      throw new ValidationError(`Strategy must be one of: ${validStrategies.join(', ')}`);
    }

    const budget = params.budget || 'moderate';
    const validBudgets = ['budget', 'moderate', 'expensive', 'no_limit'];
    if (!validBudgets.includes(budget)) {
      throw new ValidationError(`Budget must be one of: ${validBudgets.join(', ')}`);
    }

    return {
      color_requirements: colors,
      deck_size,
      format: params.format,
      strategy,
      average_cmc: params.average_cmc,
      budget,
      color_intensity: params.color_intensity,
      special_requirements: params.special_requirements || []
    };
  }

  async execute(args: unknown) {
    try {
      const params = this.validateParams(args);
      
      // Calculate land count
      const landCount = this.calculateLandCount(params);
      
      // Calculate color distribution
      const colorDistribution = this.calculateColorDistribution(params, landCount);
      
      // Generate land recommendations
      const landRecommendations = await this.generateLandRecommendations(params, colorDistribution);
      
      // Format response
      const responseText = this.formatManaBaseResponse(params, landCount, colorDistribution, landRecommendations);
      
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
   * Calculate optimal land count based on strategy and average CMC
   */
  private calculateLandCount(params: any): number {
    const { deck_size, strategy, average_cmc } = params;
    
    // Base land count ratios by strategy
    const baseRatios = {
      aggro: 0.35,    // 35% lands
      midrange: 0.40, // 40% lands  
      control: 0.42,  // 42% lands
      combo: 0.38,    // 38% lands
      ramp: 0.45      // 45% lands
    };
    
    let baseCount = Math.round(deck_size * baseRatios[strategy as keyof typeof baseRatios]);
    
    // Adjust for average CMC
    if (average_cmc !== undefined) {
      if (average_cmc > 4) {
        baseCount += Math.round((average_cmc - 4) * 2);
      } else if (average_cmc < 2.5) {
        baseCount -= Math.round((2.5 - average_cmc) * 2);
      }
    }
    
    // Format-specific adjustments
    if (params.format === 'commander') {
      baseCount = Math.max(36, Math.min(40, baseCount));
    } else if (params.format === 'brawl') {
      baseCount = Math.max(22, Math.min(26, baseCount));
    }
    
    return Math.max(Math.round(deck_size * 0.30), Math.min(Math.round(deck_size * 0.50), baseCount));
  }

  /**
   * Calculate color distribution for lands
   */
  private calculateColorDistribution(params: any, landCount: number): Record<string, number> {
    const { color_requirements, color_intensity } = params;
    const colors = color_requirements.split('');
    
    if (colors.length === 1) {
      // Monocolor
      return { [colors[0]]: landCount, colorless: 0 };
    }
    
    // Multi-color distribution
    const distribution: Record<string, number> = {};
    let totalIntensity = 0;
    
    // Calculate total color intensity
    for (const color of colors) {
      const intensity = color_intensity?.[color] || 5; // Default to 5 if not specified
      distribution[color] = intensity;
      totalIntensity += intensity;
    }
    
    // Reserve slots for dual/utility lands
    const reservedSlots = Math.min(Math.floor(landCount * 0.3), colors.length * 2);
    const availableSlots = landCount - reservedSlots;
    
    // Distribute available slots by color intensity
    for (const color of colors) {
      const ratio = distribution[color] / totalIntensity;
      distribution[color] = Math.round(availableSlots * ratio);
    }
    
    distribution.dual = reservedSlots;
    distribution.utility = Math.max(0, landCount - Object.values(distribution).reduce((sum, val) => sum + val, 0));
    
    return distribution;
  }

  /**
   * Generate land recommendations based on format and budget
   */
  private async generateLandRecommendations(params: any, colorDistribution: Record<string, number>): Promise<any> {
    const { format, budget, color_requirements, special_requirements } = params;
    const colors = color_requirements.split('');
    
    const recommendations: any = {
      basics: [],
      duals: [],
      utility: [],
      budget_alternatives: []
    };
    
    // Basic lands
    const basicNames = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
    for (const color of colors) {
      const count = colorDistribution[color] || 0;
      if (count > 0) {
        recommendations.basics.push({
          name: basicNames[color as keyof typeof basicNames],
          count,
          reason: `Primary ${color} source`
        });
      }
    }
    
    // Dual lands by format and budget
    if (colors.length > 1) {
      const dualCount = colorDistribution.dual || 0;
      
      if (format === 'legacy' || format === 'vintage') {
        if (budget === 'no_limit' || budget === 'expensive') {
          recommendations.duals.push({
            name: 'Original Dual Lands',
            count: Math.min(dualCount, 4),
            reason: 'Best fixing available',
            example: `Tundra (${colors.includes('W') && colors.includes('U') ? 'W/U' : 'etc'})`
          });
        }
      }
      
      if (format === 'modern' || format === 'legacy' || format === 'vintage') {
        if (budget !== 'budget') {
          recommendations.duals.push({
            name: 'Fetchlands',
            count: Math.min(dualCount, 8),
            reason: 'Perfect mana fixing',
            example: 'Polluted Delta, Scalding Tarn'
          });
          
          recommendations.duals.push({
            name: 'Shocklands',
            count: Math.min(dualCount, 4),
            reason: 'Fetchable duals',
            example: 'Steam Vents, Hallowed Fountain'
          });
        }
      }
      
      if (format === 'standard' || format === 'pioneer') {
        recommendations.duals.push({
          name: 'Painlands',
          count: Math.min(dualCount, 4),
          reason: 'Immediate access',
          example: 'Shivan Reef, Adarkar Wastes'
        });
        
        recommendations.duals.push({
          name: 'Checklands',
          count: Math.min(dualCount, 4),
          reason: 'Untapped mid-game',
          example: 'Drowned Catacomb, Glacial Fortress'
        });
      }
      
      if (budget === 'budget') {
        recommendations.budget_alternatives.push({
          name: 'Taplands',
          count: dualCount,
          reason: 'Budget-friendly fixing',
          example: 'Temple of Epiphany, Tranquil Cove'
        });
      }
    }
    
    // Utility lands
    const utilityCount = colorDistribution.utility || 0;
    if (utilityCount > 0 && special_requirements.includes('utility_lands')) {
      recommendations.utility.push({
        name: 'Utility Lands',
        count: utilityCount,
        reason: 'Additional value',
        example: 'Ghost Quarter, Mutavault'
      });
    }
    
    return recommendations;
  }

  /**
   * Format the mana base response
   */
  private formatManaBaseResponse(params: any, landCount: number, colorDistribution: Record<string, number>, recommendations: any): string {
    let response = `**Mana Base Suggestion**\n\n`;
    
    // Overview
    response += `🎯 **Overview:**\n`;
    response += `• Colors: ${params.color_requirements}\n`;
    response += `• Strategy: ${params.strategy}\n`;
    response += `• Total Lands: ${landCount}/${params.deck_size}\n`;
    if (params.format) {
      response += `• Format: ${params.format}\n`;
    }
    response += `• Budget: ${params.budget}\n\n`;
    
    // Land count breakdown
    response += `📊 **Land Distribution:**\n`;
    for (const [color, count] of Object.entries(colorDistribution)) {
      if (count > 0 && color !== 'dual' && color !== 'utility') {
        const colorName = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[color as keyof typeof colorDistribution] || color;
        response += `• ${colorName}: ${count} lands\n`;
      }
    }
    if (colorDistribution.dual) {
      response += `• Dual/Fixing: ${colorDistribution.dual} lands\n`;
    }
    if (colorDistribution.utility) {
      response += `• Utility: ${colorDistribution.utility} lands\n`;
    }
    response += '\n';
    
    // Basic lands
    if (recommendations.basics.length > 0) {
      response += `🏔️ **Basic Lands:**\n`;
      for (const basic of recommendations.basics) {
        response += `• ${basic.count}x ${basic.name}\n`;
      }
      response += '\n';
    }
    
    // Dual lands
    if (recommendations.duals.length > 0) {
      response += `🌈 **Dual Lands:**\n`;
      for (const dual of recommendations.duals) {
        response += `• ${dual.count}x ${dual.name}\n`;
        response += `  💡 *${dual.reason}*\n`;
        if (dual.example) {
          response += `  📝 Example: ${dual.example}\n`;
        }
      }
      response += '\n';
    }
    
    // Utility lands
    if (recommendations.utility.length > 0) {
      response += `🛠️ **Utility Lands:**\n`;
      for (const utility of recommendations.utility) {
        response += `• ${utility.count}x ${utility.name}\n`;
        response += `  💡 *${utility.reason}*\n`;
        if (utility.example) {
          response += `  📝 Example: ${utility.example}\n`;
        }
      }
      response += '\n';
    }
    
    // Budget alternatives
    if (recommendations.budget_alternatives.length > 0) {
      response += `💰 **Budget Alternatives:**\n`;
      for (const alt of recommendations.budget_alternatives) {
        response += `• ${alt.count}x ${alt.name}\n`;
        response += `  💡 *${alt.reason}*\n`;
        if (alt.example) {
          response += `  📝 Example: ${alt.example}\n`;
        }
      }
      response += '\n';
    }
    
    // Additional recommendations
    response += `💡 **Additional Tips:**\n`;
    
    if (params.strategy === 'aggro') {
      response += `• Prioritize lands that enter untapped\n`;
      response += `• Consider fewer utility lands for speed\n`;
    } else if (params.strategy === 'control') {
      response += `• Include more utility lands for late game\n`;
      response += `• Consider lands with card selection\n`;
    } else if (params.strategy === 'combo') {
      response += `• Focus on consistency over speed\n`;
      response += `• Include tutoring lands if available\n`;
    }
    
    if (params.color_requirements.length > 2) {
      response += `• Three+ color decks need excellent mana fixing\n`;
      response += `• Consider green ramp spells for color fixing\n`;
    }
    
    return response;
  }
}