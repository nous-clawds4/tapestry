# Test Plan: Story 1 — Ledger row ids that cannot collide

**Story:** `engineering-team/stories/ledger-row-identity/1-collision-free-ledger-row-ids.md`
**ADR:** `engineering-team/decisions/ledger-row-identity/0001-date-slug-ids-and-row-files.md`
**Date:** 2026-09-20

## Coverage map

Three suites, split by what is under test. Every test drives a real script from outside
(`scripts/harness-lint.sh`, `scripts/session-start.sh`, `scripts/whats-open.sh`) or reads a real
file. "Red" means the test fails on the tree as it stands; a "guard" passes before and after, and
exists to stop the new code going wrong in a way the red tests would not notice.

| Criterion | Test name (shortened) | Test file | Before the change |
|---|---|---|---|
| AC-1, AC-2 | two checkouts that share a base and exchange nothing each mint a row for a different finding: the ids differ, merging in either order leaves nothing to resolve, and the merged ledger lints clean and counts both rows | `test/ledger-row-ids.test.js` | red |
| AC-2 | two checkouts that mint the SAME id for different findings cannot merge silently: git stops with an add/add conflict on `ledger/<id>.md` | `test/ledger-row-ids.test.js` | red until the template exists, then a guard (it tests git, on purpose: see below) |
| AC-3 | the real `OPEN.md` table is frozen where it stands: one freeze marker, and its number is the highest id in the table | `test/ledger-row-ids.test.js` | red |
| AC-3 | the three gate suites that read rows 41 and 314 and rows by content out of the real table pass **unmodified** | `test/operational-direction.test.js`, `test/curated-dlist-update-*.test.js` | green, and must stay so |
| AC-3 | id → row map of the table, before and after | manual, below | — |
| AC-4 | L15(a): an id that appears more than once in the table is a violation that names the id — every such id | `test/harness-lint.test.js` | red |
| AC-4 | L15(a) needs no freeze marker | `test/harness-lint.test.js` | red |
| AC-4 | L15 exists and the real repo is L15-silent with zero waivers | `test/harness-lint.test.js` | red |
| AC-4 | the real repo lints clean (existing test, unmodified) | `test/harness-lint.test.js` | green; it turns red the moment L15 exists, and stays red until ADR step 1 settles row 329 |
| AC-4 (ADR step 8b) | L15(b): a numbered row above the frozen maximum is a violation whose message says where a new row goes — added as the last row of the table, and added at the end of the file below the marker | `test/harness-lint.test.js` | red ×2 |
| AC-4 (ADR step 8b) | L15(b): a date+slug id inside the frozen table is a violation | `test/harness-lint.test.js` | red |
| AC-4 (ADR step 8b) | L15(b) reports INFO and skips when `OPEN.md` has no freeze marker | `test/harness-lint.test.js` | red |
| AC-4 (ADR step 8c) | L15(c): a row file with … is a violation that names the file — thirteen variants, listed under Edge cases | `test/harness-lint.test.js` | red ×13 |
| AC-4 | L15 waiver: routes through the standard waiver machinery | `test/harness-lint.test.js` | red |
| AC-4 | L15: a ledger shaped like the real one is clean | `test/harness-lint.test.js` | guard |
| AC-5 | an open meta row that is a file counts: alone and >30d old, it fires the banner with its real age | `test/session-start.test.js` | red |
| AC-5 | `/whats-open` shows an open file row where it shows a table row: one summary line in the ledger section that points at the file, and under "Meta items" with its age | `test/session-start.test.js` | red |
| AC-5 | a DONE file row is never counted or listed — also when a note follows the word DONE — while the open row beside it is | `test/session-start.test.js` | red |
| AC-5 (ADR step 5) | the first word of a row file's Type and Status is what counts | `test/session-start.test.js` | red |
| AC-5 | an open file row of another type is listed in the ledger section and is not a harness lesson | `test/session-start.test.js` | red |
| AC-5 | table rows and file rows are one inbox: two young table lessons and one young file lesson fire the count trigger together | `test/session-start.test.js` | red |
| AC-5 (ADR step 6) | the ledger section says "(no OPEN rows in the ledger)" only when the table and `ledger/` are both without an open row | `test/session-start.test.js` | red |
| AC-5 (ADR step 5) | `ledger_file_rows` prints one tab-separated line per row file, and nothing, with exit 0, where there is no `ledger/` directory | `test/session-start.test.js` | red |
| AC-5 | an empty `ledger/` directory reads as no directory at all | `test/session-start.test.js` | guard |
| AC-5 | on this repo's real ledger the meta list holds exactly the open meta rows that are files | `test/session-start.test.js` | guard; empty-handed until the first row file exists, which is ADR step 1 |
| AC-5 | every test that was in `test/session-start.test.js` before this story passes **unmodified** (a tree with no `ledger/` reads exactly as before) | `test/session-start.test.js` | green, and must stay so |
| AC-5 | `/whats-open`, the digest and the meta count on the real tree, before and after | manual, below | — |
| AC-6 | `OPEN.md` § "How to use this ledger" says how to mint an id and how to cite one | `test/ledger-row-ids.test.js` | red |
| AC-6 (ADR step 4) | the row template exists and carries the fielded header the readers and L15 look for | `test/ledger-row-ids.test.js` | red |
| AC-6 | the interim "allocate the next number off origin" guidance is retired where it was taught, and the instruction to push stays | `test/ledger-row-ids.test.js` | red |
| AC-6 | rows 151, 207 and 307 DONE; the 2026-07-28 intake entry marked | review | — |
| ADR step 9 | the six writing product agents carry allow-list-only Write/Edit scoping (product-team + `OPEN.md` + `ledger/`) — the existing test, with two rules added | `test/session-start.test.js` | red |

