# Scryfall MCP Server - Project Overview

## Purpose
A comprehensive Model Context Protocol (MCP) server that integrates with the Scryfall API to provide Magic: The Gathering card data and functionality to AI assistants like Claude.

## Key Features
- **MCP Tools**: search_cards, get_card, get_card_prices, random_card, search_sets
- **MCP Resources**: card-database://bulk, set-database://all  
- **MCP Prompts**: analyze_card, build_deck
- **Performance**: Rate limiting, intelligent caching (>70% reduction in API calls), error handling, circuit breaker

## Tech Stack
- **Runtime**: Node.js 18+
- **Language**: TypeScript with strict mode
- **Module System**: ESNext modules
- **MCP SDK**: @modelcontextprotocol/sdk v1.12.1
- **Validation**: Zod v3.25.48
- **Environment**: dotenv for configuration
- **Development**: tsx for TypeScript execution
- **Testing**: Vitest with coverage
- **Linting**: ESLint with TypeScript rules

## Architecture
- **Main Entry**: src/index.ts - Sets up MCP server with stdio transport
- **Core Server**: src/server.ts - ScryfallMCPServer class orchestrates all components
- **Services**: Scryfall API client, cache service, rate limiter
- **Tools**: Individual tool implementations for each MCP tool
- **Resources**: Bulk data and set database resources
- **Prompts**: Card analysis and deck building prompts
- **Types**: Comprehensive TypeScript definitions for Scryfall API and MCP types