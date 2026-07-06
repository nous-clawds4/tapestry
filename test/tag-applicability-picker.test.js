/**
 * Story tag-applicability #2: type-aware tag picker + scheduled TL regen.
 * ADR tag-applicability/0002. See engineering-team/stories/tag-applicability/2-...test-plan.md
 *
 * ADR chose Option A:
 *  - a LIVE, viewer-inclusive `applicabilityMembers({type,viewerPubkey,deps})` (in
 *    refreshApplicabilityLists.js, reusing Story-1 `buildMembers`) that computes HINT ∪ USAGE
 *    for a context and returns member keys — served by GET /api/tags/applicability;
 *  - AddTagDialog's BROWSE (no-query) is hard-filtered to the context's `applicableKeys`, while
 *    SEARCH (query) still spans ALL availableTags (the anti-re-mint escape);
 *  - the two mounts (ProfileTagsSection=pubkey, NoteTags=event) pass type + viewer;
 *  - `computeTagUsageRows` gains `alsoTrust` (the viewer's own usage counts → immediate graduation);
 *  - `refreshApplicabilityLists` is scheduled via the task-queue.
 *
 * TEST LEVELS:
 *  - P* : EXECUTE `applicabilityMembers` with injected deps (union, type→byType, viewer wiring,
 *         member shape, ordering, dedup) — no live strfry/meili.
 *  - S* : server source sentinels (the event-tags handler + route + computeTagUsageRows alsoTrust).
 *  - U* : UI sentinels (hook, AddTagDialog browse-filter vs search-all, the two mounts).
 *  - SCH*: scheduler sentinels (registry entry + the loopback-curl .sh).
 *
 * ALL FAIL pre-implementation (applicabilityMembers / endpoint / hook / dialog wiring / task absent).
 */

const fs = require('fs');
const path = require('path');

const DERIVE_PATH = path.resolve(__dirname, '../src/api/trustedList/refreshApplicabilityLists.js');
const EVENT_TAGS = path.resolve(__dirname, '../src/api/event-tags/index.js');
const API_INDEX = path.resolve(__dirname, '../src/api/index.js');
const HOOK = path.resolve(__dirname, '../ui/src/hooks/useTagApplicability.js');
const DIALOG = path.resolve(__dirname, '../ui/src/components/AddTagDialog.jsx');
const PROFILE_SEC = path.resolve(__dirname, '../ui/src/components/ProfileTagsSection.jsx');
const NOTE_TAGS = path.resolve(__dirname, '../ui/src/components/NoteTags.jsx');
const TASK_REGISTRY = path.resolve(__dirname, '../src/manage/taskQueue/taskRegistry.json');
const REFRESH_SH = path.resolve(__dirname, '../src/algos/refreshApplicabilityLists.sh');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadDerive() {
  try { delete require.cache[require.resolve(DERIVE_PATH)]; } catch { /* fine */ }
  try { return require(DERIVE_PATH); } catch { return null; }
}

const HEX = (c) => c.repeat(64);
const ALICE = HEX('a');
const BOB = HEX('b');
const VIEWER = HEX('c');

function usageRow(author, slug, byType) { return { tag: { authorPubkey: author, slug }, byType: byType || {} }; }
function hintEl(author, slug) { return { kind: 39999, pubkey: author, created_at: 1, tags: [['d', slug]], content: '{}' }; }

// deps for applicabilityMembers: computeUsageRows (spy) + scanStrfry (filter-dispatch by #z).
function makeDeps({ usage = [], eventHints = [], pubkeyHints = [] } = {}) {
  const usageCalls = [];
  return {
    usageCalls,
    deps: {
      computeUsageRows: async (opts) => { usageCalls.push(opts || {}); return usage; },
      scanStrfry: async (filter) => {
        const zs = filter && filter['#z'];
        if (zs && zs.some((z) => /event/.test(z))) return eventHints;
        if (zs && zs.some((z) => /pubkey/.test(z))) return pubkeyHints;
        return [];
      },
    },
  };
}
async function call(mod, { type, viewerPubkey, scenario }) {
  assert(mod && typeof mod.applicabilityMembers === 'function',
    'refreshApplicabilityLists.js must export async applicabilityMembers({type,viewerPubkey,deps}) — absent pre-implementation (ADR 0002).');
  const { deps, usageCalls } = makeDeps(scenario || {});
  const res = await mod.applicabilityMembers({ type, viewerPubkey, deps, ...deps });
  return { res, usageCalls };
}
function coords(res) { return (res.members || []).map((m) => `${m.authorPubkey}:${m.slug}`); }

// ===========================================================================
// P — applicabilityMembers: live HINT ∪ USAGE, per context (executes the module)
// ===========================================================================

