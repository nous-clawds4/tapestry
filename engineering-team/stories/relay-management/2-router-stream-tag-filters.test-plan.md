# Test Plan: Story 2 — Single-letter tag filters on Router Management streams

**Story:** `engineering-team/stories/relay-management/2-router-stream-tag-filters.md`
**ADR:** `engineering-team/decisions/relay-management/0002-router-stream-tag-filters.md`
**Date:** 2026-07-15

## Test levels (ADR §Implementation 4; sync-panel-tag-filters precedent)

The harness has no JSX transpile, so the suite tests at three levels, mirroring `test/sync-panel-tag-filters.test.js`:

- **EXECUTED (ESM):** the two new pure conversion helpers in `ui/src/utils/tagFilterValidation.js` — `tagFiltersFromFilter` / `applyTagFilters` — loaded via dynamic `import(pathToFileURL(...))` and run directly. The module exists today, so a missing export fails as a clean assertion naming the export (`… must export tagFiltersFromFilter — feature not implemented yet (ADR relay-management/0002)`), never an import crash.
- **EXECUTED (CJS):** `src/api/strfry/routerConfig.js` pure functions via `require` — the new `sanitizeStreamFilter` plus the already-exported `generateConfig`. Composition tests build stream objects in memory and assert over the returned config **text**: no file writes, no `supervisorctl`, no process spawns.
- **SOURCE level:** the React surface in `RelaySettings.jsx` (TagFilterEditor rendered inside StreamEditor wired to `form.filter` through the two helpers; block placement; import; read-card display) and the server ingress wiring in `routerConfig.js` (`handleUpdateRouterConfig` sanitizes; toggle/restore/init/ensureState do not). Interactive DOM behavior (typing → chips, the actual save→restart round-trip against a running router) is **not** exercised by an automated browser test; AC-1's entry/validation semantics are enforced by construction (same `TagFilterEditor` + the story-#1 validation core, exhaustively executed by the sibling suite `test/sync-panel-tag-filters.test.js`, which runs in the same `npm test`). Residual risk — visual polish and the live restart cycle — is covered by manual browser verification on the local stack / staging during Implementation and Review.

