#!/usr/bin/env node
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { getPaymentsDue, parseArgs, readDecisions, settle } = require('../scripts/david-bounty-settle');

const ISSUER = 'a'.repeat(64);
const CLAIMANT = 'b'.repeat(64);
const CLAIM = 'c'.repeat(64);
const BOUNTY = 'bounty-1';

function dueItems({ claimant = CLAIMANT, pending = true, reconciliation = false } = {}) {
  const claim = {
    event: { id: CLAIM, pubkey: claimant, content: 'completed work' },
    paymentAmountSats: 25,
  };
  return [{
    bounty: { id: BOUNTY, issuer_pubkey: ISSUER, amount_sats: 25, criteria: 'ship it', auto_pay: false },
    pendingClaims: pending ? [claim] : [],
    reconciliationClaims: reconciliation ? [claim] : [],
  }];
}

function decision(kind, confidence = 1, reason = `${kind} reason`) {
  return { bountyId: BOUNTY, claimEventId: CLAIM, decision: kind, confidence, reason };
}

function setup({ judgment, dryRun = false, claimant = CLAIMANT, pending = true, reconciliation = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'david-settle-test-'));
  const paths = {
    cookieJar: path.join(directory, 'cookies.json'),
    decisionsPath: path.join(directory, 'decisions.jsonl'),
    statePath: path.join(directory, 'state.json'),
    queuePath: path.join(directory, 'queue.json'),
    logPath: path.join(directory, 'settlement.jsonl'),
  };
  fs.writeFileSync(paths.cookieJar, '{"sid":"test"}\n');
  fs.writeFileSync(paths.decisionsPath, judgment ? `${JSON.stringify(judgment)}\n` : '');
  return {
    paths,
    options: {
      issuer: ISSUER,
      baseUrl: 'http://test.invalid',
      agentPath: '/test/agent.js',
      cwd: directory,
      dryRun,
      env: {},
      ...paths,
    },
    items: dueItems({ claimant, pending, reconciliation }),
  };
}

function stateAt(pathname) {
  return fs.existsSync(pathname) ? JSON.parse(fs.readFileSync(pathname, 'utf8')) : { version: 2, claims: {} };
}

function stateKey(bountyId, claimEventId) {
  return `${bountyId}:${claimEventId}`;
}

function queueAt(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8')).claims;
}

function defaultAgent(calls, overrides = {}) {
  return async (_agentPath, args) => {
    calls.push(args);
    if (args[0] === 'reconcile') {
      return overrides.reconcile || { ok: true, dryRun: args.includes('--dry-run'), results: [] };
    }
    if (args[0] === 'judge') {
      const kind = args[args.indexOf('--decision') + 1];
      return { ok: true, decision: kind, confidence: 1, pay: kind === 'accept' };
    }
    if (args[0] === 'pay' && args.includes('--dry-run')) {
      if (overrides.preflight) return overrides.preflight;
      return { ok: true, dryRun: true, wouldPay: { claimEventId: CLAIM, amountSats: 25, claimantRank: 3 } };
    }
    if (args[0] === 'pay') return overrides.livePay || { ok: true, state: 'settled', amountSats: 25 };
    throw new Error(`unexpected command: ${args.join(' ')}`);
  };
}

