# Feature 2: Natural Language Query Builder Tool - Detailed Implementation Plan

## Executive Summary

This document provides a comprehensive, granular implementation plan for **Feature 2: Natural Language Query Builder Tool** from the 3-feature-proposals.md document. This feature will convert natural language requests into optimized Scryfall search queries, significantly reducing the barrier to entry for AI assistants and users who are not familiar with Scryfall's search syntax.

## Feature Analysis and Scope

### Problem Statement
- **Current Limitation**: AI assistants must manually construct Scryfall queries using complex syntax (e.g., `c:red t:creature pow>=2 cmc<=3 f:modern`)
- **User Pain Point**: High barrier to entry for complex searches requiring knowledge of 150+ operators
- **Missed Opportunities**: Manual query construction limits exploration and discovery capabilities

### Solution Overview
Convert natural language descriptions like:
- "red creatures under $5 for aggressive decks" → `c:r t:creature usd<=5 pow>=2 cmc<=3`
- "blue counterspells in modern under $20" → `c:u o:counter f:modern usd<=20 t:instant`
- "legendary artifacts that produce mana" → `t:legendary t:artifact o:mana (o:"add" OR o:"produces")`

### Success Criteria
1. **Accuracy**: 90%+ success rate for common natural language patterns
2. **Coverage**: Support 50+ natural language patterns covering major MTG concepts
3. **Optimization**: Generated queries return appropriate result counts (10-100 cards)
4. **Educational**: Provide explanations showing how natural language maps to Scryfall syntax
5. **Integration**: Seamless integration with existing MCP tool architecture

## Architecture Design

### High-Level Architecture

```
Natural Language Input
         ↓
┌─────────────────────┐
│  NaturalLanguage    │ ← Tokenize and extract concepts
│  Parser             │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  ConceptExtractor   │ ← Map concepts to Scryfall operators
│  Engine             │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  QueryBuilder       │ ← Assemble and optimize Scryfall query
│  Engine             │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  QueryOptimizer     │ ← Test and refine for optimal results
│  & Validator        │
└─────────────────────┘
         ↓
    Optimized Scryfall Query + Explanation
```

### Core Components

#### 1. **NaturalLanguageParser**
- **Purpose**: Tokenize and extract semantic concepts from natural language
- **Input**: Raw natural language string
- **Output**: Structured `ParsedQuery` object with extracted concepts
- **Location**: `src/natural-language/parser.ts`

#### 2. **ConceptExtractor**
- **Purpose**: Map natural language concepts to Scryfall operators and values
- **Input**: Parsed concepts and context
- **Output**: Operator mappings and constraints
- **Location**: `src/natural-language/concept-extractor.ts`

#### 3. **QueryBuilderEngine**
- **Purpose**: Assemble Scryfall query from extracted concepts
- **Input**: Concept mappings and optimization preferences
- **Output**: Raw Scryfall query string
- **Location**: `src/natural-language/query-builder.ts`

#### 4. **QueryOptimizer**
- **Purpose**: Test and refine queries for optimal result counts
- **Input**: Raw query and target parameters
- **Output**: Optimized query with performance metrics
- **Location**: `src/natural-language/optimizer.ts`

#### 5. **BuildScryfallQueryTool**
- **Purpose**: MCP tool interface coordinating all components
- **Input**: Natural language + preferences via MCP
- **Output**: Formatted response with query, explanation, and alternatives
- **Location**: `src/tools/build-scryfall-query.ts`

## Detailed Implementation Plan

### Phase 1: Core Natural Language Processing (Week 1)

#### 1.1 Natural Language Parser Implementation

**File**: `src/natural-language/parser.ts`

**Key Data Structures**:
```typescript
interface ParsedQuery {
  // Core card properties
  colors: ColorConcept[];
  types: TypeConcept[];
  subtypes: SubtypeConcept[];
  
  // Gameplay mechanics
  keywords: KeywordConcept[];
  abilities: AbilityConcept[];
  mechanics: MechanicConcept[];
  
  // Numeric constraints
  manaCost: ManaCostConcept[];
  powerToughness: StatConcept[];
  priceConstraints: PriceConcept[];
  
  // Format and legality
  formats: FormatConcept[];
  legality: LegalityConcept[];
  
  // Strategic context
  archetypes: ArchetypeConcept[];
  deckRoles: RoleConcept[];
  strategies: StrategyConcept[];
  
  // Set and collection
  sets: SetConcept[];
  rarity: RarityConcept[];
  timeConstraints: TimeConcept[];
  
  // Text and flavor
  namePatterns: NameConcept[];
  flavorText: FlavorConcept[];
  artist: ArtistConcept[];
  
  // Meta information
  confidence: number;
  ambiguities: Ambiguity[];
  context: QueryContext;
}

interface ColorConcept {
  colors: string[];           // ['r', 'u'] for red/blue
  exact: boolean;            // true for "exactly red and blue"
  inclusive: boolean;        // true for "red or blue cards"
  exclusive: boolean;        // true for "only red cards"
  multicolor: boolean;       // true for "multicolor cards"
  colorless: boolean;        // true for "colorless cards"
  confidence: number;
}

interface ArchetypeConcept {
  name: string;              // "aggressive", "control", "combo"
  constraints: {
    cmcRange?: [number, number];
    powerMin?: number;
    keywords?: string[];
    functions?: string[];
    cardTypes?: string[];
  };
  confidence: number;
}

interface PriceConcept {
  max?: number;
  min?: number;
  currency: 'usd' | 'eur' | 'tix';
  condition?: 'budget' | 'value' | 'premium';
  confidence: number;
}
```

**Pattern Recognition Engines**:

```typescript
class ColorPatternEngine {
  private readonly patterns = new Map([
    // Basic colors
    ['red', { colors: ['r'], exact: false, confidence: 0.95 }],
    ['blue', { colors: ['u'], exact: false, confidence: 0.95 }],
    ['white', { colors: ['w'], exact: false, confidence: 0.95 }],
    ['black', { colors: ['b'], exact: false, confidence: 0.95 }],
    ['green', { colors: ['g'], exact: false, confidence: 0.95 }],
    
    // Guild names with higher confidence
    ['azorius', { colors: ['w', 'u'], exact: true, confidence: 0.98 }],
    ['dimir', { colors: ['u', 'b'], exact: true, confidence: 0.98 }],
    ['rakdos', { colors: ['b', 'r'], exact: true, confidence: 0.98 }],
    ['gruul', { colors: ['r', 'g'], exact: true, confidence: 0.98 }],
    ['selesnya', { colors: ['g', 'w'], exact: true, confidence: 0.98 }],
    ['orzhov', { colors: ['w', 'b'], exact: true, confidence: 0.98 }],
    ['izzet', { colors: ['u', 'r'], exact: true, confidence: 0.98 }],
    ['golgari', { colors: ['b', 'g'], exact: true, confidence: 0.98 }],
    ['boros', { colors: ['r', 'w'], exact: true, confidence: 0.98 }],
    ['simic', { colors: ['g', 'u'], exact: true, confidence: 0.98 }],
    
    // Shard names
    ['bant', { colors: ['g', 'w', 'u'], exact: true, confidence: 0.98 }],
    ['esper', { colors: ['w', 'u', 'b'], exact: true, confidence: 0.98 }],
    ['grixis', { colors: ['u', 'b', 'r'], exact: true, confidence: 0.98 }],
    ['jund', { colors: ['b', 'r', 'g'], exact: true, confidence: 0.98 }],
    ['naya', { colors: ['r', 'g', 'w'], exact: true, confidence: 0.98 }],
    
    // Wedge names  
    ['abzan', { colors: ['w', 'b', 'g'], exact: true, confidence: 0.98 }],
    ['jeskai', { colors: ['u', 'r', 'w'], exact: true, confidence: 0.98 }],
    ['sultai', { colors: ['b', 'g', 'u'], exact: true, confidence: 0.98 }],
    ['mardu', { colors: ['r', 'w', 'b'], exact: true, confidence: 0.98 }],
    ['temur', { colors: ['g', 'u', 'r'], exact: true, confidence: 0.98 }],
    
    // Special color combinations
    ['multicolor', { colors: [], multicolor: true, confidence: 0.90 }],
    ['colorless', { colors: [], colorless: true, confidence: 0.95 }],
    ['rainbow', { colors: ['w', 'u', 'b', 'r', 'g'], exact: false, confidence: 0.85 }],
  ]);

  extract(text: string): ColorConcept[] {
    const concepts: ColorConcept[] = [];
    const lowerText = text.toLowerCase();
    
    // Check for exact phrases first (higher confidence)
    for (const [pattern, concept] of this.patterns) {
      if (lowerText.includes(pattern)) {
        concepts.push({
          colors: concept.colors || [],
          exact: concept.exact || false,
          inclusive: this.detectInclusive(text, pattern),
          exclusive: this.detectExclusive(text, pattern),
          multicolor: concept.multicolor || false,
          colorless: concept.colorless || false,
          confidence: concept.confidence
        });
      }
    }
    
    return this.deduplicateAndMerge(concepts);
  }
  
  private detectInclusive(text: string, pattern: string): boolean {
    const inclusiveIndicators = ['or', 'any', 'either', 'include'];
    const context = this.getContextWindow(text, pattern, 5);
    return inclusiveIndicators.some(indicator => context.includes(indicator));
  }
  
  private detectExclusive(text: string, pattern: string): boolean {
    const exclusiveIndicators = ['only', 'just', 'exactly', 'purely', 'solely'];
    const context = this.getContextWindow(text, pattern, 5);
    return exclusiveIndicators.some(indicator => context.includes(indicator));
  }
}
```

