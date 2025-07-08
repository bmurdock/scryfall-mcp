# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Test
- `npm run build` - TypeScript compilation and runs tests
- `npm run dev` - Development mode with hot reload using tsx
- `npm start` - Production mode (requires build first)
- `npm test` - Run all tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI interface
- `npm run lint` - ESLint with auto-fix
- `npm run type-check` - TypeScript type checking without compilation

### MCP Development
- `npm run inspector` - Launch MCP Inspector for debugging MCP server

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that provides Magic: The Gathering card data through the Scryfall API. The architecture follows a clean separation of concerns:

### Core Components

**Main Server (`src/server.ts`)**
- `ScryfallMCPServer` class orchestrates all MCP functionality
- Implements MCP protocol handlers for tools, resources, and prompts
- Manages tool/resource/prompt registration and execution
- Provides health checks and status monitoring

**Entry Point (`src/index.ts`)**
- Initializes MCP Server with stdio transport
- Sets up `ScryfallMCPServer` and connects handlers

**Core Services (`src/services/`)**
- `ScryfallClient` - HTTP client with rate limiting and caching
- `RateLimiter` - Enforces 100ms minimum intervals between API calls
- `CacheService` - In-memory caching with configurable TTL

### MCP Components

**Tools (`src/tools/`)**
- 10 tools for card search, retrieval, and analysis
- Each tool is a separate class with consistent interface
- Tools include: search_cards, get_card, get_card_prices, random_card, search_sets, query_rules, etc.

**Resources (`src/resources/`)**
- `CardDatabaseResource` - Bulk card data (card-database://bulk)
- `SetDatabaseResource` - All Magic sets (set-database://all)

**Prompts (`src/prompts/`)**
- `AnalyzeCardPrompt` - Generate card analysis
- `BuildDeckPrompt` - Create deck building guides

### Type System

**Scryfall API Types (`src/types/scryfall-api.ts`)**
- Complete type definitions for Scryfall API responses
- Interfaces for cards, sets, search results, etc.

**MCP Types (`src/types/mcp-types.ts`)**
- MCP-specific types and error classes
- API headers and configuration constants

## Key Architectural Patterns

### Service Dependency Injection
All tools receive `ScryfallClient` instance, which encapsulates rate limiting and caching. This allows for consistent API compliance across all tools.

### Rate Limiting & Caching Strategy
- **Rate Limiting**: 100ms minimum between requests (Scryfall API compliance)
- **Circuit Breaker**: Prevents cascading failures during API outages
- **Caching Hierarchy**: Different TTL for different data types:
  - Card details: 24 hours
  - Prices: 6 hours
  - Sets: 1 week
  - Bulk data: 24 hours

### Error Handling
- Custom error classes for different failure modes
- Graceful degradation with detailed error messages
- Automatic retry logic with exponential backoff

## Development Patterns

### Tool Development
When adding new tools:
1. Create class in `src/tools/` extending base tool pattern
2. Implement `name`, `description`, `inputSchema`, and `execute()` method
3. Register in `ScryfallMCPServer` constructor
4. Use Zod schemas for input validation

### Testing
- Tests use Vitest framework (`tests/` directory)
- Mock Scryfall API responses for consistent testing
- Test both success and error scenarios
- Coverage reports available via `npm run test:ui`

### Environment Configuration
- `.env.example` shows available environment variables
- Key variables: `SCRYFALL_USER_AGENT`, `RATE_LIMIT_MS`, `CACHE_TTL_HOURS`
- Development defaults work without configuration

## Scryfall API Compliance

This server strictly follows Scryfall API guidelines:
- Proper User-Agent header identification
- Respect rate limits (100ms between requests)
- Use bulk data endpoints to minimize API calls
- Handle 429 responses with exponential backoff
- Cache responses appropriately to reduce load

See `SCRYFALL_COMPLIANCE.md` for complete compliance details.