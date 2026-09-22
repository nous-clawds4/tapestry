# Test Plan: Story 3 — The Setup Alert: readable, announced as it reads, and current

**Story:** `engineering-team/stories/setup-status-and-alert/3-setup-alert-polish.md`
**ADR:** `engineering-team/decisions/setup-status-and-alert/0003-readable-named-and-current.md`
**Date:** 2026-09-21

Two new files carry the tests, and two of story 2's files change so they stop pinning what ADR 0003
replaced.

- **`test/setup-alert-polish.test.js`** is the Node suite, registered in `test/registry.js` after
  `setup-alert.test.js`. It has 17 tests in four classes (14 at Test Design; round 2 added U9 and U10, round 3 added S3):

  | Class | What it tests | How |
  |---|---|---|
  | **U** ×10 | the publish signal in `ui/src/utils/nostrPublish.js` (ADR 0003 § 1, Amendment 1): each call announces at most once, and `publishEverywhere` announces once, after the local write | the real module in Node, a fresh instance per test. `fetch` is stubbed, and the external route publishes to stub relays served by the `ws` package on 127.0.0.1: one that accepts, one that refuses, and a port with no relay |
  | **C** ×1 | the alert's copy (§ 5) | `steps.js` loaded as ESM |
  | **D** ×3 | the pill (§ 4), the provider's listener (§ 3), and the three import sites (§ 2) | source sentinels |
  | **S** ×3 | the chip's contrast (§ 6, AC-1); the pages that POST to `/api/strfry/publish` by hand (§ 7); and that only `nostrPublish.js` sets the `announce` option, in any spelling (Amendment 1; widened in round 4) | computed from `styles.css`; walks of `ui/src` |

- **`tests/brainstorm/setup-alert-polish.spec.js`** is the Playwright B class, 23 tests (P0–P4; 18 at Test Design; rounds 2 and 3 added three P3 cases, and round 4 added P3 Unfollow and a fresh-load P4),
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
| **AC-3** catches up after an in-app save | **P3** Follow (kind 3, a profile page): the mock holds the re-check's answer back until the test releases it. While it is held, the pill (sampled every 100 ms) shows nothing, never the old "2 steps left". Its log, from the entry in force when the re-check reached the server until the release, never carries it either. `/setup`, reached in-app, shows "0 of 3 complete" with no step marked done, never the old "1 of 3". Once released, `/setup` shows "2 of 3 complete" and the pill "· 1 step left", in the same document, after exactly two reads (round 4; the first version logged only changes, so a provider that kept the old answer passed it). **P3** Unfollow (round 4): the same the other way. The one follow is removed and the step is counted again ("· 1 step left" → "· 2 steps left", "2 of 3" → "1 of 3"). **P3** both routes: a Follow reaching the local relay *and* outside relays is announced once, so it re-checks once. **P3** race (round 2): with the local write held behind relays that accept at once, and the status read answering from the local relay, the pill still ends on the new answer. **P3** import (round 2): the Map page's "Import to local strfry" re-checks. `/setup`, reached in-app, shows "3 of 3 complete", and only then does the test check that no pill remains (round 4). **P3** second way in (round 3): a Map edit whose local write fails while the relays accept, then an import of that same event, re-checks each time (three reads), ending the same way. **P3** Mute (kind 10000): no re-check (the negative control). **P3** Treasure Map editor (kind 10040, as the Owner): one re-check, ending the same way. **U1–U10**: the signal itself. **D2**: the provider's filter (the viewer's pubkey, kinds 3 and 10040) and no record of ids heard. **D3**: the import sites. **S2**, **S3**: no new hand-written publisher, and no other caller silencing the announcement, goes unnoticed. | both | browser; unit |
| **AC-4** hidden in any letter case | **P4** ×4: `/SETUP`, `/Setup/Follow`, `/SETUP/ACTIVATE`, `/Setup/create-account` are each reached in-app after `/tags` has drawn the pill for the same viewer. So the answer is in, and moving does not read again. Each renders a setup page (`main.bs-setup-main`) with no pill. **P4** fresh load: `/SETUP` loaded afresh shows no pill once its own answer shows ("1 of 3 complete"). Round 4: before, each variant was loaded afresh and checked after a fixed wait, which also passes while the check runs. **D1** (the lower-cased comparison). | both | browser; unit |
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
- [x] **One publish reaching both routes** is announced once (U8), so it causes one re-check (P3, both routes). **A second publish of the same event** (the import after a failed local write) re-checks again (P3, second way in).
- [x] **A setup-irrelevant publish by the viewer** (kind 10000) causes no re-check (P3 Mute).
- [x] **The old answer is never current during the re-check,** on the pill or on `/setup` (P3 Follow and P3
  Unfollow). The re-check's answer is held back while both are sampled every 100 ms, and the pill's log is read
  from the entry in force when the re-check reached the server. Before the publish the old count is simply the
  latest answer.
