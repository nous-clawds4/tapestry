# Router config was rebuilt from saved state and presets without the plugin/URL checks, and plugin paths were checked by name only

**Id:** 2026-09-30-router-saved-state-revalidation
**Type:** bug
**Opened:** 2026-09-30 (post-merge verification of PR #776 on main `97233b58`; residuals of OPEN.md row `2026-09-28-router-plugin-value-hardening`)
**Status:** DONE
**Done:** 2026-09-30 — branch `fix/router-hardening-followup` (PR against `staging`)

**What was seen.** PR #776 validated `pluginDown` / `pluginUp` / `urls` at one ingress, `POST /api/strfry/router-config`.
Four gaps remained in `src/api/strfry/routerConfig.js`:

1. The plugin check was lexical (`path.resolve`): it did not resolve symlinks or require the file to exist, so a
   missing plugin was accepted (the router then fails on it) — short of the fix shape row
   `2026-09-28-router-plugin-value-hardening` itself recommended (realpath, existing direct child).
2. Toggle, restore-defaults, restart and startup rebuilt the config from `router-state.json` with no checks, so a
   value saved before #776 (or hand-edited) still reached the router, escaped but otherwise unchecked.
3. Presets (`setup/router-presets.json`) were trusted without checks.
4. `GET /api/strfry/router-plugins` listed every `*.js` name, including ones router-config would refuse.

**What shipped.**
- `pluginPathProblem`: '' or an absolute path to a `.js` file with a plain name, directly in the plugins directory both
  as written and after `realpath` (both sides realpathed), existing, a regular file. `POST /router-config` answers 400
  with the reason before any write or restart.
- `vetStreamsForConfig` runs on every rebuild (toggle, restore-defaults, restart, `initRouter`). **An enabled stream
  that fails is left out of the generated config (as if disabled)**, named in a `[router] Leaving stream …` warning
  and in the response's `skipped`; the other streams are written and the router restarts. `router-state.json` is not
  rewritten (ADR relay-management/0002: server-local state is never rewritten on these paths), so the operator sees
  the stream as saved and can fix or re-save it. Leaving the whole stream out, rather than blanking the plugin or
  dropping one URL, is the conservative choice: a blanked `pluginDown` would mirror what the plugin filtered.
- `router-restart` now rebuilds the config from saved state (same checks) before restarting.
- `loadPresets` drops a preset that fails, with a warning; the shipped presets all pass (suite R1).
- `router-plugins` lists only files that pass `pluginPathProblem`.
- **Internal relay hosts stay accepted — a documented choice.** No shipped preset uses one, but the in-container relay
  (`ws://127.0.0.1:7777`) and docker service names are legitimate operator targets, a name check cannot see what a
  DNS name resolves to, the setters are owner/admin/local only, and with (2) a default block would silently drop
  streams an instance already runs. An opt-in block (a `brainstorm.conf` key using `src/utils/ssrfGuard.js`'s
  classifiers) is possible later if wanted.
- `BRAINSTORM_ROUTER_PLUGINS_DIR` overrides the plugins directory (read per call; unset in the image) so the suites
  can use a temp dir.
- Operator note: `docs/CONFIGURATION.md` § "Auditing saved plugin paths" (one-line audit of `router-state.json`).

Suite `test/strfry-router-saved-state.test.js` (32 tests; 5 pass and 27 fail on staging `69448b43`, 32 pass with the
fix). `strfry-router-value-hardening` now uses a temp plugins dir (its plugin must exist).

**Not changed:** stream filters on saved state (ADR relay-management/0002 keeps filter reconstruction at the client
ingress; the sink JSON-escapes them). `isOwner` still admits admins (the decision recorded in row
`2026-09-28-router-plugin-value-hardening`).

**Pointer:** `src/api/strfry/routerConfig.js` (`pluginPathProblem`, `relayUrlProblem`, `vetStreamsForConfig`,
`loadPresets`, `handleRestartRouter`); `test/strfry-router-saved-state.test.js`; `docs/CONFIGURATION.md` § "Checks on
router values".
