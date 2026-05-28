/**
 * Story 19 / ADR 0017 Amendment A1 — read a user's NIP-65 (kind 10002)
 * relay list from local strfry and return the subset that should
 * receive published events under that user's key.
 *
 * NIP-65 r-tag shape: ["r", <url>, ("read"|"write"|absent)]
 *   - "write" or absent → relay receives the user's events (we publish here).
 *   - "read"            → relay is for fetching others' events; we do not
 *                          publish under the user's key to read-only relays.
 *
 * Used by:
 *   - src/api/trustedList/index.js#handlePrepareNip51Export — composes
 *     the naddr's relays field + returns writeRelays to the caller.
 *   - src/api/profile-tags/index.js#enrichRowsWithNip51ExportStatus —
 *     surfaces writeRelays on each /pins row so the UI's pre-publish
 *     relay-preview popover can render without an extra fetch.
 *
 * Returns [] when:
 *   - the user has no kind-10002 in local strfry (per A3 fallback);
 *   - the user's kind-10002 has all read-only entries.
 */

const { exec } = require('child_process');

function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safe = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safe}'`, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const events = [];
      for (const line of stdout.split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

/**
 * Read a user's NIP-65 write relays from local strfry.
 * @param {string} pubkey — 64-char lowercase hex
 * @returns {Promise<string[]>} write-relay URLs in the order they appear
 *   in the latest kind-10002 event, with read-only entries filtered out.
 *   Empty array if the user has no kind-10002 or all entries are read-only.
 */
async function getViewerWriteRelays(pubkey) {
  if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) return [];
  let events;
  try {
    events = await strfryScan({ kinds: [10002], authors: [pubkey] });
  } catch {
    return [];
  }
  if (events.length === 0) return [];
  events.sort((a, b) => b.created_at - a.created_at);
  const latest = events[0];
  const writeRelays = [];
  for (const t of (latest.tags || [])) {
    if (t[0] !== 'r' || typeof t[1] !== 'string' || !t[1]) continue;
    const marker = t[2];
    if (marker === 'read') continue;
    writeRelays.push(t[1]);
  }
  return writeRelays;
}

module.exports = { getViewerWriteRelays };
