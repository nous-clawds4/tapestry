/**
 * Story #42: a Community Declaration declares which concept(s) it CLAIMS as
 * its membership signal, plus the trust bar (threshold + cutoff). ADR 0030.
 *
 * Two halves, both pure-function eval (no network):
 *   - the BUILDER (events/declaration.js) writes claims/threshold/cutoff tags
 *   - the PROJECTION (events/fetch.js projectDeclaration) reads them back
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DECL = path.join(ROOT, 'ui-communities/src/events/declaration.js');
const FETCH = path.join(ROOT, 'ui-communities/src/events/fetch.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

// Extract a top-level `export function NAME(args) { body }` as a callable.
function loadExport(file, name) {
  const src = read(file);
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${path.basename(file)} must export function ${name}`);
  // Inject module-scope helpers the body relies on (nowSec) so the extracted
  // body runs standalone. Destructured arg lists pass through verbatim.
  const body = `const nowSec = () => 0;\n${m[2]}`;
  // eslint-disable-next-line no-new-func
  return new Function(m[1], body);
}

// projectDeclaration is a *non-exported* helper; pull its body out and wrap it.
function loadProjectDeclaration() {
  const src = read(FETCH);
  const m = src.match(/function\s+projectDeclaration\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/m);
  if (!m) throw new Error('fetch.js must define function projectDeclaration(event)');
  // Body references DEFAULT_RELAYS — inject a stand-in.
  const body = `const DEFAULT_RELAYS = [];\n${m[2]}`;
  // eslint-disable-next-line no-new-func
  return new Function(m[1], body);
}

const VIEWER = 'founder-pubkey';
const CIRCLE = { slug: 'climbers', name: 'Climbers', purpose: 'people who climb' };

test('T1: builder emits a default claims tag = the circle\'s own tag-element (39999)', () => {
  const build = loadExport(DECL, 'buildCommunityDeclaration');
  const ev = build({ viewerPubkey: VIEWER, circle: CIRCLE });
  const claims = ev.tags.filter(t => t[0] === 'claims').map(t => t[1]);
  assert(claims.length === 1, 'exactly one default claims tag');
  // Per Vinney's wire shape (ADR-0022): a community claims a nostr-user-tag
  // ELEMENT, coord 39999:<tagAuthor>:<slug> — not the 39998 type concept.
  assert(claims[0] === `39999:${VIEWER}:${CIRCLE.slug}`, `default claims its own tag-element, got ${claims[0]}`);
});

test('T2: builder honors explicit claims (many-to-many)', () => {
  const build = loadExport(DECL, 'buildCommunityDeclaration');
  const ev = build({ viewerPubkey: VIEWER, circle: { ...CIRCLE, claims: ['39999:a:x', '39999:b:y'] } });
  const claims = ev.tags.filter(t => t[0] === 'claims').map(t => t[1]);
  assert(claims.length === 2 && claims[0] === '39999:a:x' && claims[1] === '39999:b:y',
    `should emit both explicit claims, got ${JSON.stringify(claims)}`);
});

test('T3: builder emits threshold + cutoff with defaults (1 / 0.5)', () => {
  const build = loadExport(DECL, 'buildCommunityDeclaration');
  const ev = build({ viewerPubkey: VIEWER, circle: CIRCLE });
  const one = k => { const t = ev.tags.find(x => x[0] === k); return t && t[1]; };
  assert(one('membership_threshold') === '1', `default threshold 1, got ${one('membership_threshold')}`);
  assert(one('influence_cutoff') === '0.5', `default cutoff 0.5, got ${one('influence_cutoff')}`);
});

test('T4: builder honors explicit threshold + cutoff (incl. zero)', () => {
  const build = loadExport(DECL, 'buildCommunityDeclaration');
  const ev = build({ viewerPubkey: VIEWER, circle: { ...CIRCLE, threshold: 2, cutoff: 0 } });
  const one = k => { const t = ev.tags.find(x => x[0] === k); return t && t[1]; };
  assert(one('membership_threshold') === '2', `threshold 2, got ${one('membership_threshold')}`);
  // 0 is a legitimate cutoff — must not be swallowed by a truthiness default.
  assert(one('influence_cutoff') === '0', `cutoff 0 must survive, got ${one('influence_cutoff')}`);
});

test('T5: projection reads claims (many) + threshold + cutoff back', () => {
  const project = loadProjectDeclaration();
  const event = {
    pubkey: VIEWER,
    tags: [
      ['d', 'climbers'],
      ['t', 'brainstorm-community'],
      ['name', 'Climbers'],
      ['claims', '39999:a:x'],
      ['claims', '39999:b:y'],
      ['membership_threshold', '2'],
      ['influence_cutoff', '0.7'],
    ],
  };
  const p = project(event);
  assert(Array.isArray(p.claims) && p.claims.length === 2, 'claims read as a list');
  assert(p.claims[0] === '39999:a:x' && p.claims[1] === '39999:b:y', 'claims preserved in order');
  assert(p.membershipThreshold === 2, `threshold parsed, got ${p.membershipThreshold}`);
  assert(p.influenceCutoff === 0.7, `cutoff parsed, got ${p.influenceCutoff}`);
});

test('T6: projection reports absent threshold/cutoff as null (not a default)', () => {
  // Defaulting lives in the consumer (deriveRoster), not the projection — so a
  // fork can tell "unstated" (inherit) from "stated 1/0.5". See ADR 0030.
  const project = loadProjectDeclaration();
  const event = { pubkey: VIEWER, tags: [['d', 'climbers'], ['t', 'brainstorm-community']] };
  const p = project(event);
  assert(Array.isArray(p.claims) && p.claims.length === 0, 'no claims → empty list');
  assert(p.membershipThreshold === null, `absent threshold → null, got ${p.membershipThreshold}`);
  assert(p.influenceCutoff === null, `absent cutoff → null, got ${p.influenceCutoff}`);
});

test('T7: builder→projection round-trip is stable', () => {
  const build = loadExport(DECL, 'buildCommunityDeclaration');
  const project = loadProjectDeclaration();
  const ev = build({ viewerPubkey: VIEWER, circle: { ...CIRCLE, threshold: 3, cutoff: 0.2 } });
  const p = project(ev);
  assert(p.claims[0] === `39999:${VIEWER}:${CIRCLE.slug}`, 'round-trip claims');
  assert(p.membershipThreshold === 3 && p.influenceCutoff === 0.2, 'round-trip trust bar');
});

test('T8: a fork omits unset membership fields so they inherit (§26)', () => {
  const build = loadExport(DECL, 'buildCommunityDeclaration');
  // Fork = parentATag present, convener changed nothing about membership.
  const ev = build({ viewerPubkey: 'forker', circle: { slug: 'sub' }, parentATag: '39999:a:parent' });
  const has = k => ev.tags.some(t => t[0] === k);
  assert(!has('claims'), 'fork must omit claims to inherit the parent rule');
  assert(!has('membership_threshold'), 'fork must omit threshold to inherit');
  assert(!has('influence_cutoff'), 'fork must omit cutoff to inherit');
});

test('T9: a fork that overrides writes only the overridden field', () => {
  const build = loadExport(DECL, 'buildCommunityDeclaration');
  const ev = build({ viewerPubkey: 'forker', circle: { slug: 'sub', threshold: 5 }, parentATag: '39999:a:parent' });
  const one = k => { const t = ev.tags.find(x => x[0] === k); return t && t[1]; };
  assert(one('membership_threshold') === '5', 'override is written');
  assert(!ev.tags.some(t => t[0] === 'influence_cutoff'), 'unset cutoff still omitted (inherits)');
});

test('T10: the §26 resolver inherits a parent\'s membership rule down a fork', async () => {
  const resolveMod = read(path.join(ROOT, 'ui-communities/src/lib/resolveDefinition.js'));
  // Confirm the resolver actually folds the membership fields (guards against a
  // future edit dropping them from DEFINITION_FIELDS / statedFields).
  assert(/membershipThreshold/.test(resolveMod) && /influenceCutoff/.test(resolveMod) && /['"]claims['"]/.test(resolveMod),
    'resolveDefinition must carry claims/threshold/cutoff');
  const m = resolveMod.match(/export\s+async\s+function\s+resolveDefinition\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}\n/m);
  assert(m, 'resolveDefinition export found');
  // Build the resolver with its sibling helpers in scope by eval-ing the module
  // body sans import/export keywords.
  const stripped = resolveMod
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/export const/g, 'const')
    .replace(/export function/g, 'function')
    .replace(/export async function/g, 'async function');
  // eslint-disable-next-line no-new-func
  const factory = new Function(`${stripped}\nreturn resolveDefinition;`);
  const resolveDefinition = factory();
  const parent = { slug: 'parent', founder: 'a', name: 'Parent', claims: ['39999:a:parent'], membershipThreshold: 4, influenceCutoff: 0.3 };
  const child = { slug: 'sub', founder: 'forker', parent: '39999:a:parent', name: 'Sub', claims: [], membershipThreshold: null, influenceCutoff: null };
  const fetchByATag = async (aTag) => (aTag === '39999:a:parent' ? parent : null);
  const resolved = await resolveDefinition(child, fetchByATag);
  assert(resolved.membershipThreshold === 4, `child inherits parent threshold, got ${resolved.membershipThreshold}`);
  assert(resolved.influenceCutoff === 0.3, `child inherits parent cutoff, got ${resolved.influenceCutoff}`);
  assert(Array.isArray(resolved.claims) && resolved.claims[0] === '39999:a:parent', 'child inherits parent claims');
});

test('T11: a fork override beats inheritance in the resolver', async () => {
  const resolveMod = read(path.join(ROOT, 'ui-communities/src/lib/resolveDefinition.js'));
  const stripped = resolveMod
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/export const/g, 'const')
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function');
  // eslint-disable-next-line no-new-func
  const resolveDefinition = new Function(`${stripped}\nreturn resolveDefinition;`)();
  const parent = { slug: 'parent', founder: 'a', membershipThreshold: 4, influenceCutoff: 0.3, claims: ['39999:a:parent'] };
  const child = { slug: 'sub', founder: 'forker', parent: '39999:a:parent', membershipThreshold: 9, influenceCutoff: null, claims: [] };
  const resolved = await resolveDefinition(child, async () => parent);
  assert(resolved.membershipThreshold === 9, 'child override wins');
  assert(resolved.influenceCutoff === 0.3, 'unset child field still inherits');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (e) { console.log(`  ✗ ${t.name}`); console.log(`      ${e.message.split('\n')[0]}`); fail++; }
  }
  return { pass, fail };
}
module.exports = { run };
