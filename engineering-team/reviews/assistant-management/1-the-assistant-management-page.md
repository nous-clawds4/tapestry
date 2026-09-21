# Review: Story 1 — The Assistant Management page, its FAQ and ten placeholder action pages

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Diff:** `git diff 383f99e5...43cfd1a3` (the branch base is `origin/staging` at `383f99e5`). Story 1's own
commits: story `f172f945`, ADR `69e45760`, failing tests `1abe625b`, two Phase-4 test fixes `0025fa2b` and
`0485da0f`, implementation `92c2ef70`. Branch `feat/assistant-management`, working tree clean.
**Story:** `engineering-team/stories/assistant-management/1-the-assistant-management-page.md`
**ADR:** `engineering-team/decisions/assistant-management/0001-the-hub-takes-assistant-and-the-editor-moves-under-it.md`
**Test plan:** `engineering-team/stories/assistant-management/1-the-assistant-management-page.test-plan.md`

Every role before this one ran in a single session. So I re-derived each claim in the Deviations, the test
plan and the commit messages from commands. I did not take them from the prose.

## Quality gates (run by reviewer, not trusted)

- [x] **The book's scoped gate** (test plan § How to run: 106 suites; the full `npm test` is not this
  book's gate). I ran the plan's script unchanged, under Node 22.23.2, with `GATE_LABEL=assistant-management-review`,
  on the committed tree (no `+dirty`). It printed its suite count (106). `npm run gate:status -- --label assistant-management-review`:

  ```
  20260921T225510Z-18790-44e9 [assistant-management-review] started 2026-09-21T22:55:10.205Z on 43cfd1a3 — FAIL, exit 1, 1915 passed, 25 failed, 58 skipped, 106/106 suites; failed: capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, show-the-four-on-the-goal-screens-that-already-exist, concept-count-canonical, summaries-element-count · tmp/gate-runs/20260921T225510Z-18790-44e9.json
  ```

  - **The FAIL is the host's live-stack baseline, not this story.** I compared three records suite by
    suite: the Implementer's baseline `20260921T220326Z-24274-84a4` (at `786e4251`, tests only), their
    after-run `20260921T222341Z-90700-2c1d` and mine.
    - The 11 failing suites fail identically in all three, with the same pass/fail/skip counts.
    - Every one of their 25 failures is live-graph state: legacy goals missing from `/api/brain/goals`,
      a red `/api/brain/hygiene`, fixtures that "already exist", and concept counts on `firmware-concept`
      and `nostr-relay`. None of them reads a file this book touches.
    - The 58 skips are the same suites with the same counts in all three records.
  - **This story's suites in my run:**
    - `assistant-management-page`: 24/0/0. H1 (live, all twelve addresses answer 200 with the app shell)
      executed: "H-class 1 executed / 0 skipped".
    - The re-aimed suites all pass: `my-assistant-page` 31/0/0, `one-writer-assistant-profile` 17/0/0,
      `one-default-assistant-profile` 52/0/0 and `assistant-setup-state` 28/0/0 (a guard).
    - In the baseline, the first three fail with 9, 7 and 1 failures, as the test plan's Verification
      table says.
  - `setup-status` is 39/0/1 here. In the baseline it was 38/1/1: its live H1 got a 404 from a backend that
    did not have `/api/setup/status` at the time. That was the stack, not code.
- [x] **Browser class.** Playwright 1.56, `--project=chromium`, against `http://localhost:7778`, serving
  `index-DejE49Cv.js`. The bundle is from HEAD: it contains `header-brand-word`, `:has(.bs-topbar-pill)`,
  "Manage the Profile and Capabilities of" and `bs-assistant-hub-setup-link`.
  - I ran `assistant-management-page`, `assistant-alert`, `my-assistant-page`, `assistant-setup-prompt`,
    `one-writer`, `assistant-default-profile`, `assistant-publish-result`, `ta-composite-avatar` and
    `setup-status` in one run: **107 passed, 0 failed, 0 skipped** (exit 0).
  - This story's spec gave 23/23 (B0–B13 with B8 ×10). The re-aimed specs gave 18, 10, 15, 8, 4 and 5 of
    the same, with none failing.
