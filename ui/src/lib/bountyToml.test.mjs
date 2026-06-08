/**
 * Tests for the bounty TOML drop-in helpers. Plain node + assert, matching the
 * repo's test style. Run: `node src/lib/bountyToml.test.mjs` (from ui/).
 *
 * Mirrors the constraints in src/lib/bounty-fields.js so the client-side parse
 * fails the same way the server would, just sooner and friendlier.
 */

import assert from 'node:assert';
import { parseBountyToml, buildClaudePrompt, buildClaudeDeepLink } from './bountyToml.js';

const PK = 'a'.repeat(64);
const coord = (d = 'd') => `39998:${PK}:${d}`;
let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

test('valid array of two bounties, fenced, with defaults', () => {
  const src = [
    '```toml',
    '[[bounty]]',
    `list_coordinate = "${coord('dwarfs')}"`,
    'base_reward_sats = 1000',
    'bounty_cap_sats = 5000',
    'reward_per_item = true',
    'max_rewards_per_npub = 3',
    'criteria = "Sleepy dwarfs"',
    'expiration = 2026-07-01T00:00:00Z',
    '',
    '[[bounty]]',
    `list_coordinate = "${coord('books')}"`,
    'base_reward_sats = 500',
    'criteria = "Book recs"',
    '```',
  ].join('\n');
  const { bounties, errors } = parseBountyToml(src);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(bounties.length, 2);
  assert.strictEqual(bounties[0].amountSats, 1000);
  assert.strictEqual(bounties[0].rewardPerItem, true);
  assert.strictEqual(bounties[0].maxRewardsPerNpub, 3);
  assert.strictEqual(typeof bounties[0].expiration, 'number');
  // cap defaults to base reward when omitted
  assert.strictEqual(bounties[1].bountyCapSats, 500);
});

test('bare top-level table with API-name aliases', () => {
  const { bounties, errors } = parseBountyToml(`listCoordinate = "${coord()}"\namountSats = 7\ncriteria = "x"`);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(bounties.length, 1);
  assert.strictEqual(bounties[0].amountSats, 7);
  assert.strictEqual(bounties[0].bountyCapSats, 7);
  assert.strictEqual(bounties[0].rewardPerItem, false);
});

test('quoted ISO-8601 expiration string parses to unix seconds', () => {
  const { bounties } = parseBountyToml(
    `[[bounty]]\nlist_coordinate = "${coord()}"\nbase_reward_sats = 1\ncriteria = "x"\nexpiration = "2026-08-01T00:00:00Z"`
  );
  assert.strictEqual(bounties[0].expiration, Math.floor(Date.parse('2026-08-01T00:00:00Z') / 1000));
});

test('rejects a malformed coordinate', () => {
  const { bounties, errors } = parseBountyToml('[[bounty]]\nlist_coordinate = "nope"\nbase_reward_sats = 1\ncriteria = "x"');
  assert.strictEqual(bounties.length, 0);
  assert.match(errors[0], /list_coordinate/);
});

test('rejects cap below base reward', () => {
  const { errors } = parseBountyToml(`[[bounty]]\nlist_coordinate = "${coord()}"\nbase_reward_sats = 100\nbounty_cap_sats = 50\ncriteria = "x"`);
  assert.match(errors[0], /greater than or equal/);
});

test('rejects max_rewards_per_npub without reward_per_item', () => {
  const { errors } = parseBountyToml(`[[bounty]]\nlist_coordinate = "${coord()}"\nbase_reward_sats = 1\nmax_rewards_per_npub = 2\ncriteria = "x"`);
  assert.match(errors[0], /only applies when reward_per_item/);
});

test('requires criteria', () => {
  const { errors } = parseBountyToml(`[[bounty]]\nlist_coordinate = "${coord()}"\nbase_reward_sats = 1`);
  assert.match(errors[0], /criteria is required/);
});

test('reports TOML syntax errors instead of throwing', () => {
  const { bounties, errors } = parseBountyToml('this is = = not toml');
  assert.strictEqual(bounties.length, 0);
  assert.match(errors[0], /TOML syntax error/);
});

test('labels errors per-bounty when several tables are present', () => {
  const { errors } = parseBountyToml(
    `[[bounty]]\nlist_coordinate = "${coord()}"\nbase_reward_sats = 1\ncriteria = "ok"\n\n[[bounty]]\nlist_coordinate = "bad"\nbase_reward_sats = 1\ncriteria = "x"`
  );
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /^Bounty 2:/);
});

test('deep link round-trips the prompt and includes list coordinates', () => {
  const prompt = buildClaudePrompt([{ coordinate: coord('mylist'), name: 'My List' }]);
  assert.match(prompt, new RegExp(coord('mylist')));
  const link = buildClaudeDeepLink(prompt);
  assert.ok(link.startsWith('https://claude.ai/new?q='));
  assert.strictEqual(decodeURIComponent(link.split('?q=')[1]), prompt);
});

console.log(`\n${passed} passed`);
