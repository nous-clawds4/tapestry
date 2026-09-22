'use strict';
/**
 * setup-status-and-alert #3: the Setup Alert, readable, announced as it reads, and current.
 *
 * Story: engineering-team/stories/setup-status-and-alert/3-setup-alert-polish.md
 * ADR:   engineering-team/decisions/setup-status-and-alert/0003-readable-named-and-current.md
 * Plan:  engineering-team/stories/setup-status-and-alert/3-setup-alert-polish.test-plan.md
 * Browser half: tests/brainstorm/setup-alert-polish.spec.js.
 *
 * Classes:
 *   U — the publish signal in ui/src/utils/nostrPublish.js (ADR 0003 § Implementation notes 1), run for
 *       real in Node: fetch is stubbed per test, and the external branch publishes to stub relays served
 *       by the `ws` package on 127.0.0.1 (accepting, refusing, or no relay at all).
 *   C — the alert's copy in ui/src/pages/setup/steps.js, loaded as ESM (§ 5).
 *   D — source sentinels on the JSX this runner cannot execute: the pill (§ 4), the provider's listener
 *       (§ 3), and the three import sites (§ 2).
 *   S — the chip's contrast computed from styles.css (§ 6, AC-1), and the raw-publisher list (§ 7).
 *
 * All of it FAILS against the code this story starts from (story 2 on staging): there is no
 * onEventPublished, the copy still carries a fixed name and a white chip, and three pages still POST
 * to /api/strfry/publish by hand.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const UI_SRC = path.join(REPO, 'ui/src');
const PUBLISH = path.join(UI_SRC, 'utils/nostrPublish.js');
const STEPS = path.join(UI_SRC, 'pages/setup/steps.js');
const ALERT = path.join(UI_SRC, 'components/SetupAlert.jsx');
const PROVIDER = path.join(UI_SRC, 'context/SetupStatusContext.jsx');
const STYLES = path.join(UI_SRC, 'styles.css');
const IMPORT_SITES = [
  'pages/grapevine/TrustedAssertions.jsx',
  'pages/users/UserDetail.jsx',
  'pages/BrainstormSettings.jsx',
];
// The files allowed to POST to /api/strfry/publish by hand: the helper itself, and pages that never
// carry the viewer's kind 3 or kind 10040 (ADR 0003 § Context). A new one must be looked at.
const RAW_PUBLISH_ALLOWED = [
  'utils/nostrPublish.js',
  'pages/lists/NewDList.jsx',
  'pages/lists/NewDListItem.jsx',
  'pages/lists/DListRatings.jsx',
  'pages/events/DListItemRatings.jsx',
  'pages/grapevine/CuratedDListHeaders.jsx',
  'pages/tapestries/useCreateTapestry.js',
  'pages/tapestries/AddConceptToTapestry.jsx',
  'pages/tapestries/RemoveConceptFromTapestry.jsx',
];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);

/* ───────────────────────── helpers ───────────────────────── */

let loadCount = 0;
/** A fresh instance of nostrPublish.js, so the cached publish policy and the listeners start empty. */
async function loadPublish() {
  loadCount += 1;
  return import(`${pathToFileURL(PUBLISH).href}?instance=${loadCount}`);
}

/** Replace global fetch for one test: `routes` maps a URL prefix to an answer or a function. */
async function withFetch(routes, fn) {
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const key = Object.keys(routes).find((prefix) => String(url).startsWith(prefix));
    if (!key) throw new Error(`unexpected fetch ${url}`);
    const answer = typeof routes[key] === 'function' ? await routes[key](url, init) : routes[key];
    if (answer instanceof Error) throw answer;
    return { ok: true, status: 200, json: async () => answer };
  };
  try { return await fn(); } finally { globalThis.fetch = saved; }
}

/** A stub relay on 127.0.0.1: mode 'accept' answers OK true, 'refuse' answers OK false. */
async function startRelay(mode) {
  const { WebSocketServer } = require(path.join(REPO, 'node_modules/ws'));
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => wss.on('listening', resolve));
  wss.on('connection', (sock) => sock.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch { return; }
    if (msg[0] === 'EVENT') sock.send(JSON.stringify(['OK', msg[1].id, mode === 'accept', mode === 'accept' ? '' : 'blocked: fixture']));
  }));
  return { url: `ws://127.0.0.1:${wss.address().port}`, close: () => new Promise((resolve) => wss.close(resolve)) };
}

