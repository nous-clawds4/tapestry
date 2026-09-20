# Build Audit: Harden an error path in a user-data handler

**Book:** `engineering-team/audits/user-data-error-path/book.md`
**Date:** 2026-09-19
**Branch / commit range:** shipped via PR #681 (fix, merge `a6f1d3ea`) + PR #683 (doc lane, merge `94fc855e`); promoted to production via #682 (`6e5c6a5f`) and #685 (`3eb38e8e`). Base `58505ae6`.
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high

> As-built record. Factual, source-linked, audience-neutral. Proposes nothing — that's the seed's job.

## 1. What shipped

- **A user-data handler's datastore-error branch is hardened** — `GET /api/get-user-data` now returns a well-formed `500` JSON response and the Express process survives when Neo4j is unreachable, where it previously crashed the process. — `stories/user-data-error-path/1-harden-and-restrict-…` *(→ `1-harden-user-data-error-path.md`)*
- **A regression test** invokes the real handler with its datastore unreachable (in a child process) and asserts both a `500` JSON response and a live process. — same story.
- **Three neighbouring undeclared-identifier tidies** — `userdata.js` dead-branch (`npub`→`npub1`), `service-management/queries/control.js` (`commands` hoisted so the owner-only `catch` can reference it), and a missing `require('fs')` in the unloaded `pagerank_deprecating` twin. — same story.
- **OPEN.md row 325 diagnosed and closed**, with the plain cause; `docs/SMOKE_TEST.md` gained the Neo4j-readiness gate, `OPERATIONS.md` §9.5 was corrected, and the 2026-09-18 smoke-test intake entry updated. — doc lane, PR #683.

## 2. Epics & stories rolled up

### Epic: `user-data-error-path`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 harden-user-data-error-path | the fix + 3 tidies + regression test | Done | `reviews/user-data-error-path/1-harden-user-data-error-path.md` (PASS) |

Plus a docs-lane review for the row-325 close: `reviews/harness-self-improvement/row-325-diagnosis-and-close-2026-09-19.md` (PASS).

## 3. As-built inventory (from the diff)
- **User-facing:** none.
- **API behaviour:** `GET /api/get-user-data` — the non-timeout Neo4j `.catch` now sends `500 {success:false, query, message}` instead of throwing an unhandled `ReferenceError` (`src/api/export/users/queries/userdata.js`). The timeout branch (504 JSON) is unchanged.
- **Auth/service:** `src/api/service-management/queries/control.js` — the owner-only systemctl-failure `catch` now returns its intended structured error instead of throwing (see deviation #1).
- **Removed:** nothing in this book (the `pagerank_deprecating` twin was deleted later by the `compute-endpoint-hardening` book — see deviation #3).
- **Domain / data / contracts:** none. No concepts, handles, schema, firmware, event kinds, or new routes.
- **Docs:** `OPEN.md` row 325 (DONE); `docs/SMOKE_TEST.md` (readiness gate); `OPERATIONS.md` §9.5; `engineering-team/stories/_intake.md`.

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "three tidies … no behaviour change on any reachable path" | The `control.js` tidy changes the owner-only systemctl-failure response body (uncaught `ReferenceError`→caller's generic 500 ⇒ intended structured 500) | constraint-discovered | review §Findings non-blocking 1 (`reviews/user-data-error-path/1-…`) | none user-facing (owner-only error path; a strict improvement) | — |
| 2 | "process-level policy raised, not decided … the decision is the operator's" | Raised; operator decided **log-and-exit**; filed as a follow-up, **not built** | intentional-change | operator decision 2026-09-19 (recorded in `_intake.md` 2026-09-19 entry) | none yet | build the backstop story |
| 3 | "a module nothing loads" (the `fs` tidy target) | Superseded — the whole `pagerank_deprecating` twin was deleted by the `compute-endpoint-hardening` book | constraint-discovered | that book's audit | none (dead, unreachable module) | — |

**Undocumented work:** none. Every diff hunk traces to story #1 or the row-325 doc lane.

## 5. Quality state at close
- Test gate: clean, certified over the final close tree (after the book flip + epic retirement): `20260919T071010Z-22-d197 — PASS, exit 0, 2856 passed, 0 failed, 522 skipped, 206/206` (isolated Node 22, `--network none`). The user-data suite: `harden-user-data-error-path: 2 passed, 0 failed`.
- Known open: the log-and-exit backstop (deviation #2, not built); residual doc-hygiene (§6).
- Debt: none new beyond the carry-forward.

## 6. Carry-forward register
- [ ] **log-and-exit unhandled-rejection backstop** for the server entry — decided, filed in `_intake.md` (2026-09-19 entry). (from §4 #2)
- [ ] **Residual §8→§9 citation cleanup** in `cycle-staging/SKILL.md`, `cycle-prod/SKILL.md`, `BIBLE.md` — filed in `_intake.md` / noted in OPEN.md row 325.
- [ ] **Other-area undeclared identifiers** found in the same read-only sweep (`bin/install.js`, `bin/update.js`, both `calculateGrapeRank.js`, `createAllCustomerRelays.js`, and a parse error in `src/pipeline/reconcile/createReconciliationQueue.js:81`) — swept to **OPEN.md row 329** (this close).

## 7. Process findings (harness)

Retro measurement: `scripts/harness-stats.sh` at close shows phase-commit coverage across the harness (story 222 / test 215 / impl 215 / review 279); this book contributed the full story→test→impl→review set plus a docs-lane review.

| Finding | Source | Terminal state |
|---|---|---|
| **Correlation keys are disclosure too.** The row-325 doc lane initially named the specific OPEN.md ledger row + doc sections in pointer-level prose while the fix was still unshipped; that row number correlates the fix (whose test/diff encode the mechanism) to the public symptom incident. | doc-lane review round 1 (`reviews/harness-self-improvement/row-325-diagnosis-and-close-2026-09-19.md`) | **declined** — captured here and in the review; it is an application of the existing SECURITY.md "pointers only, don't correlate" discipline, not a new rule. No separate harness change. |
| **Completion claims in a closing ledger row must be verifiable.** The row-325 close first stated the backstop was "decided and tracked as its own story" when no story existed. | doc-lane review round 2 | **declined** — the reviewer verifying completion claims is its normal job; fixed in-book by recording the decision + filing the follow-up. No harness change. |
| **The security-fix discipline held.** Branch-local-until-ship + generic public text + back-to-back ship, with an independent doc-lane review, caught both issues above before they went public. | this book + the doc-lane review | **declined** — validated positive pattern; recorded, no change needed. Ported to the `compute-endpoint-hardening` book, which reused it. |
