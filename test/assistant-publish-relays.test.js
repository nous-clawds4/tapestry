/**
 * assistant-profile #2: Publish the assistant's profile to the right relays, and say what happened.
 *
 * Story: engineering-team/stories/assistant-profile/2-publish-to-the-right-relays.md
 * ADR:   engineering-team/decisions/assistant-profile/0002-publish-to-configured-relays-report-each.md
 * Plan:  engineering-team/stories/assistant-profile/2-publish-to-the-right-relays.test-plan.md
 * Browser half: tests/brainstorm/assistant-publish-result.spec.js (B-class — what the editor SHOWS).
 *
 * Classes (all stack-free — no strfry, no Neo4j, no public relay traffic):
 *   L — the publish set: getConfiguredPublishRelays / getAssistantPublishRelays with injected
 *       settings and local-only flag. L5 goes through the real settings module and a temp settings
 *       file, which is what "no code change, no restart" means in practice.
 *   P — publishToRelays, the REAL per-relay publish, against throwaway relays on 127.0.0.1
 *       (ephemeral ports, `ws`): accept, refuse, answer late, stay silent, close early, NOTICE then
 *       close, OK for the wrong event, a dead port, and a TLS relay whose certificate no client trusts.
 *   M — the words: publishSubject (whose assistant) and summarizePublish (outcome, counts, message).
 *   E — the publish handler through its dependency seam (createPublishProfileHandler): what is sent
 *       where, in what order, and what the response says.
 *   G — the one local-only reader, isPublishLocalOnly (src/api/publish-policy).
 *   S — source sentinels for what the others cannot reach.
 *
 * Against current code everything FAILS except the S3 guard: profilePublish.js does not exist, the
 * handler has no seam, the publish list is five literals in index.js, and publish-policy exports no
 * reader.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PUBLISH_MOD = path.join(REPO, 'src/api/assistant/profilePublish.js');
const ASSISTANT_SRC = path.join(REPO, 'src/api/assistant/index.js');
const POLICY_SRC = path.join(REPO, 'src/api/publish-policy/index.js');
const SETTINGS_MOD = path.join(REPO, 'src/config/settings.js');

// Fixture keys — never live ones.
const OWNER = 'bb'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const STRANGER = 'dd'.repeat(32);

const PUBLISH_BUDGET_MS = 8000;  // ADR 0002 § Implementation notes — the whole fan-out's deadline
const TEST_BUDGET_MS = 1500;     // what the P-class hands publishToRelays, so the suite stays quick
const SLACK_MS = 1000;           // scheduling slack on a busy CI runner

// The relay settings as local, staging and production hold them (GET /api/relays, 2026-09-12),
// including the lists that must NOT receive assistant profiles.
const TODAY = {
  aPopularGeneralPurposeRelays: ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'],
  aDListRelays: ['wss://dcosl.brainstorm.world'],
  aTrustedAssertionRelays: ['wss://nip85.brainstorm.world', 'wss://nip85.nostr1.com'],
  aTrustedListRelays: ['wss://nip85.brainstorm.world', 'wss://dcosl.brainstorm.world'],
  aTapestryInstanceRelays: ['wss://tapestry.brainstorm.world/relay', 'wss://staging.brainstorm.world/relay'],
  aWotRelays: ['wss://wot.grapevine.network'],
  aProfileRelays: ['wss://purplepag.es', 'wss://profiles.nostr1.com'],
  aOutboxRelays: [],
  aTagFederationRelays: ['wss://dcosl.brainstorm.world'],
  safeModeRelays: ['wss://nip85.brainstorm.world', 'wss://wot.grapevine.network'],
};
// The story's resolved open question: general-purpose, then profile, then WoT.
const SIX = [
  'wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol',
  'wss://purplepag.es', 'wss://profiles.nostr1.com',
  'wss://wot.grapevine.network',
];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const j = (v) => JSON.stringify(v);

/** The module under test — or a failure that says exactly what is missing. */
function getPublishModule() {
  if (!fs.existsSync(PUBLISH_MOD)) {
    throw new Error('src/api/assistant/profilePublish.js does not exist. ADR 0002 creates it: the publish set ' +
      '(getConfiguredPublishRelays, getAssistantPublishRelays), the per-relay publish (publishToRelays) and the ' +
      'words (publishSubject, summarizePublish).');
  }
  delete require.cache[require.resolve(PUBLISH_MOD)];
  return require(PUBLISH_MOD);
}
function need(mod, name) {
  if (typeof mod[name] !== 'function') {
    throw new Error(`src/api/assistant/profilePublish.js does not export ${name}() (ADR 0002 § Implementation notes).`);
  }
  return mod[name];
}
const settingsWith = (aRelays) => () => ({ aRelays });

/** Run `fn` with one environment variable set (or removed, for `undefined`), then restore it. */
function withEnv(key, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const old = process.env[key];
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
  try { return fn(); } finally { if (had) process.env[key] = old; else delete process.env[key]; }
}

/**
 * withEnv for an async body. The synchronous version restores the variable as soon as the body
 * SUSPENDS, so anything after an `await` would read the restored value — which is what made G2 read
 * the flag back as off while the endpoint had answered with it on.
 */
async function withEnvAsync(key, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const old = process.env[key];
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
  try { return await fn(); } finally { if (had) process.env[key] = old; else delete process.env[key]; }
}

/** Resolve within `ms`, or report 'HUNG' — clearing the timer either way. */
async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

