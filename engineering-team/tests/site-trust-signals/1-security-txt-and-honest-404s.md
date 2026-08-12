# Test Plan: Story 1 — security.txt, robots.txt, and honest 404s

**Story:** `engineering-team/stories/site-trust-signals/1-security-txt-and-honest-404s.md`
**ADR:** `engineering-team/decisions/site-trust-signals/0036-security-txt-and-honest-404s.md`
**Date:** 2026-08-11

## Coverage map

All tests live in `test/site-trust-signals.test.js`.

| Criterion | Test | Level |
|---|---|---|
| AC-1 — security.txt served as `text/plain; charset=utf-8` | `H1` | integration (live HTTP) |
| AC-2 — `Canonical` names the requesting host | `U4` | unit |
| AC-2 — `Canonical` omitted, not guessed, when unconfigured | `U5` | unit |
| AC-3 — exactly one future `Expires`, ≥1 `Contact` | `U1`, `U2`, `U3`, `H2` | unit + integration |
| AC-4 — full-estate ownership attestation | `U6` | unit |
| AC-5 — production robots.txt permits crawling | `U8`, `H3` | unit + integration |
| AC-6 — non-production robots.txt is `Disallow: /` | `U7` | unit |
| AC-7 — probe paths return 404 | `U9`, `H4` | unit + integration |
| AC-8 — unhandled `/.well-known/*` returns 404 | `U11`, `H5` | unit + integration |
| AC-9 — every SPA route still resolves | `U10`, `H6` | unit + integration |
| AC-10 — `/api/` routes unchanged | `H7` | integration |
| AC-11 — `SECURITY.md` exists | `S3` | structural |

Structural sentinels beyond the ACs: `S1` (both routes registered — guards the
`express.static` dotfile trap), `S2` (deny rule positioned after static and before the catch-all —
the ADR calls this placement load-bearing), `S4` (no per-deployment hostname hardcoded — CLAUDE.md
house rule).

## Edge cases

- [x] **Route params containing dots** — `/pin/my.pinned.tag`, `/tag/some.slug/abc123`. `U10`. The
      deny rule must key off an explicit extension list, never a blanket "contains a dot" test, or it
      404s user-authored d-tags.
- [x] **Real static assets** — `/brainstorm.svg` must still be served. `H8`. This is what fails if
      the deny rule is registered before `express.static` instead of after.
- [x] **`domain` unset, empty, or `localhost`** — `U5`. Local dev and fresh forks must produce a
      valid document, not one with a wrong `Canonical`.
- [x] **`buildRobotsTxt()` called with no argument** — `U7` covers `{}` and `undefined` alongside
      `{allowIndexing:false}`, so a missing config value fails closed rather than exposing a sandbox.
- [x] **`Expires` more than a year out** — `U3`. RFC 9116 caps it; an over-long value is as invalid
      as an expired one.
- [ ] **Not covered: extensionless unmatched paths** (`/foobar`). Deliberate — ADR 0036 accepts these
      continuing to return the SPA shell. If that decision is revisited, this row becomes a test.
- [ ] **Not covered: the live droplets.** These tests exercise `localhost:7778`. Per-host
      verification across the six deployments is a deploy-time smoke step, not a suite.

## Test infrastructure

- Framework: Node built-in runner via `node test/test.js`. Suite registered in `test/test.js`
  (require, `run()` call, `overallOk` chain, and the `totalSkipped` aggregate).
- Base URL: `process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778'`.
- H-class tests SKIP cleanly when the control panel is unreachable, so CI's stack-free job is unaffected.
- No firmware precondition — this story touches no concepts.
- No fixtures.

## How to run

```
node test/site-trust-signals.test.js
```

Full suite:

```
npm test
```

## Verification

The new tests fail with the current code. Confirmed 2026-08-11 on branch `staging`:

```
site-trust-signals: 3 passed, 20 failed, 0 skipped
```

The 20 failures are every U-class test (`src/utils/siteTrust.js` does not exist), every S-class test
(routes unregistered, `SECURITY.md` absent), and `H1`–`H5` (the live instance serves
`text/html` for both documents and returns 200 for all nine probe paths).

The 3 passes are `H6`, `H7`, and `H8` — the **regression guards**. They pass today because SPA
routing, the API, and static assets currently work; they must *still* pass after implementation.
A suite where these three flip to FAIL means the deny rule is mispositioned or too broad.

Representative failure output:

```
FAIL  U10 isBlockedProbePath NEVER flags an SPA route, including dotted params
      FEATURE MISSING: src/utils/siteTrust.js does not exist yet.
FAIL  H4 probe paths return a genuine 404
      every probe path must 404; these did not: /.env → 200, /wp-login.php → 200,
      /config.json → 200, /backup.sql → 200, /database.bak → 200, /settings.ini → 200,
      /docker-compose.yml → 200, /sitemap.xml → 200, /index.asp → 200.
```
