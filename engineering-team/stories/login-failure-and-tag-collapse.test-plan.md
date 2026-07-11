# Test Plan: Login-failure surfacing + tag-result collapse (ADR 0021)

**Story:** _none — user elected to proceed without a Product Owner story._
**ADR:** `engineering-team/decisions/0021-login-failure-surfacing-and-tag-result-collapse.md`
**Date:** 2026-06-01

Acceptance criteria are derived from ADR 0021's Decisions + Implementation
notes (there is no story to source them from). Two bugs, batched.

## Coverage map

| Criterion (from ADR 0021) | Test name | Test file | Level |
|---|---|---|---|
| AC-1 — `waitForNostr` returns an already-present signer immediately | `AC-1a: waitForNostr returns the existing window.nostr immediately` | `test/login-failure-and-tag-collapse.test.js` | behavioral unit |
| AC-1 — tolerates the async injection race | `AC-1b: waitForNostr resolves to a signer injected LATE` | same | behavioral unit |
| AC-1 — gives up (null) after the timeout | `AC-1c: waitForNostr returns null after the timeout` | same | behavioral unit |
| AC-2 — `runLogin` uses the bounded wait, no immediate one-shot check | `AC-2: runLogin waits for window.nostr via waitForNostr` | same | source-contract |
| AC-3 — four typed failure codes exist | `AC-3: the four typed failure codes exist` | same | source-contract |
| AC-4 — vendor-neutral copy (no brand names) | `AC-4: NO_SIGNER copy is vendor-neutral` | same | source-contract |
| AC-5 — NOT_AUTHORIZED preserves server message | `AC-5: NOT_AUTHORIZED preserves the server-supplied message` | same | source-contract |
| AC-6 — single modal rendered by AuthProvider; coded error; re-throw; code→copy map | `AC-6a/6b/6c` | same | source-contract |
| AC-7 — all entry points covered; inline span gone; dead CSS removed | `AC-7a/7b/7c` | same | source-contract |
| AC-8 — `TAG_COLLAPSE_LIMIT = 3` | `AC-8: TAG_COLLAPSE_LIMIT constant … equals 3` | same | source-contract |
| AC-9 — tag hits sliced unless expanded | `AC-9: tag hits render sliced to the limit unless expanded` | same | source-contract |
| AC-10 — conditional toggle, remaining count, aria-expanded | `AC-10: a toggle appears only when tag count exceeds the limit` | same | source-contract |
| AC-11 — reset on fresh search, not on load-more | `AC-11: tagsExpanded resets on a fresh search` | same | source-contract |
| AC-12 — `.bs-taghits-toggle` styling | `AC-12: .bs-taghits-toggle styling exists` | same | source-contract |
| AC-4/AC-6 (observable) — no-signer click shows vendor-neutral modal | `AC-6/AC-4: no signer → shared modal with vendor-neutral copy` | `tests/brainstorm/login-failure-and-tag-collapse.spec.js` | e2e (Playwright) |
| AC-1/Decision-3 (observable) — late injection ≠ false "no signer" | `AC-1/Decision-3: a LATE-injected signer must not trip a false "no signer"` | same | e2e (Playwright) |
| AC-9/AC-10 (observable) — collapse + expand on click | `AC-9/AC-10: with >3 tag hits, only 3 show until the toggle is clicked` | same | e2e (Playwright) |

### Why two layers
`ui/` is `"type":"module"`, so the pure helper `ui/src/utils/nip07.js` is loaded
via dynamic `import()` and exercised for real — the injection-race logic (the
single most important correctness fix) gets a *behavioral* test, not a regex.
Everything that is inherently JSX/CSS (modal wiring, the collapse render, dead-CSS
removal) is locked with source-contract assertions, matching the established
pattern in `test/search-results-url.test.js` and
`test/collapse-into-export-concept.test.js`. Observable browser behavior is
covered by the Playwright companion (skipped unless `BRAINSTORM_SERVER_ACCESSIBLE=true`).

## Edge cases

