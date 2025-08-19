import { z } from "zod";
import {
  SearchCardsParamsSchema,
  GetCardParamsSchema,
  GetCardPricesParamsSchema,
  RandomCardParamsSchema,
  SearchSetsParamsSchema,
  BuildQueryParamsSchema,
  ValidationError,
} from "../types/mcp-types.js";

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
        `Invalid parameter '${firstError.path.join(".")}': ${firstError.message}`,
        firstError.path.join(".")
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
        `Invalid parameter '${firstError.path.join(".")}': ${firstError.message}`,
        firstError.path.join(".")
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
        `Invalid parameter '${firstError.path.join(".")}': ${firstError.message}`,
        firstError.path.join(".")
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
        `Invalid parameter '${firstError.path.join(".")}': ${firstError.message}`,
        firstError.path.join(".")
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
        `Invalid parameter '${firstError.path.join(".")}': ${firstError.message}`,
        firstError.path.join(".")
      );
    }
    throw error;
  }
}

/**
 * Validates build query parameters
 */
export function validateBuildQueryParams(params: unknown) {
  try {
    return BuildQueryParamsSchema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      const fieldPath = firstError.path.join(".");

      // Provide helpful error messages for common issues
      let message = `Invalid parameter '${fieldPath}': ${firstError.message}`;

      if (fieldPath === "natural_query" && firstError.code === "too_small") {
        message =
          "Natural query cannot be empty. Please provide a description of what you want to find.";
      } else if (fieldPath === "natural_query" && firstError.code === "too_big") {
        message = "Natural query is too long. Please keep it under 500 characters.";
      } else if (fieldPath === "format" && firstError.code === "invalid_enum_value") {
        message = `Invalid format. Valid formats are: standard, modern, legacy, vintage, commander, pioneer, brawl, pauper, penny, historic, alchemy.`;
      } else if (fieldPath === "optimize_for" && firstError.code === "invalid_enum_value") {
        message = `Invalid optimization strategy. Valid options are: precision, recall, discovery, budget.`;
      } else if (fieldPath === "max_results") {
        message = "Max results must be between 1 and 175.";
      }

      throw new ValidationError(message, fieldPath);
    }
    throw error;
  }
}

/**
 * Result interface for query validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ message: string; position?: number }>;
  warnings: Array<{ message: string; position?: number }>;
  suggestions?: string[];
}

/**
 * Enhanced Scryfall query validation with detailed feedback
 */
export function validateScryfallQuery(query: string): Promise<ValidationResult> {
  return Promise.resolve(validateScryfallQuerySync(query));
}

/**
 * Synchronous Scryfall query validation with comprehensive checks
 */
export function validateScryfallQuerySync(query: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  if (!query || query.trim().length === 0) {
    result.isValid = false;
    result.errors.push({ message: "Search query cannot be empty" });
    return result;
  }

  const trimmedQuery = query.trim();

  // Check for basic syntax errors
  const openParens = (trimmedQuery.match(/\(/g) || []).length;
  const closeParens = (trimmedQuery.match(/\)/g) || []).length;

  if (openParens !== closeParens) {
    result.isValid = false;
    result.errors.push({ message: "Unmatched parentheses in search query" });
  }

  // Check for invalid operators at the start
  if (/^(AND|OR|NOT)\s/i.test(trimmedQuery)) {
    result.isValid = false;
    result.errors.push({ message: "Search query cannot start with a boolean operator" });
  }

  // Check for consecutive operators
  if (/\b(AND|OR|NOT)\s+(AND|OR|NOT)\b/i.test(trimmedQuery)) {
    result.isValid = false;
    result.errors.push({ message: "Consecutive boolean operators are not allowed" });
  }

  // Check for common issues and provide warnings
  if (/[<>]=?/.test(trimmedQuery) && !/\b(cmc|pow|tou|loy)\b/.test(trimmedQuery)) {
    result.warnings.push({ 
      message: "Comparison operators should typically be used with numeric fields like cmc, pow, tou, or loy" 
    });
  }

  // Check for potentially misspelled operators
  if (/\bcolou?r\b/i.test(trimmedQuery)) {
    result.warnings.push({ 
      message: "Use 'c:' or 'color:' instead of 'color' for color searches" 
    });
    result.suggestions?.push("Try 'c:red' instead of 'color red'");
  }

  // Check for excessive complexity
  const operatorCount = (trimmedQuery.match(/\b(AND|OR|NOT)\b/gi) || []).length;
  if (operatorCount > 10) {
    result.warnings.push({ 
      message: "Query is very complex and may be slow to execute" 
    });
  }

  // Add helpful suggestions for common patterns
  if (result.errors.length === 0 && trimmedQuery.split(/\s+/).length > 5 && !/[:()"']/.test(trimmedQuery)) {
    result.suggestions?.push("Consider using operators like 'c:', 't:', or 'o:' for more precise searches");
  }

  return result;
}

// ValidationResult type is already exported above

/**
 * Validates card identifier format
 */
export function validateCardIdentifier(identifier: string): void {
  if (!identifier || identifier.trim().length === 0) {
    throw new ValidationError("Card identifier cannot be empty");
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
    throw new ValidationError("Card name is too long (max 200 characters)");
  }

  // Check for potentially problematic characters
  if (/[<>{}[\]\\]/.test(identifier)) {
    throw new ValidationError("Card name contains invalid characters");
  }
}

/**
 * Validates set code format
 */
export function validateSetCode(setCode: string): void {
  if (!/^[a-z0-9]{3,4}$/i.test(setCode)) {
    throw new ValidationError("Set code must be 3-4 alphanumeric characters");
  }
}

/**
 * Validates language code format
 */
export function validateLanguageCode(langCode: string): void {
  const validLanguages = [
    "en",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "ja",
    "ko",
    "ru",
    "zhs",
    "zht",
    "he",
    "la",
    "grc",
    "ar",
    "sa",
    "ph",
  ];

  if (!validLanguages.includes(langCode.toLowerCase())) {
    throw new ValidationError(
      `Invalid language code. Supported languages: ${validLanguages.join(", ")}`
    );
  }
}

/**
 * Validates date string format (ISO 8601)
 */
export function validateDateString(dateStr: string): void {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new ValidationError("Invalid date format. Use ISO 8601 format (YYYY-MM-DD)");
  }

  // Check if the date is reasonable (not too far in the past or future)
  const now = new Date();
  const minDate = new Date("1993-01-01"); // Magic's first release
  const maxDate = new Date(now.getFullYear() + 5, 11, 31); // 5 years in the future

  if (date < minDate || date > maxDate) {
    throw new ValidationError("Date must be between 1993 and 5 years from now");
  }
}
