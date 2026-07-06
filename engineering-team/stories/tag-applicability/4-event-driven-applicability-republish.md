# Story 4: Event-driven applicability-list republish (+ slow backstop)

**Status:** Approved
**Created:** 2026-07-06
**Type:** Feature
**Provenance:** Operator request 2026-07-06 — keep the *published* applicability Trusted Lists
(kind-30394) fresh for **external consumers** without a busy polling timer.

## Background
The two applicability Trusted Lists ("Tags for Nostr Events" / "Tags for Nostr Pubkeys",
kind-30394, HINT ∪ USAGE) are TA-signed snapshots published by `refreshApplicabilityLists`. They are
**not** on our own read path — the picker computes live via `/api/tags/applicability` and is always
fresh. The published lists exist for **external consumers / federation**, so their only requirement is
to stay reasonably current with the actual tag vocabulary.

Today they only refresh on a manual trigger (or a seeded-disabled 10–30 min timer). The operator
chose **event-driven** freshness over a busy timer: republish when the vocabulary actually changes —
a tag is created (with a context hint) or a tag is applied to a target of a context type for the
first time (graduating it into that context's list). Membership only changes on tag-creation and
first-in-context usage; subsequent uses change counts/order, not membership.

Because tagging is permissionless (a tagging can be published by any client, not just ours), a pure
app-driven trigger can't see external mutations — so this story pairs the event trigger with a
**slow backstop** (far slower than the rejected 10-min timer) for eventual convergence.

## User-facing description
As an external consumer reading this instance's applicability Trusted Lists, I want them to update
promptly after the tag vocabulary changes — without the instance emitting a stream of redundant
list events on a busy timer — so what I read is current and I'm not re-processing unchanged snapshots.

## Acceptance criteria
Testable from the outside.

- [ ] **Republish on a membership-changing mutation.** Given a tag is created (carrying a context
  hint) or applied to a target of a context type **through the app**, when the mutation completes,
  then the corresponding kind-30394 applicability list is republished to reflect the new membership —
  without waiting for the backstop.

- [ ] **No churn when membership is unchanged (diff-guard).** Given a mutation that does **not** change
  a list's membership (re-applying an already-listed tag; a tag already present), then **no new TL
  event is published for that list** — the republish is skipped when the computed membership equals
  the currently-published one.

- [ ] **Coalesced (debounced).** Given many membership-changing mutations in rapid succession, then
  they collapse into a **bounded** number of republishes (one recompute per debounce window), not one
  per mutation.

- [ ] **Best-effort / non-blocking.** Given the trigger endpoint is slow, fails, or is unreachable,
  then the tag-create / tagging UX is **not blocked or errored** — the trigger is fire-and-forget.

- [ ] **Slow backstop convergence.** Given a tagging published **outside the app** (or a missed
  trigger), then a **slow periodic backstop** eventually republishes so the list converges with all
  taggings — the published list is eventually consistent, not only app-driven. Cadence is modest and
  operator-tunable (hours, not minutes).

- [ ] **Additive — read path + other TLs unchanged.** The picker's live `/api/tags/applicability`
  read path is unchanged; the pubkey pinned-tag TL (30392), the note TL (30393), and the kind-30003
  export are untouched.

## Concepts touched
- `39998:<TA>:tag` — the vocabulary whose membership drives the lists.
- `39998:<TA>:nostr-user-tag` / `nostr-event-tag` — the taggings whose first-in-context appearance
  graduates a tag into a list.

## Out of scope
- **Instant** freshness for external (non-app) taggings — the backstop is *eventual*, not instant.
- A server-side strfry subscription/watch (considered; the slow backstop covers external mutations
  with far less infrastructure).
- The note / pinned-tag TLs — they already have their own on-pin refresh; not touched here.
- Any change to the picker's read path or to how membership is computed (HINT ∪ USAGE unchanged).

## Open questions (Architecture)
- Trigger endpoint auth + shape — mirror the existing `refresh-pinned-tag` (user-authed) pattern, or a
  dedicated lightweight notify. Debounce window (seconds).
- Recompute both lists vs. scope to the mutated context — the diff-guard makes recompute-both safe;
  Architect decides which is simpler.
- Backstop cadence + mechanism — the existing `refreshApplicabilityLists` task on the scheduled-tasks
  timer at an hours cadence (operator-tunable), seeded per the deployment convention.

## Linked artifacts
- ADR: `engineering-team/decisions/tag-applicability/0003-event-driven-applicability-republish.md`
- Test plan: (after Test Design)
- Review: (after Review)
