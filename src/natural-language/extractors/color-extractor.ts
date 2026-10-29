/**
 * @fileoverview Color Pattern Engine for Natural Language Processing
 * 
 * This module handles the extraction and interpretation of color-related
 * concepts from natural language queries, including basic colors, guild names,
 * shard names, wedge names, and special color combinations.
 */

import { ColorConcept } from '../types.js';

/**
 * Engine for extracting color concepts from natural language
 */
export class ColorPatternEngine {
  private readonly patterns = new Map([
    // Basic colors
    ['red', { colors: ['r'], exact: false, confidence: 0.95 }],
    ['blue', { colors: ['u'], exact: false, confidence: 0.95 }],
    ['white', { colors: ['w'], exact: false, confidence: 0.95 }],
    ['black', { colors: ['b'], exact: false, confidence: 0.95 }],
    ['green', { colors: ['g'], exact: false, confidence: 0.95 }],
    
    // Guild names with higher confidence
    ['azorius', { colors: ['w', 'u'], exact: true, confidence: 0.98 }],
    ['dimir', { colors: ['u', 'b'], exact: true, confidence: 0.98 }],
    ['rakdos', { colors: ['b', 'r'], exact: true, confidence: 0.98 }],
    ['gruul', { colors: ['r', 'g'], exact: true, confidence: 0.98 }],
    ['selesnya', { colors: ['g', 'w'], exact: true, confidence: 0.98 }],
    ['orzhov', { colors: ['w', 'b'], exact: true, confidence: 0.98 }],
    ['izzet', { colors: ['u', 'r'], exact: true, confidence: 0.98 }],
    ['golgari', { colors: ['b', 'g'], exact: true, confidence: 0.98 }],
    ['boros', { colors: ['r', 'w'], exact: true, confidence: 0.98 }],
    ['simic', { colors: ['g', 'u'], exact: true, confidence: 0.98 }],
    
    // Shard names
    ['bant', { colors: ['g', 'w', 'u'], exact: true, confidence: 0.98 }],
    ['esper', { colors: ['w', 'u', 'b'], exact: true, confidence: 0.98 }],
    ['grixis', { colors: ['u', 'b', 'r'], exact: true, confidence: 0.98 }],
    ['jund', { colors: ['b', 'r', 'g'], exact: true, confidence: 0.98 }],
    ['naya', { colors: ['r', 'g', 'w'], exact: true, confidence: 0.98 }],
    
    // Wedge names  
    ['abzan', { colors: ['w', 'b', 'g'], exact: true, confidence: 0.98 }],
    ['jeskai', { colors: ['u', 'r', 'w'], exact: true, confidence: 0.98 }],
    ['sultai', { colors: ['b', 'g', 'u'], exact: true, confidence: 0.98 }],
    ['mardu', { colors: ['r', 'w', 'b'], exact: true, confidence: 0.98 }],
    ['temur', { colors: ['g', 'u', 'r'], exact: true, confidence: 0.98 }],
    
    // Special color combinations
    ['multicolor', { colors: [], multicolor: true, confidence: 0.90 }],
    ['multicolored', { colors: [], multicolor: true, confidence: 0.90 }],
    ['colorless', { colors: [], colorless: true, confidence: 0.95 }],
    ['rainbow', { colors: ['w', 'u', 'b', 'r', 'g'], exact: false, confidence: 0.85 }],
    ['five-color', { colors: ['w', 'u', 'b', 'r', 'g'], exact: false, confidence: 0.90 }],
    ['five color', { colors: ['w', 'u', 'b', 'r', 'g'], exact: false, confidence: 0.90 }],
    
    // Alternative color names
    ['mono-red', { colors: ['r'], exact: true, confidence: 0.92 }],
    ['mono-blue', { colors: ['u'], exact: true, confidence: 0.92 }],
    ['mono-white', { colors: ['w'], exact: true, confidence: 0.92 }],
    ['mono-black', { colors: ['b'], exact: true, confidence: 0.92 }],
    ['mono-green', { colors: ['g'], exact: true, confidence: 0.92 }],
    ['mono red', { colors: ['r'], exact: true, confidence: 0.92 }],
    ['mono blue', { colors: ['u'], exact: true, confidence: 0.92 }],
    ['mono white', { colors: ['w'], exact: true, confidence: 0.92 }],
    ['mono black', { colors: ['b'], exact: true, confidence: 0.92 }],
    ['mono green', { colors: ['g'], exact: true, confidence: 0.92 }],
  ]);

