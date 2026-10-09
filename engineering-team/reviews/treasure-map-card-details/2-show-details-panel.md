# Review: Story 2 — Show details: each card's assignments, entry by entry

**Reviewer:** Claude (acting as Reviewer, Gate B — Light profile)
**Date:** 2026-10-08
**Diff:** `git diff origin/staging...HEAD` on `feat/treasure-map-card-details`. Story 2's code is commit `3511f878`,
including the named one-step change to `tests/brainstorm/treasure-map-edit.spec.js` E18. Commit `2d09809e` changes only
the story file. Reviewed at HEAD `64998621`. The hotfix commits `b84484c8` and `2447d98a` ride the branch and are not
under review here.
**Story:** `engineering-team/stories/treasure-map-card-details/2-show-details-panel.md` (no ADR: Design note)

## Quality gates (run by reviewer, not trusted)

- [x] **Scoped Node gate** (the exact command in the story header): **exit 0**, `TOTAL_FAIL=0`. Exit code captured by
  brace-redirect, not piped. Results: `treasure-map-card-details` 17/0, `manage-treasure-map-cards` 31/0,
  `treasure-map-card-rule-edges` 29/0, `treasure-map-star-scopes-ignored` 17/0, `manage-treasure-map-page` 24/0 (0
  skipped), `treasure-map-edit-mode` 48/0, `treasure-map-switches` 34/0, `treasure-map-save` 24/0,
  `treasure-map-needs-attention` 6/0.
