# Review: Story 5 — The auth middleware judges paths case-insensitively, as Express routes them

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** `git show 3ace19de` (the fix on `staging`; the same change reached `main` as `87b01caa`, PR #839, merge
`c2553c2d`) and `git show 0f028254` (the record: story, test plan, book, ledger). Read on `staging` at `0f028254`.
Shipped as a hotfix before its record; this is the first independent read.

## What was wrong (now fixed on production)

Express 4 matches routes case-insensitively, and `bin/control-panel.js` does not change that. So `/API/run-task`,
`/Api/run-task` and `/api/RUN-TASK` all reach the handler registered at `/api/run-task`. The central auth middleware
compared `req.path` case-sensitively. Two things followed:
- It skipped every path that did not start with lowercase `/api/`. A request whose prefix was capitalized therefore
  reached the route with no central check at all: no default-deny for anonymous mutations, no owner-only lists, no
  protected GETs.
- Its list matches were case-sensitive too. With capitals after `/api/`, a signed-in non-owner got past the owner-only
  lists, and a visitor got past the protected-GET list. Default-deny still caught anonymous mutations in that case.

The hole affected only routes that relied on the middleware alone. Routes with their own guard (story 4's sync guard,
the `requireOwner` routes) were not affected. I raised it privately in story 4's review (round 1, non-blocking 7). It
was fixed on production by deploy run 143 before this file was written.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** `npm run gate:status -- --label reviewer-sae4-6-r2`:
      `20261010T050008Z-10501-dbeb [reviewer-sae4-6-r2] started 2026-10-10T05:00:08.729Z on 0f028254 — PASS, exit 0, 5548 passed, 0 failed, 582 skipped, 293/293 suites`.
      The `tagging-edges-realtime-wrapper` RW7 flake did not appear.
- [x] Focused suite `node -e "require('./test/auth-path-case.test.js').run()"` — 5 passed, 0 failed.
- [x] Fails before the fix, as the test plan says. I ran the suite against `dc318717` in a detached scratch worktree,
      since removed: 1 passed (P4), 4 failed (P1, P2, P3, P5).
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), exit 0.
- [x] Live, anonymous, side-effect-free, on production and staging:
      - capitalized `POST /API/run-task` with no task name → 401 (the handler would answer 400 and do nothing);
      - `GET /API/relays` → 200 (a public read stays public);
      - `GET /API/strfry/negentropy-presets` → 401.
- [x] Shipping facts: PR #839 merged into `main` as `c2553c2d` (GitHub REST, 2026-10-10T04:20:06Z). Deploy run 143 on
      `c2553c2d` completed successfully. `staging` has `3ace19de` (staging deploy run 563).
- [ ] `npm run test:playwright` — not applicable (no UI change).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test:
      - AC-1: P1 (five spellings of `/api/run-task`, 401, handler not reached).
      - AC-2: P2 (four spellings of `/api/backups`).
      - AC-3: P3 (owner-only POST and GET, including `/toggle-strfry-filteredContent`, whose listed name has capitals).
      - AC-4: P4 (public reads, `/api/auth/*`, the two public mutations and a page, each capitalized).
      - AC-5: P5 (`req.path` read once, lowercased).
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

## ADR adherence
- [x] No ADR. Architecture was skipped as an obvious bug fix inside one function, which the strictness table allows
      for bugs. The diff touches only `src/middleware/auth.js` (`authMiddleware`), the new suite and `test/registry.js`.
- [x] No new dependencies.

## Concept-graph integrity
- [x] No concepts, handles, event kinds or firmware touched. No reinstall needed.

## Things tests can't catch

**Does lowercasing widen access anywhere?** No. Every decision is now made on `lower(P)`, and the middleware gives
request path `P` exactly the answer the old code gave `lower(P)`. Express routes `P` and `lower(P)` to the same route,
because literal segments match case-insensitively. Only parameter values keep their case. Anything a caller can reach
now by capitalizing, they could already reach by sending the lowercase spelling, except where a parameter's case
matters. I checked each decision in turn:

- **`authenticatedEndpoints` (`auth.js:376-387`).** This is the signed-in early pass on any path containing
  `/negentropy-sync`. It now also matches capitalized spellings. That matters only where a parameter segment could
  carry the substring into a path that an owner-only or protected entry would otherwise catch. No such route exists:
  - the parameterized mutating routes are `concept/:handle/*`, `io/imports/:tempId/execute`, `tapestry-key/*` and
    `settings/*`, and none contains an owner-only entry;
  - no owner-only or protected GET route has a parameter.
- **`customerOrOwnerEndpoints` (`auth.js:389-392`, `:447-457`).** Matching more spellings sends more requests into the
  owner-or-customer check, which is stricter, not looser. One overlap predates this story: `/get-customer` is a prefix
  of `/get-customer-relay-keys`, so an active customer skips the owner-only GET list on that path. That is harmless:
  the handler checks for the owner or an admin itself (`src/api/customers/queries/get-customer-relay-keys.js:18-31`).
