/**
 * NIP-50 Search Execution
 *
 * Parses NIP-50 search strings with custom WoT extensions,
 * queries the Meilisearch API via nostr-search-api,
 * and converts profile hits into kind 0 nostr events.
 */

import WebSocket from 'ws';
import { getHouseDelegatedPubkey, getHouseFilters, getHouseSort, readUserPrefs } from './settings.js';

/**
 * Parse a NIP-50 search string into a clean query and WoT extensions.
 *
 * Input:  "jack observer:a8ca55ca... sort:followers:desc filter:rank:gte:2"
 * Output: {
 *   query: "jack",
 *   extensions: {
 *     observer: "a8ca55ca...",
 *     sort: { metric: "followers", direction: "desc" },
 *     filters: [{ metric: "rank", op: "gte", value: "2" }]
 *   }
 * }
 */
export function parseSearchString(searchStr) {
  if (!searchStr || typeof searchStr !== 'string') {
    return { query: '', extensions: { observer: null, sort: null, filters: [] } };
  }

  const tokens = searchStr.trim().split(/\s+/);
  const queryParts = [];
  const extensions = { observer: null, sort: null, filters: [] };

  for (const token of tokens) {
    if (token.startsWith('observer:')) {
      extensions.observer = token.slice('observer:'.length);
    } else if (token.startsWith('sort:')) {
      const parts = token.slice('sort:'.length).split(':');
      extensions.sort = {
        metric: parts[0],
        direction: parts[1] || 'desc',
      };
    } else if (token.startsWith('filter:')) {
      const parts = token.slice('filter:'.length).split(':');
      if (parts.length >= 3) {
        extensions.filters.push({
          metric: parts[0],
          op: parts[1],
          value: parts[2],
        });
      }
    } else {
      // Not an extension — part of the search query
      queryParts.push(token);
    }
  }

  return {
    query: queryParts.join(' '),
    extensions,
  };
}

/**
 * Resolve the delegated pubkey (observer) for WoT field namespacing.
 *
 * The observer pubkey is the *user's* pubkey, not the delegated pubkey.
 * We need to look up the user's preferences to find their rankAuthor
 * (delegated pubkey), which is what Meilisearch fields are namespaced by.
 *
 * Priority:
 *   1. Explicit observer from search string → look up user prefs → rankAuthor
 *   2. House default delegated pubkey from settings
 *
 * Returns { delegatedPubkey, suffix } or { delegatedPubkey: null, suffix: null }
 */
export function resolveObserver(extensions) {
  let delegatedPubkey = null;

  if (extensions.observer) {
    // observer is the user's pubkey — look up their saved prefs to find
    // the delegated pubkey (rankAuthor) whose scores are in Meilisearch
    const userPrefs = readUserPrefs(extensions.observer);
    delegatedPubkey = userPrefs.rankAuthor || null;

    // If no prefs found, try using the observer value directly as the
    // delegated pubkey (caller may have passed the delegated pubkey itself)
    if (!delegatedPubkey) {
      delegatedPubkey = extensions.observer;
    }
  }

  // Fall back to house default
  if (!delegatedPubkey) {
    delegatedPubkey = getHouseDelegatedPubkey();
  }

  const suffix = delegatedPubkey ? delegatedPubkey.slice(0, 8) : null;
  return { delegatedPubkey, suffix };
}

/**
 * Execute a search query against the Meilisearch API via nostr-search-api.
 *
 * @param {string} searchApiUrl - Base URL of nostr-search-api (e.g., http://127.0.0.1:3069)
 * @param {string} query - The clean search query (no extensions)
 * @param {object} extensions - Parsed NIP-50 extensions
 * @param {number} limit - Max results to return
 * @returns {object} - { hits: [...], estimatedTotalHits, processingTimeMs, ... }
 */
