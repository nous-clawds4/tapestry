/**
 * URL helpers. Pure — no DOM/React imports (kept unit-testable from node).
 */

/**
 * Normalize a user-entered website value to an absolute, externally-navigable
 * http(s) URL.
 *
 * A scheme-less value (e.g. "example.com") used directly as an `<a href>` is
 * treated by the browser as a path relative to the current page, so it must get
 * a scheme. Values that already carry an http(s):// scheme are returned
 * unchanged; empty/falsy input yields '' (caller renders no link).
 *
 * @param {string} value - raw website string (e.g. from a kind-0 `website` field)
 * @returns {string} absolute http(s) URL, or '' for empty input
 */
export function toExternalUrl(value) {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
