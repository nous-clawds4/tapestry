/**
 * treasure-map-relay-presence #1: show which relays hold the Treasure Map.
 *
 * Story: engineering-team/stories/treasure-map-relay-presence/1-treasure-map-relay-presence.md
 * ADR:   engineering-team/decisions/treasure-map-relay-presence/0001-per-relay-presence-probe.md
 *
 * Classes (house pattern — see test/tl-treasure-map-panel.test.js):
 *   P (behavioral, server) — probeRelayForEvent() driven through an INJECTED connect(), so every
 *                            status is reachable with no network. FAIL now: the function does not
 *                            exist. Hermetic by construction (OPEN.md row 13): the injected
 *                            connect means nostr-tools is never required in this suite.
 *   A (behavioral, API)    — handleRelayPresence() validation + response shape, injected probe.
 *   C (behavioral, config) — the new relay group in defaults.json.
 *   T (behavioral, client) — the two pure helpers, ESM-imported from ui/src/utils/treasureMap.js.
 *   S (structure)          — wiring that has no behavioral surface from Node.
 *   R (sentinel)           — what the ADR promised NOT to disturb. These pass before AND after;
 *                            they fail only on collateral damage.
 *
 * Injection contracts this suite pins (ADR § Implementation notes 1–2, in relaySource.js's
 * existing DI-by-parameter idiom — cf. resolveGeneralPurposeRelays(runCypher)):
 *   probeRelayForEvent(relayUrl, filter, { connect, verify, connectTimeoutMs, queryTimeoutMs })
 *     -> { status: 'present' | 'absent' | 'unreachable', event: <event>|null, error: string|null }
 *   handleRelayPresence(req, res, { probe })
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RELAY_SOURCE = path.resolve(__dirname, '../src/api/_shared/relaySource.js');
const PRESENCE_API = path.resolve(__dirname, '../src/api/relay/presence.js');
const API_INDEX = path.resolve(__dirname, '../src/api/index.js');
const FETCH_EVENTS = path.resolve(__dirname, '../src/api/relay/fetchEvents.js');
const DEFAULTS = path.resolve(__dirname, '../src/config/defaults.json');
const RELAY_SETTINGS = path.resolve(__dirname, '../ui/src/pages/settings/RelaySettings.jsx');
const PANEL = path.resolve(__dirname, '../ui/src/pages/grapevine/TreasureMapRelayPresence.jsx');
const PAGE = path.resolve(__dirname, '../ui/src/pages/grapevine/TrustedAssertions.jsx');
const UTIL = path.resolve(__dirname, '../ui/src/utils/treasureMap.js');

const AUTHOR = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';
const OTHER = '11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767';
const KIND = 10040;
const FILTER = { kinds: [KIND], authors: [AUTHOR], limit: 1 };

// The exact value nostr-tools throws on connect failure — a bare string, not an Error.
// Measured 2026-09-07 across DNS failure, TCP refusal, a non-relay host and a blackholed IP
// (ADR § M2). Reading `.message` on it yields undefined; P4 pins the normalization.
const NT_CONNECT_THROW = 'Received network error or non-101 status code.';

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }

function ev(overrides = {}) {
  return {
    id: 'a'.repeat(64), kind: KIND, pubkey: AUTHOR, created_at: 1774412135,
    tags: [], content: '', sig: 'b'.repeat(128), ...overrides,
  };
}

/** A fake nostr-tools Relay: hands `events` to onevent then fires oneose. */
function fakeRelay(events, opts = {}) {
  const rec = { closed: false, subClosed: false, subscribeCalls: 0 };
  rec.relay = {
    subscribe(filters, handlers) {
      rec.subscribeCalls++;
      rec.filters = filters;
      setImmediate(() => {
        if (opts.closeInstead) { handlers.onclose && handlers.onclose('relay said no'); return; }
        if (opts.silent) return; // never EOSEs — exercises the query timeout
        for (const e of events) handlers.onevent && handlers.onevent(e);
        handlers.oneose && handlers.oneose();
      });
      return { close() { rec.subClosed = true; } };
    },
    close() { rec.closed = true; },
  };
  return rec;
}

/** connect() that throws `failures` times (bare string, like the real library) then succeeds. */
function flakyConnect(failures, relay) {
  const rec = { calls: 0 };
  rec.connect = async () => {
    rec.calls++;
    if (rec.calls <= failures) throw NT_CONNECT_THROW;
    return relay;
  };
  return rec;
}

