/**
 * treasure-map-relay-presence #2: sync the Treasure Map with one relay.
 *
 * Story: engineering-team/stories/treasure-map-relay-presence/2-per-relay-map-sync.md
 * ADR:   engineering-team/decisions/treasure-map-relay-presence/0002-per-relay-map-sync.md
 *
 * Classes (house pattern — see test/tl-treasure-map-panel.test.js):
 *   N (behavioral, pure)   — planRelaySync(), ESM-imported. The whole of criterion 1's decision
 *                            table, testable with no browser, no relay, no server.
 *   F (behavioral, API)    — the opt-in `full=1` projection on GET /api/relay/presence, driven
 *                            through an injected probe. F2 is a CROSS-STORY GUARD: it re-pins
 *                            story 1's narrow default shape (its A6) so that widening the default
 *                            — the tempting shortcut for this story — fails here too.
 *   S (structure)          — panel/page wiring with no behavioral surface from Node.
 *   D (negative)           — criterion 4: no deletion is emitted anywhere in this feature.
 *   R (sentinel)           — story 1's shipped behavior. Passes before AND after; fails only on
 *                            collateral damage.
 *
 * Hermetic: no socket is opened and nostr-tools is never required, same as story 1's suite
 * (OPEN.md row 13), and nothing is written to the shared local relay (rows 75/126/128/141).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PRESENCE_API = path.resolve(__dirname, '../src/api/relay/presence.js');
const PANEL = path.resolve(__dirname, '../ui/src/pages/grapevine/TreasureMapRelayPresence.jsx');
const PAGE = path.resolve(__dirname, '../ui/src/pages/grapevine/TrustedAssertions.jsx');
const UTIL = path.resolve(__dirname, '../ui/src/utils/treasureMap.js');
const PUBLISH = path.resolve(__dirname, '../ui/src/utils/nostrPublish.js');

const AUTHOR = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';
const KIND = 10040;

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }

function ev(overrides = {}) {
  return {
    id: 'a'.repeat(64), kind: KIND, pubkey: AUTHOR, created_at: 1774412135,
    tags: [['30382:rank', AUTHOR, '']], content: '', sig: 'b'.repeat(128), ...overrides,
  };
}

function fakeRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

function loadHandler() {
  let mod;
  try { mod = require(PRESENCE_API); } catch (err) { throw new Error(`src/api/relay/presence.js failed to load: ${err.message}`); }
  assert(typeof mod.handleRelayPresence === 'function', 'src/api/relay/presence.js must export handleRelayPresence');
  return mod.handleRelayPresence;
}

async function planner() {
  const mod = await loadEsm(UTIL);
  assert(mod, 'ui/src/utils/treasureMap.js must import cleanly');
  assert(typeof mod.planRelaySync === 'function',
    'ADR 0002 § Implementation notes 1: ui/src/utils/treasureMap.js must export planRelaySync(localEvent, relayEvent)');
  return mod.planRelaySync;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── N: planRelaySync — the whole of criterion 1 (AC-1) ────────── */

test('N1: local has the Map and the relay does not → send it out', async () => {
  const plan = await planner();
  const r = plan(ev(), null);
  assert(r.direction === 'push', `AC-1: local-only must plan a push, got "${r.direction}"`);
});

test('N2: the relay has the Map and local does not → bring it back', async () => {
  const plan = await planner();
  const r = plan(null, ev());
  assert(r.direction === 'pull', `AC-1: relay-only must plan a pull, got "${r.direction}"`);
});

test('N3: neither side has it → no action, and the reason says so', async () => {
  const plan = await planner();
  const r = plan(null, null);
  assert(r.direction === null, `AC-1: nothing to sync must plan no direction, got "${r.direction}"`);
  assert(r.reason === 'nothing-to-sync', `expected reason "nothing-to-sync", got "${r.reason}"`);
});

test('N4: both hold the same event → no action, reported as in sync', async () => {
  const plan = await planner();
  const same = ev();
  const r = plan(same, { id: same.id, created_at: same.created_at });
  assert(r.direction === null, `AC-1: an identical event must offer no action, got "${r.direction}"`);
  assert(r.reason === 'in-sync', `expected reason "in-sync", got "${r.reason}"`);
});

test('N5: the more recent side wins, in both directions', async () => {
  const plan = await planner();
  const local = ev({ id: '1'.repeat(64), created_at: 2000 });

  const relayOlder = plan(local, { id: '2'.repeat(64), created_at: 1000 });
  assert(relayOlder.direction === 'push',
    `AC-1: a relay holding an OLDER version must plan a push, got "${relayOlder.direction}"`);

  const relayNewer = plan(local, { id: '2'.repeat(64), created_at: 3000 });
  assert(relayNewer.direction === 'pull',
    `AC-1: a relay holding a NEWER version must plan a pull, got "${relayNewer.direction}"`);
});

