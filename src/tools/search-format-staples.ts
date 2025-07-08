import { ScryfallClient } from '../services/scryfall-client.js';
import { ValidationError } from '../types/mcp-types.js';
import { formatSearchResultsAsText } from '../utils/formatters.js';

/**
 * MCP Tool for finding format staples and meta-relevant cards
 */
export class SearchFormatStaplesTool {
  readonly name = 'search_format_staples';
  readonly description = 'Find format staples, meta cards, and role-specific cards for competitive play';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'standardbrawl'],
        description: 'Magic format to analyze'
      },
      tier: {
        type: 'string',
        enum: ['top', 'competitive', 'budget', 'fringe'],
        default: 'competitive',
        description: 'Meta tier level'
      },
      role: {
        type: 'string',
        enum: ['removal', 'threats', 'utility', 'lands', 'ramp', 'draw', 'counterspells'],
        description: 'Card role in deck archetypes'
      },
      color_identity: {
        type: 'string',
        description: 'Color identity filter (e.g., "wr", "grixis", "colorless")'
      },
      max_price: {
        type: 'number',
        minimum: 0,
        description: 'Maximum price in USD'
      },
      limit: {
        type: 'number',
        default: 20,
        minimum: 1,
        maximum: 100,
        description: 'Number of results to return'
      }
    },
    required: ['format']
  };

  constructor(private readonly scryfallClient: ScryfallClient) {}

  /**
   * Validate parameters
   */
  private validateParams(args: unknown): {
    format: string;
    tier: string;
    role?: string;
    color_identity?: string;
    max_price?: number;
    limit: number;
  } {
    if (!args || typeof args !== 'object') {
      throw new ValidationError('Invalid parameters');
    }

    const params = args as any;

    if (!params.format || typeof params.format !== 'string') {
      throw new ValidationError('Format is required and must be a string');
    }

    const validFormats = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'standardbrawl'];
    if (!validFormats.includes(params.format)) {
      throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`);
    }

    const tier = params.tier || 'competitive';
    const validTiers = ['top', 'competitive', 'budget', 'fringe'];
    if (!validTiers.includes(tier)) {
      throw new ValidationError(`Tier must be one of: ${validTiers.join(', ')}`);
    }

    if (params.role) {
      const validRoles = ['removal', 'threats', 'utility', 'lands', 'ramp', 'draw', 'counterspells'];
      if (!validRoles.includes(params.role)) {
        throw new ValidationError(`Role must be one of: ${validRoles.join(', ')}`);
      }
    }

    if (params.max_price !== undefined) {
      if (typeof params.max_price !== 'number' || params.max_price < 0) {
        throw new ValidationError('Max price must be a non-negative number');
      }
    }

    const limit = params.limit || 20;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be a number between 1 and 100');
    }

    return {
      format: params.format,
      tier,
      role: params.role,
      color_identity: params.color_identity,
      max_price: params.max_price,
      limit
    };
  }

  async execute(args: unknown) {
    try {
      // Validate parameters
      const params = this.validateParams(args);

      // Build search query
      const query = this.buildSearchQuery(params);

      // Execute search
      const results = await this.scryfallClient.searchCards({
        query,
        limit: params.limit,
        order: this.getOrderForTier(params.tier)
      });

      // Format results
      const responseText = formatSearchResultsAsText(results);

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

  /**
   * Build Scryfall search query based on parameters
   */
  private buildSearchQuery(params: {
    format: string;
    tier: string;
    role?: string;
    color_identity?: string;
    max_price?: number;
  }): string {
    let query = `f:${params.format}`;

    // Add role-specific search terms
    if (params.role) {
      query += ` ${this.getRoleSearchTerms(params.role)}`;
    }

    // Add color identity filter
    if (params.color_identity) {
      query += ` ${this.getColorIdentityFilter(params.color_identity)}`;
    }

    // Add price filter
    if (params.max_price !== undefined) {
      query += ` usd<=${params.max_price}`;
    }

    // Add tier-specific filters
    query += ` ${this.getTierFilter(params.tier)}`;

    return query;
  }

  /**
   * Get search terms for specific card roles
   */
  private getRoleSearchTerms(role: string): string {
    switch (role) {
      case 'removal':
        return '(o:destroy OR o:exile OR o:"deals damage" OR o:"-X/-X")';
      case 'threats':
        return '(t:creature OR t:planeswalker) (pow>=3 OR loyalty>=3)';
      case 'utility':
        return '(t:artifact OR t:enchantment OR (t:instant AND (o:draw OR o:search)))';
      case 'lands':
        return 't:land';
      case 'ramp':
        return '(o:"add mana" OR o:"search for a land" OR (t:artifact AND o:"add"))';
      case 'draw':
        return '(o:"draw cards" OR o:"draw a card" OR o:"draw two")';
      case 'counterspells':
        return '(o:counter AND o:spell)';
      default:
        return '';
    }
  }

  /**
   * Get color identity filter
   */
  private getColorIdentityFilter(colorIdentity: string): string {
    const normalized = colorIdentity.toLowerCase();
    
    // Handle named color combinations
    const colorMappings: Record<string, string> = {
      'grixis': 'c:ubr',
      'esper': 'c:wub',
      'bant': 'c:gwu',
      'naya': 'c:rgw',
      'jund': 'c:brg',
      'mardu': 'c:rwb',
      'temur': 'c:gur',
      'abzan': 'c:wbg',
      'jeskai': 'c:urw',
      'sultai': 'c:bug',
      'colorless': 'c:c'
    };

    if (colorMappings[normalized]) {
      return colorMappings[normalized];
    }

    // Handle direct color combinations (e.g., "wr", "bug")
    if (/^[wubrgc]+$/.test(normalized)) {
      return `c:${normalized}`;
    }

    return '';
  }

  /**
   * Get tier-specific filters
   */
  private getTierFilter(tier: string): string {
    switch (tier) {
      case 'top':
        return 'usd>=5'; // Higher price typically indicates meta relevance
      case 'competitive':
        return 'usd>=1'; // Moderate price floor
      case 'budget':
        return 'usd<=5'; // Budget constraint
      case 'fringe':
        return ''; // No specific filter for fringe cards
      default:
        return '';
    }
  }

  /**
   * Get sort order for tier
   */
  private getOrderForTier(tier: string): string {
    switch (tier) {
      case 'top':
        return 'edhrec'; // EDHREC ranking for popularity
      case 'competitive':
        return 'edhrec';
      case 'budget':
        return 'usd'; // Sort by price for budget
      case 'fringe':
        return 'name'; // Alphabetical for fringe
      default:
        return 'edhrec';
    }
  }
}
