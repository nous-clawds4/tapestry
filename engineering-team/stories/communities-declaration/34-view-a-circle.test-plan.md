# Test Plan: Story 34 — View a circle's definition (read-only)

**Story:** `communities-declaration/34-view-a-circle.md` · **ADR:** covered by 0029 · **Date:** 2026-06-05

## Coverage map
| Criterion | Test | File |
|---|---|---|
| AC-1 belonging-bar shown | T1, T3 | `test/view-a-circle.test.js` |
| AC-2 "Based on ‹parent›" when forked | T2 | same |
| AC-3 no "Based on" without parent | T2 (gated on `.parent`) | same |
| AC-4 no owner/admin/moderator label | T4 | same |
| AC-5 loading/error preserved | T5 | same |

## Edge cases
- [ ] Circle with no belonging-bar → nothing rendered (conditional).
- [ ] Parent a-tag → linked by its slug segment (full parent-name resolution is Story 5).

## Infrastructure
Node runner (`node test/test.js`), source-regex over `CommunityDetail.jsx`. No firmware/stack precondition. Registered as the `view-a-circle` suite.

## Initial state (TDD)
T1–T4 failed before impl (belonging-bar/parent not rendered; an "admin" word in the About copy). T5 green throughout.

## How to run
`npm test`
