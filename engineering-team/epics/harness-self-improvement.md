# Epic: Harness Self-Improvement Loop

**Status:** Done
**Book:** `engineering-team/audits/harness-self-improvement/book.md` (acceptance-frame)

## What this is

The recursive self-improvement loop designed by the harness review (`docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md` §5, PR #337): the machinery that lets the harness improve itself as it's used, instead of accumulating drift until an audit finds it. Five mechanisms with exactly one surface each — **capture** (OPEN.md `meta` rows as the single inbox), **route** (a defined post-mortem/retro step at book close), **enforce** (`scripts/harness-lint.sh` asserting the harness's own invariants), **ratify** (`engineering-team/CHANGELOG.md` with an origin column + an aging/clustering escalation rule), **measure** (`scripts/harness-stats.sh` over the phase-commit convention) — plus the two flanking items the review scoped into the same week: real/honest role-isolation enforcement (`.claude/settings.json`), and the lazy-loadable session-start restructure under a hard context budget.

Humans keep ratification. The scripts only count, age, lint, and surface — no lesson can die silently, and drift cannot outlive the next session start.

## Stories

`stories/harness-self-improvement/` — dependency-ordered:

1. **harness-lint** — `scripts/harness-lint.sh`: the mechanical guard (invariants + waiver file + `/whats-open` wiring + tests). Everything downstream cites it.
2. **harness-changelog** — `engineering-team/CHANGELOG.md` seeded retroactively with origins; the touch-rule documented in README and checked by lint; `/whats-open` prints harness-definition changes since branch divergence.
3. **close-book-retro** — the post-mortem step in `workflows/6-book-close.md` (journal.md as input; {ratified commit · meta row · declined} — no fourth state); build-audit "Process findings" section; the mirrored product Phase-7 retro; the origin-drift preflight ported into workflows 1–2.
4. **meta-escalation** — the OPEN.md `meta` aging/clustering rule in `whats-open.sh` + OPEN.md docs; the one-sentence capture rule in CLAUDE.md's write discipline (budget-neutral).
5. **harness-stats** — `scripts/harness-stats.sh`: kick-back rates, phase cycle times, books opened-vs-closed, derived from git + reviews; cited by the retro.
6. **enforcement** — `.claude/settings.json` (SessionStart hook: whats-open + lint + stack probe; path-scoped Write/Edit permission rules for product agents); drop Bash from advisory agents that never write; reword the isolation claims to what's enforced (R-E2).
7. **session-start-restructure** — CLAUDE.md per-task pointer table replacing "read all four"; AGENTS.md probe-and-fallback ladder; one-page onboarding path; the CLAUDE.md/AGENTS.md line-count budget rule (lint-checked).

## Out of scope (whole epic)

- **R-E3 (CI test job)** — blocked on the test-suite hermeticity split (OPEN.md row 13); separate story once the stack-free/live-API suites are separable.
- **New lesson surfaces** of any kind — the review's own critic found its raw findings proposed seven parallel ledgers; this epic builds exactly three surfaces (meta rows, CHANGELOG, lint) and wires existing ones.
- Backfilling the live-feed post-close stories (OPEN.md row 16), refreshing ROADMAP/OPERATIONS content (rows 14–15) — tracked, not this epic.

## Related

- `docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md` — the review this epic executes (§5 design, §4.1 R-E1/E2, §4.4 R-S1–S4).
- The Appendix A sweep (PR #337, 2026-07-02) — the one-time backfill this loop exists to make unnecessary next time.
- OPERATIONS.md §11 "Drift sentinels" — the in-repo precedent for drift-prevention-as-tests that harness-lint extends to the harness itself.
