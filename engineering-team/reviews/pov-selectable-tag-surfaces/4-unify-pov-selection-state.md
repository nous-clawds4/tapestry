# Review: Story 4 — Unify POV selection state (one writer, no mount clobber, global switcher)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-09
**Diff:** `git show 98349009` (initial) + `git show 8fdb2ddc` (blocker fix), branch `feat/tags`

## Verdict: **PASS**

First pass was **CHANGES_REQUESTED** for a leftover second POV persist writer in
`BrainstormSettings.jsx`. That blocker was fixed in commit `8fdb2ddc` and re-audited below. All ACs met,
all gates green.

## Quality gates (run by reviewer, not trusted)

- [x] `node test/pov-state-unification.test.js` — **5 passed, 0 failed** (re-run after the fix).
- [x] Sibling POV suites — all green, no regression: `pov-selectable-tag-surfaces` **17**,
  `pov-resolution-status` **21**, `pov-notice-text` **8**, `pov-rank-threshold-key` **7**.
- [x] `npm --prefix ui run build` — **clean** (~15s; only the pre-existing chunk-size warning).
- [x] Playwright — not applicable (source-contract units + manual browser proof per the test plan).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._

---

## AC-by-AC evidence

### AC-1 — Clobber fix (the core). PASS
Traced `PovContext.jsx` line by line. `hydratedRef = useRef(false)` starts false; the load effect
(defined first) resets it false on mount/account-switch and sets it true in a `finally` on **both**
success and catch paths; the persist effect early-returns while `hydratedRef.current === false`, so the
default `nosfabrica` is never PUT over a saved `pov:'user'` on mount. Post-hydration user changes
persist normally; the guard can never permanently block a legitimate write. StrictMode double-invoke is
not a concern in the shipped prod bundle.

### AC-2 — Single writer. PASS (blocker resolved)
The initial commit left a second, unguarded POV persist `useEffect` in `BrainstormSettings.jsx:386–394`
(the pre-commit file had two persist effects; only one was removed). Commit `8fdb2ddc` **deletes** it,
replacing it with a comment noting PovContext owns persistence. Re-verified:

- `grep` for `JSON.stringify({ pov })` in `BrainstormSettings.jsx`, `BrainstormUserMenu.jsx`,
  `PovContext.jsx` → **none** in Settings/Menu (PovContext's guarded effect is the sole `{pov}` PUT).
- The only `/api/user-prefs` PUT remaining in Settings is `savePrefs()` (line 186/189) with the bulk
  body `{ pov, selectedMetrics, filters, sortConfig, rankAuthor, rankRelay }` — user-triggered (Save
  button), writes the live shared `selectedPov`, merge-safe. The Menu's only `/api/user-prefs` touch is
  a GET (line 35) reading `rankAuthor` to gate "My WoT". PovContext is now the sole writer. ✓

### AC-3 — Settings converged. PASS
`pov`/`setPov` aliased from `usePov() || {}`; all in-page usages (House/My WoT cards, pipeline
`setPov(loadedPov)` / `setPov('user')`) write the shared selection, which now persists only through
PovContext's guarded effect. `PovProvider` wraps the router at `ui/src/main.jsx:14–18`, so `usePov()` is
never undefined on these pages.

### AC-4 — Global menu switcher. PASS
`BrainstormUserMenu` consumes `usePov() || {}`, renders a House ⇄ My WoT button group writing
`setSelectedPov`, gates "My WoT" on a configured `rankAuthor` (`disabled={!hasDelegate}` + guarded
`onClick`). All writes are null-guarded (`setSelectedPov && …`); the logged-out path early-returns.

### AC-5 — No search regression. PASS
`BrainstormSearch.jsx` untouched, still consumes `usePov()` (S5 green). The hydration guard does not
delay search's auto-select-to-`user` (a real post-load change, so `hydratedRef.current === true`).

### AC-6 — Fixes the reported bug. PASS
With the second writer gone and PovContext's guard in place, a saved `pov:'user'` survives a hard
refresh on any surface — including Settings, which previously reintroduced the clobber — and tag reads
go out `wotPov=user`. The bug class is closed.

---

## Findings

### Blocking
None outstanding. (Resolved: `BrainstormSettings.jsx:386–394` leftover persist writer — deleted in
`8fdb2ddc`.)

### Non-blocking
1. **`PovContext.jsx:61–69`** — after a server load that differs from the fast-path, the persist effect
   re-runs once and writes the just-loaded value back (redundant, merge-safe, writes the correct value).
   Noting only so it isn't mistaken for a clobber. No change required.

## Tightened S2 — verified genuine, no false-flag
S2 now also asserts neither converged component contains `/JSON\.stringify\(\s*\{\s*pov\s*\}\s*\)/`.
Confirmed by direct node eval: the regex matches **false** against the current `BrainstormSettings.jsx`
(the `savePrefs` bulk body `{ pov, selectedMetrics, … }` has additional fields, so it does not match the
single-field pattern) while the `savePrefs` bulk `{ pov` is still present. So the guard catches exactly
the stray-effect class that caused the blocker without false-flagging the legitimate bulk save. ✓

## Concept-graph integrity
Not applicable — UI state/CSS only; no concept handles, schema, firmware, or TA-pubkey usage touched.

## House rules check
- [x] No new lint/typecheck/build tooling.
- [x] No TA-pubkey hardcodes; `LEGACY_*` constants untouched.
- [x] No secrets; no debug `console.log` added.

## Verdict
**PASS** — the PovContext hydration-guard clobber fix, the single-writer convergence (blocker resolved
in `8fdb2ddc`), the global-menu switcher, and the tightened S2 regression guard are all correct. Gates
green: new suite 5/5, siblings 17/21/8/7, ui build clean.
