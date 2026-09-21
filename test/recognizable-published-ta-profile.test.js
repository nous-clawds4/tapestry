/**
 * ta-avatar #2: Recognizable published TA profile defaults.
 *
 * Story: engineering-team/stories/ta-avatar/2-recognizable-published-ta-profile.md
 * ADR:   engineering-team/decisions/ta-avatar/0002-branded-published-profile-defaults.md
 *
 * ── Why there is no browser class here ───────────────────────────────────
 * Story 1 needed Playwright because every one of its criteria was about what a
 * viewer SEES. This story's criteria are about what a SERVER PROPOSES and what
 * gets SIGNED into a kind 0 — the editor is an unchanged consumer (ADR 0002:
 * AssistantProfileEditor is deliberately untouched). The contract is the status
 * endpoint's `defaults` object, so that is what the live class asserts on.
 *
 * Classes:
 *   A — the committed asset itself. Stack-free, always runs.
 *   U — buildDefaultProfileContent called directly, stack-free. Hermetic: with no
 *       /etc/brainstorm.conf and no strfry on PATH (true on a dev host AND on the
 *       CI runner) it must yield the GENERIC name and NO picture — AC1's second
 *       branch and AC4's mechanism, executed rather than merely scanned.
 *   S — source assertions for what U and H cannot see (that the URL is derived,
 *       never literal).
 *   H — the live contract, against whatever instance is reachable.
 *
 * ── The one thing to read before touching this file ──────────────────────
 * ADR 0002 states "AC4 is free" because handlePublishProfile strips empty-string
 * keys, so a local instance would publish no picture. **That is not true on this
 * machine, and probably not on any dev box.** getInstanceDomain() falls back to
 * BRAINSTORM_RELAY_URL's host when STRFRY_DOMAIN is unset or 'localhost'
 * (src/api/assistant/index.js:108-117), which yields `localhost:7777` — and
 * `'localhost:7777' !== 'localhost'`, so getInstanceWebsite() returns
 * `https://localhost:7777` rather than ''. Verified live: the status endpoint
 * reports exactly that website today. A naive `picture: website ? ... : ''` would
 * therefore publish `https://localhost:7777/ta-avatar.png` — a loopback URL that
 * resolves, for every third-party client that fetches it, to THEIR OWN machine.
 * That is precisely the dead link AC4 forbids.
 *
 * H2 below encodes AC4 as an invariant rather than a constant, so it is correct
 * on a dev box AND on staging: the picture is present exactly when the instance's
 * own reported website is publicly routable. It fails today.
 *
 * These FAIL against current code: ui/public/ta-avatar.png does not exist,
 * buildDefaultProfileContent is not exported, and both branches hardcode
 * picture: ''.
 *
 * ── Re-aimed by assistant-profile #3 (2026-09-21) ────────────────────────
 * ADR assistant-profile/0003 supersedes three of ADR ta-avatar/0002's rules, as
 * the owner ratified on 2026-09-11 (story assistant-profile #3):
 *   - the picture is ALWAYS the branded avatar — the reference deployment's copy
 *     when the instance is not public — so "no public address → no picture" is gone;
 *   - a person with no name gets "npub...‹last 6›'s Tapestry Assistant", not the
 *     generic "Tapestry Assistant";
 *   - one role-free definition replaces the owner and customer branches.
 * U2, U3, S1–S3 and H1–H3 now assert that. The mirror predicate below gained the
 * private-network classes it lacked (OPEN.md row 148). A1, A2, U1, H4 and H5 are
 * unchanged. The story's own suite is test/one-default-assistant-profile.test.js.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ASSET = path.join(REPO, 'ui/public/ta-avatar.png');
const ASSISTANT_SRC = path.join(REPO, 'src/api/assistant/index.js');
const DEFAULTS_SRC = path.join(REPO, 'src/api/assistant/profileDefaults.js');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// What an instance that is not public proposes (assistant-profile #3, open question 1).
const REFERENCE_PICTURE = 'https://tapestry.brainstorm.world/ta-avatar.png';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function npubOf(pubkey) { return require('nostr-tools').nip19.npubEncode(pubkey); }

/** Source with comments removed, leaving `https://` inside strings intact. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');
}

let hExecuted = 0;
let hSkipped = 0;
let reachable = null;

async function stackAvailable() {
  if (reachable !== null) return reachable;
  try {
    const r = await fetch(`${HOST_BASE}/api/owner/pubkey`, { signal: AbortSignal.timeout(5000) });
    reachable = r.ok;
  } catch { reachable = false; }
  return reachable;
}

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  assert(r.ok, `${url} returned HTTP ${r.status}`);
  return r.json();
}

/**
 * Is `website` an address a stranger's nostr client could actually fetch?
 * Loopback and non-FQDN hosts are not — they resolve to the CLIENT's machine.
 * This is the property AC4 turns on; it is deliberately expressed here as a
 * question about the address, not as a hardcoded "localhost", so the same
 * assertion is correct on a dev box and on a deployed instance.
 */
