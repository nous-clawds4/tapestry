# Review: Story 1 — Coming soon: five hub cards that aren't built yet stop asking for attention

**Reviewer:** Claude (acting as Reviewer, Gate B — Light profile)
**Date:** 2026-10-12
**Diff:** this story's code is `72c4b7b` (`git show 72c4b7b`, three files). Its tests are `af217d0` and `88fa4da`, plus the
post-plan fixes in `f1e0bbc` (three browser specs, test-only). Its planning and notes commits are `5db1c45`, `fe067cf`,
`3d0b6d4` and `f92c462`. The base before the code is `88fa4da`.
- Reviewed at HEAD `f92c462`. During the review `origin/staging` moved to `fe163bc`: three commits from other books
  (`efbf8ed`, `3894738`, `fe163bc`). They change only documents and the ledger, and none of this story's files. They
  are not under review here.
**Story:** `engineering-team/stories/done/assistant-coming-soon/1-coming-soon-cards.md` (no ADR: Design note)

## Quality gates (run by reviewer, not trusted)

- [x] **Scoped Node gate** (the exact command in the story header). I ran it in the foreground, with the exit code
  captured by brace-redirect to a log, not piped. Result: **exit 0**, `TOTAL_FAIL=0`, **386 passed**.
  - Per suite: coming-soon 12, alert 15, attention 38, duty-cards 12, duty-menu-check 65, duty-menu-page 15,
    identification-tags-page 16, management-page 23, outbox-check 29, outbox-relays-page 21, profile-check 33,
    shared-categories 21, trusted-content 30, my-assistants-page 50, treasure-map-needs-attention 6. Each figure
    matches the story's J3 numbers.
  - The 4 skips are the live-stack H-class tests: attention 1, management-page 1 and my-assistants-page 2.
- [x] **Browser specs** (the story's ten "How to run" specs, `--project=chromium --reporter=line`, with `--output` in my
  scratch directory).
  - I ran them against **my own build of HEAD**: `vite build --outDir <scratch>/dist-review`, served by
    `vite preview --port 7831 --strictPort`. :7799 belonged to another process.
  - Result: **exit 0: 103 passed, 0 failed, 4 skipped.** The skips are assistant-management-page B8 for the four built
    pages, which were skipped before this story too.
  - The working tree was clean before and after.
- [x] **Staging runs the code I tested.** My build's entry bundle is `assets/index-BcVRd6k3.js`.
  `https://staging.brainstorm.world/assistant` served the same hash at the start of the review, and again after
  `origin/staging` moved.
