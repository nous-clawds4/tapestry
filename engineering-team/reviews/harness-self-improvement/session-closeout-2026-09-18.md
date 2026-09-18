# Review: session close-out — row 323 (production's late 502), row 290's refinements, story `developers-pages` #1 to Done with row 321 closed, and a smoke-script intake entry

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18
**Diff:** four commits on `origin/staging` as this clone had it, `9dfe89f5` (branch
`docs/session-closeout-2026-09-18`, unpushed at review time): `8c683441` (row 323 new, row 290
refined), `d2c5232f` (story flipped with its `## Deviations` and Linked-artifacts note, row 321
closed), `529d6b29` (the intake entry), `760e7bb1` (row 323 wording correction).
**The remote `staging` moved while this review was running** — Blocking 1.
**File:** non-numbered by convention — this lane has no story to match (`workflows/0-intake.md` §3).
**Lane:** doc/one-liner (Implementer + Reviewer, Standard strictness). No story / ADR / test plan and
no book by design.
**Scope:** 3 paths, 44 insertions and 9 deletions — `OPEN.md` (+3 / −2),
`engineering-team/stories/_intake.md` (+31), and
`engineering-team/stories/developers-pages/1-multipage-developers.md` (+10 / −7). No source file, no
test file, no harness-definition path.

