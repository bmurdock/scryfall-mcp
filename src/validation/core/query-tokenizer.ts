import { 
  Token, 
  TokenType, 
  OperatorToken, 
  BooleanToken, 
  ParenthesisToken, 
  ComparisonOperator,
  TokenizationResult,
  QueryValidationError 
} from '../types.js';

/**
 * Tokenizes Scryfall search queries into structured tokens
 */
export class QueryTokenizer {
  private query: string;
  private position: number = 0;
  private tokens: Token[] = [];
  private errors: QueryValidationError[] = [];

  constructor(query: string) {
    this.query = query;
  }

  /**
   * Tokenize the query and return results
   */
  tokenize(): TokenizationResult {
    this.position = 0;
    this.tokens = [];
    this.errors = [];

    while (this.position < this.query.length) {
      this.skipWhitespace();
      
      if (this.position >= this.query.length) {
        break;
      }

      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    // Add EOF token
    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      position: this.position,
      length: 0
    });

    return {
      tokens: this.tokens,
      errors: this.errors
    };
  }

  private nextToken(): Token | null {
    const char = this.query[this.position];
    
    switch (char) {
      case '(':
        return this.createParenthesisToken('open');
      case ')':
        return this.createParenthesisToken('close');
      case '"':
        return this.parseQuotedString();
      default:
        return this.parseUnquotedToken();
    }
  }

  private createParenthesisToken(kind: 'open' | 'close'): ParenthesisToken {
    const token: ParenthesisToken = {
      type: TokenType.PARENTHESIS,
      value: this.query[this.position],
      position: this.position,
      length: 1,
      kind
    };
    this.position++;
    return token;
  }

  private parseQuotedString(): Token {
    const startPos = this.position;
    this.position++; // Skip opening quote
    let value = '';
    let escaped = false;

    while (this.position < this.query.length) {
      const char = this.query[this.position];
      
      if (escaped) {
        value += char;
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        this.position++; // Skip closing quote
        return {
          type: TokenType.QUOTED_STRING,
          value,
          position: startPos,
          length: this.position - startPos
        };
      } else {
        value += char;
      }
      
      this.position++;
    }

    // Unclosed quote
    this.errors.push(new QueryValidationError(
      'Unclosed quoted string',
      startPos,
      this.position - startPos,
      'UNCLOSED_QUOTE'
    ));

    return {
      type: TokenType.QUOTED_STRING,
      value,
      position: startPos,
      length: this.position - startPos
    };
  }

  private parseUnquotedToken(): Token {
    const startPos = this.position;
    let value = '';

    // Read until whitespace, parentheses, or end of string
    while (this.position < this.query.length) {
      const char = this.query[this.position];
      
      if (this.isWhitespace(char) || char === '(' || char === ')' || char === '"') {
        break;
      }
      
      value += char;
      this.position++;
    }

    if (value === '') {
      // Create a whitespace token for empty value
      return {
        type: TokenType.WHITESPACE,
        value: '',
        position: startPos,
        length: this.position - startPos
      };
    }

    // Check if it's a boolean operator
    const upperValue = value.toUpperCase();
    if (upperValue === 'AND' || upperValue === 'OR' || upperValue === 'NOT') {
      return {
        type: TokenType.BOOLEAN,
        value: upperValue,
        position: startPos,
        length: value.length,
        operator: upperValue as 'AND' | 'OR' | 'NOT'
      } as BooleanToken;
    }

    // Check if it's an operator (contains colon)
    if (value.includes(':')) {
      return this.parseOperatorToken(value, startPos);
    }

    // Regular unquoted string
    return {
      type: TokenType.UNQUOTED_STRING,
      value,
      position: startPos,
      length: value.length
    };
  }

  private parseOperatorToken(value: string, startPos: number): OperatorToken | Token {
    const colonIndex = value.indexOf(':');
    if (colonIndex === -1) {
      // This shouldn't happen given the check above, but handle gracefully
      return {
        type: TokenType.UNQUOTED_STRING,
        value,
        position: startPos,
        length: value.length
      };
    }

    const operatorPart = value.substring(0, colonIndex);
    let valuePart = value.substring(colonIndex + 1);

    // Check if the value part is empty and there's a quoted string following
    if (valuePart === '' && this.position < this.query.length && this.query[this.position] === '"') {
      const quotedStringToken = this.parseQuotedString();
      valuePart = quotedStringToken.value;
      // Update the length to include the quoted string
      const totalLength = this.position - startPos;
      
      // Parse comparison operator from the operator part
      const { operator, comparison } = this.parseComparisonOperator(operatorPart);

      return {
        type: TokenType.OPERATOR,
        value: operatorPart + ':' + '"' + valuePart + '"',
        position: startPos,
        length: totalLength,
        operator,
        comparison,
        operatorValue: valuePart
      } as OperatorToken;
    }

    // Parse comparison operator from the operator part
    const { operator, comparison } = this.parseComparisonOperator(operatorPart);

    return {
      type: TokenType.OPERATOR,
      value,
      position: startPos,
      length: value.length,
      operator,
      comparison,
      operatorValue: valuePart
    } as OperatorToken;
  }

  private parseComparisonOperator(operatorPart: string): { operator: string; comparison?: ComparisonOperator } {
    // Check for comparison operators at the end
    if (operatorPart.endsWith('>=')) {
      return {
        operator: operatorPart.slice(0, -2),
        comparison: ComparisonOperator.GREATER_THAN_OR_EQUAL
      };
    }
    if (operatorPart.endsWith('<=')) {
      return {
        operator: operatorPart.slice(0, -2),
        comparison: ComparisonOperator.LESS_THAN_OR_EQUAL
      };
    }
    if (operatorPart.endsWith('!=')) {
      return {
        operator: operatorPart.slice(0, -2),
        comparison: ComparisonOperator.NOT_EQUALS
      };
    }
    if (operatorPart.endsWith('>')) {
      return {
        operator: operatorPart.slice(0, -1),
        comparison: ComparisonOperator.GREATER_THAN
      };
    }
    if (operatorPart.endsWith('<')) {
      return {
        operator: operatorPart.slice(0, -1),
        comparison: ComparisonOperator.LESS_THAN
      };
    }
    if (operatorPart.endsWith('=')) {
      return {
        operator: operatorPart.slice(0, -1),
        comparison: ComparisonOperator.EQUALS
      };
    }

    // No comparison operator found
    return { operator: operatorPart };
  }

  private skipWhitespace(): void {
    while (this.position < this.query.length && this.isWhitespace(this.query[this.position])) {
      this.position++;
    }
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  /**
   * Get the current position in the query
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * Get the original query string
   */
  getQuery(): string {
    return this.query;
  }

  /**
   * Get a substring of the query for error reporting
   */
  getQueryContext(position: number, length: number = 10): string {
    const start = Math.max(0, position - 5);
    const end = Math.min(this.query.length, position + length + 5);
    return this.query.substring(start, end);
  }

  /**
   * Static method to quickly tokenize a query
   */
  static tokenize(query: string): TokenizationResult {
    const tokenizer = new QueryTokenizer(query);
    return tokenizer.tokenize();
  }
}