# Review: Story 5 — Inherit-From (`b`) & Resolved Definition extraction

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-10
**Diff:** commit `6542dfcf` (5 files, +106/−77: `protocols/drafts/inherit-from.md` new; `BIBLE.md` §25/§26 rewritten; `protocols/drafts/class-thread-tags.md` repoints + gloss; `protocols/worksheet.md` sweep; `protocols/README.md` row 5)
**Contract:** `protocols-directory` ADR 0003 (thin — 9-heading skeleton + six fixed calls), inheriting ADR 0001's pattern; story ACs; traceability rule
**Method note:** implementation authored in this same session; audit fanned out to independent agents across five dimensions, findings adversarially verified. **Infrastructure note:** one adversarial verifier stalled (6 retries) and the orchestration script crashed on assembly (a missing null-filter — fixed for future runs); all five audit dimensions and three of four verifier verdicts were recovered from agent transcripts, and the one orphaned finding was verified directly by the Reviewer against the cited lines and pre-change sources. Gates run directly by the Reviewer.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (full suite)
- [x] Playwright — skipped: docs-only
- [x] Diff scope — exactly the ADR's five files; the single BIBLE hunk spans `-1508,81` = precisely the old §25+§26 region (the ADR's "two hunks" expectation collapsed to one because the sections are adjacent — accepted, verified equivalent)
- [x] _Lint/typecheck/build not configured — skipped._

## ADR adherence

- [x] Skeleton: exactly the 9 fixed headings, in order (15-note confirmatory audit).
- [x] All six fixed calls executed: family table + disclaimer + W5 pointer; closure abstracted (Cypher only in BIBLE §26); do-NOT-flip with both §25 reasons cross-referencing the class-thread spec; both class-thread §25-links repointed with parentheticals removed + the curator gloss verbatim per ADR; worksheet W1/W2/W6 swept (residual grep empty); README row 5.
- [x] BIBLE retention per rewrite shapes, both sections; trust-coupling not restated in BIBLE.

## Boundary discipline

- [x] Spec side: zero stack machinery (no Neo4j/Cypher/MATCH/MERGE/effectiveCD/PoV/GrapeRank/ADR-cites-in-body/pubkeys).
- [x] Dual-normativity landmark sweep clean (wire form, `merge_walk`, first-listed, trust-coupling only in the spec).
- [x] Glossary `b tag` entry (BIBLE:1431) restating the wire form compactly — **refuted as a finding**: pre-existing, byte-identical across the commit, outside the story's contract; accepted under the story-3 glossary precedent. *Recorded as a candidate for a future glossary-trim pass, not this story.*

## Traceability (story rule)

- [x] Zero findings: all 18 normative claims traced to old §25/§26 / ADRs 0027-0028 / the class-thread spec. The flagged resolution-section merge verified lossless (live/override/termination/pure-inheritance/unstated-conflicts/depth-first/observer-independence/always-an-answer all present); the abstracted closure faithful; Aggregation claims only the trust-weightable enumeration; the PoV sentence correctly absent from the spec.

## Findings

Audit: 6 non-note findings raised → 3 refuted by adversarial verifiers, 1 confirmed, 1 verified directly by the Reviewer (real), 1 was the glossary item above (refuted). 25 confirmatory notes.

### Blocking (consolidated — one kickback, one file)

Both are stranger-readability gaps in the Resolution pseudocode's surrounding definitions, same species as story 3's kickback; both fixes constrained by the traceability rule (state what's sourceable; mark the rest explicitly).

1. **`resolve(parent)` undefined / loop-variable ambiguity** (inherit-from.md:58–59, confirmed by verifier) — `parent` iterates `node.b-tags`, so it is a 3-element tag array, and `resolve()` is never defined. Asked change: clarify mechanically (sourceable from the wire format) — the walk follows each `b` tag's element 2 (the parent's a-tag) and `resolve` fetches the node at that address; a pseudocode comment or one prose sentence suffices.
2. **`field` / `statedFields` never bound to an encoding** (inherit-from.md:45–47, 60; Reviewer-verified against sources) — the sources use the terms identically without defining which parts of a node's payload constitute its "definition fields," so the gap is inherited, not introduced. Asked change: the honest-gap treatment — state that a node's *stated fields* are the fields its own definition states, and mark the precise binding of definition-fields to the payload encoding (e.g. which parts of the `json`-tag payload participate in resolution) as **not yet formalized**.

### Non-blocking

1. `fill_unset`/`overlay` helper functions undefined — refuted (the adjacent prose supplies both semantics; abstract helpers are conventional in pseudocode).
2. Legacy kinds 9998/9999 omitted from the `b` kinds statement — refuted (sourced scope is 39998/39999 exactly; old §25 says the same).

## Verdict

**CHANGES_REQUESTED** — solely for the two-definition kickback above (one file, additive). Everything structural passed: skeleton, all six ADR calls, lossless resolution merge, boundary spotless, the proactive worksheet sweep held (no stale-ref blocker for the first time since story 2), gates green. Converts to PASS on the fix with a targeted re-check of the two passages.
