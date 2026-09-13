/**
 * curated-dlist-update #5: Update list shows what my assistant would do, built only from reads it could complete.
 *
 * Story: engineering-team/stories/curated-dlist-update/5-update-list-preview.md
 * ADR:   engineering-team/decisions/curated-dlist-update/0005-update-preview-and-honest-reads.md (with Amendment 1)
 *
 * Classes (house pattern; the server half follows test/treasure-map-relay-presence.test.js):
 *   V (behavioral, server) — readRelayEvents(relayUrl, filter, { connect, verify, … }), driven through an injected
 *                            connect. A reachable relay gives every validly signed event; a refused connection, an
 *                            early close or a missing EOSE gives "unreachable", never an empty "ok". FAIL now: it
 *                            doesn't exist.
 *   F (behavioral, API)    — handleFetchExternalEvents(req, res, deps) in strict mode, with an injected readRelay.
 *                            The module loads without the container's nostr-tools / ws paths. FAIL now.
 *   U (behavioral, client) — ui/src/utils/treasureMap.js:
 *                            - the chunked, capped vote read;
 *                            - the items read's relayTruncated;
 *                            - candidateVerdicts' incomplete list, and the AC-5 invariant (a candidate's verdict is
 *                              the same judged alone or with every shared item);
 *                            - updatePlan.
 *                            FAIL now.
 *   S (structure)          — the strict opt-ins; useTrustWeights' two new errors; Update enabled on my own lists; the
 *                            preview's phrases; the items section's reads, its two verdict sets and the preview; the
 *                            detail page's headerState; nothing written. User-facing phrases are pinned as literals,
 *                            on whitespace-flattened source. FAIL now.
 *   D (docs)               — ADR 0005 §9's notes and OPEN.md row 280. FAIL now.
 *   R (sentinel)           — the presence probe, and Simple Lists' weights warning. PASS before and after.
 *
 * Re-aimed in their own suites (the test plan lists each), for the disabled Update placeholder this story replaces:
 * curated-dlist-update-curation-method S8, curated-dlist-update-read-only-curation S4 and R1, my-curated-dlists-items S3.
 *
 * Not covered here: the rendered preview in a browser, and a live refused connection (the Implementer's local check,
 * ADR note 10). Publishing is story 6.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const RELAY_SOURCE = path.join(ROOT, 'src/api/_shared/relaySource.js');
const FETCH_EVENTS = path.join(ROOT, 'src/api/relay/fetchEvents.js');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const ITEMS = path.join(UI, 'pages/grapevine/CuratedDListItems.jsx');
const PREVIEW = path.join(UI, 'pages/grapevine/UpdatePreview.jsx');
const DETAIL = path.join(UI, 'pages/grapevine/CuratedDListDetail.jsx');
const LIST_HOOK = path.join(UI, 'hooks/useListItems.js');
const VOTES_HOOK = path.join(UI, 'hooks/useItemVotes.js');
const WEIGHTS_HOOK = path.join(UI, 'hooks/useTrustWeights.js');
const SIMPLE = path.join(UI, 'pages/lists/DListItems.jsx');
const CDU_ADR_4 = path.join(ROOT, 'engineering-team/decisions/curated-dlist-update/0004-curation-method-and-verdicts.md');
const MCD_ADR_3 = path.join(ROOT, 'engineering-team/decisions/done/my-curated-dlists/0003-items-method-and-update.md');
const OPEN = path.join(ROOT, 'OPEN.md');

const A = 'a'.repeat(64);                     // my assistant
const AUTHOR = 'c'.repeat(64);                // the shared list's items' author
const OTHER = 'd'.repeat(64);                 // a voter, or someone else
const RELAY = 'wss://dcosl.brainstorm.world';
const DEAD = 'wss://dead.example';
const SHARED = `39998:${AUTHOR}:dog-breed`;
const MY = `39998:${A}:dog-breed`;
// The exact value nostr-tools throws on connect failure — a bare string, not an Error (the presence suite's M2).
const NT_CONNECT_THROW = 'Received network error or non-101 status code.';
const APOS = "(?:'|’|&apos;|&#39;)";          // an apostrophe as JSX may spell it

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function rel(p) { return path.relative(ROOT, p); }
const flat = (s) => s.replace(/\s+/g, ' ');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Deep equality that ignores key order and reads undefined as null. */
function canon(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v;
}
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const brief = (v) => { const s = JSON.stringify(v); return s && s.length > 400 ? `${s.slice(0, 400)}…` : s; };
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist (ADR 0005 §Implementation notes)`);
  return s;
}
/** The first `<Name …/>` element in a JSX source, whatever its line breaks. */
function element(s, name) {
  const m = s.match(new RegExp(`<${name}\\b[\\s\\S]*?\\/>`));
  return m ? m[0] : '';
}
/** A top-level function's text, from its declaration to the next top-level declaration. */
function declaration(s, name) {
  const start = s.search(new RegExp(`(?:^|\\n)(?:export\\s+)?(?:default\\s+)?function\\s+${name}\\b`));
  if (start < 0) return '';
  const rest = s.slice(start + 1);
  const next = rest.search(/\n(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s/);
  return s.slice(start, next >= 0 ? start + 1 + next : undefined);
}
/** Minimal express-ish res capturing status and json body. */
function fakeRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

function loadReader() {
  let mod;
  try { mod = require(RELAY_SOURCE); } catch (err) { throw new Error(`src/api/_shared/relaySource.js failed to load: ${err.message}`); }
  assert(typeof mod.readRelayEvents === 'function', 'ADR 0005 §1: src/api/_shared/relaySource.js must export readRelayEvents(relayUrl, filter, opts)');
  return mod.readRelayEvents;
}
function loadFetchHandler() {
  let mod;
  try { mod = require(FETCH_EVENTS); } catch (err) {
    throw new Error(`ADR 0005 §1: src/api/relay/fetchEvents.js must load without the container's nostr-tools and ws paths (their requires move into the non-strict path); loading it threw: ${String((err && err.message) || err).slice(0, 160)}`);
  }
  assert(typeof mod.handleFetchExternalEvents === 'function', 'src/api/relay/fetchEvents.js must export handleFetchExternalEvents(req, res, deps)');
  return mod.handleFetchExternalEvents;
}
async function util() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.classifyEntry === 'function', 'ui/src/utils/treasureMap.js must load and export classifyEntry');
  return mod;
}
async function fn(name) {
  const mod = await util();
  assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0005)`);
  return mod[name];
}

let seq = 0;
const hex = (n) => n.toString(16).padStart(64, '0');
const nid = () => hex(++seq);
function vote(id, target, pubkey = OTHER, content = '+') {
  return { id, kind: 7, pubkey, content, created_at: 5, sig: 's'.repeat(128), tags: [['e', target]] };
}
/** A shared-list item: kind 39999 with a d-tag (addressable), or kind 9999. */
function sharedItem(d, { kind = 39999, id = nid(), name = d || 'unnamed', createdAt = 100 } = {}) {
  const tags = [['z', SHARED], ['name', name]];
  if (kind === 39999) tags.unshift(['d', d]);
  return { id, kind, pubkey: AUTHOR, created_at: createdAt, content: '', sig: 's'.repeat(128), tags };
}
const dOf = (e) => (e.tags.find((t) => t[0] === 'd') || [])[1];
const route = (e) => (e.kind === 39999 && dOf(e) ? `39999:${e.pubkey}:${dOf(e)}` : e.id);
/** A copy (ADR 0001 §2–§5): my assistant's kind 39999 under my header, q-linked to its original. */
function copyOf(original, { versionId = original.id, pubkey = A, d = `copy-${nid().slice(-12)}` } = {}) {
  const tags = [['d', d], ['z', MY], ['name', (original.tags.find((t) => t[0] === 'name') || [])[1] || 'copy']];
  if (original.kind === 39999) tags.push(['q', route(original), RELAY]);
  tags.push(['q', versionId, RELAY, original.pubkey]);
  return { id: nid(), kind: 39999, pubkey, created_at: 200, content: '', sig: 's'.repeat(128), tags };
}
const wrap = (events) => events.map((event) => ({ event, local: true }));
const record = (events, over = {}) => ({ items: wrap(events), local: 'ok', relay: 'ok', truncated: false, total: events.length, relayTruncated: false, ...over });
function verdictsFor(entries, summary = {}) {
  const byRouteId = Object.fromEntries(entries.map(([e, verdict, score]) => [route(e), { verdict, score, breakdown: [], reason: null }]));
  const qualifying = entries.filter(([, v]) => v === 'qualifies').length;
  return { byRouteId, summary: { state: 'complete', qualifying, total: entries.length, reason: null, ...summary } };
}

/** A fake nostr-tools Relay: hands `events` to onevent then fires oneose (the presence suite's shape). */
function fakeRelay(events, opts = {}) {
  const rec = { closed: false, subClosed: false };
  rec.relay = {
    subscribe(filters, handlers) {
      rec.filters = filters;
      setImmediate(() => {
        if (opts.closeInstead) { if (handlers.onclose) handlers.onclose('relay said no'); return; }
        if (opts.silent) return; // never EOSEs — exercises the query timeout
        for (const e of events) if (handlers.onevent) handlers.onevent(e);
        if (handlers.oneose) handlers.oneose();
      });
      return { close() { rec.subClosed = true; } };
    },
    close() { rec.closed = true; },
  };
  return rec;
}
/** connect() that throws `failures` times (a bare string, like the real library), then succeeds. */
function flakyConnect(failures, relay) {
  const rec = { calls: 0 };
  rec.connect = async () => {
    rec.calls += 1;
    if (rec.calls <= failures) throw NT_CONNECT_THROW;
    return relay;
  };
  return rec;
}

const tests = [];
function test(name, f) { tests.push({ name, fn: f }); }

/* ── V: readRelayEvents (server) ───────────────────────────── */

test('V1: readRelayEvents — a reachable relay gives every validly signed event (not just the newest), until EOSE; the subscription and the relay are closed afterwards', async () => {
  const read = loadReader();
  const target = nid();
  const evs = [vote(nid(), target), vote(nid(), target, B_PUB()), vote(nid(), target)];
  const r = fakeRelay(evs);
  const out = await read(RELAY, { kinds: [7], '#e': [target] }, { connect: async () => r.relay, verify: () => true });
  assert(out && out.status === 'ok', `ADR 0005 §1: status "ok"; got ${brief(out)}`);
  assert(Array.isArray(out.events) && same(out.events.map((e) => e.id), evs.map((e) => e.id)), `ADR 0005 §1: every event, in order; got ${brief(out.events && out.events.map((e) => e.id))}`);
  assert(!out.error, `ADR 0005 §1: no error on a clean read; got ${brief(out.error)}`);
  assert(r.subClosed && r.closed, 'ADR 0005 §1: the subscription and the relay are closed afterwards');
  const empty = fakeRelay([]);
  const none = await read(RELAY, { kinds: [7], '#e': [target] }, { connect: async () => empty.relay, verify: () => true });
  assert(none && none.status === 'ok' && Array.isArray(none.events) && none.events.length === 0, `ADR 0005 §1: a reachable relay holding nothing is "ok" with no events, not "unreachable"; got ${brief(none)}`);
});

test('V2: readRelayEvents — a refused connection is "unreachable", with a readable error, after exactly one retry; a relay that fails once and then connects is read', async () => {
  const read = loadReader();
  const dead = flakyConnect(99, null);
  const out = await read(DEAD, { kinds: [7], '#e': [nid()] }, { connect: dead.connect, verify: () => true });
  assert(out && out.status === 'unreachable', `ADR 0005 §1 / row 280: a refused connection is "unreachable", never an empty "ok"; got ${brief(out)}`);
  assert(Array.isArray(out.events) && out.events.length === 0, 'ADR 0005 §1: no events when unreachable');
  assert(typeof out.error === 'string' && out.error.length > 0 && !/^undefined$/i.test(out.error), `the bare-string throw is normalized into a readable error; got ${brief(out.error)}`);
  assert(dead.calls === 2, `ADR 0005 §1: one bounded retry — expected 2 connect attempts, got ${dead.calls}`);
  const rec = fakeRelay([vote(nid(), nid())]);
  const flaky = flakyConnect(1, rec.relay);
  const ok = await read(RELAY, { kinds: [7] }, { connect: flaky.connect, verify: () => true });
  assert(ok.status === 'ok' && ok.events.length === 1 && flaky.calls === 2, `ADR 0005 §1: a relay that throws once then connects is read; got ${brief(ok)} after ${flaky.calls} attempts`);
});

test('V3: readRelayEvents — a subscription the relay closes before EOSE, or no EOSE within the budget, is "unreachable"', async () => {
  const read = loadReader();
  const closing = fakeRelay([], { closeInstead: true });
  let out = await read(RELAY, { kinds: [7] }, { connect: async () => closing.relay, verify: () => true });
  assert(out && out.status === 'unreachable', `ADR 0005 §1: an early close is "unreachable" — not an empty "ok"; got ${brief(out)}`);
  const silent = fakeRelay([], { silent: true });
  out = await read(RELAY, { kinds: [7] }, { connect: async () => silent.relay, verify: () => true, queryTimeoutMs: 30 });
  assert(out && out.status === 'unreachable', `ADR 0005 §1: no EOSE inside the budget is "unreachable"; got ${brief(out)}`);
});

test('V4: readRelayEvents — events with a bad signature or the wrong kind are dropped; an author outside the filter\'s authors is dropped, while a filter with no authors keeps any author', async () => {
  const read = loadReader();
  const good = vote(nid(), nid());
  const forged = { ...vote(nid(), nid()), id: 'f'.repeat(64) };
  const wrongKind = { ...vote(nid(), nid()), kind: 1 };
  const r = fakeRelay([good, forged, wrongKind]);
  const out = await read(RELAY, { kinds: [7] }, { connect: async () => r.relay, verify: (e) => e.id !== forged.id });
  assert(out.status === 'ok' && same(out.events.map((e) => e.id), [good.id]), `ADR 0005 §1: only validly signed events of the asked kind; got ${brief(out.events.map((e) => e.id))}`);
  const byAuthor = vote(nid(), nid(), AUTHOR);
  const byOther = vote(nid(), nid(), OTHER);
  const r2 = fakeRelay([byAuthor, byOther]);
  const withAuthors = await read(RELAY, { kinds: [7], authors: [AUTHOR] }, { connect: async () => r2.relay, verify: () => true });
  assert(same(withAuthors.events.map((e) => e.id), [byAuthor.id]), `ADR 0005 §1: authors are re-checked when the filter names them; got ${brief(withAuthors.events.map((e) => e.id))}`);
  const r3 = fakeRelay([byAuthor, byOther]);
  const anyAuthor = await read(RELAY, { kinds: [7] }, { connect: async () => r3.relay, verify: () => true });
  assert(anyAuthor.events.length === 2, 'ADR 0005 §1: with no authors in the filter, votes from anyone are kept (principle 2)');
});

/* ── F: /api/relay/external in strict mode ─────────────────── */

const strictReq = (relays, over = {}) => ({ query: { filter: JSON.stringify({ kinds: [7], '#e': [nid()] }), relays: relays.join(','), strict: '1', ...over } });

test('F1: fetchEvents.js loads without the container\'s nostr-tools and ws paths, and exports handleFetchExternalEvents(req, res, deps)', () => {
  loadFetchHandler();
});

test('F2: strict mode — when every relay is unreachable the answer is success: false, with no events, an error naming them, and the unreachable list', async () => {
  const handler = loadFetchHandler();
  const res = fakeRes();
  await handler(strictReq([RELAY, DEAD]), res, { readRelay: async (url) => ({ status: 'unreachable', events: [], error: `refused ${url}` }) });
  const b = res.body || {};
  assert(b.success === false, `ADR 0005 §1 / row 280: every relay unreachable → success: false, never "success, no events"; got ${brief(b)}`);
  assert(Array.isArray(b.events) && b.events.length === 0, 'ADR 0005 §1: no events');
  assert(typeof b.error === 'string' && /Could not read/.test(b.error), `ADR 0005 §1: the error says "Could not read <relay>: <reason>"; got ${brief(b.error)}`);
  assert(Array.isArray(b.unreachable) && b.unreachable.includes(RELAY) && b.unreachable.includes(DEAD), `ADR 0005 §1: both relays listed as unreachable; got ${brief(b.unreachable)}`);
});

test('F3: strict mode — with one relay read and one unreachable, the answer is success: true, the read relay\'s events, and the unreachable one listed; events are merged by id across relays', async () => {
  const handler = loadFetchHandler();
  const e1 = vote(nid(), nid()); const e2 = vote(nid(), nid()); const e3 = vote(nid(), nid());
  let res = fakeRes();
  await handler(strictReq([RELAY, DEAD]), res, { readRelay: async (url) => (url === DEAD ? { status: 'unreachable', events: [], error: 'refused' } : { status: 'ok', events: [e1, e2], error: null }) });
  let b = res.body || {};
  assert(b.success === true && same((b.events || []).map((e) => e.id), [e1.id, e2.id]), `ADR 0005 §1: the reachable relay's events; got ${brief(b)}`);
  assert(Array.isArray(b.unreachable) && same(b.unreachable, [DEAD]), `ADR 0005 §1: the unreachable relay is listed; got ${brief(b.unreachable)}`);
  res = fakeRes();
  const other = 'wss://other.example';
  await handler(strictReq([RELAY, other]), res, { readRelay: async (url) => ({ status: 'ok', events: url === RELAY ? [e1, e2] : [e2, e3], error: null }) });
  b = res.body || {};
  const ids = (b.events || []).map((e) => e.id).sort();
  assert(b.success === true && same(ids, [e1.id, e2.id, e3.id].sort()), `ADR 0005 §1: events merged by id — each once; got ${brief(ids)}`);
});

