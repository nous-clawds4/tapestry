# Book of Work: Harness Self-Improvement Loop

**Slug:** harness-self-improvement
**Status:** Open
**Opened:** 2026-07-02
**Closed:** —

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Source: `docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md` (PR #337) §5 "Recursive self-improvement — the design" plus the §4.1 enforcement items (R-E1/R-E2) and the §4.4 session-start restructure (R-S1–S4). The operator's ask: *build the recursive self-improvement loop the review designed, run through the harness itself* — so that harness lessons can no longer die silently, drift cannot outlive the next session start, and the loop's first live run is this book's own close.

Design constraint carried over from the review (its completeness critic's own finding): **no new lesson surfaces.** One capture inbox (OPEN.md `meta` rows), one ratified-change record (`engineering-team/CHANGELOG.md`), one mechanical guard (`scripts/harness-lint.sh`). Anything that would add a parallel ledger is out of frame.

### Acceptance frame
- [ ] **The mechanical guard exists.** `scripts/harness-lint.sh` asserts the harness's own invariants (PASS review ⇒ story Done; Closed book ⇒ its epics retired; active story folder ⇒ epic file; review ⇒ matching story; no hardcoded control-panel port or machine-local absolute path in wiring; canonical two-valued verdict vocabulary; harness cross-references resolve; hand-maintained "Last updated" headers within a threshold of git reality). It prints one line per violation with the file path, exits nonzero on violations, supports an explicit waiver file (each waiver citing an OPEN.md row), and runs as a section of `/whats-open`. At book close it runs clean, or every remaining violation is a cited OPEN.md row.
- [ ] **The ratified-change record exists.** `engineering-team/CHANGELOG.md` is seeded retroactively with the known harness changes (date, files, why, **origin** — which incident/row/journal prompted it) and the convention is documented in README § "Tuning the team": a diff touching harness-definition paths (`CLAUDE.md`, `AGENTS.md`, `engineering-team/{roles,workflows,templates}/`, `.claude/{agents,commands,skills}/`, `scripts/whats-open.sh`, `scripts/harness-lint.sh`) also touches CHANGELOG.md — flagged mechanically by harness-lint, and `/whats-open` prints harness-definition changes since the session's branch diverged from origin.
- [ ] **Lessons have a defined terminal state.** `workflows/6-book-close.md` gains a post-mortem/retro step: `journal.md` (when the book has one) is an explicit input, and every journaled process note or proposed amendment ends in exactly one of {operator-ratified harness commit · OPEN.md `meta` row · explicit decline recorded in the audit} — no fourth state. `templates/build-audit.md` gains a "Process findings (harness)" section. The product flow's Phase-7 gate gains the mirrored 3-question retro (unused template sections; guardrail fought or overridden → proposed amendment; what the consuming team lacked). The retro asks "does this port to the other flow?" (the Direction↔human-gated propagation gap).
- [ ] **The origin-drift preflight ships in the human-gated flow.** `workflows/1-planning.md` and `2-architecture.md` gain the fetch + drift-vs-`origin/staging` phase-entry check that Direction mode's Stage-0 already has — closing the 2026-05-24 "Meta: origin-sync check" intake item (open 5+ weeks).
- [ ] **The capture inbox escalates instead of silting.** OPEN.md documents the `meta` escalation rule; `/whats-open` gives meta-type items their own section and proposes a harness story when any meta item is >30 days old or ≥3 related items accumulate (counting/aging mechanical; "related" stays judgment). CLAUDE.md's write-discipline paragraph gains the one-sentence capture rule (an orientation doc that misled the session ⇒ `meta` row before ending) without growing CLAUDE.md's line count.
- [ ] **The harness measures itself.** `scripts/harness-stats.sh` derives per-gate kick-back rate, phase cycle times, and books opened-vs-closed from the phase-prefixed commit history and review files; the close-book retro cites its output.
- [ ] **Enforcement matches the claims.** `.claude/settings.json` exists with (a) a SessionStart hook running `whats-open.sh` + `harness-lint.sh` + a short stack probe (printing "stack absent → use the AGENTS.md fallback ladder" when localhost is dead), and (b) permission rules that path-scope the product agents' Write/Edit to `product-team/`; advisory agents that never legitimately write lose Bash; the role-isolation claims in both READMEs and CLAUDE.md are reworded to exactly what is enforced (R-E2). *(R-E3, the CI test job, stays out of this book — it depends on the test-suite hermeticity split tracked as OPEN.md row 13.)*
- [ ] **Session start is lazy-loadable within a hard budget.** CLAUDE.md's "read all four" is replaced by a per-task pointer table; AGENTS.md carries the probe-and-fallback ladder (one short-timeout curl → firmware JSON → BIBLE §5–§9, with the don't-load-BIBLE rule scoped to graph-reachable sessions); a one-page onboarding path exists; and neither CLAUDE.md nor AGENTS.md exceeds its pre-book line count (the budget rule, checked by harness-lint).
- [ ] **The loop runs once for real.** This book's own `/close-book` executes the new post-mortem/retro step — the first live run — and its output lands per the no-fourth-state rule.

## Epics in this book
- `harness-self-improvement` — the five loop mechanisms (lint, changelog, retro, escalation, stats) plus enforcement and the session-start restructure.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** *(to be filled by `/close-book`)*

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/harness-self-improvement/audit.md`
- Product feedback: `engineering-team/audits/harness-self-improvement/prd-seed.md`
