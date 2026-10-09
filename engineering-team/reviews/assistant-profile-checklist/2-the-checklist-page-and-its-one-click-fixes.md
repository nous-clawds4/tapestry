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

## Round 2 (2026-10-09): B1, re-reviewed as fresh claims

**Diff:** `git diff fabd2cb5..323140e2`. It holds:
- `844911e2`, round 1's review commit (with story 1's Done flip);
- `23673871`, ADR 0002 Amendment 1;
- `97d69cf4`, the Tester's pins C14, C15 and AV7, plus both plans' round-1 records;
- `323140e2`, the guard: +4/−1 in `ui/src/pages/assistant/ProfileChecklist.jsx`.

HEAD is `323140e2`. The branch was rebased onto `origin/staging` `0ee7e350`. `git range-diff 03e7e66..d5aa730 0ee7e350..fabd2cb5` shows both round-1 commits as `=` (`224ea3b` → `4850c93f`, `d5aa730` → `fabd2cb5`), so the rebase changed nothing I reviewed.

### What I re-ran
- **Commit hygiene and scope.**
  - `23673871` touches only the ADR. `97d69cf4` touches only the spec and the two test plans. `323140e2` touches only `ProfileChecklist.jsx`, and no test.
  - `git diff --stat fabd2cb5 HEAD`, excluding reviews, stories, decisions, the spec and the page, is empty. Nothing in `src/`, `bin/` or `BIBLE.md` changed, and no other `ui/` file.
  - The added lines have no `console.`, `debugger`, `TODO` or `.only(`.
- **The pins failed first.**
  - Setup: a worktree at `97d69cf4`, with `node_modules` and `ui/node_modules` symlinked; `npx vite build --outDir <scratch>/dist-pre`, served on 7801 with the scratch static server. `/home/user/tapestry/dist` was untouched (mtime 18:43:41 before and after).
  - Chromium: C14, C15 and AV7 **fail**, each on the nothing-published line, because the pre-fix page published and reported success. Their positive siblings C6, C10 and AV2 pass (3 failed, 3 passed).
  - The worktree is removed and the 7801 server stopped.
  - The plans' records name `dc67d8e`, which is the pre-rebase review commit. Its `ui/` differs from `97d69cf4`'s only by the rebase base (`ui/src/pages/settings/RelaySettings.jsx`), so the record holds.
- **Browser on HEAD.**
  - `dist/` was built at 18:43:41, a minute after `323140e2` (18:42:43). `git diff 323140e2 HEAD -- ui/ src/lib/` is empty, and the bundle contains the guard (`hasProfile===!1` / `hasProfile===!0`).
  - The five specs, chromium, against `http://localhost:7799`: **58 passed, 0 failed**. By spec:
    - `assistant-profile-checklist-page` 22 (C1–C15, AV1–AV7);
    - `assistant-profile-check` 5;
    - `my-assistant-page` 18;
    - `ta-composite-avatar` 5;
    - `assistant-default-profile` 8.
- **`npm test`.** `npm run gate:status -- --label reviewer-profile-checklist-r2`:

  ```
  20261009T185827Z-7445-b6b9 [reviewer-profile-checklist-r2] started 2026-10-09T18:58:27.150Z on 323140e2 — FAIL, exit 1, 5393 passed, 1 failed, 582 skipped, 288/288 suites; failed: harness-lint · /home/user/tapestry/tmp/gate-runs/20261009T185827Z-7445-b6b9.json
  ```

  - `bash scripts/harness-lint.sh | grep VIOLATION` prints only `VIOLATION L10 commit:695fac48`, another session's harness commit. No other suite fails.
  - This book's suites:
    - `assistant-profile-checklist-page` 14/0/0;
    - `one-writer-assistant-profile` 17/0/0;
    - `assistant-profile-check` 33/0/0;
    - `my-assistant-page` 31/0/0;
    - `assistant-stamped-avatar-for-everyone` 19/0/0;
    - `stamped-composite-avatar` 13/0/2 (live-probe skips, no stack).
  - The totals grew from round 1's 285 suites with the rebase base.
