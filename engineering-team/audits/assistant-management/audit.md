# Build Audit: The Assistant Management page — `/assistant` as a scaffold, with its alert

**Book:** `engineering-team/audits/assistant-management/book.md`
**Date:** 2026-09-22
**Branch / commit range:** `383f99e5..17201352` on `feat/assistant-management`.
- **Commits.** 25 of the book's own (first-parent), plus the merge `fc7021f2`, which took `origin/staging` at
  `6754a16a` and brought in the Setup Alert (PR #737).
- **Merged** to staging as `577be4e9` (PR #742, 2026-09-22T03:11:19Z). **Not promoted to main:** the owner held
  production at this close.

**Provenance:** Acceptance-frame. There is no PRD. The owner's ask is quoted verbatim in `book.md`, and the frame was
confirmed when the owner approved both stories on 2026-09-21.
**Confidence:** high.
- Both stories trace to frame bullets.
- Both passed review; story 2 passed in round 2, after a fix round.
- Every bullet was observed on `staging.brainstorm.world` after the deploy.

The one thing the as-built record cannot show is whether the scaffold's shape is right for the real actions,
because none is built yet.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **The Assistant Management hub at `/assistant`**, styled like `/setup`. It has:
  - the kicker "Assistant Management" and the heading "Manage the Profile and Capabilities of your Tapestry Assistant";
  - a FAQ of the owner's five questions, closed until opened, above the cards;
  - ten action cards under the owner's three headings. The Trusted Assertions, Trusted Lists and Decentralized Lists
    cards link out to their NIPs.

  For a signed-in viewer who has an assistant, every card is marked "Needs attention", under a count line reading
  "10 actions need attention". Visitors and viewers without an assistant see the page with no marks. Visitors are
  asked to sign in. A viewer without an assistant is pointed to `/setup`.
  — `stories/done/assistant-management/1-the-assistant-management-page.md`
- **Ten placeholder action pages** under `/assistant/…`. Each has a back link, its title, "Placeholder page.", its
  description, its alert criteria ("Not yet defined." where the owner gave none), and the owner's planning notes
  where there are some. The profile page also links to the editor. — story 1
- **The profile editor moved** from `/assistant` to `/assistant/profile/edit`, now headed "Edit Assistant Profile",
  with a back link to the profile page. Every way in leads there:
  - "My Assistant's Profile" in both avatar menus;
  - the Dashboard prompt and the profile-page banner;
  - `/tapestry/settings/assistant` (a redirect) and the Brainstorm `/settings` card;
  - the legacy NIP-85 and customer pages;
  - the server's three refusal messages;
  - BIBLE §14.

  "Assistant Management" in the avatar menus opens the hub. — story 1
- **The Assistant Alert,** an indigo pill beside every avatar menu, and in the developer pages' bar where a menu would
  be. It reads "Manage your Tapestry Assistant · 10 actions need attention", with a "Manage Assistant →" button, and
  it links to `/assistant`.
  - **Setup comes first.** It waits for the setup check, and stays hidden while the Setup Alert counts a step. The
    Setup Alert is its own component, mounted just before it.
  - **Where it hides:** on `/assistant` and every page under it, for visitors, and for viewers without an
    assistant.
  - **It cannot be dismissed.**
  - **As the bar narrows,** it drops its count at ≤ 1023 px and its sentence at ≤ 679 px.

  — `stories/done/assistant-management/2-the-assistant-alert.md`

## 2. Epics & stories rolled up

### Epic: `assistant-management` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-assistant-management-page | The hub, its FAQ and ten placeholder pages; the editor's move and every link that follows it | Done | `reviews/done/assistant-management/1-the-assistant-management-page.md`: PASS, plus an addendum on the merged tree |
| #2 the-assistant-alert | The Assistant Alert beside every avatar menu, giving way to the Setup Alert | Done | `reviews/done/assistant-management/2-the-assistant-alert.md`: CHANGES_REQUESTED in round 1 (the Setup Alert shipped first); PASS in round 2; post-verdict check on the six follow-ups, PASS stands |

## 3. As-built inventory

Derived from `git diff 9a9230a4 577be4e9`: what PR #742 brought into staging, 62 files.

- **User-facing.**
  - **Routes:** `/assistant`; the ten action pages (`profile`, `identification-tags`, `trusted-assertions`,
    `trusted-lists`, `dlists`, `bounties`, `pins`, `tags`, `notifications-and-alerts`, `preferences`);
    `/assistant/profile/edit`; and `/tapestry/settings/assistant`, which now redirects to the editor
    (`ui/src/App.jsx`).
  - **New pages:** `ui/src/pages/assistant/` (`actions.js`, `Index.jsx`, `ActionPage.jsx`, `ActionText.jsx`,
    `EditProfile.jsx`).
  - **The pill:** `ui/src/components/TopBarAlert.jsx` (the slot) and `ui/src/utils/topBarAlert.js` (the pure
    picker). It is mounted in `BrainstormUserMenu`, the landing page's `UserMenu`, `Header` and `DevPage`.
  - **Styles:** `ui/src/styles.css` holds the hub block and the pill block, with its breakpoints and the
    `:has()`-scoped shedding.
  - **Server:** no new routes. Three refusal messages name the editor's new address: two in
    `src/api/assistant/index.js` and one in `src/api/strfry/commands/publishEvent.js`. They build it from
    `src/utils/assistantPages.js`, which is new.
  - **Static pages:** `public/pages/nip85.html` and `public/pages/customers/customer.html` link to the editor's
    new address.
- **Domain.** No concepts changed, and no firmware reinstall. The stories used `39998:<TA>:nostr-user` (whose
  assistant) and the setup handles to orient.
- **Data & contracts.**
  - Nothing is published, signed or stored.
  - The hub asks the server nothing of its own.
  - The pill reads sign-in and the shared setup status (`GET /api/setup/status`, once per full page load for a
    signed-in viewer). The Setup Alert reads the same one answer.
  - No event kinds, no API routes, no stored shapes.
- **Tests.**
  - **Node:** `test/assistant-management-page.test.js` (24) and `test/assistant-alert.test.js` (15, including W5,
    the CI-run backstop for "never both"). Four suites were re-aimed at the editor's new address.
  - **Browser:** `tests/brainstorm/assistant-management-page.spec.js` (B0–B13) and `assistant-alert.spec.js`
    (B0–B9; B9 is a 19-width sweep). Seven specs were re-aimed, `setup-alert.spec.js` among them.
  - **The shared fixture:** `test/helpers/assistantManagementFixtures.js`.

## 4. Deviations from intent

Harvested from the stories' Open questions, Out of scope and Deviations, the ADRs' Consequences, and the reviews.
Reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Ask: "8 or 9" actions and sub-pages | Ten actions, ten placeholder pages | interpretation | The ask lists ten (book § "Counted at intake") | none | — |
| 2 | Ask, FAQ: "follows (kind 1)" | "follows (kind 3)" | intentional-change | Kind 1 is a text note; the follow list is kind 3, NIP-02 (story 1, Open question 1) | The FAQ is correct | — |
| 3 | Intake decision 1: the editor moves to `/assistant/profile/edit` | Moved, and retitled "Edit Assistant Profile"; the Brainstorm `/settings` card's words follow | intentional-change | The owner's name for it; no second "My Assistant" page beside the hub (story 1, Open question 2) | The editor is reached from the hub's profile card or "My Assistant's Profile" | §6 #8 |
| 4 | Frame bullet 3: placeholder pages carry "the owner's alert criteria and notes" | Under "Alert criteria" and "Planning notes"; "Not yet defined." for the eight actions with no criteria | interpretation | As the ask proposed (story 1, Open question 5) | none | §6 #1 |
| 5 | Frame bullet 1: a FAQ (position unspecified) | Above the cards, under the heading | interpretation | A first visitor meets "What is a Tapestry Assistant?" first (story 1, Open question 3) | none | — |
| 6 | Frame bullet 2: marks for a signed-in viewer with an assistant | Visitors and viewers without an assistant see the hub with no marks and no count; a viewer without one is sent to `/setup` | interpretation | "Needs attention" is about the viewer's own assistant (story 1, Open question 4; AC-2) | An Admin or Customer who may create an assistant but has none is sent to `/setup`, whose step 1 is still a placeholder. They create one on the editor, through "My Assistant's Profile" | §6 #7 |
| 7 | Intake decision 2 and frame bullet 5: one alert at a time, setup first | Two components side by side at each mount, `<SetupAlert />` then `<TopBarAlert />`; the two never show together | constraint-discovered | The Setup Alert shipped first as its own component (PR #737). The owner approved side by side. "Never both" holds because both read one answer and the Setup Alert shows only on an answered count of at least one (ADR 0002 Amendment 1; review 2, Blocking 1) | None visible. The rule depends on `SetupAlert.jsx:24-25`, pinned by W5 and B3 | §6 #9 |
| 8 | Story 2 AC-6: full, no count, and mark plus button at 375 px | The Setup Alert's shape and size; the count hides at ≤ 1023 px and the sentence at ≤ 679 px | constraint-discovered | The longer button needs 652 px on `TopBar` pages. The owner kept 679 over shorter words (ADR 0002 Amendment 1, point 4) | Between 640 and 679 px the Setup pill shows its sentence and this one does not; they never show together | — |
| 9 | Not in the ask | While the pill shows, bars give up their own words. At ≤ 480 px: `TopBar`'s wordmark and the Tapestry user name, badge and brand word. Below 360 px: `TopBar`'s About link | constraint-discovered | Nothing may scroll sideways (ADR 0002 sub-decision 6 and Amendment 1; story 2 Deviations) | Below 360 px, while the pill shows, the About page is not linked from the bar; neither avatar menu links to it | — |
| 10 | Frame bullet 5: "from the other pages of both halves of the app" | Not on the phone search-results view (≤ 600 px hides that header's right side), nor on pages without a top bar ("Page not found", `/legacy/`) | constraint-discovered | ADR 0002 § Consequences; story 2 § Out of scope | Those viewers see no pill there | — |
| 11 | Story 2 § Copy: the accessible name is the sentence | At phone widths the visible words are "⚠ Manage Assistant →" | interpretation (approved) | As approved; the Setup Alert does the same (review 2, round 1, non-blocking 3) | A voice-control user saying the visible words may miss the link (WCAG 2.5.3) | §6 #6 |
| 12 | Frame bullet 6: nothing checked, published or stored | Read-only, but every full page load asks `/api/setup/status` once for a signed-in viewer | constraint-discovered | Setup first needs the answer; it is the Setup Alert's request too (ADR 0002 § Consequences) | One read per page load per signed-in viewer, with no polling | — |
| 13 | Not in the ask | The pill is persistent, counting ten on every page but `/assistant*` for a viewer with an assistant and no setup left | interpretation | Accepted for staging (story 2 § Out of scope; ADR 0002 § Consequences) | On production it would show everywhere, with ten placeholder actions | §6 #4 |
| 14 | Not in the ask | The developer pages' bar grows 8 px when a pill appears | constraint-discovered | The pill's own height beside a small logo; that bar is not fixed (ADR 0002 Amendment 1) | none | — |
| 15 | Frame bullet 1: "styled like `/setup`" | Reuses `/setup`'s `.bs-setup-*` classes | interpretation | "Styled similarly" (ADR 0001 § Consequences) | A change to `/setup`'s look changes `/assistant`'s | — |
| 16 | Frame bullet 4: every link leads to the editor | The address lives in the UI constant, `src/utils/assistantPages.js`, and the two static pages | constraint-discovered | The server and static pages cannot import the UI constant. Guard tests O1 and O2 keep all four equal (ADR 0001 § Consequences) | none | — |

**Undocumented work:** none.
- Every file in the diff traces to story 1 and ADR 0001, story 2 and ADR 0002, their test plans, or the reviews.
- The five UI files edited only for comments (`AuthContext.jsx`, `AssistantProfileEditor.jsx`, `Dashboard.jsx`,
  `UserDetail.jsx`, `SetupStatusContext.jsx`) are in story 1's Deviations and the fix round's commits. A diff filter
  confirms they changed no code.

## 5. Quality state at close

- **`npm test` at close,** after the book flip and the epic close-out, over the tree this close leaves behind (`+dirty`
  is this close, uncommitted):
  `20260922T032735Z-80234-c9d6 [book-close-assistant-management] started 2026-09-22T03:27:35.330Z on 577be4e9+dirty — FAIL, exit 1, 3650 passed, 52 failed, 130 skipped, 222/222 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, llms-txt, not-yet-shared-filter, concept-count-canonical, summaries-element-count · tmp/gate-runs/20260922T032735Z-80234-c9d6.json`
  - **Every failure is a live test against the host's stack.** The failing set is the host's known one:
    - the brain and hygiene suites, `concept-count-canonical`, `summaries-element-count`,
      `not-yet-shared-filter`, `return-the-four-on-every-read-surface` and `tag-detail`;
    - `llms-txt`, new since the last full run here.
  - **Against this host's most recent full run** (`20260921T064337Z-21374-92e9`, 215 suites) the only newly failing
    suite is `llms-txt`, which came with staging's own llms-txt book. Its two failures, H1 and H2, are live checks
    for `GET /llms.txt`. The local server answers 404, because it predates that route; staging answers 200. None
    involves this book's suites, which all pass: `assistant-management-page` 24/0, `assistant-alert` 15/0.
- **The book's own gate** (108 suites, story 1's plan § How to run): `20260922T030128Z-8883-ed8a` on `3e2d5e47` —
  1954 passed, 25 failed, 58 skipped.
  - **The failures** are the host's 11 live-graph suites, the same tests as before the book began
    (`20260921T220326Z-24274-84a4`) and in both review rounds.
  - **The book's suites:** `assistant-management-page` 24/0, `assistant-alert` 15/0.
  - **Against the baseline, six suites moved from FAIL to PASS:**
    - this book's two;
    - three it re-aimed (`my-assistant-page`, `one-default-assistant-profile`, `one-writer-assistant-profile`);
    - `setup-status`, which is environmental. It failed only its live H1, because the local server did not yet
      answer `/api/setup/status` when the baseline ran.
- **Browser class.**
  - **This book's specs, and every spec it re-aimed, pass** on the built UI (`assistant-alert.spec.js` 10/10,
    including B9 across its 19 widths).
  - **The full `tests/brainstorm/` run has 83 older failures.** They fail identically on a build of staging itself
    (ledger `2026-09-22-staging-browser-class-83-red`).
- **Staging** (PR #742, deploy run 35682235052, about 90 s).
  - **Smoke test, tiers 1–3 and 5:** clean.
  - **The bundle** moved from `index-CVntJGmH.js` to `index-DO6DL-ap.js`, this branch's exact build.
  - **The twelve `/assistant` addresses** each answer 200 with the new app shell (story 1, AC-7).
  - **Tier 4, visual:** the hub, a placeholder page and the editor render for a signed-out visitor, with no console
    errors.
  - **Not seen on staging:** the signed-in pill. The browser pane has no nostr signer, so the mocked browser suites
    cover it.
- **Known open issues:**
  - ledger `2026-09-22-w5-never-both-backstop-gaps`;
  - ledger `2026-09-22-tapestry-header-covers-content` (pre-existing);
  - the label-in-name question (§4 #11).
- **Debt from the ADRs' Consequences:**
  - the editor's address has a second home, guarded by tests (§4 #16);
  - `/assistant` is coupled to `/setup`'s classes (§4 #15);
  - "never both" depends on the Setup Alert's show rule (§4 #7);
  - one setup read per page load (§4 #12).

## 6. Carry-forward register

- [ ] **1. Real "needs attention" answers,** from each action's alert criteria, for the viewer's own assistant.
      Only the profile and identification-tags actions have criteria so far. (`stories/_intake.md`, entry 2026-09-21,
      item 1; §4 #4)
- [ ] **2. The ten action pages,** each with its own action cards, starting with the profile checklist that points to
      the editor for what is wrong. (intake item 2)
- [ ] **3. The assistant's DMs,** the FAQ's "Coming soon". (intake item 3)
- [ ] **4. Whether the pill should reach production while every action counts.** Held by the owner at this close.
      (story 2 § Out of scope; §4 #13)
- [ ] **5. Two product questions from intake.** Whether the pill stays persistent once its count is real, and how the
      hub groups its actions past ten ("8 or 9 (and growing)"). (intake "Product questions")
- [ ] **6. The pill's name and visible words at phone widths:** label in name, WCAG 2.5.3. (§4 #11)
      *2026-09-22: the Setup Alert no longer "does the same" (§4 #11). Book `setup-status-and-alert` #3 names it by
      what it shows at each width, with no `aria-label` (its ADR 0003). This pill's own name is unchanged.*
- [ ] **7. Creating an assistant from the hub.** A viewer who may create one but has none is sent to `/setup`, whose
      step 1 is a placeholder. This closes when the `/setup` step pages are built (intake 2026-09-20, item 3). (§4 #6)
- [ ] **8. On promotion, saved `/assistant` links open the hub, not the editor.** The editor is one card away, or
      directly through "My Assistant's Profile". (ADR 0001 § Consequences)
- [ ] **9. W5's two gaps:** a conditional pill before the guard, and the slot's wiring. (ledger
      `2026-09-22-w5-never-both-backstop-gaps`; §4 #7)
- [ ] **10. The fixed Tapestry header covers the top 7 px** of every control-panel page for a signed-in viewer, and
      23 px for a visitor at 320 px. This predates the book. (ledger `2026-09-22-tapestry-header-covers-content`)
- [ ] **11. 83 red browser tests on staging's own build.** (ledger `2026-09-22-staging-browser-class-83-red`)

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-09-22):
- 238 reviews decided: 236 PASS at the end, 2 CHANGES_REQUESTED.
- The headline kick-back rate reads 0%. It counts only final verdicts, so story 2's round-1 CHANGES_REQUESTED is
  invisible there; that under-count is OPEN.md row 309. It does appear among the 45 reviews with kick-back history.
- Re-review churn: 3. Books: 8 open, 61 closed.
- The session-start digest counted 142 open harness lessons, the oldest 81 days old. This book adds two.

| Finding | Source | Terminal state |
|---|---|---|
| **Two books designed the same top-bar spot in parallel, and no phase re-read the shared line before Review.** The ADR checked "not built" against its own base; the Setup Alert merged three minutes after this branch's implementation. Ports to Direction mode: yes, since those books merge the shared line too | review 1 and review 2, harness friction 1 | OPEN.md row `2026-09-22-parallel-books-no-shared-line-recheck` |
| **After merging the shared line, only the re-aimed tests of the other book's suite were run,** and Test Design's watch item said the pill "removes no control". The whole suite later found B11 (the pill hides text other tests assert on). Ports: yes | test plan 2 § Verification, "After review 2" | The same row, its "What the fix round adds" paragraph |
| **A commit landed in the reviewed checkout while the Reviewer's gate was running there,** and the record still names the old commit (git is read once, at creation). Ports: yes, since Direction-mode judges also run in-process | review 2, round 2, harness friction 1 | OPEN.md row `2026-09-22-commit-during-gate-run-unflagged` |
| **An ADR's re-aim list missed a spec asserting the page's old name** (`one-writer.spec.js` B2/B3, `/My Assistant/`); a Tester commit fixed it (`0025fa2b`). Ports: yes | story 1 § Deviations | OPEN.md row `2026-09-21-adr-reaim-list-misses-outcome-asserts` (fourth-instance paragraph) |
| **A full browser run cannot tell a new regression from 83 old ones** without a build-against-build comparison. Ports: yes, since both flows' reviewers run the browser class | the fix round's full run | OPEN.md row `2026-09-22-staging-browser-class-83-red` (cleanup) |
| **The retro's own kick-back rate hides this book's sent-back round** (in-file rounds; final verdict only) | `harness-stats.sh` at retro | OPEN.md row 309 (already open; nothing new to add) |
| **B9's fixed widths missed a breakpoint's edge.** 640 px scrolled by 12 px, and only a scratch probe at 2 px steps found it | test plan 2 § Edge cases; story 2 § Deviations | declined: fixed where it lives. B9 now samples both sides of every breakpoint, and says why. A general width-sweep rule belongs to the Tester canon, which the board packet `h-tester-canon` already groups. One sighting is not yet a pattern |
| **The first suite-by-suite gate comparison was vacuous.** The script read `passed`/`failed`, but the record's fields are `pass`/`fail` | fix round (session) | declined: a slip in a scratch script, caught by its own empty output and redone before any claim was made. `gate:status` itself reads the record correctly |
| **Two test-writing slips in Phase 3.** A card click below the fold (Playwright's `mouse.click` does not scroll), and failures that said only "waiting for main" (the NotFound page has no `<main>`) | story 1 § Deviations; test plan 1 § Verification | declined: one-off, each fixed in its own commit (`0485da0f`; the spec's `open()` helper). No recurrence across books |
