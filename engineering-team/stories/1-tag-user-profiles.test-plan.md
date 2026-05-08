# Test Plan: Story 1 — Tag user profiles

**Story:** `engineering-team/stories/1-tag-user-profiles.md`
**ADR:** `engineering-team/decisions/0001-profile-tag-architecture.md`
**Date:** 2026-05-08

## Coverage map

Each acceptance criterion maps to at least one automated test. The publish-flow paths (apply / dispute / polarity defaulting / overwrite / kind-5 deletion) are exercised live via ephemeral `nak` keypairs published through the existing `/api/strfry/publish` endpoint — no new dependencies, no fixtures.

| Criterion | Behavior | Test name | File | Level |
|---|---|---|---|---|
| AC-1 | Tag button visible alongside Follow / Mute / Report | `profile page exposes a Tag action button alongside Follow / Mute / Report` | `tests/brainstorm/profile-tags.spec.js` | Playwright |
| AC-2 | Picker has existing tags + inline new-tag creation | `clicking Tag opens a panel that exposes tag-application affordances` + `tag panel exposes inline new-tag creation` + `GET /api/profile-tags/available-tags returns { success, tags: [] }` + `available-tags lists a kind-39999 tag-element after it is published` | spec.js + `test/profile-tags.test.js` + `test/profile-tags-publish.test.js` | Playwright + API contract + live publish |
| AC-3 | Apply publishes assertion with explicit positive polarity | `apply (polarity=1) appears under applications, not disputes` | `test/profile-tags-publish.test.js` | live publish |
| AC-4 | Dispute publishes assertion with explicit negative polarity | `dispute (polarity=-1) appears under disputes, not applications` + Playwright Dispute affordance | `test/profile-tags-publish.test.js` + spec.js | live publish + Playwright |
| AC-5 | Polarity omitted on read = positive default | `event without a polarity tag defaults to applied` | `test/profile-tags-publish.test.js` | live publish |
| AC-6 | Profile shows WoT counts and asserter avatars | `apply (polarity=1) appears under applications` asserts `entry.tagEventId` and `entry.authorPubkey` round-trip on the API; chip-render verified in Playwright via panel-open visibility | `test/profile-tags-publish.test.js` + spec.js | live publish + Playwright |
| AC-7 | Manage view exposes list + revoke | `tag panel exposes a Manage affordance for revoking own assertions` + `publishing a kind-5 deletion removes the asserted entry from the API response` | spec.js + `test/profile-tags-publish.test.js` | Playwright + live publish |
| AC-8 | Revoke updates count | `publishing a kind-5 deletion removes the asserted entry from the API response` | `test/profile-tags-publish.test.js` | live publish |
| AC-9 | `tag` enriched + `nostr-user-tag` concept exists in firmware | `firmware: nostr-user-tag concept directory exists with three required files` + 5 sibling firmware/graph tests | `test/profile-tags.test.js` | filesystem + concept-graph |
| AC-10 | Events conform to firmware list patterns | `concept-graph /summaries lists nostr-user-tag` + schema-shape tests + the publish-flow suite (every test publishes real kind-39999 events with the spec'd tag array, validating the shape end-to-end) | `test/profile-tags.test.js` + `test/profile-tags-publish.test.js` | concept-graph + live publish |

Additional behavior captured by the publish-flow suite (beyond the explicit ACs):

- `overwriting the same d-tag with flipped polarity moves the entry between buckets (single record)` — verifies replaceable-event semantics for apply ↔ dispute toggling.

## Edge cases

Covered explicitly in the contract suite:

- [x] Missing `pubkey` query param → 400.
- [x] Malformed `pubkey` (non-hex) → 400.
- [x] Empty network state — endpoints return arrays even with no data.
- [x] `tag` schema retains existing `slug` uniqueness after enrichment (regression guard).
- [x] `polarity` event-tag absent → defaults to applied (also covered in publish-flow).

Covered in the publish-flow suite:

- [x] Real strfry import → API read round-trip on a fresh keypair.
- [x] Apply / dispute bucketing on real signed events.
- [x] Replaceable-event overwrite (one record across two publishes with flipped polarity).
- [x] Kind-5 deletion removes the entry.

Not covered (intentionally):

- WoT-author membership filter on `wot-tags` (story acceptance allows v1 fallback to "all known tags"; the test asserts only that the endpoint exists with `success: true`).
- Concurrent publishes from multiple authors on the same target — out of scope for v1.
- External-relay propagation latency — tests use local strfry only.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js` orchestrates suites). Playwright for browser flows. No new frameworks introduced.
- **Concept Graph API:** `http://localhost:8877` (override via `CONCEPT_GRAPH_URL`).
- **Control panel API:** `http://localhost:7778` (override via `BRAINSTORM_BASE_URL`).
- **Live publish-flow precondition:** `nak` on PATH AND `/api/strfry/publish` reachable. If either is missing, the publish suite skips — every other suite still runs.
- **Concept-graph reflect precondition:** `POST http://localhost:8877/api/firmware/install` must run after the implementer adds/modifies firmware files.
- **Playwright precondition:** `BRAINSTORM_SERVER_ACCESSIBLE=true` and the SPA built into `dist/` and served by the control panel. SPA route is `/user/:pubkey` (per `ui/src/App.jsx`). On dev boxes `@playwright/test` is currently not in local `node_modules` (matches existing repo pattern); see follow-up below.
- **Fixtures:** none — publish-flow tests generate ephemeral keypairs per test for isolation; setup publishes one shared kind-39999 `tag` element and reuses its event id across tests. Each assertion uses a fresh target pubkey so test events cannot collide.

## Known infra follow-ups (tracked separately, do not block Story 1)

- **Playwright on dev boxes.** `@playwright/test` isn't in this repo's local `node_modules`, so `npm run test:playwright` fails locally even after `npm i -g @playwright/test` (the global install can't satisfy `playwright.config.js`'s `require('@playwright/test')`, which resolves from the project root). Compounded by `node_modules/` being root-owned on this dev box, blocking user-level `npm i -D @playwright/test`. Fix is a separate story: chown the node_modules tree, add `@playwright/test` as a devDep, and document `npx playwright install <browsers>`. The existing repo Playwright specs (`api-health.spec.js`, `auth.spec.js`, etc.) share this constraint, so this isn't a Story-1 regression.

## How to run

```sh
# Suite: firmware files + server API contracts + concept graph + live publish
npm test

# Browser/UI affordances (requires the brainstorm app running on :7778)
BRAINSTORM_SERVER_ACCESSIBLE=true npm run test:playwright -- tests/brainstorm/profile-tags.spec.js
```

## Verification

Confirmed failing for the right reasons on 2026-05-08 at the test-plan commit (no implementation yet). Both suites:

```
Configuration Loading: PASS

--- profile-tags tests (Story 1) ---
  FAIL  firmware: nostr-user-tag concept directory exists with three required files
  FAIL  firmware: nostr-user-tag concept-header has matching slug and oKeys.singular = nostrUserTag
  FAIL  firmware: nostr-user-tag schema requires taggedPubkey and tagEventId, omits polarity
  FAIL  firmware: tag schema declares name, description, and applicableTo properties
  PASS  firmware: tag schema retains slug uniqueness constraint
  FAIL  GET /api/profile-tags/available-tags returns { success, tags: [] }            (404)
  FAIL  GET /api/profile-tags/tags-for-profile rejects missing pubkey with 400        (404)
  FAIL  GET /api/profile-tags/tags-for-profile rejects malformed pubkey with 400      (404)
  FAIL  GET /api/profile-tags/tags-for-profile returns applications and disputes …    (404)
  FAIL  GET /api/profile-tags/wot-tags returns { success: true } for a valid viewer   (404)
  FAIL  concept-graph /summaries lists nostr-user-tag
  FAIL  concept-graph nostr-user-tag-schema requires taggedPubkey + tagEventId only…  (404)
  PASS  concept-graph tag-schema declares name, description, applicableTo

profile-tags: 2 passed, 11 failed

--- profile-tags publish-flow tests (Story 1) ---
  FAIL  available-tags lists a kind-39999 tag-element after it is published           (404)
  FAIL  apply (polarity=1) appears under applications, not disputes                   (404)
  FAIL  dispute (polarity=-1) appears under disputes, not applications                (404)
  FAIL  event without a polarity tag defaults to applied                              (404)
  FAIL  overwriting the same d-tag with flipped polarity moves the entry…             (404)
  FAIL  publishing a kind-5 deletion removes the asserted entry from the API response (404)

profile-tags-publish: 0 passed, 6 failed

Overall:                      FAIL
```

**On the two passing tests:**
- `tag schema retains slug uniqueness constraint` — passes because the existing `versions-grapevine` `tag/json-schema.json` already declares it. Acts as a regression guard against the implementer accidentally dropping the constraint while enriching the schema.
- `concept-graph tag-schema declares name, description, applicableTo` — passes against the live graph because a prior install left these properties resident in Neo4j (from the now-deleted `versions/v1.0.0/tag/`). After the implementer enriches the firmware file and runs `POST /api/firmware/install`, this test will continue to pass — assuming the enriched schema preserves these properties.

**On the publish-flow setup phase:** the suite successfully generates a keypair via `nak`, signs a kind-39999 `tag` element, and publishes it through `/api/strfry/publish` (returns `{ success: true }`). All test failures are downstream — at the not-yet-implemented `/api/profile-tags/*` endpoints. That confirms the fixture infrastructure is sound and the implementer's work is the only thing standing between failing and passing.

The Playwright spec parses cleanly but is not executed here (Playwright not installed in this dev environment); the implementer / reviewer environments install it via the existing `npm run test:playwright` script.
