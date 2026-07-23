# Story 5: Sessions read the brain — bounded orientation and work records

**Status:** Approved
**Created:** 2026-07-23
**Type:** Feature
**Epic:** `second-brain` (#5) · PRD §5.4, §6, §7.1–7.3

## Background
Every agent session today wakes amnesiac — it orients by reading whatever it can find, written for machines rather than people, and whatever it does evaporates when its context window closes. Ending that is the whole point of the brain (PRD §1). Stories 1–4 gave the brain goals, class-discipline it can trust, decomposition into session-sized pieces, and external-resource pointers — and story 4 built the goal's **record section** on the one-spine detail page, then deliberately left it **empty**, waiting for a producer.

**Story 5 is that first producer**, and it closes both halves of the session loop:

- **Read (orient):** a fresh session begins from the brain within a **bounded, corpus-independent budget** — it can say which goals exist and which single goal it is serving *without reading every goal*, at a cost that does **not** grow as the brain fills up. This flat-cost tolerance is the machine persona's load-bearing "won't tolerate" (PRD §5.4); it is what makes many small sessions affordable (owner journey 4).
- **Write-back (record):** when the session is done, it leaves an **append-only work record** on the goal it served — the session, a one-sentence standing summary, any resources it produced (as pointer cards), and at most two plain-English questions. That record lives **in the brain, attached to the goal** (PRD §7.1), so the owner's morning review reads one truthful ledger per goal (owner journey 4) and six-weeks-later retrieval finds what a session did (owner journey 5).

And one policy guarantee rides along: a **goal idea that arises inside a session is captured, never launched** (PRD §7.3) — sessions propose, the owner disposes.

Affected: **The Fresh-Context Session** (orients in seconds, leaves the graph richer) and **The Delegating Owner** (the record is exactly what the morning review reads and what retrieval-in-anger finds — the traceability guard is satisfied by owner journey steps 4–5).

## User-facing description
As the owner, I want every agent session to orient from my brain quickly no matter how many goals it holds, and to leave behind a dated, honest record of what it did on the one goal it served, so that sessions start cheap, nothing a session did is lost or rewritten, and my morning review reads one truthful ledger per goal instead of my reconstructing what happened.

## Acceptance criteria
Testable from the outside (input → observable behavior). Canonical owner-facing strings are **verbatim** from the style/design guides. Consistent with the epic's settled pattern (stories 1/3/4): brain **writes** are conversation / owner-gated, validated, local-only primitives, and the Goal detail is the **display** surface — this story adds **no new "add record" UI form**.

- [ ] **AC1 — Bounded, corpus-independent orientation.** Given a brain holding any number of goals, when a fresh session orients, then — from a **bounded** read whose cost does **not** grow with the number of goals — it can state which goals exist and identify the single goal it is serving, and it receives that goal's intent (its deliverable and boundary) **verbatim** as captured. It does **not** read every goal to orient. *(Testable: the orientation's read cost / response size stays flat — not proportional — as the goal count grows from a handful to many; the served goal's `Done means:` / `Stays inside:` come back byte-for-byte.)* This corpus-independent budget is the machine persona's load-bearing tolerance (PRD §5.4).
- [ ] **AC2 — The session names its goal; the record lives in the brain.** Given a session that performed work, when it reports back, then its output **names the single goal it served**, and the record of that work is written **into the brain, attached to that goal** — never into a session- or scheduler-side log (PRD §7.1: "the brain decides; the metabolism asks and reports"; a scheduler-side decision log is a defect). A work record that names no goal it served cannot be written.
- [ ] **AC3 — A work record appears on the goal's spine.** Given a session that worked on a goal, when the owner opens that goal's detail, then the goal's **record section** (the append-only list story 4 built) shows a **work record** entry carrying: the **session** that produced it, a **one-sentence standing summary**, any **resources the session produced** shown as **pointer cards** (the story-4 pointer card), and **at most two** plain-English questions — each answerable in a sentence, each stating what its answer unblocks (style guide: "questions earn their interruption"). The entry carries the canonical record type word **`worked`**, a date, and **no edit or delete affordance** (PRD §7.2; story-4 AC6 contract, now exercised with a live entry).
- [ ] **AC4 — Work records are dated, attributed, and append-only.** Given a work record, when it is written, then it carries its **date** and the **session** that produced it (attribution), and it is **append-only**: never edited, never deleted. A correction, or a second session working the same goal, is a **new** entry — every prior entry is unchanged (PRD §7.2: "corrections are new facts"). *(Testable: writing a second record on a goal adds an entry and mutates none; no write path exists that edits or removes a prior entry.)*
- [ ] **AC5 — A session-born goal idea is captured and attributed, never launched.** Given a **new goal idea that arises inside a session**, when the session records it, then it enters the brain as a **capture attributed to that session** (dated; origin = the session) and **nothing is launched** — no work begins and no session is spawned from it; the owner remains the only launcher in v1 (PRD §7.3: "sessions propose, never launch"). *(Testable: recording a session-born idea produces a dated, session-attributed capture — surfaced as a `noted` record — and triggers no execution or launch side effect.)* The **proposal-queue** treatment of such ideas (approve / skip-with-reason) is **story 6**; story 5 guarantees only the capture-and-never-launch invariant.
- [ ] **AC6 — Writes gated & local-only; the read module stays read-only.** Given the work-record write path, then it follows the settled story-1/3/4 write pattern — **gated** (owner / loopback), **validated** before any write, and **local-only** (no outbound sync of brain data; PRD §7.4) — with **no new UI form**. The brain **read** module stays read-only; record **writes** live on the write path, exactly as goal and resource writes do.
- [ ] **AC7 — Copy discipline, the no-edit contract, and no regression.** Every owner-facing string this story adds (the standing-summary chrome, question phrasing, the `worked` / `noted` labels, any session-attribution wording) passes the banned-jargon scan (*element, kind, schema, event, pubkey, superset, concept header, persona, acceptance criteria, lease, payload, endpoint*) and comes **verbatim** from the guides; the record section's **no-edit-affordance** contract holds now that entries are live; and the brain surfaces stories 1–4 shipped continue to pass their suites, amended only where this story legitimately extends them. **Because this story lands in `ui/src/pages/brain/GoalDetail.jsx`, it also dispositions the open findings in that file — OPEN.md row 86(b) (the href-less, non-focusable Retry) and row 87 (a) the freshness-line fallback wording, (b) the `Resources` / `Record` section headings vs. wireframe §2, (c) the raw-locator `href` for non-web kinds — each either fixed or explicitly ratified in the review.**

## Concepts touched
- `39998:<TA>:tapestry-owner-goal` — **Goal** (existing; `<TA>` resolved at runtime, never hardcoded). A session serves exactly one goal; a work record attaches to it; a session-born idea is captured as a new goal here.
- `39998:<TA>:tapestry-external-resource` — **External Resource** (existing, from story 4). Resources a session **produced** are pointers on this concept, rendered as the story-4 pointer card inside the work record.
- **Work Record** — **new concept**, **append-only**, runtime-created on the graph's established pointer-element pattern (PRD §6), **never firmware-seeded**. Plain-language fields: the session, the goal it served, resources produced, a one-sentence standing summary, up to two questions, a happened-on date. *(Confirmed absent from the live graph — 0 work-record concepts among the 51 present. The Architect resolves the handle and the self-bootstrap sequence, mirroring story 4's External Resource provisioning precedent.)*
- Relationships **Work Record → serves → Goal** and **Work Record → produced → External Resource** — **record-based** (durable facts held in the record and rendered from records; **no** relationship-whitelist edge), following the story-3/4 precedent. This story does **not** extend the relationship-primitive whitelist.

