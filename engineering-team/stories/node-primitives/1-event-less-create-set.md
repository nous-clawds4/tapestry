# Story 1: Create a set with no event behind it (strfry-free create-set)

**Status:** Approved
**Created:** 2026-09-12
**Type:** Feature

## Background

The operator is organizing the local-only `firmware concept` concept into subsets. The first subset,
`firmware concepts for nostr`, was made on 2026-09-12 with the existing lettered `create-set`, which signed
two events into local strfry (the set itself and a relationship descriptor). The operator then decided the
remaining subsets should live in Neo4j only. BIBLE §30 supports that: Neo4j is "the definitive 'me'",
signed events are letters, and "a Neo4j write that is never published is a private thought". This is also
the next member of the strfry-free family that `relationship-primitives` started — its prd-seed names
node-level operations as the family's inferred next step.

Today nothing supports it:
- every route that creates a node signs an event, and the strfry-free primitives only link nodes that
  already exist — so an event-less set means hand-written Cypher;
- no node without an event exists in the graph, so every read, count and publish path would be meeting one
  for the first time.

Two read paths already behave the way this story wants: the canonical concept count walks a concept's sets
transitively, and "Publish concept to community" skips any node with no event behind it.

**Design questions handed to Architecture** (not PO decisions):
- What an event-less node looks like, given BIBLE §6 describes the `NostrEvent` label as "any imported
  nostr event" and a node's `uuid` as its event's address.
- Whether its would-be tags (name, description, parent) are kept, so a letter can be minted later without
  re-creating the set.
- How duplicate detection spans lettered and event-less sets (criterion 2).
- How to test without touching the shared local stack: another session is testing on it and it is not
  bind-mounted, so live checks — including criterion 5's firmware reinstall — belong in an ephemeral
  scratch container (precedent: `scripts/brain-drill.sh`).

## User-facing description

As the owner/operator — or an agent session acting for me — I want to create a set under an existing
superset or set directly in my Neo4j graph, with no nostr event signed or stored, so that I can organize
my own concepts as private thoughts, without writing letters I never meant to send, and still see and use
those sets like any others.

## Acceptance criteria

- [ ] **Create.** Given an existing superset or set and a non-empty name (description optional), when the
      owner or a trusted local operator asks to create a set under it, then a new set exists under that
      parent, it is an element of the `set` concept, the answer names the new set, and no nostr event was
      signed or stored (local strfry's event count is unchanged).
- [ ] **No duplicates.** Given a set with that name already exists under that parent — event-less or
      lettered — when the same create is asked again, then no second set appears and the answer reports
      the existing set as already existing.
- [ ] **Guards.** Given a parent that doesn't exist, a blank name, an authenticated non-owner, or an
      unauthenticated remote caller, when the create is asked, then nothing is created and the answer says
      what was wrong, the way the sibling relationship primitives answer those cases.
- [ ] **Behaves like any set, stays private.** Given an event-less set with members wired to it by
      `add-relationship`, then the concept's Organization (Sets) view lists it under its parent with its
      direct and total counts, the concept's element count includes those members, and publishing the
      concept to the community sends nothing for the set.
- [ ] **Survives reinstall.** Given an event-less set under a concept, when the firmware is reinstalled,
      then the set, its link to its parent, its membership in the `set` concept, and its links to its
      members are all still there.

## Concepts touched

- `39998:<TA>:set` — set (the new node is a set, and becomes an element of this concept)
- `39998:<TA>:superset` — superset (a parent can be a concept's superset)
- `39998:<TA>:class-thread` — class thread (the set joins a concept's thread: superset → set → element)
- `39998:<TA>:firmware-concept` — firmware concept (the first consumer: its remaining subsets)

`<TA>` is this instance's Tapestry Assistant pubkey, resolved at runtime (`/api/assistant/pubkey`).

## Out of scope

- Minting a letter for an event-less set later (publishing it) — a future story; this one must keep it
  possible without re-creating the set.
- The existing lettered `create-set` and the UI's "+ New Set" button — unchanged; they keep writing letters.
- `firmware concepts for nostr` — keeps its two local letters; not converted.
- Deleting or renaming sets; event-less creation of other node kinds (elements, concepts, properties).
- Wiring members and pruning direct superset edges — `add-relationship` / `delete-relationship` already do
  that.
- §30's "locally authored" marking — the `self-ontology` epic's open work; this story must not rule it
  out. An event-less set is recognizable today by having no event behind it.
- Changing firmware-install behavior.
- Creating the remaining `firmware concept` subsets — operator curation after ship (the book's "one real
  use").
- Whether admins, not just the owner, should reach this surface (`relationship-primitives` prd-seed §7) —
  same gate as the siblings.

## Open questions

None blocking. Settled at kickoff (2026-09-12): the epic (new `node-primitives`), membership in the `set`
concept (yes — part of creating the set), and delivery (production plus one real use; see the book).

## Linked artifacts
- Book: `engineering-team/audits/event-less-sets/book.md`
- ADR: `engineering-team/decisions/node-primitives/0001-event-less-add-subset-primitive.md`
- Test plan: `engineering-team/stories/node-primitives/1-event-less-create-set.test-plan.md`
- Review: `engineering-team/reviews/node-primitives/1-event-less-create-set.md`

## Deviations

- `scripts/scratch-stack.sh` mounts this checkout's `src/` read-only into the scratch container (`brain-drill.sh`'s pattern) rather than copying it in and restarting the control panel, as the ADR's Implementation notes put it — same effect, no restart.
- The scratch instance also runs with `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` — an egress guard the ADR did not ask for.
- `nodes.js` resolves the three class-thread relationship types through `firmware.relAlias` (the `relationships.js` pattern) where the ADR's sketch wrote the alias names as literals.
- An empty-string `description` is treated as absent (no description tag), mirroring `create-set`'s `if (description)`.
- `scripts/scratch-stack.sh` sizes the scratch's Neo4j with the `BRAINSTORM_NEO4J_*` override (OPEN.md row 186) instead of `brain-drill.sh`'s shrink-after-boot `sed` + restart. The entrypoint regenerates the sizing from the whole Docker VM at every container start, and a first boot at that size never came up beside the shared stack (2026-09-12).