function isPubliclyRoutable(website) {
  if (!website) return false;
  let host;
  try { host = new URL(website).hostname; } catch { return false; }
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return false;
  // Private names (OPEN.md row 148; assistant-profile #3's "public instance").
  if (h.endsWith('.internal') || h.endsWith('.home.arpa')) return false;
  // Loopback, "this network", RFC1918 private networks, link-local.
  if (/^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^169\.254\./.test(h)) return false;
  // IPv6 loopback, unspecified, unique-local (fc00::/7) and link-local (fe80::/10).
  if (h === '::1' || h === '::' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h)) return false;
  if (!h.includes('.') && !h.includes(':')) return false; // a bare hostname is not reachable from outside
  return true;
}

const EXPECTED_PICTURE_PATH = '/ta-avatar.png';

// ─────────────────────────────────────────────────────────────────────────
// A — the committed asset
// ─────────────────────────────────────────────────────────────────────────

test('A1: the branded avatar asset is committed where the build will publish it', () => {
  assert(fs.existsSync(ASSET),
    'ui/public/ta-avatar.png does not exist. ADR 0002 chose a committed PNG over reusing ta-badge.svg ' +
    'because native nostr clients (Coil / Kingfisher) and avatar proxies do not decode SVG — the blank ' +
    'this story exists to fix would persist in exactly the clients it targets. Files in ui/public/ are ' +
    'copied into dist/ by the Vite build and served at the site root (proved by ta-badge.svg on staging).');
});

test('A2: it is a real PNG, 512x512, and small enough to be an avatar', () => {
  assert(fs.existsSync(ASSET), 'ui/public/ta-avatar.png does not exist — see A1.');
  const buf = fs.readFileSync(ASSET);
  assert(buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'ta-avatar.png does not start with the PNG magic bytes — a renamed SVG or a truncated export would ' +
    'be fetched and silently dropped by every client.');
  // IHDR width/height live at bytes 16..24 of any PNG.
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert(width === 512 && height === 512,
    `ta-avatar.png is ${width}x${height}; ADR 0002 specifies 512x512, the nostr avatar norm.`);
  assert(buf.length <= 50 * 1024,
    `ta-avatar.png is ${Math.round(buf.length / 1024)}KB; the ADR caps it at 50KB (the validated render ` +
    'is ~17KB). A much larger file means the export went wrong, not that a judgement was made.');
});

// ─────────────────────────────────────────────────────────────────────────
// U — the defaults builder, executed stack-free
// ─────────────────────────────────────────────────────────────────────────

test('U1: buildDefaultProfileContent is exported so its output can be asserted directly', () => {
  const mod = require(ASSISTANT_SRC);
  assert(typeof mod.buildDefaultProfileContent === 'function',
    'src/api/assistant/index.js must export buildDefaultProfileContent. This is a testability-only ask — ' +
    'it does not dictate how the function works. Without it, the only handle on AC1 and AC4 is the live ' +
    `endpoint, which cannot run in CI. Exports found: ${Object.keys(mod).join(', ')}`);
});

