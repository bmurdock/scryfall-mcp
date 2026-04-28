import { describe, expect, it } from 'vitest';
import { calculateLandCount } from '../src/tools/suggest-mana-base/planner.js';

describe('calculateLandCount for Brawl', () => {
  it('recommends Commander-like land counts for 100-card Historic Brawl', () => {
    expect(calculateLandCount({
      color_requirements: 'UR',
      deck_size: 100,
      format: 'brawl',
      strategy: 'combo',
      average_cmc: 2.7,
      budget: 'no_limit',
      special_requirements: [],
    })).toBe(38);
  });

  it('keeps Standard Brawl near 24 lands for 60-card decks', () => {
    expect(calculateLandCount({
      color_requirements: 'UR',
      deck_size: 60,
      format: 'standardbrawl',
      strategy: 'midrange',
      average_cmc: 3,
      budget: 'moderate',
      special_requirements: [],
    })).toBe(24);
  });
});
