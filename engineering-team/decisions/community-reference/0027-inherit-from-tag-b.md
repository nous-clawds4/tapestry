# ADR 0027: The inherit-from tag (`b`) — a general definitional-inheritance primitive

**Status:** Accepted
**Date:** 2026-06-05
**Story:** `engineering-team/stories/community-reference/31-b-tag-general-inherit-primitive.md`
**Builds on:** ADR 0011 (class-thread single-char tags `n`/`s`; this ADR realizes that ADR's Reserved-Future "editorial relationships" candidate), ADR 0006 (community-reference theory; this ADR advances its deferred "registry-as-DList" Flaw-A exit as a *candidate*, not a ratification), ADR 0008 (community Superset anchor).
**Supersedes:** nothing. It amends the *scope wording* of BIBLE §23 (single-char tags are no longer "class-thread only") but does not contradict ADR 0011's decision — ADR 0011 explicitly invited this follow-up.

## Context

We are drafting the Tapestry Communities Protocol. Its mechanism for a participant Community Declaration (CD) to defer to a parent CD — provisionally the `affiliation` tag — is being recast as a single-character tag following the `n`/`s` convention in BIBLE §23 (single-char ⇒ relay-indexed by NIP-01; child-claims-parent; value = parent a-tag). Story #31 establishes that the underlying relationship — *"accept the parent's definition unless this event states otherwise"* — is **not community-specific**. It is general to any addressable DList object: concept↔concept, set↔set, Declaration↔Declaration.

Worked example (from the story): Alice publishes a `dogs` concept (`39998:<alice>:dogs`). Bob mints his own `dogs` concept carrying `["b", "39998:<alice>:dogs", "inherit"]`, meaning *"my notion of dogs is whatever Alice says, unless I say otherwise."*

**Constraints and grounding (all from BIBLE; the Concept Graph API was unreachable at both planning and architecture time — the BIBLE relationship tables are the authoritative source for the vocabulary `b` joins):**

1. **The single-char tag namespace is shared on a kind.** ADR 0011 / BIBLE §23 define `n`/`s` for **kind-39999 only**, child-claims-parent, value = parent a-tag. The namespace already spends `d`, `z`, `p`, `n`, `s` on kind-39999, plus NIP-01-reserved letters (`e`, `a`, `t`, `r`, `i`, `g`, `k`, `q`, `l`/`L`, `m`, `x`). CDs and concepts are kind-39999/39998 events, so any new single-char tag shares this namespace and must not collide.
2. **There is an existing editorial-relationship family** (BIBLE §6 table, lines 298–304; §21 glossary; §22): `IMPORT` ("I agree with your concept definition — implies IS_A_SUPERSET_OF between supersets"), `SUPERCEDES` ("evaluated and replaced with mine"), `PROVIDED_THE_TEMPLATE_FOR`, and concept-level `REFERENCES` (non-committal Neo4j-only stub, carries `source`, NOT agreement). If `b` lands without an explicit boundary against these, it reintroduces the "two parallel schemas" problem.
3. **`b` would be the first editorial relationship encoded as a single-char tag.** Today, editorial relationships are explicit *relationship-descriptor events* (z-tagged to the firmware `:relationship` concept — ADR 0011 §Context). `b` follows the `n`/`s` single-tier pattern (the structural claim lives as a tag on the source event), NOT the legacy descriptor-event pattern. BIBLE §23 currently asserts that consumers walking `n`/`s` "MUST MERGE only HAS_ELEMENT and IS_A_SUPERSET_OF… no editorial relationship types are inferable from these tags" (BIBLE:1614). That statement is correct *for `n`/`s`*; this ADR must scope it accordingly and establish `b` as a distinct editorial single-char tag with its own edge and walk.
4. **The REFERENCES collision contract (BIBLE §22, line 1574) is precedent.** `REFERENCES` is overloaded (tag-level `(:NostrEventTag)→(:NostrEvent)` vs concept-level `(:ListHeader)→(:ListHeader)`), disambiguated by endpoint labels + `source`. Any new edge name must either be collision-free or carry an analogous contract.
5. **Project rules:** no new lint/typecheck/build tooling (CLAUDE.md). **This story's deliverable is documentation only** — the three BIBLE edits plus this ADR. All code (tag emission, the resolver, the Neo4j edge MERGE, event materialization) is out of scope and deferred to future implementation stories.

## Options considered

### Option A — A new single-char tag `b` writing a child→parent `INHERITS_FROM` edge, resolved live (chosen)

A kind-39998 **or** kind-39999 event carries `["b", "<parent-a-tag>", "inherit"]` to claim *"my definition inherits from this parent, unless I state otherwise."* Relay-side filtering by `#b=<parent-a-tag>` (NIP-01-indexed since single-char) returns every child that defers to that parent in one round-trip. Consumers materialize a canonical `(child)-[:INHERITS_FROM]->(parent)` edge. A child's **effective definition** is computed at read time by walking `INHERITS_FROM` to the root, with the child's explicitly-stated fields overriding inherited ones.

**Pros:**
- Reuses the `n`/`s` mechanics wholesale (relay-indexed, child-claims-parent, decentralized — no parent maintains a children list), so the mental model is already internalized.
- One `#b` filter enumerates every event that defers to a given parent → enables the §22 "registry-as-DList" use case (trust-weighted incoming edges = loose consensus on a definition) with no new infrastructure.
- `INHERITS_FROM` is collision-free against every existing relationship type (§6 tables) → no REFERENCES-style disambiguation contract needed.
- Generalizes cleanly: the Communities Protocol's affiliation pointer becomes a *consumer* (`affiliation` → `b` with type `inherit`), not a community-only tag.

**Cons:**
- New protocol-level commitment to the letter `b` (and, by the direction convention, reserves `B`). Forward-compatible but not free to undo.
- `b` is the first editorial single-char tag → requires scoping BIBLE §23's "no editorial relationships inferable" wording and widening the single-char namespace claim to kind-39998.
- Live read-time resolution has a per-read walk cost (bounded by max-depth) and couples the child to the parent's *future* edits (see Consequences).

### Option B — Fold inheritance into the existing `IMPORT` editorial relationship (rejected)

No new tag/edge: express "Bob's dogs = Alice's dogs unless overridden" by reusing `IMPORT`.

**Why rejected:** `IMPORT` and `b` are near-opposite postures. `IMPORT` means *absorption* — the importer agrees with and pulls the parent's curated elements **into their own concept**, and it **implies `IS_A_SUPERSET_OF` between supersets** (BIBLE:301): the importer becomes the structurally-larger, authoritative node. `b` means *deference* — the **parent stays authoritative**, the child's definition *is* the parent's by live reference with overrides, and it **must NOT imply `IS_A_SUPERSET_OF`** (Bob's dogs is a derivative of Alice's, not a superset of it). Folding the two would conflate "I absorb you" with "I defer to you," and would wrongly attach `IS_A_SUPERSET_OF` semantics to a deference edge. They are distinct relationships and need distinct edges.

### Option C — A multi-character tag (e.g., `inherit` / `based-on`) (rejected)

Same semantics as Option A but a human-readable multi-char tag name.

**Why rejected:** identical reasoning to ADR 0011 Option C. NIP-01 relay-side indexing is opt-in for multi-char tags; `#inherit=X` becomes a scan instead of an index hit on many relays, which breaks the §22 "enumerate everyone who defers to parent X" use case at scale. Single-char also signals "canonical protocol primitive," not ad-hoc extension.

## Decision

Adopt **Option A.**

### The tag

| Tag | Logical relationship | On-wire (child carries tag) | Neo4j edge written by consumers |
|---|---|---|---|
| `b` | inherit-from (definitional inheritance with override) | child event claims a parent it defers to | `(child)-[:INHERITS_FROM]->(parent)` |

- **Wire format:** `["b", "<parent-a-tag>", "<type>"]`. Element 2 is the parent's a-tag (`<kind>:<pubkey>:<dtag>` — same shape as `z`/`n`/`s` values; the NIP-01-indexed value). Element 3 is the **affiliation type**, default `"inherit"`; it rides as a non-indexed positional element (exactly as NIP-01's `e` tag carries a `root`/`reply` marker). Reserved future types (e.g. a deliberate-divergence marker) are **not** defined here.
- **Kinds:** defined for **kind-39998 and kind-39999** — any addressable DList object (concept headers *and* items/sets/CDs). This widens ADR 0011's "kind-39999 only" namespace note to include 39998, because concept-to-concept inheritance is the general case.
- **Multi-parent:** an event may carry multiple `b` tags (inherit from multiple parents — rare; resolution order is a consumer concern, flagged in Out of scope). Same multi-tag pattern as `z`/`n`/`s`.
- **Letter check:** `b` is unused by Tapestry (`d`/`z`/`p`/`n`/`s`) and is not a NIP-01-reserved single-char tag. Mnemonic: *based-on / branch*. Collision-free.

