# Scryfall MCP Enhancement Proposal: Advanced Search Capabilities

## Executive Summary

### Current State Analysis
The Scryfall MCP server currently provides basic search functionality but significantly underutilizes the sophisticated search syntax capabilities offered by the Scryfall API. After analyzing the comprehensive [Scryfall search syntax documentation](https://scryfall.com/docs/syntax), three critical gaps have been identified:

1. **Limited Query Validation**: Current validation only checks basic syntax errors, missing hundreds of Scryfall-specific operators and providing generic error messages
2. **Manual Query Construction**: AI assistants must manually construct complex queries using Scryfall syntax, creating a high barrier to entry
3. **Underutilized Advanced Features**: Powerful capabilities like tagger tags, advanced filtering, and specialized card properties remain unused

### Proposed Enhancements
This proposal outlines three strategic enhancements that will transform the MCP server into a comprehensive, intelligent search platform:

1. **Enhanced Query Validation and Intelligent Error Handling**
2. **Natural Language Query Builder Tool** 
3. **Advanced Card Discovery Tool Using Underutilized Syntax**

These improvements will reduce the learning curve for AI assistants, unlock unique discovery capabilities, and provide a significantly better user experience while maintaining full compliance with Scryfall API guidelines.

---

## Feature 1: Enhanced Query Validation and Intelligent Error Handling

### Current Implementation Limitations

The existing validation system in `src/utils/validators.ts` only performs rudimentary checks:

```typescript
export function validateScryfallQuery(query: string): void {
  if (!query || query.trim().length === 0) {
    throw new ValidationError('Search query cannot be empty');
  }

  // Only checks parentheses matching - no understanding of Scryfall syntax
  const openParens = (query.match(/\(/g) || []).length;
  const closeParens = (query.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    throw new ValidationError('Unmatched parentheses in search query');
  }

  // Basic boolean operator validation - missing hundreds of Scryfall operators
  if (/^(AND|OR|NOT)\s/i.test(query.trim())) {
    throw new ValidationError('Search query cannot start with a boolean operator');
  }
}
```

**Problems:**
- No validation of Scryfall-specific operators (`c:`, `t:`, `o:`, `f:`, `is:`, `new:`, etc.)
- No understanding of valid values for operators (color names, format names, etc.)
- Generic error messages provide no actionable guidance
- No query refinement suggestions when searches fail

### Proposed Solution

#### Technical Specifications

Create a comprehensive validation and suggestion system with the following components:

```typescript
// Enhanced validation result interface
interface QueryValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: QuerySuggestion[];
  refinedQuery?: string;
  confidence: number; // 0-1 confidence in the query
}

// Validation error with context
interface ValidationError {
  type: 'syntax' | 'operator' | 'value' | 'logic';
  message: string;
  position?: { start: number; end: number };
  suggestion?: string;
}

// Query suggestion for improvements
interface QuerySuggestion {
  type: 'typo_correction' | 'operator_suggestion' | 'value_suggestion' | 'refinement';
  original: string;
  suggested: string;
  reason: string;
  confidence: number;
}
```

#### Implementation Details

**1. Operator Validation System**

```typescript
// Comprehensive operator definitions based on Scryfall documentation
const SCRYFALL_OPERATORS = {
  // Color operators
  'c': { 
    name: 'color',
    aliases: ['color'],
    validValues: ['w', 'u', 'b', 'r', 'g', 'c', 'm', 'white', 'blue', 'black', 'red', 'green', 'colorless', 'multicolor', ...GUILD_NAMES, ...SHARD_NAMES],
    supportsComparison: true,
    examples: ['c:red', 'c>=uw', 'color:grixis']
  },
  'id': {
    name: 'identity',
    aliases: ['identity'],
    validValues: ['w', 'u', 'b', 'r', 'g', 'c', ...GUILD_NAMES, ...SHARD_NAMES],
    supportsComparison: true,
    examples: ['id:esper', 'identity<=bant']
  },
  // Type operators
  't': {
    name: 'type',
    aliases: ['type'],
    validValues: [...CARD_TYPES, ...SUPERTYPES, ...SUBTYPES],
    supportsPartial: true,
    examples: ['t:creature', 'type:legendary', 't:merfolk']
  },
  // Oracle text operators
  'o': {
    name: 'oracle',
    aliases: ['oracle'],
    supportsQuotes: true,
    supportsRegex: true,
    examples: ['o:flying', 'o:"enters the battlefield"', 'o:/^{T}:/']
  },
  // Format operators
  'f': {
    name: 'format',
    aliases: ['format', 'legal'],
    validValues: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'pauper', 'penny', 'historic', 'alchemy'],
    examples: ['f:modern', 'legal:commander']
  },
  // Advanced operators from documentation
  'is': {
    name: 'is',
    validValues: [
      'spell', 'permanent', 'historic', 'party', 'modal', 'vanilla', 'frenchvanilla', 'bear',
      'split', 'flip', 'transform', 'meld', 'leveler', 'dfc', 'mdfc',
      'hybrid', 'phyrexian', 'funny', 'booster', 'commander', 'brawler', 'companion',
      'reserved', 'reprint', 'unique', 'promo', 'spotlight', 'digital', 'full',
      'foil', 'nonfoil', 'etched', 'glossy', 'hires', 'masterpiece'
    ],
    examples: ['is:commander', 'is:reserved', 'is:reprint']
  },
  'new': {
    name: 'new',
    validValues: ['rarity', 'art', 'artist', 'flavor', 'frame', 'language'],
    examples: ['new:art', 'new:frame', 'new:rarity']
  },
  'art': {
    name: 'art',
    aliases: ['atag', 'arttag'],
    description: 'Tagger tags for artwork content',
    examples: ['art:squirrel', 'art:dragon', 'art:forest']
  },
  'function': {
    name: 'function',
    aliases: ['otag', 'oracletag'],
    validValues: ['removal', 'ramp', 'draw', 'counterspell', 'tutor', 'wipe'],
    description: 'Tagger tags for card function',
    examples: ['function:removal', 'function:ramp']
  }
  // ... continue for all operators from Scryfall documentation
};
```

**2. Intelligent Query Parser**

```typescript
export class ScryfallQueryParser {
  private tokenize(query: string): QueryToken[] {
    // Tokenize query into operators, values, boolean logic, parentheses
  }

  private validateTokens(tokens: QueryToken[]): ValidationError[] {
    // Validate each token against known operators and values
  }

  private suggestCorrections(errors: ValidationError[]): QuerySuggestion[] {
    // Generate intelligent suggestions for common mistakes
  }

  private refineQuery(query: string, searchResults?: any): string {
    // Automatically refine queries based on result count and patterns
  }
}
```

**3. Enhanced Validation Function**

```typescript
export async function validateAndSuggestScryfallQuery(
  query: string,
  context?: {
    previousResults?: number;
    userIntent?: string;
    format?: string;
  }
): Promise<QueryValidationResult> {
  const parser = new ScryfallQueryParser();
  const tokens = parser.tokenize(query);
  
  // Validate syntax and operators
  const errors = parser.validateTokens(tokens);
  const warnings = parser.checkForWarnings(tokens);
  const suggestions = parser.suggestCorrections(errors);
  
  // Generate refinement suggestions
  let refinedQuery: string | undefined;
  if (context?.previousResults === 0) {
    refinedQuery = parser.broadenQuery(query);
  } else if (context?.previousResults && context.previousResults > 100) {
    refinedQuery = parser.narrowQuery(query);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    refinedQuery,
    confidence: calculateConfidence(errors, warnings, suggestions)
  };
}
```

#### Integration with Existing Codebase

**Update SearchCardsTool:**

```typescript
// In src/tools/search-cards.ts
async execute(args: unknown) {
  try {
    const params = validateSearchCardsParams(args);
    
    // Enhanced validation with suggestions
    const validationResult = await validateAndSuggestScryfallQuery(params.query);
    
    if (!validationResult.isValid) {
      return {
        content: [{
          type: 'text',
          text: this.formatValidationErrors(validationResult)
        }],
        isError: true
      };
    }
    
    // Use refined query if available
    const finalQuery = validationResult.refinedQuery || params.query;
    
    const results = await this.scryfallClient.searchCards({
      query: finalQuery,
      // ... other params
    });
    
    // If no results, provide suggestions
    if (results.total_cards === 0) {
      const refinementSuggestions = await this.generateRefinementSuggestions(params.query);
      return {
        content: [{
          type: 'text',
          text: `No cards found. Try these suggestions:\n${refinementSuggestions.join('\n')}`
        }]
      };
    }
    
    // ... rest of implementation
  }
}

private formatValidationErrors(result: QueryValidationResult): string {
  let message = 'Query validation issues found:\n\n';
  
  for (const error of result.errors) {
    message += `❌ ${error.message}\n`;
    if (error.suggestion) {
      message += `   💡 Suggestion: ${error.suggestion}\n`;
    }
  }
  
  if (result.suggestions.length > 0) {
    message += '\n🔧 Recommended improvements:\n';
    for (const suggestion of result.suggestions) {
      message += `   • ${suggestion.original} → ${suggestion.suggested} (${suggestion.reason})\n`;
    }
  }
  
  return message;
}
```

#### Benefits for AI Assistants

1. **Intelligent Error Messages**: Instead of "Invalid search syntax", receive "Unknown operator 'colour:' - did you mean 'color:' or 'c:'?"
2. **Proactive Query Refinement**: Automatic suggestions when searches return too many/few results
3. **Learning Support**: AI assistants learn correct Scryfall syntax through detailed feedback
4. **Reduced API Calls**: Catch errors before making API requests

---

## Feature 2: Natural Language Query Builder Tool

### Current Implementation Limitations

The existing search tools require manual construction of Scryfall queries:

```typescript
// Current approach in SearchCardsTool
readonly inputSchema = {
  properties: {
    query: {
      type: 'string',
      description: 'Scryfall search query using their syntax (e.g., "lightning bolt", "c:red type:instant", "set:dom")'
    }
  }
}
```

**Problems:**
- AI assistants must know Scryfall syntax to construct effective queries
- No assistance for converting natural language to search operators
- High barrier to entry for complex searches
- No optimization for different search intents (precision vs. discovery)

### Proposed Solution

#### Technical Specifications

Create a new MCP tool that converts natural language requests into optimized Scryfall queries:

```typescript
export class BuildScryfallQueryTool {
  readonly name = 'build_scryfall_query';
  readonly description = 'Convert natural language requests into optimized Scryfall search queries with explanations';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      natural_query: {
        type: 'string',
        description: 'Natural language description of what you want to find (e.g., "red creatures under $5 for aggressive decks", "blue counterspells in modern")'
      },
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'pauper'],
        description: 'Magic format to restrict search to (optional)'
      },
      optimize_for: {
        type: 'string',
        enum: ['precision', 'recall', 'discovery', 'budget'],
        default: 'precision',
        description: 'Search optimization strategy'
      },
      max_results: {
        type: 'number',
        minimum: 1,
        maximum: 175,
        default: 20,
        description: 'Target number of results'
      },
      price_budget: {
        type: 'object',
        properties: {
          max: { type: 'number', minimum: 0 },
          currency: { type: 'string', enum: ['usd', 'eur', 'tix'], default: 'usd' }
        },
        description: 'Price constraints'
      }
    },
    required: ['natural_query']
  };
}
```

#### Implementation Details

**1. Natural Language Parser**

```typescript
interface ParsedQuery {
  colors: string[];
  types: string[];
  keywords: string[];
  mechanics: string[];
  priceConstraints: PriceConstraint[];
  powerToughness: StatConstraint[];
  manaCost: ManaConstraint[];
  format: string[];
  archetype: string[];
  rarity: string[];
  artist: string[];
  flavorText: string[];
  setConstraints: string[];
  timeConstraints: TimeConstraint[];
  specialProperties: string[];
}

class NaturalLanguageParser {
  private readonly colorPatterns = new Map([
    ['red', 'r'], ['blue', 'u'], ['white', 'w'], ['black', 'b'], ['green', 'g'],
    ['colorless', 'c'], ['multicolor', 'm'],
    // Guild names
    ['azorius', 'wu'], ['dimir', 'ub'], ['rakdos', 'br'], ['gruul', 'rg'], ['selesnya', 'gw'],
    ['orzhov', 'wb'], ['izzet', 'ur'], ['golgari', 'bg'], ['boros', 'rw'], ['simic', 'gu'],
    // Shard names
    ['bant', 'gwu'], ['esper', 'wub'], ['grixis', 'ubr'], ['jund', 'brg'], ['naya', 'rgw'],
    // Wedge names
    ['abzan', 'wbg'], ['jeskai', 'urw'], ['sultai', 'bug'], ['mardu', 'rwb'], ['temur', 'gur']
  ]);

  private readonly archetypePatterns = new Map([
    ['aggressive', { powerMin: 2, cmcMax: 3, keywords: ['haste', 'trample'] }],
    ['control', { types: ['instant', 'sorcery'], functions: ['counterspell', 'removal', 'draw'] }],
    ['midrange', { powerMin: 2, cmcRange: [3, 5] }],
    ['combo', { functions: ['tutor', 'draw'], keywords: ['flash'] }],
    ['ramp', { functions: ['ramp'], types: ['land', 'artifact'] }],
    ['tribal', { requiresTribalType: true }]
  ]);

  private readonly pricePatterns = [
    /under\s*\$?(\d+(?:\.\d{2})?)/i,
    /less\s+than\s*\$?(\d+(?:\.\d{2})?)/i,
    /below\s*\$?(\d+(?:\.\d{2})?)/i,
    /budget.*?\$?(\d+(?:\.\d{2})?)/i,
    /\$(\d+(?:\.\d{2})?)\s*or\s*less/i
  ];

  parse(naturalQuery: string): ParsedQuery {
    const query = naturalQuery.toLowerCase();

    return {
      colors: this.extractColors(query),
      types: this.extractTypes(query),
      keywords: this.extractKeywords(query),
      mechanics: this.extractMechanics(query),
      priceConstraints: this.extractPriceConstraints(query),
      powerToughness: this.extractStatConstraints(query),
      manaCost: this.extractManaConstraints(query),
      format: this.extractFormats(query),
      archetype: this.extractArchetypes(query),
      rarity: this.extractRarity(query),
      artist: this.extractArtist(query),
      flavorText: this.extractFlavorText(query),
      setConstraints: this.extractSets(query),
      timeConstraints: this.extractTimeConstraints(query),
      specialProperties: this.extractSpecialProperties(query)
    };
  }

  private extractColors(query: string): string[] {
    const colors: string[] = [];

    for (const [name, code] of this.colorPatterns) {
      if (query.includes(name)) {
        colors.push(code);
      }
    }

    return [...new Set(colors)];
  }

  private extractPriceConstraints(query: string): PriceConstraint[] {
    const constraints: PriceConstraint[] = [];

    for (const pattern of this.pricePatterns) {
      const match = query.match(pattern);
      if (match) {
        constraints.push({
          max: parseFloat(match[1]),
          currency: 'usd'
        });
      }
    }

    return constraints;
  }

  // ... implement other extraction methods
}
```

**2. Query Builder Engine**

```typescript
class ScryfallQueryBuilder {
  build(parsed: ParsedQuery, options: BuildOptions): BuildResult {
    const queryParts: string[] = [];
    const explanations: string[] = [];

    // Build color constraints
    if (parsed.colors.length > 0) {
      const colorQuery = this.buildColorQuery(parsed.colors, options);
      queryParts.push(colorQuery.query);
      explanations.push(colorQuery.explanation);
    }

    // Build type constraints
    if (parsed.types.length > 0) {
      const typeQuery = this.buildTypeQuery(parsed.types);
      queryParts.push(typeQuery.query);
      explanations.push(typeQuery.explanation);
    }

    // Build price constraints
    if (parsed.priceConstraints.length > 0) {
      const priceQuery = this.buildPriceQuery(parsed.priceConstraints);
      queryParts.push(priceQuery.query);
      explanations.push(priceQuery.explanation);
    }

    // Build archetype-specific constraints
    if (parsed.archetype.length > 0) {
      const archetypeQuery = this.buildArchetypeQuery(parsed.archetype);
      queryParts.push(archetypeQuery.query);
      explanations.push(archetypeQuery.explanation);
    }

    // Apply optimization strategy
    const optimizedQuery = this.optimizeQuery(queryParts.join(' '), options.optimize_for);

    return {
      query: optimizedQuery,
      explanation: explanations.join(' '),
      confidence: this.calculateConfidence(parsed, queryParts),
      alternatives: this.generateAlternatives(parsed, options)
    };
  }

  private buildColorQuery(colors: string[], options: BuildOptions): QueryPart {
    if (colors.length === 1) {
      return {
        query: `c:${colors[0]}`,
        explanation: `Cards that are ${this.getColorName(colors[0])}`
      };
    } else if (colors.length > 1) {
      const colorString = colors.join('');
      return {
        query: `c:${colorString}`,
        explanation: `Cards that are exactly ${colors.map(c => this.getColorName(c)).join(' and ')}`
      };
    }
    return { query: '', explanation: '' };
  }

  private buildArchetypeQuery(archetypes: string[]): QueryPart {
    const archetype = archetypes[0]; // Use first archetype
    const pattern = this.archetypePatterns.get(archetype);

    if (!pattern) return { query: '', explanation: '' };

    const queryParts: string[] = [];
    let explanation = `Cards suitable for ${archetype} strategies: `;

    if (pattern.powerMin) {
      queryParts.push(`pow>=${pattern.powerMin}`);
      explanation += `power ${pattern.powerMin}+, `;
    }

    if (pattern.cmcMax) {
      queryParts.push(`cmc<=${pattern.cmcMax}`);
      explanation += `low mana cost, `;
    }

    if (pattern.keywords) {
      const keywordQuery = pattern.keywords.map(k => `o:${k}`).join(' OR ');
      queryParts.push(`(${keywordQuery})`);
      explanation += `relevant keywords, `;
    }

    return {
      query: queryParts.join(' '),
      explanation: explanation.slice(0, -2) // Remove trailing comma
    };
  }

  private optimizeQuery(baseQuery: string, strategy: string): string {
    switch (strategy) {
      case 'precision':
        // Add constraints to reduce false positives
        return baseQuery;
      case 'recall':
        // Broaden query to catch more results
        return this.broadenQuery(baseQuery);
      case 'discovery':
        // Add interesting constraints for exploration
        return this.addDiscoveryConstraints(baseQuery);
      case 'budget':
        // Add budget-friendly constraints
        return `${baseQuery} usd<=5`;
      default:
        return baseQuery;
    }
  }
}
```

**3. Tool Implementation**

```typescript
export class BuildScryfallQueryTool {
  constructor(private scryfallClient: ScryfallClient) {}

  async execute(args: unknown) {
    try {
      const params = this.validateParams(args);

      // Parse natural language
      const parser = new NaturalLanguageParser();
      const parsed = parser.parse(params.natural_query);

      // Build Scryfall query
      const builder = new ScryfallQueryBuilder();
      const result = builder.build(parsed, {
        optimize_for: params.optimize_for,
        format: params.format,
        max_results: params.max_results,
        price_budget: params.price_budget
      });

      // Test query and refine if needed
      const testResults = await this.scryfallClient.searchCards({
        query: result.query,
        limit: 1
      });

      // Adjust if no results or too many results
      let finalQuery = result.query;
      let adjustmentNote = '';

      if (testResults.total_cards === 0) {
        finalQuery = builder.broadenQuery(result.query);
        adjustmentNote = '\n\n⚠️ Original query returned no results, broadened automatically.';
      } else if (testResults.total_cards > params.max_results * 5) {
        finalQuery = builder.narrowQuery(result.query);
        adjustmentNote = '\n\n⚠️ Original query returned too many results, narrowed automatically.';
      }

      // Format response
      const responseText = this.formatResponse(result, finalQuery, adjustmentNote);

      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  private formatResponse(result: BuildResult, finalQuery: string, adjustmentNote: string): string {
    return `**Generated Scryfall Query:**
\`${finalQuery}\`

**Explanation:**
${result.explanation}

**Confidence:** ${(result.confidence * 100).toFixed(0)}%

**Alternative Queries:**
${result.alternatives.map(alt => `• \`${alt.query}\` - ${alt.description}`).join('\n')}

