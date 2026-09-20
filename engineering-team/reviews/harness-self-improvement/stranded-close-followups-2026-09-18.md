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

## Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18
**Diff:** `77d9437b`, the Implementer's fix-up, on top of `941299e0` (round 1 of this file, committed as
written: the same blob, 288 lines). It touches `engineering-team/CHANGELOG.md` and `OPEN.md` and nothing
else, one line in each: the step-10 CHANGELOG row and ledger row 290. Everything above this heading is
round 1, byte-for-byte; this section was appended to the end of the file, not edited in.

Same constraints as round 1: this reviewer edited this file and nothing else — no commit, no add, no
push, no status flip.

Two of the statements under review began as this reviewer's own words. The CHANGELOG's new sentence is
round 1's suggested wording, and row 290's append is built from round 1's Harness friction 3. Step 10 of
the role, which this same branch adds, says to check such text as a claim rather than recognise it. Each
was re-derived below from its sources, not from round 1's notes. The exercise paid: two phrases of mine
say slightly more than I had observed (Non-blocking 1 and 3).

### Quality gates (round 2)

- [x] `bash scripts/harness-lint.sh` on `77d9437b` → **clean (0 violations)**, exit 0. Run again on
      `origin/staging` in a throwaway worktree and diffed: the outputs differ by exactly one line, the
      `INFO non-numbered-review` line for this file. Worktree removed afterwards.
- [x] **L10 holds.** `check_L10`'s own query, replayed by hand, now returns `77d9437b`, and that commit
      touches `engineering-team/CHANGELOG.md` — itself a definition path.
- [x] **The same seven suites, each through `run()`, in the foreground, Node v16.17.0, on `77d9437b`:**
      `harness-lint` 41 passed / 0 failed (54 s, including "the real repo lints clean"), `harness-stats`
      12 / 0 (69 s), `session-start` 10 / 0 (25 s), `operational-direction` 76 / 0 (10 skipped),
      `curated-dlist-update-update-preview` 34 / 0, `curated-dlist-update-publish` 69 / 0,
      `gate-result-record` 34 / 0 (20 s). Counts identical to round 1.
- [x] **The real parser over the three amended rows** (the awk from `scripts/lib/collect-meta.sh:34`):
      rows 290, 307 and 312 each read `NF=9`, Type in `$3`, Status in `$6`; line 26 still takes
      `2026-09-12` from row 290's `$5`. The open-meta selection is the same 106 row numbers on
      `origin/staging` and here. Row 290 is the row about pipes breaking this parser, and its append
      carries none.
- [ ] **Full gate: not re-run, and still not green.** `npm run -s gate:status` (exit 1) still reports
      this reviewer's round-1 run, `20260918T213029Z-34377-aa1c`, which ran on `c6997b07`: red, 2848
      passed, 9 failed, 515 skipped, the one red suite being `honest-publish-reporting` for the row-288
      host reason. Since that commit the branch gained `941299e0` (this file) and `77d9437b`
      (one CHANGELOG line, one ledger line): three records files, no source, no test, and no
      harness-definition path other than the CHANGELOG. Nothing under `test/` names this file or its
      folder; the suites that reach the ledger, the CHANGELOG and the reviews folder are among the seven
      re-run above on the new HEAD. So the record is still applicable — as exactly the evidence it was in
      round 1 and no more: a red local gate, on a host that cannot execute 15.3% of the cases, showing
      that a records-only diff broke nothing it could reach. It is not a green gate. The binding run
      remains CI's Node 22 `stack-free` job on the PR.

### Claims adherence (round 2)

