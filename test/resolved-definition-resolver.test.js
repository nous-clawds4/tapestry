/**
 * Story #36: §26 Resolved-Definition resolver. Pure-function eval for
 * mergeDefinition + source-regex for the walk's guards/ordering.
 * See engineering-team/stories/communities-declaration/36-resolved-definition-resolver.test-plan.md
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const RESOLVER = path.join(ROOT, 'ui-communities/src/lib/resolveDefinition.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

function loadMerge() {
  const src = read(RESOLVER);
  const m = src.match(/export\s+function\s+mergeDefinition\s*\(([^)]*)\)\s*\{([\s\S]*?)^\}/m);
  if (!m) throw new Error('resolveDefinition.js must export `function mergeDefinition(...) { ... }`');
  const body = `const DEFINITION_FIELDS = ['name','description','belongingBar','topics'];\n${m[2]}`;
  // eslint-disable-next-line no-new-func
  return new Function(m[1], body);
}

test('T1: exports resolveDefinition + mergeDefinition + MAX_DEPTH', () => {
  const src = read(RESOLVER);
  assert(/export\s+(async\s+)?function\s+resolveDefinition\b/.test(src), 'must export resolveDefinition');
  assert(/export\s+function\s+mergeDefinition\b/.test(src), 'must export mergeDefinition');
  assert(/export\s+const\s+MAX_DEPTH\s*=\s*16/.test(src), 'must export MAX_DEPTH = 16');
});

test('T2: mergeDefinition — non-empty child field overrides', () => {
  const merge = loadMerge();
  const out = merge({ name: 'Parent', belongingBar: 'parent bar' }, { name: 'Child' });
  assert(out.name === 'Child', `child name must override; got ${out.name}`);
  assert(out.belongingBar === 'parent bar', 'omitted child field inherits the base');
});

test('T3: mergeDefinition — empty child field inherits the base', () => {
  const merge = loadMerge();
  const out = merge({ description: 'inherited' }, { description: '' });
  assert(out.description === 'inherited', `empty child field must inherit; got ${out.description}`);
});

test('T4: mergeDefinition — empty topics array inherits the base topics', () => {
  const merge = loadMerge();
  const out = merge({ topics: ['a', 'b'] }, { topics: [] });
  assert(Array.isArray(out.topics) && out.topics.length === 2, 'empty child topics inherit base topics');
});

test('T5: the walk is depth-bounded (MAX_DEPTH) and cycle-guarded (visited set)', () => {
  const src = read(RESOLVER);
  assert(/depth\s*>=\s*maxDepth/.test(src), 'walk must enforce a depth bound');
  assert(/visited\.has\(/.test(src) && /visited\.add\(/.test(src), 'walk must use a visited-set cycle-guard');
});

test('T6: multi-parent folds in reverse so first-listed wins', () => {
  const src = read(RESOLVER);
  assert(/for\s*\(let i = parents\.length - 1; i >= 0; i--\)/.test(src) || /parents\.length - 1[\s\S]{0,40}i--/.test(src),
    'multi-parent must fold parents in reverse (first-listed-wins)');
});

test('T7: resolution is live via an injected fetcher (no snapshot)', () => {
  const src = read(RESOLVER);
  assert(/fetchByATag/.test(src), 'resolveDefinition must take an injected fetchByATag (live read-time)');
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
