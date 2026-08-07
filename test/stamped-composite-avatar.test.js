/**
 * ta-avatar #3: The stamped composite avatar, published to nostr — server half.
 *
 * Story: engineering-team/stories/ta-avatar/3-stamped-composite-avatar-on-nostr.md
 * ADR:   engineering-team/decisions/ta-avatar/0003-owner-composited-avatar-hosted-by-the-instance.md
 * Browser half: tests/brainstorm/ta-composite-avatar.spec.js (AC1's preview + the
 * composite geometry, which only a browser can settle).
 *
 * Classes here:
 *   U — the store-and-name step, executed against a temp directory. This is where
 *       ADR D3 lives (regenerating must NOT delete the previous composite) and it
 *       is the one part of this story that is pure enough to prove by execution.
 *   S — the guards a unit test cannot reach: owner gating, the parameterless
 *       proxy, the fetch bounds, the static mount, route registration.
 *   H — a deployed instance's behavior. See the note on why it SKIPs below.
 *
 * ── Why the H class skips instead of failing ─────────────────────────────
 * These tests describe an instance that has this story deployed. The reachable
 * instance during development is localhost:7778, which serves the SHARED checkout
 * — a different tree from this worktree — so it can never reflect this code
 * (ta-avatar #2's test plan documents the same constraint). Rather than parking
 * permanent red, the H class probes for the route and SKIPs when it is absent,
 * announcing loudly that live coverage did not run. The driving is done by U, S
 * and the browser class; H is the post-deploy instrument.
 *
 * ── One testability ask ──────────────────────────────────────────────────
 * The storage step must be exported and must accept a base directory, so it can
 * be exercised in a temp dir. Without that, D3 — the decision this story most
 * needs to get right — could only be checked by scanning source for the absence
 * of an unlink, which proves nothing about behavior.
 *
 * These FAIL against current code: src/api/assistant/avatar.js does not exist.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..');
const AVATAR_SRC = path.join(REPO, 'src/api/assistant/avatar.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const CONTROL_PANEL = path.join(REPO, 'bin/control-panel.js');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

let hExecuted = 0;
let hSkipped = 0;
let featureLive = null;

/** Does the reachable instance actually have this story deployed? */
async function featureAvailable() {
  if (featureLive !== null) return featureLive;
  try {
    const r = await fetch(`${HOST_BASE}/api/assistant/owner-avatar`, { signal: AbortSignal.timeout(8000) });
    // 401/403 means the route exists and is gated — that is "deployed".
    // 404 means the route is absent (an instance predating this story).
    featureLive = r.status !== 404;
  } catch { featureLive = false; }
  return featureLive;
}

