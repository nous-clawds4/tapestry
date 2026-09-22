# Test Plan: Story 1 — The Assistant Management page, its FAQ and ten placeholder action pages

**Story:** `engineering-team/stories/assistant-management/1-the-assistant-management-page.md`
**ADR:** `engineering-team/decisions/assistant-management/0001-the-hub-takes-assistant-and-the-editor-moves-under-it.md`
**Date:** 2026-09-21

Two classes, as in the `/setup` books:

- **Node (CI-run).** `test/assistant-management-page.test.js` has five classes:
  - D: the data module;
  - M: the two addresses;
  - W: the browser code, by source;
  - O: outside the app;
  - H: a live guard.
- **Browser.** `tests/brainstorm/assistant-management-page.spec.js`, B0–B13. CI runs no browser, so the W-class
  is the CI backstop for what the B-class shows.

Both read the approved words from one file, `test/helpers/assistantManagementFixtures.js`. It holds the
story's § Copy with its display fixes, so a suite cannot drift from the story or from the other suite.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 the page | D1 sections in order · D2 the ten actions (order, section, address, title, description) | `test/assistant-management-page.test.js` | unit (ESM) |
| AC-1 | W1 App.jsx routes the hub · W4 the hub wears `<TopBar />` and renders sections, actions and FAQ from the data module | same | source |
| AC-1 | B1 kicker, heading, three named regions in order, ten cards in order, each card's title and description | `tests/brainstorm/assistant-management-page.spec.js` | browser |
| AC-2 needs attention, for whom | D6 count wording · D7 `assistantAttention(user)` for six viewers (visitor, guest, Admin with no key, Owner with a missing key, Customer, Owner) | Node | unit |
| AC-2 | W3 the hub reads no instance TA and asks nothing · W4 marks come from `assistantAttention` | Node | source |
| AC-2 | B1 ten marks, ten "Needs attention: ‹title›" link names, the count line · B2 signed out · B3 no assistant (link to `/setup`) · B4 sign-in resolving: no mark or line ever shows | browser | browser |
| AC-3 cards are links | D3 exactly three link parts, the approved text and address; seven none · D8 every address under the hub | Node | unit |
| AC-3 | W5 link parts use `target="_blank"` and `rel="noopener noreferrer"` | Node | source |
| AC-3 | B5 a click on the description (by position) or Enter opens the card's page; each card is an `<a href>` · B6 each NIP link opens its NIP in a new tab and the card's page does not open | browser | browser |
| AC-4 the FAQ | D5 the five questions and answers, in order, "follows (kind 3)" | Node | unit |
| AC-4 | W4 the FAQ is a `<details>/<summary>` (or an `aria-expanded` toggle), not open by default | Node | source |
| AC-4 | B7 closed, below the heading and above the first section; click, Enter and Space toggle it; its state is announced; the questions come in order; a reload closes it | browser | browser |
| AC-5 placeholder pages | D4 criteria, notes and the profile's editor link, `null` where the owner gave none | Node | unit |
| AC-5 | W1 the ten routes are generated from `ASSISTANT_ACTIONS` · W3 placeholders ask nothing | Node | source |
| AC-5 | B8 × 10, one per address: heading, "Placeholder page.", description, NIP link, "Alert criteria" (or "Not yet defined."), "Planning notes" only where given, back link, the editor link only on the profile page | browser | browser |
| AC-6 the editor moves | M1 `MY_ASSISTANT_PATH` = `/assistant/profile/edit`, `ASSISTANT_MANAGEMENT_PATH` = `/assistant` · M2 "My Assistant's Profile" → editor, "Assistant Management" → hub, in both menus | Node | unit |
| AC-6 | W1 the editor route · W2 heading "Edit Assistant Profile", back link to `/assistant/profile`, renamed `EditAssistantProfilePage` · W6 the `/settings` card's words | Node | source |
| AC-6 (outside the app) | O1 `src/utils/assistantPages.js` equals the UI constant · O2 both legacy panels' sentence and link · O3 BIBLE §14 · O4 the sweep: no literal `'/assistant'` (except the hub's constant), no `href="/assistant"`, no "(/assistant)", no "My Assistant page" left in code under `ui/src`, `src`, `public` and `bin`, or in BIBLE | Node | source |
| AC-6 | B9 the editor at its new address: heading, back link, editor present; a visitor still asked to sign in · B10 the `/settings` card | browser | browser |
| AC-6 (re-aimed) | the menus, Dashboard, banner, Settings tab and old address: `tests/brainstorm/my-assistant-page.spec.js` B4–B11 · the refusals and legacy links: `test/one-writer-assistant-profile.test.js` G1, G2, P2, P4–P6, W4; `test/one-default-assistant-profile.test.js` R1 | (see § Re-aimed suites) | mixed |
| AC-7 direct loads | H1 the reachable instance answers 200 with the app shell for all twelve addresses (guard) · B11 each address typed in and refreshed | Node + browser | live + browser |
| AC-7 phone width | B12 375 px: hub signed out, hub signed in with the FAQ open, `/assistant/preferences`, the editor | browser | browser |
| AC-7 read-only | W3 no `fetch`, no `/api/`, no `useSetupStatus` in the hub, the placeholders or the data module · B13 the hub's and a placeholder's `/api` reads are a subset of a `/setup` placeholder's (the same `<TopBar />`), and no request is anything but a GET | Node + browser | source + browser |

