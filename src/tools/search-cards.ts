import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ScryfallClient } from '../services/scryfall-client.js';
import {
  validateSearchCardsParams,
  validateScryfallQuery
} from '../utils/validators.js';
import {
  formatSearchResultsAsText,
  formatSearchResultsAsJson
} from '../utils/formatters.js';
import {
  SearchCardsParams,
  ScryfallAPIError,
  ValidationError
} from '../types/mcp-types.js';

/**
 * MCP Tool for searching Magic: The Gathering cards using Scryfall syntax
 */
export class SearchCardsTool {
  readonly name = 'search_cards';
  readonly description = 'Search for Magic: The Gathering cards using Scryfall search syntax. Supports complex queries with operators like color:, type:, set:, etc.';

  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Scryfall search query using their syntax (e.g., "lightning bolt", "c:red type:instant", "set:dom")'
      },
      limit: {
        type: 'number',
        description: 'Number of cards to return (1-175)',
        minimum: 1,
        maximum: 175,
        default: 20
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (starts at 1)',
        minimum: 1,
        default: 1
      },
      format: {
        type: 'string',
        enum: ['json', 'text'],
        description: 'Response format - text for human-readable, json for structured data',
        default: 'text'
      },
      include_extras: {
        type: 'boolean',
        description: 'Include tokens, emblems, and other extras in search results',
        default: false
      },
      order: {
        type: 'string',
        enum: ['name', 'released', 'cmc', 'power', 'toughness', 'artist'],
        description: 'Sort order for results'
      }
    },
    required: ['query']
  };

  constructor(private scryfallClient: ScryfallClient) {}

  async execute(args: unknown) {
    try {
      // Validate parameters
      const params = validateSearchCardsParams(args);

      // Validate Scryfall query syntax
      validateScryfallQuery(params.query);

      // Execute search
      const results = await this.scryfallClient.searchCards({
        query: params.query,
        limit: params.limit,
        page: params.page,
        include_extras: params.include_extras,
        order: params.order,
      });

      // Handle no results
      if (results.total_cards === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No cards found matching "${params.query}". Try adjusting your search terms or check the Scryfall syntax.`
            }
          ]
        };
      }

      // Format response based on requested format
      let responseText: string;
      if (params.format === 'json') {
        const formattedResults = formatSearchResultsAsJson(results, params.page, params.limit);
        responseText = JSON.stringify(formattedResults, null, 2);
      } else {
        responseText = formatSearchResultsAsText(results, params.page, params.limit);
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ]
      };

    } catch (error) {
      // Handle different error types
      if (error instanceof ValidationError) {
        return {
          content: [
            {
              type: 'text',
              text: `Validation error: ${error.message}`
            }
          ],
          isError: true
        };
      }

      if (error instanceof ScryfallAPIError) {
        let errorMessage = `Scryfall API error: ${error.message}`;

        if (error.status === 404) {
          errorMessage = `No cards found matching "${(args as any)?.query || 'your query'}". The search query may be invalid or too specific.`;
        } else if (error.status === 422) {
          errorMessage = `Invalid search query syntax. Please check your Scryfall search syntax and try again.`;
        } else if (error.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        }

        return {
          content: [
            {
              type: 'text',
              text: errorMessage
            }
          ],
          isError: true
        };
      }

      // Generic error handling
      return {
        content: [
          {
            type: 'text',
            text: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          }
        ],
        isError: true
      };
    }
  }
}