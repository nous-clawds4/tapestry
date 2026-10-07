# Build Audit: Manage your Treasure Map — `/treasure-map`, built to the Claude Design blueprint

**Book:** `engineering-team/audits/manage-treasure-map/book.md`
**Date:** 2026-10-07
**Branch / commit range:** `staging`, `dcddbe4..5a6afc1` (27 commits), plus this close
**Provenance:** Acceptance-frame (the owner's ask and nine recorded decisions, quoted verbatim in `book.md`)
**Confidence:** high for what shipped and why. Every capability traces to an approved story, an ADR and a reviewed
diff, and each of the owner's decisions is quoted.

## 1. What shipped

- **A Brainstorm-side "Manage your Treasure Map" page at `/treasure-map`,** view-only, in the owner's Claude Design
  styling: kicker, heading and introduction; a collapsible FAQ (four questions, one answer at a time); and a raw
  Treasure Map viewer that shows the person's own kind 10040 as JSON, or "No Treasure Map found", or "Couldn't read
  your Treasure Map" with Try again, or a loading line. Signed out, a sign-in prompt replaces the viewer. —
  `stories/done/manage-treasure-map/1-the-manage-your-treasure-map-page.md`
- **The menus split by side.** "My Treasure Map" on the search landing page and the Brainstorm top bar opens
  `/treasure-map`; on the Tapestry header it still opens the TA Treasure Map page. — story 1
- **An Advanced management placeholder at `/treasure-map/advanced`:** back link, the blueprint's kicker and heading,
  and a "coming soon" line pointing to the TA Treasure Map page. — story 1
- **The My Assistants page's three Treasure Map links** (introduction, each row's Manage, the Duties tab) open
  `/treasure-map`. Tapestry-side links don't move. — story 1
- **"Assistants by category" cards** between the FAQ and the raw viewer: Scores, Lists, Concepts, each with its
  Assistant, "Mixed · N Assistants" (up to three avatars, every name readable by screen readers) or "Not assigned yet";
  the person's own Assistant here has the purple avatar. A card counts every Assistant the Map would ask for some
  insight in that category, broad entries included. —
  `stories/done/manage-treasure-map/2-the-assistants-by-category-cards.md`
- **Three fixes to story 1, from its review:** the raw viewer starts closed for each viewer (and stays open across
  sign-in settling); hiding the FAQ closes its open answer; the raw box is keyboard-focusable, named "Raw Treasure
  Map", and scrolls with the arrow keys. — story 2

## 2. Epics & stories rolled up

### Epic: `manage-treasure-map`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-manage-your-treasure-map-page | the page, menus, FAQ, raw viewer, placeholder, `/assistants` links | Done | `reviews/done/manage-treasure-map/1-the-manage-your-treasure-map-page.md` (PASS, round 1) |
| #2 the-assistants-by-category-cards | the category cards and story 1's findings 1, 2, 4 | Done | `reviews/done/manage-treasure-map/2-the-assistants-by-category-cards.md` (PASS at round 3) |

ADRs: `decisions/done/manage-treasure-map/0001-a-design-page-on-the-shared-strict-map-read.md`;
`0002-the-cards-count-with-their-own-rule-over-the-same-read.md` (with Amendments 1 and 2, and a correction).

## 3. As-built inventory

- **User-facing:**
  - routes `/treasure-map` (`ui/src/pages/treasure-map/Index.jsx`) and `/treasure-map/advanced`
    (`ui/src/pages/treasure-map/Advanced.jsx`), outside the `/tapestry` tree (`ui/src/App.jsx`);
  - a pure view-model, `ui/src/pages/treasure-map/manageTreasureMap.js`: every word (`COPY`, `FAQS`), the panel's
    phase (`mapPanelPhase`), the raw text (`rawMapText`), the category rule (`categoryAssistants`) and the card shaping
    (`categoryCards`);
  - `ui/src/config/avatarMenuLinks.js`: `MANAGE_TREASURE_MAP_PATH`, `TREASURE_MAP_ADVANCED_PATH`,
    `TA_TREASURE_MAP_PATH`; `personalLinks` picks My Treasure Map's target from `profileBase`;
  - `ui/src/pages/assistants/myAssistants.js`: `TREASURE_MAP_PATH` follows the Brainstorm menus; `cardFields` exported;
  - `ui/src/styles.css`: `.bsd-tm-*` and `.bsd-tm-cat-*` blocks; the pages reuse `.bsd-ma-btn` / `.bsd-ma-status` and
    the global `.bs-sr-only`.
