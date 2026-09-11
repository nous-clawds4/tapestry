# Book of Work: Login signature verification (auth-bypass fix)

**Slug:** auth-signature-verification
**Status:** Open
**Opened:** 2026-09-11
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** Close the control-panel authentication bypass: the login handshake must require proof of key control, not just knowledge of a public key.

### Acceptance frame

- [ ] A caller who knows only an owner/admin **public** key can no longer obtain an authenticated (or owner) session — the documented all-zeros-sig repro returns failure and `GET /api/auth/status` stays `authenticated:false`.
- [ ] A caller who **validly signs** the issued challenge is authenticated as before (owner UI and the React `login-user` flow keep working).
- [ ] Stale/future-dated events and replayed challenges are rejected; challenges are single-use.
- [ ] The session no longer stores a client-supplied `nsec`, and the session id is regenerated on login (session-fixation resistant).
- [ ] Automated tests prove: bogus sig rejected, valid sig accepted, stale `created_at` rejected, replayed challenge rejected.
- [ ] Shipped through `staging` → `main`/prod (identical exposure on both), sandboxes to follow; public-facing text kept minimal until prod is patched.

## Epics in this book
- `security-auth-exposure` — reopened. Stories 1–2 closed the loopback-bypass / default-deny surface; story 3 (this book) closes the forgeable-login root cause.

## Companion operator-side tasks (NOT code — tracked here so they aren't lost)
- None new for this book. (Neo4j password / port items live under the original `security-auth-exposure` book.)

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/auth-signature-verification/audit.md`
- Product feedback: `engineering-team/audits/auth-signature-verification/prd-seed.md`
