# ADR 0033: Three-PoV Resolution Standard (spec ratification)

**Status:** Accepted
**Date:** 2026-06-08
**Story:** `engineering-team/stories/pov-resolution/1-ratify-three-pov-standard.md`
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3 — Test Design skipped)

## Context
Tapestry computes trust metrics from several uncoordinated sources (Neo4j node props, Neo4j
live traversals, Meili `wot_*_<suffix>` documents, strfry kind-3). The same metric can read
differently per source/suffix. The staging failure (2026-06-07) — Jack's badge "26,711
Verified Followers" vs his /followers page "568" — was one instance; the fix already shipped
(profile #35/#36, ADR 0031/0032: Owner-PoV counts, badge==table, merged via PR #254). The
*standard* that prevents the whole class was settled in `docs/POV_RESOLUTION_DESIGN_HANDOFF.md`
(Status OPEN) and now needs to live in the canonical spec.

This ADR decides **how** to ratify that standard into `BIBLE.md` — not new behavior. The
deliverable is a new BIBLE section + the handoff-doc flip. No code, no concept/schema change.

Concept Graph API (localhost:8877) was unreachable (local stack down); this is pure spec, so
no handle resolution is required — but the new section's concept references (graperank,
nostr-user, web-of-trust) should be confirmed against `/api/concept-graph/summaries` when the
stack is up.

The hard constraint: **the section must not present unbuilt behavior as present.** The three
PoVs + source map + Following-on-strfry + the Owner naming correction are true today; the
sticky 3-way selector, the per-feature fallback chains, and freshness-as-availability are
*direction*, not fact.

## Options considered

### Option A — Inline per-subsection "Status:" tags
Write §27 as one flowing section; each subsection gets a `**Status: ratified**` or
`**Status: target**` tag inline.
- **Pros:** compact; status sits next to the claim.
- **Cons:** easy for a reader to skim past a tag and read a target as fact; the normative/
  aspirational boundary is diffuse; harder to audit "did we overclaim anywhere."

### Option B — Structural split: "The standard (ratified)" vs "Target direction (not yet built)"
§27 is divided into clearly-labeled blocks: (1) **The standard** — the normative core (three
PoVs, source map, Following-on-strfry, naming correction) stated as spec fact; (2) **Status
today** — what's actually wired (Owner badges shipped; search 2-way toggle; tables Owner-live);
(3) **Target direction** — the selection/persistence + fallback models + freshness, explicitly
flagged as not-yet-built; (4) **Open questions** — the §8 list, inline. Physical separation
*is* the normative/aspirational boundary.
- **Pros:** impossible to mistake target for fact — they're in different blocks under different
  headings; trivially auditable; matches how §25/§26 separate "what's defined" from "scope/
  deferred"; the spec stays self-contained (open questions inline) so the handoff doc can retire.
- **Cons:** slightly longer; one fact (e.g. the source map) is referenced from two blocks
  (standard + status) — mitigated by stating it once in "the standard" and having "status"
  point to it.

### Option C — BIBLE carries only the normative core; everything target/open stays in the handoff doc
Ratify just the three PoVs + source map into BIBLE; leave selection/fallback/open-questions in
the (kept-OPEN) handoff doc.
- **Pros:** smallest BIBLE change; cleanest normative core.
- **Cons:** the handoff doc can't retire (violates the workflow's "flip to SUPERSEDED once it
  lands"); the spec isn't self-contained — a reader must chase a `docs/` file for the direction;
  splits one topic across two homes. Rejected.

## Decision
**Option B.** A structurally-split §27 with four blocks — **The standard (ratified)**,
**Status today**, **Target direction (not yet built)**, **Open questions** — places the
normative/aspirational boundary in the document structure itself, makes overclaiming
auditable, keeps the spec self-contained, and lets the handoff doc retire (flip to SUPERSEDED).

## Consequences
- **Enables:** one canonical authority for PoV; future PoV stories (resolver, selector) cite
  §27; the handoff doc retires cleanly.
