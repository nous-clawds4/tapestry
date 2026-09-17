# Review: Story 4 — The summaries endpoint's element and set counts

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-09
**Diff:** implementation commit `c7bd7c99` (branch `feat/graph-curation-ui`)
**Story:** `engineering-team/stories/graph-curation-ui/4-summaries-element-count.md`
**ADR:** `engineering-team/decisions/graph-curation-ui/0004-summaries-element-count.md` (+ Amendment 1)

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite — 13/13**, re-run by the reviewer.
- [x] **Story #3's suite — 19/19**, re-run because #4's drift guard imports #3's module; if #3
      regressed, #4's central assertion would be comparing against rubble.
- [x] **Affected-suite regression — 488 passed, 0 failed, 2 skipped** across the 22 suites
      referencing this endpoint, the shared rule, or `summaries`.
- [x] **Latency re-measured on the deployed endpoint** (2 warm-ups discarded, median of 5):
      **67.2 ms** end-to-end. The design-time figures — 6.1 ms before, 27.5 ms after — were
      *query-only*; the remaining ~40 ms is HTTP, Express and JSON-serialising 63 summaries, and
      is not attributable to this change. **Stated precisely because the comparison is not
      like-for-like:** I did not measure the pre-change endpoint end-to-end, so "~46 ms before"
      would be an inference, not a measurement. What is measured: the deployed call is 67 ms,
      comfortably inside `L8`'s 1 s bound and inside the story's accepted cost.
- [x] **Restart safety verified after the fact**, since this is the epic's first server-side
      story: `neo4j` and `strfry` held pids 172/173 and their 12-day uptimes across
      `supervisorctl restart brainstorm`, and `firmware concept`'s 37 elements — locally-authored
      graph state with no event behind it (BIBLE §30) — are intact.
- [ ] **Full `npm test` — not attempted.** Unchanged reasons: it buffers (OPEN.md row 227) and
      cannot finish against a live stack (row 27). The 22-suite run is the substitute and is
      narrower.
- [ ] _Lint / typecheck — not configured. No build step for `src/`._

## Spec adherence

| AC | Verified how | Result |
|---|---|---|
| 1 — elementCount counts the whole set tree | `L2` over all 63 concepts vs the canonical rule | ✅ |
| 2 — set-nested concepts no longer read 0 | `L3` + live: `word` **0 → 582**, `validation tool` **0 → 57** | ✅ |
| 3 — mixed direct + nested | `L4` + live: `graph` 132 → **173** | ✅ |
| 4 — regression guard | `L5` + live: `nostr relay` 12, `firmware concept` 37, unmoved | ✅ |
| 5 — setCount walks the whole tree (A1) | `L6` + live: `word` 17 → **48**, `nostr relay` 3 → **14** | ✅ |
| 6 — other fields unchanged | `L1`, `L7`, `S3` — no field renamed, dropped or retyped | ✅ |
| 7 — no order-of-magnitude slowdown | `L8` + reviewer's own measurement (67 ms) | ✅ |

- [x] No criterion silently dropped; no behavior added beyond story + ADR.
- [x] **The conditional AC was checked, not skipped.** The story permits "a factual correction if
      the endpoint's documented description of `elementCount` states the narrower meaning."
      `AGENTS.md:45` lists the fields by name — `handle`, `name`, `description`, `elementCount`,
      `setCount` — and **defines none of them**. No documentation anywhere (`BIBLE.md`,
      `protocols/`, `docs/`, `openapi.yaml`) states the narrow meaning, so there is nothing false
      to correct and the Implementer was right to leave the prose alone. Recorded because "the
      Implementer skipped a conditional AC" and "the condition did not obtain" look identical
      from the diff.

## ADR adherence

- [x] Files changed: **one**, `src/api/concept-graph/index.js`, +12/−2. Exactly the two clauses
      the ADR's Implementation notes name (`:32` elementCount, `:33` setCount per Amendment 1).
- [x] `:NostrEvent` carried on the element match as sub-decision 1 requires — verified present.
      Measured at design time to change no number; it exists so the server's rule *reads*
      identical to the page's.
- [x] The response projection, description fallback, and `propertyCount` are untouched.
- [x] No UI change (`R2`), no new module, no new dependency, no cross-tree import — Option B was
      rejected and stayed rejected.
