import { request } from 'undici';
import {
  ScryfallCard,
  ScryfallSearchResponse,
  ScryfallSet,
  ScryfallError,
  BulkDataInfo
} from '../types/scryfall-api.js';
import {
  REQUIRED_HEADERS,
  ScryfallAPIError,
  RateLimitError
} from '../types/mcp-types.js';
import { RateLimiter } from './rate-limiter.js';
import { CacheService } from './cache-service.js';

/**
 * HTTP client for Scryfall API with rate limiting and caching
 */
export class ScryfallClient {
  private readonly baseUrl = 'https://api.scryfall.com';
  private rateLimiter: RateLimiter;
  private cache: CacheService;

  constructor(
    rateLimiter?: RateLimiter,
    cache?: CacheService,
    private userAgent: string = process.env.SCRYFALL_USER_AGENT || REQUIRED_HEADERS['User-Agent']
  ) {
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.cache = cache || new CacheService();
  }

  /**
   * Makes a rate-limited HTTP request to Scryfall API
   */
  private async makeRequest(url: string): Promise<any> {
    // Check circuit breaker
    if (this.rateLimiter.isCircuitOpen()) {
      throw new ScryfallAPIError(
        'Circuit breaker is open due to consecutive failures',
        503,
        'circuit_breaker_open'
      );
    }

    // Wait for rate limit clearance
    await this.rateLimiter.waitForClearance();

    try {
      const response = await request(url, {
        headers: {
          ...REQUIRED_HEADERS,
          'User-Agent': this.userAgent
        }
      });

      const data = await response.body.json();

      if (response.statusCode >= 400) {
        this.rateLimiter.recordError(response.statusCode);

        if (response.statusCode === 429) {
          const retryAfter = response.headers['retry-after'] as string;
          await this.rateLimiter.handleRateLimitResponse(retryAfter);
          throw new RateLimitError(
            'Rate limit exceeded',
            retryAfter ? parseInt(retryAfter) : undefined
          );
        }

        const error = data as ScryfallError;
        throw new ScryfallAPIError(
          error.details || `HTTP ${response.statusCode}`,
          response.statusCode,
          error.code,
          error.details
        );
      }

      this.rateLimiter.recordSuccess();
      return data;

    } catch (error) {
      if (error instanceof ScryfallAPIError || error instanceof RateLimitError) {
        throw error;
      }

      this.rateLimiter.recordError();
      throw new ScryfallAPIError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'network_error'
      );
    }
  }

  /**
   * Searches for cards using Scryfall search syntax
   */
  async searchCards(params: {
    query: string;
    limit?: number;
    page?: number;
    include_extras?: boolean;
    order?: string;
  }): Promise<ScryfallSearchResponse> {
    const cacheKey = CacheService.createSearchKey(
      params.query,
      params.page || 1,
      params.limit || 20
    );

    // Check cache first
    const cached = this.cache.getWithStats<ScryfallSearchResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL(`${this.baseUrl}/cards/search`);
    url.searchParams.set('q', params.query);

    if (params.limit) {
      url.searchParams.set('page_size', params.limit.toString());
    }
    if (params.page && params.page > 1) {
      url.searchParams.set('page', params.page.toString());
    }
    if (params.include_extras) {
      url.searchParams.set('include_extras', 'true');
    }
    if (params.order) {
      url.searchParams.set('order', params.order);
    }

    const data = await this.makeRequest(url.toString());

    // Cache the result
    this.cache.setWithType(cacheKey, data, 'card_search');

    return data;
  }

  /**
   * Gets a card by name, set code+number, or Scryfall ID
   */
  async getCard(params: {
    identifier: string;
    set?: string;
    lang?: string;
    face?: 'front' | 'back';
  }): Promise<ScryfallCard> {
    const cacheKey = CacheService.createCardKey(
      params.identifier,
      params.set,
      params.lang || 'en'
    );

    // Check cache first
    const cached = this.cache.getWithStats<ScryfallCard>(cacheKey);
    if (cached) {
      return cached;
    }

    let url: URL;

    // Check if identifier is a UUID (Scryfall ID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(params.identifier)) {
      url = new URL(`${this.baseUrl}/cards/${params.identifier}`);
    }
    // Check if identifier is set code + collector number
    else if (params.identifier.includes('/')) {
      const [setCode, collectorNumber] = params.identifier.split('/');
      url = new URL(`${this.baseUrl}/cards/${setCode}/${collectorNumber}`);
    }
    // Otherwise treat as card name
    else {
      url = new URL(`${this.baseUrl}/cards/named`);
      url.searchParams.set('fuzzy', params.identifier);
      if (params.set) {
        url.searchParams.set('set', params.set);
      }
    }

    if (params.lang && params.lang !== 'en') {
      url.searchParams.set('lang', params.lang);
    }

    const data = await this.makeRequest(url.toString());

    // Cache the result
    this.cache.setWithType(cacheKey, data, 'card_details');

    return data;
  }

  /**
   * Gets card prices by Scryfall ID
   */
  async getCardPrices(cardId: string, currency: string = 'usd'): Promise<ScryfallCard> {
    const cacheKey = CacheService.createPriceKey(cardId, currency);

    // Check cache first
    const cached = this.cache.getWithStats<ScryfallCard>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL(`${this.baseUrl}/cards/${cardId}`);
    const data = await this.makeRequest(url.toString());

    // Cache with shorter TTL for price data
    this.cache.setWithType(cacheKey, data, 'card_prices');

    return data;
  }

  /**
   * Gets a random card with optional filters
   */
  async getRandomCard(query?: string): Promise<ScryfallCard> {
    const url = new URL(`${this.baseUrl}/cards/random`);
    if (query) {
      url.searchParams.set('q', query);
    }

    // Don't cache random cards as they should be different each time
    return this.makeRequest(url.toString());
  }

  /**
   * Gets all Magic sets
   */
  async getSets(params?: {
    query?: string;
    type?: string;
    released_after?: string;
    released_before?: string;
  }): Promise<ScryfallSet[]> {
    const cacheKey = CacheService.createSetKey(params?.query, params?.type);

    // Check cache first
    const cached = this.cache.getWithStats<{ data: ScryfallSet[] }>(cacheKey);
    if (cached) {
      return cached.data;
    }

    const url = new URL(`${this.baseUrl}/sets`);

    // Note: Scryfall doesn't support query/type filtering on sets endpoint
    // We'll filter client-side if needed
    const data = await this.makeRequest(url.toString());

    let sets = data.data as ScryfallSet[];

    // Apply client-side filtering
    if (params?.query) {
      const query = params.query.toLowerCase();
      sets = sets.filter(set =>
        set.name.toLowerCase().includes(query) ||
        set.code.toLowerCase().includes(query)
      );
    }

    if (params?.type) {
      sets = sets.filter(set => set.set_type === params.type);
    }

    if (params?.released_after) {
      const afterDate = new Date(params.released_after);
      sets = sets.filter(set =>
        set.released_at && new Date(set.released_at) >= afterDate
      );
    }

    if (params?.released_before) {
      const beforeDate = new Date(params.released_before);
      sets = sets.filter(set =>
        set.released_at && new Date(set.released_at) <= beforeDate
      );
    }

    // Cache the filtered result
    this.cache.setWithType(cacheKey, { data: sets }, 'set_data');

    return sets;
  }

  /**
   * Gets bulk card data information
   */
  async getBulkDataInfo(): Promise<BulkDataInfo[]> {
    const cacheKey = CacheService.createBulkKey('info');

    // Check cache first
    const cached = this.cache.getWithStats<{ data: BulkDataInfo[] }>(cacheKey);
    if (cached) {
      return cached.data;
    }

    const url = `${this.baseUrl}/bulk-data`;
    const data = await this.makeRequest(url);

    // Cache bulk data info
    this.cache.setWithType(cacheKey, data, 'bulk_data');

    return data.data;
  }

  /**
   * Downloads bulk card data (doesn't count against rate limits)
   */
  async downloadBulkData(downloadUri: string): Promise<ScryfallCard[]> {
    try {
      const response = await request(downloadUri, {
        headers: {
          'Accept-Encoding': 'gzip'
        }
      });

      if (response.statusCode >= 400) {
        throw new ScryfallAPIError(
          `Failed to download bulk data: HTTP ${response.statusCode}`,
          response.statusCode
        );
      }

      return await response.body.json() as ScryfallCard[];
    } catch (error) {
      throw new ScryfallAPIError(
        `Bulk data download error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'bulk_download_error'
      );
    }
  }

  /**
   * Gets cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Gets rate limiter status
   */
  getRateLimiterStatus() {
    return this.rateLimiter.getStatus();
  }

  /**
   * Clears all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Resets rate limiter state
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cache.destroy();
    this.rateLimiter.reset();
  }
}