function loadProbe() {
  let mod;
  try { mod = require(RELAY_SOURCE); } catch (err) { throw new Error(`src/api/_shared/relaySource.js failed to load: ${err.message}`); }
  assert(typeof mod.probeRelayForEvent === 'function',
    'ADR § Implementation notes 1: src/api/_shared/relaySource.js must export probeRelayForEvent(relayUrl, filter, opts)');
  return mod.probeRelayForEvent;
}

function loadHandler() {
  let mod;
  try { mod = require(PRESENCE_API); } catch (err) { throw new Error(`src/api/relay/presence.js failed to load: ${err.message}`); }
  assert(typeof mod.handleRelayPresence === 'function',
    'ADR § Implementation notes 2: src/api/relay/presence.js must export handleRelayPresence(req, res, deps)');
  return mod.handleRelayPresence;
}

/** Minimal express-ish res capturing status + json body. */
function fakeRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

async function utils() {
  const mod = await loadEsm(UTIL);
  assert(mod, 'ui/src/utils/treasureMap.js must import cleanly');
  return mod;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── P: probeRelayForEvent — the three statuses (AC-2, AC-3, AC-4) ── */

test('P1: a relay returning the author\'s event reports present, with the event', async () => {
  const probe = loadProbe();
  const want = ev();
  const rec = fakeRelay([want]);
  const r = await probe('wss://x.example', FILTER, { connect: async () => rec.relay, verify: () => true });
  assert(r.status === 'present', `AC-2: expected status "present", got "${r.status}"`);
  assert(r.event && r.event.id === want.id, `AC-2: expected the event to come back, got ${JSON.stringify(r.event)}`);
});

test('P2: a relay that EOSEs with no events reports absent, not unreachable', async () => {
  const probe = loadProbe();
  const rec = fakeRelay([]);
  const r = await probe('wss://x.example', FILTER, { connect: async () => rec.relay, verify: () => true });
  assert(r.status === 'absent', `AC-4: a reachable relay holding nothing is "absent", got "${r.status}"`);
  assert(r.event === null, `AC-4: absent carries no event, got ${JSON.stringify(r.event)}`);
});

test('P3: a relay that cannot be connected reports unreachable — distinct from absent', async () => {
  const probe = loadProbe();
  const r = await probe('wss://x.example', FILTER, {
    connect: async () => { throw NT_CONNECT_THROW; }, verify: () => true,
  });
  assert(r.status === 'unreachable',
    `AC-4: connect failure must be "unreachable" (the distinction /api/relay/external cannot make — ADR M1), got "${r.status}"`);
  assert(r.event === null, 'AC-4: unreachable carries no event');
});

test('P4: the bare-string connect throw is normalized into a readable error (ADR M2)', async () => {
  const probe = loadProbe();
  const r = await probe('wss://x.example', FILTER, {
    connect: async () => { throw NT_CONNECT_THROW; }, verify: () => true,
  });
  assert(typeof r.error === 'string' && r.error.length > 0,
    `ADR M2: nostr-tools throws a bare string, so err.message is undefined — error must be normalized, got ${JSON.stringify(r.error)}`);
  assert(!/^undefined$/i.test(r.error),
    'ADR M2: error must not be the literal "undefined" (the exact bug the first probe hit)');
  assert(r.error.includes('non-101') || r.error.includes('network'),
    `ADR M2: the normalized error should carry the library's text, got "${r.error}"`);
});

test('P5: connect failure is retried exactly once before reporting unreachable (ADR M3)', async () => {
  const probe = loadProbe();

  // Flaky-then-healthy — the measured relay.damus.io case. Must NOT report unreachable.
  const rec = fakeRelay([ev()]);
  const flaky = flakyConnect(1, rec.relay);
  const ok = await probe('wss://x.example', FILTER, { connect: flaky.connect, verify: () => true });
  assert(ok.status === 'present',
    `ADR M3: a relay that throws once then connects must not be reported unreachable, got "${ok.status}"`);
  assert(flaky.calls === 2, `ADR M3: expected exactly 2 connect attempts (1 retry), got ${flaky.calls}`);

  // Genuinely dead — retry is BOUNDED at one, not a loop.
  const dead = flakyConnect(99, null);
  const bad = await probe('wss://x.example', FILTER, { connect: dead.connect, verify: () => true });
  assert(bad.status === 'unreachable', `expected "unreachable" for a persistently dead relay, got "${bad.status}"`);
  assert(dead.calls === 2, `ADR M3: the retry must be bounded at one — expected 2 connect attempts, got ${dead.calls}`);
});

test('P6: an event failing signature verification is discarded — the relay reads absent', async () => {
  const probe = loadProbe();
  const rec = fakeRelay([ev({ id: 'f'.repeat(64) })]);
  const r = await probe('wss://x.example', FILTER, { connect: async () => rec.relay, verify: () => false });
  assert(r.status === 'absent',
    `ADR § Consequences: a forged event must not let a relay claim "your Map was replaced" — expected "absent", got "${r.status}"`);
  assert(r.event === null, 'the unverified event must not be returned');
});

test('P7: events from the wrong author or of the wrong kind are discarded', async () => {
  const probe = loadProbe();
  const wrongAuthor = fakeRelay([ev({ pubkey: OTHER })]);
  const a = await probe('wss://x.example', FILTER, { connect: async () => wrongAuthor.relay, verify: () => true });
  assert(a.status === 'absent', `an event by another author must not count as presence, got "${a.status}"`);

  const wrongKind = fakeRelay([ev({ kind: 30382 })]);
  const b = await probe('wss://x.example', FILTER, { connect: async () => wrongKind.relay, verify: () => true });
  assert(b.status === 'absent', `an event of another kind must not count as presence, got "${b.status}"`);
});

test('P8: when a relay returns several valid events the newest is reported', async () => {
  const probe = loadProbe();
  const older = ev({ id: '1'.repeat(64), created_at: 1000 });
  const newer = ev({ id: '2'.repeat(64), created_at: 2000 });
  const rec = fakeRelay([older, newer]);
  const r = await probe('wss://x.example', FILTER, { connect: async () => rec.relay, verify: () => true });
  assert(r.status === 'present', `expected "present", got "${r.status}"`);
  assert(r.event.id === newer.id,
    `a replaceable kind reports the newest — expected created_at 2000, got ${r.event && r.event.created_at}`);
});

test('P9: the relay connection is closed on the success path and on the failure path', async () => {
  const probe = loadProbe();
  const rec = fakeRelay([ev()]);
  await probe('wss://x.example', FILTER, { connect: async () => rec.relay, verify: () => true });
  assert(rec.closed, 'the relay connection must be closed after a successful probe — connections must not leak');

  const closing = fakeRelay([], { closeInstead: true });
  await probe('wss://x.example', FILTER, { connect: async () => closing.relay, verify: () => true });
  assert(closing.closed, 'the relay connection must be closed when the subscription closes early');
});

test('P10: a relay that connects but never EOSEs resolves via the query timeout', async () => {
  const probe = loadProbe();
  const silent = fakeRelay([], { silent: true });
  const started = Date.now();
  const r = await probe('wss://x.example', FILTER, {
    connect: async () => silent.relay, verify: () => true, connectTimeoutMs: 100, queryTimeoutMs: 120,
  });
  assert(['absent', 'unreachable'].includes(r.status),
    `a silent relay must resolve to a terminal status, got "${r.status}"`);
  assert(Date.now() - started < 3000, 'the query timeout must be honored rather than hanging');
  assert(silent.closed, 'the connection must be closed after a query timeout');
});

/* ── A: the HTTP handler (AC-1 plumbing, AC-4 transport semantics) ── */

test('A1: a request with no relay is rejected', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  await handle({ query: { pubkey: AUTHOR, kind: String(KIND) } }, res, { probe: async () => ({ status: 'absent', event: null, error: null }) });
  assert(res.statusCode === 400, `expected 400 for a missing relay, got ${res.statusCode}`);
  assert(res.body && res.body.success === false, 'the rejection must report success:false');
});

