# Test Plan: Story 2 — Cycle-skill safe-to-merge check + canonical shared recipe

**Story:** `engineering-team/stories/deploy-safety-gate/2-cycle-safe-to-merge-check.md`
**ADR:** `engineering-team/decisions/deploy-safety-gate/0002-safe-to-merge-check-script-and-shared-recipe.md`
**Date:** 2026-07-18

## Coverage map

All tests live in `test/safe-to-merge-check.test.js`. Two classes: **B** (behavior — the script spawned against an ephemeral in-process HTTP fixture) and **C** (content — file reads of the doc and the three cycle skills). Both classes are stack-free.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (check before merge, verdict just observed, no re-derivation) | `B1` safe first attempt → exit 0 immediately, no residual sleep, correct endpoint, no `bufferMinutes` | `test/safe-to-merge-check.test.js` | behavior (script vs fixture) |
| AC-1 (consume verdict as delivered) | `B8` `safeToDeploy:true` with imminent `nextFire` bait still exits 0; detail journaled verbatim, not interpreted | same | behavior |
| AC-1 (immediate precursor, per consumer) | `C4` cycle-staging: recipe reference sits between `gh pr create` and `gh pr merge`, targets staging.brainstorm.world; `C5` cycle-prod: reference sits between the explicit-approval step and `gh pr merge`, targets tapestry.brainstorm.world, approval-then-check order, approval-stands rule stated | same | content |
| AC-2 (bounded, journaled wait-and-recheck) | `B2` unsafe×2→safe: exit 0, three journal lines (UTC timestamp, verdict, reasons codes, raw body with echoed `bufferMs`), interval argument honored (run sleeps between rechecks) | same | behavior |
| AC-2 (never merge on unsafe; stated bound honored) | `B3` always-unsafe with attempts=3: exit 1, exactly 3 attempts, `BOUND EXHAUSTED` final line, never the merge-may-proceed outcome | same | behavior |
| AC-2 (cadence/bound stated in the recipe, not improvised) | `B9` default bound is 45 (journal reads `attempt 1/45`); `C1` doc pins 45 attempts × 60 s; `C4`/`C5` consumer skills restate **no** numbers | same | behavior + content |
| AC-3 (bound exhausted → loud stop, operator decides) | `B3` (final line names the exhausted bound and hands to the operator) | same | behavior |
| AC-3 (no usable answer ≠ safe; fast 3-strike exit) | `B4` unreachable instance: exit 2 after exactly 3 `no-answer` attempts (not the full 10-attempt bound), `NO USABLE ANSWER … not treated as safe`; `B5` usable-connection unusable answers (404 / non-JSON / JSON missing `safeToDeploy`) each strike → exit 2 | same | behavior |
| AC-3 (blips don't kill a run; strike counter resets on usable answer) | `B6` garbage,garbage,unsafe,garbage,garbage,safe → exit 0, six journaled attempts, no fast exit | same | behavior |
| AC-3 (usage/environment error is its own loud code) | `B7` missing URL arg and malformed URL arg → exit 3, usage on stderr | same | behavior |
| AC-4 (cycle-full inherits by delegation, no recipe content) | `C6` Stage 2 and Stage 4 inline lists name the safe-to-merge step **before** their "Merge it" item; Halt-on-failure list carries the check-stop entry; file contains **no** `check-safe-to-merge.sh`, no `SAFE_TO_MERGE`, no 45/60, no `bufferMinutes`, no `tags.brainstorm.world`, no `/api/deploy-safety/status` | same | content |
| AC-5 (one canonical recipe; feat/tags covered) | `C1` doc exists + names the script + pins the numbers; `C2` branch → instance map (staging / main→tapestry / feat/tags→tags.brainstorm.world) + consumer names; `C3` endpoint pointer, never-safe-on-no-answer rule, operator hand-off, 5-minute staleness rule, manual feat/tags section, 404-transition note | same | content |
| Doc↔script number alignment (ADR Consequences note) | `C7` script exists, executable, bash shebang, carries 45 and 60 as its defaults (paired with `C1`'s doc-side pin); also: no `jq`, no `bufferMinutes` | same | content |

## Edge cases

- [x] Unreachable instance (connection refused on a just-released 127.0.0.1 port) — `B4`.
- [x] Endpoint 404s (pre-story-#1 branch, the doc's transition case) — `B5` first spec; doc note asserted in `C3`.
- [x] Non-JSON body and JSON missing `safeToDeploy` — `B5` (unextractable boolean is *unusable*, never safe).
- [x] Interleaved unusable/usable answers — `B6` (3-strike counter is *consecutive*; a usable answer resets it).
- [x] Safe verdict alongside scary raw schedule data — `B8` (the AC-1 re-derivation trap).
- [x] Safe on the very first attempt with a large interval — `B1` (no residual sleep; the safe answer is acted on at once).
- [x] Missing/malformed URL argument — `B7`.
- [x] Attempt counter and `/N` in every journal line; UTC `date -u +%Y-%m-%dT%H:%M:%SZ` timestamp shape — `parseAttempts` regex used by every B test that journals.

## Test infrastructure

- Framework: Node built-in runner via `npm test` (`test/test.js`); suite also runs standalone: `node test/safe-to-merge-check.test.js`.
- **Stack-free by design — no skips.** The Concept Graph API / control panel / staging / production are never contacted. The "instance" in every B test is an ephemeral `http.createServer` fixture on an OS-assigned `127.0.0.1` port serving scripted `/api/deploy-safety/status` responses (ADR-0001-shaped compact JSON). CI's stack-free job runs the full suite; nothing needs `SKIP`.
- The script is spawned **async** (`child_process.spawn`, awaited) — `spawnSync` would block the event loop and deadlock the in-process fixture. A 15–30 s per-test timeout kills a hung script (an AC-3 "hung with no output" defect reads as a test failure, never a wait).
- Speed: every B run passes small `[max-attempts] [interval-seconds]` args (mostly `0`; `1` in B2 to prove the cadence is honored; `30` in B1 to prove no residual sleep). No test waits real minutes. **Contract implication for the Implementer: the script must accept `0` as an interval argument.**
- Firmware state: none required (story touches no concepts).
- Fixtures: response builders `SAFE` / `UNSAFE(reasons, bufferMs)` / `NOT_FOUND` / `GARBAGE` / `MISSING_FIELD` in the suite; `refusedPort()` (bind-then-release) for unreachability.
- Runner registration: `test/test.js` — require + run + summary line + a term in the **live** `overallOk` chain (added with `&&` directly after `deploySafetyStatusResult.fail === 0`, which was the live terminator; the OPEN.md #43 severed block remains below, untouched). Also added to the informational `totalSkipped` array.

## Prototype validation of the harness

To prove the B-class machinery fails only because the feature is missing (not because the fixture/spawn design is broken), a throwaway spec-conforming script was placed at `scripts/check-safe-to-merge.sh` from the session scratchpad, the suite run (all 9 B tests + C7 passed; C1–C6 still failed on the absent doc/skill edits), and the prototype deleted. The working tree contains no production code from this phase.

## Documented limits

- **Default interval (60 s) is asserted structurally, not behaviorally.** The default bound (45) is proven behaviorally (`B9`: journal reads `attempt 1/45` with zero waiting), but observing the default 60 s sleep would require a real minute; `C7`/`C1` hold the 60 via source/doc content instead. Acceptable per the ADR's Consequences note (alignment "held by a content test").
- **Doc/skill content tests assert presence and order, not prose quality.** Same-line association regexes (e.g., a line carrying both `45` and "attempt") are tolerant of wording; they can't judge whether the rationale paragraphs are good — the Reviewer does that.
- **`C4`'s staging-URL-in-window assertion is weakly discriminating** (the PR-body template already mentions staging.brainstorm.world inside that window); the load-bearing assertion there is the recipe reference itself.
- **First-occurrence ordering in `C5`** assumes the skill doesn't name `SAFE_TO_MERGE.md`/`check-safe-to-merge.sh` in its frontmatter description before the approval step; if a future edit legitimately does, re-baseline the ordering anchor.
- **The number-negative in the skills (`no 45`, `no 60`)** forbids those standalone tokens anywhere in cycle-staging/cycle-prod/cycle-full — deliberate (ADR: "No cadence/bound numbers in the skill"), but it also means unrelated future prose in those files can't use a bare 45/60 without tripping it. That is the intended drift-guard; a legitimate collision would be a re-baselining conversation, not a silent pass.
- **"Proceed anyway after a stop" is procedural** and not mechanically testable — the tests pin that the *script* never exits 0 on unsafe/no-answer and that the *docs/skills state* the operator hand-off; nothing can force a human not to merge.
- **No live-instance verification here** (staging/prod/tags are never called) — by design and by the book's autonomy ceiling; tags coverage is documentation, asserted in `C2`/`C3`.

## How to run

```
npm test
```

Suite only (fast):
```
node test/safe-to-merge-check.test.js
```

## Verification

The new tests fail with the current code — the script, the doc, and the skill steps do not exist. Confirmed 2026-07-18 at commit `61919b18` (branch `feat/deploy-safety-gate`).

Standalone run — all 16 fail, each with a feature-missing message (no harness/typo errors):

```
--- safe-to-merge check tests (epic deploy-safety-gate, Story 2) ---
  FAIL  B1 (AC-1): a safe verdict on the first attempt exits 0 immediately — acted on, not banked across a sleep
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  B2 (AC-2): unsafe twice then safe — every attempt journaled with timestamp, verdict, reasons, raw body; cadence honored; exits 0 only after safe
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  B3 (AC-2/AC-3): always-unsafe exhausts the stated bound — exit 1, every attempt journaled, loud BOUND EXHAUSTED stop, never a merge-on-unsafe
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  B4 (AC-3): unreachable instance — 3 consecutive no-answer attempts exit 2 early (fast path), never treated as safe, never the full bound
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  B5 (AC-3): unusable answers — 404, non-JSON body, JSON missing safeToDeploy — each counts a strike; exit 2 after three, never safe
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  B6 (AC-3): a usable answer resets the unusable-strike counter — blips do not kill a run that later observes safe
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  B7 (AC-3): missing or malformed instance URL — usage to stderr, exit 3, no requests made
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  B8 (AC-1): the script consumes the verdict as delivered — safeToDeploy:true with an imminent nextFire in the payload still exits 0 (no re-derived policy)
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  B9 (AC-2): with no override args the default bound is 45 attempts — the journal itself says attempt 1/45
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.
  FAIL  C1 (AC-5): docs/SAFE_TO_MERGE.md exists, names the script as THE mechanism, and pins the canonical numbers 45 attempts × 60 s
        docs/SAFE_TO_MERGE.md does not exist yet — the one canonical shared recipe (ADR deploy-safety-gate/0002 Option A, SMOKE_TEST.md pattern-twin) is not written.
  FAIL  C2 (AC-5): the doc maps every covered branch to its instance — staging, main, and feat/tags → tags.brainstorm.world
        docs/SAFE_TO_MERGE.md does not exist yet — no branch → instance map.
  FAIL  C3 (AC-5/AC-3): the doc states the endpoint, the never-safe-on-no-answer rule, the operator hand-off, the 5-minute staleness rule, and the manual feat/tags procedure
        docs/SAFE_TO_MERGE.md does not exist yet — no verdict-handling rules.
  FAIL  C4 (AC-1/AC-5): cycle-staging references the recipe between PR-open and the merge command — the merge's immediate precursor — and restates no numbers
        cycle-staging/SKILL.md has no safe-to-merge step: neither docs/SAFE_TO_MERGE.md nor scripts/check-safe-to-merge.sh is referenced between opening the PR and the merge command. AC-1 requires the check as the deploy-triggering merge's immediate precursor, consumed by reference (AC-5), against the instance this merge redeploys.
  FAIL  C5 (AC-1/AC-5): cycle-prod runs the check after explicit approval and before the merge, targeting production, with the approval-stands rule and no numbers
        cycle-prod/SKILL.md has no safe-to-merge step between the explicit-approval step and the merge command — the check must be the merge's immediate precursor, AFTER approval (a pre-approval safe verdict would be banked across an open-ended human wait, which AC-1 forbids).
  FAIL  C6 (AC-4): cycle-full names the check by delegation in both stage lists and the halt list — and carries no recipe content of its own
        cycle-full's Stage 2 (staging) inline step list never names the safe-to-merge check — an agent following this summary reaches the staging merge with no check on its path (AC-4: "no path through cycle-full reaches a deploy-triggering merge without the check").
  FAIL  C7 (alignment): the script exists, is an executable bash script, defaults to the doc's numbers (45/60), and forbids jq and bufferMinutes
        scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not implemented.

safe-to-merge-check: 0 passed, 16 failed
EXIT: 1
```

Full `npm test` gating excerpt (suite registered in the live `overallOk` chain — the term is added with `&&` directly after `deploySafetyStatusResult.fail === 0`, ahead of the statement terminator; the OPEN.md #43 severed block below it is untouched). Final summary of the full run, 2026-07-18:

```
safe-to-merge-check: 0 passed, 16 failed

Test Results
-------------
[… every other suite line reads PASS or SKIP …]
deploy-safety-status suite:                      PASS (23 passed, 0 failed)
safe-to-merge-check suite:                       FAIL (0 passed, 16 failed)
Total skipped:                                   50
Overall:                                         FAIL
```

Gating attribution, stated honestly:

- `safe-to-merge-check suite: FAIL (0 passed, 16 failed)` is the only FAIL line printed in the summary, and `Overall: FAIL` follows from its `&&` term in the live chain. Removing the 16 failures (implementing the feature) is the only deterministic path back to PASS.
- One live-stack suite (`profile-tags-publish`) transiently failed 1 test mid-run (strfry residue: "overwriting the same d-tag with flipped polarity … expected 0 applications, got 1") while its summary line misleadingly printed `SKIP (1 tests; preconditions not met)` — a pre-existing display defect in 24 older summary lines (`.skipped` truthy masks a nonzero fail; filed as **OPEN.md #58**). Re-run standalone immediately after: `profile-tags-publish: 6 passed, 0 failed, 1 skipped` — transient, and untouched by this diff (which changes only the runner registration and adds new files). In CI's stack-free job the publish suites skip wholly, so there the new suite is the sole FAIL forcing Overall.
- Harness self-check: with a throwaway spec-conforming prototype script temporarily in place (scratchpad, since deleted), the suite went 10 passed / 6 failed — all 9 B tests + C7 pass, C1–C6 still fail on the absent doc/skill edits — proving the failures come from the missing feature, not from fixture or spawn defects.
