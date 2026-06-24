const { execFile } = require('child_process');
const path = require('path');

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

module.exports = {
  getBalance,
  payBolt11,
  walletCliPath,
};
