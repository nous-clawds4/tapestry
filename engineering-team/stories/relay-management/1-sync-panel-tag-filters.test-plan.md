# Test Plan: Story 1 — Single-letter tag filters in the Negentropy Sync panel

**Story:** `engineering-team/stories/relay-management/1-sync-panel-tag-filters.md`
**ADR:** `engineering-team/decisions/relay-management/0001-sync-panel-tag-filters.md`
**Date:** 2026-07-15

## Test levels (event-page/0002 precedent)

The harness has no JSX transpile, so the suite tests at three levels, mirroring `test/event-page-ui.test.js`:

- **EXECUTED (ESM):** `ui/src/utils/tagFilterValidation.js` — the pure validation core — loaded via dynamic `import()` and run against nip19-minted fixtures.
- **EXECUTED (CJS):** `src/api/strfry/negentropySync.js` pure helpers (`buildFilterObj`, `buildCommand`, `buildPreviewCommand`) via `require` — this is the ADR's server choke point.
- **SOURCE level:** the React surface in `RelaySettings.jsx` (component exists, state + composition-loop wiring, group placement, affordances). Interactive DOM behavior (typing → preview updates) is **not** exercised by an automated browser test; the preview/Count/Start ride the pre-existing single `filterObj` composition point (R2 pins it), so the executed logic + source wiring cover the ACs' observable outcomes. Residual risk — visual/interaction polish — is covered by manual browser verification during Implementation and Review (the panel on the local stack / staging).

## Coverage map

| Criterion | Test | Test file | Level |
|---|---|---|---|
| AC-1 (add → list + preview JSON) | U2 (values parsing), S1 (editor rendered), S2 (state + composition point), S3 (group placement) | `test/sync-panel-tag-filters.test.js` | executed + source |
| AC-2 (composes with kinds/authors/time) | B3 (tag keys survive next to authors/since/until), S2 (loop appends to the same filterObj) | 〃 | executed + source |
| AC-3 (remove) | S4 (per-row remove affordance; removal is an inline list filter per ADR) | 〃 | source |
| AC-4 (letter rules, merge+dedupe) | U1 (letter acceptance/rejection incl. trim, case-sensitivity), U7 (merge/dedupe/order/purity, `#x`≠`#X`) | 〃 | executed |
| AC-5 (p/e validation, bech32→hex, blocking errors) | U3 (p: hex, case-fold, npub/nprofile, wrong-type, malformed, one-bad-blocks-all), U4 (e: hex/note/nevent, npub rejected), U5 (P/E parity), S5 (inline error surface, no network) | 〃 | executed + source |
| AC-6 (a validation, naddr, coordinate shape) | U6 (coordinate verbatim, empty identifier, colons in identifier, hex case-fold, naddr decode, junk rejected, A parity) | 〃 | executed |
| AC-7 (free letters verbatim, ≥1 value) | U2 (trim/drop-empties/dedupe/≥1/verbatim) | 〃 | executed |
| AC-8 (honored end-to-end + regression guard) | B1 (helpers exported), B2 (tag key survives), B3 (multiple keys), B4 (non-tag & malformed keys dropped), B5 (value-shape enforcement), B6 (argv + preview carry the filter) | 〃 | executed |
| Regression sentinels (pass before AND after) | R1 (route registration intact), R2 (Start/Count still serialize the one filterObj) | 〃 | executed + source |

## Edge cases

- [x] Whitespace-only / empty values list → rejected (U2).
- [x] Duplicate values in one entry → deduped, first occurrence wins (U2).
- [x] Uppercase hex input → normalized lowercase (U3, U6).
- [x] Wrong bech32 type for the letter (note for p, npub for e/a) → rejected naming the value (U3, U4, U6).
- [x] Malformed bech32 checksum → rejected (U3).
- [x] One invalid value among valid ones → whole add blocked (U3).
- [x] `a` identifier empty / containing colons (U6).
- [x] Merge is pure (input not mutated) and case-sensitive (U7).
- [x] Server: `#xx`, `#1`, `#`, bare `x`, `#é`, `ids`, `limit`, arbitrary keys → all dropped (B4).
- [x] Server: non-array / empty-array / non-string-member tag values → sanitized or dropped (B5).
- Not automated (documented limitations per ADR): comma-bearing values; huge value lists vs GET query length; single-quote display preview cosmetics.

## Test infrastructure

- Framework: existing Node runner — suite `test/sync-panel-tag-filters.test.js`, registered in `test/test.js` (require + invocation + summary + `overallOk` + skip-list, the house 5-point wiring).
- No live stack required: no concept-graph calls, no strfry execution (B6 inspects the built argv, it does not spawn). Runs in CI's stack-free job.
- Fixtures: nip19-minted (`generateSecretKey`/`getPublicKey` + `npubEncode`/`nprofileEncode`/`noteEncode`/`neventEncode`/`naddrEncode`) — self-validating, no hardcoded TA pubkey anywhere.
- Firmware state: n/a (no concept definitions touched).

## How to run

```
npm test          # full gate
node -e "require('./test/sync-panel-tag-filters.test.js').run()"   # this suite alone
```

## Verification

The new tests fail with the current code — every U/B/S failure is a "feature not implemented yet (ADR relay-management/0001)" message (no import errors, no typos); R1/R2 sentinels pass. Confirmed 2026-07-15 at commit `8a2485bc`:

```
  ✗ U1…U7  — tagFilterValidation.js must export … — feature not implemented yet
  ✗ B1…B6  — negentropySync.js must export buildFilterObj/… — feature not implemented yet
  ✗ S1…S5  — TagFilterEditor / tagFilters state / Tag Filters group … — feature not implemented yet
  ✓ R1: negentropySync.js still exports registerNegentropySyncRoutes and registers the four routes
  ✓ R2: the panel still serializes the one filterObj into both Start and Count requests
  {"pass":2,"fail":18}
```

Full `npm test` (same date/commit): every pre-existing suite PASS; only the new suite fails:

```
sync-panel-tag-filters suite:                    FAIL (2 passed, 18 failed)
Overall:                                         FAIL
```
