# Review: Story 8 — Every admin action checks who is asking (the sweep)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** the working tree on `staging` against `ad61b9ad` (Phase 3, tests). Not yet committed. It contains `git diff`
of `src/middleware/auth.js`, `src/utils/config.js`, `src/api/strfry/commands/publishEvent.js`,
`src/api/settings/settingsApi.js`, `src/api/openapi.yaml`, `test/registry.js` and the story's `## Deviations`, plus
the new files `src/middleware/routeAccess.js` and `test/admin-action-sweep-named.test.js`.

**Disclosure (book ground rule 1).** Members of this class are still open on production, so this review names no
still-open route, handler file or line. It refers to routes only by class. Every finding that needs names, and the full
old-versus-new behaviour table, are in the private notes. The named inventory is committed with the fix
(`engineering-team/audits/admin-action-owner-check/inventory.md`); the private notes stay private, because one of their
findings is not fixed by this change.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** `npm run gate:status`:
      `20261010T225218Z-2967-fdbe started 2026-10-10T22:52:18.152Z on ad61b9ad+dirty — PASS, exit 0, 5587 passed, 0 failed, 582 skipped, 298/298 suites`.
      An earlier run, `20261010T224631Z-30352-3e98`, failed only on `tagging-edges-realtime-wrapper` RW7: a restart
      came after 0.77 s against a 0.8 s floor. That is the known timing flake reviews 4–7 mention, and I was running a
      CPU-heavy probe at the same time. The clean rerun, with nothing else running, is the one quoted above.
- [x] Focused suites, inside that run: `admin-action-sweep` 9/0, `admin-action-sweep-access` 13/0,
      `admin-action-sweep-named` 6/0. The nine re-aimed suites (`default-deny-mutations`, `dictionary-wired-create`,
      `dictionary-edit-concept`, `dictionary-resync-concept`, `curated-dlist-update-publish`,
      `author-scoped-inspection-roster`, `task-routes-owner-admin`, `tagging-edges-wiring`,
      `tagging-edges-drift-route`) and the older owner-gate suites (`strfry-wipe-owner-gate`,
      `strfry-router-owner-gate`, `one-writer-assistant-profile`, `create-tapestry`, `auth-head-requests`) all pass.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), exit 0.
- [ ] `npm run test:playwright` — not applicable (no UI change; AC-8).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Independent verification (beyond the suites)

All of this was done stack-free, in child processes, with the registration's side effects stubbed as
`test/helpers/routeWalk.js` stubs them. No router file was written.

1. **Re-derived inventory (AC-6).** I ran the route walk myself: 383 registrations, 382 distinct keys (one route is
   registered twice), 218 GET, 160 POST, 3 PUT, 2 DELETE. Every walked key has a table entry, and every table key
   matches a registration, except the eight that come from the entrypoint's static list and the conditional mount.
   **Conditional registration:** I grepped every registering module in `src/api` and `bin/control-panel.js` for
   environment and config checks, `if`/`try` blocks around registrations, and early returns. The only flag-gated
   registration is the task-queue dashboard mount. It sits outside the API prefix behind its own owner-or-admin guard,
   and the table keys it. Routes built in loops are seen by the walk.
