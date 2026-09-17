# ADR 0004: Correct the summaries endpoint's element count, and guard the two surfaces with an equality test

**Status:** Accepted (Amendment 1 appended 2026-09-09 — setCount folded in; the original performance claim corrected)
**Date:** 2026-09-09
**Story:** `engineering-team/stories/graph-curation-ui/4-summaries-element-count.md`

## Context

`GET /api/concept-graph/summaries` is the first call of the orientation ladder (AGENTS.md §2–3):
the compact picture of the domain every agent session reads before touching anything. Its
`elementCount` counts only elements hanging **directly** off a concept's superset.

`src/api/concept-graph/index.js:32` — the whole defect:

```cypher
OPTIONAL MATCH (n)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:HAS_ELEMENT]->(e)
```

No `IS_A_SUPERSET_OF` walk, so nothing nested under a set is seen. Measured 2026-09-09:

| Concept | endpoint reports | actual |
|---|---|---|
| word | **0** | 582 |
| validation tool | **0** | 57 |
| graph | 132 | 173 |
| set | 111 | 137 |
| property | 57 | 70 |
| nostr relay | 12 | 12 |
| firmware concept | 37 | 37 |

The failure is worst where it misleads most: `word` is the largest concept in the graph and the
orientation endpoint calls it empty.

**Three constraints established by measurement, not assumption:**

1. **Performance is a non-issue — the corrected query is *faster*.** Run across all 57
   `ConceptHeader` rows: current **58.3 ms**, corrected **36.5 ms**. Adding the variable-length
   walk lets the planner start from a narrower set. The story's AC-5 concern about "response
   time … for an orientation call on the full graph" is answered, and answered the other way.
2. **The `:NostrEvent` label predicate is a no-op on this graph.** Counting `(e)` unlabeled and
   `(e:NostrEvent)` gives identical results for **every** concept — every element is a
   `NostrEvent`. The label is worth carrying anyway so the rule reads the same as the page's,
   but it changes no number and cannot be the source of a discrepancy.
3. **`src/` and `ui/` share no code today.** `src/` is CommonJS, `ui/` is `"type": "module"`,
   and a grep for cross-tree imports finds none in either direction. Any shared module would be
   the first such coupling in the repo.

**What must NOT change.** The story's AC-5 pins `setCount` as unchanged. Note the consequence,
because it is not obvious: the endpoint's `setCount` (`:33`) counts a **single** `IS_A_SUPERSET_OF`
hop, while the concept page counts `*0..5` including the superset itself. They already disagree
(`word`: endpoint 17, page 48; `firmware concept`: endpoint 0, page 1) and this ADR leaves that
alone. After this story, `elementCount` will agree across the two surfaces and `setCount` still
will not. That is the story's explicit boundary, flagged rather than quietly widened.

**ADR conflict check.** Applies the same rule ADR `graph-curation-ui/0003` established and
`relationship-primitives/0001` fixes the direction of. Nothing superseded. The tension with ADR
0002 is addressed head-on below.

## Options considered

### Option A — Fix the Cypher in place, and nothing else

Add the forward walk to `:32`. One clause.

**Pros:** minimal, obviously correct, no new surface, measurably faster.
**Cons:** produces a **third** independent copy of the counting rule — `ui/src/utils/conceptCounts.js`,
`ui/src/pages/concepts/ConceptList.jsx:24`, and now the server. That is exactly the configuration
ADR 0002's review flagged (NB-1: seven copies of one helper, one already silently diverged) and
exactly how this whole family of bugs was born. Nothing would catch the next divergence.

### Option B — Share one module across `src/` and `ui/`

Move the canonical rule somewhere both trees import — a dual-format file, or a dynamic `import()`
of the ESM module from the CommonJS handler.

**Pros:** structural single source; drift becomes impossible rather than merely detectable.
**Cons:** the two trees have **never** imported each other. Establishing that coupling — with a
CJS/ESM bridge, its build implications, and its load-order caveats in an async request handler —
is a substantial architectural precedent to set, and this story is a one-clause bug fix. The
cost is not the code; it is that every future contributor now has a cross-tree import to reason
about. Disproportionate here, and it should be decided on its own merits, not smuggled in.

