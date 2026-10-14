# Review: Story 1 — The Scores page

**Reviewer:** Claude (acting as Reviewer). The same session wrote the story, ADR, tests and code, so an independent
read-only checker re-derived the findings first (workflow 5, "an independent check before the commit"; OPEN.md row
`2026-10-14-self-review-needs-independent-check`). It found Blocking 1. I reproduced every finding kept below from
the sources.
**Date:** 2026-10-14
**Diff:** this story's commits only: `11d5c626` (tests), `515a6a0a` (implementation), `f3ca6cbc` (re-aims), on
`staging` at `2e79cc90`. Other books' commits in the same range are not reviewed here.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`: `20261014T012110Z-13146-4860 started 2026-10-14T01:21:10.374Z on 2e79cc90 — PASS, exit 0, 6078 passed, 0 failed, 582 skipped, 311/311 suites`.
- [x] Playwright, against `vite preview` of a fresh build of `2e79cc90` (chromium):
      `assistant-scores.spec.js`, `assistant-management-page.spec.js` and `assistant-trusted-content.spec.js` together
      gave 38 passed and 6 skipped. The skips are B8's built-page skips, Scores among them.
- [x] **Real BullMQ (the installed 5.76.10) against a throwaway local Redis.** I added each pipeline's job the way
      `enqueueTask` does: `updateAllScoresForOwner` → ADDED; `processCustomer` with jobId
      `processCustomer:<64 hex>` → **REJECT `Custom Id cannot contain :`**. See Blocking 1.
- [x] _Lint, typecheck and build: not configured, so skipped. `cd ui && npm run build` succeeds._

## Spec adherence

| AC | Met? | Evidence |
|---|---|---|
| AC-1 last published | Yes | `scores.js` `readPublished`; G1–G4, U2–U3, B3, B7 |
| AC-2 recalculate | **No, for Customers.** Yes for the Owner | A Customer's press can never enqueue (Blocking 1); P2 passes only through a fake `enqueueTask` |
| AC-3 one at a time | Yes, as written | The 409 check (P4) and the run state (Q1–Q5). The "racing presses share one jobId" safety (P5) is moot for Customers until Blocking 1 is fixed |
| AC-4 only your own | Yes | `viewerOf` reads only `req.session`; nothing in the query or body reaches `resolveViewer`, `readRunState` or `enqueueTask` (G8, P6, P7) |
| AC-5 no pipeline | Yes | G5–G7, P8, P9, B1, B2, B6 |
| AC-6 nothing else | Yes | The diff stays inside the ADR's file list plus its three re-aims; `/settings`, run-task, customer-schedule and `trustedContent.js` are untouched (S4) |

- [ ] Every acceptance criterion has a passing test that proves it: **no.** P2 and P5 assert the arguments
      `enqueueTask` gets and the jobId string, against a fake. The real queue rejects that jobId.
- [x] No criterion is silently dropped; no behaviour beyond the story.

## ADR adherence

- [x] The files changed match the Implementation notes. Small judgement calls are logged in the story's § Deviations.
- [x] Layering is respected: one module, lazy dependencies, handlers built from dependency-injection factories, and
      the page's network calls behind `assistantScores.js`.
- [x] No new dependencies.
- [ ] **The ADR's premise is false.** Sub-decision 4 says a press joins run-task's jobId, "so BullMQ keeps one job". The
      installed BullMQ rejects every customer jobId that `computeJobId` builds. ADR task-queue-scheduler/0022's probe
      used a jobId with no colon (`'fixed'`), so it never met the rule.

## Concept-graph integrity

- [x] No concept, handle or firmware change. No reinstall needed.

## Things tests can't catch

- [x] No secrets, no debug leftovers, no commented-out code. The `console.*` lines are the deliberate press and refusal
      logs the ADR names.
- [x] Session binding and refusal order were checked by reading `scores.js:93-244` against ADR sub-decision 4.
- [x] Page rendering: no answer shape, failed request or auth state found that throws. `npubShort` only ever gets the
      server's validated, lowercased pubkey. The effect depends on `[viewer, assistant, attempt]`, so there is no
      re-fetch loop.
- [ ] A real dependency's validation sat behind a fake (Blocking 1).

## House rules check

- [x] Concept Graph API authority: not applicable. No new lint, typecheck or build tooling.

## Findings

### Blocking

