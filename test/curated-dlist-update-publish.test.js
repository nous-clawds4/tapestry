/**
 * curated-dlist-update #6: Update list publishes what I approved.
 *
 * Story: engineering-team/stories/curated-dlist-update/6-update-list-publishes.md
 * ADR:   engineering-team/decisions/curated-dlist-update/0006-update-publishes.md
 *        (the copy convention: ADR 0001 Decision §1–§6; the planner: ADR 0005 §7–§8, with its amendments)
 *
 * Classes (house pattern; the handler half follows test/dlist-curation-header-endpoint.test.js):
 *   P (pure, server)   — src/api/dlist-curation/updateEvents.js: copyD, composeCopy, composeDeletion, composeUpgrade and
 *                        validateUpdateBody. Where the ADR leaves an argument's shape open, the test pins the output:
 *                        - `now` is a clock that reads as a number and can also be called;
 *                        - a copy to delete carries its versions both as `ids` and as `versions`;
 *                        - a refusal may be a throw, an error value or a 4xx status.
 *                        FAIL now: the module doesn't exist.
 *   H (the handler)    — createUpdateHandler(deps) from src/api/dlist-curation/update.js. Every side effect is injected
 *                        and recorded, over a fake world of two places, this instance's strfry and the list's relay. Each
 *                        place replaces addressable events and honors deletion requests as its strfry does (ADR §10).
 *                        The seams follow the header endpoint's: every dep is a function.
 *                        - scan(filter) → events; readRelay(url, filter) → { status, events, error };
 *                        - publishLocal(event); publishRelay(event, url) → the relay's message (either argument order);
 *                        - getKeys(pubkey); requireAuth(req, res); sign(template, privkey); now(); localOnly(); relays().
 *                        FAIL now.
 *   U (behavioral, UI) — ui/src/utils/treasureMap.js:
 *                        - planIntents;
 *                        - updatePlan's pins;
 *                        - describeCurationHeader's marker;
 *                        - curateHereOffer's own;
 *                        - the round trip: what the server composes, the next plan doesn't propose again.
 *                        FAIL now.
 *   S (structure)      — the preview's button, marker clause and result words; the browser signs nothing and posts only
 *                        to the update endpoint; the epoch; the deletion-request read and its flag; the detail page's
 *                        marker, viewerPubkey and header refresh; REASON_TAILS.own; the panel's 409 sentence; the server
 *                        modules' shape and their registration. User-facing phrases are pinned as literals, on
 *                        whitespace-flattened source. FAIL now.
 *   D (docs)           — ADR §11's notes on ADRs 0002, 0003 and 0005, and the three OPEN.md rows, matched by content.
 *                        FAIL now.
 *   R (sentinel)       — the header endpoint's 409; Simple Lists untouched. PASS before and after.
 *
 * Re-aimed in their own suites (the test plan lists each): curated-dlist-update-update-preview U6 (with its `proposes`
 * helper), S5 and S8; curated-dlist-update-curation-method S6, S8 and R2; my-curated-dlists-items S3 and S9.
 *
 * ADR 0006 Amendment 1 (from Test Design) adds:
 * - H9: a delete's or a refresh's target is one of my assistant's copies (a q), or it gets §2's 409 under `stale`;
 * - H24: the shared list, my list and the deletion requests are read with limit 500 — 500 events is capped, 499 complete;
 * - H7's capped case answers 500 events.
 *
 * Not covered here:
 * - the browser's publish run (its calls of at most 50, and its stop at a refused call);
 * - the rendered page;
 * - a live publish.
 * These are the Implementer's local check with the fetch stub (ADR note 6). A live write needs the operator's OK (§10).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const EVENTS_MOD = path.join(ROOT, 'src/api/dlist-curation/updateEvents.js');
const UPDATE_MOD = path.join(ROOT, 'src/api/dlist-curation/update.js');
const CURATION_INDEX = path.join(ROOT, 'src/api/dlist-curation/index.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const ITEMS = path.join(UI, 'pages/grapevine/CuratedDListItems.jsx');
const PREVIEW = path.join(UI, 'pages/grapevine/UpdatePreview.jsx');
const DETAIL = path.join(UI, 'pages/grapevine/CuratedDListDetail.jsx');
const OFFER = path.join(UI, 'pages/grapevine/CurateHereOffer.jsx');
const PANEL = path.join(UI, 'pages/grapevine/DListCurationPanel.jsx');
const HOOKS = path.join(UI, 'hooks');
const LIST_HOOK = path.join(HOOKS, 'useListItems.js');
const VOTES_HOOK = path.join(HOOKS, 'useItemVotes.js');
const WEIGHTS_HOOK = path.join(HOOKS, 'useTrustWeights.js');
const SIMPLE = path.join(UI, 'pages/lists/DListItems.jsx');
const ADR_DIR = path.join(ROOT, 'engineering-team/decisions/curated-dlist-update');
const CDU_ADR_2 = path.join(ADR_DIR, '0002-pointer-switch-and-copy-wording.md');
const CDU_ADR_3 = path.join(ADR_DIR, '0003-read-only-curation-and-curate-here.md');
const CDU_ADR_5 = path.join(ADR_DIR, '0005-update-preview-and-honest-reads.md');
const OPEN = path.join(ROOT, 'OPEN.md');

const A = 'a'.repeat(64);                     // my assistant (the signed-in user's own)
const USER = 'b'.repeat(64);                  // the signed-in user
const AUTHOR = 'c'.repeat(64);                // the shared list's items' author
const OTHER = 'd'.repeat(64);                 // someone else: another assistant
const TA = 'f'.repeat(64);                    // the instance's assistant (the owner's)
const OWNER = '9'.repeat(64);                 // the owner
const PRIV = '1'.repeat(64);                  // my assistant's private key
const TA_PRIV = '2'.repeat(64);               // the instance assistant's private key
const RELAY = 'wss://dcosl.brainstorm.world'; // the list's relay (aDListRelays[0])
const RELAY2 = 'wss://relay2.example';
const D = 'dog-breed';
const MY = `39998:${A}:${D}`;                 // my header's address
const SHARED = `39998:${AUTHOR}:${D}`;        // the shared header's address
const NOW = 1800000000;
const SENTINEL = 'b-tag-deferred';
const APOS = "(?:'|’|&apos;|&#39;)";          // an apostrophe as JSX may spell it
const LQ = '(?:“|&ldquo;)';
const RQ = '(?:”|&rdquo;)';
const DASH = '(?:—|&mdash;)';

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function rel(p) { return path.relative(ROOT, p); }
const flat = (s) => s.replace(/\s+/g, ' ');
/** Deep equality that ignores key order and reads undefined as null. */
function canon(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v;
}
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
/** The same members, in any order. */
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length
  && same([...a].map((x) => JSON.stringify(canon(x))).sort(), [...b].map((x) => JSON.stringify(canon(x))).sort());
const brief = (v) => { const s = JSON.stringify(v); return s && s.length > 400 ? `${s.slice(0, 400)}…` : s; };
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist (ADR 0006 § Implementation notes)`);
  return s;
}
/** The first `<Name …/>` element in a JSX source, whatever its line breaks. */
function element(s, name) {
  const m = s.match(new RegExp(`<${name}\\b[\\s\\S]*?\\/>`));
  return m ? m[0] : '';
}
/** Minimal express-ish res capturing status and body. */
function fakeRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.end = () => r;
  r.set = () => r;
  r.setHeader = () => r;
  return r;
}

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
/** ADR 0001 §4: a copy's d, computed here from the formula, never from the module under test. */
const dFor = (headerAddress, ref) => `copy-${sha256(`${headerAddress}\n${ref}`)}`;
/** A clock the composers may read as a number or call: ADR 0006 note 1 names `now` without a type. */
function clock(n) { const f = () => n; f.valueOf = () => n; f.toString = () => String(n); return f; }

let seq = 0;
const hex = (n) => n.toString(16).padStart(64, '0');
const nid = () => hex(++seq);
const tagOf = (e, name) => ((e && e.tags) || []).find((t) => t[0] === name);
const tagsNamed = (e, name) => ((e && e.tags) || []).filter((t) => t[0] === name);
const dOf = (e) => (tagOf(e, 'd') || [])[1];
const route = (e) => (e.kind === 39999 && dOf(e) ? `39999:${e.pubkey}:${dOf(e)}` : e.id);
const copyAddress = (original) => `39999:${A}:${dFor(MY, route(original))}`;

/** A shared-list item: kind 39999 with a d-tag (addressable), or kind 9999. */
function sharedItem(d, { kind = 39999, id = nid(), name = d || 'unnamed', createdAt = 100, z = SHARED } = {}) {
  const tags = [['z', z], ['name', name]];
  if (kind === 39999) tags.unshift(['d', d]);
  return { id, kind, pubkey: AUTHOR, created_at: createdAt, content: `about ${name}`, sig: 's'.repeat(128), tags };
}
/** My assistant's copy of `original` under my header (ADR 0001 §2–§5), its d derived as §4 says. */
function copyEvent(original, { versionId = original.id, pubkey = A, d = dFor(MY, route(original)), createdAt = 200, id = nid(), z = MY } = {}) {
  const tags = [['d', d], ['z', z]];
  if (original.kind === 39999) tags.push(['q', route(original), RELAY]);
  tags.push(['q', versionId, RELAY, original.pubkey]);
  tags.push(['name', (tagOf(original, 'name') || [])[1] || 'copy']);
  return { id, kind: 39999, pubkey, created_at: createdAt, content: original.content, sig: 's'.repeat(128), tags };
}
/** My assistant's curation header; by default it still uses the older link. */
function myHeader({ tags, createdAt = 100, id = nid(), pubkey = A } = {}) {
  return {
    id, kind: 39998, pubkey, created_at: createdAt, content: 'my header', sig: 's'.repeat(128),
    tags: tags || [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'inherit-items']],
  };
}
/** My assistant's NIP-09 deletion request for a copy (ADR 0001 §6). */
function deletionRequest({ address, ids = [], createdAt = 150, pubkey = A, id = nid() }) {
  const tags = [['a', address], ...ids.map((x) => ['e', x]), ['k', '39999']];
  return { id, kind: 5, pubkey, created_at: createdAt, content: '', sig: 's'.repeat(128), tags };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── P: the pure composers (server) ────────────────────────── */

function events() {
  let mod;
  try { mod = require(EVENTS_MOD); } catch (err) {
    throw new Error(`ADR 0006 note 1: src/api/dlist-curation/updateEvents.js must load (pure, no nostr-tools); loading it threw: ${String((err && err.message) || err).slice(0, 160)}`);
  }
  return mod;
}
function ev(name) {
  const f = events()[name];
  assert(typeof f === 'function', `ADR 0006 note 1: src/api/dlist-curation/updateEvents.js must export ${name}`);
  return f;
}
const tagNames = (t) => (t && Array.isArray(t.tags) ? t.tags.map((x) => x[0]) : []);

test('P1: copyD — "copy-" and the lowercase hex SHA-256 of "<my header address>\\n<the original\'s reference>": its address for a kind-39999 original, its id otherwise (ADR 0001 §4)', () => {
  const copyD = ev('copyD');
  for (const ref of [`39999:${AUTHOR}:akita`, hex(0x9001), `39999:${AUTHOR}:café-ü`]) {
    const want = `copy-${crypto.createHash('sha256').update(`${MY}\n${ref}`, 'utf8').digest('hex')}`;
    const got = copyD(MY, ref);
    assert(got === want, `ADR 0001 §4: copyD(my header, ${ref}) is ${want}; got ${brief(got)}`);
  }
  assert(copyD(MY, `39999:${AUTHOR}:akita`) !== copyD(`39998:${OTHER}:${D}`, `39999:${AUTHOR}:akita`), 'ADR 0001 §4: another list gives another d');
  assert(copyD(MY, `39999:${AUTHOR}:akita`) !== copyD(MY, `39999:${AUTHOR}:beagle`), 'ADR 0001 §4: another original gives another d');
});

// An original carrying every kind of tag (ADR 0001 §3): what a copy carries, and what it doesn't.
const RICH = {
  id: hex(0x5101), kind: 39999, pubkey: AUTHOR, created_at: 120, content: 'A large dog.\nLoyal.', sig: 's'.repeat(128),
  tags: [
    ['d', 'akita'], ['z', SHARED], ['t', 'dogs'], ['name', 'akita'], ['json', '{"word":"akita"}'], ['title', 'Akita'],
    ['n', 'thread'], ['p', OTHER, 'wss://hint.example', 'breeder'], ['slug', 'akita'], ['s', 'x'],
    ['description', 'A large dog.'], ['b', SHARED, 'pointer'], ['e', hex(0x77)], ['q', hex(0x78)],
    ['comments', 'none'], ['a', `39999:${OTHER}:shiba`], ['x-unknown', '1'],
  ],
};
const RICH_CARRIED = [
  ['t', 'dogs'], ['name', 'akita'], ['title', 'Akita'], ['p', OTHER, 'wss://hint.example', 'breeder'], ['slug', 'akita'],
  ['description', 'A large dog.'], ['e', hex(0x77)], ['comments', 'none'], ['a', `39999:${OTHER}:shiba`],
];
const composeArgs = (original, over = {}) => ({ original, headerAddress: MY, assistant: A, relay: RELAY, now: clock(NOW), existing: null, ...over });

test('P2: composeCopy (a kind-39999 original) — kind 39999: exactly its d, one z (my header), the two q, then the carried tags in the original\'s order; the content verbatim; created_at now (ADR 0001 §2–§5; ADR 0006 §3)', () => {
  const composeCopy = ev('composeCopy');
  const t = composeCopy(composeArgs(RICH));
  assert(t && t.kind === 39999, `ADR 0001 §2: a copy is kind 39999; got ${brief(t)}`);
  const tags = Array.isArray(t.tags) ? t.tags : [];
  assert(same(tags[0], ['d', dFor(MY, `39999:${AUTHOR}:akita`)]), `ADR 0001 §4: first its d, from my header's address and the original's address; got ${brief(tags[0])}`);
  assert(same(tags[1], ['z', MY]), `ADR 0001 §2: then one z, my header's address; got ${brief(tags[1])}`);
  assert(sameSet(tags.slice(2, 4), [['q', `39999:${AUTHOR}:akita`, RELAY], ['q', RICH.id, RELAY, AUTHOR]]),
    `ADR 0001 §5: then the address q and the version q, with the list's relay and the author in the fourth element; got ${brief(tags.slice(2, 4))}`);
  assert(same(tags.slice(4), RICH_CARRIED),
    `ADR 0001 §3: then only name, title, slug, description, comments, p, e, t and a, verbatim, in the original's order — never json, n, s, b, its own d, z or q, or any other tag; got ${brief(tags.slice(4))}`);
  assert(tagsNamed(t, 'z').length === 1, 'ADR 0001 §7: exactly one z — never the shared list\'s');
  assert(t.content === RICH.content, `ADR 0001 §3: the content verbatim; got ${brief(t.content)}`);
  assert(Number(t.created_at) === NOW, `ADR 0006 §3: created_at is now; got ${brief(t.created_at)}`);
});

