# PRD Seed: Reference-Graph Editing Primitives

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/relationship-primitives/audit.md`
**Anchor:** acceptance frame in `book.md` (operator-confirmed 2026-07-18; refreshed pre-arming 2026-07-21)
**Confidence:** high
**Date:** 2026-07-22

> Reverse-engineered baseline for the product team. Special situation: this book shipped **enabling infrastructure for a product whose PRD now exists** — `product-team/prd/second-brain.md` (approved 2026-07-21, after this book was armed) names these primitives as a referenced-never-re-specified dependency (§7.9) and its stories 2, 3, and 8 declare dependencies on them. The product team should ingest this seed **into the second-brain product's Phase-2 scoping**, not as a separate product.

## 1. Product vision
`[FROM FRAME]` The owner's Neo4j graph is the reference — "it is 'me', the second brain of the tapestry owner / operator… Strfry is simply one format by which information can be communicated" (operator, verbatim, the book's governing premise). This book delivered the first two of a planned **family of strfry-free graph-editing primitives**: add and delete a single typed relationship, so routine curation of the owner's own graph no longer requires raw Cypher. `[INFERRED]` The family's trajectory: more primitives (node-level operations, further relationship types) as the second-brain product demands them.

## 2. Personas
`[FROM FRAME]` **The owner/operator** — curates their own reference graph; needs scalpel-grade edits with validation, idempotency, and structured answers; trusted via owner session or local operation. `[INFERRED]` **The agent session** acting for the owner over the same surface (the second-brain PRD's Fresh-Context Session persona, whose write-back path these primitives serve). `[UNKNOWN — product input needed]` whether admins-as-distinct-from-owner should reach this surface (today `isOwner` admits admin pubkeys, per the platform-wide template — see audit §5).

## 3. Scope (as-built)
`[FROM FRAME]` Add + delete of one typed, directed relationship between existing nodes; whitelist = the two class-thread membership types (`HAS_ELEMENT`, `IS_A_SUPERSET_OF`) resolved through the firmware alias layer; explicit per-operation owner gate; loud, named precondition failures; zero strfry interaction (structurally tested); firmware-install hazard documented at point of use; a credential-free read-only deployment probe. `[FROM FRAME]` Explicitly out: strfry emission, reconciler, publication-intent modeling, UI affordances, install-behavior changes, net-new relationship types (`HAS_SUBGOAL` named for the second-brain follow-up).

## 4. Domain model
`[INFERRED]` No new domain entities — the primitives operate on the existing class-thread machinery (relationships between `Superset`/`Set`/`ListItem`/core nodes). The whitelist is deliberately *policy-free*: any existing node pair is permitted (label enforcement rejected as "the composite-endpoint disease" — ADR 0001 decision 4); structural policy remains the firmware installer's domain. The probe introduces no domain nouns.

## 5. Design rules (as-built)
`[INFERRED]` API-only surface; no UI shipped by design. Response conventions: `{success, …}` shape; idempotent outcomes are HTTP 200 with a `result` discriminator (`created`/`already-existed`/`deleted`/`not-found`); 404 = named missing node, 400 = named bad input with the `allowed` list, 403 = identity, 401 = middleware. Every graph-changing success carries a one-line install-hazard `note`. `[INFERRED]` The structural-auditability house style: negative guarantees (strfry-free, side-effect-free) are import-boundary facts under S-class test, not control-flow claims.

## 6. Carry-forward & open questions
Promoted from audit §6:
- `HAS_SUBGOAL` (and future second-brain relationship types) as a whitelist extension — second-brain story 3's declared dependency.
- Real firmware-install overwrite protection (its own epic; operator-deferred); export/restore (second-brain story 8) is the interim answer.
- Whitelist growth to core-node wiring types needs a cardinality-safety design first.
- The wider authenticated-non-owner gap on the admin-mutation surface (separately scoped, intake 2026-07-21).

## 7. What product must validate
- [ ] Admin-vs-owner access to reference-graph edits (§2 `[UNKNOWN]`): is the platform-wide "owner gate admits admins" template right for *second-brain* writes, or does "it is 'me'" demand owner-only?
- [ ] Whether the primitive family's next members (node create/delete? property edits?) are demanded by second-brain Phase 2's ledger entities, or whether the composite endpoints suffice there.
- [ ] Whether the deployment-probe pattern (story #2) should become a standing convention for future books' staging evidence (process question — flag to the harness, but the *product* cost is one public read route per surface).
