import { describe, expect, it } from "vitest";
import { collectRequestedWindow } from "../src/services/search-window.js";

describe("collectRequestedWindow", () => {
  it("drops skipped cards before storing the requested slice", () => {
    const result = collectRequestedWindow(
      [
        { data: ["a", "b", "c", "d"], has_more: true, warnings: [] },
        { data: ["e", "f"], has_more: false, warnings: ["warn"] },
      ],
      2,
      3
    );

    expect(result.data).toEqual(["c", "d", "e"]);
    expect(result.warnings).toEqual(["warn"]);
  });
});
