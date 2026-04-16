const fs = require('fs');
const path = require('path');

const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
const USER_PREFS_DIR = process.env.USER_PREFS_DIR || '/var/lib/brainstorm/user-prefs';
const STRFRY_SCAN_URL = process.env.STRFRY_SCAN_URL || 'http://localhost:7778';
const DEV_SKIP = process.env.DEV_SKIP_TRUST_CHECK === 'true';

function readUserPrefs(pubkey) {
  if (!pubkey || !/^[0-9a-f]{64}$/i.test(pubkey)) return {};
  const filePath = path.join(USER_PREFS_DIR, `${pubkey.toLowerCase()}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

function resolveRankAuthor(observerPubkey) {
  const userPrefs = readUserPrefs(observerPubkey);
  if (userPrefs.rankAuthor && /^[0-9a-f]{64}$/i.test(userPrefs.rankAuthor)) {
    return userPrefs.rankAuthor.toLowerCase();
  }
  const housePrefs = readUserPrefs(process.env.OWNER_PUBKEY || '');
  if (housePrefs.rankAuthor) return housePrefs.rankAuthor.toLowerCase();
  return (process.env.OWNER_PUBKEY || '').toLowerCase();
}

async function fetchMeiliRank(subjectPubkey, povSuffix) {
  try {
    const resp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/documents/${subjectPubkey}`);
    if (!resp.ok) return null;
    const doc = await resp.json();
    const val = doc?.[`wot_rank_${povSuffix}`];
    return typeof val === 'number' ? val : null;
  } catch { return null; }
}

async function fetchStrfryTaRank(rankAuthor, subjectPubkey) {
  try {
    const filter = { kinds: [30382], authors: [rankAuthor], '#p': [subjectPubkey], limit: 1 };
    const url = `${STRFRY_SCAN_URL}/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify(filter))}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const events = await resp.json();
    const ev = Array.isArray(events) ? events[0] : null;
    if (!ev) return null;
    for (const tag of ev.tags || []) {
      if (tag[0] === 'rank') {
        const n = Number(tag[1]);
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  } catch { return null; }
}

/**
 * rank(observer, subject) -> number in [0, 100].
 * Returns 0 when no rank can be found (caller filters on >= threshold).
 * Provider-agnostic: reads whatever rank number the observer's configured
 * rankAuthor has published in Trusted Assertions (kind 30382), regardless
 * of which algorithm produced it.
 */
async function rank(observerPubkey, subjectPubkey) {
  if (DEV_SKIP) return 100;
  if (!observerPubkey || !subjectPubkey) return 0;
  if (observerPubkey === subjectPubkey) return 100;

  const rankAuthor = resolveRankAuthor(observerPubkey);
  if (!rankAuthor) return 0;

  const povSuffix = rankAuthor.slice(0, 8);

  const cached = await fetchMeiliRank(subjectPubkey, povSuffix);
  if (cached !== null) return cached;

  const direct = await fetchStrfryTaRank(rankAuthor, subjectPubkey);
  if (direct !== null) return direct;

  return 0;
}

module.exports = { rank, resolveRankAuthor };
