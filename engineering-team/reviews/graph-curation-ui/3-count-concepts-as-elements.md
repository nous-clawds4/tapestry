# Review: Story 3 — Report a concept's element count correctly on the concept page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-09
**Diff:** implementation commit `cf6e8a15` (branch `feat/graph-curation-ui`)
**Story:** `engineering-team/stories/graph-curation-ui/3-count-concepts-as-elements.md`
**ADR:** `engineering-team/decisions/graph-curation-ui/0003-one-canonical-concept-count.md` (+ Amendment 1)

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite — 19/19 pass**, re-run by the reviewer. Includes the live tier: the builder's
      Cypher executed against the graph and cross-checked against an independent derivation, on
      **every concept in the graph** (`L2`).
- [x] **Affected-suite regression — 104 passed, 0 failed** across the 6 suites referencing any
      file this story touches (`useCypher`, `ConceptDetail`, `ConceptOverview`, `conceptCounts`),
      enumerated by grep. Story #2's suite independently re-run: 14/14.
- [x] **Latency measured, not assumed.** The concern with two queries where one ran before: the
      counts query is **3–28 ms** (28 ms on `word`, the heaviest concept — 582 elements, 48
      sets), often *faster* than the header query it runs in parallel with. No perceptible cost.
- [x] **Manual verification** (the test plan assigns this to the Reviewer, since nothing renders
      the page). Performed on `:7778` — details under *Spec adherence*.
- [ ] **Full `npm test` — not attempted.** Unchanged from story #2's review: it buffers (OPEN.md
      row 227) and cannot finish against a live stack in reasonable time (row 27). The
      affected-suite run above is the substitute and is narrower. Stated, not glossed.
- [ ] _Lint / typecheck — not configured._
- [x] _Build: `npm --prefix ui run build` clean; `dist/` gitignored, not committed._

## Spec adherence

| AC | Verified how | Result |
|---|---|---|
| 1 — header and Overview show the same number | Structural: the Overview no longer computes a count, it reads the parent's. Confirmed live on `firmware concept` (37/37) and `word` (582/582) | ✅ |
| 2 — concepts-as-elements counted | `L3` + live: `firmware concept` 0 → **37**, `concept header` 0 → **44** | ✅ |
| 3 — set-nested elements counted | `L4` + live: `word` Overview 0 → **582**; `validation tool` 0 → 57 | ✅ |
| 4 — mixed direct + nested | `L4`: `graph` 173, `set` 137, `property` 70 — full counts, not the direct-only subtotals | ✅ |
| 5 — regression guard | `L5` + live: `nostr relay` 12, `nostr kind` 41, unmoved | ✅ |
| ADR d3 — setCount | `L6` + live: `word` 1 → **48** sets; `nostr relay` 2 → 14 | ✅ |
| A1 — guard-safety | `U3` runs the server's own regex against the builder's output; `L7` reads the three colliding concepts **unauthenticated** (200, were 403) | ✅ |

- [x] No criterion silently dropped. No behavior added beyond story + ADR.
- [x] **The subtle case was verified the hard way.** Amendment 1's stale-counts trap cannot be
      caught by loading a URL — a fresh load remounts the component and masks it. The Implementer
      navigated **client-side** through the concepts list from `firmware concept` to `word` and
      confirmed 37 → 582. I re-confirmed the end state. This is the check most likely to have
      been faked by a less careful pass, and it wasn't.

## ADR adherence

- [x] Files changed are **exactly** the four the ADR + Amendment name: `conceptCounts.js` (new),
      `useCypher.js`, `ConceptDetail.jsx`, `ConceptOverview.jsx`.
- [x] Decision 2 honored in the strong form: `ConceptOverview` **deletes** its counting rather
      than correcting it. That is what makes AC-1 structural rather than coincidental.
- [x] Amendment 1 decision 3 honored: `JSON.stringify(params)` is in the effect deps
      (`useCypher.js`), with a comment explaining why. Verified live, not just in source.
- [x] `useCypher`'s new argument is additive; all 67 existing call sites pass one or two
      arguments and are untouched.
- [x] No server-side change. No new dependencies.
- [x] One deviation, and it is an improvement: the Implementer replaced
      `` $${CONCEPT_UUID_PARAM} `` with a literal `$conceptUuid` after `S5` caught that the
      template-literal form never puts the parameter name in the source. Correct call — the
      indirection bought nothing and cost legibility.

## Concept-graph integrity

- [x] Handles remain `kind:pubkey:slug`; the change constructs none.
- [x] **No TA pubkey literal** in any new code. Better than before: the uuid is now a bound
      parameter rather than text spliced into a query.
- [x] No concept definition changed → **no firmware reinstall**.
- [x] Nothing re-derives domain knowledge from BIBLE.md.

## Things tests can't catch

- [x] No secrets, `console.log`, `debugger`, TODO/FIXME, or commented-out code in the diff.
- [x] **Checked for an infinite-render hazard and found none.** `concept` is now a
      newly-constructed object each render, so a child depending on its *identity* in a hook
      dependency array would loop. Swept `ui/src/pages/concepts/` — no child does.
