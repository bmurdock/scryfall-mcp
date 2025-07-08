# Development Guidelines

## Design Patterns
- **Service Layer**: Separate business logic from MCP handlers
- **Dependency Injection**: Services injected into main server class
- **Factory Pattern**: Tool/Resource/Prompt classes instantiated as needed
- **Strategy Pattern**: Different formatters for different output formats
- **Circuit Breaker**: Prevent cascading failures during API outages

## Performance Considerations
- **Caching Strategy**: 24+ hour caching for card data, 6 hours for prices
- **Rate Limiting**: 100ms minimum between API requests
- **Bulk Data**: Use Scryfall bulk downloads to reduce API calls
- **Memory Management**: Clear caches when needed, avoid memory leaks

## Error Handling Strategy
- **Custom Exceptions**: ScryfallAPIError, RateLimitError, ValidationError
- **Graceful Degradation**: Continue operation when possible during failures
- **Retry Logic**: Exponential backoff for transient failures
- **User-Friendly Messages**: Convert technical errors to helpful messages

## Testing Strategy
- **Unit Tests**: Test individual functions and methods
- **Integration Tests**: Test tool interactions and API flows
- **Mock External APIs**: Use mocks for Scryfall API in tests
- **Coverage Goals**: Maintain >80% test coverage
- **Test Organization**: Mirror source structure in tests/

## Security Considerations
- **Input Validation**: Validate all user inputs with Zod schemas
- **Rate Limiting**: Prevent abuse of Scryfall API
- **Error Information**: Don't leak sensitive information in errors
- **Environment Variables**: Use .env for configuration, never commit secrets

## Scryfall API Best Practices
- **Compliance**: Follow all Scryfall API guidelines strictly
- **Attribution**: Credit Scryfall as data source
- **Image Handling**: Preserve copyright and artist information
- **Bulk Data**: Prefer bulk downloads over individual requests
- **User Agent**: Include proper identification in requests