# Review: Story 2 — The Setup Alert

**Reviewer:** Claude (acting as Reviewer). I did not write this story's tests, its ADR amendment or its code.
**Date:** 2026-09-21
**Diff:** `git diff a31d448c...HEAD` on `feat/setup-status-and-alert`, HEAD `f8fca976`, working tree clean. The
implementation alone is `git diff e67eb198 f8fca976 -- ui/`. The commits:
- `e9763808` ADR 0002;
- `e64a9817` the failing tests (45);
- `47319ac5` ADR 0002 Amendment 1;
- `e67eb198` test B12 (×5);
- `f8fca976` the implementation.

**Story:** `engineering-team/stories/setup-status-and-alert/2-the-setup-alert.md`
**ADR:** `engineering-team/decisions/setup-status-and-alert/0002-the-setup-alert-pill.md`, Amendment 1 included. It
builds on ADR 0001.
**Test plan:** `engineering-team/stories/setup-status-and-alert/2-the-setup-alert.test-plan.md`

## In short

- The diff matches the story, ADR 0002 (Amendment 1 included) and the test plan. I re-ran every gate myself and
  they all pass. Five mutants of the real implementation show that the tests catch the regressions that matter.
- **Nothing is blocking.**
- **Three decisions for the owner.** In each case the code does what the approved story or ADR says:
  1. The "Finish setup →" chip is white on amber at **2.52:1**, below WCAG AA's 4.5:1. On phones it is the only text
     in the pill (Non-blocking 1).
  2. The approved accessible name never gives the count to a screen reader. On phones it also does not contain the
     visible "Finish setup" (Non-blocking 2).
  3. If you follow someone or edit your Treasure Map inside the app, the pill keeps counting that step until the
     next full page load (Non-blocking 4).
- **One small real bug:** `/SETUP`, or any other case variant, shows the setup page with the pill on it
  (Non-blocking 3).

## Quality gates (run by reviewer, not trusted)

- [x] **The walker triage, re-run first.**
  - `/usr/bin/grep -rl readdirSync test/` finds 22 files: 20 suites and 2 helpers.
  - All ten pinned walkers are among them. The filename grep already picks up three more:
    `retire-offering-vocabulary`, `show-the-four-on-the-goal-screens-that-already-exist` and
    `stamped-composite-avatar`.
  - The rest walk trees this branch does not touch. `close-unauth-write-surface` and
    `one-default-assistant-profile` read `src/` (`test/close-unauth-write-surface.test.js:207`,
    `test/one-default-assistant-profile.test.js:869`). Reconciliation, event-tagging and `firmware/` are
    untouched too, and `ledger-row-ids` walks temp dirs.
  - `git diff --name-only a31d448c...HEAD` touches `ui/src`, `test/`, `tests/brainstorm/` and `engineering-team/`.
    It does not touch `src/` or `ledger/`.
  - The branch adds a spec under `tests/brainstorm/`. The suites outside the gate that name that tree each read
    only their own spec file, or mention it in a comment. The only suite that reads `test/registry.js` is
    `stack-free-npm-test`, which is pinned.
  - A dry run of the heredoc's selection gives 74 named suites plus 10 walkers, 3 of them already named: 81.
    That is exactly the pinned list, and none is missing from `test/registry.js`. **The list is right for this
    branch.**
- [x] **The story's scoped gate.** I ran the test plan's heredoc verbatim with `GATE_LABEL=setup-alert-2-review`.
  `npm run gate:status -- --label setup-alert-2-review` reads:

  ```
  20260921T213613Z-63758-21ea [setup-alert-2-review] started 2026-09-21T21:36:13.087Z on f8fca976 — PASS, exit 0, 1629 passed, 0 failed, 4 skipped, 81/81 suites · /Users/wds4/repos/nous-clawds4/tapestry/tmp/gate-runs/20260921T213613Z-63758-21ea.json
  ```

  - It ran on the committed tree (`git.dirty: false`) with no stray errors.
  - The Test Design baseline is `20260921T201722Z-18237-8edc`: 1623 passed and 6 failed, all six in `setup-alert`.
    1623 + 6 = 1629, so the six reds turned green and nothing else changed.
  - The four skips are the baseline's own: `deploy-safety-status` 1, `show-the-four…` 2 and `setup-status` H2 1.
  - The implementation commit cites run `20260921T211843Z-45340-1953`. That run was on `e64a9817+dirty`, before
    the amendment and B12 commits. It has the same totals, and this run is on the committed tree.
