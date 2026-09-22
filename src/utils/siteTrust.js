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
#   magic-carpet.brainstorm.world
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
# The brainstorm.world and nosfabrica.com domains are both ours, so any
# host under either of them is operated by us. The list above is a
# current inventory, not an exhaustive claim. A site that resembles
# Brainstorm on any OTHER domain is not affiliated with us.
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
 * The non-indexing branch carves out one exemption: `LLMS_TXT_PATH` (story
 * llms-txt #1). `llms.txt` is a deliberate-agent affordance, not a
 * search-indexing signal, so a sandbox opting out of indexing should not also
 * hide it from an agent that fetches it by name. The indexing branch is
 * untouched — production's robots.txt stays byte-identical to before this
 * story (ADR llms-txt/0001, "behavior unchanged").
 *
 * @param {{allowIndexing?: boolean}} [opts]
 * @returns {string}
 */
function buildRobotsTxt(opts = {}) {
  const allowIndexing = Boolean(opts && opts.allowIndexing);
  return allowIndexing
    ? 'User-agent: *\nAllow: /\n'
    : `User-agent: *\nAllow: ${LLMS_TXT_PATH}\nDisallow: /\n`;
}

/**
 * llms.txt (llmstxt.org) — a curated pointer manifest for visiting AI agents.
 * Story: engineering-team/stories/llms-txt/1-serve-llms-txt-on-the-fleet.md
 * ADR:   engineering-team/decisions/llms-txt/0001-serve-llms-txt-on-the-fleet.md
 *
 * Static and identical on every host — unlike security.txt's Canonical, there
 * is no per-deployment field, so this takes no options.
 *
 * Content is pointers only (mostly into NosFabrica/protocols): the estate
 * discrepancy rule applies — ECOSYSTEM.md is canonical, this file only
 * points, so it should almost never need to change.
 */
const LLMS_TXT_PATH = '/llms.txt';

const LLMS_TXT = `# Tapestry (Brainstorm Search)

> Tapestry is the research-and-development side of Brainstorm, a personalized web-of-trust system for nostr: a local-first personal knowledge graph plus a trust engine that computes GrapeRank scores from a chosen observer's point of view and publishes them back to nostr as signed events. Protocols are drafted and piloted here, then adopted by the production Brainstorm stack at brainstorm.world.

Notes for agents:

- This site is a JavaScript single-page app. Its page URLs return an empty HTML shell to clients that do not run JavaScript, so read the markdown documents linked below instead of scraping pages.
- There is no global trust score. Every score is computed from a specific observer's point of view, and the same account can rank high from one point of view and be invisible from another. When answering "is this account trustworthy?", say whose point of view the answer comes from.
- Each wire format is normative in exactly one place: matured specs live in NosFabrica/protocols, drafts in this repository's protocols directory. For which hosts and repositories exist and what role each plays, ECOSYSTEM.md is authoritative.

## Protocols

- [Concepts](https://raw.githubusercontent.com/NosFabrica/protocols/main/CONCEPTS.md): the model behind every spec (five claims, the roles, shared vocabulary). Start here.
- [Trusted Assertions](https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/trusted-assertions.md): consumer spec for finding and reading published trust scores (companion to NIP-85).
- [GrapeRank](https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/graperank.md): how personalized trust scores are computed.
- [Ecosystem map](https://raw.githubusercontent.com/NosFabrica/protocols/main/ECOSYSTEM.md): canonical inventory of the organizations, repositories, and hosts, and each one's role.

## Tapestry

- [README](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/README.md): what Tapestry is and how to run your own instance with Docker.
- [AGENTS.md](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/AGENTS.md): orientation for coding agents working in the Tapestry codebase.
- [Protocol drafts](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/protocols/README.md): index and status of pre-NIP drafts (decentralized lists, concepts, tags).
- [tapestry-cli](https://raw.githubusercontent.com/nous-clawds4/tapestry-cli/main/README.md): command-line tools for agents curating concepts via the Tapestry protocol.

## Optional

- [BIBLE.md](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/BIBLE.md): full architecture, data model, and API reference (about 185 KB; read its table of contents first and fetch only the sections you need).
- [brainstorm-cli](https://raw.githubusercontent.com/nous-clawds4/brainstorm-cli/main/README.md): command-line tool for agents using the production Brainstorm backend.
- [Brainstorm API (OpenAPI)](https://api.brainstorm.world/openapi.json): machine-readable description of the production API (about 130 KB of JSON).
- [Security policy](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/SECURITY.md): how to report a vulnerability, and which hosts this codebase serves.
`;

/**
 * @returns {string}
 */
function buildLlmsTxt() {
  return LLMS_TXT;
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

  // ACME HTTP-01 challenges are NEVER blocked. cert-manager (the k8s fleet,
  // cluster-issuers.yaml uses an http01 solver) and certbot (the droplets)
  // both answer /.well-known/acme-challenge/<token> over plain HTTP, and a 404
  // there fails certificate issuance AND renewal. That failure is silent for
  // weeks and then surfaces as expired TLS across every host at once.
  //
  // Today this path is handled above the application layer, so returning false
  // simply preserves the pre-existing behavior rather than granting anything
  // new. The exemption exists so that a future change to how challenges are
  // routed cannot be broken by this rule.
  if (clean.startsWith('/.well-known/acme-challenge/')) return false;

  // Rule 1 — dotfiles and dot-directories, including the rest of /.well-known/.
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
  buildLlmsTxt,
  LLMS_TXT_PATH,
  // Exported for the test suite. NOTE: the sibling fleets (Brainstorm-UI, the
  // strfry relays) carry their own COPIES of this text — they are separate
  // repositories and cannot import it. Any edit here must be mirrored there.
  ESTATE_ATTESTATION,
  EXPIRES,
};
