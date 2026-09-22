'use strict';
/**
 * assistant-identification-tags #1: the one answer — which identification taggings are missing for your Assistant —
 * and the hub's first real mark.
 *
 * Story: engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md
 * ADR:   engineering-team/decisions/assistant-identification-tags/0001-one-assistant-attention-answer.md
 * Plan:  engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.test-plan.md
 * Browser half: tests/brainstorm/assistant-attention.spec.js (B-class — what a viewer SEES on the hub and in the pill).
 * Expected words and shapes: test/helpers/identificationTagsFixtures.js.
 *
 * Re-aimed 2026-09-22 by identification-tags-authorship #1 (story engineering-team/stories/identification-tags-authorship/
 * 1-two-authored-tags-and-two-parked-taggings.md, its ADR 0001 and plan): each offered definition has its own author,
 * My Agent and My Human are parked, and the answer carries the two offered rows only. L2, L3, U3–U14 and U18 pin it.
 *
 * Classes:
 *   L — the shared library src/lib/identification-tags (pure CommonJS): the list (offered and parked), each
 *       definition's author and address, the d-tag composer, the polarity reader.                                            [AC-1, AC-3]
 *   U — src/api/assistant/attention.js driven through the dependencies ADR 0001 names (getAssistantPubkeyFor,
 *       scanLocal, readRelay, readConfiguredRelays, getConfigFromFile). Stack-free.                     [AC-2 … AC-7]
 *   C — the pure ESM utils, loaded in Node: ui/src/utils/assistantAttention.js (the summarizer), the two-reading
 *       merge assistantAttention(user, attention) and CHECKED_ACTIONS in ui/src/pages/assistant/actions.js, and the
 *       picker's assistantPhase in ui/src/utils/topBarAlert.js.                                       [AC-5]
 *   S — source sentinels on the server: the route is registered and documented, the module never writes, never reads
 *       a query parameter, and reads relays strictly.                                                [AC-2, AC-7]
 *   D — source sentinels on the UI files this runner cannot execute (JSX): the provider, where App.jsx mounts it, the
 *       hub and the slot reading it, the Vite alias.                                                  [AC-5, AC-7]
 *   R — regressions that pass before and after: the publisher's d-tag rule, and the old one-argument answers.
 *   H — the live contract on whatever instance is reachable (BRAINSTORM_BASE_URL, else localhost:7778): one anonymous
 *       GET. Skips when nothing answers, or on a Node without fetch.
 *
 * Everything except R FAILS against the current code: src/lib/identification-tags, src/api/assistant/attention.js,
 * ui/src/utils/assistantAttention.js and ui/src/context/AssistantAttentionContext.jsx do not exist; assistantAttention
 * takes one argument and answers no alertCount; the picker has no assistantPhase; /api/assistant/attention answers 404.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const X = require('./helpers/identificationTagsFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB_DIR = path.join(REPO, 'src/lib/identification-tags');
const LIB = path.join(LIB_DIR, 'index.js');
const ATTENTION_MODULE = path.join(REPO, 'src/api/assistant/attention.js');
const SETUP_STATUS_MODULE = path.join(REPO, 'src/api/setup/status.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const UI_UTIL = path.join(REPO, 'ui/src/utils/assistantAttention.js');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const PICKER = path.join(REPO, 'ui/src/utils/topBarAlert.js');
const PROVIDER = path.join(REPO, 'ui/src/context/AssistantAttentionContext.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const HUB_PAGE = path.join(REPO, 'ui/src/pages/assistant/Index.jsx');
const SLOT = path.join(REPO, 'ui/src/components/TopBarAlert.jsx');
const VITE = path.join(REPO, 'ui/vite.config.js');
const PUBLISHER = path.join(REPO, 'ui/src/utils/publishProfileTag.js');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const NL = String.fromCharCode(10);

// Fixture keys, never live ones. TA stands in for an instance TA: the suite never reads a real one.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const TA = 'ee'.repeat(32);
const OTHER = 'b2'.repeat(32);
const OTHER_TAG_AUTHOR = '6d'.repeat(32);
// Each offered definition's author (identification-tags-authorship #1): a fixture tagging points at the entry's own
// definition, and a fixture definition is by the entry's author; a parked slug gets another author's same-named tag.
const authorOf = (slug) => { const e = X.REQUIRED.find((x) => x.slug === slug); return e && e.offered ? e.author : OTHER_TAG_AUTHOR; };

// Fixture relays.
const DCOSL = 'wss://dcosl.example';
const SECOND = 'wss://second.example';
const OWN = 'ws://localhost:7777';

// ADR 0001 § Implementation notes 2.
const TAG_RELAY_CATEGORIES = ['aTagFederationRelays'];
const RELAY_BUDGET_MS = 8000;
const ACTION = X.CHECKED_ACTION;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

/** Key-order-blind JSON equality. */
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
const sameJson = (a, b) => show(sortKeys(a)) === show(sortKeys(b));

/** Source with comments removed (block comments become blank lines, so line numbers stay true). */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

let hExecuted = 0;
let hSkipped = 0;

/* ───────────────────────── fixtures: events ───────────────────────── */

let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');
const tagOf = (ev, name) => { const t = (ev.tags || []).find((x) => x[0] === name); return t ? t[1] : null; };

function ev(kind, pubkey, createdAt, tags, id, content = '') {
  idSeq += 1;
  return { id: id || hexId(idSeq), pubkey, kind, created_at: createdAt, tags, content, sig: '0'.repeat(128) };
}

/**
 * A tagging in the deployed shape (ui/src/utils/publishProfileTag.js): d/p/a/e/z/z/polarity. `polarity` null omits
 * the tag; `tagAuthor` is whose same-named tag it points at (the entry's definition author by default).
 */
function tagging(signer, target, slug, { polarity = '1', createdAt = 1000, id, tagAuthor = authorOf(slug) } = {}) {
  const tags = [
    ['d', X.taggingDTag({ slug, targetPubkey: target, signerPubkey: signer })],
    ['p', target],
    ['a', `39999:${tagAuthor}:${slug}`],
    ['e', hexId(9000 + idSeq)],
    ['z', '39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag'],
    ['z', `39998:${TA}:nostr-user-tag`],
  ];
  if (polarity !== null) tags.push(['polarity', String(polarity)]);
  return ev(39999, signer, createdAt, tags, id, show({ nostrUserTag: { taggedPubkey: target, tagAddress: `39999:${tagAuthor}:${slug}` } }));
}

/** A tag definition (protocols/drafts/tags.md § Tag definitions) by `author`, at d = slug. */
function definition(slug, { author = authorOf(slug), createdAt = 500, id, name } = {}) {
  return ev(39999, author, createdAt, [['d', slug], ['z', `39998:${TA}:tag`]], id,
    show({ tag: { slug, name: name || slug, description: `fixture ${slug}` } }));
}

