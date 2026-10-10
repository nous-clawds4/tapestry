# Review: Story 7 — The auth middleware judges a HEAD request as it judges a GET

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** `git show d0c2e8ff`, the fix and its suite on `staging`. The same patch reached `main` as `e974d497` (PR #841,
merge `c0aa8d1d`). The two commits' `src/` and `test/` patches are identical, and
`git diff origin/main staging -- src/middleware/auth.js test/auth-head-requests.test.js` is empty. Also read: the record,
`git show deca5b15 -- engineering-team/stories/security-auth-exposure/7-head-judged-as-get.md` and its `.test-plan.md`,
and `git show 50117a3c`. Read on `staging` at `deca5b15`. The fix shipped as a hotfix before its record; this is the
first independent read of either.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** `npm run gate:status -- --label reviewer-sae6r2-7`:
      `20261010T145542Z-14650-1898 [reviewer-sae6r2-7] started 2026-10-10T14:55:42.855Z on deca5b15 — PASS, exit 0, 5553 passed, 0 failed, 582 skipped, 294/294 suites`.
      The `tagging-edges-realtime-wrapper` RW7 flake did not appear.
- [x] Focused suites: `auth-head-requests` 5 passed, 0 failed, 0 skipped; `auth-path-case` 5 passed, 0 failed;
      `task-routes-owner-admin` 5 passed, 0 failed; `negentropy-sync-access` 10 passed, 0 failed;
      `negentropy-sync-presets` 95 passed, 0 failed.
- [x] Fails before the fix, as the test plan says. I ran the suite in a scratch worktree at `6c972fc8`, the fix's
      parent. H1, H2 and H5 failed: every HEAD in H1 and H2 answered 200 with the handler run, and H5 found two GET-only
      tests. H3 and H4 passed. Worktree removed.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), exit 0.
- [x] Live, anonymous, side-effect-free. Production and staging gave the same results:
      - HEAD `/api/personalized-pagerank` with no pubkey → 401. The handler would answer 400 and do nothing.
        Capitalized → 401. GET → 401.
      - HEAD `/api/backups`, `/api/restore/sets` and `/api/get-customer-relay-keys` → 401.
      - HEAD `/api/relays` → 200.
      - HEAD `/api/strfry/negentropy-sync/status`, `/count` and `/api/strfry/negentropy-presets` → 401. Route guards
        answer HEAD as they answer GET.
      - OPTIONS `/api/personalized-pagerank` → 204, from the CORS layer (below). A WebDAV-style method on the same path
        → 404.
- [x] Shipping facts:
      - PR #841 merged into `main` as `c0aa8d1d` (GitHub REST: 2026-10-10T14:45:24Z, head `hotfix/auth-head-requests`).
      - Deploy run 145 on `c0aa8d1d` completed successfully.
      - `staging` deploy run 567 on `d0c2e8ff` succeeded, and run 568 on `deca5b15`.
- [ ] `npm run test:playwright` — not applicable (no UI change).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test:
      - **AC-1: H1.** HEAD on `/api/backups`, `/api/restore/sets`, `/api/personalized-pagerank` and `/API/Backups`,
        not signed in → 401. Both the run counter and the response header show the handler did not run.
        `/backups/download` matches the same `/backups` entry. `/get-customer-relay-keys` goes through the same branch.
        Neither is tested on its own, which is fine.
      - **AC-2: H2.**
      - **AC-3: H3** covers the refusals. The pass side of GET is not exercised: owner and admin need
        `/etc/brainstorm.conf`, and no direct-local request is sent. For GET, though, `isRead` is true exactly when the
        old `req.method === 'GET'` was, so GET behaves as before by construction. A scratch probe of mine shows a
        direct-local HEAD on `/api/backups` reaching its handler.
      - **AC-4: H4.**
      - **AC-5: H5,** confirmed by my own read. `authMiddleware` has three method tests:
        - `isRead` (`src/middleware/auth.js:336`), used at `:482` and `:521`;
        - the POST-only owner list (`:466`);
        - the `MUTATING` list (`:508`).

        No GET-only test remains. See non-blocking 1 on H5's robustness.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.
