import { 
  Token, 
  TokenType, 
  BooleanToken, 
  ParenthesisToken, 
  ValidationResult,
  QueryValidationError 
} from '../types.js';

/**
 * Validates basic syntax of tokenized Scryfall queries
 */
export class SyntaxValidator {
  private tokens: Token[];
  private errors: QueryValidationError[] = [];
  private warnings: string[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Perform comprehensive syntax validation
   */
  validate(): ValidationResult {
    this.errors = [];
    this.warnings = [];

    // Run all validation checks
    this.validateParentheses();
    this.validateBooleanOperators();
    this.validateOperatorSequences();
    this.validateEmptyQuery();
    this.validateTrailingOperators();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      tokens: this.tokens
    };
  }

  /**
   * Validate parentheses are properly matched
   */
  private validateParentheses(): void {
    const stack: ParenthesisToken[] = [];
    
    for (const token of this.tokens) {
      if (token.type === TokenType.PARENTHESIS) {
        const parenToken = token as ParenthesisToken;
        
        if (parenToken.kind === 'open') {
          stack.push(parenToken);
        } else if (parenToken.kind === 'close') {
          if (stack.length === 0) {
            this.errors.push(new QueryValidationError(
              'Unmatched closing parenthesis',
              parenToken.position,
              parenToken.length,
              'UNMATCHED_CLOSING_PAREN'
            ));
          } else {
            stack.pop();
          }
        }
      }
    }

    // Check for unmatched opening parentheses
    for (const unclosedParen of stack) {
      this.errors.push(new QueryValidationError(
        'Unmatched opening parenthesis',
        unclosedParen.position,
        unclosedParen.length,
        'UNMATCHED_OPENING_PAREN'
      ));
    }
  }

  /**
   * Validate boolean operator placement and sequences
   */
  private validateBooleanOperators(): void {
    const nonEofTokens = this.tokens.filter(t => t.type !== TokenType.EOF);
    
    if (nonEofTokens.length === 0) return;

    // Check if query starts with a boolean operator
    const firstToken = nonEofTokens[0];
    if (firstToken.type === TokenType.BOOLEAN) {
      const boolToken = firstToken as BooleanToken;
      if (boolToken.operator !== 'NOT') {
        this.errors.push(new QueryValidationError(
          `Query cannot start with '${boolToken.operator}' operator`,
          firstToken.position,
          firstToken.length,
          'BOOLEAN_AT_START'
        ));
      }
    }

    // Check if query ends with a boolean operator
    const lastToken = nonEofTokens[nonEofTokens.length - 1];
    if (lastToken.type === TokenType.BOOLEAN) {
      this.errors.push(new QueryValidationError(
        `Query cannot end with '${(lastToken as BooleanToken).operator}' operator`,
        lastToken.position,
        lastToken.length,
        'BOOLEAN_AT_END'
      ));
    }

    // Check for consecutive boolean operators
    for (let i = 0; i < nonEofTokens.length - 1; i++) {
      const current = nonEofTokens[i];
      const next = nonEofTokens[i + 1];
      
      if (current.type === TokenType.BOOLEAN && next.type === TokenType.BOOLEAN) {
        const currentBool = current as BooleanToken;
        const nextBool = next as BooleanToken;
        
        // Allow AND/OR followed by NOT (e.g., "AND NOT", "OR NOT")
        if ((currentBool.operator === 'AND' || currentBool.operator === 'OR') && nextBool.operator === 'NOT') {
          // This is valid, continue
          continue;
        }
        
        // Allow NOT followed by another boolean in some cases
        if (currentBool.operator === 'NOT' && (nextBool.operator === 'AND' || nextBool.operator === 'OR')) {
          this.errors.push(new QueryValidationError(
            `Invalid sequence: '${currentBool.operator} ${nextBool.operator}'. Use parentheses to group NOT expressions`,
            current.position,
            next.position + next.length - current.position,
            'CONSECUTIVE_BOOLEAN'
          ));
        } else if (currentBool.operator !== 'NOT' || nextBool.operator === 'NOT') {
          this.errors.push(new QueryValidationError(
            `Consecutive boolean operators: '${currentBool.operator} ${nextBool.operator}'`,
            current.position,
            next.position + next.length - current.position,
            'CONSECUTIVE_BOOLEAN'
          ));
        }
      }
    }
  }

