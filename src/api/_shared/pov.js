/**
 * Shared POV resolution.
 *
 * Both the meili search proxy and the profile-tags endpoints need the same
 * answer to "given a request, what is the active POV (delegated pubkey →
 * 8-char suffix), and what filter/sort apply?". This helper is the single
 * source of truth for that computation, per ADR-0002.
 *
 * Cascade:
 *   1. If wotPov === 'user' && userPubkey is present → read user prefs file
 *      (rankAuthor → delegatedPubkey, filters, sortConfig → sort).
 *   2. Fall back to house prefs (settings.grapevine.searchPreferences) for
 *      anything still unresolved.
 *
 * Returns: { delegatedPubkey, povSuffix, filters, sort, minRank }.
 *   - povSuffix is delegatedPubkey.slice(0,8) or null.
 *   - minRank is filters?.rank?.min when finite-numeric; otherwise null.
 */

const fs = require('fs');
const path = require('path');

// Hardcoded path matches the previous inline location in the meili proxy.
// Override-by-env was not introduced — this is a pure code-extraction.
const USER_PREFS_DIR = '/var/lib/brainstorm/user-prefs';

function readUserPrefs(pubkey) {
  if (!pubkey || pubkey.length !== 64) return {};
  const filePath = path.join(USER_PREFS_DIR, `${pubkey.replace(/[^0-9a-f]/gi, '')}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

function loadHousePrefs() {
  try {
    const { getSettings } = require('../../config/settings');
    const settings = getSettings();
    return settings.grapevine?.searchPreferences || {};
  } catch { return {}; }
}

function resolvePov({ wotPov, userPubkey }, deps = {}) {
  const readUserPrefsImpl = deps.readUserPrefsImpl || readUserPrefs;
  const loadHousePrefsImpl = deps.loadHousePrefsImpl || loadHousePrefs;
  const housePrefs = loadHousePrefsImpl();

  let delegatedPubkey = null;
  let filters = null;
  let sort = null;
  // Which cascade step supplied the delegate (additive, ADR 0002 provenance).
  let delegateSource = 'none';

  const requestedPov = (wotPov === 'user' && userPubkey) ? 'user' : 'house';

  if (wotPov === 'user' && userPubkey) {
    const userPrefs = readUserPrefsImpl(userPubkey);
    delegatedPubkey = userPrefs.rankAuthor || null;
    if (delegatedPubkey) delegateSource = 'user-prefs';
    filters = userPrefs.filters || null;
    sort = userPrefs.sortConfig || null;
  }

  if (!delegatedPubkey) {
    delegatedPubkey = housePrefs.delegatedPubkey || null;
    if (delegatedPubkey) delegateSource = 'house-prefs';
  }
  if (!filters) filters = housePrefs.filters || null;
  if (!sort) sort = housePrefs.sort || null;

  const povSuffix = delegatedPubkey ? delegatedPubkey.slice(0, 8) : null;
  const minRankRaw = filters?.rank?.min;
  const minRank = (typeof minRankRaw === 'number' && Number.isFinite(minRankRaw))
    ? minRankRaw
    : null;

  return { delegatedPubkey, povSuffix, filters, sort, minRank, requestedPov, delegateSource };
}

module.exports = { resolvePov, readUserPrefs };
