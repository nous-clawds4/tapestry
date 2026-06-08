# ADR 0028: Resolved Definition — the read-side of the `b` tag

**Status:** Accepted
**Date:** 2026-06-05
**Story:** `engineering-team/stories/community-reference/32-resolved-definition-primitive.md`
**Builds on:** ADR 0027 (the `b` / inherit-from tag — the *write* primitive). This ADR is its read-side companion.
**Amends:** ADR 0027's deferral — 0027 left "multi-parent `b` resolution order" as a deferred "consumer concern" and assumed "the first consumers are single-parent." This ADR **resolves that order** and retires the single-parent assumption. It does not contradict any 0027 decision; it completes one.

## Context

ADR 0027 / BIBLE §25 established the **`b` tag**: the *write* primitive for definitional inheritance — a child event carries `["b", "<parent-a-tag>", "inherit"]` to declare "my definition is the parent's, unless I state otherwise," materializing a `(child)-[:INHERITS_FROM]->(parent)` edge. It deliberately left two loose ends:

1. **Multi-parent resolution order was deferred.** §25 allows multiple `b` tags but says (BIBLE:1676) "resolution order is a consumer concern, deferred," and ADR 0027 assumed "the first consumers are single-parent."
2. **A resolver was forward-referenced but never defined.** §25's live-resolution note points at the Communities Protocol's `effectiveCD` as the read pattern — but nothing defines it. Story #31's review flagged this as its one open (non-blocking) follow-up.

The missing companion is the **read side**: *given a node and its `b` deferences, what does its definition actually resolve to?* That design was settled in this session's scoping (`docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §2) — the **Resolved Definition** primitive. It is **general** (Alice's resolved definition of `dogs` vs Bob's is the same mechanism as a community), so it belongs in BIBLE core next to §25, with the Communities Protocol and any future consumer reading *through* it.

**Constraints / grounding:** the Concept Graph API was unreachable all session — grounded in the BIBLE, exactly as ADR 0027 was (the subject is a protocol primitive whose deliverable is BIBLE prose, not a graph concept). BIBLE currently ends at **§25**, so **§26** is the next slot. **This story's deliverable is documentation only** (BIBLE prose + this ADR); no resolver code. No new lint/build tooling (CLAUDE.md).

## Options considered

### Option A — Closure-merge via override → first-listed → visited-set, resolved live at read time (chosen)

A node's **resolved definition** = the merge of its **closure** — the transitive `b`/`INHERITS_FROM` ancestor-set (a derived query, `MATCH (n)-[:INHERITS_FROM*0..]->(x)`; not stored; **may contain cycles** — it is not a DAG). The merge rule:

1. **The node's own stated fields win** (child overrides ancestors — already established by ADR 0027).
2. **For unstated conflicts among multiple `b` parents, first-listed `b` wins** — depth-first in the order the `b` tags are listed on the event; the first value to land sticks. Author-controlled (you order your `b` tags), deterministic, **no PoV-dependence**.
3. **A visited-set keyed on a-tag bounds cycles** (carried from ADR 0027). The walk always terminates and always yields *an* answer — never "ambiguous → undefined."

