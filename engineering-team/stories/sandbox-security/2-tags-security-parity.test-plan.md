# Test Plan: Story 2 — tags runs production's September security hardening

**Story:** `engineering-team/stories/sandbox-security/2-tags-security-parity.md`
**ADR:** `engineering-team/decisions/sandbox-security/0001-port-production-security-fixes-to-sandboxes.md`
**Date:** 2026-09-12

## Where the tests live

The failing test files are committed on **`fix/tags-security-parity`** (off `feat/tags`), commit `b495654d` — not on this record branch. `feat/tags` already carries the July suites (`close-unauth`, `default-deny`, `wipe`, `users-page`) since it took the July fixes, so this story adds only the two September suites it lacks, plus the ESTATE trim. All are stack-free ports of the ratified prod suites (`security-auth-exposure/0003`, `event-authenticity/0001`).

## Coverage map

| Criterion (story) | Test(s) | Suite file | Level |
|---|---|---|---|
| Login authenticity (invalid sig / stale / replayed / wrong-kind rejected; challenge-only = no identity; valid accepted) | reframe, single-use, stale, wrong-kind, bogus-sig, valid-accepted, regenerate | `login-signature-verification.test.js` | handler + source sentinel |
| No pasted private keys | `S: auth.js no longer assigns a client nsec`; `S: the paste-your-nsec page is retired` | `login-signature-verification.test.js` | source sentinel |
| Published events authentic | `a forged client event is NOT published`; `a validly-signed event IS published` | `publish-event-signature-verification.test.js` | handler |
| tags' own features still work | live: tag / pin / context-scoped pins / bounded Simple Lists still work; the July suites already present stay green | (existing suites) + live | live |
| Ownership list current | `U6c the attestation no longer names the decommissioned sandboxes` | `site-trust-signals.test.js` | unit |
| Shipped and verified live | safe-to-merge check, then Reviewer/deploy live checks on tags.brainstorm.world | — | live (at Review/deploy) |

## Edge cases

- [x] Valid signature by a different key than the challenged pubkey → rejected.
- [x] All-zeros signature → rejected.
- [x] Replayed challenge → rejected.
- [x] A valid client event from any pubkey still publishes (permissionless preserved).

## Test infrastructure

- **Runner:** `feat/tags`'s full `test/test.js` (134 suites). The two new suites were wired into the require block, the run block, the summary, and the **LIVE** half of the `overallOk` gating chain — placed before the branch's pre-existing severed terminator (OPEN.md #43/#55), so they actually gate. (Site-trust's own gating conjunct sits in the dead post-terminator block on this branch; the suite still runs and reports, and its U6c failure is visible — the dead-block defect is pre-existing and out of this story's scope.)
- **Deps:** `npm install` works cleanly on this branch (no `better-sqlite3`); the suites are stack-free. `nostr-tools` present → signing cases run.
- **In-container caveat:** same as story 1 — the publish suite stubs the sibling modules via `Module._load`, so it runs on the host; the definitive behavioral run of the full 134-suite runner is in-container / CI.
- **Full-runner note:** the 134-suite runner includes many live-API suites needing the stack; this plan verifies the two **new** suites standalone (below). The full run is exercised in-container at Implementation/Review.

## How to run

On `fix/tags-security-parity`:

```
node test/login-signature-verification.test.js
node test/publish-event-signature-verification.test.js
node test/site-trust-signals.test.js
```

## Verification

The new suites fail with the current `feat/tags` code. Confirmed 2026-09-12 on `fix/tags-security-parity` @ `b495654d` (stack-free, host worktree):

```
login-signature-verification: 2 passed, 11 failed, 0 skipped
publish-event-signature-verification: 1 passed, 1 failed, 0 skipped
site-trust-signals: 19 passed, 1 failed, 8 skipped
```

Login fails harder than on magic-carpet because `feat/tags` has no signature check at all on its login path (magic-carpet already carried Matthias's `verifyLoginEvent`). Each failure is a "the fix is not present" reason. The adapted suites were validated to flip green under a throwaway ADR-faithful sketch, then reverted.
