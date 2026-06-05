/**
 * Story #33: Found a circle by declaring its definition (epic communities-declaration).
 *
 * TDD — these tests are written before the implementation and MUST fail now.
 * Style matches the repo's existing source-regex + pure-function-eval suites
 * (see participate-kind1-reads-writes.test.js). Live publish + manual mock-mode
 * walkthrough are documented in the test plan.
 *
 * Expected NEW modules (per ADR 0029, strangler — frozen build.js/Create.jsx untouched):
 *   - ui-communities/src/events/declaration.js   (buildCommunityDeclaration, kind 39998)
 *   - ui-communities/src/pages/Found.jsx          (the new found flow)
 *   - normalized Circle projection with a model:'declaration' discriminator in the read path
 *
 * See engineering-team/stories/communities-declaration/33-found-a-circle.test-plan.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UC = path.join(ROOT, 'ui-communities');

const DECLARATION_JS = path.join(UC, 'src/events/declaration.js');
const BUILD_JS       = path.join(UC, 'src/events/build.js');
const FOUND_JSX      = path.join(UC, 'src/pages/Found.jsx');
const CLIENT_JS      = path.join(UC, 'src/api/client.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (err) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${err.message}`); }
}

/* Extract `export function buildCommunityDeclaration(...) { ... }` and eval it
 * with a nowSec() stub, same pattern as the buildKind1Post/slugify tests. */
function loadBuildCommunityDeclaration() {
  const src = read(DECLARATION_JS);
  const m = src.match(/export\s+function\s+buildCommunityDeclaration\s*\(([^)]*)\)\s*\{([\s\S]*?)^\}/m);
  if (!m) throw new Error('declaration.js must export `function buildCommunityDeclaration(...) { ... }`');
  const body = `const nowSec = () => 1700000000;\n${m[2]}`;
  // eslint-disable-next-line no-new-func
  return new Function(m[1], body);
}

/* ── AC-1 — the CD builder exists and produces the right kind-39998 shape ── */

test('T1: events/declaration.js exports buildCommunityDeclaration', () => {
  const src = read(DECLARATION_JS);
  assert(/export\s+function\s+buildCommunityDeclaration\b/.test(src),
    'declaration.js must export buildCommunityDeclaration');
});

test('T2: buildCommunityDeclaration returns a kind-39998 concept with d=slug + definition tags', () => {
  const build = loadBuildCommunityDeclaration();
  const out = build({
    viewerPubkey: 'a'.repeat(64),
    circle: { slug: 'sunset-hikers', name: 'Sunset Hikers', purpose: 'Golden-hour trails', belongingBar: 'A few members who trust you vouch you in', topics: ['outdoors'] },
  });
  assert(out.kind === 39998, `kind must be 39998 (a CD is a concept); got ${out.kind}`);
  assert(out.content === '', 'content must be empty (definition lives in tags)');
  assert(out.pubkey === 'a'.repeat(64), 'pubkey must be the founder');
  const tag = k => (out.tags.find(t => t[0] === k) || [])[1];
  assert(tag('d') === 'sunset-hikers', `d-tag must be the slug; got ${JSON.stringify(out.tags)}`);
  assert(tag('name') === 'Sunset Hikers', 'must carry a name tag');
  assert(typeof tag('description') === 'string' && tag('description').length > 0, 'must carry the purpose as a description tag');
});

/* ── AC-3 — founder is a peer (founder tag, never owner/admin) ── */

test('T3: buildCommunityDeclaration tags the founder as a peer (founder tag, no owner/admin tag)', () => {
  const build = loadBuildCommunityDeclaration();
  const out = build({ viewerPubkey: 'b'.repeat(64), circle: { slug: 's', name: 'S', purpose: 'p', belongingBar: 'b' } });
  const keys = out.tags.map(t => t[0]);
  assert(keys.includes('founder'), 'must carry a founder tag (peer, not owner)');
  assert(!keys.some(k => /^(owner|admin|moderator)$/i.test(k)),
    `must NOT carry owner/admin/moderator tags; got ${JSON.stringify(keys)}`);
});

