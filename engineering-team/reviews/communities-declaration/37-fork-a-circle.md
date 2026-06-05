# Review: Story 37 — Fork a circle

**Reviewer:** Claude · **Date:** 2026-06-05 · **Type:** Feature (ADR 0029 + 0028/§26; no new ADR).

## Quality gates
- [x] `node test/test.js` — **fork-a-circle 6/6**; Overall PASS, no regression (found-a-circle still 10/10 with the builder's omit-empty change).
- [x] `npm run lint` clean · `npm run build` clean.

## Spec adherence
- [x] Fork action on a CD circle's detail → `/found?from=<aTag>` (T4).
- [x] Found flow reads `?from`, pre-fills from the parent's **resolved** definition (Story 36 resolver) (T1/T2).
- [x] Publish writes a CD with a `b` parent tag (T5).
- [x] **Live inheritance:** unchanged-vs-baseline fields are omitted (builder omits empty optional fields) so they inherit; changed fields are written (T5/T6).
- [x] Sign-in only at publish; founder lands on the new circle (preserved from Story 33).

## ADR adherence
Forkable kind-39998 CD via `b` (ADR 0029) consuming the §26 resolver (ADR 0028). The builder's omit-empty change is backward-compatible — founding (non-empty fields) still writes them, so found-a-circle T2/T4 stay green.

## Findings
**Blocking:** none.
**Non-blocking:**
1. Slug of a fork derives from the (possibly inherited) effective name at fork time — a snapshot for identity, while the name *tag* still inherits live if unedited. Intended.
2. Fork is offered only for `model === 'declaration'` circles (bespoke kind-39999 circles can't be the parent of a CD fetch). Correct per the strangler.
3. Multi-parent fork UI is out of scope (the builder/resolver support it; the flow writes a single `b`).

## Verdict
**PASS.** Forking stands on a parent's resolved definition and overrides only what changed — live inheritance per §26.
