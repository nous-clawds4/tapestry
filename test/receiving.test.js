/**
 * Unit tests for the framework-free "receiving setup" core (Phase 1).
 *
 * Matches the repo's existing test style (node + assert, PASS/FAIL summary,
 * exit code). Run with `npm run test:receiving` or `node test/receiving.test.js`.
 *
 * Covers the rev. 2 review findings as pure-logic assertions:
 *   - validators (lud16 format, bolt12 extraction incl. unified URIs)
 *   - npub→npub.cash derivation
 *   - alias-clearing / REPLACE semantics (Finding 2)
 *   - bolt12→lud16 precedence + tracked/untracked (Findings 3)
 *   - newest-by-created_at merge (Finding 1)
 */

const assert = require('assert');

const {
  extractBolt12, isBolt12, validateLud16, npubCashAddress,
  extractLnurl, isLnurl, decodeLnurl, normalizeLnurl,
  WALLET_OPTIONS, getOption,
} = require('../src/lib/receiving/walletOptions');
const { buildReceivingContent, mergeReceivingField } = require('../src/lib/receiving/mergeKind0');
const { resolveReceivingMethod, resolvePayment } = require('../src/lib/receiving/resolveMethod');
const { pickNewestEvent, mergeNewestByPubkey } = require('../src/lib/receiving/newest');

const A = 'a'.repeat(64);

// LNURL fixtures (deterministic, no network):
//   GOOD   — the canonical LUD-01 example, decodes to https://service.com/api?q=…
//   NONURL — a valid lnurl1… that decodes to plain text (must be rejected: not http)
//   BROKEN — GOOD with its last data char flipped (busted bech32 checksum)
const GOOD_LNURL = 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns';
const NONURL_LNURL = 'lnurl1df6hxapqwdhk6efqw3jhsapvyphx7apqvys82unv52hlxj';
const BROKEN_LNURL = 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fnq';

function run(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); return true; }
  catch (err) { console.error(`  ✗ ${name}\n      ${err.message}`); return false; }
}

// ---- validators ------------------------------------------------------------

function testValidators() {
  let ok = true;
  ok = run('extractBolt12 accepts bare lno1…', () => {
    assert.strictEqual(extractBolt12('lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjzfppz'),
      'lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjzfppz');
  }) && ok;
  ok = run('extractBolt12 accepts bitcoin:?lno= unified URI, returns original form', () => {
    const uri = 'bitcoin:?lno=lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjzfppz';
    assert.strictEqual(extractBolt12(uri), uri);
  }) && ok;
  ok = run('extractBolt12 trims whitespace', () => {
    assert.strictEqual(extractBolt12('  lno1pqps7sjqpgtyzm3q  '), 'lno1pqps7sjqpgtyzm3q');
  }) && ok;
  ok = run('extractBolt12 rejects non-offers', () => {
    assert.strictEqual(extractBolt12('alice@example.com'), null);
    assert.strictEqual(extractBolt12(''), null);
    assert.strictEqual(extractBolt12(null), null);
    assert.strictEqual(isBolt12('nope'), false);
  }) && ok;
  ok = run('validateLud16 accepts name@domain.tld', () => {
    const r = validateLud16('alice@walletofsatoshi.com');
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.value, 'alice@walletofsatoshi.com');
  }) && ok;
  ok = run('validateLud16 rejects malformed', () => {
    assert.strictEqual(validateLud16('alice').valid, false);
    assert.strictEqual(validateLud16('alice@localhost').valid, false); // no dotted domain
    assert.strictEqual(validateLud16('a b@x.com').valid, false);       // whitespace
    assert.strictEqual(validateLud16('').valid, false);
  }) && ok;
  return ok;
}

// ---- LNURL (lud06) decode + validation -------------------------------------

