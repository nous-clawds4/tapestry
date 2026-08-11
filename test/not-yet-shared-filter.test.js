/**
 * Story 3 (epic: shared-concepts-seeding) — find, in bulk, which of my concepts
 * I haven't shared.
 *
 * Story: engineering-team/stories/shared-concepts-seeding/3-disposition-filter-on-concepts.md
 * ADR:   engineering-team/decisions/shared-concepts-seeding/0001-not-yet-shared-filter-joins-the-bulk-sharing-answer.md
 *
 * The whole risk in this story is a filter that LOOKS right and answers a
 * different question. A concept can carry a self-declaration locally and be on
 * no public relay — `selfDeclared === true` with `published === false` — which
 * is the failure seeding #1 exists to report, not an edge case. A filter built
 * on the row's disposition chip reports that concept as shared, contradicting
 * the Shared by me page about the same concept.
 *
 * So the U-class below is built around the cases that DISTINGUISH the correct
 * predicate from the plausible-but-wrong one. U1 is the discriminating test: it
 * passes only for an implementation that consults publication, and fails for
 * every implementation that reads the chip.
 *
 * Three test classes:
 *
 *   U-class (pure, stack-free, always gates) — drives the extracted predicate
 *     directly over fabricated rows. `ui/src/utils/conceptStateFilter.js` must
 *     be dependency-free (no React, no fetch) so it loads under plain node via
 *     dynamic import — the ui/ package is `"type": "module"`, and this is the
 *     loadEsm idiom of test/firmware-concept-elements-sets.test.js:58-66
 *     (ADR firmware-explorer/0001's "pure core" split).
 *
 *   S-class (source assertions, stack-free) — the structural rules ADR 0001
 *     turns on: the page must not re-derive the sharing rule, the control must
 *     be one selector rather than two look-alike checkboxes, and the
 *     shared-by-me fetch must not fail silently the way the health fetch does.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — pins the two
 *     load-bearing facts the design assumes about /api/shared-by-me: its
 *     response shape, and that its `coord` really is the concept-header `uuid`
 *     the page would join on.
 *
 * ALL U and S tests FAIL until the feature lands — ui/src/utils/conceptStateFilter.js
 * does not exist and the coverage control is still a checkbox. That is the point.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const FILTER_UTIL_JS = path.join(ROOT, 'ui/src/utils/conceptStateFilter.js');
const CONCEPT_LIST_JSX = path.join(ROOT, 'ui/src/pages/concepts/ConceptList.jsx');

const HOST_BASE = process.env.BRAINSTORM_BASE_URL || `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function short(x, n = 220) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : (s.length > n ? `${s.slice(0, n)}…` : s);
}

const UTIL_MISSING =
  'ui/src/utils/conceptStateFilter.js does not exist yet — the pure state predicate ' +
  '(ADR shared-concepts-seeding/0001, Implementation notes) is not implemented. It must be ' +
  'dependency-free so it can be exercised without a browser.';

async function loadFilterUtil() {
  if (!fs.existsSync(FILTER_UTIL_JS)) throw new Error(UTIL_MISSING);
  try {
    return await import(pathToFileURL(FILTER_UTIL_JS).href);
  } catch (e) {
    throw new Error(
      `ui/src/utils/conceptStateFilter.js exists but failed to import as ESM: ${e.message}. ` +
      'It must import nothing from the app (no React, no hooks) — the predicate is pure data in, ' +
      'boolean out.');
  }
}

/* ── Fixtures: rows shaped like ConceptList's enrichedData entries ───────── */

const TA = 'aa'.repeat(32);
const OTHER = 'bb'.repeat(32);
const coord = (slug, pk = TA) => `39998:${pk}:${slug}`;

const disp = (o = {}) => ({ wired: false, selfDeclared: false, deferred: false, ...o });

// The six rows that matter, one per distinguishable situation.
const ROWS = {
  // never declared, mine → the plain work-list case
  undispositioned: { uuid: coord('undecided'), name: 'undecided', author: TA, _disp: disp() },
  // declared AND on the relay → done, must never appear in the work-list
  shared: { uuid: coord('dog'), name: 'dog', author: TA, _disp: disp({ selfDeclared: true }) },
  // declared but NOT on the relay → a failure to retry (seeding #1). THE case.
  declaredUnpublished: { uuid: coord('b-cov'), name: 'b-coverage fixture', author: TA, _disp: disp({ selfDeclared: true }) },
  // ratified exclusions
  wired: { uuid: coord('adopted'), name: 'adopted', author: TA, _disp: disp({ wired: true }) },
  private: { uuid: coord('secret'), name: 'secret', author: TA, _disp: disp({ deferred: true }) },
  // someone else's concept → never "mine"
  foreign: { uuid: coord('theirs', OTHER), name: 'theirs', author: OTHER, _disp: disp() },
};