### Option C — Fix in place, and add a cross-surface equality test *(chosen)*

Option A's one-clause change, plus a test that asserts, **for every concept in the graph**, that
the endpoint's `elementCount` equals the count produced by the page's canonical rule.

**Pros:** the drift ADR 0002 warned about becomes **loud instead of silent** — and the guard is
in some ways stronger than a shared constant, because it is behavioral: it catches divergence no
matter how either side is implemented, including a future rewrite of either query, and including
a change to only one of them. It sets no new architectural precedent, and the diff stays one
clause.
**Cons:** the two implementations do still exist separately; this makes drift *detected*, not
*impossible*. The guard also depends on a live stack, so it self-skips in a stack-free run —
meaning CI would not catch a divergence that only manifests against real data.

## Decision

**Option C.**

**On the tension with ADR 0002.** That ADR chose structural deduplication and its review found
five further copies still at large. It would be inconsistent to invoke "one definition" there
and shrug here — so the reasoning has to be explicit: in ADR 0002 both copies lived in the same
tree, in the same language, one import apart; deduplication cost nothing and removed a live bug.
Here the copies are separated by a module-system boundary the repo has never crossed. Paying a
novel cross-tree coupling to dedupe a five-line query is the wrong trade, and the equality test
buys the property we actually care about — that the two numbers can never quietly disagree.
If the repo ever grows a shared `common/` tree for other reasons, folding this in is a
one-line follow-up.

**Sub-decisions:**

1. **The corrected clause carries `:NostrEvent`.** It changes no number (measured), but it makes
   the server's rule read identically to the page's, so a reader comparing them sees one rule
   rather than two that happen to agree.
2. **`setCount` is untouched**, per AC-5 — including its single-hop shape. The resulting
   page/endpoint disagreement is recorded in Consequences and is a candidate follow-up.
3. **The equality guard is the Tester's deliverable**, not a code artifact: a live test that
   fetches `/api/concept-graph/summaries` and compares each `elementCount` against the canonical
   rule executed directly. Phase 3 owns its shape.

## Consequences

- **Enables:** the orientation ladder's first call stops describing the graph's largest concepts
  as empty. `word` 0 → 582, `validation tool` 0 → 57.
- **Faster, not slower:** 58.3 ms → 36.5 ms across all 57 concepts.
- **`elementCount` now agrees between the concept page and the endpoint** — the disagreement
  story #3 knowingly left open is closed.
- **`setCount` still disagrees** between them (`word`: 48 on the page, 17 from the endpoint;
  `firmware concept`: 1 vs 0), because AC-5 pins it. Deliberate, bounded, and worth its own row.
- **Two copies of the rule remain**, now guarded by an equality test rather than by construction.
  The guard is live-stack-only, so a stack-free CI run will not catch a data-dependent
  divergence. Stated so nobody mistakes green CI for proof.
- **No consumer breaks.** Verified during story #4's planning: nothing in the codebase reads this
  field — every other `elementCount` is a page computing its own. The consumers are agents and
  operators reading the endpoint, for whom the current value is simply wrong.
- **Firmware reinstall required?** **No.** No concept definitions change.
- **Deploy note:** server-side change, so `docker cp` the file and
  `docker exec tapestry supervisorctl restart brainstorm` (per `cycle-local`), unlike the
  UI-only stories before it.

## Implementation notes

- **`src/api/concept-graph/index.js:32`** — change
  `(n)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:HAS_ELEMENT]->(e)` to walk the set tree forward
  first: `(n)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(e:NostrEvent)`.
  `count(distinct e)` at `:34` is already correct and needs no change — the cartesian product
  with the `setCount` match cannot inflate a `DISTINCT` count.
- **`src/api/concept-graph/index.js:33`** — **leave alone.** The single-hop `setCount` is out of
  scope by AC-5.
