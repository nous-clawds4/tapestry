# Test Plan: Story 2 — Global publish gate

**Story:** `engineering-team/stories/event-tagging/2-global-publish-gate.md`
**ADR:** `engineering-team/decisions/event-tagging/0002-global-publish-gate.md`
**Date:** 2026-06-26

## Approach

One hand-rolled CJS suite — `test/global-publish-gate.test.js` — in the project's existing style (`run()` → `{pass,fail,failures}`, wired into `test/test.js`). Two seams per ADR 0002:

1. **Server (behavioral, strong).** `require` the real `handleGetPublishPolicy` and call it with a fake `req/res`, driving `process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY` to assert the returned `allowExternalPublish`. Env is snapshotted and restored around each case so other suites are unaffected. The handler module doesn't exist yet → lazily required inside each test (descriptive red), so the harness load phase can't crash.
2. **Client (source-contract).** The guard lives in `ui/src/utils/nostrPublish.js` (ESM, imports `nostr-tools`) which the CJS runner cannot import; assert over its **source** that the guard is present, sits at the shared primitive, precedes any `SimplePool` use, fails open, and is wired into the API — same pattern as Story 1 / `b-tag-primitive`.

Only the **exact string `'true'`** engages the guard. Unset/default behaviour is asserted by **source-contract** (handler's `getConfigFromFile` default is `'false'`) rather than behaviourally, because the unset path reads `brainstorm.conf` whose presence varies by host/container — the env-driven cases are deterministic (env precedes conf).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC: default (unset) publishes externally | `handler default is guard-off ('false') when unset` (source-contract on default) + `unset-equivalent env values yield allowExternalPublish:true` | global-publish-gate | source-contract + behavioral |
| AC: guard forces local-only | `BRAINSTORM_PUBLISH_LOCAL_ONLY='true' → allowExternalPublish:false` | global-publish-gate | behavioral |
| AC: only exact 'true' engages guard | `'false'/'1'/'yes'/'TRUE' → allowExternalPublish:true` | global-publish-gate | behavioral |
| AC: global coverage (chokepoint) | `guard is in publishToRelays (the shared primitive); publishEverywhere routes through it` | global-publish-gate | source-contract |
| AC: guard forces local-only (client) | `publishToRelays returns {successes:[],failures:[],skippedByGate:true} when guard on, before any SimplePool` | global-publish-gate | source-contract |
| AC: local-only is success | `skip path returns a result object (successes/failures arrays), not a throw` | global-publish-gate | source-contract |
| AC: fail-open on unknown state | `isExternalPublishAllowed fetches /api/publish-policy and returns true on error (fail-open)` | global-publish-gate | source-contract |
| AC: guard is per-deployment config not code | `handler reads BRAINSTORM_PUBLISH_LOCAL_ONLY via env then brainstorm.conf` | global-publish-gate | source-contract + behavioral |
| AC: guard state observable | `skippedByGate marker + a console log line present` | global-publish-gate | source-contract |
| endpoint wired | `/api/publish-policy registered in src/api/index.js → handleGetPublishPolicy` | global-publish-gate | source-contract |

## Edge cases

- [ ] `'TRUE'` (uppercase) does **not** engage the guard — only exact lowercase `'true'`.
- [ ] `'1'` / `'yes'` (truthy-looking) do **not** engage the guard.
- [ ] Guard call **precedes** `new SimplePool` / `pool.publish` in `publishToRelays` (asserted by source index ordering) — so no socket opens when the guard is on.
- [ ] `isExternalPublishAllowed` error path returns `true` (fail-open) — a failed/again-200 policy read never suppresses external publishing.
- [ ] Env is restored after each behavioral case (no leakage into sibling suites in the full run).

## Test infrastructure
- Runner: `node test/test.js` (existing). No new framework, no build.
- No relay, no signing, no firmware, no Concept Graph. Server tests need no running stack — the handler is unit-called with a fake `req/res`; `getConfigFromFile` falls back to its default when `/etc/brainstorm.conf` is absent (host).
- To be created by the Implementer: `src/api/publish-policy/index.js` (`handleGetPublishPolicy`), its route in `src/api/index.js`, and the guard (`isExternalPublishAllowed` + `publishToRelays` changes) in `ui/src/utils/nostrPublish.js`.

## How to run
```
npm test
```

## Verification
The new tests fail with current code (handler/route/guard all absent). Failing output captured at red-phase commit.
