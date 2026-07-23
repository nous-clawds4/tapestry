/**
 * Story 1 (epic: graph-curation-ui) — Place and move nodes between sets from
 * the concept pages.
 *
 * Story: engineering-team/stories/graph-curation-ui/1-move-nodes-between-sets-ui.md
 * ADR:   engineering-team/decisions/graph-curation-ui/0001-shared-placement-dialog-over-primitives.md
 *
 * Test classes (ADR "Suggested test split", on the established conventions):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the pure core
 *     ui/src/utils/placement.js and the client ui/src/api/relationships.js are
 *     ESM (ui/package.json "type":"module") and run in the Node runner via
 *     dynamic import (the event-page-ui.test.js precedent). Covers the kind →
 *     relType map, the parent-first direction rule, add-before-delete move
 *     ordering, the same-destination no-op guard, the cycle-exclusion filter,
 *     and the client contract (full-body return incl. `result` + hazard
 *     `note`; typed throw with .status/.allowed) against a stubbed fetch.
 *
 *   S-class (source assertions, stack-free) — the three pages + the shared
 *     dialog wire the feature per the ADR: owner gating on every affordance,
 *     PlacementDialog modes, the direct-placement flag in SetDetail's
 *     elements query, stopPropagation on row removes, the hazard note and
 *     partial-failure surfacing, refetch-based refresh. Source-level because
 *     the harness has no jsdom/testing-library (deliberate; no new test
 *     infrastructure without an ADR).
 *
 *   H-class (SENTINELS — live local stack, per-test SKIP when unreachable) —
 *     validate the two Cypher shapes the UI will embed (the EXISTS
 *     direct-placement flag; the direct-parents query) against the real
 *     Neo4j, using throwaway test-prefixed :NostrEvent fixtures created and
 *     torn down via container-loopback POST /api/neo4j/query (the
 *     relationship-primitives.test.js plumbing). These PASS before AND after
 *     implementation — they pin query semantics, not the feature — and exist
 *     so a Neo4j syntax/semantics surprise fails HERE, not in the browser.
 *
 *   R-class (regression sentinels, stack-free) — the pages' existing read
 *     queries and buttons survive the edit. PASS before AND after.
 *
 * ALL U and S tests FAIL until the feature lands — placement.js,
 * relationships.js, and PlacementDialog.jsx do not exist yet, and the three
 * pages carry no affordances. That is the point. H and R are declared
 * sentinels (pass now, pass after).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PLACEMENT = path.join(ROOT, 'ui/src/utils/placement.js');
const REL_API = path.join(ROOT, 'ui/src/api/relationships.js');
const DIALOG = path.join(ROOT, 'ui/src/components/PlacementDialog.jsx');
const SET_DETAIL = path.join(ROOT, 'ui/src/pages/concepts/SetDetail.jsx');
const ELEMENT_DETAIL = path.join(ROOT, 'ui/src/pages/concepts/ElementDetail.jsx');
const CONCEPT_DAG = path.join(ROOT, 'ui/src/pages/concepts/ConceptDag.jsx');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 200) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}
async function loadEsm(absPath, missingMsg) {
  if (!fs.existsSync(absPath)) throw new Error(missingMsg);
  try { return await import(pathToFileURL(absPath).href); }
  catch (e) { throw new Error(`${path.relative(ROOT, absPath)} exists but failed to import as ESM: ${e.message}`); }
}

const PLACEMENT_MISSING =
  'ui/src/utils/placement.js does not exist yet — the pure placement-ops core ' +
  '(ADR graph-curation-ui/0001 decision 1) is not implemented.';
const REL_API_MISSING =
  'ui/src/api/relationships.js does not exist yet — the add/delete client helpers ' +
  '(ADR graph-curation-ui/0001 decision 2) are not implemented.';

/* ── U-class: ui/src/utils/placement.js (EXECUTED) ─────────────────────── */

