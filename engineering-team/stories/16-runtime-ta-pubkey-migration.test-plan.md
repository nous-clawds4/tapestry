# Test Plan: Story 16 — Restore historical data visibility while fixing the TL author filter

**Story:** `engineering-team/stories/16-runtime-ta-pubkey-migration.md`
**ADR:** `engineering-team/decisions/0015-restore-historical-data-and-fix-tl-author-filter.md`
**Date:** 2026-05-26

## Approach

Story 16's fix is a coordinated edit across one server module, one
client publisher, two caller pages, and a documentation note. Most
of the ACs are statements about source-level invariants ("the z-tag
constants are derived from a named legacy constant"; "the pin
publisher no longer takes a `taPubkey` parameter"; etc.). The
established pattern for this kind of assertion in the repo —
matched in Story 17's test files and `nip05-checkmark-verification`
— is **source-file regex inspection**.

In addition, this story's correctness has a small **runtime-behavior
hinge** the source check alone can't prove: that the TL author
filter, when actually invoked, resolves the deployment's runtime
TA pubkey rather than baking in a stale value at module load. We
cover that with one server-contract HTTP test that confirms the
endpoint accepts and processes a request without 500-ing — i.e.,
the module's `TA_PUBKEY = getOwnerAssistantPubkey()` initialization
returned a valid pubkey on this dev machine.

Beyond the new tests, **the existing test suite is the load-bearing
regression sentinel.** Story 16 must not break any previously
passing assertion. The dev machine masks the literal-vs-runtime
divergence (literal == on-disk TA), so every existing pin /
profile-tag / TL test continues to exercise the same wire paths
post-fix. AC-7 of the story specifies this directly.

Edge cases the source-regex approach cannot cover are flagged at
the bottom of this plan for manual verification at staging /
production smoke time.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (dev visibility regression) | All previously-passing suites continue to pass (`npm test`) | `test/test.js` (full suite) | full suite |
| AC-2 (non-dev visibility) | _Manual post-deploy verification at staging / `tags.brainstorm.world`_ | N/A — flagged below | manual |
| AC-3 (non-dev pin TL "ok") | _Manual post-deploy verification at staging / `tags.brainstorm.world`_ | N/A — flagged below | manual |
| AC-4 | `enrichRowsWithTLStatus passes runtime TA_PUBKEY (not literal) to authors filter` | `test/restore-historical-data-and-fix-tl-author-filter.test.js` | source-regex |
| AC-4 | `refreshPinnedTags retractStaleTLs passes runtime TA_PUBKEY to authors filter` | same | source-regex |
| AC-4 | `TA_PUBKEY constant on server is the runtime getOwnerAssistantPubkey() value` | same | source-regex |
| AC-4 | `/api/profile-tags/profiles-tagged returns 200 with the new module init` | same | server contract |
| AC-5 | `LEGACY_Z_TAG_PUBKEY constant exists with hex literal in profile-tags/index.js` | same | source-regex |
| AC-5 | `TAG_Z_TAG / NOSTR_USER_TAG_Z_TAG / TAG_PINNING_Z_TAG derive from LEGACY_Z_TAG_PUBKEY` | same | source-regex |
| AC-5 | `LEGACY_Z_TAG_PUBKEY carries an explanatory comment block referencing ADR-0015` | same | source-regex |
| AC-6 (ADR amendment) | `publishTagPin.js carries LEGACY_TA_PUBKEY literal at module top` | same | source-regex |
| AC-6 (ADR amendment) | `pinTag() signature no longer accepts a taPubkey parameter` | same | source-regex |
| AC-6 (ADR amendment) | `publishTagPin.js z-tag composition uses LEGACY_TA_PUBKEY, not runtime` | same | source-regex |
| AC-6 (ADR amendment) | `useProfileTags.js literal hardcode unchanged` | same | source-regex (regression sentinel) |
| AC-6 (ADR amendment) | `publishProfileTag.js literal hardcode unchanged` | same | source-regex (regression sentinel) |
| ADR Impl Shape | `Tag.jsx pinTag(...) call no longer passes taPubkey` | same | source-regex |
| ADR Impl Shape | `Pins.jsx pinTag(...) call no longer passes taPubkey` | same | source-regex |
| ADR Doc Step | `CLAUDE.md carries the "Named exception (ADR 0015)" paragraph` | same | source-regex |
| AC-7 | (covered by full-suite regression) | `npm test` | full suite |
| AC-8 | (covered by AC-4 source-regex + post-deploy manual smoke) | — | combined |

### Regression sentinels (must PASS pre- AND post-implementation)

| Sentinel | What it guards | Test file |
|---|---|---|
| R-1 | `publishTagPin.js` `defaultCurationMethod` still returns `cutoff: 1` and `includeScoreInTL: true` (Story 17's defaults preserved) | `test/restore-historical-data-and-fix-tl-author-filter.test.js` |
| R-2 | `refreshPinnedTags.js:67` `computeTLDTag` is unchanged (the TL `d`-tag shape is wire-binding) | same |
| R-3 | `/api/profile-tags/index` still returns rows with `applications` / `disputes` / `pinnedCount` integers (no shape regression) | same |
| R-4 | `useProfileTags.js` literal `82b75e47…` STAYS at line 5 (Story 16 deliberately doesn't touch this file) | same |
| R-5 | `publishProfileTag.js` literal `82b75e47…` STAYS at line 15 (Story 16 deliberately doesn't touch this file) | same |

## Edge cases

- **Empty response set:** the server-contract HTTP test asserts the
  endpoint returns 200; rows may be empty on a fresh dev stack and
  that's acceptable. The runtime author-filter source-regex test
  is what locks in the load-bearing change.
- **`TA_PUBKEY` resolves to null at module init:** if the dev
  machine's secure-key store is unreadable at boot, the server's
  `console.warn` fires and `TA_PUBKEY` is null. The TL author filter
  then becomes `authors: [null]` — strfry will return zero events.
  This is a pre-existing degradation surface (it predates Story 16);
  this story does not change it. Out of scope.
- **AC-2 / AC-3 non-dev verification:** the manual staging smoke
  walks: open the tag-detail page for any historical tag, confirm
  rows render; open `/pins`, confirm previously-pinned rows render
  with status `ok`/`never`/`retracted` (not perpetual "No TL yet").
  This is the only way to prove the fix without access to
  production data.
- **CLAUDE.md edit:** the named-exception paragraph is content
  that's important for the next reader; the regex checks for its
  presence by class name + ADR reference, not for exact prose
  wording. Tester accepts the Implementer's final wording.

## Test infrastructure

- **Test framework:** the project's hand-rolled runner (`node test/test.js`).
- **Concept Graph API:** not required.
- **Firmware state:** unchanged (no reinstall).
- **Control panel:** required at `BRAINSTORM_BASE_URL`
  (default `http://localhost:7778`) for the one server-contract
  HTTP test.
- **`nak` binary:** not required for this story's new tests
  (Story 17's tests covered the pin publish-flow shape; this
  story's wire-format change is asserted via source regex on the
  publisher rather than re-running the full publish flow).

## How to run

```
npm test
```

The new suite is registered in `test/test.js` alongside the existing
suites.

## Verification

The new tests fail with the current code. Confirmed on 2026-05-26:

```
node test/restore-historical-data-and-fix-tl-author-filter.test.js
```

**11 FAIL, 11 PASS.** The shape is:

- **11 FAIL** — all the AC-driven gaps the Implementer must close:
  - 4 × AC-5 (LEGACY_Z_TAG_PUBKEY missing; z-tag constants don't
    derive from it; defensive: they currently derive from runtime
    TA_PUBKEY)
  - 4 × AC-6 (publishTagPin.js missing LEGACY_TA_PUBKEY; z-tag
    composition still uses runtime; pinTag still accepts taPubkey
    param; validation block still present)
  - 2 × callers (Tag.jsx + Pins.jsx still pass taPubkey)
  - 1 × CLAUDE.md (named-exception paragraph missing)

- **11 PASS** — the regression sentinels that lock in load-bearing
  state:
  - 4 × AC-4 (runtime TA_PUBKEY constant still present; runtime
    authors filter in enrichRowsWithTLStatus + retractStaleTLs;
    profiles-tagged endpoint still 200). **These tests pass pre-
    implementation because the branch already carries the runtime
    author filter via d3a2640a/cbc2b8f0. They are sentinels:
    must continue to pass post-implementation.**
  - 2 × R-4/R-5 (useProfileTags.js + publishProfileTag.js literals
    deliberately untouched — out-of-scope-file sentinels)
  - R-1 (Story 17 defaultCurationMethod defaults preserved)
  - R-2 (Story 11 computeTLDTag wire shape preserved)
  - R-3 (Story 13 pinnedCount integer field preserved)
  - R-4 / R-5 duplicate sentinels under explicit R-numbering

Each failure message names the specific gap and the file:line that
must change.
