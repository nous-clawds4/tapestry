/**
 * Story feed-usability #2: "Load more" pagination on the feed surfaces.
 * ADR feed-usability/0002. See engineering-team/stories/feed-usability/2-feed-pagination.test-plan.md
 *
 * ADR chose: (1) an optional `until` (Unix-seconds) relay cursor threaded into
 * buildFeed / buildUserNotes → the kind-1 relay filter; (2) accumulating hooks
 * (useFeed / useUserNotes) that append strictly-older pages, dedup by id, track the
 * oldest created_at as the cursor, and expose loadMore / loadingMore / exhausted
 * (mirroring useTagIndex's machine); (3) react-virtuoso window-scroll virtualization
 * for bounded live DOM, with a Footer hosting the explicit "Load more" button /
 * loading / end-of-history states; (4) a truthful, count-derived indicator replacing
 * the fixed "Showing the most recent 50 notes." Reply filtering stays CLIENT-side
 * (ADR 0001) and the cursor walks the RAW stream, so pagination composes with the toggle.
 *
 * TEST LEVELS:
 *  - Server (SF, SU): EXECUTE the real read-path modules with injected deps — a
 *    querySync fake that RECORDS the filter and returns notes by `filter.until`. Proves
 *    the cursor is threaded, junk is ignored, page-1 is unchanged, order/cap hold. No
 *    live relays/strfry/Neo4j.
 *  - UI (H, P): source-regex sentinels (no JSX transpile in this runner) on the hooks
 *    and pages — the accumulation machine, the Virtuoso render, the Footer/loadMore
 *    wiring, the truthful indicator, and the react-virtuoso dependency.
 *  - Regression (R): the ADR-0001 reply toggle still composes; the pre-existing empty
 *    states survive; both read paths still funnel through the shared enrichNotes.
 *
 * The bounded-DOM / scroll-restore RUNTIME property is the cycle-local browser smoke
 * before review (house feedback), not this suite — virtuoso owns windowing; we pin that
 * the page delegates to it.
 *
 * ALL SF/SU/H/P tests FAIL pre-implementation; R tests pass before and after.
 */

const fs = require('fs');
const path = require('path');

const FEED_MODULE = path.resolve(__dirname, '../src/api/feed/feedReadPath.js');
const NOTES_MODULE = path.resolve(__dirname, '../src/api/notes/userNotesReadPath.js');
const FEED_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormFeed.jsx');
const NOTES_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormUserNotes.jsx');
const FEED_HOOK = path.resolve(__dirname, '../ui/src/hooks/useFeed.js');
const NOTES_HOOK = path.resolve(__dirname, '../ui/src/hooks/useUserNotes.js');
const UI_PKG = path.resolve(__dirname, '../ui/package.json');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadFresh(p) {
  try { delete require.cache[require.resolve(p)]; } catch { /* fine */ }
  try { return require(p); } catch { return null; }
}
function bodyHelper(src, names) {
  const m = src.match(new RegExp(`function\\s+(${names.join('|')})\\s*\\(`));
  return m ? src.slice(m.index) : src;
}

// ---------------------------------------------------------------------------
// Fixtures — a small kind-1 corpus + the injectable fakes. querySync RECORDS the
// filter it receives and returns the corpus notes at-or-before filter.until.
// ---------------------------------------------------------------------------
const HEX = (c) => c.repeat(64);
const SOURCE = HEX('a');   // logged-in source identity (feed) — wins over House PoV
const FOLLOW = HEX('1');   // the one followed author (feed) AND the viewed author (notes)

function kind1(id, author, createdAt) {
  return { id, kind: 1, pubkey: author, created_at: createdAt, content: 'c-' + id, tags: [] };
}
// The corpus (newest → oldest). A load-more with until=200 must yield the ≤200 slice.
const CORPUS = [kind1('n300', FOLLOW, 300), kind1('n200', FOLLOW, 200), kind1('n100', FOLLOW, 100)];

