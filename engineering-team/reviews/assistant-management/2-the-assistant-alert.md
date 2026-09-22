# Review: Story 2 — The Assistant Alert

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Diff:** `git diff 383f99e5...43cfd1a3` (the branch base is `origin/staging` at `383f99e5`). Story 2's own
commits: story `df435143`, ADR `6f30e0e5`, failing tests `786e4251`, implementation `43cfd1a3`. Branch
`feat/assistant-management`, working tree clean.
**Story:** `engineering-team/stories/assistant-management/2-the-assistant-alert.md`
**ADR:** `engineering-team/decisions/assistant-management/0002-one-top-bar-alert-slot-setup-first.md`
**Test plan:** `engineering-team/stories/assistant-management/2-the-assistant-alert.test-plan.md`

**In one paragraph.** Against its base, this diff is sound. Every AC has a passing test, every Deviation
is justified, and my own probes agree with the Implementer's measurements. It is blocked for a reason
outside its own code: the shared line moved while it was being built. The Setup Alert
(setup-status-and-alert #2) merged to staging as PR #737, with its own `SetupAlert` component mounted at the
same four places as this story's slot. So:

- ADR 0002's premise ("The Setup Alert is not built … the Setup Alert plugs into it") is false on staging.
- A trial merge conflicts at every one of this story's mounts.
- The owner's rule, one pill at a time with setup first, has only been exercised with the Setup pill
  absent.

The epic foresaw this: "Whichever story lands second fits in beside the other." This story now lands
second, and it was built as if it landed first.

## Quality gates (run by reviewer, not trusted)

- [x] **The book's scoped gate.** One run covers both stories (story 1's test plan § How to run). I ran it
  under Node 22.23.2 with `GATE_LABEL=assistant-management-review`, on the committed tree.
  `npm run gate:status -- --label assistant-management-review`:

  ```
  20260921T225510Z-18790-44e9 [assistant-management-review] started 2026-09-21T22:55:10.205Z on 43cfd1a3 — FAIL, exit 1, 1915 passed, 25 failed, 58 skipped, 106/106 suites; failed: capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, show-the-four-on-the-goal-screens-that-already-exist, concept-count-canonical, summaries-element-count · tmp/gate-runs/20260921T225510Z-18790-44e9.json
  ```

  - The 11 failing suites are the host's live-graph baseline. They fail identically, with the same
    counts, in the Implementer's baseline `20260921T220326Z-24274-84a4` and after-run
    `20260921T222341Z-90700-2c1d`. Their messages concern brain goals, hygiene and concept counts. Details
    are in review 1.
  - This story's suite: `assistant-alert` 14/0/0 (P1–P9, C1, W1–W4). In the baseline it was 1/13/0: only
    the W4 guard passed.
- [x] **Browser class.** Playwright 1.56, chromium, `http://localhost:7778`, bundle `index-DejE49Cv.js`,
  built from HEAD.
  - One run of nine specs: **107 passed, 0 failed, 0 skipped**.
  - `assistant-alert.spec.js`: 9/9 (B0–B8).
  - `setup-status.spec.js`: 15/15. Its B7 375 px check on `/setup` (the "signed in, all done" Owner case)
    now runs with the pill showing, which is the test plan's watch item.
  - The six re-aimed specs, which now render the pill for viewers with an assistant: all green.
- [x] **My own probes** (session scratchpad, every `/api` mocked):
  - **The Tapestry header on phones.**
    - At 375 and 320 px, `.app-header` is **55 px with the pill and 55 px without it**.
    - It is also 55 px with no pill and `.header-auth` forced back to `display: block`. That is the only
      rule this story adds to the header when no pill shows, so 55 px predates this change.
    - Where 55 comes from: `min-height: 48px`, the 38 px user button plus 2 × 8 px padding and a 1 px
      border. The page's content starts at 48 px for any signed-in viewer (`.main-wrapper`).
    - With the brand-word rule neutralised the header is **71 px** at both widths. That confirms the
      Deviation's measurement and why the rule exists.
  - **Brainstorm bars at 375 px** (`/about`, `/tags`, `/`, `/settings`, `/developers`, `/assistant`): no
    overflow. Bar heights are unchanged, except the developer bar, which grows 39 → 47 px when its empty
    slot gains the pill. That is harmless.
  - **Below 375 px:** see Non-blocking 1.
  - **The results view** (`/?q=alice`) at 1280, 800 and 640 px: the pill is present, with no overflow.
  - **Setup-status reads.** `/tapestry/` on a full load: 1 read. In-app to "Assistant Management" (`/assistant`)
    and back: still 1. B7 checks the same on the Brainstorm side. So "once per full load, none on in-app
    navigation" holds on both halves.
  - **Accessibility.**
    - The pill's accessibility snapshot is `link "Manage your Tapestry Assistant"` with `/url: /assistant`.
    - It draws a `:focus-visible` outline.
    - There is no button inside it or beside it.
