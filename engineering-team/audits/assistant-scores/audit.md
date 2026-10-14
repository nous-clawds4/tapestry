# Build Audit: Scores — see when your Grapevine was last published, and recalculate it

**Book:** `assistant-scores`
**Mode:** Acceptance-frame (no PRD)
**Anchor:** `engineering-team/audits/assistant-scores/book.md` § Acceptance frame: the owner's ask of 2026-10-13 and
three intake decisions (placement, Admins and guests, one run at a time).
**Confidence:** high.
- The owner confirmed it live on staging on 2026-10-14: signed in as the Owner, pressed **Recalculate and republish**,
  and saw the scores recalculated and "last published" move to about 15 minutes ago.
- One gap: no Customer has pressed on staging yet. The Customer path is proven by real BullMQ adds over a throwaway
  Redis (every customer task accepted) and by the unit and browser suites, not by a live Customer press.

**Dates:** opened 2026-10-13, closed 2026-10-14.
**Book commits:** `702bcf66` (plan) … `b16253b5` (review round 2, PASS), on `staging`; listed in §2.

## 1. What shipped

Every bullet of the acceptance frame is met.

- [x] **See it** (story 1). `/assistant/trusted-assertions`, the hub's Scores card, is a real page now. For the signed-in
      person's own Assistant on this instance it shows when that Assistant last published Trusted Assertions: the
      newest kind 30382 it signed on this instance's relay, as a date, a time and how long ago. It also shows how many it
      has published. When there are none it says "not yet", and when the relay can't be read it says so instead of
      claiming "not yet".
- [x] **Recalculate it** (story 1, fixed in round 2). The Owner and active Customers get **Recalculate and republish**:
  - the Owner's press enqueues `updateAllScoresForOwner`;
  - a Customer's press (an Admin who is one included) enqueues their own `processCustomer`;
  - while a run that re-signs their scores is queued or running, the page says which and the button is off.

  Verified live by the Owner on staging.
- [x] **Only your own, one at a time** (story 1).
  - The server decides whose run from the session alone. Nothing in the request's query or body reaches the task.
  - A second press, or an operator's trigger for the same account, joins the same run, because they share the queue's
    jobId.
- [x] **Honest for everyone else** (story 1). An Admin who isn't a Customer, a guest, or an inactive Customer sees the
      status and "Your scores aren't calculated on this instance. That's done for the Owner and for Customers.", with no
      button. Signed out or with no Assistant here, the page says what the other hub pages say.