test('P3: composeCopy (a kind-9999 original) — its d from the original\'s id, one z, the version q only; a stray d on the original isn\'t carried', () => {
  const composeCopy = ev('composeCopy');
  const nine = {
    id: hex(0x9001), kind: 9999, pubkey: AUTHOR, created_at: 90, content: '', sig: 's'.repeat(128),
    tags: [['z', SHARED], ['d', 'stray'], ['name', 'fox terrier'], ['t', 'terriers']],
  };
  const t = composeCopy(composeArgs(nine));
  assert(t && t.kind === 39999, `ADR 0001 §2: kind 39999, whatever the original's kind; got ${brief(t && t.kind)}`);
  assert(same(t.tags, [['d', dFor(MY, nine.id)], ['z', MY], ['q', nine.id, RELAY, AUTHOR], ['name', 'fox terrier'], ['t', 'terriers']]),
    `ADR 0001 §4–§5: d from the id, one z, only the version q, then the carried tags; got ${brief(t.tags)}`);
  assert(t.content === '', 'ADR 0001 §3: the content verbatim, even when empty');
});

test('P4: composeCopy (a refresh) — the copy\'s own address, a new version q, and created_at max(now, the copy\'s + 1) (ADR 0006 §3)', () => {
  const composeCopy = ev('composeCopy');
  const older = sharedItem('corgi', { id: hex(0x5202), createdAt: 100 });
  const edited = sharedItem('corgi', { id: hex(0x5203), createdAt: 300 });
  const copy = copyEvent(edited, { versionId: older.id, createdAt: NOW + 500 });
  const t = composeCopy(composeArgs(edited, { existing: copy }));
  assert(dOf(t) === dOf(copy), `ADR 0006 §3: the refresh's recomputed d equals the copy's; got ${brief(dOf(t))}`);
  assert(tagsNamed(t, 'q').some((q) => same(q, ['q', edited.id, RELAY, AUTHOR])) && !tagsNamed(t, 'q').some((q) => q[1] === older.id),
    `ADR 0001 §6: a new version q, the edited version's id and not the old one; got ${brief(tagsNamed(t, 'q'))}`);
  assert(Number(t.created_at) === NOW + 501, `ADR 0006 §3: a copy stamped ahead of this clock → the copy's + 1; got ${brief(t.created_at)}`);
  const behind = composeCopy(composeArgs(edited, { existing: { ...copy, created_at: NOW - 60 } }));
  assert(Number(behind.created_at) === NOW, `ADR 0006 §3: a copy older than now → now; got ${brief(behind.created_at)}`);
});

test('P5: composeDeletion — kind 5: one a (my assistant\'s address for the copy), an e for every version passed, k 39999, no reason; never an a for anyone else\'s address (ADR 0001 §6; ADR 0006 §3)', () => {
  const composeDeletion = ev('composeDeletion');
  const d = dFor(MY, `39999:${AUTHOR}:dingo`);
  const newest = { id: hex(0xd1), kind: 39999, pubkey: A, created_at: 250, content: '', sig: 's'.repeat(128), tags: [['d', d], ['z', MY]] };
  const older = { ...newest, id: hex(0xd0), created_at: 200 };
  // ADR 0006 note 1 leaves the copy's shape open: an event-shaped copy that also carries its d, and its versions as ids and as events.
  const copyWith = (versions) => ({ ...versions[0], d, ids: versions.map((v) => v.id), versions });
  const one = composeDeletion({ copy: copyWith([newest]), assistant: A, now: clock(NOW) });
  assert(one && one.kind === 5, `ADR 0001 §6: a NIP-09 deletion request, kind 5; got ${brief(one)}`);
  assert(same(tagsNamed(one, 'a'), [['a', `39999:${A}:${d}`]]), `ADR 0001 §6: one a, my assistant's address for the copy; got ${brief(tagsNamed(one, 'a'))}`);
  assert(tagsNamed(one, 'e').some((e) => e[1] === newest.id), `ADR 0001 §6: an e for the copy's id; got ${brief(tagsNamed(one, 'e'))}`);
  assert(same(tagsNamed(one, 'k'), [['k', '39999']]), `ADR 0001 §6: k 39999; got ${brief(tagsNamed(one, 'k'))}`);
  assert(tagNames(one).every((n) => n === 'a' || n === 'e' || n === 'k'), `ADR 0001 §6: only a, e and k; got ${brief(one.tags)}`);
  assert(one.content === '', 'ADR 0001 §6 / ADR 0006 §3: no reason — the content is ""');
  assert(Number(one.created_at) === NOW, `ADR 0006 §3: created_at is now; got ${brief(one.created_at)}`);
  const two = composeDeletion({ copy: copyWith([newest, older]), assistant: A, now: clock(NOW) });
  assert(sameSet(tagsNamed(two, 'e').map((e) => e[1]), [newest.id, older.id]),
    `ADR 0006 §3 / §10: an e for every version of the copy passed, not only the newest; got ${brief(tagsNamed(two, 'e'))}`);
  // Someone else's item: the request never names their address (the local relay would reject the whole deletion, §10).
  const theirs = { ...newest, pubkey: OTHER };
  let foreign = null;
  try { foreign = composeDeletion({ copy: { ...theirs, d, ids: [theirs.id], versions: [theirs] }, assistant: A, now: clock(NOW) }); } catch { foreign = null; }
  assert(!foreign || tagsNamed(foreign, 'a').every((a) => String(a[1]).startsWith(`39999:${A}:`)),
    `ADR 0006 §3: no a ever names anyone else's address; got ${brief(foreign && tagsNamed(foreign, 'a'))}`);
});

test('P6: composeUpgrade — my header republished in place: its real b becomes ["b", <same target>, "pointer"], every other tag and the content kept; beside the marker, the marker goes; created_at max(now, old + 1) (ADR 0006 §3; Planning decision 2)', () => {
  const composeUpgrade = ev('composeUpgrade');
  const header = myHeader({ tags: [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'inherit-items'], ['slug', D], ['json', '{"a":1}']] });
  const t = composeUpgrade({ header, now: clock(NOW) });
  assert(t && t.kind === 39998, `ADR 0006 §3: my header, kind 39998; got ${brief(t)}`);
  assert(same(t.tags, [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'pointer'], ['slug', D], ['json', '{"a":1}']]),
    `ADR 0001 §1 / AC-6: the same target with a new type, in place, and everything else kept; got ${brief(t.tags)}`);
  assert(t.content === header.content, 'AC-6: it keeps everything else it says, the content too');
  assert(Number(t.created_at) === NOW, `ADR 0006 §3: max(now, old + 1); got ${brief(t.created_at)}`);
  const marked = myHeader({ createdAt: NOW + 500, tags: [['d', D], ['b', SENTINEL], ['names', 'dog', 'dogs'], ['b', SHARED, 'inherit-items']] });
  const u = composeUpgrade({ header: marked, now: clock(NOW) });
  assert(same(u.tags, [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'pointer']]),
    `Planning decision 2 / ADR 0006 §3: the marker is dropped and the link upgraded, leaving a plain pointer header; got ${brief(u.tags)}`);
  assert(Number(u.created_at) === NOW + 501, `ADR 0006 §3: a header stamped ahead of this clock → old + 1; got ${brief(u.created_at)}`);
});

/**
 * What validateUpdateBody said. ADR 0006 note 1 leaves its answer's shape open, so a refusal is any of: a throw; an error
 * value (ok or valid false, an error, errors, a 4xx status, an error string or list); or nothing, where a valid body gets
 * something back.
 */
function judge(validate, body, validAnswer) {
  let out;
  let threw = false;
  try { out = validate(body); } catch { threw = true; }
  const errorLike = (typeof out === 'string' && out !== '') || (Array.isArray(out) && out.length > 0)
    || (!!out && typeof out === 'object' && !Array.isArray(out) && (out.ok === false || out.valid === false
      || (typeof out.error === 'string' && out.error !== '') || (Array.isArray(out.errors) && out.errors.length > 0)
      || (typeof out.status === 'number' && out.status >= 400)));
  return { out, refused: threw || errorLike || (out == null && validAnswer != null) };
}
const COPY_D = (name) => dFor(MY, `39999:${AUTHOR}:${name}`);
function validBody() {
  return {
    list: MY,
    copy: [
      { original: `39999:${AUTHOR}:akita`, version: hex(0x5001) }, { original: hex(0x9001), version: hex(0x9001) },
      { original: `39999:${AUTHOR}:breed:akita`, version: hex(0x5009) }, { original: `39999:${AUTHOR}:café`, version: hex(0x500a) },
    ],
    refresh: [{ copy: `39999:${A}:${COPY_D('corgi')}`, original: `39999:${AUTHOR}:corgi`, version: hex(0x5003) }],
    delete: [{ copy: `39999:${A}:${COPY_D('dingo')}`, id: hex(0xd1) }],
    upgrade: { dropsMarker: false },
  };
}
const copies = (n) => Array.from({ length: n }, (_, i) => ({ original: `39999:${AUTHOR}:breed-${i}`, version: hex(0x8000 + i) }));

test('P7: validateUpdateBody — accepts a well-formed body, 50 intents and a 256-character d-tag; refuses more than 50 intents, a malformed id, pubkey or coordinate, and a d-tag that is empty, over 256 characters or holds a control character (ADR 0006 §1)', () => {
  const validate = ev('validateUpdateBody');
  const good = judge(validate, validBody());
  assert(!good.refused, `ADR 0006 §1: a well-formed body is accepted (a d-tag may hold colons and non-ASCII letters); got ${brief(good.out)}`);
  for (const [body, why] of [
    [{ list: MY, copy: copies(50), refresh: [], delete: [], upgrade: null }, '50 intents'],
    [{ ...validBody(), list: `39998:${A}:${'x'.repeat(256)}` }, 'a 256-character d-tag'],
  ]) {
    const r = judge(validate, body, good.out);
    assert(!r.refused, `ADR 0006 §1: ${why} is accepted; got ${brief(r.out)}`);
  }
  const b = validBody;
  const refreshes = (n) => copies(n).map((c, i) => ({ copy: `39999:${A}:${COPY_D(`r${i}`)}`, original: c.original, version: c.version }));
  for (const [body, why] of [
    [{ list: MY, copy: copies(51), refresh: [], delete: [], upgrade: null }, 'more than 50 intents (§6)'],
    [{ list: MY, copy: copies(25), refresh: refreshes(25), delete: [{ copy: `39999:${A}:${COPY_D('x')}`, id: hex(1) }], upgrade: null }, '51 intents across the groups'],
    [{ ...b(), list: 'nope' }, 'a list that is not a coordinate'],
    [{ ...b(), list: `39999:${A}:${D}` }, 'a list that is not kind 39998'],
    [{ ...b(), list: `39998:${'a'.repeat(63)}:${D}` }, 'a list pubkey of 63 hex digits'],
    [{ ...b(), list: `39998:${'g'.repeat(64)}:${D}` }, 'a list pubkey that is not hex'],
    [{ ...b(), list: `39998:${A}:` }, 'an empty d-tag'],
    [{ ...b(), list: `39998:${A}:${'x'.repeat(257)}` }, 'a d-tag over 256 characters'],
    [{ ...b(), list: `39998:${A}:dog breed` }, 'a d-tag holding NUL'],
    [{ ...b(), list: `39998:${A}:dog\nbreed` }, 'a d-tag holding a line feed'],
    [{ ...b(), list: `39998:${A}:dogbreed` }, 'a d-tag holding U+001F'],
    [{ ...b(), copy: [{ original: 'xyz', version: hex(1) }] }, 'a copy whose original is neither a 39999 address nor an id'],
    [{ ...b(), copy: [{ original: `39998:${AUTHOR}:akita`, version: hex(1) }] }, 'a copy whose original is a kind-39998 address'],
    [{ ...b(), copy: [{ original: `39999:${AUTHOR}:${'y'.repeat(257)}`, version: hex(1) }] }, 'an original whose d-tag is over 256 characters'],
    [{ ...b(), copy: [{ original: `39999:${AUTHOR}:akita`, version: 'z'.repeat(64) }] }, 'a version that is not hex'],
    [{ ...b(), copy: [{ original: `39999:${AUTHOR}:akita`, version: hex(1).slice(1) }] }, 'a version of 63 hex digits'],
    [{ ...b(), refresh: [{ copy: 'nope', original: `39999:${AUTHOR}:corgi`, version: hex(1) }] }, 'a refresh whose copy is not a coordinate'],
    [{ ...b(), refresh: [{ copy: `39999:${A}:${COPY_D('corgi')}`, original: `39999:${AUTHOR}:corgi`, version: 'x' }] }, 'a refresh with a malformed version'],
    [{ ...b(), delete: [{ copy: `39999:${A}:${COPY_D('dingo')}`, id: 'x' }] }, 'a delete with a malformed id'],
    [{ ...b(), delete: [{ copy: `39999:${'a'.repeat(63)}:x`, id: hex(1) }] }, 'a delete whose copy has a malformed pubkey'],
    [{ ...b(), copy: 'x' }, 'intents that are not a list'],
    [{ ...b(), upgrade: 'yes' }, 'an upgrade that is neither { dropsMarker } nor null'],
    [null, 'no body'], ['x', 'a string body'], [[], 'an array body'],
  ]) {
    const r = judge(validate, body, good.out);
    assert(r.refused, `ADR 0006 §1: ${why} is refused; got ${brief(r.out)}`);
  }
});

