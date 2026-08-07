# ADR 0005: Trusted dictionary — Neo4j-gated S3b read + owner-minted snapshot elements

**Status:** Accepted
**Date:** 2026-08-07
**Story:** `engineering-team/stories/shared-concepts-adoption/5-trusted-dictionary.md`

## Context

F3 of the shared-concepts-adoption book: a live, per-POV view of the concept headers whose
cross-author z-usage comes from **≥ N distinct trusted authors**, plus an owner-gated action that
publishes the current view as a dated, TA-signed, self-describing snapshot. Scoring semantics are
owner-ratified (story Background): the trust gate is the verified-* family's influence cutoff;
the threshold counts distinct qualifying authors (binary gate, plain count); membership is
computed at read time; nothing publishes without the owner's act. Hard boundary: usage-derived
only — never the W1 inherit-consensus signal (community-reference ADR 0029 keeps z-usage and
pointers at zero consensus weight).

What exists to build on:

- **The adoption-loop read seam** (`src/api/adoption/index.js`, ADRs 0002/0003): streaming strfry
  scans with slim projections (`strfryScanStream`, the #500 corpus-scale idiom), classification
  of my headers at the handler seam via `dispositionOf` (`src/lib/bValueForms.js`), pure
  zero-require arithmetic cores in `src/lib/adoptionQueue.js`. The dictionary's raw inputs are
  the same corpus: all kind-39998 headers (mine + foreign) and the `#z` carriers over their
  coordinates, with the cross-author rule (`carrier.pubkey !== header.author`) already the
  established usage semantics.
- **The trust scores** live in Neo4j: house POV = `NostrUser.influence`; personalized POV =
  `NostrUserWotMetricsCard {observer_pubkey}` rows keyed by the observer's **main pubkey** (the
  two-branch Cypher pattern in `src/api/search/profiles/keyword/handler-works-but-slow.js:160-161`
  and `src/api/export/users/queries/userdata.js:388`). Shared runner: `runCypher` from
  `src/lib/neo4j-driver`. Note W13: Meili's `wot_rank_<suffix>` columns are a *different* POV
  identity (delegated-key suffix) and a *different* metric (rank, not influence) — the Meili-side
  resolver (`src/api/_shared/povStatus.js`) is NOT the right gate here.
- **The cutoff has two existing sources** (known, parked in the verified-muters book's deferred
  scope): the batch scripts hardcode `influence > 0.01`
  (`src/algos/customers/calculateVerifiedFollowerCounts.sh:41` and siblings); the live fallback
  reads `getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', 0.05)`
  (`src/api/export/users/queries/userdata.js:359`). The precomputed counts users actually see
  come from the batch side (0.01).
- **The POV wire contract** client-side: `usePov()` → `resolvePovReadParams` →
  `{wotPov: 'user'|'house', userPubkey?}` (`ui/src/context/PovContext.jsx`,
  `ui/src/utils/povReadParams.js`).
- **The owner-minted dated-record precedent** (F1's decline ledger,
  `src/api/normalize/index.js:5295` `handleAdoptionDisposition`): gate
  `isOwner(req) || req.localTrusted`; lazy runtime-concept bootstrap
  (`ensureAdoptionDispositionConcept`, concept name `'adoption disposition'` — no firmware
  entry); mint via `invokeNormalizeHandler(handleCreateElement, {concept, name, random: true,
  json})` — TA-signed kind-39999 element, z-stamped under the runtime concept, wired into the
  graph. The F4 create-element seam applies automatically (an unwired runtime concept stamps
  personal-z only — correct here).
- **UI placement**: the Shared Concepts route family (`ui/src/App.jsx:372-385`) and its nav
  (`ui/src/components/Layout.jsx`); the fetch+render idiom of
  `ui/src/pages/shared-concepts/AdoptionQueue.jsx`.