**Archetype Pattern Engine**:
```typescript
class ArchetypePatternEngine {
  private readonly archetypeDefinitions = new Map([
    ['aggressive', {
      constraints: {
        cmcRange: [1, 4],
        powerMin: 2,
        keywords: ['haste', 'trample', 'first strike', 'double strike'],
        functions: ['burn', 'direct damage'],
        cardTypes: ['creature', 'instant', 'sorcery']
      },
      confidence: 0.90
    }],
    ['aggro', {
      constraints: {
        cmcRange: [1, 3],
        powerMin: 2,
        keywords: ['haste', 'prowess', 'menace'],
        functions: ['burn'],
        cardTypes: ['creature']
      },
      confidence: 0.92
    }],
    ['control', {
      constraints: {
        cmcRange: [2, 8],
        keywords: ['flash', 'vigilance'],
        functions: ['counterspell', 'removal', 'draw', 'wipe'],
        cardTypes: ['instant', 'sorcery', 'enchantment', 'planeswalker']
      },
      confidence: 0.88
    }],
    ['midrange', {
      constraints: {
        cmcRange: [3, 6],
        powerMin: 2,
        functions: ['removal', 'value'],
        cardTypes: ['creature', 'planeswalker']
      },
      confidence: 0.85
    }],
    ['combo', {
      constraints: {
        keywords: ['flash', 'storm', 'cascade'],
        functions: ['tutor', 'draw', 'ritual'],
        cardTypes: ['instant', 'sorcery', 'artifact', 'enchantment']
      },
      confidence: 0.80
    }],
    ['ramp', {
      constraints: {
        functions: ['ramp', 'mana acceleration'],
        cardTypes: ['land', 'artifact', 'creature', 'sorcery'],
        keywords: ['vigilance'] // for mana dorks
      },
      confidence: 0.93
    }],
    ['tribal', {
      constraints: {
        cardTypes: ['creature'],
        // Will be enhanced with specific creature types
      },
      confidence: 0.85
    }]
  ]);
  
  extract(text: string): ArchetypeConcept[] {
    const concepts: ArchetypeConcept[] = [];
    const lowerText = text.toLowerCase();
    
    for (const [archetype, definition] of this.archetypeDefinitions) {
      if (this.matchesArchetype(lowerText, archetype)) {
        concepts.push({
          name: archetype,
          constraints: definition.constraints,
          confidence: definition.confidence
        });
      }
    }
    
    return concepts;
  }
  
  private matchesArchetype(text: string, archetype: string): boolean {
    // Direct mention
    if (text.includes(archetype)) return true;
    
    // Synonym matching
    const synonyms = this.getArchetypeSynonyms(archetype);
    return synonyms.some(synonym => text.includes(synonym));
  }
  
  private getArchetypeSynonyms(archetype: string): string[] {
    const synonymMap = new Map([
      ['aggressive', ['aggro', 'fast', 'beatdown', 'rush', 'tempo']],
      ['control', ['controlling', 'defensive', 'reactive', 'late game']],
      ['midrange', ['midgame', 'value', 'grindy', 'fair']],
      ['combo', ['synergy', 'engine', 'infinite', 'lock']],
      ['ramp', ['acceleration', 'big mana', 'ramping', 'fast mana']],
      ['tribal', ['creature type', 'synergy', 'lord effects']]
    ]);
    
    return synonymMap.get(archetype) || [];
  }
}
```

**Price Pattern Engine**:
```typescript
class PricePatternEngine {
  private readonly patterns = [
    // Under patterns
    { regex: /under\s*\$?(\d+(?:\.\d{2})?)/i, type: 'max', confidence: 0.95 },
    { regex: /less\s+than\s*\$?(\d+(?:\.\d{2})?)/i, type: 'max', confidence: 0.93 },
    { regex: /below\s*\$?(\d+(?:\.\d{2})?)/i, type: 'max', confidence: 0.90 },
    { regex: /\$?(\d+(?:\.\d{2})?)\s*or\s*less/i, type: 'max', confidence: 0.92 },
    { regex: /\$?(\d+(?:\.\d{2})?)\s*and\s*under/i, type: 'max', confidence: 0.90 },
    
    // Budget patterns
    { regex: /budget.*?\$?(\d+(?:\.\d{2})?)/i, type: 'max', confidence: 0.85 },
    { regex: /cheap.*?\$?(\d+(?:\.\d{2})?)/i, type: 'max', confidence: 0.80 },
    { regex: /affordable.*?\$?(\d+(?:\.\d{2})?)/i, type: 'max', confidence: 0.82 },
    
    // Over patterns
    { regex: /over\s*\$?(\d+(?:\.\d{2})?)/i, type: 'min', confidence: 0.95 },
    { regex: /more\s+than\s*\$?(\d+(?:\.\d{2})?)/i, type: 'min', confidence: 0.93 },
    { regex: /above\s*\$?(\d+(?:\.\d{2})?)/i, type: 'min', confidence: 0.90 },
    
    // Range patterns
    { regex: /between\s*\$?(\d+(?:\.\d{2})?)\s*(?:and|to|-)\s*\$?(\d+(?:\.\d{2})?)/i, type: 'range', confidence: 0.88 },
    { regex: /\$?(\d+(?:\.\d{2})?)\s*(?:-|to)\s*\$?(\d+(?:\.\d{2})?)/i, type: 'range', confidence: 0.85 },
    
    // Exact patterns
    { regex: /exactly\s*\$?(\d+(?:\.\d{2})?)/i, type: 'exact', confidence: 0.90 },
    { regex: /costs\s*\$?(\d+(?:\.\d{2})?)/i, type: 'exact', confidence: 0.85 },
  ];
  
  extract(text: string): PriceConcept[] {
    const concepts: PriceConcept[] = [];
    
    for (const pattern of this.patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const concept: PriceConcept = {
          currency: 'usd', // Default to USD
          confidence: pattern.confidence
        };
        
        if (pattern.type === 'max') {
          concept.max = parseFloat(match[1]);
        } else if (pattern.type === 'min') {
          concept.min = parseFloat(match[1]);
        } else if (pattern.type === 'range') {
          concept.min = parseFloat(match[1]);
          concept.max = parseFloat(match[2]);
        } else if (pattern.type === 'exact') {
          concept.min = concept.max = parseFloat(match[1]);
        }
        
        // Detect currency
        if (text.includes('euro') || text.includes('eur')) {
          concept.currency = 'eur';
        } else if (text.includes('tix') || text.includes('ticket')) {
          concept.currency = 'tix';
        }
        
        // Detect condition context
        concept.condition = this.detectCondition(text, match.index || 0);
        
        concepts.push(concept);
      }
    }
    
    return this.deduplicateAndMerge(concepts);
  }
  
  private detectCondition(text: string, position: number): 'budget' | 'value' | 'premium' | undefined {
    const context = text.substring(Math.max(0, position - 20), position + 20).toLowerCase();
    
    if (context.includes('budget') || context.includes('cheap') || context.includes('affordable')) {
      return 'budget';
    } else if (context.includes('value') || context.includes('efficient')) {
      return 'value';
    } else if (context.includes('premium') || context.includes('expensive') || context.includes('high end')) {
      return 'premium';
    }
    
    return undefined;
  }
}
```

#### 1.2 Type and Keyword Extraction

**File**: `src/natural-language/extractors/type-extractor.ts`

