import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ScryfallMCPServer, createConfiguredServer } from '../src/server.js';

async function invokeRequest(server: Server, method: string, params: Record<string, unknown> = {}) {
  const handlers = (server as unknown as { _requestHandlers: Map<string, (request: unknown) => Promise<unknown>> })._requestHandlers;
  const handler = handlers.get(method);

  if (!handler) {
    throw new Error(`No handler registered for ${method}`);
  }

  return handler({
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  });
}

describe('MCP server smoke tests', () => {
  let appServer: ScryfallMCPServer;
  let sdkServer: Server;
  let mockScryfallClient: {
    searchCards: ReturnType<typeof vi.fn>;
    getCard: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const configuredServer = await createConfiguredServer({
      name: 'scryfall-mcp-test',
      version: '1.0.0',
    });

    appServer = configuredServer.appServer;
    sdkServer = configuredServer.sdkServer;

    mockScryfallClient = {
      searchCards: vi.fn(),
      getCard: vi.fn(),
    };

    Object.assign((appServer as unknown as { scryfallClient: unknown }).scryfallClient as object, mockScryfallClient);
  });

  afterEach(() => {
    appServer.destroy();
    vi.clearAllMocks();
  });

  it('lists registered tools through the MCP server handler', async () => {
    const result = await invokeRequest(sdkServer, 'tools/list');
    const tools = (result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);

    expect(tools).toContain('search_cards');
    expect(tools).toContain('query_rules');
    expect(tools).toContain('suggest_mana_base');
  });

  it('executes a search tool through the server layer using the registered call handler', async () => {
    mockScryfallClient.searchCards.mockResolvedValue({
      total_cards: 1,
      has_more: false,
      data: [
        {
          id: 'bolt-id',
          name: 'Lightning Bolt',
          mana_cost: '{R}',
          type_line: 'Instant',
          oracle_text: 'Lightning Bolt deals 3 damage to any target.',
          set_name: 'Magic 2010',
          rarity: 'common',
          prices: { usd: '1.00' },
          legalities: { modern: 'legal' },
        },
      ],
    });

    const result = await invokeRequest(sdkServer, 'tools/call', {
      name: 'search_cards',
      arguments: {
        query: 'Lightning Bolt',
        limit: 5,
      },
    });

    const response = result as { content: Array<{ text: string }>; isError?: boolean };
    expect(response.isError).toBeUndefined();
    expect(response.content[0].text).toContain('Lightning Bolt');
    expect(mockScryfallClient.searchCards).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Lightning Bolt',
        limit: 5,
      })
    );
  });

  it('executes the rules lookup tool through the server layer', async () => {
    const result = await invokeRequest(sdkServer, 'tools/call', {
      name: 'query_rules',
      arguments: {
        query: 'state-based actions',
        context_lines: 1,
      },
    });

    const response = result as { content: Array<{ text: string }>; isError?: boolean };
    expect(response.isError).toBeUndefined();
    expect(response.content[0].text).toContain('Found');
    expect(response.content[0].text).toContain('state-based actions');
    expect(response.content[0].text).toContain('704. State-Based Actions');
  });

  it('executes a recommendation-oriented tool through the server layer', async () => {
    const result = await invokeRequest(sdkServer, 'tools/call', {
      name: 'suggest_mana_base',
      arguments: {
        color_requirements: 'WU',
        deck_size: 60,
        format: 'modern',
        strategy: 'control',
        budget: 'moderate',
      },
    });

    const response = result as { content: Array<{ text: string }>; isError?: boolean };
    expect(response.isError).toBeUndefined();
    expect(response.content[0].text).toContain('**Mana Base Suggestion**');
    expect(response.content[0].text).toContain('• Colors: WU');
    expect(response.content[0].text).toContain('🌈 **Dual Lands:**');
  });
});