/* ── H: the handler, through its dependencies ─────────────── */

function createHandler() {
  let mod;
  try { mod = require(UPDATE_MOD); } catch (err) {
    throw new Error(`ADR 0006 note 2: src/api/dlist-curation/update.js must load without the container's nostr-tools and ws paths; loading it threw: ${String((err && err.message) || err).slice(0, 160)}`);
  }
  assert(typeof mod.createUpdateHandler === 'function', 'ADR 0006 note 2: src/api/dlist-curation/update.js must export createUpdateHandler(deps)');
  return mod.createUpdateHandler;
}

/** Whether event `e` matches a nostr filter: ids, kinds, authors, #<tag>, since and until. */
function matches(e, f) {
  if (!e || !f || typeof f !== 'object') return false;
  if (Array.isArray(f.ids) && !f.ids.includes(e.id)) return false;
  if (Array.isArray(f.kinds) && !f.kinds.includes(e.kind)) return false;
  if (Array.isArray(f.authors) && !f.authors.includes(e.pubkey)) return false;
  for (const [k, vals] of Object.entries(f)) {
    if (k[0] !== '#' || !Array.isArray(vals)) continue;
    if (!(e.tags || []).some((t) => t[0] === k.slice(1) && vals.includes(t[1]))) return false;
  }
  if (typeof f.since === 'number' && e.created_at < f.since) return false;
  if (typeof f.until === 'number' && e.created_at > f.until) return false;
  return true;
}
function query(list, f) {
  const out = list.filter((e) => matches(e, f)).sort((x, y) => y.created_at - x.created_at);
  return Number.isInteger(f && f.limit) && f.limit > 0 ? out.slice(0, f.limit) : out;
}
const addressOf = (e) => (e.kind >= 30000 && e.kind < 40000 ? `${e.kind}:${e.pubkey}:${dOf(e) || ''}` : null);
const clone = (e) => JSON.parse(JSON.stringify(e));

/**
 * One place that keeps events as its strfry does (ADR 0006 §10):
 * - a newer version of an addressable event replaces the older one, and an older or equal one is refused;
 * - an id it deleted is refused if it is sent again;
 * - a kind 5 deletes its author's events named by `e`. How much more it does depends on the place's version:
 *   - 'a+e', this instance's strfry 1.1.0: it also deletes every version at an `a` address up to the request's created_at.
 *     It refuses a later re-send at that address that isn't newer, and rejects a whole deletion whose `a` names another
 *     author;
 *   - 'e', the community relay's strfry 1.0.4: it honors only `e`;
 *   - 'none': it stores the request and deletes nothing.
 */
function makePlace(initial, honor) {
  const place = { events: initial.map(clone), honor, deleted: new Set() };
  place.store = (e) => {
    if (place.deleted.has(e.id)) return;
    if (e.kind === 5 && honor === 'a+e' && e.tags.some((t) => t[0] === 'a' && !String(t[1]).includes(`:${e.pubkey}:`))) return;
    const a = addressOf(e);
    if (a) {
      const prev = place.events.find((x) => addressOf(x) === a);
      if (prev && prev.created_at >= e.created_at) return;
      if (honor === 'a+e' && place.events.some((x) => x.kind === 5 && x.pubkey === e.pubkey
        && x.tags.some((t) => t[0] === 'a' && t[1] === a) && x.created_at >= e.created_at)) return;
      place.events = place.events.filter((x) => addressOf(x) !== a);
    }
    if (e.kind === 5 && honor !== 'none') {
      const ids = new Set(e.tags.filter((t) => t[0] === 'e').map((t) => t[1]));
      const as = new Set(e.tags.filter((t) => t[0] === 'a').map((t) => t[1]));
      place.events = place.events.filter((x) => {
        if (x.pubkey !== e.pubkey || x.kind === 5) return true;
        if (ids.has(x.id) || (honor === 'a+e' && as.has(addressOf(x)) && x.created_at <= e.created_at)) { place.deleted.add(x.id); return false; }
        return true;
      });
    }
    place.events.push(clone(e));
  };
  return place;
}
function makeWorld({ local = [], relay = [], relays = [RELAY], honorLocal = 'a+e', honorRelay = 'e' } = {}) {
  const world = { local: makePlace(local, honorLocal) };
  relays.forEach((url, i) => { world[url] = makePlace(i === 0 ? relay : [], honorRelay); });
  return world;
}
/** `n` filler events that match `filter`: its kind, its first author and its tag values (the d excepted). */
function fill(filter, n) {
  const kind = Array.isArray(filter.kinds) ? (filter.kinds.includes(39999) ? 39999 : filter.kinds[0]) : 39999;
  const pubkey = Array.isArray(filter.authors) ? filter.authors[0] : AUTHOR;
  const extra = Object.entries(filter).filter(([k, v]) => k[0] === '#' && k !== '#d' && Array.isArray(v) && v.length > 0).map(([k, v]) => [k.slice(1), v[0]]);
  return Array.from({ length: Math.max(0, n) }, (_, i) => ({
    id: sha256(`filler:${i}:${JSON.stringify(filter)}`), kind, pubkey, created_at: 100, content: '', sig: 's'.repeat(128),
    tags: [['d', `filler-${i}`], ...extra, ['name', `filler ${i}`]],
  }));
}
/** An answer of exactly `n` events: the real matches, padded with fillers (Amendment 1: 500 is capped, 499 complete). */
const answerOf = (real, filter, n) => [...real, ...fill(filter, n - real.length)].slice(0, n);

/**
 * Every seam, recorded. `knobs` bend the world:
 * - scanFails(filter) and relayFails(url, filter) fail a read;
 * - answerSize(place, filter) — `place` is 'local' or the relay's url — gives that read an answer of exactly that many
 *   events, or null for the real answer;
 * - localPublish(event) and relayPublish(event, url) answer 'store', 'drop' (says ok, keeps nothing), 'reject', or, for
 *   a relay, 'connection-failure' (fulfilled, as nostr-tools 2.23 does).
 * `over` replaces a seam outright.
 */
function makeDeps(world, knobs = {}, over = {}) {
  const k = { scanFails: () => false, relayFails: () => false, answerSize: () => null, localPublish: () => 'store', relayPublish: () => 'store', ...knobs };
  const calls = { requireAuth: 0, getKeys: [], scan: [], readRelay: [], publishLocal: [], publishRelay: [], sign: [] };
  const flight = { now: {}, max: {} };
  const deps = {
    requireAuth: (req, res) => {
      calls.requireAuth += 1;
      const pk = req.session && req.session.authenticated === true ? req.session.pubkey : null;
      if (!pk) { res.status(401).json({ success: false, error: 'authentication required' }); return null; }
      return pk;
    },
    getKeys: async (pk) => {
      calls.getKeys.push(pk);
      if (pk === USER) return { privkey: PRIV, pubkey: A, npub: 'npub-a', nsec: 'nsec-a' };
      if (pk === OWNER) return { privkey: TA_PRIV, pubkey: TA, npub: 'npub-ta', nsec: 'nsec-ta' };
      return null;
    },
    scan: async (filter) => {
      calls.scan.push(filter);
      if (k.scanFails(filter)) throw new Error('strfry scan exited 1');
      const real = query(world.local.events, filter);
      const n = k.answerSize('local', filter);
      return n == null ? real : answerOf(real, filter, n);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url, filter });
      if (k.relayFails(url, filter)) return { status: 'unreachable', events: [], error: 'Received network error or non-101 status code.' };
      const place = world[url];
      if (!place) return { status: 'unreachable', events: [], error: 'not a relay here' };
      const real = query(place.events, filter);
      const n = k.answerSize(url, filter);
      return { status: 'ok', events: n == null ? real : answerOf(real, filter, n), error: null };
    },
    publishLocal: async (event) => {
      calls.publishLocal.push(event);
      const how = k.localPublish(event);
      if (how === 'reject') throw new Error('strfry import exited 1: boom');
      if (how === 'store') world.local.store(event);
      return '';
    },
    publishRelay: async (...args) => {
      const event = args.find((x) => x && typeof x === 'object' && !Array.isArray(x) && typeof x.kind === 'number');
      const target = args.find((x) => typeof x === 'string' || Array.isArray(x));
      const url = Array.isArray(target) ? target[0] : target;
      calls.publishRelay.push({ event, url });
      flight.now[url] = (flight.now[url] || 0) + 1;
      flight.max[url] = Math.max(flight.max[url] || 0, flight.now[url]);
      await new Promise((r) => setImmediate(r));
      flight.now[url] -= 1;
      const how = k.relayPublish(event, url);
      if (how === 'reject') throw new Error('blocked: not today');
      if (how === 'connection-failure') return 'connection failure: Received network error or non-101 status code.';
      if (how === 'store' && world[url]) world[url].store(event);
      return '';
    },
    sign: (template, privkey) => {
      calls.sign.push({ template: clone(template), privkey });
      const pubkey = privkey === PRIV ? A : privkey === TA_PRIV ? TA : '8'.repeat(64);
      const body = { kind: template.kind, created_at: Number(template.created_at), tags: template.tags, content: template.content };
      return { ...body, pubkey, id: sha256(JSON.stringify([0, pubkey, body.created_at, body.kind, body.tags, body.content])), sig: '5'.repeat(128) };
    },
    now: () => NOW,
    localOnly: () => false,
    relays: () => [RELAY],
    ...over,
  };
  return { deps, calls, flight };
}
function fakeReq({ body, session, headers } = {}) {
  const h = { host: 'localhost:7778', 'content-type': 'application/json', ...(headers || {}) };
  return {
    method: 'POST', path: '/api/dlist-curation/update', url: '/api/dlist-curation/update', originalUrl: '/api/dlist-curation/update',
    headers: h, hostname: 'localhost', protocol: 'http', secure: false,
    get(name) { return h[String(name).toLowerCase()]; },
    header(name) { return h[String(name).toLowerCase()]; },
    session: session === undefined ? { authenticated: true, pubkey: USER } : session,
    body,
  };
}

// The shared list and my list, in both places: one candidate to copy, an edited original to refresh, a copy to delete,
// a kind-9999 copy that stays, and my header on the older link.
const H_S1 = sharedItem('akita', { id: hex(0x5001) });
const H_S3a = sharedItem('corgi', { id: hex(0x5002), createdAt: 100 });
const H_S3b = sharedItem('corgi', { id: hex(0x5003), createdAt: 300 });
const H_S4 = sharedItem('dingo', { id: hex(0x5004) });
const H_S6 = sharedItem(null, { kind: 9999, id: hex(0x5006), name: 'fox terrier' });
const H_M3 = copyEvent(H_S3b, { versionId: H_S3a.id, id: hex(0x6003) });
const H_M4 = copyEvent(H_S4, { id: hex(0x6004) });
const H_M6 = copyEvent(H_S6, { id: hex(0x6006) });
const H_HEADER = myHeader({ id: hex(0x7001) });
const H_EVENTS = [H_HEADER, H_S1, H_S3b, H_S4, H_S6, H_M3, H_M4, H_M6];
const without = (...drop) => H_EVENTS.filter((e) => !drop.includes(e));
function baseWorld(over = {}) { return makeWorld({ local: H_EVENTS, relay: H_EVENTS, ...over }); }
function fullBody(over = {}) {
  return {
    list: MY,
    copy: [{ original: route(H_S1), version: H_S1.id }],
    refresh: [{ copy: route(H_M3), original: route(H_S3b), version: H_S3b.id }],
    delete: [{ copy: route(H_M4), id: H_M4.id }],
    upgrade: { dropsMarker: false },
    ...over,
  };
}
async function runUpdate({ world, body, session, headers, knobs, over } = {}) {
  const create = createHandler();
  const w = world || baseWorld();
  const { deps, calls, flight } = makeDeps(w, knobs, over);
  const res = fakeRes();
  await create(deps)(fakeReq({ body: body === undefined ? fullBody() : body, session, headers }), res);
  return { res, calls, flight, world: w };
}
const wrote = (calls) => calls.sign.length + calls.publishLocal.length + calls.publishRelay.length > 0;
const read = (calls) => calls.scan.length + calls.readRelay.length > 0;
const isHeaderRead = (f) => !!f && Array.isArray(f.kinds) && f.kinds.includes(39998);
const isSharedRead = (f) => !!f && Array.isArray(f['#z']) && f['#z'].includes(SHARED);
const isMineRead = (f) => !!f && Array.isArray(f['#z']) && f['#z'].includes(MY);
const isDeletionRead = (f) => !!f && Array.isArray(f.kinds) && f.kinds.includes(5);
/** The result reporting `action` (a pattern), found by any of `refs` it mentions. */
function resultFor(body, action, refs = []) {
  const rs = body && Array.isArray(body.results) ? body.results : [];
  return rs.find((r) => r && new RegExp(action, 'i').test(String(r.action))
    && (refs.length === 0 || refs.some((x) => JSON.stringify(r).includes(x)))) || null;
}
const placeOf = (r, key) => (r && r.places && r.places[key]) || {};

test('H1: a foreign Origin → 403 before anything else is consulted; no Origin (curl, in-container) or the same host goes on to the session check (ADR 0006 §1, guard 1)', async () => {
  const foreign = await runUpdate({ headers: { origin: 'https://evil.example' } });
  assert(foreign.res.statusCode === 403, `a cross-site POST → 403; got ${foreign.res.statusCode} ${brief(foreign.res.body)}`);
  assert(foreign.calls.requireAuth === 0 && foreign.calls.getKeys.length === 0 && !read(foreign.calls) && !wrote(foreign.calls),
    'the guards run in order: nothing is consulted after a foreign Origin');
  for (const headers of [{}, { origin: 'http://localhost:7778' }]) {
    const r = await runUpdate({ headers, session: null });
    assert(r.res.statusCode === 401 && r.calls.requireAuth >= 1,
      `${headers.origin ? 'the same host' : 'no Origin'} → on to the session check (401 without a session); got ${r.res.statusCode} ${brief(r.res.body)}`);
  }
});

