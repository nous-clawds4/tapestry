/**
 * Active receiving-method resolution — the issuer-side payout decision.
 *
 * Pure (no I/O). Mirrors the precedence in ui/src/utils/zap.js exactly:
 * a BOLT12 offer (bolt12 / lud12 / lightning_offer) wins over a Lightning
 * address (lud16 / lud06). The point of proving this in the CLI is that
 * `receiving resolve` makes the *same* decision the issuer UI's zap button
 * makes — including reporting whether the result is tracked.
 *
 * "tracked" = produces a NIP-57 zap receipt (kind 9735) the bounty cap logic
 * can key off (bounty-policy.js). BOLT12 static offers do not, so they are
 * reported untracked (rev. 2, Finding 3).
 */

const { extractBolt12, extractLnurl, isLnurl, BOLT12_FIELDS, LUD16_FIELDS } = require('./walletOptions');

function readBolt12(profile) {
  if (!profile) return null;
  for (const f of BOLT12_FIELDS) {
    const offer = extractBolt12(profile[f]);
    if (offer) return { field: f, value: offer };
  }
  return null;
}

/**
 * A Lightning *address* (name@domain) in either lud16 or lud06. Skips values
 * that are actually LNURL codes — those resolve as method 'lnurl' below.
 */
function readLud16Address(profile) {
  if (!profile) return null;
  for (const f of LUD16_FIELDS) {
    const v = profile[f];
    if (v && typeof v === 'string' && !isLnurl(v)) return { field: f, value: v.trim() };
  }
  return null;
}

/**
 * A static LNURL-pay code (lnurl1…) wherever it sits — conventionally lud06,
 * but tolerate a mis-placed lud16. Returned canonicalized (lowercased).
 */
function readLnurl(profile) {
  if (!profile) return null;
  for (const f of LUD16_FIELDS) {
    const lnurl = extractLnurl(profile[f]);
    if (lnurl) return { field: f, value: lnurl };
  }
  return null;
}

/**
 * @param {object|null} profile parsed kind-0 content
 * @returns {{method:'bolt12'|'lud16'|'lnurl', field:string, value:string, tracked:boolean|null, trackedReason:string} | null}
 */
function resolveReceivingMethod(profile) {
  const bolt12 = readBolt12(profile);
  if (bolt12) {
    return {
      method: 'bolt12',
      field: bolt12.field,
      value: bolt12.value,
      tracked: false,
      trackedReason: 'static BOLT12 offer — no zap receipt; cap slot won\'t auto-free',
    };
  }
  // Precedence: a real Lightning address beats a static LNURL code (an address's
  // LNURL is fetched fresh per-payment and usually allows Nostr; a static code
  // like a Fedimint paycode usually does not).
  const lud16 = readLud16Address(profile);
  if (lud16) {
    return {
      method: 'lud16',
      field: lud16.field,
      value: lud16.value,
      // Structural assumption only: a lud16 is tracked *iff* its LNURL allows
      // Nostr zaps. Confirm with an LNURL probe (CLI --probe / set-time check),
      // which fedimint gateway addresses in particular may fail.
      tracked: true,
      trackedReason: 'LNURL zaps — tracked only if the address allows Nostr (verify via probe)',
    };
  }
  const lnurl = readLnurl(profile);
  if (lnurl) {
    return {
      method: 'lnurl',
      field: lnurl.field,
      value: lnurl.value,
      // Unknown until probed — a static LNURL is tracked only if its endpoint
      // advertises allowsNostr, which we cannot tell from the code alone.
      tracked: null,
      trackedReason: 'static LNURL-pay code — tracked only if its LNURL allows Nostr zaps (verify via probe)',
    };
  }
  return null;
}

/**
 * Describe what a payout to this profile would produce, without performing the
 * LNURL fetch or signing (those need a live network / NIP-07 signer). This is
 * the framework-free half of zapContributor()'s branch decision.
 *
 * @param {object|null} profile
 * @returns {{type:'bolt12'|'bolt11'|'none', tracked:boolean|null, payload?:string, lud16?:string, via?:string, source?:string, static?:boolean, error?:string}}
 */
function resolvePayment(profile) {
  const resolved = resolveReceivingMethod(profile);
  if (!resolved) {
    return { type: 'none', tracked: false, error: 'Recipient has no Lightning address, LNURL code, or BOLT12 offer' };
  }
  if (resolved.method === 'bolt12') {
    return { type: 'bolt12', payload: resolved.value, static: true, tracked: false };
  }
  if (resolved.method === 'lnurl') {
    // A static LNURL: decode → fetch → request an invoice. Without allowsNostr it
    // yields a plain BOLT11 (no zap receipt), so tracked is unknown until probed.
    return { type: 'bolt11', via: 'lnurl', source: resolved.value, tracked: null };
  }
  // lud16 → the issuer UI would run LNURL pay + sign a 9734 and get a BOLT11.
  return { type: 'bolt11', lud16: resolved.value, tracked: true };
}

module.exports = { resolveReceivingMethod, resolvePayment };
