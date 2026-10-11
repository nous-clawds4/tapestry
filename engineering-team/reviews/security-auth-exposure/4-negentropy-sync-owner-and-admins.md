# Review: Story 4 — Negentropy syncs are run by the owner and admins; signed-in people keep the POV sync

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** `git show dc318717` (the fix, merged to `main` as PR #837 / `8fbd68d0`) and `git show 9b2cf0c8` (the record:
story, test plan, ADR 0004, book, OpenAPI). Read on `staging` at `9b2cf0c8`. Shipped as a hotfix before its record; this
is the first independent read.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** `npm run gate:status -- --label reviewer-sae4`:
      `20261010T035216Z-10015-fe5d [reviewer-sae4] started 2026-10-10T03:52:16.835Z on 9b2cf0c8 — PASS, exit 0, 5537 passed, 0 failed, 582 skipped, 291/291 suites`.
      The `tagging-edges-realtime-wrapper` RW7 flake did not appear.
- [x] Focused suite `node -e "require('./test/negentropy-sync-access.test.js').run()"` — 9 passed, 0 failed.
- [x] Fails before the fix, as the test plan says: the same suite run against `2d6aa3e0` (a detached scratch worktree,
      since removed) gave 2 passed (A7, A8), 7 failed.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), exit 0.
- [x] Live, anonymous, side-effect-free (status; count and stream with an invalid relay), on staging and production:
      every answer was 401 from the new guard.
- [ ] `npm run test:playwright` — not applicable (no UI change).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test. AC-1 to AC-6 are covered by A1 to A9. AC-7 is manual: I parsed
      `src/api/openapi.yaml` with js-yaml, and the five documented routes carry 200/401/403. The three other legacy POSTs
      (`-wot`, `-profiles`, `-personal`) have no OpenAPI entry, which matches AC-7's "documented".
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.
- [ ] **The record's wider claims don't hold.** See Blocking 1. The ACs list specific routes and all pass. The book's
      acceptance frame and ADR 0004's Context say more than that, and the "more" is not true of the shipped system.

## ADR adherence
- [x] Files changed match the ADR's Option B: `negentropyAccess.js` (new), route wiring in `negentropySync.js` and
      `index.js`, a comment only in `auth.js`.
- [x] Layering respected. The guard is injected through `createSyncGuards`, and the default instance uses the real
      `isOwnerOrAdmin` (A9). `auth.js` requires nothing under `src/api`, so there is no require cycle.
- [x] No new dependencies.
- [ ] ADR Context, line 9: "Eight routes start or inspect a negentropy sync" is not accurate (Blocking 1).

## Concept-graph integrity
- [x] No concepts, handles, event kinds or firmware touched. No reinstall needed.
- [x] N/A: no concept-orientation code.

## Things tests can't catch
- [x] No secrets in the diff.
- [x] No leftover debug logging. The new code adds no `console.log`.
- [x] No commented-out code.
- [x] Error paths: refusals return 401 when not signed in and 403 when signed in, in the family's
      `{ success: false, error }` shape. Relay Settings' status poll tolerates the 403 (`d.active` is just undefined).
- [x] Concurrency: the guards are synchronous and hold no state. The single sync slot is unchanged (see Non-blocking 1).
- [x] Middleware order checked in `bin/control-panel.js`: `express.json` (:124) and `express.urlencoded` (:125), then
      `session` (:232), then `authMiddleware` (:323), then `api.register` (:347). So `req.body` and `req.session` are in
      place before any guard runs, and `req.localTrusted` is set by the middleware (`auth.js:361-363`).
- [x] Input tricks against the POV exception, run locally through the real `express.json` and `express.urlencoded`
      parsers with nothing spawned: none widen it.
      - Duplicate JSON keys resolve to the last value, and the guard and the handler read the same parsed object.
      - A `__proto__` or `constructor` key inside `filter` becomes an own key, so `filter` has three keys and is refused.
      - A top-level `__proto__` does not supply `dir`.
      - Urlencoded bodies give string kinds and are refused.
      - Extra top-level fields are ignored; the handler reads only `relay`, `dir` and `filter`.
      - `buildFilterObj` sees only `kinds` and `authors`.
      - An accepted body runs exactly `strfry sync <relay> --filter {"kinds":[30382],"authors":[<hex>]} --dir down`. The
        only free input is `relay`, which is out of scope (ledger `2026-10-10-pov-sync-relay-scope`).
