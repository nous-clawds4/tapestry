# Test Plan: Story verified-reporters #1 — Verified Reporters count on the profile

**Story:** `engineering-team/stories/verified-reporters/1-verified-reporters-count.md`
**ADR:** `engineering-team/decisions/verified-reporters/0001-verified-reporters-count.md`
**Date:** 2026-06-07

## Approach
Two tiers, matching the Verified Followers precedent (story #33 / ADR 0029):

1. **Deterministic source-regex node suite** — `test/profile-verified-reporters-count.test.js`, run by `npm test`. No stack, no build, no live data. These are the **pre-implementation failing tests**: T1–T8 fail now and pass once the counter is built; R1–R3 are regression sentinels that pass before *and* after.
2. **Supplementary Playwright spec** — `tests/brainstorm/profile-verified-reporters-count.spec.js`. Browser-level behavior (the 0/unavailable states are not anchors; the sibling links survive). **Live-data dependent and NOT run pre-implementation** — exercised at the staging smoke after deploy. The `> 0` link (href, `--red`, aria-label) and PoV are documented manual/fixture checks, mirroring how the VF spec left PoV manual.

Why source-regex for the deterministic tier: the change is a single-file React/JSX edit and the repo has no React render harness; this matches the `profile-verified-followers-count` / `profile-follows-list` precedents. The **false-positive trap** (the file already contains `verifiedReporterCount` and `Reporters` in `TRUST_METRICS`) is handled by targeting the *new bsp-counts-block counter* specifically — see each sentinel's message.

## Coverage map
| Criterion | Test(s) | File | Level |
|---|---|---|---|
| AC1 — "Verified Reporters" count in the counts row, parallel, effective PoV | `T1` (3rd `bsp-count-label` + "Verified Reporters"), `T2` (`trustScores?.verifiedReporterCount`) ; `P1` (visible beside siblings) | node suite ; Playwright | source-regex ; e2e |
| AC2 — `>0` → negative signal + link to `/reporters` | `T3` (link + 3rd `bsp-count-link`), `T4` (`bsp-count-value-negative` + `--red`) ; `>0` manual check | node suite ; Playwright | source-regex ; e2e/manual |
| AC3 — `0` → neutral, NOT a link | `T5` (numeric-zero branch) ; `P2` (0-account → no `verified reporters` link) | node suite ; Playwright | source-regex ; e2e |
| AC4 — unavailable → `—`, not a link, distinct from 0 | `T6` (3rd `fmtCount`, null→`—`) ; `P2` (covers the no-link case) | node suite ; Playwright | source-regex ; e2e |
| AC5 — loading → dimmed placeholder, no bare spinner | `T7` (`bsp-count-loading` + `opacity`) | node suite | source-regex |
| AC6 — accessible name states number + opens list | `T8` (`{n} verified reporters. View list.`) ; `>0` manual check | node suite ; Playwright | source-regex ; manual |
| Regression — Following unchanged | `R1` | node suite | source-regex |
| Regression — Verified Followers unchanged | `R2` ; `P2` (sibling links survive) | node suite ; Playwright | source-regex ; e2e |
| Regression — Reporters trust card retained (ADR deliberate non-change) | `R3` | node suite | source-regex |

## Edge cases
- [x] Zero vs unavailable distinguished — `0` (neutral, no link) vs `—` (no scores). `T5`/`T6` + `P2`.
- [x] Loading state is a dimmed placeholder, not a spinner — `T7`.
- [x] False positive from the existing `TRUST_METRICS` Reporters card — every sentinel targets the new counter; `R3` guards the card stays.
- [x] Link target `/reporters` does not 404-regress the page — the link is inert markup until story #3 builds the route (out of scope here; noted in the story).
- [ ] `>0` red color + aria-label in the browser — fixture-dependent; documented manual check in the spec.
- [ ] PoV (`?pov=`) reflected in the number — fixture-dependent; documented manual check in the spec.

## Test infrastructure
- Framework: Node built-in runner (`node test/test.js`) for the deterministic suite; Playwright (`npm run test:playwright`) for the supplementary spec.
- Wiring: `test/profile-verified-reporters-count.test.js` is registered in `test/test.js` (require + run + results line + `overallOk`).
- Concept Graph API: not required (no concept/graph change in this story).
- Live stack: only the Playwright spec needs a running instance with the UI **built** (`npm run build` in `ui/`) and House-PoV WoT scores indexed in Meilisearch. Base URL `BRAINSTORM_BASE_URL` or `http://localhost:7778`.
- Fixtures: Playwright uses Jack Dorsey (`82341f88…be6a2`) as a scores-loaded, 0-verified-reporters account for the not-a-link case. A `>0` account is needed at smoke time for the link/red/aria-label check.

## How to run
```
npm test                       # deterministic node suites (incl. this one)
npm run test:playwright        # supplementary browser spec (needs a built, running instance)
```

## Verification
The new node suite fails with the current code (T1–T8 fail — one per acceptance criterion; R1–R3 pass — existing behavior intact). Confirmed via `npm test` on 2026-06-07:

```
profile-verified-reporters-count suite:
  ✗ T1: BrainstormProfile.jsx renders a "Verified Reporters" count in the bsp-counts block (AC1)
  ✗ T2: the new counter sources its value from trustScores.verifiedReporterCount (PoV-resolved) (AC1)
  ✗ T3: the counter links to /user/${pubkey}/reporters (AC2)
  ✗ T4: the >0 value uses a negative-signal modifier backed by the --red token (AC2)
  ✗ T5: the counter branches on the count so 0 is rendered neutrally, not as a link (AC3)
  ✗ T6: the new counter formats its value via the existing fmtCount helper (AC4 placeholder, AC6 number)
  ✗ T7: a per-count loading dim exists for the reporters counter (AC5)
  ✗ T8: the >0 link carries the canonical accessible name "{n} verified reporters. View list." (AC6)
  ✓ R1: the existing "Following" count is unchanged — useUserCounts + <Link> to /follows (regression)
  ✓ R2: the existing "Verified Followers" count is unchanged — <Link> to /followers (regression)
  ✓ R3: the existing Reporters trust card is retained in TRUST_METRICS (ADR 0001 deliberate non-change)

profile-verified-reporters-count suite:          FAIL (3 passed, 8 failed)
```

Each `✗` fails because the feature is unimplemented (the targeted markup/strings are absent), not from a typo or import error — verified by reading the failure messages. All other suites remain PASS (the runner wiring did not regress them).
