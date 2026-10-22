import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchFormatStaplesTool } from '../src/tools/search-format-staples.js';
import {
  calculateColorDistribution,
  generateLandRecommendations,
} from '../src/tools/suggest-mana-base/planner.js';
import { SuggestManaBaseTool } from '../src/tools/suggest-mana-base.js';

describe('mana color contract remediation', () => {
  it('respects an explicitly configured zero color intensity', () => {
    const distribution = calculateColorDistribution({
      color_requirements: 'WU',
      deck_size: 60,
      strategy: 'midrange',
      budget: 'moderate',
      special_requirements: [],
      color_intensity: { W: 0, U: 10 },
    }, 24);

    expect(distribution.W).toBe(0);
    expect(distribution.U).toBe(20);
  });

  it('rejects a color intensity configuration where every required color is zero', async () => {
    const result = await new SuggestManaBaseTool().execute({
      color_requirements: 'WU',
      color_intensity: { W: 0, U: 0 },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('At least one required color intensity must be greater than 0');
  });

  it('normalizes duplicate color requirements before planning', async () => {
    const result = await new SuggestManaBaseTool().execute({
      color_requirements: 'WWU',
      color_intensity: { W: 2, U: 1 },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Colors: WU');
    expect(result.content[0].text).not.toContain('Colors: WWU');
  });

  it('allocates recommendations to exactly the planned land total', async () => {
    const params = {
      color_requirements: 'WUB',
      deck_size: 60,
      strategy: 'midrange',
      budget: 'moderate',
      special_requirements: [],
      color_intensity: { W: 0, U: 2, B: 3 },
    } as const;
    const distribution = calculateColorDistribution(params, 24);
    const recommendations = await generateLandRecommendations(params, distribution);

    const total = [...recommendations.basics, ...recommendations.duals, ...recommendations.utility,
      ...recommendations.budget_alternatives]
      .reduce((sum, recommendation) => sum + recommendation.count, 0);

    expect(total).toBe(24);
  });
});

describe('format staples color identity contract remediation', () => {
  const client = { searchCards: vi.fn().mockResolvedValue({ total_cards: 0, has_more: false, data: [] }) };
  beforeEach(() => client.searchCards.mockClear());

  it.each([
    ['grixis', 'id:ubr'],
    ['naya', 'id:rgw'],
    ['c', 'id:c'],
    ['colorless', 'id:c'],
  ])('keeps supported color identity %s mapped to %s', async (colorIdentity, expectedFilter) => {
    const result = await new SearchFormatStaplesTool(client as never).execute({
      format: 'modern',
      color_identity: colorIdentity,
    });

    expect(result.isError).toBeUndefined();
    expect(client.searchCards).toHaveBeenLastCalledWith(expect.objectContaining({
      query: expect.stringContaining(expectedFilter),
    }));
  });

  it.each(['white', 'invalid', '', '   ', 0, false, []])('rejects unsupported color identity %s instead of dropping the constraint', async (colorIdentity) => {
    const result = await new SearchFormatStaplesTool(client as never).execute({
      format: 'modern',
      color_identity: colorIdentity,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Color identity must be a supported color or color combination');
    expect(client.searchCards).not.toHaveBeenCalled();
  });
});