- [x] **The Node suite on its own**, through `.run()`: 6 passed, 0 failed, 0 skipped.
- [x] **The UI build** (`npm --prefix ui run build`) exits 0.
  - The hash did not change (`index-hpf8FyMq.js`, `index-CB0kYROF.css`), so `dist/` already held HEAD's build,
    and `:4173` serves it.
  - The live `:7778` stack serves a byte-identical `index-hpf8FyMq.js` (same SHA-256).
- [x] **The browser class.** `BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test
  tests/brainstorm/setup-alert.spec.js tests/brainstorm/setup-status.spec.js --project=chromium`: **65 passed**
  (setup-alert 50, setup-status 15) in 20.2 s.
  - Every setup-alert test calls `mock()` before it loads a page, and `mock()` registers the `/api/**` catch-all
    ahead of every specific route (`tests/brainstorm/setup-alert.spec.js:99`).
  - B0 fetches only the app shell and its JS chunks.
  - One part of every run is not mocked; see Harness friction 1.
- [x] **eslint parity** on the seven touched UI files. I counted problems per rule at HEAD and in `e67eb198`'s
  version (through `--stdin`, same config). Nothing is new:
  - `SetupAlert.jsx`, `Header.jsx` and `steps.js` lint clean.
  - `BrainstormUserMenu.jsx` has `no-empty` ×4 and `only-export-components` ×1, the same as the base.
  - `BrainstormSearch.jsx` has `no-empty` ×8, `no-unused-vars` ×8, `exhaustive-deps` ×5 and `purity` ×1, the same
    as the base.
  - `DevPage.jsx` and `SetupStatusContext.jsx` each have `only-export-components` ×1, the same as the base.
- [x] **`bash scripts/harness-lint.sh`:** exit 0, "harness-lint: clean (0 violations)".
  - That was on the tree under review. With this review file added, L1 reports one violation, "review … is
    PASS-final but story status is 'Approved'". It clears when the story is flipped to `Done` in the same commit,
    which this review's brief leaves to the orchestrator.
- [x] **Hygiene**, over every file the branch touches:
  - no raw control bytes (the `perl` sweep);
  - no 64-hex literal added (the fixtures are `'a1'.repeat(32)` and the like);
  - no `console.log` outside the Node suite's own reporter;
  - no TODO.
- [x] **The reviewer's own checks** are listed below. The scripts are in the session scratchpad under `review2/`,
  and none is committed.
- [ ] _Lint not configured: skipped. The eslint parity check above is the book's check._
- [ ] _Typecheck not configured: skipped._
- [ ] _Build not configured: skipped. The UI build above is the book's check._

### Do the tests catch regressions? Five mutants of the real implementation

For each mutant I copied HEAD's `ui/` and `src/lib` with `git archive` and changed one thing. Each was built with
`vite build --outDir` into the scratchpad and served on its own port. First I checked the pipeline: building HEAD
unchanged gives a `dist/` identical to the repo's (`diff -rq`).

| Mutant | Fails | Passes |
|---|---|---|
| A: Amendment 1 removed (the brand-word span and its three CSS rules) | B12 ×5, each "the brand is 54px tall with the pill, 27px without: it wrapped" | 45 |
| B: the request key back to `${pubkey}#${attempt}` | B9 | 49 |
| C: § 4's two phone rules removed | B7 on `/tags`, `/` and `/assistant`; both B11 "hides" tests | 45 |
| E: the pill counts steps not done (`3 - doneCount`) instead of `pendingCount` | B4 hanging read, B4 500, B4 unfinished, B4 another provider, B4 mixed, and B6 another provider | 44 |
| F: the `/setup` hide removed | B5 on `/setup` and its three step pages | 46 |

