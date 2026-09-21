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
