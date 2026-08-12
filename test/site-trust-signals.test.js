/**
 * Story 1 (epic: site-trust-signals) — security.txt, robots.txt, and honest 404s.
 *
 * Story: engineering-team/stories/site-trust-signals/1-security-txt-and-honest-404s.md
 * ADR:   engineering-team/decisions/site-trust-signals/0036-security-txt-and-honest-404s.md
 *
 * Three test classes, following the deploy-safety-gate precedent:
 *
 *   U-class (unit, stack-free) — the ADR's pure core: `buildSecurityTxt()`,
 *     `buildRobotsTxt()`, and `isBlockedProbePath()` exported from
 *     src/utils/siteTrust.js. Covers the RFC 9116 field constraints (AC-3),
 *     per-host Canonical rendering and its omission (AC-2), the estate
 *     attestation (AC-4), both robots.txt policies (AC-5/AC-6), and the
 *     probe-path classifier (AC-7/AC-8/AC-9). These gate the build.
 *
 *   S-class (structural, stack-free) — source sentinels. The two routes are
 *     registered; the deny rule is positioned AFTER all express.static
 *     middleware and BEFORE the SPA catch-all (ADR: "placement is
 *     load-bearing"); SECURITY.md exists; and no per-deployment hostname is
 *     hardcoded into shared code (CLAUDE.md house rule).
 *
 *   H-class (live HTTP, per-test SKIP when the stack is absent) — the real
 *     control panel at :7778. Probe paths must 404, the two documents must be
 *     served as text/plain, and — the regression that matters most — every
 *     existing SPA deep link must still resolve with 200 (AC-9).
 *
 * ALL U/S tests and (stack-present) H tests FAIL until the feature lands:
 * src/utils/siteTrust.js does not exist, and today every path on the instance
 * returns 200 text/html. That is the point.
 *
 * U10 is the single most important test in this suite. The ADR rejected
 * allow-listing SPA routes precisely because drift would 404 a live page;
 * U10 is the guard that the shape-based rule never does so, including for
 * route params that legitimately contain dots (/pin/:dTag, /tag/:slug/:tagId).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_TRUST = path.join(ROOT, 'src/utils/siteTrust.js');
const CONTROL_PANEL = path.join(ROOT, 'bin/control-panel.js');
const SECURITY_MD = path.join(ROOT, 'SECURITY.md');

const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

/** Every official hostname the attestation must name (AC-4). Kept independent
 *  of the implementation so the test is a spec, not a tautology. */
const ESTATE_HOSTS = [
  // Product UI — NosFabrica/Brainstorm-UI
  'brainstorm.world',
  'brainstorm.nosfabrica.com',
  'brainstorm-staging.nosfabrica.com',
  // R&D UI — nous-clawds4/tapestry
  'tapestry.brainstorm.world',
  'staging.brainstorm.world',
  'tags.brainstorm.world',
  'communities.brainstorm.world',
  'magic-carpet.brainstorm.world',
  'curate.brainstorm.world',
  // Backend APIs — NosFabrica/brainstorm_server
  'api.brainstorm.world',
  'search.brainstorm.world',
  'brainstormserver.nosfabrica.com',
  'brainstormserver-staging.nosfabrica.com',
  // strfry relays
  'scores.brainstorm.world',
  'nip85.brainstorm.world',
  'dcosl.brainstorm.world',
  'nip85.nosfabrica.com',
  'nip85-staging.nosfabrica.com',
];

/** Paths a scanner probes. Every one must 404 (AC-7). */
const PROBE_PATHS = [
  '/.env',
  '/wp-login.php',
  '/config.json',
  '/backup.sql',
  '/database.bak',
  '/settings.ini',
  '/docker-compose.yml',
  '/sitemap.xml',
  '/index.asp',
];

/** Paths that MUST still reach the SPA (AC-9). Extensionless, including
 *  params that legitimately carry dots. */
const SPA_PATHS = [
  '/',
  '/tags',
  '/pins',
  '/feed',
  '/about',
  '/settings',
  '/developers/nip-50',
  '/developers/trusted-assertions',
  '/how-search-works',
  '/user/82b75e4791f8f0a4e3a1f0b4d9c8e7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d973',
  '/user/82b75e4791f8f0a4e3a1f0b4d9c8e7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d973/follows',
  '/tapestry/goals',
  '/tapestry/concepts',
  '/tapestry/lists',
  // Route params that contain dots — must NOT be mistaken for file extensions.
  '/pin/my.pinned.tag',
  '/tag/some.slug/abc123',
];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Load the feature module, failing loudly (not with an opaque
 *  MODULE_NOT_FOUND) while it does not yet exist. */
