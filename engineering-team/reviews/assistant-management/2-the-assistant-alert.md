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
