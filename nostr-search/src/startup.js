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
 *   REINGEST_INTERVAL_HOURS - hours between automatic bulk re-ingestions (default: 24, 0 to disable)
 */

async function main() {
  // Start the search API server
  const searchModule = await import('./search.js');
  console.log('[startup] Search API server started');

  // Start the live ingester
  const syncOnStart = (process.env.SYNC_ON_START || 'true') !== 'false';
  if (syncOnStart) {
    // Small delay to let Meilisearch fully initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    const ingestModule = await import('./ingest.js');
    console.log('[startup] Live ingester started');

    const bulkIngestModule = await import('./bulk-ingest.js');
    console.log('[startup] Bulk ingest module loaded');

    // Wire modules into the search API
    searchModule.setIngestModule(ingestModule);
    searchModule.setBulkIngestModule(bulkIngestModule);

    // Schedule periodic bulk re-ingestion to keep profiles fresh
    const reingestHours = parseFloat(process.env.REINGEST_INTERVAL_HOURS ?? '24');
    if (reingestHours > 0) {
      const intervalMs = reingestHours * 60 * 60 * 1000;
      console.log(`[startup] Scheduled bulk re-ingestion every ${reingestHours}h`);
      setInterval(async () => {
        const status = bulkIngestModule.getBulkStatus();
        if (status.status === 'fetching' || status.status === 'indexing') {
          console.log('[scheduled-reingest] Skipping — bulk ingest already running');
          return;
        }
        console.log('[scheduled-reingest] Starting automatic bulk re-ingestion...');
        try {
          await bulkIngestModule.runBulkIngest();
        } catch (err) {
          console.error('[scheduled-reingest] Error:', err.message);
        }
      }, intervalMs);
    }
  } else {
    console.log('[startup] Live ingestion disabled (SYNC_ON_START=false)');
  }
}

main().catch(err => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