The brief reserved the commit and every status flip for the orchestrator. This reviewer created this
one file and nothing else: no commit, no add, no push, no flip, no edit to any other tracked file.
There is no browser here; wherever a claim rests on a rendered page or a console, the table below says
it is the Implementer's attestation and gives what `curl` could corroborate.

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` on `760e7bb1` → **clean (0 violations)**, exit 0. Run again on
      `9dfe89f5` in a throwaway worktree and diffed: the two outputs are byte-identical (34 lines), so
      the flip added no waiver, no INFO line and no violation.
- [x] **L14's silence on the flipped story means something.** Control, throwaway worktree at HEAD, one
      line recording a round's verdict appended to the story: `VIOLATION L14
      engineering-team/stories/developers-pages/1-multipage-developers.md — 1 line(s) record gate
      verdicts…`, exit 1. The real file carries no such token. Worktree removed afterwards.
- [x] **L10 is not engaged.** `scripts/harness-def-paths.txt` lists none of the three changed paths,
      and says why: "Records of work — stories/, reviews/, decisions/, audits/, OPEN.md, handoffs — are
      deliberately NOT listed". No CHANGELOG row is owed, and none was added.
- [x] **Nine suites that read a changed file**, each through its `run()` export (row 310), in the
      foreground, host Node v16.17.0, on `760e7bb1`: `harness-lint` 41 passed / 0 failed (56 s,
      including "the real repo lints clean"), `harness-stats` 12 / 0 (72 s), `session-start` 10 / 0
      (26 s), `operational-direction` 76 / 0 (10 skipped), `curated-dlist-update-update-preview`
      34 / 0, `curated-dlist-update-publish` 69 / 0, `gate-result-record` 34 / 0 (21 s), and two the
      brief did not list, both of which open `engineering-team/stories/_intake.md`:
      `kill-timeout-orphans-by-default` 9 / 0 (its I1 asserts a section header there) and
      `note-tagging-raw-events-inspector-ui` 32 / 0 (its U23 reads an entry's marker). Found by
      separating code lines from comment lines in a grep of `test/` for the three changed paths: a raw
      grep returns 151 files, and most of those hits are header comments citing a story.
- [x] **The real parser over the three rows** (the awk from `scripts/lib/collect-meta.sh:34`): rows
      290, 321 and 323 each read `NF=9`, Type in `$3` (`meta`, `cleanup`, `ops`), Status in `$6`
      (`OPEN`, `DONE`, `OPEN`); line 26's date extraction takes `2026-09-12`, `2026-09-18` and
      `2026-09-18` from `$5`. The open-meta selection is the same 106 row numbers on `9dfe89f5` and
      here (`diff` of the two lists: empty).
- [x] **The roll-up** (`scripts/whats-open.sh`, redirected to a scratch file, exit 0, 910 lines): the
      new intake entry is listed under "Intake entries with no PICKED UP / RESOLVED marker" (output
      line 769); row 323 appears in the ledger section, so a Type of `ops` is not invisible; row 321
      is gone from it; row 290 is still there. The output holds exactly one invalid UTF-8 position —
      row 193's stray `0xe2`, as row 290 describes — and nothing new.
- [ ] **Mergeability against the real `staging`: fails.** `git ls-remote origin refs/heads/staging` is
      `6c24e128`, not `9dfe89f5`. A trial merge in a throwaway worktree (the commit fetched by SHA, so
      this clone's `origin/staging` ref was not moved): `CONFLICT (content): Merge conflict in
      OPEN.md`, and the conflicted file holds two lines beginning `| 323 |`. Blocking 1.
- [ ] **Full gate: red on this host — re-run by this reviewer, and not a green gate.**
      `GATE_LABEL=closeout-review npm test`, foreground, 3 m 20 s, exit 1. `npm run -s gate:status`
      (exit 1) prints:
      `20260918T230337Z-71240-29d9 [closeout-review] started 2026-09-18T23:03:37.404Z on 760e7bb1 —
      FAIL, exit 1, 2848 passed, 9 failed, 515 skipped, 204/204 suites; failed:
      honest-publish-reporting`. From `tmp/gate-runs/20260918T230337Z-71240-29d9.json`: commit
      `760e7bb1` (the HEAD under review), `dirty: false`, Node `v16.17.0`, 178 suites green / 25
      skipped / 1 red, `strayErrors` empty. The one red suite is `honest-publish-reporting` (1 passed,
      9 failed). All nine failures are one cause — `require()` of the ES module
      `nostr-tools/lib/esm/pool.js`, the Node-16 artifact in row 288; eight print Node's message
      without the code name and the ninth, from a child process, prints `ERR_REQUIRE_ESM` — and that
      suite references none of the changed files (grep count 0). 515 of 3372 cases (15.3%) did not
      execute, because Node 16 has no global `fetch` and the live suites skip. It is accepted as
      evidence for this diff because the diff touches no source and no test, every suite that reads a
      changed file is green above, and the single red suite is red for a recorded host reason.
      **The binding run is CI's Node 22 `stack-free` job on the PR.**
- [x] This review is non-numbered and ends at its Verdict. Checked after writing:
      `awk -f scripts/lib/review-verdict.awk` on this file prints the verdict of the final section, no
      other line that is a heading or carries bold contains a verdict token, and
      `bash scripts/harness-lint.sh` re-run with this file present is still clean, exit 0, with this
      file appearing only as one new `INFO non-numbered-review` line.

## Claims adherence — each claim, with the command that tried to falsify it

| Claim | Evidence | Result |
|---|---|---|
| A. Three paths; no harness-definition path; no source, test, secret or TA literal | `git diff --stat origin/staging..HEAD`: the three files above and nothing under `src/`, `test/`, `ui/`, `scripts/`, `.claude/`, `.github/`, `bin/`, `docker/`. The 44 added lines and the four commit messages scanned for 64-hex strings, `nsec1`, `npub1`, `82b75e47`, private-key headers, token shapes, secret / password / token assignments, the `LEGACY_*` constants, and debug residue: no hit | holds |
| B. Versus `9dfe89f5`: rows 290 and 321 changed, row 323 added last, nothing else; structure intact | own script over both blobs: 383 → 384 lines, 321 → 322 rows, no duplicate number on either side, the gap at 257 present on both, every non-row line identical, common rows in the same order. Rows 290 (`:348`), 321 (`:382`) and 323 (`:384`) each have 7 cells, 8 raw pipes, 0 escaped, balanced backticks and bold. For 290 and 321 the staging Item cell is a verbatim `str.startswith` prefix of HEAD's (1408 → 2497 and 1350 → 1926 characters); 290's other six cells are byte-identical; 321 differs only in Item, Status (`OPEN` → `DONE`) and Done. Confirmed against the real parser (gates, above) | holds against `9dfe89f5` |
| B. "323 = staging's max + 1" | true of `9dfe89f5` (max 322). **Not true of `staging` as it is now:** PR #675 (`docs/dog-tricks-live-test`, opened 22:52:33Z, merged 22:56:02Z as `6c24e128`) added rows 323 and 324 and amended row 297. This branch's last commit is 22:44:50Z, so the Implementer could not have seen it | **fails — Blocking 1** |
| B. Row 321's Done cell `2026-09-18 (session-closeout PR)` is a placeholder | `fdd697b1` (2026-09-17, "substitute PR #667 into the nine ledger-closeout Done cells") did exactly this substitution for nine rows. Owed by the orchestrator once the PR number exists; not a defect | holds — owed |
| C. Both run ids are successful `deploy-tapestry.yml` runs on the merge commits of #672 and #674; the two staging runs exist | `gh api …/actions/runs/<id>`: path `.github/workflows/deploy-tapestry.yml`, `success`, head `06a3c1f6` and `cf3afd66`; `gh pr view`: those are the merge commits of #672 (20:45:06Z) and #674 (22:14:03Z). Staging runs `35379673317` (on `580bce5c`, #671) and `35400245333` (on `9dfe89f5`, #673): "Deploy to Staging", `success`. All four created / updated times equal the evidence file's to the second, and both production logs carry the `Updating …` / `Fast-forward` lines it quotes | holds |
| C. The row says no more than the evidence shows: counts and timings | evidence file read in full (attestation). Three 200s on the first three polls, both deploys; 7 pages + 4 APIs = eleven 200s, both deploys; `get-user-data` 502 at 0.142349 s and 0.123522 s ("0.14 s and 0.12 s"); search after it: a 502 on the second deploy, a non-JSON body with no code captured on the first; re-poll `502 502 200 200 200` on the second, `200 200 200` on the first; the repeat clean both times, where "clean" includes the documented 504-with-JSON from `get-user-data` (`docs/SMOKE_TEST.md:52`) | holds |
| C. "within the first minute after a deploy" | the run logs put `Container tapestry Started` at 20:46:39.0Z and 22:15:47.6Z (the deploy is a single SSH step that ends there). Deploy 1: the evidence has the re-run starting 20:47:26Z with the 502 already over, so it fell within 47 s of container start. Deploy 2: the evidence carries no clock for the smoke; the bound is an inference from the script's shape (three polls at 2 s, a 5 s settle, eleven quick requests) | deploy 1 shown; deploy 2 inferred — Non-blocking 2 |
| C. "Neither staging deploy that day did this under the same script and sequence" | the evidence file's own note: "the #671 staging smoke was typed by hand (not the script), in the same tier order". The scratchpad's `smoke.sh` was born 2026-09-18T22:11:15Z (`stat`, birth = mtime) — after the #671 deploy (18:22Z) and after production's first (20:46Z), whose transcript is two hand-run passes in a different output format. Only #673 and #674 ran the script | **overclaims — Blocking 2** |
| C. `docs/SMOKE_TEST.md` records the same late window on two earlier production deploys, as quoted | `:21` "the brainstorm process can briefly cycle once more after first appearing stable, observed during the #88 production deploy"; `:38` "**The cycle can also come later:** on the 2026-09-10 production deploy the poll saw 3×200, Tier 2 ran clean, and a 502 window opened ~20–30 s after the settle, mid-Tier 3". The quotation is exact, the pointer's phrase is in Tier 1, and 2 + 2 = four, all production | holds |
| C. "It is **not** the window `OPERATIONS.md` §9.5 explains" | §9.5's title and mechanism are the gap before Express first binds, and the 3×200 recipe is there to wait it out: fair. But §9.5 also has a "Post-stability flicker" paragraph — "observed once on the #88 production deploy … The brainstorm process can briefly cycle once more after first appearing stable" — which is this window, and the same reading the row offers as its own | fair, incomplete — Non-blocking 1 |
| C. Row 251 is DONE and taught the recipe to repeat the tier | row 251 (`meta`, Status `DONE (2026-09-10 — …)`): "production cycled once more ~20 s after the first 3×200 … so a single retry is not enough", fix candidate "re-run the Tier 1 poll after the settle instead of a single retry"; `docs/SMOKE_TEST.md:38` carries that rule and cites the row | holds |
| C. Production runs 3 enabled scheduled entries, staging 0 | `curl -s https://<host>/api/deploy-safety/status` at 22:51:05Z: `schedule.enabledEntryCount` 3 and 0, both `verdict: safe` | holds |
| C. "and carries the larger data set" | not in the evidence file. From public endpoints the picture is mixed: `…/meili?q=jack` estimates 372 hits on production and 314 on staging (broader queries cap at 1000 on both); `get-user-counts` for the smoke pubkey reports 19,252 verified followers on production and 19,470 on staging; `get-user-data` is documented as timing out at ~16 s on both (`docs/SMOKE_TEST.md:52`), and the evidence file shows exactly that. No doc in the repo compares the two | **unsupported — Blocking 3** |
| C. The pointer: `docs/SMOKE_TEST.md:19` and `cycle-staging/SKILL.md:157,164` cite the section as §8.5 and §8; §8 is now "Active tracking issues" | all three lines read as stated; `OPERATIONS.md:292` is `## 8. Active tracking issues`, `:343` is `### 9.5.`; the renumbering is `44975ffc` (2026-05-14). Two more citers the pointer does not name: `BIBLE.md:1407` ("§8.5/§8.6") and `cycle-prod/SKILL.md:162` ("§8.2") | holds, not exhaustive — Non-blocking 4 |
| C. The hypothesis is marked as undiagnosed | "which reads like", then in bold "Not diagnosed — no server log was read", then two leads phrased as questions | holds |
| C. Not a duplicate | every row on `9dfe89f5` mentioning 502, flicker, post-stability, Bad Gateway or "cycle once more": 145 (a GitHub outage), 183 (concurrent deploys racing), 251 (DONE, the recipe). The intake file: no hit. Nothing tracked the outage | holds |
| C. `ops` is a defensible Type | not in the documented enum (`OPEN.md:21`), but 20 earlier rows use it, open and closed, for deploy and infrastructure items (24, 26, 27, 30, 69, 73, 195 …), and the roll-up lists the row regardless of Type | holds — Non-blocking 12 |
| D. The probe, this host | `printf 'a\303\251b' \| LC_ALL=<loc> cut -c1-2 \| od -An -tx1` with BSD `cut` on Darwin 25.6.0: `61 c3` under `C` (and `POSIX`, and unset), `61 c3 a9` under `en_US.UTF-8` | holds |
| D. The probe, the container | `cut (GNU coreutils) 8.32`, Ubuntu 22.04.5: `61 c3` under `C`, `C.UTF-8` and `en_US.UTF-8` — the bytes the row gives. But `locale -a` there lists only `C`, `C.utf8`, `POSIX`: under `LC_ALL=en_US.UTF-8`, `locale charmap` answers `ANSI_X3.4-1968` and `wc -m` counts 4, so that leg is a second C-locale run. The `C.UTF-8` leg is genuine (`charmap` `UTF-8`, `wc -m` 3, and `cut -c1-2` still `61 c3`), and it carries the conclusion alone | holds on one leg of two — Non-blocking 5 |
| D. "most likely on CI's Ubuntu runner (unchecked)"; the hook half is inference | hedged as written. This shell has no `LANG` / `LC_*`; neither do its ancestors `claude`, `disclaimer` and `Claude` (`ps eww`, only those names printed); `.claude/settings.json` has no `env` block and one hook, a plain `bash …/scripts/session-start.sh`. No hook shell was observed, which is what the row says | holds |
| D. "Byte 149" is the zero-based offset of the 150th byte | the real `cut -c1-150` on row 193 under `LC_ALL=C`: invalid at offset 149, byte `0xe2`, the lead byte of `e2 80 94`; under `en_US.UTF-8`: valid, 152 bytes out | holds |
| D. `scripts/whats-open.sh:50` has a `cut -c1-150` on HANDOFF status lines; "not firing today" | line 50 is it. Simulated over all 21 `docs/*HANDOFF*.md` first-Status lines: none of the four open ones splits a character at byte 150. One closed one would (`INSTANCE_IDENTITY_DESIGN_HANDOFF.md`), so the hazard is one status change away | holds |
| D. Step 10: these four points began as a reviewer's words | each was re-derived above from commands, not recognised. Three survive whole; the fourth survives with one of its three container locales turning out not to exist there — a miss that was the prior round's before it was the row's | checked as claims |
| E. AC-1 hub | `821b0b47:ui/src/pages/developers/Hub.jsx`: intro, `Link`s to `/developers/nip-50` and `/developers/open-ranking`, an "Open-source" list with the Brainstorm Search repo and NosFabrica repos. HEAD: additions only (two cards, `32e3c943`). Production bundle `index-CB0iFVF5.js` (1,934,129 bytes): every one of those strings present. "No console errors": attestation | holds; console attested |
| E. AC-2 NIP-50 | `Nip50.jsx` at `821b0b47`: `wss://${window.location.host}/relay`, the minimal and the WoT REQ, an Extension table with `observer` / `sort` / `filter`, "Automatic Score Provisioning"; back-link from `DevPage.jsx` (`back = true`). Neither file has changed since (`git diff 821b0b47 HEAD`: empty). Bundle: all present | holds |
| E. AC-3 Open Ranking | `OpenRanking.jsx` at `821b0b47`: ORE intro, `${base}/.well-known/open-ranking.json`, both endpoints, both algorithms with the 422 on `/stats/pubkey`, a worked `curl` and response for each endpoint, the stats response carrying exactly the listed fields and no `ttl`, a five-row field table, spec and repo links, back-link. `/search/pubkeys` is described as "ranked by this instance's global GrapeRank" and nothing more. HEAD: a superset (two later sections, a point-of-view paragraph and a third reference link, from `7eac97c5`, `9b4ad192`, `359d3f36`; the personalized sentence reworded; nothing listed lost). Bundle: all present; `graperank-personalized` occurs once | holds on the recorded reading — Non-blocking 6 |
| E. The Deviations note: "global only", personalized search deferred — at `821b0b47` AND at HEAD | `search.js` at `821b0b47`, line 2: "ORE-05 POST /search/pubkeys (global only)"; line 11: "Personalized search … is deferred to Story 3"; `capabilities.js` there lists one algorithm for `/search/pubkeys` with the comment "graperank-personalized (pov:true) deferred". `search.js` is byte-identical at HEAD; the `/search/pubkeys` block of `capabilities.js` is unchanged. Live on production at 22:58Z: the capability document lists `graperank` alone for `/search/pubkeys`, and a request naming `graperank-personalized` gets `422`, `X-Reason: unsupported algorithm 'graperank-personalized' for /search/pubkeys`; results carry `pubkey` and `rank`, as the page shows. "Was, and is" holds | holds |
| E. AC-4 deep-linking | `/developers`, `/developers/nip-50`, `/developers/open-ranking` on production: 200, `text/html`, 470 bytes, identical to `/`; a nonsense path under `/developers/` gets the same — the catch-all at `bin/control-panel.js:346`, which `821b0b47` did not touch. That each then renders: attestation, corroborated by the routes at `App.jsx:208-217` and the bundle strings | holds; render attested |
| E. AC-5 additive, frontend only | `git show --name-status 821b0b47`: two harness docs, `ui/src/App.jsx` (M), `ui/src/pages/BrainstormDevelopers.jsx` (D), four new files under `ui/src/pages/developers/`. Nothing under `src/`. The `App.jsx` hunk swaps one import and element at `/developers` and adds two routes; no other reference to the deleted page existed | holds |
| E. A Done flip with no per-story review | both precedents are `Done` with "Review: none — lightweight docs-UI treatment (operator-approved 2026-07-21); reviewed at book scope in …". This story has less footing than they do — no book-scope review — and its note says so in as many words. What it has instead: the operator's ratification (attested; the operator's words are not in the repo) and, now, this review's independent check of all five criteria. Lint is clean, L14 demonstrably reads the file, no numbered review exists for L1 or L4 to match, the epic is `Active` and its L2 waiver is in force and used | acceptable — Non-blocking 7 |
| E. The Linked-artifacts note's facts | "operator-approved 2026-06-19": the story's own Background, present since `821b0b47`. "shipped in `821b0b47` (2026-06-20)": authored 13:31:55Z that day, merged by PR #328 two minutes later. "three months": 90 days. "no book of work covers this story": the only book that names the epic says "This book does **not** cover that epic's story 1", and the waiver file says "story 1 predates any book". "story 2's two hub cards; later Open Ranking sections": the commits named two rows up | holds |
| E. Leaving the book's dated landing note alone | `audits/about-brainstorm-search/book.md` says, as a note dated 2026-09-18, that the story "still reads `Approved` — OPEN.md row 321". True when PR #671 landed at 18:21Z; row 321 is where it points, and row 321 now carries the resolution. A Closed book is a record; editing a dated note to track later state would make it say something it did not say then | right call |
| F. Heading shape; listed as unmarked | `## 2026-09-18 — …` is the shape of 76 of the file's 77 headings, this one included; listed in the roll-up (gates, above) | holds |
| F. Four deploys that day; the CHANGELOG quotation; the suite exists | #671 → #672, #673 → #674, four runs, above. `engineering-team/CHANGELOG.md:51` (2026-07-18): "the wait-and-recheck mechanism lives in tested code, not per-run transcription" — exact. `test/safe-to-merge-check.test.js` exists and does stand up stub HTTP servers (`:128`, `:151`); the script journals each attempt and documents four exit codes | holds |
| F. The smoke step's place in each skill | `cycle-staging/SKILL.md:123` `### 7. Smoke test`; `cycle-prod/SKILL.md:125` `### 7. Stability poll + smoke test`; `cycle-local/SKILL.md:54` `### 4. Smoke test`; `cycle-full` has stages, not steps, and three smoke items in their lists (`:36`, `:54`, `:79`) | holds — Non-blocking 9 |
| F. "`.claude/skills/*` and `scripts/`, which are harness-definition paths" | `.claude/skills` is listed. `scripts/` is not: nine entries under it are (four scripts, `scripts/lib`, four lists), out of 17 top-level files. `check_L10` hands the listed paths to `git log` as pathspecs, so a commit adding only `scripts/smoke-test.sh` would not be policed. The entry's own precedent, `scripts/check-safe-to-merge.sh`, is not listed either; its CHANGELOG row was owed because the same change edited the cycle skills | **half wrong — Blocking 4** |
| F. The house-rule reading; filing, not building; feature, all phases | CLAUDE.md: "Don't add new lint or typecheck tooling without an explicit ADR"; a bash smoke script is neither, and the entry hedges ("does not by itself force an ADR; the Architect can confirm"). `0-intake.md` step 1 sends queued work to `_intake.md`; step 3 gives Feature → all phases under Standard. No smoke script exists in the repo and no earlier intake entry or ledger row proposes one | holds |
| G. The four commit messages | `d2c5232f` and `760e7bb1`: every statement holds; the second describes its own diff exactly (word-level diff of row 323 between the two commits). `8c683441` and `529d6b29`: loose statements, listed below, and three of the four messages name "row 323" | **loose** — Non-blocking 11; the number, Blocking 1 |

