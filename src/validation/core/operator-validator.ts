import { 
  Token, 
  TokenType, 
  OperatorToken, 
  ValidationResult,
  QueryValidationError,
  OperatorRegistry,
  OperatorDefinition 
} from '../types.js';
import { operatorRegistry } from '../operator-registry.js';

/**
 * Validates Scryfall search operators and their usage
 */
export class OperatorValidator {
  private tokens: Token[];
  private registry: OperatorRegistry;
  private errors: QueryValidationError[] = [];
  private warnings: string[] = [];

  constructor(tokens: Token[], registry: OperatorRegistry = operatorRegistry) {
    this.tokens = tokens;
    this.registry = registry;
  }

  /**
   * Perform comprehensive operator validation
   */
  validate(): ValidationResult {
    this.errors = [];
    this.warnings = [];

    // Filter to only operator tokens
    const operatorTokens = this.tokens.filter(t => t.type === TokenType.OPERATOR) as OperatorToken[];

    for (const operatorToken of operatorTokens) {
      this.validateOperator(operatorToken);
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      tokens: this.tokens
    };
  }

  /**
   * Validate a single operator token
   */
  private validateOperator(operatorToken: OperatorToken): void {
    const { operator, comparison, operatorValue } = operatorToken;

    // Check if operator exists in registry
    const operatorDef = this.registry.getOperator(operator);
    if (!operatorDef) {
      this.addOperatorError(operatorToken, this.createUnknownOperatorError(operator, operatorToken));
      return;
    }

    // Validate comparison operator usage
    if (comparison && !operatorDef.allowsComparison) {
      this.addOperatorError(operatorToken, new QueryValidationError(
        `Operator '${operator}' does not support comparison operators like '${comparison}'`,
        operatorToken.position,
        operatorToken.length,
        'COMPARISON_NOT_SUPPORTED'
      ));
      return;
    }

    // Validate operator value
    if (operatorValue === '') {
      this.addOperatorError(operatorToken, new QueryValidationError(
        `Operator '${operator}' requires a value`,
        operatorToken.position,
        operatorToken.length,
        'MISSING_OPERATOR_VALUE'
      ));
      return;
    }

    // Use registry to validate the value (but don't duplicate errors that ValueValidator will catch)
    const valueValidation = this.registry.validateOperatorValue(operator, operatorValue, comparison);
    
    // Only add errors that are specific to operator validation, not value validation
    for (const error of valueValidation.errors) {
      if (error.code === 'COMPARISON_NOT_ALLOWED') {
        error.position = operatorToken.position;
        error.length = operatorToken.length;
        this.errors.push(error);
      }
    }

    // Add warnings from value validation
    this.warnings.push(...valueValidation.warnings);

    // Additional context-specific validations
    this.validateOperatorContext(operatorToken, operatorDef);
  }

  /**
   * Validate operator in context (e.g., combinations that don't make sense)
   */
  private validateOperatorContext(operatorToken: OperatorToken, operatorDef: OperatorDefinition): void {
    // Check for potentially conflicting operators
    this.checkForConflictingOperators(operatorToken, operatorDef);
    
    // Check for redundant operators
    this.checkForRedundantOperators(operatorToken, operatorDef);
    
    // Check for suspicious combinations
    this.checkForSuspiciousCombinations(operatorToken, operatorDef);
  }

  /**
   * Check for operators that conflict with each other
   */
  private checkForConflictingOperators(operatorToken: OperatorToken, operatorDef: OperatorDefinition): void {
    const operatorTokens = this.tokens.filter(t => t.type === TokenType.OPERATOR) as OperatorToken[];
    
    for (const otherToken of operatorTokens) {
      if (otherToken === operatorToken) continue;
      
      const otherDef = this.registry.getOperator(otherToken.operator);
      if (!otherDef) continue;

      // Check for conflicting color operators
      if (operatorDef.name === 'color' && otherDef.name === 'color') {
        this.checkColorConflicts(operatorToken, otherToken);
      }
      
      // Check for conflicting format operators
      if (operatorDef.name === 'format' && otherDef.name === 'format') {
        this.warnings.push(`Multiple format restrictions may be too restrictive: '${operatorToken.operator}:${operatorToken.operatorValue}' and '${otherToken.operator}:${otherToken.operatorValue}'`);
      }
    }
  }