**Usage:**
You can now use this query with the \`search_cards\` tool or modify it further.${adjustmentNote}`;
  }
}
```

#### Integration with Existing Codebase

**Add to Server Registration:**

```typescript
// In src/server.ts
private tools = [
  new SearchCardsTool(this.scryfallClient),
  new GetCardTool(this.scryfallClient),
  new BuildScryfallQueryTool(this.scryfallClient), // New tool
  // ... other tools
];
```

**Update Documentation:**

```typescript
// Add to tool descriptions in README.md
### 🔧 MCP Tools
- **build_scryfall_query**: Convert natural language requests into optimized Scryfall queries
- **search_cards**: Search for cards using Scryfall search syntax
// ... other tools
```

#### Benefits for AI Assistants

1. **Lower Barrier to Entry**: AI assistants can help users without knowing Scryfall syntax
2. **Intelligent Query Optimization**: Automatic optimization based on search intent
3. **Educational Value**: Shows generated queries with explanations for learning
4. **Fallback Capability**: Provides alternatives when primary queries fail

---

## Feature 3: Advanced Card Discovery Tool Using Underutilized Syntax

### Current Implementation Limitations

Current tools don't leverage many powerful Scryfall features documented in their syntax guide:

```typescript
// Current find-synergistic-cards.ts has basic synergy detection
private getThemeBasedSynergies(theme: string, baseQuery: string): string[] {
  // Limited to basic oracle text searches
  if (theme.length <= 20) {
    queries.push(`${baseQuery}o:"${theme}"`);
  }
  // Missing advanced Scryfall syntax capabilities
}
```

**Underutilized Capabilities:**
- Tagger tags: `art:squirrel`, `function:removal`
- Advanced properties: `is:reserved`, `is:commander`, `new:art`
- Historical analysis: `in:lea`, `year<=1994`, `prints>=10`
- Art and flavor: `a:"john avon"`, `ft:"designed"`
- Frame/border: `frame:2003`, `border:black`, `stamp:oval`

### Proposed Solution

#### Technical Specifications

Create a specialized discovery tool that unlocks unique search capabilities:

```typescript
export class DiscoverCardsAdvancedTool {
  readonly name = 'discover_cards_advanced';
  readonly description = 'Advanced card discovery using specialized Scryfall syntax for unique searches including artwork analysis, historical data, and collectible properties';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      discovery_type: {
        type: 'string',
        enum: ['art_content', 'historical', 'collectible', 'functional', 'aesthetic', 'artist_focus', 'flavor_exploration'],
        description: 'Type of discovery search to perform'
      },
      criteria: {
        type: 'object',
        properties: {
          // Art content discovery
          art_tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Artwork content tags (e.g., ["squirrel", "dragon", "forest"])'
          },

          // Functional discovery
          function_tags: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['removal', 'ramp', 'draw', 'counterspell', 'tutor', 'wipe', 'protection', 'recursion']
            },
            description: 'Card function tags from Scryfall Tagger'
          },

          // Historical discovery
          historical_filters: {
            type: 'object',
            properties: {
              year_range: {
                type: 'object',
                properties: {
                  min: { type: 'number', minimum: 1993 },
                  max: { type: 'number', maximum: 2025 }
                }
              },
              original_sets: {
                type: 'array',
                items: { type: 'string' },
                description: 'Original sets the card appeared in (e.g., ["lea", "leb", "arn"])'
              },
              reprint_analysis: {
                type: 'object',
                properties: {
                  min_prints: { type: 'number', minimum: 1 },
                  max_prints: { type: 'number', minimum: 1 },
                  include_unique: { type: 'boolean', default: false }
                }
              }
            }
          },

          // Collectible aspects
          collectible_aspects: {
            type: 'object',
            properties: {
              reserved_list: { type: 'boolean' },
              new_treatments: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['art', 'frame', 'rarity', 'artist', 'flavor', 'language']
                }
              },
              frame_styles: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['1993', '1997', '2003', '2015', 'future', 'legendary', 'colorshifted', 'tombstone']
                }
              },
              special_properties: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['masterpiece', 'promo', 'spotlight', 'scryfallpreview', 'datestamped']
                }
              }
            }
          },

          // Aesthetic preferences
          aesthetic_preferences: {
            type: 'object',
            properties: {
              border_colors: {
                type: 'array',
                items: { type: 'string', enum: ['black', 'white', 'silver', 'borderless'] }
              },
              foil_treatments: {
                type: 'array',
                items: { type: 'string', enum: ['foil', 'nonfoil', 'etched', 'glossy'] }
              },
              full_art: { type: 'boolean' },
              high_resolution: { type: 'boolean' },
              security_stamps: {
                type: 'array',
                items: { type: 'string', enum: ['oval', 'acorn', 'triangle', 'arena'] }
              }
            }
          },

          // Artist focus
          artist_criteria: {
            type: 'object',
            properties: {
              artist_name: { type: 'string' },
              multiple_artists: { type: 'boolean' },
              new_artist_collaborations: { type: 'boolean' },
              illustration_count: {
                type: 'object',
                properties: {
                  min: { type: 'number' },
                  max: { type: 'number' }
                }
              }
            }
          },

          // Flavor exploration
          flavor_criteria: {
            type: 'object',
            properties: {
              flavor_text_content: { type: 'string' },
              watermark: { type: 'string' },
              story_spotlight: { type: 'boolean' }
            }
          }
        }
      },

      // Standard filtering options
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'pauper'],
        description: 'Format legality filter'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: 25,
        description: 'Number of results to return'
      },
      sort_by: {
        type: 'string',
        enum: ['relevance', 'rarity', 'price', 'release_date', 'artist', 'edhrec'],
        default: 'relevance',
        description: 'Sort order for results'
      }
    },
    required: ['discovery_type']
  };
}
```

#### Implementation Details

**1. Advanced Query Builder**

```typescript
class AdvancedDiscoveryQueryBuilder {
  buildQuery(discoveryType: string, criteria: any, options: any): string {
    let baseQuery = '';

    // Add format constraint if specified
    if (options.format) {
      baseQuery += `f:${options.format} `;
    }

    switch (discoveryType) {
      case 'art_content':
        return this.buildArtContentQuery(criteria, baseQuery);
      case 'historical':
        return this.buildHistoricalQuery(criteria, baseQuery);
      case 'collectible':
        return this.buildCollectibleQuery(criteria, baseQuery);
      case 'functional':
        return this.buildFunctionalQuery(criteria, baseQuery);
      case 'aesthetic':
        return this.buildAestheticQuery(criteria, baseQuery);
      case 'artist_focus':
        return this.buildArtistQuery(criteria, baseQuery);
      case 'flavor_exploration':
        return this.buildFlavorQuery(criteria, baseQuery);
      default:
        throw new ValidationError(`Unknown discovery type: ${discoveryType}`);
    }
  }

