# Test Plan: Story 3 — Report a concept's element count correctly on the concept page

**Story:** `engineering-team/stories/graph-curation-ui/3-count-concepts-as-elements.md`
**ADR:** `engineering-team/decisions/graph-curation-ui/0003-one-canonical-concept-count.md`
**Date:** 2026-09-09
**Re-aimed:** 2026-09-09 after ADR 0003 **Amendment 1**. The builder's contract changed —
`conceptCountsCypher()` now takes no argument and the concept arrives as `$conceptUuid` — so
`U1` and every `L*` call site were re-pointed, and three tests were added that only became
possible once the query was parameterized. Re-aiming a suite is Phase 3 work; the Implementer
kicked back rather than editing their own judge.

## Test level, and what changed since story #2

Story #2 could only reach source-level assertions, because the logic under test lived inside a
React component and this repo has no jsdom. ADR 0003 moves the counting rule into a pure
importable module — so this plan **executes the real query against the live graph**. That is the
concrete payoff of the ADR's chosen option, and it is why these tests can prove numbers rather
than prove text.

| Tier | What it does | Stack needed |
|---|---|---|
| `U1–U4` | Import and call the pure builder; assert purity, parameterization, guard-safety, and the hook's params wiring | no |
| `L1–L7` | **Run the builder's Cypher against the live graph** and cross-check | yes (SKIP if down) |
| `S1–S5` | Structural claims a query result cannot show | no |
| `R1–R3` | Regression sentinels; PASS before and after | no |

## No hard-coded counts — and why that is load-bearing

The story requires expected values be derived, not pinned. This is not caution for its own sake:
`word` read **575** at the start of the 2026-09-09 session and **582** by the end, because
creating a single concept mints seven new word-typed nodes, which are themselves elements of
`word`. A literal would have rotted within the hour.

So the live tests assert two things that cannot go stale:

1. **Agreement with an independent derivation.** `derive()` in the suite computes the same
   quantity by a deliberately *different* shape — collect the superset-walk uuids in one query,
   then count elements attached to that uuid list in a second. If the builder's single-pass
   query has a subtle fault (wrong depth, missing `DISTINCT`, wrong label), the two disagree.
2. **Invariants over relationships between rules.** "The full count strictly exceeds the
   direct-only count for a concept that has nested sets." "The full count strictly exceeds the
   `:ListItem`-only count for a concept whose elements are concepts." These stay true whatever
   the data does.

**The derivation was itself validated before being trusted.** Run against nine concepts, it
reproduces every measurement taken at Architecture — `firmware concept` 37, `concept header` 44,
`word` 582, `validation tool` 57, `graph` 173, `set` 137, `property` 70, `nostr relay` 12,
`nostr kind` 41. A cross-check nobody has checked is just a second guess.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 header and Overview show the same number | `S2` + `S3` — the Overview stops computing and reads context, so they *cannot* differ | source |
| AC-1 the shared query is well-formed | `L1` one row, numeric `elementCount` and `setCount` | live |
| AC-1 the rule is right, graph-wide | `L2` builder vs independent derivation for **every concept in the graph** | live |
| AC-2 concepts-as-elements counted | `L3` `firmware concept`, `concept header`: `> 0` and strictly `>` the `:ListItem`-only count | live |
| AC-3 set-nested elements counted | `L4` `word`, `validation tool`: `> 0` and strictly `>` direct-only | live |
| AC-4 mixed direct + nested | `L4` `graph`, `set`, `property`: strictly `>` direct-only | live |
| AC-5 regression guard | `L5` `nostr relay`, `nostr kind`: all three rules must still agree | live |
| ADR d1 pure builder | `U1` purity + parameterization (no handle in the text); `U2` no React, no I/O | unit |
| ADR d1 header uses it | `S1` imports the builder; no `:ListItem` match remains | source |
| ADR d2 Overview stops counting | `S2` no reversed traversal, no `count(DISTINCT elem/setNode)` | source |
| ADR d3 setCount corrected | `L6` walks the whole superset tree, not just the superset | live |
| Display survives the deletion | `S4` ELEMENTS and SETS still rendered | source |
| A1 query is guard-safe | `U3` the server's own write-keyword regex, run against the builder's output | unit |
| A1 hook wiring | `U4` params forwarded, and `JSON.stringify(params)` in the effect deps | source |
| A1 payoff | `L7` `set`, `properties-set`, `goal-set` count correctly **unauthenticated** | live |
| A1 page queries | `S5` neither page interpolates the uuid into Cypher text | source |

**State at the re-aim:** 17 pass, 2 fail. The two failures are precisely the parts of Amendment 1
not yet built — `U4` (the `useCypher` params passthrough) and `S5` (the two page queries still
interpolate). Everything the pre-amendment implementation already satisfied stays green, and
`L7` **already passes**: parameterizing the builder alone was enough to make the three
guard-tripping concepts readable without a session.

## The two tests Amendment 1 made possible

`U3` runs **the server's own regex**, copied verbatim from `src/api/neo4j/queryPost.js:17`,
against the builder's output. It encodes the reason the amendment exists: if that regex ever
matches the counting query's text again, every unauthenticated caller gets a 403 and the whole
live tier goes dark. A future edit that reverts to interpolation fails here immediately, with
the offending match quoted.

