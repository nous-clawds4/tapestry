# Build Audit: Who may run a negentropy sync, and the access holes found on the way

**Book:** `engineering-team/audits/negentropy-sync-access/book.md`
**Date:** 2026-10-10
**Branch / commit range:** `staging` `0b705dbe..96a4ac80`. The book's commits: code `dc318717`, `3ace19de`, `1b3d538f`,
`742a7e32`, `d0c2e8ff`, `50117a3c`; record `9b2cf0c8`, `0f028254`, `deca5b15`, `d5de18d9`, `cc347f75`, `96a4ac80`.
(`6c972fc8`, inside the range, is two other books' production record.) Production: PR #837 (merge `8fbd68d0`, deploy
run 141), #839 (`c2553c2d`, run 143), #840 (`46c8254b`, run 144), #841 (`c0aa8d1d`, run 145), all successful.
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high. Every frame bullet is backed by a PASS review that re-derived it from the code, a green gate, a
successful production deploy, and live anonymous checks recorded in the reviews. The frame is narrow on purpose: the
wider class of admin actions with no owner check of their own is still open on production and lies outside it (§4 #7,
§6 #1).

> **Headline.** Negentropy syncs are now run by the owner, admins and direct-local callers; any other signed-in person
> keeps one narrow sync, the point-of-view download. On the way, the reviews found three more holes, and each shipped
> the same day: the central auth check could be stepped around by capitalizing a path (story 5) or by sending HEAD for
> GET (story 7), and any signed-in session could start or schedule any registered task (story 6). All four fixes went
> to production as owner-approved hotfixes before their records were written. The code passed its first independent
> read every time. Three of the four records claimed more than had shipped, and the reviews corrected them (§7 #1).

## 1. What shipped

- **One guard in front of the eight negentropy-sync routes.** The strfry family (`POST /api/strfry/negentropy-sync`,
  `GET …/stream`, `…/status`, `…/count`) and the four legacy POSTs (`/api/negentropy-sync`, `-wot`, `-profiles`,
  `-personal`) answer 401 to a visitor who is not signed in and 403 to a signed-in person who is not the owner or an
  admin. Before, the GETs answered anyone and the POSTs any signed-in session. — `stories/security-auth-exposure/4-negentropy-sync-owner-and-admins.md`
- **The point-of-view sync stays open to signed-in people, exactly.** `POST /api/strfry/negentropy-sync` with
  `dir: "down"` and a filter of exactly `{ kinds: [30382], authors: [<one lowercase hex pubkey>] }`. Brainstorm Search,
  Search Preferences and Brainstorm Settings send exactly that shape. — story 4
- **The saved presets are the owner's and admins'.** Their four POSTs already were (`requireOwnerOrLocal`, whose
  `isOwner` is the owner-or-admin alias); their list GET now is too, guarded like the sync status. — stories 4 and 6
- **The central auth check judges a path however it is capitalized**, as Express routes it. — `stories/security-auth-exposure/5-paths-judged-case-insensitively.md`
- **Starting a registered task and changing what runs on a schedule are for the owner, admins and direct-local
  callers.** `POST /api/run-task`, `/api/scheduled-tasks/create|update|delete` and `/api/customer-schedule/update|trigger`
  joined the middleware's owner-only list. The reads beside them stay public. — `stories/security-auth-exposure/6-task-control-owner-and-admins.md`
- **A HEAD request is judged as its GET is.** Express answers HEAD with the GET handler, so the middleware's protected
  and owner-only GET checks now cover HEAD. — `stories/security-auth-exposure/7-head-judged-as-get.md`
- **The documented sync routes say so.** The five OpenAPI entries for the sync routes state the rule and the 401/403
  answers. — story 4, AC-7
- **The older record agrees.** relay-stream-gaps ADR 0003 carries a "Superseded in part (2026-10-10): access" note. —
  `decisions/done/relay-stream-gaps/0003-negentropy-sync-presets.md`

## 2. Epics & stories rolled up

### Epic: `security-auth-exposure`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #4 negentropy-sync-owner-and-admins | One guard for the eight sync routes; the POV-sync exception; OpenAPI | Done | `reviews/security-auth-exposure/4-negentropy-sync-owner-and-admins.md` (round 1 CHANGES_REQUESTED on the record, round 2 PASS) |
| #5 paths-judged-case-insensitively | Every path test in `authMiddleware` on one lowercased copy | Done | `reviews/security-auth-exposure/5-paths-judged-case-insensitively.md` (PASS, one round) |
| #6 task-control-owner-and-admins | Six task-control POSTs on the owner-only list; the presets list GET guarded | Done | `reviews/security-auth-exposure/6-task-control-owner-and-admins.md` (round 1 CHANGES_REQUESTED on the record, round 2 PASS) |
| #7 head-judged-as-get | `isRead` (GET or HEAD) in both GET-only checks | Done | `reviews/security-auth-exposure/7-head-judged-as-get.md` (rounds 1–2 CHANGES_REQUESTED on the record, round 3 PASS) |

*(Stories #1–#2 belong to the Closed `security-auth-exposure` book and #3 to the Closed `auth-signature-verification`
book; not re-audited here.)*

**Epic close-out.** The epic stays `Done`, as the book said it would: this book carried the active-work signal, the
way `auth-signature-verification` did for story 3 (OPEN.md row 268). All seven stories are Done and on `main`.
**Its story, decision and review folders were left in place, not moved under `done/`.** Workflow 6 step 9 moves an
epic's folders whole, one `git mv` per area, and per file only when `done/<epic>/` already exists. It does not exist
here, and stories 1–3 already sit outside `done/` by the 2026-09-11 close's recorded choice
(`audits/auth-signature-verification/audit.md` §2). Moving only stories 4–7 would split the epic across two folders,
which the workflow rules out. Moving all seven would break the earlier close's recorded choice and rewrite every path
citation to the epic across the ledger and audits in a close the owner has not yet seen. The admin-action sweep may
also land in this epic (`_intake.md` 2026-07-21 calls it "security-auth-exposure phase 2"). Lint does not depend on
it: L2 checks the epic's Status, not where its folders are. The epic header now says stories 4–7 (it said 4–6). The
gap in the workflow is §7 #5.

## 3. As-built inventory

- **User-facing.**
  - The routes in §1. Refusals from the sync guard use the route family's `{ success: false, error }` shape. Refusals
    from the middleware use its existing 401/403 JSON. For HEAD the body is dropped.
  - Relay Settings' sync panel and the legacy control panel's sync buttons now answer 403 to a signed-in person who is
    not the owner or an admin. The UI does not hide them (story 4 Out of scope).
  - The task explorer pages show Run buttons to everyone, and those buttons now answer 403 to non-admins (review 6,
    round 1 non-blocking 3).
- **Server.**
  - `src/api/strfry/negentropyAccess.js` (new): `isPovSync`, and `createSyncGuards({ isOwnerOrAdmin })` returning
    `requireSyncManager` and `requireSyncManagerOrPovSync`.
  - Each guard is mounted where its route is registered: `src/api/strfry/negentropySync.js`, `src/api/index.js` (the
    legacy POSTs) and `src/api/strfry/negentropyPresets.js` (the list GET).
  - `src/middleware/auth.js` (`authMiddleware`): one lowercased `reqPath` and a `pathHas` helper; six task-control
    entries on `ownerOnlyEndpoints`; `isRead` in the owner-only and protected GET checks; a comment on
    `authenticatedEndpoints` pointing at the sync guard.
- **Tests.**
  - New suites: `test/negentropy-sync-access.test.js` (A1–A10), `test/auth-path-case.test.js` (P1–P5),
    `test/task-routes-owner-admin.test.js` (T1–T5) and `test/auth-head-requests.test.js` (H1–H5). The three middleware
    suites run the real `authMiddleware` in front of real Express routing.
  - `test/negentropy-sync-presets.test.js` P12 was re-aimed at the decision. `50117a3c` stopped A7 and A10 from passing
    silently when the presets module is missing.
- **Domain.** No concepts, handles, event kinds or firmware touched; no reinstall.
- **Data & contracts.**
  - The POV-sync request shape is now a contract for ordinary signed-in people: `dir` `down`, filter keys exactly
    `kinds` and `authors`, `kinds` `[30382]`, one lowercase 64-hex author.
  - Five OpenAPI entries state the sync rule (`src/api/openapi.yaml`).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 2: other signed-in people "may run only the point-of-view sync" | The first record (story 4, ADR 0004 Context) treated the eight sync routes as every way in. The task-control routes could still start and schedule the registered sync tasks. Story 6 brought them inside the rule, and the bullet now holds | constraint-discovered | Review 4 round 1, Blocking 1. The owner chose to extend the rule (book decision 7). Review 4 round 2 searched the repo for every other way to start a sync | Closed: review 4 round 2 found no other way for a signed-in person to start a sync | — |
| 2 | Frame bullet 4: the presets were "already" for the owner and admins | Only the four preset POSTs were. The list GET showed anyone each preset's relay, direction, filter and last results. Story 6 guards it like the sync status | interpretation, corrected | Review 4 round 1, non-blocking 4; book decision 8 | The presets list is no longer public | — |
| 3 | Frame bullet 5: hotfix first, "with the story and ADR recorded after" | All four stories went to production before their records. Each review was the first independent read, made after production | intentional-change | Book decision 3 (and 6, 7, 9): the owner's choice, given a hole reachable without signing in on production | None for users. The process cost is §7 #1–#4 | — |
| 4 | The original frame: syncs and presets | Three more fixes (stories 5–7), each found by a review of the book's own work. The frame grew from five bullets to eight | added-beyond-scope (owner-approved) | Review 4 round 1, non-blocking 7 (raised privately), became story 5. Review 4 round 1, Blocking 1, became story 6. A second private report from story 4's round 2 (noted in review 5) became story 7 | The central auth check is harder to step around | — |
| 5 | Decision 5: which relays, left undecided | The POV sync can still name any `ws(s)://` relay. It holds the instance's one sync slot for up to 10 minutes, and it returns strfry's output to the caller | deferred | Book decision 5; review 4 round 1, non-blocking 1–2 | A signed-in person can hold off scheduled preset syncs, and can learn whether an arbitrary host answers | §6 #2 |
| 6 | Decision 6: middleware fix only | Express still routes case-insensitively; there is no second safeguard. The `authenticatedEndpoints` entries for the sync routes are redundant and match by substring | deferred | Book decision 6; review 4 round 1, non-blocking 6 | None today (review 5 checked that lowercasing widens nothing) | §6 #3 |
| 7 | Decisions 10–11: the remaining admin actions with no owner check of their own go to an exhaustive sweep, as its own story | Not part of this book. That class, including GET routes that act or start heavy work, stays reachable on production by people other than the owner and admins. The middleware's owner-only list matches POST only (story 7 Out of scope) | deferred | Book decisions 10–11; story 6 and story 7 Out of scope; `_intake.md` 2026-07-21 and its 2026-09-30 and two 2026-10-10 addenda | Unchanged from before the book, except for the task routes story 6 closed | §6 #1 |
| 8 | Story 4 AC-7: documented sync routes state the rule | Done for the five sync entries. The OpenAPI entry for `/api/run-task` (story 6) does not state the owner rule, and the presets list has no entry | interpretation | Story 6 had no documentation criterion | Readers of the API reference don't learn the task-control rule | §6 #4 |

**Undocumented work:** none. Every file in the book's code and record commits maps to one of: stories 4–7 and their
test plans and reviews, ADR 0004, the book, the epic file, the 2026-07-21 intake entry's two 2026-10-10 addenda, the
book's ledger rows, or the relay-stream-gaps ADR note. `src/api/openapi.yaml` changed in record commit `9b2cf0c8`;
it is story 4's AC-7. `6c972fc8`, inside the commit range, records two other books' production promotion.

## 5. Quality state at close

- **Test gate (final tree, after the book flip and the epic housekeeping):** `npm run gate:status -- --label book-close-nsa-final`:
  `20261010T154522Z-17256-1a8d [book-close-nsa-final] started 2026-10-10T15:45:22.442Z on 96a4ac80+dirty — PASS, exit 0, 5553 passed, 0 failed, 582 skipped, 294/294 suites`.
  The `tagging-edges-realtime-wrapper` RW7 flake did not appear (24/24). An earlier run,
  `20261010T154217Z-11217-46ac`, was stopped by the Reviewer at 223/294, with no failures, because this close's text
  was still changing. It certifies nothing. Only this section changed after the final run started.
- **harness-lint (final tree):** `bash scripts/harness-lint.sh` → `harness-lint: clean (0 violations)`.
- **Gates recorded during the book** (in the reviews): `20261010T035216Z-10015-fe5d` PASS 5537/0 on `9b2cf0c8`;
  `20261010T050008Z-10501-dbeb` PASS 5548/0 on `0f028254`; `20261010T145542Z-14650-1898` PASS 5553/0 on `deca5b15`.
  The RW7 flake did not appear in any of them.
- **Live checks.** Not re-run at this close. The latest are in review 7 round 3: anonymous HEAD and GET on the guarded
  sync, presets and owner-only routes answered 401 on production and staging.
- **On `staging`, not yet on `main`:** `50117a3c` (test-only) and the record commits. `src/`, `bin/` and `scripts/` are
  identical on the two lines.
- **Known open issues:** the admin-action class (§4 #7); the POV sync's relay, slot and answer (§4 #5).
- **Debt, from ADR 0004 Consequences and the reviews:**
  - A future sync route must remember to mount a guard. A5/A6 pin the current eight, not new ones.
  - The middleware's `authenticatedEndpoints` entries are now redundant.
  - The owner-only list is POST-only.
  - The owner and admin pass is not exercised against the real middleware: `isOwner` reads `brainstorm.conf`, so
    story 6 AC-3 and story 7 AC-3 cover it only through stubs or by construction.

## 6. Carry-forward register

- [ ] **1. The admin-action sweep: the owner's chosen next story.** Inventory every route, POST/PUT/PATCH/DELETE *and*
      GET, classify each, and put an owner (or owner-or-admin) guard that admits direct-local callers on every
      administrative one. Pair it with a test or lint that flags an unguarded route. Its scope also covers the
      POST-only owner list (story 7 Out of scope) and a prefix overlap between two middleware list entries (review 5,
      non-blocking 3; harmless today because the handler checks the caller itself). The same class is pointed at by
      OPEN.md row 276 (F4/F5), `audits/security-auth-exposure/audit.md` §6 and `audits/event-authenticity/audit.md` §6.
      (§4 #7; `stories/_intake.md` 2026-07-21 and its addenda — the entry is the plan; this line does not restate it)
- [ ] **2. The POV sync may name any relay,** holds the one sync slot for up to 10 minutes, and returns strfry's output.
      Decide public relays only, and a per-person limit or a separate slot. (§4 #5; ledger `2026-10-10-pov-sync-relay-scope`)
- [ ] **3. Case-sensitive routing as a second safeguard,** and removing the redundant `authenticatedEndpoints` entries.
      (§4 #6; ledger `2026-10-10-case-sensitive-routing`)
- [ ] **4. The reviews' open non-blocking notes:** test gaps (A2, A8, P5, H5, the direct-local and customer branches
      under capitals), the `relay` type check in the strfry sync handler, the OpenAPI gap for task control, and two
      test-plan wording slips. (§4 #8; ledger `2026-10-10-negentropy-access-review-polish`)
- [ ] **5. A new sync route must mount a guard;** nothing catches one that doesn't. The sweep's "flag an unguarded
      route" test would. (ADR 0004 Consequences; folds into #1 if the sweep takes it)
- [ ] **6. What people who can't act should see:** Relay Settings' sync panel and the task explorer's Run buttons
      refuse non-admins with 403 but stay visible. (story 4 Out of scope; review 6 round 1, non-blocking 3; `prd-seed.md` §7)
- [ ] **7. Whether task status, history and schedules stay public reads.** (story 6 Out of scope; `prd-seed.md` §7)

*Earlier registers ticked at this close:* `audits/assistant-outbox-relays/audit.md` §6 #2 ("who may start a negentropy
sync, and with which relays"). Its "who" half is this book. Its "which relays" half is carried here as #2.

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-10-10, before this close):
- 1580 phase commits; the subject heuristic gives 19 to `security-auth-exposure`.
- 282 reviews decided, with a headline kick-back rate of 0% (final verdicts only) and 69 with kick-back history;
  re-review churn 3.
- 8 books open (this one at 0 d) and 75 closed.
- Cycle-time median 0 d. Stories 6 and 7 read 0 d (first→last). Stories 4 and 5 are unmatched (#6 below).

This book's own record: four stories in eight review rounds. Four rounds sent work back, all of them on the record and
none on the code. The code passed its first independent read four times out of four. The record was kicked back for
three stories out of four (story 4 once, story 6 once, story 7 twice).

**What held.**
- The reviews searched past their diffs. Review 4 found the task routes (story 6) and capitalized paths (story 5), and
  its round-2 pass found HEAD (story 7). Reviews 6 and 7 found more members of the open class, which went to the
  sweep.
- Open weaknesses were raised privately, not written into review files. Review 4's round-1 non-blocking 7, and a
  second report from the round-2 pass (noted in review 5), became stories 5 and 7. Neither hole was described in
  public before its fix. The one exception is #3.
- Later rounds re-derived the Reviewer's own suggested wording as fresh claims (reviewer rule 10). Review 6 round 2
  found its own round-1 phrase "all of which the entry names as exposed" was wrong, and it was kept out.

| # | Finding | Source | Terminal state |
|---|---|---|---|
| 1 | A record written after a hotfix generalized past what was checked, in three of four stories: "eight routes start a sync" and "only the POV sync" (story 4); "cannot run heavy recomputes, publish signed exports" (story 6); "no other method slips past" (story 7). The code was right each time; the record overclaimed. Ports to both flows: any record written from a shipped diff, whoever writes it | Review 4 round 1 Blocking 1 and § Harness friction; review 6 round 1 Blocking 1 and § Harness friction; review 7 round 1 Blocking 1 and § Harness friction | OPEN.md row `2026-10-10-after-the-fact-record-misses-siblings` (meta; existing). This close appended the measurement and a proposed amendment for the operator to ratify or decline |
| 2 | The book's acceptance frame was ticked `[x]` before each bullet's first independent review: bullets 1–5 in `9b2cf0c8`, 6–7 in `0f028254` (the commit that opened the row), 8 in `deca5b15`. Completion detection would have read a false bullet (2) as satisfied. Ports to both flows (a Director ticks the frame too) | Review 4 round 1 § Harness friction; review 4 round 2, review 6 round 1 and review 7 round 1 § Harness friction | OPEN.md row `2026-10-10-frame-ticked-before-review` (meta; existing). This close appended the three occurrences the reviews asked for |
| 3 | A review file naming still-open routes was committed to the public repo without a disclosure check (`deca5b15`, review 6 round 1). The Reviewer's instruction covered only live criticals, and nothing screens a review before commit. Ports to both flows: a Director commits review files too | Book decision 11; review 7 round 2 § Harness friction | OPEN.md row `2026-10-10-review-files-committed-unscreened` (meta; existing). This close appended the Reviewer-side half and a note that the close screened its own text |
| 4 | Four non-trivial security fixes (a new guard module, middleware changes, four new suites) shipped to production before any independent review, by the owner's explicit choice. `workflows/0-intake.md` step 3 writes a hotfix lane only for trivial changes, so this book improvised a "ship, then record, then review" lane four times. Ports to the human-gated flow only: a Direction run cannot ship to production | §4 #3; story 4–7 § Deviations ("Shipped before the record") | OPEN.md row `2026-10-10-ledger-fix-pr-merged-unreviewed` (meta; existing, same clause). This close appended a second instance, owner-approved and reviewed afterwards |
| 5 | Workflow 6 step 9 says nothing for an epic that keeps taking stories under later books. It says to move a finished epic's folders under `done/`, but this epic is Done and has taken stories under three books, and two closes (2026-09-11 and this one) left its folders in place for recorded reasons. Ports to both flows | §2 Epic close-out; `audits/auth-signature-verification/audit.md` §2 | OPEN.md row 268 (meta; existing, the reuse-a-Done-epic model). This close appended the folder half |
| 6 | Five of the eight review rounds were committed inside `docs:` commits, not `review: <slug> — <VERDICT> (<epic> #<n>)` commits (`workflows/5-review.md` § Per-phase commits): both rounds of review 4, review 5, review 6 round 1 and review 7 round 2. The hotfix code commits carry `fix:`. `harness-stats.sh` therefore cannot match stories 4 and 5, and sees 6 and 7 only through the review commits that do follow the rule | Subjects of `0f028254`, `deca5b15` and `cc347f75`; harness-stats output above | **Declined.** The rule is already written. Batching review rounds with record corrections was a habit of this book's hotfix pace, and the stats are an instrument, not a gate. Recorded so the cycle-time gap for stories 4–5 is explained. If a second hotfix book shows the same gap, file a `meta` row on how hotfix-first books should name their commits |

## Close screening

The repo is public, so this close checked its own new and changed text (this file, the seed, the book, the epic line,
the ledger rows and the OPEN.md row 268 note) before hand-off, two ways:
- a search for fragments of the still-open routes (the admin-action class, the GET that can act, GETs that start heavy
  work), with no hits;
- a list of every route-shaped token in the added lines, each checked against the routes this book closed.

The only routes named are the eight sync routes, the saved presets and the six task-control routes, all closed here.
