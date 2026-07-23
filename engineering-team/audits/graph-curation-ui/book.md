# Book: graph-curation-ui

**Status:** Closed
**Opened:** 2026-07-22 *(retroactively — this manifest was written at close on 2026-07-23; the
eager-anchor step was missed at intake, recorded as OPEN.md row 78)*
**Closed:** 2026-07-23
**Mode:** human-gated per-story cycle (no Direction-mode section; never armed)

## Intent anchor — acceptance frame (reconstructed, same-session)

The operator's ask, verbatim (session of 2026-07-22, after the lay-of-the-land assessment):

> "We recently created a new API endpoint … that I can use to add and delete relationships in
> neo4j. The initial motivation … was so that I could take a preexisting element … and make it a
> subset of a preexisting set … If my suspicions are correct, then I would like to proceed with
> adding this feature to the front end so that I can move elements around with ease."

Scope was fixed by three operator answers at Planning (2026-07-22):

1. **Both placement kinds**, chosen per action — member *element* (`HAS_ELEMENT`) or *subset*
   (`IS_A_SUPERSET_OF`).
2. **All three surfaces** — set detail page, element detail page, Organization (Sets) overview.
3. **Instant reference-graph edit + warning** — the strfry-free primitives path, surfacing the
   firmware-install hazard note; event-backed durability explicitly deferred.

Definition of done: the eight acceptance criteria of story
`engineering-team/stories/graph-curation-ui/1-move-nodes-between-sets-ui.md`, operator-gated at
every phase.

## Epic set

- `engineering-team/epics/graph-curation-ui.md` — 1 story (cap never set; single-story book).

## Close artifacts

- Build audit: `engineering-team/audits/graph-curation-ui/audit.md`
- PRD seed (no PRD existed): `engineering-team/audits/graph-curation-ui/prd-seed.md`
- **Provenance:** Reconstructed (same-session ask, operator-gated) · **Confidence: medium** — the
  workflow's default for an anchor-less close is *low*; raised one notch only because the intent
  holder was present and ratified every gate in the same session, and the ask is quoted verbatim
  above rather than inferred from git. Not dressed up further than that.