test('H2: no verified session → 401; no key is looked up, and nothing is read or signed (ADR 0006 §1, guard 2; AC-7)', async () => {
  for (const session of [null, {}, { authenticated: false, pubkey: USER }]) {
    const r = await runUpdate({ session });
    assert(r.res.statusCode === 401, `AC-7: session ${brief(session)} → 401; got ${r.res.statusCode}`);
    assert(r.calls.getKeys.length === 0 && !read(r.calls) && !wrote(r.calls), 'AC-7: nothing is consulted after a refused session');
  }
});

test('H3: no assistant for the session — no keys, getCustomerRelayKeys\' object of nulls, or a pubkey without its private key → 400 "no Tapestry Assistant is provisioned for this account"; nothing read or signed (ADR 0006 §1, guard 3)', async () => {
  for (const keys of [null, { pubkey: null, npub: null, privkey: null, nsec: null }, { pubkey: A, npub: 'npub-a', privkey: null, nsec: null }]) {
    const r = await runUpdate({ over: { getKeys: async () => keys } });
    assert(r.res.statusCode === 400 && /no Tapestry Assistant is provisioned/i.test(String(r.res.body && r.res.body.error)),
      `ADR 0006 §1: keys ${brief(keys)} → 400 naming the missing assistant; got ${r.res.statusCode} ${brief(r.res.body)}`);
    assert(!read(r.calls) && !wrote(r.calls), 'ADR 0006 §1: nothing is read or signed without a key');
  }
});

test('H4: the key is getAssistantKeys(the session\'s pubkey) — an admin gets their own assistant, never the instance\'s, and a user named in the body is never used (AC-7; ADR 0006 §1)', async () => {
  // A real session carries only identity: auth.js derives roles from config and never stores them on the session.
  const r = await runUpdate();
  assert(r.res.statusCode === 200, `the signed-in user's own Update → 200; got ${r.res.statusCode} ${brief(r.res.body)}`);
  assert(r.calls.getKeys.length >= 1 && r.calls.getKeys.every((pk) => pk === USER), `AC-7: keys are asked for the session's pubkey only; got ${brief(r.calls.getKeys)}`);
  assert(r.calls.sign.length > 0 && r.calls.sign.every((c) => c.privkey === PRIV), 'AC-7: every event is signed with my own assistant\'s key');
  const named = await runUpdate({ body: fullBody({ user: OWNER, pubkey: OWNER, signer: OWNER, as: 'owner' }) });
  assert(named.calls.getKeys.every((pk) => pk === USER), `ADR 0006 security: a user named in the body is never trusted; keys were asked for ${brief(named.calls.getKeys)}`);
  assert(named.calls.sign.every((c) => c.privkey === PRIV), 'AC-7: nothing is signed with the instance assistant\'s key');
});

test('H5: a list that isn\'t my assistant\'s → 403 before anything is read or signed — another assistant\'s, my own key\'s, the instance assistant\'s (ADR 0006 §1, guard 4; AC-7)', async () => {
  for (const list of [`39998:${OTHER}:${D}`, `39998:${USER}:${D}`, `39998:${TA}:${D}`]) {
    const r = await runUpdate({ body: fullBody({ list }) });
    assert(r.res.statusCode === 403, `AC-7: list ${list.slice(0, 20)}… → 403; got ${r.res.statusCode} ${brief(r.res.body)}`);
    assert(!read(r.calls) && !wrote(r.calls), `AC-7: list ${list.slice(0, 20)}… → nothing read or signed`);
  }
});

test('H6: more than 50 intents in one call → 413 before anything is read or signed; 50 is not refused for its number (ADR 0006 §1, §6)', async () => {
  const over = await runUpdate({ body: { list: MY, copy: copies(51), refresh: [], delete: [], upgrade: null } });
  assert(over.res.statusCode === 413, `ADR 0006 §1: 51 copies → 413; got ${over.res.statusCode} ${brief(over.res.body)}`);
  assert(!read(over.calls) && !wrote(over.calls), 'ADR 0006 §1: nothing is read or signed');
  const spread = await runUpdate({ body: { list: MY, copy: copies(30), refresh: [], delete: copies(21).map((c, i) => ({ copy: `39999:${A}:${COPY_D(`z${i}`)}`, id: hex(0x9900 + i) })), upgrade: null } });
  assert(spread.res.statusCode === 413, `ADR 0006 §1: 51 intents across the groups → 413; got ${spread.res.statusCode}`);
  const fifty = await runUpdate({ body: { list: MY, copy: copies(50), refresh: [], delete: [], upgrade: null } });
  assert(fifty.res.statusCode !== 413, `ADR 0006 §6: 50 intents are not refused for their number (these originals aren't on the list, so the call is stale); got ${fifty.res.statusCode}`);
});

test('H7: a read that failed or came back capped → 503 { couldntCheck } in the preview\'s words, and nothing signed — my header, the shared list, my list or my assistant\'s deletion requests, in either place (ADR 0006 §2; AC-2, AC-10)', async () => {
  const CASES = [
    [{ scanFails: isHeaderRead }, 'my header on this instance\'s strfry', null],
    [{ scanFails: isSharedRead }, 'the shared list on this instance\'s strfry', /shared list/],
    [{ scanFails: isMineRead }, 'my list on this instance\'s strfry', /your list/],
    [{ scanFails: isDeletionRead }, 'my assistant\'s deletion requests on this instance\'s strfry', null],
    [{ relayFails: (url, f) => isHeaderRead(f) }, 'my header on the list\'s relay', null],
    [{ relayFails: (url, f) => isSharedRead(f) }, 'the shared list on the list\'s relay', /shared list/],
    [{ relayFails: (url, f) => isMineRead(f) }, 'my list on the list\'s relay', /your list/],
    [{ relayFails: (url, f) => isDeletionRead(f) }, 'my assistant\'s deletion requests on the list\'s relay', null],
    [{ answerSize: (place, f) => (place === RELAY && isSharedRead(f) ? 500 : null) }, 'the shared list on the list\'s relay answering 500 events, capped (Amendment 1)', /shared list/],
  ];
  for (const [knobs, why, words] of CASES) {
    const r = await runUpdate({ knobs });
    const b = r.res.body || {};
    const asked = (r.calls.readRelay.find((c) => isSharedRead(c.filter)) || {}).filter;
    const hint = knobs.answerSize ? ` (the shared list's relay read asked for limit ${brief(asked && asked.limit)}; Amendment 1: 500)` : '';
    assert(r.res.statusCode === 503, `ADR 0006 §2: ${why} → 503; got ${r.res.statusCode} ${brief(b)}${hint}`);
    assert(Array.isArray(b.couldntCheck) && b.couldntCheck.length >= 1 && b.couldntCheck.every((x) => typeof x === 'string' && x !== ''),
      `ADR 0006 §2: 503 { couldntCheck: [...] } names what couldn't be read (${why}); got ${brief(b)}`);
    if (words) assert(b.couldntCheck.some((x) => words.test(x)), `ADR 0006 §2: the words follow listReadGaps — ${why} → /${words.source}/; got ${brief(b.couldntCheck)}`);
    assert(!wrote(r.calls), `ADR 0006 §2 / AC-2: ${why} → nothing signed or published`);
  }
});

test('H8: an intent that no longer matches the server\'s reads → 409 { stale }, nothing signed — a version moved, an original gone, a copy gone or replaced, a copy already made, the marker disagreeing, the upgrade already done; one stale intent stops the whole call (ADR 0006 §2–§3; AC-2)', async () => {
  const S1moved = { ...H_S1, id: hex(0x5011), created_at: 400 };        // akita, edited since the preview
  const M4new = copyEvent(H_S4, { id: hex(0x6014), createdAt: 260 });   // my copy of dingo, re-published since
  const madeS1 = copyEvent(H_S1, { id: hex(0x6001) });                  // a copy of akita's version, already there
  const pointerHeader = myHeader({ id: hex(0x7002), createdAt: 150, tags: [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'pointer']] });
  const marked = myHeader({ id: hex(0x7003), createdAt: 150, tags: [['d', D], ['b', SENTINEL], ['b', SHARED, 'inherit-items']] });
  const CASES = [
    [{ world: baseWorld({ relay: [...without(H_S1), S1moved] }) }, 'a copy whose original has a newer version on the relay'],
    [{ body: fullBody({ copy: [{ original: hex(0xbeef), version: hex(0xbeef) }] }) }, 'a copy of a kind-9999 original that isn\'t on the shared list'],
    [{ body: fullBody({ copy: [{ original: `39999:${AUTHOR}:saluki`, version: hex(0x5099) }] }) }, 'a copy of an address that isn\'t on the shared list'],
    [{ body: fullBody({ refresh: [{ copy: route(H_M3), original: route(H_S3b), version: H_S3a.id }] }) }, 'a refresh whose version isn\'t the newest'],
    [{ world: baseWorld({ local: without(H_M3), relay: without(H_M3) }) }, 'a refresh whose copy is gone'],
    [{ world: baseWorld({ local: without(H_M4), relay: without(H_M4) }) }, 'a delete whose copy is gone (the last intent: nothing before it is signed)'],
    [{ world: baseWorld({ local: [...without(H_M4), M4new] }) }, 'a delete whose id is no longer the copy\'s current id'],
    [{ body: fullBody({ delete: [{ copy: route(H_M4), id: hex(0x1234) }] }) }, 'a delete whose id isn\'t the copy\'s'],
    [{ world: baseWorld({ local: [...H_EVENTS, madeS1], relay: [...H_EVENTS, madeS1] }) }, 'a copy already made of that version'],
    [{ body: fullBody({ upgrade: { dropsMarker: true } }) }, 'dropsMarker true when my header carries no marker'],
    [{ world: baseWorld({ local: [...without(H_HEADER), marked], relay: [...without(H_HEADER), marked] }) }, 'dropsMarker false when my header carries the marker'],
    [{ world: baseWorld({ local: [...without(H_HEADER), pointerHeader], relay: [...without(H_HEADER), pointerHeader] }) }, 'an upgrade when my header already links with pointer'],
  ];
  for (const [run, why] of CASES) {
    const r = await runUpdate(run);
    const b = r.res.body || {};
    assert(r.res.statusCode === 409, `ADR 0006 §2: ${why} → 409; got ${r.res.statusCode} ${brief(b)}`);
    assert(Array.isArray(b.stale) && b.stale.length >= 1, `ADR 0006 §2: 409 { stale: [...] } (${why}); got ${brief(b)}`);
    assert(!wrote(r.calls), `ADR 0006 §2: ${why} → nothing signed or published; every intent is checked before anything is signed`);
  }
});

test('H9: a delete\'s or a refresh\'s target must be one of my assistant\'s copies, its kind-39999 item under my header that carries a q; anything else no longer matches a copy → 409, listed under stale, and sign is never called — someone else\'s item, an item on another list, a hand-added item, an item with no q at a copy\'s address (ADR 0006 Amendment 1, rule 1)', async () => {
  const stripQ = (e, over) => ({ ...e, tags: e.tags.filter((t) => t[0] !== 'q'), ...over });
  const theirs = copyEvent(H_S4, { pubkey: OTHER, id: hex(0x6104) });                                   // someone else's item on my list
  const elsewhere = copyEvent(H_S4, { id: hex(0x6204), d: 'another-list-item', z: `39998:${A}:cats` });  // my assistant's, on another list
  const handAdded = { id: hex(0x6304), kind: 39999, pubkey: A, created_at: 200, content: '', sig: 's'.repeat(128), tags: [['d', 'hand-added'], ['z', MY], ['name', 'hand added']] };
  const bareM4 = stripQ(H_M4, { id: hex(0x6404) });   // my assistant's item at the dingo copy's own address, with no q
  const bareM3 = stripQ(H_M3, { id: hex(0x6403) });   // my assistant's item at the corgi copy's own address, with no q
  const deleting = (item) => fullBody({ copy: [], refresh: [], delete: [{ copy: route(item), id: item.id }], upgrade: null });
  const refreshing = (item) => fullBody({ copy: [], delete: [], upgrade: null, refresh: [{ copy: route(item), original: route(H_S3b), version: H_S3b.id }] });
  for (const [list, body, target, why] of [
    [[...H_EVENTS, theirs], deleting(theirs), route(theirs), 'a delete of another author\'s item on my list'],
    [[...H_EVENTS, elsewhere], deleting(elsewhere), route(elsewhere), 'a delete of my assistant\'s item filed under another list'],
    [[...H_EVENTS, handAdded], deleting(handAdded), route(handAdded), 'a delete of my assistant\'s hand-added item, which carries no q'],
    [[...without(H_M4), bareM4], deleting(bareM4), route(bareM4), 'a delete of my assistant\'s item at a copy\'s own address that carries no q'],
    [[...without(H_M3), bareM3], refreshing(bareM3), route(bareM3), 'a refresh of my assistant\'s item at a copy\'s own address that carries no q'],
    [[...H_EVENTS, handAdded], refreshing(handAdded), route(handAdded), 'a refresh of my assistant\'s hand-added item'],
  ]) {
    const r = await runUpdate({ world: makeWorld({ local: list, relay: list }), body });
    const b = r.res.body || {};
    assert(r.res.statusCode === 409, `Amendment 1: ${why} no longer matches a copy → §2's 409; got ${r.res.statusCode} ${brief(b)}`);
    assert(Array.isArray(b.stale) && JSON.stringify(b.stale).includes(target), `Amendment 1: ${why} is listed under stale; got ${brief(b.stale)}`);
    assert(r.calls.sign.length === 0 && !wrote(r.calls), `Amendment 1: ${why} → sign is never called, and nothing is published`);
  }
});

const COPY_REFS = [route(H_S1), copyAddress(H_S1)];
const REFRESH_REFS = [route(H_M3), route(H_S3b)];
const DELETE_REFS = [route(H_M4)];

