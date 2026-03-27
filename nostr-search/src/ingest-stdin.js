import { createInterface } from 'readline';
import { MeiliSearch } from 'meilisearch';
import { nip19 } from 'nostr-tools';

const MEILI_URL = process.env.MEILI_URL || 'http://localhost:7700';
const INDEX_NAME = 'profiles';
const BATCH_SIZE = 1000;

const meili = new MeiliSearch({ host: MEILI_URL });

// Deduplicate: keep latest created_at per pubkey
const seen = new Map();
let batch = [];
let totalProcessed = 0;
let totalIndexed = 0;
let duplicatesSkipped = 0;

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
  const task = await meili.index(INDEX_NAME).addDocuments(docs, { primaryKey: 'id' });
  totalIndexed += docs.length;
  process.stderr.write(`\r[meili] Indexed: ${totalIndexed} | Processed: ${totalProcessed} | Skipped dupes: ${duplicatesSkipped}`);
  return task;
}

function processLine(line) {
  if (!line.trim()) return;

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }

  if (event.kind !== 0) return;
  totalProcessed++;

  const pubkey = event.pubkey;
  const existing = seen.get(pubkey);
  if (existing && existing >= event.created_at) {
    duplicatesSkipped++;
    return;
  }
  seen.set(pubkey, event.created_at);

  let profile;
  try {
    profile = JSON.parse(event.content);
  } catch {
    return;
  }

  const npub = nip19.npubEncode(pubkey);

  batch.push({
    id: pubkey,
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
  });

  if (batch.length >= BATCH_SIZE) {
    flushBatch();
  }
}

async function main() {
  await configureIndex();

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const startTime = Date.now();

  for await (const line of rl) {
    processLine(line);
  }

  // Flush remaining
  await flushBatch();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[done] ${totalIndexed} profiles indexed in ${elapsed}s (${duplicatesSkipped} duplicates skipped)`);
}

main().catch(console.error);