test('F4: strict mode skips relays that are not ws/wss, and without strict the injected strict reader is never used', async () => {
  const handler = loadFetchHandler();
  const asked = [];
  let res = fakeRes();
  await handler(strictReq([RELAY, 'https://not-a-relay.example']), res, { readRelay: async (url) => { asked.push(url); return { status: 'ok', events: [], error: null }; } });
  assert(same(asked, [RELAY]), `only ws/wss relays are read; got ${brief(asked)}`);
  let used = false;
  res = fakeRes();
  try {
    await handler({ query: { filter: JSON.stringify({ kinds: [7] }), relays: RELAY } }, res, { readRelay: async () => { used = true; return { status: 'ok', events: [], error: null }; } });
  } catch { /* the non-strict path needs the container's nostr-tools; what it does here is not this test's concern */ }
  assert(!used, 'ADR 0005 §1: without strict the endpoint is unchanged — the strict reader is not used');
});

test('F5: the endpoint\'s validation is unchanged — a missing filter, invalid JSON, missing relays or no ws/wss relay answer 400', async () => {
  const handler = loadFetchHandler();
  const cases = [
    [{ relays: RELAY, strict: '1' }, 'a missing filter'],
    [{ filter: '{not json', relays: RELAY, strict: '1' }, 'invalid JSON'],
    [{ filter: JSON.stringify({ kinds: [7] }), strict: '1' }, 'missing relays'],
    [{ filter: JSON.stringify({ kinds: [7] }), relays: 'https://x.example', strict: '1' }, 'no ws/wss relay'],
  ];
  for (const [query, why] of cases) {
    const res = fakeRes();
    await handler({ query }, res, { readRelay: async () => ({ status: 'ok', events: [], error: null }) });
    assert(res.statusCode === 400 && res.body && res.body.success === false, `${why} → 400, success: false; got ${res.statusCode} ${brief(res.body)}`);
  }
});

