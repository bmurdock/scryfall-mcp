# Scryfall MCP Server

A comprehensive Model Context Protocol (MCP) server that integrates with the Scryfall API to provide Magic: The Gathering card data and functionality to AI assistants like Claude.

<a href="https://glama.ai/mcp/servers/@bmurdock/scryfall-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@bmurdock/scryfall-mcp/badge" alt="Scryfall Server MCP server" />
</a>

## Features

### 🔧 MCP Tools

#### Enhanced Search Tools
- **build_scryfall_query**: Convert natural language requests into optimized Scryfall search queries
  - Input: Natural language description, format preferences, optimization strategy
  - Output: Optimized Scryfall query with explanation and alternatives
  - Example: "red creatures under $5 for aggressive decks" → "c:r t:creature usd<=5 pow>=2 cmc<=3"

#### Core Search Tools
- **search_cards**: Search for cards using Scryfall's powerful search syntax
- **get_card**: Get detailed information about specific cards
- **get_card_prices**: Retrieve current price data for cards
- **random_card**: Get random cards with optional filters
- **search_sets**: Search and filter Magic sets

### 📚 MCP Resources
- **card-database://bulk**: Complete Scryfall bulk card database with daily updates
- **set-database://all**: All Magic sets with metadata and icons

### 💡 MCP Prompts
- **analyze_card**: Generate comprehensive card analysis including competitive viability, synergies, and meta positioning
- **build_deck**: Create deck building guides centered around specific cards

### ⚡ Performance Features
- **Rate Limiting**: Respects Scryfall's API limits with 75ms minimum intervals
- **Intelligent Caching**: Reduces API calls by >70% with configurable TTL
- **Error Handling**: Graceful handling of all API error conditions
- **Circuit Breaker**: Prevents cascading failures during API outages

### 🔍 Simple Validation System
- **Lightweight Validation**: Basic query syntax validation with helpful error messages
- **Essential Checks**: Balanced parentheses, quotes, and common syntax errors
- **Operator Recognition**: Validates known Scryfall operators with suggestions for typos
- **Performance Optimized**: Fast validation with minimal overhead

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/bmurdock/scryfall-mcp.git
   cd scryfall-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment** (optional)
   ```bash
   cp .env.example .env
   # Edit .env with your preferences
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### MCP Inspector
```bash
npm run inspector
```

## Claude Desktop Integration

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

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

Replace `/absolute/path/to/scryfall-mcp` with the actual path to your installation.

## Tool Usage Examples

### Natural Language Query Building

Convert natural language to Scryfall syntax:

```javascript
// Convert natural language to optimized Scryfall query
{
  "tool": "build_scryfall_query",
  "arguments": {
    "natural_query": "blue counterspells in modern under $20",
    "optimize_for": "precision"
  }
}
```

Generate budget-friendly queries:

```javascript
// Budget-focused query generation
{
  "tool": "build_scryfall_query",
  "arguments": {
    "natural_query": "aggressive red creatures for standard",
    "optimize_for": "budget",
    "price_budget": {
      "max": 5,
      "currency": "usd"
    }
  }
}
```

Discover interesting cards:

```javascript
// Discovery-optimized search
{
  "tool": "build_scryfall_query",
  "arguments": {
    "natural_query": "legendary artifacts that produce mana",
    "format": "commander",
    "optimize_for": "discovery"
  }
}
```

### Search Cards
```javascript
// Basic search
{
  "query": "lightning bolt"
}

// Advanced search with Scryfall syntax
{
  "query": "c:red type:instant cmc:1",
  "limit": 10,
  "format": "json"
}

// Format-specific search
{
  "query": "legal:modern type:creature power>=4",
  "order": "cmc"
}
```

### Get Card Details
```javascript
// By name
{
  "identifier": "Lightning Bolt"
}

// By set and collector number
{
  "identifier": "dom/123"
}

// By Scryfall ID
{
  "identifier": "f7a99cc1-2b73-4c9c-8de2-9b6c4c1d8f2a"
}

