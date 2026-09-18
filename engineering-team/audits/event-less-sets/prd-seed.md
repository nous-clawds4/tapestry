# PRD Seed: Private (event-less) sets in the reference graph

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/event-less-sets/audit.md`
**Anchor:** acceptance frame in `book.md` (confirmed at kickoff, 2026-09-12)
**Confidence:** high
**Date:** 2026-09-13

> Reverse-engineered baseline in PRD shape: a strawman for the product team, with each section tagged. This book shipped **one more member of the strfry-free primitive family** that `relationship-primitives` began. That book's seed named node-level operations as the family's inferred next step (§1) and asked product to confirm the demand (§7); the operator confirmed it on 2026-09-12. Ingest this seed alongside that one, and alongside the `self-ontology` epic's open work on §30's provenance marking.

## 1. Product vision
`[FROM FRAME]` The owner's Neo4j graph is the definitive self. A signed event is a letter, and "a Neo4j write that is never published is a private thought" (BIBLE §30). The owner organizes their own concepts into sets as private structure, and should not have to write a letter for every set. This book made that possible for sets: a set can exist in the graph with no event behind it and still behave like any other set.

`[INFERRED]` The trajectory: node-level private editing grows as curation needs it (delete, rename, other node kinds), along with a way to mint a letter for private structure when the owner decides to share it.

## 2. Personas
`[FROM FRAME]` **The owner/operator** curates their local graph (here, the local-only `firmware concept`). They want private structure that stays on the machine, and they work over the API or through an agent session.

`[INFERRED]` **The agent session** acts for the owner over the container loopback; the real use was done this way.

`[UNKNOWN — product input needed]` Whether admins, not just the owner, should reach this surface. The question is inherited from the `relationship-primitives` seed §7.

## 3. Scope (as-built)
`[FROM FRAME]` In scope:
- Create a set under an existing superset or set with no event signed or stored, and register it as an element of `set`.
- Repeating a create is safe.
- The same guards and failure answers as the sibling primitives.
- It behaves like any set in Organization (Sets) and in the counts.
- It stays out of "Publish concept to community".
- It survives a firmware reinstall.
- It shipped to production and was used once for real.

`[FROM FRAME]` Out of scope:
- Minting a letter later.
- Changing the lettered `create-set` or the UI's "+ New Set".
- Deleting or renaming sets.
- Event-less creation of other node kinds.
- §30's provenance marking.
- Backups.
- Firmware-install changes.

`[INFERRED]` The surface is API-only. Members are wired, and direct edges pruned, with the existing relationship primitives.

## 4. Domain model
`[INFERRED]` One new node *state*, not a new entity: an **event-less set**. It has the shape of a lettered set (the same address rule, the same would-be tags, the same edges) but no event. Today it is recognized by having no event behind it (`id` absent).
- **Relationships:** parent → set (superset-of); the `set` concept → set (element); set → members (element).
- **Implied lifecycle** `[INFERRED]`: private (event-less), then possibly lettered later through a future primitive. The stored would-be tags make that transition possible without re-creating the node.

## 5. Design rules (as-built)
`[INFERRED]`
- Private structure is **Neo4j-only**. No strfry write can happen: the module's import surface is test-pinned.
- **Same shape as a lettered set, minus the event**, so every read path works unchanged and a later letter lands on the same node.
- **Idempotent by name under its parent**, across lettered and event-less sets. An address collision with a different node answers a loud 409.
- Every create answers with a **durability note**: only a Neo4j backup preserves an event-less node.
- `[UNKNOWN]` No UI rule exists for how, or whether, the UI should show that a set is private or offer private creation.

## 6. Carry-forward & open questions
Promoted from audit §6:
- **Backup coverage for event-less nodes** (OPEN.md row 281). This is the most urgent, because real curation now lives in one.
- A letter-minting primitive; `delete-subset` and rename; event-less creation of other node kinds.
- §30's "locally authored" marking (`self-ontology`).
- A UI affordance for private sets.
- Dangling letters beneath an event-less set (documented, not guarded).
- Non-ASCII set names share an address (row 282).
- The remaining seven `firmware concept` subsets (the operator's call).
- Test and tooling follow-ups: rows 285, 286 and 287.

## 7. What product must validate
- [ ] **Backups before more private curation?** Should backup coverage for event-less nodes (row 281) come before the owner puts more curation into private sets?
- [ ] **Should the UI show privacy?** Today a private set looks identical to a lettered one in the UI, and "+ New Set" always writes a letter. Should a private set look different, and should the button offer a private option?
- [ ] **Publishing private structure.** When the owner decides to share a private set, what happens? That means a letter-minting step, and a rule for lettered children that already point at it.
- [ ] **Next family members.** Which node-level primitives does real curation need next (delete, rename, private elements or concepts), and in what order?
- [ ] **Admins vs owner** on private-graph edits (inherited from the `relationship-primitives` seed §7).
