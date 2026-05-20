# Test Plan: Story 13 — "Most pinned" sort, per-row counts, own-pin indicator on the tag index

**Story:** `engineering-team/stories/13-most-pinned-tag-index.md`
**ADR:** `engineering-team/decisions/0012-most-pinned-tag-index.md`
**Date:** 2026-05-20

## Coverage map

One row per AC + the edge cases the ACs imply.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (per-row pin-count badge) | `every row in the response carries pinnedCount (number, defaults to 0)` | `test/most-pinned-tag-index.test.js` | integration |
| AC-1 (server-observed, populated) | `after publishing a pin under a WoT-trusted author, that tag's row shows pinnedCount: 1` | `test/most-pinned-tag-index-publish.test.js` | integration |
| AC-1 (UI badge) | `each /tags row renders a pin-count badge with the documented value` | `tests/brainstorm/most-pinned-tag-index.spec.js` | e2e |
| AC-2 (server-side most-pinned sort) | `with two tags pinned by different counts of WoT-trusted authors, sort=most-pinned orders them desc; ties break on tagEventId asc` | `test/most-pinned-tag-index-publish.test.js` | integration |
| AC-3 (UI sort affordance) | `/tags sort toggle exposes "Most pinned" alongside used/endorsed/divisive` | `tests/brainstorm/most-pinned-tag-index.spec.js` | e2e |
| AC-3 (sort param accepted server-side) | `GET /api/profile-tags/index?sort=most-pinned returns 200 and echoes sort='most-pinned'` | `test/most-pinned-tag-index.test.js` | integration |
| AC-4 (POV change recomputes; UI) | `switching POV refetches the index and the new pinnedCount values reflect the new POV's WoT filter` | `tests/brainstorm/most-pinned-tag-index.spec.js` | e2e |
| AC-5 (own-pin indicator, server-side) | `every row in the response carries viewerPinned (boolean, defaults to false)` | `test/most-pinned-tag-index.test.js` | integration |
| AC-5 (own-pin populated) | `after the viewer pins a tag, that row's viewerPinned is true (independent of the active POV's WoT)` | `test/most-pinned-tag-index-publish.test.js` | integration |
| AC-5 (UI indicator) | `rows with viewerPinned=true render the own-pin indicator` | `tests/brainstorm/most-pinned-tag-index.spec.js` | e2e |
| AC-6 (filter toggle, UI) | `the "Only tags I've pinned" toggle is visible when logged in and triggers a refetch with pinnedByMe=true` | `tests/brainstorm/most-pinned-tag-index.spec.js` | e2e |
| AC-6 (filter, server-side) | `pinnedByMe=true narrows the rows to those where viewerPinned=true; total reflects the filtered count` | `test/most-pinned-tag-index-publish.test.js` | integration |
| AC-7 (logged-out UI parity) | `logged-out /tags renders the sort + badge but NOT the filter toggle or own-pin indicator` | `tests/brainstorm/most-pinned-tag-index.spec.js` | e2e |
| AC-7 (logged-out server contract) | `no viewerPubkey passed: rows still carry pinnedCount; viewerPinned defaults to false` | `test/most-pinned-tag-index.test.js` | integration |
| AC-8 (kind-5 deletion excluded) | `publishing a kind-5 deletion of a pin event drops it from the pinnedCount on the next fetch` | `test/most-pinned-tag-index-publish.test.js` | integration |
| AC-9 (replaceable dedupe) | `same author publishing two pin events for the same tag is counted as 1 (replaceable d-tag dedupe)` | `test/most-pinned-tag-index-publish.test.js` | integration |
| AC-10 (server-side pagination correctness) | `pinnedByMe filter applies before the slice; total reflects the filtered count; limit/offset honored` | `test/most-pinned-tag-index-publish.test.js` | integration |
| Union (tag with pins but no assertions) | `a tag with pinners but zero endorsements/disputes appears in the listing under sort=most-pinned` | `test/most-pinned-tag-index-publish.test.js` | integration |
| WoT scope (POV-required) | `pin authors who do NOT pass the active POV's WoT filter do NOT contribute to pinnedCount` | `test/most-pinned-tag-index-publish.test.js` | integration (POV-required) |
| Malformed viewerPubkey | `malformed viewerPubkey is silently treated as absent (no 400, no pinnedByMe filter applied)` | `test/most-pinned-tag-index.test.js` | integration |
| Bad sort still rejected | `GET /api/profile-tags/index?sort=bogus continues to return 400 (existing Story-4 contract preserved)` | `test/most-pinned-tag-index.test.js` | integration |

## Edge cases