```typescript
class TypePatternEngine {
  private readonly cardTypes = new Map([
    // Primary types
    ['creature', { type: 'creature', confidence: 0.98 }],
    ['instant', { type: 'instant', confidence: 0.98 }],
    ['sorcery', { type: 'sorcery', confidence: 0.98 }],
    ['artifact', { type: 'artifact', confidence: 0.98 }],
    ['enchantment', { type: 'enchantment', confidence: 0.98 }],
    ['planeswalker', { type: 'planeswalker', confidence: 0.98 }],
    ['land', { type: 'land', confidence: 0.98 }],
    ['battle', { type: 'battle', confidence: 0.98 }],
    
    // Synonyms and common terms
    ['spell', { type: 'instant OR sorcery', confidence: 0.85 }],
    ['permanent', { type: 'creature OR artifact OR enchantment OR planeswalker OR land', confidence: 0.80 }],
    ['nonland', { type: '-t:land', confidence: 0.85 }],
    ['noncreature', { type: '-t:creature', confidence: 0.85 }],
    
    // Supertypes
    ['legendary', { type: 'legendary', confidence: 0.95 }],
    ['basic', { type: 'basic', confidence: 0.95 }],
    ['snow', { type: 'snow', confidence: 0.95 }],
    
    // Common subtypes
    ['human', { subtype: 'human', confidence: 0.90 }],
    ['elf', { subtype: 'elf', confidence: 0.95 }],
    ['goblin', { subtype: 'goblin', confidence: 0.95 }],
    ['zombie', { subtype: 'zombie', confidence: 0.95 }],
    ['dragon', { subtype: 'dragon', confidence: 0.95 }],
    ['angel', { subtype: 'angel', confidence: 0.95 }],
    ['demon', { subtype: 'demon', confidence: 0.95 }],
    ['wizard', { subtype: 'wizard', confidence: 0.90 }],
    ['warrior', { subtype: 'warrior', confidence: 0.90 }],
    ['knight', { subtype: 'knight', confidence: 0.90 }],
    ['beast', { subtype: 'beast', confidence: 0.90 }],
    ['spirit', { subtype: 'spirit', confidence: 0.90 }],
    ['elemental', { subtype: 'elemental', confidence: 0.90 }],
    
    // Equipment and vehicles
    ['equipment', { subtype: 'equipment', confidence: 0.95 }],
    ['vehicle', { subtype: 'vehicle', confidence: 0.95 }],
    
    // Artifact subtypes
    ['treasure', { subtype: 'treasure', confidence: 0.95 }],
    ['food', { subtype: 'food', confidence: 0.95 }],
    ['clue', { subtype: 'clue', confidence: 0.95 }],
    
    // Land subtypes
    ['mountain', { subtype: 'mountain', confidence: 0.90 }],
    ['island', { subtype: 'island', confidence: 0.90 }],
    ['forest', { subtype: 'forest', confidence: 0.90 }],
    ['plains', { subtype: 'plains', confidence: 0.90 }],
    ['swamp', { subtype: 'swamp', confidence: 0.90 }],
  ]);
  
  extract(text: string): TypeConcept[] {
    const concepts: TypeConcept[] = [];
    const lowerText = text.toLowerCase();
    
    for (const [pattern, definition] of this.cardTypes) {
      if (lowerText.includes(pattern)) {
        concepts.push({
          type: definition.type,
          subtype: definition.subtype,
          confidence: definition.confidence,
          context: this.getContextWindow(text, pattern, 3)
        });
      }
    }
    
    return this.deduplicateAndMerge(concepts);
  }
}
```

#### 1.3 Integration and Testing

**File**: `src/natural-language/parser.ts` (Main Parser)

```typescript
export class NaturalLanguageParser {
  private readonly colorEngine = new ColorPatternEngine();
  private readonly typeEngine = new TypePatternEngine();
  private readonly archetypeEngine = new ArchetypePatternEngine();
  private readonly priceEngine = new PricePatternEngine();
  private readonly keywordEngine = new KeywordPatternEngine();
  private readonly formatEngine = new FormatPatternEngine();
  private readonly mechanicEngine = new MechanicPatternEngine();
  
  parse(naturalQuery: string, context?: QueryContext): ParsedQuery {
    // Preprocess text
    const cleanedText = this.preprocessText(naturalQuery);
    
    // Extract all concepts in parallel
    const [
      colors,
      types,
      archetypes,
      prices,
      keywords,
      formats,
      mechanics
    ] = await Promise.all([
      this.colorEngine.extract(cleanedText),
      this.typeEngine.extract(cleanedText),
      this.archetypeEngine.extract(cleanedText),
      this.priceEngine.extract(cleanedText),
      this.keywordEngine.extract(cleanedText),
      this.formatEngine.extract(cleanedText),
      this.mechanicEngine.extract(cleanedText)
    ]);
    
    // Resolve conflicts and calculate confidence
    const resolved = this.resolveConflicts({
      colors,
      types,
      archetypes,
      prices,
      keywords,
      formats,
      mechanics
    });
    
    return {
      ...resolved,
      confidence: this.calculateOverallConfidence(resolved),
      ambiguities: this.detectAmbiguities(resolved),
      context: context || {}
    };
  }
  
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s$.-]/g, ' ') // Remove special chars except $, ., -
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();
  }
  
  private resolveConflicts(concepts: any): ParsedQuery {
    // Implement conflict resolution logic
    // e.g., if both "red" and "blue" are mentioned with "only", resolve to multicolor
    // Handle overlapping archetypes, contradictory price constraints, etc.
    
    return {
      colors: this.resolveColorConflicts(concepts.colors),
      types: this.resolveTypeConflicts(concepts.types),
      // ... other resolutions
    };
  }
  
  private calculateOverallConfidence(parsed: ParsedQuery): number {
    const conceptConfidences = [
      ...parsed.colors.map(c => c.confidence),
      ...parsed.types.map(t => t.confidence),
      ...parsed.archetypes.map(a => a.confidence),
      // ... other concept confidences
    ];
    
    if (conceptConfidences.length === 0) return 0;
    
    // Weighted average with bias toward higher confidence concepts
    return conceptConfidences.reduce((sum, conf, idx) => {
      const weight = Math.pow(conf, 1.5); // Higher confidence gets more weight
      return sum + (conf * weight);
    }, 0) / conceptConfidences.length;
  }
}
```

### Phase 2: Query Building Engine (Week 2)

#### 2.1 Concept to Scryfall Mapping

**File**: `src/natural-language/concept-extractor.ts`

