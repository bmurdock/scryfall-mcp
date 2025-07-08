/**
 * @fileoverview Core validation types for the Enhanced Query Validation system
 * 
 * This module provides comprehensive interfaces for validating Scryfall search queries,
 * including validation results, errors, warnings, suggestions, and operator definitions.
 * 
 * @author Claude Code
 * @version 1.0.0
 */

/**
 * Represents the severity level of a validation issue
 */
export enum ValidationSeverity {
  /** Critical error that prevents query execution */
  ERROR = 'error',
  /** Warning that may affect query results */
  WARNING = 'warning',
  /** Informational message or suggestion */
  INFO = 'info'
}

/**
 * Represents the confidence level of a suggestion
 */
export enum SuggestionConfidence {
  /** Very high confidence (90-100%) */
  HIGH = 'high',
  /** Medium confidence (70-89%) */
  MEDIUM = 'medium',
  /** Low confidence (50-69%) */
  LOW = 'low'
}

/**
 * Represents different types of validation errors
 */
export enum ValidationErrorType {
  /** Syntax error in query structure */
  SYNTAX_ERROR = 'syntax_error',
  /** Invalid operator usage */
  INVALID_OPERATOR = 'invalid_operator',
  /** Invalid value for operator */
  INVALID_VALUE = 'invalid_value',
  /** Missing required parameter */
  MISSING_PARAMETER = 'missing_parameter',
  /** Deprecated operator or syntax */
  DEPRECATED_SYNTAX = 'deprecated_syntax',
  /** Performance warning */
  PERFORMANCE_WARNING = 'performance_warning',
  /** Logic error in query */
  LOGIC_ERROR = 'logic_error'
}

/**
 * Position information for errors and warnings in the query string
 */
export interface QueryPosition {
  /** Starting character position (0-indexed) */
  start: number;
  /** Ending character position (0-indexed) */
  end: number;
  /** Line number (1-indexed) */
  line?: number;
  /** Column number (1-indexed) */
  column?: number;
}

/**
 * Detailed validation error information
 */
export interface ValidationError {
  /** Error type classification */
  type: ValidationErrorType;
  /** Human-readable error message */
  message: string;
  /** Position in query where error occurred */
  position?: QueryPosition;
  /** The problematic query segment */
  segment?: string;
  /** Suggested fix for the error */
  suggestion?: string;
  /** Additional context or help text */
  context?: string;
  /** Related operator information */
  operator?: string;
  /** Expected value format or type */
  expected?: string;
  /** Actual value that caused the error */
  actual?: string;
}

/**
 * Detailed validation warning information
 */
export interface ValidationWarning {
  /** Warning type classification */
  type: ValidationErrorType;
  /** Human-readable warning message */
  message: string;
  /** Position in query where warning occurred */
  position?: QueryPosition;
  /** The query segment causing the warning */
  segment?: string;
  /** Suggested improvement */
  suggestion?: string;
  /** Additional context or help text */
  context?: string;
  /** Related operator information */
  operator?: string;
  /** Severity level of the warning */
  severity: ValidationSeverity;
}

/**
 * Query improvement suggestion
 */
export interface QuerySuggestion {
  /** Suggestion type */
  type: 'replacement' | 'addition' | 'removal' | 'reorder';
  /** Description of the suggestion */
  description: string;
  /** Original query segment */
  original?: string;
  /** Suggested replacement */
  replacement?: string;
  /** Position where suggestion applies */
  position?: QueryPosition;
  /** Confidence level of the suggestion */
  confidence: SuggestionConfidence;
  /** Reason for the suggestion */
  reason?: string;
  /** Expected improvement from applying suggestion */
  improvement?: string;
}

/**
 * Tokenized query component
 */
export interface QueryToken {
  /** Token type */
  type: 'operator' | 'value' | 'boolean' | 'parenthesis' | 'whitespace' | 'unknown';
  /** Token value */
  value: string;
  /** Position in original query */
  position: QueryPosition;
  /** Parsed operator information (if applicable) */
  operator?: ScryfallOperator;
  /** Whether token is valid */
  valid: boolean;
  /** Associated errors */
  errors?: ValidationError[];
  /** Associated warnings */
  warnings?: ValidationWarning[];
}

/**
 * Comparison operator types supported by Scryfall
 */
export enum ComparisonOperator {
  /** Equal to */
  EQUAL = '=',
  /** Not equal to */
  NOT_EQUAL = '!=',
  /** Less than */
  LESS_THAN = '<',
  /** Less than or equal to */
  LESS_THAN_OR_EQUAL = '<=',
  /** Greater than */
  GREATER_THAN = '>',
  /** Greater than or equal to */
  GREATER_THAN_OR_EQUAL = '>='
}

/**
 * Value type for operator validation
 */
export enum ValueType {
  /** String value */
  STRING = 'string',
  /** Numeric value */
  NUMBER = 'number',
  /** Boolean value */
  BOOLEAN = 'boolean',
  /** Color value (W, U, B, R, G, C) */
  COLOR = 'color',
  /** Mana cost value */
  MANA_COST = 'mana_cost',
  /** Date value */
  DATE = 'date',
  /** Enum value from predefined list */
  ENUM = 'enum',
  /** Regular expression pattern */
  REGEX = 'regex',
  /** Range value (e.g., 1-5) */
  RANGE = 'range'
}

/**
 * Operator category for organization
 */
export enum OperatorCategory {
  /** Basic text and name searches */
  TEXT = 'text',
  /** Card type and subtype searches */
  TYPE = 'type',
  /** Mana cost and color searches */
  MANA = 'mana',
  /** Power, toughness, and CMC searches */
  STATS = 'stats',
  /** Set and rarity searches */
  PRINTING = 'printing',
  /** Format legality searches */
  FORMAT = 'format',
  /** Price and market searches */
  MARKET = 'market',
  /** Advanced metadata searches */
  METADATA = 'metadata',
  /** Special card properties */
  PROPERTIES = 'properties',
  /** Date and time searches */
  TEMPORAL = 'temporal'
}

