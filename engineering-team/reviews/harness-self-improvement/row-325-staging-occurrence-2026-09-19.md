# Review: row 325 — the late 502 window's first recorded staging occurrence (a retitle and a dated note)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19 (UTC; the evening of 2026-09-18 locally)
**Diff:** one commit, `be9dea25` (branch `docs/row-325-staging-occurrence`, unpushed at review time), on
`d0bf447d` — PR #676's merge, which was `origin/staging` when the branch was cut. `git show be9dea25`
is the whole surface: `OPEN.md`, 1 insertion and 1 deletion, line 386 (row 325).
**The remote `staging` moved after the branch's commit** — to `5ab7e776` (PR #677, merged
2026-09-19T01:00:55Z, fourteen minutes later). It does not collide; see the gates.
**File:** non-numbered by convention — this lane has no story to match (`workflows/0-intake.md` §3).
**Lane:** doc/one-liner (Implementer + Reviewer, Standard strictness). No story / ADR / test plan and
no book by design.

The brief reserved the commit for the orchestrator. This reviewer created this one file and nothing
else: no commit, no add, no push, no branch switch, no edit to any other tracked file. The smoke
transcript behind the new note is the Implementer's attestation and cannot be re-observed; the table
says where a claim rests on it and what the run logs could corroborate.

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` on `be9dea25` → **clean (0 violations)**, exit 0, 35 lines. Run
      again in a throwaway worktree on the real `staging` (`5ab7e776`) and on the merged result
      (that tree with this branch's `OPEN.md`): all three outputs are byte-identical, so the change
      adds no waiver, no INFO line and no violation. Worktree removed afterwards.
- [x] **Mergeability against the real `staging`: clean.** `git ls-remote origin refs/heads/staging`
      is `5ab7e776`, not `d0bf447d`. `git merge-tree --write-tree 5ab7e776 be9dea25` exits 0 with no
      conflict; the merged tree differs from `5ab7e776` in `OPEN.md` alone, and its `OPEN.md` is this
      branch's blob. PR #677 touched one file, `engineering-team/audits/curated-dlist-update/audit.md`
      (+22 / −5); `OPEN.md` is byte-identical on `d0bf447d` and `5ab7e776`, so every ledger check
      below holds against the real base as well.
- [x] **Seven suites**, each through its `run()` export (row 310), in the foreground, host Node
      v16.17.0, on `be9dea25`: `harness-lint` 41 passed / 0 failed (56 s, including "the real repo
      lints clean"), `harness-stats` 12 / 0 (73 s), `session-start` 10 / 0 (25 s),
      `operational-direction` 76 / 0 (10 skipped), `curated-dlist-update-update-preview` 34 / 0,
      `curated-dlist-update-publish` 69 / 0, `gate-result-record` 34 / 0 (20 s). The grep the brief
      asked for, with code lines separated from comment lines: 59 files under `test/` mention the
      ledger, 26 on a code line, and of those only three open the real file
      (`path.join(ROOT, 'OPEN.md')`: the two `curated-dlist-update-*` suites and
      `operational-direction`); two more reach it through the scripts they run (`harness-lint`, and
      `session-start` by way of `collect_meta`). The rest cite a row number in an assertion message.
      `harness-stats` and `gate-result-record` name the ledger nowhere, and neither does
      `scripts/harness-stats.sh`; they were run because the brief listed them. `harness-stats` tallies
      review files, so it bears on this file rather than on the diff; it and `harness-lint` were run
      again with this file present: 12 / 0 and 41 / 0.
- [x] **The real parser over the row** (the awk from `scripts/lib/collect-meta.sh:34`): `NF=9`, `$3`
      is ` ops `, `$5` carries `2026-09-18`, `$6` is ` OPEN `. The open-meta selection is the same
      106 row numbers on both blobs (`diff`: empty), and row 325 is not among them — which matters
      for claim B.
- [x] **The roll-up** (`scripts/whats-open.sh`, redirected to a scratch file, exit 0, 380,193 bytes):
      row 325 appears once, at output line 235, inside the ledger section, printed whole (4,224
      bytes). It does not appear in the "Meta items" section. The output holds exactly one invalid
      UTF-8 position — row 193's, as row 290 describes — and nothing new.
- [ ] **Full gate: red on this host — re-run by this reviewer, and not a green gate.**
      `GATE_LABEL=row325-review npm test`, foreground, 3 m 18 s, exit 1, started on a clean tree
      before this file existed. `npm run -s gate:status` (exit 1) prints:
      `20260919T012002Z-54605-799e [row325-review] started 2026-09-19T01:20:02.259Z on be9dea25 —
      FAIL, exit 1, 2848 passed, 9 failed, 515 skipped, 204/204 suites; failed:
      honest-publish-reporting`. From `tmp/gate-runs/20260919T012002Z-54605-799e.json`: commit
      `be9dea25`, `dirty: false`, Node `v16.17.0`, 178 suites green / 25 skipped / 1 red,
      `strayErrors` empty. All nine failures are one cause — `require()` of the ES module
      `nostr-tools/lib/esm/pool.js`, the Node-16 artifact in row 288 — and that suite names the
      ledger nowhere (grep count 0). 515 of 3,372 cases (15.3%) did not execute. The Implementer's
      recorded run, `20260919T004646Z-74453-0c1d [row325-append-node16]`, is on the same commit with
      the same totals, to the digit. It is accepted as evidence for a one-line ledger edit whose
      reading suites are green above, and it is not a green gate.
      **The binding run is CI's Node 22 `stack-free` job on the PR.**
- [x] This review is non-numbered and ends at its Verdict. Checked after writing:
      `awk -f scripts/lib/review-verdict.awk` on this file prints the verdict of the final section, no
      other line that is a heading or carries bold contains a verdict token, and
      `bash scripts/harness-lint.sh` re-run with this file present is still clean, exit 0, with this
      file appearing only as one new `INFO non-numbered-review` line.

## Claims adherence — each claim, with the command that tried to falsify it

| Claim | Evidence | Result |
|---|---|---|
| A. Only `OPEN.md`, and in it only row 325's line | `git diff --numstat d0bf447d be9dea25`: `1 1 OPEN.md`, one commit, one parent. Own script over both blobs: 386 lines each, line 386 the only one that differs, 434,937 → 436,017 bytes | holds |
| A. 324 rows, max 325, no duplicates | both blobs: 324 rows, highest 325, no number twice, the gap at 257 on both sides | holds |
| A. 7 cells, 8 raw pipes, 0 escaped; the real awk reads `NF=9`, ` ops `, ` OPEN ` | as stated (gates, above). Backticks, bold markers, single asterisks, parentheses and double quotes all balance in the new cell (26, 6, 6, 10/10, 8) | holds |
| A. Type / Opened / Status / Done / Pointer byte-identical | split on unescaped pipes: every cell but Item compares equal | holds |
| B. The retitle, as quoted in the brief | old title 175 characters, new 220, both exactly as the brief gives them | holds |
| B. Apart from the title and the additions, the Item cell is staging's | the old body — all 2,287 characters after the old title's closing bold, trailing space included — sits intact inside the new cell. Before it: a 183-character retitle note. After it: the 842-character note. Nothing else | holds |
| B. The quotation of the old title is fair | the quoted stem is a verbatim 86-character prefix of the old title, closed with U+2026. The elided remainder (" — *after* it has already answered three consecutive 200s — and nothing tracks fixing it.") survives in the new title word for word but for "and" → ";". The ellipsis hides nothing that changed | holds |
| B. A marked retitle is acceptable here | the ledger's written rule is "Flip Status to `DONE` (don't delete)"; nothing forbids a marked edit. Row 71's precedent (`b415d354`) went further than this does: it replaced the title, did not quote the old one, and dropped half the body. This change quotes what it replaced, points at the dated note, and keeps the body byte for byte | acceptable |
| B. "`/whats-open` prints a row's first 150 characters (`collect-meta.sh:33`)" — the stated reason | true of open `meta` rows only. Line 34 feeds that loop `awk -F'\|' '$3 ~ /meta/ && $6 ~ /OPEN/'`; row 325's `$3` is ` ops `; the filter selects 106 rows and row 325 is not one (`grep -c`: 0). `scripts/whats-open.sh:31` prints every open row whole, and the real output has row 325 once, at 4,224 bytes. No script truncates an `ops` row | **fails — Blocking 2** |
| B. The byte-150 hazard (row 290) | cannot arise for this row: the `cut` never receives it. Run anyway on the new text: `LC_ALL=C cut -c1-150` gives 150 bytes of valid UTF-8, 148 characters, ending "three consecuti"; under `en_US.UTF-8`, 150 characters ending "three consecutive". The first em-dash lies wholly before byte 150, the second after it. Were the row ever retyped `meta`, its first 150 would read sensibly and no longer say "Production" | no defect introduced |
| C. Run `35408387041` | `gh api …/actions/runs/35408387041`: path `.github/workflows/deploy-staging.yml`, `success`, attempt 1, head `d0bf447d…`, created 2026-09-19T00:09:46Z, updated 00:11:22Z. `gh pr view 676`: merged 00:09:44Z as `d0bf447d`. The log: `Updating 6c24e128..d0bf447d`, `Fast-forward`, and `Container tapestry Started` at 00:11:17.5Z | holds |
| C. "No other staging deploy overlapped — the previous one had finished 72 minutes earlier"; not row 183's race | every Actions run of any workflow created 23:00Z–01:10Z: three `test.yml` runs on PRs (one cancelled) and two `deploy-staging.yml` runs (00:09:46Z–00:11:22Z, and #677's at 01:00:58Z–01:02:27Z). The previous deploy, `35403660371`, finished 22:57:36Z: 72 min 10 s before this one began. Row 183 is "Concurrent staging deploys raced and downed the site" | holds |
| C. "the same script that ran on #673 and #674, unmodified" | `stat` on the scratchpad `smoke.sh`: birth = mtime = ctime = 2026-09-18T22:11:15Z — 26 s after #673's deploy finished (22:10:49Z), before #674's (22:15:58Z), and untouched since; ctime cannot be set back by `touch`. That it ran on both is attestation, accepted in the previous review on the same footing. Read, not run | holds |
| C. "three 200s and eleven clean sanity checks", "0.14 s", "and on the search call", "`502 200 200 200`", "the repeat was clean" | the evidence file's last section (attestation): codes `200 200 200`; "eleven sanity checks all 200"; `502 0.143772s get-user-data`; `502 search jack → hits=NOT-JSON`; "stable after 4x2s polls — codes: 502 200 200 200"; "repeat clean", where clean includes the documented 504-with-JSON. The script's loop does name eleven paths (7 pages, 4 APIs). The note says no more than this shows | holds |
| C. "2026-09-19T00:11Z" | the container started 00:11:17Z and the run finished 00:11:22Z. The evidence has no clock for the smoke; the script's shape (three polls at 2 s, a 5 s settle, eleven quick requests) puts the 502 about a quarter of a minute after it started, so most probably inside the same minute | fair — Non-blocking 3 |
| C. Staging 0 enabled scheduled entries, production 3 | `curl -s https://<host>/api/deploy-safety/status` at 01:10:53Z: `schedule.enabledEntryCount` 0 and 3, both `verdict: safe`. The script read 0 on staging right after the occurrence (attestation) | holds |
| C. "The scheduled-entries lead above is much weaker" | an instance with no enabled entry showed the window, so the entries are not necessary to it. "Much weaker" rather than "dead" is the right strength: they could still bear on how often or how long | fair inference |
| C. "the defect can be chased on staging" | shown once, so reachable there. How often is unknown — one of the three staging deploys this session watched — which is why the denominators in the next row matter | fair inference |
| C. "That staging's two deploys on 2026-09-18 did not show it still stands" | the hedge that follows is fair. The count is not: `gh api …/workflows/deploy-staging.yml/runs?created=2026-09-18T00:00:00Z..2026-09-18T23:59:59Z` lists seven runs that day (#666, #667, #668, #669, #671, #673, #675), and each log shows the `tapestry` container restarted. No time zone makes it two (UTC 7, EDT 7, PDT 5). The note's own "previous one" is one of the other five | **fails — Blocking 1** |
| D. "four recorded occurrences that this row knows of, every one on production", left in the body | reads as chronology, not as a falsehood: it is scoped ("that this row knows of"), the reader has already met the new title and "see the last note", and the new note numbers itself "fifth … first on staging", building on the four rather than contradicting them | acceptable |
| D. The intake entry (`_intake.md:2413-2414`): "Production hit exactly that window on both of the day's deploys (OPEN.md row 325)" | still true after this change — it says production hit it, not that only production does — and its "day's deploys" are scoped in the paragraph before it to "the stranded-close session … four deploys in one day (#671 → #672, #673 → #674)" | holds |
| D. Any other tracked file made wrong by this change | flattened sweep of every tracked `.md` for production-only and staging-never phrasings: none. `docs/SMOKE_TEST.md:21,38` and `OPERATIONS.md:363` record particular production occurrences; `cycle-staging/SKILL.md:157` already expects a post-stability 502 on staging. Now incomplete rather than wrong — Non-blocking 7 | holds |
| E. The commit message | two statements fail (the 150-character reason; "staging's two deploys"), two are loose — Non-blocking 6 | **fails — Blocking 2, and 1's echo** |

## Things tests can't catch

- [x] No secret, credential or key material in the added text or the message, and no TA pubkey
      literal (CLAUDE.md § "Per-deployment TA pubkey"): scanned for 64-hex strings, `nsec1`, `npub1`,
      `82b75e47`, private-key headers, token shapes, secret assignments, `LEGACY_*` and debug
      residue — no hit.
- [x] **No collision this time, and the reason is luck of subject.** A concurrent session opened
      PR #677 three seconds after this branch's commit and merged it at 01:00:55Z. It touched one
      audit file. Had it appended a row 326, that would have been a textual conflict with this edit
      of the ledger's last line. At 01:26:10Z, and again at 01:34:59Z: `staging` is `5ab7e776`, `main`
      is `cf3afd66`, no open PR targets `staging`, #677 is the newest PR, and the highest ledger row
      on the real `staging` is 325. At the first look every remote branch tip was already in this
      clone.
- [x] **The evidence is perishable.** The note rests on session output and a scratchpad script.
      What will last: run `35408387041`, whose log gives the container start used above, until
      GitHub expires it.
- [x] **What was sent to live hosts.** Two read-only `GET`s of `/api/deploy-safety/status`, one to
      staging and one to production. `smoke.sh` was read, not run.
- [x] No stray worktree (`git worktree list` shows the main tree only; one throwaway was added and
      removed), no stash. **One side effect the orchestrator should know:** `scripts/whats-open.sh:205`
      runs `git fetch -q origin main staging`, so running the roll-up moved this clone's
      `origin/staging` from `d0bf447d` to `5ab7e776`. `git log origin/staging..HEAD` still shows the
      one commit; a two-dot `git diff origin/staging..HEAD` now also shows #677's audit file in
      reverse. The gate record went to `tmp/`, which is ignored. `git status --short` after all
      experiments shows only this file.

## Findings

### Blocking

**1. `OPEN.md:386` — "That staging's two deploys on 2026-09-18 did not show it still stands."**
Staging was deployed seven times on 2026-09-18, not twice, and the note itself knows of a third: its
"previous one", run `35403660371`, is PR #675's staging deploy, finished 2026-09-18T22:57:36Z. What
is true is narrower — the two staging deploys this row watched that day, #671 and #673, did not show
it. Nothing tracked records a smoke result for the other five (every tracked text file searched for
their PR numbers and run ids within 160 characters of smoke, 502, stability, poll or tier: no hit).
It matters because the row reasons from frequency ("both", "neither", "four … every one on
production", now "fifth … first on staging"), and this note's own second inference invites a reader
to size up staging's hit rate; "0 of 2, then 1 of 1" and "0 of the 2 watched out of 7, then 1 of the
1 watched" are different pictures. The frame is inherited from the
body — Non-blocking 1 — but this sentence is new, states the number outright, and is the last thing
the row says. Asked change: scope the count to what was watched. Offered as a claim to check, not
text to adopt (role step 10): "That the two staging deploys this row watched on 2026-09-18 (#671 and
#673) did not show it still stands — they were two of the seven that day, as #672 and #674 were two
of production's three, and nothing here records what the others showed; with a window a few seconds
wide, a clean pass is weak evidence of absence." The counts come from the two workflows' run lists
for that UTC date. The commit message repeats the phrase and should follow.

**2. Commit `be9dea25`, message — "because its first 150 characters are what /whats-open prints".**
Not for this row. The 150-character cut at `scripts/lib/collect-meta.sh:33` sits in a loop fed only
open `meta` rows (line 34); row 325 is `ops`, and the roll-up prints it whole
(`scripts/whats-open.sh:31`; 4,224 bytes at output line 235). The retitle survives without it: the
bold title is what a reader meets first on every surface that shows the row, "Production drops to
502" does now understate it, and row 71 is precedent. But the sentence gives a false account of the
harness as the reason for the one part of this change that bends a habit, in a record that cannot be
edited once it is pushed — and it can be edited now: the branch is unpushed and no tracked file cites
the hash. Asked change: reword while folding in the fix for 1. Offered, again as a claim to check:
"…because the bold title is what a reader meets first, and 'Production drops to 502' now understates
it. (The roll-up prints an `ops` row whole; the 150-character cut in `collect-meta.sh` applies to
open `meta` rows only.)"

### Non-blocking

**1. The body's "Seen on both production deploys of 2026-09-18" has the same fault, and it is already
on `staging`.** Production was deployed three times that day: run `35310343204` (PR #670) at
05:19Z–05:20Z, then the two the row names. Only in Pacific time were there two, and the row keeps
UTC. It is outside this diff, and three rounds of the previous review — this role's — verified that
the four named runs exist without ever listing the day's runs. Since this lane exists so that `main`
never carries a version of the row known to be off, the dated note that answers Blocking 1 is the
natural place to scope this too; the wording offered there does.

**2. The #673 clean pass probably could not have seen the window at all.** That staging container
started at 22:10:45Z and `smoke.sh` was not born until 22:11:15Z, so the scripted pass began no
sooner than 30 s after the start and reached `get-user-data` no sooner than about 43 s after it. On
#676 the 502 is estimated at 20–35 s after the container started (inferred from the script's shape;
the evidence has no clock). So "like for like" in the body is true of the script and not of the
moment it ran. This is a reviewer's inference, offered because it strengthens the note's closing
hedge and is useful to whoever chases the defect: start the poll at once, and log a clock.

**3. "2026-09-19T00:11Z".** Fair to the minute, and most probably the minute of the 502 itself, but
not shown by a clock. Optional: "just after 00:11Z".

**4. "the first on staging"** is the first this row knows of; the body's "that this row knows of"
carries over by implication. Staging was deployed again at 01:00Z by another session, and nothing
records what that showed. Optional: "the first recorded on staging".

**5. "the same window"** (retitle note) is an identification by signature: three 200s, eleven clean
checks, an instant nginx 502 at 0.14 s on the same call, gone within seconds. That is good grounds,
and still an inference while the row says "Not diagnosed".

**6. Commit message, loose rather than false.** "an hour after the row landed": the row landed at
00:09:44Z and the commit is 00:46:37Z, 37 minutes. "Everything after the title is unchanged": the
old body is, byte for byte; a 183-character retitle note now sits between the two, which the
sentence before it does disclose.

**7. Left incomplete by this change, and not this lane's to edit.** `docs/SMOKE_TEST.md:21,38` and
`OPERATIONS.md` §9.5 ("observed once") know of production occurrences only; the intake entry cites
row 325 for production alone; the previous review's title calls it "production's late 502". None is
made false. They belong with the section-number fixes the intake entry already lists.

**8. For the PR.** Land it as a merge commit. Say in the body that the local gate is red on Node 16
for the row-288 reason and that CI's Node 22 job is the binding run. No rebase is needed for content;
look at the remote once more immediately before the push.

### Harness friction

**1. Running the roll-up moves the base ref.** `scripts/whats-open.sh:205` fetches `main` and
`staging`, so a reviewer told to run it and to compare against `origin/staging` has the second
instruction changed by the first. Pin the base by SHA in the brief, or have the roll-up say when its
fetch moved a ref.

**2. Row 290 (b) reads as though every ledger row were cut at 150.** "trims each listed row" means
each row listed in the Meta items section; the scoping ("among the meta rows") comes a sentence
later. That is the likeliest source of Blocking 2. Worth a clause in row 290: "open `meta` rows only
— other Types print whole".

**3. "That day's deploys" went unnoticed through three review rounds.** A session counts its own
deploys as the day's, and so did its reviewer. The check that catches it costs one call: list the
workflow's runs for the date before writing "both", "neither" or a number.

**4. `staging` moved under an unpushed ledger branch again** (row 307's family) — harmless here only
because #677 left the ledger alone.

**5. Row 316 recurred:** the wiring says commit and flip, the brief reserves both, and the brief was
followed.

## Verdict

**CHANGES_REQUESTED**

The change is sound in everything but one number and one reason. Scope and ledger integrity hold
against the branch's base and against the real `staging`, which moved and does not collide. The
retitle is a fair, marked edit with a better pedigree than its precedent, the old body survives byte
for byte, and the quotation hides nothing. Every figure in the new note matches the Implementer's
evidence, the run and its times check out against GitHub to the second, "72 minutes" is right, the
script is provably the one born before #674 and untouched since, both scheduled-entry counts
reproduce, and the two inferences are inferences of the right strength. The byte-150 defect the brief
feared cannot occur: the cut never sees an `ops` row, and would land cleanly if it did.

Two things stop it. The note's last sentence says staging had two deploys on 2026-09-18; it had
seven, and the note cites one of the other five itself. And the commit message explains the retitle
by a truncation that does not apply to this row. Both are a clause each, both fold into one amended
commit on an unpushed branch, and the wordings offered above are claims for the next round to check.
The body's matching slip about production is older than this diff and is best scoped in the same
note.

Lint is clean and identical to the real base's, and the seven suites the brief named — five of
which reach the ledger — are green on this commit. The local full gate, re-run here, is red for the recorded Node 16 reason with 15.3%
of cases skipped; that is accepted for a one-line ledger edit and it is not a green gate. CI's Node
22 job on the PR is the binding run. This lane has no story to flip and no book to close; the commit
is the orchestrator's.
