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
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ASSET = path.join(REPO, 'ui/public/ta-avatar.png');
const ASSISTANT_SRC = path.join(REPO, 'src/api/assistant/index.js');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

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
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.localhost')) return false;
  if (/^127\./.test(h) || /^0\.0\.0\.0$/.test(h)) return false;
  if (!h.includes('.')) return false; // a bare hostname is not reachable from outside
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

test('U2: with no instance config and no relay, the owner default is the GENERIC name and NO picture', async () => {
  const mod = require(ASSISTANT_SRC);
  assert(typeof mod.buildDefaultProfileContent === 'function', 'not exported — see U1.');
  // Hermetic by construction: no /etc/brainstorm.conf and no strfry on PATH, true
  // on a dev host and on the CI runner alike. So the owner has no discoverable
  // name and the instance has no website — AC1's second branch and AC4's case.
  const out = await mod.buildDefaultProfileContent('ab'.repeat(32), true);
  assert(out && typeof out === 'object', 'buildDefaultProfileContent must resolve to a content object.');
  assert(out.name === 'Tapestry Assistant',
    `AC1: with no owner name discoverable, the default must fall back to the generic assistant name. ` +
    `Got name=${JSON.stringify(out.name)}.`);
  assert(out.display_name === out.name,
    `name and display_name must agree. Got ${JSON.stringify(out.name)} / ${JSON.stringify(out.display_name)}.`);
  assert(!out.picture,
    `AC4: with no public address there is nowhere to host the picture, so none may be proposed. ` +
    `Got picture=${JSON.stringify(out.picture)}.`);
});

test('U3: the same holds for a customer assistant — no address, no picture', async () => {
  const mod = require(ASSISTANT_SRC);
  assert(typeof mod.buildDefaultProfileContent === 'function', 'not exported — see U1.');
  const out = await mod.buildDefaultProfileContent('cd'.repeat(32), false);
  assert(!out.picture,
    `AC5 + AC4: the customer branch obeys the same public-address rule as the owner branch. ` +
    `Got picture=${JSON.stringify(out.picture)}.`);
});

// ─────────────────────────────────────────────────────────────────────────
// S — what U and H cannot see
// ─────────────────────────────────────────────────────────────────────────

test('S1: the picture URL is derived from the instance address, never a literal domain', () => {
  const src = safeRead(ASSISTANT_SRC);
  assert(src, 'src/api/assistant/index.js is missing — regression.');
  assert(src.includes(EXPECTED_PICTURE_PATH),
    `the defaults must reference ${EXPECTED_PICTURE_PATH} (ADR 0002 §Implementation notes).`);
  const builder = (src.match(/async function buildDefaultProfileContent[\s\S]*?\n\}/) || [''])[0];
  assert(builder, 'buildDefaultProfileContent not found — regression.');
  assert(/getInstanceWebsite\s*\(|\bwebsite\b/.test(builder),
    'the picture URL must be built from the instance address getInstanceWebsite() already computes.');
  assert(!/https:\/\/[a-z0-9.-]*brainstorm\.world/i.test(builder),
    'a deployment domain is hardcoded in buildDefaultProfileContent. The URL must come from this ' +
    "instance's own configured address — a literal would point every instance's assistant at someone " +
    "else's server.");
});

test('S2: both the owner and the customer branch propose the picture', () => {
  const src = safeRead(ASSISTANT_SRC);
  const builder = (src.match(/async function buildDefaultProfileContent[\s\S]*?\n\}/) || [''])[0];
  const refs = (builder.match(new RegExp(EXPECTED_PICTURE_PATH.replace('.', '\\.'), 'g')) || []).length;
  assert(refs >= 2,
    `AC5: both branches of buildDefaultProfileContent must propose the branded picture; found ` +
    `${refs} reference(s) to ${EXPECTED_PICTURE_PATH}. (A shared helper used by both branches is fine — ` +
    'if you take that route, make it obvious enough that this sentinel still sees two uses or update it.)');
});