- [x] **A "no pill" check counts only once the answer is in,** because the pill also hides while a check runs
  (round 4). The Map tests end on `/setup` showing 3 of 3. P4 moves in-app after the pill is drawn, and P4's
  fresh load waits for "1 of 3 complete".
- [x] **A case variant whose prefix is already lower case** (`/setup/CREATE-ACCOUNT`) was hidden
      even before this story, so P4 uses `/Setup/create-account` instead.
- [ ] **Not covered, by scope:**
  - publishes from other apps or tabs (story § Out of scope);
  - UserDetail's "Find" and Settings' import in the browser. Round 1 probed both by hand. The Map page's import
    is driven by P3 import and P3 second way in. D3 and S2 pin all three pages' route through
    `publishToLocalStrfry`, and U2 pins what that helper then does;
  - the three step pages loaded afresh. They show no answer to wait for, so P4 reaches them in-app, where the
    answer is known to be in. The path check does not depend on how the page was reached;
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

**The story's gate.** One gate-engine run over the 103 suites below, from the repo root. There were 100 at Test Design. The
branch has touched `ledger/` since round 1's implementation, so round 2 added `harness-lint` and `ledger-row-ids`, and
round 3 added `rollup-scanners`:

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
const ledgerReaders = ['harness-lint', 'ledger-row-ids', 'rollup-scanners'].map((n) => `${n}.test.js`);
const want = new Set([...named, ...walkers, ...ledgerReaders, 'setup-status.test.js', 'setup-alert.test.js', 'setup-alert-polish.test.js']);
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
registry. With the three suites that read `ledger/` (rounds 2 and 3), the gate is **103 suites**.

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
| no de-duplication, and any kind re-checks (round 1's design; now the de-duplication itself is gone, and only the kind filter still matters) | P3 both routes (3 reads, not 2); P3 Mute (2 reads, not 1) |
| the old `aria-label` kept | all six P2 tests |
| the case-sensitive `/setup` check kept | all four P4 tests (round 4: all five, in-app and fresh, including with every answer 2 s late) |
| the provider keeps the old answer while it re-checks the same viewer (review round 3's mutant; round 4) | P3 Follow and P3 Unfollow, at the pill's samples. With the samples removed, the log check alone fails too |
| `/setup` alone keeps the old answer while the re-check runs (round 4) | P3 Follow and P3 Unfollow, at `/setup`'s samples; the pill's checks pass |
| the old answer stays for the first 250 ms of a re-check (round 4) | P3 Follow and P3 Unfollow. With the samples removed, the log check alone fails too |
| the pill is drawn with nothing counted (round 4) | P3 Follow and P3 Unfollow ("· 0 steps left" while the re-check runs); the three Map tests ("nothing is left, so no pill") |
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

Run in one process in the gate's order (`honest-publish-reporting`, then `treasure-map-relay-presence`, then
`setup-alert-polish`, as `test/registry.js` lists them), all three pass: 10/0, 35/0 and 14/0. Neither fix
weakens a check.
- **Correction (review, Non-blocking 3):** the first version of this paragraph gave the order wrongly. Also,
  `9fa997af` touched `ledger/`, after the triage said the branch did not. `session-start` was already pinned,
  and the other readers passed on their own. See the extended ledger row
  `2026-09-21-abbreviated-path-names-no-gate`.

### Round 2 (after the review asked for changes)

The review's Blocking 1 is a race in ADR 0003's first design.
- The outside relays could announce a Follow or a Map edit before the local write.
- The re-check then read the local relay too early, and the local write's own announcement was
  dropped as a duplicate.

ADR 0003 Amendment 1 changes the design: `publishEverywhere` announces once, straight after the local
write when it succeeds, and every announcement re-checks. These tests pin it:

| Test | What it pins | On today's code (`bad15295`) |
|---|---|---|
| **P3** race (new) | the local write held back 800 ms behind relays that accept at once, and the status read answers from what the local relay holds (old until the new event is stored). The pill must end on "· 1 step left" and stay there, after exactly two reads | **fails**: "the pill must end on the new answer" (it stays at "· 2 steps left") |
| **P3** import (new) | the Map page's "📥 Import to local strfry": the Map only outside, then one re-check, and the pill goes. The review noted no browser test drove an import site | passes (a guard; the import already announces) |
| **U8** (re-aimed) | `publishEverywhere` announces exactly once, after the local write, even when the relay settles first | **fails**: "heard 2" |
| **U9** (new) | the local write refused and a relay accepted: one announcement | passes (a guard) |
| **U10** (new) | nothing reached a relay: no announcement | passes (a guard) |
| **D2** (re-aimed) | the provider keeps no record of ids heard, so every announcement re-checks | **fails** |

Fixture notes:
- The import test holds the sign-in answer back 800 ms. The Map page searches once, when sign-in
  resolves, and would otherwise miss its relay list (OPEN.md row 260).
- The import button sits in the "Where this Map lives" panel, which is folded by default.

**Satisfiable.** A throwaway Amendment 1 on HEAD's code, in a scratchpad mirror (not committed):
- Node: 16/16;
- browser: 85/85 (story 3 20, story 2 50, story 1 15).

**Not pinned by a test:** that the announcement comes straight after the local write *without waiting
for the relays*. U8 pins "after the local write", and the race test pins the result. Waiting for the
relays too would only delay the catch-up by up to the relays' publish timeout.

**Round 2, during Implementation: one more re-aim (made as the Tester).** The implementation keeps the
local-only guard inside `publishToRelays`, so `global-publish-gate`'s coverage check holds (see the
story's Deviations). It gives the two exported routes an optional `{ announce }` argument, which
`publishEverywhere` sets to `false`.
- `treasure-map-relay-sync` R4 matched the exact text `publishToRelays(signedEvent, relays =
  PUBLISH_RELAYS)`, closing parenthesis included.
- Its message says the intent: "signature must not narrow". An optional third parameter widens the
  signature, so R4 now accepts a comma or a closing parenthesis after the relay list.
- This is another by-value literal that the amendment's re-aim list missed (ledger row
  `2026-09-21-adr-reaim-list-misses-outcome-asserts`).

