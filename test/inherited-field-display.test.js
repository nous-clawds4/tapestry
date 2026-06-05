/**
 * Story #38: inherited-vs-overridden display on a forked circle.
 * Source-regex over CommunityDetail.jsx.
 * See engineering-team/stories/communities-declaration/38-inherited-field-display.test-plan.md
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

test('T1: CommunityDetail imports + uses the §26 resolver', () => {
  const src = read(DETAIL);
  assert(/resolveDefinition/.test(src), 'CommunityDetail must use resolveDefinition');
});

test('T2: CommunityDetail resolves only when the circle has a parent (live)', () => {
  const src = read(DETAIL);
  assert(/\.parent\b/.test(src) && /resolveDefinition\(/.test(src),
    'CommunityDetail must resolve gated on the circle having a parent');
});

test('T3: an "(inherited)" marker is rendered for inherited fields', () => {
  const src = read(DETAIL);
  assert(/inherited/i.test(src), 'CommunityDetail must mark inherited fields');
});

test('T4: the effective (resolved) value is rendered, not only the child\'s own', () => {
  const src = read(DETAIL);
  assert(/resolved\?\.|resolved\./.test(src), 'CommunityDetail must render resolved/effective values');
});

test('T5: no-parent circles render without inheritance markers (no regression)', () => {
  const src = read(DETAIL);
  // The inherited marker is gated on (!c.belongingBar && resolved?.belongingBar),
  // so a circle with its own belongingBar (or no parent → resolved null) shows no marker.
  assert(/!c\.belongingBar\s*&&\s*resolved/.test(src),
    'the inherited marker must be gated so own/no-parent fields show no marker');
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
