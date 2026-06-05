/**
 * Scheduled Tasks config migration (story #24 / ADR 0021).
 *
 * One-way migration from ADR 0019's per-task flat shape:
 *   { [taskId]: { enabled, intervalDays, intervalHours, intervalMinutes, cron } }
 * to the v2 entries-array shape:
 *   { version: 2, entries: [{ id, taskId, label, args, enabled, intervalDays, intervalHours, intervalMinutes, cron, lastError? }, ...] }
 *
 * Properties:
 *   - **Idempotent.** A v2 input is returned unchanged. Safe to call on every
 *     readConfig() — the live scheduler does exactly that.
 *   - **Deterministic.** Migrated entries get stable IDs prefixed with
 *     "legacy:" so any historical caller that knows only the taskId can
 *     resolve to the migrated entry without operator action.
 *   - **Bit-for-bit preservation** of ALL FIVE schedule fields — story #24
 *     AC-11 ("Existing entries survive the upgrade"). ADR 0019 added
 *     intervalMinutes and cron to story #4's three-field shape; the migrator
 *     preserves all five.
 *   - **Empty input safety.** A `{}` or `null` input produces
 *     `{ version: 2, entries: [] }` (the fresh-install posture).
 *
 * The label for each migrated entry is sourced from
 * `registry.tasks[taskId]?.name` when available, falling back to the raw
 * taskId. The UI may override this for cosmetic continuity with story #4's
 * exact titles ("Update All Scores for Owner",
 * "Refresh Meilisearch profiles & House PoV scores") — see RelaySettings.jsx
 * LEGACY_TITLE_OVERRIDES.
 *
 * Used by:
 *   - src/api/scheduled-tasks/index.js → readConfig()
 *   - test/scheduled-tasks-with-arguments.test.js → T1-T5
 */

function migrateConfigIfNeeded(loadedJson, registry) {
  // Empty/null/non-object input: fresh-install posture.
  if (!loadedJson || typeof loadedJson !== 'object' || Array.isArray(loadedJson)) {
    return { version: 2, entries: [] };
  }

  // Already v2: pass through unchanged (idempotent).
  if (loadedJson.version === 2 && Array.isArray(loadedJson.entries)) {
    return loadedJson;
  }

  // v1 → v2 conversion. Each top-level key is a taskId; its value is the
  // ADR 0019 shape with up to 5 schedule fields.
  const entries = [];
  for (const [taskId, cfg] of Object.entries(loadedJson)) {
    if (!cfg || typeof cfg !== 'object') continue;
    const id = `legacy:${taskId}`;
    const label = (registry && registry.tasks && registry.tasks[taskId] && registry.tasks[taskId].name) || taskId;
    entries.push({
      id,
      taskId,
      label,
      args: {},
      enabled: !!cfg.enabled,
      intervalDays:    typeof cfg.intervalDays    === 'number' ? cfg.intervalDays    : 0,
      intervalHours:   typeof cfg.intervalHours   === 'number' ? cfg.intervalHours   : 0,
      intervalMinutes: typeof cfg.intervalMinutes === 'number' ? cfg.intervalMinutes : 0,
      cron:            typeof cfg.cron            === 'string' ? cfg.cron            : '',
    });
  }

  return { version: 2, entries };
}

module.exports = { migrateConfigIfNeeded };
