# Test Plan: Story 1 (tag-stack-merge-hardening) — Trusted-list & pin-publish blockers

**Story:** `engineering-team/stories/tag-stack-merge-hardening/1-trusted-list-and-pin-publish-blockers.md`
**ADR:** `engineering-team/decisions/tag-stack-merge-hardening/0001-trusted-list-and-pin-publish-blockers.md`
**Date:** 2026-06-12

All tests live in `test/trusted-list-pin-publish-blockers.test.js`, registered in `test/test.js` (default `npm test` gate).

## Coverage map

| Criterion | Test name | Level |
|---|---|---|
| AC-1 (no impersonation) | `AC-1: requireAuth rejects a session with pubkey but authenticated!==true` | behavioral-unit |
| AC-1 (live contract) | `AC-1 (live): a pubkey-only session is 401d by refresh-pinned-tag…` | live-HTTP (SKIP if down) |
| AC-2 (auth still works) | `AC-2: requireAuth authorizes a signature-verified session` | behavioral-unit |
| AC-3 (no empty Follow Set) | `AC-3a: Tag.jsx awaits the refresh-pinned-tag call before the NIP-51 export` + `AC-3b: publishNip51ExportForPin refuses to publish an empty member set` | source-contract |
| AC-4 (cron loopback-only) | `AC-4: isLoopbackRequest allows a loopback socket…` + `…rejects an nginx-proxied request…` + `…rejects a non-loopback peer` | behavioral-unit |
| AC-5 (no TL wipe on error) | `AC-5: runOnePin returns the computed dTag on its publish-error path` | source-contract |
| AC-6 (large TLs publish) | `AC-6: publishToStrfry feeds the event via stdin, not a shell argument` | source-contract |
| AC-7 (refresh default off) | `AC-7: readConfig seeds a disabled refreshPinnedTagTLs entry on fresh install` | behavioral-unit (env-overridable path) |

## Test levels — why this mix

The module surface forces three levels (same pattern as the search-api-result-controls and curated-view suites):

- **Behavioral-unit** where a function can be invoked deterministically: `requireAuth` and `isLoopbackRequest` (called with fake req/res), and `readConfig` (env-overridable config path → temp file).
- **Live-HTTP, per-test SKIP** for the one contract worth exercising end-to-end: a signature-free `verify-user` session must be 401'd. Pre-fix this returns 404 (the session sails past `requireAuth` to the pin lookup) — a *behavioral* proof of the bypass, not just a unit assertion.
- **Source-contract (regex)** where the target is an ESM UI util (`publishTagPin.js`, `Tag.jsx` — not `require()`-able from the CJS runner), or a path that needs the strfry binary / a >128 KiB synthetic event to exercise (`publishToStrfry`, `runOnePin`'s publish-error return). Each regex pins the exact change the ADR prescribes and is written to match intent, not exact wording.

## Testability affordances required of the Implementer

Both are consistent with existing repo patterns and are stated as part of the contract:

1. **Export `requireAuth` and `isLoopbackRequest`** from `src/api/trustedList/index.js` (mirrors `refreshPinnedTags.js` exporting `runOnePin` "for tests").
2. **Make the scheduled-tasks config path env-overridable** via `SCHEDULED_TASKS_CONFIG_PATH` (mirror of `settings.js`'s `TAPESTRY_SETTINGS_PATH`), so the fresh-install seeding is testable against a temp path.

## Edge cases covered

- IPv6 loopback `::1` allowed; `X-Real-IP` (not just `X-Forwarded-For`) rejected; non-loopback peer rejected.
- AC-3b asserts the zero-member guard sits **before** `signEvent` (an empty list is never signed, not merely not-published-after-signing).
- AC-7 asserts both presence AND `enabled === false` (retraction must not auto-run on fresh deploy).

## Deliberately left to live verification during Implementation (cycle-local)

These need the live stack / real data and aren't deterministic in the CI gate; verify them in the implementation's `cycle-local`:

- **AC-6 behavioral:** publish a synthetic >700-member TL through the real strfry path and confirm it lands (the regex proves the mechanism changed; the live run proves it works).
- **AC-5 behavioral:** force a per-pin publish error on a tag with an existing TL during `refresh-all` and confirm the existing TL is NOT replaced by an empty one.
- **AC-4 live:** POST `refresh-all-pinned-tags` with an `X-Forwarded-For` header → expect 403 (omitted from the automated suite to avoid triggering a real prod-scale recompute as a side effect; the unit covers the gate logic).

## How to run

```
node test/trusted-list-pin-publish-blockers.test.js   # suite alone
npm test                                               # full gate
```

## Verification

The new tests fail with the current code. Confirmed 2026-06-12 at commit `e80f90ed`:

```
--- trusted-list & pin-publish blockers (epic tag-stack-merge-hardening, Story 1) ---
  FAIL  AC-1: requireAuth rejects a session with pubkey but authenticated!==true
        requireAuth must be exported from src/api/trustedList/index.js for unit testing (ADR testability note 1)
  FAIL  AC-2: requireAuth authorizes a signature-verified session
  FAIL  AC-1 (live): a pubkey-only session is 401d by refresh-pinned-tag, no impersonation
        … — got 404, expected 401   (← behavioral proof: pubkey-only session passed requireAuth)
  FAIL  AC-4: isLoopbackRequest allows a loopback socket with no proxy headers
  FAIL  AC-4: isLoopbackRequest rejects an nginx-proxied request (X-Forwarded-For present)
  FAIL  AC-4: isLoopbackRequest rejects a non-loopback peer
  FAIL  AC-3a: Tag.jsx awaits the refresh-pinned-tag call before the NIP-51 export
  FAIL  AC-3b: publishNip51ExportForPin refuses to publish an empty member set
  FAIL  AC-5: runOnePin returns the computed dTag on its publish-error path
  FAIL  AC-6: publishToStrfry feeds the event via stdin, not a shell argument
  FAIL  AC-7: readConfig seeds a disabled refreshPinnedTagTLs entry on fresh install

trusted-list-pin-publish-blockers: 0 passed, 11 failed
```
