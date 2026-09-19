# ADR 0001: New ledger rows get a date+slug id and a file of their own; the numbered table is frozen where it stands

**Status:** Accepted
**Date:** 2026-09-19
**Story:** `engineering-team/stories/ledger-row-identity/1-collision-free-ledger-row-ids.md`

## Context

The story asks for ledger ids that any session can mint without coordination, even offline (AC-1),
that never have to change at a merge (AC-2), with every existing id and citation left resolving and
no citation edited (AC-3), duplicates caught by lint (AC-4), unchanged read surfaces (AC-5) and one
written rule (AC-6). It leaves one thing for this ADR to price rather than require: whether adding
rows should stop conflicting textually at all.

No concept-graph handle is involved; the ledger is harness infrastructure.

What the ledger is today (`origin/staging` `86b2d9e7`, 2026-09-19):

- **One markdown table in `OPEN.md`**: 329 rows, 444 KB, up from 245 KB 28 days earlier. The median
  row is a single 1.2 KB line and the longest is 6.8 KB. Sessions are told not to read the file end
  to end.
- **Ids are "highest number on `origin/staging` plus one."** The story counts eleven renumbering or
  de-duplication events between 2026-08-07 and 2026-09-18, ten of them after row 151 wrote down
  "fetch before you mint".
- **A twelfth happened while this ADR was being written, and nothing caught it.** PR #686 merged at
  07:18Z carrying row 329 (`2a99d58d`, a cleanup row). Another session authored its own row 329 at
  07:30Z (`dab6ce5b`, a meta row), on a branch whose parent already held the first 329, and PR #687
  merged it at 07:36Z. The new line went in directly above the old one, so git saw no conflict.
  `origin/staging` now carries two rows numbered 329, and no check says so.
- **Two readers, and neither reads the id.** `scripts/whats-open.sh:29–33` greps table lines holding
  `| OPEN |`. `scripts/lib/collect-meta.sh:24–35` (`collect_meta()`, specified by ADR
  `harness-self-improvement/0004`) counts rows whose third pipe-field holds `meta` and whose sixth
  holds `OPEN`, and ages them from the fifth. `scripts/session-start.sh:28` reuses `collect_meta()`.
  `scripts/harness-lint.sh` never opens `OPEN.md`; its waiver file cites rows in free text.
- **CI enforces lint on the merge result.** `.github/workflows/test.yml:37` runs `npm test` on
  Node 22 with full history, and `test/harness-lint.test.js:443` asserts that the real repo lints
  clean. A lint check is therefore a merge gate, not advice.
- **Three suites in that gate read legacy rows out of the real table.**
  `test/operational-direction.test.js:1034` finds row 41 with `/^\|\s*41\s*\|/`,
  `test/curated-dlist-update-update-preview.test.js:712` finds row 314 with `/^\| 314 \|/`, and
  `test/curated-dlist-update-publish.test.js:1730` filters `/^\| \d+ \|/` lines by content. These are
  citations a machine follows. `test/session-start.test.js:56–61` is the only suite that builds a
  fixture ledger.
- **Product agents may write `OPEN.md` and nothing else outside `product-team/`.** Six files under
  `.claude/agents/` carry `Write(./OPEN.md)` and `Edit(./OPEN.md)`; `CLAUDE.md:70` and
  `product-team/README.md:34` say so; and the product flow never writes into `engineering-team/`.
- **Citations** (story table): 1,638 that name the ledger outright in 529 files, about 1,080 bare
  "row N", about 6,600 `#N` tokens in markdown that share their form with PR and story numbers,
  562 commit-message lines, and an unknown number in PR bodies and on the operator's Loose Threads
  board.
- **Nine rows carry a literal `|` inside a cell** (48, 70, 79, 84, 111, 157, 166, 229, 244). Reading
  by field position misreads them; open meta rows 70 and 244 are missing from the escalation count
  today. The story files that reader bug separately, but anything here that parses rows has to
  survive those nine.

Three different things go wrong, and the options differ in which they fix:

1. **The counter.** Minting needs a global fact ("the highest number anywhere") that parallel
   sessions cannot have. The window is the life of a branch, not the age of a fetch.
2. **The repair.** A collision is repaired by renumbering, and a renumber is a sweep over citations
   that cannot be told apart from PR and story numbers. A missed one still resolves — to another
   real row (row 207).
