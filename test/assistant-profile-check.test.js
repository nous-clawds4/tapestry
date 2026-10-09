'use strict';
/**
 * assistant-profile-checklist #1: the profile check — which items of your Assistant's profile need attention — and the
 * hub's Done mark.
 *
 * Story: engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md
 * ADR:   engineering-team/decisions/assistant-profile-checklist/0001-the-profile-check-joins-the-one-attention-answer.md
 * Plan:  engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.test-plan.md
 * Browser half: tests/brainstorm/assistant-profile-check.spec.js (what a viewer SEES on the hub and in the pill).
 * Expected words and shapes: test/helpers/profileChecklistFixtures.js.
 *
 * Classes:
 *   L — the shared library src/lib/assistant-profile-items (pure CommonJS): the seven items, the content fields, the
 *       composite file-name pattern.                                                                         [AC-1]
 *   U — checkProfile in src/api/assistant/profileChecklist.js, driven through the dependencies ADR 0001 names
 *       (describeInstance, resolveAssistantProfileState, scanLocalStrict, lookupNip05, readRelay,
 *       getConfiguredPublishRelays, isLocalOnly, hasStoredAvatar, getConfigFromFile). Stack-free.       [AC-2 … AC-5]
 *   A — the attention handler with the profile check injected: the profile joins the one answer, a failed profile
 *       check does not take Identification Tags with it.                                                [AC-2, AC-7]
 *   F — hasStoredAvatar on a temporary directory.                                                             [AC-4]
 *   C — the two readings and the new `done` field of assistantAttention (ESM, loaded in Node).                [AC-6]
 *   D — source sentinels on the UI files this runner cannot execute (JSX, CSS, Vite config).                  [AC-6]
 *   S — source sentinels on the server: read-only, no request parameter, documented.                    [AC-2, AC-7]
 *
 * Every test FAILS against the current code: src/lib/assistant-profile-items and src/api/assistant/profileChecklist.js do
 * not exist, the attention answer has no `profile` action, CHECKED_ACTIONS is ['identification-tags'],
 * assistantAttention answers no `done`, and the hub card has no done state.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const X = require('./helpers/profileChecklistFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/assistant-profile-items/index.js');
const CHECK_MODULE = path.join(REPO, 'src/api/assistant/profileChecklist.js');
const ATTENTION_MODULE = path.join(REPO, 'src/api/assistant/attention.js');
const AVATAR_MODULE = path.join(REPO, 'src/api/assistant/avatar.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const BIBLE = path.join(REPO, 'BIBLE.md');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const UI_UTIL = path.join(REPO, 'ui/src/utils/assistantAttention.js');
const HUB_PAGE = path.join(REPO, 'ui/src/pages/assistant/Index.jsx');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const VITE = path.join(REPO, 'ui/vite.config.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const STRANGER = 'b3'.repeat(32);

// Fixture relays: three outside, plus this instance's own (which the visibility check must never read).
const R1 = 'wss://r1.example';
const R2 = 'wss://r2.example';
const R3 = 'wss://r3.example';
const OWN_RELAY = 'wss://tapestry.example/relay';
const PUBLIC = X.PUBLIC_INSTANCE;
const COMPOSITE_FILE = `ta-avatar-${'ab'.repeat(16)}.png`;
const COMPOSITE_URL = `${PUBLIC.website}/generated/${COMPOSITE_FILE}`;
const NIP05 = `alice-tapestry-assistant-a2a2a2@${PUBLIC.domain}`;

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
async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

/* ───────────────────────── fixtures: events ───────────────────────── */

let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');

