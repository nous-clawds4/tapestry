# Test Plan: Story 1 — Serve llms.txt on the fleet

**Story:** `engineering-team/stories/llms-txt/1-serve-llms-txt-on-the-fleet.md`
**ADR:** `engineering-team/decisions/llms-txt/0001-serve-llms-txt-on-the-fleet.md`
**Date:** 2026-09-22

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (200, `text/plain; charset=utf-8`) | `H1 GET /llms.txt returns 200 as text/plain, matching buildLlmsTxt()` | `test/llms-txt.test.js` | live HTTP |
| AC-2 (llmstxt.org format order) | `U1 buildLlmsTxt follows the llmstxt.org format: H1, then blockquote, then ## sections` | `test/llms-txt.test.js` | unit |
| AC-3 (exact 12-link inventory per section) | `U3 …"## Protocols/Tapestry/Optional" section links exactly the required 4 documents` (×3), `U4 …sections appear in the required order`, `U5 …names no link outside the required 12` | `test/llms-txt.test.js` | unit |
| AC-4 (blockquote/notes required facts) | `U2 buildLlmsTxt carries the three required facts in its blockquote/notes` | `test/llms-txt.test.js` | unit |
| AC-5 (production robots.txt unchanged) | `U6 buildRobotsTxt({allowIndexing:true}) is unchanged from site-trust-signals` | `test/llms-txt.test.js` | unit |
| AC-6 (non-production robots.txt exempts /llms.txt) | `U7 buildRobotsTxt exempts /llms.txt…ahead of the blanket disallow`, `H2 GET /robots.txt on this instance shows the /llms.txt exemption live` | `test/llms-txt.test.js` | unit + live HTTP |
| AC-7 (every link resolves; ongoing check placed in the renewal ritual) | `L1 link resolves with 2xx: <url>` (×12) | `test/llms-txt.test.js` | live network (per-link SKIP on unreachability, not on stack absence) |
| AC-8 (no regression to honest-404s/SPA-passthrough) | `H3 a small representative regression sweep…` (this file) + the full existing `test/site-trust-signals.test.js` suite (PROBE_PATHS/SPA_PATHS/static-asset/`/api/` coverage), unmodified and still in the gate | `test/llms-txt.test.js` + `test/site-trust-signals.test.js` | live HTTP |

Two supporting tests beyond the AC map, both load-bearing:

