# Epic: list-headers-disposition — dispositioning headers on List Headers, signed only by you or your own Assistant

**Status:** Active
**Created:** 2026-10-01
**Book:** `engineering-team/audits/list-headers-disposition/book.md` (no PRD — acceptance frame)

## Goal

**Let a signed-in person decide what each of their own list headers is, as far as sharing goes,
from the List Headers page.** The choices are: submit it as a Shared Concept, keep it private, or
wire it to someone else's shared concept. The person can act only on headers they wrote or their
own Assistant wrote. Their own key or their own Assistant signs the result, never anyone else's.

Concept Headers already has these actions. There, every click is signed by the Owner's Assistant,
and any admin can make one. This epic builds the same feature on List Headers under the stricter
rule, and leaves Concept Headers alone.

## Stories

All four are features, so all take the five phases (Standard). They're built in this order.

1. `1-author-selector-me-and-my-assistant.md`: **Me** and **My Local Tapestry Assistant** in the
   Author selector. Read-only.
2. The 🧭 b-disposition column. Read-only. Doesn't need #1.
3. Disposition on **My Assistant** rows: the panel and its three actions, signed by the person's
   own Assistant. Depends on #2.
4. Disposition on **Me** rows: the same panel and actions, signed by the person's own browser
   signer. Depends on #3.

## Key facts / guardrails

- **"Whose headers?" is this epic's POV question.** The answer is always *the signed-in person's*:
  headers their account signed, and headers the Assistant this instance holds for them signed.
  Two people on the same instance see different **Me** and **My Assistant** rows.
- **Nobody triggers somebody else's signer.** Not an admin, not the owner, not a caller with no
  session. This is the epic's hard rule (book decisions 1, 2 and the implied rule).
- **The 🧭 column reports; it doesn't gate.** Every author's headers show their disposition.
  Only the signed-in person's own rows get actions (principle 2: publishing is permissionless;
  this rule is about whose *signer* acts, not whose events count).
- **Concept Headers is untouched.** Its buttons and their endpoints behave as before. Their fix is
  a later book (ledger row).
