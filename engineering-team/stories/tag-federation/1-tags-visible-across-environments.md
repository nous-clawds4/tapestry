# Story 1: Tags visible across all *.brainstorm.world environments (Half 1 of the dual-z model)

**Epic:** tag-federation
**Status:** Approved
**Created:** 2026-06-17
**Type:** Feature

## Background

Tag features are deployed everywhere, but tag *data* is instance-local: tags.brainstorm.world has the real tags (35+), staging/main show the tag UI with nothing in it (verified — `available-tags` → `count:0` on staging). Tag/tagging events already carry a shared **canonical z** (`39998:82b75e47…:<slug>`, ADR-0015), so the only thing missing is **federating the events + reading the shared set**.

**This is HALF 1 of the dual-z model** (see `engineering-team/epics/tag-federation.md`): events already carry the canonical z, which is exactly the half that delivers cross-instance visibility. This story federates + reads that canonical z. It is **not** an alternative to the dual-z model — it's its first half. HALF 2 (the local z + the `b`-tag map, Goal B) is purely additive on top and is documented in `docs/B_TAG_HALF_2_HANDOFF.md`. This story needs **none** of the b-tag / dual-z / firmware work.

## User-facing description

As a **user on any `*.brainstorm.world` instance**, I want to see and use the tags and taggings created across the network — not just the ones authored on my instance — so the tag feature behaves consistently everywhere instead of looking empty on every instance but tags.brainstorm.world.

## Acceptance criteria

- [ ] **AC-1 (read-union over local + shared relay):** Given the tag read paths that drive the visible tag surfaces, when they fetch tag events, then they read from **both** the local strfry **and** the shared dcosl relay and merge the results (replaceable-event dedupe applied), rather than local strfry alone.
- [ ] **AC-2 (tags from the shared relay surface):** Given a tag/tagging event exists on the shared relay but **not** in the local strfry, when a user loads the `/tags` index or a profile's tag chips, then that tag/tagging appears.
- [ ] **AC-3 (local-authored still works):** Given tags authored on the local instance, when a user loads the tag surfaces, then they still appear (no regression to existing local reads).
- [ ] **AC-4 (graceful degradation):** Given the shared relay is unreachable or returns an error, when a user loads the tag surfaces, then locally-authored tags still display and the page does not error (the union degrades to local-only).
- [ ] **AC-5 (dedupe / no double-count):** Given the same replaceable event is present in both local strfry and the shared relay, when results are merged, then it is counted once (latest `created_at` wins), so aggregations/counts are not inflated.
- [ ] **AC-6 (POV degradation preserved):** Given asserters whose events come from the shared relay and who are outside the viewing instance's WoT, when tag aggregations compute, then they degrade per the existing POV rules (visibility preserved; trust-weighting POV-scoped) — the read-union does not change POV semantics.
- [ ] **AC-7 (search gate untouched):** The search-API result-type gate is unchanged — staging's `/api/search/*` still excludes tags by default; this story only affects the `/api/profile-tags/*` read surfaces.

## Concepts touched

- `tag` / `nostr-user-tag` / `tag-pinning` (canonical z `39998:82b75e47…:<slug>`, ADR-0015) — read context only. **No wire-shape change, no firmware change, no b-tags, no dual-z** (all Half 2).

## Out of scope (Half 2 and adjacent — see handoff)

- The **local z** (dual-z writer, W11), the **b-tag primitive** (emitter/derivation/stub-retire), and per-concept `headerATag` seeds — all `docs/B_TAG_HALF_2_HANDOFF.md`.
- Fixing the empty `…<localTA>…:nostr-user-tag` concept-graph list view (Half 2 — needs the local z).
- The **router federation config** (getting tags.brainstorm.world's content onto dcosl) is an **ops prerequisite**, not code in this story — see Open question 2. The code deliverable here is the read-union; the federation is a deploy/router step.
- Client-side console-noise / `publishToRelays` cleanup (separate Tier-3 item).

## Open questions

1. **For the Architect — read-union seam.** The tag read paths share a local-scan helper (`strfryScan` in `src/api/profile-tags/index.js`). Cleanest is a single federated-scan helper (local `strfry scan` + a dcosl fetch via the existing `/api/relay/external` / `fetchEvents` SimplePool path) that merges + replaceable-dedupes, swapped in at the tag read call sites — rather than editing each read path. Confirm the seam and which read paths are in scope (lean: the visibility surfaces — `available-tags`, the `/tags` index/aggregation, `tags-for-profile`; the search-tag-match path is gated off on staging so it's lower priority).
2. **For the Architect/ops — content prerequisite.** dcosl currently has the concept *definitions* (full) but only a sliver of tag *content* (verified: 2 + 12 events, David's exploration). For the read-union to surface tags.brainstorm.world's real tags, that content must reach dcosl via **router federation (write-local + route)** — an ops/router-config step on the droplets, outside this code story. The code is testable against whatever is on dcosl + local; the full user-facing outcome depends on the federation step.
3. **For the Architect — read cost / caching.** A per-request dcosl round-trip adds latency to tag reads. Confirm whether a short cache / local-first-then-union shape is warranted in v1, or accept the round-trip and revisit on measurement.

## Linked artifacts

- Epic: `engineering-team/epics/tag-federation.md`. Half-2 handoff: `docs/B_TAG_HALF_2_HANDOFF.md`. Context: `docs/B_TAG_SHAPE_STATE_AND_PLAN.md`.
- ADR: `engineering-team/decisions/tag-federation/0001-tag-read-union-local-and-dcosl.md`
- Test plan: `engineering-team/stories/tag-federation/1-tags-visible-across-environments.test-plan.md`
- Review: (after Review)
