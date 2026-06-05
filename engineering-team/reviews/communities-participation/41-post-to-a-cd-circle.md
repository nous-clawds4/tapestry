# Review: Story 41 — post to a CD circle (NB-1)

**Reviewer:** Claude · **Date:** 2026-06-05 · **Type:** Bug/Feature (ADR 0029; no new ADR).

## Quality gates
- [x] `node test/test.js` — **post-to-cd-circle 3/3**; Overall PASS, no regression (participate-kind1 suite still green).
- [x] `npm run lint` clean · `npm run build` clean.

## Spec adherence
- [x] Post anchor derives from the circle model: `39998` for `declaration`, `39999` otherwise (T1) — closes Story 33's NB-1.
- [x] Posting wiring intact: `buildCommunityPost` + `publishEvent` + `fetchPostsForCommunity` now use the model-correct anchor (T2/T3).
- [x] Bespoke circles unaffected (anchor unchanged for non-declaration).

## Findings
**Blocking:** none.
**Non-blocking:**
1. Posting is gated client-side on `signedIn && joined` (interim, PRD Open Q#5); the trust-based gate is Block 5.
2. kind-1111 posts carry the NIP-22 `A` root referencing the circle; for a CD that root is now a kind-39998 address. The `buildCommunityPost` `K`/`k` tags carry the parent kind from the a-tag prefix (39998 for CDs) automatically.

## Verdict
**PASS.** Conversations now round-trip on Community-Declaration circles. **Block 4 complete.**
