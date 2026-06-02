/**
 * Story #30: profile "Website" link broken for scheme-less URLs.
 * See engineering-team/stories/30-profile-website-link-scheme.test-plan.md
 *
 * Bug: ui/src/pages/BrainstormProfile.jsx and ui/src/pages/users/UserDetail.jsx
 * render `<a href={profile.website}>` from the RAW kind-0 website value, so a
 * scheme-less value (e.g. "kate-cate.com") is treated by the browser as a path
 * relative to the current /user/<pk> page → it navigates in-app instead of to
 * the external site.
 *
 * Fix contract (Architecture skipped — obvious bug; the Tester pins this minimal
 * structure because the two views need identical logic and a pure helper is the
 * cleanly-testable form): a PURE, node-importable ESM module
 *   ui/src/utils/url.js  (joining the existing ui/src/utils/* convention)
 * exporting `toExternalUrl(value)` that:
 *   - prepends "https://" when the value has no http(s):// scheme,
 *   - leaves already-absolute http(s) URLs unchanged,
 *   - returns a falsy value for empty input.
 * Both clickable-link views build their website href via that helper.
 *
 * The helper must stay pure (no React/DOM imports) so this unit test can import it.
 *
 * T* fail pre-fix and pass post-fix. R* are regression sentinels (pass before AND after).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const URL_HELPER   = path.resolve(__dirname, '../ui/src/utils/url.js');
const PROFILE_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const USERDETAIL   = path.resolve(__dirname, '../ui/src/pages/users/UserDetail.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// ---------------------------------------------------------------------------
// T1 — the normalization helper's behavior (the heart of the fix)
// ---------------------------------------------------------------------------
test('T1: ui/src/utils/url.js exports toExternalUrl(value) — prepends https:// for scheme-less values, leaves absolute URLs unchanged', async () => {
  let mod;
  try {
    mod = await import(pathToFileURL(URL_HELPER).href);
  } catch (e) {
    throw new Error('ui/src/utils/url.js does not exist or failed to import (' + e.message +
      '). Create a PURE module (no React/DOM imports) exporting `toExternalUrl(value)`.');
  }
  const fn = mod.toExternalUrl || (mod.default && mod.default.toExternalUrl);
  assert(typeof fn === 'function', 'ui/src/utils/url.js must export `toExternalUrl` (a function).');

  const cases = [
    ['kate-cate.com',          'https://kate-cate.com'],          // the reported bug
    ['www.kate-cate.com',      'https://www.kate-cate.com'],      // bare host with www
    ['example.com/path?q=1',   'https://example.com/path?q=1'],   // path + query preserved
    ['https://example.com/foo','https://example.com/foo'],        // already absolute (https)
    ['http://example.com',     'http://example.com'],             // already absolute (http) — unchanged
    ['HTTPS://Example.com',    'HTTPS://Example.com'],            // scheme detection is case-insensitive
  ];
  for (const [input, expected] of cases) {
    const got = fn(input);
    assert(got === expected,
      `toExternalUrl(${JSON.stringify(input)}) → expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
  assert(!fn(''), "toExternalUrl('') must be falsy (an empty website yields no link).");
});

// ---------------------------------------------------------------------------
// T2/T3 — both clickable-link views use the helper, not the raw value
// ---------------------------------------------------------------------------
test('T2: BrainstormProfile.jsx builds the website href via toExternalUrl (no raw href={profile.website})', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(!/href=\{\s*profile\.website\s*\}/.test(src),
    'BrainstormProfile.jsx must NOT pass the raw `profile.website` to the link href — a scheme-less value resolves relative to /user/<pk>. Normalize it with toExternalUrl.');
  assert(/toExternalUrl/.test(src),
    'BrainstormProfile.jsx must build the website href via toExternalUrl(profile.website).');
});

test('T3: users/UserDetail.jsx builds the website href via toExternalUrl (no raw href={profile.website})', () => {
  const src = safeRead(USERDETAIL);
  assert(src.length > 0, 'UserDetail.jsx missing — unexpected.');
  assert(!/href=\{\s*profile\.website\s*\}/.test(src),
    'UserDetail.jsx (makeshift /tapestry/users page) must NOT pass the raw `profile.website` to the link href. Normalize it with toExternalUrl.');
  assert(/toExternalUrl/.test(src),
    'UserDetail.jsx must build the website href via toExternalUrl(profile.website).');
});

// ---------------------------------------------------------------------------
// R1/R2 — sentinels (must PASS before AND after the fix)
// ---------------------------------------------------------------------------
test('R1: both views keep the website link safe — target="_blank" + rel="noopener noreferrer"', () => {
  for (const [name, p] of [['BrainstormProfile.jsx', PROFILE_PAGE], ['UserDetail.jsx', USERDETAIL]]) {
    const src = safeRead(p);
    assert(src.length > 0, name + ' missing — unexpected.');
    assert(/target="_blank"/.test(src) && /rel="noopener noreferrer"/.test(src),
      name + ' must keep target="_blank" + rel="noopener noreferrer" on the website link (AC: new tab + safe rel).');
  }
});

test('R2: BrainstormProfile.jsx still scheme-strips the website DISPLAY text (AC: primary-profile display unchanged)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/profile\.website\.replace\([\s\S]{0,12}https\?/.test(src),
    'BrainstormProfile.jsx must keep stripping the scheme from the DISPLAYED website text (profile.website.replace(/^https?:.../)). The fix changes the href, not the display.');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