### Round 3 (after round 2's review asked for changes)

Round 2's Blocking 1 was a flaw in a test: **P3 import** checked that the pill was gone before checking the read
count. The pill also hides while a re-check runs, so the test raced (3 of 30 runs failed on correct code) and
passed on a stale final answer (6 of 20). No code changed in this round. What changed:

- **P3 import** polls for the second read first, then checks the pill (the order the Map-editor test already used).
- **P3 second way in** (new, the reviewer's probe L):
  1. the hand editor publishes a Map edit whose local write is refused while the relays accept (one re-check);
  2. the page finds the edit outside, and "Import to local strfry" publishes that same event (a second re-check);
  3. three reads in all, and the pill goes.

  The mock gained `localRefusals`, and outside relays that record what they accept and serve it back.
- **S3** (new): only `utils/nostrPublish.js` passes `announce: false`.
- **The first half of this plan** now describes Amendment 1's design: the counts, the AC-3 row, the edge case,
  and the mutation row.

**Evidence, all on 2026-09-21:**

| Run | Result |
|---|---|
| Story 3's spec on HEAD's build (`index-DNK2T4Hx.js`) | 21 passed |
| Every P3 test with `--repeat-each 20` on HEAD | 140 passed, 0 failed (20 each, 7 tests) |
| The old code (`bad15295`, rebuilt: `index-8tznIVuA.js`) | P3 race **fails** ("the pill must end on the new answer"); P3 second way in **fails** ("Expected: 3, Received: 2"); the rest pass |
| A mutant keeping id memory in an object (it passes D2's source check and the whole Node suite) | only P3 second way in **fails** ("Expected: 3, Received: 2"). So the "every announcement re-checks" rule is now pinned by behaviour, not only by D2's pattern |
| A copy of the spec whose status mock always answers the stale "1 step left" for the two import tests, `--repeat-each 20` | P3 import 0 passed, 20 failed; P3 second way in 0 passed, 20 failed. Their final checks bite |
| The Node suite | 17 passed (S3 new) |

This follows ledger row `2026-09-21-single-run-satisfiability`: repeat runs on the build, and a stale-answer
mutation of the mock, before calling a browser test satisfiable.

### Round 4 (after round 3's review asked for changes)

Round 3's Blocking 1: P3 Follow's check that the pill "never shows the old count while the re-check runs" could not
fail. Its recorder logged only changes, so a provider that kept showing the old answer added no entry. The reviewer's
two-line mutant passed all 86 browser tests of stories 1–3. No code changed in this round. What changed:

- **P3 Follow** holds the re-check's answer back and checks the state in force while it is held. The mock answers
  `{ body, hold: true }` only when the test calls `state.release()`. A shared helper, `expectHeldRecheck`, checks:
  - **the pill,** sampled every 100 ms for 1.2 s: nothing (story 2), never the old count;
  - **the pill's log,** from the entry in force when the re-check reached the server until the release: no entry with
    the old count, so a flash between two samples fails too;
  - **`/setup`,** reached in-app while the read is still held and sampled the same way: "0 of 3 complete" with no step
    marked done (story 1), never the old "1 of 3". The move is `history.pushState` plus a `popstate` event, as
    `my-assistant-page.spec.js` does;
  - **after the release:** `/setup` shows "2 of 3 complete". Back on the profile page, the pill shows "· 1 step left".
    Two reads, one document.
- **P3 Unfollow** (new; Non-blocking 4): the viewer unfollows the one account they follow, and the step is counted again
  ("· 1 step left" → "· 2 steps left", "2 of 3" → "1 of 3"), through the same helper.
- **The Map tests** (P3 import, P3 second way in, P3 Treasure Map editor; Non-blocking 1) end on a finished answer.
  `/setup`, reached in-app, shows "3 of 3 complete" and "You're all set!". Only then, back on the Map page, do they
  check that no pill remains.
- **P4** (Non-blocking 1): each case variant is reached in-app after `/tags` has drawn the pill, so the answer is in, and
  moving does not read again. A new test loads `/SETUP` afresh and checks the pill once "1 of 3 complete" shows. The
  three step pages show no answer to wait for, so they are covered in-app only (see "Not covered").
- **S3** (Non-blocking 3) finds the option in any spelling: a bare or quoted key, a shorthand property, or a member.
  Comments are dropped first. A control requires it to find the option where it lives, in `nostrPublish.js`.
- **This plan** (Non-blocking 2): the AC-3 and AC-4 rows, the edge cases and the not-covered list describe the tests as
  they are, and the mutation table has round 4's mutants.
- **The mock** records each published event's tags (for Unfollow). `state.publishedAt` is gone; nothing read it once
  the old log check went.

**The mutants,** each built from HEAD's source in a scratchpad mirror and served on its own port (not committed):
- **M1** is the reviewer's, from the round-3 review: the provider keeps the held answer while it re-checks the same
  viewer.
- **M2:** the provider also exposes its held answer. `useSetupStatus({ keepOld: true })` summarizes that answer while
  checking, and only `/setup` asks for it, so the pill still hides.
- **M3:** a 250 ms grace. For the first 250 ms of a re-check of the same viewer the phase stays `answered` with the old
  answer, and a timer re-renders once the grace is over.
- **M4:** story 2's case-sensitive hide: `const path = pathname;` in `SetupAlert.jsx`.
- **M5:** the pill is drawn with nothing counted: `pendingCount < 0` in place of `< 1`.

**Evidence, all on 2026-09-21 (local time):**

| Run | Result |
|---|---|
| Story 3's spec on HEAD's build (`index-DNK2T4Hx.js`), `--repeat-each 20` | 460 passed, 0 failed (23 tests) |
| M1 | P3 Follow and P3 Unfollow fail 40 of 40, at the pill's samples. A copy of the spec with the samples removed fails 40 of 40 at the log check |
| M2 | P3 Follow and P3 Unfollow fail 40 of 40, at `/setup`'s samples; the pill's checks pass |
| M3 | 40 of 40 fail; the first samples catch it. With the samples removed, the log check alone fails 40 of 40 |
| M4 | all five P4 tests fail, 100 of 100. With every answer 2 s late, 100 of 100 |
| M5 | P3 Follow and P3 Unfollow fail 40 of 40 ("· 0 steps left" while the re-check runs); the three Map tests fail 60 of 60 ("nothing is left, so no pill") |
| A copy of the spec whose re-check answers the viewer's state from before the save, at once | the seven P3 tests that end on a new answer fail 140 of 140. Mute, which never re-checks, passes 20 of 20 |
| The same, served 300 ms late | 140 of 140 fail; Mute passes 20 of 20 |
| P4 with every answer 2 s late, on HEAD | 100 of 100 pass |
| S3 in a scratch mirror, with the option spelled `{ 'announce': false }`, `{ announce: quiet }`, `{ announce }` and `opts.announce = false` | S3 fails each time, and nothing else does. A comment naming the option does not trip it |
| The Node suite | 17 passed |
| Story 2's and story 1's browser classes, and the four `/assistant` specs, on HEAD | 50, 15 and 40 passed |
| The scoped gate, 103 suites (`20260922T032453Z-4142-43cd [setup-alert-3-r4]`) | PASS: 2128 passed, 0 failed, the usual 4 skips |

This follows ledger row `2026-09-21-single-run-satisfiability`, with round 3's two clauses: each "never shows X" check
has a code mutant that keeps showing X, and the stale answer is served late as well as at once.

**Left for later:** story 2's spec has the same "no pill" shape (B4, B5). It is out of this round's scope, and is ledger
row `2026-09-22-setup-alert-no-pill-checks-early`.
