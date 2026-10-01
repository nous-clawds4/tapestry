'use strict';
/**
 * my-assistants #1: the My Assistants page, its menu link, and the list of your Assistants.
 *
 * Story: engineering-team/stories/my-assistants/1-the-my-assistants-page.md
 * ADR:   engineering-team/decisions/my-assistants/0001-one-session-read-lists-your-assistants.md
 * Plan:  engineering-team/stories/my-assistants/1-the-my-assistants-page.test-plan.md
 * Browser half: tests/brainstorm/my-assistants.spec.js (what a viewer SEES: words, order, states, layout, menu).
 *
 * Classes:
 *   T — the shared list src/lib/my-assistant-tags (pure CommonJS): the two tags, their order, names and slugs. [AC-3]
 *   R — the rule, pure: myAssistantRows / slugOf / isRetracted in src/api/assistant/myAssistants.js, on plain
 *       event fixtures (ADR sub-decision 2).                                                     [AC-3, AC-5]
 *   U — handleMyAssistants driven through the dependencies ADR 0001 names (getAssistantPubkeyFor, scan). The fake
 *       scan answers like a relay: it applies the filter it is given, unless a test asks it not to.  [AC-3, AC-5, AC-6]
 *   C — the page's pure view-model ui/src/pages/assistants/myAssistants.js, loaded in Node: order, names, npub,
 *       URL and NIP-05 fallbacks, the untagged Local row, the count.                             [AC-4, AC-5, AC-6]
 *   M — the menu list ui/src/config/avatarMenuLinks.js: My Assistants right after My Treasure Map.      [AC-1]
 *   S — source sentinels on the server: the route, no hardcoded key, no query parameter, nothing written. [AC-3, AC-6]
 *   D — source sentinels on the UI files this runner cannot execute (JSX): the route, and the two links read
 *       from their owners rather than re-typed.                                                    [AC-2, AC-5]
 *   R0 — regressions that pass before and after: the canonical z is profile-tags' own export; any path is
 *       served the app (so a direct load of /assistants reaches the router).
 *   H — the live contract on whatever instance is reachable (BRAINSTORM_BASE_URL, else localhost:7778). Skips when
 *       nothing answers, or on a Node without fetch.
 *
 * Everything except R0 FAILS against the current code: src/lib/my-assistant-tags, src/api/assistant/myAssistants.js
 * and ui/src/pages/assistants/ do not exist; personalLinks has no My Assistants; /api/assistant/my-assistants
 * answers 404.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/my-assistant-tags/index.js');
const ID_TAGS = path.join(REPO, 'src/lib/identification-tags/index.js');
const MODULE = path.join(REPO, 'src/api/assistant/myAssistants.js');
const PROFILE_TAGS = path.join(REPO, 'src/api/profile-tags/index.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/assistants/myAssistants.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistants/Index.jsx');
const MENU = path.join(REPO, 'ui/src/config/avatarMenuLinks.js');
const APP = path.join(REPO, 'ui/src/App.jsx');
const PROFILE_BATCH = path.join(REPO, 'ui/src/utils/profileBatch.js');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const OTHER_SIGNER = 'b2'.repeat(32);
const OTHER_AUTHOR = '6d'.repeat(32);
const T1 = 'c1'.repeat(32);
const T2 = 'c2'.repeat(32);
const T3 = 'c3'.repeat(32);

const BRAINSTORM = { key: 'brainstorm', name: 'My Brainstorm Assistant', slug: 'my-brainstorm-assistant' };
const TAPESTRY = { key: 'tapestry', name: 'My Tapestry Assistant', slug: 'my-tapestry-assistant' };

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

// ── Loaders: a missing file or export is a readable failure, never a crash of the suite ──────────────────────────

function load(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  delete require.cache[require.resolve(absPath)];
  return require(absPath);
}
function need(mod, name, file, what) {
  assert(mod && typeof mod[name] !== 'undefined', `${rel(file)} does not export ${name}. ${what}`);
  return mod[name];
}
const lib = () => load(LIB, 'ADR 0001 sub-decision 3: the two tags live in one pure list.');
const mod = () => load(MODULE, 'ADR 0001 sub-decisions 1–2: GET /api/assistant/my-assistants and its rule.');
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(`${pathToFileURL(absPath).href}?t=${Date.now()}`); } catch (err) {
    throw new Error(`${rel(absPath)} could not be loaded in Node: ${err.message}`);
  }
}
const viewModel = () => esm(VIEW_MODEL, 'ADR 0001 sub-decision 5: the pure view-model, loadable in Node.');

// The canonical z every tagging carries (ADR 0015's named exception), from its one owner — never re-typed here.
const Z = require(PROFILE_TAGS).NOSTR_USER_TAG_Z_TAG;

// ── Fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────────

let seq = 0;
const nextId = () => (++seq).toString(16).padStart(64, '0');

/** A tagging in the publisher's shape (ui/src/utils/publishProfileTag.js). */
function tagging({
  signer = VIEWER, slug = TAPESTRY.slug, target = T1, polarity = 1, created_at = 1000, id = nextId(),
  tagAuthor = OTHER_AUTHOR, a, d, withA = true, withP = true,
} = {}) {
  const dTag = d !== undefined ? d : `profile-tag-${slug}-${String(target).slice(0, 8)}-${signer.slice(0, 8)}`;
  const tags = [['d', dTag]];
  if (withP) tags.push(['p', target]);
  if (a !== undefined) tags.push(['a', a]);
  else if (withA) tags.push(['a', `39999:${tagAuthor}:${slug}`]);
  tags.push(['e', 'ee'.repeat(32)]);
  tags.push(['z', Z]);
  if (polarity !== null) tags.push(['polarity', String(polarity)]);
  return { id, kind: 39999, pubkey: signer, created_at, tags, content: '' };
}
/** A NIP-09 deletion. */
function deletion({ signer = VIEWER, e, a, created_at = 2000 } = {}) {
  const tags = [];
  if (e) tags.push(['e', e]);
  if (a) tags.push(['a', a]);
  return { id: nextId(), kind: 5, pubkey: signer, created_at, tags, content: 'revoked' };
}
const addressOf = (ev) => `39999:${ev.pubkey}:${ev.tags.find((t) => t[0] === 'd')[1]}`;

