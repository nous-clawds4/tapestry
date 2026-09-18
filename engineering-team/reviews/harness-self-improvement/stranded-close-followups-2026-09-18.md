# Review: stranded-close follow-ups — the row 307 lesson, reviewer step 10, the `about-brainstorm-search` story move, and a row 312 append

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18
**Diff:** four commits on `origin/staging` `580bce5c` (branch `docs/stranded-close-followups`, unpushed at
review time): `abc925a2` (row 307 append), `de7729ae` (`roles/reviewer.md` step 10 + its CHANGELOG row),
`59281ce7` (the story folder moved under `stories/done/`, its link fixed, the audit repointed, the epic's
`Retired` line), `c6997b07` (row 312 append — not one of the operator's three asks; the Implementer
offered it as separable, and it is judged as such below).
**File:** non-numbered by convention — this lane has no story to match (`workflows/0-intake.md` §3).
**Lane:** doc/one-liner (Implementer + Reviewer, Standard strictness). No story / ADR / test plan and
no book by design.
**Scope:** 6 paths — `OPEN.md`, `engineering-team/CHANGELOG.md`, `engineering-team/roles/reviewer.md`,
`engineering-team/audits/about-brainstorm-search/audit.md`,
`engineering-team/epics/about-brainstorm-search.md`, and one rename (git: `R091`),
`engineering-team/stories/about-brainstorm-search/1-about-page-and-agentic-placeholder.md` →
`engineering-team/stories/done/about-brainstorm-search/1-about-page-and-agentic-placeholder.md`.
`roles/reviewer.md` is the only harness-definition path besides the CHANGELOG; its row rides in the
same commit. No source file and no test file.

