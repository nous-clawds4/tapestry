# Story 7: Firmware v1.1.0 finalization (Slice 1)

**Status:** Done
**Created:** 2026-05-14
**Type:** Feature

## Background

[PLAN.md §5](../../PLAN.md) calls for a new firmware version v1.1.0 introducing two concepts — `brainstorm-community` and `brainstorm-community-signal` — that give the Brainstorm Communities feature a Concept-layer representation alongside the DList-layer event tag schema. The v1.1.0 skeleton was drafted earlier and lives at `firmware/versions/v1.1.0/`. Its current state explicitly self-identifies as "SKELETON — not yet deployable" because:

- The manifest only lists the 2 new concepts; the 34 v1.0.0 concepts must be merged in.
- The manifest is missing the v1.0.0 top-level entries `enumerations`, `elements`, `sets`, `changelog`, and `relationshipTypes` — these are required by [`src/firmware/install.js`](../../src/firmware/install.js) which reads from `firmware/active` and expects the full manifest shape.
- The new concept files' descriptions carry SKELETON markers that must not ship in a deployable firmware.
- The brainstorm-community JSON Schema does not yet expose the optional NIP-72-wrapping `a` field per PLAN.md §3 (Method 2 in [DECENTRALIZED_LISTS_COMPAT.md](../../DECENTRALIZED_LISTS_COMPAT.md)).
- The `firmware/active` symlink still points at `versions/v1.0.0`.

Slice 1 closes all of those gaps and produces a deployable v1.1.0. Live install verification (the actual `POST /api/firmware/install` call into a running instance) is deferred to staging smoke per the pattern established in story #5 — we cannot run a live install from inside this branch without the full Docker stack.

## User-facing description

**As an operator** of a Brainstorm Communities deployment, I want `firmware/active` to point at a deployable v1.1.0 that contains the two new community concepts alongside everything v1.0.0 already provided, **so that** the next `POST /api/firmware/install` (whether triggered by a fresh container start or by an explicit operator action) creates the `brainstorm-community` and `brainstorm-community-signal` nodes in Neo4j with their correct JSON Schemas, and validation against those schemas becomes available for slices 2, 4, and 6.

**As a future agent** orienting via the Concept Graph API after a v1.1.0 install, I want `/api/concept-graph/summaries` to return entries for `brainstorm-community` and `brainstorm-community-signal` alongside the existing concept set, **so that** I can construct handles (`39998:<TA pubkey>:brainstorm-community`, etc.) and read schemas via `/node/:handle` without re-reading firmware JSON.

## Acceptance criteria

Every criterion is testable from the outside — either by parsing the firmware JSON files or by resolving the symlink target.

### Manifest completeness

- [ ] `firmware/versions/v1.1.0/manifest.json` has the same top-level keys as `firmware/versions/v1.0.0/manifest.json`: `version`, `date`, `description`, `concepts`, `enumerations`, `elements`, `sets`, `changelog`, `relationshipTypes`.
- [ ] `manifest.concepts` is an array containing **every entry from v1.0.0's concepts list** (matched by `slug`) plus the two new entries (`brainstorm-community`, `brainstorm-community-signal`). The two new entries appear at the end of the list.
- [ ] `manifest.enumerations`, `manifest.elements`, `manifest.sets`, and `manifest.relationshipTypes` are deep-equal to the v1.0.0 values — Slice 1 introduces no new enumerations, no new relationship types, no new globally-listed elements, and no new globally-listed sets. (The two new concepts each define their own `manifest.json` inside their concept directory; they do not participate in cross-concept enumeration.)
- [ ] `manifest.changelog` is an array with three entries: the two existing v1.0.0 entries preserved verbatim, plus a new v1.1.0 entry at the **start** (newest first, matching the existing chronological order — verify the v1.0.0 changelog ordering and follow it). The v1.1.0 entry has `version: "1.1.0"`, a 2026-05-14 date, and a non-empty `changes` array describing the two new concepts and any schema additions (the optional NIP-72-wrapping `a` field on brainstorm-community).
- [ ] `manifest.version` is `"1.1.0"`. `manifest.date` is `"2026-05-14"`.

### No SKELETON markers in deployable firmware

- [ ] No string containing `SKELETON`, `NOT YET DEPLOYABLE`, or `not yet deployable` appears anywhere under `firmware/versions/v1.1.0/`. The top-level manifest description, the new concept-header descriptions, and the new json-schema descriptions all read as deployable copy. Forward references to PLAN.md or COMMUNITY_ENDORSEMENTS_DLIST.md remain (for human readers tracing design rationale), but the SKELETON / draft markers are gone.

### Schema additions