test('N6: an unorderable pair (equal timestamp, different id) offers nothing', async () => {
  const plan = await planner();
  const local = ev({ id: '1'.repeat(64), created_at: 2000 });
  const r = plan(local, { id: '2'.repeat(64), created_at: 2000 });
  assert(r.direction === null,
    `ADR 0002 § Decision: neither copy is "more recent", so no honest direction exists — expected null, got "${r.direction}"`);
  assert(r.reason === 'divergent', `expected reason "divergent", got "${r.reason}"`);
});

test('N7: planRelaySync never throws on malformed input', async () => {
  const plan = await planner();
  for (const [a, b] of [[undefined, undefined], [{}, {}], [ev(), {}], [{}, ev()], [ev(), { id: 5 }]]) {
    let r;
    try { r = plan(a, b); } catch (err) { throw new Error(`must not throw on malformed input, got: ${err.message}`); }
    assert(r && 'direction' in r, 'must always return a plan object with a direction key');
  }
});

/* ── F: the opt-in full projection (AC-3 needs the whole event) ── */

test('F1: full=1 returns the complete signed event, not the projection', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  const found = ev();
  await handle(
    { query: { relay: 'wss://a.example', pubkey: AUTHOR, kind: String(KIND), full: '1' } }, res,
    { probe: async () => ({ status: 'present', event: found, error: null }) }
  );
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
  const e = res.body && res.body.event;
  assert(e, 'expected an event in the response');
  assert(e.sig === found.sig && e.pubkey === found.pubkey && e.kind === found.kind,
    `AC-3: pulling needs the whole signed event — got keys ${Object.keys(e || {}).join(',')}`);
  assert(Array.isArray(e.tags), 'the full event must carry its tags — they are the Map itself');
});

test('F2: CROSS-STORY GUARD — without full, the response is still only id + created_at', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  await handle(
    { query: { relay: 'wss://a.example', pubkey: AUTHOR, kind: String(KIND) } }, res,
    { probe: async () => ({ status: 'present', event: ev(), error: null }) }
  );
  const e = res.body && res.body.event;
  assert(e && !('sig' in e) && !('tags' in e) && !('content' in e),
    `ADR 0002: full=1 must be ADDITIVE — story 1's narrow default (its A6) must keep holding; got keys ${Object.keys(e || {}).join(',')}`);
});

test('F3: full=1 on a relay that does not have it still reports absent with no event', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  await handle(
    { query: { relay: 'wss://a.example', pubkey: AUTHOR, kind: String(KIND), full: '1' } }, res,
    { probe: async () => ({ status: 'absent', event: null, error: null }) }
  );
  assert(res.body.status === 'absent', `expected "absent", got "${res.body.status}"`);
  assert(res.body.event === null, 'absent carries no event regardless of full');
});

test('F4: full=1 on an unreachable relay is still a 200 carrying the status', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  await handle(
    { query: { relay: 'wss://a.example', pubkey: AUTHOR, kind: String(KIND), full: '1' } }, res,
    { probe: async () => ({ status: 'unreachable', event: null, error: 'boom' }) }
  );
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
  assert(res.body.status === 'unreachable', `expected "unreachable", got "${res.body.status}"`);
});

test('F5: the full event is the one the probe already verified — no second fetch', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  let probeCalls = 0;
  await handle(
    { query: { relay: 'wss://a.example', pubkey: AUTHOR, kind: String(KIND), full: '1' } }, res,
    { probe: async () => { probeCalls++; return { status: 'present', event: ev(), error: null }; } }
  );
  assert(probeCalls === 1,
    `ADR 0002 § Consequences: pull must inherit story 1's verification, not re-fetch unverified — expected exactly 1 probe call, got ${probeCalls}`);
});

/* ── S: wiring with no behavioral surface from Node ────────────── */

test('S1: the panel composes the existing publish primitives rather than new ones', () => {
  const src = safeRead(PANEL);
  assert(src, 'ui/src/pages/grapevine/TreasureMapRelayPresence.jsx must exist');
  assert(/planRelaySync/.test(src), 'AC-1: the panel must decide direction with planRelaySync');
  assert(/publishToRelays/.test(src), 'AC-2: sending must go through publishToRelays (which carries the policy gate)');
  assert(/publishToLocalStrfry/.test(src), 'AC-3: pulling must import via publishToLocalStrfry');
});

