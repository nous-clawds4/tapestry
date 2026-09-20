'use strict';
/**
 * Shared outbound-address guard.
 *
 * Some endpoints take a hostname from user-supplied input and then fetch it **from the
 * server**. Without a check, the caller chooses which host the server talks to — including
 * hosts only the server can reach. This module is the one place that decides whether an
 * address is publicly routable, so the answer cannot drift between call sites.
 *
 * Story: engineering-team/stories/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md
 *
 * Three layers, smallest first:
 *
 *   isPublicAddress(ip)        pure, synchronous, no I/O — classify one literal address.
 *   hasPrivateHostSuffix(host) pure, synchronous — names that are private by construction.
 *   isPublicHostname(host)     resolves a name and demands that EVERY answer be public.
 *   guardedFetch(url, opts)    isPublicHostname + fetch with redirects refused.
 *
 * The first two are exported for reuse: OPEN.md row 148 (the published-assistant picture
 * guard admits every RFC1918 address) is scheduled into `assistant-profile` #3, which
 * should import these rather than grow a second, divergent copy.
 *
 * **Everything fails closed.** Unknown input, an unresolvable name, a resolver error, an
 * empty answer — all reject. No function here throws to its caller; a rejection is always
 * a return value, so a call site cannot accidentally turn a guard failure into a pass by
 * forgetting a catch.
 *
 * Known and accepted limit — DNS rebinding. This resolves the name and then `fetch`
 * resolves it again; a host that answers a public address to the first query and a private
 * one to the second slips through. Closing that airtight means pinning the vetted address
 * into the socket via a custom `undici` dispatcher, i.e. a new dependency and a materially
 * larger change (see the story's Out of scope). What remains is bounded by the mitigations
 * the call sites keep: https-only, a short timeout, and a response body that is parsed for
 * one field and never returned to the caller.
 */

const net = require('net');
// Captured at load, not per call: the suite swaps this to drive classification without a
// real resolver (test/nip05-ssrf-guard.test.js `guardWithDns`).
const { lookup } = require('dns').promises;

const MAX_REDIRECTS = 0; // redirects are refused outright — story AC, Planning gate 2026-09-20

// Hostnames that are private by construction. `localhost` is listed as a bare name as well
// as a suffix; the rest are the reserved special-use names a private network hands out.
const PRIVATE_SUFFIXES = ['.local', '.internal', '.home.arpa', '.localhost', '.lan', '.intranet', '.private'];
const PRIVATE_EXACT = ['localhost'];

/**
 * Non-public IPv4 space, as [network, prefix-length] pairs.
 * 240/4 already covers 255.255.255.255; both are listed because the intent differs.
 */
const IPV4_BLOCKS = [
  ['0.0.0.0', 8],          // "this network"
  ['10.0.0.0', 8],         // RFC1918 private
  ['100.64.0.0', 10],      // RFC6598 carrier-grade NAT
  ['127.0.0.0', 8],        // loopback
  ['169.254.0.0', 16],     // link-local — cloud instance metadata lives here
  ['172.16.0.0', 12],      // RFC1918 private
  ['192.0.0.0', 24],       // IETF protocol assignments
  ['192.0.2.0', 24],       // TEST-NET-1
  ['192.168.0.0', 16],     // RFC1918 private
  ['198.18.0.0', 15],      // benchmarking
  ['198.51.100.0', 24],    // TEST-NET-2
  ['203.0.113.0', 24],     // TEST-NET-3
  ['224.0.0.0', 4],        // multicast
  ['240.0.0.0', 4],        // reserved
  ['255.255.255.255', 32], // broadcast
];

/** Dotted-quad to a 32-bit unsigned integer. Returns null if it is not a dotted quad. */
function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    // Reject anything net.isIP would not have accepted: leading zeros, empties, signs.
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = (n * 256) + octet;
  }
  return n >>> 0;
}

function isPublicIpv4(ip) {
  const addr = ipv4ToInt(ip);
  if (addr === null) return false;
  for (const [network, bits] of IPV4_BLOCKS) {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((addr & mask) === (ipv4ToInt(network) & mask)) return false;
  }
  return true;
}

/**
 * Expand an IPv6 address to its eight 16-bit hextets.
 * Handles `::` compression and a trailing dotted-quad (`::ffff:10.0.0.5`).
 * Returns null for anything that does not parse.
 */
function ipv6ToHextets(ip) {
  let text = String(ip);
  if (text.includes('%')) text = text.slice(0, text.indexOf('%')); // drop a zone id

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const expand = (side) => {
    if (side === '') return [];
    const pieces = side.split(':');
    const out = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (piece.includes('.')) {
        // A trailing dotted quad occupies the last two hextets.
        if (i !== pieces.length - 1) return null;
        const v4 = ipv4ToInt(piece);
        if (v4 === null) return null;
        out.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
        continue;
      }
      if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) return null;
      out.push(parseInt(piece, 16));
    }
    return out;
  };

  const head = expand(halves[0]);
  if (head === null) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;

  const tail = expand(halves[1]);
  if (tail === null) return null;
  const gap = 8 - head.length - tail.length;
  if (gap < 1) return null; // `::` must stand for at least one zero hextet
  return [...head, ...new Array(gap).fill(0), ...tail];
}

