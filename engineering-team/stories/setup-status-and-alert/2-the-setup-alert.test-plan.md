# Test Plan: Story 2 — The Setup Alert

**Story:** `engineering-team/stories/setup-status-and-alert/2-the-setup-alert.md`
**ADR:** `engineering-team/decisions/setup-status-and-alert/0002-the-setup-alert-pill.md`
**Date:** 2026-09-21

Two new files carry the tests:

- **`test/setup-alert.test.js`** is the Node suite, registered in `test/registry.js` after
  `setup-status.test.js`. It has three classes, all stack-free:

  | Class | What it tests | How |
  |---|---|---|
  | **C** | the alert's copy in `ui/src/pages/setup/steps.js` | loaded in Node as ESM |
  | **D** | the JSX this runner cannot execute: the component, its four mounts, the provider's request key | source sentinels |
  | **S** | the house rule on pubkey literals | source sentinel |

- **`tests/brainstorm/setup-alert.spec.js`** is the Playwright **B** class, 45 tests: what a viewer
  sees in each top bar. It runs hermetically against the built UI with every `/api` route mocked,
  like story 1's spec.

**The session in the B class is static.** `/api/auth/status` answers "authenticated" for the
fixture viewer, the shape of story 1's `mock()`. ADR 0002's notes suggest story 1's `mockSession`
helper; that helper exists to drive `login()` and `logout()`, and no test here signs in or out
mid-test. B9 changes the viewer's assistant through the page's real create flow instead, which
reaches `AuthContext.refreshUser()`.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** where and what | **B1** ×6, one per host (`/tags`, `/`, `/about`, `/developers`, `/tapestry/`, `/assistant`): the pill is in the top bar, reads the sentence, "· 2 steps left" and "Finish setup →", and sits before the avatar menu on the same line (its right edge ≤ the avatar's left edge; centres within the avatar's height). On `/developers` it sits in the empty `.bsp-auth` slot. **B3** ×2: "· 1 step left" and "· 3 steps left". **B2** ×2: a click, and Tab then Enter, open `/setup`. **B10**: the search results view carries it on a wide screen. **C1**, **C2**: the copy and `alertCountText`. **D1**: the component. **D2**: the four mounts. | both | browser; unit |
| **AC-2** confident steps only | **B4** ×5, no pill: a hanging read (still checking); a 500; nothing left; only a Map naming another provider; unfinished checks. **B4** (mixed): step 1 open beside two unfinished checks counts alone, "· 1 step left". | spec | browser |
| **AC-3** when it hides | **B5** ×6: signed out, no pill on any host. **B5** ×4: no pill on `/setup` or its three step pages, with two steps left. All four pages carry `TopBar`, so the pill would show there if it did not hide itself. **B5**: no close button inside the pill. **D1**: no `<button` inside the component. | both | browser; unit |
| **AC-4** never disagrees with `/setup` | **B6** ×3 answers: the pill's N equals the steps `/setup` shows as not done less an "another provider" step (the ADR's rule), so N never exceeds them; and the pill and the page make one status read across the SPA navigation. **B4** "nothing left": no pill. **D1**: the component reads `useSetupStatus()` and fetches nothing itself. | both | browser; unit |
| **AC-5** every width | **B7** ×6 hosts at 1280, 800 and 375 px: the accessible name "Finish setting up your account" at every width; the sentence and the count at 1280; the sentence at 800 (the count is left free: "may drop"); only ⚠ and "Finish setup →" at 375; the top bar's content (`scrollWidth`) no wider than the bar. **B11** ×4: the ADR's two phone accommodations (the `TopBar` wordmark, the control panel's role badge) apply at 375 px only while a pill shows. | spec | browser |
| **AC-6** read-only | **B8** ×2 (`/tags`, and the control panel as Owner): with the pill showing, every request that is not a GET is a Cypher read, and a recording NIP-07 signer is never asked to sign. **D1**: no `fetch(` in the component. Story 1's **S2** still guards the server module, which this story does not change. | both | browser; unit |
| ADR Decision 5 (freshness) | **B9**, behavioural: on `/assistant`, a Customer with no assistant clicks "Create my Tapestry Assistant key" (`provision-key` mocked); `user-classification` then reports the assistant; the pill drops from "· 2 steps left" to "· 1 step left" in the same document, after exactly two status reads. **D3**: the request key includes the viewer's assistant. | both | browser; unit |
| Build prerequisite | **B0**: the served bundle contains `bs-setup-alert`, so a stale build fails loudly instead of passing the "no pill" tests. | spec | browser |

## Edge cases

Beyond the criteria:

- [x] **The pill waits for the answer.** A read that never returns shows no pill (B4).
- [x] **Checks that did not finish never count,** alone (B4) or beside a confident step 1 (B4 mixed).
- [x] **The control panel reads over POST.** Its Dashboard queries the graph with `POST
      /api/neo4j/query` (`Dashboard.jsx:125–138`). B8 accepts those only when the Cypher carries
      none of the write keywords the server itself routes to a write session
      (`src/api/neo4j/queryPost.js:17`). An earlier GET-only rule failed on the throwaway
      implementation for that reason alone (see Verification).
- [x] **The phone accommodations are conditional.** Without a pill, the wordmark and the badge stay
      at 375 px (B11).
- [x] **No reload in B9.** A marker set on `window` before the click must still be there after.
- [ ] **Not covered, by scope:** widths below 375 px (ADR § Out of scope); a fourth avatar-menu
      kind (none exists); changes made in another tab (story § Out of scope); the results view on
      phones, where the existing collapse hides the pill with the avatar menu (ADR § Consequences).

## Test infrastructure

- **Node:** the built-in runner through the gate engine. The suite exports `run()`; running
  `node test/setup-alert.test.js` alone does nothing.
- **Browser (class B):**
  - Playwright 1.56.1 with its chromium, both installed on this machine.
  - A catch-all `/api/**` route is registered **first**. The `:4173` preview proxies `/api` to the
    live `:7778` stack (ledger row `2026-09-21-vite-preview-proxies-live-stack`), so an unmocked
    call would otherwise reach real data.
  - It needs an origin serving the **built** UI: `npm --prefix ui run build`, then `vite preview
    --port 4173 --strictPort` in `ui/`. Locally the `.claude/launch.json` entry `setup-ui-preview`
    (git-ignored) starts it through `preview_start`.
- **No live class.** The story adds no server route; story 1's H1 and H2 cover the endpoint.
- **Firmware state:** none. No concept changes.
- **Fixtures:** fixture pubkeys only: `a1…` the viewer, `a2…` their assistant, `b2…` a search
  hit, `bb…` an owner-pubkey stand-in, `ee…` the instance TA stand-in.

## How to run

**The new Node suite alone:**

```
node -e "require('./test/setup-alert.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

**The browser class,** after building and serving the UI under test. Story 1's spec runs too: the
provider it covers gains a new key.

```
BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/setup-alert.spec.js tests/brainstorm/setup-status.spec.js --project=chromium
```

**The story's gate.** One gate-engine run over the 81 suites pinned below, from the repo root:

```
GATE_LABEL=setup-alert-2 node - <<'EOF'
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';   // the same two env vars as test/test.js:14–15
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';
const { execSync } = require('child_process');
const { runGate } = require('./test/helpers/gateRunner');
const { suites } = require('./test/registry');
const named = execSync("/usr/bin/grep -lE 'api/index\\.js|openapi\\.yaml|App\\.jsx|styles\\.css|pages/setup|setupStatus|SetupStatusContext|api/setup|BrainstormUserMenu|BrainstormSearch|Header\\.jsx|components/Header|DevPage|developers/|SetupAlert|setup-alert' test/*.test.js")
  .toString().trim().split('\n').filter(Boolean).map((p) => p.replace(/^test\//, ''));
const walkers = ['collapse-into-export-concept', 'publish-export-a-concept', 'users-page-neo4j-endpoint', 'in-app-badged-ta-avatar',
  'note-tagging-raw-events-inspector-ui', 'curated-dlist-update-publish', 'my-assistant-page',
  'stack-free-npm-test', 'gate-result-record', 'session-start'].map((n) => `${n}.test.js`);
const want = new Set([...named, ...walkers, 'setup-status.test.js', 'setup-alert.test.js']);
const missing = [...want].filter((f) => !suites.some((s) => s.file === f));
if (missing.length) { console.error('not in test/registry.js:', missing.join(', ')); process.exit(2); }
runGate({ suites: suites.filter((s) => s.file && want.has(s.file)), label: process.env.GATE_LABEL });
EOF
npm run gate:status -- --label setup-alert-2
```

Around the run:
- the UI build (`npm --prefix ui run build`);
- eslint on the touched UI files, at parity with the base;
- `bash scripts/harness-lint.sh`;
- the browser classes above;
- `/cycle-local`, then a signed-in browser pass on `:7778` with the fetch stub (memory
  `verifying-signed-in-ui`). The stub must also answer `/api/setup/status` with a canned answer:
  the server holds no real session under the stub, so it would answer `signedIn: false`.

The full `npm test` is not the gate. It takes about 53 minutes here and is red by default on four
suites no change here reaches (OPEN.md rows 191 and 285).

### Pinned gate list (computed 2026-09-21)

**The filename grep** is story 1's, extended to the files this story touches:
`BrainstormUserMenu`, `BrainstormSearch`, `Header.jsx`, `DevPage` and `developers/`,
`SetupAlert` and `setup-alert`. It finds 74 suites.

**The walkers** come from a fresh `grep -rl readdirSync test/`, triaged against the branch
(`git diff a31d448c...HEAD` plus this phase's files), not only the story's code (ledger row
`2026-09-21-abbreviated-path-names-no-gate`). The branch touches `ui/src`, `test/` and
`engineering-team/`; it touches neither `src/` nor `ledger/`.
- **`ui/src`:** `collapse-into-export-concept`, `publish-export-a-concept`,
  `users-page-neo4j-endpoint`, `in-app-badged-ta-avatar`, `note-tagging-raw-events-inspector-ui`,
  `my-assistant-page` (new since story 1, from assistant-profile #4), and `curated-dlist-update-publish`
  (`ui/src/hooks`, kept from story 1). The grep already finds three of them.
- **`test/`:** `stack-free-npm-test` (every suite registered) and `gate-result-record` (C9 reads
  every `test/*.test.js`). This story adds a suite.
- **`engineering-team/`:** `session-start` runs the digest, whose harness-lint reads the story,
  the ADR and this plan. It also reads the real `ledger/`, so it stays pinned if a row lands.
- **Left out, with the tree each walks:** `close-unauth-write-surface` and
  `one-default-assistant-profile` (`src/`; story 1 pinned them for its server module),
  `reconciliation-rearchitecture` and `event-tagging-core` / `-write-path` (`src/`),
  `show-the-four-on-the-goal-screens-that-already-exist` (`ui/src/pages/brain`; the grep finds it
  anyway), `store-the-four-when-a-goal-is-captured-or-updated` (`firmware/`),
  `retire-offering-vocabulary` (the shared-concepts pages and API; the grep finds it anyway),
  `stamped-composite-avatar` and `ledger-row-ids` (temporary directories).

The 81 suites:

add-node-as-element-restore, admin-tools-dashboard-panel, adoption-candidates-queue,
adoption-raw-event-view, author-scoped-inspection-roster, author-scoped-inspection-views,
b-coverage-audit-and-disposition, break-a-goal-into-pieces, bullboard-admin-access,
capture-a-goal-and-see-it, collapse-into-export-concept, community-class-thread-pull,
curated-dlist-update-publish, deploy-safety-status, dlist-curation-header-endpoint,
dlist-curation-merge-preserve, event-page-read-path, event-page-ui, event-tagging-for-tag,
event-tagging-notes-by-author, event-tagging-read-api, gate-result-record, generalized-task-scheduler,
global-publish-gate, in-app-badged-ta-avatar, inverse-queue-publish-candidates, live-feed-feed-page,
live-feed-read-path, login-failure-and-tag-collapse, my-assistant-page, my-curated-dlists-items,
my-curated-dlists-page, nip05-checkmark-verification, note-surfaces-read-path, note-surfaces-ui,
note-tagging-raw-events-inspector-ui, open-ranking-stats, pin-detail-into-tag-pinned-tab,
pov-resolution-status, pov-selectable-tag-surfaces, pov-state-unification, profile-content-card,
profile-followers-list, profile-follows-hops, profile-follows-list, profile-hops-path,
profile-identity-details-popover, profile-verified-reporters-count, publish-export-a-concept,
relay-scan-bounds, retire-offering-vocabulary, scheduled-search-and-house-scores-refresh,
scheduled-tasks-with-arguments, search-api-result-type-settings, search-result-parity,
search-results-url, session-start, **setup-alert**, setup-status, shared-by-me,
shared-concepts-row-detail, show-the-four-on-the-goal-screens-that-already-exist, site-trust-signals,
stack-free-npm-test, stamped-composite-avatar, state-on-concept-page, tag-actions-menu-ui,
tag-applicability-picker, tag-detail-curated-view-and-pin-polish, tagging-raw-event-inspector-ui,
task-queue-bullmq, teach-it-what-matters, the-proposal-loop, treasure-map-relay-presence,
trusted-dictionary, unified-tag-index, users-page-neo4j-endpoint, verified-muters-profile-surface,
verified-muters-read-api, verified-reporters-list-page, verified-reporters-membership-data.

If the Implementer touches a file outside the ADR's list, extend the grep and say so in the story's
Deviations.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-21 on `feat/setup-status-and-alert`
at `e9763808` (the ADR commit), plus these files.

**Node suite: 0 passed, 6 failed.** Every failure names what is missing:

```
FAIL  C1  steps.js must export SETUP_ALERT_COPY (ADR 0002 § Implementation notes 3)
FAIL  C2  steps.js must export alertCountText(n) (ADR 0002 § Implementation notes 3)
FAIL  D1  ui/src/components/SetupAlert.jsx does not exist (ADR 0002 § Implementation notes 1).
FAIL  D2  ui/src/components/BrainstormUserMenu.jsx must import SetupAlert from './SetupAlert' (it covers TopBar pages and the fourteen own bars)
FAIL  D3  the request key must include the viewer's assistant (user?.assistantPubkey), … the key is: const request = wanted && !authLoading && pubkey ? `${pubkey}#${attempt}` : null;
FAIL  S1  ui/src/components/SetupAlert.jsx does not exist.
```

**Browser class** against today's build (`npm --prefix ui run build`, served on `:4173`):
**28 failed, 17 passed.**
- **B0**: the bundle does not contain "bs-setup-alert" (searched 11 JS chunks).
- **B1** ×6: each page renders its top bar (and, signed in, its avatar menu), and "the pill must
  be in the top bar" fails.
- **B2** ×2, **B3** ×2, **B4** (mixed), **B5** (no close button), **B6** ×3, **B7** ×6, **B8** ×2,
  **B10** and **B11** ×2 (hide): no link named "Finish setting up your account".
- **B9**: the page offers "Create my Tapestry Assistant key", and no pill says "· 2 steps left".
- **The 17 passes:** B4 ×5, B5 ×10 and B11 ×2 (stay). They pass on today's build because there is
  no pill anywhere. They guard the no-pill states after implementation.

**The tests are satisfiable.** The Tester ran both suites against a throwaway implementation of
ADR 0002, written from its Implementation notes into a scratchpad mirror of `ui/` and `src/`. It is
not committed and is not handed to the Implementer.
- **Node: 6 passed.**
- **Browser: 45 passed**, after one test change, and story 1's 15 still pass beside them (60/60),
  so the new request key leaves story 1's provider tests, B10 included, green. The first run failed
  only B8 on the control panel: its Dashboard reads with `POST /api/neo4j/query`, which the
  GET-only rule counted as a write. B8 now accepts a POST there when its Cypher is a read (see
  Edge cases).

**The tests bite.** Two mutations of that implementation, one run each:
- **The request key without the assistant:** D3 fails, and B9 fails ("after the assistant exists,
  the pill counts one step fewer").
- **Without the two `:has()` rules:** B7 fails at 375 px on `/tags`, `/`, `/assistant` (the bar's
  content is 415 px wide in 375) and `/tapestry/` (419 px), and both B11 "hide" tests fail. `/about`
  and `/developers` still fit: their bars carry no wordmark.

**The scoped gate at this phase** is the baseline for Implementation and Review, run with the
driver above under the label `setup-alert-2-testdesign`. `npm run gate:status` reads:

```
20260921T201722Z-18237-8edc [setup-alert-2-testdesign] started 2026-09-21T20:17:22.777Z on e9763808+dirty — FAIL, exit 1, 1623 passed, 6 failed, 4 skipped, 81/81 suites; failed: setup-alert
```

**The only failing suite is the new one,** with the six reds listed above. The other 80 suites are
green on this machine at the base, including the live-tier suites against the local stack, so any
other red at Implementation or Review is new. The four skips are the same as story 1's, all
environmental or opt-in: `deploy-safety-status` 1, `show-the-four-on-the-goal-screens-that-already-exist`
2, and `setup-status` H2 1 (not opted in).
