/**
 * Story dlist-item-tagging #9 — "Paginate the lists index and count only the visible page".
 *
 * Story: engineering-team/stories/dlist-item-tagging/9-paginate-the-lists-index.md
 * Design note (Light lane): in that story file. No ADR (additive read endpoint, no wire format).
 *
 * The claim under test: the `/lists` index stops paying an O(relay) counts cost. It pages
 * headers 50 at a time and counts only the coordinates on the visible page, through a NEW
 * bounded endpoint `GET /api/dlists/page-counts` backed by `src/api/dlists/pageCounts.js`.
 * The old whole-relay `/api/dlists/item-counts` is left byte-unchanged for its other consumer.
 *
 * Test levels (handle legend, used by the story's AC→handle lines):
 *   U*  — BEHAVIORAL. `countsForCoords(coords, deps)` is server CJS and is called for real
 *         with an injected counter (`deps.countFilter`), so no strfry binary, no relay, no
 *         stack. This is where the value is: bounds, concurrency, deadline, per-coord
 *         validation, per-coord failure isolation.
 *   H*  — BEHAVIORAL, HTTP boundary. `handleListPageCounts(req, res, deps)` driven with a
 *         fake req/res: query parsing, the three 400 cases, and the JSON shape.
 *   S*  — SOURCE-CONTRACT. The client half is ESM/JSX (not requirable from the Node runner),
 *         so those ACs are pinned by reading the source. Documented gap.
 *   R*  — REGRESSION SENTINEL. Passes TODAY and must keep passing (AC-3 / AC-6).
 *
 * Pre-implementation: every U*, H* and S* test FAILS (the server module and the client module
 * do not exist; `Lists.jsx` still calls the old endpoint). The R* sentinels PASS.
 *
 * External dependencies and their error paths:
 *   strfry `scan --count` spawn  → U7 (one coord's count rejects), U8 (one coord never
 *                                  settles → DEADLINE_MS → `partial: true`).
 *   client `fetch` of the new endpoint → S3 (non-blocking call with a `.catch`), S2 (— fallback).
 *   nginx query-length ceiling (E6) → NOT COVERED by an automated test: it is an out-of-process
 *                                  proxy limit. The client-side consequence (every row reads —)
 *                                  is the same path S2/S3 pin.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PAGE_COUNTS = path.join(REPO, 'src/api/dlists/pageCounts.js');
const DLISTS_INDEX = path.join(REPO, 'src/api/dlists/index.js');
const ITEM_COUNTS = path.join(REPO, 'src/api/dlists/itemCounts.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const LISTS_PAGE = path.join(REPO, 'ui/src/pages/Lists.jsx');
const LIST_PAGE = path.join(REPO, 'ui/src/pages/List.jsx');
const CLIENT_API = path.join(REPO, 'ui/src/api/dlists.js');
const OP_INDEX = path.join(REPO, 'ui/src/pages/lists/Index.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual); const b = JSON.stringify(expected);
  assert(a === b, `${msg}\n  expected: ${b}\n  actual:   ${a}`);
}
const tick = () => new Promise((r) => setImmediate(r));
async function ticks(n) { for (let i = 0; i < n; i++) await tick(); }

/** Require the module under test fresh, with a readable failure if it does not exist yet. */
function loadPageCounts() {
  try { delete require.cache[PAGE_COUNTS]; } catch { /* */ }
  let mod;
  try {
    mod = require(PAGE_COUNTS);
  } catch (err) {
    throw new Error(`Design note: src/api/dlists/pageCounts.js must exist and be requirable — ${err.message}`);
  }
  assert(typeof mod.countsForCoords === 'function', 'Design note: pageCounts.js exports countsForCoords(coords, deps)');
  assert(typeof mod.handleListPageCounts === 'function', 'Design note: pageCounts.js exports handleListPageCounts(req, res)');
  return mod;
}