Two things the table shows:
- **B4's and B5's "no pill" tests carry no positive control** in the same test: they pass on any page with no
  pill. They still catch plausible regressions (mutants E and F), because B1 to B3 use the same mocks.
- **The role-badge rule is now pinned by B11 alone.** With Amendment 1 in place, `/tapestry/`'s B7 passes even
  without § 4's rules, because the hidden brand word frees enough room. The test plan's Verification says
  `/tapestry/` failed B7 without them. That was true of the Tester's throwaway implementation, which predates the
  amendment.

### The pre-implementation baseline

I ran the spec against a build of `a31d448c`; `ui/` is identical at `e9763808`. It gives **33 failed and
17 passed**: the recorded 28 failures plus B12 ×5. The 17 passes are exactly the test plan's: B4 ×5, B5 ×10 and
B11 ×2 ("stays").

### Lifecycle probe (hermetic, `:4173`)

How the probe worked:
- A MutationObserver on `document`, installed before the app loads, recorded every committed state of the pill.
  So a stale state too short for a poll to see would still count.
- Every `/api` request was answered in the browser.
- A fake NIP-07 signer drove a real `login()`, the avatar menu's own "Sign out" drove `logout()`, and the real
  `/assistant` create flow drove `AuthContext.refreshUser()`.

The results:
- **L1, first load** (the answer delayed 1.5 s): one read, with no query string. The pill first appears 1 ms
  after the answer lands.
- **L2, the create flow with a new assistant** (the second answer delayed 1.5 s):
  - after the click, the pill goes "none → · 1 step left", and "· 2 steps left" never comes back;
  - the new count appears only after the second answer;
  - there are exactly two reads, and no reload.
- **L3, the classification reports the same assistant:** the pill never changes, and there is still one read,
  because the key is unchanged.
- **L4, the classification reports no assistant:** "none → · 2 steps left", with two reads.
- **L5, sign-out and sign-in:**
  - sign-out removes the pill at once, with no read;
  - signing back in as the same account (the answer delayed 2 s) never shows the old count in any committed DOM
    state;
  - signing out and in as another account never shows the first account's count;
  - there are three reads, and the last one is for the second account;
  - the signer signed only kind 22242 challenges.
- **L6, SPA navigation** through `/tags`, the pill, `/setup`, back, `/about`, `/developers`, `/tapestry/`, `/`,
  `/setup/follow` and `/assistant`:
  - the pill is on every page except the `/setup*` pages;
  - there is one read in total;
  - there are no page errors, so `useLocation()` is inside the router in every host.
- **L7, a 500 from the status read:** no pill at any point.
- **L8, case variants:** `/SETUP` and `/Setup/Follow` show the setup page, and the pill shows on it
  (Non-blocking 3). `/setup/` hides it correctly.

### Width sweep: every host

This was my own script, not the Implementer's.

**Hosts:**
- the six `TopBar` pages: `/tags`, `/pins`, `/tag/<id>`, `/user/<pk>`, `/assistant` and `/`;
- all 13 pages with their own `.bsp-top-bar`;
- `/settings`, whose bar is `.bss-top-bar` inside `.bss-auth`;
- the five developer pages;
- the results view, `/?q=`;
- the control panel `/tapestry/` as Owner, Admin, Customer and Guest, each with a 14- and a 44-character name,
  plus its own "Page not found".

**Widths:** 320–1280 px in 4 px steps (2 px for the control panel), plus the breakpoints 375, 440/441, 600/601,
639/640, 768/769 and 1023/1024.

**Each host was measured twice:** signed in with nothing left (no pill), and with two steps left. Each state got
a fresh browser context. I measured:
- both the bar's own overflow and the page's;
- the pill's parent, its line and its position against the avatar;
- whether the pill stays inside the viewport.

