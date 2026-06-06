/**
 * Story communities-aliveness/3: one-level reply threading on NIP-22 kind-1111
 * community posts (ADR-0033, Option A — replies always parent the top-level post).
 *
 * Strong layers run the REAL source via extract-and-eval (cf. membership-assertion):
 *   - buildCommunityPost (events/build.js)   → reply tag shape
 *   - projectRealEvent   (events/fetch.js)   → parentId reaches the client
 * Component wiring is covered by source-guards over CommunityDetail.jsx.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'ui-communities/src/events/build.js');
const FETCH = path.join(ROOT, 'ui-communities/src/events/fetch.js');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

// Extract `export function NAME(args){…}` and run it standalone, injecting the
// module helpers its body relies on. Mirrors the loader in membership-assertion.test.js.
function loadExport(file, name, header = '') {
  const src = read(file);
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${path.basename(file)} must export function ${name}`);
  // eslint-disable-next-line no-new-func
  return new Function(m[1], `${header}\n${m[2]}`);
}
// Same, for a non-exported top-level `function NAME(args){…}`.
function loadLocalFn(file, name, header = '') {
  const src = read(file);
  const re = new RegExp(`(?:^|\\n)function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${path.basename(file)} must define function ${name}`);
  // eslint-disable-next-line no-new-func
  return new Function(m[1], `${header}\n${m[2]}`);
}

const FOUNDER = 'f'.repeat(64);
const VIEWER = 'a'.repeat(64);
const PARENT_ID = 'e'.repeat(64);
const PARENT_AUTHOR = 'b'.repeat(64);
const ATAG = `39998:${FOUNDER}:my-circle`;

const buildCommunityPost = loadExport(BUILD, 'buildCommunityPost', 'const nowSec = () => 0;');
const tag = (tags, k) => tags.find(t => t[0] === k);

test('T1: top-level post (no parent) keeps the community as root AND parent', () => {
  const ev = buildCommunityPost({ viewerPubkey: VIEWER, communityATag: ATAG, content: 'hi' });
  assert(ev.kind === 1111, 'kind 1111');
  assert(tag(ev.tags, 'A')[1] === ATAG, 'uppercase A = community root');
  assert(tag(ev.tags, 'a')[1] === ATAG, 'lowercase a = community (parent = root for top-level)');
  assert(!tag(ev.tags, 'e'), 'no lowercase e on a top-level post');
});

test('T2: a reply keeps the community root but points its lowercase parent at the post', () => {
  const ev = buildCommunityPost({
    viewerPubkey: VIEWER, communityATag: ATAG, content: 'good point',
    parent: { id: PARENT_ID, author: PARENT_AUTHOR },
  });
  // Root reference unchanged → stays in the same conversation, scoped to the circle.
  assert(tag(ev.tags, 'A')[1] === ATAG, 'uppercase A root preserved on a reply');
  assert(tag(ev.tags, 'K')[1] === '39998', 'uppercase K root-kind preserved');
  // Lowercase parent now points at the parent comment, not the community.
  const e = tag(ev.tags, 'e');
  assert(e && e[1] === PARENT_ID && e[3] === PARENT_AUTHOR, "lowercase e = parent post id + author");
  assert(tag(ev.tags, 'k')[1] === '1111', 'lowercase k = 1111 (parent is a comment)');
  assert(tag(ev.tags, 'p')[1] === PARENT_AUTHOR, 'lowercase p = parent author');
  assert(!tag(ev.tags, 'a'), 'no lowercase a on a reply (parent is the comment, not the community)');
});

test('T3: a reply with an incomplete parent is rejected', () => {
  let threw = false;
  try { buildCommunityPost({ viewerPubkey: VIEWER, communityATag: ATAG, content: 'x', parent: { id: PARENT_ID } }); }
  catch (_) { threw = true; }
  assert(threw, 'buildCommunityPost must throw when parent.author is missing');
});

const projectRealEvent = loadLocalFn(FETCH, 'projectRealEvent');

test('T4: projectRealEvent on a top-level event → parentId null', () => {
  const out = projectRealEvent({ id: 'x', pubkey: VIEWER, content: 'hi', created_at: 5, tags: [['A', ATAG], ['a', ATAG]] });
  assert(out.parentId === null, 'top-level event has null parentId');
});

test('T5: projectRealEvent on a reply → parentId set, other fields intact', () => {
  const out = projectRealEvent({
    id: 'r1', pubkey: VIEWER, content: 'reply body', created_at: 9,
    tags: [['A', ATAG], ['e', PARENT_ID, '', PARENT_AUTHOR], ['k', '1111'], ['p', PARENT_AUTHOR]],
  });
  assert(out.parentId === PARENT_ID, 'reply event carries its parentId');
  assert(out.author === VIEWER && out.content === 'reply body' && out.createdAt === 9, 'author/content/createdAt still projected');
});

// ── Component source-guards (CommunityDetail.jsx) ──
test('T6: posts are grouped by parentId for one-level nesting', () => {
  const src = read(DETAIL);
  assert(/parentId/.test(src), 'CommunityDetail consumes the projected parentId for threading');
});

test('T7: a reply is sent by passing a parent object to the post builder', () => {
  const src = read(DETAIL);
  // A reply parent object is constructed (accept `parent: { … }` or `parent = { … }`),
  // built from the reply target's author. Scoped to the object form, not the bare
  // token "parent" which already appears for community.parent/resolveDefinition.
  assert(/parent\s*[:=]\s*\{[\s\S]{0,80}?author/.test(src), 'a reply parent object (with author) is constructed');
  assert(/buildCommunityPost/.test(src), 'still builds via buildCommunityPost');
});

test('T8: signed-out viewers get a "Sign in to reply" prompt', () => {
  const src = read(DETAIL);
  assert(/Sign in to reply/.test(src), 'a sign-in-to-reply prompt exists');
});

test('T9: replies render at one indented level (the reply nesting class)', () => {
  const src = read(DETAIL);
  // ADR-0033: replies render one level deep via a dedicated nesting class.
  assert(/s\.reply\b/.test(src), 'replies render with the one-level reply nesting class (s.reply)');
});

test('T10: replies reuse the post component/fields and the canCompose gate', () => {
  const src = read(DETAIL);
  assert(/PostCard/.test(src), 'replies render via the same PostCard');
  assert(/canCompose/.test(src), 'who-may-reply reuses the canCompose gate (no new gate)');
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