- [x] Direct-local callers: `syncPresets.sh` POSTs `127.0.0.1:${CONTROL_PANEL_PORT}/…/negentropy-presets/run`. That
      route goes through `requireOwnerOrLocal` and `runStrfrySync`, not the new guard, so it is unaffected. Its preset
      sync never passes through the guarded routes. No loopback script calls the eight guarded routes; the one in
      `turnBrainstormOn.sh:47` is a dead GET to port 3000.
- [x] Route shadowing: each guarded path is registered once, and no earlier parameterized or `app.use('/api…')` route
      can answer first. `app.get` also serves HEAD, and the guard is on that stack too.
- [x] The three POV pages send exactly the AC-3 shape (Spec / AC-5). Each takes the author from tag `30382:rank` in the
      viewer's kind 10040. Empty values return early: `BrainstormSearch.jsx:338`, `BrainstormSettings.jsx:256`,
      `SearchPreferences.jsx:420`. Nothing lowercases the author or decodes an npub, so a 10040 whose `rank` tag is not
      lowercase hex now gets 403 for an ordinary person. NIP-01 requires lowercase hex, and Brainstorm-published 10040s
      use it, so I accept this.

## House rules check
- [x] Concept Graph API authority respected (not touched).
- [x] No new lint/typecheck/build tooling.
- [x] TA pubkey not involved.

## Product-guide adherence *(when the story traces to a PRD)*
- N/A: no-PRD book.

## Findings

### Blocking

1. **The ADR and the book's acceptance frame say the rule covers every way to start a negentropy sync. It does not.**
   - **The overclaims.** `engineering-team/decisions/security-auth-exposure/0004-one-guard-for-negentropy-syncs.md:9`
     says "Eight routes start or inspect a negentropy sync". `engineering-team/audits/negentropy-sync-access/book.md:23`
     ticks "Any other signed-in person may run only the point-of-view sync".
   - **The other way in.** The generic task routes run the registry's sync tasks for any signed-in session: `POST
     /api/run-task` (`src/api/index.js:295`), `POST /api/scheduled-tasks/create` and `/update` (`:493`, `:489`), and
     `POST /api/customer-schedule/trigger` (`:507`). Not-signed-in callers are refused by default-deny.
     `handleRunTask` (`src/api/manage/commands/runTask.js:360`) and `handleCreate`
     (`src/api/scheduled-tasks/index.js:377`) have no caller check. The middleware's owner-only lists do not name these
     paths. ADR `tagging-edges/0002` already records "open to any signed-in session" (line 89).
   - **The tasks.** The registry entries include `syncWoT`, `syncProfiles`, `syncNegentropyPresets` and
     `refreshSearchIndex` (`src/manage/taskQueue/taskRegistry.json:208`, `:239`, `:270`, `:659`). The
     `processCustomer` chain also reaches `loadScoresIntoMeilisearch.sh`, which runs `strfry sync`.
   - **What a signed-in person can do with them.** The caller cannot pick the relay or filter; those are fixed by the
     scripts, the owner's House preferences (owner-gated PUT) or the owner's presets. But a signed-in person can still
     start these syncs whenever they like, and can schedule them on a short interval. That includes running the owner's
     saved presets, and presets may be `up` or `both` (`negentropyPresets.js:33`). This is pre-existing, not a
     regression from this diff. But it is a negentropy sync that someone other than the owner or an admin can manage,
     and the record says that cannot happen.
   - **Asked change (needs an owner decision).** Either:
     - (a) bring these tasks inside the rule, in a follow-up story or by extending this one, so that only owner, admin
       or direct-local callers can start or schedule a sync task; or
     - (b) narrow the claims to what shipped, then open a ledger row for the task routes. In ADR 0004 Context, write
       "eight routes take a caller-chosen relay, filter or direction". In the book frame bullet 2 and the story, say the
       rule covers those routes.

     Until then, uncheck or qualify frame bullet 2 so completion detection does not offer to close the book on a false
     premise.

### Non-blocking

1. **`src/api/strfry/negentropySync.js:74`, `:110-112` — the one sync slot.** A signed-in person's POV sync can hold
   the instance's single sync slot for up to 10 minutes per request, for example against a relay that never answers.
   They can repeat it. Meanwhile scheduled presets wait 10 minutes and are then skipped as "a manual sync was running",
   and other people's POV syncs are told one is in progress. Limiting relays to public addresses (the open ledger row)
   would not fix this. Suggest adding it to `2026-10-10-pov-sync-relay-scope` (a shorter timeout for the POV sync, or
   one per session).
2. **`src/api/strfry/negentropySync.js:120-126` — what the POV sync answers.** It returns strfry's full output and the
   command to the signed-in caller. Combined with a free relay, the answer shows whether an arbitrary `ws(s)://`
   host:port responded. Suggest adding this to the same ledger row's decision.