Resizing one loaded page is faithful here: no top-bar component reads the window width in JS. I grepped the host
files for `innerWidth`, `matchMedia` and `resize` and found none.

The results:
- **The pill's widths** are 143, 333 and 412 px (phone, sentence, full). Every host switches form at 640 and 1024
  px.
- **No bar and no page overflows with the pill, at any width, on any host.** The only page-level overflow is
  `/developers/nip-50` at 320–328 px, and it overflows the same way without the pill, so it predates this story.
- **The pill is always before the avatar and on its line,** inside the avatar's own flex parent: `.bsp-auth`,
  `.bss-auth`, `.header-auth` or `.bs-results-header-right`. It never leaves the viewport. In the results view it
  hides together with the avatar at ≤ 600 px, which is the existing collapse.
- **Bar heights:** the pill changes no bar's height except the developer pages', which grow by 7.33 px (39.39 →
  46.72 px at 375).
- **The control panel header is 55 px with and without the pill** at every width, for every role and both name
  lengths.
  - The brand never grows taller.
  - It truncates only at 441–446 px (Owner), 441–442 (Admin, Guest), 441–464 and 640–654 (Customer), and from
    769 up to 776 (Owner) or 794 (Customer) with the long name.
- **Screenshots:** I looked at every bar at 375, 800 and 1280 px. At 375 each reads as the ADR describes: the
  `TopBar` icon without its wordmark; the control panel as ☰, 🧠, the pill and the avatar button, with no role
  badge; the results view with its right side collapsed.

### No regression for viewers without a pill (base `a31d448c` against HEAD, served side by side)

**What I compared:** the geometry of the header and auth elements.
- Pages: `/tapestry/` (Owner and Customer), `/tags`, `/`, `/developers` and `/settings`.
- States: signed out, sign-in still resolving, and signed in with nothing left.
- Widths: 320, 375, 440, 600, 768, 1024 and 1280.

**Result:** 126 cases. 112 are identical. The other 14 are all the control panel's loading "…"
(`.header-loading`): it is now a flex item, because `.header-auth` became a flex row (`ui/src/styles.css:672`), so
its box grows from 18 to 24 px tall and moves up 3 px. The header does not move. A viewer would not notice.

### Accessibility probe

- **What is exposed:** `link "Finish setting up your account"` at 1280, 800 and 375 px, from the ARIA snapshot.
  The visible text is:
  - at 1280, "⚠ Finish setting up your account · 2 steps left Finish setup →";
  - at 800, "⚠ Finish setting up your account Finish setup →";
  - at 375, "⚠ Finish setup →".
- **Keyboard:** the pill is the third Tab stop on `/tags`, after the logo and About and before the avatar. Its
  focus ring is `2px solid rgb(227,179,65)` with a 2 px offset, on `:focus-visible` only.
- **Contrast,** measured against the composited background:

  | Element | `TopBar` | Control panel |
  |---|---|---|
  | The sentence | 8.29:1 | 7.36:1 |
  | The count | 6.38:1 | 5.76:1 |
  | The ⚠ mark | 8.29:1 | 7.36:1 |
  | **The button chip,** white on `rgb(210,153,34)` at 12.48 px, weight 700 | **2.52:1** | **2.52:1** |

### Live pass on `:7778` (it serves this bundle)

**The session:**
- A brand-new throwaway key signed in through the `/tags` "Sign in with nostr" button. A fake `window.nostr`
  signed with the real key in Node.
- The sign-in handlers write only `req.session` (`handleAuthVerifyUser`, `src/middleware/auth.js:514–555`).
- The session was ended with `POST /api/auth/logout`, and `/api/auth/status` then read `authenticated: false`.

**What it showed:**
- **The real answer:** all three steps finished and pending. It was a local miss, finished on the outside relays
  in about 2.5 s. The pill read "· 3 steps left".
