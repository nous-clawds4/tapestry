# Epic: Communities — Circles as Definitions

**Status:** Active
**Created:** 2026-06-05
**Source:** product-team PRD `product-team/prd/communities.md` + `product-team/stories-queue.md` (Block 1). Companion guides: `product-team/guides/communities-design-guide.md`, `communities-style-guide.md`.

## What this is
Block 1 of the Communities MVP: a circle is a **declared definition** anyone can read and (later) stand on — founded, viewed, and discovered. This is the first block of the "right way" Communities product (the trust-based, no-owner model), and the **end-to-end proof** that a circle can exist as a definition rather than an admin-owned roster.

## Architecture stance (resolved Q#2 — strangler, not rewrite)
New Community-Declaration circles are built as **new code paths inside the existing `ui-communities` surface**, alongside the **frozen bespoke model** (kind-39999 community-records + endorse/veto membership). The bespoke circles keep working untouched; new founding flows to the Declaration model. Convergence (retiring the bespoke membership path) happens when Phase-2 trust membership lands. **No big-bang data migration** of existing circles. The Architect formalizes the coexistence seam in the first story's ADR.

## Stories (`stories/communities-declaration/`)
- **33 — found-a-circle** (declare a circle + land in it; the demo milestone). **Done** (PASS).
- **34 — view-a-circle** (read-only detail: belonging-bar + "Based on ‹parent›"). **Done** (PASS).
- **35 — discover-circles** (read-only grid; CD discoverability via the Story 33 union). **Done** (PASS).

**Block 1 complete.** Carry-forward: NB-1 (CD conversation post-addressing) → Story 8.

### Block 2 — Forking & resolved definitions (folded into this epic)
The queue suggested a separate `communities-inheritance` slug; folded here because the work is tightly coupled to Declarations (same modules, same projection).
- **36 — resolved-definition-resolver** (client-side §26 resolver — the substrate Block 2 consumes; ADR 0028 code). **Done** (PASS, 7/7).
- **37 — fork-a-circle** (stand on a parent's resolved definition; `b` tag; live inheritance of unedited fields). **Done** (PASS, 6/6).
- **38 — inherited-field-display** (show inherited vs overridden, live). **Done** (PASS, 5/5).

**Block 2 complete.** Carry-forward: inheritance markers beyond the belonging-bar; resolver caching (ADR 0028); multi-parent fork UI.

## Dependencies / sequencing
- Block 1 unblocks everything; it has no upstream dependency.
- Block 2 (`communities-inheritance` — fork + resolved definition) and Block 3 (`communities-trust-signal`) depend on this block and can run in parallel after it.
- Substrate already ratified: §25 inherit-from + §26 Resolved Definition (ADR 0027/0028). The fork story (Block 2) consumes them; founding (this block) does not, but the Declaration shape should be forward-compatible with a `parent` field.

## ADRs
`decisions/communities-declaration/` — TBD (first: the Community-Declaration shape + the strangler coexistence seam).
