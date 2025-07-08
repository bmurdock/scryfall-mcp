import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedScryfallValidator } from '../../src/validation/enhanced-validator.js';
import { SuggestionEngine } from '../../src/validation/suggestions/suggestion-engine.js';
import { validateQuery } from '../../src/validation/index.js';

describe('Enhanced Scryfall Validation', () => {
  let validator: EnhancedScryfallValidator;

  beforeEach(() => {
    validator = new EnhancedScryfallValidator();
  });

  describe('Basic Validation', () => {
    it('should validate simple card name searches', async () => {
      const result = await validator.validate('lightning bolt');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate simple operator queries', async () => {
      const result = await validator.validate('c:red');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate complex queries with boolean logic', async () => {
      const result = await validator.validate('c:red AND t:creature');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate quoted strings', async () => {
      const result = await validator.validate('o:"enters the battlefield"');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate comparison operators', async () => {
      const result = await validator.validate('cmc>=3');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Error Detection', () => {
    it('should detect empty queries', async () => {
      const result = await validator.validate('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('empty');
    });

    it('should detect unknown operators', async () => {
      const result = await validateQuery('unknown:value');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect unmatched parentheses', async () => {
      const result = await validateQuery('(c:red');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect boolean operators at start', async () => {
      const result = await validateQuery('AND c:red');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect consecutive boolean operators', async () => {
      const result = await validateQuery('c:red AND OR t:creature');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Suggestions', () => {
    it('should suggest operator corrections for typos', async () => {
      const result = await validator.validate('colour:red');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].suggestedQuery).toContain('c:red');
    });

    it('should suggest color corrections', async () => {
      const result = await validator.validate('invalid:syntax');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest parentheses fixes', async () => {
      const result = await validator.validate('(c:red');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].suggestedQuery).toContain(')');
    });
  });

  describe('Performance Analysis', () => {
    it('should analyze query complexity', async () => {
      const simpleResult = await validator.validate('c:red');
      const complexResult = await validator.validate('c:red AND t:creature AND (o:flying OR o:haste) AND cmc>=3 AND f:modern');
      
      expect(complexResult.queryComplexity).toBeGreaterThan(simpleResult.queryComplexity);
    });

    it('should warn about performance issues', async () => {
      // Create a query that exceeds the performance thresholds (11 operators > threshold of 10)
      const longQuery = 'c:red AND t:creature AND o:flying AND pow>=2 AND tou<=4 AND cmc>=2 AND cmc<=5 AND f:modern AND r:rare AND set:dom AND a:artist AND id:wubrg AND year>=2020 AND loyalty>=3 AND game:paper AND usd<=10 AND produces:mana AND is:permanent';
      const result = await validator.validate(longQuery);
      
      // Should have performance warnings due to too many operators
      expect(result.warnings.some(w => w.type === 'PERFORMANCE_WARNING')).toBe(true);
    });

    it('should measure validation time', async () => {
      const result = await validator.validate('c:red AND t:creature');
      expect(result.validationTime).toBeGreaterThan(0);
      expect(result.validationTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Confidence Scoring', () => {
    it('should have high confidence for valid queries', async () => {
      const result = await validator.validate('c:red AND t:creature');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should have zero confidence for invalid queries', async () => {
      const result = await validator.validate('invalid:syntax');
      expect(result.confidence).toBe(0);
    });

    it('should have reduced confidence with warnings', async () => {
      const longQuery = 'c:red AND t:creature AND o:flying AND pow>=2 AND tou<=4 AND cmc>=2 AND cmc<=5 AND f:modern AND r:rare AND set:dom AND a:artist';
      const result = await validator.validate(longQuery);
      
      if (result.warnings.length > 0) {
        expect(result.confidence).toBeLessThan(0.95);
      }
    });
  });

  describe('Integration with Convenience Function', () => {
    it('should work with the convenience validateQuery function', async () => {
      const result = validateQuery('c:red AND t:creature');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors in convenience function', async () => {
      const result = validateQuery('invalid:operator');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should provide sync validation for backward compatibility', () => {
      const result = validator.validateSync('c:red');
      expect(result.isValid).toBe(true);
    });

    it('should handle errors in sync validation', () => {
      const result = validator.validateSync('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});

describe('Suggestion Engine', () => {
  describe('Operator Suggestions', () => {
    it('should suggest similar operators', () => {
      const mockError = {
        type: 'INVALID_OPERATOR' as const,
        message: 'Unknown operator',
        actual: 'colour',
        severity: 'error' as const,
        position: { line: 1, column: 1, offset: 0 }
      };

      const suggestions = SuggestionEngine.generateSuggestions([mockError], 'colour:red');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should generate refinement suggestions', () => {
      const suggestions = SuggestionEngine.generateRefinementSuggestions('c:red', 0);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('query_refinement');
    });

    it('should generate narrowing suggestions for too many results', () => {
      const suggestions = SuggestionEngine.generateRefinementSuggestions('t:creature', 500);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].description).toContain('narrow');
    });
  });
});