// With specific set
{
  "identifier": "Lightning Bolt",
  "set": "m21"
}
```

### Get Card Prices
```javascript
{
  "card_id": "f7a99cc1-2b73-4c9c-8de2-9b6c4c1d8f2a",
  "currency": "usd"
}
```

### Random Card
```javascript
// Completely random
{}

// Filtered random card
{
  "query": "type:creature",
  "format": "modern"
}
```

### Search Sets
```javascript
// All sets
{}

// Filter by type and date
{
  "type": "expansion",
  "released_after": "2020-01-01"
}
```

## Scryfall Search Syntax

The server supports Scryfall's full search syntax:

### Basic Operators
- `c:red` - Color
- `type:creature` - Type line
- `set:dom` - Set code
- `cmc:3` - Converted mana cost
- `power>=4` - Power/toughness comparisons
- `legal:modern` - Format legality

### Advanced Operators
- `is:commander` - Card properties
- `year:2023` - Release year
- `rarity:mythic` - Rarity
- `artist:"john avon"` - Artist name
- `flavor:"text"` - Flavor text search

### Boolean Logic
- `red OR blue` - Either condition
- `creature AND red` - Both conditions
- `NOT black` - Exclude condition
- `(red OR blue) type:instant` - Grouping

## Error Handling

The server provides detailed error messages for common issues:

- **404**: Card/resource not found
- **422**: Invalid search syntax
- **429**: Rate limit exceeded (automatic retry)
- **Validation errors**: Parameter validation failures

## Performance Monitoring

### Cache Statistics
```javascript
// Get cache performance
server.getCacheStats()
```

### Rate Limiter Status
```javascript
// Check rate limiting status
server.getRateLimiterStatus()
```

### Health Check
```javascript
// Overall system health
server.healthCheck()
```

## Configuration

### Environment Variables
```bash
SCRYFALL_USER_AGENT=ScryfallMCPServer/1.0
CACHE_TTL_HOURS=24
RATE_LIMIT_MS=75
LOG_LEVEL=info
NODE_ENV=development
```

### Cache Durations
- **Card Search**: 30 minutes
- **Card Details**: 24 hours
- **Card Prices**: 6 hours
- **Set Data**: 1 week
- **Bulk Data**: 24 hours

### Logging Configuration

The server uses **Pino** for high-performance structured logging with comprehensive error tracking and monitoring.

#### Log Levels
```bash
# Available log levels (default: info)
LOG_LEVEL=trace    # Most verbose - all operations
LOG_LEVEL=debug    # Debug information and performance metrics
LOG_LEVEL=info     # General information (default)
LOG_LEVEL=warn     # Warnings and degraded performance
LOG_LEVEL=error    # Errors only
LOG_LEVEL=fatal    # Critical errors only
```

#### Development vs Production Logging

**Development Mode** (`NODE_ENV=development`):
- Pretty-printed, colorized output
- Human-readable timestamps
- Request ID and tool name highlighting
- Automatic log formatting for readability

**Production Mode** (`NODE_ENV=production`):
- JSON-structured logs for machine processing
- Optimized for log aggregation systems
- Minimal overhead for high-performance scenarios
- Compatible with ELK Stack, Grafana, and monitoring tools

#### Structured Log Format

All logs include structured context for debugging and monitoring:

```json
{
  "level": "info",
  "time": "2025-01-17T19:32:53.123Z",
  "pid": 12345,
  "hostname": "server-01",
  "service": "scryfall-mcp",
  "version": "1.0.0",
  "requestId": "req_1737145973123_abc123def",
  "toolName": "search_cards",
  "operation": "tool_execution",
  "duration": 245,
  "msg": "Tool execution completed"
}
```

#### Request Correlation

Every request gets a unique correlation ID for tracking across operations:
- Format: `req_{timestamp}_{random}`
- Tracks tool executions, API calls, and errors
- Enables end-to-end request tracing
- Automatic cleanup of old correlation data

### Error Handling & Monitoring

#### Error Classification

The server implements comprehensive error handling with structured error classes:

**Base Error Types:**
- `MCPError` - Base class with structured logging support
- `ToolExecutionError` - Tool-specific execution failures
- `ResourceError` - Resource access failures
- `PromptError` - Prompt generation failures

**Domain-Specific Errors:**
- `ScryfallAPIError` - Scryfall API-related errors
- `RateLimitError` - Rate limiting and throttling
- `ValidationError` - Input validation failures

#### Error Monitoring Features

**Automatic Error Tracking:**
- Error frequency monitoring by type
- Performance metrics collection
- Request correlation tracking
- Circuit breaker pattern for API failures

**Monitoring Data Access:**
```javascript
// Get comprehensive monitoring report
const status = server.getStatus();
console.log(status.monitoring);

