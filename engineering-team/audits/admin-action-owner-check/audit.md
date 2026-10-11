# Build Audit: Every admin action checks who is asking — the sweep

**Book:** `engineering-team/audits/admin-action-owner-check/book.md`
**Date:** 2026-10-11
**Branch / commit range:** `staging` `9326094a^..4a3c529c`. The book's commits: story `9326094a`; batch 0 `651a35f1` and
its record `b0709bbc`; architecture `9186a8c2`; tests `ad61b9ad`; the fix, with the review, the inventory and the named
suite, `151e39fb`; record `4a3c529c`. The other fifteen commits in the range belong to `duty-menus-and-self-maps`.
Production: PR #844 (batch 0, merge `0c710d55`, deploy run 146) and PR #847 (merge `175cffa6`, deploy run 147). Sandboxes:
PRs #845 and #846 (batch 0; deploys 92 and 35), PR #848 into `feat/tags` (merge `1e888786`, deploy 93) and PR #849 into
`feature-magic-carpet` (merge `41fe9363`, deploy 36). Every merge and deploy was checked at this close through the GitHub
API: all merged, all deploys `success`.
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high. Every frame bullet is backed by a PASS review that re-derived it from the code, a green gate, a
successful deploy on all four sites, and live visitor probes recorded in story 8 § Shipped. Two claims are narrower than
the frame's words, and both are recorded rather than rounded up: the instance's own scripts are shown by code and by a
simulated behaviour diff, not by a recorded live run (§4 #5); and the gate names a new unsorted route only when it is
registered through the API's `register(app)`, not when it is added to the entrypoint file (§4 #6). Neither has a member
today.

> **Headline.** One route table now sorts every route the instance serves, and the central access check refuses
> anything the table does not open: 401 to visitors, 403 to signed-in people outside the owner's side, with a message
> naming who may act. All 29 registrations of class A (actions any signed-in key could reach, two of them GETs that acted
> for visitors too) closed in one release, on production, `staging` and both sandboxes, whose PRs merged within eleven
> seconds of each other. The hand-kept lists that missed a hole three times in one day are gone, and a gate test walks
> the real router and fails, naming the route, when a route is not sorted. A shell-input hotfix (batch 0) shipped first,
> inside the book. The book ran the full cycle in one review round. Its weak spots are process ones: holding a disclosing
> commit has no named state, the sandbox ports carried new decisions no Reviewer read, and batch 0 was never reviewed
> (§7).

## 1. What shipped

- **Every action is the owner's side's unless the route table opens it.** The owner's side is the owner, admins and
  direct-local callers (the instance's loopback scripts, scheduled jobs and the firmware-install bridge). Anyone else gets
  401 when not signed in and 403 when signed in, under any method (GET and HEAD included) and any spelling of the path. —
  `stories/security-auth-exposure/8-admin-action-sweep.md` (AC-1, AC-2)
- **What everyone else may do is written down once.** The table's `public` and `signed-in` actions are the allowlist,
  each with a `why`: seven for anyone (publishing an event you signed, the read backbone, the sign-in handshake) and 27
  for signed-in people (the point-of-view sync and actions on the person's own things, S1–S17 of the inventory). The owner
  approved every entry before Implementation. — story 8 AC-4; ADR `security-auth-exposure/0005`, owner's decision 2
- **Admins equal the owner, with two exceptions.** Signing as the instance's assistant through the client-publish route
  (`signAs:'assistant'`) and changing the admin list through a settings update or reset are the owner's alone, checked in
  their handlers. This settles OPEN.md row 269. — ADR 0005, owner's decision 3
- **Reads are unchanged, apart from two the owner closed.** The config peek (`GET /api/auth/test`) and the export list
  and download (`GET /api/io/exports`, `GET /api/io/exports/:filename`) are now the owner's side's. Task status,
  history and schedules stay public (owner's answer c). — story 8 AC-5; ADR 0005, owner's decision 5
- **The next route can't go unsorted quietly.** A request no entry matches is the owner's side's (fail closed), and the
  gate's router walk fails, naming `METHOD path`, for any registered route with neither a table entry nor a recognised
  owner's-side guard. It was shown with an added POST and an added GET that acts. — story 8 AC-6
- **Refusals say who may act**, for example "Only the owner or an admin can do this.", and the API reference states the
  rule and both answers on every owner's-side action entry, five task-control entries included. — story 8 AC-7
- **People who can't act see the bare 403.** No page changed (owner's answer b). — story 8 AC-8
- **Request values no longer reach a shell** in the eight files batch 0 changed: they run `strfry` and `node` with
  argument lists, and a pubkey a request supplies must be 64 hex characters (400 otherwise). — ledger
  `2026-10-10-request-values-reached-a-shell`; book decision 6
- **The owner and admin pass is tested against the real check.** `getConfigFromFile` honours `BRAINSTORM_CONF_PATH`,
  so a test can name an owner and admins and run the real `authMiddleware` and `isOwnerOrAdmin`. This closes the
  stand-in debt of audit `negentropy-sync-access` §5. — ADR 0005 Decision 5

## 2. Epics & stories rolled up

### Epic: `security-auth-exposure`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #8 admin-action-sweep | One route table and a default-deny access check; the allowlist; two owner-only parameter rules; the conf-path seam; the API reference; the router-walk gate test. Batch 0 rode in the book as an owner-approved hotfix | Done | `reviews/security-auth-exposure/8-admin-action-sweep.md` (PASS in one round, with an addendum after the owner's gate folding in non-blocking 3, 5, 6, 7 and 8) |

*(Stories #1–#7 belong to the Closed books `security-auth-exposure`, `auth-signature-verification` and
`negentropy-sync-access`; not re-audited here.)*

**Epic close-out.** The epic stays `Done`, as the book said it would; this book carried story 8's active-work signal
(OPEN.md row 268). All eight stories are Done, and story 8's code is on `main` (PR #847). **Its story, decision and
review folders stay outside `done/`**, for the reasons the last two closes recorded: there is no `done/security-auth-exposure/`
to move files into one by one, stories 1–7 already sit outside it by recorded choice, and moving the epic now would
rewrite every path citation to it. Lint does not depend on it: L2 checks the epic's Status. The epic file's story 8 line,
which still read Draft, now records the ship. Workflow 6 step 9 is still silent on this case (§7 #13).

## 3. As-built inventory

- **User-facing.**
  - Every API path outside the allowlist answers 401 to a visitor and 403 to a signed-in person outside the owner's side,
    with `{ success: false, error }` naming who may act. For HEAD the body is dropped.
  - An API path no route serves now answers 401/403 instead of 404, on every branch (ADR 0005 Consequences).
  - Pages that offer an action to people who can no longer take it still show it, and a click gets the 403: the DList
    page's Publish Trusted List and sync-to-Neo4j buttons, the legacy self sign-up as a customer, Relay Settings' sync
    panel and the task explorer's Run buttons (inventory § Judgment calls; audit `negentropy-sync-access` §3; owner's
    answer b).
  - A customer can no longer reset their own algorithm preset; no page offered it to them (review non-blocking 2, kept
    closed by the owner).
- **Server.**
  - `src/middleware/routeAccess.js` (new, 541 lines): `ROUTE_ACCESS` (390 keys on `staging`: 208 public reads, 18 owner
    reads, 1 signed-in read, 129 owner actions, 27 signed-in actions, 7 public actions, no `owner-only` entry),
    `ACCESS_ORDER`, `resolveRouteAccess(method, path)` and `matchesRoute(key, method, path)`. Patterns compile with
    Express's own `path-to-regexp` and route options; the strictest matching entry wins; HEAD takes the strictest over
    HEAD and GET entries together. Keys and `why`s are validated at load.
  - `src/middleware/auth.js` (`authMiddleware`): outside `/api/` → pass; direct-local → `req.localTrusted`, pass; the
    customer-or-owner quirk on three reads, carried unchanged and keyed by route; then the table. The six hand-kept lists
    (`ownerOnlyEndpoints`, `ownerOnlyGetEndpoints`, `protectedGetEndpoints`, `authenticatedEndpoints`, `MUTATING`,
    `PUBLIC_MUTATIONS`) and the blanket skip for the sign-in routes are gone (+54 −178).
  - `src/api/strfry/commands/publishEvent.js`: `signAs:'assistant'` for the owner and direct-local callers only.
    `src/api/settings/settingsApi.js`: an admin's update or reset that touches `adminPubkeys` is refused 403.
  - `src/utils/config.js`: the `BRAINSTORM_CONF_PATH` override. `src/api/openapi.yaml`: the rule and both answers on every
    owner's-side action entry (+612 −11).
  - Not keyed in the table, with the reason in its header: the app-shell catch-all (`GET *`) and the static and API-docs
    mounts. The task-queue dashboard mount is keyed (`USE /admin/queues`, owner).
  - Batch 0: `src/api/export/profiles/queries/kind0.js`, `src/api/export/nip85/queries/info.js`,
    `src/api/export/nip85/commands/kind10040.js`, `…/create-and-publish-kind10040.js`, `src/api/profiles/fetchProfiles.js`,
    `src/api/notes/userNotesReadPath.js`, `src/api/feed/feedReadPath.js`, `src/api/_shared/relaySource.js`. The record
    claims these eight files, which `test/shell-input-hardening.test.js` I6 pins.
- **Sandbox ports.** Each branch has its own table, because each serves routes `staging` doesn't. `feat/tags`: 356 keys
  (2 added and 36 removed against `staging`; 11 signed-in actions); its avatar upload stays on the owner's side.
  `feature-magic-carpet`: 281 keys (20 added and 129 removed; 8 signed-in actions, three of them allowlist entries the
  owner approved on 2026-10-11 for the caller's own things); the route walker there stubs a branch-only module's database
  dependencies, and five older suites were re-aimed at routes that branch serves. Counts are from the branch tables at
  `origin/feat/tags` and `origin/feature-magic-carpet`.
- **Tests.**
  - New suites: `test/admin-action-sweep.test.js` (W1, AC6a, AC6b, T2–T7: the router walk, coverage, staleness, `why`s,
    resolver agreement, fail-closed, no open action outside `/api`, the lists deleted), `test/admin-action-sweep-access.test.js`
    (AC1–AC7 and PARAM1/1b/2/2b: the real middleware and handlers through the conf seam), `test/admin-action-sweep-named.test.js`
    (N1–N5, held until the fix shipped) and `test/shell-input-hardening.test.js` (I1–I6).
  - Helpers: `test/helpers/routeWalk.js` (the child-process walk of the real `register(app)`) and
    `test/helpers/accessHarness.js`; fixture `test/fixtures/admin-action-sweep/public-reads.json` (197 reads, the AC-5
    baseline).
  - Nine suites that read the deleted lists were re-aimed at `resolveRouteAccess`, with no status code weakened.
- **Domain.** No concepts, handles, event kinds or firmware touched; no reinstall.
- **Data & contracts.**
  - The route table is now a contract: every new route needs a table line, and each `public` or `signed-in` action needs
    a `why`.
  - The refusal body is `{ success: false, error }` for every refusal from the table.
  - The inventory, with names, is `engineering-team/audits/admin-action-owner-check/inventory.md`, committed with the fix.
    It carries no exploit detail for batch 0; it points at batch 0's ledger row.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 3: the allowlist "is explicit and kept in one place" | One table per live branch. `staging` and production share one; each sandbox has its own, and `feature-magic-carpet`'s adds three allowlist entries the owner approved on 2026-10-11 | constraint-discovered | Story 8 § Shipped ("Each sandbox serves routes staging doesn't, so each got its own table"); found after `staging` was committed (§7 #2) | What is open differs per deployment by the routes it serves. Within each deployment it is one place | Every later `staging` → sandbox merge must reconcile that branch's table (§6 #10) |
| 2 | Frame bullet 4: "Public reads stay public"; AC-5 | Two sensitive public reads (three registrations) are the owner's side's | intentional-change | ADR 0005, owner's decision 5; the AC-5 exception list the story allows | Visitors and strangers no longer see the config peek or the export list and download | — |
| 3 | Frame bullet 4: the owner's side loses nothing (customers are not the owner's side) | A customer lost the self-reset of their algorithm preset, an already-guarded action whose handler had admitted it | intentional-change | Review non-blocking 2; the owner kept it closed at the Review gate (review addendum) | No page offered it to customers | Seed §7 |
| 4 | Frame bullet 2: actions not on the allowlist refuse | Also: an API path no route serves answers 401/403 instead of 404, on every branch | added-beyond-scope (designed) | ADR 0005 Consequences ("fail closed") | An API client probing a missing route sees a refusal, not a 404 | — |
| 5 | Frame bullet 4 / AC-3: the instance's own scripts keep every action, "shown end to end" | The direct-local branch is unchanged and runs before the table; the review's behaviour diff (27,072 simulated requests) shows a direct-local caller lost nothing. The deploy-time live check of the firmware-install bridge and a loopback job, which the test plan put at deploy and the review's "Before shipping" asked for, is not in the record: § Shipped records visitor probes and the smoke tiers, which cover neither | interpretation (unrecorded verification) | Test plan § Live / manual; review § Before shipping; story 8 § Shipped | None known. A failure would show as a firmware install or a scheduled job that stops working. *(Gate, 2026-10-11: the loopback search-index refresh ran `success` on production at 01:09 UTC, after the deploy; the bridge is still unchecked.)* | Ledger `2026-10-11-instance-scripts-live-check-unrecorded` (§6 #4) |
| 6 | Frame bullet 5: "The test gate fails, naming the route, when an action is added without a guard or an allowlist entry" | True for every route registered through the API's `register(app)`, which holds every action today. The entrypoint's own routes are a literal list in the test (`ENTRYPOINT_ROUTES`), and nothing compares it with `bin/control-panel.js`. A new `/api/` route registered there after the access check still fails closed at runtime, but the gate would not name it; one registered before the access check, or outside `/api/`, would be judged by nothing | interpretation (latent; no member) | ADR 0005 calls it a static scan; the test's list was taken by hand once. This close compared it with `bin/control-panel.js`: it matches, and all eight routes are reads or pages | None today | Ledger `2026-10-11-entrypoint-routes-hand-listed` (§6 #3) |
| 7 | Frame bullet 7: "No route this book fixes is named in public before its fix is in production" | Met in the one-round sense the review offered ("land production first, or push every branch in one round"). The fix was public for about eight minutes before production had it: the `staging` push started deploy run 590 at 00:09:24 UTC, the three PRs opened from 00:09:38, merged from 00:15:21 to 00:15:32, and production deploy run 147 finished at 00:17:37 | interpretation | Review § Before shipping; GitHub API times read at this close | A short window; a PR-gated flow can't close it to zero (§7 #1 names the one route that can) | — |
| 8 | AC-7: every API reference entry for an action guarded here states the rule | Done for every owner's-side action entry, with five task-control entries added. The saved presets list (a read) still has no entry | deferred | Story 8 § Deviations | Readers of the API reference don't learn the presets list's rule | Ledger `2026-10-10-negentropy-access-review-polish` |
| 9 | Frame bullet 6 / AC-8: the bare 403 now, the controls in a follow-up | As decided: no page changed | deferred | Owner's answer b | People see controls they can't use (§3) | §6 #1 |
| 10 | Owner's decision 3: two owner-only parameter rules, "checked in their handlers" | As decided. The publish handler checks with a module-local `isOwner` that means the owner only, while the shared `isOwner` means owner or admin | interpretation | Story 8 § Deviations; review non-blocking 1 | None; a later edit could re-admit admins by importing the shared name | Ledger `2026-10-10-publish-local-owner-check-name` |
| 11 | ADR 0005 Out of scope: the customer-or-owner quirk | Carried unchanged: a signed-in person who is neither the owner's side nor a customer is refused three reads that visitors get | deferred | ADR 0005 Decision 2.3, Out of scope | Signing in can lose a read | §6 #2; seed §7 |
| 12 | Book decision 6: batch 0 shipped ahead of the Architecture gate | A hotfix in eight files with a new suite, shipped everywhere on 2026-10-10. No story, test plan or review covers it; its record is a ledger row | added-beyond-scope (owner-approved) | Book decision 6; ledger `2026-10-10-request-values-reached-a-shell` | Malformed pubkeys get 400 where they reached a shell string | Process: §7 #3, #10 |
| 13 | Story 8 Out of scope: case-sensitive routing and the redundant sync entries | The redundant entries went with the other lists; case-sensitive routing is still not on | deferred (half done) | ADR 0005 Decision 2.5 | None | Ledger `2026-10-10-case-sensitive-routing` |

**Undocumented work.** No code change lacks provenance. Every `src/` file in `151e39fb` is named in ADR 0005's
Implementation notes, and batch 0's eight files are named in its ledger row. Records rode in phase commits, as follows:
- the review file, the inventory and four ledger rows in the `fix:` commit `151e39fb`;
- ledger row `2026-10-10-cross-site-request-settings-review` (an owner decision) in the `tests:` commit `ad61b9ad`.

**Unreviewed work.** PRs #848 and #849 carry decisions no review file covers:
- two branch-specific route tables, `feat/tags` and `feature-magic-carpet`;
- three new allowlist entries on `feature-magic-carpet`, owner-approved;
- on `feature-magic-carpet`, walker stubs and five re-aimed suites.

Story 8 § Shipped describes them, and no CI ran on either PR (no check runs). This close counted the two tables and
listed the levels of their branch-only keys. It did not review their handlers. Batch 0 is the other unreviewed change
(#12).

## 5. Quality state at close

- **Test gate (final tree, after the book flip and the epic housekeeping):** `npm run gate:status -- --label book-close-aaoc-final2`:
  `20261011T010631Z-28021-bbbe [book-close-aaoc-final2] started 2026-10-11T01:06:31.629Z on 4a3c529c+dirty — PASS, exit 0, 5587 passed, 0 failed, 582 skipped, 298/298 suites`.
  RW7 passed (`tagging-edges-realtime-wrapper` 24/0), and the link checks passed or skipped on no network, with no 5xx.
  An earlier run, `20261011T010359Z-22133-2c0b`, was stopped by the Reviewer at 123/298 because this close's text was
  still changing; it certifies nothing. Only this line changed after the final run started.
- **harness-lint (final tree):** `bash scripts/harness-lint.sh` → `harness-lint: clean (0 violations)`.
- **Gates recorded during the book:**
  - before the tests: `20261010T174820Z-10208-39f2` PASS 5559/0 (295 suites);
  - the intended red at Test Design: `20261010T182851Z-17286-344d` FAIL 5554/27, exactly the eleven intended suites;
  - review: `20261010T225218Z-2967-fdbe` PASS 5587/0, 298/298 suites, on `ad61b9ad+dirty`;
  - an earlier review run, `20261010T224631Z-30352-3e98`, failed only on the RW7 timing flake under load (§7 #6).
- **CI.** PR #847's `stack-free` and `main-source-guard` checks passed. PRs #848 and #849 have no check runs: no CI runs
  on PRs into sandbox branches (§7 #8).
- **Live checks.** Not re-run at this close. Story 8 § Shipped records visitor probes on all four sites after each
  deploy: 401 with a message naming who may act, on a fixed mutation, on a fixed GET that acts (GET, HEAD and a
  capitalised spelling) and on the two closed reads.
- **On `staging`, not yet on `main`:** this book's records (story, ADR, test plan, review, inventory, ledger rows) and
  this close. `src/`, `bin/` and `scripts/` are identical on the two lines. In `test/` they differ only by the previous
  book's `50117a3c`.
- **Known open issues.** Three findings from the sweep are still open and are referred to only by their ledger ids:
  `2026-10-10-cross-site-request-settings-review`, `2026-10-10-public-read-follow-up` and
  `2026-10-11-sandboxes-lag-staging-safeguards`. Also open: io-import verification (OPEN.md row 276, F3; the access
  half of ledger `2026-10-02-io-import-unverified-any-session` is closed).
- **Debt, from ADR 0005 Consequences and the review:**
  - Every new route costs a table line, and reviewers must check that an action is not keyed as a read: no automated check
    can tell that a GET acts.
  - An Express 5 upgrade must revisit `app._router` in the walk and the matcher's options.
  - Strictest match wins: a public literal route shadowed by a stricter parameter route turns stricter. The agreement
    check (T4) catches it before shipping.
  - The customer-or-owner quirk; the duplicate registration of `POST /api/firmware/install`; case-sensitive routing.

## 6. Carry-forward register

- [ ] **1. What people who can't act should see.** The owner chose the bare 403 now and a follow-up story to hide or
      disable the controls everywhere at once. Affected today: the DList page's Publish Trusted List and sync-to-Neo4j
      buttons, the legacy self sign-up, Relay Settings' sync panel and the task explorer's Run buttons. (§4 #9; owner's
      answer b; seed §7)
- [ ] **2. The customer-or-owner quirk.** Signed-in non-customers are refused three reads that visitors get. Keep,
      widen or narrow: a product call. (§4 #11; ADR 0005 Out of scope)
- [ ] **3. The gate does not name a new route added to the entrypoint file.** Compare `ENTRYPOINT_ROUTES` with the
      registrations in `bin/control-panel.js` in the gate. (§4 #6; ledger `2026-10-11-entrypoint-routes-hand-listed`)
- [ ] **4. Confirm the instance's own scripts on a deployed site**: a firmware install through the bridge and one
      loopback scheduled job. (§4 #5; ledger `2026-10-11-instance-scripts-live-check-unrecorded`)
- [ ] **5. Remove the duplicate registration of `POST /api/firmware/install`.** (ADR 0005 Out of scope; ledger
      `2026-10-11-firmware-install-registered-twice`)
- [ ] **6. Rename the publish handler's owner-only check.** (§4 #10; ledger `2026-10-10-publish-local-owner-check-name`)
- [ ] **7. Case-sensitive routing as a second safeguard.** (§4 #13; ledger `2026-10-10-case-sensitive-routing`)
- [ ] **8. The saved presets list has no API reference entry.** (§4 #8; ledger `2026-10-10-negentropy-access-review-polish`)
- [ ] **9. The three findings still open**, by ledger id only: `2026-10-10-cross-site-request-settings-review`,
      `2026-10-10-public-read-follow-up`, `2026-10-11-sandboxes-lag-staging-safeguards`.
- [ ] **10. Every `staging` → sandbox merge reconciles that branch's route table** and runs the router walk there; no CI
      will do it. (§4 #1; story 8 § Shipped)
- [ ] **11. io-import verification** (F3). Only the owner's side can reach the import now, but it still imports without
      verifying. (OPEN.md row 276; ledger `2026-10-02-io-import-unverified-any-session`)
- [ ] **12. Open sign-in and rate limits.** Whether any nostr key may keep signing in, and limits on the allowlisted
      actions and on publishing one's own events. Both were out of scope. (story 8 Out of scope; seed §7)

*Earlier registers ticked at this close:* `audits/negentropy-sync-access/audit.md` §6 #1 (the sweep), #5 (a new sync
route must mount a guard: the table fails closed and the gate names it) and #7 (task reads stay public, owner's answer
c); `audits/security-auth-exposure/audit.md` §6 "Default-deny for authenticated-non-owner mutations";
`audits/event-authenticity/audit.md` §6 F4/F5; `audits/assistant-identification-tags/audit.md` §6 #11 (OPEN.md row 269);
`audits/relationship-primitives/audit.md` §6 "Wider authenticated-non-owner gap". Annotated, not ticked, because part of
each stays open: `negentropy-sync-access` §6 #3, #4 and #6; `auth-signature-verification` §6 F3–F5;
`sandbox-security` §6 "Out of scope". The answered questions in `negentropy-sync-access/prd-seed.md` §7 and
`security-auth-exposure/prd-seed.md` §7 are ticked the same way.

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-10-11, before this close):
- 1593 phase commits; the subject heuristic gives 20 to `security-auth-exposure` (19 at the last close). Of story 8's
  four phase commits only `story:` counts (#11 below).
- 285 reviews decided, with a headline kick-back rate of 1%; re-review churn 3.
- 9 books open (this one at 1 d) and 76 closed.
- Cycle-time median 0 d; story 8 (`admin-action-sweep`) reads 0 d, matched first→last rather than story→review.

This book's own record: one story, one review round, PASS, with five small findings folded in after the owner's gate.
The code passed its first independent read.

**What held.** Three lessons from the last book were applied as ground rules here, and each worked:
- the frame was ticked only after the review re-derived it (ledger `2026-10-10-frame-ticked-before-review`);
- the review named no still-open route and was committed with the fix (ledger `2026-10-10-review-files-committed-unscreened`);
- the Reviewer re-derived the inventory from the code, not from the list (ledger `2026-10-10-after-the-fact-record-misses-siblings`).
  Its behaviour diff found exactly the Architect's 28 class-A routes, none missed and none extra.

| # | Finding | Source | Terminal state |
|---|---|---|---|
| 1 | **Work held for disclosure has no named state.** The fix commit could not be pushed anywhere until every live branch was ready. The cloud environment's stop hook (configured outside the repo) asks at every turn end for everything to be committed and pushed, and the coordinator declined it by hand through about eight prompts, keeping the held suite out of its untracked check with a local git exclude. The held material (the named inventory, the held suite, the Reviewer's private notes) lived only in the container through three restarts, and two open rows still point at notes kept there. The record does not weigh the one route with no public window, a private fork. Ports to both flows | Coordinator's retro, lessons 1 and 4 (second half); §4 #7 | OPEN.md row `2026-10-11-disclosure-held-work-has-no-state` (meta; new) |
| 2 | **A disclosing fix needs per-branch preparation planned at Architecture.** Each sandbox needed its own route table (`feat/tags` +2 −36 keys; `feature-magic-carpet` +20 −129, three of them new allowlist entries, and a walk that was incomplete until a branch-only module's database dependencies were stubbed). The coordinator found this only after committing `staging`, then prepared both ports before pushing anything. The port decisions reached production with no review (§4, Unreviewed work). Ports to both flows | Coordinator's retro, lesson 2; story 8 § Shipped | **Harness commit `784d934d`** (operator-ratified 2026-10-11): the pitfall bullet in `workflows/2-architecture.md` and its CHANGELOG row |
| 3 | **A test passed over a broken change because the code under test returned early.** Batch 0's I4 asserted that no shell ran, and the handler returned before scanning when no owner was configured, so it passed over a ReferenceError the change had introduced (a response field naming a removed variable). The coordinator found the bug by reading the diff, then made the test configure the owner and assert the scan ran. Ports to both flows | Coordinator's retro, lesson 3; `test/shell-input-hardening.test.js` I4 | **Harness commit `0d9dcf95`** (operator-ratified 2026-10-11): the pitfall bullet in `workflows/3-test-design.md` and its CHANGELOG row. Sibling rows: `2026-09-21-single-run-satisfiability`, `2026-10-01-test-plan-credits-unpinned-behaviour` |
| 4 | **A container restart lost a subagent's final report** (the Tester's); its files survived and the coordinator re-verified them directly | Coordinator's retro, lesson 4 (first half) | **Declined.** The harness already makes the artifacts the record: the test plan's Verification section holds what the report would have said, and re-verifying from files is what every later phase does anyway. The cost was one re-check and no lost work. The part that can lose work, material that exists only in the container, is #1 |
| 5 | **The held suite was never run green before Phase 4**, so the Implementer fixed a defect in it (a HEAD probe expecting a body) | Review § Harness friction 1; coordinator's retro, lesson 5 | OPEN.md row `2026-10-10-held-suites-run-green-before-implementation` (meta; existing) |
| 6 | **The RW7 timing flake failed a review run under load.** The review filed a new row believing none existed; `2026-10-08-realtime-wrapper-timing-flake-under-load` already recorded RW7 | Review § Harness friction 2; coordinator's retro, lesson 6 | OPEN.md row `2026-10-08-realtime-wrapper-timing-flake-under-load` (meta; existing). This close appended the occurrence and closed `2026-10-10-rw7-timing-flake` as its duplicate |
| 7 | **An external link check failed intermittently with 504 through the session's proxy** (`information-for-agents` L1, github.com links), on changes that didn't touch it. Row 172 is the renewal ritual that relies on the check; it does not cover a flaky run. The same class, a gateway's answer read as the link's, is already a row for the sibling suite. Ports to both flows | Coordinator's retro, lesson 7 | OPEN.md row `2026-10-04-llms-txt-egress-403-false-fail` (meta; existing). This close appended the sibling suite and the 5xx case |
| 8 | **Sandbox ports have no CI.** Local runs were the gate, read against each branch's known failures (`feat/tags`: 8 in 5 suites; `feature-magic-carpet`: the chained runner crashes on `better-sqlite3`). Ports to the human-gated flow (Direction runs don't ship to sandboxes) | Coordinator's retro, lesson 8; PRs #848, #849 show no check runs | OPEN.md row `2026-09-22-drifted-sandbox-lacks-harness-subsystems` (meta; existing; its playbook fix shape). This close appended the baselines and the route-table case. `2026-10-10-sandboxes-got-security-fixes` is a closed bug row that states the fact without a fix |
| 9 | **A duplicate row was filed without a search** (#6). Ports to both flows | This close | OPEN.md row `2026-09-20-ledger-rule-omits-search-before-filing` (meta; existing). This close appended the instance |
| 10 | **Batch 0 was never reviewed.** Eight handler files and a new suite went to production and both sandboxes as an owner-approved hotfix, with no story, test plan or review afterwards. The coordinator's reading of the diff was the only check, and it caught #3's bug. This close read the diff and found no defect; that is a reading, not a review. Human-gated flow only | §4 #12; ledger `2026-10-10-request-values-reached-a-shell` | OPEN.md row `2026-10-10-ledger-fix-pr-merged-unreviewed` (meta; existing; a third instance, appended) |
| 11 | **Phase commits used forms the stats can't see.** `architecture:` and `tests:` instead of `adr:` and `test:`, and the review rode inside the `fix:` commit, so only the `story:` commit counts and story 8's cycle time is first→last. Ports to both flows | `harness-stats.sh` output above; subjects of `9186a8c2`, `ad61b9ad`, `151e39fb` | OPEN.md row `2026-09-21-review-commit-form-breaks-cycle-time` (meta; existing). This close appended it as (d) |
| 12 | **A live check the test plan prescribed went unrecorded** (§4 #5). Nothing asks for the record. Ports to both flows | Test plan § Live / manual; story 8 § Shipped | OPEN.md row `2026-09-28-live-and-evidence-runs-unrecorded` (meta; existing). This close appended the instance |
| 13 | **Workflow 6 step 9 is still silent** for a Done epic that keeps taking stories under later books; a third close left this epic's folders in place. Ports to both flows | §2 Epic close-out | OPEN.md row 268 (meta; existing). This close appended the third instance |

**Harness commit A, ratified as `784d934d`** (finding #2). Added to `engineering-team/workflows/2-architecture.md` § Common pitfalls:

```
- Designing for `staging` alone when the change must reach other live branches. A security fix ships everywhere it is
  live in one round (ledger `2026-10-10-sandboxes-got-security-fixes`), and each long-lived sandbox serves its own routes
  and files, so a port is new work, not a copy. Name each branch's preparation in the ADR's Implementation notes (what
  it lacks, what it adds, how its tests run there), so the Tester and the Reviewer cover each port's branch-specific
  part. When the fix commit itself discloses an open hole, every port must be ready before the first push (audit
  `admin-action-owner-check` §7 #2).
```

with the CHANGELOG row:

```
| 2026-10-11 | Architecture pitfall: a change that must reach several live branches names each branch's preparation in the ADR | the sandbox ports of a disclosing fix carried new decisions no review read, and nothing could be pushed until every port was ready | audit `admin-action-owner-check` §7 #2 |
```

**Harness commit B, ratified as `0d9dcf95`** (finding #3). Added to `engineering-team/workflows/3-test-design.md` § Common pitfalls:

```
- A test that asserts something did *not* happen ("nothing runs", "no shell", "never shows X") also passes when the
  code under test returns early. Pair it with an assertion that the path under test ran (the handler answered, the call
  was reached), and set up whatever that path needs: config, an owner, a fixture (audit `admin-action-owner-check` §7 #3).
```

with the CHANGELOG row:

```
| 2026-10-11 | Test-design pitfall: pair a negative assertion with one that proves the path under test ran | a hotfix test passed over a ReferenceError because the handler returned early when no owner was configured | audit `admin-action-owner-check` §7 #3 |
```

Both edit harness-definition paths, so each commit also touches `engineering-team/CHANGELOG.md` (L10).

## Close screening

The repo is public, and three findings from the sweep are still open. This close checked its own new and changed text
before hand-off: this file, the seed, the book, the epic line, the intake line, the earlier audits' ticks, the new and
appended ledger rows and the OPEN.md row 268 note. It checked two ways:
- a search for the specifics of the three open findings, with no hits outside their ledger ids;
- a list of every route-shaped token in the added lines, each checked against the routes this book closed or the
  public reads it left unchanged.

The routes named here are class-A routes and closed reads, all fixed in production by PR #847, and public reads this
book did not change.
