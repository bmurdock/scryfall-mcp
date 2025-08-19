import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ScryfallClient } from "./services/scryfall-client.js";
import { RateLimiter } from "./services/rate-limiter.js";
import { CacheService } from "./services/cache-service.js";
import { mcpLogger, ErrorMonitor } from "./services/logger.js";
import {
  ToolExecutionError,
  ResourceError,
  PromptError,
  generateRequestId,
  wrapError,
} from "./types/mcp-errors.js";
import { EnvValidators } from "./utils/env-parser.js";

// Tools
import { SearchCardsTool } from "./tools/search-cards.js";
import { GetCardTool } from "./tools/get-card.js";
import { GetCardPricesTool } from "./tools/get-card-prices.js";
import { RandomCardTool } from "./tools/random-card.js";
import { SearchSetsTool } from "./tools/search-sets.js";
import { QueryRulesTool } from "./tools/query-rules.js";
import { SearchFormatStaplesTool } from "./tools/search-format-staples.js";
import { SearchAlternativesTool } from "./tools/search-alternatives.js";
import { FindSynergisticCardsTool } from "./tools/find-synergistic-cards.js";
import { BatchCardAnalysisTool } from "./tools/batch-card-analysis.js";
import { ValidateBrawlCommanderTool } from "./tools/validate-brawl-commander.js";
import { BuildScryfallQueryTool } from "./tools/build-scryfall-query.js";
import { AnalyzeDeckCompositionTool } from "./tools/analyze-deck-composition.js";
import { SuggestManaBaseTool } from "./tools/suggest-mana-base.js";

// Resources
import { CardDatabaseResource } from "./resources/card-database.js";
import { SetDatabaseResource } from "./resources/set-database.js";

