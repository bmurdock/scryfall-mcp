import { ScryfallClient } from '../../services/scryfall-client.js';
import { ScryfallAPIError, ValidationError } from '../../types/mcp-types.js';
import { ScryfallCard } from '../../types/scryfall-api.js';

const DEFAULT_CONCURRENCY = 4;

export async function fetchCardsWithConcurrency(
  scryfallClient: ScryfallClient,
  cardList: string[],
  concurrency = DEFAULT_CONCURRENCY
): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = [];
  const notFound: string[] = [];
  let nextIndex = 0;

  const workerCount = Math.min(Math.max(1, concurrency), cardList.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < cardList.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const cardName = cardList[currentIndex];

      try {
        const card = await scryfallClient.getCard({ identifier: cardName });
        cards[currentIndex] = card;
      } catch (error) {
        if (error instanceof ScryfallAPIError && error.status === 404) {
          notFound.push(cardName);
          continue;
        }

        throw error;
      }
    }
  });

  await Promise.all(workers);

  if (notFound.length > 0) {
    throw new ValidationError(`Cards not found: ${notFound.join(', ')}`);
  }

  return cards.filter(Boolean);
}
