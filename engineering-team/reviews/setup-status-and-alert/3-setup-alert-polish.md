# Review: Story 3 — The Setup Alert: readable, announced as it reads, and current

**Reviewer:** Claude (acting as Reviewer). I did not write this story's ADR, its tests or its code.
**Date:** 2026-09-21
**Diff:** `git diff 6754a16a...HEAD` on `feat/setup-status-and-alert`, HEAD `bad15295`, working tree clean. `6754a16a`
is staging's merge of story 2. The implementation alone is `git diff 6754a16a bad15295 -- ui/`, eight files. The
commits:
- `53f00c21` the story, the book's fifth frame bullet and the epic's story list;
- `9b2aec35` ADR 0003;
- `786801e1` the failing tests (14 Node, 18 browser) and story 2's two re-aimed suites;
- `9fa997af` two test fixes made as the Tester during Phase 4, and two ledger rows;
- `bad15295` the implementation.

**Story:** `engineering-team/stories/setup-status-and-alert/3-setup-alert-polish.md`
**ADR:** `engineering-team/decisions/setup-status-and-alert/0003-readable-named-and-current.md`. It supersedes parts of
ADR 0002 and extends ADR 0001 § 3.
**Test plan:** `engineering-team/stories/setup-status-and-alert/3-setup-alert-polish.test-plan.md`

## In short

- **One blocking issue. It is in the design, not the code** (Blocking 1).
  - The code does what ADR 0003 says. But the ADR's rule that an event id triggers only one re-check (§ 3), together
    with `publishEverywhere` running its two routes in parallel, lets the re-check start *before* the local write
    when every outside relay answers first.
  - The check reads the local relay first and stops at any local hit (`src/api/setup/status.js:143`). So a viewer
    whose local relay already holds an older follow list or Map gets the old answer back as a finished one.
  - The local announcement that follows is then dropped as a duplicate. The pill keeps counting the step until the
    next full page load.
  - I reproduced it on the built UI. It is uncommon: the local import has to lose a race against every outside
    relay. But it breaks AC-3 in the way ADR 0003 says cannot happen: "The re-check starts after the event is on a
    relay: after the local write" (`:101–102`).
  - The fix is small, but it changes ADR § 1 or § 3, so it goes back to the Architect. If the owner would rather
    accept the gap, AC-3 and the ADR need to say so.
- **Everything else holds.** I checked it with my own runs, not the Implementer's numbers:
  - the scoped gate, 100/100 suites, and the six suites outside it that read what the branch touches;
  - the browser classes (83/83) and the /assistant specs (55/55);
  - AC-1 in every host, at three widths, plain, hovered and focused. The chip is 7.54:1 everywhere, and no other
    text is under 5.04:1;
  - AC-2 in Chrome's own accessibility tree, at every breakpoint, for one, two and three steps;
  - AC-4 for every letter case, on the preview and on the real server;
  - AC-5: 135 host and width cases, identical to story 2's build;
  - the three import pages, on every kind of answer.
- **Non-blocking:**
  - the older ADRs' Status lines don't record the supersession, which is the repo's convention;
  - some sentences in ADR 0003 and the test plan are inaccurate;
  - `/%73etup` still shows the pill;
  - one import page no longer logs a failure.

## Quality gates (run by reviewer, not trusted)

- [x] **The walker triage, re-run first.**
  - `/usr/bin/grep -rl readdirSync test/` finds 24 files: 22 suites and 2 helpers.
  - The gate's selection (a dry run of the heredoc) is 93 named suites plus 7 walkers: 100, none missing from
    `test/registry.js`.
  - The grep extension adds exactly the 18 suites the plan lists. Story 2's grep alone finds 75 today.
  - Five walkers are outside the gate: `close-unauth-write-surface`, `event-tagging-write-path`, `ledger-row-ids`,
    `one-default-assistant-profile` and `reconciliation-rearchitecture`.
  - `git diff --name-only 6754a16a...HEAD` touches `ui/src`, `test/`, `tests/brainstorm/`, `engineering-team/` and,
    since `9fa997af`, `ledger/`. The plan says `ledger/` is untouched (Non-blocking 3).
  - The suites that read the real `ledger/` are `harness-lint` (through the script it spawns) and `ledger-row-ids`.
    Neither is in the gate, so I ran them (next item but one).
- [x] **The story's scoped gate.** I ran the test plan's heredoc verbatim with `GATE_LABEL=setup-alert-3-review`.
  `npm run gate:status -- --label setup-alert-3-review` reads:

  ```
  20260921T233256Z-17430-8a2f [setup-alert-3-review] started 2026-09-21T23:32:56.839Z on bad15295 — PASS, exit 0, 2010 passed, 0 failed, 4 skipped, 100/100 suites · /Users/wds4/repos/nous-clawds4/tapestry/tmp/gate-runs/20260921T233256Z-17430-8a2f.json
  ```

  - It ran on the committed tree (`git.dirty: false`) with no stray errors.
  - The Test Design baseline is `20260921T230623Z-62382-a329`: 1996 passed and 14 failed, all 14 in
    `setup-alert-polish`. 1996 + 14 = 2010, so the 14 reds turned green and nothing else changed.
  - The four skips are the baseline's own: `deploy-safety-status` 1, `show-the-four…` 2 and `setup-status` H2 1.
  - The first implementation gate, `20260921T231551Z-82497-86f3`, has exactly the two reds the plan's "During
    Implementation" describes: `treasure-map-relay-presence` R2 and `setup-alert-polish` U5.
  - The implementation commit cites `20260921T232046Z-1634-9661`, on `786801e1+dirty`. It has the same totals as my
    run.
- [x] **Six suites outside the gate, each run on its own through `.run()`:**
  - `harness-lint`: 76 passed, 0 failed;
  - `ledger-row-ids`: 6 passed, 0 failed;
  - `event-tagging-write-path`: 19 passed, 0 failed;
  - `reconciliation-rearchitecture`: 15 passed, 0 failed;
  - `close-unauth-write-surface`: 14 passed, 0 failed;
  - `one-default-assistant-profile`: 52 passed, 0 failed.
- [x] **The UI build** (`npm --prefix ui run build`) exits 0.
  - The hash did not change: `index-8tznIVuA.js`, `index-DLb1LOT-.css`.
  - `:4173` serves that file (same SHA-256), and so does the live `:7778` stack.
- [x] **The browser classes on `:4173`:**
  - `setup-alert-polish`, `setup-alert` and `setup-status`: **83 passed** (18, 50 and 15) in 23.9 s;
  - the /assistant specs: **55 passed**. Each has the `/api/**` catch-all, and the page publishes nothing from the
    browser.
- [x] **Story 2's build, for the baseline.**
  - I built `6754a16a`'s `ui/` into the scratchpad. It gives `index-CVntJGmH.js`, the staging hash the plan names.
    I served it on `:4174`.
  - Story 3's and story 2's specs against it: **17 failed, 51 passed**. The 17 are exactly the Verification's
    story 3 reds. The passes are story 2's 50 plus P3 Mute.
- [x] **The live `:7778` bundle.**
  - P0–P2 and P4: **14 passed**.
  - The real server answers `/SETUP`, `/Setup/Follow`, `/SETUP/ACTIVATE` and `/Setup/create-account` with HTTP 200
    and the app, so AC-4's spellings reach the router in production too.
- [x] **eslint parity.** I counted problems per rule at HEAD and at `6754a16a` (through `--stdin`, with the ui config).
  Nothing is new:
  - `SetupAlert.jsx` and `steps.js` lint clean;
  - `nostrPublish.js` has `no-empty` ×1, as the base does;
  - `SetupStatusContext.jsx` has `only-export-components` ×1, as the base does;
  - `TrustedAssertions.jsx` has `no-empty` ×1 and `exhaustive-deps` ×1;
  - `UserDetail.jsx` has `no-empty` ×2;
  - `BrainstormSettings.jsx` has `no-unused-vars` ×2, `no-empty` ×7 and `exhaustive-deps` ×1.
- [x] **`bash scripts/harness-lint.sh`:** exit 0, "harness-lint: clean (0 violations)", on the tree under review.
- [x] **Hygiene**, over every file the branch touches:
  - no raw control bytes (the `perl` sweep);
  - no 64-hex literal added (the fixtures are `'a1'.repeat(32)` and the like);
  - one `console.warn`, which is Deviation 1;
  - no TODO;
  - no `package*.json`, eslint or vite config change.
- [ ] _Lint not configured: skipped. The eslint parity check above is the book's check._
- [ ] _Typecheck not configured: skipped._
- [ ] _Build not configured: skipped. The UI build above is the book's check._

### My own probes (session scratchpad `review3/`, not committed)

All of them are hermetic:
- the `/api/**` catch-all is registered first;
- every WebSocket is answered in the page;
- a fake NIP-07 signer signs.

Two recorders are installed before the app loads:
- a MutationObserver keeps every committed state of the pill and of `/setup`'s progress line;
- a fetch wrapper records when each publish and status request starts and when its answer arrives.

**AC-3 timing: Follow on a profile page, as a customer with two steps left.** Times are from the click.

| Case | What happened |
|---|---|
| A: local-only gate; the re-check answer delayed 1.5 s | The publish was answered at +71 ms and the pill hid at +73 ms. "· 1 step left" at +1577 ms. No state in between carries the old count. Two reads. |
| B: both routes, nothing delayed | The local answer came at +70 ms and started the re-check at +72 ms. The relays got the event at +74 ms. One re-check. |
| C: both routes; the local import takes 800 ms; the relays answer at once; the local relay already holds an older kind 3 | The status mock answers as the real check would: from the local relay until the import lands. The relays accepted at +71 ms, and the re-check started at +72 ms, before the local write was answered at +834 ms. The re-check returned "· 2 steps left" and the pill showed it. The local announcement was dropped. Still "· 2 steps left" 6 s later, with two reads in all. **Blocking 1.** |
| C2: as C, but the relays take 800 ms and the local import is instant | The re-check started after the local write. Ends on "· 1 step left". |
| D: an in-app move to `/setup` 150 ms after the click; the answer delayed 2 s | `/setup` read "0 of 3 complete" until the answer, then "2 of 3 complete". Never the old "1 of 3". |