// Prompts
import { AnalyzeCardPrompt } from "./prompts/analyze-card.js";
import { BuildDeckPrompt } from "./prompts/build-deck.js";

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
    this.tools.set("search_cards", new SearchCardsTool(this.scryfallClient));
    this.tools.set("get_card", new GetCardTool(this.scryfallClient));
    this.tools.set("get_card_prices", new GetCardPricesTool(this.scryfallClient));
    this.tools.set("random_card", new RandomCardTool(this.scryfallClient));
    this.tools.set("search_sets", new SearchSetsTool(this.scryfallClient));
    this.tools.set("query_rules", new QueryRulesTool());
    this.tools.set("search_format_staples", new SearchFormatStaplesTool(this.scryfallClient));
    this.tools.set("search_alternatives", new SearchAlternativesTool(this.scryfallClient));
    this.tools.set("find_synergistic_cards", new FindSynergisticCardsTool(this.scryfallClient));
    this.tools.set("batch_card_analysis", new BatchCardAnalysisTool(this.scryfallClient));
    this.tools.set("validate_brawl_commander", new ValidateBrawlCommanderTool(this.scryfallClient));
    this.tools.set("build_scryfall_query", new BuildScryfallQueryTool(this.scryfallClient));
    this.tools.set("analyze_deck_composition", new AnalyzeDeckCompositionTool(this.scryfallClient));
    this.tools.set("suggest_mana_base", new SuggestManaBaseTool(this.scryfallClient));

    // Initialize resources
    this.resources = new Map();
    this.resources.set(
      "card-database://bulk",
      new CardDatabaseResource(this.scryfallClient, this.cache)
    );
    this.resources.set(
      "set-database://all",
      new SetDatabaseResource(this.scryfallClient, this.cache)
    );

    // Initialize prompts
    this.prompts = new Map();
    this.prompts.set("analyze_card", new AnalyzeCardPrompt(this.scryfallClient));
    this.prompts.set("build_deck", new BuildDeckPrompt(this.scryfallClient));
  }

  async setupHandlers(server: Server) {
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Execute tools
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requestId = generateRequestId();
      const tool = this.tools.get(name);

      mcpLogger.toolStart(requestId, name, args);

      if (!tool) {
        const error = new ToolExecutionError(
          name,
          new Error("Tool not found"),
          { args },
          requestId
        );
        mcpLogger.toolError(requestId, name, error, args);
        throw error;
      }

      try {
        const result = await tool.execute(args);
        mcpLogger.toolComplete(requestId, name);
        return result;
      } catch (error) {
        const toolError =
          error instanceof Error
            ? new ToolExecutionError(name, error, { args }, requestId)
            : wrapError(error, `Tool execution: ${name}`, requestId);

        ErrorMonitor.trackError(toolError.code, requestId);
        mcpLogger.toolError(requestId, name, toolError, args);
        throw toolError;
      }
    });

    // List resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: Array.from(this.resources.values()).map((resource) => ({
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
      const requestId = generateRequestId();
      const resource = this.resources.get(uri);

      mcpLogger.request(requestId, "read_resource", { resourceUri: uri });

      if (!resource) {
        const error = new ResourceError(
          uri,
          "read",
          new Error("Resource not found"),
          {},
          requestId
        );
        mcpLogger.error({ requestId, resourceUri: uri, error }, "Resource not found");
        throw error;
      }

      try {
        const data = await resource.getData();
        mcpLogger.info({ requestId, resourceUri: uri }, "Resource read completed");
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
        const resourceError =
          error instanceof Error
            ? new ResourceError(uri, "read", error, {}, requestId)
            : wrapError(error, `Resource read: ${uri}`, requestId);

        ErrorMonitor.trackError(resourceError.code, requestId);
        mcpLogger.error(
          { requestId, resourceUri: uri, error: resourceError },
          "Resource access failed"
        );
        throw resourceError;
      }
    });

    // List prompts
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: Array.from(this.prompts.values()).map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        })),
      };
    });

    // Get prompts
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requestId = generateRequestId();
      const prompt = this.prompts.get(name);

      mcpLogger.request(requestId, "get_prompt", { promptName: name, args });

      if (!prompt) {
        const error = new PromptError(
          name,
          "get",
          new Error("Prompt not found"),
          { args },
          requestId
        );
        mcpLogger.error({ requestId, promptName: name, error }, "Prompt not found");
        throw error;
      }

      try {
        const promptText = await prompt.generatePrompt(args || {});
        mcpLogger.info({ requestId, promptName: name }, "Prompt generation completed");
        return {
          description: `${prompt.description} - ${Object.entries(args || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")}`,
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: promptText,
              },
            },
          ],
        };
      } catch (error) {
        const promptError =
          error instanceof Error
            ? new PromptError(name, "generate", error, { args }, requestId)
            : wrapError(error, `Prompt generation: ${name}`, requestId);

        ErrorMonitor.trackError(promptError.code, requestId);
        mcpLogger.error(
          { requestId, promptName: name, error: promptError },
          "Prompt generation failed"
        );
        throw promptError;
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
      monitoring: ErrorMonitor.getMonitoringReport(),
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
   * Health check endpoint with structured logging
   */
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    services: Record<string, string>;
    requestId: string;
  }> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    mcpLogger.healthCheck(requestId, "started");

    const status = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      requestId,
      services: {
        cache: "healthy",
        rateLimiter: "healthy",
        scryfallClient: "healthy",
      },
    };

    // Test cache service
    try {
      this.cache.set("health_check", "test", 1000);
      const cacheTest = this.cache.get("health_check");
      if (cacheTest !== "test") {
        status.services.cache = "unhealthy";
        status.status = "degraded";
        mcpLogger.warn({ requestId, service: "cache" }, "Cache health check failed");
      } else {
        mcpLogger.debug({ requestId, service: "cache" }, "Cache health check passed");
      }
    } catch (error) {
      status.services.cache = "unhealthy";
      status.status = "degraded";
      mcpLogger.error(
        {
          requestId,
          service: "cache",
          error: wrapError(error, "Cache health check", requestId),
        },
        "Cache health check error"
      );
    }

    // Test rate limiter service
    try {
      const rateLimiterStatus = this.rateLimiter.getStatus();
      if (rateLimiterStatus.consecutiveErrors > 5) {
        status.services.rateLimiter = "unhealthy";
        status.status = "degraded";
        mcpLogger.warn(
          {
            requestId,
            service: "rateLimiter",
            consecutiveErrors: rateLimiterStatus.consecutiveErrors,
          },
          "Rate limiter health check failed"
        );
      } else {
        mcpLogger.debug(
          {
            requestId,
            service: "rateLimiter",
            consecutiveErrors: rateLimiterStatus.consecutiveErrors,
          },
          "Rate limiter health check passed"
        );
      }
    } catch (error) {
      status.services.rateLimiter = "unhealthy";
      status.status = "degraded";
      mcpLogger.error(
        {
          requestId,
          service: "rateLimiter",
          error: wrapError(error, "Rate limiter health check", requestId),
        },
        "Rate limiter health check error"
      );
    }

    // Test Scryfall client service only on deep check
    const deepCheck = EnvValidators.healthCheckDeep(process.env.HEALTHCHECK_DEEP);
    if (deepCheck) {
      try {
        await this.scryfallClient.getRandomCard();
        mcpLogger.debug(
          { requestId, service: "scryfallClient" },
          "Scryfall client health check passed"
        );
      } catch (error) {
        status.services.scryfallClient = "unhealthy";
        status.status = "degraded";
        mcpLogger.error(
          {
            requestId,
            service: "scryfallClient",
            error: wrapError(error, "Scryfall client health check", requestId),
          },
          "Scryfall client health check failed"
        );
      }
    }

    const duration = Date.now() - startTime;
    mcpLogger.healthCheck(requestId, status.status, status.services);
    mcpLogger.performance(
      { requestId, operation: "health_check", duration },
      "Health check completed"
    );

    return status;
  }
}
