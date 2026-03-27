#!/bin/bash
##
## Start nostr-search stack and run initial sync
##
## Prerequisites: Tapestry must be running (docker exec tapestry strfry ...)
##
set -e

cd "$(dirname "$0")"

RELAY_URL="${1:-wss://wot.grapevine.network}"

echo "Starting Meilisearch + API..."
docker compose up -d

echo "Waiting for Meilisearch health check..."
until curl -sf http://localhost:7700/health >/dev/null 2>&1; do
  sleep 1
done

echo "Running initial sync..."
bash sync.sh "$RELAY_URL"

echo ""
echo "Nostr Search is running at http://localhost:3069"
echo "Run 'bash sync.sh' to update the index (or add to cron)"
