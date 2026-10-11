/**
 * Re-Sync a Dictionary concept (the owner's request of 2026-10-02).
 *
 * The owner's rules: beside Edit, a Re-Sync button rebuilds the local header from scratch from the shared
 * concept it is wired to, with a warning that the header is completely overwritten and a summary of the
 * tags removed and added (a changed tag is the old one removed and the new one added). The local header
 * always has one b-tag, at the shared concept's header, whether or not that header points to itself, and
 * none of the shared header's own b-tags. The owner chose to keep the local json, concept-graph and z, and
 * to show the confirmation inline on the entry page.
 *
 *   R1..R6  — the rule, src/lib/conceptHeaderCopy.js (resyncedHeaderTags, tagDiff, wiredTarget).
 *   E1..E11 — POST /api/dictionaries/concepts/resync (src/api/adoption/resyncConcept.js), every side effect injected.
 *   S1..S4  — structural pins, read off comment-stripped source.
 *
 * The browser half is tests/brainstorm/dictionary-concepts.spec.js D38–D39.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COPY = path.join(ROOT, 'src/lib/conceptHeaderCopy.js');
const MODULE = path.join(ROOT, 'src/api/adoption/resyncConcept.js');
const ADOPTION_INDEX = path.join(ROOT, 'src/api/adoption/index.js');
const AUTH_JS = path.join(ROOT, 'src/middleware/auth.js');
const UI = path.join(ROOT, 'ui/src');
const ENTRY_BODY_JSX = path.join(UI, 'pages/dictionaries/ConceptEntry.jsx');
const ENTRY_PAGE_JSX = path.join(UI, 'pages/dictionary/Entry.jsx');
const PANEL_JSX = path.join(UI, 'pages/dictionaries/ResyncPanel.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function src(p) {
  let s = '';
  try { s = fs.readFileSync(p, 'utf8'); } catch { /* reported below */ }
  assert(s.length > 0, `${path.relative(ROOT, p)} must exist`);
  return s;
}
const flat = (s) => s.replace(/\s+/g, ' ');
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const show = (v) => JSON.stringify(v);
const copy = () => require(COPY);
function mod() {
  let m = null;
  try { m = require(MODULE); } catch (err) { throw new Error(`${path.relative(ROOT, MODULE)} must load: ${err.message}`); }
  return m;
}

const ASSISTANT = 'b'.repeat(64);
const SESSION = 'a'.repeat(64);
const SHARER = 'e'.repeat(64);
const OTHER = 'c'.repeat(64);
const SHARED = `39998:${SHARER}:github-accounts`;
const COORD = `39998:${ASSISTANT}:github-account`;
const NOW = 1790000000;

/** The owner's GitHub Account on staging: wired, with required added by Edit, but no field-type. */
const LOCAL = {
  id: '1'.repeat(64), kind: 39998, pubkey: ASSISTANT, created_at: 1700000100, content: '', sig: 'f'.repeat(128),
  tags: [['d', 'github-account'], ['names', 'GitHub Account', 'GitHub Accounts'], ['description', 'A list of github handles/accounts'],
    ['required', 'github-username'], ['b', SHARED, 'pointer']],
};
const SOURCE = {
  id: '7'.repeat(64), kind: 39998, pubkey: SHARER, created_at: 1700000000, content: '', sig: 'a'.repeat(128),
  tags: [['d', 'github-accounts'], ['names', 'GitHub Account', 'GitHub Accounts'], ['description', 'A list of github handles/accounts'],
    ['required', 'github-username'], ['field-type', 'github-username', 'text'], ['b', SHARED, 'pointer']],
};

// ═══ R — the rule ════════════════════════════════════════════════════════════

test('R1: the GitHub Account case — Re-Sync adds the field-type the copy lacked, and nothing else changes', () => {
  const { resyncedHeaderTags, tagDiff } = copy();
  const tags = resyncedHeaderTags({ local: LOCAL, source: SOURCE, target: SHARED });
  assert(show(tags) === show([...LOCAL.tags.slice(0, 4), ['field-type', 'github-username', 'text'], ['b', SHARED, 'pointer']]), show(tags));
  const diff = tagDiff(LOCAL.tags, tags);
  assert(show(diff) === show({ removed: [], added: [['field-type', 'github-username', 'text']] }), show(diff));
});

