# Story 32: Establish "Resolved Definition" as the read-side resolution of the `b` tag (§26)

**Status:** Draft (Planning)
**Created:** 2026-06-05
**Type:** Doc (protocol-definition — runs Planning → Architecture → Implementation → Review; Test Design skipped, mirroring story 31; carries a ratifiable decision captured as ADR 0028 in the 0027 lineage)

## Background

Story 31 / ADR 0027 established the **`b` tag** (BIBLE §25): the *write* primitive for inherit-from — *"my definition is this parent's, unless this event states otherwise."* It is deliberately one-directional (`(child)-[:INHERITS_FROM]->(parent)`) and general to any addressable DList object (concept↔concept, set↔set, Declaration↔Declaration).

`b` answers *"who do I defer to."* It does **not** answer *"what do I actually mean, after following my deferences."* That read-side companion is currently undefined. Story 31's review flagged exactly this as the one non-blocking follow-up (the `effectiveCD` definition). The Communities Protocol design work named the same thing and generalized it: it is **not** community machinery — *Alice has a resolved definition of "dog" that may or may not equal Bob's, by the very same mechanism a community's declaration resolves.* (See `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §2, "The general primitive — Resolved Definition.")

Define it now, as a **general concept-graph read primitive**, so the Communities Protocol (and any curator) *consumes* it rather than re-inventing a community-only resolver. This story is the read-side bookend to §25, sitting at a new BIBLE **§26 "Resolved Definition,"** next to it.

**Substrate-only guardrail (load-bearing for this story).** §26 defines *only* the closure-resolution of `b`-deferences over definitional fields. It must **not** define, imply, or pre-commit the community **membership** model — no rosters, no `nostr-user-tag`, no GrapeRank weighting, no `INFLUENCE_CUTOFF`, no roles. Membership is a separate, community-specific layer that *consumes* the resolved definition and is blocked on a different branch; it is explicitly out of scope here. §26 may name Communities as "the thin application on top" — a forward reference only, exactly as §25 already names Communities as the first consumer of `b`.

## User-facing description

**As an implementer or reviewer** reading the BIBLE, **I want** "Resolved Definition" defined once as the general read-side resolution of `b` — with its resolution rule, its termination conditions, and its boundary against the `b` *write* tag and against IMPORT/REFERENCES — **so that** I can compute "what this node actually means" deterministically and never confuse the read step with the write tag.

**As a protocol designer**, **I want** the decision — including the rejected WoT-weighted-field-resolution alternative and the forwarded design questions — recorded in an ADR in the 0027 lineage, **so that** the Communities Protocol builds membership on a ratified, community-agnostic resolution primitive.

**As a curator**, **I want** a defined notion of "my effective definition of X after following my deferences, with my own overrides winning," **so that** standing on a trusted definition has predictable read-time semantics.

## Acceptance criteria

