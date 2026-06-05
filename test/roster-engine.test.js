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
  // eslint-disable-next-line no-new-func
  return new Function(m[1], m[2]);
}

const CIRCLE = { claims: ['39998:founder:circle'] };
const HI = 'asserter-trusted';
const LO = 'asserter-untrusted';
// viewer trusts HI (0.9), barely trusts LO (0.1); cutoff 0.5.
const wot = a => (a === HI ? 0.9 : 0.1);

test('T1: exports deriveRoster', () => {
  assert(/export\s+function\s+deriveRoster\b/.test(read(MOD)), 'must export deriveRoster');
});

test('T2: a trusted +1 vouch above threshold makes a member', () => {
  const derive = loadDerive();
  const tags = [{ asserter: HI, target: 'carol', concept: '39998:founder:circle', polarity: 1 }];
  const { members } = derive(CIRCLE, tags, wot, { cutoff: 0.5, threshold: 0.5 });
  assert(members.some(m => m.pubkey === 'carol'), 'carol should be a member');
});

test('T3: a self-tag below threshold is an applicant, not a member', () => {
  const derive = loadDerive();
  const tags = [{ asserter: 'dave', target: 'dave', concept: '39998:founder:circle', polarity: 1 }];
  // dave self-tags; viewer barely trusts dave (0.1 < cutoff) so score ~0 < threshold.
  const w = a => (a === 'dave' ? 0.1 : 0.9);
  const { members, applicants } = derive(CIRCLE, tags, w, { cutoff: 0.5, threshold: 0.5 });
  assert(!members.some(m => m.pubkey === 'dave'), 'dave should not be a member');
  assert(applicants.some(m => m.pubkey === 'dave'), 'dave should be an applicant (self-tagged, below threshold)');
});

test('T4: an untrusted asserter is weightless — no veto', () => {
  const derive = loadDerive();
  const tags = [
    { asserter: HI, target: 'carol', concept: '39998:founder:circle', polarity: 1 },   // trusted +1
    { asserter: LO, target: 'carol', concept: '39998:founder:circle', polarity: -1 },  // untrusted -1
  ];
  const { members } = derive(CIRCLE, tags, wot, { cutoff: 0.5, threshold: 0.5 });
  assert(members.some(m => m.pubkey === 'carol'), 'untrusted -1 must not veto a trusted +1');
});

test('T5: only tags for a CLAIMED concept count', () => {
  const derive = loadDerive();
  const tags = [{ asserter: HI, target: 'carol', concept: '39998:other:thing', polarity: 1 }];
  const { members, applicants } = derive(CIRCLE, tags, wot, { cutoff: 0.5, threshold: 0.5 });
  assert(members.length === 0 && applicants.length === 0, 'tags for unclaimed concepts must be ignored');
});

test('T6: threshold is respected (N≥2 needs two trusted vouches)', () => {
  const derive = loadDerive();
  const oneVouch = [{ asserter: HI, target: 'carol', concept: '39998:founder:circle', polarity: 1 }];
  const r1 = derive(CIRCLE, oneVouch, () => 0.9, { cutoff: 0.5, threshold: 1.5 });
  assert(!r1.members.some(m => m.pubkey === 'carol'), 'one 0.9 vouch is below a 1.5 threshold');
  const twoVouch = [
    { asserter: 'a1', target: 'carol', concept: '39998:founder:circle', polarity: 1 },
    { asserter: 'a2', target: 'carol', concept: '39998:founder:circle', polarity: 1 },
  ];
  const r2 = derive(CIRCLE, twoVouch, () => 0.9, { cutoff: 0.5, threshold: 1.5 });
  assert(r2.members.some(m => m.pubkey === 'carol'), 'two 0.9 vouches clear a 1.5 threshold');
});

test('T7: a duplicate vouch from the same asserter counts once (no stacking)', () => {
  const derive = loadDerive();
  const dup = [
    { asserter: HI, target: 'carol', concept: '39998:founder:circle', polarity: 1 },
    { asserter: HI, target: 'carol', concept: '39998:founder:circle', polarity: 1 }, // accidental re-vouch
  ];
  // If it stacked, score would be 1.8 ≥ 1.5; deduped it's 0.9 < 1.5.
  const { members } = derive(CIRCLE, dup, () => 0.9, { cutoff: 0.5, threshold: 1.5 });
  assert(!members.some(m => m.pubkey === 'carol'), 'a re-vouch must supersede, not stack');
});

test('T8: an absent polarity is a vouch (+1), never a silent downvote', () => {
  const derive = loadDerive();
  const tags = [{ asserter: HI, target: 'carol', concept: '39998:founder:circle' }]; // no polarity
  const { members } = derive(CIRCLE, tags, () => 0.9, { cutoff: 0.5, threshold: 0.5 });
  assert(members.some(m => m.pubkey === 'carol'), 'a tag with no polarity should count as a vouch');
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