```typescript
interface ConceptMapping {
  operator: string;
  value: string;
  comparison?: '=' | '>' | '<' | '>=' | '<=' | '!=';
  negation?: boolean;
  confidence: number;
  priority: number; // For conflict resolution
}

export class ConceptExtractor {
  mapColors(colors: ColorConcept[]): ConceptMapping[] {
    const mappings: ConceptMapping[] = [];
    
    for (const colorConcept of colors) {
      if (colorConcept.colorless) {
        mappings.push({
          operator: 'c',
          value: 'c',
          confidence: colorConcept.confidence,
          priority: 10
        });
      } else if (colorConcept.multicolor) {
        mappings.push({
          operator: 'c',
          value: 'm',
          confidence: colorConcept.confidence,
          priority: 9
        });
      } else if (colorConcept.colors.length > 0) {
        const value = colorConcept.exact 
          ? colorConcept.colors.join('') 
          : colorConcept.colors.join('');
        
        const operator = colorConcept.exact ? 'c' : 'c';
        const comparison = colorConcept.inclusive ? '>=' : '=';
        
        mappings.push({
          operator,
          value,
          comparison: colorConcept.exact ? '=' : comparison,
          confidence: colorConcept.confidence,
          priority: 10
        });
      }
    }
    
    return mappings;
  }
  
  mapArchetypes(archetypes: ArchetypeConcept[]): ConceptMapping[] {
    const mappings: ConceptMapping[] = [];
    
    for (const archetype of archetypes) {
      const constraints = archetype.constraints;
      
      // Map CMC constraints
      if (constraints.cmcRange) {
        const [min, max] = constraints.cmcRange;
        mappings.push({
          operator: 'cmc',
          value: min.toString(),
          comparison: '>=',
          confidence: archetype.confidence * 0.8,
          priority: 6
        });
        mappings.push({
          operator: 'cmc',
          value: max.toString(),
          comparison: '<=',
          confidence: archetype.confidence * 0.8,
          priority: 6
        });
      }
      
      // Map power constraints
      if (constraints.powerMin) {
        mappings.push({
          operator: 'pow',
          value: constraints.powerMin.toString(),
          comparison: '>=',
          confidence: archetype.confidence * 0.7,
          priority: 5
        });
      }
      
      // Map keyword constraints
      if (constraints.keywords) {
        for (const keyword of constraints.keywords) {
          mappings.push({
            operator: 'o',
            value: keyword,
            confidence: archetype.confidence * 0.6,
            priority: 4
          });
        }
      }
      
      // Map function constraints
      if (constraints.functions) {
        for (const func of constraints.functions) {
          mappings.push({
            operator: 'function',
            value: func,
            confidence: archetype.confidence * 0.8,
            priority: 7
          });
        }
      }
      
      // Map card type constraints
      if (constraints.cardTypes) {
        for (const type of constraints.cardTypes) {
          mappings.push({
            operator: 't',
            value: type,
            confidence: archetype.confidence * 0.9,
            priority: 8
          });
        }
      }
    }
    
    return mappings;
  }
  
  mapPrices(prices: PriceConcept[]): ConceptMapping[] {
    const mappings: ConceptMapping[] = [];
    
    for (const price of prices) {
      const currencyOperator = price.currency === 'eur' ? 'eur' : 
                              price.currency === 'tix' ? 'tix' : 'usd';
      
      if (price.max !== undefined) {
        mappings.push({
          operator: currencyOperator,
          value: price.max.toString(),
          comparison: '<=',
          confidence: price.confidence,
          priority: 8
        });
      }
      
      if (price.min !== undefined) {
        mappings.push({
          operator: currencyOperator,
          value: price.min.toString(),
          comparison: '>=',
          confidence: price.confidence,
          priority: 8
        });
      }
    }
    
    return mappings;
  }
  
  resolveConflicts(mappings: ConceptMapping[]): ConceptMapping[] {
    // Group by operator
    const grouped = new Map<string, ConceptMapping[]>();
    for (const mapping of mappings) {
      const key = mapping.operator;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(mapping);
    }
    
    const resolved: ConceptMapping[] = [];
    
    for (const [operator, operatorMappings] of grouped) {
      if (operatorMappings.length === 1) {
        resolved.push(operatorMappings[0]);
        continue;
      }
      
      // Resolve conflicts based on priority and confidence
      const sorted = operatorMappings.sort((a, b) => {
        const priorityDiff = b.priority - a.priority;
        if (priorityDiff !== 0) return priorityDiff;
        return b.confidence - a.confidence;
      });
      
      // Special conflict resolution rules
      if (operator === 'c') {
        resolved.push(...this.resolveColorConflicts(sorted));
      } else if (operator === 'cmc') {
        resolved.push(...this.resolveCmcConflicts(sorted));
      } else if (operator === 'usd' || operator === 'eur' || operator === 'tix') {
        resolved.push(...this.resolvePriceConflicts(sorted));
      } else {
        // Default: take highest priority/confidence
        resolved.push(sorted[0]);
      }
    }
    
    return resolved;
  }
  
  private resolveColorConflicts(mappings: ConceptMapping[]): ConceptMapping[] {
    // Complex color conflict resolution
    // Handle cases like "red and blue" vs "only red" vs "multicolor"
    
    const hasExact = mappings.some(m => m.comparison === '=');
    const hasInclusive = mappings.some(m => m.comparison === '>=');
    
    if (hasExact && hasInclusive) {
      // Exact takes precedence
      return mappings.filter(m => m.comparison === '=');
    }
    
    // Merge compatible color requirements
    return this.mergeColorMappings(mappings);
  }
}
```

#### 2.2 Query Builder Engine

**File**: `src/natural-language/query-builder.ts`

```typescript
interface BuildOptions {
  optimize_for: 'precision' | 'recall' | 'discovery' | 'budget';
  format?: string;
  max_results?: number;
  price_budget?: PriceBudget;
}

interface BuildResult {
  query: string;
  explanation: string;
  confidence: number;
  alternatives: AlternativeQuery[];
  optimizations: QueryOptimization[];
}

export class QueryBuilderEngine {
  constructor(
    private conceptExtractor: ConceptExtractor,
    private scryfallClient: ScryfallClient
  ) {}
  
  async build(parsed: ParsedQuery, options: BuildOptions): Promise<BuildResult> {
    // Extract concept mappings
    const mappings = this.conceptExtractor.extractMappings(parsed);
    
    // Build base query
    const baseQuery = this.buildBaseQuery(mappings);
    
    // Apply format constraints
    const formatQuery = this.applyFormat(baseQuery, options.format);
    
    // Apply optimization strategy
    const optimizedQuery = this.applyOptimization(formatQuery, options.optimize_for);
    
    // Test query and adjust if needed
    const testedQuery = await this.testAndAdjust(optimizedQuery, options);
    
    // Generate explanation
    const explanation = this.generateExplanation(mappings, options);
    
    // Generate alternatives
    const alternatives = this.generateAlternatives(parsed, mappings, options);
    
    return {
      query: testedQuery.query,
      explanation,
      confidence: this.calculateBuildConfidence(parsed, mappings, testedQuery),
      alternatives,
      optimizations: testedQuery.optimizations
    };
  }
  
  private buildBaseQuery(mappings: ConceptMapping[]): string {
    const queryParts: string[] = [];
    
    // Group mappings by operator for complex queries
    const grouped = this.groupMappingsByOperator(mappings);
    
    for (const [operator, operatorMappings] of grouped) {
      const part = this.buildOperatorQuery(operator, operatorMappings);
      if (part) {
        queryParts.push(part);
      }
    }
    
    return queryParts.join(' ');
  }
  
  private buildOperatorQuery(operator: string, mappings: ConceptMapping[]): string {
    if (mappings.length === 0) return '';
    
    if (mappings.length === 1) {
      const mapping = mappings[0];
      const prefix = mapping.negation ? '-' : '';
      const comparison = mapping.comparison || '';
      return `${prefix}${operator}:${comparison}${mapping.value}`;
    }
    
    // Handle multiple values for same operator
    if (operator === 'o') {
      // Oracle text searches can be combined with OR
      const values = mappings.map(m => m.value);
      return `(${values.map(v => `o:"${v}"`).join(' OR ')})`;
    } else if (operator === 't') {
      // Type searches can be combined with OR
      const values = mappings.map(m => m.value);
      return `(${values.map(v => `t:${v}`).join(' OR ')})`;
    } else if (['cmc', 'pow', 'tou', 'usd', 'eur', 'tix'].includes(operator)) {
      // Numeric operators need range handling
      return this.buildNumericRange(operator, mappings);
    }
    
    // Default: use highest confidence mapping
    const best = mappings.reduce((a, b) => 
      a.confidence > b.confidence ? a : b
    );
    const prefix = best.negation ? '-' : '';
    const comparison = best.comparison || '';
    return `${prefix}${operator}:${comparison}${best.value}`;
  }
  
  private buildNumericRange(operator: string, mappings: ConceptMapping[]): string {
    const minMappings = mappings.filter(m => m.comparison === '>=' || m.comparison === '>');
    const maxMappings = mappings.filter(m => m.comparison === '<=' || m.comparison === '<');
    const exactMappings = mappings.filter(m => !m.comparison || m.comparison === '=');
    
    if (exactMappings.length > 0) {
      // Exact value takes precedence
      const best = exactMappings.reduce((a, b) => 
        a.confidence > b.confidence ? a : b
      );
      return `${operator}:${best.value}`;
    }
    
    const parts: string[] = [];
    
    if (minMappings.length > 0) {
      const best = minMappings.reduce((a, b) => 
        a.confidence > b.confidence ? a : b
      );
      parts.push(`${operator}:${best.comparison}${best.value}`);
    }
    
    if (maxMappings.length > 0) {
      const best = maxMappings.reduce((a, b) => 
        a.confidence > b.confidence ? a : b
      );
      parts.push(`${operator}:${best.comparison}${best.value}`);
    }
    
    return parts.join(' ');
  }
  
  private applyOptimization(query: string, strategy: string): string {
    switch (strategy) {
      case 'precision':
        // Add constraints to reduce false positives
        return this.optimizeForPrecision(query);
      case 'recall':
        // Broaden query to catch more results
        return this.optimizeForRecall(query);
      case 'discovery':
        // Add interesting constraints for exploration
        return this.optimizeForDiscovery(query);
      case 'budget':
        // Add budget-friendly constraints
        return this.optimizeForBudget(query);
      default:
        return query;
    }
  }
  
  private optimizeForPrecision(query: string): string {
    // Add constraints that improve precision
    let optimized = query;
    
    // If no format specified, default to popular formats for precision
    if (!query.includes('f:')) {
      optimized += ' (f:standard OR f:modern OR f:commander)';
    }
    
    // Exclude very expensive cards unless price is explicitly mentioned
    if (!query.match(/(?:usd|eur|tix):/)) {
      optimized += ' usd<=50';
    }
    
    return optimized;
  }
  
  private optimizeForRecall(query: string): string {
    // Remove overly restrictive constraints
    let optimized = query;
    
    // Relax power/toughness constraints
    optimized = optimized.replace(/pow:>=(\d+)/, (match, value) => {
      const newValue = Math.max(1, parseInt(value) - 1);
      return `pow:>=${newValue}`;
    });
    
    // Broaden type searches
    optimized = optimized.replace(/t:(\w+)(?!\w)/, (match, type) => {
      const relatedTypes = this.getRelatedTypes(type);
      if (relatedTypes.length > 0) {
        return `(t:${type} OR t:${relatedTypes.join(' OR t:')})`;
      }
      return match;
    });
    
    return optimized;
  }
  
  private async testAndAdjust(query: string, options: BuildOptions): Promise<{
    query: string;
    optimizations: QueryOptimization[];
  }> {
    try {
      // Test the query with a small limit
      const testResult = await this.scryfallClient.searchCards({
        query,
        limit: 1
      });
      
      const optimizations: QueryOptimization[] = [];
      let adjustedQuery = query;
      
      if (testResult.total_cards === 0) {
        // No results - broaden the query
        adjustedQuery = this.broadenQuery(query);
        optimizations.push({
          type: 'broadening',
          reason: 'Original query returned no results',
          change: `${query} → ${adjustedQuery}`
        });
      } else if (testResult.total_cards > (options.max_results || 20) * 10) {
        // Too many results - narrow the query
        adjustedQuery = this.narrowQuery(query);
        optimizations.push({
          type: 'narrowing',
          reason: `Original query returned ${testResult.total_cards} results`,
          change: `${query} → ${adjustedQuery}`
        });
      }
      
      return { query: adjustedQuery, optimizations };
    } catch (error) {
      // If query fails, return original
      return { query, optimizations: [] };
    }
  }
  
  private generateExplanation(mappings: ConceptMapping[], options: BuildOptions): string {
    const explanations: string[] = [];
    
    // Group explanations by concept type
    const colorMappings = mappings.filter(m => m.operator === 'c' || m.operator === 'id');
    const typeMappings = mappings.filter(m => m.operator === 't');
    const functionMappings = mappings.filter(m => m.operator === 'function' || m.operator === 'o');
    const priceMappings = mappings.filter(m => ['usd', 'eur', 'tix'].includes(m.operator));
    const statMappings = mappings.filter(m => ['pow', 'tou', 'cmc'].includes(m.operator));
    
    if (colorMappings.length > 0) {
      explanations.push(this.explainColorConstraints(colorMappings));
    }
    
    if (typeMappings.length > 0) {
      explanations.push(this.explainTypeConstraints(typeMappings));
    }
    
    if (functionMappings.length > 0) {
      explanations.push(this.explainFunctionConstraints(functionMappings));
    }
    
    if (priceMappings.length > 0) {
      explanations.push(this.explainPriceConstraints(priceMappings));
    }
    
    if (statMappings.length > 0) {
      explanations.push(this.explainStatConstraints(statMappings));
    }
    
    if (options.format) {
      explanations.push(`legal in ${options.format} format`);
    }
    
    return explanations.join(', ');
  }
  
  private generateAlternatives(
    parsed: ParsedQuery, 
    mappings: ConceptMapping[], 
    options: BuildOptions
  ): AlternativeQuery[] {
    const alternatives: AlternativeQuery[] = [];
    
    // Generate format alternatives
    if (!options.format) {
      const popularFormats = ['standard', 'modern', 'commander', 'legacy'];
      for (const format of popularFormats) {
        const altQuery = this.buildBaseQuery(mappings) + ` f:${format}`;
        alternatives.push({
          query: altQuery,
          description: `Same search restricted to ${format} format`,
          type: 'format_restriction',
          confidence: 0.8
        });
      }
    }
    
    // Generate strategy alternatives
    const strategies = ['precision', 'recall', 'discovery', 'budget'];
    for (const strategy of strategies) {
      if (strategy !== options.optimize_for) {
        const altQuery = this.applyOptimization(this.buildBaseQuery(mappings), strategy);
        alternatives.push({
          query: altQuery,
          description: `Optimized for ${strategy}`,
          type: 'optimization',
          confidence: 0.7
        });
      }
    }
    
    // Generate concept variations
    if (parsed.colors.length > 0) {
      alternatives.push(...this.generateColorAlternatives(parsed.colors, mappings));
    }
    
    return alternatives.slice(0, 3); // Limit to top 3 alternatives
  }
}
```

