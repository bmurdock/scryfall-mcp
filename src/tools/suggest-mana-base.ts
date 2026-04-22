import { ScryfallClient } from '../services/scryfall-client.js';
import { ValidationError } from '../types/mcp-types.js';
import { formatManaBaseResponse } from './suggest-mana-base/formatter.js';
import {
  calculateColorDistribution,
  calculateLandCount,
  generateLandRecommendations
} from './suggest-mana-base/planner.js';
import {
  ManaBaseParams,
  SuggestManaBaseInput
} from './suggest-mana-base/types.js';
import {
  normalizeLowercaseString,
  normalizeStringArray,
  normalizeTrimmedString
} from '../utils/input-normalization.js';

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

  constructor(_scryfallClient: ScryfallClient) {
    void _scryfallClient;
  }

  private validateParams(args: unknown): ManaBaseParams {
    if (!args || typeof args !== 'object') {
      throw new ValidationError('Invalid parameters');
    }

    const params = args as SuggestManaBaseInput;
    const normalizedColorRequirements = normalizeTrimmedString(params.color_requirements);
    const normalizedFormat = normalizeLowercaseString(params.format);
    const normalizedStrategy = normalizeLowercaseString(params.strategy);
    const normalizedBudget = normalizeLowercaseString(params.budget);
    const normalizedSpecialRequirements = normalizeStringArray(params.special_requirements);

    if (!normalizedColorRequirements || typeof normalizedColorRequirements !== 'string') {
      throw new ValidationError('Color requirements are required');
    }

    const validColors = new Set(['W', 'U', 'B', 'R', 'G']);
    const colors = normalizedColorRequirements.toUpperCase();
    for (const color of colors) {
      if (!validColors.has(color)) {
        throw new ValidationError(`Invalid color: ${color}. Use W, U, B, R, G`);
      }
    }

    const deckSize = params.deck_size || 60;
    if (typeof deckSize !== 'number' || deckSize < 40 || deckSize > 250) {
      throw new ValidationError('Deck size must be between 40 and 250');
    }

    const strategy = (typeof normalizedStrategy === 'string' ? normalizedStrategy : undefined) || 'midrange';
    const validStrategies = ['aggro', 'midrange', 'control', 'combo', 'ramp'];
    if (!validStrategies.includes(strategy)) {
      throw new ValidationError(`Strategy must be one of: ${validStrategies.join(', ')}`);
    }

    const budget = (typeof normalizedBudget === 'string' ? normalizedBudget : undefined) || 'moderate';
    const validBudgets = ['budget', 'moderate', 'expensive', 'no_limit'];
    if (!validBudgets.includes(budget)) {
      throw new ValidationError(`Budget must be one of: ${validBudgets.join(', ')}`);
    }

    const validSpecialRequirements = [
      'enters_untapped',
      'basic_types',
      'nonbasic_hate_protection',
      'utility_lands',
      'combo_lands'
    ];

    const specialRequirements = Array.isArray(normalizedSpecialRequirements)
      ? normalizedSpecialRequirements.map(requirement =>
        typeof requirement === 'string' ? requirement.trim().toLowerCase() : requirement
      )
      : [];

    if (!specialRequirements.every(
      requirement => typeof requirement === 'string' && validSpecialRequirements.includes(requirement)
    )) {
      throw new ValidationError(
        `Special requirements must be drawn from: ${validSpecialRequirements.join(', ')}`
      );
    }

    return {
      color_requirements: colors,
      deck_size: deckSize,
      format: typeof normalizedFormat === 'string' ? normalizedFormat : undefined,
      strategy,
      average_cmc: params.average_cmc,
      budget,
      color_intensity: params.color_intensity,
      special_requirements: specialRequirements
    };
  }

  async execute(args: unknown) {
    try {
      const params = this.validateParams(args);
      const landCount = calculateLandCount(params);
      const colorDistribution = calculateColorDistribution(params, landCount);
      const landRecommendations = await generateLandRecommendations(params, colorDistribution);
      const responseText = formatManaBaseResponse(
        params,
        landCount,
        colorDistribution,
        landRecommendations
      );

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
}