## Things tests can't catch

- [x] No secret, credential or key material in the diff or the messages, and no TA pubkey literal
      (CLAUDE.md § "Per-deployment TA pubkey"). No `LEGACY_*` constant is touched.
- [ ] **A collision, and it is live.** The check that found nothing for the previous review — remote
      tip, open PRs, other branches carrying the number — found it this time: Blocking 1. Open PRs
      today target `main` or unrelated branches, none `staging`; no remote branch in this clone carries
      a row 323. The colliding rows arrived by a PR that was opened and merged inside four minutes.
- [x] **The evidence behind row 323 is perishable.** It rests on the Implementer's session output and
      a scratchpad script; neither outlives the session. What will last: the four run ids (whose logs
      give the container start times used above, until GitHub expires them) and the two earlier
      records in `docs/SMOKE_TEST.md`. The row is honest about this — it claims an observation and
      two leads, not a diagnosis.
- [x] **What was sent to live hosts.** Read-only `GET`s to production and staging (the deploy-safety
      status, the three routes and a nonsense route, the root HTML and one bundle, the capability
      document, a handful of profile-search queries, `get-user-counts`), and two
      `POST /search/pubkeys` queries to production's public Open Ranking endpoint — a search, nothing
      written. `smoke.sh` was read, not run.