- [x] **Option C's condition is met.** The ADR accepted two implementations *only* on the
      condition that a test proves they agree. `L2` does, across all 63 concepts, and it went
      from 63/63 disagreeing to 0. The bet is now backed.

## Concept-graph integrity

- [x] Handles unchanged in shape (`L1` asserts `kind:pubkey:slug`).
- [x] No TA pubkey literal; the query is concept-agnostic.
- [x] No concept definition changed → **no firmware reinstall**. Worth stating loudly given this
      story's timing: a firmware install on this machine is a live hazard to the 37 hand-wired
      elements, and nothing here requires one.
- [x] The endpoint remains the orientation ladder's first call, with its documented shape intact.

## Things tests can't catch

- [x] No secrets, debug logging, TODOs, or commented-out code.
- [x] **Cypher comment syntax verified by execution, not assumption.** The Implementer put a
      12-line `//` comment *inside* the Cypher template literal. Cypher accepts `//` line
      comments, and the endpoint returns correct data for 63 concepts — so it parses. An escaped
      backtick in an earlier draft was caught and replaced before deploy; had it survived, it
      would have reached Neo4j as an identifier quote.
- [x] The `ss` variable introduced by the new element match is dropped at the following `WITH`
      and cannot leak into later clauses.
- [x] `count(DISTINCT …)` on both counts means the cartesian product between the two OPTIONAL
      MATCHes cannot inflate either figure — the property the ADR relied on, and the reason
      `firmware concept` still reads 37 rather than 37×1.
- [x] Security: read-only query; no new input reaches it; no parameterization concern (the
      handler takes no user input for this query).

## Findings

### Blocking

None.

### Non-blocking

1. **NB-1 — the comment at the query is load-bearing and should be treated as such.**
   `src/api/concept-graph/index.js:32-41` explains that the rule is duplicated in
   `ui/src/utils/conceptCounts.js` *deliberately*, and that `L2` catches a one-sided change.
   That comment is the only thing carrying ADR 0004's reasoning to where the code lives —
   without it the next reader sees duplicated Cypher and either "fixes" it into a cross-tree
   import or copies the pattern. Not a defect; flagged so a future tidy-up does not delete it as
   noise.

2. **NB-2 — `AGENTS.md:45` documents the summary fields by name and defines none of them.**
   That is arguably how this defect survived: nothing ever wrote down what `elementCount`
   counts, so "direct members only" was never visibly wrong. Out of scope here — the story
   permits only a *correction*, and there is nothing false to correct — but a one-clause
   definition ("every element reachable through the concept's set tree") would make the next
   divergence self-evident. Candidate follow-up, worth an OPEN.md row rather than a silent edit.

3. **NB-3 — the drift guard is live-stack-only, so CI cannot enforce it.** Every `L*` SKIPs when
   the stack is down. ADR 0004 records this and the test plan repeats it, so it is disclosed
   rather than discovered — but it means the ADR's central safeguard has no automated enforcement
   in the one place that runs on every PR. Anyone reading a green stack-free CI run should not
   conclude the two implementations still agree.

### Harness friction

1. **Still no book.** Fourth story in this epic with `engineering-team/audits/graph-curation-ui/book.md`
   Closed since 2026-07-23. Completion detection has no anchor; `/close-book` is **not** offered.
   Rows 29 / 225 already carry this; a fourth instance is not worth a fifth row, but it is now
   the most-repeated harness defect in this epic and should lead the next harness story.

## Verdict

**PASS**

One file, two clauses, and the numbers move exactly as the story specified: `word` from 0 to 582
on the endpoint the project designates as an agent's first look at the domain. The suite is
13/13, story #3's is 19/19, and 488 tests pass across the 22 suites in this area.

The finding I want on the record is not a defect but a confirmation: ADR 0004 made a real trade —
two implementations of one rule, in exchange for not inventing a cross-tree CJS/ESM coupling —
and staked it entirely on `L2`. That guard has now gone from 63/63 concepts disagreeing to 0.
The trade is sound *while the guard runs*, which is precisely why NB-3 matters: the safeguard
that justifies the duplication is the one thing CI cannot check.

Nothing here required a firmware reinstall, and the restart this story did require was verified
non-destructive — `neo4j` and `strfry` untouched, the 37 hand-wired elements intact.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: **no book covers this story** (harness friction 1). No book
      arithmetic is possible and `/close-book` is not offered.
