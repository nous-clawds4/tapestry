# Test Plan: Story 30 — Profile "Website" link broken for scheme-less URLs

**Story:** `engineering-team/stories/30-profile-website-link-scheme.md`
**ADR:** none (Architecture skipped — obvious bug)
**Date:** 2026-05-29

## Fix contract (set here, since there's no ADR)
The two clickable-link views need identical normalization, so the cleanly-testable form is a **pure helper**:

- `ui/src/utils/url.js` (joining the existing `ui/src/utils/*` convention) exports **`toExternalUrl(value)`** that:
  - prepends `https://` when `value` has no `http(s)://` scheme,
  - leaves already-absolute `http(s)` URLs unchanged (scheme detection case-insensitive),
  - returns a **falsy** value for empty input.
- The module must stay **pure** (no React/DOM imports) so the node unit test can `import()` it (`ui/` is `type: module`).
- `BrainstormProfile.jsx` and `users/UserDetail.jsx` build the website `href` via `toExternalUrl(profile.website)`; the displayed text is unchanged.

If the Implementer prefers a different structure, kick back — but the unit test pins this contract.

## Coverage map

| Acceptance criterion | Test(s) | Level |
|---|---|---|
| Scheme-less website → absolute external URL (not a relative path) | `T1` (helper logic) + `T2`/`T3` (both views use it) + PW spec | unit + source + e2e |
| Already-absolute website → unchanged | `T1` (https/http/cased cases) | unit |
| New tab + `rel="noopener noreferrer"` (both views) | `R1` | source (sentinel) |
| Primary-profile display still scheme-stripped | `R2` | source (sentinel) |
| No website → no link | structurally preserved (the `{profile?.website && …}` guard is untouched by the fix); `T1` also pins empty→falsy | — |

Node suite: `test/profile-website-link.test.js` (wired into `test/test.js`).
Playwright: `tests/brainstorm/profile-website-link.spec.js` (supplementary, live-data dependent).

## Edge cases (in `T1`)
- [x] `www.`-prefixed bare host → `https://www.…`
- [x] path + query preserved (`example.com/path?q=1` → `https://example.com/path?q=1`)
- [x] `http://…` left unchanged (don't force https on an explicit scheme)
- [x] case-insensitive scheme detection (`HTTPS://…` unchanged, not double-prefixed)
- [x] empty string → falsy (no link)

## Regression sentinels (must pass before AND after)
- `R1` — both views keep `target="_blank"` + `rel="noopener noreferrer"` on the website link.
- `R2` — `BrainstormProfile.jsx` keeps `profile.website.replace(/^https?:…/)` for the **display** text (the fix changes the href, not the display).

## Test infrastructure
- **Node runner:** `npm test` (entry `test/test.js`) now includes the `profile-website-link` suite. The unit test (`T1`) dynamic-`import()`s the ESM helper — works because `ui/package.json` is `type: module` and the helper is pure. Standalone:
  ```
  node -e "require('./test/profile-website-link.test.js').run().then(r=>{console.log(r);process.exit(0)})"
  ```
- **Playwright:** `tests/brainstorm/profile-website-link.spec.js` — navigates to a real profile with a scheme-less website (`/user/a366c6a7…041044`, website `kate-cate.com`) and asserts the link `href` is absolute. **Fragility:** depends on that account keeping a scheme-less website (live data); it's supplementary to the deterministic unit test. Exercised at the staging smoke (`baseURL` defaults to `:7778`; override with `BRAINSTORM_BASE_URL`).
- No Concept Graph dependency (UI-only; no concept/firmware change).

## How to run
```
npm test                 # node suites (includes profile-website-link)
npm run test:playwright  # browser/e2e (needs a deployed instance with a scheme-less-website profile)
```

## Verification
Node suite confirmed **failing for the right reason** on 2026-05-29 (pre-implementation):

```
✗ T1 — ui/src/utils/url.js does not exist … create a PURE module exporting toExternalUrl
✗ T2 — BrainstormProfile.jsx must not pass raw profile.website to href
✗ T3 — UserDetail.jsx must not pass raw profile.website to href
✓ R1 — both views keep target=_blank + rel=noopener noreferrer
✓ R2 — BrainstormProfile.jsx still scheme-strips the displayed website text

RESULT: 2 passed, 3 failed
```

Playwright spec: not run pre-implementation (it tests deployed state; current staging/prod still has the bug). It will be exercised against staging after the fix deploys.
