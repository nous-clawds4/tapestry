# Review: Story 2 — Curated headers link with `pointer`, and the curation screens say "copy"

**Reviewer:** Claude (independent reviewer subagent)
**Date:** 2026-09-12
**Diff:** `git diff 537f8001 8f8d5fd9` (commit `8f8d5fd9`, 15 files). Context, read and not under review: `51811247`
story, `36a3c0dc` ADR 0002, `537f8001` failing tests; the story's cycle starts at `22fe7f28`.
`git diff --stat 537f8001 8f8d5fd9 -- test/` is empty: the implementation commit touches no test.

- Story: `engineering-team/stories/curated-dlist-update/2-pointer-header-and-copy-wording.md`
- ADR: `engineering-team/decisions/curated-dlist-update/0002-pointer-switch-and-copy-wording.md`
- Test plan: `engineering-team/stories/curated-dlist-update/2-pointer-header-and-copy-wording.test-plan.md`
- Upstream contract: ADR `curated-dlist-update/0001` (with Amendment 1); `protocols/drafts/assistant-designation.md`
  § "Per-DList curation entries" / "Curation copies"; `engineering-team/epics/curated-dlist-update.md` § "Settled at kickoff".

> **At a glance.** No blocking items. Two notes worth the operator's attention: Non-blocking 1 is an optional
> rewording of one BIBLE glossary clause. Non-blocking 2 is a story-5 carry-forward: the endpoint and the detail page
> disagree about a header that carries `b-tag-deferred` beside its link.

## Quality gates (run by reviewer, not trusted)