- [x] Child tabs verified live after the context object's shape changed: **Elements** renders
      (and its own per-set figure independently agrees — "superset for the concept of words —
      582 elements"), **Health Audit** renders, no console errors from the new bundle.
- [x] Concurrency: the builder is pure; the two queries are independent reads.
- [x] Security: the change *reduces* exposure — a bound parameter cannot be spliced into the
      query text.

## Findings

### Blocking

None.

### Non-blocking

1. **NB-1 — `ui/src/utils/conceptCounts.js:33` exports `CONCEPT_UUID_PARAM`, and nothing imports
   it.** It became dead when the pages moved to the literal `$conceptUuid` (correctly — see ADR
   adherence). It is not harmful: it documents the parameter name next to the query that expects
   it. But an exported constant with zero importers will read as an oversight to the next
   person. Optional: drop it, or demote it to a non-exported comment.

2. **NB-2 — `useCypher`'s `JSON.stringify(params)` is key-order sensitive.** Two params objects
   with the same contents in different insertion orders serialize differently and trigger a
   redundant refetch. Harmless today (every caller builds the object literally, and both new
   call sites wrap it in `useMemo`), and the alternative — a deep-equality dep — is worse for a
   hook this widely used. Recorded so it is a known property rather than a surprise.

3. **NB-3 — a brief window where the header renders a blank element count.** `concept` becomes
   truthy as soon as the *header* query resolves, but `elementCount` arrives from the *counts*
   query, and `ConceptDetail.jsx:239` renders `{concept.elementCount}` with no fallback — so it
   renders empty rather than `0` for that interval. ADR 0003's Consequences asked specifically
   that loading not read as zero; the header satisfies that (blank, not a wrong number), and the
   Overview's pre-existing `?? 0` does momentarily read zero. **Measured, not hand-waved:** the
   counts query is 3–28 ms and runs in parallel, frequently resolving first, so the window is
   sub-perceptual. Not worth code today; worth knowing if either query ever slows.

### Out of scope — discovered during review, NOT caused by this story

4. **OOS-1 — `/api/audit/concept` resolves concepts by NAME, and six names are ambiguous, so the
   Health Audit tab audits the wrong node.** `ConceptHealth.jsx` calls `auditConcept(concept.name)`.
   Six concepts share a name with a foreign community-reference header seeded from
   `firmware/versions/v1.0.0/manifest.json` (`nostr-relay`, `tag`, `nostr-user-tag`,
   `tag-pinning`, `nostr-event-tag`, `tagging-with-specific-tag`). Measured:

   | audited name | resolved to | skeleton nodes present |
   |---|---|---|
   | nostr relay | `919ba08a…` **foreign** | 1/8 |
   | tag | `82b75e47…` **foreign** | 1/8 |
   | firmware concept | `11f23fe4…` local | 8/8 |
   | word / dog / shared concept | `11f23fe4…` local | 8/8 |

   So the Health Audit tab shows `nostr relay` — a concept with a complete skeleton and 12
   elements — as "Skeleton 1/8 nodes present, No superset wired yet", **on the same page whose
   header correctly reads 12 elements**. The page contradicts itself. Pre-existing: this commit
   touches neither `concept.name` nor the audit call. Needs its own story; the endpoint should
   accept a uuid, or resolve name + author.

5. **OOS-2 — `OPEN.md` row 219 contains an error I introduced earlier this session, and it needs
   correcting.** Its per-role validity table lists `nostr relay` with "Primary Property invalid"
   and six other roles invalid. Those roles are not invalid — **they do not exist**, because the
   audit resolved the foreign header (OOS-1). I built that table from `skeleton.nodes[].valid`
   without checking `exists`, conflating "absent" with "present but failing validation". The
   row's **core claim survives**: for the non-colliding concepts (`firmware concept`, `word`,
   `dog`, `shared concept`) all 8 nodes exist and only 1–2 validate, so JSON Validation does fail
   near-universally. Only the `nostr relay` column is wrong, and the same would apply to the
   other five colliding names.

### Harness friction

1. **Still no book** for this story — `engineering-team/audits/graph-curation-ui/book.md` closed
   2026-07-23. Third instance of OPEN.md row 29 / row 225. Completion detection has no anchor;
   `/close-book` is **not** offered.
2. **The kick-back chain worked, and is worth recording as a success.** Architecture caught that
   the story's ACs pointed at broken semantics; Implementation caught that the ADR contradicted
   itself on scope; Test Design re-aimed rather than letting the Implementer edit their own
   judge. Three handoffs, each catching something the previous phase got wrong. The harness did
   its job; nothing to fix here.

## Verdict

**PASS**

The diff is exactly the four files the ADR and its amendment name, and it does what they
specify. The suite is 19/19 including a whole-graph live sweep cross-checked against an
independent derivation; 104/0 across every suite touching these files; story #2's suite
unaffected. All six acceptance criteria plus the amendment's guard-safety property were verified
against the running page, and the one genuinely subtle case — that a client-side navigation
refreshes the counts — was verified by client-side navigation rather than by a URL load that
would have masked it.

The two most substantial findings (OOS-1, OOS-2) are pre-existing and outside this story: one is
a name-ambiguity bug in a different endpoint, the other is an error in a ledger row I wrote
earlier today. Both are recorded rather than quietly fixed, because correcting them here would
put unreviewed changes into a story that did not ask for them.

Unchanged and expected: the concept page and `/api/concept-graph/summaries` now disagree —
`word` reads 582 on the page and 0 from the API. That is story #4's reason for existing and is
documented in the test plan so it is not mistaken for a regression.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: **no book covers this story** (harness friction 1). No book
      arithmetic is possible and `/close-book` is not offered.
