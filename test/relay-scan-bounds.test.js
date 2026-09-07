/**
 * relay-scan-bounds #1: Simple Lists pages must work on a large relay.
 *
 * Story: engineering-team/stories/relay-scan-bounds/1-bound-simple-lists-relay-scans.md
 * ADR:   engineering-team/decisions/relay-scan-bounds/0001-bounded-scan-contract-and-grouped-tally.md
 *
 * The bug: /tapestry/lists and /tapestry/lists/items fetch every list item on
 * the relay with no bound, and the shared scan path buffers the result into a
 * 10 MB ceiling. Staging (473,101 items) and tags (451,662) fail outright;
 * prod (8,897) and local (9,497) pass with ~2 MB of headroom.
 *
 * Classes:
 *   T (tally)      — the counting rule, as a pure streaming accumulator. These
 *                    are the spec: per-list counts are set membership (an item
 *                    in two lists counts in BOTH), the page total is the union
 *                    (that item counts ONCE). T1 is the operator's own example.
 *                    FAIL until src/api/dlists/itemCounts.js exists.
 *   B (bound)      — /api/strfry/scan streams to a bound and reports its own
 *                    truncation. Static pins + live HTTP. FAIL until implemented,
 *                    except B3, which passes on any relay small enough to fit
 *                    the current ceiling — it is the binding test on staging and
 *                    tags, and a standing pin everywhere else.
 *   E (endpoint)   — GET /api/dlists/item-counts. Live HTTP. FAIL until implemented.
 *   U (ui)         — structural pins on the two pages and the relay client.
 *                    FAIL until implemented.
 *   D (degraded)   — what a bounded read reports when it CANNOT learn the true
 *                    total. Added at review: the happy paths were covered and
 *                    this one was not, which is how a silent-partial response
 *                    survived a green suite. See
 *                    engineering-team/reviews/relay-scan-bounds/1-*.md Blocking 1-2.
 *   R (regression) — green BEFORE and AFTER: the guard must not disturb the
 *                    scan siblings or the callers this story never touches.
 *
 * Seam pinned by this plan (implied by the ADR, named here so the Implementer
 * is not guessing):
 *
 *   // src/api/dlists/itemCounts.js
 *   createTally(headerRefs)  ->  { add(event), result() }
 *   result() -> { counts, totalItems, scannedItems, unattached }
 *   module.exports = { handleListItemCounts, createTally }
 *
 * An accumulator rather than `tally(refs, items[])` on purpose: an array
 * parameter invites buffering all 473,101 events, which is the bug.
 *
 * EXPECTED NOW (pre-implementation), against a relay under the 10 MB ceiling:
 * every T, E and U test FAILS, B1/B2/B4/B5 FAIL, and B3 + every R test PASS.
 * On staging or tags, B3 fails too — that is the reported bug. Live tests SKIP
 * when the stack is absent.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_JS = path.join(ROOT, 'src/api/strfry/queries/scan.js');
const COUNTS_JS = path.join(ROOT, 'src/api/dlists/itemCounts.js');
const API_INDEX = path.join(ROOT, 'src/api/index.js');
const LISTS_INDEX_JSX = path.join(ROOT, 'ui/src/pages/lists/Index.jsx');
const LIST_ITEMS_JSX = path.join(ROOT, 'ui/src/pages/events/DListItemsList.jsx');
const RELAY_JS = path.join(ROOT, 'ui/src/api/relay.js');

const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

async function stackPresent() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`${BASE}/api/strfry/scan/count?filter=%7B%22kinds%22%3A%5B39998%5D%7D`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

async function getJson(pathAndQuery, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${pathAndQuery}`, { signal: ctrl.signal });
    const text = await r.text();
    try {
      return { status: r.status, body: JSON.parse(text) };
    } catch {
      // An unregistered API route falls through to the SPA catch-all, which
      // serves index.html. Say that, rather than "Unexpected token '<'".
      const served = /<!DOCTYPE/i.test(text) ? 'the SPA catch-all served index.html' : text.slice(0, 80);
      throw new Error(`GET ${pathAndQuery} returned no JSON (HTTP ${r.status}) — ${served}`);
    }
  } finally { clearTimeout(t); }
}

const q = (filter) => encodeURIComponent(JSON.stringify(filter));

/** Load the pinned seam, or null when it does not exist yet. */
function loadCounts() {
  try { return require(COUNTS_JS); } catch { return null; }
}

