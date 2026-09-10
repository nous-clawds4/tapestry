/**
 * Story graph-curation-ui #3 — one correct element/set count on the concept page.
 * ADR graph-curation-ui/0003 — canonical count computed once, shared via outlet context.
 * Plan: engineering-team/stories/graph-curation-ui/3-count-concepts-as-elements.test-plan.md
 *
 * ADR 0003 chose Option C: the counting rule moves to a pure ui/src/utils/conceptCounts.js;
 * ConceptDetail computes the counts and passes them through the <Outlet context> it already
 * renders; ConceptOverview deletes its own counting and reads them.
 *
 * TEST LEVEL — the point of the ADR's module is that the rule becomes EXECUTABLE:
 *   U1..U2  the pure builder itself, imported and called (no stack needed).
 *   L1..L6  the builder's Cypher RUN against the live graph and cross-checked against an
 *           independently written derivation. These are the real proof. SKIP when the stack
 *           is down.
 *   S1..S4  source-level, for the structural claims a query result cannot show (that the
 *           Overview stopped counting, that context carries the numbers).
 *   R1..R3  regression sentinels — the Overview's other fields must survive. PASS before
 *           AND after.
 *
 * NO HARD-CODED COUNTS, deliberately. The story requires expected values be derived from the
 * graph: `word` read 575 at the start of the 2026-09-09 session and 582 by the end, because
 * creating one concept mints seven new word-typed nodes. Any literal would rot. So the live
 * tests assert (a) the builder agrees with an independent derivation, and (b) invariants that
 * hold whatever the data does — e.g. "the full count strictly exceeds the direct-only count
 * for a concept that has nested sets". Those cannot go stale.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const COUNTS = path.join(ROOT, 'ui/src/utils/conceptCounts.js');
const DETAIL = path.join(ROOT, 'ui/src/pages/concepts/ConceptDetail.jsx');
const OVERVIEW = path.join(ROOT, 'ui/src/pages/concepts/ConceptOverview.jsx');

const HOST = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(p) { try { return await import(pathToFileURL(p).href); } catch { return null; } }

const NOT_BUILT =
  'ui/src/utils/conceptCounts.js must export conceptCountsCypher(uuid) returning Cypher that ' +
  'yields elementCount and setCount — not implemented yet (ADR graph-curation-ui/0003, decision 1).';

async function builder() {
  const mod = await loadEsm(COUNTS);
  assert(mod && typeof mod.conceptCountsCypher === 'function', NOT_BUILT);
  return mod.conceptCountsCypher;
}

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

async function run1(cypher, params = {}) {
  const r = await fetch(`${HOST}/api/neo4j/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cypher, params }), signal: AbortSignal.timeout(30000),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`query failed (HTTP ${r.status}): ${j.error}`);
  return (j.data || [])[0] || {};
}

/** Independent derivation — two-step, deliberately NOT the builder's single-pass shape. */
async function derive(uuid) {
  const sets = await run1(
    `MATCH (h:ListHeader {uuid:$u})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
     OPTIONAL MATCH (sup)-[:IS_A_SUPERSET_OF*0..5]->(n)
     RETURN collect(DISTINCT n.uuid) AS uuids`, { u: uuid });
  const containerUuids = (sets.uuids || []).filter(Boolean);
  const els = await run1(
    `MATCH (c:NostrEvent)-[:HAS_ELEMENT]->(e:NostrEvent)
     WHERE c.uuid IN $ids RETURN count(DISTINCT e) AS c`, { ids: containerUuids });
  return { elementCount: els.c, setCount: containerUuids.length };
}

/** The two narrower rules this story replaces, for invariant comparisons. */
async function directOnly(uuid) {
  const r = await run1(
    `MATCH (h:ListHeader {uuid:$u})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
     OPTIONAL MATCH (sup)-[:HAS_ELEMENT]->(e) RETURN count(DISTINCT e) AS c`, { u: uuid });
  return r.c;
}
async function listItemOnly(uuid) {
  const r = await run1(
    `MATCH (h:ListHeader {uuid:$u})-[:IS_THE_CONCEPT_FOR]->(s)-[:IS_A_SUPERSET_OF*0..5]->(ss)
     OPTIONAL MATCH (ss)-[:HAS_ELEMENT]->(e:ListItem) RETURN count(DISTINCT e) AS c`, { u: uuid });
  return r.c;
}

const H = (ta, slug) => `39998:${ta}:${slug}`;

// ===========================================================================
// U — the pure builder, imported and called. No stack required.
// ===========================================================================

test('U1 (ADR d1): conceptCountsCypher is a pure builder — same uuid in, identical Cypher out, no side effects', async () => {
  const fn = await builder();
  const a = fn('39998:aa:example');
  const b = fn('39998:aa:example');
  assert(typeof a === 'string' && a.length > 0, `must return a non-empty Cypher string; got ${typeof a}.`);
  assert(a === b, 'two calls with the same uuid must produce identical Cypher (pure builder).');
  assert(a !== fn('39998:aa:other'), 'the returned Cypher must actually depend on the uuid it was given.');
});

