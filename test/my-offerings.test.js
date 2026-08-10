/**
 * shared-concepts-legibility #2 — one place listing everything this instance
 * has offered.
 * Story: engineering-team/stories/shared-concepts-legibility/2-mine-only-self-declared.md
 * ADR:   engineering-team/decisions/shared-concepts-legibility/0002-my-offerings-bulk-resolver.md
 *
 * The page's promise is COMPLETENESS, so the tests are built around the two
 * ways it could lie: dropping a declaration that never reached the relay
 * (H2), and rendering an empty list when the local read failed (S3).
 *
 *   S1..S8 — structural: registration and public posture, the ADR's asked-for
 *            pin that BOTH sharing-state endpoints resolve through the pure
 *            core rather than re-deriving the tri-state, the no-swallow pin on
 *            the local read, runtime TA resolution, page/route/nav wiring, and
 *            a regression pin on the community directory.
 *   H1..H6 — live (SKIP when the stack is down). H2 and H3 recompute the
 *            expected answer from the two stores INDEPENDENTLY and compare —
 *            they do not trust the endpoint to grade itself.
 *
 * Coverage honesty (see the test plan): the genuinely new logic in this story
 * is the handler's local↔relay join, which is exercised live rather than by
 * unit tests — the pure core it calls was unit-tested by story 1 and is
 * unchanged. The one requirement that CANNOT be tested behaviourally without
 * breaking the instance is "a failed local scan must not render as an empty
 * list" (S3): breaking strfry to prove it is not an acceptable test cost, so
 * S3 is a structural pin and is labelled as one.
 *
 * EXPECTED NOW (pre-implementation): S1–S6 FAIL (endpoint, page, route absent);
 * S7, S8 PASS (regression guards); H1–H5 FAIL with 404; H6 PASS; all H SKIP
 * when the stack is down.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/sharingState.js');
const API_INDEX_JS = path.join(ROOT, 'src/api/index.js');
const HANDLER_JS = path.join(ROOT, 'src/api/concept/myOfferings.js');
const STORY1_HANDLER_JS = path.join(ROOT, 'src/api/concept/sharingState.js');
const PAGE_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/MyOfferings.jsx');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const LAYOUT_JSX = path.join(ROOT, 'ui/src/components/Layout.jsx');
const DIRECTORY_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/SelfDeclaredSharedConcepts.jsx');
const COMMUNITY_HOOK_JS = path.join(ROOT, 'ui/src/hooks/useCommunitySharedConcepts.js');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const COMMUNITY_RELAY = 'wss://dcosl.brainstorm.world';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

/** Structure-bounded function body (the OPEN.md #109-ratified shape). */
function topLevelFunctionBody(src, name) {
  const re = new RegExp(`^(async )?function ${name}\\b`, 'm');
  const m = src.match(re);
  if (!m) return null;
  const start = m.index;
  const rest = src.slice(start + m[0].length);
  const next = rest.search(/^(async )?function |^module\.exports/m);
  return next === -1 ? src.slice(start) : src.slice(start, start + m[0].length + next);
}

// ═══ S — structural pins ═══════════════════════════════════════════════

