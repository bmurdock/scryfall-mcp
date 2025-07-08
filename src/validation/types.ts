/**
 * Token types for Scryfall query tokenization
 */
export interface Token {
  type: TokenType;
  value: string;
  position: number;
  length: number;
}

export enum TokenType {
  OPERATOR = 'operator',
  BOOLEAN = 'boolean',
  PARENTHESIS = 'parenthesis',
  QUOTED_STRING = 'quoted_string',
  UNQUOTED_STRING = 'unquoted_string',
  COMPARISON = 'comparison',
  WHITESPACE = 'whitespace',
  EOF = 'eof'
}

/**
 * Operator token with parsed components
 */
export interface OperatorToken extends Token {
  type: TokenType.OPERATOR;
  operator: string;
  comparison?: ComparisonOperator;
  operatorValue: string;
}

/**
 * Boolean token for logical operations
 */
export interface BooleanToken extends Token {
  type: TokenType.BOOLEAN;
  operator: 'AND' | 'OR' | 'NOT';
}

/**
 * Parenthesis token for grouping
 */
export interface ParenthesisToken extends Token {
  type: TokenType.PARENTHESIS;
  kind: 'open' | 'close';
}

/**
 * Comparison operators for numeric/date values
 */
export enum ComparisonOperator {
  EQUALS = '=',
  NOT_EQUALS = '!=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL = '<=',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL = '>='
}

/**
 * Scryfall operator definition
 */
export interface OperatorDefinition {
  name: string;
  aliases: string[];
  description: string;
  valueType: OperatorValueType;
  validValues?: string[];
  allowsComparison: boolean;
  examples: string[];
  category: OperatorCategory;
}

/**
 * Value types for operators
 */
export enum OperatorValueType {
  STRING = 'string',
  NUMBER = 'number',
  COLOR = 'color',
  ENUM = 'enum',
  BOOLEAN = 'boolean',
  DATE = 'date',
  SET_CODE = 'set_code',
  RARITY = 'rarity',
  FORMAT = 'format',
  LOYALTY = 'loyalty',
  POWER_TOUGHNESS = 'power_toughness'
}

/**
 * Operator categories for organization
 */
export enum OperatorCategory {
  CARD_TEXT = 'card_text',
  MANA_AND_COLOR = 'mana_and_color',
  CARD_TYPES = 'card_types',
  STATS = 'stats',
  SET_AND_PRINTING = 'set_and_printing',
  GAME_DATA = 'game_data',
  METADATA = 'metadata'
}

/**
 * Query validation error with position information
 */
export class QueryValidationError extends Error {
  constructor(
    message: string,
    public position?: number,
    public length?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'QueryValidationError';
  }
}

/**
 * Validation result with detailed feedback
 */
export interface ValidationResult {
  isValid: boolean;
  errors: QueryValidationError[];
  warnings: string[];
  tokens?: Token[];
  suggestions?: string[];
}

/**
 * Tokenization result
 */
export interface TokenizationResult {
  tokens: Token[];
  errors: QueryValidationError[];
}

/**
 * Operator registry interface
 */
export interface OperatorRegistry {
  getOperator(name: string): OperatorDefinition | undefined;
  getAllOperators(): OperatorDefinition[];
  getOperatorsByCategory(category: OperatorCategory): OperatorDefinition[];
  hasOperator(name: string): boolean;
  validateOperatorValue(operator: string, value: string, comparison?: ComparisonOperator): ValidationResult;
}