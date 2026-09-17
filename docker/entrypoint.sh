#!/bin/bash
set -e

# Defaults
OWNER_PUBKEY="${OWNER_PUBKEY:-unassigned}"
ADMIN_PUBKEYS="${ADMIN_PUBKEYS:-}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-neo4j}"
DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
RELAY_URL="${RELAY_URL:-ws://localhost:7777}"

BRAINSTORM_MODULE_BASE_DIR="/usr/local/lib/node_modules/brainstorm/"
BRAINSTORM_NODE_BIN="$(which node)"
CONFIG_DIR="${BRAINSTORM_MODULE_BASE_DIR}config"

# Persist SESSION_SECRET across container rebuilds. Stored on the tapestry-data
# volume so that user session cookies remain valid through deploys. To force-rotate
# (e.g., after a security incident), delete the file: every active session ends
# the next time the container starts.
SESSION_SECRET_FILE="/var/lib/brainstorm/session.secret"
if [ -s "$SESSION_SECRET_FILE" ]; then
  SESSION_SECRET="$(cat "$SESSION_SECRET_FILE")"
else
  SESSION_SECRET="$(openssl rand -hex 32)"
  mkdir -p "$(dirname "$SESSION_SECRET_FILE")"
  printf '%s' "$SESSION_SECRET" > "$SESSION_SECRET_FILE"
  chmod 600 "$SESSION_SECRET_FILE"
fi

