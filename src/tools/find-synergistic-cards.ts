import { ScryfallClient } from '../services/scryfall-client.js';
import { ValidationError, ScryfallAPIError } from '../types/mcp-types.js';
import {
  buildSynergyQueries,
  getFallbackQueries
} from './find-synergistic-cards/query-builder.js';
import {
  filterAndDeduplicateResults,
  formatResultsWithSynergyExplanations,
  prioritizeResultsByLayer
} from './find-synergistic-cards/result-formatter.js';
import {
  FindSynergisticCardsInput,
  SynergyCard,
  SynergyLayer
} from './find-synergistic-cards/types.js';

/**
 * MCP Tool for finding cards that synergize with a specific card, theme, or archetype
 */
export class FindSynergisticCardsTool {
  readonly name = 'find_synergistic_cards';
  readonly description = 'Find cards that synergize with a specific card, theme, or archetype';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      focus_card: {
        type: 'string',
        description: 'Card name or theme to build around'
      },
      synergy_type: {
        type: 'string',
        enum: ['tribal', 'combo', 'archetype', 'keyword', 'theme', 'mechanic'],
        description: 'Type of synergy to discover'
      },
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'standardbrawl'],
        description: 'Format legality requirement'
      },
      exclude_colors: {
        type: 'string',
        description: 'Colors to exclude from results (e.g., "rb" to exclude red and black)'
      },
      max_cmc: {
        type: 'number',
        minimum: 0,
        description: 'Maximum mana value'
      },
      include_lands: {
        type: 'boolean',
        default: true,
        description: 'Include synergistic lands'
      },
      limit: {
        type: 'number',
        default: 15,
        minimum: 1,
        maximum: 50,
        description: 'Number of synergistic cards to return'
      },
      arena_only: {
        type: 'boolean',
        default: false,
        description: 'Only return cards available in Arena'
      }
    },
    required: ['focus_card']
  };

  constructor(private readonly scryfallClient: ScryfallClient) {}

  /**
   * Validate parameters
   */
  private validateParams(args: unknown): {
    focus_card: string;
    synergy_type?: string;
    format?: string;
    exclude_colors?: string;
    max_cmc?: number;
    include_lands: boolean;
    limit: number;
    arena_only: boolean;
  } {
    if (!args || typeof args !== 'object') {
      throw new ValidationError('Invalid parameters');
    }

    const params = args as FindSynergisticCardsInput;

    if (!params.focus_card || typeof params.focus_card !== 'string') {
      throw new ValidationError('Focus card is required and must be a string');
    }

    if (params.synergy_type) {
      const validTypes = ['tribal', 'combo', 'archetype', 'keyword', 'theme', 'mechanic'];
      if (!validTypes.includes(params.synergy_type)) {
        throw new ValidationError(`Synergy type must be one of: ${validTypes.join(', ')}`);
      }
    }

    if (params.format) {
      const validFormats = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'standardbrawl'];
      if (!validFormats.includes(params.format)) {
        throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`);
      }
    }

    if (params.exclude_colors && typeof params.exclude_colors !== 'string') {
      throw new ValidationError('Exclude colors must be a string');
    }

    if (params.max_cmc !== undefined) {
      if (typeof params.max_cmc !== 'number' || params.max_cmc < 0) {
        throw new ValidationError('Max CMC must be a non-negative number');
      }
    }

    const includeLands = params.include_lands ?? true;
    if (typeof includeLands !== 'boolean') {
      throw new ValidationError('Include lands must be a boolean');
    }

    const limit = params.limit || 15;
    if (typeof limit !== 'number' || limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be a number between 1 and 50');
    }

    const arenaOnly = params.arena_only ?? false;
    if (typeof arenaOnly !== 'boolean') {
      throw new ValidationError('Arena only must be a boolean');
    }

    return {
      focus_card: params.focus_card.trim(),
      synergy_type: params.synergy_type,
      format: params.format,
      exclude_colors: params.exclude_colors,
      max_cmc: params.max_cmc,
      include_lands: includeLands,
      limit,
      arena_only: arenaOnly
    };
  }

  async execute(args: unknown) {
    try {
      // Validate parameters
      const params = this.validateParams(args);

      // Try to get the focus card to analyze its properties
      let focusCard = null;
      try {
        focusCard = await this.scryfallClient.getCard({ identifier: params.focus_card });
      } catch (error) {
        // If card not found, treat focus_card as a theme/keyword
        if (!(error instanceof ScryfallAPIError && error.status === 404)) {
          throw error;
        }
      }

      // Build synergy search queries
      const queries = buildSynergyQueries(focusCard, params);

      // Execute searches with multi-layered strategy
      const allResults: SynergyCard[] = [];
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        try {
          const results = await this.scryfallClient.searchCards({
            query,
            limit: Math.ceil(params.limit / queries.length) + 5, // Get extra to account for filtering
            order: 'edhrec'
          });
          
          // Categorize results by search layer
          const layer: SynergyLayer = i < 10 ? 'semantic' : (i < 20 ? 'exact' : 'thematic');
          const layerResults: SynergyCard[] = results.data.map(card => ({
            ...card,
            _synergy_layer: layer,
            _synergy_query: query
          }));
          
          allResults.push(...layerResults);
        } catch (error) {
          // Continue with other queries if one fails
          continue;
        }
      }

      // If no results and theme-based, try broader searches
      if (allResults.length === 0 && !focusCard) {
        // Build a basic query with just the format/constraints
        let fallbackBaseQuery = '';
        if (params.format) {
          fallbackBaseQuery += `legal:${params.format} `;
        }
        if (params.exclude_colors) {
          for (const color of params.exclude_colors.toLowerCase()) {
            if ('wubrg'.includes(color)) {
              fallbackBaseQuery += `-c:${color} `;
            }
          }
        }
        if (params.max_cmc !== undefined) {
          fallbackBaseQuery += `cmc<=${params.max_cmc} `;
        }
        if (!params.include_lands) {
          fallbackBaseQuery += '-t:land ';
        }
        if (params.arena_only) {
          fallbackBaseQuery += 'game:arena ';
        }

        const fallbackQueries = getFallbackQueries(params.focus_card, fallbackBaseQuery);
        for (const query of fallbackQueries) {
          try {
            const results = await this.scryfallClient.searchCards({
              query,
              limit: params.limit,
              order: 'edhrec'
            });
            const fallbackResults: SynergyCard[] = results.data.map(card => ({
              ...card,
              _synergy_layer: 'thematic',
              _synergy_query: query
            }));
            allResults.push(...fallbackResults);
            if (allResults.length > 0) break; // Stop once we find some results
          } catch (error) {
            continue;
          }
        }
      }

      // Remove duplicates and filter results with layered prioritization
      const uniqueResults = filterAndDeduplicateResults(allResults, focusCard, params.focus_card);

      // Prioritize results by synergy layer (semantic > exact > thematic)
      const prioritizedResults = prioritizeResultsByLayer(uniqueResults);

      // Limit results
      const finalResults = prioritizedResults.slice(0, params.limit);

      // Format response
      let responseText = `**Synergistic cards for "${params.focus_card}"**`;
      if (params.synergy_type) {
        responseText += ` (${params.synergy_type} synergy)`;
      }
      responseText += ':\n\n';

      if (finalResults.length === 0) {
        responseText += `No synergistic cards found for "${params.focus_card}"`;
        if (params.format) {
          responseText += ` in ${params.format}`;
        }
        responseText += '. Try adjusting your search criteria or synergy type.';
      } else {
        const mockSearchResponse = {
          object: 'list' as const,
          total_cards: finalResults.length,
          has_more: false,
          data: finalResults
        };
        responseText += formatResultsWithSynergyExplanations(mockSearchResponse, focusCard, params.focus_card);
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText
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

}
