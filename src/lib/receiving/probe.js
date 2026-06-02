/**
 * LNURL-pay probe — verify a Lightning address (lud16) is actually reachable
 * and whether it allows Nostr zaps (NIP-57). This is what makes "tracked"
 * honest: a lud16 only yields a kind-9735 zap receipt if its LNURL endpoint
 * returns allowsNostr:true. Fedimint gateway addresses frequently DON'T, and
 * zap.js throws on such an address — so probing at set-time tells the user
 * immediately whether the address will work, instead of failing at payout.
 *
 * I/O module (uses global fetch, Node 18+). Kept out of the pure core. The
 * server never calls this; only the CLI does, about the key owner's own
 * address — so no SSRF surface is added server-side. `allowInsecureLocalhost`
 * is a test-only affordance (https everywhere in real use).
 */

const { decodeLnurl, isLnurl } = require('./walletOptions');

const DEFAULT_TIMEOUT_MS = 6000;

/** Split "name@domain" → { user, domain } or null. */
function parseLud16(lud16) {
  const s = String(lud16 || '').trim();
  const at = s.indexOf('@');
  if (at <= 0 || at === s.length - 1 || s.indexOf('@', at + 1) !== -1) return null;
  return { user: s.slice(0, at), domain: s.slice(at + 1) };
}

/**
 * @returns {Promise<{ok:boolean, reachable:boolean, allowsNostr?:boolean, callback?:string|null,
 *                     minSendable?:number|null, maxSendable?:number|null, status?:number, error?:string}>}
 */
/**
 * GET an LNURL-pay endpoint and map its JSON to the common probe shape. Shared
 * by probeLud16 (which builds the URL from name@domain) and probeLnurl (which
 * bech32-decodes the URL out of the code).
 */
async function fetchLnurlp(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return { ok: false, reachable: true, status: resp.status, error: `LNURL endpoint returned ${resp.status}` };
    let data;
    try { data = await resp.json(); } catch { return { ok: false, reachable: true, error: 'LNURL returned invalid JSON' }; }
    return {
      ok: true,
      reachable: true,
      allowsNostr: data.allowsNostr === true,
      callback: data.callback || null,
      minSendable: data.minSendable ?? null,
      maxSendable: data.maxSendable ?? null,
    };
  } catch (e) {
    return { ok: false, reachable: false, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function probeLud16(lud16, { timeoutMs = DEFAULT_TIMEOUT_MS, allowInsecureLocalhost = false } = {}) {
  const parts = parseLud16(lud16);
  if (!parts) return { ok: false, reachable: false, error: 'malformed lud16 (expected name@domain)' };

  const isLocal = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(parts.domain);
  const scheme = (allowInsecureLocalhost && isLocal) ? 'http' : 'https';
  const url = `${scheme}://${parts.domain}/.well-known/lnurlp/${encodeURIComponent(parts.user)}`;
  return fetchLnurlp(url, timeoutMs);
}

/**
 * Probe a static LNURL-pay code (lnurl1…): bech32-decode it to its URL, then GET
 * that endpoint. The scheme is whatever the code encodes (https in real use; a
 * test code may encode http://127.0.0.1 — see allowInsecureLocalhost note below).
 *
 * @returns {Promise<{ok:boolean, reachable:boolean, allowsNostr?:boolean, callback?:string|null,
 *                     minSendable?:number|null, maxSendable?:number|null, url?:string, status?:number, error?:string}>}
 */
async function probeLnurl(lnurl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = decodeLnurl(lnurl);
  if (!url) return { ok: false, reachable: false, error: 'malformed LNURL (not a valid lnurl1… code)' };
  const result = await fetchLnurlp(url, timeoutMs);
  return { ...result, url };
}

/**
 * Dispatch a receiving identifier to the right probe: an lnurl1… code goes to
 * probeLnurl; a name@domain to probeLud16. Both yield the same result shape, so
 * trackedVerdict() interprets either.
 */
async function probeReceiving(value, opts = {}) {
  if (isLnurl(value)) return probeLnurl(value, opts);
  return probeLud16(value, opts);
}

/**
 * Interpret a probe result into a tracked verdict + human note. Pure given a probe.
 */
function trackedVerdict(probe) {
  if (!probe) return { tracked: null, note: 'not probed' };
  if (!probe.reachable) return { tracked: false, note: `LNURL unreachable (${probe.error}) — can't confirm payable/tracked` };
  if (!probe.ok) return { tracked: false, note: `LNURL error (${probe.error}) — not payable via zap` };
  if (probe.allowsNostr) return { tracked: true, note: 'LNURL allows Nostr zaps → tracked (kind-9735 receipt)' };
  return { tracked: false, note: 'LNURL reachable but does NOT allow Nostr zaps → the zap button will fail; not tracked' };
}

module.exports = { probeLud16, probeLnurl, probeReceiving, parseLud16, trackedVerdict };