export async function executeSearchQuery(searchApiUrl, query, extensions, limit = 100) {
  const { suffix } = resolveObserver(extensions);

  const url = new URL('/api/search', searchApiUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(Math.min(limit, 200)));
  url.searchParams.set('offset', '0');

  // Resolve sort — from extensions, or fall back to house sort, or default to followers:desc
  const sort = extensions.sort || getHouseSort() || { metric: 'followers', direction: 'desc' };
  if (suffix && sort.metric) {
    url.searchParams.set('sort', `wot_${sort.metric}_${suffix}:${sort.direction || 'desc'}`);
  }

  // Resolve filters — from extensions, or fall back to house filters
  const extensionFilters = extensions.filters;
  if (suffix && extensionFilters.length > 0) {
    // Build wotFilters from NIP-50 extensions
    const wotFilters = {};
    for (const f of extensionFilters) {
      const fieldName = `wot_${f.metric}_${suffix}`;
      // Map NIP-50 ops to the format expected by nostr-search-api
      // The search API expects { enabled: true, cutoff: <number> } where cutoff is the >= threshold
      const value = parseFloat(f.value);
      if (!isNaN(value)) {
        wotFilters[fieldName] = { enabled: true, cutoff: value };
      }
    }
    if (Object.keys(wotFilters).length > 0) {
      url.searchParams.set('wotFilters', JSON.stringify(wotFilters));
    }
  } else if (suffix) {
    // Fall back to house filters if available
    const houseFilters = getHouseFilters();
    if (houseFilters) {
      const namespacedFilters = {};
      for (const [metric, config] of Object.entries(houseFilters)) {
        namespacedFilters[`wot_${metric}_${suffix}`] = config;
      }
      url.searchParams.set('wotFilters', JSON.stringify(namespacedFilters));
    }
  }

  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[search] nostr-search-api returned ${resp.status}: ${text.slice(0, 300)}`);
      return { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, error: true };
    }
    return await resp.json();
  } catch (err) {
    console.error(`[search] Failed to reach nostr-search-api: ${err.message}`);
    return { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, error: true };
  }
}

/**
 * Check whether WoT scores are loaded in Meilisearch for a given POV suffix.
 *
 * Queries the Meilisearch settings to see if any wot_*_<suffix> fields
 * exist in the filterable attributes.
 *
 * @param {string} searchApiUrl - Base URL of nostr-search-api
 * @param {string} suffix - 8-char delegated pubkey prefix
 * @returns {boolean} - true if scores are loaded
 */
export async function checkScoresLoaded(searchApiUrl, suffix) {
  if (!suffix) return false;

  try {
    const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
    const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
    const resp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/settings`);
    if (!resp.ok) return false;

    const settings = await resp.json();
    const filterableAttrs = settings.filterableAttributes || [];
    const hasWotFields = filterableAttrs.some(f => f.endsWith(`_${suffix}`) && f.startsWith('wot_'));
    return hasWotFields;
  } catch (err) {
    console.warn(`[search] Failed to check scores for suffix ${suffix}: ${err.message}`);
    return false;
  }
}

/**
 * Fetch original events from strfry by their event IDs.
 * Returns a Map of event_id → event object with valid signatures.
 *
 * @param {string} strfryUrl - WebSocket URL for strfry (e.g., ws://127.0.0.1:7777)
 * @param {string[]} eventIds - Array of hex event IDs to fetch
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {Promise<Map<string, object>>} Map of event_id → original event
 */
export function fetchEventsFromStrfry(strfryUrl, eventIds, timeoutMs = 5000) {
  if (!eventIds.length) return Promise.resolve(new Map());

  return new Promise((resolve) => {
    const events = new Map();
    const ws = new WebSocket(strfryUrl);
    const subId = `_fetch_${Date.now()}`;
    const timer = setTimeout(() => { try { ws.close(); } catch {} resolve(events); }, timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify(['REQ', subId, { ids: eventIds }]));
    });
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT' && msg[1] === subId && msg[2]) {
          events.set(msg[2].id, msg[2]);
        } else if (msg[0] === 'EOSE' && msg[1] === subId) {
          clearTimeout(timer);
          ws.send(JSON.stringify(['CLOSE', subId]));
          ws.close();
          resolve(events);
        }
      } catch {}
    });
    ws.on('error', () => { clearTimeout(timer); resolve(events); });
  });
}