/** Build a list-item event. `z`/`e` are arrays of tag values, in order. */
function item({ id = 'i' + Math.random().toString(36).slice(2), kind = 39999, z = [], e = [] } = {}) {
  const tags = [];
  for (const v of z) tags.push(['z', v]);
  for (const v of e) tags.push(['e', v]);
  return { id, kind, pubkey: 'PK', created_at: 1, tags, content: '' };
}

const L1 = '39998:PK:list-one';
const L2 = '39998:PK:list-two';
const E9998 = 'aa'.repeat(32); // a kind-9998 header's event id (staging carries 4 of these)

/* ── T: the counting rule ─────────────────────────────────────────────────── */

test('T1: the operator\'s example — two lists of 10 sharing 5 items read 10, 10, total 15', () => {
  const mod = loadCounts();
  assert(mod && typeof mod.createTally === 'function',
    'src/api/dlists/itemCounts.js must export createTally(headerRefs) -> { add(event), result() }');
  const t = mod.createTally([L1, L2]);
  for (let i = 0; i < 5; i++) t.add(item({ z: [L1] }));
  for (let i = 0; i < 5; i++) t.add(item({ z: [L2] }));
  for (let i = 0; i < 5; i++) t.add(item({ z: [L1, L2] }));   // in both lists
  const r = t.result();
  assert(r.counts[L1] === 10, `AC-2: list one must count 10 items, got ${r.counts[L1]}`);
  assert(r.counts[L2] === 10, `AC-2: list two must count 10 items, got ${r.counts[L2]}`);
  assert(r.totalItems === 15,
    `AC-3: the total is the union — 15 distinct items, not the 20 the per-list counts sum to; got ${r.totalItems}`);
  assert(r.scannedItems === 15, `scannedItems must report every event seen; got ${r.scannedItems}`);
  assert(r.unattached === 0, `no item here is unattached; got ${r.unattached}`);
});

test('T2: a second z tag is honored — the first-tag-wins rule that caused the bug is gone', () => {
  const mod = loadCounts();
  assert(mod && typeof mod.createTally === 'function', 'createTally not exported (see T1)');
  const t = mod.createTally([L1, L2]);
  t.add(item({ z: [L1, L2] }));
  const r = t.result();
  assert(r.counts[L2] === 1,
    'AC-2: an item whose SECOND z tag names a list must count for that list — ' +
    'today ui/src/pages/lists/Index.jsx takes only the first, which is the defect');
  assert(r.counts[L1] === 1, 'AC-2: it must still count for the list its first z tag names');
  assert(r.totalItems === 1, `AC-3: one event is one item in the union; got ${r.totalItems}`);
});

test('T3: an item naming no known list is excluded from counts and from the total', () => {
  const mod = loadCounts();
  assert(mod && typeof mod.createTally === 'function', 'createTally not exported (see T1)');
  const t = mod.createTally([L1]);
  t.add(item({ z: [L1] }));
  t.add(item({ z: ['39998:PK:list-that-has-no-header'] }));
  const r = t.result();
  assert(r.counts[L1] === 1, `only the attached item counts for L1; got ${r.counts[L1]}`);
  assert(r.counts['39998:PK:list-that-has-no-header'] === undefined,
    'a ref with no header must not appear in counts — the page has no row to show it on');
  assert(r.totalItems === 1, `AC-3: the union counts items in >= 1 SHOWN list; got ${r.totalItems}`);
  assert(r.scannedItems === 2, `scannedItems counts every event seen; got ${r.scannedItems}`);
  assert(r.unattached === 1, `unattached = scanned - union; got ${r.unattached}`);
});