const ALL_ROWS = Object.values(ROWS);

// Publication as /api/shared-by-me reports it: only DECLARED concepts appear.
const publishedByCoord = new Map([
  [ROWS.shared.uuid, true],
  [ROWS.declaredUnpublished.uuid, false],
]);

const ctx = (over = {}) => ({ taPubkey: TA, publishedByCoord, relayOk: true, ...over });

/** Names of the rows the predicate keeps, for legible failure messages. */
async function selected(state, context = ctx(), rows = ALL_ROWS) {
  const { matchesState } = await loadFilterUtil();
  assert(typeof matchesState === 'function',
    'conceptStateFilter.js must export matchesState(row, state, ctx) — the predicate the page filters with.');
  return rows.filter((r) => matchesState(r, state, context)).map((r) => r.name).sort();
}

/* ══════════ U-class — the predicate, over every distinguishable case ══════════ */

test('U1 (AC-4): a concept declared locally but absent from the relay IS in "not yet shared" — the case that separates a correct filter from one reading the chip', async () => {
  const got = await selected('not-yet-shared');
  assert(got.includes('b-coverage fixture'),
    'a concept whose local declaration exists but whose broadcast did not land MUST appear in ' +
    '"not yet shared" (AC-4). It carries selfDeclared:true, so any filter reading the disposition ' +
    'chip will wrongly call it shared and drop it — which is the exact defect seeding #1 exists to ' +
    `report. Selected instead: ${short(got)}`);
});

test('U2 (AC-2): a concept the relay confirms IS NOT in "not yet shared"', async () => {
  const got = await selected('not-yet-shared');
  assert(!got.includes('dog'),
    '"dog" is published on the community relay, so Shared by me reports it as Shared. Listing it ' +
    `under "not yet shared" would let the two pages contradict each other (AC-2). Selected: ${short(got)}`);
});

test('U3 (AC-3): when publication could not be confirmed, the concept is NOT presented as not-shared', async () => {
  // relayOk:false is how /api/shared-by-me reports "the relay could not be asked";
  // every declared concept comes back published:null.
  const nulls = new Map([[ROWS.shared.uuid, null], [ROWS.declaredUnpublished.uuid, null]]);
  const got = await selected('not-yet-shared', ctx({ relayOk: false, publishedByCoord: nulls }));
  assert(!got.includes('dog') && !got.includes('b-coverage fixture'),
    'with the relay unreachable, publication is UNKNOWN for every declared concept, and ' +
    '"null must never collapse to false" (src/lib/sharingState.js:12-15). Neither declared concept ' +
    `may be listed as not-shared (AC-3). Selected: ${short(got)}`);
  assert(got.includes('undecided'),
    'a concept that was NEVER declared is knowably not shared from the local read alone — the ' +
    'relay being unreachable does not make that unknown, so it must still be listed (ADR 0001, ' +
    `failure tier 2). Selected: ${short(got)}`);
});

test('U4 (ratified exclusions): wired and deliberately-private concepts are NOT in "not yet shared"', async () => {
  const got = await selected('not-yet-shared');
  assert(!got.includes('adopted'),
    'a wired concept points at someone else\'s shared concept — already affiliated, not a seeding ' +
    `candidate. Ratified at the Planning gate: exclude. Selected: ${short(got)}`);
  assert(!got.includes('secret'),
    'a deliberately-private concept is a decision already made; listing it makes the work-list ' +
    `noisier every time. Ratified at the Planning gate: exclude. Selected: ${short(got)}`);
});

test('U5: a concept never declared IS in "not yet shared", and another author\'s concept never is', async () => {
  const got = await selected('not-yet-shared');
  assert(got.includes('undecided'),
    `an undispositioned concept of mine is the plain work-list case. Selected: ${short(got)}`);
  assert(!got.includes('theirs'),
    `"not yet shared (mine)" is scoped to this instance's own concepts. Selected: ${short(got)}`);
});

