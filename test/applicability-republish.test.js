/**
 * Story tag-applicability #4 (ADR 0003): event-driven applicability republish.
 *   - Diff-guard in refreshApplicabilityLists: skip a list whose member SET is unchanged.
 *   - createApplicabilityScheduler: in-process debounce (coalesce + overlap-guard).
 *   - POST /api/trusted-list/notify-applicability: user-authed, schedules a debounced refresh.
 *   - Client notifyTagApplicability(): fire-and-forget from the tag mutation paths.
 *   - Slow backstop: freshInstallEntries seeds refreshApplicabilityLists (disabled, hourly).
 *
 * LEVELS:
 *   - DG* : EXECUTE refreshApplicabilityLists with injected deps — the diff-guard.
 *   - SC* : EXECUTE createApplicabilityScheduler — coalescing + trailing-run.
 *   - EP/CL/BK : source sentinels (endpoint auth+wiring, client util+call sites, backstop seed).
 *
 * All FAIL pre-implementation (diff-guard always-publishes; scheduler/util/endpoint/seed absent).
 */

const fs = require('fs');
const path = require('path');

const REFRESH_PATH = path.resolve(__dirname, '../src/api/trustedList/refreshApplicabilityLists.js');
const SCHEDULER_PATH = path.resolve(__dirname, '../src/api/trustedList/applicabilityScheduler.js');
const TL_INDEX = path.resolve(__dirname, '../src/api/trustedList/index.js');
const NOTIFY_UTIL = path.resolve(__dirname, '../ui/src/utils/notifyTagApplicability.js');
const PROFILE_HOOK = path.resolve(__dirname, '../ui/src/hooks/useProfileTags.js');
const EVENT_HOOK = path.resolve(__dirname, '../ui/src/hooks/useEventTagging.js');
const SCHED_TASKS = path.resolve(__dirname, '../src/api/scheduled-tasks/index.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadRefresh() { try { delete require.cache[require.resolve(REFRESH_PATH)]; } catch { /* */ } try { return require(REFRESH_PATH); } catch { return null; } }
function loadScheduler() { try { return require(SCHEDULER_PATH); } catch { return null; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── fixtures ──
const TA = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const ALICE = '2222222222222222222222222222222222222222222222222222222222222222';
const BOB = '3333333333333333333333333333333333333333333333333333333333333333';
const EVENT_Z = 'tag-for-nostr-event';
const PUBKEY_Z = 'tag-for-nostr-pubkey';
const aCoord = (author, slug) => `39999:${author}:${slug}`;
function usageRow(author, slug, byType) { return { tag: { authorPubkey: author, slug }, byType }; }
// a currently-published kind-30394 list event with the given a-coordinate members.
function listEvent(dTag, coords, kind = 30394) {
  return { kind, pubkey: TA, created_at: 100, content: '', tags: [['d', dTag], ...coords.map((c) => ['a', c])] };
}

// deps whose scanStrfry answers BOTH the #z hint scans AND the #d current-list scan (30394)
// AND the legacy #d scan (30393, for retraction). `current` maps dTag → coords[].
function makeDeps({ usage = [], eventHintEls = [], pubkeyHintEls = [], current = {} } = {}) {
  const publishCalls = [];
  return {
    publishCalls,
    deps: {
      loadUsageRows: async () => usage,
      scanStrfry: async (filter) => {
        const zs = filter && filter['#z'];
        if (zs && zs.includes(EVENT_Z)) return eventHintEls;
        if (zs && zs.includes(PUBKEY_Z)) return pubkeyHintEls;
        const ds = filter && filter['#d'];
        const kinds = (filter && filter.kinds) || [];
        if (ds && kinds.includes(30394)) {
          const dTag = ds[0];
          return current[dTag] ? [listEvent(dTag, current[dTag])] : [];
        }
        return []; // legacy 30393 #d scan (retraction) → none
      },
      publishTL: async (args) => { publishCalls.push(args); return { uuid: `${args.kind}:${TA}:${args.dTag}` }; },
    },
  };
}
const pub30394 = (calls) => calls.filter((c) => c.kind === 30394);

// ===========================================================================
// DG — the diff-guard (executes refreshApplicabilityLists)
// ===========================================================================

test('DG1: both lists unchanged vs currently-published set ⇒ NO kind-30394 publish (churn-free)', async () => {
  const d = loadRefresh();
  assert(d && typeof d.refreshApplicabilityLists === 'function', 'refreshApplicabilityLists must load.');
  const D_EVENT = d.D_EVENT, D_PUBKEY = d.D_PUBKEY;
  const { deps, publishCalls } = makeDeps({
    usage: [usageRow(ALICE, 'e1', { event: { applications: 1 } }), usageRow(BOB, 'p1', { profile: { applications: 1 } })],
    current: { [D_EVENT]: [aCoord(ALICE, 'e1')], [D_PUBKEY]: [aCoord(BOB, 'p1')] },
  });
  await d.refreshApplicabilityLists({ deps });
  assert(pub30394(publishCalls).length === 0,
    `both lists' member sets equal the currently-published ones ⇒ diff-guard must skip both (0 publishes); got ${pub30394(publishCalls).length}.`);
});

test('DG2: a changed set republishes only the changed list', async () => {
  const d = loadRefresh();
  const D_EVENT = d.D_EVENT, D_PUBKEY = d.D_PUBKEY;
  const { deps, publishCalls } = makeDeps({
    usage: [usageRow(ALICE, 'e1', { event: { applications: 1 } }), usageRow(BOB, 'p1', { profile: { applications: 1 } })],
    // event list gained ALICE:e1 vs a stale published set; pubkey list unchanged.
    current: { [D_EVENT]: [aCoord(ALICE, 'OLD')], [D_PUBKEY]: [aCoord(BOB, 'p1')] },
  });
  await d.refreshApplicabilityLists({ deps });
  const republished = pub30394(publishCalls);
  assert(republished.length === 1, `only the changed (event) list must republish; got ${republished.length}.`);
  assert(republished[0].dTag === D_EVENT, `the republished list must be the event list; got ${republished[0].dTag}.`);
});

test('DG3: no currently-published list (first run) ⇒ publishes (diff-guard only skips on a real match)', async () => {
  const d = loadRefresh();
  const { deps, publishCalls } = makeDeps({
    usage: [usageRow(ALICE, 'e1', { event: { applications: 1 } })],
    current: {}, // nothing published yet
  });
  await d.refreshApplicabilityLists({ deps });
  assert(pub30394(publishCalls).length >= 1, 'with no current list, the first run must publish (nothing to diff against).');
});

// ===========================================================================
// SC — the debounced scheduler (executes createApplicabilityScheduler)
// ===========================================================================

test('SC1: many schedule() calls within the window coalesce into ONE refresh', async () => {
  const s = loadScheduler();
  assert(s && typeof s.createApplicabilityScheduler === 'function',
    'applicabilityScheduler.js must export createApplicabilityScheduler({refresh,windowMs}) — absent pre-implementation.');
  let calls = 0;
  const sched = s.createApplicabilityScheduler({ refresh: async () => { calls++; }, windowMs: 20 });
  sched.schedule(); sched.schedule(); sched.schedule();
  await sleep(60);
  assert(calls === 1, `three rapid schedule() calls must coalesce into one refresh; got ${calls}.`);
});

test('SC2: a schedule() during an in-flight refresh triggers exactly one trailing run', async () => {
  const s = loadScheduler();
  assert(s && typeof s.createApplicabilityScheduler === 'function', 'createApplicabilityScheduler must exist.');
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const sched = s.createApplicabilityScheduler({
    refresh: async () => { calls++; if (calls === 1) await gate; },
    windowMs: 10,
  });
  sched.schedule();
  await sleep(30);           // first run started, awaiting the gate
  sched.schedule();          // called mid-run → must queue a trailing run
  await sleep(30);
  assert(calls === 1, 'the mid-run call must NOT start a concurrent run.');
  release();                 // let the first run finish
  await sleep(40);
  assert(calls === 2, `exactly one trailing run must follow; got ${calls} total.`);
});

// ===========================================================================
// EP / CL / BK — endpoint, client, backstop (source sentinels)
// ===========================================================================

test('EP1: POST /api/trusted-list/notify-applicability is registered, user-authed, and schedules', () => {
  const src = safeRead(TL_INDEX);
  assert(/notify-applicability/.test(src), 'a POST /api/trusted-list/notify-applicability route must be registered.');
  // The handler must be user-authed (requireAuth) — NOT loopback — since the client calls it.
  const handler = src.match(/notify-applicability[\s\S]{0,120}/);
  assert(/requireAuth/.test(src) && /createApplicabilityScheduler|\.schedule\s*\(/.test(src),
    'the notify handler must requireAuth and call the scheduler (.schedule()).');
  assert(/createApplicabilityScheduler/.test(src), 'index.js must construct the scheduler singleton from createApplicabilityScheduler.');
});

test('CL1: notifyTagApplicability util exists (fire-and-forget) and is called from BOTH mutation hooks', () => {
  const util = safeRead(NOTIFY_UTIL);
  assert(util.length > 0, 'ui/src/utils/notifyTagApplicability.js must exist.');
  assert(/notify-applicability/.test(util) && /catch/.test(util),
    'the util must POST /api/trusted-list/notify-applicability and swallow errors (fire-and-forget).');
  const prof = safeRead(PROFILE_HOOK); const evt = safeRead(EVENT_HOOK);
  assert(/notifyTagApplicability/.test(prof), 'useProfileTags must call notifyTagApplicability (create/apply).');
  assert(/notifyTagApplicability/.test(evt), 'useEventTagging must call notifyTagApplicability (create/apply).');
});

test('BK1: freshInstallEntries seeds refreshApplicabilityLists as a DISABLED hourly backstop', () => {
  const src = safeRead(SCHED_TASKS);
  const fn = src.match(/function freshInstallEntries[\s\S]{0,1800}?\n}/);
  assert(fn, 'scheduled-tasks must define freshInstallEntries.');
  const body = fn[0];
  assert(/refreshApplicabilityLists/.test(body),
    'freshInstallEntries must seed a refreshApplicabilityLists entry (the slow backstop).');
  assert(/refreshApplicabilityLists[\s\S]{0,220}enabled:\s*false/.test(body) || /enabled:\s*false[\s\S]{0,220}refreshApplicabilityLists/.test(body),
    'the applicability backstop seed must default enabled:false (operator opts in).');
  assert(/refreshApplicabilityLists[\s\S]{0,220}intervalHours:\s*[1-9]/.test(body) || /intervalHours:\s*[1-9][\s\S]{0,220}refreshApplicabilityLists/.test(body),
    'the applicability backstop must be an HOURS cadence (slow), not minutes.');
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
