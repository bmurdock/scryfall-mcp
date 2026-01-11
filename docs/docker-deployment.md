# Docker Deployment Guide

Comprehensive guide for deploying the Scryfall MCP Server using Docker.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Docker Compose Deployment](#docker-compose-deployment)
4. [Claude Desktop Integration](#claude-desktop-integration)
5. [Claude Code Integration](#claude-code-integration)
6. [Environment Configuration](#environment-configuration)
7. [Image Management](#image-management)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [Advanced Topics](#advanced-topics)

---

## Architecture Overview

### Multi-Stage Build with Distroless

The Docker image uses an **optimized 3-stage build with Google's distroless base image**:

**🎯 Key Benefits:**
- **Small size**: Only 132MB (minimal attack surface)
- **Secure**: Uses distroless base with no shell, package manager, or unnecessary tools
- **Tested**: All 146 tests run during build - no broken images reach production
- **Non-root**: Runs as non-privileged user (uid 65532)
- **Efficient**: Multi-stage build separates concerns for optimal caching

**📦 Build Stages:**

1. **Builder Stage** (`node:18-alpine`):
   - Installs all dependencies (including devDependencies)
   - Compiles TypeScript from `src/` to `dist/`
   - Runs complete test suite with Vitest
   - Build fails if any tests fail (quality gate)
   - Size: ~400MB (discarded after build)

2. **Dependencies Stage** (`node:18-alpine`):
   - Installs ONLY production dependencies
   - Uses `npm ci --only=production` for reproducible builds
   - Cleans npm cache to reduce size
   - Size: ~150MB (only node_modules copied to final image)

3. **Runtime Stage** (`gcr.io/distroless/nodejs18-debian12:nonroot`):
   - Minimal base image with only Node.js runtime
   - Copies production dependencies from deps stage
   - Copies compiled artifacts from builder stage
   - Runs as nonroot user (uid 65532)
   - **Final size: 132MB**

**⚠️ Distroless Trade-offs:**
- ✅ **Security**: No shell, no package manager, minimal attack surface
- ✅ **Size**: Much smaller than standard Node.js images
- ❌ **No shell access**: Can't `docker exec -it` for debugging
- ❌ **No package manager**: Can't install tools at runtime
- ❌ **No health check utilities**: Can't use shell-based health checks

These limitations are **features** for production deployments, ensuring maximum security and minimal footprint.

---

## Quick Start

### Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ (optional but recommended)

### Build the Image

```bash
# Clone the repository
git clone https://github.com/bmurdock/scryfall-mcp.git
cd scryfall-mcp

# Build the Docker image
docker build -t scryfall-mcp:latest .
```

Build process takes **2-3 minutes** and includes:
- Installing all dependencies
- Compiling TypeScript
- Running 146 tests (build fails if tests don't pass)
- Creating optimized production image

### Run the Container

**Interactive mode (for testing):**
```bash
docker run -it --rm \
  --name scryfall-mcp \
  scryfall-mcp:latest
```

**Background service:**
```bash
docker run -d \
  --name scryfall-mcp \
  --restart unless-stopped \
  scryfall-mcp:latest
```

**With custom environment variables:**
```bash
docker run -d \
  --name scryfall-mcp \
  -e LOG_LEVEL=debug \
  -e SCRYFALL_USER_AGENT="MyApp/1.0-docker (contact@example.com)" \
  scryfall-mcp:latest
```

---

## Docker Compose Deployment

### Basic Setup

The included `docker-compose.yml` provides easy deployment:

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop the service
docker-compose down
```

### Custom Configuration

1. **Copy the example environment file:**
   ```bash
   cp .env.docker .env.docker.local
   ```

2. **Edit `.env.docker.local` with your preferences:**
   ```bash
   NODE_ENV=production
   LOG_LEVEL=info
   SCRYFALL_USER_AGENT=MyApp/1.0-docker (you@example.com)
   ```

3. **Update `docker-compose.yml` to use the env file:**
   ```yaml
   services:
     scryfall-mcp:
       # Uncomment these lines:
       env_file:
         - .env.docker.local
   ```

4. **Start the service:**
   ```bash
   docker-compose up -d
   ```

### Resource Limits (Recommended)

Uncomment the resource limits in `docker-compose.yml` for production:

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

---

## Claude Desktop Integration

### Direct Docker Execution

**Configure Claude Desktop to run Docker directly:**

**macOS**: Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: Edit `%APPDATA%\Claude\claude_desktop_config.json`

**Linux**: Edit `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "scryfall": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--name", "scryfall-mcp-claude-desktop",
        "-e", "LOG_LEVEL=info",
        "-e", "SCRYFALL_USER_AGENT=ScryfallMCPServer/1.0.2-claude-desktop",
        "scryfall-mcp:latest"
      ]
    }
  }
}
```

**Note**: This method creates a new container for each Claude Desktop session. The container is automatically removed when the session ends (`--rm` flag).

### Verify Integration

1. Restart Claude Desktop
2. Open a new conversation
3. The MCP server will start automatically when Claude Desktop launches
4. Test by asking: "Search for Lightning Bolt cards on Scryfall"

---

## Claude Code Integration

### Configuration

Add this to your `.claude.json` in the project root:

```json
{
  "mcpServers": {
    "scryfall": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--name", "scryfall-mcp-claude-code",
        "-e", "LOG_LEVEL=info",
        "-e", "SCRYFALL_USER_AGENT=ScryfallMCPServer/1.0.2-claude-code",
        "scryfall-mcp:latest"
      ]
    }
  }
}
```

### Testing

After adding the configuration:

1. **Restart Claude Code** (if running)
2. **Test the MCP connection** by asking:
   - "Search for Lightning Bolt cards"
   - "What's the price of Black Lotus?"
   - "Find me cheap red burn spells under $5"
   - "Show me all Planeswalkers from Throne of Eldraine"

Claude Code will automatically connect to your Docker MCP server and use the Scryfall tools.

---

## Environment Configuration

### Available Environment Variables

The Docker image includes sensible defaults for all environment variables. Override as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node.js environment (production \| development) |
| `LOG_LEVEL` | `info` | Logging level (trace \| debug \| info \| warn \| error \| fatal) |
| `SCRYFALL_USER_AGENT` | `ScryfallMCPServer/1.0.2-docker` | User-Agent for Scryfall API (customize for tracking) |
| `RATE_LIMIT_MS` | `100` | Minimum ms between requests (Scryfall requires 100ms) |
| `SCRYFALL_TIMEOUT_MS` | `15000` | Request timeout in milliseconds |
| `HEALTHCHECK_DEEP` | `false` | Enable deep health checks (not applicable for distroless) |
| `RATE_LIMIT_QUEUE_MAX` | `500` | Maximum queued requests before rejecting |
| `CACHE_MAX_SIZE` | `10000` | Maximum cache entries |
| `CACHE_MAX_MEMORY_MB` | `100` | Maximum cache memory usage in MB |

### Custom User-Agent

To track your deployment in Scryfall logs:

```bash
docker run -d \
  --name scryfall-mcp \
  -e SCRYFALL_USER_AGENT="YourApp/1.0-docker (you@example.com)" \
  scryfall-mcp:latest
