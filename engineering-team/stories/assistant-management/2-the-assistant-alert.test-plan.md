# Test Plan: Story 2 — The Assistant Alert

**Story:** `engineering-team/stories/assistant-management/2-the-assistant-alert.md`
**ADR:** `engineering-team/decisions/assistant-management/0002-one-top-bar-alert-slot-setup-first.md`
**Date:** 2026-09-21

Two classes, as in story 1's plan:

- **Node (CI-run).** `test/assistant-alert.test.js` has three classes:
  - P: the pure picker, over every case of story 2 § When the pill shows;
  - C: the pill's words;
  - W: the slot and its four mounts, by source.
- **Browser.** `tests/brainstorm/assistant-alert.spec.js`, B0–B9. B9 was added, and B3 strengthened, after review 2
  (2026-09-21; ADR 0002 Amendment 1).

The approved words come from the shared `test/helpers/assistantManagementFixtures.js`.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 where and what | W3 the slot is mounted once each in BrainstormUserMenu, the landing page's `UserMenu` (inside that function, so both the landing and results views get it), the Tapestry `Header` and `DevPage` · W2 one `<Link>` to the hub, named "Manage your Tapestry Assistant" | `test/assistant-alert.test.js` | source |
| AC-1 | B1 on `/about` (own bar), `/tags` (TopBar), `/` (landing), `/tapestry/` (Header) and `/developers` (DevPage): one pill, its sentence, "· 10 actions need attention", "Manage Assistant →", `href="/assistant"`, beside the avatar control (or in `.bsp-auth`); click and Enter open `/assistant` | `tests/brainstorm/assistant-alert.spec.js` | browser |
| AC-2 who sees it | P1 signed out → none, whatever the rest · P6 nothing needing attention → none | Node | unit (ESM) |
| AC-2 | B2 signed out: no pill on the five pages · a signed-in guest with no assistant, setup answered all done: no pill | browser | browser |
| AC-3 setup first | P2 idle or checking → none · P3 a counted step → `'setup'` with that count, never the Assistant pill, even on `/assistant` · P4 nothing counted → the Assistant pill with the hub's count · P5 failed → the Assistant pill · P8 all 96 combinations: exactly one of none / setup / assistant, and the Assistant pill only where setup-first allows it | Node | unit |
| AC-3 | W1 the slot reads `useSetupStatus()` and decides with `pickTopBarPill` | Node | source |
| AC-3 | B3 check held → no pill of either kind; a follow list left → the Setup pill, and not this one; all done → this pill; another provider → this pill; check failed → this pill; at most one pill at any sampled moment · a late answer, both ways: no pill of either kind before it, then the right one alone. *(Strengthened after review 2: it now runs with the real Setup pill in the build.)* | browser | browser |
| AC-4 where it hides | P7 `/assistant`, `/assistant/`, `/assistant/profile`, `/assistant/profile/edit`, `/assistant/dlists`, `/assistant/preferences` → none; `/assistants`, `/assistant-x`, `/setup`, `/`, `/tapestry/`… → the pill | Node | unit |
| AC-4 | W2 no `<button>` in the slot, no dismiss state | Node | source |
| AC-4 | B4 no pill on the six hub addresses; nothing inside or beside the pill closes it | browser | browser |
| AC-5 never disagrees | P4 the count passes through · W1 the count comes from `assistantAttention` · W2 its words from `attentionCountText` | Node | unit + source |
| AC-5 | B5 the pill's N equals the hub's count line and its number of marks (10) | browser | browser |
| AC-6 every width | B6 1280 px: sentence and count · 800 px: count hidden (ADR 0002: ≤ 900 px; Amendment 1: ≤ 1023 px) · 375 px: only ⚠ and "Manage Assistant →", still named "Manage your Tapestry Assistant" · no horizontal scroll on `/`, `/tags`, `/about`, `/settings`, `/developers`, `/tapestry/` at all three widths, with the pill showing | browser | browser |
| AC-6 | B9 *(added after review 2)*: 19 widths from 320 to 1280 px, on both sides of every breakpoint that changes a bar while the pill shows, on the same six pages, as a Customer with a 29-character name: nothing scrolls sideways, and the fixed Tapestry header is no taller with the pill than without it | browser | browser |
| AC-7 read-only | W1 no `fetch`, no `/api/`, no browser storage in the slot · P9 the picker imports only `avatarMenuLinks.js` | Node | source |
| AC-7 | B7 only GETs; one `/api/setup/status` read per full load, with no parameters; none on in-app navigation; no publish or sign request | browser | browser |
| § Copy (the look) | C1 `ASSISTANT_ALERT_COPY` { name, sentence, button } · B8 the button chip's computed colour is indigo (blue well above red and green), not amber | Node + browser | unit + browser |

