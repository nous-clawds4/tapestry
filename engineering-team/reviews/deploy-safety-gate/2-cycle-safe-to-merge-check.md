# Review: Story 2 — Cycle-skill safe-to-merge check + canonical shared recipe

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-18
**Diff:** `git show ffcf0f8a` ("impl: cycle-safe-to-merge-check", vs parent `387fc8ec`). Also audited for lane separation: the two Tester-role baseline-repair commits `7d6960fd` and `387fc8ec` (pre-existing zombie tests in `test/profile-tags-publish.test.js`; not story work).
**Story:** `engineering-team/stories/deploy-safety-gate/2-cycle-safe-to-merge-check.md`
**ADR:** `engineering-team/decisions/deploy-safety-gate/0002-safe-to-merge-check-script-and-shared-recipe.md`
**Test plan:** `engineering-team/stories/deploy-safety-gate/2-cycle-safe-to-merge-check.test-plan.md`

All line references below are to the files as they exist on disk at `ffcf0f8a` (= HEAD at review time), not to diff hunks.

## Quality gates (run by reviewer, not trusted)

- [x] `node test/safe-to-merge-check.test.js` standalone — **16 passed, 0 failed, exit 0** (B1–B9, C1–C7 all PASS on my own run).
- [x] `npm test` full — **exit 0, `Overall: PASS`, zero FAIL suite lines**, run once in full by me. Summary tail verbatim:

  ```
  deploy-safety-status suite:                      PASS (23 passed, 0 failed)
  safe-to-merge-check suite:                       PASS (16 passed, 0 failed)
  Total skipped:                                   28
  Overall:                                         PASS
  ```

  The one skip relevant to this epic's Gate-4 history: `profile-tags-publish: 6 passed, 0 failed, 1 skipped` — the skip is the typeahead conditional-contract skip introduced by baseline repair `7d6960fd` ("tags result type disabled (search.resultTypes.tags=false — shipped default…)"), printing exactly the designed message; the overwrite test **passed in-run** (repair `387fc8ec` holding). No environmental flakes occurred this run — no standalone rerun/attribution needed (ledgered environment rows OPEN.md #51/#58 did not manifest).
- [x] `npm run test:playwright` — **not applicable**: no browser/UI surface changed (bash script, ops doc, three skill files).
- [x] Registration audited: `test/test.js:160` (require), `:441–442` (run), `:751` (summary line, correct non-masking form), `:871–872` (live `overallOk` term, `&&` after `deploySafetyStatusResult.fail === 0`).
- [ ] _Lint/typecheck/build not configured — skipped._ (`scripts/harness-lint.sh` run instead; see House rules.)

## Script exercised directly by reviewer (beyond the suite)

