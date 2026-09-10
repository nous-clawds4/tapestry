/**
 * Story graph-curation-ui #4 — the summaries endpoint's element/set counts.
 * ADR graph-curation-ui/0004 + Amendment 1 (setCount folded in).
 * Plan: engineering-team/stories/graph-curation-ui/4-summaries-element-count.test-plan.md
 *
 * ADR 0004 chose Option C: fix the endpoint's Cypher in place, and — instead of sharing a
 * module across the CJS/ESM boundary the repo has never crossed — pin the two surfaces
 * together with a CROSS-SURFACE EQUALITY TEST. That guard is L2 below, and it is this
 * suite's reason for existing: the server's query and the page's canonical rule
 * (ui/src/utils/conceptCounts.js, story #3) are separate implementations, so the only thing
 * stopping them drifting apart again is an assertion that they agree.
 *
 * TEST LEVEL:
 *   L1..L8  LIVE against the running endpoint and graph. SKIP when the stack is down.
 *           L2 is the drift guard and runs over EVERY concept.
 *   S1..S3  source-level over the handler, for shape claims a response cannot show.
 *   R1..R2  regression sentinels over story #3's module, which L2 depends on.
 *
 * NO HARD-CODED COUNTS. Same discipline as #3: `word` moved 575 -> 582 mid-session. Every
 * expected value is derived from the graph at run time, and the invariant assertions
 * ("strictly greater than the direct-only count") hold whatever the data does.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const HANDLER = path.join(ROOT, 'src/api/concept-graph/index.js');
const COUNTS = path.join(ROOT, 'ui/src/utils/conceptCounts.js');

const HOST = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(p) { try { return await import(pathToFileURL(p).href); } catch { return null; } }

let _stack;
async function stack() {
  if (_stack) return _stack;
  try {
    const r = await fetch(`${HOST}/api/assistant/pubkey`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    _stack = (j && j.success && /^[0-9a-f]{64}$/.test(j.pubkey)) ? { up: true, ta: j.pubkey } : { up: false };
  } catch { _stack = { up: false }; }
  return _stack;
}

async function summaries() {
  const r = await fetch(`${HOST}/api/concept-graph/summaries`, { signal: AbortSignal.timeout(30000) });
  const j = await r.json();
  assert(j && j.success && Array.isArray(j.summaries), `summaries endpoint did not answer: ${JSON.stringify(j).slice(0, 200)}`);
  return j.summaries;
}

async function run1(cypher, params = {}) {
  const r = await fetch(`${HOST}/api/neo4j/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cypher, params }), signal: AbortSignal.timeout(30000),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`query failed (HTTP ${r.status}): ${j.error}`);
  return (j.data || [])[0] || {};
}

/** Story #3's canonical rule — the other side of the equality guard. */
async function canonical(handle) {
  const mod = await loadEsm(COUNTS);
  assert(mod && typeof mod.conceptCountsCypher === 'function',
    'ui/src/utils/conceptCounts.js must still export conceptCountsCypher() — story #3 shipped it, ' +
    'and ADR 0004 Option C pins this endpoint against it. If it is gone, the drift guard is gone.');
  return run1(mod.conceptCountsCypher(), { conceptUuid: handle });
}

/** The two narrower rules this story replaces. */
const directOnly = (h) => run1(
  `MATCH (n:ConceptHeader {uuid:$u})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
   OPTIONAL MATCH (sup)-[:HAS_ELEMENT]->(e) RETURN count(DISTINCT e) AS c`, { u: h }).then(r => r.c);
const oneHopSets = (h) => run1(
  `MATCH (n:ConceptHeader {uuid:$u})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
   OPTIONAL MATCH (sup)-[:IS_A_SUPERSET_OF]->(s) RETURN count(DISTINCT s) AS c`, { u: h }).then(r => r.c);

const bySlug = (rows, slug) => rows.find(r => r.handle.endsWith(`:${slug}`));

// ===========================================================================
// L — live. L2 is the drift guard ADR 0004 Option C rests on.
// ===========================================================================

test('L1 (AC6): the endpoint answers with its documented shape intact', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await summaries();
  assert(rows.length > 10, `expected many concepts; got ${rows.length}.`);
  const r = rows[0];
  for (const f of ['handle', 'name', 'elementCount', 'setCount', 'labels']) {
    assert(f in r, `every summary must carry \`${f}\` — AGENTS.md §3 documents this shape; got keys ${Object.keys(r)}.`);
  }
  assert(/^\d+:[0-9a-f]{64}:.+/.test(r.handle), `handle must stay kind:pubkey:slug; got ${r.handle}.`);
  assert(typeof r.elementCount === 'number' && typeof r.setCount === 'number',
    'both counts must be numbers.');
  assert(Array.isArray(r.labels), 'labels must remain an array.');
});

