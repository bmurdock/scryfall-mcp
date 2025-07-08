# Suggested Commands for Scryfall MCP Development

## Development Commands
- `npm run dev` - Start development server with hot reload using tsx
- `npm run build` - Compile TypeScript and run tests
- `npm start` - Run production server from dist/
- `npm run type-check` - Type check without compilation

## Testing Commands
- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with Vitest UI

## Code Quality Commands
- `npm run lint` - Run ESLint with auto-fix
- `eslint src/**/*.ts --fix` - Lint specific files

## MCP Development
- `npm run inspector` - Launch MCP Inspector for debugging
- `npx @modelcontextprotocol/inspector tsx src/index.ts` - Direct inspector launch

## System Commands (macOS/Darwin)
- `ls -la` - List files with details
- `find . -name "*.ts" -type f` - Find TypeScript files
- `grep -r "pattern" src/` - Search in source code
- `git status` - Check git status
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit changes
- `git push` - Push to remote

## Environment Setup
- `cp .env.example .env` - Copy environment template
- `node --version` - Check Node.js version (requires 18+)
- `npm --version` - Check npm version