test('P1: USAGE-only — an event-used tag is in the EVENT members, not the pubkey members', async () => {
  const mod = loadDerive();
  const ev = await call(mod, { type: 'event', scenario: { usage: [usageRow(ALICE, 'podcaster', { event: { applications: 3 } })] } });
  const pk = await call(mod, { type: 'pubkey', scenario: { usage: [usageRow(ALICE, 'podcaster', { event: { applications: 3 } })] } });
  assert(coords(ev.res).includes(`${ALICE}:podcaster`), 'event-usage tag must be in the event members.');
  assert(!coords(pk.res).includes(`${ALICE}:podcaster`), 'event-usage-only must NOT appear in the pubkey members.');
});

test('P2: type=pubkey maps to byType.profile', async () => {
  const mod = loadDerive();
  const { res } = await call(mod, { type: 'pubkey', scenario: { usage: [usageRow(BOB, 'vegan', { profile: { applications: 2 } })] } });
  assert(coords(res).includes(`${BOB}:vegan`), "type='pubkey' must read byType.profile (a profile-used tag appears).");
});

test('P3: HINT-only — a usage-less tag carrying the event hint is in the EVENT members (cold-start)', async () => {
  const mod = loadDerive();
  const { res } = await call(mod, { type: 'event', scenario: { usage: [], eventHints: [hintEl(ALICE, 'newtag')] } });
  assert(coords(res).includes(`${ALICE}:newtag`), 'a hint-only tag must appear via the HINT half of the union.');
});

test('P4: HINT ∪ USAGE deduped by a-coordinate (hint + usage same type ⇒ one)', async () => {
  const mod = loadDerive();
  const { res } = await call(mod, { type: 'event', scenario: { usage: [usageRow(ALICE, 'dupe', { event: { applications: 1 } })], eventHints: [hintEl(ALICE, 'dupe')] } });
  assert(coords(res).filter((c) => c === `${ALICE}:dupe`).length === 1, 'a tag present via hint AND usage must appear once.');
});

test('P5: viewer-inclusive — computeUsageRows is called with alsoTrust=viewer (immediate graduation)', async () => {
  const mod = loadDerive();
  const { usageCalls } = await call(mod, { type: 'event', viewerPubkey: VIEWER, scenario: { usage: [] } });
  assert(usageCalls.length >= 1, 'applicabilityMembers must call computeUsageRows.');
  assert(usageCalls.some((o) => o.alsoTrust === VIEWER),
    'when a viewerPubkey is supplied it must be passed as alsoTrust so the viewer\'s own usage counts (immediate graduation).');
});

test('P6: member shape is { authorPubkey, slug, applications }, ordered by usage desc', async () => {
  const mod = loadDerive();
  const { res } = await call(mod, { type: 'event', scenario: { usage: [usageRow(ALICE, 'lo', { event: { applications: 1 } }), usageRow(BOB, 'hi', { event: { applications: 9 } })] } });
  const m = res.members || [];
  assert(m.length === 2 && m[0].authorPubkey && typeof m[0].slug === 'string' && 'applications' in m[0],
    'members must be objects { authorPubkey, slug, applications }.');
  assert(m[0].slug === 'hi' && m[1].slug === 'lo', 'members must be ordered by usage count desc.');
});

// ===========================================================================
// S — server wiring sentinels (handler + route + computeTagUsageRows alsoTrust)
// ===========================================================================

test('S1: event-tags exposes handleTagApplicability; validates type; passes alsoTrust=viewer', () => {
  const src = safeRead(EVENT_TAGS);
  assert(/handleTagApplicability/.test(src), 'event-tags/index.js must add handleTagApplicability.');
  assert(/applicabilityMembers/.test(src), 'the handler must delegate to applicabilityMembers (shared union — ADR 0002).');
  assert(/type[\s\S]{0,60}(400|status\(400\))/.test(src) || /\b(pubkey|event)\b[\s\S]{0,40}400/.test(src),
    'an invalid `type` must 400.');
  assert(/alsoTrust/.test(src) && /viewerPubkey/.test(src),
    'the handler must thread viewerPubkey → alsoTrust (viewer-inclusive usage).');
});

