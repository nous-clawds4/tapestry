# Test Plan: Story 1 — /setup shows where you stand

**Story:** `engineering-team/stories/setup-status-and-alert/1-setup-shows-where-you-stand.md`
**ADR:** `engineering-team/decisions/setup-status-and-alert/0001-one-setup-status-answer.md`
**Date:** 2026-09-21

Two new files carry the tests:

- **`test/setup-status.test.js`** is the Node suite, registered in `test/registry.js`. It has seven
  classes:

  | Class | What it tests | How |
  |---|---|---|
  | **U** | the server module's rules | through the six dependencies ADR 0001 names |
  | **X** | `scanLocalStrict` | the real `spawn`, against a fake `strfry` put first on `PATH` |
  | **C** | the pure UI util and the `/setup` copy | loaded in Node as ESM |
  | **S** | the server | source sentinels |
  | **D** | the JSX this runner cannot execute | source sentinels |
  | **R** | regressions | tests that pass before and after |
  | **H** | the live contract | against a running instance |

- **`tests/brainstorm/setup-status.spec.js`** is the Playwright **B** class: what a viewer sees on
  `/setup`, run hermetically against the built UI with every `/api` route mocked. This follows the
  precedent of `tests/brainstorm/assistant-setup-prompt.spec.js`.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** signed out | **B1**: the three steps are links with no marks, no progress line or bar, the sign-in line and its button, and no status read. **B2**: the sign-in line never flashes while sign-in resolves. **B7**, **B8**: the signed-out variants. **U1**: a request with no authenticated session costs nothing and answers `signedIn: false`. | spec; `setup-status.test.js` | browser; unit |
| **AC-2** each step follows the rules | **U3**: step 1 is "holds an assistant", and steps 2 and 3 are still checked without one. **U16**: the follow count and done rule. **U17**: the Map rules, including the Owner (assistant = TA) is done, a Customer whose Map names the TA is "another provider", no assistant, the first valid entry wins, and the invariants. **U2**: the viewer is the session, and the query is ignored. **B3**, **B4**, **B6**: the page renders those answers. | both | unit; browser |
| **AC-3** where it looks | **U4**: a local hit, with no relay read. **U5**: newest wins, locally and across relays, including the `created_at` tie. **U6**: every relay unreachable leaves the check unfinished. **U7**: one relay answering "none" finishes it. **U8**: the 8 s budget. **U9**: a failed local scan is not a miss. **U10**: no relays configured. **U11**: other authors and kinds are ignored. **U12**: the scan filters. **U13**: the per-kind relay lists. **U14**, **U15**: this instance's own relay is never outside. **U20**: the two kinds are independent. **X1–X4**: the strict local scan. **H2** (opt-in): the real server path end to end. | `setup-status.test.js` | unit; live |
| **AC-4** how it shows | **B3**: done cards, "Done", the sentences, not links, 3 of 3, "You're all set!", and the screen-reader "Done:". **B4**: a mix, and the another-provider sentence. **B5**: still checking, and failed. **B6**: no assistant. **B7**: 375 px. **B9**: an expired session. **B10** (round 2): sign out, then back in as the same account; every step is not done until the new answer arrives. **C1–C3**: the counts. **C4**, **C5**: the copy. **D3**: the constant is gone. | both | browser; unit |
| **AC-5** read-only | **S2**: the module holds no import, publish, signing, key material or file write. **B8**: every request the page makes is a GET. **U1**: no session means no work. **H1**: the live route answers a GET. | both | unit; browser; live |
| ADR structure | **S1**: the route is registered. **S4**: `openapi.yaml`. **D1**: the provider. **D2**: its mount, around the router and inside `AssistantRosterProvider`. **S3**: no 64-hex literals. **U18**: the response shape, including no pubkeys. **U19**: the 500. | `setup-status.test.js` | unit |
| Regression | **R1**: the approved copy is byte-identical. **R2**: the four routes. **B5**, **B7**, **B8**, **B9** also pass on today's build (see Verification). | both | unit; browser |

## Edge cases

Beyond the criteria:

- [x] **A session that is not quite authenticated** is `signedIn: false` (U1). That covers
      `authenticated: 'true'`, a non-hex pubkey, a pending sign-in, and a trusted loopback call.
- [x] **Query parameters** (`pubkey`, `customerPubkey`, `relays`) can't change the answer or add a
      relay (U2).
