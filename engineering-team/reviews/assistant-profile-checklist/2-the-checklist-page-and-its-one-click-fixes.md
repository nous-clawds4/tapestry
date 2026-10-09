# Review: Story 2 — The checklist page at `/assistant/profile`, and its one-click fixes

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git show 224ea3b` + `git show d5aa730` on `staging` (local, unpushed). Tests: `a0c4d8b`, `ef81af6` (the
one-writer W5 re-aim).
**Story:** `engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md`
**ADR:** `engineering-team/decisions/assistant-profile-checklist/0002-the-checklist-page-fixes-through-the-one-writer.md`
**Test plan:** `engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (`GATE_LABEL=reviewer-profile-checklist`), read with `npm run gate:status -- --label reviewer-profile-checklist`:

  ```
  20261009T163208Z-6889-0b67 [reviewer-profile-checklist] started 2026-10-09T16:32:08.630Z on d5aa7309 — FAIL, exit 1, 5294 passed, 1 failed, 582 skipped, 285/285 suites; failed: harness-lint · /home/user/tapestry/tmp/gate-runs/20261009T163208Z-6889-0b67.json
  ```

  The only failure is `harness-lint`, with the single pre-existing `VIOLATION L10 commit:695fac4` (another session's
  2026-10-03 harness commit, not this book's). This story's suites: `assistant-profile-checklist-page` 14/0/0 and
  `one-writer-assistant-profile` 17/0/0.
- [x] Playwright (chromium), built UI at `http://localhost:7799` (200; `dist/` current with HEAD's `ui/` and
  `src/lib/`, checked with `git diff fadd699 HEAD -- ui/ src/lib/`). Ten specs: **119 passed, 3 skipped, 0 failed**.
  `assistant-profile-checklist-page.spec.js`: 19 ✓ (C1–C13, AV1–AV6). The 3 skips are assistant-management-page B8
  for the three built action pages, by design.
- [x] _Lint, typecheck and build not configured; skipped._

## Spec adherence

| AC | Tests (plan IDs) | Result |
|---|---|---|
| AC-1 the page | D1, D2; C1, C13 | pass |
| AC-2 who sees what | D2; C2 | pass |
| AC-3 states and words | P2–P7; C3, C4, C5 | pass |
| AC-4 one-click fixes | P8, P9, D3; C6, C7, C8, C10, C11 | pass, but see **B1**: an untested press-time path breaks "a fix never changes a field its item is not about" |
| AC-5 honest results; one at a time | P10, D3, D4; C6, C9, C12 | pass |
| AC-6 re-checked | D3; C6, C12 | pass |

- [x] Every acceptance criterion has a passing test.
- [ ] No criterion is silently dropped. AC-4's "never" fails on the press-time read-failure path (B1).
- [x] No behavior added that isn't in the story.

**Copy:** I compared `PROFILE_CHECKLIST_COPY` (`ui/src/pages/assistant/profileChecklistCopy.js:18-116`) line by line
with story 2 § Copy (page and all seven panels: titles, descriptions, done lines, every reason's line, every fix label)
and story 3 § Copy. They match verbatim. The three lines no story names (`requestFailed`, `couldNotCheck`,
`profileUnreadable`) are the Identification Tags page's existing words, as ADR 0002 directs and the test plan records.

**Accessibility:** each panel is a `<section aria-labelledby>` named by its `h2` (`ProfileChecklist.jsx:61-69`). The
screen-reader prefix sits beside the heading (Deviation 2, accepted: AC-1 asks for the prefixes, not their position),
and results are `aria-live="polite"` (`:163`).

## Walk of the diff (story 2's files)

- `ui/src/pages/assistant/profileChecklistCopy.js`: pure, no imports (P1).
  - `panelState` `:142-149` follows ADR 0002 sub-decision 2.
  - `panelLine` `:152-169` gives no line for `no-profile` (the notice says it) and uses the shared line for
    `no-public-address`.
  - `fixFor` `:190-206` follows sub-decision 4: no fix for no public address, no profile, local-only or no relays,
    unfinished, done, the avatar or the banner.
  - `applyProfileFix` `:218-243` returns exactly the seven fields, as sub-decision 5 specifies, **including its
    fallback `base = status.hasProfile ? profile : defaults` at `:225`** (see B1).
  - `describeProfilePublish` `:249-259`: a non-success answer is never ok, and no answer gives the request-failed line.
- `ui/src/pages/assistant/ProfileChecklist.jsx`:
  - `runFix` `:103-127`: one status read for `user.pubkey`, compose, one POST to the one writer with
    `{ customerPubkey, content }`, report, then `setFixing(null)` and `refresh()` whatever happened.
  - One `fixing` state disables every button (`:155-162`, `:173`, `:188`, `:195`, `:238`).
  - The notice shows only when `action.hasProfile === false` (`:235`), so never on `null` (unreadable).
  - Visitors and viewers with no Assistant get `phase: 'idle'` (`:89`): no states, no fixes.
  - The editor link is the action's own `editLink` (`:259-263`).
- `ui/src/App.jsx:135, :151`: `profile: <ProfileChecklistPage />` in `ACTION_PAGES`, beside the outbox book's entry.
  The merge is clean.
- `ui/src/styles.css:10489-10503` (comment at `:10489`, rules `:10491-10503`): the page reuses `.bs-idtags-card*` (Deviation 1; the ADR allowed whichever diff
  was smaller). It adds a neutral badge and a few layout rules, and C13 passes at 375 px.
- `BIBLE.md:1127` (§14): "the profile checklist's one-click fixes … call with the published fields and only their
  own field changed". That is accurate except on the B1 path.
- `test/one-writer-assistant-profile.test.js` W5 (`ef81af6`): the allowed posters are now exactly the editor and
  `ProfileChecklist.jsx`. This is ADR 0002 Option A, it keeps the guard's strictness (an exact list), and I accept it.

## ADR adherence
- [x] Files match ADR 0002's implementation notes. Nothing in `src/` changed for this story.
- [x] One writer: the page posts only to `POST /api/assistant/publish-profile`. No new signing route.
- [x] No new dependencies.

## Concept-graph integrity
- [x] No concepts touched, and no firmware reinstall is needed.

## Things tests can't catch
- [x] No secrets, no TA pubkey literal, no debug logging, no commented-out code.
- [ ] **Read-modify-write correctness: fails on the press-time read-failure path (B1).**
- [x] Concurrency within the page: one fix at a time. The cross-tab race with the editor is ADR-accepted.
- [x] POV: the only pubkey sent is `user.pubkey`, and the one writer checks it against the session.

## House rules check
- [x] Concept Graph API authority respected. No new tooling.

## Findings

### Blocking

1. **ui/src/pages/assistant/ProfileChecklist.jsx:108-113** (with **profileChecklistCopy.js:225**): a press can
   replace the Assistant's whole profile with the default.

   **Failure path:**
   - `runFix` trusts the press-time `GET /api/assistant/status` read's `hasProfile` to choose the base of every fix.
     That endpoint resolves the profile with the non-strict default local scan (`src/api/assistant/index.js:418` →
     `src/api/assistant/profileState.js:45`).
   - In that scan, a failed or timed-out `strfry scan` resolves `null`, which means "no local profile". The status read
     then asks the publish relays, or returns the 5-minute negative memo.
   - For a profile the checklist says is `only-here`, the relays hold nothing by definition, so the status read
     answers `hasProfile: false, profile: null`.
   - `applyProfileFix` then builds the content from `status.defaults`. "Publish to outside relays", "Republish to
     register my NIP-05", "Republish from {domain}", "Set website to {url}" and "Fill in the default …" all post the
     default name, About, picture, banner and lightning address.
   - The one writer signs that and imports it locally first. The Assistant's real kind 0 is replaced (a replaceable
     event, so the old one is gone), then the replacement goes to every outside relay.

   **Why it blocks:** this breaks story 2 AC-4 ("with every field as it is published now … A fix never changes a field
   its item is not about") and BIBLE §14's new sentence. It also re-opens the hazard this epic designed out elsewhere:
   ADR 0001 sub-decision 2 made the check's scan strict precisely because "a broken local relay reads as 'no profile'",
   and story 1's Deviation 1 keeps the page from offering the default on a read failure. The press path brings both
   back, and it can't be undone. ADR 0002 sub-decision 5 and the test plan's P9 case ("no profile at press time: the
   default is the base") sanction the default base inside the pure function. What they missed is that the press-time
   `hasProfile: false` can be a false negative from a failed read.

   **Asked change:**
   - In `runFix`, after the status read and before `applyProfileFix`, publish only when the read agrees with the press:
     - `status.hasProfile === true` for every fix except `publish-default`;
     - `status.hasProfile === false` for `publish-default`.
   - Otherwise publish nothing, show the "nothing was published" result (the existing `requestFailed` line, or wording
     the Product Owner approves), and still `refresh()`. If the profile really did disappear, the refreshed answer
     shows the no-profile notice, whose "Publish the default profile" is the story's own path.
   - The pure `applyProfileFix` and P9 may stay as they are.
   - Because this narrows ADR 0002 sub-decision 6, step 2, record it as a short ADR 0002 amendment (Architect).
   - Add a Tester-lane pin. For example, a browser case where "Set website" meets a status mock answering
     `hasProfile: false`: no POST to `/api/assistant/publish-profile`, the nothing-published line on the panel, and the
     attention answer asked again.
   - The same guard also closes story 3's `set-picture` publish, which goes through this `runFix` (`:152`).

### Non-blocking (OPEN.md / ledger candidates)
1. **ui/src/pages/assistant/profileChecklistCopy.js:177**: when an answer arrives without a `profile` action (an older
   server), `summaryText` says "Checking…" indefinitely, while every panel reads could-not-check (`panelState` `:146`).
   AC-3 reserves "Checking…" for an answer still on its way. Use `couldNotCheck` when `phase === 'answered'` and there
   is no action.
2. **ui/src/pages/assistant/ProfileChecklist.jsx:183-191**: on a dev box the preview still offers "Publish this
   avatar", although the avatar panel already says it can't be done there. Pressing it stores a composite that can
   never be published (ADR 0003 sub-decision 9 allows this). Hiding the button when `instance.isPublic === false`
   would avoid the dead file.
3. The editor's private `RELAY_WORDS`, `relayOutcomeText` and `publishResultTone` now duplicate `relayLine` and
   `publishTone`. This is debt ADR 0002 already notes; it belongs in the book-close audit.

### Harness friction
1. None beyond story 1's note on the gate-label variable name in the hand-off brief.

## On PASS
- Not applicable: CHANGES_REQUESTED. Status flips and the commit are the main session's, per the brief.

## Verdict
**CHANGES_REQUESTED**
