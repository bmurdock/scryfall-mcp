# Sanar MCP Exercise Issues

Date: 2026-04-28

Exercise:

- Start and verify `scryfall-http-local`.
- Use the local Streamable HTTP MCP server to build an Arena-only Historic Brawl deck for `Sanar, Unfinished Genius // Wild Idea`.
- Convert the recommendation into an Arena importable Markdown artifact.
- Observe tool behavior, latency, and bugs during real use.

Artifacts produced:

- `docs/decks/sanar-unfinished-genius-historic-brawl.md`

## Summary

The HTTP MCP server worked after manual startup and handled normal `initialize`, `tools/list`, `get_card`, `validate_brawl_commander`, and chunked `search_cards` flows. The exercise found several issues around operational readiness, newer-card synergy discovery, rate-limit behavior, deck-list parsing, Brawl land-count heuristics, and export data completeness.

## Findings

### 1. `scryfall-http-local` was registered but not running

- Severity: medium
- Status: resolved on 2026-04-28 by `docs: add HTTP MCP smoke workflow`
- Evidence:
  - Codex config had `[mcp_servers.scryfall-http-local] url = "http://127.0.0.1:3000/mcp"`.
  - `curl http://127.0.0.1:3000/health` initially failed with connection refused.
  - Starting `npm run dev:http` in the foreground brought the server up.
  - Final operating state was a detached `screen` session named `scryfall-http-local`, with `/health` returning healthy.
- Impact:
  - A configured HTTP MCP server can appear available to clients while no listener exists.
  - Users need manual command knowledge to recover.
- Expected behavior:
  - The repo should provide an explicit local HTTP startup/smoke workflow that verifies `/health`, MCP initialization, and `tools/list`.

### 2. First background startup attempt did not stay running

- Severity: low
- Status: resolved on 2026-04-28 by `docs: add HTTP MCP smoke workflow`
- Evidence:
  - `nohup npm run dev:http > /tmp/scryfall-http-local.log 2>&1 &` returned a PID, but no listener appeared and the log remained empty.
  - Foreground `npm run dev:http` and later a detached `screen` session worked.
- Impact:
  - The documented or recommended startup method needs to be robust for long-running local MCP testing.
- Expected behavior:
  - Local docs should recommend a command that stays attached or a tested detached command.

### 3. `find_synergistic_cards` returned no results for Sanar

- Severity: medium
- Status: resolved on 2026-04-28 by `fix: derive synergy queries from oracle text`
- Evidence:
  - Call: `find_synergistic_cards` with `focus_card: "Sanar, Unfinished Genius"`, `synergy_type: "theme"`, `format: "brawl"`, `arena_only: true`, `limit: 20`.
  - Result: `No synergistic cards found for "Sanar, Unfinished Genius" in brawl.`
  - Follow-up direct MCP searches found many relevant cards for the same commander and constraints, including `Storm-Kiln Artist`, `Archmage Emeritus`, `Guttersnipe`, `Goblin Electromancer`, and `Third Path Iconoclast`.
- Impact:
  - Newer commanders with limited historical popularity can fail discovery even when obvious oracle-text synergies exist.
- Expected behavior:
  - If the focus card is found, the tool should derive fallback searches from oracle text, type line, color identity, and commander-relevant mechanics instead of returning empty.

### 4. Rate-limit handling opened the circuit breaker and blocked later calls

- Severity: high
- Status: resolved on 2026-04-28 by `fix: keep 429 retry state out of circuit breaker`
- Evidence:
  - Sequential exact-card verification succeeded for 22 cards, then one call returned `Rate limit exceeded. Retry after 60s.`
  - Later calls returned `Scryfall API error: Circuit breaker is open due to consecutive failures`.
  - `analyze_deck_composition` later ran for about 70 seconds and returned `Unexpected error: Rate limit exceeded`.
- Impact:
  - A single user workflow can poison the in-process client for subsequent calls until restart or enough state is reset.
  - Tools surface mixed error messages instead of a consistent retryable status.
