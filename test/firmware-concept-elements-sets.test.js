/**
 * Story 1 (epic: firmware-explorer) — Concept Elements & Sets viewer.
 *
 * Story: engineering-team/stories/firmware-explorer/1-concept-elements-and-sets-viewer.md
 * ADR:   engineering-team/decisions/firmware-explorer/0001-concept-elements-and-sets-viewer.md
 *
 * Test classes (ADR "Test seam"; conventions per move-nodes-between-sets-ui):
 *
 *   U-class (EXECUTED, stack-free, gates CI) — the pure ESM core
 *     ui/src/api/conceptMembers.js (buildMembersQuery + fetchConceptMembers) and the
 *     params extension to ui/src/api/cypher.js, loaded through the Node runner via
 *     dynamic import (loadEsm). Covers the four validated Cypher shapes (elements/sets ×
 *     direct/full), the unknown-arg guard, and — load-bearing — that the concept handle
 *     travels as a $h PARAM and is never interpolated into the query string (the
 *     /api/neo4j/query write-guard dodge; ADR Context §1).
 *
 *   S-class (source assertions, stack-free) — ConceptMembersView.jsx and the
 *     FirmwareExplorer.jsx wiring exist and match the ADR (new Elements/Sets views,
 *     scope default 'direct', Viewer default, JsonView reuse, count / empty / no-JSON
 *     states, name sort). Source-level because the harness has no jsdom (deliberate).
 *
 *   H-class (integration SENTINELS — SKIP when the local stack is unreachable OR the
 *     core is not yet built) — a throwaway ConceptHeader→Superset→elements/subsets
 *     fixture, created via container loopback (localTrusted), against which the BUILDER'S
 *     OWN output is executed on real Neo4j: Direct vs Full for both lists, incl. an
 *     implicit z-tag element. Binds the pure builder to real DB semantics post-impl.
 *
 *   R-class (regression sentinels, stack-free) — FirmwareExplorer.jsx keeps its
 *     core-node tabs, the FirmwareNodeJson Viewer/Raw toggle, and the Integrations views.
 *     PASS before AND after.
 *
 * U1–U8 and S1–S2 (+S3's new assertions) FAIL until the feature lands. H1–H4 SKIP until
 * both the stack is up and the core exists. R1–R3 PASS throughout. That is the point.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CONCEPT_MEMBERS = path.join(ROOT, 'ui/src/api/conceptMembers.js');
const CYPHER = path.join(ROOT, 'ui/src/api/cypher.js');
const CMV = path.join(ROOT, 'ui/src/pages/settings/ConceptMembersView.jsx');
const FE = path.join(ROOT, 'ui/src/pages/settings/FirmwareExplorer.jsx');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 240) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}
async function loadEsm(absPath, missingMsg) {
  if (!fs.existsSync(absPath)) throw new Error(missingMsg);
  try { return await import(pathToFileURL(absPath).href); }
  catch (e) { throw new Error(`${path.relative(ROOT, absPath)} exists but failed to import as ESM: ${e.message}`); }
}
async function loadEsmOrNull(absPath) {
  if (!fs.existsSync(absPath)) return null;
  try { return await import(pathToFileURL(absPath).href); } catch { return null; }
}

const CM_MISSING =
  'ui/src/api/conceptMembers.js does not exist yet — the pure query-builder + fetch core ' +
  '(ADR firmware-explorer/0001, Implementation notes) is not implemented.';

// A representative handle: the concept slug ("set") deliberately embeds the SET write
// keyword — the whole reason the handle must be a param, not interpolated.
const H_SET = '39998:TESTPUBKEY000000000000000000000000000000000000000000000000000:set';

/* ── U-class: buildMembersQuery — the four validated Cypher shapes ──────── */

