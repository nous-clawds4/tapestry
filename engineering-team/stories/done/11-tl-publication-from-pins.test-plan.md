# Test Plan: Story 11 — Periodic Trusted List publication from pinned tags

**Story:** `engineering-team/stories/done/11-tl-publication-from-pins.md`
**ADR:** `engineering-team/decisions/0010-tl-publication-from-pins.md`
**Date:** 2026-05-19

## Coverage map

One row per AC + the v1 product constraints + the two ADR-amended decisions
(refresh-on-pin, status-derived-from-strfry).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (scheduler entry) | `scheduled-tasks recognizes refreshPinnedTagTLs (status/update/history all 200)` | `test/tl-publication-from-pins.test.js` | integration |
| AC-1 (cron publishes) | `refresh-all-pinned-tags publishes a kind-30392 for each supported pin` | `test/tl-publication-from-pins-publish.test.js` | integration |
| AC-2 (replaceable slot) | `refreshing the same pin twice replaces the TL in place at the same d-tag` | `test/tl-publication-from-pins-publish.test.js` | integration |
| AC-3 (per-pin refresh-now) | `refresh-pinned-tag endpoint exists, rejects missing/malformed pinEventId with 400, rejects unauthenticated with 401/403` | `test/tl-publication-from-pins.test.js` | integration |
| AC-3 (per-pin refresh-now UI) | `clicking the Refresh now button on a /pins row triggers refresh-pinned-tag and the row updates` | `tests/brainstorm/tl-publication-from-pins.spec.js` | e2e |
| AC-4 (refresh-all endpoint) | `refresh-pinned-tags-for-viewer rejects missing/malformed viewerPubkey with 400, rejects unauthenticated with 401/403` | `test/tl-publication-from-pins.test.js` | integration |
| AC-4 (refresh-all UI) | `clicking Refresh all on /pins fires refresh-pinned-tags-for-viewer and shows per-pin outcome` | `tests/brainstorm/tl-publication-from-pins.spec.js` | e2e |
| AC-5 (disputes function) | `published TL membership respects cutoff: endorsements >= cutoff AND > disputes, WoT-trusted authors only` | `test/tl-publication-from-pins-publish.test.js` | integration |
| AC-6 (Settings panel) | `Settings → Scheduled Tasks exposes a Pinned-tag Trusted List refresh panel with the standard task-card controls` | `tests/brainstorm/tl-publication-from-pins.spec.js` | e2e |
| AC-7 (unsupported method, server) | `pin with curation-method.method != nip85:rank produces no kind-30392 and tlStatus=unsupported on /pins` | `test/tl-publication-from-pins-publish.test.js` | integration |
| AC-7 (unsupported method, UI) | `/pins row for an unsupported-method pin shows the hint text and a disabled Refresh now button` | `tests/brainstorm/tl-publication-from-pins.spec.js` | e2e |
| AC-8 (amended — isolation + transient errors) | `refresh-all response surfaces per-pin status objects; a failing pin does not block other pins from succeeding` | `test/tl-publication-from-pins-publish.test.js` | integration |
| AC-9 (retraction on unpin) | `unpinning a tag then refreshing produces an empty-membership replacement (kind-30392, no p tags, [\"status\",\"retracted\"] marker)` | `test/tl-publication-from-pins-publish.test.js` | integration |
| AC-10 (wire-shape compatibility) | `published kind-30392 carries d/title/metric/observer/source-tag/cutoff/min-rank tags plus member p tags, with content body JSON listing per-member endorsement/dispute counts` | `test/tl-publication-from-pins-publish.test.js` | integration |
| Refresh-on-pin (ADR amendment) | `clicking Pin on a tag detail page fires a fire-and-forget POST /api/trusted-list/refresh-pinned-tag without blocking the button flip` | `tests/brainstorm/tl-publication-from-pins.spec.js` | e2e |
| tlStatus derived (ADR amendment) | `/api/profile-tags/pins rows include a tlStatus object with status in {ok, never, unsupported, retracted} derived from strfry only` | `test/tl-publication-from-pins-publish.test.js` | integration |

### Contract-suite endpoint existence guards

| Behavior | Test name | File | Level |
|---|---|---|---|
| New endpoint exists | `refresh-all-pinned-tags endpoint exists (not 404) and returns the documented envelope for empty state` | `test/tl-publication-from-pins.test.js` | integration |
| pins endpoint additive change | `/api/profile-tags/pins for an unknown viewer returns success with empty pins array (unchanged from Story 10)` | `test/tl-publication-from-pins.test.js` | integration |

## Edge cases

