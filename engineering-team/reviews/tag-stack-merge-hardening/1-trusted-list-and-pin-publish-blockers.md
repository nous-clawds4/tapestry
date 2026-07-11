# Review: Story 1 (tag-stack-merge-hardening) — Trusted-list & pin-publish blockers

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-12
**Diff:** `git diff f1bd48b6..f6a79be9` (impl commit `f6a79be9`; tests at `f1bd48b6`, ADR at `e80f90ed`)
**Production files:** `src/api/trustedList/index.js`, `src/api/trustedList/refreshPinnedTags.js`, `src/api/scheduled-tasks/index.js`, `ui/src/pages/Tag.jsx`, `ui/src/utils/publishTagPin.js`

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite** `node test/trusted-list-pin-publish-blockers.test.js` — **11 passed, 0 failed** (incl. the live impersonation check against the redeployed server).
- [x] **Four rerouted `*-publish` suites, in-group** — `customize-pin-curation-publish` 3/0, `tl-publication-from-pins` 10/0, `tl-publication-from-pins-publish` 7/0, `tag-detail-curated-view-and-pin-polish-publish` 1/0. All green.
- [x] **`npm test` (full gate)** — story suite PASS. Overall FAIL on `tl-publication-from-pins` (1) and `most-pinned-tag-index-publish` (4) — **independently verified as cross-suite live-strfry contamination, not regressions**: `most-pinned-tag-index-publish.test.js` is NOT in this diff (last touched Story #13, `a4809d78`) and passes **7/0 standalone**; `tl-publication-from-pins` passes **10/0** standalone and in-group. This is the pre-existing "suite can't pass on a clean checkout by design" condition the expert review already flagged.
- [x] Behavioral checks (cycle-local, from the implementation): auth → 401 for a pubkey-only session; loopback gate → in-container no-XFF 200 / XFF 403; **900-member TL published** (old `echo` path died ~600–700); fresh-install seed → `enabled:false`.
- _Lint / typecheck / build — not configured; skipped per house rules._

## Spec adherence

- [x] **AC-1 / AC-2** — `requireAuth` now requires `req.session?.authenticated === true` (`trustedList/index.js:183`). Unit tests cover both directions; the live test proves the bypass is closed (was 404 = past the gate, now 401).
- [x] **AC-3** — `Tag.jsx:123` awaits the refresh before the export; `publishNip51ExportForPin` (`publishTagPin.js:252-261`) returns a `{skipped:true}` sentinel before signing when `memberCount===0` or no `p`-tags. Belt-and-suspenders: even if the sequencing regressed, no empty set can be signed.
- [x] **AC-4** — `isLoopbackRequest` (loopback socket AND no `x-forwarded-for`/`x-real-ip`) gates `handleRefreshAllPinnedTags` before any work (`index.js:217-219`). Verified 403 on proxied, 200 on in-container loopback.
- [x] **AC-5** — `runOnePin`'s publish-error return now carries `dTag` (`refreshPinnedTags.js:220`), so `refreshAllPinnedTags` keeps it in `currentDTags` and `retractStaleTLs` won't wipe an errored pin's TL.
- [x] **AC-6** — `publishToStrfry` rewritten to `spawn` + `stdin` (`index.js:73-105`); event no longer on argv. Timeout (`SIGKILL` at 5s), single-settle guard, non-zero-exit rejection all handled.
- [x] **AC-7** — `readConfig` seeds a default-**disabled** `refreshPinnedTagTLs` entry on fresh install only (file absent + empty entries), never resurrecting after a delete (`scheduled-tasks/index.js:103-106`). Confirmed `enabled:false`.

## ADR adherence

- [x] All five production files match the ADR implementation notes exactly; Option A chosen for B3 as decided; spawn-stdin chosen for B4b (not temp-file) as decided.
- [x] No new runtime dependencies. `spawn`/`execSync` are stdlib `child_process`.
- [x] Two testability affordances the ADR/test-plan called for are present and minimal: `requireAuth` + `isLoopbackRequest` exported "for tests"; `SCHEDULED_TASKS_CONFIG_PATH` env override (mirrors `settings.js`).

## Things tests can't catch

- [x] **No secrets, no leftover debug logging** (the two `console.error` in `publishToStrfry`'s siblings are pre-existing).
- [x] **`publishToStrfry` race-safety:** the `settled` guard prevents double-resolve across the timeout / `error` / `close` / `stdin error` paths; `clearTimeout` on every terminal path. Correct.
- [x] **Loopback gate trust model:** `req.socket.remoteAddress` is the real TCP peer (not spoofable via headers); the header check is additive. Host→container (Docker NAT) and nginx→container both present as non-loopback or XFF-bearing, so both are rejected — only the in-container cron is allowed. Sound. (ADR's documented caveat — depends on nginx setting XFF — remains; acceptable per the decision.)
- [x] **AC-3 zero-member guard** also suppresses the genuinely-empty case (a tag with no qualifying members no longer publishes an empty kind-30000). This is the safer behavior and is called out in the ADR Consequences — not silent drift.
- [x] **Write-path symmetry:** `writeConfig` uses the same env-overridable `CONFIG_PATH`, so a test that seeds via the env path and then writes stays consistent. Good.

## House rules check

- [x] No new lint/typecheck/build tooling. No concept/firmware changes (no reinstall needed). TA-pubkey rule untouched (no literals introduced).

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/trustedList/index.js:73` `publishToStrfry`** — the 5s timeout from the old `exec` form is preserved, but a very large TL written to stdin + indexed by strfry could in principle approach it. The 900-member live test passed comfortably; flag only if a future much-larger TL ever times out. No change requested.
2. **Test reroute coupling to Docker** — the four `*-publish` suites now shell out to `docker exec ${TAPESTRY_CONTAINER} curl …`. Correct for these live-integration suites (the container is `tapestry` everywhere per CLAUDE.md, and they already require a live stack), but it does bind them to a Docker-named container. Acceptable; noted so a future non-Docker test host knows to set `TAPESTRY_CONTAINER`/adapt.
3. **Story's own suite regexes were repaired during implementation** (4 false-negatives: an import line, a sibling function's `signEvent`, an explanatory comment, a `${}`-truncated match). I re-read the repaired assertions — they encode the same AC intent, scoped correctly, and fail on the pre-fix code. Legitimate test-quality fixes, not weakening.

### Out-of-scope (carried forward, NOT this story)

- The full-gate cross-suite contamination (`most-pinned`, `tl-publication-from-pins` flaking only under concurrent load) is a pre-existing structural property of the live `*-publish` suites. It does not gate this story (all touched suites pass standalone + in-group) and is already on record from the expert review. A future "stabilize live-integration suites" cleanup could isolate per-suite strfry state.
- Story 2 (ADR-0022 hybrid e+a writer) and the Tier-3 fast-follows remain queued (`_intake.md` 2026-06-12).

## Verdict

**PASS** — all seven ACs implemented per the ADR with reviewer-verified passing coverage (unit + live behavioral), the four blockers closed and confirmed against the running stack, no blocking issues, and the only full-gate red is independently-confirmed pre-existing cross-suite flake in suites this diff does not touch.