test('L2 (AC1+AC5, THE DRIFT GUARD): endpoint counts equal the page\'s canonical rule, for EVERY concept', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await summaries();
  const bad = [];
  for (const row of rows) {
    const want = await canonical(row.handle);
    if (row.elementCount !== want.elementCount || row.setCount !== want.setCount) {
      bad.push(`${row.handle.split(':').pop()}: endpoint=${row.elementCount}/${row.setCount} canonical=${want.elementCount}/${want.setCount}`);
    }
  }
  assert(bad.length === 0,
    `ADR 0004 Option C accepts TWO implementations of the counting rule — the server's Cypher and ` +
    `ui/src/utils/conceptCounts.js — on the condition that this test proves they agree. ` +
    `${bad.length} of ${rows.length} concepts disagree (elements/sets): ${bad.slice(0, 8).join('; ')}`);
});

test('L3 (AC2): concepts whose elements live under nested sets are no longer reported as empty', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await summaries();
  let sawNested = 0;
  for (const slug of ['word', 'validation-tool']) {
    const row = bySlug(rows, slug);
    assert(row, `expected the graph to contain the ${slug} concept.`);
    const direct = await directOnly(row.handle);
    const want = (await canonical(row.handle)).elementCount;
    assert(row.elementCount > 0,
      `${slug}: the orientation endpoint reports 0 elements for a concept that has ${want}. ` +
      `This is the defect — an agent reading the documented ladder is told the graph's largest ` +
      `concept is empty.`);
    assert(row.elementCount === want, `${slug}: endpoint ${row.elementCount}, canonical ${want}.`);
    if (want > direct) { sawNested++; assert(row.elementCount > direct,
      `${slug}: elements are nested under sets, so the count (${want}) must exceed the direct-only ` +
      `subtotal (${direct}); endpoint returned the narrow answer.`); }
  }
  assert(sawNested > 0, 'neither fixture has set-nested elements any more — revisit the fixture list.');
});

test('L4 (AC3): concepts mixing direct and nested elements report the full count', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await summaries();
  for (const slug of ['graph', 'set', 'property']) {
    const row = bySlug(rows, slug);
    assert(row, `expected the graph to contain the ${slug} concept.`);
    const direct = await directOnly(row.handle);
    const want = (await canonical(row.handle)).elementCount;
    assert(row.elementCount === want, `${slug}: endpoint ${row.elementCount}, canonical ${want}.`);
    assert(row.elementCount > direct,
      `${slug}: must report the full count (${want}), not the direct-only subtotal (${direct}).`);
  }
});

test('L5 (AC4 regression guard): concepts already counted correctly do not move', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await summaries();
  for (const slug of ['nostr-relay', 'firmware-concept']) {
    const row = bySlug(rows, slug);
    assert(row, `expected the graph to contain the ${slug} concept.`);
    const direct = await directOnly(row.handle);
    const want = (await canonical(row.handle)).elementCount;
    assert(row.elementCount === want && want === direct,
      `${slug} is a control — every element is direct, so the full count (${want}), the endpoint's ` +
      `(${row.elementCount}) and the direct-only count (${direct}) must all agree. If they no ` +
      `longer do, this concept changed shape and is no longer a valid control.`);
  }
});

test('L6 (AC5, Amendment 1): setCount walks the whole superset tree, not one hop', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await summaries();
  let sawDeep = 0;
  for (const slug of ['word', 'nostr-relay', 'graph']) {
    const row = bySlug(rows, slug);
    assert(row, `expected the graph to contain the ${slug} concept.`);
    const oneHop = await oneHopSets(row.handle);
    const want = (await canonical(row.handle)).setCount;
    assert(row.setCount === want, `${slug}: endpoint setCount ${row.setCount}, canonical ${want}.`);
    if (want > oneHop) { sawDeep++; assert(row.setCount > oneHop,
      `${slug}: the superset walk reaches ${want} nodes but the endpoint returned ${row.setCount}, ` +
      `the single-hop subtotal (${oneHop}). Amendment 1 folded setCount in precisely so the ` +
      `endpoint and the concept page stop disagreeing here.`); }
  }
  assert(sawDeep > 0, 'no fixture concept has nested sets any more — revisit the fixture list.');
});

