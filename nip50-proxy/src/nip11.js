/**
 * NIP-11 Relay Information Document
 *
 * Fetches strfry's NIP-11 info and merges NIP-50 search capabilities on top.
 * Returns the merged document for HTTP GET requests with Accept: application/nostr+json.
 */

const STRFRY_URL = process.env.STRFRY_URL || 'http://127.0.0.1:7777';

// Cache strfry's NIP-11 info (refreshed every 5 minutes)
let cachedStrfryInfo = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch strfry's native NIP-11 info document.
 */
async function fetchStrfryInfo() {
  const now = Date.now();
  if (cachedStrfryInfo && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedStrfryInfo;
  }

  try {
    const resp = await fetch(STRFRY_URL, {
      headers: { Accept: 'application/nostr+json' },
    });
    if (resp.ok) {
      cachedStrfryInfo = await resp.json();
      cacheTimestamp = now;
      return cachedStrfryInfo;
    }
  } catch (err) {
    console.warn(`[nip11] Failed to fetch strfry NIP-11 info: ${err.message}`);
  }

  return cachedStrfryInfo || {};
}

/**
 * Build the merged NIP-11 relay info document.
 * Preserves all strfry relay info and adds NIP-50 search capabilities.
 */
export async function getNip11Info() {
  const strfryInfo = await fetchStrfryInfo();

  // Merge supported_nips — add 50 if not already present
  const existingNips = new Set(strfryInfo.supported_nips || []);
  existingNips.add(50);
  const supportedNips = [...existingNips].sort((a, b) => a - b);

  return {
    ...strfryInfo,
    software: `strfry+nip50-proxy`,
    supported_nips: supportedNips,
    limitation: {
      ...(strfryInfo.limitation || {}),
      search_extensions: ['observer', 'sort', 'filter'],
    },
    search_capabilities: {
      description: 'Full-text profile search with Web of Trust scoring via Meilisearch',
      supported_kinds: [0],
      extensions: {
        observer: {
          description: 'Hex pubkey for WoT point of view. Falls back to relay house POV if omitted.',
          format: 'observer:<hex-pubkey>',
        },
        sort: {
          description: 'Sort results by a WoT metric.',
          format: 'sort:<metric>:<asc|desc>',
          example: 'sort:followers:desc',
        },
        filter: {
          description: 'Filter results by a WoT metric threshold.',
          format: 'filter:<metric>:<op>:<value>',
          ops: ['gte', 'lte', 'gt', 'lt', 'eq'],
          example: 'filter:rank:gte:2',
        },
      },
    },
  };
}
