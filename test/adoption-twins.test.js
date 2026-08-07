/**
 * shared-concepts-adoption #7 — graph-derived twin picker.
 * Story: engineering-team/stories/shared-concepts-adoption/7-graph-derived-twin-picker.md
 * (fast-track: no ADR; approach recorded in the story's Background)
 *
 * The twin selector must offer MY WIREABLE concepts — graph concept headers ∩
 * has a kind-39998 event — never raw wire archaeology (BIBLE §30: neo4j is
 * the definitive "me"; the Adopt action appends a b to the twin's EVENT, so
 * eventless graph concepts must not be offered either).
 *
 *   S1    — structural: the endpoint is registered in the adoption module and
 *           the page consumes it (its raw strfry twin-scan is gone).
 *   H1..H3 — live (SKIP when the stack is down): response shape + coordinate
 *           uniqueness; the three-way fixture discrimination (graph-only OUT,
 *           both-sides IN with the graph name, event-only OUT); the
 *           adoption-queue regression. Fixtures torn down in H3 (cypher
 *           DETACH DELETE + bare republish, the established idioms).
 *
 * EXPECTED NOW (pre-implementation): S1, H1, H2 FAIL (endpoint and UI swap
 * absent; 404s); H3 PASS (regression guard); all H SKIP when the stack is
 * down.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ADOPTION_API_JS = path.join(ROOT, 'src/api/adoption/index.js');
const QUEUE_PAGE_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/AdoptionQueue.jsx');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;

const GRAPH_ONLY_D = 'twin-fixture-graph-only';
const REAL_D = 'twin-fixture-real';
const EVENT_ONLY_D = 'twin-fixture-event-only';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

let _stack = null;
async function stack() {
  if (_stack) return _stack;
  try {
    const r = await fetch(`${HOST_BASE}/api/assistant/pubkey`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    _stack = (j && j.success && /^[0-9a-f]{64}$/.test(j.pubkey)) ? { up: true, ta: j.pubkey } : { up: false };
  } catch { _stack = { up: false }; }
  return _stack;
}
function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
}
function loopbackPostJson(pathname, body) {
  const out = dockerCurl(['-s', '-m', '25', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); } catch { return { _raw: out }; }
}
async function hostGetJson(pathname) {
  const r = await fetch(`${HOST_BASE}${pathname}`, { signal: AbortSignal.timeout(25000) });
  let j = null; try { j = await r.json(); } catch { }
  return { status: r.status, json: j };
}
function cypher(cypherText, params) {
  const resp = loopbackPostJson('/api/neo4j/query', { cypher: cypherText, params: params || {} });
  if (!resp || resp.success !== true) {
    throw new Error(`fixture cypher failed: ${JSON.stringify(resp).slice(0, 200)}`);
  }
  return resp.data || [];
}
async function currentStamp(filter) {
  try {
    const f = encodeURIComponent(JSON.stringify(filter));
    const r = await fetch(`${HOST_BASE}/api/strfry/scan?filter=${f}`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    const events = j.events || j.data || [];
    return events.reduce((m, e) => Math.max(m, e.created_at || 0), 0);
  } catch { return 0; }
}
async function nextStamp(filter) {
  return Math.max(Math.floor(Date.now() / 1000), (await currentStamp(filter)) + 1);
}
async function publishTaEvent(dTag, kind, extraTags) {
  const s = await stack();
  const created_at = await nextStamp({ kinds: [kind], authors: [s.ta], '#d': [dTag] });
  return loopbackPostJson('/api/strfry/publish', {
    event: { kind, content: '', tags: [['d', dTag], ['name', dTag], ...(extraTags || [])], created_at },
    signAs: 'assistant',
  });
}

async function twins() {
  const { status, json } = await hostGetJson('/api/adoption-twins');
  assert(status === 200 && json && json.success === true,
    `GET /api/adoption-twins must answer 200 success:true (got ${status}): ${JSON.stringify(json).slice(0, 200)}`);
  assert(Array.isArray(json.twins), `the response must carry twins[]; got keys ${Object.keys(json || {}).join(',')}`);
  return json.twins;
}

// ═══ S — structural pins ═══════════════════════════════════════════════

test('S1: the endpoint is registered and the page consumes it (raw twin-scan gone)', () => {
  const mod = safeRead(ADOPTION_API_JS);
  assert(mod, 'src/api/adoption/index.js unreadable');
  assert(/['"`]\/api\/adoption-twins['"`]/.test(mod),
    'GET /api/adoption-twins must be registered in the adoption module (story #7)');
  assert(/runCypher/.test(mod), 'the twin enumeration reads the graph (runCypher present)');
  const page = safeRead(QUEUE_PAGE_JSX);
  assert(page, 'AdoptionQueue.jsx unreadable');
  assert(/\/api\/adoption-twins/.test(page), 'the page must fetch /api/adoption-twins for the picker');
  assert(!/api\/strfry\/scan/.test(page),
    'the page must no longer raw-scan strfry (the twin effect was its only scan — BIBLE §30, graph is the identity source)');
});

// ═══ H — live integration (SKIP when the stack is down) ════════════════

test('H1: response shape — {handle, name} rows, every handle mine and kind-39998, no coordinate twice', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await twins();
  const seen = new Set();
  for (const t of rows) {
    assert(t && typeof t.handle === 'string' && typeof t.name === 'string',
      `every twin carries {handle, name}, got ${JSON.stringify(t).slice(0, 120)}`);
    assert(t.handle.startsWith(`39998:${s.ta}:`),
      `twin handles are this instance's kind-39998 coordinates, got ${t.handle}`);
    assert(!seen.has(t.handle), `no coordinate may appear twice: ${t.handle}`);
    seen.add(t.handle);
  }
});

test('H2: the wireability discrimination — graph-only OUT, graph+event IN (graph name), event-only OUT', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  cypher(
    'MERGE (h:NostrEvent:ConceptHeader {uuid: $u}) SET h.name = $n, h.kind = 39998',
    { u: `39998:${s.ta}:${GRAPH_ONLY_D}`, n: 'twin fixture graph only' },
  );
  cypher(
    'MERGE (h:NostrEvent:ConceptHeader {uuid: $u}) SET h.name = $n, h.kind = 39998',
    { u: `39998:${s.ta}:${REAL_D}`, n: 'twin fixture real' },
  );
  const pr = await publishTaEvent(REAL_D, 39998, [['names', 'twin fixture real', 'x']]);
  const pe = await publishTaEvent(EVENT_ONLY_D, 39998, [['names', 'twin fixture event only', 'x']]);
  assert(pr.success === true && pe.success === true, 'fixture event publishes failed');

  const rows = await twins();
  const byHandle = new Map(rows.map((t) => [t.handle, t]));
  assert(!byHandle.has(`39998:${s.ta}:${GRAPH_ONLY_D}`),
    'a graph concept with NO event must not be offered (nothing to append the b to)');
  const real = byHandle.get(`39998:${s.ta}:${REAL_D}`);
  assert(real, 'a graph concept WITH its event must be offered');
  assert(real.name === 'twin fixture real', `the offered name comes from the graph, got ${real && real.name}`);
  assert(!byHandle.has(`39998:${s.ta}:${EVENT_ONLY_D}`),
    'an event with no graph node (orphans, fixtures) must not be offered');
});

test('H3 (regression, passes pre AND post): the adoption queue is untouched — then teardown', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  try {
    const { status, json } = await hostGetJson('/api/adoption-queue');
    assert(status === 200 && json && json.success === true
      && Array.isArray(json.nominations) && Array.isArray(json.declined)
      && Array.isArray(json.publishCandidates) && Array.isArray(json.deferredInUse),
    'the F1/F2 response contract must remain intact');
  } finally {
    cypher('MATCH (h:NostrEvent) WHERE h.uuid IN $us DETACH DELETE h',
      { us: [`39998:${s.ta}:${GRAPH_ONLY_D}`, `39998:${s.ta}:${REAL_D}`] });
    await publishTaEvent(REAL_D, 39998);
    await publishTaEvent(EVENT_ONLY_D, 39998);
  }
});

// ═══ runner ════════════════════════════════════════════════════════════

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
  console.log(`\nadoption-twins: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