// ───────────────────────── fixtures ─────────────────────────
const hex = (c) => c.repeat(64);
const PK1 = hex('1');
const PK2 = hex('2');
const EVID = hex('9');                       // a bare kind-9998 header event id
const COORD_A = `39998:${PK1}:hackers`;
const COORD_B = `39998:${PK2}:legends`;
const COORD_EMPTY_D = `39998:${PK1}:`;       // E4 — header with no/empty d tag

/** A fake res that records status + json payload. */
function fakeRes() {
  const rec = { statusCode: 200, body: null, jsonCalls: 0 };
  return {
    rec,
    status(code) { rec.statusCode = code; return this; },
    json(payload) { rec.jsonCalls++; rec.body = payload; return this; },
  };
}

/** A counter stub that resolves immediately from a coord→count map, recording its filters. */
function immediateCounter(byCoord) {
  const filters = [];
  const fn = async (filter) => {
    filters.push(filter);
    const key = (filter['#z'] && filter['#z'][0]) || (filter['#e'] && filter['#e'][0]);
    return byCoord[key] == null ? 0 : byCoord[key];
  };
  return { fn, filters };
}

// ═════════════════ U* — countsForCoords, behavioral ═════════════════

test('U1: a 39998 coordinate is counted with a #z filter on kinds 9999/39999, a bare 64-hex id with #e', async () => {
  const { countsForCoords } = loadPageCounts();
  const counter = immediateCounter({ [COORD_A]: 3, [EVID]: 7 });
  const out = await countsForCoords([COORD_A, EVID], { countFilter: counter.fn });

  assert(out && out.counts, 'countsForCoords returns { counts, invalid, partial }');
  assert(out.counts[COORD_A] === 3, `AC-2: the 39998 coordinate carries its count (got ${JSON.stringify(out.counts)})`);
  assert(out.counts[EVID] === 7, 'AC-2: the bare event id carries its count');

  const zf = counter.filters.find((f) => f['#z']);
  const ef = counter.filters.find((f) => f['#e']);
  assert(zf, 'AC-2: a 39998:<pk>:<d> coordinate is scanned by #z');
  eq([...zf.kinds].sort((a, b) => a - b), [9999, 39999], 'AC-2: the #z scan is bounded to kinds 9999 and 39999');
  eq(zf['#z'], [COORD_A], 'AC-2: the #z value is the header coordinate verbatim');
  assert(ef, 'AC-2: a bare 64-hex header id is scanned by #e');
  eq([...ef.kinds].sort((a, b) => a - b), [9999, 39999], 'AC-2: the #e scan is bounded to kinds 9999 and 39999');
  eq(ef['#e'], [EVID], 'AC-2: the #e value is the header event id verbatim');
  assert(!zf.limit || zf.limit > 0, 'AC-2: the filter is a count filter, never a whole-relay walk');
  assert(counter.filters.length === 2, `AC-2: exactly one scan per coordinate (got ${counter.filters.length})`);
});

test('U2: named bounds MAX_COORDS=50, CONCURRENCY=8, DEADLINE_MS=10000 are exported constants, not buried literals', async () => {
  const mod = loadPageCounts();
  assert(mod.MAX_COORDS === 50, `Design note: MAX_COORDS === 50 (got ${mod.MAX_COORDS})`);
  assert(mod.CONCURRENCY === 8, `Design note: CONCURRENCY === 8 (got ${mod.CONCURRENCY})`);
  assert(mod.DEADLINE_MS === 10000, `Design note: DEADLINE_MS === 10000 (got ${mod.DEADLINE_MS})`);
});

test('U3: more than MAX_COORDS coordinates are never counted — the cap is enforced before any scan', async () => {
  const { countsForCoords, MAX_COORDS } = loadPageCounts();
  const coords = Array.from({ length: 51 }, (_, i) => `39998:${PK1}:list-${i}`);
  const counter = immediateCounter({});
  let threw = null;
  let out = null;
  try { out = await countsForCoords(coords, { countFilter: counter.fn }); } catch (err) { threw = err; }
  assert(counter.filters.length <= (MAX_COORDS || 50),
    `AC-2: at most MAX_COORDS scans are ever spawned (got ${counter.filters.length} for 51 coords)`);
  if (!threw) {
    assert(Object.keys(out.counts).length <= 50, 'AC-2: at most 50 coordinates are counted in one request');
  }
});