1. **`src/manage/taskQueue/queue/index.js:64-69` (reached from `src/api/assistant/scores.js:241`): every Customer's
   press answers 500, so AC-2 fails for Customers.**
   - **The cause:** `computeJobId('processCustomer', customerArgs)` returns `processCustomer:<pubkey>`. BullMQ 5.76.10,
     pinned in `package-lock.json` since 2026-05-20, throws `Custom Id cannot contain :` for any custom jobId whose
     `split(':')` length isn't 3 (`node_modules/bullmq/dist/cjs/classes/job.js:1043-1045`). Reproduced above.
   - **What a Customer sees:** the button enabled (the run state reads null). Every press fails, and the page says
     "Couldn't start a recalculation: this instance didn't answer."
   - **It isn't only this story's.** `/api/run-task`'s queue branch fails the same way for every customer task while
     `TASK_QUEUE_ENABLED=true` (the default on staging and production), and so does the per-Customer scheduler, which
     calls run-task over loopback (`src/api/customer-schedule/index.js:67`). Scheduled per-entry fires carry their own
     Job Scheduler ids and are unaffected.
   - **Asked change (ADR amendment first, Architect):** give customer jobIds a separator BullMQ accepts, for example
     `` `${taskName}-${pubkey}` ``. Keep it one stable id per (task, pubkey) so the dedup that ADR 0022 wants still
     holds. Say that this supersedes ADR task-queue-scheduler/0022's formula, and that it fixes the run-task path too.
     No old-format job can exist (each was rejected at add), so nothing needs migrating.
   - **Then the Tester:** re-aim `test/manual-task-retrigger-after-finish.test.js` T3 and this story's P5 to the new
     formula. Add a guard that runs every jobId `computeJobId` can produce through BullMQ's own validation, without
     Redis if that's possible, so a fake can't hide the rule again.
   - **Then the Implementer:** the one-line formula change.

### Non-blocking

These are cheap; fold them into the fix round.

1. **A signed-out press reaches the client with no `code`.**
   - The route-table middleware refuses first (`src/middleware/auth.js:391`, `{ success: false, error }`), so the
     handler's `not-signed-in` code only reaches direct callers, and the page then says "…: this instance didn't
     answer."
   - Suggested: have `Scores.jsx` or the client read HTTP 401 as `not-signed-in`, and have the BIBLE row and
     `openapi.yaml` say that the 401 comes from the route table.
2. **`ui/src/pages/assistant/scoresCopy.js:38`: `REASONS.failed` says "this instance didn't answer."** The server's 500
   `failed` means it answered but couldn't enqueue. Suggested: "this instance couldn't start one."
3. **`src/api/assistant/scores.js:204`: the read's 500 says "could not start a recalculation".** That's the press's
   wording. Suggested: its own words.
4. **`src/api/assistant/scores.js:51-60`: `countLocalStrict` isn't strict.** `Number('')` is 0, and `"0x10"` reads as
   16. Suggested: reuse `countStrict` from `src/lib/strfryScanStrict.js`, which is exactly the "one whole number or
   reject" reader.
5. **`src/api/assistant/scores.js:114`: a Customer record with no `id` enqueues `customerId: "undefined"`.** Run-task
   throws on such a record instead. Suggested: treat it as no pipeline, or refuse with `failed`.
6. **`ui/src/pages/assistant/Scores.jsx:38-46`: a sign-out then sign-in as someone else without a reload briefly shows
   the previous viewer's answer and notice.** It's cosmetic: the press is bound to the new session. Suggested: clear
   `answer` and `notice` when `viewer` changes.
7. **`src/api/openapi.yaml`: `run: queued` is described as "waiting".** The code also counts `prioritized`.
8. **Noted, not this story's:**
   - The press accepts a cross-site form POST in browsers that don't default cookies to `SameSite=Lax`. The session
     cookie sets no `sameSite` (`bin/control-panel.js:237-240`), and every session-bound `/api/assistant/*` press has
     the same exposure.
   - The public read runs `CustomerManager.initialize()`, which can create the customers file. `auth.isCustomer`
     already does the same.

### Harness friction

1. **A second occurrence for OPEN.md row `2026-10-14-self-review-needs-independent-check`.** The author-reviewer had
   passed this diff; only the independent check found Blocking 1.
2. **A fake for a third-party API hid that API's own validation.** The test plan's "Not covered: live queue" accepted a
   fake `enqueueTask`, and ADR 0022's probe used a jobId that didn't exercise BullMQ's id rule. Fix shape, one line for
   workflow 3's pitfalls: when a test fakes a third-party call, run at least one real input through that library's own
   validation (no network needed), or name the gap in the plan as a risk the Reviewer must check by hand.

## Verdict

**CHANGES_REQUESTED**

AC-2 isn't met for Customers: their press can never start a run (Blocking 1). The fix is one line in the shared queue
module, but it changes the jobId formula ADR task-queue-scheduler/0022 fixed and a test pins it, so the path is an ADR
amendment, the Tester's re-aim and guard, then the Implementer's change. The non-blocking items can ride along.

# Round 2

