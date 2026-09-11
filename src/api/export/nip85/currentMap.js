/**
 * The user's CURRENT Treasure Map, for regeneration that preserves it — dlist-curation #7.
 *
 * Local strfry first; the NIP-85 home relay plus the configured Trusted-Assertion and popular
 * general-purpose relays only when absent locally; the newest copy wins. "No Map anywhere" is a
 * plain outcome (`where: 'none'`); a lookup ERROR is not — it rejects, so no caller ever
 * regenerates blind. The seams are story 4's exported `scanLocal` / `fetchFromRelays`
 * (src/api/dlist-curation), injectable for tests.
 */

const { getConfigFromFile } = require('../../../utils/config');

function newest(events) {
  return (Array.isArray(events) ? events : [])
    .filter((e) => e && typeof e === 'object')
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0] || null;
}

function defaultRelays() {
  const relayUrl = getConfigFromFile('BRAINSTORM_RELAY_URL', '');
  const nip85HomeRelay = getConfigFromFile('BRAINSTORM_NIP85_HOME_RELAY', relayUrl);
  let aRelays = {};
  try { aRelays = require('../../../config/settings').getSettings()?.aRelays || {}; } catch { aRelays = {}; }
  const urls = [nip85HomeRelay, ...(aRelays.aTrustedAssertionRelays || []), ...(aRelays.aPopularGeneralPurposeRelays || [])];
  return [...new Set(urls.filter((u) => typeof u === 'string' && /^wss?:\/\//i.test(u.trim())).map((u) => u.trim()))];
}

/**
 * @param {string} pubkey  the Map's author
 * @param {{scanLocal?: Function, fetchFromRelays?: Function, relays?: string[]}} deps
 * @returns {Promise<{ event: Object|null, where: 'local'|'relay'|'none' }>}
 */
async function fetchCurrentMap(pubkey, deps = {}) {
  const seams = require('../../dlist-curation');
  const scanLocal = deps.scanLocal || seams.scanLocal;
  const fetchFromRelays = deps.fetchFromRelays || seams.fetchFromRelays;
  const relays = Array.isArray(deps.relays) ? deps.relays : defaultRelays();
  const filter = { kinds: [10040], authors: [pubkey] };

  let local;
  try { local = newest(await scanLocal(filter)); }
  catch (err) { throw new Error(`could not read the current Treasure Map from local strfry: ${err.message}`); }
  if (local) return { event: local, where: 'local' };

  let remote;
  try { remote = newest(await fetchFromRelays(filter, relays, { strict: true })); }
  catch (err) { throw new Error(`could not read the current Treasure Map from the relays: ${err.message}`); }
  if (remote) return { event: remote, where: 'relay' };

  return { event: null, where: 'none' };
}

module.exports = { fetchCurrentMap, defaultRelays };