- Nothing else in the handler changes: the projection, the description fallback, and the
  response shape at `:38-48` are untouched.
- **No UI change. No new module. No new dependency.**

## Out of scope

- **`setCount`** — pinned unchanged by the story.
- **Sharing one rule across `src/` and `ui/`** (Option B) — rejected above; revisit only if a
  shared tree appears for other reasons.
- **`ConceptList.jsx`'s copy** of the rule — untouched since story #3, still correct.
- **The `/neighbors` and `/node/:handle` endpoints** — checked, not merely deferred:
  `elementCount` appears nowhere outside the summaries handler
  (`src/api/concept-graph/index.js:34,36,38,45`), so neither endpoint carries this defect. There
  is nothing here to follow up.

---

## Amendment 1 — fold in `setCount`, and correct the performance claim (2026-09-09)

**Raised by:** the operator, at the Architecture gate, choosing to close the `setCount` gap this
ADR had flagged rather than leave it.

### The performance claim above is WRONG — corrected here

The Context section states "current **58.3 ms**, corrected **36.5 ms** … faster, and answered the
other way." That is not true. Those were **single cold samples**: one run each, no warmup, so the
first query paid planner and page-cache costs and the second benefited from them. I measured
cache-warming and reported it as query performance.

Re-measured properly — two warmup runs discarded, then five timed runs, median reported:

| variant | median | min | max |
|---|---|---|---|
| current (direct elements, single-hop sets) | **6.1 ms** | 4.3 | 7.5 |
| `elementCount` fixed only | **9.2 ms** | 8.7 | 10.7 |
| `elementCount` + `setCount` fixed | **27.5 ms** | 26.5 | 56.2 |

So the corrected query is **slower, not faster**: ~1.5× for `elementCount` alone, **~4.5×** with
`setCount` folded in — 6 ms to 27.5 ms, an added ~21 ms.

**That is still acceptable**, and the story's AC-5 bar is met: this is a once-per-session
orientation call over the entire graph, 27.5 ms is imperceptible against the network and parse
costs around it, and the alternative is an endpoint that reports the largest concept in the graph
as empty. But it must be recorded as a cost paid, not a bonus received. A future reader sizing
this endpoint should have the real number.

**Method note worth keeping:** single-sample timings on a warm-cache database measure the cache,
not the query. Every timing claim in this epic's ADRs should be read with that in mind.

### Revised decision on `setCount`

Sub-decision 2 above ("`setCount` is untouched, per AC-5") is **superseded**. `setCount` now
takes the same forward walk: `-[:IS_A_SUPERSET_OF*0..5]->`, counting the superset itself at zero
hops, exactly as the concept page does.

Verified against the page's values — all six spot-checks match after the change:

| concept | endpoint now | endpoint fixed | concept page |
|---|---|---|---|
| word | 17 | **48** | 48 ✓ |
| nostr relay | 3 | **14** | 14 ✓ |
| graph | 4 | **5** | 5 ✓ |
| set | 2 | **3** | 3 ✓ |
| validation tool | 2 | **3** | 3 ✓ |
| firmware concept | 0 | **1** | 1 ✓ |

The story's AC-5 pinned `setCount` as unchanged; the operator has revised that at this gate and
the story has been updated to match, so the acceptance criteria and this ADR do not contradict
each other.

### Consequences of the amendment

- **The endpoint and the concept page now agree on BOTH counts.** The `setCount` gap this ADR
  originally flagged as a deliberate leftover is closed instead of deferred, and the equality
  guard (Option C) can now assert both fields rather than one.
- **Cost: ~21 ms on one orientation call.** Recorded above with the real method.
- **`src/api/concept-graph/index.js:33` is now in scope** — it was explicitly out of scope in the
  original Implementation notes. Change its `-[:IS_A_SUPERSET_OF]->` to
  `-[:IS_A_SUPERSET_OF*0..5]->`. Everything else in the handler still stands unchanged.
