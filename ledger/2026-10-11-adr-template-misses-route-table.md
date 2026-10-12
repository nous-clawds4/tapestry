# The ADR template does not prompt for a new route's entry in the fail-closed route table

**Id:** 2026-10-11-adr-template-misses-route-table
**Type:** meta
**Opened:** 2026-10-11 (assistant-duty-menu #2 review, harness friction)
**Status:** OPEN
**Done:** —

**What happened.** `src/middleware/routeAccess.js` is total and fail-closed (ADR security-auth-exposure/0005). A
route with no entry is the owner's side's, so a customer-facing route without one silently becomes owner-only. ADR
assistant-duty-menu/0002 designed a new signed-in route and named no table entry. The Implementer found the gap, and
it cost an amendment and a Tester round (ADR 0002 Amendment 2 item 1).

**Fix shape.** `engineering-team/templates/adr.md`, Implementation notes: "A new or changed route: its
`routeAccess.js` entry (access, kind, why)". Optionally, the Architect role's pitfalls list gains the same line.

**Pointer:** `engineering-team/reviews/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.md` (Harness
friction); ADR assistant-duty-menu/0002 Amendment 2.
