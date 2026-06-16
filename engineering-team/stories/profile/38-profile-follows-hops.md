# Story 38: Follows-hops to this profile

**Status:** Draft
**Created:** 2026-06-17
**Type:** Feature

## Background
The profile page already surfaces a row of trust signals (Following, Verified Followers, Verified Reporters). A natural, missing signal is **how far the viewer is from this person in the follow graph** — the directed "degrees of separation" by follows. It answers "how connected am I (or this instance) to this account?" at a glance, and ∞ cleanly flags accounts the viewer's web of trust does not reach at all.

Follow relationships are **directional**, so the distance from the viewer to the profile is not the same as the distance from the profile to the viewer; this stat is always measured *from the viewer (or the Owner) to the profile being viewed*.

This is the next story in the **profile** epic (after #37, identity-details-popover). It is a single thin vertical slice — a new read endpoint plus one new stat in the counts row — that is not usefully splittable (the endpoint ships nothing user-facing on its own; the UI has no data without it).

## User-facing description
As someone viewing a profile, I want to see how many follow-hops separate me from this person (or, if I'm not logged in, how many hops separate the instance Owner from this person), so that I can gauge how connected I am to them — and clearly see when there is no follow path between us at all.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] **Placement & label.** Given any profile page, the new hops stat renders in the counts row immediately **after "Verified Followers"** and **before "Verified Reporters,"** with the label **HOPS**.
- [ ] **Source = Owner when logged out.** Given no user is logged in, when viewing profile B, the value is the number of directed follow-hops **from the instance Owner to B** (not the House PoV / `?pov=` party).
- [ ] **Source = viewer when logged in.** Given user A is logged in, when viewing profile B, the value is the number of directed follow-hops **from A to B**. (Directionality holds: for the same pair, A→B and B→A may differ.)
- [ ] **Finite path.** Given a directed follow path of length N (where 1 ≤ N ≤ 20) exists from the source to the target, the stat shows **N**, and its hover tooltip reads: *"&lt;target&gt; is N hop(s) away from &lt;source&gt; by follows."*
- [ ] **No path within range.** Given no directed follow path of length ≤ 20 exists from the source to the target, the stat shows **∞**, and its hover tooltip reads: *"There is no follow path from &lt;source&gt; to &lt;target&gt;."*
- [ ] **Self-view.** Given the source and target are the same pubkey (a logged-in user viewing their own profile, or a logged-out visitor viewing the Owner's own profile), the stat shows **0**, and its tooltip reads: *"&lt;name&gt; is 0 hops away from &lt;name&gt; by follows."*
- [ ] **Always computed live.** The value is computed by a live shortest-path lookup over the follow graph on every view. No precomputed/cached hop value is read, and the result is independent of (does not reconcile with) the existing "Degrees of separation" trust-card figure.
- [ ] **Async, non-blocking.** The rest of the profile page renders and is interactive without waiting for the hops value; the hops stat shows a loading state until its own lookup resolves.
- [ ] **Present but not clickable.** The hops stat renders as a non-interactive element — clicking/tapping it navigates nowhere. (The click-through destination page is a deliberate follow-up, out of scope here.)
- [ ] **Graceful failure.** If the hops lookup errors or times out, the page is unaffected and the stat shows a non-misleading unavailable state — it does **not** falsely render ∞ or a number.

**Copy notes:** in the tooltips, `<source>` and `<target>` are each rendered as the party's profile **display name** when available, falling back to a **shortened npub**. The hop word is singular for a distance of 1 ("1 hop") and plural otherwise ("3 hops").

## Concepts touched
Concept Graph API (`http://localhost:8877`) was not reachable at planning time — named in plain language; the Architect should resolve handles via `/api/concept-graph/summaries`.

- **NostrUser** — the pubkey/profile node; both the source and the target are NostrUsers.
- **FOLLOWS** — the directed relationship the distance is measured over (the only relationship used).
- **Owner** — the instance Owner pubkey (`BRAINSTORM_OWNER_PUBKEY`), used as the source when no one is logged in. Distinct from the House PoV.

## Requester-directed constraints (settled decisions — not PO design)
These were decided by the requester this session and the Architect should honor them rather than re-open them:

- **New backend endpoint**, shaped like `GET /api/get-follows-hops?source=&target=`, returning the live hop count (or a clear no-path result).
- **Native Neo4j `shortestPath` over `FOLLOWS`**, reusing the Cypher pattern already in `src/algos/customers/personalizedGrapeRank/initializeScorecards.js` (~line 66), run through the pooled Bolt driver helper (`src/lib/neo4j-driver.js` `runCypher`) — **not** the per-request `cypher-shell` fork, and **not** Neo4j GDS.
- **Hop cap = 20** (`[:FOLLOWS*..20]`). Chosen deliberately: real pairs are genuinely 9–10+ hops apart and should not be excluded.
- **No precomputed values, ever.** Do not read the precomputed `NostrUser.hops` property anywhere in this feature.
- **Frontend source selection:** logged in → logged-in user's pubkey; logged out → `useConfig().ownerPubkey`. Target = the profile pubkey being viewed.

## Out of scope
- The click-through destination page (a "follows-hops" list/explorer) and activating the link — explicitly deferred to a follow-up story.
- Neo4j GDS, in-memory graph projections.
- Any precomputed or persistent caching layer for hop values. (A short-lived request cache may be considered later but is not required here.)
- Reconciling or aligning with the existing "Degrees of separation" trust-card.

## Resolved decisions
- **Stat label:** **HOPS**.
- **Self-view (source == target):** show **0** (see the Self-view acceptance criterion).
- **Tooltip names:** display name when available, else a shortened npub.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