test('U2 (ADR d1): the module is dependency-free — no React, no fetch, so the runner can execute it', async () => {
  const src = safeRead(COUNTS);
  assert(src.length > 0, NOT_BUILT);
  assert(!/from\s+['"]react/.test(src) && !/useState|useEffect/.test(src),
    'conceptCounts.js must not import or use React — ADR 0003 decision 1 requires it be executable ' +
    'by the Node test runner, which is the whole reason the rule was moved out of the component.');
  assert(!/\bfetch\s*\(/.test(src), 'conceptCounts.js must not perform I/O; it builds a query string only.');
});

// ===========================================================================
// L — the builder's Cypher RUN against the live graph. The real proof.
// ===========================================================================

test('L1 (AC1): the builder returns exactly one row carrying elementCount and setCount', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const fn = await builder();
  const row = await run1(fn(H(s.ta, 'nostr-relay')));
  assert(row && typeof row.elementCount === 'number',
    `the query must project a numeric elementCount; got ${JSON.stringify(row)}.`);
  assert(typeof row.setCount === 'number',
    `the query must also project a numeric setCount — ADR 0003 decision 3 folds setCount in ` +
    `(the Overview claims 1 set for \`word\`, which has 48). Got ${JSON.stringify(row)}.`);
});

test('L2 (AC1): the builder agrees with an independently written derivation, across every concept in the graph', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const fn = await builder();
  const all = await fetch(`${HOST}/api/concept-graph/summaries`).then(r => r.json());
  const handles = [...new Set((all.summaries || []).map(x => x.handle))];
  assert(handles.length > 10, `expected the graph to hold many concepts; got ${handles.length}.`);
  const bad = [];
  for (const h of handles) {
    const got = await run1(fn(h));
    const want = await derive(h);
    if (got.elementCount !== want.elementCount || got.setCount !== want.setCount) {
      bad.push(`${h.split(':').pop()}: builder=${got.elementCount}/${got.setCount} derived=${want.elementCount}/${want.setCount}`);
    }
  }
  assert(bad.length === 0,
    `the canonical builder must agree with a two-step derivation of the same rule for every ` +
    `concept (elements/sets). Disagreed on ${bad.length}: ${bad.slice(0, 6).join('; ')}`);
});

test('L3 (AC2): concepts whose elements are themselves concepts are counted — the :ListItem blind spot is gone', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const fn = await builder();
  for (const slug of ['firmware-concept', 'concept-header']) {
    const u = H(s.ta, slug);
    const got = (await run1(fn(u))).elementCount;
    const narrow = await listItemOnly(u);
    const want = (await derive(u)).elementCount;
    assert(got === want, `${slug}: builder said ${got}, independent derivation said ${want}.`);
    assert(got > 0,
      `${slug} holds elements that are themselves concepts; a count of 0 means the old :ListItem ` +
      `predicate is still in force (concepts carry ListHeader/ConceptHeader, never ListItem).`);
    assert(got > narrow,
      `${slug}: the correct count (${got}) must EXCEED the :ListItem-only count (${narrow}) — that ` +
      `difference is exactly the concepts-as-elements this story exists to stop dropping.`);
  }
});

test('L4 (AC3+AC4): elements nested under sets are counted — the reversed-traversal blind spot is gone', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const fn = await builder();
  let sawNested = 0;
  for (const slug of ['word', 'validation-tool', 'graph', 'set', 'property']) {
    const u = H(s.ta, slug);
    const got = (await run1(fn(u))).elementCount;
    const direct = await directOnly(u);
    const want = (await derive(u)).elementCount;
    assert(got === want, `${slug}: builder said ${got}, independent derivation said ${want}.`);
    assert(got > 0, `${slug}: a count of 0 means set-nested elements are still being skipped.`);
    if (want > direct) {
      sawNested++;
      assert(got > direct,
        `${slug}: elements live under nested sets, so the correct count (${want}) must exceed the ` +
        `direct-only count (${direct}). The builder returned ${got}, which is the narrow answer.`);
    }
  }
  assert(sawNested > 0,
    'expected at least one of these concepts to have set-nested elements; if none do, this test ' +
    'is no longer exercising the defect and the fixture list needs revisiting.');
});

test('L5 (AC5 regression guard): concepts that are already counted correctly do not move', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const fn = await builder();
  for (const slug of ['nostr-relay', 'nostr-kind']) {
    const u = H(s.ta, slug);
    const got = (await run1(fn(u))).elementCount;
    const want = (await derive(u)).elementCount;
    const direct = await directOnly(u);
    const narrow = await listItemOnly(u);
    assert(got === want, `${slug}: builder said ${got}, derivation said ${want}.`);
    assert(got === direct && got === narrow,
      `${slug} is a control: all its elements are direct and none are concepts, so every rule — ` +
      `full (${got}), direct-only (${direct}), :ListItem-only (${narrow}) — must agree. If they ` +
      `no longer do, this concept changed shape and is no longer a valid control.`);
  }
});

