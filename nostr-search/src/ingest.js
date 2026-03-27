import WebSocket from 'ws';
import { MeiliSearch } from 'meilisearch';
import { nip19 } from 'nostr-tools';

const RELAY_URL = process.env.RELAY_URL || 'wss://wot.grapevine.network';
const MEILI_URL = process.env.MEILI_URL || 'http://localhost:7700';
const INDEX_NAME = 'profiles';
const BATCH_SIZE = 500;
const FLUSH_INTERVAL_MS = 3000;

const meili = new MeiliSearch({ host: MEILI_URL });

// Track latest created_at per pubkey for dedup
const seen = new Map();
let batch = [];
let totalIndexed = 0;
let flushTimer = null;
let activeWs = null;
let syncing = false;

async function configureIndex() {
  const index = meili.index(INDEX_NAME);

  await index.updateSettings({
    searchableAttributes: [
      'name',
      'display_name',
      'displayName',
      'username',
      'nip05',
      'npub',
      'about',
      'lud16',
      'website',
    ],
    displayedAttributes: ['*'],
    rankingRules: [
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 },
    },
    pagination: { maxTotalHits: 1000 },
  });

  console.log('[meili] Index configured');
}

async function flushBatch() {
  if (batch.length === 0) return;
  const docs = batch.splice(0);
  try {
    await meili.index(INDEX_NAME).updateDocuments(docs, { primaryKey: 'id' });
    totalIndexed += docs.length;
    console.log(`[meili] Indexed batch of ${docs.length} | Total: ${totalIndexed}`);
  } catch (err) {
    console.error('[meili] Batch index error:', err.message);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushBatch();
  }, FLUSH_INTERVAL_MS);
}

function processEvent(event) {
  if (event.kind !== 0) return;

  const pubkey = event.pubkey;
  const existing = seen.get(pubkey);
  if (existing && existing >= event.created_at) return;
  seen.set(pubkey, event.created_at);

  let profile;
  try {
    profile = JSON.parse(event.content);
  } catch {
    return; // malformed kind 0
  }

  const npub = nip19.npubEncode(pubkey);

  const doc = {
    id: pubkey, // Meilisearch primary key (hex pubkey)
    pubkey,
    npub,
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

  batch.push(doc);

  if (batch.length >= BATCH_SIZE) {
    flushBatch();
  } else {
    scheduleFlush();
  }
}

/**
 * Connect to the relay and subscribe to kind 0 events.
 * Stays connected for live updates after initial EOSE.
 */
function connect() {
  console.log(`[relay] Connecting to ${RELAY_URL}...`);
  const ws = new WebSocket(RELAY_URL);
  let backoff = 1000;

  ws.on('open', () => {
    console.log('[relay] Connected');
    backoff = 1000;
    activeWs = ws;

    // Subscribe to all kind 0 events
    const sub = ['REQ', 'profiles', { kinds: [0] }];
    ws.send(JSON.stringify(sub));
    console.log('[relay] Subscribed to kind 0');
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg[0] === 'EVENT' && msg[2]) {
        processEvent(msg[2]);
      } else if (msg[0] === 'EOSE') {
        console.log(`[relay] EOSE received. Profiles seen: ${seen.size}`);
        flushBatch(); // flush remaining after initial dump
        syncing = false;
      }
    } catch {
      // ignore parse errors
    }
  });

  ws.on('close', () => {
    console.log(`[relay] Disconnected. Reconnecting in ${backoff}ms...`);
    activeWs = null;
    setTimeout(() => {
      backoff = Math.min(backoff * 2, 30000);
      connect();
    }, backoff);
  });

  ws.on('error', (err) => {
    console.error('[relay] Error:', err.message);
    ws.close();
  });
}

/**
 * Trigger a resync: close the existing connection and reconnect.
 * This re-issues the REQ subscription, causing strfry to re-send
 * all kind 0 events (including any added since last EOSE).
 * Returns a status object.
 */
export function resync() {
  if (syncing) {
    return { status: 'already_syncing', profilesSeen: seen.size, totalIndexed };
  }

  syncing = true;
  const beforeCount = seen.size;

  // Close existing connection — the reconnect handler will re-subscribe
  if (activeWs) {
    console.log('[resync] Closing existing connection to trigger re-subscribe...');
    activeWs.close();
  } else {
    console.log('[resync] No active connection — connecting...');
    connect();
  }

  return { status: 'resync_started', profilesBefore: beforeCount, totalIndexed };
}

/**
 * Get current ingestion stats.
 */
export function getIngestStats() {
  return {
    profilesSeen: seen.size,
    totalIndexed,
    connected: activeWs !== null && activeWs.readyState === WebSocket.OPEN,
    syncing,
    relayUrl: RELAY_URL,
  };
}

async function main() {
  console.log('[nostr-search] Starting ingestion...');
  await configureIndex();
  connect();
}

main().catch(console.error);