/* ── U: the curation util ──────────────────────────────────── */

test('U1: lookupItemVotes reads the ids in chunks of VOTES_IDS_PER_READ = 50 — the same chunks to each source, every id once, each chunk one filter { kinds: [7], "#e": chunk, limit: VOTES_LIMIT } — and merges the answers by id', async () => {
  const mod = await util();
  assert(mod.VOTES_IDS_PER_READ === 50, `ADR 0005 §3: VOTES_IDS_PER_READ = 50; got ${brief(mod.VOTES_IDS_PER_READ)}`);
  const lookupItemVotes = await fn('lookupItemVotes');
  const ids = Array.from({ length: 120 }, () => nid());
  const local = []; const relay = [];
  const res = await lookupItemVotes(ids, {
    scanLocal: async (f) => { local.push(f); return { events: [vote(nid(), f['#e'][0])], truncated: false, total: 1 }; },
    fetchRelay: async (f, url) => { relay.push([f, url]); return { success: true, events: [vote(nid(), f['#e'][0])] }; },
  }, RELAY);
  const sizes = (fs2) => fs2.map((f) => f['#e'].length).sort((x, y) => x - y);
  assert(same(sizes(local), [20, 50, 50]) && same(sizes(relay.map((c) => c[0])), [20, 50, 50]), `ADR 0005 §3: 120 ids → chunks of 50, 50 and 20 to each source; got local ${brief(sizes(local))}, relay ${brief(sizes(relay.map((c) => c[0])))}`);
  const union = (fs2) => fs2.flatMap((f) => f['#e']).sort();
  assert(same(union(local), [...ids].sort()) && same(union(relay.map((c) => c[0])), [...ids].sort()), 'ADR 0005 §3: every id is asked once of each source');
  assert(local.every((f) => same(f.kinds, [7]) && f.limit === 5000) && relay.every(([f, url]) => same(f.kinds, [7]) && f.limit === 5000 && url === RELAY),
    'ADR 0005 §3: each chunk is { kinds: [7], "#e": chunk, limit: VOTES_LIMIT } — to the community relay for the relay half');
  assert(res && Array.isArray(res.events) && res.events.length === 6 && res.local === 'ok' && res.relay === 'ok' && res.truncated === false,
    `ADR 0005 §3: the six answers merged, both sources ok, not truncated; got ${brief(res && { n: res.events && res.events.length, local: res.local, relay: res.relay, truncated: res.truncated })}`);
  for (const [n, want] of [[50, 1], [51, 2]]) {
    let calls = 0;
    await lookupItemVotes(Array.from({ length: n }, () => nid()), { scanLocal: async () => { calls += 1; return { events: [], truncated: false }; }, fetchRelay: async () => ({ success: true, events: [] }) }, RELAY);
    assert(calls === want, `ADR 0005 §3: ${n} ids → ${want} local read(s); got ${calls}`);
  }
});

