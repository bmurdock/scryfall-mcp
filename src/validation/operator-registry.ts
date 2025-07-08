import { 
  OperatorDefinition, 
  OperatorValueType, 
  OperatorCategory, 
  OperatorRegistry,
  ComparisonOperator,
  ValidationResult,
  QueryValidationError
} from './types.js';

/**
 * Default operator registry with all Scryfall search operators
 */
export class DefaultOperatorRegistry implements OperatorRegistry {
  private operators: Map<string, OperatorDefinition> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.initializeOperators();
  }

  private initializeOperators(): void {
    const operators: OperatorDefinition[] = [
      // Card Text Operators
      {
        name: 'oracle',
        aliases: ['o'],
        description: 'Searches card oracle text',
        valueType: OperatorValueType.STRING,
        allowsComparison: false,
        examples: ['o:flying', 'oracle:"first strike"'],
        category: OperatorCategory.CARD_TEXT
      },
      {
        name: 'name',
        aliases: ['n'],
        description: 'Searches card names',
        valueType: OperatorValueType.STRING,
        allowsComparison: false,
        examples: ['n:lightning', 'name:"Lightning Bolt"'],
        category: OperatorCategory.CARD_TEXT
      },
      {
        name: 'type',
        aliases: ['t'],
        description: 'Searches type lines',
        valueType: OperatorValueType.STRING,
        allowsComparison: false,
        examples: ['t:creature', 'type:"legendary creature"'],
        category: OperatorCategory.CARD_TYPES
      },
      {
        name: 'flavor',
        aliases: ['ft'],
        description: 'Searches flavor text',
        valueType: OperatorValueType.STRING,
        allowsComparison: false,
        examples: ['ft:magic', 'flavor:"ancient power"'],
        category: OperatorCategory.CARD_TEXT
      },

      // Mana and Color Operators
      {
        name: 'color',
        aliases: ['c'],
        description: 'Searches card colors',
        valueType: OperatorValueType.COLOR,
        validValues: ['w', 'u', 'b', 'r', 'g', 'c', 'm'],
        allowsComparison: true,
        examples: ['c:red', 'c>=wu', 'color:colorless'],
        category: OperatorCategory.MANA_AND_COLOR
      },
      {
        name: 'coloridentity',
        aliases: ['id', 'identity'],
        description: 'Searches color identity',
        valueType: OperatorValueType.COLOR,
        validValues: ['w', 'u', 'b', 'r', 'g', 'c', 'm'],
        allowsComparison: true,
        examples: ['id:wu', 'identity<=wubrg'],
        category: OperatorCategory.MANA_AND_COLOR
      },
      {
        name: 'mana',
        aliases: ['m'],
        description: 'Searches mana costs',
        valueType: OperatorValueType.STRING,
        allowsComparison: false,
        examples: ['m:{2}{R}', 'mana:"{U}{U}"'],
        category: OperatorCategory.MANA_AND_COLOR
      },
      {
        name: 'cmc',
        aliases: ['mv', 'manavalue'],
        description: 'Searches mana values',
        valueType: OperatorValueType.NUMBER,
        allowsComparison: true,
        examples: ['cmc:3', 'mv>=4', 'manavalue<=2'],
        category: OperatorCategory.MANA_AND_COLOR
      },

      // Stats Operators
      {
        name: 'power',
        aliases: ['pow'],
        description: 'Searches creature power',
        valueType: OperatorValueType.POWER_TOUGHNESS,
        allowsComparison: true,
        examples: ['pow:2', 'power>=4', 'pow:*'],
        category: OperatorCategory.STATS
      },
      {
        name: 'toughness',
        aliases: ['tou'],
        description: 'Searches creature toughness',
        valueType: OperatorValueType.POWER_TOUGHNESS,
        allowsComparison: true,
        examples: ['tou:3', 'toughness<=2', 'tou:*'],
        category: OperatorCategory.STATS
      },
      {
        name: 'loyalty',
        aliases: ['loy'],
        description: 'Searches planeswalker loyalty',
        valueType: OperatorValueType.LOYALTY,
        allowsComparison: true,
        examples: ['loy:4', 'loyalty>=3'],
        category: OperatorCategory.STATS
      },

      // Set and Printing Operators
      {
        name: 'set',
        aliases: ['s', 'e'],
        description: 'Searches by set code',
        valueType: OperatorValueType.SET_CODE,
        allowsComparison: false,
        examples: ['s:dom', 'set:war', 'e:thb'],
        category: OperatorCategory.SET_AND_PRINTING
      },
      {
        name: 'rarity',
        aliases: ['r'],
        description: 'Searches by rarity',
        valueType: OperatorValueType.RARITY,
        validValues: ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'],
        allowsComparison: true,
        examples: ['r:rare', 'rarity>=uncommon'],
        category: OperatorCategory.SET_AND_PRINTING
      },
      {
        name: 'artist',
        aliases: ['a'],
        description: 'Searches by artist name',
        valueType: OperatorValueType.STRING,
        allowsComparison: false,
        examples: ['a:nielsen', 'artist:"rebecca guay"'],
        category: OperatorCategory.SET_AND_PRINTING
      },

      // Game Data Operators
      {
        name: 'format',
        aliases: ['f', 'legal'],
        description: 'Searches by format legality',
        valueType: OperatorValueType.FORMAT,
        validValues: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'historic', 'brawl', 'pauper'],
        allowsComparison: false,
        examples: ['f:standard', 'legal:modern', 'format:commander'],
        category: OperatorCategory.GAME_DATA
      },
      {
        name: 'banned',
        aliases: ['b'],
        description: 'Searches banned cards in format',
        valueType: OperatorValueType.FORMAT,
        validValues: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'historic', 'brawl', 'pauper'],
        allowsComparison: false,
        examples: ['banned:standard', 'b:modern'],
        category: OperatorCategory.GAME_DATA
      },
      {
        name: 'restricted',
        aliases: ['rest'],
        description: 'Searches restricted cards in format',
        valueType: OperatorValueType.FORMAT,
        validValues: ['vintage'],
        allowsComparison: false,
        examples: ['restricted:vintage', 'rest:vintage'],
        category: OperatorCategory.GAME_DATA
      },

      // Metadata Operators
      {
        name: 'is',
        aliases: [],
        description: 'Searches by card properties',
        valueType: OperatorValueType.ENUM,
        validValues: ['foil', 'nonfoil', 'promo', 'reprint', 'digital', 'reserved', 'funny', 'booster', 'timeshifted', 'colorshifted', 'futureshifted'],
        allowsComparison: false,
        examples: ['is:foil', 'is:reprint', 'is:reserved'],
        category: OperatorCategory.METADATA
      },
      {
        name: 'not',
        aliases: [],
        description: 'Searches by excluded properties',
        valueType: OperatorValueType.ENUM,
        validValues: ['foil', 'nonfoil', 'promo', 'reprint', 'digital', 'reserved', 'funny', 'booster', 'timeshifted', 'colorshifted', 'futureshifted'],
        allowsComparison: false,
        examples: ['not:reprint', 'not:promo'],
        category: OperatorCategory.METADATA
      },
      {
        name: 'game',
        aliases: ['g'],
        description: 'Searches by game availability',
        valueType: OperatorValueType.ENUM,
        validValues: ['paper', 'arena', 'mtgo'],
        allowsComparison: false,
        examples: ['game:paper', 'g:arena'],
        category: OperatorCategory.METADATA
      },
      {
        name: 'year',
        aliases: ['y'],
        description: 'Searches by release year',
        valueType: OperatorValueType.NUMBER,
        allowsComparison: true,
        examples: ['year:2020', 'y>=2015', 'year<2010'],
        category: OperatorCategory.SET_AND_PRINTING
      }
    ];

    // Register all operators and their aliases
    operators.forEach(op => {
      this.operators.set(op.name, op);
      op.aliases.forEach(alias => {
        this.aliasMap.set(alias, op.name);
      });
    });
  }

  getOperator(name: string): OperatorDefinition | undefined {
    // Check if it's an alias first
    const actualName = this.aliasMap.get(name) || name;
    return this.operators.get(actualName);
  }

  getAllOperators(): OperatorDefinition[] {
    return Array.from(this.operators.values());
  }

  getOperatorsByCategory(category: OperatorCategory): OperatorDefinition[] {
    return this.getAllOperators().filter(op => op.category === category);
  }

  hasOperator(name: string): boolean {
    return this.operators.has(name) || this.aliasMap.has(name);
  }

  validateOperatorValue(operator: string, value: string, comparison?: ComparisonOperator): ValidationResult {
    const op = this.getOperator(operator);
    if (!op) {
      return {
        isValid: false,
        errors: [new QueryValidationError(`Unknown operator: ${operator}`, undefined, undefined, 'UNKNOWN_OPERATOR')],
        warnings: []
      };
    }

    // Check if comparison is allowed
    if (comparison && !op.allowsComparison) {
      return {
        isValid: false,
        errors: [new QueryValidationError(`Operator '${operator}' does not support comparison operators`, undefined, undefined, 'COMPARISON_NOT_ALLOWED')],
        warnings: []
      };
    }

    // Validate value based on type
    return this.validateValueByType(op, value);
  }

  private validateValueByType(op: OperatorDefinition, value: string): ValidationResult {
    const errors: QueryValidationError[] = [];
    const warnings: string[] = [];

    switch (op.valueType) {
      case OperatorValueType.ENUM:
        if (op.validValues && !op.validValues.includes(value.toLowerCase())) {
          errors.push(new QueryValidationError(
            `Invalid value '${value}' for operator '${op.name}'. Valid values: ${op.validValues.join(', ')}`,
            undefined, undefined, 'INVALID_ENUM_VALUE'
          ));
        }
        break;

      case OperatorValueType.NUMBER:
        if (isNaN(Number(value)) && value !== '*') {
          errors.push(new QueryValidationError(
            `Invalid numeric value '${value}' for operator '${op.name}'`,
            undefined, undefined, 'INVALID_NUMBER'
          ));
        }
        break;

      case OperatorValueType.COLOR:
        if (!this.isValidColorValue(value)) {
          errors.push(new QueryValidationError(
            `Invalid color value '${value}'. Use color letters (w, u, b, r, g, c) or 'colorless'`,
            undefined, undefined, 'INVALID_COLOR'
          ));
        }
        break;

      case OperatorValueType.SET_CODE:
        if (!/^[a-z0-9]{3,4}$/i.test(value)) {
          errors.push(new QueryValidationError(
            `Invalid set code '${value}'. Set codes must be 3-4 alphanumeric characters`,
            undefined, undefined, 'INVALID_SET_CODE'
          ));
        }
        break;

      case OperatorValueType.RARITY:
        if (op.validValues && !op.validValues.includes(value.toLowerCase())) {
          errors.push(new QueryValidationError(
            `Invalid rarity '${value}'. Valid rarities: ${op.validValues.join(', ')}`,
            undefined, undefined, 'INVALID_RARITY'
          ));
        }
        break;

      case OperatorValueType.POWER_TOUGHNESS:
        if (!this.isValidPowerToughness(value)) {
          errors.push(new QueryValidationError(
            `Invalid power/toughness value '${value}'. Must be a number, *, or X`,
            undefined, undefined, 'INVALID_POWER_TOUGHNESS'
          ));
        }
        break;

      case OperatorValueType.LOYALTY:
        if (!/^[0-9]+$/.test(value) && value !== '*' && value !== 'X') {
          errors.push(new QueryValidationError(
            `Invalid loyalty value '${value}'. Must be a number, *, or X`,
            undefined, undefined, 'INVALID_LOYALTY'
          ));
        }
        break;

      case OperatorValueType.FORMAT:
        if (op.validValues && !op.validValues.includes(value.toLowerCase())) {
          errors.push(new QueryValidationError(
            `Invalid format '${value}'. Valid formats: ${op.validValues.join(', ')}`,
            undefined, undefined, 'INVALID_FORMAT'
          ));
        }
        break;

      case OperatorValueType.STRING:
        // String values are generally valid, but check for reasonable length
        if (value.length > 500) {
          warnings.push(`Very long search term may not return expected results`);
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private isValidColorValue(value: string): boolean {
    const lowerValue = value.toLowerCase();
    
    // Handle full color names
    const colorNames = ['white', 'blue', 'black', 'red', 'green', 'colorless', 'multicolored'];
    if (colorNames.includes(lowerValue)) return true;
    
    // Handle single letters and combinations
    if (lowerValue === 'c' || lowerValue === 'm') return true;
    
    // Check if all characters are valid color letters
    const colorLetters = /^[wubrgcm]+$/i;
    return colorLetters.test(lowerValue);
  }

  private isValidPowerToughness(value: string): boolean {
    // Allow numbers, *, X, and special cases like +1, -1
    return /^[*X]$/.test(value) || /^[+-]?\d+$/.test(value);
  }
}

// Export singleton instance
export const operatorRegistry = new DefaultOperatorRegistry();