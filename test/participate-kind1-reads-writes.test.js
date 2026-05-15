/**
 * Story #12: Participate — kind-1 reads + writes on the Conversation
 * tab (Slice 6, last v1 slice).
 *
 * Source-regex tests over the new fetch + composer + errors.js
 * extraction, plus pure-function tests for buildKind1Post. Same
 * approach as Slice 5: extract function bodies via regex + eval for
 * the pure-function checks; everything else source-regex.
 *
 * Live WebSocket round-trip + manual mock-mode verification are
 * documented in the test plan §"How to run".
 *
 * See engineering-team/stories/12-participate-kind1-reads-writes.test-plan.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UC = path.join(ROOT, 'ui-communities');

const BUILD_JS = path.join(UC, 'src/events/build.js');
const FETCH_JS = path.join(UC, 'src/events/fetch.js');
const ERRORS_JS = path.join(UC, 'src/lib/errors.js');
const POST_SKELETON = path.join(UC, 'src/components/PostSkeleton.jsx');
const POST_CARD = path.join(UC, 'src/components/PostCard.jsx');
const DETAIL_JSX = path.join(UC, 'src/pages/CommunityDetail.jsx');
const DRAWER_JSX = path.join(UC, 'src/pages/MemberDrawerContent.jsx');
const CREATE_JSX = path.join(UC, 'src/pages/Create.jsx');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (err) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${err.message}`); }
}

/* ────────────────────────────────────────────────────────────
 * T1–T4 — buildKind1Post pure function
 *
 * Same regex-extract-and-eval pattern as Slice 5's slugify tests.
 * build.js is ESM; we extract the function body and run it in a
 * CommonJS Function() context so we can invoke it from the test.
 * ──────────────────────────────────────────────────────────── */

function loadBuildKind1Post() {
  const src = read(BUILD_JS);
  const m = src.match(/export\s+function\s+buildKind1Post\s*\(([^)]*)\)\s*\{([\s\S]*?)^\}/m);
  if (!m) throw new Error('build.js must export `function buildKind1Post(...) { ... }`');
  // The function body uses `nowSec()`; provide a stub.
  const body = `const nowSec = () => 1700000000;\n${m[2]}`;
  // eslint-disable-next-line no-new-func
  return new Function(m[1], body);
}

test('T1: buildKind1Post returns the right kind/tags/content/created_at/pubkey shape', () => {
  const buildKind1Post = loadBuildKind1Post();
  const out = buildKind1Post({
    viewerPubkey: 'a'.repeat(64),
    communityATag: '39999:abc:listening-room',
    content: '  hello world  ',
  });
  assert(out.kind === 1, `kind must be 1; got ${out.kind}`);
  assert(out.content === 'hello world',
    `content must be trimmed; got "${out.content}"`);
  assert(out.pubkey === 'a'.repeat(64), 'pubkey must be the viewer');
  assert(typeof out.created_at === 'number', 'created_at must be a number');
  assert(Array.isArray(out.tags), 'tags must be an array');
  const aTag = out.tags.find(t => t[0] === 'a');
  assert(aTag && aTag[1] === '39999:abc:listening-room',
    `tags must include ['a', communityATag]; got ${JSON.stringify(out.tags)}`);
});

test('T2: buildKind1Post throws when viewerPubkey is empty', () => {
  const buildKind1Post = loadBuildKind1Post();
  for (const value of ['', null, undefined]) {
    let threw = false;
    try {
      buildKind1Post({ viewerPubkey: value, communityATag: '39999:x:y', content: 'hi' });
    } catch { threw = true; }
    assert(threw, `must throw on viewerPubkey=${JSON.stringify(value)}`);
  }
});

test('T3: buildKind1Post throws when communityATag is empty', () => {
  const buildKind1Post = loadBuildKind1Post();
  let threw = false;
  try {
    buildKind1Post({ viewerPubkey: 'a'.repeat(64), communityATag: '', content: 'hi' });
  } catch { threw = true; }
  assert(threw, 'must throw on empty communityATag');
});

test('T4: buildKind1Post throws when content is empty or whitespace', () => {
  const buildKind1Post = loadBuildKind1Post();
  for (const value of ['', '   ', null, undefined]) {
    let threw = false;
    try {
      buildKind1Post({ viewerPubkey: 'a'.repeat(64), communityATag: '39999:x:y', content: value });
    } catch { threw = true; }
    assert(threw, `must throw on content=${JSON.stringify(value)}`);
  }
});

/* ────────────────────────────────────────────────────────────
 * T5–T8 — fetch.js source-regex
 * ──────────────────────────────────────────────────────────── */

test('T5: src/events/fetch.js exports fetchKind1ForCommunity', () => {
  const src = read(FETCH_JS);
  assert(/export\s+(?:async\s+)?function\s+fetchKind1ForCommunity/.test(src) ||
         /export\s+const\s+fetchKind1ForCommunity/.test(src),
    'fetch.js must export fetchKind1ForCommunity');
});

