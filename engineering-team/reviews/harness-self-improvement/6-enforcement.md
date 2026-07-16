# Review: Story 6 — enforcement

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-04
**Diff:** story-6 commits — `.claude/settings.json` (new) + `scripts/session-start.sh` (new), `scripts/lib/collect-meta.sh` (extracted), `scripts/whats-open.sh` (sources lib + def_paths guard), 8 agent frontmatters, 3 claim-site rewordings (5 sites), `test/session-start.test.js` + registration, def-paths + CHANGELOG (`d5b17870` tests, `d22cd8a4` impl)

## Quality gates (run by reviewer, not trusted)

- [x] Suites re-run standalone: **session-start 8/8, harness-lint 25/25, harness-stats 8/8**. Full `npm test` executed twice this turn — failing set identical to the pre-book stack-dependent baseline (OPEN.md row 13; no local stack in this remote session) — zero regression.
- [x] `bash scripts/harness-lint.sh` — **exit 0, clean**; L10 satisfied (the impl commit touches the def paths and the CHANGELOG together; the two new def-path lines are themselves L10-visible — the self-listing property held a third time).
- [x] **No-second-copy greps:** `collect_meta()` is defined exactly once (`scripts/lib/collect-meta.sh`); the escalation thresholds (`≥3 / >30d`) and the banner wording exist in scripts exactly once, in that same lib. whats-open and the digest both consume it.
- [x] **whats-open behavior preserved post-extraction** (story-4 paths, re-run from a *foreign cwd* to pin the `BASH_SOURCE` lib resolution): quiet path (this repo: 2 open, oldest 15d — no banner, both rows in the section); firing path (3-row fixture: banner with correct count/age + all 3 section lines). Exit 0 both ways.
- [x] **🎯 Live hook firing — verified in-session.** AC-7 deferred this to post-merge on the assumption that a session predating the hook couldn't observe it. The platform fires SessionStart on **resume** as well: this session's own resume event ran the hook and injected the digest (`SessionStart:resume hook success` — lint block, `meta inbox: 2 open, oldest 15d`, stack-absent line, open-books line, pointer — exactly the designed payload). The post-merge fresh-session check (`source=startup`) remains a one-line formality.
- [x] Playwright / lint / typecheck — n/a.

## Spec adherence (AC-by-AC)

- [x] **AC-1** settings.json exists, valid JSON, SessionStart → the digest script — suite test 1 + live firing above.
- [x] **AC-2** script contract: lint output indented with waivers visible; meta line from the shared lib; stack probe `-m 2` (≤2s) with both wordings; compact digest + `/whats-open` pointer; `exit 0` unconditional — suite tests 2–6 incl. the empty git-less dir and the no-lint-script fixture.
- [x] **AC-3** six writing agents carry the four allow rules, **allow-only shape enforced** (suite asserts the *absence* of ask/deny keys — the ADR's precedence-proof property is now regression-pinned).
- [x] **AC-4** Bash removed from product-advisor + product-expert (suite test 8; body lines aligned); **gate-judge.md untouched** per gate decision 2 (not in the changed-file set).
- [x] **AC-5** claim sites state exactly what is enforced: eng README § Role isolation ("literally cannot" gone; tool *withholding* vs trust-based conduct rules distinguished; "platform cannot path-scope Bash" stated); product README ×2 (incl. the operator-auto-approve-mode caveat — the ADR's honest-by-mode consequence, in prose); CLAUDE.md ×2 wiring bullets reworded in place — **file still exactly 191 lines**.
- [x] **AC-6** suite registered at all four `test/test.js` anchors; existing suites green (parity above).
- [x] **AC-7** deferred verification — **superseded by stronger in-session evidence** (resume firing above); the fresh-session `source=startup` confirmation noted for the next session as a formality.
- [x] **AC-8** def-paths registration (`.claude/settings.json`, `scripts/session-start.sh`), CHANGELOG row, lint clean.

## ADR adherence

- [x] Option A precisely on mechanism: shared lib sourced by both consumers (network-free hook — no `git fetch`/`gh` anywhere in the digest path); allow-list-only permissions; minimal hook schema; Options B/C correctly absent.
- [x] **Deviation 1 (accepted):** hook command is `bash "${CLAUDE_PROJECT_DIR:-.}/scripts/session-start.sh"`, not the ADR's literal `bash scripts/session-start.sh`. Platform-documented pattern (loaded from the session-start-hook skill at implementation time); the `:-.` fallback degrades to exactly the ADR's cwd-relative form when the variable is unset. Strictly more robust; suite's name-check unaffected.
- [x] **Deviation 2 (accepted):** the lib carries `meta_escalation_fires()` + `meta_banner()` beyond the ADR's "moved verbatim" — whats-open previously inlined the threshold check and banner printf, so a verbatim-only move would have left the digest restating both, contradicting the ADR's own stated consequence ("thresholds still live in exactly one place"). The deviation *realizes* the contract rather than bending it. `collect_meta()` itself moved verbatim.
- [x] No new dependencies; bash + git + coreutils (+ optional curl, guarded).

## Concept-graph integrity

- [x] n/a — harness wiring only. The stack probe *checks for* the API; it does not require it. **Firmware reinstall:** not required (ADR).

## Things tests can't catch

- [x] bash-3.2 safety: no arrays in `session-start.sh` or `collect-meta.sh`; whats-open's `def_paths` expansion now length-guarded (story-2 review carry-over, closed here at `scripts/whats-open.sh:163-166`).
- [x] `set -uo pipefail` without `set -e` throughout — a red lint pipe can't kill the digest; final `exit 0` unconditional.
- [x] Hook fires on all SessionStart sources (matcher omitted — startup/resume/clear/compact). Live resume firing confirms; payload is compact by design, so the per-resume context cost is the intended trade (gate decision 1).
- [x] No secrets, no debug logging; the hook executes a repo-tracked script — that script is a registered def path, so changes to session-start behavior are L10-recorded events.

## Findings

### Blocking
_None._

### Non-blocking
1. **`scripts/session-start.sh:42`** — the `PORT=7778` fallback literal restates the code default that `cycle-local`'s L5 waiver names as canonically owned there. ADR-sanctioned (AGENTS.md §1 discovery: conf first, code default second) and outside L5's wiring-file scope, but if the default ever changes there are now two places. Candidate: point both at one constant when either is next touched.
2. **`scripts/lib/collect-meta.sh`** — on non-GNU `date` (macOS), ages degrade to `?` and never raise `META_MAX_AGE`, so the >30d trigger is effectively count-only there. Pre-existing story-4 behavior, moved not changed; noting for the retro rather than fixing in-flight.

### Harness friction *(→ OPEN.md `meta` rows)*
1. None new. One observation for the retro (not a defect): AC-7's deferral rested on "a session predating the hook can't observe it" — false in a useful direction; SessionStart also fires on *resume*, which delivered the live verification a phase early. The harness's mental model of hook lifecycles should note this.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run: the book is **not** complete — **6 of 7** stories Done; frame bullets open: story 7 (session-start restructure) and bullet 9 (this book's own `/close-book` runs the first live retro). No `/close-book` offer. Next per dependency order: **story 7, session-start-restructure**.
