# Review: Story 7 — Tags & Taggings pre-NIP (synthesis — epic finale)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-10
**Diff:** commit `e7b4efe8` (4 files, +118/−6: `protocols/drafts/tags.md` new; `protocols/drafts/communities.md` marker repoints; `protocols/worksheet.md` W3/W4 refs + W10; `protocols/README.md` row 7 + completed-migration preamble)
**Contract:** `protocols-directory` ADR 0005 (full — family framing, D4 honest reconciliation, 9-heading skeleton, four-file scope, zero BIBLE diff); story ACs; synthesis traceability rule
**Method note:** implementation authored in this same session; audit fanned out to 8 independent agents across five dimensions (ADR conformance, boundary, traceability against both branches via `git show`, references/anchors, term-coverage first-class), all non-note findings adversarially verified.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (full suite)
- [x] Playwright — skipped: docs-only
- [x] Diff scope — exactly the ADR's four files; BIBLE absent from the commit; zero stale story-7 pending markers tree-wide
- [x] _Lint/typecheck/build not configured — skipped._

## ADR adherence

- [x] Skeleton: exactly the 9 fixed headings, in order.
- [x] Family framing: deployed instance vs planned siblings cleanly separated; **no wire format invented** for `nostr-event-tag`/`dlist-tag`; rename marked open + wire-impactful; W10's quote of the owner's gate guidance verified **verbatim** against the story record.
- [x] D4 presentation per contract: normative a-primary shape (verified tag-by-tag vs `feat/communities` ADR 0030); deployed-variant note **in spec text** (verified truthful vs `publishProfileTag.js` — no `a` emitted); union-read guidance; pending-confirmation status stated.
- [x] Treatments: both communities markers repointed with the breadcrumb; W3/W4 refs updated; README row 7 + preamble graduated to migration-complete (all seven rows ✅ — verified true).

## Boundary discipline

- [x] Zero stack machinery (no UI/TL-pipeline/`tl-pin`/Meili/PoV/endpoints/function names); zero hex pubkeys; the legacy literal absent; all three `z` handles deployment-neutral with the W1 pointer.
- [x] Dual normativity: the communities spec's assertion block now reads explicitly as consumption ("specified by Tags & Taggings… the shape consumed here"); worksheet entries point, don't restate.

## Traceability (synthesis rule)

- [x] Tag definitions vs the branch builder; assertion d-tag formula + content payload vs `publishProfileTag.js`; pin block + curation fields vs `publishTagPin.js` + ADR 0009; polarity buckets vs ADR 0001; unpinning vs ADR 0009; family tree vs the gate record (direction only). All verified at source; no survey-vs-source corrections needed.
- [x] The one raised traceability "blocker" — that the normative shape lists `a` while the deployed publisher omits it — was **refuted** by its adversarial verifier: presenting the corrected shape as normative *with* the deployed-variant disclosure is the ADR's explicit D4 decision (the rejected alternative was falsifying toward the deployed shape); the spec's disclosure makes the wire status truthful.

## Findings

Audit: 3 non-note findings raised → **0 confirmed, 3 refuted, 0 unverified**; 17 confirmatory notes.

### Blocking

None — the epic's first first-pass PASS.

### Non-blocking

1. Normative-`a` vs deployed-publisher tension — refuted (ADR-sanctioned D4 presentation; see Traceability).
2. Polarity "absent means apply" vs the shape listing `polarity` — refuted (the shape shows the tag's form; the prose defines absent-tag semantics; standard spec practice, both sourced to ADR 0001).
3. Union-read guidance actionability — refuted (adequate: `#a` by coordinate, legacy `#e` by the tag-element's event ids, both derivable from the spec's own definitions).
4. Notes for the eventual publication pass (no action now): `nip85:rank` is an identifier-by-convention (the spec says so); "the deployment's concept address" is the established chain-wide phrasing whose underlying question is W1.

## Verdict

**PASS** — first-pass, no kickback. The migration is complete: all seven specs live in `protocols/` as working copies, the communities dependency is closed, and the D4 reconciliation gives implementers a truthful read of the wire today while leaving the backfill decision where it belongs.
