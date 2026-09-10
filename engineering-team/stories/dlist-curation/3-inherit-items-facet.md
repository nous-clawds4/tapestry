# Story 3: The `inherit-items` facet — item inheritance in the `b` type registry

**Status:** Approved
**Created:** 2026-09-10
**Type:** Doc *(wire-format irreversibility trigger → full ADR + Standard docs-mode phases; Test
Design skipped per workflows/protocol-spec-workflow.md)*

## Background
The `b` tag's type registry (`protocols/drafts/inherit-from.md`, `community-reference` ADR 0029)
is closed at two values: `pointer` (correspondence, no deference) and `inherit` (live deference
over a node's *definition fields*, with field-level override). The set-valued question — how a
child adds to or removes from an inherited *set of items* — was explicitly deferred "to the first
consumer that needs it" (worksheet W6). This book is that consumer: the assistant-authored header
of story 2 must say "my list's items are the community list's items, plus my own" — live,
parent-authoritative, over items — which is neither today's `inherit` (fields) nor the family
table's IMPORT posture (a snapshot the importer owns). Story 2's spec section names the registry
but no type; this story registers the facet and names it there.

The design was settled at kickoff (2026-09-09/10; `engineering-team/epics/dlist-curation.md`
§ "Settled at kickoff"): one facet now, `inherit-items`; no `inherit-all`; `inherit` keeps its
meaning; unknown types keep reading as `pointer`; the v1 item algebra is additive; the facet
carries no definition-deference weight; the derived relationship records the facet. Nothing in the
codebase emits `inherit` today, so this is also the registry's first extension since ADR 0029.

## User-facing description
As an author of a DList header (a person, or a Tapestry Assistant acting on a user's say-so), I
want a `b` type that says "this list inherits that list's items, and I add my own", with resolution
rules any reader applies the same way, so that a curated list can build on a community list without
re-declaring items the community already holds — and so that readers who do not know the facet
degrade safely to "corresponds to" rather than to accidental deference.

## Acceptance criteria
- [ ] **AC-1 (registry).** `inherit-from.md`'s type registry gains **`inherit-items`**: live,
      parent-authoritative deference over the parent's *items* — "my list's items are this
      parent's items, plus my own". The registry reads "closed at three values"; new values still
      require an ADR. The fail-safe is restated for facets: an absent or **unknown** type reads as
      `pointer`, and derivation gates on the explicit strings `inherit` / `inherit-items`, never on
      "not pointer". The "one question" guidance gains the facet's question.
- [ ] **AC-2 (item resolution, v1 additive).** The section defines a node's **resolved item set**:
      the union of its own items and the resolved item sets of the parents it defers to with
      `inherit-items`, walked transitively over the **items-deference closure** (followed through
      `inherit-items` tags only; `inherit` and `pointer` tags are invisible to it), visited-set for
      cycles, computed on read and never snapshotted. Order among multiple `inherit-items` parents
      is not load-bearing (set union). Additive only: removal and replacement of inherited items
      are deferred, and the section says so.
- [ ] **AC-3 (composition with trust, not instead of it).** The section states that the resolved
      item set is a *candidate* set: every contributing item is still filtered at read time by the
      observer's point of view (its author's trust, per the observer-relative rule in Shared
      Concepts), so item inheritance changes *which* assertions a reader considers, never whether
      they are trusted.
- [ ] **AC-4 (facets are independent).** `inherit-items` inherits no definition fields and
      `inherit` inherits no items; a node may carry both, to the same target or different ones;
      the definition-resolution walk's filter stays `type == "inherit"` exactly; the definition
      deference closure and affiliation semantics are unchanged.
- [ ] **AC-5 (aggregation and affiliation).** The specs state how the facet reads in the policy
      layer: `inherit-items` carries **no** definition-deference weight (deference aggregation still
      counts `inherit` only); it is a correspondence claim for **discovery walks** (both bullets in
      `shared-concepts.md` § deference aggregation / discovery walks are amended or pointed);
      and its standing for **declared affiliation, reach, and stamping** is stated explicitly (today
      only pointer-typed tags stamp — `src/lib/bValueForms.js:78`; the ADR decides whether an
      `inherit-items` header is affiliated by itself or carries a `pointer` `b` alongside).
- [ ] **AC-6 (derived relationship — target and status).** The section specifies the derived
      relationship for an `inherit-items` tag (form chosen by the ADR — e.g. `INHERITS_FROM` with
      a facet property, or a distinct relationship) and states the deployment status honestly: the
      reference deployment's derivation type-gates on the literal `inherit`
      (`src/api/neo4j/eventSync.js:271`), so an `inherit-items` tag derives the *pointer* form until
      the derivation is updated — a code follow-up outside this book, recorded.
- [ ] **AC-7 (worksheet W6).** W6 is updated: the first list-bearing consumer arrived; the additive
      case is specified in `inherit-from.md` § Scope; removal/replacement stays open (entry narrowed,
      not closed).
- [ ] **AC-8 (cross-references).** `assistant-designation.md` § "Per-DList curation entries" names
      `inherit-items` as the type the reference deployment writes (replacing "ratified separately");
      BIBLE's two registry enumerations (`:1546` glossary row, `:1630` §25 pointer) list the third
      value; `protocols/README.md`'s inherit-from row's scope phrase covers facets;
      `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` gains D10 (status stays 🔴 OPEN); `communities.md`
      is untouched unless its `inherit` wording becomes inaccurate.
- [ ] **AC-9 (39999 lookup rule — carried from review #2).** The per-DList precedence sentence and
      the dual-author lookup rule in `assistant-designation.md` agree on kinds: either the lookup
      rule is extended to `<kind>` generically or the per-DList sentence is scoped to 39998. The
      ADR decides; the spec says one thing.
- [ ] **AC-10 (ADR).** ADR 0003 (full form) Accepted at
      `engineering-team/decisions/dlist-curation/0003-<slug>.md`, recording at least: facet-as-type
      vs a facet list in element 4 vs `inherit-all`; the aggregation-weight decision; the
      derived-edge form; the affiliation/stamping standing; the naming.

## Concepts touched
None — protocol prose, ADR, pointers. No concept-graph change, no firmware reinstall.

## Out of scope
- Removal and replacement of inherited items (W6 remains open for those).
- Other facets (`inherit-header`, `inherit-subsets`, `inherit-json-schema`) and `inherit-all`.
- The derivation code change (`eventSync.js`) and any resolver — code, outside this book; the
  reference deployment writes the tag (story 4) but does not resolve it yet.
- The resolved-definition cache (`community-reference` ADR 0032) — inherit-typed trigger only;
  whether it should watch `inherit-items` is that design's follow-up.
- Communities: whether a Community Declaration may `inherit-items` its parent's members is the
  communities protocol's question, not answered here.

## Open questions
None the PO holds — the settled points are in the epic. Decision points reserved for the ADR: the
derived-edge form (AC-6), the affiliation/stamping standing (AC-5), and the 39999 lookup rule
(AC-9).

## Deviations
- **Two sentences beyond the ADR's edit list, same claims.** The derived-relationship
  "Direction" paragraph said "for either type" — now "for every type"; and the multi-parent
  paragraph gained the clause that `"inherit-items"` parents union order-free (the ADR listed the
  multi-parent edit but not the direction one). Both follow from Decision §§3 and 7.
- **BIBLE header bumped in the same commit** (lesson from story 2, OPEN.md row 238): same date,
  chained note.
- **Regression scope.** Docs-mode; the nine suites that read the changed documents were run and
  pass; harness-lint clean. Full `npm test` not re-run (no code or test change; row 191).

## Linked artifacts
- ADR: `engineering-team/decisions/dlist-curation/0003-inherit-items-facet.md`
- Test plan: — (docs-mode; Test Design skipped per the protocol-spec variant)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
