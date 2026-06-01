# Review: Login-failure surfacing + tag-result collapse (ADR 0021)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-01
**Diff:** `git diff f8a8c479^..HEAD` (impl `6a7915e7`, tests `c4744c50`)
**Story:** none (user elected to proceed without one — recorded in `_intake.md`)
**ADR:** `engineering-team/decisions/0021-login-failure-surfacing-and-tag-result-collapse.md`
**Test plan:** `engineering-team/stories/login-failure-and-tag-collapse.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/login-failure-and-tag-collapse.test.js` — **PASS (18/18)**. Re-run at review time.
- [x] Sibling source-pattern suites that read the touched files — `collapse-into-export-concept` **28/28**, `search-results-url` **9/9**. No regression. (Full `npm test` not run end-to-end: it hangs on sub-suites needing live strfry/neo4j/meili, unrelated to this change.)
- [~] `npm run test:playwright` — companion spec authored (`tests/brainstorm/login-failure-and-tag-collapse.spec.js`) but **could not execute** here: chromium fails to launch (missing host libs `libatk`, `libgbm`, …). User confirmed the behavior visually in the browser. Should run on staging where Chrome is available.
- [x] `npm run build` (ui) — **clean**.
- [x] Lint — no **new** errors in touched files (`nip07.js`, `LoginErrorModal.jsx`, `Header.jsx` clean; pre-existing repo-wide errors unchanged).

## Spec adherence (ACs from ADR 0021)

- [x] **AC-1** bounded `waitForNostr` (immediate / late-injection / timeout→null) — behavioral tests pass; `ui/src/utils/nip07.js:14-30`.
- [x] **AC-2** `runLogin` uses the wait, no immediate `!window.nostr` throw — `AuthContext.jsx:74-80`.
- [x] **AC-3** four typed codes — `AuthContext.jsx:11-21,75,87,102,130` + fallback `UNKNOWN` at `:148`.
- [x] **AC-4** vendor-neutral copy, no brand names — verified absent in `AuthContext.jsx` + `LoginErrorModal.jsx`.
- [x] **AC-5** `NOT_AUTHORIZED` carries the server message — `AuthContext.jsx:102,130`; modal renders it `LoginErrorModal.jsx:23-27`.
- [x] **AC-6** single modal at `AuthProvider`, coded error, re-throw, code→copy map — `AuthContext.jsx:140-150,162`; `LoginErrorModal.jsx`.
- [x] **AC-7** all entry points covered; inline span + state removed from Header; dead `.signin-error` CSS removed — `Header.jsx`, `styles.css` (confirmed 0 occurrences in the served bundle); bare callsites wrapped (`BrainstormUserMenu.jsx:75`, `BrainstormSearch.jsx:497`); `Pins.jsx:157` / `Tag.jsx:154` already catch the re-throw.
- [x] **AC-8** `TAG_COLLAPSE_LIMIT = 3` — `BrainstormSearch.jsx:16`.
- [x] **AC-9** sliced render unless expanded — `BrainstormSearch.jsx:1477`.
- [x] **AC-10** conditional toggle, remaining count, `aria-expanded` — `BrainstormSearch.jsx:1481-1491`.
- [x] **AC-11** reset on fresh search only (offset===0 branch), not load-more — `BrainstormSearch.jsx:915`.
- [x] **AC-12** `.bs-taghits-toggle` styling — `styles.css`.
- [x] No criterion silently dropped; no behavior added beyond the ADR.

## ADR adherence

- [x] Files changed match the ADR's Implementation notes exactly (new `utils/nip07.js`, `LoginErrorModal.jsx`, `AuthContext` wrapper, Header/​callsite/​CSS edits, collapse in `BrainstormSearch`).
- [x] Layering respected — race logic isolated in a pure helper; auth-failure UX owned by the auth layer; copy mapping in the modal.
- [x] No new dependencies. No new lint/build tooling.
- [x] Codes implemented as a plain `Error` + `.code` — an option the ADR explicitly allowed.

## Concept-graph integrity

- [x] N/A — no concepts touched (confirmed at orientation). No handles, no firmware reinstall. Correctly recorded in the ADR.

## Things tests can't catch

- [x] No secrets; no `console.log`/debug; no commented-out code.
- [x] **TA-pubkey rule (CLAUDE.md):** no pubkey literals introduced; no `authors:` filters touched. N/A but checked.
- [x] Error paths: getPublicKey/signEvent rejections → `SIGNER_DECLINED`; server `!authorized`/`!success` → `NOT_AUTHORIZED`; everything else → `UNKNOWN`. Re-throw contract preserved at all five callers (verified each).
- [x] Race: `waitForNostr` resolves once and clears its interval on both paths; the synchronous fast-path avoids a needless tick. No leak.
- [x] Security: no new input boundaries; server message shown for `NOT_AUTHORIZED` is instance-controlled copy (acceptable).

## House rules check

- [x] Concept Graph authority respected (orientation performed; nothing to re-read from BIBLE).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **`AuthContext.jsx:78-82`** — the `SIGNER_DECLINED` catch swallows *any* error from `getPublicKey()`/`signEvent()`, not only user-declines (e.g. an extension internal error would also read as "cancelled"). Acceptable per the ADR's coarse categorization; could be refined later if signers surface distinguishable errors.
2. **`LoginErrorModal.jsx`** — no Escape-to-close or focus trap; closes on backdrop click + the "Got it" button (which is `autoFocus`ed). The ADR didn't require a trap; fine for an alert dialog. Optional a11y polish.
3. **`BrainstormUserMenu.jsx:75`, `BrainstormSearch.jsx:497`** — the logged-out sign-in buttons aren't disabled during an in-flight `login()`, so a double-click can start two flows. Pre-existing behavior (unchanged by this diff); the dashboard `Header` does guard via `loggingIn`. Out of scope; note only.
4. **Playwright** — the companion spec is unverified in this environment. Recommend running it on staging as part of the deploy smoke test.

## Verdict

**PASS**

The implementation matches ADR 0021 criterion-for-criterion, the two correctness gaps the Architect flagged in the prior informal pass (the `window.nostr` injection race and raw-message leakage) are both resolved, the test suite is green, the build is clean, and no blocking issues were found. Non-blocking items are optional polish or pre-existing, out-of-scope behavior.
