import { describe, expect, it, vi, afterEach } from "vitest";
import { RateLimiter } from "../src/services/rate-limiter.js";

describe("RateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start the next queued operation until the prior one completes", async () => {
    const limiter = new RateLimiter(0, 3, 2, 100);
    const started: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = limiter.execute(async () => {
      started.push("first");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      return "done";
    });

    const second = limiter.execute(async () => {
      started.push("second");
      return "done";
    });

    await Promise.resolve();

    expect(started).toEqual(["first"]);

    releaseFirst?.();

    await expect(first).resolves.toBe("done");
    await expect(second).resolves.toBe("done");
    expect(started).toEqual(["first", "second"]);
  });

  it("applies updated backoff from a prior queued failure before starting the next request", async () => {
    vi.useFakeTimers();

    const limiter = new RateLimiter(10, 3, 2, 100);
    const baseTime = Date.now();
    const startedAt: number[] = [];

    const first = limiter.execute(async () => {
      startedAt.push(Date.now() - baseTime);
      limiter.recordError(429);
      return "failed";
    });

    const second = limiter.execute(async () => {
      startedAt.push(Date.now() - baseTime);
      return "ok";
    });

    await vi.advanceTimersByTimeAsync(0);
    await expect(first).resolves.toBe("failed");
    expect(startedAt).toEqual([0]);

    await vi.advanceTimersByTimeAsync(19);
    expect(startedAt).toEqual([0]);

    await vi.advanceTimersByTimeAsync(1);
    await expect(second).resolves.toBe("ok");
    expect(startedAt).toEqual([0, 20]);
  });
});
