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

## Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-18
**Diff:** `b2e71921`, the Implementer's fix-up, and `5187e081`, a merge of `origin/staging` (`6c24e128`,
PR #675) into the branch — both on top of `e9130f6b` (round 1 of this file, committed as written: the
same blob, 325 lines). The fix-up touches `OPEN.md` (rows 290, 307 and 325), the intake entry, and one
line of the story; the merge's only hand-made change is its `OPEN.md` resolution. Everything above this
heading is round 1, byte-for-byte; this section was appended to the end of the file, not edited in.

Same constraints as round 1: this reviewer edited this file and nothing else — no commit, no add, no
push, no status flip.

Seven pieces of the text under review began as this reviewer's words. Three are short phrases taken as
offered — "within about the first minute", "apparently", "(it has stages, not steps)". Four are the
Implementer's own sentences built on round 1's notes: "falls back to C without a word" (Non-blocking
5), "caught it only because it ran late" (Harness friction 1), the "retry once" paragraph (Harness
friction 2), and the count of files citing the old section number (the heading of Non-blocking 4:
"there are four"). Step 10 says to check all of them as claims, and each was re-derived below from
commands. Five hold. One holds but is a place short, and the omission was mine. One is wrong, and it is
this round's only blocking finding: there are three, not four, and the count was mine before it was the
Implementer's.

### Quality gates (round 2)

- [x] `bash scripts/harness-lint.sh` on `b2e71921` → **clean (0 violations)**, exit 0, 35 lines. Run
      again on `origin/staging` (`6c24e128`) in a throwaway worktree and diffed: the outputs differ by
      exactly one line, the `INFO non-numbered-review` line for this file. L14 is still silent on the
      story, whose Linked-artifacts line now names this file. Worktree removed afterwards.