### Edge direction — child→parent (a deliberate divergence from `n`/`s`)

`n`/`s` flip the on-wire child-claims-parent encoding into a **parent→child** Neo4j edge (`(parent)-[:HAS_ELEMENT]->(child)`), because their semantics are *containment* (the parent owns the child) and to match `install.js` pass-1d byte-equivalence (ADR 0011 line 179). **`b` does not flip.** It writes `(child)-[:INHERITS_FROM]->(parent)` because:

1. The semantics are *deference/derivation*, which reads naturally child→parent ("Bob's dogs INHERITS_FROM Alice's dogs").
2. The §22 registry use case wants **incoming edges to a parent** = the set of children that defer to it; `MATCH (parent)<-[:INHERITS_FROM]-(child)` is the trust-weightable endorsement query. Child→parent makes that an indexed in-edge scan.
3. `b` carries no legacy install.js constraint.

Implementers must therefore **not** blindly copy the `n`/`s` direction-flip. This is a documented, intentional difference.

### Edge properties

`INHERITS_FROM` is a **canonical, asserted relationship** (the child explicitly published a `b` tag), not a deferred stub — so, like `HAS_ELEMENT`/`IS_A_SUPERSET_OF` and unlike `REFERENCES`, it carries **no `source` property**. It MAY carry a `type` property (string, default `"inherit"`) mirroring tag element 3, so consumers can filter by affiliation type without re-reading the event. No collision contract is required (the relationship type is unique), but consumers SHOULD still scope traversals by endpoint labels where a concept-vs-CD distinction matters.

