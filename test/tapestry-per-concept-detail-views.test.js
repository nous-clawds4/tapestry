/**
 * tapestries #4 — Per-concept detail views (Firmware-Explorer parity), Neo4j + LMDB read path.
 *
 * Story: engineering-team/stories/tapestries/4-per-concept-detail-views.md
 * ADR:   engineering-team/decisions/tapestries/0004-per-concept-detail-views-neo4j-lmdb.md
 *
 * This suite is the BINDING (stack-free) gate — the Node runner. Test classes
 * (conventions per test/firmware-concept-elements-sets.test.js):
 *
 *   U-class (EXECUTED, stack-free, gates CI) — the CommonJS server helper
 *     src/lib/conceptCoreNodes.js, required directly (neo4j-driver connects lazily, so
 *     requiring the helper does not open a connection). Covers the CRUX of the ontology:
 *     node JSON is read from Tapestry LMDB (an 'lmdb:<key>' value resolves through the
 *     store) OR inline (a JSON string parses; an object passes through), the {nodes} shape,
 *     and found:false when the header handle matches no node. runCypher + resolveValue are
 *     INJECTED (deps arg) so no stack is touched.
 *
 *   S-class (source assertions, stack-free) — the endpoint registration, the firmware
 *     rewire onto the shared helper, the extracted shared UI module, and the TapestryDetail
 *     per-concept view wiring exist and match the ADR. Source-level because the harness has
 *     no jsdom (deliberate; mirrors create-tapestry.test.js S-class).
 *
 *   H-class (integration SENTINELS — SKIP when the stack/endpoint is unreachable) — against
 *     the real `dog` concept in Neo4j, the live endpoint returns the schema + primary-property
 *     core nodes (data that is NOT in the tapestry's authored strfry block — proving Neo4j is
 *     the source), and the rewired firmware endpoint stays behavior-identical. NOTE: the local
 *     Docker stack serves the SHARED checkout, not this worktree, so these SKIP locally and
 *     bind on staging (cycle-staging smoke) once the code is deployed — same as create-tapestry's
 *     Playwright spec.
 *
 *   R-class (regression sentinels, stack-free) — the Firmware Explorer keeps its core-node
 *     tabs / Elements-Sets / Integrations after the component extraction, and TapestryDetail
 *     keeps its tapestry-level Integrations section (AC6). PASS before AND after.
 *
 * U1-U7 and S1-S8 FAIL until the feature lands. H1-H3 SKIP until a stack serves the code.
 * R1-R2 PASS throughout. That is the point.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Server
const HELPER   = path.join(ROOT, 'src/lib/conceptCoreNodes.js');       // NEW: the shared read helper
const CG_INDEX = path.join(ROOT, 'src/api/concept-graph/index.js');    // + GET /node/:handle/core-nodes
const FW_INDEX = path.join(ROOT, 'src/api/firmware/index.js');         // rewired onto the helper
// Client / UI
const CLIENT   = path.join(ROOT, 'ui/src/api/conceptCoreNodes.js');    // NEW: fetchConceptCoreNodes
const CORE_VIEWS = path.join(ROOT, 'ui/src/components/concept/CoreNodeViews.jsx'); // NEW shared module
const FE       = path.join(ROOT, 'ui/src/pages/settings/FirmwareExplorer.jsx');
const TD       = path.join(ROOT, 'ui/src/pages/tapestries/TapestryDetail.jsx');

const PORT = process.env.TAPESTRY_PORT || process.env.TAPESTRY_CONTAINER_PORT || '7778';
const BASE = `http://127.0.0.1:${PORT}`;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 240) { const s = typeof x === 'string' ? x : JSON.stringify(x); return s == null ? String(s) : s.slice(0, n); }

const HELPER_MISSING =
  'src/lib/conceptCoreNodes.js does not exist yet — the shared Neo4j+LMDB core-node read helper ' +
  '(ADR tapestries/0004, Implementation notes) is not implemented.';

function loadHelper() {
  assert(fs.existsSync(HELPER), HELPER_MISSING);
  delete require.cache[require.resolve(HELPER)];
  try { return require(HELPER); }
  catch (e) { throw new Error(`src/lib/conceptCoreNodes.js exists but failed to require (must load stack-free — lazy-connect the driver): ${e.message}`); }
}

// A full Cypher row shaped like the firmware endpoint's RETURN aliases (src/api/firmware/index.js:234-241).
function fullRow(overrides = {}) {
  return {
    headerUuid: '39998:TA:dog', headerName: 'dog', headerJson: '{"word":{"name":"dog"}}',
    supersetUuid: '39999:TA:dog-superset', supersetName: 'dogs', supersetJson: '{"set":{"name":"dogs"}}',
    schemaUuid: '39999:TA:dog-schema', schemaName: 'dog schema', schemaJson: '{"$schema":"x"}',
    ppUuid: '39999:TA:dog-primary-property', ppName: 'dog pp', ppJson: '{"pp":1}',
    propsUuid: '39999:TA:dog-properties', propsName: 'dog props', propsJson: '{"props":1}',
    ptgUuid: '39999:TA:dog-property-tree-graph', ptgName: 'dog ptg', ptgJson: '{"ptg":1}',
    cgUuid: '39999:TA:dog-core-nodes-graph', cgName: 'dog cg', cgJson: '{"cg":1}',
    cogUuid: '39999:TA:dog-concept-graph', cogName: 'dog cog', cogJson: '{"cog":1}',
    ...overrides,
  };
}

/* ── U-class: the crux — JSON coercion, LMDB resolution, {nodes} shape, found ─── */