/**
 * Put nostr-tools back on the real WebSocket (its default) before a test that publishes to the stub relays.
 * test/honest-publish-reporting.test.js swaps in a fake socket that accepts every relay it does not know and
 * never swaps it back, so in one gate process it would answer these relays too.
 */
function useRealWebSocket() {
  const cjs = require.resolve('nostr-tools/pool', { paths: [path.join(REPO, 'ui')] });
  require(path.resolve(path.dirname(cjs), '../esm/pool.js')).useWebSocketImplementation(globalThis.WebSocket);
}

// No relay listens on port 1, so a publish there is "unreachable".
const DEAD_RELAY = 'ws://127.0.0.1:1';
const VIEWER = 'a1'.repeat(32);
const event = (kind, id = 'e1') => ({ id: id.padEnd(64, '0'), pubkey: VIEWER, kind, created_at: 1790000000, tags: [], content: '', sig: 'cd'.repeat(64) });
const POLICY_EXTERNAL = { '/api/publish-policy': { allowExternalPublish: true } };
const POLICY_LOCAL_ONLY = { '/api/publish-policy': { allowExternalPublish: false } };

/* ───────────────────────── U — the publish signal ───────────────────────── */

test('U1: nostrPublish.js exports onEventPublished(listener), which returns an unsubscribe function (ADR 0003 § 1)', async () => {
  const mod = await loadPublish();
  assert(typeof mod.onEventPublished === 'function', 'ui/src/utils/nostrPublish.js must export onEventPublished(listener) (ADR 0003 § Implementation notes 1)');
  const off = mod.onEventPublished(() => {});
  assert(typeof off === 'function', `onEventPublished must return an unsubscribe function; got ${show(typeof off)}`);
  off();
});

test('U2: a successful local publish announces the event once, and publishToLocalStrfry still returns the server\'s answer', async () => {
  const mod = await loadPublish();
  assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
  const heard = [];
  mod.onEventPublished((ev) => heard.push(ev));
  const ev = event(3);
  const result = await withFetch({ '/api/strfry/publish': { success: true } }, () => mod.publishToLocalStrfry(ev));
  assert(result && result.success === true, `publishToLocalStrfry must still return the server's answer; got ${show(result)}`);
  assert(heard.length === 1, `the listener must hear the event exactly once; heard ${heard.length}`);
  assert(heard[0] && heard[0].id === ev.id && heard[0].kind === 3, `the listener must receive the published event; got ${show(heard[0])}`);
});

test('U3: a failed local publish announces nothing — neither a refusal nor a network error', async () => {
  const mod = await loadPublish();
  assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
  const heard = [];
  mod.onEventPublished((ev) => heard.push(ev));
  await withFetch({ '/api/strfry/publish': { success: false, error: 'strfry import failed' } }, () => mod.publishToLocalStrfry(event(3, 'e3a')));
  const thrown = await withFetch({ '/api/strfry/publish': new Error('network down') }, () => mod.publishToLocalStrfry(event(3, 'e3b')));
  assert(thrown && thrown.success === false, `a network error must still resolve { success: false }; got ${show(thrown)}`);
  assert(heard.length === 0, `nothing reached a relay, so nothing may be announced; heard ${heard.length}: ${show(heard.map((e) => e.id))}`);
});

test('U4: an external publish skipped by the local-only gate announces nothing', async () => {
  const mod = await loadPublish();
  assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
  const heard = [];
  mod.onEventPublished((ev) => heard.push(ev));
  const result = await withFetch(POLICY_LOCAL_ONLY, () => mod.publishToRelays(event(10040, 'e4'), [DEAD_RELAY]));
  assert(result && result.skippedByGate === true, `with allowExternalPublish:false the publish must be skipped by the gate; got ${show(result)}`);
  assert(heard.length === 0, `a skipped publish reached no relay; heard ${heard.length}`);
});