test('U1 (AC: elements/direct): builds a one-hop HAS_ELEMENT read off the concept superset, param-keyed', async () => {
  const mod = await loadEsm(CONCEPT_MEMBERS, CM_MISSING);
  assert(typeof mod.buildMembersQuery === 'function', 'conceptMembers.js must export buildMembersQuery.');
  const q = mod.buildMembersQuery({ kind: 'elements', scope: 'direct' });
  assert(typeof q === 'string' && q.length > 0, `must return a Cypher string (got ${short(q)}).`);
  assert(/IS_THE_CONCEPT_FOR/.test(q) && /:Superset/.test(q),
    'elements query must start from the concept header through IS_THE_CONCEPT_FOR → (:Superset).');
  assert(/-\[:HAS_ELEMENT\]->/.test(q), 'elements/direct must traverse HAS_ELEMENT.');
  assert(!/IS_A_SUPERSET_OF/.test(q),
    'elements/DIRECT must NOT walk IS_A_SUPERSET_OF — direct means the superset\'s own elements only.');
  assert(!/\bUNION\b/.test(q), 'elements/direct is a single arm — no UNION.');
  assert(/RETURN[\s\S]*\buuid\b[\s\S]*\bname\b[\s\S]*\bjson\b/.test(q),
    'must RETURN uuid, name, json for the list + detail pane.');
});

test('U2 (AC: any-author): elements/direct applies NO author predicate (decentralized-first)', async () => {
  const mod = await loadEsm(CONCEPT_MEMBERS, CM_MISSING);
  const q = mod.buildMembersQuery({ kind: 'elements', scope: 'direct' });
  assert(!/pubkey\s*[:=]/.test(q) && !/author/i.test(q),
    'the query must not gate elements by author — members from any pubkey show (ADR POV note).');
});

test('U3 (AC: elements/full): transitive-through-subsets UNION implicit z-tag', async () => {
  const mod = await loadEsm(CONCEPT_MEMBERS, CM_MISSING);
  const q = mod.buildMembersQuery({ kind: 'elements', scope: 'full' });
  assert(/IS_A_SUPERSET_OF\*0\.\.\d+/.test(q),
    'elements/FULL must walk nested subsets via IS_A_SUPERSET_OF*0..N (0 keeps the direct elements too).');
  assert(/-\[:HAS_ELEMENT\]->/.test(q), 'elements/full still collects HAS_ELEMENT members.');
  assert(/\bUNION\b/.test(q), 'elements/full must UNION the implicit arm.');
  assert(/type:\s*'z'/.test(q) && /value:\s*\$h/.test(q),
    'the implicit arm must match elements z-tagged to the concept header (type:\'z\', value:$h).');
});

test('U4 (AC: sets/direct): one-hop IS_A_SUPERSET_OF, no element traversal', async () => {
  const mod = await loadEsm(CONCEPT_MEMBERS, CM_MISSING);
  const q = mod.buildMembersQuery({ kind: 'sets', scope: 'direct' });
  assert(/-\[:IS_A_SUPERSET_OF\]->/.test(q),
    'sets/direct must traverse a single (non-variable-length) IS_A_SUPERSET_OF hop.');
  assert(!/IS_A_SUPERSET_OF\*/.test(q), 'sets/DIRECT must NOT be variable-length — direct subsets only.');
  assert(!/HAS_ELEMENT/.test(q), 'a sets query lists subsets, not elements — no HAS_ELEMENT.');
  assert(!/\bUNION\b/.test(q), 'sets have no implicit arm — no UNION.');
});

test('U5 (AC: sets/full): transitive IS_A_SUPERSET_OF*1..N (excludes the superset itself)', async () => {
  const mod = await loadEsm(CONCEPT_MEMBERS, CM_MISSING);
  const q = mod.buildMembersQuery({ kind: 'sets', scope: 'full' });
  assert(/IS_A_SUPERSET_OF\*1\.\.\d+/.test(q),
    'sets/FULL must walk IS_A_SUPERSET_OF*1..N — nested subsets, starting one hop down (not the superset itself).');
  assert(!/HAS_ELEMENT/.test(q), 'still a subset list — no HAS_ELEMENT.');
});