**AC-2: the accessible name in Chrome's own tree** (CDP `Accessibility.getFullAXTree`). Playwright's `ariaSnapshot()`
agrees at every width.

| Width | Name |
|---|---|
| 1280, 1024 | "Finish setting up your account · N steps left Finish setup" for N = 2 and 3; "· 1 step left" for N = 1 |
| 1023, 800, 640 | "Finish setting up your account Finish setup" |
| 639, 375, 320 | "Finish setup" |

- The visible text is the name plus the ⚠ and the arrow.
- The pill measures 142.63, 333.30 and 412.50 px (N = 2). Story 2's build measures 142.61, 333.28 and 412.48 px. The
  arrow's own span moves the width by 0.02 px, so story 2's 143, 333 and 412 px hold.

**AC-1: contrast against the composited background**, at 1280, 800 and 375 px.

| Host | Chip | Sentence | Count | Sentence / count on hover |
|---|---|---|---|---|
| `/tags`, `/about`, `/settings` (`.bss-*`), `/developers`, `/assistant` | 7.54 | 8.29 | 6.38 | 7.13 / 5.60 |
| `/` (the landing page) | 7.54 | 8.24 | 6.34 | 7.10 / 5.58 |
| `/tapestry/` (Owner and Customer), `/?q=` (the results view) | 7.54 | 7.36 | 5.76 | 6.32 / 5.04 |

- The chip is `rgb(15, 15, 26)` on `rgb(210, 153, 34)`, at 12.48 px and weight 700. That holds in every host, at every
  width, hovered and keyboard-focused.
- The focus ring is `2px solid rgb(227, 179, 65)` with a 2 px offset, on `:focus-visible`.
- The results view shows no pill at 375 px. That is its existing collapse at 600 px and below.
- No global `a:visited` rule exists that could repaint the pill once `/setup` is in the history.

**AC-5: layout, HEAD against story 2's build, with the pill showing.**
- Hosts: `/tags`, `/`, `/about`, `/settings`, `/developers`, `/tapestry/` as Owner and as Customer, `/assistant` and
  `/?q=jack`.
- Widths: 320, 360, 375, 440/441, 600/601, 639/640, 768/769, 800, 1023/1024 and 1280.
- Result: 135 cases. Bar heights, bar overflow, page overflow and whether the pill shows are identical, and the pill
  widths agree within 0.1 px. No bar and no page overflows.

