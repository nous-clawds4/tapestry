# Review: Story 7 — Firmware v1.1.0 finalization

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Branch:** `feat/communities`
**Diff:** five commits in the slice:

- `18a33b10` story: firmware-v1.1.0-finalization (#7)
- `7596d57d` adr: 0005 — firmware v1.1.0 finalization manifest-merge strategy
- `92ba32b5` test-plan: firmware-v1.1.0-finalization (#7) — failing tests
- `79c3f4f3` impl: firmware v1.1.0 manifest merge + schema additions (#7)
- `857220dc` impl: flip firmware/active to versions/v1.1.0 (#7)

**Classification:** Feature / Standard / all five phases applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — PASS.** Six suites + Configuration Loading all green:
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5 PASS
  - scheduled-search-and-house-scores-refresh: 12/12 PASS
  - strfry-router-first-boot-config: 3/3 PASS
  - per-query-neo4j-timeout-safety-net: 8/8 PASS
  - communities-ui-scaffold: 26/26 PASS
  - **firmware-v1.1.0-finalization: 14/14 PASS** (new in this slice)
  - **Overall: 68/68.** No regressions in any pre-existing suite.
- [x] **JSON validity** — `python3 -c "import json; json.load(open('firmware/versions/v1.1.0/manifest.json'))"` parses without error. The 4 concept JSON files in v1.1.0 likewise parse cleanly (the test-suite `readJson` helper would have failed otherwise).
- [x] **Drift-protection test active** — T3 (`enumerations / elements / sets / relationshipTypes deep-equal to v1.0.0`) is the load-bearing ongoing guard. Confirmed it passes against the merged v1.1.0; any future v1.0.0 patch that fails to mirror into v1.1.0 will flip this to FAIL.
- [x] **`readlink firmware/active`** returns `versions/v1.1.0` (was `versions/v1.0.0` at the previous commit). Symlink target is relative, which matches the v1.0.0 baseline — operates correctly regardless of where the repo is cloned.
- [ ] **`npm run test:playwright`** — N/A. No browser-observable change in this slice.
- [x] _Typecheck / lint / build not configured at project level beyond `ui-communities/` ESLint, which this slice does not touch._

## Spec adherence (vs. story #7 acceptance criteria)

Going through every AC:

### Manifest completeness

- [x] **Top-level keys equal v1.0.0** — Confirmed by T1. Both manifests carry the same 9 keys: `version`, `date`, `description`, `concepts`, `enumerations`, `elements`, `sets`, `changelog`, `relationshipTypes`.
- [x] **Concepts list = v1.0.0 + 2 new (in order)** — T2 confirms count = 36 with no duplicates. Manual diff of [firmware/versions/v1.1.0/manifest.json:5–342](firmware/versions/v1.1.0/manifest.json#L5) against [firmware/versions/v1.0.0/manifest.json:5–326](firmware/versions/v1.0.0/manifest.json#L5) confirms the 34 v1.0.0 entries are in identical order, then `brainstorm-community` + `brainstorm-community-signal` appended.
- [x] **enumerations / elements / sets / relationshipTypes deep-equal v1.0.0** — T3. The ADR's "drift protection" guarantee is mechanical, not advisory.
- [x] **Changelog: 3 entries, v1.1.0 first, v1.0.0 entries preserved verbatim** — T4. v1.1.0 entry at index 0 has the expected version + date + non-empty changes array; v1.0.0 entries at indices 1 and 2 deep-equal the original v1.0.0 changelog.
- [x] **version "1.1.0" + date "2026-05-14"** — T5.

### No SKELETON markers in deployable firmware

- [x] **T6 confirms.** Recursive scan of `firmware/versions/v1.1.0/**` finds zero `/SKELETON|NOT YET DEPLOYABLE|not yet deployable/i` matches. Five files had SKELETON markers at slice start (manifest description + 2 concept-header descriptions + 2 json-schema descriptions); all five rewritten in [`79c3f4f3`](impl-commit). Forward references to PLAN.md and COMMUNITY_ENDORSEMENTS_DLIST.md remain intact for human readers tracing rationale — they're the intended "see-also" pattern, not SKELETON markers.

### Schema additions

- [x] **`nip72Wrapping` optional property added** — T7 confirms. [firmware/versions/v1.1.0/concepts/brainstorm-community/json-schema.json:91–98](firmware/versions/v1.1.0/concepts/brainstorm-community/json-schema.json#L91) declares the field as `type: "string"`, with name/title/slug/description matching the rest of the schema's naming convention. Position in the file (between `founder` and `relays`) is sensible: NIP-72 wrapping is identity metadata, alphabetically adjacent.
- [x] **`nip72Wrapping` NOT in required array** — T7's second assertion confirms. The `required` array at line 32–39 lists exactly the 7 PLAN.md §3 required fields (slug, name, description, relays, seedMembers, weightingModel, endorsementThreshold).
- [x] **All other PLAN.md §3 fields preserved** — T8 confirms the 7 required fields. Optional fields (image, topics, language, founder) verified present by direct inspection. `weightingModel.description` references `gr-community-default-v1` as default; `endorsementThreshold.description` references `0.5` as default.
- [x] **brainstorm-community-signal schema unchanged in shape** — T9 confirms targetPubkey + communityATag required, type + role + comments optional. Direct diff against the pre-slice file shows only the SKELETON marker removal from `word.description`.

### Active symlink

- [x] **`firmware/active` resolves to `versions/v1.1.0`** — T10 + manual `readlink firmware/active`. Both confirm.
- [x] **Flip is its own commit** — confirmed. `857220dc` modifies only `firmware/active`. `git revert 857220dc` restores `versions/v1.0.0` without touching the manifest contents.
- [x] **v1.0.0 directory untouched** — `git diff origin/feat/communities..HEAD -- firmware/versions/v1.0.0/` returns no output. T11 reinforces this as an ongoing regression sentinel.

### JSON validity & cross-references

- [x] **All 5 v1.1.0 JSON files parse cleanly** — Test-suite `readJson` helper at [test/firmware-v1.1.0-finalization.test.js:31](test/firmware-v1.1.0-finalization.test.js#L31) raises on parse failure; all 14 tests run to completion against valid JSON.
- [x] **`coreMemberOf` slug linkage matches concept-header `word.slug`** — T12 confirms for both new concepts. The schema → header wiring is intact, which is what `src/firmware/install.js` Pass 2 relies on for core-node attachment.
- [x] **Per-concept manifest.json shape preserved** — T13 confirms `{ HAS_ELEMENT: [], IS_A_SUPERSET_OF: [] }` on both new concept directories.

### Documentation

- [x] **PLAN.md §5 status updated** — T14 confirms the "Finalized 2026-05-14" line is present. [PLAN.md:232](PLAN.md#L232) appends a status paragraph below the historical "Skeleton status" narrative, preserving the original wording. The status paragraph explicitly mentions the four content edits (manifest merge, SKELETON stripping, nip72Wrapping addition, symlink flip), so a future operator reading PLAN.md gets the full picture.

### Regression

- [x] **v1.0.0 byte-equal to pre-slice state** — confirmed via `git diff origin/feat/communities..HEAD -- firmware/versions/v1.0.0/` (empty diff).
- [x] **Pre-existing test suites still pass** — confirmed by full `npm test` run.

No criterion is silently dropped. No behavior added that isn't in the story.

## ADR adherence (vs. ADR-0005)

- [x] **Option A — hand-craft + drift-protection test** — implemented exactly as ADR specifies. No throwaway generator script, no `extends` mechanism.
- [x] **Implementation steps 1–5 from ADR** — all executed in order:
  - Step 1 (`manifest.json` merge) ✓
  - Step 2 (`nip72Wrapping` added) ✓ at the suggested position with the suggested shape
  - Step 3 (SKELETON markers stripped from the four concept files) ✓
  - Step 4 (PLAN.md §5 status update) ✓
  - Step 5 (symlink flip in own commit) ✓
- [x] **No new dependencies, no new tooling** — confirmed.
- [x] **No edits to `src/firmware/install.js`** — confirmed. The install pipeline reads the merged manifest as-is; nothing about its API changed.
- [x] **Rollback path preserved** — confirmed. Single-commit `git revert 857220dc` flips the symlink back; the v1.1.0 directory contents stay in place for future re-activation.

**No ADR deviations.**

## Concept-graph integrity

- [x] **Handles constructible at install time** — both new concept-headers carry the standard `word.slug` + `conceptHeader.oSlugs.singular` pattern, so `src/firmware/install.js` Pass 1 will create them as kind-39998 nodes with handles `39998:<TA pubkey>:brainstorm-community` and `39998:<TA pubkey>:brainstorm-community-signal`. The corresponding kind-39999 JSON Schema nodes will be attached via the `coreMemberOf` reference verified by T12. **TA pubkey is per-deployment** (per AGENTS.md §1), not hardcoded — handles are constructed dynamically.
- [x] **Firmware reinstall** — required, deferred to staging smoke. The symlink flip alone doesn't trigger a reinstall; that happens at next container start when `bin/control-panel.js` initializes (or on explicit `POST /api/firmware/install`). The deploy chain handles this automatically.
- [x] **New code orients via Concept Graph API** — N/A this slice (no code reads concepts here; the consumers land in slices 2/4/6 and will use the API per AGENTS.md §2).

## Things tests can't catch

- [x] **No secrets in committed files.** No pubkeys, no keys, no tokens. Manifests contain only schema paths and descriptive metadata.
- [x] **No leftover debug logging or console.log.** N/A — no JS code changed in firmware (the install pipeline in `src/firmware/install.js` is untouched).
- [x] **No commented-out code.** N/A — JSON files don't support comments; the test JS doesn't have any.
- [x] **Error paths considered.** The install pipeline at `src/firmware/install.js` already handles missing concepts, schema-resolution failures, and Neo4j errors; no new failure modes introduced by this slice. If a concept directory is missing for one of the listed concepts, install will fail loudly per the existing pattern.
- [x] **Concurrency.** N/A. Install is sequential; the symlink is read once at startup.
- [x] **Security.** No new attack surface. Schemas are publicly known (they appear in PLAN.md). The drift-protection test runs against committed files only, no network or filesystem write.
- [x] **Em-dashes and LLM tics in committed JSON descriptions.** Some em-dashes survived in two of the concept-header rewrites; one used a colon, one used a semicolon (which I treated as appositional). Reviewed all 6 new/edited description fields: clean of `"X, not Y"` patterns and triadic closers. The text reads as documentation, not as marketing copy.
- [x] **Forward references to PLAN.md / COMMUNITY_ENDORSEMENTS_DLIST.md remain accurate.** Quick spot-check: PLAN.md §3 exists; COMMUNITY_ENDORSEMENTS_DLIST.md exists at the repo root; DECENTRALIZED_LISTS_COMPAT.md Method 2 exists. No broken doc links introduced.

## House rules check

- [x] **Concept Graph API authority respected** — no code reads or alters concept data outside the install pipeline.
- [x] **No new lint/typecheck/build tooling** — `package.json` and `ui-communities/package.json` untouched by this slice.
- [x] **Firmware reinstall called out** — yes, in the symlink-flip commit message and in the ADR "Consequences" section. The staging deploy chain will run `POST /api/firmware/install` automatically on next container start.

## Story #7 scope items verified untouched

Out-of-scope items the story explicitly listed:

- [x] **`POST /api/firmware/install` not run.** Deferred to staging smoke. Confirmed by absence of any new instance-talking-to-Neo4j code paths.
- [x] **GR-Community scoring (Slice 2)** untouched. Slice 2 lands separately.
- [x] **Endorsement event publishing (Slice 4)** untouched. The schema is now available to validate against, but no event-publish path exists yet.
- [x] **Kind-1 reads/writes (Slice 6)** untouched.
- [x] **NIP-72 wrapping UX (post-v1)** untouched. The schema gained the field; no UI surfaces it.
- [x] **Migrating existing Neo4j data** — N/A. v1.1.0 is purely additive (new concepts, no schema changes to existing v1.0.0 concepts), so no migration is needed. If the install pipeline turns out to require one in practice, that's a separate story.
- [x] **`firmware/versions/v0.0.1/`** — `git diff` confirms it's untouched.

The Implementer correctly stayed in scope.

## Findings

### Blocking

_None._

### Non-blocking

1. **NB-1 — Live install verification deferred.** The actual `POST /api/firmware/install` against a running instance is the load-bearing test that the new concepts land as Neo4j nodes with the correct schemas. The test plan and ADR both flag this as deferred to staging smoke. The deploy-communities droplet (currently un-provisioned) is the natural place to run it. **Suggested follow-up for the operator running staging:** after the deploy, run the verification snippet from the test plan ("How to run" §"Manual staging smoke") and append the output to this review as a comment.

2. **NB-2 — Concept directory ordering vs. manifest concepts ordering.** The manifest's concepts list is in v1.0.0 order with the 2 new concepts appended. Some `ls firmware/versions/v1.0.0/concepts` directories aren't in the manifest at all (39 directories vs. 34 concepts) — these are the not-yet-promoted ones from v0.0.1 days. v1.1.0 inherits the same situation. Not a regression, but worth noting if a future cleanup story tackles directory↔manifest hygiene.

3. **NB-3 — `nip72Wrapping` schema field has no `pattern` constraint.** The description says the value should match the `34550:<creator>:<d-tag>` shape, but the schema accepts any string. Adding a regex pattern would catch malformed values at validation time. Deferred because (a) PLAN.md §3 doesn't mandate one and (b) the field is optional, so loose validation matches the rest of the schema's permissive style. If Slice 4 starts producing endorsement events that wrap NIP-72 communities and we see operator-supplied malformed values, this becomes a real story.

4. **NB-4 — OPERATIONS.md row for communities.brainstorm.world still pending.** ADR-0004 NB-6 (Slice 0 review) flagged this. Slice 1 doesn't move the needle; once the droplet is provisioned the operator should add the row. Not a blocker for Slice 1's PASS verdict.

5. **NB-5 — Drift-protection test scope.** T3 deep-equals the 4 fixed top-level entries (`enumerations`, `elements`, `sets`, `relationshipTypes`). It does NOT deep-equal the v1.0.0 concept entries (since the merged list adds 2). If a future v1.0.0 patch changes an existing concept entry's shape (e.g. a new `categories` value), T2's set-membership check would still pass even with the v1.1.0 entry not mirroring. Worth a small enhancement in a future patch: also assert each v1.0.0 concept entry deep-equals its v1.1.0 counterpart by slug. Non-blocking because the risk is low (concept entry shape rarely changes) and the test already catches the high-risk drift cases.

## Verdict

**PASS.**

Slice 1 lands firmware v1.1.0 cleanly: 34 v1.0.0 concepts merged + 2 new concepts appended, 5 fixed top-level entries deep-equal v1.0.0, changelog updated newest-first, optional `nip72Wrapping` field added per PLAN.md §3, SKELETON markers removed from all 5 deployable JSON files, PLAN.md §5 status appended, `firmware/active` flipped to `versions/v1.1.0` in its own revertable commit. 68/68 tests pass across 6 suites. ADR-0005 followed exactly. No regressions.

Five non-blocking notes for follow-up. The only material one is **NB-1** (live install verification) — actionable as soon as the communities droplet exists.

Ready for the deploy chain. On next container start (after staging deploy), `POST /api/firmware/install` will pick up v1.1.0 automatically and create the `brainstorm-community` + `brainstorm-community-signal` concept-header / json-schema nodes in Neo4j. Slice 2 (GR-Community scoring + REST API) becomes the next workable slice.
