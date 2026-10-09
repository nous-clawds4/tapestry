'use strict';
/**
 * assistant-outbox-relays #3: your Assistant publishes its relay list.
 *
 * Story: engineering-team/stories/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md
 * ADR:   engineering-team/decisions/assistant-outbox-relays/0003-the-assistant-signs-its-relay-list-through-one-narrow-route.md
 * Plan:  engineering-team/stories/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.test-plan.md
 * Browser half: tests/brainstorm/assistant-outbox-relays.spec.js (B7–B8: the press, the request and the report).
 * Words and shapes: test/helpers/outboxRelaysFixtures.js.
 *
 * Classes:
 *   L — the pure builders in src/lib/relay-list: buildRelayListTags and validateRelayListRequest.        [AC-2, AC-3]
 *   P — src/api/assistant/relayListPublish.js driven through the dependencies ADR 0003 names (getAssistantKeys,
 *       scanLocal, readRelay, getConfiguredPublishRelays, getConfigFromFile, importEvent, isLocalOnly, publishToRelays,
 *       now). Stack-free; the events are really signed and verified with nostr-tools.                    [AC-2 … AC-5]
 *   C — the page's publish words (outboxRelaysCopy.js).                                                       [AC-1, AC-5]
 *   R — a regression that passes before and after: the shipped report util draws the route's answer shape, so the
 *       page reuses it unchanged (ADR 0003 sub-decision 7).                                                  [AC-1]
 *   S — source sentinels: the route registered and documented, the signing helper shared, no creation path, the
 *       generic signer untouched, the page publishing through its util and refreshing the answer.          [AC-1, AC-2]
 *   H — live: an anonymous POST answers 401 (skips when no instance answers, or on a Node without fetch).
 *
 * Everything except R FAILS against the current code: the builders, the module, the util and the route do not exist.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const O = require('./helpers/outboxRelaysFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/relay-list/index.js');
const MODULE = path.join(REPO, 'src/api/assistant/relayListPublish.js');
const TAGGINGS_MODULE = path.join(REPO, 'src/api/assistant/identificationTaggings.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const BIBLE = path.join(REPO, 'BIBLE.md');
const GENERIC_SIGNER = path.join(REPO, 'src/api/strfry/commands/publishEvent.js');
const REPORT_MOD = path.join(REPO, 'ui/src/utils/taggingPublishReport.js');
const CLIENT_UTIL = path.join(REPO, 'ui/src/utils/publishAssistantRelayList.js');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/outboxRelaysCopy.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistant/OutboxRelays.jsx');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const NL = String.fromCharCode(10);

const VIEWER = 'a1'.repeat(32);
const OTHER = 'b2'.repeat(32);
const NOW_MS = 1_700_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);

// Fixture relays: the profile publish set (two outside, this instance's own) and the list's relays.
const PUB1 = 'wss://pub-one.example';
const PUB2 = 'wss://pub-two.example';
const OWN = 'ws://localhost:7777';
const KEEP_NONE = 'wss://keep-none.example';
const KEEP_WRITE = 'wss://keep-write.example';
const INBOX = 'wss://inbox.example';
const DROP_NONE = 'wss://drop-none.example';
const DROP_WRITE = 'wss://drop-write.example';
const NEW = 'wss://new.example';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const sameJson = (a, b) => show(a) === show(b);
const sameSet = (a, b) => sameJson([...a].sort(), [...b].sort());
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

let hExecuted = 0;
let hSkipped = 0;

const nt = () => require('nostr-tools');
let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');
function relayList(pubkey, createdAt, rTags) {
  idSeq += 1;
  return { id: hexId(idSeq), pubkey, kind: O.RELAY_LIST_KIND, created_at: createdAt, tags: rTags, content: '', sig: '0'.repeat(128) };
}
function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map((a) => String(a).toLowerCase()) : null;
  return events.filter((e) => (!kinds || kinds.includes(e.kind)) && (!authors || authors.includes(String(e.pubkey).toLowerCase())));
}

function load(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const libModule = () => load(LIB, 'ADR 0003 adds buildRelayListTags and validateRelayListRequest to the NIP-65 library.');
const publishModule = () => load(MODULE, 'ADR 0003 § Implementation notes creates it: createPublishRelayListHandler, handlePublishRelayList, publishAssistantRelayListFor.');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0003 § Implementation notes).`);
  return mod[name];
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
}

/**
 * The injected dependencies, under the names ADR 0003 gives them. Every one RECORDS its calls; `order` records the local
 * write and the fan-out in sequence.
 *   assistant  — getAssistantKeys: a real key by default; null = no assistant.
 *   local      — the events this instance's relay holds (the previous list), or 'reject'.
 *   relays     — { [url]: events }: outside relays for the previous-list lookup; unlisted = unreachable.
 *   publish    — getConfiguredPublishRelays; default [PUB1, PUB2, OWN].
 *   localFails — the local write throws.
 *   rows       — publishToRelays' answer from the relay list; default every relay accepted.
 */
