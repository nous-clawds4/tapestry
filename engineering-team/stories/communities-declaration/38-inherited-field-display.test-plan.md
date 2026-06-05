# Test Plan: Story 38 — inherited-field display

**Story:** `communities-declaration/38-inherited-field-display.md` · **ADR:** 0028/§26 + 0029 · **Date:** 2026-06-05

## Coverage
| Criterion | Test | File |
|---|---|---|
| uses §26 resolver | T1 | `test/inherited-field-display.test.js` |
| resolves only when parent exists (live) | T2 | same |
| "(inherited)" marker rendered | T3 | same |
| effective/resolved value rendered | T4 | same |
| no-parent → no markers (no regression) | T5 | same |

## Infrastructure
Node runner; source-regex over CommunityDetail.jsx. Registered as `inherited-field-display`.

## Initial state (TDD)
T1–T4 failed before the resolve effect + marker; T5 verifies the gating. Now 5/5.

## How to run
`npm test`
