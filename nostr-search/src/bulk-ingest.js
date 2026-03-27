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
let bulkStats = { status: 'idle', indexed: 0, processed: 0, startedAt: null, finishedAt: null, error: null };

export function getBulkStatus() {
  return { ...bulkStats };
}

function parseProfileDoc(event) {
  if (event.kind !== 0 || !event.pubkey) return null;
  let profile;
  try { profile = JSON.parse(event.content); } catch { return null; }

  return {
    id: event.pubkey,
    pubkey: event.pubkey,
    npub: nip19.npubEncode(event.pubkey),
    created_at: event.created_at,
    name: profile.name || '',
    display_name: profile.display_name || profile.displayName || '',
    displayName: profile.displayName || profile.display_name || '',
    username: profile.username || '',
    nip05: profile.nip05 || '',
    about: profile.about || '',
    picture: profile.picture || '',
    banner: profile.banner || '',
    lud16: profile.lud16 || '',
    lud06: profile.lud06 || '',
    website: profile.website || '',
  };
}

export async function runBulkIngest() {
  if (bulkRunning) {
    return { status: 'already_running', ...bulkStats };
  }

  bulkRunning = true;
  bulkStats = { status: 'fetching', indexed: 0, processed: 0, startedAt: Date.now(), finishedAt: null, error: null };

  try {
    // Configure index settings
    const index = meili.index(INDEX_NAME);
    await index.updateSettings({
      searchableAttributes: [
        'name', 'display_name', 'displayName', 'username',
        'nip05', 'npub', 'about', 'lud16', 'website',
      ],
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
      await index.updateDocuments(docs, { primaryKey: 'id' });
      bulkStats.indexed += docs.length;
      if (bulkStats.indexed % 50000 === 0 || bulkStats.indexed === docs.length) {
        console.log(`[bulk-ingest] Indexed: ${bulkStats.indexed.toLocaleString()} | Processed: ${bulkStats.processed.toLocaleString()}`);
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
        try { event = JSON.parse(line); } catch { continue; }

        // Dedup: keep newest per pubkey
        const existing = seen.get(event.pubkey);
        if (existing && existing >= event.created_at) continue;
        seen.set(event.pubkey, event.created_at);

        const doc = parseProfileDoc(event);
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
    console.log(`[bulk-ingest] Done. ${bulkStats.indexed.toLocaleString()} profiles indexed in ${elapsed}s.`);

    return { status: 'complete', indexed: bulkStats.indexed, processed: bulkStats.processed, elapsed };
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
