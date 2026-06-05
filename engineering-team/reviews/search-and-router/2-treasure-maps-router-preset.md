# Review: Story 2 — `treasureMaps` router preset + 10040 to Negentropy Sync

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-13
**Diff:** `git diff origin/staging..HEAD` — 5 commits (`80df36d9`, `c3e347b4`, `1e108e6b`, `9df34029`, `eb243bbd`)
**Story:** `engineering-team/stories/2-treasure-maps-router-preset.md`
**ADR:** `engineering-team/decisions/0002-treasure-maps-router-preset.md` (Option D after Phase 3 revision)
**Test plan:** `engineering-team/stories/2-treasure-maps-router-preset.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- **`npm test`** — **PASS** (6 tests: 1 config-loading + 5 story-#2). Output:
  ```
  treasure-maps-router-preset suite:
    ✓ treasureMaps preset exists in setup/router-presets.json with correct shape
    ✓ generateConfig with treasureMaps enabled emits a bidirectional kind-10040 stream block
    ✓ generateConfig with treasureMaps disabled omits its stream block
    ✓ RelaySettings.jsx KIND_PRESETS contains the Treasure Maps (10040) option
    ✓ BIBLE.md or docs/CONFIGURATION.md documents the router preset system and the planned Negentropy preset system
  Overall: PASS
  ```
- **`npm run test:playwright`** — *Not run*. The Playwright spec at `tests/brainstorm/treasure-maps-router-preset.spec.js` requires a deployed instance; per the test plan it's exercised against staging after the implementation lands. Will be run during the staging smoke-test phase.
- _Lint not configured — skipped._
- _Typecheck not configured — skipped._
- _Build not configured — skipped._

## Spec adherence

| AC | Coverage | Status |
|---|---|---|
| AC-1 — preset visible in Presets popup | `treasureMaps preset exists in router-presets.json with correct shape` + Playwright `Router tab Presets popup lists treasureMaps` | ✓ |
| AC-2 — defaultEnabled: false | covered by AC-1 file-parse assertion | ✓ |
| AC-3 — enable → daemon streams 10040 bidirectionally | `generateConfig with treasureMaps enabled emits a bidirectional kind-10040 stream block` | ✓ |
| AC-4 — relays are damus / nos.lol / primal | covered by AC-1 url-array assertion | ✓ |
| AC-5 — disable → stream block absent | `generateConfig with treasureMaps disabled omits its stream block` | ✓ |
| AC-6 — state persists across container restart | Not covered by a new test (documented in test plan §"Not covered"); relies on the preexisting `/var/lib/brainstorm/` Docker volume mechanism that every other preset already uses in production | ✓ (acceptable per test plan) |
| AC-7 — Negentropy Event Kinds includes 10040 | `RelaySettings.jsx KIND_PRESETS contains the Treasure Maps (10040) option` + Playwright | ✓ |
| AC-8 — docs updated | `BIBLE.md or docs/CONFIGURATION.md documents the router preset system and the planned Negentropy preset system` | ✓ |

No criterion silently dropped; no behavior added that isn't in the story.

## ADR adherence

- Files changed match ADR Implementation notes exactly: `setup/router-presets.json`, `src/api/strfry/routerConfig.js` (the `generateConfig` export was a Tester-driven addition documented in the test plan; it's a one-line module-exports change with no behavior impact), `ui/src/pages/settings/RelaySettings.jsx`, `docs/CONFIGURATION.md`.
- No `ensureState()` change — correctly absent per the Option D revision recorded in the ADR's Revision history section.
- No new dependencies. No neighboring refactor.
- KIND_PRESETS entry placed after Profiles per ADR ("Profiles and Treasure Maps are both per-user signal events, so they belong adjacent").

## Concept-graph integrity

Not applicable — no concept definitions touched, no firmware files modified, no graph schemas changed. ADR explicitly stated "No firmware reinstall required."

## Things tests can't catch

- **Secrets / credentials:** None added. ✓
- **Debug logging:** None introduced. ✓
- **Commented-out code:** None. ✓
- **Leftover TODOs:** None. ✓
- **Relay URLs sanity-checked:** `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net` — all three are well-known public relays referenced elsewhere in the codebase (e.g. `docs/CONFIGURATION.md:77`, `setup/router-presets.json:21`); no typos. ✓
- **`generateConfig` export:** the new export is a 1-line addition to `module.exports`. Function is a pure transformation of an input array to a string; exposing it doesn't widen the API surface in any concerning way. ✓
- **JSON validity:** trailing-comma / structure clean; verified by `JSON.parse` in the test, which would have failed otherwise. ✓
- **Forward link in CONFIGURATION.md → engineering-team/stories/3-...:** relative path is correct (`../engineering-team/stories/3-router-presets-auto-appear-in-streams.md` from `docs/`); target file exists. ✓

## House rules check

- No new lint / typecheck / build tooling added. ✓
- Concept Graph API authority — not applicable to this change.
- Firmware reinstall — not applicable.

## Findings

### Blocking
None.

### Non-blocking
1. **`docs/CONFIGURATION.md:152`** — The "Negentropy preset system (future work)" paragraph has slightly awkward sentence structure. The inline link to story #3 sits inside a parenthetical alongside the mention of *a separate (yet-to-be-filed) story* for the Negentropy preset system itself — which can read as if story #3 is about the Negentropy work when it actually tracks a different (router-preset auto-appear) UX improvement. The content is technically accurate and the test gate doesn't fail on it; flagged here purely as a wording polish opportunity for a future doc pass. Suggested phrasing: pull the story-#3 reference out of the Negentropy paragraph entirely (it belongs near the "Adding a new preset" section as a related improvement note), and let the Negentropy paragraph stand on its own as a clean forward-looking statement. Not blocking — the test plan's spec for AC-8 is met as-is.

## Verdict

**PASS**

Five-phase flow executed cleanly: PO story → ADR (with mid-flow descope to Option D when the Tester noticed a spec/scope mismatch — exactly the value the gates are designed to surface) → failing tests proven correct → minimal implementation (38 LOC across 4 files) → test gate green. Diff is mergeable as-is. Recommended next step: open a PR from `feat/treasureMaps-router-preset` → `staging`, follow the standard `cycle-staging` → `cycle-prod` promotion path documented in [OPERATIONS.md §1](../../OPERATIONS.md).
