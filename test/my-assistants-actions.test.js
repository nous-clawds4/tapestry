'use strict';
/**
 * my-assistants #2: tag, re-tag and untag your Assistants from the My Assistants page.
 *
 * Story: engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.md
 * ADR:   engineering-team/decisions/my-assistants/0002-tag-and-withdraw-from-the-browser-the-read-carries-what-they-need.md
 * Plan:  engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.test-plan.md
 * Browser half: tests/brainstorm/my-assistants-actions.spec.js (what a viewer does and sees: search, Tag, open, Change,
 * Remove, the signed events, the result lines, the refresh).
 *
 * Classes:
 *   T — src/lib/my-assistant-tags gains each definition's author and definitionAddress (ADR 0002 sub-decision 2). [AC-2, AC-6]
 *   R — the read's two new fields, pure: myAssistantRows' per-row `retract`, and definitionsFrom (sub-decision 1). [AC-5, AC-6]
 *   U — handleMyAssistants through its injected `scan`: the definitions read, `definitions` in the answer, its failure. [AC-6]
 *   V — the view-model's pure planning (sub-decision 10): parseExactKey, searchCandidates, rowActions, withdrawalOf,
 *       tagAvailability, and buildRows keeping `retract`.                                       [AC-1, AC-3–AC-6]
 *   O — the orchestration ui/src/pages/assistants/assistantActions.js with FAKE publishers (sub-decision 4): what is
 *       published, in what order, what is not, and what is reported.                             [AC-2, AC-4, AC-5, AC-7]
 *   S — source sentinels: no 64-hex literal, events built only in the publisher file, no top-level publisher import in
 *       the orchestration (so Node can load it).                                                [AC-7]
 *
 * Nothing here publishes anything or opens a socket: the O-class publishers are fakes, and no file that reaches a relay
 * is imported. Everything except story 1's regressions FAILS against the current code.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/my-assistant-tags/index.js');
const ID_TAGS = path.join(REPO, 'src/lib/identification-tags/index.js');
const MODULE = path.join(REPO, 'src/api/assistant/myAssistants.js');
const PROFILE_TAGS = path.join(REPO, 'src/api/profile-tags/index.js');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/assistants/myAssistants.js');
const ACTIONS = path.join(REPO, 'ui/src/pages/assistants/assistantActions.js');
const PAGE_DIR = path.join(REPO, 'ui/src/pages/assistants');
const PUBLISHER = path.join(REPO, 'ui/src/utils/publishProfileTag.js');
const NL = String.fromCharCode(10);

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const OTHER_AUTHOR = '6d'.repeat(32);
const T1 = 'c1'.repeat(32);
const T2 = 'c2'.repeat(32);
const NOUS = require(ID_TAGS).REQUIRED_TAGGINGS.find((e) => e.key === 'my-tapestry-assistant').author;
const Z = require(PROFILE_TAGS).NOSTR_USER_TAG_Z_TAG;
const BRAINSTORM = { key: 'brainstorm', name: 'My Brainstorm Assistant', slug: 'my-brainstorm-assistant' };
const TAPESTRY = { key: 'tapestry', name: 'My Tapestry Assistant', slug: 'my-tapestry-assistant' };
const RELAYS = ['wss://one.example', 'wss://two.example'];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const APOS = /[’']/g;
const plain = (s) => String(s).replace(APOS, "'");

function load(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  delete require.cache[require.resolve(absPath)];
  return require(absPath);
}
function need(mod, name, file, what) {
  assert(mod && typeof mod[name] !== 'undefined', `${rel(file)} does not export ${name}. ${what}`);
  return mod[name];
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(`${pathToFileURL(absPath).href}?t=${Date.now()}`); } catch (err) {
    throw new Error(`${rel(absPath)} could not be loaded in Node: ${err.message}`);
  }
}

let seq = 0;
const nextId = () => (++seq).toString(16).padStart(64, '0');
function tagging({ signer = VIEWER, slug = TAPESTRY.slug, target = T1, polarity = 1, created_at = 1000, id = nextId(), d } = {}) {
  const dTag = d !== undefined ? d : `profile-tag-${slug}-${target.slice(0, 8)}-${signer.slice(0, 8)}`;
  return {
    id, kind: 39999, pubkey: signer, created_at, content: '',
    tags: [['d', dTag], ['p', target], ['a', `39999:${OTHER_AUTHOR}:${slug}`], ['e', 'ee'.repeat(32)], ['z', Z], ['polarity', String(polarity)]],
  };
}
function definitionEvent({ author = NOUS, slug, created_at = 500, id = nextId() }) {
  return { id, kind: 39999, pubkey: author, created_at, content: '{}', tags: [['d', slug], ['z', '39998:x:tag']] };
}
const addr = (ev) => `39999:${ev.pubkey}:${ev.tags.find((t) => t[0] === 'd')[1]}`;
const sorted = (a) => [...a].sort();

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// T — the tag list gains authors
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('T1: both tags carry their definition author — Nous, read from identification-tags (book decision 4)', () => {
  const list = need(load(LIB, 'ADR 0002 sub-decision 2.'), 'MY_ASSISTANT_TAGS', LIB, 'ADR 0002 sub-decision 2.');
  const authors = Array.from(list).map((t) => [t.key, t.author]);
  assert(show(authors) === show([['brainstorm', NOUS], ['tapestry', NOUS]]), `authors should both be identification-tags' my-tapestry-assistant author; got ${show(authors)}`);
});

test('T2: definitionAddress(tag) is 39999:<author>:<slug>', () => {
  const lib = load(LIB, 'ADR 0002 sub-decision 2.');
  const fn = need(lib, 'definitionAddress', LIB, 'ADR 0002 § Implementation notes.');
  const got = Array.from(lib.MY_ASSISTANT_TAGS).map((t) => fn(t));
  assert(show(got) === show([`39999:${NOUS}:my-brainstorm-assistant`, `39999:${NOUS}:my-tapestry-assistant`]), `got ${show(got)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// R — retract and definitions, pure
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

async function rows(input) {
  const fn = need(load(MODULE, 'ADR 0001/0002.'), 'myAssistantRows', MODULE, 'ADR 0001 sub-decision 2.');
  return fn({ viewer: VIEWER, local: null, deletions: [], ...input });
}

test('R1: a row carries retract[key] for each tag it carries — every one of your events for that pair, applies and disputes alike', async () => {
  const older = tagging({ target: T1, polarity: -1, created_at: 100 });
  const otherAddress = tagging({ target: T1, polarity: 1, created_at: 200, d: 'another-client-d' });
  const newest = tagging({ target: T1, polarity: 1, created_at: 300 });
  const got = await rows({ taggings: [older, otherAddress, newest] });
  const r = got.find((x) => x.pubkey === T1);
  assert(r && r.retract && r.retract.tapestry, `the row should carry retract.tapestry; got ${show(r)}`);
  assert(show(sorted(r.retract.tapestry.ids)) === show(sorted([older.id, otherAddress.id, newest.id])), `ids should be all three; got ${show(r.retract.tapestry.ids)}`);
  assert(show(sorted(r.retract.tapestry.addresses)) === show(sorted([addr(newest), addr(otherAddress)])), `addresses should be the two distinct ones (39999:viewer:d); got ${show(r.retract.tapestry.addresses)}`);
});

test('R2: retract has an entry only for the tags the row carries — a disputed other tag gets none', async () => {
  const appliedTapestry = tagging({ target: T1, slug: TAPESTRY.slug, polarity: 1 });
  const disputedBrainstorm = tagging({ target: T1, slug: BRAINSTORM.slug, polarity: -1 });
  const got = await rows({ taggings: [appliedTapestry, disputedBrainstorm] });
  const r = got.find((x) => x.pubkey === T1);
  assert(r && show(Object.keys(r.retract || {}).sort()) === show(['tapestry']), `retract keys should be ['tapestry']; got ${show(r && r.retract)}`);
});

test('R3: a row with both tags has both retract entries; the untagged Local row has retract {}', async () => {
  const got = await rows({ local: LOCAL, taggings: [tagging({ target: T1, slug: TAPESTRY.slug }), tagging({ target: T1, slug: BRAINSTORM.slug })] });
  const both = got.find((x) => x.pubkey === T1);
  assert(both && show(Object.keys(both.retract || {}).sort()) === show(['brainstorm', 'tapestry']), `got ${show(both && both.retract)}`);
  const local = got.find((x) => x.pubkey === LOCAL);
  assert(local && local.retract && Object.keys(local.retract).length === 0, `the untagged Local row's retract should be {}; got ${show(local && local.retract)}`);
});

test('R4: definitionsFrom — each tag found at 39999:<author>:<slug>, newest id; missing → found false, eventId null', () => {
  const fn = need(load(MODULE, 'ADR 0002.'), 'definitionsFrom', MODULE, 'ADR 0002 § Implementation notes.');
  const oldT = definitionEvent({ slug: TAPESTRY.slug, created_at: 100 });
  const newT = definitionEvent({ slug: TAPESTRY.slug, created_at: 200 });
  const imposter = definitionEvent({ slug: BRAINSTORM.slug, author: OTHER_AUTHOR });
  const got = fn([oldT, newT, imposter]);
  assert(got && got.tapestry && got.tapestry.found === true && got.tapestry.eventId === newT.id && got.tapestry.address === `39999:${NOUS}:my-tapestry-assistant`,
    `tapestry: expected found with the newest id; got ${show(got && got.tapestry)}`);
  assert(got.brainstorm && got.brainstorm.found === false && got.brainstorm.eventId === null && got.brainstorm.address === `39999:${NOUS}:my-brainstorm-assistant`,
    `brainstorm: another author's same slug must not count; expected not found; got ${show(got.brainstorm)}`);
  const none = fn([]);
  assert(none.brainstorm.found === false && none.tapestry.found === false, `nothing found → both false; got ${show(none)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// U — the handler reads the definitions too
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function matches(filter, ev) {
  if (Array.isArray(filter.kinds) && !filter.kinds.includes(ev.kind)) return false;
  if (Array.isArray(filter.authors) && !filter.authors.includes(ev.pubkey)) return false;
  for (const [k, vals] of Object.entries(filter)) {
    if (!k.startsWith('#') || !Array.isArray(vals)) continue;
    if (!ev.tags.some((t) => t[0] === k.slice(1) && vals.includes(t[1]))) return false;
  }
  return true;
}
async function answer({ events = [], failOn = null } = {}) {
  const handle = need(load(MODULE, 'ADR 0001.'), 'handleMyAssistants', MODULE, 'ADR 0001.');
  const calls = [];
  const deps = {
    getAssistantPubkeyFor: async () => LOCAL,
    scan: async (filter) => {
      calls.push(filter);
      if (failOn && failOn(filter)) throw new Error('strfry scan failed');
      return events.filter((e) => matches(filter, e));
    },
  };
  const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handle({ session: { authenticated: true, pubkey: VIEWER }, query: {} }, res, deps);
  return { res, body: res.body, calls };
}
const isDefinitionsScan = (f) => Array.isArray(f.authors) && f.authors.includes(NOUS) && Array.isArray(f['#d']);

test('U1: the handler reads the definitions — kind 39999 by their author, at both slugs — and answers `definitions`', async () => {
  const def = definitionEvent({ slug: TAPESTRY.slug });
  const { body, calls } = await answer({ events: [def, tagging({ target: T1 })] });
  const scan = calls.find(isDefinitionsScan);
  assert(scan, `expected a definitions scan with authors [Nous] and a #d filter; scans ${show(calls)}`);
  assert(show(scan.kinds) === show([39999]) && show(sorted(scan['#d'])) === show(sorted([BRAINSTORM.slug, TAPESTRY.slug])), `got ${show(scan)}`);
  assert(body && body.definitions && body.definitions.tapestry && body.definitions.tapestry.found === true && body.definitions.tapestry.eventId === def.id,
    `definitions.tapestry should be found with its id; got ${show(body && body.definitions)}`);
  assert(body.definitions.brainstorm && body.definitions.brainstorm.found === false, `definitions.brainstorm should be not found; got ${show(body.definitions.brainstorm)}`);
  assert(Array.isArray(body.rows) && body.rows.every((r) => r.retract && typeof r.retract === 'object'), `every row carries retract; got ${show(body.rows)}`);
});

test('U2: when the definitions read fails, the whole read is 500 { success: false, error: "Could not load your Assistants" }', async () => {
  const { res, body } = await answer({ events: [tagging({ target: T1 })], failOn: isDefinitionsScan });
  assert(res.statusCode === 500 && show(body) === show({ success: false, error: 'Could not load your Assistants' }), `got ${res.statusCode} ${show(body)}`);
});

test('U3: signed out, the answer is still exactly { success: true, signedIn: false } and nothing is read', async () => {
  const handle = need(load(MODULE, 'ADR 0001.'), 'handleMyAssistants', MODULE, 'ADR 0001.');
  let scans = 0;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handle({ query: {} }, res, { getAssistantPubkeyFor: async () => LOCAL, scan: async () => { scans++; return []; } });
  assert(show(res.body) === show({ success: true, signedIn: false }) && scans === 0, `got ${show(res.body)}, ${scans} scans`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// V — the view-model's pure planning
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const vm = () => esm(VIEW_MODEL, 'ADR 0001/0002: the pure view-model.');
const FOUND = { brainstorm: { address: `39999:${NOUS}:my-brainstorm-assistant`, found: true, eventId: 'b1'.repeat(32) }, tapestry: { address: `39999:${NOUS}:my-tapestry-assistant`, found: true, eventId: 'e1'.repeat(32) } };
const BRAINSTORM_MISSING = { ...FOUND, brainstorm: { ...FOUND.brainstorm, found: false, eventId: null } };
const tagObj = (k) => (k === 'brainstorm' ? { key: 'brainstorm', name: BRAINSTORM.name } : { key: 'tapestry', name: TAPESTRY.name });
const serverRow = (pubkey, keys, { local = false, retract } = {}) => ({
  pubkey, local, tags: keys.map(tagObj),
  retract: retract || Object.fromEntries(keys.map((k) => [k, { ids: [`${k}-id-1`], addresses: [`39999:${VIEWER}:profile-tag-my-${k}-assistant-${pubkey.slice(0, 8)}-${VIEWER.slice(0, 8)}`] }])),
});

test('V1: parseExactKey — an npub or a 64-hex key (any case, padded) gives the hex; anything else null', async () => {
  const fn = need(await vm(), 'parseExactKey', VIEW_MODEL, 'ADR 0002 sub-decision 10.');
  const { nip19 } = await import('nostr-tools');
  const npub = nip19.npubEncode(T2);
  const cases = [[npub, T2], [`  ${npub}  `, T2], [T2.toUpperCase(), T2], [T2, T2], ['alice', null], ['npub1notvalid', null], ['ab'.repeat(31), null], ['', null]];
  for (const [q, want] of cases) {
    const got = fn(q);
    assert(got === want, `parseExactKey(${show(q.slice(0, 20))}…) should be ${show(want)}, got ${show(got)}`);
  }
});

test('V2: searchCandidates — under 2 characters, nothing', async () => {
  const fn = need(await vm(), 'searchCandidates', VIEW_MODEL, 'ADR 0002 sub-decision 10.');
  const got = fn({ query: 'a', hits: [{ pubkey: T1, name: 'alice' }], exact: null, rows: [] });
  assert(Array.isArray(got) && got.length === 0, `got ${show(got)}`);
});

test('V3: searchCandidates — the exact key first, hits after without duplicates, everyone already listed left out', async () => {
  const fn = need(await vm(), 'searchCandidates', VIEW_MODEL, 'ADR 0002 sub-decision 10.');
  const X = 'd1'.repeat(32), Y = 'd2'.repeat(32), W = 'd3'.repeat(32);
  const hits = [
    { pubkey: X, display_name: 'Xavi', nip05: 'x@ex.example', website: 'https://x.example' },
    { pubkey: LOCAL, name: 'my own assistant' },
    { pubkey: T1, name: 'already tagged' },
    { pubkey: W, name: 'Wen' },
    { pubkey: Y, name: 'should not repeat' },
  ];
  const rowsNow = [serverRow(T1, ['tapestry']), serverRow(LOCAL, [], { local: true, retract: {} })];
  const got = fn({ query: 'xx', hits, exact: { pubkey: Y, profile: { name: 'Yara' } }, rows: rowsNow });
  assert(show(got.map((c) => c.pubkey)) === show([Y, X, W]), `order should be [exact Y, X, W] with T1 and LOCAL left out and Y not repeated; got ${show(got.map((c) => c.pubkey.slice(0, 4)))}`);
  const x = got.find((c) => c.pubkey === X);
  assert(x.name === 'Xavi' && x.nip05 === 'x@ex.example' && x.url === 'https://x.example' && typeof x.initial === 'string', `a hit's card fields; got ${show(x)}`);
  const y = got.find((c) => c.pubkey === Y);
  assert(y.name === 'Yara' && y.nip05 === '—' && y.url === '—', `the exact card uses its profile with story 1's fallbacks; got ${show(y)}`);
});

test('V4: searchCandidates — an exact key with no profile is still offered, named by its shortened npub', async () => {
  const m = await vm();
  const fn = need(m, 'searchCandidates', VIEW_MODEL, 'ADR 0002 sub-decision 10.');
  const got = fn({ query: T2, hits: [], exact: { pubkey: T2, profile: null }, rows: [] });
  assert(got.length === 1 && got[0].pubkey === T2 && got[0].name === m.npubShort(T2), `got ${show(got)}`);
});

test('V5: rowActions — one tag: Change to the other (enabled when its definition is found) and Remove Tag', async () => {
  const m = await vm();
  const fn = need(m, 'rowActions', VIEW_MODEL, 'ADR 0002 sub-decision 10.');
  const [r] = m.buildRows({ rows: [serverRow(T1, ['tapestry'])], profiles: {} });
  const a = fn(r, FOUND);
  assert(a && a.change && a.change.toKey === 'brainstorm' && a.change.label === 'Change to My Brainstorm Assistant' && a.change.enabled === true,
    `change; got ${show(a && a.change)}`);
  assert(a.remove && a.remove.label === 'Remove Tag', `remove; got ${show(a.remove)}`);
  const [b] = m.buildRows({ rows: [serverRow(T2, ['brainstorm'])], profiles: {} });
  const ab = fn(b, FOUND);
  assert(ab.change.toKey === 'tapestry' && ab.change.label === 'Change to My Tapestry Assistant', `got ${show(ab.change)}`);
});

test('V6: rowActions — a row with both tags offers no Change; an untagged Local row has no actions', async () => {
  const m = await vm();
  const fn = need(m, 'rowActions', VIEW_MODEL, 'ADR 0002 sub-decision 10.');
  const [both] = m.buildRows({ rows: [serverRow(T1, ['brainstorm', 'tapestry'])], profiles: {} });
  const a = fn(both, FOUND);
  assert(a && a.change === null && a.remove && a.remove.label === 'Remove Tag', `got ${show(a)}`);
  const [local] = m.buildRows({ rows: [serverRow(LOCAL, [], { local: true, retract: {} })], profiles: {} });
  assert(fn(local, FOUND) === null, `the untagged Local row has nothing to open; got ${show(fn(local, FOUND))}`);
});

test('V7: tagAvailability and rowActions — a missing definition disables that tag with § Copy\'s reason; no definitions disables both', async () => {
  const m = await vm();
  const avail = need(m, 'tagAvailability', VIEW_MODEL, 'ADR 0002 sub-decision 10.');
  const a = avail(BRAINSTORM_MISSING);
  assert(a.tapestry.enabled === true && a.brainstorm.enabled === false, `got ${show(a)}`);
  assert(plain(a.brainstorm.reason) === "The My Brainstorm Assistant tag hasn't been published yet, so it can't be applied.", `reason; got ${show(a.brainstorm.reason)}`);
  const none = avail(undefined);
  assert(none.tapestry.enabled === false && none.brainstorm.enabled === false, `no definitions → both disabled; got ${show(none)}`);
  const [r] = m.buildRows({ rows: [serverRow(T1, ['tapestry'])], profiles: {} });
  const act = m.rowActions(r, BRAINSTORM_MISSING);
  assert(act.change.enabled === false && plain(act.change.reason) === plain(a.brainstorm.reason), `Change to Brainstorm disabled with the reason; got ${show(act.change)}`);
});

test('V8: buildRows keeps retract; withdrawalOf gathers every id and address, with the subject naming the tags', async () => {
  const m = await vm();
  const fn = need(m, 'withdrawalOf', VIEW_MODEL, 'ADR 0002 sub-decision 10.');
  const retract = {
    brainstorm: { ids: ['b-1'], addresses: ['39999:v:db'] },
    tapestry: { ids: ['t-1', 't-2'], addresses: ['39999:v:dt', '39999:v:dt2'] },
  };
  const [r] = m.buildRows({ rows: [serverRow(T1, ['brainstorm', 'tapestry'], { retract })], profiles: {} });
  assert(r.retract && show(r.retract) === show(retract), `buildRows should keep retract; got ${show(r.retract)}`);
  const w = fn(r);
  assert(show(sorted(w.ids)) === show(sorted(['b-1', 't-1', 't-2'])) && show(sorted(w.addresses)) === show(sorted(['39999:v:db', '39999:v:dt', '39999:v:dt2'])), `got ${show(w)}`);
  assert(/^Withdrawal of /.test(w.subject) && w.subject.includes(BRAINSTORM.name) && w.subject.includes(TAPESTRY.name) && w.subject.includes(' and '), `subject names both tags; got ${show(w.subject)}`);
  const [one] = m.buildRows({ rows: [serverRow(T2, ['tapestry'])], profiles: {} });
  assert(fn(one).subject === `Withdrawal of ${TAPESTRY.name}`, `one tag; got ${show(fn(one).subject)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// O — the orchestration, with fake publishers (nothing reaches a relay)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const actions = () => esm(ACTIONS, 'ADR 0002 sub-decision 10: tagProfile, changeTag, removeTags, with injectable publishers.');
const okResult = () => ({ local: { success: true }, external: { successes: RELAYS.slice(), failures: [], details: Object.fromEntries(RELAYS.map((r) => [r, { status: 'accepted', reason: '' }])) } });
const nowhere = () => ({ local: { success: false, error: 'strfry import failed' }, external: { successes: [], failures: [], skippedByGate: true } });
function fakeDeps({ apply = okResult, withdraw = okResult } = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      relays: RELAYS,
      applyTagging: async (args) => { calls.push(['apply', args]); const r = apply(args); if (r instanceof Error) throw r; return { signed: { id: 'x' }, result: r }; },
      withdrawTaggings: async (args) => { calls.push(['withdraw', args]); const r = withdraw(args); if (r instanceof Error) throw r; return { signed: { id: 'y' }, result: r }; },
    },
  };
}
async function rowOf(keys, opts) { const m = await vm(); return m.buildRows({ rows: [serverRow(T1, keys, opts)], profiles: {} })[0]; }

test('O1: tagProfile applies the chosen tag to the profile — polarity 1, its definition (slug, author, event id) — and reports in the tag\'s name', async () => {
  const a = await actions();
  const fn = need(a, 'tagProfile', ACTIONS, 'ADR 0002 sub-decision 10.');
  const { deps, calls } = fakeDeps();
  const out = await fn({ target: T2, tagKey: 'tapestry', definitions: FOUND, deps });
  assert(calls.length === 1 && calls[0][0] === 'apply', `one apply; got ${show(calls.map((c) => c[0]))}`);
  const args = calls[0][1];
  assert(args.targetPubkey === T2 && args.polarity === 1 && args.tag && args.tag.slug === TAPESTRY.slug && args.tag.authorPubkey === NOUS && args.tag.eventId === FOUND.tapestry.eventId,
    `apply args; got ${show(args)}`);
  assert(out && Array.isArray(out.reports) && out.reports.length === 1 && out.reports[0].ok === true && out.reports[0].message.includes(`"${TAPESTRY.name}"`), `report; got ${show(out)}`);
});

test('O2: changeTag applies the other tag FIRST, then withdraws the current one\'s ids and addresses', async () => {
  const a = await actions();
  const fn = need(a, 'changeTag', ACTIONS, 'ADR 0002 sub-decision 10.');
  const row = await rowOf(['tapestry']);
  const { deps, calls } = fakeDeps();
  const out = await fn({ row, toKey: 'brainstorm', definitions: FOUND, deps });
  assert(show(calls.map((c) => c[0])) === show(['apply', 'withdraw']), `order should be apply then withdraw; got ${show(calls.map((c) => c[0]))}`);
  assert(calls[0][1].tag.slug === BRAINSTORM.slug && calls[0][1].targetPubkey === T1, `the apply is the brainstorm tagging of the row's profile; got ${show(calls[0][1])}`);
  assert(show(calls[1][1].ids) === show(row.retract.tapestry.ids) && show(calls[1][1].addresses) === show(row.retract.tapestry.addresses), `the withdrawal is retract.tapestry; got ${show(calls[1][1])}`);
  assert(out.reports.length === 2 && out.reports.every((r) => r.ok), `two ok reports; got ${show(out)}`);
});

test('O3: changeTag does not withdraw when the apply was refused, or reached no relay', async () => {
  const a = await actions();
  const row = await rowOf(['tapestry']);
  const refused = fakeDeps({ apply: () => new Error('No NIP-07 extension detected.') });
  const out1 = await a.changeTag({ row, toKey: 'brainstorm', definitions: FOUND, deps: refused.deps });
  assert(show(refused.calls.map((c) => c[0])) === show(['apply']), `refused apply → no withdraw; got ${show(refused.calls.map((c) => c[0]))}`);
  assert(out1 && typeof out1.refused === 'string' && out1.refused.includes('No NIP-07 extension detected'), `the refusal in its own words; got ${show(out1)}`);
  const lost = fakeDeps({ apply: nowhere });
  const out2 = await a.changeTag({ row, toKey: 'brainstorm', definitions: FOUND, deps: lost.deps });
  assert(show(lost.calls.map((c) => c[0])) === show(['apply']), `an apply no relay took → no withdraw; got ${show(lost.calls.map((c) => c[0]))}`);
  assert(out2.reports.length === 1 && out2.reports[0].ok === false, `one failed report; got ${show(out2)}`);
});

test('O4: changeTag reports a half-done change truthfully — the apply ok, the withdrawal reached nowhere', async () => {
  const a = await actions();
  const row = await rowOf(['tapestry']);
  const { deps } = fakeDeps({ withdraw: nowhere });
  const out = await a.changeTag({ row, toKey: 'brainstorm', definitions: FOUND, deps });
  assert(out.reports.length === 2 && out.reports[0].ok === true && out.reports[1].ok === false, `got ${show(out.reports.map((r) => r.ok))}`);
  assert(/^"?Withdrawal of My Tapestry Assistant"?/.test(out.reports[1].message), `the second report's subject; got ${show(out.reports[1].message)}`);
});

test('O5: removeTags withdraws every id and address the row carries, in one withdrawal', async () => {
  const a = await actions();
  const fn = need(a, 'removeTags', ACTIONS, 'ADR 0002 sub-decision 10.');
  const retract = { brainstorm: { ids: ['b-1'], addresses: ['39999:v:db'] }, tapestry: { ids: ['t-1'], addresses: ['39999:v:dt'] } };
  const row = await rowOf(['brainstorm', 'tapestry'], { retract });
  const { deps, calls } = fakeDeps();
  const out = await fn({ row, deps });
  assert(calls.length === 1 && calls[0][0] === 'withdraw', `one withdrawal; got ${show(calls.map((c) => c[0]))}`);
  assert(show(sorted(calls[0][1].ids)) === show(['b-1', 't-1']) && show(sorted(calls[0][1].addresses)) === show(['39999:v:db', '39999:v:dt']), `got ${show(calls[0][1])}`);
  assert(out.reports.length === 1 && out.reports[0].ok === true, `got ${show(out)}`);
});

test('O6: a refusal (no extension, signer mismatch) is returned in its own words, with no report', async () => {
  const a = await actions();
  const { deps, calls } = fakeDeps({ apply: () => new Error('Your signer is on a different account (…abcdef) than you’re signed in as (…123456).') });
  const out = await a.tagProfile({ target: T2, tagKey: 'tapestry', definitions: FOUND, deps });
  assert(calls.length === 1 && typeof out.refused === 'string' && out.refused.includes('different account') && (!out.reports || out.reports.length === 0), `got ${show(out)}`);
});

test('O7: a tag whose definition is not found is never applied — refused before any signature', async () => {
  const a = await actions();
  const { deps, calls } = fakeDeps();
  const out = await a.tagProfile({ target: T2, tagKey: 'brainstorm', definitions: BRAINSTORM_MISSING, deps });
  assert(calls.length === 0, `nothing may be signed; got ${show(calls)}`);
  assert(typeof out.refused === 'string' && plain(out.refused).includes("hasn't been published yet"), `got ${show(out)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — source sentinels
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('S1: no 64-hex literal in the lib, the server module, the view-model, the orchestration or the page', () => {
  for (const f of [LIB, MODULE, VIEW_MODEL, ACTIONS, path.join(PAGE_DIR, 'Index.jsx')]) {
    const src = safeRead(f);
    assert(src, `${rel(f)} does not exist`);
    const hex = src.match(/[0-9a-f]{64}/i);
    assert(!hex, `${rel(f)} has a 64-hex literal (${hex && hex[0].slice(0, 12)}…)`);
  }
});

test('S2: events are built only in the publisher file — no page file composes a kind 5 or kind 39999 event', () => {
  const files = fs.readdirSync(PAGE_DIR).filter((f) => /\.(jsx?|mjs)$/.test(f)).map((f) => path.join(PAGE_DIR, f));
  for (const f of files) {
    const src = safeRead(f);
    assert(!/kind:\s*(5|39999)\b/.test(src) && !/signEvent\s*\(/.test(src), `${rel(f)} builds or signs an event; the wire shapes live in ui/src/utils/publishProfileTag.js`);
  }
  assert(/export\s+async\s+function\s+publishTaggingWithdrawalWithReport\b/.test(safeRead(PUBLISHER)), `${rel(PUBLISHER)} should export publishTaggingWithdrawalWithReport (ADR 0002 sub-decision 3)`);
});

test('S3: the orchestration does not import the publishers at the top, so Node can load it with fakes', () => {
  const src = safeRead(ACTIONS);
  assert(src, `${rel(ACTIONS)} does not exist`);
  assert(!/^import[^;]*from\s+['"][./]*[^'"]*(publishProfileTag|nostrPublish)/m.test(src), `${rel(ACTIONS)} imports a publisher at the top; the page passes them in (plan § Test infrastructure)`);
});

async function run() {
  console.log(`${NL}=== my-assistants-actions (my-assistants #2) ===`);
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
  console.log(`${NL}my-assistants-actions: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