test('H10: an approved plan — copies and refreshes, then deletions, then the upgrade; each event built from the server\'s own reads as ADR 0001 says; every place published and reported per item (ADR 0006 §3–§5; AC-3–AC-6, AC-8)', async () => {
  const r = await runUpdate();
  const b = r.res.body || {};
  assert(r.res.statusCode === 200 && b.success === true, `ADR 0006 §5: 200 { success: true, results }; got ${r.res.statusCode} ${brief(b)}`);
  const kinds = r.calls.publishLocal.map((e) => e.kind);
  assert(same(kinds, [39999, 39999, 5, 39998]), `ADR 0006 §4: copies and refreshes, then deletions, then the upgrade, on this instance; got ${brief(kinds)}`);
  const sent = r.calls.publishRelay.filter((c) => c.url === RELAY).map((c) => c.event.kind);
  assert(sent.length === 4 && sent.lastIndexOf(39999) < sent.indexOf(5) && sent.lastIndexOf(5) < sent.indexOf(39998),
    `ADR 0006 §4: the same order on the list's relay; got ${brief(sent)}`);
  const templates = r.calls.sign.map((c) => c.template);
  const copyT = templates.find((t) => t.kind === 39999 && dOf(t) === dFor(MY, route(H_S1)));
  assert(copyT && same(copyT.tags.slice(0, 2), [['d', dFor(MY, route(H_S1))], ['z', MY]])
    && sameSet(copyT.tags.slice(2, 4), [['q', route(H_S1), RELAY], ['q', H_S1.id, RELAY, AUTHOR]])
    && same(copyT.tags.slice(4), [['name', 'akita']]) && copyT.content === H_S1.content && Number(copyT.created_at) === NOW,
  `ADR 0001 §2–§5 / AC-3: the copy of akita, built from the server's read; got ${brief(copyT)}`);
  const refreshT = templates.find((t) => t.kind === 39999 && dOf(t) === dOf(H_M3));
  assert(refreshT && tagsNamed(refreshT, 'q').some((q) => same(q, ['q', H_S3b.id, RELAY, AUTHOR])) && refreshT.content === H_S3b.content,
    `ADR 0006 §3 / AC-4: the refresh, at the copy's own address, with the new version q; got ${brief(refreshT)}`);
  const delT = templates.find((t) => t.kind === 5);
  assert(delT && same(tagsNamed(delT, 'a'), [['a', route(H_M4)]]) && tagsNamed(delT, 'e').some((e) => e[1] === H_M4.id)
    && same(tagsNamed(delT, 'k'), [['k', '39999']]) && delT.content === '',
  `ADR 0001 §6 / AC-5: my assistant's deletion request for the dingo copy; got ${brief(delT)}`);
  const upT = templates.find((t) => t.kind === 39998);
  assert(upT && same(upT.tags, [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'pointer']]) && upT.content === H_HEADER.content,
    `ADR 0006 §3 / AC-6 / AC-10: my header republished in place with the pointer link and nothing else changed; got ${brief(upT)}`);
  const rows = [
    [resultFor(b, 'copy', COPY_REFS), 'the copy of akita'],
    [resultFor(b, 'refresh', REFRESH_REFS), 'the refresh of corgi'],
    [resultFor(b, 'delete', DELETE_REFS), 'the deletion of the dingo copy'],
    [resultFor(b, 'upgrade'), 'the header upgrade'],
  ];
  for (const [row, what] of rows) {
    assert(row, `ADR 0006 §5 / AC-8: a result for ${what}, { action, ref, name, places }; got ${brief(b.results)}`);
    for (const key of ['local', RELAY]) assert(placeOf(row, key).status === 'published', `AC-8: ${what} is "published" at ${key}; got ${brief(row.places)}`);
  }
  assert(rows[0][0].name === 'akita', `ADR 0006 §5: each result names its item; got ${brief(rows[0][0].name)}`);
  for (const key of ['local', RELAY]) {
    assert(placeOf(rows[2][0], key).copy === 'gone', `ADR 0006 §4 / AC-9: once its request is stored, the copy is re-read — gone at ${key}; got ${brief(rows[2][0].places)}`);
  }
});

test('H11: under the local-only publish policy every relay row is "skipped" and nothing is sent to a relay; this instance still gets everything (ADR 0006 §4; AC-8)', async () => {
  const r = await runUpdate({ world: baseWorld({ relays: [RELAY, RELAY2] }), over: { localOnly: () => true, relays: () => [RELAY, RELAY2] } });
  const b = r.res.body || {};
  assert(r.res.statusCode === 200, `local-only still publishes here; got ${r.res.statusCode} ${brief(b)}`);
  assert(r.calls.publishRelay.length === 0, `ADR 0006 §4: nothing is sent to a relay; got ${r.calls.publishRelay.length} sends`);
  const rs = Array.isArray(b.results) ? b.results : [];
  assert(rs.length === 4 && rs.every((row) => placeOf(row, RELAY).status === 'skipped' && placeOf(row, RELAY2).status === 'skipped'),
    `ADR 0006 §4: every relay row of every result is "skipped"; got ${brief(rs.map((row) => row.places))}`);
  assert(rs.every((row) => placeOf(row, 'local').status === 'published'), 'this instance still gets every event');
});

test('H12: a relay publish that fulfills with "connection failure: …" is "failed", never published, as is one that rejects; each carries its reason, and the rest are still reported (ADR 0006 §4; AC-8)', async () => {
  const cf = await runUpdate({ knobs: { relayPublish: (e) => (e.kind === 39999 ? 'connection-failure' : 'store') } });
  const copyRow = resultFor(cf.res.body, 'copy', COPY_REFS);
  assert(cf.res.statusCode === 200 && copyRow, `a partial failure is still a report; got ${cf.res.statusCode} ${brief(cf.res.body)}`);
  const p = placeOf(copyRow, RELAY);
  assert(p.status === 'failed' && /connection failure/.test(String(p.error)),
    `ADR 0006 §4: a fulfilled "connection failure: …" is failed, with the reason (so a newer nostr-tools can't make it lie); got ${brief(p)}`);
  assert(placeOf(copyRow, 'local').status === 'published', 'the copy is still published on this instance');
  assert(placeOf(resultFor(cf.res.body, 'upgrade'), RELAY).status === 'published', 'AC-8: a partial failure is shown, never hidden — the rest are reported');
  const rej = await runUpdate({ knobs: { relayPublish: (e) => (e.kind === 5 ? 'reject' : 'store') } });
  const delRow = resultFor(rej.res.body, 'delete', DELETE_REFS);
  assert(rej.res.statusCode === 200 && placeOf(delRow, RELAY).status === 'failed' && /blocked: not today/.test(String(placeOf(delRow, RELAY).error)),
    `ADR 0006 §4: a rejected publish is failed, with the relay's reason; got ${rej.res.statusCode} ${brief(delRow)}`);
});

test('H13: read-back — a publish that says ok but whose event isn\'t there is "not-stored", on this instance (strfry import exits 0 when it rejects) and on the relay (ADR 0006 § Context, §4; AC-8)', async () => {
  const r = await runUpdate({ knobs: {
    localPublish: (e) => (e.kind === 39998 ? 'drop' : 'store'),
    relayPublish: (e) => (e.kind === 39999 && dOf(e) === dOf(H_M3) ? 'drop' : 'store'),
  } });
  assert(r.res.statusCode === 200, `got ${r.res.statusCode} ${brief(r.res.body)}`);
  assert(placeOf(resultFor(r.res.body, 'upgrade'), 'local').status === 'not-stored', `ADR 0006 §4: the import said ok, the header isn't there → not-stored; got ${brief(resultFor(r.res.body, 'upgrade'))}`);
  assert(placeOf(resultFor(r.res.body, 'refresh', REFRESH_REFS), RELAY).status === 'not-stored', `ADR 0006 §4: the relay said ok, the refresh isn't there → not-stored; got ${brief(resultFor(r.res.body, 'refresh', REFRESH_REFS))}`);
  assert(placeOf(resultFor(r.res.body, 'copy', COPY_REFS), RELAY).status === 'published', 'an event that is there is published');
});

test('H14: after a deletion request is stored, the copy is re-read in each place — "still-there" where the place doesn\'t honor the request, "gone" where it does (ADR 0006 §4, §10; AC-9)', async () => {
  const r = await runUpdate({ world: baseWorld({ honorRelay: 'none' }), body: fullBody({ copy: [], refresh: [], upgrade: null }) });
  const row = resultFor(r.res.body, 'delete', DELETE_REFS);
  assert(r.res.statusCode === 200 && row, `got ${r.res.statusCode} ${brief(r.res.body)}`);
  assert(placeOf(row, RELAY).status === 'published' && placeOf(row, RELAY).copy === 'still-there',
    `AC-9: the relay kept the request but still shows the copy → still-there; got ${brief(row.places)}`);
  assert(placeOf(row, 'local').status === 'published' && placeOf(row, 'local').copy === 'gone', `AC-9: this instance honored it → gone; got ${brief(row.places)}`);
});

test('H15: a deletion names every version of the copy the server read, in either place — a refresh that reached this instance but not the relay is still covered (ADR 0006 §3, §10)', async () => {
  const M4new = copyEvent(H_S4, { id: hex(0x6014), createdAt: 260 });
  const r = await runUpdate({
    world: baseWorld({ local: [...without(H_M4), M4new] }),
    body: fullBody({ copy: [], refresh: [], delete: [{ copy: route(H_M4), id: M4new.id }], upgrade: null }),
  });
  const delT = r.calls.sign.map((c) => c.template).find((t) => t.kind === 5);
  assert(r.res.statusCode === 200 && delT, `got ${r.res.statusCode} ${brief(r.res.body)}`);
  assert(sameSet(tagsNamed(delT, 'e').map((e) => e[1]), [M4new.id, H_M4.id]),
    `ADR 0006 §3: an e for the newest version here and for the older one still on the relay; got ${brief(tagsNamed(delT, 'e'))}`);
  assert(same(tagsNamed(delT, 'a'), [['a', route(H_M4)]]), `ADR 0001 §6: one a, the copy's address; got ${brief(tagsNamed(delT, 'a'))}`);
  const row = resultFor(r.res.body, 'delete', DELETE_REFS);
  assert(placeOf(row, RELAY).copy === 'gone', `ADR 0006 §10: the relay honors only e, and its version was named → gone; got ${brief(row && row.places)}`);
});

test('H16: a re-copy is timed after my assistant\'s newest deletion request for that address, so this instance doesn\'t refuse it (ADR 0006 §3, §10)', async () => {
  const asked = deletionRequest({ address: copyAddress(H_S1), ids: [hex(0x6901)], createdAt: NOW + 100 });
  const r = await runUpdate({
    world: baseWorld({ local: [...H_EVENTS, asked], relay: [...H_EVENTS, asked] }),
    body: fullBody({ refresh: [], delete: [], upgrade: null }),
  });
  const t = r.calls.sign.map((c) => c.template).find((x) => x.kind === 39999 && dOf(x) === dFor(MY, route(H_S1)));
  assert(r.res.statusCode === 200 && t, `got ${r.res.statusCode} ${brief(r.res.body)}`);
  assert(Number(t.created_at) > NOW + 100, `ADR 0006 §3: created_at is later than the deletion request's (${NOW + 100}); got ${brief(t.created_at)}`);
  assert(placeOf(resultFor(r.res.body, 'copy', COPY_REFS), 'local').status === 'published', 'ADR 0006 §10: so this instance keeps the re-copy');
});

test('H17: no request body is ever signed — an event, tags, content, a name, a created_at, a method, a point of view or a cutoff smuggled into the body never reach sign; only what the server built from its own reads is signed (ADR 0006 § Context, security; Option B rejected; AC-10)', async () => {
  const SMUGGLED = { id: 'f'.repeat(64), kind: 39999, pubkey: A, created_at: 1, content: 'SMUGGLED content', sig: '0'.repeat(128), tags: [['d', 'SMUGGLED-d'], ['z', MY], ['name', 'SMUGGLED name']] };
  const body = fullBody({
    event: SMUGGLED, events: [SMUGGLED], tags: [['t', 'SMUGGLED-tag']], content: 'SMUGGLED content', created_at: 1,
    method: 'SMUGGLED-method', pov: OTHER, cutoff: 7,
    copy: [{ original: route(H_S1), version: H_S1.id, name: 'SMUGGLED name', content: 'SMUGGLED content', tags: [['t', 'SMUGGLED-tag']], event: SMUGGLED }],
    upgrade: { dropsMarker: false, tags: [['cutoff', '7']], event: SMUGGLED },
  });
  const r = await runUpdate({ body });
  const signed = r.calls.sign.map((c) => c.template);
  assert(!/SMUGGLED/.test(JSON.stringify(signed)), `ADR 0006: nothing from the body is signed; got ${brief(signed)}`);
  assert(!signed.some((t) => Number(t.created_at) === 1), 'ADR 0006: a created_at from the body is never used');
  assert(!signed.some((t) => (t.tags || []).some((x) => ['cutoff', 'pov', 'method'].includes(x[0]))), 'AC-10: the method, point of view and cutoff are never written');
  if (r.res.statusCode === 200) {
    const copyT = signed.find((t) => t.kind === 39999 && dOf(t) === dFor(MY, route(H_S1)));
    assert(copyT && same(copyT.tags.slice(4), [['name', 'akita']]) && copyT.content === H_S1.content, `ADR 0006 §3: the copy is built from the server's read of akita; got ${brief(copyT)}`);
  } else {
    assert(r.res.statusCode >= 400 && r.res.statusCode < 500 && signed.length === 0, `a body the server refuses is refused whole; got ${r.res.statusCode}`);
  }
});

