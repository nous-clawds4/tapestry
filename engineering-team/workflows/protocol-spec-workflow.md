# Protocol-Spec Workflow (docs-mode)

**Status:** v1 — minimal codification. Graduate to a full `protocol-team/` harness only if it earns it (see "Graduating").

A lightweight flow for evolving the **protocol / spec** — `BIBLE.md` and its ADRs — through **discussion → decision → documentation**. An alternative to the (code-oriented) Engineering Team workflow, for big-picture protocol changes where the design isn't yet settled and the deliverable is BIBLE prose + ADRs, not code.

## When to use this (vs the other flows)

| Flow | For | Deliverable |
|---|---|---|
| **Product Team** (`product-team/`) | figuring out *what* to build | product docs, story queue |
| **Engineering Team** (`engineering-team/`) | building *code* for a defined story | source + tests |
| **Protocol-Spec** (this) | evolving *how the protocol works* | BIBLE sections + ADRs |

Reach for this when a protocol/architecture idea (a new tag, relationship, resolution rule…) needs thinking-through and then writing into the BIBLE, the design isn't settled, and there's no executable behavior to test yet. If the design is already settled and you just need code, use the Engineering Team flow directly.

## The three phases

### 1. Scope — settle the design (`/discuss`, advisory)
Use `/discuss` (Product Expert lens — knows nostr / WoT / the concept graph). Think out loud, surface trade-offs, settle open questions one at a time. **No artifacts.** Iterate until a piece is settled enough to capture. Be opinionated; kick back when a question is genuinely the user's.

### 2. Capture — a living design doc (don't lose the thinking)
As decisions settle, write them into a **living design/handoff doc** — `docs/<TOPIC>_DESIGN_HANDOFF.md`, **Status: 🔴 OPEN** — recording *settled decisions* **and** *open questions* + where you paused. Update it as you go; **merge it to `staging`** so the session-start `*HANDOFF*` scan finds it next time. This is the safety net: capture-as-you-go so nothing lives only in the transcript. Flip it to ✅ SUPERSEDED once its content lands in the BIBLE.

### 3. Ratify — settled piece → BIBLE + ADR (Engineering Team flow, docs-mode)
When a piece is settled, run it through the Engineering Team flow **in docs-mode**:

`/plan-feature` (thin story) → `/design-architecture` (ADR) → **skip Test Design** → `/implement-feature` (write the BIBLE section) → `/review-changes` (accuracy/consistency audit) → `cycle-staging`.

**Docs-mode rules** (how the eng-team roles adapt):
- **Test Design: skipped** — no executable behavior; flag it in the story's open questions.
- **Implementer writes BIBLE prose**, not code. "Smallest change consistent with the ADR" = exactly the spec edits the ADR specifies. Mirror the working-doc spec; don't duplicate ADR rationale (point to the ADR).
- **Reviewer audits accuracy + consistency**, not coverage: are the claims true? do cross-references resolve (TOC anchors, §-links)? internally consistent + ADR-conformant? — *and* run `npm test` to confirm the docs change caused **no regression**.
- **Quality gate:** BIBLE/docs only; `npm test` stays green; no new tooling.

Artifacts land in the normal homes: ADRs in `engineering-team/decisions/<epic>/`, the canonical spec in `BIBLE.md`, the review in `engineering-team/reviews/<epic>/`.

## Why this isn't just "the eng-team flow"
Two reasons it's worth naming: (1) the **docs-mode adaptations** are easy to get wrong if you treat a protocol change like a code change; (2) the **Scope + Capture front-end** (`/discuss` + a living handoff doc) is the part the eng-team flow lacks — and it's where protocol design actually happens.

## Worked example — how the Communities Protocol was scoped (2026-06)
- **Scope:** `/discuss` settled the no-privileged-center tenet, Resolved Definition, identity (= concept identity), and membership (= consume the pubkey-tag).
- **Capture:** `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` (OPEN) accumulated those + the open three-branch reconciliation.
- **Ratify:** two settled pieces went through docs-mode eng-team — the `b` tag (`community-reference` #31 / ADR 0027 / §25) and Resolved Definition (#32 / ADR 0028 / §26), Test Design skipped both, Reviewer doing accuracy audits.

## Graduating to a full harness (option B) — only if it earns it
If protocol work gets frequent enough that reusing eng-team-in-docs-mode feels strained — or you want dedicated roles and slash commands — build a `protocol-team/` parallel to `product-team/` (roles like Protocol Scout / Spec Author / Spec Reviewer, workflows, templates, `.claude/` commands + agents). Until then, this charter + reuse is enough. **Don't build the harness before the pattern demands it.**
