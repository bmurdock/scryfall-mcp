import { CacheEntry, CACHE_DURATIONS } from '../types/mcp-types.js';

/**
 * In-memory cache service with TTL support
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private cleanupIntervalMs: number = 5 * 60 * 1000) { // 5 minutes
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Gets a value from cache if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Sets a value in cache with TTL
   */
  set<T>(key: string, value: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl
    };

    this.cache.set(key, entry);
  }

  /**
   * Sets a value with predefined TTL based on data type
   */
  setWithType<T>(key: string, value: T, type: keyof typeof CACHE_DURATIONS): void {
    const ttl = CACHE_DURATIONS[type];
    this.set(key, value, ttl);
  }

  /**
   * Checks if a key exists and hasn't expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Deletes a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const now = Date.now();
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
      
      // Rough estimate of memory usage
      totalSize += JSON.stringify(entry).length + key.length;
    }

    return {
      size: this.cache.size,
      hitRate: this.hitRate,
      memoryUsage: totalSize,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp
    };
  }

  /**
   * Removes expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Gets all keys matching a pattern
   */
  getKeysMatching(pattern: RegExp): string[] {
    return Array.from(this.cache.keys()).filter(key => pattern.test(key));
  }

  /**
   * Invalidates all cache entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    const keysToDelete = this.getKeysMatching(pattern);
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }

  /**
   * Gets the remaining TTL for a key in milliseconds
   */
  getTTL(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const elapsed = Date.now() - entry.timestamp;
    const remaining = entry.ttl - elapsed;
    
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Updates the TTL for an existing key
   */
  updateTTL(key: string, newTtl: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    entry.ttl = newTtl;
    entry.timestamp = Date.now(); // Reset timestamp
    return true;
  }

  /**
   * Gets cache hit rate (requires tracking hits/misses)
   */
  private hitCount = 0;
  private missCount = 0;

  private get hitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  /**
   * Enhanced get method that tracks hit/miss statistics
   */
  getWithStats<T>(key: string): T | null {
    const result = this.get<T>(key);
    
    if (result !== null) {
      this.hitCount++;
    } else {
      this.missCount++;
    }

    return result;
  }

  /**
   * Resets hit/miss statistics
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Preloads cache with bulk data
   */
  preload<T>(entries: Array<{ key: string; value: T; ttl?: number }>): void {
    entries.forEach(({ key, value, ttl = CACHE_DURATIONS.card_details }) => {
      this.set(key, value, ttl);
    });
  }

  /**
   * Exports cache data for persistence (if needed)
   */
  export(): Array<{ key: string; entry: CacheEntry<any> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry
    }));
  }

  /**
   * Imports cache data from persistence (if needed)
   */
  import(data: Array<{ key: string; entry: CacheEntry<any> }>): void {
    const now = Date.now();
    
    data.forEach(({ key, entry }) => {
      // Only import non-expired entries
      if (now - entry.timestamp <= entry.ttl) {
        this.cache.set(key, entry);
      }
    });
  }

  /**
   * Cleanup on service destruction
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }

  /**
   * Creates a cache key for search queries
   */
  static createSearchKey(query: string, page: number = 1, limit: number = 20): string {
    return `search:${query}:${page}:${limit}`;
  }

  /**
   * Creates a cache key for card details
   */
  static createCardKey(identifier: string, set?: string, lang: string = 'en'): string {
    return `card:${identifier}:${set || 'any'}:${lang}`;
  }

  /**
   * Creates a cache key for card prices
   */
  static createPriceKey(cardId: string, currency: string = 'usd'): string {
    return `price:${cardId}:${currency}`;
  }

  /**
   * Creates a cache key for sets
   */
  static createSetKey(query?: string, type?: string): string {
    return `sets:${query || 'all'}:${type || 'all'}`;
  }

  /**
   * Creates a cache key for bulk data
   */
  static createBulkKey(type: string): string {
    return `bulk:${type}`;
  }
}
