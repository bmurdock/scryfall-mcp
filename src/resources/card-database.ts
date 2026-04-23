import { ScryfallClient } from '../services/scryfall-client.js';
import { CacheService } from '../services/cache-service.js';
import { BulkDataInfo, ScryfallCard } from '../types/scryfall-api.js';
import { ScryfallAPIError } from '../types/mcp-types.js';
import { mcpLogger } from '../services/logger.js';

type BulkSnapshotMetadata = {
  updatedAt: string;
  totalCards: number;
};

type BulkBuildDiagnostics = {
  totalCards: number;
  retainedChunks: number;
};

const BULK_PAYLOAD_KEY = CacheService.createBulkKey('cards:serialized');
const BULK_METADATA_KEY = CacheService.createBulkKey('cards:metadata');
const MAX_JSON_CHUNK_SIZE = 1_000_000;

class JsonChunkBuilder {
  private readonly chunks: string[] = [];
  private currentParts: string[] = [];
  private currentSize = 0;
  private hasItems = false;

  constructor(private readonly maxChunkSize = MAX_JSON_CHUNK_SIZE) {}

  append(serializedJson: string): void {
    const part = this.hasItems ? `,${serializedJson}` : serializedJson;

    if (this.currentSize > 0 && this.currentSize + part.length > this.maxChunkSize) {
      this.flush();
    }

    this.currentParts.push(part);
    this.currentSize += part.length;
    this.hasItems = true;
  }

  finish(prefix: string, totalCards: number): { payload: string; chunks: number } {
    this.flush();

    return {
      payload: `${prefix}${totalCards},"data":[${this.chunks.join('')}]}`,
      chunks: this.chunks.length,
    };
  }

