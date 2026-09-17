# Book of Work: Login signature verification (auth-bypass fix)

**Slug:** auth-signature-verification
**Status:** Closed
**Opened:** 2026-09-11
**Closed:** 2026-09-11

## Intent anchor

**Acceptance frame (no PRD).** Close the control-panel authentication bypass: the login handshake must require proof of key control, not just knowledge of a public key.

### Acceptance frame

- [x] A caller who knows only an owner/admin **public** key can no longer obtain an authenticated (or owner) session — the documented all-zeros-sig repro returns failure and `GET /api/auth/status` stays `authenticated:false`.
- [x] A caller who **validly signs** the issued challenge is authenticated as before (owner UI and the React `login-user` flow keep working).
- [x] Stale/future-dated events and replayed challenges are rejected; challenges are single-use.
- [x] The session no longer stores a client-supplied `nsec`, and the session id is regenerated on login (session-fixation resistant).
- [x] Automated tests prove: bogus sig rejected, valid sig accepted, stale `created_at` rejected, replayed challenge rejected.
- [x] Shipped through `staging` → `main`/prod (identical exposure on both), sandboxes to follow; public-facing text kept minimal until prod is patched.

## Epics in this book
- `security-auth-exposure` — story 3 added here. The epic **stays Done** (its prior book is Closed); this open book carried the active-work signal, not a reopened epic (see audit §7 / OPEN.md row 268). Story 3 closes the forgeable-login root cause; stories 1–2 shipped under the prior book.

## Companion operator-side tasks (NOT code — tracked here so they aren't lost)
- None new for this book. (Neo4j password / port items live under the original `security-auth-exposure` book.)

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — shipped and verified end-to-end on staging + prod (live login round-trip).

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/auth-signature-verification/audit.md`
- Product feedback: `engineering-team/audits/auth-signature-verification/prd-seed.md`