test('U1 (AC3: inline JSON): coerceJson parses an inline JSON string into an object', () => {
  const mod = loadHelper();
  assert(typeof mod.coerceJson === 'function', 'conceptCoreNodes.js must export coerceJson.');
  const out = mod.coerceJson('{"a":1,"b":[2]}');
  assert(out && typeof out === 'object' && out.a === 1 && Array.isArray(out.b),
    `an inline JSON string must parse to an object (got ${short(out)}).`);
});

test('U2 (AC3: LMDB object): coerceJson passes an object through unchanged (LMDB envelope.data form)', () => {
  const mod = loadHelper();
  const obj = { already: 'parsed' };
  assert(mod.coerceJson(obj) === obj,
    'the LMDB store returns envelope.data as an OBJECT; coerceJson must pass objects through, not re-parse them.');
});

test('U3 (AC5: missing JSON): coerceJson returns null for null / empty', () => {
  const mod = loadHelper();
  assert(mod.coerceJson(null) === null && mod.coerceJson('') === null && mod.coerceJson(undefined) === null,
    'a node with no JSON tag must coerce to null (drives the "no JSON" / degraded states).');
});

test('U4 (AC1: shape): shapeCoreNodes maps a Cypher row to all 8 core nodes, each {uuid,name,json}', () => {
  const mod = loadHelper();
  assert(typeof mod.shapeCoreNodes === 'function', 'conceptCoreNodes.js must export shapeCoreNodes(row, resolve).');
  const nodes = mod.shapeCoreNodes(fullRow());
  const keys = ['header', 'superset', 'schema', 'primaryProperty', 'properties', 'ptGraph', 'coreGraph', 'conceptGraph'];
  for (const k of keys) {
    assert(nodes[k], `nodes.${k} must be present (the 8 firmware core-node types).`);
    assert('uuid' in nodes[k] && 'name' in nodes[k] && 'json' in nodes[k],
      `nodes.${k} must be {uuid,name,json} (got ${short(nodes[k])}).`);
  }
  assert(nodes.schema.uuid === '39999:TA:dog-schema' && nodes.schema.json && nodes.schema.json.$schema === 'x',
    'the schema core node must carry its uuid and its parsed JSON — this is data strfry does NOT have.');
  assert(nodes.header.json && nodes.header.json.word && nodes.header.json.word.name === 'dog',
    'header JSON (an inline string) must be parsed to an object.');
});

test('U5 (AC3 CRUX: JSON from LMDB): an "lmdb:<key>" node value is resolved through the store', () => {
  const mod = loadHelper();
  // Simulate an offloaded value: schemaJson is an lmdb pointer; resolve maps it to the stored object.
  const resolved = { fromLmdb: true, $schema: 'resolved' };
  const fakeResolve = (v) => (v === 'lmdb:SCHEMA_KEY' ? resolved : v);
  const nodes = mod.shapeCoreNodes(fullRow({ schemaJson: 'lmdb:SCHEMA_KEY' }), fakeResolve);
  assert(nodes.schema.json && nodes.schema.json.fromLmdb === true && nodes.schema.json.$schema === 'resolved',
    'a node whose json tag is an "lmdb:<key>" pointer MUST be resolved from Tapestry LMDB (the ontology requirement), ' +
    `not returned as the raw pointer string (got ${short(nodes.schema.json)}).`);
  // A non-pointer sibling still parses normally through the same resolve pass.
  assert(nodes.header.json && nodes.header.json.word,
    'inline (non-pointer) siblings must still parse when a resolve function is supplied.');
});