test('U2: lookupItemVotes — a failed chunk fails its source; a capped chunk (the local scan says so, or a relay answers with VOTES_LIMIT votes) marks the read truncated', async () => {
  const lookupItemVotes = await fn('lookupItemVotes');
  const ids = Array.from({ length: 120 }, () => nid());
  const okLocal = async () => ({ events: [], truncated: false, total: 0 });
  const okRelay = async () => ({ success: true, events: [] });
  let r = await lookupItemVotes(ids, { scanLocal: async (f) => { if (f['#e'].includes(ids[60])) throw new Error('strfry down'); return { events: [], truncated: false }; }, fetchRelay: okRelay }, RELAY);
  assert(r.local === 'failed' && r.relay === 'ok', `ADR 0005 §3: one failed local chunk fails the local source; got ${brief({ local: r.local, relay: r.relay })}`);
  r = await lookupItemVotes(ids, { scanLocal: okLocal, fetchRelay: async (f) => (f['#e'].includes(ids[110]) ? { success: false, events: [], error: 'Could not read' } : { success: true, events: [] }) }, RELAY);
  assert(r.relay === 'failed' && r.local === 'ok', `ADR 0005 §3: one unsuccessful relay chunk fails the relay source; got ${brief({ local: r.local, relay: r.relay })}`);
  r = await lookupItemVotes(ids, { scanLocal: async (f) => ({ events: [], truncated: f['#e'].includes(ids[0]) }), fetchRelay: okRelay }, RELAY);
  assert(r.truncated === true, 'ADR 0005 §3: a capped local chunk marks the read truncated');
  const full = Array.from({ length: 5000 }, (_, i) => vote(hex(1e9 + i), ids[0]));
  r = await lookupItemVotes(ids.slice(0, 10), { scanLocal: okLocal, fetchRelay: async () => ({ success: true, events: full }) }, RELAY);
  assert(r.truncated === true, 'ADR 0005 §3 / review 4 Non-blocking 3: a relay chunk answering with VOTES_LIMIT votes is capped — truncated');
  r = await lookupItemVotes(ids.slice(0, 10), { scanLocal: okLocal, fetchRelay: async () => ({ success: true, events: full.slice(0, 4999) }) }, RELAY);
  assert(r.truncated === false, 'ADR 0005 §3: 4,999 votes from the relay is not capped');
});

test('U3: lookupListItems reports relayTruncated when the relay answers with LIST_ITEMS_LIMIT items or more — not below, and not when the relay failed', async () => {
  const mod = await util();
  const lookupListItems = await fn('lookupListItems');
  const many = (n) => Array.from({ length: n }, (_, i) => sharedItem(`item-${i}`));
  const emptyLocal = async () => ({ events: [], truncated: false, total: 0 });
  let out = await lookupListItems([SHARED], { scanLocal: emptyLocal, fetchRelay: async () => ({ success: true, events: many(mod.LIST_ITEMS_LIMIT) }) }, RELAY);
  assert(out[SHARED] && out[SHARED].relayTruncated === true, `ADR 0005 §4: ${mod.LIST_ITEMS_LIMIT} items from the relay → relayTruncated; got ${brief(out[SHARED] && out[SHARED].relayTruncated)}`);
  out = await lookupListItems([SHARED], { scanLocal: emptyLocal, fetchRelay: async () => ({ success: true, events: many(mod.LIST_ITEMS_LIMIT - 1) }) }, RELAY);
  assert(out[SHARED].relayTruncated === false, `ADR 0005 §4: fewer than the limit is not capped; got ${brief(out[SHARED].relayTruncated)}`);
  out = await lookupListItems([SHARED], { scanLocal: emptyLocal, fetchRelay: async () => { throw new Error('offline'); } }, RELAY);
  assert(out[SHARED].relay === 'failed' && !out[SHARED].relayTruncated, 'ADR 0005 §4: a failed relay read is failed, not capped');
});