- [x] **My own probes** (scripts in the session scratchpad, every `/api` route mocked):
  - **The B5 mutation probe.** A click by position on the Bounties description:
    - as built → `/assistant/bounties`;
    - with the overlay removed (`::after { content: none }`) → stays on `/assistant`;
    - with `opacity: 0.7` restored on the text → stays on `/assistant`.

    So the Tester's claim holds, and B5 has teeth. Without 0485da0f's `scrollIntoViewIfNeeded` the click
    lands at y=1238 in an 800 px viewport and does nothing. That was the Phase-4 miss. Clicks on the
    badge, the marker and the chevron all open the card too.
  - **Accessibility.**
    - The FAQ `<summary>` is exposed as `DisclosureTriangle`, with `expanded: false` when closed.
    - Card link names read "Needs attention: ‹title›".
    - A Tab-focused card link draws its ring on `::after` (`solid 2px rgb(165, 180, 252)`).
    - The summary shows a focus outline.
    - NIP links carry `target="_blank" rel="noopener noreferrer"`. W5 and B6 check this too.
  - **Colour.** The Deviation's colour claim is exact. `/setup`'s step text is `rgb(226, 232, 240)` at
    `opacity: 0.7`. The hub's card text is `rgba(226, 232, 240, 0.7)` at opacity 1.
  - **Look.** Screenshots of `/setup`, `/assistant`, `/assistant/preferences` and `/assistant/profile/edit`
    at 1100 px, and of the hub at 375 px with the FAQ open. The hub reads as the `/setup` page: same column,
    kicker, accented title and card treatment, plus the sections and the FAQ.
- [x] **eslint parity** on the touched UI files (the ui package's own config, run on the host, with no
  build).
  - The new files lint clean: `actions.js`, `Index.jsx`, `ActionText.jsx`, `ActionPage.jsx`,
    `EditProfile.jsx`. So do `App.jsx` and `avatarMenuLinks.js`.
  - `BrainstormSettings.jsx` has the same rule hits at HEAD as at `383f99e5` (JSON output compared).
- [x] **Concept graph.** `/api/assistant/pubkey` → `8387ec0e…`. `/api/concept-graph/summaries` has
  `39998:8387ec0e…:{nostr-user,tag,nostr-user-tag,tag-pinning,list}` in kind:pubkey:slug form. No concept
  models an assistant, as the ADR says.
- [x] **`bash scripts/harness-lint.sh`:** exit 0, "harness-lint: clean (0 violations)", before this review,
  and again on the review commit.
- [ ] _Lint not configured — skipped (eslint parity above)._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped (the served bundle was built in the container from HEAD)._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.**

  | AC | Node (CI) | Browser |
  |---|---|---|
  | AC-1 page, three sections, ten cards | D1, D2, W1, W4 | B1 |
  | AC-2 needs attention, for whom | D6, D7 (six viewers, incl. an Owner with a missing key), W3, W4 | B1–B4 |
  | AC-3 cards are links, NIP links | D3, D8, W5 | B5, B6 |
  | AC-4 the FAQ | D5, W4 | B7 |
  | AC-5 ten placeholders | D4, W1, W3 | B8 ×10 |
  | AC-6 the editor moves | M1, M2, W1, W2, W6, O1–O4; re-aimed my-assistant-page, one-writer, one-default, assistant-setup-state | B9, B10; re-aimed specs |
  | AC-7 direct loads, 375 px, read-only | H1 (executed), W3 | B11, B12, B13 |

- [x] **No criterion is silently dropped.** One part of AC-7 can only be checked after deploy: "this holds
  on staging as well as locally". The test plan § Not covered says so (Non-blocking 4).
- [x] **No behaviour beyond the story.**
- [x] **Copy.** I parsed story 1 § Copy mechanically: the ten-action table, the placeholder table, the
  FAQ, the page, editor and settings rows, and the three NIP URLs. Every string equals both the shared
  fixture (`test/helpers/assistantManagementFixtures.js`) and `ui/src/pages/assistant/actions.js`. There
  were 0 mismatches, so the suites assert the approved words. One record-accuracy note on the § Copy
  preamble is Non-blocking 2.
