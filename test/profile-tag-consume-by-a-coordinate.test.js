/**
 * Tests for profile-tag-hardening Story 1 — consume profile-tags by the stable a-coordinate.
 *
 * Story: engineering-team/stories/profile-tag-hardening/1-consume-by-a-coordinate.md
 * ADR:   engineering-team/decisions/profile-tag-hardening/0001-consume-profile-tags-by-a-coordinate.md
 *
 * Intentionally failing until the consume-by-#a doctrine lands. Hand-rolled in the project's
 * existing test style — no new framework.
 *
 * TEST LEVELS (same three-tier shape as tag-read-union.test.js + the *-ui suites):
 *   - BEHAVIORAL-UNIT: the NEW pure canonicalization rule — `tagCoordinate` (build a coordinate)
 *     and `assertionTagCoordinate` (resolve an assertion to its canonical tag coordinate via #a,
 *     falling back to #e) — plus the already-exported `dedupeReplaceable`. This proves
 *     version-spanning, legacy fallback, and no-double-count deterministically, with hand-built
 *     events and NO strfry. The rule is duplicated across three read sites AND mirrored in the UI
 *     grouping, so it must be exported "for tests" (same convention as federatedScan/dedupeReplaceable).
 *   - SOURCE-CONTRACT: the load-bearing wiring at the four named #e-scan sites (which union #a,
 *     which stays #e-only) and the two response-shape additions. Same idiom as tag-read-union.
 *   - MANUAL: replaced-tag end-to-end (name renders, TL spans versions) — in the test plan's
 *     browser checklist, run on the local stack (source can't prove a live render).
 *
 * The read handlers exec the strfry binary (absent on host), so behavior is proven via the exported
 * pure helpers, never the real binary.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SRC = 'src/api/profile-tags/index.js';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }
function bodyOf(src, fnName) {
  const m = src.match(new RegExp(`async function ${fnName}[\\s\\S]*?\\n\\}`))
    || src.match(new RegExp(`function ${fnName}[\\s\\S]*?\\n\\}`));
  assert(m, `could not locate function ${fnName} in ${SRC}`);
  return m[0];
}

let mod = null;
function loadMod() {
  if (mod) return mod;
  mod = require('../src/api/profile-tags/index.js');
  return mod;
}

// A kind-39999 nostr-user-tag ASSERTION event. `aCoord` (optional) → an ["a", coord] tag (hybrid /
// new); `eId` (optional) → an ["e", eId] tag (provenance / legacy). d-tag is the stable assertion id.
function assertionEv({ id, pubkey = 'asserter1', dTag = 'profile-tag-funny-target01-assert01', createdAt = 100, aCoord, eId, target = 'targetPk' }) {
  const tags = [['d', dTag], ['z', '39998:TA:nostr-user-tag'], ['p', target], ['polarity', '1']];
  if (aCoord) tags.push(['a', aCoord]);
  if (eId) tags.push(['e', eId]);
  return { id, kind: 39999, pubkey, created_at: createdAt, tags };
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─────────────────────────── BEHAVIORAL-UNIT ─────────────────────────── */

t('B4: tagCoordinate builds the stable 39999:<author>:<slug> coordinate', () => {
  const m = loadMod();
  assert(typeof m.tagCoordinate === 'function',
    'tagCoordinate must be exported (the shared coordinate builder — used by every changed read site)');
  assertEqual(m.tagCoordinate({ authorPubkey: 'AUTH', slug: 'funny' }), '39999:AUTH:funny',
    'coordinate = 39999:<authorPubkey>:<slug>');
});

t('B1: an assertion resolves to its tag by a-coordinate — spanning tag-element versions (AC-1/AC-2/AC-5)', () => {
  const m = loadMod();
  assert(typeof m.assertionTagCoordinate === 'function',
    'assertionTagCoordinate must be exported (the canonicalization rule shared by the reads + the UI mirror)');
  const coord = '39999:AUTH:funny';
  // Same (author, slug) tag, two DIFFERENT applied-version event-ids, both carrying the shared `a`.
  const onOldVersion = assertionEv({ id: 'a1', dTag: 'd-a1', aCoord: coord, eId: 'tag-evt-OLD' });
  const onNewVersion = assertionEv({ id: 'a2', dTag: 'd-a2', aCoord: coord, eId: 'tag-evt-NEW' });
  // tagById only knows the CURRENT version — the old one has been replaced out of strfry.
  const tagById = new Map([['tag-evt-NEW', { authorPubkey: 'AUTH', slug: 'funny' }]]);
  assertEqual(m.assertionTagCoordinate(onOldVersion, { tagById }), coord,
    'an assertion frozen on a PRIOR event-id still resolves — by its a-coordinate — even though the id is gone');
  assertEqual(m.assertionTagCoordinate(onNewVersion, { tagById }), coord,
    'an assertion on the current version resolves to the same coordinate → the two collapse onto one tag');
});

