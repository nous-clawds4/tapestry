'use strict';
/**
 * The DNS guard for relays named inside events: is a relay's host on the public internet? (ADR
 * assistant-outbox-relays/0003 Amendment 2; its shared home since ADR assistant-duty-menu/0002 sub-decision 6, moved
 * here unchanged from the Outbox Relays publish route so the Duty Menu check and publish can share it.)
 *
 * Used wherever this instance connects to a relay that came from someone's event (a relay list, a Treasure Map, a
 * Duty Menu): the relay is connected to only when every address its host resolves to is public. Owner-set relays
 * (Relay Settings) are not looked up.
 */

const net = require('net');
const { isPublicAddress, hasPrivateHostSuffix } = require('./ssrfGuard');

/** The whole time the send-time lookups may take, from their start (ADR 0003 Amendment 2). */
const LOOKUP_BUDGET_MS = 3000;

/** Resolve within `ms` or give `fallback` — clearing the timer either way. */
async function within(promise, ms, fallback) {
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), Math.max(0, ms)); });
  try { return await Promise.race([promise, late]); } finally { clearTimeout(timer); }
}

/**
 * Does this relay host resolve to public addresses only? ssrfGuard's rule, off libuv's threadpool and within a time
 * limit (ADR 0003 Amendment 2): an IP literal is classified by isPublicAddress; a private-by-construction name is not
 * public; any other name is asked for its A and AAAA records through a c-ares Resolver ({ timeout, tries: 1 }, on the
 * event loop, not dns.lookup). Public only when both queries finished, at least one address came back, and every
 * address is public. A timeout, an error or an empty answer is not public; the resolver is cancelled at the limit.
 * @param {string} host - as URL gives it
 * @param {{ timeoutMs?: number, Resolver?: Function }} [options] - Resolver for tests; default dns.promises.Resolver
 * @returns {Promise<boolean>} never rejects
 */
async function isPublicRelayHostWithin(host, { timeoutMs = LOOKUP_BUDGET_MS, Resolver } = {}) {
  const name = String(host || '').trim().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!name) return false;
  if (net.isIP(name)) return isPublicAddress(name);
  if (hasPrivateHostSuffix(name)) return false;
  const ResolverClass = Resolver || require('dns').promises.Resolver;
  let resolver;
  try { resolver = new ResolverClass({ timeout: timeoutMs, tries: 1 }); } catch { return false; }
  // An answer with no records of that type (ENODATA, ENOTFOUND) is an empty list; anything else is a failure (null).
  const settle = (query) => Promise.resolve().then(query).then(
    (addresses) => (Array.isArray(addresses) ? addresses : null),
    (err) => (err && (err.code === 'ENODATA' || err.code === 'ENOTFOUND') ? [] : null),
  );
  const answers = await within(
    Promise.all([settle(() => resolver.resolve4(name)), settle(() => resolver.resolve6(name))]),
    timeoutMs,
    null,
  );
  if (!answers) {
    try { resolver.cancel(); } catch { /* going away either way */ }
    return false;
  }
  const [v4, v6] = answers;
  if (v4 === null || v6 === null) return false;
  const all = [...v4, ...v6];
  return all.length > 0 && all.every((address) => isPublicAddress(String(address)));
}

module.exports = {
  isPublicRelayHostWithin,
  within,
  LOOKUP_BUDGET_MS,
};
