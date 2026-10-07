# Review: Story manage-treasure-map #2 — The Assistants by category cards

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-07
**Diff:** `git diff 90e6a78 06c4738`, made up of the failing tests (`ccece6b`), the test-only amendment
(`git diff ccece6b f393b21`) and the implementation (`git diff f393b21 06c4738`). Branch `staging`.
**Story:** `engineering-team/stories/done/manage-treasure-map/2-the-assistants-by-category-cards.md`
**ADR:** `engineering-team/decisions/done/manage-treasure-map/0002-the-cards-count-with-their-own-rule-over-the-same-read.md`
(story 1's ADR 0001 for context)
**Test plan:** `engineering-team/stories/done/manage-treasure-map/2-the-assistants-by-category-cards.test-plan.md`, with its
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

## Re-review, round 2 (2026-10-07)

**Diff:** `git diff 80168e3 84fad91` on `staging`: 6 files, 83 insertions, 10 deletions. Commits:
- `e858930`: ADR 0002 Amendment 1 (the raw viewer resets on a switch between two known people);
- `02c3880`: the Tester's Amendment 2. C14 is new, and T5's and T6's closing count-zero checks go back to page-wide
  (round 1, non-blocking 4);
- `84fad91`: `Index.jsx` keys `RawViewer` on `known.switches`, adjusted during render; the mixed card's assignee row is
  a `div` (round 1, non-blocking 5); the story's § Deviations.

Also since round 1, `3471472` filed two ledger rows: the meta row, and the card rule's edge cases.

**In short:** round 1's blocking finding is fixed on the path it named, and the browser runs are now stable.
- C14 fails 5/5 on `06c4738` and passes 5/5 now.
- The four browser suites pass 56/56 in 5 idle runs and in 3 runs under load. The two treasure-map specs ×3 at
  6 workers under load pass 87/87.
- StrictMode (a React development-runtime build) changes nothing.

One blocking item remains, on a path C14 doesn't reach. Signed in as X, sign out, sign in as Y, and open the raw
viewer while Y's sign-in settles: it snaps shut, round 1's symptom.
- Amendment 1 says this shouldn't happen ("exactly two cases"; "`null → X` … keeps the viewer as it is").
- But its own mechanism (the "last known pubkey", never cleared on sign-out), which the code follows, counts it as a
  switch.
- On this page every change of person passes through signed-out. So this is the only reachable case where the new
  counter does anything visible.

### Quality gates (run by reviewer, not trusted)

- [x] `npm test`: **PASS**. `npm run -s gate:status`:
  `20261007T051223Z-16884-ac97 started 2026-10-07T05:12:23.151Z on 84fad918 — PASS, exit 0, 4970 passed, 0 failed, 581 skipped, 271/271 suites · /home/user/tapestry/tmp/gate-runs/20261007T051223Z-16884-ac97.json`
  - **The record:** `git: { commit: 84fad918…, branch: staging, dirty: false }`, no stray errors, Node v22.22.0.
  - **Per suite:**
    - `manage-treasure-map-cards` 31/0;
    - `manage-treasure-map-page` 22/0 (2 skipped, the live tests);
    - `my-assistants-page` 50/0 (2 skipped);
    - `my-assistants-actions` 29/0;
    - `my-assistants-map` 14/0;
    - `my-assistants-nip05` 13/0.
  - The totals are the same as round 1's; this round adds no Node test.
- [x] **The served UI is HEAD.** A fresh build of `84fad91` (`git archive` into scratch) is byte-identical (sha1,
  28 files) to the `dist/` that :7799 serves (`index-3flYujU4.js`).
- [x] **Playwright** (chromium; the four suites, now 56 tests with C14):
  - idle, `--workers=4`: 5 runs, **56/56 each**;
  - under load (four CPU-bound processes on a 4-CPU machine, load average about 14), `--workers=4`: 3 runs,
    **56/56 each**;
  - under the same load, the two treasure-map specs at `--repeat-each=3 --workers=6`: **87/87**.
  - Round 1 had 4 runs out of 7 with a failure. This round has none out of 9.
- [x] **C14 catches the bug.** Against a scratch build of `06c4738` (served on :7798) at `--repeat-each=5`: 5 failed,
  each on "the Map shows in the still-open viewer — element(s) not found", as Amendment 2 says. Against HEAD: 5 passed.
- [x] **Amendment 2's other claim.** HEAD's T5 and T6, with their page-wide end checks, pass 6/6 (×3) against
  `06c4738`.
- [x] **StrictMode.** The page runs under `<StrictMode>` (`ui/src/main.jsx:11`, React 19). A production build doesn't
  double-render, so I built HEAD with React's development runtime (`NODE_ENV=development vite build --mode development`
  into a scratch outDir) and served it.
  - The two treasure-map specs: 29/29.
  - My switch probe (below) gives the same results as on the production build.
  - There was no React warning and no page error in the console through sign-out and sign-in.
  - The Vite dev server itself can't serve the scratch tree: `src/lib/broadcastOutcome.js` is CommonJS, and only the
    build's commonjs plugin resolves it. That isn't this story's concern.
