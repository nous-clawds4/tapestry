#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const AGENT_TIMEOUT_MS = 300_000;
const FINAL_PAYMENT_STATES = new Set(['settled', 'paid_unreceipted']);
const RECONCILIATION_PAYMENT_STATES = new Set(['attempting', 'paid']);

function parseArgs(argv) {
  const values = {};
  const booleans = new Set(['dry-run', 'live']);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const name = arg.slice(2);
    if (booleans.has(name)) {
      values[name] = true;
      continue;
    }
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value`);
    values[name] = value;
  }
  if (Boolean(values['dry-run']) === Boolean(values.live)) {
    throw new Error('select exactly one mode: --dry-run or --live');
  }
  if (Boolean(values.bounty) !== Boolean(values.claim)) {
    throw new Error('--bounty and --claim must be supplied together');
  }
  if (values.claim && !/^[0-9a-f]{64}$/i.test(values.claim)) {
    throw new Error('--claim must be a 64-char hex event id');
  }
  return values;
}

function parseJsonOutput(text, command) {
  const source = String(text || '').trim();
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${command} returned invalid JSON`);
  }
}

function readJson(pathname, fallback) {
  try {
    return JSON.parse(fs.readFileSync(pathname, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`cannot read ${pathname}: ${error.message}`);
  }
}
function claimKey(bountyId, claimEventId) {
  return `${bountyId}:${String(claimEventId).toLowerCase()}`;
}

function readState(pathname) {
  const state = readJson(pathname, { version: 2, claims: {} });
  if (!state || typeof state.claims !== 'object' || !state.claims) {
    throw new Error(`invalid state file: ${pathname}`);
  }
  if (state.version === 2) return state;
  if (state.version !== 1) throw new Error(`invalid state file: ${pathname}`);

  const migrated = { version: 2, claims: {} };
  for (const [claimEventId, record] of Object.entries(state.claims)) {
    if (!record || typeof record !== 'object' || !record.bountyId) {
      throw new Error(`cannot safely migrate ambiguous legacy claim ${claimEventId}`);
    }
    const key = claimKey(record.bountyId, claimEventId);
    if (migrated.claims[key]) throw new Error(`cannot safely migrate duplicate legacy claim ${claimEventId}`);
    migrated.claims[key] = record;
  }
  return migrated;
}


function readDecisions(pathname) {
  let source;
  try {
    source = fs.readFileSync(pathname, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw new Error(`cannot read ${pathname}: ${error.message}`);
  }
  const decisions = new Map();
  source.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    let decision;
    try {
      decision = JSON.parse(line);
    } catch {
      throw new Error(`malformed judgment JSON on line ${index + 1}`);
    }
    const required = ['bountyId', 'claimEventId', 'decision', 'confidence', 'reason'];
    for (const field of required) {
      if (decision[field] === undefined || decision[field] === null || decision[field] === '') {
        throw new Error(`judgment line ${index + 1} is missing ${field}`);
      }
    }
    if (typeof decision.reason !== 'string' || !decision.reason.trim()) {
      throw new Error(`judgment line ${index + 1} has an invalid reason`);
    }
    if (!/^[0-9a-f]{64}$/i.test(String(decision.claimEventId))) {
      throw new Error(`judgment line ${index + 1} has an invalid claimEventId`);
    }
    if (!['accept', 'reject'].includes(decision.decision)) {
      throw new Error(`judgment line ${index + 1} has an invalid decision`);
    }
    const confidence = Number(decision.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error(`judgment line ${index + 1} has an invalid confidence`);
    }
    const key = claimKey(decision.bountyId, decision.claimEventId);
    if (decisions.has(key)) {
      throw new Error(`judgment line ${index + 1} duplicates bountyId and claimEventId`);
    }
    decisions.set(key, { ...decision, confidence });
  });
  return decisions;
}

function writeJsonAtomic(pathname, value) {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  const temporary = path.join(path.dirname(pathname), `.${path.basename(pathname)}.${process.pid}.tmp`);
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, pathname);
}

function appendLog(pathname, entry) {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  fs.appendFileSync(pathname, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, { mode: 0o600 });
}

function cookieHeader(pathname) {
  const jar = readJson(pathname, {});
  const pairs = Object.entries(jar).map(([key, value]) => `${key}=${value}`);
  if (!pairs.length) throw new Error(`cookie jar is empty: ${pathname}; run agent.js auth-login first`);
  return pairs.join('; ');
}

function runAgent(agentPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [agentPath, ...args], {
      cwd: options.cwd,
      env: options.env,
      // Worst case inside one `pay` call is a 160 s wallet send plus a 60 s
      // receipt poll. A 180 s cap killed the child mid-send and turned a
      // completed payment into an ambiguous one.
      timeout: options.timeoutMs || AGENT_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    }, (error, stdout, stderr) => {
      const output = String(stdout || '').trim() || String(stderr || '').trim();
      let parsed;
      try {
        parsed = parseJsonOutput(output, `agent.js ${args[0]}`);
      } catch (parseError) {
        return reject(error || parseError);
      }
      if (error) return resolve(parsed);
      resolve(parsed);
    });
  });
}