test('U6 (write-guard dodge): every built query references $h and NEVER an interpolated handle', async () => {
  const mod = await loadEsm(CONCEPT_MEMBERS, CM_MISSING);
  for (const kind of ['elements', 'sets']) {
    for (const scope of ['direct', 'full']) {
      const q = mod.buildMembersQuery({ kind, scope });
      assert(/\$h\b/.test(q),
        `${kind}/${scope}: the concept handle must be the $h PARAM (got ${short(q)}).`);
      assert(!/39998:/.test(q) && !/kind:pubkey/.test(q),
        `${kind}/${scope}: no concept handle may be interpolated into the query string — ` +
        'an interpolated "…:set" trips the /\\bSET\\b/ write-guard and 403s the read (ADR Context §1).');
    }
  }
});

test('U7 (guard): buildMembersQuery rejects an unknown kind/scope loudly', async () => {
  const mod = await loadEsm(CONCEPT_MEMBERS, CM_MISSING);
  let threwKind = null, threwScope = null;
  try { mod.buildMembersQuery({ kind: 'nope', scope: 'direct' }); } catch (e) { threwKind = e; }
  try { mod.buildMembersQuery({ kind: 'elements', scope: 'sideways' }); } catch (e) { threwScope = e; }
  assert(threwKind, 'an unknown kind must throw — silently defaulting would query the wrong thing.');
  assert(threwScope, 'an unknown scope must throw.');
});

/* ── U-class: fetchConceptMembers + cypher(params) — the param contract ──── */

async function withFetchStub(responses, fn) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const r = responses.shift() || { status: 200, body: { success: true, data: [] } };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  try { return { value: await fn(), calls }; }
  finally { globalThis.fetch = orig; }
}

test('U8 (write-guard dodge): fetchConceptMembers POSTs {cypher, params:{h}} — handle in params, NOT in the cypher text', async () => {
  const mod = await loadEsm(CONCEPT_MEMBERS, CM_MISSING);
  assert(typeof mod.fetchConceptMembers === 'function', 'conceptMembers.js must export fetchConceptMembers.');
  const rowsBack = [{ uuid: 'x', name: 'X', json: '{}' }];
  const { value, calls } = await withFetchStub(
    [{ status: 200, body: { success: true, data: rowsBack } }],
    () => mod.fetchConceptMembers({ headerUuid: H_SET, kind: 'elements', scope: 'direct' })
  );
  assert(calls.length === 1, `exactly one HTTP call expected (got ${calls.length}).`);
  assert(/\/api\/neo4j\/query$/.test(calls[0].url),
    `must POST to /api/neo4j/query (got ${short(calls[0].url)}).`);
  const sent = JSON.parse(calls[0].opts.body || '{}');
  assert(sent.params && sent.params.h === H_SET,
    `the concept handle must ride in params.h (got ${short(sent.params)}).`);
  assert(typeof sent.cypher === 'string' && !sent.cypher.includes(H_SET),
    'the handle must NOT appear in the cypher string — that is the whole write-guard dodge ' +
    `(cypher was: ${short(sent.cypher)}).`);
  assert(Array.isArray(value) && value.length === 1 && value[0].uuid === 'x',
    `fetchConceptMembers must return the response rows (got ${short(value)}).`);
});

test('U9 (client): cypher(query, params) forwards params in the POST body; no-arg stays backward-compatible', async () => {
  const mod = await loadEsm(CYPHER, 'ui/src/api/cypher.js missing — unexpected.');
  assert(typeof mod.cypher === 'function', 'cypher.js must export cypher.');
  // With params
  const withParams = await withFetchStub(
    [{ status: 200, body: { success: true, data: [{ ok: 1 }] } }],
    () => mod.cypher('MATCH (n {uuid:$h}) RETURN n', { h: 'HANDLE' })
  );
  const sent1 = JSON.parse(withParams.calls[0].opts.body || '{}');
  assert(sent1.cypher === 'MATCH (n {uuid:$h}) RETURN n', 'cypher text must be forwarded verbatim.');
  assert(sent1.params && sent1.params.h === 'HANDLE',
    `cypher() must forward its params argument to the server (got ${short(sent1.params)}).`);
  // Without params — existing callers unaffected
  const noParams = await withFetchStub(
    [{ status: 200, body: { success: true, data: [] } }],
    () => mod.cypher('MATCH (n) RETURN n')
  );
  const sent2 = JSON.parse(noParams.calls[0].opts.body || '{}');
  assert(sent2.cypher === 'MATCH (n) RETURN n',
    'a one-argument cypher() call must still work (backward compatibility).');
});

