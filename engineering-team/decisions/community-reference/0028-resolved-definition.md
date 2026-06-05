# ADR 0028: Resolved Definition — the read-side resolution of the `b` tag (§26)

**Status:** Proposed
**Date:** 2026-06-05
**Story:** `engineering-team/stories/community-reference/32-resolved-definition-read-primitive.md`
**Builds on:** ADR 0027 (the `b` inherit-from write tag + the `INHERITS_FROM` edge + the live `effective(node)` formula — this ADR is its read-side bookend and resolves the multi-parent ordering it deferred), ADR 0011 (bounded-walk guards `n`/`s`), ADR 0010 (depth/fetch guards), ADR 0006 (community-reference theory; the registry-as-DList selection this ADR keeps *separate* from field-merge).
**Supersedes:** nothing. Promotes the resolution contract currently sketched inside the §25 write-tag section (per ADR 0027 impl note #1) into a canonical standalone §26, and condenses §25 to a pointer — a de-duplication, not a contradiction.

## Context

ADR 0027 / BIBLE §25 established the **`b` tag** (write primitive): *"my definition is this parent's, unless I state otherwise,"* materialized as `(child)-[:INHERITS_FROM]->(parent)`, resolved **live** by `effective(node) = merge(effective(parent_via_b), node.statedFields)`. `b` answers *"who do I defer to."* It does **not**, as a first-class named thing, answer *"what do I actually mean after following my deferences."*

Story #32 elevates that read-side answer — the **Resolved Definition** — to its own primitive. Per `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §2, this is **general concept-graph machinery, not community machinery**: Alice has a resolved definition of "dog" that may differ from Bob's, by the same mechanism a Community Declaration resolves. The Communities Protocol is a *consumer* (membership is later evaluated *against* the resolved definition), not the owner.

ADR 0027 left three things to "the first consumer that needs it" that the read primitive must now pin:

1. **Multi-parent resolution order** — which parent wins when a child carries multiple `b` tags (ADR 0027: *"deferred; the first consumers are single-parent"*).
2. **Concrete walk guards** — the `maxDepth` value and cycle-guard behavior (ADR 0027 reused 0010/0011's guards by reference).
3. **Set-valued override algebra** — add/remove/replace for inherited element sets (ADR 0027 deferred; field-level replace is v1).

And one boundary the story makes load-bearing:

4. **Substrate-only.** §26 must define *only* the closure-resolution of `b`-deferences over definitional fields. It must **not** define, imply, or pre-commit the community **membership** model — no rosters, no `nostr-user-tag`, no GrapeRank weighting, no `INFLUENCE_CUTOFF`, no roles. Membership is a separate, community-specific, branch-blocked layer that *consumes* the resolved definition.

**Grounding:** BIBLE §6 (relationship tables), §21 (glossary), §22 (community-reference; `grapevine-resolved → firmware → none`), §23 (`n`/`s` walk + guards), §25 (the `b` tag, ADR 0027). The Concept Graph API is reachable this session (`http://localhost:8080/api/concept-graph/summaries`, 36 concepts installed) and confirms `INHERITS_FROM` introduces no new edge here — §26 reads the edge ADR 0027 already defined. This ADR's deliverable is **documentation only** (BIBLE prose); no source, tests, or firmware.

## Options considered

### Option A — A canonical §26 "Resolved Definition" read primitive; first-listed-wins; WoT-weighting rejected for v1 (chosen)

Promote the read-side into its own BIBLE §26, parallel to §25. §26 names **Resolved Definition** as the general read companion to `b`, states the resolution rule with an explicit precedence for multi-parent, pins the guards, holds the substrate boundary, and carries the normative pseudocode. §25 keeps the `b` *write*-tag definition and cross-links to §26 (its resolution sketch is condensed to a pointer — dedupe). Multi-parent conflicts resolve **first-listed-`b`-wins**. Per-field merge is **deterministic** (never observer-dependent); WoT weighting is confined to the *separate* §22 question of *which* definition to defer to, not to field-merge within a chosen chain.

**Pros:**
- Right altitude: the handoff frames Resolved Definition as a primitive Communities *consumes*; a named §26 makes "membership is evaluated against the resolved definition" a clean cross-reference instead of a buried sub-clause.
- Deterministic field-merge: a curator's own resolved definition does not vary by observer — predictable, debuggable, cacheable.
- Closes ADR 0027's deferred multi-parent order with the simplest rule that works (first-listed-wins), matching the handoff's stated v1 heuristic.
- Keeps the WoT machinery exactly where it belongs (§22 definition-*selection*), preserving the load-bearing separation the protocol depends on.

**Cons:**
- First-listed-wins is a heuristic; a future consumer may want richer multi-parent precedence. Mitigated: single-parent is the common case; the rule is documented and forward-revisable.
- Requires a §25 edit to avoid two homes for the resolution contract.

### Option B — Leave resolution inside §25; only amend it for multi-parent order (rejected)

No new section; extend §25's existing resolution subsection.

**Why rejected:** the read-side is a general primitive consumed beyond the `b`-tag framing (the handoff treats "Resolved Definition" as a first-class concept). Burying it in the write-tag section under-signals it and makes the Communities membership reference ("evaluated against the resolved definition") point into a sub-clause of a tag definition. The handoff §6 explicitly calls to *"promote Resolved Definition + the resolution rule to a general primitive (BIBLE near §25 + an ADR), with Communities as the thin application on top."*

### Option C — WoT-weighted field resolution in v1 (rejected)

Resolve conflicting fields across multiple `b` parents by weighting each parent by the author's GrapeRank from the observer's PoV.

**Why rejected (the handoff's named rejection):** it makes a curator's *own* definition vary by observer — surprising and hard to reason about — and conflates two distinct operations: *selecting* which definition the network loosely agrees on (a per-PoV, WoT-weighted, §22 registry concern, still a candidate/future) versus *merging* fields along a chain the curator has already chosen by listing `b` tags (deterministic). v1 keeps field-merge deterministic; WoT stays in §22.

## Decision

Adopt **Option A.**

### §26 "Resolved Definition" — the read primitive

- **What it is:** the read-side companion to the `b` tag (§25). The *resolved definition* of a node is its effective field set after following its `INHERITS_FROM` (`b`) closure and applying overrides. General to **any addressable DList object** — concept↔concept, set↔set, Community Declaration↔Declaration — **not** community-scoped.
- **Resolution rule (normative):**
  ```
  resolved(node):
    visited.add(node.aTag)
    base = {}
    for parent_aTag in node.bParents_in_listed_order REVERSED:   # later-listed first…
      if parent_aTag in visited: continue                        # cycle-guard: skip back-edge
      if depth >= MAX_DEPTH: break                               # depth-guard
      base = merge(base, resolved(parent))                       # …so earlier-listed overwrite later
    return merge(base, node.statedFields)                        # child's own fields win over all parents
  ```
  Equivalent precedence, highest to lowest: **node's own stated fields → first-listed `b` parent → later-listed `b` parents → root.** A field the node states explicitly wins; a field it omits is inherited; an unedited node performs pure inheritance.
- **Multi-parent = first-listed-wins** (closes ADR 0027's deferral). Resolution order is the `b` tags' on-wire order; earlier tags take precedence on field conflicts.
- **Merge granularity = whole-field replace (scalar/field-level).** The **set-valued override algebra** (add/remove/replace of individual elements of an inherited set) remains **deferred to the first consumer that needs it** (ADR 0027 §Decision reaffirmed); v1 consumers (CD scalar overrides) don't need it.
- **Liveness = live, read-time.** Each resolution reads ancestors' *current* state; nothing is snapshotted into the node. The `INHERITS_FROM` edge is the only materialized artifact. Caching is a consumer/perf concern, explicitly **not** a protocol decision.
- **Termination/guards:** `MAX_DEPTH = 16` (consistent with ADR 0010/0011); **cycle-guard = visited-set keyed on a-tag**, behavior = **truncate-and-continue** (a revisited ancestor is treated as a leaf for that branch; resolution degrades gracefully and never throws — appropriate for a read path). Depth-exceeded likewise truncates.
- **Determinism boundary (load-bearing):** field-merge along a chosen `b`-chain is **deterministic and observer-independent**. WoT-weighting applies only to the *separate* §22 question of *which* parent definition the network loosely prefers (registry-as-DList, `grapevine-resolved`) — a candidate/future mechanism, not part of §26's merge.
- **Substrate-only (the guardrail):** §26 names the Communities Protocol solely as a forward-referenced consumer ("membership is later evaluated against the resolved definition"). The membership model — `nostr-user-tag`, GrapeRank roster weighting, `INFLUENCE_CUTOFF`, roles — is named **out of scope, separate, and downstream**. §26 introduces nothing membership-specific.

### Answers to the story's forwarded questions

1. **Set-valued override algebra** → **deferred** (unchanged from ADR 0027); whole-field replace is v1. Named, not silently assumed.
2. **`MAX_DEPTH`** → **16** (matches ADR 0010/0011).
3. **Cycle-guard behavior** → **truncate-and-continue** (visited-set on a-tag; revisit ⇒ treat as leaf; never error). Read-path resolution must degrade gracefully.
4. **Snapshot vs live** → **live** (read-time; edge is the only materialized artifact) — reaffirms ADR 0027.
5. **Pseudocode placement** → **normative in §26** (one authoritative spec for implementers), referenced from this ADR. Not duplicated in §25.

### No new edge, tag, concept, or firmware

§26 reads the existing `INHERITS_FROM` edge and `b` tag from ADR 0027. The §6 relationship table needs **no new row** (no new edge). No concept definition or schema changes → **no firmware reinstall** for this story.

## Consequences

### Positive
- One canonical, named read primitive that Communities (and any curator) resolves against; the membership layer references it by name.
- Deterministic, observer-independent field-merge — predictable and cacheable; preserves the WoT-selection / field-merge separation the protocol's safety rests on.
- Closes ADR 0027's deferred multi-parent ordering with the minimal rule, and pins the previously by-reference guards to concrete values.

### Negative / risk
- **First-listed-wins is a heuristic.** A future multi-parent consumer may need richer precedence. Mitigation: single-parent dominates real usage; the rule is documented and forward-revisable without breaking single-parent resolutions.
- **Live resolution couples a child to ancestors' future edits** (inherited from ADR 0027) — already called out in §25; §26 reiterates via cross-link, no new exposure.
- **Two sections touch resolution** unless §25 is condensed. Mitigation: the §25 edit (pointer to §26) is part of this story's implementation notes.

### Neutral
- Additive documentation; parsers that don't resolve `b` are unaffected. No `n`/`s`/`b` behavior change; ADRs 0011/0027 stand unmodified.

**Firmware reinstall required?** **No** — documentation only.

## Implementation notes

**Phase 4 is documentation-only — edit `BIBLE.md`, no source.** Sketches illustrative; Implementer writes final prose/placement. Edits:

1. **New `BIBLE.md` §26 — "Resolved Definition"** (append after §25; add to Table of Contents). Contents: the read-side framing (general, not community-scoped); the normative resolution rule + pseudocode (above); first-listed-wins precedence; whole-field-replace granularity with set-valued deferred; liveness + caching-is-consumer-concern; guards (`MAX_DEPTH = 16`, cycle truncate-and-continue); the determinism boundary vs §22 WoT-selection; the Communities-as-consumer forward reference **with membership explicitly out of scope**; cross-links to §22, §23, §25.
2. **`BIBLE.md` §25 amendment** — condense the resolution subsection to a one-line pointer to §26 (the `b` write-tag definition stays; the read contract lives in §26). Prevents two homes for the rule.
3. **`BIBLE.md` §21 glossary** — add a **"Resolved Definition"** entry (read-side effective field set after the `INHERITS_FROM`/`b` closure + overrides; deterministic, live; distinct from §22's WoT definition-*selection*).
4. **`BIBLE.md` Table of Contents** — add §26.
5. **`BIBLE.md` §6 / §22** — **no new §6 row** (no new edge). Optional one-line §22 cross-link noting the resolved definition is what the (future, candidate) registry-as-DList selection would feed. Keep "candidate," per ADR 0027.

No source files, tests, or firmware are touched by this ADR's story. (A future *implementation* story that builds the resolver/merge-walk and any caching will touch graph-engine code and re-evaluate firmware then.)

## Out of scope (named, deferred)

- **All code:** the effective-definition resolver/merge-walk, caching, any API surface. Future implementation stories.
- **The entire membership model:** `nostr-user-tag` consumption, GrapeRank roster weighting, `INFLUENCE_CUTOFF`, roles. Separate community-specific layer, blocked on the `feat/pubkey-tagging-target` reconciliation (see `docs/ADR_REFOLDER_RECONCILIATION_PROPOSAL.md`). §26 must not pre-commit it.
- **Set-valued override algebra** (add/remove/replace for inherited element sets) — deferred to the first consumer that needs it.
- **WoT-weighted field resolution** — rejected for v1 (Option C); revisit only if a concrete need appears.
- **Ratifying registry-as-DList / grapevine definition-selection** — a separate ADR in the ADR 0006 line; §26 only preserves the boundary.
- **Uppercase `B`** (parent-claims-child inverse) — reserved by ADR 0027, not designed here.
- **The Communities Protocol itself** and its membership/identity sections — depend on this + the branch reconciliation.