- **Domain:** no concept changed; no firmware reinstall. Reads only: kind 10040 (the person's own, through the shared
  strict `useTreasureMap`) and kind 0 profiles (through `fetchProfilesChunked`).
- **Data & contracts:** no API route, no stored shape, nothing published or signed. The cards read the draft
  Treasure Maps grammar's broad keys (`*`, `*:<system>`, `3038x…`, `3039x…`, bare `39998`) for display only;
  the app's shared classifier (`classifyEntry`) is unchanged.
- **Tests:** `test/manage-treasure-map-page.test.js` (24, two live), `test/manage-treasure-map-cards.test.js` (31),
  `tests/brainstorm/manage-treasure-map.spec.js` (15), `tests/brainstorm/manage-treasure-map-cards.spec.js` (15); three
  re-aimed assertions in the `/assistants` specs.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "follows the blueprint" | A category the Map doesn't cover says "Not assigned yet"; the design shows the person's own Assistant | intentional-change | Owner, book decision 7 | People see an honest gap instead of an implied default | — |
| 2 | Frame: "follows the blueprint" | A broad entry's Assistant counts alongside a category's own entries (rank → A plus all Scores → B is Mixed); the design looks at broad entries only when the category has nothing of its own | intentional-change | Owner, book decisions 8–9; story 2 AC-2 | Cards show every Assistant other apps would ask | — |
| 3 | Frame: "follows the blueprint", view-only | No Edit, All duties, pickers, override switches or Save | deferred | Owner, book decision 1 | Assignments are read, not changed, here | §6 |
| 4 | Frame: the Advanced page | A placeholder pointing at the TA Treasure Map page | deferred | Owner, decisions 1 and 5 | Per-entry detail lives on the Tapestry side for now | §6 |
| 5 | Blueprint copy | The introduction and two FAQ answers describe behaviour the app doesn't have yet ("Brainstorm keeps it up to date for you"; setup creates the Map; the Advanced page lists every entry) | intentional-change | Owner, book decision 4 | The words run ahead of the app | §6 |
| 6 | Blueprint: the Advanced screen's introduction | The placeholder line sits in its place | interpretation | Story 1 § Deviations | — | — |
| 7 | Blueprint: the section label | A real `h2` heading, styled the same | interpretation | Story 2 § Deviations | Better page outline for screen readers | — |
| 8 | Story 1 AC-4/AC-5 (as first built) | The raw viewer resets only by unmounting on sign-out; one narrow top-bar path changes the person without a sign-out and leaves an open viewer open on the new person's own Map | constraint-discovered | ADR 0002 Amendments 1–2 and its correction; review 1 rounds 1–3 | None in practice (no data crosses people) | §6, ledger `2026-10-07-top-bar-sign-in-while-loading` |
| 9 | Story 2 AC-2 (the rule) | Three draft-grammar edge cases (prefix shadowing of `*:<rest>`, system words by family, two spellings of one key) differ from the draft's §6; nothing writes them today | constraint-discovered | Review 1 round 1 non-blocking 1–3 | None today | §6, ledger `2026-10-07-treasure-map-card-rule-edge-cases` |

**Undocumented work:** none. Every changed code file traces to story 1 or story 2, and the only test edits outside the
book's own files are the ADR-named re-aims (story 1) and the recorded Amendment (story 2's test plan).

## 5. Quality state at close

- **Test gate:** `npm test` over the closed tree (book flipped, epic moved under `done/`, references rewritten):
  `20261007T130739Z-25354-cc7c started 2026-10-07T13:07:39.434Z on 5a6afc17+dirty — PASS, exit 0, 4970 passed, 0 failed,
  581 skipped, 271/271 suites`. "dirty" is this close's uncommitted changes; the 581 skips are the live-stack suites,
  with no stack in this session.
- **Browser:** the four specs (57 tests) pass, ×5 idle and ×3 under load, at `fbf99d7`; the reviewer's round 3 ran them
  12 times with no failure. They run against the built UI with every API mocked, because no stack ran in this session.
- **Live, against staging (2026-10-07):** `/treasure-map` and `/treasure-map/advanced` serve the app (the page suite's
  H-class, 2/2); staging serves the bundle built from `fbf99d7` (`index-DjWarEma.js`, byte-identical), and the bundle
  carries the cards and the raw-box label. Not yet clicked through signed in on staging.