- [x] **On staging**, at staging.brainstorm.world/assistant/trusted-assertions (the fix deployed with `d4b056e0`, the
      owner's live press, 2026-10-14).
- [x] **Nothing else changes**, with one intended exception, shared by design.
  - The hub's Scores card and its mark, `/settings`, the avatar menu and the other hub pages are unchanged.
  - The exception: the task queue's customer jobId separator changed from `:` to `-` (§3, §4 #1). That also repairs
    every customer task started through `/api/run-task`, and the per-Customer scheduler's triggers, which had been
    failing while the task queue was on.

## 2. Epics & stories rolled up

### Epic: `assistant-scores`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-scores-page | The Scores page's read and its Recalculate press, plus the shared jobId fix (ADR 0001 and Amendment 1) | Done | `reviews/done/assistant-scores/1-the-scores-page.md`: round 1 asked for changes (Blocking 1: every Customer press failed at BullMQ); round 2 PASS |

Book commits, in order: `702bcf66` plan · `9d65b2e3` story · `9d73e4e9`, `f98c62db` ADR 0001 · `11d5c626`, `6c52fb3e`
tests and plan · `515a6a0a` implementation · `f3ca6cbc` re-aims · `f0e1f3c8` review round 1 · `776c7c39` Amendment 1 ·
`892e97e0`, `5f2b590b` round-2 tests and plan · `d4b056e0` the fix · `b16253b5` review round 2.

## 3. As-built inventory

Derived from the diff (`git show 11d5c626 515a6a0a f3ca6cbc 892e97e0 d4b056e0`).

- **User-facing**
  - **The page** `ui/src/pages/assistant/Scores.jsx`, routed from `ACTION_PAGES['trusted-assertions']`
    (`ui/src/App.jsx`). It is in the Duty Menu page's frame: back link, title, the card's description, one card of
    status lines, then the button or the no-pipeline line, and the card's Treasure Map link at the foot.
  - **Its words and pure helpers** are in `ui/src/pages/assistant/scoresCopy.js`. **Its two requests** go through
    `ui/src/utils/assistantScores.js`.
  - It reads once per load and again after a press, with no polling.
- **Endpoints**, in `src/api/assistant/scores.js`:
  - `GET /api/assistant/scores`: `PUBLIC_READ`, session-shaped like `/api/assistant/attention`. It answers
    `{ signedIn, hasAssistant, assistantPubkey, published: { finished, latestAt, count }, pipeline, run }`.
  - `POST /api/assistant/scores/recalculate`: `allow('signed-in', why)`, session-bound. Its refusals, in order, are:
    - 401 (from the route table);
    - 403 `no-assistant`;
    - 403 `no-pipeline`;
    - 503 `queue-unavailable`;
    - 409 `already`, with `run`.

    Otherwise it answers 202 `{ run: 'queued' }`.
  - Both are registered in `src/api/index.js` and documented in `src/api/openapi.yaml` and two BIBLE API rows.
- **Shared:** `computeJobId` (`src/manage/taskQueue/queue/index.js`) gives a customer task
  `` `${taskName}-${pubkey}` `` (it was `:`), with the BIBLE task-queue sentence updated to match. ADRs
  task-queue-scheduler/0012 and 0022 gain **Amended by** pointers. `selfMap.js` exports `OWNER_SCORE_TASKS`,
  `ALL_CUSTOMER_SCORE_TASKS` and `ONE_CUSTOMER_SCORE_TASKS`, which the run state reuses.
- **Domain:** no concept, handle, schema or firmware change, and no reinstall.
- **Data & contracts**
  - **Reads:** kind 30382 by the viewer's own Assistant from this instance's strfry, via `scanLocalStrict` (`src/api/setup/status.js`)
    with limit 1 plus `newest()`, and `countStrict` (`src/lib/strfryScanStrict.js`) for the count.
  - **Writes:** none. The press only enqueues an existing registry task on its own task-queue queue.
- **Tests**
  - New: `test/assistant-scores-route.test.js` (32), `test/assistant-scores-page.test.js` (15),
    `test/task-queue-jobid-valid.test.js` (3; every jobId through BullMQ's own validation),
    `tests/brainstorm/assistant-scores.spec.js` (B0–B11) and `test/helpers/scoresFixtures.js`.
  - Re-aimed: `assistant-identification-tags-page` S3, `assistant-management-page` B8, `assistant-trusted-content` TC5,
    `manual-task-retrigger-after-finish` T3, and the message of `task-queue-bullmq` T3.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "Recalculate it" for active Customers | A Customer's press could never enqueue until round 2: BullMQ rejects the one-colon jobId `processCustomer:<pubkey>`. Fixed by changing the shared separator to `-` | constraint-discovered | Review round 1, Blocking 1; ADR 0001 Amendment 1 | For about two hours on staging (`515a6a0a` to `d4b056e0`), Customers saw an enabled button that always failed. The same rule had broken every customer `/api/run-task` trigger since the queue went on, and the fix repairs that too | Production gets it with the next promotion (§6) |
| 2 | Admins "status only, say why" | As specified: status plus the no-pipeline line | intentional-change (intake Decision 2) | book § Decisions 2 | Admins without a Customer record can't recalculate | Calculating for Admins (§6) |
| 3 | "queued or running until it ends" | Read once per load and after a press; reload to see the end | interpretation | story § Out of scope (live progress); ADR sub-decision 6 | A person reloads to see the run end | Live progress (§6) |
| 4 | "Running" for a Customer | Also "running" while an instance-wide orchestrator runs, even after their part is done | constraint-discovered | ADR 0001 § Consequences (the self-Map check's reading, kept for agreement) | The button can stay off longer than needed | §6 |
| 5 | Run state "can't tell → claim nothing" | Runs started outside the queue (legacy direct-spawn, the systemd timer, an operator's shell) aren't seen; a press then becomes a no-op at `launchChildTask.sh`'s guard | constraint-discovered | ADR 0001 § Consequences | None in normal operation, where staging and production run the queue | §6 |
| 6 | § Copy | Adds "Checking…" while loading; the Assistant shown as a short npub linked to its profile; a re-read after every press; a failed read shows neither the button nor the no-pipeline line | interpretation | story § Deviations | None beyond the words | — |
| 7 | Docs | Two wording nits: the 401's "no code" omits direct-local callers; a jobId note reads as covering the Owner | interpretation | review round 2, Non-blocking 1–2 | None | ledger `2026-10-14-scores-api-doc-nits` |

**Undocumented work:** none. Every file in the book's diff traces to ADR 0001, Amendment 1, the test plan's re-aims, or
the harness record (ledger rows, the two ADR pointer lines).

## 5. Quality state at close

- **Test gate,** run after the book flip and the epic close-out, over the tree this close leaves:
  `20261014T044102Z-5053-73bb started 2026-10-14T04:41:02.870Z on b16253b5+dirty — PASS, exit 0, 6086 passed, 0 failed, 582 skipped, 312/312 suites`.
  `+dirty` is this close's own uncommitted work (the audit, the seed, the book and epic flips, ledger notes and the
  `done/` moves); the close commit is exactly that tree.
- **Browser class** at review round 2: 39 passed, 6 skipped. That covers `assistant-scores.spec.js` (B0–B11) and the two
  re-aimed hub specs, against `vite preview` of a fresh build.
- **Live:** the owner's press on staging recalculated and republished the Owner's scores (2026-10-14).
- **Known open issues**
  - The doc nits (ledger `2026-10-14-scores-api-doc-nits`).
  - The session-bound press shares the app-wide cross-site exposure (OPEN.md row 326; ledger
    `2026-10-11-assistant-signing-routes-csrf-scope`, annotated at this close).
  - A Customer record with no `id` would enqueue `customerId: "undefined"` (review round 1, N5, not taken).
- **Debt from the ADR's Consequences**
  - Presses are neo4j-heavy work any Customer can start. Each is bounded per person and per task queue, but while one is
    active, `/api/deploy-safety/status` reads unsafe.
  - The pipeline task names live in two places (`scores.js` and `selfMap.js`), pinned to agree by R4.

## 6. Carry-forward register

- [ ] **Promote to production.** The page, and the shared jobId fix that repairs customer `/api/run-task` triggers, are
      on `staging` only (`d4b056e0`).
- [ ] **A Customer's press, witnessed live.** Only the Owner's has been, so far.
- [ ] **Calculating for Admins without a Customer record** (§4 #2; book Decision 2).
- [ ] **Live progress on the page:** auto-refresh while a run is queued or running, or a start time (§4 #3).
- [ ] **A cooldown,** if operators see press storms. Declined at intake; revisit only on evidence (book Decision 3).
- [ ] **The hub's Scores mark** could flag stale scores. Today it reads only the Treasure Map (story § Out of scope).
- [ ] **"Running" precision** for Customers during orchestrator runs (§4 #4).
- [ ] **Doc nits** (ledger `2026-10-14-scores-api-doc-nits`).
- [ ] **The cross-site posture** for session-bound presses (OPEN.md row 326).

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time: 1,767 phase commits; 301 reviews decided; 9 books open and 85 closed; median
cycle time 0d; 265 of 326 stories matched. This book ran two review rounds in one day, with one blocking finding.

| Finding | Source | Ports to Direction? | Terminal state |
|---|---|---|---|
| The session started on a clone 514 commits behind; research and the owner's placement choice ran on stale code until workflow 1's preflight | session record; Planning | Yes. Any session starts from the same snapshot | OPEN.md row `2026-10-14-session-start-stale-clone-unflagged` (second occurrence added at this close) |
| Phase 3 missed three tests that pinned the placeholder page; only the full gate and a browser run found them, after Implementation | test plan § Re-aims; owner-approved return to Test Design | Yes | OPEN.md row `2026-10-09-phase3-misses-moved-file-pins` (second occurrence, `f3ca6cbc`) |
| The author-reviewer passed a page-breaking defect; the independent read-only checker found it | review round 1 § Harness friction 1 | Yes. A Director reviewing its own book is the same case | OPEN.md row `2026-10-14-self-review-needs-independent-check` (second occurrence, `f0e1f3c8`) |
| A fake for a third-party call hid that library's own validation; the ADR rested on a probe that never met the rule | review round 1 § Harness friction 2 | Yes | OPEN.md row `2026-10-14-fakes-hide-library-validation` (new, `f0e1f3c8`) |
| About fourteen pushes to `staging`, most of them docs-only, each rebuilt and restarted staging; the session's stop hook required a push every turn | session record | Yes | OPEN.md row `2026-10-10-docs-only-push-redeploys-staging` (occurrence added at this close) |
| A staging-pinned session pushes drafts before their gate and the implementation before Review, so a defect Review blocked on was live on staging for about two hours | session record; review round 1 | Yes, more so: Direction runs to staging | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (occurrence added at this close) |
| A full gate run while the tree was rebased under it reported a false failure (`assistant-self-map-page`); a clean rerun passed | session record | No | declined: a one-off operator error, caught by a rerun. The run record already names its starting commit, so a moved tree is detectable, and a new rule would only restate "don't change the tree under a running gate" |
| The pre-existing run-task customer jobId bug, found while reviewing this book | review round 1 | — | Not a harness lesson. Ledger `2026-10-14-run-task-customer-jobid-rejected`, DONE by `d4b056e0` |

## 8. Epic close-out

`assistant-scores` has one story, it is Done, and its work is on the shared line (`staging`). So at this close the epic
is flipped to **Done** and its story, ADR and review folders move under `done/`.
