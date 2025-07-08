/**
 * @fileoverview Core operator definitions for Scryfall query validation
 * 
 * This module provides comprehensive definitions for the most commonly used
 * Scryfall search operators, including validation rules, examples, and metadata.
 * 
 * @author Claude Code
 * @version 1.0.0
 */

import {
  ScryfallOperator,
  OperatorCategory,
  ValueType,
  ComparisonOperator,
  ValidationError,
  ValidationErrorType
} from '../types/validation-types.js';

/**
 * Custom validation function for color values
 */
const validateColorValue = (value: string): ValidationError | null => {
  const validColors = ['W', 'U', 'B', 'R', 'G', 'C'];
  const cleanValue = value.toUpperCase().replace(/[^WUBRGC]/g, '');
  
  if (cleanValue.length === 0) {
    return {
      type: ValidationErrorType.INVALID_VALUE,
      message: 'Color value cannot be empty',
      expected: 'One or more of: W, U, B, R, G, C',
      actual: value
    };
  }
  
  for (const char of cleanValue) {
    if (!validColors.includes(char)) {
      return {
        type: ValidationErrorType.INVALID_VALUE,
        message: `Invalid color '${char}'`,
        expected: 'One or more of: W, U, B, R, G, C',
        actual: value
      };
    }
  }
  
  return null;
};

/**
 * Custom validation function for mana cost values
 */
const validateManaCostValue = (value: string): ValidationError | null => {
  // Basic mana cost validation - matches patterns like {1}{R}, {2/W}, {X}, etc.
  const manaCostPattern = /^(\{[^}]+\})*$/;
  
  if (!manaCostPattern.test(value)) {
    return {
      type: ValidationErrorType.INVALID_VALUE,
      message: 'Invalid mana cost format',
      expected: 'Mana cost in format {1}{R}, {2/W}, {X}, etc.',
      actual: value
    };
  }
  
  return null;
};

/**
 * Custom validation function for numeric values
 */
const validateNumericValue = (value: string): ValidationError | null => {
  const numericPattern = /^[\d\+\-\*/\.]+$/;
  
  if (!numericPattern.test(value)) {
    return {
      type: ValidationErrorType.INVALID_VALUE,
      message: 'Invalid numeric value',
      expected: 'Numeric value (e.g., 1, 2.5, 1+, *)',
      actual: value
    };
  }
  
  return null;
};

/**
 * Core operator definitions for the most commonly used Scryfall operators
 */