Notes on that table.

**The merge test mints the way the rule says to.** Its `mint()` takes the date from `date -u +%F`,
adds a slug, copies `engineering-team/templates/open-row.md` and fills in the header lines. So it
fails if the template, L15(c) and the reader ever stop agreeing about what a row file looks like.
The two checkouts are real clones of one base repository under the OS temp directory. After the
clone neither reads the other until the merge, and minting touches no remote, which is what "with
the network unavailable" comes to. Each side merges the other's commit, so both orders are true
merges of divergent histories, and the test ends by comparing the two merged trees.

**The same-id test is a test of git, deliberately.** AC-2 promises that no id appears twice. For
row files that promise is kept by the filesystem and by git's add/add conflict, not by our code,
and the ADR leans on it ("loud, at merge time, enforced by git rather than by a convention"). The
test pins that the conflict lands on `ledger/<id>.md`. It is red today only because `mint()` needs
the template.

**`the real repo lints clean` is the AC-4 test for "as the change leaves it".** It is not new and
not edited. It goes red in the middle of Implementation (when L15 exists and row 329 still appears
twice) and green again after ADR step 1. That is the order the ADR lands in.

**The exact summary line is pinned.** ADR step 6 gives the ledger-section line for a file row
character for character, and step 7 gives the "Meta items" line, so the tests compare whole lines.
Ages are matched as digits, never as a number: a row dated three UTC days ago reads `2d` on this
machine, because `date_to_epoch` works in local time.

## Edge cases

- [x] L15 on the real file's shape (`test/helpers/ledgerFixtures.js`): a second table in the
      preamble with its own `|---|` line, blank lines and `> **Numbering note**` blockquotes
      between chunks of rows, ids out of order, a gap, a row whose Item quotes another row's id
      cell (`` `| 7 | meta | …` ``) and a regex with a pipe, an escaped pipe. A reader that takes
      every `|` line for a row reports `---` as a duplicate and "Kind of open work" as a row above
      the freeze; a reader that looks past the first cell reports row 7 twice.
- [x] A duplicated id with three copies, and two different duplicated ids in one ledger.
- [x] An old-rule row in both places a session would put it: after the last row, and at the very
      end of the file (below the marker).
- [x] A new-style id in the old home (a date+slug id as a table line).
- [x] Row files, L15(c) — filename: not an id at all; a bare number (`344.md`, the old rule in the
      new home); capitals in the slug; a slug of one word; a slug of seven words; an id of 65
      characters. Header: `**Id:**` naming another row; no `**Id:**`; no `**Type:**`; no
      `**Opened:**`; `**Opened:**` with no ISO date; no `**Status:**`; a Status of `WIP`. In the
      filename cases the `**Id:**` field equals the filename, so only the filename rule can fire.
