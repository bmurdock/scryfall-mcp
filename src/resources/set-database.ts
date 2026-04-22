import { ScryfallClient } from '../services/scryfall-client.js';
import { CacheService } from '../services/cache-service.js';
import { ScryfallSet } from '../types/scryfall-api.js';
import { ScryfallAPIError } from '../types/mcp-types.js';
import { mcpLogger } from '../services/logger.js';

type SetSnapshotMetadata = {
  updatedAt: string;
  totalSets: number;
};

const SET_DATA_KEY = CacheService.createSetKey();
const SET_PAYLOAD_KEY = CacheService.createSetKey('serialized');
const SET_METADATA_KEY = CacheService.createSetKey('metadata');

/**
 * MCP Resource for accessing set database
 */
export class SetDatabaseResource {
  readonly uri = 'set-database://all';
  readonly name = 'Set Database';
  readonly description = 'Complete Magic: The Gathering sets database with metadata and icons';
  readonly mimeType = 'application/json';

  private lastUpdateCheck = 0;
  private readonly updateCheckInterval = 7 * 24 * 60 * 60 * 1000; // 1 week

  constructor(
    private readonly scryfallClient: ScryfallClient,
    private readonly cache: CacheService
  ) {}

  /**
   * Gets the set database, checking for updates if needed
   */
  async getData(): Promise<string> {
    try {
      const now = Date.now();
      if (now - this.lastUpdateCheck > this.updateCheckInterval) {
        await this.checkForUpdates();
        this.lastUpdateCheck = now;
      }

      const cachedPayload = this.cache.getWithStats<string>(SET_PAYLOAD_KEY);
      if (cachedPayload) {
        return cachedPayload;
      }

      const sets = await this.getSetDataModel();
      const updatedAt = new Date().toISOString();
      const payload = this.serializeSetPayload(sets, updatedAt);

      this.cache.setWithType(SET_PAYLOAD_KEY, payload, 'set_data');
      this.cache.setWithType(SET_METADATA_KEY, {
        updatedAt,
        totalSets: sets.length,
      } satisfies SetSnapshotMetadata, 'set_data');

      return payload;

    } catch (error) {
      throw new ScryfallAPIError(
        `Failed to retrieve set database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'resource_error'
      );
    }
  }

  private async getSetDataModel(): Promise<ScryfallSet[]> {
    const cached = this.cache.getWithStats<ScryfallSet[]>(SET_DATA_KEY);
    if (cached) {
      return cached;
    }

    const sets = await this.downloadSetData();
    this.cache.setWithType(SET_DATA_KEY, sets, 'set_data');
    return sets;
  }

  private serializeSetPayload(
    sets: ScryfallSet[],
    updatedAt: string
  ): string {
    return JSON.stringify({
      object: 'list',
      type: 'sets',
      updated_at: updatedAt,
      total_sets: sets.length,
      data: sets
    }, null, 2);
  }

  /**
   * Checks for updates to set data
   */
  private async checkForUpdates(): Promise<void> {
    try {
      // Sets don't have a bulk data endpoint, so we check periodically
      const cacheKey = CacheService.createSetKey();
      const lastUpdateKey = CacheService.createSetKey('last_update');
      
      const lastUpdate = this.cache.get<string>(lastUpdateKey);
      const weekAgo = new Date(Date.now() - this.updateCheckInterval).toISOString();
      
      if (!lastUpdate || lastUpdate < weekAgo) {
        // Clear old cache and mark for refresh
        this.cache.delete(cacheKey);
        this.cache.delete(SET_PAYLOAD_KEY);
        this.cache.delete(SET_METADATA_KEY);
        this.cache.set(lastUpdateKey, new Date().toISOString(), this.updateCheckInterval);
      }

    } catch (error) {
      // Log error but don't fail - we can still serve cached data
      mcpLogger.warn({ operation: 'set_update_check', error }, 'Failed to check for set data updates');
    }
  }

  /**
   * Downloads fresh set data
   */
  private async downloadSetData(): Promise<ScryfallSet[]> {
    return this.scryfallClient.getSets();
  }

  /**
   * Gets sets filtered by criteria
   */
  async getFilteredSets(filters: {
    type?: string;
    released_after?: string;
    released_before?: string;
    digital?: boolean;
  }): Promise<string> {
    const allSets = await this.getSetDataModel();
    let filteredSets = allSets;
    
    // Apply filters
    if (filters.type) {
      filteredSets = filteredSets.filter(set => set.set_type === filters.type);
    }
    
    if (filters.digital !== undefined) {
      filteredSets = filteredSets.filter(set => set.digital === filters.digital);
    }
    
    if (filters.released_after) {
      const afterDate = new Date(filters.released_after);
      filteredSets = filteredSets.filter(set => 
        set.released_at && new Date(set.released_at) >= afterDate
      );
    }
    
    if (filters.released_before) {
      const beforeDate = new Date(filters.released_before);
      filteredSets = filteredSets.filter(set => 
        set.released_at && new Date(set.released_at) <= beforeDate
      );
    }

    return JSON.stringify({
      object: 'list',
      type: 'sets',
      total_sets: filteredSets.length,
      data: filteredSets,
      filters_applied: filters
    }, null, 2);
  }

  /**
   * Gets resource metadata
   */
  getMetadata() {
    const stats = this.cache.getStats();
    const ttl = this.cache.getTTL(SET_PAYLOAD_KEY);
    const snapshot = this.cache.get<SetSnapshotMetadata>(SET_METADATA_KEY);
    
    return {
      uri: this.uri,
      name: this.name,
      description: this.description,
      mimeType: this.mimeType,
      cache_stats: stats,
      cache_ttl_remaining: ttl,
      snapshot_updated_at: snapshot?.updatedAt,
      cached_total_sets: snapshot?.totalSets,
      last_update_check: new Date(this.lastUpdateCheck).toISOString(),
      next_update_check: new Date(this.lastUpdateCheck + this.updateCheckInterval).toISOString()
    };
  }

  /**
   * Forces a refresh of the set data
   */
  async forceRefresh(): Promise<void> {
    this.cache.delete(SET_DATA_KEY);
    this.cache.delete(SET_PAYLOAD_KEY);
    this.cache.delete(SET_METADATA_KEY);
    this.lastUpdateCheck = 0;
    await this.getData(); // This will trigger a fresh download
  }

  /**
   * Gets cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Gets available set types
   */
  async getSetTypes(): Promise<string[]> {
    const types = new Set<string>();
    (await this.getSetDataModel()).forEach(set => {
      types.add(set.set_type);
    });
    
    return Array.from(types).sort();
  }

  /**
   * Gets sets by release year
   */
  async getSetsByYear(year: number): Promise<string> {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    return this.getFilteredSets({
      released_after: startDate,
      released_before: endDate
    });
  }
}
