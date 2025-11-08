import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ScryfallMCPServer } from './server.js';
import { mcpLogger } from './services/logger.js';
import type { IncomingMessage, ServerResponse } from 'http';

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const corsOptions = {
  origin: '*', // Public API - no origin restrictions
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'MCP-Session-ID'],
  credentials: false,
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

async function main() {
  const app = express();

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'scryfall-mcp-server',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/mcp', limiter, async (req, res) => {
    try {
      const server = new Server(
        {
          name: 'scryfall-mcp-server',
          version: '2.0.0',
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

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true, // JSON-only, no SSE streaming
      });

      await server.connect(transport);

      await transport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        req.body
      );

      scryfallServer.destroy();
    } catch (error) {
      mcpLogger.error(
        { operation: 'mcp-request', error: error as Error },
        'Error handling MCP request'
      );

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: 'This is an MCP server. Use POST /mcp for MCP requests.',
    });
  });

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    mcpLogger.info(
      {
        operation: 'startup',
        port: PORT,
        environment: NODE_ENV,
      },
      `scryfall-mcp HTTP server listening on 0.0.0.0:${PORT}`
    );
  });

  const shutdown = async (signal: string) => {
    try {
      mcpLogger.info({ operation: 'shutdown', signal }, 'Shutting down server');

      httpServer.close(() => {
        mcpLogger.info({ operation: 'shutdown' }, 'HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        mcpLogger.warn(
          { operation: 'shutdown' },
          'Forcing shutdown after timeout'
        );
        process.exit(1);
      }, 10000);
    } catch (error) {
      mcpLogger.error({ operation: 'shutdown', error: error as Error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  mcpLogger.fatal({ operation: 'startup', error: err }, 'Unhandled startup error');
  process.exit(1);
});
