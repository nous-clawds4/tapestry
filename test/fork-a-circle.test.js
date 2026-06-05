/**
 * Story #37: Fork a circle. Source-regex over Found.jsx + CommunityDetail.jsx,
 * pure-function eval for the builder's omit-empty behavior.
 * See engineering-team/stories/communities-declaration/37-fork-a-circle.test-plan.md
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FOUND = path.join(ROOT, 'ui-communities/src/pages/Found.jsx');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');
const DECL = path.join(ROOT, 'ui-communities/src/events/declaration.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

function loadBuild() {
  const src = read(DECL);
  const m = src.match(/export\s+function\s+buildCommunityDeclaration\s*\(([^)]*)\)\s*\{([\s\S]*?)^\}/m);
  if (!m) throw new Error('declaration.js must export buildCommunityDeclaration');
  const body = `const nowSec = () => 1700000000;\n${m[2]}`;
  // eslint-disable-next-line no-new-func
  return new Function(m[1], body);
}

test('T1: Found.jsx reads a ?from parent param', () => {
  const src = read(FOUND);
  assert(/useSearchParams/.test(src) && /['"]from['"]/.test(src), 'Found.jsx must read the ?from parent a-tag');
});

test('T2: Found.jsx pre-fills via resolveDefinition (parent resolved definition)', () => {
  const src = read(FOUND);
  assert(/resolveDefinition/.test(src), 'Found.jsx must resolve the parent definition for fork pre-fill');
});

test('T3: Found.jsx passes parentATag to buildCommunityDeclaration', () => {
  const src = read(FOUND);
  assert(/buildCommunityDeclaration\([\s\S]{0,120}parentATag/.test(src),
    'Found.jsx must pass parentATag to buildCommunityDeclaration');
});

test('T4: CommunityDetail offers "Fork this circle" → the found flow with the parent', () => {
  const src = read(DETAIL);
  assert(/Fork this circle/.test(src), 'CommunityDetail must offer a Fork action');
  assert(/\/found\?from=/.test(src), 'Fork must navigate to the found flow with ?from=<parent>');
});

test('T5: builder omits empty optional fields (so unedited fields inherit)', () => {
  const build = loadBuild();
  const out = build({ viewerPubkey: 'a'.repeat(64), circle: { slug: 'x', name: 'X' }, parentATag: '39998:p:par' });
  const keys = out.tags.map(t => t[0]);
  assert(keys.includes('name'), 'provided name is written');
  assert(!keys.includes('description'), 'omitted purpose must NOT be written');
  assert(!keys.includes('belonging'), 'omitted belonging must NOT be written');
  const b = out.tags.find(t => t[0] === 'b');
  assert(b && b[1] === '39998:p:par' && b[2] === 'inherit', 'fork must write the b parent tag');
});

test('T6: fork writes only fields changed from the parent baseline', () => {
  const src = read(FOUND);
  assert(/baseline/.test(src) && /changed\(/.test(src),
    'Found.jsx fork must diff against the parent baseline and write only changed fields');
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