test('U2: with no instance config and no relay, the default is the npub form, the reference deployment\'s branded picture, and no website', async () => {
  const mod = require(ASSISTANT_SRC);
  assert(typeof mod.buildDefaultProfileContent === 'function', 'not exported — see U1.');
  // Hermetic by construction: no /etc/brainstorm.conf and no strfry on PATH, true
  // on a dev host and on the CI runner alike. So the person has no discoverable
  // name and the instance is not public.
  const pk = 'ab'.repeat(32);
  const out = await mod.buildDefaultProfileContent(pk);
  assert(out && typeof out === 'object', 'buildDefaultProfileContent must resolve to a content object.');
  assert(out.name === `npub...${npubOf(pk).slice(-6)}'s Tapestry Assistant`,
    'assistant-profile #3: with no name discoverable, the default is "npub...‹last 6›\'s Tapestry Assistant" — it replaced ' +
    `the generic "Tapestry Assistant". Got name=${JSON.stringify(out.name)}.`);
  assert(out.display_name === out.name,
    `name and display_name must agree. Got ${JSON.stringify(out.name)} / ${JSON.stringify(out.display_name)}.`);
  assert(out.picture === REFERENCE_PICTURE,
    'assistant-profile #3 AC4: the picture is ALWAYS the branded avatar — with no public address, the reference ' +
    `deployment's copy (${REFERENCE_PICTURE}), never a loopback URL. Got picture=${JSON.stringify(out.picture)}.`);
  assert(!out.website, `with no public address no website is proposed. Got website=${JSON.stringify(out.website)}.`);
});

test('U3: a second person gets the same definition — the same picture, and never "a customer\'s Tapestry Assistant"', async () => {
  const mod = require(ASSISTANT_SRC);
  assert(typeof mod.buildDefaultProfileContent === 'function', 'not exported — see U1.');
  const out = await mod.buildDefaultProfileContent('cd'.repeat(32));
  assert(out.picture === REFERENCE_PICTURE,
    `every role obeys the same picture rule. Got picture=${JSON.stringify(out.picture)}.`);
  assert(!/a customer's/i.test(out.name || ''),
    `OPEN.md row 154: never "a customer's Tapestry Assistant". Got name=${JSON.stringify(out.name)}.`);
});

// ─────────────────────────────────────────────────────────────────────────
// S — what U and H cannot see
// ─────────────────────────────────────────────────────────────────────────