- [x] No debug residue, no commented-out text, no stray worktree (`git worktree list` shows the main
      tree only; three throwaway worktrees were added and removed), no stash. One fetch, by SHA, which
      wrote `FETCH_HEAD` and objects only — `origin/staging` in this clone is still `9dfe89f5`, so the
      orchestrator's base ref is where the brief left it and is **stale**. The gate record went to
      `tmp/`, which is ignored. `git status --short` after all experiments shows only this file.

## Findings

### Blocking

**1. `OPEN.md:384` — the row number 323 is already taken on `staging`.** PR #675 merged at
2026-09-18T22:56:02Z as `6c24e128` and added row 323 ("A user's kind-7 votes sum rather than
supersede…") and row 324. Merging this branch conflicts in `OPEN.md` and, resolved carelessly, leaves
two rows numbered 323; resolved carefully, it still leaves `engineering-team/stories/_intake.md:2414`
("OPEN.md row 323") and `:2433` ("the row-323 pointer") pointing at the vote-counting bug. This is row
307's hazard — that row records three occurrences, and this is a fourth — and nobody erred: the
branch's last commit predates the PR's opening by eight minutes, and every ledger claim in the brief was
true of `9dfe89f5`. Asked change: fetch, rebase onto the real `staging`, give the new row staging's
highest number plus one **as read at that moment** — 325 if nothing else lands, and look again
immediately before the push — and carry the two intake references with it. Three commit messages name
"row 323" (`8c683441` twice, `529d6b29`, `760e7bb1`); the branch is unpushed and no tracked file cites
any of its hashes, so rewording them orphans nothing. Then re-run the ledger check against the new
base: only rows 290, 321 and the new row should differ.

**2. `OPEN.md:384` — "Neither staging deploy that day did this under the same script and sequence."**
One script did not cover the day. The Implementer's own evidence file says the #671 smoke was typed by
hand, and the scratchpad script was born at 22:11:15Z, after production's first deploy as well; only
#673 and #674 ran it. It matters because the window is a few seconds wide: a hand-typed pass and a
scripted one do not arrive at the same moment, so the first pair is a weaker comparison than the
sentence makes it, and "what differs from staging" is one of the row's two leads. Asked change: say
which pair was which. Offered, and to be checked as a claim rather than adopted (step 10): "Neither
staging deploy that day showed it. The second pair (#673, #674) ran the identical scratchpad script, so
that comparison is like for like; the first pair (#671, #672) was typed by hand in the same tier
order." The evidence for each half is in the table row above.

**3. `OPEN.md:384` — "and carries the larger data set."** Stated as fact, absent from the evidence
file, and not borne out by what can be seen from outside: one search count favours production, the
per-user verified counts slightly favour staging, the large-graph timeout is identical on both.
Everywhere else this branch hedges what it did not check ("most likely … (unchecked)"); this clause
should meet the same standard. Asked change: drop it, mark it unchecked, or cite a measurement.

**4. `engineering-team/stories/_intake.md:2429-2430` — "`.claude/skills/*` and `scripts/`, which are
harness-definition paths (CHANGELOG row)".** `.claude/skills` is one; `scripts/` is not — nine named
entries under it are, and neither a new `scripts/smoke-test.sh` nor the entry's own precedent,
`scripts/check-safe-to-merge.sh`, is among them. The conclusion survives, because wiring the cycle
skills owes the row by itself; the premise is what a Product Owner would carry away, and it is wrong
about the harness's own definition file. Asked change, again as a claim to check: "It touches
`.claude/skills/*`, a harness-definition path (CHANGELOG row). A new file under `scripts/` is not one
unless it is registered in `scripts/harness-def-paths.txt` — `scripts/check-safe-to-merge.sh` is not —
so whether to register it is a question for the story."

### Non-blocking

**1. Row 323 and `OPERATIONS.md` §9.5.** The distinction the row draws is fair as to mechanism, but
§9.5 is not silent on this window: its "Post-stability flicker" paragraph records the #88 occurrence and
gives the same "cycles once more" reading, which `cycle-staging/SKILL.md:157` cites by name. The row
credits `docs/SMOKE_TEST.md` alone and offers the reading as its own. The pointer does name §9.5, so a
reader gets there. Optional: "§9.5 notes it once, for #88, and explains only the pre-bind gap."

**2. Row 323 — "within the first minute".** Shown by clock for the first deploy (within 47 s of the
container starting). For the second the evidence has no clock, and the 2026-09-10 occurrence ("~20–30 s
after the settle", following a Tier 2 that includes a ~16 s `get-user-data`) was probably later than a
minute. Optional: "within about the first minute".

**3. Row 323 — "on each release"** (and `8c683441`'s "which real visitors hit on each release"). Two of
two that day and four recorded in all is a pattern, not yet a rule; the row's own first lead is what
would settle it. Optional: "apparently on each release".

**4. Row 323's pointer names two files that cite the old section number; there are four.**
`BIBLE.md:1407` ("§8.5/§8.6") and `.claude/skills/cycle-prod/SKILL.md:162` ("§8.2") are the same
staleness from the same renumbering. The intake entry's "fix the stale section numbers the … pointer
lists" would leave them. Optional: "among others — grep for `§8`".

**5. Row 290 (a) — one of the three container locales is not there.** The container has no
`en_US.UTF-8`; glibc falls back to C without a word, so that leg repeats the `C` result and shows
nothing about UTF-8. The `C.UTF-8` leg is real and is enough, and `cut --help` there lists `-n` as
"(ignored)". So the conclusion stands and "under *every* locale" means the two that container can
offer. The phrase was the previous round's ("under every locale I could give it") and the re-check
reproduced its bytes without noticing — step 10's point, from the other side. Optional: drop
`en_US.UTF-8` from the container list, or add "(not installed there; falls back to C)".

**6. The AC-3 tick is defensible, and the note is the right way to make it.** The criterion's sentence
can be read distributively (each endpoint with each algorithm) or collectively (the endpoints, and the
algorithms). The story and the page were written in the same commit, in a tree whose `capabilities.js`
already said personalized search was deferred, so only the collective reading lets the author's own
page meet the author's own criterion: it is the intended one. The distributive reading would have had
the page document a capability the API refuses with a 422. Leaving the box empty with a note was the
other honest option; ticking with a disclosed reading, under the heading a book-scope audit harvests,
is at least as good, and row 321 asked for ticks. Two things the note could add, neither required: the
same loose "each" covers the worked examples (one per endpoint, none for a personalized request); and
since `c9e60ddb` (2026-07-10) personalized stats are gated off by default, so production today
advertises no personalized algorithm on any endpoint — which the page already tells its reader ("check
there first") and which does not touch a criterion about what the page renders.

**7. "Review: none" will be slightly less than the whole story once this lands.** No per-story review
exists, and the line is right to say so. But the five criteria have now had a second, independent
check, in this file. Optional, when the branch lands: name this review in the Linked-artifacts line so
the next reader finds it.

**8. The story's Background links to `ui/src/pages/BrainstormDevelopers.jsx`,** which the shipping
commit deleted; the link has been dead since the day the story was written. Pre-existing, outside L8's
scan, and not this diff's to fix.

**9. Intake — "it has no step 7 of its own".** True in the sense meant: `cycle-full` has stages, not
steps. One of its three smoke items does happen to be numbered 7 (`:79`, in Stage 4's list). The count
of three is right and a reader who opens the file is not misled. Optional: "(it has stages, not steps)".

**10. Intake — "which died with the session".** Not yet: `smoke.sh` (28 lines) is still in the
scratchpad. If the story should start from it rather than from prose, this is the moment to copy it
somewhere durable, such as the PR description. The operator's call; nothing is asked.

**11. Commit messages.** `529d6b29`: "wired into step 7 of the cycle skills" is true of two of the four
(the entry itself has the corrected wording), and "four deploys in one session, each re-typing the
recipe from prose" is true of the first two — the last two ran the script. `8c683441`: "GNU cut counts
bytes under every locale" is finding 5, and "on each release" is finding 3. If Blocking 1 is answered
by rewording, these ride along for free.

**12. `ops` is fine, and the documented enum is not the ledger's.** `OPEN.md:21` documents six Types;
the ledger uses sixteen. Pre-existing drift; this row follows twenty precedents.

**13. For the PR.** Substitute the PR number into row 321's Done cell (`fdd697b1`'s precedent). Land it
as a merge commit. Say in the body that the local gate is red on Node 16 for the row-288 reason and
that CI's Node 22 job is the binding run.

### Harness friction

**1. Row 307's hazard recurred while this review was running.** Two sessions each took "highest plus
one" from their own base within the same quarter-hour. The reviewer's collision check caught it only
because it was run late; run at the start, it would have found a quiet remote, as the previous
review's did. Candidates for row 307: make the check the last thing a review does and the last thing
before a push; or a small pre-push script that asks whether any row number this branch adds already
exists on the fetched base.

**2. Three cycle skills still carry the mistake the intake entry warns against.**
`.claude/skills/cycle-staging/SKILL.md:157` and `cycle-prod/SKILL.md:155` say "retry once" for a
post-stability 502, and `cycle-full/SKILL.md:112` refers to "the post-stability retry"; all three lines
date from `48de7b57` (2026-05-04). `docs/SMOKE_TEST.md:38` has said since 2026-09-10 to re-run the
Tier 1 poll and repeat the tier, "rather than a single per-request retry". Row 251 is closed, and its
fix did not reach the skills' failure-handling sections. Wants a `meta` row, or a clause in the intake
entry's "While there".

**3. `OPERATIONS.md` §9.5 still says "observed once".** Four are recorded now. It is an L9-policed
file, so not for this lane; it belongs with the section-number fixes.

**4. `scripts/check-safe-to-merge.sh` is wired into two cycle skills as the canonical pre-merge
mechanism and is not a registered harness-definition path,** so a change to it alone is invisible to
L10. Whether it should be listed is a harness question; Blocking 4 is how it surfaced.

**5. The brief's suite list was two short** (the two `_intake.md` readers). It did ask for the grep
that found them, which is the right shape: a named list is a floor, and the grep is the check.

**6. `git grep -E` on this Mac ignores `\b` and returns nothing, silently.** A search for the
references to row 323 came back empty until it was redone in Python. "No hits" from a word-boundary
grep here is not evidence of absence.

**7. Row 316 recurred again:** the wiring says commit and flip, the brief reserves both, and the brief
was followed.

## Verdict

**CHANGES_REQUESTED**

The substance of this close-out is sound, and most of it survived every attempt to break it. The story
flip — the part that most needed a second pair of eyes — holds: all five criteria were re-checked here
against the shipping commit, against today's source, and against live production, and the one wrinkle
in AC-3 is real, is disclosed in the right place, and is true of the provider then and now, down to the
422 it returns today. Row 290's four refinements reproduce, with one locale that turned out not to
exist in the container. Row 323's counts and timings match the Implementer's evidence to the digit, its
run ids and quotations check out, its hypothesis is plainly marked as one, and nothing in the ledger
already tracks it. The intake entry is rightly filed rather than built, and rightly classified.

It cannot land as written, for one reason that is nobody's mistake and three that are small. A
concurrent session took row 323 on `staging` eleven minutes after this branch's last commit, so the
merge conflicts and two cross-references would point at the wrong row. And three statements say more
than the evidence does: one script did not cover all four deploys, production's larger data set was
never measured, and `scripts/` is not a harness-definition path. Each has a one-sentence fix, all four
fit in a single fix-up on a rebased branch, and the suggested wordings above are claims for the next
round to check, not text to adopt.

Lint is clean and identical to its base's, and the nine suites that read a changed file are green on
this HEAD. The local full gate, re-run here, is red for the recorded Node 16 reason with 15.3% of cases
skipped; that is accepted for a diff with no source and no test, and it is not a green gate. CI's Node
22 job on the PR is the binding run. This lane has no book to close; the status flip under review was
the Implementer's, ratified by the operator, and the commit is the orchestrator's.
