# Review: row 325 — diagnosed; a dated pointer note, with the specifics held out-of-band

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19 (UTC; the evening of 2026-09-18 locally)
**Diff:** one commit, `5d0977c5` (branch `docs/row-325-diagnosed-pointer`, unpushed at review time), on
`58505ae6` — PR #678's merge, which was both `origin/staging` and the remote's `staging` throughout
this review. `git show 5d0977c5` is the whole surface: `OPEN.md`, 1 insertion and 1 deletion, line 386
(row 325); `engineering-team/stories/_intake.md`, 6 insertions.
**File:** non-numbered by convention — this lane has no story to match (`workflows/0-intake.md` §3).
**Lane:** doc/one-liner (Implementer + Reviewer, Standard strictness). No story / ADR / test plan and
no book by design.

**This file holds pointers only, on purpose.** The change records that a live, unpatched defect has
been diagnosed while withholding what it is (`SECURITY.md`; the 2026-09-11 intake entry). The same
rule binds this review. Where a claim rests on the private notes, the local repro or the session's
poll logs, the table says whether it verified and no more; the specifics went to the orchestrator in
a private report. When the fix ships and row 325 records the cause, that is the place to fold them in.

The brief reserved the commit for the orchestrator. This reviewer created this one file and nothing
else: no commit, no add, no push, no branch switch, no edit to any other tracked file.

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` on `5d0977c5` → **clean (0 violations)**, exit 0, 36 lines. Run
      again in a throwaway detached worktree on the base, `58505ae6`: the two outputs are
      byte-identical, so the change adds no waiver, no INFO line and no violation. Worktree removed.
- [x] **Nine suites**, each through its `run()` export (row 310), in the foreground, clean tree, host
      Node v16.17.0, on `5d0977c5`: `harness-lint` 41 passed / 0 failed (59 s), `harness-stats` 12 / 0
      (74 s), `session-start` 10 / 0 (26 s), `operational-direction` 76 / 0 (10 skipped),
      `curated-dlist-update-update-preview` 34 / 0, `curated-dlist-update-publish` 69 / 0,
      `gate-result-record` 34 / 0 (19 s), `kill-timeout-orphans-by-default` 9 / 0,
      `note-tagging-raw-events-inspector-ui` 32 / 0. My own grep, code lines only: three suites open
      the real ledger (`operational-direction` and the two `curated-dlist-update-*`), two more reach
      it through the scripts they run (`harness-lint`, `session-start`), and two open the real intake
      file (`kill-timeout-orphans-by-default`, `note-tagging-raw-events-inspector-ui`). The other two
      were run because the brief listed them.
- [x] **The real parser over the row** (the awk from `scripts/lib/collect-meta.sh:34`): `NF=9`, `$3`
      is ` ops `, `$6` is ` OPEN `. The open-meta selection is the same 106 row numbers on both blobs
      and row 325 is not among them.
- [x] **The roll-up** (`scripts/whats-open.sh`, redirected to a scratch file, exit 0, 381,739 bytes):
      row 325 appears once, at output line 235, in the ledger section. The 2026-09-18 "Scripted smoke
      test" entry is still listed under "Intake entries with no PICKED UP / RESOLVED marker" (output
      line 771). The roll-up's fetch moved neither remote-tracking ref.
- [ ] **Full gate: red on this host — re-run by this reviewer, and not a green gate.**
      `GATE_LABEL=row325-pointer-review npm test`, foreground, 3 m 20 s, exit 1, on a clean tree before
      this file existed. `npm run -s gate:status` (exit 1) prints:
      `20260919T030007Z-4063-b93d [row325-pointer-review] started 2026-09-19T03:00:07.631Z on 5d0977c5 —
      FAIL, exit 1, 2848 passed, 9 failed, 515 skipped, 204/204 suites; failed:
      honest-publish-reporting`. From its JSON record: `dirty: false`, Node `v16.17.0`, 178 suites
      green / 25 skipped / 1 red, `strayErrors` empty. All nine failures are one cause — `require()` of
      the ES module `nostr-tools/lib/esm/pool.js`, the Node-16 artifact in row 288 — and that suite
      names neither changed file. 515 of 3,372 cases (15.3%) did not execute. The Implementer's
      recorded run, `20260919T023315Z-27888-29e3 [row325-pointer-node16]`, is on the same commit with
      the same totals, to the digit.
      **The binding run is CI's Node 22 `stack-free` job on the PR.**
- [x] This review is non-numbered and ends at its Verdict. Checked after writing:
      `awk -f scripts/lib/review-verdict.awk` on this file prints the verdict of the final section, no
      other heading or bold-bearing line carries a verdict token, `bash scripts/harness-lint.sh` is
      still clean with this file appearing only as one new `INFO non-numbered-review` line,
      `harness-lint` and `harness-stats` re-run green with it present, and a search of this file for
      the terms the brief listed under its claim D has zero hits.

## Claims adherence — each claim, with the command that tried to falsify it

| Claim | Evidence | Result |
|---|---|---|
| A. Only two files; in `OPEN.md` only row 325's line | `git diff --numstat 58505ae6 5d0977c5`: `1 1 OPEN.md`, `6 0 …/_intake.md`; one commit, one parent. Own script over both blobs: 386 lines each, line 386 the only one that differs, 436,568 → 437,541 bytes | holds |
| A. 324 rows, max 325, no duplicates | both blobs: 324 rows, highest 325, no number twice, the gap at 257 on both sides | holds |
| A. 7 cells, 8 raw pipes, 0 escaped; the real awk reads `NF=9`, ` ops `, ` OPEN ` | as stated (gates, above). In the new cell backticks, bold markers, double quotes and parentheses balance (36, 12, 14, 14/14) | holds |
| A. Prior Item text a verbatim prefix; other cells byte-identical | split on unescaped pipes: six cells compare equal; the old Item cell (4,082 characters, trailing space included) is a prefix of the new one (5,048); the 966 characters after it (973 bytes — the blob's growth exactly) are the dated note and nothing else | holds |
| A. Intake: one paragraph, immediately before `**Classification:**`, nothing else | head minus a 6-line block at line 2429 (five lines of prose, longest 101 characters, and a blank) equals the base, byte for byte; the block sits in the 2026-09-18 entry, the file's last; the next line begins `**Classification:**` | holds |
| B. "Diagnosed and reproduced" | the private notes read; the local repro run once by this reviewer, in the foreground, and it shows what the notes say it shows; the notes' reading of the code matches the working tree; the notes' claim that this is the only such slip in the area they name survives a broader, tool-assisted check than the search they record. A repeat run was refused by the session's permission system and was not retried; nothing about the result depends on chance | verifies — two refinements for the fix story are in the private report |
| C1. "It is a code defect, it is live and unpatched" | the code the notes point at is the same blob on `origin/main`, on `origin/staging` and on this HEAD; production's last deploy, run `35415087308`, is of `638c4a4b`, which is `origin/main` | holds |
| C2. The quoted phrase "really appears" above | once, in the pre-existing Item text, inside the row's quotation of `OPERATIONS.md` §9.5, followed by "That reading fits what was seen here" — so there was an endorsement to withdraw | holds |
| C2. "this is **not** a spontaneous restart" | supported: B, the timing evidence in the private material, and the two clocked deploys. It is direct for the three occurrences this session watched (#672, #674, #676); for the two older ones it is inference — Non-blocking 1 | fair |
| C3. Runs `35414328429` and `35415087308` | `gh run view`: "Deploy to Staging", push to `staging`, head `58505ae6`, 01:59:32Z–02:01:01Z; "Deploy to Tapestry", push to `main`, head `638c4a4b`, 02:14:50Z–02:16:41Z; both `success`, attempt 1. Run logs: `Container tapestry Started` at 02:00:59.10Z and 02:16:37.59Z | holds |
| C3. "each showed only §9.5's pre-bind gap, followed by unbroken 200s" | the two poll logs, parsed: exactly one run of 502s in each — 30 polls over 33 s on staging, 14 polls over 28 s on production — then 76 and 41 polls of 200 with no break to the end of each log, which is 105 s and 107 s after the container started. In both logs the first 502 falls on `Container tapestry Recreate` in the runner's own log, to the second: the poll clocks are UTC and the logs were written live (each file's birth time is its first line, its mtime its last). The gap ends 6–8 s after `Started`. "Only §9.5's gap" is loose and fair — Non-blocking 3 | holds |
| C4. `get-user-counts` gives `verifiedFollowerCount: null` while Neo4j is down, a number once it is up | the signal's source, read: the three verified counts start as null and stay null while the graph cannot be read, and the reply is still a 200; with the graph up the count comes from a stored property or a bounded count query. The production poll log shows it happen: 12 polls of 200 with a null, then 29 with a number. The watch script derives its up/down label from exactly that field | holds |
| C5. "about 40 s after the container started" | `Started` 02:16:37.59Z; last null reading 02:17:11Z (+33.4 s); first number 02:17:17Z (+39.4 s); the poller stamps a line after the reply arrives. So Neo4j began answering between +33 s and +39 s; "about 40 s" is the first-observed figure, rounded the safe way | holds |
| C6. "the same treatment as the 2026-09-11 intake entry" | that entry (`_intake.md:2390-2403`) holds "file:line, mechanism, severity" out-of-band because items are "live and unpatched", citing `SECURITY.md`. The note withholds the same things for the same stated reason. It follows the stricter of the house's two precedents: ledger row 276, the same audit's row, gives pointer-level detail. The precedent also names a channel, which the note does not — Non-blocking 4 | fair |
| D. Nothing sensitive in the added text | the note, the intake paragraph and the commit message searched, whitespace flattened, for every term the brief listed and thirty-odd more of my own: the only hits are `get` inside `get-user-counts`, the signal the note means to publish. No secret, key material, TA pubkey literal or debug residue | holds |
| D. Read together with the row's earlier public text | the earlier text is on `main` already and is not restated here. Together with it the note narrows where a reader would look; it states no trigger, no mechanism and no location. The operator chose to publish the mitigation knowing this, and the alternative leaves every other session's smoke test unprotected — a second account has a PR open against `staging` today, whose merge will deploy. I would not remove a phrase: what is left after the Implementer's softening is what the advice needs to be usable. What shrinks the exposure is the fix shipping soon — Non-blocking 6 | acceptable |
| D. The commit message, by the same standard | statement by statement it says what the note says and no more; same search, no hit | holds |
| E. An out-of-tree redaction the operator authorized | live; what replaced it is a truthful account of what was done — if anything more exact than the text it replaced; the session's other out-of-tree text (the places the brief named, plus commit messages since 2026-09-17 and the issue tracker) carries no statement of the cause. One operator-only follow-up is still owed; it is in the private report and should come before this branch is pushed | verifies — one item owed |
| F. "Tier 1's 3×200 poll proves Express is up, not Neo4j" | `docs/SMOKE_TEST.md:40` says so itself: "HTTP readiness ≠ Neo4j readiness … the poll endpoint answers `followingCount` from strfry, so it 200s before Neo4j is up"; and C4 | holds |
| F. The signal; "about 40 s … on the production deploy where it was timed"; points at row 325 and says no more | C4, C5; the paragraph's last sentence names the row, says its specifics are held out-of-band, and asks `docs/SMOKE_TEST.md` to gain the same wait. "Before it runs any tier" matches what was done on production: the whole smoke was held, not one step of it | holds |

## Things tests can't catch

- [x] No secret or key material in the added text or the message (scanned for 64-hex strings,
      `nsec1`, `npub1`, `82b75e47`, private-key headers, token shapes, secret assignments, `LEGACY_*`
      and debug residue). The only address in the message is the co-author trailer's.
- [x] **A collision is waiting, and this time it is real.** PR #680 (`docs/task-chip-triage`, another
      account's session, opened 02:20Z against `staging`, `stack-free` green, mergeable) edits row 276
      and appends rows 326–328 directly after the line this branch edits.
      `git merge-tree --write-tree f0453238 5d0977c5` exits 1: content conflict in `OPEN.md`. Whichever
      lands second resolves it by keeping both sides — Non-blocking 5. At 02:54:41Z: `staging` is
      `58505ae6`, `main` is `638c4a4b`, #680 is the only open PR against `staging`, and the highest
      ledger row on the real `staging` is 325.
- [x] **The evidence is perishable, more than usual.** The note rests on two poll logs in a session
      scratchpad, on private notes kept on one machine, and on a repro in the same scratchpad. What
      will last without anyone's care: the two run logs on GitHub, until they expire, which give the
      `Recreate` and `Started` times and nothing about 200s, 502s or the signal — Non-blocking 4.
- [x] **What this reviewer sent to live hosts: nothing.** GitHub API reads only. The local Docker
      stack was looked at read-only (container list, service status, two logs); nothing was stopped,
      restarted or reconfigured.
- [x] No stray worktree (`git worktree list` shows the main tree only; one throwaway was added and
      removed), no stash. Two fetches ran (the roll-up's, and PR #680's head for the merge test); no
      ref this branch is measured against moved. The gate record went to `tmp/`, which is ignored.
      `git status --short` after all experiments shows only this file.

## Findings

### Blocking

None. No statement in either tracked file is false, no other ledger row moved, the added text and
the commit message withhold what they set out to withhold, and lint is clean.

### Non-blocking

**1. "this is not a spontaneous restart" is direct for three occurrences of the five.** For #672,
#674 and #676 the private material ties cause to occurrence. #88 was recorded without the detail that
would tell. The 2026-09-10 one has an ordinary explanation already in the ledger: row 251 says that
smoke's first tiers ran against the previous container while the real deploy arrived late, so its
"late" 502 was most likely the deploy itself. None of the five needs a spontaneous restart, so
withdrawing the reading is sound; the flat sentence is a shade stronger than "nothing recorded here
needs one". Optional, when the cause is recorded: say which occurrences it explains.

**2. "then" follows the fifth occurrence, not the diagnosis.** The two deploys were watched at 02:00Z
and 02:16Z; by the private material's timestamps the local reproduction came after both. Read after
"no clock was kept" in the previous note, "then watched with a clock" is right; read after "the cause
is known", it inverts the order. A prediction confirmed before the reproduction is, if anything,
the better evidence. Optional: "Two deploys had by then been watched with a clock".

**3. Most of each gap precedes `Started`.** The 502s begin at `Container tapestry Recreate` — 27 s
before `Started` on staging, 22 s on production — and end 6–8 s after it. §9.5 describes only the
second part. It is still the one expected gap of a deploy and it still ends when Express binds, so
the note's wording stands; the scripted-smoke story should know that a clock-watched deploy shows
about 30 s of 502, not 5–8.

**4. The row does not say where the specifics are held, and where they are held is fragile.** The
precedent it cites names a channel ("`SECURITY.md` → private advisory"). This material was verified
to exist, but it lives on one machine, part of it in a session scratchpad that the operating system
clears on its own schedule, and no other account's session can read it. A draft advisory is durable,
access-controlled and the channel the policy names; this session's token can neither create nor see
one, so it is the operator's to do. The row could then point at it, which is still a pointer. In the
same spirit: the row stays typed `ops`, so a reader who filters the ledger for `security` rows will
not meet it — the operator's call, and retyping is itself a signal.

**5. For the PR.** Land it as a merge commit, not a squash: this file cites the hash. If #680 lands
first, merge `staging` into this branch rather than rebasing, for the same reason, and keep both
sides of `OPEN.md`; the ledger figures above (324 rows, highest 325, row 325 on the last line) then
describe the branch as reviewed, not the merged result. Hold the PR text to the commit message's
standard. Say in it that the local gate is red on Node 16 for the row-288 reason and that CI's Node
22 job is the binding run. Look at the remote once more immediately before the push.

**6. The fix is the mitigation.** The note is as tight as it can be and still be useful, so the
residual exposure is a matter of how long "until a fix ships" lasts. "A small bug-lane story" should
be the next story. One further consideration for the operator is in the private report.

**7. Left teaching the withdrawn reading, and not this lane's to edit.** `OPERATIONS.md` §9.5
("The brainstorm process can briefly cycle once more…", "retry once") and `docs/SMOKE_TEST.md:21,38`
still say what row 325 now withdraws, as do the three cycle skills the intake entry already lists.
Correcting them now would say more than the row does. The intake paragraph queues the wait for
`docs/SMOKE_TEST.md`; nothing queues the correction of the reading. It belongs with "record the cause
here and close the row".

### Harness friction

**1. The harness has no convention for confidential evidence.** A review is meant to be an evidence
table; this one had to say "verifies" and point at a private report, and the evidence itself sits in
places that will not survive (Non-blocking 4). Worth a `meta` row: where such material is held, who
can read it, and the step that folds it back into the record once the fix ships.

**2. Two sessions edited the ledger's tail at once again** (row 307's family) — the second time in a
day, and this time a real conflict rather than a near miss (PR #680).

**3. The repro could be run once.** The permission system allowed the first foreground run and
refused a repeat of the same command. One run sufficed here; a brief that says "run it yourself"
cannot assume more than one.

**4. Row 316 recurred:** the wiring says commit and flip, the brief reserves both, and the brief was
followed.

## Verdict

**PASS**

Every statement the change writes into a tracked file checks out. The ledger moved in one line only,
by a pure append to one cell; the row still parses; the intake entry gained one paragraph in the
right place and is still listed as unmarked. "Diagnosed and reproduced" is true: the private notes,
the local repro and the working tree agree, and the code in question is what `main` and production
are running. The two clocked deploys are what the note says they are — GitHub's run logs agree with
the poll logs to the second — and each shows one expected gap and then 200s to the end of the log.
The readiness signal behaves as described in its source and in the production log, and "about 40 s"
is 39.4. The comparison with the 2026-09-11 entry is fair.

On confidentiality: the added text and the commit message contain none of what they set out to
withhold. Read beside the row's older public text the note does narrow a reader's search; the
operator accepted that to get the mitigation in front of other sessions, and I would not cut a phrase
— the remedy is the fix, soon. Two things are the operator's to do and neither is a defect of this
diff: one follow-up that should precede the push, and a durable home for the specifics. Both are in
the private report.

Lint is clean and identical to the base's, and the nine suites that read either changed file, or
that the brief named, are green on this commit. The local full gate, re-run here, is red for the
recorded Node 16 reason with 15.3% of cases skipped; that is accepted for a two-file documentation
change and it is not a green gate. CI's Node 22 job on the PR is the binding run. This lane has no
story to flip and no book to close; the commit is the orchestrator's, and PR #680 has to be reckoned
with before the merge.
