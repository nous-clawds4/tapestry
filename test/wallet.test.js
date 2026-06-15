const assert = require('assert');

const { getBalance, payBolt11, walletCliPath } = require('../src/lib/wallet');

// Stub execFile factory: records the call, invokes the callback with canned
// (err, stdout, stderr) like child_process.execFile would.
function stubExec(err, stdout, stderr) {
  const calls = [];
  const impl = (file, args, options, cb) => {
    calls.push({ file, args, options });
    process.nextTick(() => cb(err, stdout || '', stderr || ''));
  };
  impl.calls = calls;
  return impl;
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    throw err;
  }
}

(async () => {
  await test('payBolt11 parses the send JSON and passes the invoice through', async () => {
    const exec = stubExec(null, JSON.stringify({
      payment_id: 'pay_1',
      payment_hash: 'f'.repeat(64),
      status: 'completed',
      preimage: 'e'.repeat(64),
    }));
    const result = await payBolt11('  lnbc10n1demo  ', { execFileImpl: exec });
    assert.strictEqual(result.status, 'completed');
    assert.strictEqual(result.preimage, 'e'.repeat(64));
    assert.strictEqual(exec.calls.length, 1);
    assert.strictEqual(exec.calls[0].file, walletCliPath());
    assert.deepStrictEqual(exec.calls[0].args, ['send', 'lnbc10n1demo']);
    assert.strictEqual(typeof exec.calls[0].options.timeout, 'number');
  });

  await test('payBolt11 skips log noise and parses the last JSON stdout line', async () => {
    const exec = stubExec(null, 'starting daemon...\n{"status":"completed","preimage":null}\n');
    const result = await payBolt11('lnbc10n1demo', { execFileImpl: exec });
    assert.strictEqual(result.status, 'completed');
    assert.strictEqual(result.preimage, null);
  });

  await test('payBolt11 surfaces the CLI stderr error JSON on nonzero exit', async () => {
    const err = Object.assign(new Error('Command failed'), { code: 1 });
    const exec = stubExec(err, '', JSON.stringify({ error: 'Payment pay_1 failed' }));
    await assert.rejects(
      payBolt11('lnbc10n1demo', { execFileImpl: exec }),
      /agent-wallet send failed: Payment pay_1 failed/,
    );
  });

  await test('payBolt11 reports a timeout when the CLI is killed', async () => {
    const err = Object.assign(new Error('killed'), { killed: true, signal: 'SIGKILL' });
    const exec = stubExec(err, '', '');
    await assert.rejects(
      payBolt11('lnbc10n1demo', { execFileImpl: exec }),
      /agent-wallet send timed out/,
    );
  });

  await test('payBolt11 rejects a missing or blank invoice without spawning', async () => {
    const exec = stubExec(null, '{}');
    await assert.rejects(payBolt11('', { execFileImpl: exec }), /invoice is required/);
    await assert.rejects(payBolt11(null, { execFileImpl: exec }), /invoice is required/);
    assert.strictEqual(exec.calls.length, 0);
  });

  await test('payBolt11 rejects when the CLI exits clean with no JSON', async () => {
    const exec = stubExec(null, 'not json at all');
    await assert.rejects(
      payBolt11('lnbc10n1demo', { execFileImpl: exec }),
      /returned no JSON output/,
    );
  });

  await test('getBalance parses balance_sats', async () => {
    const exec = stubExec(null, '{"balance_sats":50000}');
    const result = await getBalance({ execFileImpl: exec });
    assert.strictEqual(result.balance_sats, 50000);
    assert.deepStrictEqual(exec.calls[0].args, ['balance']);
  });

  await test('getBalance surfaces a not-initialized error', async () => {
    const err = Object.assign(new Error('Command failed'), { code: 1 });
    const exec = stubExec(err, '', '{"error":"Not initialized. Run: npx @moneydevkit/agent-wallet init"}');
    await assert.rejects(getBalance({ execFileImpl: exec }), /Not initialized/);
  });

  console.log(`\n${passed} wallet tests passed`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