- [x] **The 64-character cap, a judgment call for the gate.** ADR step 8(c) asks lint for "the
      filename matches the id pattern", and the regular expression has no length in it. The rule
      the pattern belongs to says "Whole id at most 64 characters" in the same bullet, and an id
      can never be changed once cited, so a cap nothing enforces is a cap that will be broken for
      good. These tests read the cap as part of the pattern: an id of exactly 64 characters is
      clean (in the real-shape guard), and one of 65 is a violation. Strike the two cases if the
      cap is meant as advice.
- [x] A closed row whose Status carries a note, `DONE (2026-09-03, PR #1)`: valid for L15(c), and
      not counted by the reader.
- [x] Decorated header fields in an open row: `meta (harness lesson)`, `OPEN — waiting on the
      operator`, `2020-01-01 (session close; seen again 2020-02-02)` — the first date wins.
- [x] A `ledger/` directory with no row in it.
- [ ] Not covered: whether a date in an id is a real calendar day (`2026-13-45-…` matches the
      pattern). The ADR asks for the pattern, and nothing in the rule says more.
- [ ] Not covered: the order of file rows in the two lists. The ADR does not give one. Shell glob
      order is by id, which is by date, and the manual comparison below would show a change.
- [ ] Not covered: a row file with a `|` in its title. The summary line would carry it into a
      pipe-delimited line; no reader parses that line back.
- [ ] Not covered: sub-folders under `ledger/` (out of scope in the ADR), and files there that are
      not `*.md`.
- [ ] Not covered by a test: the wording of `CLAUDE.md`:70 and `product-team/README.md`:34 and :86
      (ADR step 9), the `OPEN.md` header-table cell (step 3), and the CHANGELOG row (step 11). The
      Reviewer reads them; L10 and L11 gate two of them already.

## Test infrastructure

- Test framework: Node built-in runner (`node test/test.js`, suite registry `test/registry.js`).
  `test/ledger-row-ids.test.js` is new and registered in this commit (one line, after
  `session-start.test.js`). A run's result is read per
  [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- Concept Graph API: not used. Every test here runs without the stack, and none is a live test, so
  none skips when the stack is absent.
- Firmware state: none.
- Needs on PATH: `bash`, `git`, `awk`, `grep`, `date` — what these suites already needed.
- Fixtures: `test/helpers/ledgerFixtures.js` (new) — `rowFile(id, overrides)` writes a row file in
  the ADR's shape (`null` leaves a field out), `tableRow()` one table line, `ledgerDoc(rows,
  { frozenAt })` an `OPEN.md` shaped like the real one, `REAL_SHAPE_ROWS` the nine-line table the
  L15 tests share. In `test/session-start.test.js`: `ledgerFixture(rows, files)` (the existing
  `metaFixture` plus row files), `ledgerSection(out)`, `listedFileIds(lines)`, `summaryLine(…)`.
  The existing helpers `rollup`, `metaItems`, `listedIds` and `metaLine` are reused unchanged.
- Node version: the three suites give the same result on Node 22 and on Node 16 (no `fetch`).
  Both were run.

## How to run

The whole gate:

```
npm test
```

One suite (never `node test/<suite>.test.js`: these files have no `require.main` block, so that
runs nothing and exits 0 — `OPEN.md` row 310):

```
node -e "require('./test/ledger-row-ids.test.js').run().then(r => { console.log(r); process.exit(r.fail ? 1 : 0); })"
node -e "require('./test/harness-lint.test.js').run().then(r => { console.log(r); process.exit(r.fail ? 1 : 0); })"
node -e "require('./test/session-start.test.js').run().then(r => { console.log(r); process.exit(r.fail ? 1 : 0); })"
```

About 5 s, 80 s and 60 s. Most of the last two is `harness-lint` running on the real tree and
on some sixty fixture trees.

## Manual verification (Implementer runs it; Reviewer repeats it)

Both comparisons need the tree as it was, so neither can be a test. Take "before" from a detached
worktree of the merge base, and run both sides within the same minute so that ages agree.

```
S=<scratchpad>; BASE=$(git merge-base origin/staging HEAD)
git worktree add --detach "$S/before" "$BASE"
```

**AC-3 — every number still finds its row.** The map is id → the whole table line, which is
stricter than "Item text" and needs no cell parsing, so the nine rows with a pipe in a cell cannot
be misread:

```
map() { grep -E '^\|' "$1" | awk -F'|' '{ id=$2; gsub(/^[ \t]+|[ \t]+$/, "", id); if (id ~ /^[0-9]+$/) print id "\t" $0 }' | LC_ALL=C sort; }
diff <(map "$S/before/OPEN.md") <(map OPEN.md)
```

Expected at the end of Implementation: one line removed, the second row 329 (the one that landed
later — ADR step 1), and nothing else. Expected after the Review commit: the same, plus rows 151,
207 and 307 changed; for those three, check that the change starts after the Opened cell
(`cut -d'|' -f1-5` of the old and new line are equal — none of the three has a pipe in a cell).
Then `git diff --stat "$BASE"` lists the files the change touched. Apart from what ADR step 1
sweeps by the moved row's text, no line that cites a row may appear in `git diff "$BASE"`.

**AC-5 — the read surfaces, before and after.** Run before rows 151, 207 and 307 are flipped (the
flip takes three open meta rows out of every list, and would bury the comparison). Compare bytes:
one "Meta items" line (row 193) is not valid UTF-8 until `OPEN.md` row 290's second half lands.

```
section() { awk -v t="$1" '/^──────── /{ on = index($0, t) > 0 } on' "$2"; }
( cd "$S/before" && bash scripts/whats-open.sh ) > "$S/wo-before.txt" 2>&1
bash scripts/whats-open.sh > "$S/wo-after.txt" 2>&1
for t in "OPEN.md ledger" "Meta items"; do
  diff -a <(section "$t" "$S/wo-before.txt") <(section "$t" "$S/wo-after.txt")
