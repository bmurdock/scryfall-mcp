# Code Style and Conventions

## TypeScript Configuration
- **Target**: ES2022
- **Module**: ESNext with Node resolution
- **Strict Mode**: Enabled with all strict checks
- **Output**: dist/ directory with declarations
- **Source**: src/ directory structure

## ESLint Rules
- **No unused variables**: Error level
- **No explicit any**: Warning (avoid when possible)
- **Prefer const**: Error for immutable variables
- **No var**: Error (use let/const only)
- **No console**: Warning (use proper logging)
- **No inferrable types**: Error (let TypeScript infer)

## Naming Conventions
- **Classes**: PascalCase (e.g., ScryfallMCPServer, SearchCardsTool)
- **Functions/Methods**: camelCase (e.g., setupHandlers, validateCardIdentifier)
- **Constants**: UPPER_SNAKE_CASE (e.g., CACHE_DURATIONS, RATE_LIMIT_CONFIG)
- **Interfaces/Types**: PascalCase (e.g., FormattedCard, ScryfallSearchResponse)
- **Files**: kebab-case (e.g., search-cards.ts, rate-limiter.ts)

## Code Organization
- **Tools**: src/tools/ - Individual MCP tool implementations
- **Services**: src/services/ - Core business logic (client, cache, rate limiter)
- **Types**: src/types/ - TypeScript type definitions
- **Utils**: src/utils/ - Utility functions (validators, formatters)
- **Resources**: src/resources/ - MCP resource implementations
- **Prompts**: src/prompts/ - MCP prompt implementations

## Import/Export Style
- Use ES modules (import/export)
- Prefer named exports over default exports
- Group imports: external libraries, then internal modules
- Use absolute imports where beneficial

## Error Handling
- Custom error classes for different error types
- Proper error propagation with meaningful messages
- Validation using Zod schemas
- Graceful degradation for API failures