test('U1 (AC1/AC4): PLACEMENT_KINDS maps exactly element→HAS_ELEMENT and subset→IS_A_SUPERSET_OF', async () => {
  const mod = await loadEsm(PLACEMENT, PLACEMENT_MISSING);
  const kinds = mod.PLACEMENT_KINDS;
  assert(kinds && typeof kinds === 'object', 'placement.js must export PLACEMENT_KINDS.');
  assert(kinds.element === 'HAS_ELEMENT',
    `PLACEMENT_KINDS.element must be 'HAS_ELEMENT' (got ${short(kinds.element)}).`);
  assert(kinds.subset === 'IS_A_SUPERSET_OF',
    `PLACEMENT_KINDS.subset must be 'IS_A_SUPERSET_OF' (got ${short(kinds.subset)}).`);
  assert(Object.keys(kinds).length === 2,
    'PLACEMENT_KINDS must carry exactly the two whitelisted kinds — the server whitelist admits nothing else.');
});

test('U2 (AC1): buildPlacementOps add-only (element kind) → one add op, parent-first direction (fromUuid = SET)', async () => {
  const mod = await loadEsm(PLACEMENT, PLACEMENT_MISSING);
  assert(typeof mod.buildPlacementOps === 'function', 'placement.js must export buildPlacementOps.');
  const ops = mod.buildPlacementOps({ nodeUuid: 'node-1', destSetUuid: 'set-9', kind: 'element' });
  assert(Array.isArray(ops) && ops.length === 1,
    `an add-only placement must be exactly one op (got ${short(ops)}).`);
  assert(ops[0].op === 'add', `the single op must be an add (got ${short(ops[0])}).`);
  assert(ops[0].fromUuid === 'set-9' && ops[0].toUuid === 'node-1',
    'DIRECTION: fromUuid must be the destination SET and toUuid the node — ' +
    `(from)-[rel]->(to) is parent-first (got from=${short(ops[0].fromUuid)} to=${short(ops[0].toUuid)}).`);
  assert(ops[0].relType === 'HAS_ELEMENT',
    `element-kind placement must use HAS_ELEMENT (got ${short(ops[0].relType)}).`);
});

test('U3 (AC1): buildPlacementOps subset kind → IS_A_SUPERSET_OF, same parent-first direction', async () => {
  const mod = await loadEsm(PLACEMENT, PLACEMENT_MISSING);
  const ops = mod.buildPlacementOps({ nodeUuid: 'n', destSetUuid: 'd', kind: 'subset' });
  assert(ops.length === 1 && ops[0].op === 'add' && ops[0].relType === 'IS_A_SUPERSET_OF'
    && ops[0].fromUuid === 'd' && ops[0].toUuid === 'n',
    `subset-kind placement must be one add of (destSet)-[:IS_A_SUPERSET_OF]->(node) (got ${short(ops)}).`);
});

test('U4 (AC4): buildPlacementOps move → add BEFORE delete (no-orphan), delete carries the SOURCE relType', async () => {
  const mod = await loadEsm(PLACEMENT, PLACEMENT_MISSING);
  const ops = mod.buildPlacementOps({
    nodeUuid: 'n', destSetUuid: 'dest', kind: 'subset',
    source: { setUuid: 'old', relType: 'HAS_ELEMENT' },
  });
  assert(ops.length === 2, `a move must be exactly two ops (got ${short(ops)}).`);
  assert(ops[0].op === 'add' && ops[1].op === 'delete',
    'ORDERING: add must precede delete — the no-orphan invariant caps a partial ' +
    'failure at "node in two places", never zero (ADR decision 1).');
  assert(ops[0].fromUuid === 'dest' && ops[0].toUuid === 'n' && ops[0].relType === 'IS_A_SUPERSET_OF',
    `move's add op must target the destination with the chosen kind (got ${short(ops[0])}).`);
  assert(ops[1].fromUuid === 'old' && ops[1].toUuid === 'n' && ops[1].relType === 'HAS_ELEMENT',
    'move\'s delete op must remove the SOURCE placement with the source\'s own relType ' +
    `— not the new kind (got ${short(ops[1])}).`);
});

