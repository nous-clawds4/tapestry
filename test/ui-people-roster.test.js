/**
 * Story #45 (UI): the People-tab live roster + Trust Signal for declaration
 * circles. Source-wiring assertions (JSX isn't unit-evaluable in this harness);
 * the roster/gate logic itself is covered by roster-client + roster-engine.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TRUST = path.join(ROOT, 'ui-communities/src/components/TrustSignal.jsx');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }

test('T1: TrustSignal carries the design-guide copy (both PoV variants + hint)', () => {
  const src = read(TRUST);
  assert(/people you trust are/.test(src), 'signed-in / personal: "people you trust are inside"');
  assert(/established member/.test(src), 'house: "N established members"');
  assert(/Sign in to see who you trust/.test(src), 'signed-out hint');
  assert(/personalPov/.test(src), 'PoV variant is a prop (flips to personal when WoT-provisioned)');
});

test('T2: detail wires getRoster (house PoV) for declaration circles only', () => {
  const src = read(DETAIL);
  assert(/import TrustSignal from '\.\.\/components\/TrustSignal\.jsx'/.test(src), 'imports TrustSignal');
  assert(/import \{ getRoster, resolveTagElement \} from '\.\.\/lib\/roster\.js'/.test(src), 'imports roster client');
  assert(/getRoster\(community, \{ wotPov: 'house' \}\)/.test(src), 'fetches roster at house PoV');
  assert(/model !== 'declaration'/.test(src), 'roster effect is gated to declaration circles');
  assert(/tab === 'people' && isDeclaration/.test(src), 'declaration People branch');
  assert(/tab === 'people' && !isDeclaration/.test(src), 'bespoke People branch preserved');
});

test('T3: "I\'m in" and Vouch publish assertions via the writer + membership relays', () => {
  const src = read(DETAIL);
  assert(/import \{ buildMembershipAssertion \} from '\.\.\/events\/assertion\.js'/.test(src), 'imports the writer');
  assert(/MEMBERSHIP_WRITE_RELAYS/.test(src), 'uses the dual-publish relay set');
  assert(/buildMembershipAssertion\(\{[\s\S]*?target,[\s\S]*?tagElement: tagEl[\s\S]*?polarity[\s\S]*?\}\)/.test(src), 'builds the assertion for a target + polarity');
  assert(/publishEvent\(unsigned,\s*\{\s*relays:\s*MEMBERSHIP_WRITE_RELAYS\s*\}\)/.test(src), 'publishes to the membership relays');
  assert(/handleAssert\(viewer,\s*1\)/.test(src), '"I\'m in" self-tags the viewer (+1)');
  assert(/handleAssert\(m\.pubkey,\s*1\)/.test(src), 'Vouch tags the member (+1)');
  assert(/I'm in/.test(src), 'the "I\'m in" action is present');
});

test('T4: per-member standing + empty/degraded states use the guide copy', () => {
  const src = read(DETAIL);
  assert(/trusted by people you trust/.test(src), 'trusted standing copy');
  assert(/no one you trust vouches for them/.test(src), 'untrusted standing copy (data-driven)');
  assert(/No established members yet/.test(src), 'empty state copy');
  assert(/reach the trust network/.test(src), 'degraded state copy');
  assert(/onClick=\{triggerRetry\}/.test(src), 'degraded state offers retry (no blocked page)');
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
