import { describe, expect, it } from 'vitest';
import { BuildScryfallQueryTool } from '../src/tools/build-scryfall-query.js';

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
});
