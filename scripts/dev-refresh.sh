#!/usr/bin/env bash
#
# dev-refresh.sh — one-shot local refresh for the bind-mount dev setup.
#
# After `git pull` (or any local edit), bring the running `tapestry` container
# up to date with your working tree, then smoke-test http://localhost:7778.
#
# This is for the DEV-OVERRIDE (live bind-mount) setup:
#   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d tapestry
# In that mode the container reads your repo live, so we don't copy anything in.
# We only:
#   1. (optional) reinstall npm deps      — when a pull changed package*.json
#   2. rebuild the Vite frontend (dist/)  — a build artifact the server serves
#   3. restart the Node backend           — to pick up src/ + bin/ changes
#   4. smoke-test localhost:7778
#
# The UI build runs INSIDE the container on purpose: ui/node_modules is shared
# host<->container through the bind-mount, so building on the macOS host would
# leave a darwin esbuild binary that the Linux container can't run (and vice
# versa). Keeping all builds in the container avoids that platform mismatch.
#
# Usage:
#   scripts/dev-refresh.sh            rebuild UI + restart backend + smoke test
#   scripts/dev-refresh.sh --deps     also reinstall root + ui npm deps first
#   scripts/dev-refresh.sh --ui       only rebuild UI (+ smoke test)
#   scripts/dev-refresh.sh --server   only restart backend (+ smoke test)
#   scripts/dev-refresh.sh --help
#
# For the docker-cp workflow (baked image, no bind-mount) use /cycle-local.

set -euo pipefail

CONTAINER=tapestry
MODROOT=/usr/local/lib/node_modules/brainstorm
BASE_URL=http://localhost:7778

if [ -t 1 ]; then R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[34m'; Z=$'\033[0m'
else R=''; G=''; Y=''; B=''; Z=''; fi
say()  { printf '%s==>%s %s\n' "$B" "$Z" "$1"; }
ok()   { printf '%s✓%s %s\n'   "$G" "$Z" "$1"; }
warn() { printf '%s!%s %s\n'   "$Y" "$Z" "$1"; }
die()  { printf '%s✗ %s%s\n'   "$R" "$1" "$Z" >&2; exit 1; }

usage() { sed -n '3,29p' "$0" | sed 's/^#\{0,1\} \{0,1\}//'; }

DO_DEPS=0; DO_UI=1; DO_SERVER=1
case "${1:-}" in
  --help|-h) usage; exit 0 ;;
  --deps)    DO_DEPS=1 ;;
  --ui)      DO_SERVER=0 ;;
  --server)  DO_UI=0 ;;
  "")        ;;
  *) die "unknown option: $1 (try --help)" ;;
esac

# --- 1. preconditions -------------------------------------------------------
[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" = "true" ] \
  || die "container '$CONTAINER' is not running. Start it with:
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d tapestry"

if ! docker inspect "$CONTAINER" \
       --format '{{range .Mounts}}{{.Destination}}{{"\n"}}{{end}}' | grep -qx "$MODROOT"; then
  warn "'$CONTAINER' has no source bind-mount at $MODROOT — your edits are NOT live."
  warn "This script is for the dev-override setup (docker-compose.dev.yml)."
  warn "For the baked-image workflow use /cycle-local instead."
fi

# --- 2. deps (optional) -----------------------------------------------------
if [ "$DO_DEPS" = 1 ]; then
  say "Reinstalling npm deps (root + ui) …"
  docker exec "$CONTAINER" sh -c "cd $MODROOT    && npm install --no-audit --no-fund" >/dev/null
  docker exec "$CONTAINER" sh -c "cd $MODROOT/ui && npm install --no-audit --no-fund" >/dev/null
  ok "deps installed"
fi

# --- 3. UI build ------------------------------------------------------------
BUNDLE=""
if [ "$DO_UI" = 1 ]; then
  say "Building UI (vite) …"
  docker exec "$CONTAINER" sh -c "cd $MODROOT/ui && npm run build" 2>&1 | tail -3
  BUNDLE=$(docker exec "$CONTAINER" sh -c \
    "grep -oE '/assets/index-[^\"]+\.js' $MODROOT/dist/index.html" 2>/dev/null | head -1 || true)
  ok "UI built → ${BUNDLE:-dist/}"
fi

# --- 4. backend restart -----------------------------------------------------
if [ "$DO_SERVER" = 1 ]; then
  say "Restarting backend (brainstorm, stream-consumer) …"
  docker exec "$CONTAINER" supervisorctl restart brainstorm stream-consumer >/dev/null
  # poll (inside the container) up to ~10s for a stable state
  status=$(docker exec "$CONTAINER" sh -c '
    for i in 1 2 3 4 5; do
      s=$(supervisorctl status brainstorm | grep -oE "RUNNING|BACKOFF|FATAL|STOPPED|EXITED" | head -1)
      case "$s" in RUNNING) echo RUNNING; exit 0 ;; BACKOFF|FATAL) echo "$s"; exit 0 ;; esac
      sleep 2
    done
    supervisorctl status brainstorm | grep -oE "RUNNING|BACKOFF|FATAL|STOPPED|EXITED" | head -1')
  if [ "$status" != "RUNNING" ]; then
    warn "brainstorm is '$status' — recent errors:"
    docker exec "$CONTAINER" tail -n 15 /var/log/supervisor/brainstorm-error.log 2>/dev/null || true
    die "backend did not start cleanly. If this is MODULE_NOT_FOUND, re-run: scripts/dev-refresh.sh --deps"
  fi
  ok "backend RUNNING"
fi

# --- 5. smoke test ----------------------------------------------------------
say "Smoke test $BASE_URL …"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 8 \
         --retry 5 --retry-connrefused --retry-delay 1 "$BASE_URL/" || true)
[ "$code" = "200" ] || die "control panel returned HTTP $code (expected 200)"
ok "control panel 200"

served=$(curl -s -m 8 "$BASE_URL/" | grep -oE '/assets/index-[^"]+\.js' | head -1 || true)
if [ "$DO_UI" = 1 ] && [ -n "$BUNDLE" ] && [ "$served" != "$BUNDLE" ]; then
  warn "served bundle ($served) != just-built ($BUNDLE) — try a hard refresh"
else
  ok "serving ${served:-current bundle}"
fi

printf '\n%sLocal stack refreshed.%s Open %s (Cmd-Shift-R to bust cache).\n' "$G" "$Z" "$BASE_URL"