- [x] **Browser specs** (the story's "How to run" command). I ran them against **my own build of HEAD**:
  `vite build --outDir <scratchpad>` and `vite preview --port 7815`, not the existing :7799 server. **exit 0: 134 passed,
  0 failed, 0 skipped.** Story 2's 11 tests are D1–D7, D8 at 375 px and at 430 px, D9 and D10. The run includes E18 with
  its changed step.
- [x] **Fail-before spot-check:** against my build of `origin/staging` on :7816, all 11 D-tests fail, as the plan says.
- [x] **Behaviour preserved through the `categoryAssistants` rewrite.** I checked this independently because A1 is true
  by construction once the projection exists. I ran a differential fuzz of HEAD's `categoryAssistants` against
  `origin/staging`'s, over **200,007 Maps**. They were random tag lists drawn from 34 key spellings: bare and scoped `*`,
  families, own kinds, duties, Concept spellings, garbage. The pubkeys included valid, upper-case, 63-hex and non-string
  ones, and the relays non-string ones, plus 7 garbage events. **0 differences.**
- [x] **Lint:** branch `Index.jsx` has 1 error, `react-hooks/refs` at `:614:22`. `origin/staging` has the same rule at
  `:529:22`, in the same `cards.map` callback. `manageTreasureMap.js` is clean on both. **No new lint findings.**
- [x] **Guard suites:** the 22 other suites that read `styles.css`. 20 passed. 2 failed only in live-tier H classes:
  `show-the-four-on-the-goal-screens…` H1 and H3 (goal corpus state), and `teach-it-what-matters` H6 ("fetch failed") and
  H7 (live graph hygiene). They ran against the local stack on :7778, which serves the main checkout. Every static class
  in both passed. **I attribute these failures to the environment, not to this diff.** Registry completeness,
  `stack-free-npm-test`: 7/0.
- [ ] **Full `npm test`:** not run (Light: the reviewer's discretion; it is always run at book close). No gate-run record
  exists in this worktree to quote.

## Spec adherence — AC verdict table

| AC | Handles | Verdict | Evidence |
|---|---|---|---|
| AC-1 a "Show details" toggle at each card's foot (below the picker row in Edit); each independent; all start closed | D1, D5, S5, W1 | **Met** | Pass. `Index.jsx:199,239–260`. |
| AC-2 one group per key, in first-seen order, first spelling, monospace; rows with avatar, name, relay or "No relay", and Backup after the first | U1, U3–U7, U10, D2, D7, W1 | **Met** | Pass. `manageTreasureMap.js:230–253`; `Index.jsx:271–309`. |
| AC-3 "Individually assigned" and "Everything else"; nothing that doesn't count | U8, U9, S4, D2 | **Met** | Pass. The label uses `entryRole` (`Index.jsx:279–281`), so it is the same rule the override switch counts. |
| AC-4 "No entries yet.", including with no Map | U2, D3 | **Met** | Pass. |
| AC-5 Edit shows the draft and follows each change; leaving Edit or a Save shows the published Map; open/closed state survives | S2, D5, D10 | **Met** | Pass. `Index.jsx:615–620`: the same component, keyed by category, at the same position in both modes. |
| AC-6 every Assistant named, backups included | S3, D4 | **Met** | Pass. `wantedKey` now covers every tag (`Index.jsx:502–505`). |
| AC-7 the card and its panel never disagree | A1, S1, D6 | **Met** | Pass. It holds by construction (`manageTreasureMap.js:263–273`), and the 200,007-Map fuzz confirms nothing changed. |
| AC-8 a real disclosure button; a named region; wraps at 375/430 | S5, D7, D8 ×2 | **Met** | Pass. `aria-controls` appears only while the panel exists. That is this page's established rule (the Picker, and E18's last check), so I count it as conformant. |
| AC-9 nothing else moves | D9, R | **Met** | The scoped gate and the 7 regression specs pass. E18's one step is the only change to an existing test. |

- [x] Every AC has a passing test. No AC is silently dropped. Every planned handle is present.
- [x] No behaviour beyond the story.

## Gate-A classification — ratified: Design note, no ADR

- No trigger fires. This is a pure read of tags the page already holds, plus markup and CSS. There is no wire, auth,
  schema, firmware, dependency, routing or cross-repo change.
- `editTreasureMap.js` is consumed (`entryRole`), not changed, by `3511f878`. The branch's edits to that file are the
  hotfix's.
- **E18:** I ratify the step outside the declared blast radius.
  - The new toggle sits at the Scores card's foot, below the picker row, so it is the next control in tab order. The
    test now expects focus there.
  - The property E18 pins is unchanged: tabbing past the last row closes the list and moves focus on.
  - It is named in the Design note before review, as Light's J3 rule 2 asks.
- The rejected alternative (a second walk of the card rule) is real. The rule has changed twice in treasure-map-edit.

## Adversarial probing beyond the plan

- **POV ("who is this true for?"): sound.**
  - The panel shows the viewer's own public kind-10040 Map (or their own draft), read for the session user only.
  - It is computed at view time from the read, nothing is stored or denormalised, and nothing new is published.
  - The purple avatar is the session's own Assistant (`user.assistantPubkey`), never the TA or a literal.
- **Is the card rule right for Concepts now that Concepts is two kinds?** The riding hotfix made `39998` and `39999` the
  Concepts family. `shadowed()` (`manageTreasureMap.js:217–220`) still hides a bare `*` for Concepts on `39998` alone,
  and the panel now makes that visible. I checked the draft grammar (`protocols/drafts/treasure-maps.md:330`): bare
  `39998` means "my Concept Graph — my DList headers and the items filed under them". So `39998` alone does cover
  Concepts and the rule is correct. Not a finding.
- **Stacking:** in Edit mode, with a panel open under the card, the open picker list is drawn above it. I checked the
  topmost element at a point where they overlap (`elementFromPoint`), for Scores and for Lists.
- **Phone widths beyond D8:** at 375 px in Edit mode, with all three panels open, a pick on two cards, the backup switch
  on and an override on, sideways scroll is **0 px**. At 320 px the page scrolls sideways by 23 px, caused only by the
  top bar's user-menu avatar, which is outside the diff and existed before it (see story 1's review, Non-blocking 2).
