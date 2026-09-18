# Review: Story 4 — The curation method panel shows my method, a cutoff, and each candidate's verdict

**Reviewer:** Claude (independent reviewer subagent)
**Date:** 2026-09-13
**Diff:** `git diff b0fdea2e e1484040` (implementation, commit `e1484040`, 9 files). The implementation commit touches
no test file. Also read, not under review: `bc434d58` story, `502badc4` ADR 0004, and `git diff 502badc4 b0fdea2e` (the
Tester's suite, the S3 re-aim, the `test/test.js` registration, the test plan, OPEN.md row 314 and the epic's story 5
note).

- Story: `engineering-team/stories/done/curated-dlist-update/4-curation-method-panel.md`
- ADR: `engineering-team/decisions/done/curated-dlist-update/0004-curation-method-and-verdicts.md`
- Test plan: `engineering-team/stories/done/curated-dlist-update/4-curation-method-panel.test-plan.md`
- Epic and book: `engineering-team/epics/curated-dlist-update.md` (§ "Settled at kickoff", story 5's entry);
  `engineering-team/audits/curated-dlist-update/book.md`.

OPEN.md row numbers below are as on this branch, after the 2026-09-17 staging merge renumbered this book's rows
276–280 to 310–314. At `origin/staging`, rows 276–279 are different items (Harness friction 3).

> **At a glance.** No blocking items. The code does what ADR 0004 says, and every deviation it takes is recorded
> and fair. Simple Lists computes as before: 500 differential cases, the characterization table, and my own headless
> render of its items page all agree.
>
> What matters is for **story 5**, because Update will act on these verdicts. Four ways a read can come back
> incomplete without saying so reach beyond row 314:
> - a partly read shared list (Non-blocking 1);
> - Follow List with no follow list here (Non-blocking 2a);
> - a Trusted List read by d-tag from any author (Non-blocking 2b);
> - a capped relay answer (Non-blocking 3).
>
> There is also a URL-length ceiling on large lists (Non-blocking 4). It fails honestly, as "couldn't check". Each
> is harmless on a page that only reads. Before story 5 each needs a row, or a line in the epic's story 5 note. The
> other three findings (Non-blocking 5–7) are cosmetic.

## Quality gates (run by reviewer, not trusted)

- [x] **The six story suites**, each through its exported `run()` (OPEN.md row 310's method): **107 passed, 0
      failed**:
      - `curated-dlist-update-curation-method` 24/0
      - `my-curated-dlists-items` 23/0
      - `curated-dlist-update-read-only-curation` 13/0
      - `curated-dlist-update-pointer-switch` 12/0
      - `my-curated-dlists-page` 19/0
      - `my-curated-dlists-headers` 16/0
- [x] **Every other suite whose source names a changed file** (found by grep over `test/`), through `run()`: **228
      passed, 0 failed**. These are the four neighbours the brief named:
      - `dlist-curation-panel` 18/0
      - `dlist-curation-map-entries` 14/0
      - `tl-treasure-map-panel` 18/0
      - `treasure-map-relay-presence` 35/0

      and eight more:
      - `dlist-curation-merge-preserve` 16/0
      - `dlist-curation-tl-panel` 19/0
      - `relay-scan-bounds` 28/0 (its live half only GETs)
      - `scheduled-search-and-house-scores-refresh` 12/0
      - `tl-treasure-map-optin-publish` 23/0 (a source-read suite; it makes no request)
      - `treasure-map-panel-summary` 18/0
      - `treasure-map-relay-sync` 22/0
      - `treasure-maps-router-preset` 5/0

      Together, 18 suites and 335 tests, with 0 failures.
      - The other modules that import the changed files are JSX pages, or hooks with extensionless imports. A Node
        suite can't load them, so it only reads their source, which is unchanged.
      - Only this story's suite and the items suite read the two changed docs.
- [x] **The tests fail without the change.** I ran the suites on a `git archive` snapshot of `b0fdea2e` (the tests
      commit) in the scratchpad:
      - the new suite: 2 passed, 22 failed — U1–U13, S1–S8 and D1 fail; R1 and R2 pass;
      - `my-curated-dlists-items`: 23/0.

      That is the test plan's § Verification exactly. Two other suites went red in the snapshot only because it left
      out files outside `ui/src/`, `test/` and `engineering-team/` (as in story 3's review, Harness friction 4).
- [x] **Full `npm test`: not re-run.** The brief scopes it: it takes about 50 minutes, and the story's § Deviations
      records a run. That run had 167 suites passing, 4 failing and 4 skipped. The five failing tests are row 191's four
      and `summaries-element-count` L5, which was red before any change.
      - My one specific doubt was that another suite reads the changed files. The 18 suites above settle it.
      - Nothing in the server imports `ui/src`.
- [x] **The UI build.**
      - `vite build` of `e1484040` into the scratchpad produced `index-B_BqLgJw.js`. That is the name of the bundle
        the `tapestry` container serves, so the Implementer's local check ran on this exact code.
      - The served bundle carries "Change them on Trust Determination", the browser-only line,
        `tapestry_curation_cutoff:` and "candidates qualify". It carries none of the placeholder's sentences.
      - The UI's esbuild (0.27.3) transforms all seven changed source files.
- [x] **`npm run test:playwright`: not applicable.** The test plan has no Playwright half. A read-only headless render
      stood in for it (Playwright 1.56.1 with `channel: 'chrome'`, per row 213). Every request that was not a GET was
      to be aborted, except the read-only Cypher POST; none was attempted. Nothing was signed.
      - **Simple Lists' items page** for the shared `dog-breed` list (`39998:11f23fe4…:dog-breed`):
        - under the default method (Trusted Assertions (rank)), sheep dog and golden retriever each 0.000, and
          "Items qualifying: 0 of 2 (score ≥ 2)";
        - under Trust Everyone, set only in the script's own throwaway browser context, each 1.000 and "0 of 2";
        - no page errors.

        These are the Implementer's "after" numbers, now rendered by the shared module.
      - **The curated detail page, signed out:** "Sign in with a nostr extension (NIP-07) to open your curated
        DLists.", with no page errors. So the two new hooks ahead of the early return don't break the page.
      - **Not repeated:** the signed-in half (no NIP-07 signer). The structural tests and the Implementer's recorded
        check cover it.
- [x] **`bash scripts/harness-lint.sh`** at `e1484040`: clean (0 violations), apart from the standing WAIVED and INFO
      lines. Once this review is saved, rule L1 reports the story until its Status reads `Done` (§ On PASS).
- [x] **Hygiene.**
      - `git diff --check b0fdea2e e1484040` is clean.
      - No `console.*`, `debugger` or TODO is added.
      - No added code line carries a 64-hex literal or a pubkey prefix. The only prefixes are in the story's
        Deviations prose.
      - No `package.json` changes, so there is no new dependency.
- [x] _Lint and typecheck are not configured, so they were skipped. There is no build step beyond the UI's, checked
      above._

## Spec adherence
- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped. Row 280's limit on AC-4 was accepted at the Test Design gate (Open question 4)
      and is filed.
- [x] No behavior is added beyond the story. The two extra summary sentences are recorded (Deviation 4), and both are
      conservative.

| AC | Tests (all passing) | My own check |
|---|---|---|
| AC-1 the panel shows my method | S5, S4, S7, U13 | `CuratedDListItems.jsx:76–109`. Closed on load (`useState(false)`); the method from `useTrust()` and `SCORING_METHODS`, with the list's d-tag or "no list chosen"; "Point of view:" with name and short pubkey; the link; "Cutoff (≥)" with step 0.1 and `parseFloat(v) \|\| 0` (`:97`); the rule sentence; the browser-only line. The cutoff is kept per list under `tapestry_curation_cutoff:<coord>` (`useCurationCutoff.js:6–7`, `:24–25`). |
| AC-2 verdict and reason; "N of M" | U11, S6, S5 | The Verdict cell, only on candidate rows (`:284–291`). A click opens Voter · Vote · Weight · Contribution · Note from the breakdown, including the author's implicit upvote and "Trust weight unknown" (`:157–186`). The summary goes up through a content-keyed effect (`:237–241`) to the panel's `summaryLine` (`:64–69`). |
| AC-3 decided exactly as Simple Lists | U1–U5, U11, U12, S2, S3, S6 | The frozen `SIMPLE_LISTS` copy is verbatim to `DListItems.jsx` at `502badc4` (compared by eye). `candidateVerdicts` scores through the shared module (`treasureMap.js:780–784`), matching each candidate by its current id. The cutoff is a prop, so an edit re-judges on the next render. My headless render agrees on Simple Lists' side. |
| AC-4 a failed read decides nothing | U6–U10, S5, S6 | Both sources, merged by id (`treasureMap.js:684–715`). A failed source, a capped local read or a weights error means every candidate is `unchecked` (`:769–779`). `checking` covers everything pending (`:764–768`). Row 280 is accepted; four further silent-incompleteness paths are in Non-blocking 1–3. |
| AC-5 nothing else moves | R1, R2, U5, S4, S6, S8, D1 | Simple Lists: import (`DListItems.jsx:11`) and three call sites (`:191`, `:229`, `:737`) only, and my render. Trust Determination: no setter anywhere in the new code. Read-only lists: no panel (`CuratedDListDetail.jsx:115–117`); `wanted` is false for `curator` `'other'` (`CuratedDListItems.jsx:216`), so no Verdict column. `useItemVotes([])` and `useTrustWeights([])` make no request. Nothing written; Update still disabled (`:118`). |

## ADR adherence
- [x] The changed files match Implementation notes 1–7 one for one.
- [x] Layering is respected:
  - a zero-import pure rule (`dlistScore.js`);
  - the util imports it with `.js` (`treasureMap.js:13`);
  - dependency-injected lookups, bound by hooks keyed on content;
  - the pages call the hooks.
- [x] No new dependency.

**Deviations from the ADR, each with its reference.** All six are recorded in the story's § Deviations; I found none
unrecorded.

| # | Where | ADR says | Code does | My reading |
|---|---|---|---|---|
| D1 | `ui/src/pages/lists/DListItems.jsx:11` | §1 and note 2: import all four functions | imports three; `classifyReaction` has no call site there | **Fair.** A fourth import would be dead code. S2 pins the three. |
| D2 | `ui/src/utils/dlistScore.js:17`, `:22`, `:43`, `:46`, `:64–65` | §1: "moved verbatim", and "never throws" | adds guards | **Fair.** The two ADR words conflict, and the guards resolve it. Only `:46` (own keys) changes a well-formed result — the intended crash-to-ignore of Open question 5, which I confirmed: `constructor`, `__proto__`, `toString` and `hasOwnProperty` all crashed the inline copy. `:43` also skips a non-array tag rather than reading its first character; that only differs for a malformed tag list. |
| D3 | `ui/src/pages/grapevine/CuratedDListItems.jsx:217–218` | §7: judge "while … the shared list read cleanly" | judges unless the shared list failed on both sources | **Defensible, not the only reading.** It matches story 3's `readCleanlyEnough` (`treasureMap.js:660`). Per candidate it is honest; its cost is Non-blocking 1. |
| D4 | `CuratedDListItems.jsx:237–239`, `:66–67` | §7 names four summary sentences | adds "⏳ Checking…" while the shared list loads, and "Verdicts incomplete — couldn’t check the shared list." when both sources failed | **Fair and conservative.** The hint would be wrong with the box on. |
| D5 | `ui/src/utils/treasureMap.js:688` | §2 names only the no-read for no ids | answers `local: 'ok'` and `relay: 'ok'` (`'skipped'` for a non-ws relay) | **Fair.** Nothing was asked and nothing failed. With no candidates there is nothing to judge. |
| D6 | `treasureMap.js:772` | §4: "more votes than one read returns" | "every vote (there are more votes than one read returns)" | **Fair.** It contains the ADR's words and completes "couldn’t check …". |

**Equivalent, not a deviation.** §4 writes the scoring per candidate, as `reactionsByItem(votes.events,
[candidate.id])`. The code credits all candidates in one call (`treasureMap.js:780`). A vote counts only for its first
`e`, so each candidate gets the same reactions either way, in the same order (U12's last case pins this).

**The other Deviations lines** (the brief's item 5), all fair readings:
- "Weights once the votes are in" is §3's content-keyed array (`CuratedDListItems.jsx:224–228`). The exact-ids guard in
  `useItemVotes` (`useItemVotes.js:33`) is stricter than §2 asked, and better: a new candidate is never judged on votes
  read for other ids.
- "Reasons joined with 'and'" and "display choices" are left open by the ADR. One of the display choices — three
  decimals — is Non-blocking 7.
- **Authorship** agrees with the history. The implementation commit touches no test file, and all 24 of the Tester's
  tests pass unedited. I can't see the agents themselves.
- **Local check** — corroborated by the matching bundle hash, the bundle's strings and my Simple Lists render (§
  Quality gates).
- **Regression** — see § Quality gates.

**The brief's three code questions.**
- **Rules of hooks.** `ItemsSection` calls every hook unconditionally, before any branching. The detail page calls
  `useCurationCutoff(open && !readOnly ? access.row.coord : null)` and `useState(null)` (`CuratedDListDetail.jsx:64–65`)
  after story 2's lookups and before the early return (`:68`), exactly as §6 and note 5 say.
- **Keys.** `useItemVotes` is keyed on the joined ids and the relay (`useItemVotes.js:23`). It cancels a superseded
  read, and answers only for the exact ids it read.
- **The cutoff.** `useCurationCutoff` never touches storage without a coordinate (`useCurationCutoff.js:6`, `:24`).
  Both storage accesses are in try/catch. `readStoredCutoff` keeps a stored 0 and turns `NaN`, `Infinity` or garbage
  into 2 (`treasureMap.js:798–802`).

## Concept-graph integrity
- [x] The story's handles are in `kind:pubkey:slug` form (`39998:<TA>:list`, `39998:<TA>:tapestry-assistant`). The
      code builds none.
- [x] No firmware reinstall is needed: no concept definitions change (ADR § Consequences).
- [x] Not applicable — no concept work, so there was nothing to orient on through `/summaries`.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging. The `console.log` lines in `useTrustWeights.js` predate this story and are untouched.
- [x] No commented-out code.
- [x] Error paths and edge cases are handled where it matters, with Non-blocking 1–4 as the residue for story 5.
- [x] Concurrency and races were considered:
  - **Votes.** A superseded read is cancelled, and the answer is matched to its key (`useItemVotes.js:26–33`).
  - **The summary.** It goes up on content change only (`CuratedDListItems.jsx:240–241`), so there is no render loop.
  - **Weights.** A stale answer is gated by own-key readiness (`treasureMap.js:724–731`).
  - **The point of view.** It can't change while the page is mounted: `setPovPubkey` and `resetToOwner` are called
    only from other pages.
  - **What remains** is one cosmetic flash (Non-blocking 6).
- [x] Security. The relay URL is the constant community relay, and every value goes through `encodeURIComponent`.
      Non-blocking 2b is a pre-existing read-time trust gap, not an injection.

**The four architecture invariants.**
- The verdicts are this viewer's and this browser's, and the panel says so.
- Votes from anyone are read ungated.
- Nothing is stored but the cutoff number.
- There is no graph write (principle 4).

## House rules check
- [x] The Concept Graph API's authority is respected (no concept work).
- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal (S8, and my grep of the added lines).

## Product-guide adherence *(when the story traces to a PRD)*
- [x] Not applicable. The book is an acceptance frame with no PRD, and there is no style or design guide to check.

## Findings

### Blocking
None.

### Non-blocking
1. **A partly read shared list gives a summary that looks complete** (`ui/src/pages/grapevine/CuratedDListItems.jsx:217–218`, `:68`).
   - **What happens.** D3 judges the candidates when one of the shared list's two sources failed, or when its local
     read was capped at 500. Each shown candidate's verdict is still honest: its votes are read from both sources. But
     "N of M candidates qualify" counts only the candidates that could be read, and nothing in the panel says so.
     Only the items section's source note does (`:256–258`), in another section of the page.
   - **Why it doesn't block.** AC-4 names votes and weights as its triggers, not the candidate read. The reading is
     recorded, and ADR §7's "read cleanly" can bear it.
   - **Ask:**
     - story 5 treats a partial candidate read as incomplete before Update proposes anything;
     - optionally now, the summary adds "(of the candidates that could be read)" when the shared list's `local` or
       `relay` failed or it was truncated.
2. **Two blind spots of `useTrustWeights` reach the verdicts, beyond row 314.**
   - **(a) Follow List with no follow list here reads as "follows nobody."** When this instance's strfry holds no kind
     3 for the point of view, every weight is 0 and no error is set (`ui/src/hooks/useTrustWeights.js:43–57`). Every
     candidate is then "✗ skipped · 0 < 2", not "couldn't check". A missing Treasure Map, by contrast, is an error
     (`:65–74`).
   - **(b) The Trusted List is read by d-tag from any author.** The hook scans `{ kinds: [30392], '#d':
     [trustedListId] }` with no `authors` and takes the newest (`:166`, `:180`). Trust Determination stores only the
     d-tag (`ui/src/pages/grapevine/TrustDetermination.jsx:175–186`, `:350`). So a newer kind 30392 with the same
     d-tag, from anyone, replaces the trusted set, and with it the verdicts. That is the read-time filter principle 2
     asks for, missing. No OPEN.md row mentions it.
   - **Why it doesn't block.** Both predate this story and are shared with Simple Lists, so AC-3 holds. ADR §3 keeps
     the hook unchanged. Both are harmless on a page that only reads.
   - **Ask:** before Update acts on these weights, record both for story 5:
     - (a) extends row 314's family: an absent answer read as a real one. Update could delete every copy on it;
     - (b) needs its own row, with the fix direction: bind the Trusted List by its coordinate (author and d-tag).
3. **A capped relay answer can be seen, for this relay — the brief's minor point 3** (`ui/src/utils/treasureMap.js:698–714`).
   - **What the relay advertises.** The community relay's NIP-11 document (`wss://dcosl.brainstorm.world`, strfry
     1.0.4, fetched read-only) gives `limitation.max_limit: 10000`. That is above `VOTES_LIMIT` (5000). So a capped
     relay answer holds exactly 5,000 votes, which the client can see.
   - **What the code does.** `lookupItemVotes` reports truncation for the local read only (`:714`), as §2's Decision
     specifies. So this matches the ADR, but its Consequences line ("a vote read over VOTES_LIMIT is 'couldn't check'
     rather than paged") reads as if it covered both sources. A relay whose cap is below 5,000 would still answer a
     capped read as complete.
   - **Why it doesn't block.** No candidate is near 5,000 votes, and the page only reads.
   - **Ask:** story 5 adds "relay answer of `VOTES_LIMIT` or more → incomplete" (one line). Record the lower-cap case
     with row 314.
4. **Large lists always read "couldn't check": an honest ceiling** (`ui/src/hooks/useItemVotes.js:7`, `ui/src/api/relay.js` `queryRelayBounded`).
   - **What happens.** Both vote reads send the whole `#e` list in a GET query string. I probed the local stack with
     read-only GETs to `/api/strfry/scan`, at about 73 URL characters per id:
     - 200 ids (a 14.6 KB URL) were answered;
     - 400 ids (29.3 KB) got HTTP 431 from Node.

     The container's nginx proxies the page's API calls (`docker/nginx.conf:40–43`) with no
     `large_client_header_buffers`. Its 8 KB default puts the deployed ceiling near 110 candidates.
   - **What the user sees.** Past it, both reads fail, so every candidate shows "⚠️ couldn't check". That fails in
     the honest direction, never "skipped".
   - **Weights.** The weights' `#d` read has the same ceiling (`useTrustWeights.js:99–107`) and fails honestly too.
     That ceiling predates this story and is shared with Simple Lists. Simple Lists' own vote reads don't hit it (one
     GET per item).
   - **Why it doesn't block.** ADR §2 chose one filter, and today's list has two items.
   - **Ask:** before story 5, batch the ids (for example 50 per read) or record the ceiling.
5. **The hint asks for a box that is disabled — the brief's minor point 1** (`CuratedDListItems.jsx:65`).
   - **What happens.** When the shared list is unavailable (no pointer, deliberately unaffiliated, or the header
     missing, failed or still checking), `sharedCoord` is null, so the summary is `hidden` (`:216`, `:237`). The panel
     then says "Turn on “Also show candidates to copy” to see which qualify." while the box is disabled (`:319`). The
     items section already says why (`:321`).
   - **Why it doesn't block.** It matches ADR §7, which prescribes the hint whenever candidates are not shown.
   - **Optional:** report the unavailability as its own summary state, for example "No candidates to judge — your
     assistant’s header names no shared list."
6. **A stale weights error can flash "couldn't check" — the brief's minor point 2.**
   - **What happens.** After a failed weights read, turning candidates off and on renders once with the hook's old
     `error`. `useTrustWeights`' early return keeps it (`useTrustWeights.js:28–31`), and `weightsState` checks it
     first (`treasureMap.js:726`). The result is one render — possibly painted — of "⚠️ couldn’t check" and
     "Verdicts incomplete — couldn’t check the trust weights (…)", then "checking", then the real answer.
   - **Why it doesn't block.** It is conservative, never "skipped". The hook is unchanged by ADR §3.
   - **Optional:** ignore an error that belongs to a different `pubkeys` array.
7. **"✗ skipped · 2 < 2" — the brief's minor point 4** (`CuratedDListItems.jsx:61`, `:146`).
   - **What happens.** `num()` rounds to three decimals, so a score a hair under the cutoff reads as equal to it.
   - **It is reachable under the default method.** For example, an author ranked 35 plus upvotes from voters ranked
     70 and 95 give 0.35 + 0.7 + 0.95 = 1.9999999999999998. Searching triples of whole ranks finds several such
     sums.
   - **Why it doesn't block.** Simple Lists excludes the same item and shows its score as "2.000"
     (`DListItems.jsx:517`, `:897`). So AC-3 holds, and the confusion is inherited. It is display only.
   - **Optional:** when the rounded score equals the rounded cutoff on a "skipped" verdict, show more digits.

**The docs** (the brief's item 6) are accurate.
- **ADR 0003.** `my-curated-dlists` ADR 0003 has its Status parenthetical and a one-line note citing `curated-dlist-update`
  ADR 0004 by short name, saying what changed (D1 pins this).
- **OPEN.md row 314.** It matches the code: `src/api/relay/fetchEvents.js:48–63` answers `success: true` with
  whatever `querySync` resolved, and `useTrustWeights.js:113` drops a `success: false` answer.
- **The epic's story 5 note.** It carries row 314 forward. Non-blocking 1–4 belong beside it.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **Story 3's Harness friction 1 is fixed by habit, not by a rule.**
   - **What was done.** This story discarded the Tester's satisfiability sketch, and a separate Implementer agent
     wrote the code from the ADR in its own worktree.
   - **It worked.** The independent reading surfaced three places where the ADR's text needed interpretation (D1, D3,
     D5), and the Tester's 24 tests passed the independent code with no edits. That is the signal a copied sketch
     can't give.
   - **The gap.** Nothing in the workflow requires it. Row 264's proposal still doesn't say whether Implementation may
     copy the sketch.
   - **Candidate:** when row 264 is adopted, require that the sketch is deleted before Phase 4, and that the
     Implementer works from the ADR in a fresh context.
2. **A plain `cd` into the Implementer's worktree pinned the orchestrating session there.**
   - **What happened.** The session's shell cwd persists between calls, unlike a subagent's. So the Implementation
     commit was made in the Implementer's worktree and fast-forwarded onto the book branch, with the operator's OK.
     The history confirms it is linear: `e1484040`'s parent is `b0fdea2e`.
   - **Candidate:** the cycle guidance tells an orchestrator to reach a worktree only through `git -C <path>` and
     absolute paths, never `cd`.
   - I found no existing OPEN.md row on this.
3. **This book's OPEN.md rows collide with staging's.**
   - **The collision.** The book's Ledger line reserved rows from 271 onward at kickoff. Yet at `origin/staging`
     `f5015a5f`, rows 276–279 are four different items (the auth-hardening follow-ups, the deploy-skill gap, the
     public-branch disclosure and the sandbox-security retirement). This branch's 276–279 were the run-a-suite gotcha
     and three reviews' meta rows; the 2026-09-17 merge renumbered them to 310–313.
   - **Row 280.** It was free on staging when this review ran, but staging already held 281–284, and other branches
     reportedly reached 285. It is this book's unreachable-relay row, renumbered to 314 at that merge.
   - **What the merge must do.** Renumber the rows, and repoint every citation of them in this book's artifacts,
     OPEN.md's own cross-row citations included (row 207). This review and the test plan cite row 310 as the
     run-a-suite gotcha; on staging, row 276 is the auth row.
   - **Related:** row 151 is the cross-machine case, and the 2026-08-10 numbering note sets out the current
     heuristic. A per-book reservation on this branch did not reach the sessions minting on staging.
   - **Candidate:** mint a book's rows on staging first, through a small docs PR (as #640 and #642 did); or keep one
     reservation line in OPEN.md's header on staging.

## Verdict
**PASS**

**Why.**
- Every acceptance criterion has a passing test, and I ran the gate myself: 18 suites and 335 tests, with 0
  failures. The tests fail without the change.
- The UI build is byte-identical to the bundle the Implementer checked. My own headless render shows Simple Lists
  scoring exactly as before.
- The implementation follows ADR 0004. Its six deviations are recorded, each is a fair reading, and none changes a
  contract.
- The one behaviour change to Simple Lists is the intended one: a vote aimed at an inherited property is ignored
  instead of crashing the page.
- Nothing blocks. What remains is story 5's to settle before Update acts: the four silent-incompleteness paths and
  the URL ceiling (Non-blocking 1–4). Each is harmless on this read-only page. The rest is cosmetic.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place — left to the orchestrator, which this run's brief reserves for
      the status flip, the review link and the commit.
- [ ] Completion detection is reported in the chat, not in this file.
