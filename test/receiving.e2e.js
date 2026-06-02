/**
 * CLI end-to-end test for bin/receiving.js — the proof the plan's "CLI-first"
 * approach is meant to give: drive the actual binary through the full
 * sign → publish → read-back → resolve loop and assert every rev. 2 finding.
 *
 * Hermetic: a local mock relay (test/support/mock-relay.js) stands in for the
 * profile relays and verifies signatures on the way in. `--no-local` skips the
 * strfry binary (not installed in CI / dev), so the loop runs entirely over a
 * controlled WebSocket. Each scenario spawns bin/receiving.js as a child
 * process — the same way a human or a script would run it.
 *
 * Run: `npm run test:receiving:e2e` (or `node test/receiving.e2e.js`).
 */

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { generateSecretKey, getPublicKey, finalizeEvent } = require('nostr-tools');
const { startMockRelay } = require('./support/mock-relay');

const CLI = path.join(__dirname, '..', 'bin', 'receiving.js');

// Canonical LUD-01 LNURL example (decodes to an https URL). Used to prove the
// `set lnurl` → kind-0 lud06 → resolve-as-lnurl loop end-to-end. --no-probe
// keeps it hermetic (no real LNURL fetch against service.com).
const GOOD_LNURL = 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns';

function hex(sk) { return Buffer.from(sk).toString('hex'); }

/**
 * Run the CLI as a child process. ASYNC on purpose: the mock relay runs in this
 * same process, so we must keep the event loop free (spawnSync would block it
 * and the relay could never answer the child). Returns { code, stdout, stderr, json }.
 */
function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args]);
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', (code) => {
      let json = null;
      if (stdout.trim().startsWith('{')) { try { json = JSON.parse(stdout); } catch {} }
      resolve({ code, stdout, stderr, json });
    });
  });
}

/** Build a signed kind-0 with explicit content + created_at (to seed stale events). */
function signKind0(skHex, content, createdAt) {
  const sk = Uint8Array.from(Buffer.from(skHex, 'hex'));
  return finalizeEvent({ kind: 0, created_at: createdAt, tags: [], content: JSON.stringify(content) }, sk);
}

let passed = 0, failed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { console.log(`  ✓ ${name}`); passed++; })
    .catch(err => { console.error(`  ✗ ${name}\n      ${err.message}`); failed++; });
}