- [x] **The six story suites**, each through its exported `run()` (node v24.18.0; OPEN.md row 310's method): **112
      passed, 0 failed**:
      - `curated-dlist-update-pointer-switch` 12/0
      - `dlist-curation-header-endpoint` 29/0
      - `my-curated-dlists-headers` 16/0
      - `my-curated-dlists-items` 23/0
      - `dlist-curation-map-entries` 14/0
      - `dlist-curation-panel` 18/0

      This matches the Implementer's 112/0.
- [x] **The tests fail without the change.** I ran the same six suites against a read-only `git archive` snapshot of
      `537f8001` in the scratchpad (the tests commit, before the implementation). Results: 2/10 · 22/7 · 14/2 · 20/3 ·
      13/1 · 17/1. The new suite fails U1–U3, S1–S4 and D1–D3. This is exactly the test plan's § Verification.
- [x] **Other suites that read the changed files**, run statically through `run()`:
      - `treasure-map-relay-sync` 22/0
      - `dlist-curation-tl-panel` 19/0
      - `dlist-curation-merge-preserve` 16/0
      - `my-curated-dlists-page` 19/0
      - `tl-treasure-map-optin-publish` 23/0
      - `tl-treasure-map-panel` 18/0
      - `treasure-map-panel-summary` 18/0

      `treasure-map-relay-presence` opens relay connections, so it ran only in the full run: 35/0. A sweep of `test/`
      finds no suite outside the six that pins any string this story changed.
- [x] **Full `npm test`**, 14:36–15:22, output to a scratchpad file. `BRAINSTORM_PUBLISH_LOCAL_ONLY` was unset and the
      publish posture was not changed.
      - **Suites:** 173 suite lines: 166 PASS, 4 SKIP, 3 FAIL.
        - SKIP (preconditions not met): `tag-detail-publish`, `tag-index-publish`, `authored-tagging-publish`,
          `profile-tag-polish-publish`.
        - FAIL: `tl-membership-method-selector`, `tl-weighted-sum-method`, `tl-certainty-method`.
      - **Failing tests:** exactly four — the three L0 GUARD refusals and the refused LP prune. These are OPEN.md row
        191's four.
      - **Row 261:** its two LB matrices skipped (Meili did not settle); they did not fail.
      - **Overall:** `FAIL`, exit 1, from those known reds only.

      As in the Implementer's run, the live publish-flow suites exercised the stack's publish paths under the
      operator's external-publish posture.
- [x] **`bash scripts/harness-lint.sh`** at `8f8d5fd9` → `harness-lint: clean (0 violations)`. The rest of the output
      is the standing WAIVED/INFO lines. Once this review is saved, rule L1 reports the story until its Status reads
      `Done` (§ On PASS).
- [x] **`npm run test:playwright`**: not applicable, because the test plan has no Playwright half. The test plan hands
      rendering to "the reviewer's live check", so a headless read-only render stood in for it (§ Live checks, item 3).
- [x] **Hygiene.**
      - `git diff --check 537f8001 8f8d5fd9` is clean.
      - No added code line carries a 64-hex literal or a pubkey prefix (`82b75e47`, `11f23fe4`, `253d40c4`, `8e901369`).
      - No `console.log`, `debugger` or `TODO` was added.
      - No `dangerouslySetInnerHTML` appears in the four JSX files.
      - No dependency or lockfile changed.
- [x] _Lint / typecheck / build not configured — skipped._ No new tooling.

## Live checks (read-only)

1. **dcosl, real events.** I sent a read-only REQ for kind 39998 `#d: dog-breed` to `wss://dcosl.brainstorm.world`. It
   returned five headers. I ran each through the shipped `classifyExisting` (server) and through `describeCurationHeader`
   and `linkTypeLabel` (UI):

   | Author | `b` | `classifyExisting` | `problems` | `notes` | Label |
   |---|---|---|---|---|---|
   | `11f23fe4…` (community header) | `pointer` to itself | `exact` | none | none | none |
   | `253d40c4…` | `inherit-items` to the community header | `older` | none | `older-link` | "older link" |
   | `8e901369…` | `inherit-items` to the community header | `older` | none | `older-link` | "older link" |
   | `919ba08a…`, `a68dbf56…` | none | `unpointed` | `no-b` | none | none |

2. **Served bundle.** I checked `index-LJHgOsij.js` (the bundle `:7778` serves) and its seven chunks.
   - All eight new strings are present: "copies in the community items its curation method accepts", "Also show
     candidates to copy", "which candidates to copy", "offers no candidates to copy", "older link", "It uses the older
     link type; Update list will upgrade it to", "Its link to the shared header is typed", and "copies from".
   - None of the six old strings is present: "inheriting the community", "never duplicating", "candidates to inherit",
     "inherits from", "not inherit-items", "Its pointer type is".
   - The container's `src/api/dlist-curation/index.js` matches the branch by md5.
3. **Headless render.** I used playwright-core 1.56.1 with `executablePath` pointed at the cached chromium-1228 (OPEN.md
   row 232's workaround).
   - **Stubbed:**
     - `/api/auth/status` and `/api/auth/user-classification`: a synthetic user whose assistant is `253d40c4…`,
       resolved at runtime from local strfry.
     - The kind-10040 scan: a synthetic Map with one `39998:dog-breed` entry naming that assistant.
   - **Real:** both the older-link header and the community header come from local strfry.
   - **Safety:** a route guard would abort every non-GET request except read-only `/api/neo4j/query`. Nothing was
     aborted. The only clicks were two disclosures, the Curation method panel and the DList Curation panel. No page
     errors occurred.
   - **Detail page** (`/tapestry/grapevine/curated-dlists/39998%3Adog-breed`):
     - "Your assistant's DList header" shows "Points to 39998:11f23fe4…3767:dog-breed (older link)". Below it: "It uses
       the older link type; Update list will upgrade it to “pointer”."
     - The section contains no ⚠️. The note's computed style equals the "Points to" line's (`rgb(230, 237, 243)`,
       weight 400).
     - The shared header is found and shown.
     - The method panel reads "It will set how your assistant decides which candidates to copy — …". The checkbox reads
       "Also show candidates to copy".
     - Update list is `disabled`.
   - **Treasure Map page:**
     - The Curated DList row reads "copies from 39998:11f23fe4…3767:dog-breed (older link)".
     - The DList Curation panel shows AC-4's description verbatim.
   - Neither page's visible text contains "inherit"; the raw-JSON toggles were closed.
   - **Not exercised:** a real Add. It needs a genuine NIP-07 session, and it signs and publishes. H15 covers the
     older-link path with fakes (Harness friction 1).

## Spec adherence

| AC | Tests (all passing) | Code | Live evidence | Result |
|---|---|---|---|---|
| AC-1 | endpoint U4 (exactly one `["b", <target>, "pointer"]`); U5 and U6 (fresh and unpointed paths); H8 (the signed template); H13 (unpointed: `pointer` appended) | `src/api/dlist-curation/index.js:95` (`contractB`), used at `:98` and `:115` | a real Add was not run | Met |
| AC-2 | endpoint U3 covers the five states: untyped or `''` → `exact`; `inherit` or `curates` → `conflict`; the older link to another target → `conflict`; the sentinel beside the pointer → `conflict`. H6. H15: older → 200 `existing:true`, returned unchanged, nothing signed or published. H7: another type → 409, `b` returned verbatim | `:74–84`, `:279–281` | both dcosl older-link headers → `older` | Met |
| AC-3 | new U2 and S3; headers U2, U3, U4 | `ui/src/utils/treasureMap.js:455` (`wrong-type`), `:457` (`notes`); `CuratedDListHeaders.jsx:36`, `:40–43`, `:156–158`. The shared-header lookup (`CuratedDListDetail.jsx:48`) depends on the coordinate, not the type | render: plain note, "(older link)" label, no ⚠️, shared header shown | Met |
| AC-4 | panel S4; items S1 and U9; new S1, S2, S4 and U1; map-entries S3 | `DListCurationPanel.jsx:15`; `CuratedDListItems.jsx:47`, `:158`; `treasureMap.js:619`; `TreasureMapTagsPanel.jsx:221`, `:223`; `CuratedDListHeaders.jsx:153` | bundle strings; no "inherit" on either page | Met. The wrong-type warning quotes an unexpected type as data (“inherit”). That is the ADR's stated reading of AC-4 (Context, "A tension inside the story"); accepted |
| AC-5 | new U3; items U6 | `treasureMap.js:579–588`: the "referenced" set holds only index 1 of `q` tags on items my assistant filed under my list. Matching is unchanged (the id, or the 39999 coordinate) | — | Met (see note below) |
| AC-6 | new D1, D2, D3 | table below | — | Met (Non-blocking 1) |
| AC-7 | R1 and R2. Every other test in the five re-aimed suites is unchanged and passing, including items S3 (Update disabled) and R4 (Simple Lists untouched) | no Map-entry or revoke code, import control (`CuratedDListHeaders.jsx:71–110`) or Simple Lists file changed | render: Update list `disabled` | Met |

**AC-5 and ADR 0001.** ADR 0001 §5 (`assistant-designation.md:106`) defines "already copied" as a `q` naming the
original's address for a 39999 original, and its id otherwise. The code also matches a 39999 original by a version's
id. That superset is sanctioned by ADR 0002 §4 ("matching is unchanged") and by test-plan E7. Every copy the spec
defines carries the version-id `q`, so the two rules agree on every conforming copy.

### AC-6 — is each changed sentence true at `8f8d5fd9`?

| Location | Now reads (substance) | True at `8f8d5fd9`? |
|---|---|---|
| `protocols/drafts/inherit-from.md:4` | No emitter since story 2; new curated headers link with `pointer`. Earlier headers keep `inherit-items` until their assistant upgrades them in Update's preview. Copies arrive from story 5. | Yes |
| `BIBLE.md:1079` (§ Assistant Keys) | Since story 2 the endpoint writes `"pointer"`; earlier headers keep `inherit-items` until Update upgrades them. Nothing copies items until story 5. | Yes |
| `BIBLE.md:1546` (glossary `b tag` row) | No emitter since story 2; new headers link with `"pointer"`. "Older ones are upgraded by Update, and items are copied from story 5." Cites `curated-dlist-update` ADR 0001 by name. | Yes, except the upgrade clause's bare present tense (Non-blocking 1) |
| `BIBLE.md:1630` (§25 status) | No emitter since story 2; the endpoint writes `pointer`. Earlier headers keep `inherit-items` until Update upgrades them. Copies (link kept) arrive from story 5. | Yes |
| `BIBLE.md:8` (`Last updated`) | A chained note, "— curated-dlist-update #2; prior: …", in the same commit (L9). | Yes |
| `protocols/drafts/assistant-designation.md:173` | Partly wired: since story 2 the endpoint writes `pointer` and treats the earlier link as existing ("Update upgrades it, story 5"). Nothing copies items yet (stories 3–5). | Yes |

**"No emitter" verified.** Outside `test/` and the docs, `inherit-items` appears in code only in the two recognizers
(`src/api/dlist-curation/index.js:29`, `ui/src/utils/treasureMap.js:242`) and their comments. No composer, firmware,
setup file or script writes it.

**Sweep for leftover present-tense claims.**
- Searched for: `still writes`, `until story 2`, `stops emitting`, `loses its emitter`, `still emits`.
- Searched in: `protocols/`, BIBLE, `docs/`, `engineering-team/stories/_intake.md`, OPEN.md, the epic, the book,
  `product-team/`, AGENTS, README, OPERATIONS, `.claude/` and the workflows.
- What remains is timed wording that is now true, plus the chained history inside `BIBLE.md:8`:
  - handoff D11, `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:173`;
  - the ADR 0003 annotation, `decisions/done/dlist-curation/0003-inherit-items-facet.md:7`;
  - the intake closing line, `_intake.md:2342`;
  - OPEN.md row 259's note;
  - the epic, `:54–55` and `:74–75`.

Story 1's round-2 notes for this story are both honored. Copies stay tied to story 5 everywhere the "until then"
qualifier was dropped, and the glossary cites the epic's ADR by name.

## ADR adherence

| Note | As specified? | Where |
|---|---|---|
| 1 server | Yes | constants `:24–29` (commented, pointing at the UI mirror); `classifyExisting` `:64–84` (doc comment rewritten); handler `:279`; composer `:95`; comments `:12` and `:86–92`; exports unchanged (`:317–328`) |
| 2 UI util | Yes | `CURATION_LINK_TYPE` and `OLDER_LINK_TYPE` `:238–242`; `linkTypeLabel` `:244–253`; `communityPointerOf` comment `:256`; `describeCurationHeader` `:429–465` (its `@returns` includes `notes`); `curatedItemRows` `:551–594`; `itemsEmptySentence` `:619` |
| 3 detail headers | Yes | `CuratedDListHeaders.jsx:36`, `:40–43`, `:153`, `:156–158` |
| 4 Map entry line | Yes | `TreasureMapTagsPanel.jsx:221`, `:223`; file comment `:26` (logged) |
| 5 items | Yes | `CuratedDListItems.jsx:47`, `:158` |
| 6 panel | Yes | `DListCurationPanel.jsx:15` verbatim; comment `:14` (Non-blocking 4) |
| 7 docs | Yes | verbatim, except §25's kept link (logged) and `BIBLE.md:8`'s fuller note |
| 8 annotations | Yes | house form and short-name citation (below) |
| 9 local check | Partly (logged) | The Implementer checked the pages but ran no real Add (logged). I repeated the page checks independently. |

**Layering.** Every rule stays in a pure function (`treasureMap.js`, or the endpoint's pure helpers). The response shape
the panel reads is unchanged. No new dependency was added. Option B was not taken: `src/lib/bValueForms.js` and
`ui/src/utils/bDisposition.js` are untouched (R2).

**Annotations (Decision §8).**
- Each carries a Status parenthetical and a one-line "Superseded in part (2026-09-12)" note under its header block.
  Each cites `curated-dlist-update` ADR 0002 by short name, not by path (row 312's lesson):
  - `decisions/done/dlist-curation/0004-…:3` and `:8`;
  - `decisions/done/dlist-curation/0006-…:3` and `:7`;
  - `decisions/done/my-curated-dlists/0002-…:3` and `:9`;
  - `decisions/done/my-curated-dlists/0003-…:3` and `:8`.
- Each note is accurate against the code.
- Every done/ ADR that mentions `inherit-items` now carries an annotation.
- Story 1's two annotations (`done/dlist-curation/0002` and `0003`) still cite ADR 0001 by full path. That belongs to
  row 312, not to this story.

**Logged deviations judged.**
1. The `TreasureMapTagsPanel.jsx:26` file comment ("copies from") and the epic's § Decisions bullet
   (`engineering-team/epics/curated-dlist-update.md:76–79`): accepted. The comment follows Decision §6's principle, and
   the bullet is the house bookkeeping that story 1's review asked for (its NB 8).
2. BIBLE §25 keeps its link to `assistant-designation.md` § "Curation copies": accepted. The target
   (`assistant-designation.md:96`) exists, and the words are otherwise the ADR's.
3. Carry-forwards left as they are: verified. Each says the endpoint stops emitting `inherit-items` in (or with) story
   2, which is true at this commit. ADR 0001 Amendment 1's "until then … still writes it" qualifier is gone from every
   site that had it.
4. The local check without a real Add: accepted. H15 covers the older-link path, and a real Add signs and publishes.

**Unlogged, harmless.** The COPY comment (`DListCurationPanel.jsx:14`) appends "; ADR curated-dlist-update/0002
Decision §5" to the ADR's text. `BIBLE.md:8` adds a section prefix and a parenthetical to the ADR's sketch. No action.

## Concept-graph integrity
- [x] No concept, schema or property change, and no handle introduced. The orientation handles
      (`39998:<TA>:list`, `…:shared-concept`, `…:tapestry-assistant`) keep `kind:pubkey:slug` form.
- [x] Firmware reinstall not required (ADR Consequences).
- [x] `/summaries`: not applicable (no concept code).

## Things tests can't catch
- [x] No secrets, no debug logging, no commented-out code.
- [x] **Error paths.** `linkTypeLabel` never throws (U1). `notes` is always an array (U2, including garbage and no-`b`
      headers). `NOTE_SENTENCES` holds the only note `describeCurationHeader` emits.
- [x] **Rendering safety.** Type strings from relays reach the page only as React text: the curly-quoted label and the
      wrong-type sentence. There is no `dangerouslySetInnerHTML`.
- [x] **Concurrency.** Nothing new; the handler's scan-then-sign order is unchanged.
- [x] **Server and UI on real data.** The two classifiers agree on every live dog-breed header (§ Live checks). They
      diverge on one synthetic shape (Non-blocking 2).

## House rules check
- [x] Concept Graph API authority respected (no concept claims).
- [x] No new lint, typecheck or build tooling.
- [x] No hardcoded TA pubkey. The diff touches none of ADR 0015's `LEGACY_*` files.
- [x] **The four invariants:**
      1. POV: nothing is scored or filtered.
      2. No write-time gating: the endpoint's states concern only the caller's own assistant's header, and the change
         accepts one more existing form.
      3. Nothing stored: `describeCurationHeader` derives on each read.
      4. No graph write: the header stays a letter, and the UI is display-only.

## Product-guide adherence *(when the story traces to a PRD)*
Not applicable (no PRD). The panel text is the operator's (`curated-dlist-update` /discuss, 2026-09-11) and renders
verbatim.

## Findings

### Blocking
None.

### Non-blocking
1. **`BIBLE.md:1546`: the one AC-6 site that states the upgrade in bare present tense.** It reads "older ones are
   upgraded by Update". At `8f8d5fd9` nothing upgrades them: Update list is a disabled placeholder, and the render shows
   "Update list isn't built yet". The other sites time it:
   - "keep `inherit-items` until Update upgrades them" at `:1079` and `:1630`, and similar wording at `inherit-from.md:4`;
   - "(Update upgrades it, story 5)" at `assistant-designation.md:173`.

   AC-6 itself says "older ones are upgraded by Update (story 5)".

   Not blocking, for three reasons:
   - The words are ADR 0002's prescribed text (Implementation note 7).
   - The trailing "from story 5" can be read as covering both clauses.
   - The book ships as one branch, so story 5 makes the clause true before merge. The story accepted the same posture
     for the panel's "Update list" promise.

   Optional: "older ones keep it until Update upgrades them (story 5)". Similarly, `assistant-designation.md:173` ties
   copying to "(stories 3–5)", although only story 5 copies (also ADR text). Both are a mild instance of OPEN.md row
   277's class.
2. **The endpoint and the detail page disagree when a header's link sits beside the `b-tag-deferred` sentinel.** The
   code is `src/api/dlist-curation/index.js:74–84` and `ui/src/utils/treasureMap.js:445–465`. Synthetic events run
   through the shipped functions:
   - `[["b","b-tag-deferred"], ["b", <target>, "inherit-items"]]`: `classifyExisting` returns `conflict`, so Add answers
     409. But `describeCurationHeader` reports no problems and `notes: ["older-link"]`, so the page says "Update list will
     upgrade it".
   - `[["b","b-tag-deferred"], ["b", <target>, "pointer"]]`: `classifyExisting` returns `conflict`, while the page shows
     a clean header.

   Both halves are deliberate:
   - ADR 0002 §1 keeps "the sentinel counts as a `b`", and endpoint U3 pins it.
   - The page follows the house rule that a real `b` beats the sentinel (`bDisposition.js`; `my-curated-dlists` ADR
     0003 sub-decision 9).

   The shape predates this story, so nothing changes here. No live header has this shape: the five dcosl dog-breed
   headers all agree. However, ADR 0002's Consequences say story 5 "upgrades exactly the headers `classifyExisting` and
   `describeCurationHeader` mark as `older`", and for this shape the two disagree. For story 5's Architect: name the rule
   that gates the upgrade, and say whether the upgrade keeps the sentinel. Candidate ledger row below.
3. **`engineering-team/decisions/done/my-curated-dlists/0003-items-method-and-update.md:3` / `:8`: the annotation misses
   one prescription.** It names sub-decision 2 and Amendment 1, as Decision §8 lists. But the same ADR's Implementation
   note 3 (`:178`) also prescribes the checkbox label "Also show candidates to inherit", which is now "…to copy"
   (`CuratedDListItems.jsx:158`). Optional: add "and the candidates checkbox label" to the note.
4. **`ui/src/pages/grapevine/DListCurationPanel.jsx:14` and `BIBLE.md:8`:** the two unlogged wording differences
   described under ADR adherence. No action.
5. **`ui/src/pages/grapevine/DListCurationPanel.jsx:260` (pre-existing wording): the 409 sentence says "pointing
   elsewhere".** Conflicts now also include a header for the same list with another type (`inherit`, or an unknown
   value), for which "elsewhere" is inaccurate. Before this story the same was true of a same-list `pointer` header.
   The `b` tags print beneath the sentence, so the user can see what is there. Optional, when story 5 touches the panel:
   "…has a header for this list with a different link".

### Candidate ledger rows (not written; this book's rows are renumbered at the next staging merge)
- **Type `bug?`, latent until story 5:** Non-blocking 2. The server's `classifyExisting` and the UI's
  `describeCurationHeader` disagree on a header carrying `b-tag-deferred` beside its link. Story 5's Update must pick
  which rule gates the upgrade, and whether the sentinel survives it. Pointer: this review, Non-blocking 2.
- **Type `meta`:** Harness friction 1.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **Coverage a test plan delegates to a live check has no fixed owner, and half of it cannot be done.**
   - The test plan hands rendering and a real Add to "the reviewer's live check" (§ Edge cases). ADR 0002's
     Implementation note 9 gives the same local check to the Implementer (cycle-local). The review brief marks live
     checks optional. Neither workflow 5 nor the review template has a slot for delegated coverage.
   - The real-Add half cannot be done by any automated role: the endpoint needs a signature-verified NIP-07 session,
     and it signs and publishes, which a Reviewer may not do.
   - Here nothing fell through. The Implementer's check and this review's render cover the pages, and H15 covers the
     older-link path with fakes. But it could fall through.

   Candidate fix: the test-plan template's "Not covered" items name an owner (the Implementer's cycle-local check, or
   the Reviewer's gate). The review template gains a line, "Live checks the test plan delegates" (run or not run, and
   why). A check that needs a NIP-07 signature is marked "operator only" and is never assigned to the Reviewer.
   Candidate row, type `meta`.
2. **Corroborations, no new row:**
   - **Rows 198 and 226:** CLAUDE.md § House rules still says the repo is bind-mounted. `docker inspect tapestry` shows
     only the four named volumes. The Implementer had to sync `src/` by hand, and the container's `ui/src` copies are
     stale while the served bundle is current.
   - **Row 232:** Playwright needed `executablePath`.
   - **Row 276:** suites were run through `run()`.
   - **Row 191:** exactly its four failures.
   - **Row 261:** the LB matrices skipped.
   - **Row 277:** Non-blocking 1 is a mild, ADR-prescribed instance.
3. **Informational:** the full run took 46 minutes here (the brief expected about 10), with reviewer checks running
   alongside. The slow part was the live TL publish-flow suites.

## Verdict
**PASS** — AC-1 through AC-7 are met, and each has passing tests.
- The tests fail on the pre-change code exactly as the test plan records.
- The implementation matches ADR 0002's Decision and Implementation notes. There are four logged deviations, all
  accepted, and two unlogged wording differences, both harmless.
- Every changed doc sentence is true at `8f8d5fd9` and keeps copies tied to story 5.
- The two live older-link headers classify as `older` and render as the plain note.
- harness-lint is clean. The full `npm test` is red only on row 191's four known failures.

There are five non-blocking notes; the second is a carry-forward for story 5.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place, and its `Review:` line pointed at this file — by the
      orchestrator, in the review commit (the launching brief reserved story edits and commits for it).
- [x] Completion detection performed; the result is reported in the chat, not in this file.