- [x] Empty state (no pins at all) → every row's `pinnedCount` is 0; the `most-pinned` sort still works (everyone tied at 0 → secondary sort on tagEventId asc).
- [x] Single tag with one in-WoT pinner and one out-of-WoT pinner under POV → `pinnedCount` is 1, not 2.
- [x] Same tag pinned by a user who is also the viewer → `viewerPinned` is true AND `pinnedCount` includes that pin (when the viewer's author pubkey passes the WoT filter).
- [x] `pinnedByMe=true` without `viewerPubkey` → silently ignored (no filter applied, no 400).
- [x] `pinnedByMe=true` with malformed `viewerPubkey` → silently ignored.
- [x] Tag with pins-but-no-assertions appears in the response (union widening). Existing tags-with-assertions still appear in their previous relative order under non-pin sorts (regression-safety for Story 4).
- [x] kind-5 deletion of a pin event removes it from the count (relay-side honor).
- [x] Replaceable-event dedupe: same author publishing a second pin for the same tag with a different `created_at` is still ONE entry.
- [x] Logged-out user → no `viewerPubkey` threading from the client → server returns `viewerPinned: false` on every row.
- [x] Existing Story-4 sort modes (`used`, `endorsed`, `divisive`) still pass their tests (regression-safety).

## Test infrastructure

- **Test framework:** Node built-in runner (`node test/test.js`) + Playwright.
- **Control panel API:** `BRAINSTORM_BASE_URL` env or default `http://localhost:7778`.
- **Meili:** `MEILI_URL_HOST` env or default `http://localhost:7700`. Used by the POV-required test to seed pin authors' `wot_rank_<suffix>` columns.
- **Settings file mutation:** the WoT-scope test installs a deterministic POV (`TAPESTRY_SETTINGS_PATH` env or `/var/lib/brainstorm/settings.json`). Skipped when not writable (same skip path as Stories 11 + 12's POV-required tests).
- **Firmware:** no new concept; no reinstall required.
- **Playwright base URL:** `BRAINSTORM_BASE_URL` or default `http://localhost:7778`; skips when `BRAINSTORM_SERVER_ACCESSIBLE !== 'true'`. Same NixOS-style host limitation as prior stories; tests run in CI / a standard Linux env.
- **Fixtures:** ephemeral keypairs via `nak`; deterministic mock pubkeys in Playwright.
- **TA pubkey:** resolved at runtime via `getOwnerAssistantPubkey()` server-side and `useConfig().taPubkey` client-side (the bugfix at commit `d3a2640a`). Tests fetch `/api/assistant/pubkey` once at fixture setup rather than hardcoding.

## How to run

```bash
npm test                                              # contract + publish-flow
npm run test:playwright                                # UI / e2e
node test/most-pinned-tag-index.test.js                # contract only
node test/most-pinned-tag-index-publish.test.js        # publish-flow only
BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test most-pinned-tag-index.spec.js
```

## Verification

### Where the failing-first signal lives

- **`test/most-pinned-tag-index.test.js` (contract)** — every test
  fails today because:
  - `sort=most-pinned` is rejected by the existing
    `TAG_INDEX_VALID_SORTS` whitelist (Story 4's
    `src/api/profile-tags/index.js:723`). The endpoint returns 400.
  - Rows do not carry `pinnedCount` / `viewerPinned` fields yet.
- **`test/most-pinned-tag-index-publish.test.js` (live)** — every
  enabled test fails today because (a) the `sort=most-pinned` path
  returns 400 before any aggregation runs, (b) `pinnedCount` is
  absent on rows for sorts that DO work. The POV-required scope
  test skips locally per documented precondition.
- **`tests/brainstorm/most-pinned-tag-index.spec.js` (Playwright)**
  — every test fails today because the sort toggle doesn't include
  "Most pinned", the pin-count badge doesn't render, the own-pin
  indicator doesn't exist, and the "Only tags I've pinned" toggle
  isn't in the UI. Same Playwright execution caveat as prior
  stories (parses + lists in CI; doesn't run on this NixOS host).

Confirmed failing on **2026-05-20**.

Sample failure (`node test/most-pinned-tag-index.test.js`):

```
--- most-pinned-tag-index tests (Story 13) ---
  FAIL  GET /api/profile-tags/index?sort=most-pinned returns 200 and echoes sort='most-pinned'
        most-pinned sort status — got 400, expected 200
  FAIL  every row in the response carries pinnedCount (number, defaults to 0)
        rows must include 'pinnedCount' field; got first row keys: [tagEventId, slug, name, description, authorPubkey, applications, disputes, displayName, picture]
  FAIL  every row in the response carries viewerPinned (boolean, defaults to false)
        rows must include 'viewerPinned' field; got first row keys: [tagEventId, slug, name, description, authorPubkey, applications, disputes, displayName, picture]
  ...
```