## Out of scope
- **The metabolism / scheduler itself.** The heartbeat that asks "what next?", executes, and reports is **not** built here — the scheduler write-back contract, claim/lease, and the brain-side "launch answer" are **Phase 2** (PRD §8.3). Story 5 gives sessions the brain-side **read** (orient) and **write** (record) surfaces; what *drives* sessions comes later.
- **The morning-review digest.** The work record is its raw material, but the digest is **Phase 3** (PRD §8.3; queue note: "do not build the digest now"). No digest, roll-up, or cross-goal summary view.
- **The brain keyword index / staged search rounds.** Bounded orientation here is corpus-independent **by budget**, not by a search index; that index is **Phase 4** (PRD §8.3).
- **The proposal loop.** Approve / skip-with-reason and the Proposal queue view are **story 6**. Story 5 emits only the `worked` and `noted` record types; `proposed / approved / skipped` belong to story 6.
- **Priority signals** — story 7.
- **A new session-auth surface.** Session identity is recorded as an attributed fact, not a new authentication mechanism; how a session names itself is the Architect's call, **without inventing an auth surface**.
- **Editing / deleting / retracting a record** — append-only; corrections are new facts (PRD §7.2).
- **Autonomous launch** — nothing here launches work; the launcher is the owner (v1) / a governed launcher (Phase 3+).

## Open questions
Resolved from the queue + PRD + handoff:
- Record types this story produces live: **`worked`** (a session's work record) and **`noted`** (a session-born goal idea). `proposed / approved / skipped` are story 6's.
- Writes are conversation / owner-gated, validated, local-only, with no new UI form (the story-1/3/4 pattern).
- Stories 1 and 4 (goals and pointers) have shipped — the dependency is satisfied.

Deferred to the Architect (mechanism / value, not intent):
1. **Session identity & attribution.** How a session names itself in the record's "session" field without inventing an auth surface (likely a caller-supplied session identifier recorded as a dated fact). The **intent** — records are dated and attributed to a session — is fixed; the mechanism is the Architect's.
2. **The bounded-orientation surface.** What a session reads to orient at corpus-independent cost (a summary read, a bounded page plus the served goal in full, etc.). The **intent** — flat cost as the corpus grows, plus the served goal's deliverable/boundary verbatim — is fixed, and the Tester must be able to demonstrate the flatness; the shape is the Architect's.
3. **AC5 capture shape (confirm at gate).** Whether a session-born idea reuses the story-1 goal-capture path with session attribution (a real captured goal now, surfaced as `noted`), or records a `noted`-only marker and defers goal creation to story 6's proposal intake. Default carried in AC5: capture it as a dated, session-attributed goal now, launching nothing.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
