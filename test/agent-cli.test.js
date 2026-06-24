const assert = require('assert');
const { generateSecretKey, getPublicKey, verifyEvent } = require('nostr-tools');
const {
  parseArgs,
  buildNegotiationEvent,
  parseNegotiation,
  NEGOTIATION_KIND,
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

console.log(`\n${passed} agent-cli tests passed`);