// Output includes:
// - Error counts by type
// - Performance metrics (avg response times)
// - Request correlation data
// - Health check status
```

#### Health Check Monitoring

Enhanced health checks with detailed service status:

```bash
# Health check includes:
# - Cache service status
# - Rate limiter status
# - Scryfall API connectivity
# - Error monitoring metrics
# - Performance statistics
```

#### Production Monitoring Setup

**Recommended Monitoring Stack:**

1. **Log Aggregation**: ELK Stack (Elasticsearch, Logstash, Kibana)
2. **Metrics**: Grafana with Prometheus
3. **Error Tracking**: Sentry with structured error context
4. **Alerting**: Based on error rates and response times

**Key Metrics to Monitor:**
- Tool execution success/failure rates
- API response time distributions
- Error type frequencies
- Cache hit/miss ratios
- Rate limiter status

#### Error Recovery Strategies

**Automatic Recovery:**
- Exponential backoff for API failures
- Circuit breaker prevents cascading failures
- Intelligent retry logic with jitter
- Graceful degradation during outages

**Manual Recovery:**
```javascript
// Reset error monitoring
server.resetRateLimiter();
server.clearCaches();

// Check system health
const health = await server.healthCheck();
```

## Troubleshooting

### Common Issues

**"Rate limit exceeded"**
- The server automatically handles rate limiting
- Wait a moment and try again
- Check if you're making too many concurrent requests

**"Network error: Unexpected token" or gzip-related errors**
- This was fixed in v1.0.2 by disabling gzip compression
- Make sure you're using the latest build: `npm run build`
- Restart Claude Desktop after rebuilding
- The server now requests uncompressed responses to avoid parsing issues

**"Card not found"**
- Verify card name spelling
- Try using set code + collector number format
- Check if the card exists in Scryfall

**"Invalid search syntax"**
- Review Scryfall search syntax documentation
- Check for unmatched parentheses
- Avoid starting queries with boolean operators

**Claude Desktop integration not working**
- Verify the absolute path in configuration
- Ensure the server builds successfully
- Check Claude Desktop logs for errors

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

### Clear Cache
```bash
# Programmatically
server.clearCaches()

# Or restart the server
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Maintain >80% test coverage
- Use conventional commit messages
- Update documentation for new features

## API Rate Limiting & Compliance

This server fully complies with Scryfall's API guidelines:
- **Rate Limiting**: 100ms minimum between requests (10 requests/second max)
- **Required Headers**: Proper User-Agent and Accept headers
- **Caching**: 24+ hour caching for card data, 6 hours for prices
- **Bulk Data**: Uses daily bulk downloads that don't count against limits
- **Error Handling**: Respects 429 responses with exponential backoff
- **Circuit Breaker**: Prevents overloading during API issues

See [SCRYFALL_COMPLIANCE.md](./SCRYFALL_COMPLIANCE.md) for complete compliance details.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [Scryfall](https://scryfall.com/) for providing the excellent Magic: The Gathering API
- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP specification
- The Magic: The Gathering community for inspiration and feedback