const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brainstorm-judge-'));
process.env.BOUNTIES_DB_PATH = path.join(tmpDir, 'bounties.db');
process.env.AGENT_AUDIT_PATH = path.join(tmpDir, 'audit.jsonl');
delete process.env.AGENT_JUDGE_MIN_CONFIDENCE; // use the 0.6 default

const { evaluateJudgment } = require('../src/lib/operatorJudgment');
const { appendAudit, latestJudgment, readAudit } = require('../src/lib/agentAudit');

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`  ok  ${name}`); }

test('only a confident accept authorizes payment (fail-closed)', () => {
  assert.strictEqual(evaluateJudgment({ decision: 'accept', confidence: 1 }).pay, true);
  assert.strictEqual(evaluateJudgment({ decision: 'accept' }).pay, true);         // default conf 1
  assert.strictEqual(evaluateJudgment({ decision: 'accept', confidence: 0.7 }).pay, true);
  assert.strictEqual(evaluateJudgment({ decision: 'accept', confidence: 0.5 }).pay, false); // < 0.6
  assert.strictEqual(evaluateJudgment({ decision: 'reject', confidence: 1 }).pay, false);
  assert.strictEqual(evaluateJudgment({ decision: 'maybe' }).pay, false);          // malformed
  assert.strictEqual(evaluateJudgment({ decision: 'maybe' }).valid, false);
});

test('latestJudgment returns the newest judgment for a claim', () => {
  appendAudit({ kind: 'judgment', bountyId: 'b1', claimEventId: 'c1', decision: 'reject', pay: false });
  appendAudit({ kind: 'judgment', bountyId: 'b1', claimEventId: 'c1', decision: 'accept', pay: true });
  appendAudit({ kind: 'judgment', bountyId: 'b1', claimEventId: 'c2', decision: 'reject', pay: false });

  const j = latestJudgment('b1', 'c1');
  assert.strictEqual(j.decision, 'accept');
  assert.strictEqual(j.pay, true);
  assert.strictEqual(latestJudgment('b1', 'c2').pay, false);
  assert.strictEqual(latestJudgment('b1', 'nope'), null);
});

test('dry-run payment audit never carries a pay-authorizing flag', () => {
  appendAudit({ kind: 'dry_run_payment', bountyId: 'b1', claimEventId: 'c9', amountSats: 100 });
  const rows = readAudit({ kind: 'dry_run_payment', claimEventId: 'c9' });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].pay, undefined); // dry-run is advisory, not a yes
});

console.log(`\n${passed} operator-judgment tests passed`);