- **The guard's expression, evaluated** over twelve inputs (a node one-liner copying `:112-113`):
  - It stops on `hasProfile` false, missing, `null` or the string `"true"`, on `success: false`, and on no answer.
  - It stops `publish-default` on `hasProfile: true`.
  - It posts on `{ success: true, hasProfile: true, profileSource: 'relay' }`. See R2-1.
- **My probes** (scratch; nothing published):
  - **Node.** It runs the real `readVisibility` and `evaluateProfileItems` (`src/api/assistant/profileChecklist.js`) and the real `resolveAssistantProfileState` (`src/api/assistant/profileState.js`), with the local scan stubbed to fail, then HEAD's guard expression and the real `applyProfileFix`.
    - **Setup:** this instance holds v2 (created_at 2000); one outside relay holds v1 (created_at 1000).
    - **The check:** `visible` is `only-here` with `relaysHolding: 0`.
    - **The press-time read:** `hasProfile: true`, `profileSource: 'relay'`, `profile` = v1.
    - **The result:** the guard posts, and `republish` and `set-website` compose v1's fields.
  - **Browser** (a scratch spec outside the repo, against HEAD's build on 7799). The attention answer has `visible: only-here`. The status answer has `hasProfile: true`, `profileSource: 'relay'` and an older profile. "Publish to outside relays" **posted** `{"name":"Old Bot (before the latest edit)","about":"old about",…}`.

### Each changed claim, checked with its own command
| Claim (ADR 0002 Amendment 1, and the fix) | Command | Result |
|---|---|---|
| The press-time read "resolves the profile with the non-strict local scan … a failed or timed-out `strfry scan` reads as 'no local profile'" | `profileState.js:41-47` (`exec`, 10 s timeout; an error or empty output → `null`), `:143` | **True** |
| "for an `only-here` profile the publish relays hold nothing either" | `profileChecklist.js:132-134` (`holding` counts only relays answering with a kind 0 **at least as new as** this instance's), `:201` (`only-here` = `holding === 0`); the node probe | **False.** An `only-here` profile can have an older copy on every outside relay. The sentence is round 1's own (B1: "the relays hold nothing by definition"), carried into the amendment (roles/reviewer.md step 10). See R2-1. |
| "The read then answers `hasProfile: false`, sub-decision 5 takes `status.defaults` …" | `profileState.js:150`, `:166-171`, `:183` | **Partly true.** That holds when the outside relays hold nothing or the 5-minute negative memo answers. When they hold an older copy, the read answers `hasProfile: true` with that copy (`:183`, source `'relay'`). |
| Every fix but `publish-default` needs `hasProfile === true`; `publish-default` needs `=== false`; anything else stops | `ProfileChecklist.jsx:112-113`; the input table | **True** |
| Stopped: nothing posted, the line on the panel or notice, `fixing` cleared, `attention.refresh()` | `:114` (`describeProfilePublish(null)`), `:127-129` (after the `try`/`catch`, on every path); C14, C15, AV7 | **True** |
| "The guard lives in the page's `runFix`, the one place a press reaches the writer", so `set-picture` is covered | The page's only POST to `/api/assistant/publish-profile` is `:117`, after the guard. Its callers: `fixButton` `:161`, the notice `:241`, and `publishAvatar` `:155`. AV7. | **True** |
| "Sub-decision 5 is unchanged" | `profileChecklistCopy.js` has no diff since round 1 | **True.** The default base at `:225` is now reached from `runFix` only by `publish-default`, which returns the defaults anyway. That is consistent with "callers that have already established there is no profile". |
| "the press path is the second read and needs the same care" as ADR 0001 sub-decision 2's strict scan | `:108-113`: the read is still non-strict, and the guard reads only `hasProfile` | **Not yet true.** A read that fell back to the outside relays is still trusted. R2-1. |
| No contradiction with sub-decisions 5 and 6 | the ADR text | **True.** It adds one stop to 6, step 2. Sub-decision 4's "when `action.hasProfile === false` … the notice" is consistent with it. |

### The pins, audited
- **`log.publish` sees every POST the page can make to the writer.** The route `**/api/assistant/publish-profile` is the page's only writer URL. It is registered after the catch-all, so it handles the request (Playwright matches the last-registered route first).
- **No late-POST window.** `runFix` awaits the POST's answer before `setResults` and `refresh()` (`:117-129`). So any POST from the press is logged before the result line renders and before `log.attention` can rise, and the `toEqual([])` runs after both.
- **C14 also asserts that the press read the status.** C15 and AV7 do not. Their nothing-published line and refresh still prove nothing was posted.
- **C15's notice locator** is `main .bs-profile-check-notice`, a class hook that only the notice carries (`:239`). If the class is renamed, the test fails rather than passing falsely, so the locator is acceptable.

### The reused line, judged
"This instance did not answer; nothing was published." for a read that answered but disagreed:
- The first clause is imprecise. The second is honest: nothing is published, and the refresh then corrects the panels.
- In B1's own case, this instance's relay really did fail to answer.
- C15's realistic case is a profile that appeared between the answer and the press (another tab, an accepted race). There the refresh removes the notice.
- It does not mislead about the outcome, so it is non-blocking. A dedicated line is a story 2 § Copy change for the Product Owner, as the amendment says.

### Findings

#### Blocking
1. **R2-1. `ui/src/pages/assistant/ProfileChecklist.jsx:112`: the guard trusts a press-time read that fell back to the outside relays. A transient local-scan failure can therefore still overwrite the Assistant's newest profile, here and everywhere, now with an older copy rather than the default.**

   **Failure path:**
   - **The state.** The check marks `visible` `only-here` when no outside relay that answered holds a kind 0 at least as new as this instance's (`src/api/assistant/profileChecklist.js:132-134`, `:201`). Suppose an Assistant was published once and edited since, and that edit's outside publish failed (or local-only mode was on). Then the outside relays hold the older copy. That is exactly the state in which the panel offers "Publish to outside relays". The other panel fixes and `set-picture` can be pressed in the same state.
   - **The read.** At the press, the status read's non-strict local scan fails (`src/api/assistant/profileState.js:45` → `null`). The read asks the publish relays (`:151-163`). No negative memo applies, because the relays are not empty. It finds the older copy and answers `hasProfile: true`, `profileSource: 'relay'` (`src/api/assistant/index.js:430-432`), with the older content as `profile`.
   - **The publish.** The guard sees `hasProfile === true` and goes on. `applyProfileFix` composes from the older copy (`profileChecklistCopy.js:225`). The one writer signs it with the current time (`index.js:264`) and writes it here first (`:277`). Because a kind 0 is replaceable, that replaces the newer profile on this instance's relay. The writer then sends it to every outside relay.
   - **Shown by my probes above,** node and browser.
   - **The same risk as B1.** It needs B1's precondition (a transient failure of the non-strict scan at press time). It is just as irreversible, and reaches as far.

   **Why it blocks:**
   - **Story 2 AC-4.** "with every field as it is published now … A fix never changes a field its item is not about": the panels read the newer profile, and the press reverts fields to the older copy.
   - **BIBLE §14's sentence** (`BIBLE.md:1128`, "only their own field changed") is again untrue on this path.
   - **Principle 4 / BIBLE §30.** An outside copy replaces this instance's own.
   - **The amendment.** Its premise (the second row above) and its closing claim (the eighth row) are not true.

   **Asked change:**
   1. **Architect:** correct Amendment 1's account of what `only-here` means, and close the relay-fallback path.
      - The smallest shape: every fix except `publish-default` also needs `status.profileSource === 'local'`, a field the status answer already carries (`index.js:432`).
      - B1's `hasProfile: false` has a `null` source, so B1 stays closed.
      - Alternatives the Architect may prefer:
        - a strict press-time read (a server change);
        - the attention answer carrying the checked event's id or `created_at`, for the press to match.
      - State the cost: if a profile's copy home keeps failing, it can't be fixed from this page. The one writer's local-first write would most likely fail then too.
   2. **Tester:** a failing browser pin, in its own `test:` commit.
      - For example: the attention answer has `visible: only-here`; the status answers `hasProfile: true`, `profileSource: 'relay'`, with an older profile. Then "Publish to outside relays" posts nothing, shows the line, and asks again.
      - `statusAnswer` already sets `profileSource: 'local'` whenever `hasProfile` (`test/helpers/profileChecklistFixtures.js:288`), so C6–C8, C12 and AV2 keep their positive path.
   3. **Implementer:** the condition at `:112`.

#### Non-blocking
- **R2-2. The reused line** (judged above): honest about the outcome. Optional Product Owner copy.
- **R2-3. Pins.** C15 and AV7 do not assert that the status was read. Two inputs stop correctly (the input table) but have no pin: a missing `hasProfile`, and `success: false` at press time. Optional.
- **R2-4. The plans' round-1 records** name `dc67d8e`, which no longer exists on the branch, instead of `97d69cf4`. Re-confirmed above. Optional.
- **Round 1's non-blocking 1–3 stand unchanged,** and none got worse.
  - 1: `profileChecklistCopy.js:177`.
  - 2: now `ProfileChecklist.jsx:186-194`, three lines lower.
  - 3: the editor's duplicates.

#### Harness friction
- **Step 10 did its job here.** Round 1's failure path asserted a definition ("by definition") without citing the line that defines it, and the amendment copied it. A failure path's premises are claims too, so cite their source line when writing them. No new rule is needed.

### Story status and completion (round 2)
- [ ] Story `**Status:**` not flipped: it stays `Approved`.
- [ ] Completion detection not performed: stories 2 and 3 are not Done.

### Verdict (round 2)
One ask: R2-1. Close the relay-fallback path at `ProfileChecklist.jsx:112` (Architect, then Tester, then Implementer), and correct Amendment 1's `only-here` premise.
- Everything else in the fix is verified above and stands: the `hasProfile` stop, the line, the refresh, the coverage of `set-picture`, and the three pins.
- Round 3 needs the new pin failing first, then the five specs and the gate.

**CHANGES_REQUESTED**

## Round 3 (2026-10-09): R2-1, re-reviewed as fresh claims

**Diff:** `git diff 18cddc6c..f3666583`, three commits on top of round 2's review commit:
- `e1750e00`, ADR 0002 Amendment 2, with Amendment 1's false premise marked in place (`0002-…md:248-249`);
- `b5ce4a2d`, the pin C16, `log.status` assertions added to C15 (`spec.js:376`) and AV7 (`:389`), and both plans' records;
- `f3666583`, the condition: +6/−3 in `ui/src/pages/assistant/ProfileChecklist.jsx`.

HEAD is `f3666583`. `git fetch origin staging` leaves `origin/staging` at `0ee7e350`: `git log HEAD..origin/staging` is empty, it is an ancestor of HEAD, and `git merge-tree --write-tree HEAD origin/staging` is clean (the book's "Shared lines" check).

### What I re-ran
- **Commit hygiene and scope.**
  - `e1750e00` touches only the ADR. `b5ce4a2d` touches only the spec and the two test plans. `f3666583` touches only `ProfileChecklist.jsx`, and no test.
  - `git diff --name-only 18cddc6c HEAD` lists exactly those five files. Nothing in `src/`, `bin/`, `BIBLE.md`, `test/` or any other `ui/` file changed.
  - The added lines have no `console.`, `debugger`, `TODO` or `.only(`.
- **C16 failed first.**
  - Setup: a scratch worktree at `b5ce4a2d`, with `node_modules` and `ui/node_modules` symlinked; `npx vite build --outDir <scratch>/dist-pre`, served on 7801 with the scratch static server. The pre-fix bundle has no `profileSource==="local"`.
  - Chromium, `-g "C14|C15|C16|AV7"`: **C16 fails** at `spec.js:404`, where the nothing-published line on the visible panel is never shown. C14, C15 and AV7 pass (1 failed, 3 passed). This matches the plan's record (`test-plan.md:95-105`).
  - A scratch probe on the same build (the spec's own `mock()`, C16's fixture) shows what it posted: `{"name":"Alice Bot (before the latest edit)","about":"An older About text.",…}`. That is the older copy, as the record says.
  - In the same worktree, `f3666583`'s `ui/` built into `<scratch>/dist-head` is **byte-identical** to `/home/user/tapestry/dist` (sha256 of every file).
  - The worktree is removed (`git worktree list` shows only the main checkout), both scratch builds are deleted and the 7801 server is stopped. `/home/user/tapestry/dist` was not rebuilt.
- **Browser on HEAD.**
  - **`dist/` freshness.** `dist/` (mtime 19:19:16) predates the impl commit (19:19:25), and `git diff f3666583 HEAD -- ui/` is empty only because HEAD *is* `f3666583`. So I checked the content:
    - the bundle has the new condition (`M.hasProfile===!0&&M.profileSource==="local"`);
    - it is byte-identical to a fresh build of HEAD's `ui/`.
  - The five specs, chromium, against `http://localhost:7799`: **59 passed, 0 failed, 0 skipped**. By spec:
    - `assistant-profile-checklist-page` 23 (C1–C16, AV1–AV7);
    - `assistant-profile-check` 5;
    - `my-assistant-page` 18;
    - `ta-composite-avatar` 5;
    - `assistant-default-profile` 8.
- **`npm test`.** `npm run gate:status -- --label reviewer-profile-checklist-r3`:

  ```
  20261009T194027Z-7490-ea43 [reviewer-profile-checklist-r3] started 2026-10-09T19:40:27.637Z on f3666583 — FAIL, exit 1, 5393 passed, 1 failed, 582 skipped, 288/288 suites; failed: harness-lint · /home/user/tapestry/tmp/gate-runs/20261009T194027Z-7490-ea43.json
  ```

  - `bash scripts/harness-lint.sh | grep VIOLATION` prints only `VIOLATION L10 commit:695fac48`, another session's harness commit. The run record's only non-PASS/SKIP suite is `harness-lint.test.js`. `strayErrors` is empty.
  - This book's suites:
    - `assistant-profile-checklist-page` 14/0/0;
    - `one-writer-assistant-profile` 17/0/0;
    - `assistant-profile-check` 33/0/0;
    - `my-assistant-page` 31/0/0;
    - `assistant-stamped-avatar-for-everyone` 19/0/0;
    - `stamped-composite-avatar` 13/0/2 (live-probe skips, no stack).
  - The totals equal round 2's, as expected: the round-3 diff adds no node test.
- **My probes on HEAD** (scratch, outside the repo; the spec's `mock()` and `open()` copied verbatim; nothing real published): 15 passed.
  - **Every `runFix` caller stops on a non-local read.** For each of `nip05` republish, `client-tag` republish, `set-website` and `fill-name-about`, a status answer with `profileSource` `'relay'`, missing, or `null` (each with `hasProfile: true` and an older profile) posts nothing. The panel shows the line, the attention answer is asked again, and the status was read.
  - **The visible panel's republish** (C16's fixture) logs 0 status reads before the press and 1 after. `log.publish` and every non-GET `/api/` request are empty, 1.5 s after the refresh.
  - **`set-picture`** ("Publish this avatar") with `'relay'`: the composite is stored (`store: 1`) and nothing is posted.
  - **Positive control:** with `'local'`, the visible panel's republish posts the published fields unchanged.
- **The real status handler, branch by branch** (node, scratch). It drives `createAssistantStatusHandler` with the real `resolveAssistantProfileState`, stubbing only strfry, the relays and the key store, then applies HEAD's guard expression. See the table below.

### Each changed claim, checked with its own command
| Claim (ADR 0002 Amendment 2, the fix, and the plans) | Command | Result |
|---|---|---|
| "`only-here` means no outside relay answered with a copy *at least as new* as this instance's (`readVisibility`); an outside relay can still hold an older one" | `profileChecklist.js:132-134` (`created_at >= since`), `:200-201` (no answer gives `unreachable`; else `only-here` when `holding === 0`) | **True** |
| "When the non-strict local scan fails at press time, the status read falls back to the publish relays, finds that older copy and answers `hasProfile: true`, `profileSource: 'relay'`" | `profileState.js:45-46` (failure → `null`), `:155-168`, `:183`; `index.js:432`; the handler probe (local `null`, relays `[v1]` → `{hasProfile:true, profileSource:"relay", name:"v1 older"}`) | **True** |
| "Amendment 1's guard lets it through, and any panel fix, `set-picture` included, republishes the older fields … here and on every outside relay" | the pre-fix build posted the older copy (probe); the writer signs with `created_at` = now (`index.js:264`) and imports it locally first (`:276-287`), so the newer local kind 0 is replaced | **True** (at `b5ce4a2d`) |
| The status answer's `profileSource` in every branch | the handler probe: a local hit → `'local'`; local fails, relays hold v1 → `'relay'` (also when the copy home throws); relays empty → `null`; the negative memo → `null`; no relay key → `null` (`index.js:406`); an anonymous read → `null` (`profileState.js:146`); the key store or the scan throws → `success: false` (`index.js:446-447`) | `'local'` comes **only** from a successful local scan (`profileState.js:142-143`). There is no positive cache or memo: the only memo is the miss memo (`:149-150`), which answers `null` |
| `'local'` never accompanies content other than this instance's newest kind 0 | `profile` and `profileSource` come from one `state` (`index.js:431-432`). strfry keeps one kind 0 per author: an older import is refused, and a `created_at` tie keeps the lowest id (the repo's own record, `src/api/concept/bDisposition.js:140-143`) | **True** by strfry's rule. Two edges: a same-second tie (R3-3) and a wiped or restored local relay. In the restored case the check reads the same local copy, so base and panels agree, which is principle 4's local-first rule. Neither edge is this diff's |
| "the base must be this instance's own copy, the one the check read (ADR 0001 reads the local relay first and strictly)" | `profileChecklist.js:246-251` (the resolver with `strictNewestKind0`, `:65-71`), `:248` (`allowRelayFallback: true`) | **True in the steady state; imprecise at two safe edges.** (1) When the local relay held no kind 0, the check read the relays' copy and copied it home (`profileState.js:177-182`). The press's `'local'` base is that copy, and if the copy home failed the press is refused. (2) A profile published from another tab between the check and the press becomes the base (the accepted race). Its fields are newer than the check's, never older. R3-1 |
| Every fix but `publish-default` needs `hasProfile === true && profileSource === 'local'`; `publish-default` needs `hasProfile === false`; a relay or missing source stops the press | `ProfileChecklist.jsx:113-117`; the handler probe's guard column; my probes (`'relay'`, missing, `null`) | **True** |
| A stopped press: nothing posted, the line, `fixing` cleared, the answer asked again | `:116-117`, `:130-132` on every path; C14, C15, C16, AV7 and my probes | **True** |
| "What it costs": a local failure with a current outside copy is refused too, and a later press works | the handler probe (a `'relay'` answer is refused whatever its age); the next read's local hit is `'local'` | **True as far as it goes.** It leaves out the cost round 2 named: a copy home that keeps failing, so the check offers fixes the press refuses. That costs nothing in practice, because the writer's own local-first write (`index.js:276-287`) would fail in that state too. R3-2 |
| "Matching the checked event's id, or a strict press-time read on the server … both need more than this page" | the attention answer carries no event id or `created_at` (`profileChecklist.js:226-233`); the status read's scan is non-strict (`profileState.js:38-56`) | **True** |
| Amendment 1's premise "marked where it stands" | `0002-…md:248-249`: "*(wrong: they may hold an older copy — corrected by Amendment 2)*" | **True.** The rest of Amendment 1 holds. Its "the press path is the second read and needs the same care" is now met in effect: a failed non-strict scan can no longer pass as `'local'` |
| The plans' records: C16 failed "on `18cddc6c`", C14, C15 and AV7 passed; round 1's `dc67d8e` maps to `844911e2` / `97d69cf4` | `git diff 18cddc6c b5ce4a2d -- ui/ src/lib/` and `git diff 844911e2 97d69cf4 -- ui/ src/lib/` are both empty; my pre-fix run | **True** |

### The guard, for every caller, and a hunt for a third way in
- **Every path to the writer is behind it.** The page's only `fetch('/api/assistant/publish-profile')` is `ProfileChecklist.jsx:120`, after the check at `:113-117`.
  - Its callers: `fixButton` (`:164`; republish ×3, set-website, fill-name-about), the notice (`:244`; publish-default) and `publishAvatar` → `runFix('avatar', 'set-picture', …)` (`:158`).
  - `makeAvatar` and the store only call `my-picture` and `avatar`.
  - Repo-wide, the only other UI caller is the editor (`AssistantProfileEditor.jsx:241`), which W5 allows and ADR 0002 leaves unchanged.
- **Can the base still differ from what the check evaluated?** I checked each route the brief names.
  - **A local event that is not the newest.** strfry holds one kind 0 per author (row 5 above). The `limit: 1` first line (`profileState.js:39`, `:50`) is therefore that event.
    - The outside relays can only hold copies this instance signed. The writer imports locally first and sends outward only on success (`index.js:276-287`). So a newer outside copy with an older local one needs a wipe, a restore or a same-second tie.
    - On a restore, the check also evaluates the local copy (`profileChecklist.js:65-71`), so base and panels agree.
  - **strfry's replaceable kind 0.** The copy home (`profileState.js:177-182`) of an older relay copy is refused while the newer one is held. If the newer one is really gone (a wipe), the refused press's refresh re-checks against what is now local, so panels and base agree again. A wipe itself is BIBLE §30's concern, not this page's.
  - **A republish from another tab or the editor between check and press.** The status read returns the newer local copy and the fix changes only its own field. The base is newer than the panels, never older. That is narrower than the editor's own race, which uses a base read at page load.
  - **The copy-home race with a later read.** A press-time read that falls back answers `'relay'` and is refused, whether or not its copy home lands. The next read is `'local'` only if strfry now holds a kind 0, and that kind 0 is what the refreshed check reads.
  - **The one writer.** It merges nothing. It takes the seven string fields as sent (`index.js:249`), drops `nip05` and empties, then sets the NIP-05 and client tag (`profileDefaults.js:226-234`). The page's base is the whole profile, which is why the source check matters. With it, the base is always this instance's own copy.
  - **An HTTP-cached status answer.** Nothing sets freshness headers on `/api` (`docker/nginx.conf`, `src/api/index.js`), so a cached answer is only ever revalidated.
  - **The same Assistant everywhere.** The check (`attention.js:270` → `getAssistantPubkeyFor` → `getAssistantKeys`), the status read and the writer resolve the Assistant from the same session pubkey.
  - **`publish-default`'s own edge.** A transient scan failure *and* a profile published from another tab, both inside the press window, would let the default through (the handler probe's "relays empty" row). That is two independent events inside the accepted cross-tab race. Far-fetched, and not worse than the editor's "Reset to defaults".
- **Result:** I found no remaining realistic path. The two far-fetched ones are noted (R3-3, and `publish-default`'s edge above).

### C16, audited
- **It proves nothing was posted.** `log.publish` records every request to the page's only writer URL, whose route is registered after the catch-all.
  - On the guard path `runFix` makes no second fetch: the line is rendered, then `refresh()` runs (`:116-117`, `:130-132`). So no POST can follow the line, and the `toEqual([])` at `:407` runs after both.
  - My probe also saw no non-GET `/api/` request at all, 1.5 s after the refresh.
- **"The press read the status" is not vacuous.** Nothing on `/assistant/profile` reads `/api/assistant/status` before a press. `useAssistantSetupState` is mounted only by the Dashboard. The probe logged 0 status reads before the press and 1 after. The same holds for the assertions added to C15 (`:376`) and AV7 (`:389`).
- **The fixture is realistic.** `{ ...statusAnswer({ profile: older }), profileSource: 'relay' }` gives `success: true`, `hasRelayKey: true`, `hasProfile: true`, the older profile and the defaults. That is the real handler's relay branch (`index.js:425-435`), apart from `computedNip05`, which no `statusAnswer` carries and `applyProfileFix` never reads. The attention answer is `PROFILE_ALL_FIXABLE`, whose visible row is `only-here` with 3 answered and 0 holding: R2-1's state.

### Findings

#### Blocking
- None. R2-1 is closed: `ProfileChecklist.jsx:113-115` refuses any base that is not this instance's own copy. C16 failed first and now passes, and every caller is covered (probes).

#### Non-blocking
- **R3-1. `0002-…md:288-289`, "the one the check read".**
  - This holds in the steady state.
  - When the local relay held no kind 0, the check read the relays' copy and copied it home. When another tab republished in between, the base is newer than what the check read.
  - Both edges are safe: a refusal, or a newer base. Optional: "this instance's own copy, which is what the check reads when the local relay holds one".
- **R3-2. `0002-…md:293-297`, the cost paragraph.**
  - It leaves out the cost round 2 asked to have stated: a copy home that keeps failing, where the panels offer fixes the press refuses. That costs nothing in practice, because the writer's local-first write would fail too.
  - The paragraph also has a stray hard-wrap ("Matching / the checked event's id, or / a strict…"). Optional.
- **R3-3. `src/api/assistant/index.js:264`, pre-existing and not this diff's.**
  - The one writer signs with `created_at = floor(now/1000)` and no `prev + 1` skew. Compare `bDisposition.js:140-144`, which records strfry's lowest-id tie-break for exactly this reason.
  - Two publishes in the same second can leave the later one dropped locally. I could not check whether `strfry import` then exits non-zero: there is no stack here.
  - Through this page it needs two full press round-trips inside one second, and the re-check would show the item still unfinished. The editor has the same property. An OPEN.md candidate, at most.
- **R2-2** (the reused line) still stands, and is slightly better: in R2-1's case the local relay really did not answer, so "This instance did not answer" is now accurate there too.
- **R2-3** is partly addressed: C15 and AV7 now assert the status read. A missing `hasProfile` and a press-time `success: false` still have no pin. Optional.
- **R2-4** is addressed: both plans now map `dc67d8e` to its post-rebase commits.
- **Round 1's non-blocking 1–3 stand unchanged,** and none got worse.
  - 1: `profileChecklistCopy.js:177`, no diff.
  - 2: now `ProfileChecklist.jsx:189-197`, three lines lower.
  - 3: the editor's duplicates.

#### Harness friction
- **The brief's freshness check for `dist/` was vacuous here.** It asked for `git diff f3666583 HEAD -- ui/` plus `dist/`'s mtime, but HEAD is `f3666583`, and `dist/` was built nine seconds *before* the impl commit. Taken literally, the mtime reads as stale. A content check (grep the bundle for the changed expression, or a hash-identical scratch rebuild) is the reliable test. A note for future hand-off briefs; no repo doc is wrong.

### Story status and completion (round 3)
- [ ] Story `**Status:**` not flipped here. Per the brief, the main session flips it to Done, and commits, after the user's gate.
- [x] Completion detection performed. The result is in the hand-off message, not in this file (template rule).

### Verdict (round 3)
- R2-1 is closed by `ProfileChecklist.jsx:113-115`, with Amendment 2 recording it.
  - Amendment 1's premise is corrected in place.
  - C16 failed first, against `b5ce4a2d`'s build, and passes on HEAD.
  - My probes cover every `runFix` caller.
- The five specs (59/0/0) and the gate (only the pre-existing `harness-lint` L10) are clean.
- The remaining notes (R3-1 to R3-3) are wording or pre-existing, and none blocks.

**PASS**
