/**
 * b-disposition classification — the UI mirror of src/lib/bValueForms.js (the
 * server-side single owner of the W16 ruling; ADR shared-concepts-adoption/0001).
 * A structural test pins the sentinel literal byte-identical in both homes.
 *
 * The closed b value forms: an a-tag coordinate, a bare event id, or the one
 * reserved sentinel `b-tag-deferred` — "deliberately no shared affiliation".
 * Sentinel and malformed values are skipped by every b surface; they locate
 * nothing and must never render as a lookup error.
 */

export const SENTINEL = 'b-tag-deferred';

const A_TAG_RE = /^\d+:[0-9a-f]{64}:.+$/;
const EVENT_ID_RE = /^[0-9a-f]{64}$/;

/** Classify one b value: 'a-tag' | 'event-id' | 'sentinel' | 'malformed'. */
export function classifyBValue(value) {
  if (typeof value !== 'string') return 'malformed';
  if (value === SENTINEL) return 'sentinel';
  if (A_TAG_RE.test(value)) return 'a-tag';
  if (EVENT_ID_RE.test(value)) return 'event-id';
  return 'malformed';
}

/**
 * Derive a header's disposition from its b values. deferred is true ONLY when
 * the sentinel stands alone — a real b always beats a stale sentinel.
 */
export function dispositionOf(bValues, selfCoord) {
  const values = Array.isArray(bValues) ? bValues : [];
  let wired = false;
  let selfDeclared = false;
  let sentinel = false;
  let real = false;
  for (const v of values) {
    const form = classifyBValue(v);
    if (form === 'sentinel') { sentinel = true; continue; }
    if (form === 'a-tag' || form === 'event-id') {
      real = true;
      if (v === selfCoord) selfDeclared = true;
      else wired = true;
    }
  }
  return { wired, selfDeclared, deferred: sentinel && !real };
}