test('T6: fetch.js gates mock vs real on VITE_USE_MOCK_DATA === "true"', () => {
  const src = read(FETCH_JS);
  assert(/import\.meta\.env\.VITE_USE_MOCK_DATA\s*===\s*['"]true['"]/.test(src) ||
         /['"]true['"]\s*===\s*[\s\S]{0,40}VITE_USE_MOCK_DATA/.test(src),
    'fetch.js must use the strict === "true" comparison (avoids the truthy-string gotcha)');
});

test('T7: fetch.js real-mode subscribes with filter { kinds: [1], "#a": [...] }', () => {
  const src = read(FETCH_JS);
  assert(/kinds:\s*\[\s*1\s*\]/.test(src),
    'fetch.js must filter on kinds: [1]');
  assert(/['"]#a['"]\s*:\s*\[/.test(src),
    'fetch.js must filter on the "#a" tag');
});

test('T8: fetch.js handles EOSE via an oneose callback that closes the subscription', () => {
  const src = read(FETCH_JS);
  assert(/oneose\s*:/.test(src),
    'fetch.js must wire an oneose callback');
  assert(/sub\.close\(\)|subscription\.close\(\)/.test(src),
    'fetch.js must close the subscription (sub.close()) on EOSE or timeout');
});

/* ────────────────────────────────────────────────────────────
 * T9–T11 — CommunityDetail.jsx wiring
 * ──────────────────────────────────────────────────────────── */

test('T9: CommunityDetail.jsx imports fetchKind1ForCommunity + buildKind1Post + publishErrorCopy from the right paths', () => {
  const src = read(DETAIL_JSX);
  assert(/from\s+['"]\.\.\/events\/fetch(?:\.js)?['"]/.test(src),
    'CommunityDetail.jsx must import from ../events/fetch.js');
  assert(/fetchKind1ForCommunity/.test(src),
    'CommunityDetail.jsx must reference fetchKind1ForCommunity');
  assert(/buildKind1Post/.test(src),
    'CommunityDetail.jsx must reference buildKind1Post');
  assert(/from\s+['"]\.\.\/lib\/errors(?:\.js)?['"]/.test(src),
    'CommunityDetail.jsx must import publishErrorCopy from ../lib/errors.js');
});

test('T10: CommunityDetail.jsx renders the composer only when signedIn && joined', () => {
  const src = read(DETAIL_JSX);
  // Look for a conditional that mentions both signedIn and joined near a composer/textarea.
  // The Conversation-tab section already has `signedIn && joined && <composer placeholder>`
  // pre-Slice-6. The real-composer block (textarea) must be inside that same gate.
  assert(/signedIn\s*&&\s*joined/.test(src) || /joined\s*&&\s*signedIn/.test(src),
    'CommunityDetail.jsx must gate the composer on signedIn && joined');
  // The composer must render a <textarea> (placeholder button is no longer enough).
  assert(/<textarea/.test(src),
    'CommunityDetail.jsx Conversation composer must render a <textarea> (not just a placeholder button)');
});

test('T11: CommunityDetail.jsx Send handler calls publishEvent with the result of buildKind1Post', () => {
  const src = read(DETAIL_JSX);
  // The Send handler must invoke buildKind1Post(...) then publishEvent(...).
  // Source-order check: buildKind1Post must appear before publishEvent in the file's Send-handler context.
  const buildIdx = src.indexOf('buildKind1Post(');
  assert(buildIdx >= 0, 'CommunityDetail.jsx must invoke buildKind1Post(...)');
  const sendHandlerPublishIdx = src.indexOf('publishEvent', buildIdx);
  assert(sendHandlerPublishIdx >= 0 && sendHandlerPublishIdx - buildIdx < 800,
    'CommunityDetail.jsx must call publishEvent shortly after buildKind1Post in the Send handler');
});

/* ────────────────────────────────────────────────────────────
 * T12–T13 — errors.js extraction
 * ──────────────────────────────────────────────────────────── */

test('T12: src/lib/errors.js exports publishErrorCopy + signInErrorCopy', () => {
  const src = read(ERRORS_JS);
  for (const name of ['publishErrorCopy', 'signInErrorCopy']) {
    assert(new RegExp(`export\\s+(?:default\\s+)?function\\s+${name}\\b|export\\s*\\{[\\s\\S]*?\\b${name}\\b|export\\s+const\\s+${name}\\b`).test(src),
      `errors.js must export ${name}`);
  }
});

test('T13: duplicate publishErrorCopy definitions removed; imports added from ../lib/errors', () => {
  for (const [filePath, name] of [[DETAIL_JSX, 'CommunityDetail.jsx'], [DRAWER_JSX, 'MemberDrawerContent.jsx'], [CREATE_JSX, 'Create.jsx']]) {
    const src = read(filePath);
    // No local function publishErrorCopy(result) {} definition.
    assert(!/function\s+publishErrorCopy\s*\(/.test(src),
      `${name} must NOT define publishErrorCopy locally — import from ../lib/errors.js instead`);
    // Must import publishErrorCopy from errors.js (or import the helper that consumes it from a shared module).
    assert(/from\s+['"]\.\.\/lib\/errors(?:\.js)?['"]/.test(src),
      `${name} must import from ../lib/errors.js`);
  }
});

/* ────────────────────────────────────────────────────────────
 * T14–T15 — PostSkeleton + PostCard adapter
 * ──────────────────────────────────────────────────────────── */

test('T14: PostSkeleton.jsx exports a PostSkeleton component', () => {
  const src = read(POST_SKELETON);
  assert(/export\s+default\s+function\s+PostSkeleton|export\s+(?:default\s+)?(?:const|function)\s+PostSkeleton/.test(src),
    'PostSkeleton.jsx must export a PostSkeleton component');
});

test('T15: PostCard.jsx adapts the new Post shape AND falls back to npubShort for hex authors', () => {
  const src = read(POST_CARD);
  // Must reference post.content (new shape) OR have a content-resolution fallback.
  assert(/post\.content/.test(src) || /content\s*=\s*post\.content/.test(src),
    'PostCard.jsx must read post.content for the new shape');
  // Must import or use npubShort somewhere as a fallback for unknown hex authors.
  assert(/npubShort/.test(src),
    'PostCard.jsx must fall back to npubShort for hex-pubkey authors not in mockData');
});

/* ────────────────────────────────────────────────────────────
 * Runner
 * ──────────────────────────────────────────────────────────── */

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message.split('\n')[0]}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
