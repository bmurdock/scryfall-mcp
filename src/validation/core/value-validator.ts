import { 
  Token, 
  TokenType, 
  OperatorToken, 
  ValidationResult,
  QueryValidationError,
  OperatorRegistry,
  OperatorDefinition,
  OperatorValueType,
  ComparisonOperator 
} from '../types.js';
import { operatorRegistry } from '../operator-registry.js';

/**
 * Validates operator values with type-specific validation logic
 */
export class ValueValidator {
  private tokens: Token[];
  private registry: OperatorRegistry;
  private errors: QueryValidationError[] = [];
  private warnings: string[] = [];

  constructor(tokens: Token[], registry: OperatorRegistry = operatorRegistry) {
    this.tokens = tokens;
    this.registry = registry;
  }

  /**
   * Perform comprehensive value validation
   */
  validate(): ValidationResult {
    this.errors = [];
    this.warnings = [];

    // Filter to only operator tokens
    const operatorTokens = this.tokens.filter(t => t.type === TokenType.OPERATOR) as OperatorToken[];

    for (const operatorToken of operatorTokens) {
      this.validateOperatorValue(operatorToken);
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      tokens: this.tokens
    };
  }

  /**
   * Validate a single operator's value
   */
  private validateOperatorValue(operatorToken: OperatorToken): void {
    const { operator, operatorValue, comparison } = operatorToken;
    
    const operatorDef = this.registry.getOperator(operator);
    if (!operatorDef) {
      // Operator validation should be handled by OperatorValidator
      return;
    }

    // Skip if value is empty (handled by OperatorValidator)
    if (operatorValue === '') {
      return;
    }

    // Type-specific validation
    switch (operatorDef.valueType) {
      case OperatorValueType.STRING:
        this.validateStringValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.NUMBER:
        this.validateNumberValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.COLOR:
        this.validateColorValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.ENUM:
        this.validateEnumValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.BOOLEAN:
        this.validateBooleanValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.DATE:
        this.validateDateValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.SET_CODE:
        this.validateSetCodeValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.RARITY:
        this.validateRarityValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.FORMAT:
        this.validateFormatValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.LOYALTY:
        this.validateLoyaltyValue(operatorToken, operatorDef);
        break;
      case OperatorValueType.POWER_TOUGHNESS:
        this.validatePowerToughnessValue(operatorToken, operatorDef);
        break;
      default:
        this.warnings.push(`Unknown value type for operator '${operator}'`);
    }

    // Validate comparison operator usage
    if (comparison) {
      this.validateComparisonUsage(operatorToken, operatorDef);
    }
  }

  /**
   * Validate string values
   */
  private validateStringValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const value = token.operatorValue;
    
    // Check for reasonable length
    if (value.length > 500) {
      this.addWarning(token, `Very long search term may not return expected results`);
    }
    
    // Check for empty quotes
    if (value === '""' || value === "''") {
      this.addError(token, new QueryValidationError(
        `Empty quoted string is not allowed`,
        token.position,
        token.length,
        'EMPTY_QUOTED_STRING'
      ));
    }
    
