/**
 * Tests for pov-selectable-tag-surfaces Story 2 — honest state when the selected POV can't filter.
 *
 * Story: engineering-team/stories/pov-selectable-tag-surfaces/2-honest-state-for-unprovisioned-pov.md
 * ADR:   engineering-team/decisions/pov-selectable-tag-surfaces/0002-per-read-pov-resolution-status.md
 *
 * Intentionally failing until the per-read povResolution signal lands. Hand-rolled in the
 * project's existing test style — no new framework.
 *
 * TEST LEVELS:
 *   - BEHAVIORAL-UNIT: the server seams are CJS + dependency-injectable BY DESIGN (ADR
 *     testability section) — computePovStatus (pure state machine), scoresExistFor,
 *     getWotFieldDistribution (injected fetchImpl + TTL cache), resolvePovWithStatus
 *     (probe skipped when unfiltered), resolvePov provenance (injected prefs impls).
 *     No Meili, no strfry, no live API.
 *   - SOURCE-CONTRACT: the nine endpoints attach povResolution; the forTagCache key is
 *     POV-aware; TL publishers deliberately stay on bare resolvePov (sentinel); the shared
 *     PovStatusNotice + its six placements; the gate-amendment threading of
 *     useNotesForTag/usePinnedNotes; BrainstormSearch untouched (sentinel).
 *   - MANUAL: live banner semantics (dev box unfiltered / own-POV fallback / not-computed
 *     vs empty) — in the test plan's browser checklist.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }
function bodyOf(src, fnName, file) {
  const m = src.match(new RegExp(`async function ${fnName}[\\s\\S]*?\\n\\}`))
    || src.match(new RegExp(`function ${fnName}[\\s\\S]*?\\n\\}`));
  assert(m, `could not locate function ${fnName} in ${file}`);
  return m[0];
}

const U_KEY = 'a'.repeat(64);                 // the viewer's own pubkey
const U_DELEGATE = 'b'.repeat(63) + '1';      // the viewer's computed delegate (rankAuthor)
const H_DELEGATE = 'c'.repeat(63) + '2';      // the house delegate

const HOUSE_PREFS = { delegatedPubkey: H_DELEGATE, filters: { rank: { min: 2 } }, sort: { by: 'rank' } };
const USER_PREFS = { rankAuthor: U_DELEGATE, filters: { rank: { min: 5 } }, sortConfig: { by: 'mine' } };

let statusMod = null;
function loadStatusMod() {
  if (statusMod) return statusMod;
  statusMod = require('../src/api/_shared/povStatus.js');
  for (const fn of ['computePovStatus', 'getWotFieldDistribution', 'scoresExistFor', 'resolvePovWithStatus', '__resetPovStatusCacheForTests']) {
    assert(typeof statusMod[fn] === 'function', `povStatus.js must export ${fn} (ADR testability seam)`);
  }
  return statusMod;
}
function loadPovMod() { return require('../src/api/_shared/pov.js'); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─────────────────────────── BEHAVIORAL-UNIT ─────────────────────────── */

t('B1a: filtered-normally — house POV with existing scores → {mode:filtered, fellBackToHouse:false} (AC-5)', () => {
  const { computePovStatus } = loadStatusMod();
  const s = computePovStatus({ requestedPov: 'house', delegateSource: 'house-prefs', povSuffix: 'cccccccc', minRank: 2, scoresExist: true });
  assertEqual(s.mode, 'filtered', 'a provisioned house POV reports mode=filtered');
  assertEqual(s.fellBackToHouse, false, 'house-requested is not a fallback');
});

t('B1b: unfiltered when no suffix or no finite minRank — and minRank 0 IS finite (AC-2)', () => {
  const { computePovStatus } = loadStatusMod();
  assertEqual(computePovStatus({ requestedPov: 'house', delegateSource: 'none', povSuffix: null, minRank: null, scoresExist: null }).mode,
    'unfiltered', 'no delegate → mode=unfiltered (the count-everyone guard, disclosed)');
  assertEqual(computePovStatus({ requestedPov: 'house', delegateSource: 'house-prefs', povSuffix: 'cccccccc', minRank: null, scoresExist: null }).mode,
    'unfiltered', 'suffix without a finite minRank → unfiltered (the exact wotFiltering guard)');
  assertEqual(computePovStatus({ requestedPov: 'house', delegateSource: 'house-prefs', povSuffix: 'cccccccc', minRank: 0, scoresExist: true }).mode,
    'filtered', 'minRank 0 is finite → filtering runs (must not be misread as unfiltered)');
});

