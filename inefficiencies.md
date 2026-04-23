# Inefficiency Targets

Validated against the current workspace on 2026-04-23.

This is a code-inspection audit, not a benchmark report. Rankings favor work that is both expensive and likely to recur on real request paths. All six ranked items below are now resolved in the current workspace.

## Validation Scope

- Re-checked each listed issue against the current implementation in `src/` after Tasks 1-5 landed.
- Ran the Task 6 focused verification suite:
  `npm test -- tests/cache-service.test.ts tests/scryfall-client-bulk-stream.test.ts tests/card-database-resource.test.ts tests/scryfall-client-sets-cache.test.ts tests/set-database-resource.test.ts tests/find-synergistic-cards.test.ts tests/search-window.test.ts tests/search-pagination.test.ts`
- Current state: all six ranked items below are resolved on 2026-04-23, with targeted regression coverage in place for each subsystem.

## Skills Check

I checked the available skill inventory from this session and the on-disk Superpowers plugin skills.

Most relevant or beneficial for follow-up work:

- `superpowers:using-superpowers`
  Why: process skill for deciding which follow-up workflow to apply before changing code.
- `superpowers:receiving-code-review`
  Why: closest fit to this task's review mindset; useful for validating findings against the actual code instead of agreeing with prior notes.
- `superpowers:verification-before-completion`
  Why: the right guardrail for any future remediation so performance claims are backed by fresh measurements or test output.
- `superpowers:systematic-debugging`
  Why: useful if any ranked item needs profiling or evidence-gathering before refactoring.
- `superpowers:writing-plans`
  Why: useful if this ranked list is turned into a remediation plan.
- `superpowers:test-driven-development`
  Why: useful when implementing fixes that need regression coverage.
- `superpowers:requesting-code-review`
  Why: useful after remediation work, not during this read-only audit.

Not materially relevant for this task:

- Non-Superpowers skills in this session are mostly OpenAI docs, frontend/web, mobile, game, office-document, image, GitHub, or deployment workflows.
- No generic non-Superpowers performance-audit skill is exposed here.
- Superpowers skills such as `dispatching-parallel-agents`, `subagent-driven-development`, `using-git-worktrees`, and `finishing-a-development-branch` are process options for later execution, not for this audit itself.

## 1. Bulk card resource rebuild does a full-download, full-transform, full-stringify pass in one giant heap path

- Location: `src/resources/card-database.ts:120-146`, `src/resources/card-database.ts:152-211`
- Why it is inefficient:
  `rebuildSerializedSnapshot()` downloads the entire oracle-card bulk array into memory, then `serializeBulkSnapshot()` walks that array and `JSON.stringify()`s a freshly projected object for every card into one giant string.
- Impact:
  This path holds the parsed bulk array plus the growing serialized payload at the same time, and it creates a large amount of transient allocation while rebuilding the snapshot.
  Daily refreshes will pay the full CPU and GC cost again.
- Why it ranks first:
  It scales with the entire Scryfall bulk dataset and is the most obviously memory-heavy path in the codebase.
- Status: resolved on 2026-04-23
- Verification:
  `tests/scryfall-client-bulk-stream.test.ts` and `tests/card-database-resource.test.ts` now cover streamed bulk parsing and streamed snapshot rebuild behavior. The full Task 6 verification suite passed on 2026-04-23.

## 2. Cache hits mutate the LRU map on every read

- Location: `src/services/cache-service.ts:33-48`, `src/services/cache-service.ts:352-355`
- Why it is inefficient:
  Every successful `get()` calls `touchEntry()`, which does `delete()` plus `set()` on the backing `Map` just to preserve LRU order.
- Impact:
  The hottest cached paths in the project, including card lookups, search results, set reads, and resource payload reads, all pay an extra mutating write on cache hit instead of a pure read.
  That adds churn to the common case and couples read volume directly to cache bookkeeping cost.
- Why it ranks second:
  This is systemic overhead on many request paths rather than a rare maintenance path.
- Status: resolved on 2026-04-23
- Verification:
  `tests/cache-service.test.ts` now covers stable map iteration on cache hits and LRU eviction by explicit recency metadata. The full Task 6 verification suite passed on 2026-04-23.

## 3. Cache writes re-serialize non-string payloads just to estimate size

- Location: `src/services/cache-service.ts:54-63`, `src/services/cache-service.ts:333-350`
- Why it is inefficient:
  `calculateEntrySize()` calls `JSON.stringify(entry.data)` for every non-string cache write when `sizeBytes` is not provided.
- Impact:
  Large search responses, set payloads, and other object caches pay an extra full serialization pass that does no user-visible work.
  This compounds with already expensive producer paths.
- Correction:
  The cache layer already has a `sizeBytes` escape hatch and tests for it. The remaining issue is that current production call sites do not use that hint on the heavy paths, so the fallback serializer still runs in practice.
