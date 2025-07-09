import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ScryfallClient } from './services/scryfall-client.js';
import { RateLimiter } from './services/rate-limiter.js';
import { CacheService } from './services/cache-service.js';

// Tools
import { SearchCardsTool } from './tools/search-cards.js';
import { GetCardTool } from './tools/get-card.js';
import { GetCardPricesTool } from './tools/get-card-prices.js';
import { RandomCardTool } from './tools/random-card.js';
import { SearchSetsTool } from './tools/search-sets.js';
import { QueryRulesTool } from './tools/query-rules.js';
import { SearchFormatStaplesTool } from './tools/search-format-staples.js';
import { SearchAlternativesTool } from './tools/search-alternatives.js';
import { FindSynergisticCardsTool } from './tools/find-synergistic-cards.js';
import { BatchCardAnalysisTool } from './tools/batch-card-analysis.js';
import { ValidateBrawlCommanderTool } from './tools/validate-brawl-commander.js';
import { BuildScryfallQueryTool } from './tools/build-scryfall-query.js';

// Resources
import { CardDatabaseResource } from './resources/card-database.js';
import { SetDatabaseResource } from './resources/set-database.js';

// Prompts
import { AnalyzeCardPrompt } from './prompts/analyze-card.js';
import { BuildDeckPrompt } from './prompts/build-deck.js';

/**
 * Main MCP Server for Scryfall integration
 */
export class ScryfallMCPServer {
  private readonly scryfallClient: ScryfallClient;
  private readonly rateLimiter: RateLimiter;
  private readonly cache: CacheService;
  private readonly tools: Map<string, any>;
  private readonly resources: Map<string, any>;
  private readonly prompts: Map<string, any>;

  constructor() {
    // Initialize core services
    this.rateLimiter = new RateLimiter();
    this.cache = new CacheService();
    this.scryfallClient = new ScryfallClient(this.rateLimiter, this.cache);

    // Initialize tools
    this.tools = new Map();
    this.tools.set('search_cards', new SearchCardsTool(this.scryfallClient));
    this.tools.set('get_card', new GetCardTool(this.scryfallClient));
    this.tools.set('get_card_prices', new GetCardPricesTool(this.scryfallClient));
    this.tools.set('random_card', new RandomCardTool(this.scryfallClient));
    this.tools.set('search_sets', new SearchSetsTool(this.scryfallClient));
    this.tools.set('query_rules', new QueryRulesTool());
    this.tools.set('search_format_staples', new SearchFormatStaplesTool(this.scryfallClient));
    this.tools.set('search_alternatives', new SearchAlternativesTool(this.scryfallClient));
    this.tools.set('find_synergistic_cards', new FindSynergisticCardsTool(this.scryfallClient));
    this.tools.set('batch_card_analysis', new BatchCardAnalysisTool(this.scryfallClient));
    this.tools.set('validate_brawl_commander', new ValidateBrawlCommanderTool(this.scryfallClient));
    this.tools.set('build_scryfall_query', new BuildScryfallQueryTool(this.scryfallClient));

    // Initialize resources
    this.resources = new Map();
    this.resources.set('card-database://bulk', new CardDatabaseResource(this.scryfallClient, this.cache));
    this.resources.set('set-database://all', new SetDatabaseResource(this.scryfallClient, this.cache));

    // Initialize prompts
    this.prompts = new Map();
    this.prompts.set('analyze_card', new AnalyzeCardPrompt(this.scryfallClient));
    this.prompts.set('build_deck', new BuildDeckPrompt(this.scryfallClient));
  }

  async setupHandlers(server: Server) {
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Execute tools
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.tools.get(name);

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        return await tool.execute(args);
      } catch (error) {
        // Log error for debugging
        console.error(`Tool execution error for ${name}:`, error);
        throw error;
      }
    });

    // List resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: Array.from(this.resources.values()).map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
        })),
      };
    });

    // Read resources
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const resource = this.resources.get(uri);

      if (!resource) {
        throw new Error(`Unknown resource: ${uri}`);
      }

      try {
        const data = await resource.getData();
        return {
          contents: [
            {
              uri,
              mimeType: resource.mimeType,
              text: data,
            },
          ],
        };
      } catch (error) {
        console.error(`Resource access error for ${uri}:`, error);
        throw error;
      }
    });

    // List prompts
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: Array.from(this.prompts.values()).map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        })),
      };
    });

    // Get prompts
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const prompt = this.prompts.get(name);

      if (!prompt) {
        throw new Error(`Unknown prompt: ${name}`);
      }

      try {
        const promptText = await prompt.generatePrompt(args || {});
        return {
          description: `${prompt.description} - ${Object.entries(args || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: promptText,
              },
            },
          ],
        };
      } catch (error) {
        console.error(`Prompt generation error for ${name}:`, error);
        throw error;
      }
    });
  }

  /**
   * Gets server statistics and status
   */
  getStatus() {
    return {
      cache: this.cache.getStats(),
      rateLimiter: this.rateLimiter.getStatus(),
      tools: Array.from(this.tools.keys()),
      resources: Array.from(this.resources.keys()),
      prompts: Array.from(this.prompts.keys()),
    };
  }

  /**
   * Clears all caches
   */
  clearCaches(): void {
    this.cache.clear();
  }

  /**
   * Resets rate limiter
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
    this.scryfallClient.destroy();
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; services: Record<string, string> }> {
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        cache: 'healthy',
        rateLimiter: 'healthy',
        scryfallClient: 'healthy'
      }
    };

    try {
      // Test cache
      this.cache.set('health_check', 'test', 1000);
      const cacheTest = this.cache.get('health_check');
      if (cacheTest !== 'test') {
        status.services.cache = 'unhealthy';
        status.status = 'degraded';
      }

      // Test rate limiter
      const rateLimiterStatus = this.rateLimiter.getStatus();
      if (rateLimiterStatus.consecutiveErrors > 5) {
        status.services.rateLimiter = 'unhealthy';
        status.status = 'degraded';
      }

      // Test Scryfall client with a simple request
      await this.scryfallClient.getRandomCard();

    } catch (error) {
      status.services.scryfallClient = 'unhealthy';
      status.status = 'unhealthy';
    }

    return status;
  }
}