- [x] **A relay that hangs** (U8) and **a relay read that throws** (U6).
- [x] **A local scan that errors, times out, or exits non-zero** after printing an event (U9, X2–X4).
- [x] **A Map list that falls back to this instance's own relay** (U15). This is the ADR's
      own-relay trap.
- [x] **Follow lists:**
  - duplicate, upper-case, non-hex and empty `p` tags;
  - `e` tags mixed in;
  - self-follows (U16).
- [x] **Maps:**
  - an invalid first `30382:rank` entry is skipped;
  - a valid first entry wins over a later one;
  - upper-case pubkeys;
  - Maps holding only list entries (U17).
- [x] **Unexpected throws** answer 500 (U19). **An expired session** leaves the page working (B9).

## Test infrastructure

- **Node:** the built-in runner through the gate engine. The suite exports `run()`. Classes U, X, C,
  S, D and R are stack-free.
- **The fake `strfry` (class X):** each test writes a throwaway `/bin/sh` script named `strfry` into
  a `mkdtemp` directory and puts that directory first on `PATH`. `FAKE_STRFRY_MODE` chooses `ok`,
  `fail` (prints an event, exits 1) or `hang` (`sleep 5`). `PATH` and the fake's variables are
  restored after each test. It needs `/bin/sh` and `sleep`, and no strfry.
- **Browser (class B):**
  - Playwright 1.56.1 with its chromium, both installed on this machine.
  - Every `/api` route is mocked. A catch-all answers `success: false`, as in the precedent.
  - It needs an origin serving the **built** UI: `cd ui && npm run build`, then
    `npx vite preview --port 4173 --strictPort` in `ui/`. Locally, the `.claude/launch.json` entry
    `setup-ui-preview` (git-ignored) starts it through `preview_start`.
- **Live (class H):** `BRAINSTORM_BASE_URL`, default `http://localhost:7778`.
  - **H1** is a single GET.
  - **H2** runs only with `SETUP_STATUS_LIVE_SIGN_IN=1`. It signs in a throwaway guest key through
    `/api/auth/verify-user` and `/api/auth/login-user`, which creates a session and nothing else,
    then reads `/api/setup/status` with that session. Opt-in because the house H-class is GET-only.
  - **The local stack has no bind mount, and its server has drifted (OPEN.md row 27).** Both stay
    red locally until `/cycle-local` deploys the server change.
- **Firmware state:** none. No concept changes.
- **Fixtures:** fixture pubkeys only (`a1…`, `a2…`, `b2…`, `c3…`, `d4…`, `ee…`), never live keys. `ee…`
  stands in for an instance TA.

## How to run

**The new Node suite alone.** Call `run()`; `node test/setup-status.test.js` alone does nothing.

```
node -e "require('./test/setup-status.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

**H2**, after `/cycle-local` has deployed the server change:

```
SETUP_STATUS_LIVE_SIGN_IN=1 node -e "require('./test/setup-status.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

**The browser class.** Build and serve the UI under test, then:

```
BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/setup-status.spec.js --project=chromium
```

**The story's gate** (book § Test gate). It is one gate-engine run over the 72 suites pinned below.
Run it from the repo root; `GATE_LABEL` tags the run record:

```
GATE_LABEL=setup-status-1 node - <<'EOF'
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';   // the same two env vars as test/test.js:14–15
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';
const { execSync } = require('child_process');
const { runGate } = require('./test/helpers/gateRunner');
const { suites } = require('./test/registry');
const named = execSync("/usr/bin/grep -lE 'api/index\\.js|openapi\\.yaml|App\\.jsx|styles\\.css|pages/setup|setupStatus|SetupStatusContext|api/setup' test/*.test.js")
  .toString().trim().split('\n').filter(Boolean).map((p) => p.replace(/^test\//, ''));
const walkers = ['collapse-into-export-concept', 'publish-export-a-concept', 'users-page-neo4j-endpoint', 'in-app-badged-ta-avatar',
  'note-tagging-raw-events-inspector-ui', 'curated-dlist-update-publish', 'close-unauth-write-surface', 'one-default-assistant-profile',
  'stack-free-npm-test', 'gate-result-record'].map((n) => `${n}.test.js`);
const want = new Set([...named, ...walkers, 'setup-status.test.js']);
const missing = [...want].filter((f) => !suites.some((s) => s.file === f));
if (missing.length) { console.error('not in test/registry.js:', missing.join(', ')); process.exit(2); }
runGate({ suites: suites.filter((s) => s.file && want.has(s.file)), label: process.env.GATE_LABEL });
EOF
npm run gate:status -- --label setup-status-1
```

