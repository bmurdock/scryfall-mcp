/**
 * @fileoverview Simplified suggestion engine for query validation
 * 
 * This module provides basic suggestions for query improvements and corrections.
 */

import { ValidationError, QuerySuggestion } from '../unified-types.js';
import { QueryValidationError } from '../types.js';

/**
 * Main suggestion engine class
 */
export class SuggestionEngine {
  /**
   * Generates suggestions based on validation errors
   */
  static generateSuggestions(
    errors: (ValidationError | QueryValidationError)[], 
    originalQuery: string
  ): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];

    for (const error of errors) {
      if (error instanceof QueryValidationError) {
        suggestions.push(...this.generateSuggestionsFromQueryError(error, originalQuery));
      } else {
        suggestions.push(...this.generateSuggestionsFromValidationError(error, originalQuery));
      }
    }

    return suggestions;
  }

  /**
   * Generate suggestions from QueryValidationError
   */
  private static generateSuggestionsFromQueryError(
    error: QueryValidationError, 
    originalQuery: string
  ): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];

    switch (error.code) {
      case 'UNKNOWN_OPERATOR':
        suggestions.push({
          type: 'replacement',
          description: 'Check operator spelling',
          suggestedQuery: originalQuery,
          confidence: 'medium',
          impact: 'May fix unknown operator error'
        });
        break;

      case 'UNMATCHED_OPENING_PAREN':
        suggestions.push({
          type: 'addition',
          description: 'Add missing closing parenthesis',
          suggestedQuery: originalQuery + ')',
          confidence: 'high',
          impact: 'Fixes parentheses matching'
        });
        break;

      case 'UNMATCHED_CLOSING_PAREN':
        suggestions.push({
          type: 'removal',
          description: 'Remove extra closing parenthesis',
          suggestedQuery: originalQuery.replace(/\)$/, ''),
          confidence: 'high',
          impact: 'Fixes parentheses matching'
        });
        break;
    }

    return suggestions;
  }

  /**
   * Generate suggestions from ValidationError
   */
  private static generateSuggestionsFromValidationError(
    error: ValidationError, 
    originalQuery: string
  ): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];

    if (error.type === 'INVALID_OPERATOR' && error.actual) {
      suggestions.push({
        type: 'replacement',
        description: `Check spelling of operator '${error.actual}'`,
        suggestedQuery: originalQuery,
        confidence: 'medium',
        impact: 'May fix operator error'
      });
    }

    return suggestions;
  }

  /**
   * Generate query refinement suggestions
   */
  static generateRefinementSuggestions(query: string, resultCount?: number): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];

    // If no results, suggest broadening the query
    if (resultCount === 0) {
      suggestions.push({
        type: 'query_refinement',
        description: 'Try removing some constraints to broaden your search',
        suggestedQuery: this.broadenQuery(query),
        confidence: 'medium',
        impact: 'May increase result count'
      });
    }

    // If too many results, suggest narrowing
    if (resultCount && resultCount > 100) {
      suggestions.push({
        type: 'query_refinement',
        description: 'Try adding more constraints to narrow your search',
        suggestedQuery: this.narrowQuery(query),
        confidence: 'medium',
        impact: 'May reduce result count'
      });
    }

    return suggestions;
  }

  /**
   * Broaden a query by removing some constraints
   */
  private static broadenQuery(query: string): string {
    let broadened = query;
    
    // Remove specific set constraints
    broadened = broadened.replace(/\s*set:\w+/gi, '');
    
    // Remove specific CMC constraints
    broadened = broadened.replace(/\s*(?:cmc|mv):[><=]+?\d+/gi, '');
    
    // Remove format constraints
    broadened = broadened.replace(/\s*f(?:ormat)?:\w+/gi, '');
    
    return broadened.trim() || query; // Return original if everything was removed
  }

  /**
   * Narrow a query by adding common constraints
   */
  private static narrowQuery(query: string): string {
    // Add format constraint if none exists
    if (!query.match(/f(?:ormat)?:/i)) {
      return `${query} f:standard`;
    }
    
    // Add CMC constraint if none exists
    if (!query.match(/(?:cmc|mv):/i)) {
      return `${query} cmc<=6`;
    }
    
    return query;
  }
}