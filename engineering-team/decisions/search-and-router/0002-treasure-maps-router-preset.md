# ADR 0002: Add `treasureMaps` router preset + 10040 to Negentropy Sync

**Status:** Accepted (revised during Phase 3 — see "Revision history" at end)
**Date:** 2026-05-13
**Story:** `engineering-team/stories/2-treasure-maps-router-preset.md`

## Context

Story #2 asks for two parallel changes on `/tapestry/settings/relays`:

1. **Router Management tab:** add an opt-in preset `treasureMaps` that streams kind 10040 (Treasure Maps) bidirectionally with three popular general-purpose relays.
2. **Negentropy Sync tab:** add kind 10040 as a selectable Event Kinds option.

The Router Management system is implemented in `src/api/strfry/routerConfig.js`. Presets live in `setup/router-presets.json`; per-instance enabled/disabled state lives at `/var/lib/brainstorm/router-state.json`. The activation flow is: UI POSTs `/api/strfry/router-toggle` → updates `router-state.json` → `generateConfig(state.streams)` → writes `/etc/strfry-router-tapestry.config` → `supervisorctl restart strfry-router`. An existing preset `dcosl` uses `dir: "both"` and is the natural template.

The Negentropy Sync UI's Event Kinds picker is a hardcoded `KIND_PRESETS` array in `ui/src/pages/settings/RelaySettings.jsx` (lines 769–774). The sync backend passes the kinds array transparently to `strfry sync`, so adding a kind is purely a UI config change.

**Preset discovery on existing instances follows an established UI pattern.** New presets added to `router-presets.json` appear in the **"📋 Presets" popup** in the Router Management tab as soon as they deploy (the popup is sourced from `GET /api/strfry/router-presets`, which reads the JSON file directly via `loadPresets()`, no state mutation involved). The popup's "+ Add" button (`handleImportPreset` in `RelaySettings.jsx:341`) builds a new stream entry with `enabled: !!preset.defaultEnabled`, so opt-in semantics are respected automatically. This is the documented and established discovery path: precedent commit `bb4c83e7` ("Add WoT and trustedAssertions router presets") explicitly notes *"operators opt in via the router-config UI or POST /api/strfry/router-restore-defaults"*.

The Concept Graph at `/api/concept-graph/summaries` was consulted (36 foundational concepts). Router presets, treasure maps, and negentropy are not yet modeled in the graph. No firmware reinstall is required — no concept schemas are modified.

## Options considered

### Option A — Additive merge in `ensureState()` (rejected during Phase 3)

Modify `ensureState()` to additively merge presets from `router-presets.json` into the loaded state, so new presets auto-appear in the operator's main "Streams" list without requiring the Presets popup click.

**Why rejected:** The Tester phase caught two problems:
- The story's acceptance criteria don't require auto-appear behavior. AC-1 says the preset is "visible in the list of available presets" — which is the Presets popup, already satisfied by the existing pattern.
- Worse, the merge as scoped wouldn't actually deliver the auto-appear UX it claimed. `ensureState` is called from POST handlers only (`handleToggleStream`, `handleUpdateRouterConfig`). The Router tab's initial render calls `GET /api/strfry/router-status` (in `routerStatus.js`), which has its own `loadState()` and never calls `ensureState`. So the merge wouldn't fire until the operator performed some interaction — defeating the "auto" part.

To genuinely deliver auto-appear, both `routerConfig.js#ensureState` and `routerStatus.js#loadState` would need the merge (or a refactor to share one path). That expanded scope wasn't in the story, contradicts the `bb4c83e7` precedent, and is better tracked as its own focused effort.

### Option B — Document "click Restore Defaults to pick up new presets"

Don't modify any state logic. Document that operators must click "Restore Defaults" to pick up new presets.

**Why rejected:** "Restore Defaults" is destructive (overwrites all preset enable states), so this is bad guidance even though it would work. Also unnecessary — the Presets popup already gives a non-destructive path.

### Option C — Refactor: presets as source of truth, state file as sparse overlay

Larger refactor; cleaner conceptual model.

**Why rejected:** Out of proportion to story scope. Risk of regression in non-preset (custom) stream handling. Best as its own cleanup story if preset churn justifies it.