function fakes(opts = {}) {
  const n = nt();
  const sk = n.generateSecretKey();
  const assistantPubkey = n.getPublicKey(sk);
  const calls = { getAssistantKeys: [], scanLocal: [], readRelay: [], importEvent: [], publishToRelays: [], order: [] };
  const deps = {
    getAssistantKeys: async (pubkey) => {
      calls.getAssistantKeys.push(pubkey);
      if (opts.assistant === null) return null;
      return { pubkey: assistantPubkey, privkey: Buffer.from(sk).toString('hex'), npub: 'npub1fixture', nsec: 'nsec1fixture' };
    },
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      if (opts.local === 'reject') throw new Error('fixture: strfry scan failed');
      const held = typeof opts.local === 'function' ? opts.local(assistantPubkey) : (opts.local || []);
      return matching(held, filter);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url, filter });
      const held = opts.relays && (typeof opts.relays === 'function' ? opts.relays(assistantPubkey) : opts.relays)[url];
      if (!Array.isArray(held)) return { status: 'unreachable', events: [], error: 'fixture' };
      return { status: 'ok', events: matching(held, filter), error: null };
    },
    getConfiguredPublishRelays: () => (opts.publish || [PUB1, PUB2, OWN]).slice(),
    getConfigFromFile: (key, dflt) => dflt,
    importEvent: async (event) => {
      calls.order.push('local');
      calls.importEvent.push(event);
      if (opts.localFails) throw new Error('strfry import failed (fixture)');
    },
    isLocalOnly: () => Boolean(opts.localOnly),
    publishToRelays: async (event, relays) => {
      calls.order.push('relays');
      calls.publishToRelays.push({ event, relays });
      const rows = opts.rows || ((list) => list.map((relay) => ({ relay, status: 'accepted', reason: '' })));
      return rows(relays);
    },
    now: () => (opts.now === undefined ? NOW_MS : opts.now),
  };
  if (opts.throwOn === 'getAssistantKeys') deps.getAssistantKeys = async () => { throw new Error('fixture: the key store exploded'); };
  return { deps, calls, assistantPubkey };
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = (relays, pubkey = VIEWER, extra = {}) => ({ session: { authenticated: true, pubkey }, body: { relays }, query: {}, ...extra });
async function answer(opts, req) {
  const factory = need(publishModule(), 'createPublishRelayListHandler', 'src/api/assistant/relayListPublish.js');
  const { deps, calls, assistantPubkey } = fakes(opts);
  const handle = factory(deps);
  const res = fakeRes();
  await handle(req === undefined ? signedInReq([NEW]) : req, res, deps);
  const signed = calls.importEvent[0] || null;
  return { res, body: res.body, result: res.body && res.body.result, calls, assistantPubkey, signed };
}

