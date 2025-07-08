/**
 * @fileoverview Unified validation types that consolidate both validation systems
 * 
 * This module provides a single, consistent set of types for the Enhanced Query Validation system
 */

// Enhanced validation result with additional metadata
export interface ValidationResult {
  /** Whether the query is valid */
  isValid: boolean;
  /** Array of validation errors */
  errors: ValidationError[];
  /** Array of validation warnings */
  warnings: ValidationWarning[];
  /** Helpful suggestions for improving the query */
  suggestions: QuerySuggestion[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Query complexity score */
  queryComplexity: number;
  /** Time taken for validation (ms) */
  validationTime: number;
  /** Parsed tokens (optional) */
  tokens?: QueryToken[];
}

// Unified validation error type
export interface ValidationError {
  /** Error type/category */
  type: string;
  /** Human-readable error message */
  message: string;
  /** Error severity */
  severity: 'error' | 'warning' | 'info';
  /** Position information */
  position?: {
    line: number;
    column: number;
    offset: number;
    start?: number;
    end?: number;
  };
  /** Suggested fix */
  suggestion?: string;
  /** Expected value */
  expected?: string;
  /** Actual value that caused error */
  actual?: string;
  /** Related operator */
  operator?: string;
  /** Error code for programmatic handling */
  code?: string;
}

// Unified validation warning type
export interface ValidationWarning {
  /** Warning type/category */
  type: string;
  /** Human-readable warning message */
  message: string;
  /** Warning severity */
  severity: 'warning' | 'info';
  /** Position information */
  position?: {
    line: number;
    column: number;
    offset: number;
  };
  /** Suggested improvement */
  suggestion?: string;
  /** Related operator */
  operator?: string;
}

// Unified suggestion type
export interface QuerySuggestion {
  /** Suggestion type */
  type: string;
  /** Description of what the suggestion does */
  description: string;
  /** The suggested query replacement */
  suggestedQuery?: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Expected impact of applying the suggestion */
  impact?: string;
  /** Original problematic text */
  original?: string;
  /** Suggested replacement text */
  replacement?: string;
  /** Reason for the suggestion */
  reason?: string;
}

// Unified token type
export interface QueryToken {
  /** Token type */
  type: string;
  /** Token value */
  value: string;
  /** Position in query */
  position: number;
  /** Token length */
  length: number;
  /** For operator tokens */
  operator?: string;
  /** For operator tokens */
  operatorValue?: string;
  /** Comparison operator if present */
  comparison?: string;
}

// Validation context for enhanced analysis
export interface ValidationContext {
  /** Previous search result count for refinement suggestions */
  previousResultCount?: number;
  /** User's stated intent */
  userIntent?: string;
  /** Target format for validation */
  format?: string;
  /** Include performance analysis */
  includePerformanceAnalysis?: boolean;
}

// Operator definition type
export interface OperatorDefinition {
  /** Operator name */
  name: string;
  /** Alternative names/aliases */
  aliases: string[];
  /** Description of what the operator does */
  description: string;
  /** Type of values this operator accepts */
  valueType: string;
  /** Valid values (for enum types) */
  validValues?: string[];
  /** Whether comparison operators are supported */
  allowsComparison: boolean;
  /** Usage examples */
  examples: string[];
  /** Operator category */
  category: string;
}

// Tokenization result
export interface TokenizationResult {
  /** Parsed tokens */
  tokens: QueryToken[];
  /** Tokenization errors */
  errors: ValidationError[];
}

// Basic validation result for backward compatibility
export interface BasicValidationResult {
  /** Whether query is valid */
  isValid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: string[];
  /** Token array */
  tokens?: QueryToken[];
  /** Simple suggestions */
  suggestions?: string[];
}

// Query validation error class (for backward compatibility)
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

// Operator registry interface
export interface OperatorRegistry {
  getOperator(name: string): OperatorDefinition | undefined;
  getAllOperators(): OperatorDefinition[];
  hasOperator(name: string): boolean;
  validateOperatorValue(operator: string, value: string, comparison?: string): ValidationResult;
}

// Re-export for external use
export { ValidationError as MCPValidationError } from '../types/mcp-types.js';