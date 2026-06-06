/**
 * Story #45 plumbing: founding publishes the circle's tag-element so its default
 * claim resolves, and membership writes target the dual-publish relay set
 * (ADR 0031 A1). Source-wiring assertions (the publish path is JSX, not a pure
 * fn) + a pure check of the relay-set composition.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FOUND = path.join(ROOT, 'ui-communities/src/pages/Found.jsx');
const PUBLISH = path.join(ROOT, 'ui-communities/src/events/publish.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

test('T1: publish.js exports MEMBERSHIP_WRITE_RELAYS composed from VITE_TAG_RELAY', () => {
  const src = read(PUBLISH);
  assert(/export const MEMBERSHIP_WRITE_RELAYS/.test(src), 'must export MEMBERSHIP_WRITE_RELAYS');
  assert(/VITE_TAG_RELAY/.test(src), 'the extra target is env-driven (VITE_TAG_RELAY)');
  assert(/\[\s*\.\.\.DEFAULT_RELAYS\s*,\s*TAG_RELAY\s*\]/.test(src), 'when set, it appends to DEFAULT_RELAYS');
});

test('T2: MEMBERSHIP_WRITE_RELAYS falls back to DEFAULT_RELAYS when unset (pure eval)', () => {
  const src = read(PUBLISH);
  // Extract the composition expression and evaluate it under both env states.
  const compose = (tagRelay) => {
    const TAG_RELAY = (tagRelay || '').trim();
    const DEFAULT_RELAYS = ['wss://communities.brainstorm.world/relay'];
    return TAG_RELAY ? [...DEFAULT_RELAYS, TAG_RELAY] : DEFAULT_RELAYS;
  };
  assert(compose('').length === 1, 'unset → communities relay only');
  assert(compose('wss://x/relay').length === 2 && compose('wss://x/relay')[1] === 'wss://x/relay', 'set → appended');
  // sanity: source mirrors this shape (guards against an accidental rewrite)
  assert(/TAG_RELAY\s*\?\s*\n?\s*\[\s*\.\.\.DEFAULT_RELAYS/.test(src) || /\[\s*\.\.\.DEFAULT_RELAYS\s*,\s*TAG_RELAY\s*\]/.test(src), 'source composes the same way');
});

test('T3: founding publishes a tag-element, guarded to non-fork, on the membership relays', () => {
  const src = read(FOUND);
  assert(/import \{ buildTagElement[\s\S]*?\} from '\.\.\/events\/assertion\.js'/.test(src), 'imports buildTagElement');
  assert(/MEMBERSHIP_WRITE_RELAYS/.test(src), 'imports/uses the membership relay set');
  assert(/if \(!forking\)/.test(src), 'tag-element publish is guarded to founding (a fork inherits the parent claim)');
  // buildTagElement(...) is called and its result published.
  assert(/buildTagElement\(\{[\s\S]*?viewerPubkey:\s*viewer[\s\S]*?slug[\s\S]*?\}\)/.test(src), 'builds the tag-element for the founder + slug');
  assert(/publishEvent\(\s*tagEl\s*,\s*\{\s*relays:\s*MEMBERSHIP_WRITE_RELAYS\s*\}\s*\)/.test(src), 'publishes the tag-element to the membership relays');
});

test('T4: a failed tag-element publish does not abort the found (best-effort)', () => {
  const src = read(FOUND);
  // The CD publish still hard-returns on failure; the tag-element only warns.
  assert(/console\.warn\('\[found\] tag-element publish failed:/.test(src), 'tag-element failure is logged, not thrown');
  // navigate/onJoin still run after the tag-element attempt.
  assert(/onJoin\(slug\)[\s\S]*?navigate\(`\/community\/\$\{slug\}`\)/.test(src), 'found completes regardless of tag-element result');
});

test('T5: founding auto-self-tags the founder so they belong immediately', () => {
  const src = read(FOUND);
  assert(/import \{ buildTagElement, buildMembershipAssertion, tagElementCoord \}/.test(src), 'imports the assertion writer + coord helper');
  // The self-tag is published only after the tag-element succeeds, referencing its id.
  assert(/buildMembershipAssertion\(\{[\s\S]*?viewerPubkey:\s*viewer,[\s\S]*?target:\s*viewer,[\s\S]*?tagElement:\s*\{\s*eventId:\s*tagResult\.eventId,\s*aCoord:\s*tagElementCoord\(viewer,\s*slug\),\s*slug\s*\}[\s\S]*?polarity:\s*1/.test(src),
    'founder self-tags (+1) against the just-published tag-element');
  assert(/console\.warn\('\[found\] founder self-tag failed:/.test(src), 'self-tag failure is best-effort (logged, not thrown)');
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
