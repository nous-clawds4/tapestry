# Review: stranded-close — landing the `about-brainstorm-search` book close stranded since 2026-07-22

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18
**Diff:** four commits on `origin/staging` `4585e1e1` (branch `docs/stranded-close`, unpushed at review
time): `d3982ee4`, `c62e514d`, `dd4ce745` — cherry-picks (`-x`) of `e3aa871a`, `8a9ef91e`, `d42715a4`
from `origin/ops/open72-73-ci-gate-and-tags-safety-gap` — and `da759e57`, the landing commit, which
holds everything the Implementer changed.
**File:** non-numbered by convention — this lane has no story to match (`workflows/0-intake.md` §3).
**Lane:** doc/one-liner (Implementer + Reviewer, Standard strictness). No story / ADR / test plan and
no book by design: the deliverable is records.
**Scope:** 9 files — `OPEN.md`, `engineering-team/CHANGELOG.md`,
`engineering-team/audits/about-brainstorm-search/{audit,book,prd-seed}.md`,
`engineering-team/epics/about-brainstorm-search.md`,
`engineering-team/stories/about-brainstorm-search/1-about-page-and-agentic-placeholder.md`,
`engineering-team/stories/developers-pages/2-hub-trusted-assertions-and-relay-tools.md`,
`scripts/harness-lint-waivers.txt`. The last is the only harness-definition path; its CHANGELOG row
rides in the same commits. No source file and no test file.

