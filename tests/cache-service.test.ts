import { afterEach, describe, expect, it } from "vitest";
import { CacheService } from "../src/services/cache-service.js";

describe("CacheService", () => {
  const caches: CacheService[] = [];

  afterEach(() => {
    caches.forEach((cache) => cache.destroy());
    caches.length = 0;
  });

  it("decrements memory usage when an expired entry is removed via get", async () => {
    const cache = new CacheService(60_000, 100, 10);
    caches.push(cache);

    cache.set("expired-key", { payload: "x".repeat(100_000) }, 5);
    const beforeExpiry = cache.getStats();

    expect(beforeExpiry.size).toBe(1);
    expect(beforeExpiry.memoryUsage).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(cache.get("expired-key")).toBeNull();

    const afterExpiry = cache.getStats();
    expect(afterExpiry.size).toBe(0);
    expect(afterExpiry.memoryUsage).toBe(0);
  });

  it("reuses the stored entry size instead of reserializing cached objects on delete", () => {
    const cache = new CacheService(60_000, 100, 10);
    caches.push(cache);

    let serializeCount = 0;
    const payload = {
      value: "cached",
      toJSON() {
        serializeCount++;
        return { value: "cached" };
      },
    };

    cache.set("json-key", payload, 60_000);
    expect(serializeCount).toBe(1);

    cache.delete("json-key");
    expect(serializeCount).toBe(1);
    expect(cache.getStats().memoryUsage).toBe(0);
  });
});
