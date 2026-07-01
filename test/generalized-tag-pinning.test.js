/**
 * Story 12 (book: unified-tagging-ui) — generalized (target-typed) tag pinning.
 * ADR 0015. RED until the core registry projection + note curation exist and the
 * client export is generalized.
 *
 * Functional coverage of the pure spine (registry projection + curation) + a few
 * source-contract markers for the client generalization. Profile-pin backward
 * compat is guarded by the EXISTING pin suite staying green (see the test plan).
 */
const fs = require('fs');
const path = require('path');
const core = require('../src/lib/event-tagging/taggings');
const UI = (p) => path.resolve(__dirname, '..', 'ui/src', p);
function assert(c, m) { if (!c) throw new Error(m || 'fail'); }
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const tests = [];
const t = (n, f) => tests.push([n, f]);

// ── Registry projection ──────────────────────────────────────────────────────

t('projectionFor(profile) → kind-30000 / p', () => {
  const p = core.projectionFor('profile');
  assert(p && p.listKind === 30000 && p.elementTag === 'p', `expected {30000,p}, got ${JSON.stringify(p)}`);
});

t('projectionFor(event) → kind-30003 / e (note bookmark set)', () => {
  const p = core.projectionFor('event');
  assert(p && p.listKind === 30003 && p.elementTag === 'e', `expected {30003,e}, got ${JSON.stringify(p)}`);
});

t('projectionFor(address) → kind-30003 / a', () => {
  const p = core.projectionFor('address');
  assert(p && p.listKind === 30003 && p.elementTag === 'a', `expected {30003,a}, got ${JSON.stringify(p)}`);
});

t('projectionFor(unknown) → null', () => {
  assert(core.projectionFor('nope') == null, 'unknown target type must have no projection');
});

t('projection is registry-driven — each member owns its projections and every projected type resolves', () => {
  assert(Array.isArray(core.taggingMembers), 'taggingMembers must be an array');
  const seen = new Set();
  for (const m of core.taggingMembers) {
    assert(m.projections && typeof m.projections === 'object', `${m.name} must declare projections`);
    for (const [type, proj] of Object.entries(m.projections)) {
      seen.add(type);
      const viaHelper = core.projectionFor(type);
      assert(viaHelper && viaHelper.listKind === proj.listKind && viaHelper.elementTag === proj.elementTag,
        `projectionFor('${type}') must match member '${m.name}' projection`);
    }
  }
  assert(seen.has('profile') && seen.has('event'), 'registry must cover at least profile + event');
});

// ── Note curation ────────────────────────────────────────────────────────────

// for-tag note shape: { id, applications (count), disputes (count), createdAt }.
const NOTES = [
  { id: 'n1', applications: 3, disputes: 0, createdAt: 100 }, // net +3, oldest
  { id: 'n2', applications: 1, disputes: 1, createdAt: 300 }, // net 0  → excluded from net-endorsed
  { id: 'n3', applications: 5, disputes: 2, createdAt: 200 }, // net +3, most-applied
  { id: 'n4', applications: 0, disputes: 2, createdAt: 400 }, // net -2 → excluded from net-endorsed
];

t('curateNotes net-endorsed: only applications>disputes, recency order', () => {
  const out = core.curateNotes(NOTES, 'notes:net-endorsed').map((n) => n.id);
  // n1 (net+3 @100) and n3 (net+3 @200) qualify; recency desc → n3 before n1. n2/n4 excluded.
  assert(JSON.stringify(out) === JSON.stringify(['n3', 'n1']), `got ${JSON.stringify(out)}`);
});

t('curateNotes most-applied: all notes, by application count desc', () => {
  const out = core.curateNotes(NOTES, 'notes:most-applied').map((n) => n.id);
  // by applications desc: n3(5), n1(3), n2(1), n4(0). All included (contested kept).
  assert(JSON.stringify(out) === JSON.stringify(['n3', 'n1', 'n2', 'n4']), `got ${JSON.stringify(out)}`);
});

t('curateNotes default = net-endorsed', () => {
  const def = core.curateNotes(NOTES).map((n) => n.id);
  const explicit = core.curateNotes(NOTES, 'notes:net-endorsed').map((n) => n.id);
  assert(JSON.stringify(def) === JSON.stringify(explicit), 'default curation must equal net-endorsed');
});

t('curateNotes is a pure snapshot (no input mutation)', () => {
  const input = NOTES.map((n) => ({ ...n }));
  const before = JSON.stringify(input);
  core.curateNotes(input, 'notes:most-applied');
  assert(JSON.stringify(input) === before, 'curateNotes must not mutate its input');
});

// ── Source-contract: client generalization ───────────────────────────────────

t('publishTagPin export is target-type-aware (no blanket p-only mapping)', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  assert(/projectionFor|elementTag|nip51ElementTag/.test(s),
    'publishTagPin must derive the NIP-51 element tag from the registry projection, not hardcode p');
});

t('defaultCurationMethod provides a note curation default', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  assert(/notes:net-endorsed/.test(s), 'defaultCurationMethod must include a note curation default');
});

t('curation config carries a target-type selection (profiles/notes/both)', () => {
  const s = rd(UI('utils/publishTagPin.js'));
  assert(/targetTypes|includeProfiles|includeNotes|includeTypes/.test(s),
    'the pin/curation config must express which target types to materialize');
});

async function run() {
  console.log('\n--- generalized tag pinning tests (book: unified-tagging-ui, Story 12) ---');
  let pass = 0, fail = 0; const failures = [];
  for (const [name, fn] of tests) { try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failures.push({ name, message: e.message }); fail++; } }
  console.log(`\ngeneralized-tag-pinning: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) { run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); }); }
module.exports = { run };