test('H18: my header is the newest of the two places — the upgrade and its marker check read that one; a newer pointer header in either place makes the upgrade stale (ADR 0006 §2; story 5\'s review, Non-blocking 4)', async () => {
  const newerPointer = myHeader({ id: hex(0x7004), createdAt: 300, tags: [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'pointer']] });
  const stale = await runUpdate({ world: baseWorld({ relay: [...without(H_HEADER), newerPointer] }), body: fullBody({ copy: [], refresh: [], delete: [] }) });
  assert(stale.res.statusCode === 409 && !wrote(stale.calls), `ADR 0006 §2: a newer pointer header on the relay → the upgrade is stale; got ${stale.res.statusCode} ${brief(stale.res.body)}`);
  const newerMarked = myHeader({ id: hex(0x7005), createdAt: 300, tags: [['d', D], ['b', SENTINEL], ['names', 'dog', 'dogs'], ['b', SHARED, 'inherit-items']] });
  const w = () => baseWorld({ local: [...without(H_HEADER), newerMarked] });
  const wrong = await runUpdate({ world: w(), body: fullBody({ copy: [], refresh: [], delete: [], upgrade: { dropsMarker: false } }) });
  assert(wrong.res.statusCode === 409 && !wrote(wrong.calls), `ADR 0006 §3: the newest header carries the marker, so dropsMarker false is stale; got ${wrong.res.statusCode}`);
  const right = await runUpdate({ world: w(), body: fullBody({ copy: [], refresh: [], delete: [], upgrade: { dropsMarker: true } }) });
  const upT = right.calls.sign.map((c) => c.template).find((t) => t.kind === 39998);
  assert(right.res.statusCode === 200 && upT && same(upT.tags, [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'pointer']]),
    `Planning decision 2: the newest header is upgraded to a plain pointer header, its marker dropped; got ${right.res.statusCode} ${brief(upT)}`);
  assert(Number(upT.created_at) >= NOW, `ADR 0006 §3: created_at max(now, old + 1); got ${brief(upT.created_at)}`);
});

test('H19: my header must name the shared list as its one real link — no header in either place, only the marker, or two real links: refused, and nothing signed (ADR 0006 §2)', async () => {
  const twoLinks = myHeader({ id: hex(0x7006), createdAt: 150, tags: [['d', D], ['b', SHARED, 'inherit-items'], ['b', `39998:${OTHER}:${D}`, 'pointer']] });
  const onlyMarker = myHeader({ id: hex(0x7007), createdAt: 150, tags: [['d', D], ['b', SENTINEL]] });
  for (const [list, why] of [
    [without(H_HEADER), 'no header in either place'],
    [[...without(H_HEADER), onlyMarker], 'a header marked deliberately unaffiliated'],
    [[...without(H_HEADER), twoLinks], 'a header with two real links'],
  ]) {
    const r = await runUpdate({ world: makeWorld({ local: list, relay: list }), body: fullBody({ upgrade: null }) });
    assert(r.res.statusCode >= 400 && !(r.res.body && r.res.body.success === true), `ADR 0006 §2: ${why} → refused; got ${r.res.statusCode} ${brief(r.res.body)}`);
    assert(!wrote(r.calls), `ADR 0006 §2: ${why} → nothing signed or published`);
  }
});

test('H20: each call re-reads and re-checks, so a later call is judged against what earlier ones wrote — the same copy approved twice leaves one copy; the upgrade, alone in the last call, isn\'t done twice (ADR 0006 §6; AC-3, AC-6)', async () => {
  const w = baseWorld();
  const once = await runUpdate({ world: w, body: fullBody({ refresh: [], delete: [], upgrade: null }) });
  assert(once.res.statusCode === 200, `the first copy → 200; got ${once.res.statusCode} ${brief(once.res.body)}`);
  const twice = await runUpdate({ world: w, body: fullBody({ refresh: [], delete: [], upgrade: null }) });
  assert(twice.res.statusCode === 409 && !wrote(twice.calls), `AC-3: approving the same copy again is stale; got ${twice.res.statusCode}`);
  const held = w.local.events.filter((e) => e.kind === 39999 && e.pubkey === A && tagsNamed(e, 'q').some((q) => q[1] === H_S1.id));
  assert(held.length === 1, `AC-3: one copy, not two; got ${held.length}`);
  const up = await runUpdate({ world: w, body: fullBody({ copy: [], refresh: [], delete: [] }) });
  assert(up.res.statusCode === 200, `the upgrade alone → 200; got ${up.res.statusCode} ${brief(up.res.body)}`);
  const again = await runUpdate({ world: w, body: fullBody({ copy: [], refresh: [], delete: [] }) });
  assert(again.res.statusCode === 409 && !wrote(again.calls), `AC-6: the upgrade isn't offered, or done, twice; got ${again.res.statusCode}`);
});

test('H21: at most 4 publishes in flight per relay (ADR 0006 §4)', async () => {
  const extra = Array.from({ length: 9 }, (_, i) => sharedItem(`breed-${i}`, { id: hex(0x5400 + i) }));
  const r = await runUpdate({
    world: baseWorld({ local: [...H_EVENTS, ...extra], relay: [...H_EVENTS, ...extra] }),
    body: { list: MY, copy: extra.map((e) => ({ original: route(e), version: e.id })), refresh: [], delete: [], upgrade: null },
  });
  assert(r.res.statusCode === 200 && r.calls.publishRelay.length === 9, `nine copies, each sent once; got ${r.res.statusCode}, ${r.calls.publishRelay.length} sends`);
  assert((r.flight.max[RELAY] || 0) >= 1 && (r.flight.max[RELAY] || 0) <= 4, `ADR 0006 §4: at most 4 in flight per relay; got ${r.flight.max[RELAY]}`);
});

test('H22: a local import that fails is reported for its item — "failed", with the reason — and the rest are still reported, never a blanket error that hides what landed (ADR 0006 §4–§5; AC-8)', async () => {
  const r = await runUpdate({ knobs: { localPublish: (e) => (e.kind === 5 ? 'reject' : 'store') } });
  assert(r.res.statusCode === 200, `AC-8: a partial failure is a report, not an error; got ${r.res.statusCode} ${brief(r.res.body)}`);
  const del = resultFor(r.res.body, 'delete', DELETE_REFS);
  assert(placeOf(del, 'local').status === 'failed' && /boom/.test(String(placeOf(del, 'local').error)), `ADR 0006 §4: failed, with the reason; got ${brief(del)}`);
  assert(placeOf(resultFor(r.res.body, 'copy', COPY_REFS), 'local').status === 'published', 'AC-8: the copy that landed is reported as published');
});

test('H23: a refresh whose copy\'s d isn\'t the one derived from its original is refused, and nothing is signed — re-copying would make a second copy, not refresh this one (ADR 0006 §3)', async () => {
  const odd = copyEvent(H_S3b, { versionId: H_S3a.id, id: hex(0x6303), d: 'hand-made-copy' });
  const r = await runUpdate({
    world: baseWorld({ local: [...without(H_M3), odd], relay: [...without(H_M3), odd] }),
    body: fullBody({ copy: [], delete: [], upgrade: null, refresh: [{ copy: route(odd), original: route(H_S3b), version: H_S3b.id }] }),
  });
  assert(r.res.statusCode >= 400 && r.res.statusCode < 500 && !wrote(r.calls), `ADR 0006 §3: refused, nothing signed; got ${r.res.statusCode} ${brief(r.res.body)}`);
});

test('H24: the shared list, my list and my assistant\'s deletion requests are each read with limit 500, in both places; an answer of 500 events is capped → 503 { couldntCheck }, nothing signed; one of 499 is complete, and the call proceeds (ADR 0006 Amendment 1, rule 2)', async () => {
  const READS = [[isSharedRead, 'the shared list', /shared list/], [isMineRead, 'my list', /your list/], [isDeletionRead, 'my assistant\'s deletion requests', null]];
  const PLACES = [['local', 'this instance\'s strfry'], [RELAY, 'the list\'s relay']];
  const plain = await runUpdate();
  assert(plain.res.statusCode === 200, `the fixture's call succeeds; got ${plain.res.statusCode} ${brief(plain.res.body)}`);
  const asked = [...plain.calls.scan.map((f) => ['local', f]), ...plain.calls.readRelay.map((c) => [c.url, c.filter])];
  for (const [pred, what] of READS) {
    for (const [place, where] of PLACES) {
      const limits = asked.filter(([p, f]) => p === place && pred(f)).map(([, f]) => f.limit);
      assert(limits.length >= 1 && limits.every((l) => l === 500), `Amendment 1: ${what} is read on ${where} with limit 500 (LIST_ITEMS_LIMIT); got limits ${brief(limits)}`);
    }
  }
  for (const [pred, what, words] of READS) {
    for (const [place, where] of PLACES) {
      const sized = (n) => ({ answerSize: (p, f) => (p === place && pred(f) ? n : null) });
      const full = await runUpdate({ knobs: sized(500) });
      const b = full.res.body || {};
      assert(full.res.statusCode === 503 && Array.isArray(b.couldntCheck) && b.couldntCheck.length >= 1,
        `Amendment 1: ${what} on ${where} answering 500 events is capped → 503 { couldntCheck }; got ${full.res.statusCode} ${brief(b)}`);
      if (words) assert(b.couldntCheck.some((x) => words.test(x)), `Amendment 1: the 503 names ${what}; got ${brief(b.couldntCheck)}`);
      assert(!wrote(full.calls), `Amendment 1: ${what} capped on ${where} → nothing signed or published`);
      const under = await runUpdate({ knobs: sized(499) });
      assert(under.res.statusCode === 200 && under.calls.sign.length > 0,
        `Amendment 1: ${what} on ${where} answering 499 events is complete, so the call proceeds; got ${under.res.statusCode} ${brief(under.res.body)}`);
    }
  }
});

/* ── U: the curation util (UI, ESM) ────────────────────────── */

async function util() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.classifyEntry === 'function', 'ui/src/utils/treasureMap.js must load and export classifyEntry');
  return mod;
}
async function fn(name) {
  const mod = await util();
  assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0006 note 3)`);
  return mod[name];
}
const wrap = (list) => list.map((event) => ({ event, local: true }));
const record = (list, over = {}) => ({ items: wrap(list), local: 'ok', relay: 'ok', truncated: false, total: list.length, relayTruncated: false, ...over });
function verdictsFor(entries) {
  const byRouteId = Object.fromEntries(entries.map(([e, verdict, score]) => [route(e), { verdict, score, breakdown: [], reason: null }]));
  return { byRouteId, summary: { state: 'complete', qualifying: entries.filter(([, v]) => v === 'qualifies').length, total: entries.length, reason: null } };
}

// The planner's fixture (story 5's, with a kind-9999 candidate): copy akita and greyhound, skip beagle, refresh corgi,
// delete dingo, and upgrade the header.
const PS1 = sharedItem('akita', { id: hex(0xa001) });
const PS2 = sharedItem('beagle', { id: hex(0xa002) });
const PS3a = sharedItem('corgi', { id: hex(0xa003), createdAt: 100 });
const PS3b = sharedItem('corgi', { id: hex(0xa004), createdAt: 300 });
const PS4 = sharedItem('dingo', { id: hex(0xa005) });
const PS7 = sharedItem(null, { kind: 9999, id: hex(0xa007), name: 'greyhound' });
const PM3 = copyEvent(PS3b, { versionId: PS3a.id, id: hex(0xb003) });
const PM4 = copyEvent(PS4, { id: hex(0xb004) });
function planInput(over = {}) {
  return {
    assistantPubkey: A,
    header: { state: null, olderLink: true, problems: [], marker: false },
    mine: record([PM3, PM4]),
    shared: record([PS1, PS2, PS3b, PS4, PS7]),
    verdicts: verdictsFor([[PS1, 'qualifies', 2], [PS2, 'skipped', 1], [PS3b, 'qualifies', 3], [PS4, 'skipped', 0.5], [PS7, 'qualifies', 2.5]]),
    ...over,
  };
}
const intentCount = (x) => (!x || typeof x !== 'object' ? 0
  : ['copy', 'refresh', 'delete'].reduce((n, k) => n + (Array.isArray(x[k]) ? x[k].length : 0), 0) + (x.upgrade ? 1 : 0));

test('U1: planIntents — the canonical intents, which are also the request body: { original, version } per copy, { copy, original, version } per refresh, { copy, id } per delete, { dropsMarker } or null for the upgrade; no names or scores; the same whatever the entries\' order (ADR 0006 §1, §7)', async () => {
  const planIntents = await fn('planIntents');
  const R = (n) => `39999:${AUTHOR}:${n}`;
  const C = (n) => `39999:${A}:${COPY_D(n)}`;
  const plan = {
    state: 'ready', reasons: [], upToDate: false, unchanged: 1,
    keepFlagged: [{ name: 'eskimo', routeId: R('eskimo'), copyRouteId: C('eskimo'), score: 1, why: 'edited-not-qualifying' }],
    skipped: [{ name: 'beagle', routeId: R('beagle'), score: 1 }],
    copy: [{ name: 'akita', routeId: R('akita'), score: 2, version: hex(0xc1) }, { name: 'basenji', routeId: R('basenji'), score: 3, version: hex(0xc2) }],
    refresh: [{ name: 'corgi', routeId: R('corgi'), copyRouteId: C('corgi'), score: 3, version: hex(0xc3) }],
    delete: [{ name: 'dingo', routeId: R('dingo'), copyRouteId: C('dingo'), score: 0.5, copyId: hex(0xc4) }],
    upgrade: { dropsMarker: true },
  };
  const out = planIntents(plan);
  assert(out && typeof out === 'object', `ADR 0006 §7: planIntents(plan) gives the intents; got ${brief(out)}`);
  assert(Object.keys(out).every((key) => ['copy', 'refresh', 'delete', 'upgrade'].includes(key)), `ADR 0006 §1: only the four groups of intents; got keys ${brief(Object.keys(out))}`);
  assert(sameSet(out.copy, [{ original: R('akita'), version: hex(0xc1) }, { original: R('basenji'), version: hex(0xc2) }]), `ADR 0006 §1: copy: [{ original, version }], nothing else; got ${brief(out.copy)}`);
  assert(sameSet(out.refresh, [{ copy: C('corgi'), original: R('corgi'), version: hex(0xc3) }]), `ADR 0006 §1: refresh: [{ copy, original, version }]; got ${brief(out.refresh)}`);
  assert(sameSet(out.delete, [{ copy: C('dingo'), id: hex(0xc4) }]), `ADR 0006 §1: delete: [{ copy, id }]; got ${brief(out.delete)}`);
  assert(same(out.upgrade, { dropsMarker: true }), `ADR 0006 §1: upgrade: { dropsMarker }; got ${brief(out.upgrade)}`);
  const shuffled = {
    ...plan,
    copy: [...plan.copy].reverse().map((e) => ({ ...e, name: e.name.toUpperCase(), score: 99 })),
    refresh: plan.refresh.map((e) => ({ ...e, name: 'renamed', score: 0 })),
  };
  assert(same(planIntents(shuffled), out), `ADR 0006 §7: canonical — sorted, with no names or scores, so the same references in another order or rescored compare equal; got ${brief(planIntents(shuffled))} and ${brief(out)}`);
  assert(!same(planIntents({ ...plan, copy: [{ ...plan.copy[0], version: hex(0xc9) }, plan.copy[1]] }), out), 'ADR 0006 §7: a moved version gives different intents, so the comparison catches it');
  assert(!same(planIntents({ ...plan, upgrade: { dropsMarker: false } }), out), 'ADR 0006 §7: dropsMarker is part of the intents');
  const noUp = planIntents({ ...plan, upgrade: false });
  assert(noUp && noUp.upgrade == null, `ADR 0006 §1: no upgrade → upgrade null; got ${brief(noUp && noUp.upgrade)}`);
  for (const g of [{ state: 'blocked', reasons: ['x'], copy: [], refresh: [], delete: [], upgrade: false }, { state: 'checking' }, null, undefined, 'x']) {
    let o;
    try { o = planIntents(g); } catch (e) { throw new Error(`never throws — threw on ${brief(g)}: ${e.message}`); }
    assert(intentCount(o) === 0, `a plan that isn't ready gives no intents; got ${brief(o)} for ${brief(g)}`);
  }
});