function loadSiteTrust() {
  if (!fs.existsSync(SITE_TRUST)) {
    throw new Error(
      'FEATURE MISSING: src/utils/siteTrust.js does not exist yet. ' +
      'ADR 0036 requires it to export buildSecurityTxt, buildRobotsTxt, isBlockedProbePath.'
    );
  }
  return require(SITE_TRUST);
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

/** Parse an RFC 9116 document into { field: [values] }, ignoring comments. */
function parseSecurityTxt(body) {
  const fields = {};
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z-]+):\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    (fields[key] = fields[key] || []).push(m[2].trim());
  }
  return fields;
}

async function fetchOrNull(url, opts) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(t);
    return res;
  } catch { return null; }
}

/** H-class guard: is the control panel answering at all? */
async function stackPresent() {
  const res = await fetchOrNull(`${BASE}/`);
  return res !== null;
}

/* ─────────────── U-class: the pure core ─────────────── */

test('U1 security.txt carries exactly one Expires, parseable and in the future', () => {
  const { buildSecurityTxt } = loadSiteTrust();
  const fields = parseSecurityTxt(buildSecurityTxt({ domain: 'tapestry.brainstorm.world' }));
  assert(fields.expires, 'security.txt must carry an Expires field (RFC 9116 §2.5.5 — required).');
  assert(fields.expires.length === 1,
    `RFC 9116 §2.5.5 permits exactly one Expires; got ${fields.expires.length}.`);
  const when = Date.parse(fields.expires[0]);
  assert(!Number.isNaN(when), `Expires must be a parseable timestamp; got "${fields.expires[0]}".`);
  assert(when > Date.now(), 'Expires must be in the future — an expired security.txt is invalid.');
});

test('U2 security.txt carries at least one Contact', () => {
  const { buildSecurityTxt } = loadSiteTrust();
  const fields = parseSecurityTxt(buildSecurityTxt({ domain: 'tapestry.brainstorm.world' }));
  assert(fields.contact && fields.contact.length >= 1,
    'security.txt must carry at least one Contact field (RFC 9116 §2.5.3 — required).');
});

test('U3 Expires is no more than one year out', () => {
  const { buildSecurityTxt } = loadSiteTrust();
  const fields = parseSecurityTxt(buildSecurityTxt({ domain: 'tapestry.brainstorm.world' }));
  const when = Date.parse(fields.expires[0]);
  const oneYear = Date.now() + 366 * 24 * 60 * 60 * 1000;
  assert(when <= oneYear,
    `RFC 9116 §2.5.5 recommends Expires < 1 year out; got "${fields.expires[0]}".`);
});

test('U4 Canonical names the requesting host when a domain is configured', () => {
  const { buildSecurityTxt } = loadSiteTrust();
  for (const host of ['staging.brainstorm.world', 'curate.brainstorm.world', 'fork.example.org']) {
    const fields = parseSecurityTxt(buildSecurityTxt({ domain: host }));
    assert(fields.canonical, `Canonical must be emitted when domain="${host}".`);
    const expected = `https://${host}/.well-known/security.txt`;
    assert(fields.canonical.includes(expected),
      `Canonical must be "${expected}"; got ${JSON.stringify(fields.canonical)}. ` +
      'A hardcoded host would make the document RFC-invalid on every other deployment.');
  }
});

test('U5 Canonical is omitted (not guessed) when the domain is unset or localhost', () => {
  const { buildSecurityTxt } = loadSiteTrust();
  for (const domain of [undefined, '', 'localhost']) {
    const fields = parseSecurityTxt(buildSecurityTxt({ domain }));
    assert(!fields.canonical,
      `Canonical must be OMITTED when domain=${JSON.stringify(domain)} — RFC 9116 makes the ` +
      'field optional, so absent is valid while wrong invalidates the whole document. ' +
      `Got ${JSON.stringify(fields.canonical)}.`);
    assert(fields.contact && fields.expires,
      'Omitting Canonical must not drop the required Contact/Expires fields.');
  }
});