test('U4: never more than CONCURRENCY scans are in flight at once, and the work is not serialised', async () => {
  const { countsForCoords } = loadPageCounts();
  const coords = Array.from({ length: 20 }, (_, i) => `39998:${PK1}:list-${i}`);
  let inFlight = 0;
  let maxInFlight = 0;
  const resolvers = [];
  const countFilter = () => {
    inFlight++;
    if (inFlight > maxInFlight) maxInFlight = inFlight;
    return new Promise((resolve) => {
      resolvers.push(() => { inFlight--; resolve(1); });
    });
  };

  const p = countsForCoords(coords, { countFilter });
  await ticks(10);
  assert(maxInFlight <= 8, `Design note: CONCURRENCY caps in-flight scans at 8 (peaked at ${maxInFlight})`);
  assert(maxInFlight > 1, `Design note: coordinates are counted concurrently, not one at a time (peaked at ${maxInFlight})`);

  // Drain: release whatever is in flight until every coordinate has been counted.
  for (let i = 0; i < 60 && resolvers.length; i++) {
    const batch = resolvers.splice(0, resolvers.length);
    batch.forEach((r) => r());
    await ticks(3);
  }
  const out = await p;
  assert(maxInFlight <= 8, `Design note: CONCURRENCY held for the whole run (peaked at ${maxInFlight})`);
  assert(Object.keys(out.counts).length === 20, `AC-2: all 20 coordinates eventually counted (got ${Object.keys(out.counts).length})`);
});

test('U5: a malformed coordinate is reported per-coordinate in `invalid` while the valid ones are still counted', async () => {
  const { countsForCoords } = loadPageCounts();
  const counter = immediateCounter({ [COORD_A]: 4, [COORD_B]: 9 });
  const out = await countsForCoords([COORD_A, 'not-a-coordinate', '39998:tooshort:x', COORD_B], { countFilter: counter.fn });

  assert(out.counts[COORD_A] === 4 && out.counts[COORD_B] === 9,
    `AC-5: the well-formed coordinates are still counted (got ${JSON.stringify(out.counts)})`);
  assert(Array.isArray(out.invalid), 'AC-5: the result carries an `invalid` array');
  assert(out.invalid.includes('not-a-coordinate'), 'AC-5: a junk coordinate lands in `invalid`');
  assert(out.invalid.includes('39998:tooshort:x'), 'AC-5: a 39998 coordinate with a non-64-hex pubkey lands in `invalid`');
  assert(out.counts['not-a-coordinate'] === undefined, 'AC-5: an invalid coordinate gets no count key');
  assert(counter.filters.length === 2, `AC-5: no scan is spawned for an invalid coordinate (got ${counter.filters.length})`);
});

test('U6: a header with an empty d tag — coordinate 39998:<pk>: — is legal and is counted (E4)', async () => {
  const { countsForCoords } = loadPageCounts();
  const counter = immediateCounter({ [COORD_EMPTY_D]: 2 });
  const out = await countsForCoords([COORD_EMPTY_D], { countFilter: counter.fn });
  eq(out.invalid, [], 'E4: an empty final segment is NOT invalid — every such list would silently lose its count');
  assert(out.counts[COORD_EMPTY_D] === 2, `E4: the empty-d coordinate is counted (got ${JSON.stringify(out.counts)})`);
  eq(counter.filters[0] && counter.filters[0]['#z'], [COORD_EMPTY_D], 'E4: the #z value keeps the trailing colon verbatim');
});

