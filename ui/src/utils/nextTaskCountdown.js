/**
 * Pure formatting/state helpers for the Scheduled Tasks panel's aggregate
 * countdown line (deploy-safety-gate Story 3 / ADR 0003). Extracted from
 * NextScheduledTaskLine (ui/src/pages/settings/RelaySettings.jsx) so the
 * logic is unit-testable — the Node harness can dynamic-import this plain
 * .js; it can't parse JSX (the povNoticeText precedent).
 *
 * Input is the /api/deploy-safety/status payload (ADR deploy-safety-gate/
 * 0001's contract — this line is its second consumer, after the story #2
 * ops tooling). The helper never re-derives "which task is next" from
 * other payload fields: schedule.nextFire IS the verdict's own
 * soonest-among-enabled selection, so the panel and the merge gate can
 * never disagree (story AC-5, held structurally).
 */

/**
 * Render a remaining-time span at hours-and-minutes granularity
 * (ADR 0003 sub-decision 3). Ceiling rounding on total minutes, so the
 * display never claims a fire is later than it is by more than the
 * granularity and never shows "0 minutes" while time remains. Zero-valued
 * units are dropped ("1 hour", never "1 hour and 0 minutes"); no seconds
 * at any magnitude.
 *
 * @param {number} remainingMs
 * @returns {string|null} e.g. "2 days, 3 hours and 12 minutes",
 *   "1 hour and 5 minutes", "23 minutes" — or null when remainingMs ≤ 0
 *   (the component's transitional "moves on" seam, story AC-3).
 */
export function formatTimeToFire(remainingMs) {
  if (typeof remainingMs !== 'number' || !Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const unit = (n, name) => `${n} ${name}${n === 1 ? '' : 's'}`;
  const parts = [];
  if (days > 0) parts.push(unit(days, 'day'));
  if (hours > 0) parts.push(unit(hours, 'hour'));
  if (minutes > 0) parts.push(unit(minutes, 'minute'));
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Map a /api/deploy-safety/status payload to one of the four display
 * states (ADR 0003 sub-decision 4):
 *
 *   countdown      — a nextFire exists; carries its identity verbatim
 *   none-upcoming  — queue enabled, state known, no nextFire
 *   queue-disabled — the task-queue layer is switched off (wins over any
 *                    stray nextFire: a disabled queue will not fire it)
 *   unknown        — fetch failed / malformed payload / success !== true /
 *                    queue.stateKnown === false — never "nothing
 *                    scheduled" when the truth is unavailable (AC-4)
 *
 * @param {object|null|undefined} statusJson
 * @returns {{state: string, entryId?: string, taskId?: string, label?: string, at?: string}}
 */
export function deriveNextTaskLine(statusJson) {
  if (!statusJson || typeof statusJson !== 'object' || statusJson.success !== true) {
    return { state: 'unknown' };
  }
  const queue = statusJson.queue;
  if (!queue || typeof queue !== 'object') return { state: 'unknown' };
  if (queue.enabled === false) return { state: 'queue-disabled' };
  if (queue.stateKnown !== true) return { state: 'unknown' };
  const nextFire = statusJson.schedule && statusJson.schedule.nextFire;
  if (!nextFire || !nextFire.at) return { state: 'none-upcoming' };
  return {
    state: 'countdown',
    entryId: nextFire.entryId,
    taskId: nextFire.taskId,
    label: nextFire.label,
    at: nextFire.at,
  };
}
