# Story 20: Document the task queue subsystem in BIBLE + admin tools panel in OPERATIONS

**Status:** Approved
**Created:** 2026-05-21
**Type:** Doc (fast-track — Implementer + Reviewer only, per CLAUDE.md classification table; skipping Architecture + Test Design phases)

## Background

Stories #13 + #15 + #16 + #17 + #18 collectively built a substantial architectural feature — a durable per-task BullMQ queue with a cross-task Neo4j-heavy semaphore, owner-or-admin BullBoard operator UI, and a template-driven feature flag now defaulting to on. Each story's ADR captured its contemporaneous decision, and `OPERATIONS.md` §10 + §10.6 cover the operator-side recipes. But **`BIBLE.md` — the canonical architectural document — does not mention the task queue at all.** A new contributor reading BIBLE to understand "how does this thing work" would miss the entire `/api/run-task` → BullMQ → Redis → Worker → `launchChildTask.sh` flow.

Separately, story #19 (admin tools dashboard panel + Neo4j-Browser-button bug fix + BullBoard back-link) shipped without an OPERATIONS.md update. The ADR didn't include one, the Tester didn't catch it, the Reviewer didn't catch it. Operators looking in OPERATIONS for "where do I find BullBoard?" still get the §10.2 answer ("navigate to `/admin/queues/`"), which is true but not the new shortest path — they could click the panel on the dashboard.

This story closes both documentation gaps with a single small docs-only ship.

## User-facing description

**As a contributor** reading BIBLE.md to understand the Tapestry architecture, **I want** the task queue subsystem to be documented alongside strfry, Neo4j, and the other major services, **so that** I can form a complete mental model of the running system without reading five ADRs in sequence.

**As an operator** reading OPERATIONS.md to find queue triage tools, **I want** the dashboard's Admin tools panel to be mentioned in §10.2 (or wherever BullBoard discoverability lives), **so that** I know there's a shortcut from the dashboard rather than having to type `/admin/queues/` directly.

## Acceptance criteria

### BIBLE.md addition

- [ ] A new section in `BIBLE.md` describes the task queue subsystem at the architectural-shape level. The section names: BullMQ, Redis (as the persistence + dedup layer), the per-task Queue+Worker topology, the `TASK_QUEUE_ENABLED` feature flag, BullBoard at `/admin/queues/` with owner-or-admin auth, and the cross-task `neo4j-heavy` resource-class semaphore.
- [ ] The section references the source-of-truth chain established by stories #16 + #17: `config/brainstorm.conf.template` → `tools/render-conf-template.js` → `/etc/brainstorm.conf` → consumed by `bin/control-panel.js` at startup.
- [ ] The section does NOT duplicate ADR content verbatim. It gives the reader a one-screen mental model and points to the ADRs (0012, 0013, 0014, 0015, 0016) for the design rationale.
- [ ] The section is added to BIBLE.md's table of contents.

### OPERATIONS.md addition

- [ ] §10.2 (or another suitable spot near §10's BullBoard discoverability content, or §11 if the operator prefers that location) gains a short paragraph or sentence describing: the dashboard's Admin tools panel exists, where it lives (route `/tapestry`), who sees it (owner + admins per `BRAINSTORM_ADMIN_PUBKEYS`), and what cards it contains (BullBoard + Neo4j Browser).
- [ ] The new content references story #19 / ADR 0017 for traceability.

### Quality

- [ ] No regression in any of the 16 npm test suites (no source files touched; this is purely doc work).
- [ ] No new lint/typecheck/build tooling.

## Concepts touched

- BIBLE.md — the canonical architecture document
- OPERATIONS.md — the operator-facing deployment doc
- (Indirectly: the task queue subsystem itself, which is being described — no source changes)

## Out of scope

- **Rewriting any of the ADRs.** ADRs are historical records of the decisions at their time. Story #20 summarizes accumulated architecture; it does not amend prior ADRs.
- **Adding the task queue to BIBLE's Architecture diagram.** The BIBLE diagram already shows the container layout; adding BullMQ as a service line is a polish that can come later if the prose proves insufficient.
- **Adding the new admin tools panel to a screenshot or visual.** Doc work is text-only.
- **README.md updates.** README is new-contributor entry point; today's accumulated work is internal/operator-facing.
- **ROADMAP.md updates.** Roadmap isn't shifted by today's operator-experience polish.
- **Other intake-log items** (`/relay` landing page + per-request log spam). Both already captured in `_intake.md` for future stories.

## Open questions

Resolved at planning (2026-05-21):

- **BIBLE section level of detail** → architectural mental model, ~30-60 lines. Not a duplication of ADRs; an index into them.
- **BIBLE section location** → Implementer's call; somewhere after the protocol/data-model sections (§5–§7) where service-architecture content lives.
- **OPERATIONS.md section** → §10.2 (BullBoard UI) is the natural home for the admin tools panel mention.
- **No architect, no tester** → Doc fast-track per CLAUDE.md. Skip directly from Planning to Implementation.

## Linked artifacts

- ADR: _not applicable — Doc fast-track skips Phase 2._
- Test plan: _not applicable — Doc fast-track skips Phase 3._
- Review: [../reviews/20-bible-task-queue-section.md](../reviews/20-bible-task-queue-section.md) — **PASS** end-to-end (16/16 suites unchanged + 20-claim accuracy audit clean + all ADR cross-references resolve).
