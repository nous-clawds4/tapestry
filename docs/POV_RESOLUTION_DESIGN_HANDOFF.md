# Point of View (PoV) Resolution — Design Handoff

**Status:** 🔴 OPEN
**Created:** 2026-06-07
**Provenance:** Scoped via `/discuss` (Product Expert lens) during the verified-reporters book close, after a staging smoke found the *same* trust metric showing three different values across sources. This is the **Capture** step of the Protocol-Spec Workflow (`engineering-team/workflows/protocol-spec-workflow.md`): settled decisions + open questions, captured so nothing lives only in the transcript. Ratify settled pieces into `BIBLE.md` + ADRs in docs-mode; flip this to ✅ SUPERSEDED once they land.

---

## 1. Why this exists — the problem

Tapestry surfaces trust metrics (counts, scores, lists) from several uncoordinated sources, so the *same* metric can read differently depending on which source — and which PoV "suffix" — a given surface happens to hit.

**Concrete failure (staging, 2026-06-07):** Jack's profile badge showed **"26,711 Verified Followers"** while his `/followers` page showed **568**. Diagnosis:
- The badge reads Meili under `?pov=a1420e44`, where `wot_verifiedFollowerCount_a1420e44` is **absent**, so the shipped code `verifiedFollowerCount ?? followers` **silently fell back to raw total followers (26,711) and labeled it "Verified Followers."**
- The page reads **live Neo4j (Owner PoV)**: `follower.influence > 0.05` → 568.
- Compounding it: the Owner scoring batch (`updateAllScoresForOwner` → `processOwnerFollowsMutesReports`) had **failed mid-run** (interrupted by a redeploy), so even the live Owner `influence` data was partial — 568 is itself not trustworthy right now.

