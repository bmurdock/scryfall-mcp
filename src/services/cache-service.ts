import { CacheEntry, CACHE_DURATIONS } from '../types/mcp-types.js';
import { EnvValidators } from '../utils/env-parser.js';

/**
 * In-memory cache service with TTL support and size limits
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout;
  private readonly maxSize: number;
  private readonly maxMemoryBytes: number;
  private currentMemoryUsage = 0;

  constructor(
    private cleanupIntervalMs: number = 5 * 60 * 1000, // 5 minutes
    maxSize: number = EnvValidators.cacheMaxSize(process.env.CACHE_MAX_SIZE),
    maxMemoryMB: number = EnvValidators.cacheMaxMemoryMB(process.env.CACHE_MAX_MEMORY_MB)
  ) {
    this.maxSize = maxSize;
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    
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
   * Sets a value in cache with TTL and enforces size limits
   */
  set<T>(key: string, value: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl
    };

    // Calculate entry size
    const entrySize = this.calculateEntrySize(key, entry);
    
    // Check if adding this entry would exceed limits
    if (this.cache.size >= this.maxSize || 
        this.currentMemoryUsage + entrySize > this.maxMemoryBytes) {
      this.evictLRU();
    }

    // Remove existing entry if updating
    if (this.cache.has(key)) {
      const existingEntry = this.cache.get(key)!;
      this.currentMemoryUsage -= this.calculateEntrySize(key, existingEntry);
    }

    this.cache.set(key, entry);
    this.currentMemoryUsage += entrySize;
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
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemoryUsage -= this.calculateEntrySize(key, entry);
    }
    return this.cache.delete(key);
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.currentMemoryUsage = 0;
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
    maxSize: number;
    maxMemoryBytes: number;
    memoryUtilization: number;
    sizeUtilization: number;
  } {
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const [, entry] of this.cache.entries()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      hitRate: this.hitRate,
      memoryUsage: this.currentMemoryUsage,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp,
      maxSize: this.maxSize,
      maxMemoryBytes: this.maxMemoryBytes,
      memoryUtilization: this.maxMemoryBytes > 0 ? this.currentMemoryUsage / this.maxMemoryBytes : 0,
      sizeUtilization: this.maxSize > 0 ? this.cache.size / this.maxSize : 0
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

    keysToDelete.forEach(key => {
      const entry = this.cache.get(key);
      if (entry) {
        this.currentMemoryUsage -= this.calculateEntrySize(key, entry);
      }
      this.cache.delete(key);
    });
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
    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      if (entry) {
        this.currentMemoryUsage -= this.calculateEntrySize(key, entry);
      }
      this.cache.delete(key);
    }
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
   * Removed legacy persistence helpers (export/import/preload) as unused
   */

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
  static createSearchKey(
    query: string,
    page = 1,
    limit = 20,
    unique?: string,
    direction?: string,
    include_multilingual?: boolean,
    include_variations?: boolean,
    price_range?: { min?: number; max?: number; currency?: string }
  ): string {
    const params = [query, page, limit];
    if (unique && unique !== 'cards') params.push(`unique:${unique}`);
    if (direction && direction !== 'auto') params.push(`dir:${direction}`);
    if (include_multilingual) params.push('multilingual');
    if (include_variations) params.push('variations');
    if (price_range) {
      const priceStr = `price:${price_range.min || 0}-${price_range.max || 'inf'}:${price_range.currency || 'usd'}`;
      params.push(priceStr);
    }
    return `search:${params.join(':')}`;
  }

  /**
   * Creates a cache key for card details
   */
  static createCardKey(identifier: string, set?: string, lang = 'en'): string {
    return `card:${identifier}:${set || 'any'}:${lang}`;
  }

  /**
   * Creates a cache key for card prices
   */
  static createPriceKey(cardId: string, currency = 'usd'): string {
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

  /**
   * Calculates the approximate size of a cache entry in bytes
   */
  private calculateEntrySize(key: string, entry: CacheEntry<unknown>): number {
    try {
      // Estimate size by JSON serialization length * 2 (for UTF-16 encoding)
      const dataSize = JSON.stringify(entry.data).length * 2;
      const keySize = key.length * 2;
      const metadataSize = 24; // timestamp (8) + ttl (8) + overhead (8)
      return dataSize + keySize + metadataSize;
    } catch {
      // Fallback for non-serializable data
      return 1000; // Conservative estimate
    }
  }

  /**
   * Evicts the least recently used entries to make room for new ones
   */
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    // Remove oldest entries until we're under the limits
    const targetSize = Math.floor(this.maxSize * 0.8); // Remove 20% when limit reached
    const targetMemory = Math.floor(this.maxMemoryBytes * 0.8);
    
    for (const [key, entry] of entries) {
      if (this.cache.size <= targetSize && this.currentMemoryUsage <= targetMemory) {
        break;
      }
      
      this.currentMemoryUsage -= this.calculateEntrySize(key, entry);
      this.cache.delete(key);
    }
  }
}
