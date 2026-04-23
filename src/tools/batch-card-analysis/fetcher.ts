import { ScryfallClient } from '../../services/scryfall-client.js';
import { ScryfallAPIError, ValidationError } from '../../types/mcp-types.js';
import { ScryfallCard } from '../../types/scryfall-api.js';

const DEFAULT_CONCURRENCY = 4;

interface FetchCardsMapOptions {
  concurrency?: number;
  skipNotFound?: boolean;
}

export function uniqueInOrder(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function fetchCardMapWithConcurrency(
  scryfallClient: ScryfallClient,
  cardList: string[],
  options: FetchCardsMapOptions = {}
): Promise<Map<string, ScryfallCard>> {
  const cards = new Map<string, ScryfallCard>();
  const notFound: string[] = [];
  let nextIndex = 0;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const workerCount = Math.min(Math.max(1, concurrency), cardList.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < cardList.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const cardName = cardList[currentIndex];

      try {
        const card = await scryfallClient.getCard({ identifier: cardName });
        cards.set(cardName, card);
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

  if (notFound.length > 0 && !options.skipNotFound) {
    throw new ValidationError(`Cards not found: ${notFound.join(', ')}`);
  }

  return cards;
}

export async function fetchCardsWithConcurrency(
  scryfallClient: ScryfallClient,
  cardList: string[],
  concurrency = DEFAULT_CONCURRENCY
): Promise<ScryfallCard[]> {
  const uniqueCardList = uniqueInOrder(cardList);
  const cardMap = await fetchCardMapWithConcurrency(scryfallClient, uniqueCardList, { concurrency });

  return cardList.flatMap(cardName => {
    const card = cardMap.get(cardName);
    return card ? [card] : [];
  });
}
