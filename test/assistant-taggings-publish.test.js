'use strict';
/**
 * assistant-identification-tags #3: your Assistant's two taggings of you.
 *
 * Story: engineering-team/stories/assistant-identification-tags/3-your-assistants-two-taggings.md
 * ADR:   engineering-team/decisions/assistant-identification-tags/0003-your-assistant-signs-its-two-taggings-through-one-narrow-route.md
 * Plan:  engineering-team/stories/assistant-identification-tags/3-your-assistants-two-taggings.test-plan.md
 * Browser half: tests/brainstorm/assistant-taggings-publish.spec.js (B-class — the second card's press and what it shows).
 * Words and shapes: test/helpers/identificationTagsFixtures.js.
 *
 * Re-aimed 2026-09-22 by identification-tags-authorship #1 (story engineering-team/stories/identification-tags-authorship/
 * 1-two-authored-tags-and-two-parked-taggings.md, its ADR 0001 and plan): the Assistant publishes one offered tagging,
 * "My Tapestry Owner", against the definition its own author (Nous' Tapestry Assistant) published; "My Human" is parked
 * and refused (E12); no single canonical author remains (E11).
 *
 * Classes:
 *   E — src/api/assistant/identificationTaggings.js driven through the dependencies ADR 0003 names (getAssistantKeys,
 *       getOwnerAssistantPubkey, scanLocal, readRelay, readConfiguredRelays, getConfigFromFile, importEvent, isLocalOnly,
 *       publishToRelays, now). Stack-free; the events are really signed and verified with nostr-tools.      [AC-1 … AC-7]
 *   B — buildAssistantTagging against the browser builder's layout (ui/src/utils/publishProfileTag.js).      [AC-1]
 *   C — the pure ESM additions: describeServerPublish (taggingPublishReport.js) and the copy's requestFailed. [AC-5]
 *   S — source sentinels: the route registered and documented; the z handle imported, not copied; the generic signer
 *       untouched; no creation path names the module; the page publishes through the util and never fetches.  [AC-3, AC-5, AC-7]
 *   R — regressions that pass before and after: the profile handler's seam and the generic signer's gates.
 *   H — live: an anonymous POST answers 401 not-signed-in (skips when no instance answers, or on a Node without fetch).
 *
 * Everything except R FAILS against the current code: the module, the util and the adapter do not exist; the page's second
 * card has no button; the route answers 404.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const X = require('./helpers/identificationTagsFixtures');

const REPO = path.resolve(__dirname, '..');
const MODULE = path.join(REPO, 'src/api/assistant/identificationTaggings.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const PROFILE_TAGS = path.join(REPO, 'src/api/profile-tags/index.js');
const GENERIC_SIGNER = path.join(REPO, 'src/api/strfry/commands/publishEvent.js');
const ASSISTANT_INDEX = path.join(REPO, 'src/api/assistant/index.js');
const PUBLISHER = path.join(REPO, 'ui/src/utils/publishProfileTag.js');
const REPORT_MOD = path.join(REPO, 'ui/src/utils/taggingPublishReport.js');
const CLIENT_UTIL = path.join(REPO, 'ui/src/utils/publishAssistantTaggings.js');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/identificationTagsCopy.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistant/IdentificationTags.jsx');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const VIEWER = 'a1'.repeat(32);
const OWNER = 'bb'.repeat(32);
const TA_FIXTURE = 'ee'.repeat(32); // the runtime instance TA, for the local z
const OTHER_TAG_AUTHOR = '6d'.repeat(32);
// A fixture definition is by the entry's own author; a parked slug gets another author's same-named tag.
const authorOf = (slug) => { const e = X.REQUIRED.find((x) => x.slug === slug); return e && e.offered ? e.author : OTHER_TAG_AUTHOR; };
const LEGACY_Z = '39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag';
const RELAYS = ['wss://a.example', 'wss://b.example'];
const ASSISTANT_ROWS = X.OFFERED.filter((e) => e.signer === 'assistant'); // one today: My Tapestry Owner
const OWNER_ROW = ASSISTANT_ROWS[0];
const PERSON_ROW = X.OFFERED.find((e) => e.signer === 'person');
const PARKED_KEY = 'my-human'; // parked: listed, never published (identification-tags-authorship #1 AC-5)
const CATEGORIES = ['aPopularGeneralPurposeRelays', 'aProfileRelays', 'aWotRelays', 'aTagFederationRelays'];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
const sameJson = (a, b) => show(sortKeys(a)) === show(sortKeys(b));
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}
async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __loadError: err }; }
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  const mod = await loadEsm(absPath);
  assert(!mod.__loadError, `${rel(absPath)} must load in Node as ESM: ${mod.__loadError && mod.__loadError.message}`);
  return mod;
}
let hExecuted = 0;
let hSkipped = 0;

/* ───────────────────────── the module under test, and the fakes ───────────────────────── */

