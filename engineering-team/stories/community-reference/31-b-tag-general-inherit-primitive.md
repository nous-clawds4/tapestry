# Story 31: Establish the `b` tag as a general inherit-from primitive

**Status:** Done
**Created:** 2026-06-05
**Type:** Doc (protocol-definition — runs Planning → Architecture → Implementation → Review; **not** fast-tracked, because it carries a ratifiable design decision captured as ADR 0027)

## Background

We are drafting the Tapestry Communities Protocol. Its mechanism for a participant Community Declaration to defer to a parent Declaration — currently called the `affiliation` tag — is being recast as a single-character `b` tag, following the `n`/`s` convention in BIBLE §23 (single-char ⇒ relay-indexed per NIP-01; child-claims-parent; a-tag value; reserve uppercase `B` for the parent-claims-child inverse).

In discussion it became clear this relationship — *"accept the parent's definition unless this event states otherwise"* — is **not community-specific**. It is general to any addressable DList object. Worked example: Alice publishes a `dogs` concept; Bob mints his own `dogs` concept carrying `["b", "<Alice's-dogs a-tag>", "inherit"]`, meaning *"my notion of dogs is whatever Alice says, unless I say otherwise."* The same shape serves concept↔concept, set↔set, and Declaration↔Declaration.

The risk if we ship `b` only inside the Communities Protocol: it lands beside the BIBLE's existing editorial relationships — **IMPORT** (absorb the parent's curated elements; importer becomes authoritative), **REFERENCES** (non-committal bookmark, may-pull-later, §22), **SUPERCEDES** (replace) — without an explicit boundary, reintroducing the "two parallel schemas" problem the protocol itself warns against. `b` is genuinely distinct: **live deference** (the parent stays the authority), with a **first-class "unless otherwise stated" override**. That distinction has to be written down, or implementers will conflate `b` with IMPORT.

Doing this now — before the Communities Protocol's tag set is ratified — means the Communities Protocol *consumes* a core primitive rather than owning a community-only tag. It also surfaces a bonus: aggregated, trust-weighted incoming `b`-edges are a candidate mechanism for §22's long-deferred "grapevine-resolved community definition" (Flaw A) exit.

## User-facing description

**As an implementer or reviewer** reading the BIBLE, **I want** `b` defined once as a general inherit-from primitive with an explicit boundary against IMPORT / REFERENCES / SUPERCEDES, **so that** I know when to use it and never confuse live-deference with absorption or bookmarking.

**As a protocol designer**, **I want** the decision — with its rejected alternatives and its open design questions — recorded in an ADR, **so that** the Communities Protocol and future curators build on a ratified primitive instead of an ad-hoc community tag.

**As a curator**, **I want** to express "my concept of X defers to another curator's, with my own overrides," **so that** I can stand on a trusted definition without copying it.

## Acceptance criteria