Fixing one instance doesn't generalize. We need a standard for *which* source answers *which* question, for *whom*, and what happens when the preferred answer isn't available (or isn't fresh).

## 2. The standard — three Points of View

Every trust metric is computed relative to a Point of View. There are exactly **three**:

| PoV | Whose web of trust | Source of truth | Availability |
|---|---|---|---|
| **Owner** | the local Brainstorm instance's owner | **Neo4j** — `NostrUser` node properties (`influence`, `verified*Count`, `hops`) + live traversals | Always locally available (the instance computes it). |
| **House** | the deployment's "house" WoT | **kind 30382 Trusted Assertions** → Meili `wot_*_<houseSuffix>` | Only if House assertions are published/imported. |
| **Personalized** | the end-user's own WoT | **kind 30382** per-user → Meili `wot_*_<userSuffix>` (eventually, possibly a local per-customer calc) | Only if that user's assertions exist. |

**Naming correction this forces:** what the grapevine tables and the verified-reporters v1 actually use is the **Owner** PoV (Neo4j), *not* "House." Earlier docs/copy that said "House (default)" for Neo4j-sourced data are mislabeled and should say **Owner**.

## 3. Selection + persistence model (target)

- One **selected PoV** per end-user at a time (Owner / House / Personalized).
- **Stored** in session and/or backend, **sticky across pages** — change it on one page, it applies everywhere.
- A **3-way PoV selector** UI. Today the search page has a 2-way House↔Personalized toggle → add Owner. Eventually put the same selector on the profile page; a change there is remembered when navigating back to search.

## 4. Fallback model (target)

- A surface always **attempts the selected PoV**.
- If the datum for that PoV is **unavailable**, fall back along a **feature-specific chain** (the right fallback differs for the search bar vs a profile badge vs a table vs future surfaces).
- **Data health / freshness is part of "availability"** (new dimension, surfaced 2026-06-07): a PoV's data can be present-but-stale or mid-recompute (e.g., the interrupted Owner batch). The model must treat stale/partial as a *state* — ideally surfaced ("computing… / as of <time>") rather than silently showing degraded numbers. Naïve "absent → fall back" is insufficient.

## 5. Source / endpoint inventory (first-pass — NOT final)

- **Keep as-is:** `/api/get-user-counts` — Following from strfry (kind-3 `p`-tags). Non-PoV, freshest, cheap; never moves.
- **Keep, later parameterize by PoV:** the grapevine table endpoints (`get-grapevine-follows` / `…-followers` / `…-reporters`) — Owner/live today.
- **Keep as the House/Personalized read:** `/api/search/profiles/meili/document/:pubkey` — the kind-30382 store; the resolver reads it for House/Personalized.
- **Likely new:** a **PoV-resolver** seam — a shared server module and/or a unified endpoint taking `(pubkey, datum, selectedPoV)` → applies source + fallback chain; plus a small **preference** store/endpoint for the sticky selection.
- The "how many new endpoints" question turns on resolver shape (endpoint vs module) — open below.

## 6. Per-feature application (current → target)

| Surface | Datum | Source today | Target |
|---|---|---|---|
| Profile | Following count | strfry (`get-user-counts`) | unchanged (non-PoV) |
| Profile | Verified Followers / Reporters counts | Meili `wot_*` (broken) | **Owner (Neo4j) now**; PoV-selectable later |
| `/follows`, `/followers`, `/reporters` tables | rows + count | Neo4j Owner (live) | Owner now; PoV-selectable later |
| Search page | ranking / scores | Meili (House↔Personalized toggle) | add **Owner** to the toggle; use the shared selection |

## 7. Settled decisions (so far)

1. **Three PoVs:** Owner / House / Personalized, with the §2 source map.
2. **Owner = Neo4j** (node props + live); **House / Personalized = kind 30382 → Meili**.
3. **Following stays on strfry** (non-PoV, freshest, immune to the GrapeRank batch — it stayed correct while Owner scoring died).
4. **Near-term (verified-reporters follow-on, becomes its own story):** the profile **Verified Followers + Verified Reporters badges → Owner PoV** = `NostrUser.verified{Follower,Reporter}Count ?? live count-only cypher`, same `VERIFIED_*_INFLUENCE_CUTOFF` (0.05) as the tables; **drop the broken `?? followers` raw fallback**; **relabel the `/reporters` PoV line "House" → "Owner";** badges and tables **share the source**.
5. **Data health / freshness** is a first-class dimension of availability — not just present/absent.

## 8. Open questions

1. **Default selected PoV** for a new/anonymous user — Owner (always available) or House (richer, if present)?
2. **Resolver shape:** one unified PoV-aware endpoint vs a shared server module each endpoint calls. (Determines the new-endpoint count.)
3. **Freshness signaling:** do surfaces show a freshness/health indicator, and how is "stale/partial" detected — batch run-state, timestamps on node props, a computed-at field?
4. **Per-feature fallback chains:** enumerate them (search bar, profile badges, tables, future). What does each fall back to, in what order across the three PoVs + the raw/strfry primitives?
5. **Personalized source:** kind-30382-only, or also a local per-customer calc (the `NostrUserWotMetricsCard` machinery)?
6. **count = list-length guarantee** per PoV: exact (single live source) vs steady-state (precomputed badge + live table). Ties to ADR 0002 / 0003.

## 9. Related findings (ops / data)

- **Deploy interrupts scoring batch (ops bug):** `updateAllScoresForOwner` failed mid-`processOwnerFollowsMutesReports` (~2026-06-07), apparently interrupted by a PR-merge/redeploy, leaving Owner `influence` partial. Scoring jobs should be **resumable or drained on deploy** (task-queue-scheduler territory). → worth a standalone intake item. Until re-run, staging Owner numbers are unreliable; **a full Owner recompute is hours-long at staging's prod scale (~32M FOLLOWS).**
- **Cutoff / "verified == raw followers" anomaly:** `VERIFIED_{FOLLOWERS,MUTERS,REPORTERS}_INFLUENCE_CUTOFF` all default `0.05` in `config/graperank.conf.template`, yet some Meili `wot_verifiedFollowerCount_<suffix>` values exactly equal `wot_followers_<suffix>` (e.g. 34376, 23024) — suggesting some path computed "verified" without an influence filter. Confirm against a healthy computation; relates to the existing cutoff-inconsistency intake item.

## 10. Ratification path

Per the Protocol-Spec Workflow, ratify settled pieces into the spec via the eng-team flow in **docs-mode**: `/plan-feature` (thin story) → `/design-architecture` (ADR) → *skip Test Design* → `/implement-feature` (write the BIBLE section) → `/review-changes` (accuracy audit) → `cycle-staging`.

- **Spec piece to ratify first:** the three-PoV definitions + source map + selection/fallback model (a new BIBLE section + an ADR like *"PoV resolution standard"*).
- **Code piece (separate, normal eng-team flow):** the near-term §7.4 Owner-badge change — that's code, not spec, so it goes through `/plan-feature` → ADR → tests → impl → review as its own story.

Flip this doc to ✅ SUPERSEDED once the standard lands in `BIBLE.md`.