- [ ] `firmware/versions/v1.1.0/concepts/brainstorm-community/json-schema.json` exposes an optional property for NIP-72 wrapping. Name `nip72Wrapping` (camelCase, mirroring the rest of the schema's naming). Type `string`. Description references the `34550:<creator>:<d-tag>` shape and PLAN.md §3 / Method 2. **Not** in the `required` array — wrapping is optional per PLAN.md (native Brainstorm communities omit it).
- [ ] All other PLAN.md §3 fields remain in place with the same shapes they already have. Required fields (`slug`, `name`, `description`, `relays`, `seedMembers`, `weightingModel`, `endorsementThreshold`) stay required; optional fields (`image`, `topics`, `language`, `founder`) stay optional; the `weightingModel` description mentions `gr-community-default-v1` as the default and `endorsementThreshold` description mentions `0.5` as the default.
- [ ] `firmware/versions/v1.1.0/concepts/brainstorm-community-signal/json-schema.json` schema unchanged in shape (already correctly models endorsement/veto signals per PLAN.md §3) — only the SKELETON markers in description fields are removed.

### Active symlink

- [ ] `firmware/active` resolves to `versions/v1.1.0` (was `versions/v1.0.0`). The flip lands in its **own commit** within Slice 1 so a rollback to v1.0.0 is a single `git revert` of that commit (matches the OPERATIONS.md §8 pattern of preserving rollback paths).
- [ ] `firmware/versions/v1.0.0/` remains untouched on disk — the directory and all its contents survive the flip, so a `ln -sfn versions/v1.0.0 firmware/active` rolls back without any restore-from-backup step.

### JSON validity & cross-references

- [ ] Every JSON file under `firmware/versions/v1.1.0/` (manifest + 4 concept files) parses cleanly with `JSON.parse` (no trailing commas, no syntax errors).
- [ ] Each new concept's `json-schema.json` carries a `coreMemberOf` reference whose `slug` matches the corresponding `concept-header.json` `word.slug`. (Schema → header linkage is how the existing install pipeline wires the JSON Schema as a core node of the Concept Header — verify against the same pattern in any v1.0.0 concept.)
- [ ] Each new concept's `manifest.json` inside the concept directory has the existing `{ "HAS_ELEMENT": [], "IS_A_SUPERSET_OF": [] }` shape preserved (Slice 1 introduces no elements or supersets for the new concepts; they're container-only Concept Headers at activation time).

### Documentation

- [ ] [PLAN.md §5](../../PLAN.md) — the "Skeleton status" paragraph at the bottom needs a one-sentence update noting that v1.1.0 was finalized and the active symlink flipped in story #7. **Don't** rewrite the historical "Skeleton drafted at..." narrative; append a status line.

### Regression

- [ ] `firmware/versions/v1.0.0/` directory contents byte-equal to pre-slice state (verified by `git diff origin/feat/communities -- firmware/versions/v1.0.0/`). Slice 1 never modifies v1.0.0; rollback safety depends on it.

## Concepts touched

Two new Concept Headers introduced (handles constructible at install time as `39998:<TA pubkey>:brainstorm-community` and `39998:<TA pubkey>:brainstorm-community-signal`, with their schemas as kind-39999 core nodes). Per [AGENTS.md §5](../../AGENTS.md), the pubkey is the local Tapestry Assistant pubkey discovered via `/api/assistant/pubkey` — never hardcoded.

After v1.1.0 lands, future agents and slices should orient via the Concept Graph API rather than re-reading firmware JSON, per [AGENTS.md §2](../../AGENTS.md).

## Out of scope

- **Running `POST /api/firmware/install` against a deployed instance.** Deferred to staging smoke. The story's acceptance criteria cover the firmware files being correctly shaped; whether a live instance accepts them is a deploy-time verification step (matches story #5's split between code-shape tests and manual staging smoke). The slice ships the symlink flip so that the next container restart on any droplet running this code will run the v1.1.0 install automatically.
- **GR-Community scoring computation.** Slice 2.
- **Endorsement event publishing.** Slice 4.
- **Kind-1 reads/writes through the community relay.** Slice 6.
- **Adding NIP-72 wrapping UX to the Communities UI.** The schema gains the optional `nip72Wrapping` field; surfacing it in `ui-communities/` is not in scope for any v1 slice (PLAN.md §6 Q6 / §7).
- **Migrating existing data.** v1.1.0 is purely additive (new concepts, no schema changes to existing concepts), so no Neo4j migration is needed. If the install pipeline turns out to need a migration step in practice, that's a separate story.
- **Updating firmware/versions/v0.0.1/** or any other pre-1.0.0 version. Slice 1 touches v1.1.0 only.

## Open questions

Resolved before story approval:

- **Symlink flip in Slice 1 or deferred?** Flip in Slice 1, in its own commit. Reasoning: every subsequent slice (2 / 4 / 6) reads concepts via the Concept Graph API which depends on the active firmware; deferring the flip would leave a brittle ordering between this story and the slices that consume it. A separate commit for the symlink keeps rollback to a single `git revert`.
- **Schema `nip72Wrapping` field — required or optional? camelCase or snake_case?** Optional; camelCase to match the rest of the brainstorm-community schema (`weightingModel`, `endorsementThreshold`). The DList tag layer uses bare `a` per the standard `a`-tag convention; the schema layer abstracts that into `nip72Wrapping` so the field name is unambiguous in object form.
- **Should the changelog entry mention "draft" or "stable"?** Stable. The skeleton phase ends with this slice; the schemas are now the v1.1.0 contract.
- **TA pubkey hardcoded anywhere?** No. The firmware JSON files contain no pubkey values — handles are constructed at install time using the running instance's TA pubkey.

## Linked artifacts

- ADR: [`engineering-team/decisions/0005-firmware-v1.1.0-finalization.md`](../decisions/0005-firmware-v1.1.0-finalization.md)
- Test plan: [`engineering-team/stories/7-firmware-v1.1.0-finalization.test-plan.md`](7-firmware-v1.1.0-finalization.test-plan.md)
- Review: [`engineering-team/reviews/7-firmware-v1.1.0-finalization.md`](../reviews/7-firmware-v1.1.0-finalization.md) (PASS, 5 non-blocking notes)
