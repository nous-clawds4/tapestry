# Review: row 333 — a deploy-triggering merge can skip the safe-to-merge check unnoticed (one new `meta` row)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19 (UTC, from `date -u`; the review ran from 21:31Z to about 22:05Z)
**Diff:** one commit, `8328f9ea` (branch `docs/open-row-unenforced-safe-to-merge`, unpushed at review
time), on `7a06da12` — PR #691's merge, which is `origin/staging` after a fresh
`git fetch origin staging` (merge-base = `7a06da12`). `git show 8328f9ea` is the whole surface:
`OPEN.md`, 1 insertion, 0 deletions, line 395 (row 333, 3,948 bytes).
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

## Verdict
**CHANGES_REQUESTED**

One passage needs rewording (Blocking 1 and 2, one edit); the replacement text is given above. Every
other claim in the row was verified, and the conclusion that the PR #691 deploy harmed nothing on
staging holds.
