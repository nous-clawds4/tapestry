/**
 * Story #43: membership assertion + vouch writer (events/assertion.js).
 * Pure-function eval of the two unsigned kind-39999 builders. ADR 0030 +
 * docs/COMMUNITIES_TAG_CORE_INTEGRATION_HANDOFF.md (Vinney's wire shape).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MOD = path.join(ROOT, 'ui-communities/src/events/assertion.js');
const LEG = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

// Extract a top-level `export function NAME(args){body}` and run it standalone,
// injecting the module helpers the body relies on (LEGACY_Z_TAG_PUBKEY, nowSec).
function loadExport(name) {
  const src = read(MOD);
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`assertion.js must export function ${name}`);
  const body = `const LEGACY_Z_TAG_PUBKEY = '${LEG}';\nconst nowSec = () => 0;\n${m[2]}`;
  // eslint-disable-next-line no-new-func
  return new Function(m[1], body);
}

const FOUNDER = 'f'.repeat(64);
const VIEWER = 'a'.repeat(64);
const TARGET = 'b'.repeat(64);
const SLUG = 'climbers';
const TAGEL = { eventId: 'e'.repeat(64), aCoord: `39999:${FOUNDER}:${SLUG}`, slug: SLUG };

test('T1: exports both builders', () => {
  const src = read(MOD);
  assert(/export\s+function\s+buildTagElement\b/.test(src), 'must export buildTagElement');
  assert(/export\s+function\s+buildMembershipAssertion\b/.test(src), 'must export buildMembershipAssertion');
});

test('T2: buildTagElement is a kind-39999 with bare-slug d + tag z-header', () => {
  const build = loadExport('buildTagElement');
  const ev = build({ viewerPubkey: FOUNDER, slug: SLUG, name: 'Climbers', description: 'people who climb' });
  const one = k => { const t = ev.tags.find(x => x[0] === k); return t && t[1]; };
  assert(ev.kind === 39999, 'kind 39999');
  assert(one('d') === SLUG, `d is the bare slug (no tag- prefix), got ${one('d')}`);
  assert(one('z') === `39998:${LEG}:tag`, `z = tag type header, got ${one('z')}`);
  assert(ev.pubkey === FOUNDER, 'authored by the founder');
  const content = JSON.parse(ev.content);
  assert(content.tag && content.tag.slug === SLUG, 'content.tag.slug present');
});

test('T3: a self-tag targets the signer with +1 (applicant signal)', () => {
  const build = loadExport('buildMembershipAssertion');
  const ev = build({ viewerPubkey: VIEWER, target: VIEWER, tagElement: TAGEL }); // default polarity +1
  const one = k => { const t = ev.tags.find(x => x[0] === k); return t && t[1]; };
  assert(ev.kind === 39999, 'kind 39999');
  assert(one('p') === VIEWER, 'p = the (self) target');
  assert(one('polarity') === '1', `default polarity is +1, got ${one('polarity')}`);
});

test('T4: a vouch (+1) and a dispute (-1) differ only in polarity', () => {
  const build = loadExport('buildMembershipAssertion');
  const vouch = build({ viewerPubkey: VIEWER, target: TARGET, tagElement: TAGEL, polarity: 1 });
  const dispute = build({ viewerPubkey: VIEWER, target: TARGET, tagElement: TAGEL, polarity: -1 });
  const pol = ev => ev.tags.find(t => t[0] === 'polarity')[1];
  assert(pol(vouch) === '1' && pol(dispute) === '-1', 'polarity reflects vouch vs dispute');
  assert(vouch.tags.find(t => t[0] === 'p')[1] === TARGET, 'vouch targets the other person');
});

test('T5: the assertion carries p + e + a + nostr-user-tag z (hybrid from day one)', () => {
  const build = loadExport('buildMembershipAssertion');
  const ev = build({ viewerPubkey: VIEWER, target: TARGET, tagElement: TAGEL, polarity: 1 });
  const one = k => { const t = ev.tags.find(x => x[0] === k); return t && t[1]; };
  assert(one('e') === TAGEL.eventId, 'e = tag-element event id (provenance)');
  assert(one('a') === TAGEL.aCoord, 'a = tag-element coord, emitted from day one (no backfill)');
  assert(one('z') === `39998:${LEG}:nostr-user-tag`, `z = nostr-user-tag type header, got ${one('z')}`);
  const content = JSON.parse(ev.content);
  assert(content.nostrUserTag && content.nostrUserTag.tagEventId === TAGEL.eventId, 'content references the tag-element id');
  assert(content.nostrUserTag.taggedPubkey === TARGET, 'content references the target');
});

test('T6: the d-tag is profile-tag-<slug>-<target8>-<asserter8> (signer first-8, not x)', () => {
  const build = loadExport('buildMembershipAssertion');
  const ev = build({ viewerPubkey: VIEWER, target: TARGET, tagElement: TAGEL, polarity: 1 });
  const d = ev.tags.find(t => t[0] === 'd')[1];
  assert(d === `profile-tag-${SLUG}-${TARGET.slice(0, 8)}-${VIEWER.slice(0, 8)}`, `d-tag shape, got ${d}`);
  assert(!/-x$/.test(d), 'the 4th segment must be the asserter first-8, not a literal x');
});

test('T7: it uses the shared nostr-user-tag shape — no community-specific tags', () => {
  const build = loadExport('buildMembershipAssertion');
  const ev = build({ viewerPubkey: VIEWER, target: TARGET, tagElement: TAGEL, polarity: 1 });
  const keys = ev.tags.map(t => t[0]);
  assert(!keys.includes('claims'), 'no claims tag on the assertion');
  assert(!ev.tags.some(t => t[0] === 't' && t[1] === 'brainstorm-community'), 'no community type marker — the tag stays general');
});

test('T8: builders validate required inputs', () => {
  const buildEl = loadExport('buildTagElement');
  const buildAs = loadExport('buildMembershipAssertion');
  let threw = 0;
  try { buildEl({ slug: SLUG }); } catch { threw++; }                         // element: missing viewerPubkey
  try { buildEl({ viewerPubkey: FOUNDER }); } catch { threw++; }              // element: missing slug
  try { buildAs({ viewerPubkey: VIEWER, tagElement: TAGEL }); } catch { threw++; } // missing target
  try { buildAs({ viewerPubkey: VIEWER, target: TARGET }); } catch { threw++; }    // missing tagElement
  assert(threw === 4, `all four invalid calls must throw, threw ${threw}`);
});

test('T9: the SOURCE LEG pubkey const is byte-correct (not the harness-injected one)', () => {
  // The eval harness injects LEGACY_Z_TAG_PUBKEY, which would mask a corrupt
  // source const — so assert the source value directly. A single wrong byte
  // here silently breaks all trust filtering (ADR-0015).
  const src = read(MOD);
  const m = src.match(/LEGACY_Z_TAG_PUBKEY\s*=\s*'([0-9a-f]+)'/);
  assert(m, 'source must define LEGACY_Z_TAG_PUBKEY as a hex literal');
  assert(m[1] === LEG, `source LEG pubkey must equal the ADR-0015 value, got ${m[1]}`);
});

test('T10: exported z-tag consts compose from LEG; tagElementCoord is the coord formula', () => {
  const src = read(MOD);
  assert(/export const TAG_Z_TAG\s*=\s*`39998:\$\{LEGACY_Z_TAG_PUBKEY\}:tag`/.test(src), 'TAG_Z_TAG composed from the source LEG const');
  assert(/export const NOSTR_USER_TAG_Z_TAG\s*=\s*`39998:\$\{LEGACY_Z_TAG_PUBKEY\}:nostr-user-tag`/.test(src), 'NOSTR_USER_TAG_Z_TAG composed from the source LEG const');
  const coord = loadExport('tagElementCoord');
  assert(coord('author', 'slug') === '39999:author:slug', `tagElementCoord(author, slug) → 39999:author:slug, got ${coord('author', 'slug')}`);
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
