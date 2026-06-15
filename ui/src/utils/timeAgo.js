/**
 * Relative "time ago" formatting. Pure — no DOM/React imports (kept unit-testable
 * from node; the verified-reporters #4 suite imports it directly).
 */

const MIN = 60, HOUR = 3600, DAY = 86400, YEAR = 365 * DAY;

/**
 * Format a unix timestamp (SECONDS) as a compact, multi-unit relative string,
 * e.g. "3d, 4h, 12m ago". Shows the 3 most-significant non-zero units among
 * years / days / hours / minutes (minute is the smallest unit); zero-valued units
 * are dropped. Sub-minute and future timestamps render "0m ago".
 *
 * @param {number} unixSeconds - report time as unix SECONDS (nostr created_at)
 * @param {number} [now] - current time in unix seconds (injectable for tests)
 * @returns {string} e.g. "2y, 14d, 3h ago" / "45m ago" / "0m ago"; "" for missing/invalid input
 */
export function formatTimeAgo(unixSeconds, now = Math.floor(Date.now() / 1000)) {
  if (unixSeconds == null || !Number.isFinite(Number(unixSeconds))) return '';

  let rem = Math.max(0, Math.floor(now - Number(unixSeconds)));
  const units = [['y', Math.floor(rem / YEAR)]];
  rem %= YEAR;
  units.push(['d', Math.floor(rem / DAY)]); rem %= DAY;
  units.push(['h', Math.floor(rem / HOUR)]); rem %= HOUR;
  units.push(['m', Math.floor(rem / MIN)]);

  const parts = units
    .filter(([, v]) => v > 0)   // drop zero-valued units
    .slice(0, 3)                // 3 most-significant remaining
    .map(([u, v]) => `${v}${u}`);

  return `${parts.length ? parts.join(', ') : '0m'} ago`;
}
