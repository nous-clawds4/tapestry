# Test Plan: Story 10 — Pin a tag (foundational)

**Story:** `engineering-team/stories/10-pin-a-tag.md`
**ADR:** `engineering-team/decisions/0009-pin-a-tag.md`
**Date:** 2026-05-18

## Coverage map

Each acceptance criterion maps to at least one test. Edge cases (kind-5
deletion, missing-tag-event filtering, malformed inputs, wire-shape contract)
get their own tests.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (pin-state on tag detail page) | `tag detail page renders Pin button when viewer is unpinned and Unpin button when pinned` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-1 (server contract) | `by-id with viewerPubkey returns viewerPin: null when no pin exists` | `test/pin-a-tag.test.js` | integration |
| AC-1 (server publish flow) | `by-id with viewerPubkey returns viewerPin object after publishing a pin event for this viewer` | `test/pin-a-tag-publish.test.js` | integration |
| AC-2 (pin click → kind-39999 publish) | `clicking Pin publishes a kind-39999 tag-pinning event with the correct wire shape` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-2 (pin event landed on local strfry) | `publishing a Pin event populates by-id's viewerPin field with the pin event id, createdAt, and default curationMethod` | `test/pin-a-tag-publish.test.js` | integration |
| AC-2 (default curation-method content) | `Pin event publishes default curation-method tag with observer=viewer, method=nip85:rank, cutoff=2, includeScoreInTL=false` | `test/pin-a-tag-publish.test.js` | integration |
| AC-3 (unpin → retraction) | `clicking Unpin publishes a kind-5 deletion targeting the prior pin event id` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-3 (unpin server effect) | `publishing a kind-5 deletion for the pin event clears by-id viewerPin back to null` | `test/pin-a-tag-publish.test.js` | integration |
| AC-3 (UI flip in place) | `Pin button text/state flips between Pin and Unpin in place after publish` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-4 (link to /pins from tag page) | `tag detail page renders a link to /pins when viewer is NIP-07 authenticated` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-5 (/pins list rows) | `/pins page lists one row per pinned tag with the tag name, description, and a link to its detail page` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-5 (server: list endpoint shape) | `/api/profile-tags/pins returns success: true and an empty pins array for a viewer with no pins` | `test/pin-a-tag.test.js` | integration |
| AC-5 (server: list endpoint populated) | `/api/profile-tags/pins joins pinned tag event ids to live tag metadata and returns rows sorted by createdAt desc` | `test/pin-a-tag-publish.test.js` | integration |
| AC-5 (dangling pins filtered) | `/api/profile-tags/pins filters out pin events whose referenced tag event no longer exists` | `test/pin-a-tag-publish.test.js` | integration |
| AC-6 (settings link to /pins) | `Settings page exposes a link to /pins` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-7 (logged-out tag page parity) | `logged-out tag detail page renders no Pin affordance and no /pins link` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-8 (logged-out /pins empty state) | `logged-out /pins page renders a sign-in empty state and no pin rows` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-9 (publish-failure surface) | `Pin publish failure surfaces an inline error on the tag detail page` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |
| AC-9 (unpin publish-failure surface) | `Unpin publish failure surfaces an inline error on the tag detail page` | `tests/brainstorm/pin-a-tag.spec.js` | e2e |

### Cross-cutting contract tests (server)

| Behavior | Test name | Test file | Level |
|---|---|---|---|
| Endpoint shape: by-id with viewerPubkey accepts the param without breaking existing contract | `by-id with viewerPubkey is accepted and existing fields are preserved` | `test/pin-a-tag.test.js` | integration |
| Endpoint shape: by-id with malformed viewerPubkey treats it as absent (no 400) | `by-id silently ignores a malformed viewerPubkey (no 400)` | `test/pin-a-tag.test.js` | integration |
| Endpoint shape: /api/profile-tags/pins rejects missing viewerPubkey | `pins endpoint rejects missing viewerPubkey with 400` | `test/pin-a-tag.test.js` | integration |
| Endpoint shape: /api/profile-tags/pins rejects malformed viewerPubkey | `pins endpoint rejects malformed viewerPubkey with 400` | `test/pin-a-tag.test.js` | integration |
| Endpoint shape: /api/profile-tags/pins documented response shape | `pins endpoint returns the documented response envelope (success, pins[])` | `test/pin-a-tag.test.js` | integration |
| Firmware concept registered | `firmware install-status reports the tag-pinning slug` | `test/pin-a-tag.test.js` | integration |
| Concept graph registers tag-pinning node | `concept-graph exposes the tag-pinning ConceptHeader node` | `test/pin-a-tag.test.js` | integration |