3. **`src/api/strfry/negentropySync.js:70` — `relay` type.** The handler doesn't require `relay` to be a string. An
   array passes the regex by coercion and reaches `spawn` as a non-string argv element, which Node joins into one
   comma-separated argument. That is not exploitable: it stays one argument and `--dir down` is fixed. Optional
   hardening: `typeof relay === 'string'`, as the legacy handler's `relayArg` does
   (`src/api/pipeline/batch/commands/negentropySync.js:15-24`).
4. **`src/api/strfry/negentropyPresets.js:400` — the presets list GET is unguarded.** The story's Background
   (`stories/…/4-…md:21`) says the presets "were already guarded by `requireOwnerOrLocal`", but only the four POSTs are.
   The list shows anyone each preset's relay, direction, filter and last results, plus the `running` flag. Relay router
   reads are public too, so this matches an existing pattern, and AC-6 is about managing presets, not reading them. It
   does sit oddly beside `/status`, which this story now guards as an "inspect" route. Suggest correcting the sentence
   to "the four preset POSTs", and asking the owner whether the list should follow `/status`. Staging only; `main` has no
   presets module.
5. **Test coverage gaps (the ACs are still met).**
   - A2 does not include a `__proto__` or `constructor` filter key, or a non-string author. I checked both by hand and
     both are refused.
   - A8 checks the source shape, not runtime author values.
   - A5 and A6 pin the current eight routes, not future ones (the ADR accepts this).
   - No test covers parse → session → auth → route ordering; I checked it by reading the code (see above).
6. **`src/middleware/auth.js:369-380` — the `authenticatedEndpoints` entries.** ADR 0004 says removing these "would not
   widen access". That is true, and removing them would actually narrow the middleware's substring over-match: today a
   signed-in session skips the owner-only lists on any path containing `/negentropy-sync`. I checked the parameterized
   routes, and nothing is reachable through that over-match today. Optional cleanup for a later story.
7. **Separate from this diff — escalated privately, not described here.** While auditing I found a pre-existing
   weakness in the central auth middleware that affects routes relying on the middleware alone. Because it is open, this
   public file does not describe it. It does not affect this story's guards: they sit on the routes themselves, and I
   confirmed live that they answer 401 where the middleware alone would not.

### Harness friction
1. Two process issues, each a candidate `meta` row for OPEN.md:
   - **Route inventory.** A record written after the fact, from a shipped diff, listed the routes the diff touched,
     not every route the rule needs to cover. No step asked for a repo-wide search for other ways to start a sync, and
     that gap is Blocking 1.
   - **Pre-ticked frame.** The book's acceptance frame was ticked `[x]` before the first independent review, so
     completion detection would have read it as already satisfied.

## Verdict
**CHANGES_REQUESTED**

