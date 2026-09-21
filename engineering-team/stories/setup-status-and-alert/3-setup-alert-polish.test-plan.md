# Test Plan: Story 3 — The Setup Alert: readable, announced as it reads, and current

**Story:** `engineering-team/stories/setup-status-and-alert/3-setup-alert-polish.md`
**ADR:** `engineering-team/decisions/setup-status-and-alert/0003-readable-named-and-current.md`
**Date:** 2026-09-21

Two new files carry the tests, and two of story 2's files change so they stop pinning what ADR 0003
replaced.

- **`test/setup-alert-polish.test.js`** is the Node suite, registered in `test/registry.js` after
  `setup-alert.test.js`. It has 14 tests in four classes:

  | Class | What it tests | How |
  |---|---|---|
  | **U** ×8 | the publish signal in `ui/src/utils/nostrPublish.js` (ADR 0003 § 1) | the real module in Node, a fresh instance per test. `fetch` is stubbed, and the external route publishes to stub relays served by the `ws` package on 127.0.0.1: one that accepts, one that refuses, and a port with no relay |
  | **C** ×1 | the alert's copy (§ 5) | `steps.js` loaded as ESM |
  | **D** ×3 | the pill (§ 4), the provider's listener (§ 3), and the three import sites (§ 2) | source sentinels |
  | **S** ×2 | the chip's contrast (§ 6, AC-1), and the pages that POST to `/api/strfry/publish` by hand (§ 7) | computed from `styles.css`; a walk of `ui/src` |

- **`tests/brainstorm/setup-alert-polish.spec.js`** is the Playwright B class, 18 tests (P0–P4),
  run hermetically against the built UI like stories 1 and 2:
  - every `/api` route is mocked, with the catch-all first;
  - every WebSocket is answered in the page (`page.routeWebSocket`), so no publish reaches a real
    relay;
  - a fake NIP-07 signer signs.
- **Story 2's files, re-aimed:**
  - `test/setup-alert.test.js` C1 no longer pins the removed `SETUP_ALERT_COPY.name`. It checks
    that the button still *reads* "Finish setup →".
  - D1 drops the `aria-label` assertion.
  - `tests/brainstorm/setup-alert.spec.js` finds the pill by its element
    (`a.bs-setup-alert[href="/setup"]`), not by the old fixed name. B2's Tab check matches the
    element too.

  Both pass before and after this story: they guard story 2's behaviour, and this story's files pin
  the new names.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** the button reads clearly | **P1** ×3 (1280, 800, 375 px): the chip's text is `rgb(15, 15, 26)` and contrasts ≥ 4.5:1 with its chip. The sentence (1280, 800) and the count (1280) keep ≥ 4.5:1, measured against the pill's translucent amber composited over what is behind it, with the count's own opacity applied. **S1**: the same ratio computed from `styles.css`, and the chip is still amber. | both | browser; unit |