function makeQuerySync(record) {
  return async (relays, filter) => {
    record.push(filter);
    const until = filter.until;
    let out = CORPUS.filter(ev => until == null ? true : ev.created_at <= until);
    if (filter.limit) out = out.slice(0, filter.limit);
    return out;
  };
}
// Local strfry fake: kind-3 follow list for the feed source; no kind-0 (null profiles).
function feedScanStrfry(filter) {
  if (filter && Array.isArray(filter.kinds) && filter.kinds.includes(3)) {
    return [{ id: 'k3', kind: 3, pubkey: SOURCE, created_at: 10, tags: [['p', FOLLOW]] }];
  }
  return [];
}
const relaySetCypher = async () => ([
  { json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://set-a.example' } }) },
]);

async function callFeed(mod, { until } = {}) {
  assert(mod && typeof mod.buildFeed === 'function', 'feedReadPath.js must export buildFeed.');
  const record = [];
  const deps = { getSettings: () => ({}), scanStrfry: feedScanStrfry, runCypher: relaySetCypher, querySync: makeQuerySync(record) };
  const res = await mod.buildFeed({ sessionPubkey: SOURCE, until, deps, ...deps });
  return { res, record };
}
async function callNotes(mod, { until, limit } = {}) {
  assert(mod && typeof mod.buildUserNotes === 'function', 'userNotesReadPath.js must export buildUserNotes.');
  const record = [];
  const deps = { scanStrfry: () => [], runCypher: relaySetCypher, querySync: makeQuerySync(record) };
  const res = await mod.buildUserNotes({ pubkey: FOLLOW, limit, until, deps, ...deps });
  return { res, record };
}

// ===========================================================================
// SERVER — the `until` relay cursor (AC "loading appends older, in order")
// ===========================================================================

test('SF1: buildFeed page 1 (no until) sends NO `until` to the relay filter (unchanged first page)', async () => {
  const { res, record } = await callFeed(loadFresh(FEED_MODULE), {});
  assert(record.length >= 1, 'buildFeed must query the relays once for page 1.');
  assert(record[0].until === undefined,
    `page 1 must NOT set an \`until\` on the relay filter (it is the most-recent page); got until=${record[0].until}.`);
  assert(res.status === 'OK' && res.items.length === 3,
    `page 1 must return the OK feed of all 3 corpus notes; got status=${res.status}, items=${res.items && res.items.length}.`);
});

test('SF2: buildFeed threads a string `until` (req.query is a string) into the relay filter as a number', async () => {
  const { res, record } = await callFeed(loadFresh(FEED_MODULE), { until: '200' });
  assert(record[0].until === 200,
    `buildFeed must coerce the query \`until\` ("200") to the numeric relay cursor 200; got ${JSON.stringify(record[0].until)} (absent/uncoerced pre-implementation).`);
  const ids = res.items.map(i => i.id);
  assert(JSON.stringify(ids) === JSON.stringify(['n200', 'n100']),
    `with until=200 the page must be the strictly-older-or-equal slice newest-first ['n200','n100']; got ${JSON.stringify(ids)}. (The boundary note n200 is deduped client-side by id.)`);
});

test('SF3: buildFeed ignores a junk `until` rather than corrupting the filter', async () => {
  const { record } = await callFeed(loadFresh(FEED_MODULE), { until: 'not-a-number' });
  assert(record[0].until === undefined,
    `a non-numeric \`until\` must be ignored (no NaN/garbage on the relay filter); got ${JSON.stringify(record[0].until)}.`);
});

test('SU1: buildUserNotes page 1 (no until) sends NO `until`; OK with the full corpus', async () => {
  const { res, record } = await callNotes(loadFresh(NOTES_MODULE), {});
  assert(record[0].until === undefined, `notes page 1 must not set until; got ${record[0].until}.`);
  assert(res.status === 'OK' && res.items.length === 3, `notes page 1 must be OK with 3 items; got ${res.status}/${res.items && res.items.length}.`);
});

test('SU2: buildUserNotes threads a numeric `until` cursor and returns the older slice newest-first', async () => {
  const { res, record } = await callNotes(loadFresh(NOTES_MODULE), { until: '200' });
  assert(record[0].until === 200, `buildUserNotes must coerce until "200" → 200 on the filter; got ${JSON.stringify(record[0].until)}.`);
  const ids = res.items.map(i => i.id);
  assert(JSON.stringify(ids) === JSON.stringify(['n200', 'n100']),
    `until=200 must yield ['n200','n100'] newest-first; got ${JSON.stringify(ids)}.`);
});

test('SU3: buildUserNotes ignores a junk `until`', async () => {
  const { record } = await callNotes(loadFresh(NOTES_MODULE), { until: 'xyz' });
  assert(record[0].until === undefined, `junk until must be ignored; got ${JSON.stringify(record[0].until)}.`);
});

test('SU4: the notes handler forwards req.query.until into buildUserNotes (wiring)', () => {
  const src = safeRead(NOTES_MODULE);
  assert(/handleGetUserNotes/.test(src), 'userNotesReadPath.js must export the handler.');
  assert(/until\s*:\s*req\.query\.until/.test(src),
    'handleGetUserNotes must pass `until: req.query.until` into buildUserNotes (so the client cursor reaches the read path).');
});

test('SF4: the feed handler forwards req.query.until into buildFeed (wiring)', () => {
  const src = safeRead(FEED_MODULE);
  assert(/until\s*:\s*req\.query\.until/.test(src),
    'handleGetFeed must pass `until: req.query.until` into buildFeed.');
});

// ===========================================================================
// UI — the accumulating hooks (AC "appends without duplicates" + "loading state"
// + "exhaustion" + no double-append)
// ===========================================================================

function hookChecks(src, label, urlPattern) {
  assert(src.length > 0, `${label} missing — unexpected.`);
  assert(new RegExp(urlPattern).test(src),
    `${label}: load-more must fetch with the \`until\` cursor on the URL (pattern ${urlPattern}).`);
  assert(/until/.test(src), `${label}: the hook must build/track an \`until\` cursor.`);
  assert(/loadMore/.test(src), `${label}: the hook must expose a loadMore callback (the "Load more" control calls it).`);
  assert(/loadingMore/.test(src), `${label}: the hook must expose a loadingMore flag (AC: loading state visible).`);
  assert(/exhausted/.test(src), `${label}: the hook must expose an exhausted flag (AC: exhaustion signalled).`);
  // Append, not replace: a spread of prior items on the success path.
  assert(/\[\s*\.\.\.\s*\w+\s*,/.test(src) || /\.concat\s*\(/.test(src),
    `${label}: a load-more page must be APPENDED to the held items ([...prev, ...new] / concat), not replace them (AC: appends older notes).`);
  // Dedup by id (Set/seen/ids) so the until-boundary note doesn't double.
  assert(/\bid\b/.test(src) && /(new Set|\.has\(|seen|Ids)/.test(src),
    `${label}: appended pages must be deduped by note id (the until-boundary note reappears at created_at===until) — AC: no note twice.`);
  // Stale/double-click guard (mirror useTagIndex): a live-seq ref, a cancelled flag,
  // or an in-flight guard, so repeated activation while loading makes no duplicates.
  assert(/liveSeqRef|cancelled|AbortController|if\s*\(\s*loadingMore\s*\)/.test(src),
    `${label}: must guard against stale/concurrent load-more completions (AC: repeated activation while loading → no duplicate entries).`);
}

test('H1: useFeed accumulates pages via an `until` cursor with loadMore/loadingMore/exhausted', () => {
  hookChecks(safeRead(FEED_HOOK), 'useFeed.js', 'until=\\$\\{');
});

test('H2: useUserNotes accumulates pages via an `until` cursor with loadMore/loadingMore/exhausted', () => {
  hookChecks(safeRead(NOTES_HOOK), 'useUserNotes.js', 'until=\\$\\{');
});

test('H3: both hooks return data=null until page 1 resolves (so the loading gate `loading && !data` fires, not the empty state)', () => {
  // Regression guard: the accumulating hooks must NOT hand the page an always-truthy `data`
  // object before the first response, or the page shows "no notes" instead of the loading line.
  for (const [p, label] of [[FEED_HOOK, 'useFeed.js'], [NOTES_HOOK, 'useUserNotes.js']]) {
    const src = safeRead(p);
    assert(/data\s*=\s*[^;\n]*\bstatus\b[^;\n]*\?\s*null/.test(src),
      `${label}: the returned \`data\` must be gated to null until page 1 resolves (e.g. \`status == null ? null : { … }\`), so the page's \`loading && !data\` shows the loading line and does not fall through to the empty state.`);
  }
});

// ===========================================================================
// UI — the virtualized render + Footer + truthful indicator (AC "bounded live
// content", "control appears", "exhaustion", "indicator truthful")
// ===========================================================================

function pageChecks(src, label, helperNames, indicatorClass) {
  assert(src.length > 0, `${label} missing — unexpected.`);
  // react-virtuoso virtualization (bounded DOM).
  assert(/from\s+['"]react-virtuoso['"]/.test(src) && /\bVirtuoso\b/.test(src),
    `${label}: must import { Virtuoso } from 'react-virtuoso' and render it (ADR 0002 §3A — bounded live content).`);
  const body = bodyHelper(src, helperNames);
  // The OK branch delegates to Virtuoso, rendering each note via the shared NoteCard.
  assert(/<Virtuoso\b/.test(body),
    `${label}: the OK branch must render <Virtuoso …> (windowed list), not a plain items.map.`);
  assert(/itemContent=\{/.test(body) && /<NoteCard\b[^>]*\bitem=\{/.test(body),
    `${label}: Virtuoso itemContent must render the shared <NoteCard item={…} /> for each note.`);
  // The Footer hosts the explicit Load more / loading / exhausted states, wired to loadMore.
  assert(/Footer/.test(body) && /loadMore/.test(body),
    `${label}: a Virtuoso Footer must host the "Load more" control wired to loadMore (explicit control — NOT endReached/auto-scroll).`);
  assert(!/endReached/.test(src),
    `${label}: must NOT wire endReached — "Load more" is an explicit control, not infinite scroll (story Out of scope).`);
  // Truthful, count-derived indicator — NOT the fixed "most recent 50" literal.
  assert(!/Showing the most recent 50 notes\./.test(src),
    `${label}: the fixed "Showing the most recent 50 notes." indicator must be replaced by a truthful count (AC: indicator reflects what is actually shown).`);
  assert(new RegExp(indicatorClass).test(src) && /\.length\b/.test(body),
    `${label}: the indicator must be derived from the shown item count (…\.length), so it stays truthful as pages load and the toggle filters.`);
  // End-of-history copy exists (meaning: no more / end / caught up / that's all).
  assert(/no more|end of|caught up|that'?s all|nothing more|reached the/i.test(src),
    `${label}: must define an end-of-history message for the exhausted state (AC: exhaustion signalled, not a dead button).`);
  // The pure helper receives the pagination fields (kept pure — components/callbacks only).
  assert(new RegExp(`(${helperNames.join('|')})\\s*\\(\\s*\\{[^}]*loadMore`).test(src),
    `${label}: the pure render helper must receive loadMore/loadingMore/exhausted in its args (view-time wiring; still a pure function of its args).`);
}

test('P1: BrainstormFeed renders a virtualized Virtuoso list with a Load-more Footer + truthful indicator', () => {
  pageChecks(safeRead(FEED_PAGE), 'BrainstormFeed.jsx', ['renderFeedState', 'FeedBody'], 'bsp-feed-indicator');
});

test('P2: BrainstormUserNotes renders a virtualized Virtuoso list with a Load-more Footer + truthful indicator', () => {
  pageChecks(safeRead(NOTES_PAGE), 'BrainstormUserNotes.jsx', ['renderUserNotesState'], 'bsp-notes-indicator');
});

test('P3: react-virtuoso is a declared ui dependency (ADR 0002 §Impl — the one new UI dep)', () => {
  const pkg = safeRead(UI_PKG);
  assert(pkg.length > 0, 'ui/package.json missing — unexpected.');
  let json = {}; try { json = JSON.parse(pkg); } catch { /* fall through */ }
  assert(json.dependencies && json.dependencies['react-virtuoso'],
    "ui/package.json must declare 'react-virtuoso' in dependencies (ADR-approved virtualization lib).");
});

// ===========================================================================
// REGRESSION — pagination composes with the ADR-0001 toggle; nothing pre-existing lost
// ===========================================================================

test('R1: the ADR-0001 reply toggle still composes — mode filter + isReply + REPLY_ONLY survive on both pages', () => {
  for (const [p, helper] of [[FEED_PAGE, ['renderFeedState', 'FeedBody']], [NOTES_PAGE, ['renderUserNotesState']]]) {
    const src = safeRead(p);
    const body = bodyHelper(src, helper);
    assert(/\bmode\b/.test(body) && /isReply/.test(body) && /\.filter\s*\(/.test(body),
      `${path.basename(p)}: the Notes|Notes+Replies filter (mode + isReply + filter) from ADR 0001 must still be present — pagination feeds the SAME filtered render (AC: composes with the toggle).`);
    assert(/REPLY_ONLY/.test(src),
      `${path.basename(p)}: the reply-only empty state (ADR 0001) must survive.`);
  }
});

test('R2: pre-existing empty states survive — /feed three states + notes-page EMPTY copy', () => {
  const feed = safeRead(FEED_PAGE);
  for (const key of ['NO_SOURCE', 'FOLLOW_UNAVAIL', 'NO_NOTES']) {
    assert(new RegExp(`${key}\\s*:`).test(feed), `FEED_COPY.${key} must remain (pagination must not disturb the empty states).`);
  }
  const notes = safeRead(NOTES_PAGE);
  assert(/EMPTY\s*:\s*["'][^"']*kind-1[^"']*["']/i.test(notes),
    'NOTES_COPY.EMPTY ("no kind-1 events could be located") must remain.');
});

test('R3: both read paths still funnel through the shared enrichNotes (item shape incl. isReply unchanged)', () => {
  for (const m of [FEED_MODULE, NOTES_MODULE]) {
    const src = safeRead(m);
    assert(/enrichNotes\s*\(/.test(src) && /require\(['"]\.\.\/_shared\/noteEnrichment['"]\)/.test(src),
      `${path.basename(m)}: must still call the shared enrichNotes — pagination changes selection, not the item shape.`);
  }
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
