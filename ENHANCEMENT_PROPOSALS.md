# Scryfall MCP Server Enhancement Proposals

## Executive Summary

The current Scryfall MCP Server provides a solid foundation with 5 tools, 2 resources, and 2 prompts, but has significant gaps for common Magic: The Gathering player workflows. This document outlines 8 specific enhancements that will transform the server into a comprehensive tool for MTG players, deck builders, and competitive players.

### Current Gaps Identified

1. **Limited Scryfall API Utilization**: Missing advanced search parameters (unique, direction, price filtering)
2. **Format-Specific Optimization**: No tools designed specifically for competitive format analysis
3. **Card Synergy Discovery**: No intelligent card relationship identification capabilities
4. **Rules Integration**: MTG rules file exists but no tools to query it effectively
5. **Batch Operations**: No efficient analysis of multiple cards simultaneously
6. **Budget-Conscious Building**: Limited price-aware card discovery and alternatives
7. **Meta Analysis**: No tools for format meta breakdown and staple identification

### Proposed Solutions Overview

**8 Enhanced/New Tools** organized by implementation priority:
- **Priority 1** (3 tools): Enhanced existing functionality with low complexity
- **Priority 2** (3 tools): New specialized tools with medium complexity  
- **Priority 3** (2 tools): Advanced tools with higher complexity but high impact

## Priority 1 Enhancements (High Impact, Low Complexity)

### 1. Enhanced `search_cards` Tool

**Current Limitations**: Only uses basic Scryfall search parameters, missing advanced filtering options.

**Enhancement Specifications**:
```typescript
// Add to existing inputSchema properties:
{
  unique: {
    type: 'string',
    enum: ['cards', 'art', 'prints'],
    description: 'Strategy for omitting similar cards',
    default: 'cards'
  },
  direction: {
    type: 'string', 
    enum: ['asc', 'desc', 'auto'],
    description: 'Sort direction',
    default: 'auto'
  },
  include_multilingual: {
    type: 'boolean',
    description: 'Include cards in all languages',
    default: false
  },
  include_variations: {
    type: 'boolean',
    description: 'Include rare card variants',
    default: false
  },
  price_range: {
    type: 'object',
    properties: {
      min: { type: 'number' },
      max: { type: 'number' },
      currency: { type: 'string', enum: ['usd', 'eur', 'tix'], default: 'usd' }
    },
    description: 'Price filtering constraints'
  }
}
```

**Use Cases**:
- "Find Modern-legal red creatures under $5, sorted by power"
- "Show all printings of Lightning Bolt with different artwork"
- "Find budget removal spells in Standard, cheapest first"

**Implementation**: Extend existing ScryfallClient.searchCards() method to pass additional parameters to Scryfall API.

### 2. New `query_rules` Tool

**Purpose**: Integrate the existing MTG rules file for rules queries and interaction clarifications.

**Tool Specifications**:
```typescript
{
  name: 'query_rules',
  description: 'Search Magic: The Gathering comprehensive rules for specific interactions and rule clarifications',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term or rules question'
      },
      section: {
        type: 'string',
        description: 'Specific rule section (e.g., "7" for Additional Rules)',
        pattern: '^[1-9]\\d*$'
      },
      context_lines: {
        type: 'number',
        default: 3,
        minimum: 1,
        maximum: 10,
        description: 'Lines of context around matches'
      },
      exact_match: {
        type: 'boolean',
        default: false,
        description: 'Require exact phrase matching'
      }
    },
    required: ['query']
  }
}
```

**Use Cases**:
- "How do replacement effects interact with triggered abilities?"
- "What are the rules for commander damage?"
- "Find rules about priority and the stack"

**Implementation**: Create new tool class that performs text search through `mtgrules.txt` with regex support and context extraction.

### 3. Enhanced `get_card_prices` Tool

**Current Limitations**: Only accepts Scryfall IDs, no format context or alternatives.

