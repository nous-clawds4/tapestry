/**
 * Site trust signals — RFC 9116 security.txt, robots.txt, and probe-path classification.
 *
 * Story: engineering-team/stories/site-trust-signals/1-security-txt-and-honest-404s.md
 * ADR:   engineering-team/decisions/site-trust-signals/0036-security-txt-and-honest-404s.md
 *
 * Kept out of bin/control-panel.js so the document builders are unit-testable
 * without booting Express.
 */

/**
 * The estate attestation. Every official hostname across all four fleets, so a
 * reputation reviewer can see that the sibling domains are deliberately operated
 * rather than bulk-generated clones. Published verbatim on all of them.
 *
 * MAINTENANCE: this list must be updated when a host is added or retired. Five
 * hostnames referenced elsewhere in this repo are already dead DNS, so the drift
 * is real, not hypothetical.
 */
const ESTATE_ATTESTATION = `# ---------------------------------------------------------------------
# Brainstorm - official domain inventory
#
# Brainstorm is an open-source Web-of-Trust protocol and search engine
# built on nostr. Every hostname below is operated by the same team.
# They run a small number of shared open-source codebases at different
# release stages, which is why they resemble one another. This file is
# published identically on all of them as an ownership attestation.
#
# Product UI - github.com/NosFabrica/Brainstorm-UI
#   brainstorm.world
#   brainstorm.nosfabrica.com
#   brainstorm-staging.nosfabrica.com
#
# R&D UI - github.com/nous-clawds4/tapestry
#   tapestry.brainstorm.world
#   staging.brainstorm.world
#   tags.brainstorm.world
#   communities.brainstorm.world
#   magic-carpet.brainstorm.world
#   curate.brainstorm.world
#
# Backend APIs - github.com/NosFabrica/brainstorm_server
#   api.brainstorm.world
#   search.brainstorm.world
#   brainstormserver.nosfabrica.com
#   brainstormserver-staging.nosfabrica.com
#
# nostr relays - strfry, github.com/hoytech/strfry
#   scores.brainstorm.world
#   nip85.brainstorm.world
#   dcosl.brainstorm.world
#   nip85.nosfabrica.com
#   nip85-staging.nosfabrica.com
#
# Any *.brainstorm.world or *.nosfabrica.com host not listed above is
# not operated by us.
# ---------------------------------------------------------------------`;

const CONTACT_URL = 'https://github.com/nous-clawds4/tapestry/security/advisories/new';
const POLICY_URL = 'https://github.com/nous-clawds4/tapestry/blob/main/SECURITY.md';

/**
 * RFC 9116 §2.5.5 requires exactly one Expires, no more than a year out, and
 * treats an expired document as invalid — a stale security.txt is worse than
 * none at all.
 *
 * This date is deliberately STATIC rather than computed as "now + 1 year".
 * Auto-rolling the value would defeat the field's purpose, which is to signal
 * that a human has reviewed the contents recently. The consequence is that test
 * U1 in test/site-trust-signals.test.js starts FAILING once this date passes.
 * That failure is the renewal alarm, and it is intentional: refresh this
 * constant, re-verify the estate list above is still accurate, and ship.
 *
 * Tracked in OPEN.md.
 */
const EXPIRES = '2027-08-11T00:00:00.000Z';

/**
 * Path segments carrying one of these extensions are probe or asset requests,
 * never SPA routes. Deliberately narrow: `js`, `css`, `png`, and `svg` are
 * excluded so that a real asset which express.static somehow misses degrades to
 * the SPA shell rather than a hard 404.
 */
const BLOCKED_EXTENSIONS = new Set([
  'php', 'asp', 'aspx', 'jsp', 'cgi',
  'sql', 'bak', 'ini', 'conf', 'sh',
  'yml', 'yaml', 'xml', 'json', 'txt',
  'ico', 'map', 'env',
]);

