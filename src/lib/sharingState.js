/**
 * Sharing state — is a concept SHARED, and does this instance say so?
 * (ADR shared-concepts-legibility/0001.)
 *
 * The owner's ruling: "shared" means published to a public relay; declared
 * locally is not enough. So the answer is one predicate asked of two stores —
 * does this copy of the header carry a b tag pointing at its own coordinate?
 *
 *   local strfry  → declared here
 *   public relay  → shared
 *
 * `published` is deliberately TRI-state. `null` means the relay could not be
 * asked, and must never collapse to `false`: reporting "not shared" on the
 * strength of a check that failed to run is the exact defect the story exists
 * to remove.
 *
 * Pure CJS, zero requires (the adoptionQueue/trustedDictionary idiom).
 * b-value classification lives in src/lib/bValueForms.js and is applied at the
 * HANDLER seam — this core receives `disposition` and `wiredTo` already
 * classified, the way trustedDictionary receives its qualifying set.
 */

'use strict';

/**
 * Does `event` carry a `b` tag whose value is the event's own coordinate?
 *
 * The third tag element is the b type (`'pointer'` on the live wire) and is
 * not part of the identity test — ADR 0029 reads an absent type as pointer.
 * Malformed or missing events answer false; this never throws, because it is
 * called on relay responses we do not control.
 */
function carriesSelfPointer(event, coord) {
  if (!event || typeof coord !== 'string') return false;
  const tags = Array.isArray(event.tags) ? event.tags : [];
  for (const t of tags) {
    if (!Array.isArray(t) || t[0] !== 'b' || typeof t[1] !== 'string') continue;
    if (t[1].trim() === coord) return true;
  }
  return false;
}

/**
 * Assemble the resolved state.
 *
 * @param {object}   input
 * @param {string}   input.coord        the header's own a-tag coordinate
 * @param {object}   input.disposition  {wired, selfDeclared, deferred} from dispositionOf
 * @param {string[]} input.wiredTo      external b targets (never the self coord, never the sentinel)
 * @param {object?}  input.relayEvent   the public relay's copy of the header, if any
 * @param {boolean}  input.relayOk      false when the relay could not be reached
 * @returns {{local: {wired, selfDeclared, deferred, wiredTo}, published: (boolean|null)}}
 */
function resolveSharingState({ coord, disposition, wiredTo, relayEvent, relayOk } = {}) {
  const d = disposition || {};
  return {
    local: {
      wired: Boolean(d.wired),
      selfDeclared: Boolean(d.selfDeclared),
      deferred: Boolean(d.deferred),
      wiredTo: Array.isArray(wiredTo) ? wiredTo.slice() : [],
    },
    // Two-part test: the relay copy must EXIST and carry the self-pointer. A
    // header pushed to the relay before it was declared is present, not shared.
    published: relayOk === false ? null : Boolean(relayEvent && carriesSelfPointer(relayEvent, coord)),
  };
}

module.exports = { carriesSelfPointer, resolveSharingState };