test('U5 (AC4 edge): moving a placement onto itself is a NO-OP (empty ops) — add-then-delete of the same edge would destroy it', async () => {
  const mod = await loadEsm(PLACEMENT, PLACEMENT_MISSING);
  const ops = mod.buildPlacementOps({
    nodeUuid: 'n', destSetUuid: 's1', kind: 'element',
    source: { setUuid: 's1', relType: 'HAS_ELEMENT' },
  });
  assert(Array.isArray(ops) && ops.length === 0,
    'same-destination same-kind move must return ZERO ops: add would report ' +
    'already-existed and the delete would then remove the only edge — a silent ' +
    `destruction of the placement being "moved" (got ${short(ops)}).`);
});

test('U6 (AC1 edge): buildPlacementOps rejects an unknown placement kind loudly', async () => {
  const mod = await loadEsm(PLACEMENT, PLACEMENT_MISSING);
  let threw = null;
  try { mod.buildPlacementOps({ nodeUuid: 'n', destSetUuid: 'd', kind: 'sibling' }); }
  catch (e) { threw = e; }
  assert(threw, 'an unknown kind must throw — silently defaulting a relType would write the wrong edge.');
  assert(/sibling/.test(threw.message),
    `the error must name the offending kind (got: ${short(threw.message)}).`);
});

test('U7 (AC1/AC5 edge): filterDestinations — cycle guard excludes self always, descendants for subset kind only', async () => {
  const mod = await loadEsm(PLACEMENT, PLACEMENT_MISSING);
  assert(typeof mod.filterDestinations === 'function', 'placement.js must export filterDestinations.');
  const candidates = [{ uuid: 'self' }, { uuid: 'd1' }, { uuid: 'other' }];
  const forSubset = mod.filterDestinations(candidates, { nodeUuid: 'self', kind: 'subset', descendantUuids: ['d1'] });
  assert(forSubset.length === 1 && forSubset[0].uuid === 'other',
    'subset-kind destinations must exclude the node itself AND its descendants ' +
    `(cycle guard, ADR decision 3) — got ${short(forSubset)}.`);
  const forElement = mod.filterDestinations(candidates, { nodeUuid: 'self', kind: 'element', descendantUuids: ['d1'] });
  assert(forElement.length === 2 && forElement.some(c => c.uuid === 'd1') && forElement.every(c => c.uuid !== 'self'),
    'element-kind destinations must exclude only the node itself — a leaf placement ' +
    `under a descendant set is legal (got ${short(forElement)}).`);
});

/* ── U-class: ui/src/api/relationships.js (EXECUTED, stubbed fetch) ─────── */

async function withFetchStub(responses, fn) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const r = responses.shift() || { status: 200, body: { success: true } };
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    };
  };
  try {
    const value = await fn();
    return { value, calls };
  } finally {
    globalThis.fetch = orig;
  }
}

test('U8 (AC1/AC7): addRelationship POSTs the primitive body and returns the FULL response (result + hazard note)', async () => {
  const mod = await loadEsm(REL_API, REL_API_MISSING);
  assert(typeof mod.addRelationship === 'function', 'relationships.js must export addRelationship.');
  const body = {
    success: true, operation: 'add', result: 'created', relType: 'HAS_ELEMENT',
    from: { uuid: 'd', labels: ['NostrEvent'] }, to: { uuid: 'n', labels: ['NostrEvent'] },
    note: 'HAZARD-NOTE-SENTINEL',
  };
  const { value, calls } = await withFetchStub(
    [{ status: 200, body }],
    () => mod.addRelationship({ fromUuid: 'd', toUuid: 'n', relType: 'HAS_ELEMENT' })
  );
  assert(calls.length === 1, `exactly one HTTP call expected (got ${calls.length}).`);
  assert(calls[0].url === '/api/normalize/add-relationship',
    `must POST to /api/normalize/add-relationship (got ${short(calls[0].url)}).`);
  assert((calls[0].opts.method || '').toUpperCase() === 'POST', 'method must be POST.');
  const sent = JSON.parse(calls[0].opts.body || '{}');
  assert(sent.fromUuid === 'd' && sent.toUuid === 'n' && sent.relType === 'HAS_ELEMENT',
    `request body must be {fromUuid, toUuid, relType} (got ${short(sent)}).`);
  assert(value && value.result === 'created' && value.note === 'HAZARD-NOTE-SENTINEL',
    'helper must return the FULL response body — result and note are load-bearing ' +
    `UI inputs, not throwaway (ADR decision 2). Got ${short(value)}.`);
});

