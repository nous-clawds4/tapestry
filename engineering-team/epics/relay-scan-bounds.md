# Epic: relay-scan-bounds

**Created:** 2026-09-07
**Status:** Active
**Book:** `engineering-team/audits/relay-scan-bounds/book.md` (acceptance-frame; Bug lane)
**Provenance:** Operator report 2026-09-07 (in-session) — `/tapestry/lists` returns
`Error: stdout maxBuffer length exceeded` on `staging.brainstorm.world` and
`tags.brainstorm.world`, but not on `tapestry.brainstorm.world` or `localhost:7778`.
Diagnosis in-session: the difference is data volume, not configuration. Measured
2026-09-07 against all four deployments.

## Goal

Relay-backed control-panel surfaces stay usable as the relay grows, and the shared relay-scan
path cannot be tripped into a buffer failure by a caller that forgets to bound its request.

## Why it matters

The failure is silent about its own cause and it is *latent everywhere*. The two deployments
that still work are not healthy — they are ~1,700 list items from the same error, so this
reaches production on its own with no code change. The class is broader than the one page:
an unbounded scan looks correct on a small relay and fails outright on a large one, which is
exactly the shape of defect that ships green and breaks in the field.

## Stories

`stories/relay-scan-bounds/`:
1. `1-bound-simple-lists-relay-scans.md` — the two Simple Lists pages + a guard on the shared
   scan path. Bug; all five phases.

## Related, deliberately not in this epic

- **`filterTaggingsUsingTag` has no `LIMIT`** — the same class, bounded only by its exec
  buffer (~30–40k events). Already triaged to the **event-tagging** epic's performance
  hardening (`stories/_intake.md`, 2026-07 entry). Left there rather than absorbed.
- **A sweep of every remaining relay-scan caller** — considered and declined at planning
  (operator's call, 2026-09-07). The endpoint guard is what protects the unswept callers.
