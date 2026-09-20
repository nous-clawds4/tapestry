# Review: rows 342 and 343, and four notes on rows 307, 340 and 341 — the follow-ups PR #695 left in its body

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-20 (UTC, from `date -u`). The review ran from 23:47Z on 2026-09-19 to about 00:25Z on
2026-09-20. The file name carries the day this file was written; the rows under review are dated the
day before, correctly (the commit is stamped 23:44:48Z on 2026-09-19).
**Diff:** `git diff origin/staging...HEAD` on branch `docs/ledger-safe-to-merge-followups`: one unpushed
commit, `a2dc7c27`, directly on `origin/staging` `0a73cd23` (PR #695's merge). `git show a2dc7c27` is
the whole surface: `OPEN.md`, 5 insertions and 3 deletions — rows 307, 340 and 341 changed in place,
rows 342 and 343 appended. The diff copy supplied with the brief is byte-identical to this reviewer's
own (`cmp`, exit 0).
**File:** non-numbered by convention — this lane has no story to match (`workflows/0-intake.md` §3).
**Lane:** doc / one-liner (Implementer + Reviewer, Standard strictness). No story, no ADR, no test plan
and no book, by design. The lane's record is this review.

The brief reserved the commit for the orchestrator. This reviewer created this one file and nothing
else in the repo: no `git add`, no commit, no push, no branch switch, no stash, no edit to `OPEN.md` or
any other tracked file. Scratch files lived under the session scratchpad, outside the repo. One
throwaway `git worktree` (detached at `origin/staging`, under the scratchpad) was created for the
baseline runs and removed; `git worktree list` shows only the main checkout, and `git status --short`
was empty before this file was written. Side effects, stated for completeness: one `git fetch origin`
(00:08:53Z; no ref moved), and two in-memory trial merges (`git merge-tree --write-tree`) that left
unreferenced tree objects in the object database — no ref, index or working-tree change.

**What this reviewer was given.** The diff, the commit message and the operator's acceptance frame
(changes A1 to A5, plus a sixth approved at the implementation gate) — not the Implementer's
conclusions. Every fact in the frame was treated as a claim and re-run.

**Short version.** All six changes hold. Each modified row is byte-for-byte "staging's row plus the
announced edit" and nothing else moved in the file. Every quotation is verbatim in its source (one
wraps across two lines there). Every universal or negative claim was re-run with a positive control
through the identical pathspec, and the zsh measurement in row 342 reproduces exactly in this
reviewer's own tool shell (zsh 5.9). The passages the Implementer added beyond the brief survive too;
in one place (row 307) the Implementer replaced a clause of the brief that nobody could check without
a transcript with one that this clone's reflog confirms. Two things rest on footing weaker than a
command, and the tables say exactly what: the board note in row 340 (a saved copy of the page plus
the orchestrator's statement, not the live page), and which two statements the earlier brief had
labelled (the operator's frame plus the earlier review's text; that brief is not in the repo).
Nothing blocks. Six optional notes. One friction item, and it is not a new row: the brief's own
example gate command runs zero tests for two of the five suites, which is open row 310.

## Quality gates (run by reviewer, not trusted)

- [x] **`bash scripts/harness-lint.sh` on HEAD (`a2dc7c27`)** — exit 0, 40 lines, last line
  `harness-lint: clean (0 violations)`. The same command in a throwaway worktree at `origin/staging`
  (`0a73cd23`): exit 0, same last line, and `diff` of the two outputs is empty. The change adds
  nothing to lint.
- [x] **The five suites that read the real ledger, under Node v22.23.2, `process.arch` x64** (the
  binary the brief named, invoked by its full path; version and arch printed by each child process
  itself). Each suite run through its exported `run()` in its own child process — see Harness
  friction 1 for why not "directly".

  | Suite | HEAD `a2dc7c27` (23:49:46Z–23:51:33Z) | `origin/staging` `0a73cd23` (23:51:58Z–23:53:48Z) |
  |---|---|---|
  | `test/harness-lint.test.js` | 41 pass, 0 fail | 41 pass, 0 fail |
  | `test/session-start.test.js` | 22 pass, 0 fail | 22 pass, 0 fail |
  | `test/operational-direction.test.js` | 86 pass, 0 fail, 0 skipped | 86 pass, 0 fail, 0 skipped |
  | `test/curated-dlist-update-publish.test.js` | 69 pass, 0 fail, 0 skipped | 69 pass, 0 fail, 0 skipped |
  | `test/curated-dlist-update-update-preview.test.js` | 34 pass, 0 fail, 0 skipped | 34 pass, 0 fail, 0 skipped |

  Identical on both trees, and equal to the operator's baseline (41, 22, 86, 69, 34). That baseline
  was not leaned on — the right-hand column is this reviewer's own — but the statement attached to
  it was checked: `git diff --stat 37284673 0a73cd23` lists one file, the earlier review (204
  insertions, 9 deletions), so `37284673` does differ from staging's `0a73cd23` only in the review
  file. `session-start` includes the standing real-ledger test (the reader's open-`meta` list against
  a whole-line oracle); it passes with rows 342 and 343 present.
- [ ] **Full `npm test` — deliberately not run locally**, so there is no `npm run gate:status` line to
  quote. On this host the full gate is red on every branch for unrelated live suites (OPEN.md row
  289). The branch is unpushed, so no CI run exists yet; the PR's stack-free gate on Node 22 is the
  regression check for this change.
- [ ] `npm run test:playwright` — not applicable (no browser or UI surface).
- [ ] _Lint, typecheck, build: not configured — skipped._
- [x] `git diff --check origin/staging...HEAD`: clean (exit 0).
- [x] **With this file present** (observed after it was written, not predicted): see the last item of
  "Row mechanics and read surfaces" below.

### Row mechanics and read surfaces

Measured by bash scripts (`scripts/lib/collect-meta.sh` finds its sibling through `BASH_SOURCE`, so it
was sourced from a bash 3.2.57 script, never from zsh). This host's `awk` counts `length` in bytes.

| Row | Pipes before → after | `awk -F` fields | Status cell | Done cell | Bytes before → after |
|---|---|---|---|---|---|
| 307 | 8 → 8 | 9 | `OPEN` | empty | 3,356 → 4,291 |
| 340 | 8 → 8 | 9 | `OPEN` | empty | 4,911 → 5,149 |
| 341 | 8 → 8 | 9 | `OPEN` | empty | 2,323 → 2,330 |
| 342 | new: 8 | 9 | `OPEN` | empty | 2,376 |
| 343 | new: 8 | 9 | `OPEN` | empty | 2,275 |

- Each id matches exactly one line on HEAD. Type is `meta` on all five. Eight pipes and nine fields
  mean no literal or escaped pipe inside any cell, so the reader's Status-by-value rule meets `OPEN`
  at field 6 on each; the words `OPEN` and `DONE` that row 342 uses about its sibling rows sit inside
  the Item cell (field 4), which the rule never inspects.
- **Meta count**, the repo's reader, same clock, `OPEN.md` plus `_intake.md` extracted from each ref
  into a temp dir: **117 on `origin/staging`, 119 on HEAD**. The two lists differ by exactly two
  lines, rows 342 and 343, both `[0d]`. The reader gives 119 in the real working tree as well.
- **`bash scripts/whats-open.sh`** (exit 0, 412,847 bytes): rows 342 and 343 are the last two lines of
  the ledger section (lines 251–252) and appear under "Meta items" as `[0d]` (lines 372–373); the
  banner reads 119. Both lines are byte-identical to the ledger's (`cmp`), so the `$FILES` and
  `$(echo …)` text in row 342 passes through the read surface unexpanded. The script left the tree
  clean.
- **Nothing else moved.** A Node script rebuilt each modified row from staging's row plus the
  announced edit and compared it with HEAD's: row 341 is one replacement whose anchor occurs once;
  row 340 is two edits whose anchors occur once each; row 307 is a pure insertion of 923 characters
  containing no pipe, placed at the end of the Item cell. Every other line of `OPEN.md` is identical
  and in order (403 → 405 lines), rows 342 and 343 are the last two lines, and the file ends with a
  newline. Duplicate numbers on HEAD: 329 only, which is pre-existing and recorded (ADR
  `ledger-row-identity/0001:29`).
- **Shared-number cross-references.** At HEAD the numbers 342 and 343 occur in `OPEN.md` only in the
  two id cells, and nowhere else in the repo as a row citation. A renumbering at merge would touch
  those two cells, the commit message and the PR body — and this review, once committed, would need
  a renumbering note at its top, as the earlier one got.
- **`OPEN.md` is not a harness-definition path.** `scripts/harness-def-paths.txt` names it once, in
  the comment at `:9` that says records are "deliberately NOT listed"; the commit touches no other
  file, so no CHANGELOG row is owed (and lint L10 is silent).
- **With this file present** (first observed 00:16:01Z, and again after the last write):
  `awk -f scripts/lib/review-verdict.awk` on this file prints `PASS`. Two heading-or-bold lines carry
  a verdict token: the "On PASS" heading and, after it, the verdict line, which is the last.
  `bash scripts/harness-lint.sh` again exits 0 with the same last line; its output gains exactly one
  line (41 against 40, by `diff`), the expected `INFO non-numbered-review` for this file. The two
  suites that execute the harness scripts against the real tree, `harness-lint` and `session-start`,
  were re-run with the file present (00:19:31Z–00:21:17Z): 41 and 22 pass, 0 fail. The other three
  name `OPEN.md` and no reviews path, and this file does not change `OPEN.md`; they were not re-run.

## Commands referred to in the tables

The tool shell here is zsh 5.9 (`echo $ZSH_VERSION`). Multi-path searches below have their paths
spelled out; the control runs through the same pathspec as the search. Plain `grep` was never used
for a negative (row 165): negatives rest on `git grep`, or on `/usr/bin/grep` inside a bash script for
files outside the repo.

**K1 — the zsh measurement (23:59:19Z, HEAD `a2dc7c27`; `CLAUDE.md` and `AGENTS.md` are identical to
`0a73cd23`, `git diff --quiet`):**

```
FILES="CLAUDE.md AGENTS.md"; git grep -c staging -- $FILES; echo "exit=$?"              # prints nothing; exit=1
bash -c 'FILES="CLAUDE.md AGENTS.md"; git grep -c staging -- $FILES; echo "exit=$?"'   # CLAUDE.md:1 ; exit=0
git grep -c staging -- $(echo CLAUDE.md AGENTS.md); echo "exit=$?"                      # CLAUDE.md:1 ; exit=0
git grep -c staging -- CLAUDE.md AGENTS.md; echo "exit=$?"                              # CLAUDE.md:1 ; exit=0
printf '<%s>\n' $FILES                                                                  # <CLAUDE.md AGENTS.md>  (one word)
git grep -c -i staging -- AGENTS.md; echo "exit=$?"                                     # prints nothing; exit=1
```

**K2 — prior rows for A1 and A2, searched on `origin/staging`'s tree so that the new rows cannot match
themselves:**

```
git grep -c -i -E 'staging' origin/staging -- OPEN.md engineering-team/stories/_intake.md    # control: 119 and 63 lines
git grep -n -i -E '<pattern>' origin/staging -- OPEN.md engineering-team/stories/_intake.md
```

**K3 — row 343's negative, control first, identical pathspec:**

```
git grep -c -i verdict    -- engineering-team/roles/reviewer.md engineering-team/workflows/5-review.md engineering-team/templates/review-checklist.md   # 2, 4, 2 ; exit 0
git grep -n -i transcript -- engineering-team/roles/reviewer.md engineering-team/workflows/5-review.md engineering-team/templates/review-checklist.md   # nothing ; exit 1
```

Run in zsh with the paths spelled out and again under `bash -c`: same result. The pattern can match:
nine files under `engineering-team/reviews` contain it.

**K4 — times and identities:** `gh pr view <n> --repo nous-clawds4/tapestry --json
mergedAt,mergeCommit,baseRefName,headRefName,commits,body` for 691, 692 and 695; commit stamps from
`TZ=UTC git show -s --date=iso-local --format='%ad %cd'`.

**K5 — quotations:** a Node script took each quoted string from the changed passages and searched its
source at HEAD as a fixed string, once per line and once with line wraps collapsed; a string that
cannot be in the file served as the control (0 matches).

## Claims adherence — each claim, with what was run to falsify it

### Change 1 — row 342 (new; A1)

| # | Claim | Evidence gathered by this reviewer | Result |
|---|---|---|---|
| 1.1 | zsh does not word-split an unquoted parameter, so the quoted line hands git the single pathspec `CLAUDE.md AGENTS.md`, which names no file | K1, fifth line: `$FILES` expands to one word | holds; re-measured, not cited |
| 1.2 | "Measured 2026-09-19 (zsh 5.9, the Bash tool's shell on this machine; repo at `0a73cd23`): that line prints nothing and exits 1, and the same line under `bash -c` prints `CLAUDE.md:1` and exits 0" | K1, lines one and two, in this reviewer's own tool shell: `ZSH_VERSION` 5.9, `BASH_VERSION` empty. K1's last line shows why one output line is the whole answer: `AGENTS.md` does not contain the word | holds exactly |
| 1.3 | (Implementer's addition) "A command substitution is still split (`-- $(echo CLAUDE.md AGENTS.md)` prints `CLAUDE.md:1`), as are paths written out, so the trap is the variable" | K1, lines three and four | holds. "As are paths written out" is loose (literal words are never joined in the first place) and harmless |
| 1.4 | (Implementer's addition) "rows 340 and 341 each rest on a `git grep -i` that "finds nothing"" | Each row read from `git show HEAD:OPEN.md`: the fixed strings `git grep -i` and `finds nothing` occur once each in row 340 and once each in row 341, in the same sentence | holds; quotation verbatim |
| 1.5 | "It happened in row 340's review, round 2: the Reviewer's first run of row 341's universal negative (row 334 at the time) put its two paths in one unquoted variable and "found nothing" for the wrong reason" | Earlier review `:411-414`, inside "## Round 2" (heading at `:340`): "This reviewer's first run of row 334's universal negative put the two paths in one unquoted variable … and "found nothing" for the wrong reason". `"found nothing"` is on `:414` (K5). Row 334 became 341 in `37284673` (claim 4.2) | holds; "(row 334 at the time)" is right |
| 1.6 | "It was caught only because the positive control ran through the same variable and printed nothing too" | Earlier review `:414-415` ("The positive control … printed nothing and exposed it") and `:579` ("caught only because the positive control ran against the same variable") | holds |
| 1.7 | Durable form: control through the same pathspec; spell paths out or use `bash -c` | Advice, not fact. It matches the earlier review `:579-581`, and it is the method this review used throughout | holds |
| 1.8 | Siblings: "row 111 (`PIPESTATUS` is empty in zsh; DONE), row 165 (the `grep` wrapper honors `.gitignore`; OPEN) and row 237 (zsh's `:t` modifier mangles `$TA:slug`; OPEN, type `docs`)" | Each row read on HEAD, Status found by value: 111 is `meta`, `DONE…`, "`PIPESTATUS[0]` expands to the empty string"; 165 is `meta`, `OPEN`, "`grep` in this environment silently honors `.gitignore`"; 237 is `docs`, `OPEN`, "applies the `:t` modifier … and silently mangles the concept handle" | holds, all three, statuses and type included |
| 1.9 | "none covering this one" — and not a duplicate (universal negative) | K2, control first. Patterns `word-split`, `word split`, `wordsplit`, `SH_WORD_SPLIT`, `shwordsplit`; `unquoted`; `\$FILES`; `pathspec`; `negative search`, `negative grep`, `universal negative`; `positive control`: exit 1 each. `vacuous` matches rows 108 and 118 and `_intake.md:2178` (tests that pass over an empty collection; roles reporting actions not performed). `zsh` matches rows 111, 157, 165 and 237 and `_intake.md:2177`; 157 is about piping a gate run through `tail`. By path: the ledger rows citing `roles/reviewer.md` (114, 294) or `review-checklist.md` (160, 167, 272, 313) concern other things; `_intake.md` cites neither file | holds. Rows 111, 165 and 237 are siblings, not duplicates |
| 1.10 | Fix shape: a rule in `engineering-team/roles/reviewer.md`, or in the docs-mode note at `engineering-team/templates/review-checklist.md:20`, "which already asks for the evidence behind each claim" | Line 20 is the "Docs-mode / doc-lane variant" note: "one row per substantive claim the document makes, with the evidence that verified it (file read, command run, source checked)" | holds |
| 1.11 | (Implementer's addition) "both are harness-definition paths, so the change owes a CHANGELOG row" | `scripts/harness-def-paths.txt:17` (`engineering-team/roles`) and `:19` (`engineering-team/templates`); the header at `:2-3` states L10 | holds |
| 1.12 | Type, Opened, Status, Done, Pointer | `meta` fits the ledger's definition ("a process defect, a proposed amendment"). Opened "2026-09-19 (row 340's review, round 2, harness friction 2)": earlier review `:575` is item 2 under "#### Harness friction (round 2)". Pointer: `:411` is "**Method note — a vacuous negative, caught.**"; `:575` is "**Proposed `meta` row … a negative search over paths held in one unquoted variable is vacuous under zsh.**"; `review-checklist.md:20` as in 1.10; every path exists at HEAD (`git cat-file -e`) | holds; every `file:line` lands on what it claims to |

### Change 2 — row 343 (new; A2)

Everything about the earlier scan is checked here against the **text** of the earlier review only. No
transcript was opened, listed, searched or stat'ed by this reviewer.

| # | Claim | Evidence gathered by this reviewer | Result |
|---|---|---|---|
| 2.1 | Headline: reviews label a session's own observations "cannot be re-observed" while that session's transcript sits on the same disk | At HEAD the quoted words occur at earlier review `:318` and at `row-325-staging-occurrence-2026-09-19.md:16` (K5), and otherwise only in the new row. "On the same disk" is established for row 340's review by that review's own text (claim 5; `:183-184`); for the row-325 case the row says itself that it was not examined (2.10) | holds as scoped |
| 2.2 | "Row 340's review brief said it of two statements" | Earlier review `:319`: "The brief for this review said so of two statements". The brief is not in the repo | holds **on the earlier review's text**; not checkable further without a transcript, and not checked |
| 2.3 | (Implementer's addition) the row-325 review `:16` "says it of a smoke transcript ("the Implementer's attestation and cannot be re-observed")" | Line 16 reads "transcript behind the new note is the Implementer's attestation and cannot be re-observed; the table"; the word "smoke" ends line 15. The quoted string is on one line | holds; verbatim. There the word means the record of a smoke run, which is the session's own observation, as the headline says |
| 2.4 | In round 1 the Reviewer "ran a targeted scan of two transcripts on this machine (named strings, a time window, timestamps and short excerpts only) and checked both statements to the second" | Earlier review `:183-186` ("Two session transcripts on this machine, each through a script that printed only timestamps and short excerpts for: …"), `:320-321` ("checkable in one targeted scan, to the second"), and `:323`, where the parenthesis is word for word | holds as a description of what the earlier review says it did. What the scan found is that reviewer's attestation; not re-observed here, by instruction |
| 2.5 | (Implementer's addition) the two statements are "that review's claims 5 and 8: the operator's "merge it" message, and the 502 the merging session saw" | Claim 5 (`:140`): "The brief called "merge it" unobservable. It is not: …" with the message at 21:04:07Z. Claim 8 (`:143`): "Transcript: one nginx 502 at 21:06:36Z, three 200s at 21:07:17Z". The two glosses describe those table rows correctly. That claim 8 is the *second* statement the brief had labelled is said by the operator's frame for this change; the earlier review's text ties the label to claim 5 explicitly and is silent on which the other one was | holds. Footing for "8": the operator, who wrote that brief — non-blocking 3 |
| 2.6 | "its "Things tests can't catch" section records what was read outside the repo" | The heading with exactly that title is `:173` (rounds 2 and 3 add a suffix); its item at `:182` is "What was read outside the repo, and how narrowly." | holds |
| 2.7 | (Implementer's addition) "The label had been asserted, not checked." | Earlier review `:325-326`: "the lesson is that "unobservable" was asserted, not checked" | holds |
| 2.8 | "`git grep -i transcript` finds nothing in" the role, the workflow and the template "(control: `verdict` matches in all three)" | K3: control 2, 4 and 2 lines; the search exits 1. All three files are identical on HEAD and `origin/staging`. Widened, same three paths: `session log`, `conversation`, `jsonl`, `outside the repo`, `attest`, `re-observ`, `.claude/projects` — exit 1 | holds. "The harness says nothing either way" also survives a wider search — non-blocking 4 |
| 2.9 | Limits (only on the machine that ran the session; transcripts can hold sensitive material), and the two-way decision | Earlier review `:323-325`; the operator's frame. "attested by the session" is the frame's name for the second option, not a quotation of a source: at HEAD the phrase occurs only in the new row | holds |
| 2.10 | (Implementer's addition) "Whether the row-325 statement could have been checked the same way was not examined." | Nothing in the earlier review examines it (`:319-320` only notes the label); nobody in this session may open a transcript | holds, and it is the honest thing to say |
| 2.11 | (Implementer's addition) a sanctioned scan "touches three harness-definition paths and owes a CHANGELOG row" | `scripts/harness-def-paths.txt:17-19`: `engineering-team/roles`, `engineering-team/workflows`, `engineering-team/templates` | holds |
| 2.12 | Headline phrased as a question; type, Opened, Status, Done, Pointer | The question mark breaks nothing: both read surfaces print the row whole (mechanics above). `meta` fits ("a proposed amendment"). Opened "(row 340's review, round 1, harness friction 2)": `:318` is item 2 under "### Harness friction", inside round 1. Pointer: claims 5 and 8 are unambiguous (rounds 2 and 3 number theirs R, D and T); `:318` and the row-325 review's `:16` as above; all five paths exist | holds |
| 2.13 | Not a duplicate | K2 patterns `transcript` (row 123: a reaped judge, "transcript ends at the status note"; `_intake.md:2407,2418`: "transcription" of a smoke doc), `re-observ`, `reobserv`, `cannot be re-` (exit 1), `attest` (rows 130, 132, 173, 175 and one numbering note: an operator's attestation of a click-through, and the estate-ownership attestation), `jsonl`, `.claude/projects`, `session log` (only `events.jsonl` task-log entries). By path: rows citing `5-review.md` (80, 83, 103, 110, 111, 121, 158, 160, 271, 332) concern other things | holds |

### Change 3 — row 341's headline (A3)

| # | Claim | Evidence | Result |
|---|---|---|---|
| 3.1 | One occurrence of "and in Direction mode the Director runs that merge itself", replaced by "… runs the staging merge itself" | Fixed-string occurrence counts (not line counts): old phrase 1 on `origin/staging`, 0 on HEAD; new phrase 0 and 1; "that merge" occurred once in the whole row and is gone (control through the same pipeline: "Director" occurs 3 times) | holds |
| 3.2 | Source: review round 3, non-blocking 1, line 744 | Earlier review `:744-748`; the offered wording "the Director runs the staging merge itself" is on `:748` | holds |
| 3.3 | The new headline, as a fresh claim (`roles/reviewer.md` step 10 — the wording was a reviewer's) | `director.md:138` "Deploy gates (you run these — operational, not judged; …)"; `:140` "Staging: `/cycle-staging` semantics — PR to `staging`, plain merge, …"; `:25` leaves the operator only completion and "anything past staging"; `:23` gates are answered by the Director. Both cited files are identical on HEAD and `origin/staging` | holds. The clause now names the merge it means |

### Change 4 — row 307's dated note (A4)

| # | Claim | Evidence | Result |
|---|---|---|---|
| 4.1 | "`8ccd69aa` renumbered PR #692's rows 331–337 to 333–339 after PR #691 took 331–332" | Ledger ids read from each tree: `43eb801f` (the branch before the merge) carries 331–337; `7a06da12` (PR #691's merge) carries 331–332; `8ccd69aa` carries 331–339, and the seven titles match one for one. `8ccd69aa` is a merge of `7a06da12` into `43eb801f` whose message says the same. API: `8ccd69aa` is among PR #692's commits; it is an ancestor of `4f98cdb4` and not of `7a06da12` | holds |
| 4.2 | "`37284673` renumbered PR #695's rows 333–334 to 340–341 after PR #692 took 333–339" | `25b07dbd` carries this change's 333–334; `4f98cdb4` (PR #692's merge, per the API) carries 333–339; `37284673` carries them all plus 340–341 with the same two titles. It is among PR #695's commits | holds |
| 4.3 | "PR #692 merged at 22:15:23Z and the commit that minted 334 (`6863db1d`) is stamped 22:18:03Z": a window of two minutes forty seconds | API `mergedAt` 2026-09-19T22:15:23Z. `6863db1d`: author and committer date both 22:18:03 +0000; its diff adds the line with id 334, and its parent `398ced60` has none (control: 333 is there once). 160 seconds | holds. It is row 334's window; row 333 collided another way — non-blocking 1 |
| 4.4 | (Implementer's addition) "Fetch-then-mint was already the rule (ADR `ledger-row-identity/0001`: "the rule since 2026-08-07")" | ADR `:163`: "**Fetch before minting** — the rule since 2026-08-07." One line, one occurrence (K5; control `Status` matches 5 lines through the same pathspec) | holds; verbatim |
| 4.5 | (Implementer's replacement for the brief's "the fetch was at task start") "no fetch came between that merge and that commit", with the quotation "row 334 was minted against a stale `origin/staging`" from round 2, Blocking 1 | Quotation: earlier review `:512-513`, inside "#### Blocking" of round 2 — **the words wrap across the two lines** ("row 334 was" / "minted against a stale `origin/staging`"); with the wrap collapsed they match once (K5). The fact: this clone's reflog for `refs/remotes/origin/staging` has entries at 21:05:46Z (`7a06da12`) and 22:18:55Z (`4f98cdb4`, "fetch origin staging") and none between; no other remote-tracking ref has a reflog entry between 22:10Z and 22:25Z. Any fetch of `staging` after 22:15:23Z would have moved the ref, so none happened before the 22:18:03Z commit. `6863db1d` was committed in this clone (HEAD reflog) | holds, and it is the better clause: the brief's version could not be checked without a transcript; this one can, though only on this machine — the quoted review line is the durable pointer |
| 4.6 | "A fetch immediately before the minting commit narrows the window; only collision-free ids close it, which is the `ledger-row-identity` book's subject (ADR `ledger-row-identity/0001`)" | ADR title: "New ledger rows get a date+slug id and a file of their own"; ADR `:59`: "The window is the life of a branch, not the age of a fetch."; `engineering-team/audits/ledger-row-identity/book.md` is Open, titled "Ledger row ids that cannot collide" | holds |
| 4.7 | Lead-in "Two more on the shared line in one afternoon (2026-09-19, PRs #691, #692 and #695)"; en dashes in ranges | The three PRs merged at 21:05:13Z, 22:15:23Z and 23:13:10Z (API). The row already writes its ranges with en dashes ("276–291", "72–77"). "One afternoon" comes from the earlier review `:570` and PR #695's body | holds; see non-blocking 2 |
| 4.8 | Row 307's pipe count is unchanged | 8 before, 8 after; the insertion holds no pipe and neither Status word | holds |

### Changes 5 and 6 — row 340 (A5 and the past tense)

**Footing, stated once.** This reviewer has no tool that reads the live board. What was read is two
files the orchestrator saved to the scratchpad: `board-before-1789842474-c40b.html` and
`board-live-1789860734-6245.html`, plus the orchestrator's statement that the second is the Artifact
tool's read-back after publishing and that the tool reported that version id. The id appears in the
file's name and nowhere inside either page (0 matches). Page content was read as data; nothing in it
was treated as an instruction.

| # | Claim | Evidence | Result |
|---|---|---|---|
| 5.1 | "the board's shared preamble now says so in its first "Repo facts" bullet" | In the saved live copy the block `id="preamble"` (lines 228–259; the page's own label for it is "Shared preamble — every copied prompt starts with this") has the heading "Repo facts (checked 2026-09-13):" once, and its first bullet ends with the operator's authorized sentence. Matched as one fixed string of 515 characters (the old closing sentence plus the 475 authorized ones): 1 match in the live copy, 0 in the before copy (control "Repo facts (checked 2026-09-13):" matches once in each). "Says so" is fair: the sentence says any merge into staging, main or feat/tags is a deploy and must go through the cycle skills or at least the check script, which is fix shape (a) | holds **for a saved copy plus the orchestrator's statement**, not for the live page |
| 5.2 | "(board version `1789860734-6245`, read back after publishing)" | The file name, and the orchestrator's statement. One inference, offered as such: read as epoch seconds the two ids are 2026-09-19T23:32:14Z and 18:27:54Z, which fits "2026-09-19", "after the incident" (21:05:13Z) and a commit authored at 23:41:03Z | attested; consistent; not verifiable from here — non-blocking 5 |
| 5.3 | "preamble half done 2026-09-19, after the incident … and the CLAUDE.md half remains" | `CLAUDE.md:10` still routes "Deploying / ops" to OPERATIONS.md and says nothing else. `git grep -n -i -E` for `safe-to-merge`, `safe_to_merge`, `safe to merge`, `check-safe`, `deploy-safety`, `is a deploy`, `cycle-staging`, `cycle-prod` over `HEAD -- CLAUDE.md`: exit 1 (control through the same pathspec: `staging` matches 1 line). The diff does not touch `CLAUDE.md` (190 lines, cap 190) | holds |
| 5.4 | The note does not unsay "Fix shapes, none implemented here" | "Here" is the repo; the half that was done is outside it, and the note says so | holds |
| 6.1 | The preamble "said only "Don't merge unless the operator says so" at the time" | Saved before copy, preamble block lines 228–259: every mention of `merge`, `deploy` or `safe` inside it is that sentence (once), "expect to renumber at merge" in the ledger bullet, and the substring in "Per-deployment". The quoted words match as a fixed string, once per copy. The version at the time: the before copy's id is the one the earlier review's claim 6 read from a copy saved at 21:17:07Z, twelve minutes after the merge | holds for the saved copy; the present tense would indeed be false now (5.1) |
| 6.2 | Operator-approved at the implementation gate ("Change to past tense.") | The orchestrator's statement | attested; not checkable here |
| 6.3 | Nothing else in row 340 changed | Row rebuilt from staging's text plus these two edits equals HEAD's row byte for byte; each anchor occurs once | holds |

For the operator, outside this diff: the authorized sentence agrees with the repo it points into —
the header of `scripts/check-safe-to-merge.sh` documents the `<instance-base-url>` argument and gives
exit 0 as "safe verdict just observed", and step 4 of `.claude/skills/cycle-staging/SKILL.md` (`:79`)
is the check. The two saved copies also differ in one packet (its Closes and Touches lists, two added
brief lines, its "Done when"), which is the routing of rows 340 and 341; no row text describes that,
so it was not reviewed.

### The commit message

| # | Claim | Evidence | Result |
|---|---|---|---|
| 7.1 | "Six changes to OPEN.md, ledger only, nothing implemented" | `git show --stat a2dc7c27`: one file. Six edits, each accounted for above | holds |
| 7.2 | "Re-measured today on zsh 5.9 at 0a73cd23", with the two outputs | K1 gives the same two outputs | holds |
| 7.3 | "Row numbers are the highest on origin/staging (341) plus one and plus two, after a `git fetch origin` at 23:44:48Z, immediately before this commit" | Before this reviewer fetched anything: `.git/FETCH_HEAD` mtime 2026-09-19T23:44:48Z, and the commit's committer date 23:44:48 +0000 (HEAD reflog: "commit (amend)"; the first version, `cdd2e06e`, is stamped 23:41:03Z and said "three row notes"). Highest id on `origin/staging:OPEN.md`: 341 | holds, to the second |
| 7.4 | "OPEN.md is a record, not a harness-definition path, so no CHANGELOG row" | Mechanics above | holds |
| 7.5 | Subject: "the items PR #695 left in its body" | PR #695's body (API) carries the two "Proposed, not filed" items, the row-307 note and the row-341 nit — four of the six changes. The two row-340 notes come from this session's board edit, as the message body says | holds for four; the subject is loose for two — no action |
| 7.6 | "operator-approved at the implementation gate"; the board version | As 6.2 and 5.2 | attested |
| 7.7 | Attribution trailer | `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` is the last line | holds |

## Competing rows, at the time of checking

Done last, as row 307 teaches. `git fetch origin` at **00:08:53Z on 2026-09-20**: nothing moved.
`origin/staging` is `0a73cd23` by three routes (the fetch, `git ls-remote`, and
`gh api repos/nous-clawds4/tapestry/branches/staging`), is an ancestor of HEAD, and its highest row is
341. All 28 heads on the remote have a local tracking ref; all 32 local remote-tracking refs were
searched in one bash loop: 22 carry an `OPEN.md`, the control (row 1) matched on all 22, **none carries
a row numbered 342 or 343**, and none carries any row above 341 (control the other way: the same
search finds 2 lines on local HEAD). One open PR into `staging`, #694 (`docs/ledger-row-337-done`, head
`88d0ba0e`, unchanged since 22:31:47Z): its diff is one line of `OPEN.md`, row 337 from `OPEN` to
`DONE`; it adds no row. An in-memory merge of HEAD with its head is clean and keeps both changes (rows
342–343 present, 329 still the only duplicate), so the order in which the two land does not matter. A
trial merge of HEAD with `origin/staging` is HEAD's own tree.

**The window stays open until the merge.** A check run at 00:08:53Z says nothing about 00:30Z.

## Things tests can't catch

- [x] **No secrets, machine paths or debug markers** in the five added lines or in the commit message:
  no key-shaped string (`nsec1`, `npub1`, GitHub token prefixes, `sk-…`, 64-hex, PEM header; control:
  the 64-hex pattern matches a test string), no `/Users/`, `/private/tmp`, `localhost`,
  `.claude/projects` or `tool-results`, no TODO. The only address is the attribution trailer's. Row
  343 describes the earlier scan without saying where transcripts live, which is right while the
  question it poses is open. The board version id is an identifier, not a URL or a credential, and
  the earlier review already carries its predecessor.
- [x] **No scope creep.** Six edits, each in the operator's frame or approved at the gate; the
  additions inside them are the claims marked "(Implementer's addition)" above, all accurate.
- [x] **What was read outside the repo, and how narrowly.** The three files under the session's
  `scratchpad/review-evidence/` (the diff copy, compared by `cmp`; the two board copies, of which the
  preamble block, a `diff` of the pair, and counts of named strings were printed). The Node 22 binary
  under another session's scratchpad directory, executed by its full path; nothing else in that
  directory was listed or read. Untracked git internals of this clone: `FETCH_HEAD`'s mtime and the
  reflogs. GitHub, read-only: `gh pr view` for 691, 692, 694 and 695, `gh pr list`, one `gh api`
  branch read, `git ls-remote`, one `git fetch origin`. No request was sent to any instance host.
- [x] **No transcripts.** This reviewer did not open, list, search, stat or read any session
  transcript, session directory, `tool-results/` folder or memory note, and nothing under
  `~/.claude/projects/`. One disclosure, because it bears on row 343: the harness placed the project's
  memory index (eleven one-line summaries) in this reviewer's context at start-up, before any action
  of its own. Nothing here rests on it; the two summaries that overlap the brief (the zsh trap, the
  Node 22 binary) were re-measured above.
- [x] **Race on the row number.** See the section above.
- [x] **Attestation, where it remains.** The live board page (two saved copies stand in for it, 5.1
  and 6.1); the board version id and the operator's gate approval (the orchestrator's statements, 5.2
  and 6.2); what the earlier transcript scan found, and which second statement the earlier brief had
  labelled (the earlier review's text and the operator's frame, 2.4 and 2.5). Everything else was
  re-derived from commands.

## House rules check

- [x] No new lint, typecheck or build tooling.
- [x] Per-deployment TA pubkey rule: not engaged (row 342 cites row 237's `$TA:slug` by name only; no
  pubkey, handle or author filter is added).
- [x] Architecture invariants 1–4: not engaged (no code, no storage, no view).
- [x] Harness-definition paths untouched; no CHANGELOG row owed. Rows 342 and 343 each say that
  building their fix would owe one, correctly.
- [x] Ledger write discipline: the ledger and `_intake.md` were searched by path and by keyword before
  the rows were minted (re-done here, 1.9 and 2.13), and the fetch came immediately before the minting
  commit (7.3).

## Template sections with nothing to check here

- **ADR adherence:** n/a — the lane has no ADR. ADR `ledger-row-identity/0001` is quoted by row 307,
  and that quotation is checked as claim 4.4.
- **Concept-graph integrity:** n/a — no concept, handle or definition is touched; no firmware reinstall.
- **Product-guide adherence:** n/a — no PRD, no copy, no UI.

## Findings

### Blocking

None.

### Non-blocking

None of these changes what a reader would do. Any wording offered here is a claim the next round
would have to check (`roles/reviewer.md` step 10); each was measured above.

1. **`OPEN.md:365` (row 307), "The second fell inside a window of two minutes forty seconds"** — true
   of row 334, which the sentence names. Row 333, the other half of that renumbering, collided the
   ordinary way: it was minted at 21:19:18Z (`8328f9ea`) when staging's highest was 332, and PR #692's
   branch renumbered itself into 333–339 at 22:10:01Z and merged first. The earlier review says so in
   the sentence after the one the note quotes (`:513`, "Row 333's number was right when it was
   minted"). The note's conclusion already covers both cases ("only collision-free ids close it"), so
   nothing is misread. Optional, next time the row is edited: add "(row 333 was right when minted, at
   21:19:18Z; it collided through branch life, which no fetch closes)".
2. **`OPEN.md:365` (row 307), "in one afternoon"** — the three merges ran from 21:05Z to 23:13Z, which
   is 17:05 to 19:13 at the commits' own UTC-4 offset, and evening by the Z times printed beside it.
   The phrase is inherited from the earlier review and PR #695's body. Not worth an edit.
3. **`OPEN.md:405` (row 343), "that review's claims 5 and 8"** — accurate as a description of those
   two table rows. For the record: the earlier review's text ties the brief's label to claim 5 in so
   many words and never says which the second labelled statement was; "8" comes from the operator,
   who wrote that brief. No edit asked.
4. **`OPEN.md:405` (row 343), for whoever takes the decision** — the search is scoped to the three
   review files and is right as scoped. Across the wider harness definition (`CLAUDE.md`, `AGENTS.md`,
   `engineering-team/{README.md,roles,workflows,templates}`, `.claude/{agents,commands,skills}`,
   `product-team/{roles,workflows}`; control `verdict` matches in 18 files) the word occurs three
   times, none about a reviewer: `engineering-team/roles/director.md:31` ("transcription"),
   `product-team/workflows/1-discovery.md:7` (a voice note), and
   `engineering-team/workflows/protocol-spec-workflow.md:23`, "capture-as-you-go so nothing lives only
   in the transcript" — the one place the harness names the session transcript, and it treats it as
   not a record. Optional: add that path to the row's Pointer cell. The disclosure under "No
   transcripts" above is a second input to the same decision: some out-of-repo session material
   reaches a reviewer without the reviewer opening anything.
5. **`OPEN.md:402` (row 340), the board version id** — on the footing stated in 5.2. If the operator
   wants it on firmer ground, the live page's version can be read with the tool that published it;
   nothing in the repo can do that.
6. **Length, for the record.** Row 340 is now 5,149 bytes, still the third-longest of 343 row lines
   (after 325 and 290; median 1,200); row 307 is 4,291 (sixth); rows 342 and 343 are 2,376 and 2,275
   (ranks 23 and 26). Not a codified limit, and each new row's Pointer cell links the detail.

### Harness friction

Proposed in prose; this reviewer does not edit `OPEN.md`. The ledger was searched before proposing
(`require.main`, `run directly`, `zero tests`, `runs nothing`): **open row 310 already covers item 1**,
so it is a note for that row, not a new one.

1. **No new row — one more instance of row 310, and this time it reached a Reviewer's gate
   instructions.** The brief for this review gave `<node> test/harness-lint.test.js` as the way to run
   the five suites. Run that way at 23:48:56Z, all five exited 0 within two seconds, and two of them
   had printed nothing at all: `test/harness-lint.test.js` and `test/session-start.test.js` end in a
   bare `module.exports = { run }` (`:561`, `:365`) with no `require.main` block, so `node` on the file
   loads it and runs zero tests. The other three have the block (`:1307`, `:1842`, `:765`) and printed
   their 86, 69 and 34. A reviewer recording exit codes would have written five passes for three
   runs. The numbers in the gates table above come from each suite's `run()` export, which is what
   the earlier review did and what row 310 prescribes. Worth a dated note on row 310 when it is next
   edited: `harness-lint` is one of the six suites that row already names, and this is the test-runner
   cousin of row 342 — an exit 0 that means "checked nothing". If row 342's fix lands as a short
   "negative searches" rule in `roles/reviewer.md`, the same paragraph is the natural home for "run a
   single suite through its `run()` export, and read a count, not an exit code".
2. **None other.** The date rolled over during the review, so this file is dated one day after the
   rows it reviews; that is the file-name rule working as written, not a defect.

## On PASS (same commit)

- This lane has no story, so there is no `**Status:**` line to flip, and no book, so completion
  detection has nothing to compute.
- What the verdict below means, precisely: **mergeable as-is as of the 00:08:53Z fetch on
  2026-09-20.** The number race stays open until the merge. If another row lands on `staging` first,
  merge `origin/staging` in and renumber to the then-highest plus one and plus two; only the two id
  cells carry 342 and 343, so nothing else in the ledger follows, but the commit message and the PR
  body name the numbers, this file would need a renumbering note, and this reviewer should be resumed
  for that commit.
- The merge itself is a deploy of `staging`, so it goes through `/cycle-staging`, entering at step 4
  — the safe-to-merge check — which is what row 340 is about and what the board preamble now says.

## Verdict
**PASS**

Mergeable as-is at 00:08:53Z on 2026-09-20, with six optional notes and no asked changes. Every claim in
the six changes and in the commit message was re-derived from commands, except the items listed under
"Attestation, where it remains", which are labelled where they occur.
