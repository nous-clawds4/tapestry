/**
 * TL membership-method registry + resolver (ADR trusted-lists/0001).
 *
 * The pipeline-wide membership method is operator configuration stored in
 * the two-layer settings store (src/config/settings.js) under
 * `trustedLists.membershipMethod`. This module is the single source of
 * truth for the method ids (mirrored as a UI constant in
 * ui/src/pages/grapevine/TrustDetermination.jsx — no shared module system
 * in this no-build project).
 *
 * METHOD_IDS is the full four-rung ladder, wire-stable; rungs 2–4 move
 * into IMPLEMENTED_METHOD_IDS as their stories land.
 */

// All ladder methods, in rung order. These strings ride the published TL's
// ['membership-method', <id>] tag — never rename them.
const METHOD_IDS = ['count', 'input', 'certainty', 'score'];

// Methods the pipeline can actually execute today. Story 1: count only.
const IMPLEMENTED_METHOD_IDS = ['count'];

/**
 * Resolve the active membership method for the TL refresh pipeline.
 *
 * Reads settings fresh on every call (getSettings re-reads disk), so an
 * operator switch applies to the next refresh with no restart. Fail-safe:
 * anything that is not an *implemented* method — unknown strings, malformed
 * settings, valid-but-future ids stored early — resolves to 'count'. The
 * pipeline must never refuse to refresh because settings hold a bad value.
 */
function resolveMembershipMethod() {
  try {
    // Lazy require, matching getAdminPubkeys in src/utils/config.js.
    const { getSettings } = require('../../config/settings');
    const value = getSettings()?.trustedLists?.membershipMethod;
    if (IMPLEMENTED_METHOD_IDS.includes(value)) return value;
  } catch { /* settings unreadable → fall through to the default */ }
  return 'count';
}

module.exports = { METHOD_IDS, IMPLEMENTED_METHOD_IDS, resolveMembershipMethod };