  private flush(): void {
    if (this.currentSize === 0) {
      return;
    }

    this.chunks.push(this.currentParts.join(''));
    this.currentParts = [];
    this.currentSize = 0;
  }
}

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
  private rebuildInFlight?: Promise<string>;
  private lastBuildDiagnostics: BulkBuildDiagnostics = {
    totalCards: 0,
    retainedChunks: 0,
  };

  constructor(
    private readonly scryfallClient: ScryfallClient,
    private readonly cache: CacheService
  ) {}

  /**
   * Gets the bulk card data, checking for updates if needed
   */
  async getData(): Promise<string> {
    try {
      const bulkInfo = await this.getBulkInfoIfUpdateCheckDue();
      const cachedPayload = this.cache.getWithStats<string>(BULK_PAYLOAD_KEY);
      const cachedMetadata = this.cache.get<BulkSnapshotMetadata>(BULK_METADATA_KEY);
      const cachedIsCurrent = Boolean(
        cachedPayload &&
        cachedMetadata &&
        (!bulkInfo || cachedMetadata.updatedAt === bulkInfo.updated_at)
      );

      if (cachedPayload && cachedIsCurrent) {
        return cachedPayload;
      }

      try {
        return await this.rebuildSerializedSnapshotOnce(bulkInfo);
      } catch (error) {
        if (cachedPayload) {
          mcpLogger.warn(
            { operation: 'bulk_snapshot_refresh', error },
            'Serving stale bulk snapshot after refresh failure'
          );
          return cachedPayload;
        }

        throw error;
      }
    } catch (error) {
      throw new ScryfallAPIError(
        `Failed to retrieve card database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'resource_error'
      );
    }
  }

  /**
   * Returns remote bulk metadata when the update check interval has elapsed.
   */
  private async getBulkInfoIfUpdateCheckDue(): Promise<BulkDataInfo | undefined> {
    const now = Date.now();
    if (now - this.lastUpdateCheck <= this.updateCheckInterval) {
      return undefined;
    }

    this.lastUpdateCheck = now;

    try {
      return await this.getOracleCardsBulkInfo();
    } catch (error) {
      mcpLogger.warn({ operation: 'bulk_update_check', error }, 'Failed to check for bulk data updates');
      return undefined;
    }
  }

  /**
   * Returns the oracle cards bulk metadata entry from Scryfall.
   */
  private async getOracleCardsBulkInfo(): Promise<BulkDataInfo> {
    const bulkDataInfo = await this.scryfallClient.getBulkDataInfo();
    const oracleCards = bulkDataInfo.find(item => item.type === 'oracle_cards');

    if (!oracleCards) {
      throw new Error('Oracle cards bulk data not found');
    }

    return oracleCards;
  }

  private rebuildSerializedSnapshotOnce(knownBulkInfo?: BulkDataInfo): Promise<string> {
    if (!this.rebuildInFlight) {
      this.rebuildInFlight = this.rebuildSerializedSnapshot(knownBulkInfo)
        .finally(() => {
          this.rebuildInFlight = undefined;
        });
    }

    return this.rebuildInFlight;
  }

  /**
   * Downloads fresh bulk card data and stores the serialized resource snapshot.
   */
  private async rebuildSerializedSnapshot(knownBulkInfo?: BulkDataInfo): Promise<string> {
    const oracleCards = knownBulkInfo ?? await this.getOracleCardsBulkInfo();
    const builder = new JsonChunkBuilder();
    let totalCards = 0;

    for await (const card of this.scryfallClient.streamBulkData(oracleCards.download_uri)) {
      builder.append(JSON.stringify(this.filterCardFields(card)));
      totalCards++;
    }

    const finished = builder.finish(
      `{"object":"bulk_data","type":"oracle_cards","updated_at":"${oracleCards.updated_at}",` +
      '"total_cards":',
      totalCards
    );
    const payload = finished.payload;
    this.lastBuildDiagnostics = {
      totalCards,
      retainedChunks: finished.chunks,
    };

    this.cache.setWithType(BULK_PAYLOAD_KEY, payload, 'bulk_data', { sizeBytes: payload.length * 2 });
    this.cache.setWithType(BULK_METADATA_KEY, {
      updatedAt: oracleCards.updated_at,
      totalCards,
    }, 'bulk_data');

    return payload;
  }

  /**
   * Filters card fields to reduce memory usage
   */
  private filterCardFields(card: ScryfallCard): ScryfallCard {
    // Keep only essential fields for most use cases
    const filtered: Partial<ScryfallCard> = {
      object: card.object,
      id: card.id,
      oracle_id: card.oracle_id,
      name: card.name,
      lang: card.lang,
      released_at: card.released_at,
      uri: card.uri,
      scryfall_uri: card.scryfall_uri,
      layout: card.layout,
      highres_image: card.highres_image,
      image_status: card.image_status,
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
      finishes: card.finishes,
      oversized: card.oversized,
      promo: card.promo,
      reprint: card.reprint,
      variation: card.variation,
      set_id: card.set_id,
      set: card.set,
      set_name: card.set_name,
      set_type: card.set_type,
      set_uri: card.set_uri,
      set_search_uri: card.set_search_uri,
      scryfall_set_uri: card.scryfall_set_uri,
      rulings_uri: card.rulings_uri,
      prints_search_uri: card.prints_search_uri,
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
      related_uris: card.related_uris,
      card_faces: card.card_faces
    };

    return filtered as ScryfallCard;
  }

  /**
   * Gets resource metadata
   */
  getMetadata() {
    const stats = this.cache.getStats();
    const ttl = this.cache.getTTL(BULK_PAYLOAD_KEY);
    
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
    this.cache.delete(BULK_PAYLOAD_KEY);
    this.cache.delete(BULK_METADATA_KEY);
    this.lastUpdateCheck = 0;
    await this.getData(); // This will trigger a fresh download
  }

  /**
   * Gets cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  getLastBuildDiagnostics(): BulkBuildDiagnostics {
    return this.lastBuildDiagnostics;
  }
}
