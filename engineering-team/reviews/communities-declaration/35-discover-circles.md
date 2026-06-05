# Review: Story 35 — Discover circles (read-only)

**Reviewer:** Claude · **Date:** 2026-06-05 · **Epic:** `communities-declaration` · **Type:** Feature (Architecture folded into ADR 0029 — no new ADR).

## Quality gates
- [x] `node test/test.js` — **discover-circles 6/6**; Overall PASS, no regression.
- [x] `npm run lint` clean · `npm run build` clean.

## Spec adherence (vs ACs)
- [x] AC-1 renders with no account — Discover has no `!signedIn` early-return (T5).
- [x] AC-2 Declarations appear — `getDiscoverableCommunitiesFromRelay` unions `fetchAllCommunityDeclarations` (T1/T2).
- [x] AC-3 search filters by name/description/topic — existing Discover filter (covered by the discover-swaps suite).
- [x] AC-4 designed empty state (T4).
- [x] AC-5 loading/error/ready states (T6); cards render (T3).

## Note on delivery
This story required **no new implementation code** — the discovery union and the Discover surface (cards, states, filter, no-account rendering) were delivered by **Story 33's union work** plus the pre-existing Discover page. Story 35 ratifies CD discoverability and read-only-first-visit with its own suite. That is a legitimate outcome: the capability is proven by passing acceptance tests, and the architecture (ADR 0029) intentionally built the union once for both founding-landing and discovery.

## Findings
**Blocking:** none.
**Non-blocking:**
1. The trust signal on cards (point-of-view "N people you trust") is **Block 3** — discovery cards currently show the bespoke/house counts only.
2. Slug-collision dedupe between a CD and a bespoke record favors the CD (consistent with the strangler intent).

## Verdict
**PASS.** 6/6, no regression. CD circles are discoverable with no account; Block 1's discovery surface is complete.