test('U6 (AC-2, exact set): "not yet shared" is exactly {never-declared, declared-but-unpublished}', async () => {
  const got = await selected('not-yet-shared');
  const want = ['b-coverage fixture', 'undecided'].sort();
  assert(JSON.stringify(got) === JSON.stringify(want),
    `"not yet shared" must select exactly ${short(want)} over this corpus — the work-list ratified ` +
    `at Planning (undispositioned + tried-but-didn't-reach). Got ${short(got)}.`);
});

test('U7 (AC-5): "not yet shared" and "undispositioned" select DIFFERENT sets — they are not synonyms', async () => {
  const notShared = await selected('not-yet-shared');
  const undisp = await selected('undispositioned');
  assert(JSON.stringify(notShared) !== JSON.stringify(undisp),
    'the two states must not be interchangeable (AC-5). Over this corpus they differ by exactly the ' +
    'declared-but-unpublished concept, which is NOT undispositioned (it carries a b tag) but IS not ' +
    `yet shared. Both selected ${short(notShared)}.`);
  assert(undisp.includes('undecided') && !undisp.includes('b-coverage fixture'),
    '"undispositioned" means no b tag at all, so it must include the undecided concept and exclude ' +
    `the declared-but-unpublished one. Got ${short(undisp)}.`);
});

test('U8: the "all" state filters nothing out', async () => {
  const got = await selected('all');
  assert(got.length === ALL_ROWS.length,
    `the default state must pass every row through — author filtering is a separate stage (AC-1). ` +
    `Got ${got.length} of ${ALL_ROWS.length}: ${short(got)}`);
});

test('U9: the module names its states, so the page and this suite cannot drift apart', async () => {
  const mod = await loadFilterUtil();
  assert(Array.isArray(mod.STATES) && mod.STATES.length > 0,
    'conceptStateFilter.js must export STATES — the list the select renders, so the option ids and ' +
    'the predicate cannot disagree.');
  const ids = mod.STATES.map((s) => (typeof s === 'string' ? s : s && s.id));
  for (const required of ['all', 'not-yet-shared', 'undispositioned']) {
    assert(ids.includes(required),
      `STATES must include the "${required}" state. Got ids ${short(ids)}.`);
  }
  const needsPub = mod.STATES.find((s) => s && s.id === 'not-yet-shared');
  assert(needsPub && needsPub.needsPublication === true,
    'the "not-yet-shared" state must declare needsPublication:true — that flag is what tells the ' +
    'page to fetch /api/shared-by-me lazily instead of on every page load (ADR 0001, Control shape).');
});

/* ══════════ S-class — the structural rules ADR 0001 turns on ══════════ */

test('S1 (ADR 0001): the page does not re-derive the sharing rule — it consumes /api/shared-by-me', () => {
  const src = safeRead(CONCEPT_LIST_JSX);
  assert(src !== null, 'ui/src/pages/concepts/ConceptList.jsx is unreadable.');
  assert(src.includes('/api/shared-by-me'),
    'ConceptList.jsx must read publication from /api/shared-by-me — the same endpoint the Shared by ' +
    'me page uses. Consuming one source is what makes AC-2 true by construction rather than by two ' +
    'implementations happening to agree.');
  for (const forbidden of ['carriesSelfPointer', 'resolveSharingState', 'querySync', 'SimplePool']) {
    assert(!src.includes(forbidden),
      `ConceptList.jsx must not reference ${forbidden} — the sharing rule has exactly one home in ` +
      'src/lib/sharingState.js (sharedByMe.js:23-25), and the page consumes its resolved output.');
  }
});