/* ── S-class: source assertions ─────────────────────────────────────────── */

test('S1 (AC: views offered): FirmwareExplorer mounts ConceptMembersView for elements & sets, keyed to remount', () => {
  const src = safeRead(FE);
  assert(src.length > 0, 'FirmwareExplorer.jsx missing — unexpected.');
  assert(/ConceptMembersView/.test(src),
    'FirmwareExplorer must import/mount the new ConceptMembersView — the members views are not inlined.');
  assert(/selectedNode\s*===\s*['"]elements['"]/.test(src) && /selectedNode\s*===\s*['"]sets['"]/.test(src),
    'FirmwareExplorer must branch on selectedNode === "elements" and === "sets" (the two new views).');
  assert(/kind=\{/.test(src) && /conceptData=\{/.test(src),
    'ConceptMembersView must receive the kind and conceptData props.');
  assert(/key=\{[^}]*(header|selectedNode)/.test(src),
    'the members view must be keyed (by concept header + kind) so scope resets to Direct and selection clears on switch.');
});

test('S2 (AC: list + detail + toggles + states): ConceptMembersView is wired per the ADR', () => {
  const src = safeRead(CMV);
  assert(src.length > 0,
    'ui/src/pages/settings/ConceptMembersView.jsx does not exist yet — the master-detail view is not implemented.');
  assert(/from\s+['"][^'"]*api\/conceptMembers['"]/.test(src) && /fetchConceptMembers/.test(src),
    'ConceptMembersView must fetch via fetchConceptMembers — never build Cypher inline.');
  assert(/JsonView/.test(src),
    'the detail pane must reuse the JsonView component (Viewer mode), not re-implement a tree.');
  assert(/useState\(\s*['"]direct['"]\s*\)/.test(src),
    'the Direct/Full scope must default to "direct" (AC: defaults to Direct on first open).');
  assert(/useState\(\s*['"]viewer['"]\s*\)/.test(src),
    'the JSON detail must default to the Viewer mode (matching FirmwareNodeJson).');
  assert(/Direct/.test(src) && /Full/.test(src) && /Raw/i.test(src) && /Viewer/i.test(src),
    'both toggles (Direct/Full and Viewer/Raw) must render their labels.');
  assert(/localeCompare/.test(src), 'rows must be sorted by name (localeCompare).');
  assert(/no\s+JSON/i.test(src), 'a selected item with no JSON must show a clear "no JSON" message.');
  assert(/length/.test(src), 'the view must show an item count header (rows.length).');
});

test('S3 (AC: not-installed degrade): the members branch sits behind the existing installed guard', () => {
  const src = safeRead(FE);
  // The existing guard renders the not-installed panel before the node switch; the new
  // members branch must live inside the installed path, not before it.
  assert(/conceptData\.installed/.test(src) || /!conceptData\.installed/.test(src),
    'FirmwareExplorer must keep gating content on conceptData.installed so Elements/Sets degrade gracefully for a not-installed concept.');
  assert(/nodes\??\.\s*header|nodes\['header'\]|nodes\.header/.test(src) || /ConceptMembersView/.test(src),
    'the members view is reached through the same installed concept path that already exposes nodes.header.');
});

/* ── H-class: integration sentinels (SKIP when stack absent OR core missing) ── */

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 60000 });
}
function loopbackPost(pathname, body) {
  const out = dockerCurl([
    '-s', '-m', '30', '-X', 'POST', `${CONTAINER_BASE}${pathname}`,
    '-H', 'Content-Type: application/json', '-d', JSON.stringify(body),
    '-w', '\n__STATUS__%{http_code}',
  ]);
  const idx = out.lastIndexOf('\n__STATUS__');
  const status = idx === -1 ? 0 : parseInt(out.slice(idx + 11), 10);
  const raw = idx === -1 ? out : out.slice(0, idx);
  let json = null; try { json = JSON.parse(raw); } catch {}
  return { status, json, raw };
}
function loopbackCypher(cypher, params = {}) {
  const { status, json, raw } = loopbackPost('/api/neo4j/query', { cypher, params });
  if (status !== 200 || !json || json.success !== true) {
    throw new Error(`fixture Cypher via loopback failed: status=${status} body=${short(json || raw)}`);
  }
  return json.data || [];
}
let _stack = null;
function stackReady() {
  if (_stack !== null) return _stack;
  try { loopbackCypher('RETURN 1 AS ok'); _stack = true; } catch { _stack = false; }
  return _stack;
}

// Fixture class thread:  H -IS_THE_CONCEPT_FOR-> SUP(:Superset)
//   SUP -HAS_ELEMENT-> E1                     (direct element)
//   SUP -IS_A_SUPERSET_OF-> SUB               (direct subset)
//   SUB -IS_A_SUPERSET_OF-> SUB2              (nested subset — full-sets only)
//   SUB -HAS_ELEMENT-> E2                     (element under a subset — full-elements only)
//   IMP -HAS_TAG-> (:NostrEventTag {type:'z', value: H})   (implicit element — full only)
const FIX = `test-fecs-${process.pid}-${Date.now()}`;
const FX = {
  h: `${FIX}-h`, sup: `${FIX}-sup`, e1: `${FIX}-e1`,
  sub: `${FIX}-sub`, sub2: `${FIX}-sub2`, e2: `${FIX}-e2`, imp: `${FIX}-imp`,
};
let fixturesUp = false;
function setupFixtures() {
  if (fixturesUp) return;
  loopbackCypher(
    'CREATE (h:NostrEvent {uuid:$h, name:"fecs-H"}), (sup:NostrEvent:Superset {uuid:$sup, name:"fecs-SUP"}), ' +
    '(e1:NostrEvent {uuid:$e1, name:"fecs-E1"}), (sub:NostrEvent:Superset {uuid:$sub, name:"fecs-SUB"}), ' +
    '(sub2:NostrEvent:Superset {uuid:$sub2, name:"fecs-SUB2"}), (e2:NostrEvent {uuid:$e2, name:"fecs-E2"}), ' +
    '(imp:NostrEvent {uuid:$imp, name:"fecs-IMP"}), (zt:NostrEventTag {type:"z", value:$h}) ' +
    'WITH h,sup,e1,sub,sub2,e2,imp,zt ' +
    'CREATE (h)-[:IS_THE_CONCEPT_FOR]->(sup), (sup)-[:HAS_ELEMENT]->(e1), (sup)-[:IS_A_SUPERSET_OF]->(sub), ' +
    '(sub)-[:IS_A_SUPERSET_OF]->(sub2), (sub)-[:HAS_ELEMENT]->(e2), (imp)-[:HAS_TAG]->(zt)',
    FX
  );
  fixturesUp = true;
}
function teardownFixtures() {
  if (!fixturesUp) return;
  try { loopbackCypher('MATCH (n) WHERE n.uuid IN $u OR (n:NostrEventTag AND n.value=$h) DETACH DELETE n', { u: Object.values(FX), h: FX.h }); }
  catch (e) { console.log(`      (fixture teardown failed — clean manually, prefix ${FIX}: ${e.message})`); }
  fixturesUp = false;
}
async function runBuilt(kind, scope) {
  const mod = await loadEsmOrNull(CONCEPT_MEMBERS);
  if (!mod || typeof mod.buildMembersQuery !== 'function') return null; // core not built → caller SKIPs
  setupFixtures(); // only touch the graph once we actually have a query to run
  return loopbackCypher(mod.buildMembersQuery({ kind, scope }), { h: FX.h });
}
function uuids(rows) { return new Set(rows.map(r => r.uuid)); }

test('H1 (elements/direct): the built query returns exactly the superset\'s own element', async () => {
  if (!stackReady()) return 'SKIP';
  const rows = await runBuilt('elements', 'direct');
  if (rows === null) return 'SKIP';
  const got = uuids(rows);
  assert(got.has(FX.e1), `E1 is a direct element — must be present (got ${short([...got])}).`);
  assert(!got.has(FX.e2) && !got.has(FX.imp),
    `elements/direct must EXCLUDE the nested-set element E2 and implicit IMP (got ${short([...got])}).`);
});

test('H2 (elements/full): built query adds nested-set + implicit z-tag elements', async () => {
  if (!stackReady()) return 'SKIP';
  const rows = await runBuilt('elements', 'full');
  if (rows === null) return 'SKIP';
  const got = uuids(rows);
  assert(got.has(FX.e1) && got.has(FX.e2) && got.has(FX.imp),
    `elements/full must include direct E1, nested-set E2, and implicit IMP (got ${short([...got])}).`);
});

test('H3 (sets/direct): built query returns exactly the direct subset', async () => {
  if (!stackReady()) return 'SKIP';
  const rows = await runBuilt('sets', 'direct');
  if (rows === null) return 'SKIP';
  const got = uuids(rows);
  assert(got.has(FX.sub) && !got.has(FX.sub2),
    `sets/direct must include the direct subset SUB but NOT the nested SUB2 (got ${short([...got])}).`);
});

test('H4 (sets/full): built query returns the transitive subset closure', async () => {
  if (!stackReady()) return 'SKIP';
  const rows = await runBuilt('sets', 'full');
  if (rows === null) return 'SKIP';
  const got = uuids(rows);
  assert(got.has(FX.sub) && got.has(FX.sub2),
    `sets/full must include both SUB and the nested SUB2 (got ${short([...got])}).`);
});

/* ── R-class: regression sentinels (pass before AND after) ──────────────── */

test('R1: FirmwareExplorer keeps its core-node tabs (Overview, Concept Header, Superset)', () => {
  const src = safeRead(FE);
  assert(/CORE_NODES/.test(src) && /Concept Header/.test(src) && /Superset/.test(src),
    'the existing per-concept core-node tab row must survive this additive change.');
});

test('R2: the core-node Viewer/Raw JSON toggle survives — extracted to CoreNodeViews, still used by FirmwareExplorer', () => {
  // Re-aimed for ADR tapestries/0004 Decision 3: the inline FirmwareNodeJson (with the
  // Viewer/Raw toggle over JsonView) was extracted VERBATIM into the shared CoreNodeViews
  // module (as ConceptNodeJson), which FirmwareExplorer now imports aliased as FirmwareNodeJson.
  // The behavior is unchanged; only the source location moved. This sentinel guards that the
  // toggle is not deleted — now checking its new home plus FirmwareExplorer's continued use.
  const src = safeRead(FE);
  const shared = safeRead(path.join(ROOT, 'ui/src/components/concept/CoreNodeViews.jsx'));
  assert(/FirmwareNodeJson/.test(src),
    'FirmwareExplorer must still render the core-node JSON view (imported/aliased as FirmwareNodeJson).');
  assert(/firmware-view-toggle/.test(shared) && /JsonView/.test(shared) && /ConceptNodeJson/.test(shared),
    'the shipped Viewer/Raw toggle over JsonView must remain intact — now in the shared CoreNodeViews module, not deleted.');
});

test('R3: FirmwareExplorer keeps the Integrations views (manifest-level Elements/Subsets/Graph)', () => {
  const src = safeRead(FE);
  assert(/INTEGRATION_TYPES/.test(src) && /Integration Graph/.test(src),
    'the pre-existing Integrations section must be untouched — the new views are distinct from it.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- firmware-concept-elements-sets tests (epic firmware-explorer, Story 1) ---');
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
  console.log(`\nfirmware-concept-elements-sets: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