async function getPaymentsDue(baseUrl, jarPath, fetchImpl = fetch, timeoutMs = 15_000) {
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/bounties/mine/payments-due`, {
      headers: { Cookie: cookieHeader(jarPath), Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw new Error(`payments-due timed out after ${timeoutMs}ms`);
    throw error;
  }
  const text = await response.text();
  const body = parseJsonOutput(text, 'payments-due');
  if (!response.ok || body.success !== true || !Array.isArray(body.items)) {
    throw new Error(`payments-due failed with HTTP ${response.status}: ${body.error || 'invalid response'}`);
  }
  return body.items;
}

function claimQueueRecord(bounty, claim, status) {
  return {
    bountyId: bounty.id,
    claimEventId: claim.event.id,
    issuerPubkey: bounty.issuer_pubkey,
    claimantPubkey: claim.event.pubkey,
    criteria: bounty.criteria,
    claimContent: claim.event.content,
    amountSats: Number(claim.paymentAmountSats ?? bounty.amount_sats),
    status,
  };
}

function paymentAlreadyAttempted(result) {
  return result?.reason === 'already_attempted'
    && FINAL_PAYMENT_STATES.has(result?.payment?.state);
}

function queueStatusForPayment(result) {
  if (result?.reason !== 'already_attempted') return null;
  if (result?.payment?.state === 'failed') return 'payment_failed_reset_required';
  if (RECONCILIATION_PAYMENT_STATES.has(result?.payment?.state)) return 'reconciliation_unresolved';
  return null;
}

async function settle(options, dependencies = {}) {
  const issuer = String(options.issuer || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(issuer)) throw new Error('--issuer must be a 64-char hex pubkey');
  const target = options.targetBountyId ? {
    bountyId: String(options.targetBountyId),
    claimEventId: String(options.targetClaimEventId || '').toLowerCase(),
  } : null;
  if (target && !/^[0-9a-f]{64}$/.test(target.claimEventId)) {
    throw new Error('--claim must be a 64-char hex event id');
  }
  if (options.env.AGENT_REQUIRE_JUDGMENT === 'false') {
    throw new Error('REFUSE: AGENT_REQUIRE_JUDGMENT=false disables the live judgment gate');
  }
  if (options.env.DEV_SKIP_TRUST_CHECK) {
    throw new Error('REFUSE: DEV_SKIP_TRUST_CHECK must be unset');
  }

  const minConfidence = Number(options.env.AGENT_JUDGE_MIN_CONFIDENCE || 0.6);
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    throw new Error('AGENT_JUDGE_MIN_CONFIDENCE must be between 0 and 1');
  }

  const decisions = readDecisions(options.decisionsPath);
  const state = readState(options.statePath);
  const dueItems = await (dependencies.getPaymentsDue || getPaymentsDue)(
    options.baseUrl,
    options.cookieJar,
    dependencies.fetchImpl,
  );
  const invoke = dependencies.runAgent || runAgent;
  const queue = [];
  let failures = 0;
  let dryRuns = 0;
  let judgments = 0;
  let payments = 0;
  let targetFound = false;

  const log = (entry) => (dependencies.appendLog || appendLog)(options.logPath, entry);
  const saveState = () => (dependencies.writeJsonAtomic || writeJsonAtomic)(options.statePath, state);

  for (const item of dueItems) {
    const bounty = item?.bounty;
    if (target && bounty?.id !== target.bountyId) continue;
    if (!bounty || String(bounty.issuer_pubkey || '').toLowerCase() !== issuer) {
      failures += 1;
      log({ action: 'refuse_bounty', result: 'unexpected_issuer', bountyId: bounty?.id || null });
      continue;
    }
    if (Boolean(bounty.auto_pay)) {
      failures += 1;
      log({ action: 'refuse_bounty', result: 'auto_pay_enabled', bountyId: bounty.id });
      continue;
    }

    for (const claim of item.pendingClaims || []) {
      if (target && claim?.event?.id !== target.claimEventId) continue;
      if (target) targetFound = true;
      const claimId = claim?.event?.id;
      const claimant = String(claim?.event?.pubkey || '').toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(String(claimId || '')) || !/^[0-9a-f]{64}$/.test(claimant)) {
        failures += 1;
        log({ action: 'refuse_claim', result: 'malformed_claim', bountyId: bounty.id, claimEventId: claimId || null });
        continue;
      }

      const key = claimKey(bounty.id, claimId);
      if (state.claims[key]?.terminal === true) {
        log({ action: 'skip_claim', result: 'already_processed', bountyId: bounty.id, claimEventId: claimId });
        continue;
      }

      const selfClaim = claimant === issuer;
      const decision = selfClaim ? {
        bountyId: bounty.id,
        decision: 'reject',
        confidence: 1,
        reason: 'Self-dealing is not allowed.',
      } : decisions.get(key);

      if (!decision) {
        failures += 1;
        queue.push(claimQueueRecord(bounty, claim, 'awaiting_judgment'));
        log({ action: 'queue_claim', result: 'awaiting_judgment', bountyId: bounty.id, claimEventId: claimId });
        continue;
      }
      if (decision.bountyId !== bounty.id) {
        failures += 1;
        queue.push(claimQueueRecord(bounty, claim, 'judgment_bounty_mismatch'));
        log({ action: 'refuse_judgment', result: 'bounty_mismatch', bountyId: bounty.id, claimEventId: claimId });
        continue;
      }
      if (decision.decision === 'accept' && decision.confidence < minConfidence) {
        failures += 1;
        queue.push(claimQueueRecord(bounty, claim, 'accept_confidence_too_low'));
        log({ action: 'refuse_judgment', result: 'accept_confidence_too_low', bountyId: bounty.id, claimEventId: claimId });
        continue;
      }

      const preflight = await invoke(options.agentPath, [
        'pay', '--bounty', bounty.id, '--claim', claimId, '--dry-run',
      ], { cwd: options.cwd, env: options.env });

      if (selfClaim) {
        if (preflight.ok !== false || preflight.reason !== 'self_claim') {
          failures += 1;
          log({ action: 'pay_dry_run', result: 'failed', reason: preflight.reason || preflight.error || 'self_claim_gate_missing', bountyId: bounty.id, claimEventId: claimId });
          continue;
        }
        dryRuns += 1;
        log({ action: 'pay_dry_run', result: 'self_claim', bountyId: bounty.id, claimEventId: claimId });
      } else if (preflight.reason === 'already_attempted') {
        if (paymentAlreadyAttempted(preflight)) {
          state.claims[key] = { terminal: true, result: `already_attempted:${preflight.payment.state}`, bountyId: bounty.id };
          if (!options.dryRun) saveState();
          log({ action: 'pay', result: 'already_attempted', paymentState: preflight.payment.state, bountyId: bounty.id, claimEventId: claimId });
          continue;
        }
        const status = queueStatusForPayment(preflight) || 'reconciliation_unresolved';
        failures += 1;
        queue.push(claimQueueRecord(bounty, claim, status));
        log({ action: 'queue_claim', result: status, paymentState: preflight.payment?.state || null, bountyId: bounty.id, claimEventId: claimId });
        continue;
      } else {
        if (preflight.ok !== true || preflight.dryRun !== true || preflight.wouldPay?.claimEventId !== claimId
            || Number(preflight.wouldPay?.claimantRank) < 2) {
          failures += 1;
          log({ action: 'pay_dry_run', result: 'failed', reason: preflight.reason || preflight.error || 'invalid_response', bountyId: bounty.id, claimEventId: claimId });
          continue;
        }
        dryRuns += 1;
        log({ action: 'pay_dry_run', result: 'passed', bountyId: bounty.id, claimEventId: claimId, amountSats: preflight.wouldPay.amountSats, claimantRank: preflight.wouldPay.claimantRank });
      }

      if (options.dryRun) continue;

      const judgment = await invoke(options.agentPath, [
        'judge', '--bounty', bounty.id, '--claim', claimId,
        '--decision', decision.decision, '--confidence', String(decision.confidence), '--reason', decision.reason,
      ], { cwd: options.cwd, env: options.env });
      if (judgment.ok !== true || judgment.decision !== decision.decision) {
        failures += 1;
        log({ action: 'judge', result: 'failed', reason: judgment.reason || judgment.error || 'invalid_response', bountyId: bounty.id, claimEventId: claimId });
        continue;
      }
      judgments += 1;
      log({ action: 'judge', result: judgment.pay ? 'accepted' : 'rejected', bountyId: bounty.id, claimEventId: claimId, confidence: judgment.confidence });

      if (!judgment.pay) {
        state.claims[key] = { terminal: true, result: selfClaim ? 'rejected_self_claim' : 'rejected', bountyId: bounty.id };
        saveState();
        continue;
      }

      const paid = await invoke(options.agentPath, ['pay', '--bounty', bounty.id, '--claim', claimId], {
        cwd: options.cwd,
        env: options.env,
      });
      if (paid.ok === true && FINAL_PAYMENT_STATES.has(paid.state)) {
        payments += 1;
        state.claims[key] = { terminal: true, result: paid.state, bountyId: bounty.id };
        saveState();
        log({ action: 'pay', result: paid.state, bountyId: bounty.id, claimEventId: claimId, amountSats: paid.amountSats });
      } else if (paymentAlreadyAttempted(paid)) {
        state.claims[key] = { terminal: true, result: `already_attempted:${paid.payment.state}`, bountyId: bounty.id };
        saveState();
        log({ action: 'pay', result: 'already_attempted', paymentState: paid.payment.state, bountyId: bounty.id, claimEventId: claimId });
      } else {
        failures += 1;
        const status = queueStatusForPayment(paid);
        if (status) queue.push(claimQueueRecord(bounty, claim, status));
        log({ action: 'pay', result: status || 'failed', reason: paid.reason || paid.error || paid.state || 'invalid_response', bountyId: bounty.id, claimEventId: claimId });
      }
    }
  }

  if (target && !targetFound) {
    failures += 1;
    log({ action: 'target', result: 'not_pending', ...target });
  }

  if (!target) {
    const reconciliationArgs = ['reconcile', '--issuer', issuer];
    if (options.dryRun) reconciliationArgs.push('--dry-run');
    const reconciliation = await invoke(options.agentPath, reconciliationArgs, {
      cwd: options.cwd,
      env: options.env,
    });
    if (!reconciliation || !Array.isArray(reconciliation.results)) {
      failures += 1;
      log({ action: 'reconcile', result: 'failed', reason: reconciliation?.error || 'invalid_response' });
    } else {
      for (const result of reconciliation.results) {
        log({
          action: 'reconcile',
          result: result.status,
          reason: result.reason || null,
          bountyId: result.bountyId,
          claimEventId: result.claimEventId,
        });
        if (result.ok) continue;
        const status = result.status === 'reset_required'
          ? 'payment_failed_reset_required'
          : result.status === 'ambiguous_reconciliation'
            ? 'reconciliation_ambiguous'
            : 'reconciliation_unresolved';
        const alreadyQueued = queue.some(entry => (
          claimKey(entry.bountyId, entry.claimEventId) === claimKey(result.bountyId, result.claimEventId)
        ));
        if (!alreadyQueued) {
          failures += 1;
          queue.push({
            bountyId: result.bountyId,
            claimEventId: result.claimEventId,
            issuerPubkey: result.issuerPubkey || issuer,
            amountSats: result.amountSats,
            paymentState: result.state,
            status,
            reason: result.reason || null,
          });
        }
      }
    }
  }

  (dependencies.writeJsonAtomic || writeJsonAtomic)(options.queuePath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    issuerPubkey: issuer,
    claims: queue,
  });
  const summary = {
    ok: failures === 0,
    mode: options.dryRun ? 'dry-run' : 'live',
    target,
    dueBounties: dueItems.length,
    queued: queue.length,
    dryRuns,
    judgments,
    payments,
    failures,
  };
  log({ action: 'summary', ...summary });
  return summary;
}

function optionsFromArgs(args, env = process.env) {
  const root = path.resolve(__dirname, '..');
  return {
    issuer: args.issuer || env.DAVID_ISSUER_PUBKEY,
    targetBountyId: args.bounty || null,
    targetClaimEventId: args.claim || null,
    baseUrl: args['base-url'] || env.MC_BASE_URL || 'http://localhost:7778',
    cookieJar: args['cookie-jar'] || env.MC_COOKIE_JAR || path.join(os.homedir(), '.magic-carpet-agent-cookies.json'),
    decisionsPath: args.decisions || env.DAVID_SETTLEMENT_DECISIONS || '/var/lib/brainstorm/david-bounty-decisions.jsonl',
    statePath: args.state || env.DAVID_SETTLEMENT_STATE || '/var/lib/brainstorm/david-bounty-settlement-state.json',
    queuePath: args.queue || env.DAVID_SETTLEMENT_QUEUE || '/var/lib/brainstorm/david-bounty-judgment-queue.json',
    logPath: args.log || env.DAVID_SETTLEMENT_LOG || '/var/log/brainstorm/david-bounty-settlement.jsonl',
    agentPath: args.agent || path.join(root, 'bin', 'agent.js'),
    cwd: root,
    dryRun: Boolean(args['dry-run']),
    env,
  };
}

async function main() {
  let options;
  try {
    const args = parseArgs(process.argv.slice(2));
    options = optionsFromArgs(args);
    const summary = await settle(options);
    console.log(JSON.stringify(summary));
    process.exit(summary.ok ? 0 : 1);
  } catch (error) {
    if (options?.logPath) {
      try { appendLog(options.logPath, { action: 'fatal', result: 'failed', reason: error.message }); } catch { /* stderr remains the fallback */ }
    }
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  AGENT_TIMEOUT_MS,
  getPaymentsDue,
  optionsFromArgs,
  parseArgs,
  paymentAlreadyAttempted,
  readDecisions,
  settle,
};
