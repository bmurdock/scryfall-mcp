import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScryfallMCPServer } from './server.js';

async function main() {
  const server = new Server(
    {
      name: 'scryfall-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  const scryfallServer = new ScryfallMCPServer();
  await scryfallServer.setupHandlers(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);