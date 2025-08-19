import { ScryfallClient } from '../services/scryfall-client.js';
import { CacheService } from '../services/cache-service.js';
import { ScryfallCard } from '../types/scryfall-api.js';
import { ScryfallAPIError } from '../types/mcp-types.js';
import { mcpLogger } from '../services/logger.js';

/**
 * MCP Resource for accessing bulk card database
 */
export class CardDatabaseResource {
  readonly uri = 'card-database://bulk';
  readonly name = 'Card Database';
  readonly description = 'Complete Scryfall bulk card database with daily updates';
  readonly mimeType = 'application/json';

  private lastUpdateCheck = 0;
  private readonly updateCheckInterval = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly scryfallClient: ScryfallClient,
    private readonly cache: CacheService
  ) {}

  /**
   * Gets the bulk card data, checking for updates if needed
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
      const cacheKey = CacheService.createBulkKey('cards');
      const cached = this.cache.getWithStats<ScryfallCard[]>(cacheKey);
      
      if (cached) {
        return JSON.stringify({
          object: 'bulk_data',
          type: 'oracle_cards',
          updated_at: new Date().toISOString(),
          total_cards: cached.length,
          data: cached,
          source: 'cache'
        }, null, 2);
      }

      // If not in cache, download fresh data
      const cards = await this.downloadBulkData();
      
      // Cache the result
      this.cache.setWithType(cacheKey, cards, 'bulk_data');

      return JSON.stringify({
        object: 'bulk_data',
        type: 'oracle_cards',
        updated_at: new Date().toISOString(),
        total_cards: cards.length,
        data: cards,
        source: 'fresh'
      }, null, 2);

    } catch (error) {
      throw new ScryfallAPIError(
        `Failed to retrieve card database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'resource_error'
      );
    }
  }

  /**
   * Checks for updates to bulk data
   */
  private async checkForUpdates(): Promise<void> {
    try {
      const bulkDataInfo = await this.scryfallClient.getBulkDataInfo();
      const oracleCards = bulkDataInfo.find(item => item.type === 'oracle_cards');
      
      if (!oracleCards) {
        throw new Error('Oracle cards bulk data not found');
      }

      // Check if we have this version cached
      const cacheKey = CacheService.createBulkKey('cards');
      const lastUpdateKey = CacheService.createBulkKey('last_update');
      
      const lastUpdate = this.cache.get<string>(lastUpdateKey);
      
      if (!lastUpdate || lastUpdate !== oracleCards.updated_at) {
        // Clear old cache and mark for refresh
        this.cache.delete(cacheKey);
        this.cache.set(lastUpdateKey, oracleCards.updated_at, 7 * 24 * 60 * 60 * 1000); // 1 week
      }

    } catch (error) {
      // Log error but don't fail - we can still serve cached data
      mcpLogger.warn({ operation: 'bulk_update_check', error }, 'Failed to check for bulk data updates');
    }
  }

  /**
   * Downloads fresh bulk card data
   */
  private async downloadBulkData(): Promise<ScryfallCard[]> {
    const bulkDataInfo = await this.scryfallClient.getBulkDataInfo();
    const oracleCards = bulkDataInfo.find(item => item.type === 'oracle_cards');
    
    if (!oracleCards) {
      throw new Error('Oracle cards bulk data not found');
    }

    const cards = await this.scryfallClient.downloadBulkData(oracleCards.download_uri);
    
    // Filter out unnecessary fields to reduce memory usage
    return cards.map(card => this.filterCardFields(card));
  }

  /**
   * Filters card fields to reduce memory usage
   */
  private filterCardFields(card: ScryfallCard): ScryfallCard {
    // Keep only essential fields for most use cases
    const filtered: Partial<ScryfallCard> = {
      id: card.id,
      oracle_id: card.oracle_id,
      name: card.name,
      lang: card.lang,
      released_at: card.released_at,
      layout: card.layout,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      type_line: card.type_line,
      oracle_text: card.oracle_text,
      power: card.power,
      toughness: card.toughness,
      colors: card.colors,
      color_identity: card.color_identity,
      keywords: card.keywords,
      legalities: card.legalities,
      games: card.games,
      reserved: card.reserved,
      foil: card.foil,
      nonfoil: card.nonfoil,
      oversized: card.oversized,
      promo: card.promo,
      reprint: card.reprint,
      set_id: card.set_id,
      set: card.set,
      set_name: card.set_name,
      set_type: card.set_type,
      collector_number: card.collector_number,
      digital: card.digital,
      rarity: card.rarity,
      artist: card.artist,
      border_color: card.border_color,
      frame: card.frame,
      full_art: card.full_art,
      textless: card.textless,
      booster: card.booster,
      story_spotlight: card.story_spotlight,
      edhrec_rank: card.edhrec_rank,
      prices: card.prices,
      image_uris: card.image_uris,
      card_faces: card.card_faces
    };

    return filtered as ScryfallCard;
  }

  /**
   * Gets resource metadata
   */
  getMetadata() {
    const stats = this.cache.getStats();
    const cacheKey = CacheService.createBulkKey('cards');
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
   * Forces a refresh of the bulk data
   */
  async forceRefresh(): Promise<void> {
    const cacheKey = CacheService.createBulkKey('cards');
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
}
