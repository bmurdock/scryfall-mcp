# Scryfall API Compliance Guide

This document outlines how the Scryfall MCP Server complies with Scryfall's API guidelines and terms of use.

## ✅ API Requirements Compliance

### Required Headers
- **✅ User-Agent**: `ScryfallMCPServer/2.0.0 (https://github.com/bmurdock/scryfall-mcp)`
- **✅ Accept**: `application/json`
- **✅ HTTPS Only**: All requests use HTTPS with TLS 1.2+
- **✅ UTF-8 Encoding**: All responses handled as UTF-8

### Rate Limiting Compliance
- **✅ Request Interval**: 100ms minimum between requests (10 requests/second max)
- **✅ Respect 429 Responses**: Automatic retry with exponential backoff
- **✅ Circuit Breaker**: Prevents overloading during API issues
- **✅ Bulk Data**: Uses bulk downloads that don't count against rate limits

### Caching Strategy
- **✅ 24+ Hour Caching**: Card details cached for 24 hours minimum
- **✅ Price Caching**: Prices cached for 6 hours (updated daily by Scryfall)
- **✅ Bulk Data**: Downloaded daily, cached for 24 hours
- **✅ Set Data**: Cached for 1 week (infrequent updates)

## ✅ Data Usage Compliance

### Permitted Uses
- **✅ Magic Software**: Creating additional Magic: The Gathering software
- **✅ Research**: Performing research on Magic cards and sets
- **✅ Community Content**: Supporting content creation about Magic
- **✅ Free Access**: No paywalls or subscription requirements for card data

### Data Handling
- **✅ No Repackaging**: Server adds value through MCP protocol integration
- **✅ Magic Context**: All data clearly identified as Magic: The Gathering
- **✅ No New Games**: Data used only for existing Magic content
- **✅ Attribution**: Scryfall credited as data source

## ✅ Image Usage Compliance

### Image Integrity
- **✅ No Cropping**: Copyright and artist names preserved
- **✅ No Distortion**: Images not stretched, skewed, or distorted
- **✅ No Modification**: No blurring, sharpening, or color changes
- **✅ No Watermarks**: No additional logos or stamps added
- **✅ Proper Attribution**: Artist and copyright information maintained

### Art Crop Usage
- **✅ Artist Attribution**: Artist name provided when using art crops
- **✅ Source Identification**: Users can identify image source
- **✅ Copyright Respect**: Wizards of the Coast copyright maintained

## 🔧 Implementation Details

### Rate Limiter Configuration
```typescript
export const RATE_LIMIT_CONFIG = {
  minInterval: 100, // 100ms minimum (complies with 50-100ms requirement)
  maxRetries: 3,
  backoffMultiplier: 2,
  maxBackoffMs: 5000
};
```

### Cache Durations
```typescript
export const CACHE_DURATIONS = {
  card_search: 30 * 60 * 1000,      // 30 minutes
  card_details: 24 * 60 * 60 * 1000, // 24 hours (minimum required)
  card_prices: 6 * 60 * 60 * 1000,   // 6 hours (prices updated daily)
  set_data: 7 * 24 * 60 * 60 * 1000, // 1 week
  bulk_data: 24 * 60 * 60 * 1000,    // 24 hours
};
```

### User-Agent Customization
Users can customize the User-Agent header via environment variable:
```bash
SCRYFALL_USER_AGENT="YourAppName/1.0 (your-contact@email.com)"
```

## 📋 Usage Guidelines for Developers

### Do's
- ✅ Cache data for at least 24 hours
- ✅ Use bulk data downloads when possible
- ✅ Respect rate limits (50-100ms between requests)
- ✅ Provide accurate User-Agent headers
- ✅ Credit Scryfall as the data source
- ✅ Preserve image integrity and copyright information

### Don'ts
- ❌ Don't paywall access to Scryfall data
- ❌ Don't modify or crop card images
- ❌ Don't add watermarks to images
- ❌ Don't exceed rate limits
- ❌ Don't use data for non-Magic games
- ❌ Don't simply repackage Scryfall data

## 🚨 Compliance Monitoring

The server includes built-in compliance monitoring:

### Rate Limit Monitoring
```typescript
// Check rate limiter status
const status = server.getRateLimiterStatus();
console.log(`Queue length: ${status.queueLength}`);
console.log(`Consecutive errors: ${status.consecutiveErrors}`);
```

### Cache Performance
```typescript
// Monitor cache hit rates
const cacheStats = server.getCacheStats();
console.log(`Cache hit rate: ${cacheStats.hitRate * 100}%`);
```

### Health Checks
```typescript
// Overall system health
const health = await server.healthCheck();
console.log(`Status: ${health.status}`);
```

## 📞 Contact and Support

If you have questions about compliance or need to report issues:

1. **GitHub Issues**: [https://github.com/bmurdock/scryfall-mcp/issues](https://github.com/bmurdock/scryfall-mcp/issues)
2. **Scryfall Support**: Follow Scryfall's official channels for API questions
3. **Documentation**: Refer to [Scryfall's official API documentation](https://scryfall.com/docs/api)

## 📄 Legal Notice

This software is provided under the MIT License and complies with:
- Scryfall's Terms of Service
- Wizards of the Coast Fan Content Policy
- Magic: The Gathering intellectual property guidelines

Users are responsible for ensuring their usage complies with all applicable terms and policies.
