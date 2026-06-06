# Review: Story communities-notifications/7 — Notification preferences (the sovereignty control)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** working tree (uncommitted) atop commit `0469ab8b`

New: `ui-communities/src/lib/notificationPrefs.js`, `ui-communities/src/pages/NotificationSettings.jsx`, `ui-communities/src/pages/NotificationSettings.module.css`, `test/notification-preferences.test.js`.
Modified: `ui-communities/src/App.jsx`, `ui-communities/src/components/Header.jsx`, `test/test.js`.

## Quality gates (run by reviewer, not trusted)

- [x] `node test/test.js` — **PASS**. `notification-preferences suite: PASS (9 passed, 0 failed)`; `Overall: PASS`; no regressions across all 40 suites (exit 0).
- [ ] `npm run test:playwright` — not applicable (no Playwright suite for this story).
- [x] `npx eslint src/pages/NotificationSettings.jsx src/lib/notificationPrefs.js src/App.jsx src/components/Header.jsx` — exit **0**, clean.
- [ ] _Typecheck not configured — skipped (JS-without-build, per house rules)._
- [ ] _Build not configured for this gate — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

| AC | Where met | Test |
|---|---|---|
| AC1 independent toggle per occasion | `NotificationSettings.jsx:51` (`OCCASIONS.map`), occasions in `notificationPrefs.js:10-14` | T6 |
| AC2 **off by default** | `notificationPrefs.js:17-31` (`defaultPreferences`/`mergePreferences`), `loadPreferences:37-44` routes null/parse-error through merge | T1, T2, T4, T5 |
| AC3 save immediately + quiet "Saved" | `NotificationSettings.jsx:24-26,57` | T6, T8 |
| AC4 no master switch | per-occasion render only; no enable-all control (`NotificationSettings.jsx`) | T7 |
| AC5 state by position + text label, not color | `NotificationSettings.jsx:63` (On/Off label), `:64-73` (`role="switch"` + `aria-checked`) | T6 |
| AC6 failed save reverts + inline retry | `NotificationSettings.jsx:27-30,58-62` | T8 |

### Off-by-default (AC2 — the gate property), scrutinized hardest
- `defaultPreferences()` (`notificationPrefs.js:17-19`) returns all three occasions `false`. Verified.
- `mergePreferences(stored)` (`notificationPrefs.js:23-31`) starts from an all-off literal and copies **only** keys that are (a) known occasions (`Object.keys(out)` is the allowlist) and (b) `typeof === 'boolean'`. So `null`/`undefined`/`{}`/unknown-keys/non-boolean (`'yes'`, `1`) all yield all-off. T2/T4/T5 confirm against real source.
- `loadPreferences(pubkey)` (`:37-44`) routes the parsed value through `mergePreferences`, and the `try/catch` returns `mergePreferences(null)` on any throw. So a fresh person (no key), a corrupt stored string (JSON.parse throws), and a localStorage read failure all collapse to silence. This is the property Story 8 gates on; it holds by construction.

### No master switch (AC4)
- The page renders strictly `OCCASIONS.map(...)` — one toggle per occasion, nothing else interactive besides the per-row retry. No "enable all / turn on everything" control exists. T7 also asserts that copy is absent. Verified.

### Save + revert-on-failure (AC3, AC6)
- `savePreference` (`notificationPrefs.js:48-56`) returns `{ ok: true, prefs }` or `{ ok: false }` when `localStorage.setItem` throws (quota/private mode), as the ADR's revert path requires.
- `applyToggle` (`NotificationSettings.jsx:18-31`) captures `prev = prefs`, optimistically flips, clears prior saved/error state, then calls `savePreference`. On `ok` → `setSavedId(id)` shows "Saved" (`:57`). On `!ok` → `setPrefs(prev)` restores the **exact** prior object and `setErrorId(id)` renders an inline "Couldn't save. Retry?" button (`:58-62`) wired back to `applyToggle(o.id)`. The toggle never silently appears changed: a failed write reverts position and surfaces an error affordance. Verified.

