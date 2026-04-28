import { describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../src/services/rate-limiter.js";

describe("RateLimiter 429 handling", () => {
  it("does not open the circuit after one retry-after response", async () => {
    vi.useFakeTimers();
    try {
      const limiter = new RateLimiter(100, 3, 2, 1_000);
      const waiting = limiter.handleRateLimitResponse("1");

      await vi.advanceTimersByTimeAsync(1_000);
      await waiting;

      expect(limiter.isCircuitOpen()).toBe(false);
      expect(limiter.getStatus().consecutiveErrors).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
