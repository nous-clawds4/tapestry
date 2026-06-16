# ADR 0001: Trusted-list & pin-publish blocker fixes

**Status:** Accepted
**Date:** 2026-06-12
**Story:** `engineering-team/stories/tag-stack-merge-hardening/1-trusted-list-and-pin-publish-blockers.md`
**Epic:** tag-stack-merge-hardening

## Context

Four verified blockers in the Story-11/19 trusted-list + pin-publish code, plus one bundled gap. Each fix is local; no concept definitions change, so no firmware reinstall. Confirmed code sites:

- **B1 — auth bypass.** `requireAuth` (`src/api/trustedList/index.js:162`) returns the session pubkey if `req.session.pubkey` is a 64-hex string, never checking `req.session.authenticated`. The signature-free `POST /api/auth/verify-user` (`src/middleware/auth.js:519`) sets `req.session.pubkey` for any supplied pubkey; `req.session.authenticated = true` is only set after the signed challenge (`auth.js:157`, the field the rest of the codebase gates on — `auth.js:197,251,277`). Three endpoints trust it: `refresh-pinned-tag`, `refresh-pinned-tags-for-viewer`, `prepare-nip51-export`.
- **B2 — empty Follow Set on first pin.** `Tag.jsx:123-135` fires `refresh-pinned-tag` (creates the kind-30392) and `publishNip51ExportForPin` (reads it via `prepare-nip51-export`) concurrently. On a first pin the 30392 doesn't exist yet, so prepare returns `memberCount: 0` and the user signs+publishes an **empty kind-30000** to their write relays + 5 well-known relays (`publishTagPin.js:241-266`).
- **B3 — open cron endpoint.** `handleRefreshAllPinnedTags` (`index.js:171`) has no gate; the cron caller is a plain loopback `curl POST http://127.0.0.1:$PORT/...` (`src/algos/refreshPinnedTagTLs.sh`), but nginx also proxies the path, so the internet can trigger prod-scale recompute + TA-signed publishes.
- **B4 — TL self-wipe (two interlocking).** (a) `runOnePin`'s publish-error path returns `{status:'error'}` with no `dTag` (`refreshPinnedTags.js:216`), even though `dTag` was computed at `:179`. `refreshAllPinnedTags` only adds `result.dTag` to `currentDTags` (`:286`), so an errored pin's dTag is absent → `retractStaleTLs` publishes an empty-membership replacement of its healthy TL (`:245-272`). (b) `publishToStrfry` pipes the signed event JSON as a shell argument — `echo '<json>' | strfry import` (`index.js:73-78`) — so TLs above ~the 128 KiB `MAX_ARG_STRLEN` (≈600–700 members) **always** fail to publish, reliably triggering (a).
- **Bundled (AC-7).** A fresh deploy's `scheduled-tasks.json` seeds `{version:2, entries:[]}` (`migration.js:36`, `index.js:65`), so no entry ever invokes `refreshPinnedTagTLs` — periodic refresh/retraction never runs until an operator hand-creates one.

## Options considered (only B3 has a real fork; the rest are determined)

### B3 — distinguishing the loopback cron call from an internet request

- **Option A — loopback socket + absence of proxy headers (chosen).** Allow iff `req.socket.remoteAddress` is loopback (`127.0.0.1`/`::1`/`::ffff:127.0.0.1`) AND no `x-forwarded-for`/`x-real-ip` header is present. The direct cron `curl` to `:7778` satisfies both; an internet request reaches Express *via nginx*, which appends `X-Forwarded-For`. No script change, no new config. Cons: depends on the standard nginx site config setting XFF (verifiable in `setup/`); a non-standard proxy that omits XFF would weaken it — but a non-loopback peer is still rejected, so the residual bypass requires already being on the host.
- **Option B — shared secret.** Cron reads a token from `brainstorm.conf` and sends it; endpoint checks it. Robust regardless of nginx, but adds a per-deployment secret to the conf template + entrypoint + script — more surface, touches deployment provisioning.
- **Option C — move cron off HTTP.** Have the scheduled task call `refreshAllPinnedTags()` directly (node), and gate the HTTP route with `requireOwner`. Most robust (no heuristic), but rewires the task invocation and is the largest change.

**Chosen: A** — minimal, satisfies AC-4 verbatim ("does not originate from the local host → rejected; local orchestrator still succeeds"), zero deployment change. B/C noted as future hardening if the trust boundary tightens.

### B1 / B2 / B4 / AC-7 — determined, no alternative worth carrying

B1 is a one-line predicate (`&& req.session.authenticated === true`). B4(b)'s only sane fix is getting the event off `argv` — chosen: `spawn('strfry', ['import','--no-verify'])` and write JSON to the child's **stdin** (`child.stdin.write(json+'\n'); child.stdin.end()`), eliminating the ARG_MAX limit at its root (the data already flows through stdin today, just via `echo` on the command line). A temp-file variant was rejected (disk lifecycle, cleanup, races) when stdin is strictly simpler.