test('L6 (ADR d3): setCount counts the whole superset walk, not just the superset itself', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const fn = await builder();
  let sawDeep = 0;
  for (const slug of ['word', 'nostr-relay', 'graph']) {
    const u = H(s.ta, slug);
    const got = (await run1(fn(u))).setCount;
    const want = (await derive(u)).setCount;
    assert(got === want, `${slug}: builder setCount=${got}, derived=${want}.`);
    if (want > 1) { sawDeep++; assert(got > 1,
      `${slug} has ${want} nodes on its superset walk; a setCount of ${got} means the reversed ` +
      `traversal is still in force (it can only ever see the superset itself).`); }
  }
  assert(sawDeep > 0, 'expected at least one fixture concept to have nested sets.');
});

// ===========================================================================
// S — structural claims a query result cannot show.
// ===========================================================================

test('S1 (ADR d1): ConceptDetail sources its counts from the shared builder, not an inline :ListItem match', async () => {
  const src = safeRead(DETAIL);
  assert(src.length > 0, 'ui/src/pages/concepts/ConceptDetail.jsx is missing — unexpected.');
  assert(/conceptCounts/.test(src) && /conceptCountsCypher/.test(src),
    'ConceptDetail.jsx must import conceptCountsCypher from ui/src/utils/conceptCounts.js.');
  assert(!/HAS_ELEMENT\]->\(\s*\w+\s*:ListItem\s*\)/.test(src),
    'ConceptDetail.jsx must no longer match elements as :ListItem — that predicate is what made ' +
    'concepts-as-elements invisible and read 0.');
});

test('S2 (ADR d2): ConceptOverview no longer counts anything — it cannot disagree with a number it does not compute', async () => {
  const src = safeRead(OVERVIEW);
  assert(src.length > 0, 'ui/src/pages/concepts/ConceptOverview.jsx is missing — unexpected.');
  assert(!/<-\[:IS_A_SUPERSET_OF/.test(src),
    'ConceptOverview.jsx must not contain a REVERSED IS_A_SUPERSET_OF traversal. Placement edges ' +
    'are parent-first (ADR relationship-primitives/0001); the reversed arrow is why this page ' +
    'reported 0 elements for `word`.');
  assert(!/count\(DISTINCT\s+elem\)/.test(src) && !/count\(DISTINCT\s+setNode\)/.test(src),
    'ConceptOverview.jsx must stop computing elementCount/setCount itself (ADR 0003 decision 2). ' +
    'Correcting its query instead of deleting it leaves two counters that can drift apart again.');
});

test('S3 (ADR d2): the counts reach the Overview through the outlet context the detail page already renders', async () => {
  const detail = safeRead(DETAIL);
  const overview = safeRead(OVERVIEW);
  assert(/<Outlet\s+context=\{\{/.test(detail),
    'ConceptDetail.jsx must still render <Outlet context={{ ... }} /> — it is the channel ADR 0003 ' +
    'uses instead of a second query.');
  assert(/elementCount/.test(detail) && /setCount/.test(detail),
    'ConceptDetail.jsx must carry both counts so they can be passed down.');
  assert(/useOutletContext\(\)/.test(overview) && /elementCount/.test(overview),
    'ConceptOverview.jsx must read elementCount from outlet context rather than its own query.');
});

test('S4 (AC1): the Overview still renders both figures — deleting the query must not delete the display', async () => {
  const src = safeRead(OVERVIEW);
  assert(/ELEMENTS/i.test(src), 'the Overview must still show an ELEMENTS figure.');
  assert(/SETS/i.test(src), 'the Overview must still show a SETS figure.');
});

// ===========================================================================
// R — regression sentinels. PASS before and after.
// ===========================================================================

test('R1: the Overview keeps its other fields (names, description, created, properties)', async () => {
  const src = safeRead(OVERVIEW);
  for (const bit of ['names', 'description', 'createdAt', 'propertyCount']) {
    assert(new RegExp(bit).test(src),
      `the Overview must still source ${bit} — ADR 0003 removes only the two counting clauses.`);
  }
});

test('R2: ConceptDetail still resolves the concept header and its superset', async () => {
  const src = safeRead(DETAIL);
  assert(/IS_THE_CONCEPT_FOR/.test(src) && /supersetUuid/.test(src),
    'ConceptDetail.jsx must still resolve the superset — other tabs read it from outlet context.');
});

test('R3: ConceptList keeps its own (correct) counting — this story does not touch it', async () => {
  const src = safeRead(path.join(ROOT, 'ui/src/pages/concepts/ConceptList.jsx'));
  assert(/IS_A_SUPERSET_OF\*0\.\.5\]->/.test(src),
    'ConceptList.jsx keeps its forward traversal; folding it into the shared module is explicitly ' +
    'out of scope for this story (ADR 0003 Consequences).');
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
  console.log(`\nconcept-count-canonical: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
