# Story 1: Ratify the self ontology into the spec

**Status:** Done
**Created:** 2026-07-25
**Type:** Doc
**Epic:** `self-ontology`
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3 — Test Design skipped)

## Background

Tapestry's codebase currently embodies **two contradictory models of what the system is**, and the
contradiction is load-bearing rather than cosmetic:

- **Protocol-first** — the always-loaded architecture invariants in `CLAUDE.md` present signed nostr
  events as the substrate and neo4j as a per-POV computed *view*. Import, normalization, firmware
  reinstall, and reconciliation are all built on the premise that the graph is freely re-derivable.
- **Brain-first** — second-brain, graph-curation, and especially relationship-primitives (literally
  "strfry-free relationship add/delete") write neo4j state that has **no event behind it**.

Under the protocol-first premise, a rebuild may legitimately discard anything not reconstructible
from events — which now includes authoritative, locally-authored state. That is a live data-loss
risk, and more fundamentally it means the project has no settled answer to "which store is the
system of record for the user's own knowledge?"

The owner settled it on 2026-07-24: **Tapestry is first and foremost a local-first personal
knowledge graph. neo4j is the definitive "me."** The decision, its rationale, and its consequences
were captured in `docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md` (Status 🔴 OPEN). That doc is a working
artifact and is not where future contributors look; today the decision exists nowhere in the
canonical spec, and the always-loaded invariants still say the opposite emphasis. A session that
reads only `CLAUDE.md` would reasonably "correct" brain-first work back toward protocol-first.

This story ratifies the **settled** portions into the canonical spec so the decision is durable and
discoverable, and closes the contradiction in the most-read file. Everything still genuinely open
(provenance representation, backup mechanics, the covering conjecture) stays open.

**Who is affected:** every future contributor and agent session that touches storage, rebuild,
reconciliation, or backup — and the owner, whose locally-authored knowledge is the state at risk.

## User-facing description

As **the owner of a Tapestry instance**, I want the project's canonical spec to state plainly that
**my neo4j graph is the definitive record of me** — with the LMDB cache and nostr events in clearly
subordinate, well-defined roles — so that **nobody (human or agent) designs or runs a process that
destroys my knowledge on the assumption it can just be rebuilt from events.**

## Acceptance criteria

Testable from the outside (doc-level inspection).

- [ ] BIBLE gains a new top-level section (**"The Self and Its Stores"**, §30) stating the ontology:
      **neo4j = the definitive "me"** (complete, mortal, restorable in full from a neo4j backup);
      **tapestry LMDB = "me" but a subordinate cache**, derivable from neo4j, never a co-equal seat
      of self; **signed nostr events = "letters"** — authored by me or received from peers, the
      proof/communication/durability axis, **not** the identity substrate.
- [ ] The section states the **derivability ≠ identity** principle explicitly — that events sitting
      at the bottom of the *derivation* stack does not make them the seat of self, and that a
      Tapestry instance may in principle operate without ever signing a single event (an unpublished
      neo4j write is a private thought; publishing is writing and mailing a letter).
- [ ] The section defines the **asserted core** — "me minus everything recomputable" — and names the
      recomputable inventory as non-exhaustive: derived/implicit relationships, WoT scores, JSON
      Schema documents recomputable from a full property tree, and all tapestry-LMDB derived JSON.
- [ ] The section states the **provenance taxonomy** as a requirement — every node/edge is exactly
      one of *asserted / locally-authored* (precious), *event-projection* (disposable), or
      *peer-received* (trust-weighted) — and explicitly marks its **representation, migration, and
      writer discipline as NOT YET DESIGNED** (deferred to a later story).
- [ ] The section states the **non-destructive rebuild invariant**: no pipeline — import,
      normalization, firmware reinstall, reconciliation, or dev tooling — may destroy
      locally-authored state; plus the interim rule that state a rebuild cannot reproduce is treated
      as precious by default until provenance exists.
- [ ] The section states the **LMDB dual role**: primary/ongoing = compact low-latency cache (lossy
      and partial *by right*); secondary/intermittent = full lossless serialization for backup; and
      that the two modes must be distinguishable so a cache entry is never mistaken for backup-grade
      data. It cross-references §29 (the existing derived-JSON store section).
- [ ] The section defines **coverage** (a document set covers the graph iff every node and edge is
      losslessly represented and the set reassembles the graph exactly) and states that **coverage is
      distinct from normalization** — normalization guarantees internal consistency, not deriver
      completeness — recording the "normalization ⇒ covering" conjecture as *plausible and deferred,
      not assumed*, and noting today's derivers cover only concept-graph labels, not the
      NostrUser/social graph.
