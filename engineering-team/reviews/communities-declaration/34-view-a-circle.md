# Review: Story 34 — View a circle's definition (read-only)

**Reviewer:** Claude · **Date:** 2026-06-05 · **Epic:** `communities-declaration` · **Type:** Feature (Architecture folded into ADR 0029 — no new ADR).

## Quality gates
- [x] `node test/test.js` — **view-a-circle 5/5**; Overall PASS, no regression.
- [x] `npm run lint` clean · `npm run build` clean.

## Spec adherence (vs ACs)
- [x] AC-1 belonging-bar rendered as prose ([CommunityDetail.jsx](ui-communities/src/pages/CommunityDetail.jsx), `c.belongingBar`), read-only in the always-shown identity header (T1/T3).
- [x] AC-2 "Based on ‹parent›" affordance, gated on `c.parent`, linking to the parent circle by its slug (T2).
- [x] AC-3 no parent → no affordance (the block is `c.parent &&`).
- [x] AC-4 no owner/admin/moderator label — reworded the lone "no admin who can rug-pull" About line to "no central authority" (style-guide alignment) (T4).
- [x] AC-5 loading + error states untouched (T5).

## ADR adherence
Covered by ADR 0029 — renders the projection's `belongingBar` + `parent` fields; no new architecture. CSS uses tokens only (no hardcoded values).

## Findings
**Blocking:** none.
**Non-blocking:**
1. The parent affordance shows/links by the parent's **slug** (from the a-tag). Resolving and showing the parent's **name** (and the inherited-vs-overridden fields) is **Story 5**, by design.
2. The belonging-bar renders only for CD circles (bespoke records have no `belongingBar`); bespoke circles are unaffected.

## Verdict
**PASS.** 5/5, ADR-conformant, no regression. The read-only definition view now surfaces what a circle is and what it takes to belong, for any visitor.
