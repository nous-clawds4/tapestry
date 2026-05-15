# ADR 0005: Firmware v1.1.0 finalization — manifest merge strategy + activation flip

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/7-firmware-v1.1.0-finalization.md`

## Context

Story #7 finalizes the v1.1.0 firmware skeleton at `firmware/versions/v1.1.0/`. The skeleton has well-shaped concept files (`brainstorm-community`, `brainstorm-community-signal`) but a stub manifest that lacks the v1.0.0 concept list and five top-level entries (`enumerations`, `elements`, `sets`, `changelog`, `relationshipTypes`). The skeleton self-identifies as NOT YET DEPLOYABLE precisely because `src/firmware/install.js` reads `firmware/active/manifest.json` and expects the full shape.

Relevant facts:

- v1.0.0 manifest at [firmware/versions/v1.0.0/manifest.json](../../firmware/versions/v1.0.0/manifest.json) has 9 top-level keys and 34 concepts. The 5 non-`concepts` top-level entries (`enumerations`, `elements`, `sets`, `changelog`, `relationshipTypes`) describe cross-concept wiring that does not change with the addition of `brainstorm-community` or `brainstorm-community-signal` — neither new concept enumerates anything, defines a new relationship type, or adds globally-listed elements/sets. The 2 new concepts each carry their own per-concept `manifest.json` ([brainstorm-community/manifest.json](../../firmware/versions/v1.1.0/concepts/brainstorm-community/manifest.json)) with the standard `{ HAS_ELEMENT: [], IS_A_SUPERSET_OF: [] }` shape that already exists in the skeleton.
- v1.0.0's changelog is **newest-first** — `v1.0.0 2026-04-06` precedes `v1.0.0 2026-03-28`. The v1.1.0 entry must therefore be prepended to the list, not appended.
- `src/firmware/install.js:24-32` reads `firmware/active` (a symlink) and looks up `firmware.relAlias()` for relationship types. The aliases needed by Brainstorm Communities (`HAS_ELEMENT`, `IS_A_SUPERSET_OF`) already exist in v1.0.0's `relationshipTypes` — no additions are needed.
- The brainstorm-community JSON Schema is missing the optional NIP-72-wrapping `a` field per PLAN.md §3 (Method 2 in DECENTRALIZED_LISTS_COMPAT.md). All other PLAN.md §3 fields are present with the right shapes.
- The two new schemas already carry `coreMemberOf` references back to the matching concept-header word slug — the install pipeline's schema→header linkage is intact.
- `firmware/active` is a relative symlink: `versions/v1.0.0`. Flipping to `versions/v1.1.0` is a one-character change. Per OPERATIONS.md §8 rollback-safety principle, the flip should be a separate commit so `git revert` reverses it without touching the manifest contents.

**No firmware reinstall verified live** — we cannot run `POST /api/firmware/install` from inside the branch without the full Docker stack. Verification is deferred to staging smoke per the established pattern (story #5).

## Options considered

### Option A — Hand-craft `versions/v1.1.0/manifest.json` + assert symmetry in tests (chosen)

1. **Manifest merge** is performed by hand-writing the v1.1.0 manifest. Top-level keys mirror v1.0.0; the 5 unchanged entries are copied verbatim; the changelog gets a new v1.1.0 entry prepended; the concepts list is the v1.0.0 list with the 2 new entries appended.
2. **Drift protection** is enforced by tests, not by a script. The test plan adds source-regex assertions that load both manifests and deep-equal the 5 unchanged top-level entries. If a future v1.0.0 patch lands and we forget to mirror it into v1.1.0, the test flips to FAIL.
3. **NIP-72 wrapping field** is added as `nip72Wrapping` (camelCase, optional) directly in the existing `brainstorm-community/json-schema.json`. Description references the `34550:<creator>:<d-tag>` shape and PLAN.md §3 Method 2.
4. **SKELETON markers** are stripped from the v1.1.0 manifest description, both concept-header descriptions, both json-schema descriptions, and any other `firmware/versions/v1.1.0/**` text. The forward references to PLAN.md remain for human readers tracing rationale.
5. **`firmware/active` flip** lands in its own commit at the end of the slice: `ln -sfn versions/v1.1.0 firmware/active`. The previous commit only modifies files under `firmware/versions/v1.1.0/`. Git history isolates the activation from the content; `git revert` of the flip-commit-only is a clean rollback.
6. **PLAN.md §5 status update** appends a one-sentence "Finalized in story #7 on 2026-05-14, active symlink flipped" line to the "Skeleton status" paragraph. The historical narrative is preserved.

**Pros:**
- Minimal moving parts. No throwaway scripts, no new tooling.
- The drift-protection test is the *real* gate against accidental v1.0.0/v1.1.0 divergence; it runs on every commit forever, not just at finalization time.
- Hand-written manifests are git-diff-readable; future operators reading the diff for compliance/auditing see a real edit, not a script-generated blob.
- The symlink flip in its own commit is the standard OPERATIONS.md pattern for risky-but-reversible production changes.

**Cons:**
- Slightly more work upfront than a one-line script.
- Hand-copying 34 concept entries from v1.0.0 is monotonous and easy to typo. Mitigated by the drift-protection test that compares both manifests in real time.

### Option B — Generator script that emits `v1.1.0/manifest.json` from `v1.0.0/manifest.json` + deltas

A small Node script at `firmware/versions/v1.1.0/build-manifest.js` reads v1.0.0, applies the v1.1.0-specific deltas (new concepts, new changelog entry, new version/date), and writes `manifest.json`. CI runs it as a check, or it's run once at finalization time.

**Pros:**
- Deterministic — no risk of hand-copying drift.
- Self-documents the "what changed" delta.

**Cons (why rejected):**
- Adds a throwaway tool to the repo whose only purpose is to land once. Future versions (v1.2.0+) would need their own variant or a parametrized generator.
- Violates the spirit of CLAUDE.md's no-new-tooling rule (this isn't a build step exactly, but it's a new generator with no other consumer).
- The hand-written-manifest + drift-test combination gives the same drift-protection guarantee with no new code to maintain.

### Option C — Symlink-tier v1.1.0 manifest entries to v1.0.0 (extends-style import)

Add an `extends: "../v1.0.0/manifest.json"` field to v1.1.0 manifest. `src/firmware/install.js` resolves the extends chain at load time and merges.

**Pros:**
- DRY at the file-system level — no duplicated bytes.
- Future versions read as pure deltas.

**Cons (why rejected):**
- Requires changing `src/firmware/install.js` to support an extends mechanism it doesn't currently have. New install-pipeline code path = real risk, real test surface, and a new shape every consumer of the manifest has to handle.
- Deferred to a separate ADR if/when v1.x manifest duplication becomes a real maintenance burden. For one version increment, hand-copy + drift-test is simpler.

## Decision

We chose **Option A**.

The drift-protection test is the load-bearing piece — it converts a "monotonous error-prone copy" into a "monotonous safe copy". Without the test, Option A would be risky; with it, Option A is the least-invasive way to land the slice.

We trade away: a small amount of one-time copy work, and ~70 KB of duplicated manifest JSON between v1.0.0 and v1.1.0. We accept this in exchange for not touching `src/firmware/install.js` and not adding any new tooling to the repo.

## Consequences

- **Enables:** Slice 2 can read the concept graph and find `brainstorm-community` + `brainstorm-community-signal` via `/api/concept-graph/summaries` after any container restart on this branch. Slice 4 can validate publishable event JSON against the schemas. Slice 6 can query members against the active community node.
- **Constrains:** Any future v1.0.0 patch (bug fix to an existing schema, etc.) must be mirrored into v1.1.0 to keep the drift-protection test green. This is the *intended* constraint — it forces operators to acknowledge the duplication when they edit shared concepts.
- **New debt:** None significant. The "extends" mechanism (Option C) remains a viable future ADR if maintenance pain materializes.
- **Firmware reinstall required?** **Yes**, but not in this slice. The symlink flip lands in this slice; the actual `POST /api/firmware/install` call happens on next container start on whichever droplet runs this code. The staging deploy will exercise it; verification is via `/api/concept-graph/summaries` showing the two new entries post-deploy.

## Implementation notes

The Implementer reads this section. Be concrete.

### Step 1 — `firmware/versions/v1.1.0/manifest.json` (single edit)

Replace the current 25-line skeleton with the merged manifest. The merged manifest:

- `version: "1.1.0"`, `date: "2026-05-14"`.
- `description`: short, single-sentence, no SKELETON marker. Suggested: `"Tapestry firmware v1.1.0 — adds the brainstorm-community and brainstorm-community-signal concepts for the Brainstorm Communities feature. See feat/communities/PLAN.md §5 for design context."`.
- `concepts`: copy v1.0.0's 34 entries **verbatim and in order** (any cross-concept dependencies in the install pipeline rely on the existing order), then append the two existing v1.1.0 entries (`brainstorm-community`, `brainstorm-community-signal`) unchanged.
- `enumerations`, `elements`, `sets`, `relationshipTypes`: copy v1.0.0 deep-equal.
- `changelog`: prepend a new v1.1.0 entry to v1.0.0's list. Suggested shape:
  ```json
  { "version": "1.1.0", "date": "2026-05-14", "changes": [
    "Add brainstorm-community concept and JSON Schema for self-curating community records",
    "Add brainstorm-community-signal concept and JSON Schema for endorsement/veto signals",
    "Add optional nip72Wrapping field to brainstorm-community schema for NIP-72 a-tag wrapping (DECENTRALIZED_LISTS_COMPAT.md Method 2)"
  ]}
  ```
  Then v1.0.0's two existing entries follow unchanged.

### Step 2 — `firmware/versions/v1.1.0/concepts/brainstorm-community/json-schema.json`

Two edits:

1. Strip `SKELETON — schema may evolve before v1.1.0 is activated.` from the `word.description` field (line 6).
2. Add `nip72Wrapping` property inside `properties.brainstormCommunity.properties` (sibling to `founder`, `relays`, etc.). Shape:
   ```json
   "nip72Wrapping": {
     "type": "string",
     "name": "nip72Wrapping",
     "title": "NIP-72 Wrapping",
     "slug": "nip72-wrapping",
     "description": "Optional NIP-72 wrapping reference in the form '34550:<creator>:<d-tag>'. Present when this Brainstorm community wraps an existing NIP-72 (kind 34550) community per DECENTRALIZED_LISTS_COMPAT.md Method 2. Absent for native Brainstorm communities."
   }
   ```
   **Not** added to the `required` array.

### Step 3 — strip SKELETON markers from the remaining three files

- `concepts/brainstorm-community/concept-header.json` (line 9): rewrite `conceptHeader.description` to remove `SKELETON — schema details may evolve before v1.1.0 is activated.`. Keep the rest of the description intact.
- `concepts/brainstorm-community-signal/concept-header.json` (line 9): same treatment.
- `concepts/brainstorm-community-signal/json-schema.json` (line 6): remove SKELETON marker from `word.description`.

### Step 4 — PLAN.md §5 "Skeleton status" status line

Append one sentence after the existing skeleton-status paragraph:

> **Finalized 2026-05-14** in story #7. The active symlink was flipped to v1.1.0 in the same slice.

Don't rewrite the historical narrative.

### Step 5 — flip `firmware/active` (separate commit)

```bash
ln -sfn versions/v1.1.0 firmware/active
```

Verify with `readlink firmware/active` → `versions/v1.1.0`. Stage and commit just this change.

### Verification

Tester writes a Node-runner suite that:
- Parses both manifests as JSON (catches trailing commas / syntax errors).
- Asserts `manifest.version === "1.1.0"`, `manifest.date === "2026-05-14"`.
- Asserts every v1.0.0 concept slug appears in v1.1.0 concepts (in any order — order is verified to match by a separate assertion if we want, but identity-of-set is the load-bearing check).
- Asserts `enumerations`, `elements`, `sets`, `relationshipTypes` are deep-equal between v1.0.0 and v1.1.0.
- Asserts changelog length is 3 and the first entry has `version: "1.1.0"`.
- Asserts no `/SKELETON|NOT YET DEPLOYABLE/i` regex matches anywhere under `firmware/versions/v1.1.0/`.
- Asserts the brainstorm-community schema has a `nip72Wrapping` optional property.
- Asserts `firmware/active` symlink resolves to `versions/v1.1.0`.

## Out of scope

- **Running `POST /api/firmware/install`.** Deferred to staging smoke.
- **Migrating existing Neo4j data.** v1.1.0 is purely additive.
- **Surfacing `nip72Wrapping` in the Communities UI.** Schema-only change; UI work would be a separate post-v1 story.
- **Refactoring src/firmware/install.js to support an `extends` mechanism** (Option C, deferred).