test('U5: an external publish announces the event when at least one relay accepts it — and not when every relay refuses or is unreachable', async () => {
  useRealWebSocket();
  const accepting = await startRelay('accept');
  const refusing = await startRelay('refuse');
  try {
    const mod = await loadPublish();
    assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
    const heard = [];
    mod.onEventPublished((ev) => heard.push(ev.id));
    const accepted = await withFetch(POLICY_EXTERNAL, () => mod.publishToRelays(event(10040, 'e5a'), [accepting.url, DEAD_RELAY]));
    assert(accepted.successes.length === 1, `fixture check: one relay should accept; got ${show(accepted)}`);
    const refused = await withFetch(POLICY_EXTERNAL, () => mod.publishToRelays(event(10040, 'e5b'), [refusing.url, DEAD_RELAY]));
    assert(refused.successes.length === 0, `fixture check: no relay should accept; got ${show(refused)}`);
    assert(heard.length === 1 && heard[0] === event(0, 'e5a').id,
      `only the publish a relay accepted may be announced, once; heard ${show(heard)}`);
  } finally {
    await accepting.close();
    await refusing.close();
  }
});

test('U6: a listener that throws never breaks a publish, and the other listeners still hear it', async () => {
  const mod = await loadPublish();
  assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
  const heard = [];
  mod.onEventPublished(() => { throw new Error('listener bug'); });
  mod.onEventPublished((ev) => heard.push(ev.id));
  const result = await withFetch({ '/api/strfry/publish': { success: true } }, () => mod.publishToLocalStrfry(event(3, 'e6')));
  assert(result && result.success === true, `the publish must still resolve with the server's answer; got ${show(result)}`);
  assert(heard.length === 1, `the second listener must still hear the event; heard ${heard.length}`);
});

test('U7: after unsubscribing, a listener hears nothing more', async () => {
  const mod = await loadPublish();
  assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
  const heard = [];
  const off = mod.onEventPublished((ev) => heard.push(ev.id));
  await withFetch({ '/api/strfry/publish': { success: true } }, () => mod.publishToLocalStrfry(event(3, 'e7a')));
  off();
  await withFetch({ '/api/strfry/publish': { success: true } }, () => mod.publishToLocalStrfry(event(3, 'e7b')));
  assert(heard.length === 1, `only the publish before unsubscribing may be heard; heard ${show(heard)}`);
});

test('U8: publishEverywhere announces once, straight after the local write — even when the relays answer first (ADR 0003 Amendment 1)', async () => {
  useRealWebSocket();
  const accepting = await startRelay('accept');
  try {
    const mod = await loadPublish();
    assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
    const heard = [];
    mod.onEventPublished((ev) => heard.push({ id: ev.id, t: Date.now() }));
    const ev = event(3, 'e8');
    let localAnsweredAt = null;
    // The local write is held back 300 ms, so the relay (answering at once) settles first.
    const slowLocal = async () => { await new Promise((resolve) => setTimeout(resolve, 300)); localAnsweredAt = Date.now(); return { success: true }; };
    await withFetch({ '/api/strfry/publish': slowLocal, ...POLICY_EXTERNAL }, () => mod.publishEverywhere(ev, [accepting.url]));
    assert(heard.length === 1, `publishEverywhere must announce exactly once; heard ${heard.length}: ${show(heard)}`);
    assert(heard[0].id === ev.id, `it must announce the published event; heard ${show(heard[0])}`);
    assert(localAnsweredAt !== null && heard[0].t >= localAnsweredAt,
      `the announcement must come after the local write (local answered at ${localAnsweredAt}, announced at ${heard[0].t})`);
  } finally {
    await accepting.close();
  }
});

test('U9: publishEverywhere whose local write fails announces once, after a relay accepted', async () => {
  useRealWebSocket();
  const accepting = await startRelay('accept');
  try {
    const mod = await loadPublish();
    assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
    const heard = [];
    mod.onEventPublished((ev) => heard.push(ev.id));
    const ev = event(10040, 'e9');
    const result = await withFetch({ '/api/strfry/publish': { success: false, error: 'strfry import failed' }, ...POLICY_EXTERNAL },
      () => mod.publishEverywhere(ev, [accepting.url]));
    assert(result.external.successes.length === 1, `fixture check: the relay should accept; got ${show(result.external)}`);
    assert(heard.length === 1 && heard[0] === ev.id, `a relay took it, so it is announced once; heard ${show(heard)}`);
  } finally {
    await accepting.close();
  }
});

test('U10: publishEverywhere that reaches no relay at all announces nothing', async () => {
  useRealWebSocket();
  const refusing = await startRelay('refuse');
  try {
    const mod = await loadPublish();
    assert(typeof mod.onEventPublished === 'function', 'onEventPublished is not exported');
    const heard = [];
    mod.onEventPublished((ev) => heard.push(ev.id));
    await withFetch({ '/api/strfry/publish': { success: false, error: 'strfry import failed' }, ...POLICY_EXTERNAL },
      () => mod.publishEverywhere(event(3, 'e10'), [refusing.url, DEAD_RELAY]));
    assert(heard.length === 0, `nothing reached a relay; heard ${show(heard)}`);
  } finally {
    await refusing.close();
  }
});