The shipped code is correct, well pinned and should stay in production. It closed the anonymous hole on all eight
routes, and the POV exception cannot be widened by input tricks. The block is on the record: ADR 0004 and the book's
frame claim more coverage than shipped (Blocking 1). The owner should decide between extending the rule to the task
routes and narrowing the claims; either is a small change.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. *(Not applicable: CHANGES_REQUESTED.)*
- [ ] Completion detection: not run, because the verdict is not PASS.

---

# Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** `git show 0f028254` (the record corrections: story 4, ADR 0004, the book, relay-stream-gaps ADR 0003's
access note, the ledger rows), read with `git show 1b3d538f 742a7e32` (story 6's code, which is what closes Blocking 1).
Read on `staging` at `0f028254`. Code on `staging` and `main` is identical for `src/`, `test/`, `bin/` and `scripts/`
(`git diff staging origin/main --stat -- src test bin scripts` is empty).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** `npm run gate:status -- --label reviewer-sae4-6-r2`:
      `20261010T050008Z-10501-dbeb [reviewer-sae4-6-r2] started 2026-10-10T05:00:08.729Z on 0f028254 — PASS, exit 0, 5548 passed, 0 failed, 582 skipped, 293/293 suites`.
      The `tagging-edges-realtime-wrapper` RW7 flake did not appear.
- [x] Focused suites: `negentropy-sync-access` 10 passed, 0 failed (A10 is new, from story 6);
      `negentropy-sync-presets` 95 passed, 0 failed.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), exit 0.
- [x] Live, anonymous, side-effect-free, on production and staging: `GET /api/strfry/negentropy-sync/status` → 401;
      `GET /api/strfry/negentropy-presets` → 401 (and 401 capitalized).
- [ ] `npm run test:playwright` — not applicable (no UI change).

## Blocking 1 — resolved

The owner took option (a): bring the task routes inside the rule. I re-derived the claim rather than reading the fix
as mine.

- **The task routes are closed.** `/run-task`, `/scheduled-tasks/create|update|delete` and
  `/customer-schedule/update|trigger` are on `ownerOnlyEndpoints` (`src/middleware/auth.js:438-443`). That list
  admits `isOwner`, which is the owner-or-admin alias (`auth.js:276-293`). Direct-local callers pass earlier
  (`auth.js:366-369`). Visitors who are not signed in are refused by default-deny. `test/task-routes-owner-admin.test.js`
  T1–T3 pin this; it fails before the fix (T2, T5) and passes after. Live: anonymous `POST /api/run-task` and
  `/API/run-task` → 401 on production and staging.
- **Frame bullet 2 now holds** ("any other signed-in person may run only the point-of-view sync"). I searched for
  every other way to start a negentropy sync, not only the routes the diffs touched:
  - Only two modules under `src/api` spawn `strfry sync`: `src/api/strfry/negentropySync.js:47` and
    `src/api/pipeline/batch/commands/negentropySync.js:66`. They are reached only through the guarded routes and the presets' run POST.
  - The sync scripts run directly by `/api/negentropy-sync-wot|-profiles|-personal` are behind
    `requireSyncManager` (`src/api/index.js:297-299`).
  - The presets' run POST is behind `requireOwnerOrLocal` (`negentropyPresets.js:388`).
  - The registry's sync tasks (`syncWoT`, `syncProfiles`, `syncNegentropyPresets`, and `processCustomer` →
    `loadScoresIntoMeilisearch.sh`) start only through the six task routes above, through BullBoard (mounted with
    `requireOwnerOrAdmin`, `src/manage/taskQueue/queue/bullBoardMount.js:58`), or from the in-process schedulers.
  - The relay router writes are owner-only (`auth.js:432-435`).
  - No other route under `src/api` spawns a sync.
- **Story 4 corrected.** Background (`4-…md:21-24`) now says the presets' four POSTs were guarded and the list GET was
  not, and that the task routes could start the sync tasks; story 6 closes both. AC-6 covers the list GET. A
  Deviations entry records the first record's overclaim.
- **ADR 0004.** A new Consequences bullet (`0004-…md:59-60`) says the registered sync tasks start through the task
  routes and that story 6 closes them. That is accurate.
