# Epic: Shared Concepts Seeding

**Status:** Done *(book closed 2026-08-11; retirement to `done/` on next-phase ingestion)*
**Provenance:** Owner `/discuss` 2026-08-10, following the `shared-concepts-legibility` close; book anchor at `engineering-team/audits/shared-concepts-seeding/book.md`. The predecessor's PRD seed named this gap explicitly: that book served the operator's *legibility*, not the domain expert's *contribution*.

## What this is

Making it easy to share a concept — and honest about whether it landed.

The previous epic made an instance's sharing state visible on three surfaces. It did not make
sharing discoverable, and its own close recorded why that matters: the kickoff persona was a
veterinarian with a cat-breed taxonomy, and she finished that book able to *see* that her concept
was unshared with nothing inviting her to share it.

**The load-bearing correction this epic inherits:** the capability to share a concept nobody else
uses has always existed — the concept page's submit button, and the same button in the Concepts-list
disposition panel. **The gap is discovery, not capability.** An earlier analyst claim to the
contrary was written into three documents before being caught; rebuilding the action is the specific
trap this epic must not fall into.

## Stories

`stories/shared-concepts-seeding/`:

1. **honest-broadcast-reporting** — the two broadcast-bearing disposition actions discard the publish result and claim community reach unconditionally. Four affected actions across two pages, including the Adoption Queue's **Adopt**.
2. **retire-the-offering-vocabulary** — "offering" named a category the owner had already ruled out on 2026-08-06; retired in favour of *shared* and *didn't reach the community*, the latter a failure to retry rather than a resting state.

3. **disposition-filter-on-concepts** — the bulk sweep: filter the Concepts list to "not yet shared". **Moved here** from the legibility book's queue, because filtering by that state is the bulk half of seeding rather than a legibility filter. **Done** (review PASS after one kick-back). ADR 0001.
4. **share-from-shared-by-me** — the frame's first bullet. **Reduced in scope 2026-08-11** and ratified in `/discuss`: it shipped as a **signpost** into the filtered Concepts list, not a second list with its own share control — a page routes to an action rather than hosting a copy of it. The substance turned out to be making the destination arrive already narrowed, since the Concepts filter reset on every visit and no link could set it. **Done** (review PASS). ADR 0002.

## ADRs

`decisions/shared-concepts-seeding/`:

- **0001** — the not-yet-shared filter joins the bulk sharing answer (`/api/shared-by-me`) rather than re-deriving it from the row's disposition chip.
- **0002** — the route carries its state in the address, and its count reuses the shipped predicate.

Stories #1 and #2 skipped Architecture by design: #1 as a Bug whose working model already existed, #2 as a Refactor whose names were settled with the owner before Planning. Both later stories needed one, and both ADRs turn on the same argument — one definition, one home, so two surfaces cannot contradict each other.

## Notes

**Do not fold seeding into the Adoption Queue.** Its contract is *nomination* — the system proposes,
the owner ratifies. Seeding is owner-initiated. Two verbs on one surface is precisely the confusion
the previous epic spent itself undoing.

**Naming rule inherited from the previous epic:** workflow surfaces are named for the verb; wire
inspectors are named for the tag.

**Observed at book open, deliberately outside the frame:** the same demand gate blocks the opposite
direction. A freshly offered concept shows up on other instances' Community Offerings but is never
*nominated* in their Adoption Queue, because nominations derive from z-tag usage and a new offering
has none. Seeding is gated at both ends by one mechanism. Whether to prompt adoption is an open
product question for the book close to hand back.