# Calculate owner npub (best effort, fallback to unassigned)
OWNER_NPUB="unassigned"
if [ "$OWNER_PUBKEY" != "unassigned" ] && [ ${#OWNER_PUBKEY} -eq 64 ]; then
  OWNER_NPUB=$(node -e "
    try {
      const {nip19} = require('nostr-tools');
      console.log(nip19.npubEncode('${OWNER_PUBKEY}'));
    } catch(e) { console.log('unassigned'); }
  " 2>/dev/null || echo "unassigned")
fi

# Render /etc/brainstorm.conf from the template (story #16 / ADR 0014).
# Replaces the prior 80-line heredoc. The renderer reads ${VAR_NAME} references
# from process.env, so we export the variables the template references before
# invoking it — they are local shell vars at this point. The renderer rejects
# unknown ${VAR} references with nonzero exit, so a missing env var fails the
# boot loudly rather than producing a silently-incomplete conf file.
export OWNER_PUBKEY ADMIN_PUBKEYS NEO4J_PASSWORD DOMAIN_NAME RELAY_URL
export BRAINSTORM_MODULE_BASE_DIR BRAINSTORM_NODE_BIN SESSION_SECRET OWNER_NPUB

if ! node "${BRAINSTORM_MODULE_BASE_DIR}tools/render-conf-template.js" \
        "${CONFIG_DIR}/brainstorm.conf.template" > /etc/brainstorm.conf; then
  echo "[entrypoint] FATAL: render of /etc/brainstorm.conf failed" >&2
  exit 1
fi
chmod 664 /etc/brainstorm.conf
echo "[entrypoint] /etc/brainstorm.conf generated from config/brainstorm.conf.template"

# ── Install algorithm config files from templates (if not already present) ──
# These are created by setup/install-control-panel.sh on bare-metal installs.
# In Docker, we create them here from the shipped templates.
# CONFIG_DIR was defined near the top of this script so the brainstorm.conf
# renderer invocation could use it too.
for conffile in graperank whitelist blacklist nip56; do
  if [ ! -f "/etc/${conffile}.conf" ] && [ -f "${CONFIG_DIR}/${conffile}.conf.template" ]; then
    cp "${CONFIG_DIR}/${conffile}.conf.template" "/etc/${conffile}.conf"
    chmod 644 "/etc/${conffile}.conf"
    echo "Installed /etc/${conffile}.conf from template"
  fi
done

# Install /etc/brainstorm-task-queue.json on fresh containers (story #16 / ADR 0014).
# Mirrors the copy-if-absent pattern above. The template ships with deploy-safe
# defaults (defaultConcurrency=1, resourceClassCaps.neo4j-heavy=1). Operators
# tune knobs by editing /etc/brainstorm-task-queue.json after first install;
# operator edits survive container restarts because of the [ ! -f ] guard.
if [ ! -f /etc/brainstorm-task-queue.json ] && [ -f "${CONFIG_DIR}/brainstorm-task-queue.json.template" ]; then
  cp "${CONFIG_DIR}/brainstorm-task-queue.json.template" /etc/brainstorm-task-queue.json
  chmod 644 /etc/brainstorm-task-queue.json
  echo "[entrypoint] Installed /etc/brainstorm-task-queue.json from template"
fi

# Generate strfry.conf from the default template
if [ -f /usr/local/src/strfry/strfry.conf ]; then
  cp /usr/local/src/strfry/strfry.conf /etc/strfry.conf
  sed -i 's|db = ".*"|db = "/var/lib/strfry/"|' /etc/strfry.conf
  sed -i 's|nofiles = .*|nofiles = 0|' /etc/strfry.conf
  sed -i 's|maxEventSize = .*|maxEventSize = 1048576|' /etc/strfry.conf
  sed -i 's|maxSyncEvents = .*|maxSyncEvents = 10000000|' /etc/strfry.conf
  sed -i 's|maxFilterLimitCount = .*|maxFilterLimitCount = 10000000|' /etc/strfry.conf
  sed -i 's|maxNumTags = .*|maxNumTags = 8000|' /etc/strfry.conf
  sed -i 's|rejectEventsOlderThanSeconds = .*|rejectEventsOlderThanSeconds = 189216000|' /etc/strfry.conf
else
  echo "WARNING: strfry default config not found, creating minimal config"
  cat > /etc/strfry.conf << 'STRFRYEOF'
db = "/var/lib/strfry/"
relay {
    bind = "0.0.0.0"
    port = 7777
    nofiles = 0
    info {
        name = "Tapestry Relay"
    }
    maxWebsocketPayloadSize = 1048576
}
events {
    maxEventSize = 1048576
}
STRFRYEOF
fi

# Add Redis config for streaming ETL (strfry → Redis → Neo4j)
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
cat >> /etc/strfry.conf << REDISEOF

redis {
    host = "$REDIS_HOST"
    port = $REDIS_PORT
}
REDISEOF

# ── Dynamic Neo4j memory, GC, and concurrency configuration ──
# Detects system RAM and CPU count at startup, calculates optimal settings.
# Reserves memory for other services (Meilisearch, strfry, Redis, Node.js, OS).

TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))
NUM_CPUS=$(nproc)

# Reserve memory for other services (Meilisearch, strfry, Redis, Node.js, OS).
# Empirical measurements on 32GB/2.6M profiles: Meilisearch uses ~6GB,
# strfry ~1-2GB, Node.js ~0.5GB, OS ~1-2GB = ~10-12GB total.
if [ "$TOTAL_MEM_MB" -ge 24000 ]; then
  RESERVED_MB=12000    # 12GB on large machines (≥24GB) — Meilisearch needs 6-8GB alone
elif [ "$TOTAL_MEM_MB" -ge 12000 ]; then
  RESERVED_MB=7000     # 7GB on medium machines (12-24GB)
else
  RESERVED_MB=3500     # 3.5GB on small machines (<12GB)
fi

AVAILABLE_MB=$((TOTAL_MEM_MB - RESERVED_MB))
# Ensure minimum 1GB available for Neo4j
if [ "$AVAILABLE_MB" -lt 1024 ]; then
  AVAILABLE_MB=1024
fi

NEO4J_HEAP_MB=$((AVAILABLE_MB * 40 / 100))
NEO4J_CACHE_MB=$((AVAILABLE_MB * 40 / 100))
NEO4J_TX_MAX_MB=$((NEO4J_HEAP_MB * 50 / 100))

# Operator memory override (OPEN.md row 186). On a shared Docker VM, MemTotal
# counts RAM that belongs to other containers, so the formula above
# overprovisions there (six-week local OOM crash loop, rows 185/186). When a
# BRAINSTORM_NEO4J_* var is set (via .env / docker-compose), it replaces the
# computed value verbatim; unset or empty ⇒ the formula's result stands and the
# written config is byte-identical to before this override existed. Vars are
# independent — an overridden heap does NOT re-derive the tx ceiling above, so
# set all three for a coherent profile.
NEO4J_HEAP_MB="${BRAINSTORM_NEO4J_HEAP_MB:-$NEO4J_HEAP_MB}"
NEO4J_CACHE_MB="${BRAINSTORM_NEO4J_CACHE_MB:-$NEO4J_CACHE_MB}"
NEO4J_TX_MAX_MB="${BRAINSTORM_NEO4J_TX_MAX_MB:-$NEO4J_TX_MAX_MB}"
if [ -n "${BRAINSTORM_NEO4J_HEAP_MB:-}${BRAINSTORM_NEO4J_CACHE_MB:-}${BRAINSTORM_NEO4J_TX_MAX_MB:-}" ]; then
  echo "  BRAINSTORM_NEO4J_* override active (OPEN.md row 186): heap=${NEO4J_HEAP_MB}m cache=${NEO4J_CACHE_MB}m tx=${NEO4J_TX_MAX_MB}m"
fi

# Concurrent transaction limit: ~100 per CPU core
NEO4J_CONCURRENT_MAX=$((NUM_CPUS * 100))

echo "=== Neo4j Dynamic Configuration ==="
echo "  System RAM: ${TOTAL_MEM_MB}MB, CPUs: ${NUM_CPUS}"
echo "  Reserved for other services: ${RESERVED_MB}MB"
echo "  Neo4j heap: ${NEO4J_HEAP_MB}MB, page cache: ${NEO4J_CACHE_MB}MB"
echo "  Transaction memory max: ${NEO4J_TX_MAX_MB}MB"
echo "  Concurrent transactions max: ${NEO4J_CONCURRENT_MAX}"

# Remove any existing memory/GC settings (from Dockerfile or previous runs)
sed -i '/^server.memory.heap/d' /etc/neo4j/neo4j.conf
sed -i '/^server.memory.pagecache/d' /etc/neo4j/neo4j.conf
sed -i '/^dbms.memory.transaction/d' /etc/neo4j/neo4j.conf
sed -i '/^db.transaction.concurrent/d' /etc/neo4j/neo4j.conf
sed -i '/^server.jvm.additional=-XX:.*G1/d' /etc/neo4j/neo4j.conf
sed -i '/^server.jvm.additional=-XX:+UseG1GC/d' /etc/neo4j/neo4j.conf
sed -i '/^server.jvm.additional=-XX:+ExitOnOutOfMemoryError/d' /etc/neo4j/neo4j.conf
sed -i '/^server.jvm.additional=-XX:+HeapDumpOnOutOfMemoryError/d' /etc/neo4j/neo4j.conf
sed -i '/^# Dynamic Neo4j settings/d' /etc/neo4j/neo4j.conf
sed -i '/^# Memory settings for Docker/d' /etc/neo4j/neo4j.conf

# Write dynamic settings
cat >> /etc/neo4j/neo4j.conf << NEO4JMEM

# Dynamic Neo4j settings (calculated at startup by entrypoint.sh)
server.memory.heap.initial_size=${NEO4J_HEAP_MB}m
server.memory.heap.max_size=${NEO4J_HEAP_MB}m
server.memory.pagecache.size=${NEO4J_CACHE_MB}m
dbms.memory.transaction.total.max=${NEO4J_TX_MAX_MB}m
db.transaction.concurrent.maximum=${NEO4J_CONCURRENT_MAX}
NEO4JMEM

# G1GC for heaps ≥ 4GB (better pause times with large heaps)
if [ "$NEO4J_HEAP_MB" -ge 4096 ]; then
  cat >> /etc/neo4j/neo4j.conf << G1GCCONF
server.jvm.additional=-XX:+UseG1GC
server.jvm.additional=-XX:+ExitOnOutOfMemoryError
server.jvm.additional=-XX:+HeapDumpOnOutOfMemoryError
server.jvm.additional=-XX:HeapDumpPath=/var/log/brainstorm/
G1GCCONF
  # Larger G1 region size for heaps ≥ 8GB
  if [ "$NEO4J_HEAP_MB" -ge 8192 ]; then
    echo "server.jvm.additional=-XX:G1HeapRegionSize=16m" >> /etc/neo4j/neo4j.conf
    echo "server.jvm.additional=-XX:G1NewSizePercent=20" >> /etc/neo4j/neo4j.conf
    echo "server.jvm.additional=-XX:G1MaxNewSizePercent=40" >> /etc/neo4j/neo4j.conf
  fi
  echo "  G1GC enabled (heap ≥ 4GB)"
else
  # Still add OOM handler for small heaps
  echo "server.jvm.additional=-XX:+ExitOnOutOfMemoryError" >> /etc/neo4j/neo4j.conf
  echo "  Default GC (heap < 4GB)"
fi

# Set Neo4j initial password (ignore error if already set)
neo4j-admin dbms set-initial-password "$NEO4J_PASSWORD" 2>/dev/null || true

# Create brainstorm system user if not exists
id -u brainstorm &>/dev/null || useradd -r -s /bin/false brainstorm

# Set directory ownership
chown -R strfry:strfry /var/lib/strfry
chown -R neo4j:neo4j /var/lib/neo4j
chown -R root:root /var/lib/brainstorm /var/log/brainstorm

# Generate Nostr identity for relay if create_nostr_identity.sh exists
if [ -f "${BRAINSTORM_MODULE_BASE_DIR}setup/create_nostr_identity.sh" ]; then
  chmod +x "${BRAINSTORM_MODULE_BASE_DIR}setup/create_nostr_identity.sh"
  "${BRAINSTORM_MODULE_BASE_DIR}setup/create_nostr_identity.sh" || echo "WARNING: Failed to generate Nostr identity"
fi

# --- Ensure node_modules exist (handles bind-mount + volume case) ---
if [ ! -d "${BRAINSTORM_MODULE_BASE_DIR}node_modules/express" ]; then
  echo "Installing npm dependencies..."
  cd "${BRAINSTORM_MODULE_BASE_DIR}" && npm install --production 2>&1 | tail -3
fi

# --- strfry router config ---
# Router config is normally managed by initRouter() in the Node app, which reads
# from router-state.json (persistent volume) or initializes from router-presets.json.
# On a true first boot the bundled template seeds /etc/ with the legacy defaults.
if [ ! -f "/var/lib/brainstorm/router-state.json" ] && [ -f "${BRAINSTORM_MODULE_BASE_DIR}setup/strfry-router-tapestry.config" ]; then
  cp "${BRAINSTORM_MODULE_BASE_DIR}setup/strfry-router-tapestry.config" /etc/strfry-router-tapestry.config
fi

# Guarantee /etc/strfry-router-tapestry.config exists before supervisord starts.
# strfry-router (priority 25) boots before brainstorm (priority 30), and /etc/ is
# not on a persistent volume — so on container restart with existing state, the
# template branch above is skipped and the file is absent. Without this fallback
# the daemon crash-loops until supervisord marks it FATAL.
if [ ! -f /etc/strfry-router-tapestry.config ]; then
  cat > /etc/strfry-router-tapestry.config << 'ROUTERCFG'
connectionTimeout = 20

streams {
}
ROUTERCFG
fi

# --- Brainstorm startup wrapper ---
# Sources brainstorm.conf so all env vars are available to the node process
cat > /usr/local/bin/start-brainstorm.sh << 'BSEOF'
#!/bin/bash
source /etc/brainstorm.conf
exec node /usr/local/lib/node_modules/brainstorm/bin/control-panel.js
BSEOF
chmod +x /usr/local/bin/start-brainstorm.sh

# --- Nginx setup ---
# Configure site (file should be baked in or bind-mounted)
if [ -f /etc/nginx/sites-available/brainstorm ]; then
  ln -sf /etc/nginx/sites-available/brainstorm /etc/nginx/sites-enabled/brainstorm
  rm -f /etc/nginx/sites-enabled/default
fi

# Add bolt stream proxy if not already present
if ! grep -q "stream {" /etc/nginx/nginx.conf 2>/dev/null; then
  cat >> /etc/nginx/nginx.conf << 'NGINXEOF'

# Neo4j Bolt TCP proxy
stream {
    server {
        listen 8687;
        proxy_pass localhost:7687;
    }
}
NGINXEOF
fi

# Start nginx in background (not managed by supervisord for simplicity)
nginx 2>/dev/null || echo "WARNING: nginx failed to start"

# --- Neo4j password change ---
# The initial password is set above, but if this is a volume-persisted DB
# the initial password command is a no-op. We need to change it after neo4j starts.
# We do this in the background so it doesn't block supervisord startup.
(
  # Wait for neo4j to be ready
  for i in $(seq 1 30); do
    if cd /usr/local/lib/node_modules/brainstorm && node -e "
      const neo4j = require('neo4j-driver');
      const d = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', '${NEO4J_PASSWORD}'));
      d.getServerInfo().then(() => { d.close(); process.exit(0); }).catch(() => { d.close(); process.exit(1); });
    " 2>/dev/null; then
      echo "Neo4j ready with configured password"
      break
    fi
    # Try changing from default password
    if cd /usr/local/lib/node_modules/brainstorm && node -e "
      const neo4j = require('neo4j-driver');
      const d = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'neo4j'));
      const s = d.session({database:'system'});
      s.run(\"ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO '${NEO4J_PASSWORD}'\")
        .then(() => { console.log('Neo4j password changed!'); s.close(); d.close(); process.exit(0); })
        .catch(() => { s.close(); d.close(); process.exit(1); });
    " 2>/dev/null; then
      break
    fi
    sleep 2
  done
) &

# Symlink concept-graph defaults so setup.sh can find it
ln -sf /usr/local/lib/node_modules/brainstorm/src/concept-graph/parameters/defaults.conf /etc/concept-graph.conf

# Start supervisord
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