test('A2: a non-websocket relay scheme is rejected', async () => {
  const handle = loadHandler();
  for (const relay of ['http://evil.example', 'https://evil.example', 'file:///etc/passwd', 'evil.example']) {
    const res = fakeRes();
    await handle({ query: { relay, pubkey: AUTHOR, kind: String(KIND) } }, res, { probe: async () => ({ status: 'absent', event: null, error: null }) });
    assert(res.statusCode === 400,
      `ADR § Consequences (posture held, not widened): "${relay}" must be rejected, got ${res.statusCode}`);
  }
});

test('A3: more than one relay per request is rejected', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  await handle({ query: { relay: 'wss://a.example,wss://b.example', pubkey: AUTHOR, kind: String(KIND) } }, res,
    { probe: async () => ({ status: 'absent', event: null, error: null }) });
  assert(res.statusCode === 400,
    `ADR: the endpoint accepts exactly one relay per request — a comma list must be rejected, got ${res.statusCode}`);
});

test('A4: a malformed pubkey is rejected', async () => {
  const handle = loadHandler();
  for (const pubkey of ['', 'nope', 'a'.repeat(63), 'g'.repeat(64)]) {
    const res = fakeRes();
    await handle({ query: { relay: 'wss://a.example', pubkey, kind: String(KIND) } }, res,
      { probe: async () => ({ status: 'absent', event: null, error: null }) });
    assert(res.statusCode === 400, `pubkey "${pubkey.slice(0, 12)}" must be rejected, got ${res.statusCode}`);
  }
});

