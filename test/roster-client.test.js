/**
 * Story #45 (data layer): live roster client (lib/roster.js).
 * Pure helpers eval'd directly; getRoster eval'd with injected network seams.
 * See ADR 0031 (topology) + ADR 0030 (two-part gate).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MOD = path.join(ROOT, 'ui-communities/src/lib/roster.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

// Extract one exported function body and run it standalone. `isMember` (imported
// from membership.js in the real module) is injected here so the pure helpers
// and getRoster run without the ESM import graph.
function loadExport(name, { async: isAsync = false } = {}) {
  const src = read(MOD);
  const kw = isAsync ? 'export\\s+async\\s+function' : 'export\\s+function';
  const re = new RegExp(`${kw}\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`roster.js must export ${isAsync ? 'async ' : ''}function ${name}`);
  // Inject USE_MOCK=false + the helpers getRoster depends on (isMember from
  // membership.js; mergeRows/rosterFromCounts are sibling exports). These are
  // reference impls so getRoster's ORCHESTRATION can run standalone — the
  // helpers' own correctness is covered against source by T1-T5.
  const prelude = `
    const USE_MOCK = false;
    function isMember(a, d, t) { t = t == null ? 1 : t; return a >= t && a > d; }
    function mergeRows(sets) {
      const m = new Map();
      for (const rows of sets || []) for (const r of rows || []) {
        if (!r || !r.pubkey) continue;
        const e = m.get(r.pubkey) || { pubkey: r.pubkey, applications: 0, disputes: 0, displayName: null, picture: null, nip05: null };
        e.applications += r.applications || 0; e.disputes += r.disputes || 0;
        e.displayName = e.displayName || r.displayName || null;
        m.set(r.pubkey, e);
      }
      return Array.from(m.values());
    }
    function rosterFromCounts(rows, o) {
      o = o || {};
      const members = (rows || []).filter(r => isMember(r.applications || 0, r.disputes || 0, o.threshold));
      members.sort((a, b) => (b.applications - a.applications) || (a.disputes - b.disputes) || String(a.pubkey).localeCompare(String(b.pubkey)));
      return { members };
    }
  `;
  const Ctor = isAsync ? Object.getPrototypeOf(async function () {}).constructor : Function;
  // eslint-disable-next-line no-new-func
  return new Ctor(m[1], prelude + m[2]);
}

test('T1: parseClaimCoord parses a 39999 tag-element coord, rejects junk', () => {
  const parse = loadExport('parseClaimCoord');
  const ok = parse(`39999:${'a'.repeat(64)}:climbers`);
  assert(ok && ok.author === 'a'.repeat(64) && ok.slug === 'climbers', 'parses author + slug');
  assert(parse('39998:x:y') === null, 'rejects a non-39999 / malformed coord');
  assert(parse(null) === null, 'rejects non-string');
});

test('T2: rosterFromCounts applies the two-part gate (apps≥threshold AND apps>disputes)', () => {
  const rosterFromCounts = loadExport('rosterFromCounts');
  const rows = [
    { pubkey: 'p1', applications: 2, disputes: 0 }, // member
    { pubkey: 'p2', applications: 2, disputes: 2 }, // tied → NOT a member
    { pubkey: 'p3', applications: 0, disputes: 0 }, // none → NOT a member
  ];
  const { members } = rosterFromCounts(rows, { threshold: 1 });
  const ids = members.map(m => m.pubkey);
  assert(ids.includes('p1'), 'p1 is a member');
  assert(!ids.includes('p2'), 'tied apps==disputes is not a member');
  assert(!ids.includes('p3'), 'zero apps is not a member');
});

test('T3: rosterFromCounts honors an integer threshold (N≥2)', () => {
  const rosterFromCounts = loadExport('rosterFromCounts');
  const rows = [{ pubkey: 'p1', applications: 1, disputes: 0 }];
  assert(rosterFromCounts(rows, { threshold: 2 }).members.length === 0, 'one apply below threshold 2');
  assert(rosterFromCounts(rows, { threshold: 1 }).members.length === 1, 'one apply meets threshold 1');
});

test('T4: rosterFromCounts sorts members by applications desc', () => {
  const rosterFromCounts = loadExport('rosterFromCounts');
  const rows = [
    { pubkey: 'low', applications: 1, disputes: 0 },
    { pubkey: 'high', applications: 5, disputes: 0 },
  ];
  const { members } = rosterFromCounts(rows, { threshold: 1 });
  assert(members[0].pubkey === 'high', 'highest applications first');
});

test('T5: mergeRows unions a target across claimed tags (sums counts)', () => {
  const mergeRows = loadExport('mergeRows');
  const merged = mergeRows([
    [{ pubkey: 'p1', applications: 1, disputes: 0, displayName: 'Pat', picture: 'pic', nip05: 'pat@x' }],
    [{ pubkey: 'p1', applications: 2, disputes: 1, displayName: 'IGNORED' }, { pubkey: 'p2', applications: 1, disputes: 0 }],
  ]);
  const p1 = merged.find(r => r.pubkey === 'p1');
  assert(p1.applications === 3 && p1.disputes === 1, 'counts summed across tags');
  assert(p1.displayName === 'Pat' && p1.picture === 'pic' && p1.nip05 === 'pat@x',
    'displayName/picture/nip05 carried from the first non-empty row, not overwritten');
  assert(merged.length === 2, 'p2 also present');
});

test('T6: getRoster resolves claims → counts → gated members (injected seams)', async () => {
  const getRoster = loadExport('getRoster', { async: true });
  const circle = { claims: [`39999:${'a'.repeat(64)}:climbers`], membershipThreshold: 1 };
  const resolveEventId = async () => 'e'.repeat(64);
  const fetchCounts = async () => ({
    rows: [
      { pubkey: 'm1', applications: 3, disputes: 1 }, // member
      { pubkey: 'x1', applications: 1, disputes: 1 }, // tied → not
    ],
    viewerAssertions: { m1: 'applied' },
  });
  const { members, viewerAssertions } = await getRoster(circle, { resolveEventId, fetchCounts });
  assert(members.length === 1 && members[0].pubkey === 'm1', 'only the gated member surfaces');
  assert(viewerAssertions.m1 === 'applied', 'viewer assertions are merged through');
});

test('T7: getRoster skips a claim whose coord cannot be resolved', async () => {
  const getRoster = loadExport('getRoster', { async: true });
  const circle = { claims: ['39999:bad', `39999:${'a'.repeat(64)}:ok`] };
  let counted = 0;
  const resolveEventId = async (coord) => (coord.endsWith(':ok') ? 'e'.repeat(64) : null);
  const fetchCounts = async () => { counted++; return { rows: [{ pubkey: 'm1', applications: 2, disputes: 0 }], viewerAssertions: {} }; };
  const { members } = await getRoster(circle, { resolveEventId, fetchCounts, threshold: 1 });
  assert(counted === 1, 'only the resolvable claim is fetched');
  assert(members.length === 1, 'member derived from the resolvable claim');
});

test('T8: getRoster threshold falls back to circle.membershipThreshold', async () => {
  const getRoster = loadExport('getRoster', { async: true });
  const circle = { claims: [`39999:${'a'.repeat(64)}:c`], membershipThreshold: 2 };
  const resolveEventId = async () => 'e'.repeat(64);
  const fetchCounts = async () => ({ rows: [{ pubkey: 'm1', applications: 1, disputes: 0 }], viewerAssertions: {} });
  const { members } = await getRoster(circle, { resolveEventId, fetchCounts });
  assert(members.length === 0, 'one apply is below the circle threshold of 2');
});

test('T9: getRoster unions a shared target across two resolved claims', async () => {
  const getRoster = loadExport('getRoster', { async: true });
  const A = 'a'.repeat(64), B = 'b'.repeat(64);
  const circle = { claims: [`39999:${A}:t1`, `39999:${B}:t2`] };
  const resolveEventId = async (coord) => (coord.endsWith(':t1') ? '1'.repeat(64) : '2'.repeat(64));
  // Each claimed tag contributes one application for the same person.
  const fetchCounts = async () => ({ rows: [{ pubkey: 'shared', applications: 1, disputes: 0 }], viewerAssertions: {} });
  const { members } = await getRoster(circle, { resolveEventId, fetchCounts, threshold: 2 });
  assert(members.length === 1 && members[0].pubkey === 'shared' && members[0].applications === 2,
    'applications sum across both claimed tags through getRoster (1+1 ≥ threshold 2)');
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
