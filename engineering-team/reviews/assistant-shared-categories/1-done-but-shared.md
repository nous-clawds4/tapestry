# Review: Story 1 — Done, but shared

**Reviewer:** Claude (acting as Reviewer, Gate B — Light profile)
**Date:** 2026-10-11
**Diff:** the story's code is `397d236` (`git show 397d236`) and its tests are `57fbb43` (`git show 57fbb43`). No test
file changed after `57fbb43`. Reviewed at HEAD `a82b26a`, which equals `origin/staging`. Other books' commits are
interleaved (`05225a6`, `1b9fcd5`, and earlier ones). They are not under review here.
**Story:** `engineering-team/stories/assistant-shared-categories/1-done-but-shared.md` (no ADR: Design note)

## Quality gates (run by reviewer, not trusted)

- [x] **Scoped Node gate** (the exact command in the story header). Exit code captured by brace-redirect to a log, not
  piped. Result: **exit 0**, `TOTAL_FAIL=0`.
  - assistant-shared-categories 20/0, assistant-trusted-content 30/0, assistant-attention 38/0 (+1 skipped, live),
    assistant-management-page 23/0 (+1 skipped, live), assistant-alert 15/0, treasure-map-needs-attention 6/0,
    assistant-duty-cards 12/0, assistant-duty-menu-check 55/0.
  - The duty-menu base reds named at Gate A are gone, as J3 expected.