test('A5: a malformed kind is rejected', async () => {
  const handle = loadHandler();
  for (const kind of ['', 'abc', '-1', '1.5']) {
    const res = fakeRes();
    await handle({ query: { relay: 'wss://a.example', pubkey: AUTHOR, kind } }, res,
      { probe: async () => ({ status: 'absent', event: null, error: null }) });
    assert(res.statusCode === 400, `kind "${kind}" must be rejected, got ${res.statusCode}`);
  }
});

test('A6: a present relay answers 200 with the relay, the status, and only id + created_at', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  const found = ev();
  await handle({ query: { relay: 'wss://a.example', pubkey: AUTHOR, kind: String(KIND) } }, res,
    { probe: async () => ({ status: 'present', event: found, error: null }) });
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
  const b = res.body || {};
  assert(b.success === true, 'expected success:true');
  assert(b.relay === 'wss://a.example', `the response must echo the relay, got ${b.relay}`);
  assert(b.status === 'present', `expected status "present", got "${b.status}"`);
  assert(b.event && b.event.id === found.id && b.event.created_at === found.created_at,
    `expected the found event's id + created_at, got ${JSON.stringify(b.event)}`);
  assert(!('sig' in b.event) && !('content' in b.event) && !('tags' in b.event),
    `ADR § Implementation notes 2: return ONLY id + created_at, got keys ${Object.keys(b.event).join(',')}`);
});

test('A7: an unreachable relay is a 200 carrying the status, not an HTTP error', async () => {
  const handle = loadHandler();
  const res = fakeRes();
  await handle({ query: { relay: 'wss://a.example', pubkey: AUTHOR, kind: String(KIND) } }, res,
    { probe: async () => ({ status: 'unreachable', event: null, error: 'boom' }) });
  assert(res.statusCode === 200,
    `ADR § Implementation notes 2: a relay-level failure is a 200 with status "unreachable" — a non-2xx would conflate transport with outcome; got ${res.statusCode}`);
  assert(res.body && res.body.status === 'unreachable', `expected status "unreachable", got "${res.body && res.body.status}"`);
});

/* ── C: configuration (AC-1) ─────────────────────────────────── */

test('C1: defaults.json ships the Tapestry instance relay group with the three instances', () => {
  const raw = safeRead(DEFAULTS);
  assert(raw, 'src/config/defaults.json must be readable');
  const groups = (JSON.parse(raw).aRelays) || {};
  const g = groups.aTapestryInstanceRelays;
  assert(Array.isArray(g),
    'AC-1: aRelays.aTapestryInstanceRelays must exist so the Tapestry instances are checked and operator-editable');
  for (const url of ['wss://tapestry.brainstorm.world/relay', 'wss://staging.brainstorm.world/relay', 'wss://tags.brainstorm.world/relay']) {
    assert(g.includes(url), `AC-1: aTapestryInstanceRelays must include ${url}`);
  }
});

/* ── T: the pure client helpers (AC-1, AC-2, AC-3) ───────────── */