test('T4: an item carrying neither a z nor an e tag is unattached', () => {
  const mod = loadCounts();
  assert(mod && typeof mod.createTally === 'function', 'createTally not exported (see T1)');
  const t = mod.createTally([L1]);
  t.add(item({}));
  const r = t.result();
  assert(r.totalItems === 0, `an item in no list is not in the union; got ${r.totalItems}`);
  assert(r.unattached === 1, `it must be reported as unattached; got ${r.unattached}`);
  assert(Object.keys(r.counts).length === 0, 'it must contribute to no list count');
});

test('T5: a kind-9998 header is matched by e tag (staging carries 4 of these)', () => {
  const mod = loadCounts();
  assert(mod && typeof mod.createTally === 'function', 'createTally not exported (see T1)');
  const t = mod.createTally([E9998]);
  t.add(item({ kind: 9999, e: [E9998] }));
  const r = t.result();
  assert(r.counts[E9998] === 1,
    'AC-2: items reference a kind-9998 header by e tag; that path is live on staging and must count');
  assert(r.totalItems === 1, `it belongs to a shown list, so it is in the union; got ${r.totalItems}`);
});

test('T6: the same list named twice on one item counts once for that list', () => {
  const mod = loadCounts();
  assert(mod && typeof mod.createTally === 'function', 'createTally not exported (see T1)');
  const t = mod.createTally([L1]);
  t.add(item({ z: [L1, L1] }));
  const r = t.result();
  assert(r.counts[L1] === 1,
    `an item is in a list once however many times it names it; got ${r.counts[L1]}`);
  assert(r.totalItems === 1, `and once in the union; got ${r.totalItems}`);
});

test('T7: an item in a 39998 list and a 9998 list counts in both, once in the union', () => {
  const mod = loadCounts();
  assert(mod && typeof mod.createTally === 'function', 'createTally not exported (see T1)');
  const t = mod.createTally([L1, E9998]);
  t.add(item({ z: [L1], e: [E9998] }));
  const r = t.result();
  assert(r.counts[L1] === 1 && r.counts[E9998] === 1,
    'AC-2: membership is per list, across both reference styles');
  assert(r.totalItems === 1,
    `AC-3: still one item in the union — z and e naming different lists is not two items; got ${r.totalItems}`);
});

/* ── B: the bounded scan contract ─────────────────────────────────────────── */