Testable from the outside (content assertions on `BIBLE.md` and the ADR; exact section placement is the Implementer's call).

- [ ] The BIBLE gains a **§26 "Resolved Definition"** adjacent to §25, defined as the **read-side companion to the `b` tag** and described as applying to *any* addressable DList object (concept / set / Community Declaration), **explicitly not scoped to communities**.
- [ ] In one canonical place, §26 states the **resolution rule**: the resolved definition of a node is its own stated fields merged over the resolved definition reached through its `b` parent(s) — **child's stated fields override; fields the child omits are inherited**; on multiple `b` parents, **first-listed wins**; resolution **terminates** at a node with no `b` parent, at a maximum depth, and on a cycle (cycle-guarded).
- [ ] §26 states resolution is **live / read-time** (re-resolved against the parent's current state), consistent with ADR 0027's live-deference posture — not a snapshot frozen at edge-MERGE time.
- [ ] §26 **explicitly records that WoT-weighted field resolution is rejected for v1** (it would make a curator's own definition vary by observer — surprising, not worth it yet); first-listed-wins is the v1 heuristic.
- [ ] §26 **draws the boundary**: Resolved Definition is the *read* step over `b`; it is distinct from the `b` *write* tag (§25) and from IMPORT (absorption) / REFERENCES (non-committal bookmark), which carry no merge-resolution read step.
- [ ] §26 names the Communities Protocol as a **consumer** ("the resolved definition is what membership is later evaluated against") **without defining membership** — the membership model, `nostr-user-tag`, GrapeRank weighting, and roles are named as out-of-scope, separate, and downstream.
- [ ] An **ADR (expected 0028, in the 0027 lineage)** records the decision, the **rejected WoT-weighted-field-resolution alternative**, and the design questions it resolves or defers (see "Forwarded to the Architect").
- [ ] Quality: no regression in the npm test suites (no source touched); no new lint/typecheck/build tooling introduced.

## Concepts touched

The Concept Graph API at `http://localhost:8877` is being brought up during this work — the Architect should orient via `/api/concept-graph/summaries` per AGENTS.md when reachable; otherwise name concepts in plain language.

- **The `b` / inherit-from relationship** and its edge `INHERITS_FROM` — BIBLE §25, ADR 0027 (the write primitive this story reads).
- **Editorial relationships** — IMPORT, REFERENCES (concept-level, §22), SUPERCEDES — the boundary §26 must hold.
- **Resolved Definition** — *new*; this story defines the read primitive.
- *(Indirectly, forward-reference only)* Community Declaration / the Communities Protocol — the first consumer; not defined here.

## Out of scope

- **All code** — the resolver / merge-walk implementation, any caching, the Neo4j read path, and any API surface. Future implementation stories.
- **The entire membership model** — `nostr-user-tag` consumption, GrapeRank weighting, `INFLUENCE_CUTOFF`, rosters, roles (applicant/member/admin). Separate community-specific layer, blocked on the `feat/pubkey-tagging-target` reconciliation. §26 must not pre-commit it.
- **The rest of the Communities Protocol draft** and adding any Communities section to the BIBLE.
- **Final set-valued override algebra** (add/remove/replace semantics when overriding a node's element set) — surfaced and resolved or deferred *in* the ADR (Phase 2), not pre-decided here.
- Repurposing or renaming any tag; defining the parent-claims-child inverse (reserved uppercase `B`).

## Open questions

**Resolved at planning (2026-06-05):**
1. **Scope** → §26 "Resolved Definition" + ADR 0028 only; substrate read primitive, **not** membership. Membership stays out, blocked on branch reconciliation (see `docs/ADR_REFOLDER_RECONCILIATION_PROPOSAL.md`).
2. **Phase path** → Planning → Architecture → Implementation → Review, **Test Design skipped** (docs-only, no executable behavior; doc-content sentinels covered in Review, per story 31 / story 20 precedent).

**Forwarded to the Architect (resolve or defer in ADR 0028 — not blocking this story):**
3. **Set-valued override algebra** — overriding a node's element/superset set needs add/remove/replace semantics; the scalar-field case is simple merge. Specify or defer.
4. **`maxDepth` constant** for the resolution walk (cf. the class-thread pull's depth-16 / fetch-2000 guards in ADR 0010).
5. **Cycle-guard behavior** — truncate-and-continue vs error vs ignore-the-back-edge.
6. **Snapshot vs live** — confirm live read-time resolution (story leans live, per ADR 0027); note any caching contract for implementers.
7. **Pseudocode placement** — whether the merge/walk is specified as pseudocode in §26, only in ADR 0028, or both.

## Linked artifacts
- ADR: `../../decisions/community-reference/0028-resolved-definition.md` — *to be written in Phase 2 (Architecture)*.
- Test plan: _n/a — Test Design skipped (docs-only, no executable behavior; doc-content sentinels covered in Review)._
- Review: `../../reviews/community-reference/32-resolved-definition-read-primitive.md` — *Phase 5*.
- Related: story 31 (`b` write primitive, Done); `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §2 (source design); ADR 0027.
