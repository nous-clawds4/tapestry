/**
 * /tags index performance — cached aggregate + batched header resolution.
 *
 * Operator report 2026-09-17: "/tags could use the same performance improvement /lists
 * got? same slowness". Diagnosis: NOT the same shape. `/lists` blocked its render on a
 * whole-corpus count call and was fixed by paging the render (story #9). `/tags` already
 * pages client-side; the cost is that `handleTagIndex` recomputes a whole-corpus aggregate
 * on EVERY request and pages in memory afterwards. Measured on tags.brainstorm.world:
 * ~5-6 s per request, and an empty `offset=50` page cost the same 5.3 s as page 1 — so
 * pagination cannot help. Fix: cache the aggregate per POV, and collapse the
 * one-scan-per-descriptor N+1 into one scan per author.
 *
 * S (structure) — the cache exists with the for-tag cache's discipline (POV in the key,
 *                 `nocache=1` escape, bounded size), the per-request copy that keeps a
 *                 shared cached array from being sorted in place, and the batched header
 *                 resolver replacing every per-descriptor scan loop.
 * R (regression) — the response contract, the sorters, the POV predicate and the for-tag
 *                  cache are untouched; the module still loads.
 *
 * Not covered here: wall-clock timing (measured by hand against the live corpus — the
 * numbers are in the module comment) and the rendered page. `handleTagIndex` takes no
 * injectable scan seam, so behavioural coverage stays with the live `tag-index` suite.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'src/api/event-tags/index.js');

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

let passed = 0;
let failed = 0;
const failures = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

test('S1: the tag-index aggregate is cached with a bounded, TTL-bounded map', () => {
  const src = read(SRC);
  assert(/TAG_INDEX_TTL_MS\s*=\s*\d+/.test(src), 'a TTL constant must exist for the tag-index cache.');
  assert(/TAG_INDEX_CACHE_MAX\s*=\s*\d+/.test(src), 'the cache must be size-bounded.');
  assert(/const tagIndexCache = new Map\(\)/.test(src), 'the cache itself must exist.');
  assert(/tagIndexCache\.size >= TAG_INDEX_CACHE_MAX\) tagIndexCache\.clear\(\)/.test(src),
    'the bound must be enforced on write (evict-all, the for-tag cache rule).');
  assert(/expires: Date\.now\(\) \+ TAG_INDEX_TTL_MS/.test(src), 'entries must carry an expiry.');
  assert(/hit\.expires > Date\.now\(\)/.test(src), 'a stale entry must not be served.');
});

test('S2: the cache key carries the POV inputs and NOTHING that is applied in memory', () => {
  const src = read(SRC);
  const m = /const cacheKey = `\$\{authorities\.join\(','\)\}\|\$\{viewerPubkey \|\| ''\}\|\$\{wotPov\}\|\$\{userPubkey\}`/.exec(src);
  assert(m, 'the key must be authorities|viewerPubkey|wotPov|userPubkey — a cached povResolution must never describe another POV.');
  const key = m[0];
  // These are applied to the cached aggregate afterwards; including them would multiply
  // the entries and lose the "one entry serves every sort and page" property.
  for (const excluded of ['sort', 'offset', 'limit', '{q}', 'authoredBy', 'pinnedByMe']) {
    assert(!key.includes(excluded), `${excluded} must NOT be in the cache key — it is applied in memory.`);
  }
});

test('S3: nocache=1 skips the read but still warms the cache', () => {
  const src = read(SRC);
  const i = src.indexOf('async function handleTagIndex');
  const end = src.indexOf('async function handleNotesByAuthor');
  const body = src.slice(i, end > i ? end : i + 8000);
  assert(/const noCache = req\.query\.nocache === '1' \|\| req\.query\.nocache === 'true'/.test(body),
    'handleTagIndex must honor nocache, like the for-tag read.');
  assert(/let agg = \(!noCache && hit/.test(body), 'nocache must bypass the cache READ.');
  // The write is unconditional inside the recompute branch, so a nocache request leaves
  // the next normal read warm rather than re-paying the scan.
  assert(/tagIndexCache\.set\(cacheKey/.test(body), 'the recompute must always write back.');
});

test('S4: the cached rows are copied before sorting — no cross-request mutation', () => {
  const src = read(SRC);
  assert(/let rows = agg\.rows\.slice\(\);/.test(src),
    'the per-request rows MUST be a copy: rows.sort() mutates in place, and agg.rows is shared by every request on that cache entry.');
  const slicePos = src.indexOf('let rows = agg.rows.slice();');
  const sortPos = src.indexOf('rows.sort(SORTERS[sort]);');
  assert(slicePos > 0 && sortPos > slicePos, 'the copy must happen before the sort.');
});

test('S5: header resolution is batched one scan per author, and no N+1 loop survives', () => {
  const src = read(SRC);
  assert(/async function resolveTaggingHeaders\(descriptors\)/.test(src), 'the batched resolver must exist.');
  assert(/authors: \[author\], '#d': Array\.from\(ds\)/.test(src),
    'it must pass ALL of an author\'s d-tags in one scan.');
  assert(/return dedupeReplaceable\(found\)/.test(src),
    'it must keep newest-wins semantics, as the per-coordinate loop did.');
  // Exactly one `for (const coord of descriptors)` may remain: the resolver's own
  // grouping loop, which performs no scan.
  const loops = (src.match(/for \(const coord of descriptors\)/g) || []).length;
  assert(loops === 1, `every per-descriptor SCAN loop must be gone; found ${loops} descriptor loops (expected only the resolver's grouping loop).`);
  assert(!/for \(const coord of descriptors\)[\s\S]{0,220}?strfryScan\(\{ kinds: \[39999\], authors: \[m\[1\]\]/.test(src),
    'no remaining loop may scan once per coordinate.');
});

test('S6: all four former call sites now use the shared resolver', () => {
  const src = read(SRC);
  const calls = (src.match(/await resolveTaggingHeaders\(descriptors\)/g) || []).length;
  assert(calls === 4,
    `handleForEvent, computeTagUsageRows, handleTagIndex and handleNotesByAuthor must all delegate; found ${calls} call sites.`);
});

test('R1: the response contract and the sorters are unchanged', () => {
  const src = read(SRC);
  assert(/rows: rows\.slice\(offset, offset \+ limit\), total, offset, limit/.test(src),
    'the paged response shape must be unchanged.');
  assert(/success: true, authorities, povSuffix, minRank, povResolution, sort/.test(src),
    'the response must still report the POV it was computed under.');
  for (const s of ['used:', 'endorsed:', 'divisive:', "'most-pinned':"]) {
    assert(src.includes(s), `the ${s} sorter must survive.`);
  }
  assert(/const \{ povSuffix, minRank, povResolution \} = agg;/.test(src),
    'the reported POV must come from the aggregate that was actually computed, not from the request.');
});

test('R2: the for-tag cache and the POV predicate are untouched', () => {
  const src = read(SRC);
  assert(/const FOR_TAG_TTL_MS = 30000/.test(src) && /const forTagCache = new Map\(\)/.test(src),
    'the pre-existing for-tag cache must be untouched.');
  assert(/async function buildTrustPredicate/.test(src), 'the POV predicate builder must be untouched.');
  assert(/buildTrustPredicate\(req, assertions\.map\(\(c\) => c\.pubkey\)\)/.test(src),
    'the tag index must still build its predicate over the scanned asserters (POV-first).');
});

test('R3: the module still loads and exports its handlers', () => {
  // eslint-disable-next-line global-require
  const mod = require(SRC);
  for (const fn of ['handleForEvent', 'handleTagIndex', 'handleForTag', 'computeTagUsageRows']) {
    assert(typeof mod[fn] === 'function', `${fn} must still be exported.`);
  }
});

async function run() {
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') continue;
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      failed++;
      failures.push({ name: t.name, error: err.message });
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
    }
  }
  console.log(`tag-index-performance: ${passed} passed, ${failed} failed`);
  return { pass: passed, fail: failed, skipped: 0, failures };
}

module.exports = { run };
