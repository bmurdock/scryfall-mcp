import { describe, expect, it } from "vitest";
import { isJsonStructureWithinLimit } from "../src/utils/request-limits.js";

describe("JSON structural validation budget", () => {
  it("allows primitive and empty JSON values", () => {
    for (const value of [null, true, 1, "value", [], {}]) {
      expect(isJsonStructureWithinLimit(value, 0)).toBe(true);
    }
  });

  it("allows the exact element budget and rejects one more", () => {
    expect(isJsonStructureWithinLimit([1, 2, 3], 3)).toBe(true);
    expect(isJsonStructureWithinLimit([1, 2, 3, 4], 3)).toBe(false);
  });

  it("counts nested object keys and array elements together", () => {
    const input = { args: { items: [1, 2], extra: null } };
    expect(isJsonStructureWithinLimit(input, 5)).toBe(true);
    expect(isJsonStructureWithinLimit(input, 4)).toBe(false);
  });
});