export const CORE_OPERATORS: ScryfallOperator[] = [
  // TEXT OPERATORS
  {
    name: 'name',
    aliases: ['n'],
    description: 'Searches for cards with the specified name',
    category: OperatorCategory.TEXT,
    valueType: ValueType.STRING,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    caseSensitive: false,
    examples: [
      {
        query: 'name:"Lightning Bolt"',
        description: 'Find cards with exact name "Lightning Bolt"'
      },
      {
        query: 'name:/.*bolt.*/i',
        description: 'Find cards with "bolt" in the name (case-insensitive)'
      },
      {
        query: '-name:"Lightning Bolt"',
        description: 'Find cards that are NOT named "Lightning Bolt"'
      }
    ],
    helpText: 'Use quotes for exact matches, or regex patterns for flexible matching'
  },
  
  {
    name: 'oracle',
    aliases: ['o'],
    description: 'Searches the oracle text of cards',
    category: OperatorCategory.TEXT,
    valueType: ValueType.STRING,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    caseSensitive: false,
    examples: [
      {
        query: 'oracle:"flying"',
        description: 'Find cards with "flying" in their oracle text'
      },
      {
        query: 'o:trample',
        description: 'Find cards with "trample" in their oracle text'
      },
      {
        query: '-oracle:"enters the battlefield"',
        description: 'Find cards without "enters the battlefield" text'
      }
    ],
    helpText: 'Searches the full oracle text including abilities and flavor text'
  },

  // COLOR OPERATORS
  {
    name: 'color',
    aliases: ['c'],
    description: 'Searches for cards of the specified color(s)',
    category: OperatorCategory.MANA,
    valueType: ValueType.COLOR,
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    customValidation: validateColorValue,
    examples: [
      {
        query: 'color:R',
        description: 'Find red cards'
      },
      {
        query: 'c:WU',
        description: 'Find white and blue cards'
      },
      {
        query: 'color>=RG',
        description: 'Find cards that are at least red and green'
      }
    ],
    helpText: 'Use W, U, B, R, G, C for white, blue, black, red, green, colorless'
  },

  {
    name: 'identity',
    aliases: ['id'],
    description: 'Searches for cards with the specified color identity',
    category: OperatorCategory.MANA,
    valueType: ValueType.COLOR,
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    customValidation: validateColorValue,
    examples: [
      {
        query: 'identity:UB',
        description: 'Find cards with blue and black color identity'
      },
      {
        query: 'id<=WU',
        description: 'Find cards with at most white and blue identity'
      },
      {
        query: 'identity:C',
        description: 'Find colorless cards'
      }
    ],
    helpText: 'Color identity includes mana costs, rules text, and color indicators'
  },

  // TYPE OPERATORS
  {
    name: 'type',
    aliases: ['t'],
    description: 'Searches for cards of the specified type',
    category: OperatorCategory.TYPE,
    valueType: ValueType.STRING,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    caseSensitive: false,
    examples: [
      {
        query: 'type:creature',
        description: 'Find creature cards'
      },
      {
        query: 't:instant',
        description: 'Find instant cards'
      },
      {
        query: 'type:"legendary creature"',
        description: 'Find legendary creature cards'
      }
    ],
    helpText: 'Searches both card types and subtypes'
  },

  // MANA OPERATORS
  {
    name: 'mana',
    aliases: ['m'],
    description: 'Searches for cards with the specified mana cost',
    category: OperatorCategory.MANA,
    valueType: ValueType.MANA_COST,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    customValidation: validateManaCostValue,
    examples: [
      {
        query: 'mana:{1}{R}',
        description: 'Find cards with mana cost {1}{R}'
      },
      {
        query: 'm:{2/W}',
        description: 'Find cards with hybrid mana cost {2/W}'
      },
      {
        query: 'mana:{X}{R}{R}',
        description: 'Find cards with mana cost {X}{R}{R}'
      }
    ],
    helpText: 'Use curly braces for mana symbols: {1}, {R}, {2/W}, {X}, etc.'
  },

  {
    name: 'manavalue',
    aliases: ['mv', 'cmc'],
    description: 'Searches for cards with the specified mana value (converted mana cost)',
    category: OperatorCategory.MANA,
    valueType: ValueType.NUMBER,
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    customValidation: validateNumericValue,
    examples: [
      {
        query: 'manavalue:3',
        description: 'Find cards with mana value 3'
      },
      {
        query: 'mv<=2',
        description: 'Find cards with mana value 2 or less'
      },
      {
        query: 'cmc>7',
        description: 'Find cards with mana value greater than 7'
      }
    ],
    helpText: 'The total mana cost converted to a number (X = 0 unless on stack)'
  },

  // STATS OPERATORS
  {
    name: 'power',
    aliases: ['pow'],
    description: 'Searches for creatures with the specified power',
    category: OperatorCategory.STATS,
    valueType: ValueType.NUMBER,
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    examples: [
      {
        query: 'power:2',
        description: 'Find creatures with power 2'
      },
      {
        query: 'pow>=5',
        description: 'Find creatures with power 5 or greater'
      },
      {
        query: 'power:*',
        description: 'Find creatures with * power'
      }
    ],
    helpText: 'Only applies to creatures and vehicles'
  },

  {
    name: 'toughness',
    aliases: ['tou'],
    description: 'Searches for creatures with the specified toughness',
    category: OperatorCategory.STATS,
    valueType: ValueType.NUMBER,
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    examples: [
      {
        query: 'toughness:4',
        description: 'Find creatures with toughness 4'
      },
      {
        query: 'tou<=1',
        description: 'Find creatures with toughness 1 or less'
      },
      {
        query: 'toughness:*',
        description: 'Find creatures with * toughness'
      }
    ],
    helpText: 'Only applies to creatures and vehicles'
  },

  // FORMAT OPERATORS
  {
    name: 'format',
    aliases: ['f', 'legal'],
    description: 'Searches for cards legal in the specified format',
    category: OperatorCategory.FORMAT,
    valueType: ValueType.ENUM,
    validValues: [
      'standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer',
      'pauper', 'historic', 'alchemy', 'explorer', 'brawl', 'future',
      'penny', 'premodern', 'predh', 'oldschool'
    ],
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    examples: [
      {
        query: 'format:standard',
        description: 'Find cards legal in Standard'
      },
      {
        query: 'f:modern',
        description: 'Find cards legal in Modern'
      },
      {
        query: '-format:legacy',
        description: 'Find cards NOT legal in Legacy'
      }
    ],
    helpText: 'Checks if cards are legal, banned, or restricted in the format'
  },

  // PRINTING OPERATORS
  {
    name: 'set',
    aliases: ['s', 'e'],
    description: 'Searches for cards from the specified set',
    category: OperatorCategory.PRINTING,
    valueType: ValueType.STRING,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    caseSensitive: false,
    examples: [
      {
        query: 'set:dom',
        description: 'Find cards from Dominaria'
      },
      {
        query: 's:"Throne of Eldraine"',
        description: 'Find cards from Throne of Eldraine'
      },
      {
        query: '-set:lea',
        description: 'Find cards NOT from Limited Edition Alpha'
      }
    ],
    helpText: 'Use 3-letter set codes or full set names in quotes'
  },

  {
    name: 'rarity',
    aliases: ['r'],
    description: 'Searches for cards of the specified rarity',
    category: OperatorCategory.PRINTING,
    valueType: ValueType.ENUM,
    validValues: ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'],
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    examples: [
      {
        query: 'rarity:mythic',
        description: 'Find mythic rare cards'
      },
      {
        query: 'r>=rare',
        description: 'Find rare and mythic rare cards'
      },
      {
        query: '-rarity:common',
        description: 'Find non-common cards'
      }
    ],
    helpText: 'Rarity hierarchy: common < uncommon < rare < mythic'
  },

  // PROPERTIES OPERATORS
  {
    name: 'is',
    aliases: [],
    description: 'Searches for cards with specific properties',
    category: OperatorCategory.PROPERTIES,
    valueType: ValueType.ENUM,
    validValues: [
      'permanent', 'spell', 'historic', 'modal', 'split', 'flip', 'transform',
      'meld', 'leveler', 'commander', 'vanilla', 'french-vanilla', 'timeshifted',
      'colorshifted', 'funny', 'reserved', 'reprint', 'promo', 'digital',
      'oversized', 'textless', 'full-art', 'spotlight', 'unique', 'booster',
      'planeswalker', 'creature', 'land', 'instant', 'sorcery', 'artifact',
      'enchantment', 'tribal'
    ],
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    examples: [
      {
        query: 'is:permanent',
        description: 'Find permanent cards'
      },
      {
        query: 'is:commander',
        description: 'Find cards that can be commanders'
      },
      {
        query: '-is:reprint',
        description: 'Find cards that are not reprints'
      }
    ],
    helpText: 'Special properties and characteristics of cards'
  },

  {
    name: 'new',
    aliases: ['firstprint'],
    description: 'Searches for cards that are new (first printing)',
    category: OperatorCategory.PROPERTIES,
    valueType: ValueType.BOOLEAN,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    examples: [
      {
        query: 'new:true',
        description: 'Find cards that are new (first printing)'
      },
      {
        query: '-new:true',
        description: 'Find cards that are reprints'
      }
    ],
    helpText: 'Cards that are being printed for the first time'
  },

  // MARKET OPERATORS
  {
    name: 'usd',
    aliases: ['price'],
    description: 'Searches for cards within the specified USD price range',
    category: OperatorCategory.MARKET,
    valueType: ValueType.NUMBER,
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    customValidation: validateNumericValue,
    examples: [
      {
        query: 'usd>10',
        description: 'Find cards worth more than $10'
      },
      {
        query: 'price<=5',
        description: 'Find cards worth $5 or less'
      },
      {
        query: 'usd=0',
        description: 'Find cards with no USD price'
      }
    ],
    helpText: 'Based on current market prices in USD'
  },

  // TEMPORAL OPERATORS
  {
    name: 'year',
    aliases: ['released'],
    description: 'Searches for cards released in the specified year',
    category: OperatorCategory.TEMPORAL,
    valueType: ValueType.NUMBER,
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    examples: [
      {
        query: 'year:2023',
        description: 'Find cards released in 2023'
      },
      {
        query: 'released>=2020',
        description: 'Find cards released in 2020 or later'
      },
      {
        query: 'year<2000',
        description: 'Find cards released before 2000'
      }
    ],
    helpText: 'Based on the set release date'
  },

  // METADATA OPERATORS
  {
    name: 'artist',
    aliases: ['art', 'a'],
    description: 'Searches for cards by the specified artist',
    category: OperatorCategory.METADATA,
    valueType: ValueType.STRING,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    caseSensitive: false,
    examples: [
      {
        query: 'artist:"John Avon"',
        description: 'Find cards illustrated by John Avon'
      },
      {
        query: 'art:rebecca',
        description: 'Find cards by artists with "rebecca" in their name'
      },
      {
        query: '-artist:"Mark Tedin"',
        description: 'Find cards NOT illustrated by Mark Tedin'
      }
    ],
    helpText: 'Use quotes for exact artist names'
  },

  {
    name: 'flavor',
    aliases: ['ft'],
    description: 'Searches the flavor text of cards',
    category: OperatorCategory.TEXT,
    valueType: ValueType.STRING,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    caseSensitive: false,
    examples: [
      {
        query: 'flavor:"The dead know only"',
        description: 'Find cards with specific flavor text'
      },
      {
        query: 'ft:death',
        description: 'Find cards with "death" in flavor text'
      },
      {
        query: '-flavor:""',
        description: 'Find cards without flavor text'
      }
    ],
    helpText: 'Searches only the flavor text, not rules text'
  },

  // ADVANCED OPERATORS
  {
    name: 'produces',
    aliases: ['prod'],
    description: 'Searches for cards that can produce the specified mana',
    category: OperatorCategory.MANA,
    valueType: ValueType.COLOR,
    supportsComparison: true,
    supportedComparisons: [ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    customValidation: validateColorValue,
    examples: [
      {
        query: 'produces:R',
        description: 'Find cards that can produce red mana'
      },
      {
        query: 'prod:WU',
        description: 'Find cards that can produce white or blue mana'
      },
      {
        query: 'produces:C',
        description: 'Find cards that can produce colorless mana'
      }
    ],
    helpText: 'Includes lands, mana rocks, and other mana-producing permanents'
  },

  {
    name: 'devotion',
    aliases: ['dev'],
    description: 'Searches for cards with the specified devotion to a color',
    category: OperatorCategory.MANA,
    valueType: ValueType.STRING,
    supportsComparison: true,
    supportedComparisons: [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.LESS_THAN_OR_EQUAL,
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.GREATER_THAN_OR_EQUAL
    ],
    supportsNegation: true,
    defaultComparison: ComparisonOperator.EQUAL,
    examples: [
      {
        query: 'devotion:R>=3',
        description: 'Find cards with devotion to red 3 or greater'
      },
      {
        query: 'dev:W=2',
        description: 'Find cards with exactly 2 devotion to white'
      }
    ],
    helpText: 'Counts mana symbols in mana cost for devotion calculation'
  }
];

/**
 * Creates a lookup map for operators by name and aliases
 */
export function createOperatorLookup(): Map<string, ScryfallOperator> {
  const lookup = new Map<string, ScryfallOperator>();
  
  for (const operator of CORE_OPERATORS) {
    // Add primary name
    lookup.set(operator.name.toLowerCase(), operator);
    
    // Add aliases
    for (const alias of operator.aliases) {
      lookup.set(alias.toLowerCase(), operator);
    }
  }
  
  return lookup;
}

/**
 * Gets an operator by name or alias
 */
export function getOperator(name: string): ScryfallOperator | undefined {
  const lookup = createOperatorLookup();
  return lookup.get(name.toLowerCase());
}

/**
 * Gets all operators in a specific category
 */
export function getOperatorsByCategory(category: OperatorCategory): ScryfallOperator[] {
  return CORE_OPERATORS.filter(op => op.category === category);
}

/**
 * Gets all operators that support a specific comparison
 */
export function getOperatorsByComparison(comparison: ComparisonOperator): ScryfallOperator[] {
  return CORE_OPERATORS.filter(op => 
    op.supportedComparisons?.includes(comparison) ?? false
  );
}

/**
 * Gets all operators that support negation
 */
export function getNegatableOperators(): ScryfallOperator[] {
  return CORE_OPERATORS.filter(op => op.supportsNegation);
}

/**
 * Gets all deprecated operators
 */
export function getDeprecatedOperators(): ScryfallOperator[] {
  return CORE_OPERATORS.filter(op => op.deprecated);
}

/**
 * Gets operators with high performance impact
 */
export function getHighImpactOperators(): ScryfallOperator[] {
  return CORE_OPERATORS.filter(op => op.performanceImpact === 'high');
}

/**
 * Validates if an operator supports a specific comparison
 */
export function validateOperatorComparison(
  operator: ScryfallOperator,
  comparison: ComparisonOperator
): boolean {
  return operator.supportedComparisons?.includes(comparison) ?? false;
}

/**
 * Gets suggested operators based on a partial match
 */
export function getSuggestedOperators(partial: string): ScryfallOperator[] {
  const lowercasePartial = partial.toLowerCase();
  const suggestions: ScryfallOperator[] = [];
  
  for (const operator of CORE_OPERATORS) {
    // Check if name starts with partial
    if (operator.name.toLowerCase().startsWith(lowercasePartial)) {
      suggestions.push(operator);
      continue;
    }
    
    // Check if any alias starts with partial
    for (const alias of operator.aliases) {
      if (alias.toLowerCase().startsWith(lowercasePartial)) {
        suggestions.push(operator);
        break;
      }
    }
  }
  
  return suggestions;
}

/**
 * Export the operator lookup for external use
 */
export const OPERATOR_LOOKUP = createOperatorLookup();