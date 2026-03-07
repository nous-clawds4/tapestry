#!/bin/bash

# Script to create a new Nostr identity for the brainstorm relay
# This script generates NSEC, PUBKEY, and NPUB and stores them securely
#
# IDEMPOTENCY GUARD: If the TA key already exists in secure storage,
# skip generation entirely to preserve the canonical identity.

SECURE_KEYS_DIR="/var/lib/brainstorm/secure-keys"
TA_KEY_FILE="$SECURE_KEYS_DIR/tapestry-assistant.json"

if [ -f "$TA_KEY_FILE" ]; then
    echo "Tapestry Assistant key already exists in secure storage ($TA_KEY_FILE). Skipping identity generation."
    # Still ensure brainstorm.conf has the pubkey (non-secret) for backward compat
    if [ -f "/etc/brainstorm.conf" ]; then
        # Extract pubkey from secure storage via node
        TA_PUBKEY=$(node -e "
            try {
                const fs = require('fs');
                const crypto = require('crypto');
                const masterKey = fs.readFileSync('$SECURE_KEYS_DIR/.master-key', 'utf8').trim();
                const key = crypto.createHash('sha256').update(masterKey).digest();
                const outer = JSON.parse(fs.readFileSync('$TA_KEY_FILE', 'utf8'));
                const iv = Buffer.from(outer.iv, 'hex');
                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(Buffer.from(outer.authTag, 'hex'));
                let dec = decipher.update(outer.encrypted, 'hex', 'utf8');
                dec += decipher.final('utf8');
                const inner = JSON.parse(dec);
                console.log(inner.pubkey || '');
            } catch(e) { console.error(e.message); }
        " 2>/dev/null)
        if [ -n "$TA_PUBKEY" ]; then
            if ! grep -q "BRAINSTORM_RELAY_PUBKEY" /etc/brainstorm.conf; then
                echo "export BRAINSTORM_RELAY_PUBKEY='$TA_PUBKEY'" >> /etc/brainstorm.conf
                echo "export BRAINSTORM_RELAY_NPUB='$(node -e "console.log(require('nostr-tools').nip19.npubEncode('$TA_PUBKEY'))")'" >> /etc/brainstorm.conf
                echo "# TA pubkey from secure storage (privkey NOT in this file)" >> /etc/brainstorm.conf
            fi
        fi
    fi
    exit 0
fi

# Check if nodejs and npm are installed
if ! command -v node &> /dev/null; then
    echo "Node.js is required but not installed. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check if jq is installed (needed for JSON processing)
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed. Installing..."
    sudo apt-get update
    sudo apt-get install -y jq
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Create directory for storing keys if it doesn't exist
KEYS_DIR="${SCRIPT_DIR}/nostr/keys"
mkdir -p "$KEYS_DIR"

# Create a project directory for Node.js dependencies
NOSTR_PROJECT_DIR="${SCRIPT_DIR}/nostr/node_project"
mkdir -p "$NOSTR_PROJECT_DIR"

# Initialize npm project and install required packages
cd "$NOSTR_PROJECT_DIR"
if [ ! -f "package.json" ]; then
    echo "Initializing npm project..."
    echo '{"name":"brainstorm-nostr","version":"1.0.0","private":true}' > package.json
fi

echo "Installing nostr-tools locally..."
npm install --save nostr-tools

# Generate Nostr keys using Node.js
echo "Generating new Nostr identity..."
KEYS_JSON=$(node -e "
const nostrTools = require('nostr-tools');
const privateKey = nostrTools.generateSecretKey();
const pubkey = nostrTools.getPublicKey(privateKey);
const npub = nostrTools.nip19.npubEncode(pubkey);
const nsecEncoded = nostrTools.nip19.nsecEncode(privateKey);

// Convert hex to string for storage
const privateKeyHex = Buffer.from(privateKey).toString('hex');

console.log(JSON.stringify({
  privkey: privateKeyHex,
  nsec: nsecEncoded,
  pubkey: pubkey,
  npub: npub
}));
")

# Extract keys from JSON
BRAINSTORM_RELAY_PRIVKEY=$(echo $KEYS_JSON | jq -r '.privkey')
BRAINSTORM_RELAY_NSEC=$(echo $KEYS_JSON | jq -r '.nsec')
BRAINSTORM_RELAY_PUBKEY=$(echo $KEYS_JSON | jq -r '.pubkey')
BRAINSTORM_RELAY_NPUB=$(echo $KEYS_JSON | jq -r '.npub')

# ── Store keys in SecureKeyStorage (encrypted at rest) ──
echo "Storing keys in SecureKeyStorage..."
mkdir -p "$SECURE_KEYS_DIR"

# Generate master key if it doesn't exist
if [ ! -f "$SECURE_KEYS_DIR/.master-key" ]; then
    openssl rand -hex 32 > "$SECURE_KEYS_DIR/.master-key"
    chmod 600 "$SECURE_KEYS_DIR/.master-key"
    echo "Generated new master key for secure storage"
fi

node -e "
const { SecureKeyStorage } = require('$(dirname "$0")/../src/utils/secureKeyStorage');
(async () => {
    const storage = new SecureKeyStorage({ storagePath: '$SECURE_KEYS_DIR' });
    await storage.storeRelayKeys('tapestry-assistant', {
        privkey: '$BRAINSTORM_RELAY_PRIVKEY',
        nsec: '$BRAINSTORM_RELAY_NSEC',
        pubkey: '$BRAINSTORM_RELAY_PUBKEY',
        npub: '$BRAINSTORM_RELAY_NPUB'
    });
    console.log('TA key stored in secure storage');
})().catch(e => { console.error('Failed to store in secure storage:', e.message); process.exit(1); });
"

# Also keep legacy key files for backward compat (will be deprecated)
KEYS_FILE="$KEYS_DIR/brainstorm_relay_keys"
echo "$KEYS_JSON" > "$KEYS_FILE"
chmod 600 "$KEYS_FILE"
KEYS_SH_FILE="$KEYS_DIR/brainstorm_relay_keys.sh"
echo "BRAINSTORM_RELAY_PRIVKEY='$BRAINSTORM_RELAY_PRIVKEY'" > "$KEYS_SH_FILE"
echo "BRAINSTORM_RELAY_NSEC='$BRAINSTORM_RELAY_NSEC'" >> "$KEYS_SH_FILE"
echo "BRAINSTORM_RELAY_PUBKEY='$BRAINSTORM_RELAY_PUBKEY'" >> "$KEYS_SH_FILE"
echo "BRAINSTORM_RELAY_NPUB='$BRAINSTORM_RELAY_NPUB'" >> "$KEYS_SH_FILE"
chmod 600 "$KEYS_SH_FILE"

# Add ONLY public keys to brainstorm.conf (NO private keys)
if [ -f "/etc/brainstorm.conf" ]; then
    echo "Adding public keys to /etc/brainstorm.conf (privkey in secure storage only)..."
    # Remove any existing privkey/nsec lines
    sudo sed -i "/BRAINSTORM_RELAY_PRIVKEY/d" /etc/brainstorm.conf
    sudo sed -i "/BRAINSTORM_RELAY_NSEC/d" /etc/brainstorm.conf

    if grep -q "BRAINSTORM_RELAY_PUBKEY" /etc/brainstorm.conf; then
        sudo sed -i "/BRAINSTORM_RELAY_PUBKEY/c\export BRAINSTORM_RELAY_PUBKEY='$BRAINSTORM_RELAY_PUBKEY'" /etc/brainstorm.conf
        sudo sed -i "/BRAINSTORM_RELAY_NPUB/c\export BRAINSTORM_RELAY_NPUB='$BRAINSTORM_RELAY_NPUB'" /etc/brainstorm.conf
    else
        echo "export BRAINSTORM_RELAY_PUBKEY='$BRAINSTORM_RELAY_PUBKEY'" | sudo tee -a /etc/brainstorm.conf
        echo "export BRAINSTORM_RELAY_NPUB='$BRAINSTORM_RELAY_NPUB'" | sudo tee -a /etc/brainstorm.conf
        echo "# TA pubkey added by create_nostr_identity.sh (privkey in secure storage)" | sudo tee -a /etc/brainstorm.conf > /dev/null
    fi
else
    echo "Warning: /etc/brainstorm.conf not found."
fi

echo "Nostr identity created successfully!"
echo "PUBKEY: $BRAINSTORM_RELAY_PUBKEY"
echo "NPUB: $BRAINSTORM_RELAY_NPUB"
echo "Keys stored securely in JSON format in $KEYS_FILE"
echo "Shell-compatible keys also stored in $KEYS_SH_FILE for backward compatibility"
echo "Keys have also been added to /etc/brainstorm.conf (if it exists)"