| Claim in the fix-up | Evidence | Result |
|---|---|---|
| CHANGELOG: "all three blocking fixes adopted round 1's suggested wording — two sentences nearly verbatim, one cross-reference exactly" | not taken from round 1 of this file: the merged review on `origin/staging` was parsed — its round-1 Blocking section has three numbered findings and three "Asked change" passages — and each quoted suggestion was compared with the four lines `12f7fba9` changed in `OPEN.md` (rows 72, 73, 321 and the 2026-07-22 numbering note). Suggestion 1 (271 characters) landed with one insertion, `'s`; suggestion 2 (239) with `;` → `, and`; suggestion 3, `(L2 waiver; row 322)`, is present exactly and was absent before the fix. On "sentences": the first is one; the second is what round 1 of that review calls "the clause" — two independent clauses, landing as the tail of a sentence in row 72. The word is the merged review's, and was mine in round 1; it is fair, not exact | holds |
| CHANGELOG: "Both" was the merged review's own word (commit message) | a whitespace-flattened search, because the sentence wraps across lines there: "Both blocking fixes adopted round 1's suggested sentences nearly verbatim." sits in its Round 2 section, which also says "The three round-1 items are fixed" | holds |
| CHANGELOG row still 4 cells, still last, tail chronological | one line changed (`:87`): three word-level edits, nothing else. 5 raw pipes, 0 escaped, 4 cells; line 87 of 87; the last six dates run 09-12, 09-12, 09-17, 09-18, 09-18, 09-18; the only out-of-order pair is still lines 70–71, already on staging. Backticks and bold markers balanced. The rest of the row reads correctly with the new subject: "re-derived them" now covers three items, and the merged review's round-2 table did check all three with fresh commands | holds |
| Row 290: original text survives; note in the Item cell; structure and other cells unchanged | 7 cells, 8 raw pipes and 0 escaped on both sides; number, Type, Opened, Status, Done and Pointer byte-identical; staging's Item cell is a verbatim `str.startswith` prefix of HEAD's (617 → 1410 characters); still `OPEN`. The append has no pipe, balanced backticks and bold. The row's first 150 bytes are unchanged, so its own trimmed echo in the roll-up is unchanged | holds |
| Row 290: `collect-meta.sh:33` trims with `cut -c1-150`; "one line above"; "the same function" | `sed -n '22p;33p;34p;52p'`: `collect_meta() {` at 22, the `cut -c1-150` at 33, the awk that row 290 is about at 34, the closing brace at 52. Same blob on `origin/staging` and HEAD (`c43fc017`) | holds |
| Row 290: `cut -c` "counts bytes when no UTF-8 locale is set" | probe on this host (BSD `cut`): `a`, `é`, `b` through `cut -c1-2` gives `61 c3` under `LC_ALL=C` and `61 c3 a9` under `en_US.UTF-8`. True here. The same probe in the `tapestry` container (GNU coreutils 8.32, Ubuntu 22.04): `61 c3` under `C`, `C.UTF-8` and `en_US.UTF-8` alike | holds on this host — Non-blocking 3 |
| Row 290: "agent and hook shells here run with `LANG` and `LC_ALL` unset" | this agent shell: both unset, `locale` reports `LC_CTYPE="C"`. The `claude` process that spawns agent shells and hooks alike carries no `LANG` or `LC_*` in its environment (`ps eww`, only those names printed), nor do its two ancestors; `.claude/settings.json` sets none; the SessionStart hook is a plain `bash …/scripts/session-start.sh`, so it inherits. No hook shell was itself observed | agent half observed, hook half inferred — Non-blocking 1 |
| Row 290: row 193 alone among the meta rows; `LC_ALL=C` → invalid at byte 149, a stray `0xe2`; `en_US.UTF-8` → valid | the brief asked whether slicing raw row bytes matches what the script feeds to `cut`. It does: the script's own grep-then-awk selection yields 106 rows, each byte-identical to its line in `OPEN.md` (awk prints `$0` unchanged; `read -r` with `IFS=` and `printf '%s'` preserve bytes), and the `[…d]` prefix is added outside the cut. Then the real `cut` binary, per row: under `LC_ALL=C`, invalid UTF-8 for row 193 only — among the 106 listed and among all 148 rows whose Type is `meta` (the Implementer's count, confirmed) — at offset 149, byte `e2`, the lead byte of an em-dash (`e2 80 94`); under `en_US.UTF-8`, none. Slicing at 150 bytes agrees with the real `cut` on every row | holds (see Non-blocking 2) |
| Row 290: it comes out of `/whats-open`; "on `origin/staging` as well as here" | `scripts/whats-open.sh` run on a throwaway `origin/staging` worktree and on HEAD with no locale set: exactly one invalid UTF-8 position in each output, on row 193's line, byte `0xe2`; on HEAD under `LC_ALL=en_US.UTF-8`: none. Row 193 is byte-identical on both refs. `scripts/session-start.sh` never prints the trimmed rows, only `whats-open.sh:38` does, and the row rightly names `/whats-open` alone | holds |
| "unledgered until now" (commit message) | a wider search than round 1's over `origin/staging:OPEN.md` — `cut -c`, multibyte, UTF-8, unicode, locale, `LC_ALL`, `LC_CTYPE`, `LANG`, `0xe2`, decode, codec, and truncate/split near byte/character: the only hits are row 135 (an HTML-entity-mangled npub) and row 290's own "splits … on every pipe character". Only rows 19 (done) and 290 mention `collect-meta` at all. The intake file: 0 hits | holds |
| Ledger integrity overall: versus `origin/staging` only rows 290, 307 and 312 differ; line count identical | 383 lines on staging, before the fix-up and at HEAD. `77d9437b` changed line 348 only. Against staging, lines 348, 365 and 370 differ and nothing else; keyed on row number: 321 rows on both sides in the same order, no duplicate, exactly three whose text differs; every non-row line identical | holds |
| Commit message, forward correction: the move broke 32 of the 40 dead `../`-relative links, 8 never resolved, three `./` links between sibling ADRs resolve; `59281ce7` is left alone | recomputed rather than recalled — nothing under the three `done/` trees changed since round 1 (`git diff c6997b07 HEAD`: empty), and the whole-file extraction with git history gives the same: 41 links, 40 dead and 1 live, 7 / 12 / 21, 32 valid at the parent of their move with targets present and link text already there, 8 that never resolved. A separate pass over `./` links outside code spans: 3 resolve (`decisions/done/protocols-directory/0002-…:7` once, `0003-…:7` twice), 6 do not. The paraphrase of `59281ce7`'s sentence is fair (its message lines 10–13). `59281ce7` is an ancestor of HEAD and row 312 still cites it | holds |
| Commit message, the rest | "Reproduced here before writing it down" is the Implementer's attestation, consistent with a 148-row check whose count matches mine. "Row 290's original text is untouched": above. The branch is still unpushed, `origin/staging` is still `580bce5c`, and the highest ledger number is still 322 on both sides | holds |