```

Or in `docker-compose.yml`:

```yaml
environment:
  - SCRYFALL_USER_AGENT=YourApp/1.0-docker (you@example.com)
```

### Debug Logging

For troubleshooting, enable debug logging:

```bash
docker run -d \
  --name scryfall-mcp \
  -e LOG_LEVEL=debug \
  scryfall-mcp:latest
```

---

## Image Management

### View Running Containers

```bash
docker ps
```

### View Logs

```bash
# All logs
docker logs scryfall-mcp

# Follow logs in real-time
docker logs -f scryfall-mcp

# Last 100 lines
docker logs --tail 100 scryfall-mcp

# Since specific time
docker logs --since 2024-01-01T00:00:00 scryfall-mcp
```

### Stop Container

```bash
docker stop scryfall-mcp
```

### Remove Container

```bash
docker rm scryfall-mcp
```

### Remove Image

```bash
docker rmi scryfall-mcp:latest
```

### Update to Latest Version

```bash
# Pull latest code
git pull

# Rebuild image
docker build -t scryfall-mcp:latest .

# Restart with new image (if using docker-compose)
docker-compose down
docker-compose up -d

# Or restart standalone container
docker stop scryfall-mcp
docker rm scryfall-mcp
docker run -d --name scryfall-mcp scryfall-mcp:latest
```

### Monitor Resource Usage

```bash
# Real-time stats
docker stats scryfall-mcp

