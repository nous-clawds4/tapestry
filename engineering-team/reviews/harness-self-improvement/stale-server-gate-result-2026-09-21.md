# Review: the post-restart gate result on row 289 and the stale-stack row (doc lane)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21 (UTC; the review ran from about 13:08Z to 13:35Z)
**Lane:** doc / one-liner (Implementer + Reviewer, Standard strictness; `workflows/0-intake.md` §3). No
story, ADR, test plan or book, by design. This review is the lane's record, filed under the
non-numbered form.
**Diff:** `git diff 6eabd419...be3e4a37`: one commit, `be3e4a37`, on branch
`docs/stale-server-gate-result` (a worktree), whose parent `6eabd419` is `origin/staging`. It is
still `origin/staging` after a fetch at 13:29Z, and no PR is open against `staging`. Two files:
`OPEN.md`, 1 insertion and 1 deletion (line 321, row 289); and
`ledger/2026-09-20-live-tier-fails-on-stale-stack.md`, 23 insertions and nothing else.
**Provenance:** the owner asked, in their words, to "record that, after restarting the stale local
server, the full gate showed which failures were stale-server artifacts". The orchestrator's brief
relayed that ask, the background and ten claims to falsify; it did not relay the Implementer's
evidence. Each claim below was re-derived from this reviewer's own commands. The brief reserved the
commit (OPEN.md row 316), so this reviewer created this one file and nothing else: no add, commit,
push, stash or branch switch, and no edit to any other file.

**Short version.** The comparison itself is right: the run IDs, commits, totals and the per-suite
arithmetic all check out, and "rules out stale server code for all 14" holds. Three statements do
not hold. (B1) The row-289 update gives the old process's start as 17:37Z. The container's
supervisord log and the host's reflog both put it at 17:40:42Z, which is what row 289 already said;
`ps lstart` under-reads long-lived processes on this machine. (B2) "The H1–H3 assertions that had
failed": only H1 had failed. (B3) The summary sentence "apart from the one suite above, none were"
reads as though `recognizable-published-ta-profile` were a stale-process failure, and the bullet
above it says that cannot be decided.