### Phase 3: MCP Tool Implementation (Week 3)

#### 3.1 Tool Definition and Validation

**File**: `src/tools/build-scryfall-query.ts`

```typescript
import { z } from 'zod';
import { ScryfallClient } from '../services/scryfall-client.js';
import { NaturalLanguageParser } from '../natural-language/parser.js';
import { QueryBuilderEngine } from '../natural-language/query-builder.js';
import { ConceptExtractor } from '../natural-language/concept-extractor.js';
import { validateBuildQueryParams } from '../utils/validators.js';
import { ValidationError, ScryfallAPIError } from '../types/mcp-types.js';

// Zod schema for input validation
export const BuildQueryParamsSchema = z.object({
  natural_query: z.string()
    .min(1, 'Natural query cannot be empty')
    .max(500, 'Natural query too long (max 500 characters)'),
  
  format: z.enum([
    'standard', 'modern', 'legacy', 'vintage', 'commander', 
    'pioneer', 'brawl', 'pauper', 'penny', 'historic', 'alchemy'
  ]).optional(),
  
  optimize_for: z.enum(['precision', 'recall', 'discovery', 'budget'])
    .default('precision'),
  
  max_results: z.number()
    .min(1, 'Max results must be at least 1')
    .max(175, 'Max results cannot exceed 175')
    .default(20),
  
  price_budget: z.object({
    max: z.number().min(0, 'Price budget cannot be negative'),
    currency: z.enum(['usd', 'eur', 'tix']).default('usd')
  }).optional(),
  
  include_alternatives: z.boolean().default(true),
  
  explain_mapping: z.boolean().default(true),
  
  test_query: z.boolean().default(true)
});

export type BuildQueryParams = z.infer<typeof BuildQueryParamsSchema>;

export class BuildScryfallQueryTool {
  readonly name = 'build_scryfall_query';
  readonly description = 'Convert natural language requests into optimized Scryfall search queries with explanations and alternatives';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      natural_query: {
        type: 'string',
        description: 'Natural language description of what you want to find (e.g., "red creatures under $5 for aggressive decks", "blue counterspells in modern")',
        minLength: 1,
        maxLength: 500
      },
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'brawl', 'pauper', 'penny', 'historic', 'alchemy'],
        description: 'Magic format to restrict search to (optional)'
      },
      optimize_for: {
        type: 'string',
        enum: ['precision', 'recall', 'discovery', 'budget'],
        default: 'precision',
        description: 'Search optimization strategy: precision (fewer, more relevant results), recall (broader search), discovery (interesting cards), budget (cost-effective)'
      },
      max_results: {
        type: 'number',
        minimum: 1,
        maximum: 175,
        default: 20,
        description: 'Target number of results for optimization'
      },
      price_budget: {
        type: 'object',
        properties: {
          max: {
            type: 'number',
            minimum: 0,
            description: 'Maximum price per card'
          },
          currency: {
            type: 'string',
            enum: ['usd', 'eur', 'tix'],
            default: 'usd',
            description: 'Currency for price constraints'
          }
        },
        description: 'Price constraints for the search'
      },
      include_alternatives: {
        type: 'boolean',
        default: true,
        description: 'Whether to include alternative query suggestions'
      },
      explain_mapping: {
        type: 'boolean',
        default: true,
        description: 'Whether to include detailed explanation of natural language to Scryfall mapping'
      },
      test_query: {
        type: 'boolean',
        default: true,
        description: 'Whether to test the generated query and optimize based on results'
      }
    },
    required: ['natural_query']
  };

  constructor(
    private readonly scryfallClient: ScryfallClient,
    private readonly parser = new NaturalLanguageParser(),
    private readonly conceptExtractor = new ConceptExtractor(),
    private readonly queryBuilder = new QueryBuilderEngine(new ConceptExtractor(), scryfallClient)
  ) {}

  async execute(args: unknown) {
    try {
      // Validate input parameters
      const params = validateBuildQueryParams(args);
      
      // Parse natural language
      const parsed = this.parser.parse(params.natural_query, {
        targetFormat: params.format,
        optimizationStrategy: params.optimize_for,
        maxResults: params.max_results
      });
      
      // Check parsing confidence
      if (parsed.confidence < 0.3) {
        return this.handleLowConfidenceParsing(parsed, params);
      }
      
      // Build Scryfall query
      const buildOptions = {
        optimize_for: params.optimize_for,
        format: params.format,
        max_results: params.max_results,
        price_budget: params.price_budget
      };
      
      const buildResult = await this.queryBuilder.build(parsed, buildOptions);
      
      // Test query if requested
      let testResult;
      if (params.test_query) {
        testResult = await this.testQuery(buildResult.query);
      }
      
      // Format response
      const responseText = this.formatResponse(
        buildResult,
        testResult,
        params,
        parsed
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
  
  private async testQuery(query: string) {
    try {
      return await this.scryfallClient.searchCards({
        query,
        limit: 5 // Small test to check viability
      });
    } catch (error) {
      return null; // Query failed, but we'll still return the generated query
    }
  }
  
  private formatResponse(
    buildResult: BuildResult,
    testResult: any,
    params: BuildQueryParams,
    parsed: ParsedQuery
  ): string {
    let response = `**Generated Scryfall Query:**\n\`${buildResult.query}\`\n\n`;
    
    // Add test results
    if (testResult) {
      response += `**Query Test Results:**\n`;
      response += `✅ Query is valid and returns ${testResult.total_cards} cards\n`;
      
      if (testResult.total_cards === 0) {
        response += `⚠️ No results found. Consider broadening your search.\n`;
      } else if (testResult.total_cards > params.max_results * 5) {
        response += `⚠️ Many results (${testResult.total_cards}). Consider adding more constraints.\n`;
      } else {
        response += `✨ Good result count for exploration.\n`;
      }
      response += '\n';
    }
    
    // Add explanation if requested
    if (params.explain_mapping) {
      response += `**Explanation:**\n${buildResult.explanation}\n\n`;
      
      response += `**Natural Language Mapping:**\n`;
      response += this.formatConceptMapping(parsed);
      response += '\n';
    }
    
    // Add confidence information
    response += `**Confidence Scores:**\n`;
    response += `• Parsing Confidence: ${(parsed.confidence * 100).toFixed(0)}%\n`;
    response += `• Query Build Confidence: ${(buildResult.confidence * 100).toFixed(0)}%\n`;
    
    if (parsed.ambiguities && parsed.ambiguities.length > 0) {
      response += `• Detected Ambiguities: ${parsed.ambiguities.length}\n`;
    }
    response += '\n';
    
    // Add optimizations applied
    if (buildResult.optimizations.length > 0) {
      response += `**Optimizations Applied:**\n`;
      for (const opt of buildResult.optimizations) {
        response += `• ${opt.type}: ${opt.reason}\n`;
      }
      response += '\n';
    }
    
    // Add alternatives if requested
    if (params.include_alternatives && buildResult.alternatives.length > 0) {
      response += `**Alternative Queries:**\n`;
      for (const alt of buildResult.alternatives) {
        response += `• \`${alt.query}\` - ${alt.description}\n`;
      }
      response += '\n';
    }
    
    // Add usage instructions
    response += `**Usage:**\n`;
    response += `You can now use this query with the \`search_cards\` tool:\n`;
    response += `\`\`\`json\n`;
    response += `{\n`;
    response += `  "tool": "search_cards",\n`;
    response += `  "arguments": {\n`;
    response += `    "query": "${buildResult.query}",\n`;
    response += `    "limit": ${params.max_results}\n`;
    response += `  }\n`;
    response += `}\n`;
    response += `\`\`\`\n`;
    
    return response;
  }
  
  private formatConceptMapping(parsed: ParsedQuery): string {
    const mappings: string[] = [];
    
    if (parsed.colors.length > 0) {
      const colorDescs = parsed.colors.map(c => {
        const colorNames = c.colors.map(color => this.getColorName(color)).join(', ');
        const type = c.exact ? 'exactly' : c.inclusive ? 'including' : 'any';
        return `${type} ${colorNames}`;
      });
      mappings.push(`• Colors: ${colorDescs.join('; ')}`);
    }
    
    if (parsed.types.length > 0) {
      const types = parsed.types.map(t => t.type || t.subtype).join(', ');
      mappings.push(`• Types: ${types}`);
    }
    
    if (parsed.archetypes.length > 0) {
      const archetypes = parsed.archetypes.map(a => a.name).join(', ');
      mappings.push(`• Archetypes: ${archetypes}`);
    }
    
    if (parsed.priceConstraints.length > 0) {
      const prices = parsed.priceConstraints.map(p => {
        if (p.max !== undefined && p.min !== undefined) {
          return `${p.min}-${p.max} ${p.currency.toUpperCase()}`;
        } else if (p.max !== undefined) {
          return `under ${p.max} ${p.currency.toUpperCase()}`;
        } else if (p.min !== undefined) {
          return `over ${p.min} ${p.currency.toUpperCase()}`;
        }
        return '';
      }).filter(p => p);
      mappings.push(`• Price: ${prices.join(', ')}`);
    }
    
    if (parsed.formats.length > 0) {
      const formats = parsed.formats.map(f => f.name).join(', ');
      mappings.push(`• Formats: ${formats}`);
    }
    
    return mappings.join('\n');
  }
  
  private handleLowConfidenceParsing(parsed: ParsedQuery, params: BuildQueryParams) {
    let response = `**⚠️ Low Confidence Parsing**\n\n`;
    response += `I had difficulty understanding your natural language query "${params.natural_query}".\n\n`;
    response += `**What I understood:**\n`;
    response += this.formatConceptMapping(parsed);
    response += '\n\n';
    
    if (parsed.ambiguities.length > 0) {
      response += `**Ambiguities detected:**\n`;
      for (const ambiguity of parsed.ambiguities) {
        response += `• ${ambiguity.description}\n`;
      }
      response += '\n';
    }
    
    response += `**Suggestions:**\n`;
    response += `• Try using more specific terms (e.g., "red creatures" instead of "red cards")\n`;
    response += `• Include format information (e.g., "in modern" or "for commander")\n`;
    response += `• Be more explicit about constraints (e.g., "under $10" or "with power 3 or greater")\n`;
    response += `• Use Magic terminology (e.g., "instant", "sorcery", "planeswalker")\n\n`;
    
    response += `**Examples of well-understood queries:**\n`;
    response += `• "red aggressive creatures under $5 for modern"\n`;
    response += `• "blue counterspells in standard format"\n`;
    response += `• "legendary artifacts that produce mana for commander"\n`;
    response += `• "white removal spells with converted mana cost 2 or less"\n`;
    
    return {
      content: [{
        type: 'text',
        text: response
      }],
      isError: false // Not an error, just low confidence
    };
  }
  
  private handleError(error: unknown) {
    if (error instanceof ValidationError) {
      return {
        content: [{
          type: 'text',
          text: `❌ **Parameter Validation Error**\n\n${error.message}\n\nPlease check your input and try again.`
        }],
        isError: true
      };
    }
    
    if (error instanceof ScryfallAPIError) {
      const statusMessages = {
        404: 'Query syntax error - the generated query was not accepted by Scryfall',
        422: 'Invalid query parameters',
        429: 'Rate limit exceeded - please try again in a moment'
      };
      
      const message = statusMessages[error.status as keyof typeof statusMessages] || 
                     `Scryfall API error: ${error.message}`;
      
      return {
        content: [{
          type: 'text',
          text: `❌ **Scryfall API Error**\n\n${message}\n\nThe generated query may need manual adjustment.`
        }],
        isError: true
      };
    }
    
    // Generic error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [{
        type: 'text',
        text: `❌ **Error Building Query**\n\n${errorMessage}\n\nPlease try rephrasing your natural language query.`
      }],
      isError: true
    };
  }
  
  private getColorName(colorCode: string): string {
    const colorMap = {
      'w': 'white',
      'u': 'blue', 
      'b': 'black',
      'r': 'red',
      'g': 'green',
      'c': 'colorless',
      'm': 'multicolor'
    };
    return colorMap[colorCode as keyof typeof colorMap] || colorCode;
  }
}
```

#### 3.2 Validation Functions

**File**: `src/utils/validators.ts` (additions)

```typescript
import { BuildQueryParamsSchema, type BuildQueryParams } from '../tools/build-scryfall-query.js';
import { ValidationError } from '../types/mcp-types.js';