function taggingsModule() {
  if (!fs.existsSync(MODULE)) {
    throw new Error('src/api/assistant/identificationTaggings.js does not exist. ADR 0003 § Implementation notes 2 creates it: ' +
      'createPublishIdentificationTaggingsHandler, handlePublishIdentificationTaggings, publishAssistantTaggingsFor, buildAssistantTagging, TAGGING_PUBLISH_CATEGORIES.');
  }
  delete require.cache[require.resolve(MODULE)];
  return require(MODULE);
}
function need(mod, name) {
  assert(typeof mod[name] === 'function', `src/api/assistant/identificationTaggings.js must export ${name}() (ADR 0003 § Implementation notes 2).`);
  return mod[name];
}
const nt = () => require('nostr-tools');
const tagOf = (ev, name) => { const t = (ev.tags || []).find((x) => x[0] === name); return t ? t[1] : null; };
const tagsOf = (ev, name) => (ev.tags || []).filter((x) => x[0] === name).map((x) => x[1]);
let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');
function definition(slug, { author = authorOf(slug), id } = {}) {
  idSeq += 1;
  return { id: id || hexId(idSeq), pubkey: author, kind: 39999, created_at: 500, tags: [['d', slug], ['z', `39998:${TA_FIXTURE}:tag`]], content: show({ tag: { slug, name: slug, description: '' } }), sig: '0'.repeat(128) };
}
function matching(events, filter) {
  const kinds = filter && filter.kinds; const authors = filter && filter.authors; const ds = filter && filter['#d'];
  return events.filter((e) => (!kinds || kinds.includes(e.kind)) && (!authors || authors.map((a) => a.toLowerCase()).includes(e.pubkey.toLowerCase())) && (!ds || ds.includes(tagOf(e, 'd'))));
}

/**
 * Recording fakes for every dependency ADR 0003 names.
 *   assistant   — 'customer' (a fresh key under the viewer) | 'owner-ta' (the viewer is OWNER and the key is the TA) |
 *                 null (none) | 'throw'.
 *   definitions — the definitions this instance's relay holds (default: the offered ones, each by its author); 'reject' makes the scan fail.
 *   relays      — { [url]: events } for the outside read on a definition miss (default: none configured for the read).
 *   configured  — what readConfiguredRelays answers (default RELAYS for the publish set, [] for the tag-relay read).
 *   localFails  — an array of tagging keys whose local import throws.
 *   localOnly   — local-only publish mode.
 *   rows        — (relays) => publish rows (default: every relay accepted).
 */
function fakes(opts = {}) {
  const n = nt();
  const sk = n.generateSecretKey();
  const assistantPubkey = n.getPublicKey(sk);
  const calls = { getAssistantKeys: [], scanLocal: [], readRelay: [], readConfiguredRelays: [], importEvent: [], publishToRelays: [], order: [] };
  const defs = opts.definitions === undefined ? X.OFFERED.map((e) => definition(e.slug)) : opts.definitions;
  const deps = {
    getAssistantKeys: async (pubkey) => {
      calls.getAssistantKeys.push(pubkey);
      if (opts.assistant === 'throw') throw new Error('fixture: the key store exploded');
      if (opts.assistant === null) return null;
      return { pubkey: assistantPubkey, privkey: Buffer.from(sk).toString('hex'), npub: 'npub1fixture', nsec: 'nsec1fixture' };
    },
    getOwnerAssistantPubkey: () => (opts.noRuntimeTa ? null : TA_FIXTURE),
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      if (defs === 'reject') throw new Error('fixture: strfry scan failed');
      return matching(defs, filter);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url, filter });
      const held = opts.relays && opts.relays[url];
      if (!Array.isArray(held)) return { status: 'unreachable', events: [], error: 'fixture' };
      return { status: 'ok', events: matching(held, filter), error: null };
    },
    readConfiguredRelays: (categories) => {
      calls.readConfiguredRelays.push(categories);
      if (Array.isArray(categories) && categories.length === 1 && categories[0] === 'aTagFederationRelays') return (opts.tagRelays || []).slice();
      return (opts.configured || RELAYS).slice();
    },
    getConfigFromFile: (key, dflt) => dflt,
    importEvent: async (event) => {
      calls.order.push(`local:${tagOf(event, 'd')}`);
      calls.importEvent.push(event);
      const key = X.REQUIRED.find((e) => tagOf(event, 'd') === X.taggingDTag({ slug: e.slug, targetPubkey: tagOf(event, 'p'), signerPubkey: event.pubkey }));
      if (opts.localFails && key && opts.localFails.includes(key.key)) throw new Error('strfry import failed (fixture)');
    },
    isLocalOnly: () => Boolean(opts.localOnly),
    publishToRelays: async (event, relays) => {
      calls.order.push(`relays:${tagOf(event, 'd')}`);
      calls.publishToRelays.push({ event, relays });
      const rows = opts.rows || ((list) => list.map((relay) => ({ relay, status: 'accepted', reason: '' })));
      return rows(relays);
    },
    now: () => 1_700_000_000_000,
  };
  return { deps, calls, assistantPubkey, sk };
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = (keys, pubkey = VIEWER, extra = {}) => ({ session: { authenticated: true, pubkey }, body: { keys }, query: {}, ...extra });
async function answer(opts, req) {
  const factory = need(taggingsModule(), 'createPublishIdentificationTaggingsHandler');
  const { deps, calls, assistantPubkey } = fakes(opts);
  const handle = factory(deps);
  const res = fakeRes();
  await handle(req === undefined ? signedInReq(ASSISTANT_ROWS.map((e) => e.key)) : req, res, deps);
  const results = res.body && Array.isArray(res.body.results) ? res.body.results : [];
  return { res, body: res.body, results, row: (key) => results.find((r) => r && r.key === key), calls, assistantPubkey };
}