Constraints: JS-without-build; POV-first (membership is a POV's view, computed at read — no
per-POV materialization); decentralized-first (no write-time gating of anyone's carriers; the
gate is read-time scoring); the graph is subordinate to nothing here (read-only against Neo4j
scores; the snapshot rides the normal element path). Local-dev caveat: the local Neo4j may hold
a near-empty `NostrUser` population (OPEN.md #6), so live verification of the trust gate belongs
to fixtures/staging, not assumptions about local data.

## Options considered

### Option A — sibling read endpoint with a Neo4j qualifying-set seam + normalize-side snapshot mint (chosen)

New `GET /api/trusted-dictionary?wotPov=&userPubkey=` in `src/api/adoption/index.js` (the module
that owns this corpus's scan idioms): run the same slim scans (all 39998 headers; `#z` over all
coords), collect the distinct cross-author carrier pubkeys, resolve the **qualifying set** with
one bounded Neo4j query (house: `WHERE u.pubkey IN $authors AND u.influence > $cutoff`;
personalized: the metrics-card branch; observer with zero cards → house fallback, disclosed),
then hand everything to a new pure zero-require core `src/lib/trustedDictionary.js` →
`computeDictionary(...)`. The response carries the entries (with per-entry qualifying/total
counts, `isMine`, `sentinelDeferred`), a recent-snapshots strip, and an honest `pov` disclosure
block (branch that ran, fellBackToHouse, cutoff, threshold, computedAt — the povStatus spirit,
adapted to the Neo4j store). Snapshot publish = `POST /api/normalize/trusted-dictionary-snapshot`
mirroring `handleAdoptionDisposition` byte-for-byte in shape: same gate, lazy
`ensure…Concept('trusted dictionary snapshot')`, recompute server-side via the exported assembly
(never trust a client-posted member list), drop `sentinelDeferred` entries, mint one dated
element whose json section embeds parameters + members + `derivation: 'z-usage'`.

*Pros:* every piece rides a shipped idiom (scans, seam classification, pure core, owner mint);
the trust gate reads the store the verified-* semantics actually live in; F1/F2's byte-compatible
`/api/adoption-queue` contract is untouched; the POST recomputing server-side makes the snapshot
trustworthy by construction; pure core keeps the arithmetic unit-testable without a stack.
*Cons:* ~40 lines of scan assembly duplicated from `handleAdoptionQueue` (accepted — isolating
the new read protects the shipped endpoint; DRY refactor deferred); one new Neo4j read dependency
in the adoption module.

### Option B — extend `/api/adoption-queue` + a fourth view on the Adoption Queue page

Add a `dictionary` array to the existing endpoint and a fourth view button.
*Pros:* one fetch; no new route.
*Cons:* rejected on the story's own terms — the dictionary is a public read artifact "distinct
from the adoption worklist"; it would bolt POV params onto an endpoint whose five arrays are all
POV-independent observables (muddy contract: `wotPov` would modulate exactly one array); and the
public dictionary read would drag the owner's worklist payload along on every fetch.

### Option C — gate trust via Meili `wot_rank_<suffix>` columns instead of Neo4j

Resolve the qualifying set from the search index's per-POV columns.
*Pros:* no Neo4j read at request time; reuses `resolvePovWithStatus` wholesale.
*Cons:* rejected — wrong metric and wrong identity. The ratified gate is the verified-* family's
**influence** cutoff, which lives in Neo4j; `wot_rank` is a different signal. Meili's POV columns
are keyed by delegated-key suffix (open worksheet W13 — cross-store POV identity), and carrier
authors absent from the profiles index would silently read as untrusted even when Neo4j scores
them.

## Decision

We chose **Option A**. The dictionary is a per-POV read computed at request time from the same
corpus the adoption loop already scans, with the trust gate resolved as a bounded Neo4j
qualifying-set query at the handler seam (the ADR 0003 "classify at the seam, keep the core
pure" pattern), and the snapshot is an owner-gated, server-recomputed, TA-signed dated element
minted through F1's exact runtime-concept machinery.

Fixed points:

1. **Qualifying author** (AC-1): `influence > cutoff` from the active POV's branch ∧ `pubkey !==
   header.author` (per header) ∧ `pubkey !== taPubkey`. Cutoff =
   `getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', 0.01)` — the batch-side default is
   deliberately chosen over userdata.js's live-fallback default (0.05) because the batch scripts
   produce the verified counts users see; the pre-existing two-default divergence is named here
   and stays parked with the verified-muters deferred-scope item (this ADR does not consolidate
   it; deployments that set the var explicitly are already consistent).
2. **Threshold** (AC-1): `getConfigFromFile('TRUSTED_DICTIONARY_MIN_USERS', 2)`, applied to the
   per-header count of distinct qualifying authors.
3. **POV resolution** (AC-3): `wotPov === 'user'` with a valid `userPubkey` → the metrics-card
   branch for that observer; observer has zero cards → house branch with
   `fellBackToHouse: true`; anything else → house. The response's `pov` block always states what
   ran. No Meili suffix is involved (W13 explicitly not solved here — flagged).
4. **Sentinel handling** (AC-6): my headers classified at the seam (`dispositionOf`, as in
   handleAdoptionQueue); `sentinelDeferred: true` entries **stay in the view** (marked, so the
   owner can see what a snapshot would omit) and are **dropped at snapshot mint**. Declined
   status is not read at all — F1's ledger governs adoption, not usage observability.
5. **Consensus firewall** (AC-7): the read path touches no `b` machinery beyond the seam's
   existing bState classification of my own headers; the snapshot json carries
   `derivation: 'z-usage'`; no `b` tag is created anywhere in this story.
6. **Snapshot integrity** (AC-5): the POST ignores any client-posted membership and recomputes
   from the requested POV server-side; parameters (pov branch + observer, cutoff, threshold,
   computedAt) ride inside the element's json section so every snapshot is self-describing.

## Consequences

- Enables the dictionary as a public read surface + the owner's dated offering, completing 6/6 of
  the book's frame (pending review).
- A new runtime-created concept (`trusted dictionary snapshot`) appears on first publish —
  **no firmware reinstall** (the adoption-disposition precedent).
- Two config knobs become load-bearing for this feature: `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`
  (now read by a second live consumer, default aligned to the batch side) and new
  `TRUSTED_DICTIONARY_MIN_USERS` (default 2).
- The adoption module gains a Neo4j read (`runCypher`) — its first; bounded by the distinct
  cross-author carrier population.
- Testing implication (for the Tester): the pure core covers the arithmetic stack-free; live
  rows exercising the trust gate need fixture `NostrUser` rows with controlled `influence`
  (local graph data is not representative — OPEN.md #6); the snapshot H-row can assert the
  minted element's json parameters and the sentinel exclusion.
- Deferred debt, named: the cutoff two-default divergence (parked, verified-muters deferred
  scope); DRY-ing the duplicated scan assembly; cross-instance snapshot consumption; any
  ordering/weighting refinements (out of the ratified v1 semantics).

## Implementation notes

- **`src/lib/trustedDictionary.js`** (new, pure, zero-require — the adoptionQueue.js style):
  `computeDictionary({ headers, zCarriers, qualifying, threshold, taPubkey })` where `headers` =
  `[{coord, name, author, isMine, bState}]` (both populations, pre-classified at the seam),
  `qualifying` = `Set<pubkey>` from the Neo4j seam. Per coord: count distinct carrier authors
  (cross-author rule; TA never counts) split into qualifying vs total; emit entries with
  `qualifyingAuthorCount >= threshold`, fields
  `{coord, name, author, isMine, sentinelDeferred: bState === 'deferred', qualifyingAuthorCount,
  totalAuthorCount, totalEventCount}`; sort by `qualifyingAuthorCount` desc, then
  `totalEventCount` desc (AC-2).
- **`src/api/adoption/index.js`**: export an internal
  `assembleTrustedDictionary({ wotPov, userPubkey })` used by both routes — runs the two slim
  scans (mirror handleAdoptionQueue's header scan incl. my-header bState classification; `#z`
  scan over all coords projecting `{pubkey, id, tags:z}`), collects distinct cross-author
  pubkeys, resolves the qualifying set via `runCypher` (`src/lib/neo4j-driver`): house
  `MATCH (u:NostrUser) WHERE u.pubkey IN $authors AND u.influence > $cutoff RETURN u.pubkey`;
  personalized `MATCH (c:NostrUserWotMetricsCard {observer_pubkey: $observer}) WHERE
  c.observee_pubkey IN $authors AND c.influence > $cutoff RETURN c.observee_pubkey` preceded by
  a zero-cards availability probe for the fallback signal; calls the core; returns
  `{entries, pov}`. New `handleTrustedDictionary` → `GET /api/trusted-dictionary` (public read,
  registered in `registerAdoptionRoutes`): the assembly plus a slim snapshots scan
  (`{kinds:[39999], '#z': ['39998:<TA>:trusted-dictionary-snapshot']}` → date/memberCount/id
  from the json section) → `{success, entries, snapshots, pov}`. TA pubkey via
  `getOwnerAssistantPubkey()` (never hardcoded).
- **`src/api/normalize/index.js`**: `ensureTrustedDictionarySnapshotConcept()` +
  `handleTrustedDictionarySnapshot` → `POST /api/normalize/trusted-dictionary-snapshot`
  (register in `registerNormalizeRoutes`), mirroring `handleAdoptionDisposition` (`:5295`): gate
  `isOwner(req) || req.localTrusted`; body `{wotPov?, userPubkey?}`; call
  `assembleTrustedDictionary`; drop `sentinelDeferred` entries; mint via
  `invokeNormalizeHandler(handleCreateElement, { concept: 'trusted dictionary snapshot', name:
  'dictionary <ISO date> (<memberCount>)', random: true, json: { trustedDictionarySnapshot: {
  name, slug, derivation: 'z-usage', pov: {branch, observer}, cutoff, threshold, computedAt,
  memberCount, members: [{coord, name, qualifyingAuthorCount}] } } })`.
- **`ui/src/pages/shared-concepts/TrustedDictionary.jsx`** (new): fetch
  `/api/trusted-dictionary` with `usePov().povParams` in the query string; entries table
  (qualifying count, total usage, kept-private marker on `sentinelDeferred` rows); snapshots
  strip; owner-visible "Publish snapshot" button POSTing the normalize route (the existing
  owner/auth-status idiom used by shared-concepts pages).
- **`ui/src/App.jsx`** (`:374-384`): `{ path: 'dictionary', element: <TrustedDictionary />,
  handle: { crumb: 'Trusted Dictionary' } }` under the shared-concepts children;
  **`ui/src/components/Layout.jsx`**: nav link beside Adoption Queue.
- Config reads via `getConfigFromFile` (`src/utils/config`) at handler scope (not module init —
  test overridability).

## Out of scope

- Consolidating the verified-cutoff two-default divergence (stays with the verified-muters
  deferred-scope item).
- W13 (cross-store POV identity) — flagged, not advanced.
- DRY refactor of the scan assembly shared with `handleAdoptionQueue`.
- Snapshot consumption (reading other instances' snapshots), diffing, or retention policy.
- Any UI for tuning N/cutoff (config-file knobs only in v1).
