/**
 * Story #41: post anchor derives from the circle model (NB-1).
 * Source-regex over CommunityDetail.jsx.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

test('T1: post anchor derives from the circle model (39998 for declaration, else 39999)', () => {
  const src = read(DETAIL);
  assert(/model\s*===\s*['"]declaration['"]\s*\?\s*['"]39998['"]\s*:\s*['"]39999['"]/.test(src),
    'communityATag must pick 39998 for declaration circles, 39999 otherwise');
});

test('T2: posting wiring intact — buildCommunityPost + publishEvent (no regression)', () => {
  const src = read(DETAIL);
  assert(/buildCommunityPost/.test(src) && /publishEvent/.test(src),
    'CommunityDetail must still build + publish posts');
});

test('T3: posts are read via fetchPostsForCommunity with the anchor', () => {
  const src = read(DETAIL);
  assert(/fetchPostsForCommunity\(/.test(src) && /communityATag/.test(src),
    'CommunityDetail must read posts via fetchPostsForCommunity using communityATag');
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