2. **Behaviour diff, old middleware (`git show HEAD:src/middleware/auth.js`) vs new.** Both ran in front of marker
   handlers on every walked route, over 27,072 requests. Each path was sent as registered and fully uppercased, under
   GET, HEAD, POST, PUT, DELETE and PATCH. Six callers: a visitor with `X-Forwarded-For`, a signed-in stranger, an
   active customer, an admin, the owner, and a direct-local caller. The owner and admin came from the real check
   through the conf seam.

   | Outcome | Requests |
   |---|---|
   | The owner, an admin or a direct-local caller lost anything | **0** |
   | Anyone gained access, or a request reached a different handler | **0** |
   | Reached a handler before, refused now | **418**, across 67 routes (below) |
   | Refused before and after, different status | 7,062. All are a method and path with no registered route: 404 becomes 401/403 (fail-closed, ADR 0005 Consequences) |
   | Refused before and after, same status, new body | 3,252. All are the refusal-body change AC-7 asks for |

   The 418 break down like this:
   - **142 are class-A closures.** They cover exactly the Architect's 28 class-A routes (29 registrations): no member
     missed, none extra. Three of them (the two GETs that act and one other action) were reachable by visitors and
     now answer 401. All 28 now answer 403 to strangers and customers.
   - **36 are the closed sensitive reads.** Owner's decision 5 closed two reads, which are three registrations. Each
     now answers 401 to a visitor and 403 to a stranger or customer.
   - **240 are on 36 routes behind a route guard or handler check** that already refused the same callers,
     with the same status apart from the exception below (8 `requireOwner`, 4 `requireOwnerOnly`,
     3 `requireOwnerOrAdmin`, 8 `requireSyncManager`, 1 `requireOwnAssistant`, 12 handler checks). The middleware now
     refuses first; only the body differs. **One exception:** an already-guarded action whose handler also admitted a
     customer acting on their own record now refuses customers. No page offers it to them, and it is consistent with
     the approved allowlist ("nothing else is open"). See Non-blocking 2.

   No read that a visitor or a stranger reached before is lost, other than the closed reads. No allowlisted action is
   lost to the people it names.
3. **Allowlist (AC-4).** The table's signed-in actions are exactly S1–S17: 27 registrations, none extra, none missing.
   Its public actions are exactly the seven decided ones (the sign-in handshake including sign-out, the client-signed
   publish, and the read backbone). I read the handler of every allowlisted action. Each one is bound to the session
   or to the session's own assistant. The one wording problem is in Non-blocking 3.
4. **Public reads that might act.** I collected every public or signed-in read's handler source with my own walk and
   scanned it, and the same-file helpers it calls (two levels deep), for writes, exec/spawn, scheduling and publishing.
   Then I read every hit. All are status queries, scans, counts or searches, and the light work some of them do falls
   under the owner's judgment call 7 ("public scans and searches stay reads"). One deserves its own follow-up
   (Non-blocking 4). I found no GET that acts keyed as a public read.
5. **Bypass probes.** I ran the new middleware with real Express dispatch, in production middleware order (cors, json,
   urlencoded, session, auth), and sent 7,004 raw-socket probes at every non-public route: capitalisation, trailing
   slash, HEAD, encoded letters, `%2F`, leading and middle double slashes, `;`, `.` and `..` segments, query strings,
   absolute-form request targets, fragments, backslashes, `%09`, three method-override headers, and `_method`. No
   probe reached a guarded handler. Method-override headers reach only the route's own public GET sibling, and no
   override middleware is installed. **Agreement check:** I sent the same variants as the owner, under five methods,
   on all 382 keys: 4,507 dispatches. The access the middleware computed from the path it saw was never less strict,
   and never stricter, than the table access of the route Express actually ran. The middleware is mounted at the root,
   so `req.path` and the router read the same `parseurl` pathname, and nothing in between rewrites the URL or the
   method. **Direct-local** still requires a loopback peer *and* no forwarding header. `trust proxy` is off. Every
   nginx location that proxies to the app sets `X-Forwarded-For`, so a remote caller cannot pose as local.
