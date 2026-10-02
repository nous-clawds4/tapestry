# The smoke test's "new API endpoint? hit it" can't prove a new POST route shipped: staging and production answer every no-session outside POST with the same 401 before routing

**Id:** 2026-10-02-smoke-new-post-routes-masked
**Type:** meta
**Opened:** 2026-10-02 (list-headers-disposition book, `/cycle-staging` for PR #801)
**Status:** OPEN
**Done:** —

**What was seen.** `docs/SMOKE_TEST.md` Tier 3 says "New API endpoint? Hit it; verify response shape". Before PR #801
merged, a no-session POST from outside gave the same answer to all of these:
- `/api/list-headers/me/…/prepare`, a route that didn't exist yet;
- a made-up `/api/list-headers/nonexistent-route-xyz`;
- the existing `/api/list-headers/my-assistant/…`.

Each got 401 `{"error":"Authentication required for this action"}`. The auth middleware answers before routing, so
from outside a POST route looks the same whether or not it shipped.

**What worked:** the in-container loopback (SSH to the droplet, then
`docker exec tapestry curl -X POST http://127.0.0.1:7778/...`).
- That's `localTrusted`, so it passes the middleware and reaches routing.
- The new routes answered **404 before the merge** and the handlers' own body, 401 `{"success":false,...}`,
  **after** it.
- Nothing can be written: a call with no session is refused by the handler itself.

This is the recipe in agent memory `router-owner-gate-and-guest-smoke`. Nothing in `docs/SMOKE_TEST.md` points to
it, and a run that follows the doc as written would report a route as shipped when it isn't.

**Fix shape:**
- Add a Tier 3 bullet to `docs/SMOKE_TEST.md`: for a new mutating route, take a before-and-after reading over the
  in-container loopback (404, then the handler's body). Never accept an outside 401 as proof.
- Name the staging SSH key and container there, or point at OPERATIONS.md.
- Production has no key on the Mac Studio, so there the bundle hash and the CI run are the proof. Say so.

**Pointer:** `engineering-team/audits/list-headers-disposition/audit.md` § 7.
