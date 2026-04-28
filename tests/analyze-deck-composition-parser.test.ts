import { describe, expect, it } from 'vitest';
import { AnalyzeDeckCompositionTool, parseDeckListEntries } from '../src/tools/analyze-deck-composition.js';

const islandCard = {
  id: 'island',
  name: 'Island',
  cmc: 0,
  type_line: 'Basic Land - Island',
  prices: { usd: '0.01' },
  rarity: 'common',
  color_identity: [],
};

const optCard = {
  id: 'opt',
  name: 'Opt',
  cmc: 1,
  type_line: 'Instant',
  prices: { usd: '0.05' },
  rarity: 'common',
  color_identity: ['U'],
};

describe('parseDeckListEntries', () => {
  it('preserves commas inside card names', () => {
    expect(parseDeckListEntries('1 Baral, Chief of Compliance\n1 Ral, Storm Conduit')).toEqual([
      { name: 'Baral, Chief of Compliance', quantity: 1 },
      { name: 'Ral, Storm Conduit', quantity: 1 },
    ]);
  });

  it('strips Arena set and collector suffixes', () => {
    expect(parseDeckListEntries('Commander\n1 Sanar, Unfinished Genius (SOS) 223\n\nDeck\n5 Island (SOS) 274')).toEqual([
      { name: 'Sanar, Unfinished Genius', quantity: 1 },
      { name: 'Island', quantity: 5 },
    ]);
  });
});

describe('AnalyzeDeckCompositionTool Brawl land recommendations', () => {
  it('does not recommend reducing realistic 100-card Brawl land counts', async () => {
    const client = {
      getCard: async ({ identifier }: { identifier: string }) => identifier === 'Island' ? islandCard : optCard,
    };
    const tool = new AnalyzeDeckCompositionTool(client as never);

    const result = await tool.execute({
      deck_list: '38 Island\n62 Opt',
      format: 'brawl',
      strategy: 'combo',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Total Cards: 100');
    expect(result.content[0].text).toContain('lands: 38');
    expect(result.content[0].text).not.toContain('Consider reducing lands');
  });
});