  private buildArtContentQuery(criteria: any, baseQuery: string): string {
    const queryParts: string[] = [baseQuery.trim()];

    // Use Scryfall's art tagger tags
    if (criteria.art_tags && criteria.art_tags.length > 0) {
      const artQueries = criteria.art_tags.map((tag: string) => `art:${tag}`);
      queryParts.push(`(${artQueries.join(' OR ')})`);
    }

    return queryParts.filter(p => p.length > 0).join(' ');
  }

  private buildHistoricalQuery(criteria: any, baseQuery: string): string {
    const queryParts: string[] = [baseQuery.trim()];

    // Year range filtering
    if (criteria.historical_filters?.year_range) {
      const { min, max } = criteria.historical_filters.year_range;
      if (min) queryParts.push(`year>=${min}`);
      if (max) queryParts.push(`year<=${max}`);
    }

    // Original set filtering using 'in:' operator
    if (criteria.historical_filters?.original_sets) {
      const setQueries = criteria.historical_filters.original_sets.map((set: string) => `in:${set}`);
      queryParts.push(`(${setQueries.join(' OR ')})`);
    }

    // Reprint analysis
    if (criteria.historical_filters?.reprint_analysis) {
      const { min_prints, max_prints, include_unique } = criteria.historical_filters.reprint_analysis;
      if (min_prints) queryParts.push(`prints>=${min_prints}`);
      if (max_prints) queryParts.push(`prints<=${max_prints}`);
      if (include_unique) queryParts.push('is:unique');
    }

    return queryParts.filter(p => p.length > 0).join(' ');
  }

