/**
 * Story communities-coldstart/9: extend a foothold invite (ADR-0039, issuing side).
 * Pure buildFootholdInvite tested against real source via extract-and-eval (loader
 * injects LEGACY_Z_TAG_PUBKEY + nowSec, like membership-assertion). Issuing UI via
 * source-guards. Accepting + carried-vouch fulfillment is Story 10 (not here).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'ui-communities/src/events/build.js');
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
function loadInvite() { return loadExport(BUILD, 'buildFootholdInvite', `const LEGACY_Z_TAG_PUBKEY = '${LEG}'; const nowSec = () => 0;`); }

const ISSUER = 'a'.repeat(64);
const ATAG = `39998:${'f'.repeat(64)}:sunset`;
const tag = (tags, k) => tags.find(t => t[0] === k);

test('T1: buildFootholdInvite → kind-7? no, kind-39999 addressable invite event', () => {
  const ev = loadInvite()({ viewerPubkey: ISSUER, communityATag: ATAG, code: 'abc123' });
  assert(ev.kind === 39999, 'kind 39999');
  assert(tag(ev.tags, 'a')[1] === ATAG, 'a = community coordinate');
  assert(tag(ev.tags, 'd')[1] === 'invite-abc123', 'd = invite-<code> (addressable by code)');
  assert(tag(ev.tags, 'p')[1] === ISSUER, 'p = issuer');
  assert(tag(ev.tags, 'z')[1] === `39998:${LEG}:foothold-invite`, 'z = foothold-invite marker');
  assert((ev.content || '') === '', 'no content');
});

test('T2: buildFootholdInvite rejects incomplete input', () => {
  const build = loadInvite();
  let threw = 0;
  for (const args of [
    { viewerPubkey: ISSUER, communityATag: ATAG },        // no code
    { viewerPubkey: ISSUER, code: 'x' },                  // no community
    { communityATag: ATAG, code: 'x' },                   // no issuer
  ]) { try { build(args) } catch (_) { threw++ } }
  assert(threw === 3, 'throws on each missing field');
});

// ── source guards (CommunityDetail issuing UI) ──
test('T3: create-invite builds + publishes to the membership relays', () => {
  const src = read(DETAIL);
  assert(/buildFootholdInvite/.test(src), 'builds the invite');
  assert(/publishEvent/.test(src) && /MEMBERSHIP_WRITE_RELAYS/.test(src), 'publishes to membership relays');
});

test('T4: the shareable link carries the code via ?invite=', () => {
  const src = read(DETAIL);
  assert(/[?&]invite=/.test(src) || /invite=\$\{/.test(src), 'link includes an ?invite= param');
});

test('T5: issued invites are listed with an empty state', () => {
  const src = read(DETAIL);
  assert(/[Ii]nvite/.test(src), 'invite affordance present');
  assert(/haven.t invited|No invites|first foothold/i.test(src), 'designed empty state for invites');
});

test('T6: invite copy is peer-voiced — states the invite vouches for the recipient', () => {
  const src = read(DETAIL);
  // Distinctive invite phrase (not the existing roster-row "no one you trust
  // vouches for them" copy, and not the existing "never approve/admit" comment).
  assert(/invite vouches for them/i.test(src), 'invite states it vouches for the recipient (peer voice)');
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