test('R2: from scratch — the local names, description and tags give way to the shared ones; the address stays', () => {
  const { resyncedHeaderTags, tagDiff } = copy();
  const local = { ...LOCAL, tags: [['d', 'github-account'], ['names', 'GH', 'GHs'], ['description', 'Mine.'], ['recommended', 'foo'], ['image', 'x.png'], ['b', SHARED, 'pointer']] };
  const tags = resyncedHeaderTags({ local, source: SOURCE, target: SHARED });
  assert(tags[0][1] === 'github-account', 'the local d-tag');
  const diff = tagDiff(local.tags, tags);
  assert(show(diff.removed) === show([['names', 'GH', 'GHs'], ['description', 'Mine.'], ['recommended', 'foo'], ['image', 'x.png']]), show(diff.removed));
  assert(show(diff.added) === show([['names', 'GitHub Account', 'GitHub Accounts'], ['description', 'A list of github handles/accounts'],
    ['required', 'github-username'], ['field-type', 'github-username', 'text']]), show(diff.added));
  const noDesc = resyncedHeaderTags({ local, source: { ...SOURCE, tags: SOURCE.tags.filter((t) => t[0] !== 'description') }, target: SHARED });
  assert(!noDesc.some((t) => t[0] === 'description'), 'a shared header with no description leaves the copy without one');
});

test('R3: the local json, concept-graph and z are kept (the owner\'s choice); the shared header\'s are never taken', () => {
  const { resyncedHeaderTags, tagDiff } = copy();
  const json = JSON.stringify({ conceptHeader: { description: 'Old.', oNames: { singular: 'gh', plural: 'ghs' }, oSlugs: { singular: 'gh' } } });
  const local = { ...LOCAL, tags: [['d', 'github-account'], ['names', 'gh', 'ghs'], ['json', json], ['concept-graph', `39999:${ASSISTANT}:gh-concept-graph`],
    ['description', 'Old.'], ['z', `39998:${ASSISTANT}:account`], ['b', SHARED, 'pointer']] };
  const source = { ...SOURCE, tags: [...SOURCE.tags, ['json', '{"theirs":1}'], ['concept-graph', `39999:${SHARER}:x`], ['z', `39998:${SHARER}:y`]] };
  const tags = resyncedHeaderTags({ local, source, target: SHARED });
  assert(show(tags.map((t) => t[0])) === show(['d', 'names', 'description', 'json', 'concept-graph', 'z', 'required', 'field-type', 'b']), show(tags.map((t) => t[0])));
  assert(tags.find((t) => t[0] === 'concept-graph')[1] === `39999:${ASSISTANT}:gh-concept-graph` && tags.find((t) => t[0] === 'z')[1] === `39998:${ASSISTANT}:account`, 'the local ones');
  const ch = JSON.parse(tags.find((t) => t[0] === 'json')[1]).conceptHeader;
  assert(show(ch.oNames) === show({ singular: 'GitHub Account', plural: 'GitHub Accounts' }) && ch.description === 'A list of github handles/accounts'
    && show(ch.oSlugs) === show({ singular: 'gh' }), `the kept json follows the new names and description, identities kept: ${show(ch)}`);
  const diff = tagDiff(local.tags, tags);
  assert(!diff.removed.some((t) => t[0] === 'concept-graph' || t[0] === 'z') && !diff.added.some((t) => t[0] === 'concept-graph' || t[0] === 'z'),
    'they appear unchanged in the summary');
});

test('R4: one b-tag, at the shared header, whether or not it points to itself; none of its b-tags, none of the local extras', () => {
  const { resyncedHeaderTags } = copy();
  const notShared = { ...SOURCE, tags: SOURCE.tags.filter((t) => t[0] !== 'b').concat([['b', `39998:${OTHER}:foo`, 'pointer']]) };
  const local = { ...LOCAL, tags: [...LOCAL.tags, ['b', `39998:${OTHER}:second`, 'pointer']] };
  const tags = resyncedHeaderTags({ local, source: notShared, target: SHARED });
  const bs = tags.filter((t) => t[0] === 'b');
  assert(show(bs) === show([['b', SHARED, 'pointer']]), `only the shared concept: ${show(bs)}`);
});