`L7` is the user-facing payoff, and it is testable only because the runner is itself
unauthenticated: it reads `set`, `properties-set` and `goal-set` with no session and asserts the
counts are right. Before the amendment each returned `HTTP 403 Write queries require owner
authentication` — the same failure a logged-out visitor to those pages hits today.

## Edge cases covered

- [x] A concept whose elements are **exclusively** concepts (`firmware concept`) — the case that surfaced the bug.
- [x] A long-standing concept with concepts-as-elements (`concept header`) — proves it is not new.
- [x] Elements **entirely** under nested sets, none direct (`word`, `validation tool`) — the Overview's `0`.
- [x] A **mix** of direct and nested (`graph`, `set`, `property`) — catches a fix that swaps one narrow rule for another.
- [x] Controls where every rule already agrees (`nostr relay`, `nostr kind`) — catches over-counting.
- [x] Whole-graph sweep (`L2`) — no concept is quietly wrong.
- [x] `setCount` at depth (`L6`).

Not covered: concurrency (the builder is pure and synchronous) and a stack-absent run (`L*` SKIP,
recorded not silent).

## What this plan does NOT cover — stated plainly

- **Nothing renders the page.** No jsdom. `S2`/`S3` establish that the Overview reads the
  parent's number instead of computing its own, which is what makes AC-1 structural — but that
  the two *displayed* figures match is verified by a human opening the page. **The Reviewer must
  open a concept page on `:7778`** — `firmware concept` (37) and `word` (582 elements, 48 sets)
  are the two that discriminate — and confirm header and Overview agree.
- **The summaries API is out of scope** (story #4). After this ships the page and that endpoint
  will disagree — `word` will read 582 on the page and 0 from the API. That is expected and is
  the reason #4 exists; a reviewer seeing it should not treat it as a regression.
- **`ConceptList` keeps its own copy of the rule** (`R3` pins that as deliberate).

## Test infrastructure

- Framework: Node built-in runner, `node test/test.js`. No new infrastructure.
- New suite `test/concept-count-canonical.test.js`, wired into `test/test.js` at all five
  registration points.
- Live tier needs the local stack; each `L*` returns `SKIP` when it is down.
- Firmware state: none. No concept definition changes; **no `POST /api/firmware/install`.**
- Fixtures: real concepts in the live graph, addressed by slug with the TA pubkey resolved at
  runtime from `/api/assistant/pubkey` — **no TA literal in the suite** (CLAUDE.md).

## How to run

```
node -e "require('./test/concept-count-canonical.test.js').run()"
```

Full suite (note OPEN.md row 227 — `npm test` buffers; run `node test/test.js` to watch progress):

```
node test/test.js
```

## Verification

Re-run after the re-aim, 2026-09-09 (commit `6530c3bc`). `U4` and `S5` name exactly what
Amendment 1 still requires; every other test is green. No failure is an import error or a typo.

```
✓ U1 (ADR d1 + A1): conceptCountsCypher is pure and PARAMETERIZED — one query text serves every concept
  ✓ U3 (A1, the whole point): the builder's Cypher does not trip the server's write-keyword guard
  ✗ U4 (A1): useCypher forwards params AND serializes them into its effect deps
      useCypher must forward params to cypher(query, params) — ui/src/api/cypher.js has accepted them all along; the hook never passed them.
  ✓ U2 (ADR d1): the module is dependency-free — no React, no fetch, so the runner can execute it
  ✓ L1 (AC1): the builder returns exactly one row carrying elementCount and setCount
  ✓ L2 (AC1): the builder agrees with an independently written derivation, across every concept in the graph
  ✓ L3 (AC2): concepts whose elements are themselves concepts are counted — the :ListItem blind spot is gone
  ✓ L4 (AC3+AC4): elements nested under sets are counted — the reversed-traversal blind spot is gone
  ✓ L5 (AC5 regression guard): concepts that are already counted correctly do not move
  ✓ L6 (ADR d3): setCount counts the whole superset walk, not just the superset itself
  ✓ L7 (A1 payoff): the three concepts whose handles trip the write guard now count fine UNAUTHENTICATED
  ✓ S1 (ADR d1): ConceptDetail sources its counts from the shared builder, not an inline :ListItem match
  ✓ S2 (ADR d2): ConceptOverview no longer counts anything — it cannot disagree with a number it does not compute
  ✓ S3 (ADR d2): the counts reach the Overview through the outlet context the detail page already renders
  ✗ S5 (A1): both remaining page queries pass the concept as a parameter, not interpolated text
      ConceptDetail must not interpolate the concept uuid into Cypher text — Amendment 1 covers all three queries on this page, so that logged-out visitors can read the set / properties-set / goal-set concepts at all.
  ✓ S4 (AC1): the Overview still renders both figures — deleting the query must not delete the display
  ✓ R1: the Overview keeps its other fields (names, description, created, properties)
  ✓ R2: ConceptDetail still resolves the concept header and its superset
  ✓ R3: ConceptList keeps its own (correct) counting — this story does not touch it

concept-count-canonical: 17 passed, 2 failed, 0 skipped
```