## Quality gates (run by the reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` on `be3e4a37` in the worktree: exit 0, `harness-lint: clean (0
      violations)`, 42 lines. The same run in a throwaway detached worktree at `6eabd419` gave a
      byte-identical output and exit 0, so the change adds no violation, waiver or INFO line. The
      throwaway worktree was removed; `git worktree list` shows the main checkout and this worktree.
      Re-run after this file was written: see the last item.
- [x] The six suites that read `OPEN.md` or `ledger/` (found by grep; control: `operational-direction`
      matches), each run through its `run()` export (row 310) on Node 22.23.2 in the worktree:
      `ledger-row-ids` 6 passed / 0 failed, `operational-direction` 86 / 0 / 0 skipped,
      `curated-dlist-update-publish` 69 / 0 / 0, `curated-dlist-update-update-preview` 34 / 0 / 0,
      `session-start` 32 / 0 (45 s), `harness-lint` 76 / 0 (127 s). `git status --short` was empty
      afterwards.
- [ ] **Full gate: not re-run.** This is a docs-only change and the brief said not to. What the change
      records *is* two gate runs, so they were read instead, with `npm run -s gate:status -- --run
      <id>` in the main checkout (Node 22.23.2, read-only; exit 1 for each, because each run failed):
      - `20260921T044814Z-41349-9c0d [avatar-menu-account-section-addendum] started
        2026-09-21T04:48:14.364Z on 78a09be5 — FAIL, exit 1, 3424 passed, 57 failed, 139 skipped,
        214/214 suites; failed: tag-detail, …, author-scoped-inspection-roster` (17 suites)
      - `20260921T064337Z-21374-92e9 [post-restart-aa4df2e3] started 2026-09-21T06:43:37.457Z on
        aa4df2e3 — FAIL, exit 1, 3493 passed, 50 failed, 129 skipped, 215/215 suites; failed:
        tag-detail, …, summaries-element-count` (14 suites)
      The binding run for the PR is CI's Node 22 `stack-free` job.
- [x] **The edit is mechanically clean.** `OPEN.md`: one line differs (321). Split on unescaped pipes,
      the row has 9 fields and 8 pipes on both sides, every cell except Item is byte-identical, and
      the old Item cell is a prefix of the new one. The 951 characters added contain no pipe, 22
      backticks and 4 bold markers, so both are balanced. 342 numbered rows on both sides. The ledger
      file: the base blob is a byte prefix of the head, and the header (`Status: OPEN`, `Done: —`) is
      unchanged. Both rows correctly stay open, since nothing is fixed yet.
- [x] After writing this file: `bash scripts/harness-lint.sh >/dev/null 2>&1; echo $?` prints `0`,
      the output differs from the base only by one new `INFO non-numbered-review` line for this
      file, and `awk -f scripts/lib/review-verdict.awk` on this file prints the verdict in its last
      line.

## Claims adherence: each claim, with the command that tried to falsify it

| # | Claim | Evidence | Result |
|---|---|---|---|
| 1a | The restart happened at 05:54:41Z | `docker exec tapestry ps -eo pid,lstart,args`: pid 162342, `Mon Sep 21 05:54:41 2026 node …/bin/control-panel.js`. The container is on UTC (`date` prints UTC; `/etc/localtime` is UTC). Independently, the container's `/var/log/supervisor/supervisord.log` has `2026-09-21 05:54:41,248 INFO spawned: 'brainstorm' with pid 162342`, and stream-consumer at 05:54:51; `dev-refresh.sh` restarts both | holds |
| 1b | The restart was a full `dev-refresh.sh`, at `aa4df2e3` | The main checkout's reflog: HEAD moved to `aa4df2e3` at 01:54:26-04:00 (05:54:26Z, `pull --ff-only`) and has not moved since. `dist/index.html` was rebuilt at 05:54:40Z, one second before the spawn; `--server` would have skipped that UI step. The container bind-mounts this checkout (`docker inspect`) | holds |
| 1c | `/api/assistant/roster` answered 200 afterwards | Three GETs at about 13:10Z: 200 each, and the body carries `success: true` and an assistants array. supervisord shows no restart after 05:54:41 | holds |
| 1d | *(found while checking 1a)* OPEN.md: "the process started 2026-09-12 17:37Z" | supervisord.log: `2026-09-12 17:40:42,739 INFO spawned: 'brainstorm' with pid 5648`, and no `brainstorm` spawn from then until 2026-09-21 05:54:41. The host reflog has HEAD moving to `cde8b282` at 17:40:27Z, so a 17:37:30 start would predate the checkout that row 289 says the process booted from. `ps lstart` under-reads every long-lived process here. supervisord (pid 1): `ps` 17:04:45, own log 17:09:56, Docker `StartedAt` 17:09:53.93Z, so `ps` places it before its own container existed. neo4j (pid 230): `ps` 17:04:49, log 17:09:57. Today's two processes read true. Row 289's own "17:40 UTC" was right | **fails: B1** |
| 2 | 17 → 14 red suites, 57 → 50 failed, 139 → 129 skipped; run IDs and commits as stated | Both records parsed with Node 22.23.2, plus the `gate:status` lines above. BEFORE: `78a09be5`, `dirty: false`, Node v22.23.2, 3424/57/139, 17 of 214 suites red. AFTER: `aa4df2e3`, `dirty: false`, v22.23.2, 3493/50/129, 14 of 215. In both, the per-suite sums equal the totals | holds (the AFTER run has one more suite: N4) |
| 3a | Between the commits, `src/` changed only in `src/api/assistant/` profile code | `git diff --stat 78a09be5 aa4df2e3 -- src`: 4 files, all in `src/api/assistant/` (`index.js`, `profileDefaults.js`, `profilePublish.js`, `profileState.js`); nothing in `bin/` or `firmware/`. The `index.js` hunks cover the profile defaults, the status handler that serves them, the publish-profile handler and the exports block. The hunk that sits after `handleProvisionAssistantKey` is the exports block and its comment | holds |
| 3b | None of the three credited suites' test files changed | Over the range, the only test files that changed are `assistant-publish-relays`, `one-default-assistant-profile` (new), `recognizable-published-ta-profile` and `registry.js` (+1 line, registering the new suite). Taken further: every source path the three suites read is unchanged in the range (`roster.js`, `src/api/index.js`, `auth.js`, `assistantKeys.js`, `getUserClassification.js`, `fetchProfiles.js`, their `ui/` files, the normalize modules, `dtag.js`, `neo4j-driver.js`, `exportSet.js`, `test/helpers/stackHttp.js`). The one assistant endpoint two of them call, `/api/assistant/pubkey`, has a byte-identical handler | holds |
| 4a | The roster route and handler predate both runs (`src/api/index.js:543`) | Line 543 at both commits reads `app.get('/api/assistant/roster', assistantApi.handleGetAssistantRoster);`. The route, `roster.js` and the export all first appear in `a33dc5c7`, at 2026-09-21T00:37:50Z, before the 04:48:14Z run | holds |
| 4b | #724 touched no roster lines | Added or removed lines that mention "roster" across the range, in `src`, `ui`, `test` and `bin`: 0. Control: 97 added or removed `src` lines mention "profile". The three "roster" hits in the `index.js` diff are two context lines and a hunk header | holds |
| 4c | The old process answered 404 | Recorded by the earlier update's curl (ledger file lines 82–83). It also follows by construction: `a33dc5c7` landed eight days after the old spawn, and this server answers 404 for an unregistered `/api` path (a GET to `/api/assistant/no-such-route-review-probe` returned 404). The records hold no message for the five H failures (`message: null`) | holds |
| 5 | `profile-lookup-bounds` went green; its E2 is the row's own example | 26/1/0 → 27/0/0. The BEFORE failure (and the one in `…041722Z`) is the string `E2 (live, AC5): a request past the cap is refused readably, naming the limit and the remedy`, which is the test in the row's "Measured on this book". `MAX_PUBKEYS_PER_REQUEST` first appears in `56ea6cf9` (2026-09-20T21:21:57Z), and `src/api/profiles` is unchanged in the range | holds |
| 6a | `event-less-create-set`: 11 → 1 skipped, and 10 more tests passed | 14/0/11 → 24/0/1. Eleven tests go through `skipUnlessLive()` (H0–H10). H10 also skips unless `NODE_PRIMITIVES_REINSTALL=1` names a container other than `tapestry`, so it is the one skip left | holds |
| 6b | The live class skips unless the container serves the probe, which the old process could not do | `liveReady()` (test file lines 331–353) needs a 200 from `/api/auth/user-classification` over `docker exec` loopback, then a 200 from `GET /api/normalize/node-primitives` with `surface: 'node-primitives'`; anything else skips. The probe route and its module first appear in `a5c90134`, at 2026-09-13T02:55:48Z, after the old spawn (whether that was 17:40:42Z or the 17:37:30 `ps` reading). `user-classification` dates from `17c3bab3` (2025-07-31), and `relationship-primitives`, which uses the same loopback helper, ran 23/0/0 with no skips in the BEFORE run. So the skip came from the probe check, whose note reads "…does not serve GET /api/normalize/node-primitives (…) — it runs code without this feature". "With an accurate note" rests on that inference, because the records keep no skip text | holds |
| 6c | "A feature-keyed probe of the kind fix shape 3 cautions about" | Fix shape 3 (ledger file lines 59–61): a guard that skips whenever the new contract is missing "would skip exactly when a genuine regression appears"; the probe must key on build identity, "not on the feature under test". This probe is the feature's own deployment marker (`surface: 'node-primitives'`, `operations: ['add-subset']`), not a build identity, so it is exactly that kind. The next sentence, that here it turned stale code into skips, is the fair other side | fair |
| 7a | `recognizable-published-ta-profile` went green, #724 rewrote its assertions and code, and it is not credited to the restart | 12/1/0 → 13/0/0. #724 rewrote H1, H2 and H3; their titles and bodies all change, and its own header says "U2, U3, S1–S3 and H1–H3 now assert that". It also rewrote the code: `profileDefaults.js` is new, and the builder and status handler were rewritten | holds |
| 7b | "the H1–H3 assertions that had failed" | Only H1 had failed. The BEFORE run, and each of the 15 retained records in which this suite failed (2026-09-19 to 2026-09-21), show 12 passed and 1 failed, the one failure being H1 ('…must be "Virgil Clawds4's Tapestry Assistant". Got "Tapestry Assistant".'). H2 and H3 passed. OPEN.md's "its failing assertions" overcounts in the same way | **fails: B2** |
| 8a | The other 14 red suites have identical pass, fail and skip counts | All 14 are identical. Taken further: their `failures` arrays, names and messages both, are byte-identical across the two runs | holds (stronger than stated: N5) |
| 8b | "The goal and brain suites above except `store-the-four-…`" is exactly the ten goal and brain suites still red | Row 289's eleven, minus `store-the-four-when-a-goal-is-captured-or-updated`, are exactly the ten goal and brain suites that fail in the AFTER run. `store-the-four-…` went 40/0/0 in both runs. Adding `tag-detail`, `not-yet-shared-filter`, `concept-count-canonical` and `summaries-element-count` gives 14, the AFTER run's failed list | holds |
| 9 | "Rules out stale server code for all 14"; row 289's triage still applies and is not decided | Identical results on either side of the restart rule out anything the restart replaced. The only repo-code process not restarted is `nip50-proxy` (spawned 2026-09-11, running `nip50-proxy/src/index.js`). That tree last changed on 2026-04-09, and none of the 14 suites mentions it. The only processes older than 05:54:41 are supervisord, nginx, neo4j, strfry, the strfry router and `nip50-proxy`, so no child of the old control panel survived. Both notes leave "stale instance state, or a real regression" open | holds |
| 9b | Ledger: "That settles this update's '…': apart from the one suite above, none were" | The "fifteen" are row 289's re-run set: the 14 above plus `recognizable-published-ta-profile`. "Apart from X, none were" names X as the exception, that is, as a stale-process failure, while the bullet above says X cannot be attributed. "That settles" claims closure the note does not have for X, and "this update's" can be read as the follow-up itself | **fails: B3** |
| 10a | Nothing that will go stale is stated as timeless | "is now green" (OPEN.md) is fixed in B2's replacement, and "none of them is a stale-process failure" in B3's. The bare `src/api/index.js:543` and "Its live class skips" are N2. Everything else is past tense, dated by its heading, or bound to named commits and runs | mostly fair |
| 10b | Ledger-row citations match OPEN.md's form | OPEN.md's header (line 22) and ADR `ledger-row-identity/0001` (line 214): "Cite the id, never the path". The update's "row `2026-09-20-live-tier-fails-on-stale-stack`" is the id, and the in-table form mirrors "(row 288)"; it is the first in-table citation by id. In the ledger file, bare "Row 289" matches other ledger files (five uses of "row 342"); this file's own earlier text says "`OPEN.md` row 289" (N3) | holds |

## Things tests can't catch

- [x] No secret or key material. The 24 added lines were scanned for 64-hex strings, `nsec1`, long
      `npub1…`, the local TA literal and private-key headers: 0 hits. Control: the same pattern finds
      the hex key in the roster response body. No debug residue.
- [x] Scope: two files, both pure appends, and nothing else moved.
- [x] **A measurement hazard the change inherited.** `ps lstart` in this Colima container runs minutes
      early for any process that has been up for days: 192 s early for the old control panel and
      about 310 s for processes spawned on 2026-09-11. The earlier update's `ps` output is a faithful
      copy of what `ps` printed; only the time it implies is wrong. No `src/` or `bin/` commit falls
      between 17:37:30 and 17:40:42 on 2026-09-12, so that update's count of 19 is unaffected. The
      row's fix-shape addendum proposes comparing "the process start time" with commit times, and a
      probe that reads `ps` would inherit the error (B1, harness friction 1).
- [x] What this reviewer sent to the stack: read-only GETs to the local control panel (four to the
      roster, one to an unregistered path) and read-only `docker exec` and `docker inspect` calls
      (`ps`, `date`, `supervisorctl status`, log tails). Nothing was restarted or reconfigured, and no
      gate was run.
- [x] Repo side effects: one `git fetch origin staging` (no ref moved), and one throwaway detached
      worktree at `6eabd419`, created for the baseline lint and then removed. `git status --short` in
      the worktree was empty before this file was written.

## Findings

### Blocking

**B1. `OPEN.md:321` (row 289, the Update's second sentence): the old process's start time is wrong,
and it contradicts the same cell.** The sentence carries the `ps lstart` reading. The container's
supervisord log records the spawn at 17:40:42Z, about 15 s after the host checkout moved to
`cde8b282` (the same gap as today's 05:54:26 → 05:54:41). The same cell already says "started
2026-09-12 17:40 UTC at `cde8b282`", so a reader now finds two start times for one process and may
conclude there were two processes. The cited row shows 17:37:30 with nothing to reconcile it, so
both files need a change.

In `OPEN.md`, replace:

```text
The control panel was still the process started 2026-09-12 17:37Z; the evidence is in row `2026-09-20-live-tier-fails-on-stale-stack`.
```

with:

```text
The control panel was still the process named above, spawned at 2026-09-12 17:40:42Z according to the container's supervisord log; the evidence is in row `2026-09-20-live-tier-fails-on-stale-stack`, whose 2026-09-21 follow-up explains why `ps` reads it as 17:37:30.
```

In `ledger/2026-09-20-live-tier-fails-on-stale-stack.md`, append to the follow-up's first paragraph
(after "failed tests, 139 → 129 skipped.", line 108):

```text
The process it replaced had been spawned at 2026-09-12 17:40:42Z according to the container's
`/var/log/supervisor/supervisord.log`, about 15 s after the checkout moved to `cde8b282`. That is
`OPEN.md` row 289's "17:40 UTC", not the 17:37:30 `ps` printed above: `ps lstart` under-reads
long-lived processes in this container by minutes (it puts supervisord itself at 17:04:45 on
2026-09-11, before the container's own start at 17:09:53Z), so the start-time probe the fix-shape
addendum suggests should read supervisord's record, not `ps`.
```

**B2. `ledger/2026-09-20-live-tier-fails-on-stale-stack.md:119-121`, and the matching sentence in
`OPEN.md:321`: H2 and H3 had not failed.** Of the three, only H1 failed in the pre-restart run, and
in all 15 retained records where this suite is red. #724 did rewrite all three.

In the ledger file, replace the "Not attributable" bullet with:

```text
- **Not attributable.** `recognizable-published-ta-profile` also went green, but #724
  (assistant-profile #3, inside `aa4df2e3`) rewrote H1, the one test that had failed, along with
  H2, H3 and the assistant-profile code they test.
```

In `OPEN.md`, replace:

```text
`recognizable-published-ta-profile` is now green, but #724 rewrote its failing assertions and the code they test in the same interval, so its exit from this list is not credited to the restart.
```

with the following, which also removes the undated "now":

```text
`recognizable-published-ta-profile` went green in that run, but #724 rewrote H1, its one failing test, and the code it tests in the same interval, so its exit from this list is not credited to the restart.
```

**B3. `ledger/2026-09-20-live-tier-fails-on-stale-stack.md:122-125`: the summary sentence reads as
though the undecided suite were a stale-process failure.** This sentence is the direct answer to
the owner's question (which failures were stale-server artifacts), so it has to be unambiguous.
Replace the "Unchanged" bullet with:

```text
- **Unchanged.** The other 14 red suites have identical pass, fail and skip counts in both runs, so
  none of them was a stale-process failure. That answers the update above ("some of that row's
  fifteen suites may be stale-process failures") for fourteen of the fifteen; the fifteenth,
  `recognizable-published-ta-profile`, is the one this comparison cannot decide. `OPEN.md` row
  289's per-suite triage, stale instance state or a real regression, still stands for all 14.
```

Each replacement was checked against the records before it was written here. It is still a claim,
and the next round should check it as one (`roles/reviewer.md` rule 10). The ledger replacements
use "`OPEN.md` row 289" (N3); the bare form is acceptable too.

### Non-blocking

**N1. The evidence leans towards "not a stale-process failure" for `recognizable-published-ta-profile`
too.** Every function on H1's server path (`handleAssistantStatus`, `buildDefaultProfileContent`,
`getKind0DisplayName`, `getInstanceWebsite`, `isPubliclyReachable`, `getInstanceDomain`) is
byte-identical between the old process's boot commit `cde8b282` and `78a09be5`. The owner-linked
name dates from `59ba8789` (2026-08-07). This is not proof: the status handler also calls
`assistantKeys.js`, which changed in that window (+90 lines). "Cannot decide", as B3 puts it, is the
safe statement; this could be added if wanted.

**N2. Pin the two present-tense references to the commits they describe.** `(src/api/index.js:543)`
could read "(`src/api/index.js:543` at both commits)", and "Its live class skips unless" could read
"Its live class skipped unless", so that neither goes stale when the code moves.

**N3. "Row 289's" could read "`OPEN.md` row 289's"**, matching this file's own earlier text and the
header's form, "OPEN.md row 230".

**N4. The AFTER run has one more suite:** `one-default-assistant-profile`, from #724, at 52/0/0 with
no skips, so the totals compare 214 suites with 215. The deltas (−3 red suites, −7 failed tests, −10
skips) are exactly the four suites the note names. A clause saying so would pre-empt the question.

**N5. "Identical pass, fail and skip counts" undersells the evidence.** For all 14 suites the failing
tests and their messages are byte-identical too, which is a stronger basis for "rules out".

**N6. The commit message's "after nine days on 2026-09-12 code".** From 17:40:42Z on 2026-09-12 to
05:54:41Z on 2026-09-21 is 8 days 12 hours. It is in the message, not in either file, and the commit
belongs to the orchestrator.

### Harness friction *(candidates for `meta` rows; OPEN.md, `ledger/`, `engineering-team/`, `.claude/` and `docs/` were searched for "lstart" and for citation-durability wording, and neither is recorded)*

1. **`ps lstart` misreports long-lived processes' start times on this machine**, by minutes and in a
   way that grows with uptime; for supervisord it gives a time before the container's own start.
   This row's evidence was built on it, and so was this brief's suggested check (which happens to
   read true for a process started today). supervisord's log and `supervisorctl status` uptime are
   accurate. B1 records the fact in the row. A separate row is worth filing only once someone builds
   the start-time probe, and it is cheap then.
2. **Gate records cited as evidence are pruned out from under their citations.** `tmp/gate-runs/`
   keeps 30 records. Row 289's cited runs `20260913T040914Z-14580-57d2` and
   `20260913T042736Z-98078-5426` are already gone, and this change cites two more that will go about
   30 runs from now. Row 291 (5) covers the prune count, not this. A cheap mitigation: the README's
   gate section could say that a record cited in a ledger row should be copied to a name the pruner
   skips.
3. **Row 316 recurred.** The wiring says to commit the review; the brief reserved the commit, and the
   brief was followed.

## Verdict

The comparison the owner asked for is sound, and most of the record is exact. The totals, run IDs,
commits and per-suite deltas are right, the three suites credited to the restart are credited
correctly, the 14 unchanged suites are named correctly, and "rules out stale server code for all 14"
holds without deciding between stale state and regression. Lint is clean and identical to the
base's, and the six suites that read these files pass. Three statements are wrong or ambiguous in a
record future sessions will trust: the old process's start time (B1), which assertions had failed
(B2), and the summary sentence about the fifteenth suite (B3). Each fix is one or two sentences, and
the exact text is given above.

**CHANGES_REQUESTED**

---

## Round 2: `055aefbe` (2026-09-21, about 13:37Z to 13:47Z)

**What was reviewed.** Fix commit `055aefbe` on the same branch, on top of `3fe69f02`, the round-1
review above, which the orchestrator committed unchanged per row 316. The committed blob is the
round-1 file, and `git status --short` was empty. `055aefbe` changes `OPEN.md` line 321 (row 289)
and the ledger follow-up (19 insertions, 10 deletions), and nothing else. `origin/staging` was still
`6eabd419` when fetched at the start of this round, and no PR is open against `staging`. Each
changed statement was re-derived as a fresh claim, this reviewer's own round-1 wording included
(`roles/reviewer.md` rule 10).

### Quality gates (round 2)

- [x] `bash scripts/harness-lint.sh` on `055aefbe`: exit 0, `harness-lint: clean (0 violations)`.
      The output is byte-identical to round 1's after-state: the base's, plus one
      `INFO non-numbered-review` line for this file.
- [x] The same six suites, each through its `run()` export on Node 22.23.2 in the worktree:
      `ledger-row-ids` 6/0, `operational-direction` 86/0/0, `curated-dlist-update-publish` 69/0/0,
      `curated-dlist-update-update-preview` 34/0/0, `session-start` 32/0, `harness-lint` 76/0.
      `git status --short` was empty afterwards.
- [x] Row 289 still parses. One line differs from the base, and it has 9 fields and 8 pipes on both
      sides. Every cell but Item is byte-identical, and the base's Item cell is a prefix of the new
      one. The 1,132 added characters hold no pipe, 24 backticks and 4 bold markers, so both are
      balanced. There are 342 numbered rows on both sides.
- [x] A script checked the round-1 texts against the new blobs: each of round 1's seven fenced
      blocks was searched for, whitespace-normalised. Both texts round 1 said to replace are gone.
      B1's `OPEN.md` sentence, both B2 texts and the B3 bullet are present verbatim, apart from the
      two changes the orchestrator disclosed: "The process that restart replaced", and the N5
      clause inside B3.
- [x] No remaining text gives 17:37 as the start time. The 17:37s left on the branch are ledger
      line 77 (the `ps` output), line 78 (the pre-existing `--since` count, which round 1 found
      unaffected), and the two B1 texts that explain them.
- [ ] Full gate: not re-run (docs-only).

### Claims (round 2)

| Change | Evidence | Result |
|---|---|---|
| B1, `OPEN.md`: "the process named above, spawned at 2026-09-12 17:40:42Z according to the container's supervisord log; … whose 2026-09-21 follow-up explains why `ps` reads it as 17:37:30" | supervisord.log line 33 reads `2026-09-12 17:40:42,739 INFO spawned: 'brainstorm' with pid 5648`, and the next `brainstorm` spawn is line 46, at 2026-09-21 05:54:41. "Named above" is the same cell's "started 2026-09-12 17:40 UTC at `cde8b282`". The paragraph that explains the `ps` reading sits inside the ledger's "Follow-up 2026-09-21", between its first paragraph and its bullets. "Reads" is present tense for a process that no longer exists (R2-N1) | holds |
| B1, ledger paragraph, with the orchestrator's "The process that restart replaced" | "That restart" can only be the first paragraph's "The backend restarted at 05:54:41Z": supervisord stopped the old `brainstorm` at 05:54:41.241 and spawned pid 162342 at 05:54:41.248. The referent is right, and the edit improves on "it". The rest was re-verified at 13:38Z. Reflog: `cde8b282 HEAD@{2026-09-12T13:40:27-04:00}`, 15.7 s before the spawn, so "about 15 s" holds. Row 289 says "17:40 UTC", and ledger line 77 shows 17:37:30. `ps -p 1` still prints `Fri Sep 11 17:04:45 2026`, against Docker `StartedAt` 2026-09-11T17:09:53.93Z. "It puts" gives a drifting reading in the present tense (R2-N2) | holds |
| B2, both files | As round 1 (7b): H1 was the only failure, in the BEFORE run and in all 15 retained red records, and #724 rewrote H1, H2, H3 and the code. "Went green in that run" refers to the 06:43Z gate the update names | holds |
| B3, ledger bullet | As round 1 (9b): the fifteen are row 289's re-run set, all red in the BEFORE run. Fourteen are unchanged, and the fifteenth is left undecided, which matches "Not attributable". "The update above" is the "Update 2026-09-21" section | holds |
| N5, both files: "byte-identical failure messages" | The `failures` arrays are byte-identical, and all 50 entries carry a message. But the gate record clips messages at 500 characters: `test/helpers/gateRecord.js:37` sets `MAX_MESSAGE = 500`, `clip()` at `:94-96` does the clipping, and `:101` applies it. In both runs 7 of the 50 are clipped: the hygiene-check sentinels in `structures-the-brain-can-trust` H1, `break-a-goal-into-pieces` H2, `attach-the-world` H7, `sessions-read-the-brain` H9, `the-proposal-loop` H10, `teach-it-what-matters` H7 and `the-brain-survives` H8. Each is cut after the first entry of the hygiene check's problem list, and the rest of the list is not recorded. So only the recorded text can be called identical. The wording came from round 1's N5 | **fails: R2-B1** |
| N2, ledger: "Its route and handler were registered at both commits (`src/api/index.js:543`)" | Line 543 is the roster route at `78a09be5` and at `aa4df2e3`. The handler is exported at both (`src/api/assistant/index.js:554` and `:530`). `roster.js` is unchanged in the range, and `a33dc5c7`, which added all three, is an ancestor of `78a09be5` | holds |
| N2, ledger: "Its live class skipped unless the container served …" | The test file is unchanged in the range, so the past tense describes both runs | holds |
| N3, ledger: "`OPEN.md` row 289" | Both new occurrences use the form in OPEN.md's header | holds |
| `055aefbe`'s commit message | Its facts check out: 17:40:42Z, 15 s, 17:04:45 against 17:09:53Z, and "about eight and a half" days (8 d 12 h 14 m). "Each replacement applied as the reviewer worded it" is loose for the B1 paragraph (R2-N4) | fair |

### Findings (round 2)

#### Blocking

**R2-B1. `OPEN.md:321` and `ledger/2026-09-20-live-tier-fails-on-stale-stack.md:129-130`: "byte-identical
failure messages" claims more than the records hold.** My round-1 N5 ("their messages are
byte-identical") was loose: the gate record keeps only the first 500 characters of each message. For
43 of the 50, the whole message is recorded and identical. For the other 7, the hygiene-check
sentinels, the recorded prefixes are identical, but the rest of each problem list was never recorded.
A triager reading "byte-identical" could conclude that the sentinels' problem lists did not change
between the runs, though row 289 itself says the failing set moves with the instance's state. One
phrase in each file fixes it.

In `OPEN.md`, replace:

```text
Each has the same pass, fail and skip counts, and byte-identical failure messages, as in the pre-restart run `20260921T044814Z-41349-9c0d`.
```

with:

```text
Each has the same pass, fail and skip counts, and the same recorded failure messages, as in the pre-restart run `20260921T044814Z-41349-9c0d`.
```

In the ledger file, replace (the text spans lines 129–130):

```text
and byte-identical failure messages, so none of them was a stale-process failure.
```

with:

```text
and the same recorded failure messages (the gate record keeps the first 500 characters of each, which clips 7 of the 50), so none of them was a stale-process failure.
```

These were checked before being written here. All 50 recorded messages are identical across the
two runs. In each run, 7 of them end in the clip's "…" at 501 characters. The 14 suites' failure
counts sum to 50 in both runs. Each of the two texts to replace occurs exactly once in its file. The
next round should check the replacements as claims too.

#### Non-blocking

**R2-N1. `OPEN.md:321`, my round-1 wording: "explains why `ps` reads it as 17:37:30".** The process was
stopped at 05:54:41, so "read" would be exact. If the row is touched for R2-B1 anyway, it could say
"…explains why `ps` read it as 17:37:30."

**R2-N2. The ledger's B1 paragraph, my round-1 wording: "(it puts supervisord itself at 17:04:45 on
2026-09-11, …)".** This reading drifts. The under-read has reached about 5 minutes for processes
spawned on 2026-09-11, and it may move again after the host sleeps; it still read 17:04:45 at
13:38:45Z. Dating it would keep it true: "(on 2026-09-21 it put supervisord itself at 17:04:45 on
2026-09-11, …)". The dated heading above already implies the date, so this is not blocking.

**R2-N3. "Between the two commits" (the ledger's first bullet) now comes straight after the inserted
paragraph, which names `cde8b282`.** Context still makes the pair clear, but "Between `78a09be5`
and `aa4df2e3`," would remove any doubt.

**R2-N4. `055aefbe`'s message says "each replacement applied as the reviewer worded it".** The B1
ledger paragraph has one changed word and stands as its own paragraph. The orchestrator disclosed
both changes to this reviewer, and both are improvements. If R2-B1's fix gets its own commit, that
commit's message could say so.

#### Harness friction (round 2)

1. **Rule 10 caught its own case.** One of my non-blocking notes (N5) was adopted verbatim, with the
   apparent endorsement of two roles, and it carried an overclaim into both files. The rule worked
   as written; no row is needed.
2. **The gate record's 500-character clip appears only in the code** (`test/helpers/gateRecord.js:37`).
   `engineering-team/README.md`, `docs/` and `OPEN.md` do not mention it, so anyone comparing
   messages across runs finds out the hard way. It belongs with round 1's harness friction 2 (the
   README's gate section), if the owner takes that up.

### Verdict (round 2)

Everything round 1 blocked on is fixed and re-verified: the start time, the H1 wording and the
summary sentence all hold. The orchestrator's one-word edit is correct and better than mine, and N2
and N3 hold. Lint is clean and identical to round 1's after-state, and the six suites that read
these files pass. One statement added in this round does not hold as worded: "byte-identical failure
messages", from my own N5, because the gate record clips 7 of the 50 messages at 500 characters. The
fix is one phrase in each file, given above.

**CHANGES_REQUESTED**

---

## Round 3: `c8c27b2d` (2026-09-21, about 13:47Z to 13:53Z)

**What was reviewed.** Fix commit `c8c27b2d`, on `d84c6587`, the round-2 review above, which the
orchestrator committed unchanged per row 316; the committed blob is the round-2 file, and the tree
was clean. As the brief asked, only the statements `c8c27b2d` changes were measured.

**Nothing else moved.** `git diff 055aefbe c8c27b2d -- OPEN.md ledger/` shows `OPEN.md` at 1
insertion and 1 deletion (line 321), and the ledger at 5 and 4 (hunks at lines 113–114, 117 and
130–131). A script took each file's `055aefbe` blob, applied exactly the five announced
substitutions (whitespace-normalised, each source text found once) and got the `c8c27b2d` blob, so
the rest is re-wrapping. Row 289 still parses as in rounds 1 and 2. One line differs from the base,
with 9 fields and 8 pipes; the other cells are byte-identical; no pipe was added; backticks and bold
markers balance; and there are 342 rows.

| Change | Measured | Result |
|---|---|---|
| R2-B1, `OPEN.md`: "the same recorded failure messages" | All 14 still-red suites have identical counts and byte-identical `failures` arrays across the two records: 50 recorded messages | holds |
| R2-B1, ledger: "(the gate record keeps the first 500 characters of each, which clips 7 of the 50)" | `test/helpers/gateRecord.js:37` sets `MAX_MESSAGE = 500`. `clip()` (`:94-97`) keeps `s.slice(0, 500)` plus "…" when a message is longer, and `:101` applies it to name and message. In each run, 7 of the 14 suites' 50 messages end in that "…". The BEFORE run's other 7 failures (57 − 50) belong to the three suites that went green, and none of them is clipped, so "7 of the 50" is right for both runs | holds |
| R2-N1, `OPEN.md`: "explains why `ps` read it as 17:37:30" | Past tense, for a reading taken before the process stopped at 05:54:41 | holds |
| R2-N2, ledger: "(on 2026-09-21 it put supervisord itself at 17:04:45 on 2026-09-11, before the container's own start at 17:09:53Z)" | `docker exec tapestry ps -o lstart= -p 1` at 13:48:11Z on 2026-09-21 printed `Fri Sep 11 17:04:45 2026`; Docker `StartedAt` is 2026-09-11T17:09:53.93Z | holds |
| R2-N3, ledger: "Between `78a09be5` and `aa4df2e3`, `src/` changed only in `src/api/assistant/` profile code, and none of these suites' test files changed" | `git diff --name-only 78a09be5 aa4df2e3 -- src` lists the four `src/api/assistant/` files, and none of the three credited test files changed | holds |

**Gates.** `bash scripts/harness-lint.sh` on `c8c27b2d`: exit 0, with output byte-identical to rounds
1 and 2 (0 violations, and one `INFO non-numbered-review` line for this file). The six suites, each
through `run()` on Node 22.23.2: `ledger-row-ids` 6/0, `operational-direction` 86/0/0,
`curated-dlist-update-publish` 69/0/0, `curated-dlist-update-update-preview` 34/0/0,
`session-start` 32/0, `harness-lint` 76/0. `git status --short` was empty before this section was
written. `origin/staging` was still `6eabd419` at 13:47Z, and no PR is open against `staging`. The
full gate was not re-run (docs-only).

**Findings.** Nothing blocking and nothing new. Round 1's B1–B3, round 2's R2-B1, and every
non-blocking note that was taken up are in place and measured. N1, N4, N6 and R2-N4 were
informational. Round 1's harness friction 2 and round 2's harness friction 2 are with the owner.

**For the merge.** Land the PR as a merge commit, not a squash, because this file cites
`be3e4a37`, `055aefbe` and `c8c27b2d`. This lane has no story to flip and no book to close.

### Verdict (round 3)

Every statement the branch adds to `OPEN.md` row 289 and to the stale-stack row now matches its
evidence. That covers the restart and its time, the old process's real start and why `ps` misread
it, the totals and per-suite changes, the three suites credited to the restart, the one that is not,
and the fourteen that did not change, which the record still leaves undecided between stale state
and a regression. Lint is clean, and the suites that read these files pass.

**PASS**