/** The Assistant's kind 0. `content` is merged over a done profile; `tags` defaults to this instance's client tag. */
function kind0(content = {}, { tags, createdAt = 2000, pubkey = ASSISTANT } = {}) {
  idSeq += 1;
  const body = {
    name: "Alice's Tapestry Assistant",
    display_name: "Alice's Tapestry Assistant",
    about: 'I am the Tapestry Assistant for Alice.',
    picture: COMPOSITE_URL,
    website: PUBLIC.website,
    nip05: NIP05,
    ...content,
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  return {
    id: hexId(idSeq), pubkey, kind: 0, created_at: createdAt,
    tags: tags === undefined ? [['client', PUBLIC.domain]] : tags,
    content: JSON.stringify(body), sig: '0'.repeat(128),
  };
}

/* ───────────────────────── the modules under test ───────────────────────── */

function fresh(file, what) {
  if (!fs.existsSync(file)) throw new Error(`${rel(file)} does not exist. ${what}`);
  delete require.cache[require.resolve(file)];
  return require(file);
}
const libModule = () => fresh(LIB, 'ADR 0001 sub-decision 1 creates it: the pure, dependency-free list of the seven profile items both the server and the UI load (PROFILE_ITEMS, COUNTED_PROFILE_ITEM_KEYS, PROFILE_CONTENT_FIELDS, COMPOSITE_AVATAR_FILE_RE).');
const checkModule = () => fresh(CHECK_MODULE, 'ADR 0001 § Implementation notes 2 creates it: checkProfile({ assistantPubkey }, deps), evaluateProfileItems, readVisibility, PROFILE_RELAY_BUDGET_MS.');
const attentionModule = () => fresh(ATTENTION_MODULE, 'It answers GET /api/assistant/attention (assistant-identification-tags ADR 0001).');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0001 § Implementation notes).`);
  return mod[name];
}

/**
 * The injected dependencies of checkProfile, under the names ADR 0001 gives them. Every one RECORDS its calls.
 *   instance   — what describeInstance answers (default the public fixture instance).
 *   profile    — the Assistant's kind 0 the resolver finds: an event, null (no profile anywhere), or 'reject'.
 *   nip05      — { [address]: { outcome, pubkey } } what lookupNip05 answers; an unlisted address is unreachable.
 *   relays     — { [url]: events | 'unreachable' | 'hang' | 'throw' }; an unlisted relay is unreachable.
 *   configured — what getConfiguredPublishRelays answers (default [R1, R2, R3, OWN_RELAY]).
 *   localOnly  — what isLocalOnly answers (default false).
 *   stored     — the composite file names this instance holds (default [COMPOSITE_FILE]).
 *   resolver   — false: do NOT inject resolveAssistantProfileState (the real one runs on the injected scanLocalStrict).
 *   scan       — what the injected scanLocalStrict answers: an array of events, or 'reject'.
 */
function fakes(opts = {}) {
  const calls = { describeInstance: 0, resolve: [], scanLocalStrict: [], lookupNip05: [], readRelay: [], getConfiguredPublishRelays: 0, isLocalOnly: 0, hasStoredAvatar: [] };
  const relays = opts.relays || { [R1]: 'own-profile', [R2]: 'own-profile', [R3]: [] };
  const deps = {
    describeInstance: () => { calls.describeInstance += 1; return { ...(opts.instance || PUBLIC) }; },
    lookupNip05: async (address) => {
      calls.lookupNip05.push(address);
      const answers = opts.nip05 || { [NIP05]: { outcome: 'answered', pubkey: ASSISTANT } };
      return answers[address] || { outcome: 'unreachable', pubkey: null };
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url, filter });
      let answer = relays[url];
      if (answer === 'hang') return new Promise(() => {});
      if (answer === 'throw') throw new Error('fixture: the relay read threw');
      if (answer === 'own-profile') answer = [opts.profile && opts.profile !== 'reject' ? opts.profile : kind0()];
      if (!Array.isArray(answer)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      return { status: 'ok', events: answer, error: null };
    },
    getConfiguredPublishRelays: () => { calls.getConfiguredPublishRelays += 1; return (opts.configured || [R1, R2, R3, OWN_RELAY]).slice(); },
    isLocalOnly: () => { calls.isLocalOnly += 1; return opts.localOnly === true; },
    hasStoredAvatar: (file) => { calls.hasStoredAvatar.push(file); return (opts.stored || [COMPOSITE_FILE]).includes(file); },
    getConfigFromFile: (key, dflt) => ({ BRAINSTORM_RELAY_URL: OWN_RELAY, STRFRY_DOMAIN: PUBLIC.domain }[key] ?? dflt),
    scanLocalStrict: async (filter) => {
      calls.scanLocalStrict.push(filter);
      if (opts.scan === 'reject') throw new Error('fixture: strfry scan failed');
      return Array.isArray(opts.scan) ? opts.scan : [];
    },
  };
  if (opts.resolver !== false) {
    deps.resolveAssistantProfileState = async (options) => {
      calls.resolve.push(options);
      const p = opts.profile === undefined ? kind0() : opts.profile;
      if (p === 'reject') throw new Error('fixture: the local relay could not be read');
      if (!p) return { hasProfile: false, profile: null, event: null, source: null };
      return { hasProfile: true, profile: JSON.parse(p.content), event: p, source: 'local' };
    };
  }
  return { deps, calls };
}

async function check(opts = {}) {
  const run = need(checkModule(), 'checkProfile', 'src/api/assistant/profileChecklist.js');
  const { deps, calls } = fakes(opts);
  const action = await run({ assistantPubkey: ASSISTANT }, deps);
  const items = action && Array.isArray(action.items) ? action.items : [];
  const item = (key) => items.find((r) => r && r.key === key) || {};
  return { action, items, item, calls };
}
const flags = (a) => a && { finished: a.finished, done: a.done, pending: a.pending };
const state = (r) => r && { finished: r.finished, done: r.done, reason: r.reason };

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __loadError: err }; }
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  const mod = await loadEsm(absPath);
  assert(!mod.__loadError, `${rel(absPath)} must load in Node as ESM: ${mod.__loadError && mod.__loadError.message}`);
  return mod;
}
const actionsModule = () => esm(ACTIONS_MOD, 'It holds assistantAttention and CHECKED_ACTIONS.');
const uiUtil = () => esm(UI_UTIL, 'It holds summarizeAttention.');

/* ───────────────────────── L — the shared library ───────────────────────── */

test('L1: the library exists, is CommonJS, and requires nothing — both the server and the UI (through a Vite alias) can load it (ADR 0001 sub-decision 1)', () => {
  const mod = libModule();
  const src = codeOnly(safeRead(LIB));
  assert(!/\brequire\s*\(/.test(src) && !/^\s*import\b/m.test(src), 'src/lib/assistant-profile-items/index.js must be dependency-free: no require() and no import');
  for (const name of ['PROFILE_ITEMS', 'COUNTED_PROFILE_ITEM_KEYS', 'PROFILE_CONTENT_FIELDS', 'COMPOSITE_AVATAR_FILE_RE']) {
    assert(mod[name] !== undefined, `the library must export ${name}`);
  }
});

test('L2: the seven items, in order — avatar, banner, nip05, website, name-and-about, client-tag, visible — the banner listed and not counted; COUNTED_PROFILE_ITEM_KEYS is the six that count (AC-1)', () => {
  const mod = libModule();
  const got = (mod.PROFILE_ITEMS || []).map((i) => ({ key: i.key, counts: i.counts }));
  assert(sameJson(got, X.ITEMS), `PROFILE_ITEMS: want ${show(X.ITEMS)}, got ${show(got)}`);
  assert(sameJson(mod.COUNTED_PROFILE_ITEM_KEYS, X.COUNTED), `COUNTED_PROFILE_ITEM_KEYS: want ${show(X.COUNTED)}, got ${show(mod.COUNTED_PROFILE_ITEM_KEYS)}`);
});

test('L3: PROFILE_CONTENT_FIELDS is the seven kind-0 fields the one writer keeps, and matches src/api/assistant/index.js PROFILE_FIELDS (ADR 0001 sub-decision 1)', () => {
  const mod = libModule();
  assert(sameJson(mod.PROFILE_CONTENT_FIELDS, X.PROFILE_CONTENT_FIELDS), `want ${show(X.PROFILE_CONTENT_FIELDS)}, got ${show(mod.PROFILE_CONTENT_FIELDS)}`);
  const writer = safeRead(path.join(REPO, 'src/api/assistant/index.js')).match(/const PROFILE_FIELDS = (\[[^\]]*\])/);
  assert(writer && sameJson(JSON.parse(writer[1].replace(/'/g, '"')), mod.PROFILE_CONTENT_FIELDS), 'the one writer\'s PROFILE_FIELDS and the library\'s PROFILE_CONTENT_FIELDS must stay equal');
});

test('L4: COMPOSITE_AVATAR_FILE_RE accepts today\'s 8-hex and ADR 0003\'s 32-hex composite names (8–64 hex), and nothing else — no path, no other extension, no upper case, no other prefix (ADR 0001 sub-decision 1)', () => {
  const re = libModule().COMPOSITE_AVATAR_FILE_RE;
  assert(re instanceof RegExp, 'COMPOSITE_AVATAR_FILE_RE must be a RegExp');
  const yes = ['ta-avatar-0123abcd.png', `ta-avatar-${'ab'.repeat(16)}.png`, `ta-avatar-${'f'.repeat(64)}.png`];
  const no = ['ta-avatar-0123abc.png', `ta-avatar-${'f'.repeat(65)}.png`, 'ta-avatar-0123ABCD.png', 'ta-avatar-0123abcd.jpg',
    '../ta-avatar-0123abcd.png', 'generated/ta-avatar-0123abcd.png', 'x-ta-avatar-0123abcd.png', 'ta-avatar-0123abcd.png/x', 'ta-avatar-.png'];
  const wrong = [...yes.filter((f) => !re.test(f)).map((f) => `should accept ${f}`), ...no.filter((f) => re.test(f)).map((f) => `should refuse ${f}`)];
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — checkProfile ───────────────────────── */

test('U1: a complete profile — every counted item done, the banner "not-checked" and not counted, the rows in the seven items\' order, the action finished, done and not pending (AC-2, AC-4)', async () => {
  const { action, items, item } = await check();
  assert(action && typeof action === 'object', `checkProfile must answer an action object; got ${show(action)}`);
  assert(sameJson(items.map((r) => r.key), X.ITEMS.map((i) => i.key)), `rows in order: want ${show(X.ITEMS.map((i) => i.key))}, got ${show(items.map((r) => r.key))}`);
  const wrong = [];
  for (const key of X.COUNTED) {
    if (!sameJson(state(item(key)), { finished: true, done: true, reason: null })) wrong.push(`${key}: want done, got ${show(state(item(key)))}`);
    if (item(key).counts !== true) wrong.push(`${key}: counts must be true`);
  }
  if (!sameJson({ ...state(item('banner')), counts: item('banner').counts }, { finished: false, done: false, reason: 'not-checked', counts: false })) wrong.push(`banner: want not-checked and not counted, got ${show(item('banner'))}`);
  if (!sameJson(flags(action), { finished: true, done: true, pending: false })) wrong.push(`action: want finished, done, not pending; got ${show(flags(action))}`);
  if (action.hasProfile !== true) wrong.push(`hasProfile: want true, got ${show(action.hasProfile)}`);
  if (!sameJson(action.instance, X.instanceBlock(PUBLIC))) wrong.push(`instance: want ${show(X.instanceBlock(PUBLIC))}, got ${show(action.instance)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U2: the avatar — done only for a composite at this instance\'s /generated/ whose file this instance still holds; the instance\'s branded image and the reference copy are the standard image; anything else is not personalized; none is no-picture (AC-4)', async () => {
  const cases = [
    ['the composite, stored', COMPOSITE_URL, {}, { finished: true, done: true, reason: null }],
    ['an 8-hex composite, stored', `${PUBLIC.website}/generated/ta-avatar-0123abcd.png`, { stored: ['ta-avatar-0123abcd.png'] }, { finished: true, done: true, reason: null }],
    ['the composite, file gone', COMPOSITE_URL, { stored: [] }, { finished: true, done: false, reason: 'missing-file' }],
    ['this instance\'s branded image', PUBLIC.avatarUrl, {}, { finished: true, done: false, reason: 'standard-image' }],
    ['the reference deployment\'s branded image', X.REFERENCE_TA_AVATAR_URL, {}, { finished: true, done: false, reason: 'standard-image' }],
    ['a picture elsewhere', 'https://img.example/alice.png', {}, { finished: true, done: false, reason: 'not-personalized' }],
    ['a composite on another instance', `https://other.example/generated/${COMPOSITE_FILE}`, { stored: [COMPOSITE_FILE] }, { finished: true, done: false, reason: 'not-personalized' }],
    ['the composite with a query', `${COMPOSITE_URL}?v=2`, {}, { finished: true, done: false, reason: 'not-personalized' }],
    ['http, not https', COMPOSITE_URL.replace('https://', 'http://'), {}, { finished: true, done: false, reason: 'not-personalized' }],
    ['a traversal', `${PUBLIC.website}/generated/../ta-avatar-0123abcd.png`, { stored: ['ta-avatar-0123abcd.png'] }, { finished: true, done: false, reason: 'not-personalized' }],
    ['empty', '', {}, { finished: true, done: false, reason: 'no-picture' }],
    ['absent', undefined, {}, { finished: true, done: false, reason: 'no-picture' }],
  ];
  const wrong = [];
  for (const [label, picture, extra, want] of cases) {
    const { item } = await check({ profile: kind0({ picture }), ...extra });
    if (!sameJson(state(item('avatar')), want)) wrong.push(`${label}: want ${show(want)}, got ${show(state(item('avatar')))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U3: the avatar check only ever asks hasStoredAvatar about a bare composite file name taken from the Assistant\'s own picture — never a path, never another name (AC-4; ADR 0001 sub-decision 5)', async () => {
  const asked = [];
  for (const picture of [COMPOSITE_URL, 'https://img.example/x.png', `${PUBLIC.website}/generated/../../etc/passwd`, `${PUBLIC.website}/generated/ta-avatar-0123abcd.png/x`, PUBLIC.avatarUrl]) {
    const { calls } = await check({ profile: kind0({ picture }) });
    asked.push(...calls.hasStoredAvatar);
  }
  const re = /^ta-avatar-[0-9a-f]{8,64}\.png$/;
  const bad = asked.filter((f) => !re.test(String(f)));
  assert(bad.length === 0, `hasStoredAvatar was asked about ${show(bad)}`);
  assert(asked.includes(COMPOSITE_FILE), `the composite's file name must be checked; asked ${show(asked)}`);
});

test('U4: the NIP-05 — done when it is on this instance\'s domain (letter case aside) and the domain lists it for the Assistant; none, another domain (no lookup), not listed, and unreachable (unfinished) otherwise (AC-4, AC-5)', async () => {
  const OTHER_PK = { outcome: 'answered', pubkey: STRANGER };
  const cases = [
    ['listed', NIP05, { [NIP05]: { outcome: 'answered', pubkey: ASSISTANT } }, { finished: true, done: true, reason: null }, true],
    ['listed, the domain in capitals', NIP05.replace(PUBLIC.domain, PUBLIC.domain.toUpperCase()), null, { finished: true, done: true, reason: null }, true],
    ['listed for someone else', NIP05, { [NIP05]: OTHER_PK }, { finished: true, done: false, reason: 'not-listed' }, true],
    ['the domain lists no one for it', NIP05, { [NIP05]: { outcome: 'answered', pubkey: null } }, { finished: true, done: false, reason: 'not-listed' }, true],
    ['the domain did not answer', NIP05, {}, { finished: false, done: false, reason: 'unreachable' }, true],
    ['on another domain', 'alice@elsewhere.example', { 'alice@elsewhere.example': { outcome: 'answered', pubkey: ASSISTANT } }, { finished: true, done: false, reason: 'other-domain' }, false],
    ['not an identifier', 'not a nip05', {}, { finished: true, done: false, reason: 'other-domain' }, false],
    ['none', '', {}, { finished: true, done: false, reason: 'none' }, false],
    ['absent', undefined, {}, { finished: true, done: false, reason: 'none' }, false],
  ];
  const wrong = [];
  for (const [label, nip05, answers, want, looksUp] of cases) {
    const lookups = answers === null ? { [nip05]: { outcome: 'answered', pubkey: ASSISTANT } } : answers;
    const { item, calls } = await check({ profile: kind0({ nip05 }), nip05: lookups });
    if (!sameJson(state(item('nip05')), want)) wrong.push(`${label}: want ${show(want)}, got ${show(state(item('nip05')))}`);
    if (looksUp && !calls.lookupNip05.includes(nip05)) wrong.push(`${label}: must look ${nip05} up the way a client would (lookupNip05); asked ${show(calls.lookupNip05)}`);
    if (!looksUp && calls.lookupNip05.length > 0) wrong.push(`${label}: must not fetch anything; asked ${show(calls.lookupNip05)}`);
  }
  const { item } = await check({ profile: kind0({ nip05: NIP05 }) });
  if (item('nip05').address !== NIP05) wrong.push(`the row carries the published address; got ${show(item('nip05').address)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U5: the website — done when it is https://<this instance> (a trailing slash and the host\'s letter case aside); anything else is "other"; none is "none" (AC-4)', async () => {
  const cases = [
    [PUBLIC.website, true], [`${PUBLIC.website}/`, true], [PUBLIC.website.replace(PUBLIC.domain, PUBLIC.domain.toUpperCase()), true],
    [PUBLIC.website.replace('https://', 'http://'), false], [`${PUBLIC.website}/about`, false], [`${PUBLIC.website}/?x=1`, false],
    [`${PUBLIC.website}:8443`, false], [PUBLIC.domain, false], ['https://alice.example', false], [`https://user@${PUBLIC.domain}`, false],
  ];
  const wrong = [];
  for (const [website, ok] of cases) {
    const { item } = await check({ profile: kind0({ website }) });
    const want = ok ? { finished: true, done: true, reason: null } : { finished: true, done: false, reason: 'other' };
    if (!sameJson(state(item('website')), want)) wrong.push(`${show(website)}: want ${show(want)}, got ${show(state(item('website')))}`);
  }
  for (const website of ['', undefined, '   ']) {
    const { item } = await check({ profile: kind0({ website }) });
    if (!sameJson(state(item('website')), { finished: true, done: false, reason: 'none' })) wrong.push(`${show(website)}: want none, got ${show(state(item('website')))}`);
  }
  const { item } = await check({ profile: kind0({ website: 'https://alice.example' }) });
  if (item('website').value !== 'https://alice.example' || item('website').expected !== PUBLIC.website) wrong.push(`the row carries value and expected; got ${show(item('website'))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U6: name and About — done with a name (or a display name) and an About text, each non-empty once trimmed; the reason names what is missing (AC-4)', async () => {
  const cases = [
    [{ name: 'A', about: 'B' }, null], [{ name: '', display_name: 'A', about: 'B' }, null],
    [{ name: '  ', display_name: undefined, about: 'B' }, 'no-name'], [{ name: 'A', about: ' ' }, 'no-about'],
    [{ name: undefined, display_name: undefined, about: undefined }, 'no-name-no-about'], [{ name: 42, display_name: '', about: 'B' }, 'no-name'],
  ];
  const wrong = [];
  for (const [content, reason] of cases) {
    const { item } = await check({ profile: kind0(content) });
    const want = reason ? { finished: true, done: false, reason } : { finished: true, done: true, reason: null };
    if (!sameJson(state(item('name-and-about')), want)) wrong.push(`${show(content)}: want ${show(want)}, got ${show(state(item('name-and-about')))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U7: the client tag — done when the event carries ["client", <this instance\'s domain>] (letter case aside); none otherwise (AC-4)', async () => {
  const cases = [
    [[['client', PUBLIC.domain]], true], [[['client', PUBLIC.domain.toUpperCase()]], true], [[['t', 'x'], ['client', PUBLIC.domain, 'extra']], true],
    [[], false], [[['client', 'other.example']], false], [[['clients', PUBLIC.domain]], false],
  ];
  const wrong = [];
  for (const [tags, ok] of cases) {
    const { item } = await check({ profile: kind0({}, { tags }) });
    const want = ok ? { finished: true, done: true, reason: null } : { finished: true, done: false, reason: 'none' };
    if (!sameJson(state(item('client-tag')), want)) wrong.push(`${show(tags)}: want ${show(want)}, got ${show(state(item('client-tag')))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U8: visible — done when an outside publish relay holds the Assistant\'s profile at least as new as this one, with relaysTotal / relaysAnswered / relaysHolding; this instance\'s own relay is never read (AC-4; ADR 0001 sub-decision 5)', async () => {
  const profile = kind0({}, { createdAt: 2000 });
  const older = kind0({}, { createdAt: 1999 });
  const newer = kind0({}, { createdAt: 2001 });
  const strangers = kind0({}, { createdAt: 3000, pubkey: STRANGER });
  const { item, calls } = await check({ profile, relays: { [R1]: [profile], [R2]: [newer], [R3]: [older, strangers] } });
  const v = item('visible');
  const wrong = [];
  if (!sameJson(state(v), { finished: true, done: true, reason: null })) wrong.push(`state: want done, got ${show(state(v))}`);
  if (!sameJson({ t: v.relaysTotal, a: v.relaysAnswered, h: v.relaysHolding }, { t: 3, a: 3, h: 2 })) wrong.push(`counts: want total 3 / answered 3 / holding 2 (an older copy and another author do not count), got ${show({ t: v.relaysTotal, a: v.relaysAnswered, h: v.relaysHolding })}`);
  const read = calls.readRelay.map((c) => c.url);
  if (read.includes(OWN_RELAY)) wrong.push('this instance\'s own relay must not be read');
  if (!sameJson([...read].sort(), [R1, R2, R3].sort())) wrong.push(`each outside relay read once; read ${show(read)}`);
  const f = calls.readRelay[0] && calls.readRelay[0].filter;
  if (!f || !sameJson(f.kinds, [0]) || !sameJson((f.authors || []).map((a) => a.toLowerCase()), [ASSISTANT])) wrong.push(`the filter is { kinds: [0], authors: [<the Assistant>] }; got ${show(f)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U9: visible — only-here when the relays answered and none holds it; local-only-mode and no-relays read nothing; unreachable (unfinished) when no relay answered (AC-4, AC-5)', async () => {
  const profile = kind0({}, { createdAt: 2000 });
  const wrong = [];
  const onlyHere = await check({ profile, relays: { [R1]: [], [R2]: [kind0({}, { createdAt: 10 })], [R3]: 'unreachable' } });
  if (!sameJson(state(onlyHere.item('visible')), { finished: true, done: false, reason: 'only-here' })) wrong.push(`only-here: got ${show(state(onlyHere.item('visible')))}`);
  if (onlyHere.item('visible').relaysAnswered !== 2) wrong.push(`only-here: relaysAnswered want 2, got ${show(onlyHere.item('visible').relaysAnswered)}`);
  const localOnly = await check({ profile, localOnly: true });
  if (!sameJson(state(localOnly.item('visible')), { finished: true, done: false, reason: 'local-only-mode' })) wrong.push(`local-only-mode: got ${show(state(localOnly.item('visible')))}`);
  if (localOnly.calls.readRelay.length > 0) wrong.push('local-only-mode reads no relay');
  const noRelays = await check({ profile, configured: [OWN_RELAY, 'ws://localhost:7777'] });
  if (!sameJson(state(noRelays.item('visible')), { finished: true, done: false, reason: 'no-relays' })) wrong.push(`no-relays (only this instance's own relays configured): got ${show(state(noRelays.item('visible')))}`);
  if (noRelays.calls.readRelay.length > 0) wrong.push('no-relays reads no relay');
  const none = await check({ profile, relays: { [R1]: 'unreachable', [R2]: 'throw', [R3]: 'unreachable' } });
  if (!sameJson(state(none.item('visible')), { finished: false, done: false, reason: 'unreachable' })) wrong.push(`unreachable: got ${show(state(none.item('visible')))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U10: a relay that never answers costs only its own answer: the check comes back within PROFILE_RELAY_BUDGET_MS (4 s) plus a margin, and PROFILE_RELAY_BUDGET_MS is 4000 (ADR 0001 sub-decision 5)', async () => {
  const mod = checkModule();
  assert(mod.PROFILE_RELAY_BUDGET_MS === 4000, `PROFILE_RELAY_BUDGET_MS: want 4000, got ${show(mod.PROFILE_RELAY_BUDGET_MS)}`);
  const profile = kind0({}, { createdAt: 2000 });
  const got = await within(check({ profile, relays: { [R1]: 'hang', [R2]: [profile], [R3]: 'hang' } }), 4000 + 2000);
  assert(got !== 'HUNG', 'a hanging relay hung the check');
  const v = got.item('visible');
  assert(sameJson(state(v), { finished: true, done: true, reason: null }) && v.relaysAnswered === 1 && v.relaysHolding === 1, `one relay answered with the profile: want done, answered 1, holding 1; got ${show(v)}`);
});

test('U11: no profile anywhere — every counted item needs attention with reason no-profile, finished; the banner is still not checked; hasProfile false; nothing fetched (AC-3)', async () => {
  const { action, item, calls } = await check({ profile: null });
  const wrong = [];
  for (const key of X.COUNTED) {
    if (!sameJson(state(item(key)), { finished: true, done: false, reason: 'no-profile' })) wrong.push(`${key}: want no-profile, got ${show(state(item(key)))}`);
  }
  if (item('banner').reason !== 'not-checked') wrong.push(`banner: got ${show(item('banner'))}`);
  if (!sameJson(flags(action), { finished: true, done: false, pending: true }) || action.hasProfile !== false) wrong.push(`action: want finished, not done, pending, hasProfile false; got ${show({ ...flags(action), hasProfile: action && action.hasProfile })}`);
  if (calls.lookupNip05.length || calls.readRelay.length || calls.hasStoredAvatar.length) wrong.push(`nothing to fetch without a profile; got ${show({ lookupNip05: calls.lookupNip05, readRelay: calls.readRelay.length, hasStoredAvatar: calls.hasStoredAvatar })}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U12: an instance with no public web address — the avatar, NIP-05, website and client tag need attention with reason no-public-address (no lookup, no file check); name and About and visibility are checked as usual (AC-4, settled at approval)', async () => {
  const profile = kind0({ picture: X.REFERENCE_TA_AVATAR_URL, website: '', nip05: undefined }, { tags: [] });
  const { action, item, calls } = await check({ instance: X.DEV_INSTANCE, profile, configured: [R1], relays: { [R1]: [profile] } });
  const wrong = [];
  for (const key of ['avatar', 'nip05', 'website', 'client-tag']) {
    if (!sameJson(state(item(key)), { finished: true, done: false, reason: 'no-public-address' })) wrong.push(`${key}: want no-public-address, got ${show(state(item(key)))}`);
  }
  for (const key of ['name-and-about', 'visible']) {
    if (!sameJson(state(item(key)), { finished: true, done: true, reason: null })) wrong.push(`${key}: want done, got ${show(state(item(key)))}`);
  }
  if (calls.lookupNip05.length || calls.hasStoredAvatar.length) wrong.push(`no NIP-05 lookup and no file check on a dev box; got ${show({ lookupNip05: calls.lookupNip05, hasStoredAvatar: calls.hasStoredAvatar })}`);
  if (!sameJson(flags(action), { finished: true, done: false, pending: true })) wrong.push(`action: want pending; got ${show(flags(action))}`);
  if (!sameJson(action.instance, X.instanceBlock(X.DEV_INSTANCE))) wrong.push(`instance: got ${show(action.instance)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U13: the profile could not be read (the resolver rejects) — every counted item unfinished with reason profile-unreadable; the action unfinished and not pending (ADR 0001 sub-decision 2)', async () => {
  const { action, item } = await check({ profile: 'reject' });
  const wrong = [];
  for (const key of X.COUNTED) {
    if (!sameJson(state(item(key)), { finished: false, done: false, reason: 'profile-unreadable' })) wrong.push(`${key}: got ${show(state(item(key)))}`);
  }
  if (!sameJson(flags(action), { finished: false, done: false, pending: false })) wrong.push(`action: got ${show(flags(action))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U14: the profile is found the way every setup surface finds it — the resolver asked for this Assistant with the relay fallback allowed — and a failed local scan is not read as "no profile": with the real resolver, a rejecting scanLocalStrict makes the items profile-unreadable, and a local kind 0 is checked without any relay read for the profile (ADR 0001 sub-decision 2)', async () => {
  const wrong = [];
  const asked = await check();
  const o = asked.calls.resolve[0] || {};
  if (o.assistantPubkey !== ASSISTANT || o.allowRelayFallback !== true) wrong.push(`resolver options: want assistantPubkey and allowRelayFallback: true; got ${show({ assistantPubkey: o.assistantPubkey, allowRelayFallback: o.allowRelayFallback })}`);
  const broken = await check({ resolver: false, scan: 'reject' });
  if (broken.item('avatar').reason !== 'profile-unreadable' || broken.action.finished !== false) wrong.push(`a failed local scan: want profile-unreadable; got ${show(state(broken.item('avatar')))}`);
  const older = kind0({ website: 'https://old.example' }, { createdAt: 1000 });
  const newest = kind0({}, { createdAt: 2000 });
  const local = await check({ resolver: false, scan: [older, newest], relays: { [R1]: [newest], [R2]: [], [R3]: [] } });
  if (local.item('website').reason !== null || local.action.hasProfile !== true) wrong.push(`the newest local kind 0 is the profile; got website ${show(state(local.item('website')))}`);
  if (local.calls.scanLocalStrict.length === 0) wrong.push('the injected scanLocalStrict must be the local scan');
  assert(wrong.length === 0, wrong.join('; '));
});

test('U15: the flags follow the counted rows only — done ⇒ finished and not pending; pending when a finished counted row is not done, even while another is unfinished; the banner never takes part (ADR 0001 sub-decision 4)', async () => {
  const profile = kind0({ website: 'https://alice.example' }, { createdAt: 2000 });
  const mixed = await check({ profile, relays: { [R1]: 'unreachable', [R2]: 'unreachable', [R3]: 'unreachable' } });
  const wrong = [];
  if (!sameJson(flags(mixed.action), { finished: false, done: false, pending: true })) wrong.push(`website other + visible unreachable: want unfinished and pending; got ${show(flags(mixed.action))}`);
  const unfinishedOnly = await check({ relays: { [R1]: 'unreachable', [R2]: 'unreachable', [R3]: 'unreachable' } });
  if (!sameJson(flags(unfinishedOnly.action), { finished: false, done: false, pending: false })) wrong.push(`only visibility unfinished: want unfinished, not pending; got ${show(flags(unfinishedOnly.action))}`);
  for (const [label, a] of [['complete', (await check()).action], ['mixed', mixed.action], ['unfinished', unfinishedOnly.action]]) {
    if (a.done && (!a.finished || a.pending)) wrong.push(`${label}: done ⇒ finished and not pending`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U16: the answer carries no pubkey — neither the viewer\'s nor the Assistant\'s (ADR 0001 sub-decision 8)', async () => {
  const { action } = await check();
  const text = show(action);
  assert(!text.includes(ASSISTANT) && !text.includes(VIEWER), `the profile action names a pubkey: ${text.slice(0, 300)}`);
});

/* ───────────────────────── A — the attention handler ───────────────────────── */

function attentionFakes({ assistant = ASSISTANT, checkProfile } = {}) {
  const calls = { checkProfile: [] };
  const deps = {
    getAssistantPubkeyFor: async () => assistant,
    scanLocal: async () => [],
    readRelay: async () => ({ status: 'unreachable', events: [], error: 'fixture' }),
    readConfiguredRelays: () => [],
    getConfigFromFile: (k, d) => d,
    checkProfile: async (input, d) => {
      calls.checkProfile.push(input);
      if (checkProfile === 'reject') throw new Error('fixture: the profile check exploded');
      return checkProfile || X.PROFILE_DONE;
    },
  };
  return { deps, calls };
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = (pubkey = VIEWER) => ({ session: { authenticated: true, pubkey }, query: { assistantPubkey: STRANGER, customerPubkey: STRANGER } });

test('A1: the one answer carries the profile action beside identification-tags, computed by checkProfile for the session\'s own Assistant — no request parameter changes whose (AC-2; ADR 0001 § Implementation notes 3)', async () => {
  const mod = attentionModule();
  assert(mod.PROFILE === X.ACTION, `attention.js must export PROFILE = 'profile'; got ${show(mod.PROFILE)}`);
  const { deps, calls } = attentionFakes();
  const res = fakeRes();
  await need(mod, 'handleAssistantAttention', 'src/api/assistant/attention.js')(signedInReq(), res, deps);
  const actions = (res.body && res.body.actions) || {};
  const wrong = [];
  if (res.statusCode !== 200) wrong.push(`status ${res.statusCode}`);
  if (!actions['identification-tags']) wrong.push('identification-tags is still answered');
  if (!sameJson(actions.profile, X.PROFILE_DONE)) wrong.push(`actions.profile: want the checkProfile answer, got ${show(actions.profile)}`);
  if (calls.checkProfile.length !== 1 || !calls.checkProfile[0] || calls.checkProfile[0].assistantPubkey !== ASSISTANT) wrong.push(`checkProfile called once with { assistantPubkey: <the session's Assistant> }; got ${show(calls.checkProfile)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('A2: a profile check that throws does not take the other answer with it — 200, identification-tags intact, and the profile action { finished: false, done: false, pending: false, reason: "check-failed", items: [] } (ADR 0001 sub-decision 6)', async () => {
  const mod = attentionModule();
  const { deps } = attentionFakes({ checkProfile: 'reject' });
  const res = fakeRes();
  const log = console.error; const warn = console.warn;
  console.error = () => {}; console.warn = () => {};
  try { await need(mod, 'handleAssistantAttention', 'src/api/assistant/attention.js')(signedInReq(), res, deps); } finally { console.error = log; console.warn = warn; }
  const actions = (res.body && res.body.actions) || {};
  assert(res.statusCode === 200 && actions['identification-tags'], `want 200 with identification-tags; got ${res.statusCode} ${show(res.body)}`);
  assert(sameJson(actions.profile, X.PROFILE_CHECK_FAILED), `actions.profile: want ${show(X.PROFILE_CHECK_FAILED)}, got ${show(actions.profile)}`);
});

test('A3: a visitor, and a viewer with no Assistant here, get no profile action and no profile check (AC-2)', async () => {
  const mod = attentionModule();
  const handle = need(mod, 'handleAssistantAttention', 'src/api/assistant/attention.js');
  const wrong = [];
  const out = attentionFakes();
  const res1 = fakeRes();
  await handle({ session: {}, query: {} }, res1, out.deps);
  if (!sameJson(res1.body, { success: true, signedIn: false })) wrong.push(`visitor: got ${show(res1.body)}`);
  const none = attentionFakes({ assistant: null });
  const res2 = fakeRes();
  await handle(signedInReq(), res2, none.deps);
  if (!sameJson(res2.body, { success: true, signedIn: true, hasAssistant: false, actions: {} })) wrong.push(`no assistant: got ${show(res2.body)}`);
  if (out.calls.checkProfile.length + none.calls.checkProfile.length > 0) wrong.push('checkProfile must not run for them');
  // The attention module must offer checkProfile as a default dependency (ADR 0001 § Implementation notes 3), so the
  // real route runs it; this is the suite's only look at that wiring, because a real run needs a stack.
  if (!/checkProfile/.test(codeOnly(safeRead(ATTENTION_MODULE)))) wrong.push('src/api/assistant/attention.js has no checkProfile dependency');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── F — hasStoredAvatar ───────────────────────── */

test('F1: hasStoredAvatar(file, { baseDir }) is true only for a composite file name that exists in the generated directory — never for a path or another name, even one that exists (ADR 0001 sub-decision 5)', () => {
  const mod = fresh(AVATAR_MODULE, 'It stores composites (ADR ta-avatar/0003).');
  const has = need(mod, 'hasStoredAvatar', 'src/api/assistant/avatar.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-check-'));
  try {
    fs.writeFileSync(path.join(dir, COMPOSITE_FILE), 'x');
    fs.writeFileSync(path.join(dir, 'secret.txt'), 'x');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'ta-avatar-0123abcd.png'), 'x');
    const cases = [[COMPOSITE_FILE, true], ['ta-avatar-0123abcd.png', false], ['secret.txt', false], ['sub/ta-avatar-0123abcd.png', false], ['../secret.txt', false], ['', false]];
    const wrong = cases.filter(([f, want]) => has(f, { baseDir: dir }) !== want).map(([f, want]) => `${show(f)}: want ${want}`);
    assert(wrong.length === 0, wrong.join('; '));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ───────────────────────── C — the hub's two readings and its Done ───────────────────────── */

const USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };

test('C1: CHECKED_ACTIONS includes the profile and identification-tags, and every checked key is a real action (ADR 0001 sub-decision 7)', async () => {
  const mod = await actionsModule();
  const keys = mod.ASSISTANT_ACTIONS.map((a) => a.key);
  assert(Array.isArray(mod.CHECKED_ACTIONS) && mod.CHECKED_ACTIONS.includes(X.ACTION) && mod.CHECKED_ACTIONS.includes('identification-tags'), `CHECKED_ACTIONS must include "profile" and "identification-tags"; got ${show(mod.CHECKED_ACTIONS)}`);
  assert(mod.CHECKED_ACTIONS.every((k) => keys.includes(k)), 'every checked key is one of the actions');
});

test('C2: the two readings for the profile — no answer, checking, failed, unfinished and check-failed mark it but the pill does not count it; pending marks and counts; done unmarks and uncounts (AC-6)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const all = mod.ASSISTANT_ACTIONS.map((a) => a.key);
  const placeholders = all.filter((k) => !(mod.CHECKED_ACTIONS || []).includes(k)).length;
  const ID_DONE = undefined; // withProfile's default: identification-tags done
  const cases = [
    ['no answer', undefined, true, false],
    ['checking', { phase: 'checking', answered: false, actions: {} }, true, false],
    ['failed', summarize(null), true, false],
    ['done', summarize(X.withProfile(X.PROFILE_DONE, ID_DONE)), false, false],
    ['pending', summarize(X.withProfile(X.PROFILE_PENDING, ID_DONE)), true, true],
    ['unfinished', summarize(X.withProfile(X.PROFILE_UNFINISHED, ID_DONE)), true, false],
    ['check-failed', summarize(X.withProfile(X.PROFILE_CHECK_FAILED, ID_DONE)), true, false],
    ['no profile', summarize(X.withProfile(X.PROFILE_NONE, ID_DONE)), true, true],
  ];
  const wrong = [];
  for (const [label, att, marked, counted] of cases) {
    const got = att === undefined ? mod.assistantAttention(USER) : mod.assistantAttention(USER, att);
    const isMarked = got.needsAttention.includes(X.ACTION);
    if (isMarked !== marked) wrong.push(`${label}: profile marked want ${marked}, got ${isMarked}`);
    if (got.count !== got.needsAttention.length) wrong.push(`${label}: count is the marks`);
    const idTagsCounted = att && att.answered && att.actions['identification-tags'] && att.actions['identification-tags'].pending ? 1 : 0;
    const wantAlert = placeholders + idTagsCounted + (counted ? 1 : 0);
    if (got.alertCount !== wantAlert) wrong.push(`${label}: alertCount want ${placeholders} placeholders${counted ? ' + the profile' : ''} = ${wantAlert}, got ${got.alertCount}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C3: assistantAttention answers `done`: the checked actions whose answer says done — the profile and identification-tags alike — never a placeholder, never a marked action, and nothing for a visitor or a viewer with no Assistant (ADR 0001 sub-decision 7)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const wrong = [];
  const both = mod.assistantAttention(USER, summarize(X.withProfile(X.PROFILE_DONE)));
  assert(Array.isArray(both.done), `assistantAttention(user, attention) must answer a fourth field, done: string[]; got ${show(both)}`);
  if ( !sameJson([...both.done].sort(), [X.ACTION, 'identification-tags'].sort())) wrong.push(`both done: want ["identification-tags","profile"], got ${show(both.done)}`);
  const profileOnly = mod.assistantAttention(USER, summarize(X.withProfile(X.PROFILE_DONE, { finished: true, done: false, pending: true, taggings: [] })));
  if (!sameJson(profileOnly.done, [X.ACTION])) wrong.push(`profile done, identification tags pending: want ["profile"], got ${show(profileOnly.done)}`);
  const placeholderSaysDone = summarize(X.withProfile(X.PROFILE_PENDING));
  placeholderSaysDone.actions['trusted-lists'] = { finished: true, done: true, pending: false };
  const p = mod.assistantAttention(USER, placeholderSaysDone);
  if (p.done.includes('trusted-lists') || p.done.includes(X.ACTION)) wrong.push(`a placeholder or a pending action is never done; got ${show(p.done)}`);
  for (const r of [both, profileOnly, p]) if (r.done.some((k) => r.needsAttention.includes(k))) wrong.push(`done and needsAttention overlap: ${show(r)}`);
  const none = mod.assistantAttention(USER);
  if (!sameJson(none.done, [])) wrong.push(`no answer: want [], got ${show(none.done)}`);
  for (const who of [null, { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null }]) {
    const r = mod.assistantAttention(who, summarize(X.withProfile(X.PROFILE_DONE)));
    if (!sameJson(r.done, [])) wrong.push(`${who ? 'no assistant' : 'visitor'}: want [], got ${show(r.done)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4: ASSISTANT_COPY carries the hub\'s Done words — done: "Done", doneSrPrefix: "Done: " — and actions.js keeps its one import (story 1 § Copy)', async () => {
  const mod = await actionsModule();
  const wrong = [];
  if (mod.ASSISTANT_COPY.done !== X.HUB_COPY.done) wrong.push(`ASSISTANT_COPY.done: want ${show(X.HUB_COPY.done)}, got ${show(mod.ASSISTANT_COPY.done)}`);
  if (mod.ASSISTANT_COPY.doneSrPrefix !== X.HUB_COPY.doneSrPrefix) wrong.push(`ASSISTANT_COPY.doneSrPrefix: want ${show(X.HUB_COPY.doneSrPrefix)}, got ${show(mod.ASSISTANT_COPY.doneSrPrefix)}`);
  const imports = [...codeOnly(safeRead(ACTIONS_MOD)).matchAll(/^\s*import\b[^;]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  if (!sameJson(imports, ['../../config/avatarMenuLinks.js'])) wrong.push(`actions.js: expected one import, got ${show(imports)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — the UI, by source ───────────────────────── */

test('D1: the hub reads `done` and its card draws the done marks — class is-done, a ✓ marker, the bs-setup-step-badge is-done badge with ASSISTANT_COPY.done, and ASSISTANT_COPY.doneSrPrefix before the title (ADR 0001 sub-decision 7)', () => {
  const src = codeOnly(safeRead(HUB_PAGE));
  const wrong = [];
  for (const [re, what] of [
    [/\{[^}]*\bdone\b[^}]*\}\s*=\s*assistantAttention\s*\(/, 'destructures done from assistantAttention(…)'],
    [/function\s+ActionCard\s*\(\s*\{[^}]*\bdone\b/, 'ActionCard takes a done prop'],
    [/is-done/, 'the is-done class'],
    [/✓/, 'the ✓ marker'],
    [/bs-setup-step-badge is-done/, 'the bs-setup-step-badge is-done badge'],
    [/ASSISTANT_COPY\.done\b/, 'ASSISTANT_COPY.done'],
    [/ASSISTANT_COPY\.doneSrPrefix/, 'ASSISTANT_COPY.doneSrPrefix'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: the stylesheet gives the hub card\'s done marker its colour — a .bs-assistant-hub-card.is-done .bs-assistant-hub-card-marker rule (ADR 0001 sub-decision 7)', () => {
  const css = safeRead(STYLES);
  assert(/\.bs-assistant-hub-card\.is-done\s+\.bs-assistant-hub-card-marker\s*\{/.test(css), 'ui/src/styles.css needs .bs-assistant-hub-card.is-done .bs-assistant-hub-card-marker { … }');
});

test('D3: the Vite config aliases @tapestry/assistant-profile-items to the library and includes it in the CommonJS transform (ADR 0001 § Implementation notes 1)', () => {
  const vite = safeRead(VITE);
  assert(/['"]@tapestry\/assistant-profile-items['"]\s*:/.test(vite), 'ui/vite.config.js aliases @tapestry/assistant-profile-items');
  assert(/src\\\/lib\\\/assistant-profile-items/.test(vite), 'ui/vite.config.js includes /src\\/lib\\/assistant-profile-items/ in build.commonjsOptions.include');
});

/* ───────────────────────── S — the server, by source ───────────────────────── */

test('S1: the profile check never writes — no strfry import, no signing, no publish, no settings or file write — and never reads a request parameter (AC-2, AC-7)', () => {
  const src = codeOnly(safeRead(CHECK_MODULE));
  assert(src, 'src/api/assistant/profileChecklist.js does not exist');
  const wrong = [];
  for (const [re, what] of [
    [/strfry\s+import/, 'strfry import'], [/finalizeEvent|signEvent|getAssistantKeys\b|getOwnerAssistantKeys/, 'a signer or a key read'],
    [/publishToRelays|publishEverywhere|importToLocalRelay|updateNip05Mapping/, 'a publish helper'],
    [/updateOverrides|writeFileSync|writeFile\(|storeRelayKeys|unlinkSync/, 'a write'], [/req\.(query|body|params)/, 'a request parameter'],
    [/querySync/, 'querySync (non-strict; read relays with readRelayEvents)'],
  ]) if (re.test(src)) wrong.push(`uses ${what}`);
  assert(/readRelayEvents/.test(src), 'reads outside relays with readRelayEvents, the strict reader');
  assert(/lookupNip05/.test(src), 'looks the NIP-05 up with lookupNip05 (src/api/nip05.js), the SSRF-guarded client lookup');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S2: the route\'s documents say it checks the profile — openapi.yaml\'s /api/assistant/attention entry and BIBLE §11\'s row name the profile action and this book\'s ADR (ADR 0001 § Implementation notes 6)', () => {
  const yaml = safeRead(OPENAPI);
  const start = yaml.search(/^\s*\/api\/assistant\/attention:\s*$/m);
  assert(start >= 0, 'openapi.yaml documents /api/assistant/attention');
  const rest = yaml.slice(start + 1);
  const next = rest.search(/^ {2}\/api\//m);
  const entry = next >= 0 ? rest.slice(0, next) : rest;
  const row = safeRead(BIBLE).split(NL).find((l) => l.includes('`/api/assistant/attention`') && l.startsWith('|')) || '';
  const wrong = [];
  if (!/profile/.test(entry)) wrong.push('the openapi entry does not describe the profile action');
  if (!/`profile`/.test(row) || !/assistant-profile-checklist/.test(row)) wrong.push(`BIBLE §11's row must name \`profile\` and assistant-profile-checklist ADR 0001; it reads: ${row.slice(0, 200)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-profile-check (assistant-profile-checklist #1) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}assistant-profile-check: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => { process.exitCode = r.fail > 0 ? 1 : 0; });
}