test('B1: the scan endpoint streams instead of buffering into a fixed maxBuffer', () => {
  const src = safeRead(SCAN_JS);
  assert(src, 'src/api/strfry/queries/scan.js unreadable');
  assert(/spawn/.test(src),
    'AC-5: the scan must stream (spawn), as scanStream.js already does — exec buffers the whole result');
  assert(!/exec\(cmd,\s*\{\s*maxBuffer/.test(src),
    'AC-5: the exec+maxBuffer call is the defect — 473,101 events overflow it and the caller gets ' +
    '"stdout maxBuffer length exceeded" instead of data');
});

test('B2: the scan endpoint declares its bounds, with the byte cap at today\'s ceiling', () => {
  const src = safeRead(SCAN_JS);
  assert(src, 'src/api/strfry/queries/scan.js unreadable');
  assert(/SCAN_MAX_EVENTS\s*=\s*20000/.test(src),
    'ADR: SCAN_MAX_EVENTS = 20000, aligned with event-tagging/0017 TAGGING_SCAN_LIMIT');
  assert(/SCAN_MAX_BYTES\s*=\s*10\s*\*\s*1024\s*\*\s*1024/.test(src),
    'ADR: SCAN_MAX_BYTES = 10 MB — today\'s de-facto ceiling, preserved so every request that ' +
    'succeeds today still succeeds (AC-6)');
});

test('B3 (live): the request that fails today succeeds and never reports a maxBuffer failure', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const { body } = await getJson(`/api/strfry/scan?filter=${q({ kinds: [9999, 39999] })}`);
  assert(body.success === true,
    `AC-5: {"kinds":[9999,39999]} must not fail; got success=${body.success} error=${body.error}`);
  assert(!/maxBuffer/.test(String(body.error || '')),
    'AC-5: a maxBuffer failure must be impossible — that is the reported bug');
  assert(Array.isArray(body.events), 'the response must still carry an events array');
});

test('B4 (live): an explicit limit yields a bounded set that declares its own truncation', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const { body } = await getJson(`/api/strfry/scan?filter=${q({ kinds: [9999, 39999], limit: 5 })}`);
  assert(body.success === true, `expected success; got ${body.error}`);
  assert(body.events.length === 5, `AC-4: the caller's limit must be honored; got ${body.events.length}`);
  assert(body.truncated === true, 'AC-4/AC-5: a bounded response must say it is bounded — never quietly partial');
  assert(typeof body.total === 'number' && body.total > 5,
    `AC-4: the true total must accompany the bounded set so a page can render "showing 5 of N"; got ${body.total}`);
  const { body: counted } = await getJson(`/api/strfry/scan/count?filter=${q({ kinds: [9999, 39999] })}`);
  assert(body.total === counted.count,
    `AC-4: total must be the true count (${counted.count}), not the bounded length; got ${body.total}`);
});

test('B5 (live): a result that fits is not marked truncated (no regression for small deployments)', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const { body } = await getJson(`/api/strfry/scan?filter=${q({ kinds: [9998, 39998] })}`);
  assert(body.success === true, `expected success; got ${body.error}`);
  assert(body.truncated === false,
    'AC-6: a set well under the bound must not be reported as truncated');
  assert(body.total === body.events.length,
    `AC-6: an untruncated total equals what was returned; got total=${body.total} events=${body.events.length}`);
});

/* ── E: the item-counts endpoint ──────────────────────────────────────────── */

test('E1 (live): GET /api/dlists/item-counts returns the four figures the page needs', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const { body } = await getJson('/api/dlists/item-counts', 120000);
  assert(body.success === true, `AC-1: the counts endpoint must answer; got ${body.error}`);
  assert(body.counts && typeof body.counts === 'object', 'must return per-list counts keyed by header ref');
  for (const k of ['totalItems', 'scannedItems', 'unattached', 'headers']) {
    assert(typeof body[k] === 'number', `must return a numeric ${k}`);
  }
});

test('E2 (live): the figures obey the union rule — per-list counts may exceed the total', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const { body } = await getJson('/api/dlists/item-counts', 120000);
  assert(body.success === true, `counts endpoint unavailable: ${body.error}`);
  const sum = Object.values(body.counts).reduce((a, b) => a + b, 0);
  assert(sum >= body.totalItems,
    `AC-3: per-list counts sum to at least the union (shared items are counted in every list ` +
    `they belong to); got sum=${sum} total=${body.totalItems}`);
  assert(body.totalItems <= body.scannedItems,
    `the union cannot exceed what was scanned; got ${body.totalItems} > ${body.scannedItems}`);
  assert(body.unattached === body.scannedItems - body.totalItems,
    `unattached must reconcile: scanned - union; got ${body.unattached}`);
});

