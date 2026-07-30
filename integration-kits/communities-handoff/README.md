# Communities handoff kit

Self-contained state handoff for the **Communities** workstream (Avi's `feat/communities`),
bridging the gap since the 2026-06-05 dependency response. Copy this whole folder to wherever
the Communities work lives and tell the Claude instance there:

> Read `communities-handoff/HANDOFF.md` and reconcile your understanding of the tagging
> primitive with it before continuing the Communities work.

Unlike the sibling `jumble-tagging` kit, this is a **handoff, not a build kit**: Communities is
less fully specified as a product, so there is no GO.md build script and no bundled SDK — the
deliverable is shared understanding of the current wire truth plus pointers to the reference
code on `staging`.

Contents: `HANDOFF.md` (the narrative — what the June response promised, what shipped, current
wire shapes, what's still open), `protocol/` (verbatim snapshots, taken 2026-07-29, of the
normative specs Communities consumes: communities, tags, event-taggings, trusted-lists,
inherit-from, tapestry-concepts, stamping, decentralized-lists), `reference/` (the June
baseline docs — the dependency response and the design handoff — plus ADR-0022, the hybrid
`e`+`a` wire decision, and ADR-0018, the proposed composite-tags design).

Maintained in the Tapestry repo at `integration-kits/communities-handoff/`. The snapshots go
stale by design — the live copies under `protocols/` in the Tapestry repo always win. If the
tag core on `staging` changes shape, update `HANDOFF.md` §2–§4 and re-snapshot.
