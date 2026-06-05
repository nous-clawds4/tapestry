# Epic: Communities — Circles as Definitions

**Status:** Active
**Created:** 2026-06-05
**Source:** product-team PRD `product-team/prd/communities.md` + `product-team/stories-queue.md` (Block 1). Companion guides: `product-team/guides/communities-design-guide.md`, `communities-style-guide.md`.

## What this is
Block 1 of the Communities MVP: a circle is a **declared definition** anyone can read and (later) stand on — founded, viewed, and discovered. This is the first block of the "right way" Communities product (the trust-based, no-owner model), and the **end-to-end proof** that a circle can exist as a definition rather than an admin-owned roster.

## Architecture stance (resolved Q#2 — strangler, not rewrite)
New Community-Declaration circles are built as **new code paths inside the existing `ui-communities` surface**, alongside the **frozen bespoke model** (kind-39999 community-records + endorse/veto membership). The bespoke circles keep working untouched; new founding flows to the Declaration model. Convergence (retiring the bespoke membership path) happens when Phase-2 trust membership lands. **No big-bang data migration** of existing circles. The Architect formalizes the coexistence seam in the first story's ADR.

## Stories (`stories/communities-declaration/`)
- **33 — found-a-circle** (declare a circle + land in it; the demo milestone). *In planning.*
- view-a-circle (read-only detail) — *queued (Story 2).*
- discover-circles (read-only grid) — *queued (Story 3).*

## Dependencies / sequencing
- Block 1 unblocks everything; it has no upstream dependency.
- Block 2 (`communities-inheritance` — fork + resolved definition) and Block 3 (`communities-trust-signal`) depend on this block and can run in parallel after it.
- Substrate already ratified: §25 inherit-from + §26 Resolved Definition (ADR 0027/0028). The fork story (Block 2) consumes them; founding (this block) does not, but the Declaration shape should be forward-compatible with a `parent` field.

## ADRs
`decisions/communities-declaration/` — TBD (first: the Community-Declaration shape + the strangler coexistence seam).