test('S2: GET /api/tags/applicability is registered', () => {
  const src = safeRead(API_INDEX);
  assert(/['"]\/api\/tags\/applicability['"]/.test(src) && /handleTagApplicability/.test(src),
    "src/api/index.js must register GET /api/tags/applicability → handleTagApplicability (beside /api/tags/index).");
});

test('S3: computeTagUsageRows accepts alsoTrust and always-trusts that pubkey', () => {
  const src = safeRead(EVENT_TAGS);
  assert(/computeTagUsageRows\s*\(\s*\{[^}]*alsoTrust/.test(src),
    'computeTagUsageRows must accept an `alsoTrust` option.');
  assert(/alsoTrust[\s\S]{0,120}(===|==)/.test(src) || /pk\s*===\s*alsoTrust/.test(src),
    'the trust predicate must return true for `alsoTrust` unconditionally (viewer\'s own usage counts).');
});

// ===========================================================================
// U — the picker: hard-filtered browse + search-all escape
// ===========================================================================

test('U1: useTagApplicability(type, viewer) fetches the typed+viewer endpoint and returns applicableKeys', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'ui/src/hooks/useTagApplicability.js must exist (ADR 0002).');
  assert(/useTagApplicability\s*\(\s*type/.test(src), 'useTagApplicability must take (type, viewerPubkey?).');
  assert(/\/api\/tags\/applicability\?type=/.test(src), 'must fetch /api/tags/applicability?type=…');
  assert(/viewerPubkey/.test(src), 'must include the viewerPubkey (for viewer-inclusive graduation).');
  assert(/applicableKeys/.test(src) && /authorPubkey|:\$\{|:'/.test(src),
    'must return applicableKeys as `authorPubkey:slug` strings.');
  assert(/AbortController/.test(src), 'must abort on unmount.');
});

test('U2: AddTagDialog BROWSE (no-query) is hard-filtered to applicableKeys', () => {
  const src = safeRead(DIALOG);
  assert(/applicableKeys/.test(src), 'AddTagDialog must accept an applicableKeys prop (ADR 0002).');
  // The no-query branch must restrict to applicableKeys membership (by authorPubkey:slug).
  assert(/applicableKeys[\s\S]{0,200}(includes|has|Set|indexOf)/.test(src),
    'the no-query browse must keep only candidates whose authorPubkey:slug ∈ applicableKeys (hard filter).');
});

test('U3 (SAFETY): SEARCH (query branch) still spans ALL availableTags — the anti-re-mint escape', () => {
  const src = safeRead(DIALOG);
  // The query branch must filter availableTags by name/slug/description WITHOUT intersecting
  // applicableKeys — so typing `funny` finds a cross-context tag and prevents re-minting.
  const qBranch = src.match(/if\s*\(\s*!q\s*\)[\s\S]{0,600}/);
  assert(qBranch, 'AddTagDialog must keep its query branch.');
  assert(/\.includes\(q\)/.test(src),
    'the search branch must still match name/slug/description across availableTags (full-universe search).');
  // Guard: the applicableKeys filter must NOT also gate the query branch. Use [^}] so the match
  // can't cross the useMemo body's closing brace into its dependency array (listing applicableKeys
  // as a React dep is not search-gating — that would be a false positive).
  assert(!/includes\(q\)[^}]{0,140}applicableKeys/.test(src) && !/applicableKeys[^}]{0,140}includes\(q\)/.test(src),
    'the applicableKeys hard-filter must apply to BROWSE only — search must reach every tag (the escape that prevents re-minting, the funny bug).');
});

test('U4: absent/empty applicableKeys ⇒ browse does not blank (graceful fallback)', () => {
  const src = safeRead(DIALOG);
  assert(/applicableKeys\s*&&|applicableKeys\?\.|applicableKeys\.length|!applicableKeys/.test(src),
    'AddTagDialog must guard applicableKeys (absent/empty ⇒ fall back to the current browse, never an empty picker).');
});

test('U5: the two mounts wire useTagApplicability with their type + pass applicableKeys', () => {
  const prof = safeRead(PROFILE_SEC);
  const note = safeRead(NOTE_TAGS);
  assert(/useTagApplicability\s*\(\s*['"]pubkey['"]/.test(prof) && /applicableKeys=/.test(prof),
    "ProfileTagsSection must call useTagApplicability('pubkey', …) and pass applicableKeys to AddTagDialog.");
  assert(/useTagApplicability\s*\(\s*['"]event['"]/.test(note) && /applicableKeys=/.test(note),
    "NoteTags must call useTagApplicability('event', …) and pass applicableKeys to AddTagDialog.");
});

// ===========================================================================
// SCH — scheduled regeneration of the published lists
// ===========================================================================

test('SCH1: taskRegistry declares refreshApplicabilityLists (class-less, timer-based)', () => {
  const raw = safeRead(TASK_REGISTRY);
  let reg = {}; try { reg = JSON.parse(raw); } catch { /* fail below */ }
  const t = reg.tasks && reg.tasks.refreshApplicabilityLists;
  assert(t, 'taskRegistry.json must add a `refreshApplicabilityLists` task (ADR 0002).');
  assert(!t.resourceClass, 'it must NOT declare a resourceClass (skips the neo4j-heavy semaphore — it is a strfry scan+publish job).');
  assert(t.frequency !== 'continuous', 'frequency must not be "continuous" (scheduler rejects it).');
  assert(/refreshApplicabilityLists\.sh/.test(JSON.stringify(t)), 'it must point at algos/refreshApplicabilityLists.sh.');
});

test('SCH2: the worker script curls the existing loopback refresh endpoint', () => {
  const sh = safeRead(REFRESH_SH);
  assert(sh.length > 0, 'src/algos/refreshApplicabilityLists.sh must exist.');
  assert(/127\.0\.0\.1/.test(sh) && /refresh-applicability-lists/.test(sh),
    'the script must curl POST http://127.0.0.1:…/api/trusted-list/refresh-applicability-lists (mirrors refreshPinnedTagTLs.sh).');
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
