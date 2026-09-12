/**
 * One answer to "does this assistant have a profile?" — assistant-profile #1, ADR 0001.
 *
 * The rule (ratified at planning; its open question resolved at approval): an assistant has a
 * profile when a kind 0 signed by its key is on the local relay, or — if the local relay has
 * none — on a relay the instance publishes assistant profiles to. A profile found only on a
 * publish relay is copied to the local relay. If the publish relays cannot be reached, the local
 * answer stands. /api/assistant/status answers through this module, and every setup surface
 * reads that endpoint, so they cannot disagree.
 *
 * Dependencies are injectable the feedReadPath way (`options.deps?.X ?? options.X ?? realX`), so
 * every branch runs stack-free. The real helpers load their heavy modules lazily, inside the
 * function, so this file loads in a bare checkout.
 */

const { exec } = require('child_process');

/** How long the publish relays get to answer before the local answer stands. */
const RELAY_BUDGET_MS = 4000;

/** How long a relay miss is remembered, so every page load does not re-query every relay. */
const NEGATIVE_MEMO_MS = 5 * 60 * 1000;

// assistant pubkey → when its publish relays last came back empty. Only misses are remembered:
// a found profile is re-checked, and a failed copy home retried, every time.
const relayMisses = new Map();

// ─── Real helpers (used when no deps are injected) ──────────────────────────────

/** The newest kind 0 by `pubkey` on the local relay, or null. */
function realScanLocalKind0(pubkey) {
  const filter = JSON.stringify({ kinds: [0], authors: [pubkey], limit: 1 });
  return new Promise((resolve) => {
    exec(`strfry scan '${filter.replace(/'/g, "'\\''")}' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 10000,
    }, (error, stdout) => {
      if (error || !stdout || !stdout.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim().split('\n')[0]));
      } catch {
        resolve(null);
      }
    });
  });
}

/** Write one signed event to the local relay. strfry verifies the signature on import. */
function importToLocalRelay(event) {
  return new Promise((resolve, reject) => {
    const child = exec('strfry import', { timeout: 10000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
    child.stdin.write(JSON.stringify(event) + '\n');
    child.stdin.end();
  });
}

/** Every kind 0 by `pubkey` the relays return within `maxWait`. The pool verifies signatures. */
async function realQueryRelaysKind0(relays, pubkey, { maxWait = RELAY_BUDGET_MS } = {}) {
  if (!Array.isArray(relays) || relays.length === 0) return [];
  // Node has no WebSocket global, and nostr-tools' SimplePool needs one.
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = require('ws');
  }
  const { SimplePool } = require('nostr-tools');
  const pool = new SimplePool();
  try {
    return await pool.querySync(relays, { kinds: [0], authors: [pubkey] }, { maxWait });
  } finally {
    try { pool.close(relays); } catch { /* ignore */ }
  }
}

/** The instance's publish relays. Lazy, so there is no load-time cycle with index.js. */
function realGetPublishRelays() {
  return require('./index').getAssistantPublishRelays();
}

// ─── The resolver ───────────────────────────────────────────────────────────────

function parseProfile(event) {
  try {
    const content = JSON.parse(event.content);
    return content && typeof content === 'object' ? content : null;
  } catch {
    return null;
  }
}

/** Race `promise` against `ms`; running out of time resolves to `fallback` instead of rejecting. */
function withinBudget(promise, ms, fallback) {
  let timer;
  const outOfTime = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  return Promise.race([promise, outOfTime]).finally(() => clearTimeout(timer));
}

/**
 * @param {Object} options
 * @param {string} options.assistantPubkey - hex pubkey of the assistant being asked about
 * @param {boolean} [options.allowRelayFallback=false] - may the publish relays be asked, and a
 *   profile found there copied home? False for anonymous callers, so a public read never writes.
 * @param {Object} [options.deps] - injectable: scanLocalKind0, queryRelaysKind0, importEvent,
 *   getPublishRelays, now, memo (each also accepted directly on `options`).
 * @returns {Promise<{ hasProfile: boolean, profile: Object|null, event: Object|null,
 *   source: 'local'|'relay'|null }>}
 */
async function resolveAssistantProfileState(options = {}) {
  const { assistantPubkey, allowRelayFallback = false, deps } = options;
  const scanLocalKind0 = deps?.scanLocalKind0 ?? options.scanLocalKind0 ?? realScanLocalKind0;
  const queryRelaysKind0 = deps?.queryRelaysKind0 ?? options.queryRelaysKind0 ?? realQueryRelaysKind0;
  const importEvent = deps?.importEvent ?? options.importEvent ?? importToLocalRelay;
  const getPublishRelays = deps?.getPublishRelays ?? options.getPublishRelays ?? realGetPublishRelays;
  const now = deps?.now ?? options.now ?? Date.now;
  const memo = deps?.memo ?? options.memo ?? relayMisses;

  const none = { hasProfile: false, profile: null, event: null, source: null };

  // 1. The local relay: the first source (BIBLE §30). A hit needs no relay traffic at all.
  const local = await scanLocalKind0(assistantPubkey);
  if (local) return { hasProfile: true, profile: parseProfile(local), event: local, source: 'local' };

  // 2. An anonymous caller gets the local answer only.
  if (!allowRelayFallback) return none;

  // 3. A recent miss is remembered.
  const missedAt = memo.get(assistantPubkey);
  if (missedAt !== undefined && now() - missedAt < NEGATIVE_MEMO_MS) return none;

  // 4. The publish relays, within the budget. A failure or a timeout is "not found".
  let events = [];
  try {
    const found = await withinBudget(
      Promise.resolve().then(() => queryRelaysKind0(getPublishRelays(), assistantPubkey, { maxWait: RELAY_BUDGET_MS })),
      RELAY_BUDGET_MS,
      [],
    );
    events = Array.isArray(found) ? found : [];
  } catch (err) {
    console.warn(`[assistant] publish-relay profile check failed for ${String(assistantPubkey).slice(0, 8)}: ${err.message}`);
  }
  const newest = events
    .filter((e) => e && e.kind === 0 && e.pubkey === assistantPubkey)
    .reduce((best, e) => (!best || e.created_at > best.created_at ? e : best), null);

  if (!newest) {
    memo.set(assistantPubkey, now());
    return none;
  }

  // 5. Found only on a publish relay: copy it home. A failed copy is logged, not fatal — the
  //    profile exists, and the next check retries the repair.
  memo.delete(assistantPubkey);
  try {
    await importEvent(newest);
  } catch (err) {
    console.warn(`[assistant] could not copy ${String(assistantPubkey).slice(0, 8)}'s profile to the local relay: ${err.message}`);
  }
  return { hasProfile: true, profile: parseProfile(newest), event: newest, source: 'relay' };
}

module.exports = { resolveAssistantProfileState, importToLocalRelay };
