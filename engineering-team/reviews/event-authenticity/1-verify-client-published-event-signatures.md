# Review: Story 1 — Verify client-published event signatures

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-11
**Diff:** `git diff origin/staging...HEAD` (impl commit `c1ba0198`)

## Quality gates (run by reviewer, not trusted)

- [x] `test/publish-event-signature-verification.test.js` (in-container) — **5 passed, 0 failed, 0 skipped**.
- [x] Sibling auth suites — `close-unauth-write-surface` 14/0, `default-deny-mutations` 14/0, `login-signature-verification` 13/0 (no regression).
- [x] `harness-lint` — clean (0 violations).
- [ ] _Lint / typecheck / build — not configured (JS-without-build); skipped._

## Spec adherence
- [x] AC1 (forged event rejected; not written to relay/graph/store) — covered; the spies confirm neither `strfry import` (exec) nor `maybeBrainWriteTapestry` is reached for a forged event.
- [x] AC1 default (`signAs` omitted) path also verifies — covered.
- [x] AC2 (valid event from any pubkey still publishes — permissionless) — covered (throwaway-key event publishes).
- [x] AC3 (forged `d`-tag reuse can't overwrite a genuine element) — covered; a forged kind-39999-TA event is rejected before the brain-write (which contains the destructive `importEventDirect` MERGE-by-`uuid`).
- [x] AC4 (`signAs:'assistant'` still owner/localTrusted-gated) — covered; unregressed.
- [x] AC5 (verification is app-level, not relay-reliant) — proven structurally: rejection happens before `exec`, so it cannot depend on `strfry import` (which was empirically shown to exit 0 on a rejected bad-sig event).
- [x] No behavior added beyond the story.

## ADR adherence
- [x] Files changed match ADR 0001's implementation note: the single insertion in the `signAs:'client'` branch of `src/api/strfry/commands/publishEvent.js:63-75`, after the presence check, before `signedEvent = event`.
- [x] Uses the file's existing `getNostrTools()` — no new dependency, no new require pattern.
- [x] JSON round-trip (`verifyEvent(JSON.parse(JSON.stringify(event)))`) per the ADR (defeats a client-attached `verifiedSymbol`).
- [x] `signAs:'assistant'` branch, the `strfry import` exec, `maybeBrainWriteTapestry`, `PUBLIC_MUTATIONS`, and the `localTrusted` bypass are all **untouched** (`auth.js` diff empty).
- [x] Diff scope is only `publishEvent.js` + the harness docs/tests/registration — no stray changes.

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall needed (protects a write boundary).

## Things tests can't catch
- [x] No secrets; no new debug logging (the pre-existing `console.log` at the publish path is unchanged); no commented-out code.
- [x] Error path: any throw in verification → `verified = false` → 400 (fails closed).
- [x] Authenticity, not authorization: `verifyEvent` checks the signature is valid for `event.pubkey`; it does not gate by *which* pubkey, so permissionless publishing is preserved (AC2 confirms).
- [x] No injection vector introduced — verification runs on a parsed copy of the caller's own event.

## Findings

### Blocking
_None._

### Non-blocking
1. **`publishEvent.js` (publish path)** — the handler still returns `success:true` when `strfry import` exits 0 having *rejected* an event for a non-signature reason (dup / `writePolicy`). Pre-existing; explicitly out of scope per ADR 0001 §Consequences (a publish-reporting concern, not the F1 authenticity vector). Noted, not blocking.

### Harness friction
_None._

## Verdict
**PASS** — the diff is mergeable as-is. The forgery (and the destructive `d`-tag-reuse overwrite) is closed at the publish boundary by an app-level signature check that gates both the relay import and the brain-write; permissionless publishing and the shipped auth surface are preserved; all gate suites and harness-lint are green.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done`.
- [x] Completion detection performed — see the chat: the `event-authenticity` book's acceptance frame is met **except** the "shipped through staging → prod" bullet (still local only), so the book is **not yet complete**; `/close-book` is **not** offered until prod ships. Feature is ready for `cycle-staging`.
