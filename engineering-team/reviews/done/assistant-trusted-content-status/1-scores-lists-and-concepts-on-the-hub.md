# Review: Story 1 — Scores, Lists and Concepts on the hub

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git diff origin/staging...HEAD` at `ffc15aa2`, merge-base `79f17935`, on branch `feat/assistant-trusted-content-status`. That covers 30 files: the source, the docs and the tests. The Phase 3 tests are `410b43fd`, the implementation is `053f6784`, and `ed58fc80` merges origin/staging, which brings in assistant-outbox-relays #1–#3. The Phase 4 Tester-lane commits are `d555beff`, `05bc85f9`, `3274f627` and `ffc15aa2`. During the review, `origin/staging` moved to `03e7e665`, a ledger-only change (`ledger/2026-10-09-treasure-map-card-details-branch-cleanup.md`). `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0).
**Story:** `engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md`
**ADR:** `engineering-team/decisions/assistant-trusted-content-status/0001-scores-lists-and-concepts-join-the-one-attention-answer.md` (Accepted)
**Test plan:** `engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** in the worktree on a clean tree at `ffc15aa2`, label `review-tcs1`. `npm run gate:status -- --label review-tcs1`:

  > `20261009T162409Z-77985-ea65 [review-tcs1] started 2026-10-09T16:24:09.844Z on ffc15aa2 — FAIL, exit 1, 5615 passed, 152 failed, 87 skipped, 286/286 suites; failed: profile-tags, profile-tags-publish, …` (39 suites)

- [x] **The staging baseline.** I exported `git archive origin/staging` (`79f17935`) to a scratch directory, symlinked its `node_modules`, and ran `npm test` there afterwards, not in parallel. Label `review-tcs1-baseline`:

  > `20261009T171010Z-60866-d501 [review-tcs1-baseline] started 2026-10-09T17:10:10.150Z on an unknown commit — FAIL, exit 1, 5581 passed, 153 failed, 90 skipped, 285/285 suites` (39 suites)

  **Comparison, suite by suite (pass/fail/skip counts from both logs):**
  - Both runs fail 38 of the same suites.
  - The branch adds `assistant-trusted-content`: **30 passed, 0 failed, 0 skipped**.
  - Every suite this diff touches has identical counts on both runs: `assistant-attention` 39/0, `assistant-management-page` 24/0, `assistant-alert` 15/0, `assistant-outbox-check` 29/0, `assistant-identification-tags-page` 16/0, the nine `manage-treasure-map-*` / `treasure-map-*` suites, `treasure-map-needs-attention` 6/0, `treasure-map-card-details` 17/0, `treasure-map-edit-mode` 48/0, `stack-free-npm-test` 6/0/1, and `assistant-profile-check` 3/30.
    - In `assistant-profile-check`, the three passes are C4, D1 and D2, the hub's Done look. They come from staging (outbox-relays), and the other 30 wait for the profile book's own check.
  - The two differences are environmental:
    - `not-yet-shared-filter` H2 fails on the branch and skips on the baseline. It is a live test against the stack that serves the main checkout, and whether it runs or skips depends on the shared graph's state. The implementer's runs on `053f6784` and `d555beff` also show it failing. It belongs to shared-concepts-seeding and is unrelated to this diff.
    - `gate-result-record` A2 fails on the baseline only, because a `git archive` export has no `.git` (`git status --porcelain` fails).
  - The other count changes inside suites that pass or fail on both runs are all live or skip drift: `capture-a-goal-and-see-it`, `shared-by-me`, `state-on-concept-page` and `strfry-write-assertion-bracket`. `trusted-dictionary` H4 (`fetch failed`) fails on both.
  - **No regression.**

- [x] **Playwright, chromium,** against `<worktree>/dist` served at :4173. Before running, I confirmed the build is current:
  - `dist/index.html` is dated 11:19:59, after the merge at 11:19:05, and no `ui/` or `src/` file changed after that.
  - The page :4173 serves names `assets/index-CETbPmsg.js`, whose `CHECKED_ACTIONS` literal is the merged five-key list. The bundle contains the moved category rule (`"3038x"…`, `dlist-header`), so Vite resolves the cross-boundary `.mjs` import.
  - I did not rebuild, and no preview restart was needed.

  Results:
  - **Batch 1** (`assistant-trusted-content`, `treasure-map-save`, `assistant-management-page`, `assistant-alert`, `assistant-attention`, `assistant-profile-check`): **66 passed, 4 failed, 3 skipped**.
    - TC1–TC5 ×3 and SV1–SV17 all pass.
    - The three skips are `assistant-management-page` B8 for the three pages that are no longer placeholders.
    - The four failures are `assistant-attention` B4 (pill expected 5, got 6) and `assistant-profile-check` B1, B2 and B5.
  - **Browser baseline.** I built `origin/staging`'s UI in scratch (`assets/index-BehwcsfW.js`, :4180) and ran `assistant-profile-check` and `assistant-attention` against it: **the same four fail** (B4, B1, B2, B5) and 8 pass. All four are pre-existing.
  - **Batch 2** (`manage-treasure-map-cards`, `manage-treasure-map`, `treasure-map-card-details`, `treasure-map-edit`, `treasure-map-needs-attention`, `treasure-map-switches`, `my-assistants-map`, `assistant-outbox-relays`, `assistant-identification-tags-page`): **126 passed, 0 failed**. The rule's move left the Treasure Map page unchanged.
- [x] **Mutation checks**, all on a scratch `git archive HEAD` copy. The worktree was never edited, and it was clean at the end (`git status --short` empty).
  - **Node mutants.** 15 mutants, each killed:

    | Mutant | Killed by |
    |---|---|
    | Mixed not done | U2, U11 |
    | Any Assistant counts | U1, U3, U4, U11 |
    | Unfinished read as pending | U10, U11 |
    | No `allSettled` isolation | A2 |
    | Map read for the Assistant, not the viewer | U1–U9, U13, A4 |
    | Own relay not excluded | U7, U10 |
    | Wrong rule path | 11 tests, including U13, A4, S1 |
    | `dlists` dropped from `CHECKED_ACTIONS` | C1, C2 |
    | An `import` in the rule module | R1, R2, R3, U*, A4 |
    | The page keeps its own `categoryAssistants` | R2 |
    | No 10040 re-ask | D1 |
    | 10040 by anyone | S4 (*not* D1; see Non-blocking 3) |
    | `useTreasureMap` imported in the provider | S4 |
    | A second 10040 in the provider | S4 |
    | 10040 in `topBarAlert.js` | S4 |

  - **SV17's teeth.** I built a UI without the provider's 10040 line (scratch, :4179). SV17 fails there at "the attention answer is asked again after the save" (`Received: 1`, expected > 1). Navigating hub → card page → `/treasure-map` does not re-ask on its own, so the listener is what SV17 measures.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations).
- [x] `src/api/openapi.yaml` parses (`js-yaml`). The attention item schema carries `category`, `reason` and `source` alongside the outbox and identification-tags fields.
- [x] **The server's loader from plain CommonJS:** `require('./src/api/assistant/trustedContent').loadCategoryRule()` resolves to the module with `TREASURE_MAP_CATEGORIES, appliesTo, categoryAssistants, categoryEntries, entryOf` on Node v22.22.0. The container runs v22.22.2 (`docker exec tapestry node --version`; `Dockerfile:14` installs `setup_22.x`). `Dockerfile:92` copies the whole tree before `:98` builds the UI in place, and `.dockerignore` excludes neither `src/lib` nor `ui/src`. So the production build resolves the relative `.mjs` import, and the image ships the file the server `import()`s.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ (The Vite build of the cross-boundary `.mjs` succeeds; see above.)

## Spec adherence
- [x] Every acceptance criterion has a passing test.

  | AC | Verdict | Evidence |
  |---|---|---|
  | AC-1 the names | Met | `ui/src/pages/assistant/actions.js:86-126` sets the titles Scores / Lists / Concepts, the § Copy criteria verbatim and `editLink: TREASURE_MAP_LINK`. Keys, paths, descriptions and NIP links are byte-unchanged. `ActionPage.jsx:21,26,33-34` (unchanged) renders title, criteria and link. Tests: C4, C5; re-aimed `assistant-management-page` D2/D4 (24/0); TC1; TC5 ×3 (each link opens `/treasure-map`); `assistant-management-page.spec` B1, B8 ×3. |
  | AC-2 one answer, the viewer's own, read-only | Met | `attention.js:277-315`: the viewer comes from the session only, and `getAssistantPubkeyFor(viewer)` is the same resolver `/api/assistant/my-assistants` uses for `/treasure-map`'s `local` (`myAssistants.js:175`). `trustedContent.js:77` uses `lookupNewest({ kind: 10040, pubkey: viewer, relays: treasureMapRelays(deps) })`, `/setup`'s read (`status.js:132,243`), with the strict `scanLocal` (`attention.js:66`). Visitors and no-Assistant viewers get `actions: {}` before any check runs. The answer comes in the one existing request, and no pubkey appears in it. Tests: U7, U8, U12, A1 (query parameters naming a stranger are ignored), A3, S1, S2. |
  | AC-3 the rule | Met | One rule. `src/lib/treasureMapCategories.mjs` is the old `manageTreasureMap.js:158-280` block moved verbatim; a diff shows the only change is `CATEGORIES` → exported `TREASURE_MAP_CATEGORIES`. `manageTreasureMap.js` imports it by relative path and re-exports the four functions by identity (R2). `evaluateTrustedContent` (`trustedContent.js:47-68`) is sub-decision 4's table. Tests: R1–R3, U1–U5, U9, U11, U13, U14, A4. |
  | AC-4 finished, as `/setup` means it | Met | The unfinished branch carries the lookup's reason and is neither done nor pending (`trustedContent.js:51-53`). An unreadable local relay never falls through to outside relays (`status.js:137-141`). Tests: U6, U10 (all three reasons), TC3. |
  | AC-5 the hub reads it | Met | `CHECKED_ACTIONS` keeps `ASSISTANT_ACTIONS` order (`actions.js:248`). `assistantAttention` (`:267-288`, staging's) gives both readings and `done`, and never marks a placeholder Done. The Done look (`Index.jsx:35-45`, `.is-done` CSS, `ASSISTANT_COPY.done` / `doneSrPrefix`) is staging's, from outbox-relays, built to the same ADR text. Tests: C1–C3, D2, A2, TC2–TC4; profile-check C4/D1/D2 pass. |
  | AC-6 it catches up | Met | `AssistantAttentionContext.jsx:77` refreshes on a kind 10040 by the viewer, with no polling. The provider keys each result to its request and cancels stale fetches (`:41,51-64`), so a slow first answer cannot overwrite the re-ask. Tests: D1, SV17 (verified against a mutant build), and the narrowed S4. |

- [x] No criterion is silently dropped. The story's "reasons are in the answer, no reader sees them" holds: nothing in `ui/` reads `reason` or `category` for these keys.
- [x] No behaviour beyond the story. The FAQ words, the card addresses and `/treasure-map`'s own pill are unchanged.

### The Phase 4 window's test changes (after `410b43fd`), judged one by one

- **`d555beff`: legitimate re-aim.** `treasure-map-edit-mode` W4 and `treasure-map-card-details` S1 keep their assertions word for word and read the file the rule moved to. R2 pins that the page re-exports the very same functions, so nothing is lost.
- **`05bc85f9`: legitimate fixes of the Tester's own bugs.**
  - TC4 now expects the accessible name the page really produces. `ASSISTANT_COPY.needsAttentionSrPrefix` is `'Needs attention: '` (`actions.js:209`); the shared fixture has no trailing space.
  - SV17 now saves under `external`/`accept`, so it ends at SV2's confirmation. The judge, "the attention answer is asked again", is unchanged and still bites (mutant build above).
- **`3274f627`: S4 narrowed; legitimate, and it still has teeth.**
  - treasure-map-card-details #1 AC-7 reads "Nothing else moves … `/assistant`, the Assistant top-bar alert and its count are untouched (the count doesn't learn about the Treasure Map)". That is a scope boundary for that Light story, not a product invariant.
  - This story is owner-approved (book Decision 1, story AC-5). It deliberately makes the count reflect the Map, *through the server's answer*, and its Background names the intended difference from `/treasure-map`'s pill. A later approved story superseding an earlier story's "untouched" boundary is the normal case.
  - The narrowed pin keeps the boundary's substance: the alert files still never read or interpret the Map, and the provider's only 10040 is the exact re-ask form. Mutants 12–15 above each fail it.
- **`ffc15aa2` and the merge's test hunks (`ed58fc80`): legitimate.**
  - `assistant-outbox-check`'s and `assistant-attention`'s fakes stub `checkTrustedContent` with `{}`, so those suites read no Treasure Map relay. Neither suite asserts an exact key set, so the stub hides nothing they judge. The three keys are judged by A1–A4.
  - The browser mocks add the three as pending (`TC.withTrio`), which marks and counts them exactly as placeholders did, so the other suites' counts hold.
  - `assistant-attention.spec` B4 moves 8 → 5, the end state once the profile book lands too. It fails identically (6 against expected 5) here and against expected 8 on staging, as the story's Deviation says.
- Earlier, in Phase 3 (`410b43fd`), `assistant-profile-check` C3's "placeholder that says done" moved from `trusted-lists` to `bounties`. That is correct now that `trusted-lists` is checked.

## ADR adherence
- [x] Files changed match the ADR's implementation notes:
  - sub-decision 1: rule module, import-free, re-exported;
  - 3: `/setup`'s `lookupNewest` + `treasureMapRelays`, with `mapDefaultRelays` defined exactly as `status.js:47`;
  - 4: shape;
  - 5: `loadCategoryRule` memoizes and clears the memo on rejection (`trustedContent.js:31-39`), as the test plan's "Not covered" item asks;
  - 6: `Promise.allSettled` with outbox, and an identification-tags rejection is still rethrown;
  - 7–9: as specified.

  BIBLE §11 row, its "Last updated" entry, and the dated note in assistant-management #1 § Copy are present.
- [x] Layering: the server never `require`s a UI module, and the shared rule lives in `src/lib/`. `actions.js` keeps exactly one import (C5).
- [x] No new dependencies. `.mjs` plus a dynamic `import()` is the ADR's sanctioned "two firsts", pinned by R1 and U13.

## Concept-graph integrity
- [x] No concept handles are touched (the Treasure Map is a kind 10040 event, not a graph node).
- [x] No firmware reinstall is needed, since no concept definitions changed. The story and ADR both say so.
- [x] N/A: no concept orientation in new code.

## Things tests can't catch
- [x] No secrets, no TA literal (S1 and a diff scan), no `console.log` or `debugger`, no TODOs. The one `console.error` is the deliberate failure log (`attention.js:268`).
- [x] No commented-out code.
- [~] Error paths: the realistic runtime failures (the `.mjs` failing to load, a settings read throwing inside `mapDefaultRelays`, relay timeouts) are isolated. One narrow hole is described in Non-blocking 2.
- [x] Concurrency: the provider's request-keyed result handles a re-ask racing a slow first answer. The 8 s worst case on a local miss is the ADR's accepted cost and runs in parallel with the other checks. The provider has no client timeout that could undercut it.
- [x] Security and POV: whose Map and which Assistant come from the session only. Nothing is written. Principles 1, 3 and 4 hold: the answer is re-derived per request and read-only.

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint, typecheck or build tooling. `ui/vite.config.js` is unchanged; a relative ES-module import needs no alias.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] No PRD; the book uses an acceptance frame. The words match the story's § Copy verbatim: titles, the three criteria sentences, "Manage your Treasure Map →", **Done** / "Done: ".
- [x] N/A: no designed states beyond the existing hub's.

## Findings

### Blocking
None.

### Non-blocking
1. **`engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md:144-147`: the first Deviation is stale since the merge `ed58fc80`.**
   - It says "The hub's Done look was built here first … this story added `assistantAttention`'s `done`, `ActionCard`'s `done` prop and marks, `ASSISTANT_COPY.done` / `doneSrPrefix` and the `.bs-assistant-hub-card.is-done` rule".
   - Against the shared line, this diff adds none of them. `git diff origin/staging...HEAD -- ui/src/pages/assistant/Index.jsx ui/src/styles.css` is empty, and `actions.js`'s diff adds no `done` field or copy. The merge took assistant-outbox-relays' build of the same design.
   - Book close harvests Deviations into the as-built record, so this sentence would credit the wrong book.
   - **Fix in the review commit (the orchestrator edits this file anyway):** the Done look was first built here at Phase 4, and on merging origin/staging the shared line's identical build from assistant-outbox-relays #1 was kept, so the shipped diff adds none of it.
2. **`src/api/assistant/attention.js:265-275`: the `check-failed` fallback re-`require`s `./trustedContent` to get the keys.**
   - If `trustedContent.js` itself fails to load, the default `checkTrustedContent` rejects (isolated). The fallback's `require` then throws again, and the whole answer becomes a 500.
   - I verified this on a scratch copy: as built, status 200 with all five keys; with a `throw` at the top of `trustedContent.js`, status 500, "Could not check assistant attention".
   - That breaks sub-decision 6's letter. Only a code defect the suite catches immediately can trigger it, and the realistic runtime failure, the `.mjs` load, *is* isolated (U13, A2).
   - Optional: a frozen local constant, as `OUTBOX_CHECK_FAILED` (`:58`) does for outbox.
3. **`test/assistant-trusted-content.test.js:582`: D1's "the viewer published it" regex is satisfied by the tagging rule's existing `ev.pubkey !== pubkey`, within 200 characters of the 10040 check.**
   - So `if (ev.kind === 10040) { refresh(); … }` (any author) passes D1.
   - It is caught only by the narrowed `test/treasure-map-needs-attention.test.js` S4, which demands the exact `ev.kind === 10040 && ev.pubkey === pubkey` form. The pair holds today.
   - Whoever next relaxes S4 should tighten D1 at the same time.
4. **`src/api/assistant/attention.js:39`: the header's response-shape line** still lists only `'identification-tags'` and `'outbox-relays'`. The prose paragraph above it (`:29-33`) does name the three keys. A doc nit.
5. **Optional cross-reference.** treasure-map-card-details #1 AC-7 (`engineering-team/stories/done/treasure-map-card-details/1-needs-attention-pill.md:36-37`) has no dated "superseded in part by assistant-trusted-content-status #1" note. assistant-management #1 § Copy got one, and the reason lives only in `test/treasure-map-needs-attention.test.js:170-174` and this story's test plan.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **Parallel-book merges can make a story's Deviations untrue, and nothing re-checks them.** The book's § Shared lines asks for `git merge-tree` before Implementation and Review, but not for reconciling a Deviation that claims "built here first" once a merge brings in the other book's identical build (Non-blocking 1). Candidate `meta` row: after merging a parallel book into a story branch, re-read that story's Deviations against `git diff origin/staging...HEAD`.
2. **The profile book's own browser test cannot pass as written, independent of this diff.**
   - `tests/brainstorm/assistant-profile-check.spec.js` B2 expects the pill at `PLACEHOLDERS + 1` with `PLACEHOLDERS = X.ACTIONS.length − 2`. Its mocks carry no `outbox-relays` answer, and a checked action with no answer is never counted.
   - So it reads 9 against 10 on staging today, on this branch, and also after assistant-profile-checklist #1 lands. assistant-outbox-relays' merge re-aimed the other shared specs but not this one.
   - Not this diff's doing: `TC.withTrio` is count-neutral there, and the same failure reproduces on the staging build. Flag it for the profile book's Implementer.
3. **A `git archive` baseline (the brief's recommended method) always fails `gate-result-record` A2**, which needs a `.git` to read HEAD. Worth one line wherever the baseline recipe is documented, so the next reviewer doesn't read it as a regression.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result and any book arithmetic recorded in the run journal (Direction) or the chat (human-gated) — never in this file. `/close-book` offered if the book looks complete.

## Addendum — merge of assistant-profile-checklist (b3f9d615), 2026-10-09

**Reviewer:** Claude (acting as Reviewer), fresh context.
**Scope:** the merge commit `b3f9d615` only. Its parents are `131fdd94`, this branch at the PASS above, and `1229c154`, origin/staging. The staging parent brought assistant-profile-checklist #1–#3, and also relay-stream-gaps, the router-hardening follow-up and the assistant-outbox-relays book close. `git ls-remote origin refs/heads/staging` is still `1229c154`, so HEAD contains all of staging. The worktree was clean before and after, and nothing was committed.

### What the resolution touched
- `git merge-tree --write-tree --name-only 131fdd94 1229c154` lists exactly five conflicted files: `BIBLE.md`, `src/api/assistant/attention.js`, `src/api/openapi.yaml`, `tests/brainstorm/assistant-profile-check.spec.js` and `ui/src/pages/assistant/actions.js`.
- `git diff --name-only <that auto-merge tree 55301941> b3f9d615` lists the same five. Its `-U0` diff shows every change sitting inside a conflict hunk. There is no evil merge: every other file is git's own automatic merge.
- No conflict markers anywhere: `git grep -n -e '^<<<<<<< ' -e '^>>>>>>> '` is empty, and so is `^=======$` outside Markdown.

### The five, one by one
1. **`attention.js`**
   - `defaultDeps()` (`:73-89`) carries every book's dependencies: `checkOutboxRelays`, `checkProfile`, `mapDefaultRelays`, `loadCategoryRule` and `checkTrustedContent`. No key is duplicated.
   - No dependency names collide on the shared `d`. `profileChecklist.js` and `outboxRelays.js` read none of the trio's names. The trusted path (`setup/status` `lookupNewest`/`treasureMapRelays`) reads only `scanLocal`, `readRelay`, `getConfigFromFile`, `readConfiguredRelays` and `mapDefaultRelays`.
   - `:303-308` settles four checks with one `Promise.allSettled`. An identification-tags rejection is still rethrown (`:309`), and outbox, profile and the trio each fall back on their own.
   - **Probe:** a scratch script drove the merged handler with fakes.
     - All fulfilled: 200, six keys.
     - Only outbox rejects: only `outbox-relays` is `check-failed`.
     - Only profile rejects: only `profile` is `check-failed`.
     - Only the trio rejects: only its three keys are `check-failed`.
     - All three reject: each answers its own `check-failed`, and identification-tags is intact.
     - Identification-tags rejects: 500.
2. **`actions.js:248`**
   - `CHECKED_ACTIONS` is `profile, identification-tags, outbox-relays, trusted-assertions, trusted-lists, dlists`.
   - Imported in Node, it equals `ASSISTANT_ACTIONS` filtered to the checked keys: in order, with no duplicates.
   - `assistantAttention` with all six done gives count 5, alertCount 5 (the five real placeholders), and all six in `done`.
3. **`openapi.yaml`**
   - js-yaml parses it, and js-yaml throws on duplicate mapping keys. The action item schema has 14 distinct properties.
   - The `reason` description joins both sides' wording. `source` keeps this branch's wording, a superset of staging's.
4. **`BIBLE.md`**
   - There is one "Last updated" line. A programmatic check confirms it equals this story's entry, then `; prior: `, then staging's whole line body.
   - It has 23 `prior:` (staging's 22 plus one). The trusted-content, profile-checklist, outbox-relays and tagging-edges #5 entries each appear once.
   - The §11 attention row is staging's row plus the Scores/Lists/Concepts clause.
5. **`assistant-profile-check.spec.js`**
   - `:38-39` are staging's `CHECKED` (with `outbox-relays`) and `OTHERS_DONE`. `:72` wraps them as `TC.withTrio({ ...attention, actions: { ...OTHERS_DONE, ...attention.actions } })`.
   - A pending trio entry marks and counts exactly as a placeholder does. So `PLACEHOLDERS` (11 − 3 = 8) still equals the five real placeholders plus the trio, and the profile book keeps the counts it intended.

### Silent-merge collisions outside the five
- **Files both sides changed:** only the five, plus `test/registry.js`. The registry auto-merged cleanly: 292 entries, none duplicated, none missing on disk, every `test/*.test.js` registered.
- **Hub code:** the merge did not change `Index.jsx`, `AssistantAttentionContext.jsx` or `ActionPage.jsx`.
  - The new profile page uses the provider's `refresh()` (`ProfileChecklist.jsx:84,132`).
  - The provider's 10040 re-ask (`AssistantAttentionContext.jsx:77`) is untouched.
- **Fixtures:**
  - `assistantManagementFixtures.js` and `trustedContentFixtures.js` changed on this side only, and `profileChecklistFixtures.js` on staging's side only.
  - The profile page spec mocks attention without the trio, but it judges no hub or pill count.
  - No staging-side test or UI file names the trio's old card titles.
- **Build config:** the profile book's new Vite alias (`@tapestry/assistant-profile-items`) leaves the relative `.mjs` import alone.
- **Renamed route:** nothing on this branch's side refers to the old `/api/assistant/owner-avatar` route, now `/api/assistant/my-picture`.

### Evidence
- **Node suites,** each run with `require('./test/<f>.test.js').run()` in the worktree: 25 suites, **603 passed, 0 failed**:
  - this branch's suite: `assistant-trusted-content` 30;
  - the hub and outbox suites: `assistant-attention` 39, `assistant-management-page` 24, `assistant-alert` 15, `assistant-identification-tags-page` 16, `assistant-outbox-check` 29, `assistant-outbox-relays-page` 18;
  - the profile book's suites: `assistant-profile-check` 33 (3/30 at the PASS above), `assistant-profile-checklist-page` 14, `assistant-stamped-avatar-for-everyone` 19, `my-assistant-page` 31, `one-writer-assistant-profile` 17, `stamped-composite-avatar` 13;
  - the twelve `treasure-map-*` / `manage-treasure-map-*` suites: 31, 24, 17, 29, 48, 6, 18, 35, 22, 24, 17 and 34.
- **`npm test`,** worktree at `b3f9d615`, label `review-merge2`. `npm run gate:status -- --label review-merge2`:

  > `20261009T200711Z-77634-0a9c [review-merge2] started 2026-10-09T20:07:11.491Z on b3f9d615 — FAIL, exit 1, 5743 passed, 83 failed, 127 skipped, 289/289 suites` (34 suites failed)

  **Compared suite by suite with `20261009T162409Z-77985-ea65 [review-tcs1]`** (39 failed):
  - 28 suites fail on both runs.
  - **11 no longer fail.**
    - Six are the profile book's suites, now implemented.
    - Five are live-stack drift: `capture-a-goal-and-see-it`, `the-brain-survives`, `not-yet-shared-filter`, `concept-count-canonical` and `summaries-element-count`.
  - **6 newly fail. None is caused by this merge.**
    - `router-stream-limit-on-connect` is a new suite from staging's relay-stream-gaps.
      - P1–P3 fail with `sed: … invalid command code f`: `patches/strfry-router/apply-patches.sh:25` uses GNU `sed -i` on a macOS host.
      - A fresh `git archive 1229c154` export fails it the same way (23 passed, 3 failed, same tests).
    - Five live suites drive the :7778 stack, which serves the main checkout: `store-the-four-when-a-goal-is-captured-or-updated`, `b-coverage-audit-and-disposition`, `adoption-candidates-queue`, `inverse-queue-publish-candidates` and `publish-time-default-stamping`.
      - Their test files and helpers are byte-identical to the prior run's and to staging's.
      - Another session's gate (`hgi3-impl-baseline`, PID 82558) ran against the same stack throughout. The failures are fixture "already exists" collisions, a Neo4j `UpdateLock` conflict, `fetch failed` and timeouts.
      - Re-run one at a time after that gate ended: `store-the-four` passes 40/0. The other four fail one test each, but not the same tests as in the gate (`fetch failed`, timeouts, a failed `docker exec … curl`). The `tapestry` container was at 147% CPU at the time.
  - Every suite this branch or the merge touches has the same counts as before, except the profile book's six, which now pass: `gate-result-record` 34/0, `stack-free-npm-test` 6/0/1, `strfry-router-saved-state` 32/0, `router-config-reload-in-place` 41/0.
  - **No regression.**
- **Playwright, chromium,** at :4173.
  - **The served build is `b3f9d615`'s:**
    - the preview process is `vite preview --outDir <worktree>/dist`;
    - `dist/index.html` is dated 14:54:48, 22 s after the merge commit, and no `src/` or `ui/src/` file is newer;
    - the served `index-Dka3zj2z.js` contains the six-key `CHECKED_ACTIONS` literal, `dlist-header` (the moved rule) and `/api/assistant/my-picture`.
  - **Results:** `assistant-profile-check`, `assistant-attention`, `assistant-trusted-content`, `assistant-management-page`, `assistant-alert`, `assistant-profile-checklist-page` and `treasure-map-save` gave **93 passed, 0 failed, 3 skipped**.
    - The skips are `assistant-management-page` B8 for the three built pages: profile, identification-tags and outbox-relays.
    - The four failures the PASS above recorded as pre-existing (`assistant-attention` B4, `assistant-profile-check` B1, B2 and B5) now pass.
- `bash scripts/harness-lint.sh`: clean (0 violations).

### Findings

#### Blocking
None.

#### Non-blocking
1. **`ledger/2026-10-09-profile-check-spec-b2-outbox-count.md:6` is still `**Status:** OPEN`, but its bug no longer exists.**
   - Staging's `fabd2cb5` (assistant-profile-checklist #1) gave the spec `outbox-relays` in `CHECKED` and an `OTHERS_DONE` answer, and this merge brought that in. B2 passes on the `b3f9d615` build.
   - Shipped as it is, this row would land on staging as an open bug that isn't there. It is the stale-record failure that `2026-10-09-merge-stale-story-deviations` describes.
   - Flip it to DONE, pointing at `fabd2cb5` and this addendum, in the commit that records this addendum.
2. **`src/api/assistant/attention.js:10` reads "Three actions are checked, side by side".** That is staging's sentence, and the merge left it stale: there are now six actions from four checks.
   - The response-shape line at `:45` now lists `profile` and `outbox-relays` but not the trio.
   - Fold both into `ledger/2026-10-09-trusted-content-review-followups.md`, whose third bullet (`:17`) is half-stale now ("doesn't list `outbox-relays`").
3. **`src/api/openapi.yaml:297-298`:** "`actions` maps each action that has a real check to its answer: `profile`, `outbox-relays` and `identification-tags`."
   - Git auto-merged this from staging, and the enumerated list reads as exhaustive. The trio is described later in the same description (`:322`).
   - A doc nit.

Unchanged by the merge and still open as ledgered: Non-blocking 2 above (`trustedContentActions`' fallback re-`require`, now `attention.js:280`) and Non-blocking 3 (D1's loose regex).

#### Harness friction
1. **Two gates ran on one stack at once.** Another session's `npm test` (label `hgi3-impl-baseline`, worktree `.claude/worktrees/jolly-roentgen-e3780d`) started about three minutes after this one and shared the :7778 stack for the whole run. This is already known: ledger `2026-10-08-realtime-wrapper-timing-flake-under-load` and OPEN #194. No new row is needed.
2. **`router-stream-limit-on-connect` P1–P3 cannot pass on a macOS host.**
   - The cause is `patches/strfry-router/apply-patches.sh:25`, GNU `sed -i`. The image applies the patch on Linux (`Dockerfile:32`), so production is unaffected, but the suite fails here rather than skipping.
   - It belongs to relay-stream-gaps, not this book. Candidate row: a portable in-place edit (`perl -pi`, or `sed -i.bak` then remove the backup), or a skip with a reason when not on Linux.
3. **The scratch-baseline recipe can write into the main checkout.** `ln -s <main>/node_modules <dir>/node_modules` puts the link *inside* the main checkout's `node_modules` when `<dir>/node_modules` already exists. A self-referencing `/Users/clawds4/repos/nous-clawds4/tapestry/node_modules/node_modules` symlink is there now, dated 11:26 today, before this review. My own attempt into the shared scratchpad's existing `base/` hit it and failed with "File exists", creating nothing. Related: ledger `2026-10-09-judge-workspace-and-served-build` (judges share one scratchpad). Candidate fix: always use a fresh directory, and guard with `[ -e … ] ||`.

### Verdict
**PASS**