test('U6 security.txt names every official host in the estate attestation', () => {
  const { buildSecurityTxt } = loadSiteTrust();
  const body = buildSecurityTxt({ domain: 'tapestry.brainstorm.world' });
  const missing = ESTATE_HOSTS.filter((h) => !body.includes(h));
  assert(missing.length === 0,
    `The attestation must name every official host; missing: ${missing.join(', ')}. ` +
    'This list is the substantive answer to "these domains look like clones of each other."');
});

test('U6b the attestation claims our own domains rather than disclaiming them', () => {
  const { buildSecurityTxt, ESTATE_ATTESTATION } = loadSiteTrust();
  const body = buildSecurityTxt({ domain: 'tapestry.brainstorm.world' });

  // The shipped file closed with "Any *.brainstorm.world or *.nosfabrica.com
  // host not listed above is not operated by us." Both apex domains are ours,
  // so that disclaimed our OWN subdomains — and would disclaim every new one
  // the moment it was added, since the list can never be exhaustive. In a file
  // whose entire purpose is to assert ownership, a false disclaimer is worse
  // than saying nothing.
  assert(!/not operated by us/i.test(body),
    'the attestation must not contain "not operated by us" — both apex domains are ours, ' +
    'so any host under them IS operated by us. Disclaim look-alikes on OTHER domains instead.');

  // It must positively claim both apexes, and say the inventory is not exhaustive
  // so that adding a subdomain cannot make the published document wrong.
  for (const apex of ['brainstorm.world', 'nosfabrica.com']) {
    assert(ESTATE_ATTESTATION.includes(apex),
      `the attestation must name the ${apex} apex domain as ours.`);
  }
  assert(/not an exhaustive claim|current inventory/i.test(ESTATE_ATTESTATION),
    'the attestation must state that the host list is a current inventory rather than an ' +
    'exhaustive claim, or it goes stale into falsehood the next time a host is added.');
});

test('U7 robots.txt disallows everything by default', () => {
  const { buildRobotsTxt } = loadSiteTrust();
  for (const arg of [{ allowIndexing: false }, {}, undefined]) {
    const body = buildRobotsTxt(arg);
    assert(/^\s*Disallow:\s*\/\s*$/m.test(body),
      `robots.txt must default to "Disallow: /" (fail closed) for ${JSON.stringify(arg)}; got:\n${body}`);
  }
});

test('U8 robots.txt permits crawling when indexing is enabled', () => {
  const { buildRobotsTxt } = loadSiteTrust();
  const body = buildRobotsTxt({ allowIndexing: true });
  assert(!/^\s*Disallow:\s*\/\s*$/m.test(body),
    `robots.txt must NOT blanket-disallow when allowIndexing is true; got:\n${body}`);
  assert(/User-agent:/i.test(body), 'robots.txt must still carry a User-agent line.');
});

test('U9 isBlockedProbePath flags probe and asset-shaped paths', () => {
  const { isBlockedProbePath } = loadSiteTrust();
  for (const p of PROBE_PATHS) {
    assert(isBlockedProbePath(p) === true,
      `isBlockedProbePath("${p}") must be true — returning 200 for this path is the signal ` +
      'that reads as a parked/clone host.');
  }
});

test('U10 isBlockedProbePath NEVER flags an SPA route, including dotted params', () => {
  const { isBlockedProbePath } = loadSiteTrust();
  for (const p of SPA_PATHS) {
    assert(isBlockedProbePath(p) === false,
      `isBlockedProbePath("${p}") must be false. Flagging it would 404 a live page — the ` +
      'exact failure mode ADR 0036 rejected Option A to avoid.');
  }
});

test('U11 isBlockedProbePath flags unhandled paths under /.well-known/', () => {
  const { isBlockedProbePath } = loadSiteTrust();
  assert(isBlockedProbePath('/.well-known/nonsense') === true,
    'Unhandled /.well-known/* paths must 404 rather than return the SPA shell.');
  assert(isBlockedProbePath('/.well-known/') === true,
    'The bare /.well-known/ directory must 404.');
});