**Enhancement Specifications**:
```typescript
// Enhanced parameters:
{
  card_identifier: {
    type: 'string',
    description: 'Card name, set/number, or Scryfall ID'
  },
  format_context: {
    type: 'string',
    enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'],
    description: 'Show price relevance for specific format'
  },
  include_alternatives: {
    type: 'boolean',
    default: false,
    description: 'Include budget alternatives and upgrades'
  },
  currency: {
    type: 'string',
    enum: ['usd', 'eur', 'tix'],
    default: 'usd',
    description: 'Currency for price display'
  }
}
```

**Use Cases**:
- "What's the price of Tarmogoyf in Modern context?"
- "Show me the price of Lightning Bolt and cheaper alternatives"
- "Get MTGO prices for my Commander deck's expensive cards"

**Implementation**: Extend existing tool to accept card names, add format legality context, and suggest alternatives based on price ranges.

## Priority 2 Enhancements (Medium Impact, Medium Complexity)

### 4. New `search_format_staples` Tool

**Purpose**: Find format staples, meta cards, and role-specific cards for competitive play.

**Tool Specifications**:
```typescript
{
  name: 'search_format_staples',
  description: 'Find format staples, meta cards, and role-specific cards for competitive play',
  inputSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'],
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
  }
}
```

**Use Cases**:
- "Show me the top removal spells in Modern under $10"
- "Find budget threats in Standard for aggressive decks"
- "What are the best utility lands in Commander?"

**Implementation**: Combine format legality searches with role-specific oracle text patterns and EDHREC/price-based sorting.

### 5. New `search_alternatives` Tool

**Purpose**: Find budget alternatives, upgrades, or functionally similar cards.

**Tool Specifications**:
```typescript
{
  name: 'search_alternatives',
  description: 'Find budget alternatives, upgrades, or functionally similar cards',
  inputSchema: {
    type: 'object',
    properties: {
      target_card: {
        type: 'string',
        description: 'Card to find alternatives for'
      },
      direction: {
        type: 'string',
        enum: ['cheaper', 'upgrade', 'similar'],
        description: 'Type of alternative to find'
      },
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'],
        description: 'Format legality requirement'
      },
      max_price: {
        type: 'number',
        description: 'Maximum price constraint'
      },
      min_price: {
        type: 'number',
        description: 'Minimum price constraint'
      },
      preserve_function: {
        type: 'boolean',
        default: true,
        description: 'Maintain similar functionality'
      },
      limit: {
        type: 'number',
        default: 10,
        minimum: 1,
        maximum: 50,
        description: 'Number of alternatives to return'
      }
    },
    required: ['target_card', 'direction']
  }
}
```

**Use Cases**:
- "Find cheaper alternatives to Tarmogoyf in Modern"
- "Show me upgrades for Lightning Bolt in Legacy"
- "Find similar cards to Counterspell for budget control decks"

**Implementation**: Analyze target card's mana cost, type, and function, then search for similar cards with price/power level constraints.

### 6. Enhanced `random_card` Tool

**Current Limitations**: Basic format filtering only, no archetype or advanced constraints.

**Enhancement Specifications**:
```typescript
// Add to existing parameters:
{
  archetype: {
    type: 'string',
    enum: ['aggro', 'control', 'combo', 'midrange', 'ramp', 'tribal'],
    description: 'Deck archetype preference'
  },
  price_range: {
    type: 'object',
    properties: {
      min: { type: 'number' },
      max: { type: 'number' },
      currency: { type: 'string', enum: ['usd', 'eur', 'tix'], default: 'usd' }
    },
    description: 'Price constraints for random selection'
  },
  exclude_reprints: {
    type: 'boolean',
    default: false,
    description: 'Exclude heavily reprinted cards'
  },
  similar_to: {
    type: 'string',
    description: 'Find cards similar to this card'
  },
  rarity_preference: {
    type: 'string',
    enum: ['common', 'uncommon', 'rare', 'mythic'],
    description: 'Preferred rarity level'
  }
}
```

**Use Cases**:
- "Give me a random budget aggro card under $2"
- "Find a random control card similar to Counterspell"
- "Show me a random tribal card for my Commander deck"

