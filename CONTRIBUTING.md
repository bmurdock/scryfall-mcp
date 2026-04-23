# Contributing

## Scope

This repository is an MCP server for Scryfall-backed Magic: The Gathering workflows. Contributions should improve correctness, Scryfall compliance, maintainability, or developer ergonomics without expanding the project into unrelated MTG tooling.

## Development Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` if you need to override defaults.
3. Start local development with `npm run dev`.
4. Run validation before opening a pull request:
   - `npm run lint`
   - `npm run type-check`
   - `npm test`

## Project Expectations

- Keep TypeScript strict and avoid `any`.
- Use the existing `ScryfallClient`, rate limiting, and cache layers instead of bypassing them.
- Prefer focused changes over large speculative refactors.
- Use Pino logging instead of `console`.
- Preserve or improve Scryfall API compliance.

## Tests

- Add or update Vitest coverage for behavior changes.
- Keep tests in `tests/**/*.test.ts`.
- If a change affects tool contracts, include both success and failure-path coverage.

## Performance And Correctness Guardrails

- Use TDD for behavior-changing performance fixes: write the failing interaction test first.
- Do not add a second network call to preview data when an earlier step already fetched equivalent metadata.
- Filtered cache keys must include every dimension that affects the result, or the code must cache only a canonical base dataset.
- For large cached values, prefer caller-supplied `sizeBytes` or string payloads over incidental re-serialization for accounting.
- Prefer one-pass collection and partition logic on hot paths unless a clearer multi-pass version is proven insignificant.

## Pull Requests

- Use a clear summary that explains the user-visible or maintainer-visible change.
- Link related issues when applicable.
- Mention any compliance, caching, or rate-limiting implications.
- Include representative examples when tool output changes.

## Documentation

- Update `README.md` when setup, usage, or exposed capabilities change.
- Keep internal planning artifacts and AI-assistant instruction files out of the public repository.
