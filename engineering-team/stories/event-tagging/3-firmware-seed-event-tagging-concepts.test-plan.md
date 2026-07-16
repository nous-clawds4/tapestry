# Test Plan: Story 3 — Seed event-tagging DList concepts in firmware

**Story:** `engineering-team/stories/event-tagging/3-firmware-seed-event-tagging-concepts.md`
**ADR:** `engineering-team/decisions/event-tagging/0003-firmware-seed-event-tagging-concepts.md`
**Date:** 2026-06-29

## Approach

One CJS suite — `test/event-tagging-firmware-seed.test.js` — wired into `test/test.js`, in the house style for firmware/concept stories (precedent: `header-conceptgraph-tag`, `b-tag-seeds`). Three layers:

1. **Filesystem (deterministic, drives the red phase).** Parse the new concept files + `versions/v1.0.0/manifest.json` and assert structure: the two dirs + three files each; wire-critical slugs; `communityReference` → canonical pubkey; `tagging-with-specific-tag` declares the literal `headerTags`.
2. **Source-contract (deterministic).** Assert `handleCreateConcept` (`src/api/normalize/index.js`) emits a concept's declared extra header tags onto the kind-39998 header, plus a regression guard that the existing fixed header-tag builder is preserved.
3. **Live (skip-gated; the authoritative post-reinstall proof).** Against the running stack: both handles resolve at `:8877`, and the **published** `tagging-with-specific-tag` kind-39998 header (fetched via `/api/strfry/scan`) carries literal `["recommended","a"]`/`["allowed","e"]`. These **SKIP** when the API is unreachable or the concepts aren't seeded yet (the `POST /api/firmware/install` precondition isn't met) — matching the concept-graph-layer precedent in `profile-tags.test.js`.

**Reinstall precondition.** The live layer requires the concepts to be seeded, i.e. the Implementer must run **`POST /api/firmware/install`** after adding the firmware files. Until then the live tests skip; after a reinstall they must turn **green (not skip)** — the Reviewer treats that as required (same posture as `header-conceptgraph-tag`'s cycle-local smoke).

**Canonical pubkey** (federation anchor, == local dev TA): `82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833`.

## Coverage map

| Criterion | Test name | File | Level |
|---|---|---|---|
| AC: `nostr-event-tag` seeded / AC: slugs match | `FS: nostr-event-tag concept dir + 3 files; header oNames` | firmware-seed | filesystem |
| AC: `tagging-with-specific-tag` seeded | `FS: tagging-with-specific-tag concept dir + 3 files; header oNames` | firmware-seed | filesystem |
| AC: a fresh install includes them / wire-critical slugs | `FS: manifest registers both with exact slugs + dir/conceptHeader/jsonSchema` | firmware-seed | filesystem |
| AC: the concepts federate | `FS: both manifest entries communityReference.headerATag → canonical pubkey + relayHints` | firmware-seed | filesystem |
| AC: member-reference rule on the wire (declared) | `FS: tagging-with-specific-tag declares headerTags [["recommended","a"],["allowed","e"]]` | firmware-seed | filesystem |
| AC: existing concepts unaffected | `FS: manifest still registers nostr-user-tag + tag (no removal)` | firmware-seed | filesystem (regression) |
| AC: member-reference rule on the wire (emitted) | `SC: handleCreateConcept spreads a concept's declared extra header tags onto the 39998 header` | firmware-seed | source-contract |
| (seam regression) | `SC: existing fixed header-tag builder preserved (d/names/json)` | firmware-seed | source-contract (regression) |
| AC: `nostr-event-tag` in the graph / AC: `tagging-with-specific-tag` in the graph | `LIVE: both handles resolve at :8877 (skip if precondition unmet)` | firmware-seed | live |
| AC: member-reference rule on the wire (published) | `LIVE: published tagging-with-specific-tag header carries literal recommended/allowed (skip if unmet)` | firmware-seed | live |
| AC: existing concepts unaffected (live) | `LIVE: nostr-user-tag still resolves at :8877 (skip if unreachable)` | firmware-seed | live (regression) |
| AC: authored by the deployment's own TA | (covered by LIVE handle resolution — handles are composed under the runtime TA `:8877` returns) | firmware-seed | live |

## Edge cases
- [ ] The manifest `slug` is exactly `nostr-event-tag` / `tagging-with-specific-tag` — **not** the `oNames`-derived `nostr-event-tagging` (wire-critical; the Story-1 core composes `z` handles from it).
- [ ] `headerTags` contains **both** pairs (`recommended`/`a` AND `allowed`/`e`), order-insensitive.
- [ ] `communityReference.headerATag` carries the **canonical** pubkey (not a per-deployment runtime value), proving federation, not an island.
- [ ] Live tests **skip** (don't fail) when `:8877`/`:7778` are down, so the aggregate `node test/test.js` isn't environmentally red.
- [ ] Source-contract uses the ADR's suggested `headerTags` field convention; if the Implementer picks a different field name, the sentinel updates with it.

## Test infrastructure
- Runner: `node test/test.js`. No new framework, no build.
- **Live layer needs the running stack** (dev mode, `:8877` concept-graph + `:7778` control panel/strfry-scan) **and a firmware reinstall** (`POST /api/firmware/install`) after the files land. Skips cleanly otherwise.
- To be created by the Implementer: `firmware/versions/v1.0.0/concepts/{nostr-event-tag,tagging-with-specific-tag}/` (3 files each), two registrations in `versions/v1.0.0/manifest.json`, and the `handleCreateConcept` seam extension in `src/api/normalize/index.js`.

## How to run
```
npm test
# then, for the live layer, after adding the firmware files:
curl -s -X POST localhost:7778/api/firmware/install   # reinstall (AGENTS.md §6)
npm test                                              # live tests now green, not skipped
```

## Verification
Deterministic (filesystem + source-contract) tests fail with current code (files + seam absent); live tests skip (concepts not seeded). Captured at red-phase commit. **Reviewer-required:** after a reinstall the live tests must be PASS, not SKIP.
