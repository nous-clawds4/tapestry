/**
 * Story #10: NIP-07 sign-in + Join / Vouch / Raise-a-concern writes (Slice 4).
 *
 * Source-regex tests over the new auth, event, publish, and component
 * surfaces, plus a few structural-shape checks against the event-builder
 * source. The event builders are ESM with multiple paths through them;
 * Slice 3's test plan documents why we source-regex this style rather
 * than executing the ESM directly from the CommonJS runner.
 *
 * Live NIP-07 prompt + relay round-trip deferred to staging smoke
 * per the test plan §"Not covered".
 *
 * See engineering-team/stories/10-nip07-signin-and-writes.test-plan.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UC = path.join(ROOT, 'ui-communities');

const VIEWER_JS = path.join(UC, 'src/auth/viewer.js');
const BUILD_JS = path.join(UC, 'src/events/build.js');
const PUBLISH_JS = path.join(UC, 'src/events/publish.js');
const CONCERN_DIALOG = path.join(UC, 'src/components/ConcernDialog.jsx');
const APP_JSX = path.join(UC, 'src/App.jsx');
const HEADER_JSX = path.join(UC, 'src/components/Header.jsx');
const DETAIL_JSX = path.join(UC, 'src/pages/CommunityDetail.jsx');
const DRAWER_JSX = path.join(UC, 'src/pages/MemberDrawerContent.jsx');
const PKG_JSON = path.join(UC, 'package.json');

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

function walk(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────
 * T1–T6 — Event construction (source-regex against build.js)
 * ──────────────────────────────────────────────────────────── */

