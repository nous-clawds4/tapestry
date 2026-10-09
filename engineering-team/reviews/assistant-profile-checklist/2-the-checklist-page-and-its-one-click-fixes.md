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
