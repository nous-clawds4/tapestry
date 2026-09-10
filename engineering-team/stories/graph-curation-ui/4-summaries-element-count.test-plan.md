# Test Plan: Story 4 — The summaries endpoint's element and set counts

**Story:** `engineering-team/stories/graph-curation-ui/4-summaries-element-count.md`
**ADR:** `engineering-team/decisions/graph-curation-ui/0004-summaries-element-count.md` (+ Amendment 1)
**Date:** 2026-09-09

## The one test this plan exists for

ADR 0004 made a trade that only holds if this suite backs it. It rejected sharing a module
across the `src/` (CJS) ↔ `ui/` (ESM) boundary — a coupling the repo has never had — and
accepted **two separate implementations** of the counting rule on the explicit condition that a
test proves they agree.

`L2` is that condition. It fetches the endpoint and, **for every concept in the graph**, runs
story #3's canonical rule (`ui/src/utils/conceptCounts.js`) directly and compares both counts.
If the ADR's bet is wrong — if the two implementations drift by so much as one concept — this
test says so by name.

That makes `L2` load-bearing in a way an ordinary assertion is not: **it is the mechanism the
ADR chose in place of deduplication.** Weakening it (narrowing it to a fixture list, or letting
it skip quietly) would silently revoke the ADR's reasoning. It should be the last test anyone
agrees to relax.

## Test level

| Tier | What it does | Stack |
|---|---|---|
| `L1–L8` | Live against the running endpoint and graph; `L2` sweeps every concept | yes (SKIP if down) |
| `S1–S3` | Source-level over the handler, for shape claims a response cannot show | no |
| `R1–R2` | Sentinels over story #3's module, which `L2` depends on | no |

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 elementCount counts the whole set tree | `L2` (every concept, vs canonical) | live |
| AC-2 set-nested concepts no longer read 0 | `L3` `word`, `validation tool`: `> 0` and `>` direct-only | live |
| AC-3 mixed direct + nested | `L4` `graph`, `set`, `property`: `>` direct-only | live |
| AC-4 regression guard | `L5` `nostr relay`, `firmware concept`: all rules still agree | live |
| AC-5 setCount walks the whole tree (Amendment 1) | `L6` `word` 17→48, `nostr relay` 3→14, `graph` 4→5, vs one-hop | live |
| AC-6 other fields unchanged | `L1` shape; `L7` values + no field dropped; `S3` projection | live + source |
| AC-7 no order-of-magnitude slowdown | `L8` median of 3 warm runs under 1s | live |
| ADR impl note (elementCount clause) | `S1` forward `*0..5` before `HAS_ELEMENT`; old clause gone | source |
| ADR A1 (setCount clause) | `S2` single-hop clause gone | source |
| Guard's dependency | `R1` canonical module still exports a parameterized builder; `R2` UI untouched | unit |

## No hard-coded counts

Same discipline as story #3, for the same reason: `word` moved 575 → 582 during the 2026-09-09
session because creating one concept mints seven word-typed nodes. Every expected value is
derived at run time, and the discriminating assertions are **invariants** — "strictly greater
than the direct-only count", "strictly greater than the single-hop set count" — which hold
whatever the data does.

## On the timing test (`L8`)

The bound is deliberately loose: median of three warm runs under **1 s**, against a design-time
measurement of 27.5 ms. That is roughly a 36× headroom, and it is intentional. A tight threshold
would flake on a loaded machine, and a suite that cries wolf gets ignored — which is worse than
no timing test at all. `L8` answers "did this fall off a cliff", not "is this fast".

The number it guards is honest: the corrected query is **~4.5× slower** than today's
(6.1 ms → 27.5 ms, medians of five warm runs). ADR 0004's original claim that it was *faster*
came from single cold samples and was corrected in Amendment 1.

## Edge cases covered

- [x] Elements entirely under nested sets, none direct (`word`, `validation tool`) — the `0` case.
- [x] Mixed direct and nested (`graph`, `set`, `property`) — catches swapping one narrow rule for another.
- [x] Controls where every rule already agrees (`nostr relay`, `firmware concept`) — catches over-counting.
- [x] Whole-graph sweep (`L2`) — no concept quietly wrong.
- [x] `setCount` at depth, against the single-hop subtotal (`L6`).
- [x] Response shape: no field renamed, dropped, or retyped (`L1`, `L7`, `S3`).