- [x] **Fail-before, both halves re-run** (J2's judge read the browser counts but did not re-run them). Both match the
  story exactly.
  - **Node:** I ran the scoped gate on a `git archive` of `88fa4da`, which has the tests but not the code. Result:
    `EXIT=1`, `TOTAL_FAIL=17`.
    - The new suite fails 7 of 12 tests: C1–C4 and D1–D3. C5, C6, C7, D4 and D5 pass (the sentinels).
    - The other 10 failures are exactly the re-aims Gate A named: attention C3 and R2; duty-cards C5 and C7;
      duty-menu-check C3, C4 and C5; management-page D7; profile-check C2; trusted-content C2.
  - **Browser:** I built `88fa4da`'s UI (`index-XPqw1cb6.js`) and served it on :7832. Then I ran HEAD's ten specs
    against it. Result: **32 failed, 71 passed, 4 skipped**.
    - Failures by spec: coming-soon 7 (CS1–CS7), management-page 7 (B1, B4, B8 ×5), attention 5, profile-check 4,
      alert 3, trusted-content 2 (TC2, TC3), and one each in duty-menu, identification-tags-page, shared-categories
      (SC1) and taggings-publish.
    - That is the story's list. TC1 and SC2, re-aimed in `f1e0bbc`, pass on the base as the story says.
- [x] **Lint:** `ui/node_modules/.bin/eslint` on `actions.js`, `Index.jsx` and `ActionPage.jsx`: **exit 0**, no output.
- [x] **Full `npm test` at HEAD `f92c462`.** I ran it twice.
  - The first run, `20261012T024525Z-30740-0316`, gave FAIL: 5752 passed, 1 failed. The one failure was
    `tagging-edges-realtime-wrapper` RW7, whose first restart came after 0.76 s against a 0.8 s floor.
    - That is the signature of ledger `2026-10-08-realtime-wrapper-timing-flake-under-load`.
    - The diff touches no `src/`, `scripts/` or `setup/` file.
    - Run alone, the suite passed 24/0 three times out of three.
  - The second run is the record. `npm run gate:status`:
    `20261012T025139Z-32472-0dfa started 2026-10-12T02:51:39.447Z on f92c462c — PASS, exit 0, 5753 passed, 0 failed,
    582 skipped, 304/304 suites`.
  - It replaces the story's full-suite record, `20261012T021106Z-17851-7755`. That run was on `88fa4da4+dirty`, a
    working tree that no commit matches (harness friction 3).
- [x] **Shared lines** (book § Shared lines; ledger `2026-09-22-parallel-books-no-shared-line-recheck`).
  - After `git fetch origin staging`, `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0).
  - `git log 72c4b7b..origin/staging` shows no change to `ui/src/pages/assistant/`, `TopBarAlert.jsx`,
    `ui/src/context/` or `src/api/assistant/attention.js`.
- [x] _Typecheck / build not configured._ The `vite build` above is the only build, and it succeeded.

## Spec adherence — AC verdict table

| AC | Handles | Verdict | Evidence |
|---|---|---|---|
| AC-1 the five say Coming soon | C1, C2, D1, D2, D4; CS1, CS3–CS6; management-page B1 | **Met** | All pass. `actions.js:295` lists exactly the five, in order. The card draws the pill at `Index.jsx:59` and the prefix inside the link at `:53`. Its `comingSoon` is `COMING_SOON_ACTIONS.includes(action.key)` (`:146`), which doesn't depend on sign-in. **Seen:** in my accessibility snapshot the links are named "Coming soon: Bounties" … "Coming soon: Preferences", and the pill isn't in the tree. Keyboard focus never lands on a pill. The pill's class, colour and background equal the background image panel's (CS6). Its contrast over the card is 9.97:1. |
| AC-2 not counted | C3, C4; CS1, CS2; the 10 Node and 25 browser re-aims | **Met** | All pass. `actions.js:330` skips the five before anything else. **Seen**, all three rows of the table: every check done gives a count line of 1 and a top-bar pill of 1; a failed answer gives 8 and 1 (CS2); an answer that never comes gives 8 and no pill (my probe). One checked action pending gives 2 and 2. A forged answer can't move the counts: bounties `done` + `shared: 'entirely'`, pins `pending`, tags `done: 'yes'`, `null`, and a string all leave them at 1 and 1, with no page error. |
| AC-3 their pages say Coming soon | C7, D3; CS7; management-page B8 ×5 | **Met** | All pass. `ActionPage.jsx:18,26`. **Seen:** `/assistant/bounties` and `/assistant/notifications-and-alerts` open with **Coming soon.** in bold. The description and "Not yet defined." are unchanged, and the planning notes on Tags and Preferences are still there (CS7). |
| AC-4 nothing else moves | C5, C6, D3, D5; CS1, CS3, CS4, CS7 | **Met** | All pass. The Treasure Map card still shows "!" and **Needs attention**, and its page still says **Placeholder page.** The seven checked cards are badged as before. Visitors and viewers with no Assistant see the five pills, no marks and no count line (CS4). The diff touches no file under `src/`, so `GET /api/assistant/attention` is unchanged. D5 pins that the server's answer names none of the five. |

- [x] Every AC has a passing test. No AC is silently dropped.
- [x] No behaviour beyond the story. The three code files are exactly the Design note's blast radius. Every re-aim
  filters by the fixture's fixed keys (`comingSoonFixtures.js`), not by the module's own list, so each still
  discriminates; each failed on the base. `f1e0bbc`'s three fixes weaken nothing:
  - CS6 now clicks by position, as hub B5 does.
  - TC1 strips the new prefix too, and still pins the six titles in order.
  - SC2 still asserts the Shared pill is not amber; it now reads the amber from the Treasure Map card.

## Gate-A classification — ratified: Design note, no ADR

I checked each irreversibility trigger:
- **Wire format / event shape:** none. The change is client-only. The diff has no file under `src/`, and the attention
  answer's shape and route are unchanged. Nothing is signed or published.
- **Auth / trust default:** none. Whether an action is built is a fact about the build, not a trust or WoT judgement.
  The marks and counts are still about the session's own Assistant.
- **Schema / firmware, dependency, routing / middleware, headers:** none. `App.jsx` still builds the routes from
  `ASSISTANT_ACTIONS`, and `package.json` is untouched.
- **A value that exists in more than one repo:** none found. The five keys appear only in `ui/src`, the tests and the
  harness documents.

The Design note is accurate as built. Its first rejected alternative is real: the server names no placeholder, and a
visitor makes no request, so a server-side flag would never reach them. One gap: the note reverses part of two
ratified ADRs and points at neither (Non-blocking 1).

## Adversarial probing beyond the plan

- **Premise: "six placeholders; every check passing still reads 6": sound.** At `88fa4da`, `ASSISTANT_ACTIONS` has 13
  entries and `CHECKED_ACTIONS` has 7. In the base browser run, the hub receives 6 where 1 is now wanted, and 13 where 8 is.
  - The residual count of 1 is the Treasure Map placeholder. So every Assistant holder whose real checks all pass
    still sees a top-bar pill reading "1 action needs attention", on every page.
  - That is the owner's explicit choice ("let's just not do anything to that card"), and AC-2's table records it.
- **Collateral outside the diff: none found.**
  - `assistantAttention` has four callers. `TopBarAlert.jsx:40` reads only `alertCount`. `DutyMenu.jsx:86` and
    `OutboxRelays.jsx:64` read their own key. The hub is the fourth.
  - Under the all-done answer, `/assistant/duty-menu`, `/assistant/outbox-relays`, `/assistant/identification-tags`,
    `/assistant/profile`, `/treasure-map` and the five pages load with no page error.
  - `ASSISTANT_COPY` gained three keys. Its other readers (`manageTreasureMap.js`, `ProfileChecklist.jsx`,
    `IdentificationTags.jsx`, `EditProfile.jsx`, `Concepts.jsx`, `EditConcept.jsx`, `NewConcept.jsx`) read only named
    keys.
  - `PROFILE_CHECKLIST_COPY.comingSoon` is a separate object and is untouched. C2 pins the two words equal.
  - `myAssistants.js` reads `ASSISTANT_ACTIONS` only to find the identification-tags path.
  - The FAQ (`actions.js:214`) already said notifications and preferences are "Coming soon". It makes no claim about
    counting.
- **The top-bar pill.** `pickTopBarPill` is unchanged. It still waits while the answer is `checking`, and gives way to
  setup.
  - Because the Treasure Map card always counts, `alertCount` is still at least 1 for an Assistant holder. So whether
    the pill is drawn is unchanged; only its number drops.
- **Error paths.** The fetch can fail, never arrive, or come back forged. All three are covered above (C3, C4, CS2 and
  my probe).
  - A key in both lists would be skipped as Coming soon, silently, but C1 fails if any of the five is ever checked.
    Building one of the five therefore means editing `COMING_SOON_ACTIONS` and C1 together.
- **Widths.** At 320 and 375 px nothing scrolls sideways, and every pill stays inside its card. At 320 px "Notifications
  and Alerts" and "Preferences" wrap the pill under the title, and it stays readable.
- **The look against the owner's example** (Non-blocking 2). The pill is identical. The ring beside the title is not:
  the panel's is dim grey, while the hub's is the default indigo ring.
- **Four invariants (CLAUDE.md).**
  - POV-first: the marks and counts stay about the session's own Assistant. Coming soon is a build fact, the same for
    every viewer, and not a trust claim.
  - Decentralized-first: nothing gates anyone's publishing.
  - View time: nothing is stored or precomputed. The answer is derived on every render.
  - Local-first: no graph, LMDB or relay write.
- **TA pubkey house rule:** nothing signs or filters by author. The diff, tests included, has no 64-hex literal, and ADR
  0015's `LEGACY_*` constants are untouched.

## Concept-graph integrity
- [x] No concepts, handles or definitions are touched, so there's nothing to reinstall. No new code needs
  `/summaries`.

## Things tests can't catch
- [x] The diff has no secrets, debug logging, `.only`, `debugger`, TODOs or commented-out code.
- [x] No race: `comingSoon` is a constant per action. The counts are a pure function of the one answer.
- [x] Security: the card and the page render only constants from `actions.js`. Nothing from the answer is rendered for
  the five.

## House rules check
- [x] No new lint, typecheck or build tooling. No new CSS: the pill reuses `.bs-setup-step-badge.is-neutral`.
- [x] Concept Graph API authority isn't engaged (no concepts).

## Product-guide adherence
- N/A (no PRD; acceptance frame). The copy matches § Copy verbatim: the pill (`actions.js:250`), the screen-reader prefix
  (`:251`) and the page line (`:252`). The unchanged words are pinned by C2.

## Findings

### Blocking
None.

### Non-blocking
1. **Two ratified ADRs still state the rule this story reverses, with no pointer to it.**
   - `engineering-team/decisions/done/assistant-identification-tags/0001-one-assistant-attention-answer.md:232`
     (sub-decision 6) still says "A placeholder action (no check yet) is marked and counted in both, as today."
   - `engineering-team/decisions/done/assistant-duty-cards/0001-two-placeholder-entries-in-the-one-action-list.md:95–102`
     considered and rejected **this mechanism**, as its Option B: "a non-counting 'coming soon' placeholder".
   - The story cites sub-decision 6, but never Option B, and neither ADR got a line.
   - Option B's rejection rested on that book's owner decision for two other cards, so it doesn't bind here. This is a
     gap in the record, not in the design. The precedent, assistant-shared-categories #1, did add a
     "Superseded in part" line.
   - Ask (optional): add one `> **Amended in part (2026-10-12):**` line to sub-decision 6, naming the five and this
     story's Design note. Optionally, add a note on duty-cards Option B that it was later adopted for five other cards.
2. **The ring beside the title is the hub's indigo, not the example's dim grey.**
   - The hub's ring comes from `ui/src/styles.css:8834–8841` (`#818cf8`). The panel's comes from `:8978–8986`
     (`rgba(255,255,255,0.18)`).
   - AC-1 asks only for no "!", so this is met as written. J3 saw it too ("the empty circle an unmarked card has").
   - It is also exactly a visitor's unmarked card, so a Coming soon card looks like "not yet checked". That is louder
     than the owner's example.
   - Optional, if the owner wants the example's quieter look: a hub-only class that dims the ring on the five, plus a
     CS6 assertion.

### Harness friction
1. **A Light Design note reversed a ratified ADR's decision again, and this time without a pointer.** This is a
   recurrence of ledger `2026-10-11-light-note-supersedes-adr` (OPEN). The two Light stories on this hub now record the
   same situation in two different ways. Suggest a recurrence note on that row.
2. **Gate A and "How to run" hard-code :7799, which another process held during this review.** This is a recurrence of
   ledger `2026-10-09-judge-workspace-and-served-build`. Its fix shape worked again: my own directory, a served build
   named by its asset hash, on :7831 and :7832.
3. **The story's full-suite record can't be tied to a commit.** Gate run `20261012T021106Z-17851-7755` ran on
   `88fa4da4+dirty`. The story says so honestly ("88fa4da plus the implementation"). This is a sibling of ledger
   `2026-10-11-phase-docs-cite-rebased-hashes`. My run at HEAD replaces it.
4. **The RW7 timing flake fired during my first full run.** This is a recurrence of ledger
   `2026-10-08-realtime-wrapper-timing-flake-under-load` (0.76 s against the 0.8 s floor). Alone the suite passed
   24/0 three times out of three, and the second full run passed.
5. **New pointers that will go stale.** The new header pointers in `actions.js:27` and `test/helpers/comingSoonFixtures.js`
   name `stories/done/assistant-coming-soon/…`, which moves under `done/` at epic close-out. Four neighbouring pointers in
   the same `actions.js` header already miss. This is ledger `2026-09-20-done-move-breaks-inbound-refs` (OPEN).

## Verdict
**PASS**

## On PASS (same commit — applied by the spawning session after the owner's Gate B verdict)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result goes in the chat, not this file.

**The owner's Gate B verdict (2026-10-12):** "pass with the records note". Non-blocking 1 is applied in the same
commit: one line each on ADRs `assistant-identification-tags/0001` and `assistant-duty-cards/0001`. Non-blocking 2, the
ring, is not applied. The five harness frictions are noted on their ledger rows as recurrences.