  /**
   * Extract color concepts from natural language text
   */
  extract(text: string): ColorConcept[] {
    const concepts: ColorConcept[] = [];
    const alternatives: ColorConcept[] = [];
    const colorWord = '(?:red|blue|white|black|green|multicolor(?:ed)?|colorless)';
    const lowerText = text.toLowerCase().replace(
      new RegExp(`\\b${colorWord}(?:\\s+or\\s+${colorWord})+\\b`, 'g'),
      (phrase, index: number) => {
        alternatives.push({
          colors: [...new Set<string>(phrase.split(/\s+or\s+/).map((color: string) => {
            const concept = this.patterns.get(color)!;
            return concept.multicolor ? 'm' : concept.colorless ? 'c' : concept.colors[0];
          }))],
          negation: /\b(?:non[- ]|not\s+|without\s+)$/i.test(text.slice(0, index)),
          anyOf: true, exact: false, inclusive: false, exclusive: false,
          multicolor: false, colorless: false, confidence: 0.95,
        });
        return ' ';
      }
    );
    
    // Check for exact phrases first (higher confidence)
    for (const [pattern, concept] of this.patterns) {
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const match of lowerText.matchAll(new RegExp(`\\b${escapedPattern}\\b`, 'g'))) {
        const prefix = lowerText.slice(0, match.index);
        // The mono-color alias owns the full phrase, including its negation.
        if (/^(?:red|blue|white|black|green)$/.test(pattern) && /\bmono[- ]$/.test(prefix)) {
          continue;
        }
        concepts.push({
          colors: concept.colors || [],
          negation: /\b(?:non[- ]|not\s+|without\s+)$/.test(prefix),
          exact: concept.exact || false,
          inclusive: this.detectInclusive(prefix),
          exclusive: this.detectExclusive(prefix),
          multicolor: concept.multicolor || false,
          colorless: concept.colorless || false,
          confidence: concept.confidence
        });
      }
    }
    
    return [...this.deduplicateAndMerge(concepts), ...alternatives];
  }
  
  /**
   * Detect inclusive color indicators (or, any, either, include)
   */
  private detectInclusive(prefix: string): boolean {
    return /\b(?:any|either|include|including|containing)\s+(?:(?:red|blue|white|black|green)\s+(?:and\s+)?)*$/.test(prefix);
  }
  
  /**
   * Detect exclusive color indicators (only, just, exactly, purely, solely)
   */
  private detectExclusive(prefix: string): boolean {
    return /\b(?:only|just|exactly|purely|solely|mono)[ -]+(?:(?:red|blue|white|black|green)\s+(?:and\s+)?)*$/.test(prefix);
  }
  
  /**
   * Deduplicate and merge similar color concepts
   */
  private deduplicateAndMerge(concepts: ColorConcept[]): ColorConcept[] {
    if (concepts.length <= 1) return concepts;
    
    const merged: ColorConcept[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < concepts.length; i++) {
      if (processed.has(i)) continue;
      
      let current = concepts[i];
      
      // Look for mergeable concepts
      for (let j = i + 1; j < concepts.length; j++) {
        if (processed.has(j)) continue;
        
        const other = concepts[j];
        if (this.canMergeConcepts(current, other)) {
          current = this.mergeConcepts(current, other);
          processed.add(j);
        }
      }
      
      merged.push(current);
      processed.add(i);
    }
    
    return merged;
  }
  
  /**
   * Check if two color concepts can be merged
   */
  private canMergeConcepts(a: ColorConcept, b: ColorConcept): boolean {
    if (a.negation || b.negation) {
      return a.negation === b.negation && a.colors.join('') === b.colors.join('') &&
        a.multicolor === b.multicolor && a.colorless === b.colorless;
    }
    // Can merge if they have overlapping colors or compatible flags
    const hasOverlap = a.colors.some(color => b.colors.includes(color));
    const compatibleFlags = (a.multicolor === b.multicolor) && (a.colorless === b.colorless);
    
    return hasOverlap || compatibleFlags;
  }
  
  /**
   * Merge two compatible color concepts
   */
  private mergeConcepts(a: ColorConcept, b: ColorConcept): ColorConcept {
    const mergedColors = [...new Set([...a.colors, ...b.colors])];
    
    return {
      colors: mergedColors,
      negation: a.negation,
      exact: a.exact || b.exact,
      inclusive: a.inclusive || b.inclusive,
      exclusive: a.exclusive || b.exclusive,
      multicolor: a.multicolor || b.multicolor,
      colorless: a.colorless || b.colorless,
      confidence: Math.max(a.confidence, b.confidence)
    };
  }
}
