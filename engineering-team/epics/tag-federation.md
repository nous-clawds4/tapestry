# Epic: tag-federation

**Created:** 2026-06-17
**Status:** Active

## Goal (the only one that matters)

**Tags and taggings visible and working on every `*.brainstorm.world` environment** — not just on the instance where they were authored. Today tags.brainstorm.world has the real tags; staging/main show the tag UI with nothing in it. This epic closes that gap.

Everything else in the tag/Communities federation effort (the b-tag primitive, concept-graph lineage) exists **only in service of this goal**. If a piece doesn't move tags toward "visible and working everywhere," it's not on this epic's critical path.

## The dual-z model (the agreed destination — David's model)

Each tag/tagging event carries **two `z` tags**:
- **canonical z** → `39998:82b75e47…:<slug>` — the network-wide identity; makes the tag visible on every instance. **Events already carry this today (single-z, ADR-0015).**
- **local z** → `39998:<thisInstanceTA>:<slug>` — membership in *this* instance's own concept; populates the local concept-graph list and roots the tag "here." **This is the new one.**

Each concept **header** carries a **`b` tag** (pointer type, ADR community-reference/0030) on the *local* header → the *canonical* header — the map that lets you trace each instance's local concept back to the one canonical definition.

This model is ratified in principle: dual-z = the multi-z carve-out (ADR community-reference/0029 §6 / worksheet W11); local→canonical `b` = ADR community-reference/0030 pointer-seed.

## The two halves (sequencing)

- **HALF 1 — visibility (this epic's Story 1, Goal A).** Federate + read the **canonical z** that events already carry. Ships "tags visible everywhere" with **no wire-shape change, no b-tags, no firmware change**. It is the *first half of the dual-z model* — the canonical-z half — not an alternative to it. Mechanism (team-decided): **write-local + router-federate** to the shared dcosl relay (NOT writer-direct-to-dcosl), and **read-union (local strfry + dcosl)** rather than sync-and-hoard.
- **HALF 2 — concept-graph correctness (later stories, Goal B).** Add the **local z** (dual-z writer, W11) + the **b-tag primitive** (emitter/derivation/stub-retire, ADRs 0027/0029/0030) + per-concept `headerATag` seeds. Purely **additive** on top of Half 1 — the canonical-z federation + read-union keep working; local-z events land in local strfry automatically. **No rework of Half 1.** Full detail: `docs/B_TAG_HALF_2_HANDOFF.md`.

## Stories

1. `stories/tag-federation/1-tags-visible-across-environments.md` — Half 1 (Goal A): canonical-z federation + read-union.
2. _(planned, Half 2)_ shared **b-tag primitive** — firmware pointer-seed + b-tag→edge derivation + stub-retire (implements ADRs 0027/0029/0030; design exists, code does not — verified unbuilt on every branch). Draft scope captured in `docs/B_TAG_HALF_2_HANDOFF.md`.
3. _(planned, Half 2)_ **dual-z writer** (stamp the local z, W11) + per-concept `communityReference`/`headerATag` seeds for `tag`/`nostr-user-tag`/`tag-pinning` (depends on Story 2; stub-trap guard: never add manifest entries before the b-tag primitive lands).

## Key facts / guardrails

- The canonical concept-authority coordinate is `82b75e47…` (the ADR-0015 legacy literal; the dev-box TA). Its full concept bundles (header + aux) for `tag`/`nostr-user-tag`/`tag-pinning` are **already published to dcosl** (verified 2026-06-17: 7–8 events each, 23 total).
- **Do NOT add `communityReference` entries to `firmware/active/manifest.json` before the b-tag primitive is built** — current install code would materialize the legacy `REFERENCES{source:'firmware-community'}` stub (the "stub trap"), not the b-tag. (ADR 0030.)
- Search-API result-type gate is orthogonal — staging keeps tags OFF in *search* by default; this epic is about the tag UI/data surfaces (`/api/profile-tags/*`), which are not gated.
- POV-first: cross-instance reads weight asserters by the *viewing* instance's WoT; asserters outside it degrade gracefully (visibility preserved, trust-weighting POV-scoped).