Not covered: concurrency (a read-only query), and a stack-absent run (every `L*` SKIPs, recorded
rather than silent).

## What this plan does NOT cover — stated plainly

- **The guard is live-stack-only.** Every `L*` SKIPs when the stack is down, so a **stack-free CI
  run cannot catch a drift** between the endpoint and the page rule. ADR 0004 records this as the
  cost of Option C. Green CI is not proof here; the live run is.
- **Nothing checks the rendered concept page.** Story #3 covers that surface; this story asserts
  the endpoint agrees with #3's *rule*, executed directly, not with #3's *pixels*.
- **AGENTS.md prose is not verified.** If the endpoint's documented description of `elementCount`
  states the narrow meaning, correcting it is in the story's scope but no test asserts it.

## Test infrastructure

- Node built-in runner; new suite `test/summaries-element-count.test.js` wired into
  `test/test.js` at all five registration points. No new infrastructure.
- No firmware state required; **no `POST /api/firmware/install`** (and see the note in the story —
  a firmware install is a hazard on this machine, unrelated to this test).
- Fixtures: real concepts addressed by slug, TA pubkey resolved at run time from
  `/api/assistant/pubkey`. No TA literal in the suite (CLAUDE.md).

## How to run

```
node -e "require('./test/summaries-element-count.test.js').run()"
```

## Verification

Confirmed failing for the right reasons on 2026-09-09 at commit `5ee0220e`. `L2` names the
disagreeing concepts and both numbers; `S1`/`S2` name and quote the unchanged clauses. No failure
is an import error or a typo.

```
  ✓ L1 (AC6): the endpoint answers with its documented shape intact
  ✗ L2 (AC1+AC5, THE DRIFT GUARD): endpoint counts equal the page's canonical rule, for EVERY concept
      ADR 0004 Option C accepts TWO implementations of the counting rule — the server's Cypher and ui/src/utils/conceptCounts.js — on the condition that this test proves they agree. 63 of 63 concepts disagree (elements/sets): adoption-disposition: endpoint=166/0 canonical=166/1; class-thread: endpoint=0/0 canonical=0/1; concept-graph: endpoint=57/0 canonical=57/1; concept-header: endpoint=44/0 canonical=44/1; core-nodes-graph: endpoint=57/0 canonical=57/1; dog: endpoint=1/0 canonical=1/1; dog-breed: endpoint=0/0 canonical=0/1; firmware-concept: endpoint=37/0 canonical=37/1
  ✗ L3 (AC2): concepts whose elements live under nested sets are no longer reported as empty
      word: the orientation endpoint reports 0 elements for a concept that has 582. This is the defect — an agent reading the documented ladder is told the graph's largest concept is empty.
  ✗ L4 (AC3): concepts mixing direct and nested elements report the full count
      graph: endpoint 132, canonical 173.
  ✓ L5 (AC4 regression guard): concepts already counted correctly do not move
  ✗ L6 (AC5, Amendment 1): setCount walks the whole superset tree, not one hop
      word: endpoint setCount 17, canonical 48.
  ✓ L7 (AC6): the other documented fields are untouched in name, shape and value
  ✓ L8 (AC7): the orientation call stays fast enough — no order-of-magnitude regression
  ✗ S1 (AC1): the elementCount clause walks the set tree forward
      the elementCount match must walk `-[:IS_A_SUPERSET_OF*0..5]->` FORWARD before HAS_ELEMENT. Without the walk it sees only direct members, which is why `word` reported 0.
  ✗ S2 (AC5, Amendment 1): the setCount clause walks the whole tree too
      the single-hop `-[:IS_A_SUPERSET_OF]->(s)` setCount clause must be gone — Amendment 1 folds setCount in so the endpoint and the concept page agree on both counts, not just one.
  ✓ S3 (AC6): the response projection is unchanged
  ✓ R1: story #3's canonical module still exports a parameterized builder
  ✓ R2: no UI file was changed by this story

summaries-element-count: 7 passed, 6 failed, 0 skipped
```
