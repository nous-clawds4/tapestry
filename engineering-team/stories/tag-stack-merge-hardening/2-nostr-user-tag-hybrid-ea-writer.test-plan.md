# Test Plan: Story 2 (tag-stack-merge-hardening) — nostr-user-tag hybrid e+a writer

**Story:** `engineering-team/stories/tag-stack-merge-hardening/2-nostr-user-tag-hybrid-ea-writer.md`
**ADR:** `engineering-team/decisions/tag-stack-merge-hardening/0002-nostr-user-tag-hybrid-ea-writer.md` (under governing ADR-0022)
**Date:** 2026-06-12

All tests live in `test/nostr-user-tag-hybrid-ea-writer.test.js`, registered in `test/test.js` (default `npm test` gate).

## Coverage map

| Criterion | Test name | Level |
|---|---|---|
| AC-1 (hybrid wire shape) | `AC-1a: writer emits an \`a\` coordinate built from the tag author pubkey + slug` + `AC-1b: writer RETAINS the \`e\` event-id reference` + `AC-1c: writer leaves d/p/z/polarity unchanged` | source-contract |
| AC-2 (content mirror) | `AC-2: content mirror includes tagAddress alongside taggedPubkey + tagEventId` | source-contract |
| AC-3 (author at apply time / refuse) | `AC-3a: writer refuses to publish when the tag author pubkey is missing/invalid` + `AC-3b: createTag returns the author pubkey` | source-contract |
| AC-4 (legacy #e reads unbroken) | `AC-4a: the retained \`e\` tag keeps new assertions matchable by #e` + `AC-4b: read path still scans assertions by #e` | source-contract |
| AC-5 (schema accepts both) | `AC-5a: schema declares an optional tagAddress property` + `AC-5b: tagAddress OPTIONAL, tagEventId REQUIRED` | behavioral-unit (JSON parse) |
| AC-6 (firmware reinstall noted) | — operational; verified at cycle-local (see below). AC-5 pins the schema change that necessitates it. | manual |

## Test levels — why this mix

- **Source-contract (regex)** for the writer (`ui/src/utils/publishProfileTag.js`) and the `createTag` return (`ui/src/hooks/useProfileTags.js`): both are ESM and not `require()`-able from the CJS runner (same constraint Story 1 hit with the UI utils). Each regex pins the exact change ADR-0002 prescribes and is written to match intent, not exact wording.
- **Behavioral-unit (JSON parse)** for the firmware schema: load `firmware/active/concepts/nostr-user-tag/json-schema.json` and assert the `tagAddress` shape at `jsonSchema.properties.nostrUserTag`. A full JSON-Schema *validation* (ajv-style) is deliberately avoided — it would need a validator dependency, which is out of bounds without an ADR. The required/optional structural assertion is the contract that matters.

## Pre-implementation pass/fail map (confirmed at commit 8506f504)

**Failing (5) — the implementation contract:** AC-1a (`a` coord), AC-2 (tagAddress mirror), AC-3a (refuse-on-missing throw), AC-3b (createTag returns authorPubkey), AC-5a (schema gains tagAddress).
**Passing (5) — regression pins:** AC-1b (`e` retained), AC-1c (d/p/z/polarity unchanged), AC-4a (`e` retained = #e-matchable), AC-4b (reads still scan #e), AC-5b (tagAddress not in `required`). These guard against the implementer over-reaching — dropping `e`, switching reads to `#a`, or making `tagAddress` required would each flip a pin red.

## Edge cases covered

- AC-1b/AC-4a explicitly lock the *retention* of `e` — the hybrid must be additive, never a replacement (the whole point vs. ADR-0022 Option B).
- AC-3a locks the **refuse** policy (ADR-0002 Option A) — not a silent e-only fallback, which would defeat the story.
- AC-5b locks **backward compatibility**: `tagEventId` stays required and `tagAddress` stays optional, so legacy `e`-only assertions still validate.

## Deliberately left to live verification during Implementation (cycle-local)

- **AC-6 (firmware reinstall):** run `POST /api/firmware/install` after the schema change and confirm the concept graph reflects the new `tagAddress` field (e.g. via `/api/concept-graph/node/<nostr-user-tag-schema handle>`). Operational, not CI-deterministic.
- **End-to-end wire check:** apply a tag in the browser and confirm the published kind-39999 carries both `a` and `e` (and `tagAddress` in content) — the source-contract proves the code shape; the live apply proves it threads `authorPubkey` correctly from each surface (the ADR notes the refuse-throw now depends on that field being populated).

## How to run

```
node test/nostr-user-tag-hybrid-ea-writer.test.js   # suite alone
npm test                                             # full gate
```

## Verification

The new tests fail with the current code. Confirmed 2026-06-12 at commit `8506f504`:

```
--- nostr-user-tag hybrid e+a writer (epic tag-stack-merge-hardening, Story 2) ---
  FAIL  AC-1a: writer emits an `a` coordinate built from the tag author pubkey + slug
  PASS  AC-1b: writer RETAINS the `e` event-id reference (provenance)
  PASS  AC-1c: writer leaves d / p / z / polarity tags unchanged
  FAIL  AC-2: content mirror includes tagAddress alongside taggedPubkey + tagEventId
  FAIL  AC-3a: writer refuses to publish when the tag author pubkey is missing/invalid
  FAIL  AC-3b: createTag returns the author pubkey so create-then-apply supplies the coord
  PASS  AC-4a: the retained `e` tag keeps new assertions matchable by existing #e scans
  PASS  AC-4b: read path still scans assertions by #e (not switched to #a)
  FAIL  AC-5a: firmware nostr-user-tag schema declares an optional tagAddress property
  PASS  AC-5b: tagAddress is OPTIONAL; tagEventId stays REQUIRED (legacy e-only still validates)

nostr-user-tag-hybrid-ea-writer: 5 passed, 5 failed
```