- **Full loads** of `/tapestry/`, `/developers`, `/about` and `/` showed the pill each time, with one read per
  load.
- **Into `/setup` through the pill:** "0 of 3 complete" and three "Not done:" prefixes; no pill on the page, and no
  extra read. This is AC-4 on live data.
- **The signer** was asked for `getPublicKey` and `signEvent:22242` only.
- **Every request that was not a GET:** the two sign-in POSTs, plus the Dashboard's 11
  `POST /api/neo4j/query`, none of which carries a write keyword.
- No page errors.

## Spec adherence

- [x] **Every acceptance criterion has a passing test.** My checks agree with each:
  - **AC-1:**
    - Tests: B1 ×6, B2 ×2, B3 ×2, B10, C1, C2, D1 and D2.
    - My sweep, L6 and the live pass put the pill beside the avatar on every host. On `/developers` it sits in
      the empty `.bsp-auth` slot.
    - The "Finish setup →" button is a styled span inside the one link (ADR § 1, "nothing interactive inside
      it"). Clicking the pill and Tab then Enter both open `/setup`.
  - **AC-2:**
    - Tests: B4 ×6. Mutant E fails five of them, all but "nothing left", and B6's another-provider case.
    - Both "in particular" cases are there: the checks that are still loading (B4 hanging read, B4 unfinished),
      and steps 1 and 2 done with a Map naming another provider (B4 another provider).
  - **AC-3:** B5 ×11 and D1, mutant F, and L5/L6. The one exception is the case-variant path (Non-blocking 3).
  - **AC-4:** B6 ×3. N equals the steps `/setup` shows as not done, minus an another-provider step, with one read.
    The live pass agrees.
  - **AC-5:** B7 (six hosts × 3 widths), B11 ×4 and B12 ×5, plus my sweep of every host and mutant C.
  - **AC-6:** B8 ×2, D1 and the live pass. Story 1's S2 still guards the server, which this story does not change.
  - **ADR Decision 5:** B9 and D3, mutant B, and L2 to L4.
  - **ADR Amendment 1:** B12, mutant A and the sweep.
- [x] **No criterion is silently dropped.**
- [x] **No behaviour beyond the story.**
  - The `:hover` rule (`ui/src/styles.css:8677–8682`) keeps the global `a:hover` colour off the pill.
  - Every file changed is on the ADR's list.

## ADR adherence

- [x] **§ 1, `SetupAlert.jsx`** (`ui/src/components/SetupAlert.jsx:19–35`) is the ADR's text:
  - it reads the three hooks, and calls `useSetupStatus()` unconditionally;
  - it renders nothing under the five conditions the ADR lists;
  - its markup is the ADR's, character for character;
  - it holds no state and has no close control.
- [x] **§ 2, the four hosts.**
  - `BrainstormUserMenu` and the landing page's `UserMenu` return `<><SetupAlert />{menu}</>` (Deviation 1). The
    DOM is the ADR's, and my sweep found the pill in the avatar's own parent on all 19 `BrainstormUserMenu`
    hosts it covers (5 `TopBar` pages, 13 own bars and `/settings`) and in both of the landing page's `UserMenu`
    views.
  - `Header`: `<SetupAlert />` comes first in `.header-auth` (`Header.jsx:123–125`), ahead of the conditional.
  - `DevPage`: `<div className="bsp-auth"><SetupAlert /></div>` (`DevPage.jsx:47`).
  - The `.header-auth` flex rule is at `styles.css:672` (Deviation 3).
- [x] **§ 3, the copy.** `SETUP_ALERT_COPY` and `alertCountText` (`ui/src/pages/setup/steps.js:60–70`) match story
  § Copy byte for byte, including U+00B7 and U+2192.
- [x] **§ 4, the styles** (`ui/src/styles.css:8657–8721`), placed right after the `bs-setup-*` block.
  - The border, background and text colour are the step badge's own (`styles.css:8579–8587`).
  - The pill has `inline-flex`, `nowrap`, `flex-shrink: 0`, no underline and a `:focus-visible` outline.
  - The chip is solid `#d29922` with white bold text.
  - The count hides at ≤ 1023 px and the sentence at ≤ 639 px.
  - The two `:has()` rules apply at ≤ 440 px (`:8706–8707`).
- [x] **§ 5, the provider.** `SetupStatusContext.jsx:32` is the ADR's key exactly, and the header comment is
  updated (`:12–17`). No other trigger was added. Story 1's reset guard (`:37–39`) and the `cancelled` flag
  (`:54`) are untouched.
- [x] **§ 6, unchanged.** No `src/` change. The `/setup` page, `avatarMenuLinks.js`, `AuthContext`, the My Assistant
  page and the results view's collapse are untouched.
- [x] **Amendment 1.**
  - `Header.jsx:119` wraps the word in its own span.
  - `styles.css:8712–8721` holds the amendment's three rules verbatim, spread over more lines.
  - **The process was followed** (Implementer step 8). The Implementer raised it; the ADR was amended in its own
    `adr:` commit and B12 added in its own `test:` commit, both before the implementation.
  - B12's commit only passes a `name` option through `mock()` (its default is unchanged) and adds B12. It
    weakens no existing test.
  - The owner's "Fix now" is recorded in the ADR and the story. I did not see the owner's own words.
- [x] **No new dependencies.** No `package*.json` file changed.

### The story's Deviations, checked

1. **The fragment through `const menu`:** accurate. The elements and their order are unchanged, as the sweep
   confirms.
2. **The pill's size:** accurate. I measured 143, 333 and 412 px. "Every bar fits at 360 px" still holds; every bar
   now fits from 320. I did not re-derive the history of the earlier paddings ("147 px", "needed 361 px").
3. **Where the `.header-auth` rule lives:** accurate (`styles.css:671–672`). The rule also applies when there is no
   pill; the comparison above shows that only the loading "…" box changes.
4. **Amendment 1:** accurate, and enough.
   - Mutant A reproduces the problem: the header is 71 px at 376 px with the pill, and B12 fails 5/5 with "54px …
     27px".
   - The fix holds everywhere I measured.
   - The developer bar grows 7.33 px, which the Deviation calls "about 7 px".

None of the Deviations is false. None of them says whether the live pass was run (Non-blocking 6).

### Other documents, checked as claims

- **ADR Amendment 1:**
  - the pill widths 143, 333 and 412 px: confirmed;
  - before the fix, "no top bar scrolls horizontally at 356 px or wider": confirmed. On mutant A the header
    overflows by 36 px at 320, falling to 2 px at 354;
  - with the fix, 55 px everywhere and no horizontal scroll: confirmed;
  - on phones, "☰, 🧠, the pill, and the avatar button": confirmed;
  - "No other host's bar changes height": confirmed;
  - "the brand truncates only inside the ranges above": each measured truncation range starts 1 px below the
    matching wrap range (441 against 442, 769 against 770). That is negligible.
- **The test plan's Verification:**
  - the Node reds at Test Design: confirmed from the baseline record;
  - 28 failed and 17 passed before implementation, and the B12 failure text: confirmed (the baseline and mutant
    A above);
  - "the request key without the assistant … B9 fails": confirmed (mutant B);
  - "without the two `:has()` rules … `/tapestry/` (419 px)": no longer true with the amendment in place (see the
    mutants);
  - the counts of 50 tests, 74 grep hits and 81 suites: confirmed.
- **The implementation commit message:** its totals, "browser 65/65" and "only /developers grows (~7 px)" are all
  confirmed.

## Concept-graph integrity

- [x] **Handles.** No concept handle appears in the code. The story's three orientation handles are unchanged
  from story 1.
- [x] **Firmware.** No concept definition changed, so no reinstall is needed.
- [x] **Orientation.** The code touches no concept.

## Things tests can't catch

- [x] **Secrets:** none. The new code holds no pubkey at all.
- [x] **Debug output:** none.
- [x] **Commented-out code:** none. The new comments explain.
- [x] **Error paths.** The component has none of its own. A failed or signed-out answer means no pill (B4 500, L7).
- [x] **Races.** L2 to L5 cover them, down to every committed DOM state. A key change cancels the read in flight.
- [x] **Security.** The pill shows fixed copy and a count computed from booleans. Its link target is constant, and
  it takes no input.
- [x] **Load.**
  - As ADR 0002 § Consequences accepts, every signed-in full page load now makes one status read. Live, that was
    one read per full load and none on SPA navigation.
  - Ledger row `2026-09-21-relay-reader-socket-leak` gains callers, which the ADR already records.
- [ ] **Browsers.** The phone rules and Amendment 1 rely on `:has()` (Chrome 105+, Safari 15.4+, Firefox 121+). I
  ran Chromium only.

## House rules check

- [x] **Concept Graph API authority** is respected; there is nothing to orient on.
- [x] **No new lint, typecheck or build tooling.**
- [x] **No hardcoded TA pubkey** (S1, plus my sweep of the whole branch diff).

## Product-guide adherence *(no PRD; the book has an acceptance frame)*

- [x] **Copy.** It matches story § Copy byte for byte, including the singular "· 1 step left".
- [x] **Designed states.** Signed out, sign-in resolving, checking, failed, one to three steps counted, and
  another provider only: each renders as the story says.
- [ ] **Accessibility baseline.** See Non-blocking 1 and 2. No guide covers this book (Harness friction 2).

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/styles.css:8689–8695`: the "Finish setup →" chip is `#fff` on `#d29922`, 2.52:1 at 12.48 px bold.**
   - WCAG AA asks for 4.5:1 at this size. Below 640 px the chip is the only text in the pill, and the pill shows
     on every page to every new user.
   - ADR § 4 prescribes "white bold text", so the code conforms. This is a design question for the owner, not
     drift.
   - A cheap fix: dark text on the chip. The page's `#0f0f1a` on `#d29922` is about 7.5:1. Because it changes the
     approved look, it needs the owner's word and a note in the ADR.
2. **`ui/src/components/SetupAlert.jsx:28`: the approved accessible name hides the count, and on phones it does
   not match what is shown.**
   - `aria-label` replaces the content, so a screen-reader user hears "Finish setting up your account, link" and
     never "2 steps left".
   - Below 640 px the only visible text is "Finish setup →", and the name does not contain it (WCAG 2.5.3, Label in
     Name, level A). A speech-input user who says "click Finish setup" may not reach the pill.
   - This is exactly story § Copy (`2-the-setup-alert.md:86`) and AC-5 (`:71–72`), taken from Brainstorm's
     button. So it is the owner's call.
   - One option: a name that starts with what is visible and carries the count. Another: drop `aria-label`, so the
     name follows the shown spans (`display: none` spans drop out of it).
3. **`ui/src/components/SetupAlert.jsx:25`: `/SETUP` shows the pill on the setup page.**
   - The comparison is case-sensitive, but React Router matches routes case-insensitively by default. So `/SETUP`
     and `/Setup/Follow` render the setup pages with the pill (L8).
   - AC-3 is broken only on a hand-typed URL, and the pill then links to the page you are already on.
   - Optional fix: lower-case the pathname before comparing.
4. **Completing step 2 or 3 inside the app does not update the pill until a full page load.**
   - The provider reads again only when the account, the assistant or `attempt` changes, or on a full load
     (`SetupStatusContext.jsx:32`). `refresh()` has no caller.
   - These flows publish in the same tab without a reload:
     - the profile page's Follow button, which publishes the viewer's kind 3 (`ui/src/hooks/useProfileActions.js:118–142`);
     - the Treasure Map editors, which sign the viewer's kind 10040
       (`ui/src/pages/grapevine/TreasureMapManualEdit.jsx:45`, `TlOptInCard.jsx:66`).
   - After either, the pill (and `/setup`) keep counting the step.
   - **Where this sits against the documents:**
     - the story's description says "I don't want it to nag me about a step I've done" (`2-the-setup-alert.md:23`);
     - its out-of-scope line covers only "another app or another tab" (`:95`);
     - ADR 0002 § 5 settled on "No other trigger is added" (`:247`) after looking only at the create-assistant path.
   - This breaks no AC, and AC-4 holds because both surfaces share the snapshot. It is a decision for the owner,
     and a candidate ledger row:
     - either call the provider's `refresh()` after those publishes, which ADR 0001 already expects the step pages
       to do;
     - or widen the out-of-scope line to cover the same tab.
5. **Gaps in the tests; my probes covered each one here.**
   - **No story 2 test pins the pill's own lifecycle.** That covers sign-out hiding it, re-sign-in, an account
     switch, and the create flow never showing the previous count during the new read.
     - Ledger row `2026-09-21-b-class-no-signin-recipe` says "story 2's pill needs the same". The test plan
       (`:22–26`) explains leaving it out by restating the gap.
     - Story 1's B10 pins the shared provider, so the pill is covered through it, and L2/L5 confirm it.
     - B9 (`tests/brainstorm/setup-alert.spec.js:364–376`) checks only the end state, so a pill that kept its old
       count during the new read would pass it.
   - **B12** (`:428–445`) checks heights and scrolling only. A rule that hid the whole brand would pass, and
     nothing pins Amendment 1's "the 🧠 stays".
   - **B7** (`:322–347`) leaves out `/settings` (`.bss-top-bar`) and the results view below 1280 px. My sweep
     covered both.
   - **The "no pill" tests carry no positive control** such as "signed in, and the status was read"; see the
     mutants.

   Optional: add a B-class lifecycle test with story 1's `mockSession` and a MutationObserver, a "no stale count"
   check in B9, and a check in B12 that "🧠" stays visible.
6. **Test plan `:114–121` names a signed-in live pass on `:7778`, and nothing records one.** Neither the story nor
   the implementation commit mentions it. I ran one with a real throwaway session (above), so nothing is missing
   now.
7. **Small corrections for the next time these documents are touched:**
   - the test plan's mutation sentence about `/tapestry/` and B7 (see the mutants);
   - the Amendment's "only inside the ranges above", which is off by 1 px at two range starts.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **Playwright's global setup is not hermetic on the preview origin.**
   - `tests/global-setup.js:27` and `:37` load the base URL and `/api/neo4j-health` with no route mocks.
   - Through `:4173`, both reach the live `:7778`. `curl :4173/api/auth/status` answers from the live stack, and
     `/api/neo4j-health` gets Express's "Cannot GET" 404.
   - The setup still prints "✅ Neo4j health endpoint is accessible", because `page.goto` does not throw on a 404.
   - So the spec's "Hermetic" header (`setup-alert.spec.js:30–31`) is true of the tests but not of the run. The
     leaked requests are signed-out GETs, so no harm is done.
   - Extend ledger row `2026-09-21-vite-preview-proxies-live-stack`. Its first fix shape,
     `preview: { proxy: {} }`, fixes both.
2. **A book without a PRD has no accessibility baseline anywhere.**
   - This checklist's product-guide section applies only "when the story traces to a PRD"
     (`engineering-team/templates/review-checklist.md:46–48`).
   - The product designer's "Accessibility is baseline: contrast ratios …"
     (`product-team/roles/product-designer.md:36`) never runs for such a book.
   - So an ADR could prescribe a 2.52:1 call to action and pass the ADR gate, Test Design and Implementation
     without anyone measuring it (Non-blocking 1).
   - Candidate fix: a contrast and label-in-name line in the ADR template's UI notes, or in this checklist, for
     every UI story.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, in this review's commit.
- [x] Completion detection, in the chat: the book's acceptance frame looks satisfied, so `/close-book` is offered, not run.
