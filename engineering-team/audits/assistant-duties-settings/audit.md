# Build Audit: Assistant Duties — the duties this instance offers, set by its Owner

**Book:** `engineering-team/audits/assistant-duties-settings/book.md`
**Date:** 2026-10-12 (opened and closed the same day)
**Branch / commit range:** `f51fe70d3..480343c22` on `staging`. The book's own commits run from `fce077c26` (plan) to
`480343c22` (review round 2), listed in §2. The range also holds another session's docs commits
(`duty-menus-and-self-maps` #5), which touch none of this book's files.
**Provenance:** Acceptance-frame (no PRD). The owner confirmed the frame at story 1's approval, and amended it at review
round 1 (book Decision 8).
**Confidence:** high. At close there was one gap: no signed-in Owner or Admin had used the tab, and every check of it
was from the tests, the browser specs and an unauthenticated smoke. **Closed post-close (2026-10-13, production):** the
Owner reordered, republished and reset from the tab signed in (§5 "Post-close verification").

> The Build Audit is the **as-built record**: what the product *is* now, factual and source-linked. It does not propose
> changes; that is the seed's job.

## 1. What shipped

Every bullet of the acceptance frame, as amended, is met by story 1
(`engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md`).

- [x] **An Assistant Duties tab.** `/tapestry/settings/assistant-duties` is a Settings tab, right after Assistant
      Profile. It lists the duties this instance offers, each with its kind, its category (Scores, Lists, Concepts or
      none) and its relay. The Owner or an Admin can:
  - add any whole kind (five digits), at **This instance's relay** or a typed `ws(s)://` relay that others can reach;
  - remove any duty, down to none;
  - change a duty's relay;
  - reorder by dragging, or with **Move up** / **Move down**;
  - **Reset to defaults**, after a confirmation.

  Each change saves at once. A refused one shows its reason and leaves the list as it was. Anyone else sees the Settings
  page's refusal, and the server refuses their changes through either route (401/403).
- [x] **Six by default.** `src/config/defaults.json` ships `assistantDuties`: `30382`, `30392`, `30393`, `30394`, `39998`,
      `39999`, each at This instance's relay. With that list the Owner's offer is what it was before the book.
- [x] **Kept on the server.** The list is no longer in code (`OFFER_KEYS` is gone).
  - **Where a changed list lives.** In the volume's `settings.json` under `assistantDuties`, replacing the six whole.
  - **Restarts and redeploys.** It survives both, and a new shipped default never overwrites a saved list.
  - **Changes take effect at once.** Every check re-reads the list, with no restart.
  - **Hand edits.** The file stays hand-editable (BIBLE §15). An entry the rule refuses is dropped and logged, never
    offered.
- [x] **Every Duty Menu follows it.** Every Assistant's Duty Menu works from the list:
  - **What it offers.** Exactly the listed duties, in order, at their relays. It is the same for the Owner, Admins and
    customers, so Scores is no longer held back from anyone.
  - **Publishing** publishes them.
  - **Change, including a reorder,** marks every Assistant **Needs attention** until it republishes. "Current" now counts
    order.
  - **The Duty Menu page** says "offers".
  - **Your Assistant's Treasure Map** shows a listed duty this instance does not publish as offered and never live.
- [x] **On staging.** Deploy runs 694 and 695 succeeded for round 2's commits. The tab's URL answers 200, and the
      routes refuse an unauthenticated read with 401.

## 2. Epics & stories rolled up

### Epic: `assistant-duties-settings`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-assistant-duties-tab | The tab, the saved list with its six defaults, and every Duty Menu following it | Done | `reviews/assistant-duties-settings/1-the-assistant-duties-tab.md` (round 1, then round 2) |

**Commits, in order** (all on `staging`):

| Commit | What |
|---|---|
| `fce077c26` | plan: book, epic, story draft |
| `e66bb1129` | story approved |
| `85434cb68` | ADR 0001 proposed |
| `d6dcda0b8` | ADR 0001 accepted |
| `e05f033d7` | failing tests |
| `273d44410` | implementation |
| `9a7735a04` | two Tester-side test fixes |
| `72dba9e9a` | review round 1 |
| `80625ae4c` | ADR Amendment 1, story and book amended |
| `a6d6e3f88` | Amendment 1 accepted |
| `b11302628` | round-2 failing tests |
| `903c10e98` | R3 re-aim |
| `5ee2ae92f` | round-2 implementation |
| `36e200fcd` | hash-citation fix |
| `480343c22` | review round 2 |

The failing tests of each round were held locally and pushed in the same push as their implementation (§7, P1).

## 3. As-built inventory

Derived from `git diff f51fe70d3..480343c22` over this book's files: 27 files, +2222 / −179.

- **User-facing**
  - **New tab.** `ui/src/pages/settings/AssistantDuties.jsx` (the component), `assistantDutiesCopy.js` (its words, and
    the pure helpers `moveDuty`, `addDuty`, `removeDuty`, `setRelay` and `refusalLine`), plus `Index.jsx`'s `TABS`
    entry and `App.jsx`'s route child.
  - **Styles.** New `settings-duties-*` classes in `ui/src/styles.css`.
  - **Duty Menu page.** Two sentences say "offers" (`ui/src/pages/assistant/dutyMenuCopy.js`).
- **Routes** (`src/api/settings/assistantDutiesApi.js`, registered behind `requireOwner` in `src/api/index.js`, with
  route-table entries in `src/middleware/routeAccess.js`):
  - `GET /api/settings/assistant-duties` answers the list as the offer uses it;
  - `PUT /api/settings/assistant-duties` stores the whole list, checked; a refusal is 400 `{ code, index }`;
  - `POST /api/settings/assistant-duties/reset` brings back the six.

  The generic `PUT /api/settings` runs the same rule on `assistantDuties` (`src/api/settings/settingsApi.js`).
- **Domain**
  - **The rule.** `src/lib/duty-menu/index.js` gains `dutyKeyOf` (whole kinds only), `isPublicRelayUrl`,
    `validateDutyList` (strict, refusal codes), `readDutyList` (lenient: drops and counts) and `instanceRelayFor`.
  - **Reading menus.** `keptKey` is factored out of `readMenuRows`, unchanged in behaviour.
  - **The offer.** `buildOffer` takes the list, and `sameRows` is ordered. `OFFER_KEYS` is deleted.
  - **Its inputs.** `src/api/assistant/dutyMenu.js` `resolveOfferInputs` reads the list (`readAssistantDuties`) and no
    longer looks the viewer up as a customer.
  - **The self-Map.** `src/api/assistant/selfMap.js` `readUpkeep` never reads Scores as live at a typed relay.
  - **No concept or firmware change;** no reinstall.
- **Data & contracts**
  - **Settings.** `assistantDuties` is an array of `{ key: "<five digits>", relay?: "<ws(s) URL>" }`, the six by
    default.
  - **Menus.** No wire change: menus are still kind 39999 with `duty` rows (`duty-menus.md` §§ 4–5). Only which rows
    and their order follow the list.
- **Docs**
  - **BIBLE.** §11: the attention row's offer text, and three route rows. §15: the settings file's `assistantDuties`.
  - **`protocols/drafts/duty-menus.md:5`.** The implementation line.
  - **Notes on two earlier ADRs.** `assistant-duty-menu/0001`: partly superseded. `assistant-self-map/0001`: a
    cross-book note.
  - **Ledger row** `2026-10-12-settings-json-written-in-place`.
- **Tests**
  - **New Node suite.** `test/assistant-duties-settings.test.js`: 36 tests, classes L, D, R, A, O, T and S.
  - **New fixture.** `test/helpers/assistantDutiesFixtures.js`.
  - **New browser spec.** `tests/brainstorm/assistant-duties-settings.spec.js`, B0–B13.
  - **Re-aimed.** The Duty Menu check, publish and page suites, the self-Map check suite (AD1–AD4 added), the Duty Menu
    browser spec (B10), and `test/helpers/dutyMenuFixtures.js`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Book Decision 1, frame bullet 1: "add any Treasure Map key" | Only a whole kind (five digits) can be added; narrower keys (`30382:rank`), family keys (`3038x`), `*` and Concept keys with a `d` are refused, and dropped if hand-edited | intentional-change (owner, book Decision 8) | Review round 1 Blocking 1: Your Assistant's Treasure Map reads offers by kind, so such keys made the two pages disagree and could flag a true claim false. The owner chose whole kinds over teaching the self-Map (ADR 0001 Amendment 1) | An Owner cannot offer part of a kind, such as Scores for one metric only | §6: narrower offers, if ever wanted |
| 2 | Story Decision "Scores for every Assistant" | As specified; an Admin who is not a customer now offers Scores though no upkeep runs for them | interpretation, confirmed | Story approval gate; ADR § Consequences | The Admin's Treasure Map shows those Scores offered, not live | — |
| 3 | `assistant-duty-menu` #1 AC-4: "current" ignores order | "Current" counts order, so a reorder needs a republish | intentional-change (owner, at ADR acceptance) | ADR sub-decision 5 | A reorder marks every Assistant Needs attention | — |
| 4 | Story § Copy | Two words added: "Loading…" and "Could not load the duties: this instance did not answer." | added-beyond-scope (small) | Story § Deviations (implementation) | None beyond the first read | — |
| 5 | Story § Copy | The ADR's additions: Change relay / Save / Cancel, "Drag to reorder", "The list can hold at most 200 duties." | interpretation, confirmed | ADR sub-decision 7, owner at acceptance | — | — |
| 6 | Story AC-3 field label and refusal: "Treasure Map key" | Kept after Amendment 1, though only whole kinds are accepted | interpretation | Owner approved option 1 "with the existing message"; review round 2 note 4 | `30382:rank` is refused as "not a Treasure Map key", which is loose | §6 copy |
| 7 | ADR sub-decision 6: "library unchanged" | Held; the fix was to narrow the list instead (Amendment 1) | constraint-discovered | Review round 1 | — | — |

**Undocumented work:** none. Every code and test file in the diff traces to story 1, ADR 0001 or its Amendment 1.
Test-side fixes made outside Phase 3 (`9a7735a04`, `903c10e98`) are each disclosed in the story's § Deviations and in
their own commits, and both reviews judged them genuine (§7, P5).

## 5. Quality state at close

- **Test gate at close** (after the book flip and the epic close-out, on the tree this close leaves). Label
  `assistant-duties-settings-close`, `npm run gate:status`: run `20261012T235844Z-23462-ac61`, on `480343c2+dirty` (the
  close's uncommitted files): PASS, exit 0, 5866 passed, 0 failed, 582 skipped, 307/307 suites.
- **Review round 2's own gate.** `20261012T233931Z-5898-8ddb`: PASS, 5866 passed, 0 failed. Its browser specs passed
  31/31 on Chromium.
- **Not yet seen signed in, at close.** No Owner or Admin had used the tab on staging. The checks there were the deploys
  and an unauthenticated smoke. (Same gap as the sibling book `assistant-duty-menu`.)
- **Post-close verification (2026-10-13, production, the Owner signed in).** At
  tapestry.brainstorm.world/tapestry/settings/assistant-duties, after PR #857:
  - The tab listed the six defaults. The Duty Menu page showed the same six.
  - Swapping `39998` and `39999` saved, and the new order was still there after leaving the page and coming back.
  - `/assistant` and `/assistant/duty-menu` then asked for a republish, and the republish went through.
  - Reset to defaults put the six back.

  Add, Remove and Change relay were not tried signed in; the tests and browser specs cover them (B0–B13).
- **Debt logged:**
  - Ledger row `2026-10-12-settings-json-written-in-place`, pre-existing and widened by this book: `settings.json` is
    written in place, so a crash mid-write would lose every override, this list included.
  - Ledger row `2026-10-12-duty-settings-test-cleanups`: small test tidy-ups the reviews left non-blocking.
  - Ledger row `2026-10-12-staging-duty-list-round1-keys`: a one-off check of staging's saved list (done 2026-10-13: the Owner reset staging to defaults).
- **Accepted by the ADR (§ Sub-options), not bugs:**
  - Typed relays are owner-set configuration. They are connected to without the DNS guard, as Relay Settings' relays
    are.
  - Last write wins between two Admins saving at once.

## 6. Carry-forward register

- [ ] **Narrower or broader offers** (§4 #1). Offering part of a kind (`30382:rank`) or a family (`3038x`, `*`) would
  need Your Assistant's Treasure Map to read such offers: ADR 0001 Amendment 1's rejected option, and review round 1
  Blocking 1's three rules (a)–(c). Product: is it wanted?
- [ ] **The key field's words** (§4 #6). Possibly "Kind" and "That isn't a kind: enter five digits, such as 30383."
  (review round 2 note 4).
- [x] **Try the tab signed in** (§5): done on production 2026-10-13 by the Owner (reorder, persistence, Needs attention
  and republish, reset). Add, Remove and Change relay were not tried signed in.
- [ ] **The drag handle has no role** (review round 1 note 7). It is announced only by its `aria-label`; the keyboard
  path is Move up / Move down.
- [ ] **Typed relays without the DNS guard** (review round 1 note 6; ADR § Sub-options). Revisit if Admins setting
  relays the server connects to becomes a concern.
- [ ] **No warning for a duty this instance does not publish** (book Decision 1, owner's choice). Revisit if Owners
  offer unbuilt kinds by mistake.
- [ ] **`settings.json` written in place**: ledger row `2026-10-12-settings-json-written-in-place`.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time:
- this book: 13 phase commits; story `the-assistant-duties-tab` story→review 0d (same day);
- whole project: 295 reviews decided; final kick-back rate 0%; churn 3; 82 books closed and 10 open.

This book's one CHANGES_REQUESTED (round 1) is among the 74 reviews with kick-back history.

| # | Finding | Source | Terminal state |
|---|---|---|---|
| P1 | **Failing tests vs the shared line.** Sessions told to develop on `staging` hit Phase-3 failing tests and a stop hook that demands every commit be pushed. This book held each round's failing tests locally and pushed them with their implementation (the row's fix shape (b)), with the owner's approval. Applied twice; `staging` never went red. | This session; ledger row's own history | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (evidence added) |
| P2 | **An ADR widened a value another book's code consumes without reading that consumer's parser.** ADR 0001 let the list hold every key readers keep. Your Assistant's Treasure Map, which reads the same offer, accepts only bare kinds. Caught at review, not architecture. | Review round 1 Blocking 1 | OPEN.md row `2026-10-12-adr-widened-value-consumer-unread` (new, meta) |
| P3 | **`codeOnly` takes `/*` inside a string for a comment opener.** The helper, copied across many suites, blanked 188 lines of `src/api/index.js` (the `'/api/settings/*'` route), so a source sentinel failed wrongly. It could as easily pass vacuously. | Implementation (A2 fix, `9a7735a04`); review round 1 note 5 | OPEN.md row `2026-10-12-codeonly-reads-string-slash-star` (new, meta) |
| P4 | **A rebased commit's hash cited in a phase doc.** The story's § Deviations cited `3b3b3e0ed`, which became `903c10e98` on rebase. Fixed in `36e200fcd`. | This session | OPEN.md row `2026-10-11-phase-docs-cite-rebased-hashes` (recurrence added) |
| P5 | **A stale case can hide inside a red test.** Round 2's re-aim missed R3's duplicate case. It passed inside a test that failed on its other cases, so the Tester's red run could not show it; it surfaced in Phase 4 and was fixed there. This makes three test edits outside Phase 3 in this book (reviews' notes 4 and r2-2), each disclosed and judged genuine. | Review round 1 note 4; round 2 note 2; story § Deviations | OPEN.md row `2026-10-12-stale-case-hides-in-failing-test` (new, meta) |
| P6 | **A Reviewer dispatch asked for something the review template forbids** (record completion detection in the review file). The orchestrator wrote the dispatch. | Review round 2 report | OPEN.md row `2026-10-11-reviewer-dispatch-tools-and-commit` (item added) |
| P7 | **Lint L14 kept the verdict out of the story,** as designed. | Review round 1 housekeeping | declined: no defect; the rule worked |
