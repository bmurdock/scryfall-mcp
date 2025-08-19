/**
 * @fileoverview Query Builder Engine for Natural Language Processing
 * 
 * This module assembles Scryfall queries from extracted concept mappings,
 * applies optimization strategies, and generates explanations and alternatives.
 */

import {
  ParsedQuery,
  ConceptMapping,
  BuildOptions,
  BuildResult,
  AlternativeQuery,
  QueryOptimization
} from './types.js';
import { ConceptExtractor } from './concept-extractor.js';
import { ScryfallClient } from '../services/scryfall-client.js';
import { mcpLogger } from '../services/logger.js';

/**
 * Builds optimized Scryfall queries from natural language concepts
 */
export class QueryBuilderEngine {
  constructor(
    private readonly conceptExtractor: ConceptExtractor,
    private readonly scryfallClient: ScryfallClient
  ) {}
  
  /**
   * Build a complete Scryfall query from parsed natural language
   */
  async build(parsed: ParsedQuery, options: BuildOptions): Promise<BuildResult> {
    // Extract concept mappings
    const mappings = this.conceptExtractor.extractMappings(parsed);
    
    // Build base query
    const baseQuery = this.buildBaseQuery(mappings);
    
    // Apply format constraints
    const formatQuery = this.applyFormat(baseQuery, options.format);
    
    // Apply optimization strategy
    const optimizedQuery = this.applyOptimization(formatQuery, options.optimize_for);
    
    // Test query and adjust if needed
    const testedQuery = await this.testAndAdjust(optimizedQuery, options);
    
    // Generate explanation
    const explanation = this.generateExplanation(mappings, options);
    
    // Generate alternatives
    const alternatives = this.generateAlternatives(parsed, mappings, options);
    
    return {
      query: testedQuery.query,
      explanation,
      confidence: this.calculateBuildConfidence(parsed, mappings, testedQuery),
      alternatives,
      optimizations: testedQuery.optimizations
    };
  }
  
  /**
   * Build the base query from concept mappings
   */
  private buildBaseQuery(mappings: ConceptMapping[]): string {
    const queryParts: string[] = [];
    
    // Group mappings by operator for complex queries
    const grouped = this.groupMappingsByOperator(mappings);
    
    for (const [operator, operatorMappings] of grouped) {
      const part = this.buildOperatorQuery(operator, operatorMappings);
      if (part) {
        queryParts.push(part);
      }
    }
    
    return queryParts.join(' ');
  }
  
  /**
   * Group mappings by operator
   */
  private groupMappingsByOperator(mappings: ConceptMapping[]): Map<string, ConceptMapping[]> {
    const grouped = new Map<string, ConceptMapping[]>();
    
    for (const mapping of mappings) {
      const key = mapping.operator;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(mapping);
    }
    
    return grouped;
  }
  
  /**
   * Build query part for a specific operator
   */
  private buildOperatorQuery(operator: string, mappings: ConceptMapping[]): string {
    if (mappings.length === 0) return '';
    
    if (mappings.length === 1) {
      const mapping = mappings[0];
      const prefix = mapping.negation ? '-' : '';
      const comparison = mapping.comparison || '';
      return `${prefix}${operator}:${comparison}${mapping.value}`;
    }
    
    // Handle multiple values for same operator
    if (operator === 'o') {
      // Oracle text searches can be combined with OR
      const values = mappings.map(m => m.value);
      const oracleQueries = values.map(v => `o:"${v}"`);
      return `(${oracleQueries.join(' OR ')})`;
    } else if (operator === 't') {
      // Type searches can be combined with OR
      const values = mappings.map(m => m.value);
      const typeQueries = values.map(v => `t:${v}`);
      return `(${typeQueries.join(' OR ')})`;
    } else if (['cmc', 'pow', 'tou', 'usd', 'eur', 'tix'].includes(operator)) {
      // Numeric operators need range handling
      return this.buildNumericRange(operator, mappings);
    }
    
    // Default: use highest confidence mapping
    const best = mappings.reduce((a, b) =>
      a.confidence > b.confidence ? a : b, mappings[0]
    );
    const prefix = best.negation ? '-' : '';
    const comparison = best.comparison || '';
    return `${prefix}${operator}:${comparison}${best.value}`;
  }
  