test('S2 (AC-5): the coverage control is ONE selector, not two look-alike checkboxes', () => {
  const src = safeRead(CONCEPT_LIST_JSX);
  assert(src !== null, 'ui/src/pages/concepts/ConceptList.jsx is unreadable.');
  const checkboxes = (src.match(/type=["']checkbox["']/g) || []).length;
  assert(checkboxes === 0,
    `the Coverage checkbox must be replaced by a single-select state filter (ADR 0001, Control ` +
    `shape): two similar checkboxes is exactly the "two verbs on one surface" confusion this book ` +
    `has already spent itself undoing. Found ${checkboxes} checkbox input(s).`);
  assert(/conceptStateFilter/.test(src),
    'ConceptList.jsx must import the state list and predicate from ui/src/utils/conceptStateFilter.js ' +
    'rather than inlining them — the predicate has to stay exercisable without a browser.');
});

test('S3 (ADR 0001, failure tier 1): the shared-by-me fetch does not fail silently', () => {
  const src = safeRead(CONCEPT_LIST_JSX);
  assert(src !== null, 'ui/src/pages/concepts/ConceptList.jsx is unreadable.');
  // The health fetch's `.catch(() => {})` is right for an icon and wrong here: a swallowed
  // failure would leave the filter answering from nothing. Require that the page keeps at
  // most that ONE silent catch (the pre-existing health one) and no more.
  const silent = (src.match(/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g) || []).length;
  assert(silent <= 1,
    `found ${silent} silently-swallowed rejections. The audit-summary fetch has one by design ` +
    '(a health icon may degrade quietly); the shared-by-me fetch must NOT — a swallowed failure ' +
    'leaves the state filter answering from no data, which AC-3 forbids. Record the failure and ' +
    'make the publication-dependent options unavailable with the reason shown.');
});

test('S4: the existing undispositioned traversal survives — "Save & next" is not collateral damage', () => {
  const src = safeRead(CONCEPT_LIST_JSX);
  assert(src !== null, 'ui/src/pages/concepts/ConceptList.jsx is unreadable.');
  assert(/_undispositionedMine/.test(src) && /nextUndispositioned/.test(src),
    'ConceptList.jsx must keep _undispositionedMine and nextUndispositioned — the DispositionPanel\'s ' +
    '"Save & next" iterates that set, and this story only replaces the FILTER control, not the ' +
    'traversal (ADR 0001, Consequences).');
});

/* ══════════ H-class — the two facts the design leans on ══════════ */

let reachable = null;
async function stackAvailable() {
  if (reachable !== null) return reachable;
  try {
    const r = await fetch(`${HOST_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    reachable = r.ok;
  } catch { reachable = false; }
  return reachable;
}

test('H1: /api/shared-by-me answers the shape ADR 0001 joins against — relayOk plus tri-state published per coord', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = await fetch(`${HOST_BASE}/api/shared-by-me`, { signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => null);
  assert(r.status === 200 && j && j.success === true,
    `GET /api/shared-by-me must answer 200 with success:true (got ${r.status}, ${short(j)}).`);
  assert(typeof j.relayOk === 'boolean',
    `the response must carry relayOk — it is how the page distinguishes "not shared" from ` +
    `"could not be confirmed" (AC-3). Got ${short(j.relayOk)}.`);
  assert(Array.isArray(j.concepts),
    `the response must carry a concepts array. Got ${short(j.concepts)}.`);
  for (const c of j.concepts) {
    assert(typeof c.coord === 'string' && c.coord.split(':').length >= 3,
      `every concept must carry a coord in kind:pubkey:slug form — that is the join key. Got ${short(c)}.`);
    assert(c.published === true || c.published === false || c.published === null,
      `published must be tri-state (true | false | null). Got ${short(c.published)} for ${c.coord}.`);
  }
});

test('H2: the join key is real — a shared-by-me coord matches a concept-header uuid in the graph', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = await fetch(`${HOST_BASE}/api/shared-by-me`, { signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => null);
  if (!j || j.success !== true) return 'SKIP';
  if (!j.concepts.length) return 'SKIP'; // nothing declared on this instance — nothing to join
  const cy = await fetch(`${HOST_BASE}/api/neo4j/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cypher: 'MATCH (h:NostrEvent) WHERE (h:ListHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998] RETURN h.uuid AS uuid',
    }),
    signal: AbortSignal.timeout(20000),
  });
  const cj = await cy.json().catch(() => null);
  const uuids = new Set(((cj && cj.data) || []).map((row) => row.uuid));
  assert(uuids.size > 0,
    `could not read concept-header uuids from the graph to check the join (got ${short(cj)}).`);
  const hits = j.concepts.filter((c) => uuids.has(c.coord));
  assert(hits.length > 0,
    'no shared-by-me coord matched any concept-header uuid. ADR 0001 joins the two on exactly this ' +
    'equality ("the join key is exact and already in hand"), so if it does not hold the design is ' +
    `wrong, not the test. coords=${short(j.concepts.map((c) => c.coord))} `);
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- not-yet-shared filter tests (epic shared-concepts-seeding, Story 3) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nnot-yet-shared-filter: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