// Two candidates under Trust Everyone: akita = 1 (author) + 1 (an upvote) = 2; beagle = 1.
const K1 = sharedItem('akita');
const K2 = sharedItem('beagle');
const WEIGHTS = { state: 'ready', values: { [AUTHOR]: 1, [OTHER]: 1 }, error: null };
const OKV = { local: 'ok', relay: 'ok', truncated: false };

test('U4: candidateVerdicts — an incomplete list keeps each decided verdict but makes the summary incomplete, naming those reads; an empty list changes nothing; pending votes still read "checking"', async () => {
  const candidateVerdicts = await fn('candidateVerdicts');
  const votes = { events: [vote(nid(), K1.id)], ...OKV };
  const partial = candidateVerdicts({ candidates: [K1, K2], votes, weights: WEIGHTS, cutoff: 2, incomplete: ['the shared list on the community relay'] });
  const v1 = partial.byRouteId && partial.byRouteId[route(K1)]; const v2 = partial.byRouteId && partial.byRouteId[route(K2)];
  assert(v1 && v1.verdict === 'qualifies' && v1.score === 2 && v2 && v2.verdict === 'skipped' && v2.score === 1, `ADR 0005 §6: the candidates that were read keep their verdicts; got ${brief([v1, v2])}`);
  assert(partial.summary && partial.summary.state === 'incomplete' && typeof partial.summary.reason === 'string' && partial.summary.reason.includes('the shared list on the community relay'),
    `ADR 0005 §6 / AC-5: the summary is incomplete and names the read; got ${brief(partial.summary)}`);
  const clean = candidateVerdicts({ candidates: [K1, K2], votes, weights: WEIGHTS, cutoff: 2, incomplete: [] });
  assert(clean.summary.state === 'complete' && clean.summary.qualifying === 1, `ADR 0005 §6: an empty list changes nothing; got ${brief(clean.summary)}`);
  const pending = candidateVerdicts({ candidates: [K1, K2], votes: null, weights: WEIGHTS, cutoff: 2, incomplete: ['the shared list on the community relay'] });
  assert(pending.summary.state === 'checking', `ADR 0004 §4: pending votes still read "checking" first; got ${brief(pending.summary)}`);
  for (const g of ['x', null, 7, [null, 3]]) {
    let out;
    try { out = candidateVerdicts({ candidates: [K1], votes, weights: WEIGHTS, cutoff: 2, incomplete: g }); } catch (e) { throw new Error(`never throws — threw on incomplete ${brief(g)}: ${e.message}`); }
    assert(out && out.summary && typeof out.summary.state === 'string', `garbage incomplete still gives a summary; got ${brief(out)}`);
  }
});

test('U5: AC-5 — a candidate\'s verdict is the same judged with the candidates alone or with every shared item (the preview\'s set), even when a vote names both', async () => {
  const candidateVerdicts = await fn('candidateVerdicts');
  const O1 = sharedItem('corgi'); const O2 = sharedItem('dingo');
  const votes = { events: [vote(nid(), K1.id), vote(nid(), O1.id), { ...vote(nid(), O1.id), tags: [['e', O1.id], ['e', K2.id]] }, vote(nid(), O2.id, OTHER, '-')], ...OKV };
  const alone = candidateVerdicts({ candidates: [K1, K2], votes, weights: WEIGHTS, cutoff: 2 });
  const all = candidateVerdicts({ candidates: [K1, K2, O1, O2], votes, weights: WEIGHTS, cutoff: 2 });
  for (const k of [K1, K2]) {
    assert(same(alone.byRouteId[route(k)], all.byRouteId[route(k)]), `AC-5 / ADR 0005 §8: ${route(k)} is judged the same either way; alone ${brief(alone.byRouteId[route(k)])}, with all ${brief(all.byRouteId[route(k)])}`);
  }
});

// The planner's fixture: two candidates, and my copies in every state (ADR 0001 §5's q forms).
const S1 = sharedItem('akita');                                  // candidate, qualifies → copy
const S2 = sharedItem('beagle');                                 // candidate, skipped → skipped
const S3a = sharedItem('corgi', { createdAt: 100 });             // the version my assistant copied
const S3b = sharedItem('corgi', { createdAt: 300 });             // its current version (edited), qualifies → refresh
const S4 = sharedItem('dingo');                                  // copied as is, skipped → delete
const S5a = sharedItem('eskimo', { createdAt: 100 });
const S5b = sharedItem('eskimo', { createdAt: 300 });            // edited, skipped → keep, flagged
const S6 = sharedItem(null, { kind: 9999, name: 'fox terrier' }); // a kind-9999 original, qualifies → unchanged
const GONE = sharedItem('gone');                                 // not on the shared list any more → keep, flagged
const M3 = copyOf(S3b, { versionId: S3a.id });
const M4 = copyOf(S4);
const M5 = copyOf(S5b, { versionId: S5a.id });
const M6 = copyOf(S6);
const M7 = copyOf(GONE);
const M8 = { id: nid(), kind: 39999, pubkey: A, created_at: 200, content: '', sig: 's'.repeat(128), tags: [['d', 'hand-added'], ['z', MY], ['name', 'hand added']] }; // mine, no q: not a copy
const O1c = copyOf(S1, { pubkey: OTHER });                       // someone else's copy of S1: S1 stays a candidate
const HEADER_OK = { state: null, olderLink: true, problems: [] };
function planInput(over = {}) {
  return {
    assistantPubkey: A,
    header: HEADER_OK,
    mine: record([M3, M4, M5, M6, M7, M8, O1c]),
    shared: record([S1, S2, S3b, S4, S5b, S6]),
    verdicts: verdictsFor([[S1, 'qualifies', 2], [S2, 'skipped', 1], [S3b, 'qualifies', 3], [S4, 'skipped', 0.5], [S5b, 'skipped', 1], [S6, 'qualifies', 2.5]]),
    ...over,
  };
}
const proposes = (p) => !!p && ((p.copy || []).length + (p.refresh || []).length + (p.delete || []).length > 0 || p.upgrade === true);