  private buildCollectibleQuery(criteria: any, baseQuery: string): string {
    const queryParts: string[] = [baseQuery.trim()];

    // Reserved List cards
    if (criteria.collectible_aspects?.reserved_list) {
      queryParts.push('is:reserved');
    }

    // New treatments using 'new:' operator
    if (criteria.collectible_aspects?.new_treatments) {
      const newQueries = criteria.collectible_aspects.new_treatments.map((treatment: string) => `new:${treatment}`);
      queryParts.push(`(${newQueries.join(' OR ')})`);
    }

    // Frame styles using 'frame:' operator
    if (criteria.collectible_aspects?.frame_styles) {
      const frameQueries = criteria.collectible_aspects.frame_styles.map((frame: string) => `frame:${frame}`);
      queryParts.push(`(${frameQueries.join(' OR ')})`);
    }

    // Special properties using 'is:' operator
    if (criteria.collectible_aspects?.special_properties) {
      const propQueries = criteria.collectible_aspects.special_properties.map((prop: string) => `is:${prop}`);
      queryParts.push(`(${propQueries.join(' OR ')})`);
    }

    return queryParts.filter(p => p.length > 0).join(' ');
  }

  private buildFunctionalQuery(criteria: any, baseQuery: string): string {
    const queryParts: string[] = [baseQuery.trim()];

    // Use Scryfall's function tagger tags
    if (criteria.function_tags && criteria.function_tags.length > 0) {
      const functionQueries = criteria.function_tags.map((tag: string) => `function:${tag}`);
      queryParts.push(`(${functionQueries.join(' OR ')})`);
    }

    return queryParts.filter(p => p.length > 0).join(' ');
  }