### Findings (round 2)

**Blocking.** None. Both notes were acted on accurately, nothing the fix-up wrote is false, no ledger row
other than 290, 307 and 312 differs from staging, every cross-reference resolves, and lint is clean.

**Non-blocking.**

1. **`OPEN.md:348` — "agent and hook shells here": the hook half was inferred, and the phrase is mine.**
   Round 1's Harness friction 3 said it after observing one agent shell. This round found good support
   — the `claude` process that starts the hooks has no locale variable to pass on, and the settings
   file adds none — but no hook shell has been looked at, and the whole claim belongs to sessions
   launched the way this one was (a session started from a terminal that exports `LANG` would inherit
   it). It is
   also beside the point of the defect, since the hook's script never prints the trimmed rows. Optional:
   "agent shells here run with `LANG` and `LC_ALL` unset, and hooks inherit the same environment".
2. **`OPEN.md:348` — "whose 150th byte" and "invalid at byte 149" are the same byte.** The first counts
   from one; the second is the zero-based offset Python reported, copied from round 1 of this file. Each
   is right in its own convention, and side by side they read as two different bytes. Optional: "invalid
   at offset 149 (the 150th byte)". Strictly, the cut is invalid when a character straddles the
   150-byte boundary, which excludes a character that ends exactly there; no meta row sits on that edge
   today, so the row's looser wording has no counterexample.
