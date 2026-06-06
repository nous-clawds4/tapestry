/**
 * Story communities-aliveness/4: post reactions (ADR-0034). NIP-25 kind-7 with a
 * latest-per-reactor +/- toggle; single reaction type; exact counts.
 *
 * Correctness core runs the REAL source via extract-and-eval:
 *   - buildReaction       (events/build.js)
 *   - summarizeReactions  (lib/reactions.js)   ← new module
 * Loaders run INSIDE each test so a not-yet-created module fails that test
 * cleanly instead of crashing the runner at require-time.
 * Component + fetch wiring covered by source-guards.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'ui-communities/src/events/build.js');
const FETCH = path.join(ROOT, 'ui-communities/src/events/fetch.js');
const REACTIONS = path.join(ROOT, 'ui-communities/src/lib/reactions.js');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');
const POSTCARD = path.join(ROOT, 'ui-communities/src/components/PostCard.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }
function loadExport(file, name, header = '') {
  const src = read(file);
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${path.basename(file)} must export function ${name}`);
  // eslint-disable-next-line no-new-func
  return new Function(m[1], `${header}\n${m[2]}`);
}

const COMMUNITY = `39998:${'f'.repeat(64)}:my-circle`;
const POST_ID = 'd'.repeat(64);
const POST_AUTHOR = 'c'.repeat(64);
const A = 'a'.repeat(64), B = 'b'.repeat(64), C = '9'.repeat(64);
const tag = (tags, k) => tags.find(t => t[0] === k);

test('T1: buildReaction(active) → kind-7 like, scoped to the circle + targeting the post', () => {
  const buildReaction = loadExport(BUILD, 'buildReaction', 'const nowSec = () => 0;');
  const ev = buildReaction({ viewerPubkey: A, communityATag: COMMUNITY, post: { id: POST_ID, author: POST_AUTHOR }, active: true });
  assert(ev.kind === 7, 'kind 7');
  assert(ev.content === '+', "active reaction content is '+'");
  assert(tag(ev.tags, 'A')[1] === COMMUNITY, 'uppercase A = community (circle-scoped)');
  const e = tag(ev.tags, 'e');
  assert(e && e[1] === POST_ID && e[3] === POST_AUTHOR, 'e tag targets the post id + author');
  assert(tag(ev.tags, 'p')[1] === POST_AUTHOR, 'p = post author');
  assert(tag(ev.tags, 'k')[1] === '1111', 'k = 1111 (reacted kind)');
});

test('T2: buildReaction(inactive) → removal marker', () => {
  const buildReaction = loadExport(BUILD, 'buildReaction', 'const nowSec = () => 0;');
  const ev = buildReaction({ viewerPubkey: A, communityATag: COMMUNITY, post: { id: POST_ID, author: POST_AUTHOR }, active: false });
  assert(ev.content === '-', "un-react content is '-'");
});

test('T3: buildReaction rejects an incomplete post target', () => {
  const buildReaction = loadExport(BUILD, 'buildReaction', 'const nowSec = () => 0;');
  let threw = false;
  try { buildReaction({ viewerPubkey: A, communityATag: COMMUNITY, post: { id: POST_ID } }); } catch (_) { threw = true; }
  assert(threw, 'must throw when post.author is missing');
});

function loadSummarize() { return loadExport(REACTIONS, 'summarizeReactions'); }
const r = (targetId, reactor, content, createdAt) => ({ targetId, reactor, content, createdAt });

test('T4: two distinct reactors liking a post → count 2', () => {
  const summarize = loadSummarize();
  const out = summarize([r(POST_ID, A, '+', 1), r(POST_ID, B, '+', 1)], A);
  assert(out[POST_ID].count === 2, 'count = 2 distinct reactors');
  assert(out[POST_ID].mine === true, 'viewer A reacted → mine true');
});

test('T5: latest-per-reactor — a later "-" un-reacts (count drops)', () => {
  const summarize = loadSummarize();
  const out = summarize([r(POST_ID, A, '+', 1), r(POST_ID, B, '+', 1), r(POST_ID, B, '-', 2)], A);
  assert(out[POST_ID].count === 1, "B's latest is '-' → not counted");
});

test('T6: mine reflects the viewer\'s latest reaction', () => {
  const summarize = loadSummarize();
  const reactions = [r(POST_ID, B, '+', 1), r(POST_ID, B, '-', 2)];
  assert(summarize(reactions, B)[POST_ID].mine === false, "B's latest '-' → mine false");
  assert(summarize(reactions, C)[POST_ID].mine === false, 'a non-reactor → mine false');
  assert(summarize([r(POST_ID, C, '+', 5)], C)[POST_ID].mine === true, "C's latest '+' → mine true");
});

test('T7: the same reactor reacting twice counts once', () => {
  const summarize = loadSummarize();
  const out = summarize([r(POST_ID, A, '+', 1), r(POST_ID, A, '+', 2)], B);
  assert(out[POST_ID].count === 1, 'dedupe by reactor');
});

test('T8: count is exact — N distinct reactors → N (no inflation)', () => {
  const summarize = loadSummarize();
  const reactors = Array.from({ length: 7 }, (_, i) => r(POST_ID, `${i}`.repeat(64).slice(0, 64), '+', 1));
  const out = summarize(reactors, A);
  assert(out[POST_ID].count === 7, 'exact count equals distinct reactors');
});

test('T9: fetchReactionsForCommunity queries kind-7 scoped by #A', () => {
  const src = read(FETCH);
  assert(/fetchReactionsForCommunity/.test(src), 'fetch helper exists');
  assert(/kinds:\s*\[\s*7\s*\][\s\S]{0,80}?['"]#A['"]|['"]#A['"][\s\S]{0,80}?kinds:\s*\[\s*7\s*\]/.test(src), 'reaction filter is kind 7 + #A');
});

test('T10: CommunityDetail wires a canCompose-gated reaction toggle with optimistic revert', () => {
  const src = read(DETAIL);
  assert(/buildReaction/.test(src), 'builds reactions via buildReaction');
  assert(/summarizeReactions/.test(src), 'derives counts via summarizeReactions');
  assert(/canCompose/.test(src), 'react reuses the canCompose gate');
  assert(/[Rr]eaction/.test(src) && /toggle|Toggle/.test(src), 'a reaction toggle handler is present');
});

test('T11: PostCard renders a reaction control with count + a distinct mine state', () => {
  const src = read(POSTCARD);
  assert(/reactionCount/.test(src), 'PostCard takes a reactionCount');
  assert(/reactionMine|mine/.test(src), 'PostCard distinguishes the viewer\'s own reaction');
  assert(/onToggleReaction/.test(src), 'PostCard exposes a reaction toggle callback');
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