**Date:** 2026-10-14
**Diff:** the round-2 commits only: `776c7c39` (ADR Amendment 1), `892e97e0` (tests), `d4b056e0` (the fix), on `staging`
at `d4b056e0`. **Independent check applied again:** a fresh read-only checker re-derived round 2 before this verdict.
It found nothing blocking. Each of its findings below was reproduced from the sources.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`: PASS on the pushed head.** `20261014T034146Z-32226-73d9 started 2026-10-14T03:41:46.925Z on d4b056e0 — PASS, exit 0, 6086 passed, 0 failed, 582 skipped, 312/312 suites`.
- [x] **Playwright, chromium,** against `vite preview` of a fresh build of `d4b056e0`: `assistant-scores.spec.js` (B0–B11),
      `assistant-management-page.spec.js` and `assistant-trusted-content.spec.js` together gave 39 passed and 6 skipped
      (B8's built-page skips).
- [x] **Real BullMQ 5.76.10 over a throwaway Redis.**
      - Round 1's reproduction now reads `ADDED processCustomer id= processCustomer-aaaa…`.
      - The checker added every registry task's jobId, all 15 customer tasks with customer args, and got
        `accepted 73 rejected 0`.
      - A second add for the same Customer returned the same id: the dedup holds.
- [x] **Live on staging:** `GET /api/assistant/scores` signed out answers `{"success":true,"signedIn":false}`. A signed-out
      press answers 401 `{"success":false,"error":"Sign in to do this."}`, the route-table refusal the client now maps to
      `not-signed-in`.
- [x] _Lint, typecheck and build: not configured. The UI build succeeds._

## Round 1's findings, each re-derived as a fresh claim

| Finding | Now | Evidence |
|---|---|---|
| **Blocking 1:** customer jobId rejected | **Fixed** | `src/manage/taskQueue/queue/index.js:68` returns `` `${taskName}-${customerArgs.pubkey}` ``. V1 in `test/task-queue-jobid-valid.test.js` runs every id through BullMQ's own `Job#validateOptions`, and the real adds above succeed. The checker swapped in variants of `computeJobId`: the colon form fails V1, and an id that ignores the pubkey fails V2, so the guard isn't vacuous. Nothing in `src/`, `bin/` or `ui/src` builds, parses or looks up a jobId by its format, and no stored state holds an old-format id, because none was ever accepted |
| N1: a signed-out press reads "didn't answer" | Fixed | `ui/src/utils/assistantScores.js` maps a 401 that carries no code to `not-signed-in` (C4, B11). openapi and the BIBLE say where the 401 comes from (R6) |
| N2: the failed-press reason | Fixed | `REASONS.failed` reads "this instance couldn't start one." (U7) |
| N3: the read's 500 words | Fixed | `READ_FAILED` in `scores.js` (G9) |
| N4: a count reader that wasn't strict | Fixed | `countStrict(filter, { timeoutMs: 15000 })` from `src/lib/strfryScanStrict.js`; the module's own reader is gone (R5). A rejection maps to `count: null` through `allSettled` |
| N5: a Customer record with no id | Not taken, as Amendment 1 says | — |
| N6: the previous viewer's answer | Fixed; checked by reading, as the test plan said it would be | The reset effect in `Scores.jsx` is declared before the fetch effect and depends on `viewer` only, so it causes no extra fetch, and a viewer change starts from "Checking…" |
| N7: queued includes prioritized | Fixed | openapi and the BIBLE GET row (R6) |
| N8: cross-site POST, the public read's initialize | Not this story's, as Amendment 1 says | — |

Scope: the fix commit touches exactly Amendment 1's seven files and no tests. Round 1's behaviour (refusal order,
session binding, the run-state rules) is unchanged.

## Findings (round 2)

### Blocking

None.

### Non-blocking

1. **The 401's "no code" isn't true for a direct-local caller.** `openapi.yaml:918,934` and the BIBLE row now say
   the route table refuses a signed-out press with no code. That holds for every remote caller. A direct-local caller
   (loopback with no proxy header, `src/middleware/auth.js`'s `req.localTrusted`) skips the table, so a signed-out one
   would get the handler's `401 { code: 'not-signed-in' }` (`scores.js:206`). Suggested wording: "the route table refuses
   it with no code; a direct-local caller gets the handler's `not-signed-in`".
2. **`BIBLE.md:533`: the jobId note reads as if it applies to the Owner's run too.** "with run-task's jobId
   (`processCustomer-<pubkey>`)" follows both tasks. The Owner's id is the bare `updateAllScoresForOwner`. `openapi.yaml`
   says "for a Customer"; the BIBLE row should too.
3. **Tests that are right but narrow, recorded here, no action asked:** the guard copies `enqueueTask`'s add options
   rather than reading them, which is fine for a jobId-only guard. B11 checks what the line doesn't say; the positive
   "sign in first." is pinned at unit level by C4.

Both doc items get a `docs` ledger row (`2026-10-14-scores-api-doc-nits`), so they aren't lost.

### Harness friction (round 2)

1. Ledger row `2026-10-14-run-task-customer-jobid-rejected` is closed by `d4b056e0`; this review flips it to DONE.

## Verdict
**PASS**

Blocking 1 is fixed end to end and proven against the real library, and the six items Amendment 1 took are done as
written. The gate is clean on the pushed head, the browser class is green, and the two doc wording items above are
non-blocking.
