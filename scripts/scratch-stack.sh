#!/usr/bin/env bash
#
# scratch-stack.sh — a throwaway Tapestry instance running THIS checkout's src/,
# for live tests that must not touch the shared local stack (node-primitives
# ADR 0001). The boot recipe is scripts/brain-drill.sh's.
#
# The instance is an ephemeral container from the local image: fresh anonymous
# volumes, its own assistant identity minted at first boot, NO published ports
# (reachable only via `docker exec` loopback — the path the test suites take
# through TAPESTRY_CONTAINER), this checkout's src/ mounted read-only over the
# image's, firmware installed, strfry-router stopped, external publishing off.
# It never touches the `tapestry` container.
#
# Usage:  scripts/scratch-stack.sh up     # boots it; prints the container name on stdout
#         scripts/scratch-stack.sh down   # removes it (containers, volumes, network)
#
#   TAPESTRY_CONTAINER=$(bash scripts/scratch-stack.sh up) \
#     node -e "require('./test/event-less-create-set.test.js').run()"
#
# Env:    SCRATCH_IMAGE (default tapestry-tapestry) — the image to boot from
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${SCRATCH_IMAGE:-tapestry-tapestry}"
SCRATCH="tapestry-scratch"
SCRATCH_REDIS="tapestry-scratch-redis"
NET="tapestry-scratch-net"
BASE="http://127.0.0.1:7778"

log() { echo "[scratch] $*" >&2; }
scurl() { docker exec -i "$SCRATCH" curl -s "$@"; }

down() {
  docker rm -f "$SCRATCH" >/dev/null 2>&1 || true
  docker rm -f "$SCRATCH_REDIS" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}

# wait_until <what> <tries> <command...> — polls every 5 seconds.
wait_until() {
  local what="$1" limit="$2" tries=0
  shift 2
  until "$@" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -ge "$limit" ]; then
      log "$what did not come up in time."
      return 1
    fi
    sleep 5
  done
}

app_answers() { scurl -m 3 "$BASE/api/auth/user-classification" | grep -q '"success":true'; }
db_answers() {
  scurl -m 5 -X POST -H 'Content-Type: application/json' \
    -d '{"cypher":"RETURN 1 AS ok","params":{}}' "$BASE/api/neo4j/query" | grep -q '"ok"'
}

up() {
  if docker container inspect "$SCRATCH" >/dev/null 2>&1; then
    log "'$SCRATCH' already exists — use it, or run '$0 down' first."
    exit 1
  fi
  docker image inspect "$IMAGE" >/dev/null 2>&1 \
    || { log "image '$IMAGE' not found — build the local stack once first."; exit 1; }
  trap 'log "bring-up failed — removing the scratch instance"; down' ERR
  # An interrupted boot must not leave a second instance running beside the
  # shared stack (the memory-pressure hazard brain-drill.sh documents).
  trap 'log "interrupted — removing the scratch instance"; down; exit 130' INT TERM

  log "booting '$SCRATCH' from '$IMAGE' (fresh volumes, no published ports, src/ from $ROOT)"
  docker network create "$NET" >/dev/null
  docker run --rm -d --name "$SCRATCH_REDIS" --network "$NET" --network-alias redis redis:7-alpine >/dev/null
  # The entrypoint sizes the graph database from the whole Docker VM at every
  # container start — right for one instance, fatal for a second one beside it.
  # The BRAINSTORM_NEO4J_* override (OPEN.md row 186) makes it start small from
  # its very first boot; shrinking it after boot is too late.
  docker run --rm -d --name "$SCRATCH" --network "$NET" \
    -v "$ROOT/src":/usr/local/lib/node_modules/brainstorm/src:ro \
    -e NEO4J_PASSWORD="scratch-stack-pass" \
    -e DOMAIN_NAME=localhost \
    -e BRAINSTORM_PUBLISH_LOCAL_ONLY=true \
    -e BRAINSTORM_NEO4J_HEAP_MB=1024 \
    -e BRAINSTORM_NEO4J_CACHE_MB=512 \
    -e BRAINSTORM_NEO4J_TX_MAX_MB=512 \
    "$IMAGE" >/dev/null

  wait_until "the scratch app" 90 app_answers
  wait_until "the scratch graph database" 90 db_answers

  log "installing firmware"
  local out
  out="$(scurl -m 600 -X POST "$BASE/api/firmware/install")"
  if ! printf '%s' "$out" | grep -q '"success":true'; then
    log "firmware install failed: $(printf '%s' "$out" | head -c 400)"
    down
    exit 1
  fi
  docker exec "$SCRATCH" supervisorctl stop strfry-router >/dev/null 2>&1 || true
  trap - ERR INT TERM
  log "ready — remove it with: $0 down"
  echo "$SCRATCH"
}

case "${1:-}" in
  up) up ;;
  down) down; log "removed" ;;
  *) echo "usage: $0 up|down" >&2; exit 2 ;;
esac
