# Review: Story manage-treasure-map #2 — The Assistants by category cards

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-07
**Diff:** `git diff 90e6a78 06c4738`, made up of the failing tests (`ccece6b`), the test-only amendment
(`git diff ccece6b f393b21`) and the implementation (`git diff f393b21 06c4738`). Branch `staging`.
**Story:** `engineering-team/stories/manage-treasure-map/2-the-assistants-by-category-cards.md`
**ADR:** `engineering-team/decisions/manage-treasure-map/0002-the-cards-count-with-their-own-rule-over-the-same-read.md`
(story 1's ADR 0001 for context)
**Test plan:** `engineering-team/stories/manage-treasure-map/2-the-assistants-by-category-cards.test-plan.md`, with its
Amendment
**Book:** `engineering-team/audits/manage-treasure-map/book.md` (decisions 7–9); blueprint in `blueprint/`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`: **PASS**. `npm run -s gate:status`:
  `20261007T035710Z-2004-6cae started 2026-10-07T03:57:10.586Z on 06c4738d — PASS, exit 0, 4970 passed, 0 failed, 581 skipped, 271/271 suites`.
  - The new suite: `manage-treasure-map-cards: PASS (31 passed, 0 failed, 0 skipped)`.
  - Story 1's suite: `manage-treasure-map-page: PASS (22 passed, 0 failed, 2 skipped)`. The 2 skips are the live
    H-class tests (no stack).
  - The `/assistants` neighbours are green: `my-assistants-page` 50/0 (2 skipped), `my-assistants-map` 14/0,
    `my-assistants-actions` 29/0, `my-assistants-nip05` 13/0.
  - Run on their own, the two story suites give the same counts: 31/0 and 22/0 (2 skipped).
- [ ] **Playwright** (chromium; built UI served statically on :7799, every API mocked). Suites:
  `manage-treasure-map-cards.spec.js`, `manage-treasure-map.spec.js`, `my-assistants.spec.js` and
  `my-assistants-map.spec.js`, 55 tests in all.
  - **Not reliably green.** I made 7 full runs; 3 passed 55/55 and 4 had a failure.
  - The failures I captured were C12 + T5b in one run (made while `npm test` ran alongside) and C10 in another.
  - Two more runs reported "54 passed". My output filter dropped their failure line, so I don't know which test failed.
  - All three captured failures have one cause, which I reproduced deterministically: Blocking 1.
  - I checked that `dist/` was built from `06c4738`: no file under `ui/src` is newer than `dist/index.html`, and the
    bundle contains the new section.
- [x] Reviewer's own probes. These were scratch files outside the repo, not committed.
  - Story 1's spec as it was at `ccece6b`, run against the new build: 11 passed, 4 failed (T5, T5b, T6, T13), all
    with `strict mode violation … resolved to 2 elements`. So the amendment was needed.
  - The amended spec (`f393b21`), run against a scratch build of `ccece6b`: 15/15. This confirms the Amendment's claim.
  - The amended T5 and T6 with their two end-state `toHaveCount(0)` checks put back page-wide: 6/6 (×3 repeats).
    See Non-blocking 4.
  - A race probe: hold `/api/auth/status`, open the raw viewer, then release. The viewer stays open on `ccece6b` (3/3)
    and snaps shut on `06c4738` (3/3). See Blocking 1.
  - The AC-2 rule run over 17 untested key shapes. See Non-blocking 1–3.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped (the Vite builds were only for the browser runs)._

## Spec adherence

- [x] **AC-1 (the section).**
  - `CategoryCards` renders between `<Faq />` and the raw viewer (`Index.jsx:256`), and only when the phase isn't
    `signed-out`.
  - It shows the `h2` heading, three cards in order and the Mixed line with a `Link` to
    `TREASURE_MAP_ADVANCED_PATH`, and has no edit controls.
  - Tests: C1 (order by bounding box, href, no Edit/Save/…), C8 (signed out), Node C1.
- [x] **AC-2 (the rule).** `categoryAssistants` (`manageTreasureMap.js:151–165`) matches every row of the story's
  example table (K1–K11) and the ADR's edges (K12–K20).
  - I checked `appliesTo` and `shadowed` (`:117–142`) against the story's text and ADR sub-decision 2: they match
    literally.
  - Against the draft grammar, the rule is narrower in three pathological shapes no app writer produces
    (Non-blocking 1–3).
- [x] **AC-3 (what a card says).**
  - The single, mixed (three avatars max, `· N Assistants`) and none states are covered by Node C2 and e2e C2 and C4.
  - Names go through the shared `cardFields`: display name → name → npub (Node C4, e2e C3). Avatar letters keep emoji
    whole (Node C5).
  - Purple vs navy is checked on the computed colour (e2e C2, C3). Long names at 375 px: C9.
- [x] **AC-4 (other states).**
  - Loading is held through the Map read and then the names read (C6), and never says "Not assigned yet".
  - On error, Try again brings the cards back (C7). With no Map, all three cards say "Not assigned yet" (C5).
- [ ] **AC-5 (story 1's findings).**
  - FAQ hide closes its answer: C11, `Index.jsx:75`.
  - The raw box takes focus, is named and scrolls with the arrow keys: C12, S3, `Index.jsx:100`.
  - **The raw viewer "starts closed for each viewer" is implemented with a remount key that also fires when sign-in
    settles for the same person. A viewer opened during that window closes by itself (Blocking 1).** That is a
    regression from story 1, and it makes C10, C12 and T5b flaky.
- [x] No behaviour beyond the story. View-only: the page signs, publishes and stores nothing (C13, T13, `safe()`).

## ADR adherence

- [x] **Sub-decisions 1–4.** Key parsing, `categoryAssistants`, `categoryCards` and the new words are implemented as
  written (`manageTreasureMap.js:31–46`, `:97–192`).
- [x] **Sub-decision 5.** One `fetchProfilesChunked` call on the union, with W1 (cards appear once, already named).
  - The ADR said to key the guard "on the event". The code keys it on the union string (`wantedKey`). That is a sound
    refinement: a re-read that names the same Assistants doesn't refetch.
  - `localPubkey` is `user.assistantPubkey || null`. There is no `taPubkey` and no literal key (S2; my grep of the
    added lines is clean).
- [ ] **Sub-decision 6.** `RawViewer` with a viewer key, which causes Blocking 1. The ADR's own `key={viewer}` has the
  same flaw: `null` → pubkey changes the key too. The fix needs a one-line amendment to this sub-decision.
- [x] **Sub-decision 7.** CSS is scoped under `.bsd-tm-cat*`, and the raw box's focus ring is under
  `.bsd-tm-raw-pre:focus-visible`.
  - I compared values with the blueprint's `tmbCats`, `av()` and `cardStyle`: 11 px/700/`#8c929e`/.06em labels,
    16 px radius, `#d6d9db` border, the `0 1px 3px` shadow, `16px 18px` padding, 17/13/14 px type, 22 px avatars
    overlapping −6 px with a 2 px white ring, and `#7237ff`/`#2b174f` through the page's variables.
  - No global `h2` rule overrides the heading's class.
- [x] **Sub-decision 8.** `cardFields` gains `export` and nothing else (`myAssistants.js:139`). `/assistants`
  behaviour is unchanged: its Node suites and 27 browser tests are green.
- [x] No new dependencies. The view-model stays free of React, `fetch`, signing and storage (story 1's V7 is green).

## Concept-graph integrity
- [x] No concept handles are touched.
- [x] Firmware reinstall: not required (the ADR says so; no concept definitions changed).
- [x] Orientation via `/summaries`: n/a (no concept work; the stack wasn't running at the ADR either).

## Things tests can't catch
- [x] No secrets. No `console.*`, `debugger`, TODO or commented-out code in the added lines.
- [ ] Concurrency / race conditions: **Blocking 1** (remount on the sign-in settle).
  - The names effect itself is sound. Cleanup cancels both the batch loop and the `setNames`. Names are keyed to the
    exact Assistant set, so a stale set is never shown. Try again re-reads the Map and re-runs the lookup.
- [x] Error paths: a failed name lookup falls back to npubs (`PROFILE_LOOKUP_FAILED`, plus a defensive `.catch`).
  A missing or garbage event gives three empty lists and never throws (K20).
- [x] Security: read-only. Keys and delegates come from a signed event and are only compared, never interpolated
  into a request. Profile reads are by validated 64-hex pubkeys.

## House rules check
- [x] Concept Graph API authority respected (n/a).
- [x] No new lint/typecheck/build tooling.
- [x] TA pubkey is never hardcoded. The local Assistant comes from the session. No `LEGACY_*` constant is touched.

## Product-guide adherence
- [x] The copy matches story § Copy verbatim, curly apostrophes included (W1–W3; checked by eye in `COPY`).
- [x] Designed states: loading, error with Try again, none, single and mixed.

## The amendment (`f393b21`), judged

- **Necessary: yes.** Story 1's original T5, T5b, T6 and T13 fail on the new build with strict-mode double matches,
  not on defects (my run).
- **Recorded: yes.** It is its own commit before any code, the test plan has an Amendment section, and the story has
  a Deviations line.
  - The amended spec passes 15/15 on story 1's code (my run). So it still judges story 1's code, and it didn't
    loosen anything to let story 2's code through.
- **Weakened anything?** The positive assertions (`toBeVisible`, `alert`/`status` text, the Try again click) are
  scoped, not weakened. In story 1, "on the page" and "in the raw viewer" were the same place.
  - Two end-state `toHaveCount(0)` lines were narrowed although they can't double-match (Non-blocking 4).
- **Process.** `templates/adr.md:37` puts suite re-aims in Phase 3, never Phase 4. The mitigations are real: done
  first, proven necessary, verified against story 1's code, and logged. I don't block on it. It is recorded below as
  harness friction, and the regression test Blocking 1 needs belongs to the Tester's lane.

## Findings

### Blocking

1. **`ui/src/pages/treasure-map/Index.jsx:264`** — `<RawViewer key={viewer || 'no-viewer'} …>` remounts the raw
   viewer when sign-in settles for the same person.
   - **Mechanism:**
     - While `useAuth().loading` is true, `mapPanelPhase` returns `'loading'` (`manageTreasureMap.js:92`), so the raw
       viewer's button shows and can be clicked, with key `'no-viewer'`.
     - `AuthContext` then makes three sequential requests before `setUser`: status, classification, own profile
       (`AuthContext.jsx:46–66`).
     - When `user` arrives, the key changes to the pubkey. `RawViewer` remounts, and the viewer the person opened
       snaps shut.
   - **Why it's a regression:** story 1 kept `rawOpen` in the page, so it survived (deterministic probe: stays open
     3/3 on `ccece6b`, closes 3/3 on `06c4738`).
   - **Why it misreads AC-5:** AC-5 asks for "starts closed *for each viewer*", and sign-in settling isn't a new
     viewer.
   - **What it does to the gate:** it is the cause of the flaky browser runs. C10 and C12, and story 1's T5b (green
     and stable before this story), each failed at least once in my 7 runs. Any test that opens the raw viewer right
     after `goto` is exposed: T3–T7, T12, T13, C10, C12, C13.
   - The ADR's `key={viewer}` (sub-decision 6) has the same flaw.
   - **Asked change:**
     - Keep the open state across sign-in settling. Reset it only on sign-out, or when the viewer changes from one
       known person to another. For example, key on the last *settled* viewer, or don't render the toggle until
       auth has settled. The mechanism is the Implementer's choice.
     - Amend ADR 0002 sub-decision 6 to say which.
     - Add a deterministic regression test (Phase 3, the Tester's lane): hold `/api/auth/status`, open the raw
       viewer, release, and assert it is still open. Keep C10's sign-out/sign-in check, which must still pass.
     - Then show the four browser suites green across several runs (I'd suggest `--repeat-each=3` at `--workers=4`).

### Non-blocking

1. **`ui/src/pages/treasure-map/manageTreasureMap.js:141`** — `*:<rest>` is shadowed only by `3038x:<rest>` exactly,
   not by a shorter covering key.
   - With `3038x:tag` → B and `*:tag:<X>` → D, the Scores card says Mixed (B, D). Under the draft's §6, `3038x:tag`
     wins every Score `*:tag:<X>` could reach, so D reaches no Score.
   - The same applies to `3038x:tag:` (a trailing empty segment, ≡ `3038x:tag` by §4.4).
   - This follows the story's enumeration ("`*:<system>` … `3038x:<same system>` … Every other applicable entry
     counts") and ADR sub-decision 2 literally. Nothing in `src/` or `ui/src` writes `*:` or family-wildcard keys, so
     only third-party Maps can hit it.
   - Since the ADR expects the Edit book to reuse `categoryAssistants`, file a follow-up: shadow by segment-prefix
     coverage (§4.4/§6) when the parsers are folded together.
2. **`manageTreasureMap.js:126`** — `*:…` applies to Scores and Lists regardless of what follows the colon.
   - `*:rank` (a metric scope, "Score kinds only", §4.7) counts on Lists.
   - `*:contexts` (Lists only, §4.3) counts on Scores.
   - This is per the story's wording ("`*:…` for Scores and Lists"); the draft is narrower. Same follow-up as 1.
3. **`manageTreasureMap.js:157–160`** — "Per key" means per exact key string. Two spellings of one key are therefore
   two keys, and both first delegates count:
   - `39998` and `39998:dlist-header` (the draft's §4.5 says "means the same");
   - `*` and `*:`.
   - Pathological; noted for the same follow-up.
4. **`tests/brainstorm/manage-treasure-map.spec.js:273` and `:295`** — the amendment also narrowed T5's and T6's
   end-state `toHaveCount(0)` checks to the raw box.
   - Count-zero checks can't hit strict mode, and page-wide they pass (6/6, my run). So "page-wide queries matched
     twice" (the test plan's Amendment, the story's Deviations, the commit message) isn't true of these two lines.
   - Optional: when the Tester touches the spec for Blocking 1, put these two back to `main(page)`. That is strictly
     stronger and green.
5. **`Index.jsx:163–173`** — the mixed card's visually hidden `<ul>` sits inside a `<span>` (flow content in
   phrasing content). Browsers and the accessibility tree tolerate it. Optional: make `.bsd-tm-cat-assignee` a `div`.
6. **`Index.jsx:115`/`:210` and `:121`/`:216`** — with the raw viewer open, the section and the viewer each carry a
   `role="alert"` (error) or `role="status"` (loading) with the same words, so screen readers may announce them twice.
   Optional: give the raw viewer's copy no live role while the section is showing.
7. **`Index.jsx:256`** — during sign-in settling, the section shows its loading line even for a person who turns out
   to be signed out, then vanishes. This is consistent with story 1's phase model and ADR sub-decision 5, and C8
   pins the end state. Noted only.

### Harness friction
1. **Re-aims of a neighbour suite made in Phase 4.**
   - The test plan promised story 1's suites stay green "unchanged". Its Phase-3 verification ran them against the
     *old* code, which can't reveal that new UI will duplicate an existing state line on the same page.
   - The Implementer then re-aimed four story-1 tests in Phase 4, contrary to `templates/adr.md:37`. It was well
     mitigated, but it was self-ratified.
   - Suggested `meta` row for OPEN.md: when a story adds UI that repeats an existing page's words or roles, Test
     Design should pre-scope the neighbour suite's page-wide queries (or flag them as needing a Phase-3 re-aim).
2. The Implementer's "×3 repeats 84/84" didn't surface the race, which shows up under parallel load. Not a process
   defect; noted for whoever re-runs.

## Verdict
**CHANGES_REQUESTED**

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. Not applicable: changes requested.
- [ ] Completion detection: not applicable until this story passes.