test('T1: buildCommunityRecord emits kind 39999 with the required tag set per PLAN.md §3', () => {
  const src = read(BUILD_JS);
  assert(/function\s+buildCommunityRecord|export\s+(?:const|function)\s+buildCommunityRecord/.test(src),
    'build.js must export buildCommunityRecord');
  // Required tag names per PLAN.md §3 community-record table.
  for (const tagName of ['d', 'z', 't', 'name', 'description', 'relay', 'seed', 'weighting_model', 'endorsement_threshold']) {
    assert(new RegExp(`['"\`]${tagName}['"\`]`).test(src),
      `build.js must reference tag name "${tagName}" in buildCommunityRecord`);
  }
  assert(/kind\s*:\s*39999/.test(src),
    'buildCommunityRecord must produce events with kind: 39999');
  // z-tag pointer format
  assert(/39998:\$\{[\s\S]{0,40}viewer/.test(src) || /39998:\$\{[\s\S]{0,40}pubkey/.test(src),
    'buildCommunityRecord z-tag must be 39998:<viewerPubkey>:brainstorm-communities');
});

test('T2: buildCommunityRecord skips optional tags when source fields are null', () => {
  const src = read(BUILD_JS);
  // The function must reference each optional tag at least once.
  for (const opt of ['image', 'topic', 'language', 'founder']) {
    assert(new RegExp(`['"\`]${opt}['"\`]`).test(src),
      `build.js must reference optional tag "${opt}"`);
  }
  // There must be conditional logic — at least one `if (` near an optional field.
  // Heuristic: an `if (community.image)` or `if (image)` pattern, OR a filter/map that
  // skips empty values.
  assert(/if\s*\(\s*(?:community\.)?(?:image|topic|topics|language|founder|nip72Wrapping)/.test(src) ||
         /\.filter\(/.test(src),
    'build.js must guard optional tag emission with a presence check');
});

test('T3: buildEndorsementSignal has kind 39999 + p/a tags + type/role defaults', () => {
  const src = read(BUILD_JS);
  assert(/function\s+buildEndorsementSignal|export\s+(?:const|function)\s+buildEndorsementSignal/.test(src),
    'build.js must export buildEndorsementSignal');
  assert(/kind\s*:\s*39999/.test(src),
    'buildEndorsementSignal must produce events with kind: 39999');
  for (const tagName of ['p', 'a', 'type', 'role']) {
    assert(new RegExp(`['"\`]${tagName}['"\`]`).test(src),
      `build.js must reference tag "${tagName}" in buildEndorsementSignal`);
  }
  // Defaults: type='endorse', role='member' per PLAN.md §3.
  assert(/['"\`]endorse['"\`]/.test(src),
    'buildEndorsementSignal must default type to "endorse"');
  assert(/['"\`]member['"\`]/.test(src),
    'buildEndorsementSignal must default role to "member"');
});

test('T4 + T5: signal event d-tag is deterministic over (role, target, community)', () => {
  const src = read(BUILD_JS);
  // d-tag computation expression must include role + target + community a-tag.
  // Heuristic pattern: a template literal mentioning role + target + community a-tag.
  assert(/\$\{role\}[\s\S]{0,80}\$\{(?:targetPubkey|target)\}[\s\S]{0,80}\$\{(?:communityATag|communityA|community)\}/.test(src) ||
         /\$\{(?:targetPubkey|target)\}[\s\S]{0,80}\$\{role\}/.test(src),
    'buildEndorsementSignal d-tag must combine role + target + community-a-tag deterministically');
});

test('T6: buildCommunitiesDListHeader emits kind 39998 header', () => {
  const src = read(BUILD_JS);
  assert(/function\s+buildCommunitiesDListHeader|export\s+(?:const|function)\s+buildCommunitiesDListHeader/.test(src),
    'build.js must export buildCommunitiesDListHeader');
  assert(/kind\s*:\s*39998/.test(src),
    'buildCommunitiesDListHeader must produce events with kind: 39998');
  assert(/['"\`]brainstorm-communities['"\`]/.test(src),
    'buildCommunitiesDListHeader d-tag must be "brainstorm-communities"');
  // Required-tag declarations per PLAN.md §3 header table.
  for (const decl of ['names', 'required']) {
    assert(new RegExp(`['"\`]${decl}['"\`]`).test(src),
      `buildCommunitiesDListHeader must declare "${decl}" tags`);
  }
});

/* ────────────────────────────────────────────────────────────
 * T7–T9 — Auth module
 * ──────────────────────────────────────────────────────────── */

test('T7: viewer.js exports the auth surface', () => {
  const src = read(VIEWER_JS);
  for (const fn of [
    'signInWithNip07',
    'npubShort',
    'npubFull',
    'getStoredViewerPubkey',
    'storeViewerPubkey',
    'clearStoredViewerPubkey',
  ]) {
    assert(new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${fn}\\b|export\\s*\\{[\\s\\S]*?\\b${fn}\\b`).test(src),
      `viewer.js must export ${fn}`);
  }
});

test('T8: viewer.js uses the canonical localStorage key', () => {
  const src = read(VIEWER_JS);
  assert(/['"]brainstormCommunitiesViewerPubkey['"]/.test(src),
    'viewer.js must reference localStorage key "brainstormCommunitiesViewerPubkey"');
});

test('T9: window.nostr access is centralized in src/auth/viewer.js', () => {
  // Anywhere in ui-communities/src that references window.nostr must be auth/viewer.js.
  const offenders = walk(path.join(UC, 'src'), p => /\.(jsx|js)$/.test(p))
    .filter(p => {
      const src = read(p);
      return /window\.nostr/.test(src);
    })
    .map(p => path.relative(ROOT, p))
    .filter(rel => rel !== 'ui-communities/src/auth/viewer.js');
  assert(offenders.length === 0,
    `window.nostr should only be touched in src/auth/viewer.js; offenders: ${offenders.join(', ')}`);
});

/* ────────────────────────────────────────────────────────────
 * T10–T12 — Publish module
 * ──────────────────────────────────────────────────────────── */

test('T10: publish.js gates mock vs real on VITE_USE_MOCK_DATA === "true"', () => {
  const src = read(PUBLISH_JS);
  assert(/import\.meta\.env\.VITE_USE_MOCK_DATA\s*===\s*['"]true['"]/.test(src) ||
         /['"]true['"]\s*===\s*[\s\S]{0,40}VITE_USE_MOCK_DATA/.test(src),
    'publish.js must gate on VITE_USE_MOCK_DATA === "true" (strict, same as Slice 3 client.js)');
});

test('T11: publish.js DEFAULT_RELAYS includes wss://communities.brainstorm.world', () => {
  const src = read(PUBLISH_JS);
  assert(/DEFAULT_RELAYS\s*=\s*\[[\s\S]{0,200}wss:\/\/communities\.brainstorm\.world/.test(src),
    'publish.js DEFAULT_RELAYS must include "wss://communities.brainstorm.world"');
});

test('T12: publish.js mock branch logs with the [publish/mock] prefix', () => {
  const src = read(PUBLISH_JS);
  assert(/['"`]\[publish\/mock\]/.test(src),
    'publish.js mock-mode console.log must use the "[publish/mock]" prefix');
});

/* ────────────────────────────────────────────────────────────
 * T13–T14 — App + Header wiring
 * ──────────────────────────────────────────────────────────── */

test('T13: App.jsx replaces the boolean signedIn placeholder with viewer-derived state', () => {
  const src = read(APP_JSX);
  // Must reference viewer state somehow.
  assert(/getStoredViewerPubkey|\bviewer\b/.test(src),
    'App.jsx must reference the viewer state (or its initializer)');
  // The old hardcoded useState(true) for signedIn must be gone.
  assert(!/useState\(true\)/.test(src),
    'App.jsx must no longer hardcode useState(true) — viewer must drive signedIn');
});

test('T14: Header.jsx renders npub-derived display (no hardcoded "Sarah Chen")', () => {
  const src = read(HEADER_JSX);
  assert(!/['"]Sarah Chen['"]/.test(src),
    'Header.jsx must not hardcode "Sarah Chen" — display name comes from npubShort(viewer)');
  assert(/npubShort|npubFull/.test(src),
    'Header.jsx must import + use npub display helpers from auth/viewer');
});

/* ────────────────────────────────────────────────────────────
 * T15 — ConcernDialog
 * ──────────────────────────────────────────────────────────── */

test('T15: ConcernDialog renders textarea (maxLength=280) + Cancel + Confirm', () => {
  const src = read(CONCERN_DIALOG);
  assert(/export\s+default\s+function\s+ConcernDialog|export\s+(?:default\s+)?(?:const|function)\s+ConcernDialog/.test(src),
    'ConcernDialog.jsx must export a ConcernDialog component');
  assert(/<textarea/.test(src),
    'ConcernDialog must render a textarea');
  assert(/maxLength\s*=\s*\{?\s*280/.test(src) || /maxLength=['"]280['"]/.test(src),
    'ConcernDialog textarea must have maxLength=280');
  assert(/Cancel/.test(src) && /Confirm/.test(src),
    'ConcernDialog must include Cancel + Confirm actions');
});

/* ────────────────────────────────────────────────────────────
 * T16–T17 — Page wiring
 * ──────────────────────────────────────────────────────────── */

test('T16: CommunityDetail.jsx Join handler calls publishEvent', () => {
  const src = read(DETAIL_JSX);
  assert(/publishEvent/.test(src),
    'CommunityDetail.jsx must import + call publishEvent in the Join handler');
  assert(/buildCommunityRecord/.test(src),
    'CommunityDetail.jsx must use buildCommunityRecord to construct the Join event');
});

test('T17: MemberDrawerContent wires Vouch + Raise-a-concern through publishEvent', () => {
  const src = read(DRAWER_JSX);
  assert(/publishEvent/.test(src),
    'MemberDrawerContent must call publishEvent for Vouch / Raise-a-concern');
  assert(/buildEndorsementSignal/.test(src),
    'MemberDrawerContent must use buildEndorsementSignal to construct the signal event');
});

/* ────────────────────────────────────────────────────────────
 * T18 — nostr-tools dependency
 * ──────────────────────────────────────────────────────────── */

test('T18: ui-communities/package.json declares nostr-tools ^2.23.3', () => {
  const pkg = JSON.parse(read(PKG_JSON));
  const dep = pkg.dependencies && pkg.dependencies['nostr-tools'];
  assert(dep,
    'ui-communities/package.json must declare nostr-tools as a dependency');
  assert(/\^?2\./.test(dep),
    `ui-communities/package.json nostr-tools must be on the ^2.x line (matches ui/); got ${dep}`);
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
