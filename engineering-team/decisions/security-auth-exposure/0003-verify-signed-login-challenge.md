# ADR 0003: Verify the signed login challenge; establish identity only on a verified login

**Status:** Proposed
**Date:** 2026-09-11
**Story:** `engineering-team/stories/security-auth-exposure/3-login-signature-verification.md`
**Extends:** the `security-auth-exposure` family (ADR 0001 honest-local bypass, ADR 0002 default-deny). Does **not** supersede either, and **does not touch** `PUBLIC_MUTATIONS`, the `localTrusted` bypass, or the `/api/auth/*` middleware exemption — those stay exactly as ADR 0001/0002 left them.

## Context

The control-panel login endpoints grant an authenticated (owner/admin) session on a nostr event whose **signature is never verified**. Both handlers trust only `event.pubkey === session.pubkey` + a `['challenge', …]` tag:

- `handleAuthLogin` — `POST /api/auth/login` (`src/middleware/auth.js:108`); also stores a client-supplied `nsec` (`:160-163`).
- `handleAuthLoginUser` — `POST /api/auth/login-user` (`src/middleware/auth.js:529`).

The challenge is issued by `handleAuthVerify` (owner, `:77-78`) and `handleAuthVerifyUser` (any hex pubkey, `:503-504`), both of which set `req.session.pubkey` **before any proof** — the primitive the story's reframe targets. `/api/auth/*` is deliberately exempt from `authMiddleware` (`:308`), so the whole handshake is public by design (correct — it's the pre-auth handshake).

**Acceptance criteria (quoted from the story):** invalid signature → failure + `status.authenticated:false`; valid signature → authenticated; `created_at` outside a freshness window → fail; a challenge consumed by any attempt (success *or* failure) → single-use; wrong kind → fail; a mere challenge request establishes **no** session identity; no login path accepts/stores `nsec` and the paste-nsec page is retired; session id regenerated on success; both handlers enforce all of it and the React login still works; tests for bogus-sig / valid-sig / stale-`created_at` / replayed-challenge.

Constraints pulled from the code:

1. **`nostr-tools ^2.10.4` is already present** and `verifyEvent` is already used server-side (`src/api/event/eventReadPath.js:38-43` — try `NOSTR_TOOLS_PATH` then bare `require('nostr-tools')`; `src/api/_shared/relaySource.js:122`). No new dependency.
2. **Two client auth-event kinds are live** — the React app signs **kind 22242** (`ui/src/context/AuthContext.jsx:116`), while the three legacy static pages sign **kind 27235** (`public/pages/sign-in.html:78`, `sign-in-owner.html:80`, `sign-in-with-nsec.html:101`). A strict single-kind check would break the legacy pages. All live clients sign **real NIP-07 events** (`window.nostr.signEvent`), so verification is transparent to them; only forged/unsigned callers and the retired nsec page are affected.
3. **`session.pubkey` is the authority.** `isOwnerOrAdmin(req)` (`:250-258`, checks `authenticated && pubkey`), `handleAuthStatus` (`:196-202`), and (per the 2026-09-11 audit) several other consumers read `session.pubkey`. If it is set only on a verified login, none of them can be driven by an unauthenticated challenge request.
4. **Session store supports regeneration.** `express-session ^1.18.1` + `connect-redis ^7.1.1` (`bin/control-panel.js:195-204`); `req.session.regenerate()`/`save()` are available and unused today.
5. **Dead/removable session fields (audit):** `req.session.nsec` is written (`:161`, and `src/api/export/nip85/commands/kind10040.js:133`) and **read nowhere**; `userPubkey`/`isOwner`/`isCustomer` (`:558/565/569`) have **zero readers**.
6. `sign-in-with-nsec.html` has **no inbound links** (grep) and is reachable only via the `/legacy/*` + bare-`.html` static serving — deleting the file removes reachability.

