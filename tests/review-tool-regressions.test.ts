import { describe, expect, it } from 'vitest';
import { BuildScryfallQueryTool } from '../src/tools/build-scryfall-query.js';
import { SuggestManaBaseTool } from '../src/tools/suggest-mana-base.js';
import { formatResultsWithSynergyExplanations } from '../src/tools/find-synergistic-cards/result-formatter.js';
import type { SynergyCard } from '../src/tools/find-synergistic-cards/types.js';

describe('reviewed tool contracts', () => {
  it.each([
    ['red or blue creatures', '(c:r OR c:u)'],
    ['red or blue or green creatures', '(c:r OR c:u OR c:g)'],
    ['3/3 creatures', 'pow=3 tou=3'],
    ['2/5 creatures', 'pow=2 tou=5'],
  ])('preserves explicit constraints in %s', async (natural_query, expected) => {
    const result = await new BuildScryfallQueryTool({} as never).execute({ natural_query });
    const query = result.content[0].text.match(/`([^`]+)`/)?.[1];
    expect(query).toContain(expected);
    expect(result.isError).toBeUndefined();
  });

  it('keeps a color conjunction distinct from alternatives', async () => {
    const result = await new BuildScryfallQueryTool({} as never).execute({ natural_query: 'red and blue creatures' });
    const query = result.content[0].text.match(/`([^`]+)`/)?.[1];
    expect(query).not.toContain('c:r OR c:u');
    expect(query).toMatch(/c:(?:>=)?ru/);
  });

  it.each(['commander', 'brawl', 'standardbrawl', 'modern', undefined])(
    'accounts for every recommended land in %s', async format => {
      const result = await new SuggestManaBaseTool().execute({ color_requirements: 'WUBRG', deck_size: 100, format });
      const text = result.content[0].text;
      const declared = Number(text.match(/Total Lands: (\d+)/)?.[1]);
      const listed = [...text.matchAll(/• (\d+)x /g)].reduce((sum, match) => sum + Number(match[1]), 0);
      expect(listed).toBe(declared);
      expect(result.isError).toBeUndefined();
    }
  );

  it.each(['enters_untapped', 'basic_types', 'nonbasic_hate_protection', 'utility_lands', 'combo_lands', ' UTILITY_LANDS '])(
    'explicitly rejects unsupported %s requirements', async requirement => {
      const tool = new SuggestManaBaseTool();
      const result = await tool.execute({ color_requirements: 'WU', budget: 'budget', special_requirements: [requirement] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not supported');
      expect(result.content[0].text).not.toContain('4x Taplands');
      expect(tool.inputSchema.properties).not.toHaveProperty('special_requirements');
    }
  );

  it.each(['semantic', 'exact', 'thematic'] as const)('renders all selected %s synergies', layer => {
    const cards = Array.from({ length: 50 }, (_, i) => ({
      name: `Candidate ${i}`, _synergy_layer: layer, prices: {},
    } as SynergyCard));
    const text = formatResultsWithSynergyExplanations({ object: 'list', total_cards: 50, has_more: false, data: cards }, null, 'theme');
    expect([...text.matchAll(/• \*\*Candidate /g)]).toHaveLength(50);
  });
});