test('U2: updatePlan\'s pins — copy and refresh entries carry version (the original\'s current id; a kind-9999 original\'s own id), delete entries carry copyId (the copy\'s current id), and the upgrade carries dropsMarker from header.marker (ADR 0006 §7)', async () => {
  const updatePlan = await fn('updatePlan');
  const p = updatePlan(planInput());
  assert(p && p.state === 'ready', `the fixture is ready; got ${brief(p && { state: p.state, reasons: p.reasons })}`);
  const copy = Object.fromEntries((p.copy || []).map((e) => [e.routeId, e]));
  assert(copy[route(PS1)] && copy[route(PS1)].version === PS1.id, `ADR 0006 §7: a copy entry carries version, the original's current id; got ${brief(p.copy)}`);
  assert(copy[route(PS7)] && copy[route(PS7)].version === PS7.id, `ADR 0006 §7: a kind-9999 original's version is its own id; got ${brief(p.copy)}`);
  assert((p.refresh || []).length === 1 && p.refresh[0].version === PS3b.id, `ADR 0006 §7: a refresh entry carries the edited original's current id, not the copy's old version; got ${brief(p.refresh)}`);
  assert((p.delete || []).length === 1 && p.delete[0].copyId === PM4.id, `ADR 0006 §7: a delete entry carries copyId, the copy's current id; got ${brief(p.delete)}`);
  assert(p.upgrade && p.upgrade.dropsMarker === false, `ADR 0006 §7: the upgrade carries dropsMarker: false for a header with no marker; got ${brief(p.upgrade)}`);
  const marked = updatePlan(planInput({ header: { state: null, olderLink: true, problems: [], marker: true } }));
  assert(marked.upgrade && marked.upgrade.dropsMarker === true, `ADR 0006 §7: header.marker → dropsMarker: true; got ${brief(marked.upgrade)}`);
  const plain = updatePlan(planInput({ header: { state: null, olderLink: false, problems: [], marker: false } }));
  assert(plain.state === 'ready' && !plain.upgrade, `no older link → no upgrade; got ${brief(plain.upgrade)}`);
});

test('U3: describeCurationHeader\'s marker — "b-tag-deferred" beside a real link is true; the marker alone (deliberately unaffiliated), a real link alone, no b, or no header is false (ADR 0006 §7)', async () => {
  const describe = await fn('describeCurationHeader');
  const h = (tags) => ({ id: nid(), kind: 39998, pubkey: A, created_at: 1, content: '', tags: [['d', D], ...tags] });
  const beside = describe(h([['b', SHARED, 'inherit-items'], ['b', SENTINEL]]), A);
  assert(beside && beside.marker === true && beside.deferred === false && beside.pointer && beside.pointer.coord === SHARED,
    `ADR 0006 §7: the marker beside a real link → marker true (the real link still wins); got ${brief(beside)}`);
  for (const [tags, why] of [[[['b', SENTINEL]], 'the marker alone'], [[['b', SHARED, 'pointer']], 'a real link alone'], [[], 'no b at all']]) {
    const out = describe(h(tags), A);
    assert(out && out.marker === false, `ADR 0006 §7: ${why} → marker false; got ${brief(out && out.marker)}`);
  }
  const none = describe(null, A);
  assert(none && none.marker === false, `no header → marker false; got ${brief(none && none.marker)}`);
});

test('U4: curateHereOffer — after the target check, "own" when the curating header points at a header by the viewer or by my assistant here; otherwise as before (ADR 0006 §8; AC-11, R2-2)', async () => {
  const offer = await fn('curateHereOffer');
  const row = { kind: 39998, d: D, pubkey: OTHER, relay: RELAY2, coord: `39998:${OTHER}:${D}`, routeId: `39998:${D}`, mine: false };
  const found = { event: { id: nid(), kind: 39998, pubkey: OTHER, created_at: 1, content: '', tags: [['d', D]] }, where: 'relay', checkedRelay: RELAY2 };
  const info = (pubkey, d = D) => ({ authoredByAssistant: true, pointer: { coord: `39998:${pubkey}:${d}`, type: 'pointer', kind: 39998, pubkey, d }, deferred: false, problems: [], notes: [], marker: false });
  const o = (over) => offer({ assistantPubkey: A, viewerPubkey: USER, row, assistantLookup: found, ...over });
  const OWN = { status: 'unavailable', reason: 'own' };
  assert(same(o({ info: info(USER) }), OWN), `ADR 0006 §8: a header by the viewer's own key → own; got ${brief(o({ info: info(USER) }))}`);
  assert(same(o({ info: info(A) }), OWN), `ADR 0006 §8: a header by my assistant here → own; got ${brief(o({ info: info(A) }))}`);
  assert(same(o({ info: info(A), viewerPubkey: undefined }), OWN), 'ADR 0006 §8: my assistant\'s is known without the viewer\'s pubkey');
  assert(same(o({ info: info(AUTHOR) }), { status: 'available', target: `39998:${AUTHOR}:${D}` }), 'someone else\'s shared header is still offered, as before');
  assert(same(o({ info: info(USER, 'dogs') }), { status: 'unavailable', reason: 'target' }), 'ADR 0006 §8: own comes after the target check');
  assert(same(o({ info: info(USER), assistantLookup: undefined }), { status: 'checking' }), 'the header\'s states still come first');
  assert(same(o({ info: info(USER), assistantPubkey: null }), { status: 'unavailable', reason: 'no-assistant' }), 'no assistant here still comes first');
});

