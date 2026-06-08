/**
 * kind-0 profile merge with REPLACE semantics.
 *
 * Pure (no I/O). Given an existing profile content object and a chosen
 * receiving method, produce the new profile content to publish:
 *
 *   - preserve every non-receiving field (name, about, picture, nip05, …)
 *   - clear ALL receiving fields across both families (rev. 2, Finding 2)
 *   - write exactly one receiving field (the chosen method's `field`)
 *   - strip server-derived event metadata that must never live in content
 *
 * This guarantees that after a switch there is exactly one active receiving
 * identifier, so a lingering legacy BOLT12 can't shadow a freshly-set Lightning
 * address. BOLT12 is clear-only: it is scrubbed here but never written back.
 */

const {
  ALL_RECEIVING_FIELDS,
  getOption,
  validateLud16,
  extractLnurl,
  npubCashAddress,
} = require('./walletOptions');

// kind-0 content is profile metadata; these are event-level / server-derived
// and must never be republished inside content. Stripped defensively.
const SERVER_DERIVED_FIELDS = ['pubkey', 'created_at', 'id', 'sig', 'kind', 'tags'];

/**
 * Low-level merge: clear every receiving field, then set `field`=`value`.
 * @param {object|null} existingProfile parsed kind-0 content
 * @param {string} field receiving field to write (e.g. 'lud16' | 'bolt12')
 * @param {string} value value to write
 * @returns {object} new content object
 */
function mergeReceivingField(existingProfile, field, value) {
  const next = { ...(existingProfile || {}) };
  for (const f of SERVER_DERIVED_FIELDS) delete next[f];
  for (const f of ALL_RECEIVING_FIELDS) delete next[f];
  next[field] = value;
  return next;
}

/**
 * High-level builder used by both the CLI and (later) the web picker.
 *
 * @param {object} args
 * @param {object|null} args.profile existing parsed kind-0 content
 * @param {string} args.method option id: 'npub-cash' | 'address' | 'wos' | 'fedimint' | 'lnurl'
 * @param {string} [args.value] user-supplied value (lud16 address or lnurl1… code); ignored for derived methods
 * @param {string} args.pubkeyHex target pubkey hex (used to derive npub.cash)
 * @returns {{ content: object, field: string, value: string, cleared: string[], replaced: boolean }}
 * @throws if the method is unknown or the value is missing/invalid
 */
function buildReceivingContent({ profile, method, value, pubkeyHex }) {
  const option = getOption(method);
  if (!option) {
    throw new Error(`Unknown receiving method: ${method}. Use one of: npub-cash, address, wos, fedimint, lnurl.`);
  }

  let field = option.field;
  let finalValue;

  if (option.derivesFromPubkey) {
    if (!pubkeyHex) throw new Error(`${method} requires a target pubkey to derive the address`);
    finalValue = npubCashAddress(pubkeyHex);
  } else if (field === 'lud06') {
    // LNURL-pay code (lnurl1…). Stored bech32 in lud06 (NIP convention).
    const lnurl = extractLnurl(value);
    if (!lnurl) {
      throw new Error('Expected an LNURL-pay code (lnurl1… or lightning:lnurl1…)');
    }
    finalValue = lnurl;
  } else {
    // lud16-family methods (address, wos, fedimint)
    const check = validateLud16(value);
    if (!check.valid) throw new Error(check.error);
    finalValue = check.value;
  }

  // Which receiving fields carried a value before, for reporting.
  const before = ALL_RECEIVING_FIELDS.filter(f => profile && profile[f]);
  const cleared = before.filter(f => f !== field);
  const replaced = before.includes(field) && profile[field] !== finalValue;

  const content = mergeReceivingField(profile, field, finalValue);
  return { content, field, value: finalValue, cleared, replaced };
}

module.exports = {
  SERVER_DERIVED_FIELDS,
  mergeReceivingField,
  buildReceivingContent,
};