test('U6: updatePlan — ready: copy the qualifying candidates, skip the rest with their scores; refresh an edited copy whose new version qualifies; delete an unedited copy that no longer qualifies; keep, flagged, an edited copy that doesn\'t qualify and one whose original is gone; count the unchanged; the older header upgrades', async () => {
  const updatePlan = await fn('updatePlan');
  const p = updatePlan(planInput());
  assert(p && p.state === 'ready', `ADR 0005 §7: every read complete → "ready"; got ${brief(p && { state: p.state, reasons: p.reasons })}`);
  assert(Array.isArray(p.copy) && same(p.copy.map((e) => e.routeId), [route(S1)]) && p.copy[0].name === 'akita' && p.copy[0].score === 2,
    `AC-3: copy — the qualifying candidate, named, with its score (someone else's copy doesn't count); got ${brief(p.copy)}`);
  assert(Array.isArray(p.skipped) && same(p.skipped.map((e) => e.routeId), [route(S2)]) && p.skipped[0].name === 'beagle' && p.skipped[0].score === 1,
    `AC-3: skipped — the candidate that doesn't qualify, with its score; got ${brief(p.skipped)}`);
  assert(Array.isArray(p.refresh) && p.refresh.length === 1 && p.refresh[0].copyRouteId === route(M3) && p.refresh[0].routeId === route(S3b),
    `AC-3 / gate decision 3: refresh — the copy of an edited original whose new version qualifies; got ${brief(p.refresh)}`);
  assert(Array.isArray(p.delete) && p.delete.length === 1 && p.delete[0].copyRouteId === route(M4) && p.delete[0].routeId === route(S4),
    `AC-3: delete — the copy whose unedited original no longer qualifies; got ${brief(p.delete)}`);
  const kept = Object.fromEntries((p.keepFlagged || []).map((e) => [e.copyRouteId, e.why]));
  assert(same(kept, { [route(M5)]: 'edited-not-qualifying', [route(M7)]: 'not-found' }),
    `AC-3 / gate decision 3: keep, flagged — the edited copy whose new version doesn't qualify (never deleted for an edit), and the copy whose original is gone; got ${brief(p.keepFlagged)}`);
  assert(p.unchanged === 1, `ADR 0005 §7: the kind-9999 copy whose original qualifies stays unchanged (never "edited"); got ${brief(p.unchanged)}`);
  assert(p.upgrade === true, 'AC-3: my header uses the older link → upgrade');
  assert(p.upToDate === false, 'AC-3: there is something to do');
  assert(!(p.delete || []).some((e) => e.copyRouteId === route(M8)) && !(p.keepFlagged || []).some((e) => e.copyRouteId === route(M8)),
    'ADR 0005 §7: an item of my assistant\'s with no q is not a copy — the plan leaves it alone');
});

test('U7: updatePlan — blocked, proposing nothing, with the reason, when any read is incomplete: the header (failed, missing, no shared list, unaffiliated, a problem), my list or the shared list (a source failed, or cut off), or the verdicts', async () => {
  const updatePlan = await fn('updatePlan');
  const base = planInput();
  const CASES = [
    [{ header: { state: 'failed', olderLink: false, problems: [] } }, 'the header couldn\'t be checked'],
    [{ header: { state: 'missing', olderLink: false, problems: [] } }, 'the header wasn\'t found'],
    [{ header: { state: 'no-pointer', olderLink: false, problems: [] } }, 'the header names no shared list'],
    [{ header: { state: 'deferred', olderLink: false, problems: [] } }, 'the header is deliberately unaffiliated'],
    [{ header: { state: null, olderLink: false, problems: ['wrong-type'] } }, 'the header has a problem other than the older link'],
    [{ mine: record([M4], { local: 'failed' }) }, 'my list on this instance\'s strfry failed'],
    [{ mine: record([M4], { relay: 'failed' }) }, 'my list on the community relay failed'],
    [{ mine: record([M4], { truncated: true }) }, 'my list was cut off locally'],
    [{ mine: record([M4], { relayTruncated: true }) }, 'my list was cut off on the relay'],
    [{ shared: record([S1, S4], { local: 'failed' }) }, 'the shared list on this instance\'s strfry failed'],
    [{ shared: record([S1, S4], { relay: 'failed' }) }, 'the shared list on the community relay failed'],
    [{ shared: record([S1, S4], { truncated: true }) }, 'the shared list was cut off locally'],
    [{ shared: record([S1, S4], { relayTruncated: true }) }, 'the shared list was cut off on the relay'],
    [{ verdicts: verdictsFor([[S1, 'unchecked', null]], { state: 'incomplete', reason: 'the community relay' }) }, 'the votes or weights couldn\'t be read'],
  ];
  for (const [over, why] of CASES) {
    const p = updatePlan({ ...base, ...over });
    assert(p && p.state === 'blocked', `AC-4 / ADR 0005 §7: ${why} → "blocked"; got ${brief(p && { state: p.state, reasons: p.reasons })}`);
    assert(Array.isArray(p.reasons) && p.reasons.length >= 1 && p.reasons.every((r) => typeof r === 'string' && r.length > 0), `AC-4: it says what couldn't be read (${why}); got ${brief(p.reasons)}`);
    assert(!proposes(p), `AC-4 / gate decision 2: ${why} → no copy, refresh, deletion or upgrade; got ${brief({ copy: p.copy, refresh: p.refresh, delete: p.delete, upgrade: p.upgrade })}`);
  }
  const two = updatePlan({ ...base, mine: record([M4], { local: 'failed' }), verdicts: verdictsFor([[S1, 'unchecked', null]], { state: 'incomplete', reason: 'the community relay' }) });
  assert(two.state === 'blocked' && two.reasons.length >= 2, `ADR 0005 §7: blocked "with every reason" — two failures, two reasons; got ${brief(two.reasons)}`);
});

test('U8: updatePlan — "checking" while a read is in flight (the header, either list, the verdicts); a header that leaves no shared list to read blocks at once, even with reads pending (Amendment 1)', async () => {
  const updatePlan = await fn('updatePlan');
  const base = planInput();
  for (const [over, why] of [
    [{ header: { state: 'checking', olderLink: false, problems: [] } }, 'the header still checking'],
    [{ mine: undefined }, 'my list not read yet'],
    [{ shared: undefined }, 'the shared list not read yet'],
    [{ verdicts: null }, 'the verdicts not computed yet'],
    [{ verdicts: verdictsFor([[S1, 'checking', null]], { state: 'checking' }) }, 'the votes or weights still checking'],
  ]) {
    const p = updatePlan({ ...base, ...over });
    assert(p && p.state === 'checking', `ADR 0005 §7: ${why} → "checking"; got ${brief(p && { state: p.state, reasons: p.reasons })}`);
    assert(!proposes(p), `ADR 0005 §7: ${why} → nothing proposed yet`);
  }
  for (const state of ['failed', 'missing', 'no-pointer', 'deferred']) {
    const p = updatePlan({ ...base, header: { state, olderLink: false, problems: [] }, shared: undefined, verdicts: null });
    assert(p && p.state === 'blocked' && p.reasons.length >= 1, `ADR 0005 Amendment 1: a "${state}" header blocks at once — the shared list will never be read, so "checking" would never end; got ${brief(p && { state: p.state, reasons: p.reasons })}`);
  }
  const failedList = updatePlan({ ...base, shared: record([S1, S4], { relay: 'failed' }), verdicts: null });
  assert(failedList && failedList.state === 'blocked' && failedList.reasons.length >= 1,
    `ADR 0005 Amendment 1: a list read that failed blocks without waiting for the verdicts that depend on it; got ${brief(failedList && { state: failedList.state, reasons: failedList.reasons })}`);
});