/** The source of a top-level function, up to the next top-level declaration. */
function functionBody(src, name) {
  const start = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) return '';
  const rest = src.slice(start + 1);
  const next = rest.search(/\n(?:async\s+function|function|const|let|module\.exports)\b/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

/** Source with comments removed, leaving `wss://` inside strings intact. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');
}

/* ───────────────────────── P-class fixtures: throwaway relays on 127.0.0.1 ───────────────────────── */

function signedProfile() {
  const nt = require('nostr-tools');
  const sk = nt.generateSecretKey();
  return nt.finalizeEvent({
    kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [], content: JSON.stringify({ name: 'fixture assistant' }),
  }, sk);
}

/**
 * A throwaway relay that receives EVENTs. `onEvent(ws, event)` decides the answer; an `onEvent` that
 * does nothing makes a relay that takes the event and never says a word. Pass `tls: { key, cert }`
 * for a wss:// relay.
 */
function publishRelay(onEvent, tls) {
  const { WebSocketServer } = require('ws');
  return new Promise((resolve, reject) => {
    const server = tls ? require('https').createServer(tls) : null;
    const wss = tls ? new WebSocketServer({ server }) : new WebSocketServer({ host: '127.0.0.1', port: 0 });
    const seen = [];
    const ready = (port) => {
      wss.on('connection', (ws) => {
        ws.on('message', (raw) => {
          let msg;
          try { msg = JSON.parse(raw.toString()); } catch { return; }
          if (Array.isArray(msg) && msg[0] === 'EVENT') { seen.push(msg[1]); onEvent(ws, msg[1]); }
        });
      });
      resolve({
        url: `${tls ? 'wss' : 'ws'}://127.0.0.1:${port}`,
        seen,
        openClients: () => wss.clients.size,
        close: () => {
          for (const client of wss.clients) client.terminate();
          wss.close();
          if (server) server.close();
        },
      });
    };
    if (server) {
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => ready(server.address().port));
    } else {
      wss.on('error', reject);
      wss.on('listening', () => ready(wss.address().port));
    }
  });
}

/** A port on 127.0.0.1 with nothing listening — every connection is refused. */
function deadPortUrl() {
  const net = require('net');
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(`ws://127.0.0.1:${port}`)); });
  });
}