test('E3 (live): every counted key is a real list header on this relay', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const { body } = await getJson('/api/dlists/item-counts', 120000);
  assert(body.success === true, `counts endpoint unavailable: ${body.error}`);
  const { body: hdrs } = await getJson(`/api/strfry/scan?filter=${q({ kinds: [9998, 39998] })}`);
  const refs = new Set((hdrs.events || []).map((ev) => {
    const d = (ev.tags.find((t) => t[0] === 'd') || [])[1];
    return ev.kind === 39998 ? `39998:${ev.pubkey}:${d}` : ev.id;
  }));
  const strays = Object.keys(body.counts).filter((k) => !refs.has(k));
  assert(strays.length === 0,
    `counts must be keyed only by headers the page shows; ${strays.length} stray key(s), e.g. ${strays[0]}`);
});

test('E4: the counts route is registered', () => {
  const src = safeRead(API_INDEX);
  assert(src, 'src/api/index.js unreadable');
  assert(/api\/dlists\/item-counts/.test(src),
    'AC-1: GET /api/dlists/item-counts must be registered in src/api/index.js');
});

/* ── U: the two pages and the relay client ────────────────────────────────── */

test('U1: List Headers no longer pulls every item, and reads the counts endpoint', () => {
  const src = safeRead(LISTS_INDEX_JSX);
  assert(src, 'ui/src/pages/lists/Index.jsx unreadable');
  assert(!/queryRelay\(\{\s*kinds:\s*\[9999,\s*39999\]\s*\}\)/.test(src),
    'AC-1: the unbounded queryRelay({kinds:[9999,39999]}) is the request that fails on staging — ' +
    'moving ~416 MB to compute a few hundred integers');
  assert(/api\/dlists\/item-counts/.test(src),
    'AC-2: the page must take its per-list counts from the counts endpoint');
});

test('U2: List Headers shows the union as its total, not every item on the relay', () => {
  const src = safeRead(LISTS_INDEX_JSX);
  assert(src, 'ui/src/pages/lists/Index.jsx unreadable');
  assert(!/\{items\.length\}\s*items/.test(src),
    'AC-3: the subtitle counted every list-item event on the relay, including items in no list');
  assert(/totalItems/.test(src),
    'AC-3: the subtitle must render the union reported by the counts endpoint');
});

test('U3: List Items requests a bounded set and states the total when truncated', () => {
  const src = safeRead(LIST_ITEMS_JSX);
  assert(src, 'ui/src/pages/events/DListItemsList.jsx unreadable');
  assert(!/queryRelay\(\{\s*kinds:\s*\[9999,\s*39999\]\s*\}\)/.test(src),
    'AC-4: this page makes the same unbounded request and fails the same way');
  assert(/limit:\s*(\d+|ITEMS_LIMIT)/.test(src), 'AC-4: it must ask for a bounded set explicitly');
  assert(/ITEMS_LIMIT\s*=\s*\d+/.test(src),
    'AC-4: the bound must be a named constant with a numeric value (ADR: ITEMS_LIMIT = 500)');
  assert(/truncated/.test(src) && /total/.test(src),
    'AC-4: it must render "showing N of M" from the response\'s truncated/total — ' +
    'a truncated view is never presented as complete');
});

test('U4: the relay client exposes the bounded envelope without changing queryRelay', () => {
  const src = safeRead(RELAY_JS);
  assert(src, 'ui/src/api/relay.js unreadable');
  assert(/truncated/.test(src) && /total/.test(src),
    'AC-4: a caller needs total/truncated, which queryRelay currently discards (it returns data.events)');
});

/* ── D: the degraded path — bounded, but the total is unknowable ──────────── */

/** The truncation decision, isolated so the unknowable-total branch is testable
 *  without breaking strfry. Pinned at review; see Blocking 1-2. */
function loadResolveTotal() {
  try { return require(SCAN_JS).resolveTotal; } catch { return null; }
}

test('D1: a read that finished is complete — total is what came back', () => {
  const resolveTotal = loadResolveTotal();
  assert(typeof resolveTotal === 'function',
    'src/api/strfry/queries/scan.js must export resolveTotal({bounded, counted, received}) ' +
    '-> { total, truncated } — the truncation decision, separable from the stream');
  const r = resolveTotal({ bounded: false, counted: null, received: 42 });
  assert(r.total === 42, `a completed read totals what it returned; got ${r.total}`);
  assert(r.truncated === false, 'a completed read is not truncated');
});

