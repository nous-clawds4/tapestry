# Review: Story 3 — Login endpoints must verify the signed challenge

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-11
**Diff:** `git diff origin/staging...HEAD` (impl commit `b83572e7`; branch `security/login-signature-verification`)
**Story:** `engineering-team/stories/security-auth-exposure/3-login-signature-verification.md`
**ADR:** `engineering-team/decisions/security-auth-exposure/0003-verify-signed-login-challenge.md`
**Test plan:** `engineering-team/stories/security-auth-exposure/3-login-signature-verification.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] Story suite — **`login-signature-verification`: 13 passed, 0 failed, 0 skipped** (in-container, where `node_modules`/`nostr-tools` exist).
- [x] Sibling auth suites (regression) — **`close-unauth-write-surface`: 14/0**, **`default-deny-mutations`: 14/0**. No regression.
- [x] Harness self-integrity — **`stack-free-npm-test`: 7/0**; G5/G6 confirm `loginSignatureVerificationResult` gates *inside* the `overallOk` chain (chain[1]), not merely present. Registration is sound.
- [x] `node --check` clean on `src/middleware/auth.js`, `test/login-signature-verification.test.js`, `test/test.js`.
- [~] Full `npm test` — the binding full-suite run is CI's **stack-free job** (`.github/workflows/test.yml`). Locally the Docker stack is *up*, so neither host `npm test` (empty `node_modules` → `proper-lockfile`) nor in-container full `npm test` (live suites need graph state) gives a clean signal — the documented OPEN.md #27/#50 condition. The change is auth-only; the three directly-affected suites + the chain self-assertion were run and pass.
- [x] _Lint / typecheck / build — not configured; skipped (per project policy)._

## Spec adherence

Every acceptance criterion has a passing test:

| AC | Test | Result |
|---|---|---|
| Invalid (all-zeros) sig → fail + `status.authenticated:false` | `an all-zeros-sig event … is REJECTED` | pass |
| Valid signed challenge → authenticated | `a validly-signed challenge is ACCEPTED` | pass |
| Stale `created_at` → fail | `a valid signature with a stale created_at (2h old) is REJECTED` | pass |
| Single-use challenge | `after one failed attempt, the same challenge cannot be reused` | pass |
| Wrong kind → fail | `a wrong-kind event (kind 1) is REJECTED` | pass |
| `event.pubkey` ≠ challenged pubkey → fail | `a valid signature by a DIFFERENT key … is REJECTED` | pass |
| Bare challenge request establishes no identity (reframe) | `a bare challenge request (verify-user) establishes NO session identity` | pass |
| Session regenerated + no `nsec` on success | `a successful login regenerates the session id and leaves no nsec` | pass |
| Both handlers enforce it | `/api/auth/login (owner) rejects a bogus sig …` + all `login-user` cases | pass |
| ADR decisions (verifyEvent used / no nsec write / regenerate / page retired) | 4 source sentinels | pass |

No criterion silently dropped; no behavior added beyond the story/ADR.

## ADR adherence

- [x] Files changed match the ADR implementation notes: all logic in `src/middleware/auth.js`; `public/pages/sign-in-with-nsec.html` deleted; `sign-in-owner.html` and `sign-in.html` retained (verified present in the tree — ADR "keep both login endpoints, harden both; retire only the nsec paste page").
- [x] **`kind10040.js`, `PUBLIC_MUTATIONS`, and the `localTrusted` bypass are untouched** (`git diff` confirms no changes to those files/lines) — the ADR's hard constraints.
- [x] No new dependencies — `nostr-tools` was already a dependency and already used server-side (`verifyEvent` at `src/api/event/eventReadPath.js:39`). The module-level require mirrors the established resilient pattern.
- [x] Security-critical logic matches the ADR: `verifyLoginEvent` (`auth.js:31-43`) checks kind → **pubkey-binding (`:35`, `event.pubkey !== expectedPubkey`) → challenge tag → freshness → `verifyEvent` on a `JSON.parse(JSON.stringify(event))` round-trip**. The pubkey-binding sits before the signature check, so the "sign with my own key, log in as owner" trap is closed (proven by the wrong-key test). Single-use deletion (`:177-178`, `:569-570`) runs on **every** path before verification. `finalizeAuthenticatedSession` (`:49-58`) regenerates → sets `{authenticated, pubkey}` → saves, with errors rejecting into the handler's `try/catch` (→ 500). Verify handlers set `pendingAuth`, never `session.pubkey` (`:127`, `:530`); identity is written only in `finalize` (`:54`).

**Accepted deviation (on record):** the ADR documents, and the operator accepted (2026-09-11), that making the login challenge single-use breaks the legacy owner NIP-85 kind-10040 publish page (`nip85-control-panel.html`), which reused the login `session.challenge`. Deferred to the F6 follow-up (give kind10040 its own challenge). Documented in ADR 0003 Consequences and the private F6 record. Not a regression of *this* ADR's contract.

## Concept-graph integrity
- N/A — no concepts touched (control-panel auth middleware). No firmware reinstall needed.

## Things tests can't catch
- [x] No secrets committed. The prior `nsec`-in-session store is removed; the "Private key stored in session" log is gone.
- [x] No leftover debug logging introduced. The retained `console.log` at `:588` ("User authentication successful …") is pre-existing operational logging, not new debug cruft.
- [x] No commented-out code; no scope creep (auth.js + page deletion + tests + harness docs only).
- [x] Error paths: verifier-unavailable fails closed (`:32`); regenerate/save errors → 500.
- [x] Security: event shape validated defensively (`:33-36`); identity bound to the challenged pubkey + a verified signature.

## House rules check
- [x] No new lint/typecheck/build tooling.
- [x] Concept Graph API authority respected (N/A here).

## Findings

### Blocking
None.

### Non-blocking
1. **`src/middleware/auth.js:39`** — the freshness check uses `Math.abs(now - Number(event.created_at)) > MAX`. A non-finite `created_at` (missing/NaN) makes the comparison `NaN > MAX` → `false`, so it does **not** trip the "stale" branch. Not exploitable — `verifyEvent` (`:41`) rejects any event whose `created_at` isn't the signed numeric value (nostr-tools `validateEvent` requires a numeric `created_at`, and the signature commits to it). Optional hardening: guard with `Number.isFinite(ts)` and reject a non-finite timestamp explicitly, so the freshness gate stands on its own rather than relying on the backstop.
2. **`src/middleware/auth.js:167-189` / `:563-586`** — theoretical concurrent-login race: two simultaneous requests carrying the *same* `pendingAuth` could both read it before either `delete` lands, so "single-use" is not atomic. No privilege gain (both requests carry the same valid signature for the same pubkey; each just re-authenticates that identity), and real clients never fire concurrent logins. Noted for completeness; not worth serializing.
3. **Discoverability of the deferred kind10040 regression** — it's captured in ADR 0003 and the private F6 record (which the F6 follow-up will act on). If you want `/whats-open` to surface it directly, add a one-line functional row to `OPEN.md` at ship time (framed as a functional regression, no exploit detail). Optional.

### Harness friction
1. Running this suite requires the container (`auth.js` → `customerManager` → `proper-lockfile`, absent from the host's empty `node_modules`) — the known OPEN.md #27 stack-drift condition, already tracked. No new row needed.

## Verdict
**PASS** — the diff is mergeable as-is. The auth bypass is closed, identity is established only on a verified login, the challenge is single-use, the session regenerates, `nsec` is never stored, and the nsec paste page is retired; the one deferred consequence (kind10040) is documented and operator-accepted. The two non-blocking notes are optional hardening.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result recorded in chat (human-gated), `/close-book` offered if the book looks complete.