### Resolution — live read-time walk; field-level override now, set-valued algebra deferred

A child's **effective definition** is computed at **read time**, not stored:

```
effective(node) = merge( effective(parent_via_b), node.statedFields )
```

- **Live:** the walk reads each ancestor's *current* state, so a child tracks the parent's future edits ("whatever Alice says"). The `INHERITS_FROM` edge itself is a materialized structural fact (idempotent MERGE); the *definition* is never snapshotted into the child. This mirrors the Communities draft's `effectiveCD` (§3.5) and the bounded-walk pattern of ADR 0010/0011.
- **Override = the child's own stated fields.** A field the child states explicitly overrides the inherited value; a field the child omits is inherited. An unedited child performs pure inheritance.
- **Termination:** walk stops at a root (no `b` tag) or a `maxDepth` guard; a cycle guard (visited-set keyed on a-tag) prevents loops. (Reuses ADR 0010/0011's guards.)
- **Scope of this ADR:** the universal pattern above plus **field-level (whole-field replace)** override. The **set-valued override algebra** — how a child adds/removes/replaces individual elements of an inherited *set* (e.g. "Alice's dogs minus dingoes plus my strays") — is **deferred** to the first consumer that needs it. Rationale: the first shipping consumer (CD inheritance) overrides only scalars (cutoffs, method preset); defining add/remove/replace semantics before a concrete consumer is exactly the speculative over-design the story warns against.

### Boundary against the editorial family (to be written into BIBLE §6/§21/§25)

| Relationship | Posture | Liveness | Override | Implies `IS_A_SUPERSET_OF`? |
|---|---|---|---|---|
| `REFERENCES` (concept-level) | non-committal bookmark ("may pull later") | n/a (no merge) | n/a | no |
| `IMPORT` | absorb the parent's elements; **importer** authoritative | snapshot/pull | agreement, not override | **yes** |
| `SUPERCEDES` | replace the parent with mine | n/a | n/a | no |
| **`b` / `INHERITS_FROM`** | **defer; parent stays authoritative** | **live (re-resolved each read)** | **first-class "unless stated"** | **no** |

### Answers to the story's forwarded questions

1. **Neo4j edge name** → `INHERITS_FROM` (chosen over `DERIVES_FROM`/`DELEGATES_TO`: most recognizable, accurately names definitional inheritance, collision-free).
2. **Set-valued override algebra** → **deferred** to the first set-overriding consumer (concept element-set inheritance). Field-level replace is the v1 default. Documented here so it isn't silently assumed.
3. **First editorial single-char tag** → yes; `b` is given its own BIBLE section (§25) and edge (`INHERITS_FROM`). §23's "no editorial relationships inferable from these tags" is **scoped to `n`/`s`** (a doc amendment), and the single-char namespace claim is **widened to kind-39998**.
4. **Uppercase `B`** → **reserved, not assigned.** Per §23's direction principle, lowercase = child-claims-parent (`b`). Uppercase `B` is reserved for a future parent-claims-child / federation inverse (a parent recognizing a child as "same community" — the Communities Protocol's deferred multi-root federation). Do not assign speculatively.
5. **Live vs snapshot** → **live** (read-time effective-definition walk; the edge is the only materialized artifact). This is the "whatever Alice says" intent.