- [x] _Lint, typecheck and build not configured — skipped._

### Blocking 1, re-checked: the sign-in settle

- **The first-load settle is fixed.** `known` starts as `{ viewer: null, switches: 0 }`. When sign-in settles to X,
  `known.viewer` was null, so `switches` stays 0 and `RawViewer` keeps its state (`Index.jsx:254–257`). C14 pins this,
  and my round-1 race probe passes 3/3.
- **Signing out and back in as the same person** still closes the viewer through the unmount (C10). A viewer opened
  during that second sign-in's settle stays open (probe P1-X).
- **The mechanism is sound React.**
  - It's the documented "adjusting state while rendering" pattern. The update is conditional, so it can't loop, and
    React re-renders before committing, so the old key never commits with the new viewer.
  - Under StrictMode's double render, the update is idempotent. It sets an absolute value (`known.switches + 1`, from
    the same render's `known`), not an updater function, so a second invocation can't count twice. Once
    `known.viewer === viewer`, the branch is skipped. The development build above confirms it.
  - A user object that changes identity with the same pubkey doesn't touch `known`. That covers `refreshUser`
    (`AuthContext.jsx:163–170`) and a re-run of `checkStatus`. The comparison is on the `user.pubkey` string, and
    `useTreasureMap` keys on the same string.
- **But signing out, then in as someone else, still closes a viewer opened during the settle.** See New findings,
  Blocking 1.

### Round 1's non-blocking items and harness friction

