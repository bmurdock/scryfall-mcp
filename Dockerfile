# Stage 1: Build stage with full development dependencies
FROM node:18-alpine AS builder

# Install build dependencies (needed for some native modules)
RUN apk add --no-cache python3 make g++

WORKDIR /build

# Copy package files first (layer caching optimization)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json vitest.config.ts ./
COPY src/ ./src/
COPY tests/ ./tests/
COPY mtgrules.txt ./

# Build: TypeScript compilation + tests
# This will fail if tests don't pass, ensuring quality
RUN npm run build

# Stage 2: Production dependencies stage
FROM node:18-alpine AS deps

WORKDIR /deps

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 3: Runtime stage with distroless (minimal, secure, no shell)
FROM gcr.io/distroless/nodejs18-debian12:nonroot

# Set working directory
WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /deps/node_modules ./node_modules

# Copy built artifacts from builder stage
COPY --from=builder /build/dist ./dist

# Copy runtime files
COPY --chown=nonroot:nonroot package*.json ./
COPY --chown=nonroot:nonroot .env.example ./
COPY --chown=nonroot:nonroot mtgrules.txt ./

# Distroless already runs as nonroot user (uid 65532)
# No need to create users - it's baked into the image

# Environment variables with defaults
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    SCRYFALL_USER_AGENT="ScryfallMCPServer/1.0.2-docker" \
    RATE_LIMIT_MS=100 \
    SCRYFALL_TIMEOUT_MS=15000 \
    HEALTHCHECK_DEEP=false \
    RATE_LIMIT_QUEUE_MAX=500 \
    CACHE_MAX_SIZE=10000 \
    CACHE_MAX_MEMORY_MB=100

# The server uses stdio transport, so no EXPOSE needed
# Entry point runs the compiled production code
CMD ["dist/index.js"]

# Metadata labels
LABEL org.opencontainers.image.title="Scryfall MCP Server" \
      org.opencontainers.image.description="Model Context Protocol server for Scryfall API" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/bmurdock/scryfall-mcp" \
      org.opencontainers.image.licenses="MIT"
