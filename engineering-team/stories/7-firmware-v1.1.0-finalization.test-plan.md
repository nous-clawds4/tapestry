# Test Plan: Story 7 — Firmware v1.1.0 finalization

**Story:** `engineering-team/stories/7-firmware-v1.1.0-finalization.md`
**ADR:** `engineering-team/decisions/0005-firmware-v1.1.0-finalization.md`
**Date:** 2026-05-14

## Approach

Slice 1 is **manifest plumbing + symlink flip**. Every acceptance criterion is testable by reading firmware JSON files from disk and asserting their shape. Same hand-rolled Node test pattern used by stories #4 / #5 / #6. No new test infrastructure.

The load-bearing test is the **drift protection** check: load both `firmware/versions/v1.0.0/manifest.json` and `firmware/versions/v1.1.0/manifest.json`, and assert deep-equality on the 5 top-level entries that the ADR says must not diverge (`enumerations`, `elements`, `sets`, `relationshipTypes`, plus the two pre-existing changelog entries). This single test catches the bulk of the "did the hand-copy land correctly" risk and protects against future drift if v1.0.0 receives a patch.

Live install verification (the actual `POST /api/firmware/install` against a running instance) is deferred to staging smoke per ADR §"No firmware reinstall verified live." Verification path documented in the "Not covered" section below.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC: top-level keys match v1.0.0 | T1 `v1.1.0 manifest has the same 9 top-level keys as v1.0.0` | `test/firmware-v1.1.0-finalization.test.js` | unit (file read) |
| AC: concepts list contains all v1.0.0 slugs + 2 new | T2 `v1.1.0 concepts list is v1.0.0's concepts + brainstorm-community + brainstorm-community-signal` | same | unit |
| AC: enumerations / elements / sets / relationshipTypes deep-equal | T3 `v1.1.0 enumerations / elements / sets / relationshipTypes are deep-equal to v1.0.0 (drift protection)` | same | unit |
| AC: changelog 3 entries, newest-first, v1.1.0 first | T4 `v1.1.0 changelog has 3 entries with v1.1.0 first and the two v1.0.0 entries preserved` | same | unit |
| AC: version 1.1.0 + date 2026-05-14 | T5 `v1.1.0 manifest has version "1.1.0" and date "2026-05-14"` | same | unit |
| AC: no SKELETON markers anywhere under v1.1.0 | T6 `no SKELETON / NOT YET DEPLOYABLE markers anywhere under firmware/versions/v1.1.0` | same | unit (recursive file scan) |
| AC: nip72Wrapping optional property | T7 `brainstorm-community json-schema has optional nip72Wrapping property` | same | unit |
| AC: all PLAN.md §3 required fields preserved | T8 `brainstorm-community json-schema required array has slug/name/description/relays/seedMembers/weightingModel/endorsementThreshold` | same | unit |
| AC: brainstorm-community-signal schema preserved | T9 `brainstorm-community-signal schema has targetPubkey + communityATag required, plus type/role/comments optional` | same | unit |
| AC: firmware/active flipped | T10 `firmware/active symlink resolves to versions/v1.1.0` | same | unit (fs.readlinkSync) |
| AC: v1.0.0 directory untouched | T11 `firmware/versions/v1.0.0 manifest still has its original v1.0.0 contents (33 + 1 concepts, 2 changelog entries)` | same | unit (regression sentinel) |
| AC: JSON validity | All tests above implicitly cover this — `JSON.parse` runs on every file read. T1's "load both" fails meaningfully on invalid JSON. | same | unit |
| AC: coreMemberOf linkage | T12 `each new concept json-schema has a coreMemberOf entry whose slug matches the corresponding concept-header word.slug` | same | unit |
| AC: per-concept manifest.json shape | T13 `each new concept directory contains a manifest.json with the { HAS_ELEMENT, IS_A_SUPERSET_OF } shape` | same | unit |
| AC: PLAN.md §5 status updated | T14 `PLAN.md §5 Skeleton status paragraph carries the 2026-05-14 finalized note` | same | unit (file grep) |
| AC: live install succeeds + concept-graph surfaces both new entries | manual staging smoke after deploy | n/a | manual |

## Edge cases

