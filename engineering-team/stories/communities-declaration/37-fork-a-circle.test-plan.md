# Test Plan: Story 37 — Fork a circle

**Story:** `communities-declaration/37-fork-a-circle.md` · **ADR:** 0029 + 0028/§26 · **Date:** 2026-06-05

## Coverage
| Criterion | Test | File |
|---|---|---|
| read ?from parent | T1 | `test/fork-a-circle.test.js` |
| pre-fill via resolver | T2 | same |
| pass parentATag to builder | T3 | same |
| Fork action on detail → found flow | T4 | same |
| builder omits empty optional fields | T5 (pure-fn) | same |
| fork writes only changed fields | T6 | same |

## Infrastructure
Node runner; source-regex over Found.jsx + CommunityDetail.jsx, pure-fn eval of the builder. Registered as `fork-a-circle`.

## Initial state (TDD)
T1–T4/T6 failed before the fork mode; T5 failed before the builder's omit-empty change. Now 6/6.

## How to run
`npm test`
