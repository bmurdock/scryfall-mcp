import { describe, expect, it, vi } from "vitest";
import { BuildScryfallQueryTool } from "../src/tools/build-scryfall-query.js";

describe("BuildScryfallQueryTool", () => {
  it("uses only one live search when test_query is left enabled", async () => {
    const searchCards = vi.fn().mockResolvedValue({
      object: "list",
      total_cards: 12,
      has_more: false,
      data: [],
    });

    const tool = new BuildScryfallQueryTool({ searchCards } as never);
    await tool.execute({ natural_query: "blue counterspells under $5 for modern" });

    expect(searchCards).toHaveBeenCalledTimes(1);
  });
});