test('S2: the send action is gated on the deployment publish policy BEFORE the click', () => {
  const src = safeRead(PANEL);
  assert(/isExternalPublishAllowed/.test(src),
    'AC-5: the panel must consult isExternalPublishAllowed so an unavailable action is visible before it is pressed, not after');
  assert(/skippedByGate/.test(src),
    'AC-5: a publish suppressed by the local-only gate must be reported as "kept local", not as a failure');
});

test('S3: pulling tells the page to re-read the Map', () => {
  const panel = safeRead(PANEL);
  const page = safeRead(PAGE);
  assert(/onMapReplaced/.test(panel),
    'AC-3: the panel must signal that the displayed Map was replaced');
  assert(/onMapReplaced=\{search\}/.test(page),
    'AC-3: TrustedAssertions.jsx must wire onMapReplaced to its existing search() so the page re-reads the Map');
});

test('S4: one shared per-relay probe path, reused for the post-sync re-check', () => {
  const src = safeRead(PANEL);
  assert(/probeOne/.test(src),
    'ADR 0002 § Implementation notes 3: the initial fan-out and the post-sync re-check must share one probe path');
  assert(!/Promise\.(all|allSettled)\s*\(/.test(src),
    'AC-5 of story 1 still holds: rows must not be gated on a settled batch');
});

test('S5: the local side is what LOCAL holds, not what the page happens to display', () => {
  const src = safeRead(PANEL);
  assert(/inLocal\s*\?\s*event\s*:\s*null/.test(src),
    'ADR 0002 § Decision: direction is decided against local\'s copy — when inLocal is false the displayed event came from an EXTERNAL relay and local holds nothing. Expected `inLocal ? event : null`.');
});

/* ── D: criterion 4 — nothing is ever deleted ──────────────────── */

test('D1: no deletion event is constructed anywhere in this feature', () => {
  for (const [name, src] of [
    ['TreasureMapRelayPresence.jsx', safeRead(PANEL)],
    ['treasureMap.js', safeRead(UTIL)],
    ['presence.js', safeRead(PRESENCE_API)],
  ]) {
    assert(!/kind\s*:\s*5\b/.test(src),
      `AC-4: ${name} must not construct a kind-5 deletion — the older copy is superseded by the relay, never deleted by us`);
    assert(!/\bdeleteEvent\b|\bpublishDeletion\b|NIP-?09/i.test(src),
      `AC-4: ${name} must not reference a deletion path`);
  }
});

/* ── R: sentinels — pass before AND after ──────────────────────── */

test('R1: story 1 helpers are intact and still behave', async () => {
  const mod = await loadEsm(UTIL);
  assert(mod, 'treasureMap.js must import cleanly');
  for (const fn of ['classifyEntry', 'findGenericTlDelegation', 'composeManualUpdate',
    'upsertGenericTlTag', 'buildPresenceTargets', 'compareMapVersions']) {
    assert(typeof mod[fn] === 'function', `story-1 export must survive: ${fn}`);
  }
  assert(mod.compareMapVersions(ev({ created_at: 2000 }), { id: 'c'.repeat(64), created_at: 1000 }) === 'older',
    'compareMapVersions still orders an older relay copy');
});

test('R2: the presence panel keeps its story-1 surface', () => {
  const panel = safeRead(PANEL);
  assert(/buildPresenceTargets/.test(panel), 'story 1: targets still come from the shared helper');
  assert(/useConfig/.test(panel), 'story 1: relays still come from configuration');
  assert(/Import to local strfry/.test(panel), 'story 1: the local-row import affordance survives');
  assert(!/wss?:\/\/[a-z0-9]/i.test(panel), 'story 1 AC-1: still no relay URL literal in the panel');
  assert(!/[0-9a-fA-F]{64}/.test(panel), 'CLAUDE.md: still no 64-hex literal in the panel');
});

test('R3: the page keeps its other Treasure-Map panels', () => {
  const page = safeRead(PAGE);
  assert(/TlOptInCard/.test(page), 'tl-treasure-map #3 must survive');
  assert(/TreasureMapManualEdit/.test(page), 'treasure-map-user-assistant #2 must survive');
  assert(/TreasureMapRelayPresence/.test(page), 'story 1: the presence panel is still mounted');
});

test('R4: the shared publish helpers are unchanged in the ways this story relies on', () => {
  const src = safeRead(PUBLISH);
  assert(/export async function publishToRelays\(signedEvent, relays = PUBLISH_RELAYS\)/.test(src),
    'ADR 0002 relies on publishToRelays accepting an explicit relay list — signature must not narrow');
  assert(/skippedByGate:\s*true/.test(src),
    'ADR 0002 relies on the local-only gate returning skippedByGate rather than a failure');
  assert(/export async function publishToLocalStrfry/.test(src),
    'ADR 0002 relies on publishToLocalStrfry for the pull direction');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
