# Story 3: Login endpoints must verify the signed challenge (auth bypass)

**Status:** Draft
**Created:** 2026-09-11
**Type:** Bug (security / authentication)
**Epic:** `security-auth-exposure`

## Background

The control-panel login endpoints grant an authenticated session on a nostr event whose **signature is never verified**. Both handlers accept a client-supplied event and trust only `event.pubkey === session.pubkey` plus a `['challenge', <session challenge>]` tag:

- `handleAuthLogin` — `POST /api/auth/login` (`src/middleware/auth.js:108`), the legacy owner flow. A code comment at ~line 117 admits there is no verification. It also stores a client-supplied `nsec` in the session (~line 160).
- `handleAuthLoginUser` — `POST /api/auth/login-user` (`src/middleware/auth.js:529`), the path the React UI uses (`ui/src/context/AuthContext.jsx` signs a kind-22242 event with `tags:[['challenge', c]]`).

Both are wired with no middleware (`src/api/index.js:149–156`) and the auth middleware deliberately skips `/api/auth/*`, so the handshake is fully public. `handleAuthVerify` / `handleAuthVerifyUser` hand a fresh challenge to anyone who presents a pubkey and set `req.session.pubkey`; `isOwnerOrAdmin(req)` (~line 250) then trusts `req.session.pubkey` once `authenticated` is set.

Because an owner/admin **public** key is, by nature, public, anyone can complete the handshake with an unsigned event and obtain a full owner session. Documented repro (LOCAL ONLY): `verify-user {pubkey:<owner hex>}` → keep challenge + cookie → `login-user {event:{kind:22242, pubkey:<owner hex>, created_at:<now>, tags:[['challenge',<c>]], content:'', id:'0'×64, sig:'0'×128}}` → `200 {success:true, isOwner:true}` → `GET /api/auth/status` → `authenticated:true`.

Confirmed 2026-09-11. The auth files are byte-identical on `staging` and `main`, so the exposure is live and identical on `staging.brainstorm.world`, `tapestry.brainstorm.world`, and the sandbox branches forked from staging.

**Related weaknesses to close in the same fix:** client-supplied `nsec` stored in the session; challenges not invalidated after an attempt (replayable); no `kind` or `created_at` checks; no session regeneration on login (session fixation).

