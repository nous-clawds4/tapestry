# Book of Work: Seeding — making it easy to offer a concept, and honest about whether it landed

**Slug:** shared-concepts-seeding
**Status:** Closed
**Opened:** 2026-08-10
**Closed:** 2026-08-11

## Intent anchor

**Acceptance frame (no PRD)** — drafted from the owner `/discuss` of 2026-08-10 and ratified in-session.

### Where this comes from

The `shared-concepts-legibility` book (closed 2026-08-10) made an instance's sharing state visible.
It deliberately did **not** make offering *easy* — and its own PRD seed named that as the gap: the
kickoff persona was a domain expert with a cat-breed taxonomy, and the book served the operator's
*legibility* rather than the expert's *contribution*.

**A correction that book recorded, and which this one must not undo:** the capability to offer a
concept nobody else uses has always existed — the concept page's `Submit as a Shared Concept`
button, and the same button inside the Concepts-list disposition panel. Both append the
self-pointing `b`, publish to local strfry, import to Neo4j, and broadcast to
`wss://dcosl.brainstorm.world`. **The gap is discovery, not capability.** Do not rebuild the action.

Confirmed in practice at this book's open: the owner offered `cat` and `cat breed` from staging
through the existing affordance, both appeared on My Offerings as **Shared**, and both were verified
present on `dcosl` by direct relay query. The path works — it is just not one a new user would find.

### Acceptance frame

- [x] From the page about what she has shared, the owner can **share a concept she hasn't shared
      yet**, without knowing which other page to visit. — **story #4**, shipped as a *signpost* into
      the filtered Concepts list rather than a second list on this page (reduction ratified
      2026-08-11); the errand completes one page over.
- [x] Every path that shares a concept **tells her truthfully** whether it reached the community —
      including when it didn't. — **story #1**, with the vocabulary corrected by **story #2**.
- [x] She can find, in bulk, **which of her concepts she hasn't shared**. — **story #3**.

### Scope notes

- **Owner-set order: the bug first.** Items 2 and 3 both create new paths into the same reporting
  code, so fixing the report first means the new affordances inherit an honest one rather than
  propagating a lie.
- **The known defect** (frame bullet 2): `declareAndBroadcast`
  (`ui/src/utils/dispositionActions.js:26`) awaits `publishToRelays` and **discards its result**,
  then reports *"Submitted as a shared concept."* `publishToRelays` does not throw on failure — it
  resolves `{successes: [], failures: [...]}`, and when the local-only guard is on it resolves
  `{skippedByGate: true}` (`ui/src/utils/nostrPublish.js:95`). So the Concepts-list path claims
  success whether or not anything reached the relay. `ConceptDetail.jsx`'s own handler gets this
  right and is the model.
- **`disposition-filter-on-concepts` moves here** from the legibility book's queue. Filtering to
  "not yet offered" is the bulk half of *seeding*, not a legibility filter.
- **Do not fold seeding into the Adoption Queue.** Its contract is *nomination* — the system
  proposes, the owner ratifies. Seeding is owner-initiated. Two verbs on one surface is the
  confusion the previous book spent itself undoing.
- **Observed at open, not yet in the frame:** the same demand gate blocks the *other* direction too.
  A freshly offered concept appears on other instances' Community Offerings but is never *nominated*
  in their Adoption Queue, because nominations derive from z-tag usage and a new offering has none.
  Seeding is gated at both ends by one mechanism. Whether prompting adoption belongs in this book is
  an open product question — it is **not** in the frame above.

## Epics in this book
- `shared-concepts-seeding` — sharing a concept easily, and reporting honestly whether it landed.

> **Vocabulary note (story #2, 2026-08-10):** "offering" was retired. It named a category — a concept
> put forward but not published — that the owner had already ruled out on 2026-08-06. There is only
> *shared*, and *didn't reach the community*, which is a failure to retry rather than a resting state.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** **High** — the frame predated the work, all four stories carry story +
  review artifacts, and every bullet was verified on a rendered page in production (three corpora:
  45 waiting local, 35 staging, 33 production, each matching its destination's row count).

## Close artifacts
- Build audit: `engineering-team/audits/shared-concepts-seeding/audit.md`
- Product feedback: `engineering-team/audits/shared-concepts-seeding/prd-seed.md`
