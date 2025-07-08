/**
 * Enhanced Query Validation System
 * 
 * This module provides comprehensive validation for Scryfall search queries,
 * including tokenization, syntax validation, operator validation, and value validation.
 */

// Core validation components
export { QueryTokenizer } from './core/query-tokenizer.js';
export { SyntaxValidator } from './core/syntax-validator.js';
export { OperatorValidator } from './core/operator-validator.js';
export { ValueValidator } from './core/value-validator.js';

// Operator registry
export { DefaultOperatorRegistry, operatorRegistry } from './operator-registry.js';

// Types and interfaces
export * from './types.js';

// Convenience function for complete validation
import { QueryTokenizer } from './core/query-tokenizer.js';
import { SyntaxValidator } from './core/syntax-validator.js';
import { OperatorValidator } from './core/operator-validator.js';
import { ValueValidator } from './core/value-validator.js';
import { ValidationResult, QueryValidationError } from './types.js';

/**
 * Perform complete validation of a Scryfall query
 * 
 * @param query - The query string to validate
 * @returns Comprehensive validation result with errors, warnings, and suggestions
 */
export function validateQuery(query: string): ValidationResult {
  const errors: QueryValidationError[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Step 1: Tokenize the query
  const tokenizationResult = QueryTokenizer.tokenize(query);
  errors.push(...tokenizationResult.errors);
  
  if (tokenizationResult.errors.length > 0) {
    // If tokenization fails, we can't continue with other validations
    return {
      isValid: false,
      errors,
      warnings,
      tokens: tokenizationResult.tokens,
      suggestions
    };
  }

  const tokens = tokenizationResult.tokens;

  // Step 2: Validate syntax
  const syntaxResult = SyntaxValidator.validate(tokens);
  errors.push(...syntaxResult.errors);
  warnings.push(...syntaxResult.warnings);

  // Step 3: Validate operators
  const operatorResult = OperatorValidator.validate(tokens);
  errors.push(...operatorResult.errors);
  warnings.push(...operatorResult.warnings);

  // Step 4: Validate values
  const valueResult = ValueValidator.validate(tokens);
  errors.push(...valueResult.errors);
  warnings.push(...valueResult.warnings);

  // Generate suggestions based on errors
  if (errors.length > 0) {
    suggestions.push(...generateSuggestions(errors));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    tokens,
    suggestions
  };
}

/**
 * Generate helpful suggestions based on validation errors
 */
function generateSuggestions(errors: QueryValidationError[]): string[] {
  const suggestions: string[] = [];
  
  for (const error of errors) {
    switch (error.code) {
      case 'UNMATCHED_CLOSING_PAREN':
        suggestions.push('Check parentheses matching - you may have an extra closing parenthesis');
        break;
      case 'UNMATCHED_OPENING_PAREN':
        suggestions.push('Check parentheses matching - you may be missing a closing parenthesis');
        break;
      case 'BOOLEAN_AT_START':
        suggestions.push('Boolean operators (AND, OR) cannot start a query - add a search term first');
        break;
      case 'BOOLEAN_AT_END':
        suggestions.push('Boolean operators cannot end a query - add a search term after');
        break;
      case 'CONSECUTIVE_BOOLEAN':
        suggestions.push('Use parentheses to group boolean expressions properly');
        break;
      case 'UNKNOWN_OPERATOR':
        suggestions.push('Check operator spelling - use the format "operator:value"');
        break;
      case 'COMPARISON_NOT_SUPPORTED':
        suggestions.push('This operator does not support comparison operators like >=, <=, etc.');
        break;
      case 'INVALID_ENUM_VALUE':
        suggestions.push('Check the valid values for this operator');
        break;
      case 'INVALID_COLOR':
        suggestions.push('Use color letters: w (white), u (blue), b (black), r (red), g (green)');
        break;
      case 'INVALID_SET_CODE':
        suggestions.push('Set codes should be 3-4 characters (e.g., "dom", "war", "thb")');
        break;
      case 'UNCLOSED_QUOTE':
        suggestions.push('Make sure to close quoted strings with matching quotes');
        break;
      case 'EMPTY_QUERY':
        suggestions.push('Enter a search term or operator to search for cards');
        break;
      default:
        // No specific suggestion for this error type
        break;
    }
  }
  
  return [...new Set(suggestions)]; // Remove duplicates
}