/**
 * Example usage for an operator
 */
export interface OperatorExample {
  /** Example query */
  query: string;
  /** Description of what the query does */
  description: string;
  /** Expected result count range */
  expectedResults?: {
    min: number;
    max: number;
  };
}

/**
 * Comprehensive Scryfall operator definition
 */
export interface ScryfallOperator {
  /** Primary operator name */
  name: string;
  /** Alternative names/aliases for the operator */
  aliases: string[];
  /** Human-readable description */
  description: string;
  /** Category for organization */
  category: OperatorCategory;
  /** Expected value type */
  valueType: ValueType;
  /** Valid values (for enum types) */
  validValues?: string[];
  /** Whether operator supports comparison operators */
  supportsComparison: boolean;
  /** Supported comparison operators */
  supportedComparisons?: ComparisonOperator[];
  /** Whether operator can be negated */
  supportsNegation: boolean;
  /** Default comparison operator */
  defaultComparison?: ComparisonOperator;
  /** Examples of usage */
  examples: OperatorExample[];
  /** Whether operator is deprecated */
  deprecated?: boolean;
  /** Deprecation message */
  deprecationMessage?: string;
  /** Suggested replacement operator */
  replacement?: string;
  /** Performance impact level */
  performanceImpact?: 'low' | 'medium' | 'high';
  /** Additional validation rules */
  customValidation?: (value: string) => ValidationError | null;
  /** Help text for the operator */
  helpText?: string;
  /** Regular expression for value validation */
  valuePattern?: RegExp;
  /** Whether operator requires exact matching */
  exactMatch?: boolean;
  /** Case sensitivity */
  caseSensitive?: boolean;
}

/**
 * Comprehensive validation result
 */
export interface ValidationResult {
  /** Whether the query is valid */
  valid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
  /** List of validation warnings */
  warnings: ValidationWarning[];
  /** List of improvement suggestions */
  suggestions: QuerySuggestion[];
  /** Tokenized query components */
  tokens?: QueryToken[];
  /** Parsed query structure */
  parsedQuery?: ParsedQuery;
  /** Performance metrics */
  performance?: {
    /** Estimated result count */
    estimatedResults?: number;
    /** Query complexity score */
    complexity: number;
    /** Expected response time */
    expectedResponseTime?: number;
  };
  /** Validation metadata */
  metadata?: {
    /** Validation timestamp */
    timestamp: number;
    /** Validation version */
    version: string;
    /** Processing time in milliseconds */
    processingTime: number;
  };
}

/**
 * Parsed query structure for analysis
 */
export interface ParsedQuery {
  /** Main query components */
  components: QueryComponent[];
  /** Boolean operators used */
  booleanOperators: string[];
  /** Nesting level */
  nestingLevel: number;
  /** Detected operators */
  operators: ScryfallOperator[];
  /** Query complexity metrics */
  complexity: {
    /** Number of operators */
    operatorCount: number;
    /** Boolean complexity */
    booleanComplexity: number;
    /** Nesting complexity */
    nestingComplexity: number;
    /** Overall score */
    overallScore: number;
  };
}

/**
 * Individual query component
 */
export interface QueryComponent {
  /** Component type */
  type: 'operator' | 'boolean' | 'group';
  /** Component value */
  value: string;
  /** Child components (for groups) */
  children?: QueryComponent[];
  /** Associated operator */
  operator?: ScryfallOperator;
  /** Position in query */
  position: QueryPosition;
  /** Whether component is negated */
  negated: boolean;
}

/**
 * Validation context for customized validation
 */
export interface ValidationContext {
  /** Original query string */
  originalQuery: string;
  /** Query format preferences */
  format?: 'standard' | 'modern' | 'legacy' | 'vintage' | 'commander' | 'pioneer';
  /** Validation strictness level */
  strictness?: 'strict' | 'moderate' | 'lenient';
  /** Whether to include performance warnings */
  includePerformanceWarnings?: boolean;
  /** Whether to include suggestions */
  includeSuggestions?: boolean;
  /** Maximum allowed complexity */
  maxComplexity?: number;
  /** Custom operator definitions */
  customOperators?: ScryfallOperator[];
  /** Validation options */
  options?: {
    /** Skip deprecated operator warnings */
    skipDeprecatedWarnings?: boolean;
    /** Maximum suggestion count */
    maxSuggestions?: number;
    /** Enable experimental features */
    enableExperimental?: boolean;
  };
}

/**
 * Validation statistics for monitoring
 */
export interface ValidationStatistics {
  /** Total validations performed */
  totalValidations: number;
  /** Validation success rate */
  successRate: number;
  /** Most common errors */
  commonErrors: Array<{
    type: ValidationErrorType;
    count: number;
    percentage: number;
  }>;
  /** Most used operators */
  popularOperators: Array<{
    operator: string;
    count: number;
    percentage: number;
  }>;
  /** Average query complexity */
  averageComplexity: number;
  /** Performance metrics */
  performance: {
    /** Average validation time */
    averageValidationTime: number;
    /** Peak validation time */
    peakValidationTime: number;
    /** Validation cache hit rate */
    cacheHitRate: number;
  };
}

/**
 * Validation cache entry
 */
export interface ValidationCacheEntry {
  /** Query hash */
  queryHash: string;
  /** Validation result */
  result: ValidationResult;
  /** Cache timestamp */
  timestamp: number;
  /** Cache TTL */
  ttl: number;
  /** Hit count */
  hitCount: number;
}