### Option D — Match existing precedent: ship the JSON + JSX + docs only (chosen)

Three minimal additions:

1. Append the `treasureMaps` entry to `setup/router-presets.json`.
2. Append a `Treasure Maps (10040)` entry to the `KIND_PRESETS` array in `RelaySettings.jsx`.
3. Document the router preset system in BIBLE.md / docs/CONFIGURATION.md and note the planned Negentropy preset system as future work.

Operators discover the new preset via the existing 📋 Presets popup ("+ Add" → preset appears in their Streams list disabled → operator toggles to enable).

**Pros:**
- Matches the precedent set by `bb4c83e7` exactly. Operators with prior preset experience need no retraining.
- Smallest possible change. Two short config-style additions and a docs paragraph.
- Zero risk to existing state-management code.
- Opt-in semantics fall out of the existing `handleImportPreset` logic (`enabled: !!preset.defaultEnabled`).

**Cons:**
- Operators won't see the new preset in their main Streams list until they explicitly click "📋 Presets" → "+ Add". The "auto-appear in Streams list" UX is a separate, deferred improvement.

## Decision

We chose **Option D** — match existing precedent.

We considered improving the discovery UX as part of this story (Option A), but rejected it during Phase 3 once the Tester noticed it (a) wasn't required by any AC, (b) wasn't fully delivered by the proposed code change without expanded scope, and (c) contradicted the established precedent for adding presets. The discovery UX improvement is filed as story #3 (`engineering-team/stories/3-router-presets-auto-appear-in-streams.md`) for a future cycle.

## Consequences

- **Enables:** Continuous bidirectional sync of kind 10040 events (once enabled by operator). Negentropy Sync can target kind 10040.
- **Constrains:** Operators must click "📋 Presets" → "+ Add" → toggle to use the new preset. Consistent with how `WoT` and `trustedAssertions` presets are activated today.
- **New debt:** Story #3 captures the "auto-appear in main Streams list" UX improvement.
- **Firmware reinstall required?** No.

## Implementation notes

Concrete file-level guidance:

- **File: `setup/router-presets.json`** — Append a new preset object:
  ```json
  {
    "name": "treasureMaps",
    "description": "Bidirectional sync of kind 10040 (TA Treasure Maps) with popular general-purpose relays",
    "dir": "both",
    "filter": { "kinds": [10040] },
    "urls": ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"],
    "pluginDown": "",
    "pluginUp": "",
    "defaultEnabled": false
  }
  ```

- **File: `ui/src/pages/settings/RelaySettings.jsx`** — Insert into `KIND_PRESETS` (currently lines 769–774):
  ```javascript
  { label: 'Treasure Maps (10040)', kinds: [10040] },
  ```
  Place after the Profiles entry — Profiles and Treasure Maps are both per-user signal events.

- **File: `BIBLE.md` and/or `docs/CONFIGURATION.md`** — Add a short section describing the router preset system: presets in `setup/router-presets.json`; per-instance enable state at `/var/lib/brainstorm/router-state.json`; `defaultEnabled` semantics; the established discovery flow (operator clicks "📋 Presets" in the Router tab UI → "+ Add" → toggle). Append a forward-looking note that a Negentropy preset system mirroring the router preset system is planned future work, pointing at the current `KIND_PRESETS` hardcoded array as the spot a future implementer should refactor.

## Out of scope

- Auto-appear of new presets in the main Streams list (story #3).
- Preset *removal* handling.
- Auto-enabling on fresh instances (`defaultEnabled: false` is explicit).
- Author allowlisting for 10040 sync.

## Revision history

**2026-05-13** — Initial draft chose Option A (additive merge in `ensureState`). During Phase 3 (Test Design), the Tester noticed that (a) no AC required the merge, (b) the merge as scoped wouldn't actually deliver the auto-appear UX without expanding into `routerStatus.js`, and (c) the precedent (`bb4c83e7`) explicitly relies on the existing Presets-popup discovery flow without state-merge logic. The ADR was revised to Option D and the auto-appear UX was filed as story #3 for a future cycle. This is exactly the kind of mid-flow correction the engineering-team gates are designed to surface — recorded here so the pattern is visible in the project's decision history.
