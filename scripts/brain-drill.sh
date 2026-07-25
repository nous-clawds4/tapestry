#!/usr/bin/env bash
#
# brain-drill.sh — the restore drill (second-brain #8, ADR 0008 d10).
#
# Proves, against a scratch target that is NOT the live brain, that a restore
# from the live brain's export reproduces its content — then journals the
# result (BOTH outcomes) into the LIVE brain via record-restore-drill.
#
# The scratch target is an ephemeral second container from the same image:
# fresh anonymous volumes, its OWN assistant identity minted at first boot
# (the portability proof is real), NO published ports (reachable only via
# docker exec loopback), torn down afterwards. Everything is local — the
# drill reaches no host beyond 127.0.0.1 inside the two containers.
#
# Usage:  scripts/brain-drill.sh
# Env:    TAPESTRY_CONTAINER (default tapestry) — the LIVE container
#         DRILL_IMAGE (default tapestry-tapestry) — the image to boot scratch from
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIVE="${TAPESTRY_CONTAINER:-tapestry}"
IMAGE="${DRILL_IMAGE:-tapestry-tapestry}"
SCRATCH="tapestry-drill-scratch"
SCRATCH_REDIS="tapestry-drill-redis"
NET="tapestry-drill-net"
BASE="http://127.0.0.1:7778"
WORK="$(mktemp -d)"
ARTIFACT="$WORK/brain-export.json"
SCRATCH_EXPORT="$WORK/scratch-export.json"

