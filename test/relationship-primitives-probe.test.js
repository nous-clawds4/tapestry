/**
 * Story 2 (epic: relationship-primitives) — Read-only deployment probe for
 * the primitives surface.
 *
 * Story: engineering-team/stories/relationship-primitives/2-read-only-deployment-probe.md
 * ADR:   engineering-team/decisions/relationship-primitives/0002-read-only-deployment-probe.md
 *
 * Three test classes (ADR decision 5, on the established split):
 *
 *   U-class (stack-free, always gates CI) — src/api/normalize/probe.js is
 *     required STANDALONE, with no stubs: the module has zero requires by
 *     contract, so there is nothing to stub. The exported handler is driven
 *     with a bare mock req/res. Covers 200 + the exact static evidence body
 *     (the ADR decision-3 literal) and byte-identical bodies across two
 *     consecutive calls (nothing computed, nothing stateful).
 *
 *   S-class (source assertions, stack-free) — the structural zero-side-effect
 *     guarantee: probe.js contains NO require calls at all (an empty import
 *     surface cannot reach neo4j-driver, child_process, nostr-tools,
 *     ./firmware, or fs); the GET route is registered inside
 *     registerNormalizeRoutes in normalize/index.js (same delivery unit as
 *     the primitives — that is what makes a probe answer attributable
 *     evidence); and every string in the probe's operations array is
 *     registered as a POST in index.js (the evidence stays honest if the
 *     primitives are ever renamed).
 *
 *   H-class (live local stack, per-test SKIP when unreachable — the
 *     test/deploy-safety-status.test.js pattern) — all four tests run
 *     HOST-side on purpose: host->:7778 peers as the Docker bridge gateway,
 *     i.e. the unauthenticated REMOTE caller class (ADR
 *     security-auth-exposure/0001), which is exactly who the probe exists to
 *     answer. Matrix: credential-free GET probe -> 200 + exact JSON (H1);
 *     the missing-route contrast pair — probe 200 JSON vs the named
 *     unregistered sibling 404 non-JSON (H2); unauthenticated POST to the
 *     probe path -> 401 (no capability added; H3); strfry scan-count
 *     equality bracketing repeated probes (H4).
 *
 * ALL U/S tests and (stack-present) H1/H2/H4 FAIL until the feature lands —
 * src/api/normalize/probe.js does not exist and no GET route is registered
 * on the normalize mount. That is the point.
 * (One deliberate exception, mirroring story #1's H7: H3's unauthenticated
 * POST -> 401 is already satisfied by default-deny, which answers mutations
 * before route matching. Pre-implementation it is a regression guard on the
 * ratified auth layering; post-implementation it proves registering the GET
 * added no credential-free mutation capability on the same path.)
 *
 * The staging capture (acceptance frame bullet 8a) is the Director's
 * journaled read-only exercise of the same reproducible request pair — it is
 * NOT a test in this file (ADR decision 5).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROBE_MODULE = path.join(ROOT, 'src/api/normalize/probe.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');

const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

const PROBE_ROUTE = '/api/normalize/relationship-primitives';
// The named unregistered sibling (ADR decision 4) — the H-class contrast and
// the Director's staging capture must exercise the SAME reproducible pair.
const SIBLING_ROUTE = '/api/normalize/relationship-primitives-missing-sibling';

// The exact static evidence body — the ADR decision-3 literal. This is the
// TEST's spec expectation: it is deliberately duplicated here (not read from
// the module) so the suite pins the ratified contract, not whatever the
// implementation happens to export.
const EXPECTED_BODY = {
  success: true,
  surface: 'relationship-primitives',
  operations: ['add-relationship', 'delete-relationship'],
};

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function short(x, n = 200) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

// Key-order-insensitive deep equality for the exact-body assertions (byte
// identity across repeated calls is asserted separately, on the serialized
// forms).
function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object') {
    return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  }
  return JSON.stringify(x);
}
function sameBody(a, b) { return stable(a) === stable(b); }

/* ── U-class plumbing ──────────────────────────────────────────────────── */

