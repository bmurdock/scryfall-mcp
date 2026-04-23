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
import { filterSets } from "../utils/set-filters.js";
import { iterateArrayStream } from "./bulk-json-stream.js";
import { createSearchWindowCollector } from "./search-window.js";

export interface CardLookupParams {
  identifier: string;
  set?: string;
  lang?: string;
  face?: "front" | "back";
}

export function canonicalCardCacheKey(params: CardLookupParams): string {
  const canonicalIdentifier = params.identifier.trim().toLowerCase();
  const set = params.set?.trim().toLowerCase();
  const lang = params.lang?.trim().toLowerCase();

  return CacheService.createCardKey(canonicalIdentifier, set, lang || "en");
}

/**
 * HTTP client for Scryfall API with rate limiting and caching
 */
export class ScryfallClient {
  private readonly baseUrl = "https://api.scryfall.com";
  private readonly searchApiPageSize = 175;
  private readonly inFlightCardLookups = new Map<string, Promise<ScryfallCard>>();
  private rateLimiter: RateLimiter;
  private cache: CacheService;
  private readonly timeoutMs = () =>
    EnvValidators.scryfallTimeoutMs(process.env.SCRYFALL_TIMEOUT_MS);

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
    return this.rateLimiter.execute(async () => {
      // Check circuit breaker immediately before the request starts.
      this.assertCircuitClosed(url, reqId);

      try {
        const response = await this.fetchJsonResponse(url);
        const data = await this.parseJsonResponse<T>(response);

        if (response.status >= 400) {
          throw await this.buildHttpError(response, data, url, reqId);
        }

        this.rateLimiter.recordSuccess();
        this.logRequestCompletion(url, reqId, response.status, startTime);

        return data;
      } catch (error) {
        if (error instanceof ScryfallAPIError || error instanceof RateLimitError) {
          throw error;
        }

        throw this.buildNetworkError(error, url, reqId);
      }
    });
  }

  private assertCircuitClosed(url: string, requestId: string): void {
    if (!this.rateLimiter.isCircuitOpen()) {
      return;
    }

    const error = new ScryfallAPIError(
      "Circuit breaker is open due to consecutive failures",
      503,
      "circuit_breaker_open"
    );
    mcpLogger.error(
      {
        requestId,
        url,
        error,
        operation: "scryfall_request",
      },
      "Circuit breaker is open"
    );
    throw error;
  }

  private async fetchJsonResponse(url: string): Promise<Response> {
    return this.fetchWithTimeout(url, {
      ...REQUIRED_HEADERS,
      "User-Agent": this.userAgent,
    });
  }

  private async fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = this.timeoutMs()): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    try {
      return await response.json() as T;
    } catch (jsonError) {
      const originalError = jsonError instanceof Error ? jsonError.message : "Unknown JSON error";

      throw new Error(
        `Failed to parse JSON response. Original error: ${originalError}.`
      );
    }
  }

  private async buildHttpError(
    response: Response,
    data: unknown,
    url: string,
    requestId: string
  ): Promise<ScryfallAPIError | RateLimitError> {
    this.rateLimiter.recordError(response.status);

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      await this.rateLimiter.handleRateLimitResponse(retryAfter || undefined);
      const rateLimitError = new RateLimitError(
        "Rate limit exceeded",
        retryAfter ? parseInt(retryAfter, 10) : undefined
      );
      mcpLogger.warn(
        {
          requestId,
          url,
          status: response.status,
          retryAfter,
          operation: "scryfall_request",
        },
        "Rate limit exceeded"
      );
      return rateLimitError;
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
        requestId,
        url,
        status: response.status,
        error: apiError,
        operation: "scryfall_request",
      },
      "Scryfall API error"
    );
    return apiError;
  }

  private buildNetworkError(error: unknown, url: string, requestId: string): ScryfallAPIError {
    this.rateLimiter.recordError();
    const isAbort = error instanceof Error && error.name === "AbortError";
    const networkError = new ScryfallAPIError(
      `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      0,
      isAbort ? "timeout" : "network_error"
    );
    mcpLogger.error(
      {
        requestId,
        url,
        error: networkError,
        originalError: error instanceof Error ? error.message : String(error),
        operation: "scryfall_request",
      },
      "Network error during Scryfall request"
    );
    return networkError;
  }

  private logRequestCompletion(
    url: string,
    requestId: string,
    status: number,
    startTime: number
  ): void {
    const duration = Date.now() - startTime;
    mcpLogger.debug(
      {
        requestId,
        url,
        status,
        duration,
        operation: "scryfall_request",
      },
      "Scryfall API request completed"
    );
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
    const requestedPage = params.page || 1;
    const requestedLimit = params.limit || 20;
    const cacheKey = CacheService.createSearchKey(
      params.query,
      requestedPage,
      requestedLimit,
      params.unique,
      params.direction,
      params.include_multilingual,
      params.include_variations,
      params.price_range
    );

    mcpLogger.debug(
      { requestId: reqId, operation: "search_cards", query: params.query, page: requestedPage, limit: requestedLimit },
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

    const requestedOffset = (requestedPage - 1) * requestedLimit;
    const startingApiPage = Math.floor(requestedOffset / this.searchApiPageSize) + 1;
    const relativeOffset = requestedOffset - ((startingApiPage - 1) * this.searchApiPageSize);

    const firstPage = await this.fetchSearchPage(
      {
        ...params,
        query,
      },
      startingApiPage,
      reqId
    );
    const totalCards = firstPage.total_cards ?? firstPage.data.length;
    const requiredCount = Math.max(0, Math.min(requestedLimit, totalCards - requestedOffset));
    let fetchedCards = firstPage.data.length;
    const collector = createSearchWindowCollector<ScryfallCard>(relativeOffset, requiredCount);
    collector.addPage(firstPage);
    let currentPage = firstPage;
    let nextApiPage = startingApiPage + 1;

    while (
      !collector.isComplete() &&
      fetchedCards < relativeOffset + requiredCount &&
      currentPage.has_more
    ) {
      currentPage = await this.fetchSearchPage(
        {
          ...params,
          query,
        },
        nextApiPage,
        reqId
      );
      collector.addPage(currentPage);
      fetchedCards += currentPage.data.length;
      nextApiPage++;
    }

    const window = collector.finish();
    const data: ScryfallSearchResponse = {
      object: firstPage.object,
      total_cards: totalCards,
      has_more: requestedOffset + window.data.length < totalCards,
      data: window.data,
      warnings: window.warnings,
    };

    // Cache the result
    this.cache.setWithType(cacheKey, data, "card_search");
    mcpLogger.debug(
      { requestId: reqId, operation: "search_cards", resultCount: data.data?.length },
      "Card search completed"
    );

    return data;
  }

  private async fetchSearchPage(
    params: {
      query: string;
      include_extras?: boolean;
      order?: string;
      unique?: string;
      direction?: string;
      include_multilingual?: boolean;
      include_variations?: boolean;
    },
    apiPage: number,
    requestId: string
  ): Promise<ScryfallSearchResponse> {
    const url = new URL(`${this.baseUrl}/cards/search`);
    url.searchParams.set("q", params.query);

    if (apiPage > 1) {
      url.searchParams.set("page", apiPage.toString());
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

    return this.makeRequest<ScryfallSearchResponse>(url.toString(), requestId);
  }

  /**
   * Gets a card by name, set code+number, or Scryfall ID
   */
  async getCard(params: CardLookupParams): Promise<ScryfallCard> {
    const normalizedParams = this.normalizeCardLookupParams(params);
    const cacheKey = canonicalCardCacheKey(normalizedParams);

    // Check cache first
    const cached = this.cache.getWithStats<ScryfallCard>(cacheKey);
    if (cached) {
      return cached;
    }

    const inFlight = this.inFlightCardLookups.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const lookupPromise = this.fetchCard(normalizedParams)
      .then((data) => {
        // Cache the result
        this.cache.setWithType(cacheKey, data, "card_details");
        return data;
      })
      .finally(() => {
        this.inFlightCardLookups.delete(cacheKey);
      });

    this.inFlightCardLookups.set(cacheKey, lookupPromise);

    return lookupPromise;
  }

  private normalizeCardLookupParams(params: CardLookupParams): CardLookupParams {
    return {
      ...params,
      identifier: params.identifier.trim(),
      set: params.set?.trim().toLowerCase(),
      lang: params.lang?.trim().toLowerCase() || "en",
    };
  }

  private async fetchCard(params: CardLookupParams): Promise<ScryfallCard> {
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

    return this.makeRequest<ScryfallCard>(url.toString());
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
    digital?: boolean;
  }): Promise<ScryfallSet[]> {
    const rawSetsKey = CacheService.createSetKey();

    const cachedRaw = this.cache.getWithStats<{ data: ScryfallSet[] }>(rawSetsKey);
    const allSets = cachedRaw?.data ?? (
      await this.makeRequest<ScryfallListResponse<ScryfallSet>>(`${this.baseUrl}/sets`)
    ).data;

    if (!cachedRaw) {
      this.cache.setWithType(rawSetsKey, { data: allSets }, "set_data");
    }

    const filters = params ?? {};
    if (Object.values(filters).every((value) => value === undefined)) {
      return allSets;
    }

    const filteredKey = CacheService.createSetFilterKey(filters);
    const cachedFiltered = this.cache.getWithStats<ScryfallSet[]>(filteredKey);
    if (cachedFiltered) {
      return cachedFiltered;
    }

    const filteredSets = filterSets(allSets, filters);
    this.cache.setWithType(filteredKey, filteredSets, "set_data");
    return filteredSets;
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
      const response = await this.fetchWithTimeout(
        downloadUri,
        { "User-Agent": this.userAgent },
        this.timeoutMs() * 2
      );

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
   * Streams bulk card data (doesn't count against rate limits)
   */
  async *streamBulkData(downloadUri: string): AsyncGenerator<ScryfallCard> {
    try {
      const response = await this.fetchWithTimeout(
        downloadUri,
        { "User-Agent": this.userAgent },
        this.timeoutMs() * 2
      );

      if (response.status >= 400 || !response.body) {
        throw new ScryfallAPIError(
          `Failed to download bulk data: HTTP ${response.status}`,
          response.status
        );
      }

      for await (const card of iterateArrayStream<ScryfallCard>(response.body)) {
        yield card;
      }
    } catch (error) {
      if (error instanceof ScryfallAPIError) {
        throw error;
      }

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