test('U12 isBlockedProbePath is not bypassed by percent-encoding', () => {
  const { isBlockedProbePath } = loadSiteTrust();
  // Express does not percent-decode req.path, so a classifier that matches on
  // the raw string lets /%2Eenv through and answers 200 — the exact signal the
  // rule exists to remove. Found by adversarial probing at review.
  for (const p of ['/%2Eenv', '/wp-login%2Ephp', '/config%2Ejson', '/%2e%2e/etc/passwd']) {
    assert(isBlockedProbePath(p) === true,
      `isBlockedProbePath("${p}") must be true — percent-encoding must not bypass the rule.`);
  }
  // A malformed escape must not throw; it is simply classified on the raw path.
  let threw = null;
  try { isBlockedProbePath('/%zz%'); } catch (e) { threw = e; }
  assert(threw === null, `a malformed percent-escape must not throw; got ${threw && threw.message}.`);
  // Decoding must not start flagging legitimate routes.
  for (const p of ['/user/abc%20def', '/pin/my%2Epinned%2Etag', '/tag/some%2Eslug/abc123']) {
    assert(isBlockedProbePath(p) === false,
      `isBlockedProbePath("${p}") must be false — decoding must not flag real routes.`);
  }
});

test('U13 isBlockedProbePath NEVER blocks an ACME HTTP-01 challenge', () => {
  const { isBlockedProbePath } = loadSiteTrust();
  // cert-manager (k8s, http01 solver) and certbot (droplets) both answer
  // /.well-known/acme-challenge/<token>. A 404 here fails certificate issuance
  // and renewal — silent for weeks, then expired TLS on every host at once.
  for (const p of [
    '/.well-known/acme-challenge/abc123',
    '/.well-known/acme-challenge/Xy_-9.token',
    '/.well-known/acme-challenge/nested/token',
  ]) {
    assert(isBlockedProbePath(p) === false,
      `isBlockedProbePath("${p}") must be false — blocking ACME breaks TLS renewal fleet-wide.`);
  }
  // The exemption must be exactly that prefix, not all of /.well-known/.
  assert(isBlockedProbePath('/.well-known/acme-challenge') === true,
    'the bare /.well-known/acme-challenge path (no trailing token) is not a challenge and must 404.');
  assert(isBlockedProbePath('/.well-known/nonsense') === true,
    'the exemption must not widen to the whole /.well-known/ prefix.');
});

/* ─────────────── S-class: source sentinels ─────────────── */

