/**
 * Story #44: per-viewer roster engine (deriveRoster). Pure-function eval.
 * See engineering-team/stories/communities-membership/44-per-pov-roster-engine.md
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MOD = path.join(ROOT, 'ui-communities/src/lib/membership.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

function loadDerive() {
  const src = read(MOD);
  const m = src.match(/export\s+function\s+deriveRoster\s*\(([^)]*)\)\s*\{([\s\S]*?)^\}/m);
  if (!m) throw new Error('membership.js must export `function deriveRoster(...) { ... }`');
  // deriveRoster now delegates the gate to isMember (same module); inject it
  // (the gate itself is covered directly by roster-client T2/T3).
  const prelude = 'function isMember(a,d,t){t=t==null?1:t;return a>=t&&a>d}\n';
  // eslint-disable-next-line no-new-func
  return new Function(m[1], prelude + m[2]);
}

const CIRCLE = { claims: ['39999:founder:circle'] };
const HI = 'asserter-trusted';
const LO = 'asserter-untrusted';
// viewer trusts HI (0.9), barely trusts LO (0.1); cutoff 0.5.
const wot = a => (a === HI ? 0.9 : 0.1);

test('T1: exports deriveRoster', () => {
  assert(/export\s+function\s+deriveRoster\b/.test(read(MOD)), 'must export deriveRoster');
});

test('T2: a trusted apply at/above threshold makes a member', () => {
  const derive = loadDerive();
  const tags = [{ asserter: HI, target: 'carol', concept: '39999:founder:circle', polarity: 1 }];
  const { members } = derive(CIRCLE, tags, wot, { cutoff: 0.5, threshold: 1 });
  const carol = members.find(m => m.pubkey === 'carol');
  assert(carol, 'carol should be a member');
  assert(carol.applications === 1 && carol.disputes === 0, 'roster row carries counts, not a score');
});

test('T3: a self-apply below threshold is an applicant, not a member', () => {
  const derive = loadDerive();
  const tags = [{ asserter: 'dave', target: 'dave', concept: '39999:founder:circle', polarity: 1 }];
  // dave self-applies; viewer barely trusts dave (0.1 < cutoff) → 0 trusted apps.
  const w = a => (a === 'dave' ? 0.1 : 0.9);
  const { members, applicants } = derive(CIRCLE, tags, w, { cutoff: 0.5, threshold: 1 });
  assert(!members.some(m => m.pubkey === 'dave'), 'dave should not be a member (no trusted apps)');
  assert(applicants.some(m => m.pubkey === 'dave'), 'dave should be an applicant (self-applied, below threshold)');
});

test('T4: an untrusted disputer is uncounted — no veto', () => {
  const derive = loadDerive();
  const tags = [
    { asserter: HI, target: 'carol', concept: '39999:founder:circle', polarity: 1 },   // trusted apply
    { asserter: LO, target: 'carol', concept: '39999:founder:circle', polarity: -1 },  // untrusted dispute
  ];
  const { members } = derive(CIRCLE, tags, wot, { cutoff: 0.5, threshold: 1 });
  const carol = members.find(m => m.pubkey === 'carol');
  assert(carol, 'untrusted dispute must not veto a trusted apply');
  assert(carol.disputes === 0, 'the untrusted dispute is not counted');
});

test('T5: only tags for a CLAIMED concept count', () => {
  const derive = loadDerive();
  const tags = [{ asserter: HI, target: 'carol', concept: '39999:other:thing', polarity: 1 }];
  const { members, applicants } = derive(CIRCLE, tags, wot, { cutoff: 0.5, threshold: 1 });
  assert(members.length === 0 && applicants.length === 0, 'tags for unclaimed concepts must be ignored');
});

test('T6: threshold is an integer count (N≥2 needs two trusted applies)', () => {
  const derive = loadDerive();
  const oneApply = [{ asserter: HI, target: 'carol', concept: '39999:founder:circle', polarity: 1 }];
  const r1 = derive(CIRCLE, oneApply, () => 0.9, { cutoff: 0.5, threshold: 2 });
  assert(!r1.members.some(m => m.pubkey === 'carol'), 'one apply is below a threshold of 2');
  const twoApply = [
    { asserter: 'a1', target: 'carol', concept: '39999:founder:circle', polarity: 1 },
    { asserter: 'a2', target: 'carol', concept: '39999:founder:circle', polarity: 1 },
  ];
  const r2 = derive(CIRCLE, twoApply, () => 0.9, { cutoff: 0.5, threshold: 2 });
  assert(r2.members.some(m => m.pubkey === 'carol'), 'two applies clear a threshold of 2');
});

test('T7: a duplicate apply from the same asserter counts once (no stacking)', () => {
  const derive = loadDerive();
  const dup = [
    { asserter: HI, target: 'carol', concept: '39999:founder:circle', polarity: 1 },
    { asserter: HI, target: 'carol', concept: '39999:founder:circle', polarity: 1 }, // accidental re-apply
  ];
  // If it stacked, applications would be 2 ≥ 2; deduped it's 1 < 2.
  const r = derive(CIRCLE, dup, () => 0.9, { cutoff: 0.5, threshold: 2 });
  assert(!r.members.some(m => m.pubkey === 'carol'), 'a re-apply must supersede, not stack');
  const r1 = derive(CIRCLE, dup, () => 0.9, { cutoff: 0.5, threshold: 1 });
  assert(r1.members.find(m => m.pubkey === 'carol').applications === 1, 'counted once');
});

test('T8: an absent polarity is an apply, never a silent dispute', () => {
  const derive = loadDerive();
  const tags = [{ asserter: HI, target: 'carol', concept: '39999:founder:circle' }]; // no polarity
  const { members } = derive(CIRCLE, tags, () => 0.9, { cutoff: 0.5, threshold: 1 });
  const carol = members.find(m => m.pubkey === 'carol');
  assert(carol && carol.applications === 1 && carol.disputes === 0, 'no polarity should count as an apply');
});

test('T9: membership is two-part — applications > disputes is required', () => {
  const derive = loadDerive();
  // 2 trusted applies, 2 trusted disputes, threshold 1: 2≥1 but NOT 2>2 → not a member.
  const tied = [
    { asserter: 'a1', target: 'carol', concept: '39999:founder:circle', polarity: 1 },
    { asserter: 'a2', target: 'carol', concept: '39999:founder:circle', polarity: 1 },
    { asserter: 'd1', target: 'carol', concept: '39999:founder:circle', polarity: -1 },
    { asserter: 'd2', target: 'carol', concept: '39999:founder:circle', polarity: -1 },
  ];
  const rTied = derive(CIRCLE, tied, () => 0.9, { cutoff: 0.5, threshold: 1 });
  assert(!rTied.members.some(m => m.pubkey === 'carol'), 'tied apps==disputes must not be a member');
});

test('T10: two-part gate is NOT net-difference (apps=3,disputes=2,threshold=2 → member)', () => {
  const derive = loadDerive();
  const tags = [
    { asserter: 'a1', target: 'carol', concept: '39999:founder:circle', polarity: 1 },
    { asserter: 'a2', target: 'carol', concept: '39999:founder:circle', polarity: 1 },
    { asserter: 'a3', target: 'carol', concept: '39999:founder:circle', polarity: 1 },
    { asserter: 'd1', target: 'carol', concept: '39999:founder:circle', polarity: -1 },
    { asserter: 'd2', target: 'carol', concept: '39999:founder:circle', polarity: -1 },
  ];
  // ours: 3≥2 AND 3>2 → member. net-difference (3−2=1 ≥ 2) → would reject.
  const r = derive(CIRCLE, tags, () => 0.9, { cutoff: 0.5, threshold: 2 });
  assert(r.members.some(m => m.pubkey === 'carol'), 'two-part gate admits where net-difference would not');
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
