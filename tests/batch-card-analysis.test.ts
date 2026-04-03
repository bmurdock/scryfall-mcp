import { describe, expect, it, vi } from 'vitest';
import { fetchCardsWithConcurrency } from '../src/tools/batch-card-analysis/fetcher.js';
import { ScryfallAPIError } from '../src/types/mcp-types.js';

describe('fetchCardsWithConcurrency', () => {
  it('limits in-flight card fetches to the configured concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const mockClient = {
      getCard: vi.fn(async ({ identifier }: { identifier: string }) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise(resolve => setTimeout(resolve, 10));
        inFlight -= 1;

        return {
          id: identifier,
          name: identifier,
          mana_cost: '',
          type_line: 'Instant',
          oracle_text: '',
          cmc: 1,
          legalities: { modern: 'legal' },
          prices: { usd: '1.00' },
          color_identity: ['R']
        };
      })
    };

    const cards = await fetchCardsWithConcurrency(
      mockClient as never,
      ['A', 'B', 'C', 'D', 'E', 'F'],
      2
    );

    expect(cards).toHaveLength(6);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('aggregates missing cards into a validation error', async () => {
    const mockClient = {
      getCard: vi.fn(async ({ identifier }: { identifier: string }) => {
        if (identifier === 'Missing Card') {
          throw new ScryfallAPIError('Not found', 404);
        }

        return {
          id: identifier,
          name: identifier,
          mana_cost: '',
          type_line: 'Instant',
          oracle_text: '',
          cmc: 1,
          legalities: { modern: 'legal' },
          prices: { usd: '1.00' },
          color_identity: ['R']
        };
      })
    };

    await expect(
      fetchCardsWithConcurrency(
        mockClient as never,
        ['Lightning Bolt', 'Missing Card'],
        2
      )
    ).rejects.toThrow('Cards not found: Missing Card');
  });
});
