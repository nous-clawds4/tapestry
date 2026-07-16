# Build Audit: Verified Reporters

**Book:** `engineering-team/audits/verified-reporters/book.md`
**Date:** 2026-06-07
**Branch / commit range:** `staging` (15e7a1d9) .. `feat/verified-reporters` (dbd1c34d)
**Provenance:** PRD-backed (`product-team/prd/verified-reporters.md` §8.1)
**Confidence:** high (anchored at kickoff; every shipped file traces to a story + ADR)

> As-built record — what the product *is* now. Source-linked, audience-neutral. Proposes nothing; the PRD addendum carries the product feedback.

## 1. What shipped
- A **Verified Reporters count** on the profile, in the counts row beside Following and Verified Followers — a negative-signal link when > 0, neutral "0" / "—" otherwise — `stories/verified-reporters/1-verified-reporters-count.md`.
- A **verified-reporters membership capability** — `GET /api/get-grapevine-reporters?observee=<pk>` returning the verified users who reported an account under the House PoV — `stories/verified-reporters/2-verified-reporters-membership-data.md`.
- A **Verified Reporters list page** at `/user/:pubkey/reporters` — who reported the account, Rank-descending, with PoV attribution and designed empty/loading/error states — `stories/verified-reporters/3-verified-reporters-list-page.md`.

Together: profile count → list page → membership endpoint. The credible negative trust signal, end to end.

## 2. Epics & stories rolled up

### Epic: `verified-reporters`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 verified-reporters-count | PoV-filtered count in the profile counts row; negative-signal link >0, neutral 0, "—" unavailable, dimmed loading; ADR 0001 | Done | `reviews/verified-reporters/1-verified-reporters-count.md` (PASS) |
| #2 verified-reporters-membership-data | `GET /api/get-grapevine-reporters` — inverse-`REPORTS` query, verified filter, `count===data.length`; ADR 0002 | Done | `reviews/verified-reporters/2-verified-reporters-membership-data.md` (PASS) |
| #3 verified-reporters-list-page | `/user/:pubkey/reporters` page mirroring the followers list; Rank-desc; PoV line + popover; skeleton + retry; ADR 0003 | Done | `reviews/verified-reporters/3-verified-reporters-list-page.md` (PASS) |

## 3. As-built inventory
Derived from the diff (13 files, +1276/−2):

- **User-facing:**
  - Profile counts row gains a third counter — `ui/src/pages/BrainstormProfile.jsx` (count value from `trustScores.verifiedReporterCount`; links to `/user/:pubkey/reporters` when > 0).
  - New page `ui/src/pages/BrainstormReporters.jsx` + route `/user/:pubkey/reporters` in `ui/src/App.jsx`.
  - New data hook `ui/src/hooks/useGrapevineReporters.js` (returns `{data, loading, error, refetch}`).
  - Styles: `ui/src/styles.css` — `.bsp-count-value-negative`, `.bsp-count-loading`, `.bsp-skeleton-row` + `@keyframes bsp-shimmer`, `.bsp-follows-subtitle`, `.bsp-follows-pov`.
- **Data & contracts:**
  - New route `GET /api/get-grapevine-reporters?observee=<pk>` → `src/api/grapevineInteractions/queries/reportersWithMetrics.js` (`handleGetGrapevineReporters`), registered in `src/api/index.js`. Response `{ success, observer:'owner', observee, count, data:[{pubkey, influence, hops, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount}] }`, `count === data.length`; `observee` validated (400), owner-only `observer` (400), `NEO4J_QUERY_TIMEOUT_MS` → 504.
  - Cypher: `MATCH (observee:NostrUser {pubkey:$observee})<-[:REPORTS]-(reporter:NostrUser) WHERE reporter.influence > $cutoff` — the inverse of `calculateVerifiedReporterCounts.sh`, reusing `VERIFIED_REPORTERS_INFLUENCE_CUTOFF`.
- **Domain:** no concept-graph or schema change; no firmware reinstall. Uses the existing `[:REPORTS]` Neo4j edge and the `NostrUser.influence` / `verified*Count` runtime properties. Concepts referenced (unchanged): `nostr-user`, `web-of-trust`, `graperank`; a NIP-56 report is a `nostr-event` of kind 1984.
- **Tests:** `test/profile-verified-reporters-count.test.js` (11), `test/verified-reporters-membership-data.test.js` (12), `test/verified-reporters-list-page.test.js` (17), wired into `test/test.js`; supplementary Playwright `tests/brainstorm/profile-verified-reporters-{count,list}.spec.js` (live-data, run at staging smoke).

## 4. Deviations from intent
Harvested from the ADRs' Consequences, the stories' Deviations/Out-of-scope/Open-questions, and the reviews; reconciled against the diff.