test('U5: what the server composes, the next preview doesn\'t propose again — the copies (AC-3), the refresh (AC-4), the upgrade, with or without the marker (AC-6); and once a copy is deleted, its original is a candidate again (AC-5)', async () => {
  const composeCopy = ev('composeCopy');
  const composeUpgrade = ev('composeUpgrade');
  const updatePlan = await fn('updatePlan');
  const describe = await fn('describeCurationHeader');
  const signed = (t) => ({ ...t, created_at: Number(t.created_at), pubkey: A, id: nid(), sig: 's'.repeat(128) });
  const before = updatePlan(planInput());
  assert(before.copy.length === 2 && before.refresh.length === 1 && before.delete.length === 1 && before.upgrade, `the fixture proposes all four kinds; got ${brief(before)}`);
  const c1 = signed(composeCopy(composeArgs(PS1)));
  const c7 = signed(composeCopy(composeArgs(PS7)));
  const c3 = signed(composeCopy(composeArgs(PS3b, { existing: PM3 })));
  const after = updatePlan(planInput({ mine: record([c1, c7, c3, PM4]) }));
  assert(after.state === 'ready' && after.copy.length === 0, `AC-3: the copied candidates aren't proposed again; got ${brief(after.copy)}`);
  assert(after.refresh.length === 0, `AC-4: the refresh isn't offered again; got ${brief(after.refresh)}`);
  assert(after.unchanged === 3, `ADR 0005 §7: the three copies read as unchanged; got ${brief(after.unchanged)}`);
  const gone = updatePlan(planInput({ mine: record([c1, c7, c3]) }));
  assert(gone.delete.length === 0 && gone.skipped.some((e) => e.routeId === route(PS4)), `AC-5: with its copy gone, dingo is a candidate again (skipped at its score); got ${brief({ delete: gone.delete, skipped: gone.skipped })}`);
  for (const tags of [[['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'inherit-items']], [['d', D], ['b', SENTINEL], ['b', SHARED, 'inherit-items']]]) {
    const up = signed(composeUpgrade({ header: myHeader({ tags }), now: clock(NOW) }));
    const info = describe(up, A);
    assert(info.pointer && info.pointer.coord === SHARED && info.pointer.type === 'pointer' && !info.notes.includes('older-link') && info.deferred === false && info.marker === false,
      `AC-6: the upgraded header links with pointer, carries no marker, and isn't deliberately unaffiliated; got ${brief(info)}`);
    const next = updatePlan(planInput({ mine: record([c1, c7, c3]), header: { state: null, olderLink: info.notes.includes('older-link'), problems: info.problems, marker: info.marker } }));
    assert(next.state === 'ready' && !next.upgrade, `AC-6: the next preview doesn't offer the upgrade; got ${brief(next.upgrade)}`);
  }
});

/* ── S: structure ──────────────────────────────────────────── */

test('S1: UpdatePreview — "Publish these changes" on a ready plan that isn\'t up to date, and nothing to press otherwise; the marker clause when the upgrade drops the marker; story 5\'s closing line gone (ADR 0006 §7; AC-1, AC-6)', () => {
  const s = src(PREVIEW); const f = flat(s);
  assert(f.includes('Publish these changes'), 'ADR 0006 §7 / AC-1: the one action, "Publish these changes"');
  const notUpToDate = '(?:!\\s*[\\w.?]*upToDate\\b|upToDate\\s*(?:===\\s*false|!==\\s*true))';
  assert(new RegExp(`['"]ready['"][^;]*${notUpToDate}|${notUpToDate}[^;]*['"]ready['"]`).test(f), 'ADR 0006 §7: it shows only when the plan is ready and not up to date');
  assert(new RegExp(`, and remove its ${LQ}deliberately unaffiliated${RQ} marker`).test(f) && /\bdropsMarker\b/.test(s),
    'ADR 0006 §7 / AC-6: the upgrade line adds ", and remove its “deliberately unaffiliated” marker" when dropsMarker is set');
  assert(!new RegExp(`Nothing is signed: publishing isn${APOS}t built yet`).test(f), 'ADR 0006 §7: story 5\'s closing line goes');
});

test('S2: the publish run\'s words — the results per item and per place, "The list changed since you pressed Publish; here is the new preview.", and the server\'s refusals; the fresh plan compared through planIntents (ADR 0006 §2, §7; AC-2, AC-8, AC-9)', () => {
  const both = flat(`${src(PREVIEW)}\n${src(ITEMS)}`);
  for (const [re, what] of [
    [/(?:['"`>]|:\s)\s*published\b/, '"published"'],
    [/failed: /, '"failed: <reason>"'],
    [new RegExp(`sent, but .{1,80}?didn${APOS}t keep it`), '"sent, but <place> didn\'t keep it"'],
    [/not sent: this instance publishes locally only/, '"not sent: this instance publishes locally only"'],
    [/still shows it/, '"<place> still shows it"'],
    [/The list changed since you pressed Publish; here is the new preview\./, '"The list changed since you pressed Publish; here is the new preview."'],
  ]) assert(re.test(both), `ADR 0006 §7: the preview or the items section says ${what}`);
  assert(/planIntents\(/.test(both) && /import\s*\{[^}]*\bplanIntents\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/utils\/treasureMap['"]/.test(both),
    'ADR 0006 §7: the fresh plan is compared with the approved one through planIntents, from the util');
  assert(/\bcouldntCheck\b/.test(both) && /\b409\b|\.stale\b/.test(both), 'ADR 0006 §2: a 409 shows the fresh preview, and a 503 names what couldn\'t be checked');
});

// The send may run from an effect once the fresh plan settles (ADR 0006 §7, step 2), so what is pinned is that the press
// starts it — the button's onClick — and that nothing runs on a timer. "Only when pressed" is the local check's (note 6).
test('S3: the browser signs nothing — no signer or publisher in the preview or the items section; Publish posts to /api/dlist-curation/update, started by pressing "Publish these changes", never on a timer (ADR 0006 Option A; AC-1, AC-10)', () => {
  for (const f of [PREVIEW, ITEMS]) {
    assert(!/window\.nostr|signEvent|finalizeEvent|publishOrThrow|publishEverywhere|publishToRelays|\/api\/strfry\/publish|signAs/.test(src(f)),
      `ADR 0006 Option B rejected: ${rel(f)} signs and publishes nothing itself`);
  }
  const both = `${src(PREVIEW)}\n${src(ITEMS)}`;
  assert(/['"`]\/api\/dlist-curation\/update['"`]/.test(both) && /method:\s*['"]POST['"]/.test(both), 'ADR 0006 §7: Publish posts to /api/dlist-curation/update');
  const f = flat(src(PREVIEW));
  const at = f.indexOf('Publish these changes');
  assert(at >= 0 && /onClick=/.test(f.slice(Math.max(0, at - 300), at)), 'AC-1: pressing "Publish these changes" starts it — the button has its own onClick');
  assert(!/setInterval\(/.test(both), 'AC-10: nothing runs on a schedule');
});

test('S4: the epoch — the items section passes one epoch to useListItems, useItemVotes and useTrustWeights, and each hook takes it into its key or its effect\'s dependencies (ADR 0006 §7; AC-2, AC-8)', () => {
  const s = src(ITEMS);
  for (const hook of ['useListItems', 'useItemVotes', 'useTrustWeights']) {
    const calls = [...s.matchAll(new RegExp(`\\b${hook}\\(([^;]*?)\\)\\s*;`, 'g'))].map((m) => m[1]);
    assert(calls.length >= 1 && calls.every((a) => /\bepoch\b/.test(a)), `ADR 0006 §7: every ${hook}(…) call in the items section passes the epoch; got ${brief(calls)}`);
  }
  for (const f of [LIST_HOOK, VOTES_HOOK, WEIGHTS_HOOK]) {
    const h = src(f);
    const sig = (h.match(/export\s+default\s+function\s+\w+\s*\(([^)]*)\)/) || [])[1] || '';
    assert(/\bepoch\b/.test(sig), `ADR 0006 §7: ${rel(f)} takes the epoch; got (${sig})`);
    assert(/\bkey\s*=[^;\n]*\bepoch\b/.test(h) || /\}\s*,\s*\[[^\]]*\bepoch\b[^\]]*\]\s*\)/.test(h), `ADR 0006 §7: ${rel(f)} takes the epoch into its key or its effect's dependencies`);
  }
});

test('S5: the items section reads my assistant\'s deletion requests ({ kinds: [5], "#k": ["39999"] }) and flags a copy one names, "⚠️ deletion requested — still shown by <place>"; a deletion proposed again notes "(asked before)" (ADR 0006 §7; AC-9)', () => {
  const hookFiles = fs.readdirSync(HOOKS).filter((n) => /\.js$/.test(n)).map((n) => path.join(HOOKS, n));
  const pool = [ITEMS, UTIL, ...hookFiles].map(safeRead).join('\n');
  assert(/kinds:\s*\[\s*5\s*\]/.test(pool) && /['"]#k['"]\s*:\s*\[\s*['"]39999['"]\s*\]/.test(pool), 'ADR 0006 §7: the deletion-request read, { kinds: [5], authors: [assistant], "#k": ["39999"] }');
  const words = flat(`${safeRead(ITEMS)}\n${safeRead(PREVIEW)}`);
  assert(new RegExp(`deletion requested ${DASH} still shown by`).test(words), 'ADR 0006 §7 / AC-9: the flag, "⚠️ deletion requested — still shown by <place>"');
  assert(/\(asked before\)/.test(`${words}\n${flat(safeRead(UTIL))}`), 'ADR 0006 §7: a copy proposed for deletion again notes "(asked before)"');
});

test('S6: the detail page passes marker in headerState, viewerPubkey to curateHereOffer, and the header lookup\'s refresh to the items section (ADR 0006 §7–§8; note 4)', () => {
  const s = src(DETAIL); const f = flat(s);
  const hs = (f.match(/const\s+headerState\s*=.*?\};/) || [''])[0];
  assert(/\bmarker\b/.test(hs), `ADR 0006 §7: headerState carries marker; got ${brief(hs)}`);
  assert(/curateHereOffer\(\s*\{[^}]*\bviewerPubkey\b/.test(f), 'ADR 0006 §8: curateHereOffer({ …, viewerPubkey })');
  assert(/refresh/i.test(element(s, 'ItemsSection')), `ADR 0006 §7: the items section gets the header lookup's refresh(); got ${element(s, 'ItemsSection') || '(none)'}`);
});

test('S7: CurateHereOffer — REASON_TAILS.own: "You can\'t curate it here: the shared list it curates is yours, or your assistant\'s." (ADR 0006 §8; AC-11)', () => {
  const f = flat(src(OFFER));
  const tails = (f.match(/const\s+REASON_TAILS\s*=\s*\{.*?\};/) || [''])[0];
  assert(/(?:\bown|['"]own['"])\s*:/.test(tails), `ADR 0006 §8: REASON_TAILS gains own; got ${brief(tails.slice(0, 160))}`);
  assert(new RegExp(`: the shared list it curates is yours, or your assistant${APOS}s\\.`).test(tails), 'ADR 0006 §8: its sentence, exact');
});

test('S8: the DList Curation panel\'s 409 sentence names the actual conflict — the offer\'s sentence, never "pointing elsewhere"; the b tags still print beneath it (ADR 0006 §9; AC-11)', () => {
  const s = src(PANEL); const f = flat(s);
  assert(f.includes('Your assistant already has a header for this list with a different link; it was not changed.'), 'ADR 0006 §9: the offer\'s sentence');
  assert(!/pointing elsewhere/.test(f), 'ADR 0006 §9: no "pointing elsewhere"');
  assert(/error\.b\b/.test(s), 'ADR 0006 §9: the b tags still print beneath it');
});

test('S9: the server modules — updateEvents.js is pure; update.js chooses the key only through getKeys, never isOwner; neither reaches the brain-writing publish path or the graph, runs a shell, or carries a pubkey literal; nostr-tools and ws load with the fallback (ADR 0006 § Context, security; notes 1–2)', () => {
  const e = src(EVENTS_MOD); const u = src(UPDATE_MOD); const idx = src(CURATION_INDEX);
  assert(!/require\(\s*['"][^'"]*(?:nostr-tools|child_process)[^'"]*['"]\s*\)|require\(\s*['"](?:[^'"]*\/)?ws['"]\s*\)/.test(e), 'ADR 0006 note 1: updateEvents.js is pure — it requires no nostr-tools, ws or child_process');
  assert(!/\bisOwner\b|isOwnerOrAdmin|getOwnerAssistantKeys/.test(u), 'ADR 0006 security: the key is getAssistantKeys(session pubkey) only — never isOwner, which admits admins (row 269)');
  assert(!/\/api\/strfry\/publish|signAs/.test(u + e), 'AC-7: not the brain-writing publish path, and not Simple Lists\' signer');
  for (const forbidden of ['neo4j', 'eventSync', 'executeCypher', 'buildImportCypher', 'firmware']) {
    assert(!new RegExp(`require\\([^)]*${forbidden}`).test(u + e), `principle 4: nothing here can write the graph (${forbidden})`);
  }
  assert(!/\bexecSync\b|\bexecFile\b|child_process['"]\s*\)\s*\.exec\b|\{[^}]*\bexec\b[^}]*\}\s*=\s*require\(\s*['"]child_process['"]\s*\)/.test(u + e),
    'ADR 0006 § Context: scans run with spawn and an argument list, never a shell');
  assert(!/[0-9a-fA-F]{64}/.test(u) && !/[0-9a-fA-F]{64}/.test(e), 'CLAUDE.md (per-deployment TA pubkey): no 64-hex literal');
  const loader = u + idx;
  assert(/require\(\s*['"]nostr-tools['"]\s*\)/.test(loader) && /require\(\s*['"]ws['"]\s*\)/.test(loader), 'ADR 0006 § Context: nostr-tools and ws load with the fallback (publishEvent.js:16–23; row 271)');
});

test('S10: POST /api/dlist-curation/update is registered from src/api/dlist-curation/index.js beside the header route, and no owner-only substring rule in the auth middleware catches it (ADR 0006 §1; note 2)', () => {
  let mod;
  try { mod = require(CURATION_INDEX); } catch (err) { throw new Error(`src/api/dlist-curation/index.js must load: ${err.message}`); }
  const routes = [];
  const app = { post: (p) => routes.push(`POST ${p}`), get: (p) => routes.push(`GET ${p}`), put() {}, delete() {}, use() {} };
  try { mod.register(app); } catch (err) { throw new Error(`register(app) must run here without the container: ${String((err && err.message) || err).slice(0, 160)}`); }
  assert(routes.includes('POST /api/dlist-curation/update'), `ADR 0006 §1 / note 2: POST /api/dlist-curation/update is registered; got ${brief(routes)}`);
  assert(routes.includes('POST /api/dlist-curation/header'), 'the header route stays registered');
  const auth = src(AUTH);
  const subs = ['customerOrOwnerEndpoints', 'ownerOnlyEndpoints', 'ownerOnlyGetEndpoints']
    .flatMap((n) => [...(((auth.match(new RegExp(`const\\s+${n}\\s*=\\s*\\[([\\s\\S]*?)\\]`)) || [])[1]) || '').matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]));
  assert(subs.length > 10, `the auth middleware's owner-only lists were read; got ${subs.length} entries`);
  const caught = subs.filter((x) => '/api/dlist-curation/update'.includes(x));
  assert(caught.length === 0, `ADR 0006 § Context: no owner-only substring catches the route; caught by ${brief(caught)}`);
});

/* ── D: docs ───────────────────────────────────────────────── */

const SUPERSEDED_NOTE = /^> \*\*Superseded in part \(\d{4}-\d{2}-\d{2}\):\*\*[^\n]*`curated-dlist-update` ADR 0006[^\n]*/m;

test('D1: curated-dlist-update ADRs 0002, 0003 and 0005 each carry a Status parenthetical and a one-line "Superseded in part" note citing curated-dlist-update ADR 0006 by short name, and naming what it supersedes (ADR 0006 §11)', () => {
  for (const [p, names, what] of [
    [CDU_ADR_2, /Consequences|older/, 'its Consequences (which headers the upgrade takes)'],
    [CDU_ADR_3, /Option C[\s\S]*(?:§5|\bown\b)|(?:§5|\bown\b)[\s\S]*Option C/, 'Option C\'s follow-up and §5\'s availability'],
    [CDU_ADR_5, /§7[\s\S]*§8|§8[\s\S]*§7/, '§7\'s entries and §8\'s closing line'],
  ]) {
    const s = src(p);
    const status = (s.match(/^\*\*Status:\*\*[^\n]*/m) || [''])[0];
    assert(/`curated-dlist-update` ADR 0006/.test(status), `ADR 0006 §11: ${rel(p)}'s Status line cites \`curated-dlist-update\` ADR 0006; got ${JSON.stringify(status)}`);
    const note = (s.match(SUPERSEDED_NOTE) || [''])[0];
    assert(note, `ADR 0006 §11: ${rel(p)} has a one-line "Superseded in part" note citing \`curated-dlist-update\` ADR 0006`);
    assert(names.test(note), `ADR 0006 §11: ${rel(p)}'s note names ${what}; got …${note.slice(0, 300)}`);
    assert(!/decisions\/curated-dlist-update\/0006/.test(s), `ADR 0006 §11: ${rel(p)} cites ADR 0006 by short name, not by path`);
  }
});

test('D2: OPEN.md carries the three rows ADR 0006 records, each OPEN, matched by what they say and not by number — the inactive-customer key gap, the header endpoint\'s local never-clobber read and status-only classification, and the community relay\'s strfry 1.0.4 honoring only e deletions (ADR 0006 § Consequences; note 5)', () => {
  const rows = src(OPEN).split('\n').filter((l) => /^\| \d+ \|/.test(l));
  for (const [tests, what] of [
    [[/getCustomerRelayKeys/, /\bactive\b|inactive|deactivat/i], 'the inactive-customer key gap (getCustomerRelayKeys never checks that a customer is active)'],
    [[/never-clobber/i, /\blocal/i, /classif/i, /nostr-tools/i, /header/i], 'the header endpoint\'s local never-clobber read and its status-only relay classification (tied to the nostr-tools range)'],
    [[/1\.0\.4/, /delet/i, /1\.1(?:\.0)?\b/], 'the community relay\'s strfry 1.0.4, which honors only e deletions (fixed by its upgrade to 1.1.0 or later)'],
  ]) {
    const hits = rows.filter((l) => tests.every((re) => re.test(l)));
    assert(hits.length >= 1, `ADR 0006 § Consequences: OPEN.md has a row for ${what}`);
    assert(hits.some((l) => /\| OPEN \|/.test(l)), `ADR 0006 § Consequences: the row for ${what} is OPEN`);
  }
});

/* ── R: sentinels (pass before and after) ─────────────────── */

test('R1: the header endpoint still answers 409 on a conflict, and signs nothing (ADR 0006 Option D rejected; AC-10)', async () => {
  let mod;
  try { mod = require(CURATION_INDEX); } catch (err) { throw new Error(`src/api/dlist-curation/index.js must load: ${err.message}`); }
  const community = { id: hex(0xe001), kind: 39998, pubkey: AUTHOR, created_at: 1, content: '', sig: 's'.repeat(128), tags: [['d', D], ['names', 'dog', 'dogs'], ['b', SHARED, 'pointer']] };
  const existing = { id: hex(0xe002), kind: 39998, pubkey: A, created_at: 2, content: '', sig: 's'.repeat(128), tags: [['d', D], ['b', SHARED, 'inherit']] };
  let signedCount = 0;
  const handler = mod.createAuthorCurationHeaderHandler({
    requireAuth: () => USER,
    getAssistantKeys: async () => ({ privkey: PRIV, pubkey: A }),
    fetchFromRelays: async () => [community],
    scanLocal: async (f) => (Array.isArray(f.authors) && f.authors[0] === A ? [existing] : []),
    publishLocal: async () => 'ok',
    publishToRelays: async () => [],
    isLocalOnly: () => false,
    getDListRelays: () => [RELAY],
    sign: (t) => { signedCount += 1; return { ...t, id: hex(0xe003), pubkey: A, sig: 's'.repeat(128) }; },
    now: () => NOW,
  });
  const res = fakeRes();
  await handler({ method: 'POST', path: '/api/dlist-curation/header', session: { authenticated: true, pubkey: USER }, body: { target: SHARED } }, res);
  assert(res.statusCode === 409 && res.body && res.body.success === false && signedCount === 0, `the header endpoint's never-clobber 409 is unchanged; got ${res.statusCode} ${brief(res.body)}`);
});

test('R2: Simple Lists is untouched — it still asks useTrustWeights for its own pubkeys with no epoch, scores through the shared rule, shows its weights warning, and never calls Update\'s endpoint (AC-10)', () => {
  const s = src(SIMPLE);
  assert(/useTrustWeights\(\s*allPubkeys\s*\)/.test(s), 'Simple Lists calls useTrustWeights(allPubkeys), as today');
  assert(/from\s*['"]\.\.\/\.\.\/utils\/dlistScore['"]/.test(s) && /\{trustError\s*&&/.test(s), 'its scoring rule and its weights warning are unchanged');
  assert(!/dlist-curation\/update|\bepoch\b/.test(s), 'Simple Lists neither publishes through Update nor takes its epoch');
});

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
  console.log(`curated-dlist-update-publish: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