AC-1's carried-over entry rules (single-ASCII-letter, merge+dedupe, p/e/a bech32 validation, inline blocking errors) are deliberately **not re-tested here**: they are the exact same functions and component story #1 ratified, and the sibling suite's U1–U7/S4–S5 already execute them. This suite tests what is *new*: the conversion bridge, the server reconstruction, and the wiring.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (entry/validation at story-#1 parity) | U1 (rows derived for display), U3 (rows written back into `form.filter`), S1 (TagFilterEditor reused inside StreamEditor, no parallel state), S2 (helpers imported from the shared module), S3 (block placement between Event Kinds and Limit) + sibling suite U1–U7/S4–S5 (validation core, same `npm test`) | `test/router-stream-tag-filters.test.js` | executed + source |
| AC-2 (saved into deployed config, composed, per-stream, byte-identical regression guard) | B1 (tag keys survive next to kinds/limit), B2 (garbage dropped), B3 (full legal vocabulary round-trips), B4 (empty `kinds:[]` kept; non-object → `undefined`), B5 (byte-identical `generateConfig` for kinds/limit-only streams), B6 (config text carries `#z` composed with kinds; sibling stream's block byte-identical), U5 (open→save no-op), S5 (ingress sanitization), R2 (frozen emit baseline) | 〃 | executed + source |
| AC-3 (survives save → restart via the existing flow, no new steps) | B8 (sanitize is idempotent + pure — durable config, not session state), S5 (sanitize only at the client-JSON ingress; server-local paths untouched), R1 (exports + `supervisorctl restart strfry-router` mechanics unchanged) | 〃 | executed + source |
| AC-4 (round-trips into the editor; removal deletes exactly that key) | U1 (saved filters become displayable rows, order kept), U2 (nullish/garbage tolerance, verbatim display), U4 (remove one → exactly that `#<letter>` gone, rest untouched incl. `authors`), U5 (`applyTagFilters` ↔ `tagFiltersFromFilter` inverse), S4 (read card shows saved filters) | 〃 | executed + source |
| AC-5 (OPEN.md #25 stream expressible end-to-end; presets stay kinds-only) | B7 (kinds-only preset filter + `#z` row → helpers → sanitize → config text `{"kinds":[39999],"limit":5,"#z":[handles]}`), B6 (composition into config text), R3 (presets file carries no `#` keys; no new preset) | 〃 | executed |
| Regression sentinels (pass before AND after) | R1 (exports + restart mechanics), R2 (frozen `generateConfig` text for a kinds/limit-only stream), R3 (story-#1 surface + presets untouched) | 〃 | executed + source |

## Edge cases

- [x] Byte-identical `generateConfig` output for kinds/limit-only streams after sanitization — incl. today's new-stream default `{"kinds":[],"limit":5}` and a plugin-bearing stream (B5, baseline frozen in R2).
- [x] Empty `kinds: []` preserved, not dropped (B4 — ADR evidence test 8).
- [x] Garbage keys dropped: `bogusfield`, `#zz`, `#1`, bare `z`, non-integer kinds entries (`'notanumber'`, `2.5`, `null`), non-string/empty tag values, non-array tag values, empty tag arrays (B2).
- [x] `ids` / `authors` / `since` / `until` preserved though the UI doesn't edit them — hand-edited state round-trips an unrelated save byte-for-byte; per-key shape checks (non-integer since/until dropped, empty-after-filter ids dropped) (B3, U4 for `authors` at the helper level).
- [x] Tag-filter removal deletes exactly that `#<letter>` key; other tag keys and non-tag parts untouched (U4).
- [x] `applyTagFilters` → `tagFiltersFromFilter` inverse; open→save with no edits is a byte-identical no-op (U5).
- [x] Nullish / non-object filter tolerance on both helpers and the sanitizer (`null`, `undefined`, string, number, array) (U2, U3, B4).
- [x] Insertion-order preservation: tag-key order in rows (U1), non-tag-first-then-rows key order on write-back (U3), whitelist copy order (B1, B3), `#z` between `kinds` and `limit` in emitted JSON (B6).
- [x] Stored values displayed verbatim — load never rewrites persisted config (U2).
- [x] Per-stream scoping: a sibling stream's emitted config block is byte-identical whether or not another stream carries tag filters (B6).
- [x] Case-sensitive letters round-trip (`#X` distinct from `#x`) (U5).
- [x] Rows are the source of truth: stale `#`-keys in the filter object are replaced by the row list on write-back (U3 — this is what makes remove work).
- Not automated (documented limitations per ADR / story): comma-bearing values (same accepted limitation as story #1); live save→restart against a running `strfry-router` (the local router process is FATAL-stale, OPEN.md; the parser evidence lives in ADR §Verified evidence); UI editing of `ids`/`authors`/`since`/`until` (out of scope — sanitizer preserves them, B3).

## Test infrastructure

- Framework: existing Node runner — suite `test/router-stream-tag-filters.test.js`, registered in `test/test.js` (require + banner/invocation + summary line + `overallOk` conjunct + skip-list: the house 5-point wiring).
- **Stack-free by design (CI-safe):** no control panel, no strfry binary, no router process, no supervisord, no Docker, no network. The B-tests execute pure functions and assert over returned config text; nothing is written to `/etc` or `/var/lib`. The suite must be green in CI's stack-free job post-implementation.
- Fixtures: nip19-minted hex pubkey (`getPublicKey(generateSecretKey())`) — self-validating, **no hardcoded TA pubkey anywhere**; `#z` values are canonical-handle-shaped opaque strings built from the minted hex (`39998:<minted>:tag`, `39998:<minted>:tag-pinning`).
- Graph state: none required — no concept-graph calls, no firmware precondition (ADR: no concept definitions change).
- S-test scoping helpers slice source sections between top-level markers (`function StreamEditor(` → `function ToggleSwitch`, etc.) and distinguish `sanitizeStreamFilter` *calls* from its *declaration*, so the Implementer's placement of the new function cannot false-flag the ingress checks.

## How to run

**Story suite alone (the unambiguous gate check — use this):**

```
node -e "require('./test/router-stream-tag-filters.test.js').run().then(r => console.log(JSON.stringify(r)))"
```

Full gate:

```
npm test
```

**Environment prerequisite / known-noise caveat:** the full `npm test` in any local checkout currently shows `Overall: FAIL` from **pre-existing environmental failures in the live-API tag/pin/TL suites** (OPEN.md #27 — stale bind-mounted local stack; 34 failures across 11 suites at the time of writing). Those failures exist with or without this story's suite and are not this story's concern. Evaluate this story by its own summary line (`router-stream-tag-filters suite: …`) or by the story-suite-alone command above. In CI (stack-free job) the live-API suites skip, so post-implementation the full gate is expected green there.

## Verification

The new tests fail with the current code — all 18 U/B/S failures are clean `feature not implemented yet (ADR relay-management/0002)` assertions naming the missing export or wiring (no import errors, no typos, no crashes); the 3 R sentinels pass. Confirmed 2026-07-15 at commit `97d74e97`, story suite alone:

```
  ✗ U1: tagFiltersFromFilter turns a saved stream filter's "#<letter>" keys into editor rows — …
      ui/src/utils/tagFilterValidation.js must export tagFiltersFromFilter — feature not implemented yet (ADR relay-management/0002).
  ✗ U2 … U5 — same failure mode (tagFiltersFromFilter / applyTagFilters not exported)
  ✗ B1: sanitizeStreamFilter is exported and keeps "#<letter>" entries composed with kinds/limit …
      src/api/strfry/routerConfig.js must export sanitizeStreamFilter — feature not implemented yet (ADR relay-management/0002).
  ✗ B2 … B6, B8 — same failure mode (sanitizeStreamFilter not exported)
  ✗ B7: the OPEN.md #25 dcosl tags-federation stream is expressible through the editor helpers alone …
      applyTagFilters (the editor write-back) must be exported from tagFilterValidation.js — feature not implemented yet (ADR relay-management/0002).
  ✗ S1: StreamEditor renders the reused TagFilterEditor driven by form.filter through the two helpers …
      StreamEditor must render <TagFilterEditor …/> (the story-#1 component, reused not forked) — feature not implemented yet (ADR relay-management/0002).
  ✗ S2 … S4 — same failure mode (import / 'Tag Filters' block / card wiring missing)
  ✗ S5: the server reconstructs stream filters at the client-JSON ingress only …
      handleUpdateRouterConfig must rebuild each stream's filter via sanitizeStreamFilter before saveState/applyConfig — client JSON must never pass through opaquely — feature not implemented yet (ADR relay-management/0002).
  ✓ R1: routerConfig.js keeps its existing exports and the existing save/apply → supervisorctl-restart mechanics — no new steps or restart behavior (AC-3)
  ✓ R2: generateConfig still emits today's exact text for a kinds/limit-only stream — the frozen baseline AC-2's byte-identity guard measures against
  ✓ R3: story-#1's surface and the presets stay untouched — TagFilterEditor + the sync panel's state remain, and every preset is still a kinds-only starting point (AC-5 guardrails)
{"pass":3,"fail":18}
```

Full `npm test` (same date/commit, actual run): the new suite is the only *story-relevant* failure. The sibling `sync-panel-tag-filters` suite and every other stack-free suite pass. The pre-existing OPEN.md #27 environmental failures are present exactly as documented — 34 failures across 11 live-API tag/pin/TL suites, all predating this branch:

```
profile-tags suite:                              FAIL (10 passed, 3 failed)      ← pre-existing (OPEN.md #27)
profile-tags-publish suite:                      FAIL (6 passed, 1 failed)       ← pre-existing
tag-detail-publish suite:                        FAIL (7 passed, 2 failed)       ← pre-existing
tag-index-publish suite:                         FAIL (8 passed, 1 failed)       ← pre-existing
profile-tag-polish suite:                        FAIL (7 passed, 4 failed)       ← pre-existing
pin-a-tag-publish suite:                         FAIL (1 passed, 6 failed)       ← pre-existing
tl-publication-from-pins suite:                  FAIL (9 passed, 1 failed)       ← pre-existing
tl-publication-from-pins-publish suite:          FAIL (2 passed, 5 failed)       ← pre-existing
customize-pin-curation-publish suite:            FAIL (0 passed, 3 failed)       ← pre-existing
most-pinned-tag-index-publish suite:             FAIL (0 passed, 7 failed)       ← pre-existing
tag-detail-curated-view-and-pin-polish-publish suite: FAIL (0 passed, 1 failed)  ← pre-existing
sync-panel-tag-filters suite:                    PASS (20 passed, 0 failed)
router-stream-tag-filters suite:                 FAIL (3 passed, 18 failed)      ← THIS STORY (intentional)
Total skipped:                                   25
Overall:                                         FAIL
```
