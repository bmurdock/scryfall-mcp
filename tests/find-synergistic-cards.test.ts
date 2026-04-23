import { describe, expect, it, vi } from "vitest";
import { FindSynergisticCardsTool } from "../src/tools/find-synergistic-cards.js";
import { formatResultsWithSynergyExplanations } from "../src/tools/find-synergistic-cards/result-formatter.js";
import { ScryfallAPIError } from "../src/types/mcp-types.js";
import type { SynergyCard } from "../src/tools/find-synergistic-cards/types.js";

function createCard(id: string, layer?: SynergyCard["_synergy_layer"]): SynergyCard {
  return {
    object: "card",
    id,
    oracle_id: `${id}-oracle`,
    name: `Card ${id.toUpperCase()}`,
    lang: "en",
    released_at: "2024-01-01",
    uri: `https://api.scryfall.com/cards/${id}`,
    scryfall_uri: `https://scryfall.com/card/tst/${id}`,
    layout: "normal",
    highres_image: false,
    image_status: "missing",
    cmc: 2,
    type_line: "Artifact",
    colors: [],
    color_identity: [],
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
    foil: false,
    nonfoil: true,
    finishes: ["nonfoil"],
    oversized: false,
    promo: false,
    reprint: false,
    variation: false,
    set_id: "set-id",
    set: "tst",
    set_name: "Test Set",
    set_type: "expansion",
    set_uri: "https://api.scryfall.com/sets/tst",
    set_search_uri: "https://api.scryfall.com/cards/search?q=e%3Atst",
    scryfall_set_uri: "https://scryfall.com/sets/tst",
    rulings_uri: `https://api.scryfall.com/cards/${id}/rulings`,
    prints_search_uri: `https://api.scryfall.com/cards/search?order=released&q=oracleid%3A${id}-oracle&unique=prints`,
    collector_number: id,
    digital: false,
    rarity: "rare",
    border_color: "black",
    frame: "2015",
    full_art: false,
    textless: false,
    booster: true,
    story_spotlight: false,
    prices: {},
    _synergy_layer: layer,
  };
}

describe("FindSynergisticCardsTool", () => {
  it("stops searching once the first query already returns enough unique results", async () => {
    const searchCards = vi.fn().mockResolvedValueOnce({
      object: "list",
      total_cards: 2,
      has_more: false,
      data: [createCard("a"), createCard("b")],
    });

    const tool = new FindSynergisticCardsTool({
      getCard: vi.fn().mockRejectedValue(new ScryfallAPIError("not found", 404, "not_found")),
      searchCards,
    } as never);

    await tool.execute({ focus_card: "artifact token theme", limit: 2 });

    expect(searchCards).toHaveBeenCalledTimes(1);
  });
});

describe("formatResultsWithSynergyExplanations", () => {
  it("groups layered results without repeated filtering changing visible output", () => {
    const output = formatResultsWithSynergyExplanations(
      {
        object: "list",
        total_cards: 3,
        has_more: false,
        data: [
          createCard("semantic", "semantic"),
          createCard("exact", "exact"),
          createCard("theme", "thematic"),
        ],
      },
      null,
      "artifact token theme"
    );

    expect(output).toContain("Strategic Synergies");
    expect(output).toContain("Mechanical Synergies");
    expect(output).toContain("Thematic Support");
    expect(output).toContain("Card SEMANTIC");
    expect(output).toContain("Card EXACT");
    expect(output).toContain("Card THEME");
  });
});
