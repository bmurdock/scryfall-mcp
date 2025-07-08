import { z } from 'zod';
import {
  SearchCardsParamsSchema,
  GetCardParamsSchema,
  GetCardPricesParamsSchema,
  RandomCardParamsSchema,
  SearchSetsParamsSchema,
  ValidationError
} from '../types/mcp-types.js';

/**
 * Validates search cards parameters
 */
export function validateSearchCardsParams(params: unknown) {
  try {
    return SearchCardsParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        `Invalid parameter '${firstError.path.join('.')}': ${firstError.message}`,
        firstError.path.join('.')
      );
    }
    throw error;
  }
}

/**
 * Validates get card parameters
 */
export function validateGetCardParams(params: unknown) {
  try {
    return GetCardParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        `Invalid parameter '${firstError.path.join('.')}': ${firstError.message}`,
        firstError.path.join('.')
      );
    }
    throw error;
  }
}

/**
 * Validates get card prices parameters
 */
export function validateGetCardPricesParams(params: unknown) {
  try {
    return GetCardPricesParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        `Invalid parameter '${firstError.path.join('.')}': ${firstError.message}`,
        firstError.path.join('.')
      );
    }
    throw error;
  }
}

/**
 * Validates random card parameters
 */
export function validateRandomCardParams(params: unknown) {
  try {
    return RandomCardParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        `Invalid parameter '${firstError.path.join('.')}': ${firstError.message}`,
        firstError.path.join('.')
      );
    }
    throw error;
  }
}

/**
 * Validates search sets parameters
 */
export function validateSearchSetsParams(params: unknown) {
  try {
    return SearchSetsParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        `Invalid parameter '${firstError.path.join('.')}': ${firstError.message}`,
        firstError.path.join('.')
      );
    }
    throw error;
  }
}

/**
 * Enhanced Scryfall query validation with intelligent error messages and suggestions
 */
export async function validateScryfallQuery(query: string): Promise<import('../validation/unified-types.js').ValidationResult> {
  const { EnhancedScryfallValidator } = await import('../validation/enhanced-validator.js');
  const validator = new EnhancedScryfallValidator();
  return await validator.validate(query);
}

/**
 * Synchronous Scryfall query validation for backward compatibility
 */
export function validateScryfallQuerySync(query: string): void {
  if (!query || query.trim().length === 0) {
    throw new ValidationError('Search query cannot be empty');
  }

  // Check for basic syntax errors
  const openParens = (query.match(/\(/g) || []).length;
  const closeParens = (query.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    throw new ValidationError('Unmatched parentheses in search query');
  }

  // Check for invalid operators at the start
  if (/^(AND|OR|NOT)\s/i.test(query.trim())) {
    throw new ValidationError('Search query cannot start with a boolean operator');
  }

  // Check for consecutive operators
  if (/\b(AND|OR|NOT)\s+(AND|OR|NOT)\b/i.test(query)) {
    throw new ValidationError('Consecutive boolean operators are not allowed');
  }
}

// Re-export validation types for external use
export type { 
  ValidationResult, 
  ValidationError as EnhancedValidationError, 
  QuerySuggestion,
  ValidationContext 
} from '../validation/unified-types.js';

/**
 * Validates card identifier format
 */
export function validateCardIdentifier(identifier: string): void {
  if (!identifier || identifier.trim().length === 0) {
    throw new ValidationError('Card identifier cannot be empty');
  }

  // Check if it's a UUID (Scryfall ID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    return; // Valid UUID
  }

  // Check if it's a set code + collector number format (e.g., "dom/123")
  const setCollectorRegex = /^[a-z0-9]{3,4}\/\d+[a-z]?$/i;
  if (setCollectorRegex.test(identifier)) {
    return; // Valid set/collector format
  }

  // Otherwise, assume it's a card name - validate basic constraints
  if (identifier.length > 200) {
    throw new ValidationError('Card name is too long (max 200 characters)');
  }

  // Check for potentially problematic characters
  if (/[<>{}[\]\\]/.test(identifier)) {
    throw new ValidationError('Card name contains invalid characters');
  }
}

/**
 * Validates set code format
 */
export function validateSetCode(setCode: string): void {
  if (!/^[a-z0-9]{3,4}$/i.test(setCode)) {
    throw new ValidationError('Set code must be 3-4 alphanumeric characters');
  }
}

/**
 * Validates language code format
 */
export function validateLanguageCode(langCode: string): void {
  const validLanguages = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht', 'he', 'la', 'grc', 'ar', 'sa', 'ph'
  ];
  
  if (!validLanguages.includes(langCode.toLowerCase())) {
    throw new ValidationError(`Invalid language code. Supported languages: ${validLanguages.join(', ')}`);
  }
}

/**
 * Validates date string format (ISO 8601)
 */
export function validateDateString(dateStr: string): void {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format. Use ISO 8601 format (YYYY-MM-DD)');
  }
  
  // Check if the date is reasonable (not too far in the past or future)
  const now = new Date();
  const minDate = new Date('1993-01-01'); // Magic's first release
  const maxDate = new Date(now.getFullYear() + 5, 11, 31); // 5 years in the future
  
  if (date < minDate || date > maxDate) {
    throw new ValidationError('Date must be between 1993 and 5 years from now');
  }
}