export function validateBuildQueryParams(params: unknown): BuildQueryParams {
  try {
    return BuildQueryParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      const fieldPath = firstError.path.join('.');
      
      // Provide helpful error messages for common issues
      let message = `Invalid parameter '${fieldPath}': ${firstError.message}`;
      
      if (fieldPath === 'natural_query') {
        message += '\n\nTip: Describe what you want to find in plain English, like:\n';
        message += '• "red creatures under $5 for aggressive decks"\n';
        message += '• "blue counterspells in modern format"\n';
        message += '• "legendary artifacts that produce mana"';
      } else if (fieldPath === 'format') {
        message += '\n\nSupported formats: standard, modern, legacy, vintage, commander, pioneer, brawl, pauper, penny, historic, alchemy';
      } else if (fieldPath === 'optimize_for') {
        message += '\n\nOptimization strategies:\n';
        message += '• precision: Fewer, more relevant results\n';
        message += '• recall: Broader search with more results\n';
        message += '• discovery: Focus on interesting/unique cards\n';
        message += '• budget: Cost-effective options';
      }
      
      throw new ValidationError(message, fieldPath);
    }
    throw error;
  }
}
```

### Phase 4: Integration and Testing (Week 4)

#### 4.1 Server Integration

**File**: `src/server.ts` (modifications)

```typescript
import { BuildScryfallQueryTool } from './tools/build-scryfall-query.js';

