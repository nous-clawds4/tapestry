# Test Plan: Story 35 — Discover circles (read-only)

**Story:** `communities-declaration/35-discover-circles.md` · **ADR:** covered by 0029 · **Date:** 2026-06-05

## Coverage map
| Criterion | Test | File |
|---|---|---|
| AC-1 renders with no account | T5 (no `!signedIn` early-return) | `test/discover-circles.test.js` |
| AC-2 Declarations appear (union) | T1, T2 | same / `client.js` |
| AC-3 search filters | (covered by existing discover suite's filter tests) | — |
| AC-4 empty state | T4 | same |
| AC-5 loading/error | T6 | same |
| (cards render) | T3 | same |

## Infrastructure
Node runner, source-regex over `Discover.jsx` + `client.js`. Registered as the `discover-circles` suite.

## Initial state (TDD)
All 6 tests passed immediately — the discovery union + Discover surface were delivered by Story 33 (the `getDiscoverableCommunitiesFromRelay` union). This story ratifies CD discoverability + no-account rendering; no new implementation code was required.

## How to run
`npm test`