/** Rows compared without their order (the response promises none), tags by key. */
function norm(rows) {
  assert(Array.isArray(rows), `expected an array of rows, got ${show(rows)}`);
  return rows
    .map((r) => ({ pubkey: r.pubkey, local: r.local, tags: (r.tags || []).map((t) => t && t.key) }))
    .sort((x, y) => (x.pubkey < y.pubkey ? -1 : x.pubkey > y.pubkey ? 1 : 0));
}
async function rowsFor({ taggings = [], deletions = [], local = null, viewer = VIEWER } = {}) {
  const fn = need(mod(), 'myAssistantRows', MODULE, 'ADR 0001 sub-decision 2: the rule is a pure function.');
  return norm(await fn({ viewer, local, taggings, deletions }));
}
const listed = (rows) => rows.map((r) => r.pubkey);

// ── Fake relay / deps for the handler ────────────────────────────────────────────────────────────────────────────

/** NIP-01 filter semantics for what the fakes need: kinds, authors, and #<letter> tag filters. */
function matches(filter, ev) {
  if (Array.isArray(filter.kinds) && !filter.kinds.includes(ev.kind)) return false;
  if (Array.isArray(filter.authors) && !filter.authors.includes(ev.pubkey)) return false;
  for (const [k, vals] of Object.entries(filter)) {
    if (!k.startsWith('#') || !Array.isArray(vals)) continue;
    const letter = k.slice(1);
    if (!ev.tags.some((t) => t[0] === letter && vals.includes(t[1]))) return false;
  }
  return true;
}
function fakes(opts = {}) {
  const { events = [], sloppy = false, scanThrows = false } = opts;
  const local = Object.prototype.hasOwnProperty.call(opts, 'local') ? opts.local : LOCAL; // an explicit undefined stays undefined
  const calls = { scan: [], getAssistant: [] };
  const deps = {
    getAssistantPubkeyFor: async (pk) => { calls.getAssistant.push(pk); return local; },
    scan: async (filter) => {
      calls.scan.push(filter);
      if (scanThrows) throw new Error('strfry scan failed');
      return sloppy ? events.slice() : events.filter((e) => matches(filter, e));
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
const signedInReq = (pubkey = VIEWER, extra = {}) => ({ session: { authenticated: true, pubkey }, query: {}, ...extra });
async function answer(opts = {}, req = signedInReq()) {
  const handle = need(mod(), 'handleMyAssistants', MODULE, 'ADR 0001 sub-decision 1: the session-scoped handler.');
  const { deps, calls } = fakes(opts);
  const res = fakeRes();
  await handle(req, res, deps);
  return { res, body: res.body, calls };
}
// The taggings read is the kind 39999 scan carrying the canonical #z. Re-aimed by my-assistants #2 (ADR 0002 sub-decision 1),
// which adds a second kind 39999 scan for the tag definitions (by their author and #d); that one is not a taggings read.
const taggingScans = (calls) => calls.scan.filter((f) => Array.isArray(f.kinds) && f.kinds.includes(39999) && Array.isArray(f['#z']));
const deletionScans = (calls) => calls.scan.filter((f) => Array.isArray(f.kinds) && f.kinds.includes(5));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// T — the two tags
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('T1: the list holds exactly My Brainstorm Assistant then My Tapestry Assistant, with their keys, names and slugs', () => {
  const list = need(lib(), 'MY_ASSISTANT_TAGS', LIB, 'ADR 0001 sub-decision 3.');
  const seen = Array.from(list).map((t) => ({ key: t.key, name: t.name, slug: t.slug }));
  assert(show(seen) === show([BRAINSTORM, TAPESTRY]), `MY_ASSISTANT_TAGS should be ${show([BRAINSTORM, TAPESTRY])}, got ${show(seen)}`);
});

test('T2: the Tapestry slug is the Identification Tags entry’s own slug, not a second copy that could drift', () => {
  const list = need(lib(), 'MY_ASSISTANT_TAGS', LIB, 'ADR 0001 sub-decision 3.');
  const idEntry = require(ID_TAGS).REQUIRED_TAGGINGS.find((e) => e.key === 'my-tapestry-assistant');
  const tapestry = Array.from(list).find((t) => t.key === 'tapestry');
  assert(tapestry && tapestry.slug === idEntry.slug, `the tapestry entry's slug should equal identification-tags' (${idEntry.slug}), got ${show(tapestry)}`);
});

test('T3: slugKey maps each slug to its key and anything else to null', () => {
  const slugKey = need(lib(), 'slugKey', LIB, 'ADR 0001 § Implementation notes.');
  const got = ['my-brainstorm-assistant', 'my-tapestry-assistant', 'my-agent', 'my-tapestry-assistant-v2', '', undefined].map((s) => slugKey(s));
  assert(show(got) === show(['brainstorm', 'tapestry', null, null, null, null]), `slugKey answers ${show(got)}`);
});

test('T4: the list module is pure — its only require is identification-tags', () => {
  const src = safeRead(LIB);
  assert(src, `${rel(LIB)} does not exist`);
  const requires = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  const other = requires.filter((r) => !/identification-tags/.test(r));
  assert(other.length === 0, `${rel(LIB)} requires ${show(other)}; ADR 0001 § Implementation notes: no requires except ../identification-tags`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// R — which taggings count (ADR sub-decision 2)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('R1: your apply under My Tapestry Assistant lists its target, with the Tapestry tag', async () => {
  const rows = await rowsFor({ taggings: [tagging({ target: T1 })] });
  assert(show(rows) === show([{ pubkey: T1, local: false, tags: ['tapestry'] }]), `got ${show(rows)}`);
});

test('R2: a same-named tag counts whoever published its definition (Nous’, or anyone else’s)', async () => {
  const nous = require(ID_TAGS).REQUIRED_TAGGINGS.find((e) => e.key === 'my-tapestry-assistant').author;
  const rows = await rowsFor({ taggings: [tagging({ target: T1, tagAuthor: nous }), tagging({ target: T2, tagAuthor: OTHER_AUTHOR })] });
  assert(show(listed(rows)) === show([T1, T2]), `both authors' same-named tag should count; listed ${show(listed(rows))}`);
});

test('R3: your apply under My Brainstorm Assistant lists its target, with the Brainstorm tag', async () => {
  const rows = await rowsFor({ taggings: [tagging({ slug: BRAINSTORM.slug, target: T2 })] });
  assert(show(rows) === show([{ pubkey: T2, local: false, tags: ['brainstorm'] }]), `got ${show(rows)}`);
});

test('R4: a profile tagged with both is ONE row carrying both tags, Brainstorm first', async () => {
  const rows = await rowsFor({ taggings: [tagging({ slug: TAPESTRY.slug, target: T1 }), tagging({ slug: BRAINSTORM.slug, target: T1 })] });
  assert(show(rows) === show([{ pubkey: T1, local: false, tags: ['brainstorm', 'tapestry'] }]), `got ${show(rows)}`);
});

test('R5: a tagging under any other tag is not listed', async () => {
  const rows = await rowsFor({ taggings: [tagging({ slug: 'my-agent', target: T1 }), tagging({ slug: 'podcaster', target: T2 })] });
  assert(rows.length === 0, `other tags must not count; listed ${show(rows)}`);
});

test('R6: with no `a`, the publisher’s d says which tag it is', async () => {
  const rows = await rowsFor({ taggings: [tagging({ slug: TAPESTRY.slug, target: T1, withA: false })] });
  assert(show(rows) === show([{ pubkey: T1, local: false, tags: ['tapestry'] }]), `a d-only tagging should count; got ${show(rows)}`);
});

test('R7: the d fallback needs the exact slug and your own signer segment', async () => {
  const trap = tagging({ withA: false, target: T1, d: `profile-tag-my-tapestry-assistant-v2-${T1.slice(0, 8)}-${VIEWER.slice(0, 8)}` });
  const foreignSegment = tagging({ withA: false, target: T2, d: `profile-tag-my-tapestry-assistant-${T2.slice(0, 8)}-${OTHER_SIGNER.slice(0, 8)}` });
  const rows = await rowsFor({ taggings: [trap, foreignSegment] });
  assert(rows.length === 0, `a longer slug with the same prefix, or another signer's segment, must not count; listed ${show(rows)}`);
});

test('R8: `a` comes first: an `a` naming another tag wins over a d that names ours; a malformed `a` falls back to d', async () => {
  const aSaysOther = tagging({ target: T1, a: `39999:${OTHER_AUTHOR}:podcaster` });
  const aMalformed = tagging({ target: T2, a: '39999:not-a-key:my-tapestry-assistant' });
  const rows = await rowsFor({ taggings: [aSaysOther, aMalformed] });
  assert(show(listed(rows)) === show([T2]), `expected only T2 (d fallback after a malformed a); listed ${show(listed(rows))}`);
});

test('R9: your latest stance decides — a newer dispute hides an older apply; a newer apply after a dispute lists', async () => {
  const d1 = `profile-tag-my-tapestry-assistant-${T1.slice(0, 8)}-${VIEWER.slice(0, 8)}`;
  const hidden = await rowsFor({ taggings: [tagging({ target: T1, polarity: 1, created_at: 100 }), tagging({ target: T1, polarity: -1, created_at: 200, d: d1 })] });
  assert(hidden.length === 0, `a newer dispute must hide the apply; listed ${show(hidden)}`);
  const shown = await rowsFor({ taggings: [tagging({ target: T1, polarity: -1, created_at: 100 }), tagging({ target: T1, polarity: 1, created_at: 200, d: d1 })] });
  assert(show(listed(shown)) === show([T1]), `a newer apply must list; listed ${show(listed(shown))}`);
});

test('R10: only an apply counts — a neutral stance does not; an absent polarity is an apply', async () => {
  const neutral = await rowsFor({ taggings: [tagging({ target: T1, polarity: 0 })] });
  assert(neutral.length === 0, `polarity 0 is neither; listed ${show(neutral)}`);
  const absent = await rowsFor({ taggings: [tagging({ target: T2, polarity: null })] });
  assert(show(listed(absent)) === show([T2]), `no polarity tag reads as apply; listed ${show(listed(absent))}`);
});

test('R11: the newest per (tag, profile) decides even across two addresses', async () => {
  const oursApply = tagging({ target: T1, polarity: 1, created_at: 100 });
  const otherAddressDispute = tagging({ target: T1, polarity: -1, created_at: 200, d: 'some-other-client-d' });
  const rows = await rowsFor({ taggings: [oursApply, otherAddressDispute] });
  assert(rows.length === 0, `the newer dispute at another address must decide; listed ${show(rows)}`);
});

test('R12: on a created_at tie, the lowest id wins (NIP-01)', async () => {
  const low = '0'.repeat(64);
  const high = 'f'.repeat(64);
  const applyWins = await rowsFor({ taggings: [tagging({ target: T1, polarity: 1, created_at: 500, id: low }), tagging({ target: T1, polarity: -1, created_at: 500, id: high, d: 'x' })] });
  assert(show(listed(applyWins)) === show([T1]), `the lower-id apply should win the tie; listed ${show(listed(applyWins))}`);
  const disputeWins = await rowsFor({ taggings: [tagging({ target: T1, polarity: 1, created_at: 500, id: high }), tagging({ target: T1, polarity: -1, created_at: 500, id: low, d: 'x' })] });
  assert(disputeWins.length === 0, `the lower-id dispute should win the tie; listed ${show(disputeWins)}`);
});

test('R13: retracted by e — your kind 5 naming it hides it; someone else’s kind 5 does not', async () => {
  const t = tagging({ target: T1 });
  const mine = await rowsFor({ taggings: [t], deletions: [deletion({ e: t.id })] });
  assert(mine.length === 0, `your deletion must hide it; listed ${show(mine)}`);
  const theirs = await rowsFor({ taggings: [t], deletions: [deletion({ signer: OTHER_SIGNER, e: t.id })] });
  assert(show(listed(theirs)) === show([T1]), `another key's deletion must not; listed ${show(listed(theirs))}`);
});

test('R14: retracted by a — a deletion of its address at or after it hides it; an older one does not', async () => {
  const t = tagging({ target: T1, created_at: 1000 });
  const atOrAfter = await rowsFor({ taggings: [t], deletions: [deletion({ a: addressOf(t), created_at: 1000 })] });
  assert(atOrAfter.length === 0, `a deletion at the same second must hide it; listed ${show(atOrAfter)}`);
  const older = await rowsFor({ taggings: [t], deletions: [deletion({ a: addressOf(t), created_at: 999 })] });
  assert(show(listed(older)) === show([T1]), `a re-tag after an address deletion must count; listed ${show(listed(older))}`);
});

test('R15: retracting an older version does not hide a newer apply', async () => {
  const old = tagging({ target: T1, created_at: 100 });
  const newer = tagging({ target: T1, created_at: 300, d: old.tags[0][1] });
  const rows = await rowsFor({ taggings: [old, newer], deletions: [deletion({ e: old.id, created_at: 200 })] });
  assert(show(listed(rows)) === show([T1]), `the newer apply stands; listed ${show(listed(rows))}`);
});

test('R16: a tagging whose p is not a 64-hex key is dropped', async () => {
  const rows = await rowsFor({ taggings: [tagging({ target: 'npub1notahexkey' }), tagging({ target: T2, withP: false, d: `profile-tag-my-tapestry-assistant-${T2.slice(0, 8)}-${VIEWER.slice(0, 8)}` })] });
  assert(rows.length === 0, `no valid target, no row; listed ${show(rows)}`);
});

test('R17: your Assistant here, tagged — one row, marked local, with its tags', async () => {
  const rows = await rowsFor({ local: LOCAL, taggings: [tagging({ target: LOCAL }), tagging({ target: T1, slug: BRAINSTORM.slug })] });
  assert(show(rows) === show(norm([{ pubkey: LOCAL, local: true, tags: [{ key: 'tapestry' }] }, { pubkey: T1, local: false, tags: [{ key: 'brainstorm' }] }])), `got ${show(rows)}`);
});

test('R18: your Assistant here, untagged — listed all the same, marked local, with no tags', async () => {
  const rows = await rowsFor({ local: LOCAL, taggings: [tagging({ target: T1 })] });
  const localRow = rows.find((r) => r.pubkey === LOCAL);
  assert(localRow && localRow.local === true && localRow.tags.length === 0, `expected { pubkey: LOCAL, local: true, tags: [] }; got ${show(rows)}`);
  const alone = await rowsFor({ local: LOCAL });
  assert(show(alone) === show([{ pubkey: LOCAL, local: true, tags: [] }]), `with no taggings, the local row alone; got ${show(alone)}`);
});

test('R19: no Assistant here — no row is local, and none is added', async () => {
  const rows = await rowsFor({ local: null, taggings: [tagging({ target: T1 })] });
  assert(rows.every((r) => r.local === false) && rows.length === 1, `got ${show(rows)}`);
  const none = await rowsFor({ local: null });
  assert(none.length === 0, `no taggings and no local → no rows; got ${show(none)}`);
});

test('R20: each row’s tags carry the tag names the page shows', async () => {
  const fn = need(mod(), 'myAssistantRows', MODULE, 'ADR 0001 sub-decision 2.');
  const rows = await fn({ viewer: VIEWER, local: null, taggings: [tagging({ target: T1 }), tagging({ target: T1, slug: BRAINSTORM.slug })], deletions: [] });
  const tags = rows[0] && rows[0].tags;
  assert(show(tags) === show([{ key: 'brainstorm', name: BRAINSTORM.name }, { key: 'tapestry', name: TAPESTRY.name }]), `got ${show(tags)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// U — the handler (ADR sub-decision 1)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('U1: without a real signed-in session it answers signedIn:false and reads nothing', async () => {
  const shapes = [
    ['no session', { query: {} }],
    ['an empty session', { session: {}, query: {} }],
    ['a sign-in still pending (authenticated unset)', { session: { pubkey: VIEWER }, query: {} }],
    ['authenticated is not exactly true', { session: { authenticated: 'true', pubkey: VIEWER }, query: {} }],
    ['a session pubkey that is not 64-hex', { session: { authenticated: true, pubkey: 'npub1notahexkey' }, query: {} }],
  ];
  for (const [label, req] of shapes) {
    const { res, body, calls } = await answer({}, req);
    assert(res.statusCode === 200 && body && body.success === true && body.signedIn === false, `${label}: expected 200 { success: true, signedIn: false }, got ${res.statusCode} ${show(body)}`);
    assert(calls.scan.length === 0 && calls.getAssistant.length === 0, `${label}: nothing may be read without a viewer; scans ${show(calls.scan)}, lookups ${show(calls.getAssistant)}`);
  }
});

test('U2: signed in, it answers { success, signedIn, local, rows } by the rule', async () => {
  const { res, body } = await answer({ events: [tagging({ target: T1 }), tagging({ target: T2, slug: BRAINSTORM.slug })] });
  assert(res.statusCode === 200 && body && body.success === true && body.signedIn === true, `got ${res.statusCode} ${show(body)}`);
  assert(body.local === LOCAL, `local should be the viewer's Assistant here (${LOCAL}); got ${show(body.local)}`);
  const rows = norm(body.rows);
  assert(show(rows) === show(norm([{ pubkey: LOCAL, local: true, tags: [] }, { pubkey: T1, local: false, tags: [{ key: 'tapestry' }] }, { pubkey: T2, local: false, tags: [{ key: 'brainstorm' }] }])), `rows: ${show(rows)}`);
});

test('U3: it reads the relays every tag page reads — your kind 39999 carrying the canonical z', async () => {
  const { calls } = await answer({ events: [tagging({ target: T1 })] });
  const scans = taggingScans(calls);
  assert(scans.length === 1, `expected one taggings read, got ${show(calls.scan)}`);
  const f = scans[0];
  assert(show(f.kinds) === show([39999]) && show(f.authors) === show([VIEWER]) && show(f['#z']) === show([Z]),
    `the read should be { kinds: [39999], authors: [viewer], '#z': [${Z}] }; got ${show(f)}`);
});

test('U4: whose list is the session’s — a query parameter cannot change it, and the key is read lowercase', async () => {
  const req = { session: { authenticated: true, pubkey: VIEWER.toUpperCase() }, query: { pubkey: OTHER_SIGNER, viewer: OTHER_SIGNER, author: OTHER_SIGNER } };
  const { body, calls } = await answer({ events: [tagging({ target: T1 })] }, req);
  const f = taggingScans(calls)[0] || {};
  assert(show(f.authors) === show([VIEWER]), `authors should be the session viewer lowercased; got ${show(f.authors)}`);
  assert(show(calls.getAssistant) === show([VIEWER]), `the Local lookup should be for the viewer; got ${show(calls.getAssistant)}`);
  assert(body && Array.isArray(body.rows) && body.rows.some((r) => r.pubkey === T1), `the viewer's own tagging should list; got ${show(body)}`);
});

test('U5: a tagging signed by anyone else is not listed, even when a relay returns it', async () => {
  const theirs = tagging({ signer: OTHER_SIGNER, target: T2 });
  const { body } = await answer({ local: null, sloppy: true, events: [tagging({ target: T1 }), theirs] });
  assert(body && Array.isArray(body.rows), `got ${show(body)}`);
  assert(!body.rows.some((r) => r.pubkey === T2), `another signer's tagging must not count; rows ${show(body.rows)}`);
});

test('U6: your retractions are read and honoured, by e and by address; with no candidates nothing more is read', async () => {
  const byE = tagging({ target: T1 });
  const byA = tagging({ target: T2, created_at: 1000 });
  const kept = tagging({ target: T3 });
  const events = [byE, byA, kept, deletion({ e: byE.id }), deletion({ a: addressOf(byA), created_at: 1500 })];
  const { body, calls } = await answer({ local: null, events });
  assert(show(norm(body && body.rows)) === show([{ pubkey: T3, local: false, tags: ['tapestry'] }]), `only T3 survives; got ${show(body)}`);
  assert(deletionScans(calls).length >= 1, `the viewer's kind 5s must be read; scans ${show(calls.scan)}`);
  assert(deletionScans(calls).every((f) => show(f.authors) === show([VIEWER])), `deletion reads are the viewer's own; got ${show(deletionScans(calls))}`);
  const empty = await answer({ local: null, events: [] });
  assert(deletionScans(empty.calls).length === 0, `with no candidate taggings there is nothing to retract; scans ${show(empty.calls.scan)}`);
});

test('U7: an Assistant lookup that answers nothing usable means no Local row', async () => {
  for (const local of [null, undefined, '', 'not-a-key', 'ab'.repeat(31)]) {
    const { body } = await answer({ local, events: [tagging({ target: T1 })] });
    assert(body && body.local === null, `getAssistantPubkeyFor → ${show(local)}: local should be null; got ${show(body && body.local)}`);
    assert(Array.isArray(body.rows) && body.rows.every((r) => r.local === false), `no row may be local; rows ${show(body.rows)}`);
  }
});

test('U8: when the local read fails, 500 { success: false, error: "Could not load your Assistants" }', async () => {
  const { res, body } = await answer({ scanThrows: true });
  assert(res.statusCode === 500, `expected 500, got ${res.statusCode}`);
  assert(show(body) === show({ success: false, error: 'Could not load your Assistants' }), `got ${show(body)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// C — the page's view-model (ADR sub-decision 5)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

async function vm() {
  const m = await viewModel();
  return { buildRows: need(m, 'buildRows', VIEW_MODEL, 'ADR 0001 sub-decision 5.'), countText: need(m, 'countText', VIEW_MODEL, 'ADR 0001 sub-decision 5.') };
}
const row = (pubkey, keys = ['tapestry'], local = false) => ({ pubkey, local, tags: keys.map((k) => ({ key: k, name: k === 'brainstorm' ? BRAINSTORM.name : TAPESTRY.name })) });
async function npubShortOf(pk) {
  const { nip19 } = await import('nostr-tools');
  const npub = nip19.npubEncode(pk);
  return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
}

test('C1: Local first, then alphabetical by the name shown (case and accents aside), pubkey breaking a tie', async () => {
  const { buildRows } = await vm();
  const D1 = 'd1'.repeat(32), D2 = 'd2'.repeat(32), D3 = 'd3'.repeat(32), D4 = 'd4'.repeat(32);
  const rows = [row(D3), row(LOCAL, ['tapestry'], true), row(D1), row(D4), row(D2), row(T1)];
  const profiles = {
    [LOCAL]: { display_name: 'Zed' },
    [D1]: { name: 'bob' },
    [D2]: { display_name: 'Bob' },
    [D3]: { display_name: 'Émile' },
    [D4]: { name: 'alice' },
    [T1]: null,
  };
  const got = buildRows({ rows, profiles }).map((r) => r.pubkey);
  const expected = [LOCAL, D4, D1, D2, D3, T1]; // Zed (Local) · alice · bob/Bob by pubkey · Émile · npub1…
  assert(show(got) === show(expected), `order should be ${show(expected)}, got ${show(got)}`);
});

test('C2: the name is display_name, else name, else the shortened npub — also for a missing or failed profile', async () => {
  const { buildRows } = await vm();
  const { PROFILE_LOOKUP_FAILED } = await esm(PROFILE_BATCH, 'the shared profile seam');
  const E1 = 'e1'.repeat(32), E2 = 'e2'.repeat(32), E3 = 'e3'.repeat(32), E4 = 'e4'.repeat(32), E5 = 'e5'.repeat(32), E6 = 'e6'.repeat(32);
  const profiles = {
    [E1]: { display_name: 'Dee', name: 'dee_n' },
    [E2]: { display_name: '', name: 'Eve' },
    [E3]: { name: 'Fay' },
    [E4]: {},
    [E5]: null,
    [E6]: PROFILE_LOOKUP_FAILED,
  };
  const built = buildRows({ rows: [E1, E2, E3, E4, E5, E6].map((pk) => row(pk)), profiles });
  const byPk = Object.fromEntries(built.map((r) => [r.pubkey, r]));
  const want = { [E1]: 'Dee', [E2]: 'Eve', [E3]: 'Fay', [E4]: await npubShortOf(E4), [E5]: await npubShortOf(E5), [E6]: await npubShortOf(E6) };
  for (const [pk, name] of Object.entries(want)) {
    assert(byPk[pk] && byPk[pk].name === name, `${pk.slice(0, 4)}…: name should be ${show(name)}, got ${show(byPk[pk] && byPk[pk].name)}`);
  }
});

test('C3: every row carries its npub, shortened as npub1… (first 12, an ellipsis, last 6)', async () => {
  const { buildRows } = await vm();
  const [r] = buildRows({ rows: [row(T2)], profiles: { [T2]: { name: 'x' } } });
  const want = await npubShortOf(T2);
  assert(r && r.npubShort === want, `npubShort should be ${want}, got ${show(r && r.npubShort)}`);
});

test('C4: URL is the profile’s website and NIP-05 its nip05, trimmed; missing, empty or blank shows —', async () => {
  const { buildRows } = await vm();
  const F1 = 'f1'.repeat(32), F2 = 'f2'.repeat(32), F3 = 'f3'.repeat(32), F4 = 'f4'.repeat(32);
  const profiles = {
    [F1]: { name: 'a', website: '  https://assist.example  ', nip05: ' bot@assist.example ' },
    [F2]: { name: 'b', website: '', nip05: '' },
    [F3]: { name: 'c', website: '   ', nip05: '   ' },
    [F4]: null,
  };
  const byPk = Object.fromEntries(buildRows({ rows: [F1, F2, F3, F4].map((pk) => row(pk)), profiles }).map((r) => [r.pubkey, r]));
  assert(byPk[F1].url === 'https://assist.example' && byPk[F1].nip05 === 'bot@assist.example', `trimmed values; got ${show(byPk[F1])}`);
  for (const pk of [F2, F3, F4]) {
    assert(byPk[pk].url === '—' && byPk[pk].nip05 === '—', `${pk.slice(0, 4)}…: missing values show —; got url ${show(byPk[pk].url)}, nip05 ${show(byPk[pk].nip05)}`);
  }
});

test('C5: the avatar letter is the first letter of the name shown', async () => {
  const { buildRows } = await vm();
  const built = buildRows({ rows: [row(T1), row(T2)], profiles: { [T1]: { display_name: 'quill' }, [T2]: null } });
  for (const r of built) {
    assert(typeof r.initial === 'string' && r.initial.length >= 1 && r.initial.toLowerCase() === r.name[0].toLowerCase(),
      `initial should be the first letter of ${show(r.name)}; got ${show(r.initial)}`);
  }
});

test('C6: the Local row with no tags is marked untagged; a tagged Local row and every other row are not', async () => {
  const { buildRows } = await vm();
  const untaggedLocal = buildRows({ rows: [row(LOCAL, [], true), row(T1)], profiles: {} });
  const u = Object.fromEntries(untaggedLocal.map((r) => [r.pubkey, r]));
  assert(u[LOCAL].local === true && u[LOCAL].untagged === true, `untagged Local; got ${show(u[LOCAL])}`);
  assert(u[T1].local === false && u[T1].untagged === false, `other row; got ${show(u[T1])}`);
  const [taggedLocal] = buildRows({ rows: [row(LOCAL, ['tapestry'], true)], profiles: {} });
  assert(taggedLocal.untagged === false, `a tagged Local row is not untagged; got ${show(taggedLocal)}`);
});

test('C7: each row keeps its tags, in the order the answer gives them', async () => {
  const { buildRows } = await vm();
  const [r] = buildRows({ rows: [row(T1, ['brainstorm', 'tapestry'])], profiles: {} });
  assert(show(r.tags) === show([{ key: 'brainstorm', name: BRAINSTORM.name }, { key: 'tapestry', name: TAPESTRY.name }]), `got ${show(r.tags)}`);
});

test('C8: the count reads "0 Assistants", "1 Assistant", "N Assistants"', async () => {
  const { countText } = await vm();
  const got = [0, 1, 2, 12].map((n) => countText(n));
  assert(show(got) === show(['0 Assistants', '1 Assistant', '2 Assistants', '12 Assistants']), `got ${show(got)}`);
});

test('C9: the view-model imports no React, so Node can run it (ADR sub-decision 5)', () => {
  const src = safeRead(VIEW_MODEL);
  assert(src, `${rel(VIEW_MODEL)} does not exist`);
  assert(!/from\s+['"]react['"]/.test(src), `${rel(VIEW_MODEL)} imports react`);
});

// Added after review 1 (engineering-team/reviews/my-assistants/1-the-my-assistants-page.md, blocking finding 1): a kind 0
// is arbitrary JSON, so a name field can be a number, an array or blank. Such a profile is still listed (AC-4), with the
// fallbacks — never an error for the whole page (AC-6).
test('C10: a display_name or name that is not non-blank text is skipped — the row falls back, and nothing throws', async () => {
  const { buildRows } = await vm();
  const G1 = '71'.repeat(32), G2 = '72'.repeat(32), G3 = '73'.repeat(32), G4 = '74'.repeat(32), G5 = '75'.repeat(32);
  const profiles = {
    [G1]: { display_name: 42, name: 'Gil' },
    [G2]: { display_name: ['x'], name: { first: 'y' } },
    [G3]: { display_name: '   ', name: 'Hal' },
    [G4]: { display_name: true },
    [G5]: { display_name: '  Ivy  ' },
  };
  let built;
  try {
    built = buildRows({ rows: [G1, G2, G3, G4, G5].map((pk) => row(pk)), profiles });
  } catch (err) {
    throw new Error(`buildRows threw on a malformed profile: ${err.message}`);
  }
  const byPk = Object.fromEntries(built.map((r) => [r.pubkey, r]));
  const want = { [G1]: 'Gil', [G2]: await npubShortOf(G2), [G3]: 'Hal', [G4]: await npubShortOf(G4), [G5]: 'Ivy' };
  for (const [pk, name] of Object.entries(want)) {
    assert(byPk[pk] && byPk[pk].name === name, `${pk.slice(0, 4)}…: name should be ${show(name)}, got ${show(byPk[pk] && byPk[pk].name)}`);
    assert(typeof byPk[pk].initial === 'string' && byPk[pk].initial.length >= 1, `${pk.slice(0, 4)}…: an avatar letter; got ${show(byPk[pk].initial)}`);
  }
});

test('C11: the avatar letter is a whole character, even when the name starts with an emoji', async () => {
  const { buildRows } = await vm();
  const [r] = buildRows({ rows: [row(T1)], profiles: { [T1]: { display_name: '🦊 Fox Assistant' } } });
  assert(r && r.initial === '🦊', `initial should be the whole emoji 🦊, got ${show(r && r.initial)} (${r && [...(r.initial || '')].length} code points, ${r && (r.initial || '').length} UTF-16 units)`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// M — the menu (AC-1)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('M1: the menu module names the page’s address, /assistants', async () => {
  const m = await esm(MENU, 'the avatar menu list');
  assert(m.MY_ASSISTANTS_PATH === '/assistants', `MY_ASSISTANTS_PATH should be '/assistants', got ${show(m.MY_ASSISTANTS_PATH)}`);
});

test('M2: for every kind of signed-in person, My Assistants comes right after My Treasure Map and opens /assistants', async () => {
  const { personalLinks } = await esm(MENU, 'the avatar menu list');
  const people = [
    { classification: 'owner', assistantPubkey: LOCAL },
    { classification: 'admin', assistantPubkey: LOCAL },
    { classification: 'customer', assistantPubkey: LOCAL },
    { classification: 'customer', assistantPubkey: null },
    { classification: 'guest', assistantPubkey: null },
  ];
  for (const person of people) {
    for (const profileBase of ['/user', '/tapestry/users']) {
      const links = personalLinks({ pubkey: VIEWER, ...person, profileBase });
      const i = links.findIndex((l) => l.key === 'my-treasure-map');
      assert(i >= 0, `My Treasure Map is still listed (${show(person)})`);
      const next = links[i + 1];
      assert(next && next.key === 'my-assistants' && next.label === 'My Assistants' && next.to === '/assistants',
        `${show(person)} ${profileBase}: the item after My Treasure Map should be My Assistants → /assistants; got ${show(next)}`);
      assert(links.filter((l) => l.to === '/assistants').length === 1, `exactly one menu item opens /assistants; got ${show(links)}`);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — server source sentinels
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('S1: GET /api/assistant/my-assistants is registered to handleMyAssistants', () => {
  const src = safeRead(API_INDEX);
  assert(/app\.get\(\s*['"]\/api\/assistant\/my-assistants['"]/.test(src), `${rel(API_INDEX)} registers no GET /api/assistant/my-assistants`);
  assert(/assistant\/myAssistants/.test(src) && /handleMyAssistants/.test(src), `${rel(API_INDEX)} should route it to ./assistant/myAssistants' handleMyAssistants`);
});

test('S2: the module hardcodes no key, reads no query parameter, and writes nothing', () => {
  const src = safeRead(MODULE);
  assert(src, `${rel(MODULE)} does not exist`);
  const hex = src.match(/[0-9a-f]{64}/i);
  assert(!hex, `${rel(MODULE)} contains a 64-hex literal (${hex && hex[0].slice(0, 12)}…); keys come from the session, getAssistantPubkeyFor and profile-tags' export (CLAUDE.md house rule)`);
  assert(!/req\.query|\.query\b/.test(src), `${rel(MODULE)} reads a query parameter; ADR 0001 sub-decision 1: it takes none`);
  const writes = src.match(/\b(publish\w*|signEvent|finalizeEvent|getPrivateKey|writeFile\w*|exec|execSync|spawn)\s*\(/);
  assert(!writes, `${rel(MODULE)} calls ${writes && writes[1]}(); the read publishes, signs and stores nothing`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// D — UI source sentinels (JSX this runner cannot execute)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('D1: App.jsx routes MY_ASSISTANTS_PATH to the page in pages/assistants/Index', () => {
  const src = safeRead(APP);
  assert(/from\s+['"]\.\/pages\/assistants\/Index(\.jsx)?['"]/.test(src), `${rel(APP)} does not import pages/assistants/Index`);
  assert(/path:\s*MY_ASSISTANTS_PATH/.test(src) && /<MyAssistantsPage\b/.test(src), `${rel(APP)} has no { path: MY_ASSISTANTS_PATH, element: <MyAssistantsPage /> } route`);
});

test('D2: the page reads its two links from their owners — no re-typed /assistant/identification-tags or Treasure Map path', () => {
  const src = safeRead(PAGE) + NL + safeRead(VIEW_MODEL);
  assert(safeRead(PAGE), `${rel(PAGE)} does not exist`);
  assert(!src.includes('/assistant/identification-tags'), 'the tag prompt\'s target is ASSISTANT_ACTIONS\' identification-tags path, never a literal (ADR 0001 sub-decision 5)');
  assert(!src.includes('/tapestry/grapevine/treasure-map'), 'the Treasure Map link is personalLinks\' my-treasure-map target, never a literal (ADR 0001 § Implementation notes)');
  assert(/ASSISTANT_ACTIONS/.test(src) && /my-treasure-map/.test(src), 'the page should read ASSISTANT_ACTIONS and the my-treasure-map entry');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// R0 — regressions (pass before and after)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('R0-1: the canonical z is profile-tags’ own export, composed on ADR 0015’s legacy key', () => {
  const src = safeRead(PROFILE_TAGS);
  const legacy = (src.match(/const LEGACY_Z_TAG_PUBKEY = '([0-9a-f]{64})'/) || [])[1];
  assert(legacy && Z === `39998:${legacy}:nostr-user-tag`, `NOSTR_USER_TAG_Z_TAG should be 39998:<LEGACY_Z_TAG_PUBKEY>:nostr-user-tag; got ${show(Z)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// H — live contract (skips when nothing answers)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

let hExecuted = 0;
let hSkipped = 0;
async function live(pathname) {
  if (typeof fetch !== 'function') return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try { return await fetch(`${HOST_BASE}${pathname}`, { signal: ctl.signal, headers: { accept: '*/*' } }); } catch { return null; } finally { clearTimeout(timer); }
}

test('H1: live — an anonymous GET /api/assistant/my-assistants answers 200 { success: true, signedIn: false }', async () => {
  const res = await live('/api/assistant/my-assistants');
  if (!res) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  assert(res.status === 200 && body && body.success === true && body.signedIn === false, `${HOST_BASE}: got ${res.status} ${show(body)}`);
});

test('R0-2 (H): live — /assistants is served the app, so a direct load or refresh reaches the router', async () => {
  const res = await live('/assistants');
  if (!res) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  const text = await res.text();
  assert(res.status === 200 && /<div id="root"/.test(text), `${HOST_BASE}/assistants: got ${res.status}, ${text.slice(0, 80)}`);
});

async function run() {
  console.log(`${NL}=== my-assistants-page (my-assistants #1) ===`);
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
  console.log(`my-assistants-page: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('my-assistants-page: !! LIVE COVERAGE DID NOT RUN — stack unreachable (or no fetch on this Node).');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' });
      fail++;
    }
  }
  console.log(`${NL}my-assistants-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
