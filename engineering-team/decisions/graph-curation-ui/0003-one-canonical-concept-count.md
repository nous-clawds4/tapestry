# ADR 0003: One canonical element/set count for the concept page, computed once

**Status:** Accepted
**Date:** 2026-09-09
**Story:** `engineering-team/stories/graph-curation-ui/3-count-concepts-as-elements.md`

## Context

The concept detail page shows a concept's element count twice, from two independently written
queries, and both are wrong in different ways. Measured against the live graph 2026-09-09:

| Concept | header | Overview | correct |
|---|---|---|---|
| firmware concept | **0** | 37 | 37 |
| concept header | **0** | 44 | 44 |
| word | 538 | **0** | 582 |
| validation tool | 57 | **0** | 57 |
| graph | 173 | **132** | 173 |
| set | 137 | **111** | 137 |
| property | 70 | **57** | 70 |
| nostr relay | 12 | 12 | 12 |

Seven of thirteen concepts checked disagree. The two queries differ on **two independent axes**:

- **The label predicate.** `ui/src/pages/concepts/ConceptDetail.jsx:52` matches
  `-[:HAS_ELEMENT]->(elem:ListItem)`. An element that is itself a concept carries
  `ListHeader, ConceptHeader` and never `ListItem`, so concepts-as-elements are invisible to it.
  That is the `0`s in rows one and two.
- **The traversal direction.** `ui/src/pages/concepts/ConceptOverview.jsx:15` matches
  `(sup)<-[:IS_A_SUPERSET_OF*0..5]-(container)`, arrow reversed. ADR
  `relationship-primitives/0001` fixes the direction of a placement edge as parent-first —
  `(set)-[rel]->(node)` — so the Overview never walks *into* the set tree. At zero hops
  `container` is the superset itself, which is why it silently degrades to "direct members
  only" instead of erroring. That is the `0` for `word` (582 elements under 47 sets) and for
  `validation tool`.

`ui/src/pages/concepts/ConceptList.jsx:24` gets both axes right and is the de-facto correct
implementation. It is not on this page.

**`setCount` has the identical direction bug**, one line below, at
`ConceptOverview.jsx:16`. Measured: `word` reports **1** set against 48; `nostr relay` **2**
against 14; `graph` **2** against 5. The story's acceptance criteria name only the element
count, so including this is a scope decision flagged for the gate rather than assumed — but
correcting the element line and leaving the set line reversed, one line apart in the same query,
would be indefensible.

**Constraints established by inspection, not assumption:**

- **Outlet context already exists.** `ConceptDetail.jsx:301` renders
  `<Outlet context={{ concept, uuid: decodedUuid }} />`, and `ConceptOverview.jsx:8` already
  destructures `const { concept, uuid } = useOutletContext()` — then ignores
  `concept.elementCount` and computes its own. The channel for sharing one number is built and
  in use; the Overview simply does not use it for this.
- **`useCypher` cannot pass parameters.** `ui/src/hooks/useCypher.js:20` calls `cypher(query)`
  with one argument. The underlying `ui/src/api/cypher.js:17` helper *does* accept params, and
  its own docstring warns that interpolating a handle like `…:set` trips the server's
  write-keyword guard on `\bSET\b`. That hazard is real but **out of scope here** — see
  "Out of scope".
- **Test harness.** No jsdom (ADR `graph-curation-ui/0001`). Verification is executed pure ESM
  plus source-level assertions. A query that lives inside a component template literal cannot be
  executed by the runner; one exported from a plain module can.
- **Concept orientation** (AGENTS.md §2–3): `/summaries` (63 concepts), `/neighbors` on the
  relevant supersets. **No concept definition changes → no firmware reinstall.**
- **ADR conflict check:** consistent with `relationship-primitives/0001` (this ADR *applies* its
  direction rule rather than changing it) and with `graph-curation-ui/0001` and `0002`. Nothing
  superseded. `0002`'s finding that near-duplicate logic drifts is the direct precedent for the
  choice below.

## Options considered

### Option A — Fix both queries in place

Change `:ListItem` to `:NostrEvent` in the header; reverse the two arrows in the Overview.
Three line edits, nothing moves.

**Pros:** smallest possible diff; no new module; no structural change.
**Cons:** leaves **three** independent copies of the traversal rule (header, Overview,
ConceptList), which is precisely the configuration that produced this bug — and the
configuration ADR 0002's review flagged as recurring (NB-1: seven copies of one helper, one
already diverged). AC-1 ("both surfaces show the same number") would hold only because two
separately-maintained queries happen to agree today; nothing prevents the next edit to one of
them. And the rule stays inside component template literals, where the runner cannot execute it,
so the story's measured expectations can only be asserted at source level.

### Option B — Shared query fragment, still two queries

Extract the counting Cypher into a pure module both pages import, each still running its own
query.

**Pros:** one definition of the rule; executable.
**Cons:** two queries still run and are still separately assembled; they agree by shared
ingredient rather than by construction. Strictly more machinery than Option C for a weaker
guarantee.

### Option C — Compute once in the parent, share via the existing outlet context *(chosen)*

`ConceptDetail` computes element and set counts using a rule exported from a pure module, and
passes them down the `<Outlet context>` it already provides. `ConceptOverview` **deletes** its
own element/set counting and reads the numbers it is already being handed.