test('U9: updatePlan — up to date when there is nothing to do (skipped candidates and kept copies are not things to do); garbage never throws and never proposes', async () => {
  const updatePlan = await fn('updatePlan');
  const quiet = updatePlan(planInput({
    header: { state: null, olderLink: false, problems: [] },
    mine: record([M6, M7]),
    shared: record([S2, S6]),
    verdicts: verdictsFor([[S2, 'skipped', 1], [S6, 'qualifies', 2.5]]),
  }));
  assert(quiet.state === 'ready' && quiet.upToDate === true, `AC-3: nothing to copy, refresh, delete or upgrade → up to date; got ${brief(quiet && { state: quiet.state, upToDate: quiet.upToDate, copy: quiet.copy, delete: quiet.delete })}`);
  assert(same((quiet.skipped || []).map((e) => e.routeId), [route(S2)]) && (quiet.keepFlagged || []).length === 1 && quiet.unchanged === 1,
    `AC-3: the skipped candidate and the kept copy still show; got ${brief({ skipped: quiet.skipped, keepFlagged: quiet.keepFlagged, unchanged: quiet.unchanged })}`);
  for (const g of [undefined, null, {}, { mine: 'x', shared: 5, verdicts: 'y', header: null },
    { ...planInput(), mine: { items: [null, 7, { event: null }, { event: { tags: 'x' } }], local: 'ok', relay: 'ok' } }]) {
    let out;
    try { out = updatePlan(g); } catch (e) { throw new Error(`ADR 0005 §7: never throws — threw on ${brief(g)}: ${e.message}`); }
    assert(out && ['checking', 'blocked', 'ready'].includes(out.state), `ADR 0005 §7: garbage still gives a state; got ${brief(out)}`);
    if (g === undefined || g === null || !g.mine || typeof g.mine !== 'object') assert(!proposes(out), `garbage proposes nothing; got ${brief(out)}`);
  }
});

/* ── S: structure ──────────────────────────────────────────── */

