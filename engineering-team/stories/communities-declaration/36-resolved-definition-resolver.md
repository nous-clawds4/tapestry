# Story 36: Implement the §26 Resolved-Definition resolver (client-side)

**Status:** Done
**Created:** 2026-06-05
**Type:** Feature (substrate)
**Epic:** `communities-declaration` (Block 2 prerequisite) · **Architecture:** the contract is **ADR 0028 / BIBLE §26** — no new ADR; this story implements the deferred code.

## Background
ADR 0028 ratified the Resolved Definition (read-side of the `b` inherit-from tag) but deferred all code. Block 2 (fork + inherited-field display) needs it. This story ships a client-side resolver that walks a circle's `b`-parent chain and merges overrides, per §26: child fields override inherited ones; first-listed `b` parent wins; live read-time; `MAX_DEPTH = 16`; cycle-guard truncates.

## User-facing description
As an engineer building fork + inherited-field display, I want a `resolveDefinition(circle)` that returns a circle's effective definition, so that forked circles render what they actually mean after following their deferences.

## Acceptance criteria
- [ ] `resolveDefinition.js` exports `resolveDefinition` (async walk) and `mergeDefinition` (pure merge).
- [ ] `mergeDefinition(base, child)`: a non-empty child field overrides; an empty/absent child field inherits the base.
- [ ] Multi-parent resolves **first-listed-wins** (earlier `b` parent overrides later).
- [ ] The walk is bounded by `MAX_DEPTH = 16` and a visited-set **cycle-guard** that truncates (never throws).
- [ ] Resolution is **live** — the walk fetches each ancestor's current state via an injected fetcher (no snapshot).

## Concepts touched
- BIBLE §25 `b` / `INHERITS_FROM`, §26 Resolved Definition; ADR 0027/0028.

## Out of scope
- Set-valued override algebra (deferred per ADR 0028 — whole-field replace only). Server-side resolution. Caching.

## Linked artifacts
- ADR: §26 / ADR 0028 (contract). Test plan: `36-resolved-definition-resolver.test-plan.md`. Review: [`../../reviews/communities-declaration/36-resolved-definition-resolver.md`](../../reviews/communities-declaration/36-resolved-definition-resolver.md) — **PASS** (7/7).
