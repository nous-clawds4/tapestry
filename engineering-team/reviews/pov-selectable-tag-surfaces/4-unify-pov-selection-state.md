# Review: Story 4 — Unify POV selection state (one writer, no mount clobber, global switcher)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-09
**Diff:** `git show HEAD` (commit `98349009`, branch `feat/tags`, "fix: unify POV selection state")

## Quality gates (run by reviewer, not trusted)

- [x] `node test/pov-state-unification.test.js` — **5 passed, 0 failed** (S1–S5).
- [x] Sibling POV suites — all green, no regression:
  - `pov-selectable-tag-surfaces` — **17 passed**
  - `pov-resolution-status` — **21 passed**
  - `pov-notice-text` — **8 passed**
  - `pov-rank-threshold-key` — **7 passed**
- [x] `npm --prefix ui run build` — **clean** (built in ~15s; only the pre-existing chunk-size warning).
- [x] Playwright — not applicable (source-contract unit tests + manual browser proof per the test plan).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._

## Verdict up front

**CHANGES_REQUESTED.** The core clobber fix in `PovContext.jsx` is correct and well-reasoned, the
menu switcher is sound, and all gates pass. But the "single writer" AC is **not** actually met: a
**second, uncoordinated POV persist effect survived** in `BrainstormSettings.jsx` (lines 386–394).
It PUTs `pov` to the server on mount and on every change, with **no hydration guard** — re-introducing
the exact non-deterministic default-over-saved clobber race this story exists to eliminate, scoped to
the Settings page. One blocking fix required.

---

## AC-by-AC evidence

### AC-1 — Clobber fix (the core). PASS (mechanism correct)
Traced `PovContext.jsx` line by line. Effect ordering is sound:

- `hydratedRef = useRef(false)` (line 34) starts false.
- **Load effect** (defined first, line 37) runs on mount: sets `hydratedRef.current = false` (line 39,
  covers account switch), sets `selectedPov` from the localStorage fast-path (line 41), fires the async
  GET, and in a `finally` sets `hydratedRef.current = true` (line 53) only after the server load resolves.
- **Persist effect** (defined after, line 61) also runs on mount. It sees `selectedPov='nosfabrica'` (or
  cached) **and** `hydratedRef.current === false` → `return` (line 62). **No PUT of the default.** ✓
- After the GET resolves and sets `selectedPov='user'`, the ref is now `true`, the persist effect
  re-runs and writes `{pov:'user'}` — the *correct* loaded value. Redundant write-back, not a clobber.
- A genuine user change after hydration → `selectedPov` changes → persist effect runs with
  `hydratedRef.current === true` → persists. ✓ The guard cannot permanently block legitimate writes:
  it only ever gates on `hydratedRef.current`, which is set `true` in the load's `finally` on every
  code path (success *and* catch).
- **GET-fails degradation:** catch → `finally` sets hydrated true; `selectedPov` stays at the
  fast-path/default. Acceptable — degrades to the cached/default value, and subsequent user changes
  still persist. No clobber (nothing is written unless the user changes the value). ✓
- **StrictMode:** production build (the shipped path) does not double-invoke effects; the manual proof
  and this fix run against the prod bundle. Reasoning confirmed — not a concern here. ✓

The PovContext half of the story is correct.

### AC-2 — Single writer. **FAIL (blocking).**
`PovContext` is now the guarded writer, and `BrainstormUserMenu` no longer persists (it only reads
`rankAuthor` to gate the switch — line 37 of the new menu). **But `BrainstormSettings.jsx` still
contains a second POV persist effect** at lines 386–394:

```js
// Persist POV changes
useEffect(() => {
  if (!user || !pov) return;
  fetch('/api/user-prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pov }),
  }).catch(() => {});
}, [user, pov]);
```

Confirmed via `git show HEAD~1:ui/src/pages/BrainstormSettings.jsx`: the pre-commit file had **two**
POV persist effects (one at old line 71, one at old line 405). The diff removed only the first
(the top load + persist block). This one remained and now writes the aliased `pov` (= `selectedPov`
from context) — an uncoordinated second writer with **no hydration guard**. See Blocking #1 for the
race analysis.

`savePrefs()` including `pov` in its bulk PUT body (line 190) is **fine** — it's user-triggered (Save
button), writes the live shared `selectedPov`, and is merge-safe. Not a second-writer risk.