test('S1: GET /api/my-offerings is registered and is a PUBLIC read', () => {
  assert(fs.existsSync(HANDLER_JS), 'src/api/concept/myOfferings.js is missing');
  const idx = safeRead(API_INDEX_JS);
  assert(idx, 'src/api/index.js unreadable');
  const line = (idx.split('\n').find((l) => l.includes('my-offerings')) || '');
  assert(line, "src/api/index.js must register '/api/my-offerings'");
  assert(/app\.get\(/.test(line), 'the my-offerings route must be a GET');
  assert(!/requireOwner/.test(line),
    'the read is public (ADR 0002) — it reveals nothing an observer could not read off the relay; only the write paths are gated');
});

test('S2 (ADR-required): BOTH sharing-state endpoints resolve through the pure core — neither re-derives the tri-state', () => {
  const lib = safeRead(LIB_JS);
  assert(lib && /relayOk === false \? null/.test(lib),
    'the tri-state rule must live in src/lib/sharingState.js (this is the pin the other two assertions are measured against)');
  for (const [label, file] of [['my-offerings', HANDLER_JS], ['sharing-state', STORY1_HANDLER_JS]]) {
    const src = safeRead(file);
    assert(src, `${file} unreadable`);
    assert(/resolveSharingState/.test(src),
      `the ${label} handler must resolve via resolveSharingState from the pure core`);
    assert(!/relayOk\s*===\s*false\s*\?\s*null/.test(src),
      `the ${label} handler must NOT restate the tri-state rule — two endpoints now compute sharing state and the rule has exactly one home (ADR 0002 Consequences)`);
  }
});

test('S3 (structural pin — see plan): a failed local scan must not degrade to an empty list', () => {
  const src = safeRead(HANDLER_JS);
  assert(src, 'src/api/concept/myOfferings.js unreadable');
  const body = topLevelFunctionBody(src, 'handleMyOfferings');
  assert(body, 'function handleMyOfferings not found as a top-level declaration');
  assert(!/strfryScan\([^;]*\.catch\s*\(\s*\(\s*\)\s*=>\s*(\[\]|null)/s.test(body),
    'the local scan must NOT be swallowed into [] or null — an empty list would assert "you have offered nothing", the one lie a completeness page must not tell (ADR 0002 Decision)');
  assert(/status\(5\d\d\)|status\(500\)/.test(body),
    'the handler must have a non-200 path for a failed local read');
  assert(/relayOk|relayError/.test(body),
    'the RELAY read, by contrast, must stay tri-stated — a relay failure still leaves a useful partial answer');
});

test('S4: "mine" is the runtime TA — no hardcoded pubkey', () => {
  const src = safeRead(HANDLER_JS);
  assert(src, 'handler unreadable');
  assert(/getOwnerAssistantPubkey/.test(src),
    'the TA must be resolved at runtime via getOwnerAssistantPubkey (per-deployment rule; three different TA values are in play across this project\'s instances)');
  const hex = src.match(/[0-9a-f]{64}/g);
  assert(!hex, `no 64-hex pubkey literal may appear in the handler — found ${JSON.stringify(hex)}`);
});

test('S5: the page, its route and its nav entry exist, and rows lead to where sending lives', () => {
  const page = safeRead(PAGE_JSX);
  assert(page, 'ui/src/pages/shared-concepts/MyOfferings.jsx is missing');
  assert(/my-offerings/.test(page), 'the page must read GET /api/my-offerings');
  const app = safeRead(APP_JSX);
  assert(app && /path:\s*['"`]mine['"`]/.test(app) && /MyOfferings/.test(app),
    "App.jsx must register 'mine' under shared-concepts");
  const layout = safeRead(LAYOUT_JSX);
  assert(layout && /shared-concepts\/mine/.test(layout), 'Layout.jsx must carry a nav entry for the page');
  assert(/tapestry\/concepts\//.test(page),
    'a row must lead to the concept page — where story 1 put the state badge and the submit affordance (story AC-7; no second send action)');
});

test('S6: the page distinguishes the three row states and reports an unconfirmed relay once, page-level', () => {
  const page = safeRead(PAGE_JSX);
  assert(page, 'MyOfferings.jsx unreadable');
  assert(/[Ss]hared/.test(page), 'a published offering must read as shared');
  assert(/not yet sent|not been sent|never sent/i.test(page),
    'an unpublished offering must read as declared-but-not-sent, distinct from shared');
  assert(/[Uu]nconfirmed|could not (be )?confirm/i.test(page),
    'published === null must render as unconfirmed — never as not-sent');
  assert(/relayOk/.test(page),
    'the page must read relayOk to state ONCE that publication could not be confirmed; a per-row indicator alone reads as a per-concept quirk rather than one failed check');
});

test('S7 (regression, passes pre AND post): the community-wide directory keeps its data source', () => {
  const dir = safeRead(DIRECTORY_JSX);
  const hook = safeRead(COMMUNITY_HOOK_JS);
  assert(dir && hook, 'the community directory and its hook must still exist — this story adds a view, it does not replace one (story AC-6)');
  assert(/useCommunitySharedConcepts/.test(dir), 'the directory must still source from the community hook');
  assert(new RegExp(COMMUNITY_RELAY.replace(/\./g, '\\.')).test(hook), 'the community hook must still target the community relay');
});

test('S8 (regression, passes pre AND post): story 1\'s single-coordinate endpoint is still registered', () => {
  const idx = safeRead(API_INDEX_JS);
  assert(idx && /sharing-state/.test(idx), 'GET /api/concept/:handle/sharing-state must remain — this story adds a bulk sibling, it does not replace it');
});

// ═══ H — live (SKIP when the stack is down) ════════════════════════════

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
async function hostGetJson(pathname) {
  const r = await fetch(`${HOST_BASE}${pathname}`, { signal: AbortSignal.timeout(45000) });
  let j = null; try { j = await r.json(); } catch { }
  return { status: r.status, json: j };
}
const selfDeclaredCoords = (events) => {
  const byCoord = new Map();
  for (const ev of events || []) {
    const d = (ev.tags.find((t) => t[0] === 'd') || [])[1];
    if (d == null) continue;
    const coord = `${ev.kind}:${ev.pubkey}:${d}`;
    const prev = byCoord.get(coord);
    if (!prev || ev.created_at > prev.created_at) byCoord.set(coord, ev);
  }
  const out = new Set();
  for (const [coord, ev] of byCoord) {
    if (ev.tags.some((t) => t[0] === 'b' && String(t[1]).trim() === coord)) out.add(coord);
  }
  return out;
};
/** The local store's answer, computed independently of the endpoint. */
async function localSelfDeclared(ta) {
  const f = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [ta] }));
  const { json } = await hostGetJson(`/api/strfry/scan?filter=${f}`);
  return selfDeclaredCoords((json && json.events) || []);
}
/** The relay's answer, computed independently of the endpoint. */
async function relaySelfDeclared(ta) {
  const f = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [ta] }));
  const r = encodeURIComponent(COMMUNITY_RELAY);
  const { json } = await hostGetJson(`/api/relay/external?filter=${f}&relays=${r}`);
  if (!json || json.success !== true) return null; // relay unreachable — not the same as empty
  return selfDeclaredCoords(json.events || []);
}

