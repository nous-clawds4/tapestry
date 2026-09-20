# Review: Story 2 — tags runs production's September security hardening

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-12
**Diff:** `git diff origin/feat/tags...fix/tags-security-parity` (impl `12db387b`, tests `b495654d`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — the full 134-suite runner needs the live stack and was **not** run here (deferred to in-container/CI at deploy). The Reviewer independently ran all suites in this story's scope **standalone, stack-free**, all green: login-signature-verification 13/0, publish-event-signature-verification 2/0, site-trust-signals 20/0 (8 SKIP) — plus the four July suites as a regression check against the `auth.js` swap (close-unauth 14/0, default-deny 14/0, strfry-wipe 3/0, users-page 2/0). No regression from replacing `auth.js`.
- [ ] `npm run test:playwright` — no browser suite for this story.
- [x] _Lint / Typecheck / Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion covered:
  - Login authenticity (bad sig / stale / replayed / wrong-kind rejected; challenge-only = no identity; valid accepted) → `login-signature-verification` green.
  - No pasted private keys → login suite `session.nsec`/paste-page sentinels green; page deleted.
  - Published events authentic → `publish-event-signature-verification` green.
  - Own features still work → the four July suites still green; tag/pin live checks deferred to deploy.
  - Ownership list current → `site-trust-signals` U6c green.
  - Shipped & verified → deploy-time (safe-to-merge check + live host).
- [x] No criterion dropped; no behavior added beyond the story.

## ADR adherence
- [x] `src/middleware/auth.js` **byte-identical to `origin/staging`** — verified. tags' middleware was already at July parity (the diff was confined to the login regions), so the wholesale swap changed only login #3; nothing tags-specific lost (identical exports, no tags-only functions).
- [x] `publishEvent.js` surgical: **resilient** nostr-tools require + client-path `verifyEvent` before `strfry import`. The assistant-gate was already present from July #2 (correctly untouched). No brain-write (tags has none). tags' `publishEvent` imports no `fetchProfiles`, so no ws-path issue and no resilient-require deviation was needed here.
- [x] Login #3: `verifyLoginEvent` + `finalizeAuthenticatedSession` + `pendingAuth`; `session.nsec` never assigned; paste-your-nsec page deleted.
- [x] ESTATE trim: `communities`/`curate` removed from `siteTrust.js` (0 refs).
- [x] Correctly scoped to the September pair — tags already had the July fixes, so no run-query/queryPost/wipe/users-page changes (verified those suites still pass unchanged).
- [x] No new dependencies or tooling.

## Concept-graph integrity
- [x] N/A — no concepts touched.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No new debug logging; no commented-out code.
- [x] **Push discipline honored** — `fix/tags-security-parity` is **not on origin** (confirmed via `git ls-remote`). (Note: that the sandboxes lag is already public via OPEN.md row 276; nothing new disclosed.)
- [x] No leftover `run-query` route/spec references introduced; the two prose comments (`index.js`, `Index.jsx`) are the intended July removal comments, matching staging.

## House rules check
- [x] Concept Graph API authority respected (N/A). No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
_None._ (Unlike magic-carpet, tags took the July run-query cleanup properly — its `openapi.yaml` and `install.js` carry 0 run-query references.)

### Harness friction
1. None new this phase.

## Verdict
**PASS**

Clean, minimal, faithful September-parity port; wholesale `auth.js` byte-identical to staging with the July suites confirmed non-regressed; all in-scope suites independently green.

Deferred to deploy (by design): the full 134-suite in-container runner, the `scripts/check-safe-to-merge.sh https://tags.brainstorm.world` gate, and live-host verification (login/publish authenticity; tag/pin flows).

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result recorded in chat (not here).
