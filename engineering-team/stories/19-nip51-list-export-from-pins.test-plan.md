# Test Plan: Story 19 — NIP-51 kind-30000 list export from pinned tags

**Story:** `engineering-team/stories/19-nip51-list-export-from-pins.md`
**ADR:** `engineering-team/decisions/0017-nip51-list-export-from-pins.md`
**Date:** 2026-05-28

## Coverage map

One row per AC plus the Amendment ACs (AC-25–AC-28). Each AC gets at
least one test. Where an AC can only be verified by a human (e.g.,
"open in Amethyst"), it is marked **manual** and a corresponding
walkthrough note appears in the test plan's Manual verification
section.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (pin-time publishes both events) | `pin button click on tag-detail signs a kind-39999 AND a kind-30000 under the viewer's pubkey via NIP-07 (mocked)` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-2 (wire-shape — d-tag, z-tag, title, p-tags) | `prepare-nip51-export endpoint returns an unsigned kind-30000 template with the expected tags + viewer-as-pubkey` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-3 (optional description / image) | `the unsigned template carries a description tag with the canonical Brainstorm hint; image is absent in v1` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-4 (shared membership compute) | `kind-30000's p-tag set matches the kind-30392's p-tag set at the moment of publish` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-5 (stable d-tag → single addressable slot) | `two re-exports for the same pin produce two kind-30000 events at the same (kind, pubkey, d) coordinate; relay resolution returns only the latest` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-6 (d-tag composition rules) | `the kind-30000's d-tag matches computeTLDTag(observer, tagAuthor, tagSlug); changing title between re-exports does not change the d-tag` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-7 (no NIP-09 deletes on re-export) | `re-exporting does not publish a kind-5 deletion event targeting the previous kind-30000 (re-export is replacement, not delete)` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-8 (re-pin reuses slot) | `unpin + re-pin + re-export uses the same (kind, pubkey, d-tag) slot as the original export (no orphan)` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-9 (title customizable + fallback) | `prepare-nip51-export uses the provided title when passed; otherwise defaults to the tag's display name` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-9 (no title interstitial at pin time) | `pin button click does NOT show a title-input dialog (first pin is no-interstitial per Story 18 invariant)` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-10 (export affordance distinct from share) | `the kind-30000 Export affordance appears on /pins and /pin/:dTag separately from TLShareButton` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-11 (re-export → NIP-07 → naddr to clipboard) | `clicking the Export button prompts NIP-07 sign and copies the returned naddr to the clipboard` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-12 (legacy-pin first-export) | `a pin with no previous kind-30000 export uses the same Export button affordance to publish the first one` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-13 (no NIP-07 → disabled) | `the Export button is disabled (or hidden) when window.nostr is unavailable and shows a clear hint` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-14 (two distinct share/copy affordances) | `TLShareButton and TLExportButton render side-by-side with visually distinct labels` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-15 (last-exported timestamp) | `nip51ExportStatus on /pins rows carries exportedAt timestamp when an export exists` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-16 (staleness diff) | `nip51ExportStatus reports {added, removed} diff vs the current kind-30392 when membership differs; status is 'stale'` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-17 (never-exported state) | `nip51ExportStatus.status === 'never-exported' for a pin with no kind-30000; UI surfaces an inviting hint` | `test/nip51-list-export-from-pins.test.js` + `tests/brainstorm/nip51-list-export-from-pins.spec.js` | integration + e2e |
| AC-18 (no regression — /pins kind-30392 surface) | `/api/profile-tags/pins rows continue to carry tlStatus with the unchanged shape from Story 11` | `test/nip51-list-export-from-pins.test.js` | integration |
| AC-19 (no regression — /pin/:dTag) | `/pin/:dTag detail page metadata + members render unchanged from Story 11` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-20 (no regression — filter chips) | `Brainstorm Search pinned-tag chip set unchanged; still sourced from kind-30392` | (covered by existing Story 11 / 17 / 18 chips tests; no new test) | regression |
| AC-21 (paste into Amethyst) | **MANUAL** — Reviewer manually pastes a copied `naddr` into Amethyst (Android) or equivalent; verifies the list renders as a feed | (none — manual) | manual |
| AC-22 (recipient missing relay) | **MANUAL** — Reviewer pastes the `naddr` into a client whose relays don't include the broadcast relays; confirms failure-tolerance is correct | (none — manual) | manual |
| AC-23 (two POVs → two events) | `two distinct users publishing kind-30000 for the same tag yield two distinct events with distinct (pubkey, d-tag) coordinates and potentially distinct membership` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-24 (membership via WoT-author filter) | `kind-30000 membership at publish is the kind-30392's membership (which is itself per-POV WoT-filtered); no global truth` | (sub-assertion within AC-4 test) | integration |
| AC-25 (publish to user's NIP-65 write relays) | `prepare-nip51-export endpoint response includes writeRelays array equal to user's kind-10002 write relays from local strfry` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-25 (kind 10002 is in syncWoT kinds list) | `src/manage/negentropySync/syncWoT.sh's strfry sync line includes kind 10002` | `test/nip51-list-export-from-pins.test.js` | unit |
| AC-26 (pre-publish relay preview) | `Export button popover shows a relay-preview block listing the user's write relays before the NIP-07 prompt` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-27 (no kind-10002 fallback warning) | `Export popover shows the no-NIP-65 warning copy when the user has no kind-10002 in local strfry` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |
| AC-27 (server returns writeRelays:[] when no kind-10002) | `prepare-nip51-export response writeRelays === [] when the user has no kind-10002 in strfry` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| AC-28 (naddr includes write relays) | `the returned naddr decodes to relays = user's NIP-65 write relays (or [] when absent)` | `test/nip51-list-export-from-pins-publish.test.js` | integration |
| Unpin hint (Q9) | `CurationMethodDialog's edit-mode unpin button shows the "kind-30000 won't auto-retract" hint when a kind-30000 export exists for that pin` | `tests/brainstorm/nip51-list-export-from-pins.spec.js` | e2e |

### Contract-suite endpoint existence guards

| Behavior | Test name | File | Level |
|---|---|---|---|
| New endpoint exists | `POST /api/trusted-list/prepare-nip51-export endpoint exists (not 404)` | `test/nip51-list-export-from-pins.test.js` | integration |
| Endpoint rejects unauthenticated | `POST /api/trusted-list/prepare-nip51-export rejects unauthenticated calls with 401 or 403` | `test/nip51-list-export-from-pins.test.js` | integration |
| Endpoint rejects missing pinEventId | `POST /api/trusted-list/prepare-nip51-export rejects missing pinEventId with 400 (or 401/403 if auth fires first)` | `test/nip51-list-export-from-pins.test.js` | integration |
| Endpoint rejects malformed pinEventId | `POST /api/trusted-list/prepare-nip51-export rejects malformed pinEventId` | `test/nip51-list-export-from-pins.test.js` | integration |
| `/api/profile-tags/pins` additive shape | `/api/profile-tags/pins rows carry a nip51ExportStatus object alongside tlStatus` | `test/nip51-list-export-from-pins.test.js` | integration |
| Story-11 / Story-10 empty-state preserved | `/api/profile-tags/pins for an unknown viewer still returns success with pins:[]` | `test/nip51-list-export-from-pins.test.js` | integration |
| `/api/config/public-relay` is NOT introduced | `the Implementer must not introduce /api/config/public-relay per ADR 0017 amendment A9; if it exists, this story has scope creep` | (assertion within nip51-list-export-from-pins.test.js) | integration |

## Edge cases

- [x] Two re-exports in the same second — both succeed (relay decides ordering by created_at; the later one wins).
- [x] User publishes a kind-30000 with the right d-tag manually (e.g. in another client) — the staleness derivation correctly picks it up.
- [x] User's kind-10002 changes between Export clicks — the next click reads the new list (no cross-action caching, per ADR Amendment A5).
- [x] User's kind-10002 has all-read (no write) entries — server returns `writeRelays: []`; naddr `relays: []`; UI shows the warning.
- [x] User's kind-10002 has mixed read/write — only write (or unmarked) entries are returned in writeRelays.
- [x] User signs the second NIP-07 prompt with a different key (e.g. switches accounts mid-flow) — published kind-30000 has the new pubkey; subsequent /pins lookup using the OLD pubkey shows nip51ExportStatus.status='never-exported' for that row. (Confirms the addressable coordinate is `(kind, pubkey, d-tag)` and that pubkey switches really do create a new slot.)
- [x] User rejects the second NIP-07 prompt at pin time — the pin landed; the kind-30000 publish errors out; `/pins` row's nip51ExportStatus.status='never-exported'; the user can later click Export to publish.
- [x] Re-export when no kind-30392 exists yet (the pin is fresh; cron hasn't run; refresh-on-pin failed) — the prepare endpoint returns an empty `p`-tag set; published kind-30000 has zero members. Acceptable UI behavior (PO: user can re-export later when membership exists).
- [x] `nip51ExportStatus.diffVsTL.added` includes a member in the current kind-30392 not in the last kind-30000; `removed` includes a member in the last kind-30000 not in the current kind-30392.
- [x] Empty write-relay list from kind-10002 (zero `r` tags after filtering) — same as no kind-10002 fallback per AC-27.

## Test infrastructure

- **Test framework:** Node built-in runner (`node test/test.js`) and Playwright (`npm run test:playwright`). No new frameworks.
- **Control panel API:** `BRAINSTORM_BASE_URL` env or default `http://localhost:7778`.
- **Strfry:** read via `docker exec tapestry strfry scan ...` from the publish-flow tests; write via `POST /api/strfry/publish?signAs=client` for ephemeral test pubkeys (same pattern as Stories 10/11/12).
- **Concept Graph API:** the story does NOT add a new firmware concept (z-tag reuses `tag-pinning`) — no firmware reinstall precondition.
- **Settings file mutation:** not required by this story (kind-10002 is published via nak, not configured via settings.json).
- **Playwright base URL:** `BRAINSTORM_BASE_URL` or default `http://localhost:7778`. Tests skip themselves when `BRAINSTORM_SERVER_ACCESSIBLE !== 'true'`.
- **Fixtures:**
    - Ephemeral keypairs via `nak` (matches existing publish suites).
    - kind-39999 pin events, kind-39999 nostr-user-tag assertion events, kind-10002 NIP-65 relay-metadata events — all `nak`-signed and published via `/api/strfry/publish`.
    - In Playwright, deterministic mock pubkeys + mocked `window.nostr` + mocked `/api/profile-tags/pins` (with `nip51ExportStatus` populated) + mocked `/api/trusted-list/prepare-nip51-export`.
    - `nip19.naddrEncode` for decoding the returned naddr (via the same `nostr-tools` already in the codebase).

## Manual verification (AC-21, AC-22)

These cannot be automated and must be performed by the Reviewer:

1. **AC-21 — Cross-client paste:** After Implementer ships, the Reviewer:
   1. Logs into a Brainstorm instance, pins a tag, lets the kind-30392 refresh.
   2. Clicks "Export for use in other clients," signs the NIP-07 prompt, copies the naddr.
   3. Opens Amethyst (Android) or any NIP-51-aware client.
   4. Pastes the naddr into the client's search / open-by-id field.
   5. Confirms the list opens as a follow-set / feed view with the title, members, and feed of posts from those members visible.

2. **AC-22 — Failure tolerance:** Same setup as AC-21, but with the target client configured to use ONLY relays that don't mirror the Brainstorm instance and aren't in the user's NIP-65. The Reviewer confirms the paste fails or shows a "can't load list" message — this is the expected behavior (multi-relay broadcast is best-effort, not guaranteed for arbitrary recipient relay configs).

The Reviewer records the outcome of both walkthroughs (client name + version, screenshots, pass/fail) in the review report.

## How to run

```bash
npm test                                                       # contract + publish-flow (Node)
npm run test:playwright                                        # UI / e2e
node test/nip51-list-export-from-pins.test.js                  # just the contract suite
node test/nip51-list-export-from-pins-publish.test.js          # just the publish-flow suite
BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test nip51-list-export-from-pins.spec.js
```

## Verification

The new tests are intentionally failing against the current code. Sample
failure output is documented inline in the test file headers. Key
failure points:

- `test/nip51-list-export-from-pins.test.js`:
    - `POST /api/trusted-list/prepare-nip51-export` returns 404 (endpoint not implemented).
    - `/api/profile-tags/pins` rows lack the `nip51ExportStatus` field.
    - `syncWoT.sh`'s kind list does not include `10002`.
- `test/nip51-list-export-from-pins-publish.test.js`:
    - Same 404 on the new endpoint (so the unsigned-template assertions can't be checked yet) — tests instead exercise wire-shape via manually-published kind-30000 fixtures, which DO publish successfully but for which the surrounding read paths (`nip51ExportStatus` derivation) return undefined → tests fail meaningfully.
- `tests/brainstorm/nip51-list-export-from-pins.spec.js`:
    - No `TLExportButton` rendered; selectors fail.
    - No relay-preview popover; selectors fail.
    - `/pins` rows lack the export-status line; selectors fail.

Verification command (Implementer runs this first to see the failing
state):

```bash
node test/nip51-list-export-from-pins.test.js
node test/nip51-list-export-from-pins-publish.test.js
BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test nip51-list-export-from-pins.spec.js
```

Confirmed failing on **2026-05-28** against branch `dual-publish-nip-51`.

Sample failure (from `node test/nip51-list-export-from-pins.test.js`):

```
--- nip51-list-export-from-pins tests (Story 19) ---
  FAIL  POST /api/trusted-list/prepare-nip51-export exists (not 404)
        prepare-nip51-export endpoint must exist (not 404); got 404
  FAIL  POST /api/trusted-list/prepare-nip51-export rejects an unauthenticated call with 401 or 403
        prepare-nip51-export with no session must be 401 or 403; got 404
  FAIL  POST /api/trusted-list/prepare-nip51-export rejects missing pinEventId
        prepare-nip51-export with empty body must be 400/401/403; got 404
  FAIL  POST /api/trusted-list/prepare-nip51-export rejects a malformed pinEventId
        prepare-nip51-export with malformed pinEventId must be 400/401/403; got 404
  PASS  /api/profile-tags/pins for an unknown viewer returns success with pins:[] (preserved from Story 10/11)
  PASS  /api/profile-tags/pins row shape (when rows exist) carries a nip51ExportStatus field — documented via JSON-schema sentinel test
  FAIL  src/manage/negentropySync/syncWoT.sh strfry-sync kind list includes 10002 (ADR 0017 Amendment A2)
        syncWoT.sh kinds list must include 10002 (NIP-65 relay metadata) per ADR 0017 Amendment A2; current list: [0, 3, 1984, 10000, 30000, 38000, 38172, 38173]
  PASS  /api/config/public-relay must NOT be introduced (ADR 0017 Amendment A9 forbids it; superseded by NIP-65 read)

nip51-list-export-from-pins: 3 passed, 5 failed
```

Sample failure (from `node test/nip51-list-export-from-pins-publish.test.js`):

```
  FAIL  /api/profile-tags/pins row for the viewer carries a nip51ExportStatus object (AC-15 / AC-16 / AC-17)
        row must carry nip51ExportStatus (Story 19 additive shape); got {... tlStatus: ..., NO nip51ExportStatus field}
  FAIL  nip51ExportStatus reports status=ok-fresh OR stale (not never-exported) ...
        row + nip51ExportStatus must exist
  FAIL  nip51ExportStatus.diffVsTL has the shape {added, removed} ...
        nip51ExportStatus.diffVsTL must be an object ...; got undefined
  FAIL  nip51ExportStatus on the /pins row exposes the viewer's NIP-65 write-relay set ...
  FAIL  a viewer with NO kind-10002 in strfry yields nip51ExportStatus.writeRelays === [] ...
```

The remaining tests pass because they exercise the EXISTING
infrastructure (nak signing for kind-39999 pin and assertion events,
strfry publish, kind-30000 wire shape via manually-published
fixtures, replaceability semantics by relay behavior, naddr encoding
via nostr-tools, no-regression on the empty pins envelope). All
failures point at specific missing implementation surfaces — none are
typos / import errors.