/**
 * Require the probe module STANDALONE — no stubs, because the module has
 * zero requires by contract. Throws a feature-missing error (not an opaque
 * MODULE_NOT_FOUND) while the module has not been implemented, so every
 * pre-implementation failure reads as "the feature is missing".
 */
function requireProbe() {
  if (!fs.existsSync(PROBE_MODULE)) {
    throw new Error(
      'src/api/normalize/probe.js does not exist yet — the read-only deployment ' +
      'probe (ADR relationship-primitives/0002 Option A) is not implemented.'
    );
  }
  delete require.cache[require.resolve(PROBE_MODULE)];
  const mod = require(PROBE_MODULE);
  assert(typeof mod.handleRelationshipPrimitivesProbe === 'function',
    'probe.js must export handleRelationshipPrimitivesProbe (ADR Implementation notes).');
  return mod;
}

function mkRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { if (this.statusCode === null) this.statusCode = 200; this.body = o; return this; },
  };
}

async function invokeProbe() {
  const mod = requireProbe();
  const res = mkRes();
  // A bare req: the probe must need nothing from the request — no session,
  // no credentials, no body (AC-1).
  await mod.handleRelationshipPrimitivesProbe({}, res);
  return res;
}

/* ── H-class plumbing ──────────────────────────────────────────────────── */

// Host-side = the unauthenticated remote caller class (host->:7778 peers as
// the Docker bridge gateway — ADR security-auth-exposure/0001). Every H-class
// request here is deliberately credential-free.
async function hostGet(pathname) {
  const r = await fetch(`${HOST_BASE}${pathname}`, {
    signal: AbortSignal.timeout(8000),
  });
  const raw = await r.text();
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  return { status: r.status, contentType: r.headers.get('content-type') || '', raw, json };
}

