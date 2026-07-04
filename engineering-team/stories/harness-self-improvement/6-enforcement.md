# Story 6: enforcement — the claims and the tools finally agree

**Status:** Done
**Created:** 2026-07-02
**Approved:** 2026-07-02 (operator, in-session gate — approved as drafted incl. all three recommendations; the digest reading of the frame's hook clause is the ratified interpretation)
**Done:** 2026-07-04 (review PASS — `reviews/harness-self-improvement/6-enforcement.md`)
**Type:** Feature

## Background

The harness review's §4.1 table is blunt: "the Architect literally cannot edit source code" (eng README), "product roles can Write only into `product-team/`" and "the Product Advisor cannot Write at all" (product README, CLAUDE.md) — all prose. Every agent with Bash or unscoped Write can modify any file; `.claude/settings.json` doesn't exist; nothing fires at session start. This matters doubly: Direction mode's audit credibility explicitly leans on role isolation being real, and stories 1–5 built session-start surfaces (lint, the meta banner) that only help sessions that *run* them.

This story is R-E1 + R-E2: make enforcement real where the platform supports it (per-agent permission rules; a SessionStart hook), remove tools that advisory roles never legitimately need, and — where hard enforcement isn't possible — reword the claims to exactly what is guaranteed. Overstating guarantees is worse than not having them.

## User-facing description

As a contributor (and as the operator relying on the Direction-mode audit story), I want role isolation enforced by the platform where possible and described honestly where not, and every session to open with the harness's own health check — so the guardrails are real, not aspirational.

## Acceptance criteria

- [ ] Given a fresh session, `.claude/settings.json` exists (valid JSON, parseable by the suite) with a **SessionStart hook** invoking `scripts/session-start.sh`.
- [ ] Given `scripts/session-start.sh`: it runs `harness-lint.sh` (violations/waivers visible), surfaces the **meta-escalation state** (the story-4 banner or its quiet equivalent), runs a **≤2s stack probe** (per AGENTS.md §1 discovery) printing either "stack present at :<port>" or "stack absent → use the AGENTS.md fallback ladder", and **always exits 0** (advisory principle; a red lint must inform the session, not brick it). Output is compact by design — a session-start digest with a pointer to `/whats-open`, not the full roll-up (see gate decision 1).
- [ ] Given the six writing product agents (`product-strategist`, `ux-researcher`, `product-manager`, `domain-modeler`, `product-designer`, `product-lead`), each carries **per-agent permission rules** scoping `Write`/`Edit` to `product-team/**` (plus root `OPEN.md`, which the story-3 product retro legitimately writes): in-tree writes proceed, out-of-tree writes require explicit approval instead of silently succeeding (mechanism per ADR — deny > ask > allow semantics).
- [ ] Given the pure-advisory agents `product-advisor` and `product-expert`, **Bash is removed** from their tool lists (their roles already forbid commits and file changes; Read/Glob/Grep/WebFetch cover their inputs). Gate-judge's tools per gate decision 2.
- [ ] Given the three claim sites — `engineering-team/README.md` § "Role isolation", `product-team/README.md` § "Role isolation" (+ line 5 area), and CLAUDE.md's wiring bullet — each states **exactly what is enforced**: which tools are withheld, which writes are permission-scoped, and that Bash (where present) is trust-based. No "literally cannot" that isn't literally true. CLAUDE.md does not grow (budget constraint).
- [ ] Given `npm test`, a small suite (or extension) asserts: `settings.json` is valid JSON and names the hook script; `session-start.sh` exists, is executable, exits 0 in this repo, and its output contains the lint result line, a meta-state line, and a stack-mode line. Existing suites stay green.
- [ ] Given that this session predates the hook, **live hook firing is verified post-merge**: a documented one-line check for the next fresh session ("the session-start digest appeared") recorded in the review as the deferred verification, mirroring the staging-smoke deferral pattern.
- [ ] Given this story's commits, `.claude/settings.json` and `scripts/session-start.sh` join `scripts/harness-def-paths.txt`, the CHANGELOG carries the row, and `harness-lint.sh` stays clean.

## Concepts touched

None — harness wiring only. (Stack not required; the probe *checks* for it.)

## Out of scope

- CI (OPEN.md row 13) and any commit-time blocking hooks.
- Sandboxing/OS-level enforcement, and any attempt to path-scope **Bash** (the platform can't; honesty rewording covers it).
- The engineering agents' tool lists beyond the rewording (Architect/Reviewer keep Write for their sanctioned artifact writes; their isolation is honesty-reworded, not re-tooled — retro may revisit).
- Story 7's pointer-table restructure and formal line caps (this story only refuses to grow CLAUDE.md).
- Editing `gate-judge.md` beyond the gate-2 decision (Direction-governing file; minimal touch).

## Open questions

*All resolved at the Planning gate (2026-07-02, operator):*

1. **Hook payload — RESOLVED:** compact digest (lint + meta banner + stack mode + counts + `/whats-open` pointer); recorded as the ratified reading of the frame's hook clause.
2. **gate-judge Bash — RESOLVED:** keep, labeled trust-based; revisit at the retro.
3. **Out-of-tree writes — RESOLVED:** ask, not deny.

## Linked artifacts

- ADR: `engineering-team/decisions/harness-self-improvement/0006-enforcement.md` (Accepted 2026-07-04)
- Test plan: `engineering-team/stories/harness-self-improvement/6-enforcement.test-plan.md`
- Review: `engineering-team/reviews/harness-self-improvement/6-enforcement.md` (PASS, 2026-07-04)