t('B1c: own-requested resolved from house prefs → fellBackToHouse:true; from own prefs → false (AC-1)', () => {
  const { computePovStatus } = loadStatusMod();
  const fb = computePovStatus({ requestedPov: 'user', delegateSource: 'house-prefs', povSuffix: 'cccccccc', minRank: 2, scoresExist: true });
  assertEqual(fb.mode, 'filtered', 'the house fallback still filters');
  assertEqual(fb.fellBackToHouse, true, 'user-requested + house-supplied delegate = the silent substitution, now visible');
  const own = computePovStatus({ requestedPov: 'user', delegateSource: 'user-prefs', povSuffix: 'bbbbbbbb', minRank: 5, scoresExist: true });
  assertEqual(own.fellBackToHouse, false, 'user-requested + user-prefs delegate is NOT a fallback');
});

t('B1d: scoresExist:false → mode:not-computed; but unfiltered takes precedence (AC-3)', () => {
  const { computePovStatus } = loadStatusMod();
  assertEqual(computePovStatus({ requestedPov: 'house', delegateSource: 'house-prefs', povSuffix: 'cccccccc', minRank: 2, scoresExist: false }).mode,
    'not-computed', 'a resolved suffix with no wot_rank_<suffix> scores → not-computed (≠ genuinely empty)');
  assertEqual(computePovStatus({ requestedPov: 'house', delegateSource: 'none', povSuffix: null, minRank: null, scoresExist: false }).mode,
    'unfiltered', 'precedence: unfiltered (no filter ran at all) beats not-computed');
});

t('B1e: scoresExist:null (probe unavailable) → mode:filtered — never claim a degradation we cannot prove (AC-5)', () => {
  const { computePovStatus } = loadStatusMod();
  assertEqual(computePovStatus({ requestedPov: 'house', delegateSource: 'house-prefs', povSuffix: 'cccccccc', minRank: 2, scoresExist: null }).mode,
    'filtered', 'Meili-down must NOT escalate to not-computed (no false provisioning claims)');
});

t('B2: scoresExistFor — count>0 → true; 0 → false; absent → false; null distribution → null', () => {
  const { scoresExistFor } = loadStatusMod();
  assertEqual(scoresExistFor('abcd1234', { wot_rank_abcd1234: 10 }), true, '>0 docs carry the column → provisioned');
  assertEqual(scoresExistFor('abcd1234', { wot_rank_abcd1234: 0 }), false, '0 docs → not provisioned');
  assertEqual(scoresExistFor('abcd1234', { other_field: 3 }), false, 'column absent → not provisioned');
  assertEqual(scoresExistFor('abcd1234', null), null, 'no distribution (probe failed) → null, not false');
});

t('B3: getWotFieldDistribution — OK → distribution; non-OK → null; throw → null; TTL cache holds', async () => {
  const { getWotFieldDistribution, __resetPovStatusCacheForTests } = loadStatusMod();
  __resetPovStatusCacheForTests();
  const dist = { wot_rank_abcd1234: 7 };
  let calls = 0;
  const okFetch = async () => { calls++; return { ok: true, json: async () => ({ fieldDistribution: dist }) }; };
  const got = await getWotFieldDistribution({ fetchImpl: okFetch });
  assert(got && got.wot_rank_abcd1234 === 7, 'a successful stats GET returns the fieldDistribution');
  // Cached: a second call within the TTL must not re-fetch.
  const spy = async () => { throw new Error('must not be called — cached'); };
  const again = await getWotFieldDistribution({ fetchImpl: spy });
  assert(again && again.wot_rank_abcd1234 === 7, 'within the TTL the cached distribution is served (no re-fetch)');
  assertEqual(calls, 1, 'exactly one real fetch');

  __resetPovStatusCacheForTests();
  assertEqual(await getWotFieldDistribution({ fetchImpl: async () => ({ ok: false }) }), null, 'non-OK → null');
  __resetPovStatusCacheForTests();
  assertEqual(await getWotFieldDistribution({ fetchImpl: async () => { throw new Error('down'); } }), null, 'fetch throw → null (never rejects)');
});

