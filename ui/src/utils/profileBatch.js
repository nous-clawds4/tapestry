/**
 * Chunked profile lookups.
 * ADR: engineering-team/decisions/profile-lookup-bounds/0001-chunk-at-the-cap-in-the-shared-hook.md
 *
 * `/api/profiles` refuses more than PROFILE_CHUNK pubkeys per request, so a page with many
 * distinct authors has to ask in batches. Sending them all in one querystring is the defect
 * this module exists to remove: it earns a 400, the caller swallows it, and every author cell
 * silently degrades to a truncated pubkey.
 *
 * NO react import — deliberately. There is no jsdom in this repo (ADR graph-curation-ui/0001)
 * and `react` is not resolvable from the repo root, so anything importing it cannot be
 * executed by a test. Keeping the core pure is what makes the chunking provable rather than
 * merely source-asserted. Same reasoning as ui/src/utils/authorDisplay.js.
 */

/** The endpoint's own cap (src/api/profiles/fetchProfiles.js). One number, both sides. */
export const PROFILE_CHUNK = 50;

/**
 * Marks a pubkey whose lookup FAILED, as distinct from one the server searched for and did
 * not find (which stays `null`). Collapsing the two would make every profile-less author —
 * including a fresh instance's own assistant — read as an error.
 *
 * Never write this to a cache: a transient failure cached is a permanent one.
 */
export const PROFILE_LOOKUP_FAILED = Object.freeze({ __lookupFailed: true });

/**
 * Look up profiles for any number of pubkeys, in batches the endpoint will accept.
 *
 * Batches run sequentially and each is merged as it lands, so names fill in progressively and
 * one slow or failed batch costs only its own PROFILE_CHUNK. This mirrors the loop five
 * Brainstorm* pages already run by hand (e.g. ui/src/pages/BrainstormFollowers.jsx:95-115).
 *
 * @param {string[]} pubkeys
 * @param {object}   [opts]
 * @param {function} [opts.fetchImpl]  defaults to globalThis.fetch; injected by tests
 * @param {number}   [opts.chunkSize]  defaults to PROFILE_CHUNK
 * @param {function} [opts.onBatch]    (partialProfiles) => void, after each batch
 * @param {function} [opts.isCancelled] () => boolean, checked before each batch
 * @returns {Promise<Object>} plain object: { [pubkey]: profile | null | PROFILE_LOOKUP_FAILED }
 */
export async function fetchProfilesChunked(pubkeys, opts = {}) {
  const {
    fetchImpl = (typeof globalThis !== 'undefined' ? globalThis.fetch : undefined),
    chunkSize = PROFILE_CHUNK,
    onBatch,
    isCancelled,
  } = opts;

  const results = {};
  const list = Array.isArray(pubkeys) ? pubkeys : [];
  if (list.length === 0) return results;

  for (let i = 0; i < list.length; i += chunkSize) {
    if (isCancelled && isCancelled()) break;

    const batch = list.slice(i, i + chunkSize);
    const batchResult = {};

    try {
      const res = await fetchImpl(`/api/profiles?pubkeys=${batch.join(',')}`);
      // A rejection may carry no body at all (the request-head ceiling returns 431 with an
      // empty one), so parsing is part of what can fail — not a step that runs after it.
      const data = await res.json();
      if (!data || data.success !== true || !data.profiles) {
        throw new Error(data && data.error ? data.error : `profile lookup failed (HTTP ${res.status})`);
      }
      for (const pk of batch) {
        // A pubkey the server searched for and did not return has no profile; that is a
        // null, not a failure.
        batchResult[pk] = Object.prototype.hasOwnProperty.call(data.profiles, pk)
          ? data.profiles[pk]
          : null;
      }
    } catch (err) {
      // One bad batch costs only its own pubkeys — keep going. The sentinel is what the
      // operator sees; this line is what a developer needs to know WHY.
      console.warn(`useProfiles: batch of ${batch.length} failed —`, err && err.message ? err.message : err);
      for (const pk of batch) batchResult[pk] = PROFILE_LOOKUP_FAILED;
    }

    Object.assign(results, batchResult);
    if (onBatch) onBatch(batchResult);
  }

  return results;
}