- [x] **eslint parity.** `TopBarAlert.jsx`, `topBarAlert.js` and `Header.jsx` lint clean.
  `BrainstormUserMenu.jsx`, `BrainstormSearch.jsx` and `DevPage.jsx` have the same rule hits at HEAD as at
  `383f99e5`.
- [x] **`bash scripts/harness-lint.sh`:** exit 0, clean, before this review and on the review commit.
- [x] **A trial merge with the shared line** (`git fetch origin staging`, then
  `git merge-tree --write-tree HEAD origin/staging`; no worktree touched). `origin/staging` is now
  `6754a16a`. It reports **CONFLICT** in `ui/src/components/BrainstormUserMenu.jsx`, `ui/src/components/Header.jsx`,
  `ui/src/pages/BrainstormSearch.jsx`, `ui/src/pages/developers/DevPage.jsx`, `test/registry.js` and
  `ledger/2026-09-21-adr-reaim-list-misses-outcome-asserts.md`.
  - `ui/src/styles.css` auto-merges. The result has two `.header-auth` flex rules (merged lines 672 and
    8965), and two shedding sets, keyed on `:has(.bs-setup-alert)` and on `:has(.bs-topbar-pill)`.
- [ ] _Lint not configured — skipped (eslint parity above)._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test, against the base.**

  | AC | Node (CI) | Browser |
  |---|---|---|
  | AC-1 where and what, click and Enter | W2, W3 (four mounts; BrainstormSearch's mount inside `UserMenu`) | B1 on `/about`, `/tags`, `/`, `/tapestry/`, `/developers` |
  | AC-2 who sees it | P1, P6 | B2 |
  | AC-3 setup first | P2, P3, P4, P5, P8 (96 combinations), W1 | B3 (held, a step left, all done, another provider, failed, late) |
  | AC-4 where it hides, no close | P7 (`/assistants`, `/assistant-x` excluded), W2, W4 | B4 |
  | AC-5 never disagrees | P4, W1, W2 (`assistantAttention`, `attentionCountText`) | B5 |
  | AC-6 every width | — | B6 (1280, 800, 375 px; six pages) |
  | AC-7 read-only | W1, P9 | B7 |
  | § Copy, the look | C1 | B8 (indigo, not amber) |

- [x] **Copy.** "Manage your Tapestry Assistant", "· N actions need attention" and "Manage Assistant →"
  equal story 2 § Copy, the fixture and `ASSISTANT_ALERT_COPY` (mechanical comparison, 0 mismatches).
- [x] **POV.** The pill's count is `assistantAttention(user).count`, from `user.assistantPubkey`: the
  viewer's own assistant. There is no instance-TA read and no TA literal.
- [ ] **"At no moment do the Setup pill and the Assistant pill both show" (AC-3)** is verified only
  vacuously. On this branch's base there is no Setup pill. The test plan says so itself (`:48-50`): the
  sampling "starts to bite" when the Setup Alert ships. It has now shipped (Blocking 1).

## ADR adherence

- [x] **Files match the implementation notes.**
  - `ui/src/utils/topBarAlert.js` is pure and has one import (P9). Its `pickTopBarPill` is the ADR's code.
  - `ui/src/components/TopBarAlert.jsx` has one `<Link>`, an `aria-label` and `aria-hidden` parts.
  - It is mounted once each in the four files, and nowhere else (W4). `TopBar.jsx` does not mount it.
  - The CSS block, the `.header-auth` row and the `:has()` shedding are as sub-decisions 4 and 6 describe.
- [x] **Every Deviation checks out.**
  - (1) The slot is the first child of `.header-auth`. It renders `null` unless someone is signed in, and
    the header height is unchanged (measured above).
  - (2) `const menu` plus a fragment. The DOM is the one the ADR describes.
  - (3) Shedding. Only `TopBar`'s logo word was needed for the Brainstorm bars at 375 px. The Tapestry
    header's name, badge and brand word were needed, as measured. The brand-word step is justified by the
    71 px measurement, which I reproduced.
- [ ] **ADR 0002's premise and hand-off no longer hold on the shared line** (Blocking 1 and 2).
- [x] **The setup-status provider is unchanged by this story.** It reads the shared
  `SetupStatusContext`, which is outside the router, so there is no new fetch.

## Concept-graph integrity
- [x] **Concepts.** None changed. The handles named for orientation exist in kind:pubkey:slug form
  (review 1).
- [x] **Firmware reinstall:** not needed.
- [x] **Orientation:** through `/summaries`.

## Things tests can't catch
- [x] **No secrets, no debug output, no commented-out code** in the added lines.
- [x] **Read-only.**
  - B7 and my probe both see only GETs.
  - There is one `/api/setup/status` per full load, with no parameters. ADR 0002 § Consequences accepts
    this cost, including for signed-in viewers with no assistant.
- [x] **Race.** A late setup answer never flashes the Assistant pill. P2 and B3 (held for 3 s) check this.
- [ ] **The merge with `origin/staging`** (Blocking 1). The trial merge shows it is not mechanical.

## House rules check
- [x] **Concept Graph API authority** is respected.
- [x] **No new lint, typecheck or build tooling.**

## Findings

### Blocking

1. **`ui/src/components/BrainstormUserMenu.jsx:5,212`, `ui/src/components/Header.jsx:6,118,125`,
   `ui/src/pages/BrainstormSearch.jsx:11,602`, `ui/src/pages/developers/DevPage.jsx:2,47` (and the pill
   block at `ui/src/styles.css:8847-8916`)**: this story's slot collides with the Setup Alert, which is
   already on the shared line.
   - **What staging has.** setup-status-and-alert #2 was reviewed and merged to staging (PR #737,
     `6754a16a`, 18:26 EDT). That was three minutes after this branch's implementation commit. It added
     `ui/src/components/SetupAlert.jsx` and mounted it at the same four places, with the same fragment
     pattern and the same `header-brand-word` span. It brought its own CSS: `.bs-setup-alert`, a
     `.header-auth` flex rule and `:has(.bs-setup-alert)` shedding.
   - **Its ADR does not know this book exists.** setup-status-and-alert/0002 never mentions the Assistant
     Alert, this slot, or the owner's "one pill at a time, setup first" rule.
   - **The trial merge conflicts** at all four mounts.
   - **Resolving it is a design decision, not an edit.** Either:
     - (a) staging's Setup Alert renders from this slot's `'setup'` branch, as ADR 0002 sub-decision 5
       designed. Its four mounts go, its CSS joins the `.bs-topbar-pill` base, and staging's `setup-alert`
       suites are re-aimed; or
     - (b) the two components sit side by side. That is ADR 0002's rejected Option B. The picker already
       hides the Assistant pill while setup counts a step, so "never both" would still hold, but by
       convention across two books rather than by construction. ADR 0002 would then need amending.
   - **Either way, the code that ships is new and unreviewed.** AC-3's "never both" has only been
     exercised with no Setup pill in the build.
   - **Ask:**
     1. Merge `origin/staging` into the branch. Staging's commit `c47becd6` records an "owner-required merge of
        origin/staging" before that book's staging PR, in ledger `2026-09-21-abbreviated-path-names-no-gate`
        (the paragraph is on staging, not yet on this branch).
     2. The Architect amends ADR 0002 with the choice.
     3. The Implementer resolves the four mounts and unifies the CSS: one `.header-auth` rule, and one
        shedding set that fires for either pill.
     4. The Tester confirms B3's never-two-pills sampling now counts staging's pill. Its name, "Finish
        setting up your account", already matches `anyPill`. Re-aim any `setup-alert` test the choice
        changes.
     5. Re-run the book's gate on the merged tree. Add `setup-alert` to the pinned list, and re-run the
        walker grep after the merge, per the clause `c47becd6` added to that ledger row.
     6. Re-run the browser class on a build of the merged tree, including `tests/brainstorm/setup-alert.spec.js`.
        That run also carries review 1's Non-blocking 3: B9 must be re-aimed at the editor's new address.
     7. Return for re-review.