test('S1: the curation reads opt into the strict relay read — useListItems\' and useItemVotes\' relay fetches carry strict=1', () => {
  for (const f of [LIST_HOOK, VOTES_HOOK]) {
    const s = src(f);
    assert(/\/api\/relay\/external\?[^`'"]*strict=1/.test(s) || /strict=1[^`'"]*/.test(s) && /\/api\/relay\/external/.test(s), `ADR 0005 §2: ${rel(f)} asks /api/relay/external with strict=1`);
  }
});

test('S2: useTrustWeights — the rank read is strict and an unsuccessful answer is an error; a Follow List point of view with no follow list here is an error, with the weights left at 0 (AC-6: Simple Lists\' scores don\'t move)', () => {
  const s = src(WEIGHTS_HOOK); const f = flat(s);
  assert(/strict=1/.test(s), 'ADR 0005 §5: the rank read asks /api/relay/external with strict=1');
  assert(new RegExp(`Couldn${APOS}t read the rank provider`).test(f), 'ADR 0005 §5: an unsuccessful rank read sets the error "Couldn\'t read the rank provider <relay>: <error>"');
  assert(new RegExp(`No follow list for the point of view in this instance${APOS}s strfry`).test(f), 'ADR 0005 §5 / review 4 Non-blocking 2a: no kind 3 for the point of view here is an error');
  assert(/followSet\.has\(\s*pk\s*\)\s*\?\s*1\s*:\s*0/.test(s), 'ADR 0005 §5: the Follow List weights are still 1 or 0 — scores don\'t move');
});

test('S3: relaySource names its fourth querySync-shaped helper and its distinct outcome; fetchEvents keeps querySync for the non-strict path', () => {
  const r = src(RELAY_SOURCE);
  assert(/\b(?:four|FOUR)\b querySync-shaped helpers/.test(r), 'ADR 0005 §1: the helpers comment now counts four, and says what readRelayEvents is for');
  const s = src(FETCH_EVENTS);
  assert(/querySync\(/.test(s) && /\bstrict\b/.test(s), 'ADR 0005 §1: the non-strict path still uses querySync; strict mode is handled');
});

test('S4: UpdateListButton — on my own lists an enabled button that opens the preview (onToggle); read-only lists keep the disabled button; the "isn\'t built yet" line is gone', () => {
  const s = src(ITEMS); const f = flat(s);
  const decl = declaration(s, 'UpdateListButton');
  const sig = (decl.match(/function\s+UpdateListButton\s*\(\s*\{([^}]*)\}/) || [])[1] || '';
  assert(/\bonToggle\b/.test(sig) && /\bopen\b/.test(sig) && /\bcurator\b/.test(sig) && /\bcanCurateHere\b/.test(sig), `ADR 0005 §8: UpdateListButton({ curator, canCurateHere, open, onToggle }); got {${sig}}`);
  assert(/onClick=\{\s*(?:onToggle|\(\)\s*=>\s*onToggle)/.test(decl), 'ADR 0005 §8 / AC-1: on my own lists the button opens the preview (onClick={onToggle})');
  assert(/\bdisabled\b/.test(decl), 'AC-1 / story 3: a read-only list keeps a disabled Update list');
  assert(!new RegExp(`Update list isn${APOS}t built yet`).test(f), 'ADR 0005 §8: the placeholder line is gone from the items module');
});

test('S5: UpdatePreview — the method line, the states, the six groups and their words, "up to date", and "Nothing is signed: publishing isn\'t built yet."', () => {
  const s = src(PREVIEW); const f = flat(s);
  assert(/export\s+default\s+function\s+UpdatePreview\b/.test(s), 'ADR 0005 §8: export default function UpdatePreview');
  for (const phrase of ['Scoring Method:', 'Point of view:', 'Cutoff (≥)', 'These apply in this browser and are not written onto the list.', '⏳ Checking…', 'Your list is up to date.']) {
    assert(f.includes(phrase), `AC-2 / AC-3 / ADR 0005 §8: "${phrase}"`);
  }
  for (const re of [`Nothing to propose — couldn${APOS}t check`, `its original can${APOS}t be found`, `its original was edited; the new version doesn${APOS}t qualify yet`,
    `Your assistant${APOS}s header uses the older link; Update will switch it to (?:“|&ldquo;)pointer(?:”|&rdquo;)\\.`, `Nothing is signed: publishing isn${APOS}t built yet\\.`]) {
    assert(new RegExp(re).test(f), `AC-3 / AC-4 / ADR 0005 §8: a phrase matching /${re}/`);
  }
  for (const heading of ['Copy', 'Refresh', 'Delete', 'Keep, flagged', 'Upgrade', 'Skipped']) {
    assert(new RegExp(`(?:>|['"\`])\\s*${esc(heading)}\\b`).test(s), `AC-3 / ADR 0005 §8: a "${heading}" group heading`);
  }
});

test('S6: the plan comes from updatePlan, and the items section feeds it — the shared list read while candidates or the preview show, votes for every shared item, two verdict sets from one set of reads, the preview rendered', () => {
  const s = src(ITEMS); const p = safeRead(PREVIEW);
  const both = s + p;
  assert(/updatePlan\(/.test(both) && /import\s*\{[^}]*\bupdatePlan\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/utils\/treasureMap['"]/.test(both), 'ADR 0005 §7–§8: updatePlan, imported from the util, builds the preview');
  const sig = (s.match(/export\s+function\s+ItemsSection\s*\(\s*\{([^}]*)\}/) || [])[1] || '';
  assert(/\bheaderState\b/.test(sig), `ADR 0005 §8: ItemsSection({ …, headerState }); got {${sig}}`);
  assert(/\bpreviewOpen\b/.test(s) && /showCandidates\s*\|\|\s*previewOpen|previewOpen\s*\|\|\s*showCandidates/.test(s), 'ADR 0005 §8: the shared list is read while candidates or the preview show');
  assert((s.match(/candidateVerdicts\(/g) || []).length >= 2, 'ADR 0005 §8 / AC-5: two verdict sets — the panel\'s candidates and every shared item — from the same reads');
  assert(/import\s+UpdatePreview\s+from\s*['"]\.\/UpdatePreview['"]/.test(s) && /<UpdatePreview\b/.test(s), 'ADR 0005 §8: the items section renders <UpdatePreview …/>');
  const gates = declaration(s, 'ItemsSection').split(/[;\n]/).filter((st) => /curator\s*(?:===|!==)\s*['"](?:mine|other)['"]/.test(st) && !/FROM_LABEL|UNAVAILABLE_REASON|\blabels\b|\breasons\b/.test(st));
  assert(gates.length >= 1, 'AC-1 / story 4: verdicts and the preview stay on my own lists — ItemsSection still gates on curator');
});

test('S7: the detail page passes the header\'s state to the items section', () => {
  const s = src(DETAIL);
  const items = element(s, 'ItemsSection');
  assert(/\bheaderState=\{/.test(items), `ADR 0005 §8: <ItemsSection … headerState={…} />; got ${items || '(none)'}`);
  assert(/sharedListUnavailable\(/.test(s), 'ADR 0005 §8: the header state comes from sharedListUnavailable(…) and the header description');
});

test('S8: nothing is written — the items module, the preview and the two hooks sign and publish nothing, and carry no identity literal', () => {
  for (const f of [ITEMS, PREVIEW, LIST_HOOK, VOTES_HOOK]) {
    const s = src(f);
    assert(!/\/api\/strfry\/publish|method:\s*['"]POST['"]|signEvent|window\.nostr|publishOrThrow|publishEverywhere|publishToRelays/.test(s), `AC-1 / AC-6: ${rel(f)} writes nothing (publishing is story 6)`);
    assert(!/taPubkey/.test(s) && !/[0-9a-fA-F]{64}/.test(s), `OPEN.md row 188 / CLAUDE.md: ${rel(f)} carries no taPubkey and no 64-hex literal`);
  }
});

/* ── D: docs ──────────────────────────────────────────────── */

test('D1: curated-dlist-update ADR 0004 and my-curated-dlists ADR 0003 each carry a Status parenthetical and a one-line note citing curated-dlist-update ADR 0005 by short name', () => {
  for (const p of [CDU_ADR_4, MCD_ADR_3]) {
    const s = src(p);
    const status = (s.match(/^\*\*Status:\*\*[^\n]*/m) || [''])[0];
    assert(/`curated-dlist-update` ADR 0005/.test(status), `ADR 0005 §9: ${rel(p)}'s Status line cites \`curated-dlist-update\` ADR 0005; got ${JSON.stringify(status)}`);
    assert(/^> \*\*Superseded in part \(\d{4}-\d{2}-\d{2}\):\*\*[^\n]*`curated-dlist-update` ADR 0005/m.test(s), `ADR 0005 §9: ${rel(p)} has a one-line "Superseded in part" note citing \`curated-dlist-update\` ADR 0005`);
    assert(!/decisions\/curated-dlist-update\/0005/.test(s), `ADR 0005 §9: ${rel(p)} cites ADR 0005 by short name, not by path`);
  }
});

test('D2: OPEN.md row 280 says strict mode exists and which reads opt in, and stays OPEN for the endpoint\'s other callers', () => {
  const row = (src(OPEN).match(/^\| 280 \|[^\n]*/m) || [''])[0];
  assert(row, 'OPEN.md must still carry row 280');
  assert(/strict mode/i.test(row) && /opt(?:s|ed)?[ -]in/i.test(row), `ADR 0005 §9: row 280 says the strict mode exists and which reads opt in; got …${row.slice(-300)}`);
  assert(/\| OPEN \|/.test(row), 'ADR 0005 §9: row 280 stays OPEN for the other callers');
});

/* ── R: sentinels (pass before and after) ──────────────────── */

test('R1: the presence probe is unchanged — probeRelayForEvent still answers "present" for a relay holding the event', async () => {
  let mod;
  try { mod = require(RELAY_SOURCE); } catch (err) { throw new Error(`relaySource failed to load: ${err.message}`); }
  assert(typeof mod.probeRelayForEvent === 'function', 'probeRelayForEvent is still exported');
  const e = { id: nid(), kind: 10040, pubkey: AUTHOR, created_at: 1, content: '', sig: 's'.repeat(128), tags: [] };
  const r = fakeRelay([e]);
  const out = await mod.probeRelayForEvent(RELAY, { kinds: [10040], authors: [AUTHOR], limit: 1 }, { connect: async () => r.relay, verify: () => true });
  assert(out && out.status === 'present' && out.event && out.event.id === e.id, `the probe still answers present; got ${brief(out)}`);
});

test('R2: Simple Lists still shows its trust-weights warning, so AC-6\'s new errors reach its footnote', () => {
  const s = src(SIMPLE);
  assert(/\{trustError\s*&&/.test(s), 'Simple Lists renders {trustError && …} in its footnote');
});

function B_PUB() { return 'b'.repeat(64); }

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`curated-dlist-update-update-preview: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