The brief reserved the commit and every status flip for the orchestrator. This reviewer created this
one file and nothing else: no commit, no add, no push, no flip, no edit to any other tracked file.

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` → **clean (0 violations)**, exit 0. Run again on `origin/staging`
      in a throwaway worktree and diffed: the two outputs are byte-identical (33 lines), so the move
      added no waiver, no INFO line and no violation.
- [x] **L10 is satisfied by `de7729ae`, not vacuously.** `check_L10`'s own query, replayed by hand
      (`git log -1 --no-merges --format=%h -- <every existing def path>`), returns `de7729ae`, and
      `git show --name-only de7729ae` lists `engineering-team/CHANGELOG.md` and
      `engineering-team/roles/reviewer.md` together. The two later commits touch no definition path,
      and neither will this file.
- [x] **L2 still evaluates the book.** The extractor at `scripts/harness-lint.sh:150-151`, run over
      `audits/about-brainstorm-search/book.md` (`Status: Closed`, unchanged on this branch), yields
      `about-brainstorm-search` and `developers-pages`. Control, throwaway worktree at HEAD, the epic's
      Status line changed from `Done` to `Active`: `VIOLATION L2
      engineering-team/epics/about-brainstorm-search.md — book … is Closed but this epic is 'Active …'`,
      exit 1. Worktree removed afterwards.
- [x] **Seven suites that read a changed file**, each through its `run()` export (row 310), in the
      foreground, host Node v16.17.0, on `c6997b07`: `harness-lint` 41 passed / 0 failed (57 s,
      including "the real repo lints clean"), `harness-stats` 12 / 0 (72 s), `session-start` 10 / 0
      (25 s), `operational-direction` 76 / 0 (10 skipped), `curated-dlist-update-update-preview`
      34 / 0, `curated-dlist-update-publish` 69 / 0, and one the brief did not list,
      `gate-result-record` 34 / 0 (20 s) — its F2 opens `engineering-team/roles/reviewer.md` and
      asserts it points at the README gate recipe and carries no `PIPESTATUS`. Found by grepping
      `test/` for reads of the roles folder, the CHANGELOG, the ledger, and this epic's files. Nothing
      under `test/` names `about-brainstorm-search` in any form (grep count 0), so no suite reads the
      moved path.
- [x] **Row 290's hazard tested against the real parser, not by counting pipes.** The awk from
      `scripts/lib/collect-meta.sh:34` reads rows 307 and 312 with `NF=9`, Type in `$3`, Status in
      `$6`; line 26's date extraction still takes `2026-09-17` and `2026-09-12` from `$5`, untouched by
      the dates the appended text carries in `$4`. The open-meta selection is the same 106 row numbers
      on `origin/staging` and here (`diff` of the two lists: empty).
- [x] **Scripts that walk `stories/`.** `scripts/harness-stats.sh`: 349 lines, byte-identical between
      `origin/staging` and HEAD, and the epic is in it on both sides (`about-brainstorm-search: 1`,
      `closed, 1d open→close`) — its loops cover `stories/done/*/`. `scripts/session-start.sh`:
      40 lines, byte-identical. `scripts/whats-open.sh` (redirected to scratch files, exit 0 both):
      908 lines each, differing on exactly two output lines (221 and 225), the echoes of rows 307 and
      312. L3 skips `done/`, L1/L4 have no numbered review of this epic to match, and L14 still reads
      the epic file and is silent.
- [ ] **Full gate: red on this host — re-run by this reviewer, and not a green gate.**
      `GATE_LABEL=followups-review npm test`, foreground, 3 m 19 s, exit 1. `npm run -s gate:status`
      (exit 1) prints:
      `20260918T213029Z-34377-aa1c [followups-review] started 2026-09-18T21:30:29.497Z on c6997b07 —
      FAIL, exit 1, 2848 passed, 9 failed, 515 skipped, 204/204 suites; failed:
      honest-publish-reporting`. From `tmp/gate-runs/20260918T213029Z-34377-aa1c.json`: commit
      `c6997b07` (the HEAD under review), `dirty: false`, Node `v16.17.0`, 178 suites green / 25
      skipped / 1 red, `strayErrors` empty. The one red suite is `honest-publish-reporting` (1 passed,
      9 failed); all nine failures are `ERR_REQUIRE_ESM`, the Node-16 artifact in row 288, and that
      suite references none of the changed files (grep count 0). The Implementer's recorded run,
      `20260918T205716Z-8979-126f [followups-node16]`, is on the same commit with a clean tree, and the
      two records agree on verdict, passed, failed and skipped counts for all 204 suites. 515 of 3372
      cases (15.3%) did not execute, because Node 16 has no global `fetch` and the live suites skip —
      which is also why this re-run left no row-293 fixture behind (`most-pinned-tag-index-publish`
      skips here). It is accepted as evidence for this diff because the diff touches no source and no
      test, every suite that reads a changed file is green above, and the single red suite is red for a
      recorded host reason. **The binding run is CI's Node 22 `stack-free` job on the PR.** No Node 22
      exists on this host and fetching one needs the operator's own OK, so none was used.
- [x] L9: `BIBLE.md` and `OPERATIONS.md` untouched. Budgets: `CLAUDE.md` 190 / 190 and `AGENTS.md`
      102 / 102, untouched. L7: `roles/reviewer.md` still carries the canonical token and offers no
      third verdict. L8: step 10 adds no link.
- [x] This review is non-numbered and ends at its Verdict. Checked after writing:
      `awk -f scripts/lib/review-verdict.awk` on this file prints the verdict of the final section, no
      other line that is a heading or carries bold contains a verdict token, and
      `bash scripts/harness-lint.sh` re-run with this file present is still clean, exit 0, with this
      file appearing only as one new `INFO non-numbered-review` line.

## Claims adherence — each claim, with the command that tried to falsify it

| Claim | Evidence | Result |
|---|---|---|
| A. Six paths, one rename; no source, test, secret or TA literal; budget and L9 files untouched | `git diff --name-status -M origin/staging..HEAD`: 5 modified + `R091`; nothing under `src/`, `test/`, `ui/`, `scripts/`, `.claude/`, `.github/`. The 9 added lines and the four commit messages scanned for 64-hex strings, `nsec1`, `npub1`, `82b75e47`, private-key headers, token shapes, and the words secret / password / token: no hit. No `LEGACY_*` constant is touched | holds |
| B. In `OPEN.md` only rows 307 and 312 differ; structure intact; original text survives | own script over `origin/staging:OPEN.md` and `HEAD:OPEN.md`: 383 lines each; the only differing lines are 365 (row 307) and 370 (row 312). Each has 7 cells, 8 raw pipes and 0 escaped pipes on both sides; the number, Type, Opened, Status, Done and Pointer cells are byte-identical; the staging Item cell is a verbatim `str.startswith` prefix of the HEAD Item cell (756 → 1565 and 861 → 1993 characters); both rows still `OPEN`. Highest row number 322 on both sides, so nothing was minted. Confirmed against the real parser (gates, above) | holds |
| C. `355bef13` is the 2026-07-22 `relationship-primitives` close and reserved 72–73 for that branch | `TZ=UTC git log -1 355bef13`: `book-close: relationship-primitives`, 2026-07-22T18:21:32Z, an ancestor of `origin/staging`. Its one added numbering line: rows 72–73 "are reserved for the in-flight `ops/open72-73-ci-gate-and-tags-safety-gap` branch observed on origin at close time; this close allocates from **74**". Before it staging had no row 72–77; after it, its own 74–77 | holds |
| C. The branch had carried 72–77 on origin, pushed 03:23Z–04:13Z | **re-observed, not just corroborated:** the activity API still answers for the deleted ref — `branch_creation` 03:23:20Z → `e3aa871a`, `push` 03:48:32Z → `fd2d3f83`, `force_push` 04:13:07Z → `8a9ef91e`, `push` 04:13:24Z → `d42715a4`, and today's `branch_deletion` at 20:32:39Z. Row content read from the three tips that survive in this clone: `e3aa871a` carries 72–73, `8a9ef91e` 72–76, `d42715a4` 72–77 (`fd2d3f83` was force-replaced and is absent, as before) | holds |
| C. "fourteen hours" | 18:21:32Z minus 04:13:24Z, the push that completed 72–77, is 14 h 08 m. (From the first push it is 14 h 58 m, but the row says "carried 72–77", which is true only from 04:13Z) | holds |
| C. 74–77 moved to 317–320; "the corrected numbering note above row 74" exists and says so | rows 317–320 at HEAD carry the four titles `d42715a4` had at 74–77. `OPEN.md:108` is the 2026-07-22 note, directly above row 74 (`:109`); its parenthetical gives the same order of events (on origin 03:48Z–04:13Z, against the note's 18:21Z commit), the same cause, the move to 317–320, and the same advice. Its "03:48Z" is for rows 74–77 and the row's "03:23Z" is for 72–77; both are right | holds |
| C. Cited review path, "Blocking 1 and harness friction 1", PR #671 | the file exists; round 1 has a Blocking 1 and a Harness friction 1 that say what the row says they say. `gh pr view 671`: merged into `staging` 2026-09-18T18:21:07Z as `580bce5c`, which is also an ancestor of `origin/main` | holds (see Non-blocking 4) |
| C. The lesson is stated fairly | the row states what was reserved and what the name advertises, and does not claim to know how the 2026-07-22 session arrived at 72–73; its advice covers both possibilities ("never from its name or an earlier look"), which matches the reserving note's own "observed on origin at close time". "A different cause" is fair: the row's original occurrences are concurrent minting, this one is under-reservation | holds |
| D. Step 10 is an accurate distillation of its origin | read against round 2's Harness friction 1 in the merged review: same trigger (a fix that adopts the reviewer's suggested sentence), same hazard (an unverified reviewer phrase in the record with two roles' apparent endorsement), and the closing clause is the origin's own sentence. The origin's "could enter" becomes "has put", which is what a rule should say. Nothing else in roles, workflows, templates, commands or agents speaks about review rounds (`git grep`), so it contradicts nothing | holds |
| D. No existing step renumbered; L7 satisfied | the hunk is one inserted line after step 9 (`roles/reviewer.md:50`); steps 1–9 byte-identical. Every citation of a numbered step of this file still resolves (`git grep`): row 294 and `reviews/done/curated-dlist-update/5-…:290` cite step 1, `reviews/done/node-primitives/1-…:439` cites step 9. Lint clean | holds |
| D. CHANGELOG row: last, 4 cells, dated correctly, tail chronological, same commit | `engineering-team/CHANGELOG.md:87` is the last line; 5 raw pipes, 0 escaped; the final ten dates run 08-18, 09-10, 09-10, 09-11, 09-12, 09-12, 09-17, 09-18, 09-18, 09-18. The file's one out-of-order pair (lines 70–71) is already on staging. Same commit as the role file: see L10 above | holds |
| D. "adopted round 1's suggested sentences nearly verbatim" | diffed round 1's two suggested sentences against what `12f7fba9` landed: Blocking 1 differs by one inserted `'s` ("branch name" → "branch's name"); Blocking 2 by `;` → `, and` | holds |
| D. "both blocking fixes" | round 1 has three blocking findings. The third fix took its suggestion too — the five-word cross-reference, exactly. The phrase is the merged review's own, carried over word for word | **loose** — Non-blocking 1 |
| D. "one phrase (\"older branches\") needed a second look" | round 2's table: of 14 non-archived carriers none contains `3b84677d`, one has a newer tip but was cut before the removal, "so older holds in the sense that matters"; it names the phrase as the reviewer's own | holds |
| D. "operator-ratified 2026-09-18" | the brief reports the operator's "Let's do all three". The operator's words are not in the repo, so a reviewer cannot verify this; the operator reading the PR is the check | attested, not verified |
| E. A rename; one link changed; otherwise byte-identical; the link resolves | `R091` (one 486-character line changed in a 5.1 KB file). The staging blob with the single substitution `](../../../ui/…)` → `](../../../../ui/…)` equals the HEAD blob byte for byte (5106 → 5109 bytes; line 9 only). It is the file's only link, and `ui/src/pages/BrainstormSearch.jsx` exists from the new directory. The story still reads `Status: Done`. The old folder is gone from disk and index | holds |
| E. The audit's citation and its "second mechanical change" | `audit.md:15` now reads `stories/done/about-brainstorm-search/1-…`. The file's history on the shared line: `da759e57` changed the body (five citation lines), `8c85e963` changed only the landing note's PR placeholder, `59281ce7` changes the body a second time. "Second", "the same day" (both commits are 2026-09-18 on either clock) and "the close-out step the book close itself never made" (at `d42715a4` the story is still under `stories/about-brainstorm-search/`) all hold | holds |
| E. The epic's `Retired` line, in every particular | `book.md`: `Closed: 2026-07-22`. The move is dated 2026-09-18 (20:55Z). PR #671: above. "No `decisions/` or `reviews/` folder exists": absent from disk in the active and the `done/` trees, no tracked file, and no history on any ref (`git log --all --diff-filter=A` over all four paths: empty). Shape: `5d40c73e` put a `Retired` line directly under Status and repointed the Stories path; so does this. Status still starts `Done`. `stories/developers-pages/` and its epic file: no diff | holds |
| E. `git grep -F 'stories/about-brainstorm-search'` hits only the merged review's Scope line; nothing refers to the old place in another form | one hit, `stranded-close-2026-09-18.md:15`. Also swept: `about-brainstorm-search/` in any form outside the `audits/` and `stories/done/` paths (the same single hit); the story's file name; every file naming the slug (14: the ledger, CHANGELOG, this book's three files, two epics, a sibling story, the merged review, the waiver file, three `ui/` files that use it as a route). None is a path to the old folder | holds (see Non-blocking 6) |
| F. 40 dead and 1 resolving; 7 in 5, 12 in 4, 21 in 7 | **my method:** `git ls-files` over the three `done/` trees (352 tracked files, all markdown: 188 / 75 / 89); a whole-file regex `\]\(\s*(\.\./[^)\s]*)\s*\)`, so a link whose text wraps a line is caught; each target resolved from its file's directory. Cross-checked two ways: L8's own extractor (`grep -oE '\]\([^)]+\)'`, targets starting `../`) and a raw count of `](../` — 41, 41 and 41. **My counts:** 41 links, 1 resolves (`stories/done/about-brainstorm-search/1-…:9`), 40 dead — 7 in 5 files under `stories/done/` (one of them a test plan), 12 in 4 ADRs, 21 in 7 reviews. My first pass used a per-line `[text](target)` regex and got 39 + 1; the miss was mine (`stories/done/self-ontology/2-…:27-28`, link text wrapped), not the row's | holds |
| F. 32 valid before the move with targets that still exist: `src/` 10, `ui/` 8, `protocols/` 8, `BIBLE.md` 4, `test/` 1, one book manifest | tested as history, not as arithmetic: per file, `git log --follow --name-status` for the add path and the rename into `done/`; per dead link, the target resolved from the pre-move folder checked with `git cat-file -e <move>^:<path>` and on disk, and the link text confirmed present in the pre-move blob. 32 satisfy all three; no file was authored under `done/`; buckets `src/` 10, `ui/` 8, `protocols/` 8, `BIBLE.md` 4, `test/` 1, `audits/blinding-rebuild/book.md` 1. One more `../` repairs each by construction | holds |
| F. The other 8 were already dead when written | at each file's add commit, from its add path, the target did not exist, and the link text was already there: 6 with one `../` too few (4 in `reviews/done/relay-management/1-…`, 2 in `decisions/done/protocols-directory/0003-…`), 2 `../README.md` landing on `engineering-team/decisions/README.md`, which has no history on any ref. All three files were first written inside an epic folder, not a flat one, so `../../` was never right for them | holds (see Non-blocking 3) |
| F. The 1 that resolves is the one `59281ce7` fixed; workflow 5 quoted fairly; L8 does not scan these files | the single live link is the moved story's. `workflows/5-review.md:64`: "the relative paths *inside* the folder … stay intact — no link-rewriting needed"; the row quotes four words exactly and reads the sentence correctly. `check_L8` walks `WIRING_DIRS` and four orientation docs, none under `done/`; no other script or suite checks links there; lint is clean with 40 dead links present | holds |
| G. The four commit messages | `abc925a2`, `de7729ae` and `c6997b07`: every statement checked above holds (the second shares the "both" of Non-blocking 1). `59281ce7`: everything about the move holds; its one sentence about the measurement says more than the measurement supports | **two loose statements** — Non-blocking 2 |

## Things tests can't catch

- [x] No secret, credential or key material in the diff or the messages, and no TA pubkey literal
      (CLAUDE.md § "Per-deployment TA pubkey").
- [x] **Nothing can collide right now.** `git ls-remote origin refs/heads/staging` is `580bce5c`, the
      base of this branch; no open PR targets `staging`; the branch is unpushed; no ledger number was
      minted. Both ledger edits are in-place appends to single lines, so only a concurrent edit to row
      307 or 312 would conflict. If another CHANGELOG row lands first, re-check that the new row is
      still last and the tail still chronological.
- [x] **The evidence behind row 307 is perishable, and was taken while it lasts.** The branch was
      deleted at 2026-09-18T20:32:39Z; `e3aa871a`, `8a9ef91e` and `d42715a4` are now unreachable from
      every ref in this clone (`git for-each-ref --contains`: empty) and will go at the next gc. The
      durable copies are the corrected note at `OPEN.md:108`, the merged review, and the `-x` trailers
      on `d3982ee4`, `c62e514d` and `dd4ce745`.
- [x] **Unlike `5d40c73e`, this retirement had no suite to repoint** — that precedent moved folders
      that five suites read by path; here nothing under `test/` names the epic.
- [x] No debug residue, no commented-out text, no stray worktree (`git worktree list` shows the main
      tree only), no stash. One `git fetch origin` was run (remote-tracking refs only;
      `origin/staging` did not move); the gate record went to `tmp/`, which is ignored.
      `git status --short` after all experiments shows only this file.

## Findings

### Blocking

None. Every statement this branch wrote into a tracked file was checked with a fresh command, and
none is false; no ledger row other than 307 and 312 changed; every cross-reference resolves to what it
names; lint is clean.

### Non-blocking

**1. `engineering-team/CHANGELOG.md:87` (and `de7729ae`'s message) — "both blocking fixes".** Round 1
of the stranded-close review has three blocking findings, and all three fixes took the reviewer's
wording: two sentences nearly verbatim, one five-word cross-reference exactly. "Both" is the merged
review's own word (round 2, Harness friction 1, where it means the two suggestions that were
sentences), and the row carries it over unchanged — which is the habit step 10 now names, one level
up: a reviewer's phrase entering a second record without being re-derived. The material claim is
true and, if anything, understated, and the row cites its source exactly, so no reader is misled about
what happened or what to do. Optional, and cheapest as a small commit on top that touches only the
CHANGELOG: "all three blocking fixes adopted round 1's suggested wording — two sentences nearly
verbatim, one cross-reference exactly". That wording is a claim too; the evidence for it is the row
above in this review's table.

**2. `59281ce7`'s commit message says more than the measurement supports, in two places.** It reads:
"every other relative link in a retired file is dead — 40 of them (…), because the close-out move adds
a directory level and nothing rewrites them. This is now the only live one."
(a) *Cause.* The move accounts for 32 of the 40. The other 8 never resolved. The Implementer's own next
commit and row 312 both say so; this message, written first, does not.
(b) *Scope.* Both messages say "relative link" where row 312 precisely says "`../`-relative". Read
literally it is not so: three `./` links between sibling ADRs resolve
(`decisions/done/protocols-directory/0002-…:7` once, `0003-…:7` twice) — exactly the property workflow
5 promises — and another 14 non-`../` relative links outside code spans are dead for reasons that have
nothing to do with the move (6 are spec markup written relative to `protocols/drafts/`, 7 are
repo-root-style paths, 1 is a `…` placeholder).
The tree is right; only the log is loose, and the prior review's precedent for a loose commit message
(its Non-blocking 8) was a correction carried forward, not a rewrite. Two things follow.
First, **`c6997b07` is no longer free to drop**: it and row 312 are where the correct account lives, so
dropping it would leave `59281ce7`'s sentence as the only record of the measurement. Keep it (finding
8 judges it warranted anyway), or, if it is dropped, reword `59281ce7` before pushing. Second, **if
`59281ce7` is reworded while `c6997b07` is kept, its hash moves, and row 312 cites it** — the row
must follow in the same pass. A wording that the evidence above supports: "Measured while here: none of the other 40
`../`-relative links in retired files resolves — 32 because the close-out move added a directory level
and nothing rewrites them, 8 because they never did. This is now the only live `../` link; `./` links
between siblings are unaffected."

**3. Row 312 (`OPEN.md:370`) — four precision notes, none asking a change.**
(a) The count is textual, the same definition of a link that L8 uses. One of the 40
(`decisions/done/protocols-directory/0003-…:51`, `../../BIBLE.md#25-…`) sits inside a code span, so a
markdown renderer shows 39 dead links and 1 live. The textual count is the one a fixer's tooling will
meet, so it is the right one to record.
(b) Three of the "8 already dead when written" are quotations rather than mistakes: that same line 51
and `0002-…:40` quote link markup from a protocol draft, where `../README.md` and `../../BIBLE.md`
were correct. "Already dead when written" is still true of them as links in these files, and "a
`decisions/README.md` that does not exist" is where they land.
(c) "31 repo files" counts links, not distinct files (19 distinct, plus the manifest). The bucket
"`BIBLE.md` 4" makes that plain to a reader.
(d) For whoever takes the row's candidate: adding one `../` is right for every link that exists today,
but a link between areas (story → ADR) would need a `done/` segment as well. None exists under `done/`
now — the records cite each other by backticked path — so this is a note, not a gap in the count.

**4. Row 307 (`OPEN.md:365`) — "harness friction 1" is a heading that occurs twice in the cited
review.** Round 1's is the one meant (a reservation made from a branch's name under-reserves), and a
reader reaches it first; pairing it with "Blocking 1", which only round 1 has, settles it. The
CHANGELOG row does name its round. Optional: "round 1".

**5. The dates describe the commits and stay true whenever the PR merges** — "moved … on 2026-09-18",
"followed the same day", and the CHANGELOG row's Date cell are all the authoring date on either clock
(20:54Z–20:57Z). Only the Date cell is read by the file's chronological rule; see the collision note
above.

**6. Leaving the merged review's Scope line alone was the right call.** It records which nine paths
that review examined, and at that commit the path was correct; repointing it would make a closed review
claim to have read a file at a path that did not exist then. It is a code span, not a link, so nothing
breaks, and the commit message names the exception so a future grep for the old path has its answer.
`5d40c73e` did repoint citations inside reviews, but those were the retiring epic's own reviews, moved
in the same commit and read by path from five suites; neither condition applies here.

**7. One place is enough for step 10.** `.claude/agents/reviewer.md` and
`.claude/commands/review-changes.md` were already digests of the role file rather than mirrors — the
agent file has eleven steps numbered differently (its step 10 is "state the verdict") — and both name
the role file as the authority and tell the Reviewer to read it first. What must be replicated across
them is machine-checked (the verdict enum by L7, the gate recipe by `gate-result-record` F2), and a
later-round Reviewer is a fresh agent that reads the role file before anything else. The one residue,
that "reviewer step 10" now means different things in two files, was already true of steps 1–9, and
the citations that exist name the file.

**8. The row 312 append is warranted, not scope creep; the row 307 append is reasonable.** The defect
was met while doing the third ask — the Implementer had to hand-fix exactly this in the moved story —
and CLAUDE.md's write discipline asks for a `meta` record of a harness defect before the session ends.
Appending rather than minting is the better of the two: same root (workflow 5's close-out), same place
to fix, the mirror image of what 312 already says, and no new number to collide (row 307's own
subject). It was disclosed at the gate and isolated in its own commit. Row 307 belongs to another
book, but the operator asked for exactly this append after the merged review proposed it and its round
2 deferred it to the operator; the original text is untouched and the note is dated and sourced.

**9. For the PR.** Land it as a merge commit, as this repo always has — the repository settings also
allow squash and rebase, and either would orphan the `59281ce7` that row 312 cites. The body should
say that the local gate is red on Node 16 for the row-288 reason and that CI's Node 22 job is the
binding run.

### Harness friction

**1. Row 316 recurred, a third time.** This reviewer's wiring says to commit the review and flip
statuses; the brief reserves both. The brief was followed.

**2. The brief's suite list was one short.** `gate-result-record` reads `roles/reviewer.md` and was not
among the six named. The brief did ask for the grep that found it, which is the right shape: a named
list is a floor, and the grep is the check.

**3. `scripts/lib/collect-meta.sh:33` cuts a ledger row mid-character when no UTF-8 locale is set.**
`cut -c1-150` counts bytes under the C locale, and agent and hook shells here run with `LANG` and
`LC_ALL` unset. Row 193 comes out of `/whats-open` as invalid UTF-8 (one stray `0xe2`), on
`origin/staging` as well as here. Reproduced on that row alone: `LC_ALL=C cut -c1-150` → invalid at
byte 149; `LC_ALL=en_US.UTF-8 cut -c1-150` → valid. Nothing in the ledger records it (no row mentions
`cut -c`, multi-byte or UTF-8). Pre-existing and unrelated to this diff; it is one line above the awk
of row 290, so either a note there or a small `meta` row. Found because a reviewer's Python refused to
decode the roll-up.

**4. "Use backticks" is not enough to keep a verdict token out of the parser's sight.**
`scripts/lib/review-verdict.awk` examines every line that is a heading *or contains bold markers
anywhere*, so a bold-led bullet that mentions a token in backticks is verdict-shaped. The last token
still wins, so a final Verdict section protects the parse; the safer habit, followed here, is to keep
the tokens off any line that carries bold. Worth one clause in the next brief that states the rule.

**5. A per-line link regex undercounts.** Markdown lets link text wrap; this reviewer's first extractor
missed one such link and briefly had a count that disagreed with the row. L8's extractor survives only
because it matches from `](` onward. Whoever builds row 312's close-out step should match the target,
not the whole `[text](target)`.

## Verdict

**PASS**

The three asked-for changes are made and every statement they wrote into a tracked file survives a
fresh command: row 307's account was re-observed from the activity API and from the stranded commits
while both still exist; step 10 is a faithful distillation of its origin, renumbers nothing, and rides
with its CHANGELOG row; the story move is a true rename with one repaired link, and the audit and epic
lines that describe it are accurate in every particular. The fourth commit is warranted, separable at
the tree level, and its numbers reproduce exactly under an independent method that also tested the
history behind them — 40 dead and 1 live, 7 / 12 / 21, 32 and 8.

What is loose is wording, not fact, and none of it is in a place a reader would be led wrong: a "both"
inherited from the merged review where there were three, and one commit-message sentence that the next
commit and the ledger row already correct. Both are recorded above with the cheapest remedy and the one
trap in it — a reworded `59281ce7` moves a hash that row 312 cites.

Lint is clean and identical to staging's, L2 demonstrably still evaluates the book, and the seven
suites that read a changed file are green on this HEAD. The local full gate, re-run here, is red for
the recorded Node 16 reason with 15.3% of cases skipped; that is accepted for a diff with no source and
no test, and it is not a green gate. CI's Node 22 job on the PR is the binding run. This lane has no
story to flip and no book to close, and the commit is the orchestrator's.