- `S1 control-panel registers the /llms.txt route` — structural precondition for AC-1/AC-8.
- `S2 the /llms.txt route is registered BEFORE the honest-404 deny-rule middleware` — **the single most important test in this file.** The ADR found, by calling `isBlockedProbePath('/llms.txt')` directly, that `.txt` is in `BLOCKED_EXTENSIONS` — exactly like `/robots.txt` today. Get the registration order wrong and every U-class test still passes while the live route 404s itself. No story AC names this directly (it's an ADR-level implementation constraint), but AC-1 cannot hold in practice without it.

## Edge cases

- [x] `buildRobotsTxt` called with `{}` or `undefined` (not just `{allowIndexing:false}`) still gets the exemption — covered by `U7`'s loop over all three falsy forms, mirroring `test/site-trust-signals.test.js`'s `U7`.
- [x] A static `llms.txt` file accidentally placed under `ui/public/` or `public/`, which would shadow the route and silently serve stale content — `S3 no static llms.txt file shadows the route` (ADR Guardrail).
- [x] The served route body might drift from the tested unit's output (e.g., a hand-copied duplicate string in `control-panel.js` instead of calling `buildLlmsTxt()`) — `H1` asserts byte-equality between the two.
- [x] A link-resolution check running in an environment with no outbound network must not false-fail the whole suite — `L1`'s `fetchForLinkCheck` SKIPs on a network-level failure (timeout/DNS/connection error) and only FAILs on an actual non-2xx response.
- [ ] Not covered here, out of scope per the story: verifying all four *fleet hosts* individually. Like `site-trust-signals`'s own `H`-class tests, this suite's live tier only exercises `BASE` (`:7778` locally); cross-host verification happens at deploy-time smoke test, per repo convention.

## Test infrastructure

- Test framework: Node's built-in runner (`node test/llms-txt.test.js` standalone, or `npm test` for the full gate via `test/registry.js`).
- Concept Graph API: not applicable — this story touches no concepts (confirmed at Architecture).
- Live control-panel API: `localhost:7778` (`BRAINSTORM_BASE_URL` override respected, matching `test/site-trust-signals.test.js`). H-class tests `SKIP` individually when the stack doesn't answer.
- Outbound network (github.com raw content, `api.brainstorm.world`): L-class tests `SKIP` per-link on a network-level failure rather than gating the whole suite.
- Firmware state: none required.
- Fixtures: none. `REQUIRED_LINKS` in the test file is spec data (the story's AC-3 list), independent of `src/utils/siteTrust.js`'s implementation — mirrors how the sibling suite's `ESTATE_HOSTS` and `PROBE_PATHS` are kept independent of the code under test.

## Renewal ritual — OPEN.md row 172

Story AC-7 asks the ongoing link-resolution check to be placed in the same renewal ritual that owns `security.txt`'s `Expires` field (OPEN.md row 172). Done as part of this phase: row 172's text now also names `llms.txt`'s 12 links, so the next `Expires` refresh re-verifies both in the same pass. `L1` is the automated complement — it runs on every `npm test`, not only at the yearly renewal, and SKIPs (rather than false-failing) when the environment has no outbound network.

## How to run

```
node test/llms-txt.test.js
```

Or as part of the full gate:
```
npm test
```

## Verification

The new tests fail with the current code (feature not yet implemented). Confirmed 2026-09-22 at commit `30c6f4ad` (pre-implementation), running the file directly:

```
--- llms.txt on the fleet (epic llms-txt, Story 1) ---
  FAIL  U1 buildLlmsTxt follows the llmstxt.org format: H1, then blockquote, then ## sections
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  U2 buildLlmsTxt carries the three required facts in its blockquote/notes
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  U3 buildLlmsTxt's "## Protocols" section links exactly the required 4 documents
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  U3 buildLlmsTxt's "## Tapestry" section links exactly the required 4 documents
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  U3 buildLlmsTxt's "## Optional" section links exactly the required 4 documents
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  U4 buildLlmsTxt sections appear in the required order: Protocols, Tapestry, Optional
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  U5 buildLlmsTxt names no link outside the required 12 (content stays a pointer manifest)
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  U6 buildRobotsTxt({allowIndexing:true}) is unchanged from site-trust-signals
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  U7 buildRobotsTxt exempts /llms.txt on non-production hosts, ahead of the blanket disallow
        FEATURE MISSING: src/utils/siteTrust.js does not export buildLlmsTxt yet.
  FAIL  S1 control-panel registers the /llms.txt route
        bin/control-panel.js must register GET /llms.txt.
  FAIL  S2 the /llms.txt route is registered BEFORE the honest-404 deny-rule middleware
        bin/control-panel.js must register a GET handler for /llms.txt.
  PASS  S3 no static llms.txt file shadows the route
  FAIL  H1 GET /llms.txt returns 200 as text/plain, matching buildLlmsTxt()
        expected 200; got 404.
  FAIL  H2 GET /robots.txt on this instance shows the /llms.txt exemption live
        this instance is non-indexing; its live robots.txt must exempt /llms.txt ahead of the disallow. Got:
User-agent: *
Disallow: /

  PASS  H3 a small representative regression sweep: probe and SPA paths still behave (AC-8)
  PASS  L1 link resolves with 2xx: (all 12 links — pre-existing external documents, independent of this story's code)

llms-txt: 14 passed, 13 failed, 0 skipped
```

**Why 14 pass already:** `S3` and `H3` are negative-space / regression guards that are correctly true before any of this story's code exists — they only go red if Implementation gets something wrong, which is their job. All 12 `L1` tests check pre-existing external documents directly (not through `llms.txt`), so they pass regardless of this story's implementation state; they independently confirm story AC-7 right now, at Test Design time, not only "at ship time" as the story required.

**Why the rest fail correctly:** every `U`-class test hits `loadSiteTrust()`'s guard (`buildLlmsTxt` doesn't exist) — a clear, named failure, not an import crash. `S1`/`S2` correctly report the route isn't registered. `H1`/`H2` hit the live (stack-present) control panel and get the actual current-state responses (404; unexempted `robots.txt`), not a skip — confirming these tests really do exercise the running server.

Local live stack was present for this run (`BASE=http://localhost:7778` answered). CI's `stack-free` job will `SKIP` all `H`-class tests instead.
