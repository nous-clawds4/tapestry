/**
 * Streaming ETL Consumer: Redis → Neo4j
 *
 * Reads nostr events (kinds 3, 10000, 1984) from the Redis queue
 * populated by strfry's write pipeline, and creates/updates
 * NostrUser nodes and FOLLOWS/MUTES/REPORTS relationships in Neo4j.
 *
 * Uses MERGE for idempotency — duplicate events are harmless.
 * Processes one event at a time via blocking pop (blpop).
 */

const Redis = require('ioredis');
const { writeCypher } = require('../../lib/neo4j-driver');

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const QUEUE_NAME = 'strfry:events';

let redis;
let processed = 0;
let errors = 0;

function log(msg) {
  console.log(`[stream-consumer] ${new Date().toISOString()} ${msg}`);
}

function logError(msg, err) {
  console.error(`[stream-consumer] ${new Date().toISOString()} ERROR: ${msg}`, err?.message || err);
}

/**
 * Kind 3: Follow list — replaces all FOLLOWS relationships for the publisher.
 */
async function processFollows(event) {
  const publisher = event.pubkey;
  const followed = (event.tags || []).filter(t => t[0] === 'p' && t[1]).map(t => t[1]);

  if (!followed.length) {
    // Empty follow list — delete all existing FOLLOWS for this pubkey
    await writeCypher(
      'MATCH (pub:NostrUser {pubkey: $publisher})-[r:FOLLOWS]->() DELETE r',
      { publisher }
    );
    return;
  }

  await writeCypher(`
    MERGE (pub:NostrUser {pubkey: $publisher})
    WITH pub, $followed AS fps
    UNWIND fps AS fp
      MERGE (f:NostrUser {pubkey: fp})
      MERGE (pub)-[:FOLLOWS]->(f)
    WITH pub, fps
    OPTIONAL MATCH (pub)-[r:FOLLOWS]->(oldF)
    WHERE NOT oldF.pubkey IN fps
    DELETE r
  `, { publisher, followed });
}

/**
 * Kind 10000: Mute list — replaces all MUTES relationships for the publisher.
 */
async function processMutes(event) {
  const publisher = event.pubkey;
  const muted = (event.tags || []).filter(t => t[0] === 'p' && t[1]).map(t => t[1]);

  if (!muted.length) {
    // Empty mute list — delete all existing MUTES for this pubkey
    await writeCypher(
      'MATCH (pub:NostrUser {pubkey: $publisher})-[r:MUTES]->() DELETE r',
      { publisher }
    );
    return;
  }

  await writeCypher(`
    MERGE (pub:NostrUser {pubkey: $publisher})
    WITH pub, $muted AS mps
    UNWIND mps AS mp
      MERGE (m:NostrUser {pubkey: mp})
      MERGE (pub)-[:MUTES]->(m)
    WITH pub, mps
    OPTIONAL MATCH (pub)-[r:MUTES]->(oldM)
    WHERE NOT oldM.pubkey IN mps
    DELETE r
  `, { publisher, muted });
}

/**
 * Kind 1984: Report — adds REPORTS relationships (never deletes).
 */
async function processReports(event) {
  const publisher = event.pubkey;
  const reported = (event.tags || []).filter(t => t[0] === 'p' && t[1]).map(t => t[1]);

  if (!reported.length) return;

  await writeCypher(`
    MERGE (pub:NostrUser {pubkey: $publisher})
    WITH pub, $reported AS rps
    UNWIND rps AS rp
      MERGE (r:NostrUser {pubkey: rp})
      MERGE (pub)-[:REPORTS]->(r)
  `, { publisher, reported });
}

/**
 * Route event to the appropriate handler.
 */
async function processEvent(event) {
  const kind = event.kind;
  if (kind === 3) return processFollows(event);
  if (kind === 10000) return processMutes(event);
  if (kind === 1984) return processReports(event);
}

/**
 * Main consumer loop — blocks on Redis queue, processes events one at a time.
 */
async function main() {
  log(`Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT}`);

  redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    retryStrategy(times) {
      const delay = Math.min(times * 500, 10000);
      log(`Redis connection retry #${times} in ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: null, // never give up on blpop
  });

  redis.on('connect', () => log('Redis connected'));
  redis.on('error', (err) => logError('Redis error', err));

  log(`Listening on queue: ${QUEUE_NAME}`);

  while (true) {
    try {
      // Blocking pop — waits indefinitely for the next event
      const result = await redis.blpop(QUEUE_NAME, 0);
      if (!result) continue;

      const [, message] = result;
      let event;
      try {
        event = JSON.parse(message);
      } catch (parseErr) {
        logError('Failed to parse event JSON', parseErr);
        errors++;
        continue;
      }

      await processEvent(event);
      processed++;

      // Log progress every 1000 events
      if (processed % 1000 === 0) {
        log(`Processed ${processed} events (${errors} errors)`);
      }
    } catch (err) {
      logError('Event processing failed', err);
      errors++;
      // Brief pause before retrying to avoid tight error loops
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  log(`Shutting down. Processed ${processed} events, ${errors} errors.`);
  if (redis) redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  log(`Interrupted. Processed ${processed} events, ${errors} errors.`);
  if (redis) redis.disconnect();
  process.exit(0);
});

main().catch(err => {
  logError('Fatal error', err);
  process.exit(1);
});