export class ScryfallMCPServer {
  // ... existing code ...
  
  constructor(options: ScryfallMCPServerOptions = {}) {
    // ... existing initialization ...
    
    // Register tools
    this.tools.set('search_cards', new SearchCardsTool(this.scryfallClient));
    this.tools.set('get_card', new GetCardTool(this.scryfallClient));
    this.tools.set('get_card_prices', new GetCardPricesTool(this.scryfallClient));
    this.tools.set('random_card', new RandomCardTool(this.scryfallClient));
    this.tools.set('search_sets', new SearchSetsTool(this.scryfallClient));
    this.tools.set('build_scryfall_query', new BuildScryfallQueryTool(this.scryfallClient)); // New tool
    // ... other existing tools ...
  }
  
  // ... rest of existing code unchanged ...
}
```

#### 4.2 Comprehensive Test Suite

**File**: `tests/tools/build-scryfall-query.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildScryfallQueryTool } from '../../src/tools/build-scryfall-query.js';
import { ValidationError } from '../../src/types/mcp-types.js';

describe('BuildScryfallQueryTool', () => {
  let tool: BuildScryfallQueryTool;
  let mockScryfallClient: any;

  beforeEach(() => {
    mockScryfallClient = {
      searchCards: vi.fn()
    };
    tool = new BuildScryfallQueryTool(mockScryfallClient);
  });

  describe('Input Validation', () => {
    it('should reject empty natural query', async () => {
      const result = await tool.execute({
        natural_query: ''
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Natural query cannot be empty');
    });

    it('should reject overly long natural query', async () => {
      const result = await tool.execute({
        natural_query: 'a'.repeat(501)
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Natural query too long');
    });

    it('should reject invalid format', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures',
        format: 'invalid_format'
      });
      
      expect(result.isError).toBe(true);
    });

    it('should reject invalid max_results', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures',
        max_results: 200
      });
      
      expect(result.isError).toBe(true);
    });

    it('should accept valid parameters', async () => {
      mockScryfallClient.searchCards.mockResolvedValue({
        total_cards: 50,
        data: []
      });

      const result = await tool.execute({
        natural_query: 'red creatures',
        format: 'modern',
        optimize_for: 'precision',
        max_results: 20
      });
      
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Natural Language Processing', () => {
    beforeEach(() => {
      mockScryfallClient.searchCards.mockResolvedValue({
        total_cards: 25,
        data: []
      });
    });

    it('should parse simple color + type query', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures'
      });
      
      expect(result.content[0].text).toContain('c:r');
      expect(result.content[0].text).toContain('t:creature');
    });

    it('should parse price constraints', async () => {
      const result = await tool.execute({
        natural_query: 'blue spells under $10'
      });
      
      expect(result.content[0].text).toContain('usd<=10');
    });

    it('should parse archetype constraints', async () => {
      const result = await tool.execute({
        natural_query: 'red aggressive creatures'
      });
      
      expect(result.content[0].text).toContain('pow>=');
      expect(result.content[0].text).toContain('cmc<=');
    });

    it('should parse format constraints', async () => {
      const result = await tool.execute({
        natural_query: 'creatures for modern',
        format: 'modern'
      });
      
      expect(result.content[0].text).toContain('f:modern');
    });

    it('should parse guild names', async () => {
      const result = await tool.execute({
        natural_query: 'azorius control spells'
      });
      
      expect(result.content[0].text).toContain('c:wu');
    });

    it('should handle complex multi-concept queries', async () => {
      const result = await tool.execute({
        natural_query: 'red and green aggressive creatures under $5 for modern with power 3 or greater'
      });
      
      const queryText = result.content[0].text;
      expect(queryText).toContain('c:');
      expect(queryText).toContain('t:creature');
      expect(queryText).toContain('usd<=5');
      expect(queryText).toContain('f:modern');
      expect(queryText).toContain('pow>=3');
    });
  });

  describe('Query Optimization', () => {
    beforeEach(() => {
      mockScryfallClient.searchCards.mockResolvedValue({
        total_cards: 25,
        data: []
      });
    });

    it('should optimize for precision by default', async () => {
      const result = await tool.execute({
        natural_query: 'creatures'
      });
      
      // Should add format restrictions for precision
      expect(result.content[0].text).toMatch(/f:(standard|modern|commander)/);
    });

    it('should optimize for recall when requested', async () => {
      const result = await tool.execute({
        natural_query: 'aggressive creatures',
        optimize_for: 'recall'
      });
      
      // Should broaden power requirements
      expect(result.content[0].text).not.toContain('pow>=3');
    });

    it('should optimize for budget when requested', async () => {
      const result = await tool.execute({
        natural_query: 'powerful creatures',
        optimize_for: 'budget'
      });
      
      // Should add price constraints
      expect(result.content[0].text).toContain('usd<=');
    });
  });

  describe('Query Testing and Adjustment', () => {
    it('should broaden query when no results found', async () => {
      mockScryfallClient.searchCards.mockResolvedValue({
        total_cards: 0,
        data: []
      });

      const result = await tool.execute({
        natural_query: 'very specific creature type',
        test_query: true
      });
      
      expect(result.content[0].text).toContain('broadened automatically');
    });

    it('should narrow query when too many results', async () => {
      mockScryfallClient.searchCards.mockResolvedValue({
        total_cards: 1000,
        data: []
      });

      const result = await tool.execute({
        natural_query: 'creatures',
        max_results: 20,
        test_query: true
      });
      
      expect(result.content[0].text).toContain('narrowed automatically');
    });

    it('should handle query test failures gracefully', async () => {
      mockScryfallClient.searchCards.mockRejectedValue(new Error('API Error'));

      const result = await tool.execute({
        natural_query: 'red creatures',
        test_query: true
      });
      
      expect(result.isError).toBeUndefined();
      // Should still return generated query even if test fails
      expect(result.content[0].text).toContain('Generated Scryfall Query:');
    });
  });

  describe('Response Formatting', () => {
    beforeEach(() => {
      mockScryfallClient.searchCards.mockResolvedValue({
        total_cards: 25,
        data: []
      });
    });

    it('should include generated query', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures'
      });
      
      expect(result.content[0].text).toContain('Generated Scryfall Query:');
      expect(result.content[0].text).toContain('`c:r t:creature`');
    });

    it('should include explanation by default', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures'
      });
      
      expect(result.content[0].text).toContain('Explanation:');
      expect(result.content[0].text).toContain('Natural Language Mapping:');
    });

    it('should include confidence scores', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures'
      });
      
      expect(result.content[0].text).toContain('Parsing Confidence:');
      expect(result.content[0].text).toContain('Query Build Confidence:');
    });

    it('should include alternatives by default', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures'
      });
      
      expect(result.content[0].text).toContain('Alternative Queries:');
    });

    it('should include usage instructions', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures'
      });
      
      expect(result.content[0].text).toContain('Usage:');
      expect(result.content[0].text).toContain('search_cards');
    });

    it('should exclude explanation when requested', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures',
        explain_mapping: false
      });
      
      expect(result.content[0].text).not.toContain('Natural Language Mapping:');
    });

    it('should exclude alternatives when requested', async () => {
      const result = await tool.execute({
        natural_query: 'red creatures',
        include_alternatives: false
      });
      
      expect(result.content[0].text).not.toContain('Alternative Queries:');
    });
  });

  describe('Low Confidence Handling', () => {
    it('should provide helpful suggestions for unclear queries', async () => {
      const result = await tool.execute({
        natural_query: 'some cards maybe'
      });
      
      // This should trigger low confidence handling
      expect(result.content[0].text).toContain('Low Confidence Parsing');
      expect(result.content[0].text).toContain('Suggestions:');
      expect(result.content[0].text).toContain('Examples of well-understood queries:');
    });

    it('should show what was understood from unclear input', async () => {
      const result = await tool.execute({
        natural_query: 'red stuff for games'
      });
      
      expect(result.content[0].text).toContain('What I understood:');
    });
  });

  describe('Error Handling', () => {
    it('should handle Scryfall API errors gracefully', async () => {
      mockScryfallClient.searchCards.mockRejectedValue({
        status: 422,
        message: 'Invalid query'
      });

      const result = await tool.execute({
        natural_query: 'red creatures'
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Scryfall API Error');
    });

    it('should handle rate limit errors', async () => {
      mockScryfallClient.searchCards.mockRejectedValue({
        status: 429,
        message: 'Rate limited'
      });

      const result = await tool.execute({
        natural_query: 'red creatures'
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rate limit exceeded');
    });
  });
});
```

#### 4.3 Integration Tests

**File**: `tests/integration/natural-language-integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { NaturalLanguageParser } from '../../src/natural-language/parser.js';
import { QueryBuilderEngine } from '../../src/natural-language/query-builder.js';
import { ConceptExtractor } from '../../src/natural-language/concept-extractor.js';

describe('Natural Language Processing Integration', () => {
  const parser = new NaturalLanguageParser();
  const conceptExtractor = new ConceptExtractor();
  
  // Mock ScryfallClient for testing
  const mockScryfallClient = {
    searchCards: async () => ({ total_cards: 25, data: [] })
  };
  
  const queryBuilder = new QueryBuilderEngine(conceptExtractor, mockScryfallClient as any);

  describe('End-to-End Query Generation', () => {
    it('should handle simple color + type queries', async () => {
      const parsed = parser.parse('red creatures');
      const result = await queryBuilder.build(parsed, { optimize_for: 'precision' });
      
      expect(result.query).toContain('c:r');
      expect(result.query).toContain('t:creature');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle complex archetype queries', async () => {
      const parsed = parser.parse('blue control spells for standard under $20');
      const result = await queryBuilder.build(parsed, { 
        optimize_for: 'precision',
        format: 'standard'
      });
      
      expect(result.query).toContain('c:u');
      expect(result.query).toContain('f:standard');
      expect(result.query).toContain('usd<=20');
      expect(result.query).toMatch(/(counterspell|removal|draw)/);
    });

    it('should handle guild-based queries', async () => {
      const parsed = parser.parse('azorius cards for commander');
      const result = await queryBuilder.build(parsed, { 
        optimize_for: 'precision',
        format: 'commander'
      });
      
      expect(result.query).toContain('c:wu');
      expect(result.query).toContain('f:commander');
    });

    it('should handle power/toughness constraints', async () => {
      const parsed = parser.parse('aggressive creatures with power 3 or greater');
      const result = await queryBuilder.build(parsed, { optimize_for: 'precision' });
      
      expect(result.query).toContain('pow>=3');
      expect(result.query).toContain('t:creature');
    });

    it('should handle price ranges', async () => {
      const parsed = parser.parse('cards between $5 and $15');
      const result = await queryBuilder.build(parsed, { optimize_for: 'precision' });
      
      expect(result.query).toContain('usd>=5');
      expect(result.query).toContain('usd<=15');
    });
  });

  describe('Query Optimization Strategies', () => {
    it('should add appropriate constraints for precision optimization', async () => {
      const parsed = parser.parse('creatures');
      const result = await queryBuilder.build(parsed, { optimize_for: 'precision' });
      
      // Should add format constraints and price limits
      expect(result.query).toMatch(/f:(standard|modern|commander)/);
      expect(result.query).toContain('usd<=');
    });

    it('should broaden queries for recall optimization', async () => {
      const parsed = parser.parse('powerful creatures');
      const precisionResult = await queryBuilder.build(parsed, { optimize_for: 'precision' });
      const recallResult = await queryBuilder.build(parsed, { optimize_for: 'recall' });
      
      // Recall version should be less restrictive
      expect(recallResult.query.length).toBeLessThanOrEqual(precisionResult.query.length);
    });

    it('should add budget constraints for budget optimization', async () => {
      const parsed = parser.parse('good cards');
      const result = await queryBuilder.build(parsed, { optimize_for: 'budget' });
      
      expect(result.query).toContain('usd<=');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicting color requirements', async () => {
      const parsed = parser.parse('red and blue cards that are only red');
      const result = await queryBuilder.build(parsed, { optimize_for: 'precision' });
      
      // Should prioritize "only red" over "red and blue"
      expect(result.query).toContain('c:r');
      expect(result.query).not.toContain('c:ur');
    });

    it('should handle overlapping archetype constraints', async () => {
      const parsed = parser.parse('aggressive control deck');
      const result = await queryBuilder.build(parsed, { optimize_for: 'precision' });
      
      // Should resolve to one coherent strategy
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });
});
```

## Implementation Timeline and Milestones

### Week 1: Core Natural Language Processing
- **Days 1-2**: Natural Language Parser with basic pattern engines
- **Days 3-4**: Concept extraction and conflict resolution
- **Days 5-7**: Parser integration and basic testing

**Milestone**: Parse 20+ common natural language patterns with 80%+ accuracy

### Week 2: Query Building Engine  
- **Days 1-2**: Concept to Scryfall mapping system
- **Days 3-4**: Query builder with optimization strategies
- **Days 5-7**: Query testing and adjustment mechanisms

**Milestone**: Generate valid Scryfall queries for 90%+ of parsed concepts

### Week 3: MCP Tool Implementation
- **Days 1-3**: BuildScryfallQueryTool implementation
- **Days 4-5**: Input validation and error handling
- **Days 6-7**: Response formatting and user experience

**Milestone**: Complete MCP tool with comprehensive error handling

### Week 4: Integration and Testing
- **Days 1-2**: Server integration and tool registration
- **Days 3-5**: Comprehensive test suite development
- **Days 6-7**: Performance optimization and documentation

**Milestone**: Production-ready tool with 95%+ test coverage

## Success Metrics

### Accuracy Metrics
- **Parsing Accuracy**: 90%+ success rate for common natural language patterns
- **Query Validity**: 95%+ of generated queries accepted by Scryfall API
- **Result Relevance**: 80%+ of results match user intent (manual evaluation)

### Performance Metrics
- **Response Time**: <3 seconds for complex natural language processing
- **API Efficiency**: <2 API calls per query generation (test + optimize)
- **Memory Usage**: <50MB peak memory during processing

### User Experience Metrics
- **Confidence Scoring**: Accurate confidence scores (within 10% of manual evaluation)
- **Error Handling**: Clear, actionable error messages for 100% of error cases
- **Educational Value**: Explanations help users understand Scryfall syntax

## Risk Mitigation

### Technical Risks
- **Complex Natural Language**: Start with common patterns, expand iteratively
- **Scryfall API Changes**: Use existing validated patterns from enhanced validation
- **Performance Issues**: Implement caching and optimize pattern matching

### Implementation Risks
- **Scope Creep**: Focus on core 50 patterns before expanding
- **Integration Complexity**: Leverage existing MCP tool patterns
- **Testing Complexity**: Use data-driven testing with pattern libraries

## Future Enhancements

### Phase 2 Features (Post-MVP)
1. **Learning from Usage**: Track successful patterns to improve parsing
2. **Context Awareness**: Remember previous queries in session
3. **Advanced Archetypes**: Support for complex deck archetypes
4. **Multi-Language Support**: Support for non-English natural language

### Integration Opportunities
1. **Enhanced Validation**: Use with Feature 1 for complete validation pipeline
2. **Advanced Discovery**: Feed queries into Feature 3 for specialized searches
3. **Deck Building**: Integration with deck building tools and recommendations

This comprehensive implementation plan provides a detailed roadmap for creating a sophisticated Natural Language Query Builder that will significantly enhance the Scryfall MCP server's accessibility and usability for AI assistants and users.