## Decision

Fix all four in place plus seed the disabled schedule entry:

1. **B1:** `requireAuth` also requires `req.session.authenticated === true`.
2. **B2:** in `Tag.jsx`, `await` the `refresh-pinned-tag` call before invoking the export; and make `publishNip51ExportForPin` a single chokepoint that **refuses to publish when `memberCount === 0`** (returns a `{skipped:true}` sentinel) — so no caller can publish an empty follow-set, covering both the race and the genuinely-empty case.
3. **B3:** gate `handleRefreshAllPinnedTags` with a loopback-only check (Option A) before any work.
4. **B4:** return the computed `dTag` on `runOnePin`'s publish-error path (so `currentDTags` protects an errored pin from retraction); and replace `publishToStrfry`'s `echo | strfry import` with a stdin-fed `spawn`.
5. **AC-7:** seed a single default-disabled `refreshPinnedTagTLs` entry on fresh-install only (file absent), never resurrecting it after a user deletes it.

## Consequences

- Closes the impersonation hole, the open prod-scale trigger, the first-pin empty-list publish, and the popular-tag TL-wipe — the merge blockers.
- B4(b) (stdin publish) also fixes large TLs generally — any TA-signed event over 128 KiB now publishes, not just TLs.
- B2's zero-member guard changes behavior for the genuinely-empty case too: a pin with no qualifying members no longer publishes an empty kind-30000. This is the safer default and matches AC-3; if a future product reason wants empty follow-sets, that's a separate decision.
- B3's gate assumes the standard nginx config sets `X-Forwarded-For` — Implementer verifies against `setup/`. If a deployment fronts `:7778` differently, revisit with Option B.
- AC-7 seeds disabled; retraction stays dormant until an operator enables it — deliberately, since enabling retraction is only safe *after* B4 lands (which it does in this same story).
- **Firmware reinstall required?** No.

## Implementation notes

- **`src/api/trustedList/index.js`**
  - `requireAuth` (~:162): reject unless `req.session?.authenticated === true` (keep the existing pubkey-format check). Same 401 shape.
  - `handleRefreshAllPinnedTags` (~:171): add an `isLoopbackRequest(req)` guard returning `403 { success:false, error:'loopback only' }` before requiring `./refreshPinnedTags`. Helper: loopback `req.socket.remoteAddress` AND no `x-forwarded-for`/`x-real-ip`. Keep it local to this module (could promote to shared middleware later).
  - `publishToStrfry` (~:73): replace `exec('echo ... | strfry import')` with `spawn('/usr/local/bin/strfry', ['import','--no-verify'])`, write `JSON.stringify(event)+'\n'` to `child.stdin`, `end()` it, resolve on exit 0 / reject on non-zero or spawn error; preserve the 5s timeout semantics (`child.kill` on timeout).
- **`src/api/trustedList/refreshPinnedTags.js`**
  - `runOnePin` publish-error path (~:216): return `{ status:'error', errorReason, dTag }` (dTag is in scope from :179). Other early error returns (before dTag exists) are out of AC-5 scope — those pins are unresolvable, not "validated then failed".
- **`ui/src/pages/Tag.jsx`** (~:123-135): `await` the `refresh-pinned-tag` fetch (tolerate failure but sequence it) and only then call `publishNip51ExportForPin`. Mirror the await-then-export ordering ADR-0017's `ExportModal.handleConfirm` already uses.
- **`ui/src/utils/publishTagPin.js`** (`publishNip51ExportForPin`, ~:250): after `prepare`, if `memberCount === 0` (or `unsigned` has no `p` tags), return `{ skipped:true, memberCount:0 }` without signing/publishing. Callers already `.catch`; `ExportModal` should treat `skipped` as a no-op with a gentle message rather than an error.
- **`src/api/scheduled-tasks/index.js`** `readConfig` (~:65): when `CONFIG_PATH` does not exist (fresh install), return `{ version:2, entries:[ DEFAULT_REFRESH_ENTRY ] }` where the entry is `{ id:'seed:refreshPinnedTagTLs', taskId:'refreshPinnedTagTLs', label:<registry name>, args:{}, enabled:false, intervalDays:1, intervalHours:0, intervalMinutes:0, cron:'' }`. Existing files pass through migration unchanged (no resurrection). Keep `migration.js` a pure shape-converter.

## Out of scope

- Tier-3 fast-follows (`publishOrThrow` dead-code, d-tag/slug edge cases, search-URL/perf, Pins papercuts) — `_intake.md` 2026-06-12.
- The ADR-0022 hybrid e+a writer (Story 2 of this epic).
- Promoting the loopback check to shared middleware; shared-secret/in-process cron (Options B/C) unless the trust boundary changes.
- Retraction robustness for pins that error *before* `dTag` is computed (transient tag-missing) — AC-5 explicitly scopes to post-identification failures, and B4(b) removes the dominant failure cause.
