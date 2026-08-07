# Review: Story 1 — Concept-header b-coverage audit and guided disposition

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-06
**Diff:** `git diff db5722de^..HEAD` (commits `db5722de` story+epic+book, `8a83fa27` ADR, `9e3a292c` failing tests, `b3374526` implementation) — 22 files, +1577/−94.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **run independently** (2026-08-06, strfry-router quiesced/restored): every suite PASS including `b-coverage-audit-and-disposition` **26/26**; the single failure is the **pre-existing** `show-the-four` S5 route-count pin (OPEN.md #143), byte-unchanged situation since before this story's first commit. Result identical to the Implementer's run.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), re-run post-implementation.
- [x] Browser verification (Implementer's, evidence reviewed; spot conclusions consistent with the code): coverage chips correct on real data — 🔗 on the firmware-seeded affiliations, 🤝 on early self-declared concepts, "—" on foreign-TA headers (including the second dev machine's TA — the §31 first-person boundary working as ratified); filter 59 → 44; panel renders all three actions + live community picker; console clean.
- [x] Playwright — not applicable per the test plan's recorded rationale (panel is fetch+rerender; endpoints H-covered; AC-2 interaction manually walked in-browser).

## Spec adherence (story ACs)

- [x] **AC-1 coverage visibility** — QUERY collects `bValues` ([ConceptList.jsx](../../../ui/src/pages/concepts/ConceptList.jsx) — one `OPTIONAL MATCH`, `DISTINCT` aggregation intact, verified live); chips render all four states; "Undispositioned (mine)" filter = TA-authored ∧ no b (the §31 prompt set). U5/U6 + S7 + H4 + browser.
- [x] **AC-2 guided iteration** — inline panel, "Next undispositioned →" iterator, acted-set overlay makes acted headers leave the undispositioned set immediately (the `actedUuids` state — a correct reading of "immediately" against a non-refetching query).
- [x] **AC-3 wire-external** — `b-append`: a-tag-form validation, `≠ self` lane guard, append-only + sentinel strip, signed event returned; idempotent (H4/H6); owner-gated.
- [x] **AC-4 auto b-tag** — reachable from the panel; idempotency preserved; H7 proves declare-after-defer live.
- [x] **AC-5 keep private** — exactly one sentinel (H1/H2); no broadcast path exists in the defer flow (verified by read: the handler never touches a relay publisher; the panel's `doDefer` calls no `publishToRelays`); renders as its own state everywhere.
- [x] **AC-6 sentinel hygiene** — the chokepoint guard derives edges only for locator forms ([eventSync.js:259-260](../../../src/api/neo4j/eventSync.js)); plain tag nodes survive (coverage depends on them); G1/G2/G3 behavioral + H3 live; all three b-surfaces skip by name.
- [x] **AC-7 mutual exclusivity + re-disposition** — defer refuses on real b (H5, domain refusal HTTP-200 per house contract); wire/declare replace the sentinel (H4/H7); deferral never removes a real b (H5 read-back).
- [x] **AC-8 spec ruling** — inherit-from reserved-value paragraph (a *value*, not a type — ADR 0029's registry untouched, correctly stated); shared-concepts "Deliberate non-affiliation" (zero weight, excluded from reach/closure/clouds, replace-not-accumulate — each claim matches the shipped code); W16 → Graduated with Resolution in the house format, heading unchanged (anchors resolve, verified).
- [x] **AC-9 gates** — per Quality gates above.
- [x] No criterion silently dropped; no scope creep found beyond the audited deviations below.

## ADR adherence + deviation audit

- [x] Files match ADR 0001's implementation notes plus its **dated correction note**; layering honored (pure lib → chokepoint → endpoints on the helpers spine → UI); no new dependencies.
- [x] **Deviation 1 — gate mechanism (AUDITED, SOUND):** `requireOwner` is session-only and contradicted the ADR's own loopback H-test design. The correction adopts the shipped in-handler pattern (`isOwner(req) || req.localTrusted` — [publishEvent.js:37](../../../src/api/strfry/commands/publishEvent.js), the entire brain module), extended to `selfDeclare` so all three symmetric actions share one gate. Security posture verified: `src/middleware/auth.js` and `PUBLIC_MUTATIONS` byte-untouched; remote unauthenticated POSTs still 401 at default-deny (H8, passing pre and post); authenticated non-owners are refused by the first-line in-handler 403 — **no path reaches a write without the gate**, regardless of middleware routing; `localTrusted` is the unspoofable direct-local class (ADR security-auth-exposure/0001). The selfDeclare extension slightly *widens* loopback capability on an existing endpoint — accepted: loopback is the operator's own machine, the widening is deliberate, ADR-recorded, and F1 automation requires it.
- [x] **Deviation 2 — same-second re-sign race (AUDITED, REAL FIX):** the H-suite caught that two re-signs within one second tie on `created_at` and strfry's replaceable tie-break can drop the *newer* version — a genuine product race (defer-then-wire in one panel visit), latent in `selfDeclare` since it shipped. The monotonic bump (`max(now, prev+1)`) in all three re-sign paths is correct and bounded (one second per action; no runaway drift). This is the failing-tests-first contract *working*.
- [x] **Phase-4 test edit (S1 re-pin + H8 header reclassification) — ACCEPTED WITH REASONING:** the edit tracked the ADR correction rather than weakening coverage — the corrected S1 pins a *stronger* contract (the exact gate pair + ≥2 call sites) than the original middleware-name check; H8's reclassification documents a pre-existing middleware property, discovered honestly. Both were called out unprompted in the ADR note, the suite header, and the gate message. The blur the template warns against is real, and the transparency here is the correct handling of it.

## Concept-graph integrity

- [x] No concept definitions changed; **firmware reinstall: N/A** (matches ADR). No handles hardcoded — zero 64-hex literals added under `src/` or `ui/` (test-file fixture literals are the sanctioned exception).

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code.
- [x] Injection: the extended QUERY is static text on the public read-Cypher lane; `importEventDirect` is parameterized; `esc()` covers the eventSync tag path; the a-tag-form validation bounds `b-append`'s target before it touches Cypher or tags. React escaping covers the panel's community-sourced strings.
- [x] Concurrency: the created_at bump handles the sequential-re-sign race; truly concurrent same-header writes remain last-writer-wins (pre-existing replaceable-event semantics, unchanged scope).
- [x] The `useCommunitySharedConcepts` fetch runs per panel mount — mild redundancy, non-blocking (noted below).

## House rules check

- [x] Concept Graph API authority respected; no new tooling; OPEN.md #142 honored (new endpoints on the helpers spine; no new divergent sign/publish/import copies).

## Findings

### Blocking

None.

### Non-blocking

1. **[DispositionPanel.jsx](../../../ui/src/components/DispositionPanel.jsx)** — the community fetch re-runs on every panel mount; a session-level cache (or lifting the hook to ConceptList) would save relay round-trips during a long audit run. Fine for v1.
2. **[bDisposition.js](../../../src/api/concept/bDisposition.js)** — `strfryScan` now exists in two copies (selfDeclare's predates it). Both are #142-class inventory; consolidation stays with that row.
3. **`b-append` accepts an own-TA non-self target** (a b between two of the instance's own headers) — valid correspondence per the spec, just noting the surface permits more than the "external" label implies. F1 may want a foreignness affordance client-side.

### Harness friction

None new this story (the #143 interaction was anticipated in the story's Out of scope and did not bite — S4 asserts by absence, and no route was added).

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Book box **F5 ticked** in `engineering-team/audits/shared-concepts-adoption/book.md`; completion detection performed — book remains Open (F1–F4 unbuilt); result reported in chat.
