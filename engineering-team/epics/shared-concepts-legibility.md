# Epic: Shared Concepts Legibility

**Status:** In Progress
**Provenance:** `engineering-team/stories/_intake.md` entry 2026-08-09 (the cat-breed walkthrough — the owner driving the Shared Concepts feature as a naive user); book anchor at `engineering-team/audits/shared-concepts-legibility/book.md`.

## What this is

The `shared-concepts-adoption` epic built the machinery: queues that nominate, actions that wire and declare, coverage discipline, usage-derived dictionaries. This epic asks whether a person can **tell what that machinery has done on their behalf**.

The gap surfaced when the owner walked the feature as a new user would. Four instances, one of them a domain expert who wants to offer her cat-breed concept to the community — and the walkthrough stopped at the first question: *have I already shared this?* Nothing on screen answered it. Verified at kickoff: the expert instance had self-declared exactly one concept, and it was not the one intended; both pages looked identical.

The work is display and vocabulary, not new capability. Every fact these surfaces need is already on the wire or already in the graph; it is simply not shown, not filterable, or shown under a name that means three other things.

## Stories

`stories/shared-concepts-legibility/`:

1. **state-on-concept-page** — a concept's page shows whether it has been shared, and how, before anything is clicked.

Queued behind it (from the intake entry, not yet planned):

- **disposition-filter-on-concepts** — the Concepts list can filter by affiliation state, so author + state composes into "everything my instance has offered."
- **mine-only-self-declared** — a "mine" view of the Self-declared directory; also the natural home for *reached the community* as distinct from *declared locally*.
- **shared-concept-vocabulary** — the remaining labels reviewed against the naming rule. Done in two passes: the Registry rename (commit `15b7d753`), then `Create New Shared Concept` → **Add to Registry** and `Self-declared Shared Concepts` → **Community Offerings**. The rule the review settled: **workflow surfaces are named for the verb; wire inspectors are named for the tag.** `Active b-tags` / `Active z-tags` were therefore deliberately KEPT — for a tool whose job is to show raw b-tags, the mechanism *is* the question, and a friendlier name would hide what the page is. `Community Offerings` pairs with the `My Offerings` page story 2 built: same verb, two subjects, adjacent in the nav.

## ADRs

`decisions/shared-concepts-legibility/` — none yet.

## Notes

**Not in this epic, deliberately:** `seeding-path` (there is no way to offer a concept nobody else uses yet — "Mine to publish" is gated on cross-author demand, which the expert-seeding case by definition lacks). It joins the book only if a `/discuss` rules that the concept page carries seeding; otherwise it brackets separately.

**Also parked:** the TA ↔ owner two-way handshake. Every Author column in this area shows a robot the viewer cannot attribute back to a person — genuinely related, but a wire-format question the owner explicitly deferred.

**Independent of** the registry's data-source arc (`registry-reads-graph` → `materialization-writers` → `registry-sets-and-provenance`), which is queued behind this book. One adjacency to watch: `disposition-filter-on-concepts` and `registry-reads-graph` touch neighbouring queries.

The acceptance frame is outcome-shaped rather than a story list on purpose — the owner is using the user story itself as the prioritization instrument and expects walking it further to surface more work, which belongs here rather than in a successor book.