  /**
   * Check for color operator conflicts
   */
  private checkColorConflicts(token1: OperatorToken, token2: OperatorToken): void {
    const value1 = token1.operatorValue.toLowerCase();
    const value2 = token2.operatorValue.toLowerCase();
    
    // Check for colorless conflicts
    if ((value1 === 'colorless' || value1 === 'c') && 
        (value2 !== 'colorless' && value2 !== 'c')) {
      this.warnings.push(`Conflicting color requirements: colorless and ${value2}`);
    }
    
    // Check for exact color matches that might be redundant
    if (value1 === value2 && token1.comparison === token2.comparison) {
      this.warnings.push(`Duplicate color restriction: ${token1.operator}:${token1.operatorValue}`);
    }
  }

  /**
   * Check for redundant operators
   */
  private checkForRedundantOperators(operatorToken: OperatorToken, operatorDef: OperatorDefinition): void {
    const operatorTokens = this.tokens.filter(t => t.type === TokenType.OPERATOR) as OperatorToken[];
    
    for (const otherToken of operatorTokens) {
      if (otherToken === operatorToken) continue;
      
      // Check for exact duplicates
      if (operatorToken.operator === otherToken.operator && 
          operatorToken.operatorValue === otherToken.operatorValue &&
          operatorToken.comparison === otherToken.comparison) {
        this.warnings.push(`Duplicate operator: ${operatorToken.operator}:${operatorToken.operatorValue}`);
      }
    }
  }

  /**
   * Check for suspicious operator combinations
   */
  private checkForSuspiciousCombinations(operatorToken: OperatorToken, operatorDef: OperatorDefinition): void {
    const operatorTokens = this.tokens.filter(t => t.type === TokenType.OPERATOR) as OperatorToken[];
    
    // Check for power without toughness or vice versa
    if (operatorDef.name === 'power') {
      const hasToughness = operatorTokens.some(t => t.operator === 'toughness' || t.operator === 'tou');
      if (!hasToughness) {
        this.warnings.push(`Consider adding toughness restriction when filtering by power`);
      }
    }
    
    if (operatorDef.name === 'toughness') {
      const hasPower = operatorTokens.some(t => t.operator === 'power' || t.operator === 'pow');
      if (!hasPower) {
        this.warnings.push(`Consider adding power restriction when filtering by toughness`);
      }
    }
    
    // Check for set without collector number (might be more specific than needed)
    if (operatorDef.name === 'set') {
      const hasCollector = operatorTokens.some(t => t.operator === 'collector' || t.operator === 'cn');
      if (hasCollector) {
        this.warnings.push(`Filtering by both set and collector number may be overly specific`);
      }
    }
  }

  /**
   * Create a helpful error message for unknown operators
   */
  private createUnknownOperatorError(operator: string, token: OperatorToken): QueryValidationError {
    // Find similar operators for suggestions
    const suggestions = this.findSimilarOperators(operator);
    
    let message = `Unknown operator: '${operator}'`;
    if (suggestions.length > 0) {
      message += `. Did you mean: ${suggestions.join(', ')}?`;
    }
    
    return new QueryValidationError(
      message,
      token.position,
      token.length,
      'UNKNOWN_OPERATOR'
    );
  }

  /**
   * Find similar operators for suggestions
   */
  private findSimilarOperators(operator: string): string[] {
    const allOperators = this.registry.getAllOperators();
    const suggestions: Array<{ name: string; distance: number }> = [];
    
    for (const op of allOperators) {
      // Check main name
      const mainDistance = this.levenshteinDistance(operator, op.name);
      if (mainDistance <= 2) {
        suggestions.push({ name: op.name, distance: mainDistance });
      }
      
      // Check aliases
      for (const alias of op.aliases) {
        const aliasDistance = this.levenshteinDistance(operator, alias);
        if (aliasDistance <= 2) {
          suggestions.push({ name: alias, distance: aliasDistance });
        }
      }
    }
    
    return suggestions
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(s => s.name);
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
   * Add an operator-specific error
   */
  private addOperatorError(operatorToken: OperatorToken, error: QueryValidationError): void {
    this.errors.push(error);
  }

  /**
   * Get all operator definitions from the registry
   */
  getAvailableOperators(): OperatorDefinition[] {
    return this.registry.getAllOperators();
  }

  /**
   * Static method to quickly validate operators
   */
  static validate(tokens: Token[], registry?: OperatorRegistry): ValidationResult {
    const validator = new OperatorValidator(tokens, registry);
    return validator.validate();
  }
}