### Registry-as-DList (advances ADR 0006 / §22 Flaw-A exit — candidate, not ratified)

A `b` tag is a published, `#b`-queryable, per-pubkey pointer naming a preferred definition. Aggregating a parent's **incoming `INHERITS_FROM` edges, weighted by each child author's GrapeRank influence from the observer's PoV**, yields "which definition my web of trust loosely agrees on" — exactly the grapevine selector §22 defers (BIBLE:1576–1578, `grapevine-resolved → firmware → none`). This ADR records `b` as the **candidate mechanism** for that exit; it does **not** ratify the registry design (that is a separate ADR in the ADR 0006 line).

## Consequences

### Positive
- A single, general inherit-from primitive for any DList object; the Communities Protocol consumes it instead of owning a community-only tag.
- `#b` relay-indexing enables affiliation-graph / registry-as-DList discovery with zero new infrastructure.
- Clear, written boundary against `IMPORT`/`REFERENCES`/`SUPERCEDES` prevents the "two parallel schemas" failure.
- Realizes ADR 0011's Reserved-Future "editorial relationships" candidate deliberately, as that ADR intended.

### Negative / risk
- **Protocol-level commitment to `b`** (and reservation of `B`). Mitigated by deliberate letter choice + single-ADR ratification + registering it in §23/§25 so future ADR-authors don't repurpose it.
- **Live resolution couples a child to the parent's future edits and trust trajectory** — if the parent is later compromised or drifts, the child's effective definition drifts silently. Mitigation is intrinsic: the override mechanism is the pin, and a child can re-publish its `b` tag (different parent, or a future divergence type) to detach. PoV/GrapeRank re-gates visibility on every resolution. Worth an explicit callout in §25.
- **First editorial single-char tag** widens the single-char namespace's remit (class-thread *and* editorial). §23's wording must be scoped or a reader will think single-char = class-thread-only.

### Neutral
- Additive: parsers that don't walk `b` ignore it. Zero impact on instances that don't consume it.
- No `n`/`s` behavior changes; ADR 0011 stands unmodified.