done
diff -a <(grep -a 'META ESCALATION' "$S/wo-before.txt") <(grep -a 'META ESCALATION' "$S/wo-after.txt")
diff -a <(cd "$S/before" && bash scripts/session-start.sh | grep -aE 'META ESCALATION|meta inbox') \
        <(bash scripts/session-start.sh | grep -aE 'META ESCALATION|meta inbox')
```

Expected: in each of the two sections, the moved row's table line goes and its file-row line
comes (`| <id> | meta | **<title>** → ledger/<id>.md | 2026-09-19 | OPEN | | |` in the ledger
section, after the table's rows; `[<age>d] <id> — <title>` under "Meta items", after the table's
rows and before the intake entries), with the same age. Nothing else in either section. The banner
and the digest line are identical: same count, same oldest. Baseline taken on the untouched tree,
2026-09-20T01:08Z, `origin/staging` `17e8c9c0`: `count=119 oldest=79`, 248 open rows in the ledger
section and 119 lines under "Meta items" (all of them table rows). The `section` helper above was
run on that output.

Remove the worktree afterwards: `git worktree remove "$S/before"`.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-20 on top of `17e8c9c0`
(`origin/staging`; no script touched), Node v22.23.2 and again on Node v16.17.0 — same result:

| Suite | Pass | Fail | The passes |
|---|---|---|---|
| `ledger-row-ids` | 0 | 6 | — |
| `harness-lint` | 42 | 21 | the 41 tests that existed, and the real-shape guard |
| `session-start` | 23 | 9 | the 21 tests that existed, and the two guards |

```
ledger-row-ids
  ✗ two checkouts that share a base and exchange nothing each mint a row … (AC-1, AC-2)
      engineering-team/templates/open-row.md does not exist — the documented way to mint a row is to copy it
  ✗ two checkouts that mint the SAME id for different findings cannot merge silently: …
      engineering-team/templates/open-row.md does not exist — the documented way to mint a row is to copy it
  ✗ the real OPEN.md table is frozen where it stands: … (AC-3; ADR 0001 step 2)
      found 0 freeze marker(s) in OPEN.md — want exactly one line "<!-- ledger-table-frozen: highest-number=<N> -->"
  ✗ OPEN.md § "How to use this ledger" says how to mint an id and how to cite one (AC-6)
      the section does not give the shape of an id, `YYYY-MM-DD-<slug>`
  ✗ the row template exists and carries the fielded header the readers and L15 look for (ADR 0001 step 4)
      engineering-team/templates/open-row.md does not exist
  ✗ the interim "allocate the next number off origin" guidance is retired where it was taught, …
      engineering-team/workflows/6-book-close.md still teaches that OPEN.md row numbers are allocated off origin — …

