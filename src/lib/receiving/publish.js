/**
 * Publishing helpers — local strfry import + multi-relay fan-out.
 *
 * This is the I/O half of the core. The WebSocket publisher is lifted from
 * bin/brainstorm-create-and-publish-kind10040.js (publishEventToRelay) and the
 * local-import path from src/api/strfry/commands/publishEvent.js. Both the CLI
 * and the server's kind-0 save path use these so a freshly-set profile lands on
 * the same PROFILE_RELAYS that /api/profiles reads (rev. 2, Finding 1).
 *
 * CommonJS, dependency-loader tolerant of the Docker install path.
 */

const { exec } = require('child_process');

function loadDep(name) {
  try {
    return require(name);
  } catch {
    return require(`/usr/local/lib/node_modules/brainstorm/node_modules/${name}`);
  }
}

const WebSocket = loadDep('ws');

const DEFAULT_RELAY_TIMEOUT_MS = 10000;
const FALLBACK_PROFILE_RELAYS = ['wss://purplepag.es', 'wss://profiles.nostr1.com'];

/**
 * Resolve PROFILE_RELAYS from merged settings (same source /api/profiles uses),
 * re-read each call so overrides take effect immediately.
 */
function getProfileRelays() {
  try {
    const { getSettings } = require('../../config/settings');
    const relays = getSettings()?.aRelays?.aProfileRelays;
    if (Array.isArray(relays) && relays.length > 0) return relays;
  } catch {
    /* settings not available (e.g. CLI off-instance) — fall through */
  }
  return [...FALLBACK_PROFILE_RELAYS];
}

/**
 * Publish a signed event to one relay over a short-lived WebSocket.
 * Resolves { success, message } — never rejects.
 */
function publishEventToRelay(event, relayUrl, { timeoutMs = DEFAULT_RELAY_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const done = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { ws.close(); } catch {}
      resolve({ relay: relayUrl, ...result });
    };

    let ws;
    try {
      ws = new WebSocket(relayUrl);
    } catch (err) {
      return resolve({ relay: relayUrl, success: false, message: `connect error: ${err.message}` });
    }

    timer = setTimeout(() => done({ success: false, message: 'timeout: no relay response in 10s' }), timeoutMs);

    ws.on('open', () => {
      try { ws.send(JSON.stringify(['EVENT', event])); }
      catch (err) { done({ success: false, message: `send error: ${err.message}` }); }
    });
    ws.on('message', (data) => {
      try {
        const res = JSON.parse(data.toString());
        if (res[0] === 'OK' && res[1] === event.id) {
          done(res[2] === true
            ? { success: true, message: 'accepted' }
            : { success: false, message: res[3] || 'rejected by relay' });
        }
      } catch { /* ignore non-OK frames */ }
    });
    ws.on('error', (err) => done({ success: false, message: `ws error: ${err.message}` }));
    ws.on('close', () => done({ success: false, message: 'closed without confirmation' }));
  });
}

/**
 * Fan a signed event out to a list of relays. Resolves an array of per-relay
 * results; best-effort (individual failures don't reject the batch).
 */
async function publishToRelays(event, relays, opts = {}) {
  const list = Array.isArray(relays) ? relays.filter(Boolean) : [];
  if (list.length === 0) return [];
  return Promise.all(list.map(r => publishEventToRelay(event, r, opts)));
}

/**
 * Import a signed event into the local strfry store via `strfry import` (stdin).
 * Resolves { success, skipped?, message }. If the strfry binary is unavailable
 * (CLI run off-instance) it resolves { success:false, skipped:true } rather
 * than throwing, so the caller can still publish to relays.
 */
function importToLocalStrfry(event, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; resolve(r); } };

    let child;
    try {
      child = exec('strfry import', { timeout: timeoutMs }, (error, _stdout, stderr) => {
        if (error) {
          const missing = /not found|ENOENT|command not found/i.test(`${error.message} ${stderr}`);
          return finish({
            success: false,
            skipped: missing,
            message: missing ? 'strfry binary not found — skipped local import' : `strfry import failed: ${error.message}`,
          });
        }
        finish({ success: true, message: 'imported to local strfry' });
      });
    } catch (err) {
      return finish({ success: false, skipped: true, message: `strfry spawn error: ${err.message}` });
    }

    child.on('error', (err) => {
      const missing = err.code === 'ENOENT';
      finish({ success: false, skipped: missing, message: missing ? 'strfry binary not found — skipped local import' : err.message });
    });
    try {
      child.stdin.write(JSON.stringify(event) + '\n');
      child.stdin.end();
    } catch (err) {
      finish({ success: false, skipped: true, message: `stdin error: ${err.message}` });
    }
  });
}

/**
 * Publish a signed kind-0 (or any) event to local strfry AND the profile
 * relays. Returns { local, relays } result detail.
 */
async function publishProfileEvent(event, { relays, includeLocal = true } = {}) {
  const relayList = relays || getProfileRelays();
  const [local, relayResults] = await Promise.all([
    includeLocal ? importToLocalStrfry(event) : Promise.resolve({ success: false, skipped: true, message: 'local import disabled' }),
    publishToRelays(event, relayList),
  ]);
  return { local, relays: relayResults };
}

module.exports = {
  getProfileRelays,
  publishEventToRelay,
  publishToRelays,
  importToLocalStrfry,
  publishProfileEvent,
};