test('U9 (AC8): addRelationship on failure throws Error(data.error) carrying .status and .allowed', async () => {
  const mod = await loadEsm(REL_API, REL_API_MISSING);
  let err403 = null;
  await withFetchStub(
    [{ status: 403, body: { success: false, error: 'Editing relationships requires owner authentication' } }],
    async () => { try { await mod.addRelationship({ fromUuid: 'a', toUuid: 'b', relType: 'HAS_ELEMENT' }); } catch (e) { err403 = e; } }
  );
  assert(err403, 'a 403 {success:false} response must throw.');
  assert(/owner authentication/.test(err403.message),
    `the thrown message must be the server's error text (got: ${short(err403.message)}).`);
  assert(err403.status === 403, `err.status must carry the HTTP status (got ${short(err403.status)}).`);

  let err400 = null;
  await withFetchStub(
    [{ status: 400, body: { success: false, error: 'relType NOPE is not allowed', allowed: ['HAS_ELEMENT', 'IS_A_SUPERSET_OF'] } }],
    async () => { try { await mod.addRelationship({ fromUuid: 'a', toUuid: 'b', relType: 'NOPE' }); } catch (e) { err400 = e; } }
  );
  assert(err400 && Array.isArray(err400.allowed) && err400.allowed.includes('IS_A_SUPERSET_OF'),
    `a 400 whitelist rejection must expose .allowed on the thrown error (got ${short(err400 && err400.allowed)}).`);
});

test('U10 (AC2/AC7): deleteRelationship POSTs to delete-relationship and returns result + note untouched', async () => {
  const mod = await loadEsm(REL_API, REL_API_MISSING);
  assert(typeof mod.deleteRelationship === 'function', 'relationships.js must export deleteRelationship.');
  const { value, calls } = await withFetchStub(
    [{ status: 200, body: { success: true, operation: 'delete', result: 'deleted', deletedCount: 1, relType: 'IS_A_SUPERSET_OF', from: {}, to: {}, note: 'HAZARD-NOTE-SENTINEL' } }],
    () => mod.deleteRelationship({ fromUuid: 's', toUuid: 'n', relType: 'IS_A_SUPERSET_OF' })
  );
  assert(calls[0].url === '/api/normalize/delete-relationship',
    `must POST to /api/normalize/delete-relationship (got ${short(calls[0].url)}).`);
  assert(value.result === 'deleted' && value.note === 'HAZARD-NOTE-SENTINEL',
    `full-body return required for delete too (got ${short(value)}).`);
});

/* ── S-class: source assertions over the dialog + three pages ──────────── */

