# Review: `OPEN.md`'s numbered table is one table again (doc lane)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-20
**Diff:** `git diff 2e500d6f..187df161` — one commit `187df161` on branch `docs/open-md-one-table`,
on top of `origin/staging` `2e500d6f`. Four files: `OPEN.md`, `engineering-team/CHANGELOG.md`,
`scripts/harness-lint.sh`, `test/helpers/ledgerFixtures.js`.
**Lane:** doc lane (Implementer + Reviewer). No story, no ADR, no test plan — so the *Spec
adherence* section is replaced by the claims table below, per the review-checklist docs-mode
variant. The branch tip on origin (`gh api …/git/ref/heads/docs/open-md-one-table` →
`187df16199b88c66d1eb14c323e8346600e682e5`) equals the local HEAD; `origin/staging` is
`2e500d6f4fd6a98c24e8fe78344a670c5b3b9e06`. No PR exists.

**Rounds.** This file is one review in three rounds, each appended above the single `## Verdict`
at the bottom, which is rewritten in place and always states the *current* verdict. Round 1
(`187df161`) — CHANGES_REQUESTED, three blocking findings, recorded below as written. Round 2
(`c5a92115`) — CHANGES_REQUESTED, one new blocking finding. Round 3 (`4328e0ab`) — the verdict at
the bottom. What follows immediately is round 1, unedited.

---

## Quality gates (run by the reviewer, not trusted)

| Gate | Result |
|---|---|
| `bash scripts/harness-lint.sh` on the branch tip | exit 0 — `harness-lint: clean (0 violations)`. L15 prints no line (silent pass). L10 is satisfied: `scripts/harness-lint.sh` is a def path (`scripts/harness-def-paths.txt:32`) and the commit carries a CHANGELOG row. |
| `test/ledger-row-ids.test.js` (Node 22.23.2) | `{"pass":6,"fail":0}` |
| `test/harness-lint.test.js` | `{"pass":63,"fail":0}` |
| `test/session-start.test.js` | `{"pass":32,"fail":0}` |
| `test/operational-direction.test.js` | `{"pass":86,"fail":0,"failures":[],"skipped":0}` |
| `test/curated-dlist-update-update-preview.test.js` | `{"pass":34,"fail":0,"failures":[],"skipped":0}` |
| `test/curated-dlist-update-publish.test.js` | `{"pass":69,"fail":0,"failures":[],"skipped":0}` |
| `npm test` (full gate) | **Not run by me.** See "Not verified" below. Last recorded run, `npm run gate:status`: `20260920T043945Z-7994-0be6 [ledger-row-identity-close-final] started 2026-09-20T04:39:45.863Z on d79a0dab+dirty — FAIL, exit 1, 3238 passed, 51 failed, 139 skipped, 207/207 suites` — the known-red host baseline (OPEN.md row 289). It predates this commit. |
| `npm run test:playwright` | N/A — no browser surface in the diff. |
| Lint / typecheck / build | Not configured in this project. |

Suites were invoked through their `run()` export (`node -e "require('./test/<s>.test.js').run()…"`),
never `node test/<s>.test.js` (OPEN.md row 310), with Node 22 x64 prepended to `PATH` (`node -v` →
`v22.23.2`; host node is v16.17.0).

**Why the six:** `git grep -n "['\"]OPEN\.md['\"]" -- test/` gives exactly six suites that open the
real `OPEN.md` from disk — the six above. Every other `test/` file matching `OPEN.md` matches it in
a comment. None of the six appears in the red baseline's 15 failing suites.

---

## Claims-adherence table

Every row re-derived here from my own commands; nothing taken from the Implementer's brief, the
commit message or the CHANGELOG.