  /**
   * Build numeric range queries (CMC, power, toughness, prices)
   */
  private buildNumericRange(operator: string, mappings: ConceptMapping[]): string {
    const minMappings = mappings.filter(m => m.comparison === '>=' || m.comparison === '>');
    const maxMappings = mappings.filter(m => m.comparison === '<=' || m.comparison === '<');
    const exactMappings = mappings.filter(m => !m.comparison || m.comparison === '=');
    
    if (exactMappings.length > 0) {
      // Exact value takes precedence
      const best = exactMappings.reduce((a, b) =>
        a.confidence > b.confidence ? a : b, exactMappings[0]
      );
      return `${operator}:${best.value}`;
    }

    const parts: string[] = [];

    if (minMappings.length > 0) {
      const best = minMappings.reduce((a, b) =>
        a.confidence > b.confidence ? a : b, minMappings[0]
      );
      parts.push(`${operator}:${best.comparison}${best.value}`);
    }

    if (maxMappings.length > 0) {
      const best = maxMappings.reduce((a, b) =>
        a.confidence > b.confidence ? a : b, maxMappings[0]
      );
      parts.push(`${operator}:${best.comparison}${best.value}`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Apply format constraints to the query
   */
  private applyFormat(query: string, format?: string): string {
    if (!format) return query;
    
    const formatPart = `f:${format}`;
    return query ? `${query} ${formatPart}` : formatPart;
  }
  
  /**
   * Apply optimization strategy to the query
   */
  private applyOptimization(query: string, strategy: string): string {
    switch (strategy) {
      case 'precision':
        return this.optimizeForPrecision(query);
      case 'recall':
        return this.optimizeForRecall(query);
      case 'discovery':
        return this.optimizeForDiscovery(query);
      case 'budget':
        return this.optimizeForBudget(query);
      default:
        return query;
    }
  }
  
  /**
   * Optimize query for precision (fewer, more relevant results)
   */
  private optimizeForPrecision(query: string): string {
    let optimized = query;
    
    // If no format specified, default to popular formats for precision
    if (!query.includes('f:')) {
      optimized += ' (f:standard OR f:modern OR f:commander)';
    }
    
    // Exclude very expensive cards unless price is explicitly mentioned
    const priceRegex = /(?:usd|eur|tix):/;
    if (!priceRegex.test(query)) {
      optimized += ' usd<=50';
    }
    
    return optimized;
  }
  
  /**
   * Optimize query for recall (broader search)
   */
  private optimizeForRecall(query: string): string {
    let optimized = query;
    
    // Relax power/toughness constraints
    optimized = optimized.replace(/pow:>=(\d+)/, (match, value) => {
      const newValue = Math.max(1, parseInt(value) - 1);
      return `pow:>=${newValue}`;
    });
    
    // Broaden type searches
    optimized = optimized.replace(/t:(\w+)(?!\w)/, (match, type) => {
      const relatedTypes = this.getRelatedTypes(type);
      if (relatedTypes.length > 0) {
        return `(t:${type} OR t:${relatedTypes.join(' OR t:')})`;
      }
      return match;
    });
    
    return optimized;
  }
  
  /**
   * Optimize query for discovery (interesting cards)
   */
  private optimizeForDiscovery(query: string): string {
    let optimized = query;
    
    // Add interesting constraints for exploration
    if (!query.includes('is:')) {
      optimized += ' (is:unique OR is:reserved OR is:promo)';
    }
    
    return optimized;
  }
  
  /**
   * Optimize query for budget (cost-effective cards)
   */
  private optimizeForBudget(query: string): string {
    let optimized = query;
    
    // Add budget-friendly constraints
    const budgetPriceRegex = /(?:usd|eur|tix):/;
    if (!budgetPriceRegex.test(query)) {
      optimized += ' usd<=5';
    }
    
    return optimized;
  }
  
  /**
   * Get related types for broadening searches
   */
  private getRelatedTypes(type: string): string[] {
    const relatedMap = new Map([
      ['creature', ['planeswalker']], // Both are threats
      ['instant', ['sorcery']], // Both are spells
      ['sorcery', ['instant']], // Both are spells
      ['artifact', ['enchantment']], // Both are permanents
      ['enchantment', ['artifact']] // Both are permanents
    ]);
    
    return relatedMap.get(type) || [];
  }
  
  /**
   * Test query and adjust if needed
   */
  private async testAndAdjust(query: string, options: BuildOptions): Promise<{
    query: string;
    optimizations: QueryOptimization[];
  }> {
    try {
      // Test the query with a small limit
      const testResult = await this.scryfallClient.searchCards({
        query,
        limit: 1
      });
      
      const optimizations: QueryOptimization[] = [];
      let adjustedQuery = query;
      
      const totalCards = testResult.total_cards ?? 0;

      if (totalCards === 0) {
        // No results - broaden the query
        adjustedQuery = this.broadenQuery(query);
        optimizations.push({
          type: 'broadening',
          reason: 'Original query returned no results',
          change: `${query} → ${adjustedQuery}`
        });
      } else if (totalCards > (options.max_results || 20) * 10) {
        // Too many results - narrow the query
        adjustedQuery = this.narrowQuery(query);
        optimizations.push({
          type: 'narrowing',
          reason: `Original query returned ${totalCards} results`,
          change: `${query} → ${adjustedQuery}`
        });
      }
      
      return { query: adjustedQuery, optimizations };
    } catch (error) {
      // If query fails, log the error and return original
      mcpLogger.warn({ operation: 'query_test', error: error instanceof Error ? error.message : String(error) }, 'Query testing failed');
      return { query, optimizations: [] };
    }
  }
  
  /**
   * Broaden a query that returns no results
   */
  private broadenQuery(query: string): string {
    // Remove restrictive constraints
    let broadened = query;
    
    // Remove exact CMC constraints
    broadened = broadened.replace(/cmc:=(\d+)/, 'cmc<=$1');
    
    // Remove power constraints
    broadened = broadened.replace(/pow:>=(\d+)/, (match, value) => {
      const newValue = Math.max(1, parseInt(value) - 1);
      return `pow:>=${newValue}`;
    });
    
    // Remove price constraints if too restrictive
    broadened = broadened.replace(/usd:<=(\d+)/, (match, value) => {
      const newValue = parseInt(value) * 2;
      return `usd:<=${newValue}`;
    });
    
    return broadened;
  }
  
  /**
   * Narrow a query that returns too many results
   */
  private narrowQuery(query: string): string {
    let narrowed = query;
    
    // Add format constraint if missing
    if (!query.includes('f:')) {
      narrowed += ' f:modern';
    }
    
    // Add price constraint if missing
    const narrowPriceRegex = /(?:usd|eur|tix):/;
    if (!narrowPriceRegex.test(query)) {
      narrowed += ' usd<=20';
    }
    
    return narrowed;
  }
  
  /**
   * Generate explanation of the query
   */
  private generateExplanation(mappings: ConceptMapping[], options: BuildOptions): string {
    const explanations: string[] = [];
    
    // Group explanations by concept type
    const colorMappings = mappings.filter(m => m.operator === 'c' || m.operator === 'id');
    const typeMappings = mappings.filter(m => m.operator === 't');
    const functionMappings = mappings.filter(m => m.operator === 'function' || m.operator === 'o');
    const priceMappings = mappings.filter(m => ['usd', 'eur', 'tix'].includes(m.operator));
    const statMappings = mappings.filter(m => ['pow', 'tou', 'cmc'].includes(m.operator));
    
    if (colorMappings.length > 0) {
      explanations.push(this.explainColorConstraints(colorMappings));
    }
    
    if (typeMappings.length > 0) {
      explanations.push(this.explainTypeConstraints(typeMappings));
    }
    
    if (functionMappings.length > 0) {
      explanations.push(this.explainFunctionConstraints(functionMappings));
    }
    
    if (priceMappings.length > 0) {
      explanations.push(this.explainPriceConstraints(priceMappings));
    }
    
    if (statMappings.length > 0) {
      explanations.push(this.explainStatConstraints(statMappings));
    }
    
    if (options.format) {
      explanations.push(`legal in ${options.format} format`);
    }
    
    return explanations.join(', ');
  }
  
  /**
   * Explain color constraints
   */
  private explainColorConstraints(mappings: ConceptMapping[]): string {
    const colorNames = mappings.map(m => this.getColorName(m.value)).join(' and ');
    return `Cards that are ${colorNames}`;
  }
  
  /**
   * Explain type constraints
   */
  private explainTypeConstraints(mappings: ConceptMapping[]): string {
    const types = mappings.map(m => m.value).join(' or ');
    return `${types} cards`;
  }
  
  /**
   * Explain function constraints
   */
  private explainFunctionConstraints(mappings: ConceptMapping[]): string {
    const functions = mappings.map(m => m.value).join(' or ');
    return `with ${functions} effects`;
  }
  
  /**
   * Explain price constraints
   */
  private explainPriceConstraints(mappings: ConceptMapping[]): string {
    const prices = mappings.map(m => `${m.comparison}$${m.value}`).join(' and ');
    return `priced ${prices}`;
  }
  
  /**
   * Explain stat constraints
   */
  private explainStatConstraints(mappings: ConceptMapping[]): string {
    const stats = mappings.map(m => `${m.operator} ${m.comparison}${m.value}`).join(' and ');
    return `with ${stats}`;
  }
  
  /**
   * Get color name from code
   */
  private getColorName(code: string): string {
    const colorMap = new Map([
      ['w', 'white'], ['u', 'blue'], ['b', 'black'], ['r', 'red'], ['g', 'green'],
      ['c', 'colorless'], ['m', 'multicolor']
    ]);
    
    return colorMap.get(code) || code;
  }
  
  /**
   * Generate alternative queries
   */
  private generateAlternatives(
    parsed: ParsedQuery, 
    mappings: ConceptMapping[], 
    options: BuildOptions
  ): AlternativeQuery[] {
    const alternatives: AlternativeQuery[] = [];
    
    // Generate format alternatives
    if (!options.format) {
      const popularFormats = ['standard', 'modern', 'commander', 'legacy'];
      for (const format of popularFormats) {
        const altQuery = this.buildBaseQuery(mappings) + ` f:${format}`;
        alternatives.push({
          query: altQuery,
          description: `Same search restricted to ${format} format`,
          type: 'format_restriction',
          confidence: 0.8
        });
      }
    }
    
    // Generate strategy alternatives
    const strategies = ['precision', 'recall', 'discovery', 'budget'];
    for (const strategy of strategies) {
      if (strategy !== options.optimize_for) {
        const altQuery = this.applyOptimization(this.buildBaseQuery(mappings), strategy);
        alternatives.push({
          query: altQuery,
          description: `Optimized for ${strategy}`,
          type: 'optimization',
          confidence: 0.7
        });
      }
    }
    
    return alternatives.slice(0, 3); // Limit to top 3 alternatives
  }
  
  /**
   * Calculate build confidence
   */
  private calculateBuildConfidence(
    parsed: ParsedQuery, 
    mappings: ConceptMapping[], 
    testedQuery: any
  ): number {
    let confidence = parsed.confidence;
    
    // Boost confidence if query was successfully tested
    if (testedQuery.optimizations.length === 0) {
      confidence += 0.1;
    }
    
    // Reduce confidence for each optimization needed
    confidence -= testedQuery.optimizations.length * 0.05;
    
    return Math.max(0, Math.min(1, confidence));
  }
}