| # | Specified (PRD anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | §5.2/§6/§7 — count & list "relative to who is looking," effective PoV personal-else-House | The **count** is per-PoV (Meili `wot_verifiedReporterCount_<povSuffix>`); the **list membership** is **House/owner PoV only** | deferred | Per-PoV membership = the per-customer `NostrUserWotMetricsCard` traversal that follows (ADR 0026) and followers (ADR 0030) explicitly deferred (ADR 0002 §Context/Decision) | A personalized-PoV viewer sees a personal count but a House-PoV list; they can differ | Personalized-PoV membership → next phase |
| 2 | §8.1 — "whose PoV is in effect is attributed" on the count | No per-count / counts-row PoV marker shipped; attribution lives on the **list page** (PoV line + popover) | deferred | The fallback applies to all three counts at once; a per-count chip triples clutter — deferred to a shared cross-cutting session (PRD §8.3 / §11 decision 5) | Glance-only House-fallback viewer sees an unlabeled count; attributed one tap away on the list | Shared counts-row PoV indicator → Phase 4 |
| 3 | §10 metric 1 — count = list length | Holds *within the capability* (`count === data.length`) and at House PoV vs the count algo; **not** a hard real-time guarantee vs the precomputed Meili profile badge | constraint-discovered | Profile count = precomputed Meili; list = live Neo4j → refresh skew (ADR 0002/0003, mirrors ADR 0030) | Count badge and list length can differ transiently; list page shows its own live count | Note in any future copy/tests; no fix needed |
| 4 | §5.2 — designed loading & error states | List loading uses a **skeleton**; error has a **"Try again" retry** (hook gained a backward-compatible `refetch`) | intentional-change | AC7 + design guide; improves on the followers precedent's text loader / no-retry (ADR 0003) | Strictly better UX than the sibling pages | Fold into the DRY refactor so follows/followers gain parity |
| 5 | §5.1 — count behavior (4 display states) | Implemented as a 2-branch ternary (link >0 / else span), `fmtCount(null)`→"—" unifying loading+unavailable | interpretation | Same observable behavior, less branching (story #1 `## Deviations`) | None (identical UX) | — |

**Undocumented work:** none. Every file in the diff traces to a story + ADR (verified by walking `git diff --stat`).

## 5. Quality state at close
- **Test gate:** `npm test` → **Overall PASS** at close (2026-06-07). Verified-reporters suites: count 11/11, membership-data 12/12, list-page 17/17; no other suite regressed.
- **Known, accepted (non-blocking, from reviews):**
  - `reportersWithMetrics.js` — a harmless `.filter(row => row.pubkey)` carryover from the follows copy (no OPTIONAL MATCH here, so it never fires).
  - Per-request Neo4j driver creation — pre-existing pattern inherited from `followsWithMetrics.js`, not introduced here.
  - `BrainstormReporters.jsx` — "Try again" reuses `.bsp-follows-colbtn`; possible initial-mount empty-state flash inherited from the follows/followers pages.
- **Debt logged by ADRs:** the DRY `<GrapevineList>` + shared-cypher refactor (now 3 near-duplicate pages/endpoints — ADR 0030's standing follow-up); the verified-influence-cutoff inconsistency (existing intake item, inherited not fixed).

## 6. Carry-forward register
- [ ] **Personalized / customer PoV membership** for the list + endpoint (the `NostrUserWotMetricsCard` traversal) — realizes the PRD's full per-viewer vision (§4 #1; ADR 0002).
- [ ] **Shared counts-row PoV indicator** across Following / Verified Followers / Verified Reporters — tap-friendly, single, for the whole row (§4 #2; PRD §8.3).
- [ ] **DRY refactor:** extract a shared `<GrapevineList>` component + cypher builder for follows/followers/reporters; carry the skeleton + retry to all three (§5 debt; ADR 0030 follow-up).
- [ ] **Report-type breakdown** (split by NIP-56 type) — PRD Phase 2. *Partially delivered post-close: story #4 (2026-06-15, prod) shipped per-row Report Type + Reported timestamp columns; the filtering/grouping/breakdown UI remains deferred — see the post-close addendum below.*
- [ ] **Pile-on resistance** (tag/discount pile-on-prone reporters) — PRD Phase 3.
- [ ] **Self-view retaliation/privacy controls** — PRD Phase 4 (note: reports are public NIP-56 events; bounded risk).
- [ ] **Verified-influence-cutoff inconsistency** (0.01/0.05/"score>2") — existing intake item.

---

## Post-close addendum — 2026-07-02

*Appended during the harness-review sweep (docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md Appendix A). This book closed 2026-06-07; the following work landed on its epic afterwards and was not reflected here.*

**Story #4 — Reporters report-type and timestamp columns** (`stories/done/verified-reporters/4-reporters-report-type-and-timestamp-columns.md`, ADR 0004, review PASS) ran a full five-phase cycle 2026-06-15/16 and shipped to production (PRs #299 → staging, #300 → main). It partially delivers the PRD Phase-2 "report-type breakdown" scope: per-row Report Type and Reported-at timestamp columns on `/reporters`. The Phase-2 filtering/grouping/aggregate-breakdown UI remains deferred (carry-forward register above, annotated). No successor book was opened at the time; the epic was retired 2026-07-02 with all four stories Done.
