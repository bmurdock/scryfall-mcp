# Scryfall API Compliance Guide

This document describes the compliance-related behavior that exists in the current implementation. It is intentionally narrower than a legal policy document.

## What The Server Does Today

### Request Headers

- Sends `Accept: application/json` on JSON API requests.
- Sends a configurable `User-Agent` header on Scryfall requests.
- Uses HTTPS for Scryfall API traffic.

The default `User-Agent` is controlled by `.env.example` and can be overridden with `SCRYFALL_USER_AGENT`.

### Rate Limiting

- Defaults to a 100 ms minimum interval between Scryfall requests.
- Retries rate-limited requests with bounded backoff.
- Tracks repeated failures and uses a circuit-breaker path to avoid hammering an unhealthy upstream.

### Caching

Current cache durations in code:

- card search: 30 minutes
- card details: 24 hours
- card prices: 6 hours
- set data: 1 week
- bulk data: 24 hours

Important implementation notes:

- bulk card data is fetched through the bulk endpoint and cached as a serialized snapshot
- set filtering is derived from one canonical cached `/sets` dataset
- cache size and memory usage are bounded in-process

### Bulk Data

- Uses Scryfall bulk data for the card database resource.
- Treats bulk downloads separately from ordinary card-search traffic.

## Developer Guidance

Do:

- keep using `ScryfallClient` instead of ad hoc fetch code
- preserve the configured `User-Agent`
- keep rate limiting and caching in place when adding new Scryfall-backed features
- prefer bulk data when the use case needs a large card corpus

Do not:

- bypass the shared rate limiter
- add duplicate network calls when existing code already fetched equivalent metadata
- treat filtered cache entries as reusable unless every result-affecting dimension is represented

## Useful Runtime Checks

The current public server helpers are:

```ts
const status = server.getStatus();
const health = await server.healthCheck();
```

`getStatus()` exposes cache, rate limiter, tool, resource, prompt, and monitoring state. `healthCheck()` performs the current health probe flow.

## Scope

This guide is about implementation behavior in this repository. It is not legal advice, and it does not replace Scryfall's own terms or documentation.

Primary external references:

- [Scryfall API Documentation](https://scryfall.com/docs/api)
- Scryfall's terms and policy documents