test('U6 (AC5: not in graph): getConceptCoreNodes returns found:false when the header matches no node', async () => {
  const mod = loadHelper();
  assert(typeof mod.getConceptCoreNodes === 'function', 'conceptCoreNodes.js must export getConceptCoreNodes(headerUuid, deps?).');
  const out = await mod.getConceptCoreNodes('39998:TA:nope-not-here', { runCypher: async () => [] });
  assert(out && out.found === false, `an unknown header handle must yield {found:false} (got ${short(out)}).`);
  assert(out.nodes && Object.keys(out.nodes).length === 0, 'found:false must carry an empty nodes map (nothing to render).');
});

test('U7 (AC3: neo4j-keyed): getConceptCoreNodes runs a header-uuid-PARAM query and shapes+resolves the row', async () => {
  const mod = loadHelper();
  const handle = '39998:TA:dog';
  const calls = [];
  const runCypher = async (cypher, params) => { calls.push({ cypher, params }); return [fullRow({ schemaJson: 'lmdb:K' })]; };
  const resolveValue = (v) => (v === 'lmdb:K' ? { viaStore: true } : v);
  const out = await mod.getConceptCoreNodes(handle, { runCypher, resolveValue });
  assert(calls.length === 1, `exactly one Cypher read expected (got ${calls.length}).`);
  assert(calls[0].params && calls[0].params.uuid === handle,
    `the header handle must ride as the $uuid PARAM (got params ${short(calls[0].params)}).`);
  assert(!calls[0].cypher.includes(handle),
    'the handle must NOT be interpolated into the Cypher text — it travels as $uuid.');
  assert(/IS_THE_JSON_SCHEMA_FOR/.test(calls[0].cypher) && /IS_THE_PRIMARY_PROPERTY_FOR/.test(calls[0].cypher) &&
         /IS_THE_PROPERTIES_SET_FOR/.test(calls[0].cypher) && /IS_THE_CONCEPT_GRAPH_FOR/.test(calls[0].cypher),
    'the query must traverse the core-node relationships (relationships come from neo4j directly, per the ontology).');
  assert(out.found === true && out.nodes.schema.json && out.nodes.schema.json.viaStore === true,
    'the returned schema JSON must be the LMDB-resolved object (found:true, resolved via the injected store).');
});

/* ── S-class: source assertions — endpoint, firmware rewire, shared UI, TD wiring ── */

test('S1 (AC1: endpoint): concept-graph API registers GET /node/:handle/core-nodes → getConceptCoreNodes', () => {
  const src = safeRead(CG_INDEX);
  assert(src.length > 0, 'src/api/concept-graph/index.js missing — unexpected.');
  assert(/node\/:handle\/core-nodes/.test(src),
    'concept-graph API must register the handle-keyed route "/api/concept-graph/node/:handle/core-nodes".');
  assert(/getConceptCoreNodes/.test(src) && /conceptCoreNodes/.test(src),
    'the route must delegate to getConceptCoreNodes from the shared helper (no inline core-node query in the router).');
});

test('S2 (AC3: JSON from LMDB): the helper resolves values through tapestry-resolve', () => {
  const src = safeRead(HELPER);
  assert(src.length > 0, HELPER_MISSING);
  assert(/tapestry-resolve/.test(src) && /resolveValue/.test(src),
    'conceptCoreNodes.js must route node JSON through resolveValue (src/lib/tapestry-resolve.js) — "JSON from Tapestry LMDB".');
});

test('S3 (ADR Decision 2: DRY rewire): firmware concept endpoint calls the shared helper, not an inline core-node query', () => {
  const src = safeRead(FW_INDEX);
  assert(src.length > 0, 'src/api/firmware/index.js missing — unexpected.');
  assert(/getConceptCoreNodes/.test(src) && /conceptCoreNodes/.test(src),
    'the firmware concept endpoint must be rewired onto getConceptCoreNodes (share & rewire — the approved choice).');
  // The 8-relationship OPTIONAL MATCH must now live in the helper, not inline in the firmware router.
  const inlineChain = /IS_THE_PROPERTIES_SET_FOR[\s\S]*IS_THE_PROPERTY_TREE_GRAPH_FOR[\s\S]*IS_THE_CORE_GRAPH_FOR/.test(src);
  assert(!inlineChain,
    'the inline 8-core-node OPTIONAL MATCH must be MOVED to the shared helper (one copy of the query, per ADR Decision 2).');
});