/** The offered taggings for a viewer and their assistant, all applied. */
function allOffered({ viewer = VIEWER, assistant = ASSISTANT, createdAt = 1000 } = {}) {
  return X.OFFERED.map((e) => (e.signer === 'person'
    ? tagging(viewer, assistant, e.slug, { createdAt })
    : tagging(assistant, viewer, e.slug, { createdAt })));
}
const offeredDefinitions = () => X.OFFERED.map((e) => definition(e.slug));

/** What a relay answers a filter with: the events matching its kinds, authors and #d. */
function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map((a) => String(a).toLowerCase()) : null;
  const ds = Array.isArray(filter && filter['#d']) ? filter['#d'] : null;
  return events.filter((e) => (!kinds || kinds.includes(e.kind))
    && (!authors || authors.includes(String(e.pubkey).toLowerCase()))
    && (!ds || ds.includes(tagOf(e, 'd'))));
}

/* ───────────────────────── the modules under test ───────────────────────── */

function libModule() {
  if (!fs.existsSync(LIB)) {
    throw new Error('src/lib/identification-tags/index.js does not exist. ADR 0001 sub-decision 1 creates it: the pure, dependency-free ' +
      'library both the server and the UI load (REQUIRED_TAGGINGS, OFFERED_TAGGINGS, definitionAddress, taggingDTag, readPolarity, ' +
      'polarityBucket, isTagging, signerAndTarget).');
  }
  delete require.cache[require.resolve(LIB)];
  return require(LIB);
}
function attentionModule() {
  if (!fs.existsSync(ATTENTION_MODULE)) {
    throw new Error('src/api/assistant/attention.js does not exist. ADR 0001 § Implementation notes 2 creates it: the one module that ' +
      'answers GET /api/assistant/attention for the session\'s viewer (handleAssistantAttention, lookupByAddresses, checkIdentificationTags, ' +
      'evaluateIdentificationTags, tagRelays).');
  }
  delete require.cache[require.resolve(ATTENTION_MODULE)];
  return require(ATTENTION_MODULE);
}
function need(mod, name, file = 'src/api/assistant/attention.js') {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0001 § Implementation notes).`);
  return mod[name];
}

/**
 * The injected dependencies, under the names ADR 0001 gives them. Every one RECORDS its calls.
 *   assistant   — what getAssistantPubkeyFor answers: default ASSISTANT; null = no assistant; 'throw'.
 *   local       — the events this instance's relay holds (an array), or 'reject' (the scan fails), or a function
 *                 of the filter.
 *   relays      — { [url]: events | 'unreachable' | 'hang' | 'throw' }: each outside relay. An unlisted relay is
 *                 unreachable. An array answers `ok` with the events matching the filter.
 *   configured  — what readConfiguredRelays answers for the tag-federation category; default [DCOSL].
 *   config      — getConfigFromFile's values (BRAINSTORM_RELAY_URL, STRFRY_DOMAIN).
 */
function fakes(opts = {}) {
  const calls = { getAssistantPubkeyFor: [], scanLocal: [], readRelay: [], readConfiguredRelays: [] };
  const deps = {
    getAssistantPubkeyFor: async (pk) => {
      calls.getAssistantPubkeyFor.push(pk);
      if (opts.assistant === 'throw') throw new Error('fixture: the key store exploded');
      return opts.assistant === undefined ? ASSISTANT : opts.assistant;
    },
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      if (opts.local === 'reject') throw new Error('fixture: strfry scan failed');
      if (typeof opts.local === 'function') return opts.local(filter);
      return matching(Array.isArray(opts.local) ? opts.local : [], filter);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url, filter });
      const answer = opts.relays ? opts.relays[url] : undefined;
      if (answer === 'hang') return new Promise(() => {});
      if (answer === 'throw') throw new Error('fixture: the relay read threw');
      if (!Array.isArray(answer)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      return { status: 'ok', events: matching(answer, filter), error: null };
    },
    readConfiguredRelays: (categories) => {
      calls.readConfiguredRelays.push(categories);
      return (opts.configured || [DCOSL]).slice();
    },
    getConfigFromFile: (key, dflt) => (opts.config && Object.prototype.hasOwnProperty.call(opts.config, key) ? opts.config[key] : dflt),
  };
  return { deps, calls };
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = (pubkey = VIEWER, extra = {}) => ({ session: { authenticated: true, pubkey }, query: {}, ...extra });

async function answer(opts, req = signedInReq()) {
  const handle = need(attentionModule(), 'handleAssistantAttention');
  const { deps, calls } = fakes(opts);
  const res = fakeRes();
  await handle(req, res, deps);
  const action = res.body && res.body.actions && res.body.actions[ACTION];
  const rows = action && Array.isArray(action.taggings) ? action.taggings : [];
  const row = (key) => rows.find((r) => r && r.key === key);
  return { res, body: res.body, action, rows, row, calls };
}

/** Resolve within `ms`, or report 'HUNG' — clearing the timer either way. */
async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __loadError: err }; }
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  const mod = await loadEsm(absPath);
  assert(!mod.__loadError, `${rel(absPath)} must load in Node as ESM (relative imports with .js): ${mod.__loadError && mod.__loadError.message}`);
  return mod;
}
const actionsModule = () => esm(ACTIONS_MOD, 'It holds assistantAttention and CHECKED_ACTIONS (ADR 0001 sub-decision 6).');
const pickerModule = () => esm(PICKER, 'It holds pickTopBarPill (ADR 0001 sub-decision 8).');
const uiUtil = () => esm(UI_UTIL, 'ADR 0001 § Implementation notes 3 creates it: the pure summarizeAttention() the provider hands out.');

/* ───────────────────────── L — the shared library ───────────────────────── */

test('L1: the library exists, is CommonJS, and requires nothing — both the server and the UI (through the Vite alias) can load it (ADR 0001 sub-decision 1)', () => {
  const mod = libModule();
  const src = codeOnly(safeRead(LIB));
  assert(!/\brequire\s*\(/.test(src) && !/^\s*import\b/m.test(src), 'src/lib/identification-tags/index.js must be dependency-free: no require() and no import');
  for (const name of ['REQUIRED_TAGGINGS', 'OFFERED_TAGGINGS', 'definitionAddress', 'taggingDTag', 'readPolarity', 'polarityBucket', 'isTagging', 'signerAndTarget']) {
    assert(mod[name] !== undefined, `the library must export ${name}`);
  }
  assert(mod.CANONICAL_TAG_AUTHOR === undefined && mod.canonicalTagAddress === undefined, 'the single canonical author is gone (identification-tags-authorship #1 AC-1): no CANONICAL_TAG_AUTHOR, no canonicalTagAddress');
});

test('L2: each offered entry carries the author of its definition — Nous for My Tapestry Assistant, Nous\' Tapestry Assistant for My Tapestry Owner — and its address 39999:<author>:<slug>; a parked entry carries neither (identification-tags-authorship #1 AC-1; ADR 0001 sub-decision 1)', () => {
  const mod = libModule();
  const { nip19 } = require('nostr-tools');
  const wrong = [];
  for (const e of X.REQUIRED) {
    const got = (mod.REQUIRED_TAGGINGS || []).find((x) => x && x.key === e.key) || {};
    if (e.offered) {
      const fromNpub = nip19.decode(X.AUTHORS[e.key].npub).data;
      if (fromNpub !== e.author) wrong.push(`${e.key}: the fixture npub ${X.AUTHORS[e.key].npub} is not ${e.author}`);
      if (got.author !== e.author) wrong.push(`${e.key}: author want ${e.author} (${X.AUTHORS[e.key].name}, ${X.AUTHORS[e.key].npub}), got ${show(got.author)}`);
      if (got.address !== X.definitionAddress(e)) wrong.push(`${e.key}: address want ${X.definitionAddress(e)}, got ${show(got.address)}`);
      if (mod.definitionAddress(got) !== X.definitionAddress(e)) wrong.push(`definitionAddress(${e.key}): want ${X.definitionAddress(e)}, got ${show(mod.definitionAddress(got))}`);
    } else {
      if (got.author !== null || got.address !== null) wrong.push(`${e.key} is parked: author and address must be null, got ${show([got.author, got.address])}`);
      if (mod.definitionAddress(got) !== null) wrong.push(`definitionAddress(${e.key}): want null, got ${show(mod.definitionAddress(got))}`);
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L3: the list is still the four taggings in order — My Tapestry Assistant, My Agent (you on your Assistant), My Tapestry Owner, My Human (your Assistant on you) — each with its name, slug, signer, target, offered, author and address; OFFERED_TAGGINGS is the offered two in order; both frozen (AC-1)', () => {
  const mod = libModule();
  const pick = (e) => ({ key: e.key, name: e.name, slug: e.slug, signer: e.signer, target: e.target, offered: e.offered, author: e.author, address: e.address });
  const got = (mod.REQUIRED_TAGGINGS || []).map(pick);
  assert(sameJson(got, X.REQUIRED.map(pick)), `REQUIRED_TAGGINGS: want ${show(X.REQUIRED.map(pick))}, got ${show(got)}`);
  const offered = (mod.OFFERED_TAGGINGS || []).map(pick);
  assert(sameJson(offered, X.OFFERED.map(pick)), `OFFERED_TAGGINGS: want ${show(X.OFFERED.map(pick))}, got ${show(offered)}`);
  assert(Object.isFrozen(mod.REQUIRED_TAGGINGS) && Object.isFrozen(mod.OFFERED_TAGGINGS), 'both lists are frozen');
});

test('L4: taggingDTag composes the publisher\'s address — profile-tag-<slug>-<target[0:8]>-<signer[0:8]> — and signerAndTarget resolves each entry\'s signer and target from the viewer and their assistant (AC-3)', () => {
  const mod = libModule();
  const d = mod.taggingDTag({ slug: 'my-tapestry-assistant', targetPubkey: ASSISTANT, signerPubkey: VIEWER });
  assert(d === `profile-tag-my-tapestry-assistant-${ASSISTANT.slice(0, 8)}-${VIEWER.slice(0, 8)}`, `taggingDTag: got ${show(d)}`);
  const wrong = [];
  for (const e of mod.REQUIRED_TAGGINGS) {
    const st = mod.signerAndTarget(e, { personPubkey: VIEWER, assistantPubkey: ASSISTANT });
    const want = e.signer === 'person' ? { signerPubkey: VIEWER, targetPubkey: ASSISTANT } : { signerPubkey: ASSISTANT, targetPubkey: VIEWER };
    if (!sameJson(st, want)) wrong.push(`${e.key}: want ${show(want)}, got ${show(st)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L5: readPolarity and polarityBucket read a tagging the way the reads do — absent is apply, ≥ 0.5 applies, ≤ −0.5 disputes, between is neutral, junk is apply — and isTagging knows a tagging by its d prefix (AC-3)', () => {
  const mod = libModule();
  const cases = [[null, 1, 'apply'], ['1', 1, 'apply'], ['-1', -1, 'dispute'], ['0.2', 0.2, 'neutral'], ['-0.5', -0.5, 'dispute'], ['0.5', 0.5, 'apply'], ['x', 1, 'apply']];
  const wrong = [];
  for (const [pol, num, bucket] of cases) {
    const t = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant', { polarity: pol });
    const n = mod.readPolarity(t);
    const b = mod.polarityBucket(n);
    if (n !== num || b !== bucket) wrong.push(`polarity ${show(pol)}: want ${num}/${bucket}, got ${show(n)}/${show(b)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
  assert(mod.isTagging(tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant')) === true, 'a profile-tag-… kind 39999 is a tagging');
  assert(mod.isTagging(definition('my-tapestry-assistant')) === false, 'a tag definition (d = slug) is not a tagging');
  assert(mod.isTagging(ev(1, VIEWER, 1, [['d', 'profile-tag-x-a-b']])) === false, 'a kind 1 is not a tagging');
});

/* ───────────────────────── U — the handler ───────────────────────── */

test('U1: without an authenticated session the endpoint answers { success: true, signedIn: false } and asks nothing (AC-2)', async () => {
  const handle = need(attentionModule(), 'handleAssistantAttention');
  const cases = [
    ['no session at all', {}],
    ['an empty session', { session: {} }],
    ['a sign-in still pending (authenticated unset)', { session: { pubkey: VIEWER } }],
    ['authenticated is not exactly true', { session: { authenticated: 'true', pubkey: VIEWER } }],
    ['a session pubkey that is not 64-hex', { session: { authenticated: true, pubkey: 'npub1notahexkey' } }],
  ];
  const wrong = [];
  for (const [label, req] of cases) {
    const { deps, calls } = fakes();
    const res = fakeRes();
    await handle(req, res, deps);
    if (res.statusCode !== 200 || !sameJson(res.body, X.SIGNED_OUT)) wrong.push(`${label}: ${res.statusCode} ${show(res.body)}`);
    if (calls.getAssistantPubkeyFor.length || calls.scanLocal.length || calls.readRelay.length) wrong.push(`${label}: asked something`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U2: a signed-in viewer with no assistant on this instance gets { signedIn: true, hasAssistant: false, actions: {} } — nothing is scanned or read (AC-2)', async () => {
  const { res, body, calls } = await answer({ assistant: null });
  assert(res.statusCode === 200 && sameJson(body, X.NO_ASSISTANT), `want ${show(X.NO_ASSISTANT)}, got ${res.statusCode} ${show(body)}`);
  assert(calls.scanLocal.length === 0 && calls.readRelay.length === 0, 'no assistant, nothing to check: no scan, no relay read');
  assert(show(calls.getAssistantPubkeyFor) === show([VIEWER]), `the assistant is looked up for the session\'s viewer: ${show(calls.getAssistantPubkeyFor)}`);
});

test('U3: every tagging and definition on this instance\'s relay — each row present, finished, local; the action finished and done; no outside relay is read (AC-3, AC-4, AC-6)', async () => {
  const { body, action, rows, calls } = await answer({ local: [...allOffered(), ...offeredDefinitions()] });
  assert(body && body.success === true && body.signedIn === true && body.hasAssistant === true, `got ${show(body)}`);
  assert(action && action.finished === true && action.done === true && action.pending === false, `action flags: ${show(action && { finished: action.finished, done: action.done, pending: action.pending })}`);
  const got = rows.map((r) => ({ key: r.key, name: r.name, slug: r.slug, signer: r.signer, target: r.target, present: r.present, finished: r.finished, source: r.source, found: r.definition && r.definition.found, dsource: r.definition && r.definition.source }));
  const want = X.OFFERED.map((e) => ({ key: e.key, name: e.name, slug: e.slug, signer: e.signer, target: e.target, present: true, finished: true, source: 'local', found: true, dsource: 'local' }));
  assert(sameJson(got, want), `rows: want ${show(want)}, got ${show(got)}`);
  assert(calls.readRelay.length === 0, `a local hit reads no outside relay; read ${show(calls.readRelay.map((c) => c.url))}`);
  assert(calls.scanLocal.length <= 4, `the taggings and the definitions are looked up by address in at most four local scans — two signers, two definition authors (identification-tags-authorship ADR 0001 sub-decision 2); got ${calls.scanLocal.length}`);
  const pairs = new Set();
  for (const f of calls.scanLocal) {
    assert(Array.isArray(f.kinds) && f.kinds.length === 1 && f.kinds[0] === 39999 && Array.isArray(f.authors) && f.authors.length === 1 && Array.isArray(f['#d']),
      `each local scan is { kinds: [39999], authors: [one], '#d': [...] }; got ${show(f)}`);
    for (const d of f['#d']) pairs.add(`${f.authors[0]}|${d}`);
  }
  const wantPairs = new Set([
    ...X.OFFERED.map((e) => (e.signer === 'person'
      ? `${VIEWER}|${X.taggingDTag({ slug: e.slug, targetPubkey: ASSISTANT, signerPubkey: VIEWER })}`
      : `${ASSISTANT}|${X.taggingDTag({ slug: e.slug, targetPubkey: VIEWER, signerPubkey: ASSISTANT })}`)),
    ...X.OFFERED.map((e) => `${e.author}|${e.slug}`),
  ]);
  assert(sameJson([...pairs].sort(), [...wantPairs].sort()), `the (author, d) pairs looked up: want ${show([...wantPairs].sort())}, got ${show([...pairs].sort())}`);
  for (const r of rows) {
    assert(r.definition && typeof r.definition.eventId === 'string' && r.definition.eventId.length === 64 && r.definition.address === X.definitionAddress(X.REQUIRED.find((e) => e.key === r.key)),
      `${r.key}: the definition carries its eventId and its author's address for story 2; got ${show(r.definition)}`);
  }
});

test('U4: a local miss for one tagging asks the outside tag relays with only the missing addresses, and the newest found counts — present, finished, source relay (AC-3, AC-4)', async () => {
  const local = [...allOffered().filter((e) => tagOf(e, 'd') !== X.taggingDTag({ slug: 'my-tapestry-owner', targetPubkey: VIEWER, signerPubkey: ASSISTANT })), ...offeredDefinitions()];
  const older = tagging(ASSISTANT, VIEWER, 'my-tapestry-owner', { createdAt: 900 });
  const newer = tagging(ASSISTANT, VIEWER, 'my-tapestry-owner', { createdAt: 1200 });
  const { action, row, calls } = await answer({ local, relays: { [DCOSL]: [older, newer] } });
  const r = row('my-tapestry-owner');
  assert(r && r.present === true && r.finished === true && r.source === 'relay', `my-tapestry-owner from the relay: got ${show(r)}`);
  assert(action.done === true && action.finished === true, `the action is done once the relay supplied the last one: ${show(action)}`);
  assert(calls.readRelay.length === 1 && calls.readRelay[0].url === DCOSL, `one outside read, of the tag-federation relay; got ${show(calls.readRelay.map((c) => c.url))}`);
  const f = calls.readRelay[0].filter;
  const wantD = X.taggingDTag({ slug: 'my-tapestry-owner', targetPubkey: VIEWER, signerPubkey: ASSISTANT });
  assert(Array.isArray(f['#d']) && f['#d'].length === 1 && f['#d'][0] === wantD && show(f.authors) === show([ASSISTANT]),
    `the outside filter carries only the missing address for its author; got ${show(f)}`);
  assert(show(calls.readConfiguredRelays) === show([TAG_RELAY_CATEGORIES]), `the tag relays are the aTagFederationRelays setting; asked ${show(calls.readConfiguredRelays)}`);
});

test('U5: the newest event at an address wins — a later dispute makes the tagging missing; on a created_at tie the lexically lowest id (AC-3)', async () => {
  const apply = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant', { createdAt: 1000, polarity: '1' });
  const laterDispute = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant', { createdAt: 1100, polarity: '-1' });
  const one = await answer({ local: [], relays: { [DCOSL]: [apply, laterDispute] } });
  const r1 = one.row('my-tapestry-assistant');
  assert(r1 && r1.present === false && r1.finished === true, `a later dispute by the signer: missing, finished; got ${show(r1)}`);
  const tieA = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant', { createdAt: 2000, polarity: '-1', id: 'f'.repeat(64) });
  const tieB = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant', { createdAt: 2000, polarity: '1', id: '0'.repeat(63) + '1' });
  const two = await answer({ local: [], relays: { [DCOSL]: [tieA, tieB] } });
  const r2 = two.row('my-tapestry-assistant');
  assert(r2 && r2.present === true, `on a tie the lexically lowest id wins (the apply); got ${show(r2)}`);
});

test('U6: polarity — absent is apply; dispute and neutral are missing; junk is apply (AC-3)', async () => {
  const cases = [[null, true], ['1', true], ['-1', false], ['0.2', false], ['x', true]];
  const wrong = [];
  for (const [pol, present] of cases) {
    const t = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant', { polarity: pol });
    const { row } = await answer({ local: [t] });
    const r = row('my-tapestry-assistant');
    if (!r || r.present !== present || r.finished !== true) wrong.push(`polarity ${show(pol)}: want present ${present}, got ${show(r && { present: r.present, finished: r.finished })}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U7: a tagging that points at another author\'s same-named tag counts as present — the definition\'s author never gates the read (AC-3; principle 2)', async () => {
  const t = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant', { tagAuthor: OTHER_TAG_AUTHOR });
  const { row } = await answer({ local: [t] });
  const r = row('my-tapestry-assistant');
  assert(r && r.present === true && r.finished === true, `a tagging of 39999:${OTHER_TAG_AUTHOR.slice(0, 8)}…:my-agent by the viewer: present; got ${show(r)}`);
});

test('U8: someone else\'s dispute changes nothing, and someone else\'s apply is not the viewer\'s (AC-3)', async () => {
  const mine = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant');
  const theirs = tagging(OTHER, ASSISTANT, 'my-tapestry-assistant', { polarity: '-1', createdAt: 5000 });
  const one = await answer({ local: [mine, theirs] });
  assert(one.row('my-tapestry-assistant').present === true, `another person\'s dispute leaves the viewer\'s apply present; got ${show(one.row('my-tapestry-assistant'))}`);
  const two = await answer({ local: [theirs, tagging(OTHER, ASSISTANT, 'my-tapestry-assistant', { createdAt: 6000 })] });
  assert(two.row('my-tapestry-assistant').present === false && two.row('my-tapestry-owner').present === false,
    `only the required signer\'s tagging counts; got ${show(two.rows.map((r) => [r.key, r.present]))}`);
});

test('U9: unfinished, with a reason — this instance\'s relay unreadable; no outside relay configured; every outside relay unreachable (AC-4)', async () => {
  const one = await answer({ local: 'reject' });
  assert(one.res.statusCode === 200 && one.rows.length === 2 && one.rows.every((r) => r.finished === false && r.present === false && r.reason === 'local-unreadable' && r.source === null),
    `a failed local scan: every row unfinished with reason local-unreadable; got ${show(one.rows.map((r) => [r.key, r.finished, r.reason]))}`);
  assert(one.action.finished === false && one.action.done === false && one.action.pending === false, `unfinished action: ${show(one.action)}`);
  assert(one.rows.every((r) => r.definition && r.definition.finished === false && r.definition.found === null), `definitions unfinished too: ${show(one.rows.map((r) => r.definition))}`);

  const two = await answer({ local: [], configured: [] });
  assert(two.rows.every((r) => r.finished === false && r.reason === 'no-outside-relays'), `no relay configured: no-outside-relays; got ${show(two.rows.map((r) => [r.key, r.reason]))}`);
  assert(two.calls.readRelay.length === 0, 'nothing to read');

  const three = await answer({ local: [], relays: { [DCOSL]: 'unreachable', [SECOND]: 'throw' }, configured: [DCOSL, SECOND] });
  assert(three.rows.every((r) => r.finished === false && r.reason === 'outside-unreachable'), `every relay unreachable: outside-unreachable; got ${show(three.rows.map((r) => [r.key, r.reason]))}`);
});

test('U10: a relay that never answers loses the budget (RELAY_BUDGET_MS = 8000) and the answering relay still counts (AC-4)', async () => {
  const found = allOffered();
  const started = Date.now();
  const out = await within(answer({ local: [], relays: { [DCOSL]: 'hang', [SECOND]: [...found, ...offeredDefinitions()] }, configured: [DCOSL, SECOND] }), RELAY_BUDGET_MS + 3000);
  assert(out !== 'HUNG', `the answer never came: a hanging relay must lose the budget (${Date.now() - started} ms)`);
  assert(out.action && out.action.finished === true && out.action.done === true, `the answering relay decides: ${show(out.action)}`);
  assert(Date.now() - started >= RELAY_BUDGET_MS - 100, 'the hanging relay was given the whole budget');
});

test('U11: this instance\'s own relay is never an outside relay — loopback and BRAINSTORM_RELAY_URL\'s host are dropped, and a duplicate is read once (AC-3)', async () => {
  const { calls } = await answer({
    local: [], configured: [OWN, 'wss://own.example/', DCOSL, DCOSL.toUpperCase(), 'not-a-relay'],
    config: { BRAINSTORM_RELAY_URL: 'wss://own.example' }, relays: { [DCOSL]: [] },
  });
  // Distinct, because each of the four lookups (the viewer's, the assistant's, the two definition authors') reads the
  // relay once with its own author filter (ADR 0001 § Implementation notes 2; identification-tags-authorship ADR 0001
  // sub-decision 2): the set of relays read is what own-relay exclusion and de-duplication decide.
  const urls = [...new Set(calls.readRelay.map((c) => c.url))];
  assert(sameJson(urls, [DCOSL]), `outside relays: want [${DCOSL}], read ${show(calls.readRelay.map((c) => c.url))}`);
  assert(calls.readRelay.length <= 4, `at most one read per relay per lookup, four lookups; got ${calls.readRelay.length}`);
});

test('U12: the definitions — found at its own author\'s address; not found (finished); the found one carries its eventId; a same-named tag by another author is not it — and a missing definition never makes a present tagging missing (AC-6; identification-tags-authorship #1 AC-2)', async () => {
  const def = definition('my-tapestry-assistant', { id: 'ab'.repeat(32) });
  const { row } = await answer({ local: [...allOffered(), def], relays: { [DCOSL]: [] } });
  const assistant = row('my-tapestry-assistant');
  assert(assistant.definition.found === true && assistant.definition.finished === true && assistant.definition.eventId === 'ab'.repeat(32) && assistant.definition.source === 'local',
    `my-tapestry-assistant\'s definition: found locally with its id; got ${show(assistant.definition)}`);
  const owner = row('my-tapestry-owner');
  assert(owner.definition.found === false && owner.definition.finished === true && owner.definition.eventId === null,
    `my-tapestry-owner\'s definition: not found, finished (the relay answered); got ${show(owner.definition)}`);
  assert(owner.present === true, 'the tagging stays present whatever the definition');
  const byAnother = await answer({ local: [...allOffered(), definition('my-tapestry-assistant', { author: OTHER_TAG_AUTHOR, id: 'cd'.repeat(32) })], relays: { [DCOSL]: [] } });
  assert(byAnother.row('my-tapestry-assistant').definition.found === false, `a same-named tag by another author is not the definition the page publishes against; got ${show(byAnother.row('my-tapestry-assistant').definition)}`);
});

test('U13: the action\'s flags — done needs every offered tagging finished and present; pending needs one finished and missing, even while the other is unfinished; the invariants hold; two rows, never a parked one (AC-5; identification-tags-authorship #1 AC-2)', async () => {
  const mod = attentionModule();
  const evaluate = need(mod, 'evaluateIdentificationTags');
  const found = (e) => ({ finished: true, event: e, source: 'local' });
  const none = { finished: true, event: null, source: null };
  const unfinished = { finished: false, reason: 'outside-unreachable' };
  const defs = () => ({ finished: true, event: definition('x'), source: 'local' });
  const entries = (lookups) => X.OFFERED.map((required, i) => ({ required, lookup: lookups[i], definition: defs() }));
  const two = allOffered();
  const cases = [
    ['both present', entries(two.map(found)), { finished: true, done: true, pending: false }],
    ['one present, one missing', entries([found(two[0]), none]), { finished: true, done: false, pending: true }],
    ['one present, one unfinished', entries([found(two[0]), unfinished]), { finished: false, done: false, pending: false }],
    ['one missing, one unfinished', entries([none, unfinished]), { finished: false, done: false, pending: true }],
    ['both unfinished', entries([unfinished, unfinished]), { finished: false, done: false, pending: false }],
  ];
  const wrong = [];
  for (const [label, input, want] of cases) {
    const got = evaluate({ entries: input });
    const flags = got && { finished: got.finished, done: got.done, pending: got.pending };
    if (!sameJson(flags, want)) wrong.push(`${label}: want ${show(want)}, got ${show(flags)}`);
    if (got && ((got.done && !got.finished) || (got.done && got.pending))) wrong.push(`${label}: invariants broken ${show(flags)}`);
    if (got && (!Array.isArray(got.taggings) || got.taggings.length !== 2 || got.taggings.some((t) => !X.OFFERED.some((e) => e.key === t.key)))) wrong.push(`${label}: the two offered rows expected, got ${show(got && got.taggings && got.taggings.map((t) => t.key))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U14: whose assistant — the Owner\'s is the TA, a Customer\'s their own: the mapping\'s answer is the signer of the assistant\'s tagging and the target of the viewer\'s; the local scans are by the two signers and the two definition authors only (AC-2)', async () => {
  const owner = 'bb'.repeat(32);
  const { calls, row } = await answer({ assistant: TA, local: [tagging(TA, owner, 'my-tapestry-owner'), tagging(owner, TA, 'my-tapestry-assistant')] }, signedInReq(owner));
  assert(show(calls.getAssistantPubkeyFor) === show([owner]), `the assistant is resolved for the session\'s viewer only: ${show(calls.getAssistantPubkeyFor)}`);
  assert(row('my-tapestry-owner').present === true && row('my-tapestry-assistant').present === true,
    `the TA\'s tagging of the owner and the owner\'s of the TA are found; got ${show(calls.scanLocal)} → ${show(X.OFFERED.map((e) => [e.key, row(e.key) && row(e.key).present]))}`);
  const authors = new Set(calls.scanLocal.map((f) => f.authors[0]));
  const definitionAuthors = X.OFFERED.map((e) => e.author);
  assert(authors.has(owner) && authors.has(TA) && definitionAuthors.every((a) => authors.has(a)) && !authors.has(ASSISTANT) && authors.size === 2 + new Set(definitionAuthors).size,
    `local scans by the owner, the TA and the two definition authors only; got ${show([...authors])}`);
});

test('U15: no query parameter changes the answer or the relays asked — the answer follows the session (AC-2)', async () => {
  const local = [...allOffered(), ...offeredDefinitions()];
  const plain = await answer({ local });
  const probed = await answer({ local }, signedInReq(VIEWER, { query: { pubkey: OTHER, viewer: OTHER, assistant: OTHER, relays: 'wss://evil.example', wotPov: 'user' } }));
  assert(sameJson(plain.body, probed.body), `query parameters changed the answer: without ${show(plain.body)}, with ${show(probed.body)}`);
  const asked = show(probed.calls.scanLocal) + show(probed.calls.readRelay) + show(probed.calls.getAssistantPubkeyFor);
  assert(!asked.includes(OTHER) && !asked.includes('evil'), `a query parameter reached a lookup: ${asked}`);
});

test('U16: the answer carries no viewer or assistant pubkey (AC-2)', async () => {
  const { body } = await answer({ local: [...allOffered(), ...offeredDefinitions()] });
  const s = show(body);
  assert(!s.includes(VIEWER) && !s.includes(ASSISTANT), `the answer must carry neither the viewer\'s nor the assistant\'s pubkey: ${s}`);
});

test('U17: an unexpected throw answers 500 { success: false, error: "Could not check assistant attention" } (ADR 0001 § Implementation notes 2)', async () => {
  const { res, body } = await answer({ assistant: 'throw' });
  assert(res.statusCode === 500 && sameJson(body, { success: false, error: 'Could not check assistant attention' }), `got ${res.statusCode} ${show(body)}`);
});

test('U18: the parked taggings are neither looked up nor answered — no scan or read names a parked slug or its d, the answer has no row for them, and they never hold the action back or push it forward (identification-tags-authorship #1 AC-2)', async () => {
  const parkedMine = tagging(VIEWER, ASSISTANT, 'my-tapestry-assistant');
  const parkedDefinition = definition('my-tapestry-assistant');
  const { action, rows, calls } = await answer({ local: [...allOffered(), ...offeredDefinitions(), parkedMine, parkedDefinition], relays: { [DCOSL]: [] } });
  assert(action.finished === true && action.done === true && action.pending === false, `both offered present: done, whatever exists for the parked two; got ${show(action && { finished: action.finished, done: action.done, pending: action.pending })}`);
  assert(sameJson(rows.map((r) => r.key), X.OFFERED.map((e) => e.key)), `rows for the offered taggings only, in order; got ${show(rows.map((r) => r.key))}`);
  const named = [...calls.scanLocal, ...calls.readRelay.map((c) => c.filter)].flatMap((f) => (Array.isArray(f['#d']) ? f['#d'] : []));
  const parkedNames = X.PARKED.flatMap((e) => [e.slug, X.taggingDTag({ slug: e.slug, targetPubkey: ASSISTANT, signerPubkey: VIEWER }), X.taggingDTag({ slug: e.slug, targetPubkey: VIEWER, signerPubkey: ASSISTANT })]);
  assert(!named.some((d) => parkedNames.includes(d)), `a lookup named a parked slug or d: ${show(named.filter((d) => parkedNames.includes(d)))}`);
  const offeredMissing = await answer({ local: [...offeredDefinitions(), parkedMine], relays: { [DCOSL]: [] } });
  assert(offeredMissing.action.pending === true && offeredMissing.action.done === false && offeredMissing.rows.length === 2, `a parked tagging present anyway does not make the action done; got ${show(offeredMissing.action)}`);
});

/* ───────────────────────── C — the UI utils (ESM) ───────────────────────── */

test('C1: summarizeAttention — a signed-in answer is answered with its actions; anything else (null, a failure, signed out, no assistant) is not, or has no assistant (ADR 0001 § Implementation notes 3)', async () => {
  const mod = await uiUtil();
  const s = mod.summarizeAttention;
  assert(typeof s === 'function', 'ui/src/utils/assistantAttention.js must export summarizeAttention(answer)');
  const done = s(X.DONE);
  assert(done.answered === true && done.hasAssistant === true && done.actions && done.actions[ACTION] && done.actions[ACTION].done === true, `DONE: ${show(done)}`);
  const none = s(X.NO_ASSISTANT);
  assert(none.answered === true && none.hasAssistant === false && sameJson(none.actions, {}), `NO_ASSISTANT: ${show(none)}`);
  for (const [label, input] of [['null', null], ['a failure', { success: false }], ['signed out', X.SIGNED_OUT], ['garbage', 'x'], ['no actions object', { success: true, signedIn: true, hasAssistant: true }]]) {
    const got = s(input);
    assert(got && got.answered === false && got.hasAssistant === false && sameJson(got.actions, {}), `${label}: want not answered, got ${show(got)}`);
  }
});

test('C2: CHECKED_ACTIONS names exactly the identification-tags action, and every checked key is a real action (ADR 0001 sub-decision 6)', async () => {
  const mod = await actionsModule();
  assert(sameJson(mod.CHECKED_ACTIONS, [ACTION]), `CHECKED_ACTIONS: want ${show([ACTION])}, got ${show(mod.CHECKED_ACTIONS)}`);
  const keys = mod.ASSISTANT_ACTIONS.map((a) => a.key);
  assert(mod.CHECKED_ACTIONS.every((k) => keys.includes(k)), 'every checked key is one of the ten actions');
});

test('C3: the two readings — with no answer a checked action is marked but not counted; done unmarks and uncounts it; pending marks and counts; unfinished marks only; placeholders always both (AC-5)', async () => {
  const mod = await actionsModule();
  const attention = mod.assistantAttention;
  const summarize = (await uiUtil()).summarizeAttention;
  const user = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
  const all = mod.ASSISTANT_ACTIONS.map((a) => a.key);
  const nine = all.filter((k) => k !== ACTION);
  const cases = [
    ['no answer (undefined)', undefined, all, 9],
    ['not answered (failed)', summarize(null), all, 9],
    ['checking (phase only)', { phase: 'checking', answered: false, actions: {} }, all, 9],
    ['done', summarize(X.DONE), nine, 9],
    ['pending', summarize(X.PENDING), all, 10],
    ['unfinished', summarize(X.UNFINISHED), all, 9],
  ];
  const wrong = [];
  for (const [label, att, wantMarked, wantAlert] of cases) {
    const got = att === undefined ? attention(user) : attention(user, att);
    const shaped = got && { hasAssistant: got.hasAssistant, needsAttention: got.needsAttention, count: got.count, alertCount: got.alertCount };
    const want = { hasAssistant: true, needsAttention: wantMarked, count: wantMarked.length, alertCount: wantAlert };
    if (!sameJson(shaped, want)) wrong.push(`${label}: want ${show(want)}, got ${show(shaped)}`);
  }
  for (const [label, who] of [['a visitor', null], ['a guest with no assistant', { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null }]]) {
    const got = attention(who, summarize(X.DONE));
    const want = { hasAssistant: false, needsAttention: [], count: 0, alertCount: 0 };
    const shaped = got && { hasAssistant: got.hasAssistant, needsAttention: got.needsAttention, count: got.count, alertCount: got.alertCount };
    if (!sameJson(shaped, want)) wrong.push(`${label}: want ${show(want)}, got ${show(shaped)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4: the picker waits for the attention answer — assistantPhase "checking" draws no pill after setup has had its turn; setup still comes first; the default is answered, so every old input is unchanged (ADR 0001 sub-decision 8)', async () => {
  const mod = await pickerModule();
  const base = { signedIn: true, setupPhase: 'answered', setupPendingCount: 0, assistantCount: 9, pathname: '/about' };
  const shape = (r) => r && { pill: r.pill, count: r.count };
  const NONE = { pill: null, count: 0 };
  assert(sameJson(shape(mod.pickTopBarPill({ ...base, assistantPhase: 'checking' })), NONE), `checking: want none, got ${show(mod.pickTopBarPill({ ...base, assistantPhase: 'checking' }))}`);
  assert(sameJson(shape(mod.pickTopBarPill({ ...base, setupPhase: 'failed', assistantPhase: 'checking' })), NONE), 'checking, setup failed: still none');
  assert(sameJson(shape(mod.pickTopBarPill({ ...base, setupPendingCount: 2, assistantPhase: 'checking' })), { pill: 'setup', count: 2 }), 'setup first, even while the attention answer is on its way');
  for (const phase of ['answered', 'failed', 'idle']) {
    assert(sameJson(shape(mod.pickTopBarPill({ ...base, assistantPhase: phase })), { pill: 'assistant', count: 9 }), `assistantPhase ${phase}: the Assistant pill with the count`);
  }
  assert(sameJson(shape(mod.pickTopBarPill(base)), { pill: 'assistant', count: 9 }), 'no assistantPhase given: as before');
  assert(sameJson(shape(mod.pickTopBarPill({ ...base, assistantCount: 0, assistantPhase: 'answered' })), NONE), 'count 0: none');
});

/* ───────────────────────── S — the server, by source ───────────────────────── */

test('S1: the route GET /api/assistant/attention is registered in src/api/index.js and documented in openapi.yaml (ADR 0001 sub-decision 9)', () => {
  // The raw source, not codeOnly(): src/api/index.js mounts globs like '/api/*', which the comment stripper would
  // read as the start of a block comment and swallow everything to the next '*/'.
  const index = safeRead(API_INDEX);
  assert(/app\.get\(\s*['"]\/api\/assistant\/attention['"]/.test(index), 'src/api/index.js must register app.get(\'/api/assistant/attention\', …)');
  const yaml = safeRead(OPENAPI);
  assert(/^\s*\/api\/assistant\/attention:\s*$/m.test(yaml), 'src/api/openapi.yaml must document /api/assistant/attention');
});

test('S2: the module never writes — no strfry import, no signing, no publish, no settings or key-store write — never reads a query parameter, and reads outside relays strictly (AC-2, AC-7)', () => {
  const src = codeOnly(safeRead(ATTENTION_MODULE));
  assert(src, 'src/api/assistant/attention.js does not exist');
  const wrong = [];
  for (const [re, what] of [
    [/strfry\s+import/, 'strfry import'], [/finalizeEvent|signEvent|getAssistantKeys\b|getOwnerAssistantKeys/, 'a signer or a key read'],
    [/publishToRelays|publishEverywhere|importToLocalRelay/, 'a publish helper'], [/updateOverrides|writeFileSync|storeRelayKeys/, 'a write'],
    [/req\.query/, 'req.query'], [/querySync/, 'querySync (non-strict; use readRelayEvents)'],
  ]) if (re.test(src)) wrong.push(`uses ${what}`);
  assert(/readRelayEvents/.test(src), 'reads outside relays with readRelayEvents, the strict reader');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S3: the module leaves src/api/setup/status.js as it is and reuses its strict pieces — scanLocalStrict and outsideOnly — instead of a fourth copy (ADR 0001 sub-decision 3)', () => {
  const src = codeOnly(safeRead(ATTENTION_MODULE));
  assert(/require\(\s*['"]\.\.\/setup\/status['"]\s*\)/.test(src), 'requires ../setup/status for scanLocalStrict / outsideOnly / RELAY_BUDGET_MS');
  const status = codeOnly(safeRead(SETUP_STATUS_MODULE));
  assert(!/attention|identification/i.test(status), 'src/api/setup/status.js is not edited for this story (a parallel book\'s module)');
});

test('S4: TAG_RELAY_CATEGORIES is [\'aTagFederationRelays\'] — the relays this instance reads tags from (AC-3)', () => {
  const mod = attentionModule();
  assert(sameJson(mod.TAG_RELAY_CATEGORIES, TAG_RELAY_CATEGORIES), `want ${show(TAG_RELAY_CATEGORIES)}, got ${show(mod.TAG_RELAY_CATEGORIES)}`);
});

test('S5: BIBLE §11/§14 and the OpenAPI document say what is true — no "two identification taggings", no single key\'s "canonical definitions", no "My Human" beside "My Tapestry Owner" as published, and the undecided pair named as parked (identification-tags-authorship #1 AC-6)', () => {
  const bible = safeRead(path.join(REPO, 'BIBLE.md'));
  const yaml = safeRead(OPENAPI);
  const wrong = [];
  for (const [label, text] of [['BIBLE.md', bible], ['openapi.yaml', yaml]]) {
    for (const re of [/two identification taggings/i, /the canonical definitions/i, /canonical tag definitions/i, /"My Tapestry Owner", "My Human"/, /My Tapestry Owner and My Human/, /my-tapestry-owner and my-human/]) {
      if (re.test(text)) wrong.push(`${label} still says ${re}`);
    }
    if (!/parked/i.test(text)) wrong.push(`${label} does not say the two undecided taggings are parked`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — the UI, by source (CI runs no browser) ───────────────────────── */

test('D1: the provider exists, exports AssistantAttentionProvider and useAssistantAttention, fetches /api/assistant/attention with no parameters, and re-checks on a published tagging (ADR 0001 sub-decision 7)', () => {
  const src = codeOnly(safeRead(PROVIDER));
  assert(src, `${rel(PROVIDER)} does not exist — ADR 0001 § Implementation notes 4 creates it`);
  const wrong = [];
  for (const [re, what] of [
    [/export\s+function\s+AssistantAttentionProvider\s*\(/, 'export function AssistantAttentionProvider'],
    [/export\s+function\s+useAssistantAttention\s*\(/, 'export function useAssistantAttention'],
    [/fetch\(\s*['"`]\/api\/assistant\/attention['"`]\s*\)/, "fetch('/api/assistant/attention') with no parameters"],
    [/\bonEventPublished\s*\(/, 'onEventPublished(…) — re-check after a tagging is published'],
    [/profile-tag-/, 'the tagging d prefix (only a tagging by the viewer or their assistant re-checks)'],
    [/\bsummarizeAttention\s*\(/, 'summarizeAttention(…)'],
    [/assistantPubkey/, 'user.assistantPubkey — fetch only for a viewer with an assistant, and again when it changes'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  assert(!/localStorage|sessionStorage/.test(src), 'stores nothing in the browser');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: App.jsx mounts AssistantAttentionProvider inside SetupStatusProvider, around the router (ADR 0001 § Implementation notes 4)', () => {
  const src = codeOnly(safeRead(APP));
  assert(/import\s*\{\s*AssistantAttentionProvider\s*\}\s*from\s*['"]\.\/context\/AssistantAttentionContext['"]/.test(src), 'imports { AssistantAttentionProvider } from ./context/AssistantAttentionContext');
  const m = src.match(/<SetupStatusProvider>\s*<AssistantAttentionProvider>\s*<RouterProvider[\s\S]*?<\/AssistantAttentionProvider>\s*<\/SetupStatusProvider>/);
  assert(m, 'the provider wraps <RouterProvider …/> directly inside <SetupStatusProvider>');
});

test('D3: the hub and the slot read the one answer — useAssistantAttention() handed to assistantAttention(user, …) — and the slot passes alertCount and assistantPhase to the picker (AC-5)', () => {
  const wrong = [];
  for (const [file, label] of [[HUB_PAGE, 'the hub'], [SLOT, 'the slot']]) {
    const src = codeOnly(safeRead(file));
    if (!/\buseAssistantAttention\s*\(/.test(src)) wrong.push(`${label}: no useAssistantAttention()`);
    if (!/\bassistantAttention\s*\(\s*user\s*,/.test(src)) wrong.push(`${label}: assistantAttention(user, …) must take the answer`);
  }
  const slot = codeOnly(safeRead(SLOT));
  if (!/assistantCount:\s*alertCount/.test(slot)) wrong.push('the slot passes the pill reading: assistantCount: alertCount');
  if (!/assistantPhase:/.test(slot)) wrong.push('the slot passes assistantPhase to the picker');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D4: actions.js keeps its one import, and the Vite config aliases @tapestry/identification-tags to the library and includes it in the CommonJS transform (ADR 0001 sub-decision 1)', () => {
  const actions = codeOnly(safeRead(ACTIONS_MOD));
  const imports = [...actions.matchAll(/^\s*import\b[^;]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert(sameJson(imports, ['../../config/avatarMenuLinks.js']), `actions.js: expected one import, got ${show(imports)}`);
  const vite = safeRead(VITE);
  assert(/['"]@tapestry\/identification-tags['"]\s*:/.test(vite), 'ui/vite.config.js aliases @tapestry/identification-tags');
  assert(/src\\\/lib\\\/identification-tags/.test(vite), 'ui/vite.config.js includes /src\\/lib\\/identification-tags/ in build.commonjsOptions.include');
});

/* ───────────────────────── R — regressions that pass before and after ───────────────────────── */

test('R1: the publisher still composes the d-tag the library and the server look taggings up by (ADR 0001 sub-decision 3)', () => {
  const src = safeRead(PUBLISHER);
  assert(src.includes('`profile-tag-${tag.slug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`'),
    'ui/src/utils/publishProfileTag.js must still build d as profile-tag-<slug>-<target[0:8]>-<signer[0:8]>; if this rule changes, the lookup (and the library\'s taggingDTag) must change with it');
});

test('R2: assistantAttention(user) with no answer still marks every action for a viewer with an assistant and none for anyone else (assistant-management #1 D7 holds)', async () => {
  const mod = await actionsModule();
  const all = mod.ASSISTANT_ACTIONS.map((a) => a.key);
  const withOne = mod.assistantAttention({ pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) });
  assert(sameJson({ hasAssistant: withOne.hasAssistant, needsAttention: withOne.needsAttention, count: withOne.count }, { hasAssistant: true, needsAttention: all, count: all.length }), `got ${show(withOne)}`);
  const without = mod.assistantAttention(null);
  assert(sameJson({ hasAssistant: without.hasAssistant, needsAttention: without.needsAttention, count: without.count }, { hasAssistant: false, needsAttention: [], count: 0 }), `got ${show(without)}`);
});

/* ───────────────────────── H — live ───────────────────────── */

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  } finally { clearTimeout(timer); }
}
async function stackAvailable() {
  if (typeof fetch !== 'function') return false;
  try { const r = await getJson(`${HOST_BASE}/api/assistant/pubkey`); return r.status === 200; } catch { return false; }
}

test('H1: live — an anonymous GET /api/assistant/attention answers 200 { success: true, signedIn: false }', async () => {
  if (!(await stackAvailable())) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  let got;
  try {
    got = await getJson(`${HOST_BASE}/api/assistant/attention`);
  } catch (err) {
    throw new Error(`${err.message} — the route is missing on ${HOST_BASE}: not implemented, or the server there predates it (restart the backend after implementing).`);
  }
  assert(got.status === 200 && sameJson(got.body, X.SIGNED_OUT),
    `expected 200 ${show(X.SIGNED_OUT)} for a request with no session; got ${got.status} ${show(got.body)}`);
  return undefined;
});

async function run() {
  console.log(`${NL}=== assistant-attention (assistant-identification-tags #1) ===`);
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
  console.log(`assistant-attention: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('assistant-attention: !! LIVE COVERAGE DID NOT RUN — stack unreachable (or no fetch on this Node).');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' });
      fail++;
    }
  }
  console.log(`${NL}assistant-attention: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
