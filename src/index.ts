import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScryfallMCPServer } from './server.js';
import { mcpLogger } from './services/logger.js';

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

  mcpLogger.info({ operation: 'startup' }, 'scryfall-mcp server started');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    try {
      mcpLogger.info({ operation: 'shutdown', signal }, 'Shutting down server');
      scryfallServer.destroy();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  mcpLogger.fatal({ operation: 'startup', error: err }, 'Unhandled startup error');
  process.exit(1);
});
