# Build Audit: Coming soon — the hub's unbuilt cards stop asking for attention

**Book:** `engineering-team/audits/assistant-coming-soon/book.md`
**Date:** 2026-10-12
**Branch / commit range:** developed directly on `staging` (the session's designated branch). Ten of the book's own
commits, from `c51ef49` (book opened, 01:48 UTC) to `f61b7ff` (the owner's Gate B verdict, 03:03 UTC), plus this
close. They are interleaved with books `duty-menu-public-relay` and `duty-menus-and-self-maps`.
- **Commits.** 1 plan, 3 story, 1 design, 3 test, 1 impl, 1 review.
  - The code is `72c4b7b`.
  - The tests are `af217d0`, with `88fa4da` (a title) and `f1e0bbc` (three browser fixes found at J3).
  - The three commits after `c51ef49` were rebased onto another book's `6bab1e5` before their first push. Their
    pre-rebase twins (`5cc1592`, `1b0ab5f`, `0d7c32d`) were never pushed (§7 #3).
- **Staging: deployed.** Deploy run 657 (`3d0b6d4`) succeeded. staging.brainstorm.world serves `index-BcVRd6k3.js`,
  the same entry bundle that this session and the Gate B Reviewer each built from the tree and tested.
- **Production: not yet at the close; shipped the same day.** PR #854, merged as `ccb9b3b`, deploy run 151; production
  serves `index-BcVRd6k3.js` (§6 #1).

**Provenance:** Acceptance-frame. There is no PRD. The owner's ask is quoted verbatim in `book.md`. Four decisions were
settled at intake: which five cards, not counted in either reading, the page line, and the Light trial. The owner
approved Gate A ("approved, go ahead") and passed the story at Gate B ("pass with the records note"), both on
2026-10-12.
**Confidence:** **high** for what the code does; **medium-high** for the frame as the owner will meet it.
- **For the code:**
  - Three blinded gate-judges (J1, J2, J3) each approved on their first verdict. J2 and J3 re-ran the scoped gate
    themselves, and J3 repeated the fails-before check on `88fa4da`.
  - The Gate B Reviewer built HEAD itself, re-ran both halves of the fails-before check, and ran the full suite at HEAD.
- **For the experience:** the built UI was seen on screen with every `/api` route mocked: desktop, 390 px, and a Coming
  soon page. The owner was shown the hub section and a side-by-side of the two rings at Gate B. Nobody has looked at the
  hub signed in on a live instance (§6 #4).

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **Five cards say Coming soon** (AC-1). Bounties, Pins, Tags, Notifications and Alerts, and Preferences each show a
  muted **Coming soon** pill beside the title on `/assistant`. They have no "!" marker, no **Needs attention** and no
  **Done**. — `stories/done/assistant-coming-soon/1-coming-soon-cards.md`
  - The pill is the background image panel's pill on `/assistant/profile`: the same class, words and colour.
  - It shows for every viewer: signed in with or without an Assistant, signed out, and while sign-in is resolving.
  - Screen readers hear "Coming soon: <title>". The visible pill is hidden from them, so the words are read once.
  - Each card is still a link, stretched over the whole card, to its page.
- **They are not counted** (AC-2). The hub's "N actions need attention" line and the top-bar **Manage your Tapestry
  Assistant** pill both leave the five out, in every state of the answer. An answer that names one of them changes
  nothing.
  - With every real check done, both say **1**, where they said 6.
  - When the answer fails, the hub says **8**, where it said 13, and the pill **1**.
  - While the answer is on its way, the hub says 8 and the pill is not drawn, as before.
- **Their pages say Coming soon** (AC-3). `/assistant/bounties`, `/pins`, `/tags`, `/notifications-and-alerts` and
  `/preferences` lead with **Coming soon.** in bold, where they said **Placeholder page.**. The description, *Alert
  criteria* ("Not yet defined.") and *Planning notes* are unchanged.
- **Nothing else moved** (AC-4). Your Assistant's Treasure Map card is still a counted placeholder, and its page still
  says **Placeholder page.**. The seven checked cards, visitors' view, the server's answer and every other page
  behave as before.
- **The records follow** (the owner's Gate B verdict). ADR `assistant-identification-tags/0001` carries an "Amended
  in part (2026-10-12)" line: sub-decision 6's placeholder rule now excludes the five. ADR `assistant-duty-cards/0001`
  carries a note that its rejected Option B was later adopted for the five.

## 2. Epics & stories rolled up

### Epic: `assistant-coming-soon` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 coming-soon-cards | `COMING_SOON_ACTIONS` and its words; the hub's pill, prefix and counts; the five pages' line; the two ADR notes | Done | `reviews/done/assistant-coming-soon/1-coming-soon-cards.md`: Reviewer PASS (0 blocking, 2 non-blocking); the owner's Gate B verdict PASS with non-blocking 1 applied |

**Epic close-out at this close.** The one story is Done and its code is on the shared line (`staging`). Step 9 applies
as written: the epic reads Done, and its story and review folders move under `done/`. There is no ADR folder: under
Light the Design note is in the story. Production is not a condition of step 9 and is recorded as pending (§6 #1).

## 3. As-built inventory

Derived from the book's own commits (`git log --grep=assistant-coming-soon --numstat`, before this close): 35 files,
+1468 −72. Code is 3 files (+43 −9). The rest is tests, harness artifacts and ledger notes.

- **User-facing.**
  - `ui/src/pages/assistant/actions.js`:
    - exports `COMING_SOON_ACTIONS = ['bounties', 'pins', 'tags', 'notifications-and-alerts', 'preferences']`, in
      `ASSISTANT_ACTIONS` order, beside `CHECKED_ACTIONS`;
    - `ASSISTANT_COPY` gains `comingSoon` ("Coming soon"), `comingSoonSrPrefix` ("Coming soon: ") and
      `comingSoonPage` ("Coming soon.");
    - `assistantAttention` skips the five before anything else. Its returned shape is unchanged. Each action is now
      one of three kinds: checked, coming soon, or counted placeholder.
  - `ui/src/pages/assistant/Index.jsx`: `ActionCard` takes `comingSoon`, which the page passes as
    `COMING_SOON_ACTIONS.includes(action.key)`, independent of sign-in. A Coming soon card is never marked or done,
    draws the screen-reader prefix inside its link and the muted pill (`bs-setup-step-badge is-neutral`) after it.
  - `ui/src/pages/assistant/ActionPage.jsx`: the bold first line is `comingSoonPage` for the five and `placeholder`
    for any other action the component serves.
  - No CSS change: the muted pill already existed (the Shared pill and the background image panel use it).
  - The top-bar pill (`TopBarAlert.jsx`), `DutyMenu.jsx` and `OutboxRelays.jsx` read the one answer and needed no
    change.
- **Domain.** No concept, schema or firmware change.
- **Data & contracts.** None. The server's `GET /api/assistant/attention` answer is unchanged and names none of the
  five. No route, event kind or stored shape changed. Which actions are Coming soon is a build-time list.
- **Docs.** The two ADR lines above. BIBLE §11 describes only the server's answer and needed nothing.
- **Tests.**
  - New suites:
    - `test/assistant-coming-soon.test.js`, 12 tests (C1–C7, D1–D5, five of them sentinels), registered in
      `test/registry.js`;
    - `tests/brainstorm/assistant-coming-soon.spec.js`, CS1–CS7.
  - New fixture `test/helpers/comingSoonFixtures.js` (the five cards and the words). The hub fixture
    `test/helpers/assistantManagementFixtures.js` gains `COUNTED`, every card but the five.
  - Re-aimed from "every action without a check is marked and counted" to "less the five":
    - 10 Node tests: assistant-attention C3, R2; assistant-duty-cards C5, C7; assistant-duty-menu-check C3, C4, C5;
      assistant-management-page D7; assistant-profile-check C2; assistant-trusted-content C2;
    - 25 browser tests in nine specs, named in the story's AC→handle lines.
  - After the plan, at J3: TC1 (strips the new prefix), SC2 (takes its amber reference from the Treasure Map card)
    and CS6's click (by position, as hub B5 does). Each is named and justified in the story.
- **Harness and ledger.**
  - The book, the epic, the story, the review and one intake entry.
  - Recurrence notes at Gate B on five open rows: `2026-10-11-light-note-supersedes-adr`,
    `2026-10-09-judge-workspace-and-served-build`, `2026-10-11-phase-docs-cite-rebased-hashes`,
    `2026-10-08-realtime-wrapper-timing-flake-under-load` and `2026-09-20-done-move-breaks-inbound-refs`.
  - Recurrence notes at this close on three more (§7).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "follow the example of the 'A personalized background image' card" | The pill matches the example exactly. The empty circle beside the title is the hub's indigo ring, which every unmarked hub card has, not the example's dim grey | interpretation | AC-1 asks for no "!" marker; the ring is the hub's existing unmarked state. Review non-blocking 2; the owner saw both rings side by side at Gate B and did not ask for the change | A Coming soon card looks like a visitor's unmarked card, slightly louder than the example | §6 #2 |
| 2 | (none) | The pill shows to every viewer, visitors included | interpretation | Disclosed at Gate A ("whether a feature is built is the same for everyone"), approved there; it is how the example behaves (`profileChecklistCopy.js` `panelState`) | Visitors learn which features are coming | — |
| 3 | (none) | A screen-reader prefix, "Coming soon: <title>" | added-beyond-scope | The hub's convention for every mark ("Needs attention: ", "Done: "); approved at Gate A (§ Copy) | Screen-reader users hear the state | — |
| 4 | Frame: "follow the example" | The example's rule lives in the server's answer (`counts: false`); the hub's lives in a client-side key list | interpretation | Design note, rejected alternative 1: the server has no check for the five and names none of them; visitors make no request, so a server flag couldn't show them the pill | None for users. Changing which cards say Coming soon needs a code change and a deploy, as before | — |
| 5 | (none) | A Light Design note narrowed ADR `assistant-identification-tags/0001` sub-decision 6 and adopted the Option B that ADR `assistant-duty-cards/0001` had rejected | interpretation | Gate A classification, ratified at J1 and Gate B; the owner's Gate B verdict added the two pointer lines | None for users | §7 #1 |

**Undocumented work.** None. Every file in the book's commits traces to the story, its Design note, its test plan,
its J3 evidence or its Gate B record.

## 5. Quality state at close

- **Test gate at close** (after the book flip and the epic close-out, step 10):
  `20261012T031740Z-16627-0fb3 started 2026-10-12T03:17:40.552Z on b97743b0+dirty — PASS, exit 0, 5753 passed, 0 failed, 582 skipped, 304/304 suites`
  - `+dirty` is this close's own edits: the audit, the seed, the flips, the folder moves and the repointed paths. They
    were committed as `04f4eba` while the run went on. One audit paragraph (the OPEN.md sweep note) was added after
    the run started; it is prose only, and `harness-lint` is clean on the final tree.
- **Earlier full runs:**
  - `20261012T021106Z-17851-7755`, PASS, 5753 passed, 0 failed, 582 skipped, 304 suites. Its tree was `88fa4da`
    plus the implementation, uncommitted (§7 #3).
  - The Gate B Reviewer's `20261012T024525Z-30740-0316` failed one test: the known RW7 timing flake (§7 #4).
  - Its rerun `20261012T025139Z-32472-0dfa`, on `f92c462`: PASS, 5753 passed, 0 failed, 582 skipped, 304/304 suites.
  - The skips need a live stack (Neo4j, strfry).
- **Scoped gate** (15 suites): `EXIT=0`, 386 passed, run by this session, J3 and the Reviewer. **Browser** (ten
  specs): 103 passed, 0 failed, 4 skipped (B8 for pages already built), run by this session and the Reviewer.
- **Lint:** eslint on the three changed files, exit 0. `harness-lint` clean.
- **Known open issues:** none new. **Debt:** the literal counts in `tests/brainstorm/assistant-attention.spec.js`
  B1–B5 were moved by hand again (`assistant-duty-cards` audit §6, annotated at this close; §7 #6).

## 6. Carry-forward register

- [x] **1. Production.** Shipped 2026-10-12 in PR [nous-clawds4/tapestry#854](https://github.com/nous-clawds4/tapestry/pull/854)
  (`staging` → `main`, head `92eb023`), merged as `ccb9b3b` at 03:37 UTC on the owner's explicit "promote it to
  production".
  - **Before the merge:** the PR's `stack-free` and `main-source-guard` passed on `92eb023`. `check-safe-to-merge.sh`
    gave SAFE at 03:37:12 (attempt 1/45). The merge was pinned to `92eb023`, so nothing pushed to `staging` meanwhile
    could ride along.
  - **Deploy:** run 151 succeeded in about 1m37s. Production serves `index-BcVRd6k3.js`, the same bundle as staging
    and as the builds this session and the Gate B Reviewer tested.
  - **Smoke test:** all five tiers clean.
    - Tier 1: 3×200 at once, and Neo4j ready.
    - Tier 2: every page and API answers 200; Odell's `get-user-data` 504 with its JSON body, as expected; search
      returns hits.
    - Tier 3: the bundle carries the new words. `/assistant`, the five pages, `/assistant/treasure-map` and
      `/assistant/profile` answer 200 `text/html`. The attention answer is `signedIn:false` anonymously.
    - Tier 4: `assistant-coming-soon.spec.js` and `assistant-management-page.spec.js` against production's served UI,
      29 passed, 0 failed, 4 skipped (B8 for pages already built), with every `/api` call mocked. Chrome is not
      connected in this session.
    - Tier 5: `/treasure-map`, `/assistant/duty-menu`, `/assistant/outbox-relays`, `/assistant/identification-tags`,
      `/assistant/trusted-lists`, `/setup` and their APIs answer 200.
  - Before this, another book's promotion PR
    ([nous-clawds4/tapestry#852](https://github.com/nous-clawds4/tapestry/pull/852)) had briefly carried this book's
    failing tests. It was closed unmerged and replaced by a selective promotion (§7 #7).
- [ ] **2. The ring's colour.** The example's empty circle is dim grey; the hub's is indigo. A hub-only class could
  dim it on the five, with one CS6 assertion. The owner's eye decides; at Gate B they did not ask for it. (§4 #1;
  review non-blocking 2)
- [ ] **3. The count line at zero.** Today the Treasure Map card keeps every count at 1 or more. Once that card gets a
  real check, a fully set-up viewer's hub would read "0 actions need attention". The top-bar pill already hides at 0
  (`pickTopBarPill` draws only above 0), but the hub's line has no zero state. Decide it with the Treasure Map card's
  book.
  *Picked up 2026-10-12 → book `assistant-self-map` (open), § Design notes.*
- [ ] **4. The signed-in look on staging.** Sign in on staging.brainstorm.world, open `/assistant`, and check the
  five pills, the count line and the top-bar pill. Same kind of gap as `assistant-shared-categories` audit §6 #2.
- [ ] **5. Building the five.** Linked, not duplicated: `assistant-management` audit §6 #1–#2 (annotated at this
  close). When one is built, its key leaves `COMING_SOON_ACTIONS`, and joins `CHECKED_ACTIONS` if it gets a check.
  Node C1 pins the list exactly, so the change is visible in the tests.

**Ticked elsewhere at this close.**
- `assistant-management` audit §6 #4, "whether the pill should reach production while every action counts". The pill
  is on production: its bundle `index-XPqw1cb6.js` carries "Manage your Tapestry Assistant", checked 2026-10-12.
  Since this book, the five unbuilt actions don't count either.

**Annotated, not ticked** (they ask for the five to be *built*, which this book does not do):
`assistant-management` audit §6 #1, `assistant-profile-checklist` audit §6 #12, `assistant-trusted-content-status`
audit §6 #9, and `assistant-duty-cards` audit §6 "Literal counts in the attention spec".

**OPEN.md sweep (step 11):** no new row. Every loose end is in this register, every harness lesson is on an existing
row (§7), and no handoff document names this book.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time:
- phase commits 49; reviews decided 292; kick-back rate 1%; churn 3;
- direction gates: approve 94, kick-back 14, halt 6;
- books: 9 open, 81 closed; cycle-time median 0d.

**The Light trial's own numbers for this book.** Three judged gates, all approved on the first verdict, each with
non-blocking notes that were applied. Gate B had 0 blocking and 2 non-blocking findings, plus 5 harness frictions.
That is under the corpus median of 3 findings per review that `light-profile.md` uses as the trial's teeth check. The
Reviewer still re-ran every gate and both fails-before halves, and found the two record gaps the owner chose to close.
The rules were followed, with one bend: the implementation reached `staging` before J3's verdict (#7).

| # | Finding | Source | Terminal state |
|---|---|---|---|
| 1 | A Light Design note narrowed a ratified ADR's sub-decision and adopted another ADR's rejected option, with no pointer until the owner asked for one at Gate B | Gate B review, harness friction 1 | OPEN.md row `2026-10-11-light-note-supersedes-adr` (recurrence noted at Gate B). Ports to Direction unchanged |
| 2 | Gate A and "How to run" hard-code :7799, held by another process during the review | Gate B review, harness friction 2 | OPEN.md row `2026-10-09-judge-workspace-and-served-build` (recurrence noted at Gate B) |
| 3 | The J3 full-suite record ran on an uncommitted tree; three planning commits were rebased before their first push | Gate B review, harness friction 3 | OPEN.md row `2026-10-11-phase-docs-cite-rebased-hashes` (recurrence noted at Gate B) |
| 4 | The RW7 timing flake fired on the Reviewer's first full run | Gate B review, harness friction 4 | OPEN.md row `2026-10-08-realtime-wrapper-timing-flake-under-load` (recurrence noted at Gate B) |
| 5 | New inbound pointers named `stories/assistant-coming-soon/…`, which this close moves under `done/` | Gate B review, harness friction 5 | OPEN.md row `2026-09-20-done-move-breaks-inbound-refs` (recurrence noted at Gate B). This close repoints the pointers it can find |
| 6 | Gate A's re-aim list came from a Node-only dry run (apply the rule change, run the suites, revert). It named the 10 Node re-aims exactly, but missed two browser tests that assert the old behaviour by value: TC1 strips only the prefixes it knows, and SC2 used Bounties' amber pill as a reference. J3's browser run found them. The literal counts in the attention spec were moved by hand again. Technique for next time: include the browser specs in the dry run when the change alters rendered text or marks | J3 evidence; story § Implementation | OPEN.md row `2026-09-21-adr-reaim-list-misses-outcome-asserts` (recurrence noted at this close). Ports to Direction unchanged |
| 7 | Developing on `staging` put this book's failing Phase-3 tests on the shared line for about 14 minutes (`af217d0`, deploy run 656 at 02:08 UTC, to `72c4b7b`, run 657 at 02:21). They entered another book's promotion PR #852, which that session closed and replaced with a selective promotion (#853). The stop hook also had the implementation pushed before J3's verdict; J3 then approved it | This session; the other session's note on the row | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (recurrence noted by `duty-menu-public-relay`'s session; this book's side added at this close) |
| 8 | The Reviewer's PASS file can't be committed before the owner's Gate B verdict (lint L1: a PASS-final review needs its story Done), while the stop hook demands untracked files be committed. The draft was held outside the repo until the verdict | This session (Gate B) | OPEN.md row `2026-10-11-disclosure-held-work-has-no-state` (recurrence noted at this close: the same "held work has no named state" gap, from a different cause) |
| 9 | At session start, local `staging` held history from before a force-update of `origin/staging` | This session | declined: outside this repo's harness (the clone belongs to the cloud environment), as in `assistant-shared-categories` audit §7. Local had no unique commits, so it was reset to `origin/staging` |
| 10 | CS6 first clicked a card's description with `Locator.click()`, which the card-wide link intercepts by design | J3 browser run | declined: a one-off test-authoring slip. Hub B5's comment already documents the pattern, and J3 caught it as designed |