// ── fixtures ────────────────────────────────────────────────────────────
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A valid, distinct 1x1 PNG. `seed` changes the bytes so the hash differs. */
function makePng(seed) {
  const base = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  // Append a tEXt-ish trailer: still PNG-signed, byte-distinct per seed.
  return Buffer.concat([base, Buffer.from(String(seed))]);
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ta-composite-'));
}
const madeDirs = [];
function freshDir() { const d = tempDir(); madeDirs.push(d); return d; }
function cleanupDirs() {
  for (const d of madeDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
}

function loadStore() {
  const mod = require(AVATAR_SRC);
  return mod;
}

// ─────────────────────────────────────────────────────────────────────────
// U — the store-and-name step
// ─────────────────────────────────────────────────────────────────────────

test('U1: the avatar module exists and exports a storage step that takes a base directory', () => {
  assert(fs.existsSync(AVATAR_SRC),
    'src/api/assistant/avatar.js does not exist. ADR 0003 puts the proxy, the upload and the storage ' +
    'step in their own module rather than growing src/api/assistant/index.js past ~540 lines.');
  const mod = loadStore();
  assert(typeof mod.storeCompositeAvatar === 'function',
    'src/api/assistant/avatar.js must export storeCompositeAvatar(buffer, opts). A base directory in ' +
    '`opts` is a testability-only ask — /var/lib/brainstorm does not exist on a dev host or on CI, and ' +
    'without an override ADR D3 (never delete the previous composite) can only be checked by scanning ' +
    `for the absence of an unlink, which proves nothing. Exports found: ${Object.keys(mod).join(', ')}`);
});

test('U2: storing a composite writes exactly one content-addressed PNG', () => {
  const { storeCompositeAvatar } = loadStore();
  const dir = freshDir();
  const buf = makePng('alpha');
  const out = storeCompositeAvatar(buf, { baseDir: dir });
  assert(out && typeof out === 'object', 'storeCompositeAvatar must return a descriptor object.');
  assert(typeof out.filename === 'string' && out.filename,
    `the descriptor must name the file it wrote. Got ${JSON.stringify(out)}`);
  assert(/^ta-avatar-[0-9a-f]{8}\.png$/.test(out.filename),
    `ADR 0003: the filename is content-addressed — ta-avatar-<hash8>.png — which is what lets a ` +
    `regenerate produce a NEW url instead of a stale cached one. Got ${JSON.stringify(out.filename)}.`);
  const files = fs.readdirSync(dir);
  assert(files.length === 1, `exactly one file should have been written; found ${JSON.stringify(files)}`);
  const written = fs.readFileSync(path.join(dir, out.filename));
  assert(written.subarray(0, 8).equals(PNG_SIG), 'the bytes on disk must be the PNG that was handed in.');
  assert(written.equals(buf), 'the stored file must be byte-identical to the supplied buffer.');
  assert(typeof out.path === 'string' && out.path.includes(out.filename),
    `the descriptor must carry the public path for the file. Got ${JSON.stringify(out.path)}`);
});

test('U3: storing the same composite twice is idempotent — same name, still one file', () => {
  const { storeCompositeAvatar } = loadStore();
  const dir = freshDir();
  const buf = makePng('alpha');
  const a = storeCompositeAvatar(buf, { baseDir: dir });
  const b = storeCompositeAvatar(buf, { baseDir: dir });
  assert(a.filename === b.filename,
    `content addressing means identical bytes get identical names. Got ${a.filename} then ${b.filename}.`);
  assert(fs.readdirSync(dir).length === 1,
    `re-storing identical bytes must not accumulate files; found ${JSON.stringify(fs.readdirSync(dir))}`);
});

test('U4: regenerating does NOT delete the previous composite (ADR D3 — AC3 vs AC4)', () => {
  const { storeCompositeAvatar } = loadStore();
  const dir = freshDir();
  const first = storeCompositeAvatar(makePng('alpha'), { baseDir: dir });
  const second = storeCompositeAvatar(makePng('beta'), { baseDir: dir });

  assert(first.filename !== second.filename,
    'different composites must get different names, or re-publishing could not point at the new one (AC4).');
  assert(fs.existsSync(path.join(dir, second.filename)),
    'the newly generated composite must be on disk (AC4).');
  assert(fs.existsSync(path.join(dir, first.filename)),
    'AC3 — "a published picture never silently dies". The previously generated composite is still the ' +
    'one named by the CURRENTLY published kind 0, and it stays published until the owner re-publishes. ' +
    'Deleting it on regenerate kills the avatar of the live profile in the window between generating ' +
    'and publishing. ADR 0003 D3 keeps old composites for exactly this reason; they are tens of ' +
    'kilobytes and regeneration is a deliberate manual act.');
  const files = fs.readdirSync(dir).sort();
  assert(files.length === 2, `both composites should remain; found ${JSON.stringify(files)}`);
});

test('U5: a buffer that is not a PNG is rejected on its BYTES, not its declared type', () => {
  const { storeCompositeAvatar } = loadStore();
  const dir = freshDir();
  const notPng = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8');
  let threw = false;
  try { storeCompositeAvatar(notPng, { baseDir: dir }); } catch { threw = true; }
  assert(threw,
    'storeCompositeAvatar must reject a non-PNG buffer (checked by magic bytes — a declared mime type ' +
    'is caller-supplied and cannot be trusted). Anything reaching this directory is served publicly.');
  assert(fs.readdirSync(dir).length === 0,
    `nothing may be written when the input is rejected; found ${JSON.stringify(fs.readdirSync(dir))}`);
});

test('U6: the stored name is derived from the content, so two different owners cannot collide by chance', () => {
  const { storeCompositeAvatar } = loadStore();
  const dir = freshDir();
  const buf = makePng('gamma');
  const out = storeCompositeAvatar(buf, { baseDir: dir });
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  assert(out.filename.includes(hash),
    `the name should be the content hash (sha256, first 8 hex) so identical input is stable across ` +
    `restarts and different input never overwrites. Expected a name containing ${hash}, got ` +
    `${JSON.stringify(out.filename)}. (If you chose a different digest, say so in the ADR and update this.)`);
});

// ─────────────────────────────────────────────────────────────────────────
// S — the guards a unit test cannot reach
// ─────────────────────────────────────────────────────────────────────────

test('S1: both new endpoints are owner-gated (AC6)', () => {
  const src = safeRead(AVATAR_SRC);
  assert(src, 'src/api/assistant/avatar.js missing — see U1.');
  assert(/isOwner\s*\(/.test(src),
    'AC6: the generate and store operations must be refused to anyone but the owner. Use the established ' +
    'gate — isOwner(req) from src/middleware/auth.js, as src/api/strfry/commands/publishEvent.js:34-38 does.');
  const gates = (src.match(/!\s*isOwner\s*\(\s*req\s*\)/g) || []).length;
  assert(gates >= 2,
    `both handlers need their own gate; found ${gates} owner check(s). The proxy leaks the owner's ` +
    'avatar URL and the upload writes to a publicly-served directory — neither may be open.');
  assert(/\b403\b/.test(src), 'an unauthorised caller must be refused with 403.');
});

test('S2: the proxy takes no URL from the request (ADR D2)', () => {
  const src = safeRead(AVATAR_SRC);
  assert(src, 'src/api/assistant/avatar.js missing — see U1.');
  const proxy = (src.match(/function handleOwnerAvatar[\s\S]*?\n\}/) || [''])[0];
  assert(proxy, 'src/api/assistant/avatar.js must define handleOwnerAvatar (ADR 0003 §Implementation notes).');
  assert(!/req\.(query|body|params)\s*\.\s*(url|src|picture|image|href)/.test(proxy),
    'ADR 0003 D2: the proxy must NOT accept a URL from the caller — that would make it a general-purpose ' +
    'arbitrary-fetch primitive. It reads the picture URL from the owner\'s own kind 0, server-side, so its ' +
    'reachable set is "whatever the owner published about themselves".');
  assert(/kinds?\s*[:=]\s*\[?\s*0|getKind0|kind 0/i.test(proxy) || /kind0/i.test(src),
    'the proxy must source the URL from the owner\'s kind 0 rather than from the request.');
});

test('S3: the proxy fetch is bounded — timeout, image-only, size cap', () => {
  const src = safeRead(AVATAR_SRC);
  assert(src, 'src/api/assistant/avatar.js missing — see U1.');
  assert(/AbortSignal\.timeout|AbortController/.test(src),
    'the outbound fetch needs a timeout (src/api/nip05.js:126-147 is the house pattern) — without one a ' +
    'slow host holds a server socket open indefinitely.');
  assert(/image\//.test(src),
    "the response content-type must be allow-listed to image/* — this endpoint's bytes are handed to a " +
    'canvas and then stored in a public directory.');
  assert(/content-length|byteLength|maxBytes|MAX_[A-Z_]*BYTES|5\s*\*\s*1024/i.test(src),
    'the download needs a size cap. Checking content-length alone is not enough — a chunked response ' +
    'declares none, so the streamed body must be bounded too (ADR 0003 D2).');
  assert(/https?:/.test(src),
    'only http(s) URLs may be fetched; a file:// or other scheme from a kind 0 must be refused.');
});

test('S4: nothing in the storage path deletes a previously stored composite (ADR D3)', () => {
  const src = safeRead(AVATAR_SRC);
  assert(src, 'src/api/assistant/avatar.js missing — see U1.');
  assert(!/unlinkSync|fs\.unlink|rmSync|fs\.rm\b|rimraf/.test(src),
    'ADR 0003 D3: old composites are kept deliberately. A delete here would break AC3 for the profile ' +
    'that is published right now. U4 proves the behavior; this sentinel catches a delete added later ' +
    'for tidiness, which is exactly how this regression would return.');
});

test('S5: the generated directory is served, and only that directory', () => {
  const src = safeRead(CONTROL_PANEL);
  assert(src, 'bin/control-panel.js missing — regression.');
  assert(/\/generated/.test(src) && /express\.static/.test(src),
    'bin/control-panel.js must serve the generated composites — this is the first directory in the repo ' +
    'that is both persisted and web-served (ADR 0003 §Consequences). Without the mount, every published ' +
    'composite URL 404s.');
  assert(/\/var\/lib\/brainstorm\/generated/.test(src),
    'the mount must point at the persisted volume path (/var/lib/brainstorm is the tapestry-data volume, ' +
    'docker-compose.yml:23) — a path inside the image would be wiped on every redeploy, breaking AC3.');
});

test('S6: both routes are registered', () => {
  const src = safeRead(API_INDEX);
  assert(/\/api\/assistant\/owner-avatar/.test(src),
    'src/api/index.js must register GET /api/assistant/owner-avatar beside the other assistant routes (:528-532).');
  assert(/\/api\/assistant\/avatar/.test(src),
    'src/api/index.js must register POST /api/assistant/avatar.');
});

test('S7: the publishable URL reuses story 2\'s reachability rule rather than a second one (ADR D4)', () => {
  const src = safeRead(AVATAR_SRC);
  assert(src, 'src/api/assistant/avatar.js missing — see U1.');
  assert(/isPubliclyReachable/.test(src),
    'ADR 0003 D4: the absolute URL offered for publishing is gated on the SAME predicate story 2 uses ' +
    '(isPubliclyReachable, src/api/assistant/index.js). Forking a second notion of "reachable" would mean ' +
    'two places to fix when OPEN.md #148 is addressed.');
});

// ─────────────────────────────────────────────────────────────────────────
// H — a deployed instance (skips when the instance predates this story)
// ─────────────────────────────────────────────────────────────────────────

test('H1: an unauthenticated caller is refused the proxy and the upload (AC6)', async () => {
  if (!(await featureAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const get = await fetch(`${HOST_BASE}/api/assistant/owner-avatar`, { signal: AbortSignal.timeout(15000) });
  assert(get.status === 401 || get.status === 403,
    `AC6: an anonymous caller must be refused the proxy; got HTTP ${get.status}.`);
  const post = await fetch(`${HOST_BASE}/api/assistant/avatar`, { method: 'POST', signal: AbortSignal.timeout(15000) });
  assert(post.status === 401 || post.status === 403,
    `AC6: an anonymous caller must be refused the upload; got HTTP ${post.status}. This endpoint writes ` +
    'into a publicly-served directory.');
});

test('H2: the generated directory is mounted and does not leak a directory listing', async () => {
  if (!(await featureAvailable())) { hSkipped += 1; return 'SKIP'; }
  hExecuted += 1;
  const r = await fetch(`${HOST_BASE}/generated/`, { signal: AbortSignal.timeout(15000) });
  const body = await r.text();
  assert(!/<title>Index of|Directory listing for/i.test(body),
    'the generated mount must not serve a directory index — express.static does not by default; this ' +
    'guards a later `{ index: true }` or an autoindex proxy in front.');
});

async function run() {
  console.log('\n=== stamped-composite-avatar (ta-avatar #3, server half) ===');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
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
  } finally {
    cleanupDirs();
  }
  console.log(`stamped-composite-avatar: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('stamped-composite-avatar: !! LIVE COVERAGE DID NOT RUN — the reachable instance does not ' +
      'serve this story (expected during development: localhost:7778 serves the shared checkout). ' +
      'Re-run against staging after deploy.');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' });
      fail++;
    }
  }
  console.log(`\nstamped-composite-avatar: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