/** The dotted-quad sitting in the last 32 bits of an expanded IPv6 address. */
function embeddedIpv4(hextets) {
  const hi = hextets[6];
  const lo = hextets[7];
  return `${(hi >>> 8) & 0xff}.${hi & 0xff}.${(lo >>> 8) & 0xff}.${lo & 0xff}`;
}

function isPublicIpv6(ip) {
  const h = ipv6ToHextets(ip);
  if (h === null) return false;

  const leadingZero = (count) => h.slice(0, count).every((x) => x === 0);

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): the real destination is
  // the embedded IPv4 address, so classify THAT. `::` and `::1` are handled below and must
  // not reach here as "0.0.0.0" by accident — they reject either way.
  if (leadingZero(5) && h[5] === 0xffff) return isPublicIpv4(embeddedIpv4(h));
  if (leadingZero(6) && !(h[6] === 0 && h[7] <= 1)) return isPublicIpv4(embeddedIpv4(h));
  // NAT64 well-known prefix 64:ff9b::/96 — likewise a wrapper around an IPv4 destination.
  if (h[0] === 0x0064 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
    return isPublicIpv4(embeddedIpv4(h));
  }

  if (h.every((x) => x === 0)) return false;                       // :: unspecified
  if (leadingZero(7) && h[7] === 1) return false;                  // ::1 loopback
  if ((h[0] & 0xffc0) === 0xfe80) return false;                    // fe80::/10 link-local
  if ((h[0] & 0xfe00) === 0xfc00) return false;                    // fc00::/7 unique-local
  if ((h[0] & 0xff00) === 0xff00) return false;                    // ff00::/8 multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return false;            // 2001:db8::/32 docs
  return true;
}

/**
 * Is `ip` a literal address that is publicly routable?
 * Synchronous, no I/O. Anything that is not a parseable IP address is `false` — this
 * predicate only ever says yes to an address it has actually classified.
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isPublicAddress(ip) {
  if (typeof ip !== 'string') return false;
  const host = unbracket(ip.trim());
  const family = net.isIP(host);
  if (family === 4) return isPublicIpv4(host);
  if (family === 6) return isPublicIpv6(host);
  return false;
}

/** `[::1]` → `::1`. `URL.hostname` brackets IPv6 literals; `net.isIP` does not accept them. */
function unbracket(host) {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/**
 * Is `host` a name that is private by construction — a reserved special-use suffix, or a
 * single label with no dot (which can only resolve through a local search domain)?
 * Synchronous, no I/O.
 *
 * @param {string} host
 * @returns {boolean}
 */
function hasPrivateHostSuffix(host) {
  if (typeof host !== 'string') return false;
  const name = host.trim().toLowerCase().replace(/\.$/, '');
  if (!name) return false;
  if (net.isIP(unbracket(name))) return false; // an address is classified, not suffix-matched
  if (PRIVATE_EXACT.includes(name)) return true;
  if (PRIVATE_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
  return !name.includes('.'); // a bare label is not a public name
}

/**
 * Does `host` denote a publicly routable destination?
 *
 * An IP literal is classified directly. A name is resolved and **every** address in the
 * answer must be public — one private answer rejects the name, because which address
 * `fetch` picks is not ours to choose.
 *
 * Never throws. Empty input, a resolver error and an empty answer all return false.
 *
 * @param {string} host
 * @returns {Promise<boolean>}
 */
async function isPublicHostname(host) {
  if (typeof host !== 'string') return false;
  const name = unbracket(host.trim());
  if (!name) return false;

  if (net.isIP(name)) return isPublicAddress(name);
  if (hasPrivateHostSuffix(name)) return false;

  let answers;
  try {
    answers = await lookup(name, { all: true, verbatim: true });
  } catch {
    return false; // unresolvable, resolver down, anything else — fail closed
  }
  if (!Array.isArray(answers) || answers.length === 0) return false;
  return answers.every((answer) => isPublicAddress(answer && answer.address));
}

/**
 * `fetch`, refusing to talk to a non-public host and refusing to be redirected.
 *
 * Redirects are not followed (`redirect: 'manual'`, ratified at the story's Planning gate
 * on 2026-09-20). Following them would let a public host that passes the guard aim the
 * next request at anything it likes — the cheapest way around a first-hop-only check. The
 * 3xx response is handed back as-is; callers already treat a non-`ok` response as a failed
 * lookup, so no call site needs new branching.
 *
 * Returns null instead of a Response when the host is refused, so a call site can keep its
 * existing "no usable response → null" path. Never throws for a guard refusal; a transport
 * error still throws exactly as `fetch` does, which every call site already catches.
 *
 * @param {string|URL} url
 * @param {object} [options] passed through to fetch (e.g. the caller's abort signal)
 * @returns {Promise<Response|null>}
 */
async function guardedFetch(url, options = {}) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!(await isPublicHostname(parsed.hostname))) return null;
  return fetch(parsed, { ...options, redirect: 'manual' });
}

module.exports = {
  isPublicAddress,
  hasPrivateHostSuffix,
  isPublicHostname,
  guardedFetch,
  MAX_REDIRECTS,
};
