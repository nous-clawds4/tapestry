/**
 * Story communities-coldstart/10: accept a foothold + issuer fulfillment (ADR-0040).
 * Pure cores tested against real source via extract-and-eval:
 *   - buildInviteRedemption (events/build.js)   — redemption event shape
 *   - pendingRedemptions    (lib/invites.js)    — fulfill-once dedup
 * Accept banner + fetches + fulfillment effect via source-guards.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'ui-communities/src/events/build.js');
const INVITES = path.join(ROOT, 'ui-communities/src/lib/invites.js');
const FETCH = path.join(ROOT, 'ui-communities/src/events/fetch.js');
const DETAIL = path.join(ROOT, 'ui-communities/src/pages/CommunityDetail.jsx');
const LEG = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }
function loadExport(file, name, header = '') {
  const src = read(file);
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${path.basename(file)} must export function ${name}`);
  // eslint-disable-next-line no-new-func
  return new Function(m[1], `${header}\n${m[2]}`);
}

const RECIPIENT = 'a'.repeat(64);
const ISSUER = 'b'.repeat(64);
const ATAG = `39998:${'f'.repeat(64)}:sunset`;
const tag = (tags, k) => tags.find(t => t[0] === k);

test('T1: buildInviteRedemption → kind-39999 redemption naming the issuer + code', () => {
  const build = loadExport(BUILD, 'buildInviteRedemption', `const LEGACY_Z_TAG_PUBKEY = '${LEG}'; const nowSec = () => 0;`);
  const ev = build({ viewerPubkey: RECIPIENT, issuer: ISSUER, code: 'abc123', communityATag: ATAG });
  assert(ev.kind === 39999, 'kind 39999');
  assert(tag(ev.tags, 'a')[1] === ATAG, 'a = community');
  assert(tag(ev.tags, 'd')[1] === 'redeem-abc123', 'd = redeem-<code>');
  assert(tag(ev.tags, 'p')[1] === ISSUER, 'p = issuer (so the issuer can find it)');
  assert(tag(ev.tags, 'z')[1] === `39998:${LEG}:foothold-redemption`, 'z = foothold-redemption marker');
  assert(ev.pubkey === RECIPIENT, 'authored by the recipient');
});

test('T2: buildInviteRedemption rejects incomplete input', () => {
  const build = loadExport(BUILD, 'buildInviteRedemption', `const LEGACY_Z_TAG_PUBKEY = '${LEG}'; const nowSec = () => 0;`);
  let threw = 0;
  for (const a of [
    { issuer: ISSUER, code: 'x', communityATag: ATAG },        // no recipient
    { viewerPubkey: RECIPIENT, code: 'x', communityATag: ATAG }, // no issuer
    { viewerPubkey: RECIPIENT, issuer: ISSUER, communityATag: ATAG }, // no code
  ]) { try { build(a) } catch (_) { threw++ } }
  assert(threw === 3, 'throws on each missing field');
});

function loadPending() { return loadExport(INVITES, 'pendingRedemptions'); }
const red = code => ({ code, recipient: RECIPIENT, createdAt: 1 });

test('T3: pendingRedemptions returns only not-yet-fulfilled codes', () => {
  const p = loadPending();
  const out = p([red('a'), red('b'), red('c')], new Set(['b']));
  const codes = out.map(r => r.code).sort();
  assert(codes.length === 2 && codes[0] === 'a' && codes[1] === 'c', 'b (fulfilled) excluded');
});

test('T4: pendingRedemptions — empty fulfilled → all; all fulfilled → none', () => {
  const p = loadPending();
  assert(p([red('a'), red('b')], new Set()).length === 2, 'empty fulfilled → all');
  assert(p([red('a'), red('b')], new Set(['a', 'b'])).length === 0, 'all fulfilled → none');
  assert(p([], new Set()).length === 0, 'no redemptions → none');
});

// ── source guards ──
test('T5: fetchFootholdInvite + fetchRedemptions exist with the right filters', () => {
  const src = read(FETCH);
  assert(/fetchFootholdInvite\b/.test(src), 'fetchFootholdInvite exists');
  assert(/fetchRedemptions\b/.test(src), 'fetchRedemptions exists');
  assert(/foothold-redemption/.test(src), 'queries the foothold-redemption marker');
});

test('T6: accept banner reads ?invite=, shows the inviter, and accept publishes redemption + self-tag', () => {
  const src = read(DETAIL);
  assert(/invite/.test(src) && /searchParams|useSearchParams|location\.search/.test(src), 'reads the invite param');
  assert(/invited you/i.test(src), 'shows who invited (distinctive copy)');
  assert(/buildInviteRedemption/.test(src), 'accept publishes a redemption');
  assert(/handleAssert/.test(src), 'self-tag via the existing assert path');
});

test('T7: issuer fulfillment uses pendingRedemptions + buildMembershipAssertion + markFulfilled', () => {
  const src = read(DETAIL);
  assert(/pendingRedemptions/.test(src), 'computes pending redemptions');
  assert(/buildMembershipAssertion/.test(src), 'publishes the carried vouch (standard assertion)');
  assert(/markFulfilled/.test(src), 'marks fulfilled (publish-once / no churn)');
});

test('T8: an unresolvable/expired invite is a path, not a dead end', () => {
  const src = read(DETAIL);
  assert(/ask whoever shared it|ask .* for a new one|expired/i.test(src), 'expired/unresolvable → path forward');
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
