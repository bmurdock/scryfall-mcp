import { ScryfallClient } from '../services/scryfall-client.js';
import { CacheService } from '../services/cache-service.js';
import { ScryfallSet } from '../types/scryfall-api.js';
import { ScryfallAPIError } from '../types/mcp-types.js';

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
      
      // Check if we need to update
      if (now - this.lastUpdateCheck > this.updateCheckInterval) {
        await this.checkForUpdates();
        this.lastUpdateCheck = now;
      }

      // Try to get from cache first
      const cacheKey = CacheService.createSetKey();
      const cached = this.cache.getWithStats<ScryfallSet[]>(cacheKey);
      
      if (cached) {
        return JSON.stringify({
          object: 'list',
          type: 'sets',
          updated_at: new Date().toISOString(),
          total_sets: cached.length,
          data: cached,
          source: 'cache'
        }, null, 2);
      }

      // If not in cache, download fresh data
      const sets = await this.downloadSetData();
      
      // Cache the result
      this.cache.setWithType(cacheKey, sets, 'set_data');

      return JSON.stringify({
        object: 'list',
        type: 'sets',
        updated_at: new Date().toISOString(),
        total_sets: sets.length,
        data: sets,
        source: 'fresh'
      }, null, 2);

    } catch (error) {
      throw new ScryfallAPIError(
        `Failed to retrieve set database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'resource_error'
      );
    }
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
        this.cache.set(lastUpdateKey, new Date().toISOString(), this.updateCheckInterval);
      }

    } catch (error) {
      // Log error but don't fail - we can still serve cached data
      console.warn('Failed to check for set data updates:', error);
    }
  }

  /**
   * Downloads fresh set data
   */
  private async downloadSetData(): Promise<ScryfallSet[]> {
    const sets = await this.scryfallClient.getSets();
    
    // Enhance sets with additional metadata and convert icons to base64
    return Promise.all(sets.map(set => this.enhanceSetData(set)));
  }

  /**
   * Enhances set data with additional metadata
   */
  private async enhanceSetData(set: ScryfallSet): Promise<ScryfallSet> {
    try {
      // Download and convert icon to base64 if available
      if (set.icon_svg_uri) {
        const iconBase64 = await this.downloadIconAsBase64(set.icon_svg_uri);
        return {
          ...set,
          icon_base64: iconBase64
        } as ScryfallSet & { icon_base64?: string };
      }
      
      return set;
    } catch (error) {
      // If icon download fails, just return the set without it
      console.warn(`Failed to download icon for set ${set.code}:`, error);
      return set;
    }
  }

  /**
   * Downloads an SVG icon and converts it to base64
   */
  private async downloadIconAsBase64(iconUri: string): Promise<string> {
    try {
      const response = await fetch(iconUri);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const svgText = await response.text();
      const base64 = Buffer.from(svgText).toString('base64');
      return `data:image/svg+xml;base64,${base64}`;
    } catch (error) {
      throw new Error(`Failed to download icon: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    const allSetsData = await this.getData();
    const allSets = JSON.parse(allSetsData);
    
    let filteredSets = allSets.data as ScryfallSet[];
    
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
      ...allSets,
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
    const cacheKey = CacheService.createSetKey();
    const ttl = this.cache.getTTL(cacheKey);
    
    return {
      uri: this.uri,
      name: this.name,
      description: this.description,
      mimeType: this.mimeType,
      cache_stats: stats,
      cache_ttl_remaining: ttl,
      last_update_check: new Date(this.lastUpdateCheck).toISOString(),
      next_update_check: new Date(this.lastUpdateCheck + this.updateCheckInterval).toISOString()
    };
  }

  /**
   * Forces a refresh of the set data
   */
  async forceRefresh(): Promise<void> {
    const cacheKey = CacheService.createSetKey();
    this.cache.delete(cacheKey);
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
    const allSetsData = await this.getData();
    const allSets = JSON.parse(allSetsData);
    
    const types = new Set<string>();
    (allSets.data as ScryfallSet[]).forEach(set => {
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
