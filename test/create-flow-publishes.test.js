/**
 * Story #11: Create flow publishes a new community (Slice 5).
 *
 * Pure-function tests for slugify + source-regex tests against
 * Create.jsx's orchestration changes. Re-uses the source-regex
 * pattern established by Slice 3 (#9) + Slice 4 (#10) for
 * ESM-source verification without paying ESM/CJS interop cost.
 *
 * Live publish + manual mock-mode verification are documented in
 * the test plan §"How to run".
 *
 * See engineering-team/stories/11-create-flow-publishes.test-plan.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UC = path.join(ROOT, 'ui-communities');

const SLUG_JS = path.join(UC, 'src/lib/slug.js');
const CREATE_JSX = path.join(UC, 'src/pages/Create.jsx');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (err) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${err.message}`); }
}

/* ────────────────────────────────────────────────────────────
 * T1–T5 — slug.js pure function
 *
 * src/lib/slug.js is a small ESM module exporting `slugify`.
 * We can't `require()` an `export function` directly from CJS, so
 * we extract the function body via regex + eval into a CJS context.
 * Cheap, isolated, and avoids paying for a build step in tests.
 * ──────────────────────────────────────────────────────────── */

function loadSlugify() {
  const src = read(SLUG_JS);
  // Find the function body. Match: export function slugify(name) { ... }
  // Capture the parameter list + body for evaluation.
  const m = src.match(/export\s+function\s+slugify\s*\(([^)]*)\)\s*\{([\s\S]*?)^\}/m);
  if (!m) {
    throw new Error('slug.js must export `function slugify(name) { ... }`');
  }
  // eslint-disable-next-line no-new-func
  return new Function(m[1], m[2]);
}

test('T1: slugify("Sunset Hikers") === "sunset-hikers"', () => {
  const slugify = loadSlugify();
  assert(slugify('Sunset Hikers') === 'sunset-hikers',
    `expected "sunset-hikers"; got "${slugify('Sunset Hikers')}"`);
});

test('T2: slugify("Code & Coffee") === "code-coffee"', () => {
  const slugify = loadSlugify();
  assert(slugify('Code & Coffee') === 'code-coffee',
    `expected "code-coffee"; got "${slugify('Code & Coffee')}"`);
});

test('T3: slugify("  The Listening Room!  ") === "the-listening-room"', () => {
  const slugify = loadSlugify();
  assert(slugify('  The Listening Room!  ') === 'the-listening-room',
    `expected "the-listening-room"; got "${slugify('  The Listening Room!  ')}"`);
});

test('T4: slugify("!!!") === "" (empty-result edge)', () => {
  const slugify = loadSlugify();
  assert(slugify('!!!') === '',
    `expected ""; got "${slugify('!!!')}"`);
});

test('T5: slugify(null) and slugify(undefined) return "" without throwing', () => {
  const slugify = loadSlugify();
  assert(slugify(null) === '',
    `slugify(null) must return "" (got "${slugify(null)}")`);
  assert(slugify(undefined) === '',
    `slugify(undefined) must return "" (got "${slugify(undefined)}")`);
});

/* ────────────────────────────────────────────────────────────
 * T6–T13 — Create.jsx source-regex
 * ──────────────────────────────────────────────────────────── */

test('T6: Create.jsx imports slugify from ../lib/slug.js', () => {
  const src = read(CREATE_JSX);
  assert(/import\s+\{[^}]*\bslugify\b[^}]*\}\s+from\s+['"]\.\.\/lib\/slug(?:\.js)?['"]/.test(src),
    'Create.jsx must import slugify from ../lib/slug.js');
});

test('T7: Create.jsx imports buildCommunityRecord + buildCommunitiesDListHeader from ../events/build.js', () => {
  const src = read(CREATE_JSX);
  assert(/import\s+\{[^}]*buildCommunityRecord[^}]*\}\s+from\s+['"]\.\.\/events\/build(?:\.js)?['"]/.test(src),
    'Create.jsx must import buildCommunityRecord from ../events/build.js');
  assert(/import\s+\{[^}]*buildCommunitiesDListHeader[^}]*\}\s+from\s+['"]\.\.\/events\/build(?:\.js)?['"]/.test(src),
    'Create.jsx must import buildCommunitiesDListHeader from ../events/build.js');
});

test('T8: Create.jsx imports publishEvent from ../events/publish.js', () => {
  const src = read(CREATE_JSX);
  assert(/import\s+\{[^}]*publishEvent[^}]*\}\s+from\s+['"]\.\.\/events\/publish(?:\.js)?['"]/.test(src),
    'Create.jsx must import publishEvent from ../events/publish.js');
});

test('T9: Create.jsx publishes the header before the record (source order)', () => {
  const src = read(CREATE_JSX);
  const headerIdx = src.indexOf('buildCommunitiesDListHeader');
  const recordIdx = src.indexOf('buildCommunityRecord');
  assert(headerIdx >= 0 && recordIdx >= 0,
    'Create.jsx must call both buildCommunitiesDListHeader and buildCommunityRecord');
  assert(headerIdx < recordIdx,
    'Create.jsx must publish the header (buildCommunitiesDListHeader) before the record (buildCommunityRecord)');
});

test('T10: Create.jsx Review step branches on signedIn for the publish CTA', () => {
  const src = read(CREATE_JSX);
  // The Review step (step === 4) must reference signedIn for the action row.
  // Heuristic: signedIn is referenced inside a step-4 conditional render or ternary.
  assert(/\bsignedIn\b/.test(src),
    'Create.jsx must reference signedIn to gate the publish CTA');
  // A Sign-in affordance must exist for the un-signed branch.
  assert(/sign\s*in/i.test(src) && /onSignIn/.test(src),
    'Create.jsx un-signed Review state must surface a Sign-in CTA wired to onSignIn');
});

test('T11: Create.jsx Review step references the v1 relay default', () => {
  const src = read(CREATE_JSX);
  assert(/communities\.brainstorm\.world/.test(src),
    'Create.jsx Review step must surface the v1 relay default "communities.brainstorm.world" in the rendered copy');
});

test('T12: Create.jsx includes the viewer in the seeds array before building the record', () => {
  const src = read(CREATE_JSX);
  // Pattern: a Set/Array union spreading viewer with whatever holds the
  // selected seed pubkeys. seedMembers used to be a flat array of hex
  // strings; after the profile-search work it became an array of
  // { pubkey, profile } objects with seedPubkeys derived alongside.
  assert(/new\s+Set\(\s*\[\s*viewer\s*,\s*\.\.\.(seedMembers|seedPubkeys)/.test(src) ||
         /\[\s*viewer\s*,\s*\.\.\.(seedMembers|seedPubkeys)/.test(src) ||
         /seedMembers\.includes\(viewer\)/.test(src),
    'Create.jsx must include viewer in the seeds array before building the community-record');
});

test('T13: Create.jsx calls onJoin(slug) + navigate("/community/" + slug) on success', () => {
  const src = read(CREATE_JSX);
  assert(/onJoin\s*\(\s*slug\s*\)/.test(src),
    'Create.jsx must call onJoin(slug) after the publish success');
  assert(/navigate\s*\(\s*[`'"]\/community\/\$\{slug\}|navigate\s*\(\s*['"]\/community\/['"]\s*\+\s*slug/.test(src),
    'Create.jsx must navigate to /community/<slug> on success');
});

/* ────────────────────────────────────────────────────────────
 * Runner
 * ──────────────────────────────────────────────────────────── */

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message.split('\n')[0]}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
