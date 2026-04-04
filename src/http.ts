import { randomUUID } from "node:crypto";
import {
  createServer as createNodeHttpServer,
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createSdkServer, MCP_SERVER_INFO, ScryfallMCPServer } from "./server.js";
import { mcpLogger } from "./services/logger.js";
import { parseEnvInt, parseEnvString } from "./utils/env-parser.js";

type SessionTransportRecord = {
  sdkServer: ReturnType<typeof createSdkServer>;
  transport: StreamableHTTPServerTransport;
};

export type HttpServerConfig = {
  host: string;
  port: number;
  mcpPath: string;
  healthPath: string;
  allowedOrigins: string[];
};

type CreateHttpServerOverrides = Partial<HttpServerConfig>;

type HttpServerRuntime = {
  server: NodeHttpServer;
  appServer: ScryfallMCPServer;
  config: HttpServerConfig;
  close: () => Promise<void>;
};

const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_HTTP_HOST = "127.0.0.1";
const DEFAULT_MCP_PATH = "/mcp";
const DEFAULT_HEALTH_PATH = "/health";

function parseAllowedOrigins(envValue?: string): string[] {
  if (!envValue?.trim()) {
    return [];
  }

  return envValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveHttpServerConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: CreateHttpServerOverrides = {}
): HttpServerConfig {
  return {
    host: overrides.host ?? parseEnvString(env.HTTP_HOST, DEFAULT_HTTP_HOST, undefined, 1, 255),
    port: overrides.port ?? parseEnvInt(env.HTTP_PORT, DEFAULT_HTTP_PORT, 1, 65535),
    mcpPath: overrides.mcpPath ?? parseEnvString(env.HTTP_MCP_PATH, DEFAULT_MCP_PATH, undefined, 1, 100),
    healthPath:
      overrides.healthPath ?? parseEnvString(env.HTTP_HEALTH_PATH, DEFAULT_HEALTH_PATH, undefined, 1, 100),
    allowedOrigins: overrides.allowedOrigins ?? parseAllowedOrigins(env.HTTP_ALLOWED_ORIGINS),
  };
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.length > 0) {
    return allowedOrigins.includes(origin);
  }

  return isLoopbackOrigin(origin);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf-8");
  return body ? JSON.parse(body) : {};
}

function sendJsonRpcError(
  res: ServerResponse,
  statusCode: number,
  message: string,
  headers: Record<string, string> = {}
): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...headers,
  });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message,
      },
      id: null,
    })
  );
}

async function createSessionTransport(
  appServer: ScryfallMCPServer,
  sessionTransports: Map<string, SessionTransportRecord>
): Promise<StreamableHTTPServerTransport> {
  const sdkServer = createSdkServer(MCP_SERVER_INFO);
  await appServer.setupHandlers(sdkServer);

  let transport!: StreamableHTTPServerTransport;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessionTransports.set(sessionId, { sdkServer, transport });
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessionTransports.delete(transport.sessionId);
    }
  };

  transport.onerror = (error) => {
    mcpLogger.error({ operation: "http_transport", error }, "HTTP transport error");
  };

  await sdkServer.connect(transport);
  return transport;
}

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  appServer: ScryfallMCPServer,
  config: HttpServerConfig,
  sessionTransports: Map<string, SessionTransportRecord>
): Promise<void> {
  if (!isOriginAllowed(req.headers.origin, config.allowedOrigins)) {
    sendJsonRpcError(res, 403, "Forbidden: Origin is not allowed for this MCP endpoint");
    return;
  }

  if (req.method === "POST") {
    let parsedBody: unknown;

    try {
      parsedBody = await readJsonBody(req);
    } catch (error) {
      mcpLogger.warn({ operation: "http_transport", error }, "Invalid JSON body for HTTP MCP request");
      sendJsonRpcError(res, 400, "Bad Request: Invalid JSON body");
      return;
    }

    const sessionId = req.headers["mcp-session-id"];
    const existingTransport =
      typeof sessionId === "string" ? sessionTransports.get(sessionId)?.transport : undefined;

    if (!existingTransport && !isInitializeRequest(parsedBody)) {
      sendJsonRpcError(res, 400, "Bad Request: No valid session ID provided");
      return;
    }

    if (existingTransport) {
      await existingTransport.handleRequest(req, res, parsedBody);
      return;
    }

    const transport = await createSessionTransport(appServer, sessionTransports);
    await transport.handleRequest(req, res, parsedBody);
    return;
  }

  if (req.method === "GET" || req.method === "DELETE") {
    const sessionId = req.headers["mcp-session-id"];
    const transport = typeof sessionId === "string" ? sessionTransports.get(sessionId)?.transport : undefined;

    if (!transport) {
      sendJsonRpcError(res, 400, "Bad Request: No valid session ID provided");
      return;
    }

    await transport.handleRequest(req, res);
    return;
  }

  sendJsonRpcError(res, 405, "Method not allowed.", {
    Allow: "GET, POST, DELETE",
  });
}

export function createHttpAppServer(overrides: CreateHttpServerOverrides = {}): HttpServerRuntime {
  const config = resolveHttpServerConfig(process.env, overrides);
  const appServer = new ScryfallMCPServer();
  const sessionTransports = new Map<string, SessionTransportRecord>();

  const server = createNodeHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${config.host}:${config.port}`}`);

    try {
      if (url.pathname === config.healthPath) {
        const health = await appServer.healthCheck();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(health));
        return;
      }

      if (url.pathname === config.mcpPath) {
        await handleMcpRequest(req, res, appServer, config, sessionTransports);
        return;
      }

      sendJsonRpcError(res, 404, "Not Found");
    } catch (error) {
      const requestError = error instanceof Error ? error : new Error(String(error));
      mcpLogger.error({ operation: "http_request", error: requestError }, "Unhandled HTTP server error");

      if (!res.headersSent) {
        sendJsonRpcError(res, 500, "Internal server error");
      } else {
        res.end();
      }
    }
  });

  return {
    server,
    appServer,
    config,
    close: async () => {
      for (const { transport } of sessionTransports.values()) {
        await transport.close();
      }

      sessionTransports.clear();
      appServer.destroy();

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

async function main() {
  const runtime = createHttpAppServer();

  await new Promise<void>((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(runtime.config.port, runtime.config.host, () => {
      runtime.server.off("error", reject);
      resolve();
    });
  });

  mcpLogger.info(
    {
      operation: "startup",
      transport: "streamable_http",
      host: runtime.config.host,
      port: runtime.config.port,
      mcpPath: runtime.config.mcpPath,
      healthPath: runtime.config.healthPath,
      allowedOrigins:
        runtime.config.allowedOrigins.length > 0 ? runtime.config.allowedOrigins : ["loopback-only"],
    },
    "scryfall-mcp HTTP server started"
  );

  const shutdown = async (signal: string) => {
    try {
      mcpLogger.info({ operation: "shutdown", signal, transport: "streamable_http" }, "Shutting down HTTP server");
      await runtime.close();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    mcpLogger.fatal({ operation: "startup", transport: "streamable_http", error }, "Unhandled HTTP startup error");
    process.exit(1);
  });
}