- [ ] **The Out-of-scope section says more than is true.** See Blocking 1.

## ADR adherence
- [x] No ADR. Architecture was skipped for an obvious bug fix inside one function, which the strictness table allows
      for bugs. That is fair for a three-line change.
- [x] Files changed:
      - `src/middleware/auth.js` (`isRead` at `:335-336`; the two conditions at `:482` and `:521`);
      - the new suite;
      - its `test/registry.js` entry.
- [x] No new dependencies.

## Concept-graph integrity
- [x] No concepts, handles, event kinds or firmware touched. No reinstall needed.

## Things tests can't catch

**Is every method test in the middleware now right for HEAD?** Yes, apart from Blocking 1.
- The owner-only GET list (`:470-483`) and the protected GET list (`:513-522`) now test `isRead`.
- **The POST-only owner list (`:466`).** HEAD runs only GET handlers. In Express 4.21.2 a route answers HEAD with its
  GET handler when it has no HEAD handler of its own, and none is registered. Every owner-list entry that has a GET
  route falls into one of two groups:
  - a GET list names it (the backup and restore reads, and personalized PageRank);
  - it is a read meant to be public.

  There is one exception: Blocking 1.
- **Default-deny (`:501-510`)** lists POST, PUT, PATCH and DELETE. HEAD is a read, so it correctly falls outside it.

**OPTIONS never reaches a handler.** The CORS middleware (`bin/control-panel.js:117-122`, cors 2.8.5) runs with the
default `preflightContinue: false`. It answers every OPTIONS request 204 and ends it. That happens before the session,
before `authMiddleware` (`:323`) and before any route. Without it, Express 4's router would answer OPTIONS itself with
an `Allow` header, still without running a GET or POST handler.

I confirmed this with a scratch probe: the real `authMiddleware` and the app's CORS config, in front of dummy handlers
that count their runs. OPTIONS answered 204 and no handler ran, signed in or not. Live it answers 204.

**Other methods reach no handler.** Non-standard methods (PROPFIND, SEARCH, PURGE, LOCK, TRACE) pass the middleware,
because they are neither in `MUTATING` nor reads. But no `/api` handler accepts them:
- every `/api` route is registered with `app.get`, `app.post`, `app.put` or `app.delete`;
- there is no `app.all`;
- the one `app.use` mounted on a path is BullBoard at `/admin/queues`, and it is behind `requireOwnerOrAdmin`.

In the probe they answered 404 and no handler ran. Live they answer 404.

**No other place gates access by method.** Under `src/`, `req.method` appears only in `auth.js`, at the three places
above. The route guards (`requireOwnerOrAdmin`, `requireOwner`, `requireSyncManager`, `requireOwnerOrLocal`) and the
in-handler checks do not look at the method, so HEAD meets them exactly as GET does. `docker/nginx.conf` has no method
rules. No method-override middleware is installed.

**The Out-of-scope claim (Blocking 1).** I listed every owner-list entry against the routes registered for it.
- The sentence is right that no owner-only path has a PUT, PATCH or DELETE route.
- But one entry's only route is a GET that performs an administrative action:
  - the POST-only test never fires for it;
  - neither GET list names it;
  - default-deny does not count GET as a mutation.

  So GET, and now equally HEAD, reaches that action without a session.
- On production and staging it is inert, because what it drives does not work inside the container. An anonymous
  status read confirmed this: it reports every service inactive, including the control panel that answered the
  request.
- It predates this story. The pointer is with the coordinator.

**The Background's claims.** I verified each one:
- **Express answers HEAD with the GET handler.** True (4.21.2; the suite and my probe).
- **Personalized PageRank.** The handler runs `personalizedPageRankForApi.sh` through `execFile`, with a 170-second
  child timeout inside a 180-second request timeout (`src/api/algos/pagerank/commands/generateForApi.js:26-27`,
  `:63-66`). The script projects the follows graph into Neo4j's in-memory graph catalog and runs GDS PageRank over it.
  "Loading the follows graph into Neo4j" is a loose description of that projection, and acceptable.
