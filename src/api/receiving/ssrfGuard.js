/**
 * SSRF guard for the server-side receiving probe.
 *
 * POST /api/receiving/probe lets an authed user verify their OWN Lightning
 * address / LNURL by having the server fetch the LNURL-pay endpoint. That makes
 * the server an HTTP client to a user-influenced URL, so we must stop it from
 * being pointed at internal / metadata services.
 *
 * The guard extracts the target host (the bech32-decoded LNURL URL host, or the
 * lud16 domain), enforces https in production, DNS-resolves the host, and
 * rejects loopback / private / link-local / unique-local addresses before any
 * fetch. In non-production (NODE_ENV !== 'production') the private-range and
 * https checks are relaxed so the integration test can point at a local LNURL
 * demo server.
 *
 * Residual: a DNS-rebinding TOCTOU between this lookup and the probe's own fetch
 * is not closed — acceptable for an authed self-probe of the user's own address.
 */

const dns = require('dns');
const { decodeLnurl, isLnurl } = require('../../lib/receiving/walletOptions');
const { parseLud16 } = require('../../lib/receiving/probe');

function isProd() { return process.env.NODE_ENV === 'production'; }

/**
 * Extract { kind, host, scheme } from a receiving identifier, or { error }.
 * `host` has any :port stripped (a DNS lookup takes a bare host).
 */
function extractTarget(value) {
  if (isLnurl(value)) {
    const url = decodeLnurl(value);
    if (!url) return { error: 'malformed LNURL (not a decodable lnurl1… code)' };
    let u;
    try { u = new URL(url); } catch { return { error: 'LNURL decodes to an invalid URL' }; }
    return { kind: 'lnurl', host: u.hostname, scheme: u.protocol.replace(/:$/, '') };
  }
  const parts = parseLud16(value);
  if (!parts) return { error: 'malformed receiving identifier (expected name@domain or lnurl1…)' };
  return { kind: 'lud16', host: parts.domain.replace(/:\d+$/, ''), scheme: 'https' };
}

/** True if an IPv4 dotted-quad falls in a loopback / private / reserved range. */
function ipv4Blocked(ip) {
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true; // fail closed
  const [a, b] = o;
  if (a === 0) return true;                          // 0.0.0.0/8   "this network"
  if (a === 10) return true;                         // 10/8        private
  if (a === 127) return true;                        // 127/8       loopback
  if (a === 169 && b === 254) return true;           // 169.254/16  link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12   private
  if (a === 192 && b === 168) return true;           // 192.168/16  private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10   CGNAT
  return false;
}

/**
 * Classify a resolved IP (v4 or v6 string) as a blocked SSRF target. Fails
 * closed on anything it can't parse.
 */
function isBlockedAddress(ip) {
  if (typeof ip !== 'string' || !ip) return true;
  let s = ip.trim().toLowerCase();
  const pct = s.indexOf('%');            // strip IPv6 zone id (fe80::1%eth0)
  if (pct !== -1) s = s.slice(0, pct);
  if (s.includes(':')) {
    // IPv4-mapped IPv6 (::ffff:192.168.0.1) → classify the embedded IPv4.
    const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipv4Blocked(mapped[1]);
    if (s === '::1' || s === '::') return true;                 // loopback / unspecified
    if (s.startsWith('fc') || s.startsWith('fd')) return true;  // fc00::/7  unique-local
    if (/^fe[89ab]/.test(s)) return true;                       // fe80::/10 link-local
    return false;
  }
  return ipv4Blocked(s);
}

function lookupAll(host) {
  return new Promise((resolve, reject) => {
    dns.lookup(host, { all: true, verbatim: true }, (err, addrs) => {
      if (err) reject(err); else resolve(addrs);
    });
  });
}

/**
 * Validate that a receiving identifier is safe for the server to fetch.
 *
 * @param {string} value lud16 (name@domain) or lnurl1… code
 * @param {object} [opts]
 * @param {boolean} [opts.allowPrivate] override the NODE_ENV gate (tests)
 * @returns {Promise<{ok:true, host:string, kind:string, addresses:string[]} | {ok:false, error:string, status:number}>}
 */
async function checkReceivingTarget(value, opts = {}) {
  const allowPrivate = opts.allowPrivate ?? !isProd();
  const t = extractTarget(value);
  if (t.error) return { ok: false, error: t.error, status: 400 };
  if (!allowPrivate && t.scheme !== 'https') {
    return { ok: false, error: 'only https LNURL endpoints are allowed', status: 400 };
  }
  let addrs;
  try { addrs = await lookupAll(t.host); }
  catch { return { ok: false, error: `could not resolve host ${t.host}`, status: 502 }; }
  const addresses = addrs.map(a => a.address);
  if (!addresses.length) return { ok: false, error: `no addresses for host ${t.host}`, status: 502 };
  if (!allowPrivate) {
    const blocked = addresses.find(a => isBlockedAddress(a));
    if (blocked) return { ok: false, error: `target host resolves to a disallowed address (${blocked})`, status: 400 };
  }
  return { ok: true, host: t.host, kind: t.kind, addresses };
}

module.exports = { checkReceivingTarget, isBlockedAddress, ipv4Blocked, extractTarget };