- **Constrains:** future PoV changes must update §27 (the cost of a single source of truth).
- **Follow-ups (deferred, tracked in the epic):** the §8 open questions become future
  pov-resolution stories; this ADR settles none of them.
- **Firmware reinstall required?** No — pure spec, no concept definitions changed.

## Implementation notes
Concrete, for the Implementer (docs-mode — BIBLE prose + the flip, nothing else):

- **File: `BIBLE.md`** — insert a new `## 27. Point of View (PoV) Resolution` **after §26
  (Resolved Definition, ends ~line 1743) and before the closing footer line**
  (`*This document is maintained…*`). Mirror §22/§25/§26 style: bold thesis lead, tables,
  normative language, ADR cross-ref at the end (`See ADR 0033…`). Four blocks:
  1. **The standard (ratified).** Lead sentence: every trust metric is computed relative to
     exactly one of three PoVs. The three-PoV table — columns **PoV | Whose web of trust |
     Source of truth | Availability** — with the rows from handoff §2 (Owner→Neo4j node props
     `influence`/`verified*Count`/`hops` + live traversals, always locally available;
     House→kind 30382 Trusted Assertions → Meili `wot_*_<houseSuffix>`, only if published/
     imported; Personalized→kind 30382 per-user → Meili `wot_*_<userSuffix>`, only if that
     user's assertions exist). Then two normative statements: **Following stays on strfry**
     (kind-3 p-tags), non-PoV, freshest, immune to the GrapeRank batch; and the **naming
     correction** — Neo4j-sourced grapevine data is **Owner**, not "House"; prior
     "House (default)" labels for Neo4j data were mislabeled.
  2. **Status today.** A per-surface **current state** table (Surface | Datum | Source today):
     profile Following → strfry; profile Verified Followers/Reporters → **Owner (Neo4j),
     shipped profile #35/#36 (ADR 0031/0032), badge==table**; /follows·/followers·/reporters
     tables → Owner live; search page → Meili, 2-way House↔Personalized toggle.
  3. **Target direction (not yet built).** Explicitly flagged. The selection/persistence model
     (one selected PoV per user, sticky across pages, a 3-way selector); the fallback model
     (attempt selected PoV → feature-specific fallback chain on unavailability); **freshness as
     part of availability** (stale/partial is a state, ideally surfaced, not silently degraded).
     Optionally a "target" column or a small current→target table folding in block 2.
  4. **Open questions.** Inline list from handoff §8: default PoV for anonymous users; resolver
     shape (endpoint vs shared module); freshness signaling mechanism; exact per-feature
     fallback chains; Personalized source; count=list-length guarantee per PoV.
- **File: `BIBLE.md` TOC** (~line 39) — add `27. [Point of View (PoV) Resolution](#27-point-of-view-pov-resolution)`.
  Verify the GitHub anchor resolves: "Point of View (PoV) Resolution" → `#27-point-of-view-pov-resolution`
  (lowercase, parens dropped, spaces→hyphens).
- **File: `docs/POV_RESOLUTION_DESIGN_HANDOFF.md`** — flip the `**Status:**` line to
  **✅ SUPERSEDED**, add a one-line pointer at top to `BIBLE.md §27`. **Keep the body** for
  history (per CLAUDE.md's HANDOFF convention: SUPERSEDED preserves the body). Do not trim.
- **Optional (nice-to-have, keep the change focused — skip if it widens the diff):** light
  one-line cross-refs to §27 from §11 (API Reference, `get-user-counts`) and §14
  (Configuration, `VERIFIED_*_INFLUENCE_CUTOFF`). Not required by any AC.

## Out of scope
- **All code** — no resolver, endpoint, selector UI, or preference store (future epic stories).
- **Deciding any §8 open question** — they are documented as open, not resolved.
- **Test Design** — skipped (docs-mode; no executable behavior). The only gates are `npm test`
  staying green and the Reviewer's accuracy/consistency audit.
- Changing cutoff values; report-type breakdown; pile-on discounting.
