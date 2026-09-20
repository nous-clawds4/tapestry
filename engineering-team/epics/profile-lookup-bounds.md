# Epic: profile-lookup-bounds

**Created:** 2026-09-08
**Status:** Active
**Book:** `engineering-team/audits/profile-lookup-bounds/book.md` (acceptance-frame; Bug lane)
**Provenance:** Found by `relay-scan-bounds` #1 and deliberately left unfixed — see that
story's "Found, not fixed (out of scope)" section
(`engineering-team/stories/done/relay-scan-bounds/1-bound-simple-lists-relay-scans.md`).
It survives that book's close as a carry-forward (`audits/relay-scan-bounds/audit.md` §6,
`OPEN.md` row 202, which names it "already spun off as its own task" — this epic is that
task). Reproduced and measured independently on `localhost:7778` on 2026-09-07, and
re-measured against current `staging` on 2026-09-20.

## Goal

Looking up profile metadata stays correct however many distinct pubkeys a page needs, and the
lookup endpoint cannot be tripped into an uninterpretable rejection by a caller that asks for
too many at once.

## Why it matters

Every control-panel surface that shows *who authored a thing* resolves names through one
shared lookup, and that lookup puts the whole pubkey set in a single URL. It is correct on
small data and wrong on real data, in the same shape as the defect `relay-scan-bounds` #1
fixed — but the failure here is quieter. Nothing errors. Names simply degrade to truncated
pubkeys, and the operator is left reading `2f1b310f…` where a display name belongs, with no
indication anything failed.

It is also getting worse without anyone touching it. `/tapestry/lists/items` asked for 216
distinct authors on 2026-09-07 and 246 on 2026-09-20, with no code change to the page or the
lookup in between. At 252 the refusal stops carrying a readable body at all — the request is
rejected by the HTTP layer before the application runs. The defect is migrating from a form a
client could react to into one it cannot, on its own, on a clock.

The blast radius is the whole control panel: 41 call sites across 38 files share the hook
(up from 38 across 35 twelve days earlier), and most of them derive their pubkey set from an
unbounded row collection.

## Stories

`stories/profile-lookup-bounds/`:
1. `1-resolve-author-names-at-any-scale.md` — the shared profile lookup + an interpretable
   endpoint refusal. Bug; all five phases.

## Related, deliberately not in this epic

- **The row bounds on the pages themselves** — how many rows a page renders, and therefore how
  many distinct authors it asks for, was `relay-scan-bounds` territory; that book is now
  closed. This epic makes the lookup correct for whatever set it is handed.
- **`relay-scan-bounds` #1's endpoint guard** — a sibling defect on `/api/strfry/scan`, fixed
  there. Same class, different endpoint; the two do not share code.
- **`/api/profiles` skipping its local-relay fallback on a relay-race timeout** — same file,
  different defect, owned by the open `assistant-profile` book (`OPEN.md` row 273).
