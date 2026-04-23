# Inefficiency Targets

Validated against the current workspace on 2026-04-23.

This is a static code-inspection audit, not a benchmark report. Rankings favor targets that can multiply latency, memory, CPU, or Scryfall API usage on real MCP request paths.

Remediation plan: `docs/superpowers/plans/2026-04-23-verified-inefficiency-remediation.md`

## Skills Check

Relevant or beneficial skills checked for this task:

- `superpowers:using-superpowers`
  - Used to select applicable workflows before inspecting or editing.
- `native-static-review`
  - Used because the request is an evidence-based code review of the workspace.
- `superpowers:systematic-debugging`
  - Used because performance and inefficiency investigations benefit from root-cause evidence before proposing fixes.
- `superpowers:verification-before-completion`
  - Beneficial before claiming any future remediation is complete; performance claims should be backed by tests, profiling, or focused measurements.
- `superpowers:writing-plans`
  - Beneficial if this ranked list is converted into a multi-step remediation plan.
- `superpowers:test-driven-development`
  - Beneficial when implementing fixes that need regression coverage.
- `superpowers:requesting-code-review`
  - Beneficial after remediation work, not needed for this document-only audit.

Other available skills were checked by inventory. The frontend, web-app, game, mobile, macOS, Google Drive, OpenAI docs, Hugging Face, image, PDF, Office document, GitHub publishing, and plugin/skill creation skills are not materially relevant to a static TypeScript inefficiency audit for this MCP server.

## 1. Bulk card resource rebuild still accumulates the full dataset as many strings, then joins into a second huge string

- Location: `src/resources/card-database.ts:120-134`
- Status: resolved on 2026-04-23.
- Evidence:
  `rebuildSerializedSnapshot()` streams cards from `streamBulkData()`, but it pushes every projected card string into `parts` and then builds `payload` with `parts.join(',')`.
- Why it is inefficient:
  The streaming parser avoids holding the parsed Scryfall bulk array, but the rebuild still holds all per-card JSON strings plus the final joined payload during the join. The card database is the largest dataset this server handles, so this is the highest-impact heap and GC target.
- Impact:
  A cold read or forced refresh of `card-database://bulk` can create a large transient memory spike and extra allocation churn. The final string is required by the current MCP resource contract, but the intermediate `parts` array is avoidable.
- Candidate fix:
  Build the serialized payload through a single append-oriented path or a bounded chunk builder, and cache with an explicit size hint for the final string. If the MCP layer eventually supports streaming resources, this is the first candidate.

## 2. Batch card fetching does not deduplicate names before queuing card lookups

- Location: `src/tools/batch-card-analysis.ts:123-136`, `src/tools/batch-card-analysis/fetcher.ts:12-43`
- Status: resolved on 2026-04-23.
- Evidence:
  `validateParams()` trims `card_list` but preserves duplicates. `fetchCardMapWithConcurrency()` then iterates every item and calls `scryfallClient.getCard()` for each name before returning a `Map`, where duplicate keys overwrite prior entries.
- Why it is inefficient:
  Duplicate cards in a deck or batch can queue duplicate lookups. Because calls are started by workers before the first duplicate response has populated the cache, duplicate misses can become duplicate Scryfall requests rather than cache hits.
- Impact:
  Common deck-list inputs can contain repeated card names. With the current 100-card limit, duplicates can waste queue slots, rate-limited request time, and cache churn.
- Candidate fix:
  Deduplicate normalized card names before fetching, preserve original order or quantities separately for analysis, and optionally coalesce in-flight identical `getCard()` calls in `ScryfallClient`.

## 3. Natural-language query building performs a live Scryfall search by default

- Location: `src/tools/build-scryfall-query.ts:84-88`, `src/tools/build-scryfall-query.ts:127-137`, `src/natural-language/query-builder/query-optimization.ts:89-124`
- Status: resolved on 2026-04-23.
- Evidence:
  The tool schema defaults `test_query` to `true`. When enabled, `QueryBuilderEngine.build()` calls `testAndAdjustQuery()`, which performs `scryfallClient.searchCards({ query, limit: 1 })`.
- Why it is inefficient:
  A tool whose main job is local parsing and query construction consumes a rate-limited external API call on the default path, even when the caller only needs the generated Scryfall syntax.
- Impact:
  This adds user-visible latency and Scryfall quota pressure to exploratory query-building workflows. It can also serialize behind unrelated queued Scryfall calls due to the global rate limiter.
- Candidate fix:
  Consider defaulting `test_query` to `false`, or split "build query" from "validate query" behavior. If default validation is important, cache test summaries by final query string.

## 4. The HTTP transport buffers request bodies without a size limit