| # | Claim | Verified? | Evidence |
|---|---|---|---|
| 1a | Before: the Items table was cut into **nine** chunks | ✅ | awk over `git show 2e500d6f:OPEN.md`, runs of `^\|` after the `\| # \| Type` header: chunks at lines 32–70, 72–94, 99–111, 114–131, 137–210, 212–250, 269–379, 383–394, 398–412. Nine. |
| 1b | …by **22 blank lines** and **16** blockquote notes | ❌ **21**, not 22 | The 8 gaps hold 37 non-`\|` lines: 21 empty, 16 blockquote, 0 other. Independently: the `OPEN.md` diff has 37 deletions — `grep -c '^-$'` = 21, `grep -c '^->'` = 16. **Blocking finding 3.** |
| 1c | Only the first chunk had a header; **37** rows rendered, **305** did not | ✅ | Chunk 1 = 39 lines = header + `\|---\|` + 37 rows; 342 data rows total ⇒ 305. Rows 1–37 are exactly ids 1–37 (ids 6/7/8 are out of order but all present). GitHub's own render of `ref=staging` has 45 `<tr>` (7 preamble + 1 header + 37) and no `<td>38</td>`. |
| 1d | The first blank line arrived with the 2026-07-15 `feat/tags` ↔ `staging` merge | ⚠️ defensible at date granularity, wrong at commit granularity | Chunk count across all 319 commits touching `OPEN.md`: 1 at `235e9e16` (the merge itself, 2026-07-15 21:24:29 -0400) and 2 first at `8786f131` (2026-07-15 21:57:00 -0400, *"fix: reconcile staging's regression guards with feat/tags' deliberate changes"* — the integration's follow-up). And the blank line was **not inserted**: `git show 8786f131 -- OPEN.md` shows it as *context*, the table's pre-existing trailing blank, with the new row appended **below** it. Non-blocking finding 1. |
| 1e | Story `ledger-row-identity` #1 added the ninth break | ✅ | `git log -S'the last duplicate, settled without a renumber' -- OPEN.md` → `8e624eb5` ("impl: collision-free-ledger-row-ids"). Chunks: `8e624eb5^` = 8, `8e624eb5` = 9. |
| 2a | Every `^\|` line byte-identical and in the same order, **352** of them | ✅ | `grep -a '^\|'` from each side → `cmp` clean; both md5 `9c1bcaacd72a5d1ba95fded37f0d1283`; 352 lines each. |
| 2b | What the 352 are | ✅ | 8 preamble-table lines (header + `\|---\|` + 6 rows) + the Items header + its `\|---\|` + **342** data rows = 352. |
| 2c | No row added, removed, reordered or edited; id→line map identical | ✅ | Follows from 2a (byte-identical *and* same order). Separately: 342 ids, `sort \| uniq -d` empty. |
| 2d | The freeze marker still reads 343 and equals the highest id | ✅ | `<!-- ledger-table-frozen: highest-number=343 -->` (new line 378, old line 415); max id in the table = 343. |
| 3a | 16 notes before, 16 after, original top-to-bottom order | ✅ | `grep -a '^>'` each side → 16 and 16; the date/slug sequence is identical line for line. |
| 3b | Fifteen byte-identical; exactly one reworded | ✅ | Per-line md5, positionally paired: 15 of 16 match; note 16 differs. |
| 3c | The one rewording is the single phrase named | ✅ | Word-level diff of note 16: `directly below.**` → `— the only row 329 left in the table.**`. Nothing else in that line changed. |
| 3d | The rewording is **true** | ✅ | `grep -c '^\| 329 \|' OPEN.md` = 1, and that row is the undeclared-identifier cleanup row. |
| 3e | No other note leaned on its position | ❌ | `OPEN.md:388` (the 2026-07-22 note) ends *"…see the numbering note **above row 317**."* At `2e500d6f` that note sat at line 381, immediately above row 317 at line 383 — the locator resolved. It now sits at line 412, below the whole table. **Blocking finding 1.** (The only other positional word in the 16 notes is `OPEN.md:412`'s "the slots reserved for them above", which stays true: both the rows and the reserving note are still above it.) |
| 3f | The new section sits after the freeze marker | ✅ | Marker at 378, `## Numbering notes` at 380. |
| 3g | The intro paragraph states only true things | ❌ partly | "sixteen" ✅; "nine pieces" ✅; "every row after 37" ✅; "the 2026-07-15 `feat/tags` merge" ⚠️ (1d); "in their original top-to-bottom order" ✅; "Fifteen are unchanged" ✅; "Each note names the rows it is about" ✅ (all 16 carry row numbers). But the bolded closing rule — *"a blank line, **or anything else that is not a row**, ends a markdown table"* — is false in its second clause. **Blocking finding 2.** |
| 4a | GitHub render, `ref=docs/open-md-one-table`: 2 tables, 350 `<tr>`, `<td>38</td>` and `<td>343</td>` present, 16 `<blockquote>` | ✅ | `gh api "…/contents/OPEN.md?ref=docs/open-md-one-table" -H "Accept: application/vnd.github.html"` → `<table>`×2, `<tr>`×350 (7+1+342), `<td>38</td>`×1, `<td>343</td>`×1, `<blockquote>`×16, `<h2>`×3. |
| 4b | Same call with `ref=staging`: 45 `<tr>`, no `<td>38</td>` | ✅ | `<tr>`×45, `<td>38</td>`×0, `<td>343</td>`×0, `<blockquote>`×16, `<h2>`×2. Row 38 appears there as `<p dir="auto">\| 38 \| meta \| …`. |
| 4c | Nothing renders **worse** | ✅ — and three things render **better** | Per-row `<td>` census of the new render: 342 rows × exactly 7 cells (2406 `<td>` total incl. the preamble's 12). No row's literal pipes break the table — the nine rows carrying a pipe in a later cell all render correctly. The freeze marker renders as nothing in **both** (`ledger-table-frozen` appears 0 times in either HTML). Notes: 16 blockquotes both, but three of the old ones had **swallowed the rows below them** — a blockquote followed with no blank line lazily absorbs the following lines, so old chunks 3 (13 rows), 4 (18 rows) and 7 (111 rows) — 142 of the 305 — were rendered as run-on prose *inside* three quote blocks. The new render has none of that. |
| 5a | `/whats-open`'s ledger section byte-identical | ✅ | Two detached worktrees at `2e500d6f` and `187df161`; `bash scripts/whats-open.sh` in each. The **whole** 408 328-byte output is `cmp`-clean, ledger section included. 243 open table rows on both sides, counted the script's own way. |
| 5b | The meta list and count byte-identical, `count=122 oldest=80` | ✅ | `bash -c '. scripts/lib/collect-meta.sh; collect_meta; …'` in each worktree (bash, not zsh): both `count=122 oldest=80`, `META_LINES` `cmp`-clean. `bash scripts/session-start.sh` is byte-identical too (8288 bytes each). |
| 6 | Gates | ✅ | See the table above — all six suites match, harness-lint clean. |
| 7a | The `scripts` / `test` diff is comment-only | ✅ | Every `+`/`-` line in `git diff 2e500d6f..187df161 -- scripts test` begins (after optional whitespace) with `#` or `*`: `grep -cvE '^[+-][[:space:]]*(#\|\*\|/\*)'` = 0. Both hunks sit inside the L15 header comment block and a JSDoc block respectively. |
| 7b | L15 "still tolerates a stray note" | ✅ | `check_L15`'s awk is unchanged: after the `\| # \|` header sets `hdr`, only `/^\|/` lines are read, so a blank line or a `>` note is skipped and the scan continues. |
| 7c | The fixture still tests that | ✅ | `REAL_SHAPE_ROWS` still carries `''`, a `> **Numbering note (fixture):**` line and `''` between chunks (`test/helpers/ledgerFixtures.js:68–70`), and the L15(a) duplicate tests append their duplicated ids **after** that note and still detect them — i.e. the note provably does not hide later rows. |
| 8 | The CHANGELOG row is one row for one logical change, stating only true things | ❌ | One row, one change ✅. Contents true except "the 22 blank lines" (blocking finding 3) and the 1d attribution (non-blocking finding 1). |
| 9a | Nothing mechanical reads the notes or the layout | ✅ | Only three scripts open `OPEN.md`: `harness-lint.sh` (L15), `lib/collect-meta.sh`, `whats-open.sh` — all three filter to `^\|` lines and are layout-blind. `git grep -n "Numbering note\|Merge note" -- test/ scripts/` hits only the fixture. Confirmed empirically by 5a/5b. |
| 9b | Nothing is now *actively* wrong outside `OPEN.md` | ✅ | Every `OPEN.md:<line>` citation in the repo lives in a dated review artifact, and I spot-checked eight of them (105, 106, 108, 348, 365, 382, 386, 395) against `2e500d6f`: all were **already** stale before this commit. `OPEN.md`'s own rule is "cite the id, never the path". Non-blocking finding 2 covers the one prose reference that drifted. |
| 9c | The retired ADR should stay as is | ✅ agreed | `engineering-team/decisions/done/ledger-row-identity/0001-…md:275` ("the table gets one numbering note where it stood") describes what that decision instructed on 2026-09-19 and what was done. `workflows/5-review.md` § Epic close-out makes everything under `done/` read-only by convention; editing it would falsify the record of the decision as made. Leave it. |
| 10 | Scope: nothing beyond the ask | ✅ | Four files, `M` only, no new files. No row content edited, no lint behaviour changed, no new tooling (no `package.json` touch), no new check. No secrets, no debug code, no trailing whitespace on any added line, file still ends with a newline. |

---

## Findings

### Blocking

**1. `OPEN.md:388` — this commit turned a working locator into a false one.**
The 2026-07-22 note ends:

> …so they collided with this close's 74–77 and moved to 317–320; **see the numbering note above row 317.**

At `2e500d6f` the 2026-09-18 note sat at line 381 and row 317 at line 383 — directly above, exactly
as written. It now sits at line 412, below the entire table; nothing is above row 317. This is the
same defect class the commit deliberately fixed one line 26 further down (note 16's "directly
below" → "the only row 329 left in the table"); the second instance was missed, and the intro
paragraph's "Fifteen are unchanged; the last one's pointer was reworded" presents the fix as
complete when it is not.
**Ask:** reword the pointer so it does not depend on position — e.g. *"see the 2026-09-18 numbering
note in this section"* — and, if the intro's account of what was reworded is kept, make it say two.

**2. `OPEN.md:382` — the bolded rule the new section exists to teach is not how markdown works.**

> **Keep the table in one piece: a blank line, or anything else that is not a row, ends a markdown
> table.**

The second clause is false, measured against GitHub's own renderer. `POST /markdown` on a table
whose rows are interrupted by a plain prose line renders that line as a **one-cell table row** and
keeps going — the table does not end. What ends a table is a blank line **or the start of another
block-level structure** (a heading, a blockquote, a list); a `>` line ends it *and* lazily absorbs
the pipe lines that follow, which is precisely the second defect measured in claim 4c. Stating it
this way also loses the information a future session actually needs: that the danger is a blockquote
or a heading, not "anything".
**Ask:** state the rule as measured — a blank line, a heading, a blockquote or any other
block-level structure ends the table; a plain line without pipes is absorbed as a row instead.

**3. `engineering-team/CHANGELOG.md:91` — the measured count is wrong: 21, not 22.**

> …and **the 22 blank lines** between rows are gone…

The eight gaps held 37 lines: 21 empty and 16 blockquotes. The commit's own `OPEN.md` diff deletes
exactly 21 empty lines (`grep -c '^-$'`) and 16 blockquote lines (`grep -c '^->'`), 37 total, which
is also the file's net change (415 → 414 lines with 36 additions). Nine chunks need eight gaps, and
two of those gaps (old lines 71 and 211) are a single blank line with no note — there is no
arithmetic under which the figure is 22. Every other number in the row is right (16, 352, 9, 1, 37,
305), which is what makes this one costly: it is in the append-only harness record a future session
will cite, and it is one character.
**Ask:** `22` → `21` in the CHANGELOG cell. The same figure is in the commit-message body
(`docs(ledger): …`, third line of the paragraph) — worth amending in the same pass, since the branch
has no PR yet.

### Non-blocking

**1. `engineering-team/CHANGELOG.md:91` and `OPEN.md:382` — "the first blank line arrived with the
2026-07-15 `feat/tags` ↔ `staging` merge" is loose in two ways, both harmless as shipped.**
(a) The merge commit `235e9e16` (2026-07-15 21:24:29 -0400) has a **one-chunk** table; the first
two-chunk `OPEN.md` is `8786f131` (21:57:00 -0400), the integration's follow-up fix. (b) No blank
line was inserted — `8786f131` appended the new row *below* the table's pre-existing trailing blank
(the blank is context in its diff). So the accurate sentence is "a row was appended below the
table's trailing blank line during the 2026-07-15 `feat/tags` ↔ `staging` integration
(`8786f131`)". The shipped prose names no hash, so at date-and-event granularity it is defensible
and I am not blocking on it. *Recorded because the Implementer's brief did name a hash — `235e9e16`
— and that attribution is wrong; a later session copying it into a record would be propagating an
unverified claim.*

**2. `engineering-team/epics/ledger-row-identity.md:56` — "the four numbering notes **inside** the
table (2026-07-15, 2026-07-18, 2026-07-22, 2026-07-24)".** The four named notes are now under the
table, not inside it. The epic is `**Status:** Done` / `**Retired:** 2026-09-20`, i.e. a record of
its day, so I would leave it; flagging it only so the next reader of that line knows why it reads
oddly.

**3. Positive, unclaimed: the change fixes a second rendering defect nobody named.** In the old
render, three blockquotes were followed by a chunk of rows with no blank line between, so GFM lazy
continuation pulled those chunks *into* the quote — old chunks 3, 4 and 7, i.e. **142 of the 305
unrendered rows**, were displayed as run-on prose inside three quote blocks rather than as 142
paragraph lines. The new render has 16 clean blockquotes and 342 clean rows. Worth a sentence in the
CHANGELOG's Why cell if the row is being touched for finding 3 anyway.

**4. Deliberately-absent recurrence guard.** Option 1 promised none and none was built, so this is
not a scope violation. But the defect ran for **67 days** (2026-07-15 → 2026-09-20) with nothing
mechanical able to see it, precisely because no reader reads the layout. The table is frozen, which
removes the *row*-insertion path, but nothing stops a future session putting a note, a heading or a
paragraph between rows again — `harness-lint` L15 is explicitly indifferent to it. See the proposed
ledger row below.

### Harness friction

None attributable to this change. Two environment facts worth restating for the next reviewer of an
`OPEN.md` diff, both already carried by existing rows: the file holds a line that is not valid
UTF-8, so every comparison here used `-a` / `cmp` on bytes; and suites must be driven through their
`run()` export (row 310).

---

## Proposed ledger rows (not filed — the caller files)

Searched first: `git grep -niE "renders? the table|markdown table|contiguous|raw pipe|pipe-text" --
OPEN.md ledger/` returns only the new `OPEN.md:382` prose, and neither
`ledger/2026-09-20-freeze-marker-can-be-bumped.md` (the marker is self-declared) nor
`ledger/2026-09-20-rollup-reader-gap-and-stale-comment.md` covers this. Not a duplicate.

**`2026-09-20-nothing-guards-table-contiguity`** — type `meta`.
> `OPEN.md`'s Items table rendered broken on GitHub for 67 days (first break `8786f131`, 2026-07-15;
> found by the operator 2026-09-20) and no check could see it, because every mechanical reader —
> `harness-lint` L15, `scripts/lib/collect-meta.sh`, `scripts/whats-open.sh` — filters to `^\|`
> lines and is deliberately layout-blind. Freezing the table closes the row-insertion path but not
> this one: a note, a heading or a stray paragraph between rows still silently hides every row below
> it (and a blockquote is worse — GFM lazy continuation swallows the following rows into the quote;
> that happened to 142 rows here). Fix shape: one `harness-lint` check that between the `| # |`
> header and the freeze marker every line starts with `|` — three lines of awk next to L15, using
> the scan it already performs. Cost of *not* doing it is a silent, months-long regression in the
> single ledger every session reads.

---

## Not verified

1. **The full `npm test` gate — I did not run it.** Justification, not an excuse: the diff contains
   **zero executable lines** (claim 7a), the six suites that read the real `OPEN.md` all pass under
   Node 22, the two read-surface scripts produce byte-identical output before and after, and
   `harness-lint` is clean. The gate is red on this host on every branch (15 live-stack suites,
   OPEN.md row 289) — the last recorded run is quoted in the gates table — and none of its 15
   failing suites is one of the six. A red run here could not have distinguished this change from
   its parent. CI's stack-free job on the PR is the remaining gate and has not run (no PR exists).
2. **Rendering on surfaces other than github.com.** I measured GitHub's own renderer via
   `contents` + `Accept: application/vnd.github.html` and `POST /markdown`. Other consumers of
   `OPEN.md` (editor previews, the raw file) were not checked; nothing in the repo reads it as
   rendered markdown.
3. **Whether the operator considers the new `## Numbering notes` placement the one they asked for.**
   The ask, as relayed, was option 1 ("move the notes under the table"), and that is what shipped;
   the section's position *after* the freeze marker rather than before it is an unstated judgement
   call. Reads correctly to me — the marker terminates the table, the notes are commentary on it —
   but it was not in the ask, so I am naming it rather than ratifying it.
4. **Intent behind "22".** I established the true count is 21 and that the diff deletes 21 empty
   lines. I did not reconstruct how 22 was arrived at, so I cannot rule out that it counts something
   I have not thought of; finding 3 should be read as "the figure does not match any blank-line
   count I can construct, including the one the diff performs".


---

# Round 2 — commit `c5a92115`

**Date:** 2026-09-20
**Diff:** `git diff 187df161..c5a92115` — `OPEN.md` (4 lines) and `engineering-team/CHANGELOG.md`
(2 lines), 3 insertions / 3 deletions. Branch is now two commits; `187df161` was **not** amended
(deliberately — round 1 cites it by sha) and its message body still carries the wrong "22", which
`c5a92115`'s body says out loud. **On the amend question:** don't. The branch has no PR, so a
force-push is cheap, but the wrong figure is corrected in both *readable* surfaces and confessed in
the commit that corrects it; rewriting history to fix a message body is a worse trade than a
one-line confession that a future `git log` reader will see next to the figure.
**Round-1 findings are re-checked here as fresh claims, per `roles/reviewer.md` step 10.**
Head at review time: local `c5a92115` == `gh api …/git/ref/heads/docs/open-md-one-table`
(`c5a92115e6678415b6f1bee4da941dedb413dcee`).

## Round-1 findings — disposition

| # | Round-1 finding | Now | Evidence re-derived at `c5a92115` |
|---|---|---|---|
| B1 | `OPEN.md:388` — "see the numbering note above row 317" is false after the move | ✅ **fixed** | The note now reads "…see the **2026-09-18 numbering note in this section**." Exactly one note in the section is dated 2026-09-18 (`grep -c 'Numbering note (2026-09-18' `= 1), and it is in the same section — the pointer resolves by name, not position. |
| B2 | `OPEN.md:382` — "anything else that is not a row ends a markdown table" is false | ✅ **fixed, and the replacement is verified in all three halves** | See the probe table below. |
| B3 | `engineering-team/CHANGELOG.md:91` — "22 blank lines" | ✅ **fixed** | Cell now reads "the **21** blank lines". `git grep "22 blank"` over the tree: no hits. (The count claim never appeared in `OPEN.md` — see non-blocking 3.) |
| NB1 | The `235e9e16` attribution | ✅ **fixed in both files, and the replacement is right about *which commit*** — but `OPEN.md`'s version introduces a new false clause about *what that commit did*. See **blocking finding 4**. | Census re-run over all **320** commits touching `OPEN.md` reachable from `c5a92115`, ordered by author timestamp: `8786f131` is the earliest with more than one chunk, and no commit at or before its timestamp has more than one. `235e9e16` = 2026-07-15 21:24:29 -0400 (1 chunk); `8786f131` = 21:57:00 -0400 (2 chunks); delta **32 m 31 s**, so "33 minutes" is right to the nearest minute. |
| NB2 | `epics/ledger-row-identity.md:56` | unchanged, as recommended | Retired epic; record of its day. |
| NB3 | The unclaimed second rendering defect | not adopted | Optional; no longer relevant to the verdict. |
| NB4 | No recurrence guard | unchanged | Proposed row stands, with one refinement — see below. |

## The markdown probe B2 asked for

`POST /markdown` (GitHub's own renderer), one table row followed by the construct under test, then
another row. All three halves of the new sentence hold:

| Construct after a table row | Result | Sentence's claim | Verdict |
|---|---|---|---|
| `## A heading` | `</table>` → `<h2>` → `<p>\| 2 \| b \|</p>` — table ends, the next row is raw text | "so does a heading" | ✅ |
| `> a blockquote line` | `</table>` → `<blockquote><p>a blockquote line\| 2 \| b \|</p></blockquote>` — table ends **and** the next row is lazily swallowed into the quote | "so does a blockquote" | ✅ |
| `plain prose line` | `<tr><td>plain prose line</td><td></td></tr>` then `<tr><td>2</td>…` — table continues | "a line of plain prose does not — GitHub absorbs it as a one-cell row" | ✅ |

The blockquote row is the mechanism behind round 1's claim 4c (three old notes had swallowed 142
rows). The sentence as rewritten is accurate and now also carries the information a future session
needs.

## The two corrections to my diagnoses

**Item 1 — accepted; the correction is right and my round-1 prose was wrong.**
Measured at `2e500d6f`: the **citing** note (2026-07-22, relationship-primitives) sat at line
**113**, directly after row 73 — the rows it reserves. The note at line **381** was the **2026-09-18**
stranded-close note, and row 317 was at line **383**. So the 2026-07-22 note's *own* position carried
no information (it named rows 72–73 explicitly); what broke was its **cross-reference to another
note by that other note's position**. Round 1's finding B1 and claims-table row 3e both wrote "that
note sat at line 381 … It now sits at line 412", which binds grammatically to the 2026-07-22 note I
had just named. The numbers 381 → 412 are correct **for the 2026-09-18 note**, i.e. for the note
being pointed *at*; as written they read as a claim about the citing note, and that claim would be
false. The defect and the fix were right; my account of the mechanism was not. Correction accepted.

**Item 4 — accepted in both its parts; my own claim also stands; and the shipped sentence is a third
thing that is wrong.** The file at `235e9e16` (66 lines) ends:

```
64  | 36 | bug | Profile-tag reads resolve tags by fragile event-id …
65  (blank)
66  > **Merge note (2026-07-15, `feat/tags` ↔ `staging` integration):** …     ← last line
```

`8786f131` adds **two** lines between 65 and 66 — `| 37 | meta | …` and a blank — giving
`64 row / 65 blank / 66 row37 / 67 blank / 68 note`, chunks `[27-64] [66-66]`.

- Your (a), "at `235e9e16` the file's last line is not blank": **true.** I wrote "the table's
  pre-existing trailing blank", meaning line 65, which terminated the table; I did not claim the
  *file* ended blank, but the phrasing invites that reading and the check was worth making.
- Your (b), "`8786f131`'s diff adds a row **and** a blank line": **true**, and I omitted the second
  added line.
- My claim, "the blank line was not inserted — it is context, and the new row was appended below
  it": **also true**, and it is the load-bearing part. The blank that splits the table is line 65,
  which pre-existed; the blank `8786f131` added is line 67, which sits *after* the new row and
  splits nothing. Neither of our summaries was complete.

## Findings

### Blocking

**4. `OPEN.md:382` — "it appended a row below a note" is false; the row went *above* the only note
in the file.** You flagged this sentence as blocking if wrong, so: it is wrong.

At `8786f131`'s parent, `grep -n '^>' ` over `OPEN.md` returns exactly **one** line — the 2026-07-15
merge note, at line 66, the file's last line. There was no note above the table at all. `8786f131`
inserted row 37 at line 66, i.e. **below the pre-existing blank line at 65 and above that note**,
pushing the note to 68. What made the table split is that a row acquired a blank line above it —
not that a row was placed below a note.
**Ask:** replace the clause with what the diff shows, e.g. *"it added a row under the blank line
that already separated the table from that day's merge note — the blank was there, the row below it
was new."* The `CHANGELOG.md:91` version of the same sentence does **not** carry this clause
(`git grep "below a note"` hits `OPEN.md:382` only) and needs no change.

### Non-blocking

**5. `OPEN.md:382` and `CHANGELOG.md:91` — "two pointers … each named a position rather than a row"
is loose for one of the two.** The 2026-09-20 pointer named a position instead of a row (✅). The
2026-07-22 pointer *did* name a row — 317 — and used it as a coordinate for locating a **note**; it
named a position instead of a *note*. The following sentence, "Otherwise each note names the rows it
is about", also reads as if the two reworded notes don't, when both do (72–73 and 329). Optional:
"…because each located something by where it sat rather than by its name."

**6. Your round-2 message says the count went "22 → 21 in the CHANGELOG row **and in the intro's
arithmetic**".** Only the CHANGELOG carried the figure: `git show 187df161:OPEN.md` has no
blank-line count anywhere in the notes section (the only "22"s there are inside 2026-07-22 dates),
and the word-level diff of line 382 shows the intro's numeric change was `Fifteen`/`the last one's
pointer` → `Fourteen`/`Two pointers`. No artifact defect — a description of the edit, not the edit.

## Re-run at `c5a92115` (everything the second commit could have disturbed)

| Check | Result |
|---|---|
| All 352 `^\|` lines vs `2e500d6f` | `cmp` clean, same order, md5 `9c1bcaacd72a5d1ba95fded37f0d1283` — unchanged from round 1 |
| Table contiguity | one chunk, lines 32–375 |
| Freeze marker / highest id / row 329 | `highest-number=343`; max id 343; exactly one row 329 |
| 16 notes, order, byte-identity vs `2e500d6f` | 16 notes, header sequence `cmp`-clean, **14 of 16** byte-identical (notes 3 and 16 differ) — matches "Fourteen are unchanged. Two pointers were reworded" |
| Positional language left in any note | one hit: note 15's "the slots reserved for them above" — still true (rows 72–73 at lines 105–106 and the reserving note at 388 are both above it at 412), and it names its rows. No broken pointer remains. |
| GitHub render of the pushed head | 2 tables, **350** `<tr>`, 2406 `<td>` (342 rows × exactly 7, + preamble 12), `<td>38</td>` / `<td>343</td>` / `<td>317</td>` present, 16 `<blockquote>`, freeze marker renders as nothing |
| `bash scripts/harness-lint.sh` | exit 0, `harness-lint: clean (0 violations)` |
| `scripts/whats-open.sh`, `session-start.sh`, `collect-meta.sh` — worktrees at `2e500d6f` vs `c5a92115` | all three byte-identical; `count=122 oldest=80`; 243 open table rows |
| Six suites, Node 22.23.2, at `c5a92115` | `ledger-row-ids` 6/0 · `harness-lint` 63/0 · `session-start` 32/0 · `operational-direction` 86/0 · `curated-dlist-update-update-preview` 34/0 · `curated-dlist-update-publish` 69/0 |
| `npm test` (full gate) | still not run — same reasoning as round 1; the second commit adds no executable line |

I re-ran the three table-reading suites despite the second commit touching no `|` line: they read the
whole file, not only its rows, and the cost was small. All three are green.

## Proposed ledger row — refined by what round 2 established

`2026-09-20-nothing-guards-table-contiguity` (type `meta`) still stands, and the second commit
**sharpens** it. Add this to the body: the 67-day break (2026-07-15 → 2026-09-20) was **not** caused
by anyone adding a blank line to the table. The table-terminating blank at line 65 was already
there, legitimately, separating the table from that day's merge note; the break appeared the moment
a row was appended *under* it. So a rule phrased as "don't put blank lines in the table" would not
have prevented this, and a human reviewing that two-line diff would have seen a row added at the end
of the table and been right to wave it through. Only a check that the lines between the `| # |`
header and the freeze marker are *all* rows catches it — which is why the proposal is a lint check
and not a convention.

---

# Round 3 — commit `4328e0ab`

**Date:** 2026-09-20
**Diff:** `git diff c5a92115..4328e0ab` — `OPEN.md:382` and `engineering-team/CHANGELOG.md:91`,
one line each, 2 insertions / 2 deletions. Head at review time: local `4328e0ab` ==
`gh api …/git/ref/heads/docs/open-md-one-table` (`4328e0abe054205d27dbca8eb20bbae264617841`).
Branch is four commits from `origin/staging`: `187df161` (the change), `c5a92115` (round-1 fixes),
`4328e0ab` (round-2 fix). Re-derived as fresh claims, including the parts that echo my own round-2
wording — I did not adopt the sentence I suggested, and neither did the Implementer, which is the
right outcome twice over.

## Claim 1 — `OPEN.md:382`, the mechanism sentence

> The table first split on 2026-07-15, in `8786f131`, the first commit whose table is in more than
> one chunk — and nobody added a stray blank line to do it: the blank was already there, separating
> the table from that day's merge note, and the new row went in below it.

| Sub-claim | Verified | Evidence |
|---|---|---|
| "first split on 2026-07-15" | ✅ | `8786f131` author date 2026-07-15 21:57:00 -0400. |
| "the first commit whose table is in more than one chunk" | ✅ | Census re-run at the new head: **321** commits touch `OPEN.md` reachable from `4328e0ab`; sorted by author timestamp, `8786f131` is the earliest with more than one chunk, and it is the **only** multi-chunk commit at or before its own timestamp. |
| "the blank was already there" | ✅ | At `235e9e16`: 66 lines, line 64 = row 36, line 65 = blank, line 66 = the merge note. In `8786f131`'s diff the blank at 65 is an **unprefixed context line** — it is not added. |
| "separating the table from that day's merge note" | ✅ | `grep -c '^>'` on `235e9e16:OPEN.md` = **1**, and it is that merge note (2026-07-15 `feat/tags` ↔ `staging` integration), at line 66, the file's last line. Same day as `8786f131`. |
| "the new row went in below it" | ✅ | At `8786f131`: 65 blank, **66 = `\| 37 \| meta \| …`**, 67 blank, 68 the note. The row is below the pre-existing blank and above the note — the inverse of the round-2 sentence, and correct. |
| "nobody added a stray blank line to do it" | ✅ as written | `8786f131` does add a blank — at line 67, *after* the new row, as the separator before the note. It is not the blank that splits the table; the splitting blank is the pre-existing 65. The claim is scoped by "to do it", i.e. to causation, and as a causal claim it is exactly right. |

## Claim 2 — the pointer wording, both files

> …because each **located something by where it sat rather than by its name**: the 2026-09-20 note
> said "the row directly below", and the 2026-07-22 note **reached another note as** "the numbering
> note above row 317".

Accurate for both halves now, which the round-2 phrasing was not: the 2026-09-20 pointer located a
**row** by position instead of by its number; the 2026-07-22 pointer located a **note** by position
instead of by its date — and "reached another note as" says which of the two it was. Both quoted
strings are substrings of the pre-move originals. `CHANGELOG.md:91` carries the same phrase and
pairs each quote with its replacement, which is unambiguous without the extra clause. My round-2
non-blocking 5 is closed; the following sentence ("Otherwise each note names the rows it is about")
now reads correctly against it.

## Re-run at `4328e0ab`

| Check | Result |
|---|---|
| 352 `^\|` lines vs `2e500d6f` | `cmp` clean, same order, md5 `9c1bcaacd72a5d1ba95fded37f0d1283` |
| Contiguity / marker / ids | one chunk, lines 32–375; `highest-number=343`; 342 rows, highest id 343 |
| 16 notes vs `2e500d6f` | order `cmp`-clean, **14 of 16** byte-identical (3 and 16) — the split the intro claims |
| 16 notes vs `c5a92115` | all 16 byte-identical — **no note body was touched this round** |
| Headings | identical to `c5a92115` |
| Files touched since `2e500d6f` | still exactly four: `OPEN.md`, `engineering-team/CHANGELOG.md`, `scripts/harness-lint.sh`, `test/helpers/ledgerFixtures.js` — no `\|` line, no code |
| `bash scripts/harness-lint.sh` | exit 0, `harness-lint: clean (0 violations)` |
| GitHub render of the pushed head | 2 tables, **350** `<tr>`, 2406 `<td>` (342 rows × exactly 7, + 12), `<td>38</td>` and `<td>343</td>` present, 16 `<blockquote>`, freeze marker renders as nothing |
| `whats-open.sh` / `session-start.sh` / `collect-meta.sh`, worktrees `2e500d6f` vs `4328e0ab` | all three byte-identical; `count=122 oldest=80`; 243 open table rows |
| Six suites, Node 22.23.2 | `ledger-row-ids` 6/0 · `harness-lint` 63/0 · `session-start` 32/0 · `operational-direction` 86/0 · `curated-dlist-update-update-preview` 34/0 · `curated-dlist-update-publish` 69/0 |
| `npm test` (full gate) | not run — unchanged reasoning (round 1, "Not verified" 1). Four files, zero executable lines across the whole branch; CI's stack-free job on the PR remains the outstanding gate. |

I re-ran the three table-reading suites again despite your expectation that they were unnecessary.
You were right — they were. They read the whole file rather than only its rows, so the cheap check
beats the inference, and it is the last thing standing between this and a PASS.

## Findings

### Blocking

None.

### Non-blocking

**7. `OPEN.md:382` compresses "no *stray* blank line was added" out of a diff that did add a blank
line** (at 67, after the new row). The sentence is right because "to do it" scopes it to the split,
and the surrounding clause makes the mechanism explicit — **no change asked**. Recorded only because
this is the third round in which this two-line diff has been described slightly wrong by someone,
and a future reader reconstructing it from the sentence alone would guess one added line, not two.

## Close-out

- **Story status:** none to flip. Doc lane, no story file and no book manifest
  (`engineering-team/stories/` and `engineering-team/audits/` have no `open-md-one-table` entry), so
  the per-story `**Status:** Done` step and completion detection do not apply.
- **Proposed ledger row** `2026-09-20-nothing-guards-table-contiguity` stands as written in round 2,
  with the round-2 sharpening. `4328e0ab`'s own message reaches the same conclusion independently,
  which is worth carrying to the operator: the rule this incident argues for is a check, not a
  convention, because the diff that broke the table added a row at the end of a table and a blank
  line after it — a shape a convention would permit and a human reviewer would pass.
- **Remaining gate:** CI's stack-free job on the PR into `staging`. Nothing in this branch touches
  runtime code, and the host gate's red baseline (OPEN.md row 289) is unrelated to it.

---

## Verdict

**PASS**
