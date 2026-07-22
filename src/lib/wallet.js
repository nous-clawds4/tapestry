const { execFile } = require('child_process');
const path = require('path');
const { decode: decodeBolt11 } = require('light-bolt11-decoder');

// The agent-wallet CLI auto-starts its daemon (up to ~30s cold start), so
// timeouts cover daemon boot plus the operation itself. `send` additionally
// polls internally for up to 2 minutes before reporting a terminal status.
const DEFAULT_BALANCE_TIMEOUT_MS = 45_000;
const DEFAULT_SEND_TIMEOUT_MS = 160_000;

function walletCliPath() {
  return process.env.MDK_WALLET_BIN
    || path.resolve(__dirname, '..', '..', 'node_modules', '.bin', 'agent-wallet');
}

// JSON results arrive on stdout, errors on stderr as {"error": msg}; both can
// be preceded by log noise, so scan lines from the end for the JSON payload.
function parseJsonLine(text) {
  const lines = String(text || '').trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(lines[i]); } catch { /* not this line */ }
  }
  return null;
}

function runWalletCli(args, { timeoutMs, execFileImpl = execFile } = {}) {
  return new Promise((resolve, reject) => {
    execFileImpl(walletCliPath(), args, { timeout: timeoutMs, killSignal: 'SIGKILL' }, (err, stdout, stderr) => {
      if (err) {
        if (err.killed) return reject(new Error(`agent-wallet ${args[0]} timed out`));
        const detail = parseJsonLine(stderr)?.error || parseJsonLine(stdout)?.error || err.message;
        return reject(new Error(`agent-wallet ${args[0]} failed${detail ? `: ${detail}` : ''}`));
      }
      const payload = parseJsonLine(stdout);
      if (!payload) return reject(new Error(`agent-wallet ${args[0]} returned no JSON output`));
      resolve(payload);
    });
  });
}

// Returns {"balance_sats": <number>}.
async function getBalance(opts = {}) {
  return runWalletCli(['balance'], { timeoutMs: DEFAULT_BALANCE_TIMEOUT_MS, ...opts });
}

// Returns {"payment_id", "payment_hash", "status": "completed", "preimage"}.
// The CLI exits nonzero when the payment fails or is still pending after its
// internal poll window, so a resolved call means the payment completed.
async function payBolt11(invoice, opts = {}) {
  if (typeof invoice !== 'string' || !invoice.trim()) throw new Error('invoice is required');
  return runWalletCli(['send', invoice.trim()], { timeoutMs: DEFAULT_SEND_TIMEOUT_MS, ...opts });
}

// Returns the hex payment_hash encoded in a BOLT11 invoice, or null if it
// can't be decoded. Callers treat a null hash as "no lookup key", never as an
// error — decoding failures must not be conflated with an unknown payment
// status.
function bolt11PaymentHash(bolt11) {
  try {
    const decoded = decodeBolt11(bolt11);
    const section = decoded.sections.find(s => s.name === 'payment_hash');
    return typeof section?.value === 'string' ? section.value.toLowerCase() : null;
  } catch {
    return null;
  }
}

// Looks up a previously-attempted send's terminal status from wallet payment
// history, so callers can tell an ambiguous send (crash/timeout after the
// wallet may have already paid) apart from a genuine failure.
//
// The agent-wallet CLI has no per-hash/per-invoice lookup command — only
// `payments`, which dumps the full history as {"payments":[{paymentId,
// paymentHash, amountSats, direction, timestamp, destination, status}, ...]}
// with status one of "pending" | "completed" | "failed". This fetches that
// list and matches the record whose `destination` is the exact bolt11 string
// we sent (the CLI stores the raw send target verbatim), falling back to a
// `paymentHash` match decoded from the invoice.
//
// Never throws: an inability to determine the outcome is itself meaningful to
// the caller (it must NOT assume paid or not-paid), so every "can't tell"
// case — CLI error, no matching record, still-pending record — resolves to
// {inconclusive:true, reason} rather than a rejected promise.
async function getPaymentStatus({ bolt11, paymentHash } = {}, opts = {}) {
  if (!bolt11 && !paymentHash) return { inconclusive: true, reason: 'no_lookup_key' };
  const hash = paymentHash || (bolt11 ? bolt11PaymentHash(bolt11) : null);

  let payload;
  try {
    payload = await runWalletCli(['payments'], { timeoutMs: DEFAULT_BALANCE_TIMEOUT_MS, ...opts });
  } catch (err) {
    return { inconclusive: true, reason: `wallet_cli_lookup_failed: ${err.message}` };
  }

  const list = Array.isArray(payload?.payments) ? payload.payments : null;
  if (!list) return { inconclusive: true, reason: 'wallet_cli_no_lookup' };

  const match = list.find(p => p.direction === 'outbound' && (
    (bolt11 && p.destination === bolt11) ||
    (hash && typeof p.paymentHash === 'string' && p.paymentHash.toLowerCase() === hash)
  ));
  if (!match) return { inconclusive: true, reason: 'no_matching_payment_record' };
  if (match.status === 'completed') return { paid: true };
  if (match.status === 'failed') return { paid: false };
  return { inconclusive: true, reason: `payment_status_${match.status || 'unknown'}` };
}

module.exports = {
  getBalance,
  getPaymentStatus,
  payBolt11,
  walletCliPath,
};