  private buildAestheticQuery(criteria: any, baseQuery: string): string {
    const queryParts: string[] = [baseQuery.trim()];

    // Border colors using 'border:' operator
    if (criteria.aesthetic_preferences?.border_colors) {
      const borderQueries = criteria.aesthetic_preferences.border_colors.map((border: string) => `border:${border}`);
      queryParts.push(`(${borderQueries.join(' OR ')})`);
    }

    // Foil treatments using 'is:' operator
    if (criteria.aesthetic_preferences?.foil_treatments) {
      const foilQueries = criteria.aesthetic_preferences.foil_treatments.map((foil: string) => `is:${foil}`);
      queryParts.push(`(${foilQueries.join(' OR ')})`);
    }

    // Full art cards
    if (criteria.aesthetic_preferences?.full_art) {
      queryParts.push('is:full');
    }

    // High resolution images
    if (criteria.aesthetic_preferences?.high_resolution) {
      queryParts.push('is:hires');
    }

    // Security stamps using 'stamp:' operator
    if (criteria.aesthetic_preferences?.security_stamps) {
      const stampQueries = criteria.aesthetic_preferences.security_stamps.map((stamp: string) => `stamp:${stamp}`);
      queryParts.push(`(${stampQueries.join(' OR ')})`);
    }

    return queryParts.filter(p => p.length > 0).join(' ');
  }