2. **Records that are false once the branch meets the shared line.** They describe the Setup Alert as
   unbuilt, or tell it to plug into this slot:
   - **`engineering-team/audits/setup-status-and-alert/book.md:137-154`**, the note this story adds. It tells
     that book's story 2 to "render the Setup pill in the slot's `'setup'` branch, which renders nothing
     today". It also says "Until then, a viewer with a setup step left sees no pill at all". That story is
     Done on staging (review `9cbbe027`) and mounts its own component.
   - **`engineering-team/decisions/assistant-management/0002-one-top-bar-alert-slot-setup-first.md`**:
     - `:29-32`: "The Setup Alert is not built … plugs into it";
     - `:96`: the `'setup'` branch "renders nothing" until it exists;
     - `:217-226`: sub-decision 5, the hand-off;
     - `:260-261`: "Until the Setup Alert ships, viewers with setup steps left see no pill at all".
   - **`engineering-team/stories/assistant-management/2-the-assistant-alert.md`**:
     - `:13-14`: "approved but not built yet";
     - `:45-46`: "Until setup-status-and-alert #2 ships…";
     - `:111-113`: which pill lands first.
   - **`engineering-team/stories/assistant-management/2-the-assistant-alert.test-plan.md`**:
     - `:48-50`: "Today only the Assistant pill exists";
     - `:56`: "The Setup pill. It is setup-status-and-alert #2."

   Ask: correct these with Blocking 1's ADR amendment.
   - The book note should say what the merged code actually does.
   - The ADR takes an amendment rather than an edit of its history.
   - The story's and plan's statements get a dated note: the PO's and Tester's words, respectively.