cleanup() {
  docker rm -f "$SCRATCH" >/dev/null 2>&1 || true
  docker rm -f "$SCRATCH_REDIS" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

lcurl() { docker exec -i "$LIVE" curl -s "$@"; }
scurl() { docker exec -i "$SCRATCH" curl -s "$@"; }

echo "[drill] preflight: live stack + image"
lcurl -m 5 "$BASE/api/auth/user-classification" | grep -q '"success"' \
  || { echo "[drill] the live stack is not answering at $BASE — start it first."; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 \
  || { echo "[drill] image '$IMAGE' not found — build the stack once first."; exit 1; }

echo "[drill] 1/7 exporting the live brain"
lcurl -m 60 "$BASE/api/brain/export" > "$ARTIFACT"
TAKEN_ON="$(node -e "
const a = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
if (!a || a.format !== 'tapestry-brain-export' || typeof a.takenOn !== 'string' || !a.takenOn) process.exit(1);
console.log(a.takenOn);
" "$ARTIFACT")" || { echo "[drill] the live export did not answer a brain export file — is the live brain healthy?"; exit 1; }
echo "[drill]     export taken $TAKEN_ON"

echo "[drill] 2/7 booting the scratch instance (fresh volumes, no published ports)"
docker network create "$NET" >/dev/null
docker run --rm -d --name "$SCRATCH_REDIS" --network "$NET" --network-alias redis redis:7-alpine >/dev/null
# The image's baked server code may predate the working tree (locally the live
# container bind-mounts the repo over it — the dev-compose pattern). The drill
# mounts the working tree's src/ read-only the same way, so the scratch runs
# the code under drill; on a deployed instance the image already matches and
# the mount changes nothing. Data volumes stay fresh + anonymous (the point).
docker run --rm -d --name "$SCRATCH" --network "$NET" \
  -v "$ROOT/src":/usr/local/lib/node_modules/brainstorm/src:ro \
  -e OWNER_PUBKEY="${OWNER_PUBKEY:-}" \
  -e ADMIN_PUBKEYS="${ADMIN_PUBKEYS:-}" \
  -e NEO4J_PASSWORD="${NEO4J_PASSWORD:-drill-scratch-pass}" \
  -e DOMAIN_NAME=localhost \
  "$IMAGE" >/dev/null

tries=0
until scurl -m 3 "$BASE/api/auth/user-classification" 2>/dev/null | grep -q '"success":true'; do
  tries=$((tries + 1))
  if [ "$tries" -ge 90 ]; then
    echo "[drill] the scratch instance did not become healthy in time."
    exit 1
  fi
  sleep 5
done
echo "[drill]     scratch app answering"
# The image's boot script sizes the graph database's memory from the WHOLE
# machine — right for the one live instance, fatal for a second one beside it
# (the scratch's database gets killed for memory before it can open). The
# drill's dataset is tiny: shrink the scratch's database memory and restart it.
docker exec "$SCRATCH" sh -c "sed -i \
  -e 's/^server.memory.heap.initial_size=.*/server.memory.heap.initial_size=1024m/' \
  -e 's/^server.memory.heap.max_size=.*/server.memory.heap.max_size=1024m/' \
  -e 's/^server.memory.pagecache.size=.*/server.memory.pagecache.size=512m/' \
  -e 's/^dbms.memory.transaction.total.max=.*/dbms.memory.transaction.total.max=512m/' \
  /etc/neo4j/neo4j.conf && supervisorctl restart neo4j" >/dev/null
# A fresh volume means the scratch's graph database initializes on first boot —
# wait until it actually answers queries, not just until the app process does.
tries=0
until scurl -m 5 -X POST -H 'Content-Type: application/json' \
    -d '{"cypher":"RETURN 1 AS ok","params":{}}' "$BASE/api/neo4j/query" 2>/dev/null | grep -q '"ok"'; do
  tries=$((tries + 1))
  if [ "$tries" -ge 90 ]; then
    echo "[drill] the scratch instance's graph database did not come up in time."
    exit 1
  fi
  sleep 5
done
echo "[drill]     scratch database answering"

echo "[drill] 3/7 scratch bring-up: firmware install + quiet the router"
FIRMWARE_OUT="$(scurl -m 600 -X POST "$BASE/api/firmware/install")"
echo "$FIRMWARE_OUT" | grep -q '"success":true' \
  || { echo "[drill] firmware install failed on the scratch instance: $(printf '%s' "$FIRMWARE_OUT" | head -c 400)"; exit 1; }
docker exec "$SCRATCH" supervisorctl stop strfry-router >/dev/null 2>&1 || true

echo "[drill] 4/7 restoring the export into the scratch instance"
node -e "
const fs = require('fs');
const artifact = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
fs.writeFileSync(process.argv[2], JSON.stringify({ artifact }));
" "$ARTIFACT" "$WORK/restore-body.json"
RESTORE_OUT="$(scurl -m 600 -X POST -H 'Content-Type: application/json' --data-binary @- "$BASE/api/normalize/restore-brain" < "$WORK/restore-body.json")"
echo "$RESTORE_OUT" | grep -q '"success":true' \
  || { echo "[drill] the restore was refused or failed: $RESTORE_OUT"; exit 1; }
echo "[drill]     restored: $(node -e "console.log(JSON.stringify(JSON.parse(process.argv[1]).restored))" "$RESTORE_OUT")"

echo "[drill] 5/7 re-exporting the scratch instance"
scurl -m 60 "$BASE/api/brain/export" > "$SCRATCH_EXPORT"

echo "[drill] 6/7 comparing (the one equivalence definition)"
if node -e "
const { contentEquivalent } = require(process.argv[1] + '/src/lib/brain/export.js');
const fs = require('fs');
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
process.exit(contentEquivalent(a, b) ? 0 : 1);
" "$ROOT" "$ARTIFACT" "$SCRATCH_EXPORT"; then
  OUTCOME="matched"
else
  OUTCOME="did-not-match"
fi

# The scratch's job is done at the compare — release its memory BEFORE
# journaling: the live instance may have shed its own database under the
# side-by-side pressure, and it can only come back once the scratch is gone.
docker rm -f "$SCRATCH" >/dev/null 2>&1 || true
docker rm -f "$SCRATCH_REDIS" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true

echo "[drill] 7/7 journaling the result into the live brain"
# Wait until the live database answers again before journaling (its
# supervisor restarts it automatically once the memory is back).
tries=0
until lcurl -m 5 -X POST -H 'Content-Type: application/json' \
    -d '{"cypher":"RETURN 1 AS ok","params":{}}' "$BASE/api/neo4j/query" 2>/dev/null | grep -q '"ok"'; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "[drill] the live instance's database did not come back — journal the result by hand when it does."
    exit 1
  fi
  sleep 5
done
printf '{"exportTakenOn":"%s","outcome":"%s","target":"a fresh scratch instance (ephemeral container, own assistant identity)"}' \
  "$TAKEN_ON" "$OUTCOME" > "$WORK/journal-body.json"
JOURNAL_OUT="$(lcurl -m 60 -X POST -H 'Content-Type: application/json' --data-binary @- "$BASE/api/normalize/record-restore-drill" < "$WORK/journal-body.json")"
echo "$JOURNAL_OUT" | grep -q '"success":true' \
  || { echo "[drill] journaling failed: $JOURNAL_OUT"; exit 1; }
echo "[drill]     journaled: $(node -e "console.log(JSON.stringify(JSON.parse(process.argv[1]).drill))" "$JOURNAL_OUT")"

if [ "$OUTCOME" = "matched" ]; then
  echo "Restore drill complete — your brain matches the export."
else
  echo "The restored content did not match the export. The result was journaled."
  exit 1
fi