# One-time snapshot
docker stats scryfall-mcp --no-stream
```

---

## Troubleshooting

### Build Failures

**Problem**: Tests fail during build

```bash
# Check which tests failed
docker build -t scryfall-mcp:latest . 2>&1 | grep -A 5 "FAIL"

# Run tests locally to debug
npm test
```

**Problem**: Out of disk space

```bash
# Clean up old images and containers
docker system prune -a --volumes

# Check disk usage
docker system df
```

**Problem**: Build is slow

The build includes running all tests, which takes 2-3 minutes. This is intentional to ensure quality. Use layer caching to speed up subsequent builds:

```bash
# Build with BuildKit (faster)
DOCKER_BUILDKIT=1 docker build -t scryfall-mcp:latest .
```

### Container Won't Start

**Check logs:**
```bash
docker logs scryfall-mcp
```

**Common issues:**
- **Memory limits too low**: Increase in docker-compose.yml or remove limits
- **Missing mtgrules.txt**: Ensure file exists in project root before build
- **Port conflicts**: Not applicable (stdio transport, no ports)

### High Memory Usage

The server uses in-memory caching. Adjust cache limits:

```bash
docker run -d \
  --name scryfall-mcp \
  -e CACHE_MAX_SIZE=5000 \
  -e CACHE_MAX_MEMORY_MB=50 \
  scryfall-mcp:latest
```

Or set memory limit:

```bash
docker run -d \
  --name scryfall-mcp \
  --memory=256m \
  scryfall-mcp:latest
```

### Network Issues / API Timeouts

**Increase timeout:**
```bash
docker run -d \
  --name scryfall-mcp \
  -e SCRYFALL_TIMEOUT_MS=30000 \
  -e LOG_LEVEL=debug \
  scryfall-mcp:latest
```

**Check network connectivity:**
```bash
# Test DNS resolution (Note: distroless has no shell, so this won't work in the container)
# Instead, check from host:
curl -I https://api.scryfall.com
```

**Check container network:**
```bash
docker network inspect bridge
```

### Claude Desktop/Code Integration Issues

**Problem**: Claude can't connect to MCP server

**Verify Docker image works:**
```bash
# Test container starts and responds
docker run -it --rm scryfall-mcp:latest

# You should see: "scryfall-mcp server started"
# Press Ctrl+C to exit
```

**Verify Docker is accessible without sudo:**
```bash
docker ps
# Should not require sudo
```

**If Docker requires sudo:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in for changes to take effect
```

**Problem**: Container name already in use

```bash
# Remove existing container
docker rm -f scryfall-mcp-claude-code

# Or use unique name in config:
"--name", "scryfall-mcp-claude-code-session-1"
```

**Problem**: Permission denied accessing Docker socket

Ensure your user is in the `docker` group (see above).

---

## Best Practices

### 1. Use Specific Version Tags

For production, tag images with versions:

```bash
docker build -t scryfall-mcp:1.0.0 .
docker tag scryfall-mcp:1.0.0 scryfall-mcp:latest
```