/** The previous list on this instance's relay: one of each marker, two of which the page removes. */
const previousList = (assistantPubkey, createdAt = 1000) => relayList(assistantPubkey, createdAt, [
  ['r', KEEP_WRITE, 'write'], ['r', KEEP_NONE], ['r', INBOX, 'read'], ['r', DROP_NONE], ['r', DROP_WRITE, 'write'],
]);

/* ───────────────────────── L — the pure builders ───────────────────────── */

test('L1: buildRelayListTags — the draft in order, each keeping its marker from the newest list (none stays none, write stays write, read becomes both), others write; then the inbox-only entries not in the draft; a removed relay is gone, inbox role included (AC-3; book Decision 6)', () => {
  const build = need(libModule(), 'buildRelayListTags', 'src/lib/relay-list');
  const previous = [
    { url: KEEP_WRITE, marker: 'write' }, { url: KEEP_NONE, marker: null }, { url: INBOX, marker: 'read' },
    { url: 'wss://inbox-two.example', marker: 'read' }, { url: DROP_NONE, marker: null }, { url: DROP_WRITE, marker: 'write' },
  ];
  const got = build({ draft: [KEEP_NONE, KEEP_WRITE, NEW, 'wss://inbox-two.example'], previous });
  const want = [['r', KEEP_NONE], ['r', KEEP_WRITE, 'write'], ['r', NEW, 'write'], ['r', 'wss://inbox-two.example'], ['r', INBOX, 'read']];
  assert(sameJson(got, want), `want ${show(want)}, got ${show(got)}`);
});

test('L2: buildRelayListTags — with no newest list every draft relay is write; an empty draft keeps only the inbox-only entries (AC-3, AC-5)', () => {
  const build = need(libModule(), 'buildRelayListTags', 'src/lib/relay-list');
  assert(sameJson(build({ draft: [NEW, KEEP_NONE], previous: [] }), [['r', NEW, 'write'], ['r', KEEP_NONE, 'write']]), 'no previous list');
  const emptied = build({ draft: [], previous: [{ url: KEEP_WRITE, marker: 'write' }, { url: INBOX, marker: 'read' }] });
  assert(sameJson(emptied, [['r', INBOX, 'read']]), `an empty draft: want [['r', INBOX, 'read']], got ${show(emptied)}`);
});

