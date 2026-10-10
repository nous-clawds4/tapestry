# Small polish items from the negentropy-presets reviews: a second auth layer, the tab's view of scheduled runs, a sticky pre-fill, literal timeout texts

**Id:** 2026-10-10-presets-review-polish
**Type:** cleanup
**Opened:** 2026-10-10 (relay-stream-gaps #3 reviews, round 1 non-blocking 4, 7, 8; round 2 R2-3)
**Status:** OPEN
**Done:** —

- **Second auth layer (round 1, 4).** The presets' POSTs are gated only in the handler (`requireOwnerOrLocal`). The
  router's POSTs are also listed in `ownerOnlyEndpoints` (`src/middleware/auth.js:388–430`). Adding
  `'/strfry/negentropy-presets'` there matches the router (the check is POST-only, so the list stays readable). The
  reused 403 text mentions "the relay router" (`routerConfig.js:28`).
- **The tab only follows a scheduled run it saw when it opened (round 1, 7).** A run that starts later goes
  unnoticed, and Start then fails silently (the stream's 409 can't be read by `EventSource`;
  `ui/src/pages/settings/RelaySettings.jsx:942–956,967–986`). Check `/negentropy-sync/status` before opening the
  stream and say "A sync is already in progress".
- **The Add dialog's pre-filled interval sticks (round 1, 8).** Picking Sync Negentropy Presets and then another task
  leaves 6 h instead of 24 h (`ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx:62–66`).
- **"60 s" and "10 minutes" are literal strings (round 2, R2-3)** in `parseSyncOutput`
  (`src/api/strfry/negentropyPresets.js:162–167`), not built from `RELAY_STALL_MS` / `SYNC_TIMEOUT_MS`; R13 would still
  pass if the constant moved. Build the texts from the constants or comment the coupling.

**Pointer:** `engineering-team/reviews/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md` (round 1 non-blocking
4, 7, 8; round 2 R2-3).
