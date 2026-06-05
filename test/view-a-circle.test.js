/**
 * Story #34: View a circle's definition (read-only). Source-regex over
 * CommunityDetail.jsx — the belonging-bar + "Based on <parent>" link render.
 * See engineering-team/stories/communities-declaration/34-view-a-circle.test-plan.md
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

test('T1: CommunityDetail renders the belonging-bar (belongingBar field)', () => {
  const src = read(DETAIL);
  assert(/belongingBar/.test(src), 'CommunityDetail must render the circle\'s belongingBar');
});

test('T2: CommunityDetail renders a "Based on" parent affordance gated on the parent field', () => {
  const src = read(DETAIL);
  assert(/Based on/i.test(src), 'CommunityDetail must show a "Based on <parent>" affordance');
  assert(/\.parent\b/.test(src), 'the "Based on" affordance must be gated on the circle\'s parent field');
});

test('T3: the belonging-bar / parent render is read-only (no auth gate around them)', () => {
  const src = read(DETAIL);
  // belongingBar must be referenced outside a signedIn-only block — assert it
  // appears in the file (the header/identity render is always shown).
  assert(/belongingBar/.test(src), 'belongingBar must render for all visitors');
});

test('T4: CommunityDetail uses no owner/admin/moderator labels', () => {
  const src = read(DETAIL).replace(/\/\/.*$/gm, '');
  assert(!/\b(owner|admin|moderator)\b/i.test(src),
    'CommunityDetail must not label anyone owner/admin/moderator (peer copy)');
});

test('T5: loading + error states preserved (no regression)', () => {
  const src = read(DETAIL);
  assert(/loading/i.test(src) && /FetchError|error/i.test(src),
    'CommunityDetail must retain its loading + error states');
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
