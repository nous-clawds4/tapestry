/**
 * Story #35: Discover circles (read-only). Source-regex over Discover.jsx +
 * client.js — the discovery union surfaces Declarations, renders with no account.
 * See engineering-team/stories/communities-declaration/35-discover-circles.test-plan.md
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DISCOVER = path.join(ROOT, 'ui-communities/src/pages/Discover.jsx');
const CLIENT = path.join(ROOT, 'ui-communities/src/api/client.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

test('T1: Discover uses the relay discovery union (getDiscoverableCommunitiesFromRelay)', () => {
  const src = read(DISCOVER);
  assert(/getDiscoverableCommunitiesFromRelay/.test(src), 'Discover must call the relay discovery union');
});

test('T2: the discovery union surfaces Community Declarations', () => {
  const src = read(CLIENT);
  assert(/fetchAllCommunityDeclarations/.test(src),
    'getDiscoverableCommunitiesFromRelay must union Declarations via fetchAllCommunityDeclarations');
});

test('T3: Discover renders circle cards for ready results', () => {
  const src = read(DISCOVER);
  assert(/CommunityCard/.test(src), 'Discover must render CommunityCard for results');
});

test('T4: Discover has a designed empty state', () => {
  const src = read(DISCOVER);
  assert(/length === 0/.test(src) || /empty/i.test(src), 'Discover must handle the empty grid with a designed state');
});

test('T5: Discover renders with no account (no signedIn early-return gating the grid)', () => {
  const src = read(DISCOVER);
  assert(!/if\s*\(\s*!\s*signedIn\s*\)\s*return/.test(src),
    'Discover must not early-return on !signedIn — read-only first visit is required');
});

test('T6: Discover tracks loading / error / ready states', () => {
  const src = read(DISCOVER);
  for (const st of ['loading', 'error', 'ready']) {
    assert(new RegExp(`['"]${st}['"]`).test(src), `Discover must handle the ${st} state`);
  }
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (e) { console.log(`  ✗ ${t.name}`); console.log(`      ${e.message.split('\n')[0]}`); fail++; }
  }
  return { pass, fail };
}
module.exports = { run };