/* ── AC-4 — belonging-bar is prose, not a member list (no seed/member tags) ── */

test('T4: buildCommunityDeclaration carries the belonging-bar as prose and emits no seed/member tags', () => {
  const build = loadBuildCommunityDeclaration();
  const out = build({ viewerPubkey: 'c'.repeat(64), circle: { slug: 's', name: 'S', purpose: 'p', belongingBar: 'earn a few trusted vouches' } });
  const has = k => out.tags.some(t => t[0] === k);
  // belonging-bar present as a single prose tag (name flexible: belonging / belonging_bar)
  assert(out.tags.some(t => /^belonging/.test(t[0]) && typeof t[1] === 'string' && t[1].length > 0),
    `must carry the belonging-bar as a prose tag; got ${JSON.stringify(out.tags)}`);
  assert(!has('seed') && !has('member'),
    'a CD is a definition, not a roster — must NOT emit seed/member tags');
});

/* ── AC-7 / strangler — CD lives in its own module; bespoke build.js untouched ── */

test('T5: the bespoke build.js is untouched (still kind-39999 community-record) and has NO CD builder', () => {
  const src = read(BUILD_JS);
  assert(/export\s+function\s+buildCommunityRecord\b/.test(src),
    'build.js must still export the frozen bespoke buildCommunityRecord');
  assert(/kind:\s*39999/.test(src), 'bespoke community-record must remain kind-39999');
  assert(!/buildCommunityDeclaration/.test(src),
    'the CD builder must live in declaration.js, not be added to the frozen build.js (strangler)');
});

test('T6: a read path normalizes both models behind a model:"declaration" discriminator', () => {
  const src = read(CLIENT_JS);
  assert(/declaration/.test(src) && /model/.test(src),
    'client.js (or the read path) must carry a normalized Circle projection with a model discriminator incl. "declaration"');
});

/* ── AC-2 / AC-5 / AC-6 — the found flow wiring ── */

test('T7: Found.jsx founds via buildCommunityDeclaration → publishEvent → navigate to the new circle', () => {
  const src = read(FOUND_JSX);
  assert(/buildCommunityDeclaration/.test(src), 'Found.jsx must build a CD via buildCommunityDeclaration');
  const bIdx = src.indexOf('buildCommunityDeclaration');
  const pIdx = src.indexOf('publishEvent', bIdx);
  assert(pIdx >= 0 && pIdx - bIdx < 800, 'Found.jsx must publishEvent shortly after building the CD');
  assert(/navigate\(\s*[`'"]\/community\//.test(src),
    'Found.jsx must navigate to /community/<slug> on success (founder lands on the circle)');
});

test('T8: Found.jsx requests sign-in only at publish and preserves state (gated on signedIn)', () => {
  const src = read(FOUND_JSX);
  assert(/signedIn/.test(src), 'Found.jsx must gate the publish action on signedIn');
  assert(/onSignIn|signInWithNip07|handleSignIn/.test(src),
    'Found.jsx must offer inline sign-in at the publish step (not redirect away)');
});

test('T9: Found.jsx uses specific publish-error copy (reuses lib/errors.js), never a generic message', () => {
  const src = read(FOUND_JSX);
  assert(/from\s+['"]\.\.\/lib\/errors(?:\.js)?['"]/.test(src) && /publishErrorCopy/.test(src),
    'Found.jsx must import + use publishErrorCopy from ../lib/errors.js for specific failure copy');
});

test('T10: Found.jsx uses no owner/admin/moderator labels (founder is a peer)', () => {
  const src = read(FOUND_JSX);
  assert(!/\b(owner|admin|moderator)\b/i.test(src.replace(/\/\/.*$/gm, '')),
    'Found.jsx must not label the founder as owner/admin/moderator (peer copy per the style guide)');
});

/* ── Runner ── */
async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message.split('\n')[0]}`); fail++; }
  }
  return { pass, fail };
}
module.exports = { run };