- [x] **AC-6's amended list.** Its amendment note says the two items from assistant-profile #5 were added
  at Architecture. The ADR commit `69e45760` is the one that adds them, which matches. The owner's approval
  rests on that note, since the gate is conversational.

## ADR adherence

- [x] **Files match the implementation notes.**
  - New: `actions.js` (exactly one import, with `.js`; D9), `Index.jsx`, `ActionText.jsx`, `ActionPage.jsx`
    and `src/utils/assistantPages.js` (no requires; O1).
  - The editor moved to `EditProfile.jsx`. `git log --follow` traces it back to `40fe1fc9`.
  - The diff against the old `Index.jsx` changes only the doc comment, the component name, the back link
    and the heading. Its four states and its `AssistantProfileEditor` mount are byte-identical.
  - `App.jsx` follows sub-decision 2 exactly: the hub, then the editor, then `...ASSISTANT_ACTIONS.map`.
    The `settings/assistant` redirect goes to `MY_ASSISTANT_PATH`.
  - `avatarMenuLinks.js` is still import-free (M3). `accountLinks` leads to the hub.
- [x] **Outside the app** (sub-decision 6).
  - The three refusals are built from `EDIT_ASSISTANT_PROFILE_PAGE`, and they read word for word as the
    ADR quotes them. Their statuses and codes are unchanged.
  - The two legacy panels and BIBLE §14 (line 1072, under § Assistant Keys) name
    `/assistant/profile/edit`, and so does the `Last updated` header.
  - My own sweep was wider than O4: every tracked text file outside `engineering-team/`, `ledger/` and the
    tests, including docs, `protocols/`, `bin/`, `scripts/`, `setup/`, `ui/index.html` and `ui/public`.
    Nothing still sends a person to the editor at `/assistant` or as "the My Assistant page". The one
    stale label left is a CSS comment (Non-blocking 1).
- [x] **Every Deviation checks out.**
  - (1) The editor's heading and back link come from `ASSISTANT_COPY`. Sub-decision 1 puts every other
    string of § Copy there, so this is consistent.
  - (2) Colour, not opacity. The probe above confirms both the defect and that the shade is identical.
  - (3) Comment-only edits in four files. Sub-decision 6 allows comment re-wording. "Unchanged, on purpose"
    is about code, which is unchanged.
  - (4) The `bs-assistant-hub-setup-link` class is harmless.
  - (5) The two Tester commits are judged below.
- [x] **The two Phase-4 Tester commits.**
  - `0025fa2b` re-aims `one-writer.spec.js` B2/B3 from `/My Assistant/` to `/Edit Assistant Profile/`.
    That follows the approved copy, and it is exactly as strong as before (the same partial-text check,
    then a click and a pathname check). The ledger paragraph it adds to
    `2026-09-21-adr-reaim-list-misses-outcome-asserts` is accurate.
  - `0485da0f` adds only `scrollIntoViewIfNeeded` before the positional click. The probe above shows the
    assertion keeps its power.
  - Both are legitimate. Neither weakens a test.
- [x] **No new dependency.** No tooling was added. The Node suites use the root `typescript` parser as a
  library, as earlier suites do.

## Concept-graph integrity
- [x] **Handles are in `kind:pubkey:slug` form.** Checked live (above).
- [x] **Firmware reinstall:** not needed. No concept definitions changed, and the diff touches no
  firmware files.
- [x] **Orientation.** The ADR's orientation claims match `/summaries`, and nothing new reads BIBLE for
  domain facts.

## Things tests can't catch
- [x] **No secrets.** No 64-hex literal in product code, and no nsec. Fixtures use `'aa'.repeat(32)` and
  similar.
- [x] **No `console.*`, `debugger` or TODO** in the added product lines.
- [x] **No commented-out code.**
- [x] **POV.** Marks and the count come only from `assistantAttention(user)` (`user.assistantPubkey`). No
  instance-TA read, no `useConfig`, no TA literal. W3 checks this.
- [x] **Read-only.**
  - The hub and the placeholders ask nothing of their own. Their `/api` reads are the top bar's (B13, and
    my probe's list).
  - Nothing sends a non-GET.
  - The editor is unchanged.
