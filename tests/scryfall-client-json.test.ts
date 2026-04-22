import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheService } from "../src/services/cache-service.js";
import { ScryfallClient } from "../src/services/scryfall-client.js";
import type { ScryfallCard, ScryfallSearchResponse } from "../src/types/scryfall-api.js";

function createCard(): ScryfallCard {
  return {
    object: "card",
    id: "card-1",
    oracle_id: "oracle-1",
    name: "Card 1",
    lang: "en",
    released_at: "2026-04-22",
    uri: "https://api.scryfall.com/cards/card-1",
    scryfall_uri: "https://scryfall.com/card/tst/1/card-1",
    layout: "normal",
    highres_image: true,
    image_status: "highres_scan",
    cmc: 1,
    type_line: "Creature — Test",
    colors: ["U"],
    color_identity: ["U"],
    keywords: [],
    legalities: {
      standard: "legal",
      future: "legal",
      historic: "legal",
      timeless: "legal",
      gladiator: "legal",
      pioneer: "legal",
      explorer: "legal",
      modern: "legal",
      legacy: "legal",
      pauper: "legal",
      vintage: "legal",
      penny: "legal",
      commander: "legal",
      oathbreaker: "legal",
      standardbrawl: "legal",
      brawl: "legal",
      historicbrawl: "legal",
      alchemy: "legal",
      paupercommander: "legal",
      duel: "legal",
      oldschool: "legal",
      premodern: "legal",
      predh: "legal",
    },
    games: ["paper"],
    reserved: false,
    foil: true,
    nonfoil: true,
    finishes: ["foil", "nonfoil"],
    oversized: false,
    promo: false,
    reprint: false,
    variation: false,
    set_id: "set-id",
    set: "tst",
    set_name: "Test Set",
    set_type: "expansion",
    set_uri: "https://api.scryfall.com/sets/tst",
    set_search_uri: "https://api.scryfall.com/cards/search?order=set&q=e%3Atst&unique=prints",
    scryfall_set_uri: "https://scryfall.com/sets/tst",
    rulings_uri: "https://api.scryfall.com/cards/card-1/rulings",
    prints_search_uri: "https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aoracle-1&unique=prints",
    collector_number: "1",
    digital: false,
    rarity: "common",
    border_color: "black",
    frame: "1993",
    full_art: false,
    textless: false,
    booster: true,
    story_spotlight: false,
    prices: {},
    related_uris: {},
  };
}

describe("ScryfallClient JSON parsing", () => {
  let cache: CacheService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cache = new CacheService(60_000, 100, 25);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cache.destroy();
    vi.unstubAllGlobals();
  });

  it("parses successful JSON responses without requiring response.clone()", async () => {
    const payload: ScryfallSearchResponse = {
      object: "list",
      total_cards: 1,
      has_more: false,
      data: [createCard()],
    };

    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(payload),
    });

    const client = new ScryfallClient(
      {
        execute: vi.fn(async (operation: () => Promise<unknown>) => operation()),
        recordSuccess: vi.fn(),
        recordError: vi.fn(),
        handleRateLimitResponse: vi.fn(),
        isCircuitOpen: vi.fn().mockReturnValue(false),
      } as never,
      cache
    );

    await expect(client.searchCards({ query: "type:creature", limit: 1, page: 1 })).resolves.toMatchObject({
      total_cards: 1,
      has_more: false,
    });
  });
});