/* ───────────────────────── E — the handler ───────────────────────── */

test('E1: without an authenticated session the route answers 401 not-signed-in with the approved words, and reads no key (AC-2)', async () => {
  const wrong = [];
  for (const [label, req] of [['no session', { body: { keys: ['my-tapestry-owner'] } }], ['authenticated unset', { session: { pubkey: VIEWER }, body: { keys: ['my-tapestry-owner'] } }], ['not 64-hex', { session: { authenticated: true, pubkey: 'npub1x' }, body: { keys: ['my-tapestry-owner'] } }]]) {
    const { res, body, calls } = await answer({}, req);
    if (res.statusCode !== 401 || !body || body.success !== false || body.code !== 'not-signed-in' || body.error !== X.REFUSALS['not-signed-in']) wrong.push(`${label}: ${res.statusCode} ${show(body)}`);
    if (calls.getAssistantKeys.length || calls.importEvent.length) wrong.push(`${label}: read a key or imported`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('E2: a body that is not a non-empty list of the Assistant-signed required keys is refused 400 not-an-assistant-tagging before any key is read (AC-3)', async () => {
  const wrong = [];
  for (const [label, body] of [['no keys', {}], ['empty', { keys: [] }], ['not a list', { keys: 'my-tapestry-owner' }], ['a number', { keys: [1] }], ["a person's tagging", { keys: [PERSON_ROW.key] }], ['a parked tagging alone', { keys: [PARKED_KEY] }], ['a parked tagging beside the offered one', { keys: [OWNER_ROW.key, PARKED_KEY] }], ['unknown', { keys: ['my-cat'] }], ['one good, one bad', { keys: ['my-human', 'my-agent'] }]]) {
    const { res, body: got, calls } = await answer({}, { session: { authenticated: true, pubkey: VIEWER }, body });
    if (res.statusCode !== 400 || !got || got.code !== 'not-an-assistant-tagging' || got.error !== X.REFUSALS['not-an-assistant-tagging']) wrong.push(`${label}: ${res.statusCode} ${show(got)}`);
    if (calls.getAssistantKeys.length || calls.importEvent.length) wrong.push(`${label}: read a key or imported`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('E3: a signed-in viewer with no Assistant here is refused 403 no-assistant, and nothing is signed or written (AC-2)', async () => {
  const { res, body, calls } = await answer({ assistant: null });
  assert(res.statusCode === 403 && body && body.code === 'no-assistant' && body.error === X.REFUSALS['no-assistant'], `got ${res.statusCode} ${show(body)}`);
  assert(calls.importEvent.length === 0 && calls.publishToRelays.length === 0 && calls.scanLocal.length === 0, 'nothing signed, scanned or written');
  assert(show(calls.getAssistantKeys) === show([VIEWER]), `the key was looked up for the session's viewer only: ${show(calls.getAssistantKeys)}`);
});

test('E4: the happy path — the offered tagging signed with the Assistant\'s key in the browser\'s shape, written locally before any relay, each reported in the profile publish\'s words, in the required order (AC-1, AC-4)', async () => {
  const { res, body, results, calls, assistantPubkey } = await answer({});
  assert(res.statusCode === 200 && body && body.success === true, `got ${res.statusCode} ${show(body)}`);
  assert(results.length === 1 && results[0].key === OWNER_ROW.key, `one row, the offered assistant tagging: ${show(results.map((r) => r.key))}`);
  assert(calls.importEvent.length === 1 && calls.publishToRelays.length === 1, `one local write and one fan-out: ${show(calls.order)}`);
  for (const [i, entry] of ASSISTANT_ROWS.entries()) {
    const ev = calls.importEvent[i];
    const wrong = [];
    if (ev.kind !== 39999) wrong.push(`kind ${ev.kind}`);
    if (ev.pubkey !== assistantPubkey) wrong.push('not signed by the Assistant');
    if (!nt().verifyEvent(ev)) wrong.push('the signature does not verify');
    if (tagOf(ev, 'p') !== VIEWER) wrong.push('p is not the viewer');
    if (tagOf(ev, 'a') !== X.definitionAddress(entry)) wrong.push(`a ${tagOf(ev, 'a')} (want the definition by its own author, ${X.definitionAddress(entry)})`);
    if (tagOf(ev, 'd') !== X.taggingDTag({ slug: entry.slug, targetPubkey: VIEWER, signerPubkey: assistantPubkey })) wrong.push(`d ${tagOf(ev, 'd')}`);
    if (!/^[0-9a-f]{64}$/.test(tagOf(ev, 'e') || '')) wrong.push('e is not the definition id');
    const zs = tagsOf(ev, 'z');
    if (!sameJson(zs, [LEGACY_Z, `39998:${TA_FIXTURE}:nostr-user-tag`])) wrong.push(`z stamps ${show(zs)}`);
    if (tagOf(ev, 'polarity') !== '1') wrong.push(`polarity ${tagOf(ev, 'polarity')}`);
    if (ev.created_at !== 1_700_000_000) wrong.push(`created_at ${ev.created_at}`);
    let content = null; try { content = JSON.parse(ev.content); } catch { /* below */ }
    if (!content || !content.nostrUserTag || content.nostrUserTag.taggedPubkey !== VIEWER || content.nostrUserTag.tagEventId !== tagOf(ev, 'e') || content.nostrUserTag.tagAddress !== tagOf(ev, 'a')) wrong.push(`content ${ev.content}`);
    if (calls.order.indexOf(`local:${tagOf(ev, 'd')}`) > calls.order.indexOf(`relays:${tagOf(ev, 'd')}`)) wrong.push('the relays heard before the local relay');
    const row = results[i];
    const want = X.serverPublishedRow(entry, { relays: RELAYS });
    const shaped = row && { key: row.key, name: row.name, ok: row.ok, outcome: row.outcome, message: row.message, localOnly: row.localOnly, relays: row.relays };
    if (!sameJson(shaped, want)) wrong.push(`row: want ${show(want)}, got ${show(shaped)}`);
    assert(wrong.length === 0, `${entry.key}: ${wrong.join('; ')}`);
  }
  const s = show(body);
  assert(!s.includes('privkey') && !s.includes('nsec') && !s.includes(assistantPubkey), 'the answer carries no key material and no assistant pubkey');
  assert(calls.publishToRelays.every((c) => sameJson(c.relays, RELAYS)), `published to the configured set: ${show(calls.publishToRelays.map((c) => c.relays))}`);
  assert(calls.readConfiguredRelays.some((c) => sameJson(c, CATEGORIES)), `the outside set is the four lists (${show(CATEGORIES)}); asked ${show(calls.readConfiguredRelays)}`);
});

test('E5: whose Assistant — the Owner\'s is whatever the key mapping answers for the Owner; the target is always the viewer; duplicate keys are published once (AC-1, AC-2)', async () => {
  const { results, calls } = await answer({}, signedInReq([OWNER_ROW.key, OWNER_ROW.key], OWNER));
  assert(show(calls.getAssistantKeys) === show([OWNER]), `keys resolved for the session's viewer: ${show(calls.getAssistantKeys)}`);
  assert(results.length === 1 && results[0].key === OWNER_ROW.key, `duplicates collapse: ${show(results.map((r) => r.key))}`);
  assert(calls.importEvent[0], `the tagging was signed and written locally; got ${show(results)}`);
  assert(tagOf(calls.importEvent[0], 'p') === OWNER, 'the target is the viewer');
});

test('E6: the definition not found (a same-named tag by another author is not it), or not checkable, refuses the tagging — tag-not-found with story 2\'s sentence — and nothing is signed (AC-6)', async () => {
  const one = await answer({ definitions: [definition(OWNER_ROW.slug, { author: OTHER_TAG_AUTHOR })], tagRelays: ['wss://dcosl.example'], relays: { 'wss://dcosl.example': [] } });
  const owner = one.row(OWNER_ROW.key);
  assert(owner && owner.ok === false && owner.code === 'tag-not-found' && owner.message === X.PAGE_COPY.tagNotFound(OWNER_ROW.name), `not found: ${show(owner)}`);
  assert(one.calls.importEvent.length === 0, 'nothing signed for the refused one');
  const two = await answer({ definitions: [], tagRelays: [] });
  assert(two.results.length === 1 && two.results.every((r) => r.ok === false && r.code === 'tag-not-found'), `unfinished definition (no outside relay): tag-not-found; got ${show(two.results)}`);
  assert(two.calls.importEvent.length === 0, 'nothing signed');
  const three = await answer({ definitions: 'reject' });
  assert(three.res.statusCode === 200 && three.results.every((r) => r.code === 'tag-not-found'), `a failed local scan: a tag-not-found row, not a 500; got ${three.res.statusCode} ${show(three.results)}`);
});

test('E7: a failed local write sends the tagging to no relay and says so (AC-4)', async () => {
  const { results, calls } = await answer({ localFails: [OWNER_ROW.key] });
  const owner = results[0];
  assert(owner && owner.ok === false && owner.stage === 'local' && owner.outcome === 'not-delivered' && owner.message === X.serverLocalFailedRow(OWNER_ROW, 'strfry import failed (fixture)').message, `the failed local write: ${show(owner)}`);
  assert(calls.publishToRelays.length === 0, 'nothing reached the relays');
  assert(results.length === 1, `one row; got ${show(results.map((r) => r.key))}`);
});

test('E8: in local-only publish mode every configured relay reads skipped, the outcome is kept-local in the approved words, and no socket opens (AC-4)', async () => {
  const { results, calls } = await answer({ localOnly: true });
  assert(calls.publishToRelays.length === 0, 'no fan-out in local-only mode');
  for (const [i, entry] of ASSISTANT_ROWS.entries()) {
    const want = X.serverPublishedRow(entry, { relays: RELAYS, localOnly: true });
    const row = results[i];
    const shaped = row && { key: row.key, name: row.name, ok: row.ok, outcome: row.outcome, message: row.message, localOnly: row.localOnly, relays: row.relays };
    assert(sameJson(shaped, want), `${entry.key}: want ${show(want)}, got ${show(shaped)}`);
  }
  assert(calls.importEvent.length === 1, 'still written locally');
});

test('E9: a partial fan-out counts only the relays that accepted, in the profile publish\'s words; the local z is omitted with no runtime TA (AC-4)', async () => {
  const one = await answer({ rows: (relays) => relays.map((relay, i) => ({ relay, status: i === 0 ? 'accepted' : 'refused', reason: i === 0 ? '' : 'blocked' })) });
  const want = X.serverPublishedRow(ASSISTANT_ROWS[0], { relays: RELAYS, accepted: 1 });
  const row = one.results[0];
  assert(row.message === want.message && row.relays.success === 1 && row.outcome === 'published', `partial: ${show(row)}`);
  const two = await answer({ noRuntimeTa: true });
  assert(sameJson(tagsOf(two.calls.importEvent[0], 'z'), [LEGACY_Z]), `no runtime TA: only the canonical z; got ${show(tagsOf(two.calls.importEvent[0], 'z'))}`);
});

test('E10: an unexpected throw outside the per-tagging loop answers 500 with the approved error (ADR 0003 sub-decision 6)', async () => {
  const { res, body } = await answer({ assistant: 'throw' });
  assert(res.statusCode === 500 && sameJson(body, { success: false, error: "Could not publish your Assistant's taggings" }), `got ${res.statusCode} ${show(body)}`);
});

test('E11: the definition is looked up by address under its own author — Nous\' Tapestry Assistant for My Tapestry Owner — through the tag relays only on a miss; the retired single author is never asked (identification-tags-authorship ADR 0001 sub-decision 4)', async () => {
  const { calls } = await answer({});
  const scan = calls.scanLocal.find((f) => Array.isArray(f.authors) && f.authors[0] === OWNER_ROW.author);
  assert(scan && sameJson(scan.kinds, [39999]) && sameJson(scan['#d'], [OWNER_ROW.slug]), `one local scan for the slug under the definition's author ${OWNER_ROW.author.slice(0, 8)}…; got ${show(calls.scanLocal)}`);
  assert(!calls.scanLocal.some((f) => Array.isArray(f.authors) && f.authors[0] === 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f'), 'the retired single canonical author is never asked');
  assert(calls.readRelay.length === 0, 'found locally: no outside read');
  const miss = await answer({ definitions: [], tagRelays: ['wss://dcosl.example'], relays: { 'wss://dcosl.example': [definition(OWNER_ROW.slug)] } });
  assert(miss.calls.readRelay.length === 1 && miss.calls.readRelay[0].url === 'wss://dcosl.example' && sameJson(miss.calls.readRelay[0].filter.authors, [OWNER_ROW.author]), `a local miss reads the tag relays under the author: ${show(miss.calls.readRelay)}`);
  assert(miss.results.every((r) => r.ok === true), `the definition from the relay publishes: ${show(miss.results.map((r) => [r.key, r.ok, r.code]))}`);
});

test('E12: a parked key is refused 400 before any key is read — alone, beside the offered one, or the other parked one — even when a same-named definition exists, and nothing is published for either (identification-tags-authorship #1 AC-5)', async () => {
  const defs = [...X.OFFERED.map((e) => definition(e.slug)), definition(PARKED_KEY, { author: OTHER_TAG_AUTHOR })];
  const wrong = [];
  for (const [label, keys] of [['alone', [PARKED_KEY]], ['beside the offered one', [OWNER_ROW.key, PARKED_KEY]], ['the other parked one', ['my-agent']]]) {
    const { res, body, calls } = await answer({ definitions: defs }, signedInReq(keys));
    if (res.statusCode !== 400 || !body || body.code !== 'not-an-assistant-tagging' || body.error !== X.REFUSALS['not-an-assistant-tagging']) wrong.push(`${label}: ${res.statusCode} ${show(body)}`);
    if (calls.getAssistantKeys.length || calls.importEvent.length || calls.publishToRelays.length) wrong.push(`${label}: read a key, signed or published`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── B — the builder against the browser's layout ───────────────────────── */

test('B1: buildAssistantTagging composes the browser builder\'s tag layout — the same tag names in the same order, the same content keys (AC-1; ADR 0003 sub-decision 5)', () => {
  const mod = taggingsModule();
  const build = need(mod, 'buildAssistantTagging');
  const ev = build({ signerPubkey: 'a2'.repeat(32), targetPubkey: VIEWER, tag: { eventId: 'ab'.repeat(32), slug: OWNER_ROW.slug, authorPubkey: OWNER_ROW.author }, localTaPubkey: TA_FIXTURE, canonicalZ: LEGACY_Z, createdAt: 1_700_000_000 });
  const got = ev.tags.map((t) => t[0]);
  // The browser's layout, read from its source: the names in its `tags: [ … ]` literal, in order.
  const src = codeOnly(safeRead(PUBLISHER));
  const start = src.indexOf('tags: [', src.indexOf('const unsigned = {'));
  const end = src.indexOf(']', src.indexOf("['polarity'", start)) + 1;
  const literal = src.slice(start, end);
  const want = [...literal.matchAll(/\[\s*'([a-z]+)'/g)].map((m) => m[1]);
  assert(want.length >= 6, `could not read the browser builder's tag layout from ${rel(PUBLISHER)}: ${show(want)}`);
  assert(sameJson(got, want), `tag names: browser ${show(want)}, server ${show(got)}`);
  const content = JSON.parse(ev.content);
  assert(sameJson(Object.keys(content.nostrUserTag).sort(), ['tagAddress', 'tagEventId', 'taggedPubkey']), `content keys ${show(content)}`);
  assert(ev.kind === 39999 && ev.pubkey === 'a2'.repeat(32) && ev.created_at === 1_700_000_000 && !ev.sig, 'an unsigned template: kind, pubkey, created_at, no sig');
  const noLocal = build({ signerPubkey: 'a2'.repeat(32), targetPubkey: VIEWER, tag: { eventId: 'ab'.repeat(32), slug: OWNER_ROW.slug, authorPubkey: OWNER_ROW.author }, localTaPubkey: null, canonicalZ: LEGACY_Z, createdAt: 1 });
  assert(sameJson(tagsOf(noLocal, 'z'), [LEGACY_Z]), 'without a runtime TA the local z is omitted, the canonical stays');
});

/* ───────────────────────── C — the pure ESM additions ───────────────────────── */

test('C1: describeServerPublish turns the route\'s rows into the report the cards draw — published, kept local, a failed local write, a tag not found, and a whole-request refusal (AC-5; ADR 0003 sub-decision 8)', async () => {
  const mod = await esm(REPORT_MOD, 'story 2 created it; ADR 0003 sub-decision 8 adds describeServerPublish.');
  const f = mod.describeServerPublish;
  assert(typeof f === 'function', 'taggingPublishReport.js must export describeServerPublish({ name, row })');
  const e = ASSISTANT_ROWS[0];
  const pub = f({ name: e.name, row: X.serverPublishedRow(e) });
  assert(pub.ok === true && pub.outcome === 'published' && pub.message === X.serverPublishedRow(e).message && pub.rows.length === 2 && pub.rows[0].status === 'accepted', `published: ${show(pub)}`);
  const kept = f({ name: e.name, row: X.serverPublishedRow(e, { localOnly: true }) });
  assert(kept.ok === true && kept.outcome === 'kept-local' && kept.rows.every((r) => r.status === 'skipped'), `kept local: ${show(kept)}`);
  const local = f({ name: e.name, row: X.serverLocalFailedRow(e) });
  assert(local.ok === false && local.outcome === 'not-delivered' && local.message === X.serverLocalFailedRow(e).message && local.rows.length === 0, `local failed: ${show(local)}`);
  const nf = f({ name: e.name, row: X.serverTagNotFoundRow(e) });
  assert(nf.ok === false && nf.message === X.PAGE_COPY.tagNotFound(e.name) && nf.rows.length === 0, `tag not found: ${show(nf)}`);
  const refused = f({ name: e.name, row: null, answer: X.serverRefusal('no-assistant') });
  assert(refused.ok === false && refused.message === X.REFUSALS['no-assistant'] && refused.rows.length === 0, `a refusal: ${show(refused)}`);
  assert(mod.publishTone(pub) === 'success' && mod.publishTone(kept) === 'info' && mod.publishTone(local) === 'error' && mod.publishTone(nf) === 'error', 'the tone rule applies to server rows too');
});

test('C2: the copy gains the request-failed notice, and nothing else changes (ADR 0003 § Implementation notes 6)', async () => {
  const mod = await esm(COPY_MOD, 'story 2 created it.');
  assert(mod.IDENTIFICATION_TAGS_COPY.requestFailed === X.REQUEST_FAILED, `requestFailed: want ${show(X.REQUEST_FAILED)}, got ${show(mod.IDENTIFICATION_TAGS_COPY.requestFailed)}`);
  assert(mod.IDENTIFICATION_TAGS_COPY.buttons.assistant === X.PAGE_COPY.buttons.assistant, 'the second button\'s words are the approved ones');
});

/* ───────────────────────── S — by source ───────────────────────── */

test('S1: the route is registered and documented, the module imports the z handle rather than copying the literal, and carries no key literal (ADR 0003 sub-decisions 1, 5)', () => {
  const index = safeRead(API_INDEX);
  assert(/app\.post\(\s*['"]\/api\/assistant\/identification-tags\/publish['"]/.test(index), "src/api/index.js must register app.post('/api/assistant/identification-tags/publish', …)");
  assert(/^\s*\/api\/assistant\/identification-tags\/publish:\s*$/m.test(safeRead(OPENAPI)), 'src/api/openapi.yaml must document the route');
  const src = codeOnly(safeRead(MODULE));
  assert(src, `${rel(MODULE)} does not exist`);
  assert(!/82b75e47/.test(src) && !/[0-9a-f]{64}/.test(src), 'the module carries no pubkey literal: the canonical z comes from profile-tags/index.js, the TA from the runtime');
  assert(/NOSTR_USER_TAG_Z_TAG/.test(src) && /require\(\s*['"]\.\.\/profile-tags['"]\s*\)/.test(src), 'imports NOSTR_USER_TAG_Z_TAG from ../profile-tags');
  const exportsBlock = safeRead(PROFILE_TAGS).slice(safeRead(PROFILE_TAGS).lastIndexOf('module.exports'));
  assert(/NOSTR_USER_TAG_Z_TAG/.test(exportsBlock), 'src/api/profile-tags/index.js exports NOSTR_USER_TAG_Z_TAG');
  assert(/require\(\s*['"]\.\/attention['"]\s*\)/.test(src) && /lookupByAddresses/.test(src), 'the definitions come from ./attention\'s lookupByAddresses');
  assert(!/req\.query/.test(src) && !/customerPubkey|req\.body\.pubkey/.test(src), 'no pubkey is taken from the request');
});

test('S2: the generic signer is untouched, and no creation path names the new module (AC-3, AC-7)', () => {
  const signer = codeOnly(safeRead(GENERIC_SIGNER));
  assert(/if \(!isOwner\(req\) && !req\.localTrusted\)/.test(signer) && /event\.kind === 0/.test(signer) && !/identificationTaggings|identification-tags/.test(signer), 'publishEvent.js keeps its owner gate and kind-0 refusal and knows nothing of this route');
  const { execSync } = require('child_process');
  const hits = execSync(`/usr/bin/grep -rl "identificationTaggings" ${path.join(REPO, 'src')} ${path.join(REPO, 'bin')} ${path.join(REPO, 'setup')} 2>/dev/null || true`).toString().trim().split(NL).filter(Boolean).map((p) => path.relative(REPO, p)).sort();
  // grep matches contents, not filenames: the module does not spell its own name inside itself, so the one legitimate
  // hit is the route registration. Any creation path that required the module would appear here.
  assert(sameJson(hits, ['src/api/index.js']), `only the route registration names the module; found ${show(hits)}`);
  for (const [file, re] of [['src/api/assistant/index.js', /identificationTaggings|identification-tags\/publish/], ['src/utils/customerManager.js', /identificationTaggings/], ['setup/create_nostr_identity.sh', /identification/]]) {
    assert(!re.test(safeRead(path.join(REPO, file))), `${file} must not publish taggings at creation`);
  }
});

test('S3: the page publishes the second card through the util, never fetches itself, refreshes the answer, and keeps a per-card publishing state (AC-5; ADR 0003 sub-decisions 7, 9)', () => {
  const page = codeOnly(safeRead(PAGE));
  const wrong = [];
  if (!/\bpublishAssistantIdentificationTaggings\s*\(/.test(page)) wrong.push('no publishAssistantIdentificationTaggings(…) call');
  if (!/from\s*['"]\.\.\/\.\.\/utils\/publishAssistantTaggings['"]/.test(page)) wrong.push('the util is not imported from ../../utils/publishAssistantTaggings');
  if (!/\bdescribeServerPublish\s*\(/.test(page)) wrong.push('no describeServerPublish(…)');
  if (/\bfetch\s*\(/.test(page) || /['"`]\/api\//.test(page)) wrong.push('the page must not fetch or name an /api/ path (story 2 S1)');
  if (!/onPublish=\{\s*hasAssistant\s*\?\s*publishAssistantTaggings\s*:\s*null\s*\}/.test(page)) wrong.push('the second card gets onPublish={hasAssistant ? publishAssistantTaggings : null}');
  if (!/publishingCard/.test(page)) wrong.push('per-card publishing state (publishingCard)');
  if (!/COPY\.requestFailed/.test(page)) wrong.push('the request-failed notice');
  const occurrences = (page.match(/attention\.refresh\(\)/g) || []).length;
  if (occurrences < 2) wrong.push(`attention.refresh() after each card's publish (found ${occurrences})`);
  const util = codeOnly(safeRead(CLIENT_UTIL));
  if (!util) wrong.push(`${rel(CLIENT_UTIL)} does not exist`);
  else {
    if (!/export\s+async\s+function\s+publishAssistantIdentificationTaggings\s*\(/.test(util)) wrong.push('the util exports publishAssistantIdentificationTaggings');
    if (!/fetch\(\s*['"`]\/api\/assistant\/identification-tags\/publish['"`]/.test(util) || !/method:\s*['"]POST['"]/.test(util)) wrong.push('the util POSTs the route');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── R — regressions that pass before and after ───────────────────────── */

test('R1: the profile publish keeps its seam and the generic signer its gates', () => {
  assert(/createPublishProfileHandler/.test(safeRead(ASSISTANT_INDEX)), 'createPublishProfileHandler still exported');
  const signer = codeOnly(safeRead(GENERIC_SIGNER));
  assert(/if \(!isOwner\(req\) && !req\.localTrusted\)/.test(signer), 'the owner gate');
});

/* ───────────────────────── H — live ───────────────────────── */

async function postJson(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    let json = null; try { json = await res.json(); } catch { json = null; }
    return { status: res.status, body: json };
  } finally { clearTimeout(timer); }
}
async function stackAvailable() {
  if (typeof fetch !== 'function') return false;
  try { const r = await fetch(`${HOST_BASE}/api/assistant/pubkey`); return r.status === 200; } catch { return false; }
}
// The auth middleware denies every unauthenticated POST under /api/ before a handler runs (ADR
// security-auth-exposure/0002's default deny: 401 { error: 'Authentication required for this action' }), so an
// anonymous POST is refused twice over; the handler's own not-signed-in check (E1) is the second line, reachable only
// by a caller the middleware lets through. Live, the status is what can be pinned; a 404 means the route is missing.
test('H1: live — an anonymous POST is refused with 401 (the middleware\'s default deny), never 404 and never 200', async () => {
  if (!(await stackAvailable())) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  const got = await postJson(`${HOST_BASE}${X.PUBLISH_ROUTE}`, { keys: ['my-tapestry-owner'] });
  assert(got.status === 401, `expected 401; got ${got.status} ${show(got.body)} — a 404 means the route is missing on ${HOST_BASE}, or the server there predates it (restart the backend after implementing).`);
  // The middleware answers 401 for any /api/ POST, registered or not, so the status alone cannot tell the route from a
  // missing one; the documented route (S1) is the second half of this check.
  const doc = safeRead(OPENAPI);
  assert(/^\s*\/api\/assistant\/identification-tags\/publish:\s*$/m.test(doc), 'the route is documented (S1), so the 401 is the middleware\'s refusal of a real route');
  return undefined;
});

async function run() {
  console.log(`${NL}=== assistant-taggings-publish (assistant-identification-tags #3) ===`);
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
  console.log(`assistant-taggings-publish: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('assistant-taggings-publish: !! LIVE COVERAGE DID NOT RUN — stack unreachable (or no fetch on this Node).');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') { failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' }); fail++; }
  }
  console.log(`${NL}assistant-taggings-publish: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