test('U7: one coordinate whose scan fails does not fail the others (external-dependency error path: the strfry spawn)', async () => {
  const { countsForCoords } = loadPageCounts();
  const filters = [];
  const countFilter = async (filter) => {
    filters.push(filter);
    const key = filter['#z'] && filter['#z'][0];
    if (key === COORD_A) throw new Error('spawn strfry ENOENT');
    return 5;
  };
  const out = await countsForCoords([COORD_A, COORD_B], { countFilter });
  assert(out.counts[COORD_B] === 5, `AC-5: a sibling coordinate still counts when one scan throws (got ${JSON.stringify(out.counts)})`);
  assert(!Number.isFinite(out.counts[COORD_A]),
    'AC-5: the failed coordinate carries no number — the client renders — for it');
});

test('U8: coordinates unresolved at the deadline are omitted and the result is partial (E7)', async () => {
  const { countsForCoords } = loadPageCounts();
  const countFilter = async (filter) => {
    const key = filter['#z'] && filter['#z'][0];
    if (key === COORD_A) return new Promise(() => {});   // hangs forever
    return 6;
  };
  const started = Date.now();
  const out = await countsForCoords([COORD_A, COORD_B], { countFilter, deadlineMs: 80 });
  assert(Date.now() - started < 5000, 'E7: the deadline short-circuits — the request never blocks on a hung scan');
  assert(out.partial === true, `AC-5/E7: an unresolved coordinate sets partial: true (got ${JSON.stringify(out)})`);
  assert(out.counts[COORD_A] === undefined, 'E7: the hung coordinate is omitted from counts');
  assert(out.counts[COORD_B] === 6, 'E7: the coordinates that did resolve are still returned');
});

test('U9: duplicate coordinates are de-duped — one scan, one key (E8)', async () => {
  const { countsForCoords } = loadPageCounts();
  const counter = immediateCounter({ [COORD_A]: 11 });
  const out = await countsForCoords([COORD_A, COORD_A, COORD_A], { countFilter: counter.fn });
  assert(counter.filters.length === 1, `E8: a repeated coordinate is scanned once (got ${counter.filters.length} scans)`);
  eq(Object.keys(out.counts), [COORD_A], 'E8: one key in the response for a repeated coordinate');
  assert(out.counts[COORD_A] === 11, 'E8: the de-duped coordinate keeps its count');
});

test('U10: a clean run reports partial: false and an empty invalid list', async () => {
  const { countsForCoords } = loadPageCounts();
  const counter = immediateCounter({ [COORD_A]: 1, [COORD_B]: 0 });
  const out = await countsForCoords([COORD_A, COORD_B], { countFilter: counter.fn });
  assert(out.partial === false, 'AC-2: nothing unresolved → partial is false, not undefined');
  eq(out.invalid, [], 'AC-2: nothing malformed → invalid is an empty array, not undefined');
  assert(out.counts[COORD_B] === 0, 'AC-2: a list with zero items reports 0, not a missing key');
});

// ═════════════════ H* — the HTTP boundary ═════════════════

test('H1: GET /api/dlists/page-counts with no coords param is a request-level 400', async () => {
  const { handleListPageCounts } = loadPageCounts();
  const res = fakeRes();
  await handleListPageCounts({ query: {} }, res, { countFilter: async () => 1 });
  assert(res.rec.statusCode === 400, `AC-5: missing coords → HTTP 400 (got ${res.rec.statusCode})`);
  assert(res.rec.body && res.rec.body.success === false, 'AC-5: the 400 body reports success:false with an error');
});

test('H2: an empty coords param (or one made only of separators) is a request-level 400 (E9)', async () => {
  const { handleListPageCounts } = loadPageCounts();
  for (const coords of ['', ',,,']) {
    const res = fakeRes();
    await handleListPageCounts({ query: { coords } }, res, { countFilter: async () => 1 });
    assert(res.rec.statusCode === 400, `E9: coords=${JSON.stringify(coords)} → HTTP 400 (got ${res.rec.statusCode})`);
  }
});