async function run() {
  let passed = 0;
  async function test(name, fn) {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  }

  for (const kind of ['accept', 'reject']) {
    await test(`dry-run ${kind} validates without judging, paying, or writing terminal state`, async () => {
      const fixture = setup({ judgment: decision(kind), dryRun: true });
      const calls = [];
      const summary = await settle(fixture.options, {
        getPaymentsDue: async () => fixture.items,
        runAgent: defaultAgent(calls),
      });
      assert.equal(summary.ok, true);
      assert.equal(summary.judgments, 0);
      assert.equal(summary.payments, 0);
      assert.deepEqual(calls.map(args => args[0]), ['pay', 'reconcile']);
      assert.equal(calls[0].includes('--dry-run'), true);
      assert.equal(calls[1].includes('--dry-run'), true);
      assert.deepEqual(stateAt(fixture.paths.statePath).claims, {});
    });
  }

  await test('dry-run self-claim validates the self gate without judging or terminal state', async () => {
    const fixture = setup({ dryRun: true, claimant: ISSUER });
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls, { preflight: { ok: false, reason: 'self_claim' } }),
    });
    assert.equal(summary.ok, true);
    assert.equal(summary.judgments, 0);
    assert.deepEqual(calls.map(args => args[0]), ['pay', 'reconcile']);
    assert.deepEqual(stateAt(fixture.paths.statePath).claims, {});
  });

  await test('targeted live mode pays only the exact pending claim and never reconciles', async () => {
    const fixture = setup({ judgment: decision('accept') });
    const otherClaimId = 'd'.repeat(64);
    fixture.items[0].pendingClaims.push({
      event: { id: otherClaimId, pubkey: 'e'.repeat(64), content: 'other work' },
      paymentAmountSats: 25,
    });
    fixture.options.targetBountyId = BOUNTY;
    fixture.options.targetClaimEventId = CLAIM;
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls),
    });
    assert.equal(summary.ok, true);
    assert.deepEqual(summary.target, { bountyId: BOUNTY, claimEventId: CLAIM });
    assert.equal(summary.payments, 1);
    assert.deepEqual(calls.map(args => args[0]), ['pay', 'judge', 'pay']);
    assert.ok(calls.every(args => !args.includes(otherClaimId)));
    assert.ok(calls.every(args => args[0] !== 'reconcile'));
  });

  await test('targeted mode fails closed when the exact claim is not pending', async () => {
    const fixture = setup({ judgment: decision('accept') });
    fixture.options.targetBountyId = BOUNTY;
    fixture.options.targetClaimEventId = 'd'.repeat(64);
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls),
    });
    assert.equal(summary.ok, false);
    assert.equal(summary.failures, 1);
    assert.deepEqual(calls, []);
    assert.deepEqual(summary.target, { bountyId: BOUNTY, claimEventId: 'd'.repeat(64) });
  });

  await test('target arguments must be paired and claim must be 64-char hex', () => {
    assert.throws(() => parseArgs(['--live', '--bounty', BOUNTY]), /supplied together/);
    assert.throws(() => parseArgs(['--live', '--claim', CLAIM]), /supplied together/);
    assert.throws(() => parseArgs(['--live', '--bounty', BOUNTY, '--claim', 'bad']), /64-char hex/);
    assert.equal(parseArgs(['--live', '--bounty', BOUNTY, '--claim', CLAIM]).claim, CLAIM);
  });

  await test('live accept orders preflight, judgment, then payment', async () => {
    const fixture = setup({ judgment: decision('accept') });
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls),
    });
    assert.equal(summary.ok, true);
    assert.equal(summary.judgments, 1);
    assert.equal(summary.payments, 1);
    assert.deepEqual(calls.slice(0, 3).map(args => args[0]), ['pay', 'judge', 'pay']);
    assert.equal(calls[0].includes('--dry-run'), true);
    assert.equal(calls[2].includes('--dry-run'), false);
    assert.equal(stateAt(fixture.paths.statePath).claims[stateKey(BOUNTY, CLAIM)].terminal, true);
  });

  await test('live reject records rejection after validation and never pays', async () => {
    const fixture = setup({ judgment: decision('reject') });
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls),
    });
    assert.equal(summary.ok, true);
    assert.deepEqual(calls.map(args => args[0]), ['pay', 'judge', 'reconcile']);
    assert.equal(stateAt(fixture.paths.statePath).claims[stateKey(BOUNTY, CLAIM)].result, 'rejected');
  });

  await test('live self-claim records only a rejection after the self gate', async () => {
    const fixture = setup({ claimant: ISSUER });
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls, { preflight: { ok: false, reason: 'self_claim' } }),
    });
    assert.equal(summary.ok, true);
    assert.deepEqual(calls.map(args => args[0]), ['pay', 'judge', 'reconcile']);
    assert.equal(stateAt(fixture.paths.statePath).claims[stateKey(BOUNTY, CLAIM)].result, 'rejected_self_claim');
  });

  await test('existing failed payment fails the run and enters the reset-required queue', async () => {
    const fixture = setup({ judgment: decision('accept') });
    const calls = [];
    const failed = { claim_event_id: CLAIM, state: 'failed', reason: 'wallet rejected' };
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls, {
        preflight: { ok: false, reason: 'already_attempted', payment: failed },
        reconcile: { ok: false, dryRun: false, results: [{
          ok: false,
          claimEventId: CLAIM,
          bountyId: BOUNTY,
          issuerPubkey: ISSUER,
          amountSats: 25,
          state: 'failed',
          status: 'reset_required',
          reason: 'wallet rejected',
        }] },
      }),
    });
    assert.equal(summary.ok, false);
    assert.equal(summary.judgments, 0);
    assert.deepEqual(calls.map(args => args[0]), ['pay', 'reconcile']);
    assert.equal(queueAt(fixture.paths.queuePath)[0].status, 'payment_failed_reset_required');
    assert.deepEqual(stateAt(fixture.paths.statePath).claims, {});
  });

  for (const terminalState of ['settled', 'paid_unreceipted']) {
    await test(`existing ${terminalState} is terminal and never resends`, async () => {
      const fixture = setup({ judgment: decision('accept') });
      const calls = [];
      const summary = await settle(fixture.options, {
        getPaymentsDue: async () => fixture.items,
        runAgent: defaultAgent(calls, {
          preflight: { ok: false, reason: 'already_attempted', payment: { state: terminalState } },
        }),
      });
      assert.equal(summary.ok, true);
      assert.deepEqual(calls.map(args => args[0]), ['pay', 'reconcile']);
      assert.equal(stateAt(fixture.paths.statePath).claims[stateKey(BOUNTY, CLAIM)].result, `already_attempted:${terminalState}`);
    });
  }

  await test('ambiguous reconciliation fails and creates a distinct queue record without paying', async () => {
    const fixture = setup({ pending: false, reconciliation: true });
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls, {
        reconcile: { ok: false, dryRun: false, results: [{
          ok: false,
          claimEventId: CLAIM,
          bountyId: BOUNTY,
          issuerPubkey: ISSUER,
          amountSats: 25,
          state: 'attempting',
          status: 'ambiguous_reconciliation',
          reason: 'wallet status inconclusive',
        }] },
      }),
    });
    assert.equal(summary.ok, false);
    assert.deepEqual(calls.map(args => args[0]), ['reconcile']);
    assert.equal(queueAt(fixture.paths.queuePath)[0].status, 'reconciliation_ambiguous');
  });

  await test('reconciliation queue keeps the same event on two bounties', async () => {
    const fixture = setup({ pending: false, reconciliation: true });
    const secondBounty = 'bounty-2';
    const failures = [BOUNTY, secondBounty].map(bountyId => ({
      ok: false,
      claimEventId: CLAIM,
      bountyId,
      issuerPubkey: ISSUER,
      amountSats: 25,
      state: 'attempting',
      status: 'ambiguous_reconciliation',
      reason: 'wallet status inconclusive',
    }));
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent([], {
        reconcile: { ok: false, dryRun: false, results: failures },
      }),
    });
    assert.equal(summary.ok, false);
    assert.equal(summary.failures, 2);
    assert.deepEqual(
      queueAt(fixture.paths.queuePath).map(entry => entry.bountyId).sort(),
      [BOUNTY, secondBounty].sort(),
    );
  });

  await test('observed receipt reconciliation succeeds without invoking pay', async () => {
    const fixture = setup({ pending: false, reconciliation: true });
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls, {
        reconcile: { ok: true, dryRun: false, results: [{
          ok: true,
          claimEventId: CLAIM,
          bountyId: BOUNTY,
          issuerPubkey: ISSUER,
          amountSats: 25,
          previousState: 'paid_unreceipted',
          state: 'settled',
          status: 'settled',
        }] },
      }),
    });
    assert.equal(summary.ok, true);
    assert.deepEqual(calls.map(args => args[0]), ['reconcile']);
    assert.deepEqual(queueAt(fixture.paths.queuePath), []);
  });

  await test('undecided claim is queued and fails closed', async () => {
    const fixture = setup();
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls),
    });
    assert.equal(summary.ok, false);
    assert.equal(queueAt(fixture.paths.queuePath)[0].status, 'awaiting_judgment');
    assert.deepEqual(calls.map(args => args[0]), ['reconcile']);
  });

  await test('same event on two bounties is processed independently and a same-bounty replacement is not repaid', async () => {
    const fixture = setup();
    const secondBounty = 'bounty-2';
    const secondClaim = 'd'.repeat(64);
    fs.writeFileSync(fixture.paths.decisionsPath, [
      decision('accept'),
      { ...decision('accept'), bountyId: secondBounty },
    ].map(JSON.stringify).join('\n') + '\n');
    fixture.items = [
      ...fixture.items,
      {
        bounty: { ...fixture.items[0].bounty, id: secondBounty },
        pendingClaims: fixture.items[0].pendingClaims,
        reconciliationClaims: [],
      },
    ];
    const firstCalls = [];
    const first = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(firstCalls),
    });
    assert.equal(first.ok, true);
    assert.equal(first.payments, 2);
    assert.ok(stateAt(fixture.paths.statePath).claims[stateKey(BOUNTY, CLAIM)].terminal);
    assert.ok(stateAt(fixture.paths.statePath).claims[stateKey(secondBounty, CLAIM)].terminal);

    fs.writeFileSync(fixture.paths.decisionsPath, `${JSON.stringify({
      bountyId: BOUNTY,
      claimEventId: secondClaim,
      decision: 'accept',
      confidence: 1,
      reason: 'corrected replacement',
    })}\n`);
    fixture.items = [{
      bounty: fixture.items[0].bounty,
      pendingClaims: [{
        event: { ...fixture.items[0].pendingClaims[0].event, id: secondClaim },
        paymentAmountSats: 25,
      }],
      reconciliationClaims: [],
    }];
    const secondCalls = [];
    const second = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(secondCalls, {
        preflight: { ok: false, reason: 'already_attempted', payment: { state: 'settled' } },
      }),
    });
    assert.equal(second.ok, true);
    assert.equal(second.payments, 0);
    assert.deepEqual(secondCalls.map(args => args[0]), ['pay', 'reconcile']);
    assert.equal(stateAt(fixture.paths.statePath).claims[stateKey(BOUNTY, secondClaim)].result, 'already_attempted:settled');
  });

  await test('legacy terminal state migrates only with an explicit bounty and fails closed otherwise', async () => {
    const fixture = setup({ judgment: decision('accept') });
    fs.writeFileSync(fixture.paths.statePath, `${JSON.stringify({
      version: 1,
      claims: { [CLAIM]: { terminal: true, result: 'rejected', bountyId: BOUNTY } },
    })}\n`);
    const calls = [];
    const summary = await settle(fixture.options, {
      getPaymentsDue: async () => fixture.items,
      runAgent: defaultAgent(calls),
    });
    assert.equal(summary.ok, true);
    assert.deepEqual(calls.map(args => args[0]), ['reconcile']);

    fs.writeFileSync(fixture.paths.statePath, `${JSON.stringify({
      version: 1,
      claims: { [CLAIM]: { terminal: true, result: 'rejected' } },
    })}\n`);
    await assert.rejects(
      settle(fixture.options, {
        getPaymentsDue: async () => fixture.items,
        runAgent: defaultAgent([]),
      }),
      /cannot safely migrate ambiguous legacy claim/,
    );
  });

  await test('payments-due fetch has a bounded timeout', async () => {
    const fixture = setup();
    await assert.rejects(
      getPaymentsDue('http://test.invalid', fixture.paths.cookieJar, async (_url, options) => (
        new Promise((_resolve, reject) => {
          const guard = setTimeout(() => reject(new Error('abort signal did not fire')), 100);
          options.signal.addEventListener('abort', () => {
            clearTimeout(guard);
            reject(options.signal.reason);
          }, { once: true });
        })
      ), 5),
      /payments-due timed out after 5ms/,
    );
  });

  await test('process-level dry-run invokes only dry-run pay and reconciliation', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'david-settle-process-'));
    const cookieJar = path.join(directory, 'cookies.json');
    const decisionsPath = path.join(directory, 'decisions.jsonl');
    const statePath = path.join(directory, 'state.json');
    const queuePath = path.join(directory, 'queue.json');
    const logPath = path.join(directory, 'settlement.jsonl');
    const agentPath = path.join(directory, 'fake-agent.js');
    const agentCallsPath = path.join(directory, 'agent-calls.jsonl');
    fs.writeFileSync(cookieJar, '{"connect.sid":"test-cookie"}\n');
    fs.writeFileSync(decisionsPath, `${JSON.stringify(decision('accept'))}\n`);
    fs.writeFileSync(agentPath, `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.AGENT_CALLS_PATH, JSON.stringify(args) + '\\n');
if (args[0] === 'pay' && args.includes('--dry-run')) {
  console.log(JSON.stringify({ok:true,dryRun:true,wouldPay:{claimEventId:${JSON.stringify(CLAIM)},amountSats:25,claimantRank:3}}));
} else if (args[0] === 'reconcile' && args.includes('--dry-run')) {
  console.log(JSON.stringify({ok:true,dryRun:true,results:[]}));
} else {
  console.log(JSON.stringify({ok:false,error:'unexpected live or judgment command'}));
  process.exitCode = 1;
}
`, { mode: 0o755 });

    const server = http.createServer((req, res) => {
      assert.equal(req.url, '/api/bounties/mine/payments-due');
      assert.equal(req.headers.cookie, 'connect.sid=test-cookie');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, items: dueItems()[0] ? dueItems() : [] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const args = [
        path.join(__dirname, '..', 'scripts', 'david-bounty-settle.js'),
        '--issuer', ISSUER,
        '--base-url', `http://127.0.0.1:${server.address().port}`,
        '--cookie-jar', cookieJar,
        '--decisions', decisionsPath,
        '--state', statePath,
        '--queue', queuePath,
        '--log', logPath,
        '--agent', agentPath,
        '--dry-run',
      ];
      const child = spawn(process.execPath, args, {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, AGENT_CALLS_PATH: agentCallsPath },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      const exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      assert.equal(exitCode, 0, stderr || stdout);
      const summary = JSON.parse(stdout.trim());
      assert.equal(summary.mode, 'dry-run');
      assert.equal(summary.dryRuns, 1);
      assert.equal(summary.judgments, 0);
      assert.equal(summary.payments, 0);
      assert.equal(summary.failures, 0);
      assert.equal(fs.existsSync(statePath), false);
      assert.deepEqual(JSON.parse(fs.readFileSync(queuePath, 'utf8')).claims, []);
      const calls = fs.readFileSync(agentCallsPath, 'utf8').trim().split('\n').map(JSON.parse);
      assert.deepEqual(calls.map(args => args[0]), ['pay', 'reconcile']);
      assert.ok(calls.every(args => args.includes('--dry-run')));
      assert.ok(calls.every(args => args[0] !== 'judge'));
    } finally {
      await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
  });

  await test('whitespace-only decision reason fails closed', () => {
    const fixture = setup();
    fs.writeFileSync(fixture.paths.decisionsPath, `${JSON.stringify(decision('accept', 1, '   \t'))}\n`);
    assert.throws(() => readDecisions(fixture.paths.decisionsPath), /invalid reason/);
  });

  await test('malformed decision input fails closed', () => {
    const fixture = setup();
    fs.writeFileSync(fixture.paths.decisionsPath, '{not-json}\n');
    assert.throws(() => readDecisions(fixture.paths.decisionsPath), /malformed judgment JSON/);
  });

  console.log(`${passed} David settlement self-checks passed`);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
