# Repository Guidelines

## Project Structure & Modules
- `src/index.ts`: MCP entrypoint; wires server + transport.
- `src/server.ts`: Registers tools, resources, prompts; health/monitoring.
- `src/tools/`: Individual MCP tools (kebab-case files, one class per tool).
- `src/services/`: Cross-cutting services (Scryfall client, cache, rate limiter, logger).
- `src/natural-language/`: Query parsing/building helpers.
- `src/resources/` and `src/prompts/`: Exposed resources and prompt generators.
- `src/utils/` and `src/types/`: Shared utilities and TypeScript types.
- `tests/**/*.test.ts`: Vitest test suites. Build output in `dist/`.

## Build, Test, and Development
- `npm run dev`: Start in watch mode via `tsx`.
- `npm run build`: Type-check, transpile to `dist/`, then run tests.
- `npm start`: Run compiled server (`dist/index.js`).
- `npm test` | `npm run test:watch` | `npm run test:ui`: Run Vitest (CI, watch, or UI).
- `npm run lint`: Lint and auto-fix TypeScript files.
- `npm run type-check`: Strict type check without emitting.
- `npm run inspector`: Launch MCP Inspector against `src/index.ts`.

## Coding Style & Naming
- Indentation: 2 spaces; LF endings; UTF-8 (see `.editorconfig`).
- TypeScript: enable strictness; avoid `any`; prefer `const`; no `console` (use Pino logger).
- Filenames: kebab-case (`search-cards.ts`); classes use PascalCase; exported symbols are descriptive.
- Linting: ESLint with `@typescript-eslint` rules; fix warnings before PR.

## Testing Guidelines
- Framework: Vitest with V8 coverage (`vitest.config.ts`). Target ≥80% coverage.
- Location: `tests/`; name files `*.test.ts`. Keep unit tests close to the behavior under test.
- Run: `npm test`. Generate coverage HTML in `coverage/` when needed.

## Commit & PR Guidelines
- Commits: Prefer Conventional Commits when possible.
  - Examples: `feat: add SearchSetsTool`, `fix: rate limiter jitter`, `docs: update README`.
- PRs: Include summary, rationale, linked issues, and usage examples (logs or JSON snippets). Note performance or compliance impacts (rate limiting, caching).
- CI hygiene: Lint, type-check, and tests must pass.

## Security & Configuration
- Do not exceed Scryfall limits; use `ScryfallClient` + `RateLimiter` and caching.
- Configure via `.env` (see `.env.example`). Avoid hardcoding tokens/URLs.
- Log with Pino; prefer structured logs over `console`.