/* ───────────────────────── C — the copy ───────────────────────── */

test('C1: steps.js — the alert\'s words are unchanged on screen, the arrow is its own piece, and the fixed name is gone (ADR 0003 § 5)', async () => {
  let mod;
  try { mod = await import(pathToFileURL(STEPS).href); } catch (err) { throw new Error(`steps.js must load in Node as ESM: ${err.message}`); }
  const c = mod.SETUP_ALERT_COPY;
  assert(c && typeof c === 'object', 'steps.js must export SETUP_ALERT_COPY');
  assert(c.sentence === 'Finish setting up your account', `SETUP_ALERT_COPY.sentence: got ${show(c.sentence)}`);
  assert(c.button === 'Finish setup', `SETUP_ALERT_COPY.button must be the words alone, "Finish setup" (the arrow is decorative, story 3 AC-2); got ${show(c.button)}`);
  assert(c.arrow === '→', `SETUP_ALERT_COPY.arrow must be "→"; got ${show(c.arrow)}`);
  assert(!('name' in c), `SETUP_ALERT_COPY.name must be gone: the pill is named by what it shows (story 3 AC-2); got ${show(c.name)}`);
  assert(mod.alertCountText(1) === '· 1 step left' && mod.alertCountText(2) === '· 2 steps left', 'alertCountText must be unchanged');
});

/* ───────────────────────── D — source sentinels ───────────────────────── */