async function main() {
  const NOW = Math.floor(Date.now() / 1000);

  // A pubkey with a STALE bolt12-only profile already on the relay (created_at in the past),
  // plus an unrelated profile, to prove newest-wins + that a switch is not masked.
  const skA = hex(generateSecretKey());
  const pkA = getPublicKey(Uint8Array.from(Buffer.from(skA, 'hex')));
  const staleA = signKind0(skA, { name: 'Alice', bolt12: 'lno1stalestalestalestale' }, NOW - 100000);

  const relay = await startMockRelay({ seedEvents: [staleA] });
  console.log(`mock relay listening at ${relay.url} (seeded 1 stale kind-0 for ${pkA.slice(0, 8)}…)\n`);

  // --no-probe keeps `set` hermetic (no real LNURL fetch); show/resolve ignore it unless --probe.
  const R = ['--relays', relay.url, '--no-local', '--no-probe'];

  console.log('CLI end-to-end (bin/receiving.js over a live relay):\n');

  // 1) set npub-cash → published to the relay (sig verified by relay) → show round-trips it.
  await check('set npub-cash publishes a valid kind-0 the relay accepts', async () => {
    const r = await runCli(['set', 'npub-cash', '--nsec', skA, ...R, '--json']);
    assert.strictEqual(r.code, 0, `exit ${r.code}; stderr=${r.stderr}`);
    assert.ok(r.json && r.json.ok, 'expected ok json');
    assert.strictEqual(r.json.field, 'lud16');
    assert.ok(r.json.value.endsWith('@npub.cash'), `value=${r.json.value}`);
    const accepted = r.json.relays.filter(x => x.success).length;
    assert.ok(accepted >= 1, `expected >=1 relay to accept; got ${JSON.stringify(r.json.relays)}`);
  });

  // 2) Finding 1: relay now holds BOTH the stale bolt12 event and the fresh lud16 event
  //    for pkA. `show` must return the FRESH lud16 (newest-wins), not the stale bolt12.
  await check('show resolves NEWEST profile, not the stale bolt12 (Finding 1)', async () => {
    const r = await runCli(['show', pkA, ...R, '--json']);
    assert.strictEqual(r.code, 0, `exit ${r.code}; stderr=${r.stderr}`);
    assert.ok(r.json.method, 'expected a resolved method');
    assert.strictEqual(r.json.method.method, 'lud16', `got ${r.json.method && r.json.method.method} — stale bolt12 masked the fresh write`);
    assert.strictEqual(r.json.method.tracked, true);
    assert.ok(r.json.createdAt > NOW - 100000, 'resolved event should be the fresh one');
  });

  // 3) Finding 2: switch BOLT12 → address sticks even though the old offer event lingers on the relay.
  const skB = hex(generateSecretKey());
  const pkB = getPublicKey(Uint8Array.from(Buffer.from(skB, 'hex')));
  await check('set bolt12 then show reports it untracked (Finding 3)', async () => {
    const set = await runCli(['set', 'bolt12', 'bitcoin:?lno=lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjz', '--nsec', skB, ...R, '--json']);
    assert.strictEqual(set.code, 0, `set bolt12 exit ${set.code}; stderr=${set.stderr}`);
    assert.strictEqual(set.json.field, 'bolt12');
    const show = await runCli(['show', pkB, ...R, '--json']);
    assert.strictEqual(show.json.method.method, 'bolt12');
    assert.strictEqual(show.json.method.tracked, false, 'bolt12 must report untracked');
  });

  // A fresh key with a STALE bolt12 already lingering on the relay (older created_at),
  // then a newer `set address`. The new lud16 must win over the lingering offer.
  const skD = hex(generateSecretKey());
  const pkD = getPublicKey(Uint8Array.from(Buffer.from(skD, 'hex')));
  relay.events.push(signKind0(skD, { name: 'Dana', bolt12: 'lno1lingeringoldofferxxxx' }, NOW - 50000));
  await check('switching to address beats a lingering older bolt12 (Findings 1+2)', async () => {
    const set = await runCli(['set', 'address', 'dana@walletofsatoshi.com', '--nsec', skD, ...R, '--json']);
    assert.strictEqual(set.code, 0, `set address exit ${set.code}; stderr=${set.stderr}`);
    assert.strictEqual(set.json.field, 'lud16');
    const show = await runCli(['show', pkD, ...R, '--json']);
    assert.strictEqual(show.json.method.method, 'lud16', 'lingering older bolt12 must NOT win after the newer address set');
    assert.strictEqual(show.json.method.value, 'dana@walletofsatoshi.com');
    assert.strictEqual(show.json.method.tracked, true);
  });

  // 3b) set lnurl → kind-0 lud06 → show resolves it as method 'lnurl' (tracked
  //     unknown until probed), and resolve reports a bolt11-via-lnurl payout.
  const skE = hex(generateSecretKey());
  const pkE = getPublicKey(Uint8Array.from(Buffer.from(skE, 'hex')));
  await check('set lnurl writes lud06 and show resolves it as lnurl (untracked-until-probed)', async () => {
    const set = await runCli(['set', 'lnurl', GOOD_LNURL, '--nsec', skE, ...R, '--json']);
    assert.strictEqual(set.code, 0, `set lnurl exit ${set.code}; stderr=${set.stderr}`);
    assert.strictEqual(set.json.field, 'lud06');
    assert.strictEqual(set.json.value, GOOD_LNURL);

    const show = await runCli(['show', pkE, ...R, '--json']);
    assert.strictEqual(show.json.method.method, 'lnurl');
    assert.strictEqual(show.json.method.field, 'lud06');
    assert.strictEqual(show.json.method.value, GOOD_LNURL);
    assert.strictEqual(show.json.method.tracked, null, 'lnurl tracked must be unknown until probed');

    const res = await runCli(['resolve', pkE, ...R, '--json']);
    assert.strictEqual(res.json.payment.type, 'bolt11');
    assert.strictEqual(res.json.payment.via, 'lnurl');
    assert.strictEqual(res.json.payment.source, GOOD_LNURL);
    assert.strictEqual(res.json.payment.tracked, null);
  });

  // (Switching lnurl → another method clearing lud06 is covered as pure logic in
  //  receiving.test.js — "setting bolt12 later clears a prior lud06 LNURL" — so we
  //  don't re-set the same key here, which would collide on created_at within the
  //  same wall-clock second and make newest-wins ambiguous.)

  // 4) resolve mirrors the issuer-side payout decision.
  await check('resolve reports BOLT12 untracked and BOLT11/LNURL tracked (Finding 3)', async () => {
    const rA = await runCli(['resolve', pkA, '--amount', '1000', ...R, '--json']);
    assert.strictEqual(rA.json.payment.type, 'bolt11', 'pkA set npub-cash → lud16 → bolt11');
    assert.strictEqual(rA.json.payment.tracked, true);

    const skC = hex(generateSecretKey());
    const pkC = getPublicKey(Uint8Array.from(Buffer.from(skC, 'hex')));
    await runCli(['set', 'bolt12', 'lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy', '--nsec', skC, ...R, '--json']);
    const rC = await runCli(['resolve', pkC, ...R, '--json']);
    assert.strictEqual(rC.json.payment.type, 'bolt12');
    assert.strictEqual(rC.json.payment.tracked, false, 'bolt12 payout must be untracked');
  });

  // 5) Finding 6: a --nsec whose pubkey ≠ --pubkey is rejected before publishing.
  await check('wrong-key set is rejected (Finding 6 — signer guard)', async () => {
    const wrong = '0'.repeat(64);
    const r = await runCli(['set', 'npub-cash', '--nsec', skA, '--pubkey', wrong, ...R]);
    assert.notStrictEqual(r.code, 0, 'expected non-zero exit on signer mismatch');
    assert.ok(/signer mismatch/i.test(r.stderr), `expected signer-mismatch error; stderr=${r.stderr}`);
  });

  // 6) Every event the relay stored verified — the relay rejects bad sigs, so the
  //    accepted events prove finalizeEvent produced valid signatures.
  await check('relay only ever stored signature-valid events', () => {
    const { verifyEvent } = require('nostr-tools');
    assert.ok(relay.events.length >= 4, `expected several stored events; got ${relay.events.length}`);
    for (const ev of relay.events) {
      assert.ok(verifyEvent(ev), `stored event ${ev.id?.slice(0, 8)} failed verification`);
    }
  });

  await relay.close();

  console.log('\n-------------');
  console.log(`E2E: ${passed} passed, ${failed} failed → ${failed === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => { console.error('e2e harness error:', err); process.exit(1); });