test('S1 (AC1/AC7/AC8): PlacementDialog exists, wires the pure core + client, and surfaces note / no-change / partial-failure', () => {
  const src = safeRead(DIALOG);
  assert(src.length > 0,
    'ui/src/components/PlacementDialog.jsx does not exist yet — the shared dialog (ADR Option A) is not implemented.');
  assert(/from\s+['"][./]*\.\.\/utils\/placement/.test(src),
    'PlacementDialog must import from ui/src/utils/placement.js — the direction/ordering logic lives in the pure core, never inline.');
  assert(/from\s+['"][./]*\.\.\/api\/relationships/.test(src),
    'PlacementDialog must import the client helpers from ui/src/api/relationships.js.');
  assert(/buildPlacementOps/.test(src), 'PlacementDialog must build its ops via buildPlacementOps.');
  assert(/addRelationship/.test(src) && /deleteRelationship/.test(src),
    'PlacementDialog must execute ops via addRelationship/deleteRelationship.');
  assert(/['"]intoSet['"]/.test(src) && /['"]forNode['"]/.test(src),
    'PlacementDialog must support both modes: intoSet (destination fixed) and forNode (node fixed).');
  assert(/\.note\b/.test(src) && /health-banner/.test(src),
    'PlacementDialog must surface the server hazard note in a banner — never suppress it (epic guardrail).');
  assert(/already-existed/.test(src),
    'PlacementDialog must handle already-existed as a neutral no-change outcome (ADR decision 5).');
  assert(/both/i.test(src),
    'PlacementDialog must carry the partial-failure message for a move whose delete failed after the add ' +
    '— the node is now in BOTH places and the user must be told (ADR consequences).');
});

test('S2 (AC1/AC6): SetDetail — owner-gated "Add to this set" opening PlacementDialog intoSet, refetch-based refresh', () => {
  const src = safeRead(SET_DETAIL);
  assert(src.length > 0, 'SetDetail.jsx missing — unexpected.');
  assert(/AuthContext/.test(src) && /classification/.test(src),
    'SetDetail must gate the new affordances on the owner/admin classification (the ElementDetail.jsx:19 pattern).');
  assert(/PlacementDialog/.test(src), 'SetDetail must mount the shared PlacementDialog.');
  assert(/['"]intoSet['"]/.test(src), 'SetDetail opens the dialog in intoSet mode (destination fixed to this set).');
  assert(/Add to this set/i.test(src), 'SetDetail must offer the "add a node to this set…" affordance (AC1).');
  assert(/onChanged/.test(src) && /refetch/.test(src),
    'SetDetail must refresh via useCypher refetches on onChanged — "without a full page reload" (AC1).');
});

test('S3 (AC2): SetDetail — direct-placement flag in the elements query; removes confirmed, direct-only, non-navigating', () => {
  const src = safeRead(SET_DETAIL);
  assert(/EXISTS\s*\{/.test(src) && /AS\s+direct\b/.test(src),
    'SetDetail\'s elements query must gain a per-row EXISTS { … } AS direct flag — ' +
    'indirect rows (elements of descendant sets) must be distinguishable (AC2 / ADR decision 4).');
  assert(/deleteRelationship\(/.test(src),
    'SetDetail must remove placements via the deleteRelationship client helper.');
  assert(/ConfirmDialog/.test(src),
    'removes must be behind a confirmation (AC2: "with confirmation").');
  assert(/stopPropagation/.test(src),
    'the remove control sits in a clickable row — it must stopPropagation against the row\'s navigate.');
});

test('S4 (AC3/AC4): ElementDetail — Placements section (direct parents + rel type), Move/Add affordances with source', () => {
  const src = safeRead(ELEMENT_DETAIL);
  assert(src.length > 0, 'ElementDetail.jsx missing — unexpected.');
  assert(/\[r:HAS_ELEMENT\|IS_A_SUPERSET_OF\]/.test(src) && /type\(r\)/.test(src),
    'ElementDetail must query the node\'s direct parents across BOTH placement kinds ' +
    'and return the relationship type (AC3; today the page shows no placements at all).');
  assert(/Placements/i.test(src), 'ElementDetail must render a Placements section (AC3).');
  assert(/PlacementDialog/.test(src) && /['"]forNode['"]/.test(src),
    'ElementDetail opens the shared dialog in forNode mode (node fixed).');
  assert(/Move/.test(src) && /Add placement/i.test(src),
    'ElementDetail must offer per-placement "Move…" and a source-less "Add placement…" (AC4).');
  assert(/source/.test(src),
    'the Move affordance must pass the specific source placement — a multi-parent node moves ONE edge, not all.');
});

test('S5 (AC5/AC6): ConceptDag — owner-gated per-row Place/move affordance in forNode mode', () => {
  const src = safeRead(CONCEPT_DAG);
  assert(src.length > 0, 'ConceptDag.jsx missing — unexpected.');
  assert(/AuthContext/.test(src) && /classification/.test(src),
    'ConceptDag must gate the new per-row affordance on owner/admin classification (AC6).');
  assert(/PlacementDialog/.test(src) && /['"]forNode['"]/.test(src),
    'ConceptDag mounts the shared dialog in forNode mode for the row\'s node (AC5).');
  assert(/Place/.test(src) && /move/i.test(src),
    'ConceptDag rows must offer the place/move affordance (AC5).');
});

/* ── H-class: live query-semantics SENTINELS (SKIP when stack absent) ──── */

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], {
    encoding: 'utf8',
    timeout: 60000,
  });
}

function loopbackPost(pathname, body) {
  const out = dockerCurl([
    '-s', '-m', '30', '-X', 'POST', `${CONTAINER_BASE}${pathname}`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body),
    '-w', '\n__STATUS__%{http_code}',
  ]);
  const idx = out.lastIndexOf('\n__STATUS__');
  const status = idx === -1 ? 0 : parseInt(out.slice(idx + 11), 10);
  const raw = idx === -1 ? out : out.slice(0, idx);
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  return { status, json, raw };
}

function loopbackCypher(cypher, params = {}) {
  const { status, json, raw } = loopbackPost('/api/neo4j/query', { cypher, params });
  if (status !== 200 || !json || json.success !== true) {
    throw new Error(`fixture Cypher via loopback /api/neo4j/query failed: status=${status} body=${short(json || raw)}`);
  }
  return json.data || [];
}

let _stack = null;
function stackReady() {
  if (_stack !== null) return _stack;
  try { loopbackCypher('RETURN 1 AS ok'); _stack = true; }
  catch { _stack = false; }
  return _stack;
}

// Fixture DAG: A -[:HAS_ELEMENT]-> B (direct), A -[:IS_A_SUPERSET_OF]-> M,
// M -[:HAS_ELEMENT]-> C (so C is an INDIRECT element of A).
const FIX = `test-gcui-${process.pid}-${Date.now()}`;
const FX = { a: `${FIX}-a`, m: `${FIX}-m`, b: `${FIX}-b`, c: `${FIX}-c` };
let fixturesUp = false;

function setupFixtures() {
  if (fixturesUp) return;
  loopbackCypher(
    'CREATE (a:NostrEvent {uuid: $a, name: "gcui-A"}), (m:NostrEvent {uuid: $m, name: "gcui-M"}), ' +
    '(b:NostrEvent {uuid: $b, name: "gcui-B"}), (c:NostrEvent {uuid: $c, name: "gcui-C"}) ' +
    'WITH a, m, b, c ' +
    'CREATE (a)-[:HAS_ELEMENT]->(b), (a)-[:IS_A_SUPERSET_OF]->(m), (m)-[:HAS_ELEMENT]->(c)',
    FX
  );
  fixturesUp = true;
}

function teardownFixtures() {
  if (!fixturesUp) return;
  try {
    loopbackCypher('MATCH (n) WHERE n.uuid IN $uuids DETACH DELETE n', { uuids: Object.values(FX) });
  } catch (e) {
    console.log(`      (fixture teardown failed — clean manually: uuids prefix ${FIX}: ${e.message})`);
  }
  fixturesUp = false;
}

test('H1 (sentinel, AC2): the EXISTS direct-placement flag distinguishes direct vs chain-inherited elements in real Neo4j', () => {
  if (!stackReady()) return 'SKIP';
  setupFixtures();
  const rows = loopbackCypher(
    'MATCH (s:NostrEvent {uuid: $a})-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(elem) ' +
    'WITH DISTINCT s, elem ' +
    'RETURN elem.uuid AS uuid, EXISTS { MATCH (s)-[:HAS_ELEMENT]->(elem) } AS direct',
    { a: FX.a }
  );
  const byUuid = Object.fromEntries(rows.map(r => [r.uuid, r.direct]));
  assert(byUuid[FX.b] === true,
    `B is a DIRECT element of A — the EXISTS flag must be true (rows: ${short(rows)}).`);
  assert(byUuid[FX.c] === false,
    `C hangs off descendant set M — the EXISTS flag must be false, so the UI ` +
    `offers no remove on an edge this set does not own (rows: ${short(rows)}).`);
});

test('H2 (sentinel, AC3): the direct-parents query returns each parent with its relationship type', () => {
  if (!stackReady()) return 'SKIP';
  setupFixtures();
  const parentsOfC = loopbackCypher(
    'MATCH (p)-[r:HAS_ELEMENT|IS_A_SUPERSET_OF]->(e:NostrEvent {uuid: $u}) ' +
    'RETURN p.uuid AS parent, type(r) AS relType',
    { u: FX.c }
  );
  assert(parentsOfC.length === 1 && parentsOfC[0].parent === FX.m && parentsOfC[0].relType === 'HAS_ELEMENT',
    `C's one direct parent is M via HAS_ELEMENT (got ${short(parentsOfC)}).`);
  const parentsOfM = loopbackCypher(
    'MATCH (p)-[r:HAS_ELEMENT|IS_A_SUPERSET_OF]->(e:NostrEvent {uuid: $u}) ' +
    'RETURN p.uuid AS parent, type(r) AS relType',
    { u: FX.m }
  );
  assert(parentsOfM.length === 1 && parentsOfM[0].parent === FX.a && parentsOfM[0].relType === 'IS_A_SUPERSET_OF',
    `M's one direct parent is A via IS_A_SUPERSET_OF (got ${short(parentsOfM)}).`);
});

/* ── R-class: regression sentinels (pass before AND after) ─────────────── */

test('R1: SetDetail keeps its three read queries (supersets, subsets, chain-elements)', () => {
  const src = safeRead(SET_DETAIL);
  assert(/\(parent\)-\[:IS_A_SUPERSET_OF\]->/.test(src),
    'SetDetail must keep the direct-supersets query.');
  assert(/-\[:IS_A_SUPERSET_OF\]->\(child\)/.test(src),
    'SetDetail must keep the direct-subsets query.');
  assert(/IS_A_SUPERSET_OF\*0\.\.10/.test(src) && /HAS_ELEMENT/.test(src),
    'SetDetail must keep the chain-elements query (direct + indirect display is unchanged; AC2 only adds the flag).');
});

test('R2: ConceptDag keeps the DAG walk and the New Set / New Element buttons', () => {
  const src = safeRead(CONCEPT_DAG);
  assert(/IS_THE_CONCEPT_FOR/.test(src) && /IS_A_SUPERSET_OF\*0\.\.10/.test(src),
    'ConceptDag must keep the superset walk query.');
  assert(/New Set/.test(src) && /New Element/.test(src),
    'ConceptDag must keep the existing creation buttons — this story adds placement, it does not touch creation.');
});

test('R3: ElementDetail keeps the schema-scoped JSON editing flow (save-element-json)', () => {
  const src = safeRead(ELEMENT_DETAIL);
  assert(/save-element-json/.test(src),
    'ElementDetail must keep the existing JSON editor wiring untouched.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- move-nodes-between-sets-ui tests (epic graph-curation-ui, Story 1) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
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
  } finally {
    teardownFixtures();
  }
  console.log(`\nmove-nodes-between-sets-ui: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