- **Scale:** a Map with 60 Assistants on one key renders 60 rows, and the name lookup chunks as 50 + 10. The cards still
  appear.
- **Error paths:** a failed names lookup settles and the backups fall back to shortened npubs (D4, E1). A Map read error
  draws no cards and so no toggles (D3).
- **Collateral:** see Non-blocking 3.

## Concept-graph integrity
- [x] No concept definitions or handles are touched, so there's nothing to reinstall.

## Things tests can't catch
- [x] No secrets, debug logging, `.only`/`.skip`, TODOs or commented-out code. No hex-key literal in `ui/`.
- [x] Keys and relays are rendered as React-escaped text, never as links or HTML, so a hostile relay string is inert.
- [x] Row `key={i}` is acceptable here: rows hold no state, and a key may name one Assistant twice (E5).

## House rules check
- [x] No new tooling. No TA-pubkey use. The Concept Graph API is not involved.

## Product-guide adherence
- N/A (no PRD; acceptance frame).

## Findings

### Blocking
None.

### Non-blocking
1. **The three toggles share one name, and nothing ties a closed toggle to its card** (`Index.jsx:240–249`).
   - My accessibility snapshot shows three buttons named "Show details", each with no `aria-describedby` and no
     `aria-label`. Once open, `aria-controls` names "Scores details", but a closed toggle names nothing.
   - This page has already met the same finding twice: treasure-map-edit #3, non-blocking 3, and #4, non-blocking 1.
     Both were fixed with the card title in `aria-describedby`.
   - Optional: `aria-describedby={titleId(card.key)}`. One line; it keeps the visible words.
2. **Two of the panel's text colours are under 4.5:1.**
   - The label chips ("Backup", "Individually assigned", "Everything else"; `styles.css:10285–10288`) are
     `--text-muted` on `#f0f1ee`: **4.18:1** at 10 px bold.
   - "No entries yet." (`:10277`) is `--bsd-faint` on white: **3.12:1**.
   - Both copy existing rules on this page: `.bsd-tm-edit-badge` (`:10364`, the same 4.18:1) and `.bsd-tm-cat-none`
     ("Not assigned yet", `:10261`). So they are consistent with the page, and story 2 has no contrast AC.
   - Story 1 held its pill to 4.5:1. Suggest an `OPEN.md` row to lift the page's chips and faint text together.
3. **Widening the name lookup also widens when the cards go back to the loading line** (`Index.jsx:502–505`, `535–537`,
   `546–547`).
   - Since this story, `wantedKey` includes backups.
   - So a newer Map that only adds a backup never looked up before now makes `namesReady` false until the lookup
     settles. Examples are a newer Map shown at Save (book decision 19, the SV12/SV13 paths) or a later read.
   - Meanwhile the body becomes the loading line, which unmounts the cards and closes any open panel.
   - Before this story only a new *counted* Assistant did that.
   - I derived this from reading the code and did not exercise it. Its impact is low and the path is rare. AC-5's
     guarantee (Edit starting or ending) isn't affected.

### Harness friction
1. The template's `gate:status` line has no Light-without-full-suite form. This is the same item as story 1's review;
   one `meta` row covers both.

## Verdict
**PASS**

**Owner's Gate B verdict (2026-10-08):** PASS, after non-blocking 1 (each toggle described by its card's title) from this review, and non-blocking 4 (the pill's `--orange` token) from review 1, applied in `c41782f7` with their tests; the scoped gate (exit 0), all 134 browser tests and lint were re-run green afterwards. The other findings are ledger rows `2026-10-09-treasure-map-muted-text-contrast`, `2026-10-09-unseen-backup-reloads-cards` and `2026-10-09-light-gate-b-no-gate-status`; the 320 px top-bar overflow is the existing row `2026-10-08-top-bar-scrolls-sideways-at-320`.

## On PASS (same commit — applied by the spawning session)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed. The result goes in the chat, never in this file. `/close-book` is offered if the
  book looks complete.