test('T1: buildPresenceTargets unions the named groups, dedupes, and keeps every group label', async () => {
  const { buildPresenceTargets } = await utils();
  assert(typeof buildPresenceTargets === 'function',
    'AC-1: ui/src/utils/treasureMap.js must export buildPresenceTargets(aRelays, groupKeys)');
  const aRelays = {
    aTapestryInstanceRelays: ['wss://tap.example'],
    aTrustedListRelays: ['wss://shared.example', 'wss://tl.example'],
    aTrustedAssertionRelays: ['wss://shared.example'],
    aProfileRelays: ['wss://profiles.example'],
  };
  const rows = buildPresenceTargets(aRelays, ['aTapestryInstanceRelays', 'aTrustedListRelays', 'aTrustedAssertionRelays']);
  const urls = rows.map(r => r.url);
  assert(urls.length === 3, `expected 3 deduped relays, got ${urls.length}: ${urls.join(', ')}`);
  assert(!urls.includes('wss://profiles.example'), 'a group that was not asked for must not be checked');
  assert(urls[0] === 'wss://tap.example', `group order must be preserved, got ${urls.join(', ')}`);
  const shared = rows.find(r => r.url === 'wss://shared.example');
  assert(shared && shared.groups.length === 2,
    `a relay in two groups appears once carrying both labels, got ${JSON.stringify(shared)}`);
});

test('T2: buildPresenceTargets tolerates missing, empty and malformed config without throwing', async () => {
  const { buildPresenceTargets } = await utils();
  assert(buildPresenceTargets(null, ['aTapestryInstanceRelays']).length === 0, 'null config yields no targets');
  assert(buildPresenceTargets({}, ['aTapestryInstanceRelays']).length === 0, 'a missing group yields no targets');
  assert(buildPresenceTargets({ aTapestryInstanceRelays: 'not-an-array' }, ['aTapestryInstanceRelays']).length === 0,
    'a non-array group must be ignored, not crash the panel');
  assert(buildPresenceTargets({ aTapestryInstanceRelays: ['wss://a.example', 'wss://a.example'] }, ['aTapestryInstanceRelays']).length === 1,
    'the same URL listed twice in one group is one row');
});

test('T3: compareMapVersions calls an identical event the version being displayed', async () => {
  const { compareMapVersions } = await utils();
  assert(typeof compareMapVersions === 'function',
    'AC-2: ui/src/utils/treasureMap.js must export compareMapVersions(displayed, found)');
  const displayed = ev();
  assert(compareMapVersions(displayed, { id: displayed.id, created_at: displayed.created_at }) === 'same',
    'AC-2: a matching event id means the relay holds the version being displayed');
});

test('T4: compareMapVersions reports a divergent version as older or newer', async () => {
  const { compareMapVersions } = await utils();
  const displayed = ev({ created_at: 2000 });
  assert(compareMapVersions(displayed, { id: 'c'.repeat(64), created_at: 1000 }) === 'older',
    'AC-3: a different event with an earlier created_at is older');
  assert(compareMapVersions(displayed, { id: 'c'.repeat(64), created_at: 3000 }) === 'newer',
    'AC-3: a different event with a later created_at is newer');
});

test('T5: a divergent version with an equal timestamp claims no order', async () => {
  const { compareMapVersions } = await utils();
  const displayed = ev({ created_at: 2000 });
  const r = compareMapVersions(displayed, { id: 'c'.repeat(64), created_at: 2000 });
  assert(r === 'divergent',
    `AC-3 edge: same created_at with a different id must not claim older or newer — expected "divergent", got "${r}"`);
});

test('T6: compareMapVersions returns null rather than throwing on missing input', async () => {
  const { compareMapVersions } = await utils();
  assert(compareMapVersions(ev(), null) === null, 'no found event yields null');
  assert(compareMapVersions(null, { id: 'c'.repeat(64), created_at: 1 }) === null, 'no displayed event yields null');
});

/* ── S: wiring with no behavioral surface from Node ──────────── */

