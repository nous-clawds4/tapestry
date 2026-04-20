/**
 * Bulk ingest: streams kind 0 events from strfry via the streaming scan API
 * and indexes them into Meilisearch. No memory limit issues — events are
 * processed line by line from the JSONL stream.
 */

import { MeiliSearch } from 'meilisearch';
import { nip19 } from 'nostr-tools';

const MEILI_URL = process.env.MEILI_URL || 'http://localhost:7700';
const TAPESTRY_URL = process.env.TAPESTRY_URL || 'http://tapestry:80';
const INDEX_NAME = 'profiles';
const BATCH_SIZE = 5000;

const meili = new MeiliSearch({ host: MEILI_URL });

let bulkRunning = false;
let bulkStats = {
  status: 'idle', indexed: 0, processed: 0,
  startedAt: null, finishedAt: null, error: null,
  errors: {
    jsonParse: 0,          // lines that aren't valid JSON
    missingFields: 0,      // events missing kind/pubkey/content
    contentParse: 0,       // content field isn't valid JSON
    npubEncode: 0,         // nip19 encoding failures
    batchFailures: 0,      // batches that failed after all retries
    batchRetries: 0,       // total retry attempts across all batches
    batchesDropped: 0,     // number of documents lost in failed batches
    duplicatesSkipped: 0,  // older duplicates skipped (dedup)
  },
  sampleErrors: [],        // up to 20 sample pubkeys/lines that failed
};

export function getBulkStatus() {
  return { ...bulkStats };
}

/**
 * Sanitize a string for Meilisearch — remove broken Unicode escape sequences
 * and other characters that cause "unexpected end of hex escape" errors.
 */
function sanitizeStr(val) {
  if (typeof val !== 'string') return '';
  // Remove lone surrogates and broken escape sequences
  return val
    .replace(/[\uD800-\uDFFF]/g, '')           // lone surrogates
    .replace(/\\u[\da-fA-F]{0,3}(?=[^a-fA-F\d]|$)/g, '') // truncated \uXXXX escapes
    .replace(/\0/g, '');                        // null bytes
}

function parseProfileDoc(event, stats) {
  if (event.kind !== 0 || !event.pubkey || !event.content) {
    stats.errors.missingFields++;
    addSampleError(stats, event.pubkey || '(no pubkey)', 'missing kind/pubkey/content');
    return null;
  }
  let profile;
  try { profile = JSON.parse(event.content); } catch (e) {
    stats.errors.contentParse++;
    addSampleError(stats, event.pubkey, `content parse: ${e.message.slice(0, 60)}`);
    return null;
  }

  let npub;
  try { npub = nip19.npubEncode(event.pubkey); } catch (e) {
    stats.errors.npubEncode++;
    addSampleError(stats, event.pubkey, `npub encode: ${e.message.slice(0, 60)}`);
    return null;
  }

  return {
    id: event.pubkey,
    pubkey: event.pubkey,
    npub,
    event_id: event.id,   // original nostr event ID (for NIP-50 relay proxy)
    event_sig: event.sig,  // original nostr event signature (for NIP-50 relay proxy)
    created_at: event.created_at,
    indexed_at: Math.floor(Date.now() / 1000),
    name: sanitizeStr(profile.name),
    display_name: sanitizeStr(profile.display_name || profile.displayName),
    displayName: sanitizeStr(profile.displayName || profile.display_name),
    username: sanitizeStr(profile.username),
    nip05: sanitizeStr(profile.nip05),
    about: sanitizeStr(profile.about),
    picture: sanitizeStr(profile.picture),
    banner: sanitizeStr(profile.banner),
    lud16: sanitizeStr(profile.lud16),
    lud06: sanitizeStr(profile.lud06),
    website: sanitizeStr(profile.website),
  };
}

function addSampleError(stats, pubkey, reason) {
  if (stats.sampleErrors.length < 20) {
    stats.sampleErrors.push({ pubkey, reason, at: new Date().toISOString() });
  }
}