  private buildArtistQuery(criteria: any, baseQuery: string): string {
    const queryParts: string[] = [baseQuery.trim()];

    // Specific artist using 'a:' operator
    if (criteria.artist_criteria?.artist_name) {
      queryParts.push(`a:"${criteria.artist_criteria.artist_name}"`);
    }

    // Multiple artists using 'artists>' operator
    if (criteria.artist_criteria?.multiple_artists) {
      queryParts.push('artists>1');
    }

    // New artist collaborations using 'new:artist' operator
    if (criteria.artist_criteria?.new_artist_collaborations) {
      queryParts.push('new:artist');
    }

    // Illustration count using 'illustrations' operator
    if (criteria.artist_criteria?.illustration_count) {
      const { min, max } = criteria.artist_criteria.illustration_count;
      if (min) queryParts.push(`illustrations>=${min}`);
      if (max) queryParts.push(`illustrations<=${max}`);
    }

    return queryParts.filter(p => p.length > 0).join(' ');
  }

  private buildFlavorQuery(criteria: any, baseQuery: string): string {
    const queryParts: string[] = [baseQuery.trim()];

    // Flavor text content using 'ft:' operator
    if (criteria.flavor_criteria?.flavor_text_content) {
      queryParts.push(`ft:"${criteria.flavor_criteria.flavor_text_content}"`);
    }

    // Watermark using 'wm:' operator
    if (criteria.flavor_criteria?.watermark) {
      queryParts.push(`wm:${criteria.flavor_criteria.watermark}`);
    }

    // Story spotlight cards
    if (criteria.flavor_criteria?.story_spotlight) {
      queryParts.push('is:spotlight');
    }

    return queryParts.filter(p => p.length > 0).join(' ');
  }
}
```

**2. Tool Implementation**

```typescript
export class DiscoverCardsAdvancedTool {
  constructor(private scryfallClient: ScryfallClient) {}

