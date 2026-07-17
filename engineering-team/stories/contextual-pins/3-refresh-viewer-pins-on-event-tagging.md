# Story 3: Refresh a viewer's pins when they tag an event (event-tagging freshness)

**Status:** Draft
**Created:** 2026-07-16
**Type:** Feature
**Depends on:** Story 2 (note list displays the TA-signed kind-30393)

## Background

The pinned note list is a materialized snapshot, recomputed only on pin create/edit, manual
refresh, or the cron. **Tagging a note does not refresh it.** So when a viewer who has pinned
a tag then tags an event with that tag, the newly-tagged note does not appear in their pinned
list, and no staleness is surfaced at the top level — the note is a valid assertion in the
relay, but nothing folded it into the pin's list.

Profile tagging already solves the equivalent problem: `useProfileTags.applyTag/disputeTag`
calls `reexportAfterAssertion → syncPinnedExportsForTag`, which refreshes the viewer's pin
after they apply/dispute. Event tagging has no such hook.

**Story 2 makes this cheap.** Once the Notes view displays the **TA-signed** kind-30393 note
TL (Story 2), keeping it fresh is a server-side recompute (`refresh-pinned-tags-for-viewer`)
— **no additional signer prompt**, unlike the profile path's client re-export. This story adds
that hook.

## User-facing description

As a user, when I tag an event with a tag I've already pinned, I want my pin(s) of that tag to
update so the newly-tagged note shows up in my pinned list — without an extra signing prompt.

## Acceptance criteria

- [ ] Given the viewer has pinned tag T, when the viewer publishes an event-tagging (apply) for T on some note, then the viewer's pin(s) of T are refreshed so the note's TA-signed note TL is recomputed.
- [ ] Given the viewer holds **multiple coexisting pins** of T (neutral + one or more contexts), when they tag an event with T, then **all** of those pins are refreshed — not just one.
- [ ] Given the refresh runs, then it completes **without an additional NIP-07 signing prompt** (the recompute is TA-signed, server-side).
- [ ] Given the viewer has **no** pin of T, when they tag an event with T, then nothing is refreshed (no-op, no error).
- [ ] Given the viewer **disputes/retracts** an event-tagging for a pinned tag T, then the same refresh runs (the note may drop out of the list).
- [ ] Given the refresh has completed and the newly-tagged note passes the pin's note curation and the observer's POV, then the note **appears in the pinned Notes view** (per Story 2's display) on the next load of that view.

## Concepts touched

- `39998:<TA>:tag-pinning` — tag pinning (the pins being refreshed)
- event-tagging assertion (kind-39999, the write that triggers the hook)
- kind-30393 TA-signed note Trusted List (recomputed by the refresh)

## Out of scope

- Propagating to **other** users' pins. This refreshes only the pins of the user who is doing
  the tagging. Broad, event-driven republish across all affected pins is the separate
  `tag-applicability/4-event-driven-applicability-republish` work.
- The client-signed kind-30003 note export re-publish (that remains an explicit, prompted
  Export action) — this story keeps the *displayed* TA note TL fresh, not the export artifact.
- Real-time/live updates while the Notes view is already open (a reload of the view reflects
  the refresh).

## Open questions

- Debounce: coalesce rapid tag/untag bursts into one refresh per (viewer, tag)? (Recommended —
  mirror `syncPinnedExportsForTag`'s per-pin debounce.)
- Trigger site: is there a single client choke point for publishing an event-tagging
  (apply + dispute), or does each note/event surface publish independently? The hook must
  cover every path. (Architect to confirm during Amendment I.)

## Linked artifacts

- ADR: `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md` (Amendment I)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
