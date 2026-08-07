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

// The stamping cap (~5): W11/ADR 0033 ratified the shape and deliberately
// deferred the exact number to implementation. Chosen here (ADR
// shared-concepts-adoption/0004); changing it is a one-line, spec-annotated edit.
const STAMP_CAP = 5;

/**
 * Select the shared stamp targets from a header's b rows (ADR 0004): the
 * declared affiliation only — pointer-typed or untyped (absent reads as
 * pointer, ADR 0029), a-tag form only (an event-id b locates an event, not a
 * stampable concept; the sentinel and malformed values fail the form), the
 * self coordinate excluded (it is already the personal stamp), deduplicated,
 * capped. Rows are {value, type} — mirroring the graph's value/value1 columns.
 */
function selectPointerTargets(rows, selfCoord, cap = STAMP_CAP) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.value !== 'string') continue;
    if (r.type != null && r.type !== 'pointer') continue; // inherit (or future types) never stamp
    if (classifyBValue(r.value) !== 'a-tag') continue;
    if (r.value === selfCoord || seen.has(r.value)) continue;
    seen.add(r.value);
    out.push(r.value);
    if (out.length >= cap) break;
  }
  return out;
}

module.exports = { SENTINEL, A_TAG_RE, EVENT_ID_RE, STAMP_CAP, classifyBValue, dispositionOf, stripSentinel, selectPointerTargets };