- **Backups.** The list, download and restore-sets handlers only read. The two list handlers also create their
  directory if it is missing. With HEAD only headers go out: `Content-Length`, and for a download a 404 against a 200
  with `Content-Disposition`. That matches "only response headers leaked".
- **`/get-customer-relay-keys`.** Its handler checks for the owner or an admin itself
  (`src/api/customers/queries/get-customer-relay-keys.js:15-30`), so it was safe. True.

**Hygiene.**
- [x] No secrets in the diff.
- [x] No debug logging added.
- [x] No commented-out code.
- [x] Refusals reuse the middleware's existing 401 and 403 JSON answers; for HEAD the body is dropped.
- [x] Concurrency: a per-request boolean, with no state.

## House rules check
- [x] Concept Graph API authority respected (not touched).
- [x] No new lint/typecheck/build tooling.
- [x] TA pubkey not involved.

## Product-guide adherence
- N/A: no-PRD book.

## Findings

### Blocking

1. **`engineering-team/stories/security-auth-exposure/7-head-judged-as-get.md:46-47` — "so no other method slips past
   it" is not true.**
   - **What is true.** No owner-only path has a PUT, PATCH or DELETE route.
   - **What is not.** One owner-only list entry's only route is a GET that performs an administrative action. The
     POST-only test at `src/middleware/auth.js:466` never fires for it, and neither GET list names it. So GET and HEAD
     reach it without a session (see "The Out-of-scope claim" above). It is inert on production and staging, so this
     blocks the record, not the code.
   - **Why it blocks.** This story is about requests slipping past the middleware's checks by method. Its one sentence
     on any remaining method gap says there is none. The admin-action sweep would inherit the same blind spot: it is
     scoped as "every mutating endpoint (POST/PUT/PATCH/DELETE)" (`stories/_intake.md:1826`).
   - **Asked change** (record only; the code is correct and stays). Replace the clause with a true one that does not
     name the route. For example: "…today. The middleware passes a GET or HEAD to an owner-only path unless one of its
     GET lists names it. At least one owner-only entry's only route is a GET that performs an administrative action.
     That route, and any other GET that changes state or starts heavy work, belongs to the admin-action sweep
     (`_intake.md` 2026-07-21)." Add the same note to that intake entry, so the sweep's inventory covers GETs and not
     only the four mutating methods.

### Non-blocking

1. **`test/auth-head-requests.test.js:94-95` — H5 can pass vacuously.**
   - If `authMiddleware`'s header is reformatted (one space before the parenthesis), `indexOf` returns -1, the slice
     is empty, no match is found, and H5 passes. I confirmed this with a simulation.
   - It also matches only `req.method === 'GET'` written with single quotes.
   - H1 and H2 still catch a reverted `isRead` for their paths, so this weakens only the forward guard.
   - Optional: assert `start >= 0`, and that at least one GET test is found.
2. **Test plan, AC-3 row.** H3 covers only the refusals. No owner, admin or direct-local GET or HEAD is shown to pass.
   Accepted: it is the same `isOwner` limit as story 6's AC-3, and GET is unchanged by construction.
3. **Test plan coverage map.** It says H3 runs "GET on the same paths", but H3 uses two of H1's four paths. Trivial.

### Harness friction
1. **A third instance of a hotfix record generalizing past what was checked.** The PUT, PATCH and DELETE routes were
   checked, and the record concluded "no other method". Add it as evidence on
   `ledger/2026-10-10-after-the-fact-record-misses-siblings.md`; no new row is needed.
2. **The frame bullet for story 7 was ticked `[x]` before this review** (`audits/negentropy-sync-access/book.md`). What
   it states is true: a HEAD request is judged as its GET is, and it shipped as a hotfix. This is evidence for the
   existing `ledger/2026-10-10-frame-ticked-before-review.md` row; no new row is needed.

## Verdict
**CHANGES_REQUESTED**

The shipped code is correct, well pinned and should stay in production. Both GET-only checks now cover HEAD. OPTIONS
is answered by the CORS layer before any handler. No other method reaches a handler. GET answers as before. The block
is on the record: the Out-of-scope section says no other method slips past the POST-only owner list, and one GET does.
A one-sentence edit (Blocking 1), plus the matching note on the intake entry, fixes it.

