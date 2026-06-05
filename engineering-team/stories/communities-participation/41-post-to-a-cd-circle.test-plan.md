# Test Plan: Story 41 — post anchor by model (NB-1)

**Story:** `communities-participation/41-post-to-a-cd-circle.md` · **ADR:** 0029 · **Date:** 2026-06-05

## Coverage
| Criterion | Test | File |
|---|---|---|
| anchor 39998 for declaration / 39999 else | T1 | `test/post-to-cd-circle.test.js` |
| posting wiring intact (no regression) | T2 | same |
| reads via fetchPostsForCommunity w/ anchor | T3 | same |

## Infrastructure
Node runner; source-regex over CommunityDetail.jsx. Registered as `post-to-cd-circle`.

## Initial state (TDD)
T1 failed before the model-derived anchor (it was hardcoded 39999). T2/T3 guard the existing Slice-6 wiring. Now 3/3.

## How to run
`npm test`
