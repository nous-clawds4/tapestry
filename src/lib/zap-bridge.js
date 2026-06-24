const { exec } = require('child_process');
const WebSocket = require('ws');

// The bounty state machine only trusts the kind-9735 receipt on the LOCAL relay
// it scans. But an LNURL provider publishes that receipt to the relays named in
// the zap request's `relays` tag — which for an external provider can't be
// wss://localhost. This bridge subscribes to those (publicly-reachable) relays,
// grabs the receipt, and imports it locally so settlement becomes visible.

const DEFAULT_TIMEOUT_MS = 60_000;

// Import an already-signed event into the local strfry (same mechanism the
// kind-30382 publisher uses). Events arrive on stdin, one JSON per line.
function importEventToStrfry(event, { execImpl = exec, timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execImpl('strfry import', { timeout: timeoutMs }, (err) => {
      if (err) return reject(new Error(`strfry import failed: ${err.message}`));
      resolve({ imported: true });
    });
    child.stdin.write(`${JSON.stringify(event)}\n`);
    child.stdin.end();
  });
}

// Subscribe to `relays` and resolve the first kind-9735 that e-tags `claimId`
// (or null on timeout). Raw REQ/EVENT over ws so we don't depend on
// nostr-tools' global-WebSocket shim or its hardcoded module path.
function fetchZapReceipt({
  claimId,
  relays,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  wsFactory = (url) => new WebSocket(url),
} = {}) {
  if (!claimId) throw new Error('claimId is required');
  const urls = (relays || []).filter(Boolean);
  if (!urls.length) return Promise.resolve(null);

  return new Promise((resolve) => {
    const sockets = [];
    let settled = false;
    const subId = `zb-${String(claimId).slice(0, 16)}`;
    const finish = (receipt) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const ws of sockets) { try { ws.close(); } catch { /* ignore */ } }
      resolve(receipt);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    for (const url of urls) {
      let ws;
      try { ws = wsFactory(url); } catch { continue; }
      sockets.push(ws);
      ws.on('open', () => {
        try { ws.send(JSON.stringify(['REQ', subId, { kinds: [9735], '#e': [claimId] }])); } catch { /* ignore */ }
      });
      ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        if (msg[0] === 'EVENT' && msg[1] === subId && msg[2]?.kind === 9735) finish(msg[2]);
      });
      ws.on('error', () => { /* a dead relay shouldn't reject the whole fetch */ });
    }
  });
}

// Fetch the receipt from the zap relays and import it into the local relay.
// Returns the receipt event (or null if none arrived / import failed).
async function bridgeZapReceipt({ claimId, relays, timeoutMs, execImpl, wsFactory } = {}) {
  const receipt = await fetchZapReceipt({ claimId, relays, timeoutMs, wsFactory });
  if (!receipt) return null;
  try {
    await importEventToStrfry(receipt, { execImpl });
  } catch (err) {
    console.error('[zap-bridge] import failed:', err.message);
    return null;
  }
  return receipt;
}

module.exports = { importEventToStrfry, fetchZapReceipt, bridgeZapReceipt };