- Why it ranks third:
  It is not as costly as the bulk snapshot rebuild, but it is broad and avoidable CPU work across the cache layer.
- Status: resolved on 2026-04-23
- Verification:
  `tests/cache-service.test.ts` now covers non-serializing fallback size estimation and the cache implementation uses approximate sizing instead of hot-path `JSON.stringify()`. The full Task 6 verification suite passed on 2026-04-23.

## 4. Synergy search still uses a concurrency-tuned fetch budget even though requests are globally serialized

- Location: `src/tools/find-synergistic-cards.ts:307-357`, `src/services/rate-limiter.ts:28-69`
- Why it is inefficient:
  `getPerQueryLimit()` divides the target result budget using `SEARCH_CONCURRENCY`, but the shared `RateLimiter` executes requests one at a time. In practice, the tool is using a smaller per-query page size as if several searches were happening in parallel, even though they are serialized.
- Impact:
  If the first ranked query could have satisfied most or all of the target results, the smaller serialized page size can force additional round trips and more dedup work before the tool stops.
  This is a user-facing latency issue, but the root cause is the stale concurrency heuristic rather than missing `Promise.all`.
- Correction:
  An earlier framing of this issue described it as absent network concurrency. The current codebase does not permit that anyway because `RateLimiter.execute()` serializes request execution. The real inefficiency is the mismatch between a concurrency-based page-size heuristic and a serialized request scheduler.
- Why it ranks fourth:
  It affects a narrower feature than the cache items above, but it can still create unnecessary serialized search traffic on a user-facing tool path.
- Status: resolved on 2026-04-23
- Verification:
  `tests/find-synergistic-cards.test.ts` now covers larger first-query budgeting and shrinking follow-up budgets under serialized execution. The full Task 6 verification suite passed on 2026-04-23.

## 5. Set filtering repeatedly rescans and reserializes the full set catalog for filtered reads

- Location: `src/services/scryfall-client.ts:437-455`, `src/resources/set-database.ts:71-79`, `src/resources/set-database.ts:131-147`
- Why it is inefficient:
  `ScryfallClient.getSets(filters)` performs a full-list filter for direct callers, while `SetDatabaseResource.getFilteredSets()` performs its own full-list filter on the cached set model before serializing a fresh JSON payload. On cold resource reads, `getSetDataModel()` also populates from `getSets()` first, so the initial path pays for both the client’s no-op filter and the resource’s real filter.
- Impact:
  The set list is smaller than card bulk data, but repeated filtered requests still rescan the whole catalog and rebuild full response strings each time.
  The pretty-printed `JSON.stringify(..., null, 2)` path also adds avoidable output-allocation overhead.
- Correction:
  The older cache-collision bug is no longer present. `ScryfallClient.getSets()` now caches only the canonical unfiltered `/sets` payload, so the current problem is repeated local filtering and serialization cost rather than wrong cached results.
- Why it ranks fifth:
  Real work is being repeated, but the dataset is modest enough that it stays below the bulk-data and hot-cache items.
- Status: resolved on 2026-04-23
- Verification:
  `tests/scryfall-client-sets-cache.test.ts` and `tests/set-database-resource.test.ts` now cover filtered-view caching and serialized payload reuse. The full Task 6 verification suite passed on 2026-04-23.

## 6. Search pagination buffers whole API pages before slicing even when the caller only needs a narrow window

- Location: `src/services/scryfall-client.ts:277-317`
- Why it is inefficient:
  `searchCards()` fetches the starting Scryfall page, copies its entire `data` array into `combinedCards`, may append another full page, and only then slices down to the requested window.
- Impact:
  The waste is bounded because `limit` is capped, but the hot search path still over-allocates and copies more card objects than the caller asked for.
  This also adds avoidable work to the cache payload stored for that request.
- Correction:
  This is not an unbounded paginator problem. Because logical `limit` is capped at 175 and Scryfall API pages are also 175, the current implementation will at most retain roughly two API pages for one request window. The issue is still real, but it is a bounded allocation/copy inefficiency.
- Why it ranks sixth:
  The overhead is real but bounded, so it matters less than the higher-ranked bulk, cache, and sequential-network issues.
- Status: resolved on 2026-04-23
- Verification:
  `tests/search-window.test.ts` and `tests/search-pagination.test.ts` now cover window-only collection and preserved pagination behavior. The full Task 6 verification suite passed on 2026-04-23.

## Notes

- This file now serves as a closed audit record for the 2026-04-23 remediation pass rather than an open issues list.
- I did not rank `AnalyzeDeckCompositionTool`, the parser helpers, or the test-only `src/utils/query-validator.ts` in the top six because their current inefficiencies are either bounded by small inputs or not on a production request path.