- [x] **Security.** No new input path. The server change is the wording of three messages, still sent
  before any key is read.

## House rules check
- [x] **Concept Graph API authority** is respected.
- [x] **No new lint, typecheck or build tooling.**

## Findings

### Blocking

None in this story's diff against its base.

### Non-blocking

1. **`ui/src/styles.css:8655`**: the editor's style block is still headed "My Assistant — /assistant
   (assistant-profile #4)". It now styles the Edit Assistant Profile page at `/assistant/profile/edit`.
   `/assistant` is styled by the new block below it. Sub-decision 6 asked for misleading comments to be
   re-worded, but its grep (`"My Assistant page"`) cannot find this one, and O4 does not read `.css`.
   - Optional: re-word it to "Edit Assistant Profile — /assistant/profile/edit (assistant-profile #4; moved
     by assistant-management #1)".
   - Optional: add `.css` to O4's comment-free sweep, or to its "My Assistant" check.
2. **`engineering-team/stories/assistant-management/1-the-assistant-management-page.md:110`**: the § Copy
   preamble says the owner's words are "kept as typed" apart from four display fixes. The approved table
   makes two more edits at `:162`:
   - "etc)" becomes "etc.)." in the profile's alert criteria;
   - the owner's "Note: this page will not be the same…", which was on the same alert-criteria line in the
     ask, is moved into Planning notes without "Note:".

   Both are reasonable and were approved as tabled. The preamble undercounts them. Record accuracy only.
3. **After merging the current shared line** (this is what the next round of story 2 must verify; see
   review 2, Blocking 1): `origin/staging` has moved on to `6754a16a`. The Setup Alert (PR #737) and the
   assistant-profile book close landed there. Two things there still treat `/assistant` as the editor. A
   story on the shared line landed after this book's re-aim list was written, so the list could not name
   it:
   - staging's **`tests/brainstorm/setup-alert.spec.js:364-367`** (B9) opens `/assistant` and clicks
     "Create my Tapestry Assistant key". After this story's move, `/assistant` is the hub, so B9 fails on
     the merged tree. CI runs no browser suite, so nothing automatic would catch it. `:172` labels
     `/assistant` "the My Assistant page".
   - staging's **`ui/src/context/SetupStatusContext.jsx:14`** says an assistant is created "on
     /assistant". O4 exempts comments.

   Ask, at the merge: re-aim B9 to `/assistant/profile/edit` (a Tester edit, in its own commit, like the
   six re-aims here), re-word the `:172` label and the comment, and re-run O4 and the browser class on the
   merged build. The merge also conflicts mechanically in `test/registry.js` and in the ledger row
   `2026-09-21-adr-reaim-list-misses-outcome-asserts.md` (both sides appended). This story's other
   records merge cleanly, per `git merge-tree`:
   - ADR 0004/0005's status lines follow the files into `decisions/done/assistant-profile/`;
   - the assistant-profile book note lands in the now-Closed book.
4. **AC-7 "on staging"** is open until deploy. Per the ADR's § Checks at implementation: after the staging
   deploy, `curl -s -o /dev/null -w '%{http_code}'` the twelve addresses and confirm each returns the
   app shell.

### Harness friction *(anything the process itself got wrong this story — each becomes an OPEN.md row, type `meta`)*

1. **This review was briefed against a base the shared line had already left.** Two books designed the
   same top-bar spot in parallel. The ADRs here verified "not built" against `origin/staging` only.
   - The Setup Alert's ADR was committed on its own branch at 15:59. This book's ADRs came at 17:17.
   - It merged to staging (PR #737, 18:26 EDT) three minutes after this branch's implementation commits.
   - For this story the effect is small (Non-blocking 3). For story 2 it is Blocking.
   - No phase re-checks the shared line before Review. A `git fetch` plus
     `git merge-tree --write-tree HEAD origin/staging` at Phase 4 start and again at Review would have
     shown it, and so would checking the other book's branch, which the epic's "Open work this epic
     touches" already named. Full write-up in review 2.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed and reported in the chat, not here. The book is not complete: its
  frame's Assistant Alert bullet waits on story 2.

## Verdict
**PASS**