3. **`OPEN.md:348` — the first candidate works only where `cut` is BSD.** "Counts bytes when no UTF-8
   locale is set" is true, and on this Mac setting one does cure it (the roll-up is valid UTF-8 under
   `LC_ALL=en_US.UTF-8`). GNU `cut -c` counted bytes under every locale I could give it — coreutils 8.32
   in the container, above — so there, and by the same token on CI's `ubuntu-latest` runner, "set a
   UTF-8 locale inside the script" changes nothing; only the second candidate, a multibyte-aware trim,
   is portable. Row 19 was this
   same script's GNU/BSD split over `date`, in the other direction. Round 1's friction note generalised
   from one `cut`; that was my omission before it was the row's. Optional: a clause saying so, for
   whoever takes the row.
4. **A second `cut -c1-150` sits at `scripts/whats-open.sh:50`,** trimming HANDOFF status lines, which
   carry emoji and em-dashes. It is not firing today — the roll-up has exactly one invalid sequence, row
   193's — but it is the same hazard, and the same fix should cover it.
5. **On what was deliberately not acted on, I agree with all three.** Round 1's Non-blocking 4 asked
   nothing: "Blocking 1" occurs once in the cited review and settles which "harness friction 1" is
   meant. Its Harness friction 4 is about how briefs paraphrase the verdict parser, whose own header
   already states the rule; this round's brief states it correctly ("every other line that carries bold
   or is a heading"), so the lesson has reached the place it was needed. Its Harness friction 5 is a tip
   for whoever builds row 312's close-out step; L8's extractor is already immune, and the tip is on
   record here. None is a harness defect that the write discipline would want a row for. Findings 3 and
   4 of this round are different in kind — facts about the defect row 290 now records — and are cheap to
   fold into that row whenever it is next touched; the operator's call.
6. **Still owed, unchanged from round 1:** land the PR as a merge commit, since row 312 cites
   `59281ce7` and the fix-up's message now leans on that hash staying; say in the PR body that the local
   gate is red on Node 16 for the row-288 reason and that CI's Node 22 job is the binding run.

**Harness friction.**

1. **Step 10 met its author on its first outing.** Within the hour, two phrases from round 1 of this
   file were in records: "agent and hook shells", of which only the first half had been observed, and a
   byte-counting rule that is true of one `cut` and silent about the other. Neither is false, and both
   were caught only because the new rule says to re-derive rather than recognise. The corollary, not
   asking for a change: a reviewer's friction notes are as quotable as its asked changes, and deserve the
   same care when they are written — say what was observed, and on which host.
2. **A line-based search misses a wrapped sentence.** Looking for the merged review's "Both blocking
   fixes" with `grep` found nothing, because the sentence breaks after "Both"; only a
   whitespace-flattened search found it. The same trap as round 1's Harness friction 5, in prose rather
   than links: when checking whether a record says something, flatten it first.
3. Row 316 recurred again: the wiring says commit and flip, the brief reserves both, and the brief was
   followed.

### Verdict (round 2)

**PASS**

Round 1 asked for nothing and offered notes; the fix-up took two of them, and both are made accurately.
The CHANGELOG row now counts the three blocking fixes it describes, checked here against the merged
review's own asked changes and the commit that answered them rather than against my suggestion. Row 290
now records the byte-counting trim one line above the defect it already described, and every measured
statement in the append reproduces: the line, the function, row 193 alone among 148 meta rows under the
script's real pipeline, the stray `0xe2` at the 150th byte, staging and this branch alike, and no earlier
row that knew of it. The forward correction in the commit message is right in every number, and leaving
`59281ce7` unreworded keeps the hash that row 312 and round 1 cite.

What this round adds is refinement, not correction: the hook half of the locale sentence is inference,
two byte figures use two conventions, the first fix candidate is a BSD-only cure, and a sibling `cut`
waits in `whats-open.sh`. None makes the record wrong as written.

Only rows 290, 307 and 312 differ from staging, lint is clean, and the seven suites that read the
ledger or the CHANGELOG are green on the new HEAD. The local full gate was not re-run; the round-1
record remains applicable as what it was — red on this host for the recorded Node 16 reason, 15.3% of
cases skipped, not a green gate. CI's Node 22 job on the PR is the binding run. This lane has no story
to flip and no book to close, and the commit is the orchestrator's.