## Re-aimed suites (ADR 0001 § Implementation notes, Test-file changes)

Each edit is marked in the file with a comment naming assistant-management #1.

| Suite | What changed | Before the move | After |
|---|---|---|---|
| `test/my-assistant-page.test.js` | `PAGE` → `EditProfile.jsx`. `MY_ASSISTANT` → `/assistant/profile/edit`, plus `ASSISTANT_MANAGEMENT`. M5 checks both constants and "Assistant Management" → hub. W1 checks the editor route by constant. W2 checks the redirect target. W4–W6 no longer accept a literal `'/assistant'`. W17 checks the component name `EditAssistantProfilePage`. | M3, M5, W1–W3, W14, W17–W19 fail | pass |
| `test/one-writer-assistant-profile.test.js` | `MY_ASSISTANT`. `pointsToThePage` looks for "Edit Assistant Profile page" and "(/assistant/profile/edit)". The Dashboard regex and the messages follow. | G1, G2, P2, P4–P6, W4 fail | pass |
| `test/one-default-assistant-profile.test.js` | R1: the legacy link goes to `/assistant/profile/edit` | R1 fails | passes |
| `test/assistant-setup-state.test.js` | D6: the regex no longer accepts a literal `'/assistant'`; the words follow | passes | passes (guard) |
| `tests/brainstorm/my-assistant-page.spec.js` | `MY_ASSISTANT`, plus `ASSISTANT_MANAGEMENT`. B2 heading "Edit Assistant Profile". B4, B5 and B11: the two menu items lead to different pages. | fails | passes |
| `tests/brainstorm/assistant-setup-prompt.spec.js` | the prompt's destination is `EDITOR` (B3–B5, B8) | fails | passes |
| `tests/brainstorm/one-writer.spec.js` | `MY_ASSISTANT`. B2 and B3's check of the legacy link's words (`/My Assistant/` → `/Edit Assistant Profile/`). Phase 3 missed that assertion; the Implementer's browser run caught it, and it was re-aimed in its own test commit (ledger `2026-09-21-adr-reaim-list-misses-outcome-asserts`, fourth instance). | fails | passes |
| `tests/brainstorm/assistant-default-profile.spec.js`, `assistant-publish-result.spec.js`, `ta-composite-avatar.spec.js` | `page.goto` to the editor's address | fail | pass |
| `tests/brainstorm/setup-alert.spec.js` *(added 2026-09-21, after review 2: it is setup-status-and-alert #2's suite, and it reached this branch with the merge of `origin/staging` at `fc7021f2`)* | Its host row, "the My Assistant page (/assistant)", becomes "the Edit Assistant Profile page (/assistant/profile/edit)". B9, which creates an assistant with the editor's button, opens `/assistant/profile/edit`. | B9 fails ("the page offers to create an assistant": the hub has no such button) | passes |

## Edge cases

Scenarios not derivable from any single criterion, or kept as regression sentinels:

- [x] **An Owner whose TA key is missing** has no assistant for this page: no marks (D7). This matches
      `/setup`'s first step, where `getAssistantPubkeyFor` answers null.
- [x] **Sign-in resolving** never flashes a mark, the sign-in line or the no-assistant line (B4). The
      sampling runs while both auth reads are held back.
- [x] **A click on the description, not the title**, opens the card (B5). This is the stretched-link
      contract, clicked by position, the way a person clicks. The card is scrolled into view first,
      because `mouse.click` does not scroll. That line was added in Phase 4, after the first
      implementation run clicked outside the viewport.
      - **The check has teeth.** Probed at Phase 4 with the CSS broken on purpose, a removed overlay
        and a restored `opacity: 0.7` on the text each leave the click on the description, and the
        page does not move.
      - **The second one was a real defect.** It is why the card text fades by colour (story 1
        § Deviations).
- [x] **A NIP link click must not also navigate** the page to the card's address (B6). The URL is
      checked after the popup.
- [x] **The editor keeps its visitor branch** after the move (B9, and W17 re-aimed).
- [x] **The stale-address sweep** (O4) is a sentinel no AC names. It catches the defect class
      assistant-profile #5 created, a hand-written `/assistant` outside the constant, in any file the
      next change touches. Comments are exempt; block comments are blanked line-for-line, so a hit's
      line number is true.
- [x] **Import-free modules** (D9, M3): `actions.js` has exactly one import, and
      `avatarMenuLinks.js` none, so three Node suites can keep loading them.
- [x] **`plainText` agrees with the descriptions** (D10). The fixtures compute plain text
      independently, so a wrong `plainText` cannot hide a wrong description.

**Not covered, and why:**

- **What a real screen reader says.** B7 reads the state assistive technology reads: `details.open`
  or `aria-expanded`. It does not drive VoiceOver.
- **Looking "like /setup".** That is a judgement, not a pass/fail check. The Reviewer compares
  screenshots of `/setup` and `/assistant`.
- **The editor's own behaviour** (publish, create a key, relay results). It is unchanged, and the
  re-aimed my-assistant-page, one-writer and publish-result suites cover it at the new address.
- **Staging.** AC-7's "on staging" is checked after deploy, by `curl` of the twelve addresses
  (ADR § Checks at implementation). No suite here targets staging.

## Test infrastructure

- **Node:** the built-in runner, through the gate engine (`test/helpers/gateRunner.js`). Node 22 x64 is
  needed for H1, which uses global `fetch`. This host's default Node is 16, where H1 skips. Use
  `/private/tmp/claude-506/-Users-VIRGIL-repos-nous-clawds4-tapestry/5d02cb1c-4377-45f9-830c-895986c07b46/scratchpad/node-v22.23.2-darwin-x64/bin`
  (memory `host-gate-at-ci-parity`).
- **Browser:** Playwright 1.56, project `chromium` (a one-time `npx playwright install chromium`).
  - The base URL is the local stack, `http://localhost:7778`, serving a UI built in the container
    with `scripts/dev-refresh.sh --ui`. On this host `ui/node_modules` holds Linux binaries, so a
    host-side `vite build` / `vite preview` is not available.
  - Every spec registers its `/api/**` catch-all first, and the NIP hosts are answered locally, so
    nothing reaches the live stack's API or the internet (ledger row
    `2026-09-21-vite-preview-proxies-live-stack`).
