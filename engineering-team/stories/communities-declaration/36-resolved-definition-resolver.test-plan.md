# Test Plan: Story 36 — §26 resolver

**Story:** `communities-declaration/36-resolved-definition-resolver.md` · **ADR:** §26 / 0028 · **Date:** 2026-06-05

## Coverage
| Criterion | Test | File |
|---|---|---|
| exports | T1 | `test/resolved-definition-resolver.test.js` |
| child overrides | T2 | same |
| empty child inherits | T3 | same |
| empty topics inherit | T4 | same |
| depth + cycle guard | T5 | same |
| first-listed-wins (reverse fold) | T6 | same |
| live injected fetcher | T7 | same |

## Infrastructure
Node runner; pure-function eval of `mergeDefinition` + source-regex over the walk. Registered as `resolved-definition-resolver`. No stack precondition.

## Initial state (TDD)
All 7 failed before `resolveDefinition.js` existed. Now 7/7.

## How to run
`npm test`