test('H1: the endpoint answers with the documented shape', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const { status, json } = await hostGetJson('/api/my-offerings');
  assert(status === 200, `expected 200 from /api/my-offerings, got ${status}`);
  assert(json && json.success === true, `expected success:true, got ${JSON.stringify(json)}`);
  assert(Array.isArray(json.offerings), `offerings must be an array, got ${typeof json.offerings}`);
  assert(json.ta === s.ta, `ta must be the runtime TA ${s.ta}, got ${json.ta}`);
  assert(typeof json.relayOk === 'boolean', 'relayOk must be a boolean so the page can state one failed check once');
  for (const row of json.offerings) {
    assert(typeof row.coord === 'string', `each row needs a coord, got ${JSON.stringify(row)}`);
    assert(row.published === true || row.published === false || row.published === null,
      `published must be the tri-state true|false|null, got ${JSON.stringify(row.published)} on ${row.coord}`);
  }
});

test('H2 (AC-1, the completeness test): every locally declared concept is listed, INCLUDING any the relay never received', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const expected = await localSelfDeclared(s.ta);
  if (expected.size === 0) return 'SKIP'; // this instance has offered nothing to assert about
  const { json } = await hostGetJson('/api/my-offerings');
  const got = new Set((json && json.offerings ? json.offerings : []).map((r) => r.coord));
  const missing = [...expected].filter((c) => !got.has(c));
  assert(missing.length === 0,
    `every self-declared header in local strfry must be listed. Missing ${missing.length}: ${JSON.stringify(missing)}. `
    + 'A row missing here is almost certainly one the relay never received — exactly the case this page exists to surface, and the failure mode a relay-sourced filter would have.');
  const extra = [...got].filter((c) => !expected.has(c));
  assert(extra.length === 0, `the endpoint listed coords that are not self-declared locally: ${JSON.stringify(extra)}`);
});

test('H3 (AC-2/AC-3): published matches relay presence, computed independently — and null only when the relay failed', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const { status, json } = await hostGetJson('/api/my-offerings');
  assert(status === 200 && json && Array.isArray(json.offerings),
    `the endpoint must answer before published can be checked — got ${status} ${JSON.stringify(json)}`);
  if (json.offerings.length === 0) return 'SKIP';
  const onRelay = await relaySelfDeclared(s.ta);

  if (onRelay === null || json.relayOk === false) {
    for (const row of json.offerings) {
      assert(row.published === null,
        `the relay could not be read, so every row must report published:null — got ${JSON.stringify(row.published)} on ${row.coord}. Reporting false here would claim "not shared" on the strength of a check that failed to run.`);
    }
    return;
  }
  for (const row of json.offerings) {
    const expected = onRelay.has(row.coord);
    assert(row.published === expected,
      `published for ${row.coord} should be ${expected} (independently checked against ${COMMUNITY_RELAY}), got ${JSON.stringify(row.published)}`);
  }
});

test('H4 (AC-5): only this instance\'s offerings appear', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const { status, json } = await hostGetJson('/api/my-offerings');
  // Assert the endpoint answered FIRST — otherwise this passes vacuously on an
  // empty/absent response and reports coverage it does not have.
  assert(status === 200 && json && Array.isArray(json.offerings),
    `the endpoint must answer before authorship can be checked — got ${status} ${JSON.stringify(json)}`);
  const foreign = json.offerings.filter((r) => r.coord.split(':')[1] !== s.ta);
  assert(foreign.length === 0,
    `every row must be authored by this instance's TA; found ${foreign.length} foreign: ${JSON.stringify(foreign.map((r) => r.coord))}`);
});

test('H5: rows are ordered newest-declared first', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const { json } = await hostGetJson('/api/my-offerings');
  const rows = (json && json.offerings) || [];
  if (rows.length < 2) return 'SKIP';
  for (let i = 1; i < rows.length; i++) {
    assert(rows[i - 1].declaredAt >= rows[i].declaredAt,
      `rows must be sorted newest-declared first; row ${i - 1} (${rows[i - 1].declaredAt}) precedes row ${i} (${rows[i].declaredAt})`);
  }
});

test('H6 (regression, passes pre AND post): story 1\'s single-coordinate read still answers', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const coords = await localSelfDeclared(s.ta);
  const one = [...coords][0];
  if (!one) return 'SKIP';
  const { status, json } = await hostGetJson(`/api/concept/${encodeURIComponent(one)}/sharing-state`);
  assert(status === 200 && json && json.success === true,
    `adding the bulk endpoint must not disturb /api/concept/:handle/sharing-state — got ${status}`);
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
  console.log(`\nmy-offerings: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
