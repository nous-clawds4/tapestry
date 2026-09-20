# Build Audit: Profile lookups that scale with the page

**Book:** `engineering-team/audits/profile-lookup-bounds/book.md`
**Date:** 2026-09-20
**Branch / commit range:** `origin/staging a55b9631` .. `5b3af3b9` (merged to `staging` as `fa48911f`, PR #707)
**Provenance:** Acceptance-frame
**Confidence:** high — the frame was written at kickoff, every bullet is reconciled below against a
measurement, and the shipped code was verified on `staging.brainstorm.world` rather than only locally.

## 1. What shipped

- **Profile lookups are chunked at the endpoint's cap, so a page with any number of distinct authors
  gets its names.** Previously a page's whole pubkey set went out in one querystring and was refused.
  — `stories/done/profile-lookup-bounds/1-resolve-author-names-at-any-scale.md`
- **A failed lookup is visible instead of silent.** An author whose lookup could not be completed
  renders distinctly from one who simply has no profile published, across 31 pages, with no call-site
  edits. — same story
- **The endpoint's refusal tells the caller what to do.** `GET /api/profiles` past its cap now
  answers with the limit, the count received, and the remedy, additively. — same story

## 2. Epics & stories rolled up

### Epic: `profile-lookup-bounds`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 resolve-author-names-at-any-scale | Chunked client lookup, visible failure state, actionable endpoint refusal | Done | `reviews/done/profile-lookup-bounds/1-resolve-author-names-at-any-scale.md` |

One epic, one story. Review went to two rounds: round 1 raised one blocking regression, round 2
passed after `5b3af3b9`. (That history is narrated in the review but is invisible to
`harness-stats.sh` — see §7 R3.)

## 3. As-built inventory

**User-facing**
- Every control-panel surface that renders an author cell — 41 call sites across 38 files — now
  resolves names through a chunked lookup. No page's own code changed.
- `AuthorCell` gained a third visual state: *resolved name* · *no profile published* (unchanged) ·
  **lookup failed** (muted italic name + ⚠ + explanatory `title`).

**Data & contracts**
- `GET /api/profiles?pubkeys=<csv>` — unchanged contract for ≤ 50 pubkeys. Its over-cap 400 gained
  `limit`, `received` and `hint` **additively**; `success:false` and the `error` string keep their
  shape, so no existing caller breaks.
- New client module `ui/src/utils/profileBatch.js` exporting `PROFILE_CHUNK` (50),
  `PROFILE_LOOKUP_FAILED`, and `fetchProfilesChunked(pubkeys, {fetchImpl, chunkSize, onBatch, isCancelled})`.
- Server cap is now the named constant `MAX_PUBKEYS_PER_REQUEST`, exported for cross-checking.

**Domain**
- None. No concept handle, schema, or firmware definition was touched. **No firmware reinstall.**
  (The local Concept Graph API answered `{"count":0}` throughout — `OPEN.md` #69 — so no handles were
  resolvable here; none were needed.)

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 1: "every author cell shows a real display name where the author has a published profile — Confirmed against `/tapestry/lists/items`, which shows 288 truncated cells today" | The request-shape defect is fixed and verified. The named confirmation surface **could not confirm it**: on staging that page's authors have no published profile at all, so its cells stay truncated — correctly. | constraint-discovered | Measured at close: staging's relay holds 4,504,098 kind-0 events but **zero** for any of 8 sampled List Items authors; 0 cells were marked lookup-failed; 5/5 separately-sampled authors that *do* have kind-0 resolved to real names in 0.8 s. | None negative — but the frame's implied promise ("fix this and the page fills with names") does not hold for that page on that deployment. The truncation there was always two problems wearing one coat. | Product decides whether "authors with no discoverable profile" deserves a different treatment from a truncated pubkey — §6. |
| 2 | ADR 0001 implementation notes: modify `fetchMissing()` in `useProfiles.js` in place | Chunking core extracted to a React-free `ui/src/utils/profileBatch.js`; the hook is a thin wrapper | interpretation | Ratified at the Test Design gate: `react` is not resolvable from the repo root (`ERR_MODULE_NOT_FOUND`) and there is no jsdom (ADR `graph-curation-ui/0001`), so a hook cannot be executed by any test and AC1–AC4 would have been source-asserted only. Same precedent as `graph-curation-ui/0002`'s `authorDisplay.js`. | None — internal structure. | Five `Brainstorm*` pages still carry hand-rolled `PROFILE_CHUNK = 50` loops that this module makes redundant — §6. |
| 3 | Story AC-4: "the operator sees an explicit indication that author names could not be loaded" | Delivered per-cell via `AuthorCell`, not as a page-level banner | interpretation | ADR 0001 Decision: the `ta-avatar/0001` lever reaches 31 pages without editing a call site. | A failure is visible where the missing name is, rather than once at the top of the page. | — |
| 4 | Story AC-5: an over-cap request "never receives an empty-bodied rejection" | True for every request the endpoint handles. A request past the ~16 KB request-head ceiling is still refused beneath Express (431, empty body) and cannot be intercepted. | constraint-discovered | ADR 0001 Consequences; the Tester was instructed not to assert a property of Node. Guarded instead by `C12`: no first-party URL exceeds half the ceiling. | None — no first-party code can now emit such a request. | — |
| 5 | — (not specified) | `fetchProfiles.js` header comment corrected: it claimed a 1-hour TTL where `CACHE_TTL_MS` is 5 minutes | added-beyond-scope | ADR 0001 implementation notes, explicitly editorial. | None. | — |

**Undocumented work:** none. Every file in the diff traces to the story and ADR 0001:
`ui/src/utils/profileBatch.js`, `ui/src/hooks/useProfiles.js`, `ui/src/components/AuthorCell.jsx`,
`ui/src/styles.css`, `src/api/profiles/fetchProfiles.js`, plus `test/profile-lookup-bounds.test.js`
and its one-line `test/registry.js` registration.

## 5. Quality state at close

- **Test gate: FAIL.** Run `20260920T220348Z-88393-a712` on `d2370128+dirty` — **210/210 suites,
  exit 1, 3351 passed, 77 failed, 35 skipped.** Read per
  [Running and reading the test gate](../README.md#running-and-reading-the-test-gate). The verdict is
  recorded as-is; see §5a for what this book does and does not own in it.
- **Suite for this book:** `test/profile-lookup-bounds.test.js` — **27 passed, 0 failed, 0 skipped**
  with the live tier pointed at `staging.brainstorm.world` (`TAPESTRY_BASE=https://staging.brainstorm.world`).
  Locally 26/1, the one failure being the live `E2`, which cannot pass from a worktree (§7 R2).
- **Neighbouring suites at close:** `add-node-as-element-restore` 14/0 · `in-app-badged-ta-avatar`
  13/0 · `relay-scan-bounds` 28/0 · `stack-free-npm-test` 7/0.
- **`concept-count-canonical` 15/4** — all four are live tests failing on the empty local concept
  graph (`OPEN.md` #69), and this book touches nothing that suite exercises. Recorded because they
  *look* like breakage: they FAIL where they should SKIP.
- **Deployed and verified on staging.** PR #707, merge `fa48911f`, deploy run 35539554634. The served
  bundle contains the new code (`__lookupFailed` present in `/assets/index-C0IIBk2L.js`), so this is
  not a stale container.
- **Known open issues:** none introduced. `OPEN.md` row 273 (`/api/profiles` skips its local-relay
  fallback on a relay-race timeout) remains open and is the `assistant-profile` book's; this book
  deliberately did not touch `getProfiles` and makes row 273 *less* likely to fire, since batches stay
  small enough to finish inside the 6 s race.

### 5a. Reading the FAIL honestly

**This book owns 1 of the 33 failing suites, and its single failure is environmental.**

- 33 suites failed. This branch's entire `test/` diff is `test/profile-lookup-bounds.test.js` (new)
  plus one line in `test/registry.js`. The other 32 are untouched by this book and were failing
  before it.
- `profile-lookup-bounds` fails **one** test locally — the live `E2` — and passes 27/27 with the live
  tier pointed at a deployment that carries the code. The local container serves the main checkout,
  where the constant this book added does not exist (`docker exec … grep -c
  MAX_PUBKEYS_PER_REQUEST` → `0`). Recorded as §7 R4 and filed as a ledger row: the suite **FAILs
  where it should SKIP**.
- **The binding check is CI's stack-free gate, which passed on PR #707 in 1m42s** before the merge.

**A correction to a belief this close started with.** The session's durable note said `npm test`
"crashes at suite #2 (Meilisearch unreachable) and prints no summary, so there is no `Overall:` line
to read." That is now false and was nearly written into this audit: the gate ran **all 210 suites**
and recorded a normal verdict. An earlier run in this session appeared to confirm the old belief only
because a 200-second `alarm` killed it at 126/210 and the exit code (142) was read as a crash. The
note is corrected as part of the close-out.

## 6. Carry-forward register

- [ ] **Retire the five hand-rolled `PROFILE_CHUNK = 50` loops** onto the shared module —
      `BrainstormFollowers`, `BrainstormFollows`, `BrainstormMuters`, `BrainstormReporters`,
      `BrainstormFollowsHops`. They work and were deliberately left alone (§4 #2); they are now
      duplicate logic with a second copy of the cap. *(ADR 0001 Out of scope.)*
- [ ] **Decide what an author with no discoverable profile should look like** (§4 #1). On staging,
      List Items authors have no kind-0 anywhere reachable, so they render as truncated pubkeys — a
      correct fallback that still tells a reader nothing. This is a product question, not a bug.
- [ ] **A behavioural test for `AuthorCell`'s naming rule.** Review N2: the `R3` sentinel asserts the
      string "Tapestry Assistant" appears in the source, and stayed green through round 1's
      regression, which changed the rule's *use*, not its text. Left to the Tester by design (Phase 4
      does not edit `test/`).
- [ ] **Make `profile-lookup-bounds`' live tier skip instead of fail** when the stack is not serving
      this branch — it is currently a standing red line in every local gate run (§7 R4, ledger row
      `2026-09-20-live-tier-fails-on-stale-stack`).
- [ ] **Restore diagnostics symmetry** — `profileBatch.js` warns on a failed batch; consider whether
      the operator-visible sentinel and the console line should ever diverge.
- [ ] **`OPEN.md` row 273** (`/api/profiles` local-relay fallback skipped on timeout) — not this
      book's, but it is the reason cold lookups on staging returned nulls that then cached for five
      minutes. Linked, not duplicated.

## 7. Process findings (harness)

Retro run against `scripts/harness-stats.sh` at close: **phase commits 1170 · reviews decided 226 ·
kick-back rate 0% (CR-final) · reviews with kick-back history 43 · re-review churn 3 · books open 7,
closed 56 · cycle-time median 0d (198 of 252 stories matched).**

| Finding | Source | Terminal state |
|---|---|---|
| **R1 — A build reported exit 0 while failing, because the command was piped to `tail`.** `npx vite build … \| tail -14` returns `tail`'s status; the build had died on `ERR_MODULE_NOT_FOUND` with the error above the 14-line window, and "UI builds clean" was nearly reported on that basis. Generalises the existing row beyond the gate and beyond a trailing `echo` — `\| tail`/`\| grep`/`\| head` are the same hazard and far more common. | Implementation phase, this book | **Ledger row `2026-09-20-backgrounded-gate-exit-code-masked`** — evidence appended as a second instance, with the durable rule ("never read a verdict from a pipeline's status; assert a positive success marker"). |
| **R2 — CLAUDE.md's bind-mount sentence is *conditionally* true, and the condition flips within a day on one machine.** An existing row recorded four mounts and no repo bind; measured here, the same container has six, including `…/tapestry → /usr/local/lib/node_modules/brainstorm`. That row's own hypothesis (precondition, not correction) is confirmed. Consequence this book hit: the bind targets the **main checkout**, so a worktree session's live-tier tests silently exercise another tree's code — `E2` stayed red locally while `docker exec … grep -c MAX_PUBKEYS_PER_REQUEST` returned 0. | Implementation + Review, this book | **Ledger row `2026-09-20-claude-md-overstates-bind-mount`** — measurement appended, resolving its open question; the worktree consequence recorded there too, same root cause. |
| **R3 — Updating a review in place to PASS erases the only token the kick-back instrument reads.** This book had a real round-1 kick-back (a user-visible regression). Its review file now contains **zero** occurrences of `CHANGES_REQUESTED`, so it contributes 0 to both `CR_N` *and* `KB_HIST` (43). The retro is required to cite this instrument; for review rework it is lossy in the flattering direction. | Book close, this book | **Ledger row `2026-09-20-inplace-pass-erases-kickback-history`** (new). |
| **R4 — A live tier FAILs, rather than skips, when the stack serves a different branch than the working tree.** `stackPresent()` asks whether the stack *answers*, not whether it runs *this* code. From a worktree it always answers — with the main checkout's branch. This book's `E2` is 27/27 against a deployment carrying the code and 26/1 against `localhost:7778`, and that one red test puts `profile-lookup-bounds` into the close's gate FAIL. | Implementation, Review + close, this book | **Ledger row `2026-09-20-live-tier-fails-on-stale-stack`** (new). *Initially dispositioned "declined — covered by the deferred local-gate grouping"; corrected at close, because that grouping is about suites failing on **absent** state and this book **added** a suite failing on **stale** state, which is the harder of the two to spot.* |
| **R5 — `concept-count-canonical` FAILs where it should SKIP on an empty local graph**, producing 4 red tests that look like this book's breakage and are not. | Review + close, this book | **Declined** as a new row — covered by the operator's deferred "the local test gate lies" grouping (`OPEN.md` #192/#194/#27/#204/#205), deferred by choice, not missed. Recorded in §5 so this close's reader is not misled. |

**Does each port to the other flow?** R1 and R3 port to Direction mode and are *worse* there: no human
reads the notification's phrasing (R1), and a Director banking gate outcomes into a journal would find
the review-file trace already gone (R3). R2 and R4 share a root cause and are human-gated-specific in
their current form — a Direction run on a fresh clone would not hit the worktree/bind-mount
divergence — but R4 would bite any flow that runs a live tier against a stack it did not deploy.
