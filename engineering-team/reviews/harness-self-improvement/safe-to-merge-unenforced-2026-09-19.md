# Review: row 333 — a deploy-triggering merge can skip the safe-to-merge check unnoticed (one new `meta` row; row 334 joined it in round 2)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19 (UTC, from `date -u`). Round 1 ran from 21:31Z to about 22:05Z; round 2 from 22:18Z
to about 22:40Z.
**Diff:** branch `docs/open-row-unenforced-safe-to-merge`, unpushed in both rounds, merge-base
`7a06da12` (PR #691's merge).
- *Round 1:* one commit, `8328f9ea`, on `7a06da12`, which was `origin/staging` after a fresh
  `git fetch origin staging`. `git show 8328f9ea` is the whole surface: `OPEN.md`, 1 insertion,
  0 deletions, line 395 (row 333, 3,948 bytes).
- *Round 2:* one more commit, `6863db1d`, on `398ced60` (round 1 of this file, committed unchanged).
  `git show 6863db1d` is the whole new surface: `OPEN.md`, 2 insertions and 1 deletion — row 333
  rewritten in place (4,884 bytes) and a new row 334 (2,104 bytes). `origin/staging` moved to
  `4f98cdb4` (PR #692) during the fix round; see round 2, Blocking 1.

**Rounds:** round 1 is kept as written at the time. The only edits to it are in this header (the
title's closing parenthesis, the Date line, this Diff block) and its verdict heading, retitled
"Round 1 verdict". Round 2 is appended below it and carries the file's final verdict.
**File:** non-numbered by convention — this lane has no story to match (`workflows/0-intake.md` §3).
**Lane:** doc / one-liner (Implementer + Reviewer, Standard strictness). No story, no ADR, no test plan
and no book, by design. The lane's record is this review.

The brief reserved the commit for the orchestrator. This reviewer created this one file and nothing
else in the repo: no `git add`, no commit, no push, no branch switch, no stash, no edit to `OPEN.md` or
any other tracked file. Scratch files lived under the session scratchpad, outside the repo. One
throwaway `git worktree` (detached at `origin/staging`, under the scratchpad) was created for the
baseline runs and removed; `git worktree list` shows only the main checkout and `git status --short`
shows only this file. Nothing was merged, no PR was opened, the operator's board was not written to.

**Short version.** The gap the row records is real and every structural claim about it survived an
attempt to falsify it: nothing in the repo, on GitHub, or in a local hook enforces or even notices the
check. The incident facts match the API to the second. The **no-harm conclusion stands** — and on one
point the evidence for it is stronger than the row says. Two sentences in the Implementer's
persisted-versus-live addition do not survive: one states a mechanism that is false for the queue
count, the other presents the task timeline as a complete instrument when the repo's own intake
record says it is not. Both are fixed by one small rewording, given below.

## Quality gates (run by reviewer, not trusted)

- [x] **`bash scripts/harness-lint.sh` on HEAD (`8328f9ea`)** — exit 0, 38 lines, last line
  `harness-lint: clean (0 violations)` (21:41:49Z). The same command in a throwaway worktree at
  `origin/staging` (`7a06da12`): exit 0, same last line, and `diff` of the two outputs is empty. The
  change adds nothing to lint.
- [x] **The five suites that open the real ledger or run the scripts that read it**, under Node
  v22.23.2 x64 (the verified binary the brief named, first on `PATH`; the host default is v16.17.0,
  below what the live suites need). Each suite run through its exported `run()` in its own child
  process. Selection checked, not assumed: string-literal uses of `OPEN.md` in code (comments
  excluded) occur in exactly `session-start`, `operational-direction`,
  `curated-dlist-update-update-preview` and `curated-dlist-update-publish`; only `harness-lint` and
  `session-start` execute `scripts/*.sh` against the repo root.

  | Suite | HEAD `8328f9ea` | `origin/staging` `7a06da12` |
  |---|---|---|
  | `test/harness-lint.test.js` | 41 pass, 0 fail | 41 pass, 0 fail |
  | `test/session-start.test.js` | 22 pass, 0 fail | 22 pass, 0 fail |
  | `test/operational-direction.test.js` | 86 pass, 0 fail, 0 skipped | 86 pass, 0 fail, 0 skipped |
  | `test/curated-dlist-update-publish.test.js` | 69 pass, 0 fail, 0 skipped | 69 pass, 0 fail, 0 skipped |
  | `test/curated-dlist-update-update-preview.test.js` | 34 pass, 0 fail, 0 skipped | 34 pass, 0 fail, 0 skipped |

  No failure on either tree, so there is nothing to attribute. `session-start` includes the
  standing real-ledger test (the reader's open-`meta` list against a whole-line oracle); it passes
  with row 333 present.
- [ ] **Full `npm test` — deliberately not run locally**, so there is no `npm run gate:status` line to
  quote. On this host the full gate takes about ten minutes and is red on every branch for sixteen
  unrelated live suites (OPEN.md row 289, read for this review). The PR's CI runs the stack-free gate
  on Node 22; that run, not a local one, is the regression check for this change. The branch was
  unpushed at review time, so that run does not exist yet.
- [ ] `npm run test:playwright` — not applicable (no browser or UI surface).
- [ ] _Lint, typecheck, build: not configured — skipped._
- [x] **With this file present** (checked after it was written): `awk -f scripts/lib/review-verdict.awk`
  on it prints `CR`; the only two heading-or-bold lines carrying a verdict token are the "On PASS"
  heading and, after it, the verdict line. `bash scripts/harness-lint.sh` again exits 0 with the same
  last line; its output gains exactly one line, the expected `INFO non-numbered-review` for this file.
  No suite scans the real reviews directory, so the five suites were not re-run.

**Row mechanics** (a bash script, because `scripts/lib/collect-meta.sh` finds its sibling through
`BASH_SOURCE`; this host's `awk` counts `length` in bytes):

- One line matches `^| 333 |`. 8 pipe characters, 0 escaped pipes, `awk -F'|'` gives NF 9: seven
  cells. Cells: `333` / `meta` / Item (3,693 bytes) / Opened (74 bytes) / `OPEN` / empty / Pointer
  (149 bytes).
- The word `OPEN` occurs once in the whole row (the Status cell) and `DONE` not at all, so the
  reader's Status-by-value rule has exactly one cell to find, at field 6.
- The reader's own awk block (`collect-meta.sh:41-46`) applied to the row: emits it, with Opened
  ` 2026-09-19 (packet ...) `, which parses to age 0d.
- Meta count, same reader, same clock, `OPEN.md` plus `_intake.md` extracted from each ref into a
  temp dir: **111 before, 112 after**; the one line present after and not before is row 333. The
  merging session's own session-start digest had printed 111 on `7a06da12`.
- `bash scripts/whats-open.sh` (exit 0, 396,415 bytes): row 333 is the last line of the ledger
  section (line 242) and appears in "Meta items" as `[0d] | 333 | meta | ...` (line 356); the banner
  reads 112. The script left the tree clean.
- Row number: highest on `origin/staging` after the fresh fetch is 332. `gh pr list --base staging
  --state open` returns `[]`, and no `origin/*` ref carries a row numbered 333. Renumbering at merge
  remains possible, as the commit message says. (Row number 329 appears twice at HEAD; it does on
  `origin/staging` too, lines 390-391, and ADR `ledger-row-identity/0001:29` already records it. Not
  this change's doing.)
- `git diff --check`: clean. `OPEN.md` is not in `scripts/harness-def-paths.txt` and the commit
  touches nothing else, so no CHANGELOG row is owed.

**Doc-facing checks.** Every repo path the row cites exists (`docs/SAFE_TO_MERGE.md`,
`scripts/check-safe-to-merge.sh`, `.github/workflows/deploy-staging.yml`,
`.claude/skills/cycle-staging/SKILL.md`, `docker-compose.yml`, `scripts/harness-budgets.txt`,
`engineering-team/README.md`, the three root orientation files). ADR `deploy-safety-gate/0002`
resolves to
`engineering-team/decisions/deploy-safety-gate/0002-safe-to-merge-check-script-and-shared-recipe.md`.
Story `ledger-row-identity` #2 exists and is Done. Rows 209, 256, 277 exist. PR #691, run
35469346027 and both URLs resolve (HTTP 200 on all four endpoints).

## Claims adherence — each claim, with the command that tried to falsify it

Two definitions used below. **Pattern W** (case-insensitive) is wider than the row's own two patterns,
because `safe-to-merge` with hyphens cannot match `SAFE_TO_MERGE.md`:

```
safe-to-merge|safe_to_merge|safe to merge|check-safe|deploy-safety|deploysafety|safetodeploy
```

**Scope S** is the row's own list: `CLAUDE.md AGENTS.md OPERATIONS.md engineering-team/README.md
engineering-team/roles engineering-team/workflows .claude/commands .claude/agents` — 50 tracked files.

| # | Claim in row 333 | Evidence gathered by this reviewer | Result |
|---|---|---|---|
| 1 | The doc makes `scripts/check-safe-to-merge.sh <instance>` the immediate precursor of every merge into `staging`, `main` or `feat/tags`, because the merge recreates the container and kills in-flight scheduled tasks | `docs/SAFE_TO_MERGE.md:13` ("recreates that instance's container, killing any in-flight scheduled task"), `:15` ("as the immediate precursor of any deploy-triggering merge"), `:20`, branch map `:33-37` | holds. `:41` names a fourth deploy-triggering branch, `feature-magic-carpet`, as not covered — see non-blocking 4 |
| 2 | "Carried only by that doc and by the cycle skills (`/cycle-staging` step 4 and `/cycle-prod` step 4; `/cycle-full` delegates to them)" | `git grep -i -l -E W -- .` → 96 tracked files: 1 doc, 3 skills, the check script, 5 source/UI files (the endpoint and its consumers), 10 test files, and 76 records (35 audits, 15 stories, 13 reviews, 8 ADRs, 3 epics, CHANGELOG, OPEN.md). No orientation doc, role, workflow, command, agent or `.github` file. Step numbers: `cycle-staging/SKILL.md:79` and `cycle-prod/SKILL.md:83` are both `### 4. Safe-to-merge check`; `cycle-full/SKILL.md:50,75,108` delegate; doc `:39` says so. `cycle-local` and `direct-feature`: no match | holds for the repo. Outside it, a machine-local memory note written by the merging session at 21:09:45Z now carries the rule on this one machine; that is not a harness surface and the row is right not to count it |
| 3 | "Nothing enforces it at merge time": `deploy-staging.yml` neither checks nor logs a verdict; no deploy workflow mentions the endpoint; `gh pr merge` works without it | Read all 36 lines of `deploy-staging.yml`: checkout, pull, `sed`, `docker compose up -d --build`, prune. `git grep -i -n -E` for W or the bare word `safe`, over `.github` → one hit, "less-safe" in a comment (`guard-main-source.yml:7`). Positive control: `curl` or `docker` or `ssh` matches in 5 of the 6 workflow files. Run 35469346027's log: zero lines match `deploy-safety`, `safeToDeploy`, `safe-to-merge` or `verdict` (control: 44 lines match `docker` or `Container`). GitHub: `gh api .../rulesets` → two (`main-requires-pr-before-merging`, `restrict-deletions`); `gh api .../rules/branches/staging` → `deletion` and `non_fast_forward` only; classic protection is 404 on `staging`, `main`, `feat/tags` and `feature-magic-carpet`; `main`'s required checks are `stack-free` and `main-source-guard`; `feat/tags` has no rules at all. Local: `.claude/settings.json` holds one hook (SessionStart); no `settings.local.json`; no non-sample git hook, no `core.hooksPath`; nothing under `scripts/` but the check script names the check or the endpoint (control: 6 matches inside that script) | holds. PR #691 is itself the existence proof |
| 4 | "By design": § Limits calls the gate procedural; ADR 0002 ruled CI-side enforcement out of scope at intake, adding "if procedure proves insufficient, that is the escalation path" | Doc `:76`: "the gate is procedural by design (CI-side enforcement was ruled out of scope at intake)". `grep -nF` of the quoted words in ADR 0002 → one hit, `:95`, verbatim; `:122` repeats it under Out of scope ("ratified out of scope; the gate is procedural") | holds; quotation verbatim. The ruling itself was made at intake (`engineering-team/stories/_intake.md:1616`) and the ADR records it — non-blocking 1 |
| 5 | A work-packet session (packet `h-meta-count-pipes`, story `ledger-row-identity` #2) was told "merge it" and merged PR #691 into `staging` at 21:05:13Z (merge commit `7a06da12`) without running the check | `gh pr view 691 --json ...`: `mergedAt` 2026-09-19T21:05:13Z, `mergeCommit.oid` `7a06da12d4d5...`, base `staging`, head `fix/meta-count-pipes`, title ends "(ledger-row-identity #2)". The brief called "merge it" unobservable. It is not: the merging session's transcript is on this machine (session `5d02cb1c`). A targeted scan of the whole transcript — the operator's typed messages containing the phrase, commands naming the check script or the endpoint, `gh pr merge` commands — shows the operator's message `merge it` at 21:04:07Z, `gh pr merge 691 --merge --delete-branch` issued at 21:04:41Z, and the first command anywhere in the session naming the check or the endpoint at 21:06:35Z, after the merge. The session's opening message is the packet prompt; the saved board copy files that packet as `ledger-row-identity` #2 | holds, and on better footing than attestation |
| 6 | The packet preamble on the board "says only" the quoted sentence about merging | The saved copy the brief named (`tool-results/artifact-bdec1a17-1789842474-c40b.html` under session `40ccf1bb`, mtime 21:17:07Z): the `id="preamble"` block is 32 lines; one line mentions merging, and it ends "Don't merge unless the operator says so." — one occurrence in the page. Every `safe-to-merge`, `SAFE_TO_MERGE`, `cycle-staging` and `cycle-prod` string in the page sits in another packet (`h-deploy-skills`, `deploy-concurrency`, `h-book-anchor`), none inside the preamble | holds **for a saved copy**, not the live page. The copy postdates the merge by twelve minutes; the preamble dates itself "checked 2026-09-13", which makes an edit in between unlikely but is not proof |
| 7 | CLAUDE.md routes "Deploying / ops" to OPERATIONS.md; OPERATIONS.md does not name the check; `git grep -i` for the two patterns finds nothing in the listed files | `CLAUDE.md:10` verbatim. `git grep -i -n -e safe-to-merge` and `-e deploy-safety` over Scope S: exit 1 each. Pattern W over Scope S: exit 1. Controls: W matches 6 times in the doc and 5 in `cycle-staging/SKILL.md`; Scope S is non-empty and greppable (`staging` matches 38 times in OPERATIONS.md). OPERATIONS.md names the cycle skills only in passing (`:381`, `:758`, `:815-816`), never as the merge procedure | holds. "A session that thinks of the action as 'merging a harness-only PR' never goes there" is interpretation, supported by this one incident |
| 8 | Run 35469346027 fired on the merge commit and recreated the container; the merging session saw 502 for about a minute, then healthy | `gh run view 35469346027 --json ...`: workflow "Deploy to Staging", event `push`, branch `staging`, `headSha` = the merge commit, created 21:05:15Z (two seconds after the merge), job 21:05:18Z–21:06:46Z, success. Run log: `Container tapestry Recreate` 21:06:16Z, `Recreated` 21:06:31Z, `Started` 21:06:43Z. Transcript: one nginx 502 at 21:06:36Z, three 200s at 21:07:17Z. The outage is therefore bounded by 21:06:16Z and 21:07:17Z: at most 61 seconds. Row 325 describes the 502 expected on a deploy | holds. "Recreated" is from the log, not inferred (`docker compose up -d --build` recreates only when the image changed). Wording: non-blocking 3 |
| 9 | "No harm that time, established only afterwards" from three reads, re-read 21:15Z: 4 entries all disabled; `enabledEntryCount: 0`, no active queue tasks, no legacy in-flight; timeline 0 executions in 24 hours | The 21:15Z responses are still on disk in the launching session's scratchpad (status `checkedAt` 21:15:14.715Z). This reviewer's reads at 21:34:09Z: the list is byte-identical (`cmp`); the timeline is identical apart from its two timestamps (`totalExecutions: 0`, window 09-18T21:34Z to 09-19T21:34Z, which spans the recreate); the status differs only in `checkedAt`. The merging session's first reads (21:07:23Z–21:08:31Z) show the same numbers. "Only afterwards": first endpoint call in the transcript is 21:06:35Z | holds as transcription. See "later readings" below the table |
| 10a | The schedule config and the task event log are on persisted volumes (`tapestry-data`, `tapestry-logs`) | `src/api/scheduled-tasks/index.js:32-34` (`/var/lib/brainstorm/scheduled-tasks.json`, `/var/log/brainstorm/taskQueue/events.jsonl`); `src/api/neo4j-health/getTaskTimeline.js:47-49,94`; `docker-compose.yml:33-34` mounts both directories on the named volumes declared at `:94-95`; no env override of either path in the compose file. The run log's container set (`tapestry`, `tapestry-redis`, `nostr-search-meili`, `nostr-search-api`) is that file's four services | holds for the repo's compose file. Whether the droplet's environment selects another file cannot be seen from here; 10b's evidence that a June log and a non-seed config outlived the recreate is the direct proof of persistence |
| 10b | "so the schedule … reading describe[s] the state before the recreate too" | Supported three ways from the list reading itself. A missing config file seeds exactly two entries, both `seed:*` (`index.js:41-71,120-125`); the reading has four, none `seed:*`, so the file survived. The only automatic writer of `enabled: false` stamps `lastError` (`src/manage/taskQueue/queue/entryResolver.js:217-233`); no entry carries one. And every entry's `timer.lastRunAt` is 2026-06-07 — read from the whole current event log with no window and no allow-list (`index.js:206-215,296,304`) — which also shows the log survived, since a post-recreate read still returns June events | holds, with one unstated limit: an operator's schedule update writes no timestamp (`index.js:405-445`), so a change made after the recreate would leave no trace in these reads |
| 10c | "so the … timeline reading describe[s] the state before the recreate too" | The timeline counts only events whose `taskName` is one of 21 hard-coded names (`getTaskTimeline.js:14-45`: 22 literals, `prepareNeo4jForCustomerData` twice); anything else is dropped (`:161-164`). `refreshSearchIndex` and `reconcileAll` — two of the four task types on the schedule this row describes — emit only under their own names (`src/algos/refreshSearchIndex.sh:30`, `src/pipeline/reconciliation/reconcileAll.sh:96`) and have no children in the task registry, so they can never appear. `updateAllScoresForOwner` is not tracked either but would surface through tracked children. For a tracked name the inference is sound: a started-but-killed task leaves an unmatched `TASK_START` and is returned as `ongoing: true` (`:197-208`), and the log is rotated by size on emit, never at boot (`src/utils/structuredLogging.sh:242-294`). The repo already says the instrument is partial: `_intake.md:323`, "scoped to ~22 hardcoded 'DB-intensive' tasks … not general-purpose task visibility" | **overclaims — Blocking 2** |
| 10d | "the queue and in-flight counts are live state and describe only the new container" | True of the legacy count: in-process memory, cleared by any restart (`src/api/deploy-safety/index.js:160-162`). False of the queue count: it is `q.getActive()` on Redis (`:124`; header `:79-80`, "only Redis reads"), staging's queue is enabled (`queue.enabled: true` in every reading), and the run log shows `Container tapestry-redis Running` — left running, not recreated — beside `Container tapestry Recreate`. ADR `deploy-safety-gate/0001:129` records the consequence: a killed active job "can read as BullMQ-active until stall recovery re-queues it once workers reboot" | **false as to the queue — Blocking 1** |
| 11 | Production showed `schedule.enabledEntryCount: 3` at 21:17Z; the same slip there "would not be harmless by default" | Saved response, `checkedAt` 21:17:01.967Z: 3 enabled, next fire `legacy:refreshSearchIndex` at 22:09:38.497Z. This reviewer at 21:34:10Z: 3, same next fire. Row 73 and two earlier reviews in this folder record 3 on production and 0 on staging | holds. Production's next fire is a task type the timeline cannot see, which is what gives Blocking 2 its weight |
| 12 | Fix (a) caveat: CLAUDE.md sits at its 190-line cap, "so a line there has to be freed for it" | `wc -l CLAUDE.md` → 190; `scripts/harness-budgets.txt:16` → 190; L11 counts lines (`harness-lint.sh:294`, `wc -l`) | the cap is right; the consequence is conditional — non-blocking 2 |
| 13 | Fix (b) caveat: the merge has landed by then, so a refusal leaves the branch ahead of its instance until a re-run | All four deploy workflows trigger `on: push` to their branch; none has any other trigger | holds |
| 14 | Fix (c) caveat: a check that passed when the PR opened can be stale at merge time; the doc's staleness rule is 5 minutes | `docs/SAFE_TO_MERGE.md:29`, "more than **5 minutes**"; `test.yml` runs `on: pull_request`, not at merge | holds |
| 15 | "Fix shapes, none implemented here" | The diff is one inserted line in `OPEN.md` | holds |
| 16 | Ledger conventions: type, Opened form, Status, Done, Pointer | § "How to use this ledger": `meta` is a listed type and fits ("a process defect"); Opened is an ISO date plus the packet and PR; Status is exactly `OPEN`; Done is empty; the Pointer cell matches the brief item for item | holds |
| 17 | Not a duplicate | Rows 73, 145, 170, 209, 256, 277 read in full. 73 (closed): the tags instance could not answer the check. 145 (closed): an outage flush queue that ran the check before each merge. 170: a network filter made the check exit 2. 209 and 256: the cycle skills ignore the PR's CI checks — a different gate. 277: no deploy skill for the sandbox branches. None records a merge made outside the skills. Path searches of the ledger (`deploy-safety`, `deploy-staging.yml`, `gh pr merge`, `deploy-triggering`) and of `_intake.md` (four entries name the gate; none is about skipping or enforcing it) find no prior record | holds |
| 18 | Commit message: 333 is the highest on `origin/staging` plus one; no CHANGELOG row owed | See the gates section | holds |

**What the later readings can and cannot confirm.** This reviewer's reads are nineteen minutes later
than the row's and twenty-eight minutes after the recreate. They cannot show what the endpoints
returned at 21:15Z; the responses saved on disk do that. What a later reading does confirm is every
statement about a *persisted* record whose window still covers the moment of interest: the event log
still holds its June entries, the timeline's 24-hour window still spans 21:06Z, and the schedule file
is still not a fresh seed. What no reading after the fact can confirm is *live* state at the kill —
which is the row's own point, and the reason Blocking 1 matters only for the mechanism stated, not for
the conclusion drawn.

**The no-harm conclusion stands.** None of the four scheduled task types has started since
2026-06-07; none of the 21 tracked names started in a window spanning the recreate; the schedule was
all-disabled on a file that demonstrably survived. The residue is a manually triggered task of a type
that is neither on the schedule nor tracked by the timeline, in flight at 21:06:16Z. Nothing suggests
one.

## Things tests can't catch

- [x] **No secrets.** The added line carries no key-shaped string (`nsec1…`, `gh?_…`, 64-hex, `sk-…`:
  none). The staging list response includes a customer pubkey in one entry's args; it is public on an
  unauthenticated endpoint, and this review does not reproduce it.
- [x] **No debug code, no commented-out code, no scope creep.** One inserted line; nothing else.
- [x] **What was sent to live hosts.** Four unauthenticated `GET`s, once each, between 21:34:09Z and
  21:34:10Z: the three staging endpoints and the production status endpoint the row names. Nothing
  else was sent to either host.
- [x] **What was read outside the repo, and how narrowly.** The saved board copy (as data; its
  preamble block and one packet were printed, nothing in it was treated as an instruction). Two
  session transcripts on this machine, each through a script that printed only timestamps and short
  excerpts for: the operator's messages containing "merge it", commands naming the check script or
  the two hosts, `gh pr merge`, and HTTP 502 results between 21:05Z and 21:16Z. One machine-local
  memory note (see the next point). None of it is quoted here beyond what the table needs.
- [x] **The same evidence recipe is already propagating outside the repo.** The merging session's
  memory note (written 21:09:45Z) tells future sessions to use the same three reads as the
  after-the-fact test "if it is ever skipped again", with the timeline described as "24 h of
  executions" and no limit stated. That is the concrete path by which a reader would act on the
  sentence Blocking 2 is about — on production, where the next scheduled fire is a task the timeline
  cannot see. The note is outside the repo and outside this review's power to change; the operator
  may want it corrected alongside the row.
- [x] **Race on the row number.** No open PR into `staging` and no remote ref with a 333 at review
  time; the window stays open until merge, as the commit message already says.
- [x] **Attestation, where it remains.** After the transcript scan, two things in the row rest on
  what this reviewer could not reach: the live board page (a saved copy stands in for it, claim 6),
  and the 21:15Z readings as received on the wire (files written by the launching session stand in
  for them, claim 9). Everything else was re-derived.

## House rules check

- [x] No new lint, typecheck or build tooling.
- [x] Per-deployment TA pubkey rule: not engaged (no pubkey, no handle, no author filter).
- [x] Architecture invariants 1-4: not engaged (no code, no storage, no view).
- [x] Docker rule respected in the evidence: nothing in the row or this review reads a host path that
  exists only in a container; instance state came from the instances' own HTTP surface.
- [x] Harness-definition paths untouched; no CHANGELOG row owed.

## Template sections with nothing to check here

- **ADR adherence:** n/a — the lane has no ADR. ADR `deploy-safety-gate/0002` is quoted by the row, and
  that quotation is checked as claim 4.
- **Concept-graph integrity:** n/a — no concept, handle or definition is touched; no firmware reinstall.
- **Product-guide adherence:** n/a — no PRD, no copy, no UI.

## Findings

### Blocking

Both are in the same two-sentence passage, one of the Implementer's additions to the brief. One edit
answers both.

1. **`OPEN.md:395`, "the queue and in-flight counts are live state and describe only the new
   container"** — false for the queue count. The legacy in-flight count is in-process memory and the
   statement is right for it. The queue count is read from Redis (`src/api/deploy-safety/index.js:124`),
   staging's queue is enabled, and run 35469346027's own log shows the Redis container was left
   `Running` while `tapestry` was recreated. ADR `deploy-safety-gate/0001:129` says what follows: a job
   killed with the old container can still read as active afterwards, until stall recovery re-queues
   it. The row's *use* of the sentence — do not take these two counts as evidence about the moment of
   the kill — is sound; the *mechanism* it gives is wrong, and it contradicts an ADR a reader
   following the pointers will reach. Asked change: see the replacement below.

2. **`OPEN.md:395`, "`/api/neo4j-health/task-timeline` showed 0 executions in the previous 24 hours"
   together with "so the schedule and timeline readings describe the state before the recreate too"**
   — overclaims. The reading is transcribed correctly, but the endpoint counts only 21 hard-coded task
   names and can never show `refreshSearchIndex` or `reconcileAll`: half the task types on the very
   schedule the row describes. The repo's own record calls the instrument partial
   (`engineering-team/stories/_intake.md:323`). A reader will act on this: the row models how to
   establish harm after a skipped check, the merging session's memory note already prescribes reusing
   it, and on production "the timeline showed nothing" would say nothing about a killed
   `refreshSearchIndex` run — which is production's next scheduled fire. The stronger evidence is in a
   reading the row already cites and does not use: every entry's `timer.lastRunAt` is 2026-06-07,
   read from the whole event log.

   **Asked change (answers 1 and 2).** Replace

   > `/api/scheduled-tasks/list` showed 4 entries, all disabled;

   with

   > `/api/scheduled-tasks/list` showed 4 entries, all disabled, each with `timer.lastRunAt` on 2026-06-07;

   and replace

   > so the schedule and timeline readings describe the state before the recreate too; the queue and in-flight counts are live state and describe only the new container.

   with

   > so the list and timeline readings reach back before the recreate; the timeline tracks only 21 hard-coded task names (not `refreshSearchIndex` or `reconcileAll`, for which `lastRunAt` is the evidence). Of the two live counts, the legacy one is in-process memory; the queue's is held in Redis, which this deploy left running. Neither records what was active at the kill.

   Measured on a copy of the row: each original passage occurs exactly once; after both replacements
   the row is 4,195 bytes (247 more), still has 8 pipes, and still holds the Status word once. Every
   clause in the replacement was checked as a claim for this review (table rows 10b-10d); a second
   round should check it again rather than recognise it (`roles/reviewer.md` step 10).

### Non-blocking

1. **`OPEN.md:395`, "ADR `deploy-safety-gate/0002` ruled CI-side enforcement out of scope at intake"**
   — the ruling was made at intake (`_intake.md:1616`, the 2026-07-18 entry's Out of scope list); the
   ADR records and ratifies it (`0002:95`, `:122`). The quoted sentence also sits in a Consequences
   bullet about proceeding *after a stop*, with the general statement at `:122`. Optional: "ADR
   `deploy-safety-gate/0002` records that CI-side enforcement was ruled out of scope at intake, adding …".
2. **Fix (a) caveat, "so a line there has to be freed for it"** — only if the fix adds a line. L11
   counts lines, and rewording the existing `Deploying / ops` row in place adds none. Optional: "…at
   its 190-line cap in `scripts/harness-budgets.txt`: a new line has to be paid for by freeing one,
   though rewording the existing `Deploying / ops` row adds none".
3. **"(the merging session saw 502 for about a minute, then healthy)"** — the session sampled one 502
   (21:06:36Z) and three 200s forty-one seconds later; the run log bounds the outage at 61 seconds.
   "About a minute" is a fair upper bound, not an observation. Optional: "(the merging session saw a
   502 at 21:06:36Z and 200s from 21:07:17Z)".
4. **Three branches, four deploy workflows.** The headline says "a deploy-triggering branch"; the body
   and fix (a) list the doc's covered three. `feature-magic-carpet` also deploys on push
   (`deploy-magic-carpet.yml`) and the doc says it is "not covered today" (`:41`). Whoever builds fix
   (b) will meet four workflows. Optional, in fix (b): "the deploy workflows (four; the doc covers
   three of their instances)".
5. **Length and pointer.** At 3,948 bytes the row is the fifth-longest of 333 (median 1,213; rows 331
   and 332 are 1,761 and 1,570). The ledger's rule is "keep it one line; link to detail if it has
   any", and the detail now has a home. Optional: add this review's path to the Pointer cell; if the
   row is ever trimmed, the evidence block is the part this review duplicates.
6. **A fourth fix shape the row does not list** (the brief fixed the list at three, so this is for the
   operator, not an ask of the Implementer). The always-in-context surfaces that already speak of
   merging into a deploy branch are the cycle skills' trigger descriptions. cycle-staging's
   (`.claude/skills/cycle-staging/SKILL.md:3`) offers "ship it to staging", "push the PR", "deploy
   this", "let's get this on staging", and its procedure starts at push and open-PR. Nothing covers
   "the PR is already open — merge it", which is the trigger this incident had. An entry for that
   case, entering at step 4, is a smaller change than any of (a)-(c).

### Harness friction

Each is a proposed `meta` row, in prose; this reviewer does not edit `OPEN.md`. The ledger was
searched before proposing either (`direct-feature`, `director.md`, `transcript`, `attestation`): no
existing row covers them.

1. **The Director's inline copy of the staging chain omits the safe-to-merge step.**
   `.claude/skills/direct-feature/SKILL.md:68` and `engineering-team/roles/director.md:140` both
   restate the chain as "PR to `staging`, plain merge, watch `deploy-staging.yml`, five-tier smoke".
   Both lines date from 2026-06-10 (`3a2657b2`), five weeks before the gate shipped. ADR
   `deploy-safety-gate/0002` judged exactly this structure in `cycle-full` "the structural risk for
   AC-4" — an agent following the inline summary reaches the merge with no check named on its path —
   and required the check to be named there; `test/safe-to-merge-check.test.js` C6 pins `cycle-full`
   only. Neither that ADR nor its story mentions `direct-feature`, `director.md` or the Director; the
   story's review names the Director once (`:104`), about commit lanes, not about this summary.
   Direction mode merges into `staging` with no human at the gate, so nobody is there to notice the
   omission. Fix shape: name the check by delegation in both inline summaries (no recipe text),
   extend C6 to them; a harness-definition change, so a CHANGELOG row. Related: row 333.
2. **Reviews label a session's own observations "attestation, cannot be re-observed" when the session's
   transcript is on the same disk.** The brief for this review said so of two statements; the
   row-325 review in this folder says the same of a smoke transcript. Both statements here were
   checkable in one targeted scan, to the second. Nothing in `roles/reviewer.md`, `workflows/5-review.md`
   or the review template says that transcripts exist, where they live, or what a proportionate scan
   looks like (named strings, a time window, timestamps and short excerpts only). It works only when
   the reviewer runs on the machine that ran the session, and transcripts can hold sensitive
   material, so whether to codify it is the operator's call; the lesson is that "unobservable" was
   asserted, not checked.

## On PASS (same commit)

Not reached. For the record, were the verdict otherwise: this lane has no story, so there is no
`**Status:**` line to flip, and no book, so completion detection has nothing to compute.

## Round 1 verdict
**CHANGES_REQUESTED**

One passage needs rewording (Blocking 1 and 2, one edit); the replacement text is given above. Every
other claim in the row was verified, and the conclusion that the PR #691 deploy harmed nothing on
staging holds.

## Round 2 — 2026-09-19, 22:18Z to about 22:40Z (UTC, from `date -u`)

**Surface.** One new commit, `6863db1d` ("answer the row-333 review (round 1) and add row 334",
committed 22:18:03Z), on `398ced60` (round 1 of this review, committed unchanged by the orchestrator)
and `8328f9ea`. `git show 6863db1d` is the whole new surface: `OPEN.md`, 2 insertions and 1 deletion —
row 333 rewritten in place and a new row 334. Every other line of `OPEN.md` is byte-identical between
`8328f9ea` and `6863db1d`.

**What the brief for this round changed.** The operator approved three additions beyond the original
brief: this review's path in row 333's Pointer cell, a fourth fix shape (d), and round 1's friction
item 1 filed as its own row. The original brief's "one new row", "three fix shapes" and exact Pointer
cell are therefore exceeded knowingly; the additions are judged here on accuracy, not on the count.
Round 1's friction item 2 (transcripts) is deliberately not filed.

**What this reviewer touched.** This file only. Round 1 above is left as written at the time: the only
edits to it are in the header (the title's closing parenthesis, the Date line, the Diff block) and the
old verdict heading, retitled "Round 1 verdict" so that the parser's last token is this round's. No `git add`, commit, push, branch switch or
stash; no edit to `OPEN.md` or any other tracked file; no worktree this round. Two side effects, stated
for completeness: `git fetch` updated the remote-tracking refs (the brief asked for the fetch), and the
in-memory trial merge (`git merge-tree --write-tree`) left one unreferenced tree object in the object
database — no ref, index or working-tree change. Scratch files lived under the session scratchpad and
were removed. Live hosts: two unauthenticated `GET`s at 22:31:03Z (staging's list and status), nothing
else. No session transcript was opened this round; the 502 timestamps now in row 333 are this
reviewer's round-1 observation (see claim R2 below).

**Short version.** Both blocking findings were answered correctly, and every changed passage in row 333
and every clause of row 334 survived a fresh attempt to falsify it — including the clauses that are
this reviewer's own round-1 wording, two of which turn out loose and are corrected below as
non-blocking. One thing stops the branch: `origin/staging` moved at 22:15:23Z, two minutes forty
seconds before the fix commit, and took ledger numbers 333 to 339. This change's two rows now carry
numbers that belong to unrelated rows on the shared line, the branch conflicts in `OPEN.md`, and four
cross-references inside the rows would point at the wrong rows after a merge. The fix is mechanical.

### Quality gates (round 2)

- [x] **`bash scripts/harness-lint.sh` at HEAD (`6863db1d`)** — exit 0, 39 lines, last line
  `harness-lint: clean (0 violations)` (22:26:23Z). The extra line against round 1's 38 is the expected
  `INFO non-numbered-review` for this file, now tracked.
- [x] **The same five suites, same Node v22.23.2 x64, at `6863db1d`** (they read the real ledger, and
  it changed): `harness-lint` 41 pass, `session-start` 22 pass, `operational-direction` 86 pass / 0
  skipped, `curated-dlist-update-publish` 69 pass / 0 skipped, `curated-dlist-update-update-preview`
  34 pass / 0 skipped; 0 failures. Identical to round 1 on both trees, so no baseline run was needed.
- [ ] **Full `npm test` — again deliberately not run locally**, for the reason given in round 1 (row
  289); no `npm run gate:status` line to quote. The branch is still unpushed, so no CI run exists.
- [x] `git diff --check 7a06da12 HEAD`: clean.
- [x] **With this file as now written** (checked after writing): `awk -f scripts/lib/review-verdict.awk`
  prints `CR`; the last heading-or-bold line carrying a verdict token is this round's verdict line.
  `bash scripts/harness-lint.sh` exits 0 with the same last line and the same 39 lines.

**Row mechanics, both rows** (bash script; this host's `awk` counts bytes):

| | Row 333 | Row 334 |
|---|---|---|
| Lines matching `^\| N \|` | 1 | 1 |
| Bytes | 4,884 (round 1: 3,948) | 2,104 |
| Pipe characters / escaped pipes / `awk` NF | 8 / 0 / 9 | 8 / 0 / 9 |
| Cells: Item / Opened / Status / Done / Pointer (bytes) | 4,498 / 74 / `OPEN` / empty / 280 | 1,683 / 49 / `OPEN` / empty / 340 |
| `OPEN` as whole word / as substring | 1 / 1 | 1 / 1 |
| `DONE` as whole word / as substring | 0 / 0 | 0 / 0 |
| Status found by value | one cell, field 6 | one cell, field 6 |
| Reader's awk block (`collect-meta.sh:41-46`) | emits it, age 0d | emits it, age 0d |

(The first column's pattern is written with escaped pipes only so that this table renders.)

- **Meta count**, same reader, same clock: merge-base `7a06da12` **111**, HEAD `6863db1d` **113**; the
  two lines present at HEAD and not at the merge-base are rows 333 and 334. The new `origin/staging`
  (`4f98cdb4`) reads 115 on its own: four of its seven new rows are `meta` (its 333, 334, 338, 339).
- **`bash scripts/whats-open.sh`** (exit 0, 400,268 bytes): both rows close the ledger section (lines
  242-243) and appear under "Meta items" as `[0d]` (lines 357-358); the banner reads 113. The script
  left the tree clean.
- **Fresh fetch and competing rows:** see Blocking 1. No open PR into `staging` (`gh pr list` → `[]`).
- **Method note — a vacuous negative, caught.** This reviewer's first run of row 334's universal
  negative put the two paths in one unquoted variable. The Bash tool's shell is zsh, which does not
  word-split an unquoted parameter, so `git grep … -- $FILES` searched one nonexistent pathspec and
  "found nothing" for the wrong reason. The positive control (`cycle-staging` must match in both
  files) printed nothing and exposed it; the search was re-run under `bash -c` with the control
  first (3 and 2 matches). Round 1's searches used literal paths or command substitution, which zsh
  does split; they are unaffected. Plain `grep` in this environment is a wrapper that honors
  `.gitignore` (row 165); every negative here rests on `git grep` with a control or on real `grep`
  inside `bash -c`.

### What changed in row 333 (token-level diff, `8328f9ea` → `6863db1d`)

Seven hunks, each one an announced change; the rest of the row is byte-identical, so everything
round 1 verified still reads as it did.

1. "ruled CI-side enforcement" → "records that CI-side enforcement was ruled" (non-blocking 1).
2. "502 for about a minute, then healthy" → "a 502 at 21:06:36Z and 200s from 21:07:17Z" (non-blocking 3).
3. "disabled;" → "disabled, each with `timer.lastRunAt` on 2026-06-07;" (blocking 2).
4. The persisted-versus-live passage, replaced with round 1's wording (blocking 1 and 2).
5. The line-cap caveat made conditional, and "(four; the doc covers three of their instances)" added
   to fix (b) (non-blocking 2 and 4).
6. Fix shape (d) appended (non-blocking 6, operator-approved).
7. Pointer cell: "277." → "277 and 334; `engineering-team/reviews/…/safe-to-merge-unenforced-2026-09-19.md`
   (the evidence, claim by claim)." (non-blocking 5, operator-approved).

### Claims adherence (round 2) — row 333's changed passages

Checked as claims, not recognised as this reviewer's wording (`roles/reviewer.md` step 10).

| # | Passage | Evidence gathered this round | Result |
|---|---|---|---|
| R1 | ADR 0002 "records that CI-side enforcement was ruled out of scope at intake, adding" the quoted sentence | ADR `0002:95` still reads "CI-side enforcement is explicitly out of scope at intake; if procedure proves insufficient, that is the escalation path."; the ruling's origin is `_intake.md:1616` | holds |
| R2 | "the merging session saw a 502 at 21:06:36Z and 200s from 21:07:17Z" | **Whose observation:** this reviewer's, from round 1's targeted scan of the merging session's transcript (claim 8 above). The Implementer did not re-read the transcript; the row repeats the two timestamps round 1 recorded, and they match that record exactly. The run log, fetched again this round, still brackets them: `Container tapestry Recreate` 21:06:16Z, `Started` 21:06:43Z. "From" is fair: round 1's scan found no later 502 in the window it covered (21:05Z-21:16Z); the reads after 21:07:17Z were 200s, apart from application-level 400s ("pubkey is required") from customer-schedule endpoints called without a pubkey | holds, on round 1's evidence; not re-observed this round, by design |
| R3 | "each with `timer.lastRunAt` on 2026-06-07" | The saved 21:15Z response, re-read: four entries, all `enabled: false`, `lastRunAt` 2026-06-07T21:15:47, 22:08:20, 21:52:23 and 22:05:42 (+00:00), no `lastError`. A `GET` at 22:31:03Z — after a **second** recreate (run 35472800880 on `4f98cdb4`, 22:15:26Z-22:16:51Z) — is byte-identical to it (`cmp`) | holds |
| R4a | "the list and timeline readings reach back before the recreate" | Round 1's 10a-10c; and the persisted record has now outlived two recreates (R3) | holds |
| R4b | "the timeline tracks only 21 hard-coded task names (not `refreshSearchIndex` or `reconcileAll`, for which `lastRunAt` is the evidence)" | Recounted from `src/api/neo4j-health/getTaskTimeline.js` at HEAD: 22 literals, 21 unique; neither name among them. `lastRunAt` comes from `getRecentRuns`, which reads the whole events file (`src/api/scheduled-tasks/index.js:206-209,296,304`) | holds |
| R4c | "the legacy one is in-process memory; the queue's is held in Redis, which this deploy left running" | `src/api/deploy-safety/index.js:160-162` and `:124`; run 35469346027's log, fetched again: `Container tapestry-redis Running` beside `Container tapestry Recreate`, both 21:06:16Z | holds |
| R4d | "Neither records what was active at the kill." | Follows from R4c and ADR `deploy-safety-gate/0001:129` | holds |
| R5a | "a new line has to be paid for by freeing one, though rewording the existing `Deploying / ops` row adds none" | `wc -l CLAUDE.md` = 190 and cap 190 at HEAD **and** on the new `origin/staging`; L11 counts lines. PR #692 is an existence proof: it reworded the "Product direction" row in place (1 insertion, 1 deletion) and the count stayed 190 | holds |
| R5b | "the deploy workflows (four; the doc covers three of their instances)" | Four `deploy-*.yml` files; `.github` is identical at `7a06da12` and `4f98cdb4`; the doc's branch map has three rows and calls `feature-magic-carpet` "not covered today" (`:41`) | holds |
| R6a | (d): the trigger description is at `.claude/skills/cycle-staging/SKILL.md:3` and "offers" the four quoted phrases | Line 3 is the `description:` line. Each phrase matches as a fixed string on line 3, once; they are exactly the four quoted phrases that line carries (the source writes them with the comma inside the quotation marks) | holds |
| R6b | (d): "its procedure starts at push and open-PR" | The numbered steps are `1. Verify preconditions` (`:32`), `2. Push branch` (`:42`), `3. Open PR` (`:50`), `4. Safe-to-merge check` (`:79`). The procedure starts at a read-only precondition check; push and open-PR are steps 2 and 3. **This is this reviewer's round-1 wording**, adopted verbatim, and it is loose | the inference it carries holds (R6c); the clause itself is imprecise — non-blocking 4 |
| R6c | (d): "so nothing covers 'the PR is already open, merge it', which was this incident's trigger" | No text in the skill matches `already open`, `already exists`, `existing PR` or `skip to step`; its three "When to use" and three "When NOT to use" entries have no such case. PR #691 was opened at 20:28:22Z and the operator's `merge it` came at 21:04:07Z (round 1, claim 5) | holds |
| R6d | (d): an entry "entering at step 4, is a smaller change than (a) to (c)" | Step 4 is the check. The comparison is an attributed judgement ("from this row's review"), and it holds by surfaces touched: (d) one skill file; (a) one repo file plus the board outside the repo; (b) four workflow files; (c) a new check plus a ruleset change. The skill file is identical on HEAD and `origin/staging` | holds as an attributed judgement |
| R7 | Pointer cell: "related rows 209, 256, 277 and 334" plus this review's path | The path exists (committed in `398ced60`). On this branch's tree 334 is the Director row. **On the shared line 334 is a different row** | true on the branch, wrong on the merge target — Blocking 1 |

### Claims adherence (round 2) — row 334

| # | Claim in row 334 | Evidence gathered this round | Result |
|---|---|---|---|
| D1 | `.claude/skills/direct-feature/SKILL.md:68` says to follow `/cycle-staging` and restates it inline as the quoted list | Line 68 read in full. The quotation matches as one fixed string, once; it stops before "on `staging.brainstorm.world`", a truncation at the end, not an alteration | holds; verbatim |
| D2 | `engineering-team/roles/director.md:140` gives "`/cycle-staging` semantics" with the same list | The quoted phrase is on `:140` (and `:51`). The list on `:140` is "PR to `staging`, plain merge, watch `deploy-staging.yml`, full five-tier smoke": no push item, and "full". The SKILL.md string does not occur in director.md (fixed-string count 0) | the phrase is verbatim; "the same list" is not exact — non-blocking 1 |
| D3 | "Neither file names the check or `docs/SAFE_TO_MERGE.md` anywhere", with a `git grep -i` for three patterns | Under `bash -c`, control first (`cycle-staging`: 3 and 2 matches). The row's three patterns: exit 1 each. Widened pattern adding `safe_to_merge` and the spaced and camel-case spellings: exit 1. Other names for the step (`precursor`, `pre-merge`, `in-flight`, `scheduled task`): one unrelated hit ("in-flight epics", `SKILL.md:51`). The row's three patterns cannot match the doc's filename: applied to the literal `SAFE_TO_MERGE.md` strings in `cycle-staging/SKILL.md`, each matches 0 times | the claim is true; its stated evidence covers only half of it — non-blocking 2 |
| D4 | "Both lines date from 2026-06-10 (`3a2657b2`)" | `git blame -L 68,68` and `-L 140,140`: both `3a2657b2`, 2026-06-10, "chore: Direction-mode harness …". Stronger than round 1's `-S` search, which could not see a later edit elsewhere on the line | holds |
| D5 | "the gate shipped on 2026-07-18 (`ffcf0f8a`)" | `ffcf0f8a` is "impl: cycle-safe-to-merge-check (story #2, ADR 0002)", 2026-07-18T22:08:41Z; it adds `docs/SAFE_TO_MERGE.md`, the script and step 4 in both cycle skills. First merge on `staging`'s ancestry containing it: PR #385, 2026-07-18T22:45:01Z | holds, on either the local or the UTC date |
| D6 | "and nothing went back to them" | "Them" is "both lines", and blame (D4) shows no later commit touched either. Seven later commits did touch the two *files* (2026-07-26 to 2026-09-13), for other reasons | holds as worded |
| D7 | A Director following `/cycle-staging` reaches step 4; one working from the inline summary reaches the merge with no check named on its path | Step 4 is the check (`cycle-staging/SKILL.md:79`); D1-D3 | holds |
| D8 | ADR 0002 "judged the same structure in `/cycle-full`", with the quoted sentence | Fixed-string match, once, at `0002:25`, in the "Consumers today" bullet under "### Verified facts (checked against the tree 2026-07-18)" — where the Pointer cell says. "Same structure" is fair: a delegating skill that restates its delegate's steps inline | holds; verbatim |
| D9 | "Its sub-decision 4 added a line naming the check to each of `/cycle-full`'s inline lists (no recipe text)" | `0002:78`: "add one summary line to each stage list … and one entry in Halt-on-failure semantics", carrying "**no** URL, no numbers, no script name, no doc link". `ffcf0f8a` inserted exactly those three lines (`cycle-full/SKILL.md:50,75,108`) | holds (the ADR decided it; `ffcf0f8a` made the insertions) |
| D10 | "`test/safe-to-merge-check.test.js` C6 pins that for `/cycle-full` only" | C6 is at `:492`. The suite opens five files (`:48-52`): the script, the doc and the three cycle skills. It never mentions `direct-feature` or `director` (0 matches; control `cycle-full` 16). The three test files that do mention them carry no gate string. No test pins the text "plain merge" | holds |
| D11 | "found by reading, not by incident: whether any Direction-mode merge has skipped the check was not examined" | Accurate: neither round of this review examined it, and the Implementer claims nothing here. A lead for whoever takes the row, not checked for completeness: four Direction-mode journals name the check (`deploy-safety-gate`, `relationship-primitives`, `add-a-concept-to-a-tapestry`, `note-tagging-inspector`) | holds |
| D12 | "both files are harness-definition paths, so the change owes a CHANGELOG row" | `scripts/harness-def-paths.txt:17` (`engineering-team/roles`) and `:28` (`.claude/skills`); L10 | holds |
| D13 | Headline, second clause: "Direction mode is where a merge into `staging` happens with no human at the gate" | **Fair to `director.md`, and better supported than the row shows.** The Director "answer[s] the phase gates they normally ask the human, supervise[s] the deploy chain through staging" (`:3`); gates are "never skipped — they are *answered*, by you" (`:23`); only two decisions stay with the operator, ratifying completion and anything past staging (`:25`). And the cited line sits under the heading "Deploy gates (you run these — operational, not judged; the completion report that summarizes them IS judged)" (`:138`): by the role file's own vocabulary the staging merge is a gate, and it is the one kind the Director runs with neither a human nor a judge. The clause is this reviewer's round-1 wording; the row's body gives no support for it | holds; support missing from the row — non-blocking 3 |
| D14 | Type, Opened, Status, Done, Pointer | `meta` fits. Opened is an ISO date plus what raised it. Status is exactly `OPEN`; Done is empty. Every pointer resolves: both file:line citations, the ADR section and sub-decision, C6, and this review's "Harness friction" section (item 1 stays in round 1's) | holds; "row 333" appears three times and must follow the renumbering — Blocking 1 |
| D15 | Not a duplicate | Ledger and `_intake.md` searched on **both** `HEAD` and the new `origin/staging` for `direct-feature`, `director.md` or Direction mode together with the gate, the staging chain or an inline summary: rows 92 and 140 match the keywords and concern other things (`curl` in subshells; phase commits landing on local `staging`). Nothing in `_intake.md` | holds |

### Round-1 claims re-run against the moved merge target (`4f98cdb4`)

PR #692 changed `CLAUDE.md` and added a `design-philosophies/` tree, so the repo-wide claims were run
again on that tree (`git grep … origin/staging -- …`, control first: `staging` matches 38 times in
`OPERATIONS.md` there). Scope S: still no match. Files naming the gate that exist on `4f98cdb4` and did
not on `7a06da12`: none; `design-philosophies/` and the changed `CLAUDE.md` row carry no gate string.
`.github` is identical on both tips. `gh api …/rules/branches/staging` → still `deletion` and
`non_fast_forward` only. `CLAUDE.md:10` still reads as the row quotes it. Staging's new row 336 reports,
independently and on the same day, that "staging lists four entries". Nothing round 1 verified was
broken by the edit or by the move.

### Things tests can't catch (round 2)

- [x] **No secrets, machine paths or `localhost` literals** in the lines `6863db1d` adds (control: the
  64-hex pattern matches a test string).
- [x] **No scope creep beyond what the operator approved.** Two ledger lines; nothing else.
- [x] **The additions beyond the brief are accurate.** (d) and the Pointer addition are checked as R6
  and R7; row 334 as D1-D15.
- [x] **Attestation, where it remains.** Unchanged from round 1 (the live board page; the 21:15Z
  readings as received), plus R2: the 502 timestamps are this reviewer's round-1 observation, carried
  into the row without a second pair of eyes on the transcript. That is a deliberate choice of the
  brief, and the run log bounds the two timestamps independently.

### Findings (round 2)

#### Blocking

1. **`OPEN.md:395-396` — rows 333 and 334 carry numbers that now belong to other rows on
   `origin/staging`, and the branch does not merge as it stands.**
   - `git fetch origin staging` at 22:18:54Z moved the ref `7a06da12..4f98cdb4`. PR #692
     (`docs/design-philosophies`) merged at 22:15:23Z and added rows 333 to 339; its 333 is
     the row about `protocols/README.md` pointing at a BIBLE section that does not exist, and its 334
     the row about `scripts/harness-budgets.txt` saying AGENTS.md is loaded into every session.
   - `git merge-tree --write-tree HEAD origin/staging` → `CONFLICT (content): Merge conflict in
     OPEN.md` (both sides append after row 332).
   - The fix commit is stamped 22:18:03Z, two minutes forty seconds after that merge: row 334 was
     minted against a stale `origin/staging`. Row 333's number was right when it was minted, in round 1.
   - Left as they are, the numbers would duplicate two unrelated rows, and four cross-references inside
     the rows would send a reader to the wrong place — "related rows 209, 256, 277 and 334" would point
     at the AGENTS.md row. That is the kind of error a reader acts on, and `workflows/5-review.md`
     defines the other verdict as "mergeable as-is", which this is not.

   **Asked change.** Follow the precedent PR #692's own branch set an hour earlier (`8ccd69aa`): merge
   `origin/staging` into the branch, keep staging's rows first and this change's after, and renumber
   this change's rows to the highest number on `origin/staging` plus one and plus two after a fresh
   fetch — **340 and 341** as of 22:31Z (highest is 339; no open PR into `staging`; no remote ref
   carries a 340 or 341). Six places change:

   | Where | Now | Becomes |
   |---|---|---|
   | row 333, id cell | `333` | `340` |
   | row 333, Pointer cell | "related rows 209, 256, 277 and 334" | "related rows 209, 256, 277 and 341" |
   | row 334, id cell | `334` | `341` |
   | row 334, Item cell | "This is row 333's gap found by reading" | "This is row 340's gap found by reading" |
   | row 334, Opened cell | "2026-09-19 (row 333's review, harness friction 1)" | "2026-09-19 (row 340's review, harness friction 1)" |
   | row 334, Pointer cell | "related row 333" | "related row 340" |

   This review keeps its rounds as written, as the precedent did; this reviewer will add the
   renumbering note in round 3 rather than have another role edit the file. Round 3 needs only: the six
   places above, the merged `OPEN.md` (staging's seven rows intact, no duplicate of any number this
   change touches), the meta count on the merged tree (115 becomes 117 if nothing else lands), lint,
   and the five suites once more, because the ledger they read changes again.

#### Non-blocking

Worth taking in the same edit, since the rows are being touched anyway; none changes what a reader
would do.

1. **Row 334, "`engineering-team/roles/director.md:140` gives "`/cycle-staging` semantics" with the
   same list"** — director.md's list has no push item and says "full five-tier smoke". Replace "with
   the same list" with "with the same list minus the push".
2. **Row 334, "(2026-09-19: `git grep -i` for `safe-to-merge`, `check-safe` and `deploy-safety` finds
   nothing in either)"** — those three patterns cannot match `SAFE_TO_MERGE.md` (underscores), yet the
   sentence they support says neither file names that doc. The claim is true; a reader re-running the
   stated command would be checking only half of it. Round 1 named this trap when it defined Pattern
   W. Replace with "(2026-09-19: `git grep -i` for `safe-to-merge`, `safe_to_merge`, `check-safe` and
   `deploy-safety` finds nothing in either)" — this reviewer ran exactly that, with a control.
3. **Row 334, headline, "Direction mode is where a merge into `staging` happens with no human at the
   gate"** — fair (D13), but asserted only in the headline. Optional, after the director.md sentence:
   "That list sits under the heading "Deploy gates (you run these — operational, not judged; the
   completion report that summarizes them IS judged)" (`director.md:138`)." If the headline is touched
   too, "and in Direction mode the Director runs that merge itself, with no human and no judge at the
   deploy gate" says the same thing without the "is where", which can be read as "the only place".
4. **Row 333, fix (d), "and its procedure starts at push and open-PR"** — step 1 is "Verify
   preconditions". This reviewer's wording, and loose. Replace with "and its procedure runs
   preconditions, push and open-PR before the check".
5. **Length, for the record.** Row 333 is now 4,884 bytes, the third-longest of 334 (after rows 325
   and 290); row 334 is 2,104, rank 36. Not a codified limit, and the Pointer cell now links the detail.

#### Harness friction (round 2)

1. **No new row for the collision — it is one more instance of row 307, which is open, and the open
   book `ledger-row-identity` owns the class.** Worth recording on that row when it is next edited:
   two collisions on the shared line in one afternoon (`8ccd69aa` renumbered PR #692's rows after PR
   #691 took 331-332; this branch after PR #692 took 333-339), and the second happened inside a
   three-minute window between a merge and a commit, with fetch-then-mint already the stated rule. A
   fetch immediately before the commit would have caught this one; only collision-free ids close the
   window between minting a number and merging it, which is that book's subject.
2. **Proposed `meta` row (or an addition to row 237's family; the operator's call): a negative search
   over paths held in one unquoted variable is vacuous under zsh.** The Bash tool's shell is zsh, which
   does not word-split `$FILES`; `git grep … -- $FILES` then searches one nonexistent pathspec, exits
   1, and reads as "no match". Reviews in this repo lean on negative searches. It happened in this
   round and was caught only because the positive control ran against the same variable. The durable
   form of the lesson: run the control through the same pathspec as the search, and put multi-path
   searches under `bash -c` or spell the paths out. Rows 111, 165 and 237 are siblings (shell
   behaviour that silently changes a check's meaning); none covers this one.

### On PASS (round 2)

Not reached. As in round 1: this lane has no story, so there is no `**Status:**` line to flip, and no
book, so completion detection has nothing to compute.

## Verdict
**CHANGES_REQUESTED**

One blocking item, and it is mechanical: the two rows must be renumbered onto the moved shared line
(340 and 341 as things stand), with the four cross-references inside them. Every claim in both rows
was verified; the four small wording corrections above are optional and fit the same edit.
