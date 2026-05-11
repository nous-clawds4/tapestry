/**
 * Basic test for Brainstorm
 * 
 * This is a simple test to verify that the package is working correctly.
 * In a real-world scenario, you would use a testing framework like Jest or Mocha.
 */

const assert = require('assert');
const { loadConfig } = require('../lib/config');
const { normalizeBountyCreatePayload } = require('../src/lib/bounty-fields');

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
      bountyCapSats: 5000,
      criteria: 'Useful list items',
    });
    assert.strictEqual(base.rewardPerItem, false);
    assert.strictEqual(base.maxRewardsPerNpub, null);
    assert.strictEqual(base.bountyCapSats, 5000);

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
      criteria: 'Missing cap',
    }), /bountyCapSats/);
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

// Run tests
console.log('Running Brainstorm tests...');
const configTest = testConfigLoading();
const bountyFieldsTest = testBountyFieldValidation();

console.log('\nTest Results:');
console.log('-------------');
console.log(`Configuration Loading: ${configTest ? 'PASS' : 'FAIL'}`);
console.log(`Bounty Field Validation: ${bountyFieldsTest ? 'PASS' : 'FAIL'}`);
console.log(`Overall: ${configTest && bountyFieldsTest ? 'PASS' : 'FAIL'}`);

// Exit with appropriate code
process.exit(configTest && bountyFieldsTest ? 0 : 1);
