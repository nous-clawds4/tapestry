/**
 * Tests for pov-selectable-tag-surfaces Story 2 — Amendment 2 (unfiltered wording split).
 *
 * Story: engineering-team/stories/pov-selectable-tag-surfaces/2-honest-state-for-unprovisioned-pov.md (AC "Unfiltered wording distinguishes…")
 * ADR:   engineering-team/decisions/pov-selectable-tag-surfaces/0002-per-read-pov-resolution-status.md (Amendment 2)
 *
 * The disclosure wording must distinguish "no delegate resolved" (no POV configured) from
 * "a delegate resolved but no rank threshold is set" (POV configured, filtering off) — the two
 * are distinguishable from povResolution.povSuffix. The wording lives in a pure util so it's testable
 * (dynamic-import the plain .js — the Node harness can't parse the .jsx).
 *
 * Intentionally failing until ui/src/utils/povNoticeText.js exists + PovStatusNotice delegates to it.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.join(__dirname, '..');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }

async function loadNoticeText() {
  const url = pathToFileURL(path.join(REPO_ROOT, 'ui/src/utils/povNoticeText.js')).href;
  const mod = await import(url);
  assert(typeof mod.povNoticeText === 'function',
    'ui/src/utils/povNoticeText.js must export povNoticeText (the pure wording rule)');
  return mod.povNoticeText;
}
// Convenience: return the full sentence for a status (or null).
async function fullOf(status) {
  const fn = await loadNoticeText();
  const out = fn(status);
  return out ? out.full : null;
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('N1: no status → null (nothing to disclose)', async () => {
  assert((await fullOf(null)) === null, 'null status must yield no notice');
});

t('N2: healthy filtered POV → null (no banner for provisioned POVs)', async () => {
  assert((await fullOf({ mode: 'filtered', fellBackToHouse: false, povSuffix: 'abcd1234' })) === null,
    'a filtered, non-fallback POV must render nothing');
});

t('N3: filtered + fellBackToHouse → discloses the house fallback', async () => {
  const full = await fullOf({ mode: 'filtered', fellBackToHouse: true, povSuffix: 'cccccccc' });
  assert(full && /house/i.test(full), 'a fell-back-but-filtered read must say it is showing the house POV');
});

t('N4: unfiltered, NO delegate → "no point of view configured" (the honest no-POV case)', async () => {
  const full = await fullOf({ mode: 'unfiltered', fellBackToHouse: false, povSuffix: null });
  assert(full && /no point of view configured/i.test(full),
    'unfiltered with no resolved delegate must say the instance has no point of view configured');
  assert(!/threshold/i.test(full),
    'the no-delegate message must NOT talk about a threshold (there is no POV at all here)');
});

t('N5: unfiltered, delegate PRESENT but no threshold → "no trust threshold" (the split; the operator bug)', async () => {
  const full = await fullOf({ mode: 'unfiltered', fellBackToHouse: false, povSuffix: '34a42fb9' });
  assert(full && /threshold/i.test(full),
    'unfiltered WITH a resolved delegate must disclose that no trust THRESHOLD is set (the POV exists)');
  assert(!/no point of view configured/i.test(full),
    'it must NOT claim "no point of view configured" — a delegate resolved (this was the live-repro bug)');
});

t('N6: not-computed → distinguishes "not computed" from empty', async () => {
  const full = await fullOf({ mode: 'not-computed', fellBackToHouse: false, povSuffix: '34a42fb9' });
  assert(full && /comput/i.test(full), 'not-computed must mention computed scores (≠ genuinely empty)');
});

t('N7: every non-null notice also carries a short compact label', async () => {
  const fn = await loadNoticeText();
  for (const status of [
    { mode: 'unfiltered', fellBackToHouse: false, povSuffix: null },
    { mode: 'unfiltered', fellBackToHouse: false, povSuffix: '34a42fb9' },
    { mode: 'not-computed', fellBackToHouse: false, povSuffix: '34a42fb9' },
    { mode: 'filtered', fellBackToHouse: true, povSuffix: 'cccccccc' },
  ]) {
    const out = fn(status);
    assert(out && typeof out.short === 'string' && out.short.length > 0,
      `a disclosed status must carry a non-empty short label; got ${JSON.stringify(out)} for ${JSON.stringify(status)}`);
  }
});

t('S1: PovStatusNotice delegates its wording to the pure povNoticeText util', () => {
  const src = readSrc('ui/src/components/PovStatusNotice.jsx');
  assert(/povNoticeText/.test(src),
    'PovStatusNotice must import + use povNoticeText (single wording source; the .jsx keeps only presentation)');
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- pov-notice-text tests (Story 2 amendment 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\npov-notice-text: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { run };