export async function runBulkIngest() {
  if (bulkRunning) {
    return { status: 'already_running', ...bulkStats };
  }

  bulkRunning = true;
  bulkStats = {
    status: 'fetching', indexed: 0, processed: 0,
    startedAt: Date.now(), finishedAt: null, error: null,
    errors: {
      jsonParse: 0, missingFields: 0, contentParse: 0, npubEncode: 0,
      batchFailures: 0, batchRetries: 0, batchesDropped: 0, duplicatesSkipped: 0,
    },
    sampleErrors: [],
  };

  try {
    // Configure index settings — merge with existing filterable/sortable (preserves wot_* fields)
    const index = meili.index(INDEX_NAME);
    let existingFilterable = [];
    let existingSortable = [];
    try {
      const current = await index.getSettings();
      existingFilterable = current.filterableAttributes || [];
      existingSortable = current.sortableAttributes || [];
    } catch { /* index may not exist yet */ }
    const mergedFilterable = [...new Set([...existingFilterable, 'created_at', 'indexed_at'])];
    const mergedSortable = [...new Set([...existingSortable, 'created_at', 'indexed_at'])];

    await index.updateSettings({
      searchableAttributes: [
        'name', 'display_name', 'displayName', 'username',
        'nip05', 'npub', 'about', 'lud16', 'website',
      ],
      filterableAttributes: mergedFilterable,
      sortableAttributes: mergedSortable,
      displayedAttributes: ['*'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 } },
      pagination: { maxTotalHits: 1000 },
    });

    // Stream kind 0 events from strfry
    const filter = encodeURIComponent(JSON.stringify({ kinds: [0] }));
    const url = `${TAPESTRY_URL}/api/strfry/scan/stream?filter=${filter}`;
    console.log(`[bulk-ingest] Streaming from ${url}`);

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Stream request failed: ${resp.status}`);

    bulkStats.status = 'indexing';

    // Process the JSONL stream line by line
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let batch = [];
    const seen = new Map(); // pubkey → created_at for dedup

    async function flushBatch() {
      if (batch.length === 0) return;
      const docs = batch.splice(0);
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await index.updateDocuments(docs, { primaryKey: 'id' });
          bulkStats.indexed += docs.length;
          if (bulkStats.indexed % 50000 === 0 || bulkStats.indexed === docs.length) {
            console.log(`[bulk-ingest] Indexed: ${bulkStats.indexed.toLocaleString()} | Processed: ${bulkStats.processed.toLocaleString()}`);
          }
          return;
        } catch (err) {
          bulkStats.errors.batchRetries++;
          console.error(`[bulk-ingest] Batch error (attempt ${attempt}/${MAX_RETRIES}, ${docs.length} docs):`, err.message);
          if (attempt < MAX_RETRIES) {
            const delay = 1000 * Math.pow(2, attempt - 1);
            await new Promise(r => setTimeout(r, delay));
          } else {
            // Don't throw — log the failure and continue with remaining events
            bulkStats.errors.batchFailures++;
            bulkStats.errors.batchesDropped += docs.length;
            console.error(`[bulk-ingest] DROPPED ${docs.length} docs after ${MAX_RETRIES} retries: ${err.message}`);
            addSampleError(bulkStats, `batch of ${docs.length}`, `batch failed: ${err.message.slice(0, 80)}`);
          }
        }
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (!line.trim()) continue;
        bulkStats.processed++;

        let event;
        try { event = JSON.parse(line); } catch (e) {
          bulkStats.errors.jsonParse++;
          addSampleError(bulkStats, `line #${bulkStats.processed}`, `JSON parse: ${e.message.slice(0, 60)}`);
          continue;
        }

        // Dedup: keep newest per pubkey
        const existing = seen.get(event.pubkey);
        if (existing && existing >= event.created_at) {
          bulkStats.errors.duplicatesSkipped++;
          continue;
        }
        seen.set(event.pubkey, event.created_at);

        const doc = parseProfileDoc(event, bulkStats);
        if (!doc) continue;

        batch.push(doc);
        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      bulkStats.processed++;
      try {
        const event = JSON.parse(buffer);
        const existing = seen.get(event.pubkey);
        if (!existing || existing < event.created_at) {
          const doc = parseProfileDoc(event);
          if (doc) batch.push(doc);
        }
      } catch {}
    }

    // Final flush
    await flushBatch();

    bulkStats.status = 'complete';
    bulkStats.finishedAt = Date.now();
    const elapsed = ((bulkStats.finishedAt - bulkStats.startedAt) / 1000).toFixed(1);
    const e = bulkStats.errors;
    const totalSkipped = e.jsonParse + e.missingFields + e.contentParse + e.npubEncode;
    console.log(`[bulk-ingest] Done. ${bulkStats.indexed.toLocaleString()} profiles indexed in ${elapsed}s.`);
    console.log(`[bulk-ingest] Processed: ${bulkStats.processed.toLocaleString()} | Duplicates skipped: ${e.duplicatesSkipped.toLocaleString()}`);
    console.log(`[bulk-ingest] Parse errors: ${totalSkipped} (json: ${e.jsonParse}, missingFields: ${e.missingFields}, content: ${e.contentParse}, npub: ${e.npubEncode})`);
    if (e.batchFailures > 0) {
      console.log(`[bulk-ingest] Batch failures: ${e.batchFailures} (${e.batchesDropped} docs dropped, ${e.batchRetries} retries)`);
    }
    if (bulkStats.sampleErrors.length > 0) {
      console.log(`[bulk-ingest] Sample errors:`, JSON.stringify(bulkStats.sampleErrors.slice(0, 5)));
    }

    return { status: 'complete', indexed: bulkStats.indexed, processed: bulkStats.processed, elapsed, errors: bulkStats.errors, sampleErrors: bulkStats.sampleErrors };
  } catch (err) {
    console.error('[bulk-ingest] Error:', err.message);
    bulkStats.status = 'error';
    bulkStats.error = err.message;
    bulkStats.finishedAt = Date.now();
    return { status: 'error', error: err.message };
  } finally {
    bulkRunning = false;
  }
}