## Edge cases

- [x] Malformed `viewerPubkey` to `by-id` → treated as absent (no 400, no `viewerPin`).
- [x] Missing / malformed `viewerPubkey` to `/api/profile-tags/pins` → 400.
- [x] Viewer with no pins → `/pins` returns `pins: []`, `/pins` page shows empty state.
- [x] Pin event whose referenced tag event no longer exists in strfry → filtered out of `/api/profile-tags/pins` (dangling pin).
- [x] Kind-5 deletion of a pin event → `viewerPin` reverts to null; `/pins` no longer lists it.
- [x] Publish failure on every relay (local strfry + external) → inline error surface; UI button does not flip state.
- [x] Logged-out user on tag detail page → no Pin affordance, no `/pins` link (AC-7).
- [x] Logged-out user navigates directly to `/pins` → sign-in empty state (AC-8).
- [x] Firmware install-status must include `tag-pinning` after the new concept is installed.

## Test infrastructure

- **Test framework:** Node built-in runner (`node test/test.js`) and Playwright (`npm run test:playwright`).
- **Control panel API:** `BRAINSTORM_BASE_URL` env or default `http://localhost:7778`.
- **Concept Graph API:** same base URL (`/api/concept-graph/*`).
- **Meili:** `MEILI_URL_HOST` env or default `http://localhost:7700` (only the publish-flow suite uses it; it gracefully skips when `nak` is missing or the control panel is unreachable).
- **Firmware state:** the firmware-status / concept-graph existence tests **require** that the `tag-pinning` concept has been added to `firmware/active/concepts/` and `manifest.json`, **and** that `POST /api/firmware/install` has been run. Until those preconditions are satisfied they fail meaningfully ("missing tag-pinning slug in installedSlugs"). The publish-flow suite likewise expects the concept to be installed so that strfry filters resolve the z-tag correctly.
- **Playwright base URL:** `BRAINSTORM_BASE_URL` or default `http://localhost:7778`. Tests skip themselves when `BRAINSTORM_SERVER_ACCESSIBLE !== 'true'` (matches the project's existing playwright convention).
- **Fixtures:**
  - Ephemeral keypairs via `nak` (matches `test/profile-tags-publish.test.js` / `test/tag-detail-write-publish.test.js`).
  - In Playwright, deterministic mock pubkeys (`'1'.repeat(64)` etc.) and mocked `window.nostr` (matches `tests/brainstorm/tag-detail-write.spec.js`).

## How to run

```bash
npm test                           # contract + publish-flow suites
npm run test:playwright             # UI / e2e suites
```

Run only the Story-10 suites:

```bash
node test/pin-a-tag.test.js
node test/pin-a-tag-publish.test.js
BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test pin-a-tag.spec.js
```

## Verification

The new tests fail with the current code (no `viewerPin` on `by-id`, no `/api/profile-tags/pins` endpoint, no `tag-pinning` firmware concept, no Pin button on the tag detail page, no `/pins` route).

Confirmed failing on **2026-05-18**.

Sample failure (from `node test/pin-a-tag.test.js`):

```
--- pin-a-tag tests (Story 10) ---
  FAIL  GET /api/profile-tags/pins rejects missing viewerPubkey with 400
        pins endpoint status — got 404, expected 400
  FAIL  GET /api/profile-tags/pins returns the documented envelope for a viewer with no pins
        pins endpoint status — got 404, expected 200
  FAIL  GET /api/profile-tags/by-id with viewerPubkey returns viewerPin: null when no pin exists
        viewerPin field missing on response — got {"success":true,"tag":{...},"author":null}
  FAIL  firmware install-status reports the tag-pinning slug
        installedSlugs does not include "tag-pinning" — got ["node-type","superset","set",...]
  FAIL  concept-graph exposes the tag-pinning ConceptHeader node
        concept-graph node lookup returned 404 for handle 39998:<TA>:tag-pinning

pin-a-tag: 0 passed, 7 failed
```

(Full output is reproduced in the implementation phase's commit; this snippet
captures the failure shape: missing endpoints, missing fields, missing firmware
slug, missing graph node — exactly the gaps Implementation must close.)