test('R5: the shared concept a header is wired to is its first pointer b-tag at another list header', () => {
  const { wiredTarget } = copy();
  assert(wiredTarget(LOCAL) === SHARED, 'wired');
  assert(wiredTarget({ ...LOCAL, tags: [['d', 'github-account'], ['b', COORD, 'pointer']] }) === null, 'self-shared: nothing to sync from');
  assert(wiredTarget({ ...LOCAL, tags: [['d', 'x'], ['b', 'b-tag-deferred']] }) === null, 'kept private');
  assert(wiredTarget({ ...LOCAL, tags: [['d', 'x'], ['b', SHARED]] }) === SHARED, 'an untyped b reads as a pointer');
  assert(wiredTarget({ ...LOCAL, tags: [['d', 'x'], ['b', SHARED, 'inherit-items'], ['b', `39998:${OTHER}:y`, 'pointer']] }) === `39998:${OTHER}:y`, 'only pointer-typed');
});

test('R6: the summary counts tags exactly: a changed tag is one removed and one added; repeats count', () => {
  const { tagDiff } = copy();
  assert(show(tagDiff([['b', 'x', 'pointer']], [['b', 'y', 'pointer']])) === show({ removed: [['b', 'x', 'pointer']], added: [['b', 'y', 'pointer']] }), 'changed b');
  assert(show(tagDiff([['t', 'a'], ['t', 'a']], [['t', 'a']])) === show({ removed: [['t', 'a']], added: [] }), 'one of two repeats removed');
  assert(show(tagDiff(LOCAL.tags, LOCAL.tags.slice().reverse())) === show({ removed: [], added: [] }), 'order alone is no change in the summary');
});

// ═══ E — the endpoint ════════════════════════════════════════════════════════

const fakeSign = (pubkey) => (template, privkey) => ({ ...template, pubkey, id: `${privkey.slice(0, 4)}${'0'.repeat(60)}`, sig: 'f'.repeat(128) });

async function run(over = {}) {
  const calls = { scans: [], community: [], signed: [], published: [], imported: [] };
  const stored = 'stored' in over ? over.stored : [LOCAL];
  const deps = {
    requireAuth: () => SESSION,
    getAssistantKeys: async () => ('keys' in over ? over.keys : { pubkey: ASSISTANT, privkey: '9'.repeat(64) }),
    scanAll: async (filter) => {
      calls.scans.push(filter);
      if (Array.isArray(filter.ids)) return (over.local || [SOURCE]).filter((ev) => filter.ids.includes(ev.id));
      if (filter['#d']) return stored;
      return over.others || stored;
    },
    readCommunity: async (filter) => {
      calls.community.push(filter);
      if (over.communityDown) return { status: 'unreachable', events: [] };
      return { status: 'ok', events: (over.community || []).filter((ev) => filter.ids.includes(ev.id)) };
    },
    verify: over.verify || (() => true),
    sign: (template, privkey) => { calls.signed.push({ template, privkey }); return (over.sign || fakeSign(ASSISTANT))(template, privkey); },
    publishLocal: async (ev) => { calls.published.push(ev); },
    isStored: over.isStored || (async () => true),
    graphHas: over.graphHas || (async () => true),
    importToGraph: async (ev, uuid) => { calls.imported.push({ id: ev.id, uuid }); },
    now: () => NOW,
  };
  const req = { headers: { host: 'here.example' }, body: 'body' in over ? over.body : { coord: COORD, basedOn: LOCAL.id, copyFrom: SOURCE.id } };
  let status = 200;
  let body = null;
  const res = { status(n) { status = n; return this; }, json(b) { body = b; return this; } };
  await mod().createResyncConceptHandler(deps)(req, res);
  return { status, body, calls };
}

test('E1: the caller\'s own Assistant, its own header, the version the page showed, and a copyFrom', async () => {
  assert((await run({ keys: null })).body.code === 'no-assistant', 'no Assistant');
  const theirs = await run({ body: { coord: `39998:${OTHER}:x`, basedOn: LOCAL.id, copyFrom: SOURCE.id } });
  assert(theirs.status === 403 && theirs.body.code === 'not-yours', show(theirs.body));
  const noCopy = await run({ body: { coord: COORD, basedOn: LOCAL.id, copyFrom: 'abc' } });
  assert(noCopy.status === 400 && /copyFrom/.test(noCopy.body.error) && noCopy.calls.scans.length === 0, show(noCopy.body));
  const stale = await run({ stored: [LOCAL, { ...LOCAL, id: '2'.repeat(64), created_at: LOCAL.created_at + 5 }] });
  assert(stale.status === 409 && stale.body.code === 'changed' && stale.calls.signed.length === 0, `${stale.status} ${show(stale.body).slice(0, 100)}`);
});