t('B2: a legacy e-only assertion (no a tag) still resolves via #e → coordinate (AC-3)', () => {
  const m = loadMod();
  const legacy = assertionEv({ id: 'a3', dTag: 'd-a3', eId: 'tag-evt-NEW' }); // NO aCoord
  const tagById = new Map([['tag-evt-NEW', { authorPubkey: 'AUTH', slug: 'funny' }]]);
  assertEqual(m.assertionTagCoordinate(legacy, { tagById }), '39999:AUTH:funny',
    'a pre-hybrid assertion carrying only `e` must resolve exactly as today — the #a path unions, never replaces');
});

t('B3: an assertion present in BOTH scan legs collapses to one — counts cannot double (AC-4)', () => {
  const m = loadMod();
  assert(typeof m.dedupeReplaceable === 'function', 'dedupeReplaceable must be exported');
  // A hybrid assertion carries a matching `a` AND a matching `e`, so it is returned by the #a leg
  // (byA) AND the #e leg (byE). Concatenating and deduping must yield ONE — the ADR union invariant.
  const inA = assertionEv({ id: 'dupA', dTag: 'd-dup', createdAt: 150, aCoord: '39999:AUTH:funny', eId: 'tag-evt-NEW' });
  const inE = assertionEv({ id: 'dupE', dTag: 'd-dup', createdAt: 150, aCoord: '39999:AUTH:funny', eId: 'tag-evt-NEW' });
  const out = m.dedupeReplaceable([inA, inE]);
  assertEqual(out.length, 1, 'the same assertion (same author|d-tag) in both legs must collapse to one — no double count');
});

t('B5: an assertion resolvable by neither a nor a known e yields null (superset fallback, no throw) (AC-4)', () => {
  const m = loadMod();
  const orphan = assertionEv({ id: 'a4', dTag: 'd-a4', eId: 'unknown-evt' }); // no a, e not in tagById
  const tagById = new Map([['tag-evt-NEW', { authorPubkey: 'AUTH', slug: 'funny' }]]);
  assertEqual(m.assertionTagCoordinate(orphan, { tagById }), null,
    'an unresolvable assertion returns null so the UI falls back to the existing truncated-id render — unchanged behavior');
});

/* ─────────────────────────── SOURCE-CONTRACT ─────────────────────────── */