**Implementation**: Extend existing random card functionality with archetype-specific search patterns and advanced filtering.

## Priority 3 Enhancements (High Impact, Higher Complexity)

### 7. New `find_synergistic_cards` Tool

**Purpose**: Discover cards that synergize with a specific card, theme, or archetype.

**Tool Specifications**:
```typescript
{
  name: 'find_synergistic_cards',
  description: 'Find cards that synergize with a specific card, theme, or archetype',
  inputSchema: {
    type: 'object',
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
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer'],
        description: 'Format legality requirement'
      },
      exclude_colors: {
        type: 'string',
        description: 'Colors to exclude from results (e.g., "rb" to exclude red and black)'
      },
      max_cmc: {
        type: 'number',
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
      }
    },
    required: ['focus_card']
  }
}
```

**Use Cases**:
- "Find cards that synergize with Atraxa, Praetors' Voice in Commander"
- "Show me tribal support for Goblins in Modern"
- "Find combo pieces that work with Thassa's Oracle"

**Implementation**: Extract keywords, types, and mechanics from focus card, then search for cards with related text, types, or interactions.

### 8. New `batch_card_analysis` Tool

**Purpose**: Analyze multiple cards simultaneously for various metrics.

**Tool Specifications**:
```typescript
{
  name: 'batch_card_analysis',
  description: 'Analyze multiple cards for legality, prices, synergies, or deck composition',
  inputSchema: {
    type: 'object',
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
  }
}
```

**Use Cases**:
- "Check the legality and total price of my Standard deck"
- "Analyze the mana curve and color distribution of my deck"
- "Find synergies within my Commander deck list"

**Implementation**: Use Scryfall's `/cards/collection` endpoint for efficient batch processing, then perform requested analysis type.

## Technical Considerations

### Integration Points
- **Existing Infrastructure**: All tools leverage existing ScryfallClient, RateLimiter, and CacheService
- **Backward Compatibility**: No changes to existing tool interfaces
- **Error Handling**: Maintain consistent error handling patterns across all tools
- **Caching Strategy**: Implement appropriate cache TTLs for different data types

### Implementation Guidelines
- **Separation of Concerns**: Tools focus on data retrieval; complex analysis handled by agents
- **Rate Limiting**: Respect Scryfall API limits with intelligent batching
- **Performance**: Use bulk endpoints where possible for efficiency
- **Validation**: Comprehensive input validation for all new parameters

### Testing Requirements
Each enhancement must include:
- Unit tests for tool logic
- Integration tests with Scryfall API
- Error handling validation
- Performance benchmarks
- Cache behavior verification

## Expected Benefits

### For MTG Players
- **Format Optimization**: Tools specifically designed for competitive format analysis
- **Budget Building**: Price-aware card discovery and alternatives
- **Rules Clarity**: Direct access to comprehensive MTG rules
- **Deck Analysis**: Efficient analysis of entire deck lists

### For Deck Builders
- **Synergy Discovery**: Intelligent card relationship identification
- **Meta Awareness**: Format staple and meta card identification
- **Alternative Options**: Budget alternatives and upgrade paths
- **Batch Operations**: Streamlined deck composition analysis

### For Competitive Players
- **Meta Analysis**: Format meta breakdown and tier identification
- **Optimization**: Advanced search capabilities for deck tuning
- **Research**: Comprehensive card relationship discovery
- **Efficiency**: Batch processing for tournament preparation

## Implementation Timeline

**Phase 1** (Priority 1 - 2-3 weeks):
- Enhanced search_cards tool
- New query_rules tool  
- Enhanced get_card_prices tool

**Phase 2** (Priority 2 - 3-4 weeks):
- New search_format_staples tool
- New search_alternatives tool
- Enhanced random_card tool

**Phase 3** (Priority 3 - 4-5 weeks):
- New find_synergistic_cards tool
- New batch_card_analysis tool

Total estimated timeline: **9-12 weeks** for complete implementation with testing and documentation.
