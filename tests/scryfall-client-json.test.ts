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
  let rateLimiter: {
    execute: ReturnType<typeof vi.fn>;
    recordSuccess: ReturnType<typeof vi.fn>;
    recordError: ReturnType<typeof vi.fn>;
    handleRateLimitResponse: ReturnType<typeof vi.fn>;
    isCircuitOpen: ReturnType<typeof vi.fn>;
  };

  function createClient(): ScryfallClient {
    return new ScryfallClient(rateLimiter as never, cache);
  }

  beforeEach(() => {
    cache = new CacheService(60_000, 100, 25);
    fetchMock = vi.fn();
    rateLimiter = {
      execute: vi.fn(async (operation: () => Promise<unknown>) => operation()),
      recordSuccess: vi.fn(),
      recordError: vi.fn(),
      handleRateLimitResponse: vi.fn(),
      isCircuitOpen: vi.fn().mockReturnValue(false),
    };
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

    const client = createClient();

    await expect(client.searchCards({ query: "type:creature", limit: 1, page: 1 })).resolves.toMatchObject({
      total_cards: 1,
      has_more: false,
    });
  });

  it("reuses cached card details for equivalent name casing and whitespace", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(createCard()),
    });

    const client = createClient();

    await client.getCard({ identifier: " Lightning Bolt " });
    await client.getCard({ identifier: "lightning bolt" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses fuzzy card lookup by default", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(createCard()),
    });

    const client = createClient();

    await client.getCard({ identifier: "Lightning Bolt" });

    const url = new URL(fetchMock.mock.calls[0][0].toString());
    expect(url.pathname).toBe("/cards/named");
    expect(url.searchParams.get("fuzzy")).toBe("Lightning Bolt");
    expect(url.searchParams.has("exact")).toBe(false);
  });

  it("uses exact card lookup when requested", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(createCard()),
    });

    const client = createClient();

    await client.getCard({ identifier: "Lightning Bolt", match: "exact" });

    const url = new URL(fetchMock.mock.calls[0][0].toString());
    expect(url.pathname).toBe("/cards/named");
    expect(url.searchParams.get("exact")).toBe("Lightning Bolt");
    expect(url.searchParams.has("fuzzy")).toBe(false);
  });

  it("does not reuse cached card details across exact and fuzzy lookup modes", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(createCard()),
    });

    const client = createClient();

    await client.getCard({ identifier: "Lightning Bolt", match: "exact" });
    await client.getCard({ identifier: "Lightning Bolt" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[0][0].toString()).searchParams.has("exact")).toBe(true);
    expect(new URL(fetchMock.mock.calls[1][0].toString()).searchParams.has("fuzzy")).toBe(true);
  });

  it("coalesces concurrent equivalent card lookups", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(createCard()),
    });

    const client = createClient();

    await Promise.all([
      client.getCard({ identifier: "Lightning Bolt" }),
      client.getCard({ identifier: " lightning bolt " }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps in-flight exact and fuzzy card lookups distinct", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(createCard()),
    });

    const client = createClient();

    await Promise.all([
      client.getCard({ identifier: "Lightning Bolt", match: "exact" }),
      client.getCard({ identifier: "Lightning Bolt" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [404, "not_found"],
    [422, "invalid_query"],
  ])("does not count expected HTTP %s responses as transient failures", async (status, code) => {
    fetchMock.mockResolvedValue({
      status,
      ok: false,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        object: "error",
        code,
        details: "User-correctable request error",
      }),
    });

    const client = createClient();

    await expect(client.searchCards({ query: "type:creature", limit: 1 })).rejects.toThrow(
      "User-correctable request error"
    );
    expect(rateLimiter.recordError).not.toHaveBeenCalled();
    expect(rateLimiter.handleRateLimitResponse).not.toHaveBeenCalled();
  });

  it.each([
    [429, "rate_limited"],
    [500, "server_error"],
  ])("counts transient HTTP %s responses as service failures", async (status, code) => {
    fetchMock.mockResolvedValue({
      status,
      ok: false,
      headers: new Headers(status === 429 ? { "retry-after": "1" } : undefined),
      json: vi.fn().mockResolvedValue({
        object: "error",
        code,
        details: "Transient Scryfall failure",
      }),
    });

    const client = createClient();

    await expect(client.searchCards({ query: "type:creature", limit: 1 })).rejects.toThrow();
    expect(rateLimiter.recordError).toHaveBeenCalledWith(status);
    if (status === 429) {
      expect(rateLimiter.handleRateLimitResponse).toHaveBeenCalledWith("1");
    }
  });

  it("counts network failures as transient failures", async () => {
    fetchMock.mockRejectedValue(new Error("socket closed"));

    const client = createClient();

    await expect(client.searchCards({ query: "type:creature", limit: 1 })).rejects.toThrow(
      "Network error: socket closed"
    );
    expect(rateLimiter.recordError).toHaveBeenCalledWith();
  });
});
