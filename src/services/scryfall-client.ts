// HTTP client for Scryfall API
import {
  ScryfallCard,
  ScryfallSearchResponse,
  ScryfallSet,
  ScryfallError,
  BulkDataInfo,
  ScryfallListResponse,
} from "../types/scryfall-api.js";
import { REQUIRED_HEADERS, ScryfallAPIError, RateLimitError } from "../types/mcp-types.js";
import { RateLimiter } from "./rate-limiter.js";
import { CacheService } from "./cache-service.js";
import { mcpLogger } from "./logger.js";
import { generateRequestId } from "../types/mcp-errors.js";
import { EnvValidators } from "../utils/env-parser.js";

/**
 * HTTP client for Scryfall API with rate limiting and caching
 */
export class ScryfallClient {
  private readonly baseUrl = "https://api.scryfall.com";
  private rateLimiter: RateLimiter;
  private cache: CacheService;

  constructor(
    rateLimiter?: RateLimiter,
    cache?: CacheService,
    private userAgent: string = EnvValidators.userAgent(process.env.SCRYFALL_USER_AGENT)
  ) {
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.cache = cache || new CacheService();
  }

  /**
   * Makes a rate-limited HTTP request to Scryfall API with structured logging
   */
  private async makeRequest<T = unknown>(url: string, requestId?: string): Promise<T> {
    const reqId = requestId || generateRequestId();
    const startTime = Date.now();

    mcpLogger.debug(
      { requestId: reqId, url, operation: "scryfall_request" },
      "Scryfall API request started"
    );
    // Check circuit breaker
    if (this.rateLimiter.isCircuitOpen()) {
      const error = new ScryfallAPIError(
        "Circuit breaker is open due to consecutive failures",
        503,
        "circuit_breaker_open"
      );
      mcpLogger.error(
        {
          requestId: reqId,
          url,
          error,
          operation: "scryfall_request",
        },
        "Circuit breaker is open"
      );
      throw error;
    }

    // Wait for rate limit clearance
    await this.rateLimiter.waitForClearance();

    try {
      // Timeout support via AbortController
      const timeoutMs = EnvValidators.scryfallTimeoutMs(process.env.SCRYFALL_TIMEOUT_MS);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        headers: {
          ...REQUIRED_HEADERS,
          "User-Agent": this.userAgent,
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      // Handle the response body properly
      let data;
      let responseText: string | null = null;
      
      try {
        // First try to get the response text for debugging purposes
        const clonedResponse = response.clone();
        responseText = await clonedResponse.text();
        
        // Then parse as JSON
        data = JSON.parse(responseText);
      } catch (jsonError) {
        const originalError = jsonError instanceof Error ? jsonError.message : "Unknown JSON error";
        const debugText = responseText ? responseText.substring(0, 200) : "Unable to read response";
        
        throw new Error(
          `Failed to parse JSON response. Original error: ${originalError}. Response preview: ${debugText}...`
        );
      }

      if (response.status >= 400) {
        this.rateLimiter.recordError(response.status);

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          await this.rateLimiter.handleRateLimitResponse(retryAfter || undefined);
          const rateLimitError = new RateLimitError(
            "Rate limit exceeded",
            retryAfter ? parseInt(retryAfter) : undefined
          );
          mcpLogger.warn(
            {
              requestId: reqId,
              url,
              status: response.status,
              retryAfter,
              operation: "scryfall_request",
            },
            "Rate limit exceeded"
          );
          throw rateLimitError;
        }

        const error = data as ScryfallError;
        const apiError = new ScryfallAPIError(
          error.details || `HTTP ${response.status}`,
          response.status,
          error.code,
          error.details
        );
        mcpLogger.error(
          {
            requestId: reqId,
            url,
            status: response.status,
            error: apiError,
            operation: "scryfall_request",
          },
          "Scryfall API error"
        );
        throw apiError;
      }

      this.rateLimiter.recordSuccess();
      const duration = Date.now() - startTime;
      mcpLogger.debug(
        {
          requestId: reqId,
          url,
          status: response.status,
          duration,
          operation: "scryfall_request",
        },
        "Scryfall API request completed"
      );

      return data;
    } catch (error) {
      if (error instanceof ScryfallAPIError || error instanceof RateLimitError) {
        throw error;
      }

      this.rateLimiter.recordError();
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const networkError = new ScryfallAPIError(
        `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
        0,
        isAbort ? "timeout" : "network_error"
      );
      mcpLogger.error(
        {
          requestId: reqId,
          url,
          error: networkError,
          originalError: error instanceof Error ? error.message : String(error),
          operation: "scryfall_request",
        },
        "Network error during Scryfall request"
      );
      throw networkError;
    }
  }

  /**
   * Searches for cards using Scryfall search syntax
   */
  async searchCards(
    params: {
      query: string;
      limit?: number;
      page?: number;
      include_extras?: boolean;
      order?: string;
      unique?: string;
      direction?: string;
      include_multilingual?: boolean;
      include_variations?: boolean;
      price_range?: {
        min?: number;
        max?: number;
        currency?: string;
      };
    },
    requestId?: string
  ): Promise<ScryfallSearchResponse> {
    const reqId = requestId || generateRequestId();
    const cacheKey = CacheService.createSearchKey(
      params.query,
      params.page || 1,
      params.limit || 20,
      params.unique,
      params.direction,
      params.include_multilingual,
      params.include_variations,
      params.price_range
    );

    mcpLogger.debug(
      { requestId: reqId, operation: "search_cards", query: params.query },
      "Card search started"
    );

    // Check cache first
    const cached = this.cache.getWithStats<ScryfallSearchResponse>(cacheKey);
    if (cached) {
      mcpLogger.debug(
        { requestId: reqId, operation: "search_cards", cacheHit: true },
        "Card search cache hit"
      );
      return cached;
    }

    const url = new URL(`${this.baseUrl}/cards/search`);

    // Build query with price filtering if specified
    let query = params.query;
    if (params.price_range) {
      const currency = params.price_range.currency || "usd";
      if (params.price_range.min !== undefined) {
        query += ` ${currency}>=${params.price_range.min}`;
      }
      if (params.price_range.max !== undefined) {
        query += ` ${currency}<=${params.price_range.max}`;
      }
    }

    url.searchParams.set("q", query);

    // Note: Scryfall does not support custom page size on search; we slice in formatters
    if (params.page && params.page > 1) {
      url.searchParams.set("page", params.page.toString());
    }
    if (params.include_extras) {
      url.searchParams.set("include_extras", "true");
    }
    if (params.include_multilingual) {
      url.searchParams.set("include_multilingual", "true");
    }
    if (params.include_variations) {
      url.searchParams.set("include_variations", "true");
    }
    if (params.order) {
      url.searchParams.set("order", params.order);
    }
    if (params.unique && params.unique !== "cards") {
      url.searchParams.set("unique", params.unique);
    }
    if (params.direction && params.direction !== "auto") {
      url.searchParams.set("dir", params.direction);
    }

    const data = await this.makeRequest<ScryfallSearchResponse>(url.toString(), reqId);

    // Cache the result
    this.cache.setWithType(cacheKey, data, "card_search");
    mcpLogger.debug(
      { requestId: reqId, operation: "search_cards", resultCount: data.data?.length },
      "Card search completed"
    );

    return data;
  }

  /**
   * Gets a card by name, set code+number, or Scryfall ID
   */
  async getCard(params: {
    identifier: string;
    set?: string;
    lang?: string;
    face?: "front" | "back";
  }): Promise<ScryfallCard> {
    const cacheKey = CacheService.createCardKey(params.identifier, params.set, params.lang || "en");

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
    else if (params.identifier.includes("/")) {
      const [setCode, collectorNumber] = params.identifier.split("/");
      url = new URL(`${this.baseUrl}/cards/${setCode}/${collectorNumber}`);
    }
    // Otherwise treat as card name
    else {
      url = new URL(`${this.baseUrl}/cards/named`);
      url.searchParams.set("fuzzy", params.identifier);
      if (params.set) {
        url.searchParams.set("set", params.set);
      }
    }

    if (params.lang && params.lang !== "en") {
      url.searchParams.set("lang", params.lang);
    }

    const data = await this.makeRequest<ScryfallCard>(url.toString());

    // Cache the result
    this.cache.setWithType(cacheKey, data, "card_details");

    return data;
  }

  /**
   * Gets a random card with optional filters
   */
  async getRandomCard(query?: string): Promise<ScryfallCard> {
    const url = new URL(`${this.baseUrl}/cards/random`);
    if (query) {
      url.searchParams.set("q", query);
    }

    // Don't cache random cards as they should be different each time
    return this.makeRequest<ScryfallCard>(url.toString());
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
    const data = await this.makeRequest<ScryfallListResponse<ScryfallSet>>(url.toString());

    let sets = data.data;

    // Apply client-side filtering
    if (params?.query) {
      const query = params.query.toLowerCase();
      sets = sets.filter(
        (set) => set.name.toLowerCase().includes(query) || set.code.toLowerCase().includes(query)
      );
    }

    if (params?.type) {
      sets = sets.filter((set) => set.set_type === params.type);
    }

    if (params?.released_after) {
      const afterDate = new Date(params.released_after);
      sets = sets.filter((set) => set.released_at && new Date(set.released_at) >= afterDate);
    }

    if (params?.released_before) {
      const beforeDate = new Date(params.released_before);
      sets = sets.filter((set) => set.released_at && new Date(set.released_at) <= beforeDate);
    }

    // Cache the filtered result
    this.cache.setWithType(cacheKey, { data: sets }, "set_data");

    return sets;
  }

  /**
   * Gets bulk card data information
   */
  async getBulkDataInfo(): Promise<BulkDataInfo[]> {
    const cacheKey = CacheService.createBulkKey("info");

    // Check cache first
    const cached = this.cache.getWithStats<{ data: BulkDataInfo[] }>(cacheKey);
    if (cached) {
      return cached.data;
    }

    const url = `${this.baseUrl}/bulk-data`;
    const data = await this.makeRequest<ScryfallListResponse<BulkDataInfo>>(url);

    // Cache bulk data info
    this.cache.setWithType(cacheKey, data, "bulk_data");

    return data.data;
  }

  /**
   * Downloads bulk card data (doesn't count against rate limits)
   */
  async downloadBulkData(downloadUri: string): Promise<ScryfallCard[]> {
    try {
      const timeoutMs = EnvValidators.scryfallTimeoutMs(process.env.SCRYFALL_TIMEOUT_MS) * 2; // Double timeout for bulk downloads
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(downloadUri, {
        headers: {
          "User-Agent": this.userAgent,
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (response.status >= 400) {
        throw new ScryfallAPIError(
          `Failed to download bulk data: HTTP ${response.status}`,
          response.status
        );
      }

      return (await response.json()) as ScryfallCard[];
    } catch (error) {
      throw new ScryfallAPIError(
        `Bulk data download error: ${error instanceof Error ? error.message : "Unknown error"}`,
        0,
        (error instanceof Error && error.name === 'AbortError') ? "timeout" : "bulk_download_error"
      );
    }
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