harness-lint (the 21 red L15 tests; one of each kind shown)
  ✗ L15(a): an id that appears more than once in the table is a violation that names the id — every such id (AC-4)
      got exit 0: (no L15 line in the output) — two rows are numbered 4242 and three are numbered 5150; …
  ✗ L15(b): a numbered row above the frozen maximum, added as the last row of the table, is a violation …
      got exit 0: (no L15 line in the output) — row 10 was added to a table frozen at 9
  ✗ L15(b) reports INFO and skips when OPEN.md has no freeze marker, the way L10 and L11 degrade
      got: (no L15 line in the output)
  ✗ L15(c): a row file with a slug of one word is a violation that names the file
      got exit 0: (no L15 line in the output) — ledger/2026-09-01-oops.md has a slug of one word
  ✗ L15 waiver: routes through the standard waiver machinery
      got: STALE-WAIVER L15 ledger/2026-09-01-oops.md (OPEN.md row 99 (test)) — matches nothing; remove or update
  ✗ L15 exists and the real repo is L15-silent with zero waivers: … (AC-4)
      check_L15 must exist in scripts/harness-lint.sh

session-start
  ✗ an open meta row that is a file counts: alone and >30d old, it fires the banner with its real age (AC-5)
      got "meta inbox: 0 open (clear)" — the only open lesson here is a file, ledger/2020-01-01-ancient-file-lesson.md; …
  ✗ /whats-open shows an open file row where it shows a table row: … (AC-5)
      the ledger section must hold the line "| 2020-01-01-ancient-file-lesson | meta | **Agent worktrees outlive their books** → ledger/2020-01-01-ancient-file-lesson.md | 2020-01-01 | OPEN | | |"; got: ["| 1 | meta | a table lesson | 2026-06-01 | OPEN | | |"]
  ✗ a DONE file row is never counted or listed — … — while the open row beside it is (AC-5)
      got "meta inbox: 0 open (clear)" — one file row is open and two days old; …
  ✗ the first word of a row file's Type and Status is what counts: … (ADR 0001 step 5)
      got "meta inbox: 0 open (clear)"
  ✗ an open file row of another type is listed in the ledger section and is not a harness lesson (AC-5)
      the ledger section must hold "| 2020-01-01-prune-stale-branches | cleanup | **Prune the stale branches** → …"; got: ["(no OPEN rows in the ledger)"]
  ✗ table rows and file rows are one inbox: … fire the count trigger together (AC-5)
      got "meta inbox: 2 open, oldest 2d" — no row is a month old, so only the count can fire, and it takes all three
  ✗ the ledger section says "(no OPEN rows in the ledger)" only when the table and ledger/ are both without an open row
      an open file row is an open row: list it, and do not say there is none; got: ["(no OPEN rows in the ledger)"]
  ✗ ledger_file_rows prints one tab-separated line per row file — … (ADR 0001 step 5)
      exit 127: _: …/scripts/lib/collect-ledger.sh: No such file or directory
  ✗ the six writing product agents carry allow-list-only Write/Edit scoping (product-team + the ledger's two homes, …)
      product-strategist: missing allow rule Write(./ledger/**)
```

Each failure is the missing feature, not a typo or an import error: all three suites load, every
test that existed before passes, and each red test reports the state the story describes. The two
merge tests stop at the missing template. To see past that, they were also run once against a
throwaway six-line template (deleted again, never committed): the same-id test passed, and the
both-ways test ran through both merges, the clean status, the directory listing and the lint, and
failed where it should — the digest did not count the two minted rows.
