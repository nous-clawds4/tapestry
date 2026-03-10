#!/bin/bash
set -e

# Defaults
OWNER_PUBKEY="${OWNER_PUBKEY:-unassigned}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-neo4j}"
DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
RELAY_URL="${RELAY_URL:-ws://localhost:7777}"

BRAINSTORM_MODULE_BASE_DIR="/usr/local/lib/node_modules/brainstorm/"
BRAINSTORM_NODE_BIN="$(which node)"
SESSION_SECRET="$(openssl rand -hex 32)"

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

# Generate /etc/brainstorm.conf
cat > /etc/brainstorm.conf << CONFEOF
# Brainstorm Configuration (Docker)

BRAINSTORM_NODE_BIN="${BRAINSTORM_NODE_BIN}"
export BRAINSTORM_NODE_BIN

# File paths
BRAINSTORM_MODULE_BASE_DIR="${BRAINSTORM_MODULE_BASE_DIR}"
BRAINSTORM_MODULE_SRC_DIR="${BRAINSTORM_MODULE_BASE_DIR}src/"
BRAINSTORM_MODULE_ALGOS_DIR="${BRAINSTORM_MODULE_BASE_DIR}src/algos"
BRAINSTORM_EXPORT_DIR="${BRAINSTORM_MODULE_BASE_DIR}src/export"
BRAINSTORM_MODULE_MANAGE_DIR="${BRAINSTORM_MODULE_BASE_DIR}src/manage"
BRAINSTORM_NIP85_DIR="${BRAINSTORM_MODULE_BASE_DIR}src/algos/nip85"
BRAINSTORM_MODULE_PIPELINE_DIR="${BRAINSTORM_MODULE_BASE_DIR}src/pipeline"
STRFRY_PLUGINS_BASE="/usr/local/lib/strfry/plugins/"
STRFRY_PLUGINS_DATA="/usr/local/lib/strfry/plugins/data/"
BRAINSTORM_LOG_DIR="/var/log/brainstorm"
BRAINSTORM_BASE_DIR="/var/lib/brainstorm"

export BRAINSTORM_MODULE_BASE_DIR
export BRAINSTORM_MODULE_SRC_DIR
export BRAINSTORM_MODULE_ALGOS_DIR
export BRAINSTORM_EXPORT_DIR
export BRAINSTORM_MODULE_MANAGE_DIR
export BRAINSTORM_NIP85_DIR
export STRFRY_PLUGINS_BASE
export STRFRY_PLUGINS_DATA
export BRAINSTORM_LOG_DIR
export BRAINSTORM_BASE_DIR

# WoT relays
export BRAINSTORM_DEFAULT_WOT_RELAYS='wss://wot.grapevine.network,wss://wot.brainstorm.social,wss://profiles.nostr1.com,wss://relay.hasenpfeffr.com'
export BRAINSTORM_WOT_RELAYS='wss://wot.grapevine.network,wss://wot.brainstorm.social,wss://profiles.nostr1.com,wss://relay.hasenpfeffr.com'

# NIP-85 relays
export BRAINSTORM_DEFAULT_NIP85_RELAYS='wss://nip85.brainstorm.world,wss://nip85.nostr1.com'
export BRAINSTORM_NIP85_RELAYS='wss://nip85.brainstorm.world,wss://nip85.nostr1.com'
export BRAINSTORM_DEFAULT_NIP85_HOME_RELAY='wss://nip85.brainstorm.world'
export BRAINSTORM_NIP85_HOME_RELAY='wss://nip85.brainstorm.world'

# Popular general purpose relays
export BRAINSTORM_DEFAULT_POPULAR_GENERAL_PURPOSE_RELAYS='wss://relay.nostr.band,wss://relay.damus.io,wss://relay.primal.net'
export BRAINSTORM_POPULAR_GENERAL_PURPOSE_RELAYS='wss://relay.nostr.band,wss://relay.damus.io,wss://relay.primal.net'

# NIP-85 configuration
export BRAINSTORM_30382_LIMIT="10"

# Performance tuning
export BRAINSTORM_BATCH_SIZE="100"
export BRAINSTORM_DELAY_BETWEEN_BATCHES="1000"
export BRAINSTORM_DELAY_BETWEEN_EVENTS="50"
export BRAINSTORM_MAX_RETRIES="3"
export BRAINSTORM_MAX_CONCURRENT_CONNECTIONS="5"

# Relay configuration
export BRAINSTORM_RELAY_URL="${RELAY_URL}"

# Neo4j configuration
export BRAINSTORM_NEO4J_BROWSER_URL="http://${DOMAIN_NAME}:7474"
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="${NEO4J_PASSWORD}"

# Strfry configuration
export STRFRY_DOMAIN="${DOMAIN_NAME}"

# Owner
export BRAINSTORM_OWNER_PUBKEY="${OWNER_PUBKEY}"
export BRAINSTORM_OWNER_NPUB="${OWNER_NPUB}"
export BRAINSTORM_MANAGER_PUBKEYS=""

# Security
export SESSION_SECRET="${SESSION_SECRET}"

# Process all tasks interval
export BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL="12hours"

# Actions
export BRAINSTORM_SEND_EMAIL_UPDATES=0
export BRAINSTORM_ACCESS=0
export BRAINSTORM_CREATED_CONSTRAINTS_AND_INDEXES=0
CONFEOF

chmod 664 /etc/brainstorm.conf

# Generate strfry.conf from the default template
if [ -f /usr/local/src/strfry/strfry.conf ]; then
  cp /usr/local/src/strfry/strfry.conf /etc/strfry.conf
  sed -i 's|db = ".*"|db = "/var/lib/strfry/"|' /etc/strfry.conf
  sed -i 's|nofiles = .*|nofiles = 0|' /etc/strfry.conf
  sed -i 's|maxEventSize = .*|maxEventSize = 1048576|' /etc/strfry.conf
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
# Router config is now managed by initRouter() in the Node app.
# It reads from router-state.json (persistent volume) or initializes from router-presets.json.
# Only write a fallback config if no state file exists AND the app hasn't started yet.
if [ ! -f "/var/lib/brainstorm/router-state.json" ] && [ -f "${BRAINSTORM_MODULE_BASE_DIR}setup/strfry-router-tapestry.config" ]; then
  cp "${BRAINSTORM_MODULE_BASE_DIR}setup/strfry-router-tapestry.config" /etc/strfry-router-tapestry.config
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