3. **The tail.** Two branches that each append a line to the same table conflict textually whatever
   their ids are. With numbers, "keep both sides" leaves duplicates; with unique ids it would be a
   complete resolution, but still a hand resolution, a push and a CI re-run for every open PR each
   time another row-adding PR merges.

## Options considered

### Option A — One file per row for the whole ledger; `OPEN.md` generated or reduced to a stub

The 2026-07-28 intake proposal. All 329 rows become files under `engineering-team/open/`; legacy
rows keep their numbers in the filename (`0230-….md`), new rows take date+slug names, and
`OPEN.md` becomes a generated index or a pointer.

*Pros.* Fixes all three problems. One home for every row. Legacy rows become readable, diffable
pages instead of 1–7 KB lines.

*Cons, priced.*

- **A 329-row migration with a parser that must be exactly right.** It has to split on the first
  two and last four pipes to survive the nine piped rows, carry five out-of-order rows, find a home
  for the fifteen prose notes that sit *between* rows (a directory has no "between"), and keep a
  `DONE-LOCAL` status and types like `bug?` and `docs/ops`. AC-3 then needs a byte-for-byte proof
  over all 329 Item texts.
- **The landing is itself the biggest collision the ledger has had.** A one-shot rewrite of a
  444 KB file conflicts with every in-flight branch that touched `OPEN.md`, and each of those edits
  has to be re-applied by hand onto files. At the time of writing none of the four open PRs touches
  it, so a quiet window exists; but session branches that are not pushed yet cannot be seen, and
  the window has to hold from the migration's first commit to its merge.
- **A generated `OPEN.md` brings the tail conflict back in a worse form.** If it is committed, two
  branches that each add a row both regenerate it; the conflict's correct resolution is
  "regenerate", not "keep both", which is the opposite of AC-2. If it is not committed, 1,638
  citations reading "OPEN.md row N" point at a file with no rows in it, the GitHub view of the
  ledger is gone, and the lookup the operator's packet prompts teach (`grep -nE '^\| 230 \|'
  OPEN.md`) stops working in 47 prompts that live outside the repo.
- **Every reader switches at once.** Both parse sites are rewritten rather than extended, the three
  gate suites that read rows 41 and 314 and three more by content out of the table have to be
  re-aimed at files, the fixture ledger in `test/session-start.test.js` becomes a fixture directory,
  and AC-5 has to be shown across a full rewrite.
- **The proposed location breaks the product flow.** `engineering-team/open/` is outside what
  product agents may write, and inside the tree the product flow must never write to.

### Option B — Date+slug ids, in place

Nothing moves. New rows are still appended to the table, with `2026-09-19-some-slug` in the `#`
column instead of a number. Lint gains a duplicate-id check and freezes the numeric space.

*Pros.* The smallest change that meets all six ACs. Problems 1 and 2 are gone: no global state to
mint, and "keep both sides" is always valid, so nothing is renumbered again. No reader changes,
because no reader looks at the id. AC-3 and AC-5 hold trivially.

*Cons.*