test('S1: the presence route is registered on the API', () => {
  const src = safeRead(API_INDEX);
  assert(/['"]\/api\/relay\/presence['"]/.test(src),
    'ADR § Implementation notes 3: src/api/index.js must register GET /api/relay/presence');
  assert(/handleRelayPresence/.test(src), 'src/api/index.js must wire handleRelayPresence');
});

test('S2: the Relay Settings page exposes the Tapestry instance group for editing', () => {
  const src = safeRead(RELAY_SETTINGS);
  assert(src.includes('aTapestryInstanceRelays'),
    'AC-1: RELAY_GROUPS must include aTapestryInstanceRelays — this is what makes "without a code change" true');
});

test('S3: the page mounts the presence panel', () => {
  const panel = safeRead(PANEL);
  assert(panel, 'ui/src/pages/grapevine/TreasureMapRelayPresence.jsx must exist');
  const page = safeRead(PAGE);
  assert(/TreasureMapRelayPresence/.test(page), 'TrustedAssertions.jsx must import and render TreasureMapRelayPresence');
});

test('S4: no relay URL is hardcoded in the panel or the page', () => {
  const panel = safeRead(PANEL);
  // Guard against a vacuous pass: an absent panel trivially contains no URL.
  assert(panel, 'ui/src/pages/grapevine/TreasureMapRelayPresence.jsx must exist for this check to mean anything');
  for (const [name, src] of [['TreasureMapRelayPresence.jsx', panel], ['TrustedAssertions.jsx', safeRead(PAGE)]]) {
    assert(!/wss?:\/\/[a-z0-9]/i.test(src),
      `AC-1: ${name} must carry no relay URL literal — the checked set comes from configuration`);
  }
});

test('S5: the panel resolves its relays from configuration, by group key', () => {
  const src = safeRead(PANEL);
  assert(/useConfig/.test(src), 'AC-1: the panel must read aRelays via useConfig()');
  assert(/buildPresenceTargets/.test(src), 'AC-1: the panel must build its targets with the shared helper');
  assert(/aTapestryInstanceRelays/.test(src) && /aPopularGeneralPurposeRelays/.test(src),
    'AC-1: the panel names the group KEYS it checks (keys are policy; URLs are configuration)');
});

test('S6: rows resolve per relay, not in one settled batch', () => {
  const src = safeRead(PANEL);
  // Guard against a vacuous pass: an absent panel trivially contains no Promise.all.
  assert(src, 'ui/src/pages/grapevine/TreasureMapRelayPresence.jsx must exist for this check to mean anything');
  assert(!/Promise\.(all|allSettled)\s*\(/.test(src),
    'AC-5: the panel must not gate its rows on a settled batch — that is exactly "the whole panel waiting on the slowest relay"');
});

/* ── R: sentinels — pass before AND after ────────────────────── */

test('R1: the page still mounts the TL opt-in card and the manual editor', () => {
  const page = safeRead(PAGE);
  assert(/TlOptInCard/.test(page), 'tl-treasure-map #3 must survive: TlOptInCard is still mounted');
  assert(/TreasureMapManualEdit/.test(page),
    'treasure-map-user-assistant #2 must survive: the hand-edit panel is still mounted by the page');
});

test('R2: the Import to local strfry affordance survives the panel move', () => {
  const combined = safeRead(PAGE) + safeRead(PANEL);
  assert(/Import to local strfry/.test(combined),
    'shipped behavior: the Import to local strfry button must still exist (in the page or the panel it moved into)');
  assert(/\/api\/strfry\/publish/.test(safeRead(PAGE)),
    'the import handler must still post to /api/strfry/publish');
});

test('R3: the existing Treasure-Map helpers are untouched', async () => {
  const mod = await utils();
  for (const fn of ['classifyEntry', 'findGenericTlDelegation', 'composeManualUpdate', 'upsertGenericTlTag']) {
    assert(typeof mod[fn] === 'function', `tl-treasure-map exports must survive: ${fn} is still exported`);
  }
  const r = mod.classifyEntry(['30382:rank', AUTHOR, 'wss://nip85.brainstorm.world']);
  assert(r.cls === 'ta' && r.kind === 30382 && r.name === 'rank', 'classifyEntry still classifies a NIP-85 metric entry');
});

test('R4: no 64-hex pubkey literal in the new or changed UI files', () => {
  for (const [name, src] of [['TreasureMapRelayPresence.jsx', safeRead(PANEL)], ['TrustedAssertions.jsx', safeRead(PAGE)], ['treasureMap.js', safeRead(UTIL)]]) {
    assert(!/[0-9a-fA-F]{64}/.test(src),
      `CLAUDE.md § per-deployment TA pubkey: ${name} must not carry a 64-hex literal`);
  }
});

test('R5: /api/relay/external keeps its merging behavior — the new probe is additive', () => {
  const src = safeRead(FETCH_EVENTS);
  assert(/SimplePool/.test(src) && /querySync/.test(src),
    'ADR § Out of scope: fetchEvents.js is not the thing being fixed — it keeps its SimplePool merge');
  assert(/seen\.has\(ev\.id\)|Deduplicate by event ID/.test(src),
    'fetchEvents.js keeps its dedupe — callers of the old endpoint must not change behavior');
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
