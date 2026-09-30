#!/bin/bash
# tagging-edges story 3 / ADR tagging-edges/0003 § "Where it runs (D2-A)". The real-time path's supervisord wrapper.
# It holds the single-instance flock on realtime/daemon.lock (fd 8, inherited by Node, whose lockHeld checks it), idles
# while switch.json is not "on":true, and runs Node while it is. The conf is sourced only inside each start's subshell,
# so it is re-read at every start. It never exits by itself (only on TERM or INT, or as a second instance), so
# supervisord never marks it FATAL. flock, sleep and node are found through PATH (T23, T28). No secret on any argv.
# No set -e: the loop must outlive every failure of what it runs. Stays bash-3.2-compatible (T28).
STATE_DIR="${TAGGING_EDGES_STATE_DIR:-/var/lib/brainstorm/tagging-edges}"
DIR="$STATE_DIR/realtime"
CONF="${BRAINSTORM_CONF:-/etc/brainstorm.conf}"
POLL="${TAGGING_EDGES_REALTIME_POLL_SECONDS:-2}"
HEALTHY="${TAGGING_EDGES_REALTIME_HEALTHY_SECONDS:-60}"
ENGINE="$(cd "$(dirname "$0")" && pwd)/index.js"

mkdir -p "$DIR" && chmod 700 "$DIR"
exec 8>>"$DIR/daemon.lock"
flock -n 8 || { echo "[tagging-edges-realtime] another instance holds realtime/daemon.lock; exiting" >&2; sleep 30; exit 75; }

child=""
napper=""

# TERM or INT: forward TERM to Node (a background job starts with INT ignored), wait for it, exit 0.
stop() {
  trap '' TERM INT
  if [ -n "$napper" ]; then kill "$napper" 2>/dev/null; fi
  if [ -n "$child" ]; then kill -TERM "$child" 2>/dev/null; wait "$child" 2>/dev/null; fi
  exit 0
}
trap stop TERM INT

# Sleeps run in the background and are waited for, so a signal is handled at once, not when the sleep ends. They do
# not inherit fd 8, so a sleep left behind never holds the lock.
nap() {
  sleep "$1" 8>&- &
  napper=$!
  wait "$napper"
  napper=""
}

# The canonical compact form the owner route writes, matched in bash (no spawn). Anything else reads as off.
switch_on() {
  local line=""
  { IFS= read -r line < "$DIR/switch.json"; } 2>/dev/null
  case "$line" in *'"on":true'*) return 0 ;; esac
  return 1
}

backoff=1
while :; do
  if ! switch_on; then nap "$POLL"; continue; fi
  started=$SECONDS
  ( . "$CONF" && exec node --max-old-space-size=384 "$ENGINE" ) &
  child=$!
  wait "$child"
  rc=$?
  child=""
  ran=$((SECONDS - started))
  # A healthy run resets the backoff (T34); after one, only a non-zero exit backs off.
  if [ "$ran" -ge "$HEALTHY" ]; then
    backoff=1
    if [ "$rc" -eq 0 ]; then continue; fi
  fi
  echo "[tagging-edges-realtime] start exited $rc after ${ran}s; backing off ${backoff}s" >&2
  nap "$backoff"
  backoff=$((backoff * 2))
  if [ "$backoff" -gt 30 ]; then backoff=30; fi
done