test('H3: every coordinate malformed is a request-level 400; one bad among good is NOT (AC-5)', async () => {
  const { handleListPageCounts } = loadPageCounts();

  const allBad = fakeRes();
  await handleListPageCounts({ query: { coords: 'junk,also-junk' } }, allBad, { countFilter: async () => 1 });
  assert(allBad.rec.statusCode === 400, `AC-5: every coordinate malformed → HTTP 400 (got ${allBad.rec.statusCode})`);

  const mixed = fakeRes();
  await handleListPageCounts({ query: { coords: `junk,${COORD_A}` } }, mixed, { countFilter: async () => 3 });
  assert(mixed.rec.statusCode === 200, `AC-5: one malformed coordinate among good ones is NOT a 400 (got ${mixed.rec.statusCode})`);
  assert(mixed.rec.body.success === true, 'AC-5: the mixed request succeeds');
  assert(mixed.rec.body.counts[COORD_A] === 3, 'AC-5: the good coordinate is counted');
  assert(mixed.rec.body.invalid.includes('junk'), 'AC-5: the malformed coordinate is reported per-coordinate');
});

test('H4: the happy path returns { success, counts, invalid, partial } and nothing else', async () => {
  const { handleListPageCounts } = loadPageCounts();
  const res = fakeRes();
  await handleListPageCounts(
    { query: { coords: `${COORD_A},${EVID}` } },
    res,
    { countFilter: async (f) => ((f['#z'] && f['#z'][0]) === COORD_A ? 4 : 8) },
  );
  assert(res.rec.statusCode === 200, `AC-2: happy path is 200 (got ${res.rec.statusCode})`);
  const body = res.rec.body;
  eq(Object.keys(body).sort(), ['counts', 'invalid', 'partial', 'success'],
    'AC-2: the response shape is exactly { success, counts, invalid, partial } — no union total (E10)');
  assert(body.success === true, 'AC-2: success:true');
  assert(body.counts[COORD_A] === 4 && body.counts[EVID] === 8, `AC-2: counts keyed by the coordinate the client sent (got ${JSON.stringify(body.counts)})`);
  assert(body.totalItems === undefined, 'E10: page-counts deliberately returns no union total');
});

test('H5: more than 50 coordinates in one request is rejected, not silently counted (AC-2)', async () => {
  const { handleListPageCounts } = loadPageCounts();
  let scans = 0;
  const res = fakeRes();
  const coords = Array.from({ length: 51 }, (_, i) => `39998:${PK1}:list-${i}`).join(',');
  await handleListPageCounts({ query: { coords } }, res, { countFilter: async () => { scans++; return 1; } });
  assert(res.rec.statusCode === 400, `AC-2: 51 coordinates → HTTP 400 (got ${res.rec.statusCode})`);
  assert(scans === 0, `AC-2: an over-cap request spawns no scans at all (got ${scans})`);
});

test('H6: a comma inside a d tag degrades to invalid fragments, never a crash or a wrong count (E5)', async () => {
  const { handleListPageCounts } = loadPageCounts();
  const res = fakeRes();
  const commaCoord = `39998:${PK1}:my,list`;   // the client CSV splits this in two
  await handleListPageCounts(
    { query: { coords: `${commaCoord},${COORD_B}` } },
    res,
    { countFilter: async (f) => ((f['#z'] && f['#z'][0]) === COORD_B ? 9 : 0) },
  );
  assert(res.rec.statusCode === 200, `E5: a comma in a d tag does not fail the batch (got ${res.rec.statusCode})`);
  assert(res.rec.body.counts[commaCoord] === undefined,
    'E5: the comma-bearing coordinate gets no count key — its row reads — on the page');
  assert(res.rec.body.invalid.includes('list'),
    `E5: the trailing fragment is reported as invalid (got ${JSON.stringify(res.rec.body.invalid)})`);
  assert(res.rec.body.counts[COORD_B] === 9, 'E5: the rest of the page counts normally');
});

test('H7: an unexpected internal failure answers with a JSON error, never an unhandled rejection', async () => {
  const { handleListPageCounts } = loadPageCounts();
  const res = fakeRes();
  await handleListPageCounts(
    { query: { coords: COORD_A } },
    res,
    { countFilter: () => { throw new Error('boom'); } },
  );
  assert(res.rec.jsonCalls === 1, 'AC-5: the handler always answers exactly once');
  assert(res.rec.body && typeof res.rec.body === 'object', 'AC-5: the answer is JSON');
});

