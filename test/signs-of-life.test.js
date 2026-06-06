/**
 * Story communities-aliveness/6: signs of life (ADR-0036). A pure describeActivity
 * turns post timestamps + founded date + now into a plain activity line (or null
 * to omit). Tested against real source via extract-and-eval (loaded inside tests
 * to tolerate the new module). Fetch + render sites via source-guards.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ACTIVITY = path.join(ROOT, 'ui-communities/src/lib/activity.js');
const FETCH = path.join(ROOT, 'ui-communities/src/events/fetch.js');
const DISCOVER = path.join(ROOT, 'ui-communities/src/pages/Discover.jsx');
const CARD = path.join(ROOT, 'ui-communities/src/components/CommunityCard.jsx');
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
function loadDescribe() { return loadExport(ACTIVITY, 'describeActivity'); }

const NOW = 1000000;
const DAY = 86400, WEEK = 7 * DAY;

test('T1: posts within a day → Active today + exact weekly count', () => {
  const d = loadDescribe();
  const line = d({ postTimes: [NOW - 100, NOW - 200], foundedAt: NOW - 30 * DAY, now: NOW });
  assert(line === 'Active today · 2 posts this week', `got: ${line}`);
});

test('T2: newest post 2 days ago → Active this week', () => {
  const d = loadDescribe();
  const line = d({ postTimes: [NOW - 2 * DAY], foundedAt: NOW - 30 * DAY, now: NOW });
  assert(line === 'Active this week · 1 post this week', `got: ${line}`);
});

test('T3: newest post 21 days ago → Quiet lately · last post 3 weeks ago', () => {
  const d = loadDescribe();
  const line = d({ postTimes: [NOW - 21 * DAY], foundedAt: NOW - 60 * DAY, now: NOW });
  assert(line === 'Quiet lately · last post 3 weeks ago', `got: ${line}`);
});

test('T4: no posts, founded ~1h ago → New circle · founded today', () => {
  const d = loadDescribe();
  const line = d({ postTimes: [], foundedAt: NOW - 3600, now: NOW });
  assert(line === 'New circle · founded today', `got: ${line}`);
});

test('T5: no posts, founded 60 days ago → Quiet · no posts yet', () => {
  const d = loadDescribe();
  const line = d({ postTimes: [], foundedAt: NOW - 60 * DAY, now: NOW });
  assert(line === 'Quiet · no posts yet', `got: ${line}`);
});

test('T6: no posts and no founded date → null (omit)', () => {
  const d = loadDescribe();
  assert(d({ postTimes: [], foundedAt: null, now: NOW }) === null, 'no data → null');
});

test('T7: now missing → null (omit; never a guessed claim)', () => {
  const d = loadDescribe();
  assert(d({ postTimes: [NOW - 100], foundedAt: NOW, now: null }) === null, 'no now → null');
});

test('T8: weekly count excludes posts older than a week', () => {
  const d = loadDescribe();
  const line = d({ postTimes: [NOW - 100, NOW - 10 * DAY], foundedAt: NOW - 30 * DAY, now: NOW });
  assert(line === 'Active today · 1 post this week', `got: ${line}`);
});

// ── source-guards ──
test('T9: fetchActivityForCircles queries kind-1111 by #A and buckets per circle', () => {
  const src = read(FETCH);
  assert(/fetchActivityForCircles/.test(src), 'batched activity fetch exists');
  assert(/kinds:\s*\[\s*1111\s*\][\s\S]{0,80}?['"]#A['"]/.test(src), 'one query, kind 1111 + #A');
});

test('T10: Discover derives a line via describeActivity and the card renders it', () => {
  const disc = read(DISCOVER);
  assert(/describeActivity/.test(disc), 'Discover computes the activity line');
  assert(/fetchActivityForCircles/.test(disc), 'Discover uses the batched fetch');
  const card = read(CARD);
  assert(/activityLine/.test(card), 'CommunityCard renders an activityLine');
});

test('T11: CommunityDetail computes signs of life via describeActivity (fetch-time now)', () => {
  const src = read(DETAIL);
  assert(/describeActivity/.test(src), 'detail computes the activity line');
  assert(/fetchActivityForCircles/.test(src), 'detail fetches activity (independent of the conversation tab)');
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