t('B4: resolvePovWithStatus skips the Meili probe entirely when not filtering — dev boxes add zero requests (AC-5)', async () => {
  const { resolvePovWithStatus, __resetPovStatusCacheForTests } = loadStatusMod();
  __resetPovStatusCacheForTests();
  let probed = 0;
  const out = await resolvePovWithStatus({ wotPov: 'house', userPubkey: null }, {
    readUserPrefsImpl: () => ({}),
    loadHousePrefsImpl: () => ({}),                    // no delegate anywhere → not filtering
    fetchImpl: async () => { probed++; return { ok: true, json: async () => ({ fieldDistribution: {} }) }; },
  });
  assertEqual(probed, 0, 'no delegate → the stats probe must not run at all');
  assert(out.povResolution, 'resolvePovWithStatus returns the povResolution object');
  assertEqual(out.povResolution.mode, 'unfiltered', 'and reports mode=unfiltered');
  assertEqual(out.povResolution.scoresExist, null, 'scoresExist is null (unknown) when the probe was skipped');
});

t('B5: resolvePov provenance — each cascade branch is visible (requestedPov/delegateSource) (AC-1)', () => {
  const { resolvePov } = loadPovMod();
  // own, computed → user-prefs supplied the delegate
  const own = resolvePov({ wotPov: 'user', userPubkey: U_KEY },
    { readUserPrefsImpl: () => USER_PREFS, loadHousePrefsImpl: () => HOUSE_PREFS });
  assertEqual(own.requestedPov, 'user', 'wotPov=user + key → requestedPov user');
  assertEqual(own.delegateSource, 'user-prefs', 'rankAuthor present → delegate came from the user prefs');
  // own requested, NOT computed → the silent house substitution branch, now visible
  const fb = resolvePov({ wotPov: 'user', userPubkey: U_KEY },
    { readUserPrefsImpl: () => ({}), loadHousePrefsImpl: () => HOUSE_PREFS });
  assertEqual(fb.requestedPov, 'user', 'still a user request');
  assertEqual(fb.delegateSource, 'house-prefs', 'no rankAuthor → house prefs supplied the delegate (the pov.js:60 fallback)');
  // house request
  const h = resolvePov({ wotPov: 'house', userPubkey: null },
    { readUserPrefsImpl: () => USER_PREFS, loadHousePrefsImpl: () => HOUSE_PREFS });
  assertEqual(h.requestedPov, 'house', 'non-user request normalizes to house');
  assertEqual(h.delegateSource, 'house-prefs', 'house prefs supplied the delegate');
  // nothing anywhere
  const none = resolvePov({ wotPov: 'house', userPubkey: null },
    { readUserPrefsImpl: () => ({}), loadHousePrefsImpl: () => ({}) });
  assertEqual(none.delegateSource, 'none', 'no delegate resolvable anywhere → none');
});

t('B6: resolvePov no-regression — the five pre-existing return fields are unchanged (AC-5)', () => {
  const { resolvePov } = loadPovMod();
  const out = resolvePov({ wotPov: 'user', userPubkey: U_KEY },
    { readUserPrefsImpl: () => USER_PREFS, loadHousePrefsImpl: () => HOUSE_PREFS });
  assertEqual(out.delegatedPubkey, U_DELEGATE, 'delegatedPubkey = user rankAuthor, as before');
  assertEqual(out.povSuffix, U_DELEGATE.slice(0, 8), 'povSuffix = delegate.slice(0,8), as before');
  assertEqual(out.minRank, 5, 'minRank from the user filters, as before');
  assertEqual(JSON.stringify(out.filters), JSON.stringify(USER_PREFS.filters), 'filters pass through, as before');
  assertEqual(JSON.stringify(out.sort), JSON.stringify(USER_PREFS.sortConfig), 'sort from sortConfig, as before');
});

/* ─────────────────────────── SOURCE-CONTRACT ─────────────────────────── */

t('S1: povStatus.js exists and exports every ADR seam (behavioral backstop)', () => {
  loadStatusMod();
});

t('S2a: the profile-tags read handlers attach povResolution (AC-4)', () => {
  const file = 'src/api/profile-tags/index.js';
  const src = readSrc(file);
  for (const fn of ['handleTagsForProfile', 'handleWotTags', 'handleProfilesTagged', 'handleTagIndex', 'handleAuthoredBy']) {
    assert(/povResolution/.test(bodyOf(src, fn, file)),
      `${fn} must attach povResolution to its response (the read itself reports its honesty)`);
  }
  assert(/resolvePovWithStatus/.test(src), 'profile-tags must resolve via resolvePovWithStatus');
});

t('S2b: the event-tags read handlers attach povResolution (AC-4)', () => {
  const file = 'src/api/event-tags/index.js';
  const src = readSrc(file);
  for (const fn of ['handleForEvent', 'handleForTag', 'handleTagIndex']) {
    assert(/povResolution/.test(bodyOf(src, fn, file)),
      `${fn} must attach povResolution to its response`);
  }
  assert(/resolvePovWithStatus/.test(src), 'event-tags must resolve via resolvePovWithStatus');
});