function testLnurl() {
  let ok = true;
  ok = run('extractLnurl accepts lnurl1…, lightning:, and UPPER, returns bare lowercase', () => {
    assert.strictEqual(extractLnurl(GOOD_LNURL), GOOD_LNURL);
    assert.strictEqual(extractLnurl(GOOD_LNURL.toUpperCase()), GOOD_LNURL);
    assert.strictEqual(extractLnurl('lightning:' + GOOD_LNURL), GOOD_LNURL);
    assert.strictEqual(extractLnurl('LIGHTNING:' + GOOD_LNURL.toUpperCase()), GOOD_LNURL);
    assert.strictEqual(extractLnurl('  ' + GOOD_LNURL + '  '), GOOD_LNURL);
    assert.strictEqual(isLnurl(GOOD_LNURL), true);
  }) && ok;
  ok = run('decodeLnurl returns the underlying https URL', () => {
    assert.strictEqual(decodeLnurl(GOOD_LNURL), 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df');
  }) && ok;
  ok = run('extractLnurl rejects a code that decodes to a non-URL', () => {
    assert.strictEqual(extractLnurl(NONURL_LNURL), null);
    assert.strictEqual(decodeLnurl(NONURL_LNURL), null);
    assert.strictEqual(isLnurl(NONURL_LNURL), false);
  }) && ok;
  ok = run('extractLnurl rejects a busted-checksum code', () => {
    assert.strictEqual(extractLnurl(BROKEN_LNURL), null);
  }) && ok;
  ok = run('extractLnurl rejects addresses, offers, junk, empty', () => {
    assert.strictEqual(extractLnurl('alice@walletofsatoshi.com'), null);
    assert.strictEqual(extractLnurl('lno1pqps7sjqpgtyzm3q'), null);
    assert.strictEqual(extractLnurl('not-an-lnurl'), null);
    assert.strictEqual(extractLnurl(''), null);
    assert.strictEqual(extractLnurl(null), null);
  }) && ok;
  ok = run('normalizeLnurl strips prefix/case without decoding', () => {
    assert.strictEqual(normalizeLnurl('LIGHTNING:LNURL1ABC'), 'lnurl1abc');
    assert.strictEqual(normalizeLnurl('nope'), null);
  }) && ok;
  return ok;
}

// ---- npub.cash derivation --------------------------------------------------

function testNpubCash() {
  let ok = true;
  ok = run('npubCashAddress derives <npub>@npub.cash from hex', () => {
    const addr = npubCashAddress(A);
    assert.ok(addr.startsWith('npub1'), `expected npub1… got ${addr}`);
    assert.ok(addr.endsWith('@npub.cash'), `expected @npub.cash got ${addr}`);
    // deterministic
    assert.strictEqual(npubCashAddress(A), addr);
  }) && ok;
  ok = run('npubCashAddress passes through an npub1… as-is', () => {
    const npub = npubCashAddress(A).split('@')[0];
    assert.strictEqual(npubCashAddress(npub), `${npub}@npub.cash`);
  }) && ok;
  ok = run('npubCashAddress rejects garbage', () => {
    assert.throws(() => npubCashAddress('not-a-key'));
    assert.throws(() => npubCashAddress(''));
  }) && ok;
  return ok;
}

// ---- alias-clearing / REPLACE semantics (Finding 2) ------------------------

function testReplaceSemantics() {
  let ok = true;

  ok = run('setting lud16 clears bolt12/lud12/lightning_offer, preserves other fields', () => {
    const existing = {
      name: 'Alice', about: 'hi', nip05: 'alice@x.com',
      bolt12: 'lno1abcdefghij', lud12: 'lno1zzzzzzzzzz', lightning_offer: 'lno1qqqqqqqqqq',
    };
    const { content, field, value, cleared } = buildReceivingContent({
      profile: existing, method: 'address', value: 'alice@walletofsatoshi.com', pubkeyHex: A,
    });
    assert.strictEqual(field, 'lud16');
    assert.strictEqual(value, 'alice@walletofsatoshi.com');
    assert.strictEqual(content.lud16, 'alice@walletofsatoshi.com');
    assert.strictEqual(content.bolt12, undefined);
    assert.strictEqual(content.lud12, undefined);
    assert.strictEqual(content.lightning_offer, undefined);
    // non-receiving fields survive
    assert.strictEqual(content.name, 'Alice');
    assert.strictEqual(content.about, 'hi');
    assert.strictEqual(content.nip05, 'alice@x.com');
    assert.deepStrictEqual(cleared.sort(), ['bolt12', 'lightning_offer', 'lud12']);
  }) && ok;

  ok = run('setting bolt12 clears lud16/lud06 (and vice versa)', () => {
    const existing = { lud16: 'alice@x.com', lud06: 'LNURL...', picture: 'http://img' };
    const { content, field, cleared } = buildReceivingContent({
      profile: existing, method: 'bolt12', value: 'lno1pqps7sjqpgtyzm3q', pubkeyHex: A,
    });
    assert.strictEqual(field, 'bolt12');
    assert.strictEqual(content.bolt12, 'lno1pqps7sjqpgtyzm3q');
    assert.strictEqual(content.lud16, undefined);
    assert.strictEqual(content.lud06, undefined);
    assert.strictEqual(content.picture, 'http://img');
    assert.deepStrictEqual(cleared.sort(), ['lud06', 'lud16']);
  }) && ok;

  ok = run('npub-cash derives lud16 and clears any prior bolt12', () => {
    const { content, field, value } = buildReceivingContent({
      profile: { bolt12: 'lno1abcdefghij' }, method: 'npub-cash', pubkeyHex: A,
    });
    assert.strictEqual(field, 'lud16');
    assert.ok(value.endsWith('@npub.cash'));
    assert.strictEqual(content.lud16, value);
    assert.strictEqual(content.bolt12, undefined);
  }) && ok;

  ok = run('strips server-derived fields from content', () => {
    const out = mergeReceivingField(
      { name: 'A', pubkey: A, created_at: 123, id: 'eventid', sig: 'sig', kind: 0, tags: [] },
      'lud16', 'a@b.com',
    );
    assert.strictEqual(out.name, 'A');
    for (const f of ['pubkey', 'created_at', 'id', 'sig', 'kind', 'tags']) {
      assert.strictEqual(out[f], undefined, `${f} should be stripped`);
    }
  }) && ok;

  ok = run('handles null/empty existing profile', () => {
    const { content, field } = buildReceivingContent({ profile: null, method: 'npub-cash', pubkeyHex: A });
    assert.strictEqual(field, 'lud16');
    assert.ok(content.lud16.endsWith('@npub.cash'));
  }) && ok;

  ok = run('unknown method / invalid value throw', () => {
    assert.throws(() => buildReceivingContent({ profile: {}, method: 'nope', pubkeyHex: A }));
    assert.throws(() => buildReceivingContent({ profile: {}, method: 'address', value: 'bad', pubkeyHex: A }));
    assert.throws(() => buildReceivingContent({ profile: {}, method: 'bolt12', value: 'notanoffer', pubkeyHex: A }));
  }) && ok;

  return ok;
}

// ---- fedimint: it's just a lud16 address; reject fed11… invite codes --------

function testFedimint() {
  let ok = true;
  ok = run("fedimint option writes the lud16 field (it's an address, not a protocol)", () => {
    assert.strictEqual(getOption('fedimint').field, 'lud16');
    const { content, field } = buildReceivingContent({
      profile: {}, method: 'fedimint', value: 'alice@fedi.example.com', pubkeyHex: A,
    });
    assert.strictEqual(field, 'lud16');
    assert.strictEqual(content.lud16, 'alice@fedi.example.com');
  }) && ok;
  ok = run('a federation INVITE CODE (fed11…) is rejected by fedimint and address', () => {
    const fed11 = 'fed11qgqzc2nhwden5te0vejkg6tdd9h8gepwvejkg6tdd9h8garhduhx6at5d9h8jmn9wshxxmmd';
    assert.throws(() => buildReceivingContent({ profile: {}, method: 'fedimint', value: fed11, pubkeyHex: A }), /Lightning address/);
    assert.throws(() => buildReceivingContent({ profile: {}, method: 'address', value: fed11, pubkeyHex: A }), /Lightning address/);
  }) && ok;
  ok = run('switching fedimint→ keeps replace semantics (clears a prior bolt12)', () => {
    const { content } = buildReceivingContent({
      profile: { bolt12: 'lno1abcdefghij' }, method: 'fedimint', value: 'gw@fedimint.example.org', pubkeyHex: A,
    });
    assert.strictEqual(content.lud16, 'gw@fedimint.example.org');
    assert.strictEqual(content.bolt12, undefined);
  }) && ok;
  return ok;
}

// ---- precedence + tracked/untracked (Finding 3) ----------------------------

function testPrecedence() {
  let ok = true;
  ok = run('bolt12 wins over lud16 (matches zap.js), reported untracked', () => {
    const m = resolveReceivingMethod({ bolt12: 'lno1pqps7sjqpgtyzm3q', lud16: 'a@b.com' });
    assert.strictEqual(m.method, 'bolt12');
    assert.strictEqual(m.tracked, false);
  }) && ok;
  ok = run('lud16 alone resolves tracked', () => {
    const m = resolveReceivingMethod({ lud16: 'a@b.com' });
    assert.strictEqual(m.method, 'lud16');
    assert.strictEqual(m.tracked, true);
  }) && ok;
  ok = run('no method resolves null', () => {
    assert.strictEqual(resolveReceivingMethod({ name: 'x' }), null);
    assert.strictEqual(resolveReceivingMethod(null), null);
  }) && ok;
  ok = run('resolvePayment mirrors the issuer decision', () => {
    assert.deepStrictEqual(resolvePayment({ bolt12: 'lno1pqps7sjqpgtyzm3q' }),
      { type: 'bolt12', payload: 'lno1pqps7sjqpgtyzm3q', static: true, tracked: false });
    assert.deepStrictEqual(resolvePayment({ lud16: 'a@b.com' }),
      { type: 'bolt11', lud16: 'a@b.com', tracked: true });
    assert.strictEqual(resolvePayment({}).type, 'none');
  }) && ok;
  return ok;
}

// ---- LNURL as a receiving method: build → resolve → precedence -------------

function testLnurlReceiving() {
  let ok = true;

  ok = run('build lnurl writes lud06 (bare lnurl1…) and clears bolt12/lud16', () => {
    const existing = { name: 'Carol', bolt12: 'lno1abcdefghij', lud16: 'carol@x.com' };
    const { content, field, value, cleared } = buildReceivingContent({
      profile: existing, method: 'lnurl', value: 'lightning:' + GOOD_LNURL.toUpperCase(), pubkeyHex: A,
    });
    assert.strictEqual(field, 'lud06');
    assert.strictEqual(value, GOOD_LNURL);           // normalized: prefix stripped, lowercased
    assert.strictEqual(content.lud06, GOOD_LNURL);
    assert.strictEqual(content.bolt12, undefined);
    assert.strictEqual(content.lud16, undefined);
    assert.strictEqual(content.name, 'Carol');       // non-receiving field survives
    assert.deepStrictEqual(cleared.sort(), ['bolt12', 'lud16']);
  }) && ok;

  ok = run('build lnurl rejects a malformed code', () => {
    assert.throws(() => buildReceivingContent({ profile: {}, method: 'lnurl', value: BROKEN_LNURL, pubkeyHex: A }), /LNURL-pay code/);
    assert.throws(() => buildReceivingContent({ profile: {}, method: 'lnurl', value: 'alice@x.com', pubkeyHex: A }), /LNURL-pay code/);
  }) && ok;

  ok = run('setting bolt12 later clears a prior lud06 LNURL', () => {
    const { content, cleared } = buildReceivingContent({
      profile: { lud06: GOOD_LNURL }, method: 'bolt12', value: 'lno1pqps7sjqpgtyzm3q', pubkeyHex: A,
    });
    assert.strictEqual(content.bolt12, 'lno1pqps7sjqpgtyzm3q');
    assert.strictEqual(content.lud06, undefined);
    assert.ok(cleared.includes('lud06'));
  }) && ok;

  ok = run("resolveReceivingMethod reports 'lnurl' (tracked unknown until probed)", () => {
    const m = resolveReceivingMethod({ lud06: GOOD_LNURL });
    assert.strictEqual(m.method, 'lnurl');
    assert.strictEqual(m.field, 'lud06');
    assert.strictEqual(m.value, GOOD_LNURL);
    assert.strictEqual(m.tracked, null);             // not assumable from the code alone
  }) && ok;

  ok = run('precedence: bolt12 wins over an LNURL', () => {
    const m = resolveReceivingMethod({ bolt12: 'lno1pqps7sjqpgtyzm3q', lud06: GOOD_LNURL });
    assert.strictEqual(m.method, 'bolt12');
  }) && ok;

  ok = run('precedence: a real lud16 address wins over an LNURL in lud06', () => {
    const m = resolveReceivingMethod({ lud16: 'alice@walletofsatoshi.com', lud06: GOOD_LNURL });
    assert.strictEqual(m.method, 'lud16');
    assert.strictEqual(m.value, 'alice@walletofsatoshi.com');
  }) && ok;

  ok = run('an LNURL mis-placed in lud16 still resolves as lnurl', () => {
    const m = resolveReceivingMethod({ lud16: GOOD_LNURL });
    assert.strictEqual(m.method, 'lnurl');
    assert.strictEqual(m.field, 'lud16');
  }) && ok;

  ok = run('resolvePayment for an LNURL → bolt11 via lnurl, tracked unknown', () => {
    assert.deepStrictEqual(resolvePayment({ lud06: GOOD_LNURL }),
      { type: 'bolt11', via: 'lnurl', source: GOOD_LNURL, tracked: null });
  }) && ok;

  return ok;
}

// ---- newest-by-created_at merge (Finding 1) --------------------------------

function testNewest() {
  let ok = true;
  ok = run('pickNewestEvent returns greatest created_at', () => {
    const ev = pickNewestEvent([
      { id: 'old', created_at: 100 },
      { id: 'new', created_at: 300 },
      { id: 'mid', created_at: 200 },
    ]);
    assert.strictEqual(ev.id, 'new');
    assert.strictEqual(pickNewestEvent([]), null);
  }) && ok;
  ok = run('mergeNewestByPubkey: fresh local beats stale external per pubkey', () => {
    const B = 'b'.repeat(64);
    const latest = mergeNewestByPubkey([
      { pubkey: A, created_at: 100, content: '{"bolt12":"stale"}' },   // stale external
      { pubkey: A, created_at: 500, content: '{"lud16":"fresh@x"}' },  // fresh local
      { pubkey: B, created_at: 50, content: '{"name":"bob"}' },
    ]);
    assert.strictEqual(latest.get(A).created_at, 500);
    assert.strictEqual(latest.get(A).content, '{"lud16":"fresh@x"}');
    assert.strictEqual(latest.get(B).created_at, 50);
  }) && ok;
  return ok;
}

// ---- catalog sanity --------------------------------------------------------

function testCatalog() {
  let ok = true;
  ok = run('catalog: exactly one default; bolt12 untracked; npub-cash tracked', () => {
    assert.strictEqual(WALLET_OPTIONS.filter(o => o.isDefault).length, 1);
    assert.strictEqual(getOption('bolt12').tracked, false);
    assert.strictEqual(getOption('npub-cash').tracked, true);
    assert.strictEqual(getOption('npub-cash').isDefault, true);
  }) && ok;
  return ok;
}

console.log('Running receiving (Phase 1) tests…\n');
const suites = [
  ['Validators', testValidators],
  ['LNURL (lud06) decode + validation', testLnurl],
  ['npub.cash derivation', testNpubCash],
  ['Replace semantics (Finding 2)', testReplaceSemantics],
  ['Fedimint = lud16; reject fed11…', testFedimint],
  ['Precedence + tracked (Finding 3)', testPrecedence],
  ['LNURL receiving: build → resolve → precedence', testLnurlReceiving],
  ['Newest-by-created_at (Finding 1)', testNewest],
  ['Option catalog', testCatalog],
];

let allPass = true;
for (const [title, fn] of suites) {
  console.log(title + ':');
  const pass = fn();
  allPass = allPass && pass;
  console.log('');
}

console.log('-------------');
console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