- [x] **What #675 brought, and whether any suite reads it.** `git diff --name-status 9dfe89f5 6c24e128`:
      `OPEN.md` and `engineering-team/audits/curated-dlist-update/audit.md`, nothing else — no suite
      added or changed, no source, no harness-definition path. No suite's code names that audit file
      or this review (the grep's hits are fixtures and a template); the two suites that walk the real
      `audits/` and `reviews/` trees are among the nine below. `git diff --name-status 6c24e128
      5187e081` lists only this branch's four files, and the audit at HEAD is identical to staging's.
- [x] **The same nine suites, each through `run()`, in the foreground, Node v16.17.0, on `b2e71921`:**
      `harness-lint` 41 passed / 0 failed (56 s), `harness-stats` 12 / 0 (71 s), `session-start`
      10 / 0 (26 s), `operational-direction` 76 / 0 (10 skipped),
      `curated-dlist-update-update-preview` 34 / 0, `curated-dlist-update-publish` 69 / 0,
      `gate-result-record` 34 / 0 (20 s), `kill-timeout-orphans-by-default` 9 / 0,
      `note-tagging-raw-events-inspector-ui` 32 / 0. Counts identical to round 1.
- [x] **The real parser over the four rows** (the awk from `scripts/lib/collect-meta.sh:34`): rows
      290, 307, 321 and 325 each read `NF=9`, Type in `$3` (`meta`, `meta`, `cleanup`, `ops`), Status
      in `$6`; line 26 takes `2026-09-12`, `2026-09-17`, `2026-09-18`, `2026-09-18` from `$5`. The
      open-meta selection is the same 106 row numbers on `6c24e128` and here.
- [x] **The roll-up** (redirected, exit 0, 912 lines): the intake entry is still listed as unmarked;
      rows 323, 324 and 325 all appear in the ledger section and 321 does not; still exactly one invalid
      UTF-8 position, row 193's.
- [x] **Mergeability.** At 2026-09-18T23:46:23Z `git ls-remote origin refs/heads/staging` is
      `6c24e128`, which is an ancestor of HEAD (`git merge-base --is-ancestor`), so the merge into
      `staging` cannot conflict as things stand. Its highest ledger row, read through the API rather
      than the local ref, is 324. No open PR targets `staging`. This is true of that minute and no
      longer — Non-blocking 3.
- [ ] **Full gate: re-run on the merged tree; red on this host, and not a green gate.** #675 touched no
      source and no test, so round 1's record would have stood; it was re-run anyway so that a record
      covers what would actually land. `GATE_LABEL=closeout-review-r2 npm test`, foreground, 3 m 21 s,
      exit 1. `npm run -s gate:status` (exit 1) prints:
      `20260918T234011Z-65036-a1a9 [closeout-review-r2] started 2026-09-18T23:40:11.499Z on b2e71921 —
      FAIL, exit 1, 2848 passed, 9 failed, 515 skipped, 204/204 suites; failed:
      honest-publish-reporting`. From its JSON record: commit `b2e71921`, `dirty: false`, Node
      `v16.17.0`, 178 suites green / 25 skipped / 1 red, `strayErrors` empty; the red suite's nine
      failures are the one row-288 cause (`require()` of the ES module in `nostr-tools`). Compared
      suite by suite with round 1's record: all 204 agree on passed, failed, skipped and verdict.
      515 of 3372 cases (15.3%) did not execute. **The binding run is CI's Node 22 `stack-free` job on
      the PR.**

### Claims adherence (round 2)

| Claim in the fix-up or the merge | Evidence | Result |
|---|---|---|
| Blocking 1. Versus `origin/staging`, `OPEN.md` differs in rows 290, 307, 321 and a new last row 325 only | own script over `6c24e128:OPEN.md` and `HEAD:OPEN.md`: 385 → 386 lines, 323 → 324 rows, highest 324 → 325, no duplicate number on either side, the gap at 257 on both, common rows in the same order, every non-row line identical. Changed: 290, 307, 321. Added: 325, last (`:386`). #675's own rows 297, 323 and 324 are byte-identical to staging's. Each of 290, 307, 321, 325 has 7 cells, 8 raw pipes, 0 escaped, balanced backticks and bold; for 290, 307 and 321 staging's Item cell is a verbatim prefix of HEAD's (1408 → 2621, 1563 → 2169, 1350 → 1926 characters) and 307's other six cells are byte-identical | holds |
| The merge is what its message says | at `5187e081` rows 290 and 321 equal round 1's text exactly, and row 325 equals round 1's row 323 but for the number; versus staging the merge differs only in this branch's four files. The fix-up then changed rows 290, 307 and 325 and no other | holds |
| The intake's two references say 325; no "row 323" survives in the branch's own text | whitespace-flattened search of the three files for a standalone 323: `_intake.md` and the story, none; `OPEN.md`, four — row 307's note ("minted row 323", "its own 323 and 324"), #675's row itself, and row 325's "it was 323 on this branch until PR #675 took that number". All four are history, correctly told. `_intake.md:2414` and `:2442` say 325 | holds |
| Row 325 records where it came from | "Renumbered 325 at the 2026-09-18 staging merge; it was 323 on this branch until PR #675 took that number." The merge is dated 23:26:41Z that day | holds |
| Blocking 2. "like for like only for the second pair — #673 on staging and #674 on production ran one and the same script — while the first pair (#671, #672) was typed by hand in the same tier order" | evidence file: #673 "same scripted smoke as production deploy 2"; #671 "typed by hand (not the script), in the same tier order"; production's first is two hand-run passes. `stat` on the scratchpad `smoke.sh`: born and last modified 22:11:15Z — after #673's deploy run finished (22:10:49Z), before #674's (22:15:58Z), and hours after #671 and #672 — so it is one unmodified file across both runs. "The weaker half" is a judgement, and a fair one | holds |
| Blocking 3. "and carries the larger data set" is gone | replaced by "nothing else about the two instances was compared". True of the session that wrote the row; round 1 of this review did look at three public signals and found them mixed | holds — Non-blocking 1 |
| Blocking 4. `.claude/skills` is a harness-definition path; "nine named entries" under `scripts/`; `check-safe-to-merge.sh` not among them | `scripts/harness-def-paths.txt` at HEAD, unchanged since `9dfe89f5`: `.claude/skills` listed once; 9 lines begin `scripts/`; `check-safe-to-merge` occurs 0 times | holds |
| NB1. Row 325 quotes §9.5's paragraph | flattened search of `OPERATIONS.md`: "observed once" and "can briefly cycle once more after first appearing stable" are both exact; "the advice to retry once" paraphrases "retry once before treating it as a real failure". The hypothesis is now credited to the doc ("That reading fits what was seen here") and is still followed by the bold "Not diagnosed" | holds |
| NB2, NB3, NB9 — three phrases taken as offered | "within about the first minute": 47 s by clock on the first deploy, inferred on the second, and "about" covers the 2026-09-10 occurrence. "apparently get 502s … on each release": a hedge on two of two. "(it has stages, not steps)": `cycle-full/SKILL.md` is organised as `### Stage 1` … `### Stage 5`, each with a numbered list | holds |
| NB4. "which four files still cite by its old number" (`OPEN.md:386`, the pointer), and "four files cite that section by its old number" (`_intake.md:2441-2442`) | every file, line and number the pointer itemises is right. The relation is not. `git grep` for an `OPERATIONS` citation of §8.5: **three** files — `docs/SMOKE_TEST.md:19`, `cycle-staging/SKILL.md:157`, `BIBLE.md:1407` (with §8.6). `cycle-staging/SKILL.md:164` cites the parent, §8. `cycle-prod/SKILL.md:162` reads `OPERATIONS.md §8.2 "auto-delete-head-branches deleted staging"` — today's §9.2 (`OPERATIONS.md:319`), a different section; that skill cites the 502 section nowhere. Before the renumbering (`44975ffc^`) §8.2 was the auto-delete incident, §8.5 the flicker, §8.6 `SESSION_SECRET` | **wrong count — Blocking 1 (round 2)** |
| NB5. The container has only `C.UTF-8` as a UTF-8 locale; `en_US.UTF-8` "is absent and glibc falls back to C without a word" | `docker exec tapestry locale -a`: `C C.utf8 POSIX`. Under `LC_ALL=en_US.UTF-8` there, `cut` and `wc` each write 0 bytes to stderr, under dash and under bash, and `wc -m` counts 4; only the `locale` utility itself complains. Under `C.UTF-8`: charmap `UTF-8`, `wc -m` 3, `cut -c1-2` still `61 c3`; coreutils 8.32. This Mac: `61 c3 a9`. "Counts bytes even under a UTF-8 locale" now claims exactly what was shown | holds |
| NB7. The story names this review; L14 still quiet | the added sentence carries no verdict word and the path sits in backticks; lint clean (gates, above) | holds |
| NB10. "a copy is kept in the session-closeout PR's description" | no PR exists for this branch yet (`gh pr list --head …`: 0). A promise. The script it promises is intact: 28 lines, unmodified since 22:11:15Z, no secret-shaped content; its one 64-hex string is the smoke pubkey that `docs/SMOKE_TEST.md` already publishes | owed — Non-blocking 3 |
| HF2 / HF3, the entry's "While there" | `cycle-staging/SKILL.md:157` and `cycle-prod/SKILL.md:155` say "retry once"; `cycle-full/SKILL.md:112` says "the post-stability retry", quoted as such. `docs/SMOKE_TEST.md:38` has carried the re-poll rule since `c63879e2` (2026-09-10). But that commit **kept** the line's first sentence — "If a request right after stability returns 502, retry once before treating it as a real failure" — so the canonical doc still says both. §9.5's "observed once": exact | holds, a place short — Non-blocking 2 |
| New: row 307's fourth occurrence | `8c683441`'s committer time is 22:37:02Z; `gh pr view 675`: created 22:52:33Z, merged 22:56:02Z; #675's one commit has parent `9dfe89f5` (highest row 322) and added 323 and 324, so "both sessions were right when they looked"; the branch has never been on origin. "Hours later": the third occurrence was the #671 landing at 18:21Z. "Caught it only because it ran late in the review; run at the start it would have found a quiet remote" — from scratch-file birth times: this review was under way by 22:46:32Z, the PR did not exist until 22:52:33Z (its commit was authored 22:52:18Z), and the collision check ran at 23:12:49Z | holds — Non-blocking 5 |
| The fix-up's commit message | every statement checked above holds, with one exception it shares with the rows: "four files cite the old section number, not two". Its forward corrections to `8c683441`, `529d6b29` and `760e7bb1` are accurate | one loose phrase — see Blocking 1 |

### Findings (round 2)

**Blocking.**

1. **`OPEN.md:386` (row 325's pointer) and `engineering-team/stories/_intake.md:2441-2442` — three
   files cite §9.5 by its old number, not four.** The pointer says `OPERATIONS.md` §9.5 is what "four
   files still cite by its old number", and the intake entry says "four files cite that section by its
   old number". Three do: `docs/SMOKE_TEST.md:19`, `cycle-staging/SKILL.md:157` and `BIBLE.md:1407`.
   The fourth, `cycle-prod/SKILL.md:162`, cites §8.2 — the auto-delete incident, today's §9.2 — and
   never mentions the 502 section. The pointer's own itemisation gives it away ("as §8.2": §9.5 was
   never §8.2), and a fixer who opens the line will see the incident's title and do the right thing, so
   the practical risk is small. But it is a wrong count in two tracked files, the intake sentence
   carries the bare count and sends its reader to the pointer for the list, and the verdict rule names
   wrong counts. **It was my count first:** round 1's Non-blocking 4 was headed "there are four", over
   a body that said, correctly, "the same staleness from the same renumbering". Asked change, and again
   a claim to check rather than text to adopt: say what is true of each — for instance, that the
   renumbering left four files citing `OPERATIONS.md` §9's subsections by their old §8 numbers, three
   of them this section (as §8.5) and `cycle-prod/SKILL.md:162` citing today's §9.2 as §8.2 — in both
   places. The evidence for each half is in the table row above.

**Non-blocking.**

1. **Row 325 — "nothing else about the two instances was compared."** True of the session. Round 1 of
   this review did compare three public signals and found them mixed (its claims table). The row
   under-claims rather than over-claims, so nobody is led wrong. Optional: "by this session".
2. **The intake's "While there" is right about the three skills and one place short, and the shortfall
   was mine.** Round 1's Harness friction 2 said the skills "carry the mistake". `c63879e2` added the
   re-poll rule to `docs/SMOKE_TEST.md:38` beside the older sentence, not instead of it, so the
   canonical recipe itself still says "retry once" for "a request right after stability" and re-poll
   for "any later tier" — and never says which of those Tier 2 is. The clean-up has four places, and
   its first job is to decide that. Optional, since the entry is being touched anyway: add
   `docs/SMOKE_TEST.md:38`'s own first sentence to the list.
3. **Two promises are now written into tracked files, and both are the orchestrator's to keep.**
   `_intake.md:2409` says a copy of the script "is kept in the session-closeout PR's description"; row
   321's Done cell still reads `(session-closeout PR)`. Neither is false yet and neither is true yet.
   The first becomes false on `staging` the moment the PR merges without the script in its body. And
   the number 325 is only as good as the last look: staging's highest row was 324 at 23:46:23Z, another
   session has been landing ledger rows today, and the look has to be repeated immediately before the
   push and again before the merge.
4. **Merging instead of rebasing, and correcting forward instead of rewording, is the right call — and
   better than what round 1 asked for.** Round 1 said rewording "orphans nothing" because no tracked
   file cited the branch's hashes. That was true when written and stopped being true the moment this
   file was committed: it cites all four. The previous review in this folder
   (`stranded-close-followups-2026-09-18.md`, Non-blocking 2) warned of exactly that trap — a reworded
   commit moving a hash a row cites — and round 1 walked into it from the other side. The repo's
   precedent is as the brief says: `e9fc3f99` (a renumber commit) and `493d9faf` (the staging merge),
   `curated-dlist-update`, 2026-09-17; and a correction carried forward in a later message is how that
   previous review's loose commit message was handled too. The cost is that three subjects in `git log`
   will always say "row 323"; rows 325 and 307 both say in their own text what happened to that number,
   which is where a reader of the ledger will look. One consequence: the PR has to land as a merge
   commit. A squash would orphan every hash this file quotes.
5. **The row 307 append is warranted and accurate.** It is the row this hazard belongs to, the
   occurrence is new in kind (two sessions, fifteen minutes apart, neither at fault), it adds a
   candidate the row did not have, and appending mints no number — the row's own subject. The original
   text is a verbatim prefix. It is not isolated in a commit of its own, but the fix-up's message
   declares it in its first paragraph. The sentence that was my observation was re-derived from
   timestamps, not remembered.
6. **On what was deliberately left alone, I agree in every case.** Round 1's Non-blocking 6 asked
   nothing. Its Non-blocking 8 (the story's dead Background link) and 12 (the Type enum) are older than
   this branch. Its Harness friction 4 — whether `scripts/check-safe-to-merge.sh` should be a registered
   definition path — is a question about what the harness polices; the brief sends it to the operator
   as a proposal, which is where it belongs. Its Harness friction 6 is a caution for reviewers, and it
   is on record here. None is wrong to leave.

**Harness friction.**

1. **Step 10 caught its author a second time, and this time it blocked.** A reviewer's heading is as
   quotable as its asked changes. "There are four" sat above a body that was right, and the heading is
   what travelled. The habit that would have prevented it: write the count only after writing the list
   it counts, and make the heading say what the list shows.
2. **A reviewer that asks for a history rewrite should remember its own review becomes a citing file.**
   See Non-blocking 4.
3. **Every push to `main` redeploys production; there is no path filter** (`deploy-tapestry.yml`: `on:
   push: branches: [main]`). Today's two promotions carried no runtime change — records, a role file, a
   lint waiver list — and each recreated the container: 24 s and 25 s between `Container tapestry
   Recreate` and `Started` in the run logs, before the pre-bind gap and the late window that row 325
   exists to track. Promoting this branch would be the third such restart today. Not a defect in this
   diff; a cost the operator may want in view, and perhaps an intake line of its own (a path filter for
   records-only pushes, or batching such promotions with the next real release).
4. Row 316 recurred again: the wiring says commit and flip, the brief reserves both, and the brief was
   followed.

### Verdict (round 2)

**CHANGES_REQUESTED**

All four of round 1's blocking findings are answered, and answered well. The collision is resolved the
right way — a merge that keeps staging's rows byte-for-byte and lands this branch's row after them as
325, with every reference repointed and the history told in the rows themselves. The sentence about the
script now says which pair ran it; the unmeasured clause is gone; the intake entry describes the
definition file as it is. Eight of round 1's non-blocking notes and two of its friction notes were taken
as well, re-checked rather than pasted, and row 307's new note is accurate to the minute.

One statement in the fix-up is false, in two places, and it is small: four files are said to cite
`OPERATIONS.md` §9.5 by its old number, and three do. It came from a loose heading of mine in round 1,
which is the failure step 10 was written for, and it would have been easy to wave through for that
reason. The verdict rule names wrong counts, a passing round here leads to a merge and a promotion with
no further look, and round 1 held the Implementer's sentences to the same standard. So it is asked for,
with the evidence beside it. The fix is two phrases in one records-only commit; a third round can be
narrow — those two sentences, the ledger check against whatever `staging` is by then, and lint — and
this round's gate record, taken on the merged tree, stays applicable to it.

Lint is clean and differs from staging's by this file's one line, the nine suites that read a changed
file are green on `b2e71921`, and the full gate, re-run on the merged tree, is red for the recorded Node
16 reason with 15.3% of cases skipped — not a green gate. CI's Node 22 job on the PR is the binding run.
This lane has no book to close, and the commit is the orchestrator's.

## Round 3

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19 UTC (begun 23:53Z on 2026-09-18; still 2026-09-18 where the operator is)
**Diff:** `b5b0940c`, one correction, on top of `dd8b9a38` (round 2 of this file, committed as written:
the same blob, 194 lines added and none removed). It changes one line of `OPEN.md` — row 325, its Item
and Pointer cells — and one paragraph of the intake entry. Everything above this heading is rounds 1
and 2, byte-for-byte; this section was appended to the end of the file, not edited in.

Same constraints as before: this reviewer edited this file and nothing else — no commit, no add, no
push, no status flip.

The text under review is the Implementer's own and not the wording round 2 offered; it was checked as
written. Its last clause — "so four files carry old §8 numbers in all" — is a universal, and a
universal is not verified by re-reading the five lines already known. It was tested by looking for a
sixth.

### Quality gates (round 3)

- [x] `bash scripts/harness-lint.sh` on `b5b0940c` → **clean (0 violations)**, exit 0, 35 lines. Run
      again on `origin/staging` (`6c24e128`) in a throwaway worktree and diffed: the outputs differ by
      exactly one line, the `INFO non-numbered-review` line for this file. Worktree removed afterwards.
- [x] **The same nine suites, each through `run()`, in the foreground, Node v16.17.0, on `b5b0940c`:**
      `harness-lint` 41 passed / 0 failed (55 s), `harness-stats` 12 / 0 (72 s), `session-start`
      10 / 0 (26 s), `operational-direction` 76 / 0 (10 skipped),
      `curated-dlist-update-update-preview` 34 / 0, `curated-dlist-update-publish` 69 / 0,
      `gate-result-record` 34 / 0 (20 s), `kill-timeout-orphans-by-default` 9 / 0,
      `note-tagging-raw-events-inspector-ui` 32 / 0. Counts identical to rounds 1 and 2.
- [x] **The real parser and the roll-up.** The awk from `scripts/lib/collect-meta.sh:34` reads rows
      290, 307, 321 and 325 with `NF=9`, Type in `$3`, Status in `$6`; the open-meta selection is the
      same 106 row numbers on `6c24e128` and here. `scripts/whats-open.sh` (redirected): exit 0, 912
      lines, the intake entry still listed as unmarked, rows 323, 324 and 325 shown and 321 not, and
      still exactly one invalid UTF-8 position, row 193's.
- [x] **Mergeability.** At 2026-09-19T00:01:42Z `git ls-remote origin refs/heads/staging` is
      `6c24e128`, an ancestor of HEAD; its highest ledger row, read through the API, is 324; no open PR
      targets `staging`; this branch has never been pushed and has no PR. The six files whose line
      numbers this branch cites (`docs/SMOKE_TEST.md`, the three cycle skills, `BIBLE.md`,
      `OPERATIONS.md`) are identical to staging's. True of that minute and no longer.
- [ ] **Full gate: not re-run, and still not green.** I agree it need not be. Round 2's run,
      `20260918T234011Z-65036-a1a9`, was on `b2e71921`: red, 2848 passed, 9 failed, 515 skipped, the one
      red suite being `honest-publish-reporting` for the row-288 host reason. `git diff --stat b2e71921
      HEAD` is three records files — this review (+194), one line of `OPEN.md`, one paragraph of
      `_intake.md` — with no source, no test and no harness-definition path, and every suite that reads
      any of the three is among the nine re-run above on the new HEAD. So that record still applies, as
      exactly the evidence it was and no more: a red local gate, on a host that cannot execute 15.3% of
      the cases, showing that a records-only diff broke nothing it could reach. **The binding run is
      CI's Node 22 `stack-free` job on the PR.**

### Claims adherence (round 3)

| Claim in `b5b0940c` | Evidence | Result |
|---|---|---|
| Three files cite `OPERATIONS.md` §9.5 by its old number, §8.5: `docs/SMOKE_TEST.md:19`, `cycle-staging/SKILL.md:157`, `BIBLE.md:1407` (as §8.5/§8.6) | each line read at HEAD, then traced: all three were written on 2026-05-04 (`48de7b57`, `96ae1922`), and in `OPERATIONS.md` at those commits §8.5 is "Post-deploy 502 flicker until brainstorm Express binds" — today's §9.5 (`:343`) — and §8.6 is the `SESSION_SECRET` incident, today's §9.6 (`:367`). The sentences around each citation say the same thing their numbers did | holds |
| Two more stale citations, of other parts of §9: `cycle-staging/SKILL.md:164` (§9 as §8) and `cycle-prod/SKILL.md:162` (§9.2 as §8.2) | `:164` reads `OPERATIONS.md §8 "Operational gotchas"`; at `48de7b57` §8 is "Operational gotchas we've hit", today's §9 (`:298`). `:162` reads `§8.2 "auto-delete-head-branches deleted staging"`; then §8.2, today §9.2 (`:319`) | holds — Non-blocking 1 |
| "so four files carry old §8 numbers in all" — the universal | two nets over every tracked text file (3,210 tracked, 3,193 readable as UTF-8), whitespace flattened, in Python rather than `git grep`. First: any section-8 reference (`§8`, `§ 8.x`, "section 8", a `#8…` anchor) within reach of the word OPERATIONS, in either direction. Second: every section-8 token anywhere — 271, in 93 files — kept if its context smells of the runbook (502, gotcha, deploy, droplet …): 25, of which 11 are rounds 1 and 2 of this review quoting the lines, 3 are row 325 describing them, 2 are ADRs citing their own §8, 2 cite a handoff doc and the BIBLE, 1 is `OPERATIONS.md:428` citing today's §8 correctly, and 6 are the citations themselves: six section numbers on five lines in four files. No `OPERATIONS.md#anchor` link exists anywhere. One false positive ("second-brain #8 review"). No fifth file, inside or outside `reviews/` and `audits/` | holds |
| "stale since §8 became "Active tracking issues"" | heading lists at `44975ffc^`, `44975ffc` and HEAD: that commit (2026-05-14) inserted a new §6, "Spinning up a new sandbox droplet", moving "Active tracking issues" from §7 to §8 and "Operational gotchas we've hit" from §8 to §9. All five citing lines are ten days older | holds |
| Row 325: "this session compared nothing else about the two instances" | the word-level diff shows that one sentence and the pointer are the row's only changes. True, and consistent with round 1 of this file, which did compare three public signals | holds |
| The intake's "While there": line 38 of `docs/SMOKE_TEST.md` keeps "retry once" for a 502 right after stability beside the newer rule; §9.5 says "observed once"; four files, three citing this section as §8.5; the pointer lists "all five lines" | `docs/SMOKE_TEST.md:38` opens "If a request right after stability returns 502, retry once before treating it as a real failure" and ends "re-run the Tier 1 poll and repeat that tier from the top, rather than a single per-request retry"; `c63879e2` (2026-09-10) added the second beside the first. "observed once" is exact in §9.5. The counts are the ones established above. The pointer names `docs/SMOKE_TEST.md:19`, `cycle-staging/SKILL.md:157`, `BIBLE.md:1407`, `cycle-staging/SKILL.md:164` and `cycle-prod/SKILL.md:162`: five | holds |
| Ledger integrity, again | own script over `6c24e128:OPEN.md` and `HEAD:OPEN.md`: 385 → 386 lines, 323 → 324 rows, highest 324 → 325, no duplicate, the gap at 257 on both, common rows in order, every non-row line identical; changed 290, 307, 321; added 325, last; #675's rows 297, 323 and 324 byte-identical to staging's. Since `b2e71921` only row 325 changed, in its Item and Pointer cells. Row 325: 7 cells, 8 raw pipes, 0 escaped, balanced backticks and bold | holds |
| The commit message, with its forward correction | its two bullet lists and "four files … over five lines; three of those files cite this section" match the above. "Every file, line and number in the earlier text was right; the relation between them and the count were not" is round 2's finding, fairly put. `b2e71921`'s message does say "four files cite the old section number", and the correction reads it rightly | holds |

### Findings (round 3)

**Blocking.** None. The one statement round 2 found false is corrected in both places; every relation
in the new text was traced to the commit that wrote the citation and to the heading it meant then; the
counts three, four and five survive an exhaustive search; no ledger row other than 290, 307, 321 and
325 differs from staging; lint is clean.

**Non-blocking.**

1. **"Of other parts of §9" stretches one word.** `cycle-staging/SKILL.md:164` cites §9 itself, under
   its old number, not a part of it. The parenthesis beside it says exactly that — "(§9 as §8)" — and
   the intake entry's version has no such stretch, so nothing is asked. For whoever makes the fix: the
   five lines carry six numbers, because `BIBLE.md:1407` is one link naming two sections — §8.5 → §9.5
   three times, §8.6 → §9.6, §8 → §9, §8.2 → §9.2.
2. **What is still owed is unchanged, and the orchestrator has said it will be done:** the script in
   the PR's body (or `_intake.md:2409` lands false); the PR number into row 321's Done cell; `staging`
   looked at again immediately before the push and before the merge; a merge commit, not a squash. Two
   small additions to that look. If `staging` has moved, also confirm it has not touched the six files
   this branch cites by line — `git diff --quiet <new-staging> HEAD --` over them is enough. And the
   promotion after this PR will not carry this PR alone: `git log origin/main..origin/staging` already
   holds PR #675, another session's records-only change (`OPEN.md` and one audit file). It would ride
   along with any next promotion in any case; the cycle's own "confirm the expected bundle" step is
   where to see it.

**Harness friction.**

1. **Two different checks, and this count needed both.** The slip that cost a round was a relation
   never tested: each line was confirmed to exist, not to cite this section — the Implementer's own
   diagnosis in its commit message, and just as true of round 1's heading, where it began. The new
   wording adds "in all", which is another kind of claim, only as good as a search that could have
   found a fifth file. The brief asked for that search. It is cheap and is on record above: flatten,
   search in Python rather than with `git grep -E`, set the known items aside, and read what is left.
2. **The UTC date rolled over mid-round.** This file's name and its first two rounds say 2026-09-18;
   this round is dated 2026-09-19 UTC. No script reads a review's Date line (`scripts/` was searched),
   so nothing depends on it.
3. Row 316 recurred again: the wiring says commit and flip, the brief reserves both, and the brief was
   followed.

### Verdict (round 3)

**PASS**

Round 2 asked for one thing and it is done, by the harder route. The Implementer did not take the
offered sentence; it went back to the five lines, worked out what each one cites, and wrote that down —
three files citing the 502 section as §8.5, two more lines citing its parent and a sibling, four files
and five lines in all. Each relation was traced here to the commit that wrote the citation and to the
heading that number meant on that day, and the total was tested the only way a total can be, by
searching every tracked file for a sixth line. There is none. The two optional notes round 2 offered
were taken as well, and both read true.

Across three rounds every checkable statement this branch writes into a tracked file has been tested
against a fresh command, and what could only be attested — a browser console, the operator's words — is
marked as such. The record is now accurate as written: a production defect filed with its evidence
and its limits, a row's refinements that reproduce, a story closed on criteria that hold against the
commit, the source and the live site, an intake entry that describes the harness as it is, and a fourth
collision recorded in the row that tracks them. What remains is the orchestrator's — a PR body, a PR
number, and one more look at `staging` before each step.

Lint is clean and differs from staging's by this file's one line, and the nine suites that read a
changed file are green on `b5b0940c`. The local full gate was not re-run; round 2's record, taken on
the merged tree, remains applicable as what it was — red on this host for the recorded Node 16 reason,
15.3% of cases skipped, not a green gate. CI's Node 22 job on the PR is the binding run. This lane has
no story to flip and no book to close, and the commit is the orchestrator's.