t('S2c: the meili search proxy attaches povResolution (TagPageSearch reads it) (AC-4)', () => {
  const src = readSrc('src/api/search/profiles/meili/index.js');
  assert(/resolvePovWithStatus/.test(src), 'the meili proxy must resolve via resolvePovWithStatus');
  assert(/povResolution/.test(src), 'the meili proxy response must carry povResolution');
});

t('S3: the for-tag response cache key is POV-aware — a cached signal can never describe another POV (AC-4)', () => {
  const src = readSrc('src/api/event-tags/index.js');
  const m = src.match(/const cacheKey = [^\n]*/);
  assert(m, 'could not locate the forTagCache cacheKey assignment');
  assert(/wotPov/.test(m[0]),
    'the for-tag cacheKey must include the normalized POV params — today it omits them, so two POVs share an entry and the cached povResolution would lie');
});

t('S4 (boundary sentinel): the TL publishers stay on bare resolvePov — not resolvePovWithStatus', () => {
  const src = readSrc('src/api/trustedList/refreshPinnedTags.js');
  assert(!/resolvePovWithStatus/.test(src),
    'refreshPinnedTags must NOT adopt resolvePovWithStatus — TLs are publishers, not read responses; their honesty channel is the partial-signal doctrine');
});

t('S5: one shared PovStatusNotice delegating to the pure povNoticeText util (AC-6)', () => {
  // Amendment 2 (2026-07-09): the wording matrix moved to the pure ui/src/utils/povNoticeText.js
  // (unit-tested in pov-notice-text.test.js, incl. the no-delegate vs no-threshold split). The
  // component is presentation only — it must delegate, render null when the util returns null, and
  // still support both variants.
  const src = readSrc('ui/src/components/PovStatusNotice.jsx');
  assert(/povNoticeText/.test(src),
    'PovStatusNotice must delegate its wording to the shared povNoticeText util (single wording source)');
  assert(/return null/.test(src), 'PovStatusNotice renders nothing when the util yields no text (AC-5)');
  assert(/variant/.test(src) && /compact/.test(src),
    'PovStatusNotice still supports the banner + compact variants');
});

t('S6: every Story-1 surface hook exposes povResolution from its own read (AC-4/AC-6)', () => {
  for (const f of ['ui/src/hooks/useEventTags.js', 'ui/src/hooks/useTagIndex.js', 'ui/src/hooks/useTagDetail.js',
    'ui/src/hooks/useProfileTags.js', 'ui/src/hooks/useAuthoredTagging.js', 'ui/src/components/TagPageSearch.jsx']) {
    assert(/povResolution/.test(readSrc(f)),
      `${f.split('/').pop()} must expose povResolution from its own response (per-read honesty, not a separate status fetch)`);
  }
});

t('S7: the six surfaces render the shared PovStatusNotice (AC-6)', () => {
  for (const f of ['ui/src/pages/Tags.jsx', 'ui/src/pages/Tag.jsx', 'ui/src/components/AuthoredTaggingSection.jsx',
    'ui/src/components/ProfileTagsSection.jsx', 'ui/src/components/NoteTags.jsx', 'ui/src/components/TagPageSearch.jsx']) {
    assert(/PovStatusNotice/.test(readSrc(f)),
      `${f.split('/').pop()} must render PovStatusNotice — one component, one wording source, every surface`);
  }
});

t('S8 (boundary sentinel): BrainstormSearch does NOT adopt PovStatusNotice — search UX untouched', () => {
  assert(!/PovStatusNotice/.test(readSrc('ui/src/pages/BrainstormSearch.jsx')),
    'search keeps its own readiness UX (out of scope) — the new notice must not leak into it');
});

t('S9 (gate amendment): useNotesForTag + usePinnedNotes thread the selected POV (Story-1 completeness)', () => {
  for (const f of ['ui/src/hooks/useNotesForTag.js', 'ui/src/hooks/usePinnedNotes.js']) {
    const src = readSrc(f);
    assert(/\busePov\s*\(/.test(src), `${f.split('/').pop()} must consume the shared selection via a usePov() call`);
    assert(/povParams/.test(src), `${f.split('/').pop()} must thread povParams into its for-tag read (the tag page's notes must not stay house-only)`);
  }
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- pov-resolution-status tests (Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\npov-resolution-status: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