| **AC-2** announced as it reads | **P2** ×3: at each width, `toHaveAccessibleName` gives the story's exact string, the pill has no `aria-label`, the ⚠ and the arrow are inside `aria-hidden` elements, and the button still reads "Finish setup →". **P2** singular: "· 1 step left". **P2** Chrome: Chrome's own accessibility tree (CDP `Accessibility.getFullAXTree`) gives the same names at all three widths. **P2** keyboard: Tab reaches the link by its new name, and Enter opens `/setup`. **C1**, **D1**. | both | browser; unit |
| **AC-3** catches up after an in-app save | **P3** Follow (kind 3, a profile page): the pill goes from "· 2 steps left" to "· 1 step left" in the same document, after exactly two status reads. The second read is delayed 1.5 s, and a MutationObserver log shows no committed state carrying the old count from 300 ms after the publish until the new answer. `/setup`, reached through the pill, shows "2 of 3 complete" with no third read. **P3** both routes: when the Follow reaches the local relay *and* outside relays (two announcements of one event), there is still one re-check. **P3** Mute (kind 10000): no re-check (the negative control). **P3** Treasure Map (kind 10040, the Map page's hand editor, as the Owner): one re-check, and the pill goes once nothing is left. **U1–U8**: the signal itself. **D2**: the provider's filter: the viewer's pubkey, kinds 3 and 10040, de-duplicated by id. **D3**: the import sites. **S2**: no new hand-written publisher goes unnoticed. | both | browser; unit |
| **AC-4** hidden in any letter case | **P4** ×4: `/SETUP`, `/Setup/Follow`, `/SETUP/ACTIVATE`, `/Setup/create-account` each render a setup page (`main.bs-setup-main`) with no pill, and a control on `/tags` shows the pill for the same viewer first. **D1** (the lower-cased comparison). | both | browser; unit |
| **AC-5** nothing else changes | Story 2's browser class (50) and Node suite (6), re-aimed as above, and story 1's browser class (15), all re-run. | both | browser; unit |
| Build prerequisite | **P0**: the served bundle contains `bs-setup-alert-arrow`, so a stale build fails loudly. | spec | browser |

## Edge cases

Beyond the criteria:

- [x] **A publish that reaches no relay announces nothing:**
  - a local refusal or a network error (U3);
  - the local-only gate (U4);
  - every outside relay refusing or unreachable (U5).
- [x] **A listener that throws** never breaks the publish, and the others still hear it (U6).
  Unsubscribing works (U7).
- [x] **One event announced twice** (local plus outside, U8) causes one re-check (P3, both routes).
- [x] **A setup-irrelevant publish by the viewer** (kind 10000) causes no re-check (P3 Mute).
- [x] **The old count is never current during the re-check** (P3 Follow's MutationObserver log).
  Before the publish the old count is simply the latest answer.
- [x] **A case variant whose prefix is already lower case** (`/setup/CREATE-ACCOUNT`) was hidden
      even before this story, so P4 uses `/Setup/create-account` instead.
- [ ] **Not covered, by scope:**
  - publishes from other apps or tabs (story § Out of scope);
  - the three import flows' own pages in the browser. D3 and S2 pin their route through
    `publishToLocalStrfry`, and U2 pins what that helper then does;
  - another user's event reaching the provider. Only the signed-in viewer publishes from this
    browser, so D2's pubkey filter is pinned by source.

## Test infrastructure

- **Node:** the gate engine's runner. The suite exports `run()`.
  - U imports `ui/src/utils/nostrPublish.js` as ESM with a query string per test, so its cached
    publish policy and its listeners start empty.
  - Stub relays use `ws` (8.18.1, in the root `node_modules`) on 127.0.0.1 with port 0. Node's
    built-in `WebSocket` drives nostr-tools' `SimplePool`.
  - Everything is stack-free.
- **Browser (class B):** Playwright 1.56.1 with chromium, against the built UI on `:4173`
  (`setup-ui-preview`).
  - The catch-all `/api/**` route is registered first. The preview proxies `/api` to `:7778`
    (ledger row `2026-09-21-vite-preview-proxies-live-stack`).
  - `page.routeWebSocket(/.*/)` answers `OK true` to every `EVENT` and `EOSE` to every `REQ`.
  - The fake signer gives each signed event a new id.
- **Fixtures:** fixture pubkeys only: `a1…` the viewer, `a2…` their assistant, `b2…` the profile
  followed, `c3…` an existing follow, `ee…` a TA stand-in. There is also an existing contact list,
  mute list and Map for the viewer.
- **Firmware:** none.

## How to run

**The new Node suite alone:**

```
node -e "require('./test/setup-alert-polish.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

**The browser classes,** after building and serving the UI under test:

```
BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/setup-alert-polish.spec.js tests/brainstorm/setup-alert.spec.js tests/brainstorm/setup-status.spec.js --project=chromium
```

**The story's gate.** One gate-engine run over the 100 suites below, from the repo root:

```
GATE_LABEL=setup-alert-3 node - <<'EOF'
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';   // the same two env vars as test/test.js:14–15
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';
const { execSync } = require('child_process');
const { runGate } = require('./test/helpers/gateRunner');
const { suites } = require('./test/registry');
const named = execSync("/usr/bin/grep -lE 'api/index\\.js|openapi\\.yaml|App\\.jsx|styles\\.css|pages/setup|setupStatus|SetupStatusContext|api/setup|BrainstormUserMenu|BrainstormSearch|Header\\.jsx|components/Header|DevPage|developers/|SetupAlert|setup-alert|nostrPublish|TrustedAssertions|UserDetail|BrainstormSettings|publishToLocalStrfry|onEventPublished' test/*.test.js")
  .toString().trim().split('\n').filter(Boolean).map((p) => p.replace(/^test\//, ''));
const walkers = ['collapse-into-export-concept', 'publish-export-a-concept', 'users-page-neo4j-endpoint', 'in-app-badged-ta-avatar',
  'note-tagging-raw-events-inspector-ui', 'curated-dlist-update-publish', 'my-assistant-page', 'one-writer-assistant-profile',
  'stack-free-npm-test', 'gate-result-record', 'session-start'].map((n) => `${n}.test.js`);
const want = new Set([...named, ...walkers, 'setup-status.test.js', 'setup-alert.test.js', 'setup-alert-polish.test.js']);
const missing = [...want].filter((f) => !suites.some((s) => s.file === f));
if (missing.length) { console.error('not in test/registry.js:', missing.join(', ')); process.exit(2); }
runGate({ suites: suites.filter((s) => s.file && want.has(s.file)), label: process.env.GATE_LABEL });
EOF
npm run gate:status -- --label setup-alert-3
```

Around the run:
- the UI build;
- eslint on the touched UI files, at parity with the base;
- `bash scripts/harness-lint.sh`;
- the browser classes above;
- `/cycle-local`, then a live pass on `:7778` with a real throwaway session;
- **re-run the walker grep after any merge of `origin/staging`** (ledger row
  `2026-09-21-abbreviated-path-names-no-gate`).

### Pinned gate list (computed 2026-09-21, after the `origin/staging` merge)

**The filename grep** is story 2's, extended per ADR 0003 § 7 with `nostrPublish`,
`TrustedAssertions`, `UserDetail`, `BrainstormSettings`, `publishToLocalStrfry` and
`onEventPublished`. It finds 93 suites.
- The extension adds 18: `attach-the-world`, `dlist-curation-map-entries`, `dlist-curation-panel`,
  `dlist-curation-tl-panel`, `event-tag-note-affordance-ui`, `event-tagging-core`,
  `honest-broadcast-reporting`, `honest-publish-reporting`, `profile-website-link`,
  `publish-export-a-concept`, `sessions-read-the-brain`,
  `store-the-four-when-a-goal-is-captured-or-updated`, `structures-the-brain-can-trust`,
  `the-brain-survives`, `tl-treasure-map-optin-publish`, `tl-treasure-map-panel`,
  `treasure-map-panel-summary` and `treasure-map-relay-sync`.
- Several of them test `nostrPublish.js` and the Map pages this story touches.

**The walkers.** `grep -rl readdirSync test/` was re-run after the merge, and triaged against the
branch. The branch touches `ui/src`, `test/`, `tests/brainstorm/` and `engineering-team/`, and
neither `src/` nor `ledger/`.
- **Story 2's ten, still pinned.**
- **Plus `one-writer-assistant-profile`** (it walks `ui/src`; it arrived with the merge).
- **`setup-alert-polish` itself** walks `ui/src` for S2 and is pinned by name.
- **The rest walk trees this branch does not touch:** `src/` (`close-unauth-write-surface`,
  `one-default-assistant-profile`, `reconciliation-rearchitecture`, `event-tagging-*`),
  `firmware/`, `ui/src/pages/brain`, the shared-concepts pages, or temporary directories. Where the
  grep already names one of them, it runs anyway.

In all, 93 named suites plus 7 walkers the grep misses gives **100 suites**, none missing from the
registry.

If the Implementer touches a file outside ADR 0003's list, extend the grep and say so in the story's
Deviations.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-21 on `feat/setup-status-and-alert`
at `9b2aec35` (the ADR commit; the UI is story 2's, as on staging), plus these files.

**The new Node suite: 0 passed, 14 failed.** Each failure names what is missing:

```
FAIL  U1        ui/src/utils/nostrPublish.js must export onEventPublished(listener) (ADR 0003 § Implementation notes 1)
FAIL  U2…U8     onEventPublished is not exported
FAIL  C1        SETUP_ALERT_COPY.button must be the words alone, "Finish setup" … got "Finish setup →"
FAIL  D1        the pill must carry no aria-label: its name is what it shows (story 3 AC-2)
FAIL  D2        SetupStatusContext.jsx must import { onEventPublished } from ../utils/nostrPublish
FAIL  D3        pages/grapevine/TrustedAssertions.jsx: still POSTs to /api/strfry/publish by hand; … (all three pages)
FAIL  S1        the chip's text must be darker than its amber (the owner's call); got #fff on #d29922
FAIL  S2        these files POST to /api/strfry/publish by hand: pages/BrainstormSettings.jsx, pages/grapevine/TrustedAssertions.jsx, pages/users/UserDetail.jsx. …
```

**Story 2's re-aimed Node suite: 6 passed.**

**Browser, against today's build (`index-CVntJGmH.js`, the build on staging):**
- **Story 3's spec: 17 failed, 1 passed.**
  - P0: no `bs-setup-alert-arrow` in the bundle.
  - P1 ×3: the chip's text is `rgb(255, 255, 255)`.
  - P2 ×3: the pill still carries an `aria-label`.
  - P2 singular and P2 Chrome: the names differ.
  - P2 keyboard: the link by its new name is not focused.
  - P3 Follow and P3 both routes: the pill stays at "· 2 steps left".
  - P3 Treasure Map: the Map publishes, but there is one status read, not two.
  - P4 ×4: the pill shows on every case variant.
  - **The one pass** is P3 Mute, the negative control: today nothing re-checks at all.
- **Story 2's re-aimed spec: 50 passed.** Story 1's: 15 passed.

**The tests are satisfiable.** The Tester ran every class against a throwaway implementation of
ADR 0003, built from its Implementation notes in a scratchpad mirror. It is not committed and is not
handed to the Implementer.
- **Node:** 14 passed. Story 2's suite: 6 passed.
- **Browser:** 83 passed: story 3's 18, story 2's 50 and story 1's 15.
- **Two test fixes came out of this run:**
  - D2 first required a match written as `=== 3`. The oracle's guard `ev.kind !== 3 && ev.kind !==
    10040` is equally what the ADR asks, so D2 now accepts either shape.
  - The Map editor offers Publish only once its text changes, so P3 appends a newline before
    publishing.

**The tests catch the mistakes that matter.** Mutations of that implementation, each run against
the classes they concern:

| Mutation | Fails |
|---|---|
| no de-duplication, and any kind re-checks | P3 both routes (3 reads, not 2); P3 Mute (2 reads, not 1) |
| the old `aria-label` kept | all six P2 tests |
| the case-sensitive `/setup` check kept | all four P4 tests |
| the external route announces nothing | U5 ("heard []") |
| a refused local publish is announced anyway | U3 ("heard 1") |

**The scoped gate at this phase** is the baseline for Implementation and Review, run with the driver
above under the label `setup-alert-3-testdesign`:

```
20260921T230623Z-62382-a329 [setup-alert-3-testdesign] started 2026-09-21T23:06:23.309Z on 9b2aec35+dirty — FAIL, exit 1, 1996 passed, 14 failed, 4 skipped, 100/100 suites; failed: setup-alert-polish
```

**The only failing suite is the new one,** with its 14 reds. The other 99 are green at the base,
so any other red at Implementation or Review is new. The four skips are the known environmental and
opt-in ones: `deploy-safety-status` 1, `show-the-four-on-the-goal-screens-that-already-exist` 2,
and `setup-status` H2 1.

### During Implementation (two test fixes, made as the Tester)

The first 100-suite gate on the implementation (`20260921T231551Z-82497-86f3`) had two reds. Neither was in
the code:

- **`treasure-map-relay-presence` R2** pins the literal `/api/strfry/publish` in `TrustedAssertions.jsx`. ADR
  0003 § 2 moves that page's import onto `publishToLocalStrfry`, which sends the same request, so the literal
  left the page. R2 now accepts either form, and its intent ("the import still posts to the local relay") is
  kept.
  - The ADR's re-aim list and this plan's grep missed it. They looked for the pill's removed copy and name,
    not for the endpoint path.
  - This is the fourth instance of ledger row `2026-09-21-adr-reaim-list-misses-outcome-asserts`.
- **U5** failed inside the gate, though it passed on its own. `test/honest-publish-reporting.test.js`
  installs a fake socket in nostr-tools that accepts every relay, and never removes it. So in the shared
  process, the unreachable `ws://127.0.0.1:1` read as "accepted".
  - U5 and U8 now install the real socket, the library's default, before they publish.
  - Ledger row `2026-09-21-honest-publish-fake-socket-leaks` records the leak.

Run in the gate's order in one process (`honest-publish-reporting`, then `setup-alert-polish`, then
`treasure-map-relay-presence`), all three pass: 10/0, 14/0 and 35/0. Neither fix weakens a check.