**Pros:** AC-1 stops being something to test and becomes **structurally true** — there is one
number, so two surfaces cannot disagree, now or after any future edit. This *removes* a query
rather than adding a module. The rule lives in one importable, side-effect-free place, so the
Tester can execute it against the live graph and check the story's measured values
(`firmware concept` 37, `word` 582, `nostr relay` 12 unchanged) rather than grepping JSX.
**Cons:** `ConceptOverview` keeps a query for its other fields (names, description,
`propertyCount`), so this does not delete it outright — only the counting clauses. It couples the
child's numbers to the parent's fetch, which is the intent but is a real coupling: if the parent
is wrong, both are wrong. That is the trade — one place to be wrong instead of two places to
disagree.

## Decision

**Option C**, with these sub-decisions:

1. **`ui/src/utils/conceptCounts.js` is pure and importable** — no React, no fetch. It exports
   the canonical counting Cypher for a concept, returning both `elementCount` and `setCount`,
   built on the corrected rule: from the concept's superset, forward
   `-[:IS_A_SUPERSET_OF*0..5]->`, elements matched as `:NostrEvent`. This is the property that
   makes the story's numbers executably testable.
2. **`ConceptOverview` stops counting.** It reads `elementCount` and `setCount` from outlet
   context. Deleting that computation — rather than correcting it — is what makes the two
   surfaces incapable of disagreeing.
3. **`setCount` is corrected in the same change.** Same defect, same query, adjacent line;
   `word` currently claims 1 set and has 48. Flagged at the gate as a scope extension beyond the
   story's literal criteria.
4. **Interpolation stays; parameters are not introduced here.** See below.

**What we trade away:** a three-line edit becomes a small module plus a parent/child data flow.
We accept that in exchange for the page's two numbers being one number, and for the counting
rule being executable by a test runner that cannot mount React.

## Consequences

- **Enables:** an executed test of the actual counting rule against the live graph, instead of a
  source-level grep; one place to change the rule when the graph model evolves.
- **Constrains:** `ConceptOverview` now depends on its parent route supplying counts. It must
  degrade legibly if the parent has not resolved yet (the existing `?? 0` render path already
  covers an absent value, but the Implementer must not let "loading" read as "zero" any more
  than today's query does).
- **Does not fix:** `ConceptList.jsx:24` keeps its own correct-but-separate copy of the rule.
  Folding it in is a candidate follow-up, not this story — it is a third page and would widen
  the diff past the story's scope. Recorded, not scheduled.
- **Does not fix:** `/api/concept-graph/summaries`, which has the same direct-only defect and is
  story `graph-curation-ui` #4. After this ADR ships, the page and that endpoint will *disagree*
  until #4 lands — a known, deliberate intermediate state, and the reason #4 exists.
- **Firmware reinstall required?** **No.** No concept definitions change.
- **Deploy note:** UI-only, so `npm --prefix ui run build` then
  `docker cp dist/. tapestry:/usr/local/lib/node_modules/brainstorm/dist/` (OPEN.md row 226 —
  the container has no bind mount, contrary to CLAUDE.md).

## Implementation notes

- **New file: `ui/src/utils/conceptCounts.js`** — pure ESM, no imports. Export a builder that
  takes a concept header uuid and returns Cypher yielding `elementCount` and `setCount` for that
  concept. The rule, stated once: start at the concept's `:Superset` via `IS_THE_CONCEPT_FOR`,
  walk `-[:IS_A_SUPERSET_OF*0..5]->` **forward**, count `DISTINCT` nodes reached by
  `-[:HAS_ELEMENT]->` matched as `:NostrEvent` for elements, and count `DISTINCT` nodes on the
  superset walk itself for sets. Match `ConceptList.jsx:24`'s semantics, which is the
  implementation already known correct.
- **`ui/src/pages/concepts/ConceptDetail.jsx:50-57`** — take the element count from the shared
  builder instead of the inline `:ListItem` match, and surface `setCount` alongside it.
  `:301` — extend the outlet context with the counts so children receive them.
- **`ui/src/pages/concepts/ConceptOverview.jsx:12-24`** — remove the `elem` and `setNode`
  `OPTIONAL MATCH` clauses and their two `count(DISTINCT …)` projections; keep the rest of the
  query (names, description, `createdAt`, `propertyCount`) unchanged. `:69` and the SETS row
  render the values from context.
- **No server-side change.** No concept-graph endpoint is touched.
- **No change to `useCypher`.**

## Out of scope

- **Introducing query parameters.** `ui/src/api/cypher.js:9-15` documents that interpolating a
  handle containing a write keyword — the concept named `set`, handle `…:set` — matches the
  server's `\bSET\b` guard. Verified 2026-09-09: an **unauthenticated** request for that
  concept's query returns 403, while the owner-authenticated page renders normally (Elements
  137), because the guard's rule is "write queries require owner authentication." So this is a
  latent hazard for unauthenticated readers, **not** a break in the owner flow, and it predates
  this story. Fixing it means wiring params through `useCypher` (`:20`), which has 67 call
  sites, on a story about counting. Deliberately left alone; worth its own OPEN.md row.
- **`ConceptList`'s copy of the rule**, and every other surface that counts elements.
- **The summaries endpoint** — story #4.
- **Adding a separate "direct members" figure.** The operator ruled direct-only counting a bug,
  not a second metric.