/** A fresh self-signed certificate — what an "invalid certificate" looks like to every client. Null without openssl. */
function selfSignedCert() {
  const { execFileSync } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2-tls-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=127.0.0.1',
      '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem')], { stdio: 'ignore', timeout: 30000 });
    return { key: fs.readFileSync(path.join(dir, 'key.pem')), cert: fs.readFileSync(path.join(dir, 'cert.pem')) };
  } catch {
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const okFrame = (ws, event, accepted, message = '') => ws.send(JSON.stringify(['OK', event.id, accepted, message]));
const rowFor = (rows, url) => (Array.isArray(rows) ? rows.find((r) => r && r.relay === url) : undefined);

/* ───────────────────────── L — the publish set ───────────────────────── */

test('L0: src/api/assistant/profilePublish.js exists, exports the publish set, the per-relay publish and the words, and bounds the fan-out at 8 s (ADR 0002)', () => {
  const mod = getPublishModule();
  for (const name of ['getConfiguredPublishRelays', 'getAssistantPublishRelays', 'publishToRelays', 'publishSubject', 'summarizePublish']) {
    need(mod, name);
  }
  assert(mod.PUBLISH_BUDGET_MS === PUBLISH_BUDGET_MS,
    `AC5/ADR 0002: one ${PUBLISH_BUDGET_MS} ms deadline bounds the whole fan-out — PUBLISH_BUDGET_MS is ${j(mod.PUBLISH_BUDGET_MS)}`);
});

test('L1: the publish set is exactly the configured general-purpose, profile and WoT relays, in that order — no other relay list', () => {
  const get = need(getPublishModule(), 'getConfiguredPublishRelays');
  const list = get({ deps: { getSettings: settingsWith(TODAY) } });
  assert(j(list) === j(SIX),
    `AC1: expected the general-purpose, profile and WoT lists, in that order — ${j(SIX)} — got ${j(list)}. ` +
    'The DList, trusted-assertion, trusted-list, Tapestry-instance, outbox, tag-federation and safe-mode lists are not publish targets.');
});

test('L2: a relay named in several lists, or spelled differently, is published to once — in its first spelling', () => {
  const get = need(getPublishModule(), 'getConfiguredPublishRelays');
  const list = get({ deps: { getSettings: settingsWith({
    aPopularGeneralPurposeRelays: ['wss://nos.lol', 'wss://Relay.Example.com/'],
    aProfileRelays: ['wss://purplepag.es', 'wss://nos.lol/', 'wss://relay.example.com'],
    aWotRelays: ['WSS://PURPLEPAG.ES', 'wss://wot.grapevine.network'],
  }) } });
  const expected = ['wss://nos.lol', 'wss://Relay.Example.com/', 'wss://purplepag.es', 'wss://wot.grapevine.network'];
  assert(j(list) === j(expected),
    `AC1: each relay once — duplicates compared lowercased with one trailing "/" removed, first spelling kept — expected ${j(expected)}, got ${j(list)}`);
});

test('L3: changing the relay lists changes the very next publish set — nothing is cached', () => {
  const get = need(getPublishModule(), 'getConfiguredPublishRelays');
  let current = { aPopularGeneralPurposeRelays: ['wss://first.example'], aProfileRelays: [], aWotRelays: [] };
  const deps = { getSettings: () => ({ aRelays: current }) };
  const before = get({ deps });
  current = { aPopularGeneralPurposeRelays: ['wss://second.example'], aProfileRelays: ['wss://profile.example'], aWotRelays: [] };
  const after = get({ deps });
  assert(j(before) === j(['wss://first.example']), `precondition: got ${j(before)}`);
  assert(j(after) === j(['wss://second.example', 'wss://profile.example']),
    `AC1: after the lists change, the next publish must follow them — got ${j(after)}`);
});

test('L4: entries that are not relay URLs are left out, and missing or empty lists mean an empty publish set', () => {
  const get = need(getPublishModule(), 'getConfiguredPublishRelays');
  const list = get({ deps: { getSettings: settingsWith({
    aPopularGeneralPurposeRelays: ['wss://ok.example', 'https://not-a-relay.example', 'relay.example', 42, null, '  wss://trimmed.example  ', 'ws://plain.example'],
    aProfileRelays: 'wss://not-in-a-list.example',
    // aWotRelays missing altogether
  }) } });
  const expected = ['wss://ok.example', 'wss://trimmed.example', 'ws://plain.example'];
  assert(j(list) === j(expected), `only ws:// and wss:// URLs are relays — expected ${j(expected)}, got ${j(list)}`);
  const empty = get({ deps: { getSettings: settingsWith({ aPopularGeneralPurposeRelays: [], aProfileRelays: [], aWotRelays: [] }) } });
  const noRelays = get({ deps: { getSettings: () => ({}) } });
  assert(Array.isArray(empty) && empty.length === 0, `empty lists → an empty publish set, got ${j(empty)}`);
  assert(Array.isArray(noRelays) && noRelays.length === 0, `no aRelays at all → an empty publish set, got ${j(noRelays)}`);
});

test('L5: through the real settings module, editing the relay lists in the settings file changes the very next publish set — no code change, no restart', () => {
  getPublishModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2-settings-'));
  const file = path.join(dir, 'settings.json');
  const write = (aRelays) => fs.writeFileSync(file, JSON.stringify({ aRelays }));
  const saved = process.env.TAPESTRY_SETTINGS_PATH;
  try {
    write({ aPopularGeneralPurposeRelays: ['wss://first.example'], aProfileRelays: [], aWotRelays: [] });
    process.env.TAPESTRY_SETTINGS_PATH = file;
    delete require.cache[require.resolve(SETTINGS_MOD)];   // settings.js reads the path when it loads (:16-17)
    const mod = getPublishModule();                          // fresh, so its lazy require meets the fresh settings module
    const before = need(mod, 'getConfiguredPublishRelays')();
    write({ aPopularGeneralPurposeRelays: ['wss://second.example'], aProfileRelays: ['wss://profile.example'], aWotRelays: [] });
    const after = mod.getConfiguredPublishRelays();
    assert(j(before) === j(['wss://first.example']),
      `with no injected settings the publish set must come from the real settings file — got ${j(before)}`);
    assert(j(after) === j(['wss://second.example', 'wss://profile.example']),
      `AC1: the Relays settings page writes this file (PUT /api/settings → updateOverrides); the next publish must follow it with no restart — got ${j(after)}`);
  } finally {
    if (saved === undefined) delete process.env.TAPESTRY_SETTINGS_PATH; else process.env.TAPESTRY_SETTINGS_PATH = saved;
    delete require.cache[require.resolve(SETTINGS_MOD)];
    try { delete require.cache[require.resolve(PUBLISH_MOD)]; } catch { /* module absent */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('L6: in local-only publish mode the publish set is empty — whether the caller passes the flag or the module reads it', () => {
  const getA = need(getPublishModule(), 'getAssistantPublishRelays');
  const getSettings = settingsWith(TODAY);
  const read = getA({ deps: { getSettings, isLocalOnly: () => true } });
  const passed = getA({ localOnly: true, deps: { getSettings, isLocalOnly: () => false } });
  const off = getA({ deps: { getSettings, isLocalOnly: () => false } });
  assert(Array.isArray(read) && read.length === 0, `AC3: local-only (read from the flag) → no relay at all, got ${j(read)}`);
  assert(Array.isArray(passed) && passed.length === 0, `AC3: local-only (passed by the caller as options.localOnly) → no relay at all, got ${j(passed)}`);
  assert(j(off) === j(SIX), `outside local-only mode the publish set is the configured one, got ${j(off)}`);
});

test('L7: the setup check and the publisher share one list — index.js hands out the configured set, and in local-only mode it names no relay', () => {
  const pub = getPublishModule();
  need(pub, 'getConfiguredPublishRelays');
  delete require.cache[require.resolve(ASSISTANT_SRC)];
  let idx;
  try { idx = require(ASSISTANT_SRC); } catch (err) { throw new Error(`src/api/assistant/index.js failed to load: ${err.message}`); }
  assert(typeof idx.getAssistantPublishRelays === 'function', 'index.js must keep exporting getAssistantPublishRelays (ADR 0002)');
  withEnv('BRAINSTORM_PUBLISH_LOCAL_ONLY', 'false', () => {
    const a = idx.getAssistantPublishRelays();
    const b = pub.getConfiguredPublishRelays();
    assert(Array.isArray(a) && a.length > 0 && j(a) === j(b),
      `AC2: the list /api/assistant/status hands the setup check (index.js getAssistantPublishRelays) must be the configured publish set — got ${j(a)}, configured ${j(b)}`);
  });
  withEnv('BRAINSTORM_PUBLISH_LOCAL_ONLY', 'true', () => {
    const list = idx.getAssistantPublishRelays();
    assert(Array.isArray(list) && list.length === 0,
      `AC2/AC3: in local-only mode the setup check may consult no outside relay, because none is in the publish set — got ${j(list)}`);
  });
});

/* ───────────────────────── P — the real per-relay publish ───────────────────────── */

test('P1: a relay that answers OK true is "accepted", with the relay\'s own words as the reason', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const ev = signedProfile();
  const relay = await publishRelay((ws, e) => okFrame(ws, e, true, 'duplicate: already have this event'));
  try {
    const rows = await within(publish(ev, [relay.url], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
    assert(rows !== 'HUNG', 'publishToRelays never returned');
    assert(Array.isArray(rows) && rows.length === 1, `one row per relay, got ${j(rows)}`);
    assert(rows[0].relay === relay.url && rows[0].status === 'accepted', `AC4: OK true means accepted — got ${j(rows[0])}`);
    assert(rows[0].reason === 'duplicate: already have this event', `the relay's own words travel with the row — got ${j(rows[0].reason)}`);
    assert(relay.seen.length === 1 && relay.seen[0].id === ev.id, 'the relay must receive exactly the signed event');
  } finally { relay.close(); }
});

test('P2: a relay that answers OK false is "refused", with the relay\'s own reason', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const ev = signedProfile();
  const relay = await publishRelay((ws, e) => okFrame(ws, e, false, 'blocked: kind 0 only from members'));
  try {
    const rows = await within(publish(ev, [relay.url], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
    const r = rowFor(rows, relay.url);
    assert(r && r.status === 'refused', `AC4: OK false means the relay rejected it — got ${j(r)}`);
    assert(r.reason === 'blocked: kind 0 only from members', `AC4: "rejected (with the relay's own reason)" — got ${j(r.reason)}`);
  } finally { relay.close(); }
});

test('P3: a relay that answers late — but inside the budget — still counts as accepted', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const ev = signedProfile();
  const relay = await publishRelay((ws, e) => setTimeout(() => okFrame(ws, e, true), 400));
  try {
    const rows = await within(publish(ev, [relay.url], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
    const r = rowFor(rows, relay.url);
    assert(r && r.status === 'accepted', `a relay that answers 400 ms in, inside a ${TEST_BUDGET_MS} ms budget, is accepted — got ${j(r)}`);
  } finally { relay.close(); }
});

test('P4: a relay that takes the event and never answers is "timeout" at the deadline — and does not stop the relay beside it', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const ev = signedProfile();
  const silent = await publishRelay(() => { /* takes the event; never says a word */ });
  const good = await publishRelay((ws, e) => okFrame(ws, e, true));
  try {
    const started = Date.now();
    const rows = await within(publish(ev, [silent.url, good.url], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
    const elapsed = Date.now() - started;
    assert(rows !== 'HUNG', `publishToRelays never returned (${elapsed} ms) — AC5 asks for a result within a bounded time`);
    assert(j(rows.map((r) => r.relay)) === j([silent.url, good.url]), `rows come back in input order, got ${j(rows.map((r) => r.relay))}`);
    assert(rowFor(rows, silent.url).status === 'timeout', `a relay that never answers is "timeout", got ${j(rowFor(rows, silent.url))}`);
    assert(rowFor(rows, good.url).status === 'accepted', `AC5: a silent relay must not stop the others — got ${j(rowFor(rows, good.url))}`);
    assert(elapsed >= TEST_BUDGET_MS - 150, `a silent relay is given the whole budget, but the call returned after ${elapsed} ms`);
    assert(elapsed < TEST_BUDGET_MS + SLACK_MS, `AC5: the call took ${elapsed} ms for a ${TEST_BUDGET_MS} ms budget`);
  } finally { silent.close(); good.close(); }
});

test('P5: a port where nothing listens is "unreachable", with the connection error as the reason — at once, not at the deadline', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const url = await deadPortUrl();
  const started = Date.now();
  const rows = await within(publish(signedProfile(), [url], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
  const elapsed = Date.now() - started;
  const r = rowFor(rows, url);
  assert(r && r.status === 'unreachable', `AC4: a refused connection is unreachable — got ${j(r)}`);
  assert(typeof r.reason === 'string' && r.reason.length > 0, `the connection error travels as the reason, got ${j(r.reason)}`);
  assert(elapsed < TEST_BUDGET_MS / 2, `a refused connection settles at once; it took ${elapsed} ms`);
});

test('P6: a relay that closes without answering is "unreachable"; one that sends a NOTICE and then closes is "refused", with the NOTICE as the reason', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const closer = await publishRelay((ws) => ws.close());
  const noticer = await publishRelay((ws) => {
    ws.send(JSON.stringify(['NOTICE', 'rate-limited: slow down']));
    setTimeout(() => ws.close(), 30);
  });
  try {
    const rows = await within(publish(signedProfile(), [closer.url, noticer.url], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
    const c = rowFor(rows, closer.url);
    const n = rowFor(rows, noticer.url);
    assert(c && c.status === 'unreachable' && /closed/i.test(c.reason || ''),
      `a relay that hangs up without an answer is unreachable, and says it closed — got ${j(c)}`);
    assert(n && n.status === 'refused' && n.reason === 'rate-limited: slow down',
      `a NOTICE followed by a hang-up is the relay refusing, in its own words — got ${j(n)}`);
  } finally { closer.close(); noticer.close(); }
});

test('P7: an OK for a different event is not an answer — only the OK naming our event counts', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const ev = signedProfile();
  const relay = await publishRelay((ws, e) => {
    ws.send(JSON.stringify(['OK', 'f'.repeat(64), false, 'blocked: some other event']));
    setTimeout(() => okFrame(ws, e, true), 50);
  });
  try {
    const rows = await within(publish(ev, [relay.url], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
    const r = rowFor(rows, relay.url);
    assert(r && r.status === 'accepted', `the OK for another event id must be ignored, and ours honoured — got ${j(r)}`);
  } finally { relay.close(); }
});

test('P8: a relay presenting a certificate no client trusts is "unreachable", naming the certificate — and the relay beside it still gets the event', async () => {
  const tls = selfSignedCert();
  if (!tls) { console.log('        (openssl is not available here — the certificate case cannot be staged)'); return 'SKIP'; }
  const publish = need(getPublishModule(), 'publishToRelays');
  const bad = await publishRelay((ws, e) => okFrame(ws, e, true), tls);   // would accept, if anyone could connect
  const good = await publishRelay((ws, e) => okFrame(ws, e, true));
  try {
    const rows = await within(publish(signedProfile(), [bad.url, good.url], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
    const b = rowFor(rows, bad.url);
    assert(b && b.status === 'unreachable' && /certificate/i.test(b.reason || ''),
      `AC5: an invalid certificate is unreachable, with the TLS error as the reason — got ${j(b)}`);
    assert(bad.seen.length === 0, 'the event must never reach a relay whose certificate failed');
    assert(rowFor(rows, good.url) && rowFor(rows, good.url).status === 'accepted',
      `AC5: the publish to the other relays still completes — got ${j(rowFor(rows, good.url))}`);
  } finally { bad.close(); good.close(); }
  return undefined;
});

test('P9: silent, refusing, dead and accepting relays together — every one reported, in input order, all inside one shared deadline', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const ev = signedProfile();
  const silent = await Promise.all([1, 2, 3].map(() => publishRelay(() => {})));
  const refusing = await publishRelay((ws, e) => okFrame(ws, e, false, 'restricted: fixture'));
  const dead = await deadPortUrl();
  const accepting = await publishRelay((ws, e) => okFrame(ws, e, true));
  const urls = [...silent.map((s) => s.url), refusing.url, dead, accepting.url];
  try {
    const started = Date.now();
    const rows = await within(publish(ev, urls, { budgetMs: TEST_BUDGET_MS }), 3 * TEST_BUDGET_MS + 4000);
    const elapsed = Date.now() - started;
    assert(rows !== 'HUNG', 'publishToRelays never returned');
    assert(j(rows.map((r) => r.relay)) === j(urls), `one row per relay, in input order — got ${j(rows.map((r) => r.relay))}`);
    assert(j(rows.map((r) => r.status)) === j(['timeout', 'timeout', 'timeout', 'refused', 'unreachable', 'accepted']),
      `each relay classified by what it did — got ${j(rows.map((r) => r.status))}`);
    assert(elapsed < TEST_BUDGET_MS + SLACK_MS,
      `AC5: three silent relays share ONE deadline — the call took ${elapsed} ms for a ${TEST_BUDGET_MS} ms budget (one timer per relay in sequence would take ${3 * TEST_BUDGET_MS} ms)`);
  } finally { for (const s of silent) s.close(); refusing.close(); accepting.close(); }
});

test('P10: it never throws — a malformed relay URL is an "unreachable" row, and no relays means no rows', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  let rows;
  try {
    rows = await within(publish(signedProfile(), ['not a relay url', 'ws://'], { budgetMs: TEST_BUDGET_MS }), TEST_BUDGET_MS + 4000);
  } catch (err) {
    throw new Error(`publishToRelays must never reject — a bad URL is a row, not an exception — but threw: ${err.message}`);
  }
  assert(Array.isArray(rows) && rows.length === 2 && rows.every((r) => r.status === 'unreachable' && typeof r.reason === 'string' && r.reason.length > 0),
    `each malformed URL is an unreachable row with a reason — got ${j(rows)}`);
  const none = await within(publish(signedProfile(), [], { budgetMs: TEST_BUDGET_MS }), 2000);
  assert(Array.isArray(none) && none.length === 0, `no relays → no rows, at once — got ${j(none)}`);
});

test('P11: once a relay is settled its socket is closed — a publish leaves no connection open behind it', async () => {
  const publish = need(getPublishModule(), 'publishToRelays');
  const silent = await publishRelay(() => {});
  try {
    await within(publish(signedProfile(), [silent.url], { budgetMs: 600 }), 5000);
    const deadline = Date.now() + 1500;
    while (silent.openClients() > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    assert(silent.openClients() === 0,
      `ADR 0002: a settled relay's socket is terminated — ${silent.openClients()} connection(s) still open 1.5 s after the publish returned`);
  } finally { silent.close(); }
});

/* ───────────────────────── M — the words ───────────────────────── */

const rowsOf = (...specs) => specs.map(([relay, status, reason = '']) => ({ relay, status, reason }));

test('M1: the result names the right assistant — the instance\'s for the owner, "your" for anyone publishing their own, and a named one otherwise', () => {
  const subject = need(getPublishModule(), 'publishSubject');
  const owner = subject({ isOwnerTarget: true, isSelf: true, targetPubkey: OWNER });
  const self = subject({ isOwnerTarget: false, isSelf: true, targetPubkey: CUSTOMER });
  const other = subject({ isOwnerTarget: false, isSelf: false, targetPubkey: CUSTOMER });
  const last6 = require('nostr-tools').nip19.npubEncode(CUSTOMER).slice(-6);
  assert(owner === "The Tapestry Assistant's profile", `AC4: the owner's assistant is the instance TA — got ${j(owner)}`);
  assert(self === "Your Tapestry Assistant's profile",
    `AC4: a Customer or Admin publishing their own assistant must read "Your …", never the instance's name for it — got ${j(self)}`);
  assert(/Tapestry Assistant/.test(other) && /npub/.test(other) && other.includes(last6) && !/^Your\b/.test(other),
    `AC4: the owner publishing for someone else names that assistant by the npub's last 6 (${last6}) — got ${j(other)}`);
});

test('M2: a partial result counts only the relays that accepted — "accepted by 1 of 4", and says the rest did not', () => {
  const mod = getPublishModule();
  const s = need(mod, 'publishSubject')({ isOwnerTarget: false, isSelf: true, targetPubkey: CUSTOMER });
  const out = need(mod, 'summarizePublish')({
    subject: s, localOnly: false,
    rows: rowsOf(['wss://a.example', 'accepted'], ['wss://b.example', 'refused', 'blocked'], ['wss://c.example', 'unreachable', 'x'], ['wss://d.example', 'timeout']),
  });
  assert(out && out.outcome === 'published', `at least one relay accepted → published, got ${j(out && out.outcome)}`);
  assert(out.accepted === 1, `AC4: never counts a relay as reached unless it accepted — accepted is ${j(out.accepted)}`);
  assert(typeof out.message === 'string' && out.message.startsWith(s), `AC4: the summary opens by naming the assistant (${j(s)}) — got ${j(out.message)}`);
  assert(/saved on this instance's relay/.test(out.message) && /accepted by 1 of 4 relays/.test(out.message) && /3 did not accept it/.test(out.message),
    `AC4: the summary says it was saved here, was accepted by 1 of 4, and 3 did not — got ${j(out.message)}`);
});

test('M3: when every relay accepts, the summary says so and mentions no failure', () => {
  const mod = getPublishModule();
  const out = need(mod, 'summarizePublish')({
    subject: "The Tapestry Assistant's profile", localOnly: false,
    rows: rowsOf(['wss://a.example', 'accepted'], ['wss://b.example', 'accepted']),
  });
  assert(out.outcome === 'published' && out.accepted === 2, `got ${j(out)}`);
  assert(/accepted by 2 of 2 relays/.test(out.message) && !/did not accept/.test(out.message), `got ${j(out.message)}`);
});

test('M4: when no relay accepts, the result is "not delivered" — never a success count', () => {
  const mod = getPublishModule();
  const out = need(mod, 'summarizePublish')({
    subject: "Your Tapestry Assistant's profile", localOnly: false,
    rows: rowsOf(['wss://a.example', 'refused', 'blocked'], ['wss://b.example', 'unreachable', 'x'], ['wss://c.example', 'timeout']),
  });
  assert(out.outcome === 'not-delivered', `tried, and nothing accepted → not-delivered, got ${j(out.outcome)}`);
  assert(out.accepted === 0, `got accepted ${j(out.accepted)}`);
  assert(/none of the 3 relays accepted it/.test(out.message), `AC4: the summary must say none accepted — got ${j(out.message)}`);
});

test('M5: in local-only mode the result is "kept local", and says local-only publish mode kept it on this instance\'s relay', () => {
  const mod = getPublishModule();
  const out = need(mod, 'summarizePublish')({
    subject: "Your Tapestry Assistant's profile", localOnly: true,
    rows: rowsOf(['wss://a.example', 'skipped', 'local-only publish mode'], ['wss://b.example', 'skipped', 'local-only publish mode']),
  });
  assert(out.outcome === 'kept-local' && out.accepted === 0, `AC3: local-only is kept-local, a setting and not a failure — got ${j(out)}`);
  assert(/local-only publish mode is on/.test(out.message) && /not sent to any other relay/.test(out.message),
    `AC3: "the result says it was kept local by configuration" — got ${j(out.message)}`);
});

test('M6: with no relays configured the result is "kept local", and says no relays are configured', () => {
  const mod = getPublishModule();
  const out = need(mod, 'summarizePublish')({ subject: "Your Tapestry Assistant's profile", localOnly: false, rows: [] });
  assert(out.outcome === 'kept-local' && out.accepted === 0, `nothing configured → kept-local, got ${j(out)}`);
  assert(/no general-purpose, profile or WoT relays are configured/.test(out.message), `got ${j(out.message)}`);
});

/* ───────────────────────── E — the handler, through its seam ───────────────────────── */

function getHandlerFactory() {
  let mod;
  delete require.cache[require.resolve(ASSISTANT_SRC)];
  try { mod = require(ASSISTANT_SRC); } catch (err) { throw new Error(`src/api/assistant/index.js failed to load: ${err.message}`); }
  if (typeof mod.createPublishProfileHandler !== 'function') {
    throw new Error('src/api/assistant/index.js does not export createPublishProfileHandler(deps). ADR 0002 gives the publish ' +
      'handler a dependency seam (the dlist-curation way), so what it sends where can be checked without strfry or relays.');
  }
  return mod.createPublishProfileHandler;
}

/** Recording fakes for every dependency ADR 0002 names. `rows(relays)` decides what the relays said. */
function handlerFakes(opts = {}) {
  const nt = require('nostr-tools');
  const sk = nt.generateSecretKey();
  const assistantPubkey = nt.getPublicKey(sk);
  const calls = { importEvent: [], publishToRelays: [], nip05: [], order: [] };
  let aRelays = opts.aRelays || TODAY;
  const rows = opts.rows || ((relays) => relays.map((relay) => ({ relay, status: 'accepted', reason: '' })));
  const deps = {
    getAssistantKeys: async () => ({ pubkey: assistantPubkey, privkey: Buffer.from(sk).toString('hex') }),
    getOwnerPubkey: () => OWNER,
    getKind0DisplayName: async () => 'Alice',
    buildDefaultProfileContent: async () => ({ name: "Alice's Tapestry Assistant", about: 'fixture default' }),
    importEvent: async (event) => {
      calls.order.push('local');
      calls.importEvent.push(event);
      if (opts.localFails) throw new Error('strfry import failed (fixture)');
    },
    updateNip05Mapping: (localPart, pubkey) => { calls.nip05.push([localPart, pubkey]); },
    isLocalOnly: () => Boolean(opts.localOnly),
    getSettings: () => ({ aRelays }),
    publishToRelays: async (event, relays) => {
      calls.order.push('relays');
      calls.publishToRelays.push({ event, relays });
      return rows(relays);
    },
    now: () => 1_700_000_000_000,
  };
  return { deps, calls, assistantPubkey, setRelays: (next) => { aRelays = next; } };
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
function publishReq(customerPubkey, sessionPubkey, content = { name: 'Fixture', about: 'fixture' }) {
  const body = { customerPubkey };
  if (content) body.content = content;
  return { body, query: {}, session: { authenticated: true, pubkey: sessionPubkey } };
}
async function callHandler(opts, customerPubkey, sessionPubkey, content) {
  const factory = getHandlerFactory();
  const f = handlerFakes(opts);
  const res = fakeRes();
  await factory(f.deps)(publishReq(customerPubkey, sessionPubkey, content), res);
  return { res, ...f };
}

test('E1: when the local write fails, nothing is sent to any relay, no NIP-05 record is written, and the user is told why', async () => {
  const { res, calls } = await callHandler({ localFails: true }, CUSTOMER, CUSTOMER);
  assert(res.statusCode === 500, `a failed local write answers 500, got ${res.statusCode}`);
  assert(res.body && res.body.success === false && res.body.stage === 'local', `the failure names its stage ('local') — got ${j(res.body)}`);
  assert(calls.publishToRelays.length === 0, `AC4: if the local write fails, nothing is sent outward — publishToRelays was called ${calls.publishToRelays.length}×`);
  assert(calls.nip05.length === 0, 'the NIP-05 record must not point at a profile that was never saved');
  const err = String(res.body.error || '');
  assert(/could not be saved on this instance's relay/.test(err) && /not sent to any other relay/.test(err) && /strfry import failed/.test(err),
    `AC4: the user is told the local save failed, why, and that nothing was sent — error: ${j(err)}`);
  assert(err.startsWith("Your Tapestry Assistant's profile"), `AC4: …and about which assistant — error: ${j(err)}`);
});

test('E2: in local-only mode the profile is saved on this instance\'s relay only, every configured relay reads "skipped", and the result says why', async () => {
  const { res, calls } = await callHandler({ localOnly: true }, CUSTOMER, CUSTOMER);
  assert(res.statusCode === 200 && res.body && res.body.success === true, `a local-only publish succeeds — got ${res.statusCode} ${j(res.body)}`);
  assert(calls.importEvent.length === 1, 'local-only still saves the profile on the local relay');
  assert(calls.publishToRelays.length === 0, `AC3: local-only mode sends nothing to any other relay — publishToRelays was called ${calls.publishToRelays.length}×`);
  assert(res.body.localOnly === true && res.body.outcome === 'kept-local', `AC3: localOnly true, outcome kept-local — got ${j({ localOnly: res.body.localOnly, outcome: res.body.outcome })}`);
  const results = res.body.relays && res.body.relays.results;
  assert(Array.isArray(results) && j(results.map((r) => r.relay)) === j(SIX) && results.every((r) => r.status === 'skipped'),
    `every configured relay is listed as skipped, so the user sees where it would have gone — got ${j(results)}`);
  assert(res.body.relays.success === 0, `nothing reached a relay, so relays.success is 0 — got ${j(res.body.relays.success)}`);
  assert(/local-only publish mode is on/.test(res.body.message || ''), `AC3: the result says it was kept local by configuration — message: ${j(res.body.message)}`);
});

test('E3: outside local-only mode the event goes to exactly the configured relays, and the response reports each one — counting only acceptances', async () => {
  const aRelays = {
    aPopularGeneralPurposeRelays: ['wss://a.example', 'wss://b.example'],
    aProfileRelays: ['wss://c.example', 'wss://a.example/'],
    aWotRelays: ['wss://d.example'],
    aDListRelays: ['wss://not-a-target.example'],
  };
  const said = {
    'wss://a.example': ['accepted', ''],
    'wss://b.example': ['refused', 'blocked: fixture'],
    'wss://c.example': ['unreachable', 'certificate has expired'],
    'wss://d.example': ['timeout', ''],
  };
  const rows = (relays) => relays.map((relay) => {
    const [status, reason] = said[relay] || ['unreachable', 'not a configured relay (fixture)'];
    return { relay, status, reason };
  });
  const { res, calls } = await callHandler({ aRelays, rows }, CUSTOMER, CUSTOMER);
  assert(calls.publishToRelays.length === 1, `the relays are published to once, got ${calls.publishToRelays.length}`);
  assert(j(calls.publishToRelays[0].relays) === j(['wss://a.example', 'wss://b.example', 'wss://c.example', 'wss://d.example']),
    `AC1: exactly the configured general-purpose, profile and WoT relays, each once — got ${j(calls.publishToRelays[0].relays)}`);
  const sent = calls.publishToRelays[0].event;
  assert(sent && sent.kind === 0 && calls.importEvent[0] && sent.id === calls.importEvent[0].id,
    'the same signed kind 0 goes to the local relay and to every other relay');
  assert(res.statusCode === 200 && res.body.success === true, `got ${res.statusCode} ${j(res.body)}`);
  assert(res.body.relays && res.body.relays.total === 4 && res.body.relays.success === 1,
    `AC4: never counts a relay as reached unless it accepted — relays.total ${j(res.body.relays && res.body.relays.total)}, relays.success ${j(res.body.relays && res.body.relays.success)}`);
  assert(j(res.body.relays.results.map((r) => [r.relay, r.status, r.reason])) === j(Object.entries(said).map(([relay, [s, r]]) => [relay, s, r])),
    `AC4: one row per relay, as the relays answered — got ${j(res.body.relays.results)}`);
  assert(res.body.outcome === 'published' && res.body.localOnly === false, `got outcome ${j(res.body.outcome)}, localOnly ${j(res.body.localOnly)}`);
  assert(/accepted by 1 of 4 relays/.test(res.body.message || ''), `AC4: the summary counts acceptances — message: ${j(res.body.message)}`);
});

test('E4: the local relay is written first — the relays hear about the profile only after this instance holds it', async () => {
  const { calls } = await callHandler({}, CUSTOMER, CUSTOMER);
  assert(j(calls.order) === j(['local', 'relays']), `local-first (BIBLE §30): expected [local, relays], got ${j(calls.order)}`);
});

test('E5: the summary names the right assistant — the Tapestry Assistant for the owner, "your" for a Customer, and the named one when the owner publishes for someone else', async () => {
  const owner = await callHandler({}, OWNER, OWNER);
  const customer = await callHandler({}, CUSTOMER, CUSTOMER);
  const forCustomer = await callHandler({}, CUSTOMER, OWNER);
  const last6 = require('nostr-tools').nip19.npubEncode(CUSTOMER).slice(-6);
  assert(String(owner.res.body.message).startsWith("The Tapestry Assistant's profile"), `owner: ${j(owner.res.body.message)}`);
  assert(String(customer.res.body.message).startsWith("Your Tapestry Assistant's profile"),
    `AC4: a Customer must be told about THEIR assistant, not "Tapestry Assistant profile published" — got ${j(customer.res.body.message)}`);
  assert(!/Tapestry Assistant profile published/.test(String(customer.res.body.message)), 'the old wording must be gone');
  const m = String(forCustomer.res.body.message);
  assert(m.includes(last6) && !/^Your\b/.test(m), `the owner publishing for a Customer names that assistant (npub …${last6}) — got ${j(m)}`);
});

test('E6: change the relay lists between two publishes and the second goes to the new lists — no restart', async () => {
  const factory = getHandlerFactory();
  const f = handlerFakes({ aRelays: { aPopularGeneralPurposeRelays: ['wss://first.example'], aProfileRelays: [], aWotRelays: [] } });
  const handle = factory(f.deps);
  await handle(publishReq(CUSTOMER, CUSTOMER), fakeRes());
  f.setRelays({ aPopularGeneralPurposeRelays: ['wss://second.example'], aProfileRelays: ['wss://profile.example'], aWotRelays: [] });
  await handle(publishReq(CUSTOMER, CUSTOMER), fakeRes());
  assert(f.calls.publishToRelays.length === 2, `two publishes, got ${f.calls.publishToRelays.length}`);
  assert(j(f.calls.publishToRelays[1].relays) === j(['wss://second.example', 'wss://profile.example']),
    `AC1: the next publish follows the changed lists — got ${j(f.calls.publishToRelays[1].relays)}`);
});

test('E7: a publish with no content (the legacy pages) still answers success, a message and relay counts — the contract they read', async () => {
  const { res } = await callHandler({}, CUSTOMER, CUSTOMER, null);
  assert(res.statusCode === 200 && res.body && res.body.success === true, `got ${res.statusCode} ${j(res.body)}`);
  assert(typeof res.body.message === 'string' && res.body.message.length > 0, 'the legacy pages print data.message');
  assert(Number.isInteger(res.body.relays && res.body.relays.total) && Number.isInteger(res.body.relays.success),
    `relays.total and relays.success stay numbers — got ${j(res.body.relays)}`);
});

test('E8: a caller who is neither the assistant\'s user nor the owner is still refused — nothing saved, nothing sent', async () => {
  const { res, calls } = await callHandler({}, CUSTOMER, STRANGER);
  assert(res.statusCode === 403, `someone else's assistant: 403, got ${res.statusCode}`);
  assert(calls.importEvent.length === 0 && calls.publishToRelays.length === 0, 'nothing may be written or sent for an unauthorized caller');
});

/* ───────────────────────── G — the one local-only reader ───────────────────────── */

function getPolicy() {
  delete require.cache[require.resolve(POLICY_SRC)];
  const pol = require(POLICY_SRC);
  if (typeof pol.isPublishLocalOnly !== 'function') {
    throw new Error('src/api/publish-policy/index.js does not export isPublishLocalOnly() — ADR 0002 makes it the one reader of ' +
      'BRAINSTORM_PUBLISH_LOCAL_ONLY that the publish path and the endpoint share.');
  }
  return pol;
}

test('G1: isPublishLocalOnly() is true only for the exact string "true" (ADR event-tagging/0002)', () => {
  const pol = getPolicy();
  for (const [value, want] of [['true', true], ['false', false], ['1', false], ['TRUE', false], ['', false]]) {
    withEnv('BRAINSTORM_PUBLISH_LOCAL_ONLY', value, () => {
      const got = pol.isPublishLocalOnly();
      assert(got === want, `BRAINSTORM_PUBLISH_LOCAL_ONLY=${j(value)} → expected ${want}, got ${j(got)}`);
    });
  }
});

test('G2: the publish-policy endpoint and the reader agree — the browser and the server gate on one rule', async () => {
  const pol = getPolicy();
  for (const value of ['true', 'false']) {
    await withEnvAsync('BRAINSTORM_PUBLISH_LOCAL_ONLY', value, async () => {
      const res = fakeRes();
      await pol.handleGetPublishPolicy({ query: {} }, res);
      assert(res.body && res.body.allowExternalPublish === !pol.isPublishLocalOnly(),
        `with ${value}: allowExternalPublish ${j(res.body && res.body.allowExternalPublish)} vs isPublishLocalOnly ${pol.isPublishLocalOnly()}`);
    });
  }
});

/* ───────────────────────── S — sentinels ───────────────────────── */

test('S1: no relay URL is written into the assistant publish code any more — the publish set comes from the relay settings', () => {
  for (const file of [ASSISTANT_SRC, PUBLISH_MOD]) {
    const src = safeRead(file);
    if (!src) { if (file === PUBLISH_MOD) throw new Error('src/api/assistant/profilePublish.js does not exist (see L0).'); continue; }
    const literals = codeOnly(src).match(/['"`]wss?:\/\/[^'"`\s]+['"`]/g) || [];
    assert(literals.length === 0,
      `AC1: ${path.relative(REPO, file)} still names relays in code: ${literals.join(', ')} — "changing those lists in relay settings changes where the next publish goes, with no code change"`);
  }
});

test('S2: the old publishToRelay helper is gone — one publisher, the one that reports what each relay did', () => {
  const src = safeRead(ASSISTANT_SRC);
  assert(!/function\s+publishToRelay\s*\(/.test(src),
    'ADR 0002: src/api/assistant/index.js still defines publishToRelay — the helper that counted any OK as success and waited out a closed socket');
});

test('S3: the status handler still hands the setup check getAssistantPublishRelays — so the check follows the publish set (guard)', () => {
  const body = functionBody(safeRead(ASSISTANT_SRC), 'handleAssistantStatus');
  assert(body, 'handleAssistantStatus not found in src/api/assistant/index.js');
  assert(/getPublishRelays\s*:\s*getAssistantPublishRelays\b/.test(body),
    'AC2: handleAssistantStatus must pass getAssistantPublishRelays to the resolver — the one list both sides read');
});

test('S4: profilePublish.js loads in a bare checkout — no top-level require of ws, nostr-tools or the settings module', () => {
  const src = safeRead(PUBLISH_MOD);
  assert(src, 'src/api/assistant/profilePublish.js does not exist (see L0).');
  const heavy = /nostr-tools|['"]ws['"]|config\/settings/;
  const offenders = src.split('\n').filter((line) => /^(?:const|let|var)\b.*\brequire\s*\(/.test(line) && heavy.test(line));
  assert(offenders.length === 0,
    `ADR 0002: real helpers are loaded lazily inside their functions (the bare-checkout trap). Top-level: ${offenders.join(' | ')}`);
});

async function run() {
  console.log('\n=== assistant-publish-relays (assistant-profile #2) ===');
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
  console.log(`\nassistant-publish-relays: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail === 0 ? 0 : 1));
}