## Close-out
- Story status stays In Progress until the record edit is reviewed.
- Completion detection was not run, because the verdict is not a pass.

# Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** `git show d5de18d9`: story 7's corrected Out-of-scope bullet, book decision 11 and two ledger rows. Read on
`staging` at `d5de18d9`. The commit is docs-only: `git diff --stat deca5b15 d5de18d9 -- src test bin scripts ui public`
is empty, so round 1's code verdict and gate run stand.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — not re-run, because no code changed since round 1's run on `deca5b15`:
      `20261010T145542Z-14650-1898 [reviewer-sae6r2-7] started 2026-10-10T14:55:42.855Z on deca5b15 — PASS, exit 0, 5553 passed, 0 failed, 582 skipped, 294/294 suites`.
- [x] `auth-head-requests` re-run as a spot check: 5 passed, 0 failed, 0 skipped.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), exit 0.
- [x] Live, anonymous, side-effect-free: HEAD `/api/personalized-pagerank` with no pubkey → 401 on production and
      staging.

## Blocking 1 — half resolved

Round 1's asked change had two parts: correct the sentence, and add the same note to the intake entry. I re-derived
the corrected bullet as a fresh claim.

**The sentence is now true** (`7-head-judged-as-get.md:46-50`).
- "The owner-only list matches POST only." True (`src/middleware/auth.js:466`).
- "No owner-only path is registered for PUT, PATCH or DELETE." True. The five PUT and DELETE routes under `src/api`
  contain no owner-list entry.
- "One owner-only path is served by a GET that can perform an action, so the list does not cover it." True, and "one"
  is exact. I matched every owner-list entry against the routes registered for it:
  - the other entries with GET routes are named by a GET list, or they are reads;
  - this one is neither.
- "It belongs to the sweep … by the owner's decision (2026-10-10)." That decision is recorded as book decision 11
  (`audits/negentropy-sync-access/book.md:59-61`).
- The bullet does not name the route. That matches round 1, which kept it unnamed as well.

**The intake note is missing.** `stories/_intake.md` is unchanged since `deca5b15`. The entry's Scope still says
"inventory every mutating endpoint (POST/PUT/PATCH/DELETE)" (`_intake.md:1826`).

This was the reason round 1 gave for blocking. Story 7 and book decision 11 now assign the GET-served path to the
sweep. But the document the sweep will be planned from still limits its inventory to the four mutating methods. So the
record contradicts itself across two files, and the sweep's own scope still has the blind spot.

## Findings (round 2)

### Blocking
1. **`engineering-team/stories/_intake.md:1826` (2026-07-21 entry) — the sweep's scope still excludes GET.**
   - **Asked change** (one dated addendum, record only). Example: "**Addendum (2026-10-10, story 7 review):** the
     inventory covers GET routes too, not only POST/PUT/PATCH/DELETE. The middleware's owner-only list matches POST
     only, and at least one owner-only path is served by a GET that can perform an action (`security-auth-exposure`
     story 7, Out of scope; book `negentropy-sync-access` decision 11). A GET that starts heavy work belongs in the same
     inventory."
   - Every factual clause in that example is checked above. Do not name the route there either.
   - Nothing else is needed for a pass.

### Non-blocking
1. **`ledger/2026-10-10-after-the-fact-record-misses-siblings.md:15-16`.** The new paragraph quotes story 6's first
   record as "cannot … publish signed exports or start syncs" and says other admin actions "could still do so". The
   "start syncs" part of that record was true: stories 4 and 6 closed it. The false parts were heavy recomputes and
   signed exports. Optional: quote "cannot run heavy recomputes, publish signed exports" instead.

### Harness friction
1. None new. `ledger/2026-10-10-review-files-committed-unscreened.md` covers the disclosure, and the
   after-the-fact-record row now carries stories 6 and 7.

## Verdict
**CHANGES_REQUESTED**

The story's sentence is now accurate. What remains is the matching one-paragraph note on the intake entry, so the
sweep's written scope agrees with the assignment this record makes.

## Close-out
- Story status stays In Progress until the intake note is added.
- Completion detection was not run, because the verdict is not a pass.
