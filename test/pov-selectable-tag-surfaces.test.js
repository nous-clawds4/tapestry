/**
 * Tests for pov-selectable-tag-surfaces Story 1 — tag surfaces honor the selected POV.
 *
 * Story: engineering-team/stories/pov-selectable-tag-surfaces/1-honor-selected-pov-on-tag-surfaces.md
 * ADR:   engineering-team/decisions/pov-selectable-tag-surfaces/0001-shared-selected-pov-resolver-for-tag-surfaces.md
 *
 * Intentionally failing until the shared selected-POV resolver lands. Hand-rolled in the project's
 * existing test style — no new framework.
 *
 * TEST LEVELS:
 *   - BEHAVIORAL-UNIT (the crux): the ADR names `resolvePovReadParams` (ui/src/utils/povReadParams.js)
 *     the test seam. It is a dependency-free pure ESM util, so we dynamic-`import()` it (the CJS runner
 *     can't `require()` ESM, but `import()` works — verified) and assert its branch table directly.
 *   - SOURCE-CONTRACT: the convergence + anti-regression wiring — one PovContext source, every tag
 *     surface consumes `povParams`, the login-binary literal is gone, search converges, provider at root.
 *   - MANUAL: switch-POV-updates-view + the logged-in own≠house proof — in the test plan's browser
 *     checklist (runtime the source can't prove).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.join(__dirname, '..');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }
function exists(rel) { return fs.existsSync(path.join(REPO_ROOT, rel)); }

// A valid 64-char lowercase-hex pubkey (the harness's known-active key).
const HEX = '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9';

// Dynamic-import the pure ESM util (under ui/, which is "type":"module").
async function loadResolver() {
  const url = pathToFileURL(path.join(REPO_ROOT, 'ui/src/utils/povReadParams.js')).href;
  const mod = await import(url);
  assert(typeof mod.resolvePovReadParams === 'function',
    'ui/src/utils/povReadParams.js must export resolvePovReadParams (the ADR test seam)');
  return mod.resolvePovReadParams;
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─────────────────────────── BEHAVIORAL-UNIT (pure util) ─────────────────────────── */

t('B1: own — {pov:user, userPubkey:hex} → {wotPov:user, userPubkey} (AC-2)', async () => {
  const resolve = await loadResolver();
  const out = resolve({ pov: 'user', userPubkey: HEX });
  assertEqual(out.wotPov, 'user', 'a user selection with a valid viewer key resolves to wotPov=user');
  assertEqual(out.userPubkey, HEX, 'the viewer key is passed through for the own POV');
});

t('B2: named suppressed to house — {pov:nosfabrica, userPubkey:hex} → {wotPov:house} (AC-1 core)', async () => {
  const resolve = await loadResolver();
  const out = resolve({ pov: 'nosfabrica', userPubkey: HEX });
  assertEqual(out.wotPov, 'house',
    'a NAMED selection must resolve to house even with a viewer key present — NOT substitute "own" ' +
    '(this is exactly why selecting nosfabrica while logged in no longer shows the user\'s own POV)');
});

t('B3: house — {pov:house, userPubkey:hex} → {wotPov:house} (AC-3)', async () => {
  const resolve = await loadResolver();
  assertEqual(resolve({ pov: 'house', userPubkey: HEX }).wotPov, 'house', 'house selection → wotPov=house');
});

t('B4: own impossible without a viewer key — {pov:user} → {wotPov:house} (AC-3 logged-out)', async () => {
  const resolve = await loadResolver();
  assertEqual(resolve({ pov: 'user' }).wotPov, 'house',
    'a user selection with no viewer key (logged out) must fall back to house');
});

t('B5: malformed viewer key cannot force user — {pov:user, userPubkey:not-hex} → {wotPov:house}', async () => {
  const resolve = await loadResolver();
  assertEqual(resolve({ pov: 'user', userPubkey: 'not-a-real-pubkey' }).wotPov, 'house',
    'an invalid (non-64-hex) userPubkey must not resolve to wotPov=user');
});

