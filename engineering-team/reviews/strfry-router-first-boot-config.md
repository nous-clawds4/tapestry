# Review: strfry-router FATAL on first boot (missing config file)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-13
**PR:** [#133](https://github.com/nous-clawds4/tapestry/pull/133) — `fix/strfry-router-first-boot` → `staging`
**Diff:** `git diff origin/staging...HEAD` (commit `ffd0febb`)
**Classification:** Bug / Standard / Implementer + Reviewer (Architecture skipped — obvious fix). Intake entry: `engineering-team/stories/_intake.md` (2026-05-13 entry).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (23/23). Output captured: Configuration Loading PASS; treasure-maps-router-preset 5/5; scheduled-search-and-house-scores-refresh 12/12; **strfry-router-first-boot-config 3/3**.
- [x] `bash -n docker/entrypoint.sh` — **PASS** (no syntax errors). Heredoc and the unconditional fallback parse cleanly.
- [ ] `npm run test:playwright` — skipped (no browser-observable change).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (vs. intake — no separate story file by design)

- [x] Intake records Option 1 as the Architect's call. Diff implements Option 1: an unconditional fallback that writes a minimal `connectionTimeout = 20 / streams {}` config when `/etc/strfry-router-tapestry.config` is absent.
- [x] Single change to `docker/entrypoint.sh` (intake scope).
- [x] One unit-test file added under `test/`, registered in `test/test.js`. (Three test cases inside, all on the same bug surface — fine.)
- [x] Branched off `staging` (PR base is `staging`).
- [x] No criterion silently dropped: the bug is "strfry-router crash-loops because file is missing"; the fix guarantees the file exists; the test pins the guarantee.
- [x] No scope creep: no changes to `src/api/strfry/routerConfig.js`, no changes to `docker/supervisord.conf`, no changes to docs.

## ADR adherence

- [x] No ADR required (Architecture phase skipped per Standard / Bug / obvious-fix rules — intake captures the Architect's call inline). The new fallback preserves the existing template-seed branch's behavior on true first boot and only adds defense-in-depth.
- [x] No new dependencies introduced.
- [x] Layering respected: change is entirely inside the existing `# --- strfry router config ---` section of `entrypoint.sh`; no leak into the Node app or supervisord config.

## Concept-graph integrity

- [x] N/A — no concept definitions or schemas changed. No firmware reinstall needed.

## Things tests can't catch

- [x] No secrets in committed files. (`grep -r 'pubkey\|secret\|password' ` of the diff returned only documentation-style mentions in the intake.)
- [x] No leftover debug logging or `console.log` in source. (Test file's `console.log` calls match the codebase's hand-rolled runner style — see [test/treasure-maps-router-preset.test.js](test/treasure-maps-router-preset.test.js).)
- [x] No commented-out code.
- [x] Error paths: the heredoc write is unguarded against I/O failure, but `set -e` at the top of `entrypoint.sh` means failure will halt boot loudly — which is the right behavior for an init script.
- [x] Concurrency / race conditions: entrypoint runs single-threaded before supervisord; no concurrent writer. The existing template-copy branch runs first and may produce a populated `/etc/...`; the new guard `[ ! -f ]` then sees the file exists and skips. No race.
- [x] Security: the heredoc content is static; the path is hardcoded. No injection vector. The file is written as root (entrypoint runs as root), which matches the permissions strfry needs to read it (strfry-router runs as user `strfry`; `/etc/...` is world-readable by default umask).

## House rules check

- [x] Concept Graph API authority respected (N/A — no concept code touched).
- [x] No new lint/typecheck/build tooling.
- [x] `package.json` not modified; no transitive dependency change.

## Findings

### Blocking

_None._

### Non-blocking

1. **`src/api/strfry/routerConfig.js#initRouter` (line 314)** — On container restart with persistent `router-state.json`, the entrypoint seed will write an *empty* config and strfry-router will start idle. `initRouter()` then writes the state-derived config to `/etc/...` but does **not** call `supervisorctl restart strfry-router` (the restart call lives in `applyConfig` at line 131 and `handleRestartRouter` at line 259, neither of which `initRouter` invokes). Net effect: presets that the operator had enabled prior to restart won't actually run until the operator next interacts with the Router Management UI (which triggers a restart). This is **strictly better than the pre-fix FATAL behavior** (operator action restores correct state, vs. the daemon being completely dead). Worth tracking as a follow-up — either (a) have `initRouter()` call `supervisorctl restart strfry-router` when its written content differs from disk, or (b) have the entrypoint's fallback prefer the state-derived config when `router-state.json` exists. Out of scope for this Bug; flagging only.

2. **Test file naming cosmetic** — `test/strfry-router-first-boot-config.test.js` carries the `-config` suffix from my originally-planned branch name (`fix/strfry-router-first-boot-config`); the merged PR branch is `fix/strfry-router-first-boot` (no suffix). The test filename doesn't need to track branch names — leave as-is.

## Verdict

**PASS** — diff matches the Architect's call recorded in the intake, all 23 tests pass (3 new + 20 baseline), bash syntax check passes, no blocking concerns. The non-blocking follow-up about `initRouter()`-driven restart is a separate concern worth tracking in a future cycle but does not gate this merge.