- [x] Signer present before the call (immediate resolve) — AC-1a.
- [x] Signer injected *after* the click (the race) — AC-1b / Playwright.
- [x] Signer never injects (timeout → null → NO_SIGNER) — AC-1c.
- [x] Signer present but server rejects (NOT_AUTHORIZED carries server copy) — AC-5 / Playwright.
- [x] Re-throw contract preserved so `Tag.jsx` still aborts its follow-up action — AC-6b.
- [x] Tag collapse resets between searches; load-more does **not** reset it (tag hits don't paginate) — AC-11.
- [x] Toggle only appears when count > limit (no toggle for ≤3 tags) — AC-10.
- [ ] `SIGNER_DECLINED` user-cancel copy — asserted at source level (AC-3/AC-6c); live extension-decline is manual-verify only (can't script a real extension prompt).

## Test infrastructure

- Frameworks: Node built-in runner (`node test/test.js`) for the source-contract +
  behavioral suite; Playwright for the e2e companion.
- The behavioral `waitForNostr` tests fake `global.window` and use real timers
  with generous margins (sub-second) — no Concept Graph or server dependency.
- Concept Graph API: **not required** (no concepts involved).
- Firmware state: no reinstall (no concept definitions changed).
- Fixtures: Playwright mocks `/api/auth/status`, `/api/auth/verify-user`,
  `/api/search/profiles/meili`, and `window.nostr` via `addInitScript`.

## How to run

```
npm test                      # includes the new suite (wired into test/test.js)
node test/login-failure-and-tag-collapse.test.js   # the suite alone
```

For browser/e2e (needs the local stack):
```
BRAINSTORM_SERVER_ACCESSIBLE=true npm run test:playwright -- login-failure-and-tag-collapse
```

## Verification

The new Node suite fails against a clean (pre-implementation) tree for the
right reasons. **Confirmed 2026-06-01** by setting aside the informal
working-tree implementation (`git stash` of the 5 edited files + the untracked
`LoginErrorModal.jsx`) and running the suite — every assertion fails with an
ADR-cited message:

```
--- login-failure-and-tag-collapse tests (ADR 0021) ---
  FAIL  AC-1a: waitForNostr returns the existing window.nostr immediately
        ui/src/utils/nip07.js must exist and export waitForNostr (ADR 0021 AC-1)
  FAIL  AC-1b: waitForNostr resolves to a signer injected LATE (the injection race)
        ui/src/utils/nip07.js must exist and export waitForNostr (ADR 0021 AC-1)
  FAIL  AC-1c: waitForNostr returns null after the timeout when no signer ever appears
        ui/src/utils/nip07.js must exist and export waitForNostr (ADR 0021 AC-1)
  FAIL  AC-2: runLogin waits for window.nostr via waitForNostr (no immediate one-shot check)
  FAIL  AC-3: the four typed failure codes exist (NO_SIGNER / SIGNER_DECLINED / NOT_AUTHORIZED / UNKNOWN)
  FAIL  AC-4: NO_SIGNER copy is vendor-neutral — no brand names in the login surfaces
  FAIL  AC-5: NOT_AUTHORIZED preserves the server-supplied message
  FAIL  AC-6a: a single LoginErrorModal is rendered by AuthProvider
  FAIL  AC-6b: login() records a CODED error (object with code), not a bare string, and re-throws
  FAIL  AC-6c: LoginErrorModal maps the failure code to copy (reads error.code)
  FAIL  AC-7a: bare login() callsites swallow the re-throw (no unhandled rejection)
  FAIL  AC-7b: Header no longer renders its own inline .signin-error span
  FAIL  AC-7c: the dead .signin-error CSS rule is removed
  FAIL  AC-8: TAG_COLLAPSE_LIMIT constant is defined and equals 3
  FAIL  AC-9: tag hits render sliced to the limit unless expanded
  FAIL  AC-10: a toggle appears only when tag count exceeds the limit, with a count and aria-expanded
  FAIL  AC-11: tagsExpanded resets on a fresh search and is NOT touched in the load-more branch
  FAIL  AC-12: .bs-taghits-toggle styling exists

login-failure-and-tag-collapse: 0 passed, 18 failed
```

### ⚠️ Note for the Implementer
The `bugfixes` working tree currently carries an **earlier informal
implementation** of these fixes that predates ADR 0021 and does *not* match it
(it does an immediate `!window.nostr` check, shows the raw `err.message`, and
has no typed codes or `waitForNostr`). Against that tree the suite is a *mix*
of pass/fail. **Revert those five UI edits + delete the informal
`LoginErrorModal.jsx` before implementing**, so you start from the fully-red
baseline above and build to the ADR. The collapse (Bug 2) portion of the
informal impl happens to match the ADR, but re-deriving it from the failing
tests keeps the chain honest.