test('E2: a header that isn\'t wired to another one has nothing to re-sync from', async () => {
  const self = { ...LOCAL, tags: [['d', 'github-account'], ['names', 'x', 'xs'], ['b', COORD, 'pointer']] };
  const r = await run({ stored: [self] });
  assert(r.status === 400 && r.body.code === 'not-wired' && r.calls.signed.length === 0, show(r.body));
});

test('E3: the shared version is read as Create New Concept reads it, and must be at the header\'s wired target', async () => {
  const there = await run({ local: [], community: [SOURCE] });
  assert(there.status === 200 && show(there.calls.community) === show([{ ids: [SOURCE.id], kinds: [39998], authors: [SHARER] }]), `${there.status} ${show(there.body).slice(0, 100)}`);
  const missing = await run({ local: [] });
  assert(missing.status === 409 && missing.body.code === 'source-missing', show(missing.body));
  const down = await run({ local: [], communityDown: true });
  assert(down.status === 502 && down.body.code === 'source-unreachable', show(down.body));
  const elsewhere = await run({ local: [{ ...SOURCE, pubkey: OTHER }] });
  assert(elsewhere.status === 400 && elsewhere.body.code === 'source-mismatch' && elsewhere.calls.signed.length === 0, show(elsewhere.body));
});

test('E4: the new version is the rule\'s, signed with the caller\'s key, after the version it replaces; the graph follows', async () => {
  const { resyncedHeaderTags } = copy();
  const r = await run();
  assert(r.status === 200 && r.body.success && r.body.graph === 'updated', show(r.body).slice(0, 120));
  const t = r.calls.signed[0];
  assert(t.privkey === '9'.repeat(64) && show(t.template.tags) === show(resyncedHeaderTags({ local: LOCAL, source: SOURCE, target: SHARED })), show(t.template.tags));
  assert(t.template.created_at === NOW && t.template.content === '', show(t.template));
  assert(show(r.calls.imported) === show([{ id: r.body.event.id, uuid: COORD }]), 'the graph node follows');
  const late = await run({ stored: [{ ...LOCAL, created_at: NOW + 10 }], body: { coord: COORD, basedOn: LOCAL.id, copyFrom: SOURCE.id } });
  assert(late.calls.signed[0].template.created_at === NOW + 11, 'never at or before the version it replaces');
  const none = await run({ graphHas: async () => false });
  assert(none.body.graph === 'none' && none.calls.imported.length === 0, 'no node: none made');
});

test('E5: already in sync is answered without signing', async () => {
  const { resyncedHeaderTags } = copy();
  const synced = { ...LOCAL, tags: resyncedHeaderTags({ local: LOCAL, source: SOURCE, target: SHARED }) };
  const r = await run({ stored: [synced], body: { coord: COORD, basedOn: synced.id, copyFrom: SOURCE.id } });
  assert(r.status === 200 && r.body.unchanged === true && r.calls.signed.length === 0, show(r.body).slice(0, 120));
});

test('E6: a rename Re-Sync would bring is refused as Edit refuses one', async () => {
  const keyed = { ...LOCAL, tags: [['d', 'shared-concept'], ['names', 'shared concept', 'shared concepts'], ['b', SHARED, 'pointer']] };
  const a = await run({ stored: [keyed], body: { coord: `39998:${ASSISTANT}:shared-concept`, basedOn: LOCAL.id, copyFrom: SOURCE.id } });
  assert(a.status === 400 && a.body.code === 'name-keyed', `a name-keyed concept keeps its name: ${show(a.body)}`);
  const onto = { ...SOURCE, tags: SOURCE.tags.map((t) => (t[0] === 'names' ? ['names', 'tapestry work record', 'tapestry work records'] : t)) };
  const b = await run({ local: [onto] });
  assert(b.status === 400 && b.body.code === 'name-keyed', `nor onto such a name: ${show(b.body)}`);
  const cat = { ...LOCAL, id: '3'.repeat(64), tags: [['d', 'cat'], ['names', 'Cat', 'Cats']] };
  const catSource = { ...SOURCE, tags: SOURCE.tags.map((t) => (t[0] === 'names' ? ['names', 'cat', 'cats'] : t)) };
  const c = await run({ local: [catSource], others: [LOCAL, cat] });
  assert(c.status === 409 && c.body.code === 'name-taken' && c.body.coord === `39998:${ASSISTANT}:cat` && c.calls.signed.length === 0, show(c.body));
});

