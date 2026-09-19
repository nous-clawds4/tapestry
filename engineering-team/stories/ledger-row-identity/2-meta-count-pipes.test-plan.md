# Test Plan: Story 2 — Count the open meta rows whose text contains a pipe

**Story:** `engineering-team/stories/ledger-row-identity/2-meta-count-pipes.md`
**ADR:** none — Architecture skipped as obvious (Bug lane). The fix shape is recorded in `OPEN.md`
row 290; the collector's spec is ADR
`engineering-team/decisions/harness-self-improvement/0004-meta-escalation.md` § Implementation notes.
**Date:** 2026-09-19

## Coverage map

All tests are in `test/session-start.test.js`, the one suite that exercises the meta reader. Every
test drives a real script from outside: the digest (`scripts/session-start.sh`) or the roll-up
(`scripts/whats-open.sh`) in a throwaway git repo whose `OPEN.md` holds the rows under test. "Red"
means the test fails on the unfixed reader; a "guard" passes before and after, and exists to stop a
by-value reader from going wrong in a new way.

| Criterion | Test name (shortened) | Level | Before the fix |
|---|---|---|---|
| AC-1 | an open meta row with a pipe **inside a code span** still counts: alone and >30d old, it fires the banner with its real age | script, fixture | red |
| AC-1 | …with a pipe **escaped with a backslash**… | script, fixture | red |
| AC-1 | …with a pipe **three times in one cell**… | script, fixture | red |
| AC-1 | a date inside the Item text is not the row's Opened date: a piped row opened 2 days ago stays quiet | script, fixture | red |
| AC-2 | `/whats-open` lists a piped open meta row under "Meta items" with its age, and its banner agrees with the digest | script, fixture | red |
| AC-3 | a DONE meta row is never counted or listed, even when pipes in its Item put a mention of `OPEN.md` where the Status used to be read | script, fixture | red |
| AC-3 | a DONE meta row stays closed when a later cell holds a fragment that is exactly OPEN: the first status cell is the row's Status | script, fixture | guard (fixture strengthened after the review, finding 5: it now reads 1 open under a reader that takes the last status cell) |
| AC-3 | an open row of another type is not a meta row, whatever its Item says | script, fixture | guard |
| — (story § Deviations) | an open meta row whose Item begins with the word DONE is still open: the Item cell is never read as a Status | script, fixture | guard, added at Implementation; on the old reader it is red for the pipe in its second row |
| AC-4 | a malformed DONE row (a second row's tail fused on, as in row 157) is not counted and does not stop the reader: the open rows after it are all counted and listed | script, fixture | red |
| AC-5 | on this repo's real ledger the meta list holds exactly the meta rows that have an OPEN cell: none dropped, none extra | real tree | red |
| AC-5 | the three existing meta tests (age trigger, count trigger, quiet inbox) pass **unmodified** | script, fixture | green, and must stay so |
| AC-5 | before/after comparison on the real tree | manual, below | — |
| AC-6 | row 290 narrowed, still OPEN | review | — |

Two notes on that table.

**AC-4 cannot be red by itself.** The old reader never counted row 157 either, so the fixture puts a
piped open row *after* the fused row. The old reader lists rows 2 and 4; the fixed one must list 2,
3 and 4. The test therefore proves both halves of the criterion: the fused row is skipped, and
reading continues past it.

**The real-tree test uses an oracle that does not share the reader's logic.** It counts `meta` lines
of `OPEN.md` that have a cell reading `OPEN`, which is the whole-line test the roll-up's own ledger
section uses, and compares the ids with the ids in `META_LINES`. `META_LINES` is the reader's
documented interface (header of `scripts/lib/collect-meta.sh`), and sourcing the library keeps this
test off the network and out of `harness-lint`'s run time. The test stays useful after this story:
it fails whenever the two read surfaces disagree about a meta row, and its message says which rows
and what to do. It names no row numbers, so closing rows 70 and 244 later cannot break it.

## Edge cases

- [x] Escaped pipe, pipe in a code span, several pipes in one cell (AC-1's three variants).
- [x] A piped open row whose Opened cell holds no date: still counted, age unknown. ADR 0004 says
      "still count it". Red before the fix (2 counted, 3 wanted).
- [x] A date in the Item text after the pipe, which lands where Opened used to be read. It would
      catch a half-fix that finds Status by value but still reads Opened by position.
- [x] A cell that is exactly `OPEN` to the right of the real Status (a fused or quoted row): the
      first status cell wins.
- [x] A non-meta row with pipes and the word "meta" in its Item.
- [ ] Not covered, by design. Stated in full after the review (finding 7), each case measured
      against the old reader, the new one and the roll-up's ledger section: **any piece of Item
      text that follows the Item's second or later pipe and reads exactly `OPEN`, or starts with
      `DONE`, is taken for the Status.** A pipe table that carries free text cannot tell such text
      from real cells, and no row does any of this today.
      - An open row read as closed — an Item that says `` `OPEN|DONE|DONE-LOCAL` ``, or one that
        quotes a DONE table row. The old reader dropped these rows too. This is the harmful
        direction, and the standing real-ledger test catches it by id ("dropped").
      - A DONE row read as open — an Item with `` `a|b` `` and then a quoted `` `| OPEN |` `` (the
        old reader counted it as well), or an Item that quotes a whole OPEN table row, such as
        `` `| 9 | meta | x | 2026-06-01 | OPEN | | |` ``. **That last case is the one place where
        the old reader was right and the new one is wrong:** the old reader never looked past the
        sixth field, so it was right by luck. The ledger section lists such a row as open too, so
        the two read surfaces agree and the standing test cannot notice. The effect is an
        over-count that shows in "Meta items" as a row whose own text says DONE.
      - After a single pipe the new reader is safe: `` `a|DONE-LOCAL` `` in an open row reads as
        open (the old reader dropped it). That is what starting the scan at the sixth field buys.
      - Story #1 removes the problem for new rows, which become files.
- [ ] Not covered: the intake "Meta:" source. It is out of scope and unchanged.

## Test infrastructure

- Test framework: Node built-in runner (`node test/test.js`, suite registry `test/registry.js`). The
  suite is already registered. A run's result is read per
  [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- Concept Graph API: not used. Every test here runs without the stack, and none is a live test, so
  none skips when the stack is absent.
- Firmware state: none.
- Needs on PATH: `bash`, `git`, `awk`, `grep` — what the suite already needed.
- Fixtures: `metaFixture(rows)` (existing) writes an `OPEN.md` into a fresh `git init` repo under
  the OS temp directory. New helpers in the test file:
  - `rollup(cwd)` runs `scripts/whats-open.sh` offline. A stub `gh` that exits 1 at once shadows the
    real one on PATH, and the script prints "(gh error)" and carries on. A fixture has no `origin`,
    so the script's `git fetch` fails just as fast. Measured: 0.35 s per run, no network.
  - `metaItems(out)` returns the lines of the roll-up's "Meta items" section.
  - `listedIds(lines)` returns the table-row ids in those lines.
  - `metaLine(out)` returns the one line carrying the meta state. Failure messages lead with it,
    because the runner prints only a failure's first line.
- Node version: the suite gives the same result on Node 16 and on Node 22 (it uses no `fetch`).
  Both were run.

## How to run

The whole gate:

```
npm test
```

This suite alone (about 35 s; nearly all of it is the existing "digest in this repo" test, which
runs `harness-lint` on the real tree):

```
node -e "require('./test/session-start.test.js').run().then(r => { console.log(r); process.exit(r.fail ? 1 : 0); })"
```

## Manual verification for AC-5 (Implementer runs it; Reviewer repeats it)

"Exactly two lines appear" needs both versions of the reader, so no single test run can show it.
On the real tree, with the fix applied but before the row 290 edit (that edit changes row 290's own
line in the list, and would muddy the comparison):

```
T=$(mktemp -d)        # a session with a scratchpad: mktemp -d "<scratchpad>/ac5.XXXXXX"
git show origin/staging:scripts/lib/collect-meta.sh > "$T/collect-meta.sh"
cp scripts/lib/date-epoch.sh "$T/"        # the library sources its sibling by its own path
lines() { bash -c '. "$1"; collect_meta; printf "%s" "$META_LINES"; echo "count=$META_COUNT oldest=$META_MAX_AGE"' _ "$1"; }
diff <(lines "$T/collect-meta.sh") <(lines scripts/lib/collect-meta.sh)
```

Both runs read the working tree's `OPEN.md`, so only the reader differs. Dry-run on 2026-09-19
before the fix: an empty diff, `count=107 oldest=79`, about 1 s.

Expected after the fix: two added lines, `[<age>d] | 70 | meta | …` and `[<age>d] | 244 | meta | …`,
with ages matching 2026-07-21 and 2026-09-10; the summary line changing from `count=107` to
`count=109` with `oldest` unchanged; and nothing else. Then `bash scripts/session-start.sh` shows
the banner with 109.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-19, on top of commit `8e36b40a`
(story commit; the reader untouched), Node v22.23.2 and again on Node v16.17.0 — same result,
12 pass / 9 fail. The 12 passing are the 10 tests that existed before and the 2 guards.

```
  ✗ an open meta row with a pipe inside a code span still counts: … (ledger-row-identity #2 AC-1, OPEN.md row 290)
      got "meta inbox: 0 open (clear)" — the only open lesson here has a pipe in its Item cell; …
  ✗ an open meta row with a pipe escaped with a backslash still counts: …
      got "meta inbox: 0 open (clear)" — …
  ✗ an open meta row with a pipe three times in one cell still counts: …
      got "meta inbox: 0 open (clear)" — …
  ✗ /whats-open lists a piped open meta row under "Meta items" with its age, and its banner agrees with the digest (… AC-2)
      "Meta items" must list row 1 with its age in days; got: ["  (none open — the inbox is clear)"]
  ✗ a DONE meta row is never counted or listed, even when pipes in its Item put a mention of OPEN.md where the Status used to be read (… AC-3)
      got "meta inbox: 1 open, oldest 0d" — the row is DONE; testing a shifted cell for the substring "OPEN" counts it, …
  ✓ a DONE meta row stays closed when a later cell holds a fragment that is exactly OPEN: …
  ✓ an open row of another type is not a meta row, whatever its Item says (… AC-3)
  ✗ a malformed DONE row (a second row's tail fused on, as in OPEN.md row 157) is not counted and does not stop the reader: … (… AC-4)
      listed ["2","4"], want ["2","3","4"] — rows 2, 3 and 4 are open (3 has a pipe in its Item) and row 1 is DONE
  ✗ a piped open meta row whose Opened cell holds no date still counts, with its age unknown (…)
      got "⚠ META ESCALATION — 2 open harness lesson(s), oldest 109d" — three open lessons fire the count trigger; …
  ✗ a date inside the Item text is not the row's Opened date: a piped row opened 2 days ago stays quiet (… AC-1)
      got "meta inbox: 0 open (clear)" — the row is open and two days old; …
  ✗ on this repo's real ledger the meta list holds exactly the meta rows that have an OPEN cell: none dropped, none extra (… AC-5 …)
      dropped rows: [70, 244]; extra rows: [] (the reader lists 107, the ledger holds 109) — …
{"pass":12,"fail":9}
```

Each failure is the defect itself, not a typo or an import error: the suite loads, the 10 existing
tests pass, and every red test reports the wrong meta state the story describes.
