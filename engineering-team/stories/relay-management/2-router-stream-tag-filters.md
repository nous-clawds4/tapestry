# Story 2: Single-letter tag filters on Router Management streams

**Epic:** relay-management
**Status:** Approved
**Created:** 2026-07-15
**Type:** Feature

## Background

The Router Management tab of the Relay Settings page (`/tapestry/settings/relays`) manages the instance's **persistent router streams** — always-on data flows between this relay and remote relays, each carrying its own filter, edited through the tab's add/edit-stream UI and applied with a router restart. It is the persistent sibling of the one-shot Negentropy Sync panel.

Story #1 (`stories/relay-management/1-sync-panel-tag-filters.md`) gave the Sync panel single-letter tag filters, honored end-to-end. The stream editor still cannot express them: stream filters today are shaped by kinds (the presets — dcosl, WoT, profiles, … — are kinds-only), so an always-on tag-scoped stream must be hand-edited into the router config in a container shell.

The motivating case is ledgered as OPEN.md #25: tags federation needs a dcosl stream whose filter is `{"kinds":[39999],"#z":[<canonical handles>]}`. The shared dcosl relay holds ~1.28M kind-39999 events of which only ~451 are tags-family (2026-07 census) — a kinds-only stream over-pulls by ~2,800×.

The difference in kind from story #1 is **persistence**. A sync command is ephemeral; a router stream is durable config. Tag filters must therefore complete the full persistence loop: entered in the editor → saved into that stream's filter in the deployed router config → surviving the save → router-restart cycle → round-tripping back into the editor so an operator can see and remove previously saved filters, not just add new ones.

## User-facing description

As an **instance operator**, I want to add and remove single-letter tag filters on a Router Management stream — with the same entry and validation experience the Sync panel gained in story #1 — so that my always-on streams move exactly the tagged slice of events I mean, and so that filters I saved earlier are visible and editable whenever I come back to the stream.

## Acceptance criteria

- [ ] **AC-1 (entry and validation, at parity with story #1):** Given the Router Management stream add/edit UI, the operator can add one or more single-letter tag filters (entered one at a time: one letter plus one or more comma-separated values) and remove any added filter before saving. Entry rules are exactly those ratified in story #1 (AC-4–AC-7 of `1-sync-panel-tag-filters.md`): tag names are exactly one ASCII letter, anything else blocked with a visible reason; adding a letter that already has a filter merges the new values in (deduplicated); `p`/`e`/`a` and their uppercase counterparts require 64-char hex or the matching bech32 form (`npub`/`nprofile` for p/P, `note`/`nevent` for e/E, `naddr` for a/A), decoded and displayed normalized (hex / coordinate); other letters take arbitrary non-empty strings; an invalid value blocks the add with an inline error naming the offending value, leaving the stream's filter unchanged.
- [ ] **AC-2 (saved into the deployed config, per stream):** Given tag filters added to a stream, when the operator saves/applies the Router Management changes, then that stream's filter in the deployed router config contains each `"#<letter>": ["v1","v2"]` entry, composed with — never replacing — the stream's other filter parts (e.g. kinds), and scoped to that stream alone: every other stream's filter is unchanged. Regression guard: streams saved without tag filters produce exactly the config they produce today.
- [ ] **AC-3 (survives save → router restart):** Saving a stream with tag filters uses the panel's existing save/apply → router-restart flow — no new steps, prompts, or confirmation UX. After the save and restart complete, the running router's config still carries that stream's tag filters: they are durable config, not session state.
- [ ] **AC-4 (round-trips into the editor):** Given a stream whose saved filter already contains tag filters, when the operator re-opens that stream in the edit UI, then each saved tag filter is displayed (letter plus values, normalized display) and individually removable. After removing one and saving, exactly that `"#<letter>"` entry is gone from the deployed config, while the stream's remaining tag filters and all non-tag filter parts are untouched.
- [ ] **AC-5 (motivating case expressible end-to-end):** From the UI alone — no container shell — the operator can produce a stream whose deployed filter is `{"kinds":[39999],"#z":["<canonical handle>", …]}` (the OPEN.md #25 dcosl tags-federation stream), alongside the stream's existing settings (relay, direction). This holds whether the stream is newly created or started from a preset: preset streams (dcosl / WoT / profiles / …) accept tag-filter edits like any other stream, while the presets themselves remain kinds-only starting points and no new preset is added.

## Product decisions (settled at Planning)

The book's acceptance frame delegates three product questions (prd-seed §7, bullet 1) to Planning. They are settled here from the operator-delegate answers journaled at kickoff — not silently defaulted:

1. **Per-stream scoping:** tag filters are a per-stream property, edited in the stream add/edit UI alongside the stream's existing filter fields. Not global, not per-panel.
2. **Preset interplay:** presets (dcosl / WoT / profiles / …) remain kinds-only starting points exactly as today; tag filters are editable on any stream regardless of whether it started from a preset. No tags-federation preset ships in this story — the frame requires the `#z` dcosl stream to be *expressible* by an operator, not shipped as a preset; a concept-bound preset would breach the epic's generic-tooling guardrail.
3. **Save/restart semantics:** unchanged. Tag filters ride the Router Management panel's existing save/apply → router-restart mechanics; this story introduces no new restart behavior and no new confirmation UX.

Carried-over defaults ratified in story #1 (the ask is "a similar feature"; these apply unchanged): uppercase `P`/`E`/`A` validated like lowercase; duplicate-letter adds merge + dedupe; bech32 (`npub`/`nprofile`/`note`/`nevent`/`naddr`) accepted and normalized to hex/coordinate; normalized (hex) display.

## Concepts touched

- `39998:<this instance's TA>:nostr-relay` — the remote counterparty each router stream connects to. Handle pubkey is per-deployment; resolve at runtime, never hardcode.
- Deliberately **none** from the tag family: like the sync panel (story #1), the stream editor is generic operator tooling. A `#z` value is just a string here; the story bakes in no concept-graph semantics.

## Out of scope

- **Multi-character tag names** — strfry indexes single-letter tag names only (epic guardrail, panel-wide).
- **Concept-handle autocomplete** or any concept-graph-aware sugar on tag values.
- **Shipping a tags-federation preset** — see settled decision 2; expressible, not preset.
- **Any change to the Negentropy Sync panel** — story #1's surface, whose book is closed.
- **Executing the OPEN.md #25 dcosl sync/stream itself** — the one-shot backfill and the actual stream rollout are an ops follow-up once this ships, not part of this story.
- **Saved/named filter preset machinery** (for either panel).
- **In-place editing** of an added filter's values — remove + re-add covers it (merge-on-re-add carries over from story #1).
- **Values containing commas** — same accepted limitation as story #1.

## Open questions

None. The three product questions the frame delegated to Planning are settled above; entry/validation semantics carry over from story #1's ratified defaults.

## Deviations

- Stream read card renders saved tag entries as ` #z: v1, v2` appended to the existing `Filter:` line (same `#letter: values` format the TagFilterEditor rows use), rather than the ADR's non-normative example text `+ tag filters …` — reads cleanly both with kinds (`Filter: kinds 39999 (limit: 5) #z: …`) and without (`Filter: #z: …`); render condition adjusted to "has kinds or tag entries" exactly as the ADR directs.

## Linked artifacts

- ADR: `engineering-team/decisions/relay-management/0002-router-stream-tag-filters.md`
- Test plan: `engineering-team/stories/relay-management/2-router-stream-tag-filters.test-plan.md` (suite: `test/router-stream-tag-filters.test.js`)
- Review: (filled in after Review phase)
