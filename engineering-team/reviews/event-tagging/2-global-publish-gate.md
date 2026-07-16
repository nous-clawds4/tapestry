# Review: Story 2 — Global publish gate

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-26
**Diff:** working tree vs `d3c93243` (test-design commit) — new `src/api/publish-policy/index.js`; edits to `src/api/index.js`, `ui/src/utils/nostrPublish.js`
**Story:** `engineering-team/stories/event-tagging/2-global-publish-gate.md`
**ADR:** `engineering-team/decisions/event-tagging/0002-global-publish-gate.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/global-publish-gate.test.js` → **8 passed, 0 failed** (independent re-run).
- [x] Regression: `event-tagging-core` **13/13**, `event-tagging-spec` **5/5** — unchanged.
- [x] `node --check` clean on `src/api/publish-policy/index.js` and `src/api/index.js`. ESM `nostrPublish.js` covered by source-contract (CJS harness can't import it, by design).
- [x] _Lint / Typecheck / Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion mapped to a passing test (default-external, guard forces local-only, only exact `'true'` engages, global coverage, local-only-is-success, fail-open, observable, per-deployment config).
- [x] No criterion silently dropped. Unset-default is pinned by source-contract (handler default `'false'`) — the documented, accepted limitation (conf presence varies host/container).
- [x] No behavior added beyond the story. Optional `ConfigContext` surfacing was correctly skipped (no AC needs it).

## ADR adherence
- [x] Files match ADR 0002 Implementation notes: `src/api/publish-policy/index.js` (`handleGetPublishPolicy`), route in `src/api/index.js:531`, `isExternalPublishAllowed()` + guarded `publishToRelays` in `nostrPublish.js`.
- [x] **Flag semantics exact:** env first → `getConfigFromFile('BRAINSTORM_PUBLISH_LOCAL_ONLY','false')` → `allowExternalPublish = !(raw === 'true')`. Default = external; only literal `'true'` engages. Matches ADR.
- [x] **Fail-open** correct (`nostrPublish.js`): non-200 → `true`; `catch` → `true`; missing field (`undefined !== false`) → `true`. A transient read never suppresses publishing.
- [x] **Guard at the chokepoint, before any socket:** the check precedes `new SimplePool()`; returns `{successes:[],failures:[],skippedByGate:true}` — no external connection opens when on.
- [x] No new dependencies; no firmware.

## Concept-graph integrity
- [x] N/A — publish-infrastructure, no concept work. **Firmware reinstall: not required** (correct).

## Things tests can't catch
- [x] **Coverage is structural.** `publishToRelays`'s only caller is `publishEverywhere` (`nostrPublish.js:137`); the guard lives *inside* `publishToRelays`, so all four callers (pubkey tags, pins, profile actions, concept publish) **and** any future direct caller are covered — no per-caller discipline.
- [x] **Local-only stays success:** `publishEverywhere` still runs the local arm unconditionally; `publishOrThrow` (`publishProfileTag.js:23`) throws only if *both* fail, so a `skippedByGate` external + OK local is a success. No caller edits needed.
- [x] **Observability:** `skippedByGate` marker + `console.info('[publish] local-only guard on …')` — "kept local" is distinguishable from "failed".
- [x] Policy cached as a module-scope promise — config is per-session-stable; intended.
- [x] Endpoint is public/no-auth — appropriate (a non-sensitive boolean), consistent with `/api/relays`.
- [x] No secrets, no leftover debug logging (the `console.info` is the ADR-specified observability), no commented-out code.

## House rules check
- [x] No hardcoded TA pubkey (N/A here). No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **`OPERATIONS.md`** — ADR 0002's Consequences names three doc locations for the guard ("Documented in OPERATIONS.md, the epic invariant section, and project memory"). The epic invariant section and project memory were updated; **OPERATIONS.md was not**. Low stakes — deployed droplets need *no* action (default = unchanged behavior), so this is informational ("a `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` flag exists if a deployment ever wants local-only"), not a correctness gap. Optional: add a one-line note to OPERATIONS.md to complete the ADR's documentation list.
2. **`src/api/publish-policy/index.js:28`** — empty-string env (`BRAINSTORM_PUBLISH_LOCAL_ONLY=''`) is treated as "present" → guard off (external). Harmless and arguably correct (only `'true'` engages), but if a future reader expects empty to fall through to conf, the `!== undefined` check is worth a one-word comment. Optional.

## Verdict
**PASS** — implementation matches ADR 0002 exactly; 8/8 green, no regressions; guard coverage is structural and fail-open is correct. The two non-blocking items are documentation polish, not correctness.
