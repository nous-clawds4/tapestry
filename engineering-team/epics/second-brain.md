# Epic: Second Brain (display name: "Tapestry Harness")

**Created:** 2026-07-22
**Status:** Active
**Book:** `engineering-team/audits/second-brain/book.md` (PRD-backed)
**Source PRD:** `product-team/prd/second-brain.md`
**Guides:** `product-team/guides/second-brain-design-guide.md`, `second-brain-style-guide.md` (+ `second-brain-wireframes.html`) — binding at review
**Queue:** `product-team/stories-queue.md` → "Stories Queue: Second Brain" (2026-07-21) — queue order is pickup order

## What this is

The owner's concept graph becomes the durable substrate for goals, knowledge pointers, and judgment — so agent sessions orient in seconds, work gets chosen deliberately, and (in later phases) achievement continues in the owner's absence. **Delegation is the product; memory is the tool that makes delegation trustworthy.** This epic is the MVP block "Capture, Decompose, Propose": the delegation loop minus autonomous launch — goals live in the brain, sessions orient from them, the system proposes, the owner decides and launches.

Three owner-gated views inside the existing control panel (Goals view, Goal detail, Proposal queue), riding existing graph machinery: Goal adopts `39998:<TA>:tapestry-owner-goal`; new concepts follow the established pointer-element pattern.

## Stories

`stories/second-brain/` — dependency-ordered (see the queue's sequence summary):

1. **capture-a-goal-and-see-it** — state a goal in conversation, see it in the Goals view; adopts the existing goal concept; cold-start empty state; privacy indicator line. **Done** (review PASS 2026-07-23).
2. **structures-the-brain-can-trust** — hygiene check against class discipline; the queue's "stray membership edges" adjudicated legitimate-and-retained (falsified premise, operator-ratified); the real drift (primary-property records lagging extended schemas) reconciled on both work-item concepts. **Done** (review PASS 2026-07-23).
3. **break-a-goal-into-pieces** — child goals; viable = deliverable ("done means") + boundary ("stays inside"); parents never proposed. **Done** (review PASS 2026-07-23; the whitelist was not extended — decomposition shipped record-based per ADR 0003).
4. **attach-the-world** — External Resource pointers; freshness standing; the one-spine Goal detail. **Done** (review PASS 2026-07-23).
5. **sessions-read-the-brain** — bounded, corpus-independent orientation; append-only work records. **Done** (review PASS 2026-07-24).
6. **the-proposal-loop** — one viable goal nominated with why-now + runners-up; approve / skip-with-reason; every decision recorded. **Done** (review PASS 2026-07-24).
7. **teach-it-what-matters** — pairwise priority signals, framing-tagged, recorded only. **Done** (review PASS 2026-07-24).
8. **the-brain-survives** — export of owner-authored content + one journaled restore drill against a scratch target. *(Queued — interim protection until the firmware clobber-protection epic lands)*

## ADRs

`decisions/second-brain/` — created per story at Architecture.

## Key facts / guardrails

- **The PRD's §7 Policy Constitution binds every story** — notably: append-only record (corrections are new facts, no edit affordances); sessions propose, never launch; plain language is a contract (style-guide register; jargon in owner-facing output is review-blocking); existing structures are adopted, never re-derived; privacy is an indicator, never a toggle.
- **Owner-facing copy comes verbatim from the style guide** — canonical standing words (`captured / viable / achieved / abandoned`; `current / stale / unreachable`; `open / approved / skipped`), canonical empty states, banned-jargon list. Review-enforceable.
- **The design guide's do-not-design list is binding:** no graph canvas, no gauges/scores, no agent chat, no privacy toggle, nothing visitor-facing, no new tokens.
- **TA pubkey is resolved at runtime, never hardcoded** (house rule; PRD §7.8) — the goal concept handle is `39998:<TA>:tapestry-owner-goal` with `<TA>` from `getOwnerAssistantPubkey()` / `useConfig()`.
- **Referenced, never re-specified (PRD §7.9):** the `relationship-primitives` book (closed 2026-07-22 — add/delete primitives live; `HAS_SUBGOAL` is its documented post-book whitelist-extension path, needs cardinality-safety thought per its ADR 0001) and the future firmware clobber-protection work (until it lands, story 8's export **is** the protection). Stories declare these dependencies and wait; they never re-implement.
- **Second-operator guard (PRD §5.9):** no reference-instance identities or paths baked in; the empty brain offers one obvious first action.
- **Known coverage gaps vs the PRD (record, revisit before book close):** (a) PRD §5.1 owner actions **rename** and **abandon** have no covering queue story — deferred at the story-1 planning gate (operator, 2026-07-22); likely a small later story. (b) The Goals view's **category filter** (design guide) waits until category instances exist — no queue story creates them; the category chip renders whenever a goal has one.

## Related

- `engineering-team/audits/relationship-primitives/` — the enabling book's return edge: `audit.md` (as-built: `POST /api/normalize/add-relationship` / `delete-relationship`, owner-gated, whitelist = class-thread membership types via the firmware alias layer, strfry-free) and `prd-seed.md` (ingest into second-brain Phase-2 scoping).
- The existing `project-for-the-engineering-team` concept — related in v1 (Goal *is realized by* Engineering Project); merge decision is Phase 2.

## Deferred (later phases, not this epic)

Lifecycle/acceptance, review gates, tiers, proposal expiry, launch answer, claim/lease, private write mode, engineering-project merge (Phase 2); autonomous launch, charter, digest, observability via the task-timeline book (Phase 3); brain search index and rounds (Phase 4); self-improvement wiring (Phase 5); local models, semantic recall (Phase 6); trust-graded sharing (Phase 7).
