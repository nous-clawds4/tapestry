const assert = require('assert');
const { EventEmitter } = require('events');
const { fetchZapReceipt, importEventToStrfry, bridgeZapReceipt } = require('../src/lib/zap-bridge');

const CLAIM_ID = 'a'.repeat(64);

// Minimal fake relay socket: emits REQ-driven EVENTs the test queues up.
function fakeWs(scripted) {
  const ws = new EventEmitter();
  ws.send = () => {
    // Respond on next tick as a real relay would after receiving the REQ.
    for (const ev of scripted) {
      process.nextTick(() => ws.emit('message', Buffer.from(JSON.stringify(ev))));
    }
  };
  ws.close = () => {};
  process.nextTick(() => ws.emit('open'));
  return ws;
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

(async () => {
  await test('resolves the matching kind-9735 e-tagging the claim', async () => {
    const receipt = { id: 'r1', kind: 9735, tags: [['e', CLAIM_ID]] };
    const result = await fetchZapReceipt({
      claimId: CLAIM_ID,
      relays: ['wss://relay.test'],
      timeoutMs: 1000,
      wsFactory: () => fakeWs([['EVENT', `zb-${CLAIM_ID.slice(0, 16)}`, receipt]]),
    });
    assert.strictEqual(result?.id, 'r1');
  });

  await test('ignores non-9735 and wrong-sub messages, then times out to null', async () => {
    const result = await fetchZapReceipt({
      claimId: CLAIM_ID,
      relays: ['wss://relay.test'],
      timeoutMs: 150,
      wsFactory: () => fakeWs([
        ['EVENT', 'other-sub', { kind: 9735 }],
        ['EVENT', `zb-${CLAIM_ID.slice(0, 16)}`, { kind: 1 }],
        ['EOSE', `zb-${CLAIM_ID.slice(0, 16)}`],
      ]),
    });
    assert.strictEqual(result, null);
  });

  await test('returns null with no relays (nothing to subscribe to)', async () => {
    assert.strictEqual(await fetchZapReceipt({ claimId: CLAIM_ID, relays: [] }), null);
  });

  await test('importEventToStrfry frames the event as one JSON line on stdin', async () => {
    let stdinData = '';
    const fakeChild = { stdin: { write: (d) => { stdinData += d; }, end: () => {} } };
    const execImpl = (cmd, opts, cb) => { process.nextTick(() => cb(null)); return fakeChild; };
    await importEventToStrfry({ id: 'x', kind: 9735 }, { execImpl });
    assert.strictEqual(stdinData, '{"id":"x","kind":9735}\n');
  });

  await test('bridgeZapReceipt fetches then imports, returning the receipt', async () => {
    const receipt = { id: 'r2', kind: 9735, tags: [['e', CLAIM_ID]] };
    let imported = null;
    const fakeChild = { stdin: { write: (d) => { imported = d; }, end: () => {} } };
    const result = await bridgeZapReceipt({
      claimId: CLAIM_ID,
      relays: ['wss://relay.test'],
      timeoutMs: 1000,
      wsFactory: () => fakeWs([['EVENT', `zb-${CLAIM_ID.slice(0, 16)}`, receipt]]),
      execImpl: (cmd, opts, cb) => { process.nextTick(() => cb(null)); return fakeChild; },
    });
    assert.strictEqual(result?.id, 'r2');
    assert.ok(imported.includes('"r2"'));
  });

  console.log(`\n${passed} zap-bridge tests passed`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