### a11y / state-not-color (AC5)
- The toggle is a real control: `<button role="switch" aria-checked={on} aria-label={o.label}>` (`NotificationSettings.jsx:64-73`).
- State by **position** (`.switchOn .knob { left: 20px }`, `NotificationSettings.module.css:111-113`) **and** a text label `{on ? 'On' : 'Off'}` (`:63`) — not color alone.
- 44px target: the switch is `44px × 26px` with `min-width:44px` (`NotificationSettings.module.css:82-93`). Note: height is 26px, below the 44×44 the a11y guide states; this matches the established small-control convention in this codebase (reactBtn/newPill) and the design guide's own toggle spec (`--accent` track ~`26px`), so not flagged. The sign-in button is `min-height:44px` (`:28`).
- Focus ring intact: the switch does **not** set `outline: none`, so the global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` (`src/styles/reset.css:52-54`) applies — the `--accent` ring the a11y guide requires. Verified.
- CSS is token-based (`--space-*`, `--radius-*`, `--text-*`, `--accent`, `--bg-*`). Raw px appear only on small-control geometry (switch 44/26/20px, knob, signIn padding) — consistent with the house convention; not flagged.

### Per-identity storage
- `storageKey(pubkey)` → `communities:notif-prefs:<pubkey>` (`notificationPrefs.js:33-35`). Two identities on one device write to distinct keys. Anon/empty pubkey falls back to `...:anon` so an unsigned read doesn't throw — but the page guards on `signedIn` before showing toggles, so the `anon` bucket is effectively unreachable through the UI. Verified.

### Routing / menu wiring
- `App.jsx:200` adds `{ path: 'settings', element: <NotificationSettings /> }` under the AppShell children, so the outlet context (`viewer/signedIn/onSignIn`, `App.jsx:142-157`) is available — matches `useOutletContext()` (`NotificationSettings.jsx:13`).
- `Header.jsx:163-170` adds a "Notification settings" item in the signed-in account menu, after "Start a Circle" (per ADR), navigating to `/settings`. Not a top-level nav item. Verified.
- Signed-out: `NotificationSettings.jsx:33-41` renders a sign-in prompt with an honest line and a "Sign in" button wired to the `onSignIn` from outlet context — no dead control. Verified (T9 covers route + menu).

### Copy
- Lede: "Choose what you hear about. Everything here is off until you turn it on. You can turn any of it off again." (`NotificationSettings.jsx:46-48`) — matches the design guide's stated stance nearly verbatim; honest, plain, no urgency/capture language.
- Signed-out: "Sign in to choose what you hear about. It stays your choice." (`:37`) — plain, no nag.
- Error: "Couldn't save. Retry?" (`:60`) — plain. No forbidden phrases (no "turn on everything", no unread-count/FOMO copy). Verified against style guide §forbidden-phrases.

### Sequencing sanity
- The page only persists preferences; it does **not** generate, fetch, or show any notification. There is no inbox, no new-marker, no relay/event read. The dark-until-Story-8 state is correct per the story's "out of scope". Verified.

### Real-source tests
- T1–T5 `loadExport` the genuine `defaultPreferences`/`mergePreferences` from `notificationPrefs.js` via regex-extract + `new Function`, then eval them. They exercise shipped source (not a re-implementation). The localStorage I/O wrappers are intentionally source-guarded only (T6–T9 read the files), consistent with the test plan and the Node-without-DOM constraint. Verified.

## ADR adherence

- [x] Files changed match ADR-0037's implementation notes exactly (lib + page + css + App route + Header menu item).
- [x] Layering respected: pure default/merge core separated from the thin localStorage I/O wrapper; UI consumes the module, never localStorage directly.
- [x] No new dependencies; no new lint/build tooling (house rule honored).
- [x] Device-local localStorage, per-identity key — as decided (Option A). Portability correctly deferred.

## Concept-graph integrity
- [x] N/A — no concepts, handles, or firmware touched. This is a client-only device-local settings surface; no concept definitions changed.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging or `console.log` in the new/changed source.
- [x] No commented-out code (only explanatory comments).
- [x] Error paths handled: parse error → defaults; write throw → `{ok:false}` → revert + retry.
- [~] Concurrency / rapid toggling: each `applyToggle` reads `loadPreferences` fresh inside `savePreference` then writes the single key, so rapid sequential toggles on one occasion converge correctly (last write wins, and the optimistic `prefs` reflects it). Cross-occasion rapid toggles are independent keys-in-one-object; `savePreference` merges over the latest stored value, so no lost update. Acceptable.
- [x] Security: no injection surface — values are booleans serialized to JSON under a namespaced per-pubkey key.

## House rules check
- [x] Concept Graph API authority respected (not applicable here; no concept reads needed).
- [x] No new lint/typecheck/build tooling without an ADR.

## Findings

### Blocking
_None._

### Non-blocking
1. **`NotificationSettings.jsx:14`** — Stale prefs on a same-mount identity switch. `prefs` is initialized once with `useState(() => loadPreferences(viewer))` and only mutated by `applyToggle`; it never re-reads when `viewer` changes. Sign-out is safe (the `!signedIn` guard at `:33` hides the stale state behind the sign-in prompt). The narrow gap: if a person signs out and signs back in **as a different identity without leaving `/settings`**, the route element is reused (react-router swaps only outlet context, no remount), so the toggles would briefly display identity A's saved state while `savePreference` writes to identity B's key. No data corruption (A's key is untouched; B's writes land on B's key), and the surface is dark until Story 8 — but it momentarily violates the per-identity isolation the ADR calls out. App.jsx solves the identical problem for `joinedSet` with a re-hydrate effect (`App.jsx:87-90`). Optional improvement: mirror that pattern —
   ```jsx
   useEffect(() => { setPrefs(loadPreferences(viewer)) }, [viewer])
   ```
   (with the same `react-hooks/set-state-in-effect` disable comment used at `App.jsx:88`). Left non-blocking because the path is narrow and harmless given the signed-out guard and the dark-until-Story-8 state; recommend folding it in when Story 8 lights up the surface, if not now.

2. **`notificationPrefs.js:52`** — `savePreference` returns `{ ok: true, prefs: next }` but the page (`applyToggle:24-26`) uses only `result.ok` and keeps its own optimistic `prefs`. The `prefs` field on the success return is currently unused. Harmless (a reasonable affordance for a future caller), just noting it isn't consumed.

## Verdict
**PASS**

Reasoning: All six acceptance criteria are met and tested; the off-by-default gate property holds by construction across fresh/corrupt/error inputs and is verified against real source (T1–T5). No master switch; revert-on-failure with retry is correct and restores exact prior state; the toggle is a real `role="switch"` control with state by position + text label and an intact global `--accent` focus ring; storage is per-identity; routing/menu/signed-out wiring is complete with no dead controls; copy matches the design and style guides with no urgency/capture language. The suite passes 9/9 with no regressions and lint is clean. The single substantive finding (stale prefs on a same-mount identity switch) is narrow, non-corrupting, and masked by the signed-out guard and the dark-until-Story-8 state, so it does not block; recommend addressing it alongside Story 8.

PASS