t('B6: house/named never leak a userPubkey (AC-1 hygiene)', async () => {
  const resolve = await loadResolver();
  for (const input of [
    { pov: 'nosfabrica', userPubkey: HEX },
    { pov: 'house', userPubkey: HEX },
    { pov: 'user' },
    { pov: 'user', userPubkey: 'bad' },
  ]) {
    const out = resolve(input);
    assert(!('userPubkey' in out) || out.userPubkey === undefined,
      `house/named resolution must not carry a userPubkey; got ${JSON.stringify(out)} for ${JSON.stringify(input)}`);
  }
});

/* ─────────────────────────── SOURCE-CONTRACT (convergence) ─────────────────────────── */

const TAG_SURFACES = [
  'ui/src/hooks/useEventTags.js',
  'ui/src/hooks/useTagIndex.js',
  'ui/src/hooks/useTagDetail.js',
  'ui/src/hooks/useAuthoredTagging.js',
  'ui/src/hooks/useProfileTags.js',
  'ui/src/components/TagPageSearch.jsx',
];
// The five that today thread a login-binary POV (useEventTags threads none).
const LOGIN_BINARY_SURFACES = TAG_SURFACES.filter((f) => !f.endsWith('useEventTags.js'));

t('S1: a single PovContext holds the selection and derives povParams via the util (AC-5)', () => {
  assert(exists('ui/src/context/PovContext.jsx'), 'ui/src/context/PovContext.jsx must exist (single source of the selection)');
  const src = readSrc('ui/src/context/PovContext.jsx');
  assert(/export\s+(function\s+)?PovProvider|PovProvider\s*[=:]/.test(src) && /export/.test(src) && /PovProvider/.test(src),
    'PovContext must export a PovProvider');
  assert(/\busePov\b/.test(src), 'PovContext must export a usePov hook');
  assert(/resolvePovReadParams/.test(src),
    'PovContext must derive povParams via resolvePovReadParams (one rule, not a re-implementation)');
});

t('S4: the pure resolver util exists and exports resolvePovReadParams (behavioral backstop)', () => {
  assert(exists('ui/src/utils/povReadParams.js'), 'ui/src/utils/povReadParams.js must exist');
  assert(/export\s+(function\s+)?resolvePovReadParams|resolvePovReadParams\s*[=]/.test(readSrc('ui/src/utils/povReadParams.js')),
    'povReadParams.js must export resolvePovReadParams');
});

for (const f of TAG_SURFACES) {
  const short = f.split('/').pop();
  t(`S2 (${short}): consumes the shared selected-POV params (usePov + povParams) (AC-4)`, () => {
    const src = readSrc(f);
    assert(/\busePov\s*\(/.test(src), `${short} must consume the shared selection via a usePov() call`);
    assert(/povParams/.test(src), `${short} must thread povParams into its read (so the selected POV governs it)`);
  });
}

t('S3: the login-binary POV literal is removed from the five surfaces that had it (anti-regression, AC-1)', () => {
  const LOGIN_BINARY = /['"]wotPov['"]\s*,\s*['"]user['"]/; // e.g. params.set('wotPov', 'user')
  for (const f of LOGIN_BINARY_SURFACES) {
    const src = readSrc(f);
    assert(!LOGIN_BINARY.test(src),
      `${f.split('/').pop()} must no longer hardcode wotPov='user' behind a login check — the POV value ` +
      `now comes from povParams (else a logged-in user is forced to "own", ignoring the menu selection)`);
  }
});

t('S5: search converges onto the same PovContext value + util (AC-5)', () => {
  const src = readSrc('ui/src/pages/BrainstormSearch.jsx');
  assert(/\busePov\s*\(/.test(src), 'BrainstormSearch must source the selection from a usePov() call (shared value)');
  assert(/resolvePovReadParams/.test(src),
    'BrainstormSearch must resolve its read params via the shared resolvePovReadParams (shared rule)');
  assert(!/useState\(\s*['"]nosfabrica['"]\s*\)/.test(src),
    'BrainstormSearch must no longer own the pov via local useState(\'nosfabrica\') — the value lives in PovContext');
});

t('S6: PovProvider is mounted at the app root so every route shares one selection (AC-4/AC-5)', () => {
  const src = readSrc('ui/src/main.jsx');
  assert(/PovProvider/.test(src),
    'ui/src/main.jsx must mount <PovProvider> (inside AuthProvider) so search AND the tag pages share the selection');
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- pov-selectable-tag-surfaces tests (Story 1) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\npov-selectable-tag-surfaces: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
