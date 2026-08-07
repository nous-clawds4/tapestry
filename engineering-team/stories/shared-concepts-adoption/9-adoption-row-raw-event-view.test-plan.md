# Test Plan: Story 9 — Clickable queue rows → raw header event view

**Story:** `engineering-team/stories/shared-concepts-adoption/9-adoption-row-raw-event-view.md`
**ADR:** skipped (fast-track; approach in the story's Background)
**Date:** 2026-08-07
**Suite:** `test/adoption-raw-event-view.test.js` (registered in `test/test.js`, the standard five-touch)

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| AC-1 rows clickable (four tables; declined by `target`) | `S2` + review-phase browser walk (click → page renders) | structural + manual |
| AC-2 the page (scan fetch, param, pretty JSON, not-found) | `S1` + browser walk (real coordinate and a bogus one) | structural + manual |
| AC-3 buttons unaffected | `S3` (stopPropagation retained; passes pre AND post) + walk | structural + manual |
| AC-4 raw-only simplicity | by construction (page renders the event verbatim) | — |

## Edge cases

- [x] Declined rows navigate by `target` (S2's dedicated pin).
- [x] Missing coordinate → plain not-found message (browser walk with a bogus coord).
- [x] UI-only change: no H rows needed — no server surface changed (the scan API is untouched).

## How to run

```
node test/adoption-raw-event-view.test.js
```

## Verification

Failing pre-implementation, confirmed 2026-08-07:

```
  ✗ S1 — ui/src/pages/shared-concepts/HeaderEvent.jsx is missing
  ✗ S2 — all four tables … must carry onRowClick — found 0
  ✓ S3 (regression, passes pre AND post): action buttons keep stopPropagation

adoption-raw-event-view: 1 passed, 2 failed, 0 skipped
```