- [x] No pins exist anywhere → `refresh-all-pinned-tags` returns `{success: true, pins: []}` (no crash, no spurious TLs).
- [x] Pin with `method=trust-everyone` (or any non-`nip85:rank`) → not refreshed, `tlStatus=unsupported`.
- [x] Pin whose referenced tag event is missing from strfry → not refreshed (no TL published).
- [x] Pin's observer has no resolvable POV (no user-prefs + no house delegate) → not refreshed (no TL); per-pin status surfaces in the endpoint response.
- [x] Two pins with different observers on the same `(tagAuthor, tagSlug)` → two distinct d-tag slots → two TLs.
- [x] Two pins with same observer on the same `(tagAuthor, tagSlug)` (shouldn't happen because Story-10's d-tag is keyed on `(tagSlug, tagAuthor8, viewer8)` and dedupeReplaceable collapses, but worth defending) → only one TL produced.
- [x] Refreshing the same pin twice → replacement in place; latest `created_at` wins; no event accumulation.
- [x] Unpin + refresh → empty-membership replacement; `["status","retracted"]` marker present.
- [x] After retraction, re-pinning + refreshing again → the retracted marker disappears (a fresh non-retracted TL replaces the slot).
- [x] Per-pin failure during refresh-all does not block other pins from succeeding.
- [x] Pin event with malformed/missing curation-method JSON → treated as unsupported / skipped (no crash).
- [x] Unauthenticated calls to user-facing endpoints → 401 or 403.
- [x] Refresh-on-pin is fire-and-forget — the Pin button flips to Unpin immediately even if the refresh response is slow / fails.

## Test infrastructure

- **Test framework:** Node built-in runner (`node test/test.js`) and Playwright (`npm run test:playwright`).
- **Control panel API:** `BRAINSTORM_BASE_URL` env or default `http://localhost:7778`.
- **Concept Graph API:** same base URL; this story does NOT add a new firmware concept (kind-30392 is an existing event type with an existing read surface) — no firmware-status check required.
- **Meili:** `MEILI_URL_HOST` env or default `http://localhost:7700`. Required for the AC-5 disputes-function test, which seeds author profiles with `wot_rank_<suffix>` columns.
- **Settings file mutation:** the AC-5 / disputes-function test installs a deterministic POV by writing to `settings.json` (path = `TAPESTRY_SETTINGS_PATH` env or `/var/lib/brainstorm/settings.json`) — same pattern as `test/tag-detail-write-publish.test.js`. Skipped when the file is not writable from the test process.
- **Firmware state:** no new concept — **no firmware reinstall precondition** beyond Story-10's `tag-pinning` install.
- **Playwright base URL:** `BRAINSTORM_BASE_URL` or default `http://localhost:7778`. Tests skip themselves when `BRAINSTORM_SERVER_ACCESSIBLE !== 'true'`.
- **Fixtures:**
  - Ephemeral keypairs via `nak` (matches existing `*-publish.test.js` files).
  - In Playwright, deterministic mock pubkeys (`'1'.repeat(64)` etc.) and mocked `window.nostr` + `/api/profile-tags/pins` (with `tlStatus` populated).
  - The publish-flow tests escape brace-expansion in `--tag curation-method=<json>` by using `execFileSync('nak', argv)` rather than the shell wrapper (same trick as `test/pin-a-tag-publish.test.js`).

## How to run

```bash
npm test                                              # contract + publish-flow
npm run test:playwright                                # UI / e2e
node test/tl-publication-from-pins.test.js             # just the contract suite
node test/tl-publication-from-pins-publish.test.js     # just the publish-flow suite
BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test tl-publication-from-pins.spec.js
```

## Verification

The tests fail with the current code:

- `tl-publication-from-pins.test.js`: every new endpoint returns 404; `tlStatus` field absent from `/api/profile-tags/pins`; `scheduled-tasks?taskId=refreshPinnedTagTLs` returns 400 (unknown taskId).
- `tl-publication-from-pins-publish.test.js`: setup may run via `nak` but the cron endpoint 404s, so no TL is published — every assertion against TL shape fails meaningfully.
- `tl-publication-from-pins.spec.js`: no Pinned-tag refresh panel on Settings; no Refresh now / Refresh all buttons on `/pins`; no `tlStatus` indicator; pin click doesn't fire the refresh-pinned-tag endpoint.

Confirmed failing on **2026-05-19**.

Sample failure (from `node test/tl-publication-from-pins.test.js`):

```
--- tl-publication-from-pins tests (Story 11) ---
  FAIL  POST /api/trusted-list/refresh-all-pinned-tags exists and returns the documented envelope for empty state
        refresh-all-pinned-tags status — got 404, expected 200
  FAIL  POST /api/trusted-list/refresh-pinned-tag rejects missing pinEventId with 400
        refresh-pinned-tag (no body) status — got 404, expected 400
  FAIL  POST /api/trusted-list/refresh-pinned-tags-for-viewer rejects missing viewerPubkey with 400
        refresh-pinned-tags-for-viewer (no viewerPubkey) status — got 404, expected 400
  FAIL  scheduled-tasks recognizes refreshPinnedTagTLs (status returns the documented schedule shape)
        scheduled-tasks/status?taskId=refreshPinnedTagTLs got 400 — Unknown or missing taskId
  FAIL  /api/profile-tags/pins for an unknown viewer returns success with pins:[] and rows carry tlStatus
        row.tlStatus must be present (Story 11 amendment) — got undefined
```

(All failures point at concrete missing implementation surfaces — no
typos / import errors.)
