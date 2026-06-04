# Review: Story 30 — Profile "Website" link broken for scheme-less URLs

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-29
**Diff:** `git diff origin/staging..HEAD` (impl commit `8ff9c14a`), branch `fix/profile-website-href`
**ADR:** none (Architecture skipped — obvious bug)

## Quality gates (run by reviewer)
- [x] **`test/profile-website-link.test.js` — 5/5** (T1 unit + T2/T3 wiring + R1/R2 sentinels).
- [x] **`test/profile-follows-list.test.js` — 27/27** (story-#29 suite; no regression from the `BrainstormProfile.jsx` edit).
- [x] **`npm --prefix ui run build` — clean** (~18s).
- [n/a] lint/typecheck/server build — not configured.

## Spec adherence
- [x] **Scheme-less → external.** `href={toExternalUrl(profile.website)}` in both clickable-link views; a bare `kate-cate.com` now yields `https://kate-cate.com` (absolute), not a relative `/user/...` path.
- [x] **Already-absolute unchanged** (`/^https?:\/\//i` guard); **empty → '' → no link**; **www / path / query preserved**; **case-insensitive scheme**. All pinned by the T1 unit test.
- [x] **New tab + safe rel** preserved on both links (R1). **Primary-profile display** still scheme-stripped (R2). Diff confirms the display/`target`/`rel` lines are untouched.
- [x] No behavior added beyond the story.

## Design / scope
- [x] No ADR needed; the helper lives in `ui/src/utils/url.js`, matching the existing `ui/src/utils/*` convention (named export, like `dtag.js`/`nodeName.js`).
- [x] **Pure helper** — no React/DOM imports, so it's genuinely unit-tested from node (the T1 dynamic `import()` works because `ui/` is `type: module`).
- [x] **No scope creep:** only `url.js` + the two views (+ tests/story/plan). The non-clickable search-card spans (`BrainstormSearch.jsx`, `users/Search.jsx`) were correctly left alone. `UserDetail.jsx`'s raw display text was intentionally not touched (out of scope, noted in the story).

## Things tests can't catch
- [x] No secrets / debug / commented-out code. Helper is 3 lines, readable, well-documented.
- [x] Security: `rel="noopener noreferrer"` retained on both `target="_blank"` links — no reverse-tabnabbing regression. The helper only prepends a scheme; it does not introduce `javascript:`/`data:` execution (those would already lack `http(s)://` and get `https://` prepended → inert).

## Findings

### Blocking
_None._

### Non-blocking (optional hardening, not gating — both out of the story's stated scope)
1. **`ui/src/utils/url.js`** — a **protocol-relative** input (`//example.com`) becomes `https:////example.com` (extra slashes). Extremely rare in kind-0 `website` fields; the story scoped to http(s) values. Optional: also treat a leading `//` as already-absolute (`https:` + value).
2. **`ui/src/utils/url.js`** — no whitespace trim; `' kate-cate.com '` would become `'https:// kate-cate.com '`. Sloppy-input edge; optional `.trim()` hardening. Neither is worth blocking the fix.

## Verdict
**PASS** — minimal, correct fix of the confirmed root cause across both affected views; pure, well-tested helper; safe-rel + display preserved; no scope creep or regression; gates green. The deterministic unit test covers the logic; the supplementary Playwright spec gives real-browser proof at the staging smoke (live-data dependent). Ship to staging, re-verify the kate-cate link, then promote.