- [x] **v1.0.0 changelog patched later** → T3 deep-equality on `changelog[1:]` (the post-v1.1.0 slice of the changelog) flips to FAIL if a v1.0.0 entry is altered without mirroring into v1.1.0.
- [x] **Symlink is a regular file or directory instead of a symlink** → T10 uses `fs.lstatSync` to assert it's a symlink, then `fs.readlinkSync` for the target.
- [x] **nip72Wrapping mistakenly added to `required`** → T7 asserts both presence in `properties` AND absence from the `required` array.
- [x] **Concepts list contains duplicate slugs after the merge** → T2 asserts the set length equals 34 + 2 (no duplicates), in addition to membership.
- [x] **JSON Schema describes the wrong shape** (e.g. weightingModel is missing) → T8 explicitly checks the 7 required fields by name.
- [x] **Forward references to PLAN.md / COMMUNITY_ENDORSEMENTS_DLIST.md** are *not* false positives for the SKELETON marker scan → T6 regex is strict to `/SKELETON|NOT YET DEPLOYABLE|not yet deployable/i`, not anything PLAN-related.

## Not covered (intentional)

- **Live `POST /api/firmware/install` succeeds.** Requires running Tapestry instance. Deferred to staging smoke:
  ```bash
  # After staging deploys feat/communities:
  curl -X POST https://communities.brainstorm.world/api/firmware/install
  curl -s https://communities.brainstorm.world/api/concept-graph/summaries \
    | jq '.[] | select(.handle | test("brainstorm-community"))'
  # Expect: 2 entries, one for brainstorm-community, one for brainstorm-community-signal
  ```
- **Neo4j nodes created with correct labels.** Same staging smoke; verify via `/api/concept-graph/node/<handle>/neighbors` showing the expected core nodes wired up.
- **The schemas actually validate sample community-record / signal-item events.** Not in scope for Slice 1 — this becomes a Slice 4 acceptance criterion when endorsement events start getting published.
- **All 34 v1.0.0 concepts still install cleanly under the new manifest order.** The ADR explicitly preserves v1.0.0 concept order in the merged list, but the install pipeline's tolerance for order changes is not exercised by this test suite. If a future v1.x manifest reorders, that's the time for a Cypher-level installation test.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js`). Registered alongside the existing 5 suites.
- **No Playwright** — no browser-observable change.
- **No new dependencies** — `fs`, `path`, and `JSON.parse` are sufficient. Deep-equality is via `assert.deepStrictEqual` (Node built-in, already used by other test suites if any).
- **Fixtures:** none. Tests `fs.readFileSync` the two manifest files + walk `firmware/versions/v1.1.0/` recursively for the SKELETON-marker scan.

## How to run

```bash
npm test
```

Manual staging smoke (after deploy):

```bash
# Pre-condition: communities.brainstorm.world droplet provisioned + this branch deployed
curl -X POST https://communities.brainstorm.world/api/firmware/install
curl -s https://communities.brainstorm.world/api/concept-graph/summaries | jq '[.[] | .handle] | map(select(test("brainstorm-community")))'
```

## Verification

Tests fail with the current code (v1.1.0 manifest still skeleton, symlink still at v1.0.0). Confirmed-failing on commit `7596d57d`:

```
$ npm test
...
firmware-v1.1.0-finalization suite:
  ✗ v1.1.0 manifest has the same 9 top-level keys as v1.0.0
      v1.1.0 manifest missing top-level keys: enumerations, elements, sets, changelog, relationshipTypes
  ✗ v1.1.0 concepts list is v1.0.0's concepts + brainstorm-community + brainstorm-community-signal
      v1.1.0 has only 2 concepts; expected 36 (34 from v1.0.0 + 2 new)
  ✗ no SKELETON / NOT YET DEPLOYABLE markers anywhere under firmware/versions/v1.1.0
      SKELETON marker found in: firmware/versions/v1.1.0/manifest.json (description), firmware/versions/v1.1.0/concepts/brainstorm-community/concept-header.json, ...
  ✗ brainstorm-community json-schema has optional nip72Wrapping property
      nip72Wrapping property is absent from brainstormCommunity.properties
  ✗ firmware/active symlink resolves to versions/v1.1.0
      firmware/active resolves to "versions/v1.0.0"
  ✗ PLAN.md §5 Skeleton status paragraph carries the 2026-05-14 finalized note
      PLAN.md §5 does not contain "Finalized 2026-05-14"
  ...
```

Failures are meaningful — each describes the missing piece the Implementer must produce.
