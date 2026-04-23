import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetDatabaseResource } from "../src/resources/set-database.js";
import { CacheService } from "../src/services/cache-service.js";
import type { ScryfallSet } from "../src/types/scryfall-api.js";

function createSet(overrides: Partial<ScryfallSet> = {}): ScryfallSet {
  return {
    object: "set",
    id: "set-id",
    code: "tst",
    name: "Test Set",
    set_type: "expansion",
    released_at: "2024-01-01",
    card_count: 200,
    digital: false,
    foil_only: false,
    nonfoil_only: false,
    scryfall_uri: "https://scryfall.com/sets/tst",
    uri: "https://api.scryfall.com/sets/tst",
    icon_svg_uri: "https://svgs.scryfall.io/sets/default.svg",
    search_uri: "https://api.scryfall.com/cards/search?q=e%3Atst",
    ...overrides,
  };
}

describe("SetDatabaseResource", () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService(60_000, 100, 25);
  });

  afterEach(() => {
    cache.destroy();
    vi.restoreAllMocks();
  });

  it("filters sets without routing through getData serialization", async () => {
    const resource = new SetDatabaseResource(
      {
        getSets: vi.fn().mockResolvedValue([
          createSet(),
          createSet({ id: "set-2", code: "dig", name: "Digital Set", digital: true, set_type: "alchemy" }),
        ]),
      } as never,
      cache
    );

    vi.spyOn(resource, "getData").mockRejectedValue(new Error("getData should not be called"));

    const result = await resource.getFilteredSets({ digital: true });
    const parsed = JSON.parse(result);

    expect(parsed.total_sets).toBe(1);
    expect(parsed.data[0].name).toBe("Digital Set");
  });

  it("shares string-based release filtering with the client path", async () => {
    const resource = new SetDatabaseResource(
      {
        getSets: vi.fn().mockResolvedValue([
          createSet({ id: "set-old", code: "old", name: "Old Set", released_at: "2020-01-01" }),
          createSet({ id: "set-new", code: "new", name: "New Set", released_at: "2025-01-01" }),
        ]),
      } as never,
      cache
    );

    const result = await resource.getFilteredSets({ released_after: "2024-01-01" });
    const parsed = JSON.parse(result);

    expect(parsed.total_sets).toBe(1);
    expect(parsed.data.map((set: ScryfallSet) => set.code)).toEqual(["new"]);
  });

  it("collects set types from cached set models without parsing the serialized payload", async () => {
    const resource = new SetDatabaseResource(
      {
        getSets: vi.fn().mockResolvedValue([
          createSet(),
          createSet({ id: "set-2", code: "cmd", set_type: "commander" }),
          createSet({ id: "set-3", code: "alc", set_type: "alchemy" }),
        ]),
      } as never,
      cache
    );

    vi.spyOn(resource, "getData").mockRejectedValue(new Error("getData should not be called"));

    await expect(resource.getSetTypes()).resolves.toEqual(["alchemy", "commander", "expansion"]);
  });

  it("caches the serialized payload and returns the prebuilt snapshot on warm reads", async () => {
    const getSets = vi.fn().mockResolvedValue([
      createSet(),
      createSet({ id: "set-2", code: "cmd", set_type: "commander" }),
    ]);

    const resource = new SetDatabaseResource(
      {
        getSets,
      } as never,
      cache
    );

    const first = await resource.getData();
    const second = await resource.getData();

    expect(getSets).toHaveBeenCalledTimes(1);
    expect(typeof second).toBe("string");
    expect(first).toBe(second);
    expect(JSON.parse(second).total_sets).toBe(2);
    expect(JSON.parse(second).source).toBeUndefined();
  });

  it("keeps icon_svg_uri without downloading and embedding icon payloads", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resource = new SetDatabaseResource(
      {
        getSets: vi.fn().mockResolvedValue([
          createSet({ icon_svg_uri: "https://svgs.scryfall.io/sets/tst.svg" }),
        ]),
      } as never,
      cache
    );

    const payload = JSON.parse(await resource.getData());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.data[0].icon_svg_uri).toBe("https://svgs.scryfall.io/sets/tst.svg");
    expect(payload.data[0].icon_base64).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
