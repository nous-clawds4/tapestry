/**
 * Story communities-aliveness/5: new posts are offered, not forced (ADR-0035).
 * A poll detects new posts and surfaces a count; nothing is injected until the
 * member taps. Detection core (countNewPosts) tested against real source via
 * extract-and-eval (loaded inside tests to tolerate the new module). Component
 * lifecycle (poll/pill) via source-guards. The no-inject structural guarantee
 * is verified at review.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LIVE = path.join(ROOT, 'ui-communities/src/lib/liveUpdates.js');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }
function loadExport(file, name) {
  const src = read(file);
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${path.basename(file)} must export function ${name}`);
  // eslint-disable-next-line no-new-func
  return new Function(m[1], m[2]);
}
function loadCount() { return loadExport(LIVE, 'countNewPosts'); }

const V = 'v'.repeat(64);     // viewer
const X = 'x'.repeat(64);     // another author
const Y = 'y'.repeat(64);     // another author
const post = (id, author) => ({ id, author, content: 'c', createdAt: 1 });

test('T1: posts already displayed are not counted as new', () => {
  const countNewPosts = loadCount();
  const n = countNewPosts([post('p1', X)], new Set(['p1']), V);
  assert(n === 0, 'a displayed post is not new');
});

test('T2: the viewer\'s own posts are not counted as new', () => {
  const countNewPosts = loadCount();
  const n = countNewPosts([post('p2', V)], new Set(), V);
  assert(n === 0, 'own post excluded (AC5)');
});

test('T3: a new post by another author counts', () => {
  const countNewPosts = loadCount();
  const n = countNewPosts([post('p3', X)], new Set(), V);
  assert(n === 1, 'new other-author post counts');
});

test('T4: nothing new → 0', () => {
  const countNewPosts = loadCount();
  assert(countNewPosts([], new Set(), V) === 0, 'empty fresh → 0');
  assert(countNewPosts([post('p1', X)], new Set(['p1']), V) === 0, 'all displayed → 0');
});

test('T5: mixed set counts only new, other-authored posts', () => {
  const countNewPosts = loadCount();
  const fresh = [post('p1', X), post('p2', V), post('p3', X), post('p4', Y)];
  const n = countNewPosts(fresh, new Set(['p1']), V);
  assert(n === 2, 'displayed (p1) + own (p2) excluded; p3,p4 new → 2');
});

// ── Component source-guards (CommunityDetail.jsx) ──
test('T6: a conversation poll sets a count via countNewPosts + fetchPostsForCommunity', () => {
  const src = read(DETAIL);
  assert(/countNewPosts/.test(src), 'uses the countNewPosts helper');
  assert(/fetchPostsForCommunity/.test(src), 'poll fetches posts');
  assert(/setNewCount|setNewPosts|setNew/.test(src), 'poll sets a new-count state');
  assert(/tab === ['"]conversation['"]/.test(src), 'gated on the conversation tab');
});

test('T7: the poll pauses when the page is hidden', () => {
  const src = read(DETAIL);
  assert(/document\.hidden/.test(src), 'poll skips when document.hidden');
});

test('T8: an "N new" pill renders on count and taps to load + clear', () => {
  const src = read(DETAIL);
  assert(/new/i.test(src) && /newCount/.test(src), 'pill bound to the new count');
  assert(/newCount[\s\S]{0,400}?loadPosts\(\)/.test(src), 'tapping the pill loads posts');
});

test('T9: the poll uses an interval with cleanup and a silent catch', () => {
  const src = read(DETAIL);
  assert(/setInterval/.test(src) && /clearInterval/.test(src), 'interval set + cleared');
  assert(/catch/.test(src), 'poll failure is caught (silent — no error chrome)');
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