  async execute(args: unknown) {
    try {
      const params = this.validateParams(args);

      // Build advanced query
      const queryBuilder = new AdvancedDiscoveryQueryBuilder();
      const query = queryBuilder.buildQuery(
        params.discovery_type,
        params.criteria,
        { format: params.format }
      );

      // Execute search with appropriate sorting
      const results = await this.scryfallClient.searchCards({
        query,
        limit: params.limit,
        order: this.mapSortOrder(params.sort_by)
      });

      // Format response with discovery context
      const responseText = this.formatDiscoveryResponse(
        results,
        params.discovery_type,
        query
      );

      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  private formatDiscoveryResponse(results: any, discoveryType: string, query: string): string {
    const typeDescriptions = {
      'art_content': 'Cards with specific artwork content',
      'historical': 'Cards with historical significance',
      'collectible': 'Cards with collectible properties',
      'functional': 'Cards with specific gameplay functions',
      'aesthetic': 'Cards with specific visual characteristics',
      'artist_focus': 'Cards by specific artists or with artist-related properties',
      'flavor_exploration': 'Cards with specific flavor elements'
    };

    let response = `**${typeDescriptions[discoveryType as keyof typeof typeDescriptions]}**\n`;
    response += `*Query used: \`${query}\`*\n\n`;

    if (results.total_cards === 0) {
      response += 'No cards found matching your discovery criteria. Try adjusting your filters or criteria.';
    } else {
      response += formatSearchResultsAsText(results);

      // Add discovery insights
      response += '\n\n**Discovery Insights:**\n';
      response += this.generateDiscoveryInsights(results, discoveryType);
    }

    return response;
  }

  private generateDiscoveryInsights(results: any, discoveryType: string): string {
    const insights: string[] = [];

    switch (discoveryType) {
      case 'art_content':
        insights.push(`Found ${results.total_cards} cards with matching artwork themes`);
        break;
      case 'historical':
        insights.push(`Discovered ${results.total_cards} cards from the specified time period`);
        break;
      case 'collectible':
        insights.push(`Located ${results.total_cards} cards with collectible significance`);
        break;
      case 'functional':
        insights.push(`Identified ${results.total_cards} cards with the specified gameplay functions`);
        break;
      case 'aesthetic':
        insights.push(`Found ${results.total_cards} cards matching your aesthetic preferences`);
        break;
      case 'artist_focus':
        insights.push(`Discovered ${results.total_cards} cards by your specified artist criteria`);
        break;
      case 'flavor_exploration':
        insights.push(`Located ${results.total_cards} cards with matching flavor elements`);
        break;
    }

    return insights.join('\n');
  }

  private mapSortOrder(sortBy: string): string {
    const sortMapping = {
      'relevance': 'name',
      'rarity': 'rarity',
      'price': 'usd',
      'release_date': 'released',
      'artist': 'artist',
      'edhrec': 'edhrec'
    };

    return sortMapping[sortBy as keyof typeof sortMapping] || 'name';
  }
}
```

#### Unique Use Cases for AI Assistants

**Art Content Discovery:**
- "Find cards with squirrels in the artwork" → `art:squirrel`
- "Show me cards with dragons in the art" → `art:dragon`
- "Cards depicting forests or nature scenes" → `art:forest OR art:nature`

**Historical Analysis:**
- "Show me cards from Magic's early years" → `year<=1995`
- "Find cards that were in Alpha but reprinted recently" → `in:lea year>=2020`
- "Cards that have been reprinted many times" → `prints>=10`

**Collectible Properties:**
- "Find Reserved List cards under $100" → `is:reserved usd<=100`
- "Show me cards with new artwork in recent sets" → `new:art year>=2020`
- "Cards with the old card frame" → `frame:1993 OR frame:1997`

**Functional Discovery:**
- "Find all removal spells" → `function:removal`
- "Show me ramp cards" → `function:ramp`
- "Cards that provide card draw" → `function:draw`

**Aesthetic Preferences:**
- "Full art cards with black borders" → `is:full border:black`
- "High resolution foil cards" → `is:hires is:foil`
- "Borderless cards" → `border:borderless`

**Artist Focus:**
- "Show me all cards by John Avon" → `a:"john avon"`
- "Cards with multiple artists" → `artists>1`
- "New collaborations between artists" → `new:artist`

#### Integration with Existing Codebase

**Add to Server Registration:**

```typescript
// In src/server.ts
private tools = [
  new SearchCardsTool(this.scryfallClient),
  new GetCardTool(this.scryfallClient),
  new BuildScryfallQueryTool(this.scryfallClient),
  new DiscoverCardsAdvancedTool(this.scryfallClient), // New tool
  // ... other tools
];
```

#### Benefits for AI Assistants

1. **Unique Discovery Capabilities**: Access to features not available in other Magic tools
2. **Rich Exploration**: Help users discover cards through artwork, history, and aesthetics
3. **Collector Support**: Specialized searches for collectors and enthusiasts
4. **Educational Value**: Learn about Magic's history and artistic evolution

---

## Technical Implementation Plan

### Phase 1: Enhanced Query Validation (Weeks 1-2)

**Dependencies:**
- No external dependencies
- Requires understanding of current validation system

**Implementation Steps:**
1. Create comprehensive operator definitions based on Scryfall documentation
2. Implement `ScryfallQueryParser` class with tokenization and validation
3. Build suggestion engine for common mistakes and typos
4. Update `validateScryfallQuery` function with enhanced capabilities
5. Integrate with existing `SearchCardsTool`
6. Add comprehensive unit tests for validation logic

**Estimated Effort:** 2 weeks
**Risk Level:** Low - No API changes, purely internal validation

### Phase 2: Natural Language Query Builder (Weeks 3-4)

**Dependencies:**
- Phase 1 completion (for query validation)
- Natural language processing patterns

**Implementation Steps:**
1. Implement `NaturalLanguageParser` with pattern recognition
2. Create `ScryfallQueryBuilder` with optimization strategies
3. Build `BuildScryfallQueryTool` MCP tool
4. Add tool to server registration
5. Create comprehensive test suite with various natural language inputs
6. Update documentation and examples

**Estimated Effort:** 2 weeks
**Risk Level:** Medium - Complex parsing logic, requires extensive testing

### Phase 3: Advanced Discovery Tool (Weeks 5-6)

**Dependencies:**
- Phase 1 completion (for validation)
- Understanding of Scryfall's advanced syntax features

**Implementation Steps:**
1. Implement `AdvancedDiscoveryQueryBuilder` with specialized query types
2. Create `DiscoverCardsAdvancedTool` MCP tool
3. Add comprehensive input validation for discovery criteria
4. Implement discovery insights and response formatting
5. Add tool to server registration
6. Create test suite covering all discovery types

**Estimated Effort:** 2 weeks
**Risk Level:** Low-Medium - Well-defined Scryfall syntax, straightforward implementation

### Phase 4: Integration and Documentation (Week 7)

**Dependencies:**
- All previous phases complete

**Implementation Steps:**
1. Update README.md with new tool descriptions and examples
2. Update SCRYFALL_COMPLIANCE.md if needed
3. Add comprehensive JSDoc documentation
4. Create usage examples for each new tool
5. Update MCP tool schemas and descriptions
6. Performance testing and optimization

**Estimated Effort:** 1 week
**Risk Level:** Low - Documentation and integration work

### Total Estimated Timeline: 7 weeks

---

## Code Examples

### Enhanced Validation Usage

```typescript
// Example usage of enhanced validation
const validationResult = await validateAndSuggestScryfallQuery('colour:red typ:creature');

// Result:
{
  isValid: false,
  errors: [
    {
      type: 'operator',
      message: "Unknown operator 'colour:' - did you mean 'color:' or 'c:'?",
      suggestion: 'c:red'
    },
    {
      type: 'operator',
      message: "Unknown operator 'typ:' - did you mean 'type:' or 't:'?",
      suggestion: 't:creature'
    }
  ],
  suggestions: [
    {
      type: 'typo_correction',
      original: 'colour:red typ:creature',
      suggested: 'c:red t:creature',
      reason: 'Corrected operator typos',
      confidence: 0.95
    }
  ],
  refinedQuery: 'c:red t:creature',
  confidence: 0.95
}
```

### Natural Language Query Builder Usage

```typescript
// Example usage of natural language query builder
const result = await buildScryfallQueryTool.execute({
  natural_query: "red creatures under $5 for aggressive decks",
  format: "modern",
  optimize_for: "precision"
});

// Generated query: "c:r t:creature usd<=5 pow>=2 cmc<=3 f:modern"
// Explanation: "Cards that are red creatures under $5 with power 2+ and low mana cost for aggressive strategies in Modern format"
```

### Advanced Discovery Tool Usage

```typescript
// Example usage of advanced discovery tool
const result = await discoverCardsAdvancedTool.execute({
  discovery_type: "art_content",
  criteria: {
    art_tags: ["squirrel", "forest"]
  },
  format: "commander",
  limit: 20
});

// Generated query: "f:commander (art:squirrel OR art:forest)"
// Returns cards with squirrels or forests in the artwork that are legal in Commander
```

---

## Testing Strategy

### Unit Testing

**Validation Testing:**
```typescript
describe('Enhanced Query Validation', () => {
  test('should validate correct Scryfall syntax', () => {
    const result = validateScryfallQuery('c:red t:creature f:modern');
    expect(result.isValid).toBe(true);
  });

  test('should suggest corrections for typos', () => {
    const result = validateScryfallQuery('colour:red');
    expect(result.suggestions[0].suggested).toBe('c:red');
  });

  test('should validate advanced operators', () => {
    const result = validateScryfallQuery('is:commander new:art function:removal');
    expect(result.isValid).toBe(true);
  });
});
```

**Natural Language Parser Testing:**
```typescript
describe('Natural Language Parser', () => {
  test('should parse color names correctly', () => {
    const parser = new NaturalLanguageParser();
    const result = parser.parse('red and blue creatures');
    expect(result.colors).toEqual(['r', 'u']);
  });

  test('should extract price constraints', () => {
    const parser = new NaturalLanguageParser();
    const result = parser.parse('cards under $10');
    expect(result.priceConstraints[0].max).toBe(10);
  });
});
```

### Integration Testing

**API Integration:**
```typescript
describe('Tool Integration', () => {
  test('should generate valid queries that work with Scryfall API', async () => {
    const tool = new BuildScryfallQueryTool(scryfallClient);
    const result = await tool.execute({
      natural_query: 'red creatures in modern'
    });

    // Test that generated query actually works
    const searchResult = await scryfallClient.searchCards({
      query: extractQueryFromResult(result),
      limit: 1
    });

    expect(searchResult.total_cards).toBeGreaterThan(0);
  });
});
```

### End-to-End Testing

**MCP Protocol Testing:**
```typescript
describe('MCP Tool Integration', () => {
  test('should register all new tools correctly', () => {
    const server = new ScryfallMCPServer();
    const tools = server.getRegisteredTools();

    expect(tools).toContain('build_scryfall_query');
    expect(tools).toContain('discover_cards_advanced');
  });

  test('should handle tool execution through MCP protocol', async () => {
    const server = new ScryfallMCPServer();
    const result = await server.handleToolCall('build_scryfall_query', {
      natural_query: 'blue counterspells'
    });

    expect(result.content[0].text).toContain('Generated Scryfall Query:');
  });
});
```

---

## Documentation Updates

### README.md Updates

**Add to Tools Section:**
```markdown
### 🔧 MCP Tools

#### Enhanced Search Tools
- **build_scryfall_query**: Convert natural language requests into optimized Scryfall search queries
  - Input: Natural language description, format preferences, optimization strategy
  - Output: Optimized Scryfall query with explanation and alternatives
  - Example: "red creatures under $5 for aggressive decks" → "c:r t:creature usd<=5 pow>=2 cmc<=3"

- **discover_cards_advanced**: Advanced card discovery using specialized Scryfall syntax
  - Input: Discovery type (art, historical, collectible, etc.) and specific criteria
  - Output: Cards matching advanced discovery criteria with insights
  - Example: Find cards with squirrels in artwork, Reserved List cards, or cards by specific artists

#### Existing Tools (Enhanced)
- **search_cards**: Enhanced with intelligent query validation and error suggestions
  - Now provides detailed error messages and query refinement suggestions
  - Automatic query correction for common typos and syntax errors
```

**Add Usage Examples:**
```markdown
### Advanced Usage Examples

#### Natural Language Query Building
```javascript
// Convert natural language to Scryfall syntax
{
  "tool": "build_scryfall_query",
  "arguments": {
    "natural_query": "blue counterspells in modern under $20",
    "optimize_for": "precision"
  }
}
```

#### Advanced Card Discovery
```javascript
// Find cards with specific artwork content
{
  "tool": "discover_cards_advanced",
  "arguments": {
    "discovery_type": "art_content",
    "criteria": {
      "art_tags": ["dragon", "mountain"]
    },
    "format": "commander"
  }
}

// Discover collectible cards
{
  "tool": "discover_cards_advanced",
  "arguments": {
    "discovery_type": "collectible",
    "criteria": {
      "collectible_aspects": {
        "reserved_list": true,
        "frame_styles": ["1993", "1997"]
      }
    }
  }
}
```
```

### SCRYFALL_COMPLIANCE.md Updates

**Add Advanced Syntax Usage Section:**
```markdown
## Advanced Syntax Compliance

### Tagger Tags Usage
- **Art Tags**: Using `art:` operator for artwork content discovery
- **Function Tags**: Using `function:` operator for gameplay function analysis
- **Compliance**: All tagger tag usage respects Scryfall's data attribution requirements

### Historical Data Usage
- **Year Filtering**: Using `year:` and `date:` operators for temporal analysis
- **Set History**: Using `in:` operator for historical set analysis
- **Reprint Analysis**: Using `prints:` and `sets:` operators for reprint tracking

### Advanced Properties
- **Special Cards**: Using `is:` operator for card properties (reserved, commander, etc.)
- **New Treatments**: Using `new:` operator for tracking new printings and treatments
- **Frame Analysis**: Using `frame:` and `border:` operators for visual analysis
```

This comprehensive enhancement proposal provides a detailed roadmap for significantly improving the Scryfall MCP server's search capabilities while maintaining full compliance with Scryfall's API guidelines and providing substantial value to AI assistants using the server.
```
```
