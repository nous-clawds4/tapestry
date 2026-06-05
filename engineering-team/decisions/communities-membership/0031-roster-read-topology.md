# ADR 0031: Where the live roster read + WoT scoring runs (deployment topology)

**Status:** **Accepted** (ratified 2026-06-05). Decision: **Option A with A1 (dual-publish)**, **house PoV for v1**, consume via `VITE_PROFILE_API_BASE` pointed at `staging.brainstorm.world` for the build/test pass. Open items #2 (CORS) and #1 (A1-vs-A2, if Vinney prefers the mirror) are coordination notes, not design blockers — the writer change is reversible and the consumer has a graceful-empty fallback. Unblocks the Story 45 live-wiring batch.
**Date:** 2026-06-05
**Story:** epic `communities-membership` (Block 5 / Block 3) · **Builds on:** ADR 0030 (membership model), PR #246 (tag-core carve, merged to `staging`), `docs/COMMUNITIES_TAG_CORE_INTEGRATION_HANDOFF.md`.

## Context
The tag read+score core (`/api/profile-tags/profiles-tagged`) is now on **`staging.brainstorm.world`**. Communities runs on **`communities.brainstorm.world`** off `feat/communities`. To render a live roster we must decide **which host runs the read+score**, because the engine has two host-local dependencies:

1. **Assertions in strfry.** `aggregateProfilesTagged` does a `strfryScan({kinds:[39999], '#z':[nostr-user-tag], '#e':[tagEventId]})` against **its own host's** strfry. The roster is only as complete as the assertions that host holds.
2. **Provisioned WoT in Meili.** It gates asserters on `wot_rank_<povSuffix> ≥ minRank`, read from **its own host's** Meili profile docs. With no provisioned PoV the gate **degrades to "all assertions count"** (no trust filter) — which defeats the whole model.

The two hosts each satisfy exactly one dependency today:

| | brainstorm.world | communities.brainstorm.world |
|---|---|---|
| Provisioned WoT / Meili (house PoV) | **✅ yes** (reference deployment) | ❌ no (light deployment) |
| Holds the community's tag assertions | ❌ not unless they're sent there | **✅ yes** (our writer publishes to `…/relay`) |

So neither host is turnkey; the decision is **which gap is cheaper to close.**

Relevant facts:
- Communities **already consumes brainstorm.world cross-origin** — `ui-communities/src/lib/profiles.js` calls `${VITE_PROFILE_API_BASE}/api/search/profiles/meili?…&wotPov=house` and `/api/profiles`, and reads `wot_rank_<suffix>` off the hits. The base URL is env-configured; there is a known **CORS caveat** (not formally verified) with a graceful empty-on-failure fallback.
- Our assertion writer (`events/publish.js`) sends to `DEFAULT_RELAYS = ['wss://communities.brainstorm.world/relay']` only.

## Options

### Option A — consume brainstorm.world's `profiles-tagged` cross-origin (recommended)
The Communities app calls `${VITE_PROFILE_API_BASE}/api/profile-tags/profiles-tagged?tagEventId=…&wotPov=house` — the **same host + same pattern** it already uses for meili/profiles. brainstorm.world owns the WoT/Meili (gap #2 already closed there).
**Closes gap #1 by making the assertions reach brainstorm.world's strfry**, one of:
- **A1 — dual-publish:** the writer publishes the assertion + tag-element to **both** the communities relay and brainstorm.world's relay (add it to the assertion publish set). One-line relay-set change on the publish path; nostr events are self-authenticating so this is clean.
- **A2 — mirror:** a relay router preset on brainstorm.world ingests the communities relay's kind-39999 tag events (the `dcosl`-style preset mentioned in `VERIFY_TAG_CORE.md`). Ops-side, no app change.

**Pros:** reuses provisioned WoT + the established cross-origin consumer pattern (gap #4 / app-as-consumer); no backend merge into `feat/communities`; brainstorm.world's house WoT is a sensible broad trust lens for v1; CDs stay on the communities relay untouched.
**Cons:** must formally settle the CORS posture for `communities.brainstorm.world → brainstorm.world` (the existing caveat applies to this endpoint too); the trust lens is brainstorm.world's house PoV (per-viewer PoV later needs that viewer provisioned on brainstorm.world); a small write-fanout (A1) or an ops mirror (A2).

### Option B — merge the core into `feat/communities` and read locally
Bring `profile-tags/` + `pov.js` (+ deps) into the communities backend so it scans the communities strfry directly (gap #1 already closed there).
**Pros:** self-contained, same-origin (no CORS), reads exactly the relay our writer targets.
**Cons (decisive):** the communities instance has **no provisioned WoT/Meili** — so the gate degrades to "all assertions count," i.e. **no trust filtering**, which is the product's whole point. Closing that means standing up Meili + GrapeRank computation on the communities droplet (heavy infra), plus reconciling `staging → feat/communities` (the carve was deliberately additive to `staging`; pulling it the other way drags the rest of staging in). High cost to reach the same place A reaches cheaply.

### Option C — hybrid (defer)
Read locally on communities (B) but call brainstorm.world only for the per-asserter `wot_rank`. Rejected for v1: re-implements `aggregateProfilesTagged`'s gating client-side (the duplication ADR 0030 §6 explicitly avoids) and needs N WoT lookups per roster. Revisit only if cross-origin proves unworkable.

## Recommendation
**Option A, with A1 (dual-publish) as the default mechanism** (A2 mirror is a fine ops-equivalent if Vinney prefers it). It closes the only open gap (assertions on brainstorm.world's strfry) with a one-line writer change, reuses the WoT/Meili that already exists, and extends the cross-origin consumer pattern Communities already runs on. Option B's infra cost buys nothing A doesn't already give us.

## What this commits the Story 45 batch to (if ratified)
- Add a roster client: `getRoster(circle, {wotPov:'house'})` → resolve each claimed `a` coord to its latest tag-element event id → `GET ${API_BASE}/api/profile-tags/profiles-tagged?tagEventId=…&wotPov=house` → apply the two-part gate (`deriveRoster` already encodes it) → `{members, applicants}`.
- Writer: include brainstorm.world's relay in the assertion + tag-element publish set (A1).
- Reuse `VITE_PROFILE_API_BASE`; the same CORS + graceful-empty posture as `profiles.js`.

## Open items for ratification
1. **A1 vs A2** — dual-publish (app) or relay mirror (ops)? Vinney's call on the relay side.
2. **CORS** — confirm `communities.brainstorm.world → brainstorm.world` is allowed for `/api/profile-tags/*` (David/ops). Same question the meili consumption already raised.
3. **Trust lens** — house PoV for v1 is assumed (matches the agreed UX); per-viewer PoV is a later enhancement that needs the viewer provisioned on brainstorm.world.
4. **Which host** — `staging.brainstorm.world` for the build/test pass, promoting to `brainstorm.world` for prod; confirm `VITE_PROFILE_API_BASE` points at staging during the 45 batch.

## Consequences
- **Positive:** no new infra; live roster is a thin consumer of an existing engine; the writer's born-hybrid `a` means no backfill at the `#a` cutover.
- **Risk:** cross-origin/CORS must be confirmed; the roster reflects brainstorm.world's WoT, not a communities-local graph (acceptable and arguably desirable for v1 — it's the broad nostr web of trust).
- **Neutral:** CDs and conversation events stay on the communities relay; only tag-elements + assertions fan out to brainstorm.world.