**AC-4: which paths render a setup page, and whether the pill shows** (`:4173`, then story 2's build on `:4174`).
- Every spelling below renders a setup page with no pill at HEAD: `/SETUP`, `/Setup`, `/sEtUp`, `/SETUP/`,
  `/Setup/Follow`, `/SETUP/FOLLOW/`, `/setup/ACTIVATE`, `/Setup/create-account`, `/SETUP/CREATE-ACCOUNT`,
  `/setup?x=1` and `/SETUP#top`.
- Story 2's build shows the pill on `/SETUP` and `/SETUP#top`.
- `/setup/unknown`, `/Setup/Unknown`, `/setupx` and `//setup` render "Page not found", which has no pill host. So
  nothing is hidden where it should show.
- `/%73etup` and `/%53ETUP` render `/setup` with the pill, on both builds (Non-blocking 4).

**The three import sites, which the plan left out of the browser.**
- Each site ran against four answers from `/api/strfry/publish`:
  - success;
  - a refusal (`{ success: false }`);
  - an aborted request;
  - an HTML 502.
- The sites: the Treasure Map page (as Owner, inside "Where this Map lives"); UserDetail's Find for kinds 3 and 10040,
  on the viewer's own page and on another user's; and Settings' `importLocal10040`.

| Site | HEAD on success | HEAD on a failure | Against story 2's build |
|---|---|---|---|
| Treasure Map page | the button goes, and one re-check (1 → 2 reads) | the button stays; "Import failed: …" logged | the same on screen; the aborted and 502 cases logged "Import error: …" |
| UserDetail, the viewer's own | the two Finds turn to "🔄 Update", and two re-checks (1 → 3 reads) | the Finds stay; nothing logged | the same on screen; the aborted and 502 cases logged "Find event error: …" (Non-blocking 5) |
| UserDetail, another user | "🔄 Update", and no re-check | as for the viewer's own page | the same |
| Settings | the button goes, and one re-check | the button stays; "[settings] 10040 import failed: …" | the same on screen; the aborted and 502 cases logged "… import error: …" |

No page errors in any run.

## Spec adherence

- [x] **Every acceptance criterion has a passing test.** My own checks agree, with one exception:
  - **AC-1:** P1 ×3 and S1. My table above covers every host, hover and focus.
  - **AC-2:** P2 ×6, C1 and D1. My AX-tree sweep covers the breakpoints on both sides and N = 1, 2 and 3.
  - **AC-3:** P3 ×4, U1–U8, D2, D3 and S2. The second clause holds in every ordering (probes A to D). The first clause
    fails when the outside relays answer before the local import (Blocking 1). No test covers that ordering: P3 "both
    routes" answers both routes at once, so the local route always wins (probe B).
  - **AC-4:** P4 ×4 and D1, on the preview and on the real server. The percent-encoded spelling is Non-blocking 4.
  - **AC-5:**
    - story 2's 50 browser tests and 6 Node tests, and story 1's 15;
    - my 135-case layout comparison;
    - the import-page probes.
    - The pill and its checks still only read: the new listener calls `refresh()`, which is a GET.
- [x] **No criterion is silently dropped.**
- [x] **No behaviour beyond the story.** The copy is unchanged on screen ("Finish setup →"), and every file changed is
  on the ADR's list.

## ADR adherence

- [x] **§ 1, `nostrPublish.js`:**
  - a module-level `Set` (`:16`);
  - `onEventPublished` returns an unsubscribe (`:25–28`);
  - `announcePublished` runs each listener inside `try/catch` (`:30–39`);
  - the local route announces on `data?.success === true` (`:84`);
  - the external route announces on `successes.length > 0`, after the relays settle (`:204`). The local-only gate's
    return comes before it (`:165–168`);
  - return values are unchanged, and `publishEverywhere` is unchanged.
- [x] **§ 2, the three import sites:**
  - each calls `publishToLocalStrfry` (`TrustedAssertions.jsx:106`, `UserDetail.jsx:312`,
    `BrainstormSettings.jsx:370`);
  - each keeps its `success` and `error` handling;
  - nothing else in those files changed.
- [x] **§ 3, the provider:**
  - one effect keyed on `[pubkey, refresh]` (`SetupStatusContext.jsx:67–74`), which returns the unsubscribe;
  - the filter is the ADR's: the viewer's `pubkey`, kind 3 or 10040, and an id not seen before;
  - the header comment is updated;
  - the request key, the reset guard and the lazy start are untouched.
- [x] **§ 4, `SetupAlert.jsx`:**
  - no `aria-label`;
  - the path is lower-cased before the comparison (`:30–31`);
  - the button span is the ADR's markup character for character, with the ⚠ still `aria-hidden`.
- [x] **§ 5, `steps.js`:** `SETUP_ALERT_COPY` is `{ sentence, button: 'Finish setup', arrow: '→' }`, and
  `alertCountText` is unchanged.
- [x] **§ 6, `styles.css`:** the chip's colour becomes `#0f0f1a`, with a one-line comment. No other style change.
- [x] **§ 7, the Tester's notes:**
  - C1 and D1 re-aimed, and `pill()` finds the element;
  - the new P, U, C, D and S classes;
  - S2, the optional sentinel, is there.
  - The only test file outside § 7's list is `test/treasure-map-relay-presence.test.js` (below).
- [x] **No new dependencies.**
- [ ] **The supersession.**
  - ADR 0003 § Decision names the right clauses of ADR 0002: `:186`, `:211`, `:221` and `:247`.
  - But neither ADR 0002's nor ADR 0001's Status line records it (Non-blocking 1).
  - One of its quotes is not in the section it cites (Non-blocking 2).

### The Phase-4 test changes (`9fa997af`)

- **Form.**
  - They are in their own `test:` commit, before `impl:`, and the plan's "During Implementation" records them.
  - The Implementer role sends a wrong test back to the Tester (`engineering-team/roles/implementer.md:11`). This
    session did that by taking the Tester's role. I cannot see whether the owner was asked.
- **R2 keeps its intent.**
  - It now accepts the literal endpoint or a `publishToLocalStrfry(` call in the page. That is exactly as strong as the
    old "the literal appears anywhere in the page".
  - U2 pins that `publishToLocalStrfry` POSTs to `/api/strfry/publish`: its fetch stub throws on any other URL.
  - D3 pins that the three sites call the helper.
- **U5 and U8's `useRealWebSocket()` is right and needed.**
  - The leak is real: `test/honest-publish-reporting.test.js:154–157` installs `FakeRelaySocket` once and never
    restores it, and the fake accepts any URL it does not know.
  - My copy of the suite with `useRealWebSocket()` made a no-op fails U5 after `honest-publish-reporting` ("got
    successes: [the stub relay, ws://127.0.0.1:1]"), and passes on its own.
  - The real suite, run in the gate's true order in one process, gives 10/0, then 35/0, then 14/0.
  - It loads `nostr-tools/pool`'s ESM build from `ui/`, which is the module `nostrPublish.js` gets in Node.
- **Nothing downstream is at risk.**
  - `setup-alert-polish` is the last registered suite (`test/registry.js:253`), in both `npm test` and the gate. So
    the real socket it installs meets no later suite.
  - By a grep of every suite registered after `honest-publish-reporting`, it is also the only one that loads
    `nostrPublish.js` and publishes. So the new ledger row's "Nothing else is known to be affected" holds.
- **U8** accepts one or two announcements of the event (`:208–209`). U2 and U5 pin each route on its own, so that is
  enough.

### The story's Deviations, checked

1. **A listener that throws is logged:** accurate (`nostrPublish.js:36`, and U6).
2. **The import sites' failure paths merge:** accurate. My import probes show nothing changes on screen for any answer.
   The only differences are console lines, and "or do nothing" covers UserDetail (Non-blocking 5).
3. **The header comment avoids the attribute's name:** accurate. D1's test is `!/aria-label/.test(src)`.
4. **No live Follow:** accurate.
   - Live `/api/publish-policy` answers `allowExternalPublish: true`.
   - The deployed bundle is byte-identical to the one under review.
   - I re-ran P0–P2 and P4 against it (14/14).
   - I did not repeat the sign-in-only live pass.

### Other documents, checked as claims

- **ADR 0003 § Context:**
  - All 26 of its line references are correct at `6754a16a`.
  - The claim about `publishEvent.js:100–125` is true: the handler awaits `strfry import` before answering success.
  - "`refresh()` has no caller" was true at the base.
  - The prototype's names match my AX-tree sweep.
  - 7.54:1 is measured.
  - The raw publishers carry the kinds it lists:
    - `NewDList` sends 9998 or 39998, and `NewDListItem` sends 9999 or 39999;
    - `CuratedDListHeaders`' only import is a found DList header (`FoundHeader`, `:129`);
    - `DListRatings` and `DListItemRatings` import kind 7 reactions;
    - `useCreateTapestry` and `Add`/`RemoveConceptFromTapestry` send `signAs: 'assistant'`.
  - `SearchPreferences.jsx:47` opens a raw WebSocket, but only to read.
  - The rest of § Context and § Consequences: Non-blocking 2.
- **The test plan:**
  - These counts are right: 14 Node tests, 18 browser tests, 93 grep hits, the list of 18 and 100 suites.
  - The Verification's 17 failed and 1 passed, and story 2's 50, are right (my run on story 2's build).
  - I re-derived only the U5 row of its mutation table.
  - The "During Implementation" gate order and the walker triage are not right (Non-blocking 3).
- **The implementation commit message:** 83/83, 55/55 and the gate totals are confirmed, and so is "Deployed to the
  local container".
- **Ledger row `2026-09-21-honest-publish-fake-socket-leaks`:** accurate on every point I checked: `:156`, the default
  "accept", never restored, and nothing else affected. The fourth-instance note on
  `2026-09-21-adr-reaim-list-misses-outcome-asserts` is accurate too.
- **The book's fifth frame bullet and the epic's story 3 entry:** they describe the story accurately. The frame's
  "catches up without a reload" is subject to Blocking 1.

## Concept-graph integrity

- [x] **Handles.** No concept handle in the code. The story's orientation handles are story 1's.
- [x] **Firmware.** No concept definition changed, so no reinstall is needed.
- [x] **Orientation.** The code touches no concept.

## Things tests can't catch

- [x] **Secrets:** none.
- [x] **Debug output:** only the deliberate `console.warn`.
- [x] **Commented-out code:** none.
- [x] **Error paths.** All three import pages behave the same on screen for every failure (probes).
- [ ] **Races.**
  - The route order is Blocking 1.
  - The listener itself is sound:
    - it re-subscribes when `pubkey` changes, and its cleanup unsubscribes, so a sign-out and sign-in or an account
      switch leaves one listener;
    - StrictMode's double mount (`ui/src/main.jsx:11`) is dev-only, and the cleanup covers it;
    - the id `Set` grows by one entry per viewer save of kind 3 or 10040 that reached a relay. That is negligible.
      It is never cleared across accounts, which is harmless: the ids are hashes of signed events.
  - Two quick saves each re-check. The key change cancels the older read (the `cancelled` flag), so only the newest
    answer shows.
- [x] **Security.** Nothing new at a boundary. The listener only reads three fields (`pubkey`, `kind`, `id`) of an
  event the app itself just published.
- [x] **Load:** one extra status read per viewer save of kind 3 or 10040, as the ADR accepts.
- [ ] **Browsers:** Chromium only.

## House rules check

- [x] **Concept Graph API authority** is respected; there is nothing to orient on.
- [x] **No new lint, typecheck or build tooling.**
- [x] **No hardcoded TA pubkey,** from the sweep of the whole branch diff.

## Product-guide adherence *(no PRD; the book has an acceptance frame)*

- [x] **Copy.** Unchanged on screen, byte for byte, including U+00B7 and U+2192.
- [x] **Accessibility.**
  - Story 2's review found this book had no accessibility baseline (its Harness friction 2).
  - This story is that baseline's first use: AC-1 and AC-2 are measured above, in every host and at every breakpoint.

## Findings

### Blocking

1. **`ui/src/context/SetupStatusContext.jsx:71–73` with `ui/src/utils/nostrPublish.js:84`, `:204` and `:217–220`: when
   the outside relays answer before the local import, the re-check reads the local relay before the new event is in
   it, and the local announcement that would correct it is dropped.**
   - **The mechanism.**
     - `publishEverywhere` runs both routes in parallel (`nostrPublish.js:217–220`).
     - Each route announces on its own success:
       - the local route after the server's `strfry import` (`:84`);
       - the external route once at least one relay accepted, after all of them have settled (`:204`).
     - The provider re-checks on the first announcement of an id and ignores every later one (`:71–73`; ADR 0003 § 3,
       `:230`).
     - The check reads the local relay first and stops at any local hit, of any age (`src/api/setup/status.js:143`).
       It reads outside relays only on a local miss.
     - So when every outside relay answers before the local import finishes, the re-check scans the local relay before
       the new event is stored.
     - If an older event of that kind is already there, the check returns the old answer as a finished one.
     - When the local import lands a moment later, its announcement carries an id already seen, and nothing asks
       again.
   - **Reproduced on the built UI (probe C).**
     - The Follow's relays accepted at +71 ms, the re-check started at +72 ms, and the local write was answered at
       +834 ms.
     - The pill went back to "· 2 steps left" and still read it 6 s later, with two reads in all.
     - With the order reversed (C2), the same fixture ends on "· 1 step left".
   - **A second way in, with no race.**
     1. On the Treasure Map page, push the Map to a relay. That is an announcement from the external route alone
        (`TreasureMapRelayPresence.jsx:181`).
     2. The push re-checks. But the panel's targets include `aTapestryInstanceRelays` and `aTrustedListRelays`, which
        the check's Map lookup never reads (compare `TreasureMapRelayPresence.jsx:20–25` with
        `src/api/export/nip85/currentMap.js:19–26`). So the check can still find no Map.
     3. Then "Import to local strfry" the same Map (`TrustedAssertions.jsx:106`). Its announcement has an id already
        seen. If that Map names the viewer's assistant for rank and followers, step 3 is now done, but the pill
        keeps counting it.
     - I traced this path in the source. I did not drive it in the browser.
   - **How likely.**
     - Uncommon. The local import must lose to every one of the five outside relays, because `publishToRelays` waits
       for all of them (`:181–193`).
     - And the local relay must already hold an older, different event of that kind. That is common for Map edits,
       and possible for a follow list already in this instance's relay.
     - When it happens, the pill and `/setup` behave as they did before this story: the old count until the next
       full page load. Nothing is written wrongly.
   - **What it contradicts.**
     - **AC-3** (story `:61–67`): "within a few seconds of the publish succeeding … the pill's count and `/setup` show
       the new answer".
     - **ADR 0003, Option A** (`:101–102`): "The re-check starts after the event is on a relay: after the local write,
       which is the one the check reads first." That holds only when the local route announces first.
     - Its Cons (`:106–107`) call the second announcement harmless: "which the de-duplication absorbs".
   - **Why the tests pass.**
     - P3 "both routes" answers the local publish and the relays at once, so the local route always wins (probe B).
     - Its status mock gives the same answer whenever it is asked.
     - The plan's mutation table pins the id de-duplication itself (test plan `:215`).
   - **Asked change: an ADR 0003 amendment (Architect), a test (Tester), then the code.**
     - Make sure a successful local write is always followed by a re-check that starts after it. Two small shapes:
       - carry the route in the announcement, and let a local announcement re-check even when the id was first heard
         from the relays;
       - or have `publishEverywhere` announce once: after the local route when it succeeds, otherwise after the
         external one.
     - Either shape keeps one re-check in the usual order, so P3 "both routes" can stay as it is.
     - Pin it with a P3 case in probe C's shape: the local publish delayed behind relays that accept at once, and a
       status mock that answers from the local relay's state. It asserts that the pill ends on the new count.
     - If the chosen shape lets the early, stale answer show for a moment, either say so in AC-3 or rule it out.
     - Correct Option A's pro and its Cons, and record the change in the story's Deviations.
     - If the owner would rather keep the current design, amend AC-3 and ADR 0003 to state the gap, and open a ledger
       row.

### Non-blocking

1. **ADR 0002 `:3` and ADR 0001 `:3`: neither Status line records what ADR 0003 supersedes or extends.**
   - The repo's convention records a partial supersession on the older ADR's Status line. For example,
     `engineering-team/decisions/done/curated-dlist-update/0005-update-preview-and-honest-reads.md:3` says "(§7's
     entries and §8's closing line superseded by `curated-dlist-update` ADR 0006)". There are nine more under
     `done/dlist-curation/`, `done/my-curated-dlists/` and `done/curated-dlist-update/`.
   - ADR 0002 still reads as if these were current:
     - `aria-label={SETUP_ALERT_COPY.name}` (`:186`);
     - the `name` and `'Finish setup →'` copy (`:211`);
     - the white text on the chip (`:221`);
     - "No other trigger is added" (`:247`).
   - ADR 0001 does not mention the new trigger.
   - Asked: add the parenthetical to both Status lines. It can go with Blocking 1's amendment.
2. **ADR 0003: sentences the code or the source contradict.** Fix them with the amendment.
   - **`:183` and `:190`: "within about a second" and "Any flash lasts only the local check's duration".**
     - The check waits for both lookups (`src/api/setup/status.js:263–266`).
     - Take a viewer with no Map anywhere: the usual new account, with step 3 left. Their Map lookup misses locally
       and reads outside relays. That took about 2.5 s in story 2's live pass, and it is capped at 8 s (ADR 0001
       `:189–191`).
     - So after each follow, the pill is gone for that long before it comes back. I did not re-measure this live.
   - **`:189`: "`/setup` shows its 'still checking' state".**
     - `/setup` has no separate checking state. It shows "0 of 3 complete" with every step "Not done", step 1
       included. That is story 1's design (probe D).
     - It is not the old answer, so AC-3 holds.
   - **`:40–41`: "(`publishToRelays`, then `publishToLocalStrfry`)".** These are the push and pull branches of one sync
     (`TreasureMapRelayPresence.jsx:177–214`), not a sequence.
   - **`:37–39`, the Treasure Map editors.** The list leaves out `CurateHereOffer.jsx:94–95`, which signs a kind 10040
     (`upsertDListEntry`) and publishes through `publishOrThrow`. It is covered, so no behaviour is missing.
   - **`:26–27`: "one of two routes".** That holds for the React app.
     - The legacy static pages publish a signed 10040 through `/api/publish-signed-kind10040`:
       `public/pages/nip85.html:324`, `customers/sign-up.html:790`, `customers/customer.html:986` and
       `index.html:790`.
     - They are separate documents, so the app loads again after them.
     - Relatedly, S2 watches only the `/api/strfry/publish` literal. So `:199–200`, "The Tester's sentinel … makes a
       new raw caller visible", covers that one endpoint.
   - **`:172–173`: "The same section's 'a step completed in another app shows on the next full page load, or after
     refresh()'".**
     - That is the provider's own header comment (`SetupStatusContext.jsx:16–17` at `6754a16a`).
     - ADR 0001 § 3 (`:351–370`) does not contain it. ADR 0001 § Consequences `:185` has a similar line.
3. **The test plan:**
   - **`:251–252`, the gate's order.** It is `honest-publish-reporting`, then `treasure-map-relay-presence`, then
     `setup-alert-polish` (`test/registry.js:216`, `:220`, `:253`). It is not "then `setup-alert-polish`, then
     `treasure-map-relay-presence`". The counts are right: in the true order I got 10/0, 35/0 and 14/0.
   - **`:150–151`: "neither `src/` nor `ledger/`".** This stopped being true at `9fa997af`, which edits one ledger row
     and adds another. The suites that read the real `ledger/` and are outside the gate pass on their own (above).
     See Harness friction 1.
   - **`:43` and `:58`:** P3 "both routes" cannot tell which route announced first (Blocking 1).
4. **`ui/src/components/SetupAlert.jsx:30–31`: a percent-encoded spelling still shows the pill on a setup page.**
   - `/%73etup` and `/%53ETUP` render `/setup` with the pill, on both builds, because the router decodes the path
     before matching.
   - AC-4 says "in any letter case", which this is not, and nobody types it.
   - Optional: match with the router (`matchPath` or `useMatch`), or decode the path before comparing.
5. **`ui/src/pages/users/UserDetail.jsx:312–315`: an aborted request or a non-JSON answer during the import no longer
   logs.**
   - Before, the `catch` logged "Find event error: …". Now `publishToLocalStrfry` resolves `{ success: false }`, and
     this site's `else` does nothing.
   - On screen nothing changes (probe), and Deviation 2's "or do nothing" records it.
   - Optional: log in the `else`.
6. **Not verified:**
   - **Screen readers and voice control.** Chrome's accessibility tree is the evidence. Whether VoiceOver or NVDA
     speak the "·" depends on their punctuation settings.
   - **A live Follow.** The local stack publishes externally, as Deviation 4 says.
   - **Firefox and Safari.**

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **The walker triage happens once, at Test Design, but Phase 4 can touch new trees.**
   - `9fa997af` touched `ledger/` after the plan's triage said the branch did not.
   - Also, the `readdirSync` grep cannot find a suite that reads a tree through a script it spawns.
     `harness-lint.test.js` runs `scripts/harness-lint.sh` on the real repo, and that script's L15 reads every
     `ledger/*.md`.
   - Both passed here.
   - Extend `2026-09-21-abbreviated-path-names-no-gate` with two clauses:
     - re-triage after any commit that touches a new tree;
     - count a suite that spawns a repo script as a reader of whatever that script reads.
2. **The review template's closing section after `## Verdict` still makes a review that requests changes parse as
   passed.**
   - This is OPEN.md row 28. A two-line fixture through `scripts/lib/review-verdict.awk` confirms it still happens.
   - This file puts its close-out above the verdict.
   - Add a recurrence note to row 28.

## Close-out (same commit)

- [ ] Story `**Status:**` stays `Approved`: this review requests changes.
- [ ] Completion detection: none until a later round clears Blocking 1.

## Verdict

**CHANGES_REQUESTED**

## Round 2: `29438ff3`

**Reviewer:** Claude (acting as Reviewer). I did not write round 1, the ADR amendment, the tests or the code.
**Date:** 2026-09-21
**Diff:** `git diff 27050a3b..HEAD` on `feat/setup-status-and-alert`, HEAD `29438ff3`, working tree clean. The commits:
- `1d81afa6` ADR 0003 Amendment 1, the Status lines of ADRs 0001 and 0002, and the inline correction pointers in
  ADR 0003;
- `9a9e6aeb` the round-2 tests: P3 race and P3 import (new), U8 and D2 (re-aimed), U9 and U10 (new);
- `9cd66d73` the re-aim of `treasure-map-relay-sync` R4;
- `29438ff3` the code: `ui/src/utils/nostrPublish.js` and `ui/src/context/SetupStatusContext.jsx`.

### In short

- **Blocking 1 is closed, in the code and in my own runs.**
  - `publishEverywhere` now announces once: straight after a successful local write, otherwise after the relays
    settle if one accepted (`nostrPublish.js:226–232`). The provider re-checks on every announcement
    (`SetupStatusContext.jsx:68–72`).
  - Round 1's probe C, re-run on the built UI:
    - the relays accept at +69 ms and the local write answers at +835 ms;
    - the one re-check starts at +839 ms and ends on "· 1 step left".
    - On `bad15295`, rebuilt from source, the same probe still ends on "· 2 steps left".
  - The second way in is closed too, but the ADR describes it in an order the page cannot produce (Non-blocking 2).
    In the order it can, `bad15295` leaves the pill on "· 1 step left" after the import, and HEAD clears it.
- **One new blocking issue, in a test this round added.** P3 import (`tests/brainstorm/setup-alert-polish.spec.js:341–355`)
  checks in an order that races.
  - On HEAD's correct code it failed 3 times in 30 runs.
  - With the import's re-check answering the old "1 step left", it still passed 6 times in 20.
  - Round 1's Map-editor test just below it checks in the safe order, and catches the stale answer 20 times in 20.
  - The fix is the Tester's and small. No code change is asked.
- **Everything else holds.** I checked it with my own runs, not the Implementer's numbers:
  - the 102-suite gate, 2094/0;
  - `rollup-scanners`, which the triage missed (Harness friction 1), 33/0;
  - the browser classes, 85/85 and 55/55;
  - eslint parity and `harness-lint`.
- **Round 1's non-blocking items:**
  - the ADR Status lines and ADR 0003's sentences are fixed, and accurate;
  - the test plan's first half still describes round 1's design (Non-blocking 3);
  - Non-blocking 4 and 5 were optional, and are untouched.

### Quality gates (run by reviewer, not trusted)

- [x] **The walker triage, re-run against `git diff 6754a16a...HEAD`.** I applied ledger row
  `2026-09-21-abbreviated-path-names-no-gate`, including its two newest clauses.
  - The branch touches `OPEN.md`, `engineering-team/`, `ledger/`, `test/`, `tests/brainstorm/` and `ui/src`. It
    touches neither `src/`, `scripts/` nor `firmware/`.
  - The brief's list is the plan's heredoc plus `harness-lint` and `ledger-row-ids`. A dry run gives 93 named suites
    and 9 walkers the grep misses: 102, none missing from `test/registry.js`.
  - One more suite reads what the branch touches, through a script it spawns: `rollup-scanners`.
    - Its AC-2 runs `scripts/lib/collect-meta.sh` on the real repo.
    - That script reads the `meta` rows of `OPEN.md` and the open `meta` rows under `ledger/`.
    - Round 1's review commit edited `OPEN.md` row 28. Round 2 edited the meta row
      `2026-09-21-adr-reaim-list-misses-outcome-asserts`.
    - So I ran it on its own (below).
  - The other suites that spawn repo scripts read fixtures (`harness-stats`, `safe-to-merge-check`), or trees the
    branch does not touch (`tl-certainty-method`, `tl-weighted-sum-method`, `event-less-create-set`).
- [x] **The gate.** I ran the plan's heredoc with `harness-lint` and `ledger-row-ids` added to the walkers, under
  `GATE_LABEL=setup-alert-3-r2-review`, with nothing else running. `npm run gate:status -- --label setup-alert-3-r2-review`
  reads:

  ```
  20260922T010816Z-21552-5645 [setup-alert-3-r2-review] started 2026-09-22T01:08:16.890Z on 29438ff3 — PASS, exit 0, 2094 passed, 0 failed, 4 skipped, 102/102 suites · /Users/wds4/repos/nous-clawds4/tapestry/tmp/gate-runs/20260922T010816Z-21552-5645.json
  ```

  - The record has `git.dirty: false`, no stray errors, and node v24.18.0.
  - The four skips are the baseline's own: `deploy-safety-status` 1, `show-the-four…` 2 and `setup-status` H2 1.
  - Round 1's gate passed 2010 tests over 100 suites. Add `harness-lint` 76, `ledger-row-ids` 6 and the new U9 and
    U10, and that is 2094.
  - `setup-alert-polish` runs last (#102): 16/0.
  - The suites this round touches or leans on: `global-publish-gate` 8/0, `treasure-map-relay-sync` 22/0,
    `honest-publish-reporting` 10/0, `treasure-map-relay-presence` 35/0 and `session-start` 32/0.
- [x] **Five suites outside the gate, each run on its own through `.run()`:**
  - `rollup-scanners`: 33 passed, 0 failed. That includes AC-2 on the real `OPEN.md`;
  - `close-unauth-write-surface`: 14 passed, 0 failed;
  - `event-tagging-write-path`: 19 passed, 0 failed;
  - `one-default-assistant-profile`: 52 passed, 0 failed;
  - `reconciliation-rearchitecture`: 15 passed, 0 failed.
- [x] **HEAD's Node suite against `bad15295`'s code** (a scratchpad mirror): 14 passed and 2 failed.
  - U8 fails with "heard 2", and D2 fails.
  - U9 and U10 pass.
  - That is the test plan's round-2 table, row for row.
- [x] **The UI build** (`npm --prefix ui run build`) exits 0. It gives `index-DNK2T4Hx.js` and `index-DLb1LOT-.css`.
  - `:4173` serves that file (same SHA-256), and so does the live `:7778`. So the story's "redeployed to `:7778`"
    holds.
  - I rebuilt `bad15295` from `git archive` into the scratchpad. It gives `index-8tznIVuA.js`, the hash round 1
    recorded. I served it on `:4174`.
- [x] **The browser classes on `:4173`:**
  - `setup-alert-polish`, `setup-alert` and `setup-status`: **85 passed** (20, 50 and 15);
  - the five hermetic /assistant specs: **55 passed** (18, 15, 8, 4 and 10). Each has the `/api/**` catch-all.
  - The story's spec against `:7778` gives 20 passed.
- [x] **The round-2 spec against `bad15295` on `:4174`:** 19 passed and 1 failed.
  - The failure is P3 race: "the pill must end on the new answer".
  - P3 import passes.
  - That matches the plan's table: the race test fails, and the import test is a guard.
- [x] **Repeats of the story's P3 tests on `:4173`** (`--repeat-each`): see Blocking 1.
- [x] **eslint parity with `27050a3b`,** through `--stdin` with the ui config. Nothing is new:
  - `nostrPublish.js` has `no-empty` ×1: the `pool.close` catch, now at `:206`;
  - `SetupStatusContext.jsx` has `only-export-components` ×1.
- [x] **`bash scripts/harness-lint.sh`:** exit 0, "harness-lint: clean (0 violations)", on the tree under review.
- [x] **Hygiene**, over the round's files:
  - no raw control bytes;
  - no 64-hex literal added;
  - no `console.log`, `debugger`, TODO or `.only(`;
  - no package, eslint, vite or Playwright config change.
- [ ] _Lint, typecheck and build are not configured: skipped. The eslint parity check and the UI build above are
  the book's checks._

### Round 1's findings, re-checked

| Round 1 | Round 2 | Evidence |
|---|---|---|
| **Blocking 1**, the race | **Resolved** | Probes C and C2 below. P3 race fails on `bad15295` and passes on HEAD |
| **Blocking 1**, the second way in | **Resolved in the code; the ADR's example is wrong** | Probe L below; Non-blocking 2 |
| **Non-blocking 1**, the ADR Status lines | **Resolved** | ADR 0001 `:3` and ADR 0002 `:3` now record the extension and the four superseded clauses. ADR 0002's list matches ADR 0003 § Decision (`:165–170`). ADR 0001's line calls ADR 0002's Implementation notes § 5 "Decision 5", as the provider's header comment already did; ADR 0002 calls it § 5. That is harmless |
| **Non-blocking 2**, ADR 0003's sentences | **Resolved** | See the note below the table |
| **Non-blocking 3**, the test plan | **Partly** | The gate order and the `ledger/` triage are corrected (`:254–257`). The coverage map, the edge cases and the mutation table still describe round 1's design (Non-blocking 3) |
| **Non-blocking 4**, `/%73etup` | Not addressed; it was optional | `SetupAlert.jsx` is not in this round |
| **Non-blocking 5**, UserDetail's log | Not addressed; it was optional | `UserDetail.jsx` is not in this round |
| **Non-blocking 6**, not verified | Still not verified | See Non-blocking 7 |
| **Harness friction 1 and 2** | Recorded | The ledger row has both new clauses, and `OPEN.md` row 28 has the third-occurrence note |

I checked each of ADR 0003's inline pointers and each entry under "Corrections to the text above":
- the relay budget is `RELAY_BUDGET_MS = 8000` (`src/api/setup/status.js:33`);
- `/setup` shows "0 of 3 complete" during a re-check (probe D);
- the push and pull branches are `TreasureMapRelayPresence.jsx:177–214`;
- `CurateHereOffer.jsx:95` calls `publishOrThrow`;
- the legacy pages publish through `/api/publish-signed-kind10040`: `public/pages/nip85.html:324`,
  `customers/sign-up.html:790`, `customers/customer.html:986` and `index.html:790`. So does
  `customers/customer_backup.html:1099`, which the amendment does not name;
- the quote is in the provider's header comment at `6754a16a`, and nowhere in ADR 0001.

### The Deviation: an `{ announce }` option, not internal functions

- **It is acceptable.**
  - Every current caller behaves as before. I grepped every call site in `ui/src`:
    - `publishToLocalStrfry` is called with one argument (`TrustedAssertions.jsx:106`, `UserDetail.jsx:312`,
      `BrainstormSettings.jsx:370`, `TreasureMapRelayPresence.jsx:197`);
    - `publishToRelays` is called with two (`TreasureMapRelayPresence.jsx:181`, `dispositionActions.js:32` and
      `:64`, `ConceptDetail.jsx:126`);
    - only `publishEverywhere` passes `{ announce: false }` (`nostrPublish.js:226–227`).
  - No caller can hit the new parameter by accident: none passes more arguments, and none hands the helpers over as a
    callback.
  - The local-only guard is still the first statement of `publishToRelays` (`:170`), and `global-publish-gate`
    passes 8/0.
  - The Deviation's reason is right. The suite's coverage check reads `publishEverywhere`'s text for the word
    `publishToRelays` (`test/global-publish-gate.test.js:150–156`). So a `publishEverywhere` that called an
    internal function by another name fails it.
- **The ADR should say what was built** (Non-blocking 1).
- **The cost is one wider export.** A future caller could pass `announce: false` and quietly lose the Setup Alert's
  refresh (Non-blocking 5).

### My own probes (session scratchpad `review3r2/`, not committed)

They use round 1's method:
- the `/api/**` catch-all is registered first;
- every WebSocket is answered in the page;
- a fake NIP-07 signer signs;
- a MutationObserver keeps every committed state of the pill and of `/setup`'s progress line;
- a fetch wrapper records when each publish and status request starts and ends.

The status mock answers as the real local-first check would: from the probe's own copy of the local relay, read
when each request arrives. Each probe ran on HEAD (`:4173`), and where it matters on `bad15295` (`:4174`).

**AC-3 orderings: Follow on a profile page, as a customer with two steps left, whose local relay already holds an
older follow list.** Times are from the click.

| Case | HEAD | `bad15295` |
|---|---|---|
| A: local-only gate; the answer delayed 1.5 s | re-check at +55 ms, right after the write (+54). The pill hides, then shows "· 1 step left" at +1559. 2 reads | not run |
| B: both routes, nothing delayed | "· 1 step left". 2 reads | the same |
| C: relays at once; the local write takes 800 ms (round 1's probe C) | relays at +69, write answered at +835, re-check at +839: **"· 1 step left"**. 2 reads | re-check at +53: **"· 2 steps left"**, and it stays |
| C2: the relays answer after 800 ms; the local write at once | re-check at +54, before any relay answered: "· 1 step left" | the same |
| E1–E3: the local write refused, aborted or an HTML 502; relays accept | one re-check after the relays (+57 to +61). It shows the local relay's older answer, "· 2 steps left" | the same |
| E4: the local write refused; relays accept after 800 ms | one re-check at +873, after the relays settled: "· 2 steps left" | the same |
| F: the local write refused, and every relay refuses | no re-check. 1 read | not run |
| G: local-only gate; the local write refused | no re-check. 1 read | not run |
| H: local-only gate; the local write takes 800 ms | re-check at +837, after the write: "· 1 step left" | the same |
| D: an in-app move to `/setup` 150 ms after the click; the answer delayed 2 s | `/setup` reads "0 of 3 complete" until the answer, then "2 of 3 complete". Never "1 of 3" | not run |
| J: Follow, then Unfollow at +111 ms. The Follow's read answers late ("1 left" at +2561), the Unfollow's early ("3 left" at +352) | 3 reads. The pill reads "· 3 steps left" from +353, and the late answer never replaces it | not run |

- E1 to E4 are the case Amendment 1 records: "When the local write fails but a relay accepted … no worse than before
  this story".
  - The old count is then the check's own answer, because a local hit ends the lookup (`src/api/setup/status.js:143`).
  - No later announcement comes that could change it.
- **In no ordering did the pill show an old answer as finished when a later announcement should have corrected it.**

**The second way in (probe L), as the Owner on the Treasure Map page.** The Map is only outside.
1. The hand editor publishes a changed Map. The local write is refused, and the five relays accept.
2. The page searches again. It finds the new Map outside, and offers "Import to local strfry".
3. The import stores that same event (`999999…`) locally.
4. The status mock says "· 1 step left" until the event is local.

- **HEAD:** three reads. The import's re-check starts at +2650 ms, and the pill goes.
- **`bad15295`:** two reads. The import's announcement carries an id already heard, so the pill stays at
  "· 1 step left", though the Map is now local.
- So Decision 2 fixes a real, reachable path. It is not the one the ADR names (Non-blocking 2).

**A burst (probe K).**
- The setup: as the Owner, with the Map local and three relays lacking it, I pressed "Send my version" on all three,
  120 ms apart.
- HEAD re-checks three times: reads 2, 3 and 4 start at +41, +190 and +323 ms.
- I made reads 2 and 3 answer late, with a stale "1 left" (+1644 and +1395), and read 4 early, with nothing left
  (+427). The pill stayed hidden throughout.
- The request key and the cancel flag keep the newest answer (`SetupStatusContext.jsx:35`, `:44–60`).
- All four rows then read "Has this version", with no page errors.

**Reasoned from the code, not driven:**
- **Signed out:** the listener returns on `!pubkey` (`:69`), and there is no request anyway.
- **While sign-in resolves:** `refresh()` raises `attempt`, but the request stays null until auth settles (`:35`),
  and then there is one read.
- **Another pubkey or another kind:** filtered out (`:69–70`). Round 1's import probes showed that another user's
  Find does not re-check, and nothing on that path changed.
- **Caching:** the live `/api/setup/status` sends only a weak ETag, with no `Cache-Control`, `Expires` or
  `Last-Modified`. The handler has no cache of its own. So every re-check reaches it.

### Findings

#### Blocking

1. **`tests/brainstorm/setup-alert-polish.spec.js:352–353`: the new P3 import test checks in an order that races,
   and it does not pin its own headline.**
   - **The mechanism.**
     - The pill hides as soon as a re-check starts, because the phase is `checking` (ADR 0001 § 3).
     - So `toHaveCount(0)` at `:352` can pass during the re-check itself, before the second status request reaches
       the test's route handler.
     - Then `state.statusCalls` at `:353` still reads 1.
   - **Measured on HEAD's correct code:** 3 failures in 30 runs (1 in 20, then 2 in 10). Each was "one re-check
     after the import … Received: 1". The other five P3 tests passed 50 of 50.
   - **Measured with the import's re-check answering the old "1 step left"** (a copy of the spec with
     `answerFor: () => ONE_LEFT_MAP`): it still passed 6 of 20. So "nothing is left, so the pill goes" is not pinned.
   - **The test below it does this right.** Round 1's Map-editor test polls the read count first, and then checks the
     pill (`:384–385`). With the same stale answer it failed 20 of 20, and on HEAD it was stable.
   - **Why it blocks.** This is an acceptance criterion's test that fails about one run in ten on correct code.
     - It makes every later run of this class suspect. Later stories re-run it for their own AC-5.
     - It teaches re-running until green.
     - The round's recorded "85/85" is true only per run.
   - **Asked change (Tester):**
     - order P3 import as `:384–385` does: `expect.poll(() => state.statusCalls).toBe(2)`, then `toHaveCount(0)`;
     - or wait until the second answer has been served before checking the pill;
     - show it is stable with `--repeat-each` (20 or more), and that it fails on a stale answer.
   - **Recommended in the same pass:** extend the test to probe L's shape. That also closes Non-blocking 4.
     - The hand editor publishes, with the local write refused and the relays accepting.
     - Then "Import to local strfry" the same event.
     - Expect three reads, and the pill gone.
     - I ran exactly this shape. It fails on `bad15295` and on the variant in Non-blocking 4, and it passes on HEAD.
     - The spec's `mock` already has most of it (`mapLocal: false`, `authDelayMs`). It needs an answer per local
       publish, and an outside relay that serves what was published to it.

#### Non-blocking

1. **ADR 0003 `:315–316`, Amendment 1 Decision 1: "through internal versions of the two routes that do not
   announce".**
   - The code gives the two exported routes an `{ announce }` option instead (`nostrPublish.js:77`, `:166`).
   - The story records the change and why (Deviations `:121–132`). The ADR still describes functions that do not
     exist.
   - Asked (Architect): an italic as-built pointer, like the others, naming the option and the story's Deviation.
2. **ADR 0003 `:307–308` and `:318`: the second way in, "push a Map to a relay … then import it locally", and "such
   as a push and then an import".** The page cannot do these in that order.
   - "Send my version", the push, is offered only when the local relay holds the Map:
     - `localEvent = inLocal ? event : null` (`TreasureMapRelayPresence.jsx:164`);
     - `planRelaySync` pushes only when it has a local event (`ui/src/utils/treasureMap.js:1204–1205`).
   - "Import to local strfry" is offered only when the local relay does not hold it
     (`TreasureMapRelayPresence.jsx:278–289`).
   - The real path is probe L: a publish whose local write fails while a relay accepts, then an import of that event.
     For a follow list, the import is UserDetail's Find on the viewer's own page.
   - Round 1 traced its version in the source and did not drive it, and the amendment took it over. The decision is
     right; only the example is wrong.
   - Asked (Architect): replace the example.
3. **The test plan's first half still describes round 1's design.**
   - `:11` and `:15` say 14 tests and "U ×8"; there are now 16 and ×10. `:20` says 18 tests; there are now 20.
   - The AC-3 row of the coverage map (`:43`):
     - says P3 "both routes" sees "two announcements of one event";
     - says D2 pins "de-duplicated by id". D2 now asserts the opposite, and `publishEverywhere` announces once;
     - does not list P3 race, P3 import, U9 or U10.
   - These are round 1's design too:
     - the edge case at `:58` ("One event announced twice (local plus outside, U8)");
     - the mutation row at `:215` ("no de-duplication …");
     - the spec's message at `:324`: "two announcements of the same event must cause one re-check".
   - Asked (Tester): update them with Blocking 1's fix. The coverage map is what a reviewer checks the criteria
     against.
4. **Amendment 1 § 2 is pinned only by D2's source pattern** (`test/setup-alert-polish.test.js:292–293`: no
   `new Set(` and no `.has(x.id)`).
   - A provider variant that keeps id memory in an object (`useRef({})`, then `if (heard.current[ev.id]) return;`)
     passes the Node suite 16/16, D2 included.
   - It also passed the browser class, 19 of 20. Its one failure was Blocking 1's race, not a detection.
   - Probe L on that variant reproduces round 1's second way in: the pill stuck at "· 1 step left".
   - D2 does catch round 1's exact shape. Blocking 1's recommended probe-L test would close this.
5. **`nostrPublish.js:73–74` and `:162–163`: nothing flags a caller other than `publishEverywhere` that passes
   `announce: false`.** The JSDoc documents it.
   - Optional: have D3 or S2 list the files that pass it.
6. **Story `:121–122`: the heading says "as written", and the next line says "Not quite as written".**
   - Optional: drop "as written" from the heading.
7. **Not verified:**
   - screen readers and voice control;
   - Firefox and Safari;
   - a live Follow: the local stack answers `allowExternalPublish: true`;
   - the "about 2.5 s live" catch-up for a viewer with no Map;
   - signing out while a publish is in flight. I reasoned it from the code above.

#### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **This round's walker list missed `rollup-scanners`, though the ledger row's newest clause covers it.**
   - The list added `harness-lint` and `ledger-row-ids`, the two `ledger/` readers round 1 named.
   - `rollup-scanners` AC-2 also reads the meta rows of `OPEN.md` and the open meta rows under `ledger/`. It does so
     through `scripts/lib/collect-meta.sh`, which it spawns on the real repo (`test/rollup-scanners.test.js:108–117`).
   - It passed on its own, 33/0.
   - Asked:
     - add this as another instance on `2026-09-21-abbreviated-path-names-no-gate`;
     - turn the clause into a recipe: grep `test/` for spawns of `scripts/` and for reads of `OPEN.md` and
       `ledger/`, then triage each hit.
2. **Test Design proves a browser test satisfiable with a single run.**
   - P3 import passed the Tester's oracle run, the Implementer's runs, and my first run.
   - Only `--repeat-each` showed the race.
   - Only a stale answer from the mock showed that its final check does not bite.
   - Asked: when a browser test waits for a state that also appears in passing, run it with `--repeat-each` on the
     oracle build, and mutate its final answer, before calling it satisfiable. Here the passing state was the pill
     hidden during `checking`. The rule could go in the Tester role or the test-plan template.

### Close-out (same commit)

- [ ] Story `**Status:**` stays `Approved`: this round requests changes.
- [ ] Completion detection: none until a later round clears Blocking 1.

### Verdict (round 2)

**CHANGES_REQUESTED**

## Round 3: `46403384`

**Reviewer:** Claude (acting as Reviewer). I did not write rounds 1 or 2, the ADR, the tests or the code.
**Date:** 2026-09-21
**Diff:** `git diff 63a80f91..HEAD` on `feat/setup-status-and-alert`, HEAD `46403384`, working tree clean. The commits:
- `79e319ad` the round-3 tests (P3 import reordered, P3 second way in, S3) and the test plan;
- `46403384` ADR 0003's as-built note and corrected example, and the story's Deviations heading.

No code changed this round: `git diff 29438ff3..HEAD -- ui/ src/` is empty. The story's whole code change is still
`git diff 6754a16a..HEAD -- ui/`.

### In short

- **Round 2's Blocking 1 is resolved, as asked.**
  - P3 import now polls the read count before it checks the pill (`tests/brainstorm/setup-alert-polish.spec.js:362–363`).
  - It can no longer fail on correct code: once the second read has started, every later state of the pill is "none".
  - It passed 100 of 100 runs, and 20 of 20 at 28 workers. An instant stale answer fails it 100 of 100.
- **The new "second way in" test is sound.**
  - It drives the real page path.
  - It fails 20 of 20 on `bad15295` and on a provider that remembers ids in an object. It passes 100 of 100 on HEAD.
  - Round 2's Non-blocking 1 to 6 are resolved (3 mostly).
- **One new blocking issue, in P3 Follow, a test from Test Design that no round has tested for bite.**
  - Its check for AC-3's second clause ("never showing the old count while it re-checks") cannot fail.
  - A provider that keeps showing the old count throughout the re-check passes every browser and Node test of all
    three stories: 86 of 86 in the browser.
  - `/setup` during a re-check has no test at all.
  - The fix is the Tester's. No code change is asked (Blocking 1).
- **Non-blocking:**
  - the "no pill" checks, and P4's, bite only because the mock answers at once;
  - one line of the test plan is stale;
  - S3 misses a quoted key;
  - AC-3's "counted again" direction has no test.
- **Everything else holds.** I checked it with my own runs, not the Implementer's numbers:
  - the 103-suite gate, 2128/0;
  - the browser classes: 86 of 86 and 55 of 55, and 21 of 21 against the live `:7778`;
  - 620 runs of the P3 tests on HEAD's build, none failing;
  - `harness-lint` and hygiene, clean.

### Quality gates (run by reviewer, not trusted)

- [x] **The walker triage, re-run against `git diff 6754a16a...HEAD`.** I followed ledger row
  `2026-09-21-abbreviated-path-names-no-gate`, including its spawned-script recipe.
  - The branch touches 28 files, under `OPEN.md`, `engineering-team/`, `ledger/`, `test/`, `tests/brainstorm/` and
    `ui/src`. It touches neither `src/`, `scripts/` nor `firmware/`.
  - The recipe's greps:
    - `readdirSync`: 22 suites and 2 helpers;
    - spawns of `scripts/`;
    - real reads of `OPEN.md` and `ledger/`.
  - I also swept for readers of `engineering-team/`, `tests/` and `test/registry.js`.
  - Outside the gate, the greps and the sweep give 31 candidates. Each one reads something this branch does not
    change:
    - a tree the branch does not touch;
    - a fixture;
    - a comment only;
    - or fixed files outside the branch. The three `curated-dlist-update-*` suites read named `ui/src` files, none
      of the eight this story changes.
    - `curated-dlist-update-update-preview` reads `OPEN.md` row 314, and `operational-direction` reads row 41. The
      branch changes only row 28.
    - `scheduled-task-timeout-propagation`'s "registry" is the task registry.
  - So the brief's list covers every reader: the plan's heredoc with `harness-lint`, `ledger-row-ids` and
    `rollup-scanners` added to the walkers. It is 93 named suites and 10 walkers the grep misses: 103, none missing
    from `test/registry.js`.
- [x] **The gate,** under `GATE_LABEL=setup-alert-3-r3-review`, with nothing else running.
  `npm run gate:status -- --label setup-alert-3-r3-review` reads:

  ```
  20260922T015721Z-54569-b0eb [setup-alert-3-r3-review] started 2026-09-22T01:57:21.306Z on 46403384 — PASS, exit 0, 2128 passed, 0 failed, 4 skipped, 103/103 suites · /Users/wds4/repos/nous-clawds4/tapestry/tmp/gate-runs/20260922T015721Z-54569-b0eb.json
  ```

  - The record has `git.dirty: false`, no stray errors, and node v24.18.0. It took 195 s.
  - The four skips are the baseline's own: `deploy-safety-status` 1, `show-the-four…` 2 and `setup-status` H2 1.
  - Round 2's gate passed 2094. Add `rollup-scanners`' 33 and S3, and that is 2128. Every other suite has round 2's
    count.
  - `setup-alert-polish` runs last (#103): 17/0.
  - The suites this story leans on:
    - `global-publish-gate` 8/0 and `treasure-map-relay-sync` 22/0;
    - `honest-publish-reporting` 10/0 and `treasure-map-relay-presence` 35/0;
    - `harness-lint` 76/0, `ledger-row-ids` 6/0, `rollup-scanners` 33/0 and `session-start` 32/0.
- [x] **Six suites outside the gate, each run on its own through `.run()`:**
  - `close-unauth-write-surface` 14/0;
  - `event-tagging-write-path` 19/0;
  - `one-default-assistant-profile` 52/0;
  - `reconciliation-rearchitecture` 15/0;
  - `curated-dlist-update-update-preview` 34/0;
  - `operational-direction` 86/0. Its H tests only read, and H6 asserts that the read writes nothing.
- [x] **The UI build** (`npm --prefix ui run build`) exits 0. It gives `index-DNK2T4Hx.js` and `index-DLb1LOT-.css`,
  round 2's hashes.
  - `:4173` serves that file (same SHA-256), and so does the live `:7778`.
- [x] **The browser classes on `:4173`:**
  - `setup-alert-polish`, `setup-alert` and `setup-status`: **86 passed** (21, 50 and 15);
  - the five hermetic /assistant specs: **55 passed** (8, 4, 10, 18 and 15). Each has the `/api/**` catch-all.
  - Story 3's spec against the live `:7778`: **21 passed**. The spec is hermetic there too.
- [x] **Stability on HEAD's build, `--repeat-each`, default workers (the machine has 28 logical cores):**
  - every P3 test ×30: 210 of 210;
  - P3 import and P3 second way in ×100: 200 of 200;
  - every P3 test ×20 at `--workers=28`: 140 of 140;
  - the whole spec ×10: 210 of 210.
  - That is 620 runs of the P3 tests, none failing.
- [x] **Old code and mutants.**
  - The builds are my own:
    - each from `git archive` into the session scratchpad;
    - built with `vite build --outDir`;
    - served with `vite preview --outDir` on `:4174`–`:4177`, with the hash checked.
  - The mock variants were temporary copies of the spec under `tests/brainstorm/`, and of the Node suites under
    `test/`. All are deleted, and the tree is clean.

  | Build or variant | Result |
  |---|---|
  | `bad15295` (`index-8tznIVuA.js`, round 1's hash), HEAD's spec | 19 passed, 2 failed: P3 race ("the pill must end on the new answer") and P3 second way in ("the import of the same event must re-check again …", Expected 3, Received 2) |
  | `bad15295`, P3 second way in ×20 | 0 passed, 20 failed |
  | HEAD with the provider remembering ids in `useRef({})` (`index-DKdbBB23.js`) | Node suite 17/0: D2's patterns do not match it. Browser: 20 passed, and only P3 second way in failed. ×20: 0 passed, 20 failed |
  | A stale final answer, served at once (`answerFor: () => ONE_LEFT_MAP`; `[ONE_LEFT_MAP]` for the Map editor), ×100 each | P3 import, P3 second way in and P3 Map editor: 0 passed each. All 300 failed at the final pill check |
  | The same stale answer, served 300 ms after the request, ×30 each | 30 passed of 30 for each: 90 false passes (Non-blocking 1) |
  | HEAD with a provider that keeps the held answer while it re-checks the same viewer (`index-sbB7TMq-.js`; the diff is under Blocking 1) | Story 3's, 2's and 1's browser classes: 86 passed of 86. The Node suites against it: 39/0/1, 6/0 and 17/0 (Blocking 1) |
  | Story 2's code (`6754a16a`, `index-CVntJGmH.js`, the case-sensitive hide), P4 as written | 0 passed, 4 failed |
  | The same build; P4 with the `/SETUP` page's read answered after 2 s | 4 passed, 0 failed (Non-blocking 1) |
  | S3 on a mirror of `ui/src` whose `TrustedAssertions.jsx` passes `{ announce: false }` | S3 fails (16/1). The unmodified mirror gives 17/0. With a quoted key, `{ 'announce': false }`, it gives 17/0 (Non-blocking 3) |

- [x] **`bash scripts/harness-lint.sh`:** exit 0, "harness-lint: clean (0 violations)", on the tree under review.
- [x] **Hygiene:**
  - no raw control bytes and no CRLF in any of the 28 files the branch touches;
  - round 3's added lines carry no `console.log`, `debugger`, `.only(`, TODO or 64-hex literal;
  - no package, eslint, vite or Playwright config change;
  - no `ui/` change, so round 2's eslint parity stands.
- [ ] _Lint, typecheck and build are not configured: skipped. The UI build above is the book's check._

### Round 2's findings, re-checked

| Round 2 | Round 3 | Evidence |
|---|---|---|
| **Blocking 1**, P3 import raced | **Resolved, as asked** | The poll comes first (`:362`). The test is stable (above) and fails on an instant stale answer 100 of 100. It still depends on the mock answering at once (Non-blocking 1) |
| **Blocking 1**, the recommended probe-L test | **Done** | P3 second way in (`:367–390`). See "The second way in" below |
| **Non-blocking 1**, the ADR's as-built pointer | **Resolved** | ADR 0003 `:320–322` matches `nostrPublish.js:77`, `:166` and `:226–227`, and the story's Deviation |
| **Non-blocking 2**, the ADR's second-way-in example | **Resolved** | `:307–311` and `:324–325` match the page. A push needs a local event (`ui/src/utils/treasureMap.js:1204`, fed by `TreasureMapRelayPresence.jsx:164`). Import is offered only when the Map is not local (`:278–289`) |
| **Non-blocking 3**, the test plan's first half | **Mostly** | The counts (17 and 21) are updated and accurate, and so are the AC-3 row, the edge case at `:58`, the mutation row and the spec's message (`:333`). Two exceptions: `:66–67` (Non-blocking 2), and the P3 Follow claim at `:43` and `:60` (Blocking 1) |
| **Non-blocking 4**, Amendment 1 § 2 pinned only by D2 | **Resolved** | The id-memory provider passes the Node suite 17/0 and fails P3 second way in 20 of 20 |
| **Non-blocking 5**, nothing flags `announce: false` | **Resolved** | S3 (`test/setup-alert-polish.test.js:358–373`) bites on the plain spelling (Non-blocking 3) |
| **Non-blocking 6**, the story's heading | **Resolved** | Story `:121` |
| **Non-blocking 7**, not verified | **Still not verified** | Non-blocking 5 |
| **Harness friction 1 and 2** | **Recorded** | Ledger rows `2026-09-21-abbreviated-path-names-no-gate` (the recipe clause) and `2026-09-21-single-run-satisfiability`, both from `63a80f91`. This round's plan follows the second |

### This round's own claims, checked

- **The test plan's first half:**
  - `:11`, `:15`, `:18` and `:20`: 17 Node tests (U ×10, C ×1, D ×3, S ×3) and 21 browser tests. These match the gate
    and my runs.
  - The mutation row at `:215` is annotated as round 1's design. Its "Fails" column is round 1's result.
- **The round-3 evidence table (`:321–328`):**
  - I re-derived every row with more repeats. Each holds as stated.
  - One caveat: "Their final checks bite" holds for a stale answer served at once, not for one served late
    (Non-blocking 1).
- **"No code changed in this round":** true.
- **The mock's additions:** they are as described (`:76–77`, `:106`, `:132–133`, `:146–149`).
- **ADR 0003:** the as-built note (`:320–322`), the corrected example (`:307–311`) and Decision 2 (`:323–325`) are
  accurate.
  - The note's reason, that internal functions would have moved the local-only guard, is the story's Deviation. It is
    consistent with `test/global-publish-gate.test.js:150–156`.
- **The story:** the heading is fixed. The Deviations need no round-3 entry, because nothing was implemented this
  round.

### The second way in, and the mock's fidelity

- **It drives the real page path.** Only the network is mocked.
  1. The hand editor (`TreasureMapManualEdit.jsx:38–54`) calls `publishOrThrow`, which throws only when both routes
     fail (`publishProfileTag.js:24–33`). That calls `publishEverywhere`.
  2. The local write is refused, and the five in-page relays accept. So there is one announcement, after the relays
     (`nostrPublish.js:232`), and the first re-check.
  3. `onPublished` runs the page's `search()` (`TrustedAssertions.jsx:46–98`). The local scan is empty, and
     `/api/relay/external` gives back the edit.
  4. The relay panel mounts again, folded. "📥 Import to local strfry" calls `publishToLocalStrfry(edit)` (`:106`).
     That is the second announcement and the third read.
  5. `:387` pins that the import published the edited event, not the old Map.
- **The ordering does not race.**
  - The announcement's `refresh()` and `search()`'s `setLoading(true)` run in the same task: `publishEverywhere`
    returns straight after announcing, and the editor calls `onPublished` next. React batches them.
  - So the old panel is gone before the second read reaches the mock, and the test's clicks wait for the new panel.
  - I read this from the code. All 161 runs of this test on HEAD's build agree.
- **The mock's new behaviour is faithful enough.**
  - **`localRefusals`** answers HTTP 200 with `{ success: false, error }`. That is the real handler's answer to a
    failed `strfry import` (`src/api/strfry/commands/publishEvent.js:112–113`).
  - **The relays:** every in-page socket records each EVENT and answers `OK true` (`:106`), as a relay that accepts
    it would.
  - **One simplification:** `/api/relay/external` answers with the latest recorded kind 10040, whichever relays the
    page asks for (`:132–133`).
    - The page asks its "general purpose relays"; the edit went to `PUBLISH_RELAYS`.
    - For real, the page finds the edit only where those two sets overlap.
    - This simplifies where the Map lives, not the code under test.
  - **The status mock** reads only the local relay. The real check reads outside relays on a local miss.
    - So `:382`'s premise ("step 3 is still counted") assumes that the check's own relays did not find the edit.
    - That is a possible world (ADR 0003 Amendment 1, "What follows").

### Findings

#### Blocking

1. **`tests/brainstorm/setup-alert-polish.spec.js:315–317`, with `:93–98`: P3 Follow's check for AC-3's second clause
   cannot fail when the pill keeps the old count during the re-check. Nothing else pins that clause after an in-app
   save, for the pill or for `/setup`.**
   - **The mechanism.**
     - The recorder adds a log entry only when the pill's text changes (`:97`).
     - The check looks for entries made after `publishedAt + 300` that carry "2 steps left" (`:316`).
     - A provider that goes on showing the held answer while it re-checks never changes the text in that window. It
       adds no entry, so the check finds nothing and passes.
     - The check catches only a pill that hides and then comes back with the old count.
     - It has been this way since Test Design (`786801e1`).
   - **Measured.** A two-line mutant of the provider keeps the held answer while it re-checks the same viewer (diff
     below).
     - **The pill during P3 Follow's delayed read,** sampled every 100 ms:
       - the mutant showed "· 2 steps left" in 12 of 12 samples, and HEAD showed no pill in 12 of 12;
       - P3 Follow's own check found 0 stale entries on both.
     - **`/setup` during the delayed read,** after an in-app move there:
       - the mutant showed the old "1 of 3 complete" in 12 of 12 samples;
       - HEAD showed "0 of 3 complete" in 12 of 12.
     - **The test suites:** story 3's, 2's and 1's browser classes pass 86 of 86 on the mutant. The Node suites pass
       39/0/1, 6/0 and 17/0.
     - **Why nothing else catches it:**
       - the Node D sentinels do not read the phase line;
       - story 1's B10 samples the page in flight, but only across a sign-out, where the reset guard clears the
         answer anyway;
       - story 2's B9 checks only the end state.
   - **What it contradicts.**
     - **AC-3,** second clause (story `:66–67`): "while the new check runs, neither shows the old answer as
       current".
     - **ADR 0003 § 7** (`:269–272`) asks for this test: "during the second read it shows no old count".
     - **The test plan claims it** at `:43` ("a MutationObserver log shows no committed state carrying the old count
       from 300 ms after the publish until the new answer"), and ticks it at `:60`.
   - **Why it blocks.**
     - The code is right today. But this clause of an acceptance criterion has no test that can fail.
     - Keeping the held answer to stop the pill flickering is a natural next change to this provider. ADR 0003's
       Consequences discuss that flash. The change would break AC-3 with every test green.
     - It is round 2's Blocking 1 in a stronger form: a check that does not pin its own headline. That one passed a
       stale answer 6 of 20 times. This one cannot fail on it.
     - No round measured it. The plan's mutation table has no mutant for this clause. Round 1's probes recorded the
       behaviour with their own recorder, not the test's bite.
   - **Asked change (Tester; no code change):**
     - make P3 Follow check the state in force during the delayed read, not only the changes. For example:
       - sample the pill every 100 ms while the answer is held back, as story 1's B10 does;
       - or require that the log entry just before the new answer is the hidden state, begun no later than
         `publishedAt + 300`.
     - check `/setup` in the same window. Move there in-app while the read is held back. Require "0 of 3 complete",
       never the old "1 of 3 complete", until the answer, and then "2 of 3 complete";
     - show that the new checks fail on the mutant below and pass on HEAD with `--repeat-each` (20 or more);
     - correct the plan at `:43` and `:60`, and add the mutant to its mutation table.

   The mutant, for the Tester's oracle. It replaces `ui/src/context/SetupStatusContext.jsx:60`:

   ```js
   const samePerson = !!(result.request && request && result.request.split('#')[0] === request.split('#')[0]);
   const phase = !request ? 'idle' : result.request === request ? result.phase : (samePerson && result.phase === 'answered' ? 'answered' : 'checking');
   ```

#### Non-blocking

1. **`tests/brainstorm/setup-alert-polish.spec.js:363`, `:388`, `:420` and `:433`: the "no pill" checks cannot tell a
   finished answer from a check still running. They bite only because the mock answers at once.**
   - `state.statusCalls` counts a read when its request reaches the mock (`:156`), before it is answered.
   - The pill is also hidden while the check runs. So after `expect.poll(() => state.statusCalls).toBe(n)`,
     `toHaveCount(0)` can pass before any answer is drawn.
   - **The Map tests:**
     - with the spec's instant mock, a stale final answer fails all three of them, 300 of 300;
     - served 300 ms after the request, the same stale answer passes 30 of 30 for each.
   - **P4** waits a fixed 1.5 s instead (`open()`, `:167`). On story 2's case-sensitive build:
     - it fails 4 of 4 as written;
     - it passes 4 of 4 when the `/SETUP` page's read answers after 2 s.
   - So the plan's "Their final checks bite" (`:327`) holds for an instant answer only.
   - Optional: end each test on something only a finished answer shows:
     - for the Map tests, an in-app move to `/setup` showing the all-done state, as P3 Follow does;
     - for P4, `main.bs-setup-main` reading "1 of 3 complete" before the pill check.
2. **Test plan `:66–67`: "the three import flows' own pages in the browser" are still listed as not covered.**
   - The Map page's import is now driven by P3 import and P3 second way in.
   - UserDetail's Find and Settings' import are still not driven in the browser. Round 1 probed them by hand.
   - Optional: say so.
3. **`test/setup-alert-polish.test.js:364`: S3's pattern misses a quoted key or a variable.**
   - `{ 'announce': false }` passed S3 on my mirror (17/0), and `{ announce: quiet }` would too.
   - That is the usual limit of a source sentinel, and the JSDoc documents the option (`nostrPublish.js:73–74`,
     `:162–163`).
   - Optional.
4. **AC-3's "one that became not done is counted again" (story `:65`) has no test.**
   - Every P3 test ends on a lower count.
   - The provider shows whatever the new answer says, so the direction makes no difference to the code.
   - Round 2's probe J drove the other direction: a Follow, then an Unfollow, ended on "· 3 steps left".
   - Optional: an Unfollow case, which Blocking 1's rework could share.
5. **Still not verified** (round 2's Non-blocking 7):
   - screen readers and voice control;
   - Firefox and Safari;
   - a live Follow: the local stack answers `allowExternalPublish: true`;
   - the "about 2.5 s live" catch-up for a viewer with no Map;
   - signing out while a publish is in flight.

#### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **The satisfiability rule catches a check that passes too early. It does not catch a check for a state that the
   code under test never produces.**
   - Ledger row `2026-09-21-single-run-satisfiability` asks for two things: `--repeat-each`, and a stale final answer
     from the mock. Round 3 did both.
   - Neither can exercise P3 Follow's "never shows the old count". A stale answer from the mock is still an answer,
     and this clause is about the time before any answer arrives.
   - Only a mutant of the code that keeps the old state shows that the check is vacuous (Blocking 1).
   - The row's stale-answer step also misses a late answer. Served at once, the stale answer was caught 300 of 300.
     Served 300 ms late, it passed 90 of 90 (Non-blocking 1).
   - Asked: extend the row with two clauses:
     - for every "never shows X" check, a code mutant that keeps showing X, which the test must fail on;
     - serve the stale answer late as well as at once.

### Close-out (same commit)

- [ ] Story `**Status:**` stays `Approved`: this round requests changes.
- [ ] Completion detection: none until a later round clears Blocking 1.

### Verdict (round 3)

**CHANGES_REQUESTED**