Around the run:
- the UI build (`npm --prefix ui run build`);
- eslint on the touched UI files, at parity with the base;
- `bash scripts/harness-lint.sh`;
- the browser class above;
- `/cycle-local`, then H1, H2 and a signed-in browser pass on `:7778`. For that pass, the fetch stub
  (memory `verifying-signed-in-ui`) must also answer `/api/setup/status` with a canned response. The
  server holds no real session under the stub, so it would answer `signedIn: false`.

The full `npm test` is not the gate. It takes about 53 minutes here and is red by default on four
suites no change here reaches (OPEN.md rows 191 and 285).

### Pinned gate list (computed 2026-09-21)

The filename grep finds 64 suites. The walkers add 8 more that it cannot find. Two walkers,
`in-app-badged-ta-avatar` and `note-tagging-raw-events-inspector-ui`, also name `styles.css`, so
the grep had already found them. The Tester re-ran `grep -rl readdirSync test/` at this phase:
- six walkers read every `.js`/`.jsx` file under `ui/src` or `ui/src/hooks`;
- `close-unauth-write-surface` and `one-default-assistant-profile` walk `src/`, which the new server
  module joins;
- `stack-free-npm-test` walks `test/` and requires every suite to be registered;
- `gate-result-record` (C9) also reads every `test/*.test.js`. It was missing from the first pinned
  list: that list claimed "the rest walk trees this story does not touch", but a story that adds a
  suite touches `test/`. The Reviewer found it (review § Harness friction 1), and round 2 added it;
- the rest walk trees this story does not touch.

The 72 suites:

add-node-as-element-restore, admin-tools-dashboard-panel, adoption-candidates-queue,
adoption-raw-event-view, author-scoped-inspection-roster, author-scoped-inspection-views,
b-coverage-audit-and-disposition, break-a-goal-into-pieces, bullboard-admin-access,
capture-a-goal-and-see-it, close-unauth-write-surface, collapse-into-export-concept,
community-class-thread-pull, curated-dlist-update-publish, deploy-safety-status,
dlist-curation-header-endpoint, dlist-curation-merge-preserve, event-page-read-path, event-page-ui,
event-tagging-for-tag, event-tagging-notes-by-author, event-tagging-read-api, gate-result-record,
generalized-task-scheduler, global-publish-gate, in-app-badged-ta-avatar,
inverse-queue-publish-candidates, live-feed-feed-page, live-feed-read-path,
login-failure-and-tag-collapse, my-curated-dlists-items, my-curated-dlists-page,
note-surfaces-read-path, note-surfaces-ui, note-tagging-raw-events-inspector-ui,
one-default-assistant-profile, open-ranking-stats, pin-detail-into-tag-pinned-tab,
profile-content-card, profile-followers-list, profile-follows-hops, profile-follows-list,
profile-hops-path, profile-identity-details-popover, profile-verified-reporters-count,
publish-export-a-concept, relay-scan-bounds, retire-offering-vocabulary,
scheduled-search-and-house-scores-refresh, scheduled-tasks-with-arguments, **setup-status**,
shared-by-me, shared-concepts-row-detail, show-the-four-on-the-goal-screens-that-already-exist,
stack-free-npm-test, stamped-composite-avatar, state-on-concept-page, tag-actions-menu-ui,
tag-applicability-picker, tag-detail-curated-view-and-pin-polish, tagging-raw-event-inspector-ui,
task-queue-bullmq, teach-it-what-matters, the-proposal-loop, treasure-map-relay-presence,
trusted-dictionary, unified-tag-index, users-page-neo4j-endpoint, verified-muters-profile-surface,
verified-muters-read-api, verified-reporters-list-page, verified-reporters-membership-data.

If the Implementer touches a file outside the ADR's list, extend the grep and say so in the story's
Deviations.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-21 on
`feat/setup-status-and-alert` at `128f9b9d` (the ADR commit), plus these files.

**Node suite: 2 passed, 37 failed, 1 skipped.** H-class: 1 executed, 1 skipped (H2, not opted in).
Every failure names what is missing:

