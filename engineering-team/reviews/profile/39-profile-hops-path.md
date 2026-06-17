# Review: Story 39 — Follows-hops path page + HOPS link activation

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-17
**Diff:** `git diff origin/staging...HEAD` (impl commit `fd157eab`)
**Story:** `engineering-team/stories/profile/39-profile-hops-path.md`
**ADR:** `engineering-team/decisions/profile/0035-profile-hops-path.md`
**Test plan:** `engineering-team/stories/profile/39-profile-hops-path.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `test/profile-hops-path.test.js` (isolated) — **27 passed, 0 failed**.
- [x] Related suites green — `profile-follows-hops` 25/0, `profile-identity-details-popover` 14/0, `trusted-list-pin-publish-blockers` 11/0.
- [x] `cd ui && npm run build` — **succeeds**.
- [x] _Full `npm test` `Overall` is **not** a valid gate locally_: several tags-feature `-publish`/concept-graph/Meili suites fail because the stale local stack has no tags runtime (0 `nostr-user-tag` in concept-graph, 0 `tagHits` in Meili). Confirmed unrelated to #39 — the diff touches **zero** tag source (see scope). Green on staging CI.
- [x] _Lint / typecheck — not configured._

## Spec adherence (story #39 ACs)

- [x] **Link activation** — [BrainstormProfile.jsx:269](ui/src/pages/BrainstormProfile.jsx) the #38 `<span>` is now `<Link to={`/user/${pubkey}/follows-hops`} className="bsp-count bsp-count-link …">` in **all** states; inner value/label + tooltip preserved.
- [x] **Count, #38-consistent** — [BrainstormFollowsHops.jsx:78-82](ui/src/pages/BrainstormFollowsHops.jsx): `"<target> is N hop(s) away from <source> by follows."` with `hops === 1 ? '' : 's'`; ∞ copy matches #38. Count derived from the path (`hops = paths[0].length - 1` server-side), so it can't disagree.
- [x] **Path as cards** — [:130-145](ui/src/pages/BrainstormFollowsHops.jsx): vertical `.bsp-hops-path` column, one card per node in path order (source→target), each with avatar + name + rank.
- [x] **Per-card rank = Owner-PoV** — `node.influence == null ? '—' : Math.round(node.influence * 100)` ([:134](ui/src/pages/BrainstormFollowsHops.jsx)) — the `BrainstormReporters` convention; `influence` is the Owner-PoV node property returned by the query.
- [x] **Cards link to profiles** — each card is `<Link to={`/user/${node.pubkey}`}>` ([:136](ui/src/pages/BrainstormFollowsHops.jsx)).
- [x] **No-path (∞) state** — `noPath` branch shows no cards and a "no follow path" message ([:125-127](ui/src/pages/BrainstormFollowsHops.jsx)); backend `{hops:null, paths:[]}` ([follows-hops-paths.js:60](src/api/export/users/queries/follows-hops-paths.js)).
- [x] **Self-view** — backend short-circuits `source === target` to a single-node path (`hops:0`), via a single-node `MATCH`, **not** `allShortestPaths` ([follows-hops-paths.js:44-53](src/api/export/users/queries/follows-hops-paths.js)); one card, re-roll hidden (paths.length 1).
- [x] **Re-roll** — `<button>` gated on `paths.length > 1` ([:146](ui/src/pages/BrainstormFollowsHops.jsx)); `reroll()` picks a random index ≠ current ([:37-42](ui/src/pages/BrainstormFollowsHops.jsx)); `selectedIndex` resets on new `paths` ([:35](ui/src/pages/BrainstormFollowsHops.jsx)). Label honestly notes `(of 25+)` when `truncated`.
- [x] **Graceful failure** — `error` branch shows a non-misleading "couldn't compute" message ([:119-123](ui/src/pages/BrainstormFollowsHops.jsx)); ∞ is keyed on `noPath`, never on error — no false path.

## ADR 0035 adherence

- [x] One endpoint `GET /api/get-follows-hops-paths`; `allShortestPaths((a)-[:FOLLOWS*..20]->(b)) … LIMIT 25` ([follows-hops-paths.js:30-33](src/api/export/users/queries/follows-hops-paths.js)) — cap **20** and `LIMIT 25` are **literals**; pubkeys are **bound** params `$src`/`$tgt`.
- [x] `runCypher(…, { timeout: 3000 })` reuses the #38 `txConfig` timeout.
- [x] 3-state contract exactly as specified; client re-rolls **client-side** over the returned set (no re-query).
- [x] Enrichment via batched `/api/profiles` (chunks of 50) + influence→rank — as specified.
- [x] Public endpoint — `0` occurrences of `get-follows-hops-paths` in `src/middleware/auth.js`; falls through to read-only `next()`.
- [x] No change to #38's `/api/get-follows-hops` contract (regression `R3` confirms it stays registered).

## Concept-graph integrity
- [x] No concept/schema change → **firmware reinstall N/A**. No handles in code.

## Things tests can't catch
- [x] No secrets / debug logging (the single `console.error` in the handler catch is legitimate) / commented-out code.
- [x] Input validated at the boundary (64-hex → 400); no injection (bound params, literal cap/LIMIT).
- [x] `reroll()` while-loop terminates for `paths.length > 1`; `selectedPath = paths[selectedIndex] || []` ([:84](ui/src/pages/BrainstormFollowsHops.jsx)) guards a stale index between a `paths` change and the reset effect (at worst a one-frame empty, no crash).
- [x] Profile enrichment is cancellable + tolerant of partial failure (mirrors `BrainstormReporters`).
- [x] Scope: only the 8 expected files; no over-reach.

## House rules check
- [x] No new lint/typecheck/build tooling. Minimal new CSS (`.bsp-hops-*`), reuses `.bsp-follows-avatar` and page chrome.

## Findings

### Blocking
_None._

### Non-blocking
1. **[BrainstormFollowsHops.jsx:107-127](ui/src/pages/BrainstormFollowsHops.jsx)** — in the ∞ case, the no-path message appears twice: as the count line (*"There is no follow path from X to Y."*) and as the empty-state body (*"No follow path within reach…"*). Harmless and both convey the same thing, but consolidating to one would be tidier. Optional.
2. **Required deploy-time check (staging):** the real path **values** — a finite N path of N+1 cards, a `truncated` 25+ case, and re-roll producing a *different* path — cannot be exercised on the stale/near-empty local graph (OPEN.md #6). The data-independent paths (self-view→single card `hops:0`, validation→400, no-path→∞) were verified locally. Verify the populated-graph behavior on **staging** during the deploy.

## Verdict
**PASS** — the diff matches story #39, ADR 0035, and the test plan; the `profile-hops-path` suite (27/27) and all related suites pass; UI builds; no blocking issues. Deploy-time follow-up: verify real path rendering + re-roll on **staging**.
