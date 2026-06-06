/**
 * Story #47: the composer gates on REAL roster membership for declaration
 * circles (retiring the interim `joined` flag); bespoke circles keep the flag.
 * Pure-eval of the gate decision + source-guard against drift.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

// Mirrors the gate in CommunityDetail.jsx (kept in sync via the source asserts below).
function canCompose({ isDeclaration, signedIn, viewer, members = [], joined = false }) {
  const viewerIsMember = isDeclaration && !!viewer && members.some(m => m.pubkey === viewer);
  return isDeclaration ? (signedIn && viewerIsMember) : (signedIn && joined);
}
function composePrompt({ signedIn, isDeclaration }) {
  return !signedIn ? 'Sign in to post.'
    : isDeclaration ? 'Members post here. Add yourself on the People tab, or earn a vouch.'
      : 'Join this circle to post.';
}

const VIEWER = 'a'.repeat(64);

test('T1: a declaration member can compose; a non-member cannot', () => {
  assert(canCompose({ isDeclaration: true, signedIn: true, viewer: VIEWER, members: [{ pubkey: VIEWER }] }), 'member can post');
  assert(!canCompose({ isDeclaration: true, signedIn: true, viewer: VIEWER, members: [{ pubkey: 'other' }] }), 'non-member cannot post');
});

test('T2: declaration posting ignores the interim joined flag', () => {
  // joined=true but NOT a member → still cannot post (gate is roster, not flag).
  assert(!canCompose({ isDeclaration: true, signedIn: true, viewer: VIEWER, members: [], joined: true }), 'joined flag does not grant posting on declaration circles');
});

test('T3: bespoke circles keep the joined-flag gate', () => {
  assert(canCompose({ isDeclaration: false, signedIn: true, joined: true }), 'bespoke joined can post');
  assert(!canCompose({ isDeclaration: false, signedIn: true, joined: false }), 'bespoke not-joined cannot post');
});

test('T4: signed-out never composes', () => {
  assert(!canCompose({ isDeclaration: true, signedIn: false, viewer: VIEWER, members: [{ pubkey: VIEWER }] }), 'declaration signed-out cannot post');
  assert(!canCompose({ isDeclaration: false, signedIn: false, joined: true }), 'bespoke signed-out cannot post');
});

test('T5: the prompt points at the membership path (peer-framed, no approve/admit)', () => {
  assert(composePrompt({ signedIn: false, isDeclaration: true }) === 'Sign in to post.', 'signed-out → sign in');
  const p = composePrompt({ signedIn: true, isDeclaration: true });
  assert(/People tab/.test(p) && /vouch/.test(p), 'declaration non-member → membership path');
  assert(!/approve|admit/i.test(p), 'no approve/admit language');
  assert(composePrompt({ signedIn: true, isDeclaration: false }) === 'Join this circle to post.', 'bespoke keeps its prompt');
});

test('T6: source guards — the gate + prompt match this mirror', () => {
  const src = read(DETAIL);
  assert(/const viewerIsMember = isDeclaration && !!viewer && rosterState\.members\.some\(m => m\.pubkey === viewer\)/.test(src), 'viewerIsMember derived from the roster');
  assert(/const canCompose = isDeclaration \? \(signedIn && viewerIsMember\) : \(signedIn && joined\)/.test(src), 'gate matches');
  assert(/Members post here\. Add yourself on the People tab, or earn a vouch\./.test(src), 'declaration prompt copy present');
  assert(/\{composePrompt\}/.test(src), 'composer renders composePrompt');
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