test('D1: SetupAlert.jsx — no aria-label, a decorative arrow, a decorative ⚠, and a case-blind /setup check (ADR 0003 § 4)', async () => {
  const src = safeRead(ALERT);
  assert(src, 'ui/src/components/SetupAlert.jsx could not be read');
  assert(!/aria-label/.test(src), 'the pill must carry no aria-label: its name is what it shows (story 3 AC-2)');
  assert(/aria-hidden=["']true["'][^>]*>\s*\{?\s*[^<]*SETUP_ALERT_COPY\.arrow/.test(src),
    'the arrow must render inside an aria-hidden element from SETUP_ALERT_COPY.arrow (ADR 0003 § 4)');
  assert(/className=["']bs-setup-alert-icon["'][^>]*aria-hidden=["']true["']|aria-hidden=["']true["'][^>]*className=["']bs-setup-alert-icon["']/.test(src),
    'the ⚠ must stay aria-hidden');
  assert(/toLowerCase\(\)/.test(src), 'the /setup hide must compare a lower-cased path (story 3 AC-4)');
});

test('D2: SetupStatusContext.jsx — listens with onEventPublished and re-checks on every announcement of the viewer\'s own kind 3 or kind 10040 (ADR 0003 § 3, Amendment 1)', async () => {
  const src = safeRead(PROVIDER);
  assert(/import\s*\{[^}]*\bonEventPublished\b[^}]*\}\s*from\s*['"]\.\.\/utils\/nostrPublish['"]/.test(src),
    'SetupStatusContext.jsx must import { onEventPublished } from ../utils/nostrPublish');
  assert(/onEventPublished\s*\(/.test(src), 'the provider must subscribe with onEventPublished(...)');
  // Either shape of the kind test: a match (=== 3, [3, 10040].includes) or a guard (!== 3 && !== 10040).
  assert(/10040/.test(src) && /([!=]==\s*3\b|\b3\s*[!=]==|\[\s*3\s*,\s*10040\s*\]|\[\s*10040\s*,\s*3\s*\])/.test(src),
    'the provider must filter to kind 3 and kind 10040');
  assert(/\.pubkey\s*(===|!==)\s*pubkey|pubkey\s*(===|!==)\s*\w+\.pubkey/.test(src), 'the provider must compare the event\'s pubkey with the signed-in viewer\'s');
  // Amendment 1: no record of ids already heard. A later announcement of the same event (an import after a
  // push, or the local write after the relays) must still re-check.
  assert(!/new Set\(/.test(src) && !/\.has\(\s*\w+\.id\s*\)/.test(src),
    'the provider must not remember event ids it has heard: every announcement re-checks (ADR 0003 Amendment 1)');
  assert(/refresh\(\)/.test(src), 'the provider must call refresh() for a matching event');
});

test('D3: the three import sites publish through publishToLocalStrfry, with no hand-written POST to /api/strfry/publish (ADR 0003 § 2)', async () => {
  const problems = [];
  for (const rel of IMPORT_SITES) {
    const src = safeRead(path.join(UI_SRC, rel));
    if (!src) { problems.push(`${rel}: could not be read`); continue; }
    if (/['"`]\/api\/strfry\/publish['"`]/.test(src)) problems.push(`${rel}: still POSTs to /api/strfry/publish by hand`);
    if (!/publishToLocalStrfry\s*\(/.test(src)) problems.push(`${rel}: does not call publishToLocalStrfry(...)`);
    if (!/import\s*\{[^}]*\bpublishToLocalStrfry\b[^}]*\}\s*from\s*['"][./]*utils\/nostrPublish['"]/.test(src)) problems.push(`${rel}: does not import publishToLocalStrfry from utils/nostrPublish`);
  }
  assert(problems.length === 0, problems.join('; '));
});

/* ───────────────────────── S — contrast and the raw publishers ───────────────────────── */

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function luminance([r, g, b]) {
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('S1: styles.css — the "Finish setup" chip\'s text is dark on its amber, at 4.5:1 or better (story 3 AC-1)', async () => {
  const css = safeRead(STYLES);
  const rule = (css.match(/\.bs-setup-alert-button\s*\{([^}]*)\}/) || [])[1];
  assert(rule, 'styles.css must still have a .bs-setup-alert-button rule');
  const color = ((rule.match(/(?:^|;|\s)color:\s*([^;]+);/) || [])[1] || '').trim();
  const background = ((rule.match(/background(?:-color)?:\s*([^;]+);/) || [])[1] || '').trim();
  const fg = hexToRgb(color);
  const bg = hexToRgb(background);
  assert(fg && bg, `the chip's color and background must be hex values to measure; got color ${show(color)}, background ${show(background)}`);
  assert(bg[0] > 150 && bg[1] > 100 && bg[2] < 100, `the chip must stay amber; its background is ${background}`);
  const ratio = contrast(fg, bg);
  assert(luminance(fg) < luminance(bg), `the chip's text must be darker than its amber (the owner's call); got ${color} on ${background}`);
  assert(ratio >= 4.5, `"Finish setup" is ${color} on ${background}: ${ratio.toFixed(2)}:1, below the 4.5:1 the story asks for`);
});

test('S2: only the known pages POST to /api/strfry/publish by hand — a new one must say whether it can carry the viewer\'s kind 3 or kind 10040 (ADR 0003 § 7)', async () => {
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(jsx?|mjs)$/.test(entry.name) && /['"`]\/api\/strfry\/publish['"`]/.test(fs.readFileSync(p, 'utf8'))) {
        found.push(path.relative(UI_SRC, p).split(path.sep).join('/'));
      }
    }
  })(UI_SRC);
  const unexpected = found.filter((f) => !RAW_PUBLISH_ALLOWED.includes(f)).sort();
  assert(unexpected.length === 0,
    `these files POST to /api/strfry/publish by hand: ${unexpected.join(', ')}. If one can publish the viewer's kind 3 or kind 10040, ` +
    `route it through publishToLocalStrfry so the Setup Alert re-checks (ADR 0003); otherwise add it to RAW_PUBLISH_ALLOWED with the kinds it sends.`);
});

test('S3: only utils/nostrPublish.js passes announce: false — every other caller keeps the announcement (ADR 0003 Amendment 1)', async () => {
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(jsx?|mjs)$/.test(entry.name) && /announce\s*:\s*false/.test(fs.readFileSync(p, 'utf8'))) {
        found.push(path.relative(UI_SRC, p).split(path.sep).join('/'));
      }
    }
  })(UI_SRC);
  const others = found.filter((f) => f !== 'utils/nostrPublish.js');
  assert(others.length === 0,
    `these files silence a publish's announcement: ${others.join(', ')}. Only publishEverywhere may, because it announces once itself; ` +
    'anywhere else the Setup Alert would not re-check after the viewer publishes their follow list or Treasure Map.');
});

async function run() {
  console.log('\n=== setup-alert-polish (setup-status-and-alert #3) ===');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${String.fromCharCode(10)}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${String.fromCharCode(10)}setup-alert-polish: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

module.exports = { run };