test('S3: the owner name is fetched with an EMPTY fallback, so the generic branch is reachable', () => {
  const src = safeRead(ASSISTANT_SRC);
  const builder = (src.match(/async function buildDefaultProfileContent[\s\S]*?\n\}/) || [''])[0];
  assert(!/getKind0DisplayName\([^)]*['"]the owner['"]/.test(builder),
    "AC1's two cases are indistinguishable while the owner name is fetched with the 'the owner' " +
    'fallback: a real name and the fallback are both non-empty strings, so "generic name otherwise" ' +
    'can never be reached. Fetch with an empty fallback and interpolate a readable subject into `about` ' +
    'separately (ADR 0002 §Implementation notes).');
  assert(/\$\{[^}]*\}'s Tapestry Assistant/.test(builder),
    'AC1: the owner default must read "<owner>\'s Tapestry Assistant" when a name is known — the same ' +
    'pattern the customer branch already uses.');
});

// ─────────────────────────────────────────────────────────────────────────
// H — the live contract
// ─────────────────────────────────────────────────────────────────────────

test('H1: the reachable instance proposes an owner-linked assistant name', async () => {
  if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const { pubkey: owner } = await getJson(`${HOST_BASE}/api/owner/pubkey`);
  const status = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${owner}`);
  const d = status.defaults || {};
  const profiles = await getJson(`${HOST_BASE}/api/profiles?pubkeys=${owner}`);
  const ownerProfile = (profiles.profiles || {})[owner] || {};
  const ownerName = ownerProfile.display_name || ownerProfile.name || '';

  if (ownerName) {
    assert(d.name === `${ownerName}'s Tapestry Assistant`,
      `AC1: this instance's owner publishes the name ${JSON.stringify(ownerName)}, so the proposed ` +
      `assistant name must be "${ownerName}'s Tapestry Assistant". Got ${JSON.stringify(d.name)}.`);
  } else {
    assert(d.name === 'Tapestry Assistant',
      `AC1: this instance's owner has no published name, so the generic name is expected. ` +
      `Got ${JSON.stringify(d.name)}.`);
  }
  assert(d.display_name === d.name, 'name and display_name must agree in the proposed defaults.');
});

test('H2: the proposed picture is offered exactly when this instance has a publicly reachable address', async () => {
  if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const { pubkey: owner } = await getJson(`${HOST_BASE}/api/owner/pubkey`);
  const status = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${owner}`);
  const d = status.defaults || {};
  const website = d.website || '';
  const routable = isPubliclyRoutable(website);

  if (routable) {
    // AC2 + AC3: a deployed instance proposes its own branded image.
    assert(d.picture === `${website}${EXPECTED_PICTURE_PATH}`,
      `AC2/AC3: this instance reports the public address ${JSON.stringify(website)}, so the proposed ` +
      `picture must be ${JSON.stringify(website + EXPECTED_PICTURE_PATH)}. Got ${JSON.stringify(d.picture)}.`);
  } else {
    // AC4 — the decisive case, and the one ADR 0002 assumed was free.
    assert(!d.picture,
      `AC4: this instance reports the address ${JSON.stringify(website)}, which is NOT publicly ` +
      `reachable — a stranger's client fetching it would hit their own machine. No picture may be ` +
      `proposed, so none is published. Got picture=${JSON.stringify(d.picture)}.\n` +
      '        NOTE: an empty-string check alone does not achieve this. getInstanceDomain() falls back ' +
      "to BRAINSTORM_RELAY_URL's host (src/api/assistant/index.js:108-117), so a dev instance reports " +
      "https://localhost:7777 — truthy, and not equal to the string 'localhost'.");
  }
});

test('H3: a customer assistant obeys the same address rule', async () => {
  if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const customer = 'dd'.repeat(32); // no relay key: the endpoint still proposes defaults
  const status = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${customer}`);
  const d = status.defaults || {};
  const routable = isPubliclyRoutable(d.website || '');
  if (routable) {
    assert(d.picture === `${d.website}${EXPECTED_PICTURE_PATH}`,
      `AC5: a customer's assistant carries the same branded picture. Got ${JSON.stringify(d.picture)}.`);
  } else {
    assert(!d.picture,
      `AC5 + AC4: a customer's assistant obeys the same public-address rule. ` +
      `Got picture=${JSON.stringify(d.picture)}.`);
  }
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
