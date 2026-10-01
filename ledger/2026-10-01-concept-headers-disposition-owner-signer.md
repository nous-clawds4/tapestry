# Concept Headers' Disposition actions always sign as the Owner's Assistant, and any admin (or a no-session loopback call) can trigger them

**Id:** 2026-10-01-concept-headers-disposition-owner-signer
**Type:** bug
**Opened:** 2026-10-01 (list-headers-disposition intake; the owner's question about who authors Submit as a Shared Concept)
**Status:** OPEN
**Done:** —

**What was seen.** **Submit as a Shared Concept**, **Keep private** and **Wire** on Concept Headers
(`DispositionPanel.jsx` → `POST /api/concept/:handle/self-declare`, `/b-defer`, `/b-append`) re-sign the header
with the Owner's Assistant key (`loadTAKey()` → the `tapestry-assistant` slot). The gate is `isOwner(req) ||
req.localTrusted`, and `isOwner` is `isOwnerOrAdmin` (`src/middleware/auth.js:291`). So any signed-in admin, or any
no-session call from inside the container, makes the Owner's Assistant publish, with the Owner absent. A customer
gets 403; an unauthenticated browser call gets 401 (checked against localhost:7778, 2026-10-01). The same endpoint
sits behind the Submit buttons on Concept Detail and the Adoption Queue.

The owner's rule (2026-10-01): nobody can trigger somebody else's Assistant to publish anything. The owner chose to
build the corrected feature on List Headers first (book `list-headers-disposition`) and fix Concept Headers later:
"In the future, we will fix this in Concept Headers."

**Fix shape.** Bring the three endpoints (and their three callers) under the rule the List Headers book settles:
the signer is the signed-in person's own key or their own Assistant, never the Owner's for someone else, and no
session means no signer. Fix it together with OPEN.md row `2026-10-01-new-dlist-assistant-signer`.

**Pointer:** `engineering-team/audits/list-headers-disposition/book.md` § Decisions at intake; `src/api/concept/selfDeclare.js:53`,
`src/api/concept/bDisposition.js:40`.
