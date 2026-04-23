# Scryfall MCP Server

Scryfall-backed MCP server for Magic: The Gathering search, rules lookup, pricing, set discovery, and deckbuilding workflows.

The project currently supports:

- `stdio` as the primary transport for local MCP clients
- local-first Streamable HTTP via `src/http.ts`
- 14 MCP tools, 2 resources, and 2 prompts

## What It Exposes

### Tools

- `search_cards`: Run Scryfall card searches with paging, sorting, and optional price filtering.
- `get_card`: Fetch one card by name, set/collector number, or Scryfall ID.
- `get_card_prices`: Return price data with optional format context and alternatives.
- `random_card`: Get a random card with optional filters.
- `search_sets`: Search and filter Magic sets.
- `query_rules`: Search the local comprehensive rules file with context.
- `build_scryfall_query`: Convert natural language into an explainable Scryfall query.
- `search_format_staples`: Find staples and role players for a format.
- `search_alternatives`: Find cheaper, upgraded, or similar cards.
- `find_synergistic_cards`: Find synergy pieces for a card, theme, or archetype.
- `batch_card_analysis`: Analyze multiple cards for legality, prices, synergy, or composition.
- `validate_brawl_commander`: Check Brawl and Standard Brawl commander legality.
- `analyze_deck_composition`: Evaluate deck lists for curve, colors, and structural issues.
- `suggest_mana_base`: Recommend land counts and fixing packages from color requirements.

### Resources

- `card-database://bulk`: Cached Oracle bulk snapshot.
- `set-database://all`: Cached set list snapshot.

### Prompts

- `analyze_card`
- `build_deck`

## Transports

### STDIO

Recommended for Claude Desktop, Codex, MCP Inspector, and most local MCP clients.

```bash
npm run dev
```

```bash
npm start
```

### Streamable HTTP

Available as a separate entrypoint for local or explicitly controlled environments.

```bash
npm run dev:http
```

```bash
npm run start:http
```

Current HTTP behavior:

- binds to `127.0.0.1` by default
- serves `POST|GET|DELETE` on `/mcp`
- serves `GET /health`
- rejects non-loopback `Origin` headers by default unless `HTTP_ALLOWED_ORIGINS` is set

The HTTP entrypoint is useful today, but it is still documented conservatively. It is not presented here as a public-hosting story.

## Setup

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
git clone https://github.com/bmurdock/scryfall-mcp.git
cd scryfall-mcp
npm install
cp .env.example .env
```

### Validate

```bash
npm run lint
npm run type-check
npm test
```

### Build

```bash
npm run build
```

## Common Commands

```bash
npm run dev
npm run dev:http
npm start
npm run start:http
npm test
npm run test:watch
npm run test:ui
npm run lint
npm run type-check
npm run inspector
```

## Configuration

See [.env.example](./.env.example) for the canonical values. The main variables in active use are:

- `SCRYFALL_USER_AGENT`
- `RATE_LIMIT_MS`
- `RATE_LIMIT_QUEUE_MAX`
- `SCRYFALL_TIMEOUT_MS`
- `CACHE_MAX_SIZE`
- `CACHE_MAX_MEMORY_MB`
- `LOG_LEVEL`
- `NODE_ENV`
- `HEALTHCHECK_DEEP`
- `HTTP_HOST`
- `HTTP_PORT`
- `HTTP_MCP_PATH`
- `HTTP_HEALTH_PATH`
- `HTTP_ALLOWED_ORIGINS`

Example local HTTP startup:

```bash
HTTP_HOST=127.0.0.1 HTTP_PORT=3000 npm run start:http
```

## Example Tool Calls

### `build_scryfall_query`

```json
{
  "natural_query": "blue counterspells under $20 for modern",
  "optimize_for": "precision"
}
```

### `search_cards`

```json
{
  "query": "c:r t:instant mv=1",
  "limit": 10,
  "order": "name"
}
```

### `search_sets`

```json
{
  "type": "expansion",
  "released_after": "2020-01-01"
}
```

### `find_synergistic_cards`

```json
{
  "focus_card": "Obeka, Splitter of Seconds",
  "synergy_type": "theme",
  "format": "commander",
  "limit": 12
}
```

### `analyze_deck_composition`

```json
{
  "deck_list": "4 Lightning Bolt\n4 Monastery Swiftspear\n20 Mountain",
  "format": "modern",
  "strategy": "aggro"
}
```

## Claude Desktop Integration

Add the built stdio entrypoint to your Claude Desktop configuration.

macOS path: `~/Library/Application Support/Claude/claude_desktop_config.json`

Windows path: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "scryfall": {
      "command": "node",
      "args": ["/absolute/path/to/scryfall-mcp/dist/index.js"]
    }
  }
}
```

## Operational Notes

- Rate limiting is enforced in-process with a 100 ms default minimum interval between Scryfall requests.
- Search responses, card details, prices, sets, and bulk snapshots are cached with bounded in-memory limits.
- The bulk card resource stores a pre-serialized snapshot to keep repeated reads cheap.
- Set filtering is derived from one canonical cached `/sets` dataset to avoid incorrect filtered cache reuse.
- Health checks are available through `ScryfallMCPServer.healthCheck()` and the HTTP `/health` endpoint.

## Documentation Map

Current source-of-truth docs:

- [PURPOSE.md](./PURPOSE.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [SCRYFALL_COMPLIANCE.md](./SCRYFALL_COMPLIANCE.md)

## License

MIT
