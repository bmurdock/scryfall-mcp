# Task Completion Checklist

## Before Committing Code
1. **Type Check**: `npm run type-check` - Ensure no TypeScript errors
2. **Lint**: `npm run lint` - Fix all linting issues
3. **Test**: `npm test` - All tests must pass
4. **Build**: `npm run build` - Successful compilation required

## Code Quality Standards
- **No `any` types**: Use proper TypeScript types
- **Error handling**: Implement proper error boundaries
- **Validation**: Use Zod schemas for input validation
- **Documentation**: Update JSDoc comments for public APIs
- **Test coverage**: Maintain >80% coverage for new code

## Scryfall API Compliance
- **Rate limiting**: Respect 100ms minimum intervals
- **Caching**: Implement appropriate cache durations
- **Headers**: Include proper User-Agent and Accept headers
- **Error handling**: Handle 429 responses with backoff

## MCP Protocol Compliance
- **Tool definitions**: Proper schema definitions
- **Resource URIs**: Follow MCP resource naming conventions
- **Prompt templates**: Include proper parameter schemas
- **Error responses**: Return proper MCP error formats

## Testing Requirements
- **Unit tests**: Test individual functions/methods
- **Integration tests**: Test tool interactions
- **Error scenarios**: Test error handling paths
- **Mock external APIs**: Don't hit real Scryfall API in tests

## Documentation Updates
- **README.md**: Update if adding new features
- **SCRYFALL_COMPLIANCE.md**: Update if changing API usage
- **JSDoc**: Document public methods and classes
- **Type definitions**: Keep types up to date