- Location: `src/http.ts:87-95`
- Status: resolved on 2026-04-23.
- Evidence:
  `readJsonBody()` pushes every incoming chunk into an array, concatenates all chunks, converts the full buffer to a string, and parses JSON. There is no maximum byte count before buffering completes.
- Why it is inefficient:
  Large or accidental request bodies allocate at least the chunk array, concatenated `Buffer`, UTF-8 string, and parsed object. The server does this before rejecting oversized input.
- Impact:
  For local or HTTP MCP use, a single oversized POST can create avoidable memory pressure. This is both an efficiency problem and a basic resilience gap.
- Candidate fix:
  Track accumulated bytes while reading, reject with 413 once a configurable cap is exceeded, and avoid `Buffer.concat()` for bodies that are already too large.

## 5. Cache eviction can scan the whole cache once per evicted entry

- Location: `src/services/cache-service.ts:417-454`
- Status: resolved on 2026-04-23.
- Evidence:
  `evictToFit()` calls `findLeastRecentlyUsedKey()` inside a loop. `findLeastRecentlyUsedKey()` scans every cache entry to find the oldest access timestamp, then only one entry is removed per scan.
- Why it is inefficient:
  When a large insertion requires many evictions, eviction cost becomes O(cache_size * evicted_entries). The default cache size can be large enough for this to matter during bulk payload or large search-response cache writes.
- Impact:
  Cache writes that should be cheap bookkeeping can become CPU-heavy under memory pressure, adding latency to request paths that are already doing expensive work.
- Candidate fix:
  Maintain an ordered LRU structure or collect eviction candidates in one pass, then delete enough entries to fit the new item.

## 6. ScryfallClient card cache keys do not canonicalize all service-level identifiers

- Location: `src/services/scryfall-client.ts:375-417`, `src/services/cache-service.ts:307-310`
- Status: resolved on 2026-04-23.
- Evidence:
  `getCard()` passes `params.identifier`, `params.set`, and `lang` directly into `CacheService.createCardKey()`. Several tool schemas trim or lowercase before calling the service, but prompts and direct `ScryfallClient` callers can still produce separate keys for semantically equivalent card lookups.
- Why it is inefficient:
  Semantically equivalent service-level lookups such as different card-name casing, prompt-provided whitespace, UUID casing, or set-code casing can create distinct cache entries for the same Scryfall card.
- Impact:
  Repeated card lookups from prompts, batch tools, and direct service callers can miss cache unnecessarily and consume extra rate-limited requests.
- Candidate fix:
  Canonicalize card keys by trimming identifiers, lowercasing set codes and UUIDs, normalizing language, and using the resolved Scryfall ID as an alias after the first fetch when possible.

## 7. Filtered set resources duplicate client-level filter and serialization caches

- Location: `src/services/scryfall-client.ts:461-469`, `src/resources/set-database.ts:137-152`
- Status: resolved on 2026-04-23.
- Evidence:
  `ScryfallClient.getSets(filters)` caches a filtered `ScryfallSet[]`. `SetDatabaseResource.getFilteredSets()` then wraps that filtered array in a serialized JSON payload and caches the string separately.
- Why it is inefficient:
  The set catalog is small, but filtered resource reads can represent the same filtered view twice in cache: once as client-level data and once as a resource payload. Cold filtered resource reads also perform filter work in the client and serialization work in the resource.
- Impact:
  This is modest compared with bulk-card paths, but it is repeated local CPU and memory for a path whose output is deterministic.
- Candidate fix:
  Decide whether filtered set caching belongs in the client or resource layer. For resource-only consumers, caching just the serialized payload may be enough.

## 8. Search pagination retains full fetched pages before extracting the requested window

- Location: `src/services/scryfall-client.ts:279-322`
- Status: resolved on 2026-04-23.
- Evidence:
  `searchCards()` stores fetched Scryfall pages in `pages`, then calls `collectRequestedWindow()` to slice out the requested logical page.
- Why it is inefficient:
  The implementation can retain more card objects than the caller requested. This is bounded by the Scryfall page size and local limit rules, but it is still avoidable allocation on the hottest search path.
- Impact:
  For high-page or boundary-crossing requests, the service keeps whole API pages and then caches only the smaller result window. The overhead is lower than the higher-ranked items, but the path is common.
- Candidate fix:
  Collect the requested window incrementally as each API page arrives, keeping only the cards needed for the response plus warning metadata.

## Notes

- I did not rank parser loops, formatter loops, or rules-file scanning higher because their input sizes are bounded or local-only compared with Scryfall API and bulk-data paths.
- I did not run benchmarks for this audit. The remediation plan requires focused regression tests and, where practical, lightweight measurements for request count, cache behavior, and heap growth.