**Firmware reinstall required?** **No** for this story — the deliverable is documentation (BIBLE prose) only; no concept definitions or schemas change. (A *future* implementation story that materializes `INHERITS_FROM` from `b` tags may touch firmware/graph-engine code and should re-evaluate then.)

## Implementation notes

**Phase 4 is documentation-only — edit `BIBLE.md`, no source.** The sketches below are illustrative; the Implementer writes the final prose and places the section. Five edits:

1. **New `BIBLE.md` §25 — "The Inherit-From Tag (`b`)"** (append after §24 Task Queue; add to the Table of Contents). Mirror §23's structure: the tag table (above), wire-format + kinds (39998/39999) + multi-parent, the child→parent edge direction with the explicit "diverges from `n`/`s`, do not flip" note, the live read-time resolution contract + field-level override (set-valued deferred), the editorial-boundary table, the reserved-`B` direction note, and the live-resolution trust-coupling callout. Cross-link to §6, §22, §23.
   - *Placement note:* appended as §25 (not inserted as §24) to avoid renumbering the existing §24 Task Queue section, which is referenced externally (story #20, OPERATIONS). Discoverability is preserved via cross-references from §22/§23/§6. If the user prefers physical adjacency to §23, the alternative is insert-as-§24 + renumber Task Queue→§25 + sweep all "§24" references — higher churn; recommended against.
2. **`BIBLE.md` §6 editorial-relationships table (lines 298–304)** — add a row:
   `| `INHERITS_FROM` | "My definition defers to the parent's, unless I override" — child→parent, live; NOT `IS_A_SUPERSET_OF`, NOT IMPORT. Encoded as the single-char `b` tag (not a descriptor event). See §25. |`
3. **`BIBLE.md` §21 glossary** — add two entries: a **`b` tag** entry (single-char inherit-from pointer, value = parent a-tag, type in element 3; see §25) and an **`INHERITS_FROM`** entry (canonical child→parent definitional-inheritance edge; distinguish from IMPORT/REFERENCES per the boundary table).
4. **`BIBLE.md` §22 (Community-Reference Model)** — near the "Accepted compromise (Flaw A) and its exit" paragraph (line 1578) and the resolution-precedence paragraph (line 1576), add a note: incoming, GrapeRank-weighted `INHERITS_FROM` (`#b`) edges are a **candidate mechanism** for the deferred registry-as-DList / grapevine-resolved-definition exit. Mark explicitly as candidate, not ratified.
5. **`BIBLE.md` §23 amendment** — scope the binding statement at line 1614 to `n`/`s` ("consumers walking **`n`/`s`** MUST MERGE only HAS_ELEMENT/IS_A_SUPERSET_OF…"), and add a one-line pointer that `b` (§25) is a separate editorial single-char tag, that the single-char namespace now spans kind-39998 + 39999, and that `B` is reserved. Update the §23 "Future-candidate relationship tags" note so it no longer implies the inherit-from/editorial slot is unclaimed.

No source files, tests, or firmware are touched by this ADR's story.

## Out of scope (named, deferred)

- **All code:** `b`-tag emission at mutation sites, the effective-definition resolver/merge-walk, the `INHERITS_FROM` MERGE, foreign-event materialization, and any migration of existing events. Future implementation stories.
- **Set-valued override algebra** (add/remove/replace for inherited element sets) — deferred to the first consumer that needs it.
- **Multi-parent `b` resolution order** (which parent wins when a child carries multiple `b` tags) — deferred; the first consumers are single-parent.
- **Uppercase `B`** assignment (parent-claims-child / federation inverse) — reserved, not designed.
- **Ratifying the registry-as-DList / grapevine-resolution exit** — a separate ADR in the ADR 0006 line; this ADR only nominates `b` as the candidate.
- **The Communities Protocol itself** and its §11 ratification items — queued in `_intake.md` (2026-06-05), depends on this.
- **Caching of effective-definition resolution** — a consumer/perf concern, not a protocol decision.