- **Concept graph / firmware:** none. No concept changes.
- **Fixtures:** `test/helpers/assistantManagementFixtures.js`, the approved words and addresses, shared
  with story 2.

## How to run

The two Node suites of this story, alone (never `node test/x.test.js`; call `run()`):

```
PATH=<node22>/bin:$PATH node -e "require('./test/assistant-management-page.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

The browser class, after `scripts/dev-refresh.sh --ui`:

```
BRAINSTORM_BASE_URL=http://localhost:7778 npx playwright test tests/brainstorm/assistant-management-page.spec.js --project=chromium
```

**The book's gate.** One gate-engine run covers both stories, because they ship together. It runs the
106 suites below, under `GATE_LABEL`, and is read back with `npm run gate:status -- --label <label>`.
The full `npm test` is not the gate here: it is red by default on this host (memory
`host-gate-at-ci-parity`). The Implementer runs a labelled baseline before changing code and compares
the two records suite by suite.

```
GATE_LABEL=assistant-management PATH=<node22>/bin:$PATH node - <<'EOF'
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';   // the two env vars test/test.js sets
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';
const { execSync } = require('child_process');
const { runGate } = require('./test/helpers/gateRunner');
const { suites } = require('./test/registry');
const PAT = "App\\.jsx|avatarMenuLinks|pages/assistant|BrainstormSettings|styles\\.css|assistantPages|api/assistant/index|api/assistant/?[^/]|publishEvent|nip85\\.html|customer\\.html|BIBLE\\.md|topBarAlert|TopBarAlert|BrainstormUserMenu|BrainstormSearch|components/Header|DevPage|assistantManagementFixtures";
const named = execSync(`/usr/bin/grep -lE '${PAT}' test/*.test.js`).toString().trim().split('\n').map((p) => p.replace(/^test\//, ''));
const walkers = ['close-unauth-write-surface', 'collapse-into-export-concept', 'event-tagging-core', 'gate-result-record', 'ledger-row-ids',
  'publish-export-a-concept', 'session-start', 'stack-free-npm-test', 'users-page-neo4j-endpoint'].map((n) => `${n}.test.js`);
const want = new Set([...named, ...walkers]);
const missing = [...want].filter((f) => !suites.some((s) => s.file === f));
if (missing.length) { console.error('not in test/registry.js:', missing.join(', ')); process.exit(2); }
runGate({ suites: suites.filter((s) => s.file && want.has(s.file)), label: process.env.GATE_LABEL });
EOF
```

### Pinned gate list (computed 2026-09-21, 106 suites)

- **The filename grep finds 98 suites.** Its pattern covers every path the two stories touch: the
  app routes, the menu constants, the assistant pages, the `/settings` page, `styles.css`, the server
  message modules, the legacy pages, BIBLE, the slot and its mounts, and the shared fixture.
- **Eight walkers are added,** from `grep -l readdirSync test/*.test.js`: the suites that read every
  file under `ui/src`, `src`, `public`, BIBLE or `test/`, which a filename grep cannot find.
- **After the merge of `origin/staging` (2026-09-21, `fc7021f2`), 107 suites.** The command computes its
  list when it runs, and the filename grep now also finds `setup-alert`, the Setup Alert's suite, which reads
  the same four mounts. `grep -l readdirSync` after the merge finds no new walker: its two other hits,
  `reconciliation-rearchitecture` and `session-start`, predate the pin and read one fixed folder each.
- **After review 2, round 2: 108 suites.** `session-start` joins as a walker. The one folder it reads is
  `ledger/`, and this branch adds rows there. Staging's `c47becd6` clause asks walkers to be triaged
  against the whole diff, not only the code. `reconciliation-rearchitecture` stays out: it reads
  `src/pipeline/reconciliation/`, which this branch does not touch.

The list:

add-a-concept-to-a-tapestry, add-node-as-element-restore, admin-tools-dashboard-panel,
adoption-candidates-queue, adoption-raw-event-view, adoption-twins, **assistant-alert**,
**assistant-management-page**, assistant-publish-relays, assistant-setup-state, attach-the-world,
author-scoped-inspection-roster, author-scoped-inspection-views, b-coverage-audit-and-disposition,
brain-first-tapestry-authoring, break-a-goal-into-pieces, capture-a-goal-and-see-it,
close-unauth-write-surface, collapse-into-export-concept, community-reference-nostr-relay-stub,
concept-count-canonical, create-tapestry, curated-dlist-update-pointer-switch,
curated-dlist-update-publish, customize-pin-curation-publish, default-deny-mutations,
dlist-curation-header-endpoint, dual-z-writer, event-less-create-set, event-page-ui,
event-tagging-core, event-tagging-firmware-seed, event-tagging-write-path, gate-result-record,
harness-lint, honest-broadcast-reporting, in-app-badged-ta-avatar, inverse-queue-publish-candidates,
ledger-row-ids, live-feed-feed-page, login-failure-and-tag-collapse, most-pinned-tag-index-publish,
my-assistant-page, my-curated-dlists-items, my-curated-dlists-page, nip05-checkmark-verification,
nip51-list-export-from-pins-publish, note-surfaces-ui, note-tagging-raw-events-inspector-ui,
one-default-assistant-profile, one-writer-assistant-profile, pin-a-tag-publish, pin-a-tag,
pin-detail-into-tag-pinned-tab, pov-resolution-status, pov-selectable-tag-surfaces,
pov-state-unification, profile-followers-list, profile-follows-list, profile-hops-path,
profile-identity-details-popover, profile-tags, profile-verified-reporters-count,
publish-event-signature-verification, publish-export-a-concept, publish-time-default-stamping,
recognizable-published-ta-profile, relationship-primitives-probe, relationship-primitives,
retire-offering-vocabulary, scheduled-search-and-house-scores-refresh,
search-api-result-type-settings, search-result-parity, search-results-url, sessions-read-the-brain,
setup-status, shared-by-me, shared-concepts-row-detail,
show-the-four-on-the-goal-screens-that-already-exist, site-trust-signals, stack-free-npm-test,
stamped-composite-avatar, state-on-concept-page, store-the-four-when-a-goal-is-captured-or-updated,
strfry-wipe-owner-gate, strfry-write-assertion-bracket, structures-the-brain-can-trust,
summaries-element-count, tag-actions-menu-ui, tag-detail-curated-view-and-pin-polish-publish,
tag-detail-curated-view-and-pin-polish, tagging-raw-event-inspector-ui,
tapestry-per-concept-detail-views, task-queue-semaphore-protection-audit, teach-it-what-matters,
the-brain-survives, the-proposal-loop, tl-certainty-method, tl-membership-method-selector,
tl-publication-from-pins-publish, tl-weighted-sum-method, treasure-maps-router-preset,
trusted-dictionary, users-page-neo4j-endpoint, verified-muters-profile-surface,
verified-reporters-list-page.

Around the gate:

- `bash scripts/harness-lint.sh`;
- `scripts/dev-refresh.sh` (UI and backend: the server messages change), then the browser class;
- AC-7's `curl` of the twelve addresses, locally and on staging after deploy.

## Verification

The new tests fail against the current code. Confirmed on 2026-09-21 at base `383f99e5` plus this
phase's test files (uncommitted at the time of the run), with Node 22.23.2.

**`test/assistant-management-page.test.js`:** 2 passed, 22 failed, 0 skipped. The two passes are the
guards M3 and H1. Every failure names what is missing:

```
FAIL  D1–D8, D10  ui/src/pages/assistant/actions.js does not exist. ADR assistant-management/0001 sub-decision 1 creates it: …
FAIL  D9          ui/src/pages/assistant/actions.js does not exist
FAIL  M1          ASSISTANT_MANAGEMENT_PATH: want "/assistant", got undefined
FAIL  M2          /user: "My Assistant's Profile" → want /assistant/profile/edit, got "/assistant"; /tapestry/users: … got "/assistant"
FAIL  W1          no default import from ./pages/assistant/EditProfile …; no … ActionPage …; ASSISTANT_ACTIONS is not imported …
FAIL  W2          ui/src/pages/assistant/EditProfile.jsx does not exist — ADR 0001 sub-decision 6 moves the editor page there
FAIL  W3          ActionPage.jsx does not exist; ActionText.jsx does not exist; actions.js does not exist
FAIL  W4          no assistantAttention(user) …; ASSISTANT_SECTIONS is not rendered; … the FAQ is not in a <details>/<summary> …
FAIL  W5          ui/src/pages/assistant/ActionText.jsx does not exist
FAIL  W6          the card says "See your assistant, and edit and publish its profile, on the Edit Assistant Profile page."
FAIL  O1          src/utils/assistantPages.js does not exist — ADR 0001 sub-decision 6 creates it
FAIL  O2          public/pages/nip85.html: no "Its profile is edited and published on the Edit Assistant Profile page."; … the link goes to "/assistant" …
FAIL  O3          the paragraph must name "the Edit Assistant Profile page (`/assistant/profile/edit`)"; it reads: "… the My Assistant page (`/assistant`) calls …"
FAIL  O4          19 place(s) still send people to the old address or name:
                    ui/src/App.jsx:250, :467 · ui/src/config/avatarMenuLinks.js:30 · ui/src/pages/BrainstormSettings.jsx:479 ·
                    src/api/assistant/index.js:49, :51, :52 · src/api/strfry/commands/publishEvent.js:15 ·
                    public/pages/customers/customer.html:132, :167 · public/pages/nip85.html:75, :107 · BIBLE.md:1072
PASS  M3, H1 (guards)
```

**Re-aimed Node suites, the same run:**

| Suite | Passed | Failed | The failures |
|---|---|---|---|
| `my-assistant-page` | 22 | 9 | M3, M5, W1–W3, W14, W17–W19 |
| `one-writer-assistant-profile` | 10 | 7 | G1, G2, P2, P4–P6 ("its error does not point to the Edit Assistant Profile page (/assistant/profile/edit)"), and W4 ("no <a href="/assistant/profile/edit"> in the panel … links there: ["/assistant"]") |
| `one-default-assistant-profile` | 51 | 1 | R1 |
| `assistant-setup-state` | 28 | 0 | none (D6 is a guard) |

**Browser class.** Recorded 2026-09-21:

- **Environment:** Playwright 1.56.1, Chromium 141.0.7390.37 (headless shell), Node 22.23.2. The base
  URL is `http://localhost:7778`, serving the UI built from this branch before any implementation
  (`scripts/dev-refresh.sh --ui`, bundle `index-pcqX0yLl.js`).
- **`tests/brainstorm/assistant-management-page.spec.js`:** 0 passed, 23 failed. Each failure names
  what is missing:
  - B0: the bundle lacks "Manage the Profile and Capabilities of";
  - B1: "the kicker" is not found;
  - B2: "the "Your Tapestry Assistant's Profile" card is still there", expected 1, got 0;
  - B3: the no-assistant line is not found;
  - B4: "precondition: the hub rendered while sign-in was still resolving";
  - B5, B6: the card links and NIP links are absent;
  - B7: "a "Frequently asked questions" toggle" is not found;
  - B8 × 10, B9: "‹address› is a page";
  - B10: the card text is not found;
  - B11: "/assistant/profile (typed in)";
  - B12: "precondition: the hub's FAQ toggle";
  - B13: "/assistant asked for something the top bar alone does not". Today's `/assistant` is the
    editor, which reads `/api/assistant/status`.
- **Fixes made in the first run:** its B8, B9 and B11 failures were generic "waiting for `main`"
  timeouts, because the app's "Page not found" has no `<main>`, and B12 timed out on a missing FAQ.
  The spec's `open()` now waits for `main, h1`, and B12 asserts the toggle before clicking it. The
  re-run gives the named failures above. Those were message fixes; no assertion was weakened.
- **The six re-aimed browser suites:** run twice against the same build. First as re-aimed, then as
  they stand on `staging` (temporary copies, deleted after the run):

  | Suite | Re-aimed: passed / failed | `staging` version: passed |
  |---|---|---|
  | `my-assistant-page.spec.js` | 1 / 17 | 18 |
  | `assistant-setup-prompt.spec.js` | 6 / 4 | 10 |
  | `one-writer.spec.js` | 1 / 14 | 15 |
  | `assistant-default-profile.spec.js` | 3 / 5 | 8 |
  | `assistant-publish-result.spec.js` | 1 / 3 | 4 |
  | `ta-composite-avatar.spec.js` | 1 / 4 | 5 |
  | **total** | **13 / 47** | **60 / 60** |

  So every one of the 47 failures comes from the re-aim, and each is about the new address:
  - "/assistant/profile/edit must be the editor page — it renders "Page not found"";
  - "the My Assistant page must show the editor to a signed-in owner", in the three suites that open
    the editor;
  - the menu, Dashboard, banner, tab, old-address and `/settings` destinations still reading
    `/assistant`;
  - each legacy panel's link still going to `/assistant`.

  The 13 still passing are the bundle checks (B0) and the tests that never reach the editor's
  address.
- **A shell hazard, caught here:** the first attempt at the `staging` run looped over an unquoted
  `$SUITES` in zsh. That iterates once, so the copies were never made, and the run repeated the
  re-aimed suites. It was redone under `bash` with an array. The memory note on zsh word-splitting
  already covers this failure mode.