- [ ] The section **reconciles with the protocol-first invariants** rather than repealing them: the
      decentralized-first / POV-first / filter-at-view-time rules still govern the event and social
      axis unchanged (accept all signed events, no write-time gating of peers, trust filtering at
      read time per POV); a trusted peer's event still updates the brain without replacing it as the
      seat of self; and on a multi-tenant instance "me" = the **owner-POV slice**.
- [ ] `CLAUDE.md`'s always-loaded architecture-invariants section carries a short **identity-axis
      note plus a pointer to the new BIBLE section**, so a session reading only `CLAUDE.md` learns
      that neo4j is the definitive self — and `CLAUDE.md` **remains at or under its 190-line budget**
      (`scripts/harness-budgets.txt`), paid for by condensing existing lines, with **no cap change**.
- [ ] The BIBLE Table of Contents links to the new section and the anchor resolves.
- [ ] An ADR under `decisions/self-ontology/` records the ratification decision, the rejected
      alternative (remaining protocol-first / treating neo4j as a disposable view), and precisely
      what was deliberately left open.
- [ ] `docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md` **stays 🔴 OPEN** (its content only partly ratifies
      here) but is annotated to mark which sections are now ratified and where they landed, leaving
      the remaining open questions clearly identified as the epic's deferred work.
- [ ] `npm test` stays green and `bash scripts/harness-lint.sh` is clean (no regression from the
      docs change).

## Concepts touched

The local stack was unreachable when this story was written (the session-start probe found it up at
`:7778`, but it stopped answering later), so concepts are named in plain language per AGENTS.md §2's
stack-absent branch. **The Architect should resolve handles if any are needed.**

This story is expected to touch **no concept-graph domain concepts** — its subject is storage and
identity architecture (neo4j, the tapestry LMDB, strfry/nostr events), not concepts *in* the graph.
Named in plain language: the derived-JSON store (BIBLE §29), the concept-graph data model (§6), the
normalization rules (§10), and PoV resolution (§27, for the multi-tenant owner-POV point).

## Out of scope

Deliberately deferred — these stay **open** in the handoff doc and become later stories:

- **Provenance representation and migration** (handoff §4) — property vs. label vs. ledger, how the
  existing graph gets classified, and per-write-path writer discipline. This story ratifies the
  three-class *taxonomy* as a requirement only.
- **Backup mechanics** (§7) — encryption scheme, **key custody**, chunking against relay event-size
  limits, manifest/reassembly design, relay choice, retention/rotation. The *chosen pipeline shape*
  (lossless serialization → encrypted chunked events → mirror relay) is ratified; none of its
  mechanics are.
- **The normalization ⇒ covering conjecture** (§8) — recorded as plausible and explicitly deferred,
  not proven or assumed.
- **Serialization-mode marking and run manifests** (§6) — the *requirement* that modes be
  distinguishable is ratified; the design is not.
- **All code changes.** No source, config, pipeline, or workflow changes in this story. Hardening the
  rebuild surfaces to actually honor the invariant is story 3.
- **Health monitoring** (§10 item 5) — a later story in this epic.

## Open questions

None blocking. Resolved during planning:

- *Does this story amend `CLAUDE.md`?* **Yes** — owner decision (2026-07-25): add a short identity-axis
  note + pointer, and pay for it by condensing existing lines so the 190-line cap holds. Raising the
  cap was explicitly rejected.
- *Does the handoff doc flip to SUPERSEDED?* **No** — only part of its content ratifies here; it stays
  🔴 OPEN, annotated with what landed.

For the Architect: the one judgment call is **how much of §3/§8's nuance belongs in the BIBLE section
versus staying in the handoff** — the section should be normative and durable, not a transcript of the
reasoning that produced it.

## Linked artifacts
- ADR: `engineering-team/decisions/self-ontology/0001-ratify-the-self-ontology.md`
- Test plan: **skipped — docs-mode** (no executable behavior; the Reviewer performs an accuracy and
  cross-reference audit instead, and runs `npm test` to confirm no regression)
- Review: `engineering-team/reviews/self-ontology/1-ratify-the-self-ontology.md` — first pass **CHANGES_REQUESTED** (harness-lint L10: missing CHANGELOG row), re-review after fix `1867ea53` → **PASS** (2026-07-25)
