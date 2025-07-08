import { ScryfallClient } from '../services/scryfall-client.js';
import { 
  validateGetCardParams, 
  validateCardIdentifier 
} from '../utils/validators.js';
import { formatCardDetails } from '../utils/formatters.js';
import { 
  ScryfallAPIError, 
  ValidationError,
  GetCardParams
} from '../types/mcp-types.js';

/**
 * MCP Tool for retrieving a single Magic: The Gathering card
 */
export class GetCardTool {
  readonly name = 'get_card';
  readonly description = 'Get detailed information about a specific Magic: The Gathering card by name, set code+number, or Scryfall ID';
  
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      identifier: {
        type: 'string',
        description: 'Card name, set code+collector number (e.g., "dom/123"), or Scryfall UUID'
      },
      set: {
        type: 'string',
        description: '3-letter set code for disambiguation when using card name',
        pattern: '^[a-zA-Z0-9]{3,4}$'
      },
      lang: {
        type: 'string',
        description: '2-letter language code (default: en)',
        pattern: '^[a-z]{2}$',
        default: 'en'
      },
      face: {
        type: 'string',
        enum: ['front', 'back'],
        description: 'Which face to show for double-faced cards'
      },
      include_image: {
        type: 'boolean',
        description: 'Include image URL in response',
        default: true
      }
    },
    required: ['identifier']
  };

  constructor(private readonly scryfallClient: ScryfallClient) {}

  async execute(args: unknown) {
    try {
      // Validate parameters
      const params = validateGetCardParams(args);
      
      // Validate card identifier format
      validateCardIdentifier(params.identifier);

      // Execute card lookup
      const card = await this.scryfallClient.getCard({
        identifier: params.identifier,
        set: params.set,
        lang: params.lang,
        face: params.face
      });

      // Format detailed card information
      const responseText = formatCardDetails(card, params.include_image);

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
          errorMessage = `Card not found: "${(args as GetCardParams)?.identifier ?? 'unknown'}". Check the card name, set code, or ID.`;
        } else if (error.status === 422) {
          errorMessage = `Invalid card identifier format. Use card name, "SET/NUMBER", or Scryfall UUID.`;
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