- Expected behavior:
  - HTTP 429 should pause/resume or return a structured retry hint without counting twice toward circuit-breaker failure.
  - The circuit breaker should distinguish upstream rate limiting from repeated hard failures.

### 5. `analyze_deck_composition` splits valid card names on commas

- Severity: high
- Status: resolved on 2026-04-28 by `fix: parse Arena deck lists with comma card names`
- Evidence:
  - The parser uses `deckList.split(/[\n,]/)`.
  - Deck entries such as `Baral, Chief of Compliance`, `Ral, Storm Conduit`, `Balmor, Battlemage Captain`, and `Otawara, Soaring City` are split into partial fuzzy lookups.
  - Logs showed ambiguous Scryfall calls such as `cards/named?fuzzy=Baral` and `cards/named?fuzzy=Ral`.
- Impact:
  - Arena-format and normal Magic card names are parsed incorrectly.
  - The tool generates extra Scryfall requests, increases ambiguity, and contributes to rate limiting.
- Expected behavior:
  - Newline-delimited deck lists should preserve commas inside card names.
  - Arena import lines should parse quantities and strip optional `(SET) number` suffixes.

### 6. `suggest_mana_base` recommends too few lands for 100-card Brawl

- Severity: medium
- Status: resolved on 2026-04-28 by `fix: tune Brawl mana base land counts`
- Evidence:
  - Call: `suggest_mana_base` with `deck_size: 100`, `format: "brawl"`, `strategy: "combo"`, `average_cmc: 2.7`.
  - Result: `Total Lands: 30/100`.
  - Source code clamps `format === "brawl"` to `22..26`, then a later global floor raises the result to only 30 for a 100-card deck.
- Impact:
  - The recommendation is not usable for Historic Brawl, where 36-40 lands is a common baseline depending on curve and ramp.
- Expected behavior:
  - Historic Brawl should use a 100-card land baseline similar to Commander, with separate handling for 60-card Standard Brawl if needed.

### 7. `search_cards` JSON output omits set code and collector number

- Severity: medium
- Status: resolved on 2026-04-28 by `feat: expose card print identifiers`
- Evidence:
  - `formatCard()` includes `set_name`, but not Scryfall `set` or `collector_number`.
  - Arena import output required lines such as `1 Sanar, Unfinished Genius (SOS) 223`.
  - The final Markdown had to use direct Scryfall search responses for print identifiers after MCP legality/Arena validation.
- Impact:
  - The MCP tool cannot directly support Arena import-list generation even though the backing Scryfall data contains the fields.
- Expected behavior:
  - Formatted card JSON should include `set`, `collector_number`, and ideally `arena_id` when present.

### 8. `search_cards` appends duplicate `game:arena`

- Severity: low
- Status: resolved on 2026-04-28 by `fix: avoid duplicate Arena search filters`
- Evidence:
  - When the input query already included `game:arena` and `arena_only: true` was set, logs showed final queries ending in `game:arena ... game:arena`.
- Impact:
  - This is harmless for Scryfall results but adds query noise and makes logs harder to read.
- Expected behavior:
  - The tool should append `game:arena` only if the sanitized query does not already contain a game filter that satisfies Arena availability.

## What Worked Well

- `validate_brawl_commander` correctly validated Sanar as Arena available and legal in Historic Brawl.
- Chunked exact-name OR queries with `game:arena legal:brawl` worked reliably and kept request volume low.
- Final validation resolved all 94 unique names in the import list.
- The HTTP MCP handshake and `tools/list` were fast after startup.

## Immediate Workaround Guidance

- Prefer chunked `search_cards` OR queries over one MCP call per card when validating a deck list.
- Avoid comma-separated input to `analyze_deck_composition` until the parser is fixed.
- Restart the local HTTP server if a 429 opens the current in-process circuit breaker during testing.
- For Arena import generation, use MCP validation plus direct Scryfall response fields until `FormattedCard` exposes `set` and `collector_number`.