- [x] **Browser specs** (the story's "How to run" list, `--project=chromium`).
  - I ran them against **my own build of HEAD**: `vite build` into a review scratch directory, served by
    `vite preview --port 7831`. :7799 belonged to another session.
  - Result: **exit 0: 73 passed, 0 failed, 4 skipped.** The skips are assistant-management-page B8 and were there before.
  - My build's entry bundle is `assets/index-_FhFDC4Y.js`. `https://staging.brainstorm.world/assistant` serves the same
    hash, so staging runs exactly the code I tested.
- [x] **Fail-before spot-checks** (not trusted from J2). Both give exactly the plan's result.
  - **Browser:** I built `397d236^`'s UI and served it on :7832. SC1–SC4 fail, and SC5 and SC6 pass (the sentinels).
  - **Node:** I ran the new suite on a `git archive` of `397d236^`, which has the tests but not the code. 18 of 20 fail;
    C2 and S4 pass (the sentinels).
- [x] **Lint:** `ui/node_modules/.bin/eslint` on `Index.jsx` and `actions.js`. Both are clean at HEAD and at `397d236^`.
  **No new lint findings.**
- [x] **OpenAPI parses** (js-yaml). The per-action schema's `shared` is
  `{ type: string, nullable: true, enum: [partly, entirely] }`. That is the same nullable-enum form the file already
  uses for `source` (`openapi.yaml:268,277`).
- [x] **Full `npm test` at HEAD `a82b26a`:** exit 0. `npm run gate:status`:
  `20261011T214241Z-958-6ee8 started 2026-10-11T21:42:41.480Z on a82b26af — PASS, exit 0, 5685 passed, 0 failed, 582
  skipped, 302/302 suites`.
  - The Implementer's record of the full suite is gate run `20261011T212108Z-27012-6181` on `035c80ea`. `035c80ea` is
    the pre-rebase twin of `397d236`: `git range-diff` shows the same patch. It is not an ancestor of `staging`, so I
    re-ran the suite on HEAD (harness friction 2).
- [x] **Shared lines** (book § Shared lines; ledger `2026-09-22-parallel-books-no-shared-line-recheck`).
  - After `git fetch origin staging`, HEAD equals `origin/staging` (`a82b26a`).
  - `git merge-tree --write-tree HEAD origin/staging` is clean (exit 0, tree `484dd72`).
  - None of the seven files this story touches has changed since `397d236`. assistant-duty-menu's later commit
    `1b9fcd5` is harness documents only (its review, story, epic, book and two ledger rows).
- [x] _Typecheck / build not configured._ The `vite build` above is the only build, and it succeeded.

## Spec adherence — AC verdict table

| AC | Handles | Verdict | Evidence |
|---|---|---|---|
| AC-1 the three states in the answer | U1–U7, A2; re-aimed U1–U4, U11, U12 | **Met** | All pass. `trustedContent.js:64–70`: nobody gives `not-assigned`; otherwise the category is done, and `shared` is `null` / `partly` / `entirely`. **Live check:** I read the Owner's real kind 10040 from staging's relay (created 2026-10-09T18:38:46Z) and ran the real rule on it with staging's TA `8e901369…`, passed in upper case. Result: Scores `partly`, Lists `entirely`, Concepts `shared: null`. That is exactly AC-1's sentence about straycat's Map. |
| AC-2 the shared card | C1, C3, C4, D1–D3; SC1–SC4, SV18 | **Met** | All pass. In my accessibility snapshot, the card's link is named `"Done, shared: Lists"`. The line exposes "Handled by another Assistant" and a link "Move it here →" (`/treasure-map`), and the ◐ and · stay hidden. Enter on the link opens `/treasure-map`. Contrast, measured over the card's actual background (22, 22, 33): line 5.90:1, link 8.98:1, pill 9.97:1. |
| AC-3 shared is not counted | C2 (sentinel), U1's "only another" row; SC1 | **Met** | All pass. With the Owner's answer, the `/about` top-bar pill reads "9 actions need attention", which leaves out all three. |
| AC-4 the rule's words | C4, S1, S2; TC5 ×3, management-page D4 | **Met** | The three `alertCriteria` (`actions.js:121,135,149`) match § Copy character for character, and `/assistant/trusted-lists` renders them. BIBLE §11's row, its *Last updated* line, and the openapi description and schema all say the same. |
| AC-5 nothing else moves | A1, A2, C3, S4; SC5, SC6, SV18 | **Met** | All pass. The diff doesn't touch `ui/src/pages/treasure-map/`. Under the Owner's answer, `/treasure-map`, `/assistant/duty-menu` and `/assistant/outbox-relays` load with no page error. |

- [x] Every AC has a passing test. No AC is silently dropped.
- [x] No behaviour beyond the story. All 9 changed files are inside the Design note's blast radius, as J3 found. The
  re-aims (TC3, SV17, and U1–U4/U11/U12) keep their discriminating power. For example, U4 still fails if a backup were
  counted, because it would then read `partly`, not `entirely`.

## Gate-A classification — ratified: Design note, no ADR

I checked each irreversibility trigger:
- **Wire format / event shape:** none. Nothing is signed, published or read differently. The JSON answer of a
  session-bound route gains a field and loses one `reason` value.
  - That answer has one fetcher, `AssistantAttentionContext.jsx:53`.
  - No protocol draft, OPERATIONS.md or `docs/` file names the route or the reason.
  - No reader in `src/` or `ui/src` ever branched on `other-assistants-only`; it now appears only in history records.
- **Auth / trust default:** none. Which Assistant gets the nudge is a display rule, not a trust or WoT default. Whose
  Map and whose Assistant still come only from the session (`attention.js:301–309`, S4, A2).
- **Schema / firmware, dependency, routing / middleware, headers:** none.
- **A value that exists in more than one repo:** none found.

The Design note is accurate as built, and its first rejected alternative is real: the old answer for a split Map was
`done, reason: null`, so the client could not have seen the other Assistant. One process point is worth naming. This
note supersedes a sub-decision of a ratified ADR. The Light rules don't list that as a trigger (harness friction 1).

## Adversarial probing beyond the plan

- **Premise: "your Tapestry Assistant on this instance" is the session's own Assistant: sound.**
  - The handler resolves it with `getAssistantPubkeyFor(viewer)` from the session (`attention.js:308–309`).
  - For the Owner, that is SecureKeyStorage's `tapestry-assistant` key, the instance TA (`assistantKeys.js:20–24,
    32–35`). A customer gets their own key.
  - On staging, the Owner is `e5272de9…` and the TA is `8e901369…`. That is the Assistant the book names as
    straycat's. There's no literal, and no request field is read.
  - A customer whose Map names the instance TA gets "Handled by another Assistant". That is literally true, and it is
    what Decision 1 chose.
- **Premise edge: self-entries** (Non-blocking 2). A Map that names its own author is read as naming "another
  Assistant". This matches `/treasure-map` today, but not the self-entry semantics that the interleaved draft
  `05225a6` introduces.
- **Collateral outside the diff: none found.**
  - `assistantAttention` has four callers. `TopBarAlert.jsx:40` reads `alertCount`. `DutyMenu.jsx:60` and
    `OutboxRelays.jsx:64` read `needsAttention` and `done`, so the extra `shared` field passes them by. The hub is the
    fourth.
  - `ProfileChecklist.jsx` and `IdentificationTags.jsx` read only their own keys.
  - `assistant-trusted-content-status`'s `audit.md:26–27` and `prd-seed.md:37,49` still describe the old rule. They are
    a closed book's as-built record, so leaving them untouched is right. This book's close should name the delta.
- **Error paths:**
  - A check that throws gives `check-failed` with `shared: null` (A1).
  - A malformed or misplaced `shared` is ignored, because the client only accepts the two known values
    (`actions.js:322`, `Index.jsx:39`; C3).
  - A slow or failed answer and a visitor are covered by SC5 and SC6.
- **Clicks and keyboard:**
  - A click on the line's words, or on the Shared pill, opens the card's own page, as the description and Done pill
    do. Only "Move it here →" opens `/treasure-map`.
  - Tab order: title, NIP link, "Move it here →", then the next card.
  - The link's focus ring is the browser default, the same as the description's NIP links.
- **Widths:** at 1100, 390 and **320 px** (beyond the plan), the hub doesn't scroll sideways and the line stays inside
  the card. At 390 px the line wraps after the "·" (Non-blocking 4).
- **Link purpose:** two links are named "Move it here →" and go to the same place. Each sits in the same list item as
  its card's title, so WCAG 2.4.4 (A) is met. In a links list alone they look the same (2.4.9, AAA, not required).

## The ◐ mark — recommendation: drop it

- **It doesn't render as a clear symbol.** The line is 0.8rem (12.8 px). None of the page's named fonts covers U+25D0
  here, so Chromium draws it from a fallback font as a small half-dot (11×15 px box). That matches J3's "close to a
  dot".
- **It varies by platform.** Its look depends on each platform's fallback font. Meanwhile the Shared pill already
  carries the visual signal, and the words carry the meaning.
- **§ Copy already allows dropping it:** it calls the mark optional, and the mark is hidden from screen readers.
- **Cost of dropping:** `Index.jsx:57`, plus the two tests that pin it. Those are SC1's `lineText`
  (`tests/brainstorm/assistant-shared-categories.spec.js:127`) and D1's "◐ is aria-hidden" check
  (`test/assistant-shared-categories.test.js:452`). It is a small follow-up, not a reason to hold the story.
- **If the owner wants a mark:** a CSS-drawn half-filled circle sized in `em` renders the same everywhere.

## Concept-graph integrity
- [x] No concepts, handles or definitions are touched, so there's nothing to reinstall. No new code needs
  `/summaries`.

## Things tests can't catch
- [x] The diff has no secrets, debug logging, `.only`, TODOs or commented-out code, and no hex-key literal.
- [x] No race: `shared` is a pure function of the one answer, and the refresh after the viewer's kind 10040 is unchanged.
- [x] Security: the card renders only constants, and `shared` is used as a key only after the allow-list check.
- [x] Principles 1–4: whose Map and whose Assistant come from the session (POV-first). The answer is re-derived per
  request and nothing is stored (view time). It is read-only (S4).

## House rules check
- [x] No new lint, typecheck or build tooling.
- [x] The TA pubkey is resolved at runtime, never typed. ADR 0015's `LEGACY_*` constants are untouched.

## Product-guide adherence
- N/A (no PRD; acceptance frame). The copy matches § Copy verbatim: the Shared pill, both line texts, the link, the
  screen-reader prefix and the three *Alert criteria*.

## Findings

### Blocking
None.

### Non-blocking
1. **The "Superseded in part" line says more of the old ADR still stands than does.**
   - Where: `engineering-team/decisions/done/assistant-trusted-content-status/0001-scores-lists-and-concepts-join-the-one-attention-answer.md:7`.
   - The line names only sub-decision 4's "only others" row and ends "The rest of this ADR stands". These parts no
     longer hold as written:
     - sub-decision 2's headline, "Done means the viewer's Assistant is among …" (`:160`), though its reading rules
       still stand;
     - sub-decision 4's done row, "the viewer's Assistant (alone or among others)" (`:186`), and its shape, which
       lacks `shared`;
     - sub-decision 6's failure shape;
     - the Context's AC-3 (`:18`).
   - The line's second sentence does state the new rule. Its wording also follows the Design note, which J1 approved.
   - Optional: name sub-decisions 2 (headline only), 4 and 6.
2. **A self-entry reads as "another Assistant"** (`src/api/assistant/trustedContent.js:68–69`, with
   `src/lib/treasureMapCategories.mjs:30–46`).
   - The rule never compares a delegate with the Map's author. So a viewer whose Map names their own key for a
     category gets **Done, Shared** and "Handled by another Assistant · Move it here →". Before this story, the same
     Map read Needs attention.
   - The interleaved, unratified draft (`05225a6`) says such an entry "creates no duty and designates no one"
     (`protocols/drafts/treasure-maps.md:330`).
   - This is AC-1's rule as written: the hub reads the Map as `/treasure-map`'s cards do, and the cards do the same.
     So it is not this story's defect.
   - When duty-menus-and-self-maps #3 reaches code, the hub's shared rule and the cards must learn self-entries
     together. Suggest a row tied to that book's code plan (its `_intake.md` entry from `05225a6`).
3. **The ◐ mark: recommend dropping it** (`ui/src/pages/assistant/Index.jsx:57`; see the section above).
4. **The "·" can be left dangling at the end of a line** (`ui/src/pages/assistant/Index.jsx:56–61`).
   - At 390 px the line breaks after " · ". The first line ends "…another Assistant ·", and "Move it here →" starts
     the next one.
   - Optional: keep "· Move it here →" together (a `white-space: nowrap` wrapper).
5. **The "muted" pill has the brightest text of the three pills.**
   - The neutral pill's text, `#cbd5e1`, has relative luminance ≈ 0.66. The Done green `#3fb950` is ≈ 0.36 and the
     Needs attention amber `#e3b341` is ≈ 0.49.
   - So it is quieter in hue but not in brightness. AC-2's "muted … not green" is met by its grey and by D3's checks.
     The owner's eye decides "quieter".
   - If it should be quieter, a hub-only dimmer text colour would still clear 4.5:1.

### Harness friction
1. **A Light Design note superseded a sub-decision of a ratified ADR.** Every earlier "Superseded in part" line in
   `decisions/` names a superseding ADR (`treasure-map-edit/0001:8` also cites a book decision, then ADR 0002).
   `light-profile.md`'s trigger list doesn't say whether reversing a ratified ADR's decision is itself a trigger. I
   ratified, because no listed trigger fires, but the profile should say. Candidate `meta` row.
2. **The Implementer's full-suite record is on a commit that the rebase orphaned** (`035c80ea`, not an ancestor of
   `staging`), and the story's Implementation section doesn't name the commit. This is a recurrence of ledger
   `2026-10-11-phase-docs-cite-rebased-hashes`; suggest a recurrence note there. My run at HEAD replaces it for this
   review.
3. The "How to run" command hard-codes :7799, which another session held during this review. Ledger
   `2026-10-09-judge-workspace-and-served-build` already covers this. Following its fix shape (my own directory, a
   served build named by asset hash) worked, and it also tied the browser pass to what staging serves.

## Verdict
**PASS**

**Owner's Gate B verdict:** _(to be filled in by the owner)_

## On PASS (same commit — applied by the spawning session)
- [ ] Story `**Status:**` flipped to `Done` in place.
- [ ] Completion detection: this book has one story, so if the owner passes it, the acceptance frame's five bullets
  are each covered by an AC above. Whether to offer `/close-book` goes in the chat.