  /**
   * Validate operator sequences and placement
   */
  private validateOperatorSequences(): void {
    const nonEofTokens = this.tokens.filter(t => t.type !== TokenType.EOF);
    
    for (let i = 0; i < nonEofTokens.length; i++) {
      const token = nonEofTokens[i];
      
      // Check for orphaned boolean operators
      if (token.type === TokenType.BOOLEAN) {
        const boolToken = token as BooleanToken;
        
        // Check what comes after this boolean operator
        const nextMeaningfulToken = this.findNextMeaningfulToken(nonEofTokens, i);
        
        if (!nextMeaningfulToken) {
          this.errors.push(new QueryValidationError(
            `'${boolToken.operator}' operator must be followed by a search term`,
            token.position,
            token.length,
            'ORPHANED_BOOLEAN'
          ));
        } else if (nextMeaningfulToken.type === TokenType.BOOLEAN && boolToken.operator !== 'NOT') {
          // Check if it's a valid AND NOT or OR NOT sequence
          const nextBool = nextMeaningfulToken as BooleanToken;
          if (!((boolToken.operator === 'AND' || boolToken.operator === 'OR') && nextBool.operator === 'NOT')) {
            this.warnings.push(`Boolean operator '${boolToken.operator}' should be followed by a search term, not another boolean operator`);
          }
        }
        
        // Check what comes before this boolean operator (except for NOT)
        if (boolToken.operator !== 'NOT') {
          const prevMeaningfulToken = this.findPrevMeaningfulToken(nonEofTokens, i);
          
          if (!prevMeaningfulToken) {
            // Already handled in validateBooleanOperators
          } else if (prevMeaningfulToken.type === TokenType.BOOLEAN) {
            // Already handled in validateBooleanOperators
          } else if (prevMeaningfulToken.type === TokenType.PARENTHESIS && 
                     (prevMeaningfulToken as ParenthesisToken).kind === 'open') {
            this.errors.push(new QueryValidationError(
              `'${boolToken.operator}' operator cannot immediately follow opening parenthesis`,
              token.position,
              token.length,
              'BOOLEAN_AFTER_OPEN_PAREN'
            ));
          }
        }
      }
      
      // Check for empty parentheses
      if (token.type === TokenType.PARENTHESIS && (token as ParenthesisToken).kind === 'open') {
        const closingParen = this.findMatchingClosingParen(nonEofTokens, i);
        if (closingParen && closingParen.index === i + 1) {
          this.errors.push(new QueryValidationError(
            'Empty parentheses are not allowed',
            token.position,
            closingParen.token.position + closingParen.token.length - token.position,
            'EMPTY_PARENTHESES'
          ));
        }
      }
    }
  }

  /**
   * Validate that the query is not empty
   */
  private validateEmptyQuery(): void {
    const meaningfulTokens = this.tokens.filter(t => 
      t.type !== TokenType.EOF && 
      t.type !== TokenType.WHITESPACE
    );
    
    if (meaningfulTokens.length === 0) {
      this.errors.push(new QueryValidationError(
        'Query cannot be empty',
        0,
        0,
        'EMPTY_QUERY'
      ));
    }
  }

  /**
   * Check for trailing operators or incomplete expressions
   */
  private validateTrailingOperators(): void {
    const nonEofTokens = this.tokens.filter(t => t.type !== TokenType.EOF);
    
    if (nonEofTokens.length === 0) return;

    const lastToken = nonEofTokens[nonEofTokens.length - 1];
    
    // Check if query ends with opening parenthesis
    if (lastToken.type === TokenType.PARENTHESIS && 
        (lastToken as ParenthesisToken).kind === 'open') {
      this.errors.push(new QueryValidationError(
        'Query cannot end with opening parenthesis',
        lastToken.position,
        lastToken.length,
        'TRAILING_OPEN_PAREN'
      ));
    }
  }

  /**
   * Find the next meaningful token (non-whitespace)
   */
  private findNextMeaningfulToken(tokens: Token[], currentIndex: number): Token | null {
    for (let i = currentIndex + 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type !== TokenType.WHITESPACE) {
        return token;
      }
    }
    return null;
  }

  /**
   * Find the previous meaningful token (non-whitespace)
   */
  private findPrevMeaningfulToken(tokens: Token[], currentIndex: number): Token | null {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const token = tokens[i];
      if (token.type !== TokenType.WHITESPACE) {
        return token;
      }
    }
    return null;
  }

  /**
   * Find the matching closing parenthesis for an opening one
   */
  private findMatchingClosingParen(tokens: Token[], openIndex: number): { token: ParenthesisToken; index: number } | null {
    let depth = 1;
    
    for (let i = openIndex + 1; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (token.type === TokenType.PARENTHESIS) {
        const parenToken = token as ParenthesisToken;
        if (parenToken.kind === 'open') {
          depth++;
        } else if (parenToken.kind === 'close') {
          depth--;
          if (depth === 0) {
            return { token: parenToken, index: i };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Static method to quickly validate syntax
   */
  static validate(tokens: Token[]): ValidationResult {
    const validator = new SyntaxValidator(tokens);
    return validator.validate();
  }
}