## Edge cases

- [x] **A late setup answer** (B3). Held back 3 s: no Assistant pill before it arrives, the pill after.
      This is the "waits" in rule 3, observed over time rather than at one moment.
- [x] **Setup steps left while on `/assistant`** (P3). The Assistant pill still gives way. The
      Setup Alert's own `/setup` rule is its story's to add (ADR 0002 § 1).
- [x] **Look-alike paths** (P7). `/assistants` and `/assistant-x` are not under the hub; `/assistant/`
      is.
- [x] **A second mount** (W4). No file but the four mounts renders `<TopBarAlert />`, and `TopBar.jsx`
      does not: `TopBar` already renders `BrainstormUserMenu`, so a mount there would draw two pills.
- [x] **Never two pills** (B3). At most one pill-shaped link at any sampled moment. Today only the
      Assistant pill exists. When the Setup Alert ships this sampling starts to bite, because its
      accessible name is counted too.
      *2026-09-21, after review 2: the Setup Alert has shipped (PR #737), and the branch merged it. B3
      now also asserts that the Setup pill shows where a step is left, so the sampling counts two real
      pills.*
- [x] **The edges of each breakpoint** (B9). B9's first version tested 11 fixed widths. After the
      first fixes, a scratch probe found a 10–12 px scroll at 640–642 px, which none of them hit: the
      sentence came back too early. B9 now tests each side of every breakpoint.
- [x] **No re-ask on in-app navigation** (B7). The provider sits outside the router (ADR
      setup-status-and-alert/0001), so leaving `/about` for `/assistant` and back asks nothing new.

**Not covered, and why:**

- **The Setup pill.** It is setup-status-and-alert #2. P3 pins only what this slot returns for it.
  *2026-09-21: the Setup pill is now in the build, and B3 observes it beside this one. How it behaves
  on its own stays its own suite's job (`tests/brainstorm/setup-alert.spec.js`).*
- **The results view on a phone.** At ≤ 600 px the existing rule hides the whole right side of that
  header, avatar menu included (ADR 0002 § Consequences). No change here.
- **Pages without a top bar:** the site-wide "Page not found" and `/legacy/` (story § Out of
  scope).
- **Other books' browser suites.** They now see the pill when their mocks leave
  `/api/setup/status` to their catch-all: `success: false` means the phase is `failed`, and a viewer
  with an assistant then gets the pill. It adds no request those suites forbid and removes no
  control, so it is a thing to watch at review, not a test here. It is listed in § Test
  infrastructure.

## Test infrastructure

As in story 1's plan: Node 22 for the Node class, and Playwright `chromium` against
`http://localhost:7778` after `scripts/dev-refresh.sh --ui`, every `/api` route mocked.

- `/api/setup/status` is answered per scenario in ADR setup-status-and-alert/0001's shape:
  all done, a follow list left, another provider, held (`hang`), failed (500), or late (`delayMs`).
- **A watch item for review.** Other books' browser suites that sign in a viewer with an assistant
  will now render the pill. Of the suites this book re-aims, those are my-assistant-page,
  assistant-setup-prompt, one-writer, assistant-default-profile, assistant-publish-result and
  ta-composite-avatar. setup-status.spec.js B7 checks 375 px on `/setup` with every step done, which
  now includes the pill.
- The book's gate is one run over both stories. Its command and its 106 pinned suites are in story
  1's plan § How to run. After the merge of `origin/staging` it finds 107: `setup-alert` joins.

## How to run

```
PATH=<node22>/bin:$PATH node -e "require('./test/assistant-alert.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
BRAINSTORM_BASE_URL=http://localhost:7778 npx playwright test tests/brainstorm/assistant-alert.spec.js --project=chromium
```

## Verification

The new tests fail against the current code. Confirmed on 2026-09-21 at base `383f99e5` plus this
phase's test files, with Node 22.23.2.

**`test/assistant-alert.test.js`:** 1 passed, 13 failed, 0 skipped. The pass is W4, a guard that
holds vacuously until something mounts the slot.

```
FAIL  P1–P8  ui/src/utils/topBarAlert.js does not exist. ADR assistant-management/0002 sub-decision 1 creates it: the pure picker …
FAIL  P9     ui/src/utils/topBarAlert.js does not exist
FAIL  C1     ui/src/pages/assistant/actions.js does not exist. ADR assistant-management/0001 creates it; it holds ASSISTANT_ALERT_COPY …
FAIL  W1     ui/src/components/TopBarAlert.jsx does not exist — ADR 0002 sub-decision 2 creates it
FAIL  W2     ui/src/components/TopBarAlert.jsx does not exist
FAIL  W3     BrainstormUserMenu …: 0 <TopBarAlert /> (want 1); … TopBarAlert is not imported; the landing page's UserMenu …
PASS  W4 (guard)
```

**Browser class,** `tests/brainstorm/assistant-alert.spec.js`, recorded 2026-09-21 in the same
environment as story 1's (Chromium 141.0.7390.37, the branch's UI built before any implementation,
`:7778`): 1 passed, 8 failed.

