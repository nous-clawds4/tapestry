# ADR 0002: Add `treasureMaps` router preset + 10040 to Negentropy Sync

**Status:** Accepted
**Date:** 2026-05-13
**Story:** `engineering-team/stories/2-treasure-maps-router-preset.md`

## Context

Story #2 asks for two parallel changes on `/tapestry/settings/relays`:

1. **Router Management tab:** add an opt-in preset `treasureMaps` that streams kind 10040 (Treasure Maps) bidirectionally with three popular general-purpose relays.
2. **Negentropy Sync tab:** add kind 10040 as a selectable Event Kinds option.

The Router Management system is implemented in `src/api/strfry/routerConfig.js`. Presets live in `setup/router-presets.json`; per-instance enabled/disabled state lives at `/var/lib/brainstorm/router-state.json`. The activation flow is: UI POSTs `/api/strfry/router-toggle` → updates `router-state.json` → `generateConfig(state.streams)` → writes `/etc/strfry-router-tapestry.config` → `supervisorctl restart strfry-router`. An existing preset `dcosl` uses `dir: "both"` and is the natural template.

The Negentropy Sync UI's Event Kinds picker is a hardcoded `KIND_PRESETS` array in `ui/src/pages/settings/RelaySettings.jsx` (lines 769–774). The sync backend passes the kinds array transparently to `strfry sync`, so adding a kind is purely a UI config change.

**The hidden architectural complexity is in upgrade behavior.** `ensureState()` in `routerConfig.js` (lines 56–77) is one-shot: it initializes `router-state.json` from `router-presets.json` only if no state file exists. After first boot, the state file is the source of truth and is never re-synced with presets. So *adding a new preset to `router-presets.json` does not automatically surface it on existing instances* — `router-state.json` already exists and doesn't know about the new preset. An operator would have to either click "Restore Defaults" (resets *all* preset states, destroying operator-set toggles) or manually delete the state file (loses non-preset custom streams). Neither is an acceptable upgrade path.

The Concept Graph at `/api/concept-graph/summaries` was consulted (36 foundational concepts: `nostr-event`, `nostr-kind`, `web-of-trust`, `graperank`, etc.). Router presets, treasure maps, and negentropy are not yet modeled in the graph. No firmware reinstall is required for this change — no concept schemas are modified.

## Options considered

### Option A — Additive merge in `ensureState()` (chosen)

Modify `ensureState()` so that on every call, it additively merges presets from `router-presets.json` into the loaded state. For each preset whose `name` is *not* already in `state.streams`, append a new stream entry using the preset's `defaultEnabled`. Presets already in state are left untouched — operator-set toggles are preserved.

**Pros:**
- New presets appear on existing instances on the next deploy with their `defaultEnabled` setting respected (off for `treasureMaps`, satisfying the opt-in AC).
- Operator-set state for existing presets is never overwritten.
- Small change — ~10 lines of new logic in one function. No schema migration.
- Symmetrical with the existing `handleRestoreDefaults` shape, just narrower.

**Cons:**
- Subtlety: a preset *removed* from `router-presets.json` would linger as an orphan in state. Acceptable — no removals planned, can be added later if needed.
- Runs on every `ensureState()` call (per-request via the toggle handler). Negligible cost — a JSON parse and a list comparison over ~10 items.

### Option B — Document "click Restore Defaults to pick up new presets"

Don't modify `ensureState()`. Document in BIBLE.md / OPERATIONS.md that whenever new presets land, operators must click "Restore Defaults" to pick them up.

**Pros:**
- Zero code change.

**Cons:**
- Invisible behavior change. Operators wouldn't know the new preset exists unless they read the changelog.
- "Restore Defaults" is destructive — it overwrites all preset enable states. An operator who's carefully toggled some on / others off would lose those choices.
- The problem recurs for every future preset addition.

### Option C — Refactor: presets are the source of truth, state file is a sparse overlay

State file stores only `{name: enabled}` overrides. At config-generation time, merge presets (definitions) with state (overrides).

**Pros:**
- Cleaner conceptual model. Solves preset removal cleanly. Preset definition updates (URL changes, filter changes) would also propagate automatically.

**Cons:**
- Larger refactor touching `loadState`, `saveState`, `generateConfig`, `handleToggleStream`, `handleUpdateRouterConfig`, `handleRestoreDefaults`. Out of proportion to this story's scope.
- Risk of regressions in handling of non-preset custom streams (operator-added URLs/filters).
- Better as its own cleanup story when preset churn justifies it.

## Decision

We chose **Option A** — additive merge in `ensureState()`. Solves the upgrade-path problem with the minimum change footprint, preserves operator-set toggle state, and the orphaned-preset cost is acceptable given no removals are planned. Option C is the right long-term shape but is out of scope for this story.

## Consequences

- **Enables:** Future preset additions become deploy-and-done — operators see new presets in the UI on the next deploy with the documented `defaultEnabled` state.
- **Constrains:** A removed preset persists in state until manually cleared. Acceptable; follow-up cleanup possible.
- **Edge case for future:** If a future preset is added with `defaultEnabled: true`, the merge surfaces it as enabled in state but won't push the config (no `applyConfig` call inside `ensureState`). The new stream wouldn't run until the operator triggers any action that calls `applyConfig`. Not an issue for `treasureMaps` (defaultEnabled: false) but worth noting in code comments. Trivially fixable later by calling `applyConfig(state)` from `ensureState()` after `appended === true`, but deferred until we actually add a `defaultEnabled: true` preset — needless restart on every cold boot otherwise.
- **Firmware reinstall required?** No — no concept schemas changed.

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

- **File: `src/api/strfry/routerConfig.js`** — Modify `ensureState()` (currently lines 56–77). After the existing early-init path, add an additive merge pass:
  1. Load presets.
  2. Build a Set of existing stream names from `state.streams`.
  3. For each preset whose `name` is not in that set, push a new stream entry with the preset's fields and `enabled: !!p.defaultEnabled, preset: true`.
  4. If any entries were appended, call `saveState(state)` once before returning.
  
  **Critical constraint:** do not touch existing entries. Operator-set toggles must be preserved.

- **File: `ui/src/pages/settings/RelaySettings.jsx`** — Insert into `KIND_PRESETS` (currently lines 769–774):
  ```javascript
  { label: 'Treasure Maps (10040)', kinds: [10040] },
  ```
  Place it after the Profiles entry — Profiles and Treasure Maps are both per-user signal events, so they belong adjacent.

- **File: `BIBLE.md` and/or `docs/CONFIGURATION.md`** — Add a short section describing the router preset system: presets in `setup/router-presets.json`, per-instance enable state at `/var/lib/brainstorm/router-state.json`, `defaultEnabled` semantics, and the additive-merge upgrade behavior introduced by this ADR. Append a forward-looking note that a Negentropy preset system mirroring this design is planned future work, pointing at the current `KIND_PRESETS` hardcoded array as the spot a future implementer should refactor.

## Out of scope

- Preset *removal* handling in `ensureState()`.
- Option C-style refactor.
- Auto-enabling on fresh instances (`defaultEnabled: false` is explicit).
- Author allowlisting for 10040 sync.
