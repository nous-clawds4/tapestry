# ADR 0004: ORE-02 stats — drop `ttl`, add `reporting` + `pagerank` (final field set)

**Status:** Accepted
**Date:** 2026-06-19
**Story:** `engineering-team/stories/open-ranking/1-ore-provider-and-stats.md` (amends) — book-close review. **Extends ADR 0003.**

## Context

Final pass over the `/stats/pubkey` field set. Verified that **`get-profile-scores`** (our existing source via `fetchProfileScores`) **already returns `reportingCount` and `personalizedPageRank`** on both the owner and POV paths — so **no data-source change**. In particular we do **not** switch to `get-user-data`: it returns the same scores plus heavier observer-relative traversals (frens / mutual / recommendations / shortest-path) and is the endpoint that 504s on large accounts. The whole change is a pure `mapScoresToOre` edit.

## Decisions

1. **Drop `ttl`** from **both** `/stats/pubkey` and `/search/pubkeys`. Optional in ORE; our scores are batch-recomputed on their own cadence, so a per-response cache hint is noise. (Removed from both endpoints for consistency; the `ORE_STATS_TTL`/`ORE_SEARCH_TTL` constants are deleted.)
2. **Add `reporting`** = `reportingCount` — the count of reports the pubkey *issued* (outbound), parallel to `follows`/`mutes`. **Named `reporting`, deliberately NOT `reports`:** ORE-02's `reports` is *inbound* ("# reports against this key"), so putting an outbound count under that name would **invert a safety signal** for any conformant client. `reporting` is a non-standard field (clients ignore unknowns).
3. **Add `pagerank`** = `personalizedPageRank`, **raw / unrounded**, under the active POV (owner-seeded for the global algorithm, pov-seeded for personalized). Named `pagerank` — the global value is owner-seeded, not personalized-to-caller. A non-standard ORE field included by operator decision **even when the `graperank` algorithm is requested** (i.e. modeled as a bundle field, not a separate algorithm — an eyes-open deviation from ORE's algorithm model).

Final `/stats/pubkey` body: `{ pubkey, rank, hops, followers, muters, reporters, follows, mutes, reporting, pagerank }`.

## Field directions (the subtlety)

| field(s) | direction | source | semantics |
|---|---|---|---|
| `followers` / `muters` / `reporters` | inbound | `verified*Count` | **verified** (ADR 0003) |
| `follows` / `mutes` / `reporting` | outbound | `followingCount` / `mutingCount` / `reportingCount` | exact totals |
| `rank` | — | `influence`×100 | GrapeRank |
| `hops` | — | `hops` | 999 = unreachable |
| `pagerank` | — | `personalizedPageRank` | raw |

ORE-02's own pairs are asymmetric — `follows`/`mutes` are outbound, but `reports`/`reporters` are **both inbound** — which is exactly why the outbound report count takes the non-ORE name `reporting`.

## Consequences
- ORE now exposes Brainstorm's full per-pubkey metric set; `reporting`/`pagerank` are non-standard (generic clients ignore them; documented for integrators via a future `learn_more`).
- No `ttl` anywhere.
- Confined to the ORE adapter (`mapScoresToOre`, `capabilities.js`, ttl consts removed from `shared.js`); the shared `get-profile-scores` query is untouched → `/api/get-profile-scores` + the UI are unaffected.
- **Firmware reinstall?** No.

## Out of scope
- pagerank-as-algorithm (a bundle field was chosen instead, by operator decision).
- ORE's *inbound* `reports` (the fuzzy `nip56_total*ReportCount`).
- A public `learn_more` docs page; personalized search (Story 3); ORE-A auth.