- **B0:** the bundle lacks "Manage your Tapestry Assistant".
- **B1:** "/about (its own top bar and BrainstormUserMenu): one Assistant pill", expected 1, got 0.
- **B3:** "every step done: the Assistant pill shows", expected true, got false.
- **B4, B6, B7:** the pill is not found, where one is expected.
- **B5:** "the pill, on /about". It first ran as a 30 s `innerText` timeout; the pill's presence is
  now asserted before it is read.
- **B8:** the button is not found.
- **B2 passes, as it must.** It asserts that no pill shows for a visitor or for a viewer with no
  assistant, which is trivially true before any pill exists. It becomes a real check once the
  implementation draws one.

### After review 2 (2026-09-21), on the merged build

The branch merged `origin/staging` at `fc7021f2`, bringing the Setup Alert. The UI was built from it before
any fix, and B3 and B9 ran against it, with setup-status-and-alert's B3 and B9 (re-aimed; story 1's plan
§ Re-aimed suites).

- **B3, strengthened, passed.** Setup already came first in the picker. What is new is that the test now
  sees it with the real Setup pill in the build.
- **B9's first version failed.** It tested 11 fixed widths, and checked the height of every bar:

  ```
  320px /: scrolls sideways by 24px          (and /tags)
  560px /: scrolls sideways by 91px          (and /tags)
  656px /: scrolls sideways by 3px           (and /tags)
  560px /tapestry/: the bar grows 55→71px    (and at 656, 700 and 800 px)
  320px /developers: the bar grows 39→47px   (through 560 px; 47→55px from 656 to 1280 px)
  ```

  - **The `/developers` rows.** They are the developer bar's own 8 px growth when a pill appears. The
    Setup Alert's ADR accepted the same for its pill (setup-status-and-alert/0002 Amendment 1).
  - **So the height check is now scoped** to the fixed Tapestry header, the one bar that covers the page
    when it grows. ADR 0002 Amendment 1 records the developer bar's growth.
  - **The widths.** The first fixes passed B9's 11 widths. A scratch probe at every 2 px near each
    breakpoint then found `/` and `/tags` scrolling by 12 px at 640 and 10 px at 642. B9 now tests both
    sides of every breakpoint, 19 widths in all.
- **Another book's suite, re-aimed.** That first run took only B3 and B9 from `setup-alert.spec.js`. The
  whole suite, run later on the merged build, found two more failures, in B11: "at 375 px the TopBar wordmark
  stays when there is no pill" and "… the control panel role badge stays …", both on "without a pill, nothing
  changes".
  - **Why.** Their "no pill" viewers have an assistant and no step left. Since this story, such a viewer gets
    the Assistant pill, whose phone rules shed the same wordmark and badge.
  - **The re-aim.** They now sign in a viewer with no assistant (for the badge, an Owner whose key is missing),
    and also assert that no Assistant pill shows. Each edit is marked with a comment naming this story.
  - **The run.** Its pre-re-aim copy on this build: 47 passed, 3 failed. The third failure was B9, from the
    editor's move (story 1's plan § Re-aimed suites).
  - **Missed at Test Design.** § Test infrastructure's watch item said other books' suites would see the
    pill, and that it "removes no control". But it does hide text, and B11 asserts on that text. See the
    ledger row filed with this fix round.
- **After the fix,** on the built UI: `assistant-alert.spec.js` 10/10, with B9 over its 19 widths.