test('L7 (AC6): the other documented fields are untouched in name, shape and value', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await summaries();
  const named = bySlug(rows, 'nostr-relay');
  assert(named && named.name === 'nostr relay', `name must still be the concept's name; got ${named && named.name}.`);
  assert(typeof named.description === 'string' && named.description.length > 0,
    `description must still be populated; got ${JSON.stringify(named && named.description)}.`);
  assert(named.labels.includes('ConceptHeader'), `labels must still carry ConceptHeader; got ${named.labels}.`);
  // No field may have been dropped or renamed while the counts were fixed.
  const keys = new Set(Object.keys(named));
  for (const f of ['handle', 'name', 'description', 'labels', 'elementCount', 'setCount', 'propertyCount']) {
    assert(keys.has(f), `the response lost the \`${f}\` field.`);
  }
});

test('L8 (AC7): the orientation call stays fast enough — no order-of-magnitude regression', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  // Baseline measured 2026-09-09 (median of five warm runs): 6.1ms today, 27.5ms with both
  // counts corrected. The bound below is deliberately loose — this asserts "did not fall off a
  // cliff", not a benchmark. A tight threshold here would flake on a loaded machine and teach
  // people to ignore the suite, which is worse than no timing test at all.
  await summaries(); await summaries();                       // warm
  const runs = [];
  for (let i = 0; i < 3; i++) { const t = Date.now(); await summaries(); runs.push(Date.now() - t); }
  const median = runs.sort((a, b) => a - b)[1];
  assert(median < 1000,
    `the summaries endpoint took ${median}ms (runs: ${runs}). Expected well under 1s — the ` +
    `corrected query measured 27.5ms at design time, so this indicates an order-of-magnitude ` +
    `regression, not the ~4.5x cost the story accepted.`);
});

// ===========================================================================
// S — source-level over the handler.
// ===========================================================================

test('S1 (AC1): the elementCount clause walks the set tree forward', async () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'src/api/concept-graph/index.js is missing — unexpected.');
  assert(/IS_A_SUPERSET_OF\*0\.\.5\]->\(\w+\)-\[:HAS_ELEMENT\]->/.test(src),
    'the elementCount match must walk `-[:IS_A_SUPERSET_OF*0..5]->` FORWARD before HAS_ELEMENT. ' +
    'Without the walk it sees only direct members, which is why `word` reported 0.');
  assert(!/\(:Superset\)-\[:HAS_ELEMENT\]->\(e\)/.test(src),
    'the old direct-only clause `(:Superset)-[:HAS_ELEMENT]->(e)` must be gone.');
});

test('S2 (AC5, Amendment 1): the setCount clause walks the whole tree too', async () => {
  const src = safeRead(HANDLER);
  assert(!/-\[:IS_A_SUPERSET_OF\]->\(s\)/.test(src),
    'the single-hop `-[:IS_A_SUPERSET_OF]->(s)` setCount clause must be gone — Amendment 1 folds ' +
    'setCount in so the endpoint and the concept page agree on both counts, not just one.');
});

test('S3 (AC6): the response projection is unchanged', async () => {
  const src = safeRead(HANDLER);
  for (const f of ['handle', 'name', 'description', 'labels', 'elementCount', 'setCount', 'propertyCount']) {
    assert(new RegExp(`AS ${f}\\b|\\b${f},`).test(src),
      `the handler must still project \`${f}\` — this story changes two counting clauses, nothing else.`);
  }
});

// ===========================================================================
// R — regression sentinels over the module L2 depends on.
// ===========================================================================

test('R1: story #3\'s canonical module still exports a parameterized builder', async () => {
  const mod = await loadEsm(COUNTS);
  assert(mod && typeof mod.conceptCountsCypher === 'function',
    'ui/src/utils/conceptCounts.js must keep exporting conceptCountsCypher() — the drift guard ' +
    'has nothing to compare against without it.');
  assert(/\$conceptUuid\b/.test(mod.conceptCountsCypher()),
    'it must stay parameterized; an interpolated handle 403s for unauthenticated readers ' +
    '(ADR 0003 Amendment 1), which would take this whole live tier down.');
});

test('R2: no UI file was changed by this story', async () => {
  const src = safeRead(COUNTS);
  assert(/IS_A_SUPERSET_OF\*0\.\.5/.test(src) && /:NostrEvent/.test(src),
    'story #4 is server-side only; the page rule must be exactly as story #3 left it.');
});

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\nsummaries-element-count: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
