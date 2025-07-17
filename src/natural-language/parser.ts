/**
 * @fileoverview Natural Language Parser for Scryfall Query Building
 * 
 * This module coordinates all pattern recognition engines to parse natural
 * language queries into structured concepts that can be converted to Scryfall
 * search syntax.
 */

import { 
  ParsedQuery, 
  QueryContext, 
  Ambiguity,
  LegalityConcept,
  RoleConcept,
  StrategyConcept,
  SetConcept,
  RarityConcept,
  TimeConcept,
  NameConcept,
  FlavorConcept,
  ArtistConcept
} from './types.js';
import { ColorPatternEngine } from './extractors/color-extractor.js';
import { ArchetypePatternEngine } from './extractors/archetype-extractor.js';
import { PricePatternEngine } from './extractors/price-extractor.js';
import { TypePatternEngine } from './extractors/type-extractor.js';
import { FormatPatternEngine } from './extractors/format-extractor.js';

/**
 * Main natural language parser that coordinates all extraction engines
 */
export class NaturalLanguageParser {
  private readonly colorEngine = new ColorPatternEngine();
  private readonly typeEngine = new TypePatternEngine();
  private readonly archetypeEngine = new ArchetypePatternEngine();
  private readonly priceEngine = new PricePatternEngine();
  private readonly formatEngine = new FormatPatternEngine();
  
  /**
   * Parse natural language query into structured concepts
   */
  parse(naturalQuery: string, context?: QueryContext): ParsedQuery {
    // Preprocess text
    const cleanedText = this.preprocessText(naturalQuery);
    
    // Extract all concepts
    const colors = this.colorEngine.extract(cleanedText);
    const types = this.typeEngine.extract(cleanedText);
    const subtypes = this.typeEngine.extractSubtypes(cleanedText);
    const archetypes = this.archetypeEngine.extract(cleanedText);
    const priceConstraints = this.priceEngine.extract(cleanedText);
    const formats = this.formatEngine.extract(cleanedText);
    
    // Extract additional concepts (placeholder implementations)
    const keywords = this.extractKeywords(cleanedText);
    const abilities = this.extractAbilities(cleanedText);
    const mechanics = this.extractMechanics(cleanedText);
    const manaCost = this.extractManaCost(cleanedText);
    const powerToughness = this.extractPowerToughness(cleanedText);
    const legality = this.extractLegality(cleanedText);
    const deckRoles = this.extractDeckRoles(cleanedText);
    const strategies = this.extractStrategies(cleanedText);
    const sets = this.extractSets(cleanedText);
    const rarity = this.extractRarity(cleanedText);
    const timeConstraints = this.extractTimeConstraints(cleanedText);
    const namePatterns = this.extractNamePatterns(cleanedText);
    const flavorText = this.extractFlavorText(cleanedText);
    const artist = this.extractArtist(cleanedText);
    
    // Resolve conflicts and calculate confidence
    const resolved = this.resolveConflicts({
      colors,
      types,
      subtypes,
      archetypes,
      priceConstraints,
      formats,
      keywords,
      abilities,
      mechanics,
      manaCost,
      powerToughness,
      legality,
      deckRoles,
      strategies,
      sets,
      rarity,
      timeConstraints,
      namePatterns,
      flavorText,
      artist
    });
    
    return {
      ...resolved,
      confidence: this.calculateOverallConfidence(resolved),
      ambiguities: this.detectAmbiguities(resolved, cleanedText),
      context: context || {}
    };
  }
  
  /**
   * Preprocess text for better pattern matching
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s$.-]/g, ' ') // Remove special chars except $, ., -
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();
  }
  
  /**
   * Extract keyword abilities (placeholder implementation)
   */
  private extractKeywords(text: string) {
    const keywords = ['flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 'first strike', 'double strike'];
    return keywords
      .filter(keyword => text.includes(keyword))
      .map(keyword => ({ keyword, confidence: 0.85 }));
  }
  
  /**
   * Extract complex abilities (placeholder implementation)
   */
  private extractAbilities(text: string) {
    const abilities = ['enters the battlefield', 'when dies', 'tap to add', 'sacrifice to'];
    return abilities
      .filter(ability => text.includes(ability))
      .map(ability => ({ ability, confidence: 0.80 }));
  }
  
  /**
   * Extract game mechanics (placeholder implementation)
   */
  private extractMechanics(text: string) {
    const mechanics = ['storm', 'cascade', 'flashback', 'madness', 'cycling'];
    return mechanics
      .filter(mechanic => text.includes(mechanic))
      .map(mechanic => ({ mechanic, confidence: 0.85 }));
  }
  
  /**
   * Extract mana cost constraints (placeholder implementation)
   */
  private extractManaCost(text: string) {
    const patterns = [
      /cmc\s*(\d+)/i,
      /mana cost\s*(\d+)/i,
      /costs?\s*(\d+)/i
    ];
    
    const constraints = [];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        constraints.push({
          exact: parseInt(match[1]),
          confidence: 0.80
        });
      }
    }
    