test('E7: a version the relay didn\'t keep is never claimed, and the graph isn\'t touched', async () => {
  const r = await run({ isStored: async () => false });
  assert(r.status === 502 && r.calls.imported.length === 0, `${r.status} ${show(r.body)}`);
  const wrongKey = await run({ sign: fakeSign(OTHER) });
  assert(wrongKey.status === 500 && wrongKey.calls.published.length === 0, show(wrongKey.body));
});

test('E8: an unverifiable header at the address is said so; another site is refused', async () => {
  const r = await run({ verify: (ev) => ev.id !== LOCAL.id });
  assert(r.status === 409 && r.body.code === 'unverified', show(r.body));
  const deps = {};
  let status = 0;
  await mod().createResyncConceptHandler({ ...deps, requireAuth: () => SESSION })({ headers: { host: 'here.example', origin: 'https://elsewhere.example' }, body: {} },
    { status(n) { status = n; return this; }, json() { return this; } });
  assert(status === 403, `another site: ${status}`);
});

test('E10: names or a description Edit would refuse are never signed, whoever wrote them (review 1, M1)', async () => {
  const bad = [['names', '', ''], ['names', 'GitHub ‮tnuoccA', 'GitHub Accounts'], ['names', 'Git\nHub', 'GitHub Accounts'], ['names', 'GitHub Account', '']];
  for (const names of bad) {
    const source = { ...SOURCE, tags: SOURCE.tags.map((t) => (t[0] === 'names' ? names : t)) };
    const r = await run({ local: [source] });
    assert(r.status === 400 && r.body.code === 'source-invalid' && r.calls.signed.length === 0, `${show(names)} → ${r.status} ${show(r.body)}`);
  }
  const padded = { ...SOURCE, tags: SOURCE.tags.map((t) => (t[0] === 'names' ? ['names', ' GitHub Account ', ' GitHub Accounts'] : t)) };
  const trimmed = await run({ local: [padded] });
  assert(trimmed.status === 200 && show(trimmed.calls.signed[0].template.tags.find((t) => t[0] === 'names')) === show(['names', 'GitHub Account', 'GitHub Accounts']),
    `padded names are signed trimmed, as Edit trims: ${show(trimmed.body).slice(0, 100)}`);
  const desc = { ...SOURCE, tags: SOURCE.tags.map((t) => (t[0] === 'description' ? ['description', 'bell\u0007'] : t)) };
  const r = await run({ local: [desc] });
  assert(r.status === 400 && r.body.code === 'source-invalid', show(r.body));
});

test('E11: a version that differs only in tag order is already in sync, as the page says', async () => {
  const { resyncedHeaderTags } = copy();
  const synced = { ...LOCAL, tags: resyncedHeaderTags({ local: LOCAL, source: SOURCE, target: SHARED }).slice().reverse() };
  const r = await run({ stored: [synced], body: { coord: COORD, basedOn: synced.id, copyFrom: SOURCE.id } });
  assert(r.status === 200 && r.body.unchanged === true && r.calls.signed.length === 0, show(r.body).slice(0, 120));
});

test('E9: the route is registered, and no auth list gates it to owners or customers', () => {
  const m = mod();
  assert(m.ROUTE === '/api/dictionaries/concepts/resync', m.ROUTE);
  assert(/require\('\.\/resyncConcept'\)\.register\(app\);/.test(code(src(ADOPTION_INDEX))), 'registered');
  // Re-aimed for security-auth-exposure #8 (ADR 0005): the auth middleware's hand-kept lists are gone; the route table
  // decides access. The route is an allowlisted signed-in action (the author's own concept header), so it must resolve
  // to 'signed-in'.
  const TABLE = path.join(ROOT, 'src/middleware/routeAccess.js');
  assert(fs.existsSync(TABLE), 'src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)');
  delete require.cache[require.resolve(TABLE)];
  const access = require(TABLE).resolveRouteAccess('POST', m.ROUTE);
  assert(access === 'signed-in', `ADR 0005: ${m.ROUTE} must resolve to 'signed-in'; got '${access}'`);
  assert(!/getOwnerAssistantKeys|getOwnerAssistantPubkey/.test(code(src(MODULE))), 'no owner-key helper');
});

// ═══ S — structural ═══════════════════════════════════════════════════════════