test('S1 control-panel registers both document routes', () => {
  const src = readSafe(CONTROL_PANEL);
  assert(src, 'bin/control-panel.js must be readable.');
  assert(/['"`]\/\.well-known\/security\.txt['"`]/.test(src),
    'bin/control-panel.js must register GET /.well-known/security.txt. Note express.static ' +
    'ignores dotfile paths by default, so a file in public/ would not be served.');
  assert(/['"`]\/robots\.txt['"`]/.test(src),
    'bin/control-panel.js must register GET /robots.txt.');
});

test('S2 the deny rule sits AFTER static middleware and BEFORE the SPA catch-all', () => {
  const src = readSafe(CONTROL_PANEL);
  // The REGISTRATION site, not the import. `search()` would find the top-level
  // require, which necessarily precedes express.static and would make the
  // ordering assertions below unsatisfiable.
  const denyIdx = src.lastIndexOf('isBlockedProbePath');
  const catchAllIdx = src.search(/app\.get\(\s*['"`]\*['"`]/);
  const lastStaticIdx = src.lastIndexOf('express.static');
  assert(denyIdx !== -1, 'bin/control-panel.js must call isBlockedProbePath.');
  assert(catchAllIdx !== -1, 'The SPA catch-all must still exist.');
  assert(denyIdx < catchAllIdx,
    'The deny rule must be registered BEFORE the SPA catch-all, or the catch-all swallows ' +
    'every probe path first and the rule is dead code.');
  assert(denyIdx > lastStaticIdx,
    'The deny rule must be registered AFTER all express.static middleware, or it will 404 ' +
    'real assets (.js/.css/.ico) before static has a chance to serve them.');
});

test('S3 SECURITY.md exists at the repo root', () => {
  const md = readSafe(SECURITY_MD);
  assert(md, 'SECURITY.md must exist at the repo root — it is the target of the Policy: field.');
  assert(md.length > 200, 'SECURITY.md must carry real reporting instructions, not a stub.');
});

test('S4 no per-deployment hostname is hardcoded into the shared module', () => {
  const src = readSafe(SITE_TRUST);
  assert(src, 'src/utils/siteTrust.js must exist.');
  const canonicalLine = src.split(/\r?\n/).find(
    (l) => /Canonical/.test(l) && /brainstorm\.world/.test(l)
  );
  assert(!canonicalLine,
    'Canonical must be rendered from configuration, never hardcoded to a deployment hostname ' +
    `(CLAUDE.md house rule). Offending line: ${canonicalLine}`);
  assert(!/DOMAIN_NAME\s*===\s*['"]tapestry\.brainstorm\.world['"]/.test(src),
    'Indexing policy must key off a config flag, not a hardcoded production hostname.');
});

test('S5 docker-compose passes ALLOW_INDEXING through to the container', () => {
  const compose = readSafe(path.join(ROOT, 'docker-compose.yml'));
  assert(compose, 'docker-compose.yml must be readable.');
  assert(/ALLOW_INDEXING=\$\{ALLOW_INDEXING/.test(compose),
    'docker-compose.yml must forward ALLOW_INDEXING into the container environment. ' +
    'Without it, setting ALLOW_INDEXING in .env on the droplet never reaches the Node ' +
    'process and production silently keeps serving "Disallow: /" — AC-5 fails in the one ' +
    'place it matters, with no local symptom.');
  assert(/ALLOW_INDEXING:-false/.test(compose),
    'The compose default for ALLOW_INDEXING must be false (fail closed).');
});

/* ─────────────── H-class: live HTTP ─────────────── */

test('H1 GET /.well-known/security.txt returns 200 as text/plain', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/.well-known/security.txt`);
  assert(res && res.status === 200, `expected 200; got ${res && res.status}.`);
  const ct = res.headers.get('content-type') || '';
  assert(/text\/plain/i.test(ct),
    `expected text/plain; got "${ct}". Serving the SPA shell here is the current defect.`);
  assert(/charset=utf-8/i.test(ct), `expected charset=utf-8; got "${ct}".`);
});

test('H2 the served security.txt is a valid RFC 9116 document', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/.well-known/security.txt`);
  if (!res || res.status !== 200) throw new Error(`expected 200; got ${res && res.status}.`);
  const fields = parseSecurityTxt(await res.text());
  assert(fields.contact && fields.contact.length >= 1, 'served document must carry Contact.');
  assert(fields.expires && fields.expires.length === 1,
    `served document must carry exactly one Expires; got ${JSON.stringify(fields.expires)}.`);
  assert(Date.parse(fields.expires[0]) > Date.now(), 'served Expires must be in the future.');
});

test('H3 GET /robots.txt returns 200 as text/plain', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/robots.txt`);
  assert(res && res.status === 200, `expected 200; got ${res && res.status}.`);
  const ct = res.headers.get('content-type') || '';
  assert(/text\/plain/i.test(ct),
    `expected text/plain; got "${ct}" — today this returns the SPA shell as text/html.`);
});

test('H4 probe paths return a genuine 404', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const wrong = [];
  for (const p of PROBE_PATHS) {
    const res = await fetchOrNull(`${BASE}${p}`);
    if (!res || res.status !== 404) wrong.push(`${p} → ${res && res.status}`);
  }
  assert(wrong.length === 0,
    `every probe path must 404; these did not: ${wrong.join(', ')}.`);
});

test('H5 unhandled /.well-known/* paths return 404', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/.well-known/nonsense-xyz`);
  assert(res && res.status === 404, `expected 404; got ${res && res.status}.`);
});

test('H6 every SPA route still resolves with 200 (regression guard)', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const broken = [];
  for (const p of SPA_PATHS) {
    const res = await fetchOrNull(`${BASE}${p}`);
    if (!res || res.status !== 200) { broken.push(`${p} → ${res && res.status}`); continue; }
    const ct = res.headers.get('content-type') || '';
    if (!/text\/html/i.test(ct)) broken.push(`${p} → content-type ${ct}`);
  }
  assert(broken.length === 0,
    `client-side routing must keep working on refresh; these broke: ${broken.join(', ')}.`);
});

test('H7 /api/ routes are unaffected by the deny rule', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/api/assistant/pubkey`);
  assert(res && res.status !== 404,
    `an existing API route must not be 404ed by the deny rule; got ${res && res.status}.`);
});

test('H8 real static assets are still served', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const res = await fetchOrNull(`${BASE}/brainstorm.svg`);
  assert(res && res.status === 200,
    `a real static asset must still be served (the deny rule must sit after express.static); ` +
    `got ${res && res.status}.`);
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- site trust signals: security.txt, robots.txt, honest 404s (epic site-trust-signals, Story 1) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nsite-trust-signals: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