test('D2: a bounded read reports the true total and says it is truncated', () => {
  const resolveTotal = loadResolveTotal();
  assert(typeof resolveTotal === 'function', 'resolveTotal not exported (see D1)');
  const r = resolveTotal({ bounded: true, counted: 473101, received: 500 });
  assert(r.total === 473101, `AC-4: the true total must survive; got ${r.total}`);
  assert(r.truncated === true, 'AC-4: 500 of 473,101 is truncated');
});

test('D3: a bound hit at exactly the match size is NOT truncated', () => {
  const resolveTotal = loadResolveTotal();
  assert(typeof resolveTotal === 'function', 'resolveTotal not exported (see D1)');
  const r = resolveTotal({ bounded: true, counted: 5, received: 5 });
  assert(r.truncated === false,
    'asking for 5 when exactly 5 exist stops at the bound but hides nothing — ' +
    'reporting it truncated would be a false alarm');
  assert(r.total === 5, `got ${r.total}`);
});

test('D4: a bounded read whose total cannot be read NEVER claims to be complete', () => {
  const resolveTotal = loadResolveTotal();
  assert(typeof resolveTotal === 'function', 'resolveTotal not exported (see D1)');
  const r = resolveTotal({ bounded: true, counted: null, received: 500 });
  assert(r.truncated === true,
    'AC-5: the read stopped early — that is known for certain. If the count is ' +
    'unavailable the response must still say the set is partial. Reporting ' +
    'truncated:false here is the silent-partial failure this whole story exists to remove');
  assert(r.total !== 500,
    'AC-5: and it must not pass the bounded length off as the true total — ' +
    '"showing 500 of 500, truncated" is a contradiction. Report the total as unknown (null)');
  assert(r.total === null, `an unknowable total is null, not a guess; got ${r.total}`);
});

test('D5: List Items renders a truncated set whose total is unknown, without crashing', () => {
  const src = safeRead(LIST_ITEMS_JSX);
  assert(src, 'ui/src/pages/events/DListItemsList.jsx unreadable');
  assert(!/\btotal\.toLocaleString\(\)/.test(src),
    'AC-4: total can be null when it could not be read (D4), so an unguarded ' +
    'total.toLocaleString() would throw and blank the page on exactly the degraded path');
});

/* ── R: regression pins — green BEFORE and AFTER ──────────────────────────── */

test('R1: queryRelay still returns the events array, so untouched callers keep working', () => {
  const src = safeRead(RELAY_JS);
  assert(src, 'ui/src/api/relay.js unreadable');
  assert(/export\s+async\s+function\s+queryRelay\b/.test(src),
    'AC-6: queryRelay is used by ~20 call sites this story does not touch');
  assert(/return\s+data\.events/.test(src),
    'AC-6: its return shape must not change — the guard is additive');
});

test('R2: the scan siblings stay registered and untouched', () => {
  const src = safeRead(API_INDEX);
  assert(src, 'src/api/index.js unreadable');
  assert(/api\/strfry\/scan\/stream/.test(src), 'the streaming scan must remain available');
  assert(/api\/strfry\/scan\/count/.test(src), 'the count scan must remain available');
});

test('R3 (live): the count endpoint still answers for the filter that breaks the page', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const { body } = await getJson(`/api/strfry/scan/count?filter=${q({ kinds: [9999, 39999] })}`);
  assert(body.success === true && typeof body.count === 'number',
    'AC-6: /api/strfry/scan/count is how the true total is obtained; it must keep working');
});

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  PASS  ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${t.name}`);
      console.log(`        ${err.message}`);
      failures.push(t.name); fail++;
    }
  }
  console.log(`\nrelay-scan-bounds: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
