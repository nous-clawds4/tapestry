const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateSecretKey, getPublicKey, verifyEvent } = require('nostr-tools');
const {
  parseArgs,
  buildBountyCreateBody,
  buildNegotiationEvent,
  parseNegotiation,
  NEGOTIATION_KIND,
  provisionDelegate,
  resetClaim,
  NEGOTIATION_TOPIC,
} = require('../bin/agent');

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`  ok  ${name}`); }

test('parseArgs handles --flag value, --flag=value, boolean, positionals', () => {
  const { _, flags } = parseArgs(['scan', '--bounty', 'b1', '--message=hi there', '--dry-run']);
  assert.deepStrictEqual(_, ['scan']);
  assert.strictEqual(flags.bounty, 'b1');
  assert.strictEqual(flags.message, 'hi there');
  assert.strictEqual(flags['dry-run'], true);
});

test('create-bounty body: minimal flags produce a plain non-auto-pay bounty', () => {
  const coord = `39998:${'a'.repeat(64)}:dogs`;
  const body = buildBountyCreateBody({ list: coord, amount: '100', criteria: 'Submit a dog breed.' });
  assert.deepStrictEqual(body, { listCoordinate: coord, amountSats: 100, criteria: 'Submit a dog breed.' });
  assert.ok(!('autoPay' in body), 'autoPay must be absent unless requested');
});

test('create-bounty body: --auto-pay and --min-rank pass through (server enforces allowlist)', () => {
  const coord = `39998:${'a'.repeat(64)}:dogs`;
  const body = buildBountyCreateBody({
    list: coord, amount: '100', cap: '500', criteria: 'Submit a dog breed.',
    'reward-per-item': true, 'max-rewards': '1', 'auto-pay': true, 'min-rank': '3',
  });
  assert.strictEqual(body.autoPay, true);
  assert.strictEqual(body.autoPayMinRank, 3);
  assert.strictEqual(body.rewardPerItem, true);
  assert.strictEqual(body.maxRewardsPerNpub, 1);
  assert.strictEqual(body.bountyCapSats, 500);
});

test('create-bounty body: --min-rank without --auto-pay is rejected', () => {
  assert.throws(
    () => buildBountyCreateBody({ list: `39998:${'a'.repeat(64)}:dogs`, amount: '100', criteria: 'c', 'min-rank': '3' }),
    /--min-rank only applies with --auto-pay/
  );
});

test('create-bounty body: bare --amount (boolean true) is rejected, not posted as 1 sat', () => {
  assert.throws(
    () => buildBountyCreateBody({ list: `39998:${'a'.repeat(64)}:dogs`, amount: true, criteria: 'c' }),
    /--amount must be a positive integer/
  );
});

test('negotiation envelope is a valid signed kind-1111 carrying bountyId + queryable anchors', () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const listCoordinate = `30000:${'a'.repeat(64)}:dogs`;
  const event = buildNegotiationEvent({
    sk,
    bountyId: 'bounty-123',
    listCoordinate,
    offerKind: 'counter',
    scope: 'add 5 breeds',
    deadline: '2026-07-01',
    message: 'can do',
  });
  assert.strictEqual(event.kind, NEGOTIATION_KIND);
  assert.strictEqual(event.pubkey, pk);
  assert.ok(verifyEvent(event), 'event must be validly signed');
  // queryable single-letter anchors a relay will index:
  assert.ok(event.tags.some(t => t[0] === 'a' && t[1] === listCoordinate));
  assert.ok(event.tags.some(t => t[0] === 't' && t[1] === NEGOTIATION_TOPIC));
  // bountyId disambiguates multiple bounties on one coordinate:
  assert.ok(event.tags.some(t => t[0] === 'bountyId' && t[1] === 'bounty-123'));
});

test('parseNegotiation round-trips the envelope content + bountyId tag', () => {
  const sk = generateSecretKey();
  const event = buildNegotiationEvent({
    sk,
    bountyId: 'bounty-xyz',
    listCoordinate: `30000:${'b'.repeat(64)}:cats`,
    offerKind: 'accept',
    message: 'deal',
  });
  const parsed = parseNegotiation(event);
  assert.strictEqual(parsed.bountyId, 'bounty-xyz');
  assert.strictEqual(parsed.offerKind, 'accept');
  assert.strictEqual(parsed.message, 'deal');
  assert.strictEqual(parsed.eventId, event.id);
});

test('delegate provisioning reuses each issuer-specific delegate', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-delegate-'));
  process.env.BOUNTIES_DB_PATH = path.join(directory, 'bounties.db');
  process.env.RELAY_KEY_MASTER_KEY = 'delegate-provision-test-key';
  const issuerA = 'a'.repeat(64);
  const issuerB = 'b'.repeat(64);
  const firstA = provisionDelegate(issuerA);
  const firstB = provisionDelegate(issuerB);
  const secondA = provisionDelegate(issuerA);
  const { getDelegatePubkey } = require('../src/db/autoPay');

  assert.equal(firstA.reused, false);
  assert.equal(secondA.reused, true);
  assert.equal(secondA.delegatePubkey, firstA.delegatePubkey);
  assert.equal(getDelegatePubkey(issuerB), firstB.delegatePubkey);
  assert.notEqual(firstA.delegatePubkey, firstB.delegatePubkey);
});

(async () => {
  let request;
  const result = await resetClaim({ bounty: 'bounty-1', claim: 'c'.repeat(64), force: true }, async (method, route, options) => {
    request = { method, route, options };
    return { success: true, reset: true };
  });
  assert.deepStrictEqual(request, {
    method: 'POST',
    route: '/api/bounties/auto-pay/reset',
    options: {
      body: { bountyId: 'bounty-1', claimEventId: 'c'.repeat(64), force: true },
      useCookie: true,
    },
  });
  assert.equal(result.ok, true);
  passed += 1;
  console.log('  ok  reset scopes the request by bounty and claim');
  console.log(`\n${passed} agent-cli tests passed`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
