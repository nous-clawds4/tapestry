# Test Plan: Story 2 — `treasureMaps` router preset + 10040 to Negentropy Sync

**Story:** `engineering-team/stories/2-treasure-maps-router-preset.md`
**ADR:** `engineering-team/decisions/0002-treasure-maps-router-preset.md` (revised — Option D chosen)
**Date:** 2026-05-13

## Coverage map

Every acceptance criterion maps to at least one automated test. The Option D scope means there's no `ensureState` behavioral change to test — the surface area is preset shape, generated-config output, UI radio option, and docs presence.

| Criterion | Test name | File | Level |
|---|---|---|---|
| AC-1 (preset visible in Presets popup) | `treasureMaps preset exists in router-presets.json with correct shape` | `test/treasure-maps-router-preset.test.js` | unit (file parse) |
| AC-1 (Playwright UI confirmation) | `Router tab Presets popup lists treasureMaps` | `tests/brainstorm/treasure-maps-router-preset.spec.js` | Playwright |
| AC-2 (defaultEnabled: false) | covered by AC-1 file-parse assertion (`defaultEnabled === false`) | same | unit |
| AC-3 (enable → daemon streams 10040 bidirectionally) | `generateConfig with treasureMaps enabled emits a bidirectional kind-10040 stream block` | `test/treasure-maps-router-preset.test.js` | unit (pure function) |
| AC-4 (relays = damus, nos.lol, primal) | covered by AC-1 file-parse assertion (urls array) | same | unit |
| AC-5 (disable → stream block absent) | `generateConfig with treasureMaps disabled omits its stream block` | `test/treasure-maps-router-preset.test.js` | unit (pure function) |
| AC-6 (state persists across container restart) | NOT covered by a new test — relies on existing `/var/lib/brainstorm/router-state.json` persistence on the `tapestry-data` Docker volume, which is exercised by every other preset already in production. Test plan documents this rather than adding a synthetic test that mocks the volume. | (n/a) | (existing infrastructure) |
| AC-7 (Negentropy Event Kinds picker has 10040) | `RelaySettings.jsx KIND_PRESETS contains the Treasure Maps (10040) option` | `test/treasure-maps-router-preset.test.js` | unit (source regex) |
| AC-7 (Playwright UI confirmation) | `Negentropy Sync tab Event Kinds picker offers Treasure Maps (10040)` | `tests/brainstorm/treasure-maps-router-preset.spec.js` | Playwright |
| AC-8 (docs updated) | `BIBLE.md or docs/CONFIGURATION.md documents the router preset system and notes the planned Negentropy preset system` | `test/treasure-maps-router-preset.test.js` | unit (file grep) |

## Edge cases

- [x] **Direction is exactly `"both"`** — AC-3 test asserts the string `dir = "both"`, not just that some `dir` key is present.
- [x] **All three URLs present** — AC-1 test iterates the expected list and asserts each is in `urls`.
- [x] **Disabled state respected at config-gen time** — separate AC-5 test confirms the same data with `enabled: false` does NOT appear in the generated config.
- [x] **`generateConfig` is reachable for unit testing** — the AC-3 test asserts `typeof generateConfig === 'function'` first, so the failure mode is a clear "must be exported from routerConfig" rather than a TypeError on an undefined function. The Implementer will need to add the export as part of satisfying these tests; that change is in-scope per ADR Option D's "smallest possible code change" goal (one-line export tweak).

## Not covered

- **AC-6 cross-container-restart persistence.** Out of scope for an automated test — would require spinning up two container generations and comparing state file. The mechanism is preexisting; relies on the `tapestry-data` Docker named volume mounting `/var/lib/brainstorm/`. Verified by manual smoke-test step after deploy: enable the preset on staging, redeploy, confirm it's still enabled.
- **Live bidirectional streaming with real relays.** Out of scope for unit tests — requires real WebSocket connections to the three relays plus a published 10040 event to observe. Verified manually post-deploy by enabling the preset and checking that local strfry receives kind 10040 events: `docker compose exec tapestry strfry scan --count '{"kinds":[10040]}'` before and after a short wait.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`node test/test.js`). Playwright for browser flows.
- **No new dependencies.** The unit tests use only `fs`, `path`, and `require()`.
- **Playwright preconditions:** A reachable Brainstorm instance. Defaults to local docker stack at `http://localhost:8080`; override via `BRAINSTORM_BASE_URL` to target staging. Auth on `/tapestry/settings/relays` may be required — Playwright tests check for the *presence* of the preset row and the Event Kinds radio option, which should be visible even if interactions require sign-in.
- **`generateConfig` export:** The unit test for AC-3/AC-5 requires `generateConfig` to be exported from `src/api/strfry/routerConfig.js`. Currently it's a module-private helper. The Implementer adds the export to satisfy the test.

## How to run

Unit tests via the existing entry:
```
npm test
```

Playwright tests against local stack on `:8080`:
```
npm run test:playwright
```

Playwright tests against staging:
```
BRAINSTORM_BASE_URL=https://staging.brainstorm.world npm run test:playwright
```

## Verification

Confirmed failing on the pre-implementation tree at commit `1e108e6b` (`adr: revise 0002 …`).

```
treasure-maps-router-preset suite:
  ✗ treasureMaps preset exists in setup/router-presets.json with correct shape
      treasureMaps preset not found in setup/router-presets.json
  ✗ generateConfig with treasureMaps enabled emits a bidirectional kind-10040 stream block
      generateConfig must be exported from src/api/strfry/routerConfig.js so this behavior is unit-testable
  ✗ generateConfig with treasureMaps disabled omits its stream block
      generateConfig must be exported
  ✗ RelaySettings.jsx KIND_PRESETS contains the Treasure Maps (10040) option
      RelaySettings.jsx KIND_PRESETS must include { label: "Treasure Maps (10040)", kinds: [10040] }
  ✗ BIBLE.md or docs/CONFIGURATION.md documents the router preset system and the planned Negentropy preset system
      docs must contain a forward-looking note about the planned Negentropy preset system

Test Results
-------------
Configuration Loading:                PASS
treasure-maps-router-preset suite:    FAIL (0 passed, 5 failed)
Overall:                              FAIL
```

Each failure message directly identifies what the Implementer needs to add. No typo / import-error failures — all 5 are spec-driven.

Playwright spec at `tests/brainstorm/treasure-maps-router-preset.spec.js` is not run pre-implementation since it requires a deployed instance; it will be exercised against staging after the implementation lands.