The brief reserved the commit and every status flip for the orchestrator. This reviewer created this
one file and nothing else: no commit, no push, no flip, no edit to any other tracked file.

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` → **clean (0 violations)**, exit 0. Run again on
      `origin/staging` in a throwaway worktree and diffed: the two outputs differ by exactly one
      line, the new `WAIVED L2 engineering-team/epics/developers-pages.md`.
- [x] **L2 really evaluated the new book** — row 319's green-and-wrong mode ruled out three ways.
      (a) L2's own extractor (`scripts/harness-lint.sh:150-151`) over the landed `book.md` yields
      `about-brainstorm-search` and `developers-pages`; the book's Status is `Closed`.
      (b) Control 1, throwaway worktree, epic file reverted to `origin/staging`'s (`Status: Active`):
      `VIOLATION L2 engineering-team/epics/about-brainstorm-search.md — book … is Closed but this
      epic is 'Active'`, exit 1. (c) Control 2, the `developers-pages` waiver line removed:
      `VIOLATION L2 engineering-team/epics/developers-pages.md`, exit 1. Worktree removed afterwards
      (`git worktree list` shows the main tree only).
- [x] **Six suites that read a changed file**, each through its `run()` export (row 310), on the
      current tree, host Node v16.17.0: `harness-lint` 41 passed / 0 failed (54 s, including "the real
      repo lints clean"), `harness-stats` 12 / 0 (70 s), `session-start` 10 / 0 (25 s),
      `operational-direction` 76 / 0 (10 skipped), `curated-dlist-update-update-preview` 34 / 0,
      `curated-dlist-update-publish` 69 / 0. The brief named the first three; the other three open
      `OPEN.md` by path (found by grepping `test/` for reads of the nine changed files) and key on row
      text or on staging's rows 41 and 314, which did not move.
- [x] **Row 290's hazard tested against the real parsers, not by counting pipes.** The exact awk
      from `scripts/lib/collect-meta.sh:34` reads all eight landed rows with `NF=9`, Type in `$3` and
      Status in `$6`; the open-meta count goes 102 (`origin/staging`) → 106, which is exactly the four
      open meta rows 72, 318, 319, 322. `scripts/whats-open.sh` (redirected to a scratch file, exit 0)
      surfaces 72, 318, 319, 321, 322 and none of 73, 317, 320, with ages of 58d and 0d; the landed
      book's carry-forward register now appears in the roll-up, which is the practical point of
      landing it.
- [ ] **Full gate: red on this host, and not re-run** (the brief forbade it). The record was
      verified instead. `npm run -s gate:status` (exit 1) prints:
      `20260918T062621Z-3957-e563 [stranded-close-node16] started 2026-09-18T06:26:21.592Z on da759e57
      — FAIL, exit 1, 2848 passed, 9 failed, 515 skipped, 204/204 suites; failed:
      honest-publish-reporting`. Read out of `tmp/gate-runs/20260918T062621Z-3957-e563.json` directly:
      commit `da759e57` (the HEAD under review), tree clean (`dirty: false`), Node `v16.17.0`,
      3 m 15 s, 178 suites green / 25 skipped / 1 red, `strayErrors` empty. The one red suite is
      `honest-publish-reporting` (1 passed, 9 failed); all nine failures are `ERR_REQUIRE_ESM` /
      "require() of ES Module", the Node-16 artifact recorded in row 288, and that suite references
      none of the nine changed files (grep count 0). **This is not a green gate and is not reported as
      one:** 515 of 3372 cases (15.3%) did not execute, because Node 16 lacks a global `fetch` and the
      live suites skip. It is accepted as evidence for this diff, and only this kind of diff, because
      the diff touches no source and no test, every suite that reads a changed file is green under this
      reviewer's own runs above with counts identical to the record, and the single red suite is red
      for a recorded host reason unrelated to the diff. **The binding run is CI's Node 22 `stack-free`
      job on the PR.** No Node 22 exists on this host and fetching one needs the operator's OK, so
      none was used.
- [x] L10: `da759e57` and `c62e514d` each touch `scripts/harness-lint-waivers.txt` and
      `engineering-team/CHANGELOG.md` together; `check_L10` reads the latest non-merge commit touching
      a definition path, which is `da759e57`. This review file is a record, not a definition path, so
      committing it cannot disturb L10. L9: `BIBLE.md` and `OPERATIONS.md` untouched. Budgets:
      `CLAUDE.md` and `AGENTS.md` untouched.
- [x] This review is non-numbered and ends at its Verdict. Checked after writing:
      `awk -f scripts/lib/review-verdict.awk` on this file prints `CR`, the file carries exactly one
      verdict-shaped token (the bold line under the final heading), and `bash scripts/harness-lint.sh`
      re-run with this file present is still clean, exit 0, with this file appearing only as one new
      `INFO non-numbered-review` line.

## Claims adherence — each claim, with the command that tried to falsify it

| Claim | Evidence | Result |
|---|---|---|
| A1. Seven files byte-identical between `dd4ce745` and the stranded tip | `git rev-parse <rev>:<file>` for both revs, all seven: identical blob ids (`db898665`, `5e2b0dd4`, `9a49d97e`, `87789e69`, `d42cf79d`, `b93574da`, `084a1c8e`). Extra check the brief did not ask for: `git diff f081f5de origin/staging -- <file>` is empty for the four that exist on staging, so "identical to the stranded tip" clobbered nothing staging had changed since the fork point | holds |
| A2. Lines the cherry-picks add to `OPEN.md` and the CHANGELOG are byte-identical to the stranded rows | `git show --format= --unified=0` per pair, added and removed lines compared with `cmp`: identical for all three pairs (2 + 3 + 1 ledger lines, 1 CHANGELOG line, zero removals). `git patch-id --stable` over every other file: same id per pair. Commit messages identical once the `-x` line is dropped | holds |
| A3. Original author kept | `nous-clawds4 <nous.clawds4@gmail.com>` with the original author dates on all three; committer `virgil-clawds4`, 2026-09-18 | holds |
| B1. All 313 staging rows present and byte-identical | own script, keyed on row number: 0 missing, 0 changed, relative order preserved | holds |
| B2. 321 rows, no duplicate numbers, 72 and 73 exist, only gap in 1..322 is 257 | same script: 321 rows, duplicates `[]`, gaps `[257]` (staging's gaps were `[72, 73, 257]`) | holds |
| B3. Rows 72, 73, 317–322 have 7 cells and no stray pipe | 8 raw pipes and 0 escaped pipes in each; confirmed against the real parser (gates, above) | holds |
| B4. Original Item text survives as a verbatim prefix; note appended to the Item cell; Type / Opened / Pointer unchanged except 319's pointer | prefix test true for all six; appended text begins with the italic landing note in each; Type and Opened unchanged in all six; Pointer changed only in 319 (`~:146` → `` now `:150-151` ``); Status and Done changed only in 73, 317, 320 | holds |
| C. 72–73 were reserved on staging, staging's 74–77 are different items, so only 74–77 move | `origin/staging:OPEN.md:106` carries the reservation note (introduced by `355bef13`); staging has no row 72 or 73; its 74–77 are silent role stalls, equality-bracket brittleness, anchor-matched journal appends, relationship-primitives hardening. Landing at 72–73 was the right call: the ledger itself said the two sets should merge "with no renumber", and the audit's citations of rows 72 and 73 stay valid untouched. The brief's premise that 72–73 collide was wrong; the Implementer caught it | holds |
| C. Intra-ledger citers of 72–77 mean staging's rows | own sweep of `OPEN.md` at HEAD: row 80 → staging's 77, rows 111 and 126 → staging's 75, and one the Implementer's list missed, row 83 (`row-74 orphan hazard`) → staging's 74. All four cite rows that did not move | holds (see Non-blocking 3) |
| C, as written into the record. Amended note at `OPEN.md:108`: the branch's rows 74–77 were "added after this note was written" | GitHub activity API for the branch, against `355bef13`'s commit time and the relationship-primitives journal | **falsified** — Blocking 1 |
| D-72. `test.yml` still gates only PRs into staging and main; the two sandboxes archived; magic-carpet has the same gap | `.github/workflows/test.yml:12` is `branches: [staging, main]` (same on `origin/main`); `scripts/long-lived-branches.txt` marks `feat/communities` and `feat/curate` archived, droplets decommissioned 2026-09; `deploy-magic-carpet.yml` is `on: push: branches: [feature-magic-carpet]` and that branch is absent from `test.yml`; `deploy-staging.yml` and `deploy-tapestry.yml` cover only staging and main, so magic-carpet is indeed the only other ungated deployer | holds |
| D-72, as written. `deploy-communities.yml` / `deploy-curate.yml` "exist only on those branches" | `git ls-tree -r <ref> --name-only .github/workflows/` over every `origin/*` ref | **falsified** for `deploy-communities.yml` — Blocking 2. True for `deploy-curate.yml`. The conclusion ("moot") survives |
| D-73. Resolved: the endpoint answers and the check no longer exits 2 | `curl` → HTTP 200, `"verdict":"safe"`, `enabledEntryCount: 2`. `bash scripts/check-safe-to-merge.sh https://tags.brainstorm.world 1 1` → exit 0 on this reviewer's run (the row records exit 1 with `NEXT_FIRE_WITHIN_BUFFER`; the verdict depends on the schedule, and both are the gate answering — neither is 2). `git log --first-parent … origin/feat/tags -- src/api/deploy-safety/index.js`, last line: `30e4ff68 2026-07-22`, a merge whose second parent is an ancestor of `origin/main`; the file is absent in `30e4ff68^1` and present in `30e4ff68`. Note on "the day it was filed": both records carry 2026-07-22, but on one clock the row was written 2026-07-22T03:23Z and the merge is 2026-07-23T00:36Z, about 21 hours apart. Not worth a change | holds |
| D-317. Duplicate of row 29; row 78 a further occurrence | row 29 (2026-07-15, open): `/plan-feature` skips the eager book-open, candidate fix a step-0 in `plan-feature.md`. Row 317: same defect, same fix. Row 78 records three more occurrences. Closing a duplicate with a pointer matches eight precedents on staging (rows 106, 127, 168, 223, 226, 232, 272 and their kin) | holds |
| D-318. Drift still live; step 9 predates the row and covers something else; not recorded elsewhere | `grep -c 'NIP-85'`: story 0, `TrustedAssertions.jsx` 1. `git log -S'Log smaller deviations as you go'` → `24ed9513`, 2026-06-05; the step's own text scopes it to the Implementer's judgment calls. Two regex passes over staging's 313 rows and a `git grep` over roles, workflows, templates, commands and agents found no row or rule about scope added after approval | holds |
| D-319. Extractor unchanged at `:150-151`; bold form yields nothing | read the function (`check_L2` spans `:130-153`); piped both list forms through the two-stage `grep -oE`: plain form yields the slug, bold form yields nothing | holds |
| D-320. Duplicate of row 43; chain gone; the row's own attribution to `418049a1` is mistaken | row 43: same severed `overallOk` chain, same seven suites plus the same two never-wired ones, opened 2026-07-16, done 2026-07-25. `git grep -n overallOk origin/staging -- test/` → one comment line in `stack-free-npm-test.test.js`; `test/test.js` is 25 lines and `test/registry.js` exists. `git show 418049a1 -- test/test.js`: the hunk turns `usersPageNeo4jEndpointResult.fail === 0;` into `… &&` and adds its own term carrying the `;`, with the dead `harnessLintResult…` block already below it as context. The terminator pre-existed; the correction is right, and keeping the original sentence with a marked note is the right way to make it | holds |
| D-321. Story 1 shipped, and the file does not support a flip | `821b0b47` is 2026-06-20 (author-local and UTC), an ancestor of `origin/main` and `origin/staging`; routes at `ui/src/App.jsx:212,216` (hub at `:208`). Story: `Status: Approved`, 5 criteria unchecked and 0 checked, `Review: (filled after Review phase)`, no `## Deviations`; neither `reviews/developers-pages/` nor `reviews/done/developers-pages/` exists; no book covers it (the landed book says so). Under the brief's rule a row was the right call: the two stories this landing does mark done are backed by a book-scope audit, and story 1 has no audit and no review | holds (see Non-blocking 6) |
| D-322. Row 47 pre-registered a fresh row; row 47's candidate fix would not cover this epic; the waiver retires with 322, not with 319 | row 47's pointer cell ends: the gap "re-opens with the next multi-book epic, as a fresh row". `grep -rl developers-pages engineering-team/audits/ --include=book.md` → one book, `about-brainstorm-search`, Status `Closed`; the six books that are not closed do not list it, so "skip an epic that a book which is not Closed also lists" would not exempt it. A parser fix (319) makes L2 see more epics, never fewer, so it cannot retire a waiver that exists because L2 fires. Control 2 above shows the waiver is what keeps lint green. Judgment: correct, and warranted rather than scope creep — see Non-blocking 1 | holds |
| D-321, as written. Row 321 ends "(L2 waiver; row 319)" | read against rows 319 and 322, the CHANGELOG row and the waiver line, all written in the same commit | **inconsistent** — Blocking 3 |
| E. No surviving citation of the old 74–77; the audit's other citations still resolve; every number cited inside the eight rows resolves | swept all seven landed files for ledger citations: `audit.md` cites 317, 318, 319, 320 where it cited 74–77, and nowhere else. Rows 72, 73, 27, 38, 39, 47, 51, 69, 70, 71 read on staging and each still means what the audit says (71 was narrowed on 2026-09-13 and itself forwards the TA-literal half to 44). Inside the eight rows: 29, 38, 39, 43, 47, 78, 319, 322 all resolve; the one that resolves to the wrong place is Blocking 3 | holds, bar Blocking 3 |
| F. Landing corrections accurate and marked | `engineering-team/epics/done/` does not exist; `audit.md:119` (§7) records the `git mv` as reverted; the epic file is in place with `Status: Done`. `book.md:48` quotes the words it replaced; `book.md:49` keeps "2026-06-19" and adds a dated note. The audit's landing note was checked sentence by sentence against the diff (`git diff dd4ce745 da759e57 -- …/audit.md`: the note plus five citation lines, nothing else) and is accurate; nothing in it is overstated | holds (see Non-blocking 4, 5) |
| G2. CHANGELOG row: 4 cells, last, tail chronological; re-dating acceptable | 5 pipes; last line of the file; the final eight rows run 09-10, 09-10, 09-11, 09-12, 09-12, 09-17, 09-18, 09-18. The file's one out-of-order pair (line 70) is far above and already on staging. Re-dating is the honest option: the CHANGELOG records changes to the harness definition on the shared line, and this waiver takes effect there on landing; keeping 2026-07-22 would either break the file's "appended at the bottom, chronological" rule or back-date a change the shared line did not have. The authored date is kept in the row's text | holds |
| G3. Waiver line has exactly 3 tab-separated fields | split on tab: all nine waiver lines have 3 fields; file ends with a newline | holds |
| G6. Placeholder `stranded-close PR` in the Done cells of 73, 317, 320 | `git grep -n 'stranded-close PR'`: `OPEN.md:106`, `:378`, `:381` — and a fourth the brief did not list, `audit.md:9` | holds (see Non-blocking 2) |
| H. Nothing else | `git diff --name-status origin/staging..HEAD`: the nine expected files, 3 added and 6 modified. Added lines scanned for 64-hex strings, `nsec1`, `npub1`, `82b75e47`, private-key headers, token shapes, and the words secret / password / token: no hit | holds |

## Things tests can't catch

- [x] No secret, credential or key material in the diff, and no TA pubkey literal (CLAUDE.md
      § "Per-deployment TA pubkey"). Nothing in the diff touches a `LEGACY_*` constant.
- [x] **"Byte-identical to the stranded tip" could have been a defect rather than a virtue** if staging
      had changed any of those files in the 58 days since the fork point `f081f5de`. It had not: the
      four that exist on staging are unchanged between `f081f5de` and `origin/staging`, and the three
      audit files are new.
- [x] **The numbers are still free.** `git ls-remote origin refs/heads/staging` is `4585e1e1`, the
      base of this branch, so staging's max is still 316 and 317–322 are still the next free numbers.
      No open PR targets staging. If another session lands rows at or above 317 before this merges,
      the landing must renumber again and sweep `OPEN.md`'s own citations as well as the landed files
      (row 207): rows 319 ↔ 322 cite each other, 321 cites 319, and `book.md`, the CHANGELOG row and
      the waiver line cite 321 and 322.
- [x] Landing-time edits to a closed book are marked, dated, and quote what they replaced; nothing in
      the closed book was silently rewritten. The one staging line the landing touched, the
      2026-07-22 numbering note, keeps its original text as a verbatim prefix with the new
      parenthetical appended. That parenthetical is where Blocking 1 lives.
- [x] No debug residue, no commented-out text, no stray worktree, no stash. `git status --short` after
      all experiments shows only this file.

## Findings

### Blocking

All three are statements the landing commit itself wrote into `OPEN.md`. None touches a staging row,
so B1 is unaffected by fixing them. Each fix is a few words; the suggested wordings contain no pipe.

**1. `OPEN.md:108` — the amended numbering note says the branch's rows 74–77 were "added after this
note was written". They were on origin about fourteen hours before it.** The sentence reads: "Its
later rows 74–77, added after this note was written, did collide with this close's 74–77". Evidence:

```
$ gh api 'repos/nous-clawds4/tapestry/activity?ref=refs/heads/ops/open72-73-ci-gate-and-tags-safety-gap' \
    --jq '.[] | [.timestamp, .activity_type, .before[0:8], .after[0:8]] | @tsv'
2026-07-22T04:13:24Z  push             8a9ef91e  d42715a4     (row 77)
2026-07-22T04:13:07Z  force_push       fd2d3f83  8a9ef91e     (rows 74-76, amended)
2026-07-22T03:48:32Z  push             e3aa871a  fd2d3f83     (rows 74-76)
2026-07-22T03:23:20Z  branch_creation  00000000  e3aa871a     (rows 72-73)

$ TZ=UTC git log -1 --format='%h %ad' --date=format-local:'%Y-%m-%dT%H:%M:%SZ' 355bef13
355bef13 2026-07-22T18:21:32Z          (the commit that introduced the note)
```

The note cannot have been drafted much earlier than its commit either: it belongs to the
relationship-primitives close, and that run's journal records its final completion audit at
2026-07-22T06:55:49Z, already two and a half hours after the last push above. So all six rows were on
origin when the reservation was written, and the reservation covered only the two the branch name
advertises. This matters beyond the six words: as landed, the record puts the cause of the collision
on the stranded branch (it kept adding rows after being given a reservation), when the cause was on
the reserving side (it reserved from a name, or a stale look, rather than from
`git show origin/<branch>:OPEN.md`). That is the lesson a future session needs, and the landed
sentence hides it. **Asked change:** state the true order, for example: "Its rows 74–77 were already
on origin when this note was written — pushed 2026-07-22T03:48Z–04:13Z, against this note's 18:21Z
commit — but the reservation covered only the two rows the branch name advertises, so they collided
with this close's 74–77 and moved to 317–320". The same false ordering appears nowhere else: the new
note above row 317, the audit's landing note ("in the meantime") and the commit message ("the same
day") are all accurate.

**2. `OPEN.md:105` (row 72's landing note) — "`deploy-communities.yml` / `deploy-curate.yml` exist
only on those branches" is false for `deploy-communities.yml`.** Looping
`git ls-tree -r <ref> --name-only .github/workflows/` over every `origin/*` ref finds
`deploy-communities.yml` on 16 branches: the two archived ones plus 14 older topic branches, among
them `origin/ops/open72-73-ci-gate-and-tags-safety-gap`, the very branch this packet landed. The
reason is that the shared line carried the file until `3b84677d` (2026-09-12, "decommission
feat/communities + feat/curate sandboxes"), so every branch forked before then still has a copy.
`deploy-curate.yml` is on `origin/feat/curate` only and never reached staging, so that half is true.
The row's conclusion — the original parenthetical is moot — survives, for a different reason: each
copy is `on: push: branches: [feat/communities]` (or `[feat/curate]`), so only a push to an archived
branch could fire one, and the droplets and deploy secrets are gone (`OPERATIONS.md:41,134-136`).
Small, but the row's original text asks the fixer to "confirm before fixing", this sentence presents
itself as that confirmation, and one command contradicts it. **Asked change:** replace the clause, for
example: "the shared line dropped `deploy-communities.yml` in `3b84677d` (2026-09-12) and never
carried `deploy-curate.yml`; the copies that survive on older branches trigger only on pushes to the
two archived branches, so that parenthetical is moot".

**3. `OPEN.md:382` (row 321) — "(L2 waiver; row 319)" points at the row this same commit says does not
govern the waiver.** Row 319's landing note: the waiver "does not retire with it: that waiver answers
a different L2 gap, row 322". Row 322: "Retire the waiver with this fix." The CHANGELOG row and the
waiver line were both deliberately moved off 319 for exactly this reason, and the CHANGELOG row
explains the conflation at length. Row 321 repeats it — most likely written before row 322 was minted
and not swept afterwards. A reader following row 321 to learn why the epic may stay Active lands on
the parser defect. **Asked change:** "(L2 waiver; row 322)".

After the fix: re-run `bash scripts/harness-lint.sh` and the six suites listed under Quality gates,
and re-check rows 72 and 321 for 7 cells.

### Non-blocking

**1. Row 322 and the 322 repoint go beyond the brief's literal instruction, and are right.** The brief
said to repoint citations of old numbers; a mechanical 76 → 319 would have landed, on the shared line
for the first time, a CHANGELOG row saying a parser fix "should retire" a waiver it cannot retire.
Row 47 had closed with an explicit instruction that the gap re-opens "as a fresh row" with the next
multi-book epic; the stranded close met that epic on 2026-07-22 and did not file the row, which left
the waiver's "Retire this waiver with the L2 fix" pointing at no live row at all. Filing 322 discharges
row 47's instruction, and CLAUDE.md's write discipline asks for a `meta` row for any harness defect
before the session ends. The CHANGELOG row keeps its original sentence visible inside a dated
parenthetical, so the deviation is auditable. Not scope creep.

**2. Four placeholders, not three.** `stranded-close PR` also appears in `audit.md:9`. When the PR
number exists, substitute all four (`git grep -n 'stranded-close PR'`), following `fdd697b1`.

**3. Row 83 also cites staging's row 74** ("the row-74 orphan hazard"). It was not in the
Implementer's list of intra-ledger citers (80, 111, 126). It means staging's row, which did not move,
so nothing needed repointing; recorded because the completeness of that sweep is row 207's whole
point.

**4. `book.md:49`, as written, was already stale on the day it was written:** "exactly as it is for
`tag-event-inspector` under OPEN.md row 47". Row 47's 2026-07-18 note records that waiver as removed,
and `scripts/harness-lint-waivers.txt` carries no `tag-event-inspector` line, at the fork point or
now. This is original text, not an Implementer claim, and the landing's policy of leaving the body as
written is sound — but the landing edited this very bullet, so a third marked note would have been
cheap. Optional.

**5. `book.md:48` calls the replaced words "the first draft".** They were the text as committed on the
stranded branch (`8a9ef91e`), not an uncommitted draft; row 319 uses "first draft" for something that
really was one. Optional: "as committed on the stranded branch".

**6. Row 321's title says "nothing in the file to support a flip".** The story's Background does carry
the builder's one-line self-report, written in the same commit as the code: "built lightweight (no
ADR/failing-tests; browser-verified)". The row's body says as much, and a self-report is not evidence
against acceptance criteria, so the decision stands; the title is a shade more absolute than the file.

**7. Every "landed 2026-09-18" assumes a same-day merge.** If the PR merges later, bump at least the
CHANGELOG row's Date cell — the one the file's chronological rule reads — in the same follow-up commit
as the PR-number substitution.

**8. For the PR body.** The packet's done-condition is that the PR lists the renumbering map:
72→72, 73→73, 74→317, 75→318, 76→319, 77→320; 321 and 322 new. The commit message's "four citations"
in the audit undercounts slightly: `audit.md` changed on five lines (seven numbers — line 120 lists
three of them), plus the landing note.

**9. After the merge the stranded branch will still list as unmerged in `/whats-open`,** because
cherry-picks are not ancestors. Deleting `origin/ops/open72-73-ci-gate-and-tags-safety-gap` once the
PR merges is the operator's call; provenance survives in the three `-x` trailers, though the fidelity
checks in this review can no longer be repeated once it is gone.

### Harness friction

**1. A reservation made from a branch's name under-reserves** — the lesson behind Blocking 1. The
2026-07-22 close reserved "72–73" for a branch named `open72-73-…` that had carried 72–77 on origin
for fourteen hours. Rows 151 and 307 already track colliding ledger numbers; this is a further
occurrence with a specific candidate: derive any reservation from
`git show origin/<branch>:OPEN.md`, never from the branch name. Suggest appending it to row 307
rather than minting a row.

**2. The packet's premise needed checking, again.** The brief said the stranded numbers collide with
staging's 72–77; two of the six did not. The Implementer's per-claim verification caught it — the same
pattern as the ledger-closeout review's finding 6.

**3. Row 316 recurred.** This reviewer's wiring said to commit the review and flip statuses; the brief
reserved both. The brief was followed.

**4. The brief's duration for the full gate (about 25 minutes) describes a Node 22 run against a live
stack.** The recorded Node 16 run took 3 m 15 s. Worth knowing when deciding whether a reviewer may
re-run it; here the prohibition was followed and the record verified instead.

## Verdict

**CHANGES_REQUESTED**

Three statements the landing commit wrote into the ledger do not survive a command: a false account
of why the numbers collided (OPEN.md:108), a false statement of where two workflow files exist
(OPEN.md:105), and a cross-reference that contradicts the commit's own analysis (OPEN.md:382). Under
the rule this review was given, a false claim in a record or a wrong cross-reference is enough on its
own, and the first of the three would mislead the next session that has to reserve ledger numbers.

Everything else held, and held well. The cherry-picks are verbatim and clobbered nothing; all 313 of
staging's rows are byte-identical; landing 72 and 73 in their reserved slots was right where the brief
was wrong; every triage disposition checked out against the live system; the correction to the old
row's attribution is accurate and properly marked; row 322 is a correct and warranted judgment; lint
is clean and provably evaluated the new book. The fix is three short edits inside rows this packet
authored, then lint and the six suites again. It does not need a fresh full-gate run on this host;
the binding gate remains CI's Node 22 job on the PR.