### AC-3 — Settings converged. PASS (state), blocked by AC-2 (persistence)
`pov`/`setPov` are aliased from `usePov() || {}` (line 58). All in-page usages now write the shared
selection: the House/My WoT card `onClick`s (lines 680, 702) and the pipeline's `setPov(loadedPov)` /
`setPov('user')` (lines 298, 350, 353). `PovProvider` wraps the router at the app root
(`ui/src/main.jsx:14–18`), so `usePov()` is never undefined in these pages — the `|| {}` guard is belt-
and-suspenders, and `setPov` is defined on every real page. State convergence is correct; the leftover
persist effect (AC-2) is the remaining defect.

### AC-4 — Global menu switcher. PASS
`BrainstormUserMenu` consumes `usePov() || {}` (line ~14 new), derives `pov = selectedPov || 'nosfabrica'`,
and renders a House ⇄ My WoT button group writing `setSelectedPov('nosfabrica' | 'user')`. "My WoT" is
`disabled={!hasDelegate}` and its `onClick` short-circuits on `hasDelegate` — gated on a configured
`rankAuthor`. All writes are `setSelectedPov && setSelectedPov(...)`, so a missing context can't crash.
The component early-returns for `!user`, so the logged-out path is unaffected.

### AC-5 — No search regression. PASS
`BrainstormSearch.jsx` is untouched and still consumes `usePov()` (S5 green). The hydration guard does
not delay search's auto-select-to-`user`: that is a real `setSelectedPov('user')` change fired after
the WoT-ready check, which is after load — the guard is already `true`, so it persists normally.

### AC-6 — Fixes the reported bug. PARTIAL
For the operator's literal repro (set My WoT, hard-refresh a **tag** page) the PovContext guard fixes
it: the saved `pov:'user'` survives mount and reads go out `wotPov=user`. **However**, the surviving
Settings-page writer (AC-2) can re-create the reported symptom whenever the user visits/refreshes
**Settings** with an empty/`nosfabrica` localStorage cache — see Blocking #1. So the bug class is not
fully closed.

---

## Findings

### Blocking

1. **`ui/src/pages/BrainstormSettings.jsx:386–394` — leftover second POV persist writer.**
   This `useEffect` PUTs `{pov}` to `/api/user-prefs` on `[user, pov]` with **no hydration guard**.
   Race on a Settings mount when the server holds `pov:'user'` and localStorage has no cache (fresh
   device, cleared storage, cache eviction):
   1. Mount — PovContext `selectedPov` initializes to `'nosfabrica'`.
   2. This effect fires immediately → `PUT {pov:'nosfabrica'}` → **clobbers the server value**.
   3. Concurrently PovContext's load GET is in flight. If the clobber PUT lands before the GET reads,
      the GET returns `'nosfabrica'` and the saved `'user'` is **permanently lost**; the user then sees
      the "no point of view configured" house read on tag pages — the exact reported bug.

   This directly violates AC-2 ("Exactly one component persists `pov` (`PovContext`); the others
   delegate") and re-introduces the mount-clobber race the story set out to eliminate. It is not caught
   by the tests: S2 only asserts the absence of `useState('nosfabrica')`, not the absence of a persist
   effect.

   **Asked change:** delete the `useEffect` at lines 386–394 entirely. `PovContext` is the sole writer;
   the `setPov` calls in this page already persist through the guarded context effect, and `savePrefs()`
   covers the explicit Save. (Optionally, extend S2 to assert `BrainstormSettings` no longer contains a
   `fetch('/api/user-prefs', { method: 'PUT' ... pov ... })` outside `savePrefs`, so the second-writer
   contract is actually guarded.)

### Non-blocking

1. **`ui/src/context/PovContext.jsx:61–69`** — after the server load resolves to a value that differs
   from the fast-path, the persist effect re-runs and writes the just-loaded value back (a redundant
   round-trip PUT). Harmless and merge-safe (writes the correct value); noting only so it isn't mistaken
   for a clobber. No change required.

2. **Test coverage of the single-writer contract.** S1–S5 are structural greps; none asserts that
   `BrainstormSettings` has *no* independent `PUT …/user-prefs { pov }`. That gap is exactly why the
   Blocking issue passed CI. Consider tightening S2 as noted above.

## Concept-graph integrity
Not applicable — no concept handles, schema, or firmware-affecting definitions touched. UI state/CSS only.

## House rules check
- [x] No new lint/typecheck/build tooling.
- [x] No TA-pubkey hardcodes introduced; `LEGACY_*` constants untouched.
- [x] Concept Graph authority not implicated.
- [x] No secrets, no `console.log` added (existing `console.error` in `importLocal10040` predates this diff).

## Verdict
**CHANGES_REQUESTED** — remove the leftover POV persist effect at
`ui/src/pages/BrainstormSettings.jsx:386–394`. Everything else (PovContext guard, menu switcher,
settings state convergence, all gates) is correct and mergeable once that single second-writer is deleted.
