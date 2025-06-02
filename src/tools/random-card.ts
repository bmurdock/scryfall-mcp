import { ScryfallClient } from '../services/scryfall-client.js';
import { validateRandomCardParams } from '../utils/validators.js';
import { formatCardDetails } from '../utils/formatters.js';
import { 
  ScryfallAPIError, 
  ValidationError 
} from '../types/mcp-types.js';

/**
 * MCP Tool for getting a random Magic: The Gathering card
 */
export class RandomCardTool {
  readonly name = 'random_card';
  readonly description = 'Get a random Magic: The Gathering card, optionally filtered by format or search criteria';
  
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Optional Scryfall search query to filter random selection (e.g., "c:red", "type:creature")'
      },
      format: {
        type: 'string',
        enum: ['standard', 'modern', 'legacy', 'vintage', 'commander'],
        description: 'Magic format to filter by legality'
      }
    },
    required: []
  };

  constructor(private readonly scryfallClient: ScryfallClient) {}

  async execute(args: unknown) {
    try {
      // Validate parameters
      const params = validateRandomCardParams(args);

      // Build query with format filter if specified
      let query = params.query || '';
      
      if (params.format) {
        const formatQuery = `legal:${params.format}`;
        query = query ? `${query} ${formatQuery}` : formatQuery;
      }

      // Execute random card lookup
      const card = await this.scryfallClient.getRandomCard(query || undefined);

      // Format detailed card information
      const responseText = formatCardDetails(card, true);

      // Add context about the randomization
      let contextNote = '\n\n---\n*This is a randomly selected card';
      if (params.format) {
        contextNote += ` that is legal in ${params.format}`;
      }
      if (params.query) {
        contextNote += ` matching the query "${params.query}"`;
      }
      contextNote += '.*';

      return {
        content: [
          {
            type: 'text',
            text: responseText + contextNote
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
          const query = (args as any)?.query;
          const format = (args as any)?.format;
          
          if (query || format) {
            errorMessage = `No cards found matching the specified criteria`;
            if (format) errorMessage += ` (format: ${format})`;
            if (query) errorMessage += ` (query: "${query}")`;
            errorMessage += '. Try broadening your search criteria.';
          } else {
            errorMessage = 'Unable to find a random card. This is unusual - please try again.';
          }
        } else if (error.status === 422) {
          errorMessage = `Invalid search criteria. Check your query syntax and format specification.`;
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
