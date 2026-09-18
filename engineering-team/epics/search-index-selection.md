# Epic: search-index-selection

**Created:** 2026-09-18
**Status:** Planned (no story started)
**Book:** `engineering-team/audits/search-index-selection/book.md` (opened 2026-09-18)
**Design target:** [`docs/SEARCH_INDEX_DLIST_SELECTION.md`](../../docs/SEARCH_INDEX_DLIST_SELECTION.md)
(rev 3). Read it before any story here; it carries the settled consumer contract, the
rejected alternatives with their reasons, and the deferred parts.

## Goal
Let a curator say **which Decentralized Lists are worth indexing for search**, in protocol,
and publish that set as a Trusted List a search backend subscribes to. The consumer
integration is written once and never changes: every later loosening of who influences the
set is a change to the pipeline behind the list, never to the thing reading it.

Day one the set is one list (`39998:b83a28b7…:github-accounts`) chosen by one curator, and
the certainty guard is a single `author == observer` curation constraint. Not an allowlist,
not a config file, and explicitly not a point-of-view threshold (which cannot give
certainty — see the design doc's rejected alternatives).

## Stories
`stories/search-index-selection/`:
1. `1-tag-a-list-header.md` — **Done** (review PASS, 2 rounds). A tagging affordance on a list header, and the
   read path that makes a tagged header resolve for display. Prerequisite for everything
   else: today no UI surface can tag a kind-39998 at all.
2. `2-only-me-curation.md` — **Done** (review PASS; ADR 0001 Accepted). An `author` curation constraint on the pin, value `== observer`, surfaced as
   an "Only me" trust scope. The certainty guard. Slots into the existing
   `isAsserterTrusted` seam; `alsoTrust` is precedent for an identity predicate there.
3. `3-per-pin-membership-method.md` — **Approved** (Gate A ruled 2026-09-18; ADR expected).
   A `membershipMethod` field on the pin's `curationMethod` blob instead of the instance-wide
   dial (OPEN 307); absent means the dial. The published kind-30392 records the fold that ran.
4. `4-confirm-step-on-first-pin.md` — **Done** (review PASS, 3 rounds) — a **confirm step on first pin**, so the default curation that quietly publishes
   a Trusted List becomes visible and editable before it does. Shapes the same switcher
   surface as story 5; lands before or with it.
5. `5-explicit-pin-variant-key.md` — **Draft**. An explicit pin **variant key** generalising
   community context so one tag can carry several curations without the pin having to be about
   a community. Needs a deliberate UX round: a context is a *place*, a curation variant is a
   *saved recipe*, and the Pinned tab already carries Profiles/Notes/Items leaves on a
   layout that predates all of it. Carries the binding uniqueness invariant (no d-tag stomps).

Deferred, tracked in the design doc rather than here: the `author ∈ <list>` value (rung 2)
with its filter-list picker; self-attested curator sets with GrapeRank (rung 3); extrinsic
per-list config joined by a `b` tag; field types as a DList with url-template affordances.

## Decisions
`decisions/search-index-selection/0001-author-constraint.md` — Accepted (story 2). Both halves
of the old story 3 are wire-visible, so each expects its own ADR: **0002** for story 3 (the
method rides the published `curationMethod` JSON, and the published 30392 discloses the fold
that ran) and **0003** for story 5 (the variant rides the `d` tag, the search backend's
permanent subscription key).

## Reviews
None yet.
