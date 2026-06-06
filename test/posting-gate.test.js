/**
 * Story #47: the composer gates on REAL roster membership for declaration
 * circles (retiring the interim `joined` flag); bespoke circles keep the flag.
 * Pure-eval of the gate decision + source-guard against drift.
 *
 * Story communities-go-live/2 (ADR-0032): when the roster source is unreachable
 * (`degraded`), declaration posting falls back to the interim gate extended to
 * the founder — `signedIn && (joined || isFounder)` — so conversation is never
 * dead during the dark window. A healthy-but-empty roster stays gated.
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
// ADR-0032: declaration circles fall back to (joined || isFounder) when the roster
// source is `degraded` (unreachable); a healthy roster ignores degraded entirely.
function canCompose({ isDeclaration, signedIn, viewer, members = [], joined = false, degraded = false, founder = null }) {
  const viewerIsMember = isDeclaration && !!viewer && members.some(m => m.pubkey === viewer);
  const isFounder = isDeclaration && !!viewer && viewer === founder;
  const rosterDegraded = isDeclaration && degraded;
  return isDeclaration
    ? (signedIn && (viewerIsMember || (rosterDegraded && (joined || isFounder))))
    : (signedIn && joined);
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

// ── Story communities-go-live/2 (ADR-0032): degraded posting fallback ──
const FOUNDER = 'f'.repeat(64);

test('T7: degraded + founder (not rostered, not joined) can post', () => {
  // The dark-window case: roster unreachable, founder not yet in an empty roster.
  assert(canCompose({ isDeclaration: true, signedIn: true, viewer: FOUNDER, members: [], degraded: true, founder: FOUNDER }), 'founder posts during an outage');
});

test('T8: degraded + joined (not member, not founder) can post', () => {
  assert(canCompose({ isDeclaration: true, signedIn: true, viewer: VIEWER, members: [], joined: true, degraded: true, founder: FOUNDER }), 'a joined viewer posts during an outage');
});

test('T9: degraded does NOT open the room to a stranger', () => {
  // Signed in, but never joined, not the founder, not in the (unreachable) roster.
  assert(!canCompose({ isDeclaration: true, signedIn: true, viewer: VIEWER, members: [], joined: false, degraded: true, founder: FOUNDER }), 'an outage does not grant posting to arbitrary signed-in users');
});

test('T10: healthy-but-empty roster stays gated (no open posting)', () => {
  // degraded:false — the fallback must NOT fire. Even a non-rostered founder is gated
  // on a healthy roster (post-Story-1 the founder auto-belongs and is rostered).
  assert(!canCompose({ isDeclaration: true, signedIn: true, viewer: FOUNDER, members: [], joined: true, degraded: false, founder: FOUNDER }), 'a reachable empty roster keeps the trust gate');
});

test('T11: recovery — flipping degraded true→false re-applies the trust gate', () => {
  const base = { isDeclaration: true, signedIn: true, viewer: FOUNDER, members: [], joined: true, founder: FOUNDER };
  assert(canCompose({ ...base, degraded: true }), 'open during the outage');
  assert(!canCompose({ ...base, degraded: false }), 'gated again once the source recovers');
});

test('T6: source guards — the gate + prompt + degraded note match this mirror', () => {
  const src = read(DETAIL);
  assert(/const viewerIsMember = isDeclaration && !!viewer && rosterState\.members\.some\(m => m\.pubkey === viewer\)/.test(src), 'viewerIsMember derived from the roster');
  // ADR-0032 gate: degraded fallback to (joined || isFounder), structure-pinned (whitespace-tolerant).
  assert(/viewer === c\.founder/.test(src), 'isFounder keys on the real founder');
  assert(/rosterState\.degraded/.test(src), 'gate consults the degraded flag');
  assert(/viewerIsMember\s*\|\|\s*\(\s*rosterDegraded\s*&&\s*\(\s*joined\s*\|\|\s*isFounder\s*\)\s*\)/.test(src), 'Option B fallback expression present');
  assert(/Members post here\. Add yourself on the People tab, or earn a vouch\./.test(src), 'declaration prompt copy present');
  assert(/\{composePrompt\}/.test(src), 'composer renders composePrompt');
  // Degraded note: scope the copy checks to the note constant itself (a whole-file
  // scan would false-match explanatory comments or unrelated error copy).
  const noteMatch = src.match(/DEGRADED_NOTE = "([^"]*)"/);
  assert(noteMatch, 'DEGRADED_NOTE constant present');
  const note = noteMatch ? noteMatch[1] : '';
  assert(/can.t reach the trust network right now/i.test(note), 'degraded note explains the unreachable trust network');
  assert(/You can still post/.test(note), 'degraded note tells the user they can still post');
  assert(!/something went wrong/i.test(note), 'degraded note has no error tone');
  assert(/\{DEGRADED_NOTE\}/.test(src), 'composer renders the degraded note');
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