### Non-blocking

1. **`ui/src/styles.css:8905-8916`: below 345 px, the pill pushes the avatar menu off-screen on every
   `TopBar` page.**
   - With the pill showing, `/tags`, `/`, `/user/‹pubkey›` and `/setup` scroll sideways:
     - by 24 px at 320;
     - by 14 px at 330;
     - by 4 px at 340;
     - 0 px from 345.
   - Without the pill they are 0 at 320. The bar is 344 px wide there, and the avatar button sits wholly
     past the right edge.
   - `/about`, `/settings`, `/developers` and `/tapestry/` stay clean at 320.
   - The approved AC-6 and ADR 0002's measurement both stop at 375 px, so this does not block.
   - The fix is ADR 0002 sub-decision 6's own second shedding step:
     `.bsp-top-bar:has(.bs-topbar-pill) .bsp-top-nav { display: none; }` inside the `≤ 480px` block.
     With it, the overflow is 0 at 320 (probed).
   - Staging's Setup Alert ADR measures its header from 320 px. Fold this in when unifying the shedding
     rules (Blocking 1), and add 320 px to B6.
2. **`tests/brainstorm/assistant-alert.spec.js:296-297`: B6 checks only horizontal overflow.**
   - The defect the Implementer found by screenshot was the Tapestry header wrapping to 71 px and covering
     23 px of the page. No test pins it: with the brand-word rule removed, every suite still passes (probe:
     71 px, overflow 0).
   - Optional: at 375 and 320 px, assert that `.app-header`'s height with the pill equals its height
     without it (55 px). Staging's `setup-alert.spec.js` B12 already checks that the control-panel header
     is as tall with its pill as without it; mirror it.
3. **`ui/src/components/TopBarAlert.jsx:21-26`: label in name.** At ≤ 480 px the visible text is "⚠
   Manage Assistant →", but the accessible name is "Manage your Tapestry Assistant". The count is never in
   the name.
   - Both are what the owner approved (AC-6; § Copy), and staging's Setup Alert does the same.
   - A voice-control user saying the visible words may not hit the link (WCAG 2.5.3).
   - This is a product question for when the counts become real, not a code fault.
4. **Pre-existing, not this diff: the Tapestry header is 55 px while the page starts at 48 px.** A
   signed-in viewer at ≤ 768 px loses 7 px under the fixed header, with or without any pill. Recorded
   because the brief asked. Out of scope here.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **Two books designed the same top-bar spot in parallel, and nothing re-checked the shared line before
   Review.**
   - This book's ADR 0002 (17:17) verified "setup-status-and-alert #2 is Approved and has no ADR" against
     `origin/staging` at `383f99e5`. That was true there.
   - But that story's ADR had been committed on its own branch at 15:59. It was implemented at 17:27,
     reviewed at 18:21 and merged at 18:26, three minutes after this branch's implementation commit.
   - The epic named the collision risk ("Whichever story lands second fits in beside the other"), but no
     phase acted on it.
   - This review's brief still gave `383f99e5` as the base.
   - Suggested fix:
     - at Phase 4 start, and again at Review: `git fetch` and
       `git merge-tree --write-tree HEAD origin/staging`. A conflict in the story's own files sends the
       story back to Architecture before code is written or reviewed;
     - where an epic's "Open work this epic touches" names another in-flight story, the Architect also
       reads that story's branch, not only the shared line.
   - The session memory "re-fetch staging before 'doesn't exist yet'" states the same lesson for single
     claims. This is its phase-level form.

## Verdict
**CHANGES_REQUESTED**

---

## Round 2 — 2026-09-22 (after the fix round)