In `docker-compose.yml`:
```yaml
image: scryfall-mcp:1.0.0  # Instead of :latest
```

### 2. Regular Updates

Check for updates weekly:

```bash
cd scryfall-mcp
git pull
docker build -t scryfall-mcp:latest .
docker-compose restart
```

### 3. Monitor Resource Usage

```bash
# Check container stats
docker stats scryfall-mcp --no-stream

# Set up alerts if memory > 400MB or CPU > 50%
```

### 4. Backup Configuration

```bash
# Backup Claude Desktop config
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json \
   ~/claude_desktop_config.backup.json

# Backup docker-compose configuration
cp docker-compose.yml docker-compose.yml.backup
cp .env.docker.local .env.docker.local.backup
```

### 5. Security Scanning

Regularly scan images for vulnerabilities:

```bash
# Using Docker Scout
docker scout cves scryfall-mcp:latest

# Using Trivy
trivy image scryfall-mcp:latest
```

### 6. Log Rotation

For long-running containers, configure log rotation:

```bash
docker run -d \
  --name scryfall-mcp \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  scryfall-mcp:latest
```

Or in `docker-compose.yml`:
```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

---

## Advanced Topics

### Custom Dockerfile Modifications

If you need to customize the Dockerfile (not recommended for most users):

**Example: Add debugging tools (increases image size):**

```dockerfile
# Change final stage from distroless to alpine
FROM node:18-alpine AS runtime

# Now you can add tools:
RUN apk add --no-cache curl busybox-extras

# Rest of Dockerfile...
```

**Trade-off**: Adds ~50MB and reduces security benefits of distroless.

### Multi-Architecture Builds

Build for multiple platforms (amd64, arm64):

```bash
# Set up buildx
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t scryfall-mcp:latest \
  --push \
  .
```

### Container Registry

Push to a private registry:

```bash
# Tag for registry
docker tag scryfall-mcp:latest myregistry.com/scryfall-mcp:1.0.0

# Push
docker push myregistry.com/scryfall-mcp:1.0.0
```

Update `docker-compose.yml`:
```yaml
image: myregistry.com/scryfall-mcp:1.0.0
```

### Kubernetes Deployment

Example Kubernetes deployment manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scryfall-mcp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: scryfall-mcp
  template:
    metadata:
      labels:
        app: scryfall-mcp
    spec:
      containers:
      - name: scryfall-mcp
        image: scryfall-mcp:latest
        env:
        - name: NODE_ENV
          value: production
        - name: LOG_LEVEL
          value: info
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        securityContext:
          runAsNonRoot: true
          runAsUser: 65532
          readOnlyRootFilesystem: true
```

### CI/CD Integration

**GitHub Actions example:**

```yaml
name: Build and Push Docker Image

on:
  push:
    tags:
      - 'v*'

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build image
        run: docker build -t scryfall-mcp:${{ github.ref_name }} .

      - name: Run tests
        run: docker run --rm scryfall-mcp:${{ github.ref_name }} npm test

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker tag scryfall-mcp:${{ github.ref_name }} myregistry.com/scryfall-mcp:${{ github.ref_name }}
          docker push myregistry.com/scryfall-mcp:${{ github.ref_name }}
```

---

## Additional Resources

- [Scryfall API Documentation](https://scryfall.com/docs/api)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Google Distroless GitHub](https://github.com/GoogleContainerTools/distroless)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

## Getting Help

If you encounter issues:

1. **Check logs**: `docker logs scryfall-mcp`
2. **Review troubleshooting section** above
3. **Search existing issues**: [GitHub Issues](https://github.com/bmurdock/scryfall-mcp/issues)
4. **Open a new issue** with:
   - Docker version: `docker --version`
   - Image details: `docker inspect scryfall-mcp:latest`
   - Logs: `docker logs scryfall-mcp`
   - Steps to reproduce the issue
