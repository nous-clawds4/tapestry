#!/bin/bash
##
## Sync kind 0 profiles from a remote relay into Meilisearch
## Uses Tapestry's strfry (inside the tapestry container) for negentropy sync
##
## Usage:
##   bash sync.sh                                    # sync from default relay
##   bash sync.sh wss://relay.damus.io               # sync from specific relay
##   CONTAINER=my-tapestry bash sync.sh              # use a different container name
##   MEILI_URL=http://meili:7700 bash sync.sh        # use a different Meilisearch URL
##
set -e

cd "$(dirname "$0")"

RELAY_URL="${1:-wss://wot.grapevine.network}"
CONTAINER="${CONTAINER:-tapestry}"
MEILI_URL="${MEILI_URL:-http://localhost:7700}"
FILTER='{"kinds":[0]}'

# Verify prerequisites
if ! docker exec "$CONTAINER" which strfry >/dev/null 2>&1; then
  echo "[error] strfry not found in container '$CONTAINER'. Is Tapestry running?"
  exit 1
fi

if ! curl -sf "$MEILI_URL/health" >/dev/null 2>&1; then
  echo "[error] Meilisearch not reachable at $MEILI_URL. Is it running?"
  exit 1
fi

# Step 1: Negentropy sync from remote relay into local strfry
echo "[sync] Syncing kind 0 from $RELAY_URL via container '$CONTAINER'..."
docker exec "$CONTAINER" strfry sync "$RELAY_URL" --filter "$FILTER" --dir down 2>&1 | tail -5 || true

# Step 2: Count events
COUNT=$(docker exec "$CONTAINER" strfry scan --count "$FILTER" 2>&1 | grep -E '^[0-9]+$' || echo "0")
echo "[sync] $COUNT kind 0 profiles in strfry"

# Step 3: Export and pipe into Meilisearch
echo "[sync] Exporting to Meilisearch at $MEILI_URL..."
docker exec "$CONTAINER" strfry scan "$FILTER" 2>/dev/null | \
  MEILI_URL="$MEILI_URL" node src/ingest-stdin.js 2>&1

echo ""
echo "[sync] Done."