test('S4 (AC1: shared UI): CoreNodeViews module exports ConceptOverview, ConceptNodeJson, CORE_NODES', () => {
  const src = safeRead(CORE_VIEWS);
  assert(src.length > 0,
    'ui/src/components/concept/CoreNodeViews.jsx does not exist yet — the extracted per-concept view pieces are not implemented.');
  assert(/export\s+(function|const)\s+ConceptOverview/.test(src) || /export\s*\{[^}]*ConceptOverview/.test(src),
    'CoreNodeViews.jsx must export ConceptOverview (extracted from FirmwareExplorer FirmwareOverview).');
  assert(/export\s+(function|const)\s+ConceptNodeJson/.test(src) || /export\s*\{[^}]*ConceptNodeJson/.test(src),
    'CoreNodeViews.jsx must export ConceptNodeJson (extracted from FirmwareExplorer FirmwareNodeJson).');
  assert(/export\s+const\s+CORE_NODES/.test(src) || /export\s*\{[^}]*CORE_NODES/.test(src),
    'CoreNodeViews.jsx must export the CORE_NODES tab list.');
  assert(/JsonView/.test(src), 'the extracted core-node JSON view must reuse JsonView (Viewer mode) — not re-implement a tree.');
});

test('S5 (Decision 3: FE de-duped): FirmwareExplorer imports the shared views instead of defining them inline', () => {
  const src = safeRead(FE);
  assert(/from\s+['"][^'"]*components\/concept\/CoreNodeViews['"]/.test(src),
    'FirmwareExplorer must import ConceptOverview/ConceptNodeJson/CORE_NODES from the shared CoreNodeViews module.');
  assert(!/function\s+FirmwareOverview\s*\(/.test(src) && !/function\s+FirmwareNodeJson\s*\(/.test(src),
    'the inline FirmwareOverview / FirmwareNodeJson definitions must be REMOVED from FirmwareExplorer (extracted to the shared module).');
});

test('S6 (AC1/AC4: TD per-concept view): TapestryDetail mounts the core-node views + ConceptMembersView with a tab bar', () => {
  const src = safeRead(TD);
  assert(src.length > 0, 'ui/src/pages/tapestries/TapestryDetail.jsx missing — unexpected.');
  assert(/fetchConceptCoreNodes/.test(src),
    'TapestryDetail must fetch per-concept data via fetchConceptCoreNodes (the new Neo4j+LMDB read).');
  assert(/ConceptOverview/.test(src) && /ConceptNodeJson/.test(src),
    'the selected concept must render the shared ConceptOverview + ConceptNodeJson core-node views.');
  assert(/ConceptMembersView/.test(src),
    'Elements & Sets must reuse the existing ConceptMembersView (imported from settings/ConceptMembersView).');
  assert(/CORE_NODES/.test(src) && /elements/.test(src) && /sets/.test(src),
    'the per-concept view must offer the Overview + core-node tabs plus Elements and Sets.');
});

test('S7 (AC1: client API): fetchConceptCoreNodes GETs the handle-keyed core-nodes endpoint', () => {
  const src = safeRead(CLIENT);
  assert(src.length > 0,
    'ui/src/api/conceptCoreNodes.js does not exist yet — the client fetch for the new endpoint is not implemented.');
  assert(/export\s+(async\s+)?function\s+fetchConceptCoreNodes|export\s+const\s+fetchConceptCoreNodes/.test(src),
    'conceptCoreNodes.js (client) must export fetchConceptCoreNodes.');
  assert(/core-nodes/.test(src) && /concept-graph\/node/.test(src),
    'fetchConceptCoreNodes must call /api/concept-graph/node/<handle>/core-nodes.');
});

test('S8 (AC3: source of truth = neo4j, not the authored event): TD keys per-concept detail on the member handle', () => {
  const src = safeRead(TD);
  // The old per-concept detail rendered the strfry IMPORT graph JSON (match.graph). The new detail
  // must instead fetch by the member's neo4j handle (concept uuid), proving the data is from the graph.
  assert(/fetchConceptCoreNodes\(\s*[^)]*(uuid|handle)/.test(src),
    'the per-concept detail must be fetched by the member concept HANDLE (its 39998:<TA>:<slug> uuid) — the neo4j read, ' +
    'not the tapestry event\'s authored import JSON.');
  assert(!/JsonPanel\s+data=\{\s*match\.graph/.test(src),
    'the old import-graph-JSON-only per-concept view (match.graph) must be replaced by the Neo4j+LMDB core-node views.');
});

/* ── H-class: live sentinels (SKIP when the stack/endpoint is unreachable) ─────── */

async function getJson(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  } catch { return { status: 0, json: null }; }
}
let _ta = undefined;
async function taPubkey() {
  if (_ta !== undefined) return _ta;
  const { json } = await getJson(`${BASE}/api/assistant/pubkey`);
  _ta = json && json.pubkey ? json.pubkey : null;
  return _ta;
}
async function endpointLive() {
  // The new endpoint on a reachable stack that has the code. Any transport failure → not live.
  const ta = await taPubkey();
  if (!ta) return null;
  const url = `${BASE}/api/concept-graph/node/${encodeURIComponent(`39998:${ta}:dog`)}/core-nodes`;
  const { status, json } = await getJson(url);
  if (status !== 200 || !json || json.success !== true) return null; // core not built / stack absent → SKIP
  return { ta, dog: json };
}

test('H1 (AC3 live): the endpoint returns schema + primary-property core nodes for `dog` (data strfry lacks)', async () => {
  const live = await endpointLive();
  if (!live) return 'SKIP';
  const n = live.dog.nodes || {};
  assert(live.dog.found === true, `dog is a real concept — found must be true (got ${short(live.dog)}).`);
  assert(n.schema && n.schema.json, 'the schema core node + its JSON must be present — sourced from neo4j+LMDB, not the strfry skeleton.');
  assert(n.primaryProperty && n.primaryProperty.json, 'the primary-property core node + its JSON must be present.');
});

test('H2 (regression: rewire behavior-identical): firmware /concept/dog matches the core-nodes endpoint for the same core nodes', async () => {
  const live = await endpointLive();
  if (!live) return 'SKIP';
  const { status, json: fw } = await getJson(`${BASE}/api/firmware/concept/dog`);
  if (status !== 200 || !fw || fw.success !== true || !fw.installed) return 'SKIP';
  const a = live.dog.nodes || {}, b = fw.nodes || {};
  assert(a.schema && b.schema && a.schema.uuid === b.schema.uuid,
    `the rewired firmware endpoint and the new endpoint must resolve the SAME schema node for dog ` +
    `(new=${short(a.schema && a.schema.uuid)} firmware=${short(b.schema && b.schema.uuid)}).`);
  assert(a.header && b.header && a.header.uuid === b.header.uuid, 'both endpoints must resolve the same header node.');
});

test('H3 (AC5 live): a handle with no matching node yields found:false (graceful)', async () => {
  const ta = await taPubkey();
  if (!ta) return 'SKIP';
  const url = `${BASE}/api/concept-graph/node/${encodeURIComponent(`39998:${ta}:definitely-not-a-concept-zzz`)}/core-nodes`;
  const { status, json } = await getJson(url);
  if (status !== 200 || !json || json.success !== true) return 'SKIP'; // endpoint not built → SKIP
  assert(json.found === false, `an unknown concept handle must return found:false (got ${short(json)}).`);
});

/* ── R-class: regression sentinels (pass before AND after) ─────────────────────── */

test('R1: FirmwareExplorer keeps its per-concept core-node tabs, Elements/Sets, and Integrations', () => {
  const src = safeRead(FE);
  assert(/CORE_NODES/.test(src) && /Concept Header/.test(src) && /Superset/.test(src),
    'the per-concept core-node tabs must survive the extraction.');
  assert(/ConceptMembersView/.test(src) && /INTEGRATION_TYPES/.test(src) && /Integration Graph/.test(src),
    'the Elements/Sets views and the manifest-level Integrations section must remain intact on the firmware page.');
});

test('R2 (AC6): TapestryDetail keeps its tapestry-level Integrations section', () => {
  const src = safeRead(TD);
  assert(/TapestryIntegrationGraph/.test(src) && /Enumerations/.test(src) && /Subsets/.test(src),
    'the tapestry-level Integration views (graph / enumerations / elements / subsets / JSON) must remain — ' +
    'this story enriches the per-concept drill-down, it does not remove the integration section.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- tapestry-per-concept-detail-views tests (epic tapestries, Story 4) ---');
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
  console.log(`\ntapestry-per-concept-detail-views: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
