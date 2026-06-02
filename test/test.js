/**
 * Basic test for Brainstorm
 * 
 * This is a simple test to verify that the package is working correctly.
 * In a real-world scenario, you would use a testing framework like Jest or Mocha.
 */

const assert = require('assert');
const { loadConfig } = require('../lib/config');
const { normalizeBountyCreatePayload } = require('../src/lib/bounty-fields');
const {
  calculateBountyPaymentState,
  canAcceptNewClaimFrom,
} = require('../src/lib/bounty-policy');
const { _private: bountyApi } = require('../src/api/bounties');

// Mock environment variables for testing
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';

// Test configuration loading
function testConfigLoading() {
  try {
    const config = loadConfig();
    console.log('Configuration loaded successfully:', Object.keys(config));
    return true;
  } catch (error) {
    console.error('Configuration loading failed:', error.message);
    return false;
  }
}

function testBountyFieldValidation() {
  const listCoordinate = `39998:${'a'.repeat(64)}:sleepy-dwarfs`;
  try {
    const base = normalizeBountyCreatePayload({
      listCoordinate,
      amountSats: 1000,
      criteria: 'Useful list items',
    });
    assert.strictEqual(base.bountyCapSats, 1000);
    assert.strictEqual(base.rewardPerItem, false);
    assert.strictEqual(base.maxRewardsPerNpub, null);

    const perItem = normalizeBountyCreatePayload({
      listCoordinate,
      amountSats: 1000,
      bountyCapSats: 5000,
      rewardPerItem: true,
      maxRewardsPerNpub: 3,
      criteria: 'Useful list items',
    });
    assert.strictEqual(perItem.rewardPerItem, true);
    assert.strictEqual(perItem.maxRewardsPerNpub, 3);

    assert.throws(() => normalizeBountyCreatePayload({
      listCoordinate,
      amountSats: 1000,
      bountyCapSats: 999,
      criteria: 'Cap below base reward',
    }), /greater than or equal/);
    assert.throws(() => normalizeBountyCreatePayload({
      listCoordinate,
      amountSats: 1000,
      bountyCapSats: 5000,
      rewardPerItem: false,
      maxRewardsPerNpub: 3,
      criteria: 'Misplaced per-item cap',
    }), /only applies/);
    return true;
  } catch (error) {
    console.error('Bounty field validation failed:', error.message);
    return false;
  }
}

function claim(id, pubkey, createdAt, paid = false) {
  return {
    event: { id, pubkey, created_at: createdAt },
    zapReceipt: paid ? { id: `zap-${id}` } : null,
  };
}

function testBountyPaymentPolicy() {
  try {
    const alice = 'a'.repeat(64);
    const bob = 'b'.repeat(64);
    const carol = 'c'.repeat(64);
    const dave = 'd'.repeat(64);

    const onePerContributor = {
      amount_sats: 1000,
      bounty_cap_sats: 3000,
      reward_per_item: 0,
    };
    const state = calculateBountyPaymentState(onePerContributor, [
      claim('a1', alice, 1, true),
      claim('a2', alice, 2),
      claim('b1', bob, 3),
      claim('c1', carol, 4),
      claim('d1', dave, 5),
    ]);
    assert.strictEqual(state.fulfilled, false);
    assert.strictEqual(state.paidRewardCount, 1);
    assert.deepStrictEqual(state.payableClaims.map(c => c.event.id), ['b1', 'c1']);
    assert.deepStrictEqual(state.closedClaims.map(c => [c.event.id, c.closedReason]), [
      ['a2', 'contributor'],
      ['d1', 'cap'],
    ]);
    assert.strictEqual(canAcceptNewClaimFrom(state, bob), false);

    const fulfilled = calculateBountyPaymentState(onePerContributor, [
      claim('a1', alice, 1, true),
      claim('b1', bob, 2, true),
      claim('c1', carol, 3, true),
      claim('d1', dave, 4),
    ]);
    assert.strictEqual(fulfilled.fulfilled, true);
    assert.strictEqual(fulfilled.payableClaims.length, 0);
    assert.strictEqual(fulfilled.closedClaims[0].closedReason, 'cap');

    const perItem = calculateBountyPaymentState({
      amount_sats: 1000,
      bounty_cap_sats: 5000,
      reward_per_item: 1,
      max_rewards_per_npub: 2,
    }, [
      claim('a1', alice, 1, true),
      claim('a2', alice, 2),
      claim('a3', alice, 3),
      claim('b1', bob, 4),
    ]);
    assert.deepStrictEqual(perItem.payableClaims.map(c => c.event.id), ['a2', 'b1']);
    assert.deepStrictEqual(perItem.closedClaims.map(c => [c.event.id, c.closedReason]), [
      ['a3', 'contributor'],
    ]);
    return true;
  } catch (error) {
    console.error('Bounty payment policy failed:', error.message);
    return false;
  }
}

function testEligibleBountyFiltering() {
  try {
    const viewer = 'a'.repeat(64);
    assert.strictEqual(bountyApi.isOwnBounty({ issuer_pubkey: viewer }, viewer), true);
    assert.strictEqual(bountyApi.isOwnBounty({ issuer_pubkey: viewer.toUpperCase() }, viewer), true);
    assert.strictEqual(bountyApi.isOwnBounty({ issuer_pubkey: 'b'.repeat(64) }, viewer), false);
    assert.strictEqual(bountyApi.isOwnBounty({}, viewer), false);
    return true;
  } catch (error) {
    console.error('Eligible bounty filtering failed:', error.message);
    return false;
  }
}

// Run tests
console.log('Running Brainstorm tests...');
const configTest = testConfigLoading();
const bountyFieldsTest = testBountyFieldValidation();
const bountyPolicyTest = testBountyPaymentPolicy();
const eligibleBountyFilteringTest = testEligibleBountyFiltering();

console.log('\nTest Results:');
console.log('-------------');
console.log(`Configuration Loading: ${configTest ? 'PASS' : 'FAIL'}`);
console.log(`Bounty Field Validation: ${bountyFieldsTest ? 'PASS' : 'FAIL'}`);
console.log(`Bounty Payment Policy: ${bountyPolicyTest ? 'PASS' : 'FAIL'}`);
console.log(`Eligible Bounty Filtering: ${eligibleBountyFilteringTest ? 'PASS' : 'FAIL'}`);
console.log(`Overall: ${configTest && bountyFieldsTest && bountyPolicyTest && eligibleBountyFilteringTest ? 'PASS' : 'FAIL'}`);

// Exit with appropriate code
process.exit(configTest && bountyFieldsTest && bountyPolicyTest && eligibleBountyFilteringTest ? 0 : 1);