async function hostPostJson(pathname, body) {
  const r = await fetch(`${HOST_BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

async function strfryEventCount() {
  const r = await fetch(`${HOST_BASE}/api/strfry/scan/count?filter=${encodeURIComponent('{}')}`, {
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => null);
  if (!j || j.success !== true || typeof j.count !== 'number') {
    throw new Error(`GET /api/strfry/scan/count did not answer a count (got ${short(j)})`);
  }
  return j.count;
}

// The probe's H-class needs only the host HTTP path — no container loopback,
// because the probe's whole contract is answering the remote class.
let reachable = null;
async function stackAvailable() {
  if (reachable !== null) return reachable;
  try {
    const r = await fetch(`${HOST_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    reachable = r.ok;
  } catch { reachable = false; }
  return reachable;
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ══════════════ U-class — the handler standalone, no stubs ══════════════ */

t('U1 (AC-1, AC-2): the probe handler answers 200 with the exact static evidence body — success:true, surface:"relationship-primitives", operations naming both primitives — to a bare credential-free request', async () => {
  const res = await invokeProbe();
  assert(res.statusCode === 200,
    `the probe must answer 200 to a request carrying nothing — no session, no credentials (AC-1); got ${res.statusCode}.`);
  assert(sameBody(res.body, EXPECTED_BODY),
    `the probe body must be EXACTLY the ADR decision-3 literal ${JSON.stringify(EXPECTED_BODY)} — ` +
    `the surface+operations fields are what make the answer attributable evidence (AC-2); got ${short(res.body)}.`);
  assert(Array.isArray(res.body.operations)
      && res.body.operations.includes('add-relationship')
      && res.body.operations.includes('delete-relationship'),
    `the operations array must name both relationship primitives (AC-2); got ${short(res.body && res.body.operations)}.`);
});

t('U2 (AC-4): two consecutive handler calls produce byte-identical bodies — nothing computed, nothing stateful, no timestamp', async () => {
  const first = await invokeProbe();
  const second = await invokeProbe();
  assert(first.statusCode === 200 && second.statusCode === 200,
    `both consecutive calls must answer 200 (got ${first.statusCode}, ${second.statusCode}).`);
  const a = JSON.stringify(first.body);
  const b = JSON.stringify(second.body);
  assert(a === b,
    'repeated probes must serialize BYTE-IDENTICAL — a static literal, no timestamp/counter/computed ' +
    `field; that is the cheapest proof probing leaves the system unchanged (AC-4 / ADR decision 3). Got:\n  ${short(a)}\n  ${short(b)}`);
});

/* ══════════════ S-class — structural zero-side-effect + registration ══════════════ */

t('S1 (AC-4): probe.js contains NO require calls at all — the empty import surface IS the zero-side-effect guarantee', () => {
  const src = readSafe(PROBE_MODULE);
  assert(src !== null,
    'src/api/normalize/probe.js does not exist yet — the read-only deployment ' +
    'probe (ADR relationship-primitives/0002 Option A) is not implemented.');
  assert(!/require\s*\(/.test(src),
    'probe.js must contain ZERO require calls — an empty import surface structurally cannot reach ' +
    'neo4j-driver, child_process, nostr-tools, ./firmware, fs, or signing keys (AC-4 / ADR Option A). ' +
    'A require( was found.');
  assert(!/^\s*import\b/m.test(src) && !/\bimport\s*\(/.test(src),
    'probe.js must not use import statements or dynamic import() either — the import surface must be empty (AC-4).');
});

t('S2 (AC-2): the GET probe route is registered inside registerNormalizeRoutes — the same delivery unit as the primitives', () => {
  const src = readSafe(NORMALIZE_INDEX);
  assert(src !== null, 'src/api/normalize/index.js missing — re-baseline this sentinel.');
  assert(/require\(\s*['"]\.\/probe['"]\s*\)/.test(src),
    'normalize/index.js must require ./probe — the probe module is not wired into the delivery unit ' +
    '(ADR relationship-primitives/0002 Implementation notes).');
  const fnStart = src.indexOf('function registerNormalizeRoutes');
  const fnEnd = src.indexOf('module.exports = { registerNormalizeRoutes }');
  assert(fnStart !== -1 && fnEnd !== -1 && fnStart < fnEnd,
    'could not locate registerNormalizeRoutes in normalize/index.js — re-baseline this sentinel.');
  const registerBlock = src.slice(fnStart, fnEnd);
  assert(/app\.get\(\s*['"]\/api\/normalize\/relationship-primitives['"]/.test(registerBlock),
    `GET ${PROBE_ROUTE} is not registered inside registerNormalizeRoutes — the probe is not reachable, ` +
    'and only registration in the SAME register function as the primitives makes a probe answer ' +
    'attributable deployment evidence (AC-2 / ADR decision 1).');
});

t('S3 (AC-2): every operation the probe advertises is a registered POST in normalize/index.js — the evidence stays honest if the primitives are renamed', () => {
  // Reads the operations through the handler's own answer (probe.js is safe
  // to require standalone — zero requires by contract).
  const res = mkRes();
  requireProbe().handleRelationshipPrimitivesProbe({}, res);
  const ops = res.body && res.body.operations;
  assert(Array.isArray(ops) && ops.length > 0,
    `the probe must advertise a non-empty operations array (got ${short(ops)}).`);
  const src = readSafe(NORMALIZE_INDEX);
  assert(src !== null, 'src/api/normalize/index.js missing — re-baseline this sentinel.');
  for (const op of ops) {
    assert(typeof op === 'string' && /^[a-z0-9-]+$/.test(op),
      `operations entries must be flat kebab-case route slugs (got ${short(op)}).`);
    const re = new RegExp(`app\\.post\\(\\s*['"]/api/normalize/${op}['"]`);
    assert(re.test(src),
      `the probe advertises "${op}" but POST /api/normalize/${op} is not registered in normalize/index.js — ` +
      'the probe would be claiming an operation that does not exist; the cross-check keeps the evidence ' +
      'honest under renames (ADR decision 5 / consequence "sync burden").');
  }
});

/* ══════════════ H-class — live host-side matrix (SKIP when stack absent) ══════════════ */

t('H1 (AC-1, AC-2): a credential-free host-side GET of the probe answers 200 application/json with the exact evidence body', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = await hostGet(PROBE_ROUTE);
  assert(r.status === 200,
    `GET ${PROBE_ROUTE} (host-side = the unauthenticated remote class) must answer 200 — got ` +
    `status=${r.status}, body=${short(r.raw, 120)} — the probe route is not implemented (AC-1).`);
  assert(/application\/json/.test(r.contentType),
    `the probe must answer application/json (got Content-Type: ${r.contentType}).`);
  assert(r.json !== null && sameBody(r.json, EXPECTED_BODY),
    `the probe body must be EXACTLY ${JSON.stringify(EXPECTED_BODY)} (AC-2); got ${short(r.json || r.raw)}.`);
});

t('H2 (AC-3): the missing-route contrast — the probe and the named unregistered sibling answer OBSERVABLY differently (200 JSON vs 404 non-JSON)', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const sibling = await hostGet(SIBLING_ROUTE);
  assert(sibling.status === 404,
    `GET ${SIBLING_ROUTE} must stay 404 — it is the named unregistered contrast path (ADR decision 4); got ${sibling.status}.`);
  assert(sibling.json === null && !/application\/json/.test(sibling.contentType) && /Cannot GET/.test(sibling.raw),
    `the sibling must answer Express's non-JSON finalhandler ("Cannot GET …", text/html) — got ` +
    `Content-Type: ${sibling.contentType}, body=${short(sibling.raw, 120)}.`);
  const probe = await hostGet(PROBE_ROUTE);
  assert(probe.status === 200 && probe.json !== null,
    `GET ${PROBE_ROUTE} must answer 200 JSON while its sibling 404s — got status=${probe.status}, ` +
    `body=${short(probe.raw, 120)}. Pre-implementation both paths answer the identical 404: that IS the ` +
    'falsified mechanism this story exists to fix (AC-3).');
  assert(probe.status !== sibling.status,
    `probe and sibling answered the SAME status (${probe.status}) — a remote caller cannot distinguish ` +
    'probe-present from route-missing (AC-3).');
  assert((probe.json !== null) !== (sibling.json !== null),
    'probe and sibling must differ in content class too (JSON vs non-JSON), not only in status (AC-3 / ADR decision 4).');
});

t('H3 (AC-4): an unauthenticated host-side POST to the probe path stays 401 — the GET added no credential-free mutation capability', async () => {
  // NOTE: this test PASSES pre-implementation — default-deny (ADR
  // security-auth-exposure/0002) answers unauthenticated mutations before
  // route matching. Like story #1's H7 it is a regression guard on the
  // ratified auth layering; post-implementation it proves registering the
  // probe's GET opened nothing else on the same path (story: "It exposes no
  // capability beyond answering").
  if (!(await stackAvailable())) return 'SKIP';
  const r = await hostPostJson(PROBE_ROUTE, {});
  assert(r.status === 401,
    `an unauthenticated host-side POST ${PROBE_ROUTE} must be denied 401 by default-deny (got ${r.status}).`);
});

t('H4 (AC-4): repeated probes write NOTHING to strfry — scan counts bracket equal around three identically-answered GETs', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  // Tight bracket (story #1 H8 pattern): counts immediately before/after the
  // probes minimize the concurrent-publish race window. Drift-sensitive when
  // the router/scheduled tasks are syncing — see the failure message.
  const before = await strfryEventCount();
  const bodies = [];
  for (let i = 0; i < 3; i++) {
    const r = await hostGet(PROBE_ROUTE);
    assert(r.status === 200 && r.json !== null,
      `bracketed probe #${i + 1} must answer 200 JSON — got status=${r.status}, ` +
      `body=${short(r.raw, 120)} — the probe route is not implemented.`);
    bodies.push(r.raw);
  }
  assert(bodies.every((b) => b === bodies[0]),
    'the three bracketed probe answers must be byte-identical on the wire — a static literal, nothing ' +
    `computed (AC-4 / ADR decision 3); got:\n  ${bodies.map((b) => short(b, 100)).join('\n  ')}`);
  const after = await strfryEventCount();
  assert(before === after,
    `probing must write NO event to strfry (AC-4): scan count went ${before} -> ${after}. ` +
    'If a concurrent publisher (scheduled task / sync) is suspected, quiesce it and re-run.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- relationship-primitives-probe tests (epic relationship-primitives, Story 2) ---');
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
  console.log(`\nrelationship-primitives-probe: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
