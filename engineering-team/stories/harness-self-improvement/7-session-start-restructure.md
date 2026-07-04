# Story 7: session-start-restructure — orientation that fits in the window

**Status:** Draft
**Created:** 2026-07-04
**Type:** Feature

## Background

The review's §4.4 finding is a contradiction with git evidence: CLAUDE.md mandates "read all four" (~24,300 words ≈ 32–34k tokens, ~17% of a 200k window) before any work, while the first mandated doc — AGENTS.md — *forbids* loading BIBLE.md until needed. Full compliance with one violates the other, and stale headers surviving ~20 sessions show sessions silently skip the mandate. Meanwhile AGENTS.md's mandatory orientation is a localhost curl that fails in every stack-absent session (web/remote/CI — including the session running this book); the working fallback exists only in two command files and as reviewer precedent, so fresh sessions re-derive it. A new human contributor has no documented path shorter than ~2,600 lines, and README.md's Quickstart step 1 checks out a branch (`concept-graph`) that no longer exists.

This story is R-S1 + R-S2 + R-S3 + R-S4: replace the bulk-read mandate with per-task pointers, promote the practiced stack-absent fallback into AGENTS.md itself, give newcomers a one-page path, and cap the two always-loaded files so fixes to the context problem can't recreate it. It completes the epic's story list; story 6's digest already prints "stack absent → use the AGENTS.md fallback ladder (§1–§2)" — this story makes that pointer land on a real ladder.

## User-facing description

As any session (human or agent, stack-present or stack-absent, fresh or remote), I want session-start reading proportional to my task — pointers instead of mandates, a fallback that's written down instead of re-derived, and a hard budget on the always-loaded files — so orientation is something sessions actually do rather than silently skip.

## Acceptance criteria

- [ ] Given CLAUDE.md, the "read all four" mandate is replaced by a **per-task pointer table** (R-S1): touching code → AGENTS.md (+ BIBLE sections via its ToC as needed); deploying → OPERATIONS.md; product direction → ROADMAP.md; protocol/NIP/wire-format → protocols/README.md; "what's open" → `/whats-open` (noting the story-6 digest now fires automatically). The four docs stay linked; the ⚠ architecture-invariants section and the TA-pubkey rule are untouched; **CLAUDE.md does not grow** (≤ 191 lines after the change).
- [ ] Given AGENTS.md, it carries the **probe-and-fallback ladder** (R-S2) as normative text: one short-timeout probe (the §1 discovery) → on failure, orient from `firmware/*.json` → BIBLE §5–§9 via ToC; the existing "don't load BIBLE.md" rule is explicitly scoped to graph-reachable sessions; a stack-absent session is told what is *unavailable* (firmware install, `/cycle-local`) — and the story-6 digest's "fallback ladder (§1–§2)" pointer resolves to it. A **stack-free orientation card** (~15 lines) exists within the two capped files' budget.
- [ ] Given a new human contributor, a **one-page onboarding path** (R-S3) exists: CLAUDE.md → engineering-team/README.md → `bash scripts/whats-open.sh` → BIBLE ToC — and README.md's Quickstart no longer references the nonexistent `concept-graph` branch (location/mechanism per ADR: in-place Quickstart rewrite preferred over a new doc — fewest surfaces).
- [ ] Given the **budget rule** (R-S4), `harness-lint.sh` gains a check: CLAUDE.md and AGENTS.md have line-count caps equal to their post-restructure sizes; exceeding a cap is a violation whose message states the rule ("name the text you replace; on-demand behavior goes to a command/skill/script/hook instead"). The caps live in exactly **one machine-read place** (mechanism per ADR); the rule's prose documentation lives at that same single source, not restated in the capped files.
- [ ] Given `npm test`, the harness-lint suite is extended to cover the budget check (fixture over-cap → violation; at/under-cap → clean; missing cap data degrades to INFO, not a crash). Existing suites stay green.
- [ ] Given the restructure, **no information is silently deleted**: every CLAUDE.md/AGENTS.md passage removed either lands in a pointed-to surface or is named in the story/review as genuinely redundant (the reviewer audits the before/after).
- [ ] Given this story's commits, the CHANGELOG carries the row and `harness-lint.sh` stays clean (both files are already def paths; the lint change rides the same commit as its CHANGELOG row).

## Concepts touched

None — orientation/wiring only. (Stack not required; the ladder exists precisely for its absence.)

## Out of scope

- The optional CI-refreshed `docs/concept-summaries.json` snapshot (R-S2's tail) — blocked on CI existing at all (OPEN.md row 13, R-E3).
- Content refreshes of ROADMAP.md / OPERATIONS.md (OPEN.md rows 14–15) and any BIBLE.md restructuring beyond pointing at its existing ToC.
- Multi-contributor gaps (§4.6: attribution, merge-conflict conventions) — separate story if escalated.
- Retuning the story-6 digest contents (its pointer text only has to resolve).

## Open questions

1. **Cap semantics:** exact post-restructure line counts as the caps (R-S4's letter — "capped at their current sizes"), or small headroom (e.g., +5%)? *Recommendation: exact counts — headroom is how budgets erode; a future story that needs a line must free a line.*
2. **Onboarding location:** rewrite README.md's Quickstart in place as the one-page path, or add `docs/ONBOARDING.md`? *Recommendation: in place — the review's own critic flagged surface proliferation; a broken Quickstart fixed is better than a new doc beside a broken Quickstart.*
3. **Orientation-card placement:** in CLAUDE.md's pointer table region, or as the top of AGENTS.md's ladder? *Recommendation: AGENTS.md — the card is the stack-absent branch of orientation, which is the ladder's job; CLAUDE.md should shrink, not trade one block for another.*

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