- **`PUBLIC_MUTATIONS` (`auth.js:505-506`).** This is still an exact match, now on the lowercased path. A capitalized
  `/API/STRFRY/PUBLISH` reaches the same handler, with the same handler gates, as `/api/strfry/publish`. Before the fix
  it skipped the middleware entirely, so this is not a widening. A trailing slash now gets 401 (stricter).
- **The direct-local branch (`auth.js:366-369`).** A loopback request with no forwarding header and a capitalized
  prefix now gets `req.localTrusted`. Direct-local callers are already trusted on every lowercase `/api/` path, so
  this changes nothing.
- **The `/api/auth/` early pass (`auth.js:339`).** Every handler under `/api/auth/` was already skipped by the
  middleware in lowercase, and the capitalized prefix was skipped before too.

**Is there any other path-based security decision?** No.
- `bin/control-panel.js:382-396`: the honest-404 middleware and the SPA catch-all test `req.path.startsWith('/api/')`
  case-sensitively. They are not access decisions, and they are registered after the API routes.
- `src/api/open-ranking/index.js:38` (formats errors) and `src/utils/siteTrust.js` (classifies 404 probe paths) only
  shape responses.
- The two `express.Router()` instances (`src/api/task-analytics/index.js:2`, `src/api/task-watchdog/index.js:2`) have
  no routes on them, so their `caseSensitive` option is moot.
- BullBoard's mount (`app.use('/admin/queues', requireOwnerOrAdmin, …)`) matches case-insensitively, and its guard
  runs first.
- No handler compares `req.path`, `req.url` or `req.originalUrl` for access.

**Encoded, double-slash and dot paths.** I ran these locally through the real middleware and Express:

| Request | Result |
|---|---|
| `POST //api/run-task` | 404: the middleware skips it, but no route matches |
| `POST /api/run%2Dtask` | 404: Express matches route literals against the raw path, so an encoded literal does not route |
| `POST /api//run-task` | 401 anonymous |
| `POST /api/./run-task` | 403 signed in |
| trailing slash | 401 anonymous, 403 signed in |

In front of the app, `docker/nginx.conf`'s `location /` uses `proxy_pass http://127.0.0.1:7778/`. Because that has a
URI part, nginx forwards the normalized URI: slashes merged, dot segments resolved, case unchanged. The three exact
`location` blocks (firmware install, scan count, scan stream) forward to the same app. A capitalized variant falls to
`location /` and is judged the same way.

**Unicode.** Node decodes the request line as latin1, and no latin1 character lowercases to ASCII. Express's
case-insensitive route regexes (flag `i`, no `u`) never match a non-ASCII character to an ASCII one. So
`toLowerCase()` and Express agree.

**Other checks.**
- [x] No secrets in the diff.
- [x] No debug logging added.
- [x] No commented-out code.
- [x] Concurrency: the change is pure string handling, with no state.

**Is P1–P5 enough?** Yes, for the five ACs, and P1–P4 run the real middleware in front of real Express routing. The
gaps are in non-blocking 2.

**Separate from this diff — reported privately, not described here.** While auditing I found another pre-existing
weakness in the central auth middleware. It does not involve letter case, and these diffs did not introduce it. Because
it is open, this public file does not describe it; I have reported it privately to the coordinator. It does not affect
story 4's guards or story 6's routes.

## House rules check
- [x] Concept Graph API authority respected (not touched).
- [x] No new lint/typecheck/build tooling. The owner chose not to turn on case-sensitive routing; that is carried as
      ledger row `2026-10-10-case-sensitive-routing`, whose facts I checked (the capitalized registered paths
      `get-`/`toggle-strfry-filteredContent`, `src/api/index.js:271-272`).
- [x] TA pubkey not involved.

## Product-guide adherence
- N/A: no-PRD book.

## Findings

### Blocking
None.

### Non-blocking
1. **`engineering-team/stories/security-auth-exposure/5-paths-judged-case-insensitively.md:23`.** "nginx's
   `location /` forwards every path unchanged" is true for case, which is what matters here. But nginx does normalize
   the path: it merges slashes and resolves dot segments. Optional: "forwards every path with its case unchanged".
2. **Test coverage gaps (the ACs are still met).**
   - No test covers the direct-local branch, `customerOrOwnerEndpoints` or `authenticatedEndpoints` under capitals, or
     a trailing slash. I checked them by reading the code and with the local runs above.
   - P5 counts `req.path` only, so a future comparison on `req.url` or `req.originalUrl` would get past it.
3. **`src/middleware/auth.js:389-392` — the `/get-customer` prefix overlap** described above. It predates this story
   and is harmless today because the handler checks the caller itself. It belongs in the authenticated-non-owner sweep
   (`stories/_intake.md` 2026-07-21), not here.

### Harness friction
1. None new. The frame bullet for this story was ticked before review; that is recorded in story 4's round 2 against
   the existing row `2026-10-10-frame-ticked-before-review`.

## Verdict
**PASS**

The fix is small and correct, and it widens nothing. Every path test now runs on one lowercased copy against lowercased
entries. That matches how Express routes, and production confirms it: capitalized task POSTs answer 401. Story 5 is
Done.

## On PASS
- [x] Story `**Status:**` flipped to `Done` in place (and the epic's line for story 5).
- [x] Completion detection performed; the result is reported in the hand-off, not in this file.
