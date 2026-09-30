/**
 * The two stamp identities (ADR tagging-edges/0002 runner step 4 and C1; ADR 0001 A3), moved unchanged from the
 * gap-filling pass's runner, which re-exports it, so the pass and the real-time path (ADR tagging-edges/0003) judge
 * them by one rule. The canonical one comes from the ADR 0015 literal's one server home, through the caller's
 * `identities.canonicalZ()`; the local one from the environment and `identities.getOwnerAssistantPubkey()`.
 */

const { checkIdentity } = require('../../lib/tagging-edges/sweep');

const CANONICAL_Z_RE = /^39998:(.*):nostr-user-tag$/s;

/**
 * Both stamp identities, or the refusal naming which one is wrong and where it came from.
 * → { canonicalPubkey, localPubkey } | { refusal: { identity, problem, source } }
 */
function resolveIdentities(deps) {
  const ids = deps.identities || {};
  let z;
  try { z = ids.canonicalZ(); } catch (_) { z = undefined; }
  const m = typeof z === 'string' ? CANONICAL_Z_RE.exec(z) : null;
  const canonical = m ? m[1] : undefined;
  const cp = checkIdentity(canonical);
  if (cp) return { refusal: { identity: 'canonical', problem: cp, source: 'profile-tags' } };

  const env = deps.env || {};
  if (env.TA_PUBKEY !== undefined) {
    const p = checkIdentity(env.TA_PUBKEY);
    if (p) return { refusal: { identity: 'local', problem: p, source: 'env TA_PUBKEY' } };
  }
  if (env.BRAINSTORM_RELAY_PUBKEY !== undefined) {
    const p = checkIdentity(env.BRAINSTORM_RELAY_PUBKEY);
    if (p) return { refusal: { identity: 'local', problem: p, source: 'brainstorm.conf' } };
  }
  let helper;
  try { helper = ids.getOwnerAssistantPubkey(); } catch (_) { helper = null; }
  if (helper === null || helper === undefined) {
    return { refusal: { identity: 'local', problem: 'missing', source: 'brainstorm.conf' } };
  }
  const source = env.TA_PUBKEY !== undefined ? 'env TA_PUBKEY'
    : helper === env.BRAINSTORM_RELAY_PUBKEY ? 'brainstorm.conf' : 'secure-keys file';
  const lp = checkIdentity(helper);
  if (lp) return { refusal: { identity: 'local', problem: lp, source } };
  return { canonicalPubkey: canonical, localPubkey: helper };
}

module.exports = { resolveIdentities };