```
FAIL  U1…U20, X1…X4  src/api/setup/status.js does not exist. ADR setup-status-and-alert/0001 creates it: …
FAIL  C1…C3          ui/src/utils/setupStatus.js does not exist. ADR 0001 § Implementation notes 2 creates it: …
FAIL  C4             steps.js must export followDoneText(n) (ADR 0001 § Implementation notes 5)
FAIL  C5             CREATE_ACCOUNT_STEP.doneText: got undefined
FAIL  S1             src/api/index.js must register `app.get('/api/setup/status', …handleSetupStatus)` (ADR 0001 § Registration)
FAIL  S2             src/api/setup/status.js does not exist (ADR 0001).
FAIL  S3             these files must exist first: src/api/setup/status.js, ui/src/utils/setupStatus.js, ui/src/context/SetupStatusContext.jsx
FAIL  S4             src/api/openapi.yaml must carry a `/api/setup/status:` path (ADR 0001 § Registration)
FAIL  D1             ui/src/context/SetupStatusContext.jsx does not exist (ADR 0001 § Implementation notes 3).
FAIL  D2             App.jsx must import { SetupStatusProvider } from './context/SetupStatusContext'
FAIL  D3             ui/src/pages/setup/Index.jsx still declares the constant `const doneCount = 0` (story 1: …)
PASS  R1, R2         (regressions: pass before and after)
FAIL  H1             http://localhost:7778/api/setup/status → HTTP 404, not JSON: … Cannot GET /api/ — the route is missing …
SKIP  H2             (opt-in: SETUP_STATUS_LIVE_SIGN_IN=1)
```

**The tests are satisfiable.** To check that the suite does not demand something the ADR does not,
the Tester ran it against a throwaway implementation of `src/api/setup/status.js`,
`ui/src/utils/setupStatus.js` and the `steps.js` additions. That implementation followed ADR 0001
and lived in a scratchpad mirror of the repo; it is not committed and is not handed to the
Implementer. Result:
- **32 passed:** all of U1–U20, X1–X4, C1–C5, S2, R1 and R2.
- **7 failed:** S1, S3, S4, D1–D3 and H1. Those are exactly the files the throwaway implementation
  did not create (the route registration, `openapi.yaml`, the provider and the page) and the live
  route.

**Browser class** against today's build (`npm --prefix ui run build`, served on `:4173`):
**6 failed, 8 passed.**
- **B0**: the bundle does not contain `/api/setup/status` (searched 11 JS chunks).
- **B1**: a visitor hears "Not done:" (every step is marked for everyone today).
- **B2**: the page shows "0 of 3 complete", not "3 of 3".
- **B3**, **B4**, **B6**: "0 of 3 complete" where 3, 1 and 1 are expected.
- **The 8 passes:** B5 ×2, B7 ×3, B8 ×2 and B9. They pass on today's build by coincidence, because
  it already shows the "still checking" look for everyone, fits 375 px, and makes only GETs. They
  guard the new states after implementation.

**The scoped gate at this phase** is the baseline for Implementation and Review. It was run with the
driver above under the label `setup-status-1-testdesign`; `npm run gate:status` reads:

```
20260921T161604Z-2762-835d [setup-status-1-testdesign] started 2026-09-21T16:16:04.357Z on 128f9b9d+dirty — FAIL, exit 1, 1448 passed, 37 failed, 4 skipped, 71/71 suites; failed: setup-status
```

**The only failing suite is the new one.** Its 37 failures are the reds listed above. The other 70
suites are green on this machine at the base, including the live-tier suites against the local
stack. So any other red at Implementation or Review is new.

The four skips are all environmental or opt-in:
- `deploy-safety-status`: 1;
- `show-the-four-on-the-goal-screens-that-already-exist`: 2;
- `setup-status` H2: 1, not opted in.

### Round 2 (after the review asked for changes)

The review's Blocking 1: after a sign-out, signing back in as the same account shows the answer
from before the sign-out as current while the new check runs. **B10** pins it. It drives the real
`login()` and `logout()` in `AuthContext`, with the recipe from OPEN.md row
`2026-09-21-b-class-no-signin-recipe`:
- a fake NIP-07 signer set through `page.addInitScript`;
- stateful in-browser mocks for verify-user, login-user and logout;
- `/api/setup/status` answers queued per account.

It signs out through the avatar menu, then back in through the page's own "Sign in with nostr"
button. That button click also closes the review's note that no test clicked it.

Confirmed failing on 2026-09-21 against the build of `eff82667`, the review commit (the
implementation `7fe27582` plus review docs):
- **Browser class:** 14 passed, 1 failed.
- **B10** failed with: "the answer from before the sign-out was shown as current while the new check
  was still running". 18 of the samples taken while the second status read was in flight held
  "3 of 3 complete ✓Done: Create your account …".
- The other fourteen still pass. The new helper changed nothing for them.

**The pinned gate grows to 72 suites.** `gate-result-record` was added (see § Pinned gate list).
