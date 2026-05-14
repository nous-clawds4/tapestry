# ADR 0003: Scheduled task to refresh Meilisearch profiles and House PoV WoT scores

**Status:** Accepted
**Date:** 2026-05-13
**Story:** `engineering-team/stories/4-scheduled-search-and-house-scores-refresh.md`

## Context

Story #4 asks for a new operator-controlled scheduled task that, when enabled, periodically (a) refreshes kind-0 profile data in Meilisearch and (b) refreshes House PoV WoT scores in Meilisearch from House's latest kind 30382 Trusted Assertions. The current relevant state:

- **Scheduler module** (`src/api/scheduled-tasks/index.js`): hardcoded to a single task `updateAllScoresForOwner`. Module-level state (`schedulerTimer`, `nextRunAt`, `lastRunAt`, `taskRunning`) and the three handlers (`handleStatus`, `handleUpdate`, `handleHistory`) all reference the single task name. The persisted JSON at `/var/lib/brainstorm/scheduled-tasks.json` is already keyed by task name (`{ updateAllScoresForOwner: {...} }`), so storage is extensible — only runtime state and handlers are not.
- **Panel UI** (`ui/src/pages/settings/RelaySettings.jsx:1359-1560`): `ScheduledTasksPanel` renders one settings-group card for the existing task plus a "Recent Runs" card. Fetches `/api/scheduled-tasks/{status,history}` and POSTs `/api/scheduled-tasks/update` with `{ enabled, intervalDays, intervalHours }` — no taskId passed.
- **House PoV** lives in `settings.grapevine.searchPreferences` (`povPubkey`, `delegatedPubkey`, `nip85Relay`, `metrics`). Readable via `GET /api/grapevine/preferences` (public route, registered at `src/api/index.js:299`). Defaults are null.
- **Owner-side score load** (`src/algos/nip85/loadScoresIntoMeilisearch.sh` + `.js`): `.sh` does Phase 1 — `strfry sync <nip85_relay> --filter '{"kinds":[30382],"authors":["<TA_pubkey>"]}' --dir down` — then Phase 2 — invokes the `.js`, which `strfry scan`s local 30382 events, parses metric tags, and POSTs `/api/search/profiles/meili/load-scores` with `{ povPubkey, delegatedPubkey, metrics, scores }`. The `.js` is hardcoded to the owner: reads `BRAINSTORM_OWNER_PUBKEY` from config and calls `getOwnerAssistantPubkey()`.
- **Profile ingest trigger**: `POST /api/search/profiles/meili/resync` (registered at `src/api/index.js:326`, handler `handleMeiliResync` in `src/api/search/profiles/meili/index.js:307-318`) proxies to `nostr-search-api`'s `/api/bulk-ingest` which runs `runBulkIngest()`. Callable from the tapestry container via `curl http://127.0.0.1:7778/...`.
- **Task registry** (`src/manage/taskQueue/taskRegistry.json`): tasks invoked via `POST /api/run-task?taskName=...` must have an entry pointing to their script.
- **Treasure Map (kind 10040) sync**: ADR 0002 (story #2) added the `treasureMaps` router preset for continuous bidirectional 10040 sync with popular relays. Operator-opt-in, defaults off. The new task should not assume the preset is enabled.
- **Concept Graph**: `/api/concept-graph/summaries` confirms 34 foundational concepts (`graperank`, `web-of-trust`, `nostr-kind`, `nostr-event`, `nostr-user`, `nostr-relay`). NIP-85 / Trusted Assertions / Treasure Maps / House PoV / Meilisearch / Scheduled Tasks are not modeled. This ADR does not alter any concept schema. **No firmware reinstall required.**

## Options considered

### Option A — Generalize scheduler module + parameterize the loader (chosen)

1. **Scheduler module:** Refactor `src/api/scheduled-tasks/index.js` so runtime state is keyed by `taskId`. Module-level `schedulerTimer`/`nextRunAt`/etc. become `Map<taskId, timerState>`. Handlers take `taskId` from `req.query.taskId` (GET) / `req.body.taskId` (POST) — required, no default. `DEFAULTS` becomes an object keyed by taskId with two entries (`updateAllScoresForOwner`, `refreshSearchIndex`). `initScheduler()` iterates `Object.keys(DEFAULTS)`.
2. **Orchestrator script:** new `src/algos/refreshSearchIndex.sh`. Order: (1) fetch House PoV from `GET /api/grapevine/preferences`, (2) trigger profile resync via `POST /api/search/profiles/meili/resync`, (3) if PoV set: defensive `strfry sync` of House's kind 10040 + kind 30382 from House's NIP-85 relay, then invoke parameterized loader, (4) if PoV unset: emit a `WARN` structured event with `houseUnconfigured: true` and exit 0 (success — partial run; profile sync still happened).
3. **Parameterize the loader:** `loadScoresIntoMeilisearch.js` accepts optional CLI args `--povPubkey` and `--delegatedPubkey`. If omitted, falls back to current owner behavior (`BRAINSTORM_OWNER_PUBKEY` + `getOwnerAssistantPubkey()`) — preserving the existing `updateAllScoresForOwner.sh` step 7 call unchanged.
4. **Task registry:** add `refreshSearchIndex` entry in `taskRegistry.json` pointing to the new orchestrator script.
5. **UI:** Extract the existing settings-group at `RelaySettings.jsx:1463-1510` into a `<ScheduledTaskCard taskId, title, hint, children />` sub-component. `ScheduledTasksPanel` renders two cards. New card adds a pre-run banner via `children` that fetches `/api/grapevine/preferences` and renders when `povPubkey` is unset, linking to the Search Preferences page. Recent Runs section per-task.

**Pros:**
- Smallest delta to the storage format (already keyed by task name).
- DRY — no parallel modules, no parallel loader scripts.
- Future scheduled tasks add as a registry entry + a card, not new modules.
- Parameterization keeps the existing owner script unchanged at the call site.

**Cons:**
- Touches the existing scheduler module + loader script. Some regression risk for the existing Owner path (mitigated by story #4 AC-11 "existing panel unregressed" and test coverage in Phase 3).
- Slightly more upfront work than duplication, but pays off the first time anyone adds a third task.

### Option B — Duplicate the scheduler module + duplicate the loader

Create `src/api/scheduled-tasks/refreshSearchIndex/index.js` as a parallel module — same shape as the existing one but hardcoded to the new task. New routes `/api/scheduled-tasks/refresh/{status,update,history}`. Clone `loadScoresIntoMeilisearch.js` as `loadHouseScoresIntoMeilisearch.js`.

**Pros:**
- Zero risk to the existing Owner code path.
- Each module is independent.

**Cons (why rejected):**
- Parallel scheduler modules will drift. Bug fixes (e.g., the PID-polling logic at `src/api/scheduled-tasks/index.js:80-94`) must be applied twice.
- Parallel loader scripts double the surface area for identical logic (parse 30382 → POST scores).
- Front-end gets two panels with duplicated state-management code.
- A third task multiplies the problem.

### Option C — Add the new task inline as a second hardcoded entry (hybrid)

Don't fully generalize; add a second set of module-level state vars and a second trigger function alongside the existing one. UI gets a second card written inline (no shared sub-component).

**Pros:**
- Less invasive than Option A.

**Cons (why rejected):**
- Inherits the "parallel state vars" tax of Option B at the module level, just in one file instead of two.
- Doesn't address panel duplication.
- Half-measure: still ends up generalizing later when the 3rd task lands. The storage format is already keyed by taskId — fighting that gives nothing back.

## Decision

We chose **Option A**.

The persisted config is already keyed by `taskId`, which is the strongest hint that generalization is the natural shape — Options B and C both fight against the data model. The marginal cost over Option C (Map<taskId,state> vs two sets of named vars) is small, and the marginal cost over Option B (one module vs two) avoids the predictable drift between parallel modules over time. The parameterization of `loadScoresIntoMeilisearch.js` keeps the existing `updateAllScoresForOwner.sh` step 7 call unchanged.

We trade away short-term simplicity of "leave the working code alone." We accept some regression risk in the existing Owner scheduler in exchange for a clean foundation that any future scheduled task can build on.

## Consequences

- **Enables:** A second operator-controlled scheduled task (default off), independently scheduled from the existing Owner task. Future tasks add as one registry entry + one card.
- **Constrains:** Scheduler API now requires `taskId`. The UI is the only known caller and is updated in the same PR. If unknown external callers exist (legacy scripts, monitoring), they will fail loudly with a 400, surfacing themselves for fix-up rather than silently defaulting.
- **New debt:** None significant. The existing 24h `runBulkIngest()` schedule in `nostr-search/src/startup.js` continues alongside the new task; reconciling them into a single source of truth for profile-sync cadence is deferred to a separate story (noted in story #4 "Out of scope").
- **Firmware reinstall required?** No.

## Implementation notes

Concrete guidance for the Implementer:

- **File: `src/api/scheduled-tasks/index.js`** — refactor to `Map<taskId, timerState>`. New `DEFAULTS`:
  ```js
  const DEFAULTS = {
    updateAllScoresForOwner: { enabled: false, intervalHours: 24, intervalDays: 0 },
    refreshSearchIndex:      { enabled: false, intervalHours: 24, intervalDays: 0 },
  };
  ```
  Each handler reads `taskId` from `req.query.taskId` (status, history) or `req.body.taskId` (update); returns 400 if absent or unknown. The PID-tracking logic in `triggerTask` moves into a per-task closure so concurrent runs of different tasks don't interfere. `initScheduler()` iterates `Object.keys(DEFAULTS)`.

- **File: `src/algos/refreshSearchIndex.sh`** — new orchestrator using the structured-logging helpers in `src/utils/structuredLogging.sh`. Pseudo-sequence:
  ```bash
  emit_task_event TASK_START refreshSearchIndex
  prefs=$(curl -s http://127.0.0.1:7778/api/grapevine/preferences | jq .preferences)
  pov=$(echo "$prefs" | jq -r '.povPubkey // empty')
  deleg=$(echo "$prefs" | jq -r '.delegatedPubkey // empty')
  relay=$(echo "$prefs" | jq -r '.nip85Relay // empty')

  emit_task_event PROGRESS refreshSearchIndex '{"phase":"profile_resync"}'
  curl -s -X POST http://127.0.0.1:7778/api/search/profiles/meili/resync

  if [ -n "$pov" ] && [ -n "$deleg" ]; then
    emit_task_event PROGRESS refreshSearchIndex '{"phase":"sync_house_10040"}'
    strfry sync "$relay" --filter "{\"kinds\":[10040],\"authors\":[\"$pov\"]}" --dir down

    emit_task_event PROGRESS refreshSearchIndex '{"phase":"sync_house_30382"}'
    strfry sync "$relay" --filter "{\"kinds\":[30382],\"authors\":[\"$deleg\"]}" --dir down

    emit_task_event PROGRESS refreshSearchIndex '{"phase":"load_house_scores"}'
    node "$BRAINSTORM_NIP85_DIR/loadScoresIntoMeilisearch.js" \
         --povPubkey "$pov" --delegatedPubkey "$deleg"
  else
    emit_task_event WARN refreshSearchIndex '{"houseUnconfigured":true}'
  fi
  emit_task_event TASK_END refreshSearchIndex
  ```

- **File: `src/algos/nip85/loadScoresIntoMeilisearch.js`** — accept optional `--povPubkey <hex>` and `--delegatedPubkey <hex>` CLI args. When both omitted, fall back to current owner behavior. The `getAssistantKeys(pubkey)` helper at `src/utils/assistantKeys.js:20` is available if a future story needs delegated-pubkey resolution from an arbitrary pubkey; not required here since House's delegated pubkey is read from settings.

- **File: `src/manage/taskQueue/taskRegistry.json`** — add a `refreshSearchIndex` entry. Mirror the shape of nearby leaf-task entries; point `script`/`script_relative_path` at `src/algos/refreshSearchIndex.sh`. Single category `algorithms` or `network` (Architect leaves the category pick to the Implementer's read of the registry).

- **File: `ui/src/pages/settings/RelaySettings.jsx`** — extract `RelaySettings.jsx:1463-1510` (the existing settings-group div) into a `<ScheduledTaskCard>` sub-component with props `{ taskId, title, hint, banner? }`. Refactor `ScheduledTasksPanel` to render two cards. New card props: `taskId="refreshSearchIndex"`, `title="Refresh Meilisearch profiles & House PoV scores"`, plus a `banner` prop containing a `<HousePovUnconfiguredBanner />` that fetches `/api/grapevine/preferences` once on mount and conditionally renders. The banner should link to the Search Preferences route (Implementer: verify the exact route in the existing Search Preferences page before hardcoding).

  The card fetches `/api/scheduled-tasks/status?taskId=<id>` and `/api/scheduled-tasks/history?taskId=<id>`, and POSTs to `/api/scheduled-tasks/update` with `{ taskId, enabled, intervalDays, intervalHours }`. Recent Runs table renders per-task.

- **File: `BIBLE.md` or `docs/CONFIGURATION.md`** — add a short paragraph: "Scheduled Tasks tab now hosts two independently-controllable tasks: 'Update All Scores for Owner' (existing) and 'Refresh Meilisearch profiles & House PoV scores' (new). The latter depends on (a) House PoV being configured at Home > My Grapevine > Search Preferences, and (b) for kind 10040 freshness, the `treasureMaps` router preset being enabled — though the task also runs a defensive one-shot 10040 sync per fire."

## Out of scope

- **Replacing the built-in 24h `runBulkIngest()` schedule in `nostr-search/src/startup.js`.** A future story can make that scheduler a no-op when the new admin-controlled task is enabled (or wire both through a single source of truth).
- **Author allowlists, per-task throttling, dynamic relay overrides** beyond the schedule controls.
- **A House PoV preset/shortcut UI** for configuring the pubkey from the new panel — Search Preferences page owns that.
- **Generalizing `loadScoresIntoMeilisearch.js` to N observers in a loop.** This ADR adds support for one named observer (House); N-observer generalization can come if a future story needs it.
- **Cleaning up the `/etc/strfry-router-tapestry.config` missing-on-first-boot issue** observed during local bring-up. Separate follow-up.