6. **Parameter-level rules (owner's decision 3).** I drove the real handlers through the conf seam:
   - Publish: an admin signing as the assistant gets 403 with no key read. The owner and a direct-local caller are
     allowed. A session carrying the owner's pubkey without `authenticated` gets 403. A `signAs` with different casing,
     or given as an array, falls to "unknown signAs".
   - Settings: an admin's update or reset that touches the admin-list key gets 403 and nothing is written, and this
     covers urlencoded bodies and Express-decoded reset paths. Prototype keys, dotted keys, leading dots and trailing
     slashes leave the admin list unchanged. No other writer of the settings file can reach that key. There is no
     whole-object reset route.

## Spec adherence
- [x] Every acceptance criterion has a passing test or a planned live check:
      - AC-1: `AC1`.
      - AC-2: `AC2`.
      - AC-3, owner and admin against the real check: `AC3`, `AC3b`, `N5`, `PARAM*`.
      - AC-3, the instance's own scripts end to end: a live check at deploy (test plan "Live / manual"). The
        direct-local branch is unchanged, and the behaviour diff shows a direct-local caller lost nothing.
      - AC-4: `T3`, `AC4` ×2, plus my allowlist-equality check.
      - AC-5: `AC5` ×2, and `N2` for the closed reads.
      - AC-6: `W1`, `AC6a`, `AC6b`, `T2`, `T4`–`T6`, plus my re-derivation.
      - AC-7: `AC7`. The API reference states the rule and both answers for every owner's-side action entry it has,
        with five task-control entries added. I checked every operation's 401/403 against the table: none missing.
      - AC-8: no `ui/` or `public/` change.
      - AC-9: deploy-time live probes (see "Before shipping").
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story. The one customer-facing narrowing (Non-blocking 2) follows from the
      approved allowlist.

## ADR adherence
- [x] Files match ADR 0005's implementation notes: the new table module, the central check in the order Decision 2
      sets, the conf-path seam, the two parameter checks in their handlers, and the API reference.
- [x] Layering is as decided. The table uses Express's own `path-to-regexp` with Express's route options, the strictest
      match wins, and no match means the owner's side. Keys and `why`s are validated at module load, and patterns are
      compiled lazily, once. The six lists are deleted. The customer-or-owner quirk is carried unchanged, keyed by its
      registered routes. Route guards and handler checks are kept. The refusal texts are Decision 2.6's, word for word.
- [x] No new dependencies.
- [x] The deviations are logged and acceptable:
      - `resolveRouteAccess` returns a string.
      - `matchesRoute` is exported.
      - Not keyed: the app-shell catch-all and the static/docs mounts, which are registered before or after the check
        and never judged by it.
      - The module-local owner check in the publish handler (Non-blocking 1).
      - The held suite's HEAD probe edit (Non-blocking 6).

## Concept-graph integrity
- [x] No concepts, handles, event kinds or firmware touched. No reinstall needed.
- [x] Not applicable: no code orients through the Concept Graph here.

## Things tests can't catch
- [x] No secrets, no hardcoded TA pubkey (no 64-hex literal in the diff), no debug logging, no commented-out code.
- [x] Fail-closed by construction. An unknown access value falls through to the owner check, and a request no entry
      matches is the owner's side's.
- [x] No race. The only shared state is the lazily compiled pattern map, which is built synchronously.
- [x] CLAUDE.md principles:
      - Client-signed publishing stays open to everyone, visitors included (principle 2; `PARAM1b` and the behaviour
        diff).
      - Nothing is gated per POV.
      - Nothing local-first is touched (principle 4): the change is access control only, with no data path.
- [x] `src/utils/config.js` is minimal: one line plus its doc comment. The debug handlers that read the conf file
      directly are left alone, as the ADR says.
- [x] `src/api/openapi.yaml` parses as YAML (3.0.3). The changed descriptions keep their original text and add the
      rule. Every owner's-side action entry has 401 and 403. One `$ref` to a missing schema predates this diff.

## House rules check
- [x] Concept Graph API authority respected (not applicable).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] Not applicable (no PRD; no UI change).

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/strfry/commands/publishEvent.js:33`** — The module-local `isOwner` is correct (owner session only; admin
   refused; direct-local allowed). But it reuses the name of the widely imported owner-or-admin alias with the
   opposite meaning, so a later "tidy-up" that imports the alias again would silently re-admit admins. As a result,
   `test/one-writer-assistant-profile.test.js:184-185` now stubs an import this module no longer makes, and its comment
   at `:478` (an admin passes the signer's owner gate) is no longer true. **Recommendation:** rename the local check
   (e.g. `isTheOwner`), and have the Tester re-aim `test/create-tapestry.test.js:293` (R3 pins the literal
   `isOwner(req)`) and fix the one-writer stub and comment. I would not re-aim the older router and wipe gate suites:
   their modules rightly keep the owner-or-admin alias.
2. **A customer loses one self-service action.** An already-guarded action whose handler admitted a customer acting on
   their own record is now owner's-side. No page offers it to customers, and it follows from "nothing outside S1–S17
   is open". Tell the owner at the gate, and add an allowlist entry later if they want it back. Names are in the
   private notes.
3. **One allowlist entry's `why` overstates its binding.** It says the event is one "you signed yourself". The handler
   verifies the signature but does not bind the signer to the session, so a signed-in person can relay anyone's
   validly signed event of that kind. Principle 2 allows that, but the `why` should say so.
4. **One public read deserves a follow-up look.** It predates this diff, and judgment call 7 keeps it a read. Details
   are in the private notes; the coordinator carries it as a ledger row.
5. **`src/middleware/routeAccess.js:516-520`** — For HEAD, if any `HEAD` key matches, the `GET` keys are ignored.
   Express can dispatch HEAD to an earlier-registered GET route, so a future explicit HEAD route could resolve less
   strictly than Express dispatches. No HEAD routes exist today, so this is latent. Fix: take the strictest access over
   the HEAD and GET matches together.
6. **`test/admin-action-sweep-named.test.js:105-106,120`** — Phase 4 edited the Tester's held suite. The edit is
   correct: a HEAD response never carries a body, so the original assertion could not pass, and I confirmed the HEAD
   refusals independently. It is logged in Deviations. Still, `roles/implementer.md` says a wrong test goes back to
   the Tester, so the Tester should ratify it.
7. **`test/admin-action-sweep-access.test.js:211`** — PARAM1's direct-local scenario runs but its result is never
   asserted, although the test plan lists it as coverage. I ran it myself: allowed. Assert it.
8. **Housekeeping.** The named suite's header still says "HELD … do not commit". The git-ignored
   `test/admin-action-sweep-named.test.js.held` copy should be deleted once the fix is committed. The private
   inventory is not in the diff. The story allows committing it after the fix ships; decide then whether to trim its
   exploit detail.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*
1. **A held suite cannot be run green before Phase 4.** This story's named suite was never run against a candidate
   fix, so its defect surfaced in Phase 4, where the Implementer may not edit tests. The structural suite *was* run
   against a scratch candidate. Make that a rule for held suites: the Tester runs them against a scratch candidate
   before the Test Design gate.
2. **The `tagging-edges-realtime-wrapper` RW7 timing flake has no ledger row.** Four reviews in this epic note it "did
   not appear", and it failed this review's first full run under load. Give it a row, and widen or condition its
   0.8 s floor.

## Before shipping (AC-3 live, AC-9)
- The fix commit (table, API reference, named suite) names every class-A route and the closed reads. Do not push it to
  a public branch before production has it: land production first, or push every branch in one round (AC-9, book
  ground rule 1).
- After each deploy (production, `staging`, `feat/tags`, `feature-magic-carpet`), confirm:
  - a visitor gets 401 on a fixed mutation and on a fixed GET that acts;
  - the firmware-install bridge and a loopback scheduled job still work.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result is reported in the chat, not in this file.

## Addendum — after the owner's Review gate (2026-10-10)

The owner approved the release (production merge included), kept closed the customer self-reset (Non-blocking 2),
and had the coordinator fold four small findings in before shipping. Each is covered by the gate:

- Non-blocking 3: the allowlist entry's `why` now says it relays any validly signed event of that kind (principle 2).
- Non-blocking 5: for HEAD, `resolveRouteAccess` now takes the strictest access over the HEAD and GET matches together.
- Non-blocking 7: PARAM1 now asserts that a direct-local caller may sign as the assistant.
- Non-blocking 8: the named suite's header no longer says it is held.
- Non-blocking 6: the coordinator ratifies the HEAD-probe edit to the named suite on the Tester's behalf (a HEAD
  response never carries a body); recorded here rather than in a second Test Design round.

Carried as ledger rows: the publish handler's local owner check rename (Non-blocking 1), the public read in
Non-blocking 4, and the two harness notes.
