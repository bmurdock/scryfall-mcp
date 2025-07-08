# Codebase Structure

## Root Directory
- **src/**: Main source code
- **tests/**: Test files (basic.test.ts, tools.test.ts)
- **dist/**: Compiled JavaScript output
- **node_modules/**: Dependencies
- **.vscode/**: VS Code workspace settings

## Source Code Organization

### Core Files
- **src/index.ts**: Main entry point, sets up MCP server
- **src/server.ts**: ScryfallMCPServer class - main orchestrator

### Services (src/services/)
- **scryfall-client.ts**: HTTP client for Scryfall API
- **cache-service.ts**: Caching layer for API responses
- **rate-limiter.ts**: Request rate limiting and queue management

### Tools (src/tools/)
- **search-cards.ts**: Card search functionality
- **get-card.ts**: Individual card retrieval
- **get-card-prices.ts**: Price information
- **random-card.ts**: Random card generation
- **search-sets.ts**: Set search and filtering
- **query-rules.ts**: Magic rules queries
- **search-alternatives.ts**: Alternative card suggestions
- **find-synergistic-cards.ts**: Card synergy analysis
- **batch-card-analysis.ts**: Bulk card analysis
- **search-format-staples.ts**: Format staple identification

### Resources (src/resources/)
- **card-database.ts**: Bulk card data resource
- **set-database.ts**: Set information resource

### Prompts (src/prompts/)
- **analyze-card.ts**: Card analysis prompt
- **build-deck.ts**: Deck building prompt

### Utilities (src/utils/)
- **validators.ts**: Input validation functions
- **formatters.ts**: Data formatting utilities

### Types (src/types/)
- **scryfall-api.ts**: Scryfall API type definitions
- **mcp-types.ts**: MCP-specific types and schemas

## Configuration Files
- **package.json**: Dependencies and scripts
- **tsconfig.json**: TypeScript configuration
- **vitest.config.ts**: Test configuration
- **.eslintrc.json**: Linting rules
- **.env.example**: Environment variable template