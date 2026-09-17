# ADR 0003: The `inherit-items` facet — a third `b` type for item inheritance

**Status:** Accepted
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-curation/3-inherit-items-facet.md`

## Context

A docs-mode story. The acceptance criteria, in short: **AC-1** register `inherit-items` (closed at
three values; fail-safe restated for facets; the "one question" gains the facet's question);
**AC-2** the resolved item set, v1 additive, over an items-deference closure; **AC-3** it is a
candidate set, trust-filtered at read time; **AC-4** facets are independent; **AC-5** aggregation
weight, discovery walks, and the affiliation / reach / stamping standing stated; **AC-6** the
derived relationship, target and honest status; **AC-7** worksheet W6 narrowed; **AC-8** the
cross-references (assistant-designation § Per-DList, BIBLE `:1546` and `:1630`, README row,
handoff D10); **AC-9** the 39999 lookup-rule gap settled one way; **AC-10** this ADR.

**The registry today** (`protocols/drafts/inherit-from.md` § "The `b` tag", `community-reference`
ADR 0029): `pointer` (correspondence, no deference; the absent-type default) and `inherit` (live
definitional deference with field-level override). "Closed at two values; new values require a new
ADR." Type-gating is on the explicit string: derivation (`src/api/neo4j/eventSync.js:271`,
`tag[2] === 'inherit'`), the definition walk (`type == "inherit"` in the pseudocode), and the
stamping rule (`src/lib/bValueForms.js:78` — "inherit (or future types) never stamp"). So an unknown
third value already reads as `pointer` everywhere it matters. That fail-safe is the property that
makes a facet safe to add.

**What is deferred.** § Scope (v1): "The set-valued override algebra — how a child adds/removes/
replaces individual *elements* of an inherited set — is explicitly deferred to the first consumer
that needs it, tracked as worksheet W6; when designed, it operates over the inherit-typed deference
closure only." Story 2's header contract is that consumer: the assistant-authored header must say
"my list's items are the community list's items, plus my own" — live and parent-authoritative
(the `inherit` posture), but over items, which `inherit` does not cover, and unlike the family
table's IMPORT row (snapshot; importer authoritative; implies `IS_A_SUPERSET_OF`).

**Consumers of the derived relationship.** Grep-verified this session: no code outside the emitter
reads `INHERITS_FROM`. The consumers are the *specs*: `shared-concepts.md` § deference aggregation
("a target's incoming `INHERITS_FROM` edges enumerate exactly everyone who defers to this
definition"), the reach table ("Deference closure — inherit-typed only"; "Reach — both types"), and
`communities.md` (inherit-typed `b` = definition inheritance). Whatever form the items edge takes
must keep those sentences true, or amend them.

**Affiliation is pointer-only by design.** `shared-concepts.md` § Declared affiliation: an author
affiliates by carrying a *pointer-typed* `b`; affiliation is "navigation, not agreement"; only
pointer targets are selected for stamping (`bValueForms.js:73-80`). An `inherit`-typed tag has never
implied affiliation. The facet must take a position on this, because the assistant header of story
2 carries only the facet tag as specified.

**The 39999 gap (review #2, NB-3).** `assistant-designation.md` § "Dual-author lookup and
precedence" is written for kind-39998 headers ("Its subject is kind-39998 headers; this spec does not
redefine item (kind-39999) authorship"), while the per-DList section admits kind 39999 (the DList
NIP's open direction) and its Precedence paragraph says "`<kind>:<owner>:<d-tag>`". A
39999-declared header has no lookup rule.

**Concept orientation.** No concept, schema, or property changes. Nothing emits `inherit` today
(grep over `src/` and `ui/src/`); this is the registry's first extension since ADR 0029.

## Options considered

### Option A — A facet as a registry *type*: `inherit-items` (chosen)

Element 3 gains a third value. The prefix `inherit-` is the deference family; `inherit` alone keeps
its meaning (definition fields); `inherit-items` is the items facet; future facets, if any, follow
the same `inherit-<facet>` form, each by its own ADR.

- **Pros.** Fail-safe by construction: every existing reader gates on the exact string `inherit`,
  so an `inherit-items` tag reads as `pointer` in a reader that predates it — under-deference,
  never accidental deference. Mixing types on one event is already allowed, so "inherit the fields
  *and* the items" is two tags to the same target, composed by the reader per type. Grep-able on
  the wire. No new letter (worksheet W2 untouched).
- **Cons.** The registry grows by one per facet; readers learn one more string.

### Option B — One type `inherit`, facets listed in element 4: `["b", <target>, "inherit", "items"]`

- **Pros.** One type; facets are data.
- **Cons.** **Fail-unsafe.** A reader that predates element 4 reads `inherit` and applies full
  definition deference to a tag that meant items only — exactly the "silently subscribes its author
  to someone else's future edits" hazard the fail-safe default exists to prevent. Rejected.

### Option C — Compound values: `inherit-all` (and friends)

- **Pros.** One tag for "everything".
- **Cons.** "All" means the union of the facets *a given reader knows*, so the same tag means
  different things to different readers as facets are added — a meaning that drifts with reader
  version is not a wire contract. Multiple tags, one per facet, already compose. Rejected; the
  spec says explicitly that no `inherit-all` exists.

### Option D — A new single-char tag for item inheritance (e.g. `i`)

- **Pros.** Relay-indexable by tag name.
- **Cons.** Spends a letter from the single-char registry (W2) on what is a *type* of an existing
  relationship; splits the deference family across two tags; the type element was designed for
  exactly this extension. Rejected.

### Sub-decision 1 — Derived relationship: distinct type vs a property on `INHERITS_FROM`

- **Property** (`INHERITS_FROM {facet:'items'}`): one relationship type. **Con:** every consumer of
  "incoming `INHERITS_FROM` = definition deference" — the aggregation sentence, the reach table,
  and any future `MATCH ()-[:INHERITS_FROM]->()` — silently starts counting item deference as
  definition deference unless it filters on the property. That is the `REFERENCES`/`source`
  collision contract all over again (BIBLE §22), created on purpose.
- **Distinct type** `(child)-[:INHERITS_ITEMS_FROM]->(parent)` (chosen): asserted, canonical, no
  `source`, child→parent, no flip — a sibling of `INHERITS_FROM` with the same posture. Every
  existing sentence about `INHERITS_FROM` stays true with no filter; a bare match on it still means
  definition deference. Cost: one more relationship type in the graph schema, added when the
  derivation is updated (a code follow-up, not this book).

### Sub-decision 2 — Affiliation, reach, and stamping standing

- **Facet implies affiliation.** Rejected: affiliation would arrive as a side effect of a deference
  declaration, and `shared-concepts.md` deliberately separates navigation (pointer) from deference
  (inherit family). It would also require changing the stamping rule.
- **Facet is deference-family only** (chosen): `inherit-items` is not a declared affiliation and
  does not stamp; it *is* a correspondence claim for discovery walks; it *does* enter **reach**
  (which becomes "every type", not "both"); it is **not** in the definition deference closure and
  carries **no** deference-aggregation weight. An author who also wants declared affiliation carries
  a `pointer` `b` to the same target alongside — two tags, mixed types, already legal.

### Sub-decision 3 — The 39999 lookup rule: scope vs generalize

- **Generalize** the dual-author rule to `<kind>`: tempting, but the rule's own text excludes
  kind-39999 *items*, and nothing in the corpus yet distinguishes a 39999-declared *header* from a
  39999 item except its role. Generalizing now would define precedence for objects whose authorship
  model the DList NIP has not settled.
- **Scope** (chosen): the per-DList Precedence paragraph applies the dual-author rule to
  kind-39998 headers; for a 39999-declared header the per-DList entry names the assistant's header
  directly (no lookup is needed to *find* it) and personal-versus-assistant precedence is **not yet
  defined** — recorded as open, to be settled when the DList NIP settles 39999-declared headers.

## Decision

We chose **Option A** with sub-decisions **distinct type**, **deference-family only**, and
**scope to 39998**. Ratified semantics — the spec sections mirror these, in spec voice:

1. **Registry.** Element 3 is one of a closed **three**-value registry: `pointer`, `inherit`,
   `inherit-items`. New values require a new ADR. An absent or **unknown** element 3 reads as
   `pointer`. Derivation, resolution, and every other reader gate on the **explicit** strings
   `inherit` and `inherit-items`, never on "not pointer". There is no `inherit-all`.
2. **`inherit-items`.** Live, parent-authoritative deference over the parent's *items*: "my list's
   items are this parent's items, plus my own." The "one question" for choosing it: *when they add
   an item, should it appear in yours?* Yes → `inherit-items`.
3. **Resolved item set (v1, additive).** A node's resolved item set is the union of its own items
   and the resolved item sets of every parent named by its `inherit-items` tags, walked transitively
   over the **items-deference closure** (followed through `inherit-items` tags only; `inherit` and
   `pointer` tags are invisible to it), with a visited-set keyed on a-tag bounding cycles, computed
   on read and never snapshotted. Order among multiple `inherit-items` parents is not load-bearing
   (set union). Removal and replacement of inherited items are **not defined** in v1 — a child
   cannot subtract from what it inherits; W6 stays open for that.
4. **A candidate set, trust-filtered at read time.** Item inheritance changes *which* items a reader
   considers, never whether they are trusted: every contributing item is still filtered by the
   observer's point of view (the item author's trust), per Shared Concepts' observer-relative rule.
5. **Facets are independent.** `inherit-items` inherits no definition fields; `inherit` inherits no
   items. Both may be carried to the same target (two tags). The definition walk's filter stays
   `type == "inherit"` exactly; the definition deference closure and affiliation-via-closure are
   unchanged.
6. **Policy-layer standing.** `inherit-items` carries **no** deference-aggregation weight (deference
   aggregation counts `inherit` only); it counts in **discovery walks** and in **reach** (both of
   which now read "every type"); it is **not** a declared affiliation and does not select stamp
   targets — an author wanting affiliation carries a `pointer` `b` alongside.
7. **Derived relationship.** `(child)-[:INHERITS_ITEMS_FROM]->(parent)` — asserted, canonical, no
   `source`, child→parent, not flipped. `INHERITS_FROM` is untouched and still means definition
   deference. **Status today:** the reference deployment's derivation gates on the literal
   `inherit`, so an `inherit-items` tag derives the pointer form (`REFERENCES {source:'b-tag'}`)
   until the derivation is updated — a code follow-up outside this book, recorded in intake.
8. **Trust-coupling** applies to items exactly as to fields: inheriting items means inheriting the
   parent's future additions; the escape hatches are the same (re-publish the tag: a different
   parent, downgrade to `pointer`, or detach).
9. **Kinds and the 39999 gap.** `inherit-items` is defined for kinds 39998 and 39999 like the rest
   of the tag. In `assistant-designation.md`, the per-DList Precedence paragraph is scoped to
   kind-39998 headers; for 39999-declared headers, precedence is recorded as not yet defined.

## Consequences

- **Enables** story 4: the assistant-authored header carries `["b", <community a-tag>,
  "inherit-items"]` exactly, and story 2's "typed per the registry" sentence now names it.
- **Constrains.** The `inherit-` prefix is the deference family's namespace; `INHERITS_ITEMS_FROM`
  is a reserved relationship name in the consuming deployment's schema.
- **A gap, stated on purpose.** Curated items under an `inherit-items` header are, in v1,
  discoverable only under that header (no affiliation, no stamps) unless the author also carries a
  pointer `b`. Whether the later curation feature adds one is that feature's decision, not this
  ADR's.
- **Debt recorded, not created.** The derivation code (`eventSync.js`) and any resolver of item
  sets are future code; the resolved-definition cache (ADR 0032) triggers on `inherit` only and is
  not asked to watch the facet. W6 narrows to removal/replacement.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

Docs-mode. Exactly these edits, mirroring the Decision in spec voice; rationale points here.

1. **`protocols/drafts/inherit-from.md`**
   - § "The `b` tag": the table gains a row (`inherit-items` → inherit-items (item inheritance,
     additive) → child claims a parent whose items it inherits → `(child)-[INHERITS_ITEMS_FROM]->(parent)`);
     "closed two-value registry" → three-value; a third bullet defining `inherit-items` with its
     example (`["b", "39998:<community>:dogs", "inherit-items"]` — "my `dogs` list inherits the
     community list's items, plus my own"); the "one question" paragraph gains the facet's question;
     the "Future type values … require a new ADR" sentence stays; add the fail-safe restatement
     (absent **or unknown** type reads as `pointer`; gate on explicit strings) and "there is no
     `inherit-all`".
   - § "Multi-parent semantics": order is load-bearing among `inherit` tags only; `inherit-items`
     parents union (order-free).
   - § "The derived relationship": third bullet for `INHERITS_ITEMS_FROM`; the gate sentence names
     both explicit strings.
   - § "Resolution: the resolved definition": one sentence that the definition walk follows
     `inherit` tags only and that `inherit-items` tags are invisible to it and to the definition
     deference closure.
   - New § **"Resolution: the resolved item set"** after it: Decision §§3–5 with a short pseudocode
     block mirroring the definition walk (`for parent in node.b-tags where type == "inherit-items"`,
     union, visited-set), the candidate-set / trust-filter sentence, and the removal/replacement
     deferral.
   - § "Scope (v1)": three values; the W6 sentence becomes "the additive case is specified above;
     removal/replacement of inherited items remains deferred (W6)".
   - § "Security considerations": one sentence extending trust-coupling to items (Decision §8).
   - § "Place in the editorial-relationship family": a row for `inherit-items` (defer over items;
     parent stays authoritative; live; additive, no override in v1; implies `IS_A_SUPERSET_OF`? no —
     item inheritance is deference, not containment).
2. **`protocols/drafts/shared-concepts.md`**: § Declared affiliation — one sentence: inherit-family
   types (`inherit`, `inherit-items`) never affiliate; § deference aggregation bullet — "counts
   `inherit`-typed edges only … `inherit-items` and `pointer` edges carry zero weight"; § discovery
   walks bullet — "every type"; the reach table's Reach row — "every type"; the Deference-closure row
   — "`inherit`-typed only (not `inherit-items`)".
3. **`protocols/drafts/assistant-designation.md`** § "Per-DList curation entries": the header-contract
   bullet names the type: `["b", "<community header a-tag>", "inherit-items"]` ("the reference
   deployment writes `inherit-items` — [Inherit-From](./inherit-from.md) § registry; a writer MAY
   add a `pointer` `b` to the same target for declared affiliation"); the worked example's `<type>`
   becomes `inherit-items`; the Precedence paragraph scoped per Decision §9 with the 39999 note.
4. **`BIBLE.md`**: `:1546` glossary row — registry `"pointer"` \| `"inherit"` \| `"inherit-items"`;
   `:1630` §25 pointer sentence — the registry enumeration and a status clause (derivation gates on
   `inherit`; `inherit-items` derives the pointer form until updated — `dlist-curation` ADR 0003);
   bump the `Last updated` header with a chained content note (harness-lint L9 is commit-dated —
   OPEN.md row 238).
5. **`protocols/README.md:57`** — inherit-from row scope phrase: "Inherit-From & Resolved Definition
   (`b`; type registry incl. `inherit-items`)"; last column adds "`dlist-curation` #3".
6. **`protocols/worksheet.md`** W6 — status line and body: first consumer arrived (`dlist-curation`
   ADR 0003); additive case specified; removal/replacement remains the open part.
7. **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`** — § 1 after D9: **D10 — the `inherit-items`
   facet** (Decision §§1–2, 6, 7 in four bullets; rejected B/C/D one line each); § 3's W6 row
   updated; status stays 🔴 OPEN.
8. **`engineering-team/stories/_intake.md`** — one entry: "derivation + resolver for
   `inherit-items` (`eventSync.js` `INHERITS_ITEMS_FROM`; item-set resolution) — code follow-up
   outside the dlist-curation book; not picked up."
9. `communities.md` — unchanged (its `inherit` wording stays accurate).

No `test/` changes; the Reviewer runs the doc-reading suites and harness-lint (L9 after commit).

## Out of scope

- Removal/replacement algebra; other facets; `inherit-all`.
- The derivation and resolver code; the ADR 0032 cache's trigger set.
- Communities: item inheritance of a Community Declaration's members.
- Whether the later curation feature adds a pointer `b` for affiliation.