    // Check for potentially problematic regex characters in text searches
    if (operatorDef.name === 'oracle' || operatorDef.name === 'name' || operatorDef.name === 'flavor') {
      this.validateTextSearchValue(token, value);
    }
  }

  /**
   * Validate text search values for potential issues
   */
  private validateTextSearchValue(token: OperatorToken, value: string): void {
    // Check for regex metacharacters that might cause issues
    const regexChars = /[.*+?^${}()|[\]\\]/g;
    if (regexChars.test(value)) {
      this.addWarning(token, `Text contains special characters that may affect search results. Consider using quotes for exact matches`);
    }
    
    // Check for very short search terms
    if (value.length < 2 && !value.match(/^[a-z]$/i)) {
      this.addWarning(token, `Very short search terms may return too many results`);
    }
  }

  /**
   * Validate numeric values
   */
  private validateNumberValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const value = token.operatorValue;
    
    // Allow special values
    if (value === '*' || value === 'X') {
      return;
    }
    
    // Check if it's a valid number
    const num = Number(value);
    if (isNaN(num)) {
      this.addError(token, new QueryValidationError(
        `Invalid numeric value '${value}' for operator '${operatorDef.name}'`,
        token.position,
        token.length,
        'INVALID_NUMBER'
      ));
      return;
    }
    
    // Validate reasonable ranges based on operator
    this.validateNumberRange(token, operatorDef, num);
  }

  /**
   * Validate numeric ranges for different operators
   */
  private validateNumberRange(token: OperatorToken, operatorDef: OperatorDefinition, num: number): void {
    const { name } = operatorDef;
    
    switch (name) {
      case 'cmc':
      case 'manavalue':
      case 'mv':
        if (num < 0) {
          this.addError(token, new QueryValidationError(
            `Mana value cannot be negative`,
            token.position,
            token.length,
            'NEGATIVE_MANA_VALUE'
          ));
        } else if (num > 16) {
          this.addWarning(token, `Very high mana value (${num}) may not return many results`);
        }
        break;
        
      case 'power':
      case 'toughness':
        if (num < -10) {
          this.addWarning(token, `Very low ${name} value (${num}) is uncommon`);
        } else if (num > 20) {
          this.addWarning(token, `Very high ${name} value (${num}) is uncommon`);
        }
        break;
        
      case 'loyalty':
        if (num < 0) {
          this.addError(token, new QueryValidationError(
            `Loyalty cannot be negative`,
            token.position,
            token.length,
            'NEGATIVE_LOYALTY'
          ));
        } else if (num > 10) {
          this.addWarning(token, `Very high loyalty value (${num}) is uncommon`);
        }
        break;
        
      case 'year':
        const currentYear = new Date().getFullYear();
        if (num < 1993) {
          this.addWarning(token, `Year ${num} is before Magic's first release (1993)`);
        } else if (num > currentYear + 2) {
          this.addWarning(token, `Year ${num} is far in the future`);
        }
        break;
    }
  }

  /**
   * Validate color values
   */
  private validateColorValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const value = token.operatorValue.toLowerCase();
    
    // Special color values
    if (value === 'colorless' || value === 'c' || value === 'multicolored' || value === 'm') {
      return;
    }
    
    // Handle full color names
    const colorNames = ['white', 'blue', 'black', 'red', 'green'];
    if (colorNames.includes(value)) {
      return;
    }
    
    // Validate individual color letters
    const validColors = ['w', 'u', 'b', 'r', 'g'];
    for (const char of value) {
      if (!validColors.includes(char)) {
        this.addError(token, new QueryValidationError(
          `Invalid color value '${token.operatorValue}'. Use color letters (w, u, b, r, g) or full color names (white, blue, black, red, green)`,
          token.position,
          token.length,
          'INVALID_COLOR'
        ));
        return;
      }
    }
    
    // Check for duplicate colors
    const uniqueColors = new Set(value);
    if (uniqueColors.size !== value.length) {
      this.addWarning(token, `Duplicate colors in '${value}'`);
    }
    
    // Validate comparison operators for colors
    if (token.comparison) {
      this.validateColorComparison(token, value);
    }
  }

  /**
   * Validate color comparison operators
   */
  private validateColorComparison(token: OperatorToken, value: string): void {
    const comparison = token.comparison!;
    
    // Some comparisons don't make sense for single colors
    if (value.length === 1) {
      if (comparison === ComparisonOperator.GREATER_THAN || 
          comparison === ComparisonOperator.GREATER_THAN_OR_EQUAL) {
        this.addWarning(token, `Color comparison '${comparison}' with single color may not work as expected`);
      }
    }
  }

  /**
   * Validate enum values
   */
  private validateEnumValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const value = token.operatorValue.toLowerCase();
    
    if (!operatorDef.validValues) {
      return;
    }
    
    if (!operatorDef.validValues.includes(value)) {
      // Try to find close matches
      const suggestions = this.findClosestEnumValues(value, operatorDef.validValues);
      
      let message = `Invalid value '${token.operatorValue}' for operator '${operatorDef.name}'. Valid values: ${operatorDef.validValues.join(', ')}`;
      if (suggestions.length > 0) {
        message += `. Did you mean: ${suggestions.join(', ')}?`;
      }
      
      this.addError(token, new QueryValidationError(
        message,
        token.position,
        token.length,
        'INVALID_ENUM_VALUE'
      ));
    }
  }

  /**
   * Find closest enum values for suggestions
   */
  private findClosestEnumValues(value: string, validValues: string[]): string[] {
    const suggestions: Array<{ value: string; distance: number }> = [];
    
    for (const validValue of validValues) {
      const distance = this.levenshteinDistance(value, validValue);
      if (distance <= 2) {
        suggestions.push({ value: validValue, distance });
      }
    }
    
    return suggestions
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2)
      .map(s => s.value);
  }

  /**
   * Validate boolean values
   */
  private validateBooleanValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const value = token.operatorValue.toLowerCase();
    
    if (!['true', 'false', '1', '0', 'yes', 'no'].includes(value)) {
      this.addError(token, new QueryValidationError(
        `Invalid boolean value '${token.operatorValue}'. Use: true, false, 1, 0, yes, or no`,
        token.position,
        token.length,
        'INVALID_BOOLEAN'
      ));
    }
  }

  /**
   * Validate date values
   */
  private validateDateValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const value = token.operatorValue;
    
    // Try to parse as date
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      this.addError(token, new QueryValidationError(
        `Invalid date format '${value}'. Use ISO format (YYYY-MM-DD) or relative terms like 'today', 'yesterday'`,
        token.position,
        token.length,
        'INVALID_DATE'
      ));
      return;
    }
    
    // Check if date is reasonable
    const now = new Date();
    const minDate = new Date('1993-01-01');
    const maxDate = new Date(now.getFullYear() + 5, 11, 31);
    
    if (date < minDate) {
      this.addWarning(token, `Date ${value} is before Magic's first release (1993)`);
    } else if (date > maxDate) {
      this.addWarning(token, `Date ${value} is far in the future`);
    }
  }

  /**
   * Validate set code values
   */
  private validateSetCodeValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const value = token.operatorValue;
    
    if (!/^[a-z0-9]{3,4}$/i.test(value)) {
      this.addError(token, new QueryValidationError(
        `Invalid set code '${value}'. Set codes must be 3-4 alphanumeric characters`,
        token.position,
        token.length,
        'INVALID_SET_CODE'
      ));
    }
  }

  /**
   * Validate rarity values
   */
  private validateRarityValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    this.validateEnumValue(token, operatorDef);
  }

  /**
   * Validate format values
   */
  private validateFormatValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    this.validateEnumValue(token, operatorDef);
  }

  /**
   * Validate loyalty values
   */
  private validateLoyaltyValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    this.validateNumberValue(token, operatorDef);
  }

  /**
   * Validate power/toughness values
   */
  private validatePowerToughnessValue(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const value = token.operatorValue;
    
    // Allow special values
    if (value === '*' || value === 'X') {
      return;
    }
    
    // Allow signed numbers
    if (!/^[+-]?\d+$/.test(value)) {
      this.addError(token, new QueryValidationError(
        `Invalid power/toughness value '${value}'. Must be a number, *, or X`,
        token.position,
        token.length,
        'INVALID_POWER_TOUGHNESS'
      ));
      return;
    }
    
    // Validate as number for range checking
    const num = Number(value);
    this.validateNumberRange(token, operatorDef, num);
  }

  /**
   * Validate comparison operator usage
   */
  private validateComparisonUsage(token: OperatorToken, operatorDef: OperatorDefinition): void {
    const { comparison, operatorValue } = token;
    
    // Check if comparison makes sense for the value type
    if (operatorDef.valueType === OperatorValueType.STRING && 
        comparison !== ComparisonOperator.EQUALS && 
        comparison !== ComparisonOperator.NOT_EQUALS) {
      this.addWarning(token, `Comparison operator '${comparison}' may not work as expected with text values`);
    }
    
    // Check for potentially meaningless comparisons
    if (operatorValue === '*' || operatorValue === 'X') {
      if (comparison !== ComparisonOperator.EQUALS && comparison !== ComparisonOperator.NOT_EQUALS) {
        this.addWarning(token, `Comparison operator '${comparison}' may not work as expected with special value '${operatorValue}'`);
      }
    }
  }

  /**
   * Add an error to the validation result
   */
  private addError(token: OperatorToken, error: QueryValidationError): void {
    this.errors.push(error);
  }

  /**
   * Add a warning to the validation result
   */
  private addWarning(token: OperatorToken, message: string): void {
    this.warnings.push(message);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Static method to quickly validate values
   */
  static validate(tokens: Token[], registry?: OperatorRegistry): ValidationResult {
    const validator = new ValueValidator(tokens, registry);
    return validator.validate();
  }
}