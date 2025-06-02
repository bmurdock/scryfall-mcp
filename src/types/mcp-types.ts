import { z } from 'zod';

// Tool Parameter Schemas
export const SearchCardsParamsSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  limit: z.number().int().min(1).max(175).optional().default(20),
  page: z.number().int().min(1).optional().default(1),
  format: z.enum(['json', 'text']).optional().default('text'),
  include_extras: z.boolean().optional().default(false),
  order: z.enum(['name', 'released', 'cmc', 'power', 'toughness', 'artist']).optional()
});

export const GetCardParamsSchema = z.object({
  identifier: z.string().min(1, 'Identifier cannot be empty'),
  set: z.string().length(3).optional(),
  lang: z.string().length(2).optional().default('en'),
  face: z.enum(['front', 'back']).optional(),
  include_image: z.boolean().optional().default(true)
});

export const GetCardPricesParamsSchema = z.object({
  card_id: z.string().uuid('Invalid card ID format'),
  currency: z.enum(['usd', 'eur', 'tix']).optional().default('usd'),
  format: z.enum(['paper', 'mtgo', 'arena']).optional().default('paper'),
  include_history: z.boolean().optional().default(false)
});

export const RandomCardParamsSchema = z.object({
  query: z.string().optional(),
  format: z.enum(['standard', 'modern', 'legacy', 'vintage', 'commander']).optional()
});

export const SearchSetsParamsSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['core', 'expansion', 'masters', 'commander', 'draft_innovation', 'funny']).optional(),
  released_after: z.string().datetime().optional(),
  released_before: z.string().datetime().optional()
});

// Inferred Types
export type SearchCardsParams = z.infer<typeof SearchCardsParamsSchema>;
export type GetCardParams = z.infer<typeof GetCardParamsSchema>;
export type GetCardPricesParams = z.infer<typeof GetCardPricesParamsSchema>;
export type RandomCardParams = z.infer<typeof RandomCardParamsSchema>;
export type SearchSetsParams = z.infer<typeof SearchSetsParamsSchema>;

// Cache Configuration
export const CACHE_DURATIONS = {
  card_search: 30 * 60 * 1000,      // 30 minutes
  card_details: 24 * 60 * 60 * 1000, // 24 hours
  card_prices: 6 * 60 * 60 * 1000,   // 6 hours
  set_data: 7 * 24 * 60 * 60 * 1000, // 1 week
  bulk_data: 24 * 60 * 60 * 1000,    // 24 hours
} as const;

// HTTP Client Configuration
export const REQUIRED_HEADERS = {
  'User-Agent': 'ScryfallMCPServer/1.0 (contact@example.com)',
  'Accept': 'application/json',
  'Accept-Encoding': 'gzip'
} as const;

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
  minInterval: 75, // 75ms minimum between requests
  maxRetries: 3,
  backoffMultiplier: 2,
  maxBackoffMs: 5000
} as const;

// MCP Tool Definitions
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// MCP Resource Definitions
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

// MCP Prompt Definitions
export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

// Error Types
export class ScryfallAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: string
  ) {
    super(message);
    this.name = 'ScryfallAPIError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Cache Entry Interface
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Formatted Response Types
export interface FormattedCard {
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  set_name: string;
  rarity: string;
  prices: {
    usd?: string;
    eur?: string;
    tix?: string;
  };
  legalities: Record<string, string>;
  image_url?: string;
}

export interface FormattedSearchResult {
  total_cards: number;
  has_more: boolean;
  cards: FormattedCard[];
  page_info?: {
    current_page: number;
    total_pages: number;
    next_page?: string;
  };
}

export interface FormattedSet {
  name: string;
  code: string;
  type: string;
  released_at?: string;
  card_count: number;
  digital: boolean;
  icon_url: string;
}