1. **Local healthy instance** (`bash scripts/check-safe-to-merge.sh http://localhost:7778`) → **exit 0 on attempt 1**, one journal line `[2026-07-18T22:12:02Z] attempt 1/45 verdict=safe reasons=[] raw={…"safeToDeploy":true…"bufferMs":600000…}` + `SAFE — merge may proceed (act immediately; re-run the check if more than 5 min elapse…)`. Default bound `/45` visible in the journal; raw body with echoed `bufferMs` journaled verbatim; no residual sleep.
2. **Dead port** (`http://127.0.0.1:59999 10 0`) → exactly **3** `verdict=no-answer` attempts (`raw=curl exit 7…`), then `NO USABLE ANSWER (3 consecutive unusable attempts) — not treated as safe; the operator decides.` → **exit 2** (fast path, not the 10-attempt bound).
3. **Bad args** — no args → usage on stderr, **exit 3**; `not-a-url` → **exit 3**; non-numeric `[max-attempts]` (`abc`) → **exit 3** (the story's documented Deviation 1, confirmed live). No requests made in any exit-3 case.

Staging/prod/tags were **not** contacted, per the review brief and the book's autonomy ceiling (the live staging use is Stage-2 evidence, bullet 6c — not review work).

## Spec adherence

- [x] **AC-1 (check before merge, on the instance the merge redeploys):** cycle-staging inserts step 4 "Safe-to-merge check" between step 3 (Open PR) and step 5 (Merge), targeting `https://staging.brainstorm.world` (`.claude/skills/cycle-staging/SKILL.md:79–92`); cycle-prod inserts step 4 after step 3 (explicit approval), targeting `https://tapestry.brainstorm.world` (`.claude/skills/cycle-prod/SKILL.md:83–98`). "Just observed, not banked": 5-minute staleness rule in both skills (`cycle-staging/SKILL.md:87`, `cycle-prod/SKILL.md:91`), in the doc (`docs/SAFE_TO_MERGE.md:29,47`), and in the script's safe outcome line (`scripts/check-safe-to-merge.sh:87`). Consume-as-delivered: the script branches only on `safeToDeploy` (`check-safe-to-merge.sh:83–101`, comment at `:23–27`) — proven by B8's imminent-`nextFire` bait. Tests: B1, B8, C4, C5 — all passing on my run.
- [x] **AC-2 (bounded, journaled wait-and-recheck; never merge on unsafe):** cadence and bound are written into the recipe (`docs/SAFE_TO_MERGE.md:25` — 45 × 60 s), defaults in the script (`check-safe-to-merge.sh:35–36`); every attempt echoes its journal line *before* any sleep (`:75/:86/:93/:99` precede `:110`), so "waited without recording" is structurally impossible; unsafe never exits 0 (B3 asserts the merge-may-proceed line is absent). Tests: B2, B3, B9, C1.
- [x] **AC-3 (loud stop, operator decides):** exit 1 bound-exhausted with final line naming bound and hand-off (`:114–115`); exit 2 after 3 consecutive unusable answers (`:104–107`) with usable-answer counter reset (`:92`; B6 interleave proof); exit 3 usage (`:48–60`); fetch-failure ≠ safe (curl branch `:72–75`; unusable branch `:95–100`). Skills carry matching error-handling stops (`cycle-staging/SKILL.md:147`, `cycle-prod/SKILL.md:145`); cycle-full's halt list carries the check-stop entry (`cycle-full/SKILL.md:108`); the doc states never-safe-on-no-answer + explicit-recorded-operator-decision (`docs/SAFE_TO_MERGE.md:52`). Tests: B3–B7, C3. My own dead-port and bad-args runs confirm the exits live.
- [x] **AC-4 (cycle-full inherits by delegation):** Stage 2 item 4 (`cycle-full/SKILL.md:50`), Stage 4 item 3 (`:75`), halt entry (`:108`) — each names the check and the delegate, before the merge item. The negatives verified by my own grep, independent of C6: `cycle-full/SKILL.md` contains no `check-safe-to-merge.sh`, no `SAFE_TO_MERGE`, no standalone 45/60, no `bufferMinutes`, no `tags.brainstorm.world`, no `/api/deploy-safety/status`. Ordering across delegation is sound: the prod approval (Stage 3 gate) precedes Stage 4 entirely, so approval-then-check holds on the cycle-full path too. Test: C6.
- [x] **AC-5 (one canonical recipe; feat/tags covered):** `docs/SAFE_TO_MERGE.md` is the single recipe (SMOKE_TEST.md pattern-twin, purpose header `:5`); branch → instance → consumer table incl. `feat/tags` → tags.brainstorm.world (`:33–37`); "Manual promotions to `feat/tags`" section (`:60–68`) with the endpoint-404 transition note (`:70`). Both cycle skills consume by reference and restate no numbers (my grep: no standalone 45/60/`bufferMinutes` in either; the only load-bearing tokens are the doc link, the script invocation, and the target URL). The doc's own "(step 4)" consumer pointers match the renumbered skills. Tests: C1–C5.
- [x] No criterion silently dropped; no behavior added beyond the story (see Deviations audit below for the two logged exceptions — both accepted).

## ADR adherence

- [x] **Option A implemented as decided:** committed script + one shared doc + two referencing skill steps + delegation-naming in cycle-full.
- [x] **Sub-decision 1 (numbers):** 45 × 60 defaults (`check-safe-to-merge.sh:35–36`), 3-strike fast path (`:38, :104–107`), 5-min staleness (doc `:29`), overrides documented as test-suite/operator-only (script header `:12–15`, doc `:25`). Interval `0` accepted (test-plan contract) — verified in my runs.
- [x] **Sub-decision 2 (no `bufferMinutes` pin):** the request pins nothing (B1 asserts the URL), script and skills contain no `bufferMinutes` (my grep + C7/C4/C5); the doc states the choice explicitly (`docs/SAFE_TO_MERGE.md:58`), satisfying ADR 0001's Consequences flag.
- [x] **Sub-decision 3 (slots):** staging step 4 between PR-open and merge; prod step 4 post-approval with both stated rules — order rationale (`cycle-prod/SKILL.md:85`) and approval-stands (`:94`, full sentence incl. fresh-decision-on-stop).
- [x] **Sub-decision 4 (cycle-full):** exactly three line-insertions + renumbering, no recipe content (verified above).
- [x] **Sub-decision 5 (tags section):** present, incl. same-mechanism invocation and 404 transition note.
- [x] **Sub-decision 6 (no jq):** no `jq` anywhere in the script (C7 + my read); grep/sed extraction (`:79–80`); unextractable boolean → unusable, never safe (`:95–100`); raw body journaled verbatim on every line.
- [x] **Sub-decision 7 (journal medium):** stdout, one line per attempt in the pinned format (the suite's `ATTEMPT_RE` parses every line in every B test; my live runs match).
- [x] **Sub-decision 8 (doc location):** `docs/SAFE_TO_MERGE.md`; neither artifact added to `scripts/harness-def-paths.txt` (verified — grep finds neither).
- [x] **Sub-decision 9 / exit-code contract:** 0/1/2/3 implemented (`:17–21` header, enforced in body) and consumed consistently by the doc's table (`docs/SAFE_TO_MERGE.md:45–50`) and both skills' step text.
- [x] **No new dependencies** (bash + curl + coreutils; no `package.json`/lockfile changes in the diff), no new lint/typecheck/build tooling.
- [x] Doc↔script number alignment held by C7 + C1, as the ADR's Consequences note requires; the test plan documents that the default 60 s is structural, not behavioral — acceptable per the ADR.

## Deviations audit (story `## Deviations`, both logged by the Implementer)

1. **Non-numeric `[max-attempts]`/`[interval-seconds]` → exit 3** (`check-safe-to-merge.sh:55–60`). Within the ADR's own exit-3 semantics ("usage-or-environment-error"); the alternative — a garbage bound entering the loop — would be an unstated fourth behavior. Verified live (`abc` → usage + exit 3). **Accepted.**
2. **cycle-prod error-handling bullet carries one endpoint-404 transition sentence** (`cycle-prod/SKILL.md:145`). Restates the ADR's Consequences "sequencing reality" so the first real gated prod promotion doesn't read a correct fail-closed exit 2 as a defect; no numbers, no recipe content (C5's negatives still pass). **Accepted.**

## Lane-separation audit (baseline-repair commits vs story diff)

- [x] `git show --stat 7d6960fd` → `OPEN.md` (+row #59) + `test/profile-tags-publish.test.js` only. Recasts the typeahead test to the ratified conditional-contract skip (probe `tagHits`-key presence; the tag-match path is structurally off since `854df80c`'s shipped default). Zombie since 2026-06-10; not looser — a structurally-unpassable test now skips with the gate named.
- [x] `git show --stat 387fc8ec` → `OPEN.md` (+row #60) + `test/profile-tags-publish.test.js` only. Explicit `created_at + 1` on the overwrite replacement (`nak event --ts` threaded through `nakSignEvent`/`signProfileTagEvent`) — removes the NIP-01 same-second tie-break lottery; strictly **more** deterministic. Passed in my full run.
- [x] **The impl commit touches no tests:** `git diff --name-only 387fc8ec..ffcf0f8a -- test/` is empty; the only `test/` change since Gate 3 (`cb85c264`) is `test/profile-tags-publish.test.js`, fully attributable to the two Tester-role commits. Direction-mode Gate-4 separation holds.

## Concept-graph integrity

- [x] No concept definitions touched (story + ADR both verified live against the graph, 48 concepts; the diff contains no handles, no kind-39998/39999 surfaces).
- [x] Firmware reinstall: **not required** — nothing concept-shaped changed.
- [x] `/summaries` orientation: N/A for a bash ops script; the artifacts orient consumers via `docs/SAFE_TO_MERGE.md` ← skills, the intended chain.

## Things tests can't catch

- [x] No secrets, no TA-pubkey literal (`82b75e47…` absent; my grep hits on "secret"/"nsec" were false positives inside the word "co**nsec**utive"), no `console.log`/debug residue, no commented-out code, no stray TODOs.
- [x] Fail-closed edges beyond the suite: `safeToDeploy` as a quoted string (`"true"`) or absent → unusable, never safe (`:79, :95–100`); `curl -sf` routes non-2xx and timeouts to the strike path; trailing-slash base URL normalized (`:53`); degenerate `max-attempts=0` override skips the loop into exit 1 (never exit 0) — fail-closed.
- [x] Concurrency: the check is a read-only GET; concurrent runs are harmless.
- [x] Stale-reference sweep: no other doc (`OPERATIONS.md`, `AGENTS.md`, `docs/`, `.claude/commands/`) references cycle-skill steps by the old numbers — the ADR's renumbering concern has no live victims.

## House rules check

- [x] Concept Graph API authority respected (nothing in-domain).
- [x] No new lint/typecheck/build tooling.
- [x] `bash scripts/harness-lint.sh` run by me: **clean (0 violations)**, exit 0 — all WAIVED lines pre-existing/ledgered, none introduced by this diff. L10 satisfied: the commit touching `.claude/skills/**` includes the `engineering-team/CHANGELOG.md` row (`CHANGELOG.md:51`, well-formed 4-column row matching the header). L5/L6/L8 clean by construction (public https URLs; repo-relative invocation; resolving `../../../docs/SAFE_TO_MERGE.md` links).

## Product-guide adherence

N/A — no PRD; this book is a no-PRD acceptance frame.

## Findings

### Blocking

None.

### Non-blocking

1. **scripts/check-safe-to-merge.sh:96** — the unusable-branch comment says "404 body", but with `curl -f` a real HTTP 404 exits curl (rc 22) and lands in the *curl-failure* branch (`:72–75`); the `*)` branch actually catches 2xx-with-unusable-body. Both paths count strikes identically, so behavior is correct and B5 passes either way — comment accuracy only.
2. **engineering-team/audits/deploy-safety-gate/journal.md** and the story's Deviations ride in the impl commit — Director-lane process records; fine under Direction mode's Director-commits model, noted for the audit trail.

### Harness friction

None — every doc I was pointed at matched reality this session.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/deploy-safety-gate/2-cycle-safe-to-merge-check.md`); Review link filled in the story's Linked artifacts.
- [x] Completion detection run: book `deploy-safety-gate` acceptance frame — bullet 4 (cycle-skill check + canonical recipe + tags coverage) is satisfied by this story; **bullets 5 (settings-panel aggregate countdown line) and 6 (live-on-staging evidence, incl. 6c's journaled check run against staging) remain open**. The book is **not** complete; no close offered.