**Diff:** `git diff 1228b96d..86bbc320`.
- **The merge.** `fc7021f2` merges `origin/staging` at `6754a16a`, which brings in the Setup Alert (PR #737).
- **The fix round.**
  - `15fe11fb`: ADR 0002 Amendment 1;
  - `2b88be30`: the tests;
  - `a6420c79`: the CSS, comments and records;
  - `fc411a0d`: the ledger row for round 1's harness friction.
- **After the round-2 request.** `396d98cf` records, in the docs, the owner keeping the 679 px breakpoint. `86bbc320`
  adds a cleanup ledger row, `2026-09-22-staging-browser-class-83-red`.
- **Tree.** Clean at `86bbc320`. `origin/staging` is now `4e568edf`, and
  `git merge-tree --write-tree HEAD origin/staging` merges it with no conflict. Its only overlap is
  `stories/_intake.md`, which auto-merges. Since `6754a16a`, staging's `src/utils/siteTrust.js` change is to a
  comment only.

Per the Reviewer's rule for a later round, each fix below is checked as a fresh claim, including the ones
built on my own round-1 wording.

### Quality gates (re-run by reviewer)

- [x] **The book's scoped gate, on the tip.** It is the plan's unchanged script. After the merge it finds 107
  suites; `setup-alert` joins. `npm run gate:status -- --label assistant-management-review2-tip`:

  ```
  20260922T021635Z-59393-0242 [assistant-management-review2-tip] started 2026-09-22T02:16:35.267Z on 86bbc320 — FAIL, exit 1, 1921 passed, 25 failed, 58 skipped, 107/107 suites; failed: capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, show-the-four-on-the-goal-screens-that-already-exist, concept-count-canonical, summaries-element-count · tmp/gate-runs/20260922T021635Z-59393-0242.json
  ```

  - **The record matches the others suite by suite.** I compared it with my round-1 record
    `20260921T225510Z-18790-44e9` and with the fix round's `20260922T004431Z-86667-0b97`.
    - There are 0 differences in pass/fail/skip/verdict across the 106 common suites.
    - The failing tests are the same, test by test: the 11 live-graph suites (review 1).
    - The one new suite is `setup-alert`, at 6/0/0.
  - **This story's suites:** `assistant-alert` 14/0/0, `setup-status` 39/0/1.
  - **An earlier run is not the record.** `20260922T020935Z-27290-6cac`, labelled `assistant-management-review2`,
    has the same totals. But `396d98cf` and `86bbc320` were committed into this checkout while it ran (Harness
    friction 1), so I re-ran on the tip.
  - **One more walker, run alone.** `session-start` reads the real `ledger/`, and this diff adds an OPEN meta row
    there, but it is not in the pinned list (Non-blocking 5). Through `run()`: 32 passed, 0 failed.
- [x] **Browser class.** Chromium against `:7778`, serving `index-DO6DL-ap.js` / `index-DR3LjFUi.css`. That build
  carries the tip's rules: one `.header-auth` rule, the 1023, 679, 480 and 359 px breakpoints, and
  `:has(.bs-setup-alert,.bs-topbar-pill)`. There is no UI change after `a6420c79`.
  - **One run of 15 specs: 213 passed, 1 failed.**
  - **This story and the other book:**
    - `assistant-alert` 10/10, including B9's 19-width sweep;
    - `setup-alert` 50/50, including the re-aimed host row, B9 and both B11s;
    - `setup-status` 15/15.
  - **Story 1 and the re-aimed suites, all green:**
    - `assistant-management-page` 23/23;
    - `my-assistant-page` 18, `assistant-setup-prompt` 10, `one-writer` 15, `assistant-default-profile` 8,
      `assistant-publish-result` 4, `ta-composite-avatar` 5.
  - **The five other specs where this pill can appear.** They talk to the live stack, but stub a viewer with an
    assistant and leave `/api/setup/status` unmocked, so the pill shows (their writes are all mocked):
    - `goal-intent-screens` 8/8, `tapestry-add-concept` 13/13, `tapestry-create` 8/8 and
      `tapestry-remove-concept` 14/14;
    - `author-scoped-inspection` 12/13. The failure is E3, at `tests/brainstorm/author-scoped-inspection.spec.js:157`.
      It reads `thead th` with `allTextContents()` straight after `goto`, without waiting, and got `""` under 4
      workers. Alone it passed 13/13 three times out of three. That is a race in the test, and it does not assert
      on the top bar (Non-blocking 6).
- [x] **The 83 tests red on the shared line** (ledger `2026-09-22-staging-browser-class-83-red`) **cannot come
  from this pill.**
  - The pill renders only for a signed-in viewer whose `user.assistantPubkey` is set, and `AuthContext.jsx:66-71`
    takes that only from `/api/auth/user-classification`.
  - None of the 19 red spec files stubs a classification with an `assistantPubkey`.
  - The rest run signed out, `auth.spec.js` included: all five of its tests are unauthenticated.
  - None of them opens `/assistant`.
  - This supports the fix round's build-against-build comparison by a separate route. I did not repeat that
    comparison: 41 of the 51 specs have no `/api` catch-all, and some of them write to the local stack.
- [x] **My own probes** (session scratchpad, every `/api` mocked, a 29-character user name):
  - **A 1 px sweep from 320 to 1280 px.** Ten pages: `/`, `/tags`, `/about`, `/settings`, `/developers`, `/tapestry/`,
    `/user/‹pubkey›`, `/setup/follow`, `/?q=alice` and `/assistant`. Three states each: the Assistant pill,
    the Setup pill, and no pill.
    - **No sideways scroll** at any width, in any state.
    - **The fixed Tapestry header is 55 px** at every width, in all three states.
    - **Bar heights are the same with or without a pill**, except the developer bar's +8 px (39→47, 47→55).
      The amendment records it, and that bar is not fixed.
    - **The pill is missing only where it should be:**
      - the Assistant pill on `/assistant`;
      - the Setup pill on `/setup/*`;
      - both on the results view at ≤ 600 px, as ADR 0002 § Consequences records.
  - **The amendment's numbers, each reproduced:**
    - at 640 px the pills are 379 px and 333 px wide;
    - with the sentence forced back, `/tags` scrolls 12 px at 640 and first fits at 652;
    - with the nav forced back, the overflow is 31 px at 320, 1 at 350 and 0 from 351;
    - the two pills have the same box: 29.7 px tall, and the same padding, radius and font, at 1280, 800 and
      375 px (story 2 § Copy, "shape and size match").
  - **Never both.** I took three setup states (a step left, none left, check failed) across eight pages:
    `/about`, `/`, `/tapestry/`, `/developers`, `/setup`, `/setup/follow`, `/assistant`, `/assistant/profile/edit`.
    - No combination showed both pills.
    - **A step left:** the Setup pill everywhere but `/setup*`.
    - **None left, or a failed check:** the Assistant pill everywhere but `/assistant*`.
    - **On `/setup` with a step left:** neither, as Amendment 1 point 3 says.
- [x] **eslint parity.** No new rule hits against `6754a16a`'s versions of the four mounts, `TopBarAlert.jsx`,
  `topBarAlert.js`, `SetupAlert.jsx` and `SetupStatusContext.jsx`.
- [x] **Added lines:** no secrets, debug output or commented-out code.
- [x] **`bash scripts/harness-lint.sh`:** exit 0, clean, at the tip, and again on this commit.

### Round 1's findings, re-checked

- **Blocking 1: resolved.**
  - **The merge.** Diffing the merge commit against a plain `git merge-tree` of its two parents shows it changed
    only the six conflicted files.
  - **The resolutions:**
    - each of the four hosts renders `<SetupAlert />` then `<TopBarAlert />`;
    - the registry keeps all three new suites;
    - the ledger row keeps both sides.
  - **The owner's choice: side by side,** which is Option B, the one ADR 0002 once rejected. Amendment 1 records it,
    and gives the reason.
  - **Why the two pills cannot show together.** Amendment 1 point 3 says it holds by the one shared answer, and
    the code bears it out:
    - `SetupAlert.jsx:24` shows only when someone is signed in and `pendingCount >= 1`;
    - `pendingCount` is non-zero only when the phase is `answered` (`SetupStatusContext.jsx:82`,
      `setupStatus.js:20-36`);
    - in exactly that case `pickTopBarPill` returns `'setup'`;
    - both components read the same context in the same render.
  - **AC-3's "at no moment … both"** is no longer vacuous. B3 now runs with the real Setup pill in the build: a
    step left shows it and not this one, and late answers are checked both ways. My matrix agrees.
- **Blocking 2: resolved,** apart from three lines in ADR 0002 left without a pointer (Non-blocking 2).
  - **The setup-status-and-alert book note** is rewritten and marked as corrected. It cites `SetupAlert.jsx:24`
    correctly, and it names the dependency.
  - **The ADR** keeps its history, with inline pointers at the other superseded lines and Amendment 1 appended.
  - **Story 2** has dated notes at `:14`, `:47-48` and `:115-116`.
  - **Test plan 2** has dated notes at `:53-55` and `:65-66`.
- **Non-blocking 1 (under 345 px): fixed.** The `max-width: 359px` rule hides `TopBar`'s nav, and my sweep finds no
  scroll at any width. The cost below 360 px is the About link, and neither menu links to `/about`. That was
  already the second step of ADR 0002 sub-decision 6's shedding order, and Amendment 1 records it.
- **Non-blocking 2 (B6 checked only scroll): fixed.** B9 compares the fixed header with and without the pill at
  19 widths.
- **Non-blocking 3 (label in name):** unchanged. It is a product question, as before.
- **Non-blocking 4 (the header's 55 px against the 48 px offset):** pre-existing and unchanged.
- **Harness friction 1:** filed as ledger `2026-09-22-parallel-books-no-shared-line-recheck`. The row is
  accurate, and its new clause is sound: after a merge, run every brought-in suite that touches the same
  surface, whole.

### Story 1 on the merged tree

Review 1's verdict holds. Its files are unchanged since that review, and the merge only added staging's Setup
Alert code around them.
- **Node suites (tip gate):**
  - `assistant-management-page` 24/0/0, with H1 executed;
  - O4's sweep is clean on the merged tree;
  - the re-aimed suites are as in round 1.
- **Browser:** `assistant-management-page` 23/23.
- **My wider sweep:** clean, apart from the history comment at `avatarMenuLinks.js:40`, which is kept on purpose.
- **Review 1's Non-blocking items:**
  - 1 is fixed: `styles.css:8725`;
  - 2 is fixed: story 1 `:118-121`;
  - 3 is fixed: `setup-alert.spec.js` `:173` and B9 (`:367-370`), and `SetupStatusContext.jsx:14`;
  - 4 (AC-7 on staging) still waits for the deploy.
- **One trivial leftover:** Non-blocking 4 below.
- **Review 1 gains a short addendum** pointing here.

### Spec and ADR adherence (round 2)

- [x] **Story 2's ACs, with both pills in the build:**
  - AC-1: the pill sits where the Setup Alert sits, before the menu;
  - AC-2 and AC-4: B2 and B4;
  - AC-3: B3, and my matrix;
  - AC-5: B5;
  - AC-6: B6, B9 and my sweep;
  - AC-7: B7.

  The copy is unchanged. § Copy's "shape and size match the Setup Alert's" now holds exactly.
- [x] **Amendment 1's Implementation notes match the diff:**
  - the pill block's shape, breakpoints, nav rule and brand selectors;
  - the duplicate `.header-auth` removed, keeping `styles.css:672`;
  - the comments in `TopBarAlert.jsx`;
  - the records;
  - the mounts, as resolved in `fc7021f2`.
- [x] **The other book's surface.** Nothing else of it changed beyond what is recorded:
  - the four re-aims in `setup-alert.spec.js`, each marked;
  - the brand selectors widened to either pill;
  - a comment in `SetupStatusContext.jsx`.

  `SetupAlert.jsx` itself is untouched.
- [x] **Owner decisions** are recorded in Amendment 1 (`:338`, `:399`) and story 2 (`:167`, `:177`): side by side,
  and keeping 679 px. I took them as recorded, since the repo cannot show the conversation.
- [x] **No new dependency or tooling, no concept change, and no firmware reinstall.**

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

1. **"Never both" has no CI backstop.** It now rests on `ui/src/components/SetupAlert.jsx:24`: the Setup Alert
   returns `null` unless `pendingCount >= 1`. Only browser B3 pins that, and no workflow runs Playwright.
   - If a later edit to the other book's component showed its pill while the check runs, or after a failure, the
     two pills would show together, with the Node gate still green.
   - Amendment 1 point 3 and the setup-status-and-alert book note both accept this dependency.
   - Optional: a W5 in `test/assistant-alert.test.js` that reads `SetupAlert.jsx` and asserts its early return
     on `loading || !user || pendingCount < 1`, the condition `pickTopBarPill`'s `'setup'` branch mirrors.
2. **Three superseded lines in
   `engineering-team/decisions/assistant-management/0002-one-top-bar-alert-slot-setup-first.md` have no pointer:**
   - `:99-100`: Option A's con, "Until the Setup Alert exists, the `'setup'` branch renders nothing" (round 1
     listed it as `:96`);
   - `:177`: sub-decision 2's snippet comment, "renders here once it is built";
   - `:276-277`: § Consequences, "Shared names. The pill's base class and the slot are shared with the other
     book". This is now false: the other book uses `.bs-setup-alert` and its own component.

   Amendment 1's list at `:347-348` omits all three. Optional: an italic pointer at each, as done elsewhere.
3. **Two dated notes are missing.**
   - `engineering-team/stories/assistant-management/2-the-assistant-alert.test-plan.md:71-75`: the watch item still
     says the pill "removes no control". `:167-168` records the miss, but the line itself carries no note.
   - `engineering-team/stories/assistant-management/2-the-assistant-alert.md:144-146`: the Deviation still quotes
     `<><TopBarAlert />{menu}</>`. The mounts now render `<SetupAlert />` first.
4. **`tests/brainstorm/setup-alert.spec.js:24`**: the header index still reads "B9 — creating an assistant on
   /assistant". B9's own title, at `:367`, was re-aimed. This one is story 1's, from the editor's move.
5. **The pinned gate list omits `session-start`.**
   - `engineering-team/stories/assistant-management/1-the-assistant-management-page.test-plan.md:169-170` says it
     "read[s] one fixed folder". True, but that folder is `ledger/`, which this diff touches.
   - Staging's `c47becd6` clause asks for walkers to be triaged against the whole diff.
   - It passes alone (32/0), so this is recording only. Optional: add it to the list.
6. **`tests/brainstorm/author-scoped-inspection.spec.js:157`**, not this branch: E3 reads the table's headers without
   waiting for them, and failed once under 4 workers. It could join the cleanup row
   `2026-09-22-staging-browser-class-83-red` as a flake.

#### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **Commits landed in the reviewed checkout while the Reviewer's gate was running there, and the gate record
   cannot show it.**
   - What happened:
     - `396d98cf` and `86bbc320` were committed at 02:14:55Z;
     - run `20260922T020935Z-27290-6cac`, which records "on fc411a0d", had started at 02:09:35Z;
     - so suites after about #90 read the tip's tree.
   - Why the record misses it: it captures git identity once, at creation (`gitIdentity()`,
     `test/helpers/gateRecord.js:56`, `:129`).
   - The damage here: a re-run (about 4 minutes), and nothing else, since the changes were docs only.
   - Suggested fix:
     - before committing into a checkout, check `npm run gate:status -- --list` for a RUNNING record;
     - and let the engine re-read HEAD and the porcelain at finish, and mark a record whose tree moved.
   - No existing row covers this: I searched `ledger/` and `OPEN.md` on the branch and on `origin/staging`.

### Round 2 verdict

The fix round resolves both blocking findings. Every claim in it that I re-derived holds. What remains is
recording and hardening, none of it a defect in this diff.

**PASS**

---

## Post-verdict check — 2026-09-22 (round 2's non-blocking items, done before the staging deploy)

**Commits:** `bf4adce9`, `6f4ba1ad`, `572bdde3`, `f30dd464`, `3e2d5e47`, on top of `499e4a66`. The tip is
`3e2d5e47`, and the tree is clean. The owner asked for all six items before the deploy.

**The gate.** The fix session ran it, and I read the record rather than start a second run in the same checkout:

```
20260922T030128Z-8883-ed8a [assistant-management-rnd2-fixes] started 2026-09-22T03:01:28.701Z on 3e2d5e47 — FAIL, exit 1, 1954 passed, 25 failed, 58 skipped, 108/108 suites; failed: capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, show-the-four-on-the-goal-screens-that-already-exist, concept-count-canonical, summaries-element-count · tmp/gate-runs/20260922T030128Z-8883-ed8a.json
```

- **Attributable.** The last commit was at 03:01:16Z, the run started at 03:01:28Z, and HEAD was still `3e2d5e47`
  when it finished.
- **Against my `20260922T021635Z-59393-0242`**, suite by suite, exactly two things differ:
  - `assistant-alert`, 14 → 15/0/0 (W5);
  - `session-start`, new, 32/0/0.
- **The rest is unchanged.** The failing tests are the same, and 1921 + 1 + 32 = 1954.
- **Lint.** `bash scripts/harness-lint.sh` exits 0, clean, at the tip.

**The six items, each checked against the tip:**

1. **Non-blocking 1 (a CI backstop for "never both"): done.**
   - **W5**, in `test/assistant-alert.test.js`, parses `SetupAlert()`. It requires an early `return null` whose
     disjuncts include `loading`, `!user` and a none-counted test, before an unconditional pill return. It also
     pins `summarizeSetup(phase === 'answered' ? ctx.answer : null)`, and zero counts for no answer, a failure
     and an expired session.
   - **Run through `run()`:** 15/0/0.
   - **Mutation probe.** Nine planted defects, one at a time, in a scratch copy of the files: nothing in the repo
     was edited while that gate ran.
     - The fix session's five (guard `< 0`, no `!user`, no count, summarize in any phase, `notAnswered` pending)
       each fail W5 with a message naming the link. So does my sixth, a guard with no `loading`.
     - Two blind spots remain, both still covered by browser B3:
       - (a) a *conditional* pill return placed before the guard (`if (…) return <Link…/>`) passes W5, which only
         notices an unconditional early return;
       - (b) this story's own wiring, `TopBarAlert.jsx`'s `setupPendingCount: setup.pendingCount`, can be broken
         (`0`) with the whole suite still green.
     - **What closing them is worth:** two small assertions. For (a), treat any non-null return before the guard,
       at any depth, as drawn first. For (b), add a W1 regex for the three arguments. This is optional hardening,
       and not a condition for staging.
     - The ninth, `summarizeSetup` ignoring `signedIn`, passes too. It is harmless: the server's no-session answer
       carries no `steps` (`src/api/setup/status.js:21`, `:259`), and the provider marks it `failed` anyway.
2. **Non-blocking 2: done.** ADR 0002 has pointers at `:100-101`, after the snippet (`:182-183`), and at
   "Shared names" (`:281-283`, now marked false). The amendment's list of superseded lines names all seven.
3. **Non-blocking 3: done.**
   - The watch item in test plan 2 carries a dated note, `:77-79`.
   - Story 2's Deviation shows the merged fragment, `:145-146`.
4. **Non-blocking 4: done.** `tests/brainstorm/setup-alert.spec.js:24-25` names `/assistant/profile/edit`.
5. **Non-blocking 5: done.**
   - `session-start` is in the plan's walker list, and the gate now runs 108 suites.
   - `reconciliation-rearchitecture` stays out, correctly: it reads `src/pipeline/reconciliation/`, which this
     branch does not touch.
6. **Non-blocking 6: done.** `ledger/2026-09-22-staging-browser-class-83-red.md` records the E3 race and a fix.

**Harness friction 1: filed, and accurate.** `ledger/2026-09-22-commit-during-gate-run-unflagged.md` has
the header fields, and its three citations are right:
- `gitIdentity()` at `test/helpers/gateRecord.js:49-59`;
- the record is created at `:129`;
- `finishRecord` at `:147` writes without re-reading git.

The fix session also followed the row's own habit this time: it asked me not to commit while its run was
RUNNING.

The verdict stands: **PASS**
