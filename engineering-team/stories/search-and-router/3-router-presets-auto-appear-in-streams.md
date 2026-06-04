# Story 3: Router presets auto-appear in the main Streams list

**Status:** Draft (deferred — see "Origin" below)
**Created:** 2026-05-13
**Type:** Feature (UX improvement)

## Background

In the Router Management tab (`/tapestry/settings/relays`), the "main Streams list" displays whatever is in `/var/lib/brainstorm/router-state.json`. New presets added to `setup/router-presets.json` are only discoverable by clicking the **"📋 Presets"** button, which surfaces a separate "Available Presets" popup. From there, an operator clicks "+ Add" to insert the preset into their state, and then toggles it to enable.

The existing discovery flow works, but it has a visibility gap: operators who don't notice the "📋 Presets" button (or who skim the page expecting the new preset to appear inline) won't realize a new preset is available after a deploy that ships one. As we accumulate more presets over time, the discoverability cost grows.

A potential improvement: when the deploy ships a new preset, the operator's main Streams list automatically shows the new entry (in its `defaultEnabled` state), so it's visible *without* requiring a Presets-popup click. The operator can still ignore, enable, or remove it.

## User-facing description

**As an operator of a Brainstorm instance**, I want new presets that ship with a deploy to appear in my main Streams list automatically (in their `defaultEnabled` state), **so that** I don't have to remember to check the "📋 Presets" popup after each deploy to see if something new is available.

## Acceptance criteria

- [ ] After a deploy that adds a new preset to `setup/router-presets.json`, the operator's main Streams list on the Router Management tab shows the new preset entry on the *first* page load — without requiring a click into the "📋 Presets" popup or any other operator action.
- [ ] The new preset appears with `enabled` matching its `defaultEnabled` value. (For `treasureMaps` shipped via [story #2](2-treasure-maps-router-preset.md), this is `false` — visible but off.)
- [ ] Existing operator-set toggle state on *other* presets is preserved across this change. An operator who has enabled `userProfiles` and disabled `dcosl` continues to have those toggles after the new preset auto-appears.
- [ ] If the operator removes the auto-appeared preset via the existing delete UI, it does *not* re-appear on subsequent page loads. (Removed entries stay removed.)
- [ ] Behavior is consistent regardless of whether the operator hits the Router tab via a GET (`/api/strfry/router-status`) or via a POST endpoint (`/api/strfry/router-toggle`, `/api/strfry/router-config`). Both paths see the auto-appeared preset.

## Concepts touched

- strfry-router preset system
- Router state persistence (`router-state.json`)

## Out of scope

- Auto-applying enabled presets to the active strfry-router config without an explicit operator toggle. (If the auto-appeared preset has `defaultEnabled: true`, this story does not run `applyConfig` for it; the operator's first toggle action does.)
- Preset *removal* handling at the JSON level (i.e. a preset removed from `router-presets.json` lingering as an orphan in state). Tracked separately if it becomes a real problem.
- Refactoring the state-as-overlay model (was Option C in ADR 0002 — large refactor, deferred).

## Open questions

- **Where the merge logic should live.** Two natural candidates: a shared utility called by both `routerConfig.js#ensureState` and `routerStatus.js#loadState`, or a centralized re-architecture. Architect's call when this story is picked up.
- **Whether to add a UI affordance for "this preset was auto-added"** — e.g. a small badge so the operator knows it wasn't from their explicit "+ Add" click. Probably YAGNI but worth considering.
- **What to do if the JSON has the same preset name as an existing custom (non-preset) stream.** Edge case; resolve in Architecture.

## Origin

Filed during the Tester phase of [story #2](2-treasure-maps-router-preset.md) (see [ADR 0002 — Revision history](../decisions/0002-treasure-maps-router-preset.md#revision-history)). The first draft of ADR 0002 proposed an additive merge in `ensureState()` as part of story #2's scope; on closer look it (a) wasn't required by any of story #2's ACs, (b) wouldn't actually deliver the auto-appear UX without expanded scope into `routerStatus.js`, and (c) contradicted the established precedent for shipping new presets (commit `bb4c83e7`). The UX idea was descoped from story #2 and captured here for future consideration.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
