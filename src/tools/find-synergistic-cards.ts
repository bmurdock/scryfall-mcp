import { ScryfallClient } from '../services/scryfall-client.js';
import { ValidationError, ScryfallAPIError } from '../types/mcp-types.js';
import { formatSearchResultsAsText } from '../utils/formatters.js';

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

    const params = args as any;

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
      const queries = this.buildSynergyQueries(focusCard, params);

      // Execute searches and combine results
      const allResults: any[] = [];
      for (const query of queries) {
        try {
          const results = await this.scryfallClient.searchCards({
            query,
            limit: Math.ceil(params.limit / queries.length) + 5, // Get extra to account for filtering
            order: 'edhrec'
          });
          allResults.push(...results.data);
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

        const fallbackQueries = this.getFallbackQueries(params.focus_card, fallbackBaseQuery);
        for (const query of fallbackQueries) {
          try {
            const results = await this.scryfallClient.searchCards({
              query,
              limit: params.limit,
              order: 'edhrec'
            });
            allResults.push(...results.data);
            if (allResults.length > 0) break; // Stop once we find some results
          } catch (error) {
            continue;
          }
        }
      }

      // Remove duplicates and filter results
      const uniqueResults = this.filterAndDeduplicateResults(allResults, focusCard, params);

      // Limit results
      const finalResults = uniqueResults.slice(0, params.limit);

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
        responseText += formatSearchResultsAsText(mockSearchResponse);
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

  /**
   * Build synergy search queries based on focus card and parameters
   */
  private buildSynergyQueries(focusCard: any, params: {
    focus_card: string;
    synergy_type?: string;
    format?: string;
    exclude_colors?: string;
    max_cmc?: number;
    include_lands: boolean;
    arena_only: boolean;
  }): string[] {
    const queries: string[] = [];
    let baseQuery = '';

    // Add format constraint
    if (params.format) {
      baseQuery += `legal:${params.format} `;
    }

    // Add color exclusion
    if (params.exclude_colors) {
      for (const color of params.exclude_colors.toLowerCase()) {
        if ('wubrg'.includes(color)) {
          baseQuery += `-c:${color} `;
        }
      }
    }

    // Add CMC constraint
    if (params.max_cmc !== undefined) {
      baseQuery += `cmc<=${params.max_cmc} `;
    }

    // Add land exclusion if not wanted
    if (!params.include_lands) {
      baseQuery += '-t:land ';
    }

    // Add Arena filtering if requested
    if (params.arena_only) {
      baseQuery += 'game:arena ';
    }

    if (focusCard) {
      // Card-based synergy analysis
      queries.push(...this.getCardBasedSynergies(focusCard, baseQuery, params.synergy_type, params.focus_card));
    } else {
      // Theme-based synergy analysis
      queries.push(...this.getThemeBasedSynergies(params.focus_card, baseQuery, params.synergy_type));
    }

    return queries.filter(q => q.trim().length > 0);
  }

  /**
   * Get synergies based on an actual card
   */
  private getCardBasedSynergies(focusCard: any, baseQuery: string, synergyType?: string, originalSearchTerm?: string): string[] {
    const queries: string[] = [];

    // Theme override: If user explicitly wants theme analysis but we found a card,
    // fall back to theme-based analysis using the original search term
    if (synergyType === 'theme' && originalSearchTerm && 
        originalSearchTerm.toLowerCase() !== focusCard.name.toLowerCase()) {
      const themeQueries = this.getThemeBasedSynergies(originalSearchTerm, baseQuery, synergyType);
      queries.push(...themeQueries);
      return queries;
    }

    // Extract card properties
    const types = focusCard.type_line.toLowerCase();
    const oracleText = focusCard.oracle_text?.toLowerCase() || '';
    const keywords = this.extractKeywords(oracleText);

    if (!synergyType || synergyType === 'tribal') {
      // Tribal synergies
      const creatureTypes = this.extractCreatureTypes(types);
      for (const type of creatureTypes) {
        queries.push(`${baseQuery}(o:"${type}" OR t:"${type}")`);
      }
    }

    if (!synergyType || synergyType === 'keyword') {
      // Keyword synergies
      for (const keyword of keywords) {
        queries.push(`${baseQuery}o:"${keyword}"`);
      }
    }

    if (!synergyType || synergyType === 'mechanic') {
      // Mechanic synergies based on oracle text patterns
      const mechanics = this.extractMechanics(oracleText);
      for (const mechanic of mechanics) {
        queries.push(`${baseQuery}o:"${mechanic}"`);
      }
    }

    if (!synergyType || synergyType === 'archetype') {
      // Archetype synergies based on card function
      const archetypeQueries = this.getArchetypeSynergies(focusCard, baseQuery);
      queries.push(...archetypeQueries);
    }

    if (synergyType === 'theme') {
      // When user specifies theme synergy but we found a card, 
      // fall back to theme-based analysis using the original search term
      if (originalSearchTerm) {
        const themeQueries = this.getThemeBasedSynergies(originalSearchTerm, baseQuery, synergyType);
        queries.push(...themeQueries);
      }
    }

    return queries;
  }

  /**
   * Get synergies based on a theme or keyword
   */
  private getThemeBasedSynergies(theme: string, baseQuery: string, synergyType?: string): string[] {
    const queries: string[] = [];
    const normalizedTheme = theme.toLowerCase();
    const words = normalizedTheme.split(/\s+/);

    // For tribal themes, extract creature type
    if (normalizedTheme.includes('tribal') || synergyType === 'tribal') {
      const creatureType = words.find(word => 
        !['tribal', 'deck', 'theme', 'synergy'].includes(word)
      );
      if (creatureType) {
        // Search for creatures of that type
        queries.push(`${baseQuery}t:${creatureType}`);
        // Search for cards that care about that creature type
        queries.push(`${baseQuery}o:"${creatureType}"`);
        // Search for cards that reference the creature type in rules text
        queries.push(`${baseQuery}o:"${creatureType}s you control"`);
      }
    }

    // Direct oracle text search for shorter themes
    if (theme.length <= 20) {
      queries.push(`${baseQuery}o:"${theme}"`);
    }

    // Search for individual words in the theme
    for (const word of words) {
      if (word.length >= 4 && !['tribal', 'deck', 'theme', 'synergy', 'cards'].includes(word)) {
        queries.push(`${baseQuery}o:"${word}"`);
        queries.push(`${baseQuery}t:"${word}"`);
      }
    }

    // Common synergy patterns
    if (normalizedTheme.includes('counter')) {
      queries.push(`${baseQuery}(o:"counter" OR o:"+1/+1" OR o:"proliferate")`);
    }

    if (normalizedTheme.includes('artifact')) {
      // Comprehensive artifact ecosystem searches
      queries.push(`${baseQuery}t:artifact`); // Actual artifact cards
      queries.push(`${baseQuery}(o:"artifact" OR o:"metalcraft" OR o:"affinity")`); // Artifact synergy
      queries.push(`${baseQuery}(o:"equipment" OR o:"attach" OR o:"equip")`); // Equipment synergy
      queries.push(`${baseQuery}(o:"construct" OR o:"golem" OR o:"thopter")`); // Artifact creatures
      queries.push(`${baseQuery}(t:"artifact creature" OR o:"fabricate")`); // Artifact creature support
    }

    if (normalizedTheme.includes('graveyard')) {
      queries.push(`${baseQuery}(o:"graveyard" OR o:"from your graveyard" OR o:"flashback" OR o:"unearth")`);
    }

    if (normalizedTheme.includes('token')) {
      queries.push(`${baseQuery}(o:"token" OR o:"create" OR o:"populate")`);
    }

    if (normalizedTheme.includes('burn') || normalizedTheme.includes('damage')) {
      queries.push(`${baseQuery}(o:"damage" OR o:"burn" OR o:"deals damage")`);
    }

    if (normalizedTheme.includes('lifegain') || normalizedTheme.includes('life')) {
      queries.push(`${baseQuery}(o:"gain life" OR o:"lifelink" OR o:"life")`);
    }

    return queries.filter(q => q.trim().length > 0);
  }

  /**
   * Extract creature types from type line
   */
  private extractCreatureTypes(typeLine: string): string[] {
    const commonTypes = [
      'human', 'elf', 'goblin', 'zombie', 'spirit', 'angel', 'demon', 'dragon',
      'wizard', 'warrior', 'knight', 'soldier', 'beast', 'elemental', 'vampire',
      'merfolk', 'pirate', 'dinosaur', 'cat', 'bird', 'horror', 'construct',
      'artifact', 'enchantment', 'planeswalker', 'giant', 'dwarf', 'troll',
      'ogre', 'orc', 'minotaur', 'centaur', 'sphinx', 'hydra', 'phoenix'
    ];
    
    return commonTypes.filter(type => typeLine.includes(type));
  }

  /**
   * Extract keywords from oracle text
   */
  private extractKeywords(oracleText: string): string[] {
    const keywords = [
      'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
      'first strike', 'double strike', 'hexproof', 'indestructible',
      'flash', 'prowess', 'menace', 'reach', 'defender', 'ward', 'protection',
      'shroud', 'fear', 'intimidate', 'landwalk', 'horsemanship', 'shadow',
      'banding', 'rampage', 'bushido', 'ninjutsu', 'splice', 'affinity',
      'convoke', 'delve', 'emerge', 'improvise', 'undaunted'
    ];
    
    return keywords.filter(keyword => oracleText.includes(keyword));
  }

  /**
   * Extract mechanics from oracle text
   */
  private extractMechanics(oracleText: string): string[] {
    const mechanics = [
      'proliferate', 'scry', 'surveil', 'explore', 'adapt', 'amass',
      'convoke', 'delve', 'emerge', 'escape', 'flashback', 'madness',
      'morph', 'suspend', 'unearth', 'cycling', 'kicker', 'multikicker'
    ];
    
    return mechanics.filter(mechanic => oracleText.includes(mechanic));
  }

  /**
   * Get archetype-based synergies
   */
  private getArchetypeSynergies(focusCard: any, baseQuery: string): string[] {
    const queries: string[] = [];
    const oracleText = focusCard.oracle_text?.toLowerCase() || '';
    const types = focusCard.type_line?.toLowerCase() || '';
    const colors = focusCard.color_identity || [];

    // Spell-based synergies
    if (types.includes('instant') || types.includes('sorcery')) {
      if (oracleText.includes('damage')) {
        queries.push(`${baseQuery}(o:"damage" OR o:"burn" OR o:"direct damage")`);
        queries.push(`${baseQuery}(o:"prowess" OR o:"magecraft" OR o:"whenever you cast")`);
      }
      if (oracleText.includes('counter')) {
        queries.push(`${baseQuery}(o:"counter" OR o:"counterspell")`);
      }
      if (oracleText.includes('draw')) {
        queries.push(`${baseQuery}(o:"draw" OR o:"card advantage")`);
      }
    }

    // Creature synergies
    if (types.includes('creature')) {
      const power = parseInt(focusCard.power) || 0;
      const toughness = parseInt(focusCard.toughness) || 0;
      
      // Aggressive creatures
      if (power >= 3 && focusCard.cmc <= 3) {
        queries.push(`${baseQuery}(o:"haste" OR o:"attack" OR o:"combat")`);
      }
      
      // Defensive creatures
      if (toughness >= 4) {
        queries.push(`${baseQuery}(o:"defender" OR o:"vigilance" OR o:"prevent")`);
      }
      
      // Utility creatures
      if (oracleText.includes('when') || oracleText.includes('whenever')) {
        queries.push(`${baseQuery}(o:"enters" OR o:"leaves" OR o:"sacrifice")`);
      }
    }

    // Enchantment synergies
    if (types.includes('enchantment')) {
      queries.push(`${baseQuery}(t:enchantment OR o:"enchantment")`);
      if (types.includes('aura')) {
        queries.push(`${baseQuery}(o:"attach" OR o:"equipped" OR o:"enchant")`);
      }
    }

    // Artifact synergies
    if (types.includes('artifact')) {
      queries.push(`${baseQuery}(t:artifact OR o:"artifact" OR o:"metalcraft")`);
    }

    // Color-based synergies
    if (colors.length === 1) {
      const color = colors[0];
      queries.push(`${baseQuery}(c:${color.toLowerCase()} OR o:"${this.getColorName(color)}")`);
    }

    return queries;
  }

  /**
   * Get color name from color code
   */
  private getColorName(colorCode: string): string {
    const colorMap: Record<string, string> = {
      'W': 'white',
      'U': 'blue', 
      'B': 'black',
      'R': 'red',
      'G': 'green'
    };
    return colorMap[colorCode.toUpperCase()] || colorCode;
  }

  /**
   * Get fallback queries when primary searches fail
   */
  private getFallbackQueries(theme: string, baseQuery: string): string[] {
    const queries: string[] = [];
    const normalizedTheme = theme.toLowerCase();

    // Single-word fallbacks
    const words = normalizedTheme.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3) {
        queries.push(`${baseQuery}t:${word}`);
        queries.push(`${baseQuery}o:${word}`);
      }
    }

    // Popular archetype fallbacks
    if (normalizedTheme.includes('artifact')) {
      queries.push(`${baseQuery}t:artifact`); // Priority 1: Actual artifacts
      queries.push(`${baseQuery}o:"artifact"`); // Priority 2: Cards that mention artifacts
      queries.push(`${baseQuery}(o:"metalcraft" OR o:"affinity" OR o:"improvise")`); // Priority 3: Artifact mechanics
      queries.push(`${baseQuery}t:equipment`); // Priority 4: Equipment
    }

    if (normalizedTheme.includes('enchantment')) {
      queries.push(`${baseQuery}t:enchantment`);
      queries.push(`${baseQuery}o:enchantment`);
    }

    if (normalizedTheme.includes('token')) {
      queries.push(`${baseQuery}o:token`);
      queries.push(`${baseQuery}o:create`);
    }

    return queries;
  }

  /**
   * Filter and deduplicate results
   */
  private filterAndDeduplicateResults(results: any[], focusCard: any, params: any): any[] {
    const seen = new Set<string>();
    const filtered: any[] = [];

    for (const card of results) {
      // Skip duplicates
      if (seen.has(card.id)) continue;
      seen.add(card.id);

      // Skip the focus card itself
      if (focusCard && card.id === focusCard.id) continue;

      // Skip if name matches focus card (for theme searches)
      if (card.name.toLowerCase() === params.focus_card.toLowerCase()) continue;

      filtered.push(card);
    }

    return filtered;
  }
}