test('L3: validateRelayListRequest — a list of up to 50 relay addresses, none twice by its one spelling, is valid and comes back normalized; an empty list is valid; anything else is not (AC-2, AC-5)', () => {
  const validate = need(libModule(), 'validateRelayListRequest', 'src/lib/relay-list');
  const wrong = [];
  const ok = validate(['  WSS://New.Example/ ', KEEP_NONE]);
  if (!sameJson(ok, { ok: true, relays: [NEW, KEEP_NONE] })) wrong.push(`valid: ${show(ok)}`);
  if (!sameJson(validate([]), { ok: true, relays: [] })) wrong.push(`empty: ${show(validate([]))}`);
  const many = Array.from({ length: O.MAX_RELAYS + 1 }, (_, i) => `wss://r${i}.example`);
  for (const [label, input] of [['not an array', 'wss://x.example'], ['undefined', undefined], ['an object', { relays: [NEW] }],
    ['a non-relay', [NEW, 'https://web.example']], ['a non-string', [NEW, 7]], ['twice', [NEW, 'wss://NEW.example/']], [`${O.MAX_RELAYS + 1} relays`, many]]) {
    const got = validate(input);
    if (!got || got.ok !== false) wrong.push(`${label}: want { ok: false }, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── P — the route ───────────────────────── */

test('P1: without an authenticated session the route answers 401 not-signed-in with the approved words, and reads no key (AC-2)', async () => {
  const wrong = [];
  for (const req of [{ session: {}, body: { relays: [NEW] } }, { session: { authenticated: true, pubkey: 'nope' }, body: { relays: [NEW] } }, {}]) {
    const got = await answer({}, req);
    if (got.res.statusCode !== 401 || !sameJson(got.body, { success: false, code: O.PUBLISH.codes.notSignedIn, error: O.PUBLISH.refusals['not-signed-in'] })) wrong.push(`${show(req)} → ${got.res.statusCode} ${show(got.body)}`);
    if (got.calls.getAssistantKeys.length !== 0) wrong.push('a key was read');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P2: a request that is not a list of relay addresses is refused 400 not-a-relay-list before any key is read (AC-2)', async () => {
  const wrong = [];
  const many = Array.from({ length: O.MAX_RELAYS + 1 }, (_, i) => `wss://r${i}.example`);
  for (const body of [{}, { relays: 'wss://x.example' }, { relays: [NEW, 'https://web.example'] }, { relays: [NEW, NEW.toUpperCase()] }, { relays: many }]) {
    const got = await answer({}, { session: { authenticated: true, pubkey: VIEWER }, body, query: {} });
    if (got.res.statusCode !== 400 || !sameJson(got.body, { success: false, code: O.PUBLISH.codes.notARelayList, error: O.PUBLISH.refusals['not-a-relay-list'] })) wrong.push(`${show(body).slice(0, 80)} → ${got.res.statusCode} ${show(got.body)}`);
    if (got.calls.getAssistantKeys.length !== 0) wrong.push('a key was read');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P3: a signed-in viewer with no Assistant here is refused 403 no-assistant, and nothing is signed or written (AC-2)', async () => {
  const got = await answer({ assistant: null });
  assert(got.res.statusCode === 403 && sameJson(got.body, { success: false, code: O.PUBLISH.codes.noAssistant, error: O.PUBLISH.refusals['no-assistant'] }), `got ${got.res.statusCode} ${show(got.body)}`);
  assert(got.calls.importEvent.length === 0 && got.calls.publishToRelays.length === 0, 'nothing is written or sent');
  assert(sameJson(got.calls.getAssistantKeys, [VIEWER]), `the key is looked up for the session's viewer, got ${show(got.calls.getAssistantKeys)}`);
});

test('P4: the happy path — a kind 10002 signed with the viewer\'s own Assistant\'s key, empty content, the tags of AC-3 from the newest list; written locally before any relay; sent once to every relay of the new list, the previous list and the profile publish set, this instance\'s own left out (AC-3, AC-4)', async () => {
  const got = await answer({ local: (pk) => [previousList(pk)] }, signedInReq([KEEP_NONE, KEEP_WRITE, NEW]));
  assert(got.res.statusCode === 200 && got.body && got.body.success === true, `want 200 success, got ${got.res.statusCode} ${show(got.body)}`);
  const ev = got.signed;
  const wrong = [];
  if (!ev) wrong.push('nothing was written locally');
  else {
    if (ev.kind !== O.RELAY_LIST_KIND) wrong.push(`kind ${ev.kind}`);
    if (ev.pubkey !== got.assistantPubkey) wrong.push('not signed by the assistant');
    if (!nt().verifyEvent(ev)) wrong.push('the signature does not verify');
    if (ev.content !== '') wrong.push(`content ${show(ev.content)}`);
    if (ev.created_at !== NOW_S) wrong.push(`created_at ${ev.created_at}, want ${NOW_S}`);
    const want = [['r', KEEP_NONE], ['r', KEEP_WRITE, 'write'], ['r', NEW, 'write'], ['r', INBOX, 'read']];
    if (!sameJson(ev.tags, want)) wrong.push(`tags: want ${show(want)}, got ${show(ev.tags)}`);
  }
  if (!sameJson(got.calls.order, ['local', 'relays'])) wrong.push(`order: want local then relays, got ${show(got.calls.order)}`);
  const sentTo = got.calls.publishToRelays[0] ? got.calls.publishToRelays[0].relays : [];
  const wantSet = [KEEP_NONE, KEEP_WRITE, NEW, INBOX, DROP_NONE, DROP_WRITE, PUB1, PUB2];
  if (!sameSet(sentTo, wantSet) || new Set(sentTo).size !== sentTo.length) wrong.push(`fan-out: want each of ${show(wantSet)} once, got ${show(sentTo)}`);
  if (got.calls.publishToRelays[0] && got.calls.publishToRelays[0].event.id !== (ev && ev.id)) wrong.push('the fan-out sends the event written locally');
  assert(wrong.length === 0, wrong.join('; '));
});

test('P5: the answer — { success, result: { ok, outcome, message, localOnly, outbox, relays: { total, success, results } } } in the profile publish\'s words, counting only accepting relays (AC-1, AC-4)', async () => {
  const rows = (list) => list.map((relay, i) => (i === 0 ? { relay, status: 'refused', reason: 'blocked: fixture' } : { relay, status: 'accepted', reason: '' }));
  const got = await answer({ rows }, signedInReq([NEW, KEEP_NONE]));
  const r = got.result || {};
  const n = (got.calls.publishToRelays[0] || { relays: [] }).relays.length;
  const wrong = [];
  if (r.ok !== true || r.outcome !== 'published' || r.localOnly !== false) wrong.push(`flags ${show({ ok: r.ok, outcome: r.outcome, localOnly: r.localOnly })}`);
  if (r.message !== O.PUBLISH.published(n - 1, n)) wrong.push(`message: want ${show(O.PUBLISH.published(n - 1, n))}, got ${show(r.message)}`);
  if (!sameJson(r.outbox, [NEW, KEEP_NONE])) wrong.push(`outbox: ${show(r.outbox)}`);
  if (!r.relays || r.relays.total !== n || r.relays.success !== n - 1 || !Array.isArray(r.relays.results) || r.relays.results.length !== n) wrong.push(`relays: ${show(r.relays)}`);
  assert(wrong.length === 0, wrong.join('; '));
  const none = await answer({ rows: (list) => list.map((relay) => ({ relay, status: 'unreachable', reason: 'fixture' })) });
  const m = (none.calls.publishToRelays[0] || { relays: [] }).relays.length;
  assert(none.result && none.result.outcome === 'not-delivered' && none.result.message === O.PUBLISH.noneAccepted(m), `none accepted: ${show(none.result)}`);
});

test('P6: a newer list wins on every relay — when the newest list is from the future, the new one is created one second after it (ADR 0003 sub-decision 2)', async () => {
  const future = NOW_S + 500;
  const got = await answer({ local: (pk) => [previousList(pk, future)] }, signedInReq([NEW]));
  assert(got.signed && got.signed.created_at === future + 1, `want created_at ${future + 1}, got ${show(got.signed && got.signed.created_at)}`);
});

test('P7: the newest list is read at publish time, this instance\'s relay first; on a miss, the outside profile publish relays (never this instance\'s own), and a list found there supplies the markers and inbox entries (AC-3)', async () => {
  const outside = (pk) => ({ [PUB1]: [relayList(pk, 2000, [['r', KEEP_NONE], ['r', INBOX, 'read']])], [PUB2]: [] });
  const got = await answer({ local: [], relays: outside }, signedInReq([KEEP_NONE]));
  const wrong = [];
  const scans = got.calls.scanLocal.filter((f) => Array.isArray(f.kinds) && f.kinds.includes(O.RELAY_LIST_KIND));
  if (!(scans.length === 1 && sameJson(scans[0], { kinds: [O.RELAY_LIST_KIND], authors: [got.assistantPubkey] }))) wrong.push(`local scan: ${show(scans)}`);
  const urls = got.calls.readRelay.map((c) => c.url).sort();
  if (!sameJson(urls, [PUB1, PUB2].sort())) wrong.push(`outside reads: ${show(urls)}`);
  if (!got.signed || !sameJson(got.signed.tags, [['r', KEEP_NONE], ['r', INBOX, 'read']])) wrong.push(`tags from the outside list: ${show(got.signed && got.signed.tags)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P8: no newest list anywhere, or none readable — there is nothing to keep: every relay is write (AC-3)', async () => {
  const wrong = [];
  for (const [label, opts] of [['none anywhere', { local: [], relays: { [PUB1]: [], [PUB2]: [] } }], ['unreachable', { local: [] }]]) {
    const got = await answer(opts, signedInReq([NEW, KEEP_NONE]));
    if (!got.signed || !sameJson(got.signed.tags, [['r', NEW, 'write'], ['r', KEEP_NONE, 'write']])) wrong.push(`${label}: ${show(got.signed && got.signed.tags)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P9: a failed local write sends the list nowhere and says so — ok false, stage local, not-delivered, the approved sentence (AC-4)', async () => {
  const got = await answer({ localFails: true });
  const r = got.result || {};
  assert(got.res.statusCode === 200 && got.body.success === true, `the request itself succeeds: ${got.res.statusCode} ${show(got.body)}`);
  assert(r.ok === false && r.stage === 'local' && r.outcome === 'not-delivered', `want ok false, stage local, not-delivered: ${show(r)}`);
  assert(r.message === O.PUBLISH.localFailed('strfry import failed (fixture)'), `want ${show(O.PUBLISH.localFailed('strfry import failed (fixture)'))}, got ${show(r.message)}`);
  assert(got.calls.publishToRelays.length === 0, 'nothing is sent to any relay');
});

test('P10: in local-only publish mode the list is kept here — one skipped row per relay of the set, kept-local, the approved sentence, nothing sent (AC-4)', async () => {
  const got = await answer({ localOnly: true }, signedInReq([NEW]));
  const r = got.result || {};
  const rows = (r.relays && r.relays.results) || [];
  assert(got.calls.importEvent.length === 1 && got.calls.publishToRelays.length === 0, 'written locally, sent nowhere');
  assert(r.ok === true && r.outcome === 'kept-local' && r.localOnly === true && r.message === O.PUBLISH.localOnly, `got ${show(r)}`);
  assert(rows.length > 0 && rows.every((row) => row.status === 'skipped'), `one skipped row per relay: ${show(rows)}`);
  assert(sameSet(rows.map((row) => row.relay), [NEW, PUB1, PUB2]), `the set, this instance's own left out: ${show(rows.map((row) => row.relay))}`);
});

test('P11: an empty outbox may be published — the event keeps only the inbox-only entries, and the answer\'s outbox is [] (AC-5; book Decision 7)', async () => {
  const got = await answer({ local: (pk) => [previousList(pk)] }, signedInReq([]));
  assert(got.res.statusCode === 200 && got.result && got.result.ok === true, `got ${got.res.statusCode} ${show(got.body)}`);
  assert(got.signed && sameJson(got.signed.tags, [['r', INBOX, 'read']]), `tags: ${show(got.signed && got.signed.tags)}`);
  assert(sameJson(got.result.outbox, []), `outbox: ${show(got.result.outbox)}`);
});

test('P12: the request names relays only — a kind, a pubkey or tags in the body change nothing; the signer is the session\'s Assistant, the kind 10002 (AC-2)', async () => {
  const req = { session: { authenticated: true, pubkey: VIEWER }, body: { relays: [NEW], kind: 1, pubkey: OTHER, tags: [['p', OTHER]], content: 'hello' }, query: { pubkey: OTHER } };
  const got = await answer({}, req);
  assert(got.signed && got.signed.kind === O.RELAY_LIST_KIND && got.signed.pubkey === got.assistantPubkey, `got ${show(got.signed && { kind: got.signed.kind, pubkey: got.signed.pubkey })}`);
  assert(sameJson(got.signed.tags, [['r', NEW, 'write']]) && got.signed.content === '', `tags and content come from the draft only: ${show(got.signed)}`);
  assert(sameJson(got.calls.getAssistantKeys, [VIEWER]), `whose key: the session's viewer, got ${show(got.calls.getAssistantKeys)}`);
});

test('P13: an unexpected throw answers 500 with the approved error (ADR 0003 sub-decision 5)', async () => {
  const got = await answer({ throwOn: 'getAssistantKeys' });
  assert(got.res.statusCode === 500 && sameJson(got.body, { success: false, error: O.PUBLISH.failed }), `got ${got.res.statusCode} ${show(got.body)}`);
});

/* ───────────────────────── C — the page's words and report ───────────────────────── */

test('C1: the copy module carries the publish words — the button, Publishing…, the subject, the empty-outbox line and the request-failed line (story 3 § Copy)', async () => {
  const copy = ((await esm(COPY_MOD, 'ADR 0002 sub-decision 3 creates it.')).OUTBOX_RELAYS_COPY || {}).publish || {};
  const want = { button: O.PUBLISH.button, publishing: O.PUBLISH.publishing, subject: O.PUBLISH.subject, emptyOutbox: O.PUBLISH.emptyOutbox, requestFailed: O.PUBLISH.requestFailed };
  const got = { button: copy.button, publishing: copy.publishing, subject: copy.subject, emptyOutbox: copy.emptyOutbox, requestFailed: copy.requestFailed };
  assert(sameJson(got, want), `OUTBOX_RELAYS_COPY.publish: want ${show(want)}, got ${show(got)}`);
});

test('R1: describeServerPublish (shipped) already draws the route\'s answer shape — a publish with its relay rows, a failed local write, and a whole-request refusal (AC-1; ADR 0003 sub-decision 7)', async () => {
  const { describeServerPublish } = await esm(REPORT_MOD, 'It exists since assistant-identification-tags #3.');
  const published = { ok: true, outcome: 'published', message: O.PUBLISH.published(1, 2), localOnly: false, outbox: [NEW], relays: { total: 2, success: 1, results: [{ relay: PUB1, status: 'accepted', reason: '' }, { relay: PUB2, status: 'refused', reason: 'no' }] } };
  const a = describeServerPublish({ name: O.SUBJECT, row: published });
  assert(a.ok === true && a.message === O.PUBLISH.published(1, 2) && a.rows.length === 2, `published: ${show(a)}`);
  const local = { ok: false, stage: 'local', outcome: 'not-delivered', message: O.PUBLISH.localFailed('x'), localOnly: false, relays: { total: 0, success: 0, results: [] } };
  const b = describeServerPublish({ name: O.SUBJECT, row: local });
  assert(b.ok === false && b.message === O.PUBLISH.localFailed('x'), `local failure: ${show(b)}`);
  const c = describeServerPublish({ name: O.SUBJECT, answer: { success: false, error: O.PUBLISH.refusals['no-assistant'] } });
  assert(c.ok === false && c.message === O.PUBLISH.refusals['no-assistant'], `refusal: ${show(c)}`);
});

/* ───────────────────────── S — sentinels ───────────────────────── */

test('S1: the route POST /api/assistant/outbox-relays/publish is registered and documented; BIBLE §11 has its row and §14 says an assistant\'s key signs its relay list through it (ADR 0003 § Implementation notes)', () => {
  const index = codeOnly(safeRead(API_INDEX));
  assert(/app\.post\(\s*['"]\/api\/assistant\/outbox-relays\/publish['"]/.test(index), 'src/api/index.js registers app.post(\'/api/assistant/outbox-relays/publish\', …)');
  assert(/^\s*\/api\/assistant\/outbox-relays\/publish:\s*$/m.test(safeRead(OPENAPI)), 'openapi.yaml documents /api/assistant/outbox-relays/publish');
  const bible = safeRead(BIBLE);
  assert(bible.split(NL).some((l) => l.startsWith('| POST |') && l.includes('`/api/assistant/outbox-relays/publish`')), 'BIBLE §11: a POST row for /api/assistant/outbox-relays/publish');
  assert(/kind 10002[^\n]*outbox-relays\/publish|outbox-relays\/publish[^\n]*kind 10002/.test(bible.slice(bible.indexOf('Assistant Keys'))), 'BIBLE §14 Assistant Keys: an assistant\'s key signs its kind 10002 relay list through the narrow route');
});

test('S2: one signing helper — identificationTaggings.js exports privkeyBytesOf and the new module uses it; the module carries no key literal and builds tags only through the library (ADR 0003 sub-decision 6)', () => {
  const taggings = load(TAGGINGS_MODULE, '');
  assert(typeof taggings.privkeyBytesOf === 'function', 'identificationTaggings.js exports privkeyBytesOf');
  const src = codeOnly(safeRead(MODULE));
  assert(/privkeyBytesOf/.test(src), 'relayListPublish.js uses privkeyBytesOf');
  assert(/buildRelayListTags\s*\(/.test(src) && /validateRelayListRequest\s*\(/.test(src), 'relayListPublish.js builds and validates through the library');
  assert(!/['"][0-9a-f]{64}['"]/i.test(src), 'no 64-hex literal in the module');
});

test('S3: nothing publishes a relay list at Assistant creation, and the generic signer is untouched — only src/api/index.js requires the new module (AC-2)', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (ent.name !== 'node_modules') walk(p); continue; }
      if (!/\.js$/.test(ent.name) || p === MODULE || p === API_INDEX) continue;
      if (/relayListPublish/.test(safeRead(p))) offenders.push(rel(p));
    }
  };
  walk(path.join(REPO, 'src'));
  assert(offenders.length === 0, `only src/api/index.js may name relayListPublish: ${offenders.join(', ')}`);
  assert(!/10002|relayList/i.test(codeOnly(safeRead(GENERIC_SIGNER))), 'the generic signer does not gain kind 10002');
});

test('S4: the page publishes through its util — one POST to the route with { relays } — never fetches itself, draws the report with describeServerPublish, publishTone and relayLine, and refreshes the answer (AC-1; ADR 0003 sub-decision 7)', () => {
  const util = codeOnly(safeRead(CLIENT_UTIL));
  const wrong = [];
  if (!/export\s+async\s+function\s+publishAssistantRelayList\s*\(/.test(util)) wrong.push('the util exports async publishAssistantRelayList(relays)');
  if (!/['"]\/api\/assistant\/outbox-relays\/publish['"]/.test(util) || !/method:\s*['"]POST['"]/.test(util) || !/JSON\.stringify\(\s*\{\s*relays\s*\}\s*\)/.test(util)) wrong.push('the util POSTs JSON { relays } to the route');
  const page = codeOnly(safeRead(PAGE));
  for (const [re, what] of [
    [/\bpublishAssistantRelayList\s*\(/, 'publishAssistantRelayList(draft)'], [/\bdescribeServerPublish\s*\(/, 'describeServerPublish(…)'],
    [/\bpublishTone\s*\(/, 'publishTone(…)'], [/\brelayLine\s*\(/, 'relayLine(…)'], [/\.refresh\s*\(\s*\)/, 'attention.refresh() after the publish'],
    [/aria-live=["']polite["']/, 'an aria-live="polite" results region'], [/OUTBOX_RELAYS_COPY\.publish\.(button|publishing)/, 'the button words from the copy'],
  ]) if (!re.test(page)) wrong.push(`the page uses ${what}`);
  if (/\bfetch\s*\(/.test(page)) wrong.push('the page must not fetch itself');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── H — live ───────────────────────── */

async function stackAvailable() {
  if (typeof fetch !== 'function') return false;
  try { const r = await fetch(`${HOST_BASE}/api/assistant/pubkey`); return r.status === 200; } catch { return false; }
}

test('H1: live — an anonymous POST to the route is refused with 401, never 200 (skips when no instance answers)', async () => {
  if (!(await stackAvailable())) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  const res = await fetch(`${HOST_BASE}${O.PUBLISH_ROUTE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relays: [NEW] }) });
  assert(res.status === 401, `expected 401, got ${res.status}`);
  return undefined;
});

async function run() {
  console.log(`${NL}=== assistant-relay-list-publish (assistant-outbox-relays #3) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`assistant-relay-list-publish: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  console.log(`${NL}assistant-relay-list-publish: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