test('S1: a public instance\'s picture is its own /ta-avatar.png; the only deployment URL written into the code is the reference copy, once', () => {
  const idx = safeRead(ASSISTANT_SRC);
  assert(idx, 'src/api/assistant/index.js is missing — regression.');
  const defs = safeRead(DEFAULTS_SRC);
  assert(defs, 'src/api/assistant/profileDefaults.js is missing — ADR assistant-profile/0003 puts the one definition there.');
  assert(defs.includes(EXPECTED_PICTURE_PATH),
    `the definition must build a public instance's own copy from ${EXPECTED_PICTURE_PATH}.`);
  assert(!/https:\/\/[a-z0-9.-]*brainstorm\.world/i.test(codeOnly(idx)),
    'a deployment domain is hardcoded in src/api/assistant/index.js — the only one allowed is the reference avatar, in profileDefaults.js.');
  const literals = codeOnly(defs).match(/https:\/\/[a-z0-9.-]*brainstorm\.world[^'"`\s]*/gi) || [];
  assert(literals.length === 1 && literals[0] === REFERENCE_PICTURE,
    'exactly one deployment URL may be written into the definition — the reference avatar, used only when the instance ' +
    `is not public (assistant-profile #3, open question 1). Found ${JSON.stringify(literals)}.`);
});

test('S2: one definition for every role — neither buildDefaultProfileContent nor the definition branches on the role', () => {
  const idx = safeRead(ASSISTANT_SRC);
  const wrapper = (idx.match(/async function buildDefaultProfileContent[\s\S]*?\n\}/) || [''])[0];
  assert(wrapper, 'buildDefaultProfileContent not found — regression.');
  const defs = safeRead(DEFAULTS_SRC);
  assert(defs, 'src/api/assistant/profileDefaults.js is missing — see S1.');
  const offenders = [['index.js buildDefaultProfileContent', wrapper], ['profileDefaults.js', defs]]
    .filter(([, src]) => /\bisOwner\b/.test(codeOnly(src))).map(([where]) => where);
  assert(offenders.length === 0,
    `assistant-profile #3 AC1: the default must not depend on the role — isOwner appears in ${offenders.join(', ')}.`);
});

test('S3: the name reads "‹name›\'s Tapestry Assistant", and with no name the npub form — never a placeholder like "the owner" or "a customer"', async () => {
  const mod = require(ASSISTANT_SRC);
  assert(typeof mod.buildDefaultProfileContent === 'function', 'not exported — see U1.');
  const pk = 'ab'.repeat(32);
  const instance = {
    domain: 'staging.example.test', isPublic: true,
    website: 'https://staging.example.test', avatarUrl: 'https://staging.example.test/ta-avatar.png',
  };
  const named = await mod.buildDefaultProfileContent(pk, { personName: 'Brainstorm', instance });
  assert(named && named.name === "Brainstorm's Tapestry Assistant",
    `with a name: "‹name›'s Tapestry Assistant". Got ${JSON.stringify(named && named.name)}.`);
  const unnamed = await mod.buildDefaultProfileContent(pk, { personName: '', instance });
  assert(unnamed && unnamed.name === `npub...${npubOf(pk).slice(-6)}'s Tapestry Assistant`,
    `with no name: the npub form. Got ${JSON.stringify(unnamed && unnamed.name)}.`);
});

// ─────────────────────────────────────────────────────────────────────────
// H — the live contract
// ─────────────────────────────────────────────────────────────────────────

test('H1: the reachable instance proposes an owner-linked assistant — "‹name›\'s Tapestry Assistant" or the npub form, with the owner\'s npub in the about', async () => {
  if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const { pubkey: owner } = await getJson(`${HOST_BASE}/api/owner/pubkey`);
  const status = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${owner}`);
  const d = status.defaults || {};
  const npub = npubOf(owner);
  // An anonymous status call reads the person's name from the local relay only (ADR
  // assistant-profile/0003 sub-decision 2), so this asserts the shape, not which name.
  assert(typeof d.name === 'string' && /'s Tapestry Assistant$/.test(d.name) && !/^(a customer|the owner)'s/i.test(d.name),
    'assistant-profile #3: the proposed name is "‹name›\'s Tapestry Assistant" or "npub...‹last 6›\'s Tapestry Assistant" — ' +
    `never the generic name or a placeholder. Got ${JSON.stringify(d.name)}.`);
  if (d.name.startsWith('npub...')) {
    assert(d.name === `npub...${npub.slice(-6)}'s Tapestry Assistant`,
      `the npub form names THIS owner's npub. Got ${JSON.stringify(d.name)}.`);
  }
  assert(d.display_name === d.name, 'name and display_name must agree in the proposed defaults.');
  assert(typeof d.about === 'string' && d.about.startsWith('I am the Tapestry Assistant for ') && d.about.includes(npub),
    `the about names the owner by their npub. Got ${JSON.stringify(String(d.about || '').slice(0, 160))}.`);
});

