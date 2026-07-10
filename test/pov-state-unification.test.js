/**
 * Tests for pov-selectable-tag-surfaces Story 4 — unify POV selection state.
 *
 * Story: engineering-team/stories/pov-selectable-tag-surfaces/4-unify-pov-selection-state.md
 *
 * Root cause: three uncoordinated POV writers (search converged; settings + global menu did NOT) +
 * a PovContext mount-time persist that clobbers the saved value with the default before the load
 * resolves. Fix: single-writer PovContext (hydration guard) + converge settings/menu onto usePov()
 * + a global-menu switcher.
 *
 * SOURCE-CONTRACT (React effect/state behavior — the Node harness can't render): the persist guard
 * exists; the other two controls delegate to usePov() and drop their own pov state.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('S1 (the clobber fix): PovContext guards its persist effect with a hydration ref so the default is not written on mount', () => {
  const src = readSrc('ui/src/context/PovContext.jsx');
  assert(/useRef/.test(src),
    'PovContext must use a ref to track hydration (so persist can be skipped until the saved value is loaded)');
  // The persist effect must early-return until hydrated — guard on the ref's .current.
  const persist = src.slice(src.indexOf('Persist'));
  assert(/hydrat|loaded|\.current\s*\)/i.test(persist),
    'the persist effect must be gated on the hydration ref (return early until loaded) — otherwise the ' +
    'default nosfabrica is PUT over a saved pov:user on mount (the live-repro clobber)');
});

t('S2 (single writer): only PovContext persists the pov selection to /api/user-prefs', () => {
  // The settings + menu must delegate — they must NOT keep their own local pov useState default.
  for (const f of ['ui/src/pages/BrainstormSettings.jsx', 'ui/src/components/BrainstormUserMenu.jsx']) {
    const src = readSrc(f);
    assert(!/useState\(\s*['"]nosfabrica['"]\s*\)/.test(src),
      `${f.split('/').pop()} must NOT own a local pov useState('nosfabrica') — it must consume the shared ` +
      'selection via usePov() (a second writer is what caused the clobber/inconsistency)');
  }
});

t('S3: BrainstormSettings drives the shared selection via usePov()', () => {
  const src = readSrc('ui/src/pages/BrainstormSettings.jsx');
  assert(/\busePov\s*\(/.test(src),
    'BrainstormSettings must consume usePov() so its Point-of-View toggle writes the one shared selection');
});

t('S4: BrainstormUserMenu consumes usePov() and can CHANGE the POV (not just display it)', () => {
  const src = readSrc('ui/src/components/BrainstormUserMenu.jsx');
  assert(/\busePov\s*\(/.test(src),
    'BrainstormUserMenu must consume usePov() (converge onto the shared selection)');
  assert(/setSelectedPov/.test(src),
    'BrainstormUserMenu must call setSelectedPov — it is a SWITCHER now, not a read-only indicator');
});

t('S5 (no regression): BrainstormSearch still consumes usePov() as the shared selection', () => {
  const src = readSrc('ui/src/pages/BrainstormSearch.jsx');
  assert(/\busePov\s*\(/.test(src),
    'BrainstormSearch must keep sourcing the selection from usePov() (Story 1 convergence preserved)');
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- pov-state-unification tests (Story 4) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\npov-state-unification: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { run };
