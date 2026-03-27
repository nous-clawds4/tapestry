/**
 * Unified startup: runs the search API server and the live relay ingester
 * in the same process. This eliminates the need for sync.sh / docker exec.
 *
 * The ingester connects to strfry via WebSocket (RELAY_URL), subscribes to
 * kind 0 events, and keeps Meilisearch up to date in real time.
 *
 * Environment:
 *   RELAY_URL  - strfry relay to ingest from (default: ws://tapestry:7777)
 *   MEILI_URL  - Meilisearch URL (default: http://nostr-search-meili:7700)
 *   PORT       - API listen port (default: 3069)
 *   SYNC_ON_START - set to "false" to disable auto-ingestion (default: true)
 */

// Start the search API server (registers routes, begins listening)
import('./search.js').then(() => {
  console.log('[startup] Search API server started');
}).catch(err => {
  console.error('[startup] Failed to start search API:', err);
  process.exit(1);
});

// Start the live ingester (connects to relay, streams kind 0 → Meilisearch)
const syncOnStart = (process.env.SYNC_ON_START || 'true') !== 'false';
if (syncOnStart) {
  // Small delay to let Meilisearch fully initialize
  setTimeout(() => {
    import('./ingest.js').then(() => {
      console.log('[startup] Live ingester started');
    }).catch(err => {
      console.error('[startup] Failed to start ingester:', err);
      // Don't exit — search API still works, just no live sync
    });
  }, 3000);
} else {
  console.log('[startup] Live ingestion disabled (SYNC_ON_START=false)');
}