1. **Non-blocking 1–3 (the card rule's draft-grammar edge cases):** filed as
   `ledger/2026-10-07-treasure-map-card-rule-edge-cases.md`. The row is accurate except for one slip: its item 2 calls
   `rank` "a Score-only system (§4.7)". `rank` is a metric; §4.7's `scope = metric` is the Score-only alternative
   (Non-blocking 2 below).
2. **Non-blocking 4 (two narrowed end-state checks):** fixed. `tests/brainstorm/manage-treasure-map.spec.js:273` and
   `:295` are page-wide again, and pass on both HEAD and `06c4738`.
3. **Non-blocking 5 (a `<ul>` inside a `<span>`):** fixed. `Index.jsx:167` is now a `div` with the same class, so the
   flex layout is unchanged. C2, C4 and C9 (375 px) pass.
4. **Non-blocking 6 (duplicate live regions):** not addressed. It stays non-blocking.
5. **Non-blocking 7:** noted only, as before.
6. **Harness friction 1:** filed as `ledger/2026-10-07-neighbour-suite-duplicate-roles.md` (meta). The row is
   accurate.
7. **This round's process:** each change came from its own role, in order. The ADR was amended first (`e858930`). The
   test change came from the Tester (`02c3880`, Amendment 2), and the code after both (`84fad91`).

### New findings

#### Blocking

1. **A viewer opened while a *different* person's sign-in settles still snaps shut.** The code is at
   `ui/src/pages/treasure-map/Index.jsx:254–257`; the rule it breaks is ADR 0002 Amendment 1
   (`0002-…md:217`, `:221`, `:227`).
   - **Repro** (my probe, on HEAD; production and development builds alike):
     - sign in as X, then Sign out from the menu;
     - set the signer to Y and press Sign in with nostr;
     - while `/api/auth/status` is held, open the raw viewer, then release.

     The viewer is closed (`aria-expanded="false"`). The same sequence signing back in as X leaves it open.
   - **Cause:** `known.viewer` is never cleared on sign-out. So Y's arrival after a signed-out render counts as a
     switch from X. It bumps the key and remounts the viewer the person just opened.
   - **What the record says:**
     - Amendment 1: the viewer "resets in exactly two cases": sign-out, and a switch from one known person to another
       "without passing through signed-out". It also says "`null → X` (sign-in settling, or a first sign-in) keeps the
       viewer as it is".
     - The comments at `Index.jsx:126–127` ("Sign-in settling isn't a new viewer, so a viewer opened meanwhile stays
       open") and `:252–253` ("null → someone … isn't a switch") say the same, as does the story's § Deviations
       (`:172–173`).
     - The amendment's mechanism sentence (the "`<last known pubkey>`", `:222`) is what the code implements, and it
       contradicts that rule.
   - **Reachability.** On this page, every change of person passes through signed-out.
     - The page's and the menu's sign-in buttons render only when there's no user (`Index.jsx:269–273`,
       `BrainstormUserMenu.jsx:87–88`).
     - `checkStatus` keeps the old user until the new one arrives.
     - So the direct X → Y switch the counter exists for can't happen here, and this is the counter's only visible
       effect in a reachable flow.
     - The window is narrow (three sequential requests after the signer step), but it is round 1's defect on a second
       path.
   - My round-1 wording ("reset it only on sign-out, or when the viewer changes from one known person to another")
     didn't separate X → signed-out → Y from a direct switch. The amendment's rule does, and the code should follow
     the rule.
   - **Asked change:**
     - Make the behaviour match Amendment 1's rule: a sign-in that settles after a signed-out render isn't a switch.
       For example, forget the last known viewer whenever the page renders signed-out. Or, since every change of person
       here passes through signed-out, drop the counter and rely on the unmount. Either way, make the mechanism
       sentence (`:222`) and the two code comments agree with the result.
     - Pin it in Phase 3, the Tester's lane. The test is C14's sequence after signing out as one person and signing in
       as another, with the hold on the second sign-in's `/api/auth/status`. It must fail on `84fad91`, and C10 and C14
       must stay green.

#### Non-blocking

1. **The direct X → Y switch is untested and, on this page, unreachable.** If the counter stays (the first option
   above), the ADR should say so, so a later reader doesn't take C14 or C10 as covering it.
2. **`ledger/2026-10-07-treasure-map-card-rule-edge-cases.md:16`** calls `rank` "a Score-only system". It's a metric
   (§4.7 `scope = metric`, "NIP-85 native, Score kinds only"). That's a one-word fix.

#### Harness friction

1. None new. Round 1's note about the "×3 repeats" is answered: this round's load runs are recorded above.

### Close-out

Not applicable this round. The story stays `Approved`, and there is no completion detection. Committing this section
is left to the launching session.

### Verdict (round 2)

**CHANGES_REQUESTED**

One blocking item remains. The raw viewer still closes when a different person's sign-in settles after a sign-out
(`Index.jsx:254–257`), contrary to ADR 0002 Amendment 1's own rule. Otherwise, round 1's blocking finding is fixed, and
the gate and the browser runs are stable.

## Re-review, round 3 (2026-10-07)

**Diff:** `git diff 17956b6 fbf99d7` on `staging`: 5 files, 84 insertions, 23 deletions. Commits:
- `4761311`: ADR 0002 Amendment 2. `RawViewer` has no key and resets only by unmounting on sign-out; Amendment 1's
  switch counter is superseded.
- `7fe68ca`: the Tester's Amendment 3. C15 is new, and the spec's mocks follow the session's person.
- `fbf99d7`: the `{ viewer, switches }` state and the key are removed. The two comments and the story's § Deviations
  now describe the unmount.

Also, `17956b6` corrected the ledger row's wording (round 2, non-blocking 2).

**In short:** round 2's blocking item is fixed. A viewer opened while a second person's sign-in settles, after a
sign-out, now stays open.
- C15 pins it. It fails 5/5 on `84fad91` and passes 5/5 now.
- The gate passes, and the four browser suites pass in all 12 runs, idle and under load.
- One finding is left, and it isn't blocking. Amendment 2 says a direct switch from one person to another can't happen
  on this page. It can, through the top bar's Sign in during the page-load sign-in check (probe P4). On that narrow
  path, the viewer stays open across the change of person. The record should be corrected, and the top bar's
  behaviour filed.

### Quality gates (run by reviewer, not trusted)

- [x] `npm test`: **PASS**. `npm run -s gate:status`:
  `20261007T123158Z-5495-7775 started 2026-10-07T12:31:58.640Z on fbf99d75 — PASS, exit 0, 4970 passed, 0 failed, 581 skipped, 271/271 suites · /home/user/tapestry/tmp/gate-runs/20261007T123158Z-5495-7775.json`
  - **The record:** `git: { commit: fbf99d75…, branch: staging, dirty: false }`, no stray errors, Node v22.22.0.
  - **Per suite:**
    - `manage-treasure-map-cards` 31/0;
    - `manage-treasure-map-page` 22/0 (2 skipped, the live tests);
    - `my-assistants-page` 50/0 (2 skipped);
    - `my-assistants-actions` 29/0;
    - `my-assistants-map` 14/0;
    - `my-assistants-nip05` 13/0.
- [x] **The served UI is HEAD.** A fresh build of `fbf99d7` (`git archive` into scratch) is byte-identical (sha1,
  28 files) to the `dist/` that :7799 serves (`index-DLphTZg2.js`).
- [x] **Playwright** (chromium; the four suites, now 57 tests with C15):
  - idle, `--workers=4`: 5 runs, **57/57 each**;
  - with `npm test` running alongside (load average 8–13), `--workers=4`: 3 runs, **57/57 each**;
  - with four CPU-bound processes on the 4-CPU machine (load average 12–16), `--workers=4`: 3 runs, **57/57 each**;
  - under the same load, the two treasure-map specs at `--repeat-each=3 --workers=6`: **90/90**.
- [x] **C15 catches the bug.** Against the scratch build of `84fad91` (served on :7798) at `--repeat-each=5`: 5 failed,
  each on "the viewer is still open, with the second person’s Map — element(s) not found", as Amendment 3 says.
  Against HEAD: 5 passed.
  - The whole cards spec on `84fad91` gives 14 passed with only C15 failed, which confirms Amendment 3's claim about
    the other tests.
- [x] _Lint, typecheck and build not configured — skipped._

### Round 2's blocking item, re-checked

- **The code.** `RawViewer` renders without a key (`Index.jsx:268`). Its only reset is the signed-out branch, which
  replaces it with the sign-in prompt (`Index.jsx:262–266`). No render-time state is left, so StrictMode's double
  render has nothing to count twice. A user object that changes identity with the same pubkey has nothing to reset, and
  `useTreasureMap` still keys on the pubkey string.
- **The paths:**
  - the page-load settle: C14;
  - sign out and back in as the same person: closed, through the unmount (C10);
  - sign out, then a second person signs in and opens the viewer while that settles: it stays open, with their own Map
    (C15).

  All pass in every run above.

### Amendment 2's reachability claim, re-checked

I checked `ui/src/context/AuthContext.jsx` and every sign-in entry point that is mounted on `/treasure-map`.

- **These parts are true.**
  - `setUser` is called only in `checkStatus` (`:66`, `:73`, `:77`), in `refreshUser` (`:166`, which keeps the user
    unless the pubkey is the same) and in `logout` (`:180`).
  - `checkStatus` runs only on mount (`:33`) and after a sign-in (`:143`).
  - There is no polling, no `storage` or `visibilitychange` listener, and no `BroadcastChannel`.
  - `LoginErrorModal` only closes.
  - `/treasure-map` is a top-level route (`App.jsx:311`), outside `Layout` (`:335`), so the Tapestry `Header`, which
    can also sign in, isn't mounted. The other `login()` callers (Tag, TagNotesView, Pins, setup, the assistant pages)
    are on other routes.
  - The page's own button (`Index.jsx:265`) renders only in the `signed-out` phase, which needs `!authLoading`.
- **One part is false.** The top bar's "Sign in with nostr" (`BrainstormUserMenu.jsx:87–88`) renders whenever `user`
  is null. That includes the page-load sign-in check, when a session may already exist.
  - **Probe P4** (scratch, not committed). The session is X and the signer holds Y.
    - Load `/treasure-map`, and click the top bar's Sign in while `/api/auth/status` is held.
    - Release the hold. X arrives; open the raw viewer on X's Map.
    - Let the sign-in finish. The session becomes Y.
  - **Result on HEAD (3/3):** the person changed from X to Y and the signed-out prompt never rendered. The raw viewer
    stayed open, now showing Y's Map.
  - **On `84fad91`:** Amendment 1's counter closed the viewer on that switch, which is AC-5's "signing in as someone
    else … shows the raw Treasure Map closed".
  - So the case Amendment 2 says can't happen is reachable today, and Amendment 2 removed the one thing that handled
    it.

### New findings

#### Blocking

None.

#### Non-blocking

1. **Amendment 2's premise is false on one path.** The false sentences are ADR 0002 `:241` ("renders only while nobody
   is signed in") and `:246`, the `RawViewer` comment at `Index.jsx:126`, and the story's § Deviations (`:173`), each
   saying the viewer "can't change any other way".
   - Through the top bar's Sign in during the page-load check, a direct X → Y switch happens with no sign-out. The raw
     viewer then stays open across the change of person (P4), so AC-5's "signing in as someone else" doesn't close it
     on that path.
   - **Why it isn't blocking:**
     - It needs four things together: an existing session, a signer set to another account, a click in the window
       while the page-load check runs (status, classification and own-profile requests), and the signer's prompt.
     - The outcome is the new person's own Map in a viewer left open. Nothing is lost, signed or published.
     - The cause is shared top-bar behaviour that predates this story.
   - **Asked follow-up:**
     - Correct the four sentences to name this path.
     - File a ledger row: `BrainstormUserMenu.jsx:87–88` offers Sign in while the page-load check is still reading an
       existing session, and on any Brainstorm page that lets the session switch people with no sign-out.
     - The fix at the source is to show no Sign in in the top bar while `loading`; that covers every page. For this
       page alone, Amendment 2's own contingency already says what to do (key the viewer on the viewer, plus a browser
       case). Either is a separate change.
2. **Round 1's non-blocking 6 (duplicate live regions)** is still open and still non-blocking.

#### Harness friction

1. None new.

### Close-out

As the launching session instructed, the Reviewer doesn't flip the story's status or commit. The coordinator flips
the story to `Done` and runs completion detection. Until the story says `Done`, `bash scripts/harness-lint.sh` reports
L1 for this file, which is expected.

### Verdict (round 3)

**PASS**

Round 2's blocking item is fixed and pinned by C15, which fails on `84fad91`. The gate is green, and the browser suites
passed all 12 runs, idle and under load. The one new finding is a false premise in Amendment 2 on a narrow,
pre-existing top-bar path. It is non-blocking, and the record correction and the ledger row are the follow-ups to
settle before the book closes.