    return constraints;
  }
  
  /**
   * Extract power/toughness constraints (placeholder implementation)
   */
  private extractPowerToughness(text: string) {
    const patterns = [
      /power\s*(\d+)/i,
      /toughness\s*(\d+)/i,
      /(\d+)\/(\d+)/
    ];
    
    const constraints = [];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern.source.includes('power')) {
          constraints.push({
            stat: 'power' as const,
            exact: parseInt(match[1]),
            confidence: 0.85
          });
        } else if (pattern.source.includes('toughness')) {
          constraints.push({
            stat: 'toughness' as const,
            exact: parseInt(match[1]),
            confidence: 0.85
          });
        }
      }
    }
    
    return constraints;
  }
  
  /**
   * Placeholder implementations for remaining extractors
   */
  private extractLegality(_text: string): LegalityConcept[] { return []; }
  private extractDeckRoles(_text: string): RoleConcept[] { return []; }
  private extractStrategies(_text: string): StrategyConcept[] { return []; }
  private extractSets(_text: string): SetConcept[] { return []; }
  private extractRarity(_text: string): RarityConcept[] { return []; }
  private extractTimeConstraints(_text: string): TimeConcept[] { return []; }
  private extractNamePatterns(_text: string): NameConcept[] { return []; }
  private extractFlavorText(_text: string): FlavorConcept[] { return []; }
  private extractArtist(_text: string): ArtistConcept[] { return []; }
  
  /**
   * Resolve conflicts between extracted concepts
   */
  private resolveConflicts(concepts: any): ParsedQuery {
    // For now, return concepts as-is
    // TODO: Implement conflict resolution logic
    return {
      colors: this.resolveColorConflicts(concepts.colors),
      types: concepts.types,
      subtypes: concepts.subtypes,
      keywords: concepts.keywords,
      abilities: concepts.abilities,
      mechanics: concepts.mechanics,
      manaCost: concepts.manaCost,
      powerToughness: concepts.powerToughness,
      priceConstraints: concepts.priceConstraints,
      formats: concepts.formats,
      legality: concepts.legality,
      archetypes: concepts.archetypes,
      deckRoles: concepts.deckRoles,
      strategies: concepts.strategies,
      sets: concepts.sets,
      rarity: concepts.rarity,
      timeConstraints: concepts.timeConstraints,
      namePatterns: concepts.namePatterns,
      flavorText: concepts.flavorText,
      artist: concepts.artist,
      confidence: 0,
      ambiguities: [],
      context: {}
    };
  }
  
  /**
   * Resolve color conflicts (e.g., "red and blue" vs "only red")
   */
  private resolveColorConflicts(colors: any[]) {
    if (colors.length <= 1) return colors;
    
    // If we have both exact and inclusive, prefer exact
    const hasExact = colors.some(c => c.exact);
    const hasInclusive = colors.some(c => c.inclusive);
    
    if (hasExact && hasInclusive) {
      return colors.filter(c => c.exact);
    }
    
    return colors;
  }
  
  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(parsed: ParsedQuery): number {
    const conceptConfidences = [
      ...parsed.colors.map(c => c.confidence),
      ...parsed.types.map(t => t.confidence),
      ...parsed.archetypes.map(a => a.confidence),
      ...parsed.priceConstraints.map(p => p.confidence),
      ...parsed.formats.map(f => f.confidence)
    ];
    
    if (conceptConfidences.length === 0) return 0;
    
    // Weighted average with bias toward higher confidence concepts
    return conceptConfidences.reduce((sum, conf) => {
      const weight = Math.pow(conf, 1.5); // Higher confidence gets more weight
      return sum + (conf * weight);
    }, 0) / conceptConfidences.length;
  }
  
  /**
   * Detect ambiguities in the parsed query
   */
  private detectAmbiguities(parsed: ParsedQuery, _originalText: string): Ambiguity[] {
    const ambiguities: Ambiguity[] = [];
    
    // Check for color ambiguities
    if (parsed.colors.length > 1) {
      const colorNames = parsed.colors.map(c => c.colors.join('')).join(', ');
      ambiguities.push({
        type: 'color',
        description: `Multiple color interpretations found: ${colorNames}`,
        alternatives: parsed.colors.map(c => c.colors.join('')),
        confidence: 0.7
      });
    }
    
    // Check for format ambiguities
    if (parsed.formats.length > 1) {
      const formatNames = parsed.formats.map(f => f.name).join(', ');
      ambiguities.push({
        type: 'format',
        description: `Multiple format interpretations found: ${formatNames}`,
        alternatives: parsed.formats.map(f => f.name),
        confidence: 0.7
      });
    }
    
    return ambiguities;
  }
}
