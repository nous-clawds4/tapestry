# Harness Changelog

The ratified-change record for the **harness definition** — the files listed in
[`scripts/harness-def-paths.txt`](../scripts/harness-def-paths.txt) (roles, workflows,
templates, wiring, orientation docs, and the harness scripts). One row per **logical
change** (a migration, a rule, a mode, a sweep — not one per commit), appended at the
bottom, chronological. The **Origin** column is the point: it records which incident,
ledger row, journal entry, review finding, or ask prompted the change — so the
self-improvement loop is auditable (which feedback channels actually produce changes).

**The touch-rule:** a diff touching harness-definition paths also touches this file.
Enforced at session start by `scripts/harness-lint.sh` (check **L10**) and surfaced by
`/whats-open` ("harness definition changed since your branch diverged"). See
`engineering-team/README.md` § "Tuning the team".

> Rows dated before 2026-07-02 were **reconstructed after the fact** during the
> harness-self-improvement book (story #2), from git history, MIGRATION-epic-folders.md,
> the Direction journals, and the 2026-07-02 harness review.

| Date | Change | Why | Origin |
|---|---|---|---|
| 2026-04-30 | Engineering Team harness created — roles, workflows, templates, README (`4acbe321`, landed 2026-05-05; README's "Generated 2026-04-30" is the authoring date) | run every change through PO → Architect → Tester → Implementer → Reviewer with human gates | adoption of Rob Conery's *Eliminate Crappy Slop Code* pattern; adapted from the earlier local pi-harness experiment |
| 2026-05-04 | `/cycle-local\|staging\|prod\|full` skills + canonical `docs/SMOKE_TEST.md` (`48de7b57`) | one honest, repeatable deploy chain with a single smoke definition every cycle inherits | deploy/smoke steps were being re-derived (and re-mistaken) per session |
| 2026-05-11 | CLAUDE.md **architecture invariants** — POV-first, decentralized-first, filter-at-view-time + reflex checks (`7b9659a0`) | stop centralized-SaaS instincts from silently violating the product's core principles | recurring design mistakes in sessions (pre-computed "trusted set" class) |
| 2026-05-13 | Phase slash commands wired in `.claude/commands/` (`40a402d9`); first port-drift fix in CLAUDE.md (`7d91caac`) | make the phases invocable; correct a stale Concept Graph port | harness usable only by reading role files until then; the port-drift class's first documented instance |
| 2026-05-22 | **Docker container-access house rule** in CLAUDE.md (`68841602`) | logs/CLIs live in containers; host paths like `/etc/brainstorm.conf` don't exist | sessions repeatedly probing non-existent host paths |
| 2026-06-04 | **Epic-scoped folders migration** — stories/decisions/reviews per epic, per-epic numbering, whole-folder `done/` retirement, the **Done-flip rule** (Reviewer sets story `Done` on PASS), + `MIGRATION-epic-folders.md` (`dacbcf03`) | kill the flat-namespace merge-collision class; make retirement an epic-level move | three real numbering collisions (ADR 0010→0012, 0015→0021, the 0041 mis-numbering); shipped **without a status backfill** — the gap the 2026-07-02 sweep closed |
| 2026-06-04 | **Product Team flow** — upstream discovery/design harness with natural-language entry (`41dc6d98`, `f8b5aa3e`) | let a non-technical user drive Discovery → PRD → story decomposition | need to design products before engineering them; slash commands as shortcuts only |
| 2026-06-05 | **Book-close return edge** — books, eager anchors, `/close-book`, audit + prd-addendum/seed (`24ed9513`) | close the product↔engineering loop; make "done" durable across sessions | shipped work wasn't feeding back into product scoping |
| 2026-06-06 | **Protocol-Spec docs-mode** workflow (`74fa29ff`) | run BIBLE/ADR spec work through the cycle without fabricating test plans | protocol work didn't fit the code-shaped phases |
| 2026-06-09 | CLAUDE.md **lane-picking at session start** — Product vs Engineering routing (`055ec168`) | concrete-*sounding* requests were defaulting into build mode, skipping Discovery | operator observation of skipped product phases |
| 2026-06-10 | **Direction mode** — Director role, blinded gate-judge, `/direct-feature`, task-timeline pre-registration (`3a2657b2`) | test whether the harness can carry a feature end-to-end with Claude at the gates | autonomy experiment; pre-registered like a human study |
| 2026-06-11 | Commands + BIBLE links **repointed to epic-scoped paths** (`6b3c0bff`) | the 06-04 migration updated only "5 mechanistic files"; wiring lagged | restatement drift — the class the 2026-07-02 review later catalogued in full |
| 2026-06-14 | **OPEN.md ledger + `/whats-open` roll-up** (`0143835a`) | one derived view of open work across all surfaces, from any session | cross-session tracking pain: loose ends lived only in session memory |
| 2026-06-14 | **Gate-5 clarification** — the Reviewer (not the Director) authors the status flip (`f314bbba`) | resolve a role-boundary ambiguity that caused a real kick-back | reputation-info-popup Direction journal — the loop's first end-to-end worked example (journaled defect → operator-ratified harness commit) |
| 2026-07-02 | **Harness review + Appendix A sweep** (PR #337: review `50e94889`; sweep `fce3e7ee`…`f5ecee80`) — port sweep, status backfill, epic retirement, verdict enum, docs-mode notes, cycle-skill portability, Playwright fix, whats-open upgrade, strictness/intake normalization, ledger truth restoration | 61 adversarially-verified findings; one meta-problem: everything stated twice, nothing enforced, lessons had nowhere to land | operator-commissioned audit (`docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md`) |
| 2026-07-02 | **harness-lint** — L1–L9 invariant guard, waiver file, `/whats-open` section (story #1: `91389c71`, `285bace5`; disposition `c5690a66`) | drift surfaces at session start instead of at the next audit | review §5.3 (enforce stage); ADR 0001 |
| 2026-07-02 | **harness-changelog** — this file, `scripts/harness-def-paths.txt`, lint check **L10**, `/whats-open` divergence notice, README touch-rule (story #2) | every harness change becomes a recorded, announced, origin-attributed event | review §5.4 (ratify stage); ADR 0002; story #2 gate decisions (row-per-logical-change, staging merge-base, latest-only L10) |