**Session-shape facts (from the 2026-09-11 audit, so the fix doesn't break a reader):**
- `req.session.nsec` is **written** at `auth.js:161` and at `src/api/export/nip85/commands/kind10040.js:133`, and **read nowhere** in `src/` or `bin/` (whole-repo grep). It is dead-but-persisted in the Redis session store — safe to stop writing.
- `req.session.userPubkey` (`auth.js:558`), `req.session.isOwner` (`:565`), `req.session.isCustomer` (`:569`) have **zero readers** anywhere — safe to drop or repurpose during the session-regen change.
- **A third endpoint is a second writer of `session.authenticated=true` and `session.nsec`:** `POST /api/publish-kind10040-event` (`src/api/export/nip85/commands/kind10040.js:129,133`). It requires an already-authenticated session to reach (not a standalone bypass), but it re-sets the same session fields this story changes. The Architect must account for it when changing the session shape / removing `nsec`, and decide whether to fold its handling into this story or a follow-up.

This story reuses the (reopened) `security-auth-exposure` epic. Stories 1–2 closed the loopback-bypass / default-deny surface; this closes a distinct root cause: authentication itself is forgeable. `nostr-tools ^2.10.4` is already a dependency and `verifyEvent` is already used correctly on several read/publish paths (e.g. `src/api/_shared/relaySource.js:122`, `src/api/event/eventReadPath.js:39`).

## User-facing description

As the operator of a Brainstorm deployment, I want the control panel to grant a session only to someone who can **cryptographically prove** control of a pubkey, so that knowing a public key — mine or an admin's — does not let a stranger obtain an owner session and act as me.

**Core intent (Planning decision 2026-09-11): identity is established only by a verified login.** Requesting a login challenge must establish *nothing* on its own — a claimed pubkey becomes the session's identity only once its challenge is answered with a valid signature. (This is the deeper framing of the bug: today a challenge request alone sets a claimed pubkey into the session, and the login step then rubber-stamps it. The fix is that neither step establishes identity without proof.)

## Acceptance criteria

Testable from the outside. Each gets at least one test.

- [ ] Given a challenge issued by `verify` / `verify-user`, when `login` / `login-user` is called with an event bearing that challenge tag but an **invalid signature** (including the all-zeros-sig repro), then the response indicates failure and `GET /api/auth/status` returns `authenticated:false`.
- [ ] Given a fresh challenge, when `login` / `login-user` is called with a **validly signed** event (correct kind, fresh timestamp, exact challenge match), then the session becomes authenticated and `status` reflects the caller (owner / admin / user as appropriate).
- [ ] Given a validly signed event whose `created_at` is **outside the allowed freshness window** (stale or far in the future), then login fails.
- [ ] Given a challenge already consumed by one login attempt — **success or failure** — when the **same challenge** is presented again, then it is rejected (single-use).
- [ ] Given an event of the **wrong kind**, then login fails.
- [ ] Given a caller that only requested a challenge (`verify` / `verify-user`) but did **not** complete a verified login, then the session carries **no authenticated identity**: `GET /api/auth/status` returns `authenticated:false`, and no authoritative session identity (`session.pubkey`) is established for the claimed pubkey. (Requesting a challenge establishes nothing; only a verified login does.)
- [ ] No login path **accepts or stores a client-supplied `nsec`** (the field is ignored and no longer read), and the paste-your-nsec sign-in flow (`sign-in-with-nsec.html`) is **retired, not hardened**. After a successful login the session contains no `nsec`, and the pre-login session identifier is **not reused** (regenerated) — resistant to session fixation.
- [ ] Both handlers (`login` and `login-user`) enforce all of the above, and the React UI login (`login-user`) still works end-to-end for a legitimately signed challenge.
- [ ] Automated tests cover, at minimum: bogus signature rejected, valid signature accepted, stale `created_at` rejected, replayed challenge rejected.

## Concepts touched

None. This is control-panel auth-middleware behavior, not a concept-graph concept.

## Out of scope

- Other control-panel paths that trust client-supplied identity/events without verification, surfaced by the 2026-09-11 audit and **deferred** as separate follow-ups. Some are live and unpatched and the repo is public, so their specifics are held out-of-band (SECURITY.md → private advisory), not restated here; a minimal breadcrumb is in `stories/_intake.md` (2026-09-11). This story does not close them, with **one deliberate consequence of the reframe**: because this story stops establishing a session identity from a mere challenge request, the pre-auth `session.pubkey` that some of those paths read is no longer set — which substantially removes their unauthenticated exploitability. The broader per-consumer `authenticated`-check audit (making each consumer defensive in its own right) remains a deferred follow-up; the Architect confirms how far the reframe reaches.
- Operator-side companions (Neo4j password rotation, port firewalling) — not code, tracked in the book.

## Open questions

- Freshness-window size for `created_at` (Architect / Tester) — must tolerate real client clock skew without leaving a wide replay window.
- **RESOLVED by audit** — `req.session.nsec` is read nowhere server-side, so it is safe to stop writing it (both writers noted above).
- **RESOLVED by audit** — the legacy `POST /api/auth/login` + `nsec` flow is called only by two static pages: `public/pages/sign-in-owner.html` (no nsec) and `public/pages/sign-in-with-nsec.html` (sends the nsec typed into a form). The React UI uses `-user`. Removing `nsec` handling breaks only `sign-in-with-nsec.html` — and per the Planning decision that page's paste-nsec flow is **retired, not hardened** (see acceptance criteria). Whether `sign-in-owner.html` + the legacy `/api/auth/login` endpoint are kept (hardened) or consolidated onto the `-user` path is an Architecture call.

## Disclosure note

Repo is PUBLIC and SECURITY.md routes reports to private GitHub advisories. Keep the commit message, PR title/body, and any OPEN.md / issue text **minimal and non-exploit** until prod is patched. The login-bug detail in this story ships with its fix (the fix diff reveals it anyway — standard for a public-repo security fix, acceptable because the fix lands at the same time). The **deferred** follow-ups (F1–F5 from the audit) are the opposite case — unpatched — so their specifics are held out-of-band in a private advisory, not in any committed file, until each is patched.

## Linked artifacts
- ADR: `engineering-team/decisions/security-auth-exposure/0003-verify-signed-login-challenge.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