/**
 * Build the RFC 9116 document.
 *
 * `Canonical` is rendered from the supplied domain and OMITTED when none is
 * configured. RFC 9116 §2.5.2 says a document whose retrieval URL matches none
 * of its Canonical fields SHOULD NOT be trusted, so a guessed value would
 * invalidate the whole file on every host it names incorrectly. The field is
 * optional, which makes absence the safe default.
 *
 * The requesting Host header is deliberately NOT consulted — it is
 * attacker-controllable, and honoring it would let a third party obtain a
 * document that appears to vouch for a domain we do not operate.
 *
 * @param {{domain?: string}} [opts]
 * @returns {string}
 */
function buildSecurityTxt(opts = {}) {
  const domain = typeof opts.domain === 'string' ? opts.domain.trim() : '';
  const lines = [
    ESTATE_ATTESTATION,
    '',
    `Contact: ${CONTACT_URL}`,
    `Expires: ${EXPIRES}`,
    'Preferred-Languages: en',
    `Policy: ${POLICY_URL}`,
  ];

  if (domain && domain !== 'localhost') {
    lines.push(`Canonical: https://${domain}/.well-known/security.txt`);
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Build robots.txt.
 *
 * Fails CLOSED: without an explicit opt-in the response disallows everything.
 * Keying indexing off a hostname comparison would hardcode a per-deployment
 * value into shared code (CLAUDE.md house rule), and defaulting closed also
 * stops a new sandbox from competing with production in search results before
 * anyone remembers to configure it.
 *
 * @param {{allowIndexing?: boolean}} [opts]
 * @returns {string}
 */
function buildRobotsTxt(opts = {}) {
  const allowIndexing = Boolean(opts && opts.allowIndexing);
  return allowIndexing
    ? 'User-agent: *\nAllow: /\n'
    : 'User-agent: *\nDisallow: /\n';
}

/**
 * Should this path get a genuine 404 instead of the SPA shell?
 *
 * Classifies by path SHAPE, never by a route inventory. ADR 0036 rejected
 * mirroring the React Router table because the server copy would drift from the
 * client copy silently, and the failure mode is 404ing a live page.
 *
 * Two rules:
 *   1. Any path with a dot-prefixed segment (`/.env`, `/.git/config`, and every
 *      unhandled `/.well-known/*`). No SPA route has one.
 *   2. A final segment whose extension is in BLOCKED_EXTENSIONS.
 *
 * Rule 2 examines only the FINAL segment's extension, and only against an
 * explicit list. A blanket "contains a dot" test would 404 user-authored route
 * params — `/pin/my.pinned.tag` and `/tag/some.slug/abc123` are legitimate.
 *
 * Must be registered AFTER all express.static middleware, so that real assets
 * are already served by the time this runs.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function isBlockedProbePath(pathname) {
  if (typeof pathname !== 'string' || pathname === '') return false;

  // Defensive: callers should pass req.path, but strip any query/hash anyway.
  let clean = pathname.split('?')[0].split('#')[0];

  // Express does NOT percent-decode req.path, so classifying the raw string
  // would let /%2Eenv and /wp-login%2Ephp through and answer 200 — the exact
  // signal this rule exists to remove. Decoding also turns /%2e%2e/ into /../,
  // whose ".." segments the dotfile rule below then catches.
  // A malformed escape (/%zz) throws; fall back to the raw path rather than
  // letting an unparseable URL become an exception on a public endpoint.
  try { clean = decodeURIComponent(clean); } catch { /* keep the raw path */ }

  const segments = clean.split('/').filter(Boolean);
  if (segments.length === 0) return false;

  // Rule 1 — dotfiles and dot-directories, including all of /.well-known/.
  if (segments.some((s) => s.startsWith('.'))) return true;

  // Rule 2 — known probe/asset extension on the final segment.
  const last = segments[segments.length - 1];
  const dot = last.lastIndexOf('.');
  if (dot <= 0 || dot === last.length - 1) return false;
  return BLOCKED_EXTENSIONS.has(last.slice(dot + 1).toLowerCase());
}

module.exports = {
  buildSecurityTxt,
  buildRobotsTxt,
  isBlockedProbePath,
  // Exported for the test suite. NOTE: the sibling fleets (Brainstorm-UI, the
  // strfry relays) carry their own COPIES of this text — they are separate
  // repositories and cannot import it. Any edit here must be mirrored there.
  ESTATE_ATTESTATION,
  EXPIRES,
};
