import { ScryfallClient } from '../services/scryfall-client.js';
import { validateGetCardPricesParams } from '../utils/validators.js';
import { formatCardPrices } from '../utils/formatters.js';
import { 
  ScryfallAPIError, 
  ValidationError 
} from '../types/mcp-types.js';

/**
 * MCP Tool for retrieving card price information
 */
export class GetCardPricesTool {
  readonly name = 'get_card_prices';
  readonly description = 'Get current price information for a Magic: The Gathering card by Scryfall ID';
  
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      card_id: {
        type: 'string',
        description: 'Scryfall UUID of the card',
        pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      },
      currency: {
        type: 'string',
        enum: ['usd', 'eur', 'tix'],
        description: 'Currency type for prices',
        default: 'usd'
      },
      format: {
        type: 'string',
        enum: ['paper', 'mtgo', 'arena'],
        description: 'Game format for pricing context',
        default: 'paper'
      },
      include_history: {
        type: 'boolean',
        description: 'Include price trend data (not implemented in Scryfall API)',
        default: false
      }
    },
    required: ['card_id']
  };

  constructor(private readonly scryfallClient: ScryfallClient) {}

  async execute(args: unknown) {
    try {
      // Validate parameters
      const params = validateGetCardPricesParams(args);

      // Execute price lookup
      const card = await this.scryfallClient.getCardPrices(params.card_id, params.currency);

      // Format price information
      const responseText = formatCardPrices(card, params.currency);

      // Add format context if specified
      let contextNote = '';
      if (params.format !== 'paper') {
        if (params.format === 'mtgo' && params.currency !== 'tix') {
          contextNote = '\n\nNote: For MTGO, consider using currency "tix" for more relevant pricing.';
        } else if (params.format === 'arena') {
          contextNote = '\n\nNote: Arena uses gems/gold, not traditional currency. Prices shown are for paper/MTGO reference.';
        }
      }

      if (params.include_history) {
        contextNote += '\n\nNote: Price history is not available through the Scryfall API.';
      }

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
          errorMessage = `Card not found with ID: "${(args as any)?.card_id ?? 'unknown'}". Verify the Scryfall UUID is correct.`;
        } else if (error.status === 422) {
          errorMessage = `Invalid card ID format. Must be a valid Scryfall UUID.`;
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
