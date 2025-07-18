import { ScryfallClient } from "../services/scryfall-client.js";
import {
  validateSearchCardsParams,
  validateScryfallQuery,
  type ValidationResult,
} from "../utils/validators.js";
import { formatSearchResultsAsText, formatSearchResultsAsJson } from "../utils/formatters.js";
import { ScryfallAPIError, ValidationError, SearchCardsParams } from "../types/mcp-types.js";

/**
 * MCP Tool for searching Magic: The Gathering cards using Scryfall syntax
 */
export class SearchCardsTool {
  readonly name = "search_cards";
  readonly description =
    "Search for Magic: The Gathering cards using Scryfall search syntax. Supports complex queries with operators like color:, type:, set:, etc.";

  readonly inputSchema = {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description:
          'Scryfall search query using their syntax (e.g., "lightning bolt", "c:red type:instant", "set:dom")',
      },
      limit: {
        type: "number",
        description: "Number of cards to return (1-175)",
        minimum: 1,
        maximum: 175,
        default: 20,
      },
      page: {
        type: "number",
        description: "Page number for pagination (starts at 1)",
        minimum: 1,
        default: 1,
      },
      format: {
        type: "string",
        enum: ["json", "text"],
        description: "Response format - text for human-readable, json for structured data",
        default: "text",
      },
      include_extras: {
        type: "boolean",
        description: "Include tokens, emblems, and other extras in search results",
        default: false,
      },
      order: {
        type: "string",
        enum: [
          "name",
          "released",
          "cmc",
          "power",
          "toughness",
          "artist",
          "set",
          "rarity",
          "color",
          "usd",
          "eur",
          "tix",
          "edhrec",
          "penny",
          "review",
        ],
        description: "Sort order for results",
      },
      unique: {
        type: "string",
        enum: ["cards", "art", "prints"],
        description: "Strategy for omitting similar cards",
        default: "cards",
      },
      direction: {
        type: "string",
        enum: ["asc", "desc", "auto"],
        description: "Sort direction",
        default: "auto",
      },
      include_multilingual: {
        type: "boolean",
        description: "Include cards in all languages",
        default: false,
      },
      include_variations: {
        type: "boolean",
        description: "Include rare card variants",
        default: false,
      },
      price_range: {
        type: "object",
        properties: {
          min: {
            type: "number",
            minimum: 0,
            description: "Minimum price",
          },
          max: {
            type: "number",
            minimum: 0,
            description: "Maximum price",
          },
          currency: {
            type: "string",
            enum: ["usd", "eur", "tix"],
            default: "usd",
            description: "Currency for price filtering",
          },
        },
        description: "Price filtering constraints",
      },
      arena_only: {
        type: "boolean",
        description: "Only return cards available in Arena",
        default: false,
      },
    },
    required: ["query"],
  };

  constructor(private scryfallClient: ScryfallClient) {}

  async execute(args: unknown) {
    try {
      // Validate parameters
      const params = validateSearchCardsParams(args);

      // Enhanced Scryfall query validation
      const validationResult = await validateScryfallQuery(params.query);

      // If validation fails, return detailed error information
      if (!validationResult.isValid) {
        return {
          content: [
            {
              type: "text",
              text: this.formatValidationErrors(validationResult),
            },
          ],
          isError: true,
        };
      }

      // If there are warnings, we can still proceed but inform the user
      if (validationResult.warnings.length > 0) {
        // Could log warnings or include them in response
      }

      // Build final query with Arena filtering if requested
      let finalQuery = params.query;
      if (params.arena_only) {
        finalQuery += " game:arena";
      }

      // Execute search (request ID will be generated by the service if not provided)
      const results = await this.scryfallClient.searchCards({
        query: finalQuery,
        limit: params.limit,
        page: params.page,
        include_extras: params.include_extras,
        order: params.order,
        unique: params.unique,
        direction: params.direction,
        include_multilingual: params.include_multilingual,
        include_variations: params.include_variations,
        price_range: params.price_range,
      });

      // Handle no results
      if (results.total_cards === 0 || results.data.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No cards found matching "${params.query}". Try adjusting your search terms or check the Scryfall syntax.`,
            },
          ],
        };
      }

      // Format response based on requested format
      let responseText: string;
      if (params.format === "json") {
        const formattedResults = formatSearchResultsAsJson(results, params.page, params.limit);
        responseText = JSON.stringify(formattedResults, null, 2);
      } else {
        responseText = formatSearchResultsAsText(results, params.page, params.limit);
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      // Handle different error types
      if (error instanceof ValidationError) {
        return {
          content: [
            {
              type: "text",
              text: `Validation error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      if (error instanceof ScryfallAPIError) {
        let errorMessage = `Scryfall API error: ${error.message}`;

        if (error.status === 404) {
          errorMessage = `No cards found matching "${
            (args as SearchCardsParams)?.query || "your query"
          }". The search query may be invalid or too specific.`;
        } else if (error.status === 422) {
          errorMessage = `Invalid search query syntax. Please check your Scryfall search syntax and try again.`;
        } else if (error.status === 429) {
          errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        }

        return {
          content: [
            {
              type: "text",
              text: errorMessage,
            },
          ],
          isError: true,
        };
      }

      // Generic error handling
      return {
        content: [
          {
            type: "text",
            text: `Unexpected error: ${
              error instanceof Error ? error.message : "Unknown error occurred"
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Format validation errors into a user-friendly message
   */
  private formatValidationErrors(validationResult: ValidationResult): string {
    let message = "**Query Validation Issues Found:**\n\n";

    // Format errors
    if (validationResult.errors.length > 0) {
      message += "**Errors:**\n";
      for (const error of validationResult.errors) {
        message += `❌ ${error.message}`;
        if (error.position !== undefined) {
          message += ` (position ${error.position})`;
        }
        message += "\n";
      }
      message += "\n";
    }

    // Format warnings
    if (validationResult.warnings.length > 0) {
      message += "**Warnings:**\n";
      for (const warning of validationResult.warnings) {
        message += `⚠️ ${warning.message}\n`;
      }
      message += "\n";
    }

    // Format suggestions
    if (validationResult.suggestions && validationResult.suggestions.length > 0) {
      message += "**Suggestions:**\n";
      for (const suggestion of validationResult.suggestions) {
        message += `💡 ${suggestion}\n`;
      }
      message += "\n";
    }

    // Add helpful tips
    message += "**Tips:**\n";
    message +=
      "• Use operators like `c:red` for color, `t:creature` for type, `f:modern` for format\n";
    message += "• Combine with boolean logic: `c:red AND t:creature`\n";
    message += '• Use quotes for exact phrases: `o:"enters the battlefield"`\n';
    message += "• Use comparison operators: `cmc>=3`, `pow<=2`\n";

    return message;
  }
}