Resolution is **live** (computed at read time against ancestors' current state); the `INHERITS_FROM` edge is the only materialized artifact.

**Pros:** deterministic and total (always an answer); precedence is author-controlled and observer-independent (your own definition doesn't change based on who's looking); reuses ADR 0027's override + visited-set wholesale; fills the deferred multi-parent order; closes the §25 `effectiveCD` reference; **general** (any concept).
**Cons:** first-listed-wins is a *heuristic*, not principled conflict arbitration; multi-parent authors must understand that `b`-tag order encodes precedence (rare in practice); live resolution has a per-read walk cost (bounded by a max-depth guard).

### Option B — WoT-weighted field-level resolution (rejected)

For each conflicting field, weight each parent's value by the parent-author's GrapeRank influence from the resolving PoV; take the weighted winner.

**Why rejected:** it makes a node's *own* resolved definition **vary by observer** — "my definition of `dogs`" would change depending on who is looking, which is surprising and violates the intuition that a node authoritatively states its own meaning. It is also materially more complex. First-listed-wins keeps a node's definition observer-independent and cheap. Recorded as a deliberate v1 rejection; revisit only if a concrete consumer needs trust-weighted field arbitration.

### Option C — Snapshot at materialization vs live read-time resolution (decided: live)

Snapshot would freeze a node's resolved definition when its edge is created. **Rejected** because it contradicts §25's live-`b` semantics ("deference tracks future edits — *whatever Alice says*"). Live read-time resolution is the choice; the edge is materialized, the definition is computed on read. (Caching is a consumer/performance concern, out of scope.)

## Decision

Adopt **Option A.** Define **Resolved Definition** as the general read-side of the `b` tag:

```
resolved(node):
  visited = {}
  return merge_walk(node, visited)

merge_walk(node, visited):
  if node.a_tag in visited: return {}        # cycle guard (ADR 0027)
  visited.add(node.a_tag)
  result = {}
  # ancestors first, in the node's b-tag listed order; nearer/earlier wins
  for parent in node.b_tags (in listed order):
    inherited = merge_walk(resolve(parent), visited)
    result = fill_unset(result, inherited)   # first value to land sticks
  result = overlay(result, node.statedFields) # the node's own fields always win
  return result
```

- It is **general** — applies to any concept (a `dogs` concept, a Community Declaration, a Set). The Communities Protocol's `effectiveCD` becomes a **named instance** of Resolved Definition.
- It **fills the multi-parent resolution order ADR 0027 deferred** and retires 0027's single-parent assumption.
- It **defines the general resolver §25 forward-referenced as `effectiveCD`**, closing story #31's open follow-up.
- **first-listed-wins** is the v1 heuristic; **WoT-weighted field resolution is rejected for v1** (Option B).
- **Set-valued override algebra** (add/remove/replace over an inherited element *set*) **remains deferred** per ADR 0027 — Resolved Definition v1 is **field-level** (a stated field replaces the inherited one wholesale).

## Consequences

### Positive
- The read side of `b` is defined once, generally; every consumer (Communities included) reads through one primitive.
- Multi-parent resolution is settled and deterministic; cycles are safe.
- Closes story #31's `effectiveCD` forward-reference — no more dangling BIBLE pointer.
- Zero new mechanism: it's ADR 0027's override + visited-set, plus a listed-order tiebreak.

### Negative / risk
- **First-listed-wins is a heuristic.** Mitigation: a node can always settle any conflict by stating the field itself (its own fields win); and the rule is documented as "good enough for now," revisitable.
- **Live read cost.** A per-read closure walk, bounded by a max-depth guard; caching is a deferred consumer concern.
- **Author awareness for multi-parent.** Ordering `b` tags now carries meaning. Rare today (first consumers are mostly single-parent); documented in §26.

### Neutral
- Additive and read-only; no existing behavior changes. ADR 0027 / §25 stand, with §25's multi-parent note updated to point here.

**Firmware reinstall required?** **No** — the deliverable is documentation (BIBLE prose) only; no concept definitions or schemas change. A future story that *implements* the resolver in code may touch firmware/graph-engine and should re-evaluate then.

## Implementation notes

**Phase 4 is documentation-only — edit `BIBLE.md`, no source.** Three edits:

1. **New `BIBLE.md` §26 "Resolved Definition"** — append after §25 (The Inherit-From Tag); add to the Table of Contents; cross-link §25 and §22. Mirror `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §2: the read-side framing (companion to §25's write primitive); the closure (transitive `b`/`INHERITS_FROM`, derived, may cycle — not a DAG); the resolution rule (own-fields-win → first-listed-`b`-wins → visited-set), with the short pseudocode above; **live** read-time resolution; **general** (any concept); the note that it fills ADR 0027's deferred multi-parent order and defines the general `effectiveX` that §25 called `effectiveCD`; and that **set-valued override remains deferred** (field-level only in v1). Do not duplicate this ADR's rationale verbatim — point here for the "why" (story #20 / #31 precedent).

2. **`BIBLE.md` §25 multi-parent note (BIBLE:1676)** — replace "resolution order is a consumer concern, deferred" with a pointer: resolution order is **defined in §26 (Resolved Definition)**.

3. **`BIBLE.md` §25 `effectiveCD` reference** — §25's live-resolution bullet mentions the Communities `effectiveCD` (grep `effectiveCD` in BIBLE; one hit, in §25). Update it to note `effectiveCD` is a **named instance of §26's Resolved Definition**, so the forward-reference resolves (this is the story #31 review follow-up being closed).

No source files, tests, or firmware are touched by this ADR's story.

## Out of scope (named, deferred)

- **Resolver code** — any actual merge-walk implementation, Neo4j/query work, materialization, caching. A future implementation story.
- **WoT-weighted field-level resolution** — rejected for v1 (Option B); revisit only on concrete need.
- **Set-valued override algebra** (add/remove/replace over an inherited element set) — remains deferred per ADR 0027; Resolved Definition v1 is field-level.
- **The Communities-specific consumer layer** — `effectiveCD`'s community semantics (roster, roles, membership) build *on* this primitive but are separate, and gated on the three-branch reconciliation (handoff §7).
