/**
 * Relative "time ago" formatting. Pure — no DOM/React imports (kept unit-testable
 * from node; the verified-reporters #4 suite imports formatTimeAgo directly).
 *
 * Two exports, different consumers (merged from staging + the tag-stack branch):
 *   - `timeAgo`       — single-unit compact string ("3d ago"); tag-stack UI
 *                       (BrainstormProfile, AuthoredTaggingSection, ExportModal).
 *   - `formatTimeAgo` — multi-unit string ("3d, 4h, 12m ago"); verified-reporters.
 */

const MIN = 60, HOUR = 3600, DAY = 86400, MONTH = 30 * DAY, YEAR = 365 * DAY;

/**
 * Single-unit relative string. Returns null for missing/zero input.
 * @param {number} unixSeconds - unix SECONDS (nostr created_at)
 * @returns {string|null} e.g. "just now" / "5m ago" / "3d ago" / "2y ago"
 */
export function timeAgo(unixSeconds) {
  if (!unixSeconds) return null;
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  if (diff < MIN) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < MONTH) return `${Math.floor(diff / DAY)}d ago`;
  if (diff < YEAR) return `${Math.floor(diff / MONTH)}mo ago`;
  return `${Math.floor(diff / YEAR)}y ago`;
}

/**
 * Format a unix timestamp (SECONDS) as a compact, multi-unit relative string,
 * e.g. "3d, 4h, 12m ago". Shows the most-significant non-zero units among
 * years / days / hours / minutes (minute is the smallest unit); zero-valued units
 * are dropped. Sub-minute and future timestamps render "0m ago".
 *
 * @param {number} unixSeconds - report time as unix SECONDS (nostr created_at)
 * @param {number} [now] - current time in unix seconds (injectable for tests)
 * @param {Object} [opts]
 * @param {number} [opts.maxUnits=3] - how many of the most-significant non-zero units to show
 * @param {string} [opts.separator=', '] - string joining the units (e.g. ' ' → "4h 53m ago")
 * @returns {string} e.g. "2y, 14d, 3h ago" / "45m ago" / "0m ago"; "" for missing/invalid input
 */
export function formatTimeAgo(unixSeconds, now = Math.floor(Date.now() / 1000), { maxUnits = 3, separator = ', ' } = {}) {
  if (unixSeconds == null || !Number.isFinite(Number(unixSeconds))) return '';

  let rem = Math.max(0, Math.floor(now - Number(unixSeconds)));
  const units = [['y', Math.floor(rem / YEAR)]];
  rem %= YEAR;
  units.push(['d', Math.floor(rem / DAY)]); rem %= DAY;
  units.push(['h', Math.floor(rem / HOUR)]); rem %= HOUR;
  units.push(['m', Math.floor(rem / MIN)]);

  const parts = units
    .filter(([, v]) => v > 0)   // drop zero-valued units
    .slice(0, maxUnits)         // the most-significant remaining
    .map(([u, v]) => `${v}${u}`);

  return `${parts.length ? parts.join(separator) : '0m'} ago`;
}