**No concept-graph concepts are in scope** (control-panel auth middleware; the story's "Concepts touched: None"). Per the AGENTS.md §2 ladder, the concept-graph orientation step is N/A here.

## Options considered

### Option A — Shared verify helper + pending-identity reframe + session regeneration *(chosen)*

One module-local verification routine used by **both** login handlers; the verify handlers stop establishing identity (they stash a **pending** claim); the login handlers verify, then regenerate the session and set the authoritative identity; `nsec` handling is deleted and the paste-nsec page retired.

- **Pros:** single verification path (the two handlers can't drift); realizes the story's core-intent reframe (identity only on a verified login), which as a side effect removes the pre-auth `session.pubkey` that the deferred audit finding relies on; minimal, well-scoped diff (one middleware file + delete one static page).
- **Cons:** login handlers become async (regenerate/save callbacks); a small refactor of four handlers rather than a one-line guard.

### Option B — Inline verification in each handler, no reframe

Add `verifyEvent` + kind + `created_at` + single-use inline in each handler; leave `verify`/`verify-user` setting `session.pubkey`.

- **Pros:** smallest possible diff.
- **Cons:** duplicates the security-critical logic across two handlers (drift risk — the exact failure mode that produced this bug); does **not** deliver the reframe, so the pre-auth `session.pubkey` primitive stays live (the deferred audit finding remains fully exploitable). **Rejected** — it re-creates the divergence that caused the bug and leaves the class open.

### Sub-decision 1 — the kind check: allowlist `{22242, 27235}` *(chosen)* vs single `22242`

Chosen: accept a named set `AUTH_EVENT_KINDS = {22242, 27235}`. Both are auth-handshake kinds actually in use (constraint 2); the challenge-tag binding is the real anti-cross-use guard, and the allowlist still rejects an arbitrary kind (satisfying "wrong kind → fail"). Single-`22242` was rejected because it would break `sign-in.html` and `sign-in-owner.html` without a client change. The client kind inconsistency is pre-existing debt; consolidating on 22242 is a future follow-up (out of scope).

### Sub-decision 2 — the legacy `/api/auth/login` endpoint: keep + harden *(chosen)* vs remove

Chosen: keep both `/api/auth/login` and `/api/auth/login-user` and route both through the shared helper. `sign-in-owner.html` (owner, no nsec) still uses `/api/auth/login`; hardening it in place is a smaller, safer change than removing the endpoint and consolidating clients. Only the **nsec paste** page is retired. Endpoint consolidation is a possible future follow-up (out of scope).

## Decision

**Option A**, with sub-decisions 1 and 2. Coordinated changes, all in `src/middleware/auth.js` except the page deletion.

**1. Module-level verification primitive (new, in `src/middleware/auth.js`).**
```
// resilient require, mirroring src/api/event/eventReadPath.js:38-40
let _verifyEvent = null;
try { _verifyEvent = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools').verifyEvent; }
catch { try { _verifyEvent = require('nostr-tools').verifyEvent; } catch { _verifyEvent = null; } }

const AUTH_EVENT_KINDS = new Set([22242, 27235]);
const AUTH_EVENT_MAX_AGE_S = 600; // ±10 min; tunable. Secondary to the single-use challenge.

function verifyLoginEvent(event, { challenge, expectedPubkey }) {
  if (!_verifyEvent) return { ok: false, reason: 'verifier unavailable' };
  if (!event || typeof event !== 'object') return { ok: false, reason: 'no event' };
  if (!AUTH_EVENT_KINDS.has(event.kind)) return { ok: false, reason: 'bad kind' };
  // BIND the signed event to the pubkey the challenge was issued for. This, together
  // with the signature check below, is the actual security property: verifyEvent proves
  // the sig is valid FOR event.pubkey, and this proves event.pubkey is who we challenged.
  if (event.pubkey !== expectedPubkey) return { ok: false, reason: 'pubkey mismatch' };
  const tag = Array.isArray(event.tags) && event.tags.find(t => t[0] === 'challenge');
  if (!tag || tag[1] !== challenge) return { ok: false, reason: 'bad challenge' };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(event.created_at)) > AUTH_EVENT_MAX_AGE_S) return { ok: false, reason: 'stale' };
  // Verify a JSON round-trip so a client-attached `verifiedSymbol` cache / getters can't be trusted.
  let verified = false;
  try { verified = _verifyEvent(JSON.parse(JSON.stringify(event))) === true; } catch { verified = false; }
  return verified ? { ok: true } : { ok: false, reason: 'bad signature' };
}
```

**2. Session-finalize helper (new).** Regenerate to defeat fixation, then set the *minimal* authenticated shape:
```
function finalizeAuthenticatedSession(req, pubkey) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(err => {
      if (err) return reject(err);
      req.session.authenticated = true;
      req.session.pubkey = pubkey;              // authoritative identity — set ONLY here
      req.session.save(err2 => err2 ? reject(err2) : resolve());
    });
  });
}
```

**3. Reframe the verify handlers — stash a pending claim, never identity.**
- `handleAuthVerify` (`:77-78`) and `handleAuthVerifyUser` (`:503-504`): replace `req.session.challenge = …; req.session.pubkey = …;` with `req.session.pendingAuth = { pubkey, challenge };` (delete the pre-auth `req.session.pubkey` write). Keep everything else (owner-gate in `verify`; 64-hex validation + role hints in `verify-user`).

**4. Rewrite both login handlers (async) to verify → single-use → regenerate.**
- Read `const pending = req.session.pendingAuth`; 400 if absent.
- `const result = verifyLoginEvent(event, { challenge: pending.challenge, expectedPubkey: pending.pubkey })`.
- **Single-use, always:** `delete req.session.pendingAuth` (and legacy `delete req.session.challenge`) on **every** path — success or failure — before responding. A retried challenge then finds no pending → rejected.
- On failure: return the existing `{ success:false, message }` shape (no session change).
- On success: `await finalizeAuthenticatedSession(req, pending.pubkey)`; then compute `isOwner`/`isCustomer` from config for the response body (as `login-user` does at `:561-565`) and return the existing success shape. Wrap in try/catch → 500 on regenerate/save error.
- **Delete the `nsec` handling** in `handleAuthLogin` (`:160-163`) and drop `nsec` from the destructure (`:110`). Do **not** set `userPubkey`/`isOwner`/`isCustomer` on the session (dead — `:558/565/569`); the response body still reports role.

**5. Retire the nsec paste flow.** Delete `public/pages/sign-in-with-nsec.html` (no inbound links; removal ends reachability). No other page/endpoint changes.

`isOwnerOrAdmin` (`:250-258`) and `handleAuthStatus` (`:196-202`) are unchanged — they already key off `session.pubkey`+`authenticated`, which are now set only post-verification.

**How the cases resolve:**

| Caller | Result |
|---|---|
| `verify`/`verify-user` with any pubkey, then `login` with **all-zeros sig** (the repro) | login **fails**; `pendingAuth` cleared; `status.authenticated:false` |
| Valid NIP-07 signed event (kind 22242 *or* 27235), correct pubkey + fresh challenge | authenticated; session **regenerated**; role reported |
| Valid sig but `event.pubkey` ≠ challenged pubkey | fail (`pubkey mismatch`) — prevents "sign with my own key, log in as owner" |
| Valid sig but `created_at` outside ±600 s | fail (`stale`) |
| Replay the same challenge (after any prior attempt) | fail (no `pendingAuth`) |
| Only called `verify`/`verify-user`, no login | **no identity**: `session.pubkey` unset, `status.authenticated:false` |
| React app / `sign-in.html` / `sign-in-owner.html` (real NIP-07 sigs) | unchanged — still log in |
| `sign-in-with-nsec.html` | gone (retired) |

## Consequences

- **Closes the auth bypass:** knowledge of a public key no longer yields a session; only proof-of-control does. `nsec` is never accepted or stored on any login path.
- **Side-effect on the deferred audit finding (F2):** because the pre-auth `session.pubkey` write is removed, consumers that read `session.pubkey` without checking `authenticated` no longer see an identity from a mere challenge request — substantially removing that finding's *unauthenticated* exploitability. The per-consumer `authenticated`-check hardening remains a deferred follow-up (defense-in-depth); the Tester/Reviewer should not assume this ADR fully closes it.
- **Residual, out of scope (declined story adjustment #4):** `POST /api/publish-kind10040-event` (`src/api/export/nip85/commands/kind10040.js:129,133`) still sets `session.authenticated=true` from an unverified event (post-auth only — not a bypass) and still writes the now-dead `session.nsec`. Left to the F6 follow-up; noted so the Reviewer doesn't read it as a regression of this ADR.
- **New debt:** the 22242/27235 client-kind split is ratified as an allowlist rather than fixed; login handlers become async. Follow-ups (out of scope): consolidate clients on 22242, unify the two login endpoints, remove the dead `session.nsec` write in `kind10040.js`.
- **Firmware reinstall required?** **No** — auth-middleware code + one static-page deletion; no concept definitions change.

## Implementation notes

- `src/middleware/auth.js` — add the module-level `verifyEvent` require + `AUTH_EVENT_KINDS` + `AUTH_EVENT_MAX_AGE_S` + `verifyLoginEvent()` + `finalizeAuthenticatedSession()` near the top.
- `src/middleware/auth.js:77-78` (`handleAuthVerify`) and `:503-504` (`handleAuthVerifyUser`) — set `req.session.pendingAuth = { pubkey, challenge }`; remove the pre-auth `req.session.pubkey` assignment.
- `src/middleware/auth.js:108-176` (`handleAuthLogin`) — make async; drop `nsec` from the destructure and delete `:160-163`; read `pendingAuth`; verify via helper; clear pending on every path; regenerate+finalize on success; try/catch → 500.
- `src/middleware/auth.js:529-588` (`handleAuthLoginUser`) — same rewrite; keep the config-derived `isOwner`/`isCustomer` in the response body; stop writing the dead session fields.
- `public/pages/sign-in-with-nsec.html` — delete.
- No change to `src/api/index.js` route wiring, `authMiddleware`, `isOwnerOrAdmin`, `handleAuthStatus`, `bin/control-panel.js`, or the React client.
- **Test-file changes are Phase 3 (Tester's lane).** What must be covered (from the ACs): (1) all-zeros / bogus sig → failure + `status.authenticated:false`; (2) valid signed event (mint with nostr-tools `generateSecretKey`/`getPublicKey`/`finalizeEvent`; use the issued challenge) → authenticated — for the owner-accept case set `BRAINSTORM_OWNER_PUBKEY` to the test key or exercise the non-owner `-user` path; (3) `created_at` outside ±600 s → fail; (4) replayed challenge (second attempt, same challenge) → fail; (5) wrong kind (e.g. 1) → fail; (6) valid sig but `event.pubkey` ≠ challenged pubkey → fail; (7) after success the session id changed (regeneration) and holds no `nsec`; (8) both `/api/auth/login` and `/api/auth/login-user`. Existing auth-middleware suites `test/close-unauth-write-surface.test.js` and `test/default-deny-mutations.test.js` show the mock-`req`/session harness style.

## Out of scope

- The deferred audit follow-ups F1–F5 (tracked privately; see the story's Out of scope and the private advisory) — including F2's per-consumer `authenticated` checks and the F6 `kind10040.js` writer.
- Consolidating clients on a single auth kind; unifying the two login endpoints; removing the dead `session.nsec` write in `kind10040.js`.
- Rate-limiting challenge issuance (a signed-challenge login can't be brute-forced; challenge issuance is a minor DoS surface, not an auth gap).
- Operator-side companions (Neo4j password/ports) — book-tracked.