t('S1: aggregateProfilesTagged unions #a (spans versions) and keeps federatedScan (AC-2, required)', () => {
  const src = readSrc(SRC);
  const body = bodyOf(src, 'aggregateProfilesTagged');
  assert(/'#a'|"#a"/.test(body),
    'aggregateProfilesTagged must scan #a (union of versions) — this is what makes the kind-30392 pubkey TL span tag-element versions (AC-2)');
  assert(/'#e'|"#e"/.test(body),
    'aggregateProfilesTagged must retain the #e leg (legacy provenance — union, never replace)');
  assert(/federatedScan\s*\(/.test(body),
    'aggregateProfilesTagged stays on federatedScan — it is a browse/visibility surface (remote leg must stay)');
});

t('S2: computeTagMatches unions #a but stays LOCAL — SEARCH-IS-LOCAL preserved (AC-3)', () => {
  const src = readSrc(SRC);
  const body = bodyOf(src, 'computeTagMatches');
  assert(/'#a'|"#a"/.test(body),
    'computeTagMatches must union #a so search results span tag-element versions too');
  assert(/'#e'|"#e"/.test(body),
    'computeTagMatches must retain the #e leg (legacy provenance)');
  assert(/strfryScan\s*\(/.test(body),
    'computeTagMatches must keep scanning via strfryScan (search-is-local)');
  assert(!/federatedScan\s*\(/.test(body),
    'computeTagMatches must NOT federate — the SEARCH-IS-LOCAL boundary from tag-read-union must survive the #a union');
});

t('S3: handleAuthoredBy parent scan unions #a (authored-by counts span versions) (AC-5)', () => {
  const src = readSrc(SRC);
  const body = bodyOf(src, 'handleAuthoredBy');
  assert(/'#a'|"#a"/.test(body),
    'handleAuthoredBy must union #a on its parent-tag scan so parent/peer counts span tag-element versions');
  assert(/'#e'|"#e"/.test(body),
    'handleAuthoredBy must retain the #e leg (legacy provenance)');
});

t('S4 (boundary, regression sentinel): handleTagById stays #e-only — the viewer-pin check is per-version', () => {
  const src = readSrc(SRC);
  const body = bodyOf(src, 'handleTagById');
  assert(!/'#a'|"#a"/.test(body),
    'handleTagById must NOT gain an #a scan — its viewerPin means "did the viewer pin THIS version"; ' +
    'version-specificity is correct here (ADR site 3 KEEP #e). Pin cross-version is a separate follow-up.');
});

t('S5a: handleTagsForProfile exposes tagAddress on each entry (the a-coordinate join key) (AC-1/AC-5)', () => {
  const src = readSrc(SRC);
  const body = bodyOf(src, 'handleTagsForProfile');
  assert(/tagAddress/.test(body),
    'handleTagsForProfile must add tagAddress (the assertion\'s own `a` value) so the UI can group by coordinate');
});

t('S5b: handleAvailableTags exposes tagAddress on each tag (explicit coordinate join key) (AC-5)', () => {
  const src = readSrc(SRC);
  const body = bodyOf(src, 'handleAvailableTags');
  assert(/tagAddress/.test(body),
    'handleAvailableTags must add tagAddress = 39999:<author>:<slug> as the unambiguous join key');
});

t('S6a: ProfileTagsSection.jsx groups profile tags by coordinate (references tagAddress) (AC-5)', () => {
  const src = readSrc('ui/src/components/ProfileTagsSection.jsx');
  assert(/tagAddress/.test(src),
    'ProfileTagsSection must group applications/disputes by tag coordinate (tagAddress) so two event-ids ' +
    'of the same tag collapse onto one chip — not by the fragile tagEventId');
});

t('S6b: AddTagDialog.jsx joins already-applied by coordinate (references tagAddress) (AC-5)', () => {
  const src = readSrc('ui/src/components/AddTagDialog.jsx');
  assert(/tagAddress/.test(src),
    'AddTagDialog must test already-applied membership by coordinate (tagAddress) so a tag applied through a ' +
    'prior version is correctly shown as already-applied');
});

t('S7: EVERY AddTagDialog consumer passes appliedTagKeys — the shared prop rename is complete (regression)', () => {
  // AddTagDialog is SHARED by the profile stack (ProfileTagsSection) AND the note/event-tag
  // stack (NoteTags). Renaming its prop and updating only one caller leaves the other passing
  // the old name → appliedTagKeys is undefined → `undefined.has(...)` crashes the dialog on mount.
  for (const f of ['ui/src/components/ProfileTagsSection.jsx', 'ui/src/components/NoteTags.jsx']) {
    const src = readSrc(f);
    assert(/appliedTagKeys=\{/.test(src),
      `${f} must pass appliedTagKeys to AddTagDialog (shared-prop contract)`);
    assert(!/appliedTagEventIds=\{/.test(src),
      `${f} must NOT pass the removed appliedTagEventIds prop to AddTagDialog`);
  }
});

t('S7b: AddTagDialog guards a missing appliedTagKeys so an omitting caller cannot crash it on mount', () => {
  const src = readSrc('ui/src/components/AddTagDialog.jsx');
  // The membership check must not call .has directly on the raw prop.
  assert(!/appliedTagKeys\.has\s*\(/.test(src),
    'AddTagDialog must not call appliedTagKeys.has(...) directly — default the prop (e.g. `|| new Set()`) ' +
    'so a caller that omits it cannot throw a TypeError on mount');
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- profile-tag consume-by-#a tests (epic profile-tag-hardening, Story 1) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nprofile-tag-consume-by-a-coordinate: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