Testable from the outside (content assertions on `BIBLE.md` and the ADR; exact section placement is the Implementer's call).

- [ ] The BIBLE defines a single, general-purpose **inherit-from primitive — the `b` tag** — described as applying to *any* addressable DList object (concept↔concept, set↔set, Community Declaration↔Declaration), explicitly **not** scoped to communities.
- [ ] In one canonical place, the BIBLE states `b`'s meaning: **child-claims-parent**; the tag value is the **parent's a-tag**; semantics are *"accept the parent's definition unless this event states otherwise"*; the **parent remains the authority** and the child may override specific fields. The Communities Protocol's affiliation pointer is characterized as a *consumer* of this primitive (`affiliation` → `b` with type `inherit`), not a separate tag.
- [ ] The BIBLE **distinguishes `b` from IMPORT, REFERENCES (concept-level), and SUPERCEDES** so a reader can choose between them — naming `b`'s live-deference + override posture against IMPORT's absorption and REFERENCES's non-committal bookmark. This includes a glossary (§21) entry for `b` and its placement in the editorial-relationship family/table (the ~§301 region).
- [ ] The Community-Reference Model (§22) names `b` as a **candidate mechanism for the deferred "registry-as-DList / grapevine-resolved community definition" exit (Flaw A)** — i.e. aggregated, trust-weighted incoming `b`-edges as the selector of a community's preferred definition.
- [ ] An ADR (expected **0027**, in the 0006/0011 lineage) records the decision, the **rejected alternative of folding `b` into IMPORT**, and the design questions it resolves or defers (listed under "Forwarded to the Architect" below).
- [ ] Quality: no regression in the npm test suites (no source touched); no new lint/typecheck/build tooling introduced.

## Concepts touched

The Concept Graph API at `http://localhost:8877` was **not reachable at planning time** — Architect should resolve handles via `/api/concept-graph/summaries` when orienting.

- **Editorial relationships** — IMPORT, SUPERCEDES, REFERENCES (concept-level) — BIBLE §21/§22 + relationship table (~§301). Likely correspond to firmware "relationship" concepts in the graph.
- **Class-thread membership tags** `n` / `s` / `z` — BIBLE §23 (the convention `b` extends).
- **The `b` / inherit-from relationship** — *new*; this story defines it.
- *(Indirectly)* Community Declaration / the Communities Protocol — the first consumer.

## Out of scope

- **All code** — tag emission, the resolver/merge-walk, the Neo4j edge MERGE, and migration of existing events. Future implementation stories.
- **The rest of the Communities Protocol draft** and its other §11 ratification items (canonical membership, single-root, Tag wire format, membership threshold, CD term). Separate effort — logged in `_intake.md` (2026-06-05).
- **Adding the full Communities Protocol document to the BIBLE.** This story adds only the general `b` primitive and its placement; incorporating the Communities draft is separate.
- **Pre-deciding the deferred design specifics** (edge name, override algebra, etc.) — those are resolved *in* the ADR (Phase 2), not in this story.
- Renaming or repurposing any other single-char tag.

## Open questions

**Resolved at planning (2026-06-05):**
1. **Scope** → confirmed = the `b` primitive only (three BIBLE-core edits + ADR 0027). The broader Communities Protocol is deliberately deferred to a follow-up effort, logged in `_intake.md` (2026-06-05), to be picked up after this story.
2. **Phase path** → Planning → Architecture → Implementation → Review, with **Test Design skipped** (no executable behavior; doc-content sentinels are covered in Review, per the story #20 precedent). A light structural-sentinel pass may be added at Implementer/Reviewer discretion if useful.

**Forwarded to the Architect (resolve or defer in ADR 0027 — not blocking this story):**
3. Which Neo4j edge `b` writes (candidates: `INHERITS_FROM` / `DERIVES_FROM` / `DELEGATES_TO`), analogous to `n`→HAS_ELEMENT, `s`→IS_A_SUPERSET_OF.
4. Set-valued override algebra (overriding a concept's element set needs add/remove/replace semantics; the CD case only overrode scalars).
5. Carving `b` out of §23's "no editorial relationships inferable" constraint (BIBLE:1614) — `b` would be the first *editorial* single-char tag — and widening the single-char namespace claim to kind-**39998** (concepts are headers).
6. Reserving uppercase **`B`** for the parent-claims-child / federation inverse.
7. Whether resolution is a **live walk** (re-resolved against the parent's current state) or a **snapshot at MERGE time**.

## Linked artifacts
- ADR: [../../decisions/community-reference/0027-inherit-from-tag-b.md](../../decisions/community-reference/0027-inherit-from-tag-b.md) — **Accepted** (2026-06-05).
- Test plan: _n/a — Test Design skipped (docs-only, no executable behavior; doc-content sentinels covered in Review, per the story #20 precedent)._
- Review: [../../reviews/community-reference/31-b-tag-general-inherit-primitive.md](../../reviews/community-reference/31-b-tag-general-inherit-primitive.md) — **PASS** (2026-06-05): 6/6 ACs met, ADR 0027-conformant, 26/26 test suites green, BIBLE-only diff. One non-blocking follow-up (`effectiveCD` definition when the Communities Protocol lands).
