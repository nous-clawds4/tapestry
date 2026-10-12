# Build Audit: Scores, Lists and Concepts — Done, but shared

**Book:** `engineering-team/audits/assistant-shared-categories/book.md`
**Date:** 2026-10-11
**Branch / commit range:** developed directly on `staging` (the session's designated branch). 11 of the book's own
commits, from `0a04c92` (book opened) to `14455d4` (the owner's Gate B verdict), interleaved with books
`assistant-duty-menu` and `duty-menus-and-self-maps`.
- **Commits.** 2 story, 3 design, 2 test, 2 impl, 2 review, plus this close.
  - The code is `397d236` (implementation) and `14455d4` (the two Gate B fixes).
  - The tests are `57fbb43`, plus the Gate B test edits in `14455d4`.
- **Staging: deployed.** staging.brainstorm.world serves `assets/index-HvFsvXv2.js`, which carries the Gate B build's
  `bs-assistant-hub-card-shared-move` (checked anonymously after `14455d4`). Before that it served `index-_FhFDC4Y.js`,
  the build the Gate B Reviewer tested byte for byte.
- **Production: not yet.** It ships with the owner's next `staging` → `main` promotion (§6 #1).

**Provenance:** Acceptance-frame. There is no PRD. The owner's ask is quoted verbatim in `book.md`, and three decisions
were settled at intake: split counts as shared, the indicator is a pill and a line, and the path is the Light trial. The
owner confirmed the frame at Gate A on 2026-10-11 and passed the story at Gate B the same day, asking for two fixes.
**Confidence:** **high** for what the code does; **medium-high** for the frame as the owner will meet it.
- **For the code.**
  - Blinded gate-judges ran four times (J1 twice, then J2 and J3) on the design, the test plan and the
    implementation. J3 re-ran the gate, rebuilt the UI and repeated the fails-before check test for test.
  - The Gate B Reviewer did all of that again, built HEAD itself and ran the full suite at HEAD.
  - The full suite passed twice before this close and once at it (§5).
- **For the experience.** The Reviewer ran the real rule against the owner's live Treasure Map on staging (kind 10040
  by `e5272de9…`, whose Assistant there is `8e901369…`). It answers exactly what the owner will see: Scores shared
  partly, Lists shared entirely, Concepts Done. What no one has done is look at the hub signed in as the owner on a
  live instance. No browser session with a nostr signer was available. The browser tests mock every `/api` route, and
  the server tests inject their reads (§6 #2).

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **A third state, Done but shared.** `GET /api/assistant/attention` now answers Scores, Lists and Concepts
  (`trusted-assertions`, `trusted-lists`, `dlists`) for the signed-in viewer's own Assistant here, as follows. —
  `stories/done/assistant-shared-categories/1-done-but-shared.md` (AC-1)
  - **Done** when the viewer's newest Treasure Map gives the category to any Assistant.
  - **`shared` on a done category:**
    - `partly` when the viewer's Assistant is among those Assistants beside another;
    - `entirely` when it isn't among them;
    - `null` when only the viewer's Assistant holds it.
  - **Needs attention** stays for no Map (`no-map`) and no Assistant (`not-assigned`).
  - **`other-assistants-only` is retired.** A category held only by other Assistants used to need attention; now it
    is Done, shared entirely.
  - **The Map is read exactly as `/treasure-map`'s cards read it:** per key, the first valid Assistant counts and
    later ones are backups. So "your Assistant only as a backup" reads shared entirely.
- **The hub card says so, quietly** (AC-2). A shared card keeps the green ✓ and the green **Done** pill, and adds:
  - a muted **Shared** pill (the existing neutral badge);
  - one muted line under the description: **Partly handled by another Assistant · Move it here →** or **Handled by
    another Assistant · Move it here →**. The link opens `/treasure-map`, above the card-wide link.
  - Screen readers hear **Done, shared:** before the title.
  - Following the owner's Gate B verdict, the line carries no ◐ mark, and the "·" never wraps away from its link.
- **Shared is not counted** (AC-3). A shared category is done and not pending, so the hub's "N actions need attention"
  line and the top-bar **Manage your Tapestry Assistant** pill both leave it out. Needs attention still counts on both.
- **The rule is written where it is read** (AC-4):
  - the three cards' pages give the new *Alert criteria*;
  - `src/api/openapi.yaml` describes `shared` and has it in the schema;
  - BIBLE §11's attention row and its *Last updated* line;
  - ADR `assistant-trusted-content-status/0001` carries a superseded-in-part line naming what changed.
- **Nothing else moved** (AC-5). Other actions, `/treasure-map`, the checking and failure states, visitors, and the
  catch-up after a Map save all behave as before. SV18 now pins the catch-up for a shared card too.

## 2. Epics & stories rolled up

### Epic: `assistant-shared-categories` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 done-but-shared | The `shared` field and the retired reason, the hub's Shared pill and line, the counts, and the rule's words on the three pages and in openapi, BIBLE §11 and the old ADR | Done | `reviews/done/assistant-shared-categories/1-done-but-shared.md`: Reviewer PASS; the owner's Gate B verdict PASS, with non-blocking 3 and 4 applied |

**Epic close-out at this close.** The one story is Done and its code is on the shared line (`staging`). Step 9 applies
as written: the epic reads Done, and its story and review folders sit under `done/`. There is no ADR folder, because
under Light the Design note is in the story. Production is not a condition of step 9 and is recorded as pending
(§6 #1).

## 3. As-built inventory

Derived from the book's own commits (`git log --grep=assistant-shared-categories --numstat`): 24 files, +1978 −167.
Code and docs are 8 files (+97 −45, before this close's path updates). The rest is tests, harness artifacts and ledger
rows.

- **Server.**
  - `src/api/assistant/trustedContent.js`: `evaluateTrustedContent` answers `done` for any assigned category and adds
    `shared`. Every branch carries `shared` (null unless done), and the header and JSDoc say so. The rule module
    (`src/lib/treasureMapCategories.mjs`) is unchanged.
  - `src/api/assistant/attention.js`: the `check-failed` shape for the three gains `shared: null`, and the header
    states the new rule.
- **User-facing.**
  - `ui/src/pages/assistant/actions.js`:
    - `ASSISTANT_COPY` gains `shared`, `doneSharedSrPrefix`, `sharedLine` and `sharedMoveLink`;
    - the three `alertCriteria` take the new words;
    - `assistantAttention` returns `shared` (action key → `partly` / `entirely`, only for checked, done actions);
    - `needsAttention`, `done`, `count` and `alertCount` are unchanged.
  - `ui/src/pages/assistant/Index.jsx`:
    - `ActionCard` takes `shared` and draws the neutral pill and the `.bs-assistant-hub-card-shared` line;
    - the line's "·" and router `Link` sit in a `.bs-assistant-hub-card-shared-move` span;
    - one import, `MANAGE_TREASURE_MAP_PATH`.
  - `ui/src/styles.css`: two rules, `.bs-assistant-hub-card-shared` (faded by colour; 5.9:1 on the card) and
    `.bs-assistant-hub-card-shared-move` (`white-space: nowrap`).
  - `ActionPage.jsx` shows the new criteria with no code change.
- **Domain.** No concept, schema or firmware change. Kind 10040 is read, never written.
- **Data & contracts.**
  - The attention answer's three keys are now `{ category, finished, done, pending, reason, source, shared }`.
  - The reason `other-assistants-only` no longer occurs. Its only reader was this repo's UI, which never read the
    reason (Gate B review, Gate-A ratification).
  - No new route, event kind or stored shape.
- **Docs.** `src/api/openapi.yaml` (the description and the per-action schema's `shared`); BIBLE §11 and its *Last
  updated* line; the superseded-in-part line on ADR `assistant-trusted-content-status/0001`.
- **Tests.**
  - New suites:
    - `test/assistant-shared-categories.test.js`, 21 tests (U1–U7, A1–A2, C1–C4, D1–D4, S1–S4), registered;
    - `tests/brainstorm/assistant-shared-categories.spec.js`, SC1–SC7;
    - SV18 in `tests/brainstorm/treasure-map-save.spec.js`.
  - Re-aimed:
    - `test/helpers/trustedContentFixtures.js` (every answer carries `shared`, a `shared()` builder, the reason list,
      the criteria words);
    - `test/assistant-trusted-content.test.js` U1–U4, U11 and U12;
    - TC3 and SV17.
  - Through the fixture, U5–U10, A2, A4 and C4 of `assistant-trusted-content`, D4 of `assistant-management-page` and
    TC5 ×3 also expect the new shape and words.
  - Every re-aim is named in the story's Design note or test plan.
- **Harness and ledger.**
  - The book, the epic, the story, the review and one intake entry.
  - Two new ledger rows: `2026-10-11-self-entry-reads-as-another-assistant` and
    `2026-10-11-light-note-supersedes-adr`.
  - Recurrence notes on `2026-10-11-phase-docs-cite-rebased-hashes`, `2026-10-09-judge-workspace-and-served-build` and
    (at this close) `2026-10-07-staging-sessions-push-red-tests`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Book Decision 2: the owner's chosen preview, "◐ Handled by another Assistant · Move it here →" | No ◐ mark. The "·" and the link stay together on a narrow screen | intentional-change | The owner's Gate B verdict, applying review non-blocking 3 (the ◐ draws from a fallback font as a small half-dot) and 4 (at 390 px the "·" dangled) | A cleaner line; same words, same link | — |
| 2 | Frame: "Done, shared when the Map gives it to any other Assistant" | "Gives it to" is read as `/treasure-map`'s cards read it: only each key's first Assistant counts. A backup that is another Assistant doesn't make a category shared, and your Assistant only as a backup reads shared entirely | interpretation | Design note (one reading of the Map); AC-1's table, approved at Gate A | Hub and `/treasure-map` agree on every Map | — |
| 3 | (none) | A Map entry that names the Map's own author counts as "another Assistant", so it reads Done, shared | constraint-discovered | Review non-blocking 2: the rule never compares a delegate with the author. It is AC-1's rule as written, and the cards do the same | Rare today. It conflicts with the unratified self-maps draft | §6 #3 |
| 4 | Decision 2: a **muted** Shared pill | The existing neutral pill: slate, not green, not amber, but brighter text (luminance ≈ 0.66) than the Done green (≈ 0.36) and the amber (≈ 0.49) | interpretation | Design note (reuse `.bs-setup-step-badge.is-neutral`); review non-blocking 5. The owner did not ask to change it at Gate B | Quieter in hue, not in brightness | §6 #4 |
| 5 | (none) | The decision this book replaced, `assistant-trusted-content-status` book Decision 1 and its ADR 0001 sub-decisions 2, 4 and 6 in part, was superseded by a Light Design note, not an ADR | interpretation | Gate A classification, ratified at J1 and Gate B (no listed trigger fires) | None for users | §7 |

**Undocumented work.** None. Every file in the book's commits traces to the story, its Design note, its test plan or
its Gate B record. SV18, a test added beyond the Design note's list, is named and justified in the test plan.

## 5. Quality state at close

- **Test gate at close** (after the book flip and the epic close-out, step 10):
  `20261011T221005Z-24508-3380 started 2026-10-11T22:10:05.635Z on f6f976c7+dirty — FAIL, exit 1, 5684 passed, 43 failed, 582 skipped, 303/303 suites; failed: assistant-relay-list-publish, assistant-duty-menu-check, assistant-duty-menu-page, assistant-duty-menu-publish`
  - **The 43 failures are not this book's.** They are exactly the four suites that `f6f976c` touched: "test: failing
    tests for your-assistant-publishes-its-duty-menu (assistant-duty-menu #2)". That is another book's Phase-3 tests
    on shared `staging`, waiting for its implementation: assistant-duty-menu-publish 31, -check 5, -page 5,
    assistant-relay-list-publish 2. The failing tests (for example L13 `buildMenuTags`, E1/E2 the Duty Menu event,
    D6 the publish button) are that story's.
  - **Every suite this book touched passes in the same run:** assistant-shared-categories 21/0,
    assistant-trusted-content 30/0, assistant-attention 38/0, assistant-management-page 23/0, assistant-alert 15/0.
  - `+dirty` is this close's own uncommitted edits (docs, path repoints, the story/review moves). They were committed
    unchanged as `8f49e16`.
  - This is ledger `2026-10-07-staging-sessions-push-red-tests` again (§7). The close-time gate is red for another
    book's intended reds, not green.
- **Earlier full runs:**
  - `20261011T212108Z-27012-6181`, PASS, 5685 passed, on the pre-rebase twin of `397d236`;
  - `20261011T214241Z-958-6ee8` on `a82b26a`, PASS, 5685 passed, 0 failed, 582 skipped, 302/302 suites (the Gate B
    Reviewer's).
  - The skips need a live stack (Neo4j, strfry).
- **Scoped gate after the Gate B fixes:** `EXIT=0`, `TOTAL_FAIL=0` (assistant-shared-categories 21/0). Browser: 74
  passed, 0 failed, and 4 B8 skips that were there before.
- **Known open issues:** ledger `2026-10-11-self-entry-reads-as-another-assistant` (§4 #3). Two predecessor items
  still stand: `assistant-trusted-content-status` audit §6 #2 (the signed-in check, shared with this book's §6 #2)
  and #8 (whether the Assistant actually publishes; see §6 #5).
- **Debt.** No ADR under Light. The Design note logged none. The answer's `shared` field is additive, and nothing was
  left half-moved.

## 6. Carry-forward register

- [x] **1. Production.** Shipped 2026-10-12 in PR [nous-clawds4/tapestry#851](https://github.com/nous-clawds4/tapestry/pull/851)
  (`staging` → `main`), merged as `df457d6` at 00:17 UTC with the owner's explicit yes.
  - **Before the merge:** the PR's `test / stack-free` passed on its final head `6c0a5d3` (5722 passed, 0 failed on the
    first head `8a9a420`; green again after one docs-only commit). `check-safe-to-merge.sh` gave SAFE at 00:17:39.
  - **Deploy:** run 149 succeeded in about 1m51s. Production serves `index-XPqw1cb6.js`, which carries
    `bs-assistant-hub-card-shared-move`.
  - **Smoke test:** all five tiers clean.
    - Tier 1: 3×200, Neo4j ready.
    - Tier 2: all pages and APIs answer; Odell's `get-user-data` 504 as expected; search returns hits.
    - Tier 3: the new strings are present and the retired criteria are gone; `/assistant`, `/assistant/duty-menu`,
      `/assistant/trusted-lists` and `/treasure-map` answer 200 `text/html`; attention answers `signedIn:false`
      anonymously; the Duty Menu publish route answers 401 unsigned.
    - Tier 4: SC1–SC7 and TC1–TC5 pass against production's served UI (14/14; every `/api` call mocked). Chrome is
      not connected in this session.
    - Tier 5: neighbouring pages and APIs answer 200.
  - **Why it was held first** (2026-10-11): `staging` carried assistant-duty-menu #2's Phase-3 failing tests, and a
    selective promotion conflicted with assistant-duty-menu #1. The owner chose to promote all of `staging` once that
    story's implementation landed (`6ac4aa8`, reviewed PASS in `a431ed6`). The same bundle shipped the Duty Menu page,
    its publish button and that book's close (`6c0a5d3`).
- [x] **2. The signed-in look on staging.** Sign in on staging.brainstorm.world, open `/assistant`, and check:
  - Scores and Lists read **Done** and **Shared**, each with its line, and Concepts reads plain **Done**;
  - the count line and the top-bar pill leave the three out;
  - **Move it here →** opens `/treasure-map`.

  Same kind of gap as `assistant-trusted-content-status` audit §6 #2. **Done 2026-10-12:** after the production release,
  the owner checked `/assistant` signed in and reported that it looks right. That check covers the marks. The catch-up
  after a Map save is still covered only by SV17 and SV18, so the predecessor's §6 #2 stays open for that part.
- [ ] **3. Self-entries.** When book `duty-menus-and-self-maps` #3 reaches code, the hub's shared rule and the
  `/treasure-map` cards should learn self-entries together. (§4 #3; ledger
  `2026-10-11-self-entry-reads-as-another-assistant`)
- [ ] **4. The Shared pill's brightness.** It has the brightest text of the three pills. A hub-only dimmer text colour
  would still clear 4.5:1; the owner's eye decides. (§4 #4; review non-blocking 5)
- [ ] **5. "Assigned" versus "publishing" is now sharper.** Done means the Map points at an Assistant, any Assistant
  now, not that the events exist. One case to watch: a customer who gives Lists to their own Assistant here reads plain
  **Done**, though customers' Assistants don't publish Lists yet. The owner committed to building that (`_intake.md`
  2026-10-11, "Customers' Assistants publish Lists"). See `assistant-trusted-content-status` audit §6 #8.
- [ ] **6. The three pages beyond placeholders.** Still open as `assistant-trusted-content-status` audit §6 #3: the
  pages could now also show "shared, partly / entirely" and which Assistant holds what. Linked, not duplicated.

**Ticked elsewhere at this close.** `assistant-trusted-content-status` audit §6 #5 (backup-only assignments) and its
seed's §7 "Backups" and "The two pages' different questions". This book answered all three.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time:
- phase commits 313; reviews decided 288; kick-back rate 0%;
- direction gates: approve 94, kick-back 14, halt 6;
- books: 10 open, 78 closed; cycle-time median 0d.

This book adds 4 judged gates, 1 of them a kick-back (J1 round 1), and one human Gate B with 0 blocking and 5
non-blocking findings. That is above the corpus median of 3 findings per review that `light-profile.md` uses as the
trial's teeth check.

| Finding | Source | Terminal state |
|---|---|---|
| The Design note's list of re-aims was enumerated by reading and missed one test (U3). J1 caught it, and a dry run (apply the rule change, run the suites, revert) confirmed the corrected list before the second J1 | J1 round 1 KICK_BACK; story § Design note ("revised after J1") | declined: the judged interior caught it as designed (J1 item 3), and one instance doesn't warrant a rule. The dry-run technique is recorded here and in the story. Ports to Direction unchanged (same rubric) |
| A Light Design note superseded a ratified ADR's sub-decisions; `light-profile.md` doesn't say whether that is an irreversibility trigger | Gate B review, harness friction 1 | OPEN.md row `2026-10-11-light-note-supersedes-adr` |
| Phase documents cited a commit (`035c80ea`) that a rebase onto shared `staging` orphaned | Gate B review, harness friction 2 | OPEN.md row `2026-10-11-phase-docs-cite-rebased-hashes` (recurrence noted) |
| The story's "How to run" hard-codes :7799; a judge found the port held, and judges write into the session's shared scratchpad | Gate B review, harness friction 3; J3 report | OPEN.md row `2026-10-09-judge-workspace-and-served-build` (recurrence noted) |
| Developing on `staging` itself put failing tests on the shared line (about 12 minutes, `57fbb43` → `397d236`) and deployed the implementation to staging.brainstorm.world before the owner's Gate B verdict. The environment's stop hook demands every commit be pushed. And the close-time gate ran red on another book's Phase-3 tests on the same shared line (§5) | This session; book § Path | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (recurrence noted at this close, including the Gate-B-after-deploy consequence) |
| The fails-before record went stale mid-book: another book landed the fix for three base reds the gate had allowed | Story § Gate A base note; J2 note | declined: the base note's own clause ("if that book has landed, there must be none") handled it, and J3 applied it. Working as written |
| At session start, local `staging` held history from before a force-update of `origin/staging`. The environment's stop hook then asked for other authors' commits to be amended and pushed | This session | declined: outside this repo's harness (the hook belongs to the cloud environment). Handled in-session by keeping the old tip on a local backup branch and never amending or pushing other people's commits |
| A `pkill -f` pattern in a shell command matched the command itself and ended it | This session (stopping a preview server) | declined: a one-off tooling slip with no harness surface; stop servers by port or PID |