- **Problem 3 stays, in full.** Every pair of open PRs that both add a row still conflicts.
  `merge=union` in `.gitattributes` would settle it locally, but GitHub does not apply it when it
  computes whether a PR can merge (GitHub community discussion #9288; reported, not tested here),
  so the PR still goes CONFLICTING and still needs a sync, a hand resolution and a CI re-run. Union
  also turns a same-row edit on two branches into a silent duplicate line.
- "Keep both sides" is complete only for pure additions. If one side also edited a row inside the
  conflict hunk, keeping both leaves two copies of that row; lint names the id and the fix is
  deleting the stale copy. Loud and cheap, but not nothing.
- The table keeps growing (+199 KB in the last 28 days), rows stay single multi-kilobyte lines, and
  every new row can repeat the pipe-in-a-cell misparse.

### Option C — Date+slug ids; new rows are files; the numbered table is frozen where it stands

The id scheme of B, and the storage of A for new rows only. `OPEN.md` keeps its 329 rows, its
numbers and its notes exactly where they are, and is closed to new rows. A new row is a new file,
`ledger/<id>.md`. The two readers gain a second source. Nothing is generated and nothing migrates.

*Pros.*

- Fixes all three problems for everything minted from now on. Creating a file never conflicts with
  creating another. Two branches that mint the *same* id produce an add/add conflict on that path:
  loud, at merge time, enforced by git rather than by a convention.
- **Zero migration.** AC-3 holds by construction: no legacy row moves, no citation is edited, and
  `grep -nE '^\| 230 \|' OPEN.md` keeps working.
- **The reader change is additive.** Table parsing stays byte-identical, so AC-5 holds by
  construction for every legacy row, the three gate suites that read the table pass untouched, and
  fixture trees without a `ledger/` directory behave as before.
- New rows are ordinary markdown pages with fielded headers, so the pipe-in-a-cell class cannot
  recur, amendments diff as paragraphs, and `/whats-open` prints one summary line per file row
  instead of the whole cell. The table stops growing.
- Roughly twice B's effort and a small fraction of A's.

*Cons.*

- **Two physical homes.** A number lives in the table; a date+slug lives in `ledger/`. The id's
  shape says which, `OPEN.md` stays the one front door and states the rule, and `/whats-open` shows
  both as one list — but it is still two places.
- Row files accumulate (DONE rows are the audit trail and are never deleted). At the recent rate
  that is about 1,200 files a year in one flat directory. Git and the readers do not care;
  people browsing the folder will.
- Six agent definitions and two lines of prose need `ledger/` added to the product roles' write
  scope.
- In-flight branches that already minted a numbered row must convert it (see the rollout plan).

### Option D — Keep numbers; coordinate the mint

Four variants, all rejected on the evidence:

- **Fetch before minting** — the rule since 2026-08-07. Ten events followed it; row 307 records a
  19-minute window in which both sessions were right when they looked; this morning's duplicate 329
  was minted *on top of* the row it duplicates.
- **A pre-push check or a lint for duplicates alone.** Worth having (it is AC-4, and it would have
  stopped PR #687), but it only detects. The repair is still a renumber, so problem 2 stays.
- **Mint on staging first through a small docs PR** (row 307's candidate). Every loose end becomes
  its own PR, merge and deploy run, and two such PRs open at once still race.
- **Per-machine or per-session number lanes.** Lanes need a registry of minters, which is the same
  global state. The minters are now dozens of short-lived sessions, not two machines. A
  session-scoped prefix that needs no registry is just a slug, which is Option B.

Assigning numbers at merge time by a bot fails for a different reason: a placeholder that is unique
and citable makes the number redundant, and a bot commit on `staging` triggers a deploy.

## Decision

We chose **Option C**.

The id scheme is the part that cannot be changed later, because citations are forever; date+slug is
the only scheme here that needs no shared state, and both B and C use it. Between B and C the
question is whether to pay about twice B's effort now to stop row additions conflicting. We pay it,
for three reasons:

1. The conflict B leaves is structural and scales with exactly what the operator is increasing:
   the number of PRs open at once. Each one costs a sync, a resolution and a CI run.
2. One rule change is cheaper than two. Every change to how rows are minted has to be re-taught to
   every prompt, including the packet preamble that lives outside the repo. B now and C later is two
   rounds of that, for the same destination.
3. C needs no migration, so it carries none of A's risk. What A would add — legacy rows as files —
   is uniformity, bought with the riskiest step on the table. Legacy rows can stay where 2,700
   citations say they are.

**B is the fallback.** If the operator wants the minimum, B is a strict subset of C's rule — same
ids, same lint — and C can follow later with no migration, because under C the table is simply
"frozen as of the day C lands".

This extends ADR `harness-self-improvement/0004`: `collect_meta()` gains a second source, and its
thresholds, banner and advisory-only contract are untouched. It follows ADR
`harness-self-improvement/0001` for the new check's shape, waivers included. It keeps that book's
"no new lesson surfaces" constraint: still one ledger, one front door (`OPEN.md`), one rule, one
reader library. `ledger/` is where that ledger stores new rows, not a second inbox.

### The rule, as `OPEN.md` will state it

- **An id is `YYYY-MM-DD-<slug>`.** The date is the UTC day the row is minted (`date -u +%F`). The
  slug is two to six lowercase words, `[a-z0-9]` joined by hyphens, that say what the row is about.
  Whole id at most 64 characters. Pattern:
  `^20[0-9]{2}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+){1,5}$`.
- **Minting is creating `ledger/<id>.md`.** Nothing is fetched and nothing is counted.
- **An id never changes once it is on `staging`, and a row never moves.** Numbers stay in the table;
  date+slug ids stay in `ledger/`.
- **Cite the id, never the path:** "OPEN.md row `2026-09-19-agent-worktrees-outlive-books`". The
  existing phrase stays, so prose habits and greps for `OPEN.md row` keep working, and because the
  id is a unique string, `git grep -F '<id>'` finds every citation exactly — which a number never
  could.
- **Closing a row** sets `**Status:** DONE` and fills `**Done:**` in its file, or flips the table
  row as today. Nothing is deleted.
- **If two branches mint the same id,** git reports an add/add conflict on the path. Same finding:
  merge the two bodies into one file. Different findings: the branch that has not landed renames its
  file; every citation of it is inside that branch and is an exact string.

### A row file

House style, the fielded header that stories, epics and books already use and the scripts already
parse (`grep -m1 -E '^\*\*Status:\*\*'`), not YAML:

```markdown
# Agent worktrees outlive their books and nothing reaps them

**Id:** 2026-09-19-agent-worktrees-outlive-books
**Type:** meta
**Opened:** 2026-09-19 (session close; worktree sweep)
**Status:** OPEN
**Done:** —

What was seen, the evidence, the fix shape. Ordinary markdown, as long as it needs to be.

**Pointer:** where the detail lives.
```

The title line stands in for the bold lead sentence rows carry today. The header fields are the
table's columns under the same names.

## Consequences

- **Enables:** any number of sessions adding rows at once with no conflict and no coordination;
  exact-string citation sweeps if one is ever needed; row bodies that read and diff as documents; a
  `/whats-open` roll-up that gets shorter as the ledger moves to summaries.
- **Constrains:** the numeric id space is closed. After this lands, a numbered row above the frozen
  maximum fails lint, and therefore CI, on any branch. Sessions working from older prompts will hit
  that; the message tells them what to do.
- **Two homes** for rows, for as long as legacy rows are cited — that is, permanently. Accepted.
- **Still conflicting:** edits to the same or adjacent legacy rows on two branches (rare, and a real
  disagreement when it is the same row), and the tails of `engineering-team/CHANGELOG.md` and
  `_intake.md`, which this ADR does not touch.
- **Debt and follow-ups:** (1) the positional-parse bug that drops rows 70 and 244 from the meta
  count (`OPEN.md` row 330, "The meta escalation count drops open rows whose text contains a pipe")
  lands as its own small fix *before* this story's AC-5 baseline is taken, so "same before and
  after" compares like with like; (2) the operator's packet preamble on the Loose Threads board
  teaches "highest number plus one, expect to renumber" and must be edited when this lands — it is
  outside the repo, so no commit can do it; (3) a flat `ledger/` directory will want a `done/`
  subfolder or month folders some day. Citations name the id and not the path precisely so that can
  be decided later without breaking anything.
- **Firmware reinstall required?** No.

## Implementation notes

In landing order. Test-file changes belong to Phase 3.

1. **Settle duplicates already in the table, without renumbering.** For each id that appears twice,
   the row that landed on `staging` first keeps the number (landing order from
   `git merge-base --is-ancestor`, not from the Opened cell). Each later one moves to
   `ledger/<its Opened date>-<slug>.md`, and the table gets one numbering note where it stood, in
   the existing style: which row moved, its new id, and that "row N" means the other one. Sweep the
   moved row's citations **by its text, not its number** (row 207's lesson), confined to the commits
   that introduced it. Today that is the second row 329 (`dab6ce5b`, PR #687). If someone renumbers
   it under the old rule before this lands, there is nothing to do here.
2. **Freeze the table.** Directly after the last table row in `OPEN.md`, add
   `<!-- ledger-table-frozen: highest-number=<N> -->`, N being the highest number on `staging` at
   landing, and one line of prose above it: the table is closed; new rows are files in `ledger/`.
3. **`OPEN.md` § "How to use this ledger"** — replace the "Add a row" bullet with the rule above
   (mint, cite, close, same-id conflict), and link the template. The header table's "this file" cell
   becomes "this file's table (rows 1–N) and `ledger/` (everything since)". The fifteen numbering
   notes stay: they are the record.
4. **`engineering-team/templates/open-row.md`** — the row file above, with placeholder fields.
5. **`scripts/lib/collect-ledger.sh`** (new, sourced) — `ledger_file_rows()`: for each
   `ledger/*.md`, print `id<TAB>type<TAB>opened<TAB>status<TAB>title`, where id is the filename
   without `.md`, type and status are the first token of their fields, opened is the first ISO date
   in `**Opened:**`, and title is the first `# ` line. No `ledger/` directory: print nothing, exit 0.
6. **`scripts/whats-open.sh:29–33`** — keep the table grep as it is. After it, print one line per
   `OPEN` file row: `| <id> | <type> | **<title>** → ledger/<id>.md | <opened> | OPEN | | |`. Print
   "(no OPEN rows in the ledger)" only when both sources are empty.
7. **`scripts/lib/collect-meta.sh` `collect_meta()`** — after the table loop and before the intake
   loop, a loop over `ledger_file_rows` where type matches `meta` and status is `OPEN`: the same age
   arithmetic through `date_to_epoch`, the same counters, `META_LINES` entry
   `[<age>d] <id> — <title>`. Do not touch the table loop in this story (follow-up 1).
8. **`scripts/harness-lint.sh`** — new `check_L15` ("ledger-ids"), added to the header list and the
   run sequence after `check_L14`, using `violation L15 <path> <msg>` so waivers work unchanged:
   - (a) no id appears twice in the `OPEN.md` table. Read the id as the text between the first two
     pipes, which is safe on the nine piped rows. Message names the id.
   - (b) with the freeze marker present: every table id is a number no higher than the marker's.
     Otherwise: `row <id> is above the frozen table (highest-number=<N>) — move it to
     ledger/<date>-<slug>.md; see OPEN.md § How to use this ledger`. No marker: print
     `INFO … L15(b) skipped`, the way L10 and L11 degrade, so existing fixture trees pass untouched.
   - (c) every `ledger/*.md`: the filename matches the id pattern; `**Id:**` equals it; `**Type:**`,
     `**Opened:**` (holding an ISO date) and `**Status:**` (first token `OPEN` or `DONE`) are
     present. No type enum: the table never had one.
9. **Write scope for product roles.** Add `Write(./ledger/**)` and `Edit(./ledger/**)` to the six
   `.claude/agents/*.md` files that carry `Write(./OPEN.md)` (`git grep -l 'Write(./OPEN.md)' --
   .claude/agents`). Reword `CLAUDE.md:70` in place — it sits at its line cap, so no new line — and
   `product-team/README.md:34` and `:86` to "`product-team/**` + `OPEN.md` + `ledger/**`".
10. **Retire the interim guidance (AC-6).** `engineering-team/workflows/6-book-close.md` step 13.2:
    drop the row-number rationale and keep the instruction to push, whose remaining reason is that
    sibling sessions read `origin`. Grep the definition paths for `highest`, `renumber` and
    `row number` and fix what still teaches the counter. Rows 151, 207 and 307 are flipped DONE and
    the 2026-07-28 intake entry gets its marker by the Reviewer's PASS commit, not before.
11. **`engineering-team/CHANGELOG.md`** — one row in the same commit as the definition-path edits
    (steps 4–10 touch `scripts/`, `.claude/agents`, `engineering-team/{templates,workflows}` and
    `CLAUDE.md`). Origin: rows 151, 207 and 307; this ADR.

### Rollout: branches in flight and citations

- **Citations: none are edited, and none need to be.** Numbers keep resolving in the table. The one
  exception is the text-matched sweep in step 1, for a row that landed minutes ago.
- **Branches that already minted a numbered row** fail L15(b) at their next push, because CI lints
  the merge result. The remedy is in the message: create the file, delete the appended table line,
  and fix the branch's own mentions — confined to `git diff --name-only origin/staging...HEAD`. That
  also ends the branch's tail conflict. The implementation PR lists the open PRs that touch
  `OPEN.md` (`gh pr list --state open --json number,title,files`; none at the time of writing) so
  the operator knows which sessions will meet it.
- **Outside the repo:** the operator edits the packet preamble when this merges (follow-up 2).
  Prompts already copied into running sessions keep the old rule; L15(b) is what catches them.
- **Verification the Reviewer should expect:** a before/after diff of the id→Item-text map over the
  table, empty apart from step 1; `/whats-open`, the digest line and the meta count compared before
  and after on the real tree; two scratch clones minting offline and merging both ways with nothing
  to resolve; a fixture with a duplicated id failing lint by name.

## Out of scope

- Moving legacy rows into files, now or later (Option A's migration). Revisit only if the frozen
  table itself becomes a problem.
- The tails of `engineering-team/CHANGELOG.md` and `_intake.md`.
- The positional-parse fix in `collect_meta()`'s table loop — its own ledger row, sequenced first.
- Sub-folders, archiving or an index for `ledger/`.
- A mint helper script. `date -u +%F` and a filename are the whole procedure; add one only if
  sessions get the pattern wrong in practice.
- `.gitattributes` merge drivers for any file.