test('S1: Re-Sync sits beside Edit, on /dictionary only, for the reader\'s own Assistant\'s wired header', () => {
  assert(/editHref=\{dictionaryEditPath\} resync( dlistViews)? \/>/.test(flat(code(src(ENTRY_PAGE_JSX)))), '/dictionary asks for it');
  const body = flat(code(src(ENTRY_BODY_JSX)));
  assert(/editHref = null, resync = false,/.test(body), 'the control panel\'s entry page doesn\'t');
  assert(/const canResync = Boolean\(resync && canEdit && ev && ev\.pubkey === author && wiredTarget\(ev\)\);/.test(body), 'the condition');
  assert(/<DictIcon name="sync" \/> Re-Sync/.test(body) && /className="dict-pill-btn dict-pill-btn--quiet dict-entry-edit" aria-expanded=\{resyncOpen\}/.test(body),
    'a quiet pill, like Edit');
  assert(/onDone=\{resynced\}/.test(body) && /setFresh\(true\); header\.reload\(\); reloadDictionary\(\);/.test(body),
    'after a Re-Sync the page reads the header and the Dictionary again, and says what happened');
});

test('S2: the panel warns, summarises from the server\'s own rule, and names the versions it compared', () => {
  const s = flat(code(src(PANEL_JSX)));
  assert(/from '@tapestry\/concept-header-copy';/.test(s) && /resyncedHeaderTags\(\{ local: header, source: shared\.event, target \}\)/.test(s)
    && /tagDiff\(header\.tags, proposed\)/.test(s), 'the summary is the rule the server signs with');
  assert(/Re-Sync completely overwrites this concept’s header/.test(s), 'the overwrite warning');
  assert(/label="Tags removed"/.test(s) && /label="Tags added"/.test(s), 'the two lists');
  assert(/body: JSON\.stringify\(\{ coord, basedOn: header\.id, copyFrom: shared\.event\.id \}\)/.test(s), 'the request names both versions');
  assert(/const canResync = Boolean\(proposed\) && !invalid && !unchanged && !busy && !undelivered && shared\.done && !shared\.unreadable;/.test(s),
    'never before both versions are read, nor when nothing would change, nor with names the server would refuse');
});

test('S3: the panel handles each refusal, and broadcasts only what its Assistant signed', () => {
  const s = flat(code(src(PANEL_JSX)));
  assert(/if \(resp\.status === 409 && data\.code === 'changed'\) \{ onStale\('This concept changed after this page read it, so nothing was saved\./.test(s),
    'the local header changed: the page reads it again and says nothing was saved (review 1, S1)');
  assert(/if \(resp\.status === 409 && data\.code === 'source-missing'\) \{ shared\.reload\(\);/.test(s), 'the shared one changed: read it again');
  assert(/if \(!signed \|\| signed\.pubkey !== assistant\) \{/.test(s) && /outcomeMessage\(\{ outcome, verb: 'save' \}\)/.test(s), 'signature and broadcast outcome');
  assert(/\{firmware && \(/.test(s), 'the firmware warning');
});

test('S4: a changed header keeps the panel open with its note; Cancel after a saved version shows it; a reload keeps the header shown', () => {
  const body = flat(code(src(ENTRY_BODY_JSX)));
  assert(/const resyncStale = \(message\) => \{ setResyncNote\(message\); header\.reload\(\); \};/.test(body) && /note=\{resyncNote\}/.test(body),
    'the note lives on the page, so the panel, starting afresh on the new version, still says it (review 1, S1)');
  assert(/setState\(\(st\) => \(\{ event: version > 0 && st\.coord === coord \? st\.event : null, error: null, done: false, coord \}\)\);/.test(body),
    'a reload of the same address keeps the version shown; another address starts empty (review 2, R2-S1)');
  assert(/<ConceptEntryBody key=\{coord\} listHref/.test(flat(code(src(ENTRY_PAGE_JSX)))), 'one body per concept, so no state crosses entries (review 2, R2-S1)');
  const s = flat(code(src(PANEL_JSX)));
  assert(/onClick=\{undelivered \? \(\) => onDone\(undelivered\.leftAs\) : onCancel\}/.test(s), 'Cancel after a saved, undelivered version does what Done does (review 1, S2)');
  assert(/const leftAs = `Re-synced from \$\{sharedName\}\. Saved on this instance, but it didn’t reach the community relay\.\$\{graph === 'failed' \? ' This instance’s graph wasn’t fully updated/.test(s),
    'and the entry page isn\'t told to "try again" where it can\'t (review 2)');
  assert(/checkEditFields\(\{ singular: named\[1\], plural: named\[2\], description: described\[1\] \}\)\.error/.test(s), 'the page checks the names as the server does');
});

// ═══ runner ══════════════════════════════════════════════════════════════════

async function runAll() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\ndictionary-resync-concept: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run: runAll };
