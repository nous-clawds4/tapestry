/**
 * NIP-56 report-type label formatting. Pure — no DOM/React imports (kept
 * unit-testable from node; the verified-reporters #4 suite imports it directly).
 */

// Special-case labels that differ from a plain capitalization. Empty for now; add
// entries here if a token needs a non-capitalized display (e.g. an acronym).
const REPORT_TYPE_LABELS = {};

/**
 * Convert a NIP-56 report_type token (e.g. "spam", "impersonation") to a friendly,
 * human-readable label ("Spam", "Impersonation"). Unknown tokens are capitalized
 * as-is. Missing/empty input yields "" (caller renders an empty cell).
 *
 * @param {string} token - raw report_type from the REPORTS edge
 * @returns {string} friendly label, or "" for missing/empty input
 */
export function humanizeReportType(token) {
  if (!token) return '';
  if (REPORT_TYPE_LABELS[token]) return REPORT_TYPE_LABELS[token];
  const s = String(token);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