- **Known open issues (accepted, non-blocking):**
  - with the raw viewer open, the loading or error line is announced twice (two live regions) — review 1 round 1 NB 6;
  - while sign-in settles, the cards section briefly shows its loading line even for someone who turns out signed
    out — review 1 round 1 NB 7, matching story 1's phase model;
  - Try again can't recover a failed relay-list read until reload (shared hook) — ledger
    `2026-10-01-treasure-map-retry-skips-relay-list`, now naming this page too;
  - the top-bar sign-in path in §4 #8.
- **Debt from ADRs:** two parsers now read 10040 keys (`classifyEntry` and the cards' rule) until the draft grammar is
  ratified (ADR 0002 Consequences); `cardFields` is a cross-page export from `/assistants`' view-model; this page
  depends on `.bsd-ma-btn` / `.bsd-ma-status` (ADR 0001 Consequences).

## 6. Carry-forward register

- [ ] The design's Edit mode: All duties, per-category pickers, override switches, Save → a newly signed kind 10040
  (§4 #3; book decision 1).
- [ ] The full Advanced page: every entry and its Assistants (§4 #4).
- [ ] Copy that runs ahead of the app: revisit the introduction and FAQ answers once setup publishes the Map and the
  Advanced page exists (§4 #5).
- [ ] The cards' rule edge cases, before the Edit book reuses `categoryAssistants` (§4 #9; ledger
  `2026-10-07-treasure-map-card-rule-edge-cases`).
- [ ] The top bar's sign-in while the session check runs (§4 #8; ledger `2026-10-07-top-bar-sign-in-while-loading`).
- [ ] Duplicate live regions when the raw viewer is open (§5).
- [ ] Fold the two 10040 key parsers into one when the draft Treasure Maps grammar is ratified (ADR 0002).
- [ ] A signed-in click-through on staging, then production on the owner's go (book acceptance frame, last bullet).

## 7. Process findings (harness)

Inputs: both stories' review "Harness friction" sections, the book's ledger rows, and process-shaped deviations.
`scripts/harness-stats.sh` at close: 260 reviews decided, kick-back rate 0% (CR-final ÷ decided), churn 3; 68 books
closed and 8 open (this one included); median story cycle time 0 days, both of this book's stories matched
(`the-manage-your-treasure-map-page`, `the-assistants-by-category-cards`: 0d story→review). Story 1 passed in one
round; story 2 needed three. The session-start digest shows a standing meta escalation (173 open harness lessons); this
retro adds three rows and doesn't resolve it.

| Finding | Source | Terminal state |
|---|---|---|
| Test Design verified a neighbour suite against old code only, so it missed that new UI would duplicate the page's words and roles; four story-1 tests were then re-aimed in Phase 4 | Story 2 review 1, harness friction 1; test plan Amendment | OPEN.md row `2026-10-07-neighbour-suite-duplicate-roles` (meta) |
| The review template's own `## On PASS (same commit)` heading is the last verdict token in a CHANGES_REQUESTED review, so harness-lint L1 reads it as PASS-final | This book: review 1's commit went lint-red until the section was removed (`80168e3`) | OPEN.md row `2026-10-07-on-pass-heading-reads-as-verdict` (meta) |
| Sessions told to develop directly on `staging` push Phase-3 failing tests (and draft artifacts, which the stop hook demands be pushed) to the shared branch, leaving a red window for others' PR CI | This book, both stories' Test Design | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (meta) |
| The Implementer's repeat runs (×3, idle) missed a load-dependent race the Reviewer found under load | Story 2 review 1, harness friction 2 | Declined: the reviewer flagged it as not a process defect; rounds 2–3 ran every stability check under load too, and the review step is where this belongs |
| Story 1 was approved ("Ready for architecture") with three drafted open questions unanswered | Story 1 § Resolved at the story gate | Declined: the drafts carried recommended answers, which were recorded as the owner's decisions 4–6 and shown again at later gates; no rule was skipped |
| The Reviewer's wiring says commit and flip the status; every brief here reserved both for the orchestrator | Both stories' reviews (as in my-assistants) | OPEN.md row 316 (existing) |
| Moving the epic under `done/` breaks inbound path references | This close, step 9 | OPEN.md row `2026-09-20-done-move-breaks-inbound-refs` (existing); this close rewrote its own references |

**Does it port to the other flow (Direction ↔ human-gated)?**
- **Neighbour suites:** yes, it's a Test Design rule; a gate judge reading the test plan would check it the same way.
- **The On-PASS heading:** yes, every review in either flow uses the template.
- **Red tests on staging:** yes for any flow that commits straight to a shared branch; Direction mode's feature-branch
  discipline already avoids it.