// ═════════════════ S* — client source contract ═════════════════

test('S1: ui/src/api/dlists.js exports fetchPageCounts(coords) hitting /api/dlists/page-counts with a safe fallback', () => {
  const src = safeRead(CLIENT_API);
  assert(src.length > 0, 'Design note: new client module ui/src/api/dlists.js must exist');
  assert(/export\s+(async\s+)?function\s+fetchPageCounts|export\s+const\s+fetchPageCounts/.test(src),
    'Design note: it exports fetchPageCounts(coords)');
  assert(src.includes('/api/dlists/page-counts'), 'AC-2: it calls the new bounded endpoint');
  assert(!src.includes('/api/dlists/item-counts'), 'AC-3: it never calls the whole-relay endpoint');
  assert(/encodeURIComponent/.test(src), 'AC-2: the coords param is URL-encoded');
  assert(/counts/.test(src) && /\{\s*\}/.test(src), 'AC-5: it resolves to `counts` or an empty object, never throwing the page down');
});

test('S2: Lists.jsx pages 50 headers at a time with queryRelayBounded and prints "Showing N of M" with unknown totals (AC-1/E1)', () => {
  const src = safeRead(LISTS_PAGE);
  assert(src.length > 0, 'ui/src/pages/Lists.jsx must exist');
  assert(/queryRelayBounded\s*\(/.test(src), 'AC-1: the header scan is bounded via queryRelayBounded');
  assert(!/\bqueryRelay\s*\(\s*\{\s*kinds/.test(src), 'AC-1: the unbounded whole-relay header scan is gone');
  assert(/limit:\s*50/.test(src), 'Gate A: page size 50');
  assert(/9998/.test(src) && /39998/.test(src), 'AC-1: both header kinds are still scanned');
  assert(/Showing/.test(src), 'AC-1: a "Showing N of M" line');
  assert(/total\s*===\s*null\s*\?\s*'unknown'/.test(src) || (/total\s*===\s*null/.test(src) && /unknown/i.test(src)),
    'E1: total === null prints "unknown", never "of 0"');
  assert(/truncated/.test(src), 'AC-1: the bounded-scan flag drives the label');
});

test('S3: Lists.jsx pages with until + id de-dupe and an exhausted guard, behind a next-page control (E2)', () => {
  const src = safeRead(LISTS_PAGE);
  assert(/until/.test(src) && /created_at/.test(src), 'E2: the next page uses until = oldest created_at on the page');
  assert(/Math\.min/.test(src), 'E2: until is the minimum created_at seen, mirroring List.jsx');
  assert(/new Set\s*\(|new Map\s*\(/.test(src), 'E2: id de-dupe across pages');
  assert(/fresh\.length\s*===\s*0/.test(src), 'E2: a page with zero fresh ids sets exhausted — no paging stall');
  assert(/exhausted/.test(src), 'E2: an exhausted guard hides the next-page control');
  assert(/hasMore|Load more|Next/i.test(src), 'AC-1: a next-page control');
  assert(/key=\{h\.id\}|key=\{header\.id\}/.test(src), 'E3: the React key stays the event id across a republished header');
});

test('S4: Lists.jsx fetches counts for the visible page only, non-blockingly, and no longer touches item-counts (AC-2/AC-3/AC-5)', () => {
  const src = safeRead(LISTS_PAGE);
  assert(/fetchPageCounts/.test(src), 'AC-2: counts come from fetchPageCounts');
  assert(/from\s+'\.\.\/api\/dlists'/.test(src), 'Design note: imported from the new ui/src/api/dlists.js module');
  assert(!src.includes('/api/dlists/item-counts'), 'AC-3: /lists no longer calls the whole-relay item-counts endpoint');
  assert(/\.catch\s*\(|catch\s*\{/.test(src), 'AC-5: a counts failure is caught — the page stays rendered');
  assert(/setCounts\s*\(\s*\(?\s*prev/.test(src), 'AC-2: each page merges its counts into the existing map rather than replacing it');
  assert(!/await\s+fetchPageCounts/.test(src), 'AC-2: the counts call never gates the header render');
  assert(/—/.test(src), 'AC-5: an absent count renders — not 0 and not an error page');
});

test('S5: the filter label counts matches within the loaded page and says so (AC-4/E11)', () => {
  const src = safeRead(LISTS_PAGE);
  assert(/matchesListQuery/.test(src), 'AC-4: filtering still runs through the shared matchesListQuery util');
  assert(/matching/.test(src) && /loaded/.test(src), 'AC-4: the label reads "{N} matching of {M} loaded"');
  assert(src.includes('No lists match on this page.'),
    'AC-4: the empty state is "No lists match on this page." — never a bare "No lists match"');
  assert(/visible\.length/.test(src) && /headers\.length/.test(src),
    'E11: the label is derived from the live visible/headers arrays, so it recomputes after "next page"');
  assert(!/(queryRelayBounded|fetch)\s*\([^)]*query/.test(src), 'AC-4: filtering stays client-side over loaded headers');
});

test('S6: the server route is mounted next to item-counts and re-exported from the dlists module (AC-2)', () => {
  const api = safeRead(API_INDEX);
  const idx = safeRead(DLISTS_INDEX);
  assert(api.includes("app.get('/api/dlists/page-counts'"), 'Design note: GET route mounted in src/api/index.js');
  assert(/page-counts['"],\s*dlists\.handleListPageCounts/.test(api), 'Design note: mounted on dlists.handleListPageCounts');
  assert(!/app\.post\('\/api\/dlists\/page-counts'/.test(api), 'Design note: GET, not POST');
  assert(/handleListPageCounts/.test(idx) && /pageCounts/.test(idx), 'Design note: re-exported from src/api/dlists/index.js');
});

// ═════════════════ R* — regression sentinels (pass today) ═════════════════

test('R1: List.jsx (/list/:ref) pagination idiom is untouched (AC-6)', () => {
  const src = safeRead(LIST_PAGE);
  assert(src.includes('const page = await queryRelayBounded({ ...itemsFilter(h), limit: 50 });'),
    'AC-6: the first-page scan line is byte-stable');
  assert(src.includes('const until = Math.min(...items.map((it) => it.created_at));'),
    'AC-6: the until computation is byte-stable');
  assert(src.includes("const totalLabel = total === null ? 'unknown' : total;"),
    'AC-6: the unknown-total label is byte-stable');
  assert(src.includes('if (fresh.length === 0) setExhausted(true);'),
    'AC-6: the exhausted guard is byte-stable');
});

test('R2: the old whole-relay item-counts handler is unchanged (AC-3)', () => {
  const src = safeRead(ITEM_COUNTS);
  assert(src.includes('async function handleListItemCounts(req, res)'), 'AC-3: handler signature unchanged');
  assert(src.includes('module.exports = { handleListItemCounts, createTally };'), 'AC-3: exports unchanged');
  assert(src.includes('let cache = null;'), 'AC-3: the module-level validator cache is untouched');
  assert(src.includes('totalItems,'), 'AC-3: the union totalItems figure is untouched');
  assert(!/page-counts|countsForCoords/.test(src), 'AC-3: no page-counts logic leaked into itemCounts.js');
});

test('R3: the existing /api/dlists/item-counts route is still mounted (AC-3)', () => {
  const src = safeRead(API_INDEX);
  assert(src.includes("app.get('/api/dlists/item-counts', dlists.handleListItemCounts);"),
    'AC-3: the old route line is intact');
});

test('R4: the operator lists page still uses the whole-relay endpoint and its union total (AC-3)', () => {
  const src = safeRead(OP_INDEX);
  assert(src.includes("fetch('/api/dlists/item-counts')"), 'AC-3: ui/src/pages/lists/Index.jsx keeps item-counts (OPEN 301)');
  assert(!/page-counts|fetchPageCounts/.test(src), 'Blast radius: the operator page is not touched by this story');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