test('H2: the proposed picture is always the branded avatar — this instance\'s own copy when its website is public, the reference copy otherwise — and a website is proposed only when public', async () => {
  if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const { pubkey: owner } = await getJson(`${HOST_BASE}/api/owner/pubkey`);
  const status = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${owner}`);
  const d = status.defaults || {};
  const website = d.website || '';

  if (website) {
    assert(isPubliclyRoutable(website),
      `assistant-profile #3 AC3: a website is proposed only on a public instance, but this instance proposes ` +
      `${JSON.stringify(website)}, which a stranger's client cannot reach (loopback or private network — OPEN.md row 148).`);
    assert(d.picture === `${website}${EXPECTED_PICTURE_PATH}`,
      `a public instance proposes its own copy: expected ${JSON.stringify(website + EXPECTED_PICTURE_PATH)}, ` +
      `got ${JSON.stringify(d.picture)}.`);
  } else {
    assert(d.picture === REFERENCE_PICTURE,
      `assistant-profile #3 AC4: an instance that is not public proposes the reference deployment's copy ` +
      `(${REFERENCE_PICTURE}). Got picture=${JSON.stringify(d.picture)}.`);
  }
});

test('H3: a customer assistant obeys the same rules — and is never "a customer\'s Tapestry Assistant"', async () => {
  if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const customer = 'dd'.repeat(32); // no relay key: the endpoint still proposes defaults
  const status = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${customer}`);
  const d = status.defaults || {};
  const website = d.website || '';
  if (website) {
    assert(isPubliclyRoutable(website) && d.picture === `${website}${EXPECTED_PICTURE_PATH}`,
      `a customer's assistant follows the same public-instance rule. Got website=${JSON.stringify(website)}, ` +
      `picture=${JSON.stringify(d.picture)}.`);
  } else {
    assert(d.picture === REFERENCE_PICTURE,
      `a customer's assistant carries the same branded picture. Got picture=${JSON.stringify(d.picture)}.`);
  }
  assert(!/^a customer's/i.test(d.name || ''),
    `OPEN.md row 154: never "a customer's Tapestry Assistant". Got name=${JSON.stringify(d.name)}.`);
});

test('H4: defaults are proposed alongside any published profile, never merged over it', async () => {
  if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const { pubkey: owner } = await getJson(`${HOST_BASE}/api/owner/pubkey`);
  const status = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${owner}`);
  assert(Object.prototype.hasOwnProperty.call(status, 'defaults'),
    'the status response must carry `defaults` — it is what the editor offers on reset.');
  assert(Object.prototype.hasOwnProperty.call(status, 'hasProfile'),
    'the status response must report hasProfile so the editor can prefer a published profile.');
  if (status.hasProfile) {
    assert(status.profile && typeof status.profile === 'object',
      'AC6: when a profile is published it must be returned separately from defaults, so changing the ' +
      'defaults cannot alter what an already-published instance shows.');
    assert(status.profile !== status.defaults,
      'AC6: the published profile and the proposed defaults must be distinct objects.');
  }
});

test('H5: the instance actually serves the branded asset it proposes', async () => {
  if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const r = await fetch(`${HOST_BASE}${EXPECTED_PICTURE_PATH}`, { signal: AbortSignal.timeout(20000) });
  const buf = Buffer.from(await r.arrayBuffer());
  // Status alone proves nothing: this is an SPA server, so an unknown path comes
  // back as index.html with a 200. The bytes are the only honest test.
  assert(buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    `AC3: ${HOST_BASE}${EXPECTED_PICTURE_PATH} did not serve PNG bytes (HTTP ${r.status}, ` +
    `${buf.length} bytes, starts ${JSON.stringify(buf.subarray(0, 16).toString('latin1'))}). A missing ` +
    'asset comes back as the SPA fallback page, and every client that fetches the published picture ' +
    'gets HTML. NOTE: the control panel serves the Vite build from dist/ — a source-only change to ' +
    'ui/public/ is invisible here until `cd ui && npm run build` runs.');
});

async function run() {
  console.log('\n=== recognizable-published-ta-profile (ta-avatar #2) ===');
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
  // OPEN.md #104/#106: a fully-skipped H-class is otherwise indistinguishable
  // from a real pass. Say so out loud.
  console.log(`recognizable-published-ta-profile: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('recognizable-published-ta-profile: !! LIVE COVERAGE DID NOT RUN — stack unreachable.');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' });
      fail++;
    }
  }
  console.log(`\nrecognizable-published-ta-profile: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
