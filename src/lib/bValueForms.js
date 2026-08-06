/**
 * b-tag value forms — the single code owner of the W16 ruling (ADR
 * shared-concepts-adoption/0001; spec: protocols/drafts/inherit-from.md
 * § "The `b` tag", protocols/drafts/shared-concepts.md § "Deliberate
 * non-affiliation").
 *
 * The closed value forms: an a-tag coordinate, a bare event id, or the one
 * reserved sentinel `b-tag-deferred` ("deliberately no shared affiliation").
 * Everything else is malformed and MUST derive nothing anywhere.
 *
 * Pure CJS, zero requires. The UI mirror (ui/src/utils/bDisposition.js)
 * restates classifyBValue/dispositionOf for the browser bundle; a structural
 * test pins the sentinel literal identical in both homes.
 */

'use strict';

const SENTINEL = 'b-tag-deferred';

const A_TAG_RE = /^\d+:[0-9a-f]{64}:.+$/;
const EVENT_ID_RE = /^[0-9a-f]{64}$/;

/** Classify one b value: 'a-tag' | 'event-id' | 'sentinel' | 'malformed'. */
function classifyBValue(value) {
  if (typeof value !== 'string') return 'malformed';
  if (value === SENTINEL) return 'sentinel';
  if (A_TAG_RE.test(value)) return 'a-tag';
  if (EVENT_ID_RE.test(value)) return 'event-id';
  return 'malformed';
}

/**
 * Derive a header's disposition from its b values. A "real" b is any valid
 * a-tag or event-id claim. deferred is true ONLY when the sentinel stands
 * alone — a real b always beats a stale sentinel (mutual-exclusivity rule).
 */
function dispositionOf(bValues, selfCoord) {
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

/** Remove sentinel b tags, preserving every other tag in order. No-op safe. */
function stripSentinel(tags) {
  return (Array.isArray(tags) ? tags : []).filter((t) => !(t && t[0] === 'b' && t[1] === SENTINEL));
}

module.exports = { SENTINEL, A_TAG_RE, EVENT_ID_RE, classifyBValue, dispositionOf, stripSentinel };
