const endpoint = process.env.MCP_HTTP_URL || "http://127.0.0.1:3000/mcp";
const healthUrl = endpoint.replace(/\/mcp$/, "/health");

let sessionId;
let requestId = 1;

function parseSse(text) {
  const data = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  return data ? JSON.parse(data) : null;
}

async function postJsonRpc(payload) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const returnedSessionId = response.headers.get("mcp-session-id");
  if (returnedSessionId) {
    sessionId = returnedSessionId;
  }

  if (response.status === 202) {
    return null;
  }

  const text = await response.text();
  const parsed = response.headers.get("content-type")?.includes("text/event-stream")
    ? parseSse(text)
    : JSON.parse(text);

  if (!response.ok || parsed?.error) {
    throw new Error(`MCP request failed: ${response.status} ${JSON.stringify(parsed?.error)}`);
  }

  return parsed.result;
}

const health = await fetch(healthUrl).then((response) => response.json());
if (health.status !== "healthy") {
  throw new Error(`Health check failed: ${JSON.stringify(health)}`);
}

const initialize = await postJsonRpc({
  jsonrpc: "2.0",
  id: requestId++,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "scryfall-mcp-smoke", version: "0.1.0" },
  },
});

await postJsonRpc({
  jsonrpc: "2.0",
  method: "notifications/initialized",
});

const tools = await postJsonRpc({
  jsonrpc: "2.0",
  id: requestId++,
  method: "tools/list",
  params: {},
});

console.log(JSON.stringify({
  endpoint,
  health: health.status,
  server: initialize.serverInfo,
  toolCount: tools.tools.length,
  tools: tools.tools.map((tool) => tool.name),
}, null, 2));