- **Book.** Frame bullets 6–7 and decisions 6–8 were added, and the epic list now names stories 4–6.

## Presets wording — fixed

`4-…md:21-22` now reads "the saved presets' four POSTs … were already guarded by `requireOwnerOrLocal` … their list GET
was readable by anyone (story 6 guards it)". This is true:
- the four POST handlers call `requireOwnerOrLocal` (`src/api/strfry/negentropyPresets.js:333`, `:357`, `:373`,
  `:388`);
- the list GET is now mounted behind `requireSyncManager` (`:403`);
- `test/negentropy-sync-access.test.js` A10 and `negentropy-sync-presets` P12 pin it, and both fail on the tree before
  `742a7e32`.

The "Superseded in part" note added to `decisions/done/relay-stream-gaps/0003-negentropy-sync-presets.md` agrees with
this.

## Record and ledger accuracy

- Story 4's Deviations: PR #837 merged as `8fbd68d0` (GitHub REST: merged 2026-10-10T03:48:06Z, base `main`), and
  `staging` has `dc318717`. Deploy run 141 (`8fbd68d0`) completed successfully.
- `ledger/2026-10-09-negentropy-sync-access-scope.md` is DONE with the same facts. `2026-10-10-pov-sync-relay-scope`
  now carries round 1's non-blocking 1 and 2. `2026-10-10-case-sensitive-routing` carries non-blocking 6. Round 1's
  two harness-friction items are `2026-10-10-after-the-fact-record-misses-siblings` and
  `2026-10-10-frame-ticked-before-review`.
- Round 1's non-blocking 7, the weakness escalated privately, is story 5 and is now fixed on production (deploy run
  143). It is reviewed in `5-paths-judged-case-insensitively.md`.

## Findings (round 2)

### Blocking
None.

### Non-blocking
1. **`engineering-team/decisions/security-auth-exposure/0004-one-guard-for-negentropy-syncs.md:9`.** The Context still
   opens "Eight routes start or inspect a negentropy sync". Read with the new Consequences bullet it is no longer
   misleading. But it is still not literally true: the task routes and BullBoard also start syncs, and two of the eight
   (`-wot`, `-profiles`) run the same scripts as the registry's `syncWoT` and `syncProfiles`
   (`src/api/manage/negentropySync/commands/syncWoT.js:21`, `syncProfiles.js:21`). The Consequences bullet's "not these
   eight" is loose for the same reason. Optional: say "Eight routes start or inspect a sync directly, with a
   caller-chosen relay, filter or direction".
2. **`engineering-team/stories/security-auth-exposure/4-negentropy-sync-owner-and-admins.test-plan.md:18`.** The AC-6
   row still lists only A7, the preset POSTs. AC-6 now includes the list GET, which A10 and P12 cover. Optional: add
   them to the row.
3. **`test/negentropy-sync-access.test.js:164`, `:190`.** The guard comments say the presets module "reached staging
   after main's last promotion". That has been stale since PR #838 (`94cb6d3e`) brought it to `main`. A7 and A10 still
   return early, and so pass, if the module is ever missing. Optional: drop the existence guards now that both lines
   carry the module.
4. Round 1's non-blocking 3 (`relay` type) and 5 (test gaps) were not taken up. Both stay optional.

### Harness friction
1. The commit that opened `ledger/2026-10-10-frame-ticked-before-review.md` (`0f028254`) also ticked frame bullets 6–7
   `[x]` before their first review. They are accurate (stories 5 and 6 verified below and in their reviews), but the
   practice the row asks for was not applied in the same commit. Add it to that row as evidence; no new row needed.

## Verdict
**PASS**

The record now matches what shipped. The task routes are inside the rule (story 6), so frame bullet 2 holds, and the
presets sentence is accurate. Story 4 is Done.

## On PASS
- [x] Story `**Status:**` flipped to `Done` in place (and the epic's line for story 4).
- [x] Completion detection performed; the result is reported in the